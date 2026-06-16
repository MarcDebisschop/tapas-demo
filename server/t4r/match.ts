/**
 * TAPAS 4 Recruitment — Matchengine
 *
 * Confronteert het in alignment gebouwde virtuele profiel (de norm: need/nice/not-needed
 * per construct) met een ingevuld kandidaatrapport (de meting: nettoscore + energiestatus
 * per construct). Implementeert het goedgekeurde matchontwerp v1:
 *   §3 drempeltabel (net → vervullingsniveau)
 *   §4 energie als beschikbaarheidstoets (alleen op need-lijnen)
 *   §5 per-construct beslislogica
 *   §6 context- en risicokoppeling
 *   §7 aggregatie tot eindoordeel
 *
 * Geen verborgen rekenregels: de enige numerieke parameters zijn de drie drempels
 * (+3 / 0 / −3). Ze staan hier expliciet en worden zichtbaar in het matchrapport vermeld.
 */

import { MODULES } from "./library";
import type { Answer } from "./schema";

// ---------------------------------------------------------------------------
// Drempelparameters — de ENIGE numerieke afspraak in het hele ontwerp (§3.1).
// Zichtbaar en per release vastgelegd, zodat elke beoordeling narekenbaar blijft.
// ---------------------------------------------------------------------------
export const THRESHOLDS = {
  sterk: 3, // net ≥ +3  → Sterk aanwezig
  aanwezig: 0, // net 0..+2 → Aanwezig
  afwezig: -3, // net ≤ −3  → Afwezig / afgewezen
} as const;

export type EnergieStatus = "geeft" | "neutraal" | "kost";
export type Classificatie = "need" | "nice" | "not-needed";

// ---------------------------------------------------------------------------
// De constructen die beide documenten delen (§2 gemeenschappelijk skelet).
// Elk construct verwijst naar de cluster-waarde in shared/library.ts én naar
// de hoofdstuk-herkomst in het kandidaatrapport.
// ---------------------------------------------------------------------------
export interface ConstructDef {
  /** stabiele sleutel voor opslag/extractie */
  key: string;
  /** zichtbare naam in rapport (geherformuleerd, geen interne jargon) */
  label: string;
  /** korte rolgerichte omschrijving (item-blinded, geen "ik"-vorm) */
  beschrijving: string;
  /** de matchas waartoe het construct hoort */
  as: "drivers" | "foci" | "versnellers" | "zelfbeeld";
  /** cluster-waarden in library.ts die aan dit construct koppelen */
  cluster: string;
  /** module-key in library.ts (drivers/foci/versnellers/zelfbeeld) */
  moduleKey: string;
}

