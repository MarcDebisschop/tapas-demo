/**
 * Flagship HDD report content + assembly — ports flagship_content.py.
 *
 * The chapter narrative is the fixed board-grade framework; live trajectory
 * data is injected at the marked points (scores, member cards, facts, company,
 * verdict, visuals). Two variants: investor (Ch0-13, incl. Ch12 Thesis) and
 * team (Ch0-11 + Ch13, NO Ch12).
 */
import { ACCENT, GOLD, GREEN, AMBER } from "./theme";
import { Layout } from "./layout";
import {
  para, lead, subhead, bullets, chapterHeading, callout, dataTable,
  memberCards, hardQa, figureCaption, CardSpec,
} from "./primitives";
import {
  VisualData,
  drawPyramid, drawSliders, drawConflict, drawEnergy, drawStratum,
  drawScorecard, drawKeyPerson, drawCompPot,
} from "./visuals";

export type Audience = "investor" | "team";

export interface FlagshipMeta {
  date: string;
  confidentiality: string;
  company: string;
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
  verdictShort: string;  // Proceed | High-Performing | ...
  pillSub: string;
}

export interface FlagshipFacts {
  // narrative facts injected into chapter prose
  revenueNow: string;     // "€190M"
  revenueTarget: string;  // "€500M+"
  fteFrom: number;        // 300
  fteTo: number;          // 600
  // dimension scores for the Team Health table + pyramid rails
  trust: number; conflict: number; commitment: number; accountability: number; results: number;
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
// Chapter builders
// ===================================================================
function chExecutive(L: Layout, fi: FlagshipInput) {
  const { audience, facts } = fi;
  chapterHeading(L, "Chapter 0 \u00b7 Executive Verdict",
    "The Recommendation, in One Reading",
    "Everything an investment committee needs before turning a page.");
  if (audience === "investor") {
    lead(L,
      `Proceed with an active governance partnership. On human-capital grounds this is a ` +
      `high-conviction opportunity: a profitable ${facts.revenueNow} scale-up led not by two founders but by ` +
      `seven crisis-tested, fully-energised leaders whose team health sits in the top decile. The ` +
      `capability to scale from ${facts.revenueNow} to ${facts.revenueTarget} is present today. What it requires from the ` +
      `investor is not passive board observation but the deliberate installation of governance and ` +
      `energy-management infrastructure as complexity grows.`);
  } else {
    lead(L,
      "This is a high-performing leadership team. Across team health, energy, talent coverage and " +
      "cognitive capacity, the group scores in the strongest band we measure. This report is a " +
      "development mirror: it names what makes the team exceptional, and it names - without flinching " +
      "- the few patterns that, left unmanaged under scaling pressure, could erode that strength.");
  }
  L.guardMm(58);
  subhead(L, "Why - three reasons");
  bullets(L, [
    "<b>Proven performance, not early-stage risk.</b> Profitable since 2021, 15M+ units sold across " +
    "150+ countries, two-time Deloitte Fast 50 winner - capability validated by results, not promise.",
    "<b>Depth beyond the founders.</b> Seven leaders at Phase 0 energy with complementary talent " +
    "sequences and Stratum III-IV cognitive capacity; no single point of failure.",
    "<b>Crisis-tested resilience.</b> The 2020 COVID pivot (-80% revenue to 10x recovery in twelve " +
    "months) is stronger evidence of founder capability than any psychometric projection.",
  ]);
  if (audience === "investor") {
    L.guardMm(56);
    subhead(L, "On three conditions");
    bullets(L, [
      "<b>Verification.</b> Confirm that four of the five management members hold C-suite/VP " +
      "authority with genuine P&amp;L responsibility (only the VP of People is publicly verifiable).",
      "<b>Empirical risk validation.</b> Obtain 2021-2025 turnover data and historical energy " +
      "measurements to confirm the current Phase 0 reading is structural, not a post-holiday rebound.",
      "<b>Governance commitment.</b> The investor must be willing to act as an active governance " +
      "partner - decision-rights mapping, quarterly energy tracking, complementary senior hires.",
    ]);
  }
  L.advance(4);
  callout(L, "The one-line verdict",
    audience === "investor"
      ? "The question is not whether this team can execute - they have proven they can. The question is " +
        "whether governance infrastructure scales with complexity. That is the value the investor adds."
      : "The question is not whether this team is strong - it is. The question is whether its strengths " +
        "stay healthy under sustained scaling pressure. This report shows where to look.",
    GOLD, "#faf5e8");
  L.newBodyPage();
}

function chScorecard(L: Layout, fi: FlagshipInput) {
  const { audience, facts } = fi;
  chapterHeading(L, "Chapter 1 \u00b7 The Investment Scorecard",
    "What This Specific Plan Requires of the People",
    "The deal thesis, the outcomes it depends on, and the capabilities those outcomes demand.");
  if (audience === "investor") {
    para(L,
      "A human due-diligence report that grades leaders in the abstract answers the wrong question. " +
      "It tells you whether these are good executives; it does not tell you whether they are the " +
      "right team to execute <i>this</i> plan. So we begin where a best-in-class diligence begins: " +
      "with the scorecard. We state the deal thesis, decompose it into the value-creation outcomes " +
      "the thesis depends on, and derive from each outcome the capability the organisation must " +
      "have. Every assessment that follows is read against this anchor.");
  } else {
    para(L,
      "Before we describe the team, we make explicit what the team is being asked to do. This " +
      "scorecard translates the growth ambition into concrete outcomes and the capabilities each " +
      "outcome demands. It is the yardstick the rest of this report measures against - not an " +
      "abstract idea of \u201cgood leadership\u201d, but fitness for this specific journey.");
  }
  L.guardMm(28);
  subhead(L, "The deal thesis, in one sentence");
  callout(L, "Deal thesis",
    `Scale a profitable, brand-led ${facts.revenueNow} consumer business to ${facts.revenueTarget} over the hold period by ` +
    "deepening the operating organisation, sustaining the product-innovation edge, and " +
    "institutionalising governance - without burning out the high-drive team that built it.",
    ACCENT);
  L.advance(4);
  drawScorecard(L, fi.visuals.scorecard);
  figureCaption(L,
    "Figure 1.1 - Investment Scorecard. Each value-creation outcome the thesis depends on, the " +
    "capability it requires, where that capability sits in the team today, and the current bench " +
    "strength against it (Covered / Partial / Build).");
  L.advance(6);
  L.guardMm(40);
  subhead(L, "Reading the scorecard");
  bullets(L, [
    "<b>Two outcomes are covered by a dependable bench</b> - top-line scaling and product innovation " +
    "rest on the founders plus named management members, with redundancy.",
    "<b>Three are partial</b> - operating discipline, organisational build-out and culture/energy " +
    "protection are present but concentrated in one or two people; they need depth, not rescue.",
    "<b>One must be built</b> - governance and exit-readiness capability is thin today and is the " +
    "clearest place an active investor adds value, through board composition and a senior hire.",
  ]);
  L.advance(2);
  callout(L, "Why this section comes first",
    "The scorecard is the single intervention that turns an assessment into an investment decision. " +
    "Without it, the report answers \u201cis this a good team?\u201d With it, the report answers \u201cis this the " +
    "right team to execute our specific plan, and where exactly must we help?\u201d Only the second " +
    "question justifies a board-grade diligence.", GOLD, "#faf5e8");
  L.newBodyPage();
}

function chWhy(L: Layout, _fi: FlagshipInput) {
  chapterHeading(L, "Chapter 2 \u00b7 Why We Measure What We Measure",
    "Every Measurement Earns Its Place",
    "Before a single score, the scientific case for each instrument in this assessment.");
  para(L,
    "A human due-diligence report that shows numbers without justifying them is an opinion in a " +
    "suit. This chapter states, for each measurement, what it captures and why it belongs in a " +
    "decision of this magnitude. The references are to the primary research, not to secondary " +
    "summaries.");
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
        "Show whether the team covers the capabilities scaling demands; complementarity lowers single-point-of-failure risk.",
        "TaPas 4 Professional (internal model)"],
      ["Jaques stratum",
        "Detects the \u201cfounder ceiling\u201d: is cognitive work-complexity sufficient for the ambition? Correlates r=+0.87 with hierarchical level.",
        "Jaques; Global RO"],
      ["Big Five (targeted)",
        "Conscientiousness is the strongest universal performance predictor; low neuroticism signals persistence and stress tolerance.",
        "Barrick &amp; Mount 1991"],
      ["Energy / burnout (2MINSCAN)",
        "Burnout costs $5M+ per 1,000 staff annually and spreads; a snapshot misleads - dispersion is what matters.",
        "Maslach/MBI; Bakker contagion"],
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
    "Each chapter follows the same logic: a core statement, the evidence behind it, a visual, and a " +
    "hard conclusion. The narrative deliberately weighs theoretical risk against empirical evidence " +
    "rather than asserting either alone.", ACCENT);
  L.newBodyPage();
}

