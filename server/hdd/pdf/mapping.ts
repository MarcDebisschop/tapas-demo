/**
 * Data mapping: Fase2Aggregaat + board members + meta  ->  FlagshipInput.
 *
 * Rule of this module
 * -------------------
 * Every number, name and label in the report comes from the trajectory itself.
 * There are no specimen fixtures and no fallback figures. When something was not
 * measured, this module returns an empty list or a null and the report says so in
 * words; it never fills the hole with a plausible-looking value.
 *
 * What is derived here, and how:
 *   - Team-health pyramid   : the five Lencioni pillar averages, band lines from
 *                             the documented Lencioni cut-offs.
 *   - Sliders               : talent foci weighted by their rank in each member's
 *                             own sequence; accelerators and DRIVER(S) as the
 *                             share of members who carry them.
 *   - Driver tensions        : only for driver pairs that are BOTH actually present
 *                             in this group, with the measured counts as evidence.
 *                             The description of a tension is domain knowledge;
 *                             the fact that it applies here is measured.
 *   - Capability scorecard   : one row per talent family plus cognitive fit and
 *                             energy, with the members who actually carry it and a
 *                             traffic light from the measured coverage band.
 *   - Key-person exposure    : families carried by exactly one member, a unique
 *                             highest indicative stratum, and members with a high
 *                             driver risk.
 *   - Energy strip           : only members with an energy reading from an
 *                             instrument that actually asks about energy.
 *   - Stratum map            : the measured distribution against the required level.
 *
 * Competence/potential positioning is deliberately absent: potential is not
 * measured anywhere in this chain, so the matrix would be invention.
 */
import {
  Fase2Aggregaat,
  BoardMemberInput,
  CognitiveMap,
  ledenEnergie,
  TALENT_FAMILIES,
  TEAM_HEALTH_BANDS,
} from "../aggregatie";
import { FlagshipInput, Audience, FlagshipMeta, FlagshipIndex, FlagshipFacts } from "./flagship";
import { VisualData, SliderGroup, SliderItem, ConflictAlert, ScorecardRow, KeyPersonCard, PyramidLevel, EnergyMember, StratumRow } from "./visuals";
import { CardSpec } from "./primitives";
import { GREEN, AMBER, RED, ACCENT, GOLD } from "./theme";

