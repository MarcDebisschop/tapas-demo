// ---------------------------------------------------------------------------
// tests/fase6-verzender.test.ts - Fase 6 van de organisatie-scoping: elke
// nieuwe afname legt vast WIE ze aanmaakte.
//
// Waarom dit los staat van `organisatieId`: dat veld zegt wiens CREDIT de
// afname kost, niet wie ze verstuurde. De prior kan een afname aanmaken die op
// de credits van een klant staat, en een particuliere afname heeft wel een
// verzender maar geen betalende organisatie.
//
// Wat de tests bewijzen:
//   1. De verzender komt uit de SESSIE. Een `aangemaaktDoor...` in de body
//      wordt genegeerd; anders kon een oproeper het spoor uitwissen.
//   2. Een organisatiebeheerder legt zichzelf en zijn organisatie vast.
//   3. De prior legt zichzelf vast maar geen organisatie: hij hoort bij het
//      platform en niet bij een klant.
//   4. Het deelnemerspad heeft geen sessie en laat beide velden null. Dat is de
//      eerlijke waarde en geen ontbrekend gegeven.
//   5. De migratie is additief en idempotent.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

const gemaakt: any[] = [];

vi.mock("../server/storage", () => {
  const beheerders = new Map<number, any>();
  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [],
    sqlite: {},
    db: {},
    storage: {
      __beheerders: beheerders,
      getBeheerder: async (id: number) => beheerders.get(id),
      getOrganisatie: async (id: number) => ({ id, naam: `Org ${id}` }),
      getSaldo: async () => ({ beschikbaar: 10, gereserveerd: 0, verbruikt: 0 }),
      reserveer: async () => undefined,
      maakUitnodiging: async (data: any) => {
        gemaakt.push(data);
        return { id: 900, ...data };
      },
      createAfname: async (data: any) => {
        gemaakt.push(data);
        return { id: 901, ...data, respondentCode: "X" };
      },
      updateAfname: async (_id: number, patch: any) => ({ id: 901, ...patch }),
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  storage: { __beheerders: Map<number, any> };
};
const beheerders = opslag.storage.__beheerders;
const { registerAfnameRoutes } = await import("../server/routes/afnames");

const PRIOR = 1;
const BEHEERDER_A = 2;

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    const als = String(req.query.als ?? "");
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    (req as any).session = sessie;
    next();
  });
  registerAfnameRoutes(a);
  return a;
}

async function post(pad: string, lichaam: unknown) {
  let uit: { status: number; body: any } = { status: 0, body: null };
  const server = createServer(app());
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lichaam),
    });
    uit = { status: res.status, body: await res.json().catch(() => null) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
  return uit;
}

beforeEach(() => {
  gemaakt.length = 0;
  beheerders.clear();
  beheerders.set(PRIOR, {
    id: PRIOR,
    naam: "Prior",
    organisatie: PRIOR_ORGANISATIE,
    isPrior: true,
    actief: true,
    organisatieId: null,
  });
  beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A,
    naam: "A",
    organisatie: "Org A",
    isPrior: false,
    actief: true,
    organisatieId: 1,
  });
});

// ── 1. Uitnodigingen ───────────────────────────────────────────────────────

describe("POST /api/uitnodigingen legt de verzender vast", () => {
  it("zet beheerder en organisatie van een organisatiebeheerder", async () => {
    const res = await post("/api/uitnodigingen?als=a", { name: "Iemand" });
    expect(res.status).toBe(200);
    expect(gemaakt[0].aangemaaktDoorBeheerderId).toBe(BEHEERDER_A);
    expect(gemaakt[0].aangemaaktDoorOrganisatieId).toBe(1);
  });

  it("zet voor de prior wel de beheerder maar geen organisatie", async () => {
    // De prior hoort bij het platform, niet bij een klant. Hem aan een
    // organisatie hangen zou de cijfers van die klant vervuilen.
    const res = await post("/api/uitnodigingen?als=prior", { name: "Iemand", organisatieId: 2 });
    expect(res.status).toBe(200);
    expect(gemaakt[0].aangemaaktDoorBeheerderId).toBe(PRIOR);
    expect(gemaakt[0].aangemaaktDoorOrganisatieId).toBeNull();
    // De betalende organisatie is wel gewoon die uit de body.
    expect(gemaakt[0].organisatieId).toBe(2);
  });

  it("negeert een verzender uit de body", async () => {
    // Kon de oproeper dit zetten, dan was het spoor waardeloos.
    const res = await post("/api/uitnodigingen?als=a", {
      name: "Iemand",
      aangemaaktDoorBeheerderId: 999,
      aangemaaktDoorOrganisatieId: 999,
    });
    expect(res.status).toBe(200);
    expect(gemaakt[0].aangemaaktDoorBeheerderId).toBe(BEHEERDER_A);
    expect(gemaakt[0].aangemaaktDoorOrganisatieId).toBe(1);
  });
});

