// ---------------------------------------------------------------------------
// tests/role-fit-flow.test.ts
//
// De volledige weg van een Role Fit-case over HTTP: aanmaken vanuit een T4P
// Business Kompas-afname, context, bevriezen, H-BOM, twee observatoren,
// vergrendeling, integratie, besluit en rapporten. Daarnaast de toegang
// (tenant en need-to-know), de semi-blinde weergave, de embargo op de
// convergentie, de gates en gelijktijdige indiening.
//
// PDF-rendering staat hier uit (ROLE_FIT_GEEN_PDF=1); de PDF-rooktest staat
// in tests/role-fit-pdf.test.ts.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TAPAS_DB_PATH = join(tmpdir(), `tapas-role-fit-flow-${process.pid}.db`);
process.env.ROLE_FIT_GEEN_PDF = "1";

import { caseInvoer, ORILY_BRON, observatieRegels, volledigProfiel } from "./role-fit-fixture";

let F: Awaited<ReturnType<typeof import("./role-fit-fixture").opzet>>;
let orgA: number, orgB: number;
let owner: number, signer: number, reviewer: number, recruiterAdmin: number, buitenstaander: number, anderOrg: number, prior: number;
let afnameA: number, afnameB: number;

beforeAll(async () => {
  const { opzet } = await import("./role-fit-fixture");
  F = await opzet();
  orgA = await F.organisatie("Orily NV");
  orgB = await F.organisatie("Andere BV");
  owner = await F.beheerder("Olga Owner", orgA);
  signer = await F.beheerder("Sam Signer", orgA);
  reviewer = await F.beheerder("Rik Reviewer", orgA);
  recruiterAdmin = await F.beheerder("Rita Recruiter", orgA);
  buitenstaander = await F.beheerder("Bert Buiten", orgA);
  anderOrg = await F.beheerder("Anna Ander", orgB);
  prior = await F.beheerder("Pia Prior", null, true);
  afnameA = await F.afname(
    orgA,
    volledigProfiel({
      Operationeel: { net: 5, avg: 1.5 },
      Resultaatgericht: { net: 4, avg: 1.2 },
      Analyse: { net: 2, avg: 0 },
      Coaching: { net: -2, avg: -1.4 },
      Faciliteren: { net: null, avg: null },
      "Be Perfect": { net: 4, avg: -1.3 },
    }),
    "Kandidaat Orily",
  );
  afnameB = await F.afname(orgB, volledigProfiel());
});
afterAll(async () => {
  await F?.sluit();
});

