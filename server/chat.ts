// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Fase 2: chat-ondersteuning
//
// Deze module levert (1) de centrale, instelbare limiet-config, (2) een
// mensvriendelijke profielcontext voor de AI-assistent, (3) de zorg-kompas-
// risicosignalen uit het bevroren generator-contract, en (4) een
// placeholder-coach voor de warme doorverwijzing (echt coach-register = Fase 3).
//
// PRINCIPE: nooit interne vaktermen lekken. "Driver(s)" blijft beschermd en
// onvertaald (naar Taibi Kahler). De profielcontext beschrijft talenten,
// energie en aandachtspunten in gewone, ondersteunende taal.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import { filterTalentFoci } from "@shared/talent-constructs";

// --- Centrale, instelbare limiet-config ------------------------------------
// gratisLimiet: hoeveel vragen een deelnemer gratis mag stellen (instelbaar).
// pakketGrootte: hoeveel extra vragen één bijgekocht pakket toevoegt.
export const CHAT_CONFIG = {
  gratisLimiet: 10,
  pakketGrootte: 25,
};

type ML = Record<Taal, string>;
const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

// --- Placeholder-coach (echt register volgt in Fase 3) ---------------------
export interface CoachKaart {
  naam: string;
  rol: ML;
  regio: string;
  bericht: ML;
}

export const COACH_PLACEHOLDER: CoachKaart = {
  naam: "Een TaPas-coach bij jou in de buurt",
  rol: {
    nl: "Gecertificeerd talent- & energiecoach",
    fr: "Coach certifié en talents & énergie",
    en: "Certified talent & energy coach",
    es: "Coach certificado de talento y energía",
    ru: "Сертифицированный коуч по талантам и энергии",
  },
  regio: "Vlaanderen",
  bericht: {
    nl: "Sommige vragen verdienen een echt gesprek. Een coach kijkt samen met jou rustig en in vertrouwen naar wat er speelt.",
    fr: "Certaines questions méritent une vraie conversation. Un coach regarde avec toi, en confiance, ce qui se passe.",
    en: "Some questions deserve a real conversation. A coach looks at what's going on together with you, calmly and in confidence.",
    es: "Algunas preguntas merecen una conversación real. Un coach observa contigo, con calma y confianza, lo que ocurre.",
    ru: "Некоторые вопросы заслуживают настоящего разговора. Коуч спокойно и доверительно посмотрит вместе с вами на то, что происходит.",
  },
};

// --- Profielcontext + risicosignalen ---------------------------------------
export interface ChatProfiel {
  // Mensvriendelijke samenvatting voor de systeemprompt (geen interne termen).
  context: string;
  // Zorg-kompas laag A.
  risico: {
    niveau: "geen" | "verhoogd" | "hoog";
    redenen: string[];
  };
}

function parseContract(contractRaw: unknown): any | null {
  let contract: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      contract = JSON.parse(contractRaw);
    } catch {
      return null;
    }
  }
  if (!contract || !contract.sections || !contract.sections.main) return null;
  return contract;
}