// ---------------------------------------------------------------------------
// Inputs supplied by the caller (route handler)
// ---------------------------------------------------------------------------
export interface FlagshipBuildOptions {
  audience: Audience;
  agg: Fase2Aggregaat;
  leden: BoardMemberInput[];
  /** Company / subject name for the assessment. */
  company: string;
  /** Variable investor label (never hard-bound to one party). */
  investorLabel?: string;
  /** Growth ambition facts (revenue / FTE). Narrative only, shown only if given. */
  revenueNow?: string;
  revenueTarget?: string;
  fteFrom?: number;
  fteTo?: number;
  /** Report date label. Defaults to the current month. */
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
    case "conditional": return "Proceed - Conditional";
    case "hold-conditional": return "Hold - Conditional";
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

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Standard deviation of a share: the honest dispersion of a yes/no reading. */
function shareDispersion(p: number): number {
  return Math.sqrt(Math.max(0, p * (1 - p)));
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

// ---------------------------------------------------------------------------
// Measured detail read back out of the aggregate
// ---------------------------------------------------------------------------
interface TalentDetail {
  coverage?: Record<string, number>;
  coverageBands?: Record<string, string>;
  thinFamilies?: string[];
  driverFreq?: Record<string, number>;
  driverHighRiskCount?: number;
}

function talentDetail(agg: Fase2Aggregaat): TalentDetail {
  return (agg.d3Talent.detail ?? {}) as TalentDetail;
}

function pillarAverages(agg: Fase2Aggregaat): Record<string, { avg: number; band?: string }> {
  const d = agg.d1TeamHealth.detail as { perPillar?: Record<string, { avg: number; band?: string }> };
  return d?.perPillar ?? {};
}

function energyDetail(agg: Fase2Aggregaat): { teamMean?: number | null; dispersion?: number | null; phase0Count?: number; n?: number; ontbrekend?: number } {
  return (agg.d2Energy.detail ?? {}) as { teamMean?: number | null; dispersion?: number | null; phase0Count?: number; n?: number; ontbrekend?: number };
}

// ---------------------------------------------------------------------------
// Team-health pyramid
// ---------------------------------------------------------------------------
function buildPyramid(agg: Fase2Aggregaat): VisualData["pyramid"] {
  const per = pillarAverages(agg);
  const val = (k: string): number | null => (typeof per[k]?.avg === "number" ? per[k].avg : null);
  const levels: PyramidLevel[] = [
    { label: "PSYCHOLOGICAL SAFETY", score: null, desc: "Foundation - interpersonal risk is safe (Edmondson)" },
    { label: "TRUST", score: val("Trust"), desc: "Vulnerability-based; strengths and gaps surfaced" },
    { label: "HEALTHY CONFLICT", score: val("Healthy Conflict"), desc: "Confront problems and issues quickly" },
    { label: "COMMITMENT", score: val("Commitment"), desc: "Align on common objectives" },
    { label: "ACCOUNTABILITY", score: val("Accountability"), desc: "Hold each other accountable" },
    { label: "RESULTS", score: val("Results"), desc: "Attention to collective, team-based results" },
  ];
  return { levels, hi: TEAM_HEALTH_BANDS.high, mid: TEAM_HEALTH_BANDS.medium };
}

// ---------------------------------------------------------------------------
// Sliders: talent foci, accelerators, DRIVER(S) - all measured
// ---------------------------------------------------------------------------
// A focus that stands first in a member's own sequence counts fully; a later
// position counts less. This keeps the ordering information the T4P profile
// carries instead of flattening it to present/absent.
const RANK_WEIGHTS = [1, 0.75, 0.5, 0.3];

function focusWeight(foci: string[], family: string): number {
  const idx = foci.indexOf(family);
  if (idx < 0) return 0;
  return RANK_WEIGHTS[idx] ?? 0.2;
}

function buildSliders(agg: Fase2Aggregaat, leden: BoardMemberInput[]): SliderGroup[] {
  const n = leden.length;
  const groups: SliderGroup[] = [];
  if (n === 0) return groups;

  // --- Talent foci ---------------------------------------------------------
  const focusItems: SliderItem[] = TALENT_FAMILIES.map((fam) => {
    const weights = leden.map((l) => focusWeight(l.talent?.talentFoci ?? [], fam));
    const mean = weights.reduce((a, b) => a + b, 0) / n;
    return { label: fam, val: Math.max(0, Math.min(1, mean)), disp: Math.min(0.5, stdev(weights)) };
  });
  if (focusItems.some((i) => i.val > 0)) {
    groups.push({
      name: "TALENT FOCI",
      desc: `Presence of the four talent families across the ${n} profiles, weighted by the rank each focus holds in the member's own sequence`,
      color: GREEN,
      items: focusItems,
    });
  }

  // --- Accelerators --------------------------------------------------------
  const accCount: Record<string, number> = {};
  for (const l of leden) {
    for (const a of l.talent?.versnellers ?? []) {
      accCount[a] = (accCount[a] ?? 0) + 1;
    }
  }
  const accItems: SliderItem[] = Object.entries(accCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, c]) => {
      const p = c / n;
      return { label, val: p, disp: shareDispersion(p) };
    });
  if (accItems.length) {
    groups.push({
      name: "ACCELERATORS",
      desc: `Share of the ${n} profiles that carry this accelerator (most frequent first)`,
      color: ACCENT,
      items: accItems,
    });
  }