async function maakCaseTotBevroren() {
  const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameA, signer, { reviewerAdminId: reviewer, recruiterAdminId: recruiterAdmin }));
  expect(r.status).toBe(201);
  const id = r.json.id as number;
  expect(r.json.ontbrekendeConstructen).toEqual(["Faciliteren"]);

  expect((await F.api(owner, "PUT", `/cases/${id}/wizard`, { doel: "De plant stabiel en veilig laten draaien.", omgeving: { sector: "voeding", regulering: "hoog" } })).status).toBe(200);
  expect((await F.api(owner, "POST", `/cases/${id}/bronnen`, { type: "text", titel: "Vacature", tekst: ORILY_BRON })).status).toBe(201);
  const ex = await F.api(owner, "POST", `/cases/${id}/context/extraheer`);
  expect(ex.status).toBe(200);
  expect(ex.json.modus).toBe("regels");
  let v = (await F.api(owner, "GET", `/cases/${id}`)).json;
  expect(v.zaak.status).toBe("CONTEXT_REVIEW");
  const voorstellen = v.claims.filter((k: any) => k.status === "proposed");
  expect(voorstellen.length).toBeGreaterThan(0);
  for (const k of voorstellen) {
    const p = await F.api(owner, "PATCH", `/cases/${id}/claims/${k.id}`, { status: "approved", versie: k.versie });
    expect(p.status).toBe(200);
  }
  const claimId = voorstellen[0].id;
  const vereisten = [
    { dimensie: "operatie", vereiste: "De dagelijkse productie in drie ploegen stabiel aansturen", niveau: "entry", kriticiteit: "critical", bronClaimIds: [claimId] },
    { dimensie: "resultaat", vereiste: "Een stabiele OEE binnen 90 dagen realiseren", niveau: "entry", kriticiteit: "critical", bronClaimIds: [] },
    { dimensie: "coaching", vereiste: "Vijf teamleiders ontwikkelen in hun rol", niveau: "developable", kriticiteit: "important", bronClaimIds: [] },
    { dimensie: "faciliteren", vereiste: "Het overleg tussen productie en kwaliteit begeleiden", niveau: "contextual", kriticiteit: "important", bronClaimIds: [] },
    { dimensie: "kwaliteitsnorm", vereiste: "Werken binnen strenge normen voor voedselveiligheid", niveau: "entry", kriticiteit: "important", bronClaimIds: [] },
    { dimensie: "analyse", vereiste: "Oorzaken van stilstand analyseren met data", niveau: "developable", kriticiteit: "supporting", bronClaimIds: [] },
    { dimensie: "gate", vereiste: "Geldig VCA-VOL-attest", niveau: "knockout", kriticiteit: "gate", bronClaimIds: [] },
  ];
  for (const x of vereisten) expect((await F.api(owner, "POST", `/cases/${id}/vereisten`, x)).status).toBe(201);

  // Zonder bevestigingen en zonder reden: geweigerd.
  expect((await F.api(owner, "POST", `/cases/${id}/freeze`, {})).status).toBe(409);
  // De gekoppelde recruiter bevestigt zelf; de eigenaar bevestigt namens de externe hiring manager.
  expect((await F.api(owner, "POST", `/cases/${id}/bevestig`, { rol: "recruiter" })).status).toBe(403);
  expect((await F.api(recruiterAdmin, "POST", `/cases/${id}/bevestig`, { rol: "recruiter" })).status).toBe(200);
  expect((await F.api(owner, "POST", `/cases/${id}/bevestig`, { rol: "hiring_manager" })).status).toBe(200);
  const fr = await F.api(owner, "POST", `/cases/${id}/freeze`, {});
  expect(fr.status).toBe(200);
  v = (await F.api(owner, "GET", `/cases/${id}`)).json;
  expect(v.zaak.status).toBe("CONTEXT_FROZEN");
  return id;
}

describe("Role Fit over HTTP: toegang", () => {
  it("weigert zonder aanmelding", async () => {
    expect((await F.api(null, "GET", "/cases")).status).toBe(401);
  });

  it("maakt geen case over een afname van een andere organisatie", async () => {
    const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameB, signer));
    expect(r.status).toBe(404);
  });

  it("weigert een ondertekenaar uit een andere organisatie", async () => {
    const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameA, anderOrg));
    expect(r.status).toBe(400);
  });

  it("vraagt dat de kandidaat geinformeerd is", async () => {
    const r = await F.api(owner, "POST", "/cases", { ...caseInvoer(afnameA, signer), kandidaatGeinformeerd: false });
    expect(r.status).toBe(400);
  });

  it("verbergt een case voor een andere organisatie (404) en voor een niet-betrokkene (403)", async () => {
    const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameA, signer));
    const id = r.json.id;
    expect((await F.api(anderOrg, "GET", `/cases/${id}`)).status).toBe(404);
    expect((await F.api(buitenstaander, "GET", `/cases/${id}`)).status).toBe(403);
    expect((await F.api(prior, "GET", `/cases/${id}`)).status).toBe(200);
    const lijst = (await F.api(buitenstaander, "GET", "/cases")).json;
    expect(lijst.find((c: any) => c.id === id)).toBeUndefined();
  });

  it("weigert een vereiste met verboden taal", async () => {
    const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameA, signer));
    const id = r.json.id;
    const x = await F.api(owner, "POST", `/cases/${id}/vereisten`, {
      dimensie: "analyse",
      vereiste: "Een kandidaat met een hoog IQ die geen diagnose van ADHD heeft",
      niveau: "entry",
      kriticiteit: "critical",
      bronClaimIds: [],
    });
    expect(x.status).toBe(422);
    expect(x.json.details.taal.length).toBeGreaterThan(0);
  });
});

