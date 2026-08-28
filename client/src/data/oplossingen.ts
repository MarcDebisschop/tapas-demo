// ===========================================================================
// oplossingen.ts: de inhoud van de publieke positioneringslaag van Tapas CORE.
//
// WAAROM DIT BESTAND BESTAAT
// De publieke laag vertelt één verhaal: Tapas CORE is de beslislaag waarmee
// een organisatie betere talentbeslissingen neemt. Dat verhaal staat op de
// onthaalpagina, op de oplossingpagina's, op de outputpagina, bij de partners
// en in de demo-omgeving. Wie die teksten op vijf plaatsen apart onderhoudt,
// krijgt vijf verschillende verhalen. Daarom staan de namen, de clusters, de
// stappen, de outputstapel, de prijssignalen en de demoverhalen hier, op één
// plaats, en halen alle schermen ze hier op.
//
// WAT DIT BESTAND NIET DOET
// Het raakt de instrumentenlogica, de afname, de scoring en de
// rapportgeneratie niet aan. Dit is uitsluitend de laag erboven: benoemen,
// ordenen en tonen wat er al is.
// ===========================================================================

/** Eén onderdeel van de publieke hoofdnavigatie. */
export type NavItem = {
  /** Het opschrift zoals de bezoeker het leest. */
  label: string;
  /** De route binnen de app, of een sectie-id op de onthaalpagina. */
  pad: string;
  /** Sectie-id op de onthaalpagina, wanneer de verwijzing daar naartoe rolt. */
  sectie?: string;
};

/**
 * De publieke hoofdnavigatie vertrekt van journeys, niet van rollen. De
 * rolgebonden ingangen blijven bestaan, maar staan achter "Aanmelden" als
 * operationele laag.
 */
export const HOOFDNAVIGATIE: NavItem[] = [
  { label: "Platform", pad: "/", sectie: "werking" },
  { label: "Oplossingen", pad: "/oplossingen" },
  { label: "Outputs", pad: "/outputs" },
  { label: "Voor partners", pad: "/partners" },
  { label: "Aanmelden", pad: "/aanmelden", sectie: "aanmelden" },
];

/** Een journeycluster: de zakelijke ordening van het bestaande aanbod. */
export type Cluster = {
  sleutel: string;
  naam: string;
  ondertitel: string;
  /** De beslissing die dit cluster ondersteunt. */
  beslissing: string;
  doelgroep: string;
  moment: string;
  /** De instrumenten die het cluster vandaag al gebruikt. */
  instrumenten: string[];
  /** Eigen oplossingpagina, of null wanneer het cluster in de lijst blijft. */
  pad: string | null;
  /** True voor de twee journeys van de internationale eerste fase. */
  wedge: boolean;
  /** Licht prijssignaal, op trajectniveau of per afname. */
  prijssignaal: string;
};

