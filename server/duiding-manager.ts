/**
 * Duiding Manager — prior-beheerder beheert de LIVE AI-duidinglaag van T4P
 *
 * Architectuur (spiegel van question-manager.ts — Regel 1 & 2, strikt additief):
 *  - De regie-prompt (één per taal) en de per-dimensie ankers zijn de "live bron",
 *    net zoals instrument.json de bron is voor de vragen. Ze staan hier als
 *    concept-DEFAULTS in code (CONCEPT_REGIE_PROMPT / CONCEPT_ANKERS).
 *  - Aanpassingen worden opgeslagen in een SQLite-tabel `duiding_overschrijvingen`.
 *    De default wordt NIET gedupliceerd in de tabel; een override wint enkel op
 *    leestijd. Herstellen = de override-rij verwijderen → default keert terug.
 *  - Beveiliging: enkel is_prior=true beheerders mogen lezen + schrijven.
 *  - Audit trail: elke wijziging slaat wie + wanneer op (gewijzigd_door/-op).
 *
 * AI-duidingpad (spiegel van het Vlaamse-stem/TTS-pad):
 *  - Het bevroren scorecontract (scoring.ts, ONGEWIJZIGD) + de regie-prompt in de
 *    juiste taal + de relevante ankers worden tot één payload samengesteld en naar
 *    Gemini gestuurd (GEMINI_API_KEY, dezelfde model-familie als tts.py).
 *  - Het model mag ENKEL de duiding-prozateksten herschrijven; de cijfers/tabellen
 *    komen uitsluitend uit het contract en blijven ongemoeid.
 *  - Meerlaagse fallback (VERPLICHT): faalt de AI, is ze traag, ontbreekt de key,
 *    of faalt de guardrail-check → val terug op de bestaande statische
 *    bouwRapportInhoud-tekst. Een afname mag NOOIT blokkeren.
 *
 * TaPas-Beeld is een verborgen kalibratieconstruct: het krijgt GEEN anker en wordt
 * NOOIT aan de duiding meegegeven (afgevangen via isTapasBeeld).
 *
 * Talen: nl, fr, en, es, ru
 */

import { type Request, type Response } from "express";
import { storage, db } from "./storage";
import { isTapasBeeld } from "../shared/talent-constructs";
import type { RapportInhoud } from "./rapportgenerator";
import {
  keurPayloadGoed,
  bouwDoorgifteRegister,
  type DoorgifteRegel,
} from "./duiding-pseudonimisering";

// ─── Helper: prior-check middleware (spiegel van question-manager.ts) ─────────

async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen de duiding beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

// ─── Constanten ───────────────────────────────────────────────────────────────

const TALEN = ["nl", "fr", "en", "es", "ru"] as const;
type Taal = typeof TALEN[number];

// Het T4P-instrument waarop deze pilot van toepassing is.
export const DUIDING_INSTRUMENT = "t4p-business-kompas";

// Gemini tekst-model (zelfde familie als tts.py; tekst i.p.v. audio).
const GEMINI_MODELLEN = ["gemini-2.5-flash", "gemini-2.5-flash-preview-05-20"];
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
// Harde tijdslimiet: liever de nette sjabloon-fallback dan een deelnemer laten wachten.
const AI_TIMEOUT_MS = 12000;

// ─── Concept-DEFAULTS — de live bron (niet gedupliceerd in de tabel) ──────────

// Regie-prompt per taal. Kerninstructie (verplicht, bewaakt door de guardrail):
// "verzin geen ... uitsluitend de meegegeven cijfers". 'Drivers' wordt nooit
// vertaald; familie-labels conform FAMILIE_PUBLIEK (Regel 4).
const CONCEPT_REGIE_PROMPT: Record<Taal, string> = {
  nl:
    "Je schrijft de duiding van één uniek talentprofiel. Leg de nadruk op wat dít " +
    "profiel bijzonder maakt: opvallende combinaties, spanningen tussen dimensies, " +
    "en het samenspel. Vermijd standaardzinnen en algemeenheden. Gebruik UITSLUITEND " +
    "de meegegeven cijfers en bevindingen; verzin geen getallen, percentages of feiten " +
    "bij. Schrijf warm, helder en respectvol in het Nederlands.",
  fr:
    "Tu rédiges l'interprétation d'un profil de talent unique. Mets l'accent sur ce qui " +
    "rend CE profil particulier : les combinaisons remarquables, les tensions entre les " +
    "dimensions et leur interaction. Évite les phrases toutes faites et les généralités. " +
    "Utilise EXCLUSIVEMENT les chiffres et constats fournis ; n'invente aucun nombre, " +
    "pourcentage ni fait. Écris avec chaleur, clarté et respect en français.",
  en:
    "You write the interpretation of one unique talent profile. Emphasize what makes THIS " +
    "profile special: striking combinations, tensions between dimensions, and their " +
    "interplay. Avoid boilerplate sentences and generalities. Use EXCLUSIVELY the provided " +
    "figures and findings; do not invent any numbers, percentages or facts. Write warmly, " +
    "clearly and respectfully in English.",
  es:
    "Redactas la interpretación de un perfil de talento único. Destaca lo que hace especial " +
    "a ESTE perfil: combinaciones llamativas, tensiones entre dimensiones y su interacción. " +
    "Evita frases hechas y generalidades. Utiliza EXCLUSIVAMENTE las cifras y los hallazgos " +
    "facilitados; no inventes ningún número, porcentaje ni hecho. Escribe de forma cálida, " +
    "clara y respetuosa en español.",
  ru:
    "Вы пишете интерпретацию одного уникального профиля талантов. Подчеркните то, что делает " +
    "ИМЕННО этот профиль особенным: заметные сочетания, напряжения между измерениями и их " +
    "взаимодействие. Избегайте шаблонных фраз и общих мест. Используйте ИСКЛЮЧИТЕЛЬНО " +
    "предоставленные цифры и выводы; не выдумывайте никаких чисел, процентов или фактов. " +
    "Пишите тепло, ясно и уважительно на русском языке.",
};

