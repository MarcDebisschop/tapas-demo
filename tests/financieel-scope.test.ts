// ---------------------------------------------------------------------------
// tests/financieel-scope.test.ts - de financiele paden zijn per organisatie
// afgeschermd.
//
// De scoping van fase 3 tot 8 dekte de afnames, de rapporten en de opvolging.
// De financiele paden bleven achter `vereisAdmin`, en die guard vraagt enkel
// "is er een beheerderssessie", niet WELKE beheerder. Zolang elke beheerder de
// hoofdbeheerder is valt dat niet op, maar een beheerder die aan een
// organisatie hangt kon langs dat pad de facturen, betalingen, creditnotas en
// het creditgrootboek van ALLE organisaties opvragen.
//
// Deze suite legt vier eisen vast:
//   1. Een organisatie ziet in elke financiele lijst enkel haar eigen regels.
//   2. Manipulatie van de query naar een andere organisatie faalt.
//   3. Een los document van een andere organisatie geeft 404, nooit de inhoud.
//   4. Geld toekennen en platformbeheer blijven voorbehouden aan de
//      hoofdbeheerder.
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
  const organisaties = new Map<number, any>();
  const facturen = new Map<number, any>();
  const creditnotas = new Map<number, any>();
  const betalingen = new Map<number, any>();
  const transacties: any[] = [];
  const opgeladen: any[] = [];

  const perOrg = <T extends { organisatieId: number }>(rijen: T[], orgId?: number) =>
    orgId === undefined ? rijen : rijen.filter((r) => r.organisatieId === orgId);

  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [{ id: "start", credits: 10 }],
    sqlite: new Db(":memory:"),
    db: {},
    storage: {
      __beheerders: beheerders,
      __organisaties: organisaties,
      __facturen: facturen,
      __creditnotas: creditnotas,
      __betalingen: betalingen,
      __transacties: transacties,
      __opgeladen: opgeladen,
      getBeheerder: async (id: number) => beheerders.get(id),
      getOrganisatie: async (id: number) => organisaties.get(id),
      listOrganisaties: async () => [...organisaties.values()],
      getSaldo: async () => ({ beschikbaar: 10, gereserveerd: 0, verbruikt: 0 }),
      listFacturen: async (orgId?: number) => perOrg([...facturen.values()], orgId),
      getFactuur: async (id: number) => facturen.get(id),
      listCreditnotas: async (orgId?: number) => perOrg([...creditnotas.values()], orgId),
      getCreditnota: async (id: number) => creditnotas.get(id),
      listBetalingen: async (orgId?: number) => perOrg([...betalingen.values()], orgId),
      getBetaling: async (id: number) => betalingen.get(id),
      listTransacties: async (orgId?: number) => perOrg(transacties, orgId),
      laadCredits: async (organisatieId: number, aantal: number) => {
        opgeladen.push({ organisatieId, aantal });
        return { beschikbaar: aantal, gereserveerd: 0, verbruikt: 0 };
      },
      overdracht: async () => undefined,
      listBillers: async () => [],
      getActieveBiller: async () => null,
      bestuursKpis: async () => ({ omzet: 0 }),
      boekhoudExport: async () => [],
      startBetaling: async (organisatieId: number, credits: number) => ({
        id: 900,
        organisatieId,
        credits,
      }),
      maakCreditnota: async () => {
        throw new Error("mag niet bereikt worden");
      },
      updateFactuurBetaalstatus: async (id: number) => facturen.get(id),
      updateOrganisatieHuisstijl: async (id: number) => organisaties.get(id),
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  storage: Record<string, any>;
};
const S = opslag.storage;

const { registerFinancieelRoutes } = await import("../server/routes/financieel");

const PRIOR = 1;
const BEHEERDER_A = 2;

/** Alles wat uitsluitend bij organisatie B hoort. Duikt het op bij A, dan lekt het. */
const SPOREN_VAN_B = ["FACT-B-001", "CN-B-001", "betaling van B", "grootboek van B", "Org B"];

function app(als: "prior" | "a" | "geen") {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    (req as any).session = sessie;
    next();
  });
  registerFinancieelRoutes(a);
  return a;
}

async function roep(
  als: "prior" | "a" | "geen",
  pad: string,
  opties: { methode?: string; lichaam?: unknown } = {},
): Promise<{ status: number; tekst: string }> {
  const server = createServer(app(als));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const methode = opties.methode ?? "GET";
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: methode,
      ...(methode === "GET"
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opties.lichaam ?? {}),
          }),
    });
    return { status: res.status, tekst: await res.text() };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