export const CLUSTERS: Cluster[] = [
  {
    sleutel: "hdd",
    naam: "Human Due Diligence",
    ondertitel:
      "Zicht op het menselijke deel van een dossier voordat de beslissing valt.",
    beslissing:
      "Stappen wij in, nemen wij over, en met welk leidend team gaan wij verder?",
    doelgroep:
      "Investeerders, raden van bestuur, directies en hun adviseurs bij een overname, een kapitaalronde of een herstructurering.",
    moment:
      "In de weken voor een beslissing, wanneer de cijfers gekend zijn en de vraag over de mensen open blijft.",
    instrumenten: ["TaPas Teamscan", "2MINSCAN", "T4P Business Kompas"],
    pad: "/oplossingen/human-due-diligence",
    wedge: true,
    prijssignaal:
      "Traject vanaf 7.500 euro. Standaardtraject vanaf 12.500 euro. De prijs staat op trajectniveau, niet per deelnemer.",
  },
  {
    sleutel: "leiderschap",
    naam: "Leadership & Team Energy",
    ondertitel:
      "Leiderschap, vertrouwen en energie in een ploeg zichtbaar en bespreekbaar maken.",
    beslissing:
      "Waar zetten wij onze leiderschapsaandacht, en hoe stellen wij deze ploeg samen?",
    doelgroep:
      "Directies, HR-verantwoordelijken en teamleiders in organisaties vanaf twintig medewerkers.",
    moment:
      "Bij een nieuwe ploeg, een nieuwe leidinggevende, een fusie van afdelingen of een team dat vastloopt zonder duidelijke oorzaak.",
    instrumenten: ["TaPas Teamscan", "T4P Business Kompas", "2MINSCAN", "T4O"],
    pad: "/oplossingen/leadership-team-energy",
    wedge: true,
    prijssignaal:
      "Afname vanaf 295 euro per deelnemer, met staffels vanaf vijfentwintig deelnemers. Jaarlicentie voor organisaties vanaf 6.000 euro.",
  },
  {
    sleutel: "ontwikkeling",
    naam: "Development & Mobility",
    ondertitel:
      "Ontwikkeling en interne mobiliteit onderbouwen met talent, drivers en energie.",
    beslissing:
      "Welke stap past bij deze medewerker, en welke begeleiding maakt die stap haalbaar?",
    doelgroep:
      "HR-verantwoordelijken, loopbaanbegeleiders en interne coaches.",
    moment:
      "Bij loopbaangesprekken, een interne beweging of een ontwikkeltraject dat verder moet gaan dan een goed gesprek.",
    instrumenten: ["T4P Business Kompas", "DriverScan", "2MINSCAN"],
    pad: null,
    wedge: false,
    prijssignaal: "Afname vanaf 295 euro per deelnemer, met staffels op volume.",
  },
  {
    sleutel: "recruitment",
    naam: "Recruitment & Role Fit",
    ondertitel:
      "Aanwervingsbeslissingen onderbouwen met talent, drivers, energie en context-fit.",
    beslissing:
      "Welke kandidaat past werkelijk bij deze rol, dit team en deze context?",
    doelgroep:
      "HR-verantwoordelijken, recruiters en leidinggevenden die sterker en eerlijker willen aanwerven.",
    moment: "Bij het openzetten van een rol en in de gespreksronde erna.",
    instrumenten: ["T4Recruitment", "T4P Business Kompas"],
    pad: "/oplossingen/recruitment-role-fit",
    wedge: false,
    prijssignaal:
      "225 euro per kandidaat. Bundel van vijf 995 euro, bundel van tien 1.850 euro.",
  },
  {
    sleutel: "onderwijs",
    naam: "Education & Youth",
    ondertitel:
      "Jongeren en hun begeleiders houvast geven bij oriëntatie en groei.",
    beslissing:
      "Welke richting past bij deze jongere, en welke begeleiding hoort daarbij?",
    doelgroep: "Scholen, CLB-medewerkers, jeugdbegeleiders en sportclubs.",
    moment:
      "Bij studiekeuze, bij de overgang naar het hoger onderwijs en bij de begeleiding van jonge sporters.",
    instrumenten: ["T4Students Studiekompas", "T4Teens", "T4Kids", "T4Sports"],
    pad: null,
    wedge: false,
    prijssignaal: "Schoolformules en jaarafspraken op maat van de instelling.",
  },
];

/** De twee journeys van de internationale eerste fase. */
export const WEDGE_CLUSTERS: Cluster[] = CLUSTERS.filter((c) => c.wedge);

/**
 * Recruitment is de vierde publieke journey, maar het is geen losse hoek van het
 * platform. Het is een beslismoment in dezelfde talentcyclus, en dat moet in de
 * begeleidende tekst van de andere journeys te zien zijn zonder dat die hun
 * eigen kern verliezen. Deze regels zijn woordelijk de aanbevolen formules uit
 * het integratiedossier, één per journey.
 */
