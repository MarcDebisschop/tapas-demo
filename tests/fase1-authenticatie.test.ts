// ---------------------------------------------------------------------------
// tests/fase1-authenticatie.test.ts - Fase 1 van de organisatie-scoping:
// geen enkel data-endpoint staat nog open.
//
// Wat de tests bewijzen:
//   1. Elk endpoint in financieel.ts (32) en rapporten.ts (6) is geregistreerd
//      met `vereisAdmin`. Deze bestanden hadden nul auth-referenties.
//   2. GET /api/admin/afnames/:id weigert zonder sessie en geeft de
//      dashboardToken niet langer mee. Die token zit achter een aparte,
//      geauditeerde actie.
//   3. GET /api/afnames/:id geeft aan een niet-beheerder enkel de velden die de
//      vragenlijst nodig heeft, en aan een beheerder de volledige rij.
//   4. POST /api/uitnodigingen weigert zonder sessie.
//   5. De coach-login vraagt buiten demo-modus een geldig wachtwoord.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { hashWachtwoord } from "../server/auth/wachtwoord";

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

// Simuleer express-session: ?admin=1 zet een adminId. Zo blijft de test los van
// de sessie-store, net zoals in tests/gdpr-toegangscontrole.test.ts.
function metSessie(app: express.Express) {
  app.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    if (req.query.admin === "1") sessie.adminId = 7;
    (req as any).session = sessie;
    next();
  });
}

// De afname die de gemockte opslag teruggeeft. Bevat bewust gevoelige velden:
// de test controleert dat een niet-beheerder die niet te zien krijgt.
const AFNAME = {
  id: 1,
  status: "bezig",
  taal: "nl",
  instrumentId: "t4p-business-kompas",
  name: "Test Deelnemer",
  leeftijdsband: null,
  ouderlijkeToestemming: false,
  respondentCode: "TST-1",
  deelnemerEmail: "deelnemer@example.com",
  organisatieId: 42,
  mainResponses: null,
  connectionAnswers: null,
  generatorContract: JSON.stringify({ instrumentId: "t4p-business-kompas" }),
};

let beheerderInOpslag: any = null;

