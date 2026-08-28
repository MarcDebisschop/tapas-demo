// ===========================================================================
// publiek/inhoud-en.ts: de Engelse tegenhanger van de publieke inhoud.
//
// WAAROM DIT BESTAND BESTAAT
// De publieke laag is de voordeur van een internationaal aanbod, en die
// voordeur spreekt Engels. De inhoud zelf staat in data/oplossingen.ts, in het
// Nederlands, op één plaats. Wie daarnaast Engelse teksten in de pagina's zelf
// zou zetten, krijgt opnieuw vijf verhalen in plaats van één. Daarom staat de
// Engelse inhoud hier, in dezelfde vorm, met dezelfde types, dezelfde orde en
// dezelfde machinesleutels als het Nederlandse origineel. Een pagina kiest met
// publiek/taal.tsx welke van de twee lijsten ze toont, en niets meer.
//
// WAT DIT BESTAND NIET DOET
// Het raakt de instrumentenlogica, de afname, de scoring en de
// rapportgeneratie niet aan, en het wijzigt het Nederlandse origineel niet.
// Het is uitsluitend een tweede taalvariant van dezelfde zichtbare tekst.
// De sleutels, de paden, de nummers en de vlaggen blijven ongewijzigd, zodat
// beide talen op exact dezelfde manier doorzoekbaar en koppelbaar blijven.
// ===========================================================================

import type {
  Beslismoment,
  Cluster,
  DemoCase,
  DemoJourney,
  Deur,
  LicentieBeeld,
  Markering,
  NavItem,
  OutputLaag,
  Stap,
} from "@/data/oplossingen";

/**
 * De publieke hoofdnavigatie. De paden en de sectie-id's zijn machinewaarden
 * en blijven dus gelijk aan het Nederlandse bestand; enkel het opschrift
 * verandert van taal.
 */
export const HOOFDNAVIGATIE_EN: NavItem[] = [
  { label: "Platform", pad: "/", sectie: "werking" },
  { label: "Solutions", pad: "/oplossingen" },
  { label: "Outputs", pad: "/outputs" },
  { label: "For partners", pad: "/partners" },
  { label: "Sign in", pad: "/aanmelden", sectie: "aanmelden" },
];

/** De vijf journeyclusters, in dezelfde orde als het Nederlandse origineel. */
export const CLUSTERS_EN: Cluster[] = [
  {
    sleutel: "hdd",
    naam: "Human Due Diligence",
    ondertitel:
      "Insight into the human side of a file before the decision is taken.",
    beslissing:
      "Do we step in, do we take over, and with which leading team do we continue?",
    doelgroep:
      "Investors, boards, executive teams and their advisers in an acquisition, a funding round or a restructuring.",
    moment:
      "In the weeks before a decision, when the numbers are known and the question about the people stays open.",
    instrumenten: ["TaPas Teamscan", "2MINSCAN", "T4P Business Kompas"],
    pad: "/oplossingen/human-due-diligence",
    wedge: true,
    prijssignaal:
      "Programme from EUR 7,500. Standard programme from EUR 12,500. The price sits at programme level, not per participant.",
  },
  {
    sleutel: "leiderschap",
    naam: "Leadership & Team Energy",
    ondertitel:
      "Making leadership, trust and energy in a team visible and open to discussion.",
    beslissing:
      "Where do we place our leadership attention, and how do we compose this team?",
    doelgroep:
      "Executive teams, HR leads and team leaders in organisations from twenty employees upwards.",
    moment:
      "With a new team, a new manager, a merger of departments or a team that stalls without a clear cause.",
    instrumenten: ["TaPas Teamscan", "T4P Business Kompas", "2MINSCAN", "T4O"],
    pad: "/oplossingen/leadership-team-energy",
    wedge: true,
    prijssignaal:
      "Assessment from EUR 295 per participant, with volume tiers from twenty-five participants. Annual licence for organisations from EUR 6,000.",
  },
  {
    sleutel: "ontwikkeling",
    naam: "Development & Mobility",
    ondertitel:
      "Underpinning development and internal mobility with talent, drivers and energy.",
    beslissing:
      "Which step suits this employee, and which support makes that step feasible?",
    doelgroep: "HR leads, career advisers and internal coaches.",
    moment:
      "In career conversations, an internal move or a development programme that has to go beyond a good conversation.",
    instrumenten: ["T4P Business Kompas", "DriverScan", "2MINSCAN"],
    pad: null,
    wedge: false,
    prijssignaal:
      "Assessment from EUR 295 per participant, with volume tiers on volume.",
  },
  {
    sleutel: "recruitment",
    naam: "Recruitment & Role Fit",
    ondertitel:
      "Underpinning hiring decisions with talent, drivers, energy and context fit.",
    beslissing:
      "Which candidate genuinely fits this role, this team and this context?",
    doelgroep:
      "HR leads, recruiters and managers who want to hire more strongly and more fairly.",
    moment: "When a role opens up and in the interview round that follows.",
    instrumenten: ["T4Recruitment", "T4P Business Kompas"],
    pad: "/oplossingen/recruitment-role-fit",
    wedge: false,
    prijssignaal:
      "EUR 225 per candidate. Bundle of five EUR 995, bundle of ten EUR 1,850.",
  },
  {
    sleutel: "onderwijs",
    naam: "Education & Youth",
    ondertitel:
      "Giving young people and those who guide them a foothold in orientation and growth.",
    beslissing:
      "Which direction suits this young person, and which support belongs with it?",
    doelgroep:
      "Schools, student guidance staff, youth workers and sports clubs.",
    moment:
      "In study choice, in the transition to higher education and in the guidance of young athletes.",
    instrumenten: ["T4Students Studiekompas", "T4Teens", "T4Kids", "T4Sports"],
    pad: null,
    wedge: false,
    prijssignaal:
      "School formulas and annual agreements tailored to the institution.",
  },
];

