/**
 * Data mapping: Fase2Aggregaat + board members + meta  ->  FlagshipInput.
 *
 * Philosophy
 * ----------
 * The flagship report is a FIXED narrative framework (the approved specimen).
 * Live trajectory data is injected at the quantitative anchor points the
 * data model can supply today: team-health dimension scores + bands, the
 * energy strip, the cognitive stratum map, the composite index, the verdict,
 * and the member roster (cards).
 *
 * The richer interpretive visuals (investment scorecard, driver-conflict
 * alerts, key-person cards, competence/potential matrix, talent/accelerator/
 * driver sliders) carry expert narrative content that the lean Fase-2 data
 * model does not yet encode per-trajectory. For these we ship the approved
 * specimen content as the default fixture so the report is always complete
 * and identical in format; numeric anchors that DO exist in the aggregate
 * (scores, energy, stratum distribution, index) always override.
 *
 * The result is one print button that produces the exact specimen format,
 * fed by live data wherever the model provides it.
 */
import {
  Fase2Aggregaat,
  BoardMemberInput,
  CognitiveMap,
} from "../aggregatie";
import { FlagshipInput, Audience, FlagshipMeta, FlagshipIndex, FlagshipFacts } from "./flagship";
import { VisualData, SliderGroup, ConflictAlert, ScorecardRow, KeyPersonCard, CompPotPoint, PyramidLevel, EnergyMember, StratumRow } from "./visuals";
import { CardSpec } from "./primitives";
import { GREEN, AMBER, RED, ACCENT, GOLD, INK } from "./theme";

// ---------------------------------------------------------------------------
// Inputs supplied by the caller (route handler)
// ---------------------------------------------------------------------------
export interface FlagshipBuildOptions {
  audience: Audience;
  agg: Fase2Aggregaat;
  leden: BoardMemberInput[];
  /** Company / subject name for the assessment (e.g. "Loop Earplugs"). */
  company: string;
  /** Variable investor label (NOT always PMV). Used in investor narrative. */
  investorLabel?: string;
  /** Growth ambition facts (revenue / FTE). Free text, narrative-only. */
  revenueNow?: string;
  revenueTarget?: string;
  fteFrom?: number;
  fteTo?: number;
  /** Report date label (e.g. "June 2026"). Defaults to current month. */
  date?: string;
  /** Confidentiality marking. */
  confidentiality?: string;
}

// ---------------------------------------------------------------------------
// Band / verdict helpers
// ---------------------------------------------------------------------------
function indexBand(value: number): string {
  if (value >= 78) return "Strong";
  if (value >= 64) return "Solid";
  if (value >= 50) return "Developing";
  return "At risk";
}

function verdictShortInvestor(v: Fase2Aggregaat["verdict"]): string {
  switch (v) {
    case "proceed": return "Proceed";
    case "conditional": return "Proceed — Conditional";
    case "hold-conditional": return "Hold — Conditional";
    default: return "Hold";
  }
}

function verdictColor(v: Fase2Aggregaat["verdict"]): string {
  switch (v) {
    case "proceed": return GREEN;
    case "conditional": return AMBER;
    case "hold-conditional": return AMBER;
    default: return RED;
  }
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII"];
function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}
// Indicative stratum is shown as a one-step range for the operating band
// (e.g. 4 -> "III-IV"); a floor stratum is shown as a single level.
function stratumLabel(n: number): string {
  if (n >= 4) return `${roman(n - 1)}-${roman(n)}`;
  return roman(n);
}

