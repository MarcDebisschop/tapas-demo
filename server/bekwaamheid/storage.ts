/**
 * De opslaglaag van de module Bekwaamheid.
 *
 * Wat hier wél in zit en wat nog niet. Dit bestand dekt het werk van blok 1: het
 * register, de licenties, het tellen van praktijk en oefening, het tussentijdse
 * controlemoment, het coachingsplan en de agenda. De rondes, de itembank, de
 * rubriekinvoer en de beslissingen hebben in `schema.ts` al hun tabel, maar hun
 * opslagfuncties horen bij blok 3 en 4 en staan hier nog niet. Dat is met opzet:
 * een opslagfunctie zonder route en zonder test is dode code die de volgende
 * lezer laat denken dat er iets werkt.
 *
 * Waarom een eigen verbinding en niet die van `server/storage.ts`. Hetzelfde
 * patroon als `server/traject/storage.ts`: het pad komt uit `db-pad.ts`, de
 * versleuteling uit `db-encryptie.ts`, en de module opent haar eigen verbinding
 * met dezelfde pragma's. Zo hangt deze module niet aan de levensduur van het
 * grote opslagbestand.
 *
 * Rekenwerk staat niet in dit bestand. `cyclus.ts` doet de datums,
 * `tussentijdse-toets.ts` doet de signalen, `rechten.ts` doet de poort. Deze
 * laag leest en schrijft, en roept die drie aan. Elke uitzondering daarop zou
 * betekenen dat een regel op twee plaatsen staat.
 */

import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { pasEncryptieToe } from "../db-encryptie";
import { vindDatabasePad } from "../db-pad";
import { schrijfAuditLog } from "../audit-log";
import {
  valideerNormprofiel,
  type Normprofiel,
  type Weging,
  type DrempelPerAs,
} from "./normprofiel";
import type { AuditInvoer } from "../audit-log";
import {
  COACHINGSPLAN_EVALUATIE_MAANDEN,
  berekenCyclus,
  telMaandenOp,
  vensterTot,
} from "./cyclus";
import { TUSSENTIJDS_VENSTER_MAANDEN } from "./cyclus";
import {
  bepaalUitkomst,
  berekenTussentijdseToets,
  vraagtCoachingsplan,
} from "./tussentijdse-toets";
import type { Signaal, ToetsBerekening } from "./tussentijdse-toets";
import type {
  Agendasoort,
  Coachingsplanuitkomst,
  Kennischeckblok,
  Licentiestatus,
  Toetsuitkomst,
} from "./schema";
import { BLOKNAMEN } from "./schema";
import { magOvergang, valideerItem, blokdekking } from "./itembank";
import type { Itemgebruik } from "./schema";
import {
  keurKennischeckNa,
  stelKennischeckSamen,
  volledigPlan,
  type Nakijkresultaat,
} from "./kennischeck";

export type AuditSchrijver = (invoer: AuditInvoer) => void;

/**
 * Brengt een oefenscore naar de schaal 0 tot 100.
 *
 * Zie de uitleg bij `leesOefenaggregaat`: de kolom bevat breuken én percentages.
 * Negatieve waarden komen in geen van beide schrijfwegen voor en worden
 * ongemoeid doorgegeven — stil corrigeren zou een gegevensfout onzichtbaar maken.
 */
export function naarHonderdschaal(waarde: number): number {
  return waarde > 0 && waarde <= 1 ? waarde * 100 : waarde;
}

// ---------------------------------------------------------------------------
// Rijvormen zoals ze uit SQLite komen
// ---------------------------------------------------------------------------

interface GeaccrediteerdeRij {
  id: number;
  beheerder_id: number | null;
  coach_register_id: number | null;
  naam: string;
  email: string | null;
  landcode: string;
  taal: string;
  is_trainer: number;
  actief: number;
  created_at: string;
  updated_at: string;
}

export interface GeaccrediteerdeRecord {
  id: number;
  beheerderId: number | null;
  coachRegisterId: number | null;
  naam: string;
  email: string | null;
  landcode: string;
  taal: string;
  isTrainer: boolean;
  actief: boolean;
  createdAt: string;
  updatedAt: string;
}

function naarGeaccrediteerde(rij: GeaccrediteerdeRij): GeaccrediteerdeRecord {
  return {
    id: rij.id,
    beheerderId: rij.beheerder_id,
    coachRegisterId: rij.coach_register_id,
    naam: rij.naam,
    email: rij.email,
    landcode: rij.landcode,
    taal: rij.taal,
    isTrainer: rij.is_trainer === 1,
    actief: rij.actief === 1,
    createdAt: rij.created_at,
    updatedAt: rij.updated_at,
  };
}

interface LicentieRij {
  id: number;
  geaccrediteerde_id: number;
  instrument_id: string;
  status: string;
  geldig_van: string;
  geldig_tot: string | null;
  laatste_bekrachtiging: string | null;
  volgende_bekrachtiging: string | null;
  volgende_tussentijdse_toets: string | null;
  alert_actief: number;
  voorwaarde_tekst: string | null;
  voorwaarde_voor: string | null;
  bron_beslissing_id: number | null;
  updated_at: string;
}

export interface LicentieRecord {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  status: Licentiestatus;
  geldigVan: string;
  geldigTot: string | null;
  laatsteBekrachtiging: string | null;
  volgendeBekrachtiging: string | null;
  volgendeTussentijdseToets: string | null;
  alertActief: boolean;
  voorwaardeTekst: string | null;
  voorwaardeVoor: string | null;
  bronBeslissingId: number | null;
  updatedAt: string;
}

function naarLicentie(rij: LicentieRij): LicentieRecord {
  return {
    id: rij.id,
    geaccrediteerdeId: rij.geaccrediteerde_id,
    instrumentId: rij.instrument_id,
    status: rij.status as Licentiestatus,
    geldigVan: rij.geldig_van,
    geldigTot: rij.geldig_tot,
    laatsteBekrachtiging: rij.laatste_bekrachtiging,
    volgendeBekrachtiging: rij.volgende_bekrachtiging,
    volgendeTussentijdseToets: rij.volgende_tussentijdse_toets,
    alertActief: rij.alert_actief === 1,
    voorwaardeTekst: rij.voorwaarde_tekst,
    voorwaardeVoor: rij.voorwaarde_voor,
    bronBeslissingId: rij.bron_beslissing_id,
    updatedAt: rij.updated_at,
  };
}

export interface ToetsRecord extends Omit<ToetsBerekening, "uitkomst"> {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  licentieId: number;
  /**
   * Leeg tot een mens de toets vaststelt. De berekening staat in
   * `berekendeUitkomst` en blijft daar ook na een afwijking staan.
   */
  uitkomst: Toetsuitkomst | null;
  berekendeUitkomst: Toetsuitkomst;
  vastgesteldDoor: number | null;
  vastgesteldOp: string | null;
  besprokenOp: string | null;
  gepubliceerdOp: string | null;
  coachingsplanId: number | null;
}

// ---------------------------------------------------------------------------
// De opslag
// ---------------------------------------------------------------------------

/** Een normprofielrij zoals SQLite hem teruggeeft. */
type NormprofielRij = {
  id: number;
  instrument_id: string;
  versie: number;
  weging: string;
  drempel_totaal: number;
  drempel_per_as: string;
  activiteitsdrempel: number;
  activiteitsvenster_maanden: number;
  methode: string;
  paneel_omschrijving: string | null;
  vastgesteld_op: string;
  vastgesteld_door: string;
  bevroren_op: string | null;
  onderbouwing: string;
};

/** Een normprofiel met geparseerde JSON-velden. */
export type NormprofielRecord = Normprofiel & {
  id: number;
  instrumentId: string;
  versie: number;
  methode: string;
  paneelOmschrijving: string | null;
  vastgesteldOp: string;
  vastgesteldDoor: string;
  bevrorenOp: string | null;
  onderbouwing: string;
};

interface ItemRij {
  id: number;
  instrument_id: string;
  as: string;
  blok: string | null;
  soort: string;
  stam: string;
  opties: string | null;
  sleutel: string;
  toelichting_goed: string;
  toelichting_fout: string;
  gebruik: string;
  versie: number;
  actief: number;
  p_waarde: number | null;
  discriminatie: number | null;
  bron_verwijzing: string | null;
}

export interface ItemRecord {
  id: number;
  instrumentId: string;
  as: string;
  blok: string | null;
  soort: string;
  stam: string;
  opties: string[] | null;
  sleutel: string;
  toelichtingGoed: string;
  toelichtingFout: string;
  gebruik: Itemgebruik;
  versie: number;
  actief: boolean;
  pWaarde: number | null;
  discriminatie: number | null;
  bronVerwijzing: string | null;
}

interface ItemsetRij {
  id: number;
  ronde_id: number;
  bewijsstuk_nummer: number;
  item_ids: string;
  antwoorden: string | null;
  item_tijden: string | null;
  samengesteld_op: string;
}

export interface ItemsetRecord {
  id: number;
  rondeId: number;
  bewijsstukNummer: number;
  itemIds: number[];
  antwoorden: Record<string, string> | null;
  itemTijden: Record<string, number> | null;
  samengesteldOp: string;
}

/**
 * Zet een itemrij om naar een record.
 *
 * Onleesbare `opties` gooit hier en wordt niet stil op `null` gezet. Een
 * meerkeuze-item zonder mogelijkheden zou anders als item met nul opties door de
 * samensteller glippen en op het scherm van een kandidaat belanden als vraag
 * zonder antwoorden.
 */
