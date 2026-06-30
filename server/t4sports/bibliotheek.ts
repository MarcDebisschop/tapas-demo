// server/t4sports/bibliotheek.ts
// Statische bibliotheek van boeken en podcasts relevant voor mental coaching topsport.
// Gefilterd op basis van het driver- en focusprofiel van de atleet.

export interface BibliotheekItem {
  titel: string;
  auteur: string;
  jaar: number;
  beschrijving: string;
  url: string | null;
  relevantVoorDrivers: string[];
  relevantVoorFoci: string[];
  tags: string[];
}

export interface PodcastItem {
  naam: string;
  podcast: string;
  aflevering?: string;
  beschrijving: string;
  url: string | null;
  relevantVoorDrivers: string[];
  tags: string[];
}

export const BOEKEN: BibliotheekItem[] = [
  {
    titel: "The Inner Game of Tennis",
    auteur: "W. Timothy Gallwey",
    jaar: 1974,
    beschrijving:
      "Het klassieke werk over de mentale dimensie van sport: hoe innerlijke twijfel, zelfkritiek en controledrang prestaties saboteert. Tijdloos voor elke atleet.",
    url: "https://www.goodreads.com/book/show/905.The_Inner_Game_of_Tennis",
    relevantVoorDrivers: ["Be Perfect", "Be Strong", "Try Hard"],
    relevantVoorFoci: ["Functioneel Innovatief", "Artistiek Innovatief"],
    tags: ["mental coaching", "focus", "flow", "klassiek"],
  },
  {
    titel: "Mindset: The New Psychology of Success",
    auteur: "Carol S. Dweck",
    jaar: 2006,
    beschrijving:
      "De groeimindset versus de vaste mindset: hoe je gelooft over talent en inspanning bepaalt alles. Essentieel voor atleten die hun plafond willen doorbreken.",
    url: "https://www.goodreads.com/book/show/40745.Mindset",
    relevantVoorDrivers: ["Be Perfect", "Try Hard"],
    relevantVoorFoci: ["Complexiteit/Conceptueel", "Systematisch/Uitvoerend"],
    tags: ["groeimindset", "talent", "leren", "psychologie"],
  },
  {
    titel: "Bounce: The Myth of Talent and the Power of Practice",
    auteur: "Matthew Syed",
    jaar: 2010,
    beschrijving:
      "Syed, voormalig tafeltennis-kampioenen, ontmantelt de mythe van aangeboren talent en toont hoe deliberate practice het echte verschil maakt.",
    url: "https://www.goodreads.com/book/show/7870407-bounce",
    relevantVoorDrivers: ["Be Perfect", "Hurry Up"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Complexiteit/Conceptueel"],
    tags: ["deliberate practice", "talent", "sport", "verbetering"],
  },
  {
    titel: "The Champion's Mind: How Great Athletes Think, Train, and Thrive",
    auteur: "Jim Afremow",
    jaar: 2013,
    beschrijving:
      "Sportpsycholoog Afremow deelt concrete mentale strategieën van topsporters: focusrituelen, visualisatie, presteren onder druk, doelen stellen.",
    url: "https://www.goodreads.com/book/show/18602347-the-champion-s-mind",
    relevantVoorDrivers: ["Be Perfect", "Be Strong", "Please Others"],
    relevantVoorFoci: ["Impact", "Resultaat"],
    tags: ["mental coaching", "topsport", "druk", "focus"],
  },
  {
    titel: "With Winning in Mind",
    auteur: "Lanny Bassham",
    jaar: 1995,
    beschrijving:
      "Olympisch schutter Bassham beschrijft zijn Mental Management System: hoe het zelfbeeld, het bewuste denken en het onderbewuste samenwerken voor optimale prestatie.",
    url: "https://www.goodreads.com/book/show/6505104-with-winning-in-mind",
    relevantVoorDrivers: ["Be Perfect", "Be Strong"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Resultaat"],
    tags: ["zelfbeeld", "mentale training", "olympisch", "focus"],
  },
  {
    titel: "Choke: What the Secrets of the Brain Reveal About Getting It Right When You Have To",
    auteur: "Sian Beilock",
    jaar: 2010,
    beschrijving:
      "Neurowetenschapper Beilock legt uit waarom atleten (en anderen) falen in cruciale momenten en hoe je dat voorkomt. Wetenschappelijk onderbouwd en praktisch.",
    url: "https://www.goodreads.com/book/show/6397343-choke",
    relevantVoorDrivers: ["Be Perfect", "Hurry Up", "Please Others", "Be Strong"],
    relevantVoorFoci: ["Complexiteit/Conceptueel", "Systematisch/Uitvoerend"],
    tags: ["druk", "neurowetenschappen", "falen", "kritieke momenten"],
  },
  {
    titel: "Finding Your Zone: Ten Core Lessons for Achieving Peak Performance in Sports and Life",
    auteur: "Michael Lardon",
    jaar: 2008,
    beschrijving:
      "Dr. Lardon, sportpsycholoog van elite-golfers, deelt tien universele lessen over het bereiken van de flow-zone. Toegankelijk en direct toepasbaar.",
    url: "https://www.goodreads.com/book/show/3046578-finding-your-zone",
    relevantVoorDrivers: ["Be Perfect", "Be Strong", "Hurry Up", "Please Others", "Try Hard"],
    relevantVoorFoci: ["Functioneel Innovatief", "Impact"],
    tags: ["zone", "flow", "peak performance", "sport"],
  },
  {
    titel: "The Mental Edge",
    auteur: "Kenneth Baum",
    jaar: 1999,
    beschrijving:
      "Baum leert topsporters hoe ze hun innerlijke criticus kunnen omzetten in een constructieve innerlijke coach. Praktische oefeningen voor elke sport.",
    url: "https://www.goodreads.com/book/show/1000551.The_Mental_Edge",
    relevantVoorDrivers: ["Be Perfect", "Try Hard", "Please Others"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Resultaat"],
    tags: ["innerlijke criticus", "zelfcoaching", "sport", "mentale training"],
  },
  {
    titel: "Relentless: From Good to Unstoppable",
    auteur: "Tim S. Grover",
    jaar: 2013,
    beschrijving:
      "De trainer van Michael Jordan en Kobe Bryant beschrijft de onverbiddelijke mentaliteit van de absolute top. Rauw, direct en niet voor iedereen.",
    url: "https://www.goodreads.com/book/show/16158498-relentless",
    relevantVoorDrivers: ["Be Strong", "Try Hard"],
    relevantVoorFoci: ["Resultaat", "Impact"],
    tags: ["elite mindset", "doorzettingsvermogen", "topsport", "intensity"],
  },
  {
    titel: "The Art of Mental Training: A Guide to Performance Excellence",
    auteur: "DC Gonzalez",
    jaar: 2013,
    beschrijving:
      "Een compacte gids over de mentale training van topsporters, met focus op visualisatie, concentratie, omgaan met faalangst en het activeren van de ideale prestatiestaat.",
    url: "https://www.goodreads.com/book/show/20937490-the-art-of-mental-training",
    relevantVoorDrivers: ["Be Perfect", "Hurry Up"],
    relevantVoorFoci: ["Systematisch/Uitvoerend", "Functioneel Innovatief"],
    tags: ["visualisatie", "concentratie", "mentale training", "sport"],
  },
];

export const PODCASTS: PodcastItem[] = [
  {
    naam: "Finding Mastery with Dr. Michael Gervais",
    podcast: "Finding Mastery",
    beschrijving:
      "Sportpsycholoog Michael Gervais interviewt de beste presteerders ter wereld — atleten, militairen, kunstenaars — over de mentale architectuur achter uitmuntende prestaties.",
    url: "https://findingmastery.com/podcasts/",
    relevantVoorDrivers: ["Be Perfect", "Be Strong", "Try Hard"],
    tags: ["mental coaching", "peak performance", "interviews", "topsport"],
  },
  {
    naam: "The High Performance Podcast",
    podcast: "High Performance",
    aflevering: "Jake Humphrey & Professor Damian Hughes",
    beschrijving:
      "Jake Humphrey en Professor Damian Hughes onderzoeken wat de beste sporters, coaches en leiders gemeen hebben. Wetenschappelijk onderbouwd, maar toegankelijk.",
    url: "https://www.thehighperformancepodcast.com/",
    relevantVoorDrivers: ["Be Perfect", "Please Others"],
    tags: ["high performance", "sport", "leiderschap", "psychologie"],
  },
  {
    naam: "The Mindset Mentor",
    podcast: "The Mindset Mentor",
    aflevering: "Rob Dial",
    beschrijving:
      "Rob Dial deelt wekelijks korte, krachtige lessen over mindset, motivatie en het overwinnen van mentale barrières. Ideaal als dagelijks mentaal eten.",
    url: "https://www.robdial.com/podcast",
    relevantVoorDrivers: ["Try Hard", "Be Perfect"],
    tags: ["mindset", "motivatie", "dagelijks", "praktisch"],
  },
  {
    naam: "The Sports Psychology Podcast",
    podcast: "The Sports Psychology Podcast",
    aflevering: "Dr. Patrick Cohn",
    beschrijving:
      "Dr. Patrick Cohn behandelt de meest voorkomende mentale uitdagingen in sport: presteren onder druk, choking, faalangst, perfectieproblemen en zelfvertrouwen.",
    url: "https://www.peaksports.com/sports-psychology-blog/sports-psychology-podcast/",
    relevantVoorDrivers: ["Be Perfect", "Please Others", "Be Strong"],
    tags: ["sportpsychologie", "zelfvertrouwen", "druk", "praktisch"],
  },
  {
    naam: "The Tim Ferriss Show — Sport en performance-afleveringen",
    podcast: "The Tim Ferriss Show",
    aflevering: "diverse afleveringen met topsporters (Novak Djokovic, Arnold Schwarzenegger, etc.)",
    beschrijving:
      "Tim Ferriss deconstrueert de routines en mentale systemen van wereld-toppresteerders. Bijzonder interessant: de afleveringen over atleten en hun mental game.",
    url: "https://tim.blog/podcast/",
    relevantVoorDrivers: ["Be Perfect", "Hurry Up", "Try Hard"],
    tags: ["toppresteerders", "routines", "mental game", "deconstruct"],
  },
  {
    naam: "Unlocking Us with Brené Brown — Kwetsbaarheid in sport",
    podcast: "Unlocking Us",
    aflevering: "Brené Brown",
    beschrijving:
      "Brené Brown's werk over kwetsbaarheid, schaamte en moed is bijzonder relevant voor atleten met een Be Strong-profiel. Haar gesprekken met sporters zijn krachtig.",
    url: "https://brenebrown.com/podcast-show/unlocking-us/",
    relevantVoorDrivers: ["Be Strong", "Please Others"],
    tags: ["kwetsbaarheid", "moed", "authenticiteit", "sport"],
  },
  {
    naam: "The Psychology of Sports Podcast",
    podcast: "Sports Psychology Insights",
    beschrijving:
      "Een diepgaande kijk op de psychologische mechanismen achter sportprestaties: flow, motivatietheorie, zelfregulatie en de rol van coaching.",
    url: null,
    relevantVoorDrivers: ["Be Perfect", "Hurry Up"],
    tags: ["psychologie", "flow", "motivatie", "coaching"],
  },
  {
    naam: "The Resilience Project",
    podcast: "The Resilience Project",
    aflevering: "Hugh van Cuylenburg",
    beschrijving:
      "Onderzoekers en topsporters bespreken veerkracht, dankbaarheid en mentale gezondheid. Sterk aanbevolen voor atleten die zich mentaal willen versterken.",
    url: "https://theresilienceproject.com.au/podcast/",
    relevantVoorDrivers: ["Try Hard", "Please Others"],
    tags: ["veerkracht", "mentale gezondheid", "dankbaarheid", "sport"],
  },
  {
    naam: "Inside the Mind of a Champion",
    podcast: "The Athletic",
    beschrijving:
      "Investigatieve sportjournalistiek over de mentale mechanismen achter sportdynasties en individuele topsporters. Combineert diepte-interviews met analyse.",
    url: "https://theathletic.com/podcasts/",
    relevantVoorDrivers: ["Be Strong", "Try Hard"],
    tags: ["topsport", "mentale veerkracht", "kampioen", "analyse"],
  },
  {
    naam: "On Purpose with Jay Shetty — Sport & purpose",
    podcast: "On Purpose",
    aflevering: "Jay Shetty",
    beschrijving:
      "Jay Shetty brengt wijsheid van zijn monnik-jaren naar gesprekken met topsporters over doel, betekenis en mentale stabiliteit. Warm en diepgaand.",
    url: "https://jayshetty.me/podcast/",
    relevantVoorDrivers: ["Please Others", "Try Hard"],
    tags: ["doel", "betekenis", "mentale stabiliteit", "sport"],
  },
];

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

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
  return rows.filter((r) => r.family === "Talent-foci").sort((a, b) => b.net - a.net).slice(0, 3).map((r) => r.construct);
}

export function getAthleteBibliotheek(contractRaw: unknown): BibliotheekItem[] {
  const contract = parseContract(contractRaw);
  if (!contract) return BOEKEN;
  const driver = topDriver(contract);
  const foci = topFoci(contract);
  // Sorteer: meest relevant eerst (bevat driver en/of focus)
  return [...BOEKEN].sort((a, b) => {
    const scoreA =
      (driver && a.relevantVoorDrivers.includes(driver) ? 2 : 0) +
      foci.filter((f) => a.relevantVoorFoci.includes(f)).length;
    const scoreB =
      (driver && b.relevantVoorDrivers.includes(driver) ? 2 : 0) +
      foci.filter((f) => b.relevantVoorFoci.includes(f)).length;
    return scoreB - scoreA;
  });
}

export function getAthletePodcasts(contractRaw: unknown): PodcastItem[] {
  const contract = parseContract(contractRaw);
  if (!contract) return PODCASTS;
  const driver = topDriver(contract);
  return [...PODCASTS].sort((a, b) => {
    const scoreA = driver && a.relevantVoorDrivers.includes(driver) ? 1 : 0;
    const scoreB = driver && b.relevantVoorDrivers.includes(driver) ? 1 : 0;
    return scoreB - scoreA;
  });
}
