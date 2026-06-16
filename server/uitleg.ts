// server/uitleg.ts
// Script-engine voor de gesproken profieluitleg (audio) van het T4P Business Kompas.
//
// Bouwt uit de bestaande profieldata (generatorContract) een gesproken script
// van 6 blokken, in de taal van de invuller, in twee tonen:
//   - "deelnemer": warm, reflectief, herkenning (geen diagnose/selectie/potentieel)
//   - "coach":     zakelijker, coaching-gericht, met handvatten voor het gesprek
//
// "Driver" is een wetenschappelijke term (naar Taibi Kahler) en wordt NOOIT vertaald.
// Alle andere interne termen blijven onzichtbaar voor de deelnemer.
//
// Deze module heeft zijn EIGEN private kopieën van de helpers die dashboard.ts/chat.ts
// niet exporteren (FAMILIE_LABEL, DRIVERS_DUIDING, energieLabel, parseContract, k, ML, ConstructRow).

import type { Taal } from "@shared/talen";
import { filterTalentFoci } from "@shared/talent-constructs";

// ---------------------------------------------------------------------------
// Basis-typen + helpers (private kopieën — bewust niet geïmporteerd)
// ---------------------------------------------------------------------------

type ML = Record<Taal, string>;

const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;

interface ConstructRow {
  construct: string;
  family: string; // "Talent-foci" | "Talent-versnellers" | "Drivers"
  net: number;
  avgEnergy: number;
  energySource?: string;
  mostItems?: string[];
}

// Familie-labels in mensentaal (geen interne termen) — eigen kopie.
const FAMILIE_LABEL: Record<string, ML> = {
  "Talent-foci": {
    nl: "talentfocus",
    fr: "focus de talent",
    en: "talent focus",
    es: "foco de talento",
    ru: "фокус таланта",
  },
  "Talent-versnellers": {
    nl: "versterkend gedrag",
    fr: "comportement amplificateur",
    en: "amplifying behaviour",
    es: "comportamiento amplificador",
    ru: "усиливающее поведение",
  },
  Drivers: {
    nl: "Drivers",
    fr: "Drivers",
    en: "Drivers",
    es: "Drivers",
    ru: "Drivers",
  },
};

// Neutrale duiding van de term "Drivers" (naar Taibi Kahler) — eigen kopie.
const DRIVERS_DUIDING: ML = {
  nl: 'De term "Drivers" verwijst naar onbewuste controlemechanismen (naar Taibi Kahler) die je gedrag onder druk sturen en de toegang tot je talenten kunnen bemoeilijken.',
  fr: 'Le terme "Drivers" désigne des mécanismes de contrôle inconscients (d\'après Taibi Kahler) qui orientent ton comportement sous pression et peuvent compliquer l\'accès à tes talents.',
  en: 'The term "Drivers" refers to unconscious control mechanisms (after Taibi Kahler) that steer your behaviour under pressure and can hinder access to your talents.',
  es: 'El término "Drivers" se refiere a mecanismos de control inconscientes (según Taibi Kahler) que dirigen tu comportamiento bajo presión y pueden dificultar el acceso a tus talentos.',
  ru: 'Термин «Drivers» обозначает бессознательные механизмы контроля (по Тайби Калеру), которые управляют твоим поведением под давлением и могут затруднять доступ к твоим талантам.',
};

function energieLabel(n: number, taal: Taal): string {
  // n op schaal 0..10
  if (n >= 7.5) return k({ nl: "hoog", fr: "élevé", en: "high", es: "alto", ru: "высокий" }, taal);
  if (n >= 6) return k({ nl: "gezond", fr: "sain", en: "healthy", es: "saludable", ru: "здоровый" }, taal);
  if (n >= 4.5) return k({ nl: "matig", fr: "modéré", en: "moderate", es: "moderado", ru: "умеренный" }, taal);
  return k({ nl: "laag", fr: "bas", en: "low", es: "bajo", ru: "низкий" }, taal);
}