export const AANSLUITING_RECRUITMENT: Record<string, string> = {
  hdd:
    "Als het huidige team onvoldoende draagkracht of complementariteit toont, ondersteunt Tapas CORE ook de gerichte zoektocht naar externe versterking vanuit hetzelfde mensbeeld.",
  leiderschap:
    "Wanneer een ploeg versterking vraagt, maakt Tapas CORE niet alleen zichtbaar waar leiderschapsaandacht nodig is, maar ook welk type instroom het team waarschijnlijk sterker maakt.",
  ontwikkeling:
    "Tapas CORE ondersteunt niet alleen de keuze voor interne ontwikkeling of mobiliteit, maar scherpt ook het onderscheid aan tussen wat best intern groeit en wat best extern wordt aangetrokken.",
};

/** Eén beslismoment in de talentcyclus, met zijn verhouding tot instroom. */
export type Beslismoment = {
  sleutel: string;
  naam: string;
  /** De centrale vraag van deze journey. */
  vraag: string;
  /** Hoe deze journey zich verhoudt tot de instroombeslissing. */
  relatie: string;
  pad: string | null;
};

/**
 * De vier journeys als verschillende beslismomenten op één motor, en niet als
 * losse instrumenten. De vraag komt uit het cluster zelf, zodat er nergens twee
 * formuleringen van dezelfde beslissing kunnen ontstaan.
 */
export const BESLISMOMENTEN: Beslismoment[] = [
  {
    sleutel: "hdd",
    relatie:
      "Kan het team de ambitie niet dragen, dan helpt instroom bepalen welke externe versterking werkelijk ontbreekt.",
  },
  {
    sleutel: "leiderschap",
    relatie:
      "Instroom helpt bepalen welk profiel of welk leiderschapsaccent de ploeg versterkt.",
  },
  {
    sleutel: "ontwikkeling",
    relatie:
      "Instroom scherpt de grens aan tussen wat best intern groeit en wat best extern wordt aangetrokken.",
  },
  {
    sleutel: "recruitment",
    relatie:
      "Deze journey maakt de instroombeslissing zelf sterker, vanuit dezelfde motor als de andere drie.",
  },
].map((r) => {
  const c = CLUSTERS.find((x) => x.sleutel === r.sleutel);
  if (!c) throw new Error(`Onbekend cluster in BESLISMOMENTEN: ${r.sleutel}`);
  return { ...r, naam: c.naam, vraag: c.beslissing, pad: c.pad };
});

/** Eén laag uit de outputstapel, benoemd naar de lezer. */
export type OutputLaag = {
  nummer: number;
  naam: string;
  lezer: string;
  inhoud: string;
  vorm: string;
};

/**
 * De outputstapel is vast. Elk instrument levert de lagen die bij zijn bereik
 * horen, maar de betekenis van een laag verschuift nooit.
 */
export const OUTPUTSTAPEL: OutputLaag[] = [
  {
    nummer: 1,
    naam: "Individueel inzicht",
    lezer: "de deelnemer zelf",
    inhoud:
      "Het persoonlijke profiel in gewone taal: talentfoci, versnellers, drivers en energie, met wat dat betekent in het dagelijkse werk.",
    vorm: "PDF, van enkele pagina's tot een volledig kompas, naargelang het instrument.",
  },
  {
    nummer: 2,
    naam: "Begeleidersrapport",
    lezer: "de coach of facilitator",
    inhoud:
      "De gespreksleidraad: combinaties om na te gaan, aandachtspunten, vragen om te stellen en grenzen om te respecteren.",
    vorm: "PDF met de duidingslaag, enkel zichtbaar voor de begeleider.",
  },
  {
    nummer: 3,
    naam: "Managementsamenvatting",
    lezer: "de leidinggevende of HR",
    inhoud:
      "Het patroon op ploeg- en organisatieniveau: waar de energie zit, waar ze wegloopt en wat dat betekent voor inzet en samenwerking.",
    vorm: "PDF van enkele pagina's, zonder individuele scores.",
  },
  {
    nummer: 4,
    naam: "Bestuursrapport",
    lezer: "de raad van bestuur of de investeerder",
    inhoud:
      "Eén pagina met de kern, de risico's, de aannames en de aanbeveling die de beslissing ondersteunt.",
    vorm: "PDF van één pagina, klaar voor de agenda van een bestuursvergadering.",
  },
];

