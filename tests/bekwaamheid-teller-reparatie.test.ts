import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";

// ---------------------------------------------------------------------------
// De poort van blok 1 eist letterlijk: "een nieuwe test die aantoont dat het
// kwaliteitsdashboard nu échte afnames telt, met een testgeval waarin iemand
// veel oefent en niets afneemt."
//
// Die eis valt uiteen in twee beweringen die elk op een eigen manier gemeten
// moeten worden, want geen van de twee bewijst de andere:
//
//   A. De teller leest de juiste tabel. Meetbaar met een echte databank:
//      `telAfnames` bevraagt `afnames`, niet `stm_sessies`.
//   B. Het dashboard gebruikt die teller. Meetbaar door de route werkelijk te
//      draaien: `afnames_count` in het antwoord komt uit `telAfnames` en niet
//      uit `stmSessieOpslagen.historiek()`.
//
// Een test die alleen A doet, laat de mogelijkheid open dat het dashboard de
// gerepareerde teller nooit aanroept. Een test die alleen B doet, laat de
// mogelijkheid open dat de teller zelf het verkeerde telt. Vandaar beide.
//
// Deel C meet de dubbele scoreschaal tegen de werkelijke schrijfformules van
// beide bronnen, en niet — zoals de bestaande tests in
// tests/bekwaamheid-opslag.test.ts — tegen met de hand gekozen getallen.
// ---------------------------------------------------------------------------

const migratie = readFileSync("migrations/0006_bekwaamheid.sql", "utf8").replaceAll(
  "--> statement-breakpoint",
  "",
);

const BEHEERDER_ID = 7;
const JAAR = new Date().getFullYear();

function maakProefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE beheerders (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL,
      email TEXT NOT NULL
    );
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY,
      aangemaakt_door_beheerder_id INTEGER,
      instrument_id TEXT,
      status TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE stm_sessies (
      id INTEGER PRIMARY KEY,
      beheerder_id INTEGER,
      afgerond_at TEXT,
      score_totaal REAL,
      scores_per_laag TEXT
    );
  `);
  db.exec(migratie);
  db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (?, ?, ?)").run(
    BEHEERDER_ID,
    "Marc Debisschop",
    "marc@tapascity.com",
  );
  return db;
}

/**
 * Bootst de werkelijke schrijfweg van de oefenmodule na.
 *
 * `POST /api/stm/afronden` (server/routes-stm.ts:648-650) berekent
 * `scoreTotaal = totaalCorrect / totaalVragen` en per laag `correct / totaal`,
 * met sleutels `laag1`..`laag4`. Dat zijn breuken tussen 0 en 1. Die formule
 * staat hier nagebouwd in plaats van dat er een getal wordt verzonnen, zodat de
 * test breekt wanneer de bron van schaal verandert.
 */
function echteOefensessie(
  db: Database.Database,
  id: number,
  datum: string,
  correctPerLaag: [number, number, number, number],
  vragenPerLaag: number,
) {
  const scoresPerLaag: Record<string, number> = {};
  let totaalCorrect = 0;
  let totaalVragen = 0;
  for (let l = 1; l <= 4; l++) {
    const correct = correctPerLaag[l - 1];
    scoresPerLaag[`laag${l}`] = vragenPerLaag > 0 ? correct / vragenPerLaag : 0;
    totaalCorrect += correct;
    totaalVragen += vragenPerLaag;
  }
  const scoreTotaal = totaalVragen > 0 ? totaalCorrect / totaalVragen : 0;
  db.prepare(
    `INSERT INTO stm_sessies (id, beheerder_id, afgerond_at, score_totaal, scores_per_laag)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, BEHEERDER_ID, `${datum}T12:00:00.000Z`, scoreTotaal, JSON.stringify(scoresPerLaag));
  return { scoreTotaal, scoresPerLaag };
}

