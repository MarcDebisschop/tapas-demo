// =============================================================================
// server/gids/data.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Server-side spiegel van client/src/data/instrumentengids.ts.
//
// Bewust een APARTE server-kopie (Regel 2: nieuwe features = server-side of
// aparte bestanden). De PDF-generators (fiche-pdf.ts, brochure-pdf.ts) mogen
// geen client-code importeren; deze module levert dezelfde inhoudelijke velden
// zodat de fiche- en brochure-PDF's byte-identiek zijn aan wat de gids toont.
//
// De teksten hieronder zijn LETTERLIJK overgenomen uit de client-default
// (Regel 4: extraheren, nooit interpreteren). Admin-overrides worden door de
// PDF-routes toegepast via pasOverrideToe() uit ../gids-manager.
// =============================================================================

export type Orientatie = "business" | "education" | "beide" | "sport";

export interface GidsStart {
  label: string;
  route: string;
  direct: boolean;
}

export interface GidsInstrument {
  id: string;
  naam: string;
  orientatie: Orientatie;
  eyebrow: string;
  omschrijving: string;
  beantwoordt: string;
  gebruik: string;
  doelgroep: string;
  start: GidsStart;
  rapportTeaser: string;
  leeftijdsfocus?: string;
  icoon: string;
}

export const INSTRUMENTENGIDS: GidsInstrument[] = [
  {
    id: "t4p-business",
    naam: "T4P Business Kompas",
    orientatie: "beide",
    eyebrow: "Talentprofiel · individueel",
    omschrijving:
      "Het volledige TaPas Kompas: een diepgaand talentprofiel dat talent-foci, talent-versnellers, drivers en energieprofiel in kaart brengt voor één persoon.",
    beantwoordt:
      "Waar liggen mijn natuurlijke talenten? Welke drivers geven mij energie, en welke vreten energie? Hoe zet ik mijn talent het snelst om in resultaat?",
    gebruik:
      "Als anker voor loopbaancoaching, leiderschapsontwikkeling, onboarding of teamsamenstelling. Het profiel voedt gesprekken, ontwikkelplannen en de optionele Coachatlas.",
    doelgroep: "Professionals, leidinggevenden, coaches — ook studenten en leerlingen bij loopbaanoriëntatie.",
    start: { label: "Start een afname", route: "/start", direct: true },
    rapportTeaser:
      "Een rijk TaPas Kompas-rapport met talent-foci, versnellers, drivers, energieprofiel én TaPas Jester-classificatie — als PDF én online dashboard.",
    icoon: "Compass",
  },
  {
    id: "twominscan",
    naam: "2MinScan",
    orientatie: "beide",
    eyebrow: "Snelscan · energie",
    omschrijving:
      "De snelle energiescan: in twee minuten een visuele indicatie van waar de professionele energie op dit moment zit. Ideaal als instap of check-in.",
    beantwoordt:
      "Waar zit mijn energie nu? Sta ik op dit moment in mijn kracht, of vraagt iets aandacht? Een momentopname, geen diepteprofiel.",
    gebruik:
      "Als laagdrempelige instap vóór een coachgesprek, als teamcheck, als onboarding-tool of als periodieke zelfcheck in drukke periodes.",
    doelgroep: "Iedereen — als instap of aanvulling op een volledig profiel.",
    start: { label: "Start de 2MinScan", route: "/2minscan", direct: true },
    rapportTeaser:
      "Een directe energiekaart met één heldere score die aangeeft waar de professionele energie nu zit — inline, zonder wachttijd.",
    icoon: "Zap",
  },
  {
    id: "tapas-teamscan",
    naam: "TaPas Teamscan",
    orientatie: "beide",
    eyebrow: "Teamdynamiek · collectief",
    omschrijving:
      "Een collaboratief reflectie- en ontwikkelinstrument dat de dynamiek, sterktes en spanningsvelden van een team zichtbaar maakt (op basis van Lencioni).",
    beantwoordt:
      "Hoe werkt ons team echt samen? Waar zit vertrouwen, en waar wringt het? Welke disfuncties spelen, en hoe adresseren we ze concreet?",
    gebruik:
      "Om teamdynamieken bespreekbaar te maken, teamontwikkeling te sturen na fusie of reorganisatie, en teamgesprekken te faciliteren met een gedeeld beeld.",
    doelgroep: "Teams, afdelingsmanagers, teamcoaches — in bedrijf én onderwijs.",
    start: { label: "Open de Teamscan", route: "/teamscan", direct: false },
    rapportTeaser:
      "Een collectief teamrapport met sterktes, spanningsvelden en concrete actiepunten, plus een facilitatiegids voor de teamcoach.",
    icoon: "Users",
  },
  {
    id: "impact-roos",
    naam: "Impact-roos",
    orientatie: "beide",
    eyebrow: "360°-feedback · visueel",
    omschrijving:
      "Een visueel 360°-feedbackinstrument dat zelfperceptie en omgevingsperceptie naast elkaar legt in een herkenbaar rozendiagram.",
    beantwoordt:
      "Hoe zie ik mezelf, en hoe ziet mijn omgeving mij? Waar zit het verschil tussen zelfbeeld en impact, en wat betekent dat voor mijn ontwikkeling?",
    gebruik:
      "Als visueel ankerpunt in ontwikkelgesprekken, voor groeps-benchmarking en om zelfperceptie tegenover omgevingsperceptie te plaatsen.",
    doelgroep: "360°-feedbacktrajecten, teamleiders, HR — ook in onderwijscontext.",
    start: { label: "Bekijk de Impact-roos", route: "/impact", direct: false },
    rapportTeaser:
      "Een visueel impactrapport: een SVG-roos die per dimensie zelfscores en omgevingsscores vergelijkt, met batch-tarifering voor groepen.",
    icoon: "Flower2",
  },
  {
    id: "t4recruitment",
    naam: "T4Recruitment",
    orientatie: "business",
    eyebrow: "Selectie · rolprofiel",
    omschrijving:
      "Een selectie-instrument dat via een stakeholder-kring een gedragen rolprofiel bouwt en kandidaten objectief afzet tegen dat profiel.",
    beantwoordt:
      "Welk talent vraagt deze rol echt? Welke kandidaat past het best op talentniveau? Hoe objectiveren we het selectiegesprek voorbij de buikgevoel-fit?",
    gebruik:
      "Om rolprofielen op te stellen via consensus, kandidaten te vergelijken op talentniveau en selectiegesprekken te onderbouwen met data.",
    doelgroep: "Recruiters, hiring managers, selectiepanels.",
    start: { label: "Open T4Recruitment", route: "/t4r", direct: false },
    rapportTeaser:
      "Een rolprofiel-PDF opgebouwd via de hiring-kring, plus een fit-rapport per kandidaat met visuele match-analyse.",
    icoon: "Target",
  },
  {
    id: "hdd",
    naam: "Human Due Diligence",
    orientatie: "business",
    eyebrow: "Vlaggenschip · governance",
    omschrijving:
      "Het gefaseerde vlaggenschip-traject dat de menselijke kant van een organisatie of board grondig doorlicht — de diepste analyse in het TaPas-arsenaal.",
    beantwoordt:
      "Hoe robuust is het leiderschaps- of boardteam? Waar zitten sleutelpersoon-risico's, spanningen en governance-gaten? Wat betekent dat voor de strategie?",
    gebruik:
      "Bij leiderschapswissels, pre-merger talent mapping, het evalueren van strategische teamcomposities en het objectiveren van board-dynamieken.",
    doelgroep: "Boards, directieteams, executive coaches.",
    start: { label: "Vraag een HDD-traject aan", route: "/hdd", direct: false },
    rapportTeaser:
      "Een bestuurlijk talentrapport met een drukklaar executive PDF, boardpresentatie en concrete governance-aanbevelingen.",
    icoon: "Landmark",
  },
  {
    id: "t4sports",
    naam: "T4Sports",
    orientatie: "sport",
    eyebrow: "Sport · mentaal talent",
    omschrijving:
      "Het Mental Talent Profiel voor atleten: talent-toegang, talent-route, drivers en energiestaat vertaald naar sporttaal, met optionele verdiepende modules.",
    beantwoordt:
      "Waar ligt mijn mentaal talent als atleet? Welke drivers werken onder prestatiedruk? Hoe versterk ik veerkracht, flow en atletische identiteit?",
    gebruik:
      "In de begeleiding van elite-atleten, voor driver-analyse onder druk en via de modules Resilience (M1), Flow-State (M2) en Atletische Identiteit (M3).",
    doelgroep: "Topsporters, mental coaches, sportpsychologen.",
    start: { label: "Start T4Sports", route: "/t4sports", direct: true },
    rapportTeaser:
      "Een volledig T4Sports Mental Talent Profiel (Deel 1 + Deel 2) als PDF en online dashboard, met optionele module-uitbreidingen.",
    icoon: "Trophy",
  },
  {
    id: "t4teens",
    naam: "T4Teens",
    orientatie: "education",
    eyebrow: "Jongeren · studiekeuze",
    omschrijving:
      "Een leeftijdsspecifiek talentprofiel voor tieners, in toegankelijke taal, dat helpt bij studiekeuze en talentherkenning in het secundair onderwijs.",
    beantwoordt:
      "Waar liggen mijn talenten als jongere? Welke studierichting past bij wie ik ben? Wat geeft mij energie op school en daarbuiten?",
    gebruik:
      "Voor studiekeuzebegeleiding, talentherkenning in het secundair, preventie van studiedropout en ouder-kindgesprekken over richting.",
    doelgroep: "Jongeren 14–18 jaar, CLB-begeleiders, schoolcoaches.",
    start: { label: "Ontdek T4Teens", route: "/studie/leerlingen", direct: false },
    rapportTeaser:
      "Een T4Teens talentkaart in jongerentaal, met studierichtingssuggesties op basis van de talent-foci.",
    leeftijdsfocus: "14–18 jaar · secundair onderwijs",
    icoon: "Backpack",
  },
  {
    id: "t4students",
    naam: "T4Students",
    orientatie: "education",
    eyebrow: "Studenten · loopbaanstart",
    omschrijving:
      "Een talentprofiel afgestemd op de overgang van studie naar arbeidsmarkt, voor studenten in het hoger onderwijs en hun begeleiders.",
    beantwoordt:
      "Bevestigt mijn studiekeuze wie ik ben? Welke jobdomeinen sluiten aan bij mijn talent? Hoe formuleer ik mijn sterktes richting stage en eerste job?",
    gebruik:
      "Voor studierichtingsbevestiging of -bijsturing, voorbereiding op het stagezoekproces, eerste loopbaanoriëntatie en persoonlijke ontwikkeling.",
    doelgroep: "Studenten 17-23 jaar, studentenbegeleiders.",
    start: { label: "Ontdek T4Students", route: "/studie/leerlingen", direct: false },
    rapportTeaser:
      "Een T4Students talentpaspoort met jobdomein-mapping en een eerste LinkedIn-formulering voor de start op de arbeidsmarkt.",
    leeftijdsfocus: "17-23 jaar",
    icoon: "GraduationCap",
  },
];

export function vindInstrumentServer(id: string): GidsInstrument | undefined {
  return INSTRUMENTENGIDS.find((i) => i.id === id);
}