function leesItem(rij: ItemRij): ItemRecord {
  let opties: string[] | null = null;
  if (rij.opties !== null) {
    try {
      opties = JSON.parse(rij.opties) as string[];
    } catch (e) {
      throw new Error(
        `Item ${rij.id} heeft onleesbare JSON in opties: ${(e as Error).message}`,
      );
    }
  }
  return {
    id: rij.id,
    instrumentId: rij.instrument_id,
    as: rij.as,
    blok: rij.blok,
    soort: rij.soort,
    stam: rij.stam,
    opties,
    sleutel: rij.sleutel,
    toelichtingGoed: rij.toelichting_goed,
    toelichtingFout: rij.toelichting_fout,
    gebruik: rij.gebruik as Itemgebruik,
    versie: rij.versie,
    actief: rij.actief === 1,
    pWaarde: rij.p_waarde,
    discriminatie: rij.discriminatie,
    bronVerwijzing: rij.bron_verwijzing,
  };
}

/**
 * Zet een itemsetrij om naar een record.
 *
 * `item_ids` gooit bij onleesbare JSON: een itemset waarvan niet vaststaat welke
 * items erin zaten, is geen bewijsstuk meer. `antwoorden` en `item_tijden` gooien
 * ook, om dezelfde reden — een half gelezen antwoordenblok zou een score
 * opleveren over items waarvan de antwoorden zijn weggevallen.
 */
function leesItemset(rij: ItemsetRij): ItemsetRecord {
  let itemIds: number[];
  let antwoorden: Record<string, string> | null = null;
  let itemTijden: Record<string, number> | null = null;
  try {
    itemIds = JSON.parse(rij.item_ids) as number[];
    if (rij.antwoorden !== null) {
      antwoorden = JSON.parse(rij.antwoorden) as Record<string, string>;
    }
    if (rij.item_tijden !== null) {
      itemTijden = JSON.parse(rij.item_tijden) as Record<string, number>;
    }
  } catch (e) {
    throw new Error(
      `Itemset ${rij.id} heeft onleesbare JSON: ${(e as Error).message}`,
    );
  }
  return {
    id: rij.id,
    rondeId: rij.ronde_id,
    bewijsstukNummer: rij.bewijsstuk_nummer,
    itemIds,
    antwoorden,
    itemTijden,
    samengesteldOp: rij.samengesteld_op,
  };
}

/**
 * Zet een rij om naar een record.
 *
 * De JSON-velden worden hier geparseerd en niet bij de aanroeper: zou elke
 * aanroeper zelf parsen, dan zou een enkele vergeten `JSON.parse` een weging als
 * tekenreeks in de berekening laten belanden, waar `"0.2" * 0.3` stilzwijgend
 * een getal oplevert. Onleesbare JSON gooit hier, want een normprofiel waarvan
 * de weging niet te lezen is, mag geen beslissing raken.
 */
function leesNormprofiel(rij: NormprofielRij): NormprofielRecord {
  let weging: Weging;
  let drempelPerAs: DrempelPerAs;
  try {
    weging = JSON.parse(rij.weging) as Weging;
    drempelPerAs = JSON.parse(rij.drempel_per_as) as DrempelPerAs;
  } catch (e) {
    throw new Error(
      `Normprofiel ${rij.instrument_id} versie ${rij.versie} heeft onleesbare ` +
        `JSON in weging of drempelPerAs: ${(e as Error).message}`,
    );
  }
  return {
    id: rij.id,
    instrumentId: rij.instrument_id,
    versie: rij.versie,
    weging,
    drempelTotaal: rij.drempel_totaal,
    drempelPerAs,
    activiteitsdrempel: rij.activiteitsdrempel,
    activiteitsvensterMaanden: rij.activiteitsvenster_maanden,
    methode: rij.methode,
    paneelOmschrijving: rij.paneel_omschrijving,
    vastgesteldOp: rij.vastgesteld_op,
    vastgesteldDoor: rij.vastgesteld_door,
    bevrorenOp: rij.bevroren_op,
    onderbouwing: rij.onderbouwing,
  };
}

