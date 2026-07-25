// ---------------------------------------------------------------------------
// tests/instrument-id-vullen.test.ts
//
// Wat de tests bewijzen:
//   1. POST /api/t4sports/afnames schrijft instrument_id = "t4sports" weg, en
//      dat id bestaat echt in het register (geen losse tikfout-string).
//   2. De generieke aanmaakpaden laten instrument_id nooit meer leeg: zonder
//      instrumentId van de client valt de afname terug op het standaard-
//      instrument uit het register, met een instrumentId blijft die bewaard.
//   3. De backfill vult enkel aan wat betrouwbaar uit het bevroren contract
//      volgt, laat al de rest met rust, en is idempotent.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  backfillInstrumentIds,
  leidInstrumentAfUitContract,
} from "../server/instrument-backfill";
import { alleInstrumenten, getDefaultDescriptor } from "../server/registry";
import { MINDERJARIGE_INSTRUMENTEN } from "../shared/leeftijd";

const GEREGISTREERD = new Set(alleInstrumenten().map((d) => d.instrumentId));
const isGeregistreerd = (id: string) => GEREGISTREERD.has(id);

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

// De T4Sports-router praat enkel via `storage` met de databank. We vangen die
// af zodat de test de echte afnames-tabel niet aanraakt en we exact zien welke
// velden de route doorgeeft.
const aangemaakt: any[] = [];
vi.mock("../server/storage", () => {
  class CreditError extends Error {}
  return {
    CreditError,
    sqlite: new Database(":memory:"),
    db: {},
    storage: {
      async createAfname(data: any) {
        aangemaakt.push(data);
        return { ...data, id: aangemaakt.length, status: "consent" };
      },
      async updateAfname(_id: number, data: any) {
        return { ...data, id: _id };
      },
      async getOrganisatie() {
        return null;
      },
      async getSaldo() {
        return { beschikbaar: 0 };
      },
      async reserveer() {},
    },
  };
});

const { registerT4SportsRoutes, T4SPORTS_INSTRUMENT_ID } = await import(
  "../server/t4sports/routes"
);

