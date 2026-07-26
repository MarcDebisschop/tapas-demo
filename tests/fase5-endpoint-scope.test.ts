// ---------------------------------------------------------------------------
// tests/fase5-endpoint-scope.test.ts - Fase 5 van de organisatie-scoping: de
// endpoints halen hun scope uit de sessie en niet uit het verzoek.
//
// Wat de tests bewijzen:
//   1. Organisatie A ziet enkel A. Manipulatie van de query of de body naar B
//      levert nooit de gegevens van B op.
//   2. De prior ziet alles.
//   3. Zonder scope volgt 403; er is geen terugval op "toon alles".
//   4. Schrijfpaden forceren de eigen organisatie. Een afwijkende waarde in de
//      body wordt geweigerd, niet stil overschreven.
//   5. Losse records (afname, rapport, organisatie) buiten de scope geven 404
//      en niet 403, zodat het bestaan ervan niet bevestigd wordt.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

// Beheerders voor de scope-kern, en een sqlite in het geheugen voor de routes
// die er rechtstreeks mee praten.
vi.mock("../server/storage", async () => {
  const { default: Db } = await import("better-sqlite3");
  const beheerders = new Map<number, any>();
  const afnames = new Map<number, any>();
  const rapporten = new Map<number, any>();
  const organisaties = new Map<number, any>();
  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [],
    sqlite: new Db(":memory:"),
    db: {},
    storage: {
      __beheerders: beheerders,
      __afnames: afnames,
      __rapporten: rapporten,
      __organisaties: organisaties,
      getBeheerder: async (id: number) => beheerders.get(id),
      getAfname: async (id: number) => afnames.get(id),
      getRapport: async (id: number) => rapporten.get(id),
      getOrganisatie: async (id: number) => organisaties.get(id),
      listOrganisaties: async () => [...organisaties.values()],
      getSaldo: async () => ({ beschikbaar: 10, gereserveerd: 0, verbruikt: 0 }),
      listAfnames: async (scope: any) => {
        const alle = [...afnames.values()];
        if (scope.soort === "prior") return alle;
        if (scope.soort === "geen") throw new Error("scope geen in listAfnames");
        return alle.filter((a) => a.organisatieId === scope.organisatieId);
      },
      listRapporten: async (afnameId?: number) =>
        [...rapporten.values()].filter((r) => afnameId === undefined || r.afnameId === afnameId),
      maakUitnodiging: async (data: any) => ({ id: 500, ...data }),
      reserveer: async () => undefined,
      updateAfname: async () => undefined,
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  sqlite: any;
  storage: {
    __beheerders: Map<number, any>;
    __afnames: Map<number, any>;
    __rapporten: Map<number, any>;
    __organisaties: Map<number, any>;
  };
};
const { __beheerders: beheerders, __afnames: afnames, __rapporten: rapporten, __organisaties: organisaties } =
  opslag.storage;

const { registerFinancieelRoutes } = await import("../server/routes/financieel");
const { registerRapportenRoutes } = await import("../server/routes/rapporten");
const { registerAfnameRoutes } = await import("../server/routes/afnames");
const { registerOpvolgingRoutes } = await import("../server/routes/opvolging");

// Sessies: ?als=prior | ?als=a | ?als=b | niets
const PRIOR = 1;
const BEHEERDER_A = 2;
const BEHEERDER_B = 3;

function app(registreer: (a: express.Express) => void) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    const als = String(req.query.als ?? "");
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    if (als === "b") sessie.adminId = BEHEERDER_B;
    (req as any).session = sessie;
    next();
  });
  registreer(a);
  return a;
}