// Bouwt de profielcontext (mensentaal) + de zorg-kompas-signalen (intern).
export function bouwChatProfiel(contractRaw: unknown, taal: Taal, naam?: string | null): ChatProfiel {
  const contract = parseContract(contractRaw);
  if (!contract) {
    const geen: ML = {
      nl: "Er is nog geen ingevuld profiel beschikbaar; help de persoon op een algemene, warme manier verder en nodig uit om eerst de vragenlijst af te ronden.",
      fr: "Aucun profil rempli n'est encore disponible ; aide la personne de façon générale et chaleureuse et invite-la à terminer d'abord le questionnaire.",
      en: "No completed profile is available yet; help the person in a general, warm way and invite them to complete the questionnaire first.",
      es: "Aún no hay un perfil completado; ayuda a la persona de forma general y cálida e invítala a completar primero el cuestionario.",
      ru: "Заполненного профиля пока нет; помогите человеку в общей, тёплой манере и предложите сначала пройти опросник.",
    };
    return { context: k(geen, taal), risico: { niveau: "geen", redenen: [] } };
  }

  const main = contract.sections.main;
  const meta = main.meta ?? {};
  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];

  // TaPas-Beeld is GEEN talent-focus en mag nooit in de volgorde/lijst staan.
  const foci = filterTalentFoci(rows)
    .sort((a, b) => b.net - a.net)
    .slice(0, 3)
    .map((r) => r.construct);
  const versnellers = rows
    .filter((r) => r.family === "Talent-versnellers")
    .sort((a, b) => b.net - a.net)
    .slice(0, 2)
    .map((r) => r.construct);

  const dr = meta.driverRisk ?? {};
  const driverTop: string[] = Array.isArray(dr.top)
    ? dr.top.map((d: ConstructRow) => d.construct)
    : [];
  const driverLabel = String(dr.label ?? "laag"); // laag | matig | hoog
  const driverAvg = typeof dr.avg === "number" ? dr.avg : 0;

  const vragenlijstEnergie =
    typeof meta.normalizedQuestionnaireEnergy === "number"
      ? meta.normalizedQuestionnaireEnergy
      : 5;
  const baseline =
    typeof meta.baselineProfessionalEnergy === "number" ? meta.baselineProfessionalEnergy : 5;
  const cons = meta.consistency ?? {};
  const consScore = typeof cons.score === "number" ? cons.score : null;

  // --- Profielcontext (mensentaal, doeltaal) ---
  const naamTxt = naam && naam !== "(nog niet ingevuld)" ? naam : null;
  const fociTxt = foci.length ? foci.join(", ") : "—";
  const versnTxt = versnellers.length ? versnellers.join(", ") : "—";
  const driverTxt = driverTop.length ? driverTop.join(", ") : "—";

  const ctx: ML = {
    nl:
      `${naamTxt ? `Naam: ${naamTxt}. ` : ""}` +
      `Sterkste talentfoci (waar energie vlot stroomt): ${fociTxt}. ` +
      `Versterkend gedrag: ${versnTxt}. ` +
      `Energie tijdens de vragenlijst: ${vragenlijstEnergie.toFixed(1)}/10 (eigen inschatting vooraf: ${baseline.toFixed(1)}/10). ` +
      `Drivers om in het oog te houden (naar Taibi Kahler): ${driverTxt}; driver-belasting: ${driverLabel}. ` +
      `${consScore !== null ? `Herkenbaarheid van het beeld: ${consScore}/100.` : ""}`,
    fr:
      `${naamTxt ? `Nom : ${naamTxt}. ` : ""}` +
      `Focus de talent les plus forts (où l'énergie circule) : ${fociTxt}. ` +
      `Comportement amplificateur : ${versnTxt}. ` +
      `Énergie pendant le questionnaire : ${vragenlijstEnergie.toFixed(1)}/10 (auto-évaluation préalable : ${baseline.toFixed(1)}/10). ` +
      `Drivers à surveiller (d'après Taibi Kahler) : ${driverTxt} ; charge des Drivers : ${driverLabel}. ` +
      `${consScore !== null ? `Reconnaissance de l'image : ${consScore}/100.` : ""}`,
    en:
      `${naamTxt ? `Name: ${naamTxt}. ` : ""}` +
      `Strongest talent foci (where energy flows freely): ${fociTxt}. ` +
      `Amplifying behaviour: ${versnTxt}. ` +
      `Energy during the questionnaire: ${vragenlijstEnergie.toFixed(1)}/10 (own estimate beforehand: ${baseline.toFixed(1)}/10). ` +
      `Drivers to keep an eye on (after Taibi Kahler): ${driverTxt}; Driver load: ${driverLabel}. ` +
      `${consScore !== null ? `Recognisability of the picture: ${consScore}/100.` : ""}`,
    es:
      `${naamTxt ? `Nombre: ${naamTxt}. ` : ""}` +
      `Focos de talento más fuertes (donde fluye la energía): ${fociTxt}. ` +
      `Comportamiento amplificador: ${versnTxt}. ` +
      `Energía durante el cuestionario: ${vragenlijstEnergie.toFixed(1)}/10 (estimación previa propia: ${baseline.toFixed(1)}/10). ` +
      `Drivers a vigilar (según Taibi Kahler): ${driverTxt}; carga de Drivers: ${driverLabel}. ` +
      `${consScore !== null ? `Reconocibilidad de la imagen: ${consScore}/100.` : ""}`,
    ru:
      `${naamTxt ? `Имя: ${naamTxt}. ` : ""}` +
      `Сильнейшие фокусы таланта (где энергия течёт свободно): ${fociTxt}. ` +
      `Усиливающее поведение: ${versnTxt}. ` +
      `Энергия во время опросника: ${vragenlijstEnergie.toFixed(1)}/10 (собственная предварительная оценка: ${baseline.toFixed(1)}/10). ` +
      `Drivers, за которыми стоит следить (по Taibi Kahler): ${driverTxt}; нагрузка Drivers: ${driverLabel}. ` +
      `${consScore !== null ? `Узнаваемость портрета: ${consScore}/100.` : ""}`,
  };

  // --- Zorg-kompas laag A: risicosignalen ---
  const redenen: string[] = [];
  let score = 0;
  if (driverLabel === "hoog" || driverAvg <= -1) {
    redenen.push(
      k(
        {
          nl: "Drivers staan sterk in energieverlies",
          fr: "Les Drivers sont fortement en perte d'énergie",
          en: "Drivers are strongly in energy loss",
          es: "Los Drivers están fuertemente en pérdida de energía",
          ru: "Drivers сильно в потере энергии",
        },
        taal,
      ),
    );
    score += 2;
  } else if (driverLabel === "matig" || driverAvg < 0) {
    redenen.push(
      k(
        {
          nl: "Drivers vragen wat extra aandacht",
          fr: "Les Drivers demandent un peu d'attention",
          en: "Drivers need some extra attention",
          es: "Los Drivers requieren algo de atención",
          ru: "Drivers требуют дополнительного внимания",
        },
        taal,
      ),
    );
    score += 1;
  }
  if (vragenlijstEnergie < 4.5) {
    redenen.push(
      k(
        {
          nl: "Lage energie tijdens de vragenlijst",
          fr: "Énergie basse pendant le questionnaire",
          en: "Low energy during the questionnaire",
          es: "Energía baja durante el cuestionario",
          ru: "Низкая энергия во время опросника",
        },
        taal,
      ),
    );
    score += 2;
  }
  // Sterk negatief verschil tussen zelfbeeld en gemeten energie = mogelijk
  // minder positief zelfbeeld / wrijving met het beeld.
  if (baseline - vragenlijstEnergie >= 2.5) {
    redenen.push(
      k(
        {
          nl: "Het beeld wijkt sterk af van de eigen inschatting",
          fr: "L'image s'écarte fortement de l'auto-évaluation",
          en: "The picture differs strongly from the own estimate",
          es: "La imagen difiere mucho de la propia estimación",
          ru: "Портрет сильно расходится с собственной оценкой",
        },
        taal,
      ),
    );
    score += 1;
  }
  if (consScore !== null && consScore < 50) {
    redenen.push(
      k(
        {
          nl: "Lage herkenbaarheid van het beeld",
          fr: "Faible reconnaissance de l'image",
          en: "Low recognisability of the picture",
          es: "Baja reconocibilidad de la imagen",
          ru: "Низкая узнаваемость портрета",
        },
        taal,
      ),
    );
    score += 1;
  }

  const niveau: "geen" | "verhoogd" | "hoog" =
    score >= 3 ? "hoog" : score >= 1 ? "verhoogd" : "geen";

  return { context: k(ctx, taal).trim(), risico: { niveau, redenen } };
}

