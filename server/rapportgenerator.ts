// ---------------------------------------------------------------------------
// TaPas Platform — Fase C3 + E: meertalige rapportgenerator
//
// Vertaalt het bevroren generator-contract (v1.0.0) van een voltooide afname
// naar een afgewerkt TaPas-rapport, in de TAAL van de afname (contract.taal).
// Twee varianten:
//   - 'kompas'     : het TaPas Kompas (energetisch gedragsprofiel + drivers)
//   - 'coachatlas' : de TaPas Coachatlas (uitgebreid, met coachingsfocus)
//
// Het rapport wordt zowel als gestructureerde secties (JSON) als als
// gerenderde HTML opgeleverd. Er worden GEEN interne termen of diagnose-/
// selectieclaims getoond — enkel professioneel taalgebruik over energie en
// gedrag in een werkcontext.
//
// Fase E: alle koppen, paragrafen, duiding, tabelkolommen en de disclaimer
// bestaan in 5 talen (NL bron; FR/EN/ES/RU als conceptvertaling). De
// connection-labels worden uit het meertalige instrument gehaald.
// ---------------------------------------------------------------------------

import { instrument, kies } from "./instrument";
import { TALEN, STANDAARD_TAAL, type Taal } from "../shared/talen";
import { isTapasBeeld } from "../shared/talent-constructs";

export interface RapportSectie {
  kop: string;
  paragrafen: string[];
  tabel?: { kolommen: string[]; rijen: (string | number)[][] };
}

export interface RapportInhoud {
  variant: "kompas" | "coachatlas";
  taal: Taal;
  titel: string;
  ondertitel: string;
  respondent: { naam: string; code: string; organisatie: string | null; functie: string | null };
  gegenereerdOp: string;
  secties: RapportSectie[];
  disclaimer: string;
}

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

function normTaal(x: unknown): Taal {
  return (TALEN as readonly string[]).includes(String(x)) ? (x as Taal) : STANDAARD_TAAL;
}

// ---------------------------------------------------------------------------
// Vertaaltabel voor het rapport (Laag 3).
// ---------------------------------------------------------------------------
type ML = Record<Taal, string>;
const m = (nl: string, fr: string, en: string, es: string, ru: string): ML => ({ nl, fr, en, es, ru });
function k(v: ML, taal: Taal): string {
  return v[taal] ?? v[STANDAARD_TAAL];
}

// Energielabel-duiding op basis van het genormaliseerde niveau.
const ENERGIE_NIVEAU: Record<"hoog" | "stevig" | "wisselend" | "kwetsbaar", ML> = {
  hoog: m("hoog", "élevé", "high", "alto", "высокий"),
  stevig: m("stevig", "solide", "solid", "sólido", "устойчивый"),
  wisselend: m("wisselend", "variable", "variable", "variable", "переменный"),
  kwetsbaar: m("kwetsbaar", "fragile", "fragile", "frágil", "уязвимый"),
};
function energieNiveauKey(g: number): keyof typeof ENERGIE_NIVEAU {
  if (g >= 7.5) return "hoog";
  if (g >= 5) return "stevig";
  if (g >= 3) return "wisselend";
  return "kwetsbaar";
}

// Niveau-labels (laag/matig/middelmatig/hoog) zoals het bevroren contract ze
// opslaat in het Nederlands. Bij het renderen vertalen we ze naar de afnametaal.
const NIVEAU_LABEL: Record<string, ML> = {
  laag: m("laag", "faible", "low", "bajo", "низкий"),
  matig: m("matig", "modéré", "moderate", "moderado", "умеренный"),
  middelmatig: m("middelmatig", "moyen", "medium", "medio", "средний"),
  hoog: m("hoog", "élevé", "high", "alto", "высокий"),
};
function niveauLabel(intern: unknown, taal: Taal): string {
  const key = String(intern ?? "").trim().toLowerCase();
  const v = NIVEAU_LABEL[key];
  return v ? k(v, taal) : String(intern ?? "—");
}