/** De markeringen die op elke rapportkaart staan. */
export type Markering = { label: string; waarde: string; uitleg: string };

export const MARKERINGEN: Markering[] = [
  {
    label: "Versie",
    waarde: "2.7",
    uitleg: "De rapportversie waarmee dit rapport is opgemaakt.",
  },
  {
    label: "Taal",
    waarde: "Nederlands",
    uitleg: "De taal van afname en rapport, per deelnemer vastgelegd.",
  },
  {
    label: "Datum",
    waarde: "Datum van afname",
    uitleg: "Een profiel is een momentopname en draagt daarom zijn datum.",
  },
  {
    label: "Vertrouwelijkheid",
    waarde: "Enkel voor de genoemde lezer",
    uitleg: "Elke laag noemt wie het rapport mag lezen en wie niet.",
  },
];

/** Een vaste stap in een traject. */
export type Stap = { nummer: number; naam: string; inhoud: string; duur: string };

/**
 * Het traject van Human Due Diligence, zoals de module het werkelijk uitvoert:
 * twee fasen met een Go of No-Go-scharnier ertussen. De inhoud volgt
 * server/hdd/schema.ts, gate.ts, aggregatie.ts en rapport.ts. De vermelde
 * doorlooptijden zijn dienstafspraken, geen regels in de module.
 */
export const HDD_STAPPEN: Stap[] = [
  {
    nummer: 1,
    naam: "Intake",
    inhoud:
      "De beslissing wordt scherp gesteld: welk dossier, welke vraag, welke ploeg, welke termijn. Bij een overname wordt ook het niveau bepaald dat de groeiambitie vraagt. Hier wordt afgesproken wie welk rapport te lezen krijgt.",
    duur: "Eén gesprek van twee uur",
  },
  {
    nummer: 2,
    naam: "Fase één, verkenning",
    inhoud:
      "Elk lid van de ploeg doorloopt de teamscan en de korte energiescan. Dat levert het beeld op ploegniveau: samenwerking volgens de vijf pijlers, energiebalans en de spreiding tussen de leden.",
    duur: "Vijf werkdagen doorlooptijd",
  },
  {
    nummer: 3,
    naam: "Go of No-Go",
    inhoud:
      "Het platform weegt de signalen uit fase één. Eén ernstig signaal, of twee van gemiddelde ernst, wijst op dysfunctioneel gedrag: dan stopt het traject hier, want een ploeg die op dit niveau niet functioneert draagt het plan niet. Blijven die signalen uit, dan start de diepteanalyse, met als centrale vraag of deze ploeg de ambitie kan waarmaken. De consultant houdt de eindregie.",
    duur: "Eén zitting van één uur",
  },
  {
    nummer: 4,
    naam: "Fase twee, diepteanalyse",
    inhoud:
      "De sleutelfiguren doorlopen het Business Kompas. Dat geeft per persoon de talentfoci, de versnellers en de drivers, en op ploegniveau de dekking van talent, een indicatie van cognitieve draagkracht en een geïntegreerde sterkte-zwakteanalyse.",
    duur: "Vijf tot tien werkdagen, afhankelijk van het aantal deelnemers",
  },
  {
    nummer: 5,
    naam: "Oplevering",
    inhoud:
      "De twee rapporten worden opgeleverd en mondeling toegelicht: één voor wie beslist, één voor de ploeg zelf. Ze worden nooit tot één document samengevoegd, en het rapport voor wie beslist gaat niet naar de beoordeelde ploeg.",
    duur: "Eén zitting van negentig minuten",
  },
];

/**
 * De outputreeks van Human Due Diligence. Ze wijkt af van de algemene
 * outputstapel van het platform, want dit traject levert na fase één een advies
 * en na fase twee twee gescheiden rapporten. De rapporten van dit traject zijn
 * in het Engels opgesteld, omdat de lezer doorgaans internationaal is.
 */