function document(nummer: string, organisatieId: number) {
  return {
    factuurnummer: nummer,
    creditnotanummer: nummer,
    organisatieId,
    billerEntiteitId: 1,
    billerSnapshot: "{}",
    klantSnapshot: "{}",
    regels: "[]",
    peppolDocument: JSON.stringify({ nummer }),
    betaalstatus: "openstaand",
    vervaldatum: null,
    munt: "EUR",
    bedragExclBtw: 100,
    btwBedrag: 21,
    bedragInclBtw: 121,
  };
}

beforeEach(() => {
  S.__beheerders.clear();
  S.__organisaties.clear();
  S.__facturen.clear();
  S.__creditnotas.clear();
  S.__betalingen.clear();
  S.__transacties.length = 0;
  S.__opgeladen.length = 0;

  S.__beheerders.set(PRIOR, {
    id: PRIOR, naam: "Prior", email: "p@x.be", organisatie: PRIOR_ORGANISATIE,
    isPrior: true, actief: true, organisatieId: null,
  });
  S.__beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A, naam: "A", email: "a@x.be", organisatie: "Org A",
    isPrior: false, actief: true, organisatieId: 1,
  });

  S.__organisaties.set(1, { id: 1, naam: "Org A" });
  S.__organisaties.set(2, { id: 2, naam: "Org B" });

  S.__facturen.set(11, { id: 11, ...document("FACT-A-001", 1) });
  S.__facturen.set(22, { id: 22, ...document("FACT-B-001", 2) });
  S.__creditnotas.set(31, { id: 31, ...document("CN-A-001", 1) });
  S.__creditnotas.set(42, { id: 42, ...document("CN-B-001", 2) });
  S.__betalingen.set(51, { id: 51, organisatieId: 1, omschrijving: "betaling van A" });
  S.__betalingen.set(62, { id: 62, organisatieId: 2, omschrijving: "betaling van B" });
  S.__transacties.push(
    { id: 71, organisatieId: 1, omschrijving: "grootboek van A", aantal: 5 },
    { id: 82, organisatieId: 2, omschrijving: "grootboek van B", aantal: 7 },
  );
});

// ── 1. Lijsten tonen enkel de eigen organisatie ────────────────────────────

const LIJSTEN = [
  "/api/facturen",
  "/api/creditnotas",
  "/api/betalingen",
  "/api/credits/transacties",
];

describe("een organisatie ziet in elke financiele lijst enkel zichzelf", () => {
  it.each(LIJSTEN)("%s bevat geen spoor van een andere organisatie", async (pad) => {
    const res = await roep("a", pad);
    expect(res.status).toBe(200);
    for (const spoor of SPOREN_VAN_B) {
      expect(res.tekst, `${pad} lekt ${spoor}`).not.toContain(spoor);
    }
  });

  it.each(LIJSTEN)("%s toont de prior wel alles", async (pad) => {
    const res = await roep("prior", pad);
    expect(res.status).toBe(200);
    expect(res.tekst).toMatch(/FACT-B-001|CN-B-001|betaling van B|grootboek van B/);
  });

  it.each(LIJSTEN)("%s weigert een gevraagd filter naar een andere organisatie", async (pad) => {
    const res = await roep("a", `${pad}?organisatieId=2`);
    expect(res.status).toBe(403);
    for (const spoor of SPOREN_VAN_B) {
      expect(res.tekst).not.toContain(spoor);
    }
  });

  it.each(LIJSTEN)("%s staat het eigen nummer als filter wel toe", async (pad) => {
    const res = await roep("a", `${pad}?organisatieId=1`);
    expect(res.status).toBe(200);
  });

  it.each(LIJSTEN)("%s weigert een verzoek zonder enige aanmelding", async (pad) => {
    const res = await roep("geen", pad);
    expect(res.status).toBe(403);
  });
});

// ── 2. Losse documenten van een andere organisatie bestaan niet ────────────

const DOCUMENTEN_VAN_B = [
  "/api/facturen/22",
  "/api/facturen/22/peppol.json",
  "/api/facturen/22/pdf",
  "/api/creditnotas/42",
  "/api/creditnotas/42/peppol.json",
  "/api/betalingen/62",
];

describe("een document van een andere organisatie geeft 404", () => {
  it.each(DOCUMENTEN_VAN_B)("%s is voor A onvindbaar", async (pad) => {
    const res = await roep("a", pad);
    expect(res.status).toBe(404);
    for (const spoor of SPOREN_VAN_B) {
      expect(res.tekst, `${pad} lekt ${spoor}`).not.toContain(spoor);
    }
  });
});

