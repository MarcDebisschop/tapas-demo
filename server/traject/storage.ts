import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { schrijfAuditLog } from "../audit-log";
import type { AuditInvoer } from "../audit-log";
import { pasEncryptieToe } from "../db-encryptie";
import { vindDatabasePad } from "../db-pad";
import {
  FASEN_VAN_TRAJECT,
  NAMEN_VAN_WERKSTROMEN,
  ROLLEN_VAN_TRAJECT,
  SOORTEN_MET_BELANG,
  STANDEN_VAN_WERKSTROOM,
  trajecten,
  trajectFasen,
  trajectGebeurtenissen,
  trajectLijnen,
  trajectPartijen,
  trajectPersonen,
  trajectRollen,
  trajectVragen,
  trajectWerkstromen,
} from "./schema";
import type {
  WerkstroomStand,
  Traject,
  TrajectFase,
  TrajectGebeurtenis,
  TrajectLijn,
  TrajectPartij,
  TrajectPersoon,
  TrajectRol,
  TrajectRolnaam,
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
  /**
   * De persoon van dit traject die de gebeurtenis vastlegde. Mag wegblijven:
   * bestaande aanroepen kennen geen auteur en houden een lege auteur.
   */
  vastgelegdDoorPersoonId?: number | null;
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

export interface WerkWerkstroomBijInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  naam: string;
  status: WerkstroomStand;
  eerstvolgendeOplevering?: string | null;
  eerstvolgendeOpleveringOp?: string | null;
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

export interface VoegPersoonToeInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  naam: string;
  email: string;
  partijId?: number | null;
  /** De aanmelding als TaPas-beheerder van deze persoon, wanneer die bestaat. */
  persoonBeheerderId?: number | null;
  /** De aanmelding als deelnemer aan een instrument, wanneer die bestaat. */
  persoonDeelnemerId?: number | null;
  aangemaaktOp?: number;
}

export interface ZetPersoonInactiefInvoer {
  persoonId: number;
  beheerderId: number;
  organisatieScope?: number | null;
}

export interface KenRolToeInvoer {
  trajectId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  persoonId: number;
  rol: TrajectRolnaam;
  werkstroomId?: number | null;
  toegekendOp?: number;
}

export interface TrekRolInInvoer {
  rolId: number;
  beheerderId: number;
  organisatieScope?: number | null;
  ingetrokkenOp?: number;
}

/**
 * Het antwoord op een roltoekenning. De waarschuwing is gevuld wanneer regel 9
 * van het protocol aanslaat: de handeling gaat door, maar de opmerking staat in
 * het dossier.
 */
export interface RolToekenning {
  rol: TrajectRol;
  waarschuwing: string | null;
}

export interface RolVanPersoon {
  id: number;
  rol: TrajectRolnaam;
  werkstroomId: number | null;
  werkstroomNaam: string | null;
  toegekendOp: number;
}

export interface PersoonInTraject {
  id: number;
  naam: string;
  email: string;
  actief: boolean;
  /** Leeg zolang de persoon meedoet, anders de reden in gewone taal. */
  aanduiding: string | null;
  partijId: number | null;
  partijNaam: string | null;
  partijSoort: string | null;
  /** De kring volgt uit de partij en wordt bij de persoon niet opgeslagen. */
  kring: number | null;
  rollen: RolVanPersoon[];
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

/**
 * Een e-mailadres wordt getrimd en naar kleine letters omgezet, want het is de
 * brug naar de aanmelding en namen zijn niet uniek. Zonder apenstaartje is het
 * geen adres.
 */
function geldigEmailadres(waarde: string): string {
  const opgeschoond = nietLegeTekst(waarde, "E-mailadres").toLowerCase();
  if (!opgeschoond.includes("@")) {
    throw new Error("Het e-mailadres moet een apenstaartje bevatten.");
  }
  return opgeschoond;
}

function isRolnaam(waarde: string): waarde is TrajectRolnaam {
  return (ROLLEN_VAN_TRAJECT as readonly string[]).includes(waarde);
}

const MELDING_ANKERPUNT_EN_FACILITATOR =
  "Wie belang heeft bij de uitkomst kan het gesprek niet onpartijdig leiden: " +
  "een ankerpunt van de investeerder of van de onderneming kan daarom niet " +
  "tegelijk de facilitator van zijn eigen traject zijn. Trek eerst de andere " +
  "rol in wanneer deze persoon werkelijk van plaats verandert.";

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

  function haalPersoonVanTraject(persoonId: number, trajectId: number): TrajectPersoon {
    const persoon = db
      .select()
      .from(trajectPersonen)
      .where(and(eq(trajectPersonen.id, persoonId), eq(trajectPersonen.trajectId, trajectId)))
      .get();
    if (!persoon) throw new Error("Persoon hoort niet bij dit traject.");
    return persoon;
  }

