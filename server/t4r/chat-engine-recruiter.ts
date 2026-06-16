// ---------------------------------------------------------------------------
// TaPas 4 Recruitment — Recruiter-/investeerdersassistent-engine (demo, zonder
// externe LLM).
//
// WAAROM DEZE ENGINE BESTAAT
// In de gepubliceerde demo is er geen live taalmodel bereikbaar. Toch moet de
// recruiter-assistent ECHT en DIEP op de vraag reageren — net zoals de
// Kompas-assistent (server/chat-engine.ts) dat doet voor de deelnemer. Het
// register is hier anders: de gebruiker is een recruiter of een KRITISCHE
// INVESTEERDER die challenging vragen stelt over de vergelijkende studie.
//
// HOE
//   1. herkenIntentie()  -> classificeert de vraag (meertalig, trefwoord/regex,
//                           accent-ongevoelig). Volgorde = prioriteit.
//   2. detecteerVraagTaal() -> taal van de VRAAG (nl/fr/en/es/ru).
//   3. beantwoordRecruiter() -> REDENEERT PUUR uit de berekende MatchUitkomst:
//      need-lijnen, energiewaakpunten, risicovlaggen, kritische succescriteria
//      en het eindoordeel. Elk cijfer en elk label komt RECHTSTREEKS uit de
//      studie. Niets wordt verzonnen.
//
// GARANTIE: geen hallucinaties. Elk feit komt OFWEL uit een vaste, correcte
// uitleg (kennisbank) OFWEL uit de MatchUitkomst (de gemeten studie). Er wordt
// nooit een cijfer, lijn of risico verzonnen.
//
// VASTE INSTRUMENTREGEL: de assistent is een LEESHULP bij het eindrapport. Het
// instrument is RICHTINGGEVEND; het besluit (aanwerving, rangschikking,
// investeringsbeslissing) blijft bij de stakeholders + procesbegeleider. De
// assistent doet dus NOOIT een geschiktheids-, selectie-, rangschikkings- of
// aanwervingsuitspraak. "Driver" (naar Taibi Kahler) blijft beschermd &
// onvertaald.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import {
  EINDOORDEEL_LABEL,
  VERVULLING_LABEL,
  ENERGIE_LABEL,
  type MatchUitkomst,
  type ConstructResultaat,
} from "./match";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal): string => m[t] ?? m.nl;

// --- Normalisatie + taaldetectie (gelijk aan de Kompas-engine) -------------

