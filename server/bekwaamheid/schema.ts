/**
 * Het datamodel van de module Bekwaamheid.
 *
 * Veertien tabellen, allemaal met de prefix `bekwaamheid_`. Ze staan hier bij
 * elkaar en niet in `shared/schema.ts`, om dezelfde reden als bij
 * `server/traject/schema.ts`: dit is een afgebakend domein met eigen begrippen,
 * en het hoofdbestand is al lang genoeg om er niets meer bij te willen.
 *
 * Waarom het patroon van `server/traject/` wordt nagevolgd en niet hergebruikt.
 * De twee domeinen lijken op elkaar — fasen, poorten, rollen, een auditspoor —
 * maar ze betekenen niet hetzelfde. Een trajectfase is een stap in een
 * organisatieverandering; een rondefase is een stap in een beoordeling van één
 * persoon. Wie die twee in één tabel duwt, moet bij elke latere wijziging aan de
 * ene kant nadenken over de gevolgen aan de andere. De vorm wordt dus
 * overgenomen, de tabellen niet.
 *
 * Conventies van de codebasis, aangehouden:
 * - ISO-datums als `text()`, geen tijdstempels als getal, behalve waar de
 *   bestaande tabellen dat al doen;
 * - vlaggen als `integer({ mode: "boolean" })`;
 * - JSON als tekst, want SQLite kent geen JSON-kolom;
 * - controlebeperkingen (`check`) voor gesloten waardenlijsten, zodat een fout
 *   in een route niet stilletjes een onbekende status wegschrijft.
 *
 * Verwijzingen naar bestaande tabellen (`beheerders`, `organisaties`) lopen via
 * `@shared/schema`, net zoals de trajectmodule dat doet.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { beheerders } from "@shared/schema";

// ---------------------------------------------------------------------------
// Gesloten waardenlijsten
//
// Elke lijst staat één keer, wordt geëxporteerd voor de opslaglaag en de tests,
// en wordt in de tabel als controlebeperking herhaald. Die herhaling is geen
// dubbelwerk: de eerste vorm beschermt de code, de tweede beschermt de databank
// tegen code die er ooit langsheen gaat.
// ---------------------------------------------------------------------------

/** Herkomst van het bewijs waarop een accreditatie berust. */
export const BEWIJSHERKOMSTEN = ["academy", "historisch", "handmatig"] as const;
export type Bewijsherkomst = (typeof BEWIJSHERKOMSTEN)[number];

/**
 * De zeven licentiestatussen.
 *
 * Vijf volgen de uitkomstcategorieën van het draaiboek. `slapend` en
 * `overgangsperiode` zijn technisch nodig: de eerste voor wie onder de
 * activiteitsdrempel zakt zonder dat er iets mis is, de tweede voor de periode
 * vóór de eerste nulmeting, waarin niemand iets verliest.
 */
export const LICENTIESTATUSSEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "slapend",
  "opgeschort",
  "beeindigd",
  "overgangsperiode",
] as const;
export type Licentiestatus = (typeof LICENTIESTATUSSEN)[number];

/**
 * Welke statussen mogen afnemen.
 *
 * Dit is de enige plaats waar dat antwoord staat. De poort leest deze verzameling
 * en berekent niets zelf. `voorwaardelijk` staat er bewust in: een voorwaarde is
 * een opdracht met een datum, geen verbod.
 */
export const STATUSSEN_MET_AFNAMERECHT: readonly Licentiestatus[] = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "overgangsperiode",
] as const;

/** Soorten ronde. */
export const RONDESOORTEN = [
  "nulmeting",
  "bekrachtiging",
  "herkansing",
  "reactivatie",
] as const;
export type Rondesoort = (typeof RONDESOORTEN)[number];

/** Fasen van een ronde, in volgorde, plus de twee zijsporen. */
export const RONDEFASEN = [
  "voorbereiding",
  "open",
  "ingeleverd",
  "in_beoordeling",
  "beslissing_voorstel",
  "overleg",
  "beslist",
  "gedebrieft",
  "afgesloten",
  "bezwaar",
  "gestaakt",
] as const;
export type Rondefase = (typeof RONDEFASEN)[number];

/** De vier assen van het bekwaamheidsprofiel. */
export const ASSEN = ["weten", "zien", "zeggen", "zorgen"] as const;
export type As = (typeof ASSEN)[number];

/** Itemsoorten in de bank. */
export const ITEMSOORTEN = ["scenario", "meerkeuze", "juistfout", "open"] as const;
export type Itemsoort = (typeof ITEMSOORTEN)[number];

/**
 * De soorten die een machine kan nakijken.
 *
 * Bij `scenario`, `meerkeuze` en `juistfout` staat er in `sleutel` een antwoord
 * dat met het gegeven antwoord te vergelijken is. Bij `open` staat er een
 * scoringssleutel: een omschrijving van wat het antwoord moet bevatten. Dat is
 * geen vergelijking maar een beoordeling, en die hoort bij een mens.
 *
 * Deze lijst bestaat om het onderscheid één plaats te geven. Zonder deze
 * constante zou op drie plaatsen een eigen opsomming staan, en zou een zesde
 * itemsoort er stil buiten vallen.
 */
export const AUTOMATISCH_SCOORBARE_SOORTEN = [
  "scenario",
  "meerkeuze",
  "juistfout",
] as const;
export type AutomatischScoorbareSoort = (typeof AUTOMATISCH_SCOORBARE_SOORTEN)[number];

/**
 * De vijf blokken van de kennischeck, uit draaiboek §4.3.
 *
 * A Constructen · B Scoring en rapportlogica · C Grenzen · D
 * Interpretatiefouten herkennen · E Ethiek, consent en GDPR.
 *
 * De letters staan in de databank en niet de namen, om dezelfde reden waarom
 * `as` de waarde `weten` bevat en niet `Weten — kennis van het instrument`: een
 * naam die zichtbaar is voor de kandidaat mag veranderen zonder dat er een
 * migratie aan te pas komt. `BLOKNAMEN` hieronder is de leeslaag.
 */
export const KENNISCHECKBLOKKEN = ["A", "B", "C", "D", "E"] as const;
export type Kennischeckblok = (typeof KENNISCHECKBLOKKEN)[number];

