// ---------------------------------------------------------------------------
// tests/t4students-live-weg.test.ts
//
// De weg die een echte deelnemer aflegt, van vragenlijst tot rapportbladen,
// zonder tussenstop. Dit is de toets die de storing zou hebben gezien die het
// rapport van een ingevulde afname met louter nulwaarden opleverde:
//
//   1. GET /api/vragenlijst/tapas-t4students levert de items van dit
//      instrument, onder de item-id's waarop de scoring leest.
//   2. Een antwoordenblad in de vorm van een ander instrument (bloksleutels
//      B0, B1, ...) wordt bij het afronden geweigerd met status 400 in plaats
//      van als een lege afname gescoord. De afname blijft dan onafgerond en er
//      komt dus geen enkel rapport uit.
//   3. Een antwoordenblad in de vorm van dit instrument komt door, en het
//      contract dat POST /api/afnames/:id/connection oplevert draagt echte,
//      niet-nulle uitkomsten.
//   4. De rapportketen bouwt uit dat contract de volledige bladen en een PDF.
//
// De opslag wordt nagebootst, zoals in tests/antwoordsleutels-afnameweg.test.ts;
// de routes en de scoring zijn de echte.
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

const RESPONDENT_CODE = "T4S-LIVE-1";

let afname: Record<string, unknown>;
// De automatische rapportgeneratie na het afronden. Die weg zelf staat in
// server/storage.ts en wordt in tests/rapport-registry-*.test.ts gemeten; hier
// tellen we alleen of het afronden ze aanroept.
const rapportAanroepen: number[] = [];

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
      async updateAfname(_id: number, data: Record<string, unknown>) {
        afname = { ...afname, ...data };
        return afname;
      },
      async verbruik() {
        return null;
      },
      async genereerRapport(afnameId: number) {
        rapportAanroepen.push(afnameId);
        return { id: 1, afnameId };
      },
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const { registerAfnameRoutes } = await import("../server/routes/afnames");
const { registerVragenlijstT4StudentsRoutes } = await import(
  "../server/routes/vragenlijst-t4students"
);
const { leesT4StudentsContract } = await import("../server/t4students/afnamecontract");
const { bouwRapportUitContract, pdfVanRapport, titelVanRapport } = await import(
  "../server/t4students/rapport-keten"
);
const { aantalVerplichteItems, itemsVanInstrument } = await import(
  "../server/t4students/antwoorden"
);

function app() {
  const a = express();
  a.use(express.json({ limit: "2mb" }));
  a.use((req, _res, next) => {
    (req as unknown as { session: unknown }).session = { save: (cb: () => void) => cb() };
    next();
  });
  a.use((req, _res, next) => {
    // De inleverroutes vragen het bezitsbewijs; dat zetten we per verzoek mee.
    next();
  });
  registerVragenlijstT4StudentsRoutes(a);
  registerAfnameRoutes(a);
  return a;
}

interface UitgaandeOptie {
  key: string;
  text: string;
}

interface UitgaandItem {
  id: string;
  itemType?: string;
  options?: UitgaandeOptie[];
  variants?: Record<string, { itemType: string; options?: UitgaandeOptie[] }>;
}

/**
 * Vult de vragenlijst zoals het invulscherm dat doet: per itemsoort het veld
 * dat de scoring voor dat item leest. De waarden zijn bewust niet nul, zodat een
 * rapport vol nulwaarden onmiddellijk opvalt.
 */
function vulIn(items: UitgaandItem[]): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  let p1Keuze: string | null = null;
  for (const item of items) {
    const soort = item.itemType ?? "";
    if (soort === "open-intro") {
      uit[item.id] = { text: "Ik zoek een richting die bij me past." };
    } else if (soort === "battery") {
      uit[item.id] = { value: 7 };
    } else if (soort === "recognition+energy") {
      uit[item.id] = { recognition: 3, energy: 2 };
    } else if (soort === "recognition") {
      uit[item.id] = { recognition: 3 };
    } else if (soort === "interest") {
      uit[item.id] = { interest: 2 };
    } else if (item.options && item.options.length > 0) {
      uit[item.id] = { choice: item.options[0]!.key };
      if (item.id === "P1") p1Keuze = item.options[0]!.key;
    }
  }
  const p2 = items.find((i) => i.variants);
  if (p2 && p1Keuze) {
    const variant = p2.variants![p1Keuze]!;
    uit[p2.id] =
      variant.itemType === "profile-scale"
        ? { value: 6 }
        : { choice: variant.options![0]!.key };
  }
  return uit;
}

function blokAntwoord() {
  return {
    most: "A",
    least: "B",
    itemEnergy: { most: 2, least: -2 },
    blockEnergy: null,
    toelichting: null,
  };
}

beforeEach(() => {
  rapportAanroepen.length = 0;
  afname = {
    id: 1,
    status: "bezig",
    taal: "nl",
    instrumentId: "t4students",
    name: "Leertester Studiekompas",
    company: null,
    role: null,
    respondentCode: RESPONDENT_CODE,
    bezitsToken: RESPONDENT_CODE,
    inviteToken: null,
    consentScope: "test",
    consentTimestamp: null,
    organisatieId: null,
    baselineEnergy: null,
    itemTijden: null,
    mainResponses: null,
    connectionAnswers: null,
    generatorContract: null,
  };
});

