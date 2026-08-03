// ---------------------------------------------------------------------------
// server/t4students/rapport-contract.ts
//
// Wat er op elk blad van het T4Students-rapport komt te staan, als gegevens.
// Dit bestand tekent niets. Het zet de uitkomst van de scoringsmotor en de
// letterlijke antwoorden van de student om in een lijst pagina's met blokken;
// server/t4students/rapport-pdf.ts tekent die blokken.
//
// DE INDELING KOMT UIT DE BLAUWDRUK
// Hoofdstuk 5.1 van blauwdruk-t4students-rapport.md legt zevenentwintig
// pagina's vast en zegt per pagina of ze ook in de Basis hoort. Die tabel staat
// hieronder in PAGINAPLAN, in dezelfde volgorde en met dezelfde titels.
//
// GEEN TWEEDE NAMENLIJST
// Een constructnaam wordt nergens in dit bestand uitgeschreven als losse
// letterlijke tekst. Elke naam die op papier komt, is een sleutel die uit
// instrument.families komt of uit de uitvoer van de motor, die op haar beurt
// diezelfde sleutels doorgeeft. Wie een naam wil wijzigen, wijzigt hem in
// server/data/t4students.json en nergens anders.
// tests/t4students-geen-vertaaltabel.test.ts zakt zodra dat niet meer klopt.
//
// HERKENNING WORDT GESCHAALD, EN WAAROM
// De motor telt de herkenning van een construct op als een som: het eigen
// herkenningsitem van 0 tot 3, plus de ladingen van de situatie-items die dat
// construct raken. Die som loopt daardoor niet voor elk construct even ver.
// Impact kan hoogstens 3 halen, Groepsondersteunend hoogstens 5. Wie die sommen
// naast elkaar in een rangorde zet, zet ongelijke maten naast elkaar.
// Het rapport schaalt daarom elke som naar de schaal van 0 tot 3 die de student
// zelf op het scherm zag, door te delen door het hoogst haalbare van dat
// construct. Dat hoogst haalbare wordt hier uit het instrument gerekend en
// staat nergens met de hand ingetypt. De rangorde op papier volgt die
// geschaalde herkenning. Dit is een keuze van de rapportlaag; de motor blijft
// onaangeroerd en houdt haar eigen ongeschaalde volgorde. Het verschil tussen
// de twee wordt bij elke render gemeten en staat in het verslag.
//
// GEEN HALF OORDEEL
// Beslissing van de opdrachtgever van 2026-08-02: ontbreekt binnen een construct
// ook maar een antwoord, dan krijgt dat construct geen score en geen rangnummer,
// maar de melding dat er te weinig antwoorden zijn. De motor kent die regel per
// construct niet: haar recognition blijft een som die ook zonder antwoorden een
// getal is. Daarom wordt de volledigheid hier per construct bepaald, uit het
// instrument en de antwoorden, en niet uit de uitvoer van de motor.
// ---------------------------------------------------------------------------

import duidingsBestand from "../data/t4students-duidingsteksten.json";
import omschrijvingenBestand from "../data/t4students-omschrijvingen.json";
import type { T4SInstrument, T4SItem, T4SVertaalbaar } from "./instrument";
import type { T4SAntwoorden, T4SResultaat } from "./kompas-scoring";
import { itemIndex, voedingPerConstruct, type T4SVoeding } from "./voeding";

// itemIndex en voedingPerConstruct stonden hier voorheen zelf gedefinieerd.
// Ze staan nu in server/t4students/voeding.ts, zodat kompas-scoring.ts (de
// motor) er ook van kan importeren zonder een kringverwijzing met dit
// bestand te krijgen: dit bestand importeert immers zelf types uit
// kompas-scoring.ts. Ze worden hier opnieuw uitgevoerd (re-export), zodat
// niets elders in de code of in tests moet wijzigen.
export { itemIndex, voedingPerConstruct };
export type { T4SVoeding };

export type T4SLicentie = "basis" | "verdieping";

// ── De families, bij hun sleutel in het instrument ──────────────────────────
// Deze vier constanten zijn geen namen van constructen maar id's van families.
// Ze staan hier omdat de rapportindeling nu eenmaal weet welke drie families op
// de one-page horen en welke niet.
export const FAM_BEELD = "TaPas-BEELD";
export const FAM_DRIVERS = "Drivers";
export const FAM_VERSNELLERS = "Talent-versnellers";
export const FAM_FOCI = "Talent-foci";
export const FAM_INTERESSE = "Interesse";

// ── Blokken ─────────────────────────────────────────────────────────────────