export const HDD_OUTPUTS: OutputLaag[] = [
  {
    nummer: 1,
    naam: "Individueel profiel",
    lezer: "de deelnemer zelf",
    inhoud:
      "Het persoonlijke profiel uit het Business Kompas: talentfoci, versnellers en drivers, met wat dat betekent in het dagelijkse werk. Elke deelnemer krijgt zijn eigen profiel terug.",
    vorm: "PDF per deelnemer, in de taal van de afname.",
  },
  {
    nummer: 2,
    naam: "Go of No-Go-advies",
    lezer: "de opdrachtgever en de consultant",
    inhoud:
      "Het besluit van fase één: de gewogen signalen uit samenwerking, energiebalans en spreiding, met per signaal de ernst en de reden. Het advies zegt of het traject stopt of dat de diepteanalyse start.",
    vorm: "Overzicht in de werkomgeving, mondeling toegelicht.",
  },
  {
    nummer: 3,
    naam: "Team Insight Report",
    lezer: "de beoordeelde ploeg",
    inhoud:
      "Hoe deze ploeg samenwerkt, haar energie volhoudt en haar talent combineert, met ontwikkelingsadvies. Het materiaal dat enkel voor wie beslist bedoeld is, staat er niet in, en het eindoordeel staat er in ontwikkelingstaal.",
    vorm: "Apart rapport als PDF, in het Engels, mag met de ploeg gedeeld worden.",
  },
  {
    nummer: 4,
    naam: "Investor Report",
    lezer: "de investeerder of de raad van bestuur",
    inhoud:
      "Het volledige dossierstuk: het eindoordeel vooraan, de samenwerking en de energiehuishouding, de individuele scorekaarten, de talentdekking, de indicatie van cognitieve draagkracht, de sterkte-zwakteanalyse, een risicoregister en de vragen die nog verificatie vragen.",
    vorm: "Apart rapport als PDF, in het Engels, strikt vertrouwelijk en niet voor de beoordeelde ploeg.",
  },
];

/** Het traject van Leadership & Team Energy, in vijf vaste stappen. */
export const LTE_STAPPEN: Stap[] = [
  {
    nummer: 1,
    naam: "Vraagstelling",
    inhoud:
      "Met de leidinggevende wordt bepaald welk gedrag, welke samenwerking en welke uitvoeringskracht in het gedrang komen, en wat er na het traject anders moet zijn.",
    duur: "Eén gesprek van negentig minuten",
  },
  {
    nummer: 2,
    naam: "Energiescan van de ploeg",
    inhoud:
      "Elke medewerker vult de korte scan in. Het beeld op ploegniveau toont waar energie ontstaat, waar ze wegloopt en waar de rollen wringen.",
    duur: "Drie werkdagen doorlooptijd",
  },
  {
    nummer: 3,
    naam: "Individuele kompassen",
    inhoud:
      "De leidinggevende en de sleutelrollen doorlopen het Business Kompas. Dat maakt duidelijk wie waarop natuurlijk sterk staat en wat inspanning kost.",
    duur: "Vijf werkdagen",
  },
  {
    nummer: 4,
    naam: "Ploegsessie",
    inhoud:
      "Een begeleide sessie waarin de ploeg het beeld leest, herkent en omzet in afspraken over rollen, overleg en onderlinge verwachtingen.",
    duur: "Eén halve dag",
  },
  {
    nummer: 5,
    naam: "Opvolging",
    inhoud:
      "Na drie maanden wordt de scan herhaald en naast de afspraken gelegd. Zo is zichtbaar of de energie effectief verschoven is.",
    duur: "Eén sessie van twee uur",
  },
];

