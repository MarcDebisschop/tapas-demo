// =============================================================================
// server/hdd/pdf/teamanalyse-2ms.ts - dossierbijlage: 2MINSCAN-teamanalyse
// -----------------------------------------------------------------------------
// WAAROM DIT BESTAAT
//   Elk boardlid vult in het HDD-traject een 2MINSCAN in. Uit die individuele
//   afnames komt nu een teamanalyse (server/twominscan/teamanalyse.ts). Dit
//   bestand zet dat resultaat om in een eigen PDF-bijlage bij het dossier.
//
// OPMAAK
//   Geen eigen opmaaktaal: theme.ts, layout.ts en primitives.ts van het
//   HDD-dossier worden hergebruikt, langs dezelfde weg als
//   server/hdd/pdf/index.ts (pdfkit, pure Node, geen Python).
//
// BLADSTRUCTUUR
//   De vaste bladorde van het goedgekeurde energetisch teamprofiel
//   (client/src/temperamentenwiel/bladen.ts): cover, leeswijzer, teamwiel,
//   deelnemers, individuele energie, dynamiek, kleuren, overleg, slot. Als
//   dossierbijlage vallen de losse bladen "individuele energie" samen met het
//   deelnemersblad, zodat elk blad gevuld is in plaats van halfleeg.
//
// INHOUD
//   De teksten komen uit het goedgekeurde teamprofiel
//   (client/src/pages/twominscan-teamwiel.tsx en
//   client/src/temperamentenwiel/teamtekst.ts), hier in het Engels omdat het
//   HDD-dossier altijd Engelstalig is. De cijfers komen uitsluitend uit het
//   analyseresultaat: dit bestand rekent zelf niets uit en vult niets aan.
//
// HARDE CLAIMGRENS
//   Nergens een energiecijfer, score, index, talentclaim, potentieelclaim,
//   selectieclaim of diagnose. De cover van het vlaggenschipdossier
//   (drawDarkCover) wordt daarom NIET gebruikt: die toont een index op 100 en
//   een aanbeveling, en dat mag deze bijlage niet suggereren.
// =============================================================================
import PDFDocument from "pdfkit";
import {
  PAGE_W, PAGE_H, MARGIN, MM, INK, SUB, GOLD, ACCENT, LINE, F, registerFonts,
} from "./theme";
import { Layout, ChromeMeta } from "./layout";
import {
  para, lead, subhead, bullets, chapterHeading, callout, dataTable,
  memberCards, drawSectionDivider, CardSpec,
} from "./primitives";
import {
  TEAMANALYSE_KLEURORDE, TEAMANALYSE_MIN_DEELNEMERS,
  kleurKernEngels, kleurNaamEngels, teamanalyseCijfers,
  type TeamanalyseResultaat,
} from "../../twominscan/teamanalyse";

export interface TeamanalysePdfInput {
  company: string; boardLabel: string; date: string; confidentiality: string;
  analyse: TeamanalyseResultaat;
}

const VARIANT = "2MINSCAN Team Analysis";
const SUBJECT = "Energetic team analysis";

// ---------------------------------------------------------------------------
// Vaste teksten, vertaald uit het goedgekeurde teamprofiel.
// ---------------------------------------------------------------------------