/**
 * Recruitment is de vierde publieke journey, maar geen losse hoek van het
 * platform. Deze regels sluiten de andere journeys op de instroombeslissing
 * aan, één per journey, in dezelfde orde als het Nederlandse bestand.
 */
export const AANSLUITING_RECRUITMENT_EN: Record<string, string> = {
  hdd:
    "If the current team shows insufficient capacity or complementarity, Tapas CORE also supports the targeted search for external reinforcement from the same view of people.",
  leiderschap:
    "When a team calls for reinforcement, Tapas CORE shows not only where leadership attention is needed, but also which type of inflow is likely to make the team stronger.",
  ontwikkeling:
    "Tapas CORE supports not only the choice for internal development or mobility, but also sharpens the distinction between what is best grown internally and what is best attracted externally.",
};

/**
 * De vier journeys als verschillende beslismomenten op één motor. De naam, de
 * vraag en het pad komen uit CLUSTERS_EN zelf, zodat er nergens twee
 * formuleringen van dezelfde beslissing kunnen ontstaan.
 */
export const BESLISMOMENTEN_EN: Beslismoment[] = [
  {
    sleutel: "hdd",
    relatie:
      "If the team cannot carry the ambition, hiring helps determine which external reinforcement is genuinely missing.",
  },
  {
    sleutel: "leiderschap",
    relatie:
      "Hiring helps determine which profile or which leadership accent strengthens the team.",
  },
  {
    sleutel: "ontwikkeling",
    relatie:
      "Hiring sharpens the boundary between what is best grown internally and what is best attracted externally.",
  },
  {
    sleutel: "recruitment",
    relatie:
      "This journey makes the hiring decision itself stronger, from the same engine as the other three.",
  },
].map((r) => {
  const c = CLUSTERS_EN.find((x) => x.sleutel === r.sleutel);
  if (!c) throw new Error(`Onbekend cluster in BESLISMOMENTEN_EN: ${r.sleutel}`);
  return { ...r, naam: c.naam, vraag: c.beslissing, pad: c.pad };
});

/**
 * De outputstapel is vast. Elk instrument levert de lagen die bij zijn bereik
 * horen, maar de betekenis van een laag verschuift nooit, en het nummer van
 * een laag blijft in beide talen hetzelfde.
 */