// ── 2. Deelnemerspad ───────────────────────────────────────────────────────

describe("POST /api/afnames op het deelnemerspad", () => {
  it("laat de verzender null wanneer er geen sessie is", async () => {
    const res = await post("/api/afnames", {
      name: "Deelnemer",
      baselineEnergy: 5,
      consentGiven: true,
    });
    expect(res.status).toBe(200);
    expect(gemaakt[0].aangemaaktDoorBeheerderId).toBeNull();
    expect(gemaakt[0].aangemaaktDoorOrganisatieId).toBeNull();
  });

  it("legt de beheerder wel vast wanneer die zelf een afname start", async () => {
    const res = await post("/api/afnames?als=a", {
      name: "Deelnemer",
      baselineEnergy: 5,
      consentGiven: true,
    });
    expect(res.status).toBe(200);
    expect(gemaakt[0].aangemaaktDoorBeheerderId).toBe(BEHEERDER_A);
    expect(gemaakt[0].aangemaaktDoorOrganisatieId).toBe(1);
  });
});

// ── 3. Migratie: additief en idempotent ────────────────────────────────────

describe("de migratie is additief en idempotent", () => {
  it("voegt de twee kolommen toe zonder bestaande rijen aan te raken", () => {
    const sq = new Database(":memory:");
    sq.exec(`CREATE TABLE afnames (id INTEGER PRIMARY KEY, name TEXT);`);
    sq.prepare(`INSERT INTO afnames (id, name) VALUES (1, 'Bestaand')`).run();

    const migreer = () => {
      const cols = sq.prepare(`PRAGMA table_info(afnames)`).all() as Array<{ name: string }>;
      const heeft = (n: string) => cols.some((c) => c.name === n);
      const add = (sql: string) => {
        try {
          sq.exec(sql);
        } catch {
          /* bestaat al */
        }
      };
      if (!heeft("aangemaakt_door_beheerder_id"))
        add(`ALTER TABLE afnames ADD COLUMN aangemaakt_door_beheerder_id INTEGER;`);
      if (!heeft("aangemaakt_door_organisatie_id"))
        add(`ALTER TABLE afnames ADD COLUMN aangemaakt_door_organisatie_id INTEGER;`);
    };

    migreer();
    migreer(); // tweemaal draaien mag niet stukgaan

    const rij = sq.prepare(`SELECT * FROM afnames WHERE id = 1`).get() as any;
    expect(rij.name).toBe("Bestaand");
    // Bestaande rijen houden NULL: de verzender is achteraf niet betrouwbaar te
    // reconstrueren en raden zou het spoor vervalsen.
    expect(rij.aangemaakt_door_beheerder_id).toBeNull();
    expect(rij.aangemaakt_door_organisatie_id).toBeNull();
    sq.close();
  });

  it("staat als ALTER TABLE ... ADD COLUMN achter een bestaanscontrole", () => {
    const bron = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
    expect(bron).toContain(
      'if (!heeft("aangemaakt_door_beheerder_id")) add(`ALTER TABLE afnames ADD COLUMN aangemaakt_door_beheerder_id INTEGER;`);',
    );
    // Geen DROP of NOT NULL op afnames: de migratie moet strikt additief zijn.
    expect(bron).not.toMatch(/ALTER TABLE afnames DROP/);
    expect(bron).not.toMatch(/ADD COLUMN aangemaakt_door_\w+ INTEGER NOT NULL/);
  });
});

// ── 4. Broncontrole: de verzender komt nooit uit de body ───────────────────

describe("de verzender komt uit de sessie", () => {
  it("leidt hem af met verzenderVanVerzoek en niet uit req.body", () => {
    for (const pad of [
      "../server/routes/afnames.ts",
      "../server/t4sports/routes.ts",
      "../server/bulk-import/routes.ts",
    ]) {
      const bron = readFileSync(new URL(pad, import.meta.url), "utf8");
      expect(bron, pad).toContain("verzenderVanVerzoek");
      // De helperfuncties mogen het veld wel uit hun eigen parameter halen;
      // wat niet mag is het rechtstreeks uit het VERZOEK overnemen.
      expect(bron, pad).not.toMatch(/aangemaaktDoor\w+:\s*(req\.body|parsed\.data|gevraagd)/);
    }
  });

  it("haalt de beheerder in verzenderVanVerzoek uit de sessie", () => {
    const bron = readFileSync(new URL("../server/scope-guard.ts", import.meta.url), "utf8");
    expect(bron).toMatch(/export async function verzenderVanVerzoek/);
    expect(bron).toContain("beheerderIdVanSessie(req)");
  });
});