// JSON-string-of-object parser; null indien geen sections.main.
function parseContract(contractRaw: unknown): any | null {
  let obj: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      obj = JSON.parse(contractRaw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const main = obj?.contract?.sections?.main ?? obj?.sections?.main;
  if (!main) return null;
  return main;
}

// ---------------------------------------------------------------------------
// Profielsamenvatting uit de brondata
// ---------------------------------------------------------------------------

interface UitlegProfiel {
  naam: string;
  foci: ConstructRow[]; // top-3 Talent-foci, net aflopend
  versnellers: ConstructRow[]; // top-2 Talent-versnellers, net aflopend
  driverTop: ConstructRow | null;
  driverLabel: "laag" | "matig" | "hoog";
  vragenlijstEnergie: number; // 0..10
  baselineEnergie: number; // 0..10
  consScore: number; // 0..100
}

function bouwProfiel(main: any, naam?: string): UitlegProfiel | null {
  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  if (!rows.length) return null;

  // TaPas-Beeld is GEEN talent-focus en mag nooit in de volgorde/lijst staan.
  const foci = filterTalentFoci(rows)
    .sort((a, b) => b.net - a.net)
    .slice(0, 3);
  const versnellers = rows
    .filter((r) => r.family === "Talent-versnellers")
    .sort((a, b) => b.net - a.net)
    .slice(0, 2);

  const meta = main.meta ?? {};
  const driverRisk = meta.driverRisk ?? {};
  const driverTop: ConstructRow | null =
    Array.isArray(driverRisk.top) && driverRisk.top.length ? driverRisk.top[0] : null;
  const driverLabel: "laag" | "matig" | "hoog" = (driverRisk.label as any) ?? "laag";

  const vragenlijstEnergie =
    typeof meta.normalizedQuestionnaireEnergy === "number" ? meta.normalizedQuestionnaireEnergy : 6;
  const baselineEnergie =
    typeof meta.baselineProfessionalEnergy === "number" ? meta.baselineProfessionalEnergy : vragenlijstEnergie;
  const consScore =
    meta.consistency && typeof meta.consistency.score === "number" ? meta.consistency.score : 100;

  return {
    naam: naam ?? "",
    foci,
    versnellers,
    driverTop,
    driverLabel,
    vragenlijstEnergie,
    baselineEnergie,
    consScore,
  };
}

// ---------------------------------------------------------------------------
// Taal-fragmenten (vaste, herbruikbare zinsdelen, 5 talen)
// ---------------------------------------------------------------------------

type Toon = "deelnemer" | "coach";

const VOORNAAM = (naam: string): string => (naam || "").trim().split(/\s+/)[0] ?? "";

// Lijst van constructnamen netjes aan elkaar rijgen ("a, b en c")
function rijg(items: string[], taal: Taal): string {
  const en = k({ nl: "en", fr: "et", en: "and", es: "y", ru: "и" }, taal);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " " + en + " " + items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Bloktitels (zichtbaar in de speler — clientvriendelijk, geen interne termen)
// ---------------------------------------------------------------------------

export interface UitlegBlok {
  id: string;
  titel: string;
  tekst: string; // gesproken tekst (TTS / browserspraak)
}

export interface UitlegScript {
  taal: Taal;
  toon: Toon;
  naam: string;
  blokken: UitlegBlok[];
}

const BLOKTITELS: Record<string, ML> = {
  wat_is_tapas: {
    nl: "Wat is TaPas?",
    fr: "Qu'est-ce que TaPas ?",
    en: "What is TaPas?",
    es: "¿Qué es TaPas?",
    ru: "Что такое TaPas?",
  },
  jouw_profiel: {
    nl: "Wat vertelt jouw profiel?",
    fr: "Que raconte ton profil ?",
    en: "What does your profile tell?",
    es: "¿Qué dice tu perfil?",
    ru: "Что говорит твой профиль?",
  },
  opvallend: {
    nl: "Opvallende dingen",
    fr: "Éléments marquants",
    en: "Notable points",
    es: "Aspectos destacados",
    ru: "Заметные моменты",
  },
  toekomst: {
    nl: "Toekomstperspectief",
    fr: "Perspectives d'avenir",
    en: "Future perspective",
    es: "Perspectiva de futuro",
    ru: "Перспективы на будущее",
  },
  aandachtspunten: {
    nl: "Aandachtspunten",
    fr: "Points d'attention",
    en: "Points of attention",
    es: "Puntos de atención",
    ru: "На что обратить внимание",
  },
  hoe_verder: {
    nl: "Hoe verder?",
    fr: "Et maintenant ?",
    en: "How to move forward",
    es: "Cómo seguir",
    ru: "Как двигаться дальше",
  },
};

// Coach-varianten van de titels (zakelijker)
const BLOKTITELS_COACH: Record<string, ML> = {
  wat_is_tapas: {
    nl: "Het TaPas-kader",
    fr: "Le cadre TaPas",
    en: "The TaPas framework",
    es: "El marco TaPas",
    ru: "Рамка TaPas",
  },
  jouw_profiel: {
    nl: "Profiel-constructen",
    fr: "Construits du profil",
    en: "Profile constructs",
    es: "Constructos del perfil",
    ru: "Конструкты профиля",
  },
  opvallend: {
    nl: "Sterkste signalen",
    fr: "Signaux les plus forts",
    en: "Strongest signals",
    es: "Señales más fuertes",
    ru: "Самые сильные сигналы",
  },
  toekomst: {
    nl: "Ontwikkelrichting",
    fr: "Direction de développement",
    en: "Development direction",
    es: "Dirección de desarrollo",
    ru: "Направление развития",
  },
  aandachtspunten: {
    nl: "Bewaakpunten",
    fr: "Points de vigilance",
    en: "Watch points",
    es: "Puntos de vigilancia",
    ru: "Точки контроля",
  },
  hoe_verder: {
    nl: "Coachhandvatten",
    fr: "Leviers de coaching",
    en: "Coaching handles",
    es: "Palancas de coaching",
    ru: "Опоры для коучинга",
  },
};

// ===========================================================================
// BLOK 1 — Wat is TaPas?
// ===========================================================================

function blok1(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const vn = VOORNAAM(p.naam);
  if (toon === "deelnemer") {
    const m: ML = {
      nl: `${vn ? vn + ", " : ""}welkom bij de uitleg van je TaPas-profiel. TaPas staat voor Talent en Passie. Het is geen test en geen oordeel, maar een spiegel. Het laat zien waar jouw aandacht en energie van nature naartoe gaan, en hoe je het makkelijkst tot mooie resultaten komt. Lees alles dus vooral als een uitnodiging tot herkenning: wat klopt voor jou, en wat wil je verder verkennen?`,
      fr: `${vn ? vn + ", " : ""}bienvenue dans l'explication de ton profil TaPas. TaPas signifie Talent et Passion. Ce n'est ni un test ni un jugement, mais un miroir. Il montre vers quoi vont naturellement ton attention et ton énergie, et comment tu obtiens le plus facilement de beaux résultats. Lis tout cela comme une invitation à te reconnaître : qu'est-ce qui te correspond, et qu'as-tu envie d'explorer davantage ?`,
      en: `${vn ? vn + ", " : ""}welcome to the explanation of your TaPas profile. TaPas stands for Talent and Passion. It is not a test and not a judgement, but a mirror. It shows where your attention and energy naturally go, and how you most easily reach good results. So read it all as an invitation to recognise yourself: what fits you, and what would you like to explore further?`,
      es: `${vn ? vn + ", " : ""}bienvenido a la explicación de tu perfil TaPas. TaPas significa Talento y Pasión. No es una prueba ni un juicio, sino un espejo. Muestra hacia dónde van de forma natural tu atención y tu energía, y cómo logras resultados con mayor facilidad. Léelo todo como una invitación a reconocerte: qué encaja contigo y qué te gustaría explorar más.`,
      ru: `${vn ? vn + ", " : ""}добро пожаловать к разбору твоего профиля TaPas. TaPas означает Талант и Страсть. Это не тест и не оценка, а зеркало. Оно показывает, куда естественно направлены твоё внимание и энергия и как тебе легче всего достигать хороших результатов. Воспринимай всё это как приглашение узнать себя: что тебе подходит и что хочется исследовать дальше.`,
    };
    return k(m, taal);
  }
  // coach
  const m: ML = {
    nl: `Dit is de coachversie van de profieluitleg. TaPas staat voor Talent en Passie en werkt reflectief, niet diagnostisch: het geeft je gesprekstof, geen etiket. Gebruik deze uitleg als opener om samen te toetsen waar talent en energie samenvallen en waar de context die toegang ondersteunt of afremt. Vermijd selectie- of geschiktheidstaal; blijf bij herkenning en hypothese.`,
    fr: `Voici la version coach de l'explication du profil. TaPas signifie Talent et Passion et fonctionne de façon réflexive, non diagnostique : il offre matière à dialogue, pas une étiquette. Utilise cette explication comme entrée en matière pour vérifier ensemble où talent et énergie coïncident et où le contexte soutient ou freine cet accès. Évite tout langage de sélection ou d'aptitude ; reste dans la reconnaissance et l'hypothèse.`,
    en: `This is the coach version of the profile explanation. TaPas stands for Talent and Passion and works reflectively, not diagnostically: it offers material for dialogue, not a label. Use this explanation as an opener to jointly check where talent and energy coincide and where context supports or slows that access. Avoid selection or suitability language; stay with recognition and hypothesis.`,
    es: `Esta es la versión para coach de la explicación del perfil. TaPas significa Talento y Pasión y funciona de forma reflexiva, no diagnóstica: ofrece material de conversación, no una etiqueta. Usa esta explicación como apertura para verificar juntos dónde coinciden talento y energía y dónde el contexto apoya o frena ese acceso. Evita el lenguaje de selección o aptitud; quédate en el reconocimiento y la hipótesis.`,
    ru: `Это версия разбора профиля для коуча. TaPas означает Талант и Страсть и работает рефлексивно, а не диагностически: он даёт материал для разговора, а не ярлык. Используй этот разбор как вступление, чтобы вместе проверить, где совпадают талант и энергия и где контекст поддерживает или тормозит этот доступ. Избегай формулировок отбора или пригодности; оставайся в рамках узнавания и гипотезы.`,
  };
  return k(m, taal);
}

// ===========================================================================
// BLOK 2 — Wat vertelt jouw profiel? (constructen)
// ===========================================================================

function blok2(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const fociNamen = p.foci.map((r) => r.construct);
  const versnNamen = p.versnellers.map((r) => r.construct);
  const fociLabel = k(FAMILIE_LABEL["Talent-foci"], taal);
  const versnLabel = k(FAMILIE_LABEL["Talent-versnellers"], taal);
  const driverNaam = p.driverTop ? p.driverTop.construct : "";

  if (toon === "deelnemer") {
    const m: ML = {
      nl: `Je profiel leest drie lagen samen. Eerst je ${fociLabel}: waar je aandacht vanzelf naartoe trekt. Bij jou zijn dat vooral ${rijg(fociNamen, taal)}. Daarnaast je ${versnLabel}: de manier waarop je het snelst tot resultaat komt, met name ${rijg(versnNamen, taal)}. En ten slotte je Drivers. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `Bij jou is "${driverNaam}" het meest aanwezig.` : ""} Samen vormen die lagen jouw TaPas-beeld: een geheel dat je waarschijnlijk meteen herkent.`,
      fr: `Ton profil lit trois couches ensemble. D'abord ton ${fociLabel} : là où ton attention se porte naturellement. Chez toi, ce sont surtout ${rijg(fociNamen, taal)}. Ensuite ton ${versnLabel} : la manière dont tu obtiens le plus vite des résultats, notamment ${rijg(versnNamen, taal)}. Et enfin tes Drivers. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `Chez toi, « ${driverNaam} » est le plus présent.` : ""} Ensemble, ces couches forment ton image TaPas : un ensemble que tu reconnais probablement aussitôt.`,
      en: `Your profile reads three layers together. First your ${fociLabel}: where your attention naturally goes. For you that is mainly ${rijg(fociNamen, taal)}. Then your ${versnLabel}: the way you reach results fastest, especially ${rijg(versnNamen, taal)}. And finally your Drivers. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `For you, "${driverNaam}" is the most present.` : ""} Together these layers form your TaPas picture: a whole you will probably recognise right away.`,
      es: `Tu perfil lee tres capas juntas. Primero tu ${fociLabel}: hacia dónde va tu atención de forma natural. En tu caso son sobre todo ${rijg(fociNamen, taal)}. Luego tu ${versnLabel}: la manera en que llegas más rápido a resultados, en especial ${rijg(versnNamen, taal)}. Y por último tus Drivers. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `En tu caso, «${driverNaam}» es el más presente.` : ""} Juntas, estas capas forman tu imagen TaPas: un conjunto que probablemente reconocerás de inmediato.`,
      ru: `Твой профиль читает три слоя вместе. Сначала твой ${fociLabel}: куда естественно направлено твоё внимание. У тебя это прежде всего ${rijg(fociNamen, taal)}. Затем твой ${versnLabel}: то, как ты быстрее всего приходишь к результату, особенно ${rijg(versnNamen, taal)}. И наконец твои Drivers. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `У тебя сильнее всего выражен «${driverNaam}».` : ""} Вместе эти слои образуют твою картину TaPas — целое, которое ты, вероятно, сразу узнаёшь.`,
    };
    return k(m, taal);
  }
  // coach
  const m: ML = {
    nl: `Het profiel rust op drie constructen. De ${fociLabel}-laag toont waar de aandacht in flow komt: ${rijg(fociNamen, taal)}. De ${versnLabel}-laag toont de route naar resultaat: ${rijg(versnNamen, taal)}. De Drivers vormen de derde laag. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `De dominante Driver is "${driverNaam}".` : ""} Lees de volgorde nooit als ranking of score, maar als ontsluitingslogica. Toets in het gesprek of de context die toegang opent of afremt.`,
    fr: `Le profil repose sur trois construits. La couche ${fociLabel} montre où l'attention entre en flux : ${rijg(fociNamen, taal)}. La couche ${versnLabel} montre la route vers le résultat : ${rijg(versnNamen, taal)}. Les Drivers forment la troisième couche. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `Le Driver dominant est « ${driverNaam} ».` : ""} Ne lis jamais l'ordre comme un classement ou un score, mais comme une logique d'accès. Vérifie en entretien si le contexte ouvre ou freine cet accès.`,
    en: `The profile rests on three constructs. The ${fociLabel} layer shows where attention enters flow: ${rijg(fociNamen, taal)}. The ${versnLabel} layer shows the route to results: ${rijg(versnNamen, taal)}. The Drivers form the third layer. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `The dominant Driver is "${driverNaam}".` : ""} Never read the order as ranking or score, but as access logic. In the conversation, test whether context opens or slows that access.`,
    es: `El perfil descansa en tres constructos. La capa ${fociLabel} muestra dónde la atención entra en flujo: ${rijg(fociNamen, taal)}. La capa ${versnLabel} muestra la ruta hacia los resultados: ${rijg(versnNamen, taal)}. Los Drivers forman la tercera capa. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `El Driver dominante es «${driverNaam}».` : ""} Nunca leas el orden como ranking o puntuación, sino como lógica de acceso. En la conversación, comprueba si el contexto abre o frena ese acceso.`,
    ru: `Профиль опирается на три конструкта. Слой ${fociLabel} показывает, где внимание входит в поток: ${rijg(fociNamen, taal)}. Слой ${versnLabel} показывает путь к результату: ${rijg(versnNamen, taal)}. Drivers образуют третий слой. ${k(DRIVERS_DUIDING, taal)} ${driverNaam ? `Доминирующий Driver — «${driverNaam}».` : ""} Никогда не читай порядок как рейтинг или оценку, а как логику доступа. В беседе проверь, открывает ли контекст этот доступ или тормозит его.`,
  };
  return k(m, taal);
}

// ===========================================================================
// BLOK 3 — Opvallende dingen (1-2 sterkste signalen)
// ===========================================================================

function blok3(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const topFocus = p.foci[0]?.construct ?? "";
  const topVersn = p.versnellers[0]?.construct ?? "";
  const energieLab = energieLabel(p.vragenlijstEnergie, taal);

  if (toon === "deelnemer") {
    const m: ML = {
      nl: `Twee dingen springen eruit. Ten eerste de combinatie van ${topFocus ? `"${topFocus}"` : "je sterkste focus"} met ${topVersn ? `"${topVersn}"` : "je sterkste versterkende gedrag"}: dat is een herkenbare, krachtige motor in je werk. Ten tweede je energiebeeld: dat oogt op dit moment ${energieLab}. Dat is geen cijfer over jou als persoon, maar een momentopname van hoe veel ruimte je nu ervaart om vanuit je talent te werken.`,
      fr: `Deux choses ressortent. D'abord la combinaison de ${topFocus ? `« ${topFocus} »` : "ton focus le plus fort"} avec ${topVersn ? `« ${topVersn} »` : "ton comportement amplificateur le plus fort"} : c'est un moteur reconnaissable et puissant dans ton travail. Ensuite ton image d'énergie : elle apparaît pour l'instant ${energieLab}. Ce n'est pas une note sur toi en tant que personne, mais un instantané de la marge que tu ressens actuellement pour travailler depuis ton talent.`,
      en: `Two things stand out. First, the combination of ${topFocus ? `"${topFocus}"` : "your strongest focus"} with ${topVersn ? `"${topVersn}"` : "your strongest amplifying behaviour"}: that is a recognisable, powerful engine in your work. Second, your energy picture: right now it looks ${energieLab}. That is not a grade about you as a person, but a snapshot of how much room you currently feel to work from your talent.`,
      es: `Dos cosas destacan. Primero, la combinación de ${topFocus ? `«${topFocus}»` : "tu foco más fuerte"} con ${topVersn ? `«${topVersn}»` : "tu comportamiento amplificador más fuerte"}: es un motor reconocible y potente en tu trabajo. Segundo, tu imagen de energía: en este momento se ve ${energieLab}. No es una nota sobre ti como persona, sino una instantánea del margen que sientes ahora para trabajar desde tu talento.`,
      ru: `Выделяются две вещи. Во-первых, сочетание ${topFocus ? `«${topFocus}»` : "твоего самого сильного фокуса"} с ${topVersn ? `«${topVersn}»` : "твоим самым сильным усиливающим поведением"}: это узнаваемый, мощный двигатель в твоей работе. Во-вторых, твоя картина энергии: сейчас она выглядит как ${energieLab}. Это не оценка тебя как личности, а снимок того, сколько простора ты сейчас ощущаешь, чтобы работать из своего таланта.`,
    };
    return k(m, taal);
  }
  // coach
  const baselineDelta = p.baselineEnergie - p.vragenlijstEnergie;
  const consLaag = p.consScore < 50;
  const m: ML = {
    nl: `Twee signalen verdienen aandacht in het gesprek. Eén: de koppeling ${topFocus ? `"${topFocus}"` : "topfocus"} met ${topVersn ? `"${topVersn}"` : "topversneller"} is de dragende as — daar zit de hefboom. Twee: het energiebeeld is ${energieLab}${baselineDelta >= 2 ? ", terwijl de baseline duidelijk hoger ligt — dat verschil is een gespreksopener" : ""}.${consLaag ? " Let ook op: de consistentie van de antwoorden is aan de lage kant, dus toets liever dan te concluderen." : ""} Behandel dit als hypothese, niet als bevinding.`,
    fr: `Deux signaux méritent attention en entretien. Un : le couplage ${topFocus ? `« ${topFocus} »` : "focus principal"} avec ${topVersn ? `« ${topVersn} »` : "accélérateur principal"} est l'axe porteur — c'est là qu'est le levier. Deux : l'image d'énergie est ${energieLab}${baselineDelta >= 2 ? ", alors que la base de référence est nettement plus haute — cet écart ouvre la conversation" : ""}.${consLaag ? " Attention aussi : la cohérence des réponses est plutôt basse, donc vérifie plutôt que de conclure." : ""} Traite cela comme une hypothèse, pas un constat.`,
    en: `Two signals deserve attention in the conversation. One: the coupling of ${topFocus ? `"${topFocus}"` : "top focus"} with ${topVersn ? `"${topVersn}"` : "top accelerator"} is the load-bearing axis — that is where the leverage sits. Two: the energy picture is ${energieLab}${baselineDelta >= 2 ? ", while the baseline is clearly higher — that gap is a conversation opener" : ""}.${consLaag ? " Also note: the consistency of the answers is on the low side, so test rather than conclude." : ""} Treat this as a hypothesis, not a finding.`,
    es: `Dos señales merecen atención en la conversación. Una: el acoplamiento de ${topFocus ? `«${topFocus}»` : "foco principal"} con ${topVersn ? `«${topVersn}»` : "acelerador principal"} es el eje portante — ahí está la palanca. Dos: la imagen de energía es ${energieLab}${baselineDelta >= 2 ? ", mientras que la base es claramente más alta — esa diferencia abre la conversación" : ""}.${consLaag ? " Observa también: la consistencia de las respuestas es algo baja, así que verifica en lugar de concluir." : ""} Trátalo como hipótesis, no como hallazgo.`,
    ru: `Два сигнала заслуживают внимания в беседе. Первый: связка ${topFocus ? `«${topFocus}»` : "ведущего фокуса"} с ${topVersn ? `«${topVersn}»` : "ведущим ускорителем"} — это несущая ось, здесь рычаг. Второй: картина энергии — ${energieLab}${baselineDelta >= 2 ? ", тогда как базовый уровень заметно выше — этот разрыв открывает разговор" : ""}.${consLaag ? " Также учти: согласованность ответов скорее низкая, поэтому проверяй, а не делай вывод." : ""} Рассматривай это как гипотезу, а не как вывод.`,
  };
  return k(m, taal);
}

// ===========================================================================
// BLOK 4 — Toekomstperspectief
// ===========================================================================

function blok4(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const topFocus = p.foci[0]?.construct ?? "";
  const topVersn = p.versnellers[0]?.construct ?? "";

  if (toon === "deelnemer") {
    const m: ML = {
      nl: `Vooruitkijken: jouw profiel wijst naar rollen en projecten waar ${topFocus ? `"${topFocus}"` : "je sterkste focus"} centraal staat en waar je ${topVersn ? `"${topVersn}"` : "je natuurlijke aanpak"} echt mag inzetten. Denk niet alleen aan je huidige functie — durf breder te kijken naar contexten waarin precies dit talent meer ruimte krijgt. Het is geen voorspelling die vastligt, maar een richting om bewust naar toe te bewegen.`,
      fr: `Regard vers l'avenir : ton profil oriente vers des rôles et projets où ${topFocus ? `« ${topFocus} »` : "ton focus le plus fort"} est central et où tu peux vraiment déployer ${topVersn ? `« ${topVersn} »` : "ton approche naturelle"}. Ne pense pas qu'à ta fonction actuelle — ose regarder plus large, vers des contextes où précisément ce talent obtient plus d'espace. Ce n'est pas une prédiction figée, mais une direction vers laquelle avancer consciemment.`,
      en: `Looking ahead: your profile points to roles and projects where ${topFocus ? `"${topFocus}"` : "your strongest focus"} is central and where you can truly deploy ${topVersn ? `"${topVersn}"` : "your natural approach"}. Do not think only of your current job — dare to look wider, to contexts where exactly this talent gets more room. It is not a fixed prediction, but a direction to move towards consciously.`,
      es: `Mirando adelante: tu perfil apunta a roles y proyectos donde ${topFocus ? `«${topFocus}»` : "tu foco más fuerte"} es central y donde puedes desplegar de verdad ${topVersn ? `«${topVersn}»` : "tu enfoque natural"}. No pienses solo en tu función actual — atrévete a mirar más amplio, a contextos donde precisamente este talento tiene más espacio. No es una predicción fija, sino una dirección hacia la que avanzar conscientemente.`,
      ru: `Взгляд вперёд: твой профиль указывает на роли и проекты, где ${topFocus ? `«${topFocus}»` : "твой самый сильный фокус"} в центре и где ты действительно можешь применить ${topVersn ? `«${topVersn}»` : "свой естественный подход"}. Не думай только о текущей должности — решись смотреть шире, на контексты, где именно этот талант получает больше простора. Это не зафиксированный прогноз, а направление, к которому стоит осознанно двигаться.`,
    };
    return k(m, taal);
  }
  // coach
  const m: ML = {
    nl: `Voor de ontwikkelrichting: zet de hefboom ${topFocus ? `"${topFocus}"` : "topfocus"} plus ${topVersn ? `"${topVersn}"` : "topversneller"} centraal bij rolontwerp en loopbaangesprek. Verken samen pistes die verder gaan dan de huidige functie — ook denkleider-, ontwerp- of brugrollen op het snijvlak met een tweede expertise. Houd het bij denkpistes binnen de claimgrens: geen geschiktheidsoordeel, wel richtinggevende hypothesen om te toetsen.`,
    fr: `Pour la direction de développement : place le levier ${topFocus ? `« ${topFocus} »` : "focus principal"} plus ${topVersn ? `« ${topVersn} »` : "accélérateur principal"} au centre du design de rôle et de l'entretien de carrière. Explore ensemble des pistes au-delà de la fonction actuelle — y compris des rôles de référent, de conception ou de pont à l'intersection avec une deuxième expertise. Reste sur des pistes de réflexion dans la limite des affirmations : pas de jugement d'aptitude, mais des hypothèses directrices à vérifier.`,
    en: `For the development direction: put the lever ${topFocus ? `"${topFocus}"` : "top focus"} plus ${topVersn ? `"${topVersn}"` : "top accelerator"} at the centre of role design and the career conversation. Explore paths beyond the current job together — including thought-leader, design, or bridge roles at the intersection with a second expertise. Stay with thinking paths within the claim boundary: no suitability judgement, but directional hypotheses to test.`,
    es: `Para la dirección de desarrollo: pon la palanca ${topFocus ? `«${topFocus}»` : "foco principal"} más ${topVersn ? `«${topVersn}»` : "acelerador principal"} en el centro del diseño de rol y la conversación de carrera. Explorad juntos vías más allá de la función actual — incluidos roles de referente, de diseño o de puente en la intersección con una segunda experiencia. Quédate en vías de reflexión dentro del límite de afirmaciones: sin juicio de aptitud, pero con hipótesis orientadoras que verificar.`,
    ru: `Для направления развития: поставь рычаг ${topFocus ? `«${topFocus}»` : "ведущий фокус"} плюс ${topVersn ? `«${topVersn}»` : "ведущий ускоритель"} в центр проектирования роли и карьерной беседы. Вместе исследуйте пути за пределами текущей должности — включая роли лидера мысли, проектные или связующие на стыке со второй экспертизой. Оставайся в рамках гипотез в пределах допустимых утверждений: не оценка пригодности, а направляющие гипотезы для проверки.`,
  };
  return k(m, taal);
}

// ===========================================================================
// BLOK 5 — Aandachtspunten (mild, zorg-kompas toon)
// ===========================================================================

function blok5(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const driverNaam = p.driverTop ? p.driverTop.construct : "";
  const driverHoog = p.driverLabel === "hoog";
  const driverMatig = p.driverLabel === "matig";
  const energieLaag = p.vragenlijstEnergie < 4.5;

  if (toon === "deelnemer") {
    const m: ML = {
      nl: `Een paar aandachtspunten, mild bedoeld. Onder druk kan ${driverNaam ? `je Driver "${driverNaam}"` : "een dominante Driver"} sterker gaan sturen en de toegang tot je talent tijdelijk vernauwen.${driverHoog ? " Dat signaal is op dit moment wat meer aanwezig, dus het is goed om er rustig bij stil te staan." : driverMatig ? " Het signaal is matig aanwezig — iets om af en toe op te letten." : " Het signaal is nu beperkt aanwezig."}${energieLaag ? " Ook je energie oogt nu aan de lage kant; wees daar mild voor jezelf in." : ""} Dit is geen diagnose, maar een vriendelijke uitnodiging om goed voor je energie te zorgen. Voelt iets echt zwaar of persoonlijk, bespreek dat dan met een coach of vertrouwenspersoon.`,
      fr: `Quelques points d'attention, dans un esprit bienveillant. Sous pression, ${driverNaam ? `ton Driver « ${driverNaam} »` : "un Driver dominant"} peut orienter plus fort et rétrécir temporairement l'accès à ton talent.${driverHoog ? " Ce signal est un peu plus présent en ce moment, il vaut donc la peine de s'y arrêter calmement." : driverMatig ? " Le signal est modérément présent — à surveiller de temps en temps." : " Le signal est pour l'instant limité."}${energieLaag ? " Ton énergie semble aussi plutôt basse en ce moment ; sois indulgent envers toi-même." : ""} Ce n'est pas un diagnostic, mais une invitation amicale à prendre soin de ton énergie. Si quelque chose pèse vraiment ou devient personnel, parles-en avec un coach ou une personne de confiance.`,
      en: `A few points of attention, gently meant. Under pressure, ${driverNaam ? `your Driver "${driverNaam}"` : "a dominant Driver"} can steer more strongly and temporarily narrow access to your talent.${driverHoog ? " That signal is somewhat more present right now, so it is worth pausing on calmly." : driverMatig ? " The signal is moderately present — something to watch now and then." : " The signal is currently limited."}${energieLaag ? " Your energy also looks rather low at the moment; be gentle with yourself there." : ""} This is not a diagnosis, but a friendly invitation to take good care of your energy. If something feels truly heavy or personal, discuss it with a coach or a person you trust.`,
      es: `Algunos puntos de atención, con buena intención. Bajo presión, ${driverNaam ? `tu Driver «${driverNaam}»` : "un Driver dominante"} puede dirigir con más fuerza y estrechar temporalmente el acceso a tu talento.${driverHoog ? " Esa señal está algo más presente ahora, así que vale la pena detenerse con calma." : driverMatig ? " La señal está moderadamente presente — algo que vigilar de vez en cuando." : " La señal está ahora limitada."}${energieLaag ? " Tu energía también se ve más bien baja en este momento; sé amable contigo mismo." : ""} Esto no es un diagnóstico, sino una invitación amable a cuidar tu energía. Si algo se siente realmente pesado o personal, háblalo con un coach o una persona de confianza.`,
      ru: `Несколько моментов для внимания, с мягким намерением. Под давлением ${driverNaam ? `твой Driver «${driverNaam}»` : "доминирующий Driver"} может управлять сильнее и временно сужать доступ к твоему таланту.${driverHoog ? " Сейчас этот сигнал выражен несколько сильнее, поэтому стоит спокойно на нём задержаться." : driverMatig ? " Сигнал выражен умеренно — стоит время от времени за ним следить." : " Сейчас сигнал выражен ограниченно."}${energieLaag ? " Твоя энергия сейчас тоже выглядит скорее низкой; будь к себе мягок." : ""} Это не диагноз, а дружеское приглашение бережно относиться к своей энергии. Если что-то ощущается по-настоящему тяжёлым или личным, обсуди это с коучем или человеком, которому доверяешь.`,
    };
    return k(m, taal);
  }
  // coach
  const m: ML = {
    nl: `Bewaakpunten voor het traject. ${driverNaam ? `De Driver "${driverNaam}"` : "De dominante Driver"} is bij oplopende druk de eerste kandidaat voor tunnelvisie; het risicobeeld staat nu op "${p.driverLabel}".${energieLaag ? " De energie is laag — weeg belastbaarheid mee voor je interventies kiest." : ""} Behandel alles als hypothese, niet als oordeel. Belangrijk: bij signalen die persoonlijk, existentieel of zorgwekkend zijn, verwijs door naar een coach, therapeut of vertrouwenspersoon — blijf binnen je rol en de claimgrens.`,
    fr: `Points de vigilance pour le parcours. ${driverNaam ? `Le Driver « ${driverNaam} »` : "Le Driver dominant"} est, sous pression croissante, le premier candidat à la vision en tunnel ; l'image de risque est actuellement « ${p.driverLabel} ».${energieLaag ? " L'énergie est basse — tiens compte de la capacité avant de choisir tes interventions." : ""} Traite tout comme hypothèse, pas comme jugement. Important : pour des signaux personnels, existentiels ou préoccupants, oriente vers un coach, un thérapeute ou une personne de confiance — reste dans ton rôle et la limite des affirmations.`,
    en: `Watch points for the trajectory. ${driverNaam ? `The Driver "${driverNaam}"` : "The dominant Driver"} is, under rising pressure, the first candidate for tunnel vision; the risk picture currently reads "${p.driverLabel}".${energieLaag ? " Energy is low — factor in capacity before choosing interventions." : ""} Treat everything as hypothesis, not judgement. Important: for personal, existential, or concerning signals, refer on to a coach, therapist, or trusted person — stay within your role and the claim boundary.`,
    es: `Puntos de vigilancia para el recorrido. ${driverNaam ? `El Driver «${driverNaam}»` : "El Driver dominante"} es, bajo presión creciente, el primer candidato a la visión de túnel; la imagen de riesgo está ahora en «${p.driverLabel}».${energieLaag ? " La energía es baja — ten en cuenta la capacidad antes de elegir intervenciones." : ""} Trátalo todo como hipótesis, no como juicio. Importante: ante señales personales, existenciales o preocupantes, deriva a un coach, terapeuta o persona de confianza — quédate dentro de tu rol y del límite de afirmaciones.`,
    ru: `Точки контроля для процесса. ${driverNaam ? `Driver «${driverNaam}»` : "Доминирующий Driver"} при нарастающем давлении — первый кандидат на туннельное зрение; картина риска сейчас «${p.driverLabel}».${energieLaag ? " Энергия низкая — учитывай ресурс, прежде чем выбирать интервенции." : ""} Рассматривай всё как гипотезу, а не как суждение. Важно: при личных, экзистенциальных или тревожных сигналах направляй к коучу, терапевту или доверенному лицу — оставайся в рамках своей роли и допустимых утверждений.`,
  };
  return k(m, taal);
}

// ===========================================================================
// BLOK 6 — Hoe verder (concrete next step + coach referral)
// ===========================================================================

function blok6(p: UitlegProfiel, taal: Taal, toon: Toon): string {
  const topFocus = p.foci[0]?.construct ?? "";

  if (toon === "deelnemer") {
    const m: ML = {
      nl: `Hoe nu verder? Kies één concrete situatie in je werk waarin je ${topFocus ? `"${topFocus}"` : "je sterkste talent"} de komende weken bewust meer ruimte geeft, en merk op wat dat met je energie doet. Lees je profiel rustig na en streep aan wat je echt herkent. En wil je hier dieper op ingaan, dan kan een gesprek met een TaPas-coach helpen om je profiel te vertalen naar concrete keuzes. Dank je wel om je profiel met aandacht te bekijken.`,
      fr: `Et maintenant ? Choisis une situation concrète dans ton travail où tu donnes consciemment plus d'espace à ${topFocus ? `« ${topFocus} »` : "ton talent le plus fort"} dans les prochaines semaines, et observe l'effet sur ton énergie. Relis ton profil tranquillement et souligne ce que tu reconnais vraiment. Et si tu veux approfondir, un échange avec un coach TaPas peut aider à traduire ton profil en choix concrets. Merci d'avoir regardé ton profil avec attention.`,
      en: `How to move forward? Pick one concrete situation in your work where, over the coming weeks, you consciously give ${topFocus ? `"${topFocus}"` : "your strongest talent"} more room, and notice what that does to your energy. Reread your profile calmly and underline what you truly recognise. And if you want to go deeper, a conversation with a TaPas coach can help translate your profile into concrete choices. Thank you for looking at your profile with care.`,
      es: `¿Cómo seguir? Elige una situación concreta en tu trabajo donde, en las próximas semanas, des conscientemente más espacio a ${topFocus ? `«${topFocus}»` : "tu talento más fuerte"}, y observa qué le hace a tu energía. Relee tu perfil con calma y subraya lo que realmente reconoces. Y si quieres profundizar, una conversación con un coach TaPas puede ayudar a traducir tu perfil en decisiones concretas. Gracias por mirar tu perfil con atención.`,
      ru: `Как двигаться дальше? Выбери одну конкретную ситуацию в работе, где в ближайшие недели ты осознанно дашь больше простора ${topFocus ? `«${topFocus}»` : "своему самому сильному таланту"}, и замечай, как это влияет на твою энергию. Спокойно перечитай профиль и подчеркни то, что действительно узнаёшь. А если захочешь углубиться, разговор с коучем TaPas поможет перевести профиль в конкретные решения. Спасибо, что внимательно отнёсся к своему профилю.`,
    };
    return k(m, taal);
  }
  // coach
  const m: ML = {
    nl: `Tot slot, coachhandvatten. Open het gesprek met herkenning, niet met de tabel: laat de deelnemer eerst vertellen wat klopt. Werk daarna toe naar één concrete experimenteersituatie rond ${topFocus ? `"${topFocus}"` : "de dragende focus"}, met een korte evaluatie achteraf. Houd het zorg-kompas paraat: bij persoonlijke of zwaardere thema's verwijs je gericht door. Sluit af met een vervolgafspraak zodat de reflectie niet bij dit ene moment blijft.`,
    fr: `Pour finir, des leviers de coaching. Ouvre l'entretien par la reconnaissance, pas par le tableau : laisse d'abord la personne dire ce qui lui correspond. Oriente ensuite vers une situation d'expérimentation concrète autour de ${topFocus ? `« ${topFocus} »` : "le focus porteur"}, avec une courte évaluation ensuite. Garde le repère de soin à portée : pour des thèmes personnels ou plus lourds, oriente de façon ciblée. Termine par un rendez-vous de suivi pour que la réflexion ne s'arrête pas à ce seul moment.`,
    en: `Finally, coaching handles. Open the conversation with recognition, not the table: let the participant first say what fits. Then work towards one concrete experiment situation around ${topFocus ? `"${topFocus}"` : "the load-bearing focus"}, with a short evaluation afterwards. Keep the care compass ready: for personal or heavier themes, refer on deliberately. Close with a follow-up appointment so the reflection does not stop at this single moment.`,
    es: `Por último, palancas de coaching. Abre la conversación con el reconocimiento, no con la tabla: deja que la persona diga primero qué encaja. Luego avanza hacia una situación de experimentación concreta en torno a ${topFocus ? `«${topFocus}»` : "el foco portante"}, con una breve evaluación después. Mantén a mano la brújula de cuidado: ante temas personales o más pesados, deriva de forma deliberada. Cierra con una cita de seguimiento para que la reflexión no se quede en este único momento.`,
    ru: `Наконец, опоры для коучинга. Начинай беседу с узнавания, а не с таблицы: пусть участник сначала скажет, что ему подходит. Затем подведи к одной конкретной экспериментальной ситуации вокруг ${topFocus ? `«${topFocus}»` : "несущего фокуса"}, с короткой оценкой после. Держи наготове компас заботы: при личных или более тяжёлых темах целенаправленно направляй дальше. Заверши договорённостью о следующей встрече, чтобы рефлексия не осталась этим единственным моментом.`,
  };
  return k(m, taal);
}

// ===========================================================================
// Publieke API
// ===========================================================================

const BLOK_DEFS: Array<{ id: string; fn: (p: UitlegProfiel, t: Taal, toon: Toon) => string }> = [
  { id: "wat_is_tapas", fn: blok1 },
  { id: "jouw_profiel", fn: blok2 },
  { id: "opvallend", fn: blok3 },
  { id: "toekomst", fn: blok4 },
  { id: "aandachtspunten", fn: blok5 },
  { id: "hoe_verder", fn: blok6 },
];

/**
 * Bouwt het volledige gesproken uitleg-script (6 blokken) uit de profieldata.
 * Retourneert null als er geen bruikbare profieldata is.
 */
export function bouwUitlegScript(
  contractRaw: unknown,
  taal: Taal,
  toon: Toon = "deelnemer",
  naam?: string,
): UitlegScript | null {
  const main = parseContract(contractRaw);
  if (!main) return null;
  const profiel = bouwProfiel(main, naam);
  if (!profiel) return null;

  const titels = toon === "coach" ? BLOKTITELS_COACH : BLOKTITELS;

  const blokken: UitlegBlok[] = BLOK_DEFS.map((def) => ({
    id: def.id,
    titel: k(titels[def.id], taal),
    tekst: def.fn(profiel, taal, toon).replace(/\s+/g, " ").trim(),
  }));

  return {
    taal,
    toon,
    naam: profiel.naam,
    blokken,
  };
}

export type { Toon };