export const OUTPUTSTAPEL_EN: OutputLaag[] = [
  {
    nummer: 1,
    naam: "Individual insight",
    lezer: "the participant",
    inhoud:
      "The personal profile in plain language: talent foci, accelerators, drivers and energy, with what that means in daily work.",
    vorm: "PDF, from a few pages to a full compass, depending on the instrument.",
  },
  {
    nummer: 2,
    naam: "Practitioner report",
    lezer: "the coach or facilitator",
    inhoud:
      "The conversation guide: combinations to check, points of attention, questions to ask and boundaries to respect.",
    vorm: "PDF with the interpretation layer, visible to the practitioner only.",
  },
  {
    nummer: 3,
    naam: "Management summary",
    lezer: "the manager or HR",
    inhoud:
      "The pattern at team and organisation level: where the energy sits, where it drains away and what that means for deployment and collaboration.",
    vorm: "PDF of a few pages, without individual scores.",
  },
  {
    nummer: 4,
    naam: "Board report",
    lezer: "the board or the investor",
    inhoud:
      "One page with the essence, the risks, the assumptions and the recommendation that supports the decision.",
    vorm: "PDF of one page, ready for the agenda of a board meeting.",
  },
];

/** De markeringen die op elke rapportkaart staan. */
export const MARKERINGEN_EN: Markering[] = [
  {
    label: "Version",
    waarde: "2.7",
    uitleg: "The report version with which this report was produced.",
  },
  {
    label: "Language",
    waarde: "Dutch",
    uitleg: "The language of assessment and report, set per participant.",
  },
  {
    label: "Date",
    waarde: "Date of assessment",
    uitleg: "A profile is a snapshot in time and therefore carries its date.",
  },
  {
    label: "Confidentiality",
    waarde: "For the named reader only",
    uitleg: "Every layer names who may read the report and who may not.",
  },
];

/**
 * Het traject van Human Due Diligence, zoals de module het werkelijk uitvoert:
 * twee fasen met een Go of No-Go-scharnier ertussen. De vermelde
 * doorlooptijden zijn dienstafspraken, geen regels in de module.
 */
export const HDD_STAPPEN_EN: Stap[] = [
  {
    nummer: 1,
    naam: "Intake",
    inhoud:
      "The decision is sharpened: which file, which question, which team, which deadline. In an acquisition, the level the growth ambition calls for is also established. This is where it is agreed who gets to read which report.",
    duur: "One conversation of two hours",
  },
  {
    nummer: 2,
    naam: "Phase one, exploration",
    inhoud:
      "Every member of the team completes the team scan and the short energy scan. That yields the picture at team level: collaboration along the five pillars, energy balance and the dispersion between members.",
    duur: "Five working days turnaround time",
  },
  {
    nummer: 3,
    naam: "Go or No-Go",
    inhoud:
      "The platform weighs the signals from phase one. One serious signal, or two of moderate severity, points to dysfunctional behaviour: the programme then stops here, because a team that does not function at this level will not carry the plan. If those signals are absent, the in-depth analysis starts, with as its central question whether this team can deliver on the ambition. The consultant keeps final control.",
    duur: "One session of one hour",
  },
  {
    nummer: 4,
    naam: "Phase two, in-depth analysis",
    inhoud:
      "The key individuals complete the Business Kompas. That gives, per person, the talent foci, the accelerators and the drivers, and at team level the coverage of talent, an indication of cognitive capacity and an integrated strengths and weaknesses analysis.",
    duur: "Five to ten working days, depending on the number of participants",
  },
  {
    nummer: 5,
    naam: "Delivery",
    inhoud:
      "The two reports are delivered and explained in person: one for whoever decides, one for the team itself. They are never merged into a single document, and the report for whoever decides does not go to the assessed team.",
    duur: "One session of ninety minutes",
  },
];

/**
 * De outputreeks van Human Due Diligence. Ze wijkt af van de algemene
 * outputstapel van het platform, want dit traject levert na fase één een
 * advies en na fase twee twee gescheiden rapporten.
 */