function chHealth(L: Layout, fi: FlagshipInput) {
  const f = fi.facts;
  chapterHeading(L, "Chapter 3 \u00b7 Team Health Architecture",
    "The Six-Level Foundation",
    "Psychological safety beneath the five Lencioni dimensions - and what the base layer reveals.");
  para(L,
    "Team health is not a single score; it is a structure. Patrick Lencioni's five dimensions form " +
    "a dependency chain - trust enables healthy conflict, which enables commitment, accountability and " +
    "a focus on collective results. Beneath all five we add a sixth, evidence-based layer: " +
    "psychological safety, the condition Amy Edmondson identified and Google's Project Aristotle " +
    "confirmed as the single strongest predictor of team effectiveness.");
  drawPyramid(L, fi.visuals.pyramid);
  figureCaption(L,
    "Figure 3.1 - Six-level team-health model. Loop scores in the High band on every Lencioni " +
    "dimension; the psychological-safety foundation is assessed qualitatively.");
  L.advance(6);
  L.guardMm(72);
  subhead(L, "Reading the first level: what Trust tells us about this team");
  para(L,
    `The base layer carries more information about a team than any layer above it, so we read it ` +
    `deeply. Loop's Trust score of ${f.trust.toFixed(2)} is not merely \u201chigh\u201d - it is a window into individual ` +
    "psychological maturity. Trust at this level means team members can voice doubt or admit " +
    "incompetence without losing status; mistakes are reported rather than hidden, which accelerates " +
    "organisational learning. It signals emotional regulation (criticism received without " +
    "defensiveness), psychological safety as an internal state rather than a posture, and cognitive " +
    "capacity freed for problem-solving instead of political navigation.");
  para(L,
    "But a high base is not an unqualified good, and an honest HDD says so. High trust combined with " +
    "high speed has a shadow: under intensity, candour can drift toward bluntness, and shared " +
    "standards can make peer feedback reinforce overdrive (\u201cwe all work like this\u201d) rather than " +
    "challenge it. The foundation is genuinely strong - and precisely because it is strong, its " +
    "failure mode is subtle.");
  L.advance(2);
  dataTable(L, {
    headers: ["Dimension", "Score", "Band", "What it indicates"],
    rows: [
      ["Trust", f.trust.toFixed(2), "High", "Vulnerability-based trust; mistakes surfaced, not hidden"],
      ["Healthy Conflict", f.conflict.toFixed(2), "High", "Ideas debated; differences treated as information"],
      ["Commitment", f.commitment.toFixed(2), "High", "Decisions supported even when preferences differed"],
      ["Accountability", f.accountability.toFixed(2), "High", "Peers hold peers to standard; no \u201cnice-nice\u201d culture"],
      ["Results", f.results.toFixed(2), "High", "Collective orientation; energy to performance, not politics"],
    ],
    colFracs: [0.24, 0.10, 0.13, 0.53], bandCol: 2,
  });
  L.advance(6);
  callout(L, "Nuanced risk despite high scores",
    "Strong commitment can mask over-commitment: people cross personal boundaries to deliver, " +
    "consistent with Be Strong / Try Hard drivers, which delays the recognition of burnout. The team " +
    "currently operates as a high-trust, high-accountability unit - the watch-point is whether that " +
    "holds under sustained scaling pressure.", AMBER, "#fbf3ea");
  L.newBodyPage();
}