/**
 * Bootst de werkelijke schrijfweg van de demoseed na.
 *
 * `seedDemoKwaliteit()` (server/kwaliteit-storage.ts:363-372) schrijft
 * `Math.round((62 + rnd() * 36) * 10) / 10`, dus een percentage tussen 62 en 98
 * met één decimaal, en per laag `score - 4 + rnd() * 8` onder sleutels
 * `"1"`..`"4"`. De willekeur is hier vervangen door een meegegeven fractie,
 * zodat de test herhaalbaar is zonder de formule te wijzigen.
 */
function demoOefensessie(db: Database.Database, id: number, datum: string, fractie: number) {
  const score = Math.round((62 + fractie * 36) * 10) / 10;
  const scoresPerLaag: Record<string, number> = {};
  for (let l = 1; l <= 4; l++) {
    scoresPerLaag[String(l)] = Math.round((score - 4 + fractie * 8) * 10) / 10;
  }
  db.prepare(
    `INSERT INTO stm_sessies (id, beheerder_id, afgerond_at, score_totaal, scores_per_laag)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, BEHEERDER_ID, `${datum}T12:00:00.000Z`, score, JSON.stringify(scoresPerLaag));
  return { score, scoresPerLaag };
}

function voltooideAfname(db: Database.Database, id: number, datum: string) {
  db.prepare(
    `INSERT INTO afnames (id, aangemaakt_door_beheerder_id, instrument_id, status, completed_at)
     VALUES (?, ?, 't4p-business-kompas', 'voltooid', ?)`,
  ).run(id, BEHEERDER_ID, `${datum}T12:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// A. De teller leest de juiste tabel
// ---------------------------------------------------------------------------

describe("A — de gerepareerde teller leest afnames en niet oefensessies", () => {
  let db: Database.Database;
  let opslag: ReturnType<typeof maakBekwaamheidOpslag>;

  beforeEach(() => {
    db = maakProefdatabank();
    opslag = maakBekwaamheidOpslag(db, () => {});
  });

  it("houdt de teller op nul bij iemand die veel oefent en niets afneemt", () => {
    // Het geval uit de opleverpoort. Twaalf afgeronde oefensessies — precies de
    // jaarnorm van het oude dashboard — en geen enkele afname.
    for (let i = 1; i <= 12; i++) {
      echteOefensessie(db, i, `${JAAR}-03-${String(i).padStart(2, "0")}`, [5, 5, 5, 5], 5);
    }

    const afnames = opslag.tellers.telAfnames({
      beheerderId: BEHEERDER_ID,
      van: `${JAAR}-01-01`,
      tot: `${JAAR}-12-31`,
    });
    const oefening = opslag.tellers.leesOefenaggregaat({
      beheerderId: BEHEERDER_ID,
      van: `${JAAR}-01-01`,
      tot: `${JAAR}-12-31`,
    });

    expect(afnames).toBe(0);
    // De oefensessies verdwijnen niet, ze staan onder hun eigen naam. Dat is de
    // helft van de reparatie die makkelijk stil te verliezen is.
    expect(oefening.sessies).toBe(12);
  });

  it("telt veertig afnames van iemand die nooit oefent", () => {
    // Het omgekeerde geval. Onder het oude gedrag stond deze persoon op
    // "achterstand_50" en kreeg drie alerteringsmails.
    for (let i = 1; i <= 40; i++) {
      const maand = String(1 + (i % 9)).padStart(2, "0");
      const dag = String(1 + (i % 27)).padStart(2, "0");
      voltooideAfname(db, i, `${JAAR}-${maand}-${dag}`);
    }

    expect(
      opslag.tellers.telAfnames({
        beheerderId: BEHEERDER_ID,
        van: `${JAAR}-01-01`,
        tot: `${JAAR}-12-31`,
      }),
    ).toBe(40);
    expect(
      opslag.tellers.leesOefenaggregaat({
        beheerderId: BEHEERDER_ID,
        van: `${JAAR}-01-01`,
        tot: `${JAAR}-12-31`,
      }).sessies,
    ).toBe(0);
  });

  it("laat de laatste activiteit uit afnames komen en niet uit de oefenhistoriek", () => {
    voltooideAfname(db, 1, `${JAAR}-02-10`);
    echteOefensessie(db, 2, `${JAAR}-11-30`, [4, 4, 4, 4], 5);

    // De oefensessie is later, maar de laatste activiteit is de afname.
    expect(opslag.tellers.laatsteAfname(BEHEERDER_ID)).toContain(`${JAAR}-02-10`);
  });
});

// ---------------------------------------------------------------------------
// B. Het dashboard gebruikt die teller
// ---------------------------------------------------------------------------

/**
 * Het dashboard wordt hier werkelijk aangeroepen. `berekenKwaliteitsStatus`
 * staat als geneste functie binnen `registerStmRoutes` en is niet geëxporteerd;
 * de route is dus de enige weg naar de berekening. Dat is bewust zo gelaten:
 * de functie naar buiten tillen zou een bestand raken dat buiten de bewaakte
 * grens van blok 1 valt, en de route meet bovendien wat er werkelijk wordt
 * geleverd in plaats van wat er berekend zou kunnen worden.
 */
const oefensessies: Array<{ afgerond_at: string }> = [];
const afnamesPerPersoon = new Map<number, number>();
const laatsteAfnamePerPersoon = new Map<number, string | null>();

vi.mock("../server/stm-storage", () => ({
  stmSessieOpslagen: {
    historiek: () => oefensessies,
  },
}));

vi.mock("../server/kwaliteit-storage", () => ({
  kwaliteitOpslag: {
    getNorm: () => 12,
    getOverride: () => undefined,
    getAlerts: () => ({ trap1: null, trap2: null, trap3: null }),
    getNotities: () => [],
  },
  // De seed wordt bij route-registratie aangeroepen. Hier stilgezet: deze test
  // meet de teller, niet de seed.
  seedDemoKwaliteit: () => ({ geseed: false, sessies: 0, notities: 0 }),
}));

vi.mock("../server/bekwaamheid/storage", async (echt) => {
  const werkelijk = (await echt()) as Record<string, unknown>;
  return {
    ...werkelijk,
    bekwaamheidOpslag: {
      register: { lijst: () => [], vindOp: () => undefined },
      tellers: {
        telAfnames: ({ beheerderId }: { beheerderId: number }) =>
          afnamesPerPersoon.get(beheerderId) ?? 0,
        laatsteAfname: (beheerderId: number) => laatsteAfnamePerPersoon.get(beheerderId) ?? null,
      },
    },
  };
});

vi.mock("../server/demomodus", () => ({ isDemoModus: () => false }));
// Gedeeltelijk gemockt: alleen de aanmeldweg wordt stilgezet. Volledig
// vervangen liet `hashWachtwoord` verdwijnen, waardoor het seedproces bij het
// importeren een waarschuwing gaf — een testopzet die de ingang van het systeem
// verandert, meet iets anders dan wat er draait.
vi.mock("../server/auth/wachtwoord", async (echt) => {
  const werkelijk = (await echt()) as Record<string, unknown>;
  return { ...werkelijk, verifieerWachtwoord: async () => false };
});
vi.mock("../server/sessie-identiteit", () => ({
  zetSessieIdentiteit: () => {},
  wisSessieIdentiteit: () => {},
}));

const { registerStmRoutes } = await import("../server/routes-stm");

async function vraagDashboard(): Promise<any> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { adminId: 1 };
    next();
  });
  registerStmRoutes(app, {
    listBeheerders: async () => [
      { id: BEHEERDER_ID, naam: "Marc Debisschop", email: "marc@tapascity.com" },
    ],
    getBeheerder: async () => undefined,
  });

  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const antwoord = await fetch(`http://127.0.0.1:${poort}/api/kwaliteit/dashboard`);
    return { status: antwoord.status, lichaam: await antwoord.json() };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