// client/src/temperamentenwiel/teamtekst.ts, TEAMENERGIE: wat elke energie
// nodig heeft om te blijven stromen, waar ze op leegloopt, welke afspraak helpt
// en welk signaal je ziet wanneer ze zakt.
const KLEURBLOK: Record<string, { geeft: string; lekt: string; afspraak: string; signaal: string }> = {
  rood: {
    geeft: "a clear assignment, a mandate to decide and visible progress",
    lekt: "files that are opened again and again without a decision",
    afspraak: "Close every meeting with who does what by when, even if the discussion was not finished.",
    signaal: "becoming short and sharp, talking over others, starting to do it alone",
  },
  geel: {
    geeft: "exploring possibilities together, thinking out loud and hearing that it makes a difference",
    lekt: "working through a list alone, without conversation or feedback",
    afspraak: "Put an open thinking block at the front of the meeting, clearly separated from the decision moment.",
    signaal: "talking a lot without landing, dropping out of administration, promises that grow too wide",
  },
  groen: {
    geeft: "predictability, time to move along with a change and agreements that hold",
    lekt: "abrupt turns and unspoken tension in the group",
    afspraak: "Announce changes with the reason attached and with time to come back to them.",
    signaal: "becoming quieter, agreeing without conviction, voicing concerns only afterwards",
  },
  blauw: {
    geeft: "clear frameworks, facts on the table and room to do something thoroughly",
    lekt: "improvising under time pressure and deciding on a feeling without grounding",
    afspraak: "Send documents in advance instead of tabling them, so nothing has to be estimated on the spot.",
    signaal: "withdrawing into the file, asking for postponement, responding in writing only",
  },
};

// client/src/temperamentenwiel/teamtekst.ts, FLOW / INSPANNING / KOST: de
// individuele lezing per kleur, hier per deelnemer gebruikt op het
// deelnemersblad (in de dossierbijlage vallen de losse individuele bladen samen
// met het deelnemersblad).
const FLOW_EN: Record<string, string> = {
  rood: "there is direction, decisions are taken and effort leads to a visible result",
  geel: "there is contact with people, possibilities are explored together and perspective opens up",
  groen: "there is calm and reliability, agreements hold and people know they are supported",
  blauw: "there is time to work out how something fits together and room to make it genuinely correct",
};
const INSPANNING_EN: Record<string, string> = {
  rood: "taking a firm position quickly",
  geel: "being visible and present in the group continuously",
  groen: "dwelling at length on everyone's pace and comfort",
  blauw: "digging out and substantiating in detail",
};
const KOST_EN: Record<string, string> = {
  rood: "pressure, competition and deciding without the meaning being clear",
  geel: "noise, loose ideas without closure and having to be socially present all the time",
  groen: "slow decisions, having to muster patience and tension that keeps simmering",
  blauw: "detail work and pressure to prove, detached from clear direction or human use",
};

// client/src/pages/twominscan-teamwiel.tsx, Leeswijzerpagina.
const LEES_HOE = [
  "Every position on the wheel has its own colour order. From the outside inwards: first, second and third colour energy, and in the heart the colour that costs energy.",
  "Participants sit on the position that came out of their own 2MINSCAN, so their place is measured and not chosen.",
  "Standing close together means understanding each other quickly. Standing far apart means adding to each other and costing each other energy sooner.",
  "The wheel position number and the position code identify the position; they are labels, not values.",
];
const LEES_NIET = [
  "It measures no talent, no potential and no competence.",
  "It says nothing about fitness for a role and nothing about selection.",
  "It is not a diagnosis and not a description of who someone is.",
  "It does not explain why someone shows this preferred behaviour.",
];
const SLOT_WEL = [
  "conversation about collaboration and energy",
  "designing meetings and working agreements",
  "understanding where tension comes from",
  "handling your own energy consciously",
];
const SLOT_NIET = [
  "selection, promotion or appraisal",
  "statements about talent or potential",
  "diagnosis or a judgement of personality",
  "fixing permanent labels on people",
];

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export async function renderTeamanalysePdf(input: TeamanalysePdfInput): Promise<Buffer> {
  const analyse = input.analyse;
  const cijfers = teamanalyseCijfers(analyse);
  const company = (input.company ?? "").trim();
  const boardLabel = (input.boardLabel ?? "").trim();
  const date = (input.date ?? "").trim();
  const confidentiality = (input.confidentiality ?? "").trim() || "CONFIDENTIAL";

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        autoFirstPage: false,
        margin: 0,
        bufferPages: true,
      });

      doc.info.Author = "Perplexity Computer";
      doc.info.Title = `2MINSCAN Team Analysis - ${company || "team"}`;
      doc.info.Subject = SUBJECT;

      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ---- blad 1: cover -------------------------------------------------
      doc.addPage();
      tekenCover(doc, company, boardLabel, date, confidentiality, analyse);

      // ---- body ----------------------------------------------------------
      const chrome: ChromeMeta = {
        subject: company ? `${SUBJECT} \u00b7 ${company}` : SUBJECT,
        confidentiality,
        variant: VARIANT,
      };
      const L = new Layout(doc, chrome);
      L.newBodyPage();

      bladLeeswijzer(L);
      L.newBodyPage();
      bladTeamwiel(L, analyse, cijfers);
      L.newBodyPage();
      bladDeelnemers(L, analyse, cijfers);
      L.newBodyPage();
      bladDynamiek(L, analyse, cijfers);
      L.newBodyPage();
      bladKleuren(L, analyse, cijfers);
      L.newBodyPage();
      bladOverleg(L, analyse);
      L.newBodyPage();
      bladSlot(L, analyse);

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}