  function haalWerkstroomVanTraject(werkstroomId: number, trajectId: number): TrajectWerkstroom {
    const werkstroom = db
      .select()
      .from(trajectWerkstromen)
      .where(
        and(eq(trajectWerkstromen.id, werkstroomId), eq(trajectWerkstromen.trajectId, trajectId)),
      )
      .get();
    if (!werkstroom) throw new Error("Werkstroom hoort niet bij dit traject.");
    return werkstroom;
  }

  /** De rollen die nu gelden, dus alleen de rijen die niet ingetrokken zijn. */
  function haalGeldigeRolnamenVanPersoon(persoonId: number): string[] {
    return db
      .select({ rol: trajectRollen.rol })
      .from(trajectRollen)
      .where(and(eq(trajectRollen.persoonId, persoonId), isNull(trajectRollen.ingetrokkenOp)))
      .all()
      .map((rij) => rij.rol);
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
      // Een auteur moet een persoon van dit traject zijn. Zonder deze controle
      // zou een gebeurtenis naar een persoon van een ander dossier kunnen
      // wijzen, en dan zou de rechtenmodule op een verkeerde partij rekenen.
      const auteurId =
        invoer.vastgelegdDoorPersoonId === undefined ||
        invoer.vastgelegdDoorPersoonId === null
          ? null
          : haalPersoonVanTraject(invoer.vastgelegdDoorPersoonId, invoer.trajectId).id;
      const gebeurtenis = db
        .insert(trajectGebeurtenissen)
        .values({
          trajectId: invoer.trajectId,
          lijnId: invoer.lijnId,
          tijdstip: invoer.tijdstip,
          soort: invoer.soort,
          vaststelling: nietLegeTekst(invoer.vaststelling, "Vaststelling"),
          indruk: invoer.indruk?.trim() ?? "",
          vastgelegdDoorPersoonId: auteurId,
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

    /**
     * Zet de stand en de eerstvolgende oplevering van een bestaande werkstroom.
     * De werkstromen zelf worden bij het traject aangemaakt, dus deze
     * handeling werkt bij en maakt nooit een nieuwe rij aan.
     */
    werkWerkstroomBij(invoer: WerkWerkstroomBijInvoer): TrajectWerkstroom {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      if (!(STANDEN_VAN_WERKSTROOM as readonly string[]).includes(invoer.status)) {
        throw new Error("De stand van de werkstroom is ongeldig.");
      }
      const naam = nietLegeTekst(invoer.naam, "Naam werkstroom");
      const bestaand = db
        .select()
        .from(trajectWerkstromen)
        .where(
          and(
            eq(trajectWerkstromen.trajectId, invoer.trajectId),
            eq(trajectWerkstromen.naam, naam),
          ),
        )
        .get();
      if (!bestaand) throw new Error("Werkstroom hoort niet bij dit traject.");

      const oplevering = invoer.eerstvolgendeOplevering?.trim() ?? null;
      const opleveringOp = invoer.eerstvolgendeOpleveringOp?.trim() ?? null;
      if ((oplevering === null) !== (opleveringOp === null)) {
        throw new Error(
          "Een oplevering heeft zowel een omschrijving als een moment nodig.",
        );
      }
      if (opleveringOp !== null && Number.isNaN(Date.parse(opleveringOp))) {
        throw new Error("Het moment van de oplevering is ongeldig.");
      }

      const werkstroom = db
        .update(trajectWerkstromen)
        .set({
          status: invoer.status,
          eerstvolgendeOplevering: oplevering,
          eerstvolgendeOpleveringOp: opleveringOp,
        })
        .where(eq(trajectWerkstromen.id, bestaand.id))
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_werkstroom_bijgewerkt",
        invoer.trajectId,
        `Werkstroom ${werkstroom.id} op stand ${werkstroom.status} gezet.`,
      );
      return werkstroom;
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

    /**
     * Legt een mens in het dossier vast. De kring komt niet mee: die volgt uit
     * de partij waar deze persoon bij hoort.
     */
    voegPersoonToe(invoer: VoegPersoonToeInvoer): TrajectPersoon {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      const naam = nietLegeTekst(invoer.naam, "Naam");
      const email = geldigEmailadres(invoer.email);
      const partijId = invoer.partijId ?? null;
      if (partijId !== null) {
        haalPartijVanTraject(partijId, invoer.trajectId);
      }

      let persoon: TrajectPersoon;
      try {
        persoon = db
          .insert(trajectPersonen)
          .values({
            trajectId: invoer.trajectId,
            partijId,
            naam,
            email,
            beheerderId: invoer.persoonBeheerderId ?? null,
            deelnemerId: invoer.persoonDeelnemerId ?? null,
            actief: 1,
            aangemaaktOp: tijdstipOfNu(invoer.aangemaaktOp, "Aanmaakmoment"),
          })
          .returning()
          .get();
      } catch (fout) {
        if (String((fout as Error).message).includes("uq_traject_personen_email")) {
          throw new Error("Dit e-mailadres staat al bij een persoon in dit traject.");
        }
        throw fout;
      }

      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_persoon_toegevoegd",
        invoer.trajectId,
        `Persoon ${persoon.id} toegevoegd.`,
      );
      return persoon;
    },

    /**
     * Zet iemand op inactief. Er verdwijnt niets, want de geschiedenis van deze
     * persoon blijft nodig.
     */
    zetPersoonInactief(invoer: ZetPersoonInactiefInvoer): TrajectPersoon {
      geheelGetalBinnenBereik(invoer.persoonId, 1, Number.MAX_SAFE_INTEGER, "Persoon");
      const persoon = db
        .select()
        .from(trajectPersonen)
        .where(eq(trajectPersonen.id, invoer.persoonId))
        .get();
      if (!persoon) throw new Error("Persoon niet gevonden.");
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        persoon.trajectId,
        invoer.organisatieScope,
      );

      const bijgewerkt = db
        .update(trajectPersonen)
        .set({ actief: 0 })
        .where(eq(trajectPersonen.id, persoon.id))
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_persoon_inactief_gezet",
        persoon.trajectId,
        `Persoon ${persoon.id} op inactief gezet.`,
      );
      return bijgewerkt;
    },