/** Een rij op de one-page of in een rangtabel: een construct met zijn cijfers. */
export interface T4SRij {
  /** De naam zoals hij in het instrument staat. Nooit hertaald. */
  construct: string;
  /** Gewone omschrijving naast de naam, uit onderdeel C. Leeg als er geen is. */
  omschrijving: string;
  /** Leeg wanneer het construct niet volledig is ingevuld. */
  rang: number | null;
  /**
   * Herstelronde 2, punt B. Vervangt de genummerde plaats door een van de
   * drie groepen, op basis van het aandeel (herkenning / 3): sterk aanwezig
   * (aandeel 2 tot en met 3), middenveld (aandeel 1 tot onder 2), minder
   * aanwezig (aandeel onder 1). Leeg wanneer het construct niet volledig is
   * ingevuld. Het veld rang hierboven blijft intern bestaan zolang niet elke
   * lezer is omgebouwd, maar wordt niet meer aan de student getoond: een
   * genummerde plaats van 1 tot 6 suggereert een nauwkeurigheid die dit
   * aantal vragen niet kan dragen.
   */
  groep: "sterk aanwezig" | "middenveld" | "minder aanwezig" | null;
  /** Herkenning op de schaal 0 tot 3 die de student zelf zag. */
  herkenning: number | null;
  /**
   * Aantal decimalen waarmee herkenning getoond moet worden. Normaal 1. Wordt
   * 2 wanneer dit construct en zijn buur anders hetzelfde afgeronde cijfer
   * zouden tonen terwijl hun rang verschilt (herstelronde, punt 1): de
   * rangorde komt altijd van de motor, nooit van dit cijfer, dus het cijfer
   * moet dan zelf iets scherper getoond worden om zichzelf niet tegen te
   * spreken.
   */
  weergavePrecisie: 1 | 2;
  /** Energie op de schaal min twee tot plus twee, of leeg. */
  energie: number | null;
  /** Staat dit construct binnen de marge van zijn buur? */
  evenSterk: boolean;
  /** Zijn alle antwoorden die dit construct voeden gegeven? */
  ingevuld: boolean;
  /** Het oordeel van de motor in woorden. Nooit hier opnieuw uitgerekend. */
  leeswoord: string;
  /** De vorm naast dat woord bij een driver, leesbaar zonder kleur. */
  vorm: T4SVorm;
}

/** Hoe het energiesaldo van een driver er als vorm uitziet. */
export type T4SVorm = "stijgend" | "vlak" | "dalend" | "geen";

export interface T4SBand {
  nummer: number;
  titel: string;
  onderschrift: string;
  noot: string | null;
  kleur: string;
  rijen: T4SRij[];
}

export interface T4SCitaatRegel {
  vraag: string;
  herkenning: string | null;
  energie: string | null;
}

export type T4SBlok =
  | { soort: "intro"; tekst: string }
  | { soort: "alinea"; tekst: string }
  | { soort: "tussenkop"; tekst: string }
  | { soort: "banden"; banden: T4SBand[]; legende: string[]; naschrift: string[] }
  | { soort: "rangtabel"; kleur: string; rijen: T4SRij[]; naschrift: string[] }
  | {
      soort: "constructblok";
      construct: string;
      /** Gewone omschrijving naast de naam, uit onderdeel C. Leeg als er geen is. */
      omschrijving: string;
      rang: number | null;
      herkenning: number | null;
      /** Zie T4SRij.weergavePrecisie: normaal 1, soms 2 om de rangorde niet tegen te spreken. */
      weergavePrecisie: 1 | 2;
      energie: number | null;
      ingevuld: boolean;
      kleur: string;
      duiding: string;
    }
  | { soort: "citaat"; kop: string; kleur: string; regels: T4SCitaatRegel[] }
  | { soort: "batterij"; waarde: number | null; zin: string }
  | { soort: "kolommen"; kopLinks: string; kopRechts: string; links: T4SCitaatRegel[]; rechts: T4SCitaatRegel[] }
  | { soort: "opsomming"; kop: string | null; punten: string[] }
  | { soort: "kader"; kop: string; tekst: string; kleur: string }
  | { soort: "paren"; paren: { label: string; waarde: string }[] }
  | { soort: "vragen"; kop: string; vragen: string[] }
  | { soort: "ruimte"; hoogte: number };

export interface T4SPagina {
  /** Het nummer uit de tabel van blauwdruk 5.1, ook in de Basis. */
  nr: number;
  soort: "cover" | "inhoud";
  titel: string;
  ondertitel: string;
  blokken: T4SBlok[];
}

export interface T4SRapport {
  licentie: T4SLicentie;
  taal: string;
  naam: string;
  code: string;
  datum: string;
  instrumentVersie: string;
  scorerVersie: string;
  paginas: T4SPagina[];
  /**
   * Wat de rapportlaag zelf heeft moeten vaststellen en wat de opdrachtgever
   * moet weten. Het renderscript schrijft dit weg in het verslag.
   */
  meldingen: string[];
}

// ── Kleuren, uit de huisstijl van T4Students ────────────────────────────────
export const KLEUR = {
  papier: "#FBF6EE",
  papier2: "#F4EAD9",
  kaart: "#FFFFFF",
  inkt: "#2A2C39",
  inktZacht: "#5E6072",
  lijn: "#E7DECB",
  accent: "#C9613F",
  accentDiep: "#A94B2D",
  accentZacht: "#F7E7DE",
  oker: "#E0A52E",
  okerZacht: "#FDF3DC",
  teal: "#3E7CA6",
  tealZacht: "#E0EFF8",
  salie: "#7E9B6E",
  salieZacht: "#EEF3EA",
  grijs: "#9A9AA8",
} as const;

