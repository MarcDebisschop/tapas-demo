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
import type { T4SInstrument, T4SItem, T4SVertaalbaar } from "./instrument";
import type { T4SAntwoorden, T4SResultaat } from "./kompas-scoring";

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
  /** Leeg wanneer het construct niet volledig is ingevuld. */
  rang: number | null;
  /** Herkenning op de schaal 0 tot 3 die de student zelf zag. */
  herkenning: number | null;
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
      rang: number | null;
      herkenning: number | null;
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

// ── Wat een construct voedt ─────────────────────────────────────────────────

/**
 * Per construct: welke items eraan kunnen bijdragen, en hoeveel elk item er
 * hoogstens aan bij kan dragen. Alles uit het instrument gerekend, niets met de
 * hand. Een keuze-item telt mee bij elk construct dat in een van zijn opties
 * geladen wordt, want de student kan die optie kiezen.
 */
export interface T4SVoeding {
  /** Item-id's die de herkenning van dit construct kunnen voeden. */
  herkenningsItems: string[];
  /** Item-id's die de energie van dit construct kunnen voeden. */
  energieItems: string[];
  /** De hoogst haalbare herkenningssom voor dit construct. */
  maxHerkenning: number;
}

export function voedingPerConstruct(inst: T4SInstrument): Record<string, T4SVoeding> {
  const sm = inst.scoringMap;
  const items = itemIndex(inst);
  const uit: Record<string, T4SVoeding> = {};

  function reserveer(con: string): T4SVoeding {
    if (!uit[con]) uit[con] = { herkenningsItems: [], energieItems: [], maxHerkenning: 0 };
    return uit[con];
  }
  for (const fam of inst.families) for (const con of fam.constructs) reserveer(con);

  const schaalMax = (naam: string | undefined): number => {
    if (!naam) return 0;
    const s = (inst.responseScales as Record<string, { max?: number }>)[naam];
    return s && typeof s.max === "number" ? s.max : 0;
  };

  for (const [itemId, con] of Object.entries(sm.recognitionItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  for (const [itemId, con] of Object.entries(sm.beeldItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  for (const [itemId, con] of Object.entries(sm.interestItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  // Keuze-items: D5, D6, F4, F5 uit sjtItems, en S1 dat de motor apart leest.
  for (const itemId of [...sm.sjtItems, "S1"]) {
    const it = items[itemId];
    if (!it || !it.options) continue;
    const zwaarste: Record<string, number> = {};
    for (const opt of it.options) {
      for (const load of opt.loads || []) {
        if (load.weight <= 0) continue;
        zwaarste[load.construct] = Math.max(zwaarste[load.construct] || 0, load.weight);
      }
    }
    for (const [con, gewicht] of Object.entries(zwaarste)) {
      const v = reserveer(con);
      v.herkenningsItems.push(itemId);
      v.maxHerkenning += gewicht;
    }
  }
  for (const itemId of sm.energyItems) {
    const it = items[itemId];
    if (!it || !it.construct) continue;
    reserveer(it.construct).energieItems.push(itemId);
  }
  return uit;
}

export function itemIndex(inst: T4SInstrument): Record<string, T4SItem> {
  const uit: Record<string, T4SItem> = {};
  const main = inst.sections.find((s) => s.sectionId === "main");
  for (const it of main ? main.items : []) uit[it.id] = it;
  return uit;
}

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
 * Zet een familie om in een rangorde op geschaalde herkenning, met de regels
 * uit blauwdruk 3.4 voor gelijke stand en 3.5 voor een construct zonder oordeel.
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

  const ruw = constructen.map((con) => {
    const v = voeding[con] || { herkenningsItems: [], energieItems: [], maxHerkenning: 0 };
    const compleet =
      v.herkenningsItems.length > 0 && v.herkenningsItems.every((id) => isBeantwoord(items[id], antwoorden));
    const score = resultaat.constructScores[con];
    const geschaald =
      compleet && v.maxHerkenning > 0 && score
        ? Math.round(((score.recognition / v.maxHerkenning) * 3 + Number.EPSILON) * 10) / 10
        : null;
    const energieCompleet =
      v.energieItems.length > 0 && v.energieItems.every((id) => antwoorden[id]?.energy != null);
    return {
      construct: con,
      rang: null as number | null,
      herkenning: geschaald,
      energie: energieCompleet && score ? score.avgEnergy : null,
      evenSterk: false,
      ingevuld: compleet,
      leeswoord: "",
      vorm: "geen",
    } as T4SRij;
  });

  const volledig = ruw
    .filter((r) => r.ingevuld)
    .sort((a, b) => (b.herkenning as number) - (a.herkenning as number) || a.construct.localeCompare(b.construct, "nl"));

  // Blauwdruk 3.4 regel 1: precies gelijk krijgt hetzelfde nummer, het volgende
  // nummer wordt overgeslagen.
  let vorigeScore: number | null = null;
  let vorigeRang = 0;
  volledig.forEach((r, i) => {
    if (vorigeScore != null && r.herkenning === vorigeScore) r.rang = vorigeRang;
    else {
      r.rang = i + 1;
      vorigeRang = i + 1;
      vorigeScore = r.herkenning;
    }
  });
  // Regel 2: binnen de marge maar niet gelijk, dan visueel samengenomen.
  volledig.forEach((r, i) => {
    const buur = volledig[i + 1];
    if (!buur) return;
    const verschil = Math.abs((r.herkenning as number) - (buur.herkenning as number));
    if (verschil > 0 && verschil <= marge) {
      r.evenSterk = true;
      buur.evenSterk = true;
    }
  });
  for (const r of volledig) {
    r.leeswoord = leeswoordVan(resultaat, familie, r.construct);
    r.vorm = vormVan(resultaat, familie, r.construct);
  }

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

// ── Kleine hulpjes voor tekst ───────────────────────────────────────────────

function lijst(namen: string[]): string {
  if (namen.length === 0) return "";
  if (namen.length === 1) return namen[0];
  return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
}

function getal1(x: number): string {
  return x.toFixed(1).replace(".", ",");
}

function getalMetTeken(x: number): string {
  const s = getal1(Math.abs(x));
  if (x > 0.049) return "+" + s;
  if (x < -0.049) return "-" + s;
  return "0,0";
}

export { getal1, getalMetTeken, lijst, kleurVanFamilie };

// ── Het paginaplan uit blauwdruk 5.1 ────────────────────────────────────────

export const PAGINAPLAN: { nr: number; titel: string; basis: boolean }[] = [
  { nr: 1, titel: "Cover", basis: true },
  { nr: 2, titel: "Hoe je dit rapport leest", basis: true },
  { nr: 3, titel: "Jouw talentmotor in één oogopslag", basis: true },
  { nr: 4, titel: "Hoe scherp is dit beeld", basis: false },
  { nr: 5, titel: "Jouw beeld van jezelf", basis: true },
  { nr: 6, titel: "Jouw energie vandaag", basis: true },
  { nr: 7, titel: "Talent-foci, wat het zijn", basis: true },
  { nr: 8, titel: "Talent-foci, jouw drie sterkste", basis: true },
  { nr: 9, titel: "Talent-foci, wat lager staat", basis: false },
  { nr: 10, titel: "Talent-versnellers, wat het zijn", basis: true },
  { nr: 11, titel: "Talent-versnellers, jouw drie sterkste", basis: true },
  { nr: 12, titel: "Talent-versnellers, wat lager staat", basis: false },
  { nr: 13, titel: "Drivers, wat het zijn", basis: true },
  { nr: 14, titel: "Drivers, jouw patroon", basis: true },
  { nr: 15, titel: "Drivers, de keerzijde", basis: false },
  { nr: 16, titel: "Hoe jij het beste leert", basis: true },
  { nr: 17, titel: "Jouw leer- en werkomgeving", basis: false },
  { nr: 18, titel: "Waar je interesse naar uitgaat", basis: true },
  { nr: 19, titel: "Studierichtingen om te verkennen", basis: false },
  { nr: 20, titel: "Waar jij iets wilt betekenen", basis: true },
  { nr: 21, titel: "Jouw specifieke positie", basis: false },
  { nr: 22, titel: "Aandachtspunten", basis: false },
  { nr: 23, titel: "Een eerste stap", basis: true },
  { nr: 24, titel: "Alles wat je zelf antwoordde over je talent-foci", basis: true },
  { nr: 25, titel: "Alles wat je zelf antwoordde over je talent-versnellers", basis: true },
  { nr: 26, titel: "Alles wat je zelf antwoordde over je drivers", basis: true },
  { nr: 27, titel: "Verantwoording en grenzen", basis: true },
];