async function metServer(a: express.Express, fn: (basis: string) => Promise<void>) {
  const server = createServer(a);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

async function haal(registreer: (a: express.Express) => void, pad: string) {
  let uit: { status: number; body: any } = { status: 0, body: null };
  await metServer(app(registreer), async (basis) => {
    const res = await fetch(`${basis}${pad}`);
    const tekst = await res.text();
    let body: any = tekst;
    try {
      body = JSON.parse(tekst);
    } catch {
      /* html- of tekstantwoord */
    }
    uit = { status: res.status, body };
  });
  return uit;
}

async function post(registreer: (a: express.Express) => void, pad: string, lichaam: unknown) {
  let uit: { status: number; body: any } = { status: 0, body: null };
  await metServer(app(registreer), async (basis) => {
    const res = await fetch(`${basis}${pad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lichaam),
    });
    uit = { status: res.status, body: await res.json().catch(() => null) };
  });
  return uit;
}

beforeEach(() => {
  beheerders.clear();
  afnames.clear();
  rapporten.clear();
  organisaties.clear();

  beheerders.set(PRIOR, {
    id: PRIOR,
    naam: "Prior",
    organisatie: PRIOR_ORGANISATIE,
    isPrior: true,
    actief: true,
    organisatieId: null,
  });
  beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A,
    naam: "A",
    organisatie: "Org A",
    isPrior: false,
    actief: true,
    organisatieId: 1,
  });
  beheerders.set(BEHEERDER_B, {
    id: BEHEERDER_B,
    naam: "B",
    organisatie: "Org B",
    isPrior: false,
    actief: true,
    organisatieId: 2,
  });

  organisaties.set(1, { id: 1, naam: "Org A" });
  organisaties.set(2, { id: 2, naam: "Org B" });

  afnames.set(10, { id: 10, organisatieId: 1, status: "voltooid", generatorContract: null });
  afnames.set(20, { id: 20, organisatieId: 2, status: "voltooid", generatorContract: null });
  afnames.set(30, { id: 30, organisatieId: null, status: "voltooid", generatorContract: null });

  rapporten.set(100, { id: 100, afnameId: 10, variant: "vol", titel: "A", inhoud: "{}", html: "<p>A</p>", contractVersie: "1", createdAt: "x" });
  rapporten.set(200, { id: 200, afnameId: 20, variant: "vol", titel: "B", inhoud: "{}", html: "<p>B</p>", contractVersie: "1", createdAt: "x" });
});

// ── 1. Organisatielijst, detail en saldo ───────────────────────────────────

describe("GET /api/organisaties", () => {
  it("geeft een organisatie enkel zichzelf", async () => {
    const res = await haal(registerFinancieelRoutes, "/api/organisaties?als=a");
    expect(res.status).toBe(200);
    expect(res.body.map((o: any) => o.id)).toEqual([1]);
  });

  it("geeft de prior alle organisaties", async () => {
    const res = await haal(registerFinancieelRoutes, "/api/organisaties?als=prior");
    expect(res.body.map((o: any) => o.id)).toEqual([1, 2]);
  });

  it("weigert zonder scope met 403", async () => {
    expect((await haal(registerFinancieelRoutes, "/api/organisaties")).status).toBe(403);
  });
});

describe("GET /api/organisaties/:id en /saldo", () => {
  it("laat A haar eigen detail zien", async () => {
    const res = await haal(registerFinancieelRoutes, "/api/organisaties/1?als=a");
    expect(res.status).toBe(200);
    expect(res.body.naam).toBe("Org A");
  });

  it("geeft A op het detail van B een 404 en niet een 403", async () => {
    // 403 zou bevestigen dat organisatie 2 bestaat.
    const res = await haal(registerFinancieelRoutes, "/api/organisaties/2?als=a");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("Org B");
  });

  it("geeft A op het saldo van B een 404", async () => {
    expect((await haal(registerFinancieelRoutes, "/api/organisaties/2/saldo?als=a")).status).toBe(404);
  });

  it("laat de prior het detail van elke organisatie zien", async () => {
    expect((await haal(registerFinancieelRoutes, "/api/organisaties/2?als=prior")).body.naam).toBe("Org B");
  });
});

describe("GET /api/organisaties/:id/tendenzen", () => {
  it("weigert A de tendenzen van B", async () => {
    expect((await haal(registerFinancieelRoutes, "/api/organisaties/2/tendenzen?als=a")).status).toBe(403);
  });

  it("laat A haar eigen tendenzen zien", async () => {
    expect((await haal(registerFinancieelRoutes, "/api/organisaties/1/tendenzen?als=a")).status).toBe(200);
  });
});

// ── 2. Rapporten erven de scope van hun afname ─────────────────────────────

describe("rapporten", () => {
  it("laat A haar eigen rapport zien", async () => {
    expect((await haal(registerRapportenRoutes, "/api/rapporten/100?als=a")).status).toBe(200);
  });

  it("geeft A op het rapport van B een 404 en lekt de inhoud niet", async () => {
    const res = await haal(registerRapportenRoutes, "/api/rapporten/200?als=a");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("<p>B</p>");
  });

  it("lekt het rapport van B ook niet via /html of /download", async () => {
    for (const achtervoegsel of ["/html", "/download", "/pdf"]) {
      const res = await haal(registerRapportenRoutes, `/api/rapporten/200${achtervoegsel}?als=a`);
      expect(res.status, achtervoegsel).toBe(404);
      expect(String(res.body), achtervoegsel).not.toContain("<p>B</p>");
    }
  });

  it("laat de prior elk rapport zien", async () => {
    expect((await haal(registerRapportenRoutes, "/api/rapporten/200?als=prior")).status).toBe(200);
  });

  it("eist van een organisatie een afnameId op de lijst", async () => {
    // Zonder afnameId zou de lijst alle rapporten van alle organisaties zijn.
    expect((await haal(registerRapportenRoutes, "/api/rapporten?als=a")).status).toBe(400);
    expect((await haal(registerRapportenRoutes, "/api/rapporten?als=prior")).status).toBe(200);
  });

  it("weigert A een lijst voor de afname van B", async () => {
    expect((await haal(registerRapportenRoutes, "/api/rapporten?afnameId=20&als=a")).status).toBe(404);
  });

  it("weigert A een rapport te genereren op de afname van B", async () => {
    const res = await post(registerRapportenRoutes, "/api/rapporten?als=a", {
      afnameId: 20,
      variant: "kompas",
    });
    expect(res.status).toBe(404);
  });

  it("weigert alles zonder scope", async () => {
    expect((await haal(registerRapportenRoutes, "/api/rapporten/100")).status).toBe(403);
  });
});

// ── 3. GDPR: losse afnames buiten scope ────────────────────────────────────

describe("GDPR-routes vallen binnen de scope", () => {
  it("weigert A de export van de afname van B met 404", async () => {
    const res = await haal(registerAfnameRoutes, "/api/gdpr/afnames/20/export?als=a");
    expect(res.status).toBe(404);
  });

  it("weigert A de anonimisering van de afname van B", async () => {
    const res = await post(registerAfnameRoutes, "/api/gdpr/afnames/20/anonimiseer?als=a", {});
    expect(res.status).toBe(404);
  });

  it("weigert A de bewaartermijn van de afname van B te wijzigen", async () => {
    const res = await post(registerAfnameRoutes, "/api/gdpr/bewaartermijn?als=a", {
      afnameId: 20,
      bewaartotDatum: "2030-01-01",
    });
    expect(res.status).toBe(404);
  });

  it("geeft een particuliere afname enkel aan de prior", async () => {
    // Afname 30 hoort bij geen enkele organisatie. Zou A die zien, dan zag elke
    // organisatie alle particuliere afnames.
    expect((await haal(registerAfnameRoutes, "/api/gdpr/afnames/30/export?als=a")).status).toBe(404);
  });

  it("weigert zonder scope met 403", async () => {
    expect((await haal(registerAfnameRoutes, "/api/gdpr/afnames/10/export")).status).toBe(403);
  });
});

// ── 4. Schrijfpaden forceren de eigen organisatie ──────────────────────────

describe("POST /api/uitnodigingen", () => {
  it("weigert A een uitnodiging op naam van B", async () => {
    const res = await post(registerAfnameRoutes, "/api/uitnodigingen?als=a", {
      name: "Iemand",
      organisatieId: 2,
    });
    expect(res.status).toBe(403);
  });

  it("legt A haar eigen organisatie op wanneer de body er geen bevat", async () => {
    const res = await post(registerAfnameRoutes, "/api/uitnodigingen?als=a", { name: "Iemand" });
    expect(res.status).toBe(200);
    expect(res.body.organisatieId).toBe(1);
  });

  it("laat de prior vrij kiezen", async () => {
    const res = await post(registerAfnameRoutes, "/api/uitnodigingen?als=prior", {
      name: "Iemand",
      organisatieId: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.organisatieId).toBe(2);
  });

  it("weigert zonder scope", async () => {
    expect((await post(registerAfnameRoutes, "/api/uitnodigingen", { name: "X" })).status).toBe(403);
  });
});

// ── 5. Opvolging: de organisatie komt uit de sessie ────────────────────────

describe("opvolging-per-instrument", () => {
  beforeEach(() => {
    opslag.sqlite.exec(`
      DROP TABLE IF EXISTS afnames;
      DROP TABLE IF EXISTS organisaties;
      CREATE TABLE afnames (organisatie_id INTEGER, instrument_id TEXT, status TEXT);
      CREATE TABLE organisaties (id INTEGER PRIMARY KEY, naam TEXT NOT NULL);
    `);
    const o = opslag.sqlite.prepare(`INSERT INTO organisaties (id, naam) VALUES (?, ?)`);
    o.run(1, "Org A");
    o.run(2, "Org B");
    const ins = opslag.sqlite.prepare(
      `INSERT INTO afnames (organisatie_id, instrument_id, status) VALUES (?, ?, ?)`,
    );
    ins.run(1, "tfi", "voltooid");
    ins.run(2, "tfi", "voltooid");
    ins.run(2, "tfi", "voltooid");
  });

  it("negeert een organisatie_id in de query van een organisatie", async () => {
    // DE KERN VAN DE FIX: A vraagt de cijfers van B op en krijgt die van A.
    const res = await haal(
      registerOpvolgingRoutes,
      "/api/organisatie/opvolging-per-instrument?organisatie_id=2&als=a",
    );
    expect(res.status).toBe(200);
    expect(res.body.organisatieId).toBe(1);
    expect(res.body.organisatieNaam).toBe("Org A");
    expect(res.body.totalen.totaal).toBe(1);
  });

  it("laat de prior wel een organisatie kiezen", async () => {
    const res = await haal(
      registerOpvolgingRoutes,
      "/api/organisatie/opvolging-per-instrument?organisatie_id=2&als=prior",
    );
    expect(res.body.organisatieId).toBe(2);
    expect(res.body.totalen.totaal).toBe(2);
  });

  it("laat een organisatie op het admin-pad naar haar eigen cijfers zakken", async () => {
    const res = await haal(registerOpvolgingRoutes, "/api/admin/opvolging-per-instrument?als=a");
    expect(res.body.niveau).toBe("organisatie");
    expect(res.body.totalen.totaal).toBe(1);
  });

  it("geeft de prior op het admin-pad alle organisaties samen", async () => {
    const res = await haal(registerOpvolgingRoutes, "/api/admin/opvolging-per-instrument?als=prior");
    expect(res.body.niveau).toBe("admin");
    expect(res.body.totalen.totaal).toBe(3);
  });

  it("weigert beide paden zonder scope met 403", async () => {
    expect((await haal(registerOpvolgingRoutes, "/api/admin/opvolging-per-instrument")).status).toBe(403);
    expect(
      (await haal(registerOpvolgingRoutes, "/api/organisatie/opvolging-per-instrument?organisatie_id=1")).status,
    ).toBe(403);
  });
});

// ── 6. Broncontrole: geen enkele scope meer uit het verzoek ────────────────

describe("de scope komt nergens meer uit het verzoek", () => {
  it("leidt de opvolging-organisatie niet langer af uit de query alleen", () => {
    const bron = readFileSync(new URL("../server/routes/opvolging.ts", import.meta.url), "utf8");
    expect(bron).toContain("organisatieFilterVanScope");
    expect(bron).not.toContain("vereisAdmin");
  });

  it("gebruikt in bulk-import de centrale prior-beslissing en niet een eigen kopie", () => {
    // De lokale versie keek enkel naar `isPrior` en niet naar de
    // prior-organisatie, en was dus zwakker dan de rest van het platform.
    const bron = readFileSync(new URL("../server/bulk-import/routes.ts", import.meta.url), "utf8");
    expect(bron).not.toContain("async function isPriorAdmin");
    expect(bron).toContain("schrijfOrganisatieId");
  });

  it("scoopt het inzichtcentrum op de sessie", () => {
    const bron = readFileSync(
      new URL("../server/routes-coaches-academy-mail.ts", import.meta.url),
      "utf8",
    );
    expect(bron).toContain('app.get("/api/inzichtcentrum/overzicht", vereisScope,');
  });
});
