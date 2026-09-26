// ---------------------------------------------------------------------------
// tests/toc-kompas-flow.test.ts
//
// De volledige weg van een TOC Commitmentkompas-ronde over HTTP: aanmaken met
// vier Captains, invullen via de persoonlijke link (concept en indienen),
// embargo tijdens de nulmeting, automatische consolidatie, register overnemen,
// Coverage Matrix, Decision Log, acceptatie, vaststellen, status bijhouden,
// rapporten en afsluiten. Daarnaast de toegang (enkel de hoofdbeheerder), de
// optimistische vergrendeling en de append-only regels.
//
// PDF-rendering staat hier uit (TOC_KOMPAS_GEEN_PDF=1).
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.TAPAS_DB_PATH = join(tmpdir(), `tapas-toc-kompas-flow-${process.pid}.db`);
process.env.TOC_KOMPAS_GEEN_PDF = "1";

const ROLLEN = ["talent_innovation", "execution_horizon", "academy", "visibility"] as const;

let sqlite: any;
let server: Server;
let basis = "";
let prior = 0;
let gewoon = 0;

async function api(admin: number | null, methode: string, pad: string, body?: unknown) {
  const r = await fetch(`${basis}/api/toc-kompas${pad}`, {
    method: methode,
    headers: { "content-type": "application/json", ...(admin ? { "x-test-admin": String(admin) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tekst = await r.text();
  let json: any = tekst;
  try {
    json = JSON.parse(tekst);
  } catch {
    /* html */
  }
  return { status: r.status, json, headers: r.headers };
}

/** Een volledig ingevulde vragenlijst. `a` is de rol die A-owner is op zijn eigen domeinen. */
function antwoorden(naam: string, eigenDomeinen: string[]) {
  const dekking: Record<string, any> = {};
  for (const d of eigenDomeinen) dekking[d] = { mijnRol: "A", gewensteRol: "A", urenPerMaand: 8, zekerheid: 4, ontbrekend: "" };
  return {
    velden: { naam, beschikbareUren: "20", capaciteitszekerheid: "Zeker", opvolging: "Tijdelijke overname door een andere Captain" },
    capaciteit: { delivery: 50, bedrijfsleiding: 35, buffer: 15 },
    delivery: [{ outcome: `Resultaat van ${naam}`, ontvanger: "TOC", bewijs: "Demo aan het TOC", deadline: "2026-12-15", uren: 6, raci: "A" }],
    bedrijfsleiding: [{ uitkomst: `Kader van ${naam}`, beslissing: "Beslissingskader", bewijs: "Vastgelegd besluit", deadline: "2026-11-30", uren: 3, mandaat: "Binnen eigen domein" }],
    dekking,
    reflectie: { r1: "Eerste reflectie." },
  };
}

const VERDELING: Record<string, string[]> = {
  talent_innovation: ["product", "psychometrie", "purpose"],
  execution_horizon: ["technologie", "cyber", "data", "finance", "operations"],
  academy: ["academy", "people", "customer"],
  visibility: ["visibility", "brand", "gtm"],
};

let rondeId = 0;
const tokens: Record<string, string> = {};
const captainIds: Record<string, number> = {};

beforeAll(async () => {
  const storageMod = await import("../server/storage");
  sqlite = storageMod.sqlite;
  const { registerTocKompasRoutes, wisGrenzenVoorTest } = await import("../server/toc-kompas/routes");
  wisGrenzenVoorTest();
  const p: any = await storageMod.storage.maakBeheerder({ naam: "Pia Prior", email: `toc-prior-${Date.now()}@voorbeeld.test`, organisatie: "TaPasCity", isPrior: true } as any);
  prior = p.id;
  const o: any = await storageMod.storage.createOrganisatie({ naam: "Klant NV" } as any);
  const g: any = await storageMod.storage.maakBeheerder({ naam: "Gert Gewoon", email: `toc-gewoon-${Date.now()}@voorbeeld.test`, organisatie: "Klant NV", isPrior: false } as any);
  gewoon = g.id;
  sqlite.prepare("UPDATE beheerders SET organisatie_id = ? WHERE id = ?").run(o.id, gewoon);
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    const id = req.header("x-test-admin");
    (req as any).session = id ? { adminId: Number(id) } : {};
    next();
  });
  registerTocKompasRoutes(app);
  server = createServer(app);
  await new Promise<void>((k) => server.listen(0, k));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((k) => server.close(() => k()));
});

describe("TOC Commitmentkompas: toegang", () => {
  it("weigert zonder aanmelding en voor een gewone beheerder", async () => {
    expect((await api(null, "GET", "/rondes")).status).toBe(401);
    const r = await api(gewoon, "GET", "/rondes");
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("Enkel de hoofdbeheerder heeft hier toegang toe.");
  });

  it("weigert een ronde zonder precies vier Captains of met een dubbele rol", async () => {
    const te_weinig = await api(prior, "POST", "/rondes", { titel: "Ronde", periode: "2026-Q4", captains: [{ rol: "academy", naam: "Herman" }] });
    expect(te_weinig.status).toBe(400);
    const dubbel = await api(prior, "POST", "/rondes", {
      titel: "Ronde",
      periode: "2026-Q4",
      captains: [
        { rol: "academy", naam: "A" },
        { rol: "academy", naam: "B" },
        { rol: "visibility", naam: "C" },
        { rol: "execution_horizon", naam: "D" },
      ],
    });
    expect([400, 422]).toContain(dubbel.status);
  });
});

describe("TOC Commitmentkompas: de volledige ronde", () => {
  it("maakt een ronde met vier gelijkwaardige Captains en eenmalige links", async () => {
    const r = await api(prior, "POST", "/rondes", {
      titel: "TOC Commitmentkompas",
      periode: "2026-Q4",
      deadline: "2026-10-15",
      captains: [
        { rol: "talent_innovation", naam: "Marc" },
        { rol: "execution_horizon", naam: "Andrea" },
        { rol: "academy", naam: "Herman" },
        { rol: "visibility", naam: "Gina Peeters" },
      ],
    });
    expect(r.status).toBe(201);
    rondeId = r.json.ronde.id;
    expect(r.json.links).toHaveLength(4);
    for (const l of r.json.links) {
      expect(l.token.length).toBeGreaterThanOrEqual(40);
      tokens[l.rol] = l.token;
      captainIds[l.rol] = l.captainId;
    }
    const rijen = sqlite.prepare("SELECT token_hash FROM toc_kompas_captains WHERE ronde_id = ?").all(rondeId);
    for (const x of rijen) expect(Object.values(tokens)).not.toContain(x.token_hash);
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(JSON.stringify(d.json)).not.toContain(tokens.visibility);
  });

  it("een onbekende of te korte link geeft 404", async () => {
    expect((await api(null, "GET", "/invullen/kort")).status).toBe(404);
    expect((await api(null, "GET", `/invullen/${"x".repeat(43)}`)).status).toBe(404);
  });

  it("bewaart een concept met optimistische vergrendeling", async () => {
    const t = tokens.visibility;
    const s = await api(null, "GET", `/invullen/${t}`);
    expect(s.status).toBe(200);
    expect(s.json.captain.titel).toBe("Captain of Visibility");
    const a = antwoorden("Gina Peeters", VERDELING.visibility);
    const c1 = await api(null, "PUT", `/invullen/${t}/concept`, { antwoorden: a, versie: s.json.conceptVersie });
    expect(c1.status).toBe(200);
    const oud = await api(null, "PUT", `/invullen/${t}/concept`, { antwoorden: a, versie: s.json.conceptVersie });
    expect(oud.status).toBe(409);
  });

  it("weigert indienen als de capaciteit niet op 100% uitkomt", async () => {
    const a = antwoorden("Marc", VERDELING.talent_innovation);
    a.capaciteit.buffer = 5;
    const r = await api(null, "POST", `/invullen/${tokens.talent_innovation}/indienen`, { antwoorden: a, bevestig: true });
    expect(r.status).toBe(422);
    expect(r.json.fouten.join(" ")).toContain("100%");
  });

  it("houdt de antwoorden onder embargo tijdens de nulmeting", async () => {
    const r = await api(null, "POST", `/invullen/${tokens.visibility}/indienen`, { antwoorden: antwoorden("Gina Peeters", VERDELING.visibility), bevestig: true });
    expect(r.status).toBe(200);
    expect(r.json.alleIngediend).toBe(false);
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(d.json.consolidatie).toBeNull();
    expect(d.json.captains.find((c: any) => c.rol === "visibility").status).toBe("ingediend");
    const lees = await api(prior, "GET", `/rondes/${rondeId}/captains/${captainIds.visibility}/antwoorden`);
    expect(lees.status).toBe(409);
    const charter = await api(prior, "POST", `/rondes/${rondeId}/rapporten/captain-charter`, { captainId: captainIds.visibility });
    expect(charter.status).toBe(409);
    const eigen = await api(null, "GET", `/invullen/${tokens.visibility}/charter`);
    expect(eigen.status).toBe(200);
    expect(eigen.json).toContain("Captain of Visibility");
  });

  it("een ingediende vragenlijst is niet meer bewerkbaar, tenzij heropend", async () => {
    const t = tokens.visibility;
    const s = await api(null, "GET", `/invullen/${t}`);
    const r = await api(null, "PUT", `/invullen/${t}/concept`, { antwoorden: antwoorden("Gina", []), versie: s.json.conceptVersie });
    expect(r.status).toBe(409);
    expect((await api(prior, "POST", `/rondes/${rondeId}/captains/${captainIds.visibility}/heropen`)).status).toBe(200);
    const s2 = await api(null, "GET", `/invullen/${t}`);
    expect(s2.json.bewerkbaar).toBe(true);
    expect(s2.json.antwoorden.velden.naam).toBe("Gina Peeters");
    const opnieuw = await api(null, "POST", `/invullen/${t}/indienen`, { antwoorden: antwoorden("Gina Peeters", VERDELING.visibility), bevestig: true });
    expect(opnieuw.status).toBe(200);
    expect(opnieuw.json.indieningVersie).toBe(2);
    expect(() => sqlite.prepare("UPDATE toc_kompas_indieningen SET antwoorden_json = '{}' WHERE captain_id = ?").run(captainIds.visibility)).toThrow();
  });

  it("gaat automatisch naar consolidatie als alle vier ingediend hebben", async () => {
    for (const rol of ["talent_innovation", "execution_horizon", "academy"] as const) {
      const naam = rol === "talent_innovation" ? "Marc" : rol === "execution_horizon" ? "Andrea" : "Herman";
      const r = await api(null, "POST", `/invullen/${tokens[rol]}/indienen`, { antwoorden: antwoorden(naam, VERDELING[rol]), bevestig: true });
      expect(r.status).toBe(200);
    }
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(d.json.ronde.status).toBe("CONSOLIDATIE");
    expect(d.json.consolidatie.capaciteit).toHaveLength(4);
    // Geen A-owner: onder meer Legal & governance en Risk & reputatie.
    const rood = d.json.consolidatie.signalen.filter((s: any) => s.soort === "rood").map((s: any) => s.domein);
    expect(rood).toContain("legal");
    expect(rood).toContain("risk");
    const lees = await api(prior, "GET", `/rondes/${rondeId}/captains/${captainIds.visibility}/antwoorden`);
    expect(lees.status).toBe(200);
  });

  it("maakt een workshopdossier", async () => {
    const r = await api(prior, "POST", `/rondes/${rondeId}/rapporten/workshopdossier`);
    expect(r.status).toBe(201);
    const nogmaals = await api(prior, "POST", `/rondes/${rondeId}/rapporten/workshopdossier`);
    expect(nogmaals.status).toBe(200);
    expect(nogmaals.json.hergebruikt).toBe(true);
    const html = await api(prior, "GET", `/rondes/${rondeId}/artefacten/${r.json.id}?formaat=html`);
    expect(html.status).toBe(200);
    expect(html.json).toContain("Workshopdossier");
    expect(html.json).not.toMatch(/\bCEO\b/);
  });

  it("de scorecard kan nog niet voor vaststelling", async () => {
    expect((await api(prior, "POST", `/rondes/${rondeId}/rapporten/kwartaalscorecard`)).status).toBe(409);
  });

  it("neemt de commitments letterlijk over, zonder dubbels", async () => {
    const r = await api(prior, "POST", `/rondes/${rondeId}/commitments/overnemen`);
    expect(r.json.toegevoegd).toBe(8);
    const opnieuw = await api(prior, "POST", `/rondes/${rondeId}/commitments/overnemen`);
    expect(opnieuw.json.toegevoegd).toBe(0);
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(d.json.commitments[0].code).toBe("TOC-2026-Q4-001");
    expect(d.json.vaststelFouten.length).toBeGreaterThan(0);
  });

  it("weigert vaststellen zolang het register onvolledig is", async () => {
    const r = await api(prior, "POST", `/rondes/${rondeId}/vaststellen`, { bevestig: true });
    expect(r.status).toBe(422);
    expect(r.json.fouten.join(" ")).toContain("stopkeuze");
  });

  it("vult de kaarten aan met optimistische vergrendeling", async () => {
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    for (const c of d.json.commitments) {
      const body = { ...c, beslissingsrecht: c.beslissingsrecht || "Binnen eigen domein", stopkeuze: "Stopt met ad-hoc verzoeken", domein: c.domein || "", versie: c.versie };
      const r = await api(prior, "PUT", `/rondes/${rondeId}/commitments/${c.id}`, body);
      expect(r.status).toBe(200);
      const oud = await api(prior, "PUT", `/rondes/${rondeId}/commitments/${c.id}`, body);
      expect(oud.status).toBe(409);
    }
  });

  it("bewaart de Coverage Matrix en weigert een vreemde A-owner", async () => {
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    const vreemd = await api(prior, "PUT", `/rondes/${rondeId}/coverage`, { rijen: [{ domein: "finance", aOwnerCaptainId: 999999, score: 2 }], versie: d.json.ronde.coverageVersie });
    expect(vreemd.status).toBe(400);
    const eigenaar: Record<string, number> = {};
    for (const [rol, doms] of Object.entries(VERDELING)) for (const x of doms) eigenaar[x] = captainIds[rol];
    const rijen = d.json.coverage.map((r: any) => ({ domein: r.domein, aOwner: "", aOwnerCaptainId: eigenaar[r.domein] ?? null, score: eigenaar[r.domein] ? 2 : 0, actie: eigenaar[r.domein] ? "" : "Eigenaar aanduiden" }));
    const r = await api(prior, "PUT", `/rondes/${rondeId}/coverage`, { rijen, versie: d.json.ronde.coverageVersie });
    expect(r.status).toBe(200);
    expect((await api(prior, "PUT", `/rondes/${rondeId}/coverage`, { rijen, versie: d.json.ronde.coverageVersie })).status).toBe(409);
  });

  it("legt een besluit vast dat daarna niet te wijzigen is", async () => {
    const r = await api(prior, "POST", `/rondes/${rondeId}/besluiten`, { datum: "2026-10-20", onderwerp: "Eigenaar Legal", besluit: "Wordt in de volgende workshop aangeduid.", beslisser: "TOC" });
    expect(r.status).toBe(201);
    expect(() => sqlite.prepare("UPDATE toc_kompas_besluiten SET besluit = 'x' WHERE id = ?").run(r.json.id)).toThrow();
    expect(() => sqlite.prepare("DELETE FROM toc_kompas_besluiten WHERE id = ?").run(r.json.id)).toThrow();
    const fout = await api(prior, "POST", `/rondes/${rondeId}/besluiten`, { datum: "2026-10-20", onderwerp: "Vervang", besluit: "Vervangt een onbestaand besluit.", beslisser: "TOC", vervangtBesluitId: 999999 });
    expect(fout.status).toBe(400);
  });

  it("weigert een automatisch criterium handmatig aan te vinken", async () => {
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    const r = await api(prior, "PUT", `/rondes/${rondeId}/acceptatie`, { handmatig: { belegd: true }, versie: d.json.ronde.acceptatieVersie });
    expect(r.status).toBe(400);
  });

  it("stelt vast als alles in orde is", async () => {
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    const r = await api(prior, "PUT", `/rondes/${rondeId}/acceptatie`, {
      handmatig: { tocRvb: true, ritme: true, keyPerson: true, visibilityCharter: true, cirkel: true },
      versie: d.json.ronde.acceptatieVersie,
    });
    expect(r.status).toBe(200);
    const d2 = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(d2.json.vaststelFouten).toEqual([]);
    const v = await api(prior, "POST", `/rondes/${rondeId}/vaststellen`, { bevestig: true, toelichting: "Vastgesteld in de workshop." });
    expect(v.status).toBe(200);
    const d3 = await api(prior, "GET", `/rondes/${rondeId}`);
    expect(d3.json.ronde.status).toBe("VASTGESTELD");
  });

  it("na vaststelling wijzigt enkel de status, met toelichting bij niet-groen", async () => {
    const d = await api(prior, "GET", `/rondes/${rondeId}`);
    const c = d.json.commitments[0];
    expect((await api(prior, "PUT", `/rondes/${rondeId}/commitments/${c.id}`, { ...c, versie: c.versie })).status).toBe(409);
    expect((await api(prior, "POST", `/rondes/${rondeId}/commitments/${c.id}/status`, { status: "amber", toelichting: "", versie: c.versie })).status).toBe(400);
    const r = await api(prior, "POST", `/rondes/${rondeId}/commitments/${c.id}/status`, { status: "amber", toelichting: "Afhankelijkheid van een leverancier.", versie: c.versie });
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("amber");
    expect(r.json.statusToelichting).toBe("Afhankelijkheid van een leverancier.");
  });

  it("maakt register, charter en scorecard, en sluit het kwartaal af", async () => {
    for (const [type, body] of [
      ["commitment-register", undefined],
      ["captain-charter", { captainId: captainIds.visibility }],
      ["kwartaalscorecard", undefined],
    ] as const) {
      const r = await api(prior, "POST", `/rondes/${rondeId}/rapporten/${type}`, body);
      expect(r.status).toBe(201);
      const html = await api(prior, "GET", `/rondes/${rondeId}/artefacten/${r.json.id}?formaat=html`);
      expect(html.json).toContain("Talent runs on Passion");
      expect(html.json).not.toMatch(/\bCEO\b/);
      expect(/[\u2013\u2014\u2212]/.test(html.json)).toBe(false);
    }
    const a = await api(prior, "POST", `/rondes/${rondeId}/afsluiten`, { bevestig: true, toelichting: "Kwartaal afgerond." });
    expect(a.status).toBe(200);
    expect((await api(prior, "POST", `/rondes/${rondeId}/afsluiten`, { bevestig: true })).status).toBe(409);
  });

  it("schrijft de handelingen in het audit-log", () => {
    const acties = sqlite.prepare("SELECT actie FROM gdpr_audit_log WHERE actie LIKE 'toc_kompas_%'").all().map((r: any) => r.actie);
    for (const a of ["toc_kompas_ronde_aangemaakt", "toc_kompas_ingediend", "toc_kompas_heropend", "toc_kompas_gelezen", "toc_kompas_gewijzigd", "toc_kompas_besluit_vastgelegd", "toc_kompas_vastgesteld", "toc_kompas_afgesloten", "toc_kompas_rapport_gemaakt", "toc_kompas_rapport_gedownload"]) {
      expect(acties).toContain(a);
    }
  });
});

describe("TOC Commitmentkompas: vergrendelen zonder alle indieningen", () => {
  it("vraagt een reden en markeert wie ontbreekt", async () => {
    const r = await api(prior, "POST", "/rondes", {
      titel: "Tweede ronde",
      periode: "2027-Q1",
      captains: ROLLEN.map((rol, i) => ({ rol, naam: `Captain ${i + 1}` })),
    });
    const id = r.json.ronde.id;
    const t = r.json.links[0].token;
    await api(null, "POST", `/invullen/${t}/indienen`, { antwoorden: antwoorden("Captain 1", ["product"]), bevestig: true });
    expect((await api(prior, "POST", `/rondes/${id}/vergrendel`, { reden: "kort" })).status).toBe(400);
    const v = await api(prior, "POST", `/rondes/${id}/vergrendel`, { reden: "Deadline van de nulmeting is verstreken." });
    expect(v.status).toBe(200);
    const d = await api(prior, "GET", `/rondes/${id}`);
    expect(d.json.ronde.status).toBe("CONSOLIDATIE");
    expect(d.json.consolidatie.zonderIndiening).toHaveLength(3);
    const late = await api(null, "POST", `/invullen/${r.json.links[1].token}/indienen`, { antwoorden: antwoorden("Captain 2", []), bevestig: true });
    expect(late.status).toBe(409);
    expect(d.json.acceptatie.criteria.find((k: any) => k.sleutel === "capaciteit100").voldaan).toBe(false);
  });

  it("een periode bestaat maar een keer", async () => {
    const r = await api(prior, "POST", "/rondes", { titel: "Dubbel", periode: "2027-Q1", captains: ROLLEN.map((rol, i) => ({ rol, naam: `C${i}` })) });
    expect(r.status).toBe(409);
  });
});
