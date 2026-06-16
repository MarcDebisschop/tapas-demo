/**
 * Human Due Diligence — Phase 2 aggregation & scoring model.
 * ------------------------------------------------------------------
 * Reads each board member's Phase-1 (Teamscan + 2MINSCAN) and Phase-2
 * (T4P Business) results and builds the board-level aggregates that feed the
 * flagship report:
 *
 *   D1 Team Health            (Lencioni, Teamscan)        — pillar averages 1–5
 *   D2 Energy Sustainability  (2MINSCAN)                  — energy 0–10 + phase
 *   D3 Talent Capability      (T4P Business)              — coverage + alignment
 *   D4 Cognitive Capacity     (indicative Jaques, T4P)    — stratum distribution
 *
 * Each dimension keeps its native scientific band AND is normalised to 0–100
 * for one weighted composite, the HDD Human Capital Index. This multidimensional
 * approach (bands + composite) is the psychometrically recommended one: a
 * well-weighted composite is more reliable/valid than its subscores, while the
 * separate bands preserve the dimensional information a naive average would hide.
 *
 * HDD stores no answer data; this module is given already-scored member inputs
 * (assembled from the source instruments at report time).
 */

// ---------------------------------------------------------------------------
// Scientific anchors (documented, not arbitrary)
// ---------------------------------------------------------------------------

// Lencioni official 38-item online assessment cut-offs (average-based).
export const TEAM_HEALTH_BANDS = { high: 3.75, medium: 3.25 } as const;

// 2MINSCAN energy bands on the 0–10 scale.
export const ENERGY_BANDS = { robust: 7.0, watch: 5.0 } as const;

// Composite weights (open, adjustable per engagement). Team Health carries most
// weight as the strongest predictor of execution/retention; Energy and Talent
// are co-equal scaling drivers; Cognitive capacity is weighted lower because it
// is an INDICATION (not a validated measurement) and must never rank people.
export const INDEX_WEIGHTS = { d1: 0.3, d2: 0.25, d3: 0.25, d4: 0.2 } as const;

// Verdict thresholds on the 0–100 index.
export const VERDICT_THRESHOLDS = { proceed: 78, conditional: 64, hold: 50 } as const;

// Elliott Jaques stratum time-spans (Requisite Organization reference scale).
export const STRATUM_TIMESPAN: Record<number, string> = {
  1: "1 day – 3 months",
  2: "3 – 12 months",
  3: "1 – 2 years",
  4: "2 – 5 years",
  5: "5 – 10 years",
  6: "10 – 20 years",
  7: "20 – 50 years",
};

// The four T4P talent families we track for coverage.
export const TALENT_FAMILIES = [
  "Strategy",
  "Operational",
  "Innovation",
  "Interrelational",
] as const;

// ---------------------------------------------------------------------------
// Member input contracts (already scored, assembled from source instruments)
// ---------------------------------------------------------------------------

export interface MemberTeamscan {
  // Pillar averages on the 1–5 Lencioni scale (member's perception).
  vertrouwen?: number;
  conflict?: number;
  betrokkenheid?: number;
  verantwoordelijkheid?: number;
  resultaten?: number;
}

export interface MemberEnergy {
  // 2MINSCAN: phase (0 = fully energised) and energy on 0–10.
  fase?: number; // 0..n (lower is better)
  energie?: number; // 0..10
}

export interface MemberTalent {
  // Dominant talent foci (ordered, deterministic) and accelerators.
  talentFoci?: string[]; // e.g. ["Strategy","Operational","Interrelational"]
  versnellers?: string[]; // accelerators, e.g. ["Analysis","Facilitation","Impact"]
  // Kahler DRIVER(S) — term kept untranslated by rule.
  drivers?: string[]; // e.g. ["Try Hard","Be Strong","Hurry Up"]
  driverRisico?: "laag" | "matig" | "hoog";
  // Indicative Jaques stratum (1..7) derived from the T4P profile — NOT a test.
  stratumIndicatie?: number;
  // Talent-energy congruence 0–100 (from T4P consistency metric), optional.
  congruentie?: number;
}

export interface BoardMemberInput {
  id: number;
  naam: string; // may be empty for anonymous/example trajectories
  rol?: string; // role label for the report card (e.g. "Co-founder", "VP People")
  teamscan?: MemberTeamscan;
  energy?: MemberEnergy;
  talent?: MemberTalent;
  // Optional one-line interpretive summary shown at the foot of the card.
  samenvatting?: string;
}