export const HDD_OUTPUTS_EN: OutputLaag[] = [
  {
    nummer: 1,
    naam: "Individual profile",
    lezer: "the participant",
    inhoud:
      "The personal profile from the Business Kompas: talent foci, accelerators and drivers, with what that means in daily work. Every participant receives their own profile back.",
    vorm: "PDF per participant, in the language of the assessment.",
  },
  {
    nummer: 2,
    naam: "Go or No-Go advice",
    lezer: "the client and the consultant",
    inhoud:
      "The conclusion of phase one: the weighted signals from collaboration, energy balance and dispersion, with the severity and the reason for each signal. The advice states whether the programme stops or the in-depth analysis starts.",
    vorm: "Overview in the working environment, explained in person.",
  },
  {
    nummer: 3,
    naam: "Team Insight Report",
    lezer: "the assessed team",
    inhoud:
      "How this team collaborates, sustains its energy and combines its talent, with development advice. The material intended for whoever decides is not in it, and the final judgement is stated in developmental language.",
    vorm: "Separate report as PDF, in English, may be shared with the team.",
  },
  {
    nummer: 4,
    naam: "Investor Report",
    lezer: "the investor or the board",
    inhoud:
      "The full file document: the final judgement up front, the collaboration and the energy balance, the individual scorecards, the talent coverage, the indication of cognitive capacity, the strengths and weaknesses analysis, a risk register and the questions that still require verification.",
    vorm: "Separate report as PDF, in English, strictly confidential and not for the assessed team.",
  },
];

/** Wat het traject van Human Due Diligence oplevert, in zakelijke termen. */
export const HDD_UITKOMST_EN: string[] = [
  "A well-founded judgement on the leading capability of the team in this file, with the severity of each signal stated.",
  "A decision after phase one on whether the programme continues, so that a file with dysfunctional signals is not investigated further.",
  "Named risks in collaboration, energy balance and dependence on key individuals, with the questions that still require verification.",
  "A basis for conversation for the hundred days after the decision, and a report for the team itself that can be shared without rework.",
  "A file document that makes the human side of the decision traceable, with the sources and the method stated in it.",
];

/** Het traject van Leadership & Team Energy, in vijf vaste stappen. */
export const LTE_STAPPEN_EN: Stap[] = [
  {
    nummer: 1,
    naam: "Framing the question",
    inhoud:
      "With the manager it is established which behaviour, which collaboration and which delivery capability are at risk, and what has to be different after the programme.",
    duur: "One conversation of ninety minutes",
  },
  {
    nummer: 2,
    naam: "Energy scan of the team",
    inhoud:
      "Every employee completes the short scan. The picture at team level shows where energy arises, where it drains away and where the roles chafe.",
    duur: "Three working days turnaround time",
  },
  {
    nummer: 3,
    naam: "Individual compasses",
    inhoud:
      "The manager and the key roles complete the Business Kompas. That makes clear who is naturally strong at what and what costs effort.",
    duur: "Five working days",
  },
  {
    nummer: 4,
    naam: "Team session",
    inhoud:
      "A facilitated session in which the team reads the picture, recognises it and turns it into agreements on roles, consultation and mutual expectations.",
    duur: "One half day",
  },
  {
    nummer: 5,
    naam: "Follow-up",
    inhoud:
      "After three months the scan is repeated and placed alongside the agreements. That shows whether the energy has actually shifted.",
    duur: "One session of two hours",
  },
];

/** Wat het traject van Leadership & Team Energy oplevert. */
export const LTE_UITKOMST_EN: string[] = [
  "A team that can name its own composition and energy balance.",
  "Agreements on roles and consultation that are built on talent and drivers.",
  "A manager who knows where attention pays off and where it is wasted.",
  "A measurement after three months that shows whether something has genuinely shifted.",
];

/**
 * Het traject van Recruitment & Role Fit, in vijf vaste stappen. De inhoud
 * volgt de module zelf: server/t4r/schema.ts (de stakeholderkring met haar
 * gelaagde minimumdrempels en het sluiten van de kring), server/t4r/match.ts
 * (het virtuele rolprofiel in alignment, met need, nice en not-needed) en
 * server/t4r/uit-afname.ts (het kandidaatprofiel dat rechtstreeks uit een
 * afname van dit platform komt). De vermelde doorlooptijden zijn
 * dienstafspraken, geen regels in de module.
 */
