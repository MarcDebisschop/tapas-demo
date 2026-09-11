/**
 * Flagship HDD report content + assembly.
 *
 * Rule of this module
 * -------------------
 * The chapter framework is fixed: the same reading order, the same figures and
 * the same appendix for every trajectory. The statements inside the chapters are
 * built from the measured aggregate only. There is no specimen company, no
 * example leader and no illustrative figure anywhere in this file. Where an
 * instrument produced nothing, the chapter says so in words and the matching
 * figure is skipped rather than filled with a plausible-looking value.
 *
 * Two variants: investor (includes the decision chapter) and team (does not).
 * Chapter numbers are assigned at assembly time, so the team variant never shows
 * a gap where the investor-only chapter would sit.
 */
import { ACCENT, GOLD, GREEN, AMBER, MM } from "./theme";
import { Layout } from "./layout";
import {
  para, lead, subhead, bullets, chapterHeading, callout, dataTable,
  memberCards, hardQa, figureCaption, CardSpec,
} from "./primitives";
import {
  VisualData,
  drawPyramid, drawSliders, drawConflict, drawEnergy, drawStratum,
  drawScorecard, drawKeyPerson,
} from "./visuals";

export type Audience = "investor" | "team";

export interface FlagshipMeta {
  date: string;
  confidentiality: string;
  company: string;
  /** Variable label for the investing party; never a fixed house name. */
  investorLabel: string;
  context: string;
  basis: string;
  variant: string;      // "Investor Report" | "Team Report"
  recipient: string;
  subject: string;
}

export interface FlagshipIndex {
  value: number;
  band: string;
  verdict: string;       // proceed | conditional | hold
  verdictShort: string;
  pillSub: string;
  /** Cover label in front of the verdict: RECOMMENDATION for the investor variant. */
  pillLabel: string;
}

/**
 * Every field here is measured or null. A null means the instrument that would
 * produce it did not run, or ran without a usable answer.
 */
export interface FlagshipFacts {
  // growth ambition, narrative only and only when the caller supplied it
  revenueNow: string | null;
  revenueTarget: string | null;
  fteFrom: number | null;
  fteTo: number | null;
  // Lencioni pillar averages
  trust: number | null;
  conflict: number | null;
  commitment: number | null;
  accountability: number | null;
  results: number | null;
  // group and dimension readings
  n: number;
  teamHealthMean: number | null;
  teamHealthBand: string;
  energyMean: number | null;
  energyBand: string | null;
  energyMissing: number;
  energyDispersion: number | null;
  talentBand: string;
  thinFamilies: string[];
  coverage: Record<string, number>;
  driverFreq: Record<string, number>;
  driverHighRiskCount: number;
  requiredStratum: number | null;
  teamMaxStratum: number | null;
  fit: string;
  stratumNote: string;
  memberNames: string[];
  minNMet: boolean;
  indexBasis: string;
}

export interface FlagshipInput {
  audience: Audience;
  meta: FlagshipMeta;
  index: FlagshipIndex;
  facts: FlagshipFacts;
  cards: CardSpec[];
  visuals: VisualData;
}

// ===================================================================
// Small formatting helpers - all of them fail loudly into words rather
// than into a number that was never measured.
// ===================================================================
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

function roman(n: number | null): string {
  if (n === null || n < 1 || n >= ROMAN.length) return "not set";
  return ROMAN[n];
}

function score2(v: number | null): string {
  return v === null ? "not measured" : v.toFixed(2);
}

function pillarBand(v: number | null, hi: number, mid: number): string {
  if (v === null) return "n/a";
  return v >= hi ? "High" : v >= mid ? "Average" : "Low";
}