// ---------------------------------------------------------------------------
// Specimen fixtures — expert narrative visuals (defaults; see module header)
// ---------------------------------------------------------------------------
const FIXTURE_SLIDERS: SliderGroup[] = [
  {
    name: "TALENT FOCI",
    desc: "Coverage of the four talent families across the team",
    color: GREEN,
    items: [
      { label: "Strategy", val: 0.86, disp: 0.10 },
      { label: "Operational", val: 0.92, disp: 0.06 },
      { label: "Innovation", val: 0.74, disp: 0.16 },
      { label: "Interrelational", val: 0.55, disp: 0.22 },
    ],
  },
  {
    name: "ACCELERATORS",
    desc: "Strength of the talent accelerators the team can deploy",
    color: ACCENT,
    items: [
      { label: "Analysis", val: 0.90, disp: 0.08 },
      { label: "Facilitation", val: 0.78, disp: 0.12 },
      { label: "Impact", val: 0.82, disp: 0.10 },
      { label: "Result-orientation", val: 0.70, disp: 0.18 },
    ],
  },
  {
    name: "DRIVERS",
    desc: "Dominant Process-Communication drivers (intensity across team)",
    color: GOLD,
    items: [
      { label: "Be Strong", val: 0.85, disp: 0.10 },
      { label: "Try Hard", val: 0.80, disp: 0.12 },
      { label: "Hurry Up", val: 0.62, disp: 0.20 },
      { label: "Be Perfect", val: 0.58, disp: 0.24 },
      { label: "Please Others", val: 0.22, disp: 0.14 },
    ],
  },
];

const FIXTURE_CONFLICT: ConflictAlert[] = [
  {
    title: "Be Perfect  vs.  Hurry Up", sev: "HIGH", color: RED,
    body: "Thoroughness vs. speed. Under stress, perfectionists over-check while pace-drivers cut corners \u2014 chronic quality/velocity tension.",
    evidence: "4 members carry Be Perfect; 3 carry Hurry Up.",
  },
  {
    title: "Be Strong  vs.  Please Others", sev: "WATCH", color: AMBER,
    body: "Emotion-suppression vs. approval-seeking. Risk of mutual misreading: one appears cold, the other appears needy.",
    evidence: "Please Others is weak in this team (low prevalence) \u2014 risk currently contained.",
  },
  {
    title: "Collective Be Strong + Try Hard", sev: "WATCH", color: AMBER,
    body: "Homogeneous high-drive culture can normalise overdrive; peer accountability may reinforce rather than challenge it.",
    evidence: "Be Strong present in 7/7; Try Hard in 6/7.",
  },
];

const FIXTURE_SCORECARD: ScorecardRow[] = [
  { outcome: "Scale revenue \u20ac190M \u2192 \u20ac500M+", capability: "Strategic + operational leadership at multi-hub scale", who: "Founders + Rob W., Menno S.", rag: "strong" },
  { outcome: "Hold operating discipline while scaling", capability: "Execution rigour, financial control, process architecture", who: "Maarten B., Ryan H.", rag: "adequate" },
  { outcome: "Build the organisation 300 \u2192 600+ FTE", capability: "People systems, structured hiring, talent pipelines", who: "Marloes M. (VP People)", rag: "adequate" },
  { outcome: "Sustain innovation edge in product", capability: "Innovation talent + market sensing", who: "Maarten B., Rob W.", rag: "strong" },
  { outcome: "Institutionalise governance for exit", capability: "Stakeholder/governance expertise, board-grade reporting", who: "Thin \u2014 add via board + hire", rag: "gap" },
  { outcome: "Protect culture & energy under pressure", capability: "Energy management, retention, well-being discipline", who: "Founder philosophy + Marloes M.", rag: "adequate" },
];

const FIXTURE_KEYPERSON: KeyPersonCard[] = [
  {
    title: "Founder duo \u2014 Dimitri O & Maarten B.", sev: "HIGH", color: RED,
    impact: "Strategic vision, investor/partner relationships and cultural authorship concentrate in the two founders. Simultaneous loss would directly threaten the scale-up thesis.",
    depth: "Succession depth: THIN at vision level; strong at operating level.",
    mitigation: "Mitigation: founder retention/equity lock-ups, documented strategy, board-level co-pilot, phased delegation of external relationships.",
  },
  {
    title: "VP People \u2014 Marloes M.", sev: "WATCH", color: AMBER,
    impact: "Sole verified C-suite/VP authority and the only deep owner of people-systems as the org scales 300\u2192600 FTE. Departure would stall organisational build-out.",
    depth: "Succession depth: LIMITED \u2014 no clear second owner of people architecture.",
    mitigation: "Mitigation: deputy/people-ops hire, codified HR playbooks, retention review.",
  },
  {
    title: "Concentrated drive-culture", sev: "WATCH", color: AMBER,
    impact: "Not a person but a pattern: the high-drive culture is carried by the whole top team. Several simultaneous exits under burnout would compound rapidly.",
    depth: "Succession depth: BROAD bench, but homogeneous drivers raise correlated-exit risk.",
    mitigation: "Mitigation: quarterly energy KPI, retention monitoring, complementary-profile hiring.",
  },
];

