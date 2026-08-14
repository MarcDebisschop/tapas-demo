// ---------------------------------------------------------------------------
// server/bekwaamheid/poortbrug.ts — van een verzoek naar een poortoordeel.
//
// `poort.ts` is met opzet zuiver: hij kent geen databank, geen klok en geen
// verzoek. Dat is fijn om te toetsen maar nutteloos aan een route, want iemand
// moet de zes feiten opzoeken die de poort nodig heeft. Dit bestand is die
// iemand, en verder niets:
//
//   verzoek  ->  zes feiten opzoeken  ->  beoordeelPoort()  ->  auditlog
//
// Er zit geen enkele beslissing in dit bestand. Wie wil weten waarom de poort
// weigert, leest `poort.ts`; wie wil weten waar de gegevens vandaan komen, leest
// dit. Die scheiding is de reden dat 58 tests op de poort geen databank nodig
// hebben.
//
// De brug faalt nooit hard. Loopt een opzoeking mis — een tabel die er in een
// oude omgeving nog niet is, een verbinding die hapert — dan is de uitkomst
// "niet toetsbaar" en gaat het verzoek door. Een licentiepoort die het platform
// plat legt omdat ze zelf stuk is, is erger dan geen licentiepoort.
// ---------------------------------------------------------------------------
import type BetterSqlite3 from "better-sqlite3";
import { beoordeelPoort, type Afnemer, type Handeling, type PoortUitkomst } from "./poort";
import { toegangsvlagVoorInstrument } from "./poort-platformdelen";
import { poortstandUitOmgeving, type LicentieVoorPoort, type Poortstand } from "./rechten";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { schrijfAuditLog, type AuditInvoer } from "../audit-log";
import type { Taal } from "@shared/talen";

/**
 * Wat een route al weet over wie er schrijft.
 *
 * Precies de twee velden die `verzenderVanVerzoek` teruggeeft en die op de
 * afname worden bewaard. De brug leidt daar de afnemer uit af in plaats van dat
 * elke route dat apart doet.
 */
export interface Verzender {
  aangemaaktDoorBeheerderId: number | null;
  aangemaaktDoorOrganisatieId: number | null;
}

/**
 * Leidt de afnemer af uit de twee velden op de afname.
 *
 * De volgorde is niet willekeurig. Een beheerder-id is het sterkste feit dat er
 * is: het wijst één mens aan, en een licentie is altijd die van één mens. Staat
 * er alleen een organisatie, dan is er wel een rechtspersoon maar geen
 * herleidbare persoon — dat is de leemte die in blok 2 als grond
 * `afnemer_niet_herleidbaar` is vastgelegd. Staat er niets, dan is dit het
 * zelfstartpad van een deelnemer.
 */
export function afnemerUitVerzender(verzender: Verzender): Afnemer {
  if (verzender.aangemaaktDoorBeheerderId != null) {
    return { soort: "persoon", geaccrediteerdeId: verzender.aangemaaktDoorBeheerderId };
  }
  if (verzender.aangemaaktDoorOrganisatieId != null) {
    return { soort: "organisatie", organisatieId: verzender.aangemaaktDoorOrganisatieId };
  }
  return { soort: "deelnemer" };
}

/** De toegangsvlaggen van één beheerder. */
function leesToegangen(
  db: BetterSqlite3.Database,
  beheerderId: number,
): { platformdeel: string; toegestaan: boolean }[] {
  const rijen = db
    .prepare(`SELECT platformdeel, toegestaan FROM toegangen WHERE beheerder_id = ?`)
    .all(beheerderId) as { platformdeel: string; toegestaan: number }[];
  return rijen.map((r) => ({ platformdeel: r.platformdeel, toegestaan: r.toegestaan === 1 }));
}

/**
 * Loopt er een bezwaar voor deze persoon en dit instrument?
 *
 * Een bezwaar hangt aan een ronde, niet aan een licentie, dus dit is een join.
 * Lopend betekent: ingediend en nog geen uitspraak. Zodra `uitspraak_op` gevuld
 * is, is het bezwaar afgehandeld en geldt de gewone toets weer.
 *
 * Deze vraag staat hier los omdat ze de zwaarste van de vier beloften draagt:
 * tijdens een lopend bezwaar weigert de poort nooit. Een fout hier is geen
 * schoonheidsfoutje maar een gebroken belofte, dus de query is zo kort mogelijk
 * gehouden en heeft haar eigen test.
 */
function bezwaarLoopt(
  db: BetterSqlite3.Database,
  geaccrediteerdeId: number,
  instrumentId: string,
): boolean {
  const rij = db
    .prepare(
      `SELECT 1 AS n
         FROM bekwaamheid_bezwaren b
         JOIN bekwaamheid_rondes r ON r.id = b.ronde_id
        WHERE r.geaccrediteerde_id = ?
          AND r.instrument_id = ?
          AND b.uitspraak_op IS NULL
        LIMIT 1`,
    )
    .get(geaccrediteerdeId, instrumentId) as { n: number } | undefined;
  return rij !== undefined;
}

