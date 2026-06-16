// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Profielassistent-engine (demo, zonder externe LLM).
//
// WAAROM DEZE ENGINE BESTAAT
// In de gepubliceerde demo is er geen live taalmodel beschikbaar. Toch moet de
// assistent ECHT op de vraag reageren: een begripsvraag ("wat is een driver?")
// verdient een andere uitleg dan een energievraag of een taakkeuze. Deze engine
// doet dat deterministisch:
//   1. parseProfiel()  -> haalt de ECHTE cijfers/namen uit het generator-contract
//   2. herkenIntentie() -> classificeert de vraag (meertalig, trefwoord + regex)
//   3. beantwoord()     -> bouwt een antwoord uit een GECUREERDE kennisbank,
//                          ingevuld met de echte profieldata van deze persoon.
//
// GARANTIE: geen hallucinaties. Elk feit komt OFWEL uit de kennisbank (vaste,
// correcte uitleg) OFWEL uit het contract (echte meting). Er wordt nooit een
// cijfer of talent verzonnen. Onbekende vragen krijgen een eerlijk antwoord.
//
// PRINCIPE: interne vaktermen lekken niet. "Driver(s)" blijft beschermd en
// onvertaald (naar Taibi Kahler) — dat is bewust en mag uitgelegd worden.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import { isTapasBeeld } from "@shared/talent-constructs";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal): string => m[t] ?? m.nl;

// --- 1. PROFIELFEITEN -------------------------------------------------------

interface Construct {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

export interface ProfielFeiten {
  heeftProfiel: boolean;
  naam: string | null;
  // Gesorteerd, sterkste eerst.
  foci: Construct[];
  versnellers: Construct[];
  drivers: Construct[];
  // Drivers die energie KOSTEN (negatieve avgEnergy), zwaarste eerst.
  driversEnergieverlies: Construct[];
  // TaPas-Beeld = identiteits-/zelfbeeldlens. NOOIT in de foci-rangschikking,
  // maar de INHOUD ervan (hoe iemand IS / zichzelf ziet) mag wel diep bevraagd
  // worden. Daarom apart bewaard, los van foci[].
  tapasBeeld: Construct | null;
  driverTopNet: Construct | null; // sterkst aanwezige driver (hoogste net)
  driverLabel: string; // laag | matig | hoog
  energieVragenlijst: number; // 0-10
  baseline: number; // 0-10 (eigen inschatting vooraf)
  discrepantie: number; // baseline - gemeten (richtbaar)
  herkenbaarheid: number | null; // 0-100
  // VERBATIM BEWIJS: de letterlijke vragenlijst-uitspraken die de deelnemer het
  // sterkst onderschreef, per driver-construct (meertalig). Dit is de rijkste,
  // meest persoonlijke en gegarandeerd hallucinatie-vrije bron: het zijn de
  // eigen woorden van de deelnemer. Sleutel = constructnaam (bv. "Be Perfect").
  driverItems: Record<string, ML[]>;
}

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

export function parseProfiel(contractRaw: unknown, naam?: string | null): ProfielFeiten {
  let contract: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      contract = JSON.parse(contractRaw);
    } catch {
      contract = null;
    }
  }
  const main = contract?.sections?.main;
  if (!main) {
    return {
      heeftProfiel: false,
      naam: naam && naam !== "(nog niet ingevuld)" ? naam : null,
      foci: [],
      versnellers: [],
      drivers: [],
      driversEnergieverlies: [],
      tapasBeeld: null,
      driverTopNet: null,
      driverLabel: "laag",
      energieVragenlijst: 5,
      baseline: 5,
      discrepantie: 0,
      herkenbaarheid: null,
      driverItems: {},
    };
  }

  const rows: Construct[] = Array.isArray(main.constructRows)
    ? main.constructRows.map((r: any) => ({
        construct: String(r.construct ?? ""),
        family: String(r.family ?? ""),
        net: num(r.net),
        avgEnergy: num(r.avgEnergy),
      }))
    : [];

  // "TaPas-Beeld" is een interne controle-/kalibratie-/identiteitsconstruct,
  // geen echt talent voor de deelnemer. Nooit als focus tonen in de assistent
  // (in welke schrijfwijze dan ook — centraal afgevangen).
  const byFam = (fam: string) =>
    rows
      .filter((r) => r.family === fam && !isTapasBeeld(r.construct))
      .sort((a, b) => b.net - a.net);

  const foci = byFam("Talent-foci");
  const versnellers = byFam("Talent-versnellers");
  const drivers = byFam("Drivers");
  // TaPas-Beeld apart bewaren voor INHOUDELIJKE bevraging (nooit als focus).
  const tapasBeeld = rows.find((r) => isTapasBeeld(r.construct)) ?? null;
  const driversEnergieverlies = [...drivers]
    .filter((d) => d.avgEnergy < 0)
    .sort((a, b) => a.avgEnergy - b.avgEnergy);

  const meta = main.meta ?? {};
  const dr = meta.driverRisk ?? {};
  const cons = meta.consistency ?? {};

  // Verbatim onderschreven uitspraken per driver verzamelen. Ze zitten zowel in
  // meta.driverRisk.top[].mostItems als in meta.consistency.topDrivers[].mostItems.
  // We dedupliceren op constructnaam en bewaren de meertalige item-objecten.
  const driverItems: Record<string, ML[]> = {};
  const verzamelItems = (lijst: unknown) => {
    if (!Array.isArray(lijst)) return;
    for (const d of lijst as any[]) {
      const naam = String(d?.construct ?? "").trim();
      if (!naam) continue;
      const items = Array.isArray(d?.mostItems) ? d.mostItems : [];
      if (items.length === 0) continue;
      // Alleen geldige meertalige item-objecten (met minstens nl-tekst) bewaren.
      const geldig = items.filter(
        (it: any) => it && typeof it === "object" && typeof it.nl === "string" && it.nl.trim(),
      ) as ML[];
      if (geldig.length && !driverItems[naam]) driverItems[naam] = geldig;
    }
  };
  verzamelItems(dr.top);
  verzamelItems(cons.topDrivers);

  return {
    heeftProfiel: true,
    naam: naam && naam !== "(nog niet ingevuld)" ? naam : null,
    foci,
    versnellers,
    drivers,
    driversEnergieverlies,
    tapasBeeld,
    driverTopNet: drivers.length ? drivers[0]! : null,
    driverLabel: String(dr.label ?? "laag"),
    energieVragenlijst: num(meta.normalizedQuestionnaireEnergy, 5),
    baseline: num(meta.baselineProfessionalEnergy, 5),
    discrepantie: num(meta.energyDiscrepancy, 0),
    herkenbaarheid: typeof cons.score === "number" ? cons.score : null,
    driverItems,
  };
}

// --- 2. INTENTIE-HERKENNING -------------------------------------------------

export type Intentie =
  | "existentieel"
  | "wat_is_driver"
  | "wat_is_talentfocus"
  | "wat_is_versneller"
  | "wat_is_energie"
  | "wat_is_tapas"
  | "tapasbeeld_inhoud"
  | "volgorde_uitleg"
  | "mijn_energie"
  | "mijn_talenten"
  | "mijn_drivers"
  | "driver_onder_druk"
  | "toekomst_loopbaan"
  | "taak_advies"
  | "ontwikkelen_groeien"
  | "verschil_zelfbeeld"
  | "samenwerken_team"
  | "coach"
  | "betekenis_score"
  | "verdieping"
  | "groet"
  | "dankjewel"
  | "onbekend";