export const CONSTRUCTS: ConstructDef[] = [
  // Drivers (werkstijlen) — H05 in het kandidaatrapport
  { key: "be_strong", label: "Standvastigheid en eigen regie", beschrijving: "Zelfgekozen verantwoordelijkheid dragen en kalm blijven onder spanning.", as: "drivers", cluster: "Be Strong", moduleKey: "drivers" },
  { key: "be_perfect", label: "Grondigheid en kwaliteit", beschrijving: "Nauwkeurigheid, hoge kwaliteitslat en oog voor afwijkingen.", as: "drivers", cluster: "Be Perfect", moduleKey: "drivers" },
  { key: "hurry_up", label: "Tempo en gelijktijdigheid", beschrijving: "Hoog werktempo en veel taken gelijktijdig beheren onder tijdsdruk.", as: "drivers", cluster: "Hurry Up", moduleKey: "drivers" },
  { key: "try_hard", label: "Prestatiedrang en volharding", beschrijving: "Volgehouden inzet, bewijsdrang en uitdaging in een veeleisende omgeving.", as: "drivers", cluster: "Try Hard", moduleKey: "drivers" },
  { key: "please_others", label: "Dienstbaarheid en afstemming", beschrijving: "Gerichtheid op de noden van anderen, diplomatie en harmonie.", as: "drivers", cluster: "Please Others", moduleKey: "drivers" },

  // Talent-foci — H07 in het kandidaatrapport
  { key: "interrelatie", label: "Relationeel talent", beschrijving: "Aanvoelen wat speelt, netwerken opbouwen en moeilijkheden bespreekbaar maken.", as: "foci", cluster: "Interrelatie", moduleKey: "foci" },
  { key: "operatie", label: "Operationeel talent", beschrijving: "Denken omzetten in actie en daadkrachtig sturen, ook in crisis.", as: "foci", cluster: "Operatie", moduleKey: "foci" },
  { key: "strategie", label: "Strategisch talent", beschrijving: "Langetermijndoelen formuleren, het geheel overzien en vertalen naar structuur.", as: "foci", cluster: "Strategie", moduleKey: "foci" },
  { key: "innovatie", label: "Innovatief talent", beschrijving: "Nieuwe oplossingen bedenken en een organisatie een nieuwe richting geven.", as: "foci", cluster: "Innovatie", moduleKey: "foci" },

  // Talent-versnellers — H09 in het kandidaatrapport
  { key: "analyse", label: "Analytisch inzicht", beschrijving: "Complexe problemen ontwarren, chaos ordenen en logisch redeneren.", as: "versnellers", cluster: "Analyse", moduleKey: "versnellers" },
  { key: "coaching", label: "Coachend talent", beschrijving: "Mensen vanuit hun talenten laten groeien en sensitief begeleiden.", as: "versnellers", cluster: "Coaching", moduleKey: "versnellers" },
  { key: "onderscheiden", label: "Onderscheidend talent", beschrijving: "Visie en missie formuleren en een resultaatverbeterende bijdrage leveren.", as: "versnellers", cluster: "Onderscheiden", moduleKey: "versnellers" },
  { key: "faciliteren", label: "Facilitatietalent", beschrijving: "Mensen en teams door verandering begeleiden en verschillen afstemmen.", as: "versnellers", cluster: "Faciliteren", moduleKey: "versnellers" },
  { key: "impacteren", label: "Impact en beïnvloeding", beschrijving: "Mensen in beweging krijgen en met vertrouwen en charisma resultaten beïnvloeden.", as: "versnellers", cluster: "Impacteren", moduleKey: "versnellers" },
  { key: "resultaat", label: "Resultaatgerichtheid", beschrijving: "Afmaken wat begonnen is en onder druk tastbaar resultaat leveren.", as: "versnellers", cluster: "Resultaat", moduleKey: "versnellers" },

  // Zelfbeeld (aparte laag) — H04 in het kandidaatrapport
  { key: "introspect", label: "Zelfbeeld en innerlijke oriëntatie", beschrijving: "Zelfkennis, waardengedrevenheid en zelfzekerheid — een aparte laag, los van talent.", as: "zelfbeeld", cluster: "Introspect", moduleKey: "zelfbeeld" },
];

export function constructByKey(key: string): ConstructDef | undefined {
  return CONSTRUCTS.find((c) => c.key === key);
}

// ---------------------------------------------------------------------------
// Vervullingsniveau (§3.1): vertaling van nettoscore naar een leesbaar niveau.
// ---------------------------------------------------------------------------
export type Vervullingsniveau = "sterk" | "aanwezig" | "zwak" | "afwezig";

export function vervullingsniveau(net: number): Vervullingsniveau {
  if (net >= THRESHOLDS.sterk) return "sterk";
  if (net >= THRESHOLDS.aanwezig) return "aanwezig";
  if (net <= THRESHOLDS.afwezig) return "afwezig";
  return "zwak"; // −2..−1
}

export const VERVULLING_LABEL: Record<Vervullingsniveau, string> = {
  sterk: "Sterk aanwezig",
  aanwezig: "Aanwezig",
  zwak: "Zwak aanwezig",
  afwezig: "Afwezig / niet spontaan gekozen",
};

