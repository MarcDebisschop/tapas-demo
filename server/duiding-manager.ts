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

export function getRegiePrompt(taal: string): string {
  const t = normTaal(taal);
  return getOverride(REGIE_SCOPE, REGIE_DIMENSIE, t) ?? CONCEPT_REGIE_PROMPT[t];
}

export function getAnker(dimensie: string, taal: string): string {
  const t = normTaal(taal);
  const override = getOverride(ANKER_SCOPE, dimensie, t);
  if (override != null) return override;
  return CONCEPT_ANKERS[dimensie]?.[t] ?? "";
}

export function getAlleAnkers(taal: string): { dimensie: string; familie: string; tekst: string; heeftOverride: boolean; origineel: string }[] {
  const t = normTaal(taal);
  return ANKER_DIMENSIES.map(({ dimensie, familie }) => {
    const origineel = CONCEPT_ANKERS[dimensie]?.[t] ?? "";
    const override = getOverride(ANKER_SCOPE, dimensie, t);
    return {
      dimensie,
      familie,
      tekst: override ?? origineel,
      heeftOverride: override != null,
      origineel,
    };
  });
}

// Globale aan/uit-vlag. Default = UIT (veilig voor de pilot).
export function isLiveDuidingAan(): boolean {
  return getOverride(CONFIG_SCOPE, LIVE_FLAG_DIMENSIE, LIVE_FLAG_TAAL) === "true";
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

  // ── Lees regie-prompt + ankers + aan/uit-vlag voor één taal ───────────────
  app.get("/api/admin/duidingbeheer/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const regieOverride = getOverride(REGIE_SCOPE, REGIE_DIMENSIE, taal);
    res.json({
      taal,
      instrument: DUIDING_INSTRUMENT,
      liveDuidingAan: isLiveDuidingAan(),
      regiePrompt: {
        tekst: regieOverride ?? CONCEPT_REGIE_PROMPT[taal],
        heeftOverride: regieOverride != null,
        origineel: CONCEPT_REGIE_PROMPT[taal],
      },
      ankers: getAlleAnkers(taal),
    });
  });

  // ── Zet de globale aan/uit-vlag ───────────────────────────────────────────
  app.put("/api/admin/duidingbeheer/config/live", requirePrior, async (req: Request, res: Response) => {
    const { aan } = req.body as { aan: boolean };
    const beheerder = (req as any).beheerder;
    const ok = saveOverride(CONFIG_SCOPE, LIVE_FLAG_DIMENSIE, LIVE_FLAG_TAAL, aan ? "true" : "false", beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, liveDuidingAan: isLiveDuidingAan() });
  });

  // ── Sla de regie-prompt op voor één taal ──────────────────────────────────
  app.put("/api/admin/duidingbeheer/regie-prompt/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const { tekst } = req.body as { tekst: string };
    const beheerder = (req as any).beheerder;
    if (!tekst?.trim()) return res.status(400).json({ error: "tekst is verplicht." });
    const ok = saveOverride(REGIE_SCOPE, REGIE_DIMENSIE, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, scope: REGIE_SCOPE, taal, tekst: tekst.trim() });
  });

  // ── Herstel de regie-prompt (verwijder override) ──────────────────────────
  app.delete("/api/admin/duidingbeheer/regie-prompt/:taal", requirePrior, async (req: Request, res: Response) => {
    const taal = normTaal(req.params.taal);
    const ok = deleteOverride(REGIE_SCOPE, REGIE_DIMENSIE, taal);
    res.json({ ok, scope: REGIE_SCOPE, taal });
  });

  // ── Sla één anker op voor één taal ────────────────────────────────────────
  app.put("/api/admin/duidingbeheer/anker/:dimensie/:taal", requirePrior, async (req: Request, res: Response) => {
    const dimensie = req.params.dimensie as string;
    const taal = normTaal(req.params.taal);
    const { tekst } = req.body as { tekst: string };
    const beheerder = (req as any).beheerder;
    if (!CONCEPT_ANKERS[dimensie]) return res.status(404).json({ error: "Onbekende dimensie." });
    if (!tekst?.trim()) return res.status(400).json({ error: "tekst is verplicht." });
    const ok = saveOverride(ANKER_SCOPE, dimensie, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, scope: ANKER_SCOPE, dimensie, taal, tekst: tekst.trim() });
  });

  // ── Herstel één anker (verwijder override) ────────────────────────────────
  app.delete("/api/admin/duidingbeheer/anker/:dimensie/:taal", requirePrior, async (req: Request, res: Response) => {
    const dimensie = req.params.dimensie as string;
    const taal = normTaal(req.params.taal);
    const ok = deleteOverride(ANKER_SCOPE, dimensie, taal);
    res.json({ ok, scope: ANKER_SCOPE, dimensie, taal });
  });

  // ── Audit-log voor één scope/dimensie ─────────────────────────────────────
  app.get("/api/admin/duidingbeheer/:scope/:dimensie/log", requirePrior, async (req: Request, res: Response) => {
    const scope = req.params.scope as string;
    const dimensie = req.params.dimensie as string;
    const log = getAuditLog(scope, dimensie);
    res.json({ scope, dimensie, log });
  });
}