function normaliseer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accenten weg
    .replace(/['\u2019\u02bc`]/g, " ") // apostroffen -> spatie
    .replace(/[?!.,;:]/g, " ") // leestekens weg
    .replace(/\s+/g, " ")
    .trim();
}

// Lichte, regelgebaseerde taaldetectie: geeft de taal van de VRAAG terug zodat
// een recruiter/investeerder in zijn eigen taal antwoord krijgt, los van de
// opgeslagen sessietaal. Valt terug op de standaardtaal.
export function detecteerVraagTaal(vraag: string, standaard: Taal = "nl"): Taal {
  const raw = String(vraag ?? "");
  if (/[\u0400-\u04ff]/.test(raw)) return "ru"; // Cyrillisch => Russisch
  const q = normaliseer(raw);
  if (!q) return standaard;
  const woorden = q.split(" ").filter(Boolean);
  const has = (...ws: string[]) => ws.some((w) => woorden.includes(w));
  const count = (...ws: string[]) => ws.filter((w) => woorden.includes(w)).length;
  const score: Record<Exclude<Taal, "ru">, number> = { nl: 0, fr: 0, en: 0, es: 0 };
  score.nl += 2 * count("wat", "hoe", "welke", "waarom", "zijn", "het", "een", "deze", "kandidaat", "rol", "risico", "need", "niet", "geen", "kan", "moet", "ik", "we", "is", "van", "voor", "bij", "meest", "betekent");
  score.en += 2 * count("what", "how", "which", "why", "are", "the", "a", "this", "candidate", "role", "risk", "need", "not", "can", "should", "i", "we", "is", "of", "for", "most", "means", "does", "fit");
  score.fr += 2 * count("quoi", "comment", "quels", "quelle", "pourquoi", "le", "la", "les", "ce", "cette", "candidat", "role", "risque", "besoin", "pas", "ne", "peut", "doit", "je", "nous", "est", "de", "pour", "que", "qu", "signifie");
  score.es += 2 * count("que", "como", "cuales", "cual", "porque", "el", "la", "los", "este", "esta", "candidato", "rol", "riesgo", "necesidad", "no", "puede", "debe", "yo", "nosotros", "es", "de", "para", "mas", "significa");
  if (/\u00bf/.test(raw)) score.es += 3; // ¿ => Spaans
  if (has("qu")) score.fr += 1;
  let beste: Taal = standaard;
  let max = 0;
  (Object.keys(score) as Array<Exclude<Taal, "ru">>).forEach((t) => {
    if (score[t] > max) { max = score[t]; beste = t; }
  });
  return max > 0 ? beste : standaard;
}

// --- INTENTIE-HERKENNING ----------------------------------------------------

export type RecruiterIntentie =
  | "buiten_kader" // beslis-/rangschik-/investeer-uitspraak gevraagd (leeshulp-grens)
  | "wat_is_need" // begripsvraag: need/nice/not-needed
  | "wat_is_driver" // begripsvraag: driver
  | "wat_is_energie" // begripsvraag: energie / energiewaakpunt
  | "wat_is_eindoordeel" // begripsvraag: hoe komt het eindoordeel tot stand
  | "wat_is_t4r" // begripsvraag: wat doet deze studie
  | "eindoordeel" // het eindoordeel en de motivatie ervan
  | "needs_aandacht" // welke need-lijnen vragen aandacht / mismatch
  | "needs_sterk" // wat zit goed / de sterke matches
  | "kritisch" // de kritische succescriteria
  | "energiewaakpunten" // sterk/voldoende maar energie-kostende lijnen
  | "risicos" // risicovlaggen
  | "duurzaamheid" // duurzaamheid / volhoudbaarheid op termijn
  | "challenge_zwakte" // "overtuig me / waarom zou dit toch werken / wat is het zwakste punt"
  | "vergelijk_lijn" // specifieke lijn opvragen (naam in de vraag)
  | "wat_betekent_score" // hoe lees ik de cijfers / niveaus
  | "verdieping" // doorvraag: leg de verbanden / de rode draad / denk dieper mee
  | "groet"
  | "dankjewel"
  | "onbekend";

const PATRONEN: { intentie: RecruiterIntentie; sleutels: string[] }[] = [
  // De LEESHULP-GRENS krijgt voorrang: zodra de gebruiker een beslissing,
  // rangschikking of investeringsoordeel VRAAGT, wijzen we dat warm af en
  // verwijzen we naar de stakeholders + procesbegeleider. Wél bieden we daarna
  // de onderbouwing uit de studie aan.
  {
    intentie: "buiten_kader",
    sleutels: [
      // NL
      "moeten we aanwerven", "moet ik aanwerven", "zou je aanwerven", "aannemen of niet",
      "is dit de juiste kandidaat", "is hij geschikt", "is zij geschikt", "is deze kandidaat geschikt",
      "moeten we investeren", "moet ik investeren", "is dit een goede investering", "rangschik",
      "wie is de beste", "geef een score van 10", "welke kandidaat kies", "ga ik akkoord", "moeten we tekenen",
      "raad je aan", "wat zou jij beslissen", "beslis voor mij", "moeten we deze deal", "is dit team te vertrouwen",
      // EN
      "should we hire", "should i hire", "would you hire", "hire or not", "is this the right candidate",
      "is he suitable", "is she suitable", "should we invest", "should i invest", "is this a good investment",
      "rank the", "who is the best", "give a score out of 10", "which candidate should", "do you recommend",
      "what would you decide", "decide for me", "should we sign", "can this team be trusted",
      // FR
      "devons nous recruter", "dois je recruter", "embaucher ou non", "est ce le bon candidat",
      "est il apte", "est elle apte", "devons nous investir", "dois je investir", "est ce un bon investissement",
      "classe les", "qui est le meilleur", "quel candidat choisir", "recommandes tu", "que deciderais tu",
      // ES
      "deberiamos contratar", "deberia contratar", "contratar o no", "es el candidato adecuado",
      "es apto", "es apta", "deberiamos invertir", "es una buena inversion", "clasifica",
      "quien es el mejor", "que candidato elegir", "recomiendas",
      // RU
      "стоит ли нанимать", "нанять или нет", "подходит ли кандидат", "стоит ли инвестировать",
      "это хорошая инвестиция", "ранжируй", "кто лучший", "какого кандидата", "рекомендуешь",
    ],
  },
  // Begripsvragen.
  {
    intentie: "wat_is_need",
    sleutels: [
      "wat is een need", "wat betekent need", "wat is need nice", "verschil need nice", "wat is not needed",
      "wat is nice to have", "betekenis need", "what is a need", "what does need mean", "need vs nice",
      "qu est ce qu un need", "que signifie need", "que es un need", "что такое need",
    ],
  },
  {
    intentie: "wat_is_driver",
    sleutels: [
      "wat is een driver", "wat zijn drivers", "wat betekent driver", "uitleg driver",
      "what is a driver", "what are drivers", "qu est ce qu un driver", "que es un driver",
      "что такое driver", "что такое драйвер", "wat doen drivers",
    ],
  },
  {
    intentie: "wat_is_energie",
    sleutels: [
      "wat is een energiewaakpunt", "wat betekent energie", "wat is energie in", "hoe lees ik energie",
      "wat is een waakpunt", "what is an energy watch", "what does energy mean", "energiestatus uitleg",
      "que signifie energie", "que es la energia", "что значит энергия", "wat is geeft energie", "kost energie betekenis",
    ],
  },
  {
    intentie: "wat_is_eindoordeel",
    sleutels: [
      "hoe komt het eindoordeel", "hoe wordt het oordeel berekend", "hoe bepaal je match", "waarop is het oordeel gebaseerd",
      "hoe ontstaat de mismatch", "hoe werkt de berekening", "drempel", "drempels", "thresholds",
      "how is the verdict", "how is the score calculated", "how is match determined", "on what is the verdict based",
      "comment le verdict", "comment est calcule", "como se calcula el veredicto", "как рассчитывается вывод",
    ],
  },
  {
    intentie: "wat_is_t4r",
    sleutels: [
      "wat is dit rapport", "wat doet deze studie", "waar gaat deze studie over", "wat meet deze studie",
      "wat is de vergelijkende studie", "hoe werkt t4r", "wat is tapas 4 recruitment",
      "what is this report", "what does this study", "what is the comparative study",
      "qu est ce que cette etude", "que es este estudio", "что это за исследование", "wat houdt dit in",
    ],
  },
  {
    intentie: "wat_betekent_score",
    sleutels: [
      "wat betekent de net score", "wat betekent net", "wat betekenen de cijfers", "hoe lees ik de cijfers",
      "wat is sterk aanwezig", "wat betekent aanwezig", "betekenis van de niveaus", "hoe interpreteer ik",
      "what does the net score", "what do the numbers mean", "how do i read the levels",
      "que signifient les chiffres", "que significan los numeros", "что означают цифры",
    ],
  },
  // De CHALLENGE: kritische investeerdersvraag naar het zwakste punt / het
  // weerleggen. Moet vóór needs_aandacht/eindoordeel staan, anders kapen die.
  {
    intentie: "challenge_zwakte",
    sleutels: [
      // NL
      "zwakste punt", "zwakke punt", "grootste risico", "grootste zwakte", "grootste zwakheid", "wat is het zwakste",
      "waar gaat dit fout", "waar kan dit mislukken",
      "overtuig me", "weerleg", "speel advocaat van de duivel", "devil s advocate", "wat als dit fout gaat",
      "waarom zou dit toch werken", "waar zit het addertje", "wat zie ik over het hoofd", "wat is de zwakke plek",
      "deal breaker", "dealbreaker", "knock out", "knockout", "rode vlag", "rode vlaggen", "red flag",
      "waar moet ik het meest bezorgd", "waarom zou ik twijfelen", "wat is de keerzijde", "speel het hard",
      // EN
      "weakest point", "biggest risk", "biggest weakness", "greatest weakness", "main risk", "key risk",
      "what is the weakest", "where does this fail", "where could this fail",
      "convince me", "rebut", "play devil", "what if this goes wrong", "why would this still work",
      "where is the catch", "what am i missing", "the weak spot", "red flag", "red flags",
      "what should i worry", "why would i doubt", "what is the downside", "make the bear case",
      // FR
      "point le plus faible", "plus grand risque", "plus grande faiblesse", "principale faiblesse", "risque principal",
      "ou cela echoue", "convaincs moi", "avocat du diable",
      "et si ca tourne mal", "pourquoi cela marcherait", "ou est le piege", "qu est ce qui m echappe",
      "point faible", "drapeau rouge", "le revers", "le risque le plus grand",
      // ES
      "punto mas debil", "mayor riesgo", "mayor debilidad", "principal debilidad", "riesgo principal", "mayor flaqueza",
      "donde falla", "convenceme", "abogado del diablo",
      "y si sale mal", "por que funcionaria", "donde esta la trampa", "que se me escapa", "bandera roja", "punto flaco",
      // RU
      "самое слабое", "наибольший риск", "главный риск", "основной риск", "ключевой риск", "главная слабость",
      "самая большая слабость", "где провал", "убеди меня", "адвокат дьявола",
      "что если", "в чём подвох", "что я упускаю", "красный флаг", "слабое место",
    ],
  },
  {
    intentie: "verdieping",
    sleutels: [
      // NL — doorvraag in zakelijk register (NIET de "zwakste punt"-challenge)
      "ga dieper", "dieper", "op een dieper niveau", "dieper niveau", "meer diepgang",
      "leg het verband", "wat is het verband", "welk verband", "verbind de bevindingen",
      "verbind", "hoe hangt dat samen", "hoe hangen die samen", "wat is de rode draad",
      "rode draad", "het grotere plaatje", "grotere plaatje", "denk dieper", "denk mee",
      "denk dieper mee", "analyseer dieper", "wat zit erachter", "wat zit hierachter",
      "achterliggende", "achterliggend patroon", "leg de samenhang", "samenhang",
      "wat zegt dit als geheel", "lees het geheel", "synthese", "integreer", "wat betekent dit samen",
      // EN
      "go deeper", "deeper", "on a deeper level", "deeper level", "connect the findings",
      "connect the dots", "what is the connection", "the through-line", "through line",
      "the bigger picture", "bigger picture", "think deeper", "underlying pattern", "underlying",
      "what is behind this", "the synthesis", "synthesis", "read it as a whole", "what does this mean together",
      // FR
      "va plus loin", "plus profond", "niveau plus profond", "fais le lien", "le lien entre",
      "relie les constats", "le fil rouge", "vue d ensemble", "creuse", "le motif sous jacent",
      "la synthese", "lis l ensemble", "qu est ce que cela dit dans l ensemble",
      // ES
      "ve mas profundo", "mas profundo", "nivel mas profundo", "conecta los hallazgos",
      "cual es la conexion", "el hilo conductor", "el panorama general", "profundiza",
      "el patron subyacente", "la sintesis", "lee el conjunto",
      // RU
      "глубже", "копни глубже", "свяжи выводы", "какая связь", "общая нить", "общая картина",
      "скрытый паттерн", "синтез", "прочитай как целое", "что это значит в целом",
    ],
  },
  {
    intentie: "duurzaamheid",
    sleutels: [
      "duurzaam", "duurzaamheid", "op termijn", "op lange termijn", "houdt dit vol", "volhoudbaar", "volhouden",
      "blijft dit", "uitval", "burn-out risico", "burnout risico", "uitputting",
      "sustainable", "long term", "over time", "will this last", "durability", "burnout risk",
      "durable", "a long terme", "tiendra", "sostenible", "a largo plazo", "устойчиво", "в долгосрочной",
    ],
  },
  {
    intentie: "kritisch",
    sleutels: [
      "kritische succescriteria", "kritisch succescriterium", "kritische need", "kritische lijn", "kritische punten",
      "wat is kritisch", "welke kritische", "critical success criteria", "critical need", "what is critical",
      "criteres critiques", "critere critique", "criterios criticos", "критические критерии", "что критично",
    ],
  },
  {
    intentie: "energiewaakpunten",
    sleutels: [
      "energiewaakpunt", "energiewaakpunten", "energie waakpunt", "energie kost", "kost energie", "energiekostend",
      "waar zit het energierisico", "energie risico", "energy watch", "energy watch point", "energy cost",
      "point d attention energie", "energie coute", "punto de atencion de energia", "энергия отнимает", "точки внимания по энергии",
    ],
  },
  {
    intentie: "risicos",
    sleutels: [
      "risicovlag", "risicovlaggen", "welke risico", "welke risicos", "wat zijn de risico", "risico s",
      "structureel risico", "risk flag", "risk flags", "which risks", "what are the risks",
      "drapeau de risque", "drapeaux de risque", "quels risques", "bandera de riesgo", "banderas de riesgo", "que riesgos",
      "флаг риска", "флаги риска", "какие риски",
    ],
  },
  {
    intentie: "needs_aandacht",
    sleutels: [
      "welke need", "need lijnen aandacht", "wat vraagt aandacht", "welke lijnen aandacht", "aandachtspunten",
      "wat scoort zwak", "wat is de mismatch", "welke mismatch", "waar zit de mismatch", "wat zit niet goed",
      "which need lines", "what needs attention", "where is the mismatch", "attention points", "what scores weak",
      "quelles lignes need", "qu est ce qui demande attention", "ou est la non correspondance",
      "que lineas need", "que requiere atencion", "какие линии need", "что требует внимания",
    ],
  },
  {
    intentie: "needs_sterk",
    sleutels: [
      "wat zit goed", "wat is sterk", "sterke matches", "wat scoort goed", "wat klopt wel", "sterke punten",
      "what is strong", "what fits well", "strong matches", "what scores well", "strengths",
      "quels points forts", "qu est ce qui correspond bien", "que esta bien", "puntos fuertes",
      "что сильно", "сильные стороны", "что хорошо",
    ],
  },
  {
    intentie: "vergelijk_lijn",
    sleutels: [
      "hoe scoort", "wat is de score voor", "vertel meer over", "leg uit over de lijn", "hoe zit het met",
      "how does it score on", "what about the line", "tell me more about", "explain the line",
      "comment se situe", "que dit la ligne", "como puntua", "que dice la linea", "как обстоит",
    ],
  },
  {
    intentie: "eindoordeel",
    sleutels: [
      "eindoordeel", "het oordeel", "wat is de uitkomst", "wat is het resultaat", "samenvatting", "conclusie",
      "wat zegt de studie", "geef een overzicht", "final verdict", "the verdict", "what is the outcome",
      "summary", "conclusion", "overview", "verdict final", "le verdict", "resume", "veredicto", "resumen",
      "итоговый вывод", "вывод", "итог", "резюме",
    ],
  },
  {
    intentie: "groet",
    sleutels: ["hallo", "hoi", "hey", "goeiedag", "goedemorgen", "dag ", "bonjour", "hello", "hi ", "hola", "привет"],
  },
  {
    intentie: "dankjewel",
    sleutels: ["dank", "bedankt", "merci", "thanks", "thank you", "gracias", "спасибо"],
  },
];

export function herkenIntentie(vraag: string): RecruiterIntentie {
  const q = normaliseer(vraag);
  if (!q) return "onbekend";
  for (const p of PATRONEN) {
    for (const sleutel of p.sleutels) {
      if (q.includes(normaliseer(sleutel))) return p.intentie;
    }
  }
  return "onbekend";
}

// --- ANTWOORD-OPBOUW --------------------------------------------------------

const DISCLAIMER: ML = {
  nl: "Dit is een leeshulp bij de vergelijkende studie, geen aanwervings-, rangschikkings- of investeringsbeslissing.",
  fr: "Ceci est une aide à la lecture de l'étude comparative, pas une décision d'embauche, de classement ou d'investissement.",
  en: "This is a reading aid for the comparative study, not a hiring, ranking or investment decision.",
  es: "Esto es una ayuda de lectura del estudio comparativo, no una decisión de contratación, clasificación o inversión.",
  ru: "Это помощник по чтению сравнительного исследования, а не решение о найме, ранжировании или инвестициях.",
};

const GEEN_STUDIE: ML = {
  nl: "Er is nog geen berekende vergelijkende studie. Sluit eerst het rolprofiel en laad een geverifieerd kandidaatrapport op — daarna kan ik de studie heel concreet met je doorlezen.",
  fr: "Aucune étude comparative calculée pour l'instant. Clôture d'abord le profil de rôle et téléverse un rapport candidat vérifié — ensuite je pourrai parcourir l'étude concrètement avec toi.",
  en: "There is no calculated comparative study yet. First close the role profile and upload a verified candidate report — then I can walk through the study with you concretely.",
  es: "Aún no hay un estudio comparativo calculado. Cierra primero el perfil del rol y sube un informe de candidato verificado; luego podré revisar el estudio contigo de forma concreta.",
  ru: "Рассчитанного сравнительного исследования пока нет. Сначала закройте профиль роли и загрузите проверенный отчёт кандидата — затем я смогу подробно разобрать исследование с вами.",
};

// Kennisbank: vaste, correcte uitleg per begrip (profielonafhankelijk).
const KENNIS: Record<string, ML> = {
  need: {
    nl: "Elke roleis is in het rolprofiel geclassificeerd als need (echt vereist), nice (meerwaarde maar niet vereist) of not-needed (de rol vraagt het niet). De match wordt vooral gewogen op de need-lijnen: dat zijn de dragende eisen. Een need kan bovendien als 'kritisch succescriterium' gemarkeerd zijn — dan weegt hij extra zwaar.",
    fr: "Chaque exigence du rôle est classée dans le profil comme need (réellement requis), nice (valeur ajoutée mais non requise) ou not-needed (le rôle ne le demande pas). La correspondance se juge surtout sur les lignes need : ce sont les exigences porteuses. Un need peut être marqué « critère de réussite critique » — il pèse alors davantage.",
    en: "Each role requirement is classified in the role profile as need (truly required), nice (added value but not required) or not-needed (the role does not ask for it). The match is weighed mainly on the need lines: those are the load-bearing requirements. A need can also be marked a 'critical success criterion' — then it carries extra weight.",
    es: "Cada requisito del rol se clasifica en el perfil como need (realmente requerido), nice (valor añadido pero no requerido) o not-needed (el rol no lo pide). La coincidencia se pondera sobre todo en las líneas need: son los requisitos portantes. Un need puede marcarse como 'criterio crítico' y entonces pesa más.",
    ru: "Каждое требование роли классифицируется в профиле как need (действительно необходимо), nice (доп. ценность, но не обязательно) или not-needed (роль этого не требует). Совпадение оценивается прежде всего по линиям need — это несущие требования. Need может быть отмечен как «критический критерий» — тогда он весит больше.",
  },
  driver: {
    nl: "Een driver is een innerlijke 'aandrijver' (naar Taibi Kahler): een onbewuste overtuiging zoals \"wees sterk\" of \"wees perfect\". In een rolprofiel kan een driver gevraagd of net ongewenst zijn, want onder druk slaat een driver door en kost dan energie. De term blijft bewust onvertaald.",
    fr: "Un driver est un « moteur » intérieur (d'après Taibi Kahler) : une croyance inconsciente comme « sois fort » ou « sois parfait ». Dans un profil de rôle, un driver peut être demandé ou indésirable, car sous pression il s'emballe et coûte de l'énergie. Le terme reste non traduit.",
    en: "A driver is an inner 'motor' (after Taibi Kahler): an unconscious belief such as \"be strong\" or \"be perfect\". In a role profile a driver can be required or unwanted, because under pressure a driver overshoots and then costs energy. The term stays untranslated.",
    es: "Un driver es un 'motor' interior (según Taibi Kahler): una creencia inconsciente como «sé fuerte» o «sé perfecto». En un perfil de rol un driver puede ser requerido o no deseado, porque bajo presión se dispara y cuesta energía. El término se mantiene sin traducir.",
    ru: "Driver — это внутренний «мотор» (по Taibi Kahler): бессознательное убеждение, например «будь сильным» или «будь совершенным». В профиле роли driver может быть нужен или нежелателен, ведь под давлением он перегибает и отнимает энергию. Термин не переводится.",
  },
  energie: {
    nl: "Energie zegt of een gevraagde lijn de kandidaat energie GEEFT, NEUTRAAL is of energie KOST. Bij de need-lijnen telt energie als beschikbaarheidstoets: een lijn kan inhoudelijk sterk aanwezig zijn én tóch energie kosten. Dat noemen we een energiewaakpunt — niet dat de kandidaat het niet kan, wel dat het op termijn vraagt om bewuste dosering.",
    fr: "L'énergie indique si une ligne demandée DONNE de l'énergie au candidat, est NEUTRE ou en COÛTE. Sur les lignes need, l'énergie sert de test de disponibilité : une ligne peut être fortement présente sur le fond et coûter quand même de l'énergie. C'est un point d'attention énergie — non que le candidat ne sait pas faire, mais qu'à terme cela demande un dosage conscient.",
    en: "Energy tells you whether a required line GIVES the candidate energy, is NEUTRAL, or COSTS energy. On the need lines, energy acts as an availability test: a line can be strongly present in substance yet still cost energy. We call that an energy watch point — not that the candidate cannot do it, but that over time it calls for conscious pacing.",
    es: "La energía indica si una línea requerida DA energía al candidato, es NEUTRAL o le CUESTA energía. En las líneas need, la energía funciona como prueba de disponibilidad: una línea puede estar muy presente en lo sustantivo y aun así costar energía. Eso es un punto de atención de energía: no que el candidato no pueda, sino que a largo plazo requiere dosificación consciente.",
    ru: "Энергия показывает, ДАЁТ ли требуемая линия кандидату энергию, НЕЙТРАЛЬНА она или ОТНИМАЕТ энергию. На линиях need энергия — это тест доступности: линия может быть сильно выражена по сути и при этом отнимать энергию. Это точка внимания по энергии — не то, что кандидат не может, а то, что со временем нужна осознанная дозировка.",
  },
  eindoordeel: {
    nl: "Het eindoordeel volgt uit drie zichtbare drempels op de nettoscore (sterk ≥ +3, aanwezig 0..+2, afwezig ≤ −3) plus de aggregatieregels: een kritische need die een inhoudelijke mismatch scoort of drie samenvallende risicovlaggen leidt tot 'Mismatch'; een kritische need die aandacht vraagt, meer dan een derde van de needs op aandacht, of één à twee risicovlaggen leidt tot 'Match met aandacht'; anders 'Match'. Geen verborgen rekenregels — alles is narekenbaar.",
    fr: "Le verdict découle de trois seuils visibles sur le score net (fort ≥ +3, présent 0..+2, absent ≤ −3) plus les règles d'agrégation : un need critique en non-correspondance de fond ou trois drapeaux de risque coïncidents donnent « Non-correspondance » ; un need critique qui demande attention, plus d'un tiers des needs en attention, ou un à deux drapeaux donnent « Correspondance avec attention » ; sinon « Correspondance ». Aucune règle cachée — tout est vérifiable.",
    en: "The verdict follows from three visible thresholds on the net score (strong ≥ +3, present 0..+2, absent ≤ −3) plus the aggregation rules: a critical need scoring a substantive mismatch, or three coinciding risk flags, yields 'Mismatch'; a critical need calling for attention, more than a third of needs on attention, or one to two risk flags yields 'Match with attention'; otherwise 'Match'. No hidden math — everything is checkable.",
    es: "El veredicto se deriva de tres umbrales visibles sobre la puntuación neta (fuerte ≥ +3, presente 0..+2, ausente ≤ −3) más las reglas de agregación: un need crítico con no coincidencia sustantiva, o tres banderas de riesgo coincidentes, da 'No coincidencia'; un need crítico que requiere atención, más de un tercio de needs en atención, o una o dos banderas da 'Coincidencia con atención'; si no, 'Coincidencia'. Sin cálculos ocultos: todo es verificable.",
    ru: "Вывод следует из трёх видимых порогов по чистому баллу (сильно ≥ +3, присутствует 0..+2, отсутствует ≤ −3) плюс правила агрегации: критический need с содержательным несоответствием или три совпадающих флага риска дают «Несоответствие»; критический need, требующий внимания, более трети needs на внимании, или один-два флага дают «Совпадение с вниманием»; иначе «Совпадение». Никакой скрытой математики — всё проверяемо.",
  },
  t4r: {
    nl: "De vergelijkende studie confronteert het in alignment gebouwde rolprofiel (de norm: need/nice/not-needed per lijn) met een geverifieerd kandidaatrapport (de meting: nettoscore + energie per lijn). Ze toont per lijn of de gevraagde eis vervuld is, of de energie die lijn draagt, welke risicovlaggen samenvallen, en een eindoordeel met motivatie. Het is een gestructureerde leeshulp — richtinggevend, niet beslissend.",
    fr: "L'étude comparative confronte le profil de rôle construit en alignement (la norme : need/nice/not-needed par ligne) à un rapport candidat vérifié (la mesure : score net + énergie par ligne). Elle montre par ligne si l'exigence est remplie, si l'énergie porte cette ligne, quels drapeaux de risque coïncident, et un verdict motivé. C'est une aide à la lecture structurée — orientante, pas décisive.",
    en: "The comparative study confronts the role profile built in alignment (the norm: need/nice/not-needed per line) with a verified candidate report (the measurement: net score + energy per line). It shows per line whether the requirement is met, whether energy carries that line, which risk flags coincide, and a motivated verdict. It is a structured reading aid — directional, not decisive.",
    es: "El estudio comparativo confronta el perfil de rol construido en alineación (la norma: need/nice/not-needed por línea) con un informe de candidato verificado (la medición: puntuación neta + energía por línea). Muestra por línea si el requisito se cumple, si la energía sostiene esa línea, qué banderas de riesgo coinciden y un veredicto motivado. Es una ayuda de lectura estructurada: orientativa, no decisiva.",
    ru: "Сравнительное исследование сопоставляет профиль роли, построенный в согласовании (норма: need/nice/not-needed по линии), с проверенным отчётом кандидата (измерение: чистый балл + энергия по линии). Оно показывает по каждой линии, выполнено ли требование, несёт ли энергия эту линию, какие флаги риска совпадают, и обоснованный вывод. Это структурированный помощник по чтению — направляющий, не решающий.",
  },
};

// Hulpfuncties op de uitkomst.
function isNeed(c: ConstructResultaat): boolean {
  return c.classificatie === "need";
}
function lijst(items: string[], taal: Taal): string {
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0]!;
  const en: ML = { nl: " en ", fr: " et ", en: " and ", es: " y ", ru: " и " };
  return items.slice(0, -1).join(", ") + k(en, taal) + items[items.length - 1];
}
function sign(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}