// Concept-ankers per zichtbare T4P-dimensie. De NL-tekst is LETTERLIJK overgenomen
// uit duidingsbeheer-ontwerp.md (sectie "Concept-ankers per T4P-dimensie", Regel 4);
// fr/en/es/ru zijn getrouwe vertalingen. TaPas-Beeld staat hier bewust NIET in en
// krijgt nooit een anker.
const CONCEPT_ANKERS: Record<string, Record<Taal, string>> = {
  // Familie 1 — Drivers (Taibi Kahler; term nooit vertalen)
  "Be Strong": {
    nl: "Benoem de kracht van zelfstandig doorzetten; wijs op het risico van te weinig steun vragen. Toon: respectvol, niet moraliserend.",
    fr: "Nomme la force de persévérer en autonomie ; signale le risque de trop peu demander de soutien. Ton : respectueux, non moralisateur.",
    en: "Name the strength of persevering independently; point to the risk of asking for too little support. Tone: respectful, not moralizing.",
    es: "Nombra la fuerza de perseverar de forma autónoma; señala el riesgo de pedir demasiado poco apoyo. Tono: respetuoso, no moralizante.",
    ru: "Назовите силу самостоятельной настойчивости; укажите на риск слишком редко просить о поддержке. Тон: уважительный, без нравоучений.",
  },
  "Be Perfect": {
    nl: "Waardeer de zorg voor kwaliteit; signaleer wanneer perfectie het tempo of de afronding remt.",
    fr: "Valorise le souci de la qualité ; signale quand la perfection freine le rythme ou l'achèvement.",
    en: "Appreciate the care for quality; signal when perfection slows down pace or completion.",
    es: "Valora el cuidado por la calidad; señala cuándo la perfección frena el ritmo o la finalización.",
    ru: "Оцените заботу о качестве; отметьте, когда стремление к совершенству тормозит темп или завершение.",
  },
  "Hurry Up": {
    nl: "Erken de daadkracht en het tempo; wijs op het risico van te snel of onvolledig.",
    fr: "Reconnais l'énergie d'action et le rythme ; signale le risque d'aller trop vite ou de rester incomplet.",
    en: "Acknowledge the drive and pace; point to the risk of being too fast or incomplete.",
    es: "Reconoce la determinación y el ritmo; señala el riesgo de ir demasiado rápido o de forma incompleta.",
    ru: "Признайте решительность и темп; укажите на риск действовать слишком быстро или неполно.",
  },
  "Try Hard": {
    nl: "Waardeer de inzet en het doorzettingsvermogen; signaleer wanneer moeite het resultaat overschaduwt.",
    fr: "Valorise l'engagement et la ténacité ; signale quand l'effort éclipse le résultat.",
    en: "Appreciate the effort and perseverance; signal when effort overshadows the result.",
    es: "Valora el empeño y la perseverancia; señala cuándo el esfuerzo eclipsa el resultado.",
    ru: "Оцените усилия и упорство; отметьте, когда старание затмевает результат.",
  },
  "Please Others": {
    nl: "Waardeer de gerichtheid op de ander; wijs op het risico van zichzelf wegcijferen.",
    fr: "Valorise l'attention portée à l'autre ; signale le risque de s'effacer soi-même.",
    en: "Appreciate the focus on others; point to the risk of self-effacement.",
    es: "Valora la orientación hacia los demás; señala el riesgo de anularse a sí mismo.",
    ru: "Оцените направленность на другого; укажите на риск забывать о себе.",
  },
  // Familie 2 — Talent-foci (publiek label "Werkgedrag")
  "Strategie": {
    nl: "Benoem het vermogen om richting en samenhang te zien; koppel aan het grotere geheel.",
    fr: "Nomme la capacité à voir la direction et la cohérence ; relie à l'ensemble plus vaste.",
    en: "Name the ability to see direction and coherence; connect to the bigger picture.",
    es: "Nombra la capacidad de ver dirección y coherencia; vincula al conjunto más amplio.",
    ru: "Назовите способность видеть направление и целостность; свяжите с более широкой картиной.",
  },
  "Operationeel": {
    nl: "Waardeer het oog voor uitvoering en concrete voortgang; benoem het als motor van resultaat.",
    fr: "Valorise le sens de l'exécution et du progrès concret ; nomme-le comme moteur de résultat.",
    en: "Appreciate the eye for execution and concrete progress; name it as an engine of results.",
    es: "Valora el ojo para la ejecución y el progreso concreto; nómbralo como motor de resultados.",
    ru: "Оцените внимание к исполнению и конкретному продвижению; назовите это двигателем результата.",
  },
  "Inter-relationeel": {
    nl: "Benoem de gerichtheid op mensen en verbinding; koppel aan samenwerking en vertrouwen.",
    fr: "Nomme l'attention aux personnes et au lien ; relie à la collaboration et à la confiance.",
    en: "Name the focus on people and connection; connect to collaboration and trust.",
    es: "Nombra la orientación hacia las personas y la conexión; vincula a la colaboración y la confianza.",
    ru: "Назовите направленность на людей и связь; свяжите с сотрудничеством и доверием.",
  },
  "Innovatie": {
    nl: "Waardeer het zoeken naar het nieuwe; benoem het als bron van vernieuwing en verrassing.",
    fr: "Valorise la recherche du nouveau ; nomme-le comme source de renouvellement et de surprise.",
    en: "Appreciate the search for the new; name it as a source of renewal and surprise.",
    es: "Valora la búsqueda de lo nuevo; nómbralo como fuente de renovación y sorpresa.",
    ru: "Оцените стремление к новому; назовите это источником обновления и неожиданности.",
  },
  // Familie 3 — Talent-versnellers (publiek label "Versterkend gedrag")
  "Analyse": {
    nl: "Benoem het doordenken en ontleden; koppel aan onderbouwde keuzes.",
    fr: "Nomme la réflexion approfondie et l'analyse ; relie à des choix étayés.",
    en: "Name the thinking-through and dissecting; connect to well-founded choices.",
    es: "Nombra el razonamiento y el análisis; vincula a decisiones fundamentadas.",
    ru: "Назовите глубокое осмысление и разбор; свяжите с обоснованными решениями.",
  },
  "Coaching": {
    nl: "Waardeer het ontwikkelen van anderen; koppel aan groei in de omgeving.",
    fr: "Valorise le développement des autres ; relie à la croissance de l'entourage.",
    en: "Appreciate the developing of others; connect to growth in the environment.",
    es: "Valora el desarrollo de los demás; vincula al crecimiento del entorno.",
    ru: "Оцените развитие других; свяжите с ростом окружения.",
  },
  "Constructief onderscheidend": {
    nl: "Benoem het vermogen om verschil te maken zonder te polariseren; koppel aan scherpte met respect.",
    fr: "Nomme la capacité à faire la différence sans polariser ; relie à l'acuité avec respect.",
    en: "Name the ability to make a difference without polarizing; connect to sharpness with respect.",
    es: "Nombra la capacidad de marcar la diferencia sin polarizar; vincula a la agudeza con respeto.",
    ru: "Назовите способность создавать различие, не поляризуя; свяжите с остротой при уважении.",
  },
  "Faciliteren": {
    nl: "Waardeer het mogelijk maken en soepel laten lopen; koppel aan samenwerking.",
    fr: "Valorise le fait de rendre possible et de faire tourner en souplesse ; relie à la collaboration.",
    en: "Appreciate the enabling and smooth running; connect to collaboration.",
    es: "Valora el hacer posible y el buen funcionamiento; vincula a la colaboración.",
    ru: "Оцените создание возможностей и плавное течение; свяжите с сотрудничеством.",
  },
  "Impact": {
    nl: "Benoem de invloed en zichtbaarheid; koppel aan overtuiging en aanwezigheid.",
    fr: "Nomme l'influence et la visibilité ; relie à la conviction et à la présence.",
    en: "Name the influence and visibility; connect to conviction and presence.",
    es: "Nombra la influencia y la visibilidad; vincula a la convicción y la presencia.",
    ru: "Назовите влияние и заметность; свяжите с убеждённостью и присутствием.",
  },
  "Resultaatgericht": {
    nl: "Waardeer de focus op de uitkomst; benoem het als drijfveer voor afronding.",
    fr: "Valorise le focus sur le résultat ; nomme-le comme moteur d'achèvement.",
    en: "Appreciate the focus on the outcome; name it as a driver of completion.",
    es: "Valora el enfoque en el resultado; nómbralo como impulsor de la finalización.",
    ru: "Оцените ориентацию на итог; назовите это движущей силой завершения.",
  },
  // Deel 2 — Verbindingsvragen (0–10; labels conform scoring.ts CONNECTION_LABELS)
  "Psychologische verbondenheid": {
    nl: "Duid de mate van binding met de organisatie; verbind met betrokkenheid.",
    fr: "Interprète le degré d'attachement à l'organisation ; relie à l'engagement.",
    en: "Interpret the degree of bond with the organization; connect to engagement.",
    es: "Interpreta el grado de vínculo con la organización; conéctalo con el compromiso.",
    ru: "Истолкуйте степень связи с организацией; свяжите с вовлечённостью.",
  },
  "Billijkheid / verloning": {
    nl: "Duid het ervaren evenwicht tussen geven en krijgen.",
    fr: "Interprète l'équilibre ressenti entre donner et recevoir.",
    en: "Interpret the perceived balance between giving and receiving.",
    es: "Interpreta el equilibrio percibido entre dar y recibir.",
    ru: "Истолкуйте воспринимаемый баланс между тем, что человек отдаёт и получает.",
  },
  "Zelfinvestering": {
    nl: "Duid de bereidheid om in zichzelf te investeren.",
    fr: "Interprète la disposition à investir en soi-même.",
    en: "Interpret the willingness to invest in oneself.",
    es: "Interpreta la disposición a invertir en uno mismo.",
    ru: "Истолкуйте готовность вкладываться в себя.",
  },
  "Organisatie-investering": {
    nl: "Duid hoe de persoon de investering van de organisatie ervaart.",
    fr: "Interprète comment la personne ressent l'investissement de l'organisation.",
    en: "Interpret how the person experiences the organization's investment.",
    es: "Interpreta cómo la persona vive la inversión de la organización.",
    ru: "Истолкуйте, как человек воспринимает вклад организации.",
  },
};

