// ---------------------------------------------------------------------------
// T4Recruitment — Fase 3: chatcontext + zorg-kompas-signalen (recruiter-only).
//
// Bouwt uit de berekende vergelijkende studie (MatchUitkomst) (1) een
// recruiter-vriendelijke leescontext zonder interne vaktermen, en (2) de
// zorg-kompas laag A: DATASIGNALEN (niet welzijn). Datasignalen maken de
// assistent extra voorzichtig en nuancerend bij het LEZEN van de studie —
// nooit een aanwervings-, geschiktheids- of rangschikkingsuitspraak.
//
// PRINCIPE (vaste instrumentregel T4Recruitment): de assistent is een
// LEESHULP bij het eindrapport. Het instrument is richtinggevend; het besluit
// blijft bij de stakeholders. "Driver" (naar Taibi Kahler) blijft onvertaald.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import {
  EINDOORDEEL_LABEL,
  VERVULLING_LABEL,
  ENERGIE_LABEL,
  type MatchUitkomst,
} from "./match";
import type { Session } from "./schema";

type ML = Record<Taal, string>;
const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;

// --- Coach/facilitator-doorverwijskaart (recruiter-context) ----------------
// Geen welzijnscoach maar een procesbegeleider/recruitmentexpert: het juiste
// register voor wie een beslis- of selectievraag stelt die buiten de
// leeshulp valt.
export interface CoachKaart {
  naam: string;
  rol: string;
  bericht: string;
}

const COACH_REGISTER: { rol: ML; bericht: ML } = {
  rol: {
    nl: "Procesbegeleider / recruitmentexpert",
    fr: "Facilitateur / expert en recrutement",
    en: "Process facilitator / recruitment expert",
    es: "Facilitador / experto en selección",
    ru: "Фасилитатор / эксперт по подбору",
  },
  bericht: {
    nl: "Een beslissing over aanwerving of rangschikking hoort thuis bij de stakeholders, samen met een procesbegeleider. Een leeshulp kan de studie verhelderen, maar neemt die afweging niet over.",
    fr: "Une décision d'embauche ou de classement appartient aux parties prenantes, avec un facilitateur. Une aide à la lecture peut clarifier l'étude, mais ne prend pas cette décision.",
    en: "A hiring or ranking decision belongs with the stakeholders, together with a process facilitator. A reading aid can clarify the study, but does not take that call.",
    es: "Una decisión de contratación o clasificación corresponde a las partes interesadas, junto con un facilitador. Una ayuda de lectura puede aclarar el estudio, pero no toma esa decisión.",
    ru: "Решение о найме или ранжировании принимают заинтересованные стороны вместе с фасилитатором. Помощник по чтению может прояснить исследование, но не принимает это решение.",
  },
};

export function coachKaartRecruiter(taal: Taal): CoachKaart {
  return {
    naam: k(
      {
        nl: "De stakeholders en hun procesbegeleider",
        fr: "Les parties prenantes et leur facilitateur",
        en: "The stakeholders and their facilitator",
        es: "Las partes interesadas y su facilitador",
        ru: "Заинтересованные стороны и их фасилитатор",
      },
      taal,
    ),
    rol: k(COACH_REGISTER.rol, taal),
    bericht: k(COACH_REGISTER.bericht, taal),
  };
}

// --- Context + risicosignalen ----------------------------------------------
export interface ChatContextResultaat {
  // Recruiter-vriendelijke samenvatting van de studie voor de systeemprompt.
  context: string;
  // Zorg-kompas laag A — DATASIGNALEN (niet welzijn).
  risico: {
    niveau: "geen" | "verhoogd" | "hoog";
    redenen: string[];
  };
}

interface CandidateInfo {
  label: string;
  decision: string | null;
  decisionReason: string | null;
}