function kleurVanFamilie(familie: string): string {
  if (familie === FAM_FOCI) return KLEUR.teal;
  if (familie === FAM_VERSNELLERS) return KLEUR.salie;
  if (familie === FAM_DRIVERS) return KLEUR.accent;
  if (familie === FAM_INTERESSE) return KLEUR.oker;
  return KLEUR.inktZacht;
}

// ── De duidingsteksten ──────────────────────────────────────────────────────

interface DuidingsBestand {
  bron: string;
  sleutel: string;
  constructen: Record<string, { familie: string; tekst: string }>;
}
const DUIDING = duidingsBestand as DuidingsBestand;

/** De tekst van de opdrachtgever bij een construct, of leeg als die er niet is. */
export function duidingVan(construct: string): string {
  const d = DUIDING.constructen[construct];
  return d ? d.tekst : "";
}

// ── Gewone omschrijving naast elke constructnaam (onderdeel C) ─────────────
//
// Overal waar een constructnaam in het rapport verschijnt, komt er een
// gewone, niet-technische omschrijving naast. De constructnaam zelf blijft
// ongewijzigd en blijft leidend; de omschrijving is enkel een toelichting.
// De omschrijvingen liggen, net als de duidingsteksten, vast in een los
// JSON-bestand en niet als letterlijke naam in deze code (zie de test
// "geen enkele vertaaltabel voor constructnamen").
//
// De twee constructen van TaPas-BEELD (Helderheid/zingeving, Energie-status)
// kregen in de opdracht geen omschrijving. Daarvoor geeft deze functie met
// opzet een lege tekst terug: er wordt niets verzonnen dat niet is opgegeven.
interface OmschrijvingenBestand {
  bron: string;
  sleutel: string;
  constructen: Record<string, string>;
}
const OMSCHRIJVING = omschrijvingenBestand as OmschrijvingenBestand;

/**
 * De gewone, niet-technische omschrijving naast een constructnaam. Geeft een
 * lege tekst terug wanneer er geen omschrijving is opgegeven (TaPas-BEELD, of
 * een construct dat niet in de tabel voorkomt), in plaats van iets te gokken.
 */
export function omschrijvingVan(construct: string): string {
  return OMSCHRIJVING.constructen[construct] ?? "";
}

// ── Wat een construct voedt ──────────────────────────────────────────
//
// T4SVoeding, voedingPerConstruct en itemIndex staan in ./voeding en worden
// hierboven opnieuw uitgevoerd (re-export).

/** Heeft de student dit item beantwoord, op de manier die het item vraagt? */
function isBeantwoord(item: T4SItem | undefined, antwoorden: T4SAntwoorden): boolean {
  if (!item) return false;
  const a = antwoorden[item.id];
  if (a == null) return false;
  if (item.options && item.options.length > 0) return a.choice != null;
  if (item.scale === "interest") return a.interest != null;
  if (item.scale === "battery0to10" || item.scale === "clarity0to10") return a.value != null;
  return a.recognition != null;
}

/**
 * Hoeveel vragen er per dimensie beantwoord zijn, zoals blauwdruk 5.2 voor
 * pagina 4 vraagt. Een item dat meer dan een construct binnen dezelfde familie
 * voedt, telt daar een keer mee: het is een vraag die de student een keer heeft
 * beantwoord, niet twee.
 */
export function beantwoordPerFamilie(
  inst: T4SInstrument,
  antwoorden: T4SAntwoorden,
): { familie: string; beantwoord: number; totaal: number }[] {
  const voeding = voedingPerConstruct(inst);
  const items = itemIndex(inst);
  return inst.families.map((f) => {
    const ids = new Set<string>();
    for (const con of f.constructs) {
      const v = voeding[con];
      if (!v) continue;
      for (const id of v.herkenningsItems) ids.add(id);
      for (const id of v.energieItems) ids.add(id);
    }
    const beantwoord = Array.from(ids).filter((id) => isBeantwoord(items[id], antwoorden)).length;
    return { familie: f.id, beantwoord, totaal: ids.size };
  });
}

// ── Tekst van items en antwoorden, letterlijk ───────────────────────────────

function t(v: T4SVertaalbaar | undefined, taal: string): string {
  if (!v) return "";
  const gekozen = (v as unknown as Record<string, string | undefined>)[taal];
  return gekozen && gekozen.trim() !== "" ? gekozen : v.nl;
}

function schaalLabel(inst: T4SInstrument, schaal: string, waarde: number, taal: string): string {
  const s = (inst.responseScales as Record<string, { options?: { value: number; label: T4SVertaalbaar }[] }>)[schaal];
  const opt = (s?.options || []).find((o) => o.value === waarde);
  return opt ? t(opt.label, taal) : String(waarde);
}

