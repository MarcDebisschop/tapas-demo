// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Fase 1: dashboard-extractie
//
// Zet het bevroren generator-contract van een (voltooide) afname om naar een
// dashboard-vriendelijke voorstelling: persoonlijke quotes, een energie-
// momentopname, korte inzichtskaarten en reminders/mini-acties.
//
// PRINCIPE: nooit interne vaktermen tonen aan de deelnemer. ENIGE uitzondering
// is "Driver(s)" — een beschermde wetenschappelijke term (naar Taibi Kahler)
// die onvertaald blijft in alle talen. Talent-foci en talent-versnellers worden
// in publieke taal aangeboden.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import { filterTalentFoci } from "@shared/talent-constructs";

type ML = Record<Taal, string>;
const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;

// Publieke familienamen (geen interne termen; Driver beschermd & onvertaald).
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
  Drivers: { nl: "Drivers", fr: "Drivers", en: "Drivers", es: "Drivers", ru: "Drivers" },
};

// UI-labels voor de dashboard-secties (server levert deze mee zodat de client
// niets hardcodeert).
const T = {
  energieMomentopname: {
    nl: "Energie-momentopname",
    fr: "Instantané d'énergie",
    en: "Energy snapshot",
    es: "Instantánea de energía",
    ru: "Снимок энергии",
  } as ML,
  vragenlijstEnergie: {
    nl: "Energie tijdens de vragenlijst",
    fr: "Énergie pendant le questionnaire",
    en: "Energy during the questionnaire",
    es: "Energía durante el cuestionario",
    ru: "Энергия во время опросника",
  } as ML,
  eigenInschatting: {
    nl: "Eigen inschatting vooraf",
    fr: "Auto-évaluation préalable",
    en: "Your own estimate beforehand",
    es: "Tu propia estimación previa",
    ru: "Ваша собственная предварительная оценка",
  } as ML,
  beeldInHetKort: {
    nl: "Jouw beeld in het kort",
    fr: "Votre image en bref",
    en: "Your picture in brief",
    es: "Tu imagen en resumen",
    ru: "Ваш портрет вкратце",
  } as ML,
  remindersTitel: {
    nl: "Reminders & mini-acties",
    fr: "Rappels & mini-actions",
    en: "Reminders & mini-actions",
    es: "Recordatorios y mini-acciones",
    ru: "Напоминания и мини-действия",
  } as ML,
  // Inzichtskaart-koppen.
  kaartFocus: {
    nl: "Waar jouw energie naartoe stroomt",
    fr: "Là où votre énergie circule",
    en: "Where your energy flows",
    es: "Hacia dónde fluye tu energía",
    ru: "Куда направляется ваша энергия",
  } as ML,
  kaartDrivers: {
    nl: "Drivers om in het oog te houden",
    fr: "Drivers à surveiller",
    en: "Drivers to keep an eye on",
    es: "Drivers a vigilar",
    ru: "Drivers, за которыми стоит следить",
  } as ML,
  kaartConsistentie: {
    nl: "Hoe herkenbaar dit beeld is",
    fr: "À quel point cette image est reconnaissable",
    en: "How recognisable this picture is",
    es: "Qué tan reconocible es esta imagen",
    ru: "Насколько узнаваем этот портрет",
  } as ML,
};

// Korte, neutrale duiding bij drivers (naar Taibi Kahler) — onvertaald woord
// "Drivers", omringende zin in de doeltaal.
const DRIVERS_DUIDING: ML = {
  nl: 'De term "Drivers" verwijst naar onbewuste controlemechanismen (naar Taibi Kahler) die je gedrag onder druk sturen en de toegang tot je talenten kunnen bemoeilijken.',
  fr: 'Le terme « Drivers » désigne des mécanismes de contrôle inconscients (d\'après Taibi Kahler) qui orientent ton comportement sous pression et peuvent compliquer l\'accès à tes talents.',
  en: 'The term "Drivers" refers to unconscious control mechanisms (after Taibi Kahler) that steer your behaviour under pressure and can hinder access to your talents.',
  es: 'El término "Drivers" se refiere a mecanismos de control inconscientes (según Taibi Kahler) que dirigen tu comportamiento bajo presión y pueden dificultar el acceso a tus talentos.',
  ru: 'Термин «Drivers» обозначает бессознательные механизмы контроля (по Тайби Калеру), которые управляют поведением под давлением и могут затруднять доступ к талантам.',
};

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
  energySource?: string;
  mostItems?: unknown;
}

