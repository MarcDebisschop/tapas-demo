// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Fase 2: vragenlijst-galerij
//
// Een catalogus van beschikbare instrumenten die de deelnemer (extra) kan
// invullen, met een "past bij jou"-logica die kijkt naar het bestaande profiel
// (energie, driver-belasting, herkenbaarheid). De galerij is meertalig en
// toont per instrument een korte preview. "Driver" blijft beschermd & onvertaald.
//
// Opmerking: de echte afname-flow van extra instrumenten komt later; hier
// leveren we de catalogus, de matching en preview-data zodat de sectie
// "Vragenlijsten voor jou" volledig getoond en gedemonstreerd kan worden.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import { isTalentFocusConstruct } from "@shared/talent-constructs";

type ML = Record<Taal, string>;
const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;

export interface GalerijItem {
  id: string;
  titel: string;
  ondertitel: string;
  beschrijving: string;
  duurMin: number;
  // Tag die de toon/kleur in de UI bepaalt.
  thema: "talent" | "energie" | "drivers" | "team" | "loopbaan";
  // Korte preview: 2-3 voorbeeldvragen.
  preview: string[];
  // Of dit instrument al beschikbaar is om te starten (anders "binnenkort").
  beschikbaar: boolean;
  // Aanbevelingsreden (gevuld door de matching-logica) + score.
  aanbevolen?: boolean;
  reden?: string;
  matchScore?: number;
}

// Ruwe catalogus (taalonafhankelijke kern + meertalige teksten).
interface RawItem {
  id: string;
  thema: GalerijItem["thema"];
  duurMin: number;
  beschikbaar: boolean;
  titel: ML;
  ondertitel: ML;
  beschrijving: ML;
  preview: Record<Taal, string[]>;
}