// De vaste volgorde/lijst van beheerbare ankers (voor de admin-lijst).
const ANKER_DIMENSIES: { dimensie: string; familie: string }[] = [
  { dimensie: "Be Strong", familie: "Drivers" },
  { dimensie: "Be Perfect", familie: "Drivers" },
  { dimensie: "Hurry Up", familie: "Drivers" },
  { dimensie: "Try Hard", familie: "Drivers" },
  { dimensie: "Please Others", familie: "Drivers" },
  { dimensie: "Strategie", familie: "Werkgedrag" },
  { dimensie: "Operationeel", familie: "Werkgedrag" },
  { dimensie: "Inter-relationeel", familie: "Werkgedrag" },
  { dimensie: "Innovatie", familie: "Werkgedrag" },
  { dimensie: "Analyse", familie: "Versterkend gedrag" },
  { dimensie: "Coaching", familie: "Versterkend gedrag" },
  { dimensie: "Constructief onderscheidend", familie: "Versterkend gedrag" },
  { dimensie: "Faciliteren", familie: "Versterkend gedrag" },
  { dimensie: "Impact", familie: "Versterkend gedrag" },
  { dimensie: "Resultaatgericht", familie: "Versterkend gedrag" },
  { dimensie: "Psychologische verbondenheid", familie: "Verbindingsvragen" },
  { dimensie: "Billijkheid / verloning", familie: "Verbindingsvragen" },
  { dimensie: "Zelfinvestering", familie: "Verbindingsvragen" },
  { dimensie: "Organisatie-investering", familie: "Verbindingsvragen" },
];

// ─── T4Sports — Concept-DEFAULTS (ADDITIEF, Regel 2) ──────────────────────────
// Aparte consts; de T4P-consts hierboven blijven ONGEMOEID. Instrument-id komt
// LETTERLIJK uit buildT4SportsContract (server/t4sports/scoring.ts:236).
export const T4SPORTS_INSTRUMENT = "t4sports";

// Regie-prompt (5 talen). Bevat — net als T4P — de guardrail-kern ("verzin geen"
// + "uitsluitend de meegegeven"). Coaching-aanwijzingen zijn coach-only.
const CONCEPT_REGIE_PROMPT_T4SPORTS: Record<Taal, string> = {
  nl:
    "Je schrijft de duiding van één uniek mentaal talentprofiel in een sportcontext. " +
    "Leg de nadruk op wat déze atleet bijzonder maakt: opvallende combinaties van drivers, " +
    "talent-foci en versnellers, de spanningen daartussen, en hoe ze samen de prestatie kleuren. " +
    "De coaching-aanwijzingen zijn coach-only en NOOIT bedoeld voor directe communicatie aan de " +
    "atleet. Vermijd standaardzinnen en algemeenheden. Herformuleer uitsluitend de vaste " +
    "sportbeschrijvingen; gebruik UITSLUITEND de meegegeven cijfers en bevindingen en verzin " +
    "geen getallen, percentages of feiten bij. Schrijf warm, helder en respectvol in het Nederlands.",
  fr:
    "Tu rédiges l'interprétation d'un profil de talent mental unique dans un contexte sportif. " +
    "Mets l'accent sur ce qui rend CET athlète particulier : les combinaisons remarquables de " +
    "drivers, de talent-foci et d'accélérateurs, les tensions entre eux et la façon dont ils " +
    "colorent ensemble la performance. Les conseils de coaching sont réservés au coach et ne " +
    "sont JAMAIS destinés à une communication directe à l'athlète. Évite les phrases toutes " +
    "faites et les généralités. Reformule uniquement les descriptions sportives fixes ; utilise " +
    "EXCLUSIVEMENT les chiffres et constats fournis et n'invente aucun nombre, pourcentage ni " +
    "fait. Écris avec chaleur, clarté et respect en français.",
  en:
    "You write the interpretation of one unique mental talent profile in a sports context. " +
    "Emphasize what makes THIS athlete special: striking combinations of drivers, talent foci " +
    "and accelerators, the tensions between them, and how together they colour the performance. " +
    "The coaching notes are coach-only and NEVER intended for direct communication to the " +
    "athlete. Avoid boilerplate sentences and generalities. Only rephrase the fixed sport " +
    "descriptions; use EXCLUSIVELY the provided figures and findings and do not invent any " +
    "numbers, percentages or facts. Write warmly, clearly and respectfully in English.",
  es:
    "Redactas la interpretación de un perfil de talento mental único en un contexto deportivo. " +
    "Destaca lo que hace especial a ESTE atleta: combinaciones llamativas de drivers, talent-foci " +
    "y aceleradores, las tensiones entre ellos y cómo juntos dan color al rendimiento. Las " +
    "indicaciones de coaching son solo para el coach y NUNCA están destinadas a una comunicación " +
    "directa al atleta. Evita frases hechas y generalidades. Reformula únicamente las " +
    "descripciones deportivas fijas; utiliza EXCLUSIVAMENTE las cifras y los hallazgos " +
    "facilitados y no inventes ningún número, porcentaje ni hecho. Escribe de forma cálida, " +
    "clara y respetuosa en español.",
  ru:
    "Вы пишете интерпретацию одного уникального профиля ментального таланта в спортивном " +
    "контексте. Подчеркните то, что делает ИМЕННО этого спортсмена особенным: заметные сочетания " +
    "драйверов, талант-фокусов и ускорителей, напряжения между ними и то, как вместе они " +
    "окрашивают результат. Тренерские указания предназначены только для тренера и НИКОГДА не " +
    "предназначены для прямого сообщения спортсмену. Избегайте шаблонных фраз и общих мест. " +
    "Переформулируйте только фиксированные спортивные описания; используйте ИСКЛЮЧИТЕЛЬНО " +
    "предоставленные цифры и выводы и не выдумывайте никаких чисел, процентов или фактов. " +
    "Пишите тепло, ясно и уважительно на русском языке.",
};