describe("Role Fit over HTTP: de volledige weg", () => {
  let id: number;
  let links: { recruiter: string; hiring_manager: string };
  let oefeningIds: number[];

  it("bevriest de context en berekent fitindicaties zonder imputatie", async () => {
    id = await maakCaseTotBevroren();
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.fitItems.length).toBe(7);
    const perDim = new Map(v.vereisten.map((x: any) => [x.id, x.dimensie]));
    const fac = v.fitItems.find((f: any) => perDim.get(f.requirementId) === "faciliteren");
    expect(fac.indicatie).toBe("not_assessable");
    expect(fac.detail.net).toBeNull();
    const gate = v.fitItems.find((f: any) => perDim.get(f.requirementId) === "gate");
    expect(gate.indicatie).toBe("not_assessable");
    expect(gate.detail.gate).toBe(true);
    const op = v.fitItems.find((f: any) => perDim.get(f.requirementId) === "operatie");
    expect(op.indicatie).toBe("strong_support");
  });

  it("maakt een fitdossier en hergebruikt het bij onveranderde invoer", async () => {
    const a = await F.api(owner, "POST", `/cases/${id}/rapporten/fit-dossier`);
    expect(a.status).toBe(201);
    const b = await F.api(owner, "POST", `/cases/${id}/rapporten/fit-dossier`);
    expect(b.status).toBe(200);
    expect(b.json.hergebruikt).toBe(true);
    expect(b.json.id).toBe(a.json.id);
    const html = await F.api(owner, "GET", `/cases/${id}/artefacten/${a.json.id}?formaat=html`);
    expect(html.status).toBe(200);
    expect(String(html.json)).toContain("Plant Manager");
  });

  it("toont de gekoppelde recruiter voor de vergrendeling een semi-blinde weergave", async () => {
    const v = (await F.api(recruiterAdmin, "GET", `/cases/${id}`)).json;
    expect(v.semiBlind).toBe(true);
    expect(v.profielClaims).toEqual([]);
    expect(v.fitItems).toEqual([]);
    expect((await F.api(recruiterAdmin, "POST", `/cases/${id}/rapporten/fit-dossier`)).status).toBe(403);
  });

  it("stelt een H-BOM op, kiest standard en keurt goed", async () => {
    const p = await F.api(owner, "POST", `/cases/${id}/hbom/voorstel`);
    expect(p.status).toBe(200);
    expect(p.json.pool).toBeGreaterThanOrEqual(3);
    const k = await F.api(owner, "POST", `/cases/${id}/hbom/pakket`, { pakket: "standard" });
    expect(k.status).toBe(200);
    const ids = k.json.standaardSelectie as number[];
    expect(ids.length).toBeGreaterThanOrEqual(3);
    // Een reviewer keurt de H-BOM niet goed.
    expect((await F.api(reviewer, "POST", `/cases/${id}/hbom/goedkeuren`, { hypotheseIds: ids })).status).toBe(403);
    const g = await F.api(owner, "POST", `/cases/${id}/hbom/goedkeuren`, { hypotheseIds: ids });
    expect(g.status).toBe(200);
    links = g.json.links;
    expect(links.recruiter).toMatch(/^\/role-fit\/observatie\//);
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.zaak.status).toBe("HBOM_READY");
    oefeningIds = v.oefeningen.map((e: any) => e.id);
    expect(oefeningIds.length).toBe(ids.length);
    // Het token zelf staat niet in de databank.
    const tok = links.recruiter.split("/").pop()!;
    const rij = F.sqlite.prepare("SELECT COUNT(*) AS n FROM role_fit_observer_assignments WHERE token_hash = ?").get(tok) as any;
    expect(rij.n).toBe(0);
  });

  it("laat een observator pas toe na de start, en semi-blind", async () => {
    const tok = links.recruiter.split("/").pop()!;
    const o = await F.api(null, "GET", `/observatie/${tok}`);
    expect(o.status).toBe(200);
    expect(o.json).not.toHaveProperty("profielClaims");
    expect(JSON.stringify(o.json)).not.toContain("strong_support");
    const vroeg = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels: observatieRegels(oefeningIds, 5) });
    expect(vroeg.status).toBe(409);
    expect((await F.api(owner, "POST", `/cases/${id}/hbom/start`)).status).toBe(200);
  });

  it("weigert een onbekend token", async () => {
    expect((await F.api(null, "GET", `/observatie/${"x".repeat(32)}`)).status).toBe(404);
  });

  it("vraagt de taalcoach te bevestigen bij interpretaties", async () => {
    const tok = links.recruiter.split("/").pop()!;
    const regels = observatieRegels(oefeningIds, 5);
    regels[0].gedrag = "De kandidaat is een natuurlijke leider en is intelligent.";
    const r = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels });
    expect(r.status).toBe(422);
    expect(r.json.details.taal.length).toBeGreaterThan(0);
  });

  it("markeert ook interpretatieve labels, live en bij indienen", async () => {
    const tok = links.recruiter.split("/").pop()!;
    const coach = await F.api(null, "POST", `/observatie/${tok}/taalcoach`, { tekst: "Ze is een natuurlijke leider en belde de ploegleider." });
    expect(coach.status).toBe(200);
    expect(coach.json.meldingen.map((m: any) => m.regel)).toContain("interpretatief");
    const regels = observatieRegels(oefeningIds, 5);
    regels[0].gedrag = "Hij was erg dominant en belde daarna de ploegleider.";
    const r = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels });
    expect(r.status).toBe(422);
    expect(r.json.details.taal.some((m: any) => m.regel === "interpretatief")).toBe(true);
  });

  it("eist context, citaat, effect en andere verklaring bij een gescoorde observatie", async () => {
    const tok = links.recruiter.split("/").pop()!;
    for (const veld of ["contextTrigger", "quoteActie", "effect", "alternatieveVerklaring"] as const) {
      const regels = observatieRegels(oefeningIds, 3);
      regels[0][veld] = "";
      const r = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels });
      expect(r.status, veld).toBe(400);
    }
  });

  it("bewaart een concept en laat een tweede indiening niet toe", async () => {
    const tok = links.recruiter.split("/").pop()!;
    expect((await F.api(null, "PUT", `/observatie/${tok}/concept`, { regels: observatieRegels(oefeningIds.slice(0, 1), 3) })).status).toBe(200);
    const eerste = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels: observatieRegels(oefeningIds, 5) });
    expect(eerste.status).toBe(200);
    expect(eerste.json.vergrendeld).toBe(false);
    const tweede = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels: observatieRegels(oefeningIds, 1) });
    expect(tweede.status).toBe(409);
    // Zolang de tweede observator niet indiende, zien anderen niets van de observaties.
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.observaties).toEqual([]);
    expect(v.integraties).toEqual([]);
  });

  it("vergrendelt automatisch wanneer beide observatoren ingediend hebben", async () => {
    const tok = links.hiring_manager.split("/").pop()!;
    const r = await F.api(null, "POST", `/observatie/${tok}/indienen`, { regels: observatieRegels(oefeningIds, 5, "indirect") });
    expect(r.status).toBe(200);
    expect(r.json.vergrendeld).toBe(true);
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.zaak.status).toBe("OBSERVATIONS_LOCKED");
    expect(v.observaties.length).toBe(oefeningIds.length * 2);
    // Convergentie staat nog onder embargo.
    expect(v.convergentieEmbargo).toBe(true);
  });

  it("laat een correctie toe als nieuwe versie, en een ingediende rij blijft onveranderlijk", async () => {
    const tok = links.hiring_manager.split("/").pop()!;
    const regel = observatieRegels([oefeningIds[0]], 3)[0];
    const c = await F.api(null, "POST", `/observatie/${tok}/correctie`, { regel, reden: "Anker verkeerd aangeklikt tijdens het gesprek." });
    expect(c.status).toBe(200);
    expect(c.json.versie).toBe(2);
    expect(() => F.sqlite.prepare("UPDATE role_fit_observations SET gedrag = 'x' WHERE case_id = ?").run(id)).toThrow();
  });

  it("integreert, en gates bepalen welk besluit mag", async () => {
    expect((await F.api(recruiterAdmin, "POST", `/cases/${id}/integratie/bereken`)).status).toBe(403);
    expect((await F.api(reviewer, "POST", `/cases/${id}/integratie/bereken`)).status).toBe(200);
    let v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.zaak.status).toBe("INTEGRATION_REVIEW");
    expect(v.integraties.length).toBe(oefeningIds.length);
    const gate = v.vereisten.find((x: any) => x.kriticiteit === "gate");
    const h = v.integraties[0];
    const rv = await F.api(reviewer, "PUT", `/cases/${id}/integratie`, {
      overrides: [{ hypotheseId: h.hypothesisId, status: "mixed_context_dependent", reden: "De tweede observator zag enkel indirect bewijs." }],
      gates: [{ vereisteId: gate.id, status: "to_verify", toelichting: "Attest nog op te vragen." }],
    });
    expect(rv.status).toBe(200);
    expect((await F.api(reviewer, "POST", `/cases/${id}/integratie/klaar`)).status).toBe(200);
    v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.zaak.status).toBe("DECISION_READY");

    const besluit = {
      aanbeveling: "positive",
      rationale: "Beide observatoren zagen in de meeste oefeningen gedrag op het hoogste anker, consistent met de context.",
      voorwaarden: [],
      vervolgstappen: [{ stap: "Referentie opvragen", eigenaar: "Rita", termijn: "1 week" }],
      plan100: "Kennismaking met de vijf ploegen.",
      plan180: "Eerste lean-verbeterronde leiden.",
      kandidaatFeedback: "Dank voor de open gesprekken.",
    };
    // Enkel de ondertekenaar tekent.
    expect((await F.api(owner, "POST", `/cases/${id}/besluit`, besluit)).status).toBe(403);
    // Positief kan niet zolang de gate niet geverifieerd is.
    const neen = await F.api(signer, "POST", `/cases/${id}/besluit`, besluit);
    expect(neen.status).toBe(422);
    // Voorwaardelijk positief moet de gate als voorwaarde noemen.
    const zonder = await F.api(signer, "POST", `/cases/${id}/besluit`, { ...besluit, aanbeveling: "conditionally_positive", voorwaarden: ["Referentie is positief"] });
    expect(zonder.status).toBe(422);
    const ok = await F.api(signer, "POST", `/cases/${id}/besluit`, {
      ...besluit,
      aanbeveling: "conditionally_positive",
      voorwaarden: [`Gate ${gate.id}: geldig VCA-VOL-attest voorleggen voor de start.`],
    });
    expect(ok.status).toBe(201);
    v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    expect(v.zaak.status).toBe("SIGNED");
    expect(() => F.sqlite.prepare("UPDATE role_fit_decisions SET rationale = 'x' WHERE case_id = ?").run(id)).toThrow();
    // Een tweede besluit kan niet.
    expect((await F.api(signer, "POST", `/cases/${id}/besluit`, besluit)).status).toBe(409);
  });

  it("maakt alle rapporttypes, zonder verboden taal, en artefacten zijn onveranderlijk", async () => {
    for (const type of ["fit-dossier", "hbom-guide", "decision-dossier", "kandidaat-feedback"]) {
      const r = await F.api(owner, "POST", `/cases/${id}/rapporten/${type}`);
      expect([200, 201]).toContain(r.status);
      const html = await F.api(owner, "GET", `/cases/${id}/artefacten/${r.json.id}?formaat=html`);
      expect(html.status).toBe(200);
    }
    // Het fitdossier van voor de integratie is een oudere versie; het nieuwe is versie 2.
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    const fit = v.artefacten.filter((a: any) => a.type === "fit-dossier").map((a: any) => a.versie).sort();
    expect(fit).toEqual([1, 2]);
    expect(() => F.sqlite.prepare("UPDATE role_fit_artifacts SET contract_json = '{}' WHERE case_id = ?").run(id)).toThrow();
  });

  it("schrijft elke handeling in het audit-log", async () => {
    const acties = (F.sqlite.prepare("SELECT actie FROM gdpr_audit_log WHERE actie LIKE 'role_fit_%'").all() as any[]).map((r) => r.actie);
    for (const a of [
      "role_fit_case_aangemaakt",
      "role_fit_gelezen",
      "role_fit_bevroren",
      "role_fit_hbom_goedgekeurd",
      "role_fit_observatie_ingediend",
      "role_fit_observatie_gecorrigeerd",
      "role_fit_integratie",
      "role_fit_besluit_getekend",
      "role_fit_rapport_gemaakt",
      "role_fit_rapport_gedownload",
      "role_fit_toegang_geweigerd",
    ]) {
      expect(acties).toContain(a);
    }
  });

  it("archiveert en verwijdert de inhoud", async () => {
    expect((await F.api(owner, "POST", `/cases/${id}/archiveer`)).status).toBe(200);
    expect((await F.api(owner, "POST", `/cases/${id}/archiveer`)).status).toBe(409);
    expect((await F.api(owner, "DELETE", `/cases/${id}`)).status).toBe(200);
    expect((await F.api(owner, "GET", `/cases/${id}`)).status).toBe(404);
    const n = F.sqlite.prepare("SELECT COUNT(*) AS n FROM role_fit_observations WHERE case_id = ?").get(id) as any;
    expect(n.n).toBe(0);
  });
});