describe("B — het dashboard levert de gerepareerde teller uit", () => {
  beforeEach(() => {
    oefensessies.length = 0;
    afnamesPerPersoon.clear();
    laatsteAfnamePerPersoon.clear();
  });

  afterEach(() => {
    oefensessies.length = 0;
    afnamesPerPersoon.clear();
    laatsteAfnamePerPersoon.clear();
  });

  it("geeft nul afnames en twaalf oefensessies bij wie veel oefent en niets afneemt", async () => {
    for (let i = 1; i <= 12; i++) {
      oefensessies.push({ afgerond_at: `${JAAR}-03-${String(i).padStart(2, "0")}T12:00:00.000Z` });
    }
    afnamesPerPersoon.set(BEHEERDER_ID, 0);

    const { status, lichaam } = await vraagDashboard();
    expect(status).toBe(200);
    const rij = lichaam.practitioners.find((p: any) => p.beheerder_id === BEHEERDER_ID);

    // De kern van de reparatie: twaalf afgeronde oefensessies leverden onder het
    // oude gedrag `afnames_count: 12` en de status "norm_gehaald" op.
    expect(rij.afnames_count).toBe(0);
    expect(rij.status_berekend).toBe("achterstand_50");
    // En de oefening blijft zichtbaar onder een eigen sleutel.
    expect(rij.oefensessies_count).toBe(12);
  });

  it("geeft de norm als gehaald bij wie afneemt en nooit oefent", async () => {
    afnamesPerPersoon.set(BEHEERDER_ID, 12);
    laatsteAfnamePerPersoon.set(BEHEERDER_ID, `${JAAR}-06-01T12:00:00.000Z`);

    const { lichaam } = await vraagDashboard();
    const rij = lichaam.practitioners.find((p: any) => p.beheerder_id === BEHEERDER_ID);

    expect(rij.afnames_count).toBe(12);
    expect(rij.oefensessies_count).toBe(0);
    expect(rij.status_berekend).toBe("norm_gehaald");
    expect(rij.laatste_activiteit).toContain(`${JAAR}-06-01`);
  });

  it("scheidt laatste activiteit van laatste oefensessie", async () => {
    oefensessies.push({ afgerond_at: `${JAAR}-11-30T12:00:00.000Z` });
    afnamesPerPersoon.set(BEHEERDER_ID, 3);
    laatsteAfnamePerPersoon.set(BEHEERDER_ID, `${JAAR}-02-10T12:00:00.000Z`);

    const { lichaam } = await vraagDashboard();
    const rij = lichaam.practitioners.find((p: any) => p.beheerder_id === BEHEERDER_ID);

    // Twee velden, twee begrippen. Ze stonden eerder allebei op de oefenkant.
    expect(rij.laatste_activiteit).toContain(`${JAAR}-02-10`);
    expect(rij.laatste_oefensessie).toContain(`${JAAR}-11-30`);
  });

  it("weigert het dashboard zonder beheerderssessie", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = {};
      next();
    });
    registerStmRoutes(app, { listBeheerders: async () => [], getBeheerder: async () => undefined });
    const server = createServer(app);
    await new Promise<void>((klaar) => server.listen(0, klaar));
    const poort = (server.address() as AddressInfo).port;
    try {
      const antwoord = await fetch(`http://127.0.0.1:${poort}/api/kwaliteit/dashboard`);
      expect(antwoord.status).toBe(401);
    } finally {
      await new Promise<void>((klaar) => server.close(() => klaar()));
    }
  });
});