// Bouwt een leesbare quote rond een talentfocus.
function quoteVoorFocus(naam: string, taal: Taal): string {
  const m: ML = {
    nl: `Je komt het sterkst tot je recht waar ${naam} centraal staat.`,
    fr: `Tu t'épanouis le mieux là où ${naam} occupe une place centrale.`,
    en: `You come into your own most where ${naam} is central.`,
    es: `Donde más brillas es allí donde ${naam} es lo central.`,
    ru: `Вы раскрываетесь сильнее всего там, где ${naam} в центре.`,
  };
  return k(m, taal);
}

function energieLabel(n: number, taal: Taal): string {
  // n op /10
  let key: "hoog" | "gezond" | "matig" | "laag";
  if (n >= 7.5) key = "hoog";
  else if (n >= 6) key = "gezond";
  else if (n >= 4.5) key = "matig";
  else key = "laag";
  const m: Record<typeof key, ML> = {
    hoog: { nl: "hoog", fr: "élevée", en: "high", es: "alta", ru: "высокая" },
    gezond: { nl: "gezond", fr: "saine", en: "healthy", es: "saludable", ru: "здоровая" },
    matig: { nl: "matig", fr: "modérée", en: "moderate", es: "moderada", ru: "умеренная" },
    laag: { nl: "laag", fr: "basse", en: "low", es: "baja", ru: "низкая" },
  } as const;
  return k(m[key], taal);
}

export interface DashboardData {
  labels: {
    energieMomentopname: string;
    vragenlijstEnergie: string;
    eigenInschatting: string;
    beeldInHetKort: string;
    remindersTitel: string;
  };
  // Wisselende quotes voor de hero-header.
  quotes: string[];
  // Energie-momentopname (twee balken, op /10).
  energie: {
    vragenlijst: number; // normalizedQuestionnaireEnergy (0-10)
    baseline: number; // baselineProfessionalEnergy (0-10)
    label: string; // tekstlabel bij de vragenlijst-energie
  };
  // 2-3 inzichtskaarten.
  kaarten: Array<{ titel: string; tekst: string }>;
  // Reminders / mini-acties.
  reminders: string[];
  // Een gradient-hint (twee HSL-kleuren) afgeleid van de energie, voor de hero.
  gradient: { van: string; naar: string };
}