export interface Fase2Input {
  context: "ma" | "self-screening";
  vereistStratum?: number | null; // required work-complexity for the ambition
  leden: BoardMemberInput[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function gemiddelde(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = gemiddelde(xs);
  return Math.sqrt(gemiddelde(xs.map((x) => (x - m) ** 2)));
}
function band3(x: number, high: number, medium: number): "High" | "Medium" | "Low" {
  if (x >= high) return "High";
  if (x >= medium) return "Medium";
  return "Low";
}
// Map a 1–5 average onto 0–100 (1 → 0, 5 → 100).
function scale5to100(x: number): number {
  return Math.max(0, Math.min(100, ((x - 1) / 4) * 100));
}

// ---------------------------------------------------------------------------
// Dimension outputs
// ---------------------------------------------------------------------------

export interface DimensionResult {
  score100: number; // normalised 0–100 (feeds composite)
  band: string; // native scientific band label
  detail: Record<string, unknown>;
}

export interface CognitiveMap {
  distribution: Record<number, number>; // stratum -> count
  teamMaxStratum: number;
  requiredStratum: number | null;
  fit: "Fit" | "Stretch" | "Gap" | "n/a";
  // Explicit non-ranking guardrail (Requisite Organization).
  note: string;
  score100: number;
}

export interface Fase2Aggregaat {
  n: number;
  contextLabel: string;
  d1TeamHealth: DimensionResult;
  d2Energy: DimensionResult;
  d3Talent: DimensionResult;
  d4Cognitive: DimensionResult;
  cognitiveMap: CognitiveMap;
  index: number; // HDD Human Capital Index 0–100
  verdict: "proceed" | "conditional" | "hold-conditional" | "hold";
  // Privacy: aggregates suppressed below minimum-N.
  minNMet: boolean;
}

export const HDD_MIN_RESPONDENTS = 4;

// ---- D1 Team Health (Lencioni) --------------------------------------------
function bouwTeamHealth(leden: BoardMemberInput[]): DimensionResult {
  const pillars: Array<keyof MemberTeamscan> = [
    "vertrouwen",
    "conflict",
    "betrokkenheid",
    "verantwoordelijkheid",
    "resultaten",
  ];
  const pillarLabels: Record<string, string> = {
    vertrouwen: "Trust",
    conflict: "Healthy Conflict",
    betrokkenheid: "Commitment",
    verantwoordelijkheid: "Accountability",
    resultaten: "Results",
  };
  const perPillar: Record<string, { avg: number; band: string }> = {};
  const pillarAverages: number[] = [];
  for (const p of pillars) {
    const vals = leden
      .map((l) => l.teamscan?.[p])
      .filter((v): v is number => typeof v === "number");
    const avg = round1(gemiddelde(vals));
    perPillar[pillarLabels[p]] = {
      avg,
      band: band3(avg, TEAM_HEALTH_BANDS.high, TEAM_HEALTH_BANDS.medium),
    };
    if (vals.length) pillarAverages.push(avg);
  }
  const overall = round1(gemiddelde(pillarAverages));
  return {
    score100: Math.round(scale5to100(overall)),
    band: band3(overall, TEAM_HEALTH_BANDS.high, TEAM_HEALTH_BANDS.medium),
    detail: { overall, perPillar },
  };
}

// ---- D2 Energy Sustainability (2MINSCAN) ----------------------------------
function bouwEnergy(leden: BoardMemberInput[]): DimensionResult {
  const energies = leden
    .map((l) => l.energy?.energie)
    .filter((v): v is number => typeof v === "number");
  const teamMean = round1(gemiddelde(energies));
  const dispersion = round1(stdev(energies));
  const phase0 = leden.filter((l) => (l.energy?.fase ?? 99) === 0).length;
  let band: "Robust" | "Watch" | "Fragile";
  if (teamMean >= ENERGY_BANDS.robust && dispersion <= 1.5) band = "Robust";
  else if (teamMean >= ENERGY_BANDS.watch) band = "Watch";
  else band = "Fragile";
  return {
    score100: Math.round(Math.max(0, Math.min(100, teamMean * 10))),
    band,
    detail: { teamMean, dispersion, phase0Count: phase0, n: energies.length },
  };
}

// ---- D3 Talent Capability & Complementarity (T4P) -------------------------
function bouwTalent(leden: BoardMemberInput[]): DimensionResult {
  const coverage: Record<string, number> = {};
  for (const fam of TALENT_FAMILIES) coverage[fam] = 0;
  for (const l of leden) {
    for (const f of l.talent?.talentFoci ?? []) {
      if (f in coverage) coverage[f] += 1;
    }
  }
  // Coverage band per family.
  const coverageBands: Record<string, string> = {};
  for (const fam of TALENT_FAMILIES) {
    const c = coverage[fam];
    coverageBands[fam] = c >= 2 ? "Strong" : c === 1 ? "Adequate" : "Thin";
  }
  const thin = TALENT_FAMILIES.filter((f) => coverage[f] === 0);
  // Score: fraction of families covered, lightly rewarded for depth.
  const covered = TALENT_FAMILIES.filter((f) => coverage[f] >= 1).length;
  const depth = TALENT_FAMILIES.filter((f) => coverage[f] >= 2).length;
  const score100 = Math.round(
    (covered / TALENT_FAMILIES.length) * 80 + (depth / TALENT_FAMILIES.length) * 20,
  );
  // Aggregated DRIVER(S) frequency (term untranslated).
  const driverFreq: Record<string, number> = {};
  for (const l of leden) {
    for (const d of l.talent?.drivers ?? []) {
      driverFreq[d] = (driverFreq[d] ?? 0) + 1;
    }
  }
  const driverHigh = leden.filter((l) => l.talent?.driverRisico === "hoog").length;
  const band =
    thin.length === 0 ? "Strong" : thin.length === 1 ? "Adequate" : "Thin coverage";
  return {
    score100,
    band,
    detail: { coverage, coverageBands, thinFamilies: thin, driverFreq, driverHighRiskCount: driverHigh },
  };
}

// ---- D4 Cognitive Capacity (indicative Jaques) ----------------------------
function bouwCognitive(input: Fase2Input): { dim: DimensionResult; map: CognitiveMap } {
  const strata = input.leden
    .map((l) => l.talent?.stratumIndicatie)
    .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 7);
  const distribution: Record<number, number> = {};
  for (const s of strata) distribution[s] = (distribution[s] ?? 0) + 1;
  const teamMax = strata.length ? Math.max(...strata) : 0;
  const required = input.vereistStratum ?? null;

  let fit: CognitiveMap["fit"] = "n/a";
  if (required != null && teamMax > 0) {
    if (teamMax >= required) fit = "Fit";
    else if (teamMax === required - 1) fit = "Stretch";
    else fit = "Gap";
  }

  // Cognitive score: only meaningful against a required level (M&A context).
  // Without a required stratum we score on team coverage of strategic strata
  // (III+ = multi-year horizon), capped — never used to rank individuals.
  let score100: number;
  if (required != null && teamMax > 0) {
    score100 = Math.round(Math.max(0, Math.min(100, (teamMax / required) * 100)));
  } else {
    const strategic = strata.filter((s) => s >= 3).length;
    score100 = strata.length
      ? Math.round((strategic / strata.length) * 100)
      : 0;
  }

  const note =
    "Cognitive capacity is shown as a team distribution and fit-to-ambition, " +
    "never as a ranking of individuals. Per Requisite Organization, people are " +
    "never force-ranked; each contributes at their own level. Stratum values are " +
    "indicative, derived from the T4P Business profile, not a validated cognitive test.";

  return {
    dim: {
      score100,
      band: fit === "n/a" ? band3(score100, 75, 50) : fit,
      detail: { distribution, teamMaxStratum: teamMax, requiredStratum: required, fit },
    },
    map: {
      distribution,
      teamMaxStratum: teamMax,
      requiredStratum: required,
      fit,
      note,
      score100,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level aggregation
// ---------------------------------------------------------------------------

export function bouwFase2Aggregaat(input: Fase2Input): Fase2Aggregaat {
  const n = input.leden.length;
  const minNMet = n >= HDD_MIN_RESPONDENTS;

  const d1 = bouwTeamHealth(input.leden);
  const d2 = bouwEnergy(input.leden);
  const d3 = bouwTalent(input.leden);
  const { dim: d4, map: cognitiveMap } = bouwCognitive(input);

  const index = Math.round(
    INDEX_WEIGHTS.d1 * d1.score100 +
      INDEX_WEIGHTS.d2 * d2.score100 +
      INDEX_WEIGHTS.d3 * d3.score100 +
      INDEX_WEIGHTS.d4 * d4.score100,
  );

  let verdict: Fase2Aggregaat["verdict"];
  if (index >= VERDICT_THRESHOLDS.proceed) verdict = "proceed";
  else if (index >= VERDICT_THRESHOLDS.conditional) verdict = "conditional";
  else if (index >= VERDICT_THRESHOLDS.hold) verdict = "hold-conditional";
  else verdict = "hold";

  return {
    n,
    contextLabel: input.context === "ma" ? "M&A human-capital due diligence" : "Team self-screening",
    d1TeamHealth: d1,
    d2Energy: d2,
    d3Talent: d3,
    d4Cognitive: d4,
    cognitiveMap,
    index,
    verdict,
    minNMet,
  };
}