// ---------------------------------------------------------------------------
// Cover: de lichte sectiescheiding van het dossier, met het gegevensblok van
// het teamprofiel eronder. Geen index, geen aanbeveling, geen cijfer.
// ---------------------------------------------------------------------------
function tekenCover(
  doc: PDFKit.PDFDocument,
  company: string,
  boardLabel: string,
  date: string,
  confidentiality: string,
  analyse: TeamanalyseResultaat,
) {
  drawSectionDivider(
    doc,
    "2MINSCAN \u00b7 dossier appendix",
    "Energetic Team Analysis",
    "How the energy of this team moves together",
  );

  const rijen: [string, string][] = [];
  if (company) rijen.push(["ORGANISATION", company]);
  if (boardLabel) rijen.push(["BOARD", boardLabel]);
  if (date) rijen.push(["DATE", date]);
  rijen.push(["PARTICIPANTS", String(analyse.n)]);
  rijen.push(["BASIS", "individual 2MINSCAN profiles"]);

  let y = PAGE_H / 2 + 34 * MM;
  doc.lineWidth(0.8).strokeColor(LINE);
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 9 * MM;
  for (const [label, waarde] of rijen) {
    doc.font(F.interSemi).fontSize(8).fillColor(SUB);
    doc.text(label, MARGIN, y, { lineBreak: false });
    doc.font(F.interMed).fontSize(11).fillColor(INK);
    doc.text(waarde, MARGIN + 46 * MM, y - 1.5, { width: PAGE_W - MARGIN - (MARGIN + 46 * MM), lineBreak: false });
    y += 7.4 * MM;
  }
  doc.lineWidth(0.8).strokeColor(LINE);
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 6 * MM;
  doc.font(F.interSemi).fontSize(9).fillColor(ACCENT);
  doc.text(confidentiality.toUpperCase(), MARGIN, y, { lineBreak: false });
  y += 6 * MM;
  doc.font(F.inter).fontSize(7.8).fillColor(SUB);
  doc.text(
    "No energy figure, no score and no judgement. Always produced in English.",
    MARGIN, y, { width: PAGE_W - 2 * MARGIN, lineBreak: false },
  );
  doc.font(F.interSemi).fontSize(9).fillColor(INK);
  doc.text("TaPas Platform", MARGIN, PAGE_H - 22 * MM, { lineBreak: false });
  doc.font(F.inter).fontSize(7.8).fillColor(SUB);
  doc.text("2MINSCAN is a product of TaPasCity \u00b7 www.tapascity.com", MARGIN, PAGE_H - 17 * MM, { lineBreak: false });
}