    /**
     * Kent een rol toe. De databank bewaakt de zeven namen, de werkstroomregel
     * en de uniciteit; hier staat regel 8 van het protocol, die twee rijen die
     * elkaar uitsluiten bewaakt, en regel 9, die waarschuwt zonder te blokkeren.
     */
    kenRolToe(invoer: KenRolToeInvoer): RolToekenning {
      controleerBeheerderVoorTraject(
        invoer.beheerderId,
        invoer.trajectId,
        invoer.organisatieScope,
      );
      if (!isRolnaam(invoer.rol)) {
        throw new Error(
          `De rol ${String(invoer.rol)} bestaat niet. Toegestaan zijn: ${ROLLEN_VAN_TRAJECT.join(", ")}.`,
        );
      }
      const persoon = haalPersoonVanTraject(invoer.persoonId, invoer.trajectId);
      const werkstroomId = invoer.werkstroomId ?? null;
      if (invoer.rol === "werkstroomleider") {
        if (werkstroomId === null) {
          throw new Error("Een werkstroomleider heeft een werkstroom nodig.");
        }
        haalWerkstroomVanTraject(werkstroomId, invoer.trajectId);
      } else if (werkstroomId !== null) {
        throw new Error("Alleen de rol werkstroomleider hoort bij een werkstroom.");
      }

      const geldigeRollen = haalGeldigeRolnamenVanPersoon(persoon.id);
      const isAnkerpunt =
        invoer.rol === "ankerpunt_investeerder" || invoer.rol === "ankerpunt_onderneming";
      const heeftAnkerpunt =
        geldigeRollen.includes("ankerpunt_investeerder") ||
        geldigeRollen.includes("ankerpunt_onderneming");
      const heeftFacilitator = geldigeRollen.includes("facilitator");
      if (
        (invoer.rol === "facilitator" && heeftAnkerpunt) ||
        (isAnkerpunt && heeftFacilitator)
      ) {
        throw new Error(MELDING_ANKERPUNT_EN_FACILITATOR);
      }

      const rol = db
        .insert(trajectRollen)
        .values({
          trajectId: invoer.trajectId,
          persoonId: persoon.id,
          rol: invoer.rol,
          werkstroomId,
          toegekendDoorBeheerderId: invoer.beheerderId,
          toegekendOp: tijdstipOfNu(invoer.toegekendOp, "Toekenmoment"),
          ingetrokkenOp: null,
          ingetrokkenDoorBeheerderId: null,
        })
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_rol_toegekend",
        invoer.trajectId,
        `Persoon ${persoon.id} draagt vanaf nu de rol ${rol.rol}.`,
      );

