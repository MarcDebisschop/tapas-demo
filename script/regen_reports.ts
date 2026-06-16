// Herbouwt alle bestaande rapporten op basis van de nieuwe rijke contracten,
// en zorgt dat de Marc-showcase een kompas + coachatlas heeft.
import Database from "better-sqlite3";
import { bouwRapportInhoud, renderRapportHtml } from "../server/rapportgenerator";

const db = new Database("data.db");

// 1) Bestaande rapporten herbouwen.
const reps = db.prepare("select id, afname_id, variant from rapporten").all() as any[];
const getContract = db.prepare("select generator_contract from afnames where id=?");
const updRep = db.prepare("update rapporten set titel=?, inhoud=?, html=?, contract_versie=? where id=?");

let rebuilt = 0;
for (const r of reps) {
  const row = getContract.get(r.afname_id) as any;
  if (!row?.generator_contract) continue;
  const contract = JSON.parse(row.generator_contract);
  const inhoud = bouwRapportInhoud(contract, r.variant);
  const html = renderRapportHtml(inhoud);
  updRep.run(
    `${inhoud.titel} — ${inhoud.respondent.naam}`,
    JSON.stringify(inhoud),
    html,
    contract?.contractVersion ?? "1.0.0",
    r.id
  );
  rebuilt++;
}

// 2) Marc-showcase rapporten (kompas + coachatlas) toevoegen indien afwezig.
const marc = db.prepare("select id, generator_contract from afnames where deelnemer_email=?")
  .get("marc.debisschop@hatch-coaching.be") as any;
if (marc?.generator_contract) {
  const contract = JSON.parse(marc.generator_contract);
  const insRep = db.prepare(
    "insert into rapporten (afname_id, variant, titel, inhoud, html, contract_versie, created_at) values (?,?,?,?,?,?,?)"
  );
  const now = new Date().toISOString();
  for (const variant of ["kompas", "coachatlas"] as const) {
    const exists = db
      .prepare("select id from rapporten where afname_id=? and variant=?")
      .get(marc.id, variant);
    if (exists) continue;
    const inhoud = bouwRapportInhoud(contract, variant);
    const html = renderRapportHtml(inhoud);
    insRep.run(
      marc.id, variant, `${inhoud.titel} — ${inhoud.respondent.naam}`,
      JSON.stringify(inhoud), html, contract?.contractVersion ?? "1.0.0", now
    );
  }
}

db.close();
console.log("Rapporten herbouwd:", rebuilt);