/** De leesbare namen van de vijf blokken. Alleen voor weergave. */
export const BLOKNAMEN: Record<Kennischeckblok, string> = {
  A: "Constructen",
  B: "Scoring en rapportlogica",
  C: "Grenzen",
  D: "Interpretatiefouten herkennen",
  E: "Ethiek, consent en GDPR",
};

/**
 * Hoeveel items elk blok in een volledige kennischeck levert. Samen veertig.
 *
 * Deze getallen komen letterlijk uit draaiboek §4.3 en zijn geen instelling. Het
 * draaiboek geeft er een reden bij die in de code hoort te staan, omdat ze
 * anders bij de eerste krappe itembank sneuvelt:
 *
 *   "Blok C en E zijn samen 40% van de check. Dat is opzettelijk: de meeste
 *   schade in dit vak komt niet van iets niet weten, maar van iets beweren wat je
 *   niet mag beweren."
 *
 * Wie deze verdeling wil wijzigen, wijzigt de meting. Dat is een beslissing van
 * het Angoff-panel en niet van wie de bank vult. `BLOKPLAN_TOTAAL` en de
 * bijbehorende test staan er zodat een aanpassing die de som breekt, opvalt.
 */
export const BLOKPLAN: Record<Kennischeckblok, number> = {
  A: 10,
  B: 6,
  C: 8,
  D: 8,
  E: 8,
};

/** Het aantal items in een volledige kennischeck: veertig. */
export const BLOKPLAN_TOTAAL = 40;

/**
 * De verkorte kennischeck: twintig items, instrumentspecifiek.
 *
 * Draaiboek §“reactivatietraject” en de hercertificeringsronde vragen een
 * verkorte check van twintig items. De verdeling halveert het volledige plan en
 * houdt daarbij de verhouding tussen de blokken aan: A 5, B 3, C 4, D 4, E 4.
 * Blok C en E blijven samen 40%, want dat is de eis — niet het aantal.
 */
export const BLOKPLAN_VERKORT: Record<Kennischeckblok, number> = {
  A: 5,
  B: 3,
  C: 4,
  D: 4,
  E: 4,
};

/** Het aantal items in een verkorte kennischeck: twintig. */
export const BLOKPLAN_VERKORT_TOTAAL = 20;

/**
 * Waarvoor een item mag dienen.
 *
 * De overgangen zijn eenrichtingsverkeer en worden in `storage.ts` afgedwongen:
 * `meten → verbrand`, `oefenen → verbrand` en `meten → oefenen` mogen;
 * `oefenen → meten` en alles wat uit `verbrand` vertrekt, mag niet. Een item dat
 * als oefenitem is getoond, is inhoudelijk bekend; het terugpromoveren zou de
 * meting stil ondermijnen.
 */
export const ITEMGEBRUIKEN = ["oefenen", "meten", "verbrand"] as const;
export type Itemgebruik = (typeof ITEMGEBRUIKEN)[number];

/** Status van een bewijsstuk binnen een ronde. */
export const BEWIJSSTUKSTATUSSEN = ["open", "ingeleverd", "beoordeeld", "nvt"] as const;
export type Bewijsstukstatus = (typeof BEWIJSSTUKSTATUSSEN)[number];

/** De twee routes van bewijsstuk 3. */
export const BEWIJSSTUKROUTES = ["simulatie", "eigen_opname"] as const;
export type Bewijsstukroute = (typeof BEWIJSSTUKROUTES)[number];

/**
 * De gespreksfasen waarop bewijsstuk 3 wordt gescoord.
 *
 * Bewust de gespreksfase en niet de dimensie: het draaiboek onderbouwt dat met
 * het generaliseerbaarheidsverschil tussen fasegewijs en dimensiegewijs scoren.
 * Door de lijst hier vast te leggen kan dimensiescoring niet via de
 * gebruikersinterface terugsluipen.
 */
export const GESPREKSFASEN = ["opening", "kern", "wrijving", "landing"] as const;
export type Gespreksfase = (typeof GESPREKSFASEN)[number];

/**
 * Uitkomsten van een beslissing, letterlijk de vijf uit draaiboek 5.3.
 *
 * Deze lijst luidde eerder ...'voorwaardelijk', 'herkansing',
 * 'niet_bekrachtigd'. Voor die afwijking van het draaiboek stond nergens een
 * reden opgeschreven. Ze is gecorrigeerd in migratie 0007, om drie feitelijke
 * redenen:
 *
 *   1. 'herkansing' staat al in RONDESOORTEN als soort ronde. Hetzelfde woord
 *      ook als uitkomst gebruiken maakt van twee verschillende dingen een term,
 *      en juist bij een bezwaar moet ondubbelzinnig zijn wat er besloten is en
 *      wat er daarna is georganiseerd.
 *   2. 'niet_bekrachtigd' komt in het draaiboek niet voor. Het draaiboek
 *      verbiedt de woorden gezakt, afgekeurd en onvoldoende; een term die de
 *      bekrachtiging letterlijk ontkent, ligt in datzelfde register.
 *   3. 'opgeschort' en 'beeindigd' staan al in LICENTIESTATUSSEN. Een uitkomst
 *      en de licentiestatus die eruit volgt, dragen nu dezelfde naam.
 */
export const BESLISUITKOMSTEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "opgeschort",
  "beeindigd",
] as const;
export type Beslisuitkomst = (typeof BESLISUITKOMSTEN)[number];

/**
 * De uitkomsten die de machine mag voorstellen.
 *
 * 'beeindigd' ontbreekt, en dat is de kern van blok 3. Beeindiging vereist twee
 * mislukte herkansingen, weigering of een integriteitsbreuk: menselijke feiten
 * die niet in asscores zitten en die een rekenkern dus niet kan vaststellen. Ze
 * staat wel in BESLISUITKOMSTEN, want een mens moet haar definitief kunnen
 * vaststellen. Dat de machine haar nooit voorstelt, wordt afgedwongen in
 * beslisregels.ts en vastgelegd in een eigen test.
 */
export const VOORSTELBARE_UITKOMSTEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "opgeschort",
] as const;
export type VoorstelbareUitkomst = (typeof VOORSTELBARE_UITKOMSTEN)[number];

