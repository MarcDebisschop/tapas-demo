// ---------------------------------------------------------------------------
// tests/t4kids-rapport-toegang.test.ts
//
// Ingreep 3 uit de analyse van de vier instrumenttesten, twee kanten van
// dezelfde route:
//
//   a) De leesroute van het kindrapport stond open. Wie het oplopende afname-id
//      gokte, kon het volledige boekje van een kind lezen, met naam, keuzes en
//      eigen woorden. Nu vraagt ze hetzelfde bezitsbewijs als de inleverroutes.
//   b) Het bezitsbewijs leeft enkel in het tabblad waarin het kind de reis
//      maakte. Daarom is er een tweede weg met het dashboardtoken, zodat het
//      gezin het boekje ook later nog kan openen. Zonder die weg bleef het
//      dashboard \"Rapport in voorbereiding\" tonen bij een voltooide reis.
//
// Wat deze tests vastleggen:
//   1. Zonder bewijs: 404, met dezelfde tekst als bij een onbestaande afname.
//   2. Met een vreemd bewijs: 404.
//   3. Met het eigen bewijs: het contract, ongewijzigd.
//   4. Een ander instrument blijft 404 geven op deze route.
//   5. Langs het dashboardtoken: eigen afname is leesbaar, die van iemand
//      anders niet.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../server/storage", async () => {
  const { default: Db } = await import("better-sqlite3");
  const afnames = new Map<number, any>();
  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [],
    sqlite: new Db(":memory:"),
    db: {},
    storage: {
      __afnames: afnames,
      getAfname: async (id: number) => afnames.get(id),
      getDeelnemerByToken: async (token: string) =>
        token === "dash-token-ouder" ? { id: 1, email: "ouder@example.com" } : undefined,
      listAfnamesVoorDeelnemer: async (email: string) =>
        [...afnames.values()].filter((a) => a.deelnemerEmail === email),
    },
  };
});

const opslag = (await import("../server/storage")) as unknown as {
  storage: { __afnames: Map<number, any> };
};
const afnames = opslag.storage.__afnames;

const { registerT4KidsRapportRoutes } = await import("../server/routes/t4kids-rapport");

const BEWIJS = "bezitstoken-van-dit-kind";
const CONTRACT = { instrumentId: "t4kids", participant: { name: "Testkind" } };

function zetAfname(extra: Record<string, unknown> = {}): void {
  afnames.set(31, {
    id: 31,
    instrumentId: "t4kids",
    status: "voltooid",
    taal: "nl",
    bezitsToken: BEWIJS,
    inviteToken: null,
    respondentCode: "R31",
    deelnemerEmail: "ouder@example.com",
    generatorContract: JSON.stringify(CONTRACT),
    ...extra,
  });
}

async function haal(pad: string, koppen: Record<string, string> = {}) {
  const app = express();
  app.use(express.json());
  registerT4KidsRapportRoutes(app);
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, { headers: koppen });
    const tekst = await res.text();
    let body: any = tekst;
    try {
      body = JSON.parse(tekst);
    } catch {
      /* geen json */
    }
    return { status: res.status, body };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

beforeEach(() => {
  afnames.clear();
});

describe("het kindrapport is niet meer met een gegokt id te lezen", () => {
  it("geeft 404 zonder bezitsbewijs", async () => {
    zetAfname();
    const res = await haal("/api/afnames/31/t4kids-rapport.json");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Afname niet gevonden");
  });

  it("geeft 404 met het bewijs van een andere afname", async () => {
    zetAfname();
    const res = await haal("/api/afnames/31/t4kids-rapport.json", {
      "X-TaPas-Bewijs": "bewijs-van-iemand-anders",
    });
    expect(res.status).toBe(404);
  });

  it("geeft het contract met het eigen bewijs", async () => {
    zetAfname();
    const res = await haal("/api/afnames/31/t4kids-rapport.json", {
      "X-TaPas-Bewijs": BEWIJS,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(CONTRACT);
  });

  it("blijft 404 geven voor een afname van een ander instrument", async () => {
    zetAfname({ instrumentId: "t4teens" });
    const res = await haal("/api/afnames/31/t4kids-rapport.json", {
      "X-TaPas-Bewijs": BEWIJS,
    });
    expect(res.status).toBe(404);
  });
});

describe("het boekje blijft bereikbaar via het dashboardtoken", () => {
  it("geeft het contract voor een eigen afname", async () => {
    zetAfname();
    const res = await haal("/api/dashboard/dash-token-ouder/afname/31/t4kids-rapport.json");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(CONTRACT);
  });

  it("geeft 404 voor een afname die niet bij deze deelnemer hoort", async () => {
    zetAfname({ deelnemerEmail: "iemand.anders@example.com" });
    const res = await haal("/api/dashboard/dash-token-ouder/afname/31/t4kids-rapport.json");
    expect(res.status).toBe(404);
  });

  it("geeft 404 op een onbekend dashboardtoken", async () => {
    zetAfname();
    const res = await haal("/api/dashboard/geen-echt-token/afname/31/t4kids-rapport.json");
    expect(res.status).toBe(404);
  });

  it("meldt netjes dat het rapport nog niet klaar is", async () => {
    zetAfname({ generatorContract: null, status: "deel1" });
    const res = await haal("/api/dashboard/dash-token-ouder/afname/31/t4kids-rapport.json");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Rapport nog niet beschikbaar");
  });
});