export const RR_STAPPEN_EN: Stap[] = [
  {
    nummer: 1,
    naam: "Sharpening role and context",
    inhoud:
      "With the client it is established which role is open, in which team and in which phase of the organisation, and what the first months genuinely ask for.",
    duur: "One conversation of ninety minutes",
  },
  {
    nummer: 2,
    naam: "Role profile through the stakeholder circle",
    inhoud:
      "Those involved around the role each indicate separately what the role needs, what is welcome and what is not required. The stakeholder circle is closed as soon as participation meets the thresholds, and the differences are talked through in alignment until one supported role profile stands.",
    duur: "Five working days turnaround time",
  },
  {
    nummer: 3,
    naam: "Candidate profile",
    inhoud:
      "Every candidate completes the Business Kompas. The profile comes straight from that assessment, with the consent and the retention period attached to it, so that the figures in the comparison remain traceable.",
    duur: "Three working days per candidate",
  },
  {
    nummer: 4,
    naam: "Comparative study",
    inhoud:
      "The role profile and the candidate profile are placed side by side per talent focus, accelerator, driver and energy line. It becomes visible where the match is strong, where it needs attention and where it stays vulnerable.",
    duur: "Two working days",
  },
  {
    nummer: 5,
    naam: "Conversation and decision",
    inhoud:
      "The fit report feeds the interview round with targeted questions per candidate, and after the choice it delivers the points of attention for the first months. The decision stays with the organisation.",
    duur: "One conversation of two hours",
  },
];

/** Wat het traject van Recruitment & Role Fit oplevert. */
export const RR_UITKOMST_EN: string[] = [
  "A role profile that is supported by those involved around the role, and not by one opinion alone.",
  "A comparison per candidate on talent, drivers and energy, in the same language as the rest of the platform.",
  "Named points of attention for the conversation, with the questions that remain open.",
  "Insight into where the match is durable and where it stays vulnerable in this role and this context.",
  "An underpinning that remains usable after the decision for the first months of the new employee.",
];

/** De journeys in de demo-omgeving, met een vast verhaal. */
export const DEMO_JOURNEYS_EN: DemoJourney[] = [
  {
    sleutel: "hdd",
    naam: "Human Due Diligence",
    probleem:
      "An investor has the numbers of an acquisition file settled, but no view of the team that has to deliver the plan.",
    deelnemers:
      "Five members of the executive committee, plus eighteen employees for the team picture.",
    flow: [
      "Intake with the investor and the person responsible for the file",
      "Phase one: team scan and energy scan for the whole team",
      "Go or No-Go on the signals from phase one",
      "Phase two: Business Kompas for the five key individuals",
      "Delivery of the two reports with an explanation in person",
    ],
    outputs: [
      "Go or No-Go advice after phase one",
      "Investor Report for the investor, strictly confidential",
      "Team Insight Report for the team itself",
      "Individual profiles for the five members",
    ],
    vervolgactie:
      "A decision on entry, with a framework of agreements for the first hundred days.",
  },
  {
    sleutel: "leiderschap",
    naam: "Leadership & Team Energy",
    probleem:
      "A newly composed department is not meeting its targets, while nobody can name where exactly it stalls.",
    deelnemers: "One manager and fourteen employees.",
    flow: [
      "Framing the question with the manager",
      "Energy scan across the entire department",
      "Business Kompas for the manager and four key roles",
      "Team session of half a day",
      "Repeat scan after three months",
    ],
    outputs: [
      "Management summary of the department",
      "Practitioner report for the facilitator",
      "Individual insight for every participant",
    ],
    vervolgactie:
      "Agreements on roles and consultation, with a second measurement as the test.",
  },
  {
    sleutel: "ontwikkeling",
    naam: "Development",
    probleem:
      "An organisation wants to get internal mobility moving and does not know which employees can handle which step.",
    deelnemers:
      "Twelve employees in a development programme and two internal coaches.",
    flow: [
      "Selection of the participants and choice of the instrument",
      "Business Kompas per participant",
      "Individual conversation with an internal coach",
      "Development agreement per employee",
      "Feedback to HR at pattern level",
    ],
    outputs: [
      "Individual insight per participant",
      "Practitioner report per coaching conversation",
      "Management summary for HR",
    ],
    vervolgactie:
      "Twelve development agreements and a picture of the internal room to move.",
  },
];

