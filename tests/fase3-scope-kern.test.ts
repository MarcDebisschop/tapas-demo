// ---------------------------------------------------------------------------
// tests/fase3-scope-kern.test.ts - Fase 3 van de organisatie-scoping: er is nu
// een centrale scope-beslissing.
//
// Wat de tests bewijzen:
//   1. bepaalScope leidt precies drie uitkomsten af, en prior vereist BEIDE
//      voorwaarden (isPrior EN de prior-organisatie). Een klantbeheerder die
//      ooit de vlag kreeg wordt dus geen platformbeheerder.
//   2. Deny by default: wie geen aantoonbare identiteit heeft krijgt "geen", en
//      "geen" levert 403 op. Er is geen stilzwijgende terugval op "toon alles".
//   3. De scope komt uit de sessie, nooit uit query of body.
//   4. vereisPrior weigert een organisatie-scope, en de bestuurscijfers en de
//      boekhoudexport staan er effectief achter.
//   5. Het zetten van organisatie-inloggegevens is prior-only en geeft de
//      wachtwoordhash nooit terug.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

// De scope-kern leest beheerders via `storage.getBeheerder`, en de
// beheerroute praat rechtstreeks met sqlite. We geven beide een dubbel in het
// geheugen. De fabriek wordt gehesen, dus alles moet erbinnen ontstaan.
vi.mock("../server/storage", async () => {
  const { default: Db } = await import("better-sqlite3");
  const beheerders = new Map<number, any>();
  return {
    sqlite: new Db(":memory:"),
    db: {},
    storage: {
      __beheerders: beheerders,
      getBeheerder: async (id: number) => beheerders.get(id),
    },
  };
});

const opslag = (await import("../server/storage")) as unknown as {
  sqlite: InstanceType<typeof Database>;
  storage: { __beheerders: Map<number, any> };
};
const testDb = opslag.sqlite;
const beheerders = opslag.storage.__beheerders;

const { bepaalScope, vereisScope, vereisPrior, scopeVanVerzoek, SCOPE_PRIOR, SCOPE_GEEN } =
  await import("../server/scope-guard");
const { registerOrganisatieBeheerRoutes } = await import("../server/routes/organisatie-beheer");

function verzoek(sessie: Record<string, unknown> | null): any {
  return { session: sessie ?? undefined, query: { organisatie: "99" }, body: { organisatieId: 99 } };
}

function zetBeheerder(b: {
  id: number;
  organisatie?: string | null;
  isPrior?: boolean;
  actief?: boolean;
  organisatieId?: number | null;
}) {
  beheerders.set(b.id, {
    id: b.id,
    naam: `Beheerder ${b.id}`,
    organisatie: b.organisatie ?? null,
    isPrior: b.isPrior ?? false,
    actief: b.actief ?? true,
    organisatieId: b.organisatieId ?? null,
  });
}