// ---------------------------------------------------------------------------
// Blad: leeswijzer met de claimgrens.
// ---------------------------------------------------------------------------
function bladLeeswijzer(L: Layout) {
  chapterHeading(
    L,
    "Section 1 \u00b7 How to read this appendix",
    "What this team analysis does and does not do",
    "The reading frame, before any observation is used in a board conversation.",
  );
  lead(L,
    "Every participant completed the 2MINSCAN. That scan describes no talent, no potential and no " +
    "fitness for a role. It describes how someone gives energy in collaboration, which context " +
    "produces energy, and where energy predictably drains away.");
  para(L,
    "By placing all participants on one wheel, something becomes visible that usually stays unnamed in " +
    "a team: which energy starts by itself here, which energy someone has to bring up deliberately " +
    "every time, and between whom the largest distance sits. That says something about the dynamics of " +
    "this group, not about the worth of the people in it.");
  callout(L, "The claim limit of this appendix",
    "The 2MINSCAN deliberately produces no energy figure on a 0-10 scale. It produces an energetic " +
    "behavioural profile only: a colour order, an EG code and a place on the wheel. Nothing in this " +
    "document is a score, a ranking, a talent or potential claim, a selection recommendation or a " +
    "diagnosis. Where something could not be measured, this appendix says so instead of filling the gap.",
    ACCENT);
  subhead(L, "How to read the wheel");
  bullets(L, LEES_HOE);
  subhead(L, "What this wheel does not do");
  bullets(L, LEES_NIET);
  subhead(L, "Why energy and team dynamics belong together");
  para(L,
    "Team dynamics are largely a question of energy. Where the energy of people coincides, work goes " +
    "fast and feels light. Where energy has to move against the current, delay, irritation or silence " +
    "appears, often without anyone mentioning energy. This appendix makes that movement discussable and " +
    "offers concrete agreements, so that the differences in this group do not wear people out but pay off.");
}

// ---------------------------------------------------------------------------
// Blad: teamwiel en kleurverdeling.
// ---------------------------------------------------------------------------
function bladTeamwiel(
  L: Layout,
  analyse: TeamanalyseResultaat,
  cijfers: ReturnType<typeof teamanalyseCijfers>,
) {
  chapterHeading(
    L,
    "Section 2 \u00b7 The team on the wheel",
    "Where the energy of this group comes from",
    "Colour distribution across the measured 2MINSCAN profiles.",
  );
  lead(L,
    "Every position on the wheel carries its own colour order: the outer band is the first energy, " +
    "inside it the second and the third, and the core shows the colour that costs energy. The counts " +
    "below are simple tallies of those measured colour orders.");

  if (cijfers.gemeten === 0) {
    callout(L, "Nothing measured yet",
      "No participant in this appendix carries a calibrated 2MINSCAN profile, so there is no colour " +
      "distribution to report. This page stays empty of counts on purpose: an empty team is not the " +
      "same as a team without colour. As soon as the individual 2MINSCAN profiles are attached, the " +
      "table below fills with measured tallies.",
      GOLD, "#f7f3e8");
    subhead(L, "What is counted here once profiles are present");
    bullets(L, [
      "First colour: the energy someone starts from. Counted per participant, so the counts add up to the number of measured profiles.",
      "Second colour: the energy someone can add without much effort.",
      "Costs energy: the colour in the core of the profile, the energy that drains fastest.",
      "Absent as a first colour: work that asks for this energy costs the group energy instead of giving it.",
    ]);
    subhead(L, "Why no colour is shown as a value");
    para(L,
      "The four colour energies are equal in this instrument. There is no better or worse colour, no " +
      "ranking between them, and no total. A colour that is absent is not a deficit: it only means " +
      "that this kind of work has to be planned, divided and bounded deliberately.");
    subhead(L, "How this page reads once the profiles are attached");
    bullets(L, [
      "Per colour the table shows how often it holds the first, the second and the last place in a measured colour order.",
      "Below the table the observations state which energy starts by itself in this group and which energy is absent as a first colour.",
      "Nothing is added across colours and no colour is weighted, so the page stays a distribution and never becomes a total.",
    ]);
    return;
  }

  const rows = TEAMANALYSE_KLEURORDE.map((k) => [
    kleurNaamEngels(k),
    `${analyse.kleurverdeling[k] ?? 0} of ${cijfers.gemeten}`,
    `${cijfers.tweedeVerdeling[k] ?? 0} of ${cijfers.gemeten}`,
    `${cijfers.kostVerdeling[k] ?? 0} of ${cijfers.gemeten}`,
    kleurKernEngels(k),
  ]);
  dataTable(L, {
    headers: ["Colour energy", "First colour", "Second colour", "Costs energy", "This energy is about"],
    rows,
    colFracs: [0.15, 0.15, 0.16, 0.15, 0.39],
  });
  L.advance(6);
  para(L,
    "Read the table per column, not across the row: each column counts the measured profiles in which " +
    "that colour holds that place in the colour order. There is no total and no average, because the " +
    "colours are equal and no colour is worth more than another.");

  subhead(L, "Measured observations");
  bullets(L, analyse.observaties.slice(0, 5));

  if (analyse.ontbrekendeKleuren.length > 0) {
    callout(L, `Not present as a first colour: ${analyse.ontbrekendeKleuren.map(kleurNaamEngels).join(", ")}`,
      `Work that asks for ${analyse.ontbrekendeKleuren.map(kleurKernEngels).join(" or ")} costs this ` +
      "group energy instead of giving it. That is not a shortcoming. It means the work has to be " +
      "planned, divided and bounded deliberately, and that it should not quietly land on the same " +
      "person every time.",
      GOLD, "#f7f3e8");
  } else {
    callout(L, "All four colour energies present as a first colour",
      "Every kind of energy starts somewhere in this group. That widens the range of angles available, " +
      "and it makes explicit coordination more necessary: alignment takes time when people start from " +
      "different energy.",
      ACCENT);
  }
}