/** De vraag zoals ze op het scherm stond, met het gekozen antwoord erbij. */
export function citaatVanItem(
  inst: T4SInstrument,
  antwoorden: T4SAntwoorden,
  itemId: string,
  taal: string,
): T4SCitaatRegel | null {
  const it = itemIndex(inst)[itemId];
  if (!it) return null;
  const a = antwoorden[itemId];
  if (a == null) return null;
  if (it.options && it.options.length > 0) {
    if (a.choice == null) return null;
    const opt = it.options.find((o) => o.key === a.choice);
    if (!opt) return null;
    return { vraag: t(it.text, taal), herkenning: t(opt.text, taal), energie: null };
  }
  if (it.scale === "interest") {
    if (a.interest == null) return null;
    return { vraag: t(it.text, taal), herkenning: schaalLabel(inst, "interest", a.interest, taal), energie: null };
  }
  if (a.recognition == null) return null;
  return {
    vraag: t(it.text, taal),
    herkenning: schaalLabel(inst, "recognition", a.recognition, taal),
    energie: a.energy != null ? schaalLabel(inst, "energy", a.energy, taal) : null,
  };
}

// ── De rangorde per dimensie ────────────────────────────────────────────────

/**
 * Het oordeelwoord wordt niet in de tekenlaag uitgerekend maar gelezen uit wat
 * de motor al heeft bepaald.
 *
 * WAAROM NIET OPNIEUW REKENEN
 * De motor leest het balanslabel van de ruwe herkenning van het anker-item; de
 * rangorde op deze pagina staat op de geschaalde herkenning van het hele
 * construct. Dat zijn twee verschillende getallen. Rekende het papier zelf, dan
 * kon er rechts "kernsterkte" staan terwijl de motor "latent" zegt, en dan
 * spreken de bijlage en de one-page elkaar tegen.
 *
 * WAAROM DE DRIVERS EEN EIGEN RIJTJE WOORDEN HEBBEN
 * Kernsterkte, overbelast, onderbenut en latent gaan over een talent dat je wel
 * of niet inzet. Een driver is geen talent maar iets wat je aandrijft, dus daar
 * zeggen die vier het verkeerde. De motor geeft er remmend, neutraal of
 * gaspedaal voor terug en dat is wat hier komt te staan.
 */
function motorlabel(resultaat: T4SResultaat, familie: string, construct: string): string {
  if (familie === FAM_FOCI) return resultaat.foci.balanslabels[construct] ?? "";
  if (familie === FAM_VERSNELLERS) return resultaat.versnellers.balanslabels[construct] ?? "";
  if (familie === FAM_DRIVERS) return resultaat.drivers.energielabels[construct] ?? "";
  return "";
}

/** De schrijfwijze op papier van de woorden die de motor teruggeeft. */
const LEESWOORD: Record<string, string> = {
  kernsterkte: "kernsterkte",
  overbelast: "overbelast",
  onderbenut: "onderbenut",
  latent: "latent",
  remmend: "remmend",
  neutraal: "neutraal",
  gaspedaal: "gaspedaal",
  te_weinig_antwoorden: "te weinig antwoorden",
  niet_van_toepassing: "niet gemeten",
};

/**
 * De vorm naast het woord bij een driver, zodat het saldo ook leesbaar is
 * zonder het woord te lezen en zonder op kleur te steunen.
 */
const VORM: Record<string, T4SVorm> = {
  gaspedaal: "stijgend",
  neutraal: "vlak",
  remmend: "dalend",
};

function leeswoordVan(resultaat: T4SResultaat, familie: string, construct: string): string {
  return LEESWOORD[motorlabel(resultaat, familie, construct)] ?? "";
}

function vormVan(resultaat: T4SResultaat, familie: string, construct: string): T4SVorm {
  if (familie !== FAM_DRIVERS) return "geen";
  return VORM[motorlabel(resultaat, familie, construct)] ?? "geen";
}

export interface T4SDimensie {
  familie: string;
  kleur: string;
  rijen: T4SRij[];
  /** De rijen die wel volledig zijn ingevuld, op volgorde. */
  gerangschikt: T4SRij[];
  /** De rijen zonder oordeel, onder de streep. */
  zonderOordeel: T4SRij[];
}

/**
 * De rangorde die de rekenmotor zelf voor deze familie al heeft bepaald, op de
 * ruwe, ongeschaalde herkenning. Dit is de enige bron van de volgorde op
 * papier (herstelronde, punt 1). Voor TaPas-BEELD bestaat er geen motorlijst,
 * want die familie wordt nooit als rangorde getoond; daar geeft deze functie
 * null terug en valt rangschik terug op de geschaalde herkenning, alleen om
 * die twee constructen naast elkaar te kunnen zetten.
 */
function motorVolgorde(resultaat: T4SResultaat, familie: string): string[] | null {
  if (familie === FAM_FOCI) return resultaat.foci.sorted;
  if (familie === FAM_VERSNELLERS) return resultaat.versnellers.rangorde;
  if (familie === FAM_DRIVERS) return resultaat.drivers.sorted;
  if (familie === FAM_INTERESSE) return resultaat.interesse.sorted;
  return null;
}

/**
 * Zet een familie om in een rangorde. De volgorde zelf komt letterlijk van de
 * rekenmotor (motorVolgorde hierboven); het herschaalde cijfer van 0 tot 3 is
 * uitsluitend voor de weergave en bepaalt nooit meer de plaats. Zie
 * bevinding-punt1-meetronde.md voor de meting die aan deze functie voorafging.
 */
