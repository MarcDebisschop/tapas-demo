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
  As,
  Beslisuitkomst,
  Bewijsherkomst,
  Bewijsstukroute,
  Bewijsstukstatus,
  Bezwaaruitspraak,
  Coachingsplanuitkomst,
  Kennischeckblok,
  Licentiestatus,
  Rondefase,
  Rondesoort,
  Toetsuitkomst,
} from "./schema";
import {
  bezwaarTegenOvergang,
  FASEN_MET_INLEVERRECHT,
  FASEN_MET_SCOREINVOER,
} from "./rondeloop";
import { BLOKNAMEN } from "./schema";
import type { AfnameVoorActiviteit } from "./activiteit";
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

// ---------------------------------------------------------------------------
// Rijvormen en omzetters van blok 3 en 4
//
// Waarom hier eigen Record-types staan en niet de `$inferSelect`-types uit
// schema.ts: die beschrijven wat Drizzle zou teruggeven, en deze laag leest met
// `better-sqlite3` rechtstreeks. Wat er dan binnenkomt zijn kolomnamen met
// liggende streepjes en getallen waar de rest van de module een boolean
// verwacht. De omzetters hieronder zijn de enige plaats waar die twee vormen
// elkaar raken.
// ---------------------------------------------------------------------------

type AccreditatieRij = {
  id: number;
  geaccrediteerde_id: number;
  instrument_id: string;
  niveau: number;
  behaald_op: string;
  opleiding_id: number | null;
  bewijs_herkomst: string;
  ingetrokken_op: string | null;
  ingetrokken_reden: string | null;
};

export type AccreditatieRecord = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  niveau: number;
  behaaldOp: string;
  opleidingId: number | null;
  bewijsHerkomst: Bewijsherkomst;
  ingetrokkenOp: string | null;
  ingetrokkenReden: string | null;
};

function leesAccreditatie(rij: AccreditatieRij): AccreditatieRecord {
  return {
    id: rij.id,
    geaccrediteerdeId: rij.geaccrediteerde_id,
    instrumentId: rij.instrument_id,
    niveau: rij.niveau,
    behaaldOp: rij.behaald_op,
    opleidingId: rij.opleiding_id,
    bewijsHerkomst: rij.bewijs_herkomst as Bewijsherkomst,
    ingetrokkenOp: rij.ingetrokken_op,
    ingetrokkenReden: rij.ingetrokken_reden,
  };
}

type RondeRij = {
  id: number;
  geaccrediteerde_id: number;
  instrument_id: string;
  normprofiel_id: number;
  soort: string;
  codenummer: string;
  fase: string;
  geopend_op: string;
  venster_tot: string;
  afgerond_op: string | null;
  aanpassingen: string | null;
  aanpassingen_reden: string | null;
  notitie_intern: string | null;
  verwerkingsdoel: string;
  rechtsgrond: string;
  privacyverklaring_versie: string | null;
};

export type RondeRecord = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  normprofielId: number;
  soort: Rondesoort;
  codenummer: string;
  fase: Rondefase;
  geopendOp: string;
  vensterTot: string;
  afgerondOp: string | null;
  aanpassingen: string | null;
  aanpassingenReden: string | null;
  notitieIntern: string | null;
  verwerkingsdoel: string;
  rechtsgrond: string;
  privacyverklaringVersie: string | null;
};

function leesRonde(rij: RondeRij): RondeRecord {
  return {
    id: rij.id,
    geaccrediteerdeId: rij.geaccrediteerde_id,
    instrumentId: rij.instrument_id,
    normprofielId: rij.normprofiel_id,
    soort: rij.soort as Rondesoort,
    codenummer: rij.codenummer,
    fase: rij.fase as Rondefase,
    geopendOp: rij.geopend_op,
    vensterTot: rij.venster_tot,
    afgerondOp: rij.afgerond_op,
    aanpassingen: rij.aanpassingen,
    aanpassingenReden: rij.aanpassingen_reden,
    notitieIntern: rij.notitie_intern,
    verwerkingsdoel: rij.verwerkingsdoel,
    rechtsgrond: rij.rechtsgrond,
    privacyverklaringVersie: rij.privacyverklaring_versie,
  };
}

type BewijsstukRij = {
  id: number;
  ronde_id: number;
  nummer: number;
  as: string;
  weging: number;
  status: string;
  ruwe_score: number | null;
  itemset_id: number | null;
  route: string | null;
  opname_verklaring: number;
  ingeleverd_op: string | null;
  beoordeeld_op: string | null;
};

export type BewijsstukRecord = {
  id: number;
  rondeId: number;
  nummer: number;
  as: As;
  weging: number;
  status: Bewijsstukstatus;
  ruweScore: number | null;
  itemsetId: number | null;
  route: Bewijsstukroute | null;
  opnameVerklaring: boolean;
  ingeleverdOp: string | null;
  beoordeeldOp: string | null;
};

function leesBewijsstuk(rij: BewijsstukRij): BewijsstukRecord {
  return {
    id: rij.id,
    rondeId: rij.ronde_id,
    nummer: rij.nummer,
    as: rij.as as As,
    weging: rij.weging,
    status: rij.status as Bewijsstukstatus,
    ruweScore: rij.ruwe_score,
    itemsetId: rij.itemset_id,
    route: (rij.route as Bewijsstukroute | null) ?? null,
    opnameVerklaring: rij.opname_verklaring === 1,
    ingeleverdOp: rij.ingeleverd_op,
    beoordeeldOp: rij.beoordeeld_op,
  };
}

type ScoreRij = {
  id: number;
  bewijsstuk_id: number;
  beoordelaar_id: number;
  onderdeel: string;
  score: number;
  onderbouwing: string;
  ingevoerd_op: string;
  is_kalibratie: number;
};

export type ScoreRecord = {
  id: number;
  bewijsstukId: number;
  beoordelaarId: number;
  onderdeel: string;
  score: number;
  onderbouwing: string;
  ingevoerdOp: string;
  isKalibratie: boolean;
};

function leesScore(rij: ScoreRij): ScoreRecord {
  return {
    id: rij.id,
    bewijsstukId: rij.bewijsstuk_id,
    beoordelaarId: rij.beoordelaar_id,
    onderdeel: rij.onderdeel,
    score: rij.score,
    onderbouwing: rij.onderbouwing,
    ingevoerdOp: rij.ingevoerd_op,
    isKalibratie: rij.is_kalibratie === 1,
  };
}