function chIndividual(L: Layout, fi: FlagshipInput) {
  chapterHeading(L, "Chapter 4 \u00b7 Individual Capability",
    "Seven Profiles, One Complementary System",
    "Talent sequence, accelerators, drivers, indicative stratum and energy per leader.");
  para(L,
    "Leadership capability here is distributed, not concentrated. The two founders bring " +
    "complementary sequences - Dimitri O leans strategic-operational-relational, Maarten Bodewes " +
    "operational-innovative-strategic - and the five management members extend that coverage rather " +
    "than duplicate it. The cards below summarise each profile; drivers are stated in their original " +
    "Process-Communication terms and are never translated.");
  memberCards(L, fi.cards);
  L.advance(3);
  callout(L, "Structural reading",
    "Operational, Strategy and Innovation talents are well covered; multiple members can assume " +
    "leadership. The lighter family is Interrelational depth - deep one-on-one coaching and broad " +
    "stakeholder relationship-building are naturally lower priorities. Addressed directly in the " +
    "potential and conditions chapters.", ACCENT);
  L.newBodyPage();
}

function chCompPotential(L: Layout, fi: FlagshipInput) {
  const { audience } = fi;
  chapterHeading(L, "Chapter 5 \u00b7 Competence vs. Potential",
    "Two Different Questions, Kept Separate",
    "What the team can do now, and how far it can scale toward the exit need.");
  para(L,
    "Weaker assessments collapse track record, current competence and future potential into a single " +
    "impressionistic judgement. Best-in-class diligence keeps two questions apart. First: what can " +
    "this capability deliver <i>today</i>? Second: can it grow into what the company needs at " +
    "<i>exit</i>, not merely at entry? A capability can be strong now and have a low ceiling; another " +
    "can be raw now but highly scalable. Conflating the two is how investors over-pay for plateaued " +
    "talent and under-invest in convertible talent.");
  drawCompPot(L, fi.visuals.comppot);
  figureCaption(L,
    "Figure 5.1 - Competence (horizontal: what the team can do today) plotted against " +
    "potential/scalability (vertical: capacity to grow into the exit need), by capability cluster.");
  L.advance(6);
  L.guardMm(50);
  subhead(L, audience === "investor"
    ? "What the quadrants tell the investor"
    : "What the quadrants tell the leadership team");
  bullets(L, [
    "<b>Strength (ready &amp; scalable):</b> the founder vision, the operating core and product " +
    "innovation are strong today and have real headroom - the engine of the thesis.",
    "<b>Raw (invest to convert):</b> people-systems capability is mid-competence but genuinely " +
    "scalable; targeted investment converts it into a durable strength rather than a constraint.",
    "<b>Build (develop or hire):</b> governance and exit-readiness is the one cluster low on both " +
    "axes today - it is built deliberately, through board composition and a senior hire, not assumed.",
    "<b>Plateau watch:</b> no cluster sits in the strong-now / low-ceiling corner today, but the " +
    "cognitive-capacity chapter flags where a ceiling could appear under the \u20ac500M+ ambition.",
  ]);
  L.advance(2);
  callout(L, "The distinction that protects the price",
    "Competence is what you are paying for now; potential is what determines whether the same team " +
    "still fits at exit. This report rates both, separately, so the investment case rests on the " +
    "right axis for each capability.", GOLD, "#faf5e8");
  L.newBodyPage();
}

