// ---------------------------------------------------------------------------
// tests/fase7-frontend-portaal.test.ts - Fase 7: de frontend weet wat ze mag
// tonen, en er is een organisatieportaal.
//
// Wat de tests bewijzen:
//   1. `/api/admin/me` levert de scope, uit dezelfde bron als de guards. Een
//      scherm dat enkel naar `isPrior` keek zou ruimer zijn dan de server,
//      want prior is `isPrior` EN de prior-organisatie.
//   2. Het beheerscherm leidt zijn zichtbaarheid af uit die scope: de
//      organisatiekeuze en de platformbrede financiele schermen zijn
//      prior-only, en de organisatiecontext staat in beeld.
//   3. Er is een OrganisatieLoginGate die `/api/organisatie/me` bevraagt, en
//      een portaal dat GEEN organisatie_id meestuurt.
//
// Dit zijn broncontroles en geen renders: het project heeft geen
// DOM-testomgeving en die hier binnenhalen zou de bestaande suite raken. De
// echte grendel zit op de server en die is in fase 5 uitputtend getest; wat
// hier telt is dat het scherm de scope van de server volgt en niet zelf
// verzint.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

vi.mock("../server/storage", () => {
  const beheerders = new Map<number, any>();
  const organisaties = new Map<number, any>();
  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [],
    sqlite: {},
    db: {},
    storage: {
      __beheerders: beheerders,
      __organisaties: organisaties,
      getBeheerder: async (id: number) => beheerders.get(id),
      getOrganisatie: async (id: number) => organisaties.get(id),
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  storage: { __beheerders: Map<number, any>; __organisaties: Map<number, any> };
};
const { __beheerders: beheerders, __organisaties: organisaties } = opslag.storage;
const { registerAdminRoutes } = await import("../server/routes/admin");

const PRIOR = 1;
const BEHEERDER_A = 2;
const LOS = 3;

async function haalMij(als: string) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    if (als === "los") sessie.adminId = LOS;
    (req as any).session = sessie;
    next();
  });
  registerAdminRoutes(a);
  const server = createServer(a);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}/api/admin/me`);
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

beforeEach(() => {
  beheerders.clear();
  organisaties.clear();
  organisaties.set(1, { id: 1, naam: "Org A" });
  beheerders.set(PRIOR, {
    id: PRIOR, naam: "Prior", email: "p@x.be", organisatie: PRIOR_ORGANISATIE,
    isPrior: true, actief: true, organisatieId: null,
  });
  beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A, naam: "A", email: "a@x.be", organisatie: "Org A",
    isPrior: false, actief: true, organisatieId: 1,
  });
  // Beheerder met de prior-vlag maar zonder de prior-organisatie. Precies het
  // geval waarin `isPrior` alleen te ruim zou zijn.
  beheerders.set(LOS, {
    id: LOS, naam: "Los", email: "l@x.be", organisatie: "Org A",
    isPrior: true, actief: true, organisatieId: 1,
  });
});

// ── 1. /api/admin/me levert de scope ───────────────────────────────────────

describe("GET /api/admin/me levert de scope", () => {
  it("geeft de prior scope prior en geen organisatie", async () => {
    const res = await haalMij("prior");
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe("prior");
    expect(res.body.organisatieId).toBeNull();
    expect(res.body.organisatieNaam).toBeNull();
  });

  it("geeft een organisatiebeheerder haar eigen organisatie met naam", async () => {
    const res = await haalMij("a");
    expect(res.body.scope).toBe("organisatie");
    expect(res.body.organisatieId).toBe(1);
    expect(res.body.organisatieNaam).toBe("Org A");
  });

  it("geeft geen prior-scope aan wie enkel de vlag heeft", async () => {
    // DE KERN: `isPrior` staat op true, maar de organisatie is niet de
    // prior-organisatie. Een scherm dat op de vlag stuurt zou hier de
    // platformschermen tonen; de scope zegt terecht "organisatie".
    const res = await haalMij("los");
    expect(res.body.isPrior).toBe(true);
    expect(res.body.scope).toBe("organisatie");
    expect(res.body.organisatieId).toBe(1);
  });

  it("weigert zonder sessie", async () => {
    expect((await haalMij("niets")).status).toBe(401);
  });
});

// ── 2. Het beheerscherm volgt de scope ─────────────────────────────────────

describe("admin.tsx volgt de scope van de server", () => {
  const bron = readFileSync(new URL("../client/src/pages/admin.tsx", import.meta.url), "utf8");

  it("leidt isPrior af uit de scope en niet uit de vlag", () => {
    expect(bron).toContain('mijnProfiel?.scope === "prior"');
    expect(bron).not.toContain("mijnProfiel?.isPrior === true");
  });

  it("toont de organisatiekeuze enkel aan de prior", () => {
    expect(bron).toMatch(/const openOrganisaties = isPrior &&/);
  });

  it("toont de organisatiecontext", () => {
    expect(bron).toContain("U bekijkt:");
    expect(bron).toContain('data-testid="tekst-organisatiecontext"');
  });

  it("verbergt de platformbrede financiele schermen voor een organisatie", () => {
    // Instrument-prijzen en factuur-huisstijl gelden platformbreed. Credits en
    // saldo blijven wel staan: dat is het eigen saldo van de organisatie.
    const prijzen = bron.indexOf('data-testid="link-prijzen"');
    const huisstijl = bron.indexOf('data-testid="link-factuurhuisstijl"');
    const gate = bron.indexOf("{isPrior && (");
    expect(gate).toBeGreaterThan(-1);
    expect(prijzen).toBeGreaterThan(gate);
    expect(huisstijl).toBeGreaterThan(gate);
    expect(bron.indexOf('data-testid="link-credits"')).toBeLessThan(gate);
  });
});

// ── 3. Het organisatieportaal ──────────────────────────────────────────────

describe("organisatieportaal", () => {
  const gate = readFileSync(
    new URL("../client/src/components/OrganisatieLoginGate.tsx", import.meta.url),
    "utf8",
  );
  const paneel = readFileSync(
    new URL("../client/src/pages/organisatie-dashboard.tsx", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

  it("bevraagt /api/organisatie/me", () => {
    expect(gate).toContain('queryKey: ["/api/organisatie/me"]');
    expect(gate).toContain('on401: "returnNull"');
  });

  it("heeft geen demo-terugval op vaste inloggegevens", () => {
    // De admin- en coachgate hebben die wel. Een organisatieportaal toont
    // klantgegevens en mag niet met een lege inlog te bereiken zijn.
    expect(gate).not.toContain("demoCreds");
    expect(gate).not.toContain("DEMO_MODE");
  });

  it("stuurt vanuit het portaal geen organisatie_id mee", () => {
    // Zou het scherm dat doen, dan suggereerde het een keuze die de server
    // toch weigert.
    expect(paneel).not.toContain("organisatie_id");
    expect(paneel).toContain('queryKey: ["/api/organisatie/opvolging-per-instrument"]');
  });

  it("toont welke organisatie in beeld is en haalt die uit de sessie", () => {
    expect(paneel).toContain("U bekijkt: {organisatie.naam}");
    expect(paneel).toContain("useOrganisatieAuth()");
  });

  it("hangt de route achter de gate", () => {
    expect(app).toMatch(
      /<Route path="\/organisatie">\{\(\) => <OrganisatieLoginGate><OrganisatieDashboard \/><\/OrganisatieLoginGate>\}<\/Route>/,
    );
  });
});