type BeslissingRij = {
  id: number;
  ronde_id: number;
  voorstel_uitkomst: string;
  voorstel_berekening: string;
  definitieve_uitkomst: string;
  afwijking_motivering: string | null;
  bekrachtiger_een_id: number;
  bekrachtiger_twee_id: number;
  bekrachtigd_op: string;
  gepubliceerd_op: string | null;
  debrief_op: string | null;
  debrief_door: number | null;
};

export type BeslissingRecord = {
  id: number;
  rondeId: number;
  voorstelUitkomst: Beslisuitkomst;
  /** De volledige uitkomst van `beoordeel()` zoals ze bij de beslissing gold. */
  voorstelBerekening: unknown;
  definitieveUitkomst: Beslisuitkomst;
  afwijkingMotivering: string | null;
  bekrachtigerEenId: number;
  bekrachtigerTweeId: number;
  bekrachtigdOp: string;
  gepubliceerdOp: string | null;
  debriefOp: string | null;
  debriefDoor: number | null;
};

function leesBeslissing(rij: BeslissingRij): BeslissingRecord {
  let berekening: unknown = null;
  try {
    berekening = JSON.parse(rij.voorstel_berekening);
  } catch {
    // Een onleesbare berekening mag het lezen van de beslissing niet blokkeren.
    // De uitkomst zelf staat in een eigen kolom en is het feit dat telt; de
    // berekening is de verantwoording erbij. Liever de beslissing tonen met een
    // lege verantwoording dan het hele scherm laten vallen.
    berekening = null;
  }
  return {
    id: rij.id,
    rondeId: rij.ronde_id,
    voorstelUitkomst: rij.voorstel_uitkomst as Beslisuitkomst,
    voorstelBerekening: berekening,
    definitieveUitkomst: rij.definitieve_uitkomst as Beslisuitkomst,
    afwijkingMotivering: rij.afwijking_motivering,
    bekrachtigerEenId: rij.bekrachtiger_een_id,
    bekrachtigerTweeId: rij.bekrachtiger_twee_id,
    bekrachtigdOp: rij.bekrachtigd_op,
    gepubliceerdOp: rij.gepubliceerd_op,
    debriefOp: rij.debrief_op,
    debriefDoor: rij.debrief_door,
  };
}

type BezwaarRij = {
  id: number;
  ronde_id: number;
  ingediend_op: string;
  grond: string;
  ontvangstbevestigd_op: string | null;
  behandelaar_intern: number | null;
  behandelaar_extern_omschrijving: string | null;
  uitspraak_op: string | null;
  uitspraak: string | null;
  uitspraak_motivering: string | null;
  status_tijdens_bezwaar_ongewijzigd: number;
};

export type BezwaarRecord = {
  id: number;
  rondeId: number;
  ingediendOp: string;
  grond: string;
  ontvangstbevestigdOp: string | null;
  behandelaarIntern: number | null;
  behandelaarExternOmschrijving: string | null;
  uitspraakOp: string | null;
  uitspraak: Bezwaaruitspraak | null;
  uitspraakMotivering: string | null;
  statusTijdensBezwaarOngewijzigd: boolean;
};