// Trefwoorden per intentie. Meertalig; we matchen lowercase, accent-ongevoelig.
// Volgorde = prioriteit: specifieke "wat is X" vóór algemene "mijn X".
const PATRONEN: { intentie: Intentie; sleutels: string[] }[] = [
  // ZORG-KOMPAS (laag B): existentiële / onderliggende uitspraken krijgen
  // ABSOLUTE voorrang. Dit zijn signalen die om een echt menselijk gesprek
  // vragen — de assistent stelt GEEN diagnose en verwijst warm en onmiddellijk
  // door naar de dichtstbijzijnde coach. Bewust ruim geformuleerd (meertalig).
  {
    intentie: "existentieel",
    sleutels: [
      // NL — zinloosheid / leegte / vastlopen / eigenwaarde / wanhoop / uitputting
      "geen zin meer", "zinloos", "geen zin in het leven", "waarom leef ik", "waarom besta ik",
      "geen reden om", "het heeft geen zin", "leeg van binnen", "voel me leeg", "voel me nutteloos",
      "ik ben niets waard", "niets waard", "waardeloos", "er niet meer toe doen", "er niet meer zijn",
      "wil er niet meer zijn", "niet meer verder", "het lukt me niet meer", "ik kan niet meer",
      "ik trek het niet meer", "helemaal op", "volledig opgebrand", "opgebrand", "burn-out", "burnout",
      "depressie", "depressief", "angstig", "paniek", "wanhopig", "wanhoop", "huil de hele tijd",
      "alles is donker", "geen uitweg", "vast in mijn hoofd", "wat is de zin van", "zin van mijn leven",
      "wat is de bedoeling van mijn leven", "er is geen toekomst", "bang voor de toekomst",
      "voel me alleen", "helemaal alleen", "niemand begrijpt me", "ik ben verloren", "voel me verloren",
      "einde aan mijn leven", "niet meer leven", "zelfmoord", "er een einde aan maken",
      // NL extra (uit gebruikstests): losse signaalwoorden + frasen
      "radeloos", "ten einde raad", "uitgeput", "volledig uitgeput", "compleet uitgeput",
      "kapot", "leeg", "moedeloos", "hopeloos", "uitzichtloos", "eenzaam", "zo eenzaam",
      "voel me eenzaam", "voel me radeloos", "ik weet het niet meer", "weet het niet meer",
      "het gaat niet meer", "ik zie het niet meer zitten", "zie het niet meer zitten",
      "geen energie meer", "alles wordt me te veel", "het wordt me te veel", "kan niet meer slapen",
      "doodmoe", "ik stort in", "stort in", "in de put", "down", "verdriet", "ongelukkig",
      // EN
      "no point", "pointless", "no reason to", "meaning of life", "meaning of my life", "feel empty",
      "empty inside", "worthless", "i am nothing", "can't go on", "cannot go on", "i can't anymore",
      "burnt out", "burned out", "depressed", "depression", "hopeless", "no way out", "want to disappear",
      "end my life", "don't want to live", "so alone", "completely alone", "i feel lost",
      "at my wit s end", "exhausted", "drained", "broken", "hopeless", "helpless",
      "lonely", "so lonely", "i feel lonely", "i feel desperate", "desperate", "despair",
      "i don t know what to do anymore", "i can t take it anymore", "it s all too much",
      "overwhelmed", "i m falling apart", "falling apart", "no energy left", "can t sleep",
      // FR
      "plus de sens", "aucun sens", "a quoi bon", "sens de ma vie", "sens de la vie", "je me sens vide",
      "vide a l interieur", "je ne vaux rien", "je n en peux plus", "je n y arrive plus", "epuise",
      "epuisement", "deprime", "depression", "desespere", "desespoir", "plus d issue", "en finir",
      "je me sens seul", "completement seul", "je suis perdu",
      "a bout", "a bout de force", "epuise", "epuisee", "vide", "brise", "desempare",
      "seul", "tres seul", "je me sens seule", "je ne sais plus quoi faire", "je craque",
      "c est trop", "tout est trop", "deborde", "plus d energie", "je m effondre", "abattu",
      // ES
      "sin sentido", "no tiene sentido", "para que vivir", "sentido de mi vida", "sentido de la vida",
      "me siento vacio", "vacio por dentro", "no valgo nada", "no puedo mas", "agotado", "quemado",
      "deprimido", "depresion", "desesperado", "sin salida", "acabar con mi vida", "me siento solo",
      "completamente solo", "estoy perdido",
      "al limite", "agotado", "agotada", "exhausto", "vacio", "roto", "desesperado",
      "solo", "muy solo", "me siento solo", "me siento sola", "no se que hacer",
      "ya no puedo", "es demasiado", "todo es demasiado", "desbordado", "sin energia",
      "me derrumbo", "hundido", "abatido",
      // RU (in Cyrillisch én transliteratie via normaliseer niet nodig: matcht ruw)
      "нет смысла", "смысл жизни", "бессмысленно", "пустота внутри", "чувствую пустоту", "я ничего не стою",
      "больше не могу", "выгорание", "выгорел", "депрессия", "безнадежно", "нет выхода", "покончить",
      "не хочу жить", "совсем один", "я потерян",
      "на пределе", "измотан", "истощен", "опустошён", "сломлен", "отчаяние",
      "одиноко", "мне одиноко", "я в отчаянии", "не знаю что делать",
      "всё слишком", "это слишком", "нет сил", "больше нет сил", "не могу спать",
    ],
  },
  // Begripsvragen ("wat is ...") — herkenbaar aan vraagwoord + term.
  {
    intentie: "wat_is_driver",
    sleutels: [
      "wat is een driver", "wat zijn drivers", "wat betekent driver", "wat is driver",
      "uitleg driver", "drivers uitleggen", "what is a driver", "what are drivers",
      "qu'est-ce qu'un driver", "que es un driver", "что такое driver", "что такое драйвер",
      "wat doen drivers", "waarom drivers",
    ],
  },
  {
    intentie: "wat_is_talentfocus",
    sleutels: [
      "wat is een talentfocus", "wat zijn talentfoci", "wat is talentfocus", "wat betekent talentfocus",
      "wat zijn talent-foci", "uitleg talentfocus", "what is a talent focus", "wat is talent",
      "qu'est-ce qu'un focus", "que es un foco de talento",
    ],
  },
  {
    intentie: "wat_is_versneller",
    sleutels: [
      "wat is een versneller", "wat zijn versnellers", "wat is talentversneller", "talent-versneller",
      "versterkend gedrag", "wat betekent versneller", "what is an accelerator", "amplifying behaviour",
    ],
  },
  {
    intentie: "wat_is_energie",
    sleutels: [
      "wat betekent energie", "hoe wordt energie gemeten", "wat is energie in", "energiemeting",
      "hoe meet je energie", "wat zegt energie", "what does energy mean", "energie score uitleg",
    ],
  },
  // TaPas-Beeld INHOUD: vragen over "wie ben ik / hoe ben ik / mijn zelfbeeld /
  // mijn identiteit". TaPas-Beeld is GEEN talent-focus en mag NOOIT in de
  // foci-volgorde verschijnen, maar de inhoud (hoe iemand IS) is wezenlijk en
  // mag diep bevraagd worden. MOET vóór wat_is_tapas en mijn_talenten staan,
  // anders kaapt "tapas" of "mijn" de vraag.
  {
    intentie: "tapasbeeld_inhoud",
    sleutels: [
      // NL
      "tapasbeeld", "tapas-beeld", "tapas beeld", "wie ben ik", "wie ik ben",
      "hoe ben ik", "hoe ik ben", "mijn zelfbeeld", "zelfbeeld", "mijn identiteit",
      "wat zegt tapasbeeld", "wat betekent tapasbeeld", "mijn beeld van mezelf",
      "hoe zie ik mezelf", "wie ik werkelijk ben", "mijn innerlijk beeld",
      "wat voor iemand ben ik", "wat voor persoon ben ik",
      // EN
      "tapas image", "self-image", "self image", "who am i", "who i am",
      "how am i", "my identity", "what kind of person am i", "image of myself",
      // FR
      "image de soi", "qui suis je", "qui je suis", "mon identite", "image tapas",
      "quel genre de personne suis je", "image de moi meme",
      // ES
      "imagen de mi", "imagen propia", "quien soy", "quien soy yo", "mi identidad",
      "que tipo de persona soy", "imagen tapas",
      // RU
      "образ себя", "кто я", "моя идентичность", "какой я человек", "представление о себе",
    ],
  },
  {
    intentie: "wat_is_tapas",
    sleutels: [
      "wat is tapas", "wat doet tapas", "hoe werkt tapas", "wat is dit profiel", "waar gaat dit over",
      "what is tapas", "qu'est-ce que tapas", "hoe is dit gemeten", "wat meet dit",
    ],
  },
  {
    intentie: "betekenis_score",
    sleutels: [
      "wat betekent mijn score", "hoe lees ik", "wat betekenen de cijfers", "wat betekent net",
      "hoe interpreteer ik", "wat zeggen de getallen", "what do the numbers mean", "betekenis cijfers",
    ],
  },
  // Toekomst / loopbaan: "wat zou ik vanuit mijn talenten kunnen doen". MOET
  // vóór mijn_talenten/taak_advies/ontwikkelen_groeien staan, anders kaapt
  // "mijn talenten", "wat zou ik" of "groei" de vraag. Leidt richtingen logisch
  // af uit het profiel zonder jobtitels te verzinnen.
  {
    intentie: "toekomst_loopbaan",
    sleutels: [
      "toekomst", "toekomstig", "in de toekomst", "loopbaan", "carriere", "carriere pad",
      "wat kan ik worden", "wat zou ik kunnen worden", "welke job", "welke jobs", "welk werk",
      "welke functie", "welke functies", "welke rollen passen", "welke richting", "welke richting uit",
      "wat zou ik vanuit mijn talenten", "vanuit mijn talenten", "vanuit mijn talent",
      "wat past bij mijn talenten", "waar zou ik passen", "waar zou ik goed in zijn",
      "volgende stap", "volgende stap in mijn loopbaan", "andere job", "van job veranderen",
      "heroriente", "herorienteren", "nieuwe uitdaging", "wat ligt voor mij", "wat ligt in mijn lijn",
      "waar kan ik naartoe", "welke kant op", "beroep", "beroepskeuze", "studiekeuze",
      // EN
      "future", "career", "career path", "what could i do", "what could i become", "which job",
      "what job", "what jobs", "which roles", "what role suits", "next step", "new challenge",
      "what fits my talents", "where could i fit", "what direction", "change careers",
      // FR
      "avenir", "futur", "parcours", "quel metier", "quel travail", "quelle voie",
      "que pourrais je faire", "prochaine etape", "quelles fonctions", "reorientation", "nouveau defi",
      "qu est ce que je pourrais faire avec mes talents", "avec mes talents",
      // ES
      "futuro", "carrera", "trayectoria", "que trabajo", "que empleo", "que podria hacer",
      "que camino", "proximo paso", "que funciones", "reorientacion", "nuevo reto", "con mis talentos",
      // RU
      "будущее", "карьера", "карьерный путь", "кем я могу", "какая работа", "какую работу",
      "следующий шаг", "новый вызов", "какое направление", "что я мог бы делать", "с моими талантами",
    ],
  },
  // Persoonlijke vragen (over het eigen profiel).
  {
    intentie: "driver_onder_druk",
    sleutels: [
      "onder druk", "onder stress", "bij stress", "bij druk", "als ik moe", "wanneer het zwaar",
      "omgaan met mijn driver", "drivers onder", "under pressure", "sous pression", "bajo presion",
      "под давлением", "valkuil", "valkuilen", "wat kost mij energie", "energie verlies",
    ],
  },
  {
    intentie: "mijn_energie",
    sleutels: [
      "mijn energie", "waar haal ik energie", "energie uit", "energie haal", "wanneer heb ik energie",
      "waar krijg ik energie", "where do i get energy", "mon energie", "mi energia", "моя энергия",
      "energie stroomt", "geeft mij energie", "geeft me energie", "geeft energie", "krijg ik energie",
      "hoe zit het met mijn energie", "mijn energieniveau", "energie op het werk", "energie geeft",
      "waar zit mijn energie", "wat geeft mij energie", "wat geeft me energie", "energiebron",
      "my energy", "energy level", "how is my energy", "mon niveau d energie", "mon niveau energie",
      "mi nivel de energia", "энергия", "энергию", "моё наполнение энергией",
      "gives me energy", "gives energy", "give me energy", "what energizes", "energizes me",
      "energy at work", "my energy at work", "where does my energy", "source of energy", "energise",
      "donne de l energie", "me donne de l energie", "qu est ce qui me donne de l energie", "mon energie au travail",
      "d ou vient mon energie", "source d energie", "ce qui m energise",
      "me da energia", "que me da energia", "de donde viene mi energia", "mi energia en el trabajo",
      "fuente de energia", "que me energiza",
      "что даёт мне энергию", "что даёт энергию", "откуда моя энергия", "источник энергии",
      "энергия на работе", "что меня заряжает", "даёт энергию",
    ],
  },
  // EXACTE VOLGORDE in mensentaal: "wat is de exacte volgorde van mijn drivers /
  // talent-foci / versnellers en wat betekent dat?". MOET vóór mijn_talenten,
  // mijn_drivers en mijn_energie staan, anders kapen die de vraag. TaPas-Beeld
  // blijft hier ALTIJD buiten de foci-volgorde (alleen echte foci geteld).
  {
    intentie: "volgorde_uitleg",
    sleutels: [
      // NL
      "exacte volgorde", "juiste volgorde", "wat is de volgorde", "in welke volgorde",
      "eerste talent-focus", "eerste talentfocus", "mijn eerste talent", "sterkste talent-focus",
      "welke talent-focus eerst", "welke driver eerst", "welke versneller eerst",
      "eerste driver", "eerste versneller", "first talent focus", "strongest talent focus",
      "premier focus", "primer foco", "первый фокус",
      "volgorde van mijn", "rangschikking", "rangorde", "hoe gerangschikt",
      "van sterk naar zwak", "van hoog naar laag", "wat komt eerst", "welke eerst",
      "volgorde van mijn drivers", "volgorde van mijn talenten", "volgorde van mijn talent-foci",
      "volgorde van mijn versnellers", "wat betekent die volgorde", "wat betekent deze volgorde",
      "leg de volgorde uit", "volgorde uitleggen", "rangschik mijn",
      // EN
      "exact order", "exact ranking", "what is the order", "in what order",
      "order of my", "ranking of my", "rank my", "from strongest to weakest",
      "from high to low", "what comes first", "what does the order mean",
      "explain the order", "sequence of my",
      // FR
      "ordre exact", "quel ordre", "dans quel ordre", "ordre de mes", "classement",
      "du plus fort au plus faible", "qu est ce que cet ordre signifie", "explique l ordre",
      // ES
      "orden exacto", "que orden", "en que orden", "orden de mis", "clasificacion",
      "de mas fuerte a mas debil", "que significa ese orden", "explica el orden",
      // RU
      "точный порядок", "какой порядок", "в каком порядке", "порядок моих", "ранжирование",
      "что означает этот порядок", "объясни порядок",
    ],
  },
  // VERDIEPING / doorvraag. Marc's terechte opmerking: als iemand doorvraagt
  // ("wat betekent dit op een dieper niveau", "ga dieper", "waarom is dat zo",
  // "wat zegt dat over mij") mag de assistent NIET doorverwijzen naar een coach
  // en ook geen generiek taak-advies geven. In plaats daarvan legt hij ZELF de
  // verbanden uit het profiel. Staat NA volgorde_uitleg (dat "wat betekent die
  // volgorde" al opvangt) maar VOOR taak_advies/onbekend.
  {
    intentie: "verdieping",
    sleutels: [
      // NL
      "dieper", "op een dieper niveau", "dieper niveau", "ga dieper", "wat betekent dit dieper",
      "wat betekent dat dieper", "dieper ingaan", "verdiep", "verdieping", "meer diepgang",
      "diepere betekenis", "wat zegt dat over mij", "wat zegt dit over mij", "wat betekent dit voor mij",
      "wat betekent dat voor mij", "wat betekent dit nu echt", "leg dieper uit", "leg eens uit waarom",
      "waarom is dat", "waarom is dat zo", "hoe komt dat", "hoe hangt dat samen", "wat is het verband",
      "welk verband", "leg het verband", "hoe past dit samen", "wat heeft dat met elkaar te maken",
      "kun je dat verbinden", "verbind", "denk dieper", "denk verder", "analyseer dieper",
      "wat zit daarachter", "wat zit hierachter", "achterliggende", "rode draad", "grotere plaatje",
      // EN
      "deeper", "go deeper", "on a deeper level", "deeper level", "what does this mean deeper",
      "deeper meaning", "what does that say about me", "what does this mean for me", "why is that",
      "why is that so", "how come", "how does that connect", "what is the connection", "connect the dots",
      "think deeper", "think harder", "the bigger picture", "underlying", "what is behind this",
      // FR
      "plus profond", "va plus loin", "niveau plus profond", "sens plus profond", "qu est ce que cela dit de moi",
      "qu est ce que cela signifie vraiment", "pourquoi est ce", "pourquoi cela", "quel est le lien",
      "fais le lien", "creuse", "approfondis", "le lien entre", "vue d ensemble",
      // ES
      "mas profundo", "ve mas profundo", "nivel mas profundo", "significado mas profundo",
      "que dice eso de mi", "que significa esto para mi", "por que es asi", "cual es la conexion",
      "conecta", "profundiza", "la relacion entre", "el panorama general",
      // RU
      "глубже", "на более глубоком уровне", "более глубокий смысл", "что это говорит обо мне",
      "что это значит для меня", "почему это так", "какая связь", "свяжи", "копни глубже",
      "связь между", "общая картина",
    ],
  },
  {
    intentie: "mijn_talenten",
    sleutels: [
      "mijn talenten", "mijn sterktes", "waar ben ik goed", "mijn focus", "mijn talentfoci",
      "waar ligt mijn kracht", "my talents", "mes talents", "mis talentos", "мои таланты",
      "mijn sterkste", "wat zijn mijn talenten", "mijn versnellers", "beste talenten", "wat kan ik goed",
      "strongest talents", "strongest talent", "my strengths", "my strength", "talent foci",
      "my accelerators", "talents les plus forts", "mes points forts", "mes accelerateurs",
      "talentos mas fuertes", "mis fortalezas", "mis aceleradores",
      "what am i good at", "my best talents", "my top talents", "what are my talents", "my talent",
      "mes meilleurs talents", "quels sont mes talents", "mes talents les plus forts",
      "mis mejores talentos", "cuales son mis talentos", "en que soy bueno",
      "сильнейшие таланты", "мои сильные стороны", "мои ускорители",
      "мои лучшие таланты", "какие у меня таланты", "в чём я хорош",
    ],
  },
  {
    intentie: "mijn_drivers",
    sleutels: [
      "mijn drivers", "welke drivers heb ik", "mijn driver", "my drivers", "mes drivers",
      "mis drivers", "мои drivers", "welke driver", "drivers in mijn profiel",
    ],
  },
  {
    intentie: "taak_advies",
    sleutels: [
      "welke taak", "welke taken", "wat zou ik", "waar moet ik op focussen", "deze week",
      "wat past bij mij", "waar inzetten", "which task", "quelle tache", "que tarea",
      "какая задача", "rol kiezen", "welke rol", "wat moet ik doen",
    ],
  },
  {
    intentie: "ontwikkelen_groeien",
    sleutels: [
      "groei", "groeien", "ontwikkel", "hoe word ik beter", "ontwikkelpunt",
      "verbeteren", "beter worden", "grow", "improve", "progresser", "mejorar",
      "развивать", "wat kan beter", "groeikansen", "ontwikkelen",
    ],
  },
  {
    intentie: "verschil_zelfbeeld",
    sleutels: [
      "klopt dit", "herken ik mij", "is dit juist", "waarom wijkt", "verschil met hoe ik",
      "anders dan ik dacht", "zelfbeeld", "klopt mijn profiel", "is this accurate", "herkenbaar",
    ],
  },
  {
    intentie: "samenwerken_team",
    sleutels: [
      "samenwerken", "in een team", "met collega", "anderen", "teamrol", "samenwerking",
      "working with", "en equipe", "en equipo", "в команде", "met mijn team", "hoe werk ik samen",
    ],
  },
  {
    intentie: "coach",
    sleutels: [
      "coach", "met iemand praten", "begeleiding", "hulp van een", "gesprek met een mens",
      "psycholoog", "professionele hulp", "talk to someone", "parler a quelqu'un",
    ],
  },
  {
    intentie: "groet",
    sleutels: ["hallo", "hoi", "hey", "goeiedag", "goedemorgen", "dag ", "bonjour", "hello", "hola", "привет"],
  },
  {
    intentie: "dankjewel",
    sleutels: ["dank", "bedankt", "merci", "thanks", "thank you", "gracias", "спасибо", "top, dank"],
  },
];

