/**
 * Human Due Diligence: flagship report engine (ALWAYS English).
 * ------------------------------------------------------------------
 * One engine, two audiences:
 *   audience = "investor" → full flagship Investor Report
 *   audience = "team"     → derived Team Report (investor-only blocks removed,
 *                           verdict reframed to development language)
 *
 * The investing party is a VARIABLE (investorLabel); never hard-code PMV.
 * The report is always rendered in English regardless of questionnaire language.
 *
 * Output is a structured JSON model (sections) that the client renders and that
 * can be exported. Keeping it as a model, not a hard-coded HTML string, lets
 * the same content drive screen, PDF and DOCX without divergence.
 */

import {
  type Fase2Aggregaat,
  type BoardMemberInput,
  STRATUM_TIMESPAN,
  INDEX_WEIGHTS,
  VERDICT_THRESHOLDS,
  TEAM_HEALTH_BANDS,
  ENERGY_BANDS,
  HDD_MIN_RESPONDENTS,
  ledenEnergie,
} from "./aggregatie";

export type Audience = "investor" | "team";

export interface RapportSectie {
  id: string;
  title: string;
  audience: Audience[]; // which audiences see this section
  body?: string[]; // paragraphs
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  cards?: Array<{ title: string; lines: string[] }>;
  callout?: { label: string; text: string };
}

export interface RapportModel {
  language: "en";
  audience: Audience;
  meta: {
    title: string;
    subtitle: string;
    boardLabel: string;
    investorLabel: string;
    contextLabel: string;
    date: string;
    confidentiality: string;
    basis: string;
  };
  index: { value: number; band: string; verdict: string; verdictLabel: string };
  secties: RapportSectie[];
}

// ---------------------------------------------------------------------------
// Verdict language (audience-aware)
// ---------------------------------------------------------------------------
function verdictLabel(verdict: Fase2Aggregaat["verdict"], audience: Audience): string {
  if (audience === "team") {
    switch (verdict) {
      case "proceed":
        return "Exceptionally strong foundation";
      case "conditional":
        return "Strong, with targeted development areas";
      case "hold-conditional":
        return "Material development needed before scaling";
      case "hold":
        return "Significant foundational areas to address";
    }
  }
  switch (verdict) {
    case "proceed":
      return "Proceed";
    case "conditional":
      return "Proceed with conditions";
    case "hold-conditional":
      return "Hold (conditional)";
    case "hold":
      return "Hold";
  }
}

function indexBand(index: number): string {
  if (index >= VERDICT_THRESHOLDS.proceed) return "Strong";
  if (index >= VERDICT_THRESHOLDS.conditional) return "Solid";
  if (index >= VERDICT_THRESHOLDS.hold) return "Developing";
  return "At risk";
}

function fmtPct(x: number): string {
  return `${Math.round(x)}/100`;
}

// Het HDD-rapport is altijd Engels. Deze zin zegt in gewone taal waarop het
// samengestelde cijfer rust wanneer er een onderdeel ontbreekt.
function indexBasisZin(agg: Fase2Aggregaat): string[] {
  if (agg.indexBasis.volledig) return [];
  const ontbreekt = agg.indexBasis.ontbrekendeDimensies.join(" and ");
  return [
    `Note on this figure: ${ontbreekt} could not be measured, so that part is missing from the ` +
      "composite. The team figure therefore rests on fewer data than intended and is less solid " +
      "than a complete figure. No middle value has been filled in: a missing measurement stays " +
      "missing.",
  ];
}

