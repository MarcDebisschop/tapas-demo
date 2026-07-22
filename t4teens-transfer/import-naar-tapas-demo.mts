/**
 * Importeert de 13 echte T4Teens-afnames van 17 juli in de tapas-demo database.
 *
 * DRAAIEN (in de projectmap van tapas-demo, bv. Render Shell):
 *     ./node_modules/.bin/tsx t4teens-transfer/import-naar-tapas-demo.mts
 *   of lokaal met expliciete DB:
 *     TAPAS_DB_PATH=/data/data.db ./node_modules/.bin/tsx <pad>/import-naar-tapas-demo.mts
 *
 * Veilig & idempotent:
 *  - Slaat een record over als er al een voltooide t4teens-afname bestaat met
 *    dezelfde name + completed_at (dubbele import onmogelijk).
 *  - Nieuwe id's door SQLite; verse respondent_code + invite_token (geen botsing).
 *  - Herberekent het VOLLEDIGE generator_contract uit de originele antwoorden via
 *    dezelfde buildT4TeensContract die het platform gebruikt -> correct rapport.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { buildT4TeensContract } from "../server/t4teens/scoring";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.TAPAS_DB_PATH || path.join(process.cwd(), "data.db");
const EXPORT = path.join(__dirname, "t4teens-17juli-export.json");

if (!fs.existsSync(EXPORT)) {
  console.error("Export-bestand niet gevonden:", EXPORT);
  process.exit(1);
}
const records: any[] = JSON.parse(fs.readFileSync(EXPORT, "utf8"));
const db = new Database(DB_PATH);
console.log("Database:", DB_PATH);
console.log("Te importeren records:", records.length, "\n");

const seg = () => crypto.randomBytes(6).toString("base64url").slice(0, 8);
const tok = () => `${seg()}-${seg()}-${seg()}`;
const respCode = (name: string, id: number) => {
  const ini = String(name || "XX").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "XXX";
  return `${ini}-T4T-${id}`;
};

const findDup = db.prepare(
  "SELECT id FROM afnames WHERE name = ? AND completed_at = ? AND instrument_id = 't4teens'"
);
const insert = db.prepare(`
  INSERT INTO afnames (
    organisatie_id, respondent_code, name, company, role,
    consent_given, consent_scope, consent_timestamp,
    baseline_energy, taal, status,
    main_responses, connection_answers, generator_contract,
    created_at, completed_at,
    verwerkingsdoel, rechtsgrond, privacyverklaring_versie,
    consent_ip, consent_user_agent, bewaartot_datum,
    invite_token, uitgenodigd_at, deelnemer_email, instrument_id
  ) VALUES (
    @organisatie_id, @respondent_code, @name, @company, @role,
    @consent_given, @consent_scope, @consent_timestamp,
    @baseline_energy, @taal, @status,
    @main_responses, @connection_answers, @generator_contract,
    @created_at, @completed_at,
    @verwerkingsdoel, @rechtsgrond, @privacyverklaring_versie,
    @consent_ip, @consent_user_agent, @bewaartot_datum,
    @invite_token, @uitgenodigd_at, @deelnemer_email, @instrument_id
  )
`);
const setCode = db.prepare("UPDATE afnames SET respondent_code = ? WHERE id = ?");

let imported = 0, skipped = 0;
const tx = db.transaction(() => {
  for (const r of records) {
    const dup: any = findDup.get(r.name, r.completedAt);
    if (dup) {
      console.log(`  OVERGESLAGEN (bestaat al, id ${dup.id}): ${r.name}`);
      skipped++;
      continue;
    }

    // Antwoorden -> itembank-itemId's (I1 -> T4T-I1-1) en volledig contract herberekenen.
    const mr = r.mainResponses ? JSON.parse(r.mainResponses) : { answers: {} };
    const conn = r.connectionAnswers ? JSON.parse(r.connectionAnswers) : {};
    const responses: Record<string, number> = {};
    for (const [k, v] of Object.entries(mr.answers || {})) {
      responses[`T4T-${k}-1`] = v as number;
    }
    const contract = buildT4TeensContract({
      respondentCode: r.respondentCode,
      name: r.name,
      company: r.company,
      role: r.role,
      consentScope: r.consentScope ?? "profiel-generatie + rapport",
      consentTimestamp: r.consentTimestamp ?? r.createdAt,
      responses,
      baseline: typeof r.baselineEnergy === "number" ? r.baselineEnergy : 5,
      connection: conn,
      taal: r.taal ?? "nl",
    } as any);

    const row = {
      organisatie_id: null,
      respondent_code: `TMP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: r.name,
      company: r.company ?? null,
      role: r.role ?? null,
      consent_given: 1,
      consent_scope: r.consentScope ?? "profiel-generatie + rapport",
      consent_timestamp: r.consentTimestamp ?? r.createdAt ?? null,
      baseline_energy: typeof r.baselineEnergy === "number" ? r.baselineEnergy : 5,
      taal: r.taal ?? "nl",
      status: "voltooid",
      main_responses: r.mainResponses ?? null,
      connection_answers: r.connectionAnswers ?? null,
      generator_contract: JSON.stringify(contract),
      created_at: r.createdAt ?? new Date().toISOString(),
      completed_at: r.completedAt ?? null,
      verwerkingsdoel: r.verwerkingsdoel ?? "talentprofiel + rapport",
      rechtsgrond: r.rechtsgrond ?? "toestemming",
      privacyverklaring_versie: r.privacyverklaringVersie ?? null,
      consent_ip: r.consentIp ?? null,
      consent_user_agent: r.consentUserAgent ?? null,
      bewaartot_datum: r.bewaartotDatum ?? null,
      invite_token: tok(),
      uitgenodigd_at: r.uitgenodigdAt ?? null,
      deelnemer_email: r.deelnemerEmail ?? null,
      instrument_id: r.instrumentId ?? "t4teens",
    };
    const info = insert.run(row);
    const newId = Number(info.lastInsertRowid);
    setCode.run(respCode(r.name, newId), newId);
    const meta = (contract as any)?.sections?.main?.meta;
    console.log(`  GEIMPORTEERD: ${r.name}  -> id ${newId}  (items ${meta?.completedItems}/${meta?.totalItems}, gem ${meta?.averageScore})`);
    imported++;
  }
});
tx();

console.log(`\nKlaar. Geimporteerd: ${imported} | Overgeslagen: ${skipped}`);
const totaal: any = db.prepare(
  "SELECT COUNT(*) c FROM afnames WHERE instrument_id='t4teens' AND status='voltooid'"
).get();
console.log(`Totaal voltooide t4teens-afnames nu: ${totaal.c}`);
db.close();