function leesBezwaar(rij: BezwaarRij): BezwaarRecord {
  return {
    id: rij.id,
    rondeId: rij.ronde_id,
    ingediendOp: rij.ingediend_op,
    grond: rij.grond,
    ontvangstbevestigdOp: rij.ontvangstbevestigd_op,
    behandelaarIntern: rij.behandelaar_intern,
    behandelaarExternOmschrijving: rij.behandelaar_extern_omschrijving,
    uitspraakOp: rij.uitspraak_op,
    uitspraak: (rij.uitspraak as Bezwaaruitspraak | null) ?? null,
    uitspraakMotivering: rij.uitspraak_motivering,
    statusTijdensBezwaarOngewijzigd: rij.status_tijdens_bezwaar_ongewijzigd === 1,
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
     * De voltooide afnames van één persoon als ruwe rijen voor de
     * activiteitsberekening.
     *
     * `telAfnames` geeft een getal en is genoeg voor een dashboard. De
     * activiteitsmodule heeft meer nodig: ze bepaalt zelf haar venster, ze kijkt
     * per instrument, en ze leest de tijdgegevens om te zien of er afnames bij
     * zijn die verdacht snel zijn afgewerkt. Zou deze laag alvast filteren op
     * venster of instrument, dan zou de berekening met een voorgeselecteerde
     * verzameling werken en zou haar eigen venstergrens niets meer betekenen.
     *
     * Daarom: alles wat voltooid is, ongefilterd, en de module kiest.
     */
    afnamesVoorActiviteit(beheerderId: number): AfnameVoorActiviteit[] {
      const rijen = db
        .prepare(
          `SELECT id, instrument_id, completed_at, item_tijden FROM afnames
           WHERE aangemaakt_door_beheerder_id = ?
             AND status = 'voltooid'
             AND completed_at IS NOT NULL
           ORDER BY completed_at ASC`,
        )
        .all(beheerderId) as {
        id: number;
        instrument_id: string | null;
        completed_at: string | null;
        item_tijden: unknown;
      }[];
      return rijen.map((r) => ({
        id: r.id,
        instrumentId: r.instrument_id,
        voltooidOp: r.completed_at,
        itemTijden: r.item_tijden,
      }));
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

  // -------------------------------------------------------------------------
  // Accreditaties — het historische feit, los van het recht van vandaag
  // -------------------------------------------------------------------------

  /**
   * WAAROM DEZE GROEP ER TOCH KOMT, EN NIET GESCHRAPT IS.
   *
   * `bekwaamheid_accreditaties` was de enige tabel die door niets werd
   * aangeraakt: geen opslag, geen script, geen scherm. Er lagen twee eerlijke
   * uitwegen — bouwen of schrappen — en één slechte: laten staan met een
   * docstring die beweert dat een script haar vult.
   *
   * Bouwen wint op één onderscheid dat in deze module echt bestaat. Een licentie
   * VERVALT: ze heeft `geldig_tot`, ze kan opgeschort of beeindigd worden, en
   * `STATUSSEN_MET_AFNAMERECHT` beslist of iemand vandaag mag afnemen. Een
   * accreditatie vervalt niet — "deze persoon heeft in 2019 niveau 2 behaald"
   * blijft waar, ook nadat de licentie is verlopen. Zou dat feit in de
   * licentietabel worden geperst, dan zou het bij elke statuswijziging herschreven
   * worden en was de historiek na twee cycli weg.
   *
   * Intrekken is daarom géén verwijdering maar een aantekening met datum en
   * reden, precies zoals de CHECK `intrekking_volledig` afdwingt: allebei of
   * geen van beide. Een ingetrokken accreditatie blijft leesbaar; dat is het
   * verschil tussen een correctie en het uitwissen van een spoor.
   */
  const accreditaties = {
    vindOp(id: number): AccreditatieRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_accreditaties WHERE id = ?")
        .get(id) as AccreditatieRij | undefined;
      return rij ? leesAccreditatie(rij) : undefined;
    },

    vanPersoon(geaccrediteerdeId: number): AccreditatieRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_accreditaties
           WHERE geaccrediteerde_id = ?
           ORDER BY behaald_op DESC, instrument_id`,
        )
        .all(geaccrediteerdeId) as AccreditatieRij[];
      return rijen.map(leesAccreditatie);
    },

    /**
     * Legt een behaalde accreditatie vast.
     *
     * De unieke index staat op (persoon, instrument, niveau). Tweemaal hetzelfde
     * niveau op hetzelfde instrument is geen tweede prestatie maar een dubbele
     * invoer, en die wordt hier geweigerd met een leesbare tekst in plaats van
     * met een SQLite-foutcode die het scherm niet kan tonen.
     */
    legVast(invoer: {
      geaccrediteerdeId: number;
      instrumentId: string;
      niveau: number;
      behaaldOp: string;
      opleidingId?: number | null;
      bewijsHerkomst: Bewijsherkomst;
      doorBeheerderId?: number | null;
    }): AccreditatieRecord {
      if (!register.vindOp(invoer.geaccrediteerdeId)) {
        throw new Error(`Geaccrediteerde ${invoer.geaccrediteerdeId} bestaat niet.`);
      }
      const bestaand = db
        .prepare(
          `SELECT id FROM bekwaamheid_accreditaties
           WHERE geaccrediteerde_id = ? AND instrument_id = ? AND niveau = ?`,
        )
        .get(invoer.geaccrediteerdeId, invoer.instrumentId, invoer.niveau) as
        | { id: number }
        | undefined;
      if (bestaand) {
        throw new Error(
          `Er staat al een accreditatie voor ${invoer.instrumentId} op niveau ${invoer.niveau}.`,
        );
      }
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_accreditaties
             (geaccrediteerde_id, instrument_id, niveau, behaald_op, opleiding_id, bewijs_herkomst)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          invoer.geaccrediteerdeId,
          invoer.instrumentId,
          invoer.niveau,
          invoer.behaaldOp.slice(0, 10),
          invoer.opleidingId ?? null,
          invoer.bewijsHerkomst,
        );
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_accreditatie_vastgelegd",
        afnameId: null,
        detail: `Accreditatie ${res.lastInsertRowid}: ${invoer.instrumentId} niveau ${invoer.niveau} voor persoon ${invoer.geaccrediteerdeId}, behaald ${invoer.behaaldOp.slice(0, 10)} (${invoer.bewijsHerkomst}).`,
      });
      return accreditaties.vindOp(res.lastInsertRowid as number)!;
    },

    /** Trekt een accreditatie in. Verwijdert niets; zet datum en reden. */
    trekIn(invoer: { id: number; reden: string; doorBeheerderId?: number | null }): AccreditatieRecord {
      const bestaand = accreditaties.vindOp(invoer.id);
      if (!bestaand) throw new Error(`Accreditatie ${invoer.id} bestaat niet.`);
      if (bestaand.ingetrokkenOp) {
        throw new Error(`Accreditatie ${invoer.id} is al ingetrokken op ${bestaand.ingetrokkenOp}.`);
      }
      const reden = invoer.reden.trim();
      if (reden.length < 10) {
        throw new Error("Een intrekking vraagt een reden van minstens tien tekens.");
      }
      db.prepare(
        `UPDATE bekwaamheid_accreditaties
         SET ingetrokken_op = ?, ingetrokken_reden = ?
         WHERE id = ?`,
      ).run(vandaag(), reden, invoer.id);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_accreditatie_ingetrokken",
        afnameId: null,
        detail: `Accreditatie ${invoer.id} ingetrokken: ${reden}`,
      });
      return accreditaties.vindOp(invoer.id)!;
    },
  };

  // -------------------------------------------------------------------------
  // Rondes — de loop van een bekrachtiging
  // -------------------------------------------------------------------------

  /**
   * WAAROM EEN RONDE NIET OPENT ZONDER BEVROREN NORM.
   *
   * `open` weigert wanneer er voor het instrument geen bevroren normprofiel
   * geldt. Dat is de belangrijkste regel in deze groep. Zou een ronde kunnen
   * starten op een concept, dan kon de cesuur veranderen terwijl de kandidaat
   * bezig was, en dan is achteraf niet vast te stellen waaraan hij is
   * afgemeten. De ronde legt het `normprofiel_id` vast bij het openen en houdt
   * dat vast; een latere versie van de norm raakt lopende rondes niet.
   */
  const rondes = {
    vindOp(id: number): RondeRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_rondes WHERE id = ?")
        .get(id) as RondeRij | undefined;
      return rij ? leesRonde(rij) : undefined;
    },

    vanPersoon(geaccrediteerdeId: number): RondeRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_rondes
           WHERE geaccrediteerde_id = ?
           ORDER BY geopend_op DESC`,
        )
        .all(geaccrediteerdeId) as RondeRij[];
      return rijen.map(leesRonde);
    },

    lijst(filter: { fase?: Rondefase; instrumentId?: string } = {}): RondeRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_rondes
           WHERE (? IS NULL OR fase = ?)
             AND (? IS NULL OR instrument_id = ?)
           ORDER BY geopend_op DESC`,
        )
        .all(
          filter.fase ?? null,
          filter.fase ?? null,
          filter.instrumentId ?? null,
          filter.instrumentId ?? null,
        ) as RondeRij[];
      return rijen.map(leesRonde);
    },

    /**
     * Bouwt het codenummer waaronder de ronde in stukken naar buiten gaat.
     *
     * Vorm `R-2026-0007`: jaartal plus een teller binnen dat jaar. Geen naam en
     * geen persoonsnummer, want dit nummer staat op documenten die beoordelaars
     * zien en de module werkt zonder namenlijst. De unieke index op de kolom
     * vangt een botsing af; de teller kijkt naar het hoogste bestaande nummer van
     * het jaar en niet naar het aantal rijen, zodat een gestaakte ronde geen
     * nummer teruggeeft dat al op papier staat.
     */
    volgendCodenummer(jaar?: string): string {
      const jr = jaar ?? vandaag().slice(0, 4);
      const rij = db
        .prepare(
          `SELECT codenummer FROM bekwaamheid_rondes
           WHERE codenummer LIKE ?
           ORDER BY codenummer DESC LIMIT 1`,
        )
        .get(`R-${jr}-%`) as { codenummer: string } | undefined;
      const laatste = rij ? Number(rij.codenummer.slice(-4)) : 0;
      return `R-${jr}-${String(laatste + 1).padStart(4, "0")}`;
    },

    open(invoer: {
      geaccrediteerdeId: number;
      instrumentId: string;
      soort: Rondesoort;
      geopendOp?: string;
      vensterMaanden?: number;
      notitieIntern?: string | null;
      privacyverklaringVersie?: string | null;
      doorBeheerderId?: number | null;
    }): RondeRecord {
      if (!register.vindOp(invoer.geaccrediteerdeId)) {
        throw new Error(`Geaccrediteerde ${invoer.geaccrediteerdeId} bestaat niet.`);
      }
      const norm = normprofielen.geldend(invoer.instrumentId);
      if (!norm) {
        throw new Error(
          `Voor ${invoer.instrumentId} geldt geen bevroren normprofiel; een ronde kan niet openen zonder cesuur.`,
        );
      }
      const lopend = db
        .prepare(
          `SELECT id, codenummer FROM bekwaamheid_rondes
           WHERE geaccrediteerde_id = ? AND instrument_id = ?
             AND fase NOT IN ('afgesloten', 'gestaakt')`,
        )
        .get(invoer.geaccrediteerdeId, invoer.instrumentId) as
        | { id: number; codenummer: string }
        | undefined;
      if (lopend) {
        throw new Error(
          `Er loopt al een ronde (${lopend.codenummer}) voor deze persoon op ${invoer.instrumentId}.`,
        );
      }
      const geopendOp = (invoer.geopendOp ?? vandaag()).slice(0, 10);
      const maanden = invoer.vensterMaanden ?? 3;
      const codenummer = rondes.volgendCodenummer(geopendOp.slice(0, 4));
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_rondes
             (geaccrediteerde_id, instrument_id, normprofiel_id, soort, codenummer,
              fase, geopend_op, venster_tot, notitie_intern, privacyverklaring_versie)
           VALUES (?, ?, ?, ?, ?, 'voorbereiding', ?, ?, ?, ?)`,
        )
        .run(
          invoer.geaccrediteerdeId,
          invoer.instrumentId,
          norm.id,
          invoer.soort,
          codenummer,
          geopendOp,
          telMaandenOp(geopendOp, maanden),
          invoer.notitieIntern ?? null,
          invoer.privacyverklaringVersie ?? null,
        );
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_ronde_geopend",
        afnameId: null,
        detail: `Ronde ${codenummer} geopend voor persoon ${invoer.geaccrediteerdeId} op ${invoer.instrumentId} (${invoer.soort}), norm versie ${norm.versie}.`,
      });
      return rondes.vindOp(res.lastInsertRowid as number)!;
    },

    /**
     * Verzet de fase, en alleen wanneer de loop dat toestaat.
     *
     * De toets staat in `rondeloop.ts` en niet hier. Deze methode kent de
     * volgorde van de elf fasen dus niet; ze vraagt het na. Zo blijft er één
     * plaats waar de loop beschreven staat, en die plaats heeft een uitputtende
     * test over alle honderdeenentwintig paren.
     */
    verzetFase(invoer: {
      id: number;
      naar: Rondefase;
      reden?: string | null;
      doorBeheerderId?: number | null;
    }): RondeRecord {
      const ronde = rondes.vindOp(invoer.id);
      if (!ronde) throw new Error(`Ronde ${invoer.id} bestaat niet.`);
      const bezwaar = bezwaarTegenOvergang(ronde.fase, invoer.naar);
      if (bezwaar) throw new Error(bezwaar);

      const afgerondOp =
        invoer.naar === "afgesloten" || invoer.naar === "gestaakt" ? vandaag() : null;
      if (invoer.naar === "gestaakt" && (!invoer.reden || invoer.reden.trim().length < 10)) {
        throw new Error("Een ronde staken vraagt een reden van minstens tien tekens.");
      }
      db.prepare(
        `UPDATE bekwaamheid_rondes
         SET fase = ?,
             afgerond_op = COALESCE(?, afgerond_op),
             aanpassingen_reden = COALESCE(?, aanpassingen_reden)
         WHERE id = ?`,
      ).run(invoer.naar, afgerondOp, invoer.reden?.trim() ?? null, invoer.id);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_ronde_fase_verzet",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: ${ronde.fase} -> ${invoer.naar}${invoer.reden ? ` (${invoer.reden.trim()})` : ""}.`,
      });
      return rondes.vindOp(invoer.id)!;
    },

    /** Legt een aanpassing (redelijke voorziening) vast op een lopende ronde. */
    legAanpassingVast(invoer: {
      id: number;
      aanpassingen: string;
      reden: string;
      doorBeheerderId?: number | null;
    }): RondeRecord {
      const ronde = rondes.vindOp(invoer.id);
      if (!ronde) throw new Error(`Ronde ${invoer.id} bestaat niet.`);
      if (ronde.fase === "afgesloten" || ronde.fase === "gestaakt") {
        throw new Error(`Ronde ${ronde.codenummer} is ${ronde.fase}; er verandert niets meer aan.`);
      }
      db.prepare(
        "UPDATE bekwaamheid_rondes SET aanpassingen = ?, aanpassingen_reden = ? WHERE id = ?",
      ).run(invoer.aanpassingen.trim(), invoer.reden.trim(), invoer.id);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_ronde_aanpassing_vastgelegd",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: aanpassing vastgelegd (${invoer.reden.trim()}).`,
      });
      return rondes.vindOp(invoer.id)!;
    },
  };

  // -------------------------------------------------------------------------
  // Bewijsstukken — waarop de assen gemeten worden
  // -------------------------------------------------------------------------

  const bewijsstukken = {
    vindOp(id: number): BewijsstukRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_bewijsstukken WHERE id = ?")
        .get(id) as BewijsstukRij | undefined;
      return rij ? leesBewijsstuk(rij) : undefined;
    },

    vanRonde(rondeId: number): BewijsstukRecord[] {
      const rijen = db
        .prepare("SELECT * FROM bekwaamheid_bewijsstukken WHERE ronde_id = ? ORDER BY nummer")
        .all(rondeId) as BewijsstukRij[];
      return rijen.map(leesBewijsstuk);
    },

    /**
     * Legt één bewijsstuk neer op een ronde die nog in voorbereiding is.
     *
     * Na `voorbereiding` kan er geen bewijsstuk meer bij. Dat is niet
     * administratief maar inhoudelijk: het dossier waarop iemand wordt
     * beoordeeld, moet vaststaan voordat hij begint. Een bewijsstuk dat
     * halverwege wordt toegevoegd, verandert de meting terwijl ze loopt.
     */
    zetNeer(invoer: {
      rondeId: number;
      nummer: number;
      as: As;
      weging: number;
      route?: Bewijsstukroute | null;
      opnameVerklaring?: boolean;
    }): BewijsstukRecord {
      const ronde = rondes.vindOp(invoer.rondeId);
      if (!ronde) throw new Error(`Ronde ${invoer.rondeId} bestaat niet.`);
      if (ronde.fase !== "voorbereiding") {
        throw new Error(
          `Ronde ${ronde.codenummer} staat in fase '${ronde.fase}'; bewijsstukken worden vastgelegd in de voorbereiding.`,
        );
      }
      if (!Number.isInteger(invoer.nummer) || invoer.nummer < 1 || invoer.nummer > 5) {
        throw new Error("Het nummer van een bewijsstuk ligt tussen 1 en 5.");
      }
      if (!(invoer.weging > 0)) {
        throw new Error("De weging van een bewijsstuk is groter dan nul.");
      }
      const bezet = db
        .prepare("SELECT id FROM bekwaamheid_bewijsstukken WHERE ronde_id = ? AND nummer = ?")
        .get(invoer.rondeId, invoer.nummer) as { id: number } | undefined;
      if (bezet) {
        throw new Error(`Bewijsstuk ${invoer.nummer} bestaat al op ronde ${ronde.codenummer}.`);
      }
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_bewijsstukken
             (ronde_id, nummer, "as", weging, status, route, opname_verklaring)
           VALUES (?, ?, ?, ?, 'open', ?, ?)`,
        )
        .run(
          invoer.rondeId,
          invoer.nummer,
          invoer.as,
          invoer.weging,
          invoer.route ?? null,
          invoer.opnameVerklaring ? 1 : 0,
        );
      return bewijsstukken.vindOp(res.lastInsertRowid as number)!;
    },

    /** Markeert een bewijsstuk als ingeleverd. Alleen op een open ronde. */
    leverIn(invoer: { id: number; ingeleverdOp?: string }): BewijsstukRecord {
      const stuk = bewijsstukken.vindOp(invoer.id);
      if (!stuk) throw new Error(`Bewijsstuk ${invoer.id} bestaat niet.`);
      const ronde = rondes.vindOp(stuk.rondeId)!;
      if (!FASEN_MET_INLEVERRECHT.includes(ronde.fase)) {
        throw new Error(
          `Ronde ${ronde.codenummer} staat in fase '${ronde.fase}'; inleveren kan alleen wanneer de ronde open staat.`,
        );
      }
      if (stuk.status !== "open") {
        throw new Error(`Bewijsstuk ${stuk.nummer} heeft status '${stuk.status}'.`);
      }
      db.prepare(
        "UPDATE bekwaamheid_bewijsstukken SET status = 'ingeleverd', ingeleverd_op = ? WHERE id = ?",
      ).run((invoer.ingeleverdOp ?? vandaag()).slice(0, 10), invoer.id);
      return bewijsstukken.vindOp(invoer.id)!;
    },

    /**
     * Verklaart een bewijsstuk niet van toepassing.
     *
     * `nvt` telt in `berekenAsscores` niet mee én niet als openstaand. Dat maakt
     * dit de enige weg om een dossier volledig te krijgen zonder alle vijf de
     * stukken. Precies daarom vraagt het een reden: zonder reden zou dit de
     * makkelijke uitweg zijn om een lastig onderdeel weg te strepen.
     */
    markeerNvt(invoer: {
      id: number;
      reden: string;
      doorBeheerderId?: number | null;
    }): BewijsstukRecord {
      const stuk = bewijsstukken.vindOp(invoer.id);
      if (!stuk) throw new Error(`Bewijsstuk ${invoer.id} bestaat niet.`);
      if (stuk.status === "beoordeeld") {
        throw new Error(
          `Bewijsstuk ${stuk.nummer} is al beoordeeld; een beoordeeld stuk wordt niet alsnog geschrapt.`,
        );
      }
      const reden = invoer.reden.trim();
      if (reden.length < 10) {
        throw new Error("Niet van toepassing verklaren vraagt een reden van minstens tien tekens.");
      }
      const ronde = rondes.vindOp(stuk.rondeId)!;
      db.prepare("UPDATE bekwaamheid_bewijsstukken SET status = 'nvt' WHERE id = ?").run(invoer.id);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_bewijsstuk_nvt",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}, bewijsstuk ${stuk.nummer} niet van toepassing: ${reden}`,
      });
      return bewijsstukken.vindOp(invoer.id)!;
    },
  };

  // -------------------------------------------------------------------------
  // Scores — de rubriekinvoer van de beoordelaars
  // -------------------------------------------------------------------------

  /**
   * WAAROM EEN SCORE HERZIEN WORDT EN NIET OVERSCHREVEN MET EEN TWEEDE RIJ.
   *
   * De unieke index staat op (bewijsstuk, beoordelaar, onderdeel). Eén
   * beoordelaar heeft per onderdeel één oordeel. Zou een tweede invoer een
   * tweede rij maken, dan zou de ICC dezelfde beoordelaar dubbel tellen en zou
   * de overeenstemming tussen beoordelaars kunstmatig stijgen, want een mens is
   * het altijd met zichzelf eens.
   */
  const scores = {
    vanBewijsstuk(bewijsstukId: number): ScoreRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_scores
           WHERE bewijsstuk_id = ?
           ORDER BY beoordelaar_id, onderdeel`,
        )
        .all(bewijsstukId) as ScoreRij[];
      return rijen.map(leesScore);
    },

    vanRonde(rondeId: number): ScoreRecord[] {
      const rijen = db
        .prepare(
          `SELECT s.* FROM bekwaamheid_scores s
           JOIN bekwaamheid_bewijsstukken b ON b.id = s.bewijsstuk_id
           WHERE b.ronde_id = ?
           ORDER BY b.nummer, s.beoordelaar_id, s.onderdeel`,
        )
        .all(rondeId) as ScoreRij[];
      return rijen.map(leesScore);
    },

    voerIn(invoer: {
      bewijsstukId: number;
      beoordelaarId: number;
      onderdeel: string;
      score: number;
      onderbouwing: string;
      isKalibratie?: boolean;
    }): ScoreRecord {
      const stuk = bewijsstukken.vindOp(invoer.bewijsstukId);
      if (!stuk) throw new Error(`Bewijsstuk ${invoer.bewijsstukId} bestaat niet.`);
      const ronde = rondes.vindOp(stuk.rondeId)!;
      if (!FASEN_MET_SCOREINVOER.includes(ronde.fase)) {
        throw new Error(
          `Ronde ${ronde.codenummer} staat in fase '${ronde.fase}'; scores worden ingevoerd tijdens de beoordeling.`,
        );
      }
      if (stuk.status === "open") {
        throw new Error(`Bewijsstuk ${stuk.nummer} is nog niet ingeleverd.`);
      }
      if (stuk.status === "nvt") {
        throw new Error(`Bewijsstuk ${stuk.nummer} is niet van toepassing verklaard.`);
      }
      if (!Number.isInteger(invoer.score) || invoer.score < 0 || invoer.score > 3) {
        throw new Error("Een rubriekscore is een geheel getal van 0 tot en met 3.");
      }
      const onderbouwing = invoer.onderbouwing.trim();
      if (onderbouwing.length < 40) {
        throw new Error("Een score vraagt een onderbouwing van minstens veertig tekens.");
      }
      const bestaand = db
        .prepare(
          `SELECT id FROM bekwaamheid_scores
           WHERE bewijsstuk_id = ? AND beoordelaar_id = ? AND onderdeel = ?`,
        )
        .get(invoer.bewijsstukId, invoer.beoordelaarId, invoer.onderdeel) as
        | { id: number }
        | undefined;
      if (bestaand) {
        throw new Error(
          `Deze beoordelaar heeft onderdeel '${invoer.onderdeel}' al gescoord. Herzien gaat via herzie().`,
        );
      }
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_scores
             (bewijsstuk_id, beoordelaar_id, onderdeel, score, onderbouwing, ingevoerd_op, is_kalibratie)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          invoer.bewijsstukId,
          invoer.beoordelaarId,
          invoer.onderdeel,
          invoer.score,
          onderbouwing,
          nu(),
          invoer.isKalibratie ? 1 : 0,
        );
      return scores.vindOp(res.lastInsertRowid as number)!;
    },

    vindOp(id: number): ScoreRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_scores WHERE id = ?")
        .get(id) as ScoreRij | undefined;
      return rij ? leesScore(rij) : undefined;
    },

    /** Herziet een eigen score. De onderbouwing wordt vervangen, niet aangevuld. */
    herzie(invoer: {
      id: number;
      beoordelaarId: number;
      score: number;
      onderbouwing: string;
    }): ScoreRecord {
      const bestaand = scores.vindOp(invoer.id);
      if (!bestaand) throw new Error(`Score ${invoer.id} bestaat niet.`);
      if (bestaand.beoordelaarId !== invoer.beoordelaarId) {
        throw new Error("Een score wordt alleen herzien door de beoordelaar die haar invoerde.");
      }
      const stuk = bewijsstukken.vindOp(bestaand.bewijsstukId)!;
      const ronde = rondes.vindOp(stuk.rondeId)!;
      if (!FASEN_MET_SCOREINVOER.includes(ronde.fase)) {
        throw new Error(
          `Ronde ${ronde.codenummer} staat in fase '${ronde.fase}'; scores worden niet meer herzien.`,
        );
      }
      if (!Number.isInteger(invoer.score) || invoer.score < 0 || invoer.score > 3) {
        throw new Error("Een rubriekscore is een geheel getal van 0 tot en met 3.");
      }
      const onderbouwing = invoer.onderbouwing.trim();
      if (onderbouwing.length < 40) {
        throw new Error("Een score vraagt een onderbouwing van minstens veertig tekens.");
      }
      db.prepare(
        "UPDATE bekwaamheid_scores SET score = ?, onderbouwing = ?, ingevoerd_op = ? WHERE id = ?",
      ).run(invoer.score, onderbouwing, nu(), invoer.id);
      return scores.vindOp(invoer.id)!;
    },

    /**
     * Sluit een bewijsstuk af: middelt de scores en zet de ruwe score.
     *
     * De ruwe score is het gemiddelde over alle beoordelaars en onderdelen,
     * gedeeld door drie zodat ze op de schaal 0 tot 1 komt die de CHECK en
     * `berekenAsscores` verwachten. Kalibratiescores tellen NIET mee: die zijn
     * gezet om de beoordelaars op één lijn te krijgen en zijn geen oordeel over
     * deze kandidaat.
     */
    rondBewijsstukAf(invoer: {
      bewijsstukId: number;
      doorBeheerderId?: number | null;
    }): BewijsstukRecord {
      const stuk = bewijsstukken.vindOp(invoer.bewijsstukId);
      if (!stuk) throw new Error(`Bewijsstuk ${invoer.bewijsstukId} bestaat niet.`);
      const alle = scores.vanBewijsstuk(invoer.bewijsstukId).filter((s) => !s.isKalibratie);
      if (alle.length === 0) {
        throw new Error(`Bewijsstuk ${stuk.nummer} heeft nog geen enkele score.`);
      }
      const som = alle.reduce((t, s) => t + s.score, 0);
      const ruwe = som / alle.length / 3;
      const ronde = rondes.vindOp(stuk.rondeId)!;
      db.prepare(
        `UPDATE bekwaamheid_bewijsstukken
         SET ruwe_score = ?, status = 'beoordeeld', beoordeeld_op = ?
         WHERE id = ?`,
      ).run(ruwe, vandaag(), invoer.bewijsstukId);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_bewijsstuk_beoordeeld",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}, bewijsstuk ${stuk.nummer} afgerond op ${ruwe.toFixed(3)} uit ${alle.length} scores.`,
      });
      return bewijsstukken.vindOp(invoer.bewijsstukId)!;
    },
  };

  // -------------------------------------------------------------------------
  // Beslissingen — waar de machine een voorstel doet en een mens beslist
  // -------------------------------------------------------------------------

  /**
   * WAAROM HET VOORSTEL VAN DE MACHINE MEE DE TABEL IN GAAT.
   *
   * `voorstel_uitkomst` en `voorstel_berekening` worden vastgelegd naast de
   * definitieve uitkomst, en de CHECK `afwijking_gemotiveerd` eist een
   * motivering van minstens veertig tekens zodra die twee verschillen. Dat is
   * wat een beslissing verdedigbaar maakt: niet dat de machine gelijk kreeg,
   * maar dat na te lezen is wanneer een mens ervan afweek en waarom. Zonder die
   * vastlegging is de rekenkern decoratie.
   *
   * `voorstel_berekening` bewaart de volledige uitkomst van `beoordeel()` als
   * JSON — asscores, toegepaste regels, activiteitsroute. Bij een bezwaar over
   * een beslissing van twee jaar geleden is de vraag altijd wat de machine toen
   * zag, niet wat ze vandaag met de huidige norm zou zeggen.
   */
  const beslissingen = {
    vanRonde(rondeId: number): BeslissingRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_beslissingen WHERE ronde_id = ?")
        .get(rondeId) as BeslissingRij | undefined;
      return rij ? leesBeslissing(rij) : undefined;
    },

    vindOp(id: number): BeslissingRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_beslissingen WHERE id = ?")
        .get(id) as BeslissingRij | undefined;
      return rij ? leesBeslissing(rij) : undefined;
    },

    legVast(invoer: {
      rondeId: number;
      voorstelUitkomst: Beslisuitkomst;
      voorstelBerekening: unknown;
      definitieveUitkomst: Beslisuitkomst;
      afwijkingMotivering?: string | null;
      bekrachtigerEenId: number;
      bekrachtigerTweeId: number;
      bekrachtigdOp?: string;
      doorBeheerderId?: number | null;
    }): BeslissingRecord {
      const ronde = rondes.vindOp(invoer.rondeId);
      if (!ronde) throw new Error(`Ronde ${invoer.rondeId} bestaat niet.`);
      if (ronde.fase !== "beslissing_voorstel" && ronde.fase !== "overleg") {
        throw new Error(
          `Ronde ${ronde.codenummer} staat in fase '${ronde.fase}'; een beslissing hoort na het voorstel of na overleg.`,
        );
      }
      if (beslissingen.vanRonde(invoer.rondeId)) {
        throw new Error(`Ronde ${ronde.codenummer} heeft al een beslissing.`);
      }
      if (invoer.bekrachtigerEenId === invoer.bekrachtigerTweeId) {
        throw new Error("Een beslissing wordt door twee verschillende mensen bekrachtigd.");
      }
      const afwijkt = invoer.definitieveUitkomst !== invoer.voorstelUitkomst;
      const motivering = invoer.afwijkingMotivering?.trim() ?? null;
      if (afwijkt && (!motivering || motivering.length < 40)) {
        throw new Error(
          `De beslissing wijkt af van het voorstel ('${invoer.voorstelUitkomst}' werd '${invoer.definitieveUitkomst}'). Dat vraagt een motivering van minstens veertig tekens.`,
        );
      }
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_beslissingen
             (ronde_id, voorstel_uitkomst, voorstel_berekening, definitieve_uitkomst,
              afwijking_motivering, bekrachtiger_een_id, bekrachtiger_twee_id, bekrachtigd_op)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          invoer.rondeId,
          invoer.voorstelUitkomst,
          JSON.stringify(invoer.voorstelBerekening ?? null),
          invoer.definitieveUitkomst,
          afwijkt ? motivering : null,
          invoer.bekrachtigerEenId,
          invoer.bekrachtigerTweeId,
          (invoer.bekrachtigdOp ?? vandaag()).slice(0, 10),
        );
      rondes.verzetFase({
        id: invoer.rondeId,
        naar: "beslist",
        doorBeheerderId: invoer.doorBeheerderId,
      });
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_beslissing_vastgelegd",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: voorstel '${invoer.voorstelUitkomst}', beslissing '${invoer.definitieveUitkomst}'${afwijkt ? ` — afwijking gemotiveerd` : ""}.`,
      });
      return beslissingen.vindOp(res.lastInsertRowid as number)!;
    },

    /**
     * Legt het debriefgesprek vast en zet de ronde op `gedebrieft`.
     *
     * Publicatie kan pas hierna; de CHECK `publicatie_na_debrief` dwingt dat af.
     * De volgorde is niet administratief: niemand hoort zijn uitkomst uit een
     * document te vernemen voordat er iemand met hem over gesproken heeft.
     */
    legDebriefVast(invoer: {
      rondeId: number;
      debriefOp?: string;
      debriefDoor: number;
      doorBeheerderId?: number | null;
    }): BeslissingRecord {
      const beslissing = beslissingen.vanRonde(invoer.rondeId);
      if (!beslissing) throw new Error(`Ronde ${invoer.rondeId} heeft nog geen beslissing.`);
      if (beslissing.debriefOp) {
        throw new Error(`De debrief is al vastgelegd op ${beslissing.debriefOp}.`);
      }
      db.prepare(
        "UPDATE bekwaamheid_beslissingen SET debrief_op = ?, debrief_door = ? WHERE id = ?",
      ).run((invoer.debriefOp ?? vandaag()).slice(0, 10), invoer.debriefDoor, beslissing.id);
      const ronde = rondes.vindOp(invoer.rondeId)!;
      if (ronde.fase === "beslist") {
        rondes.verzetFase({
          id: invoer.rondeId,
          naar: "gedebrieft",
          doorBeheerderId: invoer.doorBeheerderId,
        });
      }
      return beslissingen.vanRonde(invoer.rondeId)!;
    },

    publiceer(invoer: {
      rondeId: number;
      gepubliceerdOp?: string;
      doorBeheerderId?: number | null;
    }): BeslissingRecord {
      const beslissing = beslissingen.vanRonde(invoer.rondeId);
      if (!beslissing) throw new Error(`Ronde ${invoer.rondeId} heeft nog geen beslissing.`);
      if (!beslissing.debriefOp) {
        throw new Error("Publiceren kan pas nadat het debriefgesprek is vastgelegd.");
      }
      if (beslissing.gepubliceerdOp) {
        throw new Error(`De uitkomst is al gepubliceerd op ${beslissing.gepubliceerdOp}.`);
      }
      db.prepare("UPDATE bekwaamheid_beslissingen SET gepubliceerd_op = ? WHERE id = ?").run(
        (invoer.gepubliceerdOp ?? vandaag()).slice(0, 10),
        beslissing.id,
      );
      const ronde = rondes.vindOp(invoer.rondeId)!;
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_beslissing_gepubliceerd",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: uitkomst '${beslissing.definitieveUitkomst}' gepubliceerd.`,
      });
      return beslissingen.vanRonde(invoer.rondeId)!;
    },
  };

  // -------------------------------------------------------------------------
  // Bezwaren
  // -------------------------------------------------------------------------

  /**
   * WAAROM DE STATUS TIJDENS EEN BEZWAAR ONGEWIJZIGD BLIJFT.
   *
   * De kolom `status_tijdens_bezwaar_ongewijzigd` staat standaard op waar, en
   * deze groep zet haar nergens op onwaar. Wie bezwaar maakt, mag daar niet
   * slechter van worden zolang de zaak loopt; anders is het recht om bezwaar te
   * maken een straf. De kolom bestaat als vastlegging van die belofte, niet als
   * knop.
   */
  const bezwaren = {
    vindOp(id: number): BezwaarRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_bezwaren WHERE id = ?")
        .get(id) as BezwaarRij | undefined;
      return rij ? leesBezwaar(rij) : undefined;
    },

    vanRonde(rondeId: number): BezwaarRecord[] {
      const rijen = db
        .prepare("SELECT * FROM bekwaamheid_bezwaren WHERE ronde_id = ? ORDER BY ingediend_op DESC")
        .all(rondeId) as BezwaarRij[];
      return rijen.map(leesBezwaar);
    },

    openstaand(): BezwaarRecord[] {
      const rijen = db
        .prepare("SELECT * FROM bekwaamheid_bezwaren WHERE uitspraak IS NULL ORDER BY ingediend_op")
        .all() as BezwaarRij[];
      return rijen.map(leesBezwaar);
    },

    /**
     * Neemt een bezwaar aan en zet de ronde op `bezwaar`.
     *
     * De termijn van dertig kalenderdagen wordt hier NIET getoetst. Een bezwaar
     * dat te laat komt, is een bezwaar dat te laat komt — dat is een oordeel over
     * ontvankelijkheid en dat hoort bij de behandelaar, niet bij een INSERT. Zou
     * de opslag het weigeren, dan bestond er van dat bezwaar geen spoor en kon
     * niemand nagaan dat het is afgewezen op de termijn.
     */
    dienIn(invoer: {
      rondeId: number;
      grond: string;
      ingediendOp?: string;
      doorBeheerderId?: number | null;
    }): BezwaarRecord {
      const ronde = rondes.vindOp(invoer.rondeId);
      if (!ronde) throw new Error(`Ronde ${invoer.rondeId} bestaat niet.`);
      const beslissing = beslissingen.vanRonde(invoer.rondeId);
      if (!beslissing) {
        throw new Error(
          `Ronde ${ronde.codenummer} heeft nog geen beslissing; er is niets om bezwaar tegen te maken.`,
        );
      }
      const grond = invoer.grond.trim();
      if (grond.length < 20) {
        throw new Error("Een bezwaar vraagt een grond van minstens twintig tekens.");
      }
      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_bezwaren
             (ronde_id, ingediend_op, grond, status_tijdens_bezwaar_ongewijzigd)
           VALUES (?, ?, ?, 1)`,
        )
        .run(invoer.rondeId, (invoer.ingediendOp ?? vandaag()).slice(0, 10), grond);
      if (ronde.fase === "gedebrieft" || ronde.fase === "afgesloten") {
        rondes.verzetFase({
          id: invoer.rondeId,
          naar: "bezwaar",
          doorBeheerderId: invoer.doorBeheerderId,
        });
      }
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_bezwaar_ingediend",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: bezwaar ${res.lastInsertRowid} ingediend.`,
      });
      return bezwaren.vindOp(res.lastInsertRowid as number)!;
    },

    bevestigOntvangst(invoer: { id: number; op?: string }): BezwaarRecord {
      const bezwaar = bezwaren.vindOp(invoer.id);
      if (!bezwaar) throw new Error(`Bezwaar ${invoer.id} bestaat niet.`);
      db.prepare("UPDATE bekwaamheid_bezwaren SET ontvangstbevestigd_op = ? WHERE id = ?").run(
        (invoer.op ?? vandaag()).slice(0, 10),
        invoer.id,
      );
      return bezwaren.vindOp(invoer.id)!;
    },

    /**
     * Legt de uitspraak vast.
     *
     * Bij `gegrond` of `deels_gegrond` gaat de ronde terug naar `in_beoordeling`
     * en niet naar `afgesloten`. Een gegrond bezwaar dat alleen tot een
     * aantekening leidt, is geen bezwaarrecht; de beoordeling wordt overgedaan.
     * Bij `ongegrond` sluit de ronde.
     */
    doeUitspraak(invoer: {
      id: number;
      uitspraak: Bezwaaruitspraak;
      motivering: string;
      op?: string;
      behandelaarIntern?: number | null;
      behandelaarExternOmschrijving?: string | null;
      doorBeheerderId?: number | null;
    }): BezwaarRecord {
      const bezwaar = bezwaren.vindOp(invoer.id);
      if (!bezwaar) throw new Error(`Bezwaar ${invoer.id} bestaat niet.`);
      if (bezwaar.uitspraak) {
        throw new Error(`Bezwaar ${invoer.id} heeft al een uitspraak (${bezwaar.uitspraak}).`);
      }
      const motivering = invoer.motivering.trim();
      if (motivering.length < 40) {
        throw new Error("Een uitspraak vraagt een motivering van minstens veertig tekens.");
      }
      db.prepare(
        `UPDATE bekwaamheid_bezwaren SET
           uitspraak = ?, uitspraak_op = ?, uitspraak_motivering = ?,
           behandelaar_intern = ?, behandelaar_extern_omschrijving = ?
         WHERE id = ?`,
      ).run(
        invoer.uitspraak,
        (invoer.op ?? vandaag()).slice(0, 10),
        motivering,
        invoer.behandelaarIntern ?? null,
        invoer.behandelaarExternOmschrijving ?? null,
        invoer.id,
      );
      const ronde = rondes.vindOp(bezwaar.rondeId)!;
      if (ronde.fase === "bezwaar") {
        rondes.verzetFase({
          id: bezwaar.rondeId,
          naar: invoer.uitspraak === "ongegrond" ? "afgesloten" : "in_beoordeling",
          doorBeheerderId: invoer.doorBeheerderId,
        });
      }
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_bezwaar_uitspraak",
        afnameId: null,
        detail: `Ronde ${ronde.codenummer}: bezwaar ${invoer.id} ${invoer.uitspraak}.`,
      });
      return bezwaren.vindOp(invoer.id)!;
    },
  };

  return {
    register,
    licenties,
    accreditaties,
    normprofielen,
    tellers,
    agenda,
    toetsen,
    plannen,
    items,
    itemsets,
    rondes,
    bewijsstukken,
    scores,
    beslissingen,
    bezwaren,
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