export function rangschik(
  inst: T4SInstrument,
  resultaat: T4SResultaat,
  antwoorden: T4SAntwoorden,
  familie: string,
): T4SDimensie {
  const voeding = voedingPerConstruct(inst);
  const items = itemIndex(inst);
  const fam = inst.families.find((f) => f.id === familie);
  const constructen = fam ? fam.constructs : [];
  const marge = inst.scoringMap.constants.tieMargin;
  const motorRij = motorVolgorde(resultaat, familie);

  const ruw = constructen.map((con) => {
    const v = voeding[con] || { herkenningsItems: [], energieItems: [], maxHerkenning: 0 };
    const compleet =
      v.herkenningsItems.length > 0 && v.herkenningsItems.every((id) => isBeantwoord(items[id], antwoorden));
    const score = resultaat.constructScores[con];
    // De ruwe motorscore stuurt de rangorde; nooit het geschaalde cijfer.
    const ruweScore = compleet && score ? score.recognition : null;
    // Op twee decimalen berekend, zodat wijsPrecisieToe hierna een echt tweede
    // decimaal kan tonen in plaats van een tweede keer dezelfde afronding.
    // Bij een decimaal weergavePrecisie wordt dit getal verderop afgerond op
    // een decimaal; de rangorde zelf leest dit getal nooit.
    const geschaald =
      compleet && v.maxHerkenning > 0 && score
        ? Math.round(((score.recognition / v.maxHerkenning) * 3 + Number.EPSILON) * 100) / 100
        : null;
    const energieCompleet =
      v.energieItems.length > 0 && v.energieItems.every((id) => antwoorden[id]?.energy != null);
    return {
      construct: con,
      omschrijving: omschrijvingVan(con),
      rang: null as number | null,
      groep: null as "sterk aanwezig" | "middenveld" | "minder aanwezig" | null,
      herkenning: geschaald,
      energie: energieCompleet && score ? score.avgEnergy : null,
      evenSterk: false,
      ingevuld: compleet,
      leeswoord: "",
      vorm: "geen",
      weergavePrecisie: 1,
      // Hulpveld, alleen binnen deze functie gebruikt: de ruwe score waarop de
      // motor rangschikt.
      _ruweScore: ruweScore,
    } as T4SRij & { _ruweScore: number | null };
  });

  // De volgorde komt letterlijk van de motor als die voor deze familie
  // bestaat. Constructen die de motor niet kent (zou hier niet mogen
  // voorkomen) belanden achteraan, op naam, zodat er nooit iets verdwijnt.
  const motorPlaats = new Map<string, number>();
  if (motorRij) motorRij.forEach((con, i) => motorPlaats.set(con, i));

  const volledig = ruw
    .filter((r) => r.ingevuld)
    .sort((a, b) => {
      if (motorRij) {
        const pa = motorPlaats.has(a.construct) ? motorPlaats.get(a.construct)! : Number.MAX_SAFE_INTEGER;
        const pb = motorPlaats.has(b.construct) ? motorPlaats.get(b.construct)! : Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return a.construct.localeCompare(b.construct, "nl");
      }
      // Alleen TaPas-BEELD komt hier terecht: geen motorrangorde beschikbaar,
      // dus de geschaalde herkenning is de enige overgebleven maat.
      return (b.herkenning as number) - (a.herkenning as number) || a.construct.localeCompare(b.construct, "nl");
    });

  // Blauwdruk 3.4 regel 1: precies gelijk krijgt hetzelfde nummer, het
  // volgende nummer wordt overgeslagen.
  //
  // HERIJKING, HERSTELRONDE 2 PUNT A/B
  // Vroeger was "gelijk" hier de ruwe motorscore (_ruweScore). Dat klopte
  // zolang de motor zelf ook op de ruwe som rangschikte: beide lagen hielden
  // elkaar in de pas. Sinds punt A rangschikt de motor op het aandeel van
  // het haalbare, en dan is de ruwe som geen eerlijke gelijkheidsmaatstaf
  // meer. Twee constructen met een andere voeding kunnen toevallig hetzelfde
  // ruwe getal halen (het voorbeeld uit de opdracht: Be Strong en Be Perfect
  // stonden beide op ruw 3, maar dat is 3 van 8 tegenover 3 van 4) zonder dat
  // hun aandeel ook maar in de buurt van elkaar komt. "Gelijk" is daarom nu
  // het geschaalde cijfer (r.herkenning, dat is aandeel maal 3), dezelfde
  // maatstaf als de rangorde zelf, voor elke familie inclusief TaPas-BEELD.
  let vorigeScore: number | null | undefined = undefined;
  let vorigeRang = 0;
  volledig.forEach((r, i) => {
    const maatstaf = r.herkenning;
    if (vorigeScore !== undefined && maatstaf === vorigeScore) r.rang = vorigeRang;
    else {
      r.rang = i + 1;
      vorigeRang = i + 1;
      vorigeScore = maatstaf;
    }
  });
  // Regel 2: binnen de marge maar niet gelijk, dan visueel samengenomen. De
  // marge werkt op dezelfde maatstaf als de rangorde zelf en als de gelijk-
  // detectie hierboven: het geschaalde cijfer.
  volledig.forEach((r, i) => {
    const buur = volledig[i + 1];
    if (!buur) return;
    const eigen = r.herkenning;
    const naast = buur.herkenning;
    if (eigen == null || naast == null) return;
    const verschil = Math.abs(eigen - naast);
    if (verschil > 0 && verschil <= marge) {
      r.evenSterk = true;
      buur.evenSterk = true;
    }
  });
  for (const r of volledig) {
    r.leeswoord = leeswoordVan(resultaat, familie, r.construct);
    r.vorm = vormVan(resultaat, familie, r.construct);
  }

  // Herstelronde 2, punt B: de groep vervangt het plaatsnummer dat een
  // student ziet. De grens ligt op de derden van de antwoordschaal van 0 tot
  // 3, dus rechtstreeks op het geschaalde herkenningscijfer hierboven (dat is
  // het aandeel maal 3). Sterk aanwezig loopt van 2 tot en met 3, middenveld
  // van 1 tot onder 2, minder aanwezig blijft onder 1. Alleen ingevulde
  // constructen krijgen een groep; hun herkenning is dan altijd een getal.
  for (const r of volledig) {
    const h = r.herkenning as number;
    r.groep = h >= 2 ? "sterk aanwezig" : h >= 1 ? "middenveld" : "minder aanwezig";
  }

  // Gevolg dat opgevangen moet worden (herstelronde, punt 1): twee constructen
  // kunnen nu naast elkaar staan met een verschillende rang maar hetzelfde
  // afgeronde cijfer, omdat de rangorde niet meer van dat cijfer afhangt. Wie
  // dat zo laat staan, toont een cijfer dat zijn eigen volgorde tegenspreekt.
  // Daarom krijgt zo'n paar hier, en alleen dan, een extra decimaal.
  wijsPrecisieToe(volledig, motorRij != null);

  const zonder = ruw
    .filter((r) => !r.ingevuld)
    .sort((a, b) => a.construct.localeCompare(b.construct, "nl"));

  return {
    familie,
    kleur: kleurVanFamilie(familie),
    rijen: [...volledig, ...zonder],
    gerangschikt: volledig,
    zonderOordeel: zonder,
  };
}