// ---------------------------------------------------------------------------
// Blad: de deelnemers, met hun individuele energie.
// ---------------------------------------------------------------------------
function bladDeelnemers(
  L: Layout,
  analyse: TeamanalyseResultaat,
  cijfers: ReturnType<typeof teamanalyseCijfers>,
) {
  chapterHeading(
    L,
    "Section 3 \u00b7 The participants",
    "Who sits where on the wheel",
    "One card per participant: role, EG code, colour order and place on the wheel.",
  );
  lead(L,
    "The colour order runs from the first energy to the colour that costs energy. The place on the " +
    "wheel is given as two wheel coordinates between -1 and +1, with the centre of the wheel as zero: " +
    "a location, not a score, and neither end is better than the other.");

  if (analyse.deelnemers.length === 0) {
    callout(L, "No participants recorded",
      "This appendix was built without a single participant, so no names, no colour orders and no " +
      "wheel positions are shown. Nothing has been filled in to make the page look complete.",
      GOLD, "#f7f3e8");
    subhead(L, "What a participant card contains");
    bullets(L, [
      "Name and role, exactly as recorded with the individual 2MINSCAN.",
      "The EG code of the calibrated profile that came out of that scan.",
      "The colour order of the wheel position: first, second, third energy, and the colour that costs energy.",
      "The place on the wheel as two coordinates, so the spread of the group can be read.",
      "Where a code or a position is unknown, the card says so and stays empty rather than guessing.",
    ]);
    subhead(L, "Why the cards are not summarised into one figure");
    para(L,
      "A team is not the average of its participants. The 2MINSCAN produces an energetic behavioural " +
      "profile per person, and those profiles are compared side by side, never added up into a single " +
      "team number. That is why this appendix shows counts and distances, and no index.");
    subhead(L, "What stays out of a participant card, whatever the data");
    bullets(L, [
      "No energy figure and no percentage: the 2MINSCAN produces a colour order, not a value on a scale.",
      "No statement about talent, potential, competence or fitness for the role someone holds.",
      "No comparison that puts one participant above another; the cards stand side by side, not in a ranking.",
    ]);
    return;
  }

  const kaarten: CardSpec[] = analyse.deelnemers.map((d) => {
    const lijnen: string[] = [];
    lijnen.push(`EG code: ${d.egCode || "not recorded"}`);
    lijnen.push(
      d.kleurvolgorde.length > 0
        ? `Colour order: ${d.kleurvolgorde.map(kleurNaamEngels).join(" > ")}`
        : "Colour order: not derived, no calibrated profile matched",
    );
    lijnen.push(
      d.kleurvolgorde.length > 0
        ? `Starts from: ${kleurKernEngels(d.kleurvolgorde[0])}`
        : "Starts from: not measured",
    );
    lijnen.push(
      d.kleurvolgorde.length === 4
        ? `Drains on: ${kleurKernEngels(d.kleurvolgorde[3])}`
        : "Drains on: not measured",
    );
    lijnen.push(
      d.xStand !== null && d.yStand !== null
        ? `Wheel place: x ${d.xStand}, y ${d.yStand}`
        : "Wheel place: not derived",
    );
    return { title: d.naam || "Participant without a recorded name", role: d.rol || "role not recorded", lines: lijnen };
  });
  memberCards(L, kaarten);
  L.advance(2);
  para(L,
    "The colour order follows the position on the mat: first, second and third energy, and then the " +
    "colour in the core that costs energy. A card that says a value was not derived is a card where " +
    "the source data did not carry that value; nothing has been estimated in its place.");

  subhead(L, "Individual energy, read from the colour order");
  const nietGemetenTekst = "not measured";
  dataTable(L, {
    headers: ["Participant", "Energy flows when", "Asks deliberate effort", "Energy drains on"],
    rows: analyse.deelnemers.map((d) => {
      const eerste = d.kleurvolgorde[0];
      const derde = d.kleurvolgorde[2];
      const kern = d.kleurvolgorde[3];
      return [
        d.naam || "participant without a recorded name",
        eerste ? FLOW_EN[eerste] ?? nietGemetenTekst : nietGemetenTekst,
        derde ? INSPANNING_EN[derde] ?? nietGemetenTekst : nietGemetenTekst,
        kern ? KOST_EN[kern] ?? nietGemetenTekst : nietGemetenTekst,
      ];
    }),
    colFracs: [0.18, 0.32, 0.22, 0.28],
  });
  L.advance(6);
  para(L,
    "This reading is the fixed content of the energetic team profile per colour, applied to the " +
    "measured colour order of each participant. It is a description of energy in collaboration, not " +
    "an assessment of the person and not a statement about what someone can or cannot do.");

  if (cijfers.gemeten < TEAMANALYSE_MIN_DEELNEMERS) {
    callout(L, "Below the threshold for a team reading",
      `Fewer than ${TEAMANALYSE_MIN_DEELNEMERS} measured profiles are present. The counts in this ` +
      "appendix are still measured facts, but they are too thin to be read as a picture of the team, " +
      "and they are not presented as one.",
      GOLD, "#f7f3e8");
  }
}