// Publieke familienamen per taal (interne termen verschijnen NOOIT).
const FAMILIE_PUBLIEK: Record<string, ML> = {
  // 'Driver(s)' = beschermde vakterm (Taibi Kahler). Onvertaald in alle talen.
  Drivers: m("Drivers", "Drivers", "Drivers", "Drivers", "Drivers"),
  "Talent-foci": m("Werkgedrag", "Comportement au travail", "Work behavior", "Comportamiento laboral", "Рабочее поведение"),
  "Talent-versnellers": m("Versterkend gedrag", "Comportement renforçant", "Reinforcing behavior", "Comportamiento reforzador", "Усиливающее поведение"),
};
function publiekeFamilie(intern: unknown, taal: Taal): string {
  const key = String(intern ?? "").trim();
  const v = FAMILIE_PUBLIEK[key] ?? FAMILIE_PUBLIEK["Talent-foci"];
  return k(v, taal);
}

const T = {
  ondertitel_kompas: m(
    "Energetisch gedragsprofiel in professionele context",
    "Profil comportemental énergétique en contexte professionnel",
    "Energetic behavioral profile in a professional context",
    "Perfil conductual energético en contexto profesional",
    "Энергетический поведенческий профиль в профессиональном контексте"
  ),
  ondertitel_atlas: m(
    "Energetisch gedragsprofiel met coachingsfocus",
    "Profil comportemental énergétique avec focus coaching",
    "Energetic behavioral profile with a coaching focus",
    "Perfil conductual energético con enfoque de coaching",
    "Энергетический поведенческий профиль с фокусом на коучинг"
  ),
  // Sectie 1 — energiebeeld
  kop_energie: m(
    "Energiebeeld in professionele context",
    "Aperçu énergétique en contexte professionnel",
    "Energy profile in a professional context",
    "Panorama energético en contexto profesional",
    "Картина энергии в профессиональном контексте"
  ),
  energie_p1: m(
    "Op een schaal van 0 tot 10 komt het energiebeeld uit de vragenlijst uit op {g}. Dat wordt geduid als een {niveau} energieniveau in de professionele context.",
    "Sur une échelle de 0 à 10, l'énergie issue du questionnaire atteint {g}. Cela correspond à un niveau d'énergie {niveau} dans le contexte professionnel.",
    "On a scale of 0 to 10, the energy from the questionnaire comes out at {g}. This is interpreted as a {niveau} energy level in the professional context.",
    "En una escala de 0 a 10, la energía del cuestionario alcanza {g}. Se interpreta como un nivel de energía {niveau} en el contexto profesional.",
    "По шкале от 0 до 10 энергия по результатам опросника составляет {g}. Это интерпретируется как {niveau} уровень энергии в профессиональном контексте."
  ),
  energie_p2: m(
    "De zelfingeschatte baseline-energie bedroeg {b} op 10. {verschil}",
    "L'énergie de référence auto-évaluée était de {b} sur 10. {verschil}",
    "The self-rated baseline energy was {b} out of 10. {verschil}",
    "La energía de referencia autoevaluada fue de {b} sobre 10. {verschil}",
    "Самооценённый базовый уровень энергии составил {b} из 10. {verschil}"
  ),
  energie_p3: m(
    "Dit profiel beschrijft hoe energie zich verdeelt over verschillende soorten werkgedrag. Het is een momentopname en geen vaststaand of diagnostisch gegeven.",
    "Ce profil décrit la répartition de l'énergie entre différents types de comportement au travail. Il s'agit d'un instantané, et non d'une donnée figée ou diagnostique.",
    "This profile describes how energy is distributed across different types of work behavior. It is a snapshot, not a fixed or diagnostic fact.",
    "Este perfil describe cómo se distribuye la energía entre distintos tipos de comportamiento laboral. Es una instantánea, no un dato fijo ni diagnóstico.",
    "Этот профиль описывает, как энергия распределяется по разным видам рабочего поведения. Это моментальный снимок, а не фиксированный или диагностический показатель."
  ),
  verschil_dichtbij: m(
    "De zelfingeschatte baseline en het beeld uit de vragenlijst liggen dicht bij elkaar. Dat wijst op een herkenbaar, consistent energiebeeld.",
    "L'énergie de référence auto-évaluée et l'image issue du questionnaire sont proches. Cela indique une image énergétique reconnaissable et cohérente.",
    "The self-rated baseline and the picture from the questionnaire are close together. This points to a recognizable, consistent energy picture.",
    "La referencia autoevaluada y la imagen del cuestionario están próximas. Esto indica una imagen energética reconocible y coherente.",
    "Самооценённый базовый уровень и картина по опроснику близки. Это указывает на узнаваемую, согласованную картину энергии."
  ),
  verschil_hoger: m(
    "De zelfingeschatte baseline ligt hoger dan het beeld uit de vragenlijst. Mogelijk wordt de eigen energie in de dagelijkse context iets optimistischer ingeschat dan de keuzes laten zien.",
    "L'énergie de référence auto-évaluée est plus élevée que l'image issue du questionnaire. L'énergie au quotidien est peut-être évaluée de manière un peu plus optimiste que ne le montrent les choix.",
    "The self-rated baseline is higher than the picture from the questionnaire. Day-to-day energy may be rated somewhat more optimistically than the choices show.",
    "La referencia autoevaluada es más alta que la imagen del cuestionario. Es posible que la energía cotidiana se valore de forma algo más optimista de lo que muestran las elecciones.",
    "Самооценённый базовый уровень выше, чем картина по опроснику. Возможно, повседневная энергия оценивается несколько оптимистичнее, чем показывают ответы."
  ),
  verschil_lager: m(
    "Het beeld uit de vragenlijst ligt hoger dan de zelfingeschatte baseline. De gemaakte keuzes tonen meer energie dan op het eerste gezicht werd ingeschat.",
    "L'image issue du questionnaire est plus élevée que l'énergie de référence auto-évaluée. Les choix effectués montrent plus d'énergie qu'estimé à première vue.",
    "The picture from the questionnaire is higher than the self-rated baseline. The choices made show more energy than was estimated at first glance.",
    "La imagen del cuestionario es más alta que la referencia autoevaluada. Las elecciones realizadas muestran más energía de la estimada a primera vista.",
    "Картина по опроснику выше, чем самооценённый базовый уровень. Сделанный выбор показывает больше энергии, чем казалось на первый взгляд."
  ),
  ind_energie_vl: m("Energie uit vragenlijst (0-10)", "Énergie du questionnaire (0-10)", "Energy from questionnaire (0-10)", "Energía del cuestionario (0-10)", "Энергия по опроснику (0-10)"),
  ind_baseline: m("Zelfingeschatte baseline (0-10)", "Référence auto-évaluée (0-10)", "Self-rated baseline (0-10)", "Referencia autoevaluada (0-10)", "Самооценённый базовый уровень (0-10)"),
  ind_verschil: m("Verschil", "Écart", "Difference", "Diferencia", "Разница"),
  ind_betrouwbaar: m("Energie-betrouwbaarheid", "Fiabilité énergétique", "Energy reliability", "Fiabilidad energética", "Надёжность энергии"),
  col_indicator: m("Indicator", "Indicateur", "Indicator", "Indicador", "Показатель"),
  col_waarde: m("Waarde", "Valeur", "Value", "Valor", "Значение"),
  // Sectie 2 — talentfoci
  kop_focus: m(
    "Waar de energie naartoe stroomt",
    "Où l'énergie se dirige",
    "Where the energy flows",
    "Hacia dónde fluye la energía",
    "Куда направляется энергия"
  ),
  focus_aanwezig: m(
    "De keuzes wijzen op een duidelijke voorkeur voor een aantal gedragsfoci. Deze gebieden trekken de meeste energie aan en voelen het meest natuurlijk aan.",
    "Les choix révèlent une préférence claire pour certains domaines comportementaux. Ces domaines attirent le plus d'énergie et semblent les plus naturels.",
    "The choices indicate a clear preference for several behavioral foci. These areas attract the most energy and feel the most natural.",
    "Las elecciones indican una preferencia clara por varios focos conductuales. Estas áreas atraen la mayor energía y resultan las más naturales.",
    "Ответы указывают на чёткое предпочтение нескольких поведенческих фокусов. Эти области притягивают больше всего энергии и ощущаются наиболее естественными."
  ),
  focus_afwezig: m(
    "Er kwam geen uitgesproken voorkeursprofiel naar voren; de energie is relatief evenwichtig verdeeld.",
    "Aucun profil de préférence marqué n'est ressorti ; l'énergie est répartie de manière relativement équilibrée.",
    "No pronounced preference profile emerged; the energy is relatively evenly distributed.",
    "No surgió un perfil de preferencia marcado; la energía se distribuye de forma relativamente equilibrada.",
    "Выраженного профиля предпочтений не выявлено; энергия распределена относительно равномерно."
  ),
  col_focus: m("Focus", "Domaine", "Focus", "Foco", "Фокус"),
  col_domein: m("Gedragsdomein", "Domaine comportemental", "Behavioral domain", "Dominio conductual", "Поведенческая область"),
  col_netto: m("Netto-voorkeur", "Préférence nette", "Net preference", "Preferencia neta", "Чистое предпочтение"),
  col_energie: m("Energie", "Énergie", "Energy", "Energía", "Энергия"),
  // Sectie 3 — drivers
  kop_drivers: m("Drivers", "Drivers", "Drivers", "Drivers", "Drivers"),
  // Eenmalige neutrale duiding bij de eerste vermelding (naar Taibi Kahler).
  // 'Drivers' blijft onvertaald; de duiding eromheen is wel vertaald.
  drivers_duiding: m(
    "De term Drivers verwijst naar onbewuste controlemechanismen (naar Taibi Kahler) die gedrag triggeren en de toegang tot talenten kunnen bemoeilijken. Het is een vakterm en wordt niet vertaald.",
    "Le terme Drivers désigne des mécanismes de contrôle inconscients (d'après Taibi Kahler) qui déclenchent des comportements et peuvent entraver l'accès aux talents. C'est un terme technique qui n'est pas traduit.",
    "The term Drivers refers to unconscious control mechanisms (after Taibi Kahler) that trigger behavior and can hinder access to talents. It is a technical term and is not translated.",
    "El término Drivers se refiere a mecanismos de control inconscientes (según Taibi Kahler) que desencadenan conductas y pueden dificultar el acceso a los talentos. Es un término técnico y no se traduce.",
    "Термин Drivers обозначает неосознаваемые механизмы контроля (по Таиби Калеру), которые запускают поведение и могут затруднять доступ к талантам. Это технический термин, который не переводится."
  ),
  drivers_aanwezig: m(
    "De sterkst aanwezige drivers geven aan welke mechanismen het werkgedrag aansturen: {lijst}.",
    "Les drivers les plus présents indiquent quels mécanismes orientent le comportement au travail : {lijst}.",
    "The most strongly present drivers indicate which mechanisms steer the work behavior: {lijst}.",
    "Los drivers más presentes indican qué mecanismos guían el comportamiento laboral: {lijst}.",
    "Наиболее выраженные drivers показывают, какие механизмы направляют рабочее поведение: {lijst}."
  ),
  drivers_afwezig: m(
    "Er kwamen geen sterk uitgesproken drivers naar voren.",
    "Aucun driver fortement marqué n'est ressorti.",
    "No strongly pronounced drivers emerged.",
    "No surgieron drivers marcadamente pronunciados.",
    "Сильно выраженных drivers не выявлено."
  ),
  drivers_risico: m(
    "Het driver-risico wordt ingeschat als {label} (gemiddelde energie van de top-drivers: {avg}). Een lager energieniveau bij dominante drivers kan wijzen op gebieden die meer aandacht of herstel vragen.",
    "Le risque lié aux drivers est estimé comme {label} (énergie moyenne des drivers principaux : {avg}). Un niveau d'énergie plus faible sur des drivers dominants peut indiquer des domaines nécessitant plus d'attention ou de récupération.",
    "The driver risk is estimated as {label} (average energy of the top drivers: {avg}). A lower energy level for dominant drivers may indicate areas that require more attention or recovery.",
    "El riesgo de los drivers se estima como {label} (energía media de los drivers principales: {avg}). Un nivel de energía más bajo en drivers dominantes puede indicar áreas que requieren más atención o recuperación.",
    "Риск по drivers оценивается как {label} (средняя энергия ведущих drivers: {avg}). Более низкий уровень энергии у доминирующих drivers может указывать на области, требующие большего внимания или восстановления."
  ),
  col_drijfveer: m("Driver", "Driver", "Driver", "Driver", "Driver"),
  // Sectie 4 — verbondenheid
  kop_verbondenheid: m(
    "Verbondenheid met de organisatie",
    "Lien avec l'organisation",
    "Connection with the organization",
    "Vinculación con la organización",
    "Привязанность к организации"
  ),
  verbondenheid_p: m(
    "De ervaren verbondenheid met de organisatie geeft context bij het energiebeeld. Lage scores op deze dimensies kunnen energie afremmen, ook wanneer de sterkste focusgebieden duidelijk aanwezig zijn.",
    "Le lien ressenti avec l'organisation contextualise l'image énergétique. De faibles scores sur ces dimensions peuvent freiner l'énergie, même lorsque les principaux domaines de focus sont clairement présents.",
    "The perceived connection with the organization provides context for the energy picture. Low scores on these dimensions can dampen energy, even when the strongest focus areas are clearly present.",
    "La vinculación percibida con la organización aporta contexto a la imagen energética. Puntuaciones bajas en estas dimensiones pueden frenar la energía, incluso cuando las áreas de foco más fuertes están claramente presentes.",
    "Воспринимаемая привязанность к организации задаёт контекст для картины энергии. Низкие баллы по этим параметрам могут снижать энергию, даже когда самые сильные области фокуса ясно выражены."
  ),
  col_dimensie: m("Dimensie", "Dimension", "Dimension", "Dimensión", "Параметр"),
  col_score: m("Score (0-10)", "Score (0-10)", "Score (0-10)", "Puntuación (0-10)", "Балл (0-10)"),
  // Sectie 5 — coachatlas
  kop_aandacht: m(
    "Aandachtspunten en herstel",
    "Points d'attention et récupération",
    "Points of attention and recovery",
    "Puntos de atención y recuperación",
    "Точки внимания и восстановление"
  ),
  aandacht_aanwezig: m(
    "Bij de volgende gebieden lijkt de energie lager te liggen: {lijst}. Dit zijn geen tekortkomingen, maar plaatsen waar bewust energiebeheer het verschil maakt.",
    "Dans les domaines suivants, l'énergie semble plus faible : {lijst}. Ce ne sont pas des lacunes, mais des points où une gestion consciente de l'énergie fait la différence.",
    "Energy appears to be lower in the following areas: {lijst}. These are not shortcomings, but places where conscious energy management makes the difference.",
    "La energía parece ser más baja en las siguientes áreas: {lijst}. No son carencias, sino lugares donde una gestión consciente de la energía marca la diferencia.",
    "В следующих областях энергия, по-видимому, ниже: {lijst}. Это не недостатки, а места, где осознанное управление энергией имеет значение."
  ),
  aandacht_afwezig: m(
    "Er kwamen geen specifieke energetische aandachtspunten naar voren.",
    "Aucun point d'attention énergétique spécifique n'est ressorti.",
    "No specific energetic points of attention emerged.",
    "No surgieron puntos de atención energéticos específicos.",
    "Конкретных энергетических точек внимания не выявлено."
  ),
  aandacht_p2: m(
    "In een coachingsgesprek kan worden onderzocht hoe taken rond de sterkste focusgebieden kunnen worden uitgebreid en hoe energie-vretende taken anders kunnen worden ingericht.",
    "Lors d'un entretien de coaching, on peut explorer comment élargir les tâches liées aux domaines de focus les plus forts et comment réorganiser les tâches énergivores.",
    "In a coaching conversation, it can be explored how tasks around the strongest focus areas can be expanded and how energy-draining tasks can be redesigned.",
    "En una conversación de coaching se puede explorar cómo ampliar las tareas en torno a las áreas de foco más fuertes y cómo reorganizar las tareas que consumen energía.",
    "В коучинговой беседе можно изучить, как расширить задачи вокруг самых сильных областей фокуса и как иначе организовать задачи, истощающие энергию."
  ),
  kop_gespreksvragen: m(
    "Mogelijke gespreksvragen",
    "Questions de discussion possibles",
    "Possible conversation questions",
    "Posibles preguntas de conversación",
    "Возможные вопросы для беседы"
  ),
  vraag1: m(
    "Welke taken geven je op een goede werkdag de meeste energie, en herken je die in dit profiel?",
    "Quelles tâches vous donnent le plus d'énergie lors d'une bonne journée de travail, et les reconnaissez-vous dans ce profil ?",
    "Which tasks give you the most energy on a good workday, and do you recognize them in this profile?",
    "¿Qué tareas te dan más energía en un buen día de trabajo y las reconoces en este perfil?",
    "Какие задачи дают вам больше всего энергии в хороший рабочий день, и узнаёте ли вы их в этом профиле?"
  ),
  vraag2: m(
    "Waar merk je dat je energie sneller wegloopt, en wat zou daar één kleine verandering kunnen zijn?",
    "Où remarquez-vous que votre énergie s'épuise plus vite, et quel petit changement pourriez-vous y apporter ?",
    "Where do you notice your energy draining faster, and what could be one small change there?",
    "¿Dónde notas que tu energía se agota más rápido y cuál podría ser un pequeño cambio ahí?",
    "Где вы замечаете, что энергия уходит быстрее, и какое одно небольшое изменение там возможно?"
  ),
  vraag3: m(
    "Welke van je sterkste focusgebieden krijgt op dit moment te weinig ruimte in je werk?",
    "Lequel de vos domaines de focus les plus forts manque actuellement de place dans votre travail ?",
    "Which of your strongest focus areas currently gets too little room in your work?",
    "¿Cuál de tus áreas de foco más fuertes recibe actualmente muy poco espacio en tu trabajo?",
    "Какая из ваших самых сильных областей фокуса сейчас получает слишком мало места в работе?"
  ),
  titel_kompas: m("TaPas Kompas", "TaPas Kompas", "TaPas Kompas", "TaPas Kompas", "TaPas Kompas"),
  titel_atlas: m("TaPas Coachatlas", "TaPas Coachatlas", "TaPas Coachatlas", "TaPas Coachatlas", "TaPas Coachatlas"),
  disclaimer: m(
    "Dit rapport beschrijft energie en gedrag in een professionele context op basis van zelfgerapporteerde keuzes. Het is geen psychologische diagnose, geen meting van talent of potentieel, en geen selectie-instrument. Het profiel is een momentopname en bedoeld als startpunt voor reflectie en gesprek.",
    "Ce rapport décrit l'énergie et le comportement dans un contexte professionnel à partir de choix auto-déclarés. Il ne s'agit pas d'un diagnostic psychologique, ni d'une mesure de talent ou de potentiel, ni d'un instrument de sélection. Le profil est un instantané, destiné à servir de point de départ à la réflexion et au dialogue.",
    "This report describes energy and behavior in a professional context based on self-reported choices. It is not a psychological diagnosis, not a measurement of talent or potential, and not a selection instrument. The profile is a snapshot, intended as a starting point for reflection and conversation.",
    "Este informe describe la energía y el comportamiento en un contexto profesional a partir de elecciones autodeclaradas. No es un diagnóstico psicológico, ni una medición de talento o potencial, ni un instrumento de selección. El perfil es una instantánea, pensado como punto de partida para la reflexión y la conversación.",
    "Этот отчёт описывает энергию и поведение в профессиональном контексте на основе самостоятельно сообщённого выбора. Это не психологический диагноз, не измерение таланта или потенциала и не инструмент отбора. Профиль — это моментальный снимок, предназначенный как отправная точка для размышления и беседы."
  ),
  footer: m("Gegenereerd op", "Généré le", "Generated on", "Generado el", "Сформировано"),
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

function verschilZin(verschil: number, taal: Taal): string {
  if (Math.abs(verschil) < 0.5) return k(T.verschil_dichtbij, taal);
  if (verschil > 0) return k(T.verschil_hoger, taal);
  return k(T.verschil_lager, taal);
}

// Connection-labels uit het meertalige instrument, gekeyed op q-id.
function connectionLabel(qid: string, taal: Taal): string {
  const q = instrument.connectionQuestions.find((x) => x.id === qid);
  if (q) return kies(q.label, taal);
  return qid;
}

// Bouwt de gestructureerde inhoud uit het bevroren contract, in de afname-taal.
export function bouwRapportInhoud(
  contract: any,
  variant: "kompas" | "coachatlas"
): RapportInhoud {
  const taal = normTaal(contract?.taal);
  const p = contract?.participant ?? {};
  const main = contract?.sections?.main ?? {};
  const meta = main?.meta ?? {};
  const constructRows: any[] = Array.isArray(main?.constructRows) ? main.constructRows : [];
  const connection = contract?.sections?.connection ?? null;

  const genormaliseerd = num(meta.normalizedQuestionnaireEnergy);
  const baseline = num(meta.baselineProfessionalEnergy);
  const verschil = num(meta.energyDiscrepancy);
  const niveau = k(ENERGIE_NIVEAU[energieNiveauKey(genormaliseerd)], taal);

  // "TaPas-Beeld" is een intern kalibratie-/controle-/identiteitsconstruct en
  // mag nooit zichtbaar worden in een opgeleverd rapport (in welke schrijfwijze
  // dan ook — centraal afgevangen, idem aan de chat-engine).
  const zichtbareRows = constructRows.filter((r) => !isTapasBeeld(r.construct));

  const drivers = zichtbareRows
    .filter((r) => r.family === "Drivers")
    .sort((a, b) => num(b.net) - num(a.net));
  const topDrivers = drivers.slice(0, 3);
  const aandachtsDrivers = [...drivers].reverse().slice(0, 2);

  // Talentfoci tonen alleen echte talentgebieden (geen Drivers — die hebben
  // hun eigen sectie). Drivers in deze tabel mengen zou conceptueel fout zijn.
  const talentFoci = [...zichtbareRows]
    .filter((r) => r.family !== "Drivers")
    .sort((a, b) => num(b.net) - num(a.net))
    .filter((r) => num(r.net) > 0)
    .slice(0, 5);

  const secties: RapportSectie[] = [];

  // 1. Energiebeeld
  secties.push({
    kop: k(T.kop_energie, taal),
    paragrafen: [
      fmt(k(T.energie_p1, taal), { g: genormaliseerd, niveau }),
      fmt(k(T.energie_p2, taal), { b: baseline, verschil: verschilZin(verschil, taal) }),
      k(T.energie_p3, taal),
    ],
    tabel: {
      kolommen: [k(T.col_indicator, taal), k(T.col_waarde, taal)],
      rijen: [
        [k(T.ind_energie_vl, taal), genormaliseerd],
        [k(T.ind_baseline, taal), baseline],
        [k(T.ind_verschil, taal), verschil],
        [k(T.ind_betrouwbaar, taal), `${niveauLabel(meta?.consistency?.label, taal)} (${num(meta?.consistency?.score)}/100)`],
      ],
    },
  });

  // 2. Talentfoci
  secties.push({
    kop: k(T.kop_focus, taal),
    paragrafen: [talentFoci.length ? k(T.focus_aanwezig, taal) : k(T.focus_afwezig, taal)],
    tabel: talentFoci.length
      ? {
          kolommen: [k(T.col_focus, taal), k(T.col_domein, taal), k(T.col_netto, taal), k(T.col_energie, taal)],
          rijen: talentFoci.map((r) => [r.construct, publiekeFamilie(r.family, taal), num(r.net), num(r.avgEnergy)]),
        }
      : undefined,
  });

  // 3. Drivers
  secties.push({
    kop: k(T.kop_drivers, taal),
    paragrafen: [
      k(T.drivers_duiding, taal),
      topDrivers.length
        ? fmt(k(T.drivers_aanwezig, taal), { lijst: topDrivers.map((r) => r.construct).join(", ") })
        : k(T.drivers_afwezig, taal),
      fmt(k(T.drivers_risico, taal), {
        label: niveauLabel(meta?.driverRisk?.label, taal),
        avg: num(meta?.driverRisk?.avg),
      }),
    ],
    tabel: topDrivers.length
      ? {
          kolommen: [k(T.col_drijfveer, taal), k(T.col_netto, taal), k(T.col_energie, taal)],
          rijen: topDrivers.map((r) => [r.construct, num(r.net), num(r.avgEnergy)]),
        }
      : undefined,
  });

  // 4. Verbondenheid (indien aanwezig)
  if (connection?.answers && connection?.labels) {
    const rijen = Object.keys(connection.labels).map((qid) => [
      connectionLabel(qid, taal),
      num((connection.answers as any)[qid]),
    ]);
    secties.push({
      kop: k(T.kop_verbondenheid, taal),
      paragrafen: [k(T.verbondenheid_p, taal)],
      tabel: { kolommen: [k(T.col_dimensie, taal), k(T.col_score, taal)], rijen },
    });
  }

  // 5. Coachatlas-specifiek
  if (variant === "coachatlas") {
    secties.push({
      kop: k(T.kop_aandacht, taal),
      paragrafen: [
        aandachtsDrivers.length
          ? fmt(k(T.aandacht_aanwezig, taal), { lijst: aandachtsDrivers.map((r) => r.construct).join(", ") })
          : k(T.aandacht_afwezig, taal),
        k(T.aandacht_p2, taal),
      ],
    });
    secties.push({
      kop: k(T.kop_gespreksvragen, taal),
      paragrafen: [k(T.vraag1, taal), k(T.vraag2, taal), k(T.vraag3, taal)],
    });
  }

  const titel = variant === "coachatlas" ? k(T.titel_atlas, taal) : k(T.titel_kompas, taal);
  const ondertitel = variant === "coachatlas" ? k(T.ondertitel_atlas, taal) : k(T.ondertitel_kompas, taal);

  return {
    variant,
    taal,
    titel,
    ondertitel,
    respondent: {
      naam: p.name ?? "Onbekend",
      code: p.respondentCode ?? "—",
      organisatie: p.company ?? null,
      functie: p.role ?? null,
    },
    gegenereerdOp: new Date().toISOString(),
    secties,
    disclaimer: k(T.disclaimer, taal),
  };
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Locale voor de datumweergave per taal.
const DATE_LOCALE: Record<Taal, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
  en: "en-US",
  es: "es-ES",
  ru: "ru-RU",
};

// Rendert de inhoud naar nette, zelfstandige HTML (voor weergave/afdruk).
export function renderRapportHtml(inhoud: RapportInhoud): string {
  const taal = normTaal(inhoud.taal);
  const r = inhoud.respondent;
  const metaRegel = [r.organisatie, r.functie].filter(Boolean).join(" · ");
  const sectiesHtml = inhoud.secties
    .map((s) => {
      const paras = s.paragrafen.map((p) => `<p>${esc(p)}</p>`).join("\n");
      let tabel = "";
      if (s.tabel) {
        const th = s.tabel.kolommen.map((kk) => `<th>${esc(kk)}</th>`).join("");
        const rows = s.tabel.rijen
          .map((row) => `<tr>${row.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`)
          .join("\n");
        tabel = `<table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      return `<section><h2>${esc(s.kop)}</h2>${paras}${tabel}</section>`;
    })
    .join("\n");

  const footerLabel = k(T.footer, taal);
  const datum = new Date(inhoud.gegenereerdOp).toLocaleString(DATE_LOCALE[taal]);

  // Cyrillisch (RU) heeft een font-stack nodig die het schrift correct dekt.
  // We laden een Cyrillisch-veilige sans-serif en houden voor alle talen een
  // robuuste system-ui fallback aan.
  const fontStack =
    "'DM Sans', 'Segoe UI', system-ui, -apple-system, 'Noto Sans', 'PT Sans', Arial, sans-serif";

  return `<!DOCTYPE html>
<html lang="${taal}">
<head>
<meta charset="utf-8" />
<title>${esc(inhoud.titel)} — ${esc(r.naam)}</title>
<style>
  :root { --navy:#1e293b; --teal:#0d9488; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; }
  * { box-sizing: border-box; }
  body { font-family: ${fontStack}; color: var(--ink); margin:0; padding:32px; background:#f8fafc; }
  .doc { max-width: 760px; margin:0 auto; background:#fff; border:1px solid var(--line); border-radius:12px; padding:40px; }
  header { border-bottom:3px solid var(--teal); padding-bottom:16px; margin-bottom:24px; }
  h1 { font-size:24px; margin:0 0 4px; color:var(--navy); }
  .sub { color:var(--muted); font-size:14px; margin:0; }
  .resp { margin-top:12px; font-size:14px; color:var(--ink); }
  .resp strong { color:var(--navy); }
  h2 { font-size:16px; color:var(--navy); margin:28px 0 8px; }
  p { font-size:14px; line-height:1.6; margin:0 0 10px; }
  table { width:100%; border-collapse:collapse; margin:12px 0 4px; font-size:13px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; background:#f1f5f9; }
  .disclaimer { margin-top:32px; padding:14px 16px; background:#f1f5f9; border-radius:8px; font-size:12px; color:var(--muted); line-height:1.5; }
  footer { margin-top:20px; font-size:11px; color:var(--muted); }
</style>
</head>
<body>
  <div class="doc">
    <header>
      <h1>${esc(inhoud.titel)}</h1>
      <p class="sub">${esc(inhoud.ondertitel)}</p>
      <p class="resp"><strong>${esc(r.naam)}</strong> · ${esc(r.code)}${metaRegel ? " · " + esc(metaRegel) : ""}</p>
    </header>
    ${sectiesHtml}
    <div class="disclaimer">${esc(inhoud.disclaimer)}</div>
    <footer>${esc(footerLabel)} ${esc(datum)} · TaPasCity</footer>
  </div>
</body>
</html>`;
}