// Hoofdfunctie: contract (JSON-string of object) + taal -> DashboardData.
export function bouwDashboardData(contractRaw: unknown, taal: Taal): DashboardData | null {
  let contract: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      contract = JSON.parse(contractRaw);
    } catch {
      return null;
    }
  }
  if (!contract || !contract.sections || !contract.sections.main) return null;
  const main = contract.sections.main;
  const meta = main.meta ?? {};
  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];

  // Talentfoci met de hoogste netto-score. TaPas-Beeld is GEEN talent-focus en
  // wordt nooit meegenomen in de volgorde/lijst.
  const foci = filterTalentFoci(rows)
    .sort((a, b) => b.net - a.net)
    .slice(0, 3);
  const versnellers = rows
    .filter((r) => r.family === "Talent-versnellers")
    .sort((a, b) => b.net - a.net)
    .slice(0, 2);

  // Energie op /10.
  const vragenlijstEnergie = typeof meta.normalizedQuestionnaireEnergy === "number"
    ? Math.max(0, Math.min(10, meta.normalizedQuestionnaireEnergy))
    : 5;
  const baseline = typeof meta.baselineProfessionalEnergy === "number"
    ? Math.max(0, Math.min(10, meta.baselineProfessionalEnergy))
    : 5;

  // Quotes voor de hero.
  const quotes: string[] = [];
  if (foci[0]) quotes.push(quoteVoorFocus(k(FAMILIE_LABEL["Talent-foci"], taal) + ` (${foci[0].construct})`, taal));
  {
    const m: ML = {
      nl: `Je energie tijdens de vragenlijst was ${energieLabel(vragenlijstEnergie, taal)}.`,
      fr: `Ton énergie pendant le questionnaire était ${energieLabel(vragenlijstEnergie, taal)}.`,
      en: `Your energy during the questionnaire was ${energieLabel(vragenlijstEnergie, taal)}.`,
      es: `Tu energía durante el cuestionario fue ${energieLabel(vragenlijstEnergie, taal)}.`,
      ru: `Ваша энергия во время опросника была ${energieLabel(vragenlijstEnergie, taal)}.`,
    };
    quotes.push(k(m, taal));
  }
  if (versnellers[0]) {
    const m: ML = {
      nl: `${versnellers[0].construct} versterkt wat je al goed doet.`,
      fr: `${versnellers[0].construct} amplifie ce que tu fais déjà bien.`,
      en: `${versnellers[0].construct} amplifies what you already do well.`,
      es: `${versnellers[0].construct} amplifica lo que ya haces bien.`,
      ru: `${versnellers[0].construct} усиливает то, что вы уже хорошо делаете.`,
    };
    quotes.push(k(m, taal));
  }

  // Inzichtskaarten.
  const kaarten: Array<{ titel: string; tekst: string }> = [];
  if (foci.length) {
    const namen = foci.map((f) => f.construct).join(", ");
    const m: ML = {
      nl: `Je sterkste talentfoci op dit moment: ${namen}. Daar verloopt werk het meest moeiteloos.`,
      fr: `Tes focus de talent les plus forts : ${namen}. C'est là que le travail est le plus fluide.`,
      en: `Your strongest talent foci right now: ${namen}. That's where work feels most effortless.`,
      es: `Tus focos de talento más fuertes ahora: ${namen}. Ahí el trabajo fluye mejor.`,
      ru: `Ваши сильнейшие фокусы таланта сейчас: ${namen}. Здесь работа даётся легче всего.`,
    };
    kaarten.push({ titel: k(T.kaartFocus, taal), tekst: k(m, taal) });
  }
  {
    const dr = meta.driverRisk ?? {};
    const top = Array.isArray(dr.top) ? dr.top.map((d: ConstructRow) => d.construct) : [];
    const topTxt = top.length ? top.join(", ") : "—";
    const riskLabel: string = String(dr.label ?? "laag");
    const labelML: Record<string, ML> = {
      laag: { nl: "laag", fr: "faible", en: "low", es: "bajo", ru: "низкий" },
      matig: { nl: "matig", fr: "modéré", en: "moderate", es: "moderado", ru: "умеренный" },
      hoog: { nl: "hoog", fr: "élevé", en: "high", es: "alto", ru: "высокий" },
    };
    const labelTxt = k(labelML[riskLabel] ?? labelML.laag, taal);
    const m: ML = {
      nl: `${k(DRIVERS_DUIDING, taal)} Jouw driver-risico is nu ${labelTxt}. Drivers om op te letten: ${topTxt}.`,
      fr: `${k(DRIVERS_DUIDING, taal)} Ton risque lié aux drivers est actuellement ${labelTxt}. Drivers à surveiller : ${topTxt}.`,
      en: `${k(DRIVERS_DUIDING, taal)} Your driver risk is currently ${labelTxt}. Drivers to watch: ${topTxt}.`,
      es: `${k(DRIVERS_DUIDING, taal)} Tu riesgo de drivers es actualmente ${labelTxt}. Drivers a vigilar: ${topTxt}.`,
      ru: `${k(DRIVERS_DUIDING, taal)} Ваш driver-риск сейчас ${labelTxt}. Drivers, за которыми стоит следить: ${topTxt}.`,
    };
    kaarten.push({ titel: k(T.kaartDrivers, taal), tekst: k(m, taal) });
  }
  {
    const cons = meta.consistency ?? {};
    const score = typeof cons.score === "number" ? cons.score : null;
    const m: ML = {
      nl: score !== null
        ? `De interne herkenbaarheid van dit beeld scoort ${score}/100. Hoe hoger, hoe meer het profiel als een coherent geheel leest.`
        : `Dit beeld vormt een samenhangend geheel op basis van je antwoorden.`,
      fr: score !== null
        ? `La cohérence interne de cette image est de ${score}/100. Plus c'est élevé, plus le profil se lit comme un tout cohérent.`
        : `Cette image forme un ensemble cohérent basé sur tes réponses.`,
      en: score !== null
        ? `The internal recognisability of this picture scores ${score}/100. The higher, the more the profile reads as a coherent whole.`
        : `This picture forms a coherent whole based on your answers.`,
      es: score !== null
        ? `La coherencia interna de esta imagen es ${score}/100. Cuanto más alto, más se lee el perfil como un todo coherente.`
        : `Esta imagen forma un conjunto coherente según tus respuestas.`,
      ru: score !== null
        ? `Внутренняя узнаваемость этого портрета — ${score}/100. Чем выше, тем целостнее читается профиль.`
        : `Этот портрет образует целостную картину на основе ваших ответов.`,
    };
    kaarten.push({ titel: k(T.kaartConsistentie, taal), tekst: k(m, taal) });
  }

  // Reminders / mini-acties.
  const reminders: string[] = [];
  if (foci[0]) {
    const m: ML = {
      nl: `Plan deze week één taak die expliciet beroep doet op ${foci[0].construct}.`,
      fr: `Planifie cette semaine une tâche qui fait explicitement appel à ${foci[0].construct}.`,
      en: `Plan one task this week that explicitly draws on ${foci[0].construct}.`,
      es: `Planifica esta semana una tarea que use explícitamente ${foci[0].construct}.`,
      ru: `Запланируйте на этой неделе одну задачу, явно опирающуюся на ${foci[0].construct}.`,
    };
    reminders.push(k(m, taal));
  }
  {
    const m: ML = {
      nl: "Merk op wanneer je in een driver-reflex schiet — benoemen is de eerste stap om er ruimte van te maken.",
      fr: "Remarque quand tu bascules dans un réflexe-driver — le nommer est le premier pas pour t'en libérer.",
      en: "Notice when you slip into a driver reflex — naming it is the first step to creating space around it.",
      es: "Observa cuándo entras en un reflejo de driver — nombrarlo es el primer paso para darle espacio.",
      ru: "Замечайте, когда срабатывает driver-рефлекс — назвать его — первый шаг к свободе от него.",
    };
    reminders.push(k(m, taal));
  }
  {
    const m: ML = {
      nl: "Bekijk je volledige rapport opnieuw na een drukke week en let op wat verschoof.",
      fr: "Relis ton rapport complet après une semaine chargée et observe ce qui a changé.",
      en: "Revisit your full report after a busy week and notice what shifted.",
      es: "Revisa tu informe completo tras una semana intensa y observa qué cambió.",
      ru: "Перечитайте полный отчёт после напряжённой недели и заметьте, что изменилось.",
    };
    reminders.push(k(m, taal));
  }

  // Gradient afgeleid van de vragenlijst-energie (warm = hoog, koel = laag).
  const h = Math.round(170 + (vragenlijstEnergie / 10) * 60); // 170 (teal) -> 230 (indigo)
  const gradient = {
    van: `${h} 70% 52%`,
    naar: `${(h + 35) % 360} 65% 42%`,
  };

  return {
    labels: {
      energieMomentopname: k(T.energieMomentopname, taal),
      vragenlijstEnergie: k(T.vragenlijstEnergie, taal),
      eigenInschatting: k(T.eigenInschatting, taal),
      beeldInHetKort: k(T.beeldInHetKort, taal),
      remindersTitel: k(T.remindersTitel, taal),
    },
    quotes,
    energie: {
      vragenlijst: Math.round(vragenlijstEnergie * 10) / 10,
      baseline: Math.round(baseline * 10) / 10,
      label: energieLabel(vragenlijstEnergie, taal),
    },
    kaarten,
    reminders,
    gradient,
  };
}
