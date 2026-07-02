// server/bibliotheek-deelnemer.ts
// =============================================================================
// Gepersonaliseerde bibliotheek + podcasts voor DEELNEMERS (professionals en
// studenten, 18+). Nieuw, server-side bestand (Strikte Werkregel 2: nieuwe
// features = server-side of aparte bestanden). Model: server/t4sports/bibliotheek.ts,
// maar met inhoud gericht op professionele ontwikkeling, werk, leiderschap,
// studie en persoonlijke groei — NIET topsport.
//
// Adaptief: sorteert boeken/podcasts op het driver- en focusprofiel uit het
// generatorContract van de deelnemer (sections.main.constructRows). Naarmate het
// profiel van de deelnemer evolueert (nieuwe afname → nieuw contract), verandert
// de volgorde automatisch mee.
//
// 18+ / gating: de aanroepende route levert deze inhoud alleen voor instrument
// "business" (professionals) en "students" (18+). Voor "teens" wordt de sectie
// niet getoond.
// =============================================================================

export interface DeelnemerBibliotheekItem {
  titel: string;
  auteur: string;
  jaar: number;
  beschrijving: string;
  url: string | null;
  relevantVoorDrivers: string[];
  relevantVoorFoci: string[];
  // Voor welke doelgroep is dit het meest geschikt: "business", "students", of beide.
  doelgroep: Array<"business" | "students">;
  tags: string[];
}

export interface DeelnemerPodcastItem {
  naam: string;
  podcast: string;
  aflevering?: string;
  beschrijving: string;
  url: string | null;
  relevantVoorDrivers: string[];
  doelgroep: Array<"business" | "students">;
  tags: string[];
}