/**
 * Een groep uit punt B van herstelronde 2: een van de drie vaste
 * groepen (sterk aanwezig, middenveld, minder aanwezig) met de
 * constructen die daarin vallen, al op aandeel gesorteerd (dat is de
 * volgorde die T4SRij.rang meegeeft in rangschik() hierboven).
 */
export interface T4SGroep {
  titel: "sterk aanwezig" | "middenveld" | "minder aanwezig";
  rijen: T4SRij[];
}

/**
 * Herstelronde 2, punt B: zet de rijen van een dimensie om in de drie vaste
 * groepen. Een genummerde plaats van 1 tot 6 suggereert een nauwkeurigheid
 * die dit aantal vragen niet kan dragen; de groep is de vervanging die een
 * student ziet. Neemt uitsluitend T4SRij.groep als maatstaf, nooit rang: een
 * lege groep valt gewoon weg, in de vaste volgorde sterk aanwezig,
 * middenveld, minder aanwezig. Rijen zonder groep (niet ingevuld) komen in
 * geen van de drie groepen terecht; ze blijven in T4SDimensie.zonderOordeel.
 */
export function groepeerOpAandeel(rijen: T4SRij[]): T4SGroep[] {
  const volgorde: T4SGroep["titel"][] = ["sterk aanwezig", "middenveld", "minder aanwezig"];
  const groepen: T4SGroep[] = [];
  for (const titel of volgorde) {
    const inDezeGroep = rijen.filter((r) => r.groep === titel);
    if (inDezeGroep.length > 0) groepen.push({ titel, rijen: inDezeGroep });
  }
  return groepen;
}

/**
 * Groepen doortrekken naar de uitgewerkte bladen.
 *
 * De hoofdstukken "wat sterk aanwezig is" en "wat lager staat" werkten
 * voorheen een vast aantal van drie onderdelen uit (rijen.slice(0, 3) en
 * rijen.slice(-3)), terwijl de rest van het rapport op groepen werkt. Bij een
 * groep sterk aanwezig met meer of minder dan drie leden ontstond zo een
 * tegenspraak: een onderdeel kon op het overzicht bij "sterk aanwezig" staan
 * en toch in het hoofdstuk "wat lager staat" belanden. Deze functie verdeelt
 * de rijen van een dimensie in dezelfde twee hoofdstukken, maar dan volgens
 * groepeerOpAandeel: sterk krijgt alle leden van de groep sterk aanwezig
 * (niet vast drie), lager krijgt middenveld en minder aanwezig samen, in die
 * volgorde. Elk onderdeel met een oordeel (een groep) komt zo in precies één
 * van de twee lijsten terecht.
 */
export function splitsSterkEnLager(dim: T4SDimensie): { sterk: T4SRij[]; lager: T4SRij[] } {
  const groepen = groepeerOpAandeel(dim.gerangschikt);
  const sterk = groepen.find((g) => g.titel === "sterk aanwezig")?.rijen ?? [];
  const lager = groepen.filter((g) => g.titel !== "sterk aanwezig").flatMap((g) => g.rijen);
  return { sterk, lager };
}

