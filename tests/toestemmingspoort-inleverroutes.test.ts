// ---------------------------------------------------------------------------
// tests/toestemmingspoort-inleverroutes.test.ts
//
// Ingreep 1 uit de analyse van de vier instrumenttesten: de startstap met de
// toestemmingsvraag mag niet te omzeilen zijn. Bij het T4P Business Kompas
// (bevinding 1) en bij T4Kids (bevinding 2) kon deel 1 rechtstreeks ingeleverd
// worden op een verse uitnodiging, met een leeg toestemmingsveld en een lege
// leeftijdsband als gevolg.
//
// Wat deze tests vastleggen:
//   1. De zuivere controle (server/toestemming-poort.ts) weigert een afname
//      zonder vastgelegde toestemming en laat een correcte afname door.
//   2. Voor T4Kids en T4Teens sluit ook de leeftijdspoort van AVG artikel 8 op
//      wat er werkelijk in de databank staat, niet enkel op wat het scherm
//      meestuurde.
//   3. De melding volgt de taal van de afname.
//   4. Het endpoint POST /api/afnames/:id/main weigert met 403 zolang de
//      toestemming niet vastligt, en laat dezelfde inzending daarna door.
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
      updateAfname: async (id: number, data: any) => {
        const nieuw = { ...afnames.get(id), ...data };
        afnames.set(id, nieuw);
        return nieuw;
      },
      createRapport: async (data: any) => ({ id: 1, ...data }),
      listRapporten: async () => [],
      verbruik: async () => undefined,
      getSaldo: async () => ({ beschikbaar: 10, gereserveerd: 0, verbruikt: 0 }),
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  storage: { __afnames: Map<number, any> };
};
const afnames = opslag.storage.__afnames;

const { controleerToestemmingVastgelegd } = await import("../server/toestemming-poort");
const { registerAfnameRoutes } = await import("../server/routes/afnames");

const BEWIJS = "bezitstoken-voor-de-test";

function afname(extra: Record<string, unknown> = {}): any {
  return {
    id: 1,
    status: "deel1",
    instrumentId: null,
    taal: "nl",
    bezitsToken: BEWIJS,
    inviteToken: null,
    respondentCode: "R1",
    name: "Test",
    company: null,
    role: null,
    consentGiven: true,
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-08-19T10:00:00.000Z",
    leeftijdsband: null,
    ouderlijkeToestemming: false,
    ouderNaam: null,
    ouderEmail: null,
    mainResponses: null,
    itemTijden: null,
    ...extra,
  };
}

describe("de toestemming moet vastliggen voor er antwoorden ingeleverd worden", () => {
  it("weigert een afname waarin de startstap nooit doorlopen werd", () => {
    const uitspraak = controleerToestemmingVastgelegd(afname({ consentGiven: false }));
    expect(uitspraak.ok).toBe(false);
    expect(uitspraak.code).toBe("TOESTEMMING_ONTBREEKT");
    expect(uitspraak.melding).toContain("startpagina");
  });

  it("laat een afname met vastgelegde toestemming door", () => {
    expect(controleerToestemmingVastgelegd(afname()).ok).toBe(true);
  });

  it("geeft de melding in de taal van de afname", () => {
    const uitspraak = controleerToestemmingVastgelegd(
      afname({ consentGiven: false, taal: "fr" }),
    );
    expect(uitspraak.melding).toContain("consentement");
  });
});

describe("bij T4Kids en T4Teens sluit ook de leeftijdspoort op de opgeslagen gegevens", () => {
  it("weigert een T4Kids-afname zonder leeftijdsband", () => {
    const uitspraak = controleerToestemmingVastgelegd(afname({ instrumentId: "t4kids" }));
    expect(uitspraak.ok).toBe(false);
    expect(uitspraak.code).toBe("LEEFTIJDSPOORT");
  });

  it("weigert een T4Kids-afname zonder ouderlijke toestemming", () => {
    const uitspraak = controleerToestemmingVastgelegd(
      afname({ instrumentId: "t4kids", leeftijdsband: "10-12" }),
    );
    expect(uitspraak.ok).toBe(false);
    expect(uitspraak.code).toBe("LEEFTIJDSPOORT");
  });

  it("laat een volledig gedekte T4Kids-afname door", () => {
    const uitspraak = controleerToestemmingVastgelegd(
      afname({
        instrumentId: "t4kids",
        leeftijdsband: "10-12",
        ouderlijkeToestemming: true,
        ouderNaam: "Ouder Test",
        ouderEmail: "ouder@example.com",
      }),
    );
    expect(uitspraak.ok).toBe(true);
  });

  it("weigert een T4Teens-afname met een band die dit instrument niet aanvaardt", () => {
    const uitspraak = controleerToestemmingVastgelegd(
      afname({ instrumentId: "t4teens", leeftijdsband: "10-12" }),
    );
    expect(uitspraak.ok).toBe(false);
    expect(uitspraak.code).toBe("LEEFTIJDSPOORT");
  });

  it("laat een instrument zonder leeftijdspoort volledig ongemoeid", () => {
    expect(controleerToestemmingVastgelegd(afname({ instrumentId: "t4students" })).ok).toBe(true);
  });
});

async function leverDeel1In(id: number): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { save: (cb: (e?: unknown) => void) => cb() };
    next();
  });
  registerAfnameRoutes(app);
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}/api/afnames/${id}/main`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TaPas-Bewijs": BEWIJS },
      body: JSON.stringify({ responses: {}, itemTijden: {} }),
    });
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

describe("het inleverpad zelf weigert wanneer de toestemming niet vastligt", () => {
  beforeEach(() => {
    afnames.clear();
  });

  it("geeft 403 met een leesbare code op POST /main", async () => {
    afnames.set(7, afname({ id: 7, consentGiven: false }));
    const res = await leverDeel1In(7);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("TOESTEMMING_ONTBREEKT");
    // De afname blijft onaangeroerd staan: er is niets bewaard.
    expect(afnames.get(7).mainResponses).toBeNull();
  });

  it("laat dezelfde inzending door zodra de toestemming vastligt", async () => {
    afnames.set(8, afname({ id: 8 }));
    const res = await leverDeel1In(8);
    expect(res.status).not.toBe(403);
  });
});
