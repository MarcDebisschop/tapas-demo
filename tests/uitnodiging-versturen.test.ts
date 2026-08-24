// ---------------------------------------------------------------------------
// tests/uitnodiging-versturen.test.ts - de uitnodiging en de herinnering versturen
//
// AANLEIDING. Wie in het beheerscherm een deelnemer uitnodigde, kreeg een link en
// moest die zelf in een bericht zetten. De verzendweg bestond al voor de
// bulk-import, maar was op deze weg nergens aangesloten. En de belknop in het
// overzicht zette enkel een datum: het scherm zei "herinnerd" terwijl er niets
// vertrok.
//
// Wat deze toetsen vastleggen:
//   1. Zonder adres blijft de oude weg intact: een uitnodiging wordt aangemaakt en
//      er wordt niets verstuurd.
//   2. Met adres en verstuurwens vertrekt er werkelijk een bericht, met de
//      persoonlijke link en de leesbare naam van het instrument erin.
//   3. Het adres wordt bewaard op de afname, ook zonder verzending, want anders kan
//      de herinnering later niet vertrekken.
//   4. Bij een minderjarige onder de drempel weigert de route het adres van de
//      jongere zelf, en dat gebeurt voordat er een afname en dus een credit ontstaat.
//   5. Het adres van een verantwoordelijke gaat naar het ouderveld, niet naar het
//      deelnemersveld.
//   6. Een mislukte verzending breekt de uitnodiging niet: de link komt terug en de
//      stand zegt eerlijk dat er niets vertrok.
//   7. De belknop verstuurt een echte herinnering naar het bekende adres.
//   8. Zonder bekend adres verstuurt de belknop niets en zegt dat ook.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const gemaakt: any[] = [];
const patches: Array<{ id: number; patch: any }> = [];
const afnames = new Map<number, any>();

vi.mock("../server/storage", () => ({
  CreditError: class CreditError extends Error {},
  CREDITPAKKETTEN: [],
  sqlite: {},
  db: {},
  storage: {
    getBeheerder: async () => ({
      id: 1,
      naam: "Prior",
      organisatie: "TaPasCity",
      isPrior: true,
      actief: true,
      organisatieId: null,
    }),
    getOrganisatie: async (id: number) => ({ id, naam: `Org ${id}` }),
    getSaldo: async () => ({ beschikbaar: 10, gereserveerd: 0, verbruikt: 0 }),
    reserveer: async () => undefined,
    maakUitnodiging: async (data: any) => {
      gemaakt.push(data);
      const rij = { id: 900, inviteToken: "TOKEN123", herinnerdAt: null, ...data };
      afnames.set(900, rij);
      return rij;
    },
    getAfname: async (id: number) => afnames.get(id),
    markeerHerinnerd: async (id: number) => {
      const rij = afnames.get(id);
      if (!rij) return undefined;
      rij.herinnerdAt = "2026-08-24T00:00:00.000Z";
      return rij;
    },
    updateAfname: async (id: number, patch: any) => {
      patches.push({ id, patch });
      const rij = { ...(afnames.get(id) ?? { id }), ...patch };
      afnames.set(id, rij);
      return rij;
    },
  },
}));

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

// De verzendmodule zelf is elders getoetst; hier gaat het om de vraag of ze
// aangeroepen wordt, met wat, en wat er met haar antwoord gebeurt.
const verzonden: any[] = [];
let volgendeStand: "verstuurd" | "gesimuleerd" | "fout" = "verstuurd";

vi.mock("../server/bulk-import/mailer", () => ({
  isSimulatiemodus: () => false,
  verstuurUitnodiging: async (input: any) => {
    verzonden.push({ soort: "uitnodiging", ...input });
    return { status: volgendeStand, gesimuleerd: volgendeStand === "gesimuleerd", melding: "test" };
  },
  verstuurHerinnering: async (input: any) => {
    verzonden.push({ soort: "herinnering", ...input });
    return { status: volgendeStand, gesimuleerd: volgendeStand === "gesimuleerd", melding: "test" };
  },
}));

const { registerAfnameRoutes } = await import("../server/routes/afnames");

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { adminId: 1, save: (cb: (e?: unknown) => void) => cb() };
    next();
  });
  registerAfnameRoutes(a);
  return a;
}

async function post(pad: string, lichaam: unknown) {
  const server = createServer(app());
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lichaam),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

const ORIGIN = "https://tapascity.example/";

beforeEach(() => {
  gemaakt.length = 0;
  patches.length = 0;
  verzonden.length = 0;
  afnames.clear();
  volgendeStand = "verstuurd";
});