// Korte, leesbare lijnbeschrijving in de antwoordtaal.
function lijnTekst(c: ConstructResultaat, taal: Taal): string {
  const krit = c.kritisch
    ? k({ nl: " [kritisch]", fr: " [critique]", en: " [critical]", es: " [crítico]", ru: " [критич.]" }, taal)
    : "";
  return `"${c.construct.label}"${krit} — ${VERVULLING_LABEL[c.niveau]} (net ${sign(c.net)}), ${ENERGIE_LABEL[c.energie].toLowerCase()}: ${c.toelichting}`;
}

const VERWIJS_NAAR_STAKEHOLDERS: ML = {
  nl: "De beslissing zelf — aanwerven, rangschikken of investeren — hoort bij de stakeholders samen met hun procesbegeleider. Ik kan je wél elke lijn van de studie helpen lezen en kritisch wegen.",
  fr: "La décision elle-même — recruter, classer ou investir — appartient aux parties prenantes avec leur facilitateur. Je peux par contre t'aider à lire et peser chaque ligne de l'étude.",
  en: "The decision itself — to hire, rank or invest — belongs with the stakeholders together with their facilitator. I can, however, help you read and critically weigh every line of the study.",
  es: "La decisión en sí — contratar, clasificar o invertir — corresponde a las partes interesadas junto a su facilitador. Sí puedo ayudarte a leer y sopesar críticamente cada línea del estudio.",
  ru: "Само решение — нанимать, ранжировать или инвестировать — принадлежит заинтересованным сторонам вместе с их фасилитатором. Но я могу помочь прочитать и критически взвесить каждую линию исследования.",
};