  // --- DRIVER(S) -----------------------------------------------------------
  const driverFreq = talentDetail(agg).driverFreq ?? {};
  const drvItems: SliderItem[] = Object.entries(driverFreq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, c]) => {
      const p = c / n;
      return { label, val: p, disp: shareDispersion(p) };
    });
  if (drvItems.length) {
    groups.push({
      name: "DRIVER(S)",
      desc: `Share of the ${n} profiles that carry this DRIVER as a dominant pattern`,
      color: GOLD,
      items: drvItems,
    });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Driver tensions: domain knowledge, applied only where measured
// ---------------------------------------------------------------------------
interface TensionRule {
  a: string;
  b: string;
  body: string;
}

// Behaviour-level descriptions of what happens when two DRIVER patterns meet in
// one team. Nothing here is a diagnosis and nothing here is a person.
const TENSION_RULES: TensionRule[] = [
  {
    a: "Be Perfect",
    b: "Hurry Up",
    body: "Thoroughness meets pace. Under pressure the one keeps checking while the other starts cutting, so the same decision is reopened and rushed in turn.",
  },
  {
    a: "Be Strong",
    b: "Please Others",
    body: "Holding everything in meets wanting to keep everyone on board. The first reads as distant, the second as accommodating, and both feel misread.",
  },
  {
    a: "Be Perfect",
    b: "Be Strong",
    body: "Getting it exactly right meets carrying it alone. Problems get solved late because asking for help arrives after the standard has already slipped.",
  },
  {
    a: "Try Hard",
    b: "Hurry Up",
    body: "Wanting to show what one can do meets wanting it finished. Effort goes into visible pushing rather than into finishing the least visible part.",
  },
  {
    a: "Try Hard",
    b: "Be Perfect",
    body: "Wanting to show what one can do meets wanting it flawless. Work is redone for recognition rather than released at the level that is already good enough.",
  },
  {
    a: "Please Others",
    b: "Hurry Up",
    body: "Keeping everyone on board meets keeping the pace. Agreement is assumed instead of checked, and the check comes after the deadline.",
  },
];

function buildConflict(agg: Fase2Aggregaat, leden: BoardMemberInput[]): ConflictAlert[] {
  const n = leden.length;
  if (n === 0) return [];
  const freq = talentDetail(agg).driverFreq ?? {};
  const alerts: ConflictAlert[] = [];

  for (const rule of TENSION_RULES) {
    const ca = freq[rule.a] ?? 0;
    const cb = freq[rule.b] ?? 0;
    if (ca === 0 || cb === 0) continue;
    // Both patterns are actually present. Severity follows how much of the group
    // carries each side: the tension bites when both sides are well represented.
    const weakest = Math.min(ca, cb) / n;
    const sev = weakest >= 0.5 ? "HIGH" : "WATCH";
    alerts.push({
      title: `${rule.a}  vs.  ${rule.b}`,
      sev,
      color: sev === "HIGH" ? RED : AMBER,
      body: rule.body,
      evidence: `${ca} of ${n} profiles carry ${rule.a}; ${cb} of ${n} carry ${rule.b}.`,
    });
  }

  // Homogeneity is its own pattern: when nearly everyone carries the same
  // DRIVER, peers reinforce it instead of balancing it.
  const shared = Object.entries(freq)
    .filter(([, c]) => n >= 2 && c === n)
    .map(([d]) => d)
    .sort();
  if (shared.length) {
    alerts.push({
      title: `Shared pattern: ${shared.join(" + ")}`,
      sev: shared.length >= 2 ? "HIGH" : "WATCH",
      color: shared.length >= 2 ? RED : AMBER,
      body: "This is not a person but a group pattern. What everyone carries stops being noticed, so the group corrects it least where it costs the most.",
      evidence: `Carried by all ${n} profiles: ${shared.join(", ")}.`,
    });
  }

  const highRisk = talentDetail(agg).driverHighRiskCount ?? 0;
  if (highRisk > 0) {
    alerts.push({
      title: "Driver load under pressure",
      sev: highRisk >= Math.ceil(n / 2) ? "HIGH" : "WATCH",
      color: highRisk >= Math.ceil(n / 2) ? RED : AMBER,
      body: "For these members the driver pattern is strongly loaded, which means the pattern is most likely to take over exactly when the pressure is highest.",
      evidence: `${highRisk} of ${n} profiles show a high driver load.`,
    });
  }

  alerts.sort((x, y) => (x.sev === y.sev ? 0 : x.sev === "HIGH" ? -1 : 1));
  return alerts.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Capability scorecard, built from the measured coverage
// ---------------------------------------------------------------------------
const FAMILY_OUTCOME: Record<string, { outcome: string; capability: string }> = {
  Strategy: {
    outcome: "Set direction and hold it over multiple years",
    capability: "Strategic talent: reading the field, choosing, and staying with the choice",
  },
  Operational: {
    outcome: "Turn the plan into running work, month after month",
    capability: "Operational talent: structure, follow-through, control",
  },
  Innovation: {
    outcome: "Keep renewing the offer instead of defending it",
    capability: "Innovation talent: sensing what is next and building it",
  },
  Interrelational: {
    outcome: "Keep people and partners moving in the same direction",
    capability: "Interrelational talent: connecting, facilitating, carrying others",
  },
};

function membersWithFamily(leden: BoardMemberInput[], fam: string): string[] {
  return leden
    .filter((l) => (l.talent?.talentFoci ?? []).includes(fam))
    .map((l) => (l.naam?.trim() ? shortName(l.naam) : `Member ${l.id}`));
}

function ragFromBand(band: string | undefined): ScorecardRow["rag"] {
  if (band === "Strong") return "strong";
  if (band === "Adequate") return "adequate";
  return "gap";
}

function buildScorecard(agg: Fase2Aggregaat, leden: BoardMemberInput[]): ScorecardRow[] {
  if (leden.length === 0) return [];
  const bands = talentDetail(agg).coverageBands ?? {};
  const rows: ScorecardRow[] = TALENT_FAMILIES.map((fam) => {
    const who = membersWithFamily(leden, fam);
    const spec = FAMILY_OUTCOME[fam];
    return {
      outcome: spec.outcome,
      capability: spec.capability,
      who: who.length ? who.join(", ") : "Not carried in this group",
      rag: ragFromBand(bands[fam]),
    };
  });

  // Cognitive fit against the required level, when a level was set.
  const map = agg.cognitiveMap;
  if (map.requiredStratum != null && map.teamMaxStratum > 0) {
    const carriers = leden
      .filter((l) => (l.talent?.stratumIndicatie ?? 0) === map.teamMaxStratum)
      .map((l) => (l.naam?.trim() ? shortName(l.naam) : `Member ${l.id}`));
    rows.push({
      outcome: `Work at the complexity the ambition implies (stratum ${roman(map.requiredStratum)})`,
      capability: `Highest indicative stratum in the group is ${roman(map.teamMaxStratum)}`,
      who: carriers.length ? carriers.join(", ") : "No indicative stratum available",
      rag: map.fit === "Fit" ? "strong" : map.fit === "Stretch" ? "adequate" : "gap",
    });
  }

  // Energy is only reported when an instrument actually asked about it.
  const ed = energyDetail(agg);
  if (agg.d2Energy.beschikbaar && typeof ed.teamMean === "number") {
    rows.push({
      outcome: "Keep the pace sustainable while the load rises",
      capability: `Measured energy: team mean ${ed.teamMean.toFixed(1)}/10, band ${agg.d2Energy.band}`,
      who: `${ed.n ?? 0} of ${leden.length} profiles carry an energy reading`,
      rag: agg.d2Energy.band === "Robust" ? "strong" : agg.d2Energy.band === "Watch" ? "adequate" : "gap",
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Key-person exposure, derived from the roster
// ---------------------------------------------------------------------------
function buildKeyPerson(agg: Fase2Aggregaat, leden: BoardMemberInput[]): KeyPersonCard[] {
  const n = leden.length;
  if (n === 0) return [];
  const cards: KeyPersonCard[] = [];
  const naam = (l: BoardMemberInput) => (l.naam?.trim() ? l.naam.trim() : `Member ${l.id}`);

  // A family carried by exactly one member is a single point of failure.
  for (const fam of TALENT_FAMILIES) {
    const carriers = leden.filter((l) => (l.talent?.talentFoci ?? []).includes(fam));
    if (carriers.length !== 1) continue;
    const one = carriers[0];
    cards.push({
      title: `${fam} rests on one person: ${naam(one)}`,
      sev: "HIGH",
      color: RED,
      impact: `In this group only ${naam(one)} carries ${fam.toLowerCase()} talent as a dominant focus. Everything that needs it runs through one person.`,
      depth: "Succession depth: none inside this group for this family.",
      mitigation: "Mitigation: give a second member this work explicitly, write down what is now carried in one head, and weigh the family in the next hire.",
    });
  }

  // A unique highest indicative stratum concentrates the longest horizon.
  const map = agg.cognitiveMap;
  if (map.teamMaxStratum > 0) {
    const top = leden.filter((l) => (l.talent?.stratumIndicatie ?? 0) === map.teamMaxStratum);
    if (top.length === 1 && n >= 2) {
      cards.push({
        title: `Longest horizon rests on one person: ${naam(top[0])}`,
        sev: "WATCH",
        color: AMBER,
        impact: `The highest indicative stratum in this group (${roman(map.teamMaxStratum)}) appears once. The furthest-reaching questions land with one person.`,
        depth: "Succession depth: limited; this is an indication of work horizon, never a ranking of people.",
        mitigation: "Mitigation: share the long-horizon files, use the board for a second reading, and build the horizon into development.",
      });
    }
  }

  // Members with a heavily loaded driver pattern.
  const loaded = leden.filter((l) => l.talent?.driverRisico === "hoog");
  if (loaded.length) {
    cards.push({
      title: loaded.length === 1
        ? `Driver load under pressure: ${naam(loaded[0])}`
        : `Driver load under pressure: ${loaded.length} of ${n} members`,
      sev: loaded.length >= Math.ceil(n / 2) ? "HIGH" : "WATCH",
      color: loaded.length >= Math.ceil(n / 2) ? RED : AMBER,
      impact: "A heavily loaded driver pattern takes over precisely when the pressure rises, which is when the group needs the widest view.",
      depth: `Concerns: ${loaded.map(naam).join(", ")}.`,
      mitigation: "Mitigation: name the pattern out loud in the team, agree what the person needs from the context, and make it a coaching subject rather than a performance verdict.",
    });
  }

  // Nothing found is a finding in itself.
  if (cards.length === 0) {
    cards.push({
      title: "No single point of failure found in this reading",
      sev: "WATCH",
      color: AMBER,
      impact: `Across the ${n} profiles every talent family is carried by more than one person and no driver pattern is heavily loaded on its own.`,
      depth: "Succession depth: shared inside this group for what was measured here.",
      mitigation: "Mitigation: this reading covers talent, energy and work horizon. It says nothing about who holds the client, licence or credit relationships; check those separately.",
    });
  }
  return cards.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Energy strip: only real readings
// ---------------------------------------------------------------------------
function buildEnergy(agg: Fase2Aggregaat, leden: BoardMemberInput[]): VisualData["energy"] {
  // Alleen leden met een energiemeting van een instrument dat er echt naar
  // vraagt. Wie alleen een 2MINSCAN heeft, heeft geen energiecijfer en hoort
  // hier dus niet te staan.
  const named = leden
    .map((l, i) => ({ lid: l, i, waarde: ledenEnergie(l) }))
    .filter((r): r is { lid: BoardMemberInput; i: number; waarde: number } => r.waarde !== null);

  const members: EnergyMember[] = named.map(({ lid, i, waarde }) => ({
    name: lid.naam?.trim() ? shortName(lid.naam) : `Member ${i + 1}`,
    energy: Math.round(waarde),
    phase: typeof lid.energy?.fase === "number" ? `Phase ${lid.energy.fase}` : "Phase not recorded",
  }));

  const ed = energyDetail(agg);
  const energies = members.map((m) => m.energy);
  const mean = typeof ed.teamMean === "number"
    ? ed.teamMean
    : energies.length
      ? energies.reduce((a, b) => a + b, 0) / energies.length
      : null;
  const dispersion = typeof ed.dispersion === "number" ? ed.dispersion : stdev(energies);

  return {
    members,
    mean: mean === null ? null : Math.round(mean * 10) / 10,
    meanBand: agg.d2Energy.beschikbaar ? agg.d2Energy.band : "Not measured",
    dispersion: Math.round(dispersion * 10) / 10,
    missing: leden.length - members.length,
  };
}

// ---------------------------------------------------------------------------
// Stratum map
// ---------------------------------------------------------------------------
function buildStratum(map: CognitiveMap): VisualData["stratum"] {
  const spans: Record<number, string> = {
    1: "1 day - 3 mo", 2: "3 mo - 1 yr", 3: "1 - 2 yr", 4: "2 - 5 yr",
    5: "5 - 10 yr", 6: "10 - 20 yr", 7: "20 - 50 yr",
  };
  // Show the strata that actually occur, plus the required level, so the map is
  // never padded with empty rows nor cut off above the group.
  const occurring = Object.entries(map.distribution ?? {})
    .filter(([, c]) => (c ?? 0) > 0)
    .map(([s]) => Number(s));
  const anchors = [...occurring];
  if (map.requiredStratum != null) anchors.push(map.requiredStratum);
  const want = anchors.length
    ? Array.from(
        { length: Math.max(...anchors) - Math.min(...anchors) + 1 },
        (_, k) => Math.min(...anchors) + k,
      )
    : [];

  const rows: StratumRow[] = want.map((s) => ({
    name: `Stratum ${roman(s)}`,
    span: spans[s] ?? "",
    count: map.distribution?.[s] ?? 0,
  }));
  const maxCount = Math.max(1, ...rows.map((r) => r.count), 1);
  const requiredIdx = map.requiredStratum != null ? want.indexOf(map.requiredStratum) : -1;
  const fitVerdict = (map.fit === "n/a" ? "NOT SET" : map.fit).toUpperCase();

  let fitNote: string;
  if (!rows.length) {
    fitNote = "No indicative stratum available for this group, so no work-horizon reading is made.";
  } else if (map.requiredStratum == null) {
    fitNote = `Highest indicative stratum in this group is ${roman(map.teamMaxStratum)}. No required level was set for this trajectory, so this map shows spread only.`;
  } else if (map.fit === "Fit") {
    fitNote = `Highest indicative stratum is ${roman(map.teamMaxStratum)}; the ambition implies ${roman(map.requiredStratum)}. The horizon is present inside the group.`;
  } else if (map.fit === "Stretch") {
    fitNote = `Highest indicative stratum is ${roman(map.teamMaxStratum)}; the ambition implies ${roman(map.requiredStratum)}. One step short, closeable through board composition and a complementary senior hire.`;
  } else {
    fitNote = `Highest indicative stratum is ${roman(map.teamMaxStratum)}; the ambition implies ${roman(map.requiredStratum)}. More than one step short, so the gap needs structural attention rather than encouragement.`;
  }
  // The longer non-ranking guardrail from the aggregation (map.note) sits in the
  // chapter intro and the ethics charter, not in this band: it would overflow.
  return { rows, maxCount, requiredIdx, fitVerdict, fitNote };
}

function buildVisuals(agg: Fase2Aggregaat, leden: BoardMemberInput[]): VisualData {
  return {
    pyramid: buildPyramid(agg),
    sliders: buildSliders(agg, leden),
    conflict: buildConflict(agg, leden),
    energy: buildEnergy(agg, leden),
    stratum: buildStratum(agg.cognitiveMap),
    gauge: { value: agg.index, band: indexBand(agg.index), color: verdictColor(agg.verdict) },
    scorecard: buildScorecard(agg, leden),
    keyperson: buildKeyPerson(agg, leden),
    comppot: [],
  };
}

// ---------------------------------------------------------------------------
// Member cards, always from the live roster
// ---------------------------------------------------------------------------
function buildCards(leden: BoardMemberInput[]): CardSpec[] {
  if (leden.length === 0) return [];
  const dot = " \u00b7 ";
  return leden.map((l) => {
    const t = l.talent ?? {};
    const lines: string[] = [];
    if ((t.talentFoci ?? []).length) lines.push(`Talent: ${t.talentFoci!.join(dot)}`);
    if ((t.versnellers ?? []).length) lines.push(`Accelerators: ${t.versnellers!.join(dot)}`);
    // DRIVER(S) - Kahler term, never translated
    if ((t.drivers ?? []).length) lines.push(`DRIVER(S): ${t.drivers!.join(dot)}`);
    const stratPart = t.stratumIndicatie ? `Stratum: ${stratumLabel(t.stratumIndicatie)}` : "";
    const waarde = ledenEnergie(l);
    const enPart = waarde !== null
      ? `Energy: ${Math.round(waarde)}/10${typeof l.energy?.fase === "number" ? ` (Phase ${l.energy.fase})` : ""}`
      : "";
    if (stratPart && enPart) lines.push(`${stratPart} \u00b7 ${enPart}`);
    else if (stratPart) lines.push(`${stratPart} (indicative)`);
    else if (enPart) lines.push(enPart);
    if (l.samenvatting?.trim()) lines.push(l.samenvatting.trim());
    if (lines.length === 0) lines.push("No scored profile available for this member.");
    return {
      title: l.naam?.trim() ? l.naam.trim() : `Member ${l.id}`,
      role: l.rol?.trim() || "Management team",
      lines,
    };
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
  const confidentiality = opts.confidentiality || "Strictly Confidential";
  const revenueNow = opts.revenueNow?.trim() || null;
  const revenueTarget = opts.revenueTarget?.trim() || null;
  const fteFrom = typeof opts.fteFrom === "number" ? opts.fteFrom : null;
  const fteTo = typeof opts.fteTo === "number" ? opts.fteTo : null;

  const variant = audience === "investor" ? "Investor Report" : "Team Report";
  const recipient = audience === "investor" ? "The Investment Committee" : "The Leadership Team";

  // Context line: only what the caller actually supplied. Without ambition
  // figures the line names the assessment context and nothing more.
  const contextDelen = [agg.contextLabel];
  if (revenueNow && revenueTarget) contextDelen.push(`${revenueNow} to ${revenueTarget}`);
  else if (revenueTarget) contextDelen.push(`target ${revenueTarget}`);
  if (fteFrom !== null && fteTo !== null) contextDelen.push(`${fteFrom} to ${fteTo} FTE`);

  const instrumenten = ["Lencioni Team Health (Teamscan)", "T4P Business (talent, DRIVER(S), indicative stratum)"];
  if (agg.d2Energy.beschikbaar) instrumenten.push("energy reading on the 0-10 scale");
  instrumenten.push("2MINSCAN energetic behaviour profile");

  const meta: FlagshipMeta = {
    date,
    confidentiality,
    company,
    investorLabel,
    context: contextDelen.join(" \u00b7 "),
    basis: `${instrumenten.join(" \u00b7 ")} (n=${agg.n})`,
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
        pillLabel: "Recommendation",
        pillSub: agg.verdict === "proceed"
          ? "Human-capital profile carries the ambition; the risk is governable."
          : "Human-capital profile with conditions to manage before commitment.",
      }
    : {
        value, band, verdict: agg.verdict,
        verdictShort: band,
        pillLabel: "Team reading",
        pillSub: value >= 78
          ? "Strong team foundation, with a few patterns to manage as the load rises."
          : "Working foundation with clear development edges.",
      };

  const per = pillarAverages(agg);
  const num = (k: string): number | null => (typeof per[k]?.avg === "number" ? per[k].avg : null);
  const td = talentDetail(agg);
  const ed = energyDetail(agg);

  const facts: FlagshipFacts = {
    revenueNow, revenueTarget, fteFrom, fteTo,
    trust: num("Trust"),
    conflict: num("Healthy Conflict"),
    commitment: num("Commitment"),
    accountability: num("Accountability"),
    results: num("Results"),
    n: agg.n,
    teamHealthMean: typeof (agg.d1TeamHealth.detail as { overall?: number })?.overall === "number"
      ? (agg.d1TeamHealth.detail as { overall?: number }).overall!
      : null,
    teamHealthBand: agg.d1TeamHealth.band,
    energyMean: typeof ed.teamMean === "number" ? ed.teamMean : null,
    energyBand: agg.d2Energy.beschikbaar ? agg.d2Energy.band : null,
    energyMissing: typeof ed.ontbrekend === "number" ? ed.ontbrekend : agg.n,
    energyDispersion: typeof ed.dispersion === "number" ? ed.dispersion : null,
    talentBand: agg.d3Talent.band,
    thinFamilies: td.thinFamilies ?? [],
    coverage: td.coverage ?? {},
    driverFreq: td.driverFreq ?? {},
    driverHighRiskCount: td.driverHighRiskCount ?? 0,
    requiredStratum: agg.cognitiveMap.requiredStratum,
    teamMaxStratum: agg.cognitiveMap.teamMaxStratum,
    fit: agg.cognitiveMap.fit,
    stratumNote: agg.cognitiveMap.note,
    memberNames: leden.map((l) => (l.naam?.trim() ? l.naam.trim() : `Member ${l.id}`)),
    minNMet: agg.minNMet,
    // One readable sentence: which dimensions actually fed the composite, and
    // which did not. A missing dimension stays missing, never averaged away.
    indexBasis: agg.indexBasis.volledig
      ? `all four dimensions (${agg.indexBasis.gebruikteDimensies.join(", ")})`
      : `${agg.indexBasis.gebruikteDimensies.join(", ")} only, without ${agg.indexBasis.ontbrekendeDimensies.join(" and ")}`,
  };

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