const CATALOGUS: RawItem[] = [
  {
    id: "talent-verdieping",
    thema: "talent",
    duurMin: 12,
    beschikbaar: true,
    titel: {
      nl: "Talent-verdieping",
      fr: "Approfondissement des talents",
      en: "Talent deep-dive",
      es: "Profundización del talento",
      ru: "Углубление в таланты",
    },
    ondertitel: {
      nl: "Breng je sterkste talentfoci scherper in beeld",
      fr: "Affine tes focus de talent les plus forts",
      en: "Sharpen the picture of your strongest talent foci",
      es: "Afina tus focos de talento más fuertes",
      ru: "Уточните картину ваших сильнейших фокусов таланта",
    },
    beschrijving: {
      nl: "Een korte verdieping op de talenten die in je profiel naar boven kwamen, met concrete situaties uit je eigen werk.",
      fr: "Un court approfondissement des talents apparus dans ton profil, à partir de situations concrètes de ton travail.",
      en: "A short deep-dive on the talents that surfaced in your profile, anchored in concrete situations from your own work.",
      es: "Una breve profundización en los talentos que surgieron en tu perfil, con situaciones concretas de tu trabajo.",
      ru: "Короткое углубление в таланты из вашего профиля на основе конкретных рабочих ситуаций.",
    },
    preview: {
      nl: ["In welke taak voel je de tijd vervliegen?", "Wanneer kreeg je laatst onverwacht energie van je werk?"],
      fr: ["Dans quelle tâche le temps file-t-il ?", "Quand ton travail t'a-t-il dernièrement donné de l'énergie ?"],
      en: ["In which task does time fly by?", "When did your work last give you unexpected energy?"],
      es: ["¿En qué tarea se te pasa el tiempo volando?", "¿Cuándo te dio energía tu trabajo por última vez?"],
      ru: ["В какой задаче время летит незаметно?", "Когда работа в последний раз неожиданно дала вам энергию?"],
    },
  },
  {
    id: "energie-monitor",
    thema: "energie",
    duurMin: 5,
    beschikbaar: true,
    titel: {
      nl: "Energie-monitor",
      fr: "Moniteur d'énergie",
      en: "Energy monitor",
      es: "Monitor de energía",
      ru: "Монитор энергии",
    },
    ondertitel: {
      nl: "Een snelle check van je energie op dit moment",
      fr: "Un contrôle rapide de ton énergie en ce moment",
      en: "A quick check of your energy right now",
      es: "Una comprobación rápida de tu energía ahora",
      ru: "Быстрая проверка вашей энергии сейчас",
    },
    beschrijving: {
      nl: "Volg in vijf minuten hoe je energie evolueert sinds je laatste profiel, zodat je tijdig kunt bijsturen.",
      fr: "Suis en cinq minutes l'évolution de ton énergie depuis ton dernier profil pour ajuster à temps.",
      en: "Track in five minutes how your energy has evolved since your last profile, so you can adjust in time.",
      es: "Sigue en cinco minutos cómo evoluciona tu energía desde tu último perfil para ajustar a tiempo.",
      ru: "За пять минут отследите, как изменилась ваша энергия с прошлого профиля, чтобы вовремя скорректировать курс.",
    },
    preview: {
      nl: ["Hoe vol voelt je accu vandaag (0-10)?", "Welk deel van je werk kost nu het meest?"],
      fr: ["À combien est ta batterie aujourd'hui (0-10) ?", "Quelle partie de ton travail coûte le plus ?"],
      en: ["How full is your battery today (0-10)?", "Which part of your work costs the most right now?"],
      es: ["¿Qué tan llena está tu batería hoy (0-10)?", "¿Qué parte de tu trabajo cuesta más ahora?"],
      ru: ["Насколько заряжена ваша батарея сегодня (0-10)?", "Какая часть работы сейчас отнимает больше всего сил?"],
    },
  },
  {
    id: "drivers-onder-druk",
    thema: "drivers",
    duurMin: 10,
    beschikbaar: true,
    titel: {
      nl: "Drivers onder druk",
      fr: "Drivers sous pression",
      en: "Drivers under pressure",
      es: "Drivers bajo presión",
      ru: "Drivers под давлением",
    },
    ondertitel: {
      nl: "Herken je Drivers vóór ze je sturen (naar Taibi Kahler)",
      fr: "Reconnais tes Drivers avant qu'ils te dirigent (d'après Taibi Kahler)",
      en: "Spot your Drivers before they steer you (after Taibi Kahler)",
      es: "Reconoce tus Drivers antes de que te dirijan (según Taibi Kahler)",
      ru: "Распознайте свои Drivers, прежде чем они начнут вами управлять (по Taibi Kahler)",
    },
    beschrijving: {
      nl: "Een verdieping op de Drivers die in je profiel opvielen, met situaties waarin ze het sterkst opspelen en hoe je er ruimte van maakt.",
      fr: "Un approfondissement sur les Drivers remarqués dans ton profil, avec les situations où ils sont les plus forts et comment t'en libérer.",
      en: "A deep-dive on the Drivers that stood out in your profile, with the situations where they peak and how to create space around them.",
      es: "Una profundización en los Drivers que destacaron en tu perfil, con las situaciones donde más actúan y cómo darles espacio.",
      ru: "Углубление в Drivers, выделившиеся в вашем профиле: ситуации, где они проявляются сильнее всего, и как дать им пространство.",
    },
    preview: {
      nl: ["Wat doe je als iets niet 'perfect' genoeg is?", "Wanneer voel je de drang om door te jagen?"],
      fr: ["Que fais-tu quand quelque chose n'est pas assez « parfait » ?", "Quand ressens-tu l'envie de te dépêcher ?"],
      en: ["What do you do when something isn't 'perfect' enough?", "When do you feel the urge to hurry?"],
      es: ["¿Qué haces cuando algo no es lo bastante 'perfecto'?", "¿Cuándo sientes la urgencia de apurarte?"],
      ru: ["Что вы делаете, когда что-то недостаточно «идеально»?", "Когда вы чувствуете желание поторопиться?"],
    },
  },
  {
    id: "out-of-the-box",
    thema: "loopbaan",
    duurMin: 14,
    beschikbaar: true,
    titel: {
      nl: "Out-of-the-box: je onbenutte ruimte",
      fr: "Out-of-the-box : ton espace inexploité",
      en: "Out-of-the-box: your untapped room",
      es: "Out-of-the-box: tu espacio sin explotar",
      ru: "Out-of-the-box: ваш нераскрытый потенциал",
    },
    ondertitel: {
      nl: "Waar je talent ruimer reikt dan je huidige context",
      fr: "Là où ton talent va plus loin que ton contexte actuel",
      en: "Where your talent reaches beyond your current context",
      es: "Donde tu talento llega más lejos que tu contexto actual",
      ru: "Где ваш талант выходит за рамки нынешнего контекста",
    },
    beschrijving: {
      nl: "Je profiel laat zien dat je talent ruimer reikt dan de context waarin je nu actief bent. Dit deel schetst drie out-of-the-box-richtingen — puur als uitnodiging om te onderzoeken, geen voorspelling.",
      fr: "Ton profil montre que ton talent va plus loin que ton contexte actuel. Cette partie esquisse trois directions out-of-the-box — une invitation à explorer, pas une prédiction.",
      en: "Your profile shows your talent reaches beyond your current context. This part sketches three out-of-the-box directions — an invitation to explore, not a prediction.",
      es: "Tu perfil muestra que tu talento llega más lejos que tu contexto actual. Esta parte esboza tres direcciones out-of-the-box — una invitación a explorar, no una predicción.",
      ru: "Ваш профиль показывает, что ваш талант выходит за рамки нынешнего контекста. Здесь — три out-of-the-box-направления, приглашение исследовать, а не прогноз.",
    },
    preview: {
      nl: ["Drie richtingen waarin je talent nóg meer kan renderen", "Waarover zou je je stem laten horen als je niet elk detail moest bewaken?"],
      fr: ["Trois directions où ton talent peut rendre encore plus", "Sur quoi ferais-tu entendre ta voix sans veiller à chaque détail ?"],
      en: ["Three directions where your talent can render even more", "What would you speak up about if you didn't guard every detail?"],
      es: ["Tres direcciones donde tu talento puede rendir aún más", "¿Sobre qué alzarías la voz si no vigilaras cada detalle?"],
      ru: ["Три направления, где ваш талант раскроется сильнее", "О чём бы вы заговорили, не контролируя каждую деталь?"],
    },
  },
];