// Bouwt de recruiter-leescontext + de datasignalen uit de berekende studie.
export function bouwChatContext(
  uitkomst: MatchUitkomst | null,
  session: Session | null,
  candidate: CandidateInfo | null,
  taal: Taal,
): ChatContextResultaat {
  if (!uitkomst) {
    const geen: ML = {
      nl: "Er is nog geen berekende vergelijkende studie beschikbaar. Help de recruiter op een algemene manier en nodig uit om eerst de studie af te ronden (rolprofiel sluiten en een geverifieerd kandidaatrapport opladen).",
      fr: "Aucune étude comparative calculée n'est encore disponible. Aide le recruteur de façon générale et invite-le à finaliser d'abord l'étude (clôturer le profil de rôle et téléverser un rapport candidat vérifié).",
      en: "No calculated comparative study is available yet. Help the recruiter in a general way and invite them to complete the study first (close the role profile and upload a verified candidate report).",
      es: "Aún no hay un estudio comparativo calculado. Ayuda al reclutador de forma general e invítale a completar primero el estudio (cerrar el perfil del rol y subir un informe de candidato verificado).",
      ru: "Рассчитанного сравнительного исследования пока нет. Помогите рекрутёру в общем виде и предложите сначала завершить исследование (закрыть профиль роли и загрузить проверенный отчёт кандидата).",
    };
    return { context: k(geen, taal), risico: { niveau: "geen", redenen: [] } };
  }

  const u = uitkomst;
  const needs = u.constructen.filter((c) => c.classificatie === "need");

  // Per-need-lijn in recruiter-taal (label · gevraagd/gemeten/energie · oordeel · toelichting).
  const oordeelLabel: Record<string, ML> = {
    match: { nl: "match", fr: "correspondance", en: "match", es: "coincidencia", ru: "совпадение" },
    aandacht: { nl: "aandacht", fr: "attention", en: "attention", es: "atención", ru: "внимание" },
    mismatch: { nl: "mismatch", fr: "non-correspondance", en: "mismatch", es: "no coincidencia", ru: "несоответствие" },
    plus: { nl: "meerwaarde", fr: "valeur ajoutée", en: "added value", es: "valor añadido", ru: "доп. ценность" },
    neutraal: { nl: "neutraal", fr: "neutre", en: "neutral", es: "neutral", ru: "нейтрально" },
    signaal: { nl: "signaal", fr: "signal", en: "signal", es: "señal", ru: "сигнал" },
  };

  const lijnTekst = (c: typeof u.constructen[number]): string => {
    const krit = c.kritisch
      ? k({ nl: " [kritisch succescriterium]", fr: " [critère de réussite critique]", en: " [critical success criterion]", es: " [criterio crítico]", ru: " [критический критерий]" }, taal)
      : "";
    return `- ${c.construct.label}${krit}: ${VERVULLING_LABEL[c.niveau]} (net ${c.net >= 0 ? "+" : ""}${c.net}), ${ENERGIE_LABEL[c.energie].toLowerCase()} — ${k(oordeelLabel[c.oordeel] ?? oordeelLabel.neutraal, taal)}. ${c.toelichting}`;
  };

  const needLijnen = needs.map(lijnTekst).join("\n");
  const vlagLijnen = u.risicovlaggen.length
    ? u.risicovlaggen.map((v) => `- ${v.label}: ${v.toelichting}`).join("\n")
    : k({ nl: "geen actieve risicovlaggen", fr: "aucun drapeau de risque actif", en: "no active risk flags", es: "sin banderas de riesgo activas", ru: "нет активных флагов риска" }, taal);

  const koppen: ML = {
    nl: `Vergelijkende studie voor de rol "${session?.functionTitle ?? "—"}" (${session?.orgLabel ?? "—"}, ${session?.roleType ?? "—"}/${session?.roleLevel ?? "—"}), kandidaat "${candidate?.label ?? "—"}".\n\nEindoordeel: ${EINDOORDEEL_LABEL[u.eindoordeel]}. Motivatie: ${u.motivatie}\nNeed-lijnen: ${u.needTotaal} totaal — ${u.needMatch} match, ${u.needAandacht} aandacht, ${u.needMismatch} mismatch. Kritische succescriteria: ${u.kritischTotaal}. Energiewaakpunten (sterk/voldoende maar energie-kostend): ${u.energiewaakpunten}.\n\nNeed-lijnen in detail:\n${needLijnen}\n\nRisicovlaggen:\n${vlagLijnen}`,
    fr: `Étude comparative pour le poste « ${session?.functionTitle ?? "—"} » (${session?.orgLabel ?? "—"}, ${session?.roleType ?? "—"}/${session?.roleLevel ?? "—"}), candidat « ${candidate?.label ?? "—"} ».\n\nVerdict final : ${EINDOORDEEL_LABEL[u.eindoordeel]}. Motivation : ${u.motivatie}\nLignes need : ${u.needTotaal} au total — ${u.needMatch} correspondance, ${u.needAandacht} attention, ${u.needMismatch} non-correspondance. Critères critiques : ${u.kritischTotaal}. Points d'attention énergie : ${u.energiewaakpunten}.\n\nLignes need en détail :\n${needLijnen}\n\nDrapeaux de risque :\n${vlagLijnen}`,
    en: `Comparative study for the role "${session?.functionTitle ?? "—"}" (${session?.orgLabel ?? "—"}, ${session?.roleType ?? "—"}/${session?.roleLevel ?? "—"}), candidate "${candidate?.label ?? "—"}".\n\nFinal verdict: ${EINDOORDEEL_LABEL[u.eindoordeel]}. Motivation: ${u.motivatie}\nNeed lines: ${u.needTotaal} total — ${u.needMatch} match, ${u.needAandacht} attention, ${u.needMismatch} mismatch. Critical success criteria: ${u.kritischTotaal}. Energy watch points: ${u.energiewaakpunten}.\n\nNeed lines in detail:\n${needLijnen}\n\nRisk flags:\n${vlagLijnen}`,
    es: `Estudio comparativo para el puesto "${session?.functionTitle ?? "—"}" (${session?.orgLabel ?? "—"}, ${session?.roleType ?? "—"}/${session?.roleLevel ?? "—"}), candidato "${candidate?.label ?? "—"}".\n\nVeredicto final: ${EINDOORDEEL_LABEL[u.eindoordeel]}. Motivación: ${u.motivatie}\nLíneas need: ${u.needTotaal} en total — ${u.needMatch} coincidencia, ${u.needAandacht} atención, ${u.needMismatch} no coincidencia. Criterios críticos: ${u.kritischTotaal}. Puntos de atención de energía: ${u.energiewaakpunten}.\n\nLíneas need en detalle:\n${needLijnen}\n\nBanderas de riesgo:\n${vlagLijnen}`,
    ru: `Сравнительное исследование для роли «${session?.functionTitle ?? "—"}» (${session?.orgLabel ?? "—"}, ${session?.roleType ?? "—"}/${session?.roleLevel ?? "—"}), кандидат «${candidate?.label ?? "—"}».\n\nИтоговый вывод: ${EINDOORDEEL_LABEL[u.eindoordeel]}. Обоснование: ${u.motivatie}\nЛинии need: всего ${u.needTotaal} — ${u.needMatch} совпадение, ${u.needAandacht} внимание, ${u.needMismatch} несоответствие. Критические критерии: ${u.kritischTotaal}. Точки внимания по энергии: ${u.energiewaakpunten}.\n\nЛинии need подробно:\n${needLijnen}\n\nФлаги риска:\n${vlagLijnen}`,
  };

  // --- Zorg-kompas laag A: DATASIGNALEN (niet welzijn) ---
  const redenen: string[] = [];
  let score = 0;

  if (u.eindoordeel === "mismatch") {
    redenen.push(
      k({ nl: "De studie eindigt op een mismatch", fr: "L'étude se termine sur une non-correspondance", en: "The study ends on a mismatch", es: "El estudio termina en una no coincidencia", ru: "Исследование завершается несоответствием" }, taal),
    );
    score += 2;
  } else if (u.eindoordeel === "aandacht") {
    redenen.push(
      k({ nl: "De studie eindigt op aandacht (waakpunten)", fr: "L'étude se termine sur « attention » (points de vigilance)", en: "The study ends on attention (watch points)", es: "El estudio termina en atención (puntos de vigilancia)", ru: "Исследование завершается «вниманием» (точки наблюдения)" }, taal),
    );
    score += 1;
  }
  if (u.needMismatch > 0) {
    redenen.push(
      k({ nl: "Eén of meer gevraagde lijnen zijn een inhoudelijke mismatch", fr: "Une ou plusieurs lignes demandées sont une non-correspondance de fond", en: "One or more required lines are a substantive mismatch", es: "Una o más líneas requeridas son una no coincidencia sustantiva", ru: "Одна или несколько требуемых линий — содержательное несоответствие" }, taal),
    );
    score += 1;
  }
  if (u.risicovlaggen.length >= 3) {
    redenen.push(
      k({ nl: "Structureel risico: drie of meer risicovlaggen vallen samen", fr: "Risque structurel : trois drapeaux de risque ou plus coïncident", en: "Structural risk: three or more risk flags coincide", es: "Riesgo estructural: tres o más banderas de riesgo coinciden", ru: "Структурный риск: совпадают три или более флагов риска" }, taal),
    );
    score += 2;
  } else if (u.risicovlaggen.length >= 1) {
    redenen.push(
      k({ nl: "Eén of meer actieve risicovlaggen", fr: "Un ou plusieurs drapeaux de risque actifs", en: "One or more active risk flags", es: "Una o más banderas de riesgo activas", ru: "Один или несколько активных флагов риска" }, taal),
    );
    score += 1;
  }
  if (u.motivatieVerplicht) {
    redenen.push(
      k({ nl: "Een verplichte motivering is vereist op een kritisch punt", fr: "Une motivation obligatoire est requise sur un point critique", en: "A mandatory justification is required on a critical point", es: "Se requiere una justificación obligatoria en un punto crítico", ru: "Требуется обязательное обоснование по критическому пункту" }, taal),
    );
    score += 1;
  }
  // Lage beoordeelbaarheid = datakwaliteitssignaal (weinig need-lijnen meetbaar).
  if (u.needTotaal === 0) {
    redenen.push(
      k({ nl: "Geen meetbare need-lijnen: de studie is dun onderbouwd", fr: "Aucune ligne need mesurable : l'étude est peu étayée", en: "No measurable need lines: the study is thinly substantiated", es: "Sin líneas need medibles: el estudio está poco fundamentado", ru: "Нет измеримых линий need: исследование слабо обосновано" }, taal),
    );
    score += 1;
  }

  const niveau: "geen" | "verhoogd" | "hoog" = score >= 3 ? "hoog" : score >= 1 ? "verhoogd" : "geen";

  return { context: k(koppen, taal).trim(), risico: { niveau, redenen } };
}