function chPotential(L: Layout, fi: FlagshipInput) {
  chapterHeading(L, "Chapter 6 \u00b7 Team Potential - Three Dimensions",
    "The Collective Strength, on Three Axes",
    "Drivers, talent foci and accelerators as horizontal sliders: position and dispersion.");
  para(L,
    "Individual profiles answer \u201cwho is strong at what.\u201d The collective question is different: where " +
    "is this team, as a unit, exceptional - and where is it thin? The slider view places the team's " +
    "aggregate position on each axis, with a dispersion band showing how concentrated or spread the " +
    "strength is. A high position on a narrow band is a dependable team capability; a high position " +
    "on a wide band means the strength rests on one or two people.");
  drawSliders(L, fi.visuals.sliders);
  figureCaption(L,
    "Figure 6.1 - Collective potential across talent foci, accelerators and drivers. Marker = team " +
    "position; shaded band = dispersion across the seven members.");
  L.advance(4);
  L.guardMm(54);
  subhead(L, "Where this team is extraordinary - and where it is exposed");
  bullets(L, [
    "<b>Extraordinary:</b> Operational and Strategy coverage are near the ceiling with tight " +
    "dispersion - a genuine, redundant team capability. Analysis as an accelerator is uniformly high.",
    "<b>Solid:</b> Innovation and Impact are strong but carried by a subset; dependable, not redundant.",
    "<b>Exposed:</b> Interrelational focus sits lowest with the widest band - relational and people-" +
    "systems work depends on too few shoulders as the organisation scales beyond 300 FTE.",
    "<b>Driver concentration:</b> Be Strong and Try Hard are near-universal; Please Others is rare. " +
    "This is ideal for scale-up intensity but, as Chapter 8 shows, it concentrates a specific risk.",
  ]);
  L.newBodyPage();
}

