// ---------------------------------------------------------------------------
// tests/bekwaamheid-normprofiel-routes.test.ts
//
// De drie schrijfwegen van de norm, getoetst door het echte webadres heen: een
// echte express-app, een echte http-server op een vrije poort, echte
// fetch-verzoeken. Niet door de moduleaanroep, want juist de weg van formulier
// naar tabel is waar de onwijzigbaarheid van een bevroren cesuur kan wegvallen.
//
// De databank is `:memory:` met alleen de kolommen die de opslag leest, maar
// mét de drie CHECKs uit de migratie. Zonder die CHECKs zou de test kunnen
// slagen op een tabel die in productie zou weigeren.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import { registerNormprofielRoutes } from "../server/bekwaamheid/routes-normprofiel";

const WEGING = { weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.2 };
const DREMPELS = { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 };

/**
 * Een onderbouwing die de CHECK van 200 tekens haalt.
 *
 * Bewust geen `"x".repeat(200)`: de tabel eist lengte, maar de bedoeling van het
 * veld is verantwoording. Een test die met vulsel slaagt, nodigt uit om er in
 * productie ook vulsel in te zetten.
 */
const ONDERBOUWING =
  "De cesuur volgt de Angoff-schatting van het panel van vier beoordelaars, " +
  "afgerond naar beneden op het eerstvolgende veelvoud van vijf procentpunt. " +
  "De asdrempel van zestig procent komt uit de spreiding van de nulmeting; " +
  "de totaaldrempel van zeventig procent uit de tweede ronde van het panel.";

function proefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE bekwaamheid_normprofielen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id TEXT NOT NULL,
      versie INTEGER NOT NULL,
      weging TEXT NOT NULL,
      drempel_totaal REAL NOT NULL,
      drempel_per_as TEXT NOT NULL,
      activiteitsdrempel INTEGER NOT NULL,
      activiteitsvenster_maanden INTEGER NOT NULL,
      methode TEXT NOT NULL,
      paneel_omschrijving TEXT,
      vastgesteld_op TEXT NOT NULL,
      vastgesteld_door TEXT NOT NULL,
      bevroren_op TEXT,
      onderbouwing TEXT NOT NULL,
      CONSTRAINT bekwaamheid_normprofiel_versie CHECK (versie >= 1),
      CONSTRAINT bekwaamheid_normprofiel_drempel
        CHECK (drempel_totaal > 0 AND drempel_totaal <= 1),
      CONSTRAINT bekwaamheid_normprofiel_onderbouwing
        CHECK (length(onderbouwing) >= 200)
    );
    CREATE UNIQUE INDEX bekwaamheid_normprofiel_versie_uniek
      ON bekwaamheid_normprofielen (instrument_id, versie);
  `);
  return db;
}

let databank: Database.Database;
let opslag: ReturnType<typeof maakBekwaamheidOpslag>;
let auditspoor: Array<{ adminId: number | null; actie: string; detail?: string | null }>;

beforeEach(() => {
  databank = proefdatabank();
  auditspoor = [];
  opslag = maakBekwaamheidOpslag(databank, (invoer) => {
    auditspoor.push({
      adminId: invoer.adminId ?? null,
      actie: invoer.actie,
      detail: invoer.detail ?? null,
    });
    return undefined as never;
  });
});

function maakApp(adminId: number | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (adminId !== null) (req as any).session = { adminId };
    next();
  });
  registerNormprofielRoutes(app, { opslag });
  return app;
}

async function metServer<T>(
  app: express.Express,
  actie: (basis: string) => Promise<T>,
): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    return await actie(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

async function verzoek(
  adminId: number | null,
  methode: "GET" | "POST" | "PATCH",
  pad: string,
  lichaam?: unknown,
): Promise<{ status: number; lichaam: any }> {
  return metServer(maakApp(adminId), async (basis) => {
    const heeftLichaam = lichaam !== undefined && methode !== "GET";
    const antwoord = await fetch(`${basis}${pad}`, {
      method: methode,
      headers: heeftLichaam ? { "Content-Type": "application/json" } : undefined,
      body: heeftLichaam ? JSON.stringify(lichaam) : undefined,
    });
    return { status: antwoord.status, lichaam: await antwoord.json().catch(() => null) };
  });
}

function geldigLichaam(over: Record<string, unknown> = {}) {
  return {
    instrumentId: "t4p-business-kompas",
    weging: WEGING,
    drempelTotaal: 0.7,
    drempelPerAs: DREMPELS,
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    methode: "Angoff, panel van vier",
    paneelOmschrijving: "Vier beoordelaars, twee jaar ervaring elk.",
    vastgesteldDoor: "Kwaliteitsraad",
    onderbouwing: ONDERBOUWING,
    ...over,
  };
}

/** Legt langs de opslag een concept neer en geeft het id terug. */
function conceptNeergezet(instrument = "t4p-business-kompas"): number {
  const record = opslag.normprofielen.zetNeer({
    instrumentId: instrument,
    weging: WEGING as any,
    drempelTotaal: 0.7,
    drempelPerAs: DREMPELS as any,
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    methode: "Angoff, panel van vier",
    paneelOmschrijving: null,
    vastgesteldDoor: "Kwaliteitsraad",
    onderbouwing: ONDERBOUWING,
  });
  return record.id;
}

// ===========================================================================
describe("bewaking", () => {
  const wegen: Array<["GET" | "POST" | "PATCH", string, unknown?]> = [
    ["GET", "/api/bekwaamheid/normprofiel-instrumenten"],
    ["GET", "/api/bekwaamheid/normprofiel/t4p-business-kompas"],
    ["POST", "/api/bekwaamheid/normprofiel", {}],
    ["PATCH", "/api/bekwaamheid/normprofiel/1", {}],
    ["POST", "/api/bekwaamheid/normprofiel/1/bevries", { bevestigd: true }],
  ];

  for (const [methode, pad, lichaam] of wegen) {
    it(`weigert ${methode} ${pad} zonder admin-sessie`, async () => {
      const uit = await verzoek(null, methode, pad, lichaam);
      expect(uit.status).toBe(401);
    });
  }

  it("laat een niet-aangemeld verzoek niets in de tabel schrijven", async () => {
    await verzoek(null, "POST", "/api/bekwaamheid/normprofiel", geldigLichaam());
    const aantal = databank
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_normprofielen")
      .get() as { n: number };
    expect(aantal.n).toBe(0);
  });
});

// ===========================================================================
describe("schrijfweg 1 — neerleggen", () => {
  it("legt een geldig profiel neer als concept, versie 1", async () => {
    const uit = await verzoek(7, "POST", "/api/bekwaamheid/normprofiel", geldigLichaam());
    expect(uit.status).toBe(201);
    expect(uit.lichaam.normprofiel.versie).toBe(1);
    expect(uit.lichaam.normprofiel.bevrorenOp).toBeNull();
  });

  it("legt de handelende beheerder vast in het auditspoor", async () => {
    await verzoek(7, "POST", "/api/bekwaamheid/normprofiel", geldigLichaam());
    expect(auditspoor).toEqual([
      expect.objectContaining({ actie: "bekwaamheid_normprofiel_vastgelegd", adminId: 7 }),
    ]);
  });

  it("laat de aanroeper het versienummer niet kiezen", async () => {
    await verzoek(7, "POST", "/api/bekwaamheid/normprofiel", geldigLichaam());
    const tweede = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ versie: 1 }),
    );
    expect(tweede.status).toBe(201);
    expect(tweede.lichaam.normprofiel.versie).toBe(2);
  });

  it("weigert zonder instrument met 400", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ instrumentId: "" }),
    );
    expect(uit.status).toBe(400);
  });

  it("keurt een weging af die niet op 1 sluit, met het veld erbij", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ weging: { weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.3 } }),
    );
    expect(uit.status).toBe(422);
    expect(uit.lichaam.bevindingen.map((b: any) => b.veld)).toContain("weging");
  });

  it("keurt een onderbouwing onder de tweehonderd tekens af", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ onderbouwing: "Te kort." }),
    );
    expect(uit.status).toBe(422);
    expect(uit.lichaam.bevindingen.map((b: any) => b.veld)).toContain("onderbouwing");
  });

  it("keurt een ontbrekende methode af", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ methode: "   " }),
    );
    expect(uit.status).toBe(422);
    expect(uit.lichaam.bevindingen.map((b: any) => b.veld)).toContain("methode");
  });

  it("keurt af wanneer niet vermeld staat wie de norm vaststelde", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ vastgesteldDoor: "" }),
    );
    expect(uit.status).toBe(422);
    expect(uit.lichaam.bevindingen.map((b: any) => b.veld)).toContain("vastgesteldDoor");
  });

  it("schrijft niets bij een afkeuring", async () => {
    await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({ onderbouwing: "Te kort." }),
    );
    const aantal = databank
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_normprofielen")
      .get() as { n: number };
    expect(aantal.n).toBe(0);
    expect(auditspoor).toEqual([]);
  });

  it("neemt getallen aan die als tekst uit een formulier komen", async () => {
    const uit = await verzoek(
      7,
      "POST",
      "/api/bekwaamheid/normprofiel",
      geldigLichaam({
        drempelTotaal: "0.7",
        activiteitsdrempel: "6",
        activiteitsvensterMaanden: "24",
        weging: { weten: "0.2", zien: "0.3", zeggen: "0.3", zorgen: "0.2" },
      }),
    );
    expect(uit.status).toBe(201);
    expect(uit.lichaam.normprofiel.drempelTotaal).toBe(0.7);
  });
});

// ===========================================================================
describe("schrijfweg 2 — wijzigen", () => {
  it("wijzigt een concept en laat het concept blijven", async () => {
    const id = conceptNeergezet();
    const uit = await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, {
      drempelTotaal: 0.75,
    });
    expect(uit.status).toBe(200);
    expect(uit.lichaam.normprofiel.drempelTotaal).toBe(0.75);
    expect(uit.lichaam.normprofiel.bevrorenOp).toBeNull();
  });

  it("laat velden die niet meegestuurd zijn ongemoeid", async () => {
    const id = conceptNeergezet();
    const uit = await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, {
      drempelTotaal: 0.75,
    });
    expect(uit.lichaam.normprofiel.methode).toBe("Angoff, panel van vier");
    expect(uit.lichaam.normprofiel.activiteitsdrempel).toBe(6);
  });

  it("WEIGERT wijzigen van een bevroren profiel met 409", async () => {
    const id = conceptNeergezet();
    opslag.normprofielen.bevries(id);
    const uit = await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, {
      drempelTotaal: 0.9,
    });
    expect(uit.status).toBe(409);
    expect(uit.lichaam.fout).toMatch(/bevroren/);
  });

  it("laat de tabel onaangeroerd wanneer het profiel bevroren is", async () => {
    const id = conceptNeergezet();
    opslag.normprofielen.bevries(id);
    await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, { drempelTotaal: 0.9 });
    const rij = databank
      .prepare("SELECT drempel_totaal FROM bekwaamheid_normprofielen WHERE id = ?")
      .get(id) as { drempel_totaal: number };
    expect(rij.drempel_totaal).toBe(0.7);
  });

  it("keurt een wijziging af die de weging kapot maakt, met de velden erbij", async () => {
    const id = conceptNeergezet();
    const uit = await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, {
      weging: { weten: 0.5, zien: 0.5, zeggen: 0.5, zorgen: 0.5 },
    });
    expect(uit.status).toBe(422);
    expect(uit.lichaam.bevindingen.map((b: any) => b.veld)).toContain("weging");
  });

  it("geeft 404 op een profiel dat niet bestaat", async () => {
    const uit = await verzoek(7, "PATCH", "/api/bekwaamheid/normprofiel/999", {
      drempelTotaal: 0.75,
    });
    expect(uit.status).toBe(404);
  });

  it("weigert een id dat geen zuiver getal is", async () => {
    const uit = await verzoek(7, "PATCH", "/api/bekwaamheid/normprofiel/1abc", {
      drempelTotaal: 0.75,
    });
    expect(uit.status).toBe(400);
  });
});

// ===========================================================================
describe("schrijfweg 3 — bevriezen", () => {
  it("bevriest een concept en meldt dat het onomkeerbaar is", async () => {
    const id = conceptNeergezet();
    const uit = await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, {
      bevestigd: true,
    });
    expect(uit.status).toBe(200);
    expect(uit.lichaam.normprofiel.bevrorenOp).not.toBeNull();
    expect(uit.lichaam.onomkeerbaar).toBe(true);
  });

  it("bevriest niet zonder uitdrukkelijke bevestiging", async () => {
    const id = conceptNeergezet();
    const uit = await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, {});
    expect(uit.status).toBe(400);
    const rij = databank
      .prepare("SELECT bevroren_op FROM bekwaamheid_normprofielen WHERE id = ?")
      .get(id) as { bevroren_op: string | null };
    expect(rij.bevroren_op).toBeNull();
  });

  it("WEIGERT bevriezen van een al bevroren profiel met 409", async () => {
    const id = conceptNeergezet();
    await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, { bevestigd: true });
    const tweede = await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, {
      bevestigd: true,
    });
    expect(tweede.status).toBe(409);
    expect(tweede.lichaam.fout).toMatch(/al bevroren/);
  });

  it("verandert het bevriesmoment niet bij een tweede poging", async () => {
    const id = conceptNeergezet();
    await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, { bevestigd: true });
    const eerste = (
      databank
        .prepare("SELECT bevroren_op FROM bekwaamheid_normprofielen WHERE id = ?")
        .get(id) as { bevroren_op: string }
    ).bevroren_op;
    await verzoek(7, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, { bevestigd: true });
    const na = (
      databank
        .prepare("SELECT bevroren_op FROM bekwaamheid_normprofielen WHERE id = ?")
        .get(id) as { bevroren_op: string }
    ).bevroren_op;
    expect(na).toBe(eerste);
  });

  it("geeft 404 op een profiel dat niet bestaat", async () => {
    const uit = await verzoek(7, "POST", "/api/bekwaamheid/normprofiel/999/bevries", {
      bevestigd: true,
    });
    expect(uit.status).toBe(404);
  });

  it("legt de bevriezing vast in het auditspoor met de beheerder erbij", async () => {
    const id = conceptNeergezet();
    auditspoor = [];
    await verzoek(11, "POST", `/api/bekwaamheid/normprofiel/${id}/bevries`, { bevestigd: true });
    expect(auditspoor).toEqual([
      expect.objectContaining({ actie: "bekwaamheid_normprofiel_bevroren", adminId: 11 }),
    ]);
  });
});

// ===========================================================================
describe("er is geen ontdooiweg", () => {
  /**
   * De harde grens van blok 3. Een bevroren cesuur gaat niet open, en dat mag
   * niet afhangen van de vraag of iemand het formulier netjes gebruikt. Deze
   * tests toetsen de afwezigheid van de weg zelf.
   */
  const verboden: Array<["POST" | "PATCH", string]> = [
    ["POST", "/api/bekwaamheid/normprofiel/1/ontdooi"],
    ["POST", "/api/bekwaamheid/normprofiel/1/heropen"],
    ["POST", "/api/bekwaamheid/normprofiel/1/ontbevries"],
  ];

  for (const [methode, pad] of verboden) {
    it(`kent ${pad} niet`, async () => {
      const uit = await verzoek(7, methode, pad, { bevestigd: true });
      expect(uit.status).toBe(404);
    });
  }

  it("laat bevroren_op niet terugzetten via de wijzigweg", async () => {
    const id = conceptNeergezet();
    opslag.normprofielen.bevries(id);
    await verzoek(7, "PATCH", `/api/bekwaamheid/normprofiel/${id}`, { bevrorenOp: null });
    const rij = databank
      .prepare("SELECT bevroren_op FROM bekwaamheid_normprofielen WHERE id = ?")
      .get(id) as { bevroren_op: string | null };
    expect(rij.bevroren_op).not.toBeNull();
  });

  it("noemt in de broncode van de routes geen ontdooifunctie", () => {
    const bron = readFileSync("server/bekwaamheid/routes-normprofiel.ts", "utf8");
    // Alleen de code, niet de toelichting: het commentaar legt juist uit dat de
    // weg er niet is, en dat mag deze test niet als overtreding lezen.
    const code = bron
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((r) => !r.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/ontdooi|ontbevries|heropen/i);
  });
});

// ===========================================================================
describe("leeswegen", () => {
  it("geeft de instrumenten met hun geldende versie", async () => {
    const uit = await verzoek(7, "GET", "/api/bekwaamheid/normprofiel-instrumenten");
    expect(uit.status).toBe(200);
    expect(Array.isArray(uit.lichaam.instrumenten)).toBe(true);
    expect(uit.lichaam.instrumenten.length).toBeGreaterThan(0);
    for (const regel of uit.lichaam.instrumenten) {
      expect(typeof regel.instrumentId).toBe("string");
      expect(typeof regel.naam).toBe("string");
    }
  });

  it("noemt een concept geen geldende versie", async () => {
    conceptNeergezet();
    const uit = await verzoek(7, "GET", "/api/bekwaamheid/normprofiel-instrumenten");
    const regel = uit.lichaam.instrumenten.find(
      (r: any) => r.instrumentId === "t4p-business-kompas",
    );
    expect(regel.geldendeVersie).toBeNull();
    expect(regel.heeftConcept).toBe(true);
    expect(regel.aantalVersies).toBe(1);
  });

  it("noemt na bevriezing wel een geldende versie", async () => {
    const id = conceptNeergezet();
    opslag.normprofielen.bevries(id);
    const uit = await verzoek(7, "GET", "/api/bekwaamheid/normprofiel-instrumenten");
    const regel = uit.lichaam.instrumenten.find(
      (r: any) => r.instrumentId === "t4p-business-kompas",
    );
    expect(regel.geldendeVersie).toBe(1);
    expect(regel.heeftConcept).toBe(false);
  });

  it("geeft per instrument de historiek, nieuwste eerst", async () => {
    const eerste = conceptNeergezet();
    opslag.normprofielen.bevries(eerste);
    conceptNeergezet();
    const uit = await verzoek(7, "GET", "/api/bekwaamheid/normprofiel/t4p-business-kompas");
    expect(uit.status).toBe(200);
    expect(uit.lichaam.versies.map((v: any) => v.versie)).toEqual([2, 1]);
    expect(uit.lichaam.geldend.versie).toBe(1);
    expect(uit.lichaam.concept.versie).toBe(2);
  });

  it("geeft lege velden voor een instrument zonder norm", async () => {
    const uit = await verzoek(7, "GET", "/api/bekwaamheid/normprofiel/t4kids");
    expect(uit.status).toBe(200);
    expect(uit.lichaam.geldend).toBeNull();
    expect(uit.lichaam.concept).toBeNull();
    expect(uit.lichaam.versies).toEqual([]);
  });
});

// ===========================================================================
describe("weerbaarheid", () => {
  it("laat een leeg lichaam de server niet omleggen", async () => {
    const app = maakApp(7);
    const uit = await metServer(app, async (basis) => {
      const antwoord = await fetch(`${basis}/api/bekwaamheid/normprofiel`, { method: "POST" });
      return antwoord.status;
    });
    expect(uit).toBe(400);
  });

  it("geeft 500 en geen halve waarheid wanneer de opslag onverwacht faalt", async () => {
    const stukkeOpslag = {
      normprofielen: new Proxy(
        {},
        {
          get() {
            return () => {
              throw new Error("de databank is weg");
            };
          },
        },
      ),
    } as any;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { adminId: 7 };
      next();
    });
    registerNormprofielRoutes(app, { opslag: stukkeOpslag });
    const uit = await metServer(app, async (basis) => {
      const antwoord = await fetch(`${basis}/api/bekwaamheid/normprofiel/7/bevries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bevestigd: true }),
      });
      return { status: antwoord.status, lichaam: await antwoord.json() };
    });
    expect(uit.status).toBe(500);
    expect(uit.lichaam.fout).toMatch(/databank is weg/);
  });
});
