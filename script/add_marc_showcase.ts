// Voegt een herkenbaar, bevraagbaar showcase-profiel toe: Marc Debisschop (NL),
// met Marc's echte T4P-archetype-contract en een gecureerd chatgesprek dat de
// chatbot meteen laat 'leven'. Idempotent: verwijdert eerst een eerdere
// showcase met hetzelfde e-mailadres.
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { buildGeneratorContract } from "../server/scoring";

const sim = JSON.parse(readFileSync("/tmp/sim_out.json", "utf8")) as Record<string, any>;
const marc = sim["3"]; // Marc-archetype-antwoorden

const db = new Database("data.db");
const EMAIL = "marc.debisschop@hatch-coaching.be";
const TOKEN = "MarcDebisschopShowcaseT4P01";

// Idempotent opruimen
const oudDeel = db.prepare("select id from deelnemers where email=?").get(EMAIL) as any;
if (oudDeel) {
  db.prepare("delete from chat_berichten where deelnemer_id=?").run(oudDeel.id);
  db.prepare("delete from deelnemers where id=?").run(oudDeel.id);
}
const oudAfn = db.prepare("select id from afnames where deelnemer_email=?").get(EMAIL) as any;
if (oudAfn) {
  db.prepare("delete from rapporten where afname_id=?").run(oudAfn.id);
  db.prepare("delete from afnames where id=?").run(oudAfn.id);
}

const now = new Date().toISOString();
const contract = buildGeneratorContract({
  respondentCode: "MD-2026-001",
  name: "Marc Debisschop",
  company: "HATCH Coaching & Leadership",
  role: "Oprichter & Strategisch adviseur",
  consentScope: "profiel-generatie + rapport + chat",
  consentTimestamp: now,
  responses: marc.main_responses,
  baseline: marc.baseline,
  connection: marc.connection,
  taal: "nl",
});

const afnameId = (db.prepare("select max(id) m from afnames").get() as any).m + 1;
db.prepare(
  `insert into afnames (id, organisatie_id, respondent_code, name, company, role,
     consent_given, consent_scope, consent_timestamp, baseline_energy, taal, status,
     main_responses, connection_answers, generator_contract, created_at, completed_at,
     verwerkingsdoel, rechtsgrond, privacyverklaring_versie, deelnemer_email)
   values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
).run(
  afnameId, 2, "MD-2026-001", "Marc Debisschop", "HATCH Coaching & Leadership",
  "Oprichter & Strategisch adviseur", 1, "profiel-generatie + rapport + chat", now,
  marc.baseline, "nl", "voltooid", JSON.stringify(marc.main_responses),
  JSON.stringify(marc.connection), JSON.stringify(contract), now, now,
  "talentprofiel + coaching", "toestemming", "v1.3", EMAIL
);

const deelId = (db.prepare("select max(id) m from deelnemers").get() as any).m + 1;
db.prepare(
  `insert into deelnemers (id, email, naam, taal, dashboard_token, mail_cadans,
     vragen_gebruikt, vragen_tegoed, created_at)
   values (?,?,?,?,?,?,?,?,?)`
).run(deelId, EMAIL, "Marc Debisschop", "nl", TOKEN, "wekelijks", 3, 25, now);

// Gecureerd chatgesprek dat de chatbot direct toont.
const chat: Array<[string, string, string | null]> = [
  [
    "user",
    "Waar verloopt mijn werk het meest moeiteloos volgens dit profiel?",
    null,
  ],
  [
    "assistant",
    "Je sterkste talentfoci liggen in het operationele en het inter-relationele veld, en je versterkt dat met een uitgesproken analytisch-coachende stijl (Analyse en Coaching scoren het hoogst). Concreet: werk waarin je grondig analyseert, kwaliteit bewaakt en mensen één-op-één begeleidt voelt het meest vanzelfsprekend. Wil je een week energiek blijven, plan dan bewust taken die expliciet op die combinatie een beroep doen. Dit is een reflectiehulp, geen diagnose.",
    null,
  ],
  [
    "user",
    "Mijn energie tijdens de vragenlijst lag hoger dan ik vooraf inschatte. Wat zegt dat?",
    null,
  ],
  [
    "assistant",
    "Je schatte je startenergie laag in (2/10), terwijl de gemeten vragenlijst-energie rond 5,5/10 uitkwam — een positief verschil. Dat patroon zie je vaker bij mensen met een sterke Be Perfect-driver: je bent strenger voor jezelf dan de situatie vraagt. De herkenbaarheid van je beeld is hoog (91/100), dus het profiel is betrouwbaar. Een nuttige reflectie: waar onderschat je structureel hoeveel energie iets je eigenlijk geeft? Dit is een reflectiehulp, geen diagnose.",
    null,
  ],
  [
    "user",
    "Welke driver kost me het meest energie en hoe ga ik daarmee om?",
    null,
  ],
  [
    "assistant",
    "Be Perfect is je meest dominante driver en die kost je netto energie. Dat maakt je werk nauwkeurig en betrouwbaar, maar het kan ook remmen wanneer 'goed genoeg' eigenlijk volstaat. Een praktische oefening: kies deze week één taak waarbij je bewust een lager afwerkingsniveau toelaat en merk op wat er met je energie gebeurt. Je gaspedaal — Try Hard — geeft je daarentegen energie; daar mag je dus op leunen. Dit is een reflectiehulp, geen diagnose.",
    null,
  ],
];
const ins = db.prepare(
  "insert into chat_berichten (deelnemer_id, rol, inhoud, veiligheid, created_at) values (?,?,?,?,?)"
);
for (const [rol, inhoud, veiligheid] of chat) {
  ins.run(deelId, rol, inhoud, veiligheid, now);
}

db.close();
console.log("Marc-showcase toegevoegd: afname", afnameId, "deelnemer", deelId, "token", TOKEN);
