import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { schrijfAuditLog } from "../audit-log";
import type { AuditInvoer } from "../audit-log";
import { pasEncryptieToe } from "../db-encryptie";
import { vindDatabasePad } from "../db-pad";
import {
  FASEN_VAN_TRAJECT,
  NAMEN_VAN_WERKSTROMEN,
  trajecten,
  trajectFasen,
  trajectGebeurtenissen,
  trajectLijnen,
  trajectPartijen,
  trajectVragen,
  trajectWerkstromen,
} from "./schema";
import type {
  Traject,
  TrajectFase,
  TrajectGebeurtenis,
  TrajectLijn,
  TrajectPartij,
  TrajectVraag,
  TrajectWerkstroom,
} from "./schema";
import { VRAAGTOESTANDEN } from "./afleiding";
import type { VraagToestand } from "./afleiding";

export type TrajectAuditSchrijver = (invoer: AuditInvoer) => void;

export interface MaakTrajectInvoer {
  naam: string;
  organisatieId: number;
  beheerderId: number;
  zekerheidstrap?: number;
  aangemaaktOp?: number;
}

export interface VoegPartijToeInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  soort: string;
  naam: string;
  ankerpunt: string;
  kring: number;
  rol: string;
}

export interface VoegLijnToeInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  partijEenId: number;
  partijTweeId: number;
  stiltedrempelDagen: number;
  aangemaaktOp?: number;
}

export interface VoegGebeurtenisToeInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  lijnId: number;
  tijdstip: number;
  soort: "gesprek" | "bericht" | "rechtstreeks_contact";
  vaststelling: string;
  indruk?: string;
}

export interface MaakVraagkaartInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  lijnId: number;
  vragerPartijId: number;
  ontvangerPartijId: number;
  werkstroomId: number;
  vraagtekst: string;
  kader: string;
  antwoordtermijnOp: number;
  antwoordKring: number;
  aangemaaktOp?: number;
}

export interface VeranderVraagtoestandInvoer {
  vraagId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  toestand: VraagToestand;
  vrijgaveVragerDoorBeheerderId?: number;
  vrijgaveOntvangerDoorBeheerderId?: number;
  veranderdOp?: number;
}

export interface VraagkaartVrijgevenInvoer {
  vraagId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  zijde: "vrager" | "ontvanger";
  vrijgegevenOp?: number;
}

export interface VolledigTraject {
  traject: Traject;
  fasen: TrajectFase[];
  partijen: TrajectPartij[];
  lijnen: TrajectLijn[];
  werkstromen: TrajectWerkstroom[];
  vragen: TrajectVraag[];
  gebeurtenissen: TrajectGebeurtenis[];
}

function nietLegeTekst(waarde: string, veld: string): string {
  const opgeschoond = waarde.trim();
  if (!opgeschoond) {
    throw new Error(`${veld} is verplicht.`);
  }
  return opgeschoond;
}

function geheelGetalBinnenBereik(
  waarde: number,
  minimum: number,
  maximum: number,
  veld: string,
): void {
  if (!Number.isInteger(waarde) || waarde < minimum || waarde > maximum) {
    throw new Error(`${veld} moet een geheel getal van ${minimum} tot en met ${maximum} zijn.`);
  }
}

function tijdstipOfNu(waarde: number | undefined, veld: string): number {
  const tijdstip = waarde ?? Date.now();
  if (!Number.isFinite(tijdstip)) {
    throw new Error(`${veld} moet een eindig tijdstip in milliseconden zijn.`);
  }
  return tijdstip;
}

function isVraagToestand(waarde: string): waarde is VraagToestand {
  return (VRAAGTOESTANDEN as readonly string[]).includes(waarde);
}

/**
 * De enige toegestane route is gesteld, erkend, in behandeling, beantwoord,
 * gedeeld. De laatste stap heeft altijd dubbele vrijgave nodig.
 */
export function controleerVraagovergang(
  huidig: VraagToestand,
  doel: VraagToestand,
  heeftDubbeleVrijgave: boolean,
): void {
  const volgende: Record<VraagToestand, VraagToestand | null> = {
    gesteld: "erkend",
    erkend: "in_behandeling",
    in_behandeling: "beantwoord",
    beantwoord: "gedeeld",
    gedeeld: null,
  };

  if (volgende[huidig] !== doel) {
    throw new Error(`Ongeldige vraagovergang van ${huidig} naar ${doel}.`);
  }
  if (doel === "gedeeld" && !heeftDubbeleVrijgave) {
    throw new Error("De overgang naar gedeeld vereist dubbele vrijgave.");
  }
}