/** Het resultaat van sterksteUitGroep(): de gekozen constructen en de context erbij. */
export interface T4SSterksteUitGroep {
  /** Een of twee rijen: twee alleen bij een echt gelijkspel op het hoogste aandeel. */
  constructen: T4SRij[];
  /** Hoeveel rijen precies dat hoogste aandeel hadden (1 als er geen gelijkspel is). */
  aantalGelijk: number;
  /** True wanneer de groep sterk aanwezig leeg was en dit uit het middenveld komt. */
  uitMiddenveld: boolean;
}

/**
 * Herstelronde 2, punt C: kiest het construct (of de twee constructen bij een
 * gelijkspel) met het hoogste aandeel binnen de groep sterk aanwezig van een
 * dimensie. Vervangt het rechtstreeks aflezen van rang 1 op de bladen "In één
 * zin" en "Wat je hier zocht": die bladen moeten uit de groep putten, niet
 * uit de rangorde van de motor.
 *
 * - Zijn er meer dan twee rijen met hetzelfde hoogste aandeel, dan worden er
 *   twee teruggegeven en telt aantalGelijk hoeveel dat er precies waren, zodat
 *   de aanroeper dezelfde soort gelijkspel-zin kan schrijven die al bestaat.
 * - Is de groep sterk aanwezig leeg, dan valt de keuze terug op het hoogste
 *   aandeel binnen het middenveld en staat uitMiddenveld op true, zodat de
 *   aanroeper de vaste zin kan toevoegen dat niets in dit beeld sterk
 *   uitkomt en dat dat ook een uitkomst is.
 * - Heeft geen enkele rij een groep (niets ingevuld), dan is constructen leeg.
 */
export function sterksteUitGroep(dim: T4SDimensie): T4SSterksteUitGroep {
  const groepen = groepeerOpAandeel(dim.gerangschikt);
  const sterk = groepen.find((g) => g.titel === "sterk aanwezig");
  const bron = sterk ?? groepen.find((g) => g.titel === "middenveld");
  if (!bron || bron.rijen.length === 0) {
    return { constructen: [], aantalGelijk: 0, uitMiddenveld: false };
  }
  // De rijen binnen een groep staan al op aandeel gesorteerd (groepeerOpAandeel
  // behoudt de volgorde van dim.gerangschikt, die zelf al aflopend op aandeel
  // gerangschikt is); het hoogste aandeel staat dus vooraan.
  const hoogsteAandeel = bron.rijen[0].herkenning;
  const gelijkAanTop = bron.rijen.filter((r) => r.herkenning === hoogsteAandeel);
  return {
    constructen: gelijkAanTop.slice(0, 2),
    aantalGelijk: gelijkAanTop.length,
    uitMiddenveld: bron.titel === "middenveld",
  };
}

/**
 * Bepaalt per rij hoeveel decimalen de weergave nodig heeft. Standaard een
 * decimaal. Zodra twee opeenvolgende rijen met een verschillende rang op een
 * decimaal hetzelfde cijfer zouden tonen, krijgen beide een extra decimaal:
 * herkenning ligt al op twee decimalen berekend, dus dat tweede decimaal
 * bestaat en hoeft nergens geschat te worden. Een echt gelijkspel (dezelfde
 * rang) toont bewust hetzelfde cijfer en blijft op een decimaal staan.
 */
function wijsPrecisieToe(volledig: (T4SRij & { _ruweScore: number | null })[], heeftMotorVolgorde: boolean): void {
  if (!heeftMotorVolgorde) return;
  const opEenDecimaal = (x: number): number => Math.round(x * 10) / 10;
  for (let i = 0; i < volledig.length - 1; i++) {
    const a = volledig[i];
    const b = volledig[i + 1];
    if (a.rang === b.rang) continue;
    if (a.herkenning == null || b.herkenning == null) continue;
    if (opEenDecimaal(a.herkenning) === opEenDecimaal(b.herkenning)) {
      a.weergavePrecisie = 2;
      b.weergavePrecisie = 2;
    }
  }
}

// ── Kleine hulpjes voor tekst ───────────────────────────────────────────────

function lijst(namen: string[]): string {
  if (namen.length === 0) return "";
  if (namen.length === 1) return namen[0];
  return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
}

function getal1(x: number): string {
  return x.toFixed(1).replace(".", ",");
}

/**
 * Toont herkenning met het aantal decimalen dat de rangorde nodig heeft (zie
 * T4SRij.weergavePrecisie). Normaal een decimaal, zoals getal1; twee decimalen
 * alleen als anders twee constructen met een verschillende rang hetzelfde
 * cijfer zouden tonen.
 */
function getalMetPrecisie(x: number, precisie: 1 | 2): string {
  return x.toFixed(precisie).replace(".", ",");
}

function getalMetTeken(x: number): string {
  const s = getal1(Math.abs(x));
  if (x > 0.049) return "+" + s;
  if (x < -0.049) return "-" + s;
  return "0,0";
}