// ---------------------------------------------------------------------------
// C. De dubbele scoreschaal, gemeten tegen beide werkelijke schrijfwegen
// ---------------------------------------------------------------------------

describe("C — de omrekening werkt op beide bronnen zoals die werkelijk schrijven", () => {
  let db: Database.Database;
  let opslag: ReturnType<typeof maakBekwaamheidOpslag>;

  beforeEach(() => {
    db = maakProefdatabank();
    opslag = maakBekwaamheidOpslag(db, () => {});
  });

  function aggregaat() {
    return opslag.tellers.leesOefenaggregaat({
      beheerderId: BEHEERDER_ID,
      van: `${JAAR}-01-01`,
      tot: `${JAAR}-12-31`,
    });
  }

  it("leest een sessie van de echte weg op de honderdschaal", () => {
    // Achttien van de twintig goed: de bron schrijft 0,9.
    const geschreven = echteOefensessie(db, 1, `${JAAR}-04-01`, [5, 5, 4, 4], 5);
    expect(geschreven.scoreTotaal).toBeCloseTo(0.9, 10);

    expect(aggregaat().gemiddelde).toBe(90);
  });

  it("laat een sessie van de demoseed op zijn eigen schaal staan", () => {
    const geschreven = demoOefensessie(db, 1, `${JAAR}-04-01`, 0.5);
    // De formule levert 80: 62 + 0,5 × 36.
    expect(geschreven.score).toBe(80);

    expect(aggregaat().gemiddelde).toBe(80);
  });

  it("brengt beide bronnen in één databank op dezelfde schaal", () => {
    // Dit is het geval dat de bestaande tests niet dekken: een databank waarin
    // beide schrijfwegen naast elkaar hebben gestaan. Zonder omrekening zou het
    // gemiddelde van 0,9 en 80 uitkomen op 40,45 — een getal dat niets betekent.
    echteOefensessie(db, 1, `${JAAR}-04-01`, [5, 5, 4, 4], 5); // → 90
    demoOefensessie(db, 2, `${JAAR}-05-01`, 0.5); // → 80

    const uit = aggregaat();
    expect(uit.sessies).toBe(2);
    expect(uit.gemiddelde).toBe(85);
  });

  it("brengt de laagsleutels van beide bronnen onder dezelfde namen samen", () => {
    // De echte weg schrijft `laag1`, de seed schrijft `"1"`. Ongenormaliseerd
    // levert dat acht lagen in plaats van vier.
    echteOefensessie(db, 1, `${JAAR}-04-01`, [5, 5, 5, 5], 5);
    demoOefensessie(db, 2, `${JAAR}-05-01`, 1);

    const perLaag = aggregaat().perLaag!;
    expect(Object.keys(perLaag).sort()).toEqual(["laag1", "laag2", "laag3", "laag4"]);
  });

  it("houdt de omrekening buiten de kolom zelf", () => {
    // De leesomrekening mag de bron niet aanpassen: de oefenmodule en het
    // bestaande dashboard lezen dezelfde kolom en vallen buiten dit blok.
    echteOefensessie(db, 1, `${JAAR}-04-01`, [5, 5, 4, 4], 5);
    aggregaat();

    const rij = db
      .prepare("SELECT score_totaal FROM stm_sessies WHERE id = 1")
      .get() as { score_totaal: number };
    expect(rij.score_totaal).toBeCloseTo(0.9, 10);
  });
});