// ---------------------------------------------------------------------------
// BOEKEN — professionele ontwikkeling, werk, studie, persoonlijke groei
// ---------------------------------------------------------------------------
export const DEELNEMER_BOEKEN: DeelnemerBibliotheekItem[] = [
  {
    titel: "Mindset: De weg naar een succesvol leven",
    auteur: "Carol S. Dweck",
    jaar: 2006,
    beschrijving:
      "De groeimindset versus de vaste mindset: hoe je overtuigingen over talent en inspanning je ontwikkeling sturen. Fundamenteel voor iedereen die wil blijven groeien in werk of studie.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Mindset%20Dweck",
    relevantVoorDrivers: ["Be Perfect", "Try Hard"],
    relevantVoorFoci: ["Complexiteit/Conceptueel", "Systematisch/Uitvoerend"],
    doelgroep: ["business", "students"],
    tags: ["groeimindset", "leren", "ontwikkeling", "psychologie"],
  },
  {
    titel: "Grip: Het geheim van slim werken",
    auteur: "Rick Pastoor",
    jaar: 2019,
    beschrijving:
      "Praktisch systeem voor grip op je werk, je week en je jaar. Vlot geschreven, direct toepasbaar — ideaal voor professionals die hun tijd en focus willen terugwinnen.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Grip%20Rick%20Pastoor",
    relevantVoorDrivers: ["Hurry Up", "Be Perfect"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Resultaat"],
    doelgroep: ["business", "students"],
    tags: ["productiviteit", "focus", "planning", "werk"],
  },
  {
    titel: "Deep Work: Regels voor gefocust succes in een wereld vol afleiding",
    auteur: "Cal Newport",
    jaar: 2016,
    beschrijving:
      "Waarom diepe, geconcentreerde arbeid de zeldzame en waardevolle vaardigheid van deze eeuw is — en hoe je die traint. Essentieel bij een 'Hurry Up'-driver of veel afleiding.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Deep%20Work%20Newport",
    relevantVoorDrivers: ["Hurry Up", "Try Hard"],
    relevantVoorFoci: ["Complexiteit/Conceptueel", "Systematisch/Uitvoerend"],
    doelgroep: ["business", "students"],
    tags: ["focus", "concentratie", "productiviteit", "aandacht"],
  },
  {
    titel: "De zeven eigenschappen van effectief leiderschap",
    auteur: "Stephen R. Covey",
    jaar: 1989,
    beschrijving:
      "Tijdloos werk over proactiviteit, prioriteiten en win-win-denken. Sterk voor wie een 'Please Others'- of 'Be Perfect'-driver herkent en meer regie over eigen keuzes wil.",
    url: "https://www.standaardboekhandel.be/zoeken?q=zeven%20eigenschappen%20Covey",
    relevantVoorDrivers: ["Please Others", "Be Perfect"],
    relevantVoorFoci: ["Impact", "Resultaat"],
    doelgroep: ["business", "students"],
    tags: ["leiderschap", "effectiviteit", "prioriteiten", "klassiek"],
  },
  {
    titel: "Dare to Lead: Durf te leiden",
    auteur: "Brené Brown",
    jaar: 2018,
    beschrijving:
      "Over moedig leiderschap, kwetsbaarheid en vertrouwen op de werkvloer. Bijzonder waardevol bij een 'Be Strong'-driver: kracht tonen door je open te stellen.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Dare%20to%20Lead%20Brown",
    relevantVoorDrivers: ["Be Strong", "Please Others"],
    relevantVoorFoci: ["Impact", "Artistiek Innovatief"],
    doelgroep: ["business"],
    tags: ["leiderschap", "kwetsbaarheid", "vertrouwen", "moed"],
  },
  {
    titel: "Atomic Habits: Elke dag 1% beter",
    auteur: "James Clear",
    jaar: 2018,
    beschrijving:
      "Hoe kleine, systematische gewoontes leiden tot grote resultaten. Praktisch kader voor duurzame verandering — sterk bij 'Try Hard' en 'Be Perfect'.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Atomic%20Habits%20Clear",
    relevantVoorDrivers: ["Try Hard", "Be Perfect"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Resultaat"],
    doelgroep: ["business", "students"],
    tags: ["gewoontes", "gedragsverandering", "systemen", "groei"],
  },
  {
    titel: "Flow: De psychologie van de optimale ervaring",
    auteur: "Mihaly Csikszentmihalyi",
    jaar: 1990,
    beschrijving:
      "Het baanbrekende werk over de flow-staat: volledig opgaan in wat je doet. Helpt begrijpen wanneer je energie stijgt en hoe je die staat vaker bereikt.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Flow%20Csikszentmihalyi",
    relevantVoorDrivers: ["Be Perfect", "Try Hard"],
    relevantVoorFoci: ["Functioneel Innovatief", "Artistiek Innovatief"],
    doelgroep: ["business", "students"],
    tags: ["flow", "motivatie", "energie", "psychologie"],
  },
  {
    titel: "Verbindende communicatie (Nonviolent Communication)",
    auteur: "Marshall B. Rosenberg",
    jaar: 2003,
    beschrijving:
      "Een taal van empathie en helderheid voor betere gesprekken, ook onder spanning. Waardevol bij 'Please Others' en in elke context waar samenwerken centraal staat.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Verbindende%20communicatie%20Rosenberg",
    relevantVoorDrivers: ["Please Others", "Be Strong"],
    relevantVoorFoci: ["Impact", "Artistiek Innovatief"],
    doelgroep: ["business", "students"],
    tags: ["communicatie", "empathie", "samenwerken", "conflict"],
  },
  {
    titel: "Ik denk te veel: Hoe je hooggevoeligheid en overdenken hanteert",
    auteur: "Christel Petitcollin",
    jaar: 2010,
    beschrijving:
      "Voor wie veel piekert of streng is voor zichzelf: inzichten om het hoofd tot rust te brengen en overdenken om te zetten in helderheid. Sterk bij 'Be Perfect'.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Ik%20denk%20te%20veel%20Petitcollin",
    relevantVoorDrivers: ["Be Perfect", "Please Others"],
    relevantVoorFoci: ["Complexiteit/Conceptueel"],
    doelgroep: ["business", "students"],
    tags: ["overdenken", "rust", "zelfkritiek", "welzijn"],
  },
  {
    titel: "Range: Waarom generalisten het beter doen in een gespecialiseerde wereld",
    auteur: "David Epstein",
    jaar: 2019,
    beschrijving:
      "Hoe brede ervaring, experimenteren en late specialisatie tot sterkere resultaten leiden. Bemoedigend voor studenten en zoekende professionals met een breed profiel.",
    url: "https://www.standaardboekhandel.be/zoeken?q=Range%20Epstein",
    relevantVoorDrivers: ["Try Hard", "Hurry Up"],
    relevantVoorFoci: ["Complexiteit/Conceptueel", "Functioneel Innovatief"],
    doelgroep: ["students", "business"],
    tags: ["loopbaan", "ontwikkeling", "generalist", "keuzes"],
  },
];

// ---------------------------------------------------------------------------
// PODCASTS — professionele ontwikkeling, werk, studie, groei
// ---------------------------------------------------------------------------
export const DEELNEMER_PODCASTS: DeelnemerPodcastItem[] = [
  {
    naam: "WerkVerkenners",
    podcast: "WerkVerkenners (De Tijd)",
    beschrijving:
      "Vlaamse podcast over werk, loopbaan en de toekomst van organisaties. Herkenbaar voor professionals in de Belgische context.",
    url: "https://www.tijd.be/podcasts",
    relevantVoorDrivers: ["Be Perfect", "Please Others"],
    doelgroep: ["business"],
    tags: ["werk", "loopbaan", "vlaams", "organisatie"],
  },
  {
    naam: "The Diary of a CEO",
    podcast: "The Diary of a CEO",
    aflevering: "Steven Bartlett",
    beschrijving:
      "Diepte-interviews met ondernemers, wetenschappers en leiders over prestatie, tegenslag en groei. Toegankelijk en confronterend — sterk bij 'Try Hard' en 'Be Strong'.",
    url: "https://stevenbartlett.com/the-diary-of-a-ceo-podcast/",
    relevantVoorDrivers: ["Try Hard", "Be Strong"],
    doelgroep: ["business", "students"],
    tags: ["ondernemen", "groei", "interviews", "prestatie"],
  },
  {
    naam: "WorkLife with Adam Grant",
    podcast: "WorkLife",
    aflevering: "Adam Grant (TED)",
    beschrijving:
      "Organisatiepsycholoog Adam Grant onderzoekt hoe werk beter, zinvoller en menselijker kan. Wetenschappelijk onderbouwd en praktisch.",
    url: "https://www.ted.com/podcasts/worklife",
    relevantVoorDrivers: ["Be Perfect", "Please Others"],
    doelgroep: ["business", "students"],
    tags: ["werk", "psychologie", "samenwerken", "wetenschap"],
  },
  {
    naam: "The Mindset Mentor",
    podcast: "The Mindset Mentor",
    aflevering: "Rob Dial",
    beschrijving:
      "Korte, krachtige afleveringen over mindset, motivatie en het doorbreken van mentale barrières. Ideaal als dagelijks mentaal duwtje.",
    url: "https://www.robdial.com/podcast",
    relevantVoorDrivers: ["Try Hard", "Be Perfect"],
    doelgroep: ["business", "students"],
    tags: ["mindset", "motivatie", "dagelijks", "praktisch"],
  },
  {
    naam: "Feel Better, Live More",
    podcast: "Feel Better, Live More",
    aflevering: "Dr. Rangan Chatterjee",
    beschrijving:
      "Over veerkracht, stress, slaap en welzijn — de basis om vol te houden in werk en studie. Warm en toegankelijk, sterk bij 'Be Strong'.",
    url: "https://drchatterjee.com/podcast/",
    relevantVoorDrivers: ["Be Strong", "Hurry Up"],
    doelgroep: ["business", "students"],
    tags: ["welzijn", "veerkracht", "stress", "gezondheid"],
  },
  {
    naam: "Studeren doe je zo",
    podcast: "Studeren & Studentenleven",
    beschrijving:
      "Praktische tips over studeren, plannen, motivatie en het combineren van studie met de rest van je leven. Op maat van studenten (18+).",
    url: null,
    relevantVoorDrivers: ["Hurry Up", "Try Hard"],
    doelgroep: ["students"],
    tags: ["studeren", "planning", "motivatie", "student"],
  },
  {
    naam: "On Purpose with Jay Shetty",
    podcast: "On Purpose",
    aflevering: "Jay Shetty",
    beschrijving:
      "Gesprekken over doel, betekenis en mentale stabiliteit. Warm en diepgaand — waardevol bij een 'Please Others'-driver en bij zoektochten naar richting.",
    url: "https://jayshetty.me/podcast/",
    relevantVoorDrivers: ["Please Others", "Try Hard"],
    doelgroep: ["business", "students"],
    tags: ["doel", "betekenis", "stabiliteit", "groei"],
  },
  {
    naam: "Coaching for Leaders",
    podcast: "Coaching for Leaders",
    aflevering: "Dave Stachowiak",
    beschrijving:
      "Concrete, onderbouwde afleveringen over leiderschap, feedback en samenwerken. Praktisch voor professionals die groeien in een leidende rol.",
    url: "https://coachingforleaders.com/",
    relevantVoorDrivers: ["Be Perfect", "Please Others"],
    doelgroep: ["business"],
    tags: ["leiderschap", "coaching", "feedback", "werk"],
  },
  {
    naam: "Ten Percent Happier",
    podcast: "Ten Percent Happier",
    aflevering: "Dan Harris",
    beschrijving:
      "Over mindfulness, omgaan met stress en de innerlijke criticus — zonder zweverigheid. Sterk bij 'Be Perfect' en veel piekeren.",
    url: "https://www.tenpercent.com/podcast",
    relevantVoorDrivers: ["Be Perfect", "Be Strong"],
    doelgroep: ["business", "students"],
    tags: ["mindfulness", "stress", "zelfkritiek", "welzijn"],
  },
  {
    naam: "The Tim Ferriss Show",
    podcast: "The Tim Ferriss Show",
    aflevering: "diverse afleveringen over gewoontes en prestaties",
    beschrijving:
      "Tim Ferriss deconstrueert de routines en systemen van toppresteerders uit alle domeinen. Interessant voor wie eigen werkwijzen wil aanscherpen.",
    url: "https://tim.blog/podcast/",
    relevantVoorDrivers: ["Be Perfect", "Hurry Up", "Try Hard"],
    doelgroep: ["business", "students"],
    tags: ["routines", "systemen", "prestatie", "interviews"],
  },
];

// ---------------------------------------------------------------------------
// Adaptieve selectie op basis van het generatorContract (driver + foci)
// ---------------------------------------------------------------------------

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

export type Doelgroep = "business" | "students" | "teens";

function parseContract(raw: unknown): any | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj?.contract ?? obj;
}

function topDriver(contract: any): string | null {
  const rows: ConstructRow[] = contract?.sections?.main?.constructRows ?? [];
  const drivers = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net);
  return drivers[0]?.construct ?? null;
}