function normaliseer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accenten weg
    .replace(/['\u2019\u02bc`]/g, " ") // apostroffen (', ’, ʼ, `) -> spatie
    .replace(/[?!.,;:]/g, " ") // leestekens weg
    .replace(/\s+/g, " ")
    .trim();
}

// Lichte, regelgebaseerde taaldetectie voor de assistent. Geeft de taal van de
// VRAAG terug zodat een bezoeker in zijn eigen taal antwoord krijgt, ongeacht de
// opgeslagen taal van de deelnemer. Valt terug op de meegegeven standaardtaal.
export function detecteerVraagTaal(vraag: string, standaard: Taal = "nl"): Taal {
  const raw = String(vraag ?? "");
  // Cyrillisch schrift => Russisch
  if (/[\u0400-\u04ff]/.test(raw)) return "ru";
  const q = normaliseer(raw); // lowercase, accentloos
  if (!q) return standaard;
  const woorden = q.split(" ").filter(Boolean);
  const has = (...ws: string[]) => ws.some((w) => woorden.includes(w));
  const count = (...ws: string[]) => ws.filter((w) => woorden.includes(w)).length;
  // Sterke, taal-specifieke functiewoorden (accentloos). Tel meerdere treffers,
  // zodat de meest waarschijnlijke taal wint i.p.v. de eerste match.
  const score: Record<Exclude<Taal, "ru">, number> = { nl: 0, fr: 0, en: 0, es: 0 };
  score.nl += 2 * count("mijn", "wat", "hoe", "welke", "ben", "heb", "zijn", "ik", "kan", "jij", "het", "een", "sterkste", "talenten", "zou", "meer", "niet", "geen", "voel", "me", "in", "van", "mij", "moet");
  score.en += 2 * count("my", "what", "how", "which", "are", "am", "can", "you", "the", "strongest", "is", "a", "talents", "i", "should", "could", "do", "feel", "to", "with", "empty", "future", "move");
  score.fr += 2 * count("mes", "mon", "ma", "quels", "quelle", "comment", "suis", "je", "peux", "tu", "les", "est", "ce", "qu", "un", "une", "pas", "plus", "avec", "vie", "ne", "sens", "pourrais", "faire");
  score.es += 2 * count("mis", "mi", "que", "cuales", "como", "soy", "yo", "puedo", "tus", "fuertes", "es", "un", "una", "talentos", "no", "tiene", "sentido", "todo", "con", "siento", "vacio", "podria", "hacer");
  // Karakteristieke woorden/markers met extra gewicht.
  if (has("driver", "drivers")) { /* taalneutraal vakterm, geen punten */ }
  if (/\u00bf/.test(raw)) score.es += 3; // omgekeerd vraagteken => Spaans
  if (has("qu")) score.fr += 1; // 'qu'est-ce' fragment
  let beste: Taal = standaard;
  let max = 0;
  (Object.keys(score) as Array<Exclude<Taal, "ru">>).forEach((t) => {
    if (score[t] > max) { max = score[t]; beste = t; }
  });
  return max > 0 ? beste : standaard;
}

// ZORG-KOMPAS op WOORDNIVEAU. Naast de frase-sleutels in PATRONEN detecteren we
// emotionele nood ook via losse signaalwoorden. Reden: in echte gesprekken komt
// distress zelden als nette frase ("ik voel me eenzaam wat moet ik doen" -> het
// stuk "wat moet ik doen" zou anders door taak_advies gekaapt worden). Door op
// woordniveau te scoren VOOR de gewone patroonloop houdt existentieel ALTIJD
// absolute voorrang. Eén ondubbelzinnig zwaar woord (bv. "radeloos", "wanhopig",
// "zelfmoord") volstaat; lichtere woorden ("moe", "alleen") tellen pas mee in
// combinatie, zodat we geen valse alarmen geven op gewone werkvragen.
const DISTRESS_ZWAAR: string[] = [
  // NL
  "radeloos", "wanhopig", "wanhoop", "uitzichtloos", "hopeloos", "moedeloos",
  "zelfmoord", "suicide", "suicidaal", "depressief", "depressie", "burn-out", "burnout",
  "opgebrand", "ingestort", "instorten", "zinloos",
  // EN
  "desperate", "despair", "hopeless", "suicidal", "suicide", "depressed", "depression",
  "worthless", "burnout", "pointless",
  // FR
  "desespere", "desespoir", "suicide", "suicidaire", "deprime", "depression", "epuise",
  // ES
  "desesperado", "suicidio", "suicida", "deprimido", "depresion", "agotado",
  // RU (Cyrillisch)
  "\u0431\u0435\u0437\u043d\u0430\u0434\u0435\u0436\u043d\u043e", "\u0441\u0443\u0438\u0446\u0438\u0434", "\u0434\u0435\u043f\u0440\u0435\u0441\u0441\u0438\u044f", "\u0432\u044b\u0433\u043e\u0440\u0430\u043d\u0438\u0435", "\u043e\u0442\u0447\u0430\u044f\u043d\u0438\u0435", "\u0431\u0435\u0441\u0441\u043c\u044b\u0441\u043b\u0435\u043d\u043d\u043e",
];
// Lichtere signaalwoorden: alleen distress als er MINSTENS TWEE samen voorkomen,
// of één licht woord samen met een nood-frase als "kan niet meer"/"te veel".
const DISTRESS_LICHT: string[] = [
  // NL
  "uitgeput", "doodmoe", "leeg", "kapot", "eenzaam", "alleen", "verdrietig", "verdriet",
  "ongelukkig", "bang", "angstig", "paniek", "huilen", "down",
  // EN
  "exhausted", "drained", "empty", "broken", "lonely", "alone", "sad", "unhappy",
  "afraid", "anxious", "panic", "crying",
  // FR
  "epuisee", "vide", "brise", "seul", "seule", "triste", "malheureux", "peur", "angoisse",
  // ES
  "exhausto", "vacio", "roto", "solo", "sola", "triste", "infeliz", "miedo", "angustia",
  // RU
  "\u0438\u0437\u043c\u043e\u0442\u0430\u043d", "\u043f\u0443\u0441\u0442\u043e\u0442\u0430", "\u043e\u0434\u0438\u043d\u043e\u043a\u043e", "\u043e\u0434\u0438\u043d", "\u0433\u0440\u0443\u0441\u0442\u043d\u043e", "\u0441\u0442\u0440\u0430\u0445", "\u043f\u0430\u043d\u0438\u043a\u0430",
];
const DISTRESS_NOOD_FRASEN: string[] = [
  "kan niet meer", "niet meer verder", "het lukt niet meer", "ik trek het niet meer",
  "te veel", "het wordt me te veel", "weet het niet meer", "niet meer zitten",
  "can t take it", "cannot go on", "can t go on", "too much", "don t know what to do",
  "j en peux plus", "trop", "ne sais plus", "no puedo mas", "es demasiado", "no se que hacer",
  "\u043d\u0435 \u043c\u043e\u0433\u0443", "\u0441\u043b\u0438\u0448\u043a\u043e\u043c", "\u043d\u0435 \u0437\u043d\u0430\u044e",
];

// Geeft true terug zodra de vraag een onmiskenbaar nood-signaal draagt.
export function detecteerDistress(vraag: string): boolean {
  const raw = String(vraag ?? "");
  // Cyrillische signaalwoorden matchen we op de ruwe (lowercase) tekst, want
  // normaliseer() laat Cyrillisch ongemoeid maar woord-splitsing blijft gelijk.
  const q = normaliseer(raw);
  if (!q) return false;
  const woorden = new Set(q.split(" ").filter(Boolean));
  const heeftWoord = (w: string) => woorden.has(normaliseer(w));
  // 1) Eén zwaar woord volstaat.
  if (DISTRESS_ZWAAR.some(heeftWoord)) return true;
  // 2) Nood-frase (substring) telt als zwaar signaal.
  const heeftNoodFrase = DISTRESS_NOOD_FRASEN.some((f) => q.includes(normaliseer(f)));
  // 3) Lichte woorden tellen.
  const lichtAantal = DISTRESS_LICHT.filter(heeftWoord).length;
  if (heeftNoodFrase && lichtAantal >= 1) return true; // bv. "ik ben uitgeput, kan niet meer"
  if (lichtAantal >= 2) return true; // bv. "radeloos en uitgeput" / "eenzaam en verdrietig"
  return false;
}

export function herkenIntentie(vraag: string): Intentie {
  const q = normaliseer(vraag);
  if (!q) return "onbekend";
  // ZORG-KOMPAS heeft ALTIJD absolute voorrang: eerst de woord-niveau-detectie,
  // dan pas de gewone patroonloop. Zo kan geen enkele andere intentie (zoals
  // taak_advies via "wat moet ik doen") een nood-uiting kapen.
  if (detecteerDistress(vraag)) return "existentieel";
  for (const p of PATRONEN) {
    for (const sleutel of p.sleutels) {
      if (q.includes(normaliseer(sleutel))) return p.intentie;
    }
  }
  return "onbekend";
}

// --- 3. ANTWOORD-OPBOUW -----------------------------------------------------

const DISCLAIMER: ML = {
  nl: "Dit is een reflectiehulp op basis van je profiel, geen diagnose.",
  fr: "Ceci est une aide à la réflexion basée sur ton profil, pas un diagnostic.",
  en: "This is a reflection aid based on your profile, not a diagnosis.",
  es: "Esto es una ayuda a la reflexión basada en tu perfil, no un diagnóstico.",
  ru: "Это помощь для размышления на основе вашего профиля, а не диагноз.",
};

const GEEN_PROFIEL: ML = {
  nl: "Ik heb nog geen ingevuld profiel van je. Rond eerst de vragenlijst af — daarna kan ik je heel concreet helpen met je talenten, energie en aandachtspunten.",
  fr: "Je n'ai pas encore de profil rempli. Termine d'abord le questionnaire — ensuite je pourrai t'aider concrètement.",
  en: "I don't have a completed profile from you yet. Complete the questionnaire first — then I can help you concretely.",
  es: "Aún no tengo un perfil completado tuyo. Completa primero el cuestionario y luego podré ayudarte concretamente.",
  ru: "У меня пока нет вашего заполненного профиля. Сначала пройдите опросник — затем я смогу помочь конкретно.",
};

function lijst(items: string[], taal: Taal): string {
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0]!;
  const en: ML = { nl: " en ", fr: " et ", en: " and ", es: " y ", ru: " и " };
  return items.slice(0, -1).join(", ") + k(en, taal) + items[items.length - 1];
}

function e1(x: number): string {
  return x.toFixed(1).replace(".", ",");
}

// Kennisbank: vaste, correcte uitleg per begrip. Geen profielafhankelijkheid.
const KENNIS: Record<string, ML> = {
  driver: {
    nl:
      "Een driver is een innerlijke 'aandrijver': een onbewuste overtuiging die je vanaf jongs af aan motiveert, zoals \"wees perfect\", \"wees sterk\" of \"schiet op\". In je goede dagen helpt een driver je presteren. Onder druk slaat hij door en kost hij net energie — bijvoorbeeld \"wees perfect\" dat verandert in nooit tevreden zijn. We gebruiken de term bewust onvertaald (naar Taibi Kahler) omdat het een vaststaand concept is.",
    fr:
      "Un driver est un « moteur » intérieur : une croyance inconsciente qui te motive depuis l'enfance, comme « sois parfait » ou « sois fort ». Dans tes bons jours il t'aide à performer ; sous pression il s'emballe et te coûte de l'énergie. Le terme reste non traduit (d'après Taibi Kahler).",
    en:
      "A driver is an inner 'motor': an unconscious belief that has motivated you since childhood, such as \"be perfect\" or \"be strong\". On good days a driver helps you perform; under pressure it overshoots and costs you energy. We keep the term untranslated (after Taibi Kahler).",
    es:
      "Un driver es un 'motor' interior: una creencia inconsciente que te motiva desde la infancia, como «sé perfecto» o «sé fuerte». En los buenos días ayuda a rendir; bajo presión se dispara y te cuesta energía. Mantenemos el término sin traducir (según Taibi Kahler).",
    ru:
      "Driver — это внутренний «мотор»: бессознательное убеждение, мотивирующее с детства, например «будь совершенным» или «будь сильным». В хорошие дни помогает, под давлением — перегибает и отнимает энергию. Термин не переводится (по Taibi Kahler).",
  },
  talentfocus: {
    nl:
      "Een talentfocus is een gebied waarin je natuurlijke aandacht en energie vlot stromen — waar werk relatief moeiteloos gaat. TaPas onderscheidt focussen zoals Operationeel, Inter-relationeel, Strategie en Innovatie. Het is geen vaardigheid die je hebt geleerd, maar een richting waarin je van nature trekt.",
    fr: "Un focus de talent est un domaine où ton attention et ton énergie circulent naturellement — où le travail est relativement fluide. TaPas distingue des focus comme Opérationnel, Inter-relationnel, Stratégie et Innovation.",
    en: "A talent focus is an area where your natural attention and energy flow easily — where work feels relatively effortless. TaPas distinguishes foci such as Operational, Inter-relational, Strategy and Innovation.",
    es: "Un foco de talento es un área donde tu atención y energía fluyen con naturalidad. TaPas distingue focos como Operacional, Inter-relacional, Estrategia e Innovación.",
    ru: "Фокус таланта — область, где внимание и энергия текут естественно. TaPas различает фокусы: Операционный, Меж-реляционный, Стратегия и Инновации.",
  },
  versneller: {
    nl:
      "Een talentversneller is gedrag dat je talenten kracht bijzet — het 'hoe' waarmee je je focussen tot resultaat brengt. Denk aan Analyse, Coaching, Faciliteren of Impact. Sterke versnellers vertellen je via welke route je het best je talent inzet.",
    fr: "Un accélérateur de talent est un comportement qui renforce tes talents — le « comment » qui transforme tes focus en résultats : Analyse, Coaching, Facilitation, Impact.",
    en: "A talent accelerator is behaviour that amplifies your talents — the 'how' that turns your foci into results: Analysis, Coaching, Facilitation, Impact.",
    es: "Un acelerador de talento es un comportamiento que potencia tus talentos — el 'cómo': Análisis, Coaching, Facilitación, Impacto.",
    ru: "Ускоритель таланта — поведение, усиливающее таланты, то «как», что превращает фокусы в результат: Анализ, Коучинг, Фасилитация, Влияние.",
  },
  energie: {
    nl:
      "Energie meet hoe het werken aan iets je raakt: geeft een gebied je energie (+) of kost het je energie (−)? Tijdens de vragenlijst leid TaPas dit af uit je keuzes, los van hoe vaardig je ergens in bent. Een talent met veel energie is een gebied waar je wilt blijven; een talent dat energie kost vraagt bewuste dosering.",
    fr: "L'énergie mesure l'effet que te fait une activité : te donne-t-elle de l'énergie (+) ou t'en coûte-t-elle (−) ? TaPas le déduit de tes choix, indépendamment de ta compétence.",
    en: "Energy measures how working on something affects you: does an area give you energy (+) or cost it (−)? TaPas infers this from your choices, independent of how skilled you are.",
    es: "La energía mide cómo te afecta trabajar en algo: ¿te da energía (+) o te la quita (−)? TaPas lo deduce de tus elecciones.",
    ru: "Энергия измеряет, как занятие на вас влияет: даёт энергию (+) или отнимает (−)? TaPas выводит это из ваших выборов.",
  },
  tapas: {
    nl:
      "TaPas brengt in kaart waar je talenten liggen (talentfoci), via welk gedrag je ze versterkt (versnellers), welke innerlijke aandrijvers (drivers) meespelen, en hoeveel energie elk gebied je geeft of kost. Het is geen test met goed of fout, maar een spiegel die je helpt bewuste keuzes te maken in werk.",
    fr: "TaPas cartographie tes talents (focus), les comportements qui les renforcent (accélérateurs), tes moteurs intérieurs (drivers) et l'énergie que chaque domaine te donne ou te coûte. Pas un test avec bon ou faux, mais un miroir.",
    en: "TaPas maps where your talents lie (foci), the behaviour that amplifies them (accelerators), your inner drivers, and how much energy each area gives or costs you. Not a pass/fail test, but a mirror.",
    es: "TaPas mapea tus talentos (focos), los comportamientos que los potencian (aceleradores), tus drivers interiores y la energía que cada área te da o te quita. No es un examen, es un espejo.",
    ru: "TaPas показывает, где ваши таланты (фокусы), какое поведение их усиливает (ускорители), ваши внутренние drivers и сколько энергии даёт или отнимает каждая область. Не тест, а зеркало.",
  },
  tapasbeeld: {
    nl:
      "TaPas-Beeld is geen talent-focus en hoort niet thuis in de volgorde van je talenten. Het is een zelfbeeld- of identiteitslens: het zegt iets over hoe je naar jezelf kijkt en wie je in de kern bent \u2014 hoe kritisch je voor jezelf blijft, hoe waardengedreven je handelt, hoe zeker je je voelt in je functioneren, hoe gevoelig je bent voor de mening van anderen, en hoezeer je een werkomgeving zoekt die bij jou past. Het beschrijft dus niet w\u00e1t je goed kunt, maar hoe je IN HET LEVEN STAAT. Daarom houden we het bewust apart van de talent-foci.",
    fr:
      "TaPas-Beeld n'est pas un focus de talent et n'a pas sa place dans l'ordre de tes talents. C'est une lentille d'image de soi / d'identit\u00e9 : elle dit comment tu te regardes et qui tu es au fond \u2014 \u00e0 quel point tu restes critique envers toi-m\u00eame, guid\u00e9 par tes valeurs, s\u00fbr de ton fonctionnement, sensible \u00e0 l'avis des autres, et en qu\u00eate d'un environnement qui te correspond. Elle ne d\u00e9crit pas ce que tu sais faire, mais ta mani\u00e8re d'\u00eatre. Nous la gardons donc s\u00e9par\u00e9e des focus de talent.",
    en:
      "TaPas-Beeld is not a talent focus and does not belong in the ordering of your talents. It is a self-image / identity lens: it says something about how you see yourself and who you are at your core \u2014 how self-critical you stay, how values-driven you act, how confident you feel in how you function, how sensitive you are to others' opinions, and how much you seek an environment that fits you. It describes not what you are good at, but how you ARE. That is why we keep it separate from the talent foci.",
    es:
      "TaPas-Beeld no es un foco de talento y no pertenece al orden de tus talentos. Es una lente de autoimagen / identidad: dice algo sobre c\u00f3mo te ves a ti mismo y qui\u00e9n eres en esencia \u2014 cu\u00e1n autocr\u00edtico te mantienes, cu\u00e1n guiado por valores act\u00faas, cu\u00e1n seguro te sientes al funcionar, cu\u00e1n sensible eres a la opini\u00f3n de los dem\u00e1s y cu\u00e1nto buscas un entorno que encaje contigo. No describe lo que sabes hacer, sino c\u00f3mo ERES. Por eso lo mantenemos separado de los focos de talento.",
    ru:
      "TaPas-Beeld \u2014 \u044d\u0442\u043e \u043d\u0435 \u0444\u043e\u043a\u0443\u0441 \u0442\u0430\u043b\u0430\u043d\u0442\u0430 \u0438 \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0432\u0430\u0448\u0438\u0445 \u0442\u0430\u043b\u0430\u043d\u0442\u043e\u0432. \u042d\u0442\u043e \u043b\u0438\u043d\u0437\u0430 \u0441\u0430\u043c\u043e\u043e\u0431\u0440\u0430\u0437\u0430 / \u0438\u0434\u0435\u043d\u0442\u0438\u0447\u043d\u043e\u0441\u0442\u0438: \u043e\u043d\u0430 \u0433\u043e\u0432\u043e\u0440\u0438\u0442 \u043e \u0442\u043e\u043c, \u043a\u0430\u043a \u0432\u044b \u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u043d\u0430 \u0441\u0435\u0431\u044f \u0438 \u043a\u0442\u043e \u0432\u044b \u043f\u043e \u0441\u0443\u0442\u0438. \u041e\u043d\u0430 \u043e\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 \u043d\u0435 \u0442\u043e, \u0447\u0442\u043e \u0432\u044b \u0443\u043c\u0435\u0435\u0442\u0435, \u0430 \u043a\u0430\u043a\u043e\u0439 \u0432\u044b \u0415\u0421\u0422\u042c. \u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u043c\u044b \u0434\u0435\u0440\u0436\u0438\u043c \u0435\u0451 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e \u043e\u0442 \u0444\u043e\u043a\u0443\u0441\u043e\u0432 \u0442\u0430\u043b\u0430\u043d\u0442\u0430.",
  },
};

export function beantwoord(vraag: string, p: ProfielFeiten, taal: Taal): { reply: string; veiligheid: string | null } {
  const intentie = herkenIntentie(vraag);
  const disc = k(DISCLAIMER, taal);

  // VERBATIM-BEWIJS HELPER. Geeft, indien beschikbaar, 1–2 letterlijke door de
  // deelnemer onderschreven uitspraken voor een driver-construct in de
  // antwoordtaal, als korte inline-aanhaling. Zo wordt een antwoord concreet en
  // herkenbaar ("dit zie ik terug in jouw eigen antwoorden") zonder iets te
  // verzinnen — het zijn de exacte zinnen uit de afname. Lege string als er geen
  // items zijn, zodat de aanroeper veilig kan concateneren.
  const CITAAT_INLEIDING: ML = {
    nl: "Dat zie ik terug in je eigen antwoorden, waar je onder meer aangaf: ",
    fr: "Je le retrouve dans tes propres r\u00e9ponses, o\u00f9 tu as notamment indiqu\u00e9\u00a0: ",
    en: "I see this back in your own answers, where you indicated among others: ",
    es: "Lo veo en tus propias respuestas, donde indicaste entre otras: ",
    ru: "\u042d\u0442\u043e \u0432\u0438\u0434\u043d\u043e \u0432 \u0432\u0430\u0448\u0438\u0445 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0445 \u043e\u0442\u0432\u0435\u0442\u0430\u0445, \u0433\u0434\u0435 \u0432\u044b, \u0432 \u0447\u0430\u0441\u0442\u043d\u043e\u0441\u0442\u0438, \u0443\u043a\u0430\u0437\u0430\u043b\u0438: ",
  };
  const driverCitaat = (construct: string | null | undefined, maxItems = 2): string => {
    if (!construct) return "";
    const items = p.driverItems[construct];
    if (!items || items.length === 0) return "";
    const gekozen = items.slice(0, maxItems).map((it) => `\u201c${k(it, taal)}\u201d`);
    if (gekozen.length === 0) return "";
    return k(CITAAT_INLEIDING, taal) + lijst(gekozen, taal) + ". ";
  };
  // Loop door een reeks constructen en geef het eerste niet-lege verbatim
  // citaat terug. Zo tonen we bewijs ook als de zwaarste driver zelf geen
  // onderschreven items heeft, maar een volgende belastende driver wel.
  const eersteCitaat = (constructs: (string | null | undefined)[], maxItems = 2): string => {
    for (const c of constructs) {
      const cit = driverCitaat(c, maxItems);
      if (cit) return cit;
    }
    return "";
  };

  // Vertaal het driver-belastingniveau (laag/gemiddeld/matig/hoog) naar de
  // antwoordtaal, zodat het niet als Nederlands woord in een anderstalig
  // antwoord blijft staan.
  const NIVEAU_VERTAAL: Record<string, ML> = {
    laag: { nl: "laag", fr: "faible", en: "low", es: "baja", ru: "\u043d\u0438\u0437\u043a\u0430\u044f" },
    matig: { nl: "matig", fr: "mod\u00e9r\u00e9e", en: "moderate", es: "moderada", ru: "\u0443\u043c\u0435\u0440\u0435\u043d\u043d\u0430\u044f" },
    gemiddeld: { nl: "gemiddeld", fr: "mod\u00e9r\u00e9e", en: "moderate", es: "media", ru: "\u0441\u0440\u0435\u0434\u043d\u044f\u044f" },
    hoog: { nl: "hoog", fr: "\u00e9lev\u00e9e", en: "high", es: "alta", ru: "\u0432\u044b\u0441\u043e\u043a\u0430\u044f" },
  };
  const driverNiveau = NIVEAU_VERTAAL[p.driverLabel]
    ? k(NIVEAU_VERTAAL[p.driverLabel], taal)
    : p.driverLabel;

  // Begripsvragen: vaste correcte uitleg + (indien profiel) een persoonlijke brug.
  if (intentie === "wat_is_driver") {
    let r = k(KENNIS.driver, taal);
    if (p.heeftProfiel && p.driverTopNet) {
      const brug: ML = {
        nl: ` In jouw profiel staat de driver "${p.driverTopNet.construct}" het sterkst aanwezig (drukte: ${driverNiveau}).`,
        fr: ` Dans ton profil, le driver « ${p.driverTopNet.construct} » est le plus présent (charge : ${driverNiveau}).`,
        en: ` In your profile, the "${p.driverTopNet.construct}" driver is most present (load: ${driverNiveau}).`,
        es: ` En tu perfil, el driver «${p.driverTopNet.construct}» es el más presente (carga: ${driverNiveau}).`,
        ru: ` В вашем профиле driver «${p.driverTopNet.construct}» наиболее выражен (нагрузка: ${driverNiveau}).`,
      };
      r += k(brug, taal);
      r += driverCitaat(p.driverTopNet.construct);
    }
    return { reply: r, veiligheid: null };
  }
  if (intentie === "wat_is_talentfocus") return { reply: k(KENNIS.talentfocus, taal), veiligheid: null };
  if (intentie === "wat_is_versneller") return { reply: k(KENNIS.versneller, taal), veiligheid: null };
  if (intentie === "wat_is_energie") return { reply: k(KENNIS.energie, taal), veiligheid: null };
  if (intentie === "wat_is_tapas") return { reply: k(KENNIS.tapas, taal), veiligheid: null };

  // TaPas-Beeld INHOUD: wie iemand IS / zelfbeeld. We geven ALTIJD eerst de
  // vaste, correcte uitleg (TaPas-Beeld = identiteitslens, GEEN talent-focus en
  // dus NOOIT in de foci-volgorde). Als er een profiel is, bruggen we naar de
  // GEMETEN sterkte/energie van het TaPas-Beeld van deze persoon \u2014 als
  // zelfbeeld, niet als focus. Alles uit het contract; niets verzonnen.
  if (intentie === "tapasbeeld_inhoud") {
    let r = k(KENNIS.tapasbeeld, taal);
    if (p.heeftProfiel && p.tapasBeeld) {
      const sterk = p.tapasBeeld.net > 0;
      const energiePlus = p.tapasBeeld.avgEnergy > 0;
      const brug: ML = {
        nl:
          ` In jouw profiel komt dit zelfbeeld ${sterk ? "uitgesproken" : "eerder ingehouden"} naar voren` +
          `${energiePlus ? ", en het gaat samen met positieve energie" : ", terwijl het je eerder energie kost"}. ` +
          `Belangrijk: dit zegt iets over hoe jij in het leven staat \u2014 het is GEEN talent-focus en telt dus niet mee in de volgorde van je talenten. Wil je daar dieper op ingaan, dan kijkt een coach hier graag samen met jou naar.`,
        fr:
          ` Dans ton profil, cette image de soi ressort de mani\u00e8re ${sterk ? "marqu\u00e9e" : "plut\u00f4t retenue"}` +
          `${energiePlus ? ", et elle s'accompagne d'une \u00e9nergie positive" : ", alors qu'elle te co\u00fbte plut\u00f4t de l'\u00e9nergie"}. ` +
          `Important : cela parle de ta mani\u00e8re d'\u00eatre \u2014 ce n'est PAS un focus de talent et cela ne compte donc pas dans l'ordre de tes talents.`,
        en:
          ` In your profile this self-image comes through ${sterk ? "strongly" : "rather quietly"}` +
          `${energiePlus ? ", and it goes together with positive energy" : ", while it tends to cost you energy"}. ` +
          `Important: this is about how you ARE \u2014 it is NOT a talent focus and therefore does not count in the ordering of your talents.`,
        es:
          ` En tu perfil esta autoimagen aparece de forma ${sterk ? "marcada" : "m\u00e1s contenida"}` +
          `${energiePlus ? ", y va acompa\u00f1ada de energ\u00eda positiva" : ", mientras que tiende a costarte energ\u00eda"}. ` +
          `Importante: esto habla de c\u00f3mo ERES \u2014 NO es un foco de talento y por tanto no cuenta en el orden de tus talentos.`,
        ru:
          ` \u0412 \u0432\u0430\u0448\u0435\u043c \u043f\u0440\u043e\u0444\u0438\u043b\u0435 \u044d\u0442\u043e\u0442 \u0441\u0430\u043c\u043e\u043e\u0431\u0440\u0430\u0437 \u043f\u0440\u043e\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f ${sterk ? "\u044f\u0440\u043a\u043e" : "\u0434\u043e\u0432\u043e\u043b\u044c\u043d\u043e \u0441\u0434\u0435\u0440\u0436\u0430\u043d\u043d\u043e"}` +
          `${energiePlus ? ", \u0438 \u0441\u043e\u043f\u0440\u043e\u0432\u043e\u0436\u0434\u0430\u0435\u0442\u0441\u044f \u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0439 \u044d\u043d\u0435\u0440\u0433\u0438\u0435\u0439" : ", \u0445\u043e\u0442\u044f \u0441\u043a\u043e\u0440\u0435\u0435 \u043e\u0442\u043d\u0438\u043c\u0430\u0435\u0442 \u044d\u043d\u0435\u0440\u0433\u0438\u044e"}. ` +
          `\u0412\u0430\u0436\u043d\u043e: \u044d\u0442\u043e \u043e \u0442\u043e\u043c, \u043a\u0430\u043a\u043e\u0439 \u0432\u044b \u0415\u0421\u0422\u042c \u2014 \u044d\u0442\u043e \u041d\u0415 \u0444\u043e\u043a\u0443\u0441 \u0442\u0430\u043b\u0430\u043d\u0442\u0430 \u0438 \u043d\u0435 \u0443\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u043f\u043e\u0440\u044f\u0434\u043a\u0435 \u0432\u0430\u0448\u0438\u0445 \u0442\u0430\u043b\u0430\u043d\u0442\u043e\u0432.`,
      };
      r += k(brug, taal);
    }
    return { reply: r, veiligheid: null };
  }

  if (intentie === "groet") {
    const m: ML = {
      nl: `${p.naam ? `Dag ${p.naam}! ` : "Dag! "}Ik ben je profielassistent. Vraag me bijvoorbeeld waar je energie uit haalt, wat een driver is, of welke taak deze week bij je past.`,
      fr: `${p.naam ? `Bonjour ${p.naam} ! ` : "Bonjour ! "}Je suis ton assistant de profil. Demande-moi par exemple d'où vient ton énergie ou ce qu'est un driver.`,
      en: `${p.naam ? `Hi ${p.naam}! ` : "Hi! "}I'm your profile assistant. Ask me where your energy comes from, what a driver is, or which task fits you this week.`,
      es: `${p.naam ? `¡Hola ${p.naam}! ` : "¡Hola! "}Soy tu asistente de perfil. Pregúntame de dónde sacas energía o qué es un driver.`,
      ru: `${p.naam ? `Здравствуйте, ${p.naam}! ` : "Здравствуйте! "}Я ваш ассистент профиля. Спросите, откуда ваша энергия или что такое driver.`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }
  if (intentie === "dankjewel") {
    const m: ML = {
      nl: "Graag gedaan. Stel gerust nog een vraag over je talenten, energie of drivers.",
      fr: "Avec plaisir. N'hésite pas à poser une autre question sur tes talents, ton énergie ou tes drivers.",
      en: "You're welcome. Feel free to ask another question about your talents, energy or drivers.",
      es: "De nada. Pregunta lo que quieras sobre tus talentos, energía o drivers.",
      ru: "Пожалуйста. Задавайте ещё вопросы о ваших талантах, энергии или drivers.",
    };
    return { reply: k(m, taal), veiligheid: null };
  }
  // ZORG-KOMPAS: existentiële / onderliggende uitspraak. ABSOLUTE voorrang,
  // ook zonder ingevuld profiel. De assistent stelt GEEN diagnose, blijft warm,
  // erkent het signaal en verwijst onmiddellijk door naar de dichtstbijzijnde
  // coach. De route koppelt hier de concrete coach (naam/plaats/mail) aan.
  if (intentie === "existentieel") {
    const m: ML = {
      nl:
        "Dank je dat je dit deelt — wat je beschrijft klinkt zwaar, en het verdient een echt gesprek met een mens, niet met een hulpmiddel. " +
        "Ik ben een reflectiehulp op basis van je profiel en kan en wil hier geen oordeel of diagnose over geven. " +
        "Wat ik wél meteen doe: je in contact brengen met een gecertificeerde TaPas-coach bij jou in de buurt, die rustig en in vertrouwen samen met jou kan kijken naar wat er speelt. " +
        "Als je je op dit moment echt niet goed voelt of aan jezelf twijfelt, blijf er dan niet alleen mee zitten: bel gerust ook je huisarts of, in België, Tele-Onthaal op 106 (gratis, dag en nacht).",
      fr:
        "Merci de partager cela — ce que tu décris semble lourd et mérite une vraie conversation avec un humain, pas avec un outil. " +
        "Je suis une aide à la réflexion basée sur ton profil ; je ne porte aucun jugement ni diagnostic. " +
        "Ce que je fais tout de suite : te mettre en contact avec un coach TaPas certifié près de chez toi, qui regardera avec toi, en confiance, ce qui se passe. " +
        "Si tu ne vas vraiment pas bien, n'hésite pas à appeler ton médecin ou, en Belgique, le 106 (Tele-Onthaal, gratuit, jour et nuit).",
      en:
        "Thank you for sharing this — what you describe sounds heavy, and it deserves a real conversation with a person, not a tool. " +
        "I'm a reflection aid based on your profile; I won't and can't give any judgement or diagnosis. " +
        "What I'll do right away: connect you with a certified TaPas coach near you, who can calmly and confidentially look at what's going on together with you. " +
        "If you really aren't feeling well right now, please don't stay with it alone — reach out to your doctor, or in Belgium call 106 (Tele-Onthaal, free, day and night).",
      es:
        "Gracias por compartir esto — lo que describes suena pesado y merece una conversación real con una persona, no con una herramienta. " +
        "Soy una ayuda a la reflexión basada en tu perfil; no doy ningún juicio ni diagnóstico. " +
        "Lo que hago de inmediato: ponerte en contacto con un coach TaPas certificado cerca de ti, que pueda mirar contigo, con calma y confianza, lo que ocurre. " +
        "Si ahora mismo no te sientes bien, no te quedes solo con ello: llama a tu médico o, en Bélgica, al 106 (Tele-Onthaal, gratis, día y noche).",
      ru:
        "Спасибо, что поделились этим — то, что вы описываете, звучит тяжело и заслуживает настоящего разговора с человеком, а не с инструментом. " +
        "Я — помощь для размышления на основе вашего профиля; я не даю ни оценок, ни диагнозов. " +
        "Что я сделаю сразу: свяжу вас с сертифицированным коучем TaPas рядом с вами. " +
        "Если вам сейчас действительно плохо, не оставайтесь с этим один — обратитесь к врачу или на линию доверия.",
    };
    return { reply: k(m, taal), veiligheid: "coach" };
  }

  if (intentie === "coach") {
    const m: ML = {
      nl: "Sommige vragen verdienen een echt gesprek. Een gecertificeerde TaPas-coach kijkt samen met jou, rustig en in vertrouwen, naar wat er speelt. Ik kan je in contact brengen met een coach bij jou in de buurt.",
      fr: "Certaines questions méritent une vraie conversation. Un coach TaPas certifié regarde avec toi, en confiance, ce qui se passe.",
      en: "Some questions deserve a real conversation. A certified TaPas coach will look at what's going on together with you, calmly and in confidence.",
      es: "Algunas preguntas merecen una conversación real. Un coach TaPas certificado lo verá contigo, con calma y confianza.",
      ru: "Некоторые вопросы заслуживают настоящего разговора. Сертифицированный коуч TaPas спокойно посмотрит вместе с вами.",
    };
    return { reply: k(m, taal), veiligheid: "coach" };
  }

  // Vanaf hier hebben we het profiel nodig.
  if (!p.heeftProfiel) {
    return { reply: `${k(GEEN_PROFIEL, taal)} ${disc}`, veiligheid: null };
  }

  // Alleen echte voorkeursgebieden (netto-voorkeur > 0) gelden als "sterkste"
  // talentfoci/versnellers. Gebieden met netto <= 0 zijn geen voorkeursroute
  // en mogen niet als sterkte worden benoemd. Valt terug op de top-rij als er
  // geen enkel positief gebied is, zodat er altijd iets te zeggen valt.
  const positieveFoci = p.foci.filter((f) => f.net > 0);
  const positieveVersn = p.versnellers.filter((v) => v.net > 0);
  const fociNamen = (positieveFoci.length ? positieveFoci : p.foci.slice(0, 1))
    .slice(0, 3)
    .map((f) => f.construct);
  const versnNamen = (positieveVersn.length ? positieveVersn : p.versnellers.slice(0, 1))
    .slice(0, 2)
    .map((v) => v.construct);

  // ------------------------------------------------------------------------
  // SYNTHESE-LAAG. Legt ECHTE verbanden tussen de profielonderdelen i.p.v. ze
  // los op te sommen. Elk talent/cijfer komt LETTERLIJK uit het contract; we
  // verzinnen niets. We benoemen telkens: (1) de kern-as foci<->versneller<->
  // energie, (2) de spanning of synergie met de sterkste driver, (3) wat het
  // zelfbeeld (TaPas-Beeld) en de discrepantie eraan toevoegen. Teruggegeven
  // als één meertalige tekst; bruikbaar voor de "verdieping"-intent én als
  // diepere onbekend-fallback.
  const synTopFocus = fociNamen[0] ?? "\u2014";
  const synTweedeFocus = fociNamen[1] ?? null;
  const synTopVersn = versnNamen[0] ?? "\u2014";
  const synDriver = p.driverTopNet?.construct ?? null;
  const synKost = p.driversEnergieverlies[0]?.construct ?? null;
  const synEnergie = e1(p.energieVragenlijst);
  const synEnergiePos = p.energieVragenlijst >= 6;
  const synBeeld = p.tapasBeeld?.construct ?? null;
  // Discrepantie: baseline (eigen voorinschatting) - gemeten. Positief = je
  // schatte jezelf vooraf hoger in dan de meting; negatief = lager. Alleen
  // benoemen als er een merkbaar verschil is (>= 1 punt op 10).
  const synDisc = p.discrepantie;
  const synDiscMerkbaar = Math.abs(synDisc) >= 1;
  const synDiscHoger = synDisc > 0; // vooraf hoger ingeschat dan gemeten

  function bouwSynthese(): string {
    // De driver-spanning: bovenaan staat de sterkste focus; de sterkste driver
    // duwt vaak in dezelfde of net een andere richting. We beschrijven het
    // verband concreet, zonder waardeoordeel.
    // Verbatim bewijs voor de sterkste driver — maakt de synthese tastbaar met
    // de eigen onderschreven uitspraken (gegarandeerd uit de afname).
    const synCitaat = driverCitaat(synDriver);
    const mSyn: ML = {
      nl:
        `Goede vraag \u2014 laat me niet bij de losse onderdelen blijven, maar tonen hoe ze in jouw profiel sam\u00e9nhangen.\n\n` +
        `De kern: je sterkste focus is "${synTopFocus}"` +
        (synTweedeFocus ? `, met "${synTweedeFocus}" er vlak achter` : ``) +
        `, en je brengt die het krachtigst tot leven via "${synTopVersn}" \u2014 dat is niet toevallig je natuurlijke werkwijze, maar precies de motor waarmee "${synTopFocus}" resultaat wordt. ` +
        `Je gemeten energie van ${synEnergie}/10 ${synEnergiePos ? `bevestigt dat dit gebied je voedt: je tankt op terwijl je erin werkt` : `laat zien dat je hier nog niet vanzelf oplaadt \u2014 het talent is er, maar de omstandigheden trekken nu energie weg`}. ` +
        (synDriver
          ? `Hier komt de spanning die de meeste mensen niet zelf zien: je sterkst aanwezige driver is "${synDriver}". Een driver is geen talent maar een innerlijke aandrijver \u2014 op je goede dagen versterkt "${synDriver}" net je focus "${synTopFocus}" (hij geeft je drive om er vol voor te gaan). Maar onder druk slaat diezelfde "${synDriver}" door, en dan keert hij zich t\u00e9gen je sterkste gebied: wat eerst moeiteloos voelde, gaat dan krampachtig aanvoelen. ` + synCitaat
          : ``) +
        (synKost && synKost !== synDriver
          ? `Daarnaast is "${synKost}" het stuk dat je het snelst energie kost wanneer het te lang aanstaat \u2014 dat is je vroegste waarschuwingslampje. `
          : ``) +
        (synBeeld
          ? `En dan je zelfbeeld: "${synBeeld}" kleurt hoe jij naar dit alles k\u00edjkt. Het is geen talent in de rangschikking, maar de lens waardoor je je eigen sterktes interpreteert \u2014 en die lens bepaalt vaak of je je focus durft te claimen of net wegcijfert. `
          : ``) +
        (synDiscMerkbaar
          ? `Tot slot een veelzeggend detail: vooraf schatte je jezelf ${synDiscHoger ? `h\u00f3ger` : `l\u00e1ger`} in dan wat de meting liet zien (verschil van ${e1(Math.abs(synDisc))} punt). ${synDiscHoger ? `Je verwachtte meer ruimte dan er op dat moment was \u2014 dat wijst vaak op een periode waarin de omstandigheden zwaarder wogen dan je talent.` : `Je onderschatte jezelf \u2014 je hebt meer in huis dan je dacht, en dat is precies waar groei vrijkomt.`} `
          : ``) +
        `\nDe rode draad: gebruik "${synTopVersn}" bewust om "${synTopFocus}" voorop te zetten, en houd ${synDriver ? `"${synDriver}"` : `je sterkste driver`} kort wanneer de druk stijgt \u2014 dat is waar jouw energie het langst meegaat. Wil je dat ik op \u00e9\u00e9n van deze verbanden nog verder inzoom? ${disc}`,
      fr:
        `Bonne question \u2014 ne restons pas sur les \u00e9l\u00e9ments s\u00e9par\u00e9s, montrons comment ils s'articulent dans ton profil.\n\n` +
        `Le c\u0153ur : ta focus la plus forte est "${synTopFocus}"` +
        (synTweedeFocus ? `, suivie de pr\u00e8s par "${synTweedeFocus}"` : ``) +
        `, et tu la concr\u00e9tises le mieux via "${synTopVersn}" \u2014 c'est le moteur qui transforme "${synTopFocus}" en r\u00e9sultats. ` +
        `Ton \u00e9nergie mesur\u00e9e de ${synEnergie}/10 ${synEnergiePos ? `confirme que ce domaine te nourrit` : `montre que tu n'y recharges pas encore spontan\u00e9ment`}. ` +
        (synDriver
          ? `La tension que peu de gens voient : ton driver le plus pr\u00e9sent est "${synDriver}". Les bons jours il renforce ta focus "${synTopFocus}" ; sous pression il s'emballe et se retourne contre ton point fort. ` + synCitaat
          : ``) +
        (synKost && synKost !== synDriver ? `"${synKost}" est ce qui te co\u00fbte le plus vite de l'\u00e9nergie \u2014 ton premier voyant d'alerte. ` : ``) +
        (synBeeld ? `Ton image de soi "${synBeeld}" est la lentille \u00e0 travers laquelle tu interpr\u00e8tes tout cela. ` : ``) +
        (synDiscMerkbaar ? `Tu t'es estim\u00e9 ${synDiscHoger ? `plus haut` : `plus bas`} que la mesure (\u00e9cart de ${e1(Math.abs(synDisc))}). ` : ``) +
        `\nLe fil rouge : utilise "${synTopVersn}" pour mettre "${synTopFocus}" en avant, et garde ${synDriver ? `"${synDriver}"` : `ton driver`} court sous pression. Veux-tu que j'approfondisse l'un de ces liens ?${disc}`,
      en:
        `Good question \u2014 let me not leave the parts separate, but show how they connect in your profile.\n\n` +
        `The core: your strongest focus is "${synTopFocus}"` +
        (synTweedeFocus ? `, with "${synTweedeFocus}" close behind` : ``) +
        `, and you bring it to life most powerfully through "${synTopVersn}" \u2014 the engine that turns "${synTopFocus}" into results. ` +
        `Your measured energy of ${synEnergie}/10 ${synEnergiePos ? `confirms this area feeds you` : `shows you don't yet recharge here on your own`}. ` +
        (synDriver
          ? `Here's the tension most people miss: your most present driver is "${synDriver}". On good days it reinforces your focus "${synTopFocus}"; under pressure that same "${synDriver}" overshoots and turns against your strongest area. ` + synCitaat
          : ``) +
        (synKost && synKost !== synDriver ? `"${synKost}" is what costs you energy fastest when left on too long \u2014 your earliest warning light. ` : ``) +
        (synBeeld ? `Your self-image "${synBeeld}" is the lens through which you interpret all of this \u2014 not a talent in the ranking, but what decides whether you claim your focus or downplay it. ` : ``) +
        (synDiscMerkbaar ? `Telling detail: beforehand you rated yourself ${synDiscHoger ? `higher` : `lower`} than the measurement (gap of ${e1(Math.abs(synDisc))}). ${synDiscHoger ? `You expected more room than there was \u2014 often a sign the circumstances weighed heavier than your talent.` : `You underestimated yourself \u2014 there's more in you than you thought.`} ` : ``) +
        `\nThe through-line: use "${synTopVersn}" to put "${synTopFocus}" first, and keep ${synDriver ? `"${synDriver}"` : `your strongest driver`} short when pressure rises. Want me to zoom in further on one of these links?${disc}`,
      es:
        `Buena pregunta \u2014 no me quedo en las partes sueltas, te muestro c\u00f3mo se conectan en tu perfil.\n\n` +
        `El n\u00facleo: tu foco m\u00e1s fuerte es "${synTopFocus}"` +
        (synTweedeFocus ? `, con "${synTweedeFocus}" muy cerca` : ``) +
        `, y lo materializas mejor a trav\u00e9s de "${synTopVersn}". ` +
        `Tu energ\u00eda medida de ${synEnergie}/10 ${synEnergiePos ? `confirma que esta \u00e1rea te nutre` : `muestra que a\u00fan no recargas aqu\u00ed por ti mismo`}. ` +
        (synDriver ? `La tensi\u00f3n que pocos ven: tu driver m\u00e1s presente es "${synDriver}". En buenos d\u00edas refuerza tu foco "${synTopFocus}"; bajo presi\u00f3n se dispara y se vuelve en contra. ` + synCitaat : ``) +
        (synKost && synKost !== synDriver ? `"${synKost}" es lo que m\u00e1s r\u00e1pido te cuesta energ\u00eda \u2014 tu primera se\u00f1al de alerta. ` : ``) +
        (synBeeld ? `Tu autoimagen "${synBeeld}" es la lente con la que interpretas todo esto. ` : ``) +
        (synDiscMerkbaar ? `Te valoraste ${synDiscHoger ? `m\u00e1s alto` : `m\u00e1s bajo`} que la medici\u00f3n (diferencia de ${e1(Math.abs(synDisc))}). ` : ``) +
        `\nEl hilo conductor: usa "${synTopVersn}" para poner "${synTopFocus}" primero, y mant\u00e9n ${synDriver ? `"${synDriver}"` : `tu driver`} corto bajo presi\u00f3n. \u00bfQuieres que profundice en uno de estos v\u00ednculos?${disc}`,
      ru:
        `\u0425\u043e\u0440\u043e\u0448\u0438\u0439 \u0432\u043e\u043f\u0440\u043e\u0441 \u2014 \u043f\u043e\u043a\u0430\u0436\u0443 \u043d\u0435 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0435 \u0447\u0430\u0441\u0442\u0438, \u0430 \u043a\u0430\u043a \u043e\u043d\u0438 \u0441\u0432\u044f\u0437\u0430\u043d\u044b \u0432 \u0432\u0430\u0448\u0435\u043c \u043f\u0440\u043e\u0444\u0438\u043b\u0435.\n\n` +
        `\u0421\u0443\u0442\u044c: \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0439 \u0444\u043e\u043a\u0443\u0441 \u2014 "${synTopFocus}"` +
        (synTweedeFocus ? `, \u0440\u044f\u0434\u043e\u043c "${synTweedeFocus}"` : ``) +
        `, \u0438 \u0432\u044b \u0440\u0435\u0430\u043b\u0438\u0437\u0443\u0435\u0442\u0435 \u0435\u0433\u043e \u0441\u0438\u043b\u044c\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u0447\u0435\u0440\u0435\u0437 "${synTopVersn}". ` +
        `\u0418\u0437\u043c\u0435\u0440\u0435\u043d\u043d\u0430\u044f \u044d\u043d\u0435\u0440\u0433\u0438\u044f ${synEnergie}/10 ${synEnergiePos ? `\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442, \u0447\u0442\u043e \u044d\u0442\u0430 \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0432\u0430\u0441 \u043f\u0438\u0442\u0430\u0435\u0442` : `\u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442, \u0447\u0442\u043e \u0437\u0434\u0435\u0441\u044c \u0432\u044b \u0435\u0449\u0451 \u043d\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442\u0435\u0441\u044c \u0441\u0430\u043c\u0438`}. ` +
        (synDriver ? `\u0421\u043a\u0440\u044b\u0442\u043e\u0435 \u043d\u0430\u043f\u0440\u044f\u0436\u0435\u043d\u0438\u0435: \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0439 driver \u2014 "${synDriver}". \u0412 \u0445\u043e\u0440\u043e\u0448\u0438\u0435 \u0434\u043d\u0438 \u043e\u043d \u0443\u0441\u0438\u043b\u0438\u0432\u0430\u0435\u0442 \u0444\u043e\u043a\u0443\u0441 "${synTopFocus}"; \u043f\u043e\u0434 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c \u043e\u0431\u043e\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043f\u0440\u043e\u0442\u0438\u0432 \u0432\u0430\u0441. ` + synCitaat : ``) +
        (synKost && synKost !== synDriver ? `"${synKost}" \u0431\u044b\u0441\u0442\u0440\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u043e\u0442\u043d\u0438\u043c\u0430\u0435\u0442 \u044d\u043d\u0435\u0440\u0433\u0438\u044e \u2014 \u0432\u0430\u0448 \u0440\u0430\u043d\u043d\u0438\u0439 \u0441\u0438\u0433\u043d\u0430\u043b. ` : ``) +
        (synBeeld ? `\u0421\u0430\u043c\u043e\u043e\u0431\u0440\u0430\u0437 "${synBeeld}" \u2014 \u043b\u0438\u043d\u0437\u0430, \u0447\u0435\u0440\u0435\u0437 \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0432\u044b \u0432\u0441\u0451 \u044d\u0442\u043e \u0432\u043e\u0441\u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442\u0435. ` : ``) +
        `\n\u041e\u0431\u0449\u0430\u044f \u043b\u0438\u043d\u0438\u044f: \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 "${synTopVersn}", \u0447\u0442\u043e\u0431\u044b \u0441\u0442\u0430\u0432\u0438\u0442\u044c "${synTopFocus}" \u043d\u0430 \u043f\u0435\u0440\u0432\u043e\u0435 \u043c\u0435\u0441\u0442\u043e, \u0438 \u0434\u0435\u0440\u0436\u0438\u0442\u0435 ${synDriver ? `"${synDriver}"` : `driver`} \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u043c \u043f\u043e\u0434 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c. \u0423\u0433\u043b\u0443\u0431\u0438\u0442\u044c\u0441\u044f \u0432 \u043e\u0434\u043d\u0443 \u0438\u0437 \u0441\u0432\u044f\u0437\u0435\u0439?${disc}`,
    };
    return k(mSyn, taal);
  }

  // EXACTE VOLGORDE in mensentaal. We tonen de echte rangschikking van drivers,
  // talent-foci en versnellers ZOALS in het profiel \u2014 sterkste eerst \u2014 en
  // vertalen wat die volgorde betekent. TaPas-Beeld blijft hier ALTIJD buiten de
  // foci-volgorde (p.foci is al gefilterd). Alles uit het contract; niets verzonnen.
  if (intentie === "volgorde_uitleg") {
    // CATEGORIE-BEWUST. Marc's terechte opmerking: een vraag over de volgorde van
    // de DRIVERS mag niet automatisch ook foci + versnellers opsommen. We bepalen
    // daarom WELKE categorie gevraagd is en tonen die als hoofdantwoord; de andere
    // twee komen enkel als beknopte context terug (en alleen wanneer relevant).
    // Alles uit het contract; TaPas-Beeld blijft altijd buiten de foci-volgorde.
    const qn = normaliseer(vraag);
    const noemt = (...ws: string[]) => ws.some((w) => qn.includes(normaliseer(w)));
    const vraagtDrivers = noemt(
      "driver", "drivers", "\u0434\u0440\u0430\u0439\u0432\u0435\u0440",
    );
    const vraagtVersnellers = noemt(
      "versneller", "versnellers", "talent-versneller", "accelerator", "accelerators",
      "accelerateur", "accelerateurs", "acelerador", "aceleradores", "\u0443\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b",
    );
    const vraagtFoci = noemt(
      "talent-focus", "talent-foci", "talentfocus", "talentfoci", "talent focus", "talent foci",
      "focus", "foci", "foco", "focos", "\u0444\u043e\u043a\u0443\u0441",
    );
    // Welke categorie is het hoofdonderwerp? Als er precies één expliciet genoemd
    // wordt, is dat de focus; anders tonen we het volledige overzicht ("alles").
    const aantalGenoemd = [vraagtDrivers, vraagtVersnellers, vraagtFoci].filter(Boolean).length;
    type Cat = "drivers" | "versnellers" | "foci" | "alles";
    let cat: Cat = "alles";
    if (aantalGenoemd === 1) {
      cat = vraagtDrivers ? "drivers" : vraagtVersnellers ? "versnellers" : "foci";
    }

    const genummerd = (items: Construct[]): string =>
      items.length
        ? items.map((it, i) => `${i + 1}. ${it.construct}`).join("  \u00b7  ")
        : "\u2014";
    const fociItems = p.foci;
    const versnItems = p.versnellers;
    const driverItems = p.drivers.filter((d) => d.net > 0).length
      ? p.drivers.filter((d) => d.net > 0)
      : p.drivers.slice(0, 1);
    const fociLijn = genummerd(fociItems);
    const versnLijn = genummerd(versnItems);
    const driverLijn = genummerd(driverItems);
    const topFocus = p.foci[0]?.construct ?? "\u2014";
    const topVersn = p.versnellers[0]?.construct ?? "\u2014";
    const topDriver = p.driverTopNet?.construct ?? "\u2014";

    // --- Per-categorie hoofdantwoord (alleen de gevraagde lijst + betekenis) ---
    const tapasNoot: ML = {
      nl: ` Let op: TaPas-Beeld hoort hier bewust NIET bij \u2014 dat is je zelfbeeld (hoe je IN HET LEVEN STAAT), geen talent-focus, en telt dus niet mee in deze volgorde.`,
      fr: ` \u00c0 noter : TaPas-Beeld n'en fait volontairement PAS partie \u2014 c'est ton image de soi, pas un focus de talent.`,
      en: ` Note: TaPas-Beeld is deliberately NOT part of this \u2014 it's your self-image (how you ARE), not a talent focus.`,
      es: ` Nota: TaPas-Beeld NO forma parte de esto a prop\u00f3sito \u2014 es tu autoimagen, no un foco de talento.`,
      ru: ` \u0412\u0430\u0436\u043d\u043e: TaPas-Beeld \u0441\u043e\u0437\u043d\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u041d\u0415 \u0432\u0445\u043e\u0434\u0438\u0442 \u0441\u044e\u0434\u0430 \u2014 \u044d\u0442\u043e \u0432\u0430\u0448 \u0441\u0430\u043c\u043e\u043e\u0431\u0440\u0430\u0437, \u0430 \u043d\u0435 \u0444\u043e\u043a\u0443\u0441 \u0442\u0430\u043b\u0430\u043d\u0442\u0430.`,
    };

    if (cat === "drivers") {
      const m: ML = {
        nl:
          `Je vroeg specifiek naar je drivers \u2014 hier is alleen die volgorde, sterkste eerst.\n\n` +
          `Drivers: ${driverLijn}.\n\n` +
          `Wat dit betekent: drivers zijn je innerlijke aandrijvers, geen talenten. Bovenaan staat "${topDriver}" \u2014 die speelt bij jou het sterkst. Een driver helpt je presteren (bv. "${topDriver}" duwt je vooruit), maar kan onder druk doorslaan en dan net energie kosten. De volgorde zegt dus niet "goed naar slecht", maar "meest naar minst aanwezig als innerlijke motor". ` +
          `Je talent-foci en versnellers staan hier los van \u2014 vraag gerust afzonderlijk naar de volgorde van je talenten of je versnellers als je die ook wilt zien.${disc}`,
        fr:
          `Tu as demand\u00e9 sp\u00e9cifiquement tes drivers \u2014 voici uniquement cet ordre, du plus fort au plus faible.\n\n` +
          `Drivers : ${driverLijn}.\n\n` +
          `Ce que cela signifie : les drivers sont tes moteurs int\u00e9rieurs, pas des talents. En t\u00eate "${topDriver}" \u2014 le plus pr\u00e9sent ; il aide \u00e0 performer mais peut s'emballer sous pression. ` +
          `Tes focus et acc\u00e9l\u00e9rateurs sont s\u00e9par\u00e9s \u2014 demande-les si tu veux les voir.${disc}`,
        en:
          `You asked specifically about your drivers \u2014 here is only that order, strongest first.\n\n` +
          `Drivers: ${driverLijn}.\n\n` +
          `What it means: drivers are your inner motors, not talents. "${topDriver}" leads \u2014 most present; it helps you perform but can overshoot under pressure. ` +
          `Your foci and accelerators are separate \u2014 ask for them if you'd like to see those too.${disc}`,
        es:
          `Preguntaste espec\u00edficamente por tus drivers \u2014 aqu\u00ed solo ese orden, del m\u00e1s fuerte al m\u00e1s d\u00e9bil.\n\n` +
          `Drivers: ${driverLijn}.\n\n` +
          `Qu\u00e9 significa: los drivers son tus motores interiores, no talentos. "${topDriver}" encabeza \u2014 el m\u00e1s presente; ayuda a rendir pero puede dispararse bajo presi\u00f3n. ` +
          `Tus focos y aceleradores van aparte \u2014 p\u00eddelos si quieres verlos.${disc}`,
        ru:
          `\u0412\u044b \u0441\u043f\u0440\u043e\u0441\u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u043d\u043e \u043f\u0440\u043e drivers \u2014 \u0432\u043e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u044d\u0442\u043e\u0442 \u043f\u043e\u0440\u044f\u0434\u043e\u043a, \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0435 \u0432\u043f\u0435\u0440\u0435\u0434\u0438.\n\n` +
          `Drivers: ${driverLijn}.\n\n` +
          `\u0427\u0442\u043e \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442: drivers \u2014 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043c\u043e\u0442\u043e\u0440\u044b, \u043d\u0435 \u0442\u0430\u043b\u0430\u043d\u0442\u044b. "${topDriver}" \u0432\u043e \u0433\u043b\u0430\u0432\u0435 \u2014 \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0432\u044b\u0440\u0430\u0436\u0435\u043d; \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442, \u043d\u043e \u043f\u043e\u0434 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c \u043c\u043e\u0436\u0435\u0442 \u043f\u0435\u0440\u0435\u0433\u0438\u0431\u0430\u0442\u044c. ` +
          `\u0424\u043e\u043a\u0443\u0441\u044b \u0438 \u0443\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438 \u2014 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e.${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }

    if (cat === "versnellers") {
      const m: ML = {
        nl:
          `Je vroeg specifiek naar je talent-versnellers \u2014 hier is alleen die volgorde, sterkste eerst.\n\n` +
          `Talent-versnellers: ${versnLijn}.\n\n` +
          `Wat dit betekent: versnellers tonen HOE je je talent het krachtigst tot resultaat brengt \u2014 het 'gereedschap' waarmee je werkt. Bovenaan "${topVersn}": dat is je meest natuurlijke werkwijze, de route waarlangs je je talent het vlotst inzet. Hoe lager in de lijst, hoe meer een werkwijze bewuste inspanning vraagt. ` +
          `Je talent-foci (WAAR je aandacht naartoe gaat) en je drivers staan hier los van \u2014 vraag ze gerust apart op.${disc}`,
        fr:
          `Tu as demand\u00e9 sp\u00e9cifiquement tes acc\u00e9l\u00e9rateurs \u2014 voici uniquement cet ordre, du plus fort au plus faible.\n\n` +
          `Acc\u00e9l\u00e9rateurs : ${versnLijn}.\n\n` +
          `Ce que cela signifie : les acc\u00e9l\u00e9rateurs montrent COMMENT tu transformes ton talent en r\u00e9sultats. En t\u00eate "${topVersn}", ta mani\u00e8re la plus naturelle. ` +
          `Tes focus et tes drivers sont s\u00e9par\u00e9s \u2014 demande-les au besoin.${disc}`,
        en:
          `You asked specifically about your accelerators \u2014 here is only that order, strongest first.\n\n` +
          `Accelerators: ${versnLijn}.\n\n` +
          `What it means: accelerators show HOW you turn your talent into results. "${topVersn}" leads \u2014 your most natural way of working. ` +
          `Your foci and drivers are separate \u2014 ask for them if needed.${disc}`,
        es:
          `Preguntaste espec\u00edficamente por tus aceleradores \u2014 aqu\u00ed solo ese orden, del m\u00e1s fuerte al m\u00e1s d\u00e9bil.\n\n` +
          `Aceleradores: ${versnLijn}.\n\n` +
          `Qu\u00e9 significa: los aceleradores muestran C\u00d3MO conviertes tu talento en resultados. "${topVersn}" encabeza \u2014 tu forma m\u00e1s natural. ` +
          `Tus focos y drivers van aparte \u2014 p\u00eddelos si quieres.${disc}`,
        ru:
          `\u0412\u044b \u0441\u043f\u0440\u043e\u0441\u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u043d\u043e \u043f\u0440\u043e \u0443\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438 \u2014 \u0432\u043e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u044d\u0442\u043e\u0442 \u043f\u043e\u0440\u044f\u0434\u043e\u043a, \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0435 \u0432\u043f\u0435\u0440\u0435\u0434\u0438.\n\n` +
          `\u0423\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438: ${versnLijn}.\n\n` +
          `\u0427\u0442\u043e \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442: \u0443\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442, \u041a\u0410\u041a \u0432\u044b \u043f\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0435 \u0442\u0430\u043b\u0430\u043d\u0442 \u0432 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442. "${topVersn}" \u0432\u043e \u0433\u043b\u0430\u0432\u0435. ` +
          `\u0424\u043e\u043a\u0443\u0441\u044b \u0438 drivers \u2014 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e.${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }

    if (cat === "foci") {
      const m: ML = {
        nl:
          `Je vroeg specifiek naar je talent-foci \u2014 hier is alleen die volgorde, sterkste eerst.\n\n` +
          `Talent-foci: ${fociLijn}.\n\n` +
          `Wat dit betekent: je talent-foci tonen WAAR je aandacht en energie van nature het vlotst naartoe gaan. Bovenaan staat "${topFocus}" \u2014 daar voelt werk het meest moeiteloos. Hoe lager in de lijst, hoe meer een gebied bewuste inzet of moeite vraagt. ` +
          `Je versnellers (HOE je dat talent inzet) en je drivers staan hier los van \u2014 vraag ze gerust apart op.${k(tapasNoot, taal)}${disc}`,
        fr:
          `Tu as demand\u00e9 sp\u00e9cifiquement tes focus de talent \u2014 voici uniquement cet ordre, du plus fort au plus faible.\n\n` +
          `Focus de talent : ${fociLijn}.\n\n` +
          `Ce que cela signifie : tes focus montrent O\u00d9 ton attention va le plus naturellement. En t\u00eate "${topFocus}", l\u00e0 o\u00f9 le travail est le plus fluide. ` +
          `Tes acc\u00e9l\u00e9rateurs et tes drivers sont s\u00e9par\u00e9s.${k(tapasNoot, taal)}${disc}`,
        en:
          `You asked specifically about your talent foci \u2014 here is only that order, strongest first.\n\n` +
          `Talent foci: ${fociLijn}.\n\n` +
          `What it means: your foci show WHERE your attention flows most naturally. "${topFocus}" is at the top, where work feels most effortless. ` +
          `Your accelerators and drivers are separate.${k(tapasNoot, taal)}${disc}`,
        es:
          `Preguntaste espec\u00edficamente por tus focos de talento \u2014 aqu\u00ed solo ese orden, del m\u00e1s fuerte al m\u00e1s d\u00e9bil.\n\n` +
          `Focos de talento: ${fociLijn}.\n\n` +
          `Qu\u00e9 significa: tus focos muestran D\u00d3NDE fluye tu atenci\u00f3n con m\u00e1s naturalidad. Arriba "${topFocus}", donde el trabajo es m\u00e1s fluido. ` +
          `Tus aceleradores y drivers van aparte.${k(tapasNoot, taal)}${disc}`,
        ru:
          `\u0412\u044b \u0441\u043f\u0440\u043e\u0441\u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u043d\u043e \u043f\u0440\u043e \u0444\u043e\u043a\u0443\u0441\u044b \u0442\u0430\u043b\u0430\u043d\u0442\u0430 \u2014 \u0432\u043e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u044d\u0442\u043e\u0442 \u043f\u043e\u0440\u044f\u0434\u043e\u043a, \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0435 \u0432\u043f\u0435\u0440\u0435\u0434\u0438.\n\n` +
          `\u0424\u043e\u043a\u0443\u0441\u044b \u0442\u0430\u043b\u0430\u043d\u0442\u0430: ${fociLijn}.\n\n` +
          `\u0427\u0442\u043e \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442: \u0444\u043e\u043a\u0443\u0441\u044b \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442, \u043a\u0443\u0434\u0430 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u0442\u0435\u0447\u0451\u0442 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u0435. \u0412\u0432\u0435\u0440\u0445\u0443 "${topFocus}". ` +
          `\u0423\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438 \u0438 drivers \u2014 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e.${k(tapasNoot, taal)}${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }

    // cat === "alles": volledig overzicht (oorspronkelijk gedrag).
    const m: ML = {
      nl:
        `Hier is de exacte volgorde uit jouw profiel, sterkste eerst.\n\n` +
        `Talent-foci: ${fociLijn}.\n` +
        `Talent-versnellers: ${versnLijn}.\n` +
        `Drivers: ${driverLijn}.\n\n` +
        `Wat dit in mensentaal betekent: je talent-foci tonen WAAR je aandacht en energie van nature het vlotst naartoe gaan \u2014 bovenaan staat "${topFocus}", daar voelt werk het meest moeiteloos, en hoe lager in de lijst, hoe meer een gebied moeite of bewuste inzet vraagt. ` +
        `Je versnellers tonen HOE je dat talent het krachtigst tot resultaat brengt \u2014 bij jou voorop "${topVersn}", dat is je natuurlijke werkwijze. ` +
        `Je drivers zijn de innerlijke aandrijvers eronder \u2014 "${topDriver}" speelt het sterkst; die helpt je presteren, maar kan onder druk doorslaan en dan net energie kosten.${k(tapasNoot, taal)} ${disc}`,
      fr:
        `Voici l'ordre exact de ton profil, du plus fort au plus faible.\n\n` +
        `Focus de talent : ${fociLijn}.\n` +
        `Acc\u00e9l\u00e9rateurs : ${versnLijn}.\n` +
        `Drivers : ${driverLijn}.\n\n` +
        `En clair : tes focus montrent O\u00d9 ton attention va le plus naturellement \u2014 en t\u00eate "${topFocus}", l\u00e0 o\u00f9 le travail est le plus fluide. ` +
        `Tes acc\u00e9l\u00e9rateurs montrent COMMENT tu transformes cela en r\u00e9sultats \u2014 d'abord "${topVersn}". ` +
        `Tes drivers sont les moteurs int\u00e9rieurs \u2014 "${topDriver}" est le plus pr\u00e9sent ; il t'aide, mais peut s'emballer sous pression.${k(tapasNoot, taal)} ${disc}`,
      en:
        `Here is the exact order from your profile, strongest first.\n\n` +
        `Talent foci: ${fociLijn}.\n` +
        `Accelerators: ${versnLijn}.\n` +
        `Drivers: ${driverLijn}.\n\n` +
        `In plain terms: your foci show WHERE your attention flows most naturally \u2014 "${topFocus}" is at the top, where work feels most effortless; the lower an area sits, the more effort it asks. ` +
        `Your accelerators show HOW you turn that into results \u2014 "${topVersn}" leads, your natural way of working. ` +
        `Your drivers are the inner motors beneath \u2014 "${topDriver}" is most present; it helps you perform but can overshoot under pressure.${k(tapasNoot, taal)} ${disc}`,
      es:
        `Este es el orden exacto de tu perfil, del m\u00e1s fuerte al m\u00e1s d\u00e9bil.\n\n` +
        `Focos de talento: ${fociLijn}.\n` +
        `Aceleradores: ${versnLijn}.\n` +
        `Drivers: ${driverLijn}.\n\n` +
        `En lenguaje claro: tus focos muestran D\u00d3NDE fluye tu atenci\u00f3n con m\u00e1s naturalidad \u2014 arriba "${topFocus}", donde el trabajo es m\u00e1s fluido. ` +
        `Tus aceleradores muestran C\u00d3MO lo conviertes en resultados \u2014 primero "${topVersn}". ` +
        `Tus drivers son los motores interiores \u2014 "${topDriver}" es el m\u00e1s presente; ayuda pero puede dispararse bajo presi\u00f3n.${k(tapasNoot, taal)} ${disc}`,
      ru:
        `\u0412\u043e\u0442 \u0442\u043e\u0447\u043d\u044b\u0439 \u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0438\u0437 \u0432\u0430\u0448\u0435\u0433\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044f, \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0435 \u0432\u043f\u0435\u0440\u0435\u0434\u0438.\n\n` +
        `\u0424\u043e\u043a\u0443\u0441\u044b \u0442\u0430\u043b\u0430\u043d\u0442\u0430: ${fociLijn}.\n` +
        `\u0423\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438: ${versnLijn}.\n` +
        `Drivers: ${driverLijn}.\n\n` +
        `\u041f\u0440\u043e\u0441\u0442\u044b\u043c\u0438 \u0441\u043b\u043e\u0432\u0430\u043c\u0438: \u0444\u043e\u043a\u0443\u0441\u044b \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442, \u043a\u0443\u0434\u0430 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u0442\u0435\u0447\u0451\u0442 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u0435 \u2014 \u0432\u0432\u0435\u0440\u0445\u0443 "${topFocus}". ` +
        `\u0423\u0441\u043a\u043e\u0440\u0438\u0442\u0435\u043b\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442, \u041a\u0410\u041a \u0432\u044b \u043f\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0435 \u044d\u0442\u043e \u0432 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u2014 \u0441\u043d\u0430\u0447\u0430\u043b\u0430 "${topVersn}". ` +
        `Drivers \u2014 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043c\u043e\u0442\u043e\u0440\u044b: "${topDriver}" \u0432\u044b\u0440\u0430\u0436\u0435\u043d \u0441\u0438\u043b\u044c\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e.${k(tapasNoot, taal)} ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "verdieping") {
    // Doorvraag: NIET doorverwijzen, maar de echte verbanden tonen. Volledig uit
    // het profiel; geen diagnose, geen verzinsels. veiligheid blijft null \u2014 dit
    // is juist het tegendeel van "praat maar met een coach".
    if (!p.heeftProfiel) {
      return { reply: k(GEEN_PROFIEL, taal), veiligheid: null };
    }
    return { reply: bouwSynthese(), veiligheid: null };
  }

  if (intentie === "mijn_energie") {
    // Energie stroomt het sterkst via de meest energiegevende gebieden uit de
    // echte voorkeursroutes: positieve talentfoci + sterkste versnellers,
    // gerangschikt op energie. Zo benoemen we geen niet-voorkeursgebied.
    const energieBronnen = [...positieveFoci, ...p.versnellers.filter((v) => v.net > 0)]
      .sort((a, b) => b.avgEnergy - a.avgEnergy)
      .map((r) => r.construct);
    const top = (energieBronnen.length
      ? energieBronnen
      : p.foci.filter((f) => f.avgEnergy > 0).map((f) => f.construct)
    ).slice(0, 3);
    const kost = p.driversEnergieverlies.slice(0, 1).map((d) => d.construct);
    const m: ML = {
      nl:
        `Je energie stroomt het vlotst in ${lijst(top.length ? top : fociNamen, taal)}. ` +
        `Je gemeten energie tijdens de vragenlijst was ${e1(p.energieVragenlijst)}/10. ` +
        (kost.length ? `Let op de driver "${kost[0]}": die kan je net energie kosten als hij doorslaat. ` : "") +
        `Plan deze week bewust meer tijd in waar je energie vrijkomt. ${disc}`,
      fr:
        `Ton énergie circule le mieux dans ${lijst(top.length ? top : fociNamen, taal)}. ` +
        `Ton énergie mesurée était de ${e1(p.energieVragenlijst)}/10. ` +
        (kost.length ? `Attention au driver « ${kost[0]} » qui peut te coûter de l'énergie. ` : "") +
        `${disc}`,
      en:
        `Your energy flows most freely in ${lijst(top.length ? top : fociNamen, taal)}. ` +
        `Your measured energy was ${e1(p.energieVragenlijst)}/10. ` +
        (kost.length ? `Watch the "${kost[0]}" driver, which can cost you energy when it overshoots. ` : "") +
        `${disc}`,
      es:
        `Tu energía fluye mejor en ${lijst(top.length ? top : fociNamen, taal)}. ` +
        `Tu energía medida fue ${e1(p.energieVragenlijst)}/10. ` +
        (kost.length ? `Cuidado con el driver «${kost[0]}». ` : "") +
        `${disc}`,
      ru:
        `Ваша энергия течёт свободнее всего в ${lijst(top.length ? top : fociNamen, taal)}. ` +
        `Измеренная энергия — ${e1(p.energieVragenlijst)}/10. ` +
        (kost.length ? `Следите за driver «${kost[0]}». ` : "") +
        `${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "mijn_talenten") {
    const m: ML = {
      nl:
        `Je sterkste talentfoci zijn ${lijst(fociNamen, taal)} — daar gaat werk het meest moeiteloos. ` +
        `Je versterkt ze vooral via ${lijst(versnNamen, taal)}. ` +
        `Combineer die bewust: kies taken die je sterkste focus raken én je sterkste versneller laten spelen. ${disc}`,
      fr:
        `Tes focus de talent les plus forts sont ${lijst(fociNamen, taal)}. Tu les amplifies surtout via ${lijst(versnNamen, taal)}. ${disc}`,
      en:
        `Your strongest talent foci are ${lijst(fociNamen, taal)}. You amplify them mainly through ${lijst(versnNamen, taal)}. ${disc}`,
      es:
        `Tus focos de talento más fuertes son ${lijst(fociNamen, taal)}. Los potencias sobre todo con ${lijst(versnNamen, taal)}. ${disc}`,
      ru:
        `Ваши сильнейшие фокусы — ${lijst(fociNamen, taal)}. Усиливаете их через ${lijst(versnNamen, taal)}. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "mijn_drivers") {
    const aanwezig = p.drivers.filter((d) => d.net > 0).map((d) => d.construct);
    // Verbatim bewijs voor de sterkste driver: maakt de opsomming concreet en
    // herkenbaar i.p.v. abstract. Komt letterlijk uit de afname.
    const cit = driverCitaat(p.driverTopNet?.construct);
    const m: ML = {
      nl:
        `In jouw profiel zijn deze drivers het sterkst aanwezig: ${lijst(aanwezig.length ? aanwezig : [p.driverTopNet?.construct ?? "—"], taal)}. ` +
        `De algemene driver-belasting is ${driverNiveau}. ` + cit +
        `Drivers zijn niet 'slecht' — ze helpen je presteren. Het gaat erom ze te herkennen vóór ze onder druk doorslaan. ${disc}`,
      fr:
        `Les drivers les plus présents : ${lijst(aanwezig.length ? aanwezig : [p.driverTopNet?.construct ?? "—"], taal)}. Charge globale : ${driverNiveau}. ` + cit + `${disc}`,
      en:
        `Your most present drivers: ${lijst(aanwezig.length ? aanwezig : [p.driverTopNet?.construct ?? "—"], taal)}. Overall driver load: ${driverNiveau}. ` + cit + `${disc}`,
      es:
        `Tus drivers más presentes: ${lijst(aanwezig.length ? aanwezig : [p.driverTopNet?.construct ?? "—"], taal)}. Carga global: ${driverNiveau}. ` + cit + `${disc}`,
      ru:
        `Самые выраженные drivers: ${lijst(aanwezig.length ? aanwezig : [p.driverTopNet?.construct ?? "—"], taal)}. Общая нагрузка: ${driverNiveau}. ` + cit + `${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "driver_onder_druk") {
    const zwaar = p.driversEnergieverlies.slice(0, 2).map((d) => d.construct);
    const focusNaam = fociNamen[0] ?? "—";
    // Verbatim bewijs voor de zwaarst belastende driver: laat herkennen waaraan
    // dit concreet te merken is, in de eigen woorden uit de afname.
    // Citeer alleen verbatim als de belastende driver ZELF onderschreven
    // uitspraken heeft. Niet doorvallen naar een andere (bv. sterkste) driver:
    // dat zou een thematisch verkeerd citaat aan deze drivers koppelen.
    const cit = eersteCitaat(zwaar);
    const m: ML = {
      nl:
        `Onder druk slaan drivers het makkelijkst door. Bij jou vragen vooral ${lijst(zwaar.length ? zwaar : [p.driverTopNet?.construct ?? "—"], taal)} aandacht — die kunnen energie kosten. ` + cit +
        `Een concreet houvast: merk het vroege signaal op (bv. perfectie-drang of jezelf forceren), pauzeer even, en val terug op je sterkste focus "${focusNaam}" waar het wél vlot gaat. ` +
        `Zo zet je de driver om van rem naar bondgenoot. ${disc}`,
      fr:
        `Sous pression, les drivers s'emballent. Chez toi, surtout ${lijst(zwaar.length ? zwaar : [p.driverTopNet?.construct ?? "—"], taal)}. ` + cit + `Repère le signal précoce, fais une pause, et reviens à ton focus « ${focusNaam} ». ${disc}`,
      en:
        `Under pressure, drivers overshoot. For you, especially ${lijst(zwaar.length ? zwaar : [p.driverTopNet?.construct ?? "—"], taal)}. ` + cit + `Notice the early signal, pause, and fall back on your strongest focus "${focusNaam}". ${disc}`,
      es:
        `Bajo presión, los drivers se disparan. En ti, sobre todo ${lijst(zwaar.length ? zwaar : [p.driverTopNet?.construct ?? "—"], taal)}. ` + cit + `Detecta la señal temprana, haz una pausa y vuelve a tu foco «${focusNaam}». ${disc}`,
      ru:
        `Под давлением drivers перегибают. У вас особенно ${lijst(zwaar.length ? zwaar : [p.driverTopNet?.construct ?? "—"], taal)}. ` + cit + `Замечайте ранний сигнал, делайте паузу и возвращайтесь к фокусу «${focusNaam}». ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: p.driverLabel === "hoog" ? "coach" : null };
  }

  if (intentie === "taak_advies") {
    const f = fociNamen[0] ?? "—";
    const v = versnNamen[0] ?? "—";
    const m: ML = {
      nl:
        `Kies deze week een taak die je sterkste focus "${f}" raakt en die je via "${v}" kunt aanpakken — daar komt je energie het vlotst vrij. ` +
        `Houd taken die zwaar op je drivers leunen (bv. eindeloos bijschaven) bewust kort. ${disc}`,
      fr: `Choisis une tâche qui touche ton focus « ${f} » et que tu abordes via « ${v} ». Garde courtes les tâches qui sollicitent fort tes drivers. ${disc}`,
      en: `Pick a task that draws on your focus "${f}" and that you can tackle through "${v}". Keep driver-heavy tasks short. ${disc}`,
      es: `Elige una tarea que use tu foco «${f}» y que abordes con «${v}». Mantén cortas las tareas que cargan tus drivers. ${disc}`,
      ru: `Выберите задачу, опирающуюся на фокус «${f}» и решаемую через «${v}». Задачи с высокой нагрузкой drivers держите короткими. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "toekomst_loopbaan") {
    // Logische toekomst-/loopbaanrichting AFGELEID uit het profiel, zonder iets
    // te verzinnen. We benoemen GEEN concrete jobtitels (die staan niet in het
    // profiel), maar het SOORT werk/rol dat past bij de combinatie van de
    // sterkste talentfocus + sterkste versneller, met de driver als nuance.
    const f1 = fociNamen[0] ?? "—";
    const f2 = fociNamen[1] ?? null;
    const v1 = versnNamen[0] ?? "—";
    const v2 = versnNamen[1] ?? null;
    const driverNuance = p.driverTopNet?.construct ?? null;
    const fociTekst = f2 ? lijst([f1, f2], taal) : f1;
    const versnTekst = v2 ? lijst([v1, v2], taal) : v1;
    const tlEnergie = e1(p.energieVragenlijst);
    const tlEnergiePos = p.energieVragenlijst >= 6;
    const tlKost = p.driversEnergieverlies[0]?.construct ?? null;
    // Verbatim bewijs voor de stuwende driver — verankert de loopbaanrichting in
    // de eigen onderschreven uitspraken i.p.v. abstract advies.
    const tlCitaat = driverCitaat(driverNuance);
    const m: ML = {
      nl:
        `Ik geef geen kant-en-klare jobtitel — die laat ik bewust aan jou en je coach — maar je profiel bevat ruím genoeg om de richting heel concreet te maken. ` +
        `Je sterkste talentfoci zijn ${fociTekst}, en je brengt ze het krachtigst tot leven via ${versnTekst}. ` +
        `Toekomstig werk past dus het best wanneer "${f1}" de kérn van de rol is en je er "${v1}" volop in mag inzetten — als hoofdtaak, niet als bijzaak. ` +
        `Je gemeten energie van ${tlEnergie}/10 ${tlEnergiePos ? `bevestigt dat je in dit soort werk oplaadt in plaats van leegloopt` : `laat zien dat de omstandigheden je energie nu nog wegtrekken — een rol die expliciet op "${f1}" leunt, is precies wat dat keert`}. ` +
        (driverNuance
          ? `Eén nuance die je in elke volgende stap meeneemt: je driver "${driverNuance}" kan je vooruit stuwen en je het verschil laten maken, maar bewaak dat hij onder druk niet de regie overneemt. ` + tlCitaat
          : "") +
        (tlKost && tlKost !== driverNuance
          ? `Een rol waarin je vooral op "${tlKost}" moet leunen, zal je sneller leegtrekken — dat is je vroege signaal om door te schakelen. `
          : "") +
        `Concreet voor je volgende stap: zoek omgevingen waar "${f1}" en "${v1}" centraal staan, en toets elke optie aan de vraag "zet dit mijn sterkste focus voorop?". Een coach kan dit nog verder met je vertalen naar concrete functies. ${disc}`,
      fr:
        `Je ne donne pas d'intitulé de poste tout fait — je le laisse à toi et ton coach — mais ton profil contient de quoi rendre la direction très concrète. ` +
        `Tes focus les plus forts sont ${fociTekst}, que tu amplifies surtout via ${versnTekst}. ` +
        `Un travail futur te conviendra le mieux quand « ${f1} » est le cœur du rôle et que tu peux y déployer « ${v1} » pleinement. ` +
        `Ton énergie mesurée de ${tlEnergie}/10 ${tlEnergiePos ? `confirme que ce type de travail te recharge` : `montre que les circonstances te vident encore — un rôle centré sur « ${f1} » inverse cela`}. ` +
        (driverNuance ? `Nuance : ton driver « ${driverNuance} » peut te porter, mais veille à ce qu'il ne prenne pas les commandes sous pression. ` + tlCitaat : "") +
        (tlKost && tlKost !== driverNuance ? `Un rôle qui s'appuie surtout sur « ${tlKost} » te videra plus vite — c'est ton signal. ` : "") +
        `Concrètement : choisis des environnements où « ${f1} » et « ${v1} » sont centraux. Un coach peut traduire cela en fonctions concrètes avec toi. ${disc}`,
      en:
        `I won't give a ready-made job title — I leave that to you and your coach — but your profile has plenty to make the direction very concrete. ` +
        `Your strongest foci are ${fociTekst}, which you bring to life most through ${versnTekst}. ` +
        `Future work fits best when "${f1}" is the core of the role and you can deploy "${v1}" fully — as the main task, not a side one. ` +
        `Your measured energy of ${tlEnergie}/10 ${tlEnergiePos ? `confirms this kind of work recharges you rather than drains you` : `shows circumstances still drain you — a role explicitly built on "${f1}" is what turns that around`}. ` +
        (driverNuance ? `One nuance to carry into any next step: your "${driverNuance}" driver can propel you, but make sure it doesn't take over under pressure. ` + tlCitaat : "") +
        (tlKost && tlKost !== driverNuance ? `A role leaning mainly on "${tlKost}" will drain you faster — that's your signal to switch. ` : "") +
        `Concretely: choose environments where "${f1}" and "${v1}" are central, and test each option against "does this put my strongest focus first?". A coach can translate this further into concrete roles with you. ${disc}`,
      es:
        `No doy un puesto concreto — eso lo dejo a ti y a tu coach — pero tu perfil basta para hacer la dirección muy concreta. ` +
        `Tus focos más fuertes son ${fociTekst}, que potencias sobre todo con ${versnTekst}. ` +
        `Un trabajo futuro encaja mejor cuando «${f1}» es el núcleo del rol y puedes desplegar «${v1}» plenamente. ` +
        `Tu energía medida de ${tlEnergie}/10 ${tlEnergiePos ? `confirma que este tipo de trabajo te recarga` : `muestra que las circunstancias aún te vacían — un rol centrado en «${f1}» lo revierte`}. ` +
        (driverNuance ? `Un matiz: tu driver «${driverNuance}» puede impulsarte, pero cuida que no tome el mando bajo presión. ` + tlCitaat : "") +
        (tlKost && tlKost !== driverNuance ? `Un rol que se apoye sobre todo en «${tlKost}» te vaciará antes — esa es tu señal. ` : "") +
        `En concreto: elige entornos donde «${f1}» y «${v1}» sean centrales. Un coach puede traducir esto en funciones concretas contigo. ${disc}`,
      ru:
        `Я не даю готовую должность — это я оставляю вам и вашему коучу — но в вашем профиле достаточно, чтобы сделать направление очень конкретным. ` +
        `Ваши сильнейшие фокусы — ${fociTekst}, и ярче всего вы раскрываете их через ${versnTekst}. ` +
        `Будущая работа подойдёт лучше всего, когда «${f1}» — ядро роли, а «${v1}» можно применять полностью. ` +
        `Измеренная энергия ${tlEnergie}/10 ${tlEnergiePos ? `подтверждает, что такая работа вас подзаряжает` : `показывает, что обстоятельства ещё отнимают энергию — роль на основе «${f1}» это меняет`}. ` +
        (driverNuance ? `Нюанс: driver «${driverNuance}» может двигать вас вперёд, но следите, чтобы он не брал управление под давлением. ` + tlCitaat : "") +
        (tlKost && tlKost !== driverNuance ? `Роль, опирающаяся в основном на «${tlKost}», быстрее истощит вас — это ваш сигнал. ` : "") +
        `Конкретно: выбирайте среды, где «${f1}» и «${v1}» в центре. Коуч поможет перевести это в конкретные роли вместе с вами. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "ontwikkelen_groeien") {
    const zwak = [...p.foci].sort((a, b) => a.net - b.net)[0]?.construct ?? "—";
    const sterk = fociNamen[0] ?? "—";
    const m: ML = {
      nl:
        `Groei zit zelden in je zwakste gebied forceren. Bouw eerst verder op je sterkste focus "${sterk}" — daar is je rendement het hoogst. ` +
        `Wil je toch verbreden, dan is "${zwak}" je grootste rek; doseer dat in kleine, energiebewuste stappen in plaats van het te willen 'fixen'. ${disc}`,
      fr: `La croissance vient rarement de forcer ton point faible. Appuie d'abord sur ton focus « ${sterk} ». Pour t'élargir, « ${zwak} » offre le plus de marge, par petits pas. ${disc}`,
      en: `Growth rarely comes from forcing your weakest area. Build first on your strongest focus "${sterk}". To broaden, "${zwak}" offers the most stretch — in small, energy-aware steps. ${disc}`,
      es: `El crecimiento rara vez viene de forzar tu punto débil. Apóyate primero en tu foco «${sterk}». Para ampliar, «${zwak}» ofrece más margen, en pasos pequeños. ${disc}`,
      ru: `Рост редко приходит от форсирования слабого. Опирайтесь на фокус «${sterk}». Для расширения «${zwak}» даёт больше всего простора — маленькими шагами. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "verschil_zelfbeeld") {
    const richting =
      p.discrepantie < -1
        ? { nl: "hoger uit dan je vooraf inschatte", fr: "plus haut que ton estimation", en: "higher than your prior estimate", es: "más alto que tu estimación previa", ru: "выше вашей предварительной оценки" }
        : p.discrepantie > 1
        ? { nl: "lager uit dan je vooraf inschatte", fr: "plus bas que ton estimation", en: "lower than your prior estimate", es: "más bajo que tu estimación previa", ru: "ниже вашей предварительной оценки" }
        : { nl: "dicht bij je eigen inschatting", fr: "proche de ton estimation", en: "close to your own estimate", es: "cerca de tu estimación", ru: "близко к вашей оценке" };
    const herk =
      p.herkenbaarheid !== null
        ? {
            nl: ` De herkenbaarheid van je beeld is ${p.herkenbaarheid}/100${p.herkenbaarheid >= 70 ? " — dat is hoog, je profiel is dus goed herkenbaar." : "."}`,
            fr: ` Reconnaissance : ${p.herkenbaarheid}/100.`,
            en: ` Recognisability: ${p.herkenbaarheid}/100.`,
            es: ` Reconocibilidad: ${p.herkenbaarheid}/100.`,
            ru: ` Узнаваемость: ${p.herkenbaarheid}/100.`,
          }
        : { nl: "", fr: "", en: "", es: "", ru: "" };
    const m: ML = {
      nl:
        `Je gemeten energie (${e1(p.energieVragenlijst)}/10) kwam ${k(richting as ML, taal)} (${e1(p.baseline)}/10).${k(herk as ML, taal)} ` +
        `Een verschil is normaal: je vult vooraf een verwachting in, en de vragenlijst meet je werkelijke keuzes. Als iets niet klopt, neem het mee in een gesprek met je coach. ${disc}`,
      fr: `Ton énergie mesurée (${e1(p.energieVragenlijst)}/10) est ressortie ${k(richting as ML, taal)} (${e1(p.baseline)}/10).${k(herk as ML, taal)} Un écart est normal. ${disc}`,
      en: `Your measured energy (${e1(p.energieVragenlijst)}/10) came out ${k(richting as ML, taal)} (${e1(p.baseline)}/10).${k(herk as ML, taal)} A gap is normal. ${disc}`,
      es: `Tu energía medida (${e1(p.energieVragenlijst)}/10) resultó ${k(richting as ML, taal)} (${e1(p.baseline)}/10).${k(herk as ML, taal)} Una diferencia es normal. ${disc}`,
      ru: `Измеренная энергия (${e1(p.energieVragenlijst)}/10) оказалась ${k(richting as ML, taal)} (${e1(p.baseline)}/10).${k(herk as ML, taal)} Расхождение — это нормально. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "samenwerken_team") {
    const f = fociNamen[0] ?? "—";
    const v = versnNamen[0] ?? "—";
    const m: ML = {
      nl:
        `In een team voeg je het meest toe vanuit je sterkste focus "${f}", versterkt door "${v}". ` +
        `Zoek rollen waar dat gevraagd wordt, en stem af met collega's die sterk zijn waar jij minder energie vrijmaakt — zo vullen jullie elkaar aan. ${disc}`,
      fr: `En équipe, ta valeur vient surtout de ton focus « ${f} », renforcé par « ${v} ». Complète-toi avec des collègues forts là où tu l'es moins. ${disc}`,
      en: `In a team you add most from your focus "${f}", amplified by "${v}". Pair with colleagues strong where you're less energised. ${disc}`,
      es: `En equipo aportas sobre todo desde tu foco «${f}», reforzado por «${v}». Complétate con colegas fuertes donde tú lo eres menos. ${disc}`,
      ru: `В команде вы добавляете больше всего из фокуса «${f}», усиленного «${v}». Дополняйте себя коллегами, сильными там, где у вас меньше энергии. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "betekenis_score") {
    const m: ML = {
      nl:
        `De cijfers zijn relatief, niet absoluut. Een hoger getal bij een focus of versneller betekent dat die er bij jou sterker uitspringt dan de andere — het is een rangschikking binnen jóuw profiel, geen examencijfer. ` +
        `Energie (+/−) zegt of een gebied je voedt of kost. Samen vertellen ze waar je het best je tijd in steekt. ${disc}`,
      fr: `Les chiffres sont relatifs : un nombre plus élevé signifie que ce domaine ressort plus chez toi, pas une note d'examen. L'énergie (+/−) dit s'il te nourrit ou te coûte. ${disc}`,
      en: `The numbers are relative: a higher value means that area stands out more for you — a ranking within your profile, not an exam grade. Energy (+/−) tells you whether it feeds or costs you. ${disc}`,
      es: `Los números son relativos: un valor más alto significa que esa área destaca más en ti, no una nota. La energía (+/−) indica si te nutre o te cuesta. ${disc}`,
      ru: `Числа относительны: большее значение значит, что область сильнее выражена у вас — ранжирование внутри профиля, не оценка. Энергия (+/−) говорит, питает она или отнимает. ${disc}`,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  // ONBEKEND / niet direct herkende vraag.
  // We zeggen NIET langer "daar kan ik niet op antwoorden". In plaats daarvan
  // REDENEREN we puur uit de profielinhoud: verband tussen de sterkste
  // talentfoci, de versnellers, het energiebeeld en de driver, als logisch
  // vertrekpunt. Niets verzonnen - elk woord tussen aanhalingstekens en elk
  // cijfer komt rechtstreeks uit het profiel. Daarna: nodig uit om aan te scherpen.
  // Diepere onbekend-fallback: als er een profiel is, geven we NIET de magere
  // "stel je vraag scherper"-tekst maar de volledige synthese \u2014 zo krijgt de
  // gebruiker ook bij een vage vraag echte diepgang i.p.v. een dooddoener.
  if (p.heeftProfiel) {
    return { reply: bouwSynthese(), veiligheid: null };
  }
  const fbVersn = versnNamen[0] ?? "\u2014";
  const fbDriver = p.driverTopNet?.construct ?? null;
  const fbKost = p.driversEnergieverlies[0]?.construct ?? null;
  const fbEnergie = e1(p.energieVragenlijst);
  const fbFoci = lijst(fociNamen, taal);
  const m: ML = {
    nl:
      `Die vraag staat niet letterlijk in je profiel, maar ik laat je niet met lege handen \u2014 ik kan er vanuit redeneren. ` +
      `Je profiel laat zien dat je van nature naar ${fbFoci} trekt, en je komt het sterkst tot je recht wanneer je dat via "${fbVersn}" aanpakt. ` +
      `Je gemeten energie was ${fbEnergie}/10` +
      (fbKost ? `, en "${fbKost}" is het stuk dat je onder druk energie kan kosten` : "") + `. ` +
      `Een redelijk antwoord op bijna elke werkvraag volgt die lijn: weegt de keuze je sterkste focus en "${fbVersn}" m\u00e9\u00e9r in, of net minder? Wat het zwaarst leunt op ${fbDriver ? `je driver "${fbDriver}"` : "je drivers"}, houd je beter bewust kort. ` +
      `Stel je vraag gerust scherper \u2014 over je energie, je talenten, je toekomst of een concrete keuze \u2014 dan word ik concreter. ${disc}`,
    fr:
      `Cette question ne figure pas telle quelle dans ton profil, mais je ne te laisse pas sans r\u00e9ponse \u2014 je peux raisonner \u00e0 partir de lui. ` +
      `Ton profil montre que tu vas naturellement vers ${fbFoci}, et que tu donnes le meilleur via \u00ab ${fbVersn} \u00bb. ` +
      `Ton \u00e9nergie mesur\u00e9e \u00e9tait de ${fbEnergie}/10` +
      (fbKost ? `, et \u00ab ${fbKost} \u00bb peut te co\u00fbter de l'\u00e9nergie sous pression` : "") + `. ` +
      `Pour presque toute question de travail : ce choix sollicite-t-il davantage ta focus la plus forte et \u00ab ${fbVersn} \u00bb, ou moins ? Garde court ce qui p\u00e8se sur ${fbDriver ? `ton driver \u00ab ${fbDriver} \u00bb` : "tes drivers"}. ` +
      `Pr\u00e9cise ta question (\u00e9nergie, talents, avenir, choix concret) et je serai plus pr\u00e9cis. ${disc}`,
    en:
      `That question isn't literally in your profile, but I won't leave you empty-handed \u2014 I can reason from it. ` +
      `Your profile shows you naturally lean toward ${fbFoci}, and you're at your best when you tackle that through "${fbVersn}". ` +
      `Your measured energy was ${fbEnergie}/10` +
      (fbKost ? `, and "${fbKost}" is the part that can cost you energy under pressure` : "") + `. ` +
      `A reasonable answer to almost any work question follows that line: does the choice draw more on your strongest focus and "${fbVersn}", or less? Keep whatever leans hardest on ${fbDriver ? `your "${fbDriver}" driver` : "your drivers"} consciously short. ` +
      `Ask more sharply \u2014 about energy, talents, your future or a concrete choice \u2014 and I'll get more concrete. ${disc}`,
    es:
      `Esa pregunta no est\u00e1 literalmente en tu perfil, pero no te dejo sin respuesta \u2014 puedo razonar a partir de \u00e9l. ` +
      `Tu perfil muestra que te inclinas de forma natural hacia ${fbFoci}, y das lo mejor cuando lo abordas con \u00ab ${fbVersn} \u00bb. ` +
      `Tu energ\u00eda medida fue ${fbEnergie}/10` +
      (fbKost ? `, y \u00ab ${fbKost} \u00bb es lo que puede costarte energ\u00eda bajo presi\u00f3n` : "") + `. ` +
      `Para casi cualquier pregunta laboral: \u00bfesa opci\u00f3n usa m\u00e1s tu foco m\u00e1s fuerte y \u00ab ${fbVersn} \u00bb, o menos? Mant\u00e9n corto lo que m\u00e1s carga ${fbDriver ? `tu driver \u00ab ${fbDriver} \u00bb` : "tus drivers"}. ` +
      `Afina tu pregunta (energ\u00eda, talentos, futuro o una elecci\u00f3n concreta) y ser\u00e9 m\u00e1s concreto. ${disc}`,
    ru:
      `\u042d\u0442\u043e\u0433\u043e \u0432\u043e\u043f\u0440\u043e\u0441\u0430 \u043d\u0435\u0442 \u0431\u0443\u043a\u0432\u0430\u043b\u044c\u043d\u043e \u0432 \u0432\u0430\u0448\u0435\u043c \u043f\u0440\u043e\u0444\u0438\u043b\u0435, \u043d\u043e \u044f \u043d\u0435 \u043e\u0441\u0442\u0430\u0432\u043b\u044e \u0432\u0430\u0441 \u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0442\u0430 \u2014 \u044f \u043c\u043e\u0433\u0443 \u0440\u0430\u0441\u0441\u0443\u0436\u0434\u0430\u0442\u044c \u043d\u0430 \u0435\u0433\u043e \u043e\u0441\u043d\u043e\u0432\u0435. ` +
      `\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442, \u0447\u0442\u043e \u0432\u044b \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u0442\u044f\u0433\u043e\u0442\u0435\u0435\u0442\u0435 \u043a ${fbFoci} \u0438 \u0440\u0430\u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0435\u0441\u044c \u043b\u0443\u0447\u0448\u0435 \u0432\u0441\u0435\u0433\u043e \u0447\u0435\u0440\u0435\u0437 \u00ab ${fbVersn} \u00bb. ` +
      `\u0418\u0437\u043c\u0435\u0440\u0435\u043d\u043d\u0430\u044f \u044d\u043d\u0435\u0440\u0433\u0438\u044f \u2014 ${fbEnergie}/10` +
      (fbKost ? `, \u0430 \u00ab ${fbKost} \u00bb \u043c\u043e\u0436\u0435\u0442 \u043e\u0442\u043d\u0438\u043c\u0430\u0442\u044c \u044d\u043d\u0435\u0440\u0433\u0438\u044e \u043f\u043e\u0434 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c` : "") + `. ` +
      `\u041e\u0442\u0432\u0435\u0442 \u043f\u043e\u0447\u0442\u0438 \u043d\u0430 \u043b\u044e\u0431\u043e\u0439 \u0440\u0430\u0431\u043e\u0447\u0438\u0439 \u0432\u043e\u043f\u0440\u043e\u0441 \u0438\u0434\u0451\u0442 \u043f\u043e \u044d\u0442\u043e\u0439 \u043b\u0438\u043d\u0438\u0438: \u0437\u0430\u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043b\u0438 \u0432\u044b\u0431\u043e\u0440 \u0431\u043e\u043b\u044c\u0448\u0435 \u0432\u0430\u0448 \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0439 \u0444\u043e\u043a\u0443\u0441 \u0438 \u00ab ${fbVersn} \u00bb \u2014 \u0438\u043b\u0438 \u043c\u0435\u043d\u044c\u0448\u0435? \u0422\u043e, \u0447\u0442\u043e \u0441\u0438\u043b\u044c\u043d\u0435\u0435 \u043e\u043f\u0438\u0440\u0430\u0435\u0442\u0441\u044f \u043d\u0430 ${fbDriver ? `driver \u00ab ${fbDriver} \u00bb` : "\u0432\u0430\u0448\u0438 drivers"}, \u0434\u0435\u0440\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u043c. ` +
      `\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u0432\u043e\u043f\u0440\u043e\u0441 \u0442\u043e\u0447\u043d\u0435\u0435 (\u043e\u0431 \u044d\u043d\u0435\u0440\u0433\u0438\u0438, \u0442\u0430\u043b\u0430\u043d\u0442\u0430\u0445, \u0431\u0443\u0434\u0443\u0449\u0435\u043c \u0438\u043b\u0438 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u043e\u043c \u0432\u044b\u0431\u043e\u0440\u0435) \u2014 \u0438 \u044f \u043e\u0442\u0432\u0435\u0447\u0443 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u0435\u0435. ${disc}`,
  };
  return { reply: k(m, taal), veiligheid: null };
}