/** De fictieve maar realistische contexten voor de casemodus. */
export const DEMO_CASES_EN: DemoCase[] = [
  {
    sleutel: "scaleup",
    naam: "Scale-up in growing pains",
    context:
      "A software company grew from 25 to 85 employees in two years. The founders are still in every decision, the middle management has only just been appointed.",
    vraag:
      "Can this leading team carry the next growth phase, and where does the structure have to be strengthened first?",
    journey: "Leadership & Team Energy",
    uitkomst:
      "A picture of the energy balance in the middle management and a framework of agreements that takes the founders out of daily decision making.",
  },
  {
    sleutel: "consultancy",
    naam: "Consultancy firm with a partner structure",
    context:
      "Forty consultants, six partners, strong individual profiles and a shared complaint that collaboration between the practices grinds to a halt.",
    vraag:
      "Where is the real brake on collaboration, and which partners pull which team forward?",
    journey: "Leadership & Team Energy",
    uitkomst:
      "A team picture per practice, a management summary for the partner committee and three concrete collaboration agreements.",
  },
  {
    sleutel: "investering",
    naam: "Investment file family business",
    context:
      "An investment company is examining the acquisition of a family business with 120 employees. The second generation is taking over the lead.",
    vraag:
      "Does the new leadership carry the plan, and which dependencies remain after the handover?",
    journey: "Human Due Diligence",
    uitkomst:
      "A board report with the risks around key individuals and a basis for conversation for the first hundred days after the acquisition.",
  },
];

/** Wat een licentie bevat, per context. */
export const LICENTIES_EN: LicentieBeeld[] = [
  {
    naam: "Coach and practitioner",
    voorWie:
      "Independent coaches, career advisers and consultants who work with their own clients.",
    signaal: "Annual licence from EUR 1,950.",
    bevat: [
      "Own environment to invite participants and follow up the assessment",
      "All instruments of the business line, with the assessment charged per participant",
      "Practitioner reports with every profile, including the interpretation layer",
      "Certification and continued training within the competence framework",
      "Reports in the participant's own choice of language",
    ],
  },
  {
    naam: "Organisation",
    voorWie:
      "Companies and institutions that send out, follow up and guide internally themselves.",
    signaal: "Annual licence from EUR 6,000.",
    bevat: [
      "Organisation environment with several administrators and internal practitioners",
      "Team and department pictures on top of the individual profiles",
      "Management summaries and board reports",
      "Retention periods, consent and anonymisation according to your own agreements",
      "Volume tiers on assessment volume from twenty-five participants",
    ],
  },
  {
    naam: "Strategic partner",
    voorWie:
      "Advisory firms and investment partners who bring programmes to market in their own name.",
    signaal: "Agreement per file, with programme rates from EUR 7,500.",
    bevat: [
      "Joint build-up of the first files",
      "Human Due Diligence as a programme, with pricing at programme level",
      "Board-ready delivery under shared responsibility",
      "Training of your own consultants within the competence framework",
      "A fixed point of contact at Tapas CORE",
    ],
  },
];

/**
 * De bestaande aanmeldingsdeuren, als operationele laag. De paden blijven
 * ongewijzigd; enkel het opschrift en de begeleidende tekst zijn Engels.
 */
export const DEUREN_EN: Deur[] = [
  {
    label: "Participant",
    pad: "/mijn",
    voorWie: "You completed an instrument and want to find your report again.",
    nodig: "Your email address, after which you receive a sign-in link.",
  },
  {
    label: "Coach or practitioner",
    pad: "/coach",
    voorWie: "You guide your own clients with a coach licence.",
    nodig: "Your coach details.",
  },
  {
    label: "Organisation",
    pad: "/organisatie",
    voorWie: "You send out and follow up for your own organisation.",
    nodig: "The details of your organisation environment.",
  },
  {
    label: "Instrument overview",
    pad: "/instrumenten",
    voorWie: "You want to see first which instruments there are.",
    nodig: "Nothing, this overview is open.",
  },
];

/** De twee journeys van de internationale eerste fase. */
export const WEDGE_CLUSTERS_EN: Cluster[] = CLUSTERS_EN.filter((c) => c.wedge);