/** Human list: "A", "A and B", "A, B and C". */
function lijst(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function coverageSplit(cov: Record<string, string | number>) {
  const strong: string[] = [], single: string[] = [], absent: string[] = [];
  Object.keys(cov).forEach((k) => {
    const c = Number(cov[k]) || 0;
    if (c >= 2) strong.push(k);
    else if (c === 1) single.push(k);
    else absent.push(k);
  });
  return { strong, single, absent };
}

/** Drivers carried by at least one member, most frequent first. */
function driverRanking(freq: Record<string, number>): [string, number][] {
  return Object.entries(freq)
    .filter(([, c]) => Number(c) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
}

function groupCaution(f: FlagshipFacts): string {
  return f.minNMet
    ? `The reading covers ${f.n} member(s); figures are group averages and are read as a pattern, not as a verdict on any individual.`
    : `The reading covers only ${f.n} member(s), below the minimum for a stable group reading. Nothing is withheld, but every figure in this report is indicative and must be read together with the interviews.`;
}

// ===================================================================
// Chapter builders - each receives its own number
// ===================================================================
function chExecutive(L: Layout, fi: FlagshipInput, no: number) {
  const { audience, facts: f, index, meta } = fi;
  chapterHeading(L, `Chapter ${no} \u00b7 Executive Verdict`,
    "The Reading, in One Page",
    "What the measured human-capital picture says before turning a page.");

  if (audience === "investor") {
    lead(L,
      `${index.verdictShort}. On human-capital grounds the composite reading for ${meta.company} lands at ` +
      `${index.value}/100 (${index.band}), built from ${f.indexBasis}. Team health reads ` +
      `${score2(f.teamHealthMean)} (${f.teamHealthBand}) and talent coverage reads ${f.talentBand}. ` +
      `${groupCaution(f)}`);
  } else {
    lead(L,
      `This is a development mirror, not a judgement. The composite reading lands at ${index.value}/100 ` +
      `(${index.band}), with team health at ${score2(f.teamHealthMean)} (${f.teamHealthBand}) and talent ` +
      `coverage at ${f.talentBand}. ${groupCaution(f)}`);
  }

  L.guardMm(58);
  subhead(L, "What the measurement shows");
  const cov = coverageSplit(f.coverage);
  const punten: string[] = [];
  punten.push(
    `<b>Group and basis.</b> ${f.n} member(s) took part: ${lijst(f.memberNames)}. ` +
    `The composite index is built from ${f.indexBasis}.`);
  if (cov.strong.length) {
    punten.push(
      `<b>Redundant capability.</b> ${lijst(cov.strong)} ${cov.strong.length === 1 ? "is" : "are"} carried by ` +
      `two or more members, so leadership on ${cov.strong.length === 1 ? "that theme" : "those themes"} can be handed over.`);
  }
  if (cov.single.length || cov.absent.length) {
    const stukken: string[] = [];
    if (cov.single.length) stukken.push(`${lijst(cov.single)} rests on a single member`);
    if (cov.absent.length) stukken.push(`${lijst(cov.absent)} is not carried by anyone in this group`);
    punten.push(`<b>Concentration.</b> ${lijst(stukken)}. This is where depth has to be built.`);
  }
  if (f.energyMean !== null) {
    punten.push(
      `<b>Energy.</b> Team mean ${f.energyMean.toFixed(1)}/10 (${f.energyBand ?? "no band"})` +
      `${f.energyDispersion !== null ? `, dispersion ${f.energyDispersion.toFixed(1)}` : ""}` +
      `${f.energyMissing > 0 ? `, with ${f.energyMissing} member(s) without an energy reading` : ""}.`);
  } else {
    punten.push(
      "<b>Energy.</b> No member carried an energy reading on the 0-10 scale, so this report makes no " +
      "statement about energy sustainability. The energetic behaviour profile is reported separately.");
  }
  punten.push(
    `<b>Work complexity.</b> ${f.stratumNote} Highest indicative stratum in the group: ` +
    `${roman(f.teamMaxStratum)}; level implied by the ambition: ${roman(f.requiredStratum)}.`);
  bullets(L, punten);

  if (audience === "investor") {
    L.guardMm(50);
    subhead(L, "What still has to be verified");
    bullets(L, [
      "<b>Roles and authority.</b> Confirm the formal authority and profit-and-loss responsibility " +
      "behind each role named in this report; the assessment reads capability, not mandate.",
      "<b>Trend behind the snapshot.</b> Ask for turnover, engagement and earlier energy readings. " +
      "Every instrument here is a point in time and cannot show a direction on its own.",
      `<b>Governance appetite.</b> Establish whether ${meta.investorLabel} intends to act as an active ` +
      "governance partner, because the interventions in the final chapter assume that role.",
    ]);
  }

  L.advance(4);
  callout(L, "How to read this verdict",
    "The index is a weighted composite of the dimensions that were actually measured. It ranks nothing " +
    "and predicts nothing. It points a reader at the two or three places where this specific group is " +
    "strong and the two or three where it is thin, so the conversation starts in the right place.",
    GOLD, "#faf5e8");
  L.newBodyPage();
}

function chScorecard(L: Layout, fi: FlagshipInput, no: number) {
  const { audience, facts: f, visuals } = fi;
  chapterHeading(L, `Chapter ${no} \u00b7 The Capability Scorecard`,
    "What the Plan Requires of the People",
    "Each outcome, the capability it demands, and the members who carry it today.");
  if (audience === "investor") {
    para(L,
      "A human due-diligence report that grades leaders in the abstract answers the wrong question. It " +
      "tells you whether these are capable executives; it does not tell you whether they are the right " +
      "group to execute <i>this</i> plan. So the report begins with the scorecard: per outcome, the " +
      "capability it demands, where that capability actually sits in this group, and the measured bench " +
      "strength behind it. Every chapter that follows is read against this anchor.");
  } else {
    para(L,
      "Before describing the team, this chapter makes explicit what the team is being asked to do. The " +
      "scorecard translates the ambition into outcomes and names, per outcome, the members who carry " +
      "the capability today. It is the yardstick the rest of the report measures against.");
  }
  if (f.revenueNow || f.revenueTarget || f.fteFrom !== null) {
    L.guardMm(28);
    subhead(L, "The ambition, as it was given to us");
    const delen: string[] = [];
    if (f.revenueNow && f.revenueTarget) delen.push(`from ${f.revenueNow} to ${f.revenueTarget}`);
    else if (f.revenueTarget) delen.push(`toward ${f.revenueTarget}`);
    if (f.fteFrom !== null && f.fteTo !== null) delen.push(`from ${f.fteFrom} to ${f.fteTo} FTE`);
    callout(L, "Stated ambition",
      `Scale ${lijst(delen)}. These figures come from the engagement brief, not from the assessment; ` +
      "they are used only to set the level of work complexity the plan implies.", ACCENT);
    L.advance(4);
  }
  if (visuals.scorecard.length) {
    drawScorecard(L, visuals.scorecard);
    figureCaption(L,
      `Figure ${no}.1 - Capability scorecard. Per outcome: the capability it demands, the members who ` +
      "carry it today, and the measured coverage (Covered / Partial / Build).");
    L.advance(6);
    L.guardMm(40);
    subhead(L, "Reading the scorecard");
    const cov = coverageSplit(f.coverage);
    const regels: string[] = [];
    if (cov.strong.length) {
      regels.push(`<b>Covered.</b> ${lijst(cov.strong)} - two or more members carry this, so the outcome does ` +
        "not depend on one person staying.");
    }
    if (cov.single.length) {
      regels.push(`<b>Partial.</b> ${lijst(cov.single)} - present, but on one pair of shoulders. This needs ` +
        "depth, not rescue.");
    }
    if (cov.absent.length) {
      regels.push(`<b>Build.</b> ${lijst(cov.absent)} - nobody in this group carries it as a leading strength. ` +
        "This is built deliberately, through development or a complementary hire.");
    }
    regels.push("<b>Rows that are absent.</b> Cognitive fit appears only when a required level of work " +
      "complexity was set, and the energy row only when an energy reading exists. A missing row means a " +
      "missing measurement, never a good score.");
    bullets(L, regels);
  } else {
    callout(L, "No scorecard could be built",
      "None of the participating members carried a scored talent profile, so there is nothing to place " +
      "against the outcomes. The scorecard is deliberately left empty rather than filled with " +
      "assumptions.", AMBER, "#fbf3ea");
  }
  L.newBodyPage();
}

function chWhy(L: Layout, _fi: FlagshipInput, no: number) {
  chapterHeading(L, `Chapter ${no} \u00b7 Why We Measure What We Measure`,
    "Every Measurement Earns Its Place",
    "Before a single score, the scientific case for each instrument in this assessment.");
  para(L,
    "A human due-diligence report that shows numbers without justifying them is an opinion in a suit. " +
    "This chapter states, for each measurement, what it captures and why it belongs in a decision of " +
    "this magnitude. The references are to the primary research, not to secondary summaries.");
  L.advance(2);
  dataTable(L, {
    headers: ["Measurement", "Why it belongs in an HDD", "Primary source"],
    rows: [
      ["Psychological safety (foundation)",
        "The scientific bedrock beneath trust; Google's #1 predictor of team effectiveness; drives the learning behaviour that produces performance.",
        "Edmondson, ASQ 1999; Google re:Work"],
      ["Lencioni team health",
        "Healthy teams are roughly twice as likely to post above-median financial performance; dysfunction cascades across all five layers.",
        "McKinsey 2025; Ballard 2008"],
      ["Kahler drivers (PCM)",
        "Predict failure modes under scaling pressure and expose destructive driver conflicts before they surface as turnover.",
        "Kahler; Totem Consulting"],
      ["Talent foci &amp; accelerators",
        "Show whether the group covers the capabilities the ambition demands; complementarity lowers single-point-of-failure risk.",
        "TaPas 4 Professional (internal model)"],
      ["Jaques stratum",
        "Detects the \u201cfounder ceiling\u201d: is cognitive work-complexity sufficient for the ambition? Correlates r=+0.87 with hierarchical level.",
        "Jaques; Global RO"],
      ["Energy on the 0-10 scale",
        "Burnout costs $5M+ per 1,000 staff annually and spreads; a snapshot misleads - dispersion is what matters.",
        "Maslach/MBI; Bakker contagion"],
      ["2MINSCAN energetic behaviour profile",
        "Reads colour order and position, not a level: it shows which behaviour costs energy and which gives it, and is reported as its own document.",
        "TaPas 2MINSCAN (internal model)"],
      ["Composite index",
        "A weighted composite is more reliable than any single subscore; banded sub-scores retain diagnostic information.",
        "Bobko et al. 2007"],
      ["Non-ranking ethic",
        "Forced ranking destroys teams, discriminates, and breaches GDPR Art. 22; output is indicative, never a league table of people.",
        "Global RO; ICO/GDPR"],
    ],
    colFracs: [0.27, 0.49, 0.24],
  });
  L.advance(6);
  callout(L, "How to read this report",
    "Each chapter follows the same logic: a statement, the measured evidence behind it, a figure, and a " +
    "conclusion that stays inside what was measured. Where an instrument did not run, the chapter says " +
    "so instead of narrowing the gap with words.", ACCENT);
  L.newBodyPage();
}

function chHealth(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  const { hi, mid } = fi.visuals.pyramid;
  chapterHeading(L, `Chapter ${no} \u00b7 Team Health Architecture`,
    "The Six-Level Foundation",
    "Psychological safety beneath the five Lencioni dimensions - and what the base layer reveals.");
  para(L,
    "Team health is not a single score; it is a structure. Patrick Lencioni's five dimensions form a " +
    "dependency chain - trust enables healthy conflict, which enables commitment, accountability and a " +
    "focus on collective results. Beneath all five sits a sixth, evidence-based layer: psychological " +
    "safety, the condition Amy Edmondson identified and Google's Project Aristotle confirmed as the " +
    "single strongest predictor of team effectiveness. That base layer is read qualitatively; the five " +
    "above it are measured.");
  drawPyramid(L, fi.visuals.pyramid);
  figureCaption(L,
    `Figure ${no}.1 - Six-level team-health model with the measured pillar averages. Band lines: ` +
    `High from ${hi.toFixed(2)}, Average from ${mid.toFixed(2)}. The psychological-safety foundation is ` +
    "assessed qualitatively and carries no figure.");
  L.advance(6);
  L.guardMm(60);
  subhead(L, "Reading the base layer");
  if (f.trust !== null) {
    para(L,
      `The base layer carries more information than any layer above it, so it is read first. Trust reads ` +
      `${score2(f.trust)} (${pillarBand(f.trust, hi, mid)}). Read as behaviour rather than as a grade, a ` +
      "trust level in this band means members can voice doubt or admit not knowing without losing " +
      "standing, so mistakes surface early enough to be useful. A lower reading does not mean bad " +
      "intentions; it means the group has not yet made it safe to be wrong out loud.");
    para(L,
      "An honest reading also names the shadow side of a high base. Where trust and pace are both high, " +
      "candour can drift into bluntness under load, and shared standards can make peer feedback " +
      "reinforce overdrive rather than challenge it. That is a pattern to watch, not a finding: this " +
      "assessment measures the level, and the interviews test the behaviour behind it.");
  } else {
    para(L,
      "The Lencioni questionnaire produced no usable pillar averages for this group, so the pyramid " +
      "shows the levels without figures. No statement is made about team health in this report; the " +
      "table below is left empty on purpose.");
  }
  L.advance(2);
  dataTable(L, {
    headers: ["Dimension", "Score", "Band", "What the dimension indicates"],
    rows: [
      ["Trust", score2(f.trust), pillarBand(f.trust, hi, mid),
        "Vulnerability-based trust; whether mistakes are surfaced or hidden"],
      ["Healthy Conflict", score2(f.conflict), pillarBand(f.conflict, hi, mid),
        "Whether ideas are debated and differences treated as information"],
      ["Commitment", score2(f.commitment), pillarBand(f.commitment, hi, mid),
        "Whether decisions are supported once taken, including by those who differed"],
      ["Accountability", score2(f.accountability), pillarBand(f.accountability, hi, mid),
        "Whether peers hold peers to the agreed standard"],
      ["Results", score2(f.results), pillarBand(f.results, hi, mid),
        "Whether attention goes to the collective outcome rather than to position"],
    ],
    colFracs: [0.24, 0.12, 0.11, 0.53], bandCol: 2,
  });
  L.advance(6);
  callout(L, "The watch-point behind a strong reading",
    "Strong commitment can mask over-commitment: people cross their own boundaries to deliver, which " +
    "delays the recognition of exhaustion. Whether that is happening here is a question for the energy " +
    "chapter and the interviews, not something the team-health figure can answer.",
    AMBER, "#fbf3ea");
  L.newBodyPage();
}

function chIndividual(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  chapterHeading(L, `Chapter ${no} \u00b7 Individual Capability`,
    `${f.n} Profile(s), Read as One System`,
    "Talent sequence, accelerators, drivers, indicative stratum and energy per member.");
  para(L,
    "Capability is read per member and then as a system. The cards below summarise each profile in the " +
    "member's own measured order: talent foci first, then accelerators, then DRIVER(S). Drivers are " +
    "stated in their original Process-Communication terms and are never translated. A card that reads " +
    "\u201cno scored profile available\u201d means that member did not complete the instrument.");
  memberCards(L, fi.cards);
  L.advance(3);
  const cov = coverageSplit(f.coverage);
  const delen: string[] = [];
  if (cov.strong.length) delen.push(`${lijst(cov.strong)} ${cov.strong.length === 1 ? "is" : "are"} carried by more than one member`);
  if (cov.single.length) delen.push(`${lijst(cov.single)} rests on one member`);
  if (cov.absent.length) delen.push(`${lijst(cov.absent)} is not carried in this group`);
  callout(L, "Structural reading",
    delen.length
      ? `Across the profiles: ${lijst(delen)}. Complementarity is what lowers dependence on any single ` +
        "person; the concentration chapter names the exposures that follow from this pattern."
      : "No scored profiles were available, so no structural reading of complementarity can be given.",
    ACCENT);
  L.newBodyPage();
}

function chPotential(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  chapterHeading(L, `Chapter ${no} \u00b7 Collective Strength`,
    "The Group Position on Each Axis",
    "Talent foci, accelerators and drivers as horizontal sliders: position and dispersion.");
  para(L,
    "Individual profiles answer \u201cwho is strong at what.\u201d The collective question is different: where is " +
    "this group, as a unit, strong, and where is it thin? The slider view places the group position on " +
    "each axis with a dispersion band. A high position on a narrow band is a dependable group " +
    "capability; a high position on a wide band means the strength rests on one or two people. Foci are " +
    "weighted by their rank in each member's own sequence; accelerators and drivers are the share of " +
    "members who carry them.");
  if (fi.visuals.sliders.length) {
    // De figuurhoogte krimpt tot wat er na de figuur nog nodig is voor de legende
    // en de leesregels; zo blijft de staart op hetzelfde blad en volgt er geen
    // bijna leeg vervolgblad.
    const staartMm = 62;
    const ruimteMm = L.remaining() / MM;
    const maxHmm = Math.max(120, Math.min(200, ruimteMm - staartMm));
    drawSliders(L, fi.visuals.sliders, maxHmm);
    figureCaption(L,
      `Figure ${no}.1 - Collective position across talent foci, accelerators and DRIVER(S). Marker = ` +
      `group position; shaded band = dispersion across ${f.n} member(s).`);
    L.advance(4);
    L.guardMm(50);
    subhead(L, "Where this group is strong, and where it is exposed");
    const cov = coverageSplit(f.coverage);
    const regels: string[] = [];
    if (cov.strong.length) regels.push(`<b>Dependable.</b> ${lijst(cov.strong)} - carried by more than one member.`);
    if (cov.single.length) regels.push(`<b>Carried by one.</b> ${lijst(cov.single)} - dependable today, not redundant.`);
    if (cov.absent.length) regels.push(`<b>Absent.</b> ${lijst(cov.absent)} - no member carries this as a leading focus.`);
    const dr = driverRanking(f.driverFreq);
    if (dr.length) {
      const top = dr.slice(0, 3).map(([d, c]) => `${d} (${c}/${f.n})`);
      regels.push(`<b>Driver mix.</b> Most frequent: ${lijst(top)}. Frequency says how widely a driver is ` +
        "shared, never how good it is.");
    }
    bullets(L, regels);
  } else {
    callout(L, "No collective position could be built",
      "No member carried a scored talent profile, so there is no group position to place on the axes. " +
      "The figure is omitted rather than drawn from assumptions.", AMBER, "#fbf3ea");
  }
  L.newBodyPage();
}

function chDynamics(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  chapterHeading(L, `Chapter ${no} \u00b7 Dynamics &amp; Energy`,
    "How the Group Behaves When the Load Rises",
    "The energetic behaviour reading, the energy map, and the caveats that keep both honest.");
  subhead(L, "The energetic behaviour reading");
  para(L,
    "The 2MINSCAN reads energetic behaviour: which behaviour gives this person energy and which costs " +
    "it. It is deliberately not a figure on the 0-10 energy scale and it says nothing about talent, " +
    "potential or suitability. Because it is a behavioural reading rather than a level, the individual " +
    "scans are read together as one energetic team profile in a separate document in this dossier, " +
    "under the same claim limit. This chapter therefore reports only what the group-level energy " +
    "reading supports.");
  L.advance(2);
  L.guardMm(58);
  subhead(L, "Energy: a point-in-time signal");
  if (f.energyMean !== null) {
    drawEnergy(L, fi.visuals.energy);
    figureCaption(L,
      `Figure ${no}.1 - Self-rated energy per member on the 0-10 scale. Group mean ` +
      `${f.energyMean.toFixed(1)}/10` +
      `${f.energyDispersion !== null ? `, dispersion ${f.energyDispersion.toFixed(1)}` : ""}` +
      `${f.energyMissing > 0 ? `, ${f.energyMissing} member(s) without a reading` : ""}.`);
    L.advance(3);
    para(L,
      `The group mean reads ${f.energyMean.toFixed(1)}/10 (${f.energyBand ?? "no band"}). Two cautions keep ` +
      "this honest. First, a mean hides an individual: one member sliding toward exhaustion barely " +
      "moves the average, which is why dispersion and repeated measurement matter more than the " +
      "headline figure. Second, timing matters - a reading taken just after a quiet period will " +
      "understate peak-season load. This is a snapshot, and a snapshot cannot show a direction.");
  } else {
    para(L,
      "No participating member carried an energy reading on the 0-10 scale, because that scale is only " +
      "produced by instruments that actually ask about energy. The energy figure is therefore omitted " +
      "and this report makes no statement about energy sustainability. To close that gap, add an " +
      "instrument with an energy scale for the whole group and repeat it at least once.");
  }
  if (fi.audience === "investor") {
    L.advance(3);
    callout(L, "What to ask for before relying on this",
      "A single reading cannot distinguish a structural level from a temporary rebound. Ask for earlier " +
      "energy measurements, voluntary-turnover data and engagement results, and for the practices that " +
      "are supposed to protect recovery. Whether those practices exist is a question for the " +
      "management interviews; this assessment cannot see them.", GREEN, "#eef6f1");
  }
  L.newBodyPage();
}

function chAlerts(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  chapterHeading(L, `Chapter ${no} \u00b7 Driver Tensions, Blind Spots &amp; Coachability`,
    "What Could Rub, and Whether It Can Be Coached",
    "The friction the driver mix predicts, the things a group like this tends not to see, and its receptiveness to correction.");
  subhead(L, "Driver tensions");
  para(L,
    "Drivers are energising in balance and costly in collision. Only tensions whose two drivers are " +
    "both actually present in this group are listed, with the measured counts as evidence. A tension is " +
    "a predictable friction point, not an observed conflict, and it is never a statement about a named " +
    "pair of people.");
  if (fi.visuals.conflict.length) {
    drawConflict(L, fi.visuals.conflict);
    figureCaption(L,
      `Figure ${no}.1 - Driver tensions present in this group. Severity reflects how widely both sides ` +
      "of the tension are carried.");
    L.advance(6);
  } else {
    callout(L, "No driver tension is present",
      "No pair of opposing drivers is carried within this group, so no tension is listed. That is a " +
      "measured absence, not a clean bill of health: friction can still arise from role design, " +
      "workload or history, none of which this instrument measures.", ACCENT);
    L.advance(4);
  }
  // De staart van dit kapittel (blinde vlekken plus coachbaarheid) blijft samen:
  // breekt hij, dan breekt hij in zijn geheel, zodat geen van beide bladen bijna
  // leeg overblijft.
  L.guardMm(112);
  subhead(L, "Blind spots that follow from this driver mix");
  const dr = driverRanking(f.driverFreq);
  const blind: string[] = [];
  const heeft = (naam: string) => dr.some(([d]) => d.toUpperCase().includes(naam));
  if (heeft("BE STRONG")) {
    blind.push("<b>Signals of strain are under-reported.</b> Where Be Strong is widely carried, people " +
      "keep difficulty to themselves, so early signs of overload reach the table late.");
  }
  if (heeft("TRY HARD")) {
    blind.push("<b>Effort can substitute for prioritisation.</b> Try Hard is about wanting to show what " +
      "one can do; under load that shows up as taking on more rather than choosing.");
  }
  if (heeft("BE PERFECT")) {
    blind.push("<b>Good enough is hard to declare.</b> Be Perfect raises quality and slows release; " +
      "without an explicit standard, deadlines absorb the difference.");
  }
  if (heeft("HURRY UP")) {
    blind.push("<b>Speed outruns documentation.</b> Hurry Up gets decisions made quickly and leaves " +
      "the record thin, which becomes a governance problem later rather than sooner.");
  }
  if (heeft("PLEASE OTHERS")) {
    blind.push("<b>Disagreement is softened.</b> Please Others keeps the room comfortable, which can " +
      "leave a real objection unsaid until it surfaces as slippage.");
  }
  if (f.thinFamilies.length) {
    blind.push(`<b>A thin capability is a blind spot too.</b> ${lijst(f.thinFamilies)} is carried by no one ` +
      "here, so the work it represents tends to be noticed only when it is already late.");
  }
  if (blind.length === 0) {
    blind.push("<b>No driver-based blind spot can be named.</b> The instrument produced no driver " +
      "frequencies for this group, so this section stays empty rather than generic.");
  }
  bullets(L, blind);
  L.advance(4);
  L.guardMm(34);
  subhead(L, "Coachability");
  if (f.trust !== null && f.conflict !== null) {
    para(L,
      `Coachability is read from the two pillars that decide whether correction is heard: Trust at ` +
      `${score2(f.trust)} and Healthy Conflict at ${score2(f.conflict)}. In these bands, feedback is more ` +
      "likely to be received as information than as threat. The condition attached is style rather than " +
      "capability: a group with this driver mix engages with correction that is evidence-based, " +
      "concrete and quick, and disengages from correction that is abstract or moralising.");
  } else {
    para(L,
      "Coachability cannot be read here: it rests on the trust and healthy-conflict pillars, and neither " +
      "produced a usable figure for this group. The question belongs in the interviews.");
  }
  L.newBodyPage();
}

function chCognitive(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  chapterHeading(L, `Chapter ${no} \u00b7 Cognitive Capacity Map`,
    "Is the Work Complexity a Match for the Ambition?",
    "Jaques stratum: the required level of work complexity against the group's indicative strata.");
  para(L,
    "Elliott Jaques' Stratified Systems Theory reads the complexity of work a person can hold by the " +
    "longest time span of discretion they can manage. It is the cleanest instrument for the ceiling " +
    "question: does this group hold the complexity the ambition implies? The map is strictly " +
    "indicative, derived from the talent profile, and it ranks no one, in line with the ethics charter " +
    "in the appendix.");
  if (fi.visuals.stratum.rows.length) {
    drawStratum(L, fi.visuals.stratum);
    figureCaption(L,
      `Figure ${no}.1 - Indicative work-complexity map. Highest indicative stratum in the group: ` +
      `${roman(f.teamMaxStratum)}. Level implied by the ambition: ${roman(f.requiredStratum)}.`);
    L.advance(6);
    callout(L, `What the verdict \u201c${f.fit}\u201d means in practice`,
      `${f.stratumNote} A gap here is not a judgement on anyone: work complexity is closed through role ` +
      "design, board composition and one or two complementary senior appointments, and it is one of the " +
      "few findings in this report with a direct, practical answer.", AMBER, "#fbf3ea");
  } else {
    callout(L, "No capacity map could be built",
      "No member carried a scored talent profile, so no indicative stratum could be derived and the map " +
      "is omitted. Without it, the ceiling question stays open rather than being answered by " +
      "impression.", AMBER, "#fbf3ea");
  }
  L.newBodyPage();
}

function chKeyPerson(L: Layout, fi: FlagshipInput, no: number) {
  const { audience } = fi;
  chapterHeading(L, `Chapter ${no} \u00b7 Concentration &amp; Key-Person Exposure`,
    "Where Capability Sits With One Person",
    "Named concentrations, what their loss would mean, the depth behind them, and a concrete next step.");
  if (audience === "investor") {
    para(L,
      "\u201cThe founders matter\u201d is not diligence. This chapter names the specific concentrations that the " +
      "measurement shows, states what the loss of each would mean for the plan, assesses whether depth " +
      "exists behind it, and gives a concrete mitigation. The point is not to discover that key people " +
      "matter; it is to price and govern that exposure deliberately.");
  } else {
    para(L,
      "Every strong team carries concentration: capability that sits with one person. Naming it is not " +
      "criticism, it is how a team protects itself while it grows. Each concentration below is paired " +
      "with a practical way to build depth behind it.");
  }
  drawKeyPerson(L, fi.visuals.keyperson);
  figureCaption(L,
    `Figure ${no}.1 - Concentration map. Per exposure: severity, impact if lost, the depth behind it, ` +
    "and the recommended next step.");
  L.advance(6);
  L.guardMm(36);
  if (audience === "investor") {
    callout(L, "Reading the exposures",
      "An exposure on this map is a structural fact, not a warning about a person. The two questions " +
      "that matter are whether a second owner is visible behind each concentration, and whether the " +
      "shareholder agreement reflects the exposures that have none. Both are decisions, not findings.",
      GOLD, "#faf5e8");
  } else {
    callout(L, "The one step that helps most",
      "Make a second owner visible behind each concentration. Not because anyone is leaving, but " +
      "because depth is what lets a strong team grow without becoming fragile.", ACCENT);
  }
  L.newBodyPage();
}

function chThesis(L: Layout, fi: FlagshipInput, no: number) {
  const f = fi.facts;
  const { index, meta } = fi;
  chapterHeading(L, `Chapter ${no} \u00b7 The Decision Questions`,
    "Straight Answers, Inside What Was Measured",
    "Each answer is a verdict against the measurement, and says plainly where the measurement stops.");

  const cov = coverageSplit(f.coverage);
  hardQa(L,
    "On human-capital grounds, does this group support the plan?",
    `Verdict: ${index.verdictShort} (index ${index.value}/100, ${index.band}).`,
    `The composite is built from ${f.indexBasis}, with team health at ${score2(f.teamHealthMean)} ` +
    `(${f.teamHealthBand}) and talent coverage at ${f.talentBand}. ${groupCaution(f)} Valuation and terms ` +
    "are a separate diligence stream and are not addressed here.");

  const grootste = cov.absent.length
    ? `Capability that nobody carries: ${lijst(cov.absent)}.`
    : cov.single.length
      ? `Capability resting on a single member: ${lijst(cov.single)}.`
      : f.driverHighRiskCount > 0
        ? `Driver load: ${f.driverHighRiskCount} member(s) show a high driver risk.`
        : "No single dominant exposure emerges from the measurement.";
  hardQa(L,
    "What is the largest human-capital exposure?",
    `Verdict: ${grootste}`,
    "This follows directly from the coverage and driver readings rather than from an impression. Where " +
    "no exposure stands out, the honest answer is that the measurement does not point at one, not that " +
    "there is none.");

  hardQa(L,
    "Does the work complexity match the ambition?",
    `Verdict: ${f.fit} (highest indicative stratum ${roman(f.teamMaxStratum)}, implied ${roman(f.requiredStratum)}).`,
    `${f.stratumNote} If no required level was set, this question cannot be answered and the verdict ` +
    "reads \u201cnot set\u201d rather than \u201cfine\u201d.");

  hardQa(L,
    "How active does the governance role need to be?",
    cov.absent.length || cov.single.length
      ? "Verdict: Active on governance, not on operations."
      : "Verdict: Governance attention proportional to a group with no measured capability gap.",
    `The measured gaps are ${cov.absent.length || cov.single.length
      ? `in ${lijst([...cov.absent, ...cov.single])}, which is closed through board composition, role design and complementary appointments`
      : "not in capability coverage, so the case for heavy involvement has to come from elsewhere in the diligence"}. ` +
    `What ${meta.investorLabel} is willing to take on is a decision, and this report deliberately does ` +
    "not make it.");

  hardQa(L,
    "What can this report not tell you?",
    "Verdict: Mandate, history and intention.",
    "Every instrument here is a point in time and self-reported. It does not show whether the formal " +
    "authority matches the capability, what the turnover and engagement history looks like, or what any " +
    "individual intends to do next. Those answers come from the documents and the interviews, and they " +
    "carry as much weight as anything in this report.");
  L.newBodyPage();
}

function chConditions(L: Layout, fi: FlagshipInput, no: number) {
  const { audience, facts: f, meta } = fi;
  chapterHeading(L, `Chapter ${no} \u00b7 Conditions, Verification &amp; Governance Charter`,
    "From Reading to Durable Practice",
    "What to verify, and the interventions the measurement supports - stated as principles.");
  if (audience === "investor") {
    subhead(L, "To verify before final commitment");
    bullets(L, [
      "<b>Authority behind the roles.</b> Confirm the formal mandate and profit-and-loss " +
      "responsibility of each role named here; this assessment reads capability, not authority.",
      "<b>Trend behind the snapshot.</b> Obtain voluntary-turnover data, engagement results and any " +
      "earlier energy measurement, so a single reading is not mistaken for a direction.",
      "<b>Valuation and terms.</b> Handled in the financial diligence stream and referenced here only " +
      "as an open question; nothing in this report speaks to price.",
    ]);
    L.guardMm(60);
  }
  subhead(L, "Governance charter - three catalysts");
  const cov = coverageSplit(f.coverage);
  const derde = [...cov.absent, ...cov.single];
  bullets(L, [
    "<b>1 \u00b7 Decision rights on paper.</b> Document who decides what, with a review rhythm and " +
    "explicit boundaries between strategic and operational authority. This is the intervention that " +
    "costs least and prevents most.",
    f.energyMean !== null
      ? "<b>2 \u00b7 Energy as a tracked metric.</b> Repeat the energy reading on a fixed rhythm and follow " +
        "the trend and the dispersion rather than the mean, alongside turnover and leave utilisation."
      : "<b>2 \u00b7 Start measuring energy.</b> No energy reading exists for this group, so the first step " +
        "is a baseline for everyone, repeated on a fixed rhythm; a trend is what makes it useful.",
    derde.length
      ? `<b>3 \u00b7 Complementary appointments.</b> Build depth where the measurement is thin: ` +
        `${lijst(derde)}. One appointment or one deliberate development track per theme, not a reorganisation.`
      : "<b>3 \u00b7 Keep the coverage you have.</b> No capability theme is thin today, so the third " +
        "catalyst is retention and succession depth rather than new capability.",
  ]);
  L.advance(2);
  callout(L, "Framing",
    `These are development opportunities, not remediation. Any organisation at this stage has to build ` +
    `this maturity; an active partner only accelerates it. These principles hold for ` +
    `${meta.investorLabel} as much as for any other party taking a governance role here.`, ACCENT);

  // Appendix
  L.advance(10);
  L.guardMm(120);
  subhead(L, "Appendix \u00b7 Methodology, Privacy &amp; Ethics");
  para(L,
    `This assessment combines the Lencioni team-health instrument, T4P Business profiles and the ` +
    `2MINSCAN energetic behaviour profile for ${f.n} member(s): ${lijst(f.memberNames)}. The composite ` +
    `index is built from ${f.indexBasis}; bands rather than raw ranks are reported so diagnostic ` +
    `meaning is preserved. ${groupCaution(f)}`);
  bullets(L, [
    "<b>Non-ranking.</b> Output is indicative and developmental; it is never a forced ranking of " +
    "individuals (GDPR Art. 22; requisite-organisation ethics).",
    "<b>Named reporting with consent.</b> Members are named because each of them consented to a named " +
    "reading in a group of this size. There is no pretence of anonymity.",
    "<b>Data separation.</b> Content meant for the deciding party only - verification, decision " +
    "questions - is excluded from the team-facing report.",
    "<b>Energetic behaviour reading.</b> The individual 2MINSCANs are read together as one energetic " +
    "team profile in a separate document in this dossier, under the same claim limit: behaviour and " +
    "energy, never talent, potential or suitability.",
    "<b>Right of access.</b> Individuals retain the right to see and discuss their own profile data.",
    "<b>Language.</b> Whatever the language of the source questionnaires, this report is always " +
    "produced in English so its international character is immediate.",
  ]);
  L.advance(5);
  callout(L, "Sources",
    "Edmondson (ASQ 1999); Google re:Work / Project Aristotle; Lencioni, The Five Dysfunctions of a " +
    "Team; McKinsey/Egon Zehnder, Return on Leadership; Kahler Process Communication Model; Jaques, " +
    "Requisite Organization; Barrick &amp; Mount (1991); Maslach Burnout Inventory; Bakker on emotional " +
    "contagion; Bobko et al. (2007). Each source is named by author and publication so it can be " +
    "traced to the original; no benchmark norms are claimed or applied.", ACCENT);
}

// ===================================================================
// Assembly - chapter numbers are assigned here, so the team variant
// never shows a gap where the investor-only chapter would sit.
// ===================================================================
export function buildReportBody(L: Layout, fi: FlagshipInput) {
  const chapters: ((L: Layout, fi: FlagshipInput, no: number) => void)[] = [
    chExecutive,
    chScorecard,
    chWhy,
    chHealth,
    chIndividual,
    chPotential,
    chDynamics,
    chAlerts,
    chCognitive,
    chKeyPerson,
  ];
  if (fi.audience === "investor") chapters.push(chThesis);
  chapters.push(chConditions);
  chapters.forEach((fn, i) => fn(L, fi, i));
}
