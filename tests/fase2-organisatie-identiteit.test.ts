// ---------------------------------------------------------------------------
// tests/fase2-organisatie-identiteit.test.ts - Fase 2 van de organisatie-
// scoping: er bestaat nu een server-geverifieerde organisatie-identiteit.
//
// Wat de tests bewijzen:
//   1. De naam-match koppelt enkel wat eenduidig is. Prior-beheerders krijgen
//      bewust geen organisatieId, en er is geen default-toewijzing: wat niet
//      matcht blijft NULL.
//   2. De koppeling is idempotent en overschrijft nooit een bestaande waarde.
//   3. De organisatie-login slaagt en faalt op de juiste gronden en zet
//      req.session.organisatieId.
//   4. /api/organisatie/me leest de identiteit uit de sessie, niet uit de query.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  bouwNaamIndex,
  beslisKoppeling,
  koppelBeheerdersAanOrganisaties,
  naamSleutel,
} from "../server/organisatie-koppeling";
import { hashWachtwoord } from "../server/auth/wachtwoord";

// De routes praten rechtstreeks met sqlite. We geven ze een databank in het
// geheugen zodat data.db niet aangeraakt wordt. De fabriek wordt naar de top
// van het bestand gehesen, dus de databank moet erbinnen gemaakt worden.
vi.mock("../server/storage", async () => {
  const { default: Db } = await import("better-sqlite3");
  return { sqlite: new Db(":memory:"), db: {}, storage: {} };
});

const { sqlite: testDb } = (await import("../server/storage")) as unknown as {
  sqlite: InstanceType<typeof Database>;
};
const { registerOrganisatieAuthRoutes, organisatieIdVanSessie } = await import(
  "../server/routes/organisatie-auth"
);

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

// ── 1. Naam-match: pure beslislogica ───────────────────────────────────────

describe("naam-match van beheerder naar organisatie", () => {
  const index = bouwNaamIndex([
    { id: 1, naam: "Innovatech NV" },
    { id: 2, naam: "Academie De Horizon" },
    { id: 3, naam: "Dubbel BV" },
    { id: 4, naam: "dubbel bv" },
  ]);

  it("matcht case-insensitief en op de getrimde naam", () => {
    expect(naamSleutel("  Innovatech NV  ")).toBe("innovatech nv");
    const besluit = beslisKoppeling(
      { id: 9, naam: "X", organisatie: "  innovatech nv ", isPrior: false },
      index,
    );
    expect(besluit).toEqual({ beheerderId: 9, organisatieId: 1, reden: "gekoppeld" });
  });

  it("koppelt een prior-beheerder bewust aan geen enkele organisatie", () => {
    // Prior omzeilt de scope centraal; hem aan een klantorganisatie hangen zou
    // hem juist beperken en de bedoeling omkeren.
    const besluit = beslisKoppeling(
      { id: 1, naam: "Marc", organisatie: "TaPasCity", isPrior: true },
      index,
    );
    expect(besluit).toEqual({ beheerderId: 1, organisatieId: null, reden: "prior" });
  });

  it("doet niets bij een naam die niet voorkomt: geen default-toewijzing", () => {
    const besluit = beslisKoppeling(
      { id: 9, naam: "X", organisatie: "Onbekende NV", isPrior: false },
      index,
    );
    expect(besluit).toEqual({ beheerderId: 9, organisatieId: null, reden: "geen-match" });
  });

  it("doet niets bij een dubbelzinnige naam", () => {
    // Twee organisaties met dezelfde naam: gokken zou een beheerder aan de
    // verkeerde organisatie hangen, precies het lek dat we dichten.
    const besluit = beslisKoppeling(
      { id: 9, naam: "X", organisatie: "Dubbel BV", isPrior: false },
      index,
    );
    expect(besluit.reden).toBe("dubbelzinnig");
    expect(besluit.organisatieId).toBeNull();
  });

  it("doet niets bij een lege organisatienaam", () => {
    const besluit = beslisKoppeling({ id: 9, naam: "X", organisatie: "   ", isPrior: false }, index);
    expect(besluit.reden).toBe("geen-naam");
    expect(besluit.organisatieId).toBeNull();
  });
});