// ---------------------------------------------------------------------------
// Blad: samenspel en dynamiek.
// ---------------------------------------------------------------------------
function bladDynamiek(
  L: Layout,
  analyse: TeamanalyseResultaat,
  cijfers: ReturnType<typeof teamanalyseCijfers>,
) {
  chapterHeading(
    L,
    "Section 4 \u00b7 Interplay and dynamics",
    "How the energy of this team moves together",
    "Counts and distances, measured on the wheel positions of the participants.",
  );
  lead(L,
    "The figures below are geometry on the wheel and tallies of colour orders. They carry no scale, no " +
    "norm and no target value: a wide spread is not better than a narrow one, it asks for different " +
    "agreements.");

  const geenCijfer = "not measured";
  dataTable(L, {
    headers: ["What is counted", "Measured value", "How to read it"],
    rows: [
      ["Participants submitted", String(analyse.n), "Everyone who was included in this appendix."],
      ["Profiles with a colour order", String(cijfers.gemeten), "Only these count towards the colour distribution."],
      ["Profiles with a wheel position", String(cijfers.metWielpositie), "Only these count towards the distances on the wheel."],
      ["Colour energies present as first colour", `${analyse.dominanteKleuren.length > 0 ? TEAMANALYSE_KLEURORDE.filter((k) => (analyse.kleurverdeling[k] ?? 0) > 0).length : 0} of 4`, "How many of the four energies the group starts from."],
      ["Wheel sectors occupied", cijfers.sectorenBezet !== null ? `${cijfers.sectorenBezet} of 8` : geenCijfer, "More sectors means more angles and more coordination."],
      ["Average angular distance", cijfers.gemAfstand !== null ? `${cijfers.gemAfstand} degrees` : geenCijfer, "The typical distance between two participants on the wheel."],
      ["Largest angular distance", cijfers.maxAfstand !== null ? `${cijfers.maxAfstand} degrees` : geenCijfer, "The pair that adds most to each other and drains each other fastest."],
      ["Horizontal spread on the wheel", analyse.xSpreiding ? `${analyse.xSpreiding.min} to ${analyse.xSpreiding.max} (span ${analyse.xSpreiding.spreiding})` : geenCijfer, "A place on the wheel axis from -1 to +1, not a score."],
    ],
    colFracs: [0.34, 0.24, 0.42],
  });
  L.advance(6);

  // De eerste observaties staan al op het teamwielblad; hier alleen de
  // observaties over spreiding, sectoren en afstand, zodat dit blad past.
  const dynamiekObs = analyse.observaties.length > 5
    ? analyse.observaties.slice(5)
    : analyse.observaties;
  subhead(L, "What the observations say");
  bullets(L, dynamiekObs);

  callout(L, "How to use these figures",
    "Put them next to the working reality of the group and ask what people recognise. A distance on " +
    "the wheel explains why coordination costs effort; it does not decide who is right. Where a value " +
    "reads as not measured, the source data did not carry it, and no estimate has been substituted.",
    ACCENT);
}

