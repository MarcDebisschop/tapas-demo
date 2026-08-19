// ---------------------------------------------------------------------------
// tests/antwoordsleutels-afnameweg.test.ts
//
// Vervolg op tests/antwoordsleutels.test.ts, maar nu over de echte weg: de
// antwoorden gaan via POST /api/afnames/:id/main de opslag in en via
// POST /api/afnames/:id/connection de scoring in. De opslag wordt nagebootst
// zodat de test de databank niet aanraakt; de routes zelf zijn de echte.
//
// Wat hier bewezen wordt:
//   1. Wat het invulscherm verstuurt, wordt letterlijk bewaard: bloksleutels
//      B0..B24 blijven bloksleutels in main_responses.
//   2. Het afgeronde T4Teens-contract telt toch alle 24 talentitems, omdat de
//      route de sleutels vlak voor de scoring omzet.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

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

const RESPONDENT_CODE = "T4T-BEWIJS-1";

// De nagebootste afnamerij. updateAfname schrijft erin, zodat deel 1 en deel 2
// elkaar zien zoals in de echte databank.
let afname: any;
const geschreven: any[] = [];

vi.mock("../server/storage", () => {
  class CreditError extends Error {}
  return {
    CreditError,
    CREDITPAKKETTEN: [],
    sqlite: {},
    db: {},
    storage: {
      async getAfname() {
        return afname;
      },
      async updateAfname(_id: number, data: any) {
        geschreven.push(data);
        afname = { ...afname, ...data };
        return afname;
      },
      async verbruik() {
        return null;
      },
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const { registerAfnameRoutes } = await import("../server/routes/afnames");
const { laadInstrumentItems } = await import("../server/question-manager");

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { save: (cb: () => void) => cb() };
    next();
  });
  registerAfnameRoutes(a);
  return a;
}

// Eén blok-antwoord zoals deel1.tsx het opbouwt.
function blokAntwoord(energie: number) {
  return {
    most: "A",
    least: null,
    itemEnergy: { most: energie, least: null },
    blockEnergy: null,
    toelichting: null,
  };
}

beforeEach(() => {
  geschreven.length = 0;
  afname = {
    id: 1,
    status: "bezig",
    taal: "nl",
    instrumentId: "t4teens",
    name: "Testpersoon",
    company: null,
    role: null,
    respondentCode: RESPONDENT_CODE,
    bezitsToken: RESPONDENT_CODE,
    inviteToken: null,
    consentScope: "test",
    // Een echte afname draagt deze twee velden altijd: de startpagina zet ze
    // voor de eerste vraag. Sinds de toestemmingspoort op de inleverroutes
    // staat, hoort een fixture dat dus ook te doen.
    consentGiven: true,
    consentTimestamp: "2026-08-19T10:00:00.000Z",
    // T4Teens en T4Kids kennen naast de toestemming ook een leeftijdspoort
    // (AVG artikel 8). Een echte afname legt die bij de start vast.
    leeftijdsband: "13-15",
    ouderlijkeToestemming: true,
    ouderNaam: "Ouder Test",
    ouderEmail: "ouder@example.com",
    consentTimestamp: null,
    organisatieId: null,
    baselineEnergy: null,
    itemTijden: null,
    mainResponses: null,
    connectionAnswers: null,
    generatorContract: null,
  };
});

describe("T4Teens over de echte afnameweg", () => {
  it("bewaart de bloksleutels ongewijzigd en scoort toch alle items", async () => {
    const items = laadInstrumentItems("tapas-t4teens");
    // Sleutels precies zoals het invulscherm ze zet: B0 tot en met B24.
    const antwoorden: Record<string, unknown> = {};
    items.forEach((item, index) => {
      const energie = item.itemId === "T4T-I1-1" ? 2 : item.itemId === "T4T-V1-1" ? -2 : 1;
      antwoorden[`B${index}`] = blokAntwoord(energie);
    });

    await metServer(app(), async (basis) => {
      const deel1 = await fetch(`${basis}/api/afnames/1/main`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({ responses: antwoorden }),
      });
      expect(deel1.status).toBe(200);

      // De opslag blijft ongemoeid: bloksleutels in, bloksleutels bewaard.
      const bewaard = JSON.parse(afname.mainResponses);
      expect(Object.keys(bewaard)).toEqual(items.map((_, i) => `B${i}`));

      const deel2 = await fetch(`${basis}/api/afnames/1/connection`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({ answers: { q1: 5, q2: 5, q3: 5, q4: 5 } }),
      });
      expect(deel2.status).toBe(200);
      const { contract } = await deel2.json();

      expect(contract.instrumentId).toBe("t4teens");
      expect(contract.sections.main.meta.completedItems).toBe(24);
      expect(contract.sections.main.meta.batterij).toBe(2);

      const rij = (construct: string) =>
        contract.sections.main.constructRows.find((r: any) => r.construct === construct);
      expect(rij("Analyse").avgEnergy).toBe(-2);
      expect(rij("Coaching").avgEnergy).toBe(1);
    });
  });
});
