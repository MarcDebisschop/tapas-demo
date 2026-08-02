// ---------------------------------------------------------------------------
// tests/verplicht-doorklikken-endpoint.test.ts
//
// Punt 3 van de opdracht: ook aan de serverkant. Een invulscherm kan omzeild
// worden, dus het endpoint dat een afname afrondt moet een onvolledige
// inzending zelf weigeren.
//
// Wat deze tests vastleggen:
//   1. POST /api/afnames/:id/connection weigert een afname met ontbrekende
//      blokken, met een vriendelijke melding en zonder de afname af te ronden.
//   2. Een volledige afname wordt door deze regel niet tegengehouden.
//   3. De melding volgt de taal van de afname.
//   4. Instrumenten waarvan de server de vragenset niet kent, gaan ongewijzigd
//      door. Zo kan deze regel geen enkele bestaande afname buitensluiten.
//   5. Bestaande afnames gaan hier nooit langs: de controle staat op het
//      inleverpad, niet op het lees- of rapportpad.
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
        const bestaand = afnames.get(id);
        const nieuw = { ...bestaand, ...data };
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

const { registerAfnameRoutes } = await import("../server/routes/afnames");
const { getDefaultDescriptor } = await import("../server/registry");
const { t: vertaal } = await import("@shared/i18n");

const BEWIJS = "bezitstoken-voor-de-test";

/** De blokken van het standaard-instrument, zoals deel 1 ze inlevert. */
function volledigeAntwoorden(): Record<string, any> {
  const blokken = getDefaultDescriptor().instrument?.blocks ?? [];
  const uit: Record<string, any> = {};
  for (const blok of blokken) {
    const items: any[] = (blok as any).items ?? [];
    uit[blok.stateKey] = {
      most: items[0]?.pos ?? "A",
      least: items[1]?.pos ?? "B",
      blockEnergy: blok.energyMode === "block" ? 0 : null,
      itemEnergy: blok.energyMode === "item" ? { most: 1, least: -1 } : null,
    };
  }
  return uit;
}

function zetAfname(id: number, extra: Record<string, unknown>) {
  afnames.set(id, {
    id,
    status: "deel2",
    instrumentId: null,
    taal: "nl",
    bezitsToken: BEWIJS,
    inviteToken: null,
    respondentCode: `R${id}`,
    name: "Test",
    company: null,
    role: null,
    consentScope: "self",
    itemTijden: null,
    mainResponses: null,
    ...extra,
  });
}

async function rondAf(id: number, lichaam: unknown) {
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
    const res = await fetch(`http://127.0.0.1:${poort}/api/afnames/${id}/connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TaPas-Bewijs": BEWIJS },
      body: JSON.stringify(lichaam),
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

const VERBINDING = { answers: { q1: 5, q2: 5, q3: 5, q4: 5 } };

beforeEach(() => {
  afnames.clear();
});

describe("het afrond-endpoint weigert een onvolledige inzending", () => {
  it("weigert een afname waarin blokken ontbreken", async () => {
    const antwoorden = volledigeAntwoorden();
    const sleutels = Object.keys(antwoorden);
    delete antwoorden[sleutels[0]!];
    delete antwoorden[sleutels[1]!];
    zetAfname(1, { mainResponses: JSON.stringify(antwoorden) });

    const uit = await rondAf(1, VERBINDING);
    expect(uit.status).toBe(400);
    expect(uit.body.error).toBe(vertaal("onvolledig_indienen", "nl"));
    expect(uit.body.ontbreekt).toEqual([sleutels[0], sleutels[1]]);
  });

  it("weigert een blok waarvan de energie niet gezet is", async () => {
    const antwoorden = volledigeAntwoorden();
    const eerste = Object.keys(antwoorden)[0]!;
    antwoorden[eerste] = { ...antwoorden[eerste], blockEnergy: null, itemEnergy: null };
    zetAfname(2, { mainResponses: JSON.stringify(antwoorden) });

    const uit = await rondAf(2, VERBINDING);
    expect(uit.status).toBe(400);
    expect(uit.body.ontbreekt).toContain(eerste);
  });

  it("laat de afname onafgerond staan na een weigering", async () => {
    zetAfname(3, { mainResponses: JSON.stringify({}) });
    await rondAf(3, VERBINDING);
    expect(afnames.get(3).status).toBe("deel2");
    expect(afnames.get(3).connectionAnswers).toBeUndefined();
  });

  it("geeft de melding in de taal van de afname", async () => {
    zetAfname(4, { mainResponses: JSON.stringify({}), taal: "fr" });
    const uit = await rondAf(4, VERBINDING);
    expect(uit.body.error).toBe(vertaal("onvolledig_indienen", "fr"));
    expect(uit.body.error).not.toBe(vertaal("onvolledig_indienen", "nl"));
  });

  it("houdt een volledige afname niet tegen", async () => {
    zetAfname(5, { mainResponses: JSON.stringify(volledigeAntwoorden()) });
    const uit = await rondAf(5, VERBINDING);
    // Wat er daarna gebeurt (scoren, contract bouwen) staat los van deze regel.
    // Waar het hier om gaat: de volledigheidscontrole laat deze afname door.
    expect(uit.body?.error).not.toBe(vertaal("onvolledig_indienen", "nl"));
  });
});

describe("de weigering sluit niemand onterecht buiten", () => {
  it("laat een instrument waarvan de vragenset niet bekend is ongemoeid", async () => {
    zetAfname(6, { instrumentId: "t4teens", mainResponses: JSON.stringify({}) });
    const uit = await rondAf(6, VERBINDING);
    expect(uit.body?.error).not.toBe(vertaal("onvolledig_indienen", "nl"));
  });

  it("weigert nog steeds vóór de controle wat al eerder geweigerd werd", async () => {
    // Een al afgeronde afname blijft 409 geven; de nieuwe regel schuift daar
    // niet voor.
    zetAfname(7, { status: "voltooid", mainResponses: JSON.stringify({}) });
    const uit = await rondAf(7, VERBINDING);
    expect(uit.status).toBe(409);
  });

  it("blijft deel 1 als eerste eisen", async () => {
    zetAfname(8, { mainResponses: null });
    const uit = await rondAf(8, VERBINDING);
    expect(uit.status).toBe(400);
    expect(uit.body.error).toBe("Deel 1 is nog niet ingeleverd");
  });
});