// ---------------------------------------------------------------------------
// Blad: in energie blijven, kleur per kleur.
// ---------------------------------------------------------------------------
function bladKleuren(
  L: Layout,
  analyse: TeamanalyseResultaat,
  cijfers: ReturnType<typeof teamanalyseCijfers>,
) {
  chapterHeading(
    L,
    "Section 5 \u00b7 Staying in energy, colour by colour",
    "What each energy needs and what drains it",
    "Fixed reading per colour energy, with the measured count of this group beside it.",
  );
  para(L,
    "Each energy needs something to keep flowing, and something makes it run empty. Per colour this " +
    "page shows what gives energy, what drains it, which agreement helps and which signal appears when " +
    "the energy drops. The counts are measured; the four readings are the fixed content of the " +
    "energetic team profile and do not change with the group.");

  for (const kleur of TEAMANALYSE_KLEURORDE) {
    const blok = KLEURBLOK[kleur];
    if (!blok) continue;
    const aantal = analyse.kleurverdeling[kleur] ?? 0;
    const telling = cijfers.gemeten > 0
      ? `${aantal} of ${cijfers.gemeten} as first colour`
      : "count not measured";
    subhead(L, `${kleurNaamEngels(kleur)} \u00b7 ${kleurKernEngels(kleur)} \u00b7 ${telling}`);
    bullets(L, [
      `<b>Gives energy:</b> ${blok.geeft}.`,
      `<b>Drains on:</b> ${blok.lekt}.`,
      `<b>Agreement:</b> ${blok.afspraak}`,
      `<b>Signal when it drops:</b> ${blok.signaal}.`,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Blad: overlegadvies.
// ---------------------------------------------------------------------------
function bladOverleg(L: Layout, analyse: TeamanalyseResultaat) {
  chapterHeading(
    L,
    "Section 6 \u00b7 Consultation advice",
    "Working together without losing energy",
    "A meeting form and working agreements, derived from the measured colour distribution.",
  );
  lead(L,
    "The sequence below follows the fixed order of the energetic team profile: prepare, open, weigh, " +
    "decide, close. Only the steps that match an energy present in this group are listed, so the " +
    "advice stays tied to what was measured.");

  if (analyse.overlegadvies.length === 0) {
    callout(L, "No consultation advice derived",
      "Consultation advice follows from the measured colour distribution. Without a single calibrated " +
      "profile there is nothing to derive it from, so this page shows the general sequence below " +
      "instead of advice presented as a finding for this group.",
      GOLD, "#f7f3e8");
    subhead(L, "The fixed sequence of the energetic team profile");
    bullets(L, [
      "Before the meeting: circulate documents and figures, so nobody has to estimate on the spot.",
      "Opening: a short block in which possibilities may be explored out loud, before anything is chosen.",
      "Weighing: ask explicitly about the consequences for people and workability, and let silences fall.",
      "Deciding: a clear decision moment with a call, an owner and a date.",
      "Closing: two minutes on who picks up what, and what that costs someone in energy.",
    ]);
  } else {
    subhead(L, "A meeting form that fits this group");
    bullets(L, analyse.overlegadvies);
  }

  subhead(L, "Three moments to repeat this conversation");
  bullets(L, [
    "At the start of a project: name which energy is asked for most, and who sits in the flow for it.",
    "Halfway: ask explicitly where energy drains away. Not whether things are going well, but what costs the most right now.",
    "After a tension: put the tension next to the wheel. Usually it turns out to be a difference in pace, detail or contact, and not a matter of unwillingness.",
  ]);
  callout(L, "Boundary of this advice",
    "These are agreements about how the group works, not judgements about the people in it. No line " +
    "here says who should lead, who should be appointed, promoted or replaced. The 2MINSCAN cannot " +
    "carry that question, and this appendix does not answer it.",
    ACCENT);
}

// ---------------------------------------------------------------------------
// Blad: slot, met wat niet gemeten is.
// ---------------------------------------------------------------------------
function bladSlot(L: Layout, analyse: TeamanalyseResultaat) {
  chapterHeading(
    L,
    "Section 7 \u00b7 Responsible use",
    "What was not measured, and what this appendix is not for",
    "The honest closing page: the limits of the instrument and of this data set.",
  );

  subhead(L, "What was not measured");
  bullets(L, analyse.nietGemeten);

  subhead(L, "Do use this appendix for");
  bullets(L, SLOT_WEL);
  subhead(L, "Do not use this appendix for");
  bullets(L, SLOT_NIET);

  callout(L, "Honest about what this is and is not",
    "The 2MINSCAN starts from Jungian inspired preferences. That theory does not have the same " +
    "validation status as modern psychometric models. It does give a workable language for talking " +
    "about collaboration and energy management. This appendix says nothing about who someone is, about " +
    "talent or potential, and it is no basis for selection or appraisal. Where the question is why " +
    "someone shows this preferred behaviour, or about talent potential, a different instrument is the " +
    "careful next step.",
    ACCENT);
  L.advance(6);
  para(L,
    "Energy is not a fixed label. It is a movement between people and the context they work in. This " +
    `appendix reports what ${analyse.n} recorded 2MINSCAN ${analyse.n === 1 ? "profile shows" : "profiles show"} ` +
    "about that movement, and it stops where the measurement stops.");
  para(L,
    "2MINSCAN is a product of TaPasCity \u00b7 www.tapascity.com \u00b7 info@tapascity.com");
}