vi.mock("../server/storage", () => {
  class CreditError extends Error {}
  return {
    CreditError,
    CREDITPAKKETTEN: [],
    sqlite: {},
    db: {},
    storage: {
      async getAfname() {
        return AFNAME;
      },
      async getDeelnemerByEmail() {
        return { dashboardToken: "geheime-token" };
      },
      async getBeheerderByEmail() {
        return beheerderInOpslag;
      },
      async getBeheerder() {
        return beheerderInOpslag;
      },
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const { registerAdminRoutes } = await import("../server/routes/admin");
const { registerAfnameRoutes } = await import("../server/routes/afnames");
const { registerStmRoutes } = await import("../server/routes-stm");

// ── 1. Bestanden die volledig zonder guard stonden ─────────────────────────

describe("elk endpoint in financieel.ts en rapporten.ts staat achter vereisAdmin", () => {
  // Deze twee routers hadden nul auth-referenties: iedereen kon facturen,
  // saldi, boekhoudexports en rapporten opvragen.
  function registraties(pad: string) {
    const bron = readFileSync(pad, "utf8");
    return [...bron.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"\s*,\s*([^\n]*)/g)];
  }

  it("financieel.ts: alle 32 endpoints", () => {
    // Fase 3 verscherpte drie van de 32 van vereisAdmin naar vereisPrior. De
    // eis blijft dat geen enkele registratie zonder guard staat; welke van de
    // twee het is, bewaakt de fase-3 suite.
    const gevonden = registraties("server/routes/financieel.ts");
    expect(gevonden.length).toBe(32);
    for (const [, , pad, rest] of gevonden) {
      expect(rest, `route ${pad} mist een guard`).toMatch(/vereisAdmin|vereisPrior/);
    }
  });

  it("rapporten.ts: alle 6 endpoints", () => {
    const gevonden = registraties("server/routes/rapporten.ts");
    expect(gevonden.length).toBe(6);
    for (const [, , pad, rest] of gevonden) {
      expect(rest, `route ${pad} mist vereisAdmin`).toContain("vereisAdmin");
    }
  });

  it("heeft de prior-only TODO van fase 1 opgelost", () => {
    // Fase 1 liet hier een TODO staan voor de platformbrede cijfers. Fase 3
    // heeft die vervangen door een echte vereisPrior-guard, dus de marker mag
    // niet meer bestaan: een blijvende TODO zou een openstaand lek suggereren
    // dat er niet meer is.
    const bron = readFileSync("server/routes/financieel.ts", "utf8");
    expect(bron).not.toContain("TODO prior-only vanaf fase 3/5");
  });
});

// ── 2. Afnamedetail: guard + geen dashboardToken meer ──────────────────────

describe("GET /api/admin/afnames/:id", () => {
  function app() {
    const a = express();
    a.use(express.json());
    metSessie(a);
    registerAdminRoutes(a);
    return a;
  }

  it("weigert zonder admin-sessie met 401", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/admin/afnames/1`);
      expect(res.status).toBe(401);
    });
  });

  it("geeft met sessie het profiel maar zonder dashboardToken", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/admin/afnames/1?admin=1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(1);
      // De token gaf rechtstreeks toegang tot het deelnemersdashboard.
      expect(body).not.toHaveProperty("dashboardToken");
      expect(JSON.stringify(body)).not.toContain("geheime-token");
    });
  });

  it("levert de token enkel via de aparte, geauditeerde actie", async () => {
    await metServer(app(), async (basis) => {
      const zonder = await fetch(`${basis}/api/admin/afnames/1/dashboardtoken`);
      expect(zonder.status).toBe(401);

      const met = await fetch(`${basis}/api/admin/afnames/1/dashboardtoken?admin=1`);
      expect(met.status).toBe(200);
      expect((await met.json()).dashboardToken).toBe("geheime-token");
    });
  });
});

// ── 3. Afname ophalen: veldniveau in plaats van endpointniveau ─────────────

describe("GET /api/afnames/:id", () => {
  function app() {
    const a = express();
    a.use(express.json());
    metSessie(a);
    registerAfnameRoutes(a);
    return a;
  }

  it("geeft een niet-beheerder enkel wat de vragenlijst nodig heeft", async () => {
    // De deelnemer vult zelf in en heeft geen adminsessie; het endpoint kan dus
    // niet volledig dicht. Wel mag hij geen profieldata terugkrijgen.
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/afnames/1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Object.keys(body).sort()).toEqual([
        "id",
        "instrumentId",
        "leeftijdsband",
        "name",
        "ouderlijkeToestemming",
        "status",
        "taal",
      ]);
      expect(body).not.toHaveProperty("generatorContract");
      expect(body).not.toHaveProperty("deelnemerEmail");
      expect(body).not.toHaveProperty("organisatieId");
    });
  });

  it("geeft een beheerder de volledige rij", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/afnames/1?admin=1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deelnemerEmail).toBe("deelnemer@example.com");
      expect(body.organisatieId).toBe(42);
    });
  });

  it("weigert POST /api/uitnodigingen zonder admin-sessie", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/uitnodigingen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Iemand" }),
      });
      expect(res.status).toBe(401);
    });
  });
});

// ── 4. Coach-login vraagt buiten demo een wachtwoord ───────────────────────

describe("POST /api/coach/login buiten demo-modus", () => {
  // De coachsessie geeft dezelfde praktijkrechten als een adminsessie, dus ze
  // mag niet met een e-mailadres alleen te verkrijgen zijn.
  function app() {
    const a = express();
    a.use(express.json());
    metSessie(a);
    // registerStmRoutes krijgt de opslag als parameter mee, niet via de module.
    registerStmRoutes(a, {
      getBeheerderByEmail: async () => beheerderInOpslag,
      getBeheerder: async () => beheerderInOpslag,
    } as any);
    return a;
  }

  async function login(body: Record<string, unknown>) {
    let uitkomst: { status: number; body: any } = { status: 0, body: null };
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/coach/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      uitkomst = { status: res.status, body: await res.json() };
    });
    return uitkomst;
  }

  beforeEach(() => {
    beheerderInOpslag = null;
  });

  it("weigert een login zonder wachtwoord met 401", async () => {
    beheerderInOpslag = { id: 3, naam: "Coach", email: "c@x.be", actief: true, wachtwoordHash: null };
    expect((await login({ email: "c@x.be" })).status).toBe(401);
  });

  it("weigert met 403 wanneer er nog geen wachtwoord is ingesteld", async () => {
    beheerderInOpslag = { id: 3, naam: "Coach", email: "c@x.be", actief: true, wachtwoordHash: null };
    expect((await login({ email: "c@x.be", wachtwoord: "iets" })).status).toBe(403);
  });

  it("weigert een verkeerd wachtwoord met 401", async () => {
    beheerderInOpslag = {
      id: 3,
      naam: "Coach",
      email: "c@x.be",
      actief: true,
      wachtwoordHash: await hashWachtwoord("juist"),
    };
    expect((await login({ email: "c@x.be", wachtwoord: "fout" })).status).toBe(401);
  });

  it("laat het juiste wachtwoord door", async () => {
    beheerderInOpslag = {
      id: 3,
      naam: "Coach",
      email: "c@x.be",
      actief: true,
      wachtwoordHash: await hashWachtwoord("juist"),
    };
    const res = await login({ email: "c@x.be", wachtwoord: "juist" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("houdt de demo-modus e-mail-only", () => {
    // In demo vult de publieke demo alles automatisch in; het wachtwoordblok
    // staat daarom expliciet achter `if (!DEMO_MODE)`.
    const bron = readFileSync("server/routes-stm.ts", "utf8");
    expect(bron).toContain('const DEMO_MODE = process.env.TAPAS_DEMO === "1"');
    expect(bron).toMatch(/if \(!DEMO_MODE\) \{[\s\S]*?verifieerWachtwoord/);
  });
});