export { getal1, getalMetPrecisie, getalMetTeken, lijst, kleurVanFamilie };

// ── Het paginaplan uit blauwdruk 5.1 ────────────────────────────────────────

// ---------------------------------------------------------------------------
// ONDERDEEL H: HET RAPPORT ALS VERHAAL
//
// Dit paginaplan is herschikt volgens onderdeel H van de opdracht
// "Studiekompas persoonlijk maken" (2026-08-03). Er kwamen zes nieuwe bladen
// bij, en de bestaande bladen bleven allemaal staan, in dezelfde onderlinge
// volgorde als voorheen. Wat volgt is de plaats van elk nieuw blad en waarom.
//
// - Nr 3 "Dit hoopte je te vinden" (onderdeel B2, nieuw): meteen na de
//   leeswijzer, zodat de eigen vraag van de student als eerste inhoudelijke
//   blad verschijnt, voor er één cijfer valt.
// - Nr 18 "Waarom kiezen makkelijk of moeilijk kan voelen" (onderdeel F,
//   nieuw): meteen na het motivatieblok (nu nr 17), zoals de opdracht letterlijk
//   vraagt.
// - Nr 27 "In één zin" (onderdeel D, nieuw): na "Een eerste stap", vlak voor
//   "Wat je hier zocht".
// - Nr 28 "Wat je hier zocht" (onderdeel B3, nieuw): sluit de inhoudelijke
//   bladen af door terug te grijpen naar de beginvraag van nr 3.
// - Nr 29 "Voor wie meeleest, slot" (onderdeel E2, nieuw): het tweede kader
//   voor wie meeleest, als apart slotblad voor de verantwoording.
// - Nr 31 "Waarop dit rapport gebouwd is" (onderdeel G, nieuw): een eigen blad
//   na "Verantwoording en grenzen" en voor de bronpagina's, met uitsluitend
//   bevestigde verwijzingen uit bronnen-geverifieerd.md.
//
// Alle bladen na nr 2 zijn ten opzichte van de vorige indeling met een stap
// opgeschoven per ingevoegd blad dat ervoor komt. tests/t4students-hoofdstuknummers-doorlopend.test.ts
// bewaakt dat de nummering in de Verdieping exact 1 tot en met het laatste
// hoofdstuk blijft, zonder gaten.
// ---------------------------------------------------------------------------
export const PAGINAPLAN: { nr: number; titel: string; basis: boolean }[] = [
  { nr: 1, titel: "Cover", basis: true },
  { nr: 2, titel: "Hoe je dit rapport leest", basis: true },
  { nr: 3, titel: "Dit hoopte je te vinden", basis: true },
  { nr: 4, titel: "Jouw talentmotor in één oogopslag", basis: true },
  { nr: 5, titel: "Hoe scherp is dit beeld", basis: false },
  { nr: 6, titel: "Jouw beeld van jezelf", basis: true },
  { nr: 7, titel: "Jouw energie vandaag", basis: true },
  { nr: 8, titel: "Talent-foci, wat het zijn", basis: true },
  { nr: 9, titel: "Talent-foci, wat sterk aanwezig is", basis: true },
  { nr: 10, titel: "Talent-foci, wat lager staat", basis: false },
  { nr: 11, titel: "Talent-versnellers, wat het zijn", basis: true },
  { nr: 12, titel: "Talent-versnellers, wat sterk aanwezig is", basis: true },
  { nr: 13, titel: "Talent-versnellers, wat lager staat", basis: false },
  { nr: 14, titel: "Drivers, wat het zijn", basis: true },
  { nr: 15, titel: "Drivers, jouw patroon", basis: true },
  { nr: 16, titel: "Drivers, de keerzijde", basis: false },
  { nr: 17, titel: "Wat je motiveert om te studeren", basis: true },
  { nr: 18, titel: "Waarom kiezen makkelijk of moeilijk kan voelen", basis: true },
  { nr: 19, titel: "Hoe jij het beste leert", basis: true },
  { nr: 20, titel: "Jouw leer- en werkomgeving", basis: false },
  { nr: 21, titel: "Waar je interesse naar uitgaat", basis: true },
  { nr: 22, titel: "Studierichtingen om te verkennen", basis: false },
  { nr: 23, titel: "Waar jij iets wilt betekenen", basis: true },
  { nr: 24, titel: "Jouw specifieke positie", basis: false },
  { nr: 25, titel: "Aandachtspunten", basis: false },
  { nr: 26, titel: "Een eerste stap", basis: true },
  { nr: 27, titel: "In één zin", basis: true },
  { nr: 28, titel: "Wat je hier zocht", basis: true },
  { nr: 29, titel: "Voor wie meeleest, slot", basis: true },
  { nr: 30, titel: "Verantwoording en grenzen", basis: true },
  { nr: 31, titel: "Waarop dit rapport gebouwd is", basis: true },
  { nr: 32, titel: "Alles wat je zelf antwoordde over je talent-foci", basis: true },
  { nr: 33, titel: "Alles wat je zelf antwoordde over je talent-versnellers", basis: true },
  { nr: 34, titel: "Alles wat je zelf antwoordde over je drivers", basis: true },
];