// ---------------------------------------------------------------------------
// D. Een vastgestelde consequentie van de reparatie
// ---------------------------------------------------------------------------

describe("D — de demoseed levert na de reparatie geen afnames op", () => {
  it("legt vast dat de seed naar stm_sessies schrijft en dus niet meetelt", () => {
    // Feit, geen mening: `seedDemoKwaliteit()` heet in zijn eigen logregel
    // "afname-sessies" te seeden, maar de enige INSERT in
    // server/kwaliteit-storage.ts die oefendata aanmaakt, gaat naar
    // `stm_sessies` (regel 339). Er is geen INSERT INTO afnames.
    //
    // Gevolg van de reparatie: in de publieke demo staat iedereen op nul
    // afnames en dus op "achterstand_50". Dat is geen fout in de teller — het
    // dashboard telt nu wat het zegt te tellen — maar het demobeeld is leeg
    // geworden. Deze test legt dat vast zodat het een besluit blijft en geen
    // verrassing wordt.
    const bron = readFileSync("server/kwaliteit-storage.ts", "utf8");
    const regels = bron
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => !r.startsWith("//") && !r.startsWith("*") && !r.startsWith("/*"));
    const inserts = regels.filter((r) => r.includes("INSERT INTO"));

    expect(inserts.some((r) => r.includes("INSERT INTO stm_sessies"))).toBe(true);
    expect(inserts.some((r) => /INSERT INTO\s+afnames/.test(r))).toBe(false);
  });
});