// Concept-ankers per T4Sports-dimensie (toon-/nadrukinstructies). Dimensie-sleutels
// = de INTERNE constructnamen zoals in constructRows/t4sports.json (Regel 4), zodat
// ze rechtstreeks matchen met het scorecontract. Toon gebaseerd op de vaste
// SPORT/VERSNELLER/DRIVER-beschrijvingen in server/t4sports/rapport.ts. GEEN getallen.
const CONCEPT_ANKERS_T4SPORTS: Record<string, Record<Taal, string>> = {
  // Drivers (Taibi Kahler; term nooit vertalen) — coach-only nadruk.
  "Be Perfect": {
    nl: "Waardeer de hoge kwaliteitsstandaarden; wijs de coach op het risico dat perfectie omslaat in blokkerende zelfkritiek. Coach-toon.",
    fr: "Valorise les hauts standards de qualité ; signale au coach le risque que la perfection se mue en autocritique bloquante. Ton coach.",
    en: "Appreciate the high quality standards; alert the coach to the risk that perfection turns into blocking self-criticism. Coach tone.",
    es: "Valora los altos estándares de calidad; advierte al coach del riesgo de que la perfección se convierta en autocrítica bloqueante. Tono de coach.",
    ru: "Оцените высокие стандарты качества; предупредите тренера о риске, что перфекционизм превратится в блокирующую самокритику. Тон тренера.",
  },
  "Be Strong": {
    nl: "Benoem de kracht en het doorzettingsvermogen als anker voor de ploeg; signaleer dat nooit hulp vragen op termijn energie kost. Coach-toon.",
    fr: "Nomme la force et la ténacité comme ancrage pour l'équipe ; signale que ne jamais demander d'aide coûte de l'énergie à terme. Ton coach.",
    en: "Name the strength and perseverance as an anchor for the team; signal that never asking for help costs energy over time. Coach tone.",
    es: "Nombra la fuerza y la perseverancia como ancla para el equipo; señala que no pedir nunca ayuda cuesta energía a la larga. Tono de coach.",
    ru: "Назовите силу и упорство как опору для команды; отметьте, что привычка никогда не просить помощи со временем истощает. Тон тренера.",
  },
  "Hurry Up": {
    nl: "Erken de snelle besluitvorming in dynamische sportsituaties; wijs op het risico van overhaasting en vroege uitputting. Coach-toon.",
    fr: "Reconnais la prise de décision rapide dans les situations sportives dynamiques ; signale le risque de précipitation et d'épuisement précoce. Ton coach.",
    en: "Acknowledge the fast decision-making in dynamic sport situations; point to the risk of haste and early exhaustion. Coach tone.",
    es: "Reconoce la toma de decisiones rápida en situaciones deportivas dinámicas; señala el riesgo de precipitación y agotamiento temprano. Tono de coach.",
    ru: "Признайте быстрое принятие решений в динамичных спортивных ситуациях; укажите на риск поспешности и раннего истощения. Тон тренера.",
  },
  "Please Others": {
    nl: "Waardeer de sterke sociale afstemming binnen de ploeg; signaleer de kwetsbaarheid van prestaties die afhangen van goedkeuring. Coach-toon.",
    fr: "Valorise la forte syntonie sociale au sein de l'équipe ; signale la vulnérabilité de performances dépendant de l'approbation. Ton coach.",
    en: "Appreciate the strong social attunement within the team; signal the vulnerability of performances that depend on approval. Coach tone.",
    es: "Valora la fuerte sintonía social dentro del equipo; señala la vulnerabilidad de un rendimiento que depende de la aprobación. Tono de coach.",
    ru: "Оцените сильную социальную чуткость в команде; отметьте уязвимость результатов, зависящих от одобрения. Тон тренера.",
  },
  "Try Hard": {
    nl: "Benoem de grenzeloze inzet voor wie de atleet dierbaar is; wijs op het risico dat de motivatie wegvalt zonder externe figuur. Coach-toon.",
    fr: "Nomme l'engagement sans limite pour ceux qui sont chers à l'athlète ; signale le risque que la motivation disparaisse sans figure externe. Ton coach.",
    en: "Name the boundless effort for those dear to the athlete; point to the risk that motivation falls away without an external figure. Coach tone.",
    es: "Nombra el empeño sin límites por quienes son queridos para el atleta; señala el riesgo de que la motivación desaparezca sin una figura externa. Tono de coach.",
    ru: "Назовите безграничное усердие ради дорогих спортсмену людей; укажите на риск потери мотивации без внешней фигуры. Тон тренера.",
  },
  // Talent-foci (publiek label "Talent-foci")
  "Functioneel Innovatief": {
    nl: "Benoem het creatief oplossen in het veld en het aanpassingsvermogen; koppel aan vindingrijkheid onder wisselende omstandigheden.",
    fr: "Nomme la résolution créative sur le terrain et la capacité d'adaptation ; relie à l'ingéniosité dans des circonstances changeantes.",
    en: "Name the creative problem-solving on the field and the adaptability; connect to resourcefulness under changing circumstances.",
    es: "Nombra la resolución creativa en el campo y la capacidad de adaptación; vincula al ingenio ante circunstancias cambiantes.",
    ru: "Назовите творческое решение задач на поле и адаптивность; свяжите с находчивостью в меняющихся условиях.",
  },
  "Artistiek Innovatief": {
    nl: "Waardeer stijl, gevoel en expressie in de sport; koppel aan de unieke signatuur van de prestatie.",
    fr: "Valorise le style, le ressenti et l'expression dans le sport ; relie à la signature unique de la performance.",
    en: "Appreciate style, feel and expression in the sport; connect to the unique signature of the performance.",
    es: "Valora el estilo, la sensibilidad y la expresión en el deporte; vincula a la firma única del rendimiento.",
    ru: "Оцените стиль, чувство и выразительность в спорте; свяжите с уникальным почерком выступления.",
  },
  "Complexiteit/Conceptueel": {
    nl: "Benoem het tactisch en strategisch denken; koppel aan inzicht in het 'waarom' achter elke beweging.",
    fr: "Nomme la pensée tactique et stratégique ; relie à la compréhension du « pourquoi » derrière chaque mouvement.",
    en: "Name the tactical and strategic thinking; connect to insight into the 'why' behind each movement.",
    es: "Nombra el pensamiento táctico y estratégico; vincula a la comprensión del 'porqué' detrás de cada movimiento.",
    ru: "Назовите тактическое и стратегическое мышление; свяжите с пониманием «почему» за каждым движением.",
  },
  "Systematisch/Uitvoerend": {
    nl: "Waardeer consistentie, routine en gestructureerde uitvoering; koppel aan betrouwbaarheid in de flow.",
    fr: "Valorise la constance, la routine et l'exécution structurée ; relie à la fiabilité dans le flow.",
    en: "Appreciate consistency, routine and structured execution; connect to reliability in the flow.",
    es: "Valora la constancia, la rutina y la ejecución estructurada; vincula a la fiabilidad en el flow.",
    ru: "Оцените последовательность, режим и структурированное исполнение; свяжите с надёжностью в потоке.",
  },
  "Sociaal Interactief": {
    nl: "Benoem de ploegverbinding als energiebron; koppel aan bovengemiddeld presteren in groep.",
    fr: "Nomme le lien d'équipe comme source d'énergie ; relie à une performance supérieure en groupe.",
    en: "Name the team connection as a source of energy; connect to above-average performance in a group.",
    es: "Nombra la conexión de equipo como fuente de energía; vincula a un rendimiento superior en grupo.",
    ru: "Назовите командную связь источником энергии; свяжите с результатами выше среднего в группе.",
  },
  "Overdrachtelijk Interactief": {
    nl: "Waardeer het activeren en inspireren van anderen; koppel aan energie uit kennisoverdracht.",
    fr: "Valorise le fait d'activer et d'inspirer les autres ; relie à l'énergie tirée de la transmission du savoir.",
    en: "Appreciate the activating and inspiring of others; connect to energy drawn from passing on knowledge.",
    es: "Valora el activar e inspirar a los demás; vincula a la energía que surge de transmitir conocimiento.",
    ru: "Оцените способность активировать и вдохновлять других; свяжите с энергией от передачи знаний.",
  },
  // Talent-versnellers (publiek label "Talent-versnellers")
  "Analyse": {
    nl: "Benoem het grondig verwerken van prestatie-informatie; koppel aan scherper inzicht in patronen en fouten.",
    fr: "Nomme le traitement approfondi de l'information de performance ; relie à une compréhension plus fine des schémas et des erreurs.",
    en: "Name the thorough processing of performance information; connect to sharper insight into patterns and mistakes.",
    es: "Nombra el procesamiento minucioso de la información de rendimiento; vincula a una comprensión más aguda de patrones y errores.",
    ru: "Назовите тщательную обработку информации о результатах; свяжите с более острым пониманием закономерностей и ошибок.",
  },
  "Individueel ondersteunend": {
    nl: "Waardeer het één-op-één begeleiden en motiveren; koppel aan wederzijdse energie en vervulling.",
    fr: "Valorise l'accompagnement et la motivation en tête-à-tête ; relie à l'énergie et à l'épanouissement mutuels.",
    en: "Appreciate the one-on-one guiding and motivating; connect to mutual energy and fulfilment.",
    es: "Valora el acompañamiento y la motivación uno a uno; vincula a la energía y la realización mutuas.",
    ru: "Оцените индивидуальное сопровождение и мотивацию; свяжите с взаимной энергией и удовлетворением.",
  },
  "Groepsondersteunend": {
    nl: "Benoem het bouwen aan teamflow en cohesie; koppel aan een team dat als één geheel presteert.",
    fr: "Nomme la construction du flow d'équipe et de la cohésion ; relie à une équipe qui performe comme un tout.",
    en: "Name the building of team flow and cohesion; connect to a team that performs as one whole.",
    es: "Nombra la construcción del flow de equipo y la cohesión; vincula a un equipo que rinde como un todo.",
    ru: "Назовите построение командного потока и сплочённости; свяжите с командой, действующей как единое целое.",
  },
  "Impact": {
    nl: "Benoem het opleven onder druk en op grote momenten; koppel aan de beste prestaties wanneer er iets op het spel staat.",
    fr: "Nomme le regain sous pression et lors des grands moments ; relie aux meilleures performances quand il y a un enjeu.",
    en: "Name the coming alive under pressure and in big moments; connect to peak performances when something is at stake.",
    es: "Nombra el crecerse bajo presión y en los grandes momentos; vincula a las mejores actuaciones cuando hay algo en juego.",
    ru: "Назовите оживление под давлением и в важные моменты; свяжите с лучшими выступлениями, когда есть ставка.",
  },
  "Resultaat": {
    nl: "Waardeer de doelgerichte focus zonder afleiding; koppel aan een krachtige versneller richting succes.",
    fr: "Valorise la concentration sur l'objectif sans distraction ; relie à un puissant accélérateur vers le succès.",
    en: "Appreciate the goal-directed focus without distraction; connect to a powerful accelerator toward success.",
    es: "Valora el enfoque orientado a la meta sin distracción; vincula a un potente acelerador hacia el éxito.",
    ru: "Оцените целенаправленную концентрацию без отвлечений; свяжите с мощным ускорителем на пути к успеху.",
  },
  "Constructief onderscheidend": {
    nl: "Benoem het out-of-the-box denken en het uitdagen van de status quo; koppel aan de vruchtbaarheid van de eigen weg.",
    fr: "Nomme la pensée hors des sentiers battus et la remise en question du statu quo ; relie à la fécondité de sa propre voie.",
    en: "Name the out-of-the-box thinking and the challenging of the status quo; connect to the fruitfulness of one's own path.",
    es: "Nombra el pensamiento original y el desafío al statu quo; vincula a la fecundidad del propio camino.",
    ru: "Назовите нестандартное мышление и вызов статус-кво; свяжите с плодотворностью собственного пути.",
  },
  // Verbindingsvragen (schaal nul–tien; labels LETTERLIJK uit t4sports.json/onderzoek)
  "Sportpassie": {
    nl: "Duid de mate van passie en betrokkenheid bij de sport; verbind met de intrinsieke drive van de atleet.",
    fr: "Interprète le degré de passion et d'implication dans le sport ; relie à la motivation intrinsèque de l'athlète.",
    en: "Interpret the degree of passion and involvement in the sport; connect to the athlete's intrinsic drive.",
    es: "Interpreta el grado de pasión e implicación en el deporte; conéctalo con el impulso intrínseco del atleta.",
    ru: "Истолкуйте степень страсти и вовлечённости в спорт; свяжите с внутренней мотивацией спортсмена.",
  },
  "Billijkheid in sport": {
    nl: "Duid het ervaren evenwicht tussen inzet en erkenning binnen de sportcontext.",
    fr: "Interprète l'équilibre ressenti entre l'engagement et la reconnaissance dans le contexte sportif.",
    en: "Interpret the perceived balance between effort and recognition within the sport context.",
    es: "Interpreta el equilibrio percibido entre el esfuerzo y el reconocimiento en el contexto deportivo.",
    ru: "Истолкуйте воспринимаемый баланс между отдачей и признанием в спортивном контексте.",
  },
  "Mentale zelfinvestering": {
    nl: "Duid de bereidheid van de atleet om mentaal in zichzelf te investeren.",
    fr: "Interprète la disposition de l'athlète à investir mentalement en soi-même.",
    en: "Interpret the athlete's willingness to invest mentally in themselves.",
    es: "Interpreta la disposición del atleta a invertir mentalmente en sí mismo.",
    ru: "Истолкуйте готовность спортсмена ментально вкладываться в себя.",
  },
  "Club-investering in de atleet": {
    nl: "Duid hoe de atleet de investering van de club of ploeg in zichzelf ervaart.",
    fr: "Interprète comment l'athlète ressent l'investissement du club ou de l'équipe en lui-même.",
    en: "Interpret how the athlete experiences the investment of the club or team in them.",
    es: "Interpreta cómo el atleta vive la inversión del club o el equipo en él.",
    ru: "Истолкуйте, как спортсмен воспринимает вклад клуба или команды в него.",
  },
};