function topFoci(contract: any): string[] {
  const rows: ConstructRow[] = contract?.sections?.main?.constructRows ?? [];
  return rows
    .filter((r) => r.family === "Talent-foci")
    .sort((a, b) => b.net - a.net)
    .slice(0, 3)
    .map((r) => r.construct);
}

function pastBijDoelgroep(
  item: { doelgroep: Array<"business" | "students"> },
  doelgroep: Doelgroep,
): boolean {
  // teens krijgen geen 18+ bibliotheek (gating gebeurt ook op de route)
  if (doelgroep === "teens") return false;
  return item.doelgroep.includes(doelgroep);
}

export function getDeelnemerBibliotheek(
  contractRaw: unknown,
  doelgroep: Doelgroep = "business",
): DeelnemerBibliotheekItem[] {
  const relevante = DEELNEMER_BOEKEN.filter((b) => pastBijDoelgroep(b, doelgroep));
  const contract = parseContract(contractRaw);
  if (!contract) return relevante;
  const driver = topDriver(contract);
  const foci = topFoci(contract);
  // Sorteer: meest relevant eerst (bevat driver en/of focus)
  return [...relevante].sort((a, b) => {
    const scoreA =
      (driver && a.relevantVoorDrivers.includes(driver) ? 2 : 0) +
      foci.filter((f) => a.relevantVoorFoci.includes(f)).length;
    const scoreB =
      (driver && b.relevantVoorDrivers.includes(driver) ? 2 : 0) +
      foci.filter((f) => b.relevantVoorFoci.includes(f)).length;
    return scoreB - scoreA;
  });
}

export function getDeelnemerPodcasts(
  contractRaw: unknown,
  doelgroep: Doelgroep = "business",
): DeelnemerPodcastItem[] {
  const relevante = DEELNEMER_PODCASTS.filter((p) => pastBijDoelgroep(p, doelgroep));
  const contract = parseContract(contractRaw);
  if (!contract) return relevante;
  const driver = topDriver(contract);
  return [...relevante].sort((a, b) => {
    const scoreA = driver && a.relevantVoorDrivers.includes(driver) ? 1 : 0;
    const scoreB = driver && b.relevantVoorDrivers.includes(driver) ? 1 : 0;
    return scoreB - scoreA;
  });
}