// Matching-redenen (meertalig).
const REDEN = {
  energieLaag: {
    nl: "Je energie was recent aan de lage kant — deze korte check helpt je bijsturen.",
    fr: "Ton énergie était récemment plutôt basse — ce court contrôle t'aide à ajuster.",
    en: "Your energy was on the low side recently — this quick check helps you adjust.",
    es: "Tu energía estuvo algo baja recientemente — esta comprobación te ayuda a ajustar.",
    ru: "Ваша энергия недавно была низковата — эта быстрая проверка поможет скорректировать курс.",
  } as ML,
  drivers: {
    nl: "Je Drivers vroegen in je profiel om aandacht — dit instrument gaat er dieper op in.",
    fr: "Tes Drivers demandaient de l'attention dans ton profil — cet instrument approfondit cela.",
    en: "Your Drivers asked for attention in your profile — this instrument goes deeper into them.",
    es: "Tus Drivers pedían atención en tu perfil — este instrumento profundiza en ellos.",
    ru: "Ваши Drivers требовали внимания в профиле — этот инструмент углубляется в них.",
  } as ML,
  talentSterk: {
    nl: "Je hebt duidelijke talentfoci — verdiep ze met concrete situaties.",
    fr: "Tu as des focus de talent clairs — approfondis-les avec des situations concrètes.",
    en: "You have clear talent foci — deepen them with concrete situations.",
    es: "Tienes focos de talento claros — profundízalos con situaciones concretas.",
    ru: "У вас есть чёткие фокусы таланта — углубите их на конкретных ситуациях.",
  } as ML,
  herkenbaarheidLaag: {
    nl: "De herkenbaarheid van je beeld was lager — een korte hercheck kan helpen.",
    fr: "La reconnaissance de ton image était plus faible — un nouveau contrôle peut aider.",
    en: "The recognisability of your picture was lower — a quick re-check can help.",
    es: "La reconocibilidad de tu imagen era más baja — una nueva comprobación puede ayudar.",
    ru: "Узнаваемость вашего портрета была ниже — быстрая повторная проверка может помочь.",
  } as ML,
};

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

function parseContract(contractRaw: unknown): any | null {
  let c: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      c = JSON.parse(contractRaw);
    } catch {
      return null;
    }
  }
  if (!c || !c.sections || !c.sections.main) return null;
  return c;
}