describe("T4Students van vragenlijst tot rapportbladen", () => {
  it("de vragenlijst draagt de item-id's van de scoring", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/vragenlijst/tapas-t4students?taal=nl`);
      expect(res.status).toBe(200);
      const view = await res.json();
      expect(view.instrumentId).toBe("t4students");
      expect(view.items.length).toBe(view.totaalItems);
      const ids: string[] = view.items.map((i: UitgaandItem) => i.id);
      expect(ids).toContain("I1");
      expect(ids).toContain("P1");
      // Precies de item-id's van de itembank, in dezelfde volgorde: geen
      // bloklijst van een ander instrument.
      const bank = itemsVanInstrument().map((i) => i.id);
      expect(ids).toEqual(bank);
    });
  });

  it("een antwoordenblad met bloksleutels wordt geweigerd in plaats van leeg gescoord", async () => {
    const blokken: Record<string, unknown> = {};
    for (let i = 0; i < 34; i++) blokken[`B${i}`] = blokAntwoord();

    await metServer(app(), async (basis) => {
      const deel1 = await fetch(`${basis}/api/afnames/1/main`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({ responses: blokken }),
      });
      expect(deel1.status).toBe(200);

      const afronden = await fetch(`${basis}/api/afnames/1/connection`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({}),
      });
      expect(afronden.status).toBe(400);
      const fout = await afronden.json();
      expect(Array.isArray(fout.ontbreekt)).toBe(true);
      expect(fout.ontbreekt.length).toBe(aantalVerplichteItems());
      // De afname is niet afgerond en er is geen contract gebouwd: er bestaat
      // dus geen weg naar een rapport met nulwaarden.
      expect(afname.status).not.toBe("voltooid");
      expect(afname.generatorContract).toBeNull();
    });
  });

  it("een volledig ingevuld studiekompas levert een contract met echte uitkomsten", async () => {
    await metServer(app(), async (basis) => {
      const view = await (await fetch(`${basis}/api/vragenlijst/tapas-t4students?taal=nl`)).json();
      const antwoorden = vulIn(view.items);

      const deel1 = await fetch(`${basis}/api/afnames/1/main`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({ responses: antwoorden, tijden: { I1: 4200 } }),
      });
      expect(deel1.status).toBe(200);

      // Wat verstuurd is, is letterlijk bewaard, onder de item-id's.
      const bewaard = JSON.parse(String(afname.mainResponses));
      const bank = new Set(itemsVanInstrument().map((i) => i.id));
      expect(Object.keys(bewaard)).toContain("I1");
      // Elke bewaarde sleutel is een item van dit instrument.
      expect(Object.keys(bewaard).filter((k) => !bank.has(k))).toEqual([]);

      const afronden = await fetch(`${basis}/api/afnames/1/connection`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({}),
      });
      expect(afronden.status).toBe(200);
      const uitkomst = await afronden.json();
      const contract = uitkomst.contract;

      expect(contract.instrumentId).toBe("t4students");
      expect(contract.contractVersion).toBe("2.0.0");
      expect(contract.ontbrekend).toEqual([]);
      expect(contract.resultaat.betrouwbaarheid.beantwoord).toBeGreaterThan(30);
      expect(contract.resultaat.betrouwbaarheid.voorlopig).toBe(false);
      expect(contract.resultaat.energie.ijkpunt0tot10).toBe(7);
      expect(contract.resultaat.ijkpunt.waarde).toBe(7);

      // Geen enkele van de drie rangschikkingen mag leeg zijn: dat was precies
      // het beeld van het rapport met nulwaarden.
      expect(contract.resultaat.foci.topGroep.length).toBeGreaterThan(0);
      expect(contract.resultaat.versnellers.kopGroep.length).toBeGreaterThan(0);
      expect(contract.resultaat.drivers.top2.length).toBeGreaterThan(0);
      expect(contract.resultaat.studiegebieden.top.length).toBeGreaterThan(0);
      // Geen enkele focusscore blijft op nul staan: dat is het beeld van een
      // afname waarvan geen enkel antwoord is aangekomen.
      const focusScores = Object.values(contract.resultaat.foci.scores) as number[];
      expect(focusScores.length).toBeGreaterThan(0);
      expect(focusScores.every((score) => score === 0)).toBe(false);

      // Het afronden zet ook de rapportgeneratie in gang, zodat de deelnemer
      // niet op een handmatige stap hoeft te wachten.
      expect(rapportAanroepen).toEqual([1]);
    });
  });

  it("de rapportketen bouwt uit datzelfde contract volledige bladen en een PDF", async () => {
    await metServer(app(), async (basis) => {
      const view = await (await fetch(`${basis}/api/vragenlijst/tapas-t4students?taal=nl`)).json();
      const antwoorden = vulIn(view.items);
      await fetch(`${basis}/api/afnames/1/main`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({ responses: antwoorden }),
      });
      await fetch(`${basis}/api/afnames/1/connection`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tapas-bewijs": RESPONDENT_CODE },
        body: JSON.stringify({}),
      });

      // Zoals de rapportketen het doet: het bewaarde contract inlezen en
      // daaruit de bladen bouwen.
      const ruw = afname.generatorContract;
      expect(typeof ruw).toBe("string");
      const contract = leesT4StudentsContract(JSON.parse(String(ruw)));
      const rapport = bouwRapportUitContract(contract);

      expect(rapport.naam).toBe("Leertester Studiekompas");
      expect(rapport.paginas.length).toBeGreaterThanOrEqual(27);
      expect(titelVanRapport(rapport)).toContain("Leertester Studiekompas");

      // Geen enkel blad zonder inhoud.
      for (const pagina of rapport.paginas) {
        expect(pagina.titel.length, `blad ${pagina.nr} zonder titel`).toBeGreaterThan(0);
        expect(pagina.blokken.length, `blad ${pagina.nr} zonder blokken`).toBeGreaterThan(0);
      }

      const pdf = await pdfVanRapport(rapport);
      expect(pdf.length).toBeGreaterThan(20000);
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });
  }, 60000);
});