describe("POST /api/uitnodigingen", () => {
  it("maakt zonder adres gewoon een link aan en verstuurt niets", async () => {
    const res = await post("/api/uitnodigingen", { name: "Herman", origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(res.body.inviteToken).toBe("TOKEN123");
    expect(verzonden).toHaveLength(0);
  });

  it("verstuurt met adres een bericht met de persoonlijke link erin", async () => {
    const res = await post("/api/uitnodigingen", {
      name: "Herman",
      deelnemerEmail: "herman@voorbeeld.be",
      ontvangerRol: "deelnemer",
      verstuurMail: true,
      origin: ORIGIN,
    });
    expect(res.status).toBe(200);
    expect(res.body.mailStatus).toBe("verstuurd");
    expect(verzonden).toHaveLength(1);
    expect(verzonden[0].soort).toBe("uitnodiging");
    expect(verzonden[0].naar).toBe("herman@voorbeeld.be");
    expect(verzonden[0].link).toBe("https://tapascity.example#/deelnemer/TOKEN123");
    // Een leesbare instrumentnaam, geen interne sleutel.
    expect(verzonden[0].instrument).not.toBe("");
    expect(verzonden[0].instrument).not.toMatch(/^t4/);
  });

  it("bewaart het adres ook wanneer er niet verstuurd wordt", async () => {
    await post("/api/uitnodigingen", {
      name: "Herman",
      deelnemerEmail: "herman@voorbeeld.be",
      origin: ORIGIN,
    });
    expect(verzonden).toHaveLength(0);
    expect(patches.some((p) => p.patch.deelnemerEmail === "herman@voorbeeld.be")).toBe(true);
  });

  it("weigert bij een jongere onder de drempel het adres van de jongere zelf", async () => {
    const res = await post("/api/uitnodigingen", {
      name: "Jonas",
      instrumentId: "t4teens",
      leeftijdsband: "13-15",
      ontvangerRol: "deelnemer",
      deelnemerEmail: "jonas@voorbeeld.be",
      verstuurMail: true,
      origin: ORIGIN,
    });
    expect(res.status).toBe(400);
    // Vóór alles wat kost: er is geen afname en dus geen credit aangeroerd.
    expect(gemaakt).toHaveLength(0);
    expect(verzonden).toHaveLength(0);
  });

  it("bewaart het adres van een begeleider in het ouderveld", async () => {
    const res = await post("/api/uitnodigingen", {
      name: "Lotte",
      instrumentId: "t4kids",
      leeftijdsband: "10-12",
      ontvangerRol: "begeleider",
      deelnemerEmail: "begeleider@school.be",
      verstuurMail: true,
      origin: ORIGIN,
    });
    expect(res.status).toBe(200);
    expect(patches.some((p) => p.patch.ouderEmail === "begeleider@school.be")).toBe(true);
    expect(patches.some((p) => p.patch.deelnemerEmail === "begeleider@school.be")).toBe(false);
    expect(verzonden[0].naar).toBe("begeleider@school.be");
  });

  it("laat een mislukte verzending de uitnodiging niet breken", async () => {
    volgendeStand = "fout";
    const res = await post("/api/uitnodigingen", {
      name: "Herman",
      deelnemerEmail: "herman@voorbeeld.be",
      verstuurMail: true,
      origin: ORIGIN,
    });
    expect(res.status).toBe(200);
    expect(res.body.inviteToken).toBe("TOKEN123");
    expect(res.body.mailStatus).toBe("fout");
  });

  it("verstuurt niets wanneer er geen publiek adres meekomt", async () => {
    // Zonder dat adres zou er een onbruikbare link in het bericht staan, en een
    // bericht met een dode link is erger dan geen bericht.
    const res = await post("/api/uitnodigingen", {
      name: "Herman",
      deelnemerEmail: "herman@voorbeeld.be",
      verstuurMail: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.mailStatus).toBe("fout");
    expect(verzonden).toHaveLength(0);
  });
});

describe("POST /api/afnames/:id/herinner", () => {
  it("verstuurt een echte herinnering naar het bekende adres", async () => {
    await post("/api/uitnodigingen", {
      name: "Herman",
      deelnemerEmail: "herman@voorbeeld.be",
      origin: ORIGIN,
    });
    verzonden.length = 0;

    const res = await post("/api/afnames/900/herinner", { origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(res.body.mailStatus).toBe("verstuurd");
    expect(res.body.herinnerdAt).toBeTruthy();
    expect(verzonden).toHaveLength(1);
    expect(verzonden[0].soort).toBe("herinnering");
    expect(verzonden[0].naar).toBe("herman@voorbeeld.be");
    // Dezelfde link als de uitnodiging: die blijft geldig.
    expect(verzonden[0].link).toBe("https://tapascity.example#/deelnemer/TOKEN123");
  });

  it("verstuurt niets wanneer er geen adres bekend is en zegt dat ook", async () => {
    await post("/api/uitnodigingen", { name: "Herman", origin: ORIGIN });
    const res = await post("/api/afnames/900/herinner", { origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(res.body.mailStatus).toBe("geen-adres");
    expect(verzonden).toHaveLength(0);
    // De datum blijft wel staan: er was een poging.
    expect(res.body.herinnerdAt).toBeTruthy();
  });

  it("stuurt de herinnering naar de verantwoordelijke en niet naar het kind", async () => {
    await post("/api/uitnodigingen", {
      name: "Lotte",
      instrumentId: "t4kids",
      leeftijdsband: "10-12",
      ontvangerRol: "ouder",
      deelnemerEmail: "ouder@voorbeeld.be",
      origin: ORIGIN,
    });
    verzonden.length = 0;

    const res = await post("/api/afnames/900/herinner", { origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(verzonden).toHaveLength(1);
    expect(verzonden[0].naar).toBe("ouder@voorbeeld.be");
  });

  it("geeft 404 voor een afname die niet bestaat", async () => {
    const res = await post("/api/afnames/12345/herinner", { origin: ORIGIN });
    expect(res.status).toBe(404);
  });
});