export const ENERGIE_LABEL: Record<EnergieStatus, string> = {
  geeft: "Geeft energie",
  neutraal: "Energieneutraal",
  kost: "Kost energie",
};

// ---------------------------------------------------------------------------
// Per-construct oordeel (§5).
// ---------------------------------------------------------------------------
export type Inhoudelijk = "sterk" | "voldoende" | "zwak" | "mismatch" | "plus" | "neutraal" | "signaal";
export type ConstructOordeel = "match" | "aandacht" | "mismatch" | "plus" | "neutraal" | "signaal";

export interface ConstructMeting {
  /** nettoscore zoals gemeten in het kandidaatrapport (ruwweg −6..+6) */
  net: number;
  /** energiestatus zoals gemeten */
  energie: EnergieStatus;
}

export interface ConstructResultaat {
  construct: ConstructDef;
  classificatie: Classificatie;
  kritisch: boolean;
  net: number;
  energie: EnergieStatus;
  niveau: Vervullingsniveau;
  inhoudelijk: Inhoudelijk;
  oordeel: ConstructOordeel;
  /** korte, leesbare motivatie van het constructoordeel */
  toelichting: string;
}

/** §5.1 inhoudelijke uitkomst + §5.2 beschikbaarheidsoverlay → constructoordeel. */
export function beoordeelConstruct(
  classificatie: Classificatie,
  meting: ConstructMeting
): { inhoudelijk: Inhoudelijk; oordeel: ConstructOordeel; toelichting: string } {
  const { net, energie } = meting;

  if (classificatie === "need") {
    // §5.1 inhoudelijk
    if (net >= THRESHOLDS.sterk) {
      // STERK — energie-overlay bepaalt match vs aandacht
      if (energie === "kost")
        return { inhoudelijk: "sterk", oordeel: "aandacht", toelichting: "Sterk aanwezig en gevraagd, maar de rol leunt op een lijn die de kandidaat energie kost — een waakpunt op duurzaamheid." };
      return { inhoudelijk: "sterk", oordeel: "match", toelichting: "Sterk aanwezig en de energie draagt deze gevraagde lijn." };
    }
    if (net >= THRESHOLDS.aanwezig) {
      // VOLDOENDE
      if (energie === "kost")
        return { inhoudelijk: "voldoende", oordeel: "aandacht", toelichting: "Herkenbaar aanwezig, maar deze gevraagde lijn kost de kandidaat energie — een waakpunt op duurzaamheid." };
      return { inhoudelijk: "voldoende", oordeel: "match", toelichting: "Herkenbaar aanwezig en beschikbaar voor de rol." };
    }
    if (net <= THRESHOLDS.afwezig) {
      // INHOUDELIJKE MISMATCH — energie irrelevant
      return { inhoudelijk: "mismatch", oordeel: "mismatch", toelichting: "De rol vraagt deze lijn uitgesproken, maar de kandidaat wijst die duidelijk af." };
    }
    // ZWAK (−2..−1) — altijd aandacht, ongeacht energie
    return { inhoudelijk: "zwak", oordeel: "aandacht", toelichting: "Onder de eis: de gevraagde lijn is geen voorkeursroute van de kandidaat en beperkt beschikbaar." };
  }

  if (classificatie === "nice") {
    if (net >= THRESHOLDS.aanwezig)
      return { inhoudelijk: "plus", oordeel: "plus", toelichting: "Niet vereist, maar aanwezig — een meerwaarde voor de rol." };
    return { inhoudelijk: "neutraal", oordeel: "neutraal", toelichting: "Niet vereist en niet uitgesproken aanwezig — geen impact op de match." };
  }

  // not-needed
  if (net >= THRESHOLDS.sterk)
    return { inhoudelijk: "signaal", oordeel: "signaal", toelichting: "Sterk talent dat de rol niet vraagt — mogelijke onderbenutting om in het oog te houden." };
  return { inhoudelijk: "neutraal", oordeel: "neutraal", toelichting: "De rol vraagt deze lijn niet; de aan- of afwezigheid is neutraal." };
}

