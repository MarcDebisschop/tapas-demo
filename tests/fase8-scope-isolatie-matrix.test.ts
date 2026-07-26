// ---------------------------------------------------------------------------
// tests/fase8-scope-isolatie-matrix.test.ts - Fase 8: de vier kerngevallen,
// systematisch over elk omgezet endpoint.
//
// Fase 5 testte per endpoint wat daar bijzonder aan is. Deze suite doet het
// omgekeerde: ze legt EEN tabel van endpoints aan en draait er dezelfde vier
// vragen over, zodat een nieuw endpoint dat aan de tabel wordt toegevoegd
// meteen volledig getoetst is en er geen geval per ongeluk overgeslagen wordt.
//
// De vier kerngevallen:
//   1. Organisatie A ziet enkel A.
//   2. Manipulatie van query of body naar B faalt (nooit 200 met B-gegevens).
//   3. De prior ziet alles.
//   4. Zonder scope volgt 403, nooit een stille terugval op "toon alles".
//
// Daarnaast een dekkingscontrole: elk data-endpoint in de omgezette routers
// staat achter een guard. Die vangt het geval waar de matrix per definitie
// blind voor is, namelijk een endpoint dat niemand aan de tabel toevoegde.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

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
        if (scope.soort === "geen") throw new Error("scope geen bereikte de datalaag");
        return alle.filter((a) => a.organisatieId === scope.organisatieId);
      },
      listRapporten: async (afnameId?: number) =>
        [...rapporten.values()].filter((r) => afnameId === undefined || r.afnameId === afnameId),
      gdprExport: async (id: number) => ({ afname: afnames.get(id) ?? null }),
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
const { registerAdminRoutes } = await import("../server/routes/admin");

const PRIOR = 1;
const BEHEERDER_A = 2;
const BEHEERDER_B = 3;

// Herkenbare tekenreeksen die ALLEEN bij organisatie B horen. Verschijnt er
// een van in een antwoord aan A, dan is er gelekt, ongeacht de statuscode.
const SPOREN_VAN_B = ["Org B", "Deelnemer van B", "<p>rapport van B</p>"];

type Registreer = (a: express.Express) => void;

interface Geval {
  naam: string;
  registreer: Registreer;
  /** Pad zoals A het zou proberen, met manipulatie richting organisatie B. */
  padAlsA: string;
  /** Wat A hoort te krijgen: 200 met enkel eigen data, of 403/404. */
  verwachtVoorA: number;
  /** Pad voor de prior; standaard hetzelfde als dat van A. */
  padAlsPrior?: string;
  verwachtVoorPrior?: number;
  methode?: "GET" | "POST";
  lichaam?: unknown;
}

function app(registreer: Registreer, als: string) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    if (als === "b") sessie.adminId = BEHEERDER_B;
    (req as any).session = sessie;
    next();
  });
  registreer(a);
  return a;
}

async function roep(g: Geval, als: string, pad: string) {
  const server = createServer(app(g.registreer, als));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: g.methode ?? "GET",
      ...(g.methode === "POST"
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(g.lichaam ?? {}) }
        : {}),
    });
    return { status: res.status, tekst: await res.text() };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

beforeEach(() => {
  beheerders.clear();
  afnames.clear();
  rapporten.clear();
  organisaties.clear();

  beheerders.set(PRIOR, {
    id: PRIOR, naam: "Prior", email: "p@x.be", organisatie: PRIOR_ORGANISATIE,
    isPrior: true, actief: true, organisatieId: null,
  });
  beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A, naam: "A", email: "a@x.be", organisatie: "Org A",
    isPrior: false, actief: true, organisatieId: 1,
  });
  beheerders.set(BEHEERDER_B, {
    id: BEHEERDER_B, naam: "B", email: "b@x.be", organisatie: "Org B",
    isPrior: false, actief: true, organisatieId: 2,
  });

  organisaties.set(1, { id: 1, naam: "Org A" });
  organisaties.set(2, { id: 2, naam: "Org B" });

  afnames.set(10, { id: 10, organisatieId: 1, name: "Deelnemer van A", status: "voltooid", generatorContract: null });
  afnames.set(20, { id: 20, organisatieId: 2, name: "Deelnemer van B", status: "voltooid", generatorContract: null });

  rapporten.set(100, { id: 100, afnameId: 10, variant: "kompas", titel: "A", inhoud: "{}", html: "<p>rapport van A</p>", contractVersie: "1", createdAt: "x" });
  rapporten.set(200, { id: 200, afnameId: 20, variant: "kompas", titel: "B", inhoud: "{}", html: "<p>rapport van B</p>", contractVersie: "1", createdAt: "x" });

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
});