/** Wat een traject oplevert, in zakelijke termen. */
export const HDD_UITKOMST: string[] = [
  "Een onderbouwd oordeel over het leidend vermogen van de ploeg in dit dossier, met de ernst van elk signaal erbij.",
  "Een beslissing na fase één of het traject verdergaat, zodat een dossier met dysfunctionele signalen niet verder onderzocht wordt.",
  "Benoemde risico's in samenwerking, energiebalans en afhankelijkheid van sleutelfiguren, met de vragen die nog verificatie vragen.",
  "Een gespreksbasis voor de honderd dagen na de beslissing, en een rapport voor de ploeg zelf dat zonder herwerking gedeeld kan worden.",
  "Een dossierstuk dat de menselijke kant van de beslissing traceerbaar maakt, met de bronnen en de methode erin vermeld.",
];

export const LTE_UITKOMST: string[] = [
  "Een ploeg die haar eigen samenstelling en energiebalans kan benoemen.",
  "Afspraken over rollen en overleg die op talent en drivers gebouwd zijn.",
  "Een leidinggevende die weet waar aandacht rendeert en waar ze verspild wordt.",
  "Een meting na drie maanden die aantoont of er werkelijk iets verschoven is.",
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
export const RR_STAPPEN: Stap[] = [
  {
    nummer: 1,
    naam: "Rol en context scherpstellen",
    inhoud:
      "Met de opdrachtgever wordt bepaald welke rol openstaat, in welk team en in welke fase van de organisatie, en welke opdracht de eerste maanden werkelijk vraagt.",
    duur: "Eén gesprek van negentig minuten",
  },
  {
    nummer: 2,
    naam: "Rolprofiel via de kring",
    inhoud:
      "De betrokkenen rond de rol duiden elk apart aan wat de functie nodig heeft, wat welkom is en wat niet vereist is. De kring wordt gesloten zodra de deelname de drempels haalt, en de verschillen worden in alignment uitgesproken tot er één gedragen rolprofiel staat.",
    duur: "Vijf werkdagen doorlooptijd",
  },
  {
    nummer: 3,
    naam: "Kandidaatprofiel",
    inhoud:
      "Elke kandidaat doorloopt het Business Kompas. Het profiel komt rechtstreeks uit die afname, met de toestemming en de bewaartermijn die eraan hangen, zodat de cijfers in de vergelijking herleidbaar blijven.",
    duur: "Drie werkdagen per kandidaat",
  },
  {
    nummer: 4,
    naam: "Vergelijkende studie",
    inhoud:
      "Het rolprofiel en het kandidaatprofiel worden naast elkaar gelegd per talentfocus, versneller, driver en energielijn. Zichtbaar wordt waar de match sterk staat, waar ze aandacht vraagt en waar ze kwetsbaar blijft.",
    duur: "Twee werkdagen",
  },
  {
    nummer: 5,
    naam: "Gesprek en besluit",
    inhoud:
      "Het fit-rapport voedt de gespreksronde met gerichte vragen per kandidaat, en levert na de keuze de aandachtspunten voor de eerste maanden. De beslissing blijft bij de organisatie.",
    duur: "Eén gesprek van twee uur",
  },
];

export const RR_UITKOMST: string[] = [
  "Een rolprofiel dat gedragen is door de betrokkenen rond de functie, en niet door één mening alleen.",
  "Een vergelijking per kandidaat op talent, drivers en energie, in dezelfde taal als de rest van het platform.",
  "Benoemde aandachtspunten voor het gesprek, met de vragen die nog open blijven.",
  "Zicht op waar de match duurzaam is en waar ze kwetsbaar blijft in deze rol en deze context.",
  "Een onderbouwing die na de beslissing bruikbaar blijft voor de eerste maanden van de nieuwe medewerker.",
];

/** Een journey in de demo-omgeving, met een vast verhaal. */
export type DemoJourney = {
  sleutel: string;
  naam: string;
  probleem: string;
  deelnemers: string;
  flow: string[];
  outputs: string[];
  vervolgactie: string;
};

export const DEMO_JOURNEYS: DemoJourney[] = [
  {
    sleutel: "hdd",
    naam: "Human Due Diligence",
    probleem:
      "Een investeerder heeft de cijfers van een overnamedossier rond, maar geen zicht op de ploeg die het plan moet uitvoeren.",
    deelnemers:
      "Vijf leden van het directiecomité, plus achttien medewerkers voor het ploegbeeld.",
    flow: [
      "Intake met de investeerder en de dossierverantwoordelijke",
      "Fase één: teamscan en energiescan voor de hele ploeg",
      "Go of No-Go op de signalen uit fase één",
      "Fase twee: Business Kompas voor de vijf sleutelfiguren",
      "Oplevering van de twee rapporten met mondelinge toelichting",
    ],
    outputs: [
      "Go of No-Go-advies na fase één",
      "Investor Report voor de investeerder, strikt vertrouwelijk",
      "Team Insight Report voor de ploeg zelf",
      "Individuele profielen voor de vijf leden",
    ],
    vervolgactie:
      "Beslissing over de instap, met een afsprakenkader voor de eerste honderd dagen.",
  },
  {
    sleutel: "leiderschap",
    naam: "Leadership & Team Energy",
    probleem:
      "Een nieuw samengestelde afdeling haalt haar doelen niet, terwijl niemand kan benoemen waar het precies vastloopt.",
    deelnemers: "Eén leidinggevende en veertien medewerkers.",
    flow: [
      "Vraagstelling met de leidinggevende",
      "Energiescan bij de volledige afdeling",
      "Business Kompas voor de leidinggevende en vier sleutelrollen",
      "Ploegsessie van een halve dag",
      "Herhaalscan na drie maanden",
    ],
    outputs: [
      "Managementsamenvatting van de afdeling",
      "Begeleidersrapport voor de facilitator",
      "Individueel inzicht voor elke deelnemer",
    ],
    vervolgactie:
      "Afspraken over rollen en overleg, met een tweede meting als toets.",
  },
  {
    sleutel: "ontwikkeling",
    naam: "Development",
    probleem:
      "Een organisatie wil interne mobiliteit op gang brengen en weet niet welke medewerkers welke stap aankunnen.",
    deelnemers: "Twaalf medewerkers in een ontwikkeltraject en twee interne coaches.",
    flow: [
      "Selectie van de deelnemers en keuze van het instrument",
      "Business Kompas per deelnemer",
      "Individueel gesprek met een interne coach",
      "Ontwikkelafspraak per medewerker",
      "Terugkoppeling naar HR op patroonniveau",
    ],
    outputs: [
      "Individueel inzicht per deelnemer",
      "Begeleidersrapport per coachgesprek",
      "Managementsamenvatting voor HR",
    ],
    vervolgactie:
      "Twaalf ontwikkelafspraken en een beeld van de interne bewegingsruimte.",
  },
];

/** Een fictieve maar realistische context voor de casemodus. */
export type DemoCase = {
  sleutel: string;
  naam: string;
  context: string;
  vraag: string;
  journey: string;
  uitkomst: string;
};

export const DEMO_CASES: DemoCase[] = [
  {
    sleutel: "scaleup",
    naam: "Scale-up in groeipijn",
    context:
      "Een softwarebedrijf groeide in twee jaar van 25 naar 85 medewerkers. De oprichters zitten nog in elke beslissing, het middenkader is pas benoemd.",
    vraag:
      "Kan dit leidend team de volgende groeifase dragen, en waar moet de structuur eerst versterkt worden?",
    journey: "Leadership & Team Energy",
    uitkomst:
      "Een beeld van de energiebalans in het middenkader en een afsprakenkader dat de oprichters uit de dagelijkse besluitvorming haalt.",
  },
  {
    sleutel: "consultancy",
    naam: "Consultancyhuis met partnerstructuur",
    context:
      "Veertig consultants, zes partners, sterke individuele profielen en een gedeelde klacht dat de samenwerking tussen de praktijken stilvalt.",
    vraag:
      "Waar zit de werkelijke rem op samenwerking, en welke partners trekken welke ploeg vooruit?",
    journey: "Leadership & Team Energy",
    uitkomst:
      "Een ploegbeeld per praktijk, een managementsamenvatting voor het partnercomité en drie concrete samenwerkingsafspraken.",
  },
  {
    sleutel: "investering",
    naam: "Investeringsdossier familiebedrijf",
    context:
      "Een participatiemaatschappij onderzoekt de overname van een familiebedrijf met 120 medewerkers. De tweede generatie neemt de leiding over.",
    vraag:
      "Draagt de nieuwe leiding het plan, en welke afhankelijkheden blijven na de overdracht bestaan?",
    journey: "Human Due Diligence",
    uitkomst:
      "Een bestuursrapport met de risico's rond sleutelfiguren en een gespreksbasis voor de eerste honderd dagen na de overname.",
  },
];

/** Wat een licentie bevat, per context. */
export type LicentieBeeld = {
  naam: string;
  voorWie: string;
  signaal: string;
  bevat: string[];
};

export const LICENTIES: LicentieBeeld[] = [
  {
    naam: "Coach en practitioner",
    voorWie:
      "Zelfstandige coaches, loopbaanbegeleiders en consultants die met eigen klanten werken.",
    signaal: "Jaarlicentie vanaf 1.950 euro.",
    bevat: [
      "Eigen omgeving om deelnemers uit te nodigen en de afname op te volgen",
      "Alle instrumenten van de zakelijke lijn, met afname per deelnemer afgerekend",
      "Begeleidersrapporten bij elk profiel, met de duidingslaag",
      "Certificering en bijscholing binnen het bekwaamheidskader",
      "Rapporten in de eigen taalkeuze van de deelnemer",
    ],
  },
  {
    naam: "Organisatie",
    voorWie:
      "Bedrijven en instellingen die zelf uitsturen, opvolgen en intern begeleiden.",
    signaal: "Jaarlicentie vanaf 6.000 euro.",
    bevat: [
      "Organisatieomgeving met meerdere beheerders en interne begeleiders",
      "Ploeg- en afdelingsbeelden bovenop de individuele profielen",
      "Managementsamenvattingen en bestuursrapporten",
      "Bewaartermijnen, toestemming en anonimisering volgens de eigen afspraken",
      "Staffels op afnamevolume vanaf vijfentwintig deelnemers",
    ],
  },
  {
    naam: "Strategische partner",
    voorWie:
      "Adviesbureaus en investeringspartners die trajecten in eigen naam brengen.",
    signaal: "Afspraak per dossier, met trajecttarieven vanaf 7.500 euro.",
    bevat: [
      "Gezamenlijke opbouw van de eerste dossiers",
      "Human Due Diligence als traject, met prijszetting op trajectniveau",
      "Bestuursklare oplevering onder gedeelde verantwoordelijkheid",
      "Opleiding van de eigen consultants binnen het bekwaamheidskader",
      "Vaste aanspreekpersoon bij Tapas CORE",
    ],
  },
];

/** De vijf bestaande aanmeldingsdeuren, als operationele laag. */
export type Deur = {
  label: string;
  pad: string;
  voorWie: string;
  nodig: string;
};

export const DEUREN: Deur[] = [
  {
    label: "Deelnemer",
    pad: "/mijn",
    voorWie: "U vulde een instrument in en wilt uw rapport terugvinden.",
    nodig: "Uw e-mailadres, waarna u een aanmeldlink ontvangt.",
  },
  {
    label: "Coach of practitioner",
    pad: "/coach",
    voorWie: "U begeleidt eigen klanten met een coachlicentie.",
    nodig: "Uw coachgegevens.",
  },
  {
    label: "Organisatie",
    pad: "/organisatie",
    voorWie: "U stuurt uit en volgt op voor uw eigen organisatie.",
    nodig: "De gegevens van uw organisatieomgeving.",
  },
  {
    label: "Instrumentenoverzicht",
    pad: "/instrumenten",
    voorWie: "U wilt eerst zien welke instrumenten er zijn.",
    nodig: "Niets, dit overzicht staat open.",
  },
];