function chDynamics(L: Layout, fi: FlagshipInput) {
  const { audience } = fi;
  chapterHeading(L, "Chapter 7 \u00b7 Team Dynamics &amp; Energy Under Pressure",
    "How the Team Behaves When It Matters",
    "A narrative read of the 2MINSCAN dynamics, plus the energy map and its caveats.");
  subhead(L, "The team dynamic, in narrative");
  para(L,
    "Here is a narrative picture of the team dynamic from the 2MINSCANs rather than a table. In its " +
    "current Phase 0 state the team is energised, collaborative and solution-oriented; discussions " +
    "are fast, intellectually sharp, biased toward action and results. This is a group that decides " +
    "quickly and executes hard.");
  para(L,
    "Under sustained high stress the same traits sharpen. Directness rises toward confrontation; " +
    "debate polarises around principle (\u201cmy logic is sound, yours is not\u201d); tolerance for emotional " +
    "or uncertain responses drops; and the collective instinct is to push harder and centralise " +
    "around the dominant voices rather than to step back. In extreme stress these strengths can " +
    "invert into shadow traits: directness into arrogance, speed into ruthlessness, high standards " +
    "into exhausting perfectionism, logic-focus into dismissal of relational concerns. None of this " +
    "is present today - it is the predictable failure mode of a high-drive team, and it is why energy " +
    "must be governed, not merely admired.");
  L.advance(2);
  L.guardMm(58);
  subhead(L, "Energy: a strong signal, read with caution");
  drawEnergy(L, fi.visuals.energy);
  figureCaption(L,
    `Figure 7.1 - Self-rated energy by member. All seven at Phase 0 (fully energised); team mean ` +
    `${fi.visuals.energy.mean.toFixed(1)}/10, dispersion ${fi.visuals.energy.dispersion.toFixed(1)}.`);
  L.advance(3);
  para(L,
    "Every member reads at Phase 0 with energy of 8-9/10 - a robust, tightly-clustered signal. Two " +
    "cautions keep this honest. First, a single point-in-time reading can be masked by the mean: one " +
    "member sliding toward exhaustion would barely move an 8.3 average, which is why dispersion and " +
    "trend tracking matter more than the headline. Second, the measurement timing matters - a reading " +
    "taken after a holiday period may understate peak-season (Q4) intensity in a seasonal business.");
  if (audience === "investor") {
    callout(L, "What protects this energy today",
      "Empirical safeguards already exist: 32 vacation days (vs. 20 legal minimum), a four-week " +
      "work-away policy, full flexibility, ESOP alignment, and a stated founder philosophy of " +
      "\u201chealth and well-being above business goals.\u201d These practices appear to give high-drive " +
      "individuals genuine recovery - the risk is erosion of these safeguards under scaling pressure.",
      GREEN, "#eef6f1");
  }
  L.newBodyPage();
}

function chAlerts(L: Layout, fi: FlagshipInput) {
  const f = fi.facts;
  chapterHeading(L, "Chapter 8 \u00b7 Driver-Conflict Alerts, Blind Spots &amp; Coachability",
    "What Could Go Wrong - and Whether It Can Be Coached",
    "The friction points, the things the team cannot see, and its receptiveness to correction.");
  subhead(L, "Driver-conflict alerts");
  para(L,
    "Drivers are energising in balance and destructive in collision. The map below flags the " +
    "structural friction points in this team's driver mix, with a severity level. The headline alert " +
    "is not a clash between two people - it is a collective pattern.");
  drawConflict(L, fi.visuals.conflict);
  figureCaption(L,
    "Figure 8.1 - Driver-conflict alerts. Severity reflects both intensity and prevalence across the team.");
  L.advance(6);
  L.guardMm(66);
  subhead(L, "Invisible blind spots");
  bullets(L, [
    "<b>Relational signals are underweighted.</b> Task orientation can cause early signs of " +
    "disengagement, hurt or fear to be missed - increasingly risky beyond the founding circle.",
    "<b>Overconfidence in logic and intuition.</b> Strong conviction can shortcut validation of " +
    "assumptions against frontline reality, regulation or contradictory market data.",
    "<b>Low appetite for constraint.</b> Energy drains from documentation and formal structure, so " +
    "governance and quality processes risk being deferred until external pressure forces a catch-up.",
    "<b>Under-investment in people systems.</b> The assumption that smart, high-energy people will " +
    "self-organise can miss the need for structured onboarding, feedback and career pathways at scale.",
  ]);
  L.advance(4);
  L.guardMm(48);
  subhead(L, "Coachability");
  para(L,
    `Is this team coachable? The evidence says yes - and well. High psychological safety, Trust at ` +
    `${f.trust.toFixed(2)} and healthy conflict at ${f.conflict.toFixed(2)} mean correction is received as information, not threat, and ` +
    "the group already debates ideas without it becoming personal. The condition attached: a coach " +
    "must respect the team's pace and logic. This is a group with low tolerance for slowness and for " +
    "purely relational framing; coaching lands when it is evidence-based, fast and concrete, and " +
    "stalls when it is abstract or moralising. Coachability is therefore high, with a clear style " +
    "requirement rather than a capability ceiling.");
  L.newBodyPage();
}