describe("Role Fit over HTTP: gelijktijdigheid", () => {
  it("laat van twee gelijktijdige indieningen er precies een slagen", async () => {
    const id = await maakCaseTotBevroren();
    await F.api(owner, "POST", `/cases/${id}/hbom/voorstel`);
    const k = await F.api(owner, "POST", `/cases/${id}/hbom/pakket`, { pakket: "light" });
    const g = await F.api(owner, "POST", `/cases/${id}/hbom/goedkeuren`, { hypotheseIds: k.json.standaardSelectie });
    await F.api(owner, "POST", `/cases/${id}/hbom/start`);
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    const ids = v.oefeningen.map((e: any) => e.id);
    const tok = g.json.links.recruiter.split("/").pop();
    const resultaten = await Promise.all(
      [1, 2, 3].map(() => F.api(null, "POST", `/observatie/${tok}/indienen`, { regels: observatieRegels(ids, 3) })),
    );
    const statussen = resultaten.map((r) => r.status).sort();
    expect(statussen).toEqual([200, 409, 409]);
  });

  it("weigert een claimbeoordeling met een verouderde versie", async () => {
    const r = await F.api(owner, "POST", "/cases", caseInvoer(afnameA, signer));
    const id = r.json.id;
    await F.api(owner, "POST", `/cases/${id}/bronnen`, { type: "text", tekst: ORILY_BRON });
    await F.api(owner, "POST", `/cases/${id}/context/extraheer`);
    const v = (await F.api(owner, "GET", `/cases/${id}`)).json;
    const k = v.claims.find((x: any) => x.status === "proposed");
    expect((await F.api(owner, "PATCH", `/cases/${id}/claims/${k.id}`, { status: "approved", versie: k.versie })).status).toBe(200);
    expect((await F.api(owner, "PATCH", `/cases/${id}/claims/${k.id}`, { status: "rejected", versie: k.versie })).status).toBe(409);
  });
});
