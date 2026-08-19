// ---------------------------------------------------------------------------
// tests/geen-eigen-deel2.test.ts
//
// T4Students-uitbreiding: T4Teens kreeg al een afscherming van het gedeelde
// deel-2-scherm (de vier organisatieverbondenheidsvragen van het T4P Business
// Kompas). Uit de meting bleek dat T4Students strikt genomen in dezelfde
// situatie zit (geen eigen deel 2: server/t4students/scoring.ts gebruikt de
// q1-q4-antwoorden nergens), maar dat werd toen bewust niet aangepakt. Deze
// test legt vast dat T4Students nu hetzelfde patroon volgt, met dezelfde
// dubbele beveiliging als T4Teens:
//
//   1. server/routes/afnames.ts (GEEN_EIGEN_DEEL2): de server eist `answers`
//      niet meer voor t4teens/t4kids/t4students, maar nog wél voor elk ander
//      instrument (o.a. het T4P Business Kompas, de enige eigenaar van deel 2,
//      en T4Sports, dat de q1-q4-vorm hergebruikt maar ze wél zelf scoort).
//   2. client/src/pages/deel2.tsx (GEEN_EIGEN_DEEL2): stuurt elk instrument
//      zonder eigen deel 2 door naar /klaar, ook bij rechtstreekse navigatie.
//   3. client/src/pages/deel1.tsx: rondt na deel 1 direct af (dezelfde
//      /connection-route, zonder q1-q4) in plaats van naar /deel2 te navigeren,
//      zodat het scherm in de normale doorloop nooit getoond wordt.
//
// De laatste sectie bewijst dat de drie lagen niet stil uit elkaar kunnen
// groeien: de instrumentenset op elke laag wordt rechtstreeks uit de
// broncode gelezen en met elkaar vergeleken.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const { verwachteT4TeensSleutels } = await import("../server/t4teens/volledigheid");

const BEWIJS = "bezitstoken-voor-de-test";

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
    mainResponses: JSON.stringify({}),
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

/** Een volledig ingevuld T4Teens-antwoordenblad, in de vorm van het scherm. */
function volledigT4Teens(): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  for (const sleutel of verwachteT4TeensSleutels()) {
    uit[sleutel] = { most: null, least: null, itemEnergy: null, blockEnergy: 1 };
  }
  return uit;
}

beforeEach(() => {
  afnames.clear();
});

describe("server: instrumenten zonder eigen deel 2 hoeven geen answers mee te sturen", () => {
  it("laat t4students afronden zonder answers", async () => {
    // T4Students heeft, net als T4Kids, naast de GEEN_EIGEN_DEEL2-guard een
    // eigen volledigheidscontrole (elk verplicht item van de itembank moet
    // beantwoord zijn; zie server/volledigheid-afname.ts en
    // tests/t4students-live-weg.test.ts). Een leeg antwoordenblad wordt daar
    // geweigerd, en dat is hier geen onderwerp: het gaat enkel om de garantie
    // dat het ontbreken van `answers` niet meer met "Ongeldige antwoorden voor
    // deel 2" wordt afgewezen.
    zetAfname(1, { instrumentId: "t4students" });
    const uit = await rondAf(1, {});
    expect(uit.body?.error).not.toBe("Ongeldige antwoorden voor deel 2");
  });

  it("laat t4teens afronden zonder answers (bestaand gedrag, blijft intact)", async () => {
    // T4Teens heeft sinds 19 augustus 2026 ook een eigen volledigheidscontrole
    // (server/t4teens/volledigheid.ts). Die is hier geen onderwerp, dus krijgt
    // deze afname een volledig ingevuld antwoordenblad. Het gaat enkel om de
    // garantie dat het ontbreken van `answers` niet met "Ongeldige antwoorden
    // voor deel 2" wordt afgewezen.
    zetAfname(2, { instrumentId: "t4teens", mainResponses: JSON.stringify(volledigT4Teens()) });
    const uit = await rondAf(2, {});
    expect(uit.body?.error).not.toBe("Ongeldige antwoorden voor deel 2");
    expect(uit.status).not.toBe(400);
  });

  it("laat t4kids afronden zonder answers (bestaand gedrag, blijft intact)", async () => {
    // T4Kids heeft naast de GEEN_EIGEN_DEEL2-guard ook een eigen
    // volledigheidscontrole (galerij-keuzes verplicht). Die is hier geen
    // onderwerp: het gaat enkel om de garantie dat het ontbreken van `answers`
    // T4Kids niet meer met "Ongeldige antwoorden voor deel 2" weigert.
    zetAfname(3, { instrumentId: "t4kids", mainResponses: JSON.stringify({}) });
    const uit = await rondAf(3, {});
    expect(uit.body?.error).not.toBe("Ongeldige antwoorden voor deel 2");
  });
});