// Bouwt de galerij in de juiste taal, met "past bij jou"-aanbevelingen op
// basis van het (eventuele) profiel.
export function bouwGalerij(contractRaw: unknown, taal: Taal): GalerijItem[] {
  const contract = parseContract(contractRaw);
  const meta = contract?.sections?.main?.meta ?? {};
  const rows: ConstructRow[] = Array.isArray(contract?.sections?.main?.constructRows)
    ? contract.sections.main.constructRows
    : [];

  const driverLabel = String(meta?.driverRisk?.label ?? "laag");
  const energie =
    typeof meta?.normalizedQuestionnaireEnergy === "number" ? meta.normalizedQuestionnaireEnergy : null;
  const consScore = typeof meta?.consistency?.score === "number" ? meta.consistency.score : null;
  // TaPas-Beeld telt niet mee als talent-focus.
  const aantalFoci = rows.filter((r) => isTalentFocusConstruct(r) && r.net > 0).length;

  const items: GalerijItem[] = CATALOGUS.map((raw) => {
    const item: GalerijItem = {
      id: raw.id,
      titel: k(raw.titel, taal),
      ondertitel: k(raw.ondertitel, taal),
      beschrijving: k(raw.beschrijving, taal),
      duurMin: raw.duurMin,
      thema: raw.thema,
      preview: raw.preview[taal] ?? raw.preview.nl,
      beschikbaar: raw.beschikbaar,
    };

    // "Past bij jou"-matching (alleen bij een bestaand profiel).
    if (contract) {
      let score = 0;
      let reden: string | null = null;
      if (raw.thema === "energie" && energie !== null && energie < 5.5) {
        score = 3;
        reden = k(REDEN.energieLaag, taal);
      } else if (raw.thema === "drivers" && (driverLabel === "hoog" || driverLabel === "matig")) {
        score = driverLabel === "hoog" ? 3 : 2;
        reden = k(REDEN.drivers, taal);
      } else if (raw.thema === "talent" && aantalFoci >= 1) {
        score = 2;
        reden = k(REDEN.talentSterk, taal);
      }
      // Lage herkenbaarheid → energie-monitor extra aanbevelen.
      if (raw.thema === "energie" && consScore !== null && consScore < 50 && score < 3) {
        score = Math.max(score, 2);
        reden = k(REDEN.herkenbaarheidLaag, taal);
      }
      if (score > 0 && reden) {
        item.aanbevolen = true;
        item.reden = reden;
        item.matchScore = score;
      }
    }
    return item;
  });

  // Aanbevolen items eerst, daarna op beschikbaarheid.
  items.sort((a, b) => {
    const sa = a.matchScore ?? 0;
    const sb = b.matchScore ?? 0;
    if (sb !== sa) return sb - sa;
    if (a.beschikbaar !== b.beschikbaar) return a.beschikbaar ? -1 : 1;
    return 0;
  });

  return items;
}

// Sectie-labels voor de galerij (meertalig).
export function galerijLabels(taal: Taal) {
  const titel: ML = {
    nl: "Vragenlijsten voor jou",
    fr: "Questionnaires pour toi",
    en: "Questionnaires for you",
    es: "Cuestionarios para ti",
    ru: "Опросники для вас",
  };
  const ondertitel: ML = {
    nl: "Aanbevolen op basis van je profiel",
    fr: "Recommandés selon ton profil",
    en: "Recommended based on your profile",
    es: "Recomendados según tu perfil",
    ru: "Рекомендовано на основе вашего профиля",
  };
  const start: ML = {
    nl: "Starten",
    fr: "Commencer",
    en: "Start",
    es: "Empezar",
    ru: "Начать",
  };
  const binnenkort: ML = {
    nl: "Binnenkort",
    fr: "Bientôt",
    en: "Coming soon",
    es: "Próximamente",
    ru: "Скоро",
  };
  const preview: ML = {
    nl: "Voorbeeld",
    fr: "Aperçu",
    en: "Preview",
    es: "Vista previa",
    ru: "Предпросмотр",
  };
  const aanbevolen: ML = {
    nl: "Past bij jou",
    fr: "Te correspond",
    en: "Fits you",
    es: "Encaja contigo",
    ru: "Подходит вам",
  };
  const minuten: ML = {
    nl: "min",
    fr: "min",
    en: "min",
    es: "min",
    ru: "мин",
  };
  return {
    titel: k(titel, taal),
    ondertitel: k(ondertitel, taal),
    start: k(start, taal),
    binnenkort: k(binnenkort, taal),
    preview: k(preview, taal),
    aanbevolen: k(aanbevolen, taal),
    minuten: k(minuten, taal),
  };
}