/**
 * Maakt de opslaghandelingen testbaar met een expliciete databankverbinding.
 * De normale export onderaan gebruikt steeds het centrale pad en de encryptie-
 * hook van het platform.
 */
export function maakTrajectOpslag(
  sqlite: Database.Database,
  schrijfAudit: TrajectAuditSchrijver = schrijfAuditLog,
) {
  const db = drizzle(sqlite);

  function haalTrajectZonderScope(trajectId: number): Traject {
    const traject = db.select().from(trajecten).where(eq(trajecten.id, trajectId)).get();
    if (!traject) throw new Error("Traject niet gevonden.");
    return traject;
  }

  function controleerBeheerderVoorOrganisatie(beheerderId: number, organisatieId: number): void {
    const organisatie = sqlite
      .prepare("SELECT id FROM organisaties WHERE id = ?")
      .get(organisatieId) as { id: number } | undefined;
    if (!organisatie) throw new Error("Organisatie niet gevonden.");

    const beheerder = sqlite
      .prepare("SELECT organisatie_id, is_prior FROM beheerders WHERE id = ?")
      .get(beheerderId) as
      | { organisatie_id: number | null; is_prior: number }
      | undefined;
    if (!beheerder) throw new Error("Beheerder niet gevonden.");
    if (beheerder.is_prior === 1) return;
    if (beheerder.organisatie_id !== organisatieId) {
      throw new Error("De beheerder valt buiten de organisatiegrens van dit traject.");
    }
  }

  function controleerBeheerderVoorTraject(
    beheerderId: number,
    trajectId: number,
    organisatieScope?: number | null,
  ): Traject {
    const traject = haalTrajectZonderScope(trajectId);
    if (organisatieScope !== undefined) {
      if (organisatieScope !== null && traject.organisatieId !== organisatieScope) {
        throw new Error("De beheerder valt buiten de organisatiegrens van dit traject.");
      }
      return traject;
    }
    controleerBeheerderVoorOrganisatie(beheerderId, traject.organisatieId);
    return traject;
  }

  function haalPartijVanTraject(partijId: number, trajectId: number): TrajectPartij {
    const partij = db
      .select()
      .from(trajectPartijen)
      .where(and(eq(trajectPartijen.id, partijId), eq(trajectPartijen.trajectId, trajectId)))
      .get();
    if (!partij) throw new Error("Partij hoort niet bij dit traject.");
    return partij;
  }

  function haalLijnVanTraject(lijnId: number, trajectId: number): TrajectLijn {
    const lijn = db
      .select()
      .from(trajectLijnen)
      .where(and(eq(trajectLijnen.id, lijnId), eq(trajectLijnen.trajectId, trajectId)))
      .get();
    if (!lijn) throw new Error("Lijn hoort niet bij dit traject.");
    return lijn;
  }

  function schrijfTrajectAudit(
    beheerderId: number,
    actie: AuditInvoer["actie"],
    trajectId: number,
    detail: string,
  ): void {
    schrijfAudit({
      adminId: beheerderId,
      actie,
      afnameId: trajectId,
      detail,
    });
  }

  return {
    maakTraject(invoer: MaakTrajectInvoer): Traject {
      const naam = nietLegeTekst(invoer.naam, "Naam");
      geheelGetalBinnenBereik(invoer.organisatieId, 1, Number.MAX_SAFE_INTEGER, "Organisatie");
      geheelGetalBinnenBereik(invoer.beheerderId, 1, Number.MAX_SAFE_INTEGER, "Beheerder");
      const zekerheidstrap = invoer.zekerheidstrap ?? 1;
      geheelGetalBinnenBereik(zekerheidstrap, 1, 4, "Zekerheidstrap");
      const aangemaaktOp = tijdstipOfNu(invoer.aangemaaktOp, "Aanmaakmoment");
      controleerBeheerderVoorOrganisatie(invoer.beheerderId, invoer.organisatieId);

      const maakAlles = sqlite.transaction(() => {
        const traject = db
          .insert(trajecten)
          .values({
            naam,
            organisatieId: invoer.organisatieId,
            aangemaaktDoorBeheerderId: invoer.beheerderId,
            huidigeFase: 1,
            zekerheidstrap,
            status: "open",
            aangemaaktOp,
          })
          .returning()
          .get();

        db.insert(trajectFasen)
          .values(
            FASEN_VAN_TRAJECT.map((fase) => ({
              trajectId: traject.id,
              volgnummer: fase.volgnummer,
              naam: fase.naam,
              poortomschrijving: fase.poortomschrijving,
              poortstatus: "gesloten",
              poortGeopendOp: null,
              poortGeopendDoorBeheerderId: null,
            })),
          )
          .run();

        db.insert(trajectWerkstromen)
          .values(
            NAMEN_VAN_WERKSTROMEN.map((naamWerkstroom) => ({
              trajectId: traject.id,
              naam: naamWerkstroom,
              leiderPartijId: null,
              status: "niet_gestart",
              eerstvolgendeOplevering: null,
              eerstvolgendeOpleveringOp: null,
            })),
          )
          .run();
        return traject;
      });

      const traject = maakAlles();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_aangemaakt",
        traject.id,
        "Traject met negen fasen en zes werkstromen aangemaakt.",
      );
      return traject;
    },

    voegPartijToe(invoer: VoegPartijToeInvoer): TrajectPartij {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      geheelGetalBinnenBereik(invoer.kring, 0, 4, "Kring");
      const partij = db
        .insert(trajectPartijen)
        .values({
          trajectId: invoer.trajectId,
          soort: nietLegeTekst(invoer.soort, "Soort partij"),
          naam: nietLegeTekst(invoer.naam, "Naam partij"),
          ankerpunt: nietLegeTekst(invoer.ankerpunt, "Ankerpunt"),
          kring: invoer.kring,
          rol: nietLegeTekst(invoer.rol, "Rol"),
        })
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_partij_toegevoegd",
        invoer.trajectId,
        `Partij ${partij.id} toegevoegd.`,
      );
      return partij;
    },

    voegLijnToe(invoer: VoegLijnToeInvoer): TrajectLijn {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      if (invoer.partijEenId === invoer.partijTweeId) {
        throw new Error("Een lijn heeft twee verschillende partijen nodig.");
      }
      geheelGetalBinnenBereik(
        invoer.stiltedrempelDagen,
        0,
        Number.MAX_SAFE_INTEGER,
        "Stiltedrempel",
      );
      haalPartijVanTraject(invoer.partijEenId, invoer.trajectId);
      haalPartijVanTraject(invoer.partijTweeId, invoer.trajectId);
      const partijEenId = Math.min(invoer.partijEenId, invoer.partijTweeId);
      const partijTweeId = Math.max(invoer.partijEenId, invoer.partijTweeId);
      const bestaand = db
        .select({ id: trajectLijnen.id })
        .from(trajectLijnen)
        .where(
          and(
            eq(trajectLijnen.trajectId, invoer.trajectId),
            eq(trajectLijnen.partijEenId, partijEenId),
            eq(trajectLijnen.partijTweeId, partijTweeId),
          ),
        )
        .get();
      if (bestaand) throw new Error("De lijn tussen deze partijen bestaat al.");

      const lijn = db
        .insert(trajectLijnen)
        .values({
          trajectId: invoer.trajectId,
          partijEenId,
          partijTweeId,
          stiltedrempelDagen: invoer.stiltedrempelDagen,
          aangemaaktOp: tijdstipOfNu(invoer.aangemaaktOp, "Aanmaakmoment"),
        })
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_lijn_toegevoegd",
        invoer.trajectId,
        `Lijn ${lijn.id} toegevoegd.`,
      );
      return lijn;
    },

    voegGebeurtenisToe(invoer: VoegGebeurtenisToeInvoer): TrajectGebeurtenis {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      haalLijnVanTraject(invoer.lijnId, invoer.trajectId);
      tijdstipOfNu(invoer.tijdstip, "Tijdstip");
      const gebeurtenis = db
        .insert(trajectGebeurtenissen)
        .values({
          trajectId: invoer.trajectId,
          lijnId: invoer.lijnId,
          tijdstip: invoer.tijdstip,
          soort: invoer.soort,
          vaststelling: nietLegeTekst(invoer.vaststelling, "Vaststelling"),
          indruk: invoer.indruk?.trim() ?? "",
        })
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_gebeurtenis_toegevoegd",
        invoer.trajectId,
        `Gebeurtenis ${gebeurtenis.id} toegevoegd.`,
      );
      return gebeurtenis;
    },

    maakVraagkaart(invoer: MaakVraagkaartInvoer): TrajectVraag {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      const lijn = haalLijnVanTraject(invoer.lijnId, invoer.trajectId);
      haalPartijVanTraject(invoer.vragerPartijId, invoer.trajectId);
      haalPartijVanTraject(invoer.ontvangerPartijId, invoer.trajectId);
      const endpointsKloppen =
        (lijn.partijEenId === invoer.vragerPartijId &&
          lijn.partijTweeId === invoer.ontvangerPartijId) ||
        (lijn.partijEenId === invoer.ontvangerPartijId &&
          lijn.partijTweeId === invoer.vragerPartijId);
      if (!endpointsKloppen) {
        throw new Error("Vrager en ontvanger horen niet bij de gekozen lijn.");
      }
      const werkstroom = db
        .select()
        .from(trajectWerkstromen)
        .where(
          and(
            eq(trajectWerkstromen.id, invoer.werkstroomId),
            eq(trajectWerkstromen.trajectId, invoer.trajectId),
          ),
        )
        .get();
      if (!werkstroom) throw new Error("Werkstroom hoort niet bij dit traject.");
      geheelGetalBinnenBereik(invoer.antwoordKring, 0, 4, "Antwoordkring");
      const antwoordtermijnOp = tijdstipOfNu(invoer.antwoordtermijnOp, "Antwoordtermijn");

      const vraag = db
        .insert(trajectVragen)
        .values({
          trajectId: invoer.trajectId,
          lijnId: invoer.lijnId,
          vragerPartijId: invoer.vragerPartijId,
          ontvangerPartijId: invoer.ontvangerPartijId,
          werkstroomId: invoer.werkstroomId,
          vraagtekst: nietLegeTekst(invoer.vraagtekst, "Vraagtekst"),
          kader: nietLegeTekst(invoer.kader, "Kader"),
          antwoordtermijnOp,
          antwoordKring: invoer.antwoordKring,
          toestand: "gesteld",
          vrijgaveVragerDoorBeheerderId: null,
          vrijgaveOntvangerDoorBeheerderId: null,
          vrijgaveVragerOp: null,
          vrijgaveOntvangerOp: null,
          aangemaaktOp: tijdstipOfNu(invoer.aangemaaktOp, "Aanmaakmoment"),
        })
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_vraag_aangemaakt",
        invoer.trajectId,
        `Vraagkaart ${vraag.id} aangemaakt.`,
      );
      return vraag;
    },

    veranderVraagtoestand(invoer: VeranderVraagtoestandInvoer): TrajectVraag {
      const vraag = db.select().from(trajectVragen).where(eq(trajectVragen.id, invoer.vraagId)).get();
      if (!vraag) throw new Error("Vraagkaart niet gevonden.");
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        vraag.trajectId,
        invoer.organisatieScope,
      );
      if (!isVraagToestand(vraag.toestand)) {
        throw new Error("Vraagkaart heeft een ongeldige opgeslagen toestand.");
      }

      const heeftVrijgavegegevens =
        invoer.vrijgaveVragerDoorBeheerderId !== undefined ||
        invoer.vrijgaveOntvangerDoorBeheerderId !== undefined;
      const heeftDubbeleVrijgave =
        invoer.vrijgaveVragerDoorBeheerderId !== undefined &&
        invoer.vrijgaveOntvangerDoorBeheerderId !== undefined;
      controleerVraagovergang(vraag.toestand, invoer.toestand, heeftDubbeleVrijgave);

      if (invoer.toestand !== "gedeeld" && heeftVrijgavegegevens) {
        throw new Error("Vrijgavegegevens zijn alleen toegestaan bij delen.");
      }

      const veranderdOp = tijdstipOfNu(invoer.veranderdOp, "Wijzigingsmoment");
      let wijzigingen: {
        toestand: VraagToestand;
        vrijgaveVragerDoorBeheerderId?: number;
        vrijgaveOntvangerDoorBeheerderId?: number;
        vrijgaveVragerOp?: number;
        vrijgaveOntvangerOp?: number;
      } = { toestand: invoer.toestand };

      if (invoer.toestand === "gedeeld") {
        const vrager = invoer.vrijgaveVragerDoorBeheerderId!;
        const ontvanger = invoer.vrijgaveOntvangerDoorBeheerderId!;
        geheelGetalBinnenBereik(vrager, 1, Number.MAX_SAFE_INTEGER, "Vrijgever van de vrager");
        geheelGetalBinnenBereik(
          ontvanger,
          1,
          Number.MAX_SAFE_INTEGER,
          "Vrijgever van de ontvanger",
        );
        if (vrager === ontvanger) {
          throw new Error("Dubbele vrijgave vereist twee verschillende beheerders.");
        }
        controleerBeheerderVoorTraject(vrager, vraag.trajectId, invoer.organisatieScope);
        controleerBeheerderVoorTraject(ontvanger, vraag.trajectId, invoer.organisatieScope);
        wijzigingen = {
          toestand: "gedeeld",
          vrijgaveVragerDoorBeheerderId: vrager,
          vrijgaveOntvangerDoorBeheerderId: ontvanger,
          vrijgaveVragerOp: veranderdOp,
          vrijgaveOntvangerOp: veranderdOp,
        };
      }

      const veranderdeVraag = db
        .update(trajectVragen)
        .set(wijzigingen)
        .where(eq(trajectVragen.id, invoer.vraagId))
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_vraag_toestand_gewijzigd",
        vraag.trajectId,
        `Vraagkaart ${vraag.id}: ${vraag.toestand} naar ${invoer.toestand}.`,
      );
      return veranderdeVraag;
    },

    vraagkaartVrijgeven(invoer: VraagkaartVrijgevenInvoer): TrajectVraag {
      geheelGetalBinnenBereik(invoer.vraagId, 1, Number.MAX_SAFE_INTEGER, "Vraagkaart");
      geheelGetalBinnenBereik(invoer.beheerderId, 1, Number.MAX_SAFE_INTEGER, "Beheerder");
      const vrijgegevenOp = tijdstipOfNu(invoer.vrijgegevenOp, "Vrijgavemoment");

      const geefVrij = sqlite.transaction(() => {
        const vraag = db.select().from(trajectVragen).where(eq(trajectVragen.id, invoer.vraagId)).get();
        if (!vraag) throw new Error("Vraagkaart niet gevonden.");
        controleerBeheerderVoorTraject(
          invoer.beheerderId,
          vraag.trajectId,
          invoer.organisatieScope,
        );
        if (vraag.toestand !== "beantwoord") {
          throw new Error("Een vraagkaart kan alleen vanuit beantwoord worden vrijgegeven.");
        }

        const bestaandDoorBeheerderId =
          invoer.zijde === "vrager"
            ? vraag.vrijgaveVragerDoorBeheerderId
            : vraag.vrijgaveOntvangerDoorBeheerderId;
        const andereDoorBeheerderId =
          invoer.zijde === "vrager"
            ? vraag.vrijgaveOntvangerDoorBeheerderId
            : vraag.vrijgaveVragerDoorBeheerderId;

        if (
          bestaandDoorBeheerderId !== null &&
          bestaandDoorBeheerderId !== invoer.beheerderId
        ) {
          throw new Error("Deze zijde is al door een andere beheerder vrijgegeven.");
        }
        if (andereDoorBeheerderId === invoer.beheerderId) {
          throw new Error("Dubbele vrijgave vereist twee verschillende beheerders.");
        }

        if (bestaandDoorBeheerderId === null) {
          if (invoer.zijde === "vrager") {
            db.update(trajectVragen)
              .set({
                vrijgaveVragerDoorBeheerderId: invoer.beheerderId,
                vrijgaveVragerOp: vrijgegevenOp,
              })
              .where(eq(trajectVragen.id, vraag.id))
              .run();
          } else {
            db.update(trajectVragen)
              .set({
                vrijgaveOntvangerDoorBeheerderId: invoer.beheerderId,
                vrijgaveOntvangerOp: vrijgegevenOp,
              })
              .where(eq(trajectVragen.id, vraag.id))
              .run();
          }
        }

        const naVrijgave = db
          .select()
          .from(trajectVragen)
          .where(eq(trajectVragen.id, vraag.id))
          .get();
        if (!naVrijgave) throw new Error("Vraagkaart niet gevonden.");

        const volledigVrijgegeven =
          naVrijgave.vrijgaveVragerDoorBeheerderId !== null &&
          naVrijgave.vrijgaveOntvangerDoorBeheerderId !== null;
        if (!volledigVrijgegeven) return naVrijgave;

        return db
          .update(trajectVragen)
          .set({ toestand: "gedeeld" })
          .where(eq(trajectVragen.id, vraag.id))
          .returning()
          .get();
      });

      const vraag = geefVrij();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_vraag_toestand_gewijzigd",
        vraag.trajectId,
        `Vrijgave voor vraagkaart ${vraag.id} aan de zijde van ${invoer.zijde} vastgelegd.`,
      );
      return vraag;
    },

    haalTrajectenVoorBeheerder(
      beheerderId: number,
      organisatieScope?: number | null,
    ): Traject[] {
      geheelGetalBinnenBereik(beheerderId, 1, Number.MAX_SAFE_INTEGER, "Beheerder");
      const beheerder = sqlite
        .prepare("SELECT organisatie_id, is_prior FROM beheerders WHERE id = ?")
        .get(beheerderId) as
        | { organisatie_id: number | null; is_prior: number }
        | undefined;
      if (!beheerder) throw new Error("Beheerder niet gevonden.");

      if (organisatieScope !== undefined) {
        if (organisatieScope === null) {
          return db.select().from(trajecten).orderBy(desc(trajecten.id)).all();
        }
        return db
          .select()
          .from(trajecten)
          .where(eq(trajecten.organisatieId, organisatieScope))
          .orderBy(desc(trajecten.id))
          .all();
      }

      if (beheerder.is_prior === 1) {
        return db.select().from(trajecten).orderBy(desc(trajecten.id)).all();
      }
      if (beheerder.organisatie_id === null) {
        throw new Error("De beheerder valt buiten de organisatiegrens van dit traject.");
      }
      return db
        .select()
        .from(trajecten)
        .where(eq(trajecten.organisatieId, beheerder.organisatie_id))
        .orderBy(desc(trajecten.id))
        .all();
    },

    haalGebeurtenissenVanLijn(
      lijnId: number,
      beheerderId: number,
      organisatieScope?: number | null,
    ): TrajectGebeurtenis[] {
      geheelGetalBinnenBereik(lijnId, 1, Number.MAX_SAFE_INTEGER, "Lijn");
      const lijn = db.select().from(trajectLijnen).where(eq(trajectLijnen.id, lijnId)).get();
      if (!lijn) throw new Error("Lijn niet gevonden.");
      controleerBeheerderVoorTraject(beheerderId, lijn.trajectId, organisatieScope);
      return db
        .select()
        .from(trajectGebeurtenissen)
        .where(eq(trajectGebeurtenissen.lijnId, lijnId))
        .orderBy(desc(trajectGebeurtenissen.tijdstip), desc(trajectGebeurtenissen.id))
        .all();
    },

    haalTrajectOp(
      trajectId: number,
      beheerderId: number,
      organisatieScope?: number | null,
    ): VolledigTraject {
      const traject = controleerBeheerderVoorTraject(beheerderId, trajectId, organisatieScope);
      return {
        traject,
        fasen: db
          .select()
          .from(trajectFasen)
          .where(eq(trajectFasen.trajectId, trajectId))
          .orderBy(asc(trajectFasen.volgnummer))
          .all(),
        partijen: db
          .select()
          .from(trajectPartijen)
          .where(eq(trajectPartijen.trajectId, trajectId))
          .orderBy(asc(trajectPartijen.id))
          .all(),
        lijnen: db
          .select()
          .from(trajectLijnen)
          .where(eq(trajectLijnen.trajectId, trajectId))
          .orderBy(asc(trajectLijnen.id))
          .all(),
        werkstromen: db
          .select()
          .from(trajectWerkstromen)
          .where(eq(trajectWerkstromen.trajectId, trajectId))
          .orderBy(asc(trajectWerkstromen.id))
          .all(),
        vragen: db
          .select()
          .from(trajectVragen)
          .where(eq(trajectVragen.trajectId, trajectId))
          .orderBy(asc(trajectVragen.id))
          .all(),
        gebeurtenissen: db
          .select()
          .from(trajectGebeurtenissen)
          .where(eq(trajectGebeurtenissen.trajectId, trajectId))
          .orderBy(asc(trajectGebeurtenissen.tijdstip))
          .all(),
      };
    },
  };
}

const sqlite = new Database(vindDatabasePad());
pasEncryptieToe(sqlite, "server/traject/storage.ts");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("cache_size = -8000");

export const trajectOpslag = maakTrajectOpslag(sqlite);