// ---------------------------------------------------------------------------
// Member scorecards
// ---------------------------------------------------------------------------
function memberCards(leden: BoardMemberInput[]): Array<{ title: string; lines: string[] }> {
  return leden.map((l, i) => {
    const name = l.naam?.trim() || `Board member ${i + 1}`;
    const foci = (l.talent?.talentFoci ?? []).join(" → ") || "-";
    const acc = (l.talent?.versnellers ?? []).join(" / ") || "-";
    const drivers = (l.talent?.drivers ?? []).join(" / ") || "-"; // DRIVER(S) untranslated
    const stratum = l.talent?.stratumIndicatie
      ? `Stratum ${l.talent.stratumIndicatie} (${STRATUM_TIMESPAN[l.talent.stratumIndicatie] ?? "-"}), indicative`
      : "-";
    // Alleen energie tonen die van een instrument komt dat er echt naar vraagt.
    const gemetenEnergie = ledenEnergie(l);
    const energy =
      gemetenEnergie != null
        ? `${gemetenEnergie}/10${l.energy?.fase != null ? `, Phase ${l.energy.fase}` : ""}`
        : "not measured (no instrument that asks about energy)";
    const risk = l.talent?.driverRisico
      ? l.talent.driverRisico === "hoog"
        ? "elevated burnout-sensitivity"
        : l.talent.driverRisico === "matig"
          ? "moderate burnout-sensitivity"
          : "low burnout-sensitivity"
      : "-";
    return {
      title: name,
      lines: [
        `Talent sequence: ${foci}`,
        `Accelerators: ${acc}`,
        `DRIVER(S): ${drivers} (${risk})`,
        `Cognitive capacity: ${stratum}`,
        `Energy: ${energy}`,
      ],
    };
  });
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------
export interface BouwRapportOpts {
  audience: Audience;
  boardLabel: string;
  investorLabel?: string; // VARIABLE, default generic
  context: "ma" | "self-screening";
  agg: Fase2Aggregaat;
  leden: BoardMemberInput[];
  date?: string;
}

export function bouwRapport(opts: BouwRapportOpts): RapportModel {
  const { audience, agg, leden } = opts;
  const investorLabel =
    opts.investorLabel?.trim() || "the investing party";
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const isInvestor = audience === "investor";

  const vLabel = verdictLabel(agg.verdict, audience);
  const secties: RapportSectie[] = [];

  // --- Privacy guard: below minimum-N, suppress aggregates ---
  if (!agg.minNMet) {
    secties.push({
      id: "min-n",
      title: "Aggregated results withheld",
      audience: ["investor", "team"],
      callout: {
        label: "Privacy safeguard",
        text:
          `Team-level results require at least ${HDD_MIN_RESPONDENTS} respondents before ` +
          `individual data becomes non-inferable. With ${agg.n} respondent(s), aggregated ` +
          `scores are withheld to protect participant privacy (GDPR data-minimisation).`,
      },
    });
  }

  // --- 1. Executive Verdict ---
  const dimTable = {
    headers: ["Dimension", "Source", "Score", "Band"],
    rows: [
      ["Team Health", "Lencioni (Teamscan)", fmtPct(agg.d1TeamHealth.score100), agg.d1TeamHealth.band],
      [
        "Energy Sustainability",
        "Instrument that asks about energy",
        agg.d2Energy.beschikbaar ? fmtPct(agg.d2Energy.score100) : "not measured",
        agg.d2Energy.band,
      ],
      ["Talent Capability", "T4P Business", fmtPct(agg.d3Talent.score100), agg.d3Talent.band],
      ["Cognitive Capacity", "Indicative Jaques", fmtPct(agg.d4Cognitive.score100), agg.d4Cognitive.band],
    ],
  };

  if (isInvestor) {
    secties.push({
      id: "verdict",
      title: "Executive Verdict",
      audience: ["investor"],
      body: [
        `For ${investorLabel}, this Human Due Diligence assesses the human-capital foundation of ` +
          `${opts.boardLabel} in the context of ${agg.contextLabel.toLowerCase()}.`,
        `The HDD Human Capital Index is ${agg.index}/100 (${indexBand(agg.index)}). ` +
          `Recommendation: ${vLabel}.`,
        ...indexBasisZin(agg),
      ],
      table: dimTable,
      callout: {
        label: "Recommendation",
        text:
          `${vLabel}, index ${agg.index}/100. This is a decision aid, not an automatic verdict; ` +
          `the investing organisation retains final authority and may override with motivation.`,
      },
    });
  } else {
    secties.push({
      id: "verdict",
      title: "Team Snapshot",
      audience: ["team"],
      body: [
        `This report reflects how ${opts.boardLabel} experiences its own collaboration, energy and talent. ` +
          `It is a development mirror, not a judgement of individuals.`,
        `Overall standing: ${vLabel} (composite ${agg.index}/100, ${indexBand(agg.index)}).`,
        ...indexBasisZin(agg),
      ],
      table: dimTable,
    });
  }

  // --- 2. Methodology & Scientific Basis ---
  secties.push({
    id: "methodology",
    title: "Methodology & Scientific Basis",
    audience: ["investor", "team"],
    body: [
      "This assessment combines three validated TaPas instruments through one orchestrated " +
        "journey. The report is always produced in English.",
      "Scoring is multidimensional: each dimension keeps its native scientific band, and a " +
        "deliberately weighted composite, the HDD Human Capital Index, summarises them. This " +
        "is the psychometrically recommended approach; a well-weighted composite is more reliable " +
        "and valid than its subscores, while the separate bands preserve dimensional information " +
        "that a naive average would hide.",
    ],
    bullets: [
      `Team Health uses the official 38-item Lencioni cut-offs: High \u2265 ${TEAM_HEALTH_BANDS.high}, ` +
        `Medium ${TEAM_HEALTH_BANDS.medium}\u2013${(TEAM_HEALTH_BANDS.high - 0.01).toFixed(2)}, ` +
        `Low \u2264 ${(TEAM_HEALTH_BANDS.medium - 0.01).toFixed(2)} on the 1\u20135 scale.`,
      `Energy uses the shared platform bands: Robust \u2265 ${ENERGY_BANDS.robust}, Watch ` +
        `${ENERGY_BANDS.watch}\u2013${(ENERGY_BANDS.robust - 0.1).toFixed(1)}, Fragile < ` +
        `${ENERGY_BANDS.watch} on 0\u201310. These cut-offs are a developer convention, not a ` +
        "calibration on a norm group.",
      "Energy is only counted when it comes from an instrument that actually asks about energy. " +
        "The 2MINSCAN produces an energetic behaviour profile, not a figure on this 0-10 scale, so " +
        "a 2MINSCAN intake on its own yields no energy value. That then shows as missing data.",
      ...indexBasisZin(agg),
      "Talent Capability scores coverage and complementarity of the Strategy, Operational, " +
        "Innovation and Interrelational families plus accelerators (T4P Business).",
      `Composite weighting: Team Health ${INDEX_WEIGHTS.d1 * 100}%, Energy ${INDEX_WEIGHTS.d2 * 100}%, ` +
        `Talent ${INDEX_WEIGHTS.d3 * 100}%, Cognitive ${INDEX_WEIGHTS.d4 * 100}% (open and adjustable per engagement).`,
      "Cognitive capacity (Jaques stratum) is INDICATIVE, derived from the T4P profile, and is " +
        "never used to rank people, consistent with Requisite Organization ethics.",
    ],
  });

  // --- 3. Team Health (Lencioni) ---
  const th = agg.d1TeamHealth.detail as { overall: number; perPillar: Record<string, { avg: number; band: string }> };
  secties.push({
    id: "team-health",
    title: "Team Health: Lencioni Pillars",
    audience: ["investor", "team"],
    body: [
      `Overall team-health average: ${th.overall}/5 (${agg.d1TeamHealth.band}). ` +
        `The five pillars build on one another from Trust upward.`,
    ],
    table: {
      headers: ["Pillar", "Average (1\u20135)", "Band"],
      rows: Object.entries(th.perPillar).map(([k, v]) => [k, String(v.avg), v.band]),
    },
  });

  // --- 4. Energy Sustainability ---
  const en = agg.d2Energy.detail as {
    teamMean: number | null;
    dispersion: number | null;
    phase0Count: number;
    n: number;
    ontbrekend?: number;
  };
  secties.push({
    id: "energy",
    title: "Energy Sustainability",
    audience: ["investor", "team"],
    body: agg.d2Energy.beschikbaar
      ? [
          `Team energy averages ${en.teamMean}/10 (${agg.d2Energy.band}), with dispersion ${en.dispersion} ` +
            `across ${en.n} member(s); ${en.phase0Count} member(s) at Phase 0 (fully energised).`,
          ...(en.ontbrekend
            ? [
                `${en.ontbrekend} member(s) supplied no energy measurement, so this figure rests on ` +
                  `${en.n} of ${leden.length} member(s).`,
              ]
            : []),
          "Energy is read as a point-in-time signal. A robust mean with low dispersion indicates a " +
            "sustainable team rhythm; high dispersion can mask individuals carrying disproportionate load.",
        ]
      : [
          "No energy was measured for this board. Not a single member completed an instrument that " +
            "actually asks about energy, so there is no figure to report here.",
          "This is missing data, not a low score. Nothing has been filled in on their behalf: an " +
            "average or a middle value would make the report look as though something had been " +
            "measured. The energy component therefore does not count towards the overall figure, " +
            "which consequently rests on fewer data than intended.",
          "A 2MINSCAN intake on its own does not produce this figure. The 2MINSCAN gives an " +
            "energetic behaviour profile (colour order and X-position), not a number on a 0-10 " +
            "scale. To obtain an energy figure, a member has to complete an instrument that asks " +
            "about energy per item.",
        ],
  });

  // --- 5. Individual Capability Scorecards (T4P) ---
  secties.push({
    id: "scorecards",
    title: "Individual Capability Scorecards",
    audience: ["investor", "team"],
    body: [
      "Each board member's talent sequence, accelerators, DRIVER(S) and indicative cognitive " +
        "capacity. DRIVER(S) is a Process Communication term and is kept in English.",
    ],
    cards: memberCards(leden),
  });

  // --- 6. Talent Coverage & Complementarity ---
  const tl = agg.d3Talent.detail as {
    coverageBands: Record<string, string>;
    thinFamilies: string[];
    driverFreq: Record<string, number>;
    driverHighRiskCount: number;
  };
  secties.push({
    id: "talent-coverage",
    title: "Talent Coverage & Complementarity",
    audience: ["investor", "team"],
    table: {
      headers: ["Talent family", "Coverage"],
      rows: Object.entries(tl.coverageBands).map(([k, v]) => [k, v]),
    },
    bullets: [
      tl.thinFamilies.length
        ? `Thin coverage to watch: ${tl.thinFamilies.join(", ")}. The strategic talent least present for the ambition.`
        : "All four talent families are covered across the team.",
      `Aggregated DRIVER(S): ${Object.entries(tl.driverFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([d, c]) => `${d} (\u00d7${c})`)
        .join(", ") || "\u2014"}.`,
      tl.driverHighRiskCount > 0
        ? `${tl.driverHighRiskCount} member(s) show elevated burnout-sensitivity under sustained pressure.`
        : "No member shows elevated burnout-sensitivity at this time.",
    ],
  });

  // --- 7. Cognitive Capacity Map (Jaques) ---
  const cm = agg.cognitiveMap;
  secties.push({
    id: "cognitive",
    title: "Cognitive Capacity Map (Indicative)",
    audience: ["investor", "team"],
    body: [
      cm.requiredStratum != null
        ? `The growth ambition implies work-complexity at Stratum ${cm.requiredStratum} ` +
          `(${STRATUM_TIMESPAN[cm.requiredStratum] ?? "\u2014"}). The board's highest indicative stratum is ` +
          `${cm.teamMaxStratum} → fit: ${cm.fit}.`
        : `The board's indicative cognitive capacity spans the strata below. No required level was set, ` +
          `so this is a distribution, not a fit test.`,
    ],
    table: {
      headers: ["Stratum", "Time-span of discretion", "Members (count)"],
      rows: Object.keys(STRATUM_TIMESPAN)
        .map(Number)
        .filter((s) => (cm.distribution[s] ?? 0) > 0)
        .map((s) => [`Stratum ${s}`, STRATUM_TIMESPAN[s], String(cm.distribution[s])]),
    },
    callout: { label: "Ethical guardrail", text: cm.note },
  });

  // --- 8. Integrated SWOT ---
  secties.push({
    id: "swot",
    title: "Integrated SWOT",
    audience: ["investor", "team"],
    table: {
      headers: ["Strengths", "Weaknesses"],
      rows: [
        [
          agg.d1TeamHealth.band === "High" ? "High team health across pillars" : "Functional team health",
          tl.thinFamilies.length ? `Thin talent: ${tl.thinFamilies.join(", ")}` : "Balanced talent coverage",
        ],
        [
          !agg.d2Energy.beschikbaar
            ? "Energy not measured"
            : agg.d2Energy.band === "Robust"
              ? "Robust, sustainable energy"
              : "Energy to monitor",
          tl.driverHighRiskCount > 0 ? "Burnout-sensitivity under pressure" : "Low burnout signal",
        ],
      ],
    },
    bullets: [
      "Opportunities: convert complementary talent into formal role clarity and resilient governance.",
      "Threats: under sustained scaling pressure, high-drive patterns can drift into collective overdrive " +
        "unless energy and structure are actively managed.",
    ],
  });

  // --- 9. Role & Governance Recommendations ---
  secties.push({
    id: "recommendations",
    title:
      audience === "team" ? "Team Development Recommendations" : "Role & Governance Recommendations",
    audience: ["investor", "team"],
    bullets:
      audience === "team"
        ? [
            "Translate complementary talent into explicit role clarity so accountability is real, not implied.",
            "Institute a quarterly energy check to track trends, not just point-in-time states.",
            tl.thinFamilies.length
              ? `Strengthen the thin talent areas (${tl.thinFamilies.join(", ")}) through development or complementary hiring.`
              : "Maintain talent balance as the team grows.",
            "Create structured reflection on when high-drive patterns help versus hinder.",
          ]
        : [
            "Formalise decision rights and a delegation framework (strategic vs. operational authority).",
            "Establish board-level KPIs: voluntary turnover, engagement, energy trend, vacation utilisation.",
            tl.thinFamilies.length
              ? `Support complementary hiring for thin talent areas (${tl.thinFamilies.join(", ")}).`
              : "Preserve talent balance through the next scaling stage.",
            "Institute quarterly energy measurement as a governance KPI to ensure cultural safeguards scale.",
          ],
  });

  // --- 10. Risk Register (investor only) ---
  if (isInvestor) {
    secties.push({
      id: "risk-register",
      title: "Risk Register",
      audience: ["investor"],
      table: {
        headers: ["Risk", "Likelihood", "Impact", "Mitigation owner"],
        rows: [
          ["Autonomy erosion under pressure", "Medium", "High", "Board charter / delegation review"],
          ["Collective overdrive → burnout", tl.driverHighRiskCount > 0 ? "Medium" : "Low", "High", "Energy KPIs"],
          ["Process/structure under-investment", "Medium", "Medium", "Complementary hiring"],
          ["Talent single-points-of-failure", tl.thinFamilies.length ? "Medium" : "Low", "Medium", "Succession planning"],
        ],
      },
    });

    // --- 11. Open Questions / Verification Conditions (investor only) ---
    secties.push({
      id: "verification",
      title: "Open Questions & Verification Conditions",
      audience: ["investor"],
      bullets: [
        "Confirm each assessed individual holds the authority and accountability assumed here.",
        "Request empirical risk data (turnover, engagement, historical energy) to validate sustainability.",
        "Clarify valuation, terms, ownership and governance role before final commitment.",
      ],
    });
  }

  // --- 12. GDPR · Privacy · Ethics Charter ---
  secties.push({
    id: "ethics",
    title: "GDPR · Privacy · Ethics Charter",
    audience: ["investor", "team"],
    bullets: [
      `Minimum respondents: team-level results require \u2265 ${HDD_MIN_RESPONDENTS} respondents before ` +
        "individual data becomes inferable; below that, aggregates are withheld.",
      "Data minimisation & separation: the Team Report contains no investor-only material; the " +
        "Investor Report exposes scored constructs, not raw item responses.",
      "Lawful basis & consent: each profile carries a documented consent scope and timestamp; " +
        "processing is limited to the stated purpose.",
      "Purpose limitation: this assessment serves human-capital due diligence or team self-screening " +
        "and must not be reused for individual performance management.",
      "Non-ranking: cognitive capacity is a distribution and fit analysis, never a league table " +
        "(Requisite Organization).",
      "Right to information: every participant may receive their own underlying profile.",
    ],
  });

  // --- 13. Methodology Appendix ---
  secties.push({
    id: "appendix",
    title: "Methodology Appendix",
    audience: ["investor", "team"],
    body: [
      "Instruments: TaPas Teamscan (Lencioni 38-item), 2MINSCAN (energy), T4P Business (talent, " +
        "DRIVER(S), indicative Jaques stratum). All analysis is grounded in the participants' own " +
        "assessment data. The report is always rendered in English.",
    ],
  });

  // Filter sections by audience.
  const zichtbaar = secties.filter((s) => s.audience.includes(audience));

  return {
    language: "en",
    audience,
    meta: {
      title: isInvestor ? "Human Due Diligence: Assessment" : "Team Insight Report",
      subtitle: isInvestor
        ? `Human-capital due diligence for ${investorLabel}`
        : "How this team collaborates, sustains energy and combines talent",
      boardLabel: opts.boardLabel,
      investorLabel: isInvestor ? investorLabel : "",
      contextLabel: agg.contextLabel,
      date,
      confidentiality: isInvestor
        ? "Strictly Confidential: Investor Report · for the investing party only · NOT to be shared with the assessed team"
        : "Confidential: Team Report · may be shared with the assessed team",
      basis: "TaPas Teamscan (Lencioni) · 2MINSCAN · T4P Business",
    },
    index: {
      value: agg.index,
      band: indexBand(agg.index),
      verdict: agg.verdict,
      verdictLabel: vLabel,
    },
    secties: zichtbaar,
  };
}