describe("het eigen document blijft gewoon bereikbaar", () => {
  it("A leest haar eigen factuur", async () => {
    const res = await roep("a", "/api/facturen/11");
    expect(res.status).toBe(200);
    expect(res.tekst).toContain("FACT-A-001");
  });

  it("A leest haar eigen creditnota", async () => {
    const res = await roep("a", "/api/creditnotas/31");
    expect(res.status).toBe(200);
    expect(res.tekst).toContain("CN-A-001");
  });

  it("A leest haar eigen betaling", async () => {
    const res = await roep("a", "/api/betalingen/51");
    expect(res.status).toBe(200);
    expect(res.tekst).toContain("betaling van A");
  });

  it("de prior leest het document van B wel", async () => {
    const res = await roep("prior", "/api/facturen/22");
    expect(res.status).toBe(200);
    expect(res.tekst).toContain("FACT-B-001");
  });
});

// ── 3. Geld toekennen en platformbeheer blijven bij de hoofdbeheerder ──────

const ENKEL_PRIOR: Array<[string, string, unknown]> = [
  ["POST", "/api/credits/opladen", { organisatieId: 1, aantal: 100 }],
  ["POST", "/api/credits/overdracht", { vanOrganisatieId: 1, naarOrganisatieId: 2, aantal: 5 }],
  ["POST", "/api/organisaties", { naam: "Nieuw" }],
  ["GET", "/api/billers", null],
  ["GET", "/api/billers/actief", null],
  ["POST", "/api/billers", { naam: "X" }],
  ["POST", "/api/billers/1/activeer", null],
  ["PUT", "/api/billers/1/huisstijl", { huisstijlKleur: "#000000" }],
  ["POST", "/api/betalingen/51/bevestig", {}],
  ["POST", "/api/betalingen/51/mislukt", {}],
  ["PATCH", "/api/facturen/11/betaalstatus", { betaalstatus: "betaald" }],
  ["POST", "/api/creditnotas", { factuurId: 11, reden: "test" }],
  ["GET", "/api/bestuur/kpis", null],
  ["GET", "/api/bestuur/boekhoudexport", null],
  ["GET", "/api/bestuur/boekhoudexport.csv", null],
];

describe("geld toekennen en platformbeheer zijn voorbehouden aan de hoofdbeheerder", () => {
  it.each(ENKEL_PRIOR)("%s %s weigert een organisatiebeheerder", async (methode, pad, lichaam) => {
    const res = await roep("a", pad, { methode, lichaam });
    expect(res.status, `${methode} ${pad}`).toBe(403);
  });

  it("een organisatiebeheerder kan zichzelf geen credits toekennen", async () => {
    const res = await roep("a", "/api/credits/opladen", {
      methode: "POST",
      lichaam: { organisatieId: 1, aantal: 999999 },
    });
    expect(res.status).toBe(403);
    expect(S.__opgeladen).toHaveLength(0);
  });
});

// ── 4. Bronanalyse: de zwakke guard komt niet terug ────────────────────────

describe("bronanalyse van server/routes/financieel.ts", () => {
  const BRON = "server/routes/financieel.ts";

  it("registreert geen enkel pad meer met de guard die de organisatie niet kent", () => {
    const bron = readFileSync(BRON, "utf8");
    const zwak = [
      ...bron.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"\s*,\s*vereisAdmin\b/g),
    ].map((m) => `${m[1].toUpperCase()} ${m[2]}`);
    expect(zwak, `deze paden staan nog achter vereisAdmin: ${zwak.join(", ")}`).toEqual([]);
  });

  it("registreert elk pad achter een guard die de organisatie wel kent", () => {
    const bron = readFileSync(BRON, "utf8");
    const registraties = [
      ...bron.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"\s*,\s*([^\n]*)/g),
    ];
    expect(registraties.length).toBeGreaterThan(20);
    for (const [, methode, pad, rest] of registraties) {
      expect(rest, `${methode.toUpperCase()} ${pad} mist een scope-bewuste guard`).toMatch(
        /vereisPrior|vereisScope/,
      );
    }
  });

  it("leest de gevraagde organisatie op precies een plaats, in de gedeelde helper", () => {
    // Elk lijstpad hoort door de gedeelde helper te gaan, niet door een eigen
    // lezing van de query; anders staat de beperking op de ene plaats en de
    // omzeiling op de andere.
    //
    // Commentaarregels tellen niet mee: die voeren niets uit. Een eerdere,
    // grovere versie van deze controle telde ook de uitleg boven de helper en
    // sloeg dus alarm op tekst die niets doet.
    const codeRegels = readFileSync(BRON, "utf8")
      .split("\n")
      .filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r));
    const rechtstreeks = codeRegels.filter((r) => r.includes("req.query.organisatieId"));
    expect(rechtstreeks, rechtstreeks.join(" | ")).toHaveLength(1);
    expect(rechtstreeks[0]).toContain("const ruw = req.query.organisatieId");
  });
});