function chCognitive(L: Layout, fi: FlagshipInput) {
  chapterHeading(L, "Chapter 9 \u00b7 Cognitive Capacity Map",
    "Is the Mind of the Team Big Enough for the Ambition?",
    "Jaques stratum: required work-complexity versus the team's indicative strata.");
  para(L,
    "Elliott Jaques' Stratified Systems Theory measures the complexity of work a person can handle by " +
    "the longest time-span of discretion they can manage. It is the cleanest instrument for the " +
    "\u201cfounder ceiling\u201d question: does the team have the cognitive horsepower the ambition requires? " +
    "The map below is strictly indicative - derived from the talent profile, never a ranking of " +
    "people, in line with the ethics charter in the appendix.");
  drawStratum(L, fi.visuals.stratum);
  figureCaption(L,
    "Figure 9.1 - Indicative cognitive-capacity map. The growth ambition implies Stratum V " +
    "work-complexity; the team's highest indicative stratum today is IV.");
  L.advance(6);
  callout(L, "What the stretch verdict means in practice",
    "The team operates indicatively at Stratum III-IV (multi-year, multi-function strategic " +
    "oversight) - appropriate for a \u20ac190M business and capable of independent P&amp;L ownership. The " +
    "\u20ac500M+ ambition implies sustained Stratum V work. This gap is a stretch, not a wall: it is " +
    "closeable through board composition and one or two complementary senior hires, which is exactly " +
    "where an active investor adds value.", AMBER, "#fbf3ea");
  L.newBodyPage();
}

function chCulture(L: Layout, _fi: FlagshipInput) {
  chapterHeading(L, "Chapter 10 \u00b7 Culture Reader",
    "Culture as Practices, Not Posters",
    "How decisions are made, conflict managed and performance held - and how that fits the plan.");
  para(L,
    "Culture compatibility is too important to dismiss in a sentence about \u201caligned values.\u201d We read " +
    "culture the way a best-in-class diligence does: through observable management practices - how " +
    "this team actually decides, disagrees, holds performance and absorbs change - and we assess each " +
    "practice for fit with a growth-equity operating model.");
  L.advance(2);
  dataTable(L, {
    headers: ["Management practice", "How this team operates", "Fit with the plan"],
    rows: [
      ["Decision-making style",
        "Fast, evidence-led, biased to action; founders hold strategic calls, management owns operations.",
        "Strong"],
      ["Conflict &amp; debate",
        "Open, idea-focused, depersonalised; differences treated as information, not threat.",
        "Strong"],
      ["Accountability &amp; performance",
        "Peer-to-peer standard-setting; high expectations; no \u201cnice-nice\u201d avoidance.",
        "Strong"],
      ["Pace &amp; change tolerance",
        "Very high; thrives on intensity and rapid iteration - the source of both speed and overdrive risk.",
        "Watch"],
      ["Formalisation &amp; process",
        "Low appetite for documentation and structure; governance can lag behind growth.",
        "Watch"],
      ["People &amp; well-being",
        "Genuine, founder-led safeguards (generous leave, flexibility, ESOP); not yet fully systematised.",
        "Adequate"],
    ],
    colFracs: [0.24, 0.55, 0.21], bandCol: 2,
  });
  L.advance(6);
  callout(L, "Compatibility verdict",
    "The decision, conflict and accountability practices are an excellent fit for an active " +
    "growth-equity partner - this is a team that can move fast and be held to outcomes. The two " +
    "watch-points (low formalisation, very high pace) are precisely the practices a governance-" +
    "oriented investor is positioned to mature without dampening the speed that makes the team " +
    "valuable.", ACCENT);
  L.newBodyPage();
}