// Vaste volgorde/lijst van beheerbare T4Sports-ankers (voor de admin-lijst).
const ANKER_DIMENSIES_T4SPORTS: { dimensie: string; familie: string }[] = [
  { dimensie: "Be Perfect", familie: "Drivers" },
  { dimensie: "Be Strong", familie: "Drivers" },
  { dimensie: "Hurry Up", familie: "Drivers" },
  { dimensie: "Please Others", familie: "Drivers" },
  { dimensie: "Try Hard", familie: "Drivers" },
  { dimensie: "Functioneel Innovatief", familie: "Talent-foci" },
  { dimensie: "Artistiek Innovatief", familie: "Talent-foci" },
  { dimensie: "Complexiteit/Conceptueel", familie: "Talent-foci" },
  { dimensie: "Systematisch/Uitvoerend", familie: "Talent-foci" },
  { dimensie: "Sociaal Interactief", familie: "Talent-foci" },
  { dimensie: "Overdrachtelijk Interactief", familie: "Talent-foci" },
  { dimensie: "Analyse", familie: "Talent-versnellers" },
  { dimensie: "Individueel ondersteunend", familie: "Talent-versnellers" },
  { dimensie: "Groepsondersteunend", familie: "Talent-versnellers" },
  { dimensie: "Impact", familie: "Talent-versnellers" },
  { dimensie: "Resultaat", familie: "Talent-versnellers" },
  { dimensie: "Constructief onderscheidend", familie: "Talent-versnellers" },
  { dimensie: "Sportpassie", familie: "Verbindingsvragen" },
  { dimensie: "Billijkheid in sport", familie: "Verbindingsvragen" },
  { dimensie: "Mentale zelfinvestering", familie: "Verbindingsvragen" },
  { dimensie: "Club-investering in de atleet", familie: "Verbindingsvragen" },
];

// ─── Instrument-registry — koppelt instrument-id aan zijn concept-defaults ──────
// T4P blijft de default (backwards compatibel). Nieuwe instrumenten worden hier
// bijgeschreven zonder de bestaande T4P-leeslogica te wijzigen.
interface DuidingInstrumentDef {
  regie: Record<Taal, string>;
  ankers: Record<string, Record<Taal, string>>;
  dimensies: { dimensie: string; familie: string }[];
  label: string;
}
const DUIDING_INSTRUMENTEN: Record<string, DuidingInstrumentDef> = {
  [DUIDING_INSTRUMENT]: {
    regie: CONCEPT_REGIE_PROMPT,
    ankers: CONCEPT_ANKERS,
    dimensies: ANKER_DIMENSIES,
    label: "T4P Business Kompas",
  },
  [T4SPORTS_INSTRUMENT]: {
    regie: CONCEPT_REGIE_PROMPT_T4SPORTS,
    ankers: CONCEPT_ANKERS_T4SPORTS,
    dimensies: ANKER_DIMENSIES_T4SPORTS,
    label: "T4Sports",
  },
};

// Normaliseert een instrument-id; onbekend → T4P (backwards compatibel).
function normInstrument(x: unknown): string {
  const s = String(x ?? "");
  return DUIDING_INSTRUMENTEN[s] ? s : DUIDING_INSTRUMENT;
}

// Codeert het instrument in de scope-string. T4P houdt de kale scope ("anker",
// "regie-prompt", "config") → bestaande DB-rijen blijven geldig. Andere
// instrumenten krijgen "scope:instrument" (UNIQUE(scope,dimensie,taal) blijft werken).
function scopeVoor(base: string, instrument: string): string {
  const inst = normInstrument(instrument);
  return inst === DUIDING_INSTRUMENT ? base : `${base}:${inst}`;
}

// Lijst van beheerbare instrumenten (voor de admin-UI).
export function getDuidingInstrumenten(): { id: string; label: string }[] {
  return Object.entries(DUIDING_INSTRUMENTEN).map(([id, def]) => ({ id, label: def.label }));
}

const REGIE_SCOPE = "regie-prompt";
const ANKER_SCOPE = "anker";
const CONFIG_SCOPE = "config";
const REGIE_DIMENSIE = "__algemeen__";
// Globale aan/uit-vlag voor de pilot. Default = UIT (veilig voor pilot).
const LIVE_FLAG_DIMENSIE = "live-duiding-aan";
const LIVE_FLAG_TAAL = "*";

function normTaal(x: unknown): Taal {
  return (TALEN as readonly string[]).includes(String(x)) ? (x as Taal) : "nl";
}

// ─── SQLite voor overschrijvingen (lazy init — spiegel van question-manager.ts) ─

function getSqlite() {
  return (db as any)._db ?? (storage as any).sqlite ?? null;
}