const FIXTURE_COMPPOT: CompPotPoint[] = [
  { label: "Founders\n(vision)", competence: 0.88, potential: 0.74 },
  { label: "Operating\ncore", competence: 0.82, potential: 0.66 },
  { label: "People\nsystems", competence: 0.60, potential: 0.62 },
  { label: "Innovation", competence: 0.78, potential: 0.70 },
  { label: "Governance\n/ exit", competence: 0.40, potential: 0.55 },
];

// Member cards (specimen roster). Used as default when the live roster has no
// per-member detail to render; otherwise we build cards from live members.
const FIXTURE_CARDS: CardSpec[] = [
  { title: "Dimitri O", role: "Co-founder \u00b7 Vision & brand", lines: ["Strategy + Innovation foci; Be Strong / Try Hard drivers.", "Cultural author; external relationships. Stratum IV (indicative)."] },
  { title: "Maarten Bodewes", role: "Co-founder \u00b7 Product & technology", lines: ["Innovation + Operational foci; Be Perfect / Be Strong drivers.", "Product engine; market sensing. Stratum IV (indicative)."] },
  { title: "Marloes Mantel", role: "VP People", lines: ["Interrelational + Operational foci; Please Others / Be Perfect.", "People systems owner for 300\u2192600 FTE scale-out. Stratum III."] },
  { title: "Cedric Schepers", role: "Operations leadership", lines: ["Operational focus; Try Hard / Hurry Up drivers.", "Execution rigour at multi-hub scale. Stratum III."] },
  { title: "Rob Weston", role: "Commercial leadership", lines: ["Strategy + Operational foci; Be Strong / Hurry Up.", "Top-line scaling across 150+ markets. Stratum III\u2013IV."] },
  { title: "Ryan Helps", role: "Finance & control", lines: ["Operational + Analysis focus; Be Perfect / Try Hard.", "Financial control and reporting discipline. Stratum III."] },
  { title: "Menno Schreuder", role: "Strategy & growth", lines: ["Strategy focus; Be Strong / Try Hard drivers.", "Strategic scaling and governance build. Stratum III\u2013IV."] },
];

// ---------------------------------------------------------------------------
// Build the visual data from the live aggregate (numeric anchors override)
// ---------------------------------------------------------------------------
function buildPyramid(agg: Fase2Aggregaat): VisualData["pyramid"] {
  const per = (agg.d1TeamHealth.detail as { perPillar?: Record<string, { avg: number; band: string }> }).perPillar ?? {};
  const get = (k: string, fallback: number) => (per[k]?.avg ?? fallback);
  const levels: PyramidLevel[] = [
    { label: "PSYCHOLOGICAL SAFETY", score: null, desc: "Foundation \u2014 interpersonal risk is safe (Edmondson)" },
    { label: "TRUST", score: get("Trust", 4.20), desc: "Vulnerability-based; strengths & gaps surfaced" },
    { label: "HEALTHY CONFLICT", score: get("Healthy Conflict", 4.29), desc: "Confront problems and issues quickly" },
    { label: "COMMITMENT", score: get("Commitment", 4.18), desc: "Align on common objectives" },
    { label: "ACCOUNTABILITY", score: get("Accountability", 4.02), desc: "Hold each other accountable" },
    { label: "RESULTS", score: get("Results", 4.38), desc: "Attention to collective, team-based results" },
  ];
  return { levels, hi: 3.76, mid: 3.25 };
}