// Suggestie-startvragen voor het recruiter-chatpaneel (per taal). Bewust
// leeshulp-gericht — geen "moet ik aanwerven?"-vragen.
export function chatSuggestiesRecruiter(taal: Taal): string[] {
  const m: Record<Taal, string[]> = {
    nl: [
      "Welke need-lijnen vragen het meest aandacht en waarom?",
      "Wat betekenen de energiewaakpunten voor de duurzaamheid van de rol?",
      "Hoe lees ik de risicovlaggen in deze studie?",
    ],
    fr: [
      "Quelles lignes need demandent le plus d'attention et pourquoi ?",
      "Que signifient les points d'attention énergie pour la durabilité du rôle ?",
      "Comment lire les drapeaux de risque de cette étude ?",
    ],
    en: [
      "Which need lines call for the most attention and why?",
      "What do the energy watch points mean for the durability of the role?",
      "How should I read the risk flags in this study?",
    ],
    es: [
      "¿Qué líneas need requieren más atención y por qué?",
      "¿Qué significan los puntos de atención de energía para la durabilidad del rol?",
      "¿Cómo leo las banderas de riesgo de este estudio?",
    ],
    ru: [
      "Какие линии need требуют наибольшего внимания и почему?",
      "Что означают точки внимания по энергии для устойчивости роли?",
      "Как читать флаги риска в этом исследовании?",
    ],
  };
  return m[taal] ?? m.nl;
}