function chKeyPerson(L: Layout, fi: FlagshipInput) {
  const { audience } = fi;
  chapterHeading(L, "Chapter 11 \u00b7 Key-Person Risk",
    "Where the Concentration Is, and What to Do About It",
    "Named concentrations, the impact if each departs, succession depth, and concrete mitigation.");
  if (audience === "investor") {
    para(L,
      "\u201cThe founders are important\u201d is not diligence. This chapter does what an investable " +
      "key-person analysis must: it names the specific concentrations, states what would happen to " +
      "the deal thesis if each were lost, assesses whether succession depth exists, and recommends " +
      "concrete mitigation. The point is not to discover that key people matter - it is to price " +
      "and govern that exposure deliberately.");
  } else {
    para(L,
      "Every strong team carries concentration risk - capability that sits with one or two people. " +
      "Naming it is not a criticism; it is how a team protects itself as it grows. This chapter " +
      "names the concentrations honestly and pairs each with a practical way to build depth behind " +
      "it.");
  }
  drawKeyPerson(L, fi.visuals.keyperson);
  figureCaption(L,
    "Figure 11.1 - Key-person risk map. For each concentration: severity, impact if lost, succession " +
    "depth, and recommended mitigation.");
  L.advance(6);
  L.guardMm(36);
  if (audience === "investor") {
    callout(L, "Investor takeaway",
      "None of these exposures is a deal-breaker, but two require contractual and structural " +
      "attention before and after close: founder retention/equity lock-ups with phased delegation " +
      "of external relationships, and a second owner for people-systems. Correlated-exit risk from " +
      "the homogeneous drive-culture is managed through the same energy KPI and complementary " +
      "hiring the governance charter already prescribes.", GOLD, "#faf5e8");
  } else {
    callout(L, "Team takeaway",
      "The most useful step you can take as a team is to build a visible second owner behind each " +
      "concentration - not because anyone is leaving, but because depth is what lets a strong team " +
      "scale without fragility.", ACCENT);
  }
  L.newBodyPage();
}

function chThesis(L: Layout, _fi: FlagshipInput) {
  chapterHeading(L, "Chapter 12 \u00b7 Investment Thesis - The Hard Questions",
    "Straight Answers to the Questions That Decide the Deal",
    "Each answer is a verdict against scientific criteria, not a hedge.");
  hardQa(L,
    "Is this team investable - a clear yes or a clear no?",
    "Verdict: A clear yes, on human-capital grounds.",
    "Crisis-tested, top-decile team health, complementary talent and full energy combine into one of " +
    "the strongest human-capital profiles an HDD of this kind will encounter. The residual " +
    "uncertainty lives in valuation and terms - a separate diligence stream - not in the team.");
  hardQa(L,
    "What is the single biggest risk?",
    "Verdict: Collective overdrive.",
    "Not capability - sustainability. A homogeneous, high-drive team can, under scaling pressure, " +
    "normalise overdrive and erode its own cultural safeguards, because peer accountability reinforces " +
    "rather than challenges the pace. The question is not \u201ccan they do it\u201d but \u201ccan they keep doing it\u201d - " +
    "and that is governable.");
  hardQa(L,
    "How active must the investor be?",
    "Verdict: Active, but selective.",
    "Not operational involvement - the team runs operations better than any board could. Active in " +
    "governance: installing decision-rights clarity, quarterly energy tracking, and the complementary " +
    "hires that balance the execution bias. Passive board observation would leave value on the table " +
    "and risk on the books.");
  hardQa(L,
    "What role should the investor take?",
    "Verdict: Governance partner and succession/hiring architect.",
    "Concretely: a board partner who institutionalises structure and energy monitoring, and who " +
    "sponsors the senior hires (process architecture, deeper people systems, stakeholder/governance " +
    "expertise) the scorecard shows are thin - not a passive observer, not an operator.");
  hardQa(L,
    "Is the team strong enough on its own?",
    "Verdict: Yes for execution; the governance infrastructure must grow with it.",
    "Execution capability is proven and largely self-sufficient. What does not yet scale by itself is " +
    "the governance and people-systems infrastructure. That gap is precisely the investor's " +
    "value-creation lane - it makes the partnership additive rather than merely financial.");
  L.newBodyPage();
}