export function maakBekwaamheidOpslag(
  db: BetterSqlite3.Database,
  audit: AuditSchrijver = schrijfAuditLog,
) {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);

  // -------------------------------------------------------------------------
  // Het register
  // -------------------------------------------------------------------------

  const register = {
    /**
     * Zet iemand in het register, of werkt de bestaande rij bij.
     *
     * Sleutel is het e-mailadres wanneer dat bekend is, en anders de rij in het
     * coachregister. Nooit de naam: namen komen in meerdere bronnen in
     * verschillende spelling voor, op naam samenvoegen is gokken, en bij een
     * register van wie mag werken is gokken de duurste fout.
     *
     * Het adres mag ontbreken. Van een deel van de geaccrediteerden staat er geen
     * in het coachregister, en een adres verzinnen om een kolomeis te halen is
     * precies hoe er negentien niet-bestaande adressen in de broncode terecht zijn
     * gekomen. Wie geen adres heeft, wordt niet aangeschreven; dat is een
     * zichtbaar tekort in het register, geen stille aanname.
     *
     * `doorBeheerderId` gaat naar het logboek. Het eenmalige migratiescript laat
     * dit veld leeg; dan staat er in het logboek dat de wijziging niet van een
     * aangemelde beheerder kwam, en dat is wat er feitelijk gebeurde.
     *
     * `id` is er alleen voor het eenmalige migratiescript, dat de bestaande
     * monitor-ids 1001 en verder moet behouden omdat `kwaliteit_normen`,
     * overrides en verstuurde alerteringen daaraan vasthangen. Bij normaal
     * gebruik blijft dit veld leeg en deelt SQLite het nummer uit.
     */
    zetNeer(invoer: {
      naam: string;
      email?: string | null;
      beheerderId?: number | null;
      coachRegisterId?: number | null;
      landcode?: string;
      taal?: string;
      isTrainer?: boolean;
      actief?: boolean;
      id?: number;
      doorBeheerderId?: number | null;
    }): GeaccrediteerdeRecord {
      const email = invoer.email?.trim().toLowerCase() || null;
      if (email === null && invoer.beheerderId == null && invoer.coachRegisterId == null) {
        throw new Error(
          "Zonder e-mailadres, beheerder of rij in het coachregister is iemand niet " +
            "identificeerbaar en hoort hij niet in het register.",
        );
      }
      /**
       * De drie sleutels worden op volgorde geprobeerd, niet als keuze tussen één
       * ervan. Wie eerst zonder adres is opgenomen en later een adres krijgt,
       * wordt anders een tweede keer ingeschreven — of, met de unieke index op de
       * coachregisterkoppeling, helemaal geweigerd.
       */
      const zoek = (kolom: string, waarde: unknown): GeaccrediteerdeRij | undefined =>
        waarde == null
          ? undefined
          : (db
              .prepare(`SELECT * FROM bekwaamheid_geaccrediteerden WHERE ${kolom} = ?`)
              .get(waarde) as GeaccrediteerdeRij | undefined);

      const bestaand =
        zoek("email", email) ??
        zoek("coach_register_id", invoer.coachRegisterId) ??
        zoek("beheerder_id", invoer.beheerderId);

      if (bestaand) {
        db.prepare(
          `UPDATE bekwaamheid_geaccrediteerden SET
             naam = ?, beheerder_id = COALESCE(?, beheerder_id),
             coach_register_id = COALESCE(?, coach_register_id),
             email = COALESCE(?, email),
             landcode = ?, taal = ?, is_trainer = ?, actief = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          invoer.naam,
          invoer.beheerderId ?? null,
          invoer.coachRegisterId ?? null,
          // Een adres kan er later bij komen, maar nooit stil verdwijnen.
          email,
          invoer.landcode ?? bestaand.landcode,
          invoer.taal ?? bestaand.taal,
          invoer.isTrainer === undefined ? bestaand.is_trainer : invoer.isTrainer ? 1 : 0,
          invoer.actief === undefined ? bestaand.actief : invoer.actief ? 1 : 0,
          nu(),
          bestaand.id,
        );
        audit({
          adminId: invoer.doorBeheerderId ?? null,
          actie: "bekwaamheid_register_gewijzigd",
          afnameId: null,
          detail: `Geaccrediteerde ${bestaand.id} bijgewerkt (${invoer.naam}).`,
        });
        return register.vindOp(bestaand.id)!;
      }

      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_geaccrediteerden
             (id, beheerder_id, coach_register_id, naam, email, landcode, taal, is_trainer, actief, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          invoer.id ?? null,
          invoer.beheerderId ?? null,
          invoer.coachRegisterId ?? null,
          invoer.naam,
          email,
          invoer.landcode ?? "BE",
          invoer.taal ?? "nl",
          invoer.isTrainer ? 1 : 0,
          invoer.actief === false ? 0 : 1,
          nu(),
          nu(),
        );
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_register_gewijzigd",
        afnameId: null,
        detail: `Geaccrediteerde ${res.lastInsertRowid} opgenomen in het register (${invoer.naam}).`,
      });
      return register.vindOp(res.lastInsertRowid as number)!;
    },

    vindOp(id: number): GeaccrediteerdeRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_geaccrediteerden WHERE id = ?")
        .get(id) as GeaccrediteerdeRij | undefined;
      return rij ? naarGeaccrediteerde(rij) : undefined;
    },

    vindOpEmail(email: string): GeaccrediteerdeRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_geaccrediteerden WHERE email = ?")
        .get(email.trim().toLowerCase()) as GeaccrediteerdeRij | undefined;
      return rij ? naarGeaccrediteerde(rij) : undefined;
    },

    vindOpBeheerder(beheerderId: number): GeaccrediteerdeRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_geaccrediteerden WHERE beheerder_id = ?")
        .get(beheerderId) as GeaccrediteerdeRij | undefined;
      return rij ? naarGeaccrediteerde(rij) : undefined;
    },

    /** Alle actieve geaccrediteerden, op naam. */
    lijst(alleen_actief = true): GeaccrediteerdeRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_geaccrediteerden
           ${alleen_actief ? "WHERE actief = 1" : ""}
           ORDER BY naam COLLATE NOCASE`,
        )
        .all() as GeaccrediteerdeRij[];
      return rijen.map(naarGeaccrediteerde);
    },

    /**
     * Zet iemand op inactief. Er is geen verwijderfunctie: een register waaruit
     * gewist kan worden, kan achteraf niet meer aantonen wie er ooit in stond.
     */
    zetInactief(id: number, doorBeheerderId: number | null, reden: string): void {
      db.prepare(
        "UPDATE bekwaamheid_geaccrediteerden SET actief = 0, updated_at = ? WHERE id = ?",
      ).run(nu(), id);
      audit({
        adminId: doorBeheerderId,
        actie: "bekwaamheid_register_gewijzigd",
        afnameId: null,
        detail: `Geaccrediteerde ${id} op inactief gezet: ${reden}`,
      });
    },
  };

  // -------------------------------------------------------------------------
  // De licenties
  // -------------------------------------------------------------------------

  const licenties = {
    /**
     * Legt een licentie neer op de overgangsperiode.
     *
     * Dit is de vorm waarin elke bestaande geaccrediteerde het systeem binnenkomt:
     * status `overgangsperiode`, geen einddatum, geen agendadatum. Op dat moment
     * verandert er voor niemand iets — dat is de technische vorm van de belofte
     * dat je vandaag niets verliest.
     */
    zetOvergangsperiode(invoer: {
      geaccrediteerdeId: number;
      instrumentId: string;
      geldigVan?: string;
    }): LicentieRecord {
      const bestaand = licenties.vind(invoer.geaccrediteerdeId, invoer.instrumentId);
      if (bestaand) return bestaand;
      db.prepare(
        `INSERT INTO bekwaamheid_licenties
           (geaccrediteerde_id, instrument_id, status, geldig_van, geldig_tot, alert_actief, updated_at)
         VALUES (?, ?, 'overgangsperiode', ?, NULL, 0, ?)`,
      ).run(invoer.geaccrediteerdeId, invoer.instrumentId, invoer.geldigVan ?? vandaag(), nu());
      return licenties.vind(invoer.geaccrediteerdeId, invoer.instrumentId)!;
    },

    vind(geaccrediteerdeId: number, instrumentId: string): LicentieRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_licenties
           WHERE geaccrediteerde_id = ? AND instrument_id = ?`,
        )
        .get(geaccrediteerdeId, instrumentId) as LicentieRij | undefined;
      return rij ? naarLicentie(rij) : undefined;
    },

    vindOp(id: number): LicentieRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_licenties WHERE id = ?")
        .get(id) as LicentieRij | undefined;
      return rij ? naarLicentie(rij) : undefined;
    },

    vanPersoon(geaccrediteerdeId: number): LicentieRecord[] {
      const rijen = db
        .prepare(
          "SELECT * FROM bekwaamheid_licenties WHERE geaccrediteerde_id = ? ORDER BY instrument_id",
        )
        .all(geaccrediteerdeId) as LicentieRij[];
      return rijen.map(naarLicentie);
    },

    /**
     * Zet de twee agendadata die uit één bekrachtiging volgen.
     *
     * Beide tegelijk, en bij de bekrachtiging zelf: `volgendeBekrachtiging` op
     * vierentwintig maanden, `volgendeTussentijdseToets` op twaalf. Een termijn
     * die pas berekend wordt wanneer iemand eraan denkt, is de termijn die
     * vergeten wordt.
     */
    naBekrachtiging(invoer: {
      licentieId: number;
      status: Licentiestatus;
      bekrachtigdOp: string;
      bronBeslissingId?: number | null;
      voorwaardeTekst?: string | null;
      voorwaardeVoor?: string | null;
    }): LicentieRecord {
      const cyclus = berekenCyclus(invoer.bekrachtigdOp);
      db.prepare(
        `UPDATE bekwaamheid_licenties SET
           status = ?, geldig_van = ?, geldig_tot = ?,
           laatste_bekrachtiging = ?, volgende_bekrachtiging = ?,
           volgende_tussentijdse_toets = ?,
           voorwaarde_tekst = ?, voorwaarde_voor = ?,
           bron_beslissing_id = COALESCE(?, bron_beslissing_id),
           updated_at = ?
         WHERE id = ?`,
      ).run(
        invoer.status,
        cyclus.bekrachtigdOp,
        cyclus.geldigTot,
        cyclus.bekrachtigdOp,
        cyclus.geldigTot,
        cyclus.tussentijdseToets,
        invoer.voorwaardeTekst ?? null,
        invoer.voorwaardeVoor ?? null,
        invoer.bronBeslissingId ?? null,
        nu(),
        invoer.licentieId,
      );
      agenda.zetNeer({
        licentieId: invoer.licentieId,
        soort: "bekrachtiging_verwacht",
        datum: cyclus.geldigTot,
      });
      agenda.zetNeer({
        licentieId: invoer.licentieId,
        soort: "tussentijdse_toets_verwacht",
        datum: cyclus.tussentijdseToets,
      });
      return licenties.vindOp(invoer.licentieId)!;
    },

    /**
     * Zet of haalt de alertvlag.
     *
     * Deze functie raakt `status` niet en kan dat ook niet: de kolom staat niet in
     * de UPDATE. Een alert uit een tussentijdse toets sluit de poort nooit, en de
     * enige manier om dat hard te maken is door de statuskolom hier buiten bereik
     * te houden.
     */
    zetAlert(
      licentieId: number,
      actief: boolean,
      doorBeheerderId: number | null = null,
    ): LicentieRecord {
      db.prepare(
        "UPDATE bekwaamheid_licenties SET alert_actief = ?, updated_at = ? WHERE id = ?",
      ).run(actief ? 1 : 0, nu(), licentieId);
      // Een vlag die iemands dossier raakt en geen spoor achterlaat, is achteraf
      // niet te verantwoorden tegenover de persoon over wie hij gaat.
      audit({
        adminId: doorBeheerderId,
        actie: "bekwaamheid_licentie_gewijzigd",
        afnameId: null,
        detail: `Licentie ${licentieId}: alert ${actief ? "aan" : "uit"}.`,
      });
      return licenties.vindOp(licentieId)!;
    },

    /** Licenties waarvan het tussentijdse moment op of voor de peildatum valt. */
    toetsenDieVervallen(peildatum: string): LicentieRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_licenties
           WHERE volgende_tussentijdse_toets IS NOT NULL
             AND volgende_tussentijdse_toets <= ?
           ORDER BY volgende_tussentijdse_toets`,
        )
        .all(peildatum.slice(0, 10)) as LicentieRij[];
      return rijen.map(naarLicentie);
    },
  };

  // -------------------------------------------------------------------------
  // Tellen: praktijk en oefening
  // -------------------------------------------------------------------------

  const tellers = {
    /**
     * Telt echte afnames over een venster.
     *
     * Dit is de teller die de bestaande kwaliteitsmonitor miste. Die telde
     * afgeronde oefensessies uit `stm_sessies` en noemde het resultaat
     * `afnames_count`. Gevolg: wie tien keer de oefenmodule opende, stond op
     * "norm gehaald", en wie veertig echte afnames deed zonder ooit te oefenen,
     * kreeg drie alerteringsmails.
     *
     * Geteld wordt op `aangemaakt_door_beheerder_id` — wie de afname aanmaakte —
     * en niet op `organisatie_id`, want dat laatste is wie het credit droeg. Een
     * prior die een afname aanmaakt op de credits van een klant, heeft die afname
     * wel gedaan.
     *
     * Alleen voltooide afnames tellen. Een uitgestuurde uitnodiging waar niemand
     * op reageerde, is geen praktijkervaring.
     */
    telAfnames(invoer: {
      beheerderId: number;
      van: string;
      tot: string;
      instrumentId?: string | null;
    }): number {
      const rij = db
        .prepare(
          `SELECT COUNT(*) AS n FROM afnames
           WHERE aangemaakt_door_beheerder_id = ?
             AND status = 'voltooid'
             AND completed_at IS NOT NULL
             AND substr(completed_at, 1, 10) >= ?
             AND substr(completed_at, 1, 10) <= ?
             AND (? IS NULL OR instrument_id = ?)`,
        )
        .get(
          invoer.beheerderId,
          invoer.van.slice(0, 10),
          invoer.tot.slice(0, 10),
          invoer.instrumentId ?? null,
          invoer.instrumentId ?? null,
        ) as { n: number };
      return rij.n;
    },

    /**
     * De datum van de laatste voltooide afname, of leeg wanneer er geen is.
     *
     * Hoort bij dezelfde reparatie als `telAfnames`: het dashboard toonde onder
     * "laatste activiteit" de nieuwste afgeronde oefensessie. Dat is de laatste
     * keer dat iemand de quiz deed, niet de laatste keer dat hij met een coachee
     * werkte.
     */
    laatsteAfname(beheerderId: number): string | null {
      const rij = db
        .prepare(
          `SELECT completed_at FROM afnames
           WHERE aangemaakt_door_beheerder_id = ?
             AND status = 'voltooid'
             AND completed_at IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1`,
        )
        .get(beheerderId) as { completed_at: string } | undefined;
      return rij?.completed_at ?? null;
    },

    /**
     * Leest het aggregaat van de oefensessies over een venster.
     *
     * Uitsluitend aggregaat: het aantal afgeronde sessies, het gemiddelde en het
     * gemiddelde per laag. Nooit een individueel antwoord, nooit itemniveau. Het
     * gemiddelde is leeg wanneer er geen afgeronde sessies zijn — nul zou daar een
     * score suggereren die niemand heeft gehaald.
     *
     * Waarom hier omgerekend wordt. `stm_sessies.score_totaal` bevat twee schalen
     * naast elkaar, en dat is nagegaan en niet vermoed:
     *
     *   - `POST /api/stm/afronden` (`server/routes-stm.ts:648`) schrijft
     *     `totaalCorrect / totaalVragen`, dus een breuk tussen 0 en 1.
     *   - `seedDemoKwaliteit()` (`server/kwaliteit-storage.ts:363`) schrijft
     *     `62 + rnd() * 36`, dus een percentage tussen 62 en 98.
     *
     * Ook `scores_per_laag` loopt uit elkaar: de echte weg schrijft sleutels
     * `laag1`..`laag4` met breuken, de demo-seed sleutels `"1"`..`"4"` met
     * percentages. Wie deze kolom leest zonder dat te weten, vergelijkt appels
     * met peren en krijgt in de demo andere signalen dan in productie.
     *
     * De keuze: één schaal binnen deze module, 0 tot 100, en de omrekening op één
     * plaats. Een waarde van 1 of lager wordt als breuk gelezen en maal honderd
     * gedaan. Dat is eenduidig behalve bij precies 1,0 — een foutloze echte sessie
     * en een percentage van 1 zijn dan niet te onderscheiden. Een echte sessie van
     * 1,0 wordt correct 100; een demo-sessie van 1 procent bestaat niet, want de
     * seed begint bij 62. De grens ligt dus buiten het gebied waar hij pijn doet.
     *
     * Dit is een leesomrekening en geen reparatie. De kolom zelf blijft ongemoeid:
     * ze wordt door de bestaande oefenmodule en het bestaande dashboard gebruikt,
     * en die vallen buiten wat dit blok mag aanraken. De schaal gelijkschakelen bij
     * de bron is werk voor een eigen blok met een eigen migratie.
     */
    leesOefenaggregaat(invoer: { beheerderId: number; van: string; tot: string }): {
      sessies: number;
      gemiddelde: number | null;
      perLaag: Record<string, number> | null;
    } {
      const rijen = db
        .prepare(
          `SELECT score_totaal, scores_per_laag FROM stm_sessies
           WHERE beheerder_id = ?
             AND afgerond_at IS NOT NULL
             AND substr(afgerond_at, 1, 10) >= ?
             AND substr(afgerond_at, 1, 10) <= ?`,
        )
        .all(invoer.beheerderId, invoer.van.slice(0, 10), invoer.tot.slice(0, 10)) as {
        score_totaal: number | null;
        scores_per_laag: string | null;
      }[];

      if (rijen.length === 0) return { sessies: 0, gemiddelde: null, perLaag: null };

      const scores = rijen
        .map((r) => r.score_totaal)
        .filter((s): s is number => typeof s === "number")
        .map(naarHonderdschaal);
      const gemiddelde =
        scores.length === 0
          ? null
          : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

      const sommen: Record<string, { som: number; n: number }> = {};
      for (const rij of rijen) {
        if (!rij.scores_per_laag) continue;
        let ontleed: Record<string, unknown>;
        try {
          ontleed = JSON.parse(rij.scores_per_laag) as Record<string, unknown>;
        } catch {
          continue; // Een onleesbare rij mag de telling niet laten vallen.
        }
        for (const [laag, waarde] of Object.entries(ontleed)) {
          if (typeof waarde !== "number") continue;
          // De twee schrijfwegen gebruiken verschillende sleutels: `laag1` tegen
          // `"1"`. Beide worden onder dezelfde naam samengebracht, anders staat
          // dezelfde laag twee keer in het aggregaat.
          const sleutel = /^\d+$/.test(laag) ? `laag${laag}` : laag;
          sommen[sleutel] ??= { som: 0, n: 0 };
          sommen[sleutel].som += naarHonderdschaal(waarde);
          sommen[sleutel].n += 1;
        }
      }
      const perLaag = Object.keys(sommen).length
        ? Object.fromEntries(
            Object.entries(sommen).map(([laag, { som, n }]) => [
              laag,
              Math.round((som / n) * 10) / 10,
            ]),
          )
        : null;

      return { sessies: rijen.length, gemiddelde, perLaag };
    },
  };

  // -------------------------------------------------------------------------
  // De agenda
  // -------------------------------------------------------------------------

  const agenda = {
    /** Legt een agendapost neer; dubbele posten worden stil overgeslagen. */
    zetNeer(invoer: {
      licentieId?: number;
      geaccrediteerdeId?: number;
      instrumentId?: string;
      soort: Agendasoort;
      datum: string;
    }): void {
      let geaccrediteerdeId = invoer.geaccrediteerdeId;
      let instrumentId = invoer.instrumentId;
      if (invoer.licentieId !== undefined) {
        const licentie = licenties.vindOp(invoer.licentieId);
        if (!licentie) throw new Error(`Licentie ${invoer.licentieId} bestaat niet.`);
        geaccrediteerdeId = licentie.geaccrediteerdeId;
        instrumentId = licentie.instrumentId;
      }
      if (geaccrediteerdeId === undefined || instrumentId === undefined) {
        throw new Error("Een agendapost heeft een geaccrediteerde en een instrument nodig.");
      }
      db.prepare(
        `INSERT OR IGNORE INTO bekwaamheid_agenda
           (geaccrediteerde_id, instrument_id, soort, datum)
         VALUES (?, ?, ?, ?)`,
      ).run(geaccrediteerdeId, instrumentId, invoer.soort, invoer.datum.slice(0, 10));
    },

    /** Openstaande posten op of voor de peildatum. */
    openstaand(peildatum: string): Array<{
      id: number;
      geaccrediteerdeId: number;
      instrumentId: string;
      soort: Agendasoort;
      datum: string;
    }> {
      const rijen = db
        .prepare(
          `SELECT id, geaccrediteerde_id, instrument_id, soort, datum
           FROM bekwaamheid_agenda
           WHERE afgehandeld_op IS NULL AND datum <= ?
           ORDER BY datum`,
        )
        .all(peildatum.slice(0, 10)) as Array<{
        id: number;
        geaccrediteerde_id: number;
        instrument_id: string;
        soort: string;
        datum: string;
      }>;
      return rijen.map((r) => ({
        id: r.id,
        geaccrediteerdeId: r.geaccrediteerde_id,
        instrumentId: r.instrument_id,
        soort: r.soort as Agendasoort,
        datum: r.datum,
      }));
    },

    handelAf(id: number): void {
      db.prepare("UPDATE bekwaamheid_agenda SET afgehandeld_op = ? WHERE id = ?").run(nu(), id);
    },
  };

  // -------------------------------------------------------------------------
  // Het tussentijdse controlemoment
  // -------------------------------------------------------------------------

  const toetsen = {
    /**
     * Leest de twee signalen en legt de berekende uitkomst neer.
     *
     * De rij wordt aangemaakt met een lege `uitkomst`: er is op dit moment nog
     * niets vastgesteld. Een mens stelt vast, eventueel afwijkend van de
     * berekening, en dan met motivering — de databank eist die motivering en niet
     * alleen dit bestand.
     *
     * Er wordt hier niets vastgesteld en niets gepubliceerd. Een toets die zichzelf
     * afrondt op het moment dat ze rekent, laat geen ruimte voor het gesprek dat
     * er volgens het draaiboek eerst moet zijn.
     */
    bereidVoor(invoer: {
      licentieId: number;
      peildatum?: string;
      beheerderIdVoorTelling?: number | null;
    }): ToetsRecord {
      const licentie = licenties.vindOp(invoer.licentieId);
      if (!licentie) throw new Error(`Licentie ${invoer.licentieId} bestaat niet.`);
      const persoon = register.vindOp(licentie.geaccrediteerdeId);
      if (!persoon) throw new Error(`Geaccrediteerde ${licentie.geaccrediteerdeId} bestaat niet.`);

      const peildatum = (invoer.peildatum ?? vandaag()).slice(0, 10);
      const venster = vensterTot(peildatum, TUSSENTIJDS_VENSTER_MAANDEN);
      // Zonder account is er geen praktijkspoor in `afnames` en geen oefenspoor in
      // `stm_sessies`. Dan blijven de tellers op nul, en dat is wat er feitelijk
      // te zien is — niet iets om weg te schatten.
      const beheerderId = invoer.beheerderIdVoorTelling ?? persoon.beheerderId;

      const afnamesAantal =
        beheerderId === null
          ? 0
          : tellers.telAfnames({
              beheerderId,
              van: venster.van,
              tot: venster.tot,
              instrumentId: licentie.instrumentId,
            });
      const oefening =
        beheerderId === null
          ? { sessies: 0, gemiddelde: null, perLaag: null }
          : tellers.leesOefenaggregaat({ beheerderId, van: venster.van, tot: venster.tot });

      const berekening = berekenTussentijdseToets({
        peildatum,
        afnamesAantal,
        stmSessies: oefening.sessies,
        stmGemiddelde: oefening.gemiddelde,
        stmPerLaag: oefening.perLaag,
      });

      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_tussentijdse_toetsen
             (geaccrediteerde_id, instrument_id, licentie_id, peildatum, venster_van, venster_tot,
              afnames_aantal, afnames_drempel, stm_sessies, stm_gemiddelde, stm_per_laag,
              signalen, berekende_uitkomst)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          licentie.geaccrediteerdeId,
          licentie.instrumentId,
          licentie.id,
          berekening.peildatum,
          berekening.vensterVan,
          berekening.vensterTot,
          berekening.afnamesAantal,
          berekening.afnamesDrempel,
          berekening.stmSessies,
          berekening.stmGemiddelde,
          berekening.stmPerLaag ? JSON.stringify(berekening.stmPerLaag) : null,
          JSON.stringify(berekening.signalen),
          berekening.uitkomst,
        );

      return toetsen.vindOp(res.lastInsertRowid as number)!;
    },

    vindOp(id: number): ToetsRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_tussentijdse_toetsen WHERE id = ?")
        .get(id) as Record<string, any> | undefined;
      if (!rij) return undefined;
      const signalen = JSON.parse(rij.signalen) as Signaal[];
      return {
        id: rij.id,
        geaccrediteerdeId: rij.geaccrediteerde_id,
        instrumentId: rij.instrument_id,
        licentieId: rij.licentie_id,
        peildatum: rij.peildatum,
        vensterVan: rij.venster_van,
        vensterTot: rij.venster_tot,
        afnamesAantal: rij.afnames_aantal,
        afnamesDrempel: rij.afnames_drempel,
        stmSessies: rij.stm_sessies,
        stmGemiddelde: rij.stm_gemiddelde,
        stmPerLaag: rij.stm_per_laag ? JSON.parse(rij.stm_per_laag) : null,
        signalen,
        uitkomst: rij.uitkomst as Toetsuitkomst | null,
        berekendeUitkomst: rij.berekende_uitkomst,
        // Herberekend uit de bewaarde signalen, niet apart opgeslagen: één
        // waarheid, en geen tekst die uit de pas kan gaan lopen met de signalen
        // waar ze over gaat.
        bindendeRegel: bepaalUitkomst(signalen).bindendeRegel,
        vastgesteldDoor: rij.vastgesteld_door,
        vastgesteldOp: rij.vastgesteld_op,
        besprokenOp: rij.besproken_op,
        gepubliceerdOp: rij.gepubliceerd_op,
        coachingsplanId: rij.coachingsplan_id,
      };
    },

    vanPersoon(geaccrediteerdeId: number): ToetsRecord[] {
      const rijen = db
        .prepare(
          `SELECT id FROM bekwaamheid_tussentijdse_toetsen
           WHERE geaccrediteerde_id = ? ORDER BY peildatum DESC`,
        )
        .all(geaccrediteerdeId) as { id: number }[];
      return rijen.map((r) => toetsen.vindOp(r.id)!);
    },

    /**
     * Stelt de uitkomst vast.
     *
     * Bij een alert moet er een coachingsplan zijn. Die eis staat hier én als
     * controlebeperking in de databank: hier met een leesbare melding, daar als
     * laatste vangnet voor code die deze functie niet gebruikt.
     *
     * De alertvlag op de licentie volgt de uitkomst. De status van de licentie
     * verandert niet — `zetAlert` kan die kolom niet aanraken.
     */
    stelVast(invoer: {
      toetsId: number;
      uitkomst?: Toetsuitkomst;
      afwijkingMotivering?: string | null;
      doorBeheerderId: number | null;
      besprokenOp?: string | null;
    }): ToetsRecord {
      const toets = toetsen.vindOp(invoer.toetsId);
      if (!toets) throw new Error(`Tussentijdse toets ${invoer.toetsId} bestaat niet.`);
      const uitkomst = invoer.uitkomst ?? toets.berekendeUitkomst;

      if (uitkomst !== toets.berekendeUitkomst) {
        const motivering = invoer.afwijkingMotivering?.trim() ?? "";
        if (motivering.length < 40) {
          throw new Error(
            "Afwijken van de berekende uitkomst vraagt een motivering van minstens veertig tekens.",
          );
        }
      }
      if (vraagtCoachingsplan(uitkomst) && toets.coachingsplanId === null) {
        throw new Error(
          "Een alert kan niet worden vastgesteld zonder coachingsplan. Stel eerst het plan op.",
        );
      }

      db.prepare(
        `UPDATE bekwaamheid_tussentijdse_toetsen SET
           uitkomst = ?, afwijking_motivering = ?, vastgesteld_door = ?, vastgesteld_op = ?,
           besproken_op = COALESCE(?, besproken_op)
         WHERE id = ?`,
      ).run(
        uitkomst,
        uitkomst === toets.berekendeUitkomst ? null : (invoer.afwijkingMotivering ?? null),
        invoer.doorBeheerderId,
        nu(),
        invoer.besprokenOp ?? null,
        invoer.toetsId,
      );

      licenties.zetAlert(toets.licentieId, uitkomst === "alert", invoer.doorBeheerderId);
      audit({
        adminId: invoer.doorBeheerderId,
        actie: "bekwaamheid_tussentijdse_toets_vastgesteld",
        afnameId: null,
        detail: `Toets ${invoer.toetsId}: ${uitkomst} (berekend ${toets.berekendeUitkomst})`,
      });
      return toetsen.vindOp(invoer.toetsId)!;
    },

    /**
     * Publiceert de uitkomst.
     *
     * Kan niet zonder gespreksdatum. Dat is dezelfde belofte als bij de
     * bekrachtiging: nooit een uitslag in de inbox voordat ze live is besproken.
     */
    publiceer(toetsId: number, doorBeheerderId: number | null): ToetsRecord {
      const toets = toetsen.vindOp(toetsId);
      if (!toets) throw new Error(`Tussentijdse toets ${toetsId} bestaat niet.`);
      if (!toets.besprokenOp) {
        throw new Error(
          "Publiceren kan niet voordat de uitkomst is besproken. Leg eerst de gespreksdatum vast.",
        );
      }
      db.prepare(
        "UPDATE bekwaamheid_tussentijdse_toetsen SET gepubliceerd_op = ? WHERE id = ?",
      ).run(nu(), toetsId);
      audit({
        adminId: doorBeheerderId,
        actie: "bekwaamheid_tussentijdse_toets_gepubliceerd",
        afnameId: null,
        detail: `Toets ${toetsId} gepubliceerd na gesprek op ${toets.besprokenOp}`,
      });
      return toetsen.vindOp(toetsId)!;
    },

    legGesprekVast(toetsId: number, besprokenOp: string): ToetsRecord {
      db.prepare(
        "UPDATE bekwaamheid_tussentijdse_toetsen SET besproken_op = ? WHERE id = ?",
      ).run(besprokenOp.slice(0, 10), toetsId);
      const toets = toetsen.vindOp(toetsId);
      if (!toets) throw new Error(`Tussentijdse toets ${toetsId} bestaat niet.`);
      return toets;
    },
  };

  // -------------------------------------------------------------------------
  // Het coachingsplan
  // -------------------------------------------------------------------------

  const plannen = {
    /** Stelt een plan op bij een toets en koppelt het terug aan die toets. */
    stelOp(invoer: {
      toetsId: number;
      doel: string;
      afspraken: unknown;
      begeleiderId?: number | null;
      opgesteldDoor: number | null;
      evaluatieOp?: string;
    }): number {
      const toets = toetsen.vindOp(invoer.toetsId);
      if (!toets) throw new Error(`Tussentijdse toets ${invoer.toetsId} bestaat niet.`);
      const aanleiding = toets.signalen
        .map((s) => s.toelichting)
        .join(" ")
        .trim();

      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_coachingsplannen
             (geaccrediteerde_id, instrument_id, tussentijdse_toets_id, aanleiding, doel,
              afspraken, begeleider_id, opgesteld_op, opgesteld_door, evaluatie_op)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          toets.geaccrediteerdeId,
          toets.instrumentId,
          toets.id,
          aanleiding || "Geen signaal vastgelegd.",
          invoer.doel,
          JSON.stringify(invoer.afspraken ?? []),
          invoer.begeleiderId ?? null,
          nu(),
          invoer.opgesteldDoor,
          invoer.evaluatieOp ??
            telMaandenOp(vandaag(), COACHINGSPLAN_EVALUATIE_MAANDEN),
        );
      const planId = res.lastInsertRowid as number;

      db.prepare(
        "UPDATE bekwaamheid_tussentijdse_toetsen SET coachingsplan_id = ? WHERE id = ?",
      ).run(planId, invoer.toetsId);
      agenda.zetNeer({
        geaccrediteerdeId: toets.geaccrediteerdeId,
        instrumentId: toets.instrumentId,
        soort: "coachingsplan_evaluatie",
        datum:
          invoer.evaluatieOp ?? telMaandenOp(vandaag(), COACHINGSPLAN_EVALUATIE_MAANDEN),
      });
      audit({
        adminId: invoer.opgesteldDoor,
        actie: "bekwaamheid_coachingsplan_opgesteld",
        afnameId: null,
        detail: `Plan ${planId} bij toets ${invoer.toetsId} voor geaccrediteerde ${toets.geaccrediteerdeId}.`,
      });
      return planId;
    },

    legAkkoordVast(planId: number, opDatum?: string): void {
      db.prepare(
        "UPDATE bekwaamheid_coachingsplannen SET akkoord_geaccrediteerde_op = ? WHERE id = ?",
      ).run((opDatum ?? vandaag()).slice(0, 10), planId);
    },

    /**
     * Sluit een plan af.
     *
     * Niet zonder akkoord van de betrokkene: een plan waaraan de geaccrediteerde
     * zich nooit heeft verbonden, kan niet als opgelost worden weggeschreven.
     */
    sluitAf(invoer: {
      planId: number;
      uitkomst: Coachingsplanuitkomst;
      doorBeheerderId: number | null;
    }): void {
      const rij = db
        .prepare(
          "SELECT akkoord_geaccrediteerde_op, tussentijdse_toets_id FROM bekwaamheid_coachingsplannen WHERE id = ?",
        )
        .get(invoer.planId) as
        | { akkoord_geaccrediteerde_op: string | null; tussentijdse_toets_id: number }
        | undefined;
      if (!rij) throw new Error(`Coachingsplan ${invoer.planId} bestaat niet.`);
      if (!rij.akkoord_geaccrediteerde_op) {
        throw new Error(
          "Een plan zonder akkoord van de betrokkene kan niet worden afgesloten.",
        );
      }
      db.prepare(
        "UPDATE bekwaamheid_coachingsplannen SET afgesloten_op = ?, uitkomst = ? WHERE id = ?",
      ).run(nu(), invoer.uitkomst, invoer.planId);

      // Opgelost betekent: de alert hoeft niet meer te staan. De andere twee
      // uitkomsten laten hem staan, want dan is de kwestie nog open.
      if (invoer.uitkomst === "opgelost") {
        const toets = toetsen.vindOp(rij.tussentijdse_toets_id);
        if (toets) licenties.zetAlert(toets.licentieId, false);
      }
      audit({
        adminId: invoer.doorBeheerderId,
        actie: "bekwaamheid_coachingsplan_afgesloten",
        afnameId: null,
        detail: `Plan ${invoer.planId}: ${invoer.uitkomst}`,
      });
    },
  };

  // -------------------------------------------------------------------------
  // De normprofielen
  //
  // Bouwplan blok 3: "Bevriezing wordt in de datalaag afgedwongen, niet in de
  // UI: een update op een rij met `bevrorenOp != null` gooit. Een nieuwe cesuur
  // is een nieuwe versie."
  //
  // Waarom de datalaag en niet een knop die grijs wordt. Een bevroren cesuur is
  // de enige reden waarom een beslissing over iemands bekwaamheid achteraf te
  // verdedigen is: ze bewijst dat de lat er al lag voordat er gemeten werd. Een
  // controle in de gebruikersinterface bewijst dat niet, want ze is te omzeilen
  // door een tweede schrijfweg, een script of een latere route. Alleen een
  // controle op de plek waar de rij daadwerkelijk verandert, geldt voor alle
  // schrijfwegen tegelijk. Dit is dezelfde reden waarom de overgang
  // `oefenen -> meten` bij de items hier wordt tegengehouden en niet in een
  // formulier.
  // -------------------------------------------------------------------------

  const normprofielen = {
    /**
     * Zoekt een normprofiel op nummer.
     */
    vindOp(id: number): NormprofielRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_normprofielen WHERE id = ?")
        .get(id) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Zoekt een bepaalde versie voor een instrument.
     */
    vindVersie(instrumentId: string, versie: number): NormprofielRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? AND versie = ?`,
        )
        .get(instrumentId, versie) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Geeft het geldende normprofiel voor een instrument.
     *
     * Uitdrukkelijk: het hoogste BEVROREN versienummer, niet simpelweg het
     * hoogste. Een normprofiel dat nog niet bevroren is, is een concept en mag
     * geen enkele beslissing raken. Zou deze functie het hoogste nummer geven,
     * dan zou iemand die aan een nieuwe cesuur werkt onbedoeld de lopende
     * rondes op een half ingevulde lat zetten.
     */
    geldend(instrumentId: string): NormprofielRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? AND bevroren_op IS NOT NULL
           ORDER BY versie DESC LIMIT 1`,
        )
        .get(instrumentId) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Alle versies voor een instrument, nieuwste eerst.
     */
    lijst(instrumentId: string): NormprofielRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? ORDER BY versie DESC`,
        )
        .all(instrumentId) as NormprofielRij[];
      return rijen.map(leesNormprofiel);
    },

    /**
     * Legt een nieuw normprofiel neer als concept, dus zonder bevriezing.
     *
     * Het versienummer wordt hier bepaald en niet door de aanroeper: wie het
     * nummer meegeeft, kan een bestaande versie overschrijven en daarmee de
     * geschiedenis herschrijven. Het nieuwe nummer is altijd het hoogste plus
     * een, ook wanneer de vorige versie een concept was.
     */
    zetNeer(invoer: {
      instrumentId: string;
      weging: Weging;
      drempelTotaal: number;
      drempelPerAs: DrempelPerAs;
      activiteitsdrempel: number;
      activiteitsvensterMaanden: number;
      methode: string;
      paneelOmschrijving?: string | null;
      vastgesteldDoor: string;
      onderbouwing: string;
      doorBeheerderId?: number | null;
    }): NormprofielRecord {
      const bevindingen = valideerNormprofiel(invoer);
      if (bevindingen.length) {
        throw new Error(
          "Normprofiel afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      const hoogste = db
        .prepare(
          `SELECT MAX(versie) AS m FROM bekwaamheid_normprofielen
           WHERE instrument_id = ?`,
        )
        .get(invoer.instrumentId) as { m: number | null };
      const versie = (hoogste?.m ?? 0) + 1;

      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_normprofielen
             (instrument_id, versie, weging, drempel_totaal, drempel_per_as,
              activiteitsdrempel, activiteitsvenster_maanden, methode,
              paneel_omschrijving, vastgesteld_op, vastgesteld_door,
              bevroren_op, onderbouwing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .run(
          invoer.instrumentId,
          versie,
          JSON.stringify(invoer.weging),
          invoer.drempelTotaal,
          JSON.stringify(invoer.drempelPerAs),
          invoer.activiteitsdrempel,
          invoer.activiteitsvensterMaanden,
          invoer.methode,
          invoer.paneelOmschrijving ?? null,
          vandaag(),
          invoer.vastgesteldDoor,
          invoer.onderbouwing,
        );

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_vastgelegd",
        afnameId: null,
        detail:
          `Normprofiel ${invoer.instrumentId} versie ${versie} vastgelegd als concept ` +
          `(totaaldrempel ${invoer.drempelTotaal}, activiteitsdrempel ` +
          `${invoer.activiteitsdrempel} per ${invoer.activiteitsvensterMaanden} maanden).`,
      });

      return normprofielen.vindOp(res.lastInsertRowid as number)!;
    },

    /**
     * Bevriest een normprofiel. Onomkeerbaar.
     *
     * Er is met opzet geen tegenhanger die ontdooit. Dat is geen vergetelheid:
     * een cesuur die terug open kan, is geen cesuur. Wie de lat wil verleggen,
     * legt een nieuwe versie neer; de oude blijft staan omdat elke beslissing
     * die eronder is genomen ernaar verwijst.
     */
    bevries(id: number, doorBeheerderId?: number | null): NormprofielRecord {
      const bestaand = normprofielen.vindOp(id);
      if (!bestaand) {
        throw new Error(`Normprofiel ${id} bestaat niet.`);
      }
      if (bestaand.bevrorenOp) {
        throw new Error(
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is al ` +
            `bevroren op ${bestaand.bevrorenOp}. Een bevroren cesuur wijzigt niet; ` +
            `leg een nieuwe versie neer.`,
        );
      }
      db.prepare("UPDATE bekwaamheid_normprofielen SET bevroren_op = ? WHERE id = ?").run(
        nu(),
        id,
      );
      audit({
        adminId: doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_bevroren",
        afnameId: null,
        detail:
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} bevroren. ` +
          `Vanaf nu onwijzigbaar.`,
      });
      return normprofielen.vindOp(id)!;
    },

    /**
     * Wijzigt een normprofiel dat nog concept is.
     *
     * Gooit op een bevroren rij. Dit is de poort die het bouwplan bedoelt: ze
     * staat hier, in de datalaag, en niet in een formulier.
     */
    wijzig(
      id: number,
      invoer: {
        weging?: Weging;
        drempelTotaal?: number;
        drempelPerAs?: DrempelPerAs;
        activiteitsdrempel?: number;
        activiteitsvensterMaanden?: number;
        methode?: string;
        paneelOmschrijving?: string | null;
        onderbouwing?: string;
        doorBeheerderId?: number | null;
      },
    ): NormprofielRecord {
      const bestaand = normprofielen.vindOp(id);
      if (!bestaand) {
        throw new Error(`Normprofiel ${id} bestaat niet.`);
      }
      if (bestaand.bevrorenOp) {
        throw new Error(
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is bevroren ` +
            `op ${bestaand.bevrorenOp} en wijzigt niet. Leg een nieuwe versie neer.`,
        );
      }

      const samengevoegd = {
        weging: invoer.weging ?? bestaand.weging,
        drempelTotaal: invoer.drempelTotaal ?? bestaand.drempelTotaal,
        drempelPerAs: invoer.drempelPerAs ?? bestaand.drempelPerAs,
        activiteitsdrempel: invoer.activiteitsdrempel ?? bestaand.activiteitsdrempel,
        activiteitsvensterMaanden:
          invoer.activiteitsvensterMaanden ?? bestaand.activiteitsvensterMaanden,
        onderbouwing: invoer.onderbouwing ?? bestaand.onderbouwing,
      };
      const bevindingen = valideerNormprofiel(samengevoegd);
      if (bevindingen.length) {
        throw new Error(
          "Normprofiel afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      db.prepare(
        `UPDATE bekwaamheid_normprofielen
           SET weging = ?, drempel_totaal = ?, drempel_per_as = ?,
               activiteitsdrempel = ?, activiteitsvenster_maanden = ?,
               methode = ?, paneel_omschrijving = ?, onderbouwing = ?
         WHERE id = ? AND bevroren_op IS NULL`,
      ).run(
        JSON.stringify(samengevoegd.weging),
        samengevoegd.drempelTotaal,
        JSON.stringify(samengevoegd.drempelPerAs),
        samengevoegd.activiteitsdrempel,
        samengevoegd.activiteitsvensterMaanden,
        invoer.methode ?? bestaand.methode,
        invoer.paneelOmschrijving !== undefined
          ? invoer.paneelOmschrijving
          : bestaand.paneelOmschrijving,
        samengevoegd.onderbouwing,
        id,
      );

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_gewijzigd",
        afnameId: null,
        detail: `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} gewijzigd als concept.`,
      });
      return normprofielen.vindOp(id)!;
    },
  };

  // -------------------------------------------------------------------------
  // De itembank
  // -------------------------------------------------------------------------

  const items = {
    /** Zoekt één item op nummer. */
    vindOp(id: number): ItemRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_items WHERE id = ?")
        .get(id) as ItemRij | undefined;
      return rij ? leesItem(rij) : undefined;
    },

    /**
     * De items van een instrument, nieuwste eerst.
     *
     * De filters zijn optioneel en werken samen. Standaard komen ook de niet
     * actieve items mee: een beheerscherm dat het bestaan van een gedeactiveerd
     * item verbergt, laat iemand hetzelfde item een tweede keer schrijven.
     */
    lijst(
      instrumentId: string,
      filter: { as?: string; blok?: string; gebruik?: string; alleenActief?: boolean } = {},
    ): ItemRecord[] {
      const voorwaarden = ["instrument_id = ?"];
      const waarden: unknown[] = [instrumentId];
      if (filter.as !== undefined) {
        voorwaarden.push('"as" = ?');
        waarden.push(filter.as);
      }
      if (filter.blok !== undefined) {
        voorwaarden.push("blok = ?");
        waarden.push(filter.blok);
      }
      if (filter.gebruik !== undefined) {
        voorwaarden.push("gebruik = ?");
        waarden.push(filter.gebruik);
      }
      if (filter.alleenActief === true) {
        voorwaarden.push("actief = 1");
      }
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_items
           WHERE ${voorwaarden.join(" AND ")}
           ORDER BY id DESC`,
        )
        .all(...waarden) as ItemRij[];
      return rijen.map(leesItem);
    },

    /**
     * Legt een nieuw item neer.
     *
     * Het gebruik staat standaard op `oefenen` en dat is geen willekeur: de weg
     * van oefenen naar meten is afgesloten, dus een item dat als oefenitem
     * begint, kan nooit meer meetitem worden. Wie een meetitem wil, geeft dat
     * hier expliciet mee. Dat is precies één handeling extra op de plaats waar de
     * beslissing hoort te vallen, in plaats van een stille standaardwaarde die
     * later niet meer te repareren is.
     */
    zetNeer(invoer: {
      instrumentId: string;
      as: string;
      blok?: string | null;
      soort: string;
      stam: string;
      opties?: string[] | null;
      sleutel: string;
      toelichtingGoed: string;
      toelichtingFout: string;
      gebruik?: Itemgebruik;
      bronVerwijzing?: string | null;
      doorBeheerderId?: number | null;
    }): ItemRecord {
      const bevindingen = valideerItem(invoer);
      if (bevindingen.length) {
        throw new Error(
          "Item afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      const uitkomst = db
        .prepare(
          `INSERT INTO bekwaamheid_items
             (instrument_id, "as", blok, soort, stam, opties, sleutel,
              toelichting_goed, toelichting_fout, gebruik, versie, actief,
              bron_verwijzing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        )
        .run(
          invoer.instrumentId,
          invoer.as,
          invoer.blok ?? null,
          invoer.soort,
          invoer.stam,
          invoer.opties ? JSON.stringify(invoer.opties) : null,
          invoer.sleutel,
          invoer.toelichtingGoed,
          invoer.toelichtingFout,
          invoer.gebruik ?? "oefenen",
          invoer.bronVerwijzing ?? null,
        );

      const id = Number(uitkomst.lastInsertRowid);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_item_neergezet",
        afnameId: null,
        detail:
          `Item ${id} voor ${invoer.instrumentId} neergezet op as ${invoer.as}` +
          `${invoer.blok ? `, blok ${invoer.blok}` : ""} als ${invoer.gebruik ?? "oefenen"}.`,
      });
      return items.vindOp(id)!;
    },

    /**
     * Werkt een item bij.
     *
     * Het gebruik loopt via `magOvergang` en wordt hier geweigerd wanneer de
     * overgang niet mag. Dat gebeurt in de opslaglaag en niet alleen in een route,
     * want dan zou een migratiescript of een tweede route erlangs kunnen.
     *
     * Een gewijzigd item houdt zijn nummer. Een itemset die dit item bevat,
     * verwijst naar dat nummer, en die verwijzing mag niet naar een ander item
     * gaan wijzen. `versie` gaat daarom met één omhoog bij elke inhoudelijke
     * wijziging: zo is bij een bezwaar te zien dat de tekst na de afname is
     * aangepast, ook al is het nummer hetzelfde.
     */
    wijzig(
      id: number,
      invoer: {
        blok?: string | null;
        stam?: string;
        opties?: string[] | null;
        sleutel?: string;
        toelichtingGoed?: string;
        toelichtingFout?: string;
        gebruik?: Itemgebruik;
        actief?: boolean;
        pWaarde?: number | null;
        discriminatie?: number | null;
        bronVerwijzing?: string | null;
        doorBeheerderId?: number | null;
      },
    ): ItemRecord {
      const bestaand = items.vindOp(id);
      if (!bestaand) {
        throw new Error(`Item ${id} bestaat niet.`);
      }

      let gebruikGewijzigd = false;
      if (invoer.gebruik !== undefined && invoer.gebruik !== bestaand.gebruik) {
        const uitspraak = magOvergang(bestaand.gebruik, invoer.gebruik);
        if (!uitspraak.toegestaan) {
          throw new Error(`Item ${id}: ${uitspraak.reden}`);
        }
        gebruikGewijzigd = true;
      }

      const samengevoegd = {
        instrumentId: bestaand.instrumentId,
        as: bestaand.as,
        blok: invoer.blok !== undefined ? invoer.blok : bestaand.blok,
        soort: bestaand.soort,
        stam: invoer.stam ?? bestaand.stam,
        opties: invoer.opties !== undefined ? invoer.opties : bestaand.opties,
        sleutel: invoer.sleutel ?? bestaand.sleutel,
        toelichtingGoed: invoer.toelichtingGoed ?? bestaand.toelichtingGoed,
        toelichtingFout: invoer.toelichtingFout ?? bestaand.toelichtingFout,
        gebruik: invoer.gebruik ?? bestaand.gebruik,
      };

      const bevindingen = valideerItem(samengevoegd);
      if (bevindingen.length) {
        throw new Error(
          "Item afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      // Een gewijzigde p-waarde of discriminatie is uitkomst van itemanalyse en
      // geen inhoudelijke wijziging van het item; die verhoogt de versie niet.
      const inhoudelijk =
        invoer.stam !== undefined ||
        invoer.opties !== undefined ||
        invoer.sleutel !== undefined ||
        invoer.toelichtingGoed !== undefined ||
        invoer.toelichtingFout !== undefined ||
        invoer.blok !== undefined;

      db.prepare(
        `UPDATE bekwaamheid_items
         SET blok = ?, stam = ?, opties = ?, sleutel = ?, toelichting_goed = ?,
             toelichting_fout = ?, gebruik = ?, actief = ?, versie = ?,
             p_waarde = ?, discriminatie = ?, bron_verwijzing = ?
         WHERE id = ?`,
      ).run(
        samengevoegd.blok,
        samengevoegd.stam,
        samengevoegd.opties ? JSON.stringify(samengevoegd.opties) : null,
        samengevoegd.sleutel,
        samengevoegd.toelichtingGoed,
        samengevoegd.toelichtingFout,
        samengevoegd.gebruik,
        invoer.actief !== undefined ? (invoer.actief ? 1 : 0) : bestaand.actief ? 1 : 0,
        inhoudelijk ? bestaand.versie + 1 : bestaand.versie,
        invoer.pWaarde !== undefined ? invoer.pWaarde : bestaand.pWaarde,
        invoer.discriminatie !== undefined ? invoer.discriminatie : bestaand.discriminatie,
        invoer.bronVerwijzing !== undefined ? invoer.bronVerwijzing : bestaand.bronVerwijzing,
        id,
      );

      if (gebruikGewijzigd) {
        audit({
          adminId: invoer.doorBeheerderId ?? null,
          actie: "bekwaamheid_item_gebruik_gewijzigd",
          afnameId: null,
          detail: `Item ${id} van ${bestaand.gebruik} naar ${samengevoegd.gebruik}.`,
        });
      }
      if (inhoudelijk || invoer.actief !== undefined) {
        audit({
          adminId: invoer.doorBeheerderId ?? null,
          actie: "bekwaamheid_item_gewijzigd",
          afnameId: null,
          detail:
            `Item ${id} gewijzigd naar versie ` +
            `${inhoudelijk ? bestaand.versie + 1 : bestaand.versie}.`,
        });
      }
      return items.vindOp(id)!;
    },

    /**
     * Hoeveel meetbare items er per kennischeckblok zijn.
     *
     * Voor het beheerscherm en voor wie wil weten of een kennischeck te maken is
     * vóór hij het probeert.
     */
    dekking(instrumentId: string): Record<Kennischeckblok, number> {
      return blokdekking(items.lijst(instrumentId, { as: "weten" }));
    },
  };

  // -------------------------------------------------------------------------
  // De itemsets
  // -------------------------------------------------------------------------

  const itemsets = {
    /** Zoekt één itemset op nummer. */
    vindOp(id: number): ItemsetRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_itemsets WHERE id = ?")
        .get(id) as ItemsetRij | undefined;
      return rij ? leesItemset(rij) : undefined;
    },

    /** De itemset van één bewijsstuk in één ronde. Er is er hoogstens één. */
    vindVoorBewijsstuk(rondeId: number, bewijsstukNummer: number): ItemsetRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_itemsets
           WHERE ronde_id = ? AND bewijsstuk_nummer = ?`,
        )
        .get(rondeId, bewijsstukNummer) as ItemsetRij | undefined;
      return rij ? leesItemset(rij) : undefined;
    },

    /**
     * Welke item-ids deze persoon eerder in een itemset kreeg.
     *
     * Over alle rondes van die persoon heen, niet alleen de vorige. Bij een derde
     * ronde na twee mislukte pogingen moeten beide eerdere sets uitgesloten
     * blijven; wie alleen de vorige ronde uitsluit, biedt in ronde drie de items
     * van ronde één opnieuw aan.
     */
    eerdereItemIds(geaccrediteerdeId: number, bewijsstukNummer: number): number[] {
      const rijen = db
        .prepare(
          `SELECT s.item_ids AS item_ids
           FROM bekwaamheid_itemsets s
           JOIN bekwaamheid_rondes r ON r.id = s.ronde_id
           WHERE r.geaccrediteerde_id = ? AND s.bewijsstuk_nummer = ?`,
        )
        .all(geaccrediteerdeId, bewijsstukNummer) as { item_ids: string }[];
      const uit = new Set<number>();
      for (const rij of rijen) {
        let lijst: number[];
        try {
          lijst = JSON.parse(rij.item_ids) as number[];
        } catch (e) {
          // Een onleesbare eerdere set mag deze samenstelling niet blokkeren,
          // maar hij mag ook niet stil verdwijnen: dan zou de kandidaat items
          // kunnen terugkrijgen die hij al zag. Gooien is hier het veiligste.
          throw new Error(
            `Een eerdere itemset van persoon ${geaccrediteerdeId} is onleesbaar: ` +
              `${(e as Error).message}`,
          );
        }
        for (const id of lijst) uit.add(id);
      }
      return Array.from(uit).sort((a, b) => a - b);
    },

    /**
     * Stelt de kennischeck van een ronde samen en legt hem vast.
     *
     * Het rekenwerk zit in `kennischeck.ts`; dit is de weg naar de databank. Wat
     * hier gebeurt en niet daar: de bank ophalen, de eerdere item-ids van deze
     * persoon ophalen, en het resultaat wegschrijven.
     *
     * De unieke index op (ronde_id, bewijsstuk_nummer) maakt een tweede
     * samenstelling voor hetzelfde bewijsstuk onmogelijk. Dat is de bedoeling:
     * opnieuw samenstellen zou betekenen dat een kandidaat die de eerste set al
     * heeft gezien een nieuwe krijgt, en dan is de eerste set uitgelekt zonder dat
     * er iemand van weet. Wie werkelijk een nieuwe set nodig heeft, opent een
     * nieuwe ronde; dan komt de uitsluiting op eerdere items automatisch mee.
     */
    stelSamen(invoer: {
      rondeId: number;
      bewijsstukNummer?: number;
      plan?: Record<Kennischeckblok, number>;
      zaad?: number;
      doorBeheerderId?: number | null;
    }): ItemsetRecord {
      const bewijsstukNummer = invoer.bewijsstukNummer ?? 1;

      const ronde = db
        .prepare(
          `SELECT id, geaccrediteerde_id, instrument_id
           FROM bekwaamheid_rondes WHERE id = ?`,
        )
        .get(invoer.rondeId) as
        | { id: number; geaccrediteerde_id: number; instrument_id: string }
        | undefined;
      if (!ronde) {
        throw new Error(`Ronde ${invoer.rondeId} bestaat niet.`);
      }

      const bestaand = itemsets.vindVoorBewijsstuk(invoer.rondeId, bewijsstukNummer);
      if (bestaand) {
        throw new Error(
          `Ronde ${invoer.rondeId} heeft voor bewijsstuk ${bewijsstukNummer} al een ` +
            `itemset (nummer ${bestaand.id}). Een tweede samenstelling zou de eerste ` +
            `set laten uitlekken zonder spoor; open een nieuwe ronde.`,
        );
      }

      const bank = items.lijst(ronde.instrument_id, { as: "weten" });
      const uitsluiten = itemsets.eerdereItemIds(ronde.geaccrediteerde_id, bewijsstukNummer);
      const plan = invoer.plan ?? volledigPlan();

      const samenstelling = stelKennischeckSamen({
        bank,
        plan,
        uitsluiten,
        zaad: invoer.zaad,
      });

      if (!samenstelling.gelukt) {
        const uitleg = samenstelling.tekorten
          .map(
            (t) =>
              `blok ${t.blok} (${BLOKNAMEN[t.blok]}): ${t.beschikbaar} van ${t.gevraagd}`,
          )
          .join("; ");
        throw new Error(
          `De kennischeck voor ${ronde.instrument_id} is niet samen te stellen. ` +
            `Tekort per blok: ${uitleg}. Er is geen verkorte set gemaakt: de drempel ` +
            `van 60% is vastgesteld op de volledige verdeling, en een kleinere set ` +
            `levert een score op die niet met die drempel te vergelijken is.`,
        );
      }

      const uitkomst = db
        .prepare(
          `INSERT INTO bekwaamheid_itemsets
             (ronde_id, bewijsstuk_nummer, item_ids, samengesteld_op)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          invoer.rondeId,
          bewijsstukNummer,
          JSON.stringify(samenstelling.itemIds),
          nu(),
        );

      const id = Number(uitkomst.lastInsertRowid);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_itemset_samengesteld",
        afnameId: null,
        detail:
          `Itemset ${id} voor ronde ${invoer.rondeId} bewijsstuk ${bewijsstukNummer}: ` +
          `${samenstelling.itemIds.length} items, zaad ${samenstelling.zaad}, ` +
          `${uitsluiten.length} eerder gezien uitgesloten.`,
      });
      return itemsets.vindOp(id)!;
    },

    /**
     * Neemt de antwoorden van een kandidaat aan. Eenmalig.
     *
     * Een tweede inlevering wordt geweigerd en niet stil genegeerd. Draaiboek
     * §4.3: één inleverbeweging. Zonder die weigering kan een kandidaat na het
     * zien van zijn score opnieuw inleveren, en dan meet de check niet meer wat
     * iemand wist maar hoe vaak hij het probeerde. De weigering komt uit de
     * databank en niet uit een vlag in het geheugen: twee gelijktijdige verzoeken
     * moeten er ook op stuklopen.
     */
    leverIn(invoer: {
      itemsetId: number;
      antwoorden: Record<string, string>;
      itemTijden?: Record<string, number> | null;
      doorBeheerderId?: number | null;
    }): ItemsetRecord {
      const bestaand = itemsets.vindOp(invoer.itemsetId);
      if (!bestaand) {
        throw new Error(`Itemset ${invoer.itemsetId} bestaat niet.`);
      }

      // Het patroon van `server/routes/afnames.ts`: lege tijden overschrijven
      // bewaarde tijden niet. Een oudere client die het veld niet kent, stuurt een
      // leeg object mee, en dat mag geen meetgegevens wissen.
      const tijden =
        invoer.itemTijden && Object.keys(invoer.itemTijden).length > 0
          ? JSON.stringify(invoer.itemTijden)
          : null;

      const uitkomst = db
        .prepare(
          `UPDATE bekwaamheid_itemsets
           SET antwoorden = ?,
               item_tijden = COALESCE(?, item_tijden)
           WHERE id = ? AND antwoorden IS NULL`,
        )
        .run(JSON.stringify(invoer.antwoorden), tijden, invoer.itemsetId);

      if (uitkomst.changes === 0) {
        throw new Error(
          `Itemset ${invoer.itemsetId} is al ingeleverd. Een tweede inlevering wordt ` +
            `niet aangenomen: de check meet wat iemand wist, niet hoe vaak hij het ` +
            `probeerde.`,
        );
      }

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_itemset_ingeleverd",
        afnameId: null,
        detail:
          `Itemset ${invoer.itemsetId} ingeleverd met ` +
          `${Object.keys(invoer.antwoorden).length} antwoorden op ` +
          `${bestaand.itemIds.length} items.`,
      });
      return itemsets.vindOp(invoer.itemsetId)!;
    },

    /**
     * Kijkt een ingeleverde itemset na.
     *
     * Leest, rekent en schrijft niets. Het resultaat gaat niet vanzelf naar het
     * bewijsstuk: dat is een handeling van blok 5, waar ook de wachtrij voor de
     * open items hangt. Zou deze functie de score wegschrijven, dan zou nakijken
     * en vaststellen dezelfde handeling worden, en dan is er geen moment meer
     * waarop een beoordelaar naar een open item kan kijken vóór er een uitkomst
     * ligt.
     *
     * De items komen in de bewaarde volgorde terug en niet in de volgorde van de
     * databank: `perItem` moet naast de itemset te leggen zijn.
     */
    keurNa(invoer: {
      itemsetId: number;
      handmatigeScores?: Record<string, number>;
      uitsluiten?: readonly number[];
      redenUitsluiting?: string;
    }): Nakijkresultaat {
      const set = itemsets.vindOp(invoer.itemsetId);
      if (!set) {
        throw new Error(`Itemset ${invoer.itemsetId} bestaat niet.`);
      }
      if (set.antwoorden === null) {
        throw new Error(
          `Itemset ${invoer.itemsetId} is nog niet ingeleverd; er is niets na te kijken.`,
        );
      }

      const opNummer = new Map<number, ItemRecord>();
      for (const id of set.itemIds) {
        const item = items.vindOp(id);
        if (!item) {
          throw new Error(
            `Itemset ${invoer.itemsetId} verwijst naar item ${id}, dat niet bestaat. ` +
              `Nakijken met een ontbrekend item zou een score opleveren over een ` +
              `andere set dan de kandidaat kreeg.`,
          );
        }
        opNummer.set(id, item);
      }

      return keurKennischeckNa({
        items: set.itemIds.map((id) => {
          const item = opNummer.get(id)!;
          return { id: item.id, soort: item.soort, sleutel: item.sleutel, blok: item.blok };
        }),
        antwoorden: set.antwoorden,
        handmatigeScores: invoer.handmatigeScores,
        uitsluiten: invoer.uitsluiten,
        redenUitsluiting: invoer.redenUitsluiting,
      });
    },
  };

  return {
    register,
    licenties,
    normprofielen,
    tellers,
    agenda,
    toetsen,
    plannen,
    items,
    itemsets,
    /**
     * De onderliggende verbinding.
     *
     * Nodig voor de twee vragen die de poortbrug stelt en die geen eigen
     * namespace verdienen: de toegangsvlaggen van een beheerder en of er een
     * bezwaar loopt. Beide zijn korte leesqueries over tabellen die elders al
     * hun eigen eigenaar hebben, en er een halve namespace voor optuigen zou
     * meer verbergen dan verklaren. Wie hier schrijft, schrijft op de verkeerde
     * plaats.
     */
    verbinding(): BetterSqlite3.Database {
      return db;
    },
  };
}

export type BekwaamheidOpslag = ReturnType<typeof maakBekwaamheidOpslag>;

const sqlite = new Database(vindDatabasePad());
pasEncryptieToe(sqlite, "server/bekwaamheid/storage.ts");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("cache_size = -8000");

export const bekwaamheidOpslag = maakBekwaamheidOpslag(sqlite);