/** De licentie in de vorm die de zuivere laag verwacht. */
function licentieVoorPoort(
  opslag: BekwaamheidOpslag,
  geaccrediteerdeId: number,
  instrumentId: string,
): LicentieVoorPoort | null {
  const rec = opslag.licenties.vind(geaccrediteerdeId, instrumentId);
  if (!rec) return null;
  return {
    instrumentId: rec.instrumentId,
    status: rec.status,
    geldigVan: rec.geldigVan,
    geldigTot: rec.geldigTot,
  };
}

export interface BrugInvoer {
  handeling: Handeling;
  instrumentId: string | null;
  verzender: Verzender;
  taal?: Taal;
  /** Het afname-id, als dat er al is. Alleen voor het auditlog. */
  afnameId?: number | null;
  /** Overschrijfbaar voor tests; standaard vandaag. */
  peildatum?: string;
  /** Overschrijfbaar voor tests; standaard uit de omgeving. */
  stand?: Poortstand;
}

export interface BrugUitkomst extends PoortUitkomst {
  /**
   * Mag het verzoek door?
   *
   * Dit is het enige veld dat een route hoeft te lezen. `toegestaan` uit de
   * zuivere laag zegt hetzelfde, maar `mag` staat er apart zodat een route nooit
   * per ongeluk `zouWeigeren` leest en daarmee in stand `log` alsnog weigert.
   * Dat is precies de fout die de hele opzet moet uitsluiten.
   */
  mag: boolean;
  /** Bewust `false` wanneer de brug zelf niet kon opzoeken. */
  toetsbaar: boolean;
}

/**
 * Het oordeel van de poort over één schrijfhandeling.
 *
 * Zoekt de zes feiten op, laat de zuivere laag beslissen, schrijft een
 * auditregel wanneer er iets te melden valt, en geeft terug of het verzoek door
 * mag. Meer doet deze functie niet: ze verstuurt geen antwoord en raakt de
 * afname niet aan.
 */
export async function beoordeelSchrijfweg(
  invoer: BrugInvoer,
  opslag: BekwaamheidOpslag = bekwaamheidOpslag,
  db: BetterSqlite3.Database = opslagDb(),
  audit: (i: AuditInvoer) => void = schrijfAuditLog,
): Promise<BrugUitkomst> {
  const stand = invoer.stand ?? poortstandUitOmgeving();
  const peildatum = invoer.peildatum ?? new Date().toISOString().slice(0, 10);
  const afnemer = afnemerUitVerzender(invoer.verzender);

  // Stand `uit` betekent uit. Dan wordt er niets opgezocht, niets gelogd en
  // niets geoordeeld — anders is "uit" een halve waarheid en draagt de poort
  // toch databanklast op elke schrijfactie.
  if (stand === "uit") {
    const u = beoordeelPoort({
      handeling: invoer.handeling,
      afnemer,
      instrumentId: invoer.instrumentId,
      platformdeelToegestaan: null,
      licentie: null,
      staatInRegister: false,
      bezwaarLoopt: false,
      peildatum,
      stand,
      taal: invoer.taal,
    });
    return { ...u, mag: true, toetsbaar: false };
  }

  let staatInRegister = false;
  let licentie: LicentieVoorPoort | null = null;
  let platformdeelToegestaan: boolean | null = null;
  let loopt = false;
  let toetsbaar = true;

  try {
    // De drie voorwaarden staan er alle drie met een reden. Een organisatie of
    // een deelnemer heeft geen persoon om iets over op te zoeken. Zonder
    // instrument is er geen licentie om te vinden. En `geaccrediteerdeId` mag
    // volgens het type `null` zijn — dat is de organisatiesessie-leemte die
    // `poort.ts` als `afnemer_niet_herleidbaar` afhandelt, en hier valt er dan
    // niets op te halen. In alle drie de gevallen blijven de feiten leeg en
    // beslist de zuivere laag verder.
    if (afnemer.soort === "persoon" && afnemer.geaccrediteerdeId != null && invoer.instrumentId) {
      const beheerderId = afnemer.geaccrediteerdeId;
      // `geaccrediteerdeId` op de afnemer is het beheerder-id uit het verzoek;
      // de geaccrediteerde is een eigen rij die daaraan gekoppeld kan zijn.
      // Bestaat die koppeling niet, dan staat de persoon niet in het register.
      const rec = opslag.register.vindOpBeheerder(beheerderId);
      staatInRegister = rec !== undefined;
      if (rec) {
        licentie = licentieVoorPoort(opslag, rec.id, invoer.instrumentId);
        loopt = bezwaarLoopt(db, rec.id, invoer.instrumentId);
      }
      platformdeelToegestaan = toegangsvlagVoorInstrument(
        invoer.instrumentId,
        leesToegangen(db, beheerderId),
      );
    }
  } catch (err) {
    // Zie de kop van dit bestand: de poort legt het platform niet plat omdat ze
    // zelf niet kan opzoeken. Wel luid in de logs, want dit hoort niet.
    console.error("[bekwaamheid/poort] opzoeken mislukt, verzoek gaat door:", err);
    return {
      ...beoordeelPoort({
        handeling: invoer.handeling,
        afnemer,
        instrumentId: invoer.instrumentId,
        platformdeelToegestaan: null,
        licentie: null,
        staatInRegister: false,
        bezwaarLoopt: true, // laat de poort er niet over oordelen
        peildatum,
        stand,
        taal: invoer.taal,
      }),
      mag: true,
      toetsbaar: false,
    };
  }

  const uitkomst = beoordeelPoort({
    handeling: invoer.handeling,
    afnemer,
    instrumentId: invoer.instrumentId,
    platformdeelToegestaan,
    licentie,
    staatInRegister,
    bezwaarLoopt: loopt,
    peildatum,
    stand,
    taal: invoer.taal,
  });

  // Belofte 4 van sectie 7.3: nooit stil falen. Ook — juist — in stand `log`,
  // want dat is de hele reden dat die stand bestaat. Twee acties, zodat de
  // nulmeting later te scheiden is van de echte weigeringen.
  if (uitkomst.zouWeigeren) {
    audit({
      adminId: invoer.verzender.aangemaaktDoorBeheerderId,
      actie: uitkomst.toegestaan ? "bekwaamheid_poort_zou_weigeren" : "bekwaamheid_poort_geweigerd",
      afnameId: invoer.afnameId ?? null,
      detail: auditdetail(invoer, uitkomst, afnemer),
    });
  }

  return { ...uitkomst, mag: uitkomst.toegestaan, toetsbaar };
}

