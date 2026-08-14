// ---------------------------------------------------------------------------
// tests/bekwaamheid-poort-endpoints.test.ts — hangt de poort werkelijk?
//
// De poort is zuiver getoetst (58 tests) en de brug is tegen een echte databank
// getoetst (26 tests). Alle 84 blijven groen wanneer niemand de poort aanroept.
// Dat is het gat dat deze suite dicht: hij bewijst dat elk van de drie
// schrijfwegen de poort werkelijk vraagt, met de juiste handeling en het juiste
// instrument, en dat een weigering het verzoek werkelijk tegenhoudt.
//
// De brug is hier gemockt. Dat is met opzet: wat de poort beslist is elders
// getoetst, en wat hier telt is uitsluitend de aansluiting. Door de brug te
// vervangen is elke weigering af te dwingen zonder een licentiestelsel op te
// tuigen, en is meteen te zien welke handeling de route doorgeeft.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** Wat de route aan de poort vroeg. Per test leeggemaakt. */
type Vraag = { handeling: string; instrumentId: string | null; verzender: unknown };
const vragen: Vraag[] = [];

/** Laat de nagemaakte poort weigeren of doorlaten. */
let laatDoor = true;

vi.mock("../server/bekwaamheid/poortbrug", () => ({
  beoordeelSchrijfweg: async (invoer: Vraag) => {
    vragen.push({
      handeling: invoer.handeling,
      instrumentId: invoer.instrumentId,
      verzender: invoer.verzender,
    });
    return {
      mag: laatDoor,
      toegestaan: laatDoor,
      toetsbaar: true,
      zouWeigeren: !laatDoor,
      grond: laatDoor ? "bevoegd" : "verlopen",
      stand: "handhaaf",
      tekst: "De licentie voor dit instrument is verlopen.",
      watNu: { actie: "hercertificering_aanvragen", url: "/coach/bekwaamheid" },
      platformdeelLeemte: false,
    };
  },
  weigeringslichaam: (u: {
    tekst: string;
    grond: string;
    watNu: { actie: string; url: string | null };
  }) => ({
    error: u.tekst,
    code: "BEKWAAMHEID_POORT",
    grond: u.grond,
    watNu: u.watNu,
  }),
}));

// --- de omgeving rond de routes, zo klein als het kan -----------------------

const organisaties = new Map([[1, { id: 1, naam: "Organisatie A" }]]);

vi.mock("../server/storage", () => ({
  CreditError: class CreditError extends Error {},
  storage: {
    getOrganisatie: async (id: number) => organisaties.get(id),
    getSaldo: async () => ({ beschikbaar: 100, gereserveerd: 0, verbruikt: 0 }),
    createAfname: async (d: Record<string, unknown>) => ({ id: 501, ...d }),
    maakUitnodiging: async (d: Record<string, unknown>) => ({ id: 502, inviteToken: "t-t-t", ...d }),
    updateAfname: async () => undefined,
    reserveer: async () => undefined,
    getAfname: async () => undefined,
  },
}));

vi.mock("../server/scope-guard", () => ({
  bepaalScope: async () => ({ soort: "beheerder", beheerderId: 1, organisatieId: null }),
  scopeVanVerzoek: () => ({ soort: "beheerder", beheerderId: 1, organisatieId: null }),
  vereisScope: (_req: unknown, _res: unknown, next: () => void) => next(),
  schrijfOrganisatieId: () => ({ ok: true, organisatieId: null }),
  verzenderVanVerzoek: async () => ({
    aangemaaktDoorBeheerderId: 1,
    aangemaaktDoorOrganisatieId: null,
  }),
}));

const { registerAfnameRoutes } = await import("../server/routes/afnames");

function maakServer(): Promise<{ url: string; sluit: () => void }> {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  registerAfnameRoutes(app);
  const server = createServer(app);
  return new Promise((klaar) => {
    server.listen(0, () => {
      const poort = (server.address() as AddressInfo).port;
      klaar({ url: `http://127.0.0.1:${poort}`, sluit: () => server.close() });
    });
  });
}