function chConditions(L: Layout, fi: FlagshipInput) {
  const { audience, facts } = fi;
  chapterHeading(L, "Chapter 13 \u00b7 Conditions, Verification &amp; Governance Charter",
    "From Decision to Durable Partnership",
    "Pre-closing conditions, data to verify, and the governance interventions - as principles.");
  if (audience === "investor") {
    subhead(L, "Conditions before final commitment");
    bullets(L, [
      "<b>Verify the management structure.</b> Confirm C-suite/VP authority and P&amp;L " +
      "responsibility for the four members beyond the VP of People.",
      "<b>Validate the energy signal.</b> Obtain 2021-2025 voluntary-turnover data, engagement " +
      "results and historical energy measurements to confirm Phase 0 is structural.",
      "<b>Clarify valuation and terms.</b> Pre-money valuation, ownership and board representation, " +
      "use of proceeds and exit horizon - handled in the financial diligence stream, referenced " +
      "here only as an open question.",
    ]);
    L.guardMm(60);
  }
  subhead(L, "Governance charter - three catalysts");
  bullets(L, [
    "<b>1 \u00b7 Formalised governance structure.</b> Document decision rights (founder strategic " +
    "authority vs. management operational authority); board charter with quarterly delegation " +
    "reviews; explicit geographic decision boundaries across the multi-hub structure.",
    "<b>2 \u00b7 Energy management &amp; burnout prevention.</b> Quarterly energy measurement as a board " +
    "KPI (trend, not snapshot); board-level metrics for turnover, engagement and vacation " +
    "utilisation; structured reflection on when high-drive patterns help versus hinder.",
    `<b>3 \u00b7 Strategic complementary hiring.</b> Add process-architecture capability to balance the ` +
    `execution bias; deepen people-systems infrastructure for ${facts.fteFrom}->${facts.fteTo}+ FTE scaling; add ` +
    "stakeholder/governance expertise ahead of late-stage scaling or exit.",
  ]);
  L.advance(2);
  callout(L, "Framing",
    "These interventions are value-creation opportunities, not remediation of weaknesses. Every " +
    "\u20ac200M+ scale-up must build this governance maturity; an active investor simply accelerates the " +
    "path. The investor designation here is a variable - the principles apply to any growth-equity " +
    "partner.", ACCENT);

  // Appendix
  L.advance(10);
  L.guardMm(120); // keep appendix together as much as possible
  subhead(L, "Appendix \u00b7 Methodology, Privacy &amp; Ethics");
  para(L,
    "This assessment combines TaPas 4 Professional profiles, 2MINSCAN energy scans and the Lencioni " +
    "team-health instrument for all seven leaders, synthesised into a team-level analysis. Minimum " +
    "respondents for a team reading: four. The composite index weights team health, energy, talent " +
    "and cognitive capacity; bands (not raw ranks) are reported to preserve diagnostic meaning.");
  bullets(L, [
    "<b>Non-ranking.</b> Output is indicative and developmental; it is never a forced ranking of " +
    "individuals (GDPR Art. 22; requisite-organisation ethics).",
    "<b>Data separation.</b> Investor-only content (verification, valuation, thesis) is excluded from " +
    "the team-facing report.",
    "<b>Right of access.</b> Individuals retain the right to see and discuss their own profile data.",
    "<b>Language.</b> Whatever the language of the source questionnaires, the report is always " +
    "produced in English so its international character is immediate.",
  ]);
  L.advance(5);
  callout(L, "Sources",
    "Edmondson (ASQ 1999); Google re:Work / Project Aristotle; Lencioni, The Five Dysfunctions of a " +
    "Team; McKinsey/Egon Zehnder, Return on Leadership; Kahler Process Communication Model; Jaques, " +
    "Requisite Organization; Barrick &amp; Mount (1991); Maslach Burnout Inventory; Bakker on emotional " +
    "contagion; Bobko et al. (2007). Full URLs are held in the engagement's benchmark file.", ACCENT);
}

// ===================================================================
// Assembly — build one variant's body (chapters) into the layout
// ===================================================================
export function buildReportBody(L: Layout, fi: FlagshipInput) {
  chExecutive(L, fi);
  chScorecard(L, fi);
  chWhy(L, fi);
  chHealth(L, fi);
  chIndividual(L, fi);
  chCompPotential(L, fi);
  chPotential(L, fi);
  chDynamics(L, fi);
  chAlerts(L, fi);
  chCognitive(L, fi);
  chCulture(L, fi);
  chKeyPerson(L, fi);
  if (fi.audience === "investor") chThesis(L, fi);
  chConditions(L, fi);
}