describe("server: instrumenten mét een eigen deel 2 blijven answers eisen", () => {
  it("weigert het standaard T4P Business Kompas zonder answers", async () => {
    zetAfname(4, { instrumentId: null });
    const uit = await rondAf(4, {});
    expect(uit.status).toBe(400);
    expect(uit.body.error).toBe("Ongeldige antwoorden voor deel 2");
  });

  it("weigert T4Sports zonder answers (T4Sports scoort q1-q4 zelf, dus geen kandidaat voor GEEN_EIGEN_DEEL2)", async () => {
    zetAfname(5, { instrumentId: "t4sports" });
    const uit = await rondAf(5, {});
    expect(uit.status).toBe(400);
    expect(uit.body.error).toBe("Ongeldige antwoorden voor deel 2");
  });
});

// ---------------------------------------------------------------------------
// Consistentie tussen de drie lagen. Dit toont aan dat een instrument zonder
// eigen deel 2 het scherm ook werkelijk niet kan bereiken: alle drie de lagen
// moeten hetzelfde instrument uitsluiten, anders kan de doorloop-laag
// (deel1.tsx) alsnog naar /deel2 navigeren, of de scherm-guard (deel2.tsx)
// een instrument doorlaten dat de server wél als "geen eigen deel 2"
// beschouwt.
// ---------------------------------------------------------------------------
const wortel = resolve(__dirname, "..");

function haalSet(bestand: string, patroon: RegExp): Set<string> {
  const tekst = readFileSync(resolve(wortel, bestand), "utf8");
  const match = tekst.match(patroon);
  if (!match) {
    throw new Error(`GEEN_EIGEN_DEEL2 niet gevonden in ${bestand}`);
  }
  const inhoud = match[1]!;
  const items = [...inhoud.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  return new Set(items);
}

describe("de drie lagen (server, deel2-guard, deel1-doorloop) blijven op elkaar aangesloten", () => {
  const serverSet = haalSet(
    "server/routes/afnames.ts",
    /GEEN_EIGEN_DEEL2\s*=\s*new Set\(\[([^\]]+)\]\)/,
  );
  const deel2Set = haalSet(
    "client/src/pages/deel2.tsx",
    /GEEN_EIGEN_DEEL2\s*=\s*new Set\(\[([^\]]+)\]\)/,
  );

  it("bevat t4teens, t4kids en t4students op zowel server als deel2-guard", () => {
    for (const id of ["t4teens", "t4kids", "t4students"]) {
      expect(serverSet.has(id), `server mist "${id}"`).toBe(true);
      expect(deel2Set.has(id), `deel2.tsx mist "${id}"`).toBe(true);
    }
  });

  it("server en deel2-guard sluiten exact dezelfde instrumenten uit", () => {
    expect([...serverSet].sort()).toEqual([...deel2Set].sort());
  });

  it("deel1.tsx rondt t4teens én t4students meteen af, zonder naar /deel2 te navigeren", () => {
    const deel1 = readFileSync(resolve(wortel, "client/src/pages/deel1.tsx"), "utf8");
    // De vroege-afrondingsguard moet beide instrumenten dekken.
    expect(deel1).toMatch(/if\s*\(\s*isT4Teens\s*\|\|\s*isT4Students\s*\)/);
    // En de instrumentchecks moeten op de juiste instrumentId's staan.
    expect(deel1).toMatch(/isT4Teens\s*=\s*afname\?\.instrumentId\s*===\s*"t4teens"/);
    expect(deel1).toMatch(/isT4Students\s*=\s*afname\?\.instrumentId\s*===\s*"t4students"/);
  });

  it("t4sports staat NIET in de uitsluitingsset (heeft een eigen, zelf-scorende deel 2)", () => {
    expect(serverSet.has("t4sports")).toBe(false);
    expect(deel2Set.has("t4sports")).toBe(false);
  });
});