/** Uitkomsten van een tussentijdse toets. */
export const TOETSUITKOMSTEN = ["geen_signaal", "aandachtspunt", "alert"] as const;
export type Toetsuitkomst = (typeof TOETSUITKOMSTEN)[number];

/** Uitkomsten van een coachingsplan. */
export const COACHINGSPLANUITKOMSTEN = [
  "opgelost",
  "verlengd",
  "meegenomen_naar_bekrachtiging",
] as const;
export type Coachingsplanuitkomst = (typeof COACHINGSPLANUITKOMSTEN)[number];

/** Uitspraken op een bezwaar. */
export const BEZWAARUITSPRAKEN = ["gegrond", "deels_gegrond", "ongegrond"] as const;
export type Bezwaaruitspraak = (typeof BEZWAARUITSPRAKEN)[number];

/** Soorten agendapost. */
export const AGENDASOORTEN = [
  "bekrachtiging_verwacht",
  "tussentijdse_toets_verwacht",
  "coachingsplan_evaluatie",
  "voorwaarde_verloopt",
  "venster_sluit",
  "debrief_openstaand",
  "bezwaartermijn",
  "activiteit_onder_drempel",
] as const;
export type Agendasoort = (typeof AGENDASOORTEN)[number];

/** Hulp om een gesloten lijst als SQL-conditie te schrijven. */
function inLijst(kolomnaam: string, waarden: readonly string[]) {
  const lijst = waarden.map((w) => `'${w}'`).join(", ");
  return sql.raw(`"${kolomnaam}" IN (${lijst})`);
}

// ---------------------------------------------------------------------------
// 6.1 Het register
// ---------------------------------------------------------------------------

/**
 * Wie met de instrumenten mag werken.
 *
 * Deze tabel vervangt de lijst met namen die in `server/routes-stm.ts` in de
 * code stond. Waarom een eigen tabel en geen uitbreiding op `beheerders`: niet
 * elke geaccrediteerde kan inloggen, en niet elke inlogger is geaccrediteerd.
 * Die twee begrippen samenvoegen is precies hoe de bestaande verwarring is
 * ontstaan.
 *
 * Rijen worden nooit verwijderd, alleen op `actief = false` gezet. Een register
 * waaruit gewist kan worden, kan achteraf niet meer aantonen wie er ooit in
 * stond.
 */