/**
 * De auditregel in één leesbare regel.
 *
 * Geen JSON-dump: over een jaar leest een mens dit terug om te beslissen of de
 * poort naar `handhaaf` mag, en die mens moet er in één blik uit kunnen halen
 * wie wat wilde en waarom het niet kon.
 */
function auditdetail(invoer: BrugInvoer, uitkomst: PoortUitkomst, afnemer: Afnemer): string {
  const wie =
    afnemer.soort === "persoon"
      ? `beheerder ${afnemer.geaccrediteerdeId}`
      : afnemer.soort === "organisatie"
        ? `organisatie ${afnemer.organisatieId}`
        : "deelnemer (zelfstart)";
  const delen = [
    `${invoer.handeling} door ${wie}`,
    `instrument ${invoer.instrumentId ?? "(geen)"}`,
    `grond ${uitkomst.grond}`,
    `stand ${uitkomst.stand}`,
  ];
  if (uitkomst.platformdeelLeemte) delen.push("platformdeel niet afgebeeld");
  return delen.join(" | ");
}

/**
 * De databankverbinding van de opslaglaag.
 *
 * Apart gehouden zodat een test hem kan vervangen zonder de hele opslaglaag na
 * te bouwen, en zodat het duidelijk blijft dat de brug op dezelfde verbinding
 * werkt als de rest van de module.
 */
function opslagDb(): BetterSqlite3.Database {
  return bekwaamheidOpslag.verbinding();
}

/**
 * Het antwoordlichaam van een weigering.
 *
 * Sectie 7.2 van het bouwplan: een weigering is een gesprek, geen 403. Daar
 * hoort een vorm bij die op alle drie de schrijfwegen dezelfde is, want anders
 * leest een coach op het ene scherm iets anders dan op het andere terwijl er
 * hetzelfde aan de hand is.
 *
 * Vier velden. `error` staat er omdat de hele codebasis dat veld leest en een
 * afwijkende vorm alleen maar schermen stuk maakt. `grond` staat er zodat een
 * scherm op de grond kan reageren zonder de tekst te ontleden. `watNu` is de weg
 * vooruit — de belofte dat geen weigering doodloopt. `code` maakt de weigering
 * herkenbaar tussen de andere 403's.
 *
 * Geeft express niet terug maar alleen het lichaam: de brug hoort niet te weten
 * wat een response is.
 */
export function weigeringslichaam(uitkomst: BrugUitkomst): {
  error: string;
  code: "BEKWAAMHEID_POORT";
  grond: string;
  watNu: { actie: string; url: string | null };
} {
  return {
    error: uitkomst.tekst,
    code: "BEKWAAMHEID_POORT",
    grond: uitkomst.grond,
    watNu: uitkomst.watNu,
  };
}