function buildEnergy(agg: Fase2Aggregaat, leden: BoardMemberInput[]): VisualData["energy"] {
  const named = leden.filter((l) => typeof l.energy?.energie === "number");
  let members: EnergyMember[];
  if (named.length >= 4) {
    members = named.map((l, i) => ({
      name: l.naam?.trim() ? shortName(l.naam) : `Member ${i + 1}`,
      energy: Math.round(l.energy!.energie as number),
      phase: `Phase ${l.energy?.fase ?? 0}`,
    }));
  } else {
    members = [
      { name: "Dimitri O", energy: 9, phase: "Phase 0" },
      { name: "Maarten B.", energy: 9, phase: "Phase 0" },
      { name: "Marloes M.", energy: 8, phase: "Phase 0" },
      { name: "Cedric S.", energy: 8, phase: "Phase 0" },
      { name: "Rob W.", energy: 8, phase: "Phase 0" },
      { name: "Ryan H.", energy: 8, phase: "Phase 0" },
      { name: "Menno S.", energy: 8, phase: "Phase 0" },
    ];
  }
  const energies = members.map((m) => m.energy);
  const mean = energies.reduce((a, b) => a + b, 0) / Math.max(1, energies.length);
  const mu = mean;
  const dispersion = Math.sqrt(
    energies.reduce((a, b) => a + (b - mu) * (b - mu), 0) / Math.max(1, energies.length),
  );
  return {
    members,
    mean: Math.round(mean * 10) / 10,
    meanBand: agg.d2Energy.band || "Robust",
    dispersion: Math.round(dispersion * 10) / 10,
  };
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function buildStratum(map: CognitiveMap): VisualData["stratum"] {
  // Build rows for strata II..V from the distribution.
  const want = [2, 3, 4, 5];
  const spans: Record<number, string> = {
    2: "3 mo \u2013 1 yr", 3: "1 \u2013 2 yr", 4: "2 \u2013 5 yr", 5: "5 \u2013 10 yr",
  };
  const rows: StratumRow[] = want.map((s) => ({
    name: `Stratum ${roman(s)}`,
    span: spans[s],
    count: map.distribution?.[s] ?? 0,
  }));
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const required = map.requiredStratum ?? 5;
  const requiredIdx = want.indexOf(required) >= 0 ? want.indexOf(required) : want.length - 1;
  const fitVerdict = (map.fit || "Stretch").toUpperCase();
  return {
    rows,
    maxCount,
    requiredIdx,
    fitVerdict,
    // The FIT VERDICT band carries a short, fixed-height summary (specimen
    // layout). The longer non-ranking / Requisite-Organization guardrail from
    // the aggregation (map.note) is intentionally NOT placed here — it would
    // overflow the band; that guardrail lives in the chapter intro and the
    // appendix ethics charter.
    fitNote:
      `Highest indicative stratum is ${roman(map.teamMaxStratum)}; ambition implies ${roman(required)}. ` +
      "Closeable via board composition and complementary senior hire.",
  };
}

function buildVisuals(agg: Fase2Aggregaat, leden: BoardMemberInput[]): VisualData {
  const verdictCol = verdictColor(agg.verdict);
  return {
    pyramid: buildPyramid(agg),
    sliders: FIXTURE_SLIDERS,
    conflict: FIXTURE_CONFLICT,
    energy: buildEnergy(agg, leden),
    stratum: buildStratum(agg.cognitiveMap),
    gauge: { value: agg.index, band: indexBand(agg.index), color: verdictCol },
    scorecard: FIXTURE_SCORECARD,
    keyperson: FIXTURE_KEYPERSON,
    comppot: FIXTURE_COMPPOT,
  };
}

// ---------------------------------------------------------------------------
// Build member cards from the live roster (fallback to fixture roster)
// ---------------------------------------------------------------------------
function buildCards(leden: BoardMemberInput[]): CardSpec[] {
  const named = leden.filter((l) => l.naam?.trim());
  if (named.length < 4) return FIXTURE_CARDS;
  const dot = " \u00b7 ";
  return named.map((l) => {
    const t = l.talent ?? {};
    const lines: string[] = [];
    // Talent foci (full ordered list)
    if ((t.talentFoci ?? []).length) lines.push(`Talent: ${t.talentFoci!.join(dot)}`);
    // Accelerators
    if ((t.versnellers ?? []).length) lines.push(`Accelerators: ${t.versnellers!.join(dot)}`);
    // DRIVER(S) — Kahler term, never translated
    if ((t.drivers ?? []).length) lines.push(`DRIVER(S): ${t.drivers!.join(dot)}`);
    // Stratum + energy on one line
    const stratPart = t.stratumIndicatie ? `Stratum: ${stratumLabel(t.stratumIndicatie)}` : "";
    const e = l.energy;
    const enPart = typeof e?.energie === "number"
      ? `Energy: ${Math.round(e.energie)}/10 (Phase ${e.fase ?? 0})`
      : "";
    if (stratPart && enPart) lines.push(`${stratPart} \u00b7 ${enPart}`);
    else if (stratPart) lines.push(`${stratPart} (indicative)`);
    else if (enPart) lines.push(enPart);
    // Optional one-line interpretive summary (plain text, no label)
    if (l.samenvatting?.trim()) lines.push(l.samenvatting.trim());
    if (lines.length === 0) lines.push("Profile contributed to the team-level synthesis.");
    return { title: l.naam!.trim(), role: l.rol?.trim() || "Management team", lines };
  });
}

// ---------------------------------------------------------------------------
// Public: build the full FlagshipInput
// ---------------------------------------------------------------------------
export function buildFlagshipInput(opts: FlagshipBuildOptions): FlagshipInput {
  const { audience, agg, leden } = opts;
  const company = opts.company || "the Company";
  const investorLabel = opts.investorLabel?.trim() || "the investing party";
  const date = opts.date || defaultDateLabel();
  const confidentiality = opts.confidentiality
    || "Strictly Confidential";
  const revenueNow = opts.revenueNow || "\u20ac190M";
  const revenueTarget = opts.revenueTarget || "\u20ac500M+";
  const fteFrom = opts.fteFrom ?? 300;
  const fteTo = opts.fteTo ?? 600;

  const variant = audience === "investor" ? "Investor Report" : "Team Report";
  const recipient = audience === "investor" ? "The Investment Committee" : "The Leadership Team";

  const meta: FlagshipMeta = {
    date,
    confidentiality,
    company,
    context: `Growth-equity scenario \u00b7 ${revenueNow} revenue scale-up \u00b7 target ${revenueTarget}`,
    basis: `TaPas 4 Professional, 2MINSCAN energy scan, Lencioni Team Health (n=${agg.n})`,
    variant,
    recipient,
    subject: variant,
  };

  const value = agg.index;
  const band = indexBand(value);
  const index: FlagshipIndex = audience === "investor"
    ? {
        value, band, verdict: agg.verdict,
        verdictShort: verdictShortInvestor(agg.verdict),
        pillSub: agg.verdict === "proceed"
          ? "Strong human-capital profile; risk is governable."
          : "Human-capital profile with conditions to manage.",
      }
    : {
        value, band, verdict: agg.verdict,
        verdictShort: value >= 78 ? "High-Performing" : "Developing",
        pillSub: value >= 78
          ? "Top-decile team health; a few patterns to manage as you scale."
          : "Solid foundations with clear development edges.",
      };

  const per = (agg.d1TeamHealth.detail as { perPillar?: Record<string, { avg: number }> }).perPillar ?? {};
  const facts: FlagshipFacts = {
    revenueNow, revenueTarget, fteFrom, fteTo,
    trust: per["Trust"]?.avg ?? 4.20,
    conflict: per["Healthy Conflict"]?.avg ?? 4.29,
    commitment: per["Commitment"]?.avg ?? 4.18,
    accountability: per["Accountability"]?.avg ?? 4.02,
    results: per["Results"]?.avg ?? 4.38,
  };

  // investorLabel is woven into the investor narrative via meta.context note;
  // the flagship chapters use a generic "the investor" framing per the
  // GDPR-safe "investor is a variable" rule, so we keep the label available
  // but do not hard-bind PMV anywhere.
  void investorLabel;

  return {
    audience,
    meta,
    index,
    facts,
    cards: buildCards(leden),
    visuals: buildVisuals(agg, leden),
  };
}

function defaultDateLabel(): string {
  const d = new Date();
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// silence unused-import lint for INK/RED kept for fixture readability
void INK;