// ---------------------------------------------------------------------------
// Het virtuele profiel per construct afleiden uit de answers van de sessie.
// Per cluster kan er meer dan één classificatie-item zijn. Regel:
//   - classificatie = de "zwaarste" gevraagde classificatie binnen het cluster
//     (need > nice > not-needed), zodat een gevraagde lijn nooit verdwijnt.
//   - kritisch = true zodra één item van het cluster als kritisch is gemarkeerd.
// Clusters zonder enige classificatie tellen niet mee (rol heeft er geen oordeel over).
// ---------------------------------------------------------------------------
export interface ProfielConstruct {
  construct: ConstructDef;
  classificatie: Classificatie;
  kritisch: boolean;
}

const ZWAARTE: Record<Classificatie, number> = { need: 3, nice: 2, "not-needed": 1 };

function itemsVoorCluster(moduleKey: string, cluster: string): string[] {
  const mod = MODULES.find((m) => m.key === moduleKey);
  if (!mod) return [];
  return mod.items.filter((i) => i.type === "classificatie" && i.cluster === cluster).map((i) => i.id);
}

export function profielPerConstruct(answers: Answer[]): ProfielConstruct[] {
  const byItem = new Map(answers.map((a) => [a.itemId, a]));
  const out: ProfielConstruct[] = [];
  for (const c of CONSTRUCTS) {
    const itemIds = itemsVoorCluster(c.moduleKey, c.cluster);
    let best: Classificatie | null = null;
    let kritisch = false;
    for (const id of itemIds) {
      const a = byItem.get(id);
      const cls = a?.classification as Classificatie | null | undefined;
      if (!cls) continue;
      if (best === null || ZWAARTE[cls] > ZWAARTE[best]) best = cls;
      if (a?.critical) kritisch = true;
    }
    if (best !== null) out.push({ construct: c, classificatie: best, kritisch });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Context- en risicokoppeling (§6).
// Spiegelt de contextvragen (M2/M3) en risicodrempels (M10) van het virtuele
// profiel aan de risicolaag van het kandidaatrapport.
// ---------------------------------------------------------------------------
export interface KandidaatContext {
  /** energiediscrepantie uit H03 (beleefd − gemeten); negatief = onderschatting/risico */
  energieDiscrepantie?: number | null;
  /** schakelt de kandidaat uit zichzelf snel terug? (herstel) */
  herstelTraag?: boolean | null;
  /** perfectionistische belasting gesignaleerd (H16)? */
  perfectionistischeBelasting?: boolean | null;
  /** scheve wederkerigheid gesignaleerd (H16)? */
  scheveWederkerigheid?: boolean | null;
}

export interface Risicovlag {
  key: string;
  label: string;
  toelichting: string;
}

function scaleVal(answers: Answer[], itemId: string): number | null {
  const a = answers.find((x) => x.itemId === itemId);
  const v = a?.contextValue;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function risicodrempelGehaald(answers: Answer[], itemId: string): boolean {
  // M10-drempels worden in de finalisatie als contextValue "gehaald" gemarkeerd
  return answers.find((x) => x.itemId === itemId)?.contextValue === "gehaald";
}

export function risicokoppeling(
  answers: Answer[],
  ctx: KandidaatContext,
  constructResultaten: ConstructResultaat[]
): Risicovlag[] {
  const vlaggen: Risicovlag[] = [];
  const r = (key: string, label: string, toelichting: string) => vlaggen.push({ key, label, toelichting });

  const prestatiedruk = scaleVal(answers, "M2-04"); // hoog?
  const herstelruimte = scaleVal(answers, "M2-06"); // laag?
  const autonomie = scaleVal(answers, "M3-01"); // hoog gevraagd?

  const negDiscrepantie = (ctx.energieDiscrepantie ?? 0) < 0;

  // Rij 1: hoge prestatiedruk × negatieve energiediscrepantie → prestatie/herstel
  if (prestatiedruk != null && prestatiedruk >= 4 && negDiscrepantie)
    r("prestatie_herstel", "Prestatie- en herstelrisico", "De rol kent hoge prestatiedruk en de kandidaat onderschat de eigen energiebelasting (negatieve energiediscrepantie).");

  // Rij 2: lage herstelruimte × kandidaat schakelt niet snel terug → duurzaamheid
  if (herstelruimte != null && herstelruimte <= 2 && ctx.herstelTraag)
    r("duurzaamheid", "Duurzaamheidsrisico", "De context biedt weinig herstelruimte en de kandidaat schakelt niet uit zichzelf snel terug.");

  // Rij 3: hoge autonomie gevraagd × Be Strong zwak/afgewezen bij kandidaat → regie-fit
  const beStrong = constructResultaten.find((x) => x.construct.key === "be_strong");
  if (autonomie != null && autonomie >= 4 && beStrong && (beStrong.niveau === "zwak" || beStrong.niveau === "afwezig"))
    r("regie_fit", "Aandacht: regie-fit", "De rol vraagt veel autonomie, maar zelfgekozen regie is bij de kandidaat zwak of afwezig.");

  // Rij 4: sterk relationele context × Interrelatie afwezig of kostend → relationele fit
  const wcRelationeel = answers.some((a) => (a.itemId === "WC-03" || a.itemId === "WC-05") && a.contextValue === "kritisch");
  const interrel = constructResultaten.find((x) => x.construct.key === "interrelatie");
  if (wcRelationeel && interrel && (interrel.niveau === "afwezig" || interrel.energie === "kost"))
    r("relationele_fit", "Aandacht: relationele fit", "De rol leunt sterk op samenwerking, maar relationeel talent is bij de kandidaat afwezig of kostend.");

  // §6.2 expliciete risicodrempel-koppeling: M10-02 (prestatiedruk × herstel) +
  // perfectionistische belasting / scheve wederkerigheid uit H16.
  if (risicodrempelGehaald(answers, "M10-02") && ctx.perfectionistischeBelasting)
    r("druk_perfectie", "Perfectionistische belasting onder druk", "De gemarkeerde risicodrempel (prestatiedruk × lage herstelruimte) valt samen met perfectionistische belasting bij de kandidaat.");

  if (ctx.scheveWederkerigheid)
    r("wederkerigheid", "Scheve wederkerigheid", "Het kandidaatrapport signaleert een scheve wederkerigheid die in deze context aandacht vraagt.");

  return vlaggen;
}

// ---------------------------------------------------------------------------
// Aggregatie tot eindoordeel (§7).
// ---------------------------------------------------------------------------
export type Eindoordeel = "match" | "aandacht" | "mismatch";

export interface MatchUitkomst {
  eindoordeel: Eindoordeel;
  motivatie: string;
  /** verplichte motivatie vereist (bij oker/rood op kritisch punt) */
  motivatieVerplicht: boolean;
  constructen: ConstructResultaat[];
  risicovlaggen: Risicovlag[];
  // tellingen voor het rapport
  needTotaal: number;
  needMatch: number;
  needAandacht: number;
  needMismatch: number;
  kritischTotaal: number;
  /** needs die inhoudelijk volstaan maar op energie kosten (de "vanzelfsprekendheid" die niet vanzelfsprekend blijkt) */
  energiewaakpunten: number;
}

export const EINDOORDEEL_LABEL: Record<Eindoordeel, string> = {
  match: "Match",
  aandacht: "Match met aandacht",
  mismatch: "Mismatch",
};

export interface MatchInput {
  answers: Answer[];
  /** gemeten nettoscore + energie per construct-key (uit het geverifieerde kandidaatrapport) */
  metingen: Record<string, ConstructMeting>;
  context: KandidaatContext;
}

export function berekenMatch(input: MatchInput): MatchUitkomst {
  const { answers, metingen, context } = input;
  const profiel = profielPerConstruct(answers);

  const constructen: ConstructResultaat[] = [];
  for (const p of profiel) {
    const meting = metingen[p.construct.key];
    if (!meting) continue; // geen meetwaarde → kan niet beoordeeld worden
    const niveau = vervullingsniveau(meting.net);
    const { inhoudelijk, oordeel, toelichting } = beoordeelConstruct(p.classificatie, meting);
    constructen.push({
      construct: p.construct,
      classificatie: p.classificatie,
      kritisch: p.kritisch,
      net: meting.net,
      energie: meting.energie,
      niveau,
      inhoudelijk,
      oordeel,
      toelichting,
    });
  }

  const risicovlaggen = risicokoppeling(answers, context, constructen);

  // Tellingen op need-lijnen
  const needs = constructen.filter((c) => c.classificatie === "need");
  const needTotaal = needs.length;
  const needMatch = needs.filter((c) => c.oordeel === "match").length;
  const needAandacht = needs.filter((c) => c.oordeel === "aandacht").length;
  const needMismatch = needs.filter((c) => c.oordeel === "mismatch").length;
  const kritisch = needs.filter((c) => c.kritisch);
  const kritischTotaal = kritisch.length;
  const energiewaakpunten = needs.filter((c) => (c.inhoudelijk === "sterk" || c.inhoudelijk === "voldoende") && c.energie === "kost").length;

  const structureelRisico = risicovlaggen.length >= 3;
  const kritischMismatch = kritisch.some((c) => c.oordeel === "mismatch");
  const kritischAandacht = kritisch.some((c) => c.oordeel === "aandacht");

  // §7.2 beslisregels
  let eindoordeel: Eindoordeel;
  let motivatie: string;

  if (kritischMismatch || structureelRisico) {
    eindoordeel = "mismatch";
    if (kritischMismatch && structureelRisico)
      motivatie = "Een kritisch succescriterium scoort een inhoudelijke mismatch én er is een structureel duurzaamheidsrisico (drie of meer samenvallende risicovlaggen).";
    else if (kritischMismatch)
      motivatie = "Een kritisch gemarkeerde need scoort een inhoudelijke mismatch: de rol leunt op een lijn die de kandidaat duidelijk afwijst.";
    else
      motivatie = "Structureel duurzaamheidsrisico: drie of meer risicovlaggen vallen samen, ongeacht hoe sterk het inhoudelijke talentbeeld is.";
  } else if (
    kritischAandacht ||
    (needTotaal > 0 && needAandacht > needTotaal / 3) ||
    (risicovlaggen.length >= 1 && risicovlaggen.length <= 2)
  ) {
    eindoordeel = "aandacht";
    const redenen: string[] = [];
    if (kritischAandacht) redenen.push("een kritische need vraagt aandacht (zwak, of sterk maar energie-kostend)");
    if (needTotaal > 0 && needAandacht > needTotaal / 3) redenen.push("meer dan een derde van de needs vraagt aandacht");
    if (risicovlaggen.length >= 1 && risicovlaggen.length <= 2) redenen.push(`${risicovlaggen.length} actieve risicovlag${risicovlaggen.length > 1 ? "gen" : ""}`);
    motivatie = "Geen mismatch, maar er zijn waakpunten: " + redenen.join("; ") + ".";
  } else {
    eindoordeel = "match";
    motivatie =
      kritischTotaal > 0
        ? "Alle kritische succescriteria scoren een match, het merendeel van de needs is groen en er is geen actieve risicovlag. De aanname \u201cbegint met energie\u201d wordt op de dragende lijnen bevestigd."
        : "Het merendeel van de needs scoort een match en er is geen actieve risicovlag.";
  }

  const motivatieVerplicht = eindoordeel !== "match" && (kritischMismatch || kritischAandacht);

  return {
    eindoordeel,
    motivatie,
    motivatieVerplicht,
    constructen,
    risicovlaggen,
    needTotaal,
    needMatch,
    needAandacht,
    needMismatch,
    kritischTotaal,
    energiewaakpunten,
  };
}