// Suggestie-startvragen voor het chatpaneel (per taal).
export function chatSuggesties(taal: Taal): string[] {
  const m: Record<Taal, string[]> = {
    nl: [
      "Wat is een driver?",
      "Waar haal ik mijn energie uit?",
      "Wat zijn mijn sterkste talenten?",
      "Hoe ga ik om met mijn drivers onder druk?",
      "Welke taak past deze week bij mij?",
    ],
    fr: [
      "Qu'est-ce qu'un driver ?",
      "D'où vient mon énergie ?",
      "Quels sont mes talents les plus forts ?",
      "Comment gérer mes drivers sous pression ?",
      "Quelle tâche cette semaine me convient ?",
    ],
    en: [
      "What is a driver?",
      "Where do I get my energy?",
      "What are my strongest talents?",
      "How do I deal with my drivers under pressure?",
      "Which task this week fits me?",
    ],
    es: [
      "¿Qué es un driver?",
      "¿De dónde saco mi energía?",
      "¿Cuáles son mis talentos más fuertes?",
      "¿Cómo manejo mis drivers bajo presión?",
      "¿Qué tarea de esta semana encaja conmigo?",
    ],
    ru: [
      "Что такое driver?",
      "Откуда я беру энергию?",
      "Какие мои сильнейшие таланты?",
      "Как справляться с drivers под давлением?",
      "Какая задача недели мне подходит?",
    ],
  };
  return m[taal] ?? m.nl;
}