function ensureDuidingTable() {
  try {
    const sqlite = getSqlite();
    if (sqlite) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS duiding_overschrijvingen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL,
          dimensie TEXT NOT NULL,
          taal TEXT NOT NULL,
          tekst TEXT NOT NULL,
          gewijzigd_door TEXT NOT NULL,
          gewijzigd_op TEXT NOT NULL,
          UNIQUE(scope, dimensie, taal)
        )
      `);
    }
  } catch (e) {
    console.error("[DM] Tabel aanmaken mislukt:", e);
  }
}

function getOverride(scope: string, dimensie: string, taal: string): string | null {
  ensureDuidingTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return null;
    const row = sqlite
      .prepare("SELECT tekst FROM duiding_overschrijvingen WHERE scope = ? AND dimensie = ? AND taal = ?")
      .get(scope, dimensie, taal) as { tekst: string } | undefined;
    return row?.tekst ?? null;
  } catch {
    return null;
  }
}

function saveOverride(scope: string, dimensie: string, taal: string, tekst: string, gewijzigdDoor: string) {
  ensureDuidingTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) throw new Error("geen sqlite");
    const now = new Date().toISOString();
    sqlite
      .prepare(`
        INSERT INTO duiding_overschrijvingen (scope, dimensie, taal, tekst, gewijzigd_door, gewijzigd_op)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope, dimensie, taal) DO UPDATE SET
          tekst = excluded.tekst,
          gewijzigd_door = excluded.gewijzigd_door,
          gewijzigd_op = excluded.gewijzigd_op
      `)
      .run(scope, dimensie, taal, tekst, gewijzigdDoor, now);
    return true;
  } catch (e) {
    console.error("[DM] Override opslaan mislukt:", e);
    return false;
  }
}

function deleteOverride(scope: string, dimensie: string, taal: string) {
  ensureDuidingTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return false;
    sqlite
      .prepare("DELETE FROM duiding_overschrijvingen WHERE scope = ? AND dimensie = ? AND taal = ?")
      .run(scope, dimensie, taal);
    return true;
  } catch {
    return false;
  }
}

function getAuditLog(scope?: string, dimensie?: string) {
  ensureDuidingTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return [];
    if (scope && dimensie) {
      return sqlite
        .prepare(
          "SELECT scope, dimensie, taal, tekst, gewijzigd_door, gewijzigd_op FROM duiding_overschrijvingen WHERE scope = ? AND dimensie = ? ORDER BY gewijzigd_op DESC",
        )
        .all(scope, dimensie);
    }
    return sqlite
      .prepare(
        "SELECT scope, dimensie, taal, tekst, gewijzigd_door, gewijzigd_op FROM duiding_overschrijvingen ORDER BY gewijzigd_op DESC",
      )
      .all();
  } catch {
    return [];
  }
}

// ─── CSV helper (spiegel van question-manager.ts) ─────────────────────────────

function escapeCSV(val: string | null | undefined): string {
  if (val == null) return '""';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function logToCSV(rows: any[]): string {
  const header = ["scope", "dimensie", "taal", "tekst", "gewijzigd_door", "gewijzigd_op"].join(";");
  const lines = rows.map((r) =>
    [
      escapeCSV(r.scope),
      escapeCSV(r.dimensie),
      escapeCSV(r.taal),
      escapeCSV(r.tekst),
      escapeCSV(r.gewijzigd_door),
      escapeCSV(r.gewijzigd_op),
    ].join(";"),
  );
  return [header, ...lines].join("\r\n");
}

// ─── Publieke lees-interface: override wint op leestijd, default = live bron ──

export function getRegiePrompt(taal: string, instrument: string = DUIDING_INSTRUMENT): string {
  const t = normTaal(taal);
  const inst = normInstrument(instrument);
  return getOverride(scopeVoor(REGIE_SCOPE, inst), REGIE_DIMENSIE, t) ?? DUIDING_INSTRUMENTEN[inst].regie[t];
}

export function getAnker(dimensie: string, taal: string, instrument: string = DUIDING_INSTRUMENT): string {
  const t = normTaal(taal);
  const inst = normInstrument(instrument);
  const override = getOverride(scopeVoor(ANKER_SCOPE, inst), dimensie, t);
  if (override != null) return override;
  return DUIDING_INSTRUMENTEN[inst].ankers[dimensie]?.[t] ?? "";
}

export function getAlleAnkers(taal: string, instrument: string = DUIDING_INSTRUMENT): { dimensie: string; familie: string; tekst: string; heeftOverride: boolean; origineel: string }[] {
  const t = normTaal(taal);
  const inst = normInstrument(instrument);
  return DUIDING_INSTRUMENTEN[inst].dimensies.map(({ dimensie, familie }) => {
    const origineel = DUIDING_INSTRUMENTEN[inst].ankers[dimensie]?.[t] ?? "";
    const override = getOverride(scopeVoor(ANKER_SCOPE, inst), dimensie, t);
    return {
      dimensie,
      familie,
      tekst: override ?? origineel,
      heeftOverride: override != null,
      origineel,
    };
  });
}

// Globale aan/uit-vlag PER INSTRUMENT. Default = UIT (veilig voor de pilot).
//
// AVG-context (art. 44 e.v.): deze vlag aanzetten betekent dat profieldata naar
// Google (Gemini API) gaat, buiten de EER. Aanzetten mag dus enkel wanneer er
// een verwerkersovereenkomst met Google is, een doorgiftetoets is uitgevoerd en
// de doorgifte in het verwerkingsregister van TaPasCity staat. De vlag wordt
// bewust niet via een env-variabele gezet maar via een expliciete
// override-rij, zodat de wijziging in het duidingbeheer-auditlog terechtkomt.
// Zie duidingDoorgifteRegister() voor het controleerbare overzicht.
export function isLiveDuidingAan(instrument: string = DUIDING_INSTRUMENT): boolean {
  const inst = normInstrument(instrument);
  return getOverride(scopeVoor(CONFIG_SCOPE, inst), LIVE_FLAG_DIMENSIE, LIVE_FLAG_TAAL) === "true";
}

// ─── AI-duidingpad (spiegel van het Vlaamse-stem/TTS-pad) ─────────────────────

// Verzamelt alle getallen die legitiem in de tekst mogen voorkomen (uit het
// contract/de statische inhoud). Dient als runtime-guardrail: als het model een
// getal bijverzint dat hier niet in zit, verwerpen we de AI-duiding en vallen we
// terug op de statische sjabloontekst.
function verzamelToegestaneGetallen(inhoud: RapportInhoud, contract: any): Set<string> {
  const set = new Set<string>();
  const voegToe = (v: unknown) => {
    const s = String(v);
    const matches = s.match(/-?\d+(?:[.,]\d+)?/g);
    if (matches) for (const m of matches) set.add(m.replace(",", "."));
  };
  for (const sec of inhoud.secties ?? []) {
    for (const rij of sec.tabel?.rijen ?? []) for (const cel of rij) voegToe(cel);
  }
  try {
    voegToe(JSON.stringify(contract?.sections?.main?.meta ?? {}));
    for (const r of contract?.sections?.main?.constructRows ?? []) voegToe(JSON.stringify(r));
    voegToe(JSON.stringify(contract?.sections?.connection?.answers ?? {}));
  } catch {}
  return set;
}

function bevatVerzonnenGetal(tekst: string, toegestaan: Set<string>): boolean {
  const matches = tekst.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches) return false;
  for (const m of matches) {
    const g = m.replace(",", ".");
    // Jaartallen/losse kleine gehele getallen ≤ 10 zijn onschuldig (schalen 0–10).
    if (toegestaan.has(g)) continue;
    const n = Number(g);
    if (Number.isInteger(n) && n >= 0 && n <= 10) continue;
    return true;
  }
  return false;
}

// Stelt de payload samen: regie-prompt(taal) + relevante ankers + het bevroren
// scorecontract + de te herschrijven sectie-prozateksten. TaPas-Beeld wordt nooit
// meegestuurd (isTapasBeeld).
function bouwAiPayload(inhoud: RapportInhoud, contract: any): string {
  const taal = normTaal(inhoud.taal);
  const regie = getRegiePrompt(taal);

  const zichtbareRows = (contract?.sections?.main?.constructRows ?? []).filter(
    (r: any) => !isTapasBeeld(r.construct),
  );
  const relevanteDimensies = new Set<string>(zichtbareRows.map((r: any) => String(r.construct)));
  for (const q of ["Psychologische verbondenheid", "Billijkheid / verloning", "Zelfinvestering", "Organisatie-investering"]) {
    if (contract?.sections?.connection?.answers) relevanteDimensies.add(q);
  }
  const ankers = ANKER_DIMENSIES.filter((a) => relevanteDimensies.has(a.dimensie))
    .map((a) => `- ${a.dimensie}: ${getAnker(a.dimensie, taal)}`)
    .filter((l) => l.trim().length > 0)
    .join("\n");

  const secties = (inhoud.secties ?? []).map((s, i) => ({ index: i, kop: s.kop, paragrafen: s.paragrafen }));

  return [
    regie,
    "",
    "ANKERS (toon-/nadrukinstructies per dimensie):",
    ankers || "(geen ankers)",
    "",
    "BEVROREN SCORECONTRACT (de enige toegestane feiten/cijfers):",
    JSON.stringify(contract?.sections ?? {}),
    "",
    "TE HERSCHRIJVEN DUIDING (herschrijf enkel de prozateksten per sectie; behoud de betekenis van de cijfers en verzin niets bij):",
    JSON.stringify(secties),
    "",
    "OPDRACHT: Geef UITSLUITEND geldige JSON terug in exact deze vorm: " +
      '{"secties":[{"index":<nummer>,"paragrafen":["...","..."]}]}. ' +
      "Herschrijf per sectie de paragrafen zodat het unieke van dít profiel naar voren komt. " +
      "Voeg geen nieuwe getallen, percentages of feiten toe. Geen tabellen, geen markdown, geen uitleg buiten de JSON.",
  ].join("\n");
}

async function roepGeminiAan(payload: string): Promise<string | null> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return null; // geen key → nette fallback
  for (const model of GEMINI_MODELLEN) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const resp = await fetch(GEMINI_API_URL.replace("{model}", model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: payload }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) continue;
      const body: any = await resp.json();
      const tekst = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof tekst === "string" && tekst.trim()) return tekst;
    } catch {
      // val door naar het volgende model / uiteindelijk naar de statische fallback
    }
  }
  return null;
}

/**
 * Verrijkt de statische rapport-inhoud met een LIVE AI-duiding. Retourneert een
 * NIEUW RapportInhoud-object met enkel herschreven prozateksten (cijfers/tabellen
 * blijven identiek), of `null` als de AI faalt/traag is/geen key heeft/de
 * guardrail-check faalt. Bij `null` behoudt de aanroeper de statische inhoud
 * (meerlaagse fallback naar bouwRapportInhoud — een afname blokkeert nooit).
 */
export async function genereerAiDuiding(
  inhoud: RapportInhoud,
  contract: any,
): Promise<RapportInhoud | null> {
  try {
    const payload = bouwAiPayload(inhoud, contract);
    // Defensieve pseudonimiseringspoort (AVG art. 5.1.c en art. 32): weiger de
    // doorgifte zodra er iets identificeerbaars in de payload staat. Geen
    // doorgifte betekent statische tekst, niet een mislukte afname.
    const keuring = keurPayloadGoed(payload, contract);
    if (!keuring.ok) {
      console.error(
        `[duiding] Doorgifte geweigerd door pseudonimiseringspoort: ${keuring.redenen.join("; ")}`,
      );
      return null;
    }
    const antwoord = await roepGeminiAan(payload);
    if (!antwoord) return null;

    let geparsed: any;
    try {
      geparsed = JSON.parse(antwoord);
    } catch {
      // Soms komt de JSON met omringende tekst; probeer het object eruit te snijden.
      const m = antwoord.match(/\{[\s\S]*\}/);
      if (!m) return null;
      geparsed = JSON.parse(m[0]);
    }
    const aiSecties: any[] = Array.isArray(geparsed?.secties) ? geparsed.secties : [];
    if (aiSecties.length === 0) return null;

    const toegestaan = verzamelToegestaneGetallen(inhoud, contract);
    const nieuweSecties = inhoud.secties.map((sec, i) => {
      const ai = aiSecties.find((a) => Number(a.index) === i);
      if (!ai || !Array.isArray(ai.paragrafen) || ai.paragrafen.length === 0) return sec;
      const paragrafen = ai.paragrafen.map((p: unknown) => String(p ?? "").trim()).filter(Boolean);
      // Guardrail: geen verzonnen getallen buiten het contract.
      if (paragrafen.some((p: string) => bevatVerzonnenGetal(p, toegestaan))) return sec;
      return { ...sec, paragrafen };
    });

    return { ...inhoud, secties: nieuweSecties };
  } catch {
    return null; // welke fout dan ook → statische fallback
  }
}

/**
 * Keurt de payload die voor dit rapport naar Gemini zou gaan, zonder iets te
 * verzenden. Bedoeld voor tests en voor een controleerbare, aantoonbare
 * pseudonimiseringscheck (AVG art. 5.2): een beheerder kan hiermee vaststellen
 * dat de payload geen persoonsgegevens bevat.
 */
export function keurDuidingPayload(inhoud: RapportInhoud, contract: any) {
  return keurPayloadGoed(bouwAiPayload(inhoud, contract), contract);
}

/**
 * Controleerbaar doorgifteregister (AVG art. 30): per instrument of live-duiding
 * aan staat en dus of er profieldata naar Google gaat. Dit is de bron voor het
 * verwerkingsregister en voor de admin-UI.
 */
export function duidingDoorgifteRegister(): DoorgifteRegel[] {
  return bouwDoorgifteRegister(getDuidingInstrumenten(), (id) => isLiveDuidingAan(id));
}

// ─── T4Sports AI-duiding (ADDITIEF) ───────────────────────────────────────────
// T4Sports heeft GEEN RapportInhoud-object: de builders geven direct HTML terug.
// We voegen daarom een EXTRA duidingssectie toe ná de statische HTML, zonder ook
// maar één bestaand blok, cijfer of SVG te wijzigen. Faalt de AI → originele HTML.

// Verzamelt alle getallen die legitiem uit het T4Sports-contract komen. Guardrail:
// verzint het model een getal dat hier niet in zit (en niet 0–10 is), dan verwerpen
// we de AI-duiding en behouden we de originele statische HTML.
function verzamelToegestaneGetallenT4Sports(contract: any): Set<string> {
  const set = new Set<string>();
  const voegToe = (v: unknown) => {
    const matches = String(v).match(/-?\d+(?:[.,]\d+)?/g);
    if (matches) for (const m of matches) set.add(m.replace(",", "."));
  };
  try {
    voegToe(JSON.stringify(contract?.sections?.meta ?? {}));
    for (const r of contract?.sections?.main?.constructRows ?? []) voegToe(JSON.stringify(r));
    for (const r of contract?.sections?.main?.familyRows ?? []) voegToe(JSON.stringify(r));
    voegToe(JSON.stringify(contract?.sections?.connection ?? {}));
  } catch {}
  return set;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Stelt de T4Sports-payload samen: regie-prompt(taal, t4sports) + de relevante
// ankers (enkel de dimensies die in dit contract voorkomen) + het bevroren
// scorecontract. Vraagt het model om een duidingssectie in proza (geen cijfers).
function bouwT4SportsPayload(contract: any, taal: Taal): string {
  const regie = getRegiePrompt(taal, T4SPORTS_INSTRUMENT);

  const aanwezig = new Set<string>(
    (contract?.sections?.main?.constructRows ?? []).map((r: any) => String(r.construct)),
  );
  if (contract?.sections?.connection?.answers) {
    for (const d of ["Sportpassie", "Billijkheid in sport", "Mentale zelfinvestering", "Club-investering in de atleet"]) {
      aanwezig.add(d);
    }
  }
  const ankers = ANKER_DIMENSIES_T4SPORTS.filter((a) => aanwezig.has(a.dimensie))
    .map((a) => `- ${a.dimensie} (${a.familie}): ${getAnker(a.dimensie, taal, T4SPORTS_INSTRUMENT)}`)
    .filter((l) => l.trim().length > 0)
    .join("\n");

  return [
    regie,
    "",
    "ANKERS (toon-/nadrukinstructies per aanwezige dimensie):",
    ankers || "(geen ankers)",
    "",
    "BEVROREN SCORECONTRACT (de enige toegestane feiten/cijfers):",
    JSON.stringify(contract?.sections ?? {}),
    "",
    "OPDRACHT: Geef UITSLUITEND geldige JSON terug in exact deze vorm: " +
      '{"titel":"<korte titel>","paragrafen":["...","..."]}. ' +
      "Schrijf 2 tot 4 alinea's coachende duiding die het unieke van dít sportprofiel naar voren brengen. " +
      "Voeg GEEN nieuwe getallen, percentages of feiten toe. Geen tabellen, geen markdown, geen uitleg buiten de JSON.",
  ].join("\n");
}

/**
 * Verrijkt de statische T4Sports-HTML met een EXTRA AI-duidingssectie. Retourneert
 * de originele HTML ongewijzigd wanneer: live-duiding voor t4sports UIT staat, het
 * contract niet t4sports is, de AI faalt/traag is/geen key heeft, of de
 * getallen-guardrail faalt. Een afname/rapport blokkeert dus NOOIT.
 */
export async function verrijkT4SportsRapport(html: string, contract: any): Promise<string> {
  try {
    if (!html || typeof html !== "string") return html;
    if (contract?.instrumentId !== T4SPORTS_INSTRUMENT) return html;
    if (!isLiveDuidingAan(T4SPORTS_INSTRUMENT)) return html;

    const taal = normTaal(contract?.taal);
    const payload = bouwT4SportsPayload(contract, taal);
    // Zelfde pseudonimiseringspoort als het T4P-pad: dit is het tweede
    // verzendpad naar Gemini en mag niet minder streng zijn.
    const keuring = keurPayloadGoed(payload, contract);
    if (!keuring.ok) {
      console.error(
        `[duiding] T4Sports-doorgifte geweigerd door pseudonimiseringspoort: ${keuring.redenen.join("; ")}`,
      );
      return html;
    }
    const antwoord = await roepGeminiAan(payload);
    if (!antwoord) return html;

    let geparsed: any;
    try {
      geparsed = JSON.parse(antwoord);
    } catch {
      const m = antwoord.match(/\{[\s\S]*\}/);
      if (!m) return html;
      geparsed = JSON.parse(m[0]);
    }
    const paragrafenRaw: unknown[] = Array.isArray(geparsed?.paragrafen) ? geparsed.paragrafen : [];
    const paragrafen = paragrafenRaw.map((p) => String(p ?? "").trim()).filter(Boolean);
    if (paragrafen.length === 0) return html;

    // Guardrail: geen verzonnen getallen buiten het contract.
    const toegestaan = verzamelToegestaneGetallenT4Sports(contract);
    const titel = String(geparsed?.titel ?? "").trim();
    if (bevatVerzonnenGetal(titel, toegestaan)) return html;
    if (paragrafen.some((p) => bevatVerzonnenGetal(p, toegestaan))) return html;

    const kop = titel || "AI-duiding";
    const sectie =
      `\n<section class="ai-duiding-t4sports" style="margin:24px 0;padding:16px 20px;border-left:4px solid #2a6;background:#f6faf7;">` +
      `<h2 style="margin-top:0;">${escapeHtml(kop)}</h2>` +
      paragrafen.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
      `</section>\n`;

    // Additief invoegen vóór het afsluitende </body> (bestaande blokken ongemoeid).
    const idx = html.lastIndexOf("</body>");
    if (idx === -1) return html + sectie;
    return html.slice(0, idx) + sectie + html.slice(idx);
  } catch {
    return html; // welke fout dan ook → originele statische HTML
  }
}

// ─── Route builder (spiegel van buildQuestionManagerRoutes) ───────────────────

export function buildDuidingManagerRoutes(app: any) {
  // ── CSV export van het volledige audit-log ────────────────────────────────
  app.get("/api/admin/duidingbeheer/export/csv", requirePrior, async (_req: Request, res: Response) => {
    const rows = getAuditLog() as any[];
    const csv = logToCSV(rows);
    const filename = `duidingbeheer-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("﻿" + csv); // BOM voor Excel-compatibiliteit
  });

  // ── Lijst beheerbare instrumenten (voor de admin-selector) ────────────────
  // Additief: eigen segment, geregistreerd VÓÓR /:taal zodat het niet als taal matcht.
  app.get("/api/admin/duidingbeheer/instrumenten", requirePrior, async (_req: Request, res: Response) => {
    res.json({ instrumenten: getDuidingInstrumenten() });
  });

  // ── Doorgifteregister (AVG art. 30): welke instrumenten sturen data naar
  // Google en welke niet. Eigen segment, ook vóór /:taal geregistreerd.
  app.get("/api/admin/duidingbeheer/doorgifteregister", requirePrior, async (_req: Request, res: Response) => {
    res.json({
      verwerkingsverantwoordelijke: "TaPasCity, Wijnegem",
      opgemaaktOp: new Date().toISOString(),
      regels: duidingDoorgifteRegister(),
    });
  });

  // ── Lees regie-prompt + ankers + aan/uit-vlag voor één taal (per instrument) ─
  app.get("/api/admin/duidingbeheer/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const inst = normInstrument(req.query.instrument);
    const regieOverride = getOverride(scopeVoor(REGIE_SCOPE, inst), REGIE_DIMENSIE, taal);
    res.json({
      taal,
      instrument: inst,
      liveDuidingAan: isLiveDuidingAan(inst),
      regiePrompt: {
        tekst: regieOverride ?? DUIDING_INSTRUMENTEN[inst].regie[taal],
        heeftOverride: regieOverride != null,
        origineel: DUIDING_INSTRUMENTEN[inst].regie[taal],
      },
      ankers: getAlleAnkers(taal, inst),
    });
  });

  // ── Zet de globale aan/uit-vlag (per instrument) ──────────────────────────
  app.put("/api/admin/duidingbeheer/config/live", requirePrior, async (req: Request, res: Response) => {
    const { aan } = req.body as { aan: boolean };
    const inst = normInstrument(req.query.instrument ?? (req.body as any)?.instrument);
    const beheerder = (req as any).beheerder;
    const ok = saveOverride(scopeVoor(CONFIG_SCOPE, inst), LIVE_FLAG_DIMENSIE, LIVE_FLAG_TAAL, aan ? "true" : "false", beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, instrument: inst, liveDuidingAan: isLiveDuidingAan(inst) });
  });

  // ── Sla de regie-prompt op voor één taal (per instrument) ─────────────────
  app.put("/api/admin/duidingbeheer/regie-prompt/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const inst = normInstrument(req.query.instrument ?? (req.body as any)?.instrument);
    const { tekst } = req.body as { tekst: string };
    const beheerder = (req as any).beheerder;
    if (!tekst?.trim()) return res.status(400).json({ error: "tekst is verplicht." });
    const ok = saveOverride(scopeVoor(REGIE_SCOPE, inst), REGIE_DIMENSIE, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, instrument: inst, scope: REGIE_SCOPE, taal, tekst: tekst.trim() });
  });

  // ── Herstel de regie-prompt (verwijder override, per instrument) ──────────
  app.delete("/api/admin/duidingbeheer/regie-prompt/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const inst = normInstrument(req.query.instrument ?? (req.body as any)?.instrument);
    const ok = deleteOverride(scopeVoor(REGIE_SCOPE, inst), REGIE_DIMENSIE, taal);
    res.json({ ok, instrument: inst, scope: REGIE_SCOPE, taal });
  });

  // ── Sla één anker op voor één taal (per instrument) ───────────────────────
  app.put("/api/admin/duidingbeheer/anker/:dimensie/:taal", requirePrior, async (req: Request, res: Response) => {
    const dimensie = req.params.dimensie as string;
    const taal = normTaal(req.params.taal);
    const inst = normInstrument(req.query.instrument ?? (req.body as any)?.instrument);
    const { tekst } = req.body as { tekst: string };
    const beheerder = (req as any).beheerder;
    if (!DUIDING_INSTRUMENTEN[inst].ankers[dimensie]) return res.status(404).json({ error: "Onbekende dimensie." });
    if (!tekst?.trim()) return res.status(400).json({ error: "tekst is verplicht." });
    const ok = saveOverride(scopeVoor(ANKER_SCOPE, inst), dimensie, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, instrument: inst, scope: ANKER_SCOPE, dimensie, taal, tekst: tekst.trim() });
  });

  // ── Herstel één anker (verwijder override, per instrument) ────────────────
  app.delete("/api/admin/duidingbeheer/anker/:dimensie/:taal", requirePrior, async (req: Request, res: Response) => {
    const dimensie = req.params.dimensie as string;
    const taal = normTaal(req.params.taal);
    const inst = normInstrument(req.query.instrument ?? (req.body as any)?.instrument);
    const ok = deleteOverride(scopeVoor(ANKER_SCOPE, inst), dimensie, taal);
    res.json({ ok, instrument: inst, scope: ANKER_SCOPE, dimensie, taal });
  });

  // ── Audit-log voor één scope/dimensie ─────────────────────────────────────
  app.get("/api/admin/duidingbeheer/:scope/:dimensie/log", requirePrior, async (req: Request, res: Response) => {
    const scope = req.params.scope as string;
    const dimensie = req.params.dimensie as string;
    const log = getAuditLog(scope, dimensie);
    res.json({ scope, dimensie, log });
  });
}