export const bekwaamheidGeaccrediteerden = sqliteTable(
  "bekwaamheid_geaccrediteerden",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Leeg wanneer de persoon geen account heeft.
    beheerderId: integer("beheerder_id").references(() => beheerders.id),
    // Leeg wanneer de persoon niet op de publieke coachpagina staat. Geen
    // `references`: `coach_register` wordt buiten deze module beheerd en een
    // harde sleutel zou de migratievolgorde van die tabel afhankelijk maken.
    coachRegisterId: integer("coach_register_id"),
    naam: text("naam").notNull(),
    // Mag leeg zijn. Van een deel van de geaccrediteerden staat in het
    // coachregister geen adres, en een adres verzinnen om een kolomeis te halen
    // is precies hoe er negentien niet-bestaande adressen in de broncode terecht
    // zijn gekomen. Wie geen adres heeft, wordt niet aangeschreven — dat is een
    // zichtbaar tekort in het register, geen stille aanname.
    email: text("email"),
    // Bepaalt de opzegtermijn en het toepasselijk recht bij een wijziging van de
    // voorwaarden. Twee letters, ISO 3166-1 alpha-2.
    landcode: text("landcode").notNull().default("BE"),
    taal: text("taal").notNull().default("nl"),
    // Trainers gaan als eerste door de nulmeting. Zonder deze vlag is die
    // volgorde een afspraak in een document; met deze vlag is ze te controleren.
    isTrainer: integer("is_trainer", { mode: "boolean" }).notNull().default(false),
    actief: integer("actief", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (tabel) => [
    // Gedeeltelijk uniek: twee mensen mogen nooit hetzelfde adres hebben, maar
    // meerdere mensen mogen wel géén adres hebben.
    uniqueIndex("uq_bekwaamheid_geaccrediteerde_email")
      .on(tabel.email)
      .where(sql`${tabel.email} IS NOT NULL`),
    uniqueIndex("uq_bekwaamheid_geaccrediteerde_coachregister")
      .on(tabel.coachRegisterId)
      .where(sql`${tabel.coachRegisterId} IS NOT NULL`),
    index("idx_bekwaamheid_geaccrediteerde_beheerder").on(tabel.beheerderId),
    check("bekwaamheid_geaccrediteerde_landcode", sql`length(${tabel.landcode}) = 2`),
    // Iemand zonder adres én zonder koppeling naar een beheerder of naar het
    // coachregister is niet identificeerbaar en hoort niet in een register.
    check(
      "bekwaamheid_geaccrediteerde_identificeerbaar",
      sql`${tabel.email} IS NOT NULL OR ${tabel.beheerderId} IS NOT NULL OR ${tabel.coachRegisterId} IS NOT NULL`,
    ),
    check(
      "bekwaamheid_geaccrediteerde_email_niet_leeg",
      sql`${tabel.email} IS NULL OR length(trim(${tabel.email})) > 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.2 Het diploma
// ---------------------------------------------------------------------------

/**
 * Wat iemand ooit heeft behaald.
 *
 * Een accreditatie verloopt niet en wordt door geen enkele meting ingetrokken.
 * Het intrekkingsveld bestaat wel, want fraude en tuchtzaken bestaan. De
 * beslismachine mag `ingetrokkenOp` nooit schrijven; dat wordt met een test
 * vastgezet en niet met een afspraak.
 */
export const bekwaamheidAccreditaties = sqliteTable(
  "bekwaamheid_accreditaties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    niveau: integer("niveau").notNull(),
    behaaldOp: text("behaald_op").notNull(),
    // Geen harde sleutel naar `academy_opleidingen`: die tabel wordt elders
    // beheerd en veel historische accreditaties hebben er geen tegenhanger in.
    opleidingId: integer("opleiding_id"),
    bewijsHerkomst: text("bewijs_herkomst").notNull(),
    ingetrokkenOp: text("ingetrokken_op"),
    ingetrokkenReden: text("ingetrokken_reden"),
  },
  (tabel) => [
    index("idx_bekwaamheid_accreditatie_persoon").on(tabel.geaccrediteerdeId),
    uniqueIndex("uq_bekwaamheid_accreditatie_instrument").on(
      tabel.geaccrediteerdeId,
      tabel.instrumentId,
      tabel.niveau,
    ),
    check("bekwaamheid_accreditatie_herkomst", inLijst("bewijs_herkomst", BEWIJSHERKOMSTEN)),
    // Een intrekking zonder reden is niet te verantwoorden; een reden zonder
    // datum maakt niet duidelijk wanneer de intrekking begon.
    check(
      "bekwaamheid_accreditatie_intrekking_volledig",
      sql`(${tabel.ingetrokkenOp} IS NULL AND ${tabel.ingetrokkenReden} IS NULL)
          OR (${tabel.ingetrokkenOp} IS NOT NULL AND ${tabel.ingetrokkenReden} IS NOT NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.4 De bevroren cesuur (vóór 6.3, omdat de licentie ernaar kan verwijzen)
// ---------------------------------------------------------------------------

/**
 * De norm waartegen een ronde is beoordeeld.
 *
 * Bevriezing wordt in de opslaglaag afgedwongen: een wijziging op een rij met
 * `bevrorenOp != null` gooit. Een nieuwe cesuur is een nieuwe versie. Dat is wat
 * bij een bezwaar nodig is: aantoonbaar tegen welke norm iemand op die dag is
 * beoordeeld, en niet tegen de norm zoals die vandaag geldt.
 */
export const bekwaamheidNormprofielen = sqliteTable(
  "bekwaamheid_normprofielen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrumentId: text("instrument_id").notNull(),
    versie: integer("versie").notNull(),
    // JSON: { "weten": 0.20, "zien": 0.30, "zeggen": 0.30, "zorgen": 0.20 }
    weging: text("weging").notNull(),
    drempelTotaal: real("drempel_totaal").notNull(),
    // JSON per as, zelfde sleutels als `weging`.
    drempelPerAs: text("drempel_per_as").notNull(),
    activiteitsdrempel: integer("activiteitsdrempel").notNull(),
    activiteitsvensterMaanden: integer("activiteitsvenster_maanden").notNull(),
    methode: text("methode").notNull(),
    // Samenstelling van het cesuurpanel, zonder namen van externen.
    paneelOmschrijving: text("paneel_omschrijving").notNull(),
    vastgesteldOp: text("vastgesteld_op").notNull(),
    vastgesteldDoor: text("vastgesteld_door").notNull(),
    bevrorenOp: text("bevroren_op"),
    onderbouwing: text("onderbouwing").notNull(),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_normprofiel_versie").on(tabel.instrumentId, tabel.versie),
    check("bekwaamheid_normprofiel_versie_positief", sql`${tabel.versie} >= 1`),
    check(
      "bekwaamheid_normprofiel_drempel_bereik",
      sql`${tabel.drempelTotaal} > 0 AND ${tabel.drempelTotaal} <= 1`,
    ),
    // Een cesuur zonder onderbouwing is een getal zonder herkomst. De grens van
    // 200 tekens is geen kwaliteitsmaat maar een drempel tegen "n.v.t.".
    check("bekwaamheid_normprofiel_onderbouwing_lengte", sql`length(${tabel.onderbouwing}) >= 200`),
  ],
);

// ---------------------------------------------------------------------------
// 6.3 Het recht
// ---------------------------------------------------------------------------

/**
 * Wat de poort leest: één rij per geaccrediteerde per instrument.
 *
 * De naam `bekwaamheid_licenties` en niet `licenties`: die tabelnaam is in
 * `shared/schema.ts` al bezet door de commerciële licenties van T4Recruitment.
 * Hergebruik zou twee onverwante begrippen op één naam zetten.
 *
 * De cyclus staat als twee data in deze tabel en niet als één: bij elke
 * bekrachtiging worden `volgendeBekrachtiging` (24 maanden) en
 * `volgendeTussentijdseToets` (12 maanden) samen gezet. Een termijn die pas
 * berekend wordt wanneer iemand eraan denkt, is de termijn die vergeten wordt.
 *
 * `alertActief` is zichtbaar maar niet blokkerend. Een openstaande alert uit een
 * tussentijdse toets verandert de status niet en sluit de poort niet.
 */
export const bekwaamheidLicenties = sqliteTable(
  "bekwaamheid_licenties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    status: text("status").notNull(),
    geldigVan: text("geldig_van").notNull(),
    // Leeg betekent onbepaald. Dat komt alleen voor tijdens de
    // overgangsperiode, vóór de eerste nulmeting.
    geldigTot: text("geldig_tot"),
    laatsteBekrachtiging: text("laatste_bekrachtiging"),
    volgendeBekrachtiging: text("volgende_bekrachtiging"),
    volgendeTussentijdseToets: text("volgende_tussentijdse_toets"),
    alertActief: integer("alert_actief", { mode: "boolean" }).notNull().default(false),
    voorwaardeTekst: text("voorwaarde_tekst"),
    voorwaardeVoor: text("voorwaarde_voor"),
    // Geen harde sleutel: de beslissingentabel verwijst zelf naar de ronde en
    // een wederzijdse harde sleutel maakt de eerste rij onaanmaakbaar.
    bronBeslissingId: integer("bron_beslissing_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_licentie_instrument").on(
      tabel.geaccrediteerdeId,
      tabel.instrumentId,
    ),
    index("idx_bekwaamheid_licentie_status").on(tabel.status),
    index("idx_bekwaamheid_licentie_volgende_toets").on(tabel.volgendeTussentijdseToets),
    check("bekwaamheid_licentie_status", inLijst("status", LICENTIESTATUSSEN)),
    // Een voorwaardelijke licentie zonder opdracht en zonder datum is geen
    // voorwaarde maar een onduidelijkheid.
    check(
      "bekwaamheid_licentie_voorwaarde_volledig",
      sql`${tabel.status} <> 'voorwaardelijk'
          OR (${tabel.voorwaardeTekst} IS NOT NULL AND ${tabel.voorwaardeVoor} IS NOT NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.5 Het dossier
// ---------------------------------------------------------------------------

/**
 * Eén volledige beoordeling van één persoon voor één instrument.
 *
 * `codenummer` is het blinderingsnummer en het enige wat de beoordelaar van
 * bewijsstuk 2 ziet. Nooit een naam, nooit initialen, nooit een jaartal dat
 * herleidbaar is. Het wordt willekeurig getrokken, in hetzelfde patroon als
 * `afnames.bezitsToken`.
 *
 * `aanpassingenReden` bevat de aanpassing en niet de oorzaak. Een medische reden
 * hoort niet in dit dossier en er is nergens een veld voor.
 */
export const bekwaamheidRondes = sqliteTable(
  "bekwaamheid_rondes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    normprofielId: integer("normprofiel_id")
      .notNull()
      .references(() => bekwaamheidNormprofielen.id),
    soort: text("soort").notNull(),
    codenummer: text("codenummer").notNull(),
    fase: text("fase").notNull().default("voorbereiding"),
    geopendOp: text("geopend_op").notNull(),
    // Uiterste inleverdatum van de bewijsstukken.
    vensterTot: text("venster_tot").notNull(),
    afgerondOp: text("afgerond_op"),
    // JSON met toegekende redelijke aanpassingen, bv. extra tijd.
    aanpassingen: text("aanpassingen"),
    aanpassingenReden: text("aanpassingen_reden"),
    notitieIntern: text("notitie_intern"),
    // Verwerkingscontext, in hetzelfde patroon als `afnames`: doel, rechtsgrond
    // en de versie van de privacyverklaring die de betrokkene zag.
    verwerkingsdoel: text("verwerkingsdoel").notNull().default("bekwaamheidsbeoordeling"),
    rechtsgrond: text("rechtsgrond").notNull().default("overeenkomst"),
    privacyverklaringVersie: text("privacyverklaring_versie"),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_ronde_codenummer").on(tabel.codenummer),
    index("idx_bekwaamheid_ronde_persoon").on(tabel.geaccrediteerdeId),
    index("idx_bekwaamheid_ronde_fase").on(tabel.fase),
    check("bekwaamheid_ronde_soort", inLijst("soort", RONDESOORTEN)),
    check("bekwaamheid_ronde_fase", inLijst("fase", RONDEFASEN)),
  ],
);

// ---------------------------------------------------------------------------
// 6.6 De itembank
// ---------------------------------------------------------------------------

export const bekwaamheidItems = sqliteTable(
  "bekwaamheid_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrumentId: text("instrument_id").notNull(),
    as: text("as").notNull(),
    // Het kennischeckblok, of leeg. Leeg betekent precies één ding: dit item
    // hoort niet in de blokstructuur van de kennischeck. Zie migratie
    // 0008_itemblokken voor waarom de kolom er is en waarom hij leeg mag zijn.
    blok: text("blok"),
    soort: text("soort").notNull(),
    stam: text("stam").notNull(),
    // JSON-lijst met antwoordmogelijkheden; leeg bij open items.
    opties: text("opties"),
    sleutel: text("sleutel").notNull(),
    toelichtingGoed: text("toelichting_goed").notNull(),
    toelichtingFout: text("toelichting_fout").notNull(),
    gebruik: text("gebruik").notNull().default("oefenen"),
    versie: integer("versie").notNull().default(1),
    actief: integer("actief", { mode: "boolean" }).notNull().default(true),
    // Itemmoeilijkheid en itemdiscriminatie: leeg tot er itemanalyse is. Leeg
    // laten is eerlijker dan een geschat getal dat later voor een bevinding
    // wordt aangezien.
    pWaarde: real("p_waarde"),
    discriminatie: real("discriminatie"),
    bronVerwijzing: text("bron_verwijzing"),
  },
  (tabel) => [
    index("idx_bekwaamheid_item_instrument").on(tabel.instrumentId, tabel.as, tabel.blok),
    index("idx_bekwaamheid_item_gebruik").on(tabel.gebruik),
    check("bekwaamheid_item_as", inLijst("as", ASSEN)),
    check("bekwaamheid_item_soort", inLijst("soort", ITEMSOORTEN)),
    check("bekwaamheid_item_gebruik", inLijst("gebruik", ITEMGEBRUIKEN)),
    check(
      "bekwaamheid_item_blok",
      sql`${tabel.blok} IS NULL OR ${inLijst("blok", KENNISCHECKBLOKKEN)}`,
    ),
    // Blok A tot E is de indeling van de kennischeck, en de kennischeck meet de
    // as WETEN. Een blok-D-item op de as ZORGEN zou in geen enkele check
    // terechtkomen en toch als blokdekking meetellen.
    check("bekwaamheid_item_blok_alleen_weten", sql`${tabel.blok} IS NULL OR ${tabel.as} = 'weten'`),
  ],
);

// ---------------------------------------------------------------------------
// 6.7 De vijf metingen per ronde
// ---------------------------------------------------------------------------

/**
 * `opnameVerklaring` is het compromis rond bewijsstuk 3: er komt nergens een
 * uploadveld voor opnames van teruggavegesprekken, in geen enkele vorm. Wat
 * blijft is de verklaring van de beoordelaar dat het gesprek is bekeken en niet
 * bewaard.
 */
export const bekwaamheidBewijsstukken = sqliteTable(
  "bekwaamheid_bewijsstukken",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rondeId: integer("ronde_id")
      .notNull()
      .references(() => bekwaamheidRondes.id),
    nummer: integer("nummer").notNull(),
    as: text("as").notNull(),
    // Overgenomen uit het normprofiel op het moment van openen, niet
    // herberekend: een gewijzigde weging mag een lopende ronde niet raken.
    weging: real("weging").notNull(),
    status: text("status").notNull().default("open"),
    ruweScore: real("ruwe_score"),
    itemsetId: integer("itemset_id"),
    route: text("route"),
    opnameVerklaring: integer("opname_verklaring", { mode: "boolean" })
      .notNull()
      .default(false),
    ingeleverdOp: text("ingeleverd_op"),
    beoordeeldOp: text("beoordeeld_op"),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_bewijsstuk_nummer").on(tabel.rondeId, tabel.nummer),
    check("bekwaamheid_bewijsstuk_nummer_bereik", sql`${tabel.nummer} BETWEEN 1 AND 5`),
    check("bekwaamheid_bewijsstuk_as", inLijst("as", ASSEN)),
    check("bekwaamheid_bewijsstuk_status", inLijst("status", BEWIJSSTUKSTATUSSEN)),
    check(
      "bekwaamheid_bewijsstuk_route",
      sql`${tabel.route} IS NULL OR ${inLijst("route", BEWIJSSTUKROUTES)}`,
    ),
    check(
      "bekwaamheid_bewijsstuk_score_bereik",
      sql`${tabel.ruweScore} IS NULL OR (${tabel.ruweScore} >= 0 AND ${tabel.ruweScore} <= 1)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.8 Wat deze persoon precies kreeg
// ---------------------------------------------------------------------------

/**
 * Bij een bezwaar moet exact te reproduceren zijn welke items iemand kreeg, in
 * welke volgorde en hoe lang hij erover deed. Zonder deze tabel is een bezwaar
 * niet te behandelen.
 */
export const bekwaamheidItemsets = sqliteTable(
  "bekwaamheid_itemsets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rondeId: integer("ronde_id")
      .notNull()
      .references(() => bekwaamheidRondes.id),
    bewijsstukNummer: integer("bewijsstuk_nummer").notNull(),
    // JSON-lijst met item-ids, in de volgorde zoals aangeboden.
    itemIds: text("item_ids").notNull(),
    antwoorden: text("antwoorden"),
    // Zelfde patroon als `afnames.itemTijden`: object van item-id naar
    // milliseconden.
    itemTijden: text("item_tijden"),
    samengesteldOp: text("samengesteld_op").notNull(),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_itemset_bewijsstuk").on(tabel.rondeId, tabel.bewijsstukNummer),
    check(
      "bekwaamheid_itemset_bewijsstuk_bereik",
      sql`${tabel.bewijsstukNummer} BETWEEN 1 AND 5`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.9 De rubriekinvoer
// ---------------------------------------------------------------------------

/**
 * Eén rij per beoordelaar per rubriekonderdeel. Meerdere beoordelaars per
 * bewijsstuk is het normale geval en geen uitzondering.
 *
 * De onderbouwing is verplicht en minimaal veertig tekens. Dat is geen
 * bureaucratie: het is wat de debrief bruikbaar maakt en wat een bezwaar kan
 * doorstaan. Kalibratie-invoer telt niet mee in de beslissing.
 */
export const bekwaamheidScores = sqliteTable(
  "bekwaamheid_scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bewijsstukId: integer("bewijsstuk_id")
      .notNull()
      .references(() => bekwaamheidBewijsstukken.id),
    beoordelaarId: integer("beoordelaar_id").notNull(),
    onderdeel: text("onderdeel").notNull(),
    score: integer("score").notNull(),
    onderbouwing: text("onderbouwing").notNull(),
    ingevoerdOp: text("ingevoerd_op").notNull(),
    isKalibratie: integer("is_kalibratie", { mode: "boolean" }).notNull().default(false),
  },
  (tabel) => [
    index("idx_bekwaamheid_score_bewijsstuk").on(tabel.bewijsstukId),
    uniqueIndex("uq_bekwaamheid_score_invoer").on(
      tabel.bewijsstukId,
      tabel.beoordelaarId,
      tabel.onderdeel,
    ),
    check("bekwaamheid_score_onderbouwing_lengte", sql`length(${tabel.onderbouwing}) >= 40`),
  ],
);

// ---------------------------------------------------------------------------
// 6.10 De uitkomst
// ---------------------------------------------------------------------------

/**
 * Precies één beslissing per ronde.
 *
 * Twee regels staan in de databank en niet in de gebruikersinterface:
 * 1. `gepubliceerdOp` kan niet worden gezet zolang `debriefOp` leeg is. Nooit
 *    een uitslag per mail voordat ze live is besproken.
 * 2. de twee bekrachtigers moeten verschillen, en geen van beide mag in deze
 *    ronde beoordelaar zijn geweest — dat tweede is een regel in de opslaglaag,
 *    want de databank kent de beoordelaars van de ronde niet in deze rij.
 */
export const bekwaamheidBeslissingen = sqliteTable(
  "bekwaamheid_beslissingen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rondeId: integer("ronde_id")
      .notNull()
      .references(() => bekwaamheidRondes.id),
    voorstelUitkomst: text("voorstel_uitkomst").notNull(),
    // JSON: asscores, totaal en welke regel bindend was.
    voorstelBerekening: text("voorstel_berekening").notNull(),
    definitieveUitkomst: text("definitieve_uitkomst").notNull(),
    afwijkingMotivering: text("afwijking_motivering"),
    bekrachtigerEenId: integer("bekrachtiger_een_id").notNull(),
    bekrachtigerTweeId: integer("bekrachtiger_twee_id").notNull(),
    bekrachtigdOp: text("bekrachtigd_op").notNull(),
    gepubliceerdOp: text("gepubliceerd_op"),
    debriefOp: text("debrief_op"),
    debriefDoor: integer("debrief_door"),
  },
  (tabel) => [
    uniqueIndex("uq_bekwaamheid_beslissing_ronde").on(tabel.rondeId),
    check("bekwaamheid_beslissing_voorstel", inLijst("voorstel_uitkomst", BESLISUITKOMSTEN)),
    check("bekwaamheid_beslissing_definitief", inLijst("definitieve_uitkomst", BESLISUITKOMSTEN)),
    check(
      "bekwaamheid_beslissing_bekrachtigers_verschillen",
      sql`${tabel.bekrachtigerEenId} <> ${tabel.bekrachtigerTweeId}`,
    ),
    check(
      "bekwaamheid_beslissing_afwijking_gemotiveerd",
      sql`${tabel.definitieveUitkomst} = ${tabel.voorstelUitkomst}
          OR (${tabel.afwijkingMotivering} IS NOT NULL AND length(${tabel.afwijkingMotivering}) >= 40)`,
    ),
    check(
      "bekwaamheid_beslissing_publicatie_na_debrief",
      sql`${tabel.gepubliceerdOp} IS NULL OR ${tabel.debriefOp} IS NOT NULL`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.11 Het moment na twaalf maanden
// ---------------------------------------------------------------------------

/**
 * Het tussentijdse controlemoment halverwege de cyclus van twee jaar.
 *
 * Geen halve bekrachtiging en geen tweede meting. Het leest drie signalen die
 * het platform al kent, en het heeft één uitkomst met gevolg: een alert, die om
 * een coachingsplan vraagt.
 *
 * 1. aantal afnames over twaalf maanden, geteld op `afnames`, drempel drie —
 *    de helft van de tweejaarsdrempel, berekend en niet apart gezet;
 * 2. de oefensessies: het gemiddelde over hetzelfde venster, dat aanslaat bij
 *    een gemiddelde onder de ondergrens of bij nul afgeronde sessies;
 * 3. het coachingsplan, dat geen signaal is maar een gevolg.
 *
 * Uitkomstregel: geen signaal → `geen_signaal`; één → `aandachtspunt`; twee of
 * meer → `alert`. Een alert sluit de poort nooit en verandert de licentiestatus
 * nooit.
 *
 * Signaal 2 doorbreekt de scheiding tussen oefenen en meten. Drie voorwaarden
 * beperken de schade en zijn niet optioneel: het meekijken wordt vooraf
 * aangekondigd, er wordt alleen naar het aggregaat per laag gekeken, en een laag
 * oefengemiddelde levert op zichzelf nooit meer dan een aandachtspunt op.
 */
export const bekwaamheidTussentijdseToetsen = sqliteTable(
  "bekwaamheid_tussentijdse_toetsen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    licentieId: integer("licentie_id")
      .notNull()
      .references(() => bekwaamheidLicenties.id),
    peildatum: text("peildatum").notNull(),
    vensterVan: text("venster_van").notNull(),
    vensterTot: text("venster_tot").notNull(),
    afnamesAantal: integer("afnames_aantal").notNull(),
    afnamesDrempel: integer("afnames_drempel").notNull(),
    stmSessies: integer("stm_sessies").notNull(),
    // Leeg wanneer er geen afgeronde sessies in het venster zijn. Nul zou hier
    // een score suggereren die niemand heeft gehaald.
    stmGemiddelde: real("stm_gemiddelde"),
    // JSON: gemiddelde per laag, uitsluitend voor het gesprek.
    stmPerLaag: text("stm_per_laag"),
    // JSON-lijst: welke signalen aansloegen, met de gelezen waarde erbij.
    signalen: text("signalen").notNull(),
    /**
     * Leeg tot een mens de uitkomst vaststelt. Zou hier de berekening al staan,
     * dan draagt een voorbereide toets een uitkomst die niemand heeft
     * vastgesteld, en dan is elke lezer die `vastgesteldOp` vergeet te
     * controleren één vergissing verwijderd van een geautomatiseerd oordeel.
     */
    uitkomst: text("uitkomst"),
    berekendeUitkomst: text("berekende_uitkomst").notNull(),
    afwijkingMotivering: text("afwijking_motivering"),
    vastgesteldDoor: integer("vastgesteld_door"),
    vastgesteldOp: text("vastgesteld_op"),
    besprokenOp: text("besproken_op"),
    gepubliceerdOp: text("gepubliceerd_op"),
    coachingsplanId: integer("coachingsplan_id"),
  },
  (tabel) => [
    index("idx_bekwaamheid_toets_persoon").on(tabel.geaccrediteerdeId),
    index("idx_bekwaamheid_toets_licentie").on(tabel.licentieId),
    check(
      "bekwaamheid_toets_uitkomst",
      sql`${tabel.uitkomst} IS NULL OR ${inLijst("uitkomst", TOETSUITKOMSTEN)}`,
    ),
    check("bekwaamheid_toets_berekend", inLijst("berekende_uitkomst", TOETSUITKOMSTEN)),
    // Vaststellen en uitkomst gaan samen: het één zonder het ander laat niet zien
    // wie er verantwoordelijk voor is.
    check(
      "bekwaamheid_toets_vaststelling_volledig",
      sql`(${tabel.vastgesteldOp} IS NULL AND ${tabel.uitkomst} IS NULL)
          OR (${tabel.vastgesteldOp} IS NOT NULL AND ${tabel.uitkomst} IS NOT NULL)`,
    ),
    check(
      "bekwaamheid_toets_afwijking_gemotiveerd",
      sql`${tabel.uitkomst} IS NULL
          OR ${tabel.uitkomst} = ${tabel.berekendeUitkomst}
          OR (${tabel.afwijkingMotivering} IS NOT NULL AND length(${tabel.afwijkingMotivering}) >= 40)`,
    ),
    // Zelfde belofte als bij de beslissing: eerst het gesprek, dan de publicatie.
    check(
      "bekwaamheid_toets_publicatie_na_gesprek",
      sql`${tabel.gepubliceerdOp} IS NULL OR ${tabel.besprokenOp} IS NOT NULL`,
    ),
    // Bij een alert hoort een plan. De opslaglaag dwingt af dat het plan bestaat
    // vóór de toets wordt afgesloten; de databank dwingt hier af dat een
    // vastgestelde alert niet zonder verwijzing kan blijven staan.
    check(
      "bekwaamheid_toets_alert_heeft_plan",
      sql`${tabel.uitkomst} IS NULL
          OR ${tabel.uitkomst} <> 'alert'
          OR ${tabel.vastgesteldOp} IS NULL
          OR ${tabel.coachingsplanId} IS NOT NULL`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.12 Het coachingsplan
// ---------------------------------------------------------------------------

/**
 * Wat er na een alert gebeurt.
 *
 * `uitkomst` is de reden dat dit een tabel is en geen tekstveld: wat bij de
 * tussentijdse toets is afgesproken, moet bij de bekrachtiging twaalf maanden
 * later terugkomen. Zonder dat veld is het een gesprek zonder vervolg.
 *
 * `akkoordGeaccrediteerdeOp` is niet optioneel in de praktijk: een plan zonder
 * akkoord van de betrokkene is geen plan. De opslaglaag weigert een afsluiting
 * zonder dat akkoord.
 */
export const bekwaamheidCoachingsplannen = sqliteTable(
  "bekwaamheid_coachingsplannen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    tussentijdseToetsId: integer("tussentijdse_toets_id")
      .notNull()
      .references(() => bekwaamheidTussentijdseToetsen.id),
    aanleiding: text("aanleiding").notNull(),
    doel: text("doel").notNull(),
    // JSON-lijst: concrete stappen met data.
    afspraken: text("afspraken").notNull(),
    begeleiderId: integer("begeleider_id"),
    opgesteldOp: text("opgesteld_op").notNull(),
    opgesteldDoor: integer("opgesteld_door"),
    akkoordGeaccrediteerdeOp: text("akkoord_geaccrediteerde_op"),
    evaluatieOp: text("evaluatie_op").notNull(),
    afgeslotenOp: text("afgesloten_op"),
    uitkomst: text("uitkomst"),
  },
  (tabel) => [
    index("idx_bekwaamheid_plan_persoon").on(tabel.geaccrediteerdeId),
    uniqueIndex("uq_bekwaamheid_plan_toets").on(tabel.tussentijdseToetsId),
    check(
      "bekwaamheid_plan_uitkomst",
      sql`${tabel.uitkomst} IS NULL OR ${inLijst("uitkomst", COACHINGSPLANUITKOMSTEN)}`,
    ),
    // Afgesloten zonder uitkomst laat de vraag open wat er is gebeurd.
    check(
      "bekwaamheid_plan_afsluiting_volledig",
      sql`(${tabel.afgeslotenOp} IS NULL AND ${tabel.uitkomst} IS NULL)
          OR (${tabel.afgeslotenOp} IS NOT NULL AND ${tabel.uitkomst} IS NOT NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6.13 Bezwaren en agenda
// ---------------------------------------------------------------------------

/**
 * Alleen de uitspraak, niet het gesprek.
 *
 * De inhoudelijke behandeling van een bezwaar gebeurt buiten het platform. Wat
 * hier staat, is de termijn, de grond, wie behandelde en wat eruit kwam.
 * `statusTijdensBezwaarOngewijzigd` legt vast dat een lopend bezwaar de
 * licentiestatus niet raakt.
 */
export const bekwaamheidBezwaren = sqliteTable(
  "bekwaamheid_bezwaren",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rondeId: integer("ronde_id")
      .notNull()
      .references(() => bekwaamheidRondes.id),
    ingediendOp: text("ingediend_op").notNull(),
    grond: text("grond").notNull(),
    ontvangstbevestigdOp: text("ontvangstbevestigd_op"),
    behandelaarIntern: integer("behandelaar_intern"),
    // De externe behandelaar heeft geen account; enkel een omschrijving van rol
    // en onafhankelijkheid, geen persoonsgegevens meer dan nodig.
    behandelaarExternOmschrijving: text("behandelaar_extern_omschrijving"),
    uitspraakOp: text("uitspraak_op"),
    uitspraak: text("uitspraak"),
    uitspraakMotivering: text("uitspraak_motivering"),
    statusTijdensBezwaarOngewijzigd: integer("status_tijdens_bezwaar_ongewijzigd", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
  },
  (tabel) => [
    index("idx_bekwaamheid_bezwaar_ronde").on(tabel.rondeId),
    check(
      "bekwaamheid_bezwaar_uitspraak",
      sql`${tabel.uitspraak} IS NULL OR ${inLijst("uitspraak", BEZWAARUITSPRAKEN)}`,
    ),
    check(
      "bekwaamheid_bezwaar_uitspraak_volledig",
      sql`(${tabel.uitspraak} IS NULL AND ${tabel.uitspraakOp} IS NULL)
          OR (${tabel.uitspraak} IS NOT NULL AND ${tabel.uitspraakOp} IS NOT NULL
              AND ${tabel.uitspraakMotivering} IS NOT NULL)`,
    ),
  ],
);

/**
 * De reden dat een termijn niet opnieuw vergeten wordt.
 *
 * Een dagelijkse taak leest deze tabel, in hetzelfde patroon als
 * `server/bewaartermijn-job.ts`, dat al op een intervalvariabele draait.
 */
export const bekwaamheidAgenda = sqliteTable(
  "bekwaamheid_agenda",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    geaccrediteerdeId: integer("geaccrediteerde_id")
      .notNull()
      .references(() => bekwaamheidGeaccrediteerden.id),
    instrumentId: text("instrument_id").notNull(),
    soort: text("soort").notNull(),
    datum: text("datum").notNull(),
    afgehandeldOp: text("afgehandeld_op"),
    // JSON-lijst met momenten waarop een herinnering is verstuurd.
    herinneringVerstuurdOp: text("herinnering_verstuurd_op"),
  },
  (tabel) => [
    index("idx_bekwaamheid_agenda_datum").on(tabel.datum),
    uniqueIndex("uq_bekwaamheid_agenda_post").on(
      tabel.geaccrediteerdeId,
      tabel.instrumentId,
      tabel.soort,
      tabel.datum,
    ),
    check("bekwaamheid_agenda_soort", inLijst("soort", AGENDASOORTEN)),
  ],
);

// ---------------------------------------------------------------------------
// Afgeleide typen
// ---------------------------------------------------------------------------

export type Geaccrediteerde = typeof bekwaamheidGeaccrediteerden.$inferSelect;
export type NieuweGeaccrediteerde = typeof bekwaamheidGeaccrediteerden.$inferInsert;
export type Accreditatie = typeof bekwaamheidAccreditaties.$inferSelect;
export type Licentie = typeof bekwaamheidLicenties.$inferSelect;
export type Normprofiel = typeof bekwaamheidNormprofielen.$inferSelect;
export type Ronde = typeof bekwaamheidRondes.$inferSelect;
export type Item = typeof bekwaamheidItems.$inferSelect;
export type Bewijsstuk = typeof bekwaamheidBewijsstukken.$inferSelect;
export type Itemset = typeof bekwaamheidItemsets.$inferSelect;
export type Score = typeof bekwaamheidScores.$inferSelect;
export type Beslissing = typeof bekwaamheidBeslissingen.$inferSelect;
export type TussentijdseToets = typeof bekwaamheidTussentijdseToetsen.$inferSelect;
export type Coachingsplan = typeof bekwaamheidCoachingsplannen.$inferSelect;
export type Bezwaar = typeof bekwaamheidBezwaren.$inferSelect;
export type Agendapost = typeof bekwaamheidAgenda.$inferSelect;