      let waarschuwing: string | null = null;
      if (invoer.rol === "facilitator" && persoon.partijId !== null) {
        const partij = haalPartijVanTraject(persoon.partijId, invoer.trajectId);
        if ((SOORTEN_MET_BELANG as readonly string[]).includes(partij.soort)) {
          waarschuwing =
            `${persoon.naam} hoort bij ${partij.naam}, een partij van de soort ` +
            `${partij.soort} die belang heeft bij de uitkomst van dit traject. ` +
            "Het protocol vraagt een facilitator zonder belang bij de uitkomst. " +
            "De rol is toegekend, maar deze opmerking blijft in het dossier staan.";
          schrijfTrajectAudit(
            invoer.beheerderId,
            "traject_rol_belangwaarschuwing",
            invoer.trajectId,
            waarschuwing,
          );
        }
      }

      return { rol, waarschuwing };
    },

    /**
     * Beeindigt een rol door het intrekken vast te leggen. De rij blijft staan,
     * zodat achteraf te bewijzen valt wie wanneer welke rol droeg.
     */
    trekRolIn(invoer: TrekRolInInvoer): TrajectRol {
      geheelGetalBinnenBereik(invoer.rolId, 1, Number.MAX_SAFE_INTEGER, "Rol");
      const rol = db.select().from(trajectRollen).where(eq(trajectRollen.id, invoer.rolId)).get();
      if (!rol) throw new Error("Rol niet gevonden.");
      controleerBeheerderVoorTraject(invoer.beheerderId, rol.trajectId, invoer.organisatieScope);
      if (rol.ingetrokkenOp !== null) {
        throw new Error("Deze rol is al ingetrokken.");
      }

      const ingetrokken = db
        .update(trajectRollen)
        .set({
          ingetrokkenOp: tijdstipOfNu(invoer.ingetrokkenOp, "Intrekmoment"),
          ingetrokkenDoorBeheerderId: invoer.beheerderId,
        })
        .where(eq(trajectRollen.id, rol.id))
        .returning()
        .get();
      schrijfTrajectAudit(
        invoer.beheerderId,
        "traject_rol_ingetrokken",
        rol.trajectId,
        `De rol ${rol.rol} van persoon ${rol.persoonId} is ingetrokken.`,
      );
      return ingetrokken;
    },

    /**
     * Geeft per persoon de naam, het adres, de partij, de kring die uit die
     * partij volgt en de rollen die nu gelden. Wie inactief is blijft in de
     * lijst staan, met een aanduiding in gewone taal.
     */
    haalPersonenVanTraject(
      trajectId: number,
      beheerderId: number,
      organisatieScope?: number | null,
    ): PersoonInTraject[] {
      controleerBeheerderVoorTraject(beheerderId, trajectId, organisatieScope);
      const rijen = db
        .select({
          id: trajectPersonen.id,
          naam: trajectPersonen.naam,
          email: trajectPersonen.email,
          actief: trajectPersonen.actief,
          partijId: trajectPersonen.partijId,
          partijNaam: trajectPartijen.naam,
          partijSoort: trajectPartijen.soort,
          kring: trajectPartijen.kring,
        })
        .from(trajectPersonen)
        .leftJoin(trajectPartijen, eq(trajectPersonen.partijId, trajectPartijen.id))
        .where(eq(trajectPersonen.trajectId, trajectId))
        .orderBy(asc(trajectPersonen.id))
        .all();

      const rolrijen = db
        .select({
          id: trajectRollen.id,
          persoonId: trajectRollen.persoonId,
          rol: trajectRollen.rol,
          werkstroomId: trajectRollen.werkstroomId,
          werkstroomNaam: trajectWerkstromen.naam,
          toegekendOp: trajectRollen.toegekendOp,
        })
        .from(trajectRollen)
        .leftJoin(trajectWerkstromen, eq(trajectRollen.werkstroomId, trajectWerkstromen.id))
        .where(and(eq(trajectRollen.trajectId, trajectId), isNull(trajectRollen.ingetrokkenOp)))
        .orderBy(asc(trajectRollen.id))
        .all();

      return rijen.map((rij) => ({
        id: rij.id,
        naam: rij.naam,
        email: rij.email,
        actief: rij.actief === 1,
        aanduiding:
          rij.actief === 1 ? null : "Deze persoon doet niet meer mee in dit traject.",
        partijId: rij.partijId,
        partijNaam: rij.partijNaam ?? null,
        partijSoort: rij.partijSoort ?? null,
        kring: rij.kring ?? null,
        rollen: rolrijen
          .filter((rolrij) => rolrij.persoonId === rij.id)
          .map((rolrij) => ({
            id: rolrij.id,
            rol: rolrij.rol as TrajectRolnaam,
            werkstroomId: rolrij.werkstroomId,
            werkstroomNaam: rolrij.werkstroomNaam ?? null,
            toegekendOp: rolrij.toegekendOp,
          })),
      }));
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