// ── 2. Koppeling tegen een echte databank ──────────────────────────────────

describe("koppelBeheerdersAanOrganisaties", () => {
  const db = new Database(":memory:");

  beforeEach(() => {
    db.exec(`
      DROP TABLE IF EXISTS beheerders;
      DROP TABLE IF EXISTS organisaties;
      CREATE TABLE organisaties (id INTEGER PRIMARY KEY AUTOINCREMENT, naam TEXT NOT NULL);
      CREATE TABLE beheerders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        organisatie TEXT,
        is_prior INTEGER NOT NULL DEFAULT 0,
        organisatie_id INTEGER
      );
    `);
    const org = db.prepare(`INSERT INTO organisaties (naam) VALUES (?)`);
    org.run("Innovatech NV");
    org.run("Academie De Horizon");
    const beh = db.prepare(
      `INSERT INTO beheerders (naam, organisatie, is_prior, organisatie_id) VALUES (?, ?, ?, ?)`,
    );
    beh.run("Prior Een", "TaPasCity", 1, null);
    beh.run("Klant Een", "innovatech nv", 0, null);
    beh.run("Klant Twee", "Niet Bestaande NV", 0, null);
    beh.run("Al Gekoppeld", "Academie De Horizon", 0, 2);
  });

  function kolom() {
    return (db.prepare(`SELECT organisatie_id FROM beheerders ORDER BY id`).all() as any[]).map(
      (r) => r.organisatie_id,
    );
  }

  it("koppelt enkel wat eenduidig matcht", () => {
    const res = koppelBeheerdersAanOrganisaties(db as any);
    // Rij 4 heeft al een waarde en wordt niet eens bekeken.
    expect(res.bekeken).toBe(3);
    expect(res.gekoppeld).toBe(1);
    expect(res.overgeslagen).toBe(2);
    expect(kolom()).toEqual([null, 1, null, 2]);
  });

  it("legt per niet-gekoppelde rij de reden vast voor de bouwlog", () => {
    const res = koppelBeheerdersAanOrganisaties(db as any);
    expect(res.besluiten.map((b) => b.reden)).toEqual(["prior", "gekoppeld", "geen-match"]);
  });

  it("is idempotent: een tweede uitvoering wijzigt niets", () => {
    koppelBeheerdersAanOrganisaties(db as any);
    const na1 = kolom();
    const res2 = koppelBeheerdersAanOrganisaties(db as any);
    expect(res2.gekoppeld).toBe(0);
    expect(kolom()).toEqual(na1);
  });

  it("overschrijft nooit een bestaande koppeling", () => {
    koppelBeheerdersAanOrganisaties(db as any);
    expect(kolom()[3]).toBe(2);
  });
});

// ── 3. Organisatie-login ───────────────────────────────────────────────────