describe("T4Sports-afname krijgt het juiste instrument", () => {
  beforeEach(() => {
    aangemaakt.length = 0;
  });

  it("schrijft instrumentId t4sports weg bij het starten van een afname", async () => {
    const app = express();
    app.use(express.json());
    registerT4SportsRoutes(app);

    await metServer(app, async (basis) => {
      const res = await fetch(`${basis}/api/t4sports/afnames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Atleet", baselineEnergy: 5 }),
      });
      expect(res.status).toBe(200);
    });

    expect(aangemaakt).toHaveLength(1);
    expect(aangemaakt[0]!.instrumentId).toBe("t4sports");
  });

  it("gebruikt een id dat echt in het register staat", () => {
    // Vangt een tikfout op: een niet-geregistreerd id zou in het overzicht als
    // losse, naamloze rij verschijnen in plaats van als T4Sports.
    expect(T4SPORTS_INSTRUMENT_ID).toBe("t4sports");
    expect(isGeregistreerd(T4SPORTS_INSTRUMENT_ID)).toBe(true);
  });
});

describe("generieke aanmaakpaden laten instrument_id niet leeg", () => {
  // De twee aanroepen in server/routes/afnames.ts mogen niet terugvallen op
  // null: dan zou elke T4P-afname opnieuw onder "Onbekend" belanden.
  it("valt terug op het standaard-instrument in plaats van null", async () => {
    const bron = await import("node:fs").then((fs) =>
      fs.readFileSync("server/routes/afnames.ts", "utf8"),
    );
    // De twee wegschrijfpaden: createAfname en maakUitnodiging.
    const wegschrijven = [
      ...bron.matchAll(
        /(createAfname|maakUitnodiging)\(\{[\s\S]*?instrumentId:\s*data\.instrumentId\s*\?\?\s*([^,\n]+)/g,
      ),
    ];
    expect(wegschrijven.map((m) => m[1])).toEqual(["createAfname", "maakUitnodiging"]);
    for (const m of wegschrijven) {
      expect(m[2]!.trim()).toBe("standaardInstrumentId()");
    }
  });

  it("laat de leeftijdspoort de ruwe clientwaarde zien", () => {
    // valideerLeeftijdspoort moet weten of de client echt niets stuurde; daar
    // hoort de standaardwaarde dus NIET ingevuld te worden. Anders zou een
    // afname zonder instrument plots als t4p-business-kompas door de poort
    // gaan in plaats van als "geen instrument opgegeven".
    expect(MINDERJARIGE_INSTRUMENTEN).not.toContain(getDefaultDescriptor().instrumentId);
  });

  it("kent een standaard-instrument dat in het register staat", () => {
    const standaard = getDefaultDescriptor().instrumentId;
    expect(standaard).toBe("t4p-business-kompas");
    expect(isGeregistreerd(standaard)).toBe(true);
  });
});

describe("leidInstrumentAfUitContract - enkel betrouwbare signalen", () => {
  it("neemt een geregistreerd instrumentId uit het contract over", () => {
    const contract = JSON.stringify({ instrumentId: "t4teens" });
    expect(leidInstrumentAfUitContract(contract, isGeregistreerd)).toBe("t4teens");
  });

  it("weigert een historische variantnaam die geen geregistreerd instrument is", () => {
    // "t4p-teens-kompas" komt voor in oudere contracten maar staat niet in het
    // register. Ze naar t4teens vertalen zou een gissing zijn.
    const contract = JSON.stringify({ instrumentId: "t4p-teens-kompas" });
    expect(leidInstrumentAfUitContract(contract, isGeregistreerd)).toBeNull();
  });

  it("geeft null bij een ontbrekend, onleesbaar of leeg contract", () => {
    expect(leidInstrumentAfUitContract(null, isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract("", isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract("geen json", isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract("null", isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract(JSON.stringify({}), isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract(JSON.stringify({ instrumentId: 7 }), isGeregistreerd)).toBeNull();
    expect(leidInstrumentAfUitContract(JSON.stringify({ instrumentId: "  " }), isGeregistreerd)).toBeNull();
  });
});

describe("backfillInstrumentIds", () => {
  const db = new Database(":memory:");

  beforeEach(() => {
    db.exec(`
      DROP TABLE IF EXISTS afnames;
      CREATE TABLE afnames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instrument_id TEXT,
        generator_contract TEXT
      );
    `);
    const ins = db.prepare(
      `INSERT INTO afnames (instrument_id, generator_contract) VALUES (?, ?)`,
    );
    // 1: leeg + betrouwbaar contract -> wordt aangevuld.
    ins.run(null, JSON.stringify({ instrumentId: "t4p-business-kompas" }));
    // 2: leeg + historische variantnaam -> blijft leeg.
    ins.run(null, JSON.stringify({ instrumentId: "t4p-teens-kompas" }));
    // 3: leeg + geen contract -> blijft leeg.
    ins.run(null, null);
    // 4: al ingevuld -> mag niet overschreven worden.
    ins.run("t4sports", JSON.stringify({ instrumentId: "t4kids" }));
  });

  function kolom(): Array<string | null> {
    return (db.prepare(`SELECT instrument_id FROM afnames ORDER BY id`).all() as any[]).map(
      (r) => r.instrument_id,
    );
  }

  it("vult enkel aan wat betrouwbaar uit het contract volgt", () => {
    const res = backfillInstrumentIds(db as any, isGeregistreerd);
    expect(res).toEqual({ bekeken: 3, ingevuld: 1, overgeslagen: 2 });
    expect(kolom()).toEqual(["t4p-business-kompas", null, null, "t4sports"]);
  });

  it("overschrijft nooit een bestaande waarde", () => {
    backfillInstrumentIds(db as any, isGeregistreerd);
    // Rij 4 had al "t4sports" en een afwijkend contract; die waarde blijft.
    expect(kolom()[3]).toBe("t4sports");
  });

  it("is idempotent: een tweede uitvoering wijzigt niets", () => {
    backfillInstrumentIds(db as any, isGeregistreerd);
    const na1 = kolom();
    const res2 = backfillInstrumentIds(db as any, isGeregistreerd);
    expect(res2).toEqual({ bekeken: 2, ingevuld: 0, overgeslagen: 2 });
    expect(kolom()).toEqual(na1);
  });
});
