// Herbouwt rijke generator_contracts via de ECHTE scoring-engine.
// Leest /tmp/sim_out.json (gesimuleerde, gecorrigeerde antwoorden), draait
// buildGeneratorContract per afname, en schrijft main_responses +
// generator_contract terug naar data.db.
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { buildGeneratorContract } from "../server/scoring";

const sim = JSON.parse(readFileSync("/tmp/sim_out.json", "utf8")) as Record<
  string,
  { main_responses: any; baseline: number; connection: any }
>;

const db = new Database("data.db");
const rows = db
  .prepare(
    "select id, name, company, role, taal, consent_scope, consent_timestamp, respondent_code from afnames where status='voltooid'"
  )
  .all() as any[];

const upd = db.prepare(
  "update afnames set main_responses=?, baseline_energy=?, connection_answers=?, generator_contract=? where id=?"
);

let done = 0;
const tx = db.transaction(() => {
  for (const r of rows) {
    const s = sim[String(r.id)];
    if (!s) continue;
    const contract = buildGeneratorContract({
      respondentCode: r.respondent_code ?? `RES-${r.id}`,
      name: r.name ?? "Deelnemer",
      company: r.company,
      role: r.role,
      consentScope: r.consent_scope,
      consentTimestamp: r.consent_timestamp,
      responses: s.main_responses,
      baseline: s.baseline,
      connection: s.connection,
      taal: r.taal,
    });
    upd.run(
      JSON.stringify(s.main_responses),
      s.baseline,
      JSON.stringify(s.connection),
      JSON.stringify(contract),
      r.id
    );
    done++;
  }
});
tx();
db.close();
console.log("Contracts herbouwd:", done);