async function metServer(app: express.Express, fn: (basis: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

beforeEach(() => {
  beheerders.clear();
});

// ── 1. bepaalScope ─────────────────────────────────────────────────────────

describe("bepaalScope", () => {
  it("geeft prior enkel wanneer isPrior EN de prior-organisatie samenvallen", async () => {
    zetBeheerder({ id: 1, isPrior: true, organisatie: PRIOR_ORGANISATIE });
    expect(await bepaalScope(verzoek({ adminId: 1 }))).toEqual(SCOPE_PRIOR);
  });

  it("geeft geen prior aan een klantbeheerder die de vlag toevallig draagt", async () => {
    // Dit is het hele punt van de dubbele voorwaarde: `isPrior` alleen zou
    // deze beheerder toegang geven tot alle organisaties.
    zetBeheerder({ id: 2, isPrior: true, organisatie: "Innovatech NV", organisatieId: 7 });
    expect(await bepaalScope(verzoek({ adminId: 2 }))).toEqual({
      soort: "organisatie",
      organisatieId: 7,
    });
  });

  it("geeft de organisatie-scope van een gekoppelde beheerder", async () => {
    zetBeheerder({ id: 3, organisatie: "Innovatech NV", organisatieId: 7 });
    expect(await bepaalScope(verzoek({ adminId: 3 }))).toEqual({
      soort: "organisatie",
      organisatieId: 7,
    });
  });

  it("geeft geen data aan een beheerder zonder koppeling", async () => {
    // Bewust "geen" en niet "alles": een niet-gekoppelde rij is een gat in de
    // migratie, en een gat mag geen platformbrede toegang worden.
    zetBeheerder({ id: 4, organisatie: "Onbekende NV", organisatieId: null });
    expect(await bepaalScope(verzoek({ adminId: 4 }))).toEqual(SCOPE_GEEN);
  });

  it("ontneemt een gedeactiveerde beheerder elke scope, ook een prior", async () => {
    zetBeheerder({ id: 5, isPrior: true, organisatie: PRIOR_ORGANISATIE, actief: false });
    expect(await bepaalScope(verzoek({ adminId: 5 }))).toEqual(SCOPE_GEEN);
  });

  it("geeft geen scope aan een sessie die naar een onbestaande beheerder wijst", async () => {
    expect(await bepaalScope(verzoek({ adminId: 404 }))).toEqual(SCOPE_GEEN);
  });

  it("geeft een coach dezelfde organisatie-scope als een beheerder", async () => {
    // Beslissing 2 van de opdrachtgever: een zelfstandige coach krijgt gewoon
    // de organisatie-scope van zijn organisatie.
    zetBeheerder({ id: 6, organisatie: "Coachpraktijk", organisatieId: 12 });
    expect(await bepaalScope(verzoek({ coachId: 6 }))).toEqual({
      soort: "organisatie",
      organisatieId: 12,
    });
  });

  it("laat de beheerder-sessie winnen van een organisatie-sessie", async () => {
    zetBeheerder({ id: 7, organisatie: "Innovatech NV", organisatieId: 7 });
    expect(await bepaalScope(verzoek({ adminId: 7, organisatieId: 99 }))).toEqual({
      soort: "organisatie",
      organisatieId: 7,
    });
  });

  it("leidt de scope af uit een organisatie-sessie zonder beheerder", async () => {
    expect(await bepaalScope(verzoek({ organisatieId: 4 }))).toEqual({
      soort: "organisatie",
      organisatieId: 4,
    });
  });

  it("geeft geen scope zonder sessie", async () => {
    expect(await bepaalScope(verzoek(null))).toEqual(SCOPE_GEEN);
    expect(await bepaalScope(verzoek({}))).toEqual(SCOPE_GEEN);
  });

  it("negeert een organisatie uit de query of de body", async () => {
    // verzoek() zet altijd query.organisatie=99 en body.organisatieId=99. Geen
    // enkele uitkomst hierboven mag daarop steunen; dit maakt het expliciet.
    const scope = await bepaalScope(verzoek({}));
    expect(scope).toEqual(SCOPE_GEEN);
    expect(JSON.stringify(scope)).not.toContain("99");
  });
});

// ── 2. De middleware ───────────────────────────────────────────────────────

describe("vereisScope en vereisPrior", () => {
  function antwoordDubbel() {
    const res: any = {
      status: (c: number) => {
        res.statusCode = c;
        return res;
      },
      json: (b: unknown) => {
        res.lichaam = b;
        return res;
      },
      statusCode: 200,
      lichaam: null as unknown,
    };
    return res;
  }

  it("laat een organisatie door en zet req.scope", async () => {
    zetBeheerder({ id: 1, organisatieId: 7 });
    const req = verzoek({ adminId: 1 });
    const res = antwoordDubbel();
    let door = false;
    await vereisScope(req, res, () => {
      door = true;
    });
    expect(door).toBe(true);
    expect(req.scope).toEqual({ soort: "organisatie", organisatieId: 7 });
    expect(scopeVanVerzoek(req)).toEqual({ soort: "organisatie", organisatieId: 7 });
  });

  it("weigert scope geen met 403", async () => {
    const req = verzoek({});
    const res = antwoordDubbel();
    let door = false;
    await vereisScope(req, res, () => {
      door = true;
    });
    expect(door).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("weigert een organisatie-scope bij vereisPrior met 403", async () => {
    zetBeheerder({ id: 1, organisatieId: 7 });
    const req = verzoek({ adminId: 1 });
    const res = antwoordDubbel();
    let door = false;
    await vereisPrior(req, res, () => {
      door = true;
    });
    expect(door).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("laat de prior door bij vereisPrior", async () => {
    zetBeheerder({ id: 1, isPrior: true, organisatie: PRIOR_ORGANISATIE });
    const req = verzoek({ adminId: 1 });
    const res = antwoordDubbel();
    let door = false;
    await vereisPrior(req, res, () => {
      door = true;
    });
    expect(door).toBe(true);
    expect(req.scope).toEqual(SCOPE_PRIOR);
  });

  it("werpt wanneer scopeVanVerzoek zonder middleware wordt gebruikt", () => {
    // Liever luid falen dan stil ongescopeerde gegevens teruggeven.
    expect(() => scopeVanVerzoek({} as any)).toThrow();
  });
});

// ── 3. De bestuursendpoints staan achter vereisPrior ───────────────────────

describe("prior-only endpoints", () => {
  const bron = readFileSync(new URL("../server/routes/financieel.ts", import.meta.url), "utf8");

  it("zet vereisPrior op de bestuurscijfers en de boekhoudexport", () => {
    for (const pad of [
      "/api/bestuur/kpis",
      "/api/bestuur/boekhoudexport",
      "/api/bestuur/boekhoudexport.csv",
    ]) {
      expect(bron).toContain(`app.get("${pad}", vereisPrior,`);
    }
  });

  it("importeert vereisPrior uit de scope-kern", () => {
    expect(bron).toContain('import { vereisPrior } from "../scope-guard";');
  });
});

// ── 4. Inloggegevens instellen is prior-only ───────────────────────────────

describe("PUT /api/organisaties/:id/login", () => {
  function app(sessie: Record<string, unknown>) {
    const a = express();
    a.use(express.json());
    a.use((req, _res, next) => {
      (req as any).session = sessie;
      next();
    });
    registerOrganisatieBeheerRoutes(a);
    return a;
  }

  beforeEach(() => {
    testDb.exec(`
      DROP TABLE IF EXISTS organisaties;
      CREATE TABLE organisaties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        login_email TEXT,
        wachtwoord_hash TEXT,
        login_actief INTEGER NOT NULL DEFAULT 0
      );
    `);
    const ins = testDb.prepare(`INSERT INTO organisaties (naam) VALUES (?)`);
    ins.run("Innovatech NV");
    ins.run("Academie De Horizon");
    zetBeheerder({ id: 1, isPrior: true, organisatie: PRIOR_ORGANISATIE });
    zetBeheerder({ id: 2, organisatie: "Innovatech NV", organisatieId: 1 });
  });

  async function zet(sessie: Record<string, unknown>, id: number, lichaam: unknown) {
    let uitkomst: { status: number; body: any } = { status: 0, body: null };
    await metServer(app(sessie), async (basis) => {
      const res = await fetch(`${basis}/api/organisaties/${id}/login`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lichaam),
      });
      uitkomst = { status: res.status, body: await res.json() };
    });
    return uitkomst;
  }

  it("staat de prior toe inloggegevens te zetten en geeft de hash niet terug", async () => {
    const res = await zet({ adminId: 1 }, 1, {
      email: "  INFO@Innovatech.BE ",
      wachtwoord: "eenlangwachtwoord",
      actief: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      organisatieId: 1,
      naam: "Innovatech NV",
      loginEmail: "info@innovatech.be",
      heeftWachtwoord: true,
      loginActief: true,
    });
    expect(JSON.stringify(res.body)).not.toContain("scrypt$");
  });

  it("weigert een organisatie die haar eigen inloggegevens wil zetten", async () => {
    expect((await zet({ adminId: 2 }, 1, { actief: true })).status).toBe(403);
  });

  it("weigert een verzoek zonder sessie", async () => {
    expect((await zet({}, 1, { actief: true })).status).toBe(403);
  });

  it("weigert een te kort wachtwoord", async () => {
    expect((await zet({ adminId: 1 }, 1, { wachtwoord: "kort" })).status).toBe(400);
  });

  it("weigert een e-mailadres dat al bij een andere organisatie hoort", async () => {
    await zet({ adminId: 1 }, 1, { email: "info@innovatech.be" });
    expect((await zet({ adminId: 1 }, 2, { email: "info@innovatech.be" })).status).toBe(409);
  });

  it("geeft 404 voor een onbestaande organisatie", async () => {
    expect((await zet({ adminId: 1 }, 999, { actief: true })).status).toBe(404);
  });
});