describe("organisatie-login", () => {
  function app() {
    const a = express();
    a.use(express.json());
    a.use((req, _res, next) => {
      // De nabootsing kent ook `regenerate`: sinds auditbevinding H-1 vernieuwt
      // de organisatie-login het sessie-id voordat ze de identiteit zet.
      const sessie: any = {
        save: (cb: (e?: unknown) => void) => cb(),
        regenerate: (cb: (e?: unknown) => void) => {
          for (const k of Object.keys(sessie)) {
            if (!["save", "regenerate", "__zichtbaar"].includes(k)) delete sessie[k];
          }
          cb();
        },
      };
      if (req.query.org) sessie.organisatieId = Number(req.query.org);
      (req as any).session = sessie;
      // Leg de sessie bloot zodat de test kan nakijken wat de route erin zette.
      (req as any).session.__zichtbaar = sessie;
      next();
    });
    registerOrganisatieAuthRoutes(a);
    return a;
  }

  beforeEach(async () => {
    testDb.exec(`
      DROP TABLE IF EXISTS organisaties;
      CREATE TABLE organisaties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        login_email TEXT,
        wachtwoord_hash TEXT,
        login_actief INTEGER NOT NULL DEFAULT 0,
        -- Personalisatie uit fase 9: /api/organisatie/me leest die velden mee.
        branding_logo_url TEXT,
        branding_achtergrond_url TEXT,
        branding_achtergrond_kleur TEXT,
        branding_quote TEXT
      );
    `);
    const hash = await hashWachtwoord("geheim");
    const ins = testDb.prepare(
      `INSERT INTO organisaties (naam, login_email, wachtwoord_hash, login_actief) VALUES (?, ?, ?, ?)`,
    );
    ins.run("Innovatech NV", "info@innovatech.be", hash, 1);
    ins.run("Zonder Wachtwoord", "info@zonder.be", null, 1);
    ins.run("Login Uit", "info@uit.be", hash, 0);
  });

  async function login(body: Record<string, unknown>) {
    let uitkomst: { status: number; body: any } = { status: 0, body: null };
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/organisatie/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      uitkomst = { status: res.status, body: await res.json() };
    });
    return uitkomst;
  }

  it("slaagt met het juiste e-mailadres en wachtwoord", async () => {
    const res = await login({ email: "info@innovatech.be", wachtwoord: "geheim" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, organisatieId: 1, naam: "Innovatech NV" });
  });

  it("is ongevoelig voor hoofdletters in het e-mailadres", async () => {
    const res = await login({ email: "  INFO@Innovatech.BE ", wachtwoord: "geheim" });
    expect(res.status).toBe(200);
  });

  it("weigert een verkeerd wachtwoord met 401", async () => {
    expect((await login({ email: "info@innovatech.be", wachtwoord: "fout" })).status).toBe(401);
  });

  it("weigert een login zonder wachtwoord met 401", async () => {
    expect((await login({ email: "info@innovatech.be" })).status).toBe(401);
  });

  it("weigert een onbekend e-mailadres met 401", async () => {
    expect((await login({ email: "niemand@nergens.be", wachtwoord: "geheim" })).status).toBe(401);
  });

  it("geeft 403 wanneer er nog geen wachtwoord is ingesteld", async () => {
    expect((await login({ email: "info@zonder.be", wachtwoord: "iets" })).status).toBe(403);
  });

  it("weigert een organisatie waarvan de login uit staat", async () => {
    // Zelfde antwoord als een onbekend adres: de foutmelding mag niet
    // verklappen welke organisaties een login hebben.
    const res = await login({ email: "info@uit.be", wachtwoord: "geheim" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("E-mailadres of wachtwoord onjuist.");
  });

  it("leest het organisatieId enkel uit een geldige sessie", () => {
    expect(organisatieIdVanSessie({} as any)).toBeNull();
    expect(organisatieIdVanSessie({ session: {} } as any)).toBeNull();
    expect(organisatieIdVanSessie({ session: { organisatieId: 0 } } as any)).toBeNull();
    expect(organisatieIdVanSessie({ session: { organisatieId: "5" } } as any)).toBe(5);
  });

  it("geeft /api/organisatie/me enkel terug met een sessie", async () => {
    await metServer(app(), async (basis) => {
      const zonder = await fetch(`${basis}/api/organisatie/me`);
      expect(zonder.status).toBe(401);

      const met = await fetch(`${basis}/api/organisatie/me?org=1`);
      expect(met.status).toBe(200);
      expect((await met.json()).naam).toBe("Innovatech NV");
    });
  });

  it("weigert /api/organisatie/me wanneer de login intussen uit staat", async () => {
    await metServer(app(), async (basis) => {
      const res = await fetch(`${basis}/api/organisatie/me?org=3`);
      expect(res.status).toBe(401);
    });
  });
});