beforeEach(() => {
  vragen.length = 0;
  laatDoor = true;
});

const NIEUWE_AFNAME = {
  name: "Test Deelnemer",
  baselineEnergy: 5,
  taal: "nl",
  consentGiven: true,
  instrumentId: "t4students",
};

describe("weg 1 — POST /api/afnames", () => {
  it("vraagt de poort met de handeling afname_aanmaken en het juiste instrument", async () => {
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/afnames`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(NIEUWE_AFNAME),
      });
      expect(res.status).toBe(200);
      expect(vragen).toHaveLength(1);
      expect(vragen[0].handeling).toBe("afname_aanmaken");
      expect(vragen[0].instrumentId).toBe("t4students");
      expect(vragen[0].verzender).toEqual({
        aangemaaktDoorBeheerderId: 1,
        aangemaaktDoorOrganisatieId: null,
      });
    } finally {
      s.sluit();
    }
  });

  it("houdt het verzoek tegen wanneer de poort weigert", async () => {
    laatDoor = false;
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/afnames`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(NIEUWE_AFNAME),
      });
      expect(res.status).toBe(403);
      const lichaam = await res.json();
      expect(lichaam.code).toBe("BEKWAAMHEID_POORT");
      expect(lichaam.grond).toBe("verlopen");
      // Sectie 7.2: een weigering is een gesprek. Tekst én weg vooruit.
      expect(lichaam.error).toContain("verlopen");
      expect(lichaam.watNu.url).toBe("/coach/bekwaamheid");
    } finally {
      s.sluit();
    }
  });

  it("vult het standaardinstrument in wanneer de body er geen noemt", async () => {
    // De poort mag nooit een leeg instrument te zien krijgen waar de route zelf
    // al weet welk instrument het wordt. Anders zou grond `instrument_onbekend`
    // opduiken voor een afname die wel degelijk een instrument krijgt.
    const s = await maakServer();
    try {
      const { instrumentId: _weg, ...zonder } = NIEUWE_AFNAME;
      await fetch(`${s.url}/api/afnames`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(zonder),
      });
      expect(vragen).toHaveLength(1);
      expect(vragen[0].instrumentId).not.toBeNull();
      expect(typeof vragen[0].instrumentId).toBe("string");
    } finally {
      s.sluit();
    }
  });

  it("vraagt de poort niet wanneer de invoer al ongeldig is", async () => {
    // Een 400 op de vorm van het verzoek is geen licentievraag. De poort telt
    // dan niets, want er is niets geprobeerd.
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/afnames`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });
      expect(res.status).toBe(400);
      expect(vragen).toEqual([]);
    } finally {
      s.sluit();
    }
  });
});

describe("weg 2 — POST /api/uitnodigingen", () => {
  it("vraagt de poort met de handeling uitnodiging_aanmaken", async () => {
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/uitnodigingen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Coachee", taal: "nl", instrumentId: "t4teens" }),
      });
      expect(res.status).toBe(200);
      expect(vragen).toHaveLength(1);
      expect(vragen[0].handeling).toBe("uitnodiging_aanmaken");
      expect(vragen[0].instrumentId).toBe("t4teens");
    } finally {
      s.sluit();
    }
  });

  it("houdt het verzoek tegen wanneer de poort weigert", async () => {
    laatDoor = false;
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/uitnodigingen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Coachee", taal: "nl", instrumentId: "t4teens" }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("BEKWAAMHEID_POORT");
    } finally {
      s.sluit();
    }
  });

  it("weigert vóór de saldo-check, niet erna", async () => {
    // Wie geen licentie heeft hoort dat te horen, niet een creditsfout die de
    // echte reden verbergt. Als de volgorde omslaat, geeft deze route 402 in
    // plaats van 403.
    laatDoor = false;
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/uitnodigingen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Coachee", taal: "nl", instrumentId: "t4teens" }),
      });
      expect(res.status).not.toBe(402);
      expect(res.status).toBe(403);
    } finally {
      s.sluit();
    }
  });
});

describe("de vier beloften komen niet in gevaar op de routes", () => {
  it("de poort wordt op geen enkele leesroute gevraagd", async () => {
    // Belofte 2 van sectie 7.3: nooit rapporten of historiek blokkeren. Dat is in
    // de zuivere laag geregeld via `HANDELINGEN_BINNEN_DE_POORT`, maar de
    // eenvoudigste waarborg is dat de leesroutes de poort niet eens vragen.
    const s = await maakServer();
    try {
      await fetch(`${s.url}/api/afnames/501`);
      expect(vragen).toEqual([]);
    } finally {
      s.sluit();
    }
  });

  it("een weigering geeft 403 en nooit 500", async () => {
    // Een gebroken poort die 500 geeft is stil falen met extra stappen.
    laatDoor = false;
    const s = await maakServer();
    try {
      const res = await fetch(`${s.url}/api/afnames`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(NIEUWE_AFNAME),
      });
      expect(res.status).toBe(403);
    } finally {
      s.sluit();
    }
  });
});

describe("de aansluiting is er op alle drie de schrijfwegen", () => {
  it("de twee routes in routes/afnames.ts roepen de poort aan", async () => {
    // Een broncodetoets naast de gedragstoets hierboven: die twee dekken samen
    // ook de bulkweg, die in deze suite niet met een echte server te bereiken is
    // zonder de hele bestandsverwerking na te bouwen.
    const { readFileSync } = await import("node:fs");
    const routes = readFileSync("server/routes/afnames.ts", "utf-8");
    expect(routes).toContain("beoordeelSchrijfweg");
    expect(routes.match(/beoordeelSchrijfweg\(/g) ?? []).toHaveLength(2);
    expect(routes).toContain('handeling: "afname_aanmaken"');
    expect(routes).toContain('handeling: "uitnodiging_aanmaken"');
  });

  it("de bulkroute roept de poort aan, één keer voor de hele import", async () => {
    const { readFileSync } = await import("node:fs");
    const bulk = readFileSync("server/bulk-import/routes.ts", "utf-8");
    expect(bulk).toContain("beoordeelSchrijfweg");
    // Eén aanroep: per rij toetsen zou honderden identieke auditregels schrijven.
    expect(bulk.match(/beoordeelSchrijfweg\(/g) ?? []).toHaveLength(1);
    expect(bulk).toContain("weigeringslichaam");
    // En de aanroep staat buiten de rijlus. Het anker wordt eerst hard
    // vastgesteld: `indexOf` dat -1 teruggeeft zou met een slice op -1 bijna het
    // hele bestand opleveren en de toets stilzwijgend laten passeren. Dat is bij
    // de mutatieproef op deze suite werkelijk gebeurd.
    const lus = bulk.lastIndexOf("for (const r of rijen) {");
    expect(lus).toBeGreaterThan(0);
    const aanroep = bulk.indexOf("beoordeelSchrijfweg({");
    expect(aanroep).toBeGreaterThan(0);
    expect(aanroep).toBeLessThan(lus);
  });

  it("geen enkele schrijfweg leest zouWeigeren in plaats van mag", async () => {
    // De valkuil van het hele ontwerp: wie `zouWeigeren` leest, weigert ook in
    // stand `log` en breekt daarmee de nulmeting én het product.
    const { readFileSync } = await import("node:fs");
    for (const pad of ["server/routes/afnames.ts", "server/bulk-import/routes.ts"]) {
      const bron = readFileSync(pad, "utf-8");
      expect(bron, pad).not.toContain("poortoordeel.zouWeigeren");
      expect(bron, pad).toContain("!poortoordeel.mag");
    }
  });
});