// Elk geval manipuleert bewust richting organisatie B.
const GEVALLEN: Geval[] = [
  {
    naam: "GET /api/organisaties",
    registreer: registerFinancieelRoutes,
    padAlsA: "/api/organisaties",
    verwachtVoorA: 200,
  },
  {
    naam: "GET /api/organisaties/:id (B)",
    registreer: registerFinancieelRoutes,
    padAlsA: "/api/organisaties/2",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/organisaties/:id/saldo (B)",
    registreer: registerFinancieelRoutes,
    padAlsA: "/api/organisaties/2/saldo",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/organisaties/:id/tendenzen (B)",
    registreer: registerFinancieelRoutes,
    padAlsA: "/api/organisaties/2/tendenzen",
    verwachtVoorA: 403,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/rapporten/:id (van B)",
    registreer: registerRapportenRoutes,
    padAlsA: "/api/rapporten/200",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/rapporten/:id/html (van B)",
    registreer: registerRapportenRoutes,
    padAlsA: "/api/rapporten/200/html",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/rapporten?afnameId (van B)",
    registreer: registerRapportenRoutes,
    padAlsA: "/api/rapporten?afnameId=20",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/gdpr/afnames/:id/export (van B)",
    registreer: registerAfnameRoutes,
    padAlsA: "/api/gdpr/afnames/20/export",
    verwachtVoorA: 404,
    verwachtVoorPrior: 200,
  },
  {
    naam: "GET /api/admin/afnames",
    registreer: registerAdminRoutes,
    padAlsA: "/api/admin/afnames",
    verwachtVoorA: 200,
    padAlsPrior: "/api/admin/afnames",
  },
  {
    naam: "GET /api/organisatie/opvolging-per-instrument",
    registreer: registerOpvolgingRoutes,
    padAlsA: "/api/organisatie/opvolging-per-instrument?organisatie_id=2",
    verwachtVoorA: 200,
  },
  {
    naam: "GET /api/admin/opvolging-per-instrument",
    registreer: registerOpvolgingRoutes,
    padAlsA: "/api/admin/opvolging-per-instrument?organisatie_id=2",
    verwachtVoorA: 200,
  },
  {
    naam: "POST /api/uitnodigingen (op naam van B)",
    registreer: registerAfnameRoutes,
    padAlsA: "/api/uitnodigingen",
    methode: "POST",
    lichaam: { name: "Iemand", organisatieId: 2 },
    verwachtVoorA: 403,
    verwachtVoorPrior: 200,
  },
];

describe.each(GEVALLEN)("$naam", (g) => {
  it("kerngeval 1+2: A krijgt de verwachte uitkomst en nooit gegevens van B", async () => {
    const res = await roep(g, "a", g.padAlsA);
    expect(res.status).toBe(g.verwachtVoorA);
    for (const spoor of SPOREN_VAN_B) {
      // Ook bij een 200 mag er geen spoor van B in staan: een geslaagd
      // antwoord met andermans gegevens is het lek dat we dichten.
      expect(res.tekst, `spoor "${spoor}" lekte`).not.toContain(spoor);
    }
  });

  it("kerngeval 3: de prior komt er wel bij", async () => {
    const res = await roep(g, "prior", g.padAlsPrior ?? g.padAlsA);
    expect(res.status).toBe(g.verwachtVoorPrior ?? 200);
  });

  it("kerngeval 4: zonder scope volgt 403 en geen terugval op alles", async () => {
    const res = await roep(g, "niets", g.padAlsA);
    expect(res.status).toBe(403);
    for (const spoor of SPOREN_VAN_B) {
      expect(res.tekst, `spoor "${spoor}" lekte`).not.toContain(spoor);
    }
  });
});

// ── Dekkingscontrole ───────────────────────────────────────────────────────

describe("dekking: geen data-endpoint zonder guard", () => {
  const ROUTERS = [
    "server/routes/financieel.ts",
    "server/routes/rapporten.ts",
    "server/routes/opvolging.ts",
  ];

  it.each(ROUTERS)("%s registreert elk endpoint met een guard", (pad) => {
    const bron = readFileSync(pad, "utf8");
    const registraties = [
      ...bron.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"\s*,\s*([^\n]*)/g),
    ];
    expect(registraties.length).toBeGreaterThan(0);
    for (const [, , route, rest] of registraties) {
      expect(rest, `${pad} route ${route} mist een guard`).toMatch(
        /vereisAdmin|vereisPrior|vereisScope/,
      );
    }
  });

  it("leidt nergens in de omgezette routers de scope uit het verzoek af", () => {
    for (const pad of ROUTERS) {
      const bron = readFileSync(pad, "utf8");
      // De enige manier om aan een scope te komen is de middleware. Een
      // rechtstreekse `req.query.organisatie`-toewijzing aan een scope-variabele
      // zou het hele bouwwerk omzeilen.
      expect(bron, pad).not.toMatch(/const\s+scope\s*=\s*req\.(query|body|params)/);
    }
  });

  it("laat de datalaag luid falen op scope geen in plaats van een lege lijst", () => {
    // Een lege lijst is niet van een geslaagde query te onderscheiden en zou
    // een vergeten guard verbergen.
    const bron = readFileSync("server/scope.ts", "utf8");
    expect(bron).toMatch(/if \(scope\.soort === "geen"\) throw new ScopeFout\(functie\);/);
  });
});