export function beantwoordRecruiter(
  vraag: string,
  uitkomst: MatchUitkomst | null,
  taal: Taal,
  meta?: { functionTitle?: string | null; candidateLabel?: string | null },
): { reply: string; veiligheid: string | null } {
  const intentie = herkenIntentie(vraag);
  const disc = k(DISCLAIMER, taal);

  // Begripsvragen kunnen ook zonder berekende studie beantwoord worden.
  if (intentie === "wat_is_need") return { reply: k(KENNIS.need, taal), veiligheid: null };
  if (intentie === "wat_is_driver") return { reply: k(KENNIS.driver, taal), veiligheid: null };
  if (intentie === "wat_is_energie") return { reply: k(KENNIS.energie, taal), veiligheid: null };
  if (intentie === "wat_is_eindoordeel") return { reply: k(KENNIS.eindoordeel, taal), veiligheid: null };
  if (intentie === "wat_is_t4r") return { reply: k(KENNIS.t4r, taal), veiligheid: null };

  if (intentie === "groet") {
    const m: ML = {
      nl: "Dag. Ik ben je leeshulp bij deze vergelijkende studie. Vraag me bijvoorbeeld wat het eindoordeel betekent, welke need-lijnen aandacht vragen, waar de energiewaakpunten zitten, of speel gerust de kritische investeerder — ik onderbouw alles vanuit de studie.",
      fr: "Bonjour. Je suis ton aide à la lecture de cette étude comparative. Demande-moi ce que signifie le verdict, quelles lignes need demandent attention, où sont les points d'attention énergie, ou joue l'investisseur critique — j'étaye tout à partir de l'étude.",
      en: "Hello. I'm your reading aid for this comparative study. Ask me what the verdict means, which need lines call for attention, where the energy watch points are, or play the critical investor — I ground everything in the study.",
      es: "Hola. Soy tu ayuda de lectura de este estudio comparativo. Pregúntame qué significa el veredicto, qué líneas need requieren atención, dónde están los puntos de atención de energía, o haz de inversor crítico: fundamento todo en el estudio.",
      ru: "Здравствуйте. Я ваш помощник по чтению этого сравнительного исследования. Спросите, что значит вывод, какие линии need требуют внимания, где точки внимания по энергии, или сыграйте критичного инвестора — я обосновываю всё из исследования.",
    };
    return { reply: k(m, taal), veiligheid: null };
  }
  if (intentie === "dankjewel") {
    const m: ML = {
      nl: "Graag gedaan. Stel gerust nog een kritische vraag over de need-lijnen, de risicovlaggen of het eindoordeel.",
      fr: "Avec plaisir. N'hésite pas à poser une autre question critique sur les lignes need, les drapeaux de risque ou le verdict.",
      en: "You're welcome. Feel free to ask another critical question about the need lines, the risk flags or the verdict.",
      es: "De nada. No dudes en hacer otra pregunta crítica sobre las líneas need, las banderas de riesgo o el veredicto.",
      ru: "Пожалуйста. Задавайте ещё критические вопросы о линиях need, флагах риска или выводе.",
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  // Beslis-/rangschik-/investeervraag: warm afwijzen + onderbouwing aanbieden.
  if (intentie === "buiten_kader") {
    let extra = "";
    if (uitkomst) {
      const m2: ML = {
        nl: ` Wat ik wél kan: de studie eindigt op "${EINDOORDEEL_LABEL[uitkomst.eindoordeel]}" met ${uitkomst.needMatch}/${uitkomst.needTotaal} need-lijnen op match, ${uitkomst.needAandacht} op aandacht, ${uitkomst.needMismatch} op mismatch, en ${uitkomst.risicovlaggen.length} actieve risicovlag(gen). Vraag me gerust de zwakste lijn, de kritische punten of de energiewaakpunten op — dan weeg je zelf met volledige onderbouwing.`,
        fr: ` Ce que je peux faire : l'étude se termine sur « ${EINDOORDEEL_LABEL[uitkomst.eindoordeel]} » avec ${uitkomst.needMatch}/${uitkomst.needTotaal} lignes need en correspondance, ${uitkomst.needAandacht} en attention, ${uitkomst.needMismatch} en non-correspondance, et ${uitkomst.risicovlaggen.length} drapeau(x) de risque actif(s). Demande-moi la ligne la plus faible, les points critiques ou les points d'attention énergie — tu pèses ainsi toi-même, pleinement étayé.`,
        en: ` What I can do: the study ends on "${EINDOORDEEL_LABEL[uitkomst.eindoordeel]}" with ${uitkomst.needMatch}/${uitkomst.needTotaal} need lines on match, ${uitkomst.needAandacht} on attention, ${uitkomst.needMismatch} on mismatch, and ${uitkomst.risicovlaggen.length} active risk flag(s). Ask me for the weakest line, the critical points or the energy watch points — then you weigh it yourself, fully grounded.`,
        es: ` Lo que sí puedo: el estudio termina en "${EINDOORDEEL_LABEL[uitkomst.eindoordeel]}" con ${uitkomst.needMatch}/${uitkomst.needTotaal} líneas need en coincidencia, ${uitkomst.needAandacht} en atención, ${uitkomst.needMismatch} en no coincidencia, y ${uitkomst.risicovlaggen.length} bandera(s) de riesgo activa(s). Pídeme la línea más débil, los puntos críticos o los puntos de atención de energía — así sopesas tú mismo, con base completa.`,
        ru: ` Что я могу: исследование завершается на «${EINDOORDEEL_LABEL[uitkomst.eindoordeel]}» с ${uitkomst.needMatch}/${uitkomst.needTotaal} линиями need на совпадении, ${uitkomst.needAandacht} на внимании, ${uitkomst.needMismatch} на несоответствии, и ${uitkomst.risicovlaggen.length} активными флагами риска. Спросите самую слабую линию, критические точки или точки внимания по энергии — и взвесьте сами, с полной опорой.`,
      };
      extra = k(m2, taal);
    }
    return { reply: `${k(VERWIJS_NAAR_STAKEHOLDERS, taal)}${extra} ${disc}`, veiligheid: "coach" };
  }

  // Vanaf hier hebben we de studie nodig.
  if (!uitkomst) {
    if (intentie === "wat_betekent_score") {
      // Deze begripsvraag kan ook zonder studie.
      const m: ML = {
        nl: "De nettoscore is relatief, niet absoluut: ze loopt ruwweg van −6 tot +6 en wordt op drie drempels gelezen — sterk aanwezig (≥ +3), aanwezig (0..+2), zwak (−2..−1) en afwezig (≤ −3). Op need-lijnen telt daarnaast de energiestatus mee. " + disc,
        fr: "Le score net est relatif, pas absolu : il va d'environ −6 à +6 et se lit sur trois seuils — fortement présent (≥ +3), présent (0..+2), faible (−2..−1) et absent (≤ −3). Sur les lignes need, l'état d'énergie compte en plus. " + disc,
        en: "The net score is relative, not absolute: it runs roughly from −6 to +6 and is read on three thresholds — strongly present (≥ +3), present (0..+2), weak (−2..−1) and absent (≤ −3). On need lines the energy status also counts. " + disc,
        es: "La puntuación neta es relativa, no absoluta: va de unos −6 a +6 y se lee en tres umbrales — fuertemente presente (≥ +3), presente (0..+2), débil (−2..−1) y ausente (≤ −3). En las líneas need también cuenta el estado de energía. " + disc,
        ru: "Чистый балл относителен, не абсолютен: примерно от −6 до +6 и читается по трём порогам — сильно выражен (≥ +3), присутствует (0..+2), слабо (−2..−1) и отсутствует (≤ −3). На линиях need также учитывается статус энергии. " + disc,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    return { reply: k(GEEN_STUDIE, taal), veiligheid: null };
  }

  const u = uitkomst;
  const needs = u.constructen.filter(isNeed);
  const titel = meta?.functionTitle || null;
  const kand = meta?.candidateLabel || null;

  // ------------------------------------------------------------------------
  // SYNTHESE-LAAG (recruiter). Legt ECHTE verbanden tussen de bevindingen i.p.v.
  // ze los op te sommen: het eindoordeel als resultante van (1) de dragende
  // need-matches, (2) de zwaarste aandacht/mismatch-lijn, (3) de energie-/
  // duurzaamheidslaag en (4) de risicostapeling. Alles LETTERLIJK uit de
  // MatchUitkomst; geen verzinsels, en strikt binnen de leeshulp-grens (we
  // doen geen aanwervings- of investeringsuitspraak).
  function bouwSyntheseRecruiter(): { reply: string; veiligheid: string | null } {
    const sterkeNeeds = needs.filter((c) => c.oordeel === "match").map((c) => `"${c.construct.label}"`);
    const kritMis = needs.filter((c) => c.kritisch && c.oordeel === "mismatch");
    const kritAand = needs.filter((c) => c.kritisch && c.oordeel === "aandacht");
    const needMis = needs.filter((c) => c.oordeel === "mismatch");
    const needAand = needs.filter((c) => c.oordeel === "aandacht");
    const wp = needs.filter((c) => (c.inhoudelijk === "sterk" || c.inhoudelijk === "voldoende") && c.energie === "kost");
    // Zwaarste aandachts-/breuklijn in prioriteitsvolgorde (zelfde logica als challenge).
    const breuk = kritMis[0] || kritAand[0] || needMis[0] || needAand[0] || wp[0] || null;
    const structureel = u.risicovlaggen.length >= 3;
    const vlagNamen = u.risicovlaggen.map((v) => v.label);
    const hardSignaal = u.eindoordeel === "mismatch" || kritMis.length > 0 || structureel;

    const breukL = breuk
      ? {
          nl: `"${breuk.construct.label}" (${VERVULLING_LABEL[breuk.niveau]}, net ${sign(breuk.net)}, ${ENERGIE_LABEL[breuk.energie].toLowerCase()}${breuk.kritisch ? ", kritisch" : ""})`,
          fr: `« ${breuk.construct.label} » (${VERVULLING_LABEL[breuk.niveau]}, net ${sign(breuk.net)}, ${ENERGIE_LABEL[breuk.energie].toLowerCase()}${breuk.kritisch ? ", critique" : ""})`,
          en: `"${breuk.construct.label}" (${VERVULLING_LABEL[breuk.niveau]}, net ${sign(breuk.net)}, ${ENERGIE_LABEL[breuk.energie].toLowerCase()}${breuk.kritisch ? ", critical" : ""})`,
          es: `«${breuk.construct.label}» (${VERVULLING_LABEL[breuk.niveau]}, net ${sign(breuk.net)}, ${ENERGIE_LABEL[breuk.energie].toLowerCase()}${breuk.kritisch ? ", crítico" : ""})`,
          ru: `«${breuk.construct.label}» (${VERVULLING_LABEL[breuk.niveau]}, net ${sign(breuk.net)}, ${ENERGIE_LABEL[breuk.energie].toLowerCase()}${breuk.kritisch ? ", критич." : ""})`,
        }
      : null;

    const kop = titel ? (kand ? `Rol "${titel}", kandidaat "${kand}". ` : `Rol "${titel}". `) : "";
    const kopFR = titel ? (kand ? `Poste « ${titel} », candidat « ${kand} ». ` : `Poste « ${titel} ». `) : "";
    const kopEN = titel ? (kand ? `Role "${titel}", candidate "${kand}". ` : `Role "${titel}". `) : "";
    const kopES = titel ? (kand ? `Rol "${titel}", candidato "${kand}". ` : `Rol "${titel}". `) : "";
    const kopRU = titel ? (kand ? `Роль «${titel}», кандидат «${kand}». ` : `Роль «${titel}». `) : "";

    const m: ML = {
      nl:
        `${kop}Laat me de bevindingen niet los naast elkaar zetten maar tonen hoe ze ELKAAR dragen of net ondergraven.\n\n` +
        `De resultante is "${EINDOORDEEL_LABEL[u.eindoordeel]}", en dat is geen los etiket: het volgt uit hoe de lagen op elkaar inwerken. ` +
        (sterkeNeeds.length
          ? `Het dragende fundament zit in ${u.needMatch}/${u.needTotaal} need-lijnen op match${sterkeNeeds.length <= 3 ? ` (${lijst(sterkeNeeds, taal)})` : ` (o.a. ${lijst(sterkeNeeds.slice(0, 3), taal)})`} — dáár klopt het rolprofiel met wat gemeten is. `
          : `Geen enkele need-lijn haalt een volle match — het fundament is dun, en dat verklaart waarom het eindoordeel niet hoger uitkomt. `) +
        (breukL
          ? `De scharnierlijn die de doorslag geeft is ${breukL.nl}: ${breuk!.toelichting} ${breuk!.kritisch ? `Omdat dit een kritisch succescriterium is, weegt het in de aggregatie zwaarder dan een gewone lijn en trekt het het hele oordeel naar beneden — ook al staat de rest sterk.` : `Het is geen kritisch gemarkeerde lijn, maar wel een reële barst die het eindbeeld tempert.`} `
          : `Er is geen enkele breuklijn: elke gevraagde lijn draagt, wat het eindoordeel optilt. `) +
        (u.energiewaakpunten > 0
          ? `Belangrijk verband dat los van het talentbeeld speelt: ${u.energiewaakpunten} gevraagde lijn(en) volstaan inhoudelijk maar kosten energie${wp.length ? ` (o.a. ${lijst(wp.slice(0, 2).map((c) => `"${c.construct.label}"`), taal)})` : ""}. Dat is precies het verschil tussen "kan het vandaag" en "houdt het vol" — een sterkte op papier die onder aanhoudende druk het eerst erodeert. `
          : `Op duurzaamheid is er geen energiewaakpunt: wat gevraagd wordt en gedragen, kost geen energie — een stille plus. `) +
        (vlagNamen.length
          ? `Tot slot de risicolaag: ${vlagNamen.length} actieve vlag(gen) (${lijst(vlagNamen, taal)}). ${structureel ? `Drie of meer telt als structurele stapeling en weegt zelfstandig door, ook bij een sterk inhoudelijk beeld — dat is het verband dat een te optimistische lezing corrigeert.` : `Dat blijft hanteerbaar, maar het kleurt de marge rond het eindoordeel.`} `
          : `Geen actieve risicovlaggen — de stapeling die een sterk beeld kan ondergraven, ontbreekt hier. `) +
        `\nDe rode draad: ${u.eindoordeel === "match" ? `een dragend fundament dat${u.energiewaakpunten ? `, mits de energiewaakpunten bewaakt worden,` : ``} standhoudt` : u.eindoordeel === "mismatch" ? `een breuk op een dragende of kritische lijn die de sterke punten niet compenseren` : `een grotendeels passend beeld met één of meer lijnen die bewust opvolging vragen`}. Het wegen van geschiktheid of de beslissing zelf blijft aan de stakeholders met hun procesbegeleider. Wil je dat ik op één van deze verbanden — fundament, scharnierlijn, energie of risico — verder inzoom?${disc}`,
      fr:
        `${kopFR}Montrons comment les constats se portent ou se sapent mutuellement.\n\n` +
        `La résultante est « ${EINDOORDEEL_LABEL[u.eindoordeel]} », conséquence de l'interaction des couches. ` +
        (sterkeNeeds.length ? `Le socle : ${u.needMatch}/${u.needTotaal} lignes need en correspondance${sterkeNeeds.length <= 3 ? ` (${lijst(sterkeNeeds, taal)})` : ""}. ` : `Aucune ligne need en pleine correspondance — socle mince. `) +
        (breukL ? `La ligne charnière est ${breukL.fr} : ${breuk!.toelichting} ${breuk!.kritisch ? `Critère critique : il pèse plus lourd dans l'agrégation.` : `Une vraie fissure qui tempère le tableau.`} ` : `Aucune ligne de rupture. `) +
        (u.energiewaakpunten > 0 ? `Durabilité : ${u.energiewaakpunten} ligne(s) suffisante(s) sur le fond mais coûteuse(s) — la différence entre « sait faire » et « tient ». ` : `Aucun point d'attention énergie. `) +
        (vlagNamen.length ? `Risque : ${vlagNamen.length} drapeau(x) (${lijst(vlagNamen, taal)}). ${structureel ? `Trois ou plus = cumul structurel.` : ``} ` : `Aucun drapeau de risque actif. `) +
        `\nLe fil rouge reste à peser par les parties prenantes avec leur facilitateur. Veux-tu que j'approfondisse un de ces liens ?${disc}`,
      en:
        `${kopEN}Let me show how the findings carry — or undercut — each other.\n\n` +
        `The resultant is "${EINDOORDEEL_LABEL[u.eindoordeel]}", which follows from how the layers interact. ` +
        (sterkeNeeds.length ? `The load-bearing base: ${u.needMatch}/${u.needTotaal} need lines on match${sterkeNeeds.length <= 3 ? ` (${lijst(sterkeNeeds, taal)})` : ` (incl. ${lijst(sterkeNeeds.slice(0, 3), taal)})`}. ` : `No need line reaches a full match — a thin base. `) +
        (breukL ? `The hinge line tipping the balance is ${breukL.en}: ${breuk!.toelichting} ${breuk!.kritisch ? `Being a critical success criterion, it weighs more heavily in aggregation and pulls the whole verdict down even if the rest is strong.` : `Not critically flagged, but a real crack that tempers the picture.`} ` : `There is no breaking line: every required line carries, lifting the verdict. `) +
        (u.energiewaakpunten > 0 ? `A connection beyond the talent picture: ${u.energiewaakpunten} required line(s) are substantively sufficient but cost energy${wp.length ? ` (incl. ${lijst(wp.slice(0, 2).map((c) => `"${c.construct.label}"`), taal)})` : ""} — the difference between "can today" and "will sustain". ` : `On durability there is no energy watch point — a quiet plus. `) +
        (vlagNamen.length ? `Finally the risk layer: ${vlagNamen.length} active flag(s) (${lijst(vlagNamen, taal)}). ${structureel ? `Three or more counts as a structural accumulation that weighs independently, even with a strong substantive picture.` : `Manageable, but it colours the margin around the verdict.`} ` : `No active risk flags — the accumulation that can undercut a strong picture is absent here. `) +
        `\nThe through-line: ${u.eindoordeel === "match" ? `a load-bearing base that holds${u.energiewaakpunten ? `, provided the energy watch points are guarded` : ``}` : u.eindoordeel === "mismatch" ? `a break on a load-bearing or critical line that the strengths do not offset` : `a largely fitting picture with one or more lines that deliberately call for follow-up`}. Weighing suitability or the decision itself remains for the stakeholders with their facilitator. Want me to zoom in further on one of these links — base, hinge line, energy or risk?${disc}`,
      es:
        `${kopES}Muestro cómo los hallazgos se sostienen — o se socavan — entre sí.\n\n` +
        `La resultante es "${EINDOORDEEL_LABEL[u.eindoordeel]}", consecuencia de cómo interactúan las capas. ` +
        (sterkeNeeds.length ? `El cimiento: ${u.needMatch}/${u.needTotaal} líneas need en coincidencia${sterkeNeeds.length <= 3 ? ` (${lijst(sterkeNeeds, taal)})` : ""}. ` : `Ninguna línea need en plena coincidencia — cimiento delgado. `) +
        (breukL ? `La línea bisagra es ${breukL.es}: ${breuk!.toelichting} ${breuk!.kritisch ? `Criterio crítico: pesa más en la agregación.` : `Una grieta real que atempera el cuadro.`} ` : `No hay línea de ruptura. `) +
        (u.energiewaakpunten > 0 ? `Durabilidad: ${u.energiewaakpunten} línea(s) suficiente(s) pero costosa(s) — la diferencia entre "puede hoy" y "se sostiene". ` : `Sin puntos de atención de energía. `) +
        (vlagNamen.length ? `Riesgo: ${vlagNamen.length} bandera(s) (${lijst(vlagNamen, taal)}). ${structureel ? `Tres o más = acumulación estructural.` : ``} ` : `Sin banderas de riesgo activas. `) +
        `\nEl hilo conductor lo sopesan las partes interesadas con su facilitador. ¿Quieres que profundice en uno de estos vínculos?${disc}`,
      ru:
        `${kopRU}Покажу, как выводы поддерживают — или подрывают — друг друга.\n\n` +
        `Результат — «${EINDOORDEEL_LABEL[u.eindoordeel]}», следствие взаимодействия слоёв. ` +
        (sterkeNeeds.length ? `Несущая основа: ${u.needMatch}/${u.needTotaal} линий need на совпадении${sterkeNeeds.length <= 3 ? ` (${lijst(sterkeNeeds, taal)})` : ""}. ` : `Ни одна линия need не на полном совпадении — основа тонкая. `) +
        (breukL ? `Поворотная линия — ${breukL.ru}: ${breuk!.toelichting} ${breuk!.kritisch ? `Критический критерий: весит сильнее в агрегации.` : `Реальная трещина, смягчающая картину.`} ` : `Линии разрыва нет. `) +
        (u.energiewaakpunten > 0 ? `Устойчивость: ${u.energiewaakpunten} требуемых линий достаточны по сути, но отнимают энергию — разница между «может сегодня» и «выдержит». ` : `Точек внимания по энергии нет. `) +
        (vlagNamen.length ? `Риск: ${vlagNamen.length} флаг(ов) (${lijst(vlagNamen, taal)}). ${structureel ? `Три и более — структурное накопление.` : ``} ` : `Активных флагов риска нет. `) +
        `\nОбщую нить взвешивают заинтересованные стороны с их фасилитатором. Углубиться в одну из связей?${disc}`,
    };
    return { reply: k(m, taal), veiligheid: hardSignaal ? "coach" : null };
  }

  if (intentie === "verdieping") {
    return bouwSyntheseRecruiter();
  }

  if (intentie === "wat_betekent_score") {
    const m: ML = {
      nl: "De nettoscore is relatief, niet absoluut: ze loopt ruwweg van −6 tot +6 en wordt op drie drempels gelezen — sterk aanwezig (≥ +3), aanwezig (0..+2), zwak (−2..−1) en afwezig (≤ −3). Op de need-lijnen telt daarnaast de energiestatus mee als beschikbaarheidstoets. Samen vertellen niveau en energie of een gevraagde eis niet alleen aanwezig is, maar ook draagbaar op termijn. " + disc,
      fr: "Le score net est relatif : d'environ −6 à +6, lu sur trois seuils — fortement présent (≥ +3), présent (0..+2), faible (−2..−1), absent (≤ −3). Sur les lignes need, l'énergie compte comme test de disponibilité. Ensemble, niveau et énergie disent si une exigence est non seulement présente mais aussi tenable. " + disc,
      en: "The net score is relative: roughly −6 to +6, read on three thresholds — strongly present (≥ +3), present (0..+2), weak (−2..−1), absent (≤ −3). On need lines, energy counts as an availability test. Together, level and energy tell you whether a requirement is not only present but also tenable over time. " + disc,
      es: "La puntuación neta es relativa: de unos −6 a +6, en tres umbrales — fuertemente presente (≥ +3), presente (0..+2), débil (−2..−1), ausente (≤ −3). En las líneas need, la energía cuenta como prueba de disponibilidad. Juntos, nivel y energía dicen si un requisito no solo está presente sino que es sostenible. " + disc,
      ru: "Чистый балл относителен: примерно от −6 до +6, по трём порогам — сильно выражен (≥ +3), присутствует (0..+2), слабо (−2..−1), отсутствует (≤ −3). На линиях need энергия — тест доступности. Вместе уровень и энергия говорят, не только присутствует ли требование, но и устойчиво ли оно. " + disc,
    };
    return { reply: k(m, taal), veiligheid: null };
  }

  if (intentie === "eindoordeel") {
    const kop: ML = {
      nl: `${titel ? `Voor de rol "${titel}"${kand ? ` en kandidaat "${kand}"` : ""}: ` : ""}het eindoordeel is "${EINDOORDEEL_LABEL[u.eindoordeel]}". ${u.motivatie} Concreet: van ${u.needTotaal} need-lijnen staan er ${u.needMatch} op match, ${u.needAandacht} op aandacht en ${u.needMismatch} op mismatch; er zijn ${u.kritischTotaal} kritische succescriteria, ${u.energiewaakpunten} energiewaakpunt(en) en ${u.risicovlaggen.length} actieve risicovlag(gen).${u.motivatieVerplicht ? " Let op: op een kritisch punt is een verplichte motivering vereist." : ""} ${disc}`,
      fr: `${titel ? `Pour le poste « ${titel} »${kand ? ` et le candidat « ${kand} »` : ""} : ` : ""}le verdict est « ${EINDOORDEEL_LABEL[u.eindoordeel]} ». ${u.motivatie} Concrètement : sur ${u.needTotaal} lignes need, ${u.needMatch} en correspondance, ${u.needAandacht} en attention et ${u.needMismatch} en non-correspondance ; ${u.kritischTotaal} critères critiques, ${u.energiewaakpunten} point(s) d'attention énergie et ${u.risicovlaggen.length} drapeau(x) de risque actif(s).${u.motivatieVerplicht ? " À noter : une motivation obligatoire est requise sur un point critique." : ""} ${disc}`,
      en: `${titel ? `For the role "${titel}"${kand ? ` and candidate "${kand}"` : ""}: ` : ""}the verdict is "${EINDOORDEEL_LABEL[u.eindoordeel]}". ${u.motivatie} Concretely: of ${u.needTotaal} need lines, ${u.needMatch} are on match, ${u.needAandacht} on attention and ${u.needMismatch} on mismatch; there are ${u.kritischTotaal} critical success criteria, ${u.energiewaakpunten} energy watch point(s) and ${u.risicovlaggen.length} active risk flag(s).${u.motivatieVerplicht ? " Note: a mandatory justification is required on a critical point." : ""} ${disc}`,
      es: `${titel ? `Para el rol "${titel}"${kand ? ` y el candidato "${kand}"` : ""}: ` : ""}el veredicto es "${EINDOORDEEL_LABEL[u.eindoordeel]}". ${u.motivatie} En concreto: de ${u.needTotaal} líneas need, ${u.needMatch} en coincidencia, ${u.needAandacht} en atención y ${u.needMismatch} en no coincidencia; hay ${u.kritischTotaal} criterios críticos, ${u.energiewaakpunten} punto(s) de atención de energía y ${u.risicovlaggen.length} bandera(s) de riesgo activa(s).${u.motivatieVerplicht ? " Nota: se requiere una justificación obligatoria en un punto crítico." : ""} ${disc}`,
      ru: `${titel ? `Для роли «${titel}»${kand ? ` и кандидата «${kand}»` : ""}: ` : ""}вывод — «${EINDOORDEEL_LABEL[u.eindoordeel]}». ${u.motivatie} Конкретно: из ${u.needTotaal} линий need ${u.needMatch} на совпадении, ${u.needAandacht} на внимании и ${u.needMismatch} на несоответствии; ${u.kritischTotaal} критических критериев, ${u.energiewaakpunten} точек внимания по энергии и ${u.risicovlaggen.length} активных флагов риска.${u.motivatieVerplicht ? " Внимание: по критическому пункту требуется обязательное обоснование." : ""} ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: u.eindoordeel === "mismatch" ? "coach" : null };
  }

  if (intentie === "needs_aandacht") {
    const probleem = needs.filter((c) => c.oordeel === "aandacht" || c.oordeel === "mismatch");
    if (probleem.length === 0) {
      const m: ML = {
        nl: `Geen van de ${u.needTotaal} need-lijnen staat op aandacht of mismatch — ze scoren alle een match. Dat betekent niet dat er geen nuance is: vraag me gerust de energiewaakpunten of de risicovlaggen op. ${disc}`,
        fr: `Aucune des ${u.needTotaal} lignes need n'est en attention ou non-correspondance — elles sont toutes en correspondance. Cela n'exclut pas la nuance : demande-moi les points d'attention énergie ou les drapeaux de risque. ${disc}`,
        en: `None of the ${u.needTotaal} need lines is on attention or mismatch — they all score a match. That doesn't mean there is no nuance: ask me for the energy watch points or the risk flags. ${disc}`,
        es: `Ninguna de las ${u.needTotaal} líneas need está en atención o no coincidencia — todas coinciden. Eso no excluye matices: pídeme los puntos de atención de energía o las banderas de riesgo. ${disc}`,
        ru: `Ни одна из ${u.needTotaal} линий need не на внимании или несоответствии — все совпадают. Это не значит, что нет нюансов: спросите точки внимания по энергии или флаги риска. ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    const regels = probleem.map((c) => "• " + lijnTekst(c, taal)).join("\n");
    const kop: ML = {
      nl: `Deze need-lijnen vragen het meest aandacht (${probleem.length} van ${u.needTotaal}):\n${regels}\n\nLees ze samen: een mismatch op een kritische lijn weegt het zwaarst, een energiewaakpunt is eerder een duurzaamheidsvraag dan een onvermogen. ${disc}`,
      fr: `Ces lignes need demandent le plus d'attention (${probleem.length} sur ${u.needTotaal}) :\n${regels}\n\nLis-les ensemble : une non-correspondance sur une ligne critique pèse le plus, un point d'attention énergie est plutôt une question de durabilité qu'une incapacité. ${disc}`,
      en: `These need lines call for the most attention (${probleem.length} of ${u.needTotaal}):\n${regels}\n\nRead them together: a mismatch on a critical line weighs heaviest, an energy watch point is a durability question rather than an inability. ${disc}`,
      es: `Estas líneas need requieren más atención (${probleem.length} de ${u.needTotaal}):\n${regels}\n\nLéelas juntas: una no coincidencia en una línea crítica pesa más; un punto de atención de energía es una cuestión de durabilidad, no una incapacidad. ${disc}`,
      ru: `Эти линии need требуют наибольшего внимания (${probleem.length} из ${u.needTotaal}):\n${regels}\n\nЧитайте их вместе: несоответствие на критической линии весит больше всего, точка внимания по энергии — это вопрос устойчивости, а не неспособности. ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: null };
  }

  if (intentie === "needs_sterk") {
    const sterk = needs.filter((c) => c.oordeel === "match").sort((a, b) => b.net - a.net);
    if (sterk.length === 0) {
      const m: ML = {
        nl: `Geen enkele need-lijn scoort op dit moment een volle match — dat is op zich een belangrijk signaal. Vraag me gerust welke lijnen aandacht vragen en waarom. ${disc}`,
        fr: `Aucune ligne need n'est actuellement en pleine correspondance — c'est en soi un signal important. Demande-moi quelles lignes demandent attention et pourquoi. ${disc}`,
        en: `No need line currently scores a full match — that in itself is an important signal. Ask me which lines call for attention and why. ${disc}`,
        es: `Ninguna línea need coincide plenamente ahora mismo — eso ya es una señal importante. Pídeme qué líneas requieren atención y por qué. ${disc}`,
        ru: `Ни одна линия need сейчас не на полном совпадении — это уже важный сигнал. Спросите, какие линии требуют внимания и почему. ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    const regels = sterk.slice(0, 5).map((c) => "• " + lijnTekst(c, taal)).join("\n");
    const kop: ML = {
      nl: `Deze need-lijnen zitten goed (${sterk.length} van ${u.needTotaal} op match):\n${regels}\n\nDat is het dragende deel van de studie. Een kritische lezer weegt dit altijd tegen de aandachtslijnen en risicovlaggen — vraag die gerust ook op. ${disc}`,
      fr: `Ces lignes need sont solides (${sterk.length} sur ${u.needTotaal} en correspondance) :\n${regels}\n\nC'est la partie porteuse de l'étude. Un lecteur critique la pèse toujours face aux lignes d'attention et aux drapeaux de risque — demande-les aussi. ${disc}`,
      en: `These need lines are solid (${sterk.length} of ${u.needTotaal} on match):\n${regels}\n\nThis is the load-bearing part of the study. A critical reader always weighs it against the attention lines and risk flags — ask for those too. ${disc}`,
      es: `Estas líneas need están bien (${sterk.length} de ${u.needTotaal} en coincidencia):\n${regels}\n\nEs la parte portante del estudio. Un lector crítico siempre lo sopesa frente a las líneas de atención y las banderas de riesgo — pídelas también. ${disc}`,
      ru: `Эти линии need в порядке (${sterk.length} из ${u.needTotaal} на совпадении):\n${regels}\n\nЭто несущая часть исследования. Критичный читатель всегда взвешивает это против линий внимания и флагов риска — спросите и о них. ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: null };
  }

  if (intentie === "kritisch") {
    const krit = needs.filter((c) => c.kritisch);
    if (krit.length === 0) {
      const m: ML = {
        nl: `In deze studie is geen enkele need als kritisch succescriterium gemarkeerd. Dat verlaagt de drempel niet automatisch — het betekent dat de stakeholders geen enkele lijn als 'breekpunt' hebben aangeduid. Een kritische lezer vraagt zich af of dat klopt voor déze rol. ${disc}`,
        fr: `Dans cette étude, aucun need n'est marqué comme critère de réussite critique. Cela n'abaisse pas automatiquement la barre — cela signifie que les parties prenantes n'ont désigné aucune ligne comme « point de rupture ». Un lecteur critique se demande si c'est juste pour CE rôle. ${disc}`,
        en: `In this study no need is marked as a critical success criterion. That doesn't automatically lower the bar — it means the stakeholders flagged no line as a 'breaking point'. A critical reader asks whether that is right for THIS role. ${disc}`,
        es: `En este estudio ningún need está marcado como criterio crítico. Eso no baja automáticamente el listón — significa que las partes interesadas no señalaron ninguna línea como 'punto de ruptura'. Un lector crítico se pregunta si eso es correcto para ESTE rol. ${disc}`,
        ru: `В этом исследовании ни один need не отмечен как критический критерий. Это не снижает планку автоматически — значит, заинтересованные стороны не обозначили ни одной линии как «точку разрыва». Критичный читатель спросит, верно ли это для ЭТОЙ роли. ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    const regels = krit.map((c) => "• " + lijnTekst(c, taal)).join("\n");
    const mismatchKrit = krit.some((c) => c.oordeel === "mismatch");
    const aandachtKrit = krit.some((c) => c.oordeel === "aandacht");
    const kop: ML = {
      nl: `De kritische succescriteria zijn de lijnen die de stakeholders als breekpunt hebben aangeduid (${krit.length}):\n${regels}\n\n${mismatchKrit ? "Eén of meer kritische lijnen scoren een inhoudelijke mismatch — dat is in de aggregatieregels een directe aanleiding voor een mismatch-eindoordeel." : aandachtKrit ? "Eén of meer kritische lijnen vragen aandacht (zwak, of sterk maar energie-kostend) — dat trekt het eindoordeel minstens naar 'aandacht'." : "Alle kritische lijnen scoren een match — het dragende fundament staat dus."} ${disc}`,
      fr: `Les critères de réussite critiques sont les lignes désignées comme point de rupture par les parties prenantes (${krit.length}) :\n${regels}\n\n${mismatchKrit ? "Une ou plusieurs lignes critiques sont en non-correspondance de fond — dans les règles d'agrégation, c'est une cause directe de verdict « non-correspondance »." : aandachtKrit ? "Une ou plusieurs lignes critiques demandent attention — cela tire le verdict au moins vers « attention »." : "Toutes les lignes critiques sont en correspondance — le socle porteur tient."} ${disc}`,
      en: `The critical success criteria are the lines the stakeholders flagged as breaking points (${krit.length}):\n${regels}\n\n${mismatchKrit ? "One or more critical lines score a substantive mismatch — in the aggregation rules that is a direct cause for a mismatch verdict." : aandachtKrit ? "One or more critical lines call for attention (weak, or strong but energy-costing) — that pulls the verdict at least to 'attention'." : "All critical lines score a match — so the load-bearing foundation holds."} ${disc}`,
      es: `Los criterios críticos son las líneas señaladas como punto de ruptura por las partes interesadas (${krit.length}):\n${regels}\n\n${mismatchKrit ? "Una o más líneas críticas son una no coincidencia sustantiva — en las reglas de agregación es causa directa de un veredicto de no coincidencia." : aandachtKrit ? "Una o más líneas críticas requieren atención — eso lleva el veredicto al menos a 'atención'." : "Todas las líneas críticas coinciden — el fundamento portante se sostiene."} ${disc}`,
      ru: `Критические критерии — это линии, отмеченные заинтересованными сторонами как точки разрыва (${krit.length}):\n${regels}\n\n${mismatchKrit ? "Одна или несколько критических линий — содержательное несоответствие; по правилам агрегации это прямая причина вывода о несоответствии." : aandachtKrit ? "Одна или несколько критических линий требуют внимания — это тянет вывод как минимум к «вниманию»." : "Все критические линии на совпадении — несущая основа держится."} ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: mismatchKrit ? "coach" : null };
  }

  if (intentie === "energiewaakpunten") {
    const wp = needs.filter((c) => (c.inhoudelijk === "sterk" || c.inhoudelijk === "voldoende") && c.energie === "kost");
    if (wp.length === 0) {
      const m: ML = {
        nl: `Er zijn geen energiewaakpunten: geen enkele gevraagde lijn die inhoudelijk volstaat, kost de kandidaat energie. De aanname "begint met energie" wordt op de dragende lijnen dus niet ondermijnd. ${disc}`,
        fr: `Aucun point d'attention énergie : aucune ligne demandée suffisante sur le fond ne coûte d'énergie au candidat. L'hypothèse « commence par l'énergie » n'est donc pas minée sur les lignes porteuses. ${disc}`,
        en: `There are no energy watch points: no required line that is substantively sufficient costs the candidate energy. The assumption "starts with energy" is therefore not undermined on the load-bearing lines. ${disc}`,
        es: `No hay puntos de atención de energía: ninguna línea requerida suficiente en lo sustantivo le cuesta energía al candidato. El supuesto "empieza con energía" no se ve socavado en las líneas portantes. ${disc}`,
        ru: `Точек внимания по энергии нет: ни одна требуемая линия, достаточная по сути, не отнимает у кандидата энергию. Допущение «начинается с энергии» на несущих линиях не подрывается. ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    const regels = wp.map((c) => "• " + lijnTekst(c, taal)).join("\n");
    const kop: ML = {
      nl: `Energiewaakpunten zijn de gevraagde lijnen die inhoudelijk volstaan, maar die de kandidaat energie kosten (${wp.length}):\n${regels}\n\nDit is precies de "vanzelfsprekendheid die niet vanzelfsprekend blijkt": de kandidaat kán het, maar het put eerder uit dan het voedt. Voor een rol met aanhoudende druk is dat een duurzaamheidsvraag, geen onvermogen. ${disc}`,
      fr: `Les points d'attention énergie sont les lignes demandées suffisantes sur le fond mais qui coûtent de l'énergie au candidat (${wp.length}) :\n${regels}\n\nC'est exactement « l'évidence qui ne va pas de soi » : le candidat sait faire, mais cela épuise plus que cela ne nourrit. Pour un rôle à pression soutenue, c'est une question de durabilité, pas une incapacité. ${disc}`,
      en: `Energy watch points are the required lines that are substantively sufficient but cost the candidate energy (${wp.length}):\n${regels}\n\nThis is exactly the "self-evidence that turns out not to be self-evident": the candidate can do it, but it drains rather than feeds. For a role with sustained pressure that is a durability question, not an inability. ${disc}`,
      es: `Los puntos de atención de energía son las líneas requeridas suficientes en lo sustantivo pero que le cuestan energía al candidato (${wp.length}):\n${regels}\n\nEs exactamente "lo evidente que resulta no serlo": el candidato puede, pero le agota más que le nutre. Para un rol de presión sostenida es una cuestión de durabilidad, no una incapacidad. ${disc}`,
      ru: `Точки внимания по энергии — требуемые линии, достаточные по сути, но отнимающие у кандидата энергию (${wp.length}):\n${regels}\n\nЭто именно «очевидность, оказавшаяся неочевидной»: кандидат может, но это скорее истощает, чем питает. Для роли с постоянным давлением это вопрос устойчивости, а не неспособности. ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: null };
  }

  if (intentie === "risicos") {
    if (u.risicovlaggen.length === 0) {
      const m: ML = {
        nl: `Er zijn geen actieve risicovlaggen in deze studie. Dat is gunstig, maar het betekent niet dat alle context-risico's uitgesloten zijn — de vlaggen toetsen alleen de gemodelleerde combinaties (prestatie/herstel, duurzaamheid, regie-fit, relationele fit, perfectionistische belasting, scheve wederkerigheid). ${disc}`,
        fr: `Aucun drapeau de risque actif dans cette étude. C'est favorable, mais cela n'exclut pas tous les risques de contexte — les drapeaux ne testent que les combinaisons modélisées (performance/récupération, durabilité, fit de pilotage, fit relationnel, charge perfectionniste, réciprocité déséquilibrée). ${disc}`,
        en: `There are no active risk flags in this study. That is favourable, but it doesn't rule out all context risks — the flags only test the modelled combinations (performance/recovery, durability, control fit, relational fit, perfectionist load, skewed reciprocity). ${disc}`,
        es: `No hay banderas de riesgo activas en este estudio. Es favorable, pero no descarta todos los riesgos de contexto — las banderas solo prueban las combinaciones modeladas (rendimiento/recuperación, durabilidad, ajuste de control, ajuste relacional, carga perfeccionista, reciprocidad desigual). ${disc}`,
        ru: `В этом исследовании нет активных флагов риска. Это благоприятно, но не исключает все контекстные риски — флаги проверяют только смоделированные комбинации (результат/восстановление, устойчивость, соответствие по управлению, реляционное соответствие, перфекционистская нагрузка, перекошенная взаимность). ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    const regels = u.risicovlaggen.map((v) => `• ${v.label}: ${v.toelichting}`).join("\n");
    const structureel = u.risicovlaggen.length >= 3;
    const kop: ML = {
      nl: `Er ${u.risicovlaggen.length === 1 ? "is 1 actieve risicovlag" : `zijn ${u.risicovlaggen.length} actieve risicovlaggen`}:\n${regels}\n\n${structureel ? "Drie of meer vlaggen vallen samen — dat telt als structureel duurzaamheidsrisico en weegt door in het eindoordeel, ongeacht hoe sterk het inhoudelijke talentbeeld is." : "Eén à twee vlaggen trekken het eindoordeel naar 'aandacht'; ze sluiten een match niet uit maar vragen een bewuste afweging."} ${disc}`,
      fr: `Il y a ${u.risicovlaggen.length === 1 ? "1 drapeau de risque actif" : `${u.risicovlaggen.length} drapeaux de risque actifs`} :\n${regels}\n\n${structureel ? "Trois drapeaux ou plus coïncident — cela compte comme risque structurel de durabilité et pèse sur le verdict, quelle que soit la force du tableau de talents." : "Un à deux drapeaux tirent le verdict vers « attention » ; ils n'excluent pas une correspondance mais exigent une pesée consciente."} ${disc}`,
      en: `There ${u.risicovlaggen.length === 1 ? "is 1 active risk flag" : `are ${u.risicovlaggen.length} active risk flags`}:\n${regels}\n\n${structureel ? "Three or more flags coincide — that counts as a structural durability risk and weighs on the verdict, regardless of how strong the substantive talent picture is." : "One to two flags pull the verdict to 'attention'; they don't rule out a match but call for a conscious trade-off."} ${disc}`,
      es: `Hay ${u.risicovlaggen.length === 1 ? "1 bandera de riesgo activa" : `${u.risicovlaggen.length} banderas de riesgo activas`}:\n${regels}\n\n${structureel ? "Tres o más banderas coinciden — cuenta como riesgo estructural de durabilidad y pesa en el veredicto, sin importar lo fuerte que sea el cuadro de talento." : "Una o dos banderas llevan el veredicto a 'atención'; no excluyen una coincidencia pero exigen una ponderación consciente."} ${disc}`,
      ru: `${u.risicovlaggen.length === 1 ? "Есть 1 активный флаг риска" : `Есть ${u.risicovlaggen.length} активных флагов риска`}:\n${regels}\n\n${structureel ? "Три или более флагов совпадают — это структурный риск устойчивости, он весит на выводе независимо от того, насколько силён содержательный портрет талантов." : "Один-два флага тянут вывод к «вниманию»; они не исключают совпадение, но требуют осознанного выбора."} ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: structureel ? "coach" : null };
  }

  if (intentie === "duurzaamheid") {
    const wp = needs.filter((c) => (c.inhoudelijk === "sterk" || c.inhoudelijk === "voldoende") && c.energie === "kost");
    const duurzaamheidsVlag = u.risicovlaggen.find((v) => v.key === "duurzaamheid" || v.key === "prestatie_herstel");
    const kop: ML = {
      nl: `Duurzaamheid lees je in deze studie op twee plaatsen. Eén: de energiewaakpunten — ${u.energiewaakpunten} gevraagde lijn(en) die inhoudelijk volstaan maar energie kosten${wp.length ? ` (o.a. ${lijst(wp.slice(0, 2).map((c) => `"${c.construct.label}"`), taal)})` : ""}. Twee: de risicolaag — ${duurzaamheidsVlag ? `de vlag "${duurzaamheidsVlag.label}" is actief: ${duurzaamheidsVlag.toelichting}` : "geen specifieke duurzaamheids- of herstelvlag actief"}. Samen vertellen ze of de match niet alleen vandaag klopt, maar ook standhoudt onder aanhoudende druk. ${disc}`,
      fr: `La durabilité se lit ici à deux endroits. Un : les points d'attention énergie — ${u.energiewaakpunten} ligne(s) demandée(s) suffisante(s) sur le fond mais coûteuse(s)${wp.length ? ` (dont ${lijst(wp.slice(0, 2).map((c) => `« ${c.construct.label} »`), taal)})` : ""}. Deux : la couche de risque — ${duurzaamheidsVlag ? `le drapeau « ${duurzaamheidsVlag.label} » est actif : ${duurzaamheidsVlag.toelichting}` : "aucun drapeau spécifique de durabilité ou de récupération actif"}. Ensemble, ils disent si la correspondance tient aussi sous pression soutenue. ${disc}`,
      en: `Durability is read here in two places. One: the energy watch points — ${u.energiewaakpunten} required line(s) substantively sufficient but energy-costing${wp.length ? ` (incl. ${lijst(wp.slice(0, 2).map((c) => `"${c.construct.label}"`), taal)})` : ""}. Two: the risk layer — ${duurzaamheidsVlag ? `the "${duurzaamheidsVlag.label}" flag is active: ${duurzaamheidsVlag.toelichting}` : "no specific durability or recovery flag is active"}. Together they tell you whether the match holds not just today but under sustained pressure. ${disc}`,
      es: `La durabilidad se lee aquí en dos lugares. Uno: los puntos de atención de energía — ${u.energiewaakpunten} línea(s) requerida(s) suficiente(s) en lo sustantivo pero costosa(s)${wp.length ? ` (incl. ${lijst(wp.slice(0, 2).map((c) => `«${c.construct.label}»`), taal)})` : ""}. Dos: la capa de riesgo — ${duurzaamheidsVlag ? `la bandera «${duurzaamheidsVlag.label}» está activa: ${duurzaamheidsVlag.toelichting}` : "ninguna bandera específica de durabilidad o recuperación activa"}. Juntos dicen si la coincidencia aguanta bajo presión sostenida. ${disc}`,
      ru: `Устойчивость читается здесь в двух местах. Первое: точки внимания по энергии — ${u.energiewaakpunten} требуемых линий, достаточных по сути, но отнимающих энергию${wp.length ? ` (в т.ч. ${lijst(wp.slice(0, 2).map((c) => `«${c.construct.label}»`), taal)})` : ""}. Второе: слой риска — ${duurzaamheidsVlag ? `флаг «${duurzaamheidsVlag.label}» активен: ${duurzaamheidsVlag.toelichting}` : "нет активного специфического флага устойчивости или восстановления"}. Вместе они говорят, держится ли совпадение и при постоянном давлении. ${disc}`,
    };
    return { reply: k(kop, taal), veiligheid: null };
  }

  // De CHALLENGE: kritische investeerdersvraag naar het zwakste punt.
  if (intentie === "challenge_zwakte") {
    // Bepaal het zwakste punt PUUR uit de studie, in prioriteitsvolgorde.
    const kritMismatch = needs.filter((c) => c.kritisch && c.oordeel === "mismatch");
    const kritAandacht = needs.filter((c) => c.kritisch && c.oordeel === "aandacht");
    const needMismatch = needs.filter((c) => c.oordeel === "mismatch");
    const needAandacht = needs.filter((c) => c.oordeel === "aandacht");
    const wp = needs.filter((c) => (c.inhoudelijk === "sterk" || c.inhoudelijk === "voldoende") && c.energie === "kost");
    const structureel = u.risicovlaggen.length >= 3;

    let kernNL = "";
    let kernFR = "";
    let kernEN = "";
    let kernES = "";
    let kernRU = "";

    const beschrijf = (c: ConstructResultaat) => ({
      nl: `de kritische lijn "${c.construct.label}" (${VERVULLING_LABEL[c.niveau]}, net ${sign(c.net)}, ${ENERGIE_LABEL[c.energie].toLowerCase()}): ${c.toelichting}`,
      fr: `la ligne critique « ${c.construct.label} » (${VERVULLING_LABEL[c.niveau]}, net ${sign(c.net)}, ${ENERGIE_LABEL[c.energie].toLowerCase()}) : ${c.toelichting}`,
      en: `the critical line "${c.construct.label}" (${VERVULLING_LABEL[c.niveau]}, net ${sign(c.net)}, ${ENERGIE_LABEL[c.energie].toLowerCase()}): ${c.toelichting}`,
      es: `la línea crítica «${c.construct.label}» (${VERVULLING_LABEL[c.niveau]}, net ${sign(c.net)}, ${ENERGIE_LABEL[c.energie].toLowerCase()}): ${c.toelichting}`,
      ru: `критическая линия «${c.construct.label}» (${VERVULLING_LABEL[c.niveau]}, net ${sign(c.net)}, ${ENERGIE_LABEL[c.energie].toLowerCase()}): ${c.toelichting}`,
    });

    if (kritMismatch.length) {
      const b = beschrijf(kritMismatch[0]!);
      kernNL = `Het zwaarst wegende zwakke punt is ${b.nl} Dit is een kritisch succescriterium dat inhoudelijk wordt afgewezen — in de aggregatieregels is dat dé directe oorzaak van een mismatch-eindoordeel.`;
      kernFR = `Le point faible le plus lourd est ${b.fr} C'est un critère critique rejeté sur le fond — dans les règles d'agrégation, c'est LA cause directe d'un verdict de non-correspondance.`;
      kernEN = `The heaviest weak point is ${b.en} This is a critical success criterion that is substantively rejected — in the aggregation rules that is THE direct cause of a mismatch verdict.`;
      kernES = `El punto débil más pesado es ${b.es} Es un criterio crítico rechazado en lo sustantivo — en las reglas de agregación es LA causa directa de un veredicto de no coincidencia.`;
      kernRU = `Самое тяжёлое слабое место — ${b.ru} Это критический критерий, отвергаемый по сути — по правилам агрегации это ПРЯМАЯ причина вывода о несоответствии.`;
    } else if (structureel) {
      const namen = u.risicovlaggen.map((v) => v.label);
      kernNL = `Het zwaarst wegende zwakke punt is niet één lijn maar een stapeling: ${u.risicovlaggen.length} risicovlaggen vallen samen (${lijst(namen, "nl")}). Drie of meer telt als structureel duurzaamheidsrisico en weegt door in het eindoordeel, ook als het inhoudelijke talentbeeld sterk is.`;
      kernFR = `Le point faible le plus lourd n'est pas une ligne mais un cumul : ${u.risicovlaggen.length} drapeaux de risque coïncident (${lijst(namen, "fr")}). Trois ou plus comptent comme risque structurel de durabilité et pèsent sur le verdict, même si le tableau de talents est fort.`;
      kernEN = `The heaviest weak point is not one line but an accumulation: ${u.risicovlaggen.length} risk flags coincide (${lijst(namen, "en")}). Three or more counts as a structural durability risk and weighs on the verdict, even if the substantive talent picture is strong.`;
      kernES = `El punto débil más pesado no es una línea sino una acumulación: ${u.risicovlaggen.length} banderas de riesgo coinciden (${lijst(namen, "es")}). Tres o más cuenta como riesgo estructural de durabilidad y pesa en el veredicto, aunque el cuadro de talento sea fuerte.`;
      kernRU = `Самое тяжёлое слабое место — не одна линия, а накопление: совпадают ${u.risicovlaggen.length} флагов риска (${lijst(namen, "ru")}). Три и более считаются структурным риском устойчивости и весят на выводе, даже если содержательный портрет талантов силён.`;
    } else if (kritAandacht.length) {
      const b = beschrijf(kritAandacht[0]!);
      kernNL = `Het zwaarst wegende zwakke punt is ${b.nl} Het is een kritische lijn die aandacht vraagt — niet afgewezen, maar zwak of sterk-maar-energiekostend. Dat trekt het eindoordeel minstens naar 'aandacht' en is precies waar een investeerder zou doorvragen.`;
      kernFR = `Le point faible le plus lourd est ${b.fr} C'est une ligne critique qui demande attention — non rejetée, mais faible ou forte-mais-coûteuse. Cela tire le verdict au moins vers « attention » et c'est là qu'un investisseur creuserait.`;
      kernEN = `The heaviest weak point is ${b.en} It is a critical line that calls for attention — not rejected, but weak or strong-but-energy-costing. That pulls the verdict at least to 'attention' and is exactly where an investor would dig.`;
      kernES = `El punto débil más pesado es ${b.es} Es una línea crítica que requiere atención — no rechazada, sino débil o fuerte-pero-costosa. Lleva el veredicto al menos a 'atención' y es justo donde un inversor indagaría.`;
      kernRU = `Самое тяжёлое слабое место — ${b.ru} Это критическая линия, требующая внимания — не отвергнута, но слаба или сильна-но-энергозатратна. Это тянет вывод как минимум к «вниманию» и именно здесь инвестор копал бы глубже.`;
    } else if (needMismatch.length) {
      const b = beschrijf(needMismatch[0]!);
      kernNL = `Het zwaarst wegende zwakke punt is ${b.nl} Het is geen kritisch gemarkeerde lijn, maar wel een gevraagde need die inhoudelijk wordt afgewezen — een reële barst in het fundament die je kritisch moet wegen.`;
      kernFR = `Le point faible le plus lourd est ${b.fr} Ce n'est pas une ligne marquée critique, mais un need demandé rejeté sur le fond — une vraie fissure dans le socle à peser sérieusement.`;
      kernEN = `The heaviest weak point is ${b.en} It is not a critically flagged line, but a required need that is substantively rejected — a real crack in the foundation you must weigh critically.`;
      kernES = `El punto débil más pesado es ${b.es} No es una línea marcada como crítica, pero es un need requerido rechazado en lo sustantivo — una grieta real en el fundamento que debes sopesar.`;
      kernRU = `Самое тяжёлое слабое место — ${b.ru} Это не критически отмеченная линия, а требуемый need, отвергнутый по сути — реальная трещина в фундаменте, которую нужно критически взвесить.`;
    } else if (wp.length) {
      const b = beschrijf(wp[0]!);
      kernNL = `Inhoudelijk is er geen mismatch, dus het zwakste punt zit in de duurzaamheid: ${b.nl} De kandidaat kán deze gevraagde lijn, maar het kost energie — bij aanhoudende druk is dat het eerste wat kan eroderen.`;
      kernFR = `Sur le fond, pas de non-correspondance ; le point faible est donc la durabilité : ${b.fr} Le candidat sait faire cette ligne demandée, mais cela coûte de l'énergie — sous pression soutenue, c'est ce qui s'érode en premier.`;
      kernEN = `Substantively there is no mismatch, so the weakest point is durability: ${b.en} The candidate can do this required line, but it costs energy — under sustained pressure that is the first thing that can erode.`;
      kernES = `En lo sustantivo no hay no coincidencia, así que el punto más débil es la durabilidad: ${b.es} El candidato puede con esta línea requerida, pero le cuesta energía — bajo presión sostenida es lo primero que puede erosionarse.`;
      kernRU = `По сути несоответствия нет, поэтому самое слабое место — устойчивость: ${b.ru} Кандидат справляется с этой требуемой линией, но это отнимает энергию — при постоянном давлении это первое, что может разрушиться.`;
    } else if (needAandacht.length) {
      const b = beschrijf(needAandacht[0]!);
      kernNL = `Het zwakste punt is ${b.nl} Een gevraagde lijn die aandacht vraagt — geen breekpunt, maar wel iets om in de gaten te houden.`;
      kernFR = `Le point faible est ${b.fr} Une ligne demandée qui demande attention — pas un point de rupture, mais à surveiller.`;
      kernEN = `The weakest point is ${b.en} A required line that calls for attention — not a breaking point, but something to keep an eye on.`;
      kernES = `El punto débil es ${b.es} Una línea requerida que requiere atención — no un punto de ruptura, pero a vigilar.`;
      kernRU = `Самое слабое место — ${b.ru} Требуемая линия, требующая внимания — не точка разрыва, но за ней стоит следить.`;
    } else {
      kernNL = `Eerlijk gezegd toont deze studie geen uitgesproken zwak punt: alle ${u.needTotaal} need-lijnen scoren een match, er zijn geen actieve risicovlaggen en geen energiewaakpunten. Voor een kritische lezer is dan net de vraag: is het rolprofiel scherp genoeg opgesteld? Een te 'glad' beeld kan betekenen dat de needs te ruim of te weinig kritisch zijn afgebakend.`;
      kernFR = `Honnêtement, cette étude ne montre pas de point faible marqué : les ${u.needTotaal} lignes need sont en correspondance, aucun drapeau de risque actif, aucun point d'attention énergie. Pour un lecteur critique, la vraie question devient : le profil de rôle est-il assez exigeant ? Un tableau trop « lisse » peut signifier des needs trop larges ou trop peu critiques.`;
      kernEN = `Honestly, this study shows no pronounced weak point: all ${u.needTotaal} need lines score a match, there are no active risk flags and no energy watch points. For a critical reader the real question then becomes: is the role profile sharp enough? A too-'smooth' picture may mean the needs were drawn too broadly or too rarely marked critical.`;
      kernES = `Sinceramente, este estudio no muestra un punto débil marcado: las ${u.needTotaal} líneas need coinciden, no hay banderas de riesgo activas ni puntos de atención de energía. Para un lector crítico la verdadera pregunta es: ¿el perfil del rol es lo bastante exigente? Un cuadro demasiado 'liso' puede significar needs demasiado amplios o poco marcados como críticos.`;
      kernRU = `Честно говоря, это исследование не показывает выраженного слабого места: все ${u.needTotaal} линий need на совпадении, нет активных флагов риска и точек внимания по энергии. Для критичного читателя тогда главный вопрос: достаточно ли строг профиль роли? Слишком «гладкая» картина может означать, что needs заданы слишком широко или слишком редко отмечены критическими.`;
    }

    const slot: ML = {
      nl: " Dit is de scherpste lezing die de data toelaat — verder oordelen over geschiktheid of de investering zelf is aan de stakeholders met hun procesbegeleider.",
      fr: " C'est la lecture la plus tranchante que les données permettent — juger de l'aptitude ou de l'investissement lui-même revient aux parties prenantes avec leur facilitateur.",
      en: " This is the sharpest reading the data allows — judging suitability or the investment itself is for the stakeholders with their facilitator.",
      es: " Esta es la lectura más afilada que permiten los datos — juzgar la idoneidad o la inversión en sí corresponde a las partes interesadas con su facilitador.",
      ru: " Это самое острое прочтение, которое позволяют данные — судить о пригодности или о самой инвестиции — дело заинтересованных сторон с их фасилитатором.",
    };
    const kern: ML = { nl: kernNL, fr: kernFR, en: kernEN, es: kernES, ru: kernRU };
    const heeftHardSignaal = kritMismatch.length > 0 || structureel;
    return { reply: `${k(kern, taal)}${k(slot, taal)} ${disc}`, veiligheid: heeftHardSignaal ? "coach" : null };
  }

  // Specifieke lijn opvragen: zoek het construct waarvan het label in de vraag staat.
  if (intentie === "vergelijk_lijn") {
    const q = normaliseer(vraag);
    const gevonden = u.constructen.find((c) => q.includes(normaliseer(c.construct.label)) || normaliseer(c.construct.label).split(" ").some((w) => w.length > 4 && q.includes(w)));
    if (gevonden) {
      const m: ML = {
        nl: `${lijnTekst(gevonden, taal)} (classificatie: ${gevonden.classificatie}${gevonden.kritisch ? ", kritisch" : ""}). ${disc}`,
        fr: `${lijnTekst(gevonden, taal)} (classification : ${gevonden.classificatie}${gevonden.kritisch ? ", critique" : ""}). ${disc}`,
        en: `${lijnTekst(gevonden, taal)} (classification: ${gevonden.classificatie}${gevonden.kritisch ? ", critical" : ""}). ${disc}`,
        es: `${lijnTekst(gevonden, taal)} (clasificación: ${gevonden.classificatie}${gevonden.kritisch ? ", crítico" : ""}). ${disc}`,
        ru: `${lijnTekst(gevonden, taal)} (классификация: ${gevonden.classificatie}${gevonden.kritisch ? ", критич." : ""}). ${disc}`,
      };
      return { reply: k(m, taal), veiligheid: null };
    }
    // val door naar onbekend-redenering als er geen lijn herkend werd.
  }

  // ONBEKEND / niet direct herkende vraag: REDENEER puur uit de studie i.p.v.
  // te weigeren. Geef het skelet van de uitkomst + nodig uit om aan te scherpen.
  // Diepere onbekend-fallback: geef de volledige synthese i.p.v. het magere
  // skelet, zodat ook een vage vraag echte verbanden terugkrijgt.
  return bouwSyntheseRecruiter();
    const aandachtNamen = needs.filter((c) => c.oordeel === "aandacht" || c.oordeel === "mismatch").slice(0, 2).map((c) => `"${c.construct.label}"`);
  const vlagNamen = u.risicovlaggen.slice(0, 2).map((v) => v.label);
  const m: ML = {
    nl:
      `Die vraag staat niet letterlijk in de studie, maar ik laat je niet met lege handen — ik redeneer eruit. ` +
      `Het eindoordeel is "${EINDOORDEEL_LABEL[u.eindoordeel]}" (${u.needMatch}/${u.needTotaal} need-lijnen op match, ${u.needAandacht} op aandacht, ${u.needMismatch} op mismatch). ` +
      (aandachtNamen.length ? `De lijnen die aandacht vragen zijn vooral ${lijst(aandachtNamen, taal)}. ` : "Geen enkele need-lijn vraagt aandacht. ") +
      (vlagNamen.length ? `Actieve risicovlaggen: ${lijst(vlagNamen, taal)}. ` : "Er zijn geen actieve risicovlaggen. ") +
      `Bijna elke kritische vraag valt op één van deze assen: een dragende need-lijn, een kritisch succescriterium, een energiewaakpunt of een risicovlag. Vraag me gerust scherper — bv. het zwakste punt, de kritische criteria of de duurzaamheid — dan onderbouw ik het volledig. ${disc}`,
    fr:
      `Cette question ne figure pas telle quelle dans l'étude, mais je ne te laisse pas sans réponse — je raisonne à partir d'elle. ` +
      `Le verdict est « ${EINDOORDEEL_LABEL[u.eindoordeel]} » (${u.needMatch}/${u.needTotaal} lignes need en correspondance, ${u.needAandacht} en attention, ${u.needMismatch} en non-correspondance). ` +
      (aandachtNamen.length ? `Les lignes qui demandent attention sont surtout ${lijst(aandachtNamen, taal)}. ` : "Aucune ligne need ne demande attention. ") +
      (vlagNamen.length ? `Drapeaux de risque actifs : ${lijst(vlagNamen, taal)}. ` : "Aucun drapeau de risque actif. ") +
      `Presque toute question critique relève d'un de ces axes : une ligne need porteuse, un critère critique, un point d'attention énergie ou un drapeau de risque. Précise ta question — p. ex. le point le plus faible, les critères critiques ou la durabilité — et j'étaye pleinement. ${disc}`,
    en:
      `That question isn't literally in the study, but I won't leave you empty-handed — I reason from it. ` +
      `The verdict is "${EINDOORDEEL_LABEL[u.eindoordeel]}" (${u.needMatch}/${u.needTotaal} need lines on match, ${u.needAandacht} on attention, ${u.needMismatch} on mismatch). ` +
      (aandachtNamen.length ? `The lines calling for attention are mainly ${lijst(aandachtNamen, taal)}. ` : "No need line calls for attention. ") +
      (vlagNamen.length ? `Active risk flags: ${lijst(vlagNamen, taal)}. ` : "There are no active risk flags. ") +
      `Almost any critical question falls on one of these axes: a load-bearing need line, a critical success criterion, an energy watch point or a risk flag. Ask more sharply — e.g. the weakest point, the critical criteria or durability — and I'll ground it fully. ${disc}`,
    es:
      `Esa pregunta no está literalmente en el estudio, pero no te dejo sin respuesta — razono a partir de él. ` +
      `El veredicto es "${EINDOORDEEL_LABEL[u.eindoordeel]}" (${u.needMatch}/${u.needTotaal} líneas need en coincidencia, ${u.needAandacht} en atención, ${u.needMismatch} en no coincidencia). ` +
      (aandachtNamen.length ? `Las líneas que requieren atención son sobre todo ${lijst(aandachtNamen, taal)}. ` : "Ninguna línea need requiere atención. ") +
      (vlagNamen.length ? `Banderas de riesgo activas: ${lijst(vlagNamen, taal)}. ` : "No hay banderas de riesgo activas. ") +
      `Casi cualquier pregunta crítica cae en uno de estos ejes: una línea need portante, un criterio crítico, un punto de atención de energía o una bandera de riesgo. Afina tu pregunta — p. ej. el punto más débil, los criterios críticos o la durabilidad — y lo fundamento del todo. ${disc}`,
    ru:
      `Этого вопроса нет дословно в исследовании, но я не оставлю вас без ответа — я рассуждаю из него. ` +
      `Вывод — «${EINDOORDEEL_LABEL[u.eindoordeel]}» (${u.needMatch}/${u.needTotaal} линий need на совпадении, ${u.needAandacht} на внимании, ${u.needMismatch} на несоответствии). ` +
      (aandachtNamen.length ? `Линии, требующие внимания, прежде всего ${lijst(aandachtNamen, taal)}. ` : "Ни одна линия need не требует внимания. ") +
      (vlagNamen.length ? `Активные флаги риска: ${lijst(vlagNamen, taal)}. ` : "Активных флагов риска нет. ") +
      `Почти любой критический вопрос ложится на одну из осей: несущая линия need, критический критерий, точка внимания по энергии или флаг риска. Спросите точнее — напр. самое слабое место, критические критерии или устойчивость — и я обосную полностью. ${disc}`,
  };
  return { reply: k(m, taal), veiligheid: null };
}
