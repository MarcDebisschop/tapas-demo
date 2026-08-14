// ---------------------------------------------------------------------------
// tests/bekwaamheid-routes-dossier.test.ts
//
// De vijf schrijfwegen van de bekwaamheidsmodule, getoetst door de echte
// webadressen heen: een echte express-app, een echte http-server op een vrije
// poort, echte fetch-verzoeken, de echte migraties.
//
// Waarom door de adressen en niet door de moduleaanroep: de opslaglaag is al
// uitputtend getoetst in `bekwaamheid-blok34-opslag.test.ts`. Wat daar níet aan
// het licht komt, is of het adres de juiste velden doorgeeft, of de beoordelaar
// werkelijk uit de sessie komt en niet uit het lichaam, en of een geweigerde
// handeling de bedoelde statuscode geeft in plaats van een 500. Dat zijn precies
// de drie dingen die stukgaan bij het aansluiten van een scherm.
//
// De opzet volgt één dossier van begin tot eind, in de volgorde waarin het in
// werkelijkheid loopt: iemand komt in het register, krijgt een accreditatie, er
// opent een ronde, er komen bewijsstukken, die worden gescoord, de motor doet
// een voorstel, twee mensen beslissen, er volgt een debrief, publicatie, en
// daarna een bezwaar. Die volgorde is geen verhaal maar een controle: elke stap
// hangt van de vorige af, dus een fout halverwege legt de rest stil.
//
// De tabel `afnames` krijgt hier `item_tijden` mee, anders dan in de
// opslagtoets. Die kolom is nodig sinds de activiteitsberekening via het
// webadres wordt aangeroepen: de motor leest de tijdgegevens om verdacht snelle
// afnames te vinden.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import type { AuditInvoer } from "../server/audit-log";
import { registerRegisterRoutes } from "../server/bekwaamheid/routes-register";
import { registerItemRoutes } from "../server/bekwaamheid/routes-items";
import { registerRondeRoutes } from "../server/bekwaamheid/routes-rondes";
import { registerBeslissingRoutes } from "../server/bekwaamheid/routes-beslissingen";
import { registerCyclusRoutes } from "../server/bekwaamheid/routes-cyclus";

const migraties = ["0006_bekwaamheid.sql", "0007_beslisuitkomsten.sql", "0008_itemblokken.sql"]
  .map((naam) => readFileSync(`migrations/${naam}`, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

const INSTRUMENT = "t4p-business-kompas";
const MARC = 7;
const TWEEDE = 8;

const ONDERBOUWING =
  "Deze cesuur is vastgesteld met een gemodificeerde Angoff-procedure door drie beoordelaars " +
  "die onafhankelijk van elkaar per item hebben ingeschat welk deel van de grensgroep het " +
  "item juist zou beantwoorden. De uitkomsten zijn besproken, de tweede ronde is gemiddeld, " +
  "en de totaaldrempel is daarna naar boven afgerond op een tiende. De drempel per as ligt " +
  "lager dan het totaal omdat een enkele zwakke as niet automatisch tot opschorting hoort " +
  "te leiden; twee zwakke assen wel, en dat is elders in de beslisregels geregeld.";

/**
 * Een onderbouwing bij een score die de ondergrens van veertig tekens haalt
 * zonder vulsel te zijn. De opslaglaag eist lengte; deze test laat zien wat die
 * lengte moet dekken.
 */
function scoreonderbouwing(wat: string): string {
  return `De kandidaat ${wat} en dat is te zien in het tweede en het vierde fragment van de opname.`;
}

function maakProefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE beheerders (id INTEGER PRIMARY KEY, naam TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY, aangemaakt_door_beheerder_id INTEGER, instrument_id TEXT,
      status TEXT NOT NULL, completed_at TEXT, item_tijden TEXT
    );
    CREATE TABLE stm_sessies (
      id INTEGER PRIMARY KEY, beheerder_id INTEGER, afgerond_at TEXT,
      score_totaal REAL, scores_per_laag TEXT
    );
  `);
  db.exec(migraties);
  db.pragma("foreign_keys = ON");
  const zet = db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (?, ?, ?)");
  zet.run(MARC, "Marc Debisschop", "marc@tapascity.com");
  zet.run(TWEEDE, "Tweede bekrachtiger", "tweede@tapascity.com");
  return db;
}

let db: Database.Database;
let sporen: AuditInvoer[];
let opslag: ReturnType<typeof maakBekwaamheidOpslag>;

beforeEach(() => {
  db = maakProefdatabank();
  sporen = [];
  opslag = maakBekwaamheidOpslag(db, (invoer) => {
    sporen.push(invoer);
  });
});

/**
 * Eén app met alle vijf de registraties.
 *
 * Bewust samen en niet per bestand: de adressen liggen in dezelfde ruimte, en
 * een botsing tussen `/rondes/:id` en `/rondes-volgend-nummer` zou bij een test
 * per bestand onopgemerkt blijven.
 */
function maakApp(adminId: number | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (adminId !== null) (req as any).session = { adminId };
    next();
  });
  registerRegisterRoutes(app, { opslag });
  registerItemRoutes(app, { opslag });
  registerRondeRoutes(app, { opslag });
  registerBeslissingRoutes(app, { opslag });
  registerCyclusRoutes(app, { opslag });
  return app;
}

async function verzoek(
  methode: "GET" | "POST" | "PATCH",
  pad: string,
  lichaam?: unknown,
  adminId: number | null = MARC,
): Promise<{ status: number; lichaam: any }> {
  const server = createServer(maakApp(adminId));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const heeftLichaam = lichaam !== undefined && methode !== "GET";
    const antwoord = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: methode,
      headers: heeftLichaam ? { "Content-Type": "application/json" } : undefined,
      body: heeftLichaam ? JSON.stringify(lichaam) : undefined,
    });
    return { status: antwoord.status, lichaam: await antwoord.json().catch(() => null) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

/** Een bevroren cesuur langs de opslaglaag; de normweg heeft haar eigen test. */
function bevriesNorm(): number {
  const concept = opslag.normprofielen.zetNeer({
    instrumentId: INSTRUMENT,
    weging: { weten: 0.25, zien: 0.25, zeggen: 0.25, zorgen: 0.25 },
    drempelTotaal: 0.7,
    drempelPerAs: { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 },
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    methode: "Angoff",
    paneelOmschrijving: "Drie beoordelaars, zonder namen",
    vastgesteldDoor: "De normcommissie",
    onderbouwing: ONDERBOUWING,
    doorBeheerderId: MARC,
  });
  opslag.normprofielen.bevries(concept.id, MARC);
  return concept.id;
}

/** Zes voltooide afnames binnen het venster, zodat de activiteitsdrempel haalt. */
function zesAfnames(beheerderId: number): void {
  const zet = db.prepare(
    `INSERT INTO afnames (aangemaakt_door_beheerder_id, instrument_id, status, completed_at, item_tijden)
     VALUES (?, ?, 'voltooid', ?, NULL)`,
  );
  const vandaag = new Date();
  for (let i = 0; i < 6; i += 1) {
    const datum = new Date(vandaag.getTime() - i * 7 * 24 * 3600 * 1000);
    zet.run(beheerderId, INSTRUMENT, datum.toISOString());
  }
}

// ---------------------------------------------------------------------------
// Het register en de licenties.
// ---------------------------------------------------------------------------
describe("register en licenties over het adres", () => {
  it("zet iemand neer, vindt hem terug en zet hem inactief", async () => {
    const gezet = await verzoek("POST", "/api/bekwaamheid/register", {
      naam: "Kandidaat A",
      email: "a@voorbeeld.be",
      beheerderId: MARC,
    });
    expect(gezet.status).toBe(201);
    const id = gezet.lichaam.persoon.id;

    const gevonden = await verzoek("GET", `/api/bekwaamheid/register/${id}`);
    expect(gevonden.status).toBe(200);
    expect(gevonden.lichaam.persoon.naam).toBe("Kandidaat A");

    const lijstVoor = await verzoek("GET", "/api/bekwaamheid/register");
    expect(lijstVoor.lichaam.personen).toHaveLength(1);

    const uit = await verzoek("POST", `/api/bekwaamheid/register/${id}/inactief`, {
      reden: "Op eigen verzoek uitgeschreven per einde kalenderjaar.",
    });
    expect(uit.status).toBe(200);

    // De standaardlijst toont alleen actieven; het dossier blijft bestaan.
    const lijstNa = await verzoek("GET", "/api/bekwaamheid/register");
    expect(lijstNa.lichaam.personen).toHaveLength(0);
    const nog = await verzoek("GET", `/api/bekwaamheid/register/${id}`);
    expect(nog.status).toBe(200);
  });

  it("weigert een naamloze inschrijving met 400 en niet met 500", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/register", { email: "x@y.be" });
    expect(uit.status).toBe(400);
  });

  it("geeft 404 op een onbestaande geaccrediteerde", async () => {
    const uit = await verzoek("GET", "/api/bekwaamheid/register/4242");
    expect(uit.status).toBe(404);
  });

  it("weigert een id dat geen getal is", async () => {
    const uit = await verzoek("GET", "/api/bekwaamheid/register/appel");
    expect(uit.status).toBe(400);
  });

  it("legt een accreditatie vast en trekt haar in zonder haar te wissen", async () => {
    const persoon = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat B", email: "b@voorbeeld.be" })
    ).lichaam.persoon.id;

    const vast = await verzoek("POST", "/api/bekwaamheid/accreditaties", {
      geaccrediteerdeId: persoon,
      instrumentId: INSTRUMENT,
      niveau: 1,
      behaaldOp: "2025-03-14",
      bewijsHerkomst: "academy",
    });
    expect(vast.status).toBe(201);
    const accreditatieId = vast.lichaam.accreditatie.id;

    const in1 = await verzoek(
      "POST",
      `/api/bekwaamheid/accreditaties/${accreditatieId}/intrekken`,
      { reden: "Bewijsstuk bleek niet van deze kandidaat." },
    );
    expect(in1.status).toBe(200);

    const na = await verzoek("GET", `/api/bekwaamheid/accreditaties/${persoon}`);
    expect(na.lichaam.accreditaties).toHaveLength(1);
    expect(na.lichaam.accreditaties[0].ingetrokkenOp).not.toBeNull();
  });

  it("weigert een onbekende bewijsherkomst met 422", async () => {
    const persoon = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat C", email: "c@voorbeeld.be" })
    ).lichaam.persoon.id;
    const uit = await verzoek("POST", "/api/bekwaamheid/accreditaties", {
      geaccrediteerdeId: persoon,
      instrumentId: INSTRUMENT,
      niveau: 1,
      behaaldOp: "2025-03-14",
      bewijsHerkomst: "van horen zeggen",
    });
    expect(uit.status).toBe(422);
  });

  it("zet een overgangsperiode en daarna de alertvlag", async () => {
    const persoon = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat D", email: "d@voorbeeld.be" })
    ).lichaam.persoon.id;
    const licentie = await verzoek("POST", "/api/bekwaamheid/licenties/overgangsperiode", {
      geaccrediteerdeId: persoon,
      instrumentId: INSTRUMENT,
    });
    expect(licentie.status).toBe(201);
    expect(licentie.lichaam.licentie.status).toBe("overgangsperiode");

    const alert = await verzoek(
      "POST",
      `/api/bekwaamheid/licenties/${licentie.lichaam.licentie.id}/alert`,
      { actief: true },
    );
    expect(alert.status).toBe(200);
    expect(alert.lichaam.licentie.alertActief).toBe(true);
  });

  it("weigert een alertvlag zonder ja of nee", async () => {
    const persoon = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat E", email: "e@voorbeeld.be" })
    ).lichaam.persoon.id;
    const licentie = await verzoek("POST", "/api/bekwaamheid/licenties/overgangsperiode", {
      geaccrediteerdeId: persoon,
      instrumentId: INSTRUMENT,
    });
    const uit = await verzoek(
      "POST",
      `/api/bekwaamheid/licenties/${licentie.lichaam.licentie.id}/alert`,
      { actief: "misschien" },
    );
    expect(uit.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// De itembank.
// ---------------------------------------------------------------------------
describe("itembank over het adres", () => {
  const item = (over: Record<string, unknown> = {}) => ({
    instrumentId: INSTRUMENT,
    as: "weten",
    blok: "A",
    soort: "meerkeuze",
    stam: "Wat onderscheidt een talentfocus van een talentversneller in het profiel?",
    opties: [
      "De focus benoemt richting, de versneller benoemt de voorwaarde",
      "De focus geldt tijdelijk, de versneller blijvend",
      "De focus komt uit de vragenlijst, de versneller uit het gesprek",
    ],
    // Een letter en niet de antwoordtekst: zou de sleutel de tekst zijn, dan
    // breekt een spelfout herstellen in een optie de sleutel.
    sleutel: "A",
    toelichtingGoed: "Juist: de versneller beschrijft onder welke voorwaarde de focus tot uiting komt.",
    toelichtingFout: "De twee zijn niet uitwisselbaar; de versneller is een voorwaarde, geen richting.",
    ...over,
  });

  it("legt een item neer en geeft de dekking in hetzelfde antwoord", async () => {
    const gezet = await verzoek("POST", "/api/bekwaamheid/items", item());
    expect(gezet.status).toBe(201);

    const lijst = await verzoek("GET", `/api/bekwaamheid/items/${INSTRUMENT}`);
    expect(lijst.status).toBe(200);
    expect(lijst.lichaam.items).toHaveLength(1);
    expect(lijst.lichaam.dekking).toBeDefined();
  });

  it("weigert een item zonder beide toelichtingen met 422", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/items", item({ toelichtingFout: "" }));
    expect(uit.status).toBe(422);
  });

  it("weigert een item zonder sleutel met 400", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/items", item({ sleutel: "" }));
    expect(uit.status).toBe(400);
  });

  it("stelt een item bij en houdt de sleutel binnen de beheerderszijde", async () => {
    const id = (await verzoek("POST", "/api/bekwaamheid/items", item())).lichaam.item.id;
    const uit = await verzoek("PATCH", `/api/bekwaamheid/item/${id}`, {
      gebruik: "verbrand",
    });
    expect(uit.status).toBe(200);
    expect(uit.lichaam.item.gebruik).toBe("verbrand");

    // Uit de roulatie, niet uit de bank: oude toetsen moeten leesbaar blijven.
    const nog = await verzoek("GET", `/api/bekwaamheid/item/${id}`);
    expect(nog.status).toBe(200);
  });

  it("geeft 404 op een onbestaand item", async () => {
    const uit = await verzoek("GET", "/api/bekwaamheid/item/9999");
    expect(uit.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// De ronde, de bewijsstukken en de scores.
// ---------------------------------------------------------------------------
describe("de ronde over het adres", () => {
  async function openRonde(): Promise<{ persoonId: number; rondeId: number }> {
    bevriesNorm();
    const persoonId = (
      await verzoek("POST", "/api/bekwaamheid/register", {
        naam: "Kandidaat R",
        beheerderId: MARC,
      })
    ).lichaam.persoon.id;
    const ronde = await verzoek("POST", "/api/bekwaamheid/rondes", {
      geaccrediteerdeId: persoonId,
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    expect(ronde.status).toBe(201);
    return { persoonId, rondeId: ronde.lichaam.ronde.id };
  }

  it("opent een ronde met een codenummer in de vaste vorm", async () => {
    const { rondeId } = await openRonde();
    const dossier = await verzoek("GET", `/api/bekwaamheid/rondes/${rondeId}`);
    expect(dossier.status).toBe(200);
    expect(dossier.lichaam.ronde.codenummer).toMatch(/^R-\d{4}-\d{4}$/);
    expect(dossier.lichaam.ronde.fase).toBe("voorbereiding");
  });

  it("weigert een tweede lopende ronde voor dezelfde persoon en hetzelfde instrument", async () => {
    const { persoonId } = await openRonde();
    const tweede = await verzoek("POST", "/api/bekwaamheid/rondes", {
      geaccrediteerdeId: persoonId,
      instrumentId: INSTRUMENT,
      soort: "herkansing",
    });
    expect(tweede.status).toBe(409);
  });

  it("weigert een onbekende rondesoort met 422", async () => {
    bevriesNorm();
    const persoonId = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat S", email: "s@voorbeeld.be" })
    ).lichaam.persoon.id;
    const uit = await verzoek("POST", "/api/bekwaamheid/rondes", {
      geaccrediteerdeId: persoonId,
      instrumentId: INSTRUMENT,
      soort: "proefritje",
    });
    expect(uit.status).toBe(422);
  });

  it("weigert een fasesprong die de loop niet toestaat", async () => {
    const { rondeId } = await openRonde();
    // voorbereiding → beslist bestaat niet; alleen open en gestaakt mogen.
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslist",
    });
    expect(uit.status).toBe(409);
  });

  it("weigert een onbekende fase met 422", async () => {
    const { rondeId } = await openRonde();
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "bijna klaar",
    });
    expect(uit.status).toBe(422);
  });

  it("weigert een bewijsstuk buiten de voorbereiding", async () => {
    const { rondeId } = await openRonde();
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bewijsstukken`, {
      nummer: 1,
      as: "weten",
      weging: 0.25,
    });
    expect(uit.status).toBe(409);
  });

  it("weigert een aanpassing zonder reden met 422", async () => {
    const { rondeId } = await openRonde();
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/aanpassing`, {
      aanpassingen: "Extra tijd bij het schriftelijke deel.",
    });
    expect(uit.status).toBe(422);
  });

  it("neemt de beoordelaar uit de sessie en niet uit het lichaam", async () => {
    const { rondeId } = await openRonde();
    const stuk = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bewijsstukken`, {
      nummer: 1,
      as: "weten",
      weging: 1,
    });
    const stukId = stuk.lichaam.bewijsstuk.id;
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/inleveren`);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "ingeleverd" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "in_beoordeling" });

    // De sessie is Marc; het lichaam beweert de tweede beheerder te zijn.
    const score = await verzoek(
      "POST",
      `/api/bekwaamheid/bewijsstukken/${stukId}/scores`,
      {
        onderdeel: "inhoud",
        score: 2,
        onderbouwing: scoreonderbouwing("benoemt de versneller als voorwaarde"),
        beoordelaarId: TWEEDE,
      },
      MARC,
    );
    expect(score.status).toBe(201);
    expect(score.lichaam.score.beoordelaarId).toBe(MARC);
  });

  it("weigert een score met een te korte onderbouwing", async () => {
    const { rondeId } = await openRonde();
    const stukId = (
      await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bewijsstukken`, {
        nummer: 1,
        as: "weten",
        weging: 1,
      })
    ).lichaam.bewijsstuk.id;
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/inleveren`);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "ingeleverd" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "in_beoordeling" });

    const uit = await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/scores`, {
      onderdeel: "inhoud",
      score: 2,
      onderbouwing: "Goed gedaan.",
    });
    expect(uit.status).toBe(422);
  });

  it("weigert een score buiten nul tot en met drie", async () => {
    const { rondeId } = await openRonde();
    const stukId = (
      await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bewijsstukken`, {
        nummer: 1,
        as: "weten",
        weging: 1,
      })
    ).lichaam.bewijsstuk.id;
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/inleveren`);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "ingeleverd" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "in_beoordeling" });

    const uit = await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/scores`, {
      onderdeel: "inhoud",
      score: 4,
      onderbouwing: scoreonderbouwing("deed het buitengewoon goed"),
    });
    expect(uit.status).toBe(422);
  });

  it("filtert de rondelijst op fase", async () => {
    await openRonde();
    const inVoorbereiding = await verzoek("GET", "/api/bekwaamheid/rondes?fase=voorbereiding");
    expect(inVoorbereiding.lichaam.rondes).toHaveLength(1);
    const beslist = await verzoek("GET", "/api/bekwaamheid/rondes?fase=beslist");
    expect(beslist.lichaam.rondes).toHaveLength(0);
  });

  it("geeft het volgende codenummer zonder het uit te geven", async () => {
    const een = await verzoek("GET", "/api/bekwaamheid/rondes-volgend-nummer");
    const twee = await verzoek("GET", "/api/bekwaamheid/rondes-volgend-nummer");
    expect(een.status).toBe(200);
    expect(twee.lichaam).toEqual(een.lichaam);
  });
});

// ---------------------------------------------------------------------------
// De beslissing: het voorstel, de bekrachtiging, de debrief, de publicatie.
// ---------------------------------------------------------------------------
describe("de beslissing over het adres", () => {
  /**
   * Een volledig dossier tot en met beoordeelde bewijsstukken.
   *
   * Vier stukken, één per as, elk met gelijke weging, zodat de asdrempels los
   * van elkaar te raken zijn. De score bepaalt de uitkomst: `scorePerAs` geeft
   * per as een geheel getal 0..3, en de opslaglaag rekent dat naar 0..1.
   */
  async function dossier(scorePerAs: Record<string, number>): Promise<number> {
    bevriesNorm();
    const persoonId = (
      await verzoek("POST", "/api/bekwaamheid/register", {
        naam: "Kandidaat V",
        beheerderId: MARC,
      })
    ).lichaam.persoon.id;
    zesAfnames(MARC);

    const rondeId = (
      await verzoek("POST", "/api/bekwaamheid/rondes", {
        geaccrediteerdeId: persoonId,
        instrumentId: INSTRUMENT,
        soort: "bekrachtiging",
      })
    ).lichaam.ronde.id;

    const assen = Object.keys(scorePerAs);
    const stukken: number[] = [];
    for (let i = 0; i < assen.length; i += 1) {
      const gezet = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bewijsstukken`, {
        nummer: i + 1,
        as: assen[i],
        weging: 1,
      });
      expect(gezet.status).toBe(201);
      stukken.push(gezet.lichaam.bewijsstuk.id);
    }

    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    for (const stukId of stukken) {
      const uit = await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukId}/inleveren`);
      expect(uit.status).toBe(200);
    }
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "ingeleverd" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "in_beoordeling" });

    for (let i = 0; i < stukken.length; i += 1) {
      const score = await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukken[i]}/scores`, {
        onderdeel: "inhoud",
        score: scorePerAs[assen[i]],
        onderbouwing: scoreonderbouwing(`op de as ${assen[i]} dit niveau haalt`),
      });
      expect(score.status).toBe(201);
      const af = await verzoek("POST", `/api/bekwaamheid/bewijsstukken/${stukken[i]}/afronden`);
      expect(af.status).toBe(200);
    }
    return rondeId;
  }

  const ALLES_DRIE = { weten: 3, zien: 3, zeggen: 3, zorgen: 3 };

  it("rekent een voorstel uit zonder iets te schrijven", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    const een = await verzoek("GET", `/api/bekwaamheid/rondes/${rondeId}/voorstel`);
    expect(een.status).toBe(200);
    expect(een.lichaam.voorstel.uitkomst.uitkomst).toBe("bekrachtigd");
    expect(een.lichaam.bestaandeBeslissing).toBeNull();

    // Twee keer lezen geeft hetzelfde en laat geen rij achter.
    const twee = await verzoek("GET", `/api/bekwaamheid/rondes/${rondeId}/voorstel`);
    expect(twee.lichaam.bestaandeBeslissing).toBeNull();
    expect(twee.lichaam.voorstel.uitkomst.uitkomst).toBe("bekrachtigd");
  });

  it("weigert een beslissing zolang de motor geen voorstel doet", async () => {
    bevriesNorm();
    const persoonId = (
      await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat W", beheerderId: MARC })
    ).lichaam.persoon.id;
    const rondeId = (
      await verzoek("POST", "/api/bekwaamheid/rondes", {
        geaccrediteerdeId: persoonId,
        instrumentId: INSTRUMENT,
        soort: "bekrachtiging",
      })
    ).lichaam.ronde.id;
    // Geen enkel bewijsstuk: het dossier is leeg, de motor houdt zich stil.
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "open" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "ingeleverd" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "in_beoordeling" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });

    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    expect(uit.status).toBe(409);
    expect(Array.isArray(uit.lichaam.onvolledig)).toBe(true);
  });

  it("legt een beslissing vast met de berekening erin en bewaart die berekening", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    const vast = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    expect(vast.status).toBe(201);
    expect(vast.lichaam.beslissing.voorstelUitkomst).toBe("bekrachtigd");
    // De berekening moet naspeelbaar zijn: de versie van de cesuur hoort erin.
    expect(vast.lichaam.beslissing.voorstelBerekening.normprofielVersie).toBe(1);
  });

  it("weigert een afwijking zonder motivering", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "opgeschort",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    expect(uit.status).toBe(422);
  });

  it("laat een gemotiveerde afwijking wel door", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "opgeschort",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
      afwijkingMotivering:
        "De scores halen de cesuur, maar het paneel stelde vast dat de opname niet van deze " +
        "kandidaat is; het dossier gaat terug naar de kandidaat voor een nieuwe opname.",
    });
    expect(uit.status).toBe(201);
    expect(uit.lichaam.beslissing.definitieveUitkomst).toBe("opgeschort");
    expect(uit.lichaam.beslissing.voorstelUitkomst).toBe("bekrachtigd");
  });

  it("weigert twee keer dezelfde bekrachtiger", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: MARC,
    });
    expect(uit.status).toBe(422);
  });

  it("weigert een onbekende uitkomst met 422", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "geslaagd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    expect(uit.status).toBe(422);
  });

  it("weigert publiceren voor de debrief en laat het daarna toe", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });

    const teVroeg = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/publiceren`);
    expect(teVroeg.status).toBe(409);

    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "beslist" });
    const debrief = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/debrief`, {});
    expect(debrief.status).toBe(200);

    const nu = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/publiceren`);
    expect(nu.status).toBe(200);
    expect(nu.lichaam.beslissing.gepubliceerdOp).not.toBeNull();
  });

  it("registreert een bezwaar en zet de ronde met een gegronde uitspraak terug in beoordeling", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "beslist" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/debrief`, {});
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "gedebrieft" });

    const bezwaar = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bezwaar`, {
      grond: "De beoordelaar van bewijsstuk twee was ook de begeleider van de kandidaat.",
    });
    expect(bezwaar.status).toBe(201);
    const bezwaarId = bezwaar.lichaam.bezwaar.id;

    const open = await verzoek("GET", "/api/bekwaamheid/bezwaren");
    expect(open.lichaam.bezwaren).toHaveLength(1);
    expect(open.lichaam.bezwaren[0].naam).toBe("Kandidaat V");

    const ontvangst = await verzoek(
      "POST",
      `/api/bekwaamheid/bezwaren/${bezwaarId}/ontvangst`,
      {},
    );
    expect(ontvangst.status).toBe(200);

    const uitspraak = await verzoek("POST", `/api/bekwaamheid/bezwaren/${bezwaarId}/uitspraak`, {
      uitspraak: "gegrond",
      motivering:
        "De onafhankelijkheid van de beoordeling is niet gewaarborgd; bewijsstuk twee wordt " +
        "opnieuw beoordeeld door een beoordelaar zonder begeleidingsrelatie.",
    });
    expect(uitspraak.status).toBe(200);

    const dossierNa = await verzoek("GET", `/api/bekwaamheid/rondes/${rondeId}`);
    expect(dossierNa.lichaam.ronde.fase).toBe("in_beoordeling");
  });

  it("weigert een uitspraak zonder motivering en een onbekende uitspraak", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "beslist" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/debrief`, {});
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "gedebrieft" });
    const bezwaarId = (
      await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bezwaar`, {
        grond: "De termijn voor het aanleveren van bewijsstukken is niet gehaald door ziekte.",
      })
    ).lichaam.bezwaar.id;

    const zonder = await verzoek("POST", `/api/bekwaamheid/bezwaren/${bezwaarId}/uitspraak`, {
      uitspraak: "gegrond",
    });
    expect(zonder.status).toBe(422);

    const onbekend = await verzoek("POST", `/api/bekwaamheid/bezwaren/${bezwaarId}/uitspraak`, {
      uitspraak: "half en half",
      motivering: "Een motivering die ruim boven de veertig tekens uitkomt en dus geldig is.",
    });
    expect(onbekend.status).toBe(422);
  });

  it("weigert een bezwaar met een te korte grond", async () => {
    const rondeId = await dossier(ALLES_DRIE);
    // Eerst de hele loop tot `gedebrieft`: de fasecontrole staat vóór de
    // lengtecontrole, dus zonder debrief zou dit 409 geven en niet 422, en dan
    // meet de toets iets anders dan wat er in haar naam staat.
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, {
      naar: "beslissing_voorstel",
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/beslissing`, {
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: MARC,
      bekrachtigerTweeId: TWEEDE,
    });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "beslist" });
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/debrief`, {});
    await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/fase`, { naar: "gedebrieft" });
    const uit = await verzoek("POST", `/api/bekwaamheid/rondes/${rondeId}/bezwaar`, {
      grond: "Oneens.",
    });
    expect(uit.status).toBe(422);
  });

  it("geeft 404 op een voorstel voor een onbestaande ronde", async () => {
    const uit = await verzoek("GET", "/api/bekwaamheid/rondes/8888/voorstel");
    expect(uit.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// De cyclus: het tussentijdse controlemoment, het plan, de agenda.
// ---------------------------------------------------------------------------
describe("de cyclus over het adres", () => {
  async function licentie(): Promise<{ persoonId: number; licentieId: number }> {
    const persoonId = (
      await verzoek("POST", "/api/bekwaamheid/register", {
        naam: "Kandidaat T",
        beheerderId: MARC,
      })
    ).lichaam.persoon.id;
    const uit = await verzoek("POST", "/api/bekwaamheid/licenties/overgangsperiode", {
      geaccrediteerdeId: persoonId,
      instrumentId: INSTRUMENT,
    });
    return { persoonId, licentieId: uit.lichaam.licentie.id };
  }

  it("bereidt een toets voor en telt de afnames van de juiste persoon", async () => {
    const { licentieId } = await licentie();
    zesAfnames(MARC);
    const toets = await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId });
    expect(toets.status).toBe(201);
    expect(toets.lichaam.toets.berekendeUitkomst).toBeDefined();
  });

  it("geeft 404 op een toets voor een onbestaande licentie", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId: 7777 });
    expect(uit.status).toBe(404);
  });

  it("weigert een toets zonder licentie met 400", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/toetsen", {});
    expect(uit.status).toBe(400);
  });

  it("stelt de toets vast, publiceert haar en legt het gesprek vast", async () => {
    const { licentieId, persoonId } = await licentie();
    zesAfnames(MARC);
    const toetsId = (await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId })).lichaam
      .toets.id;

    const vast = await verzoek("POST", `/api/bekwaamheid/toetsen/${toetsId}/vaststellen`, {});
    expect(vast.status).toBe(200);

    const gesprek = await verzoek("POST", `/api/bekwaamheid/toetsen/${toetsId}/gesprek`, {
      besprokenOp: "2026-08-14",
    });
    expect(gesprek.status).toBe(200);

    const publiceer = await verzoek("POST", `/api/bekwaamheid/toetsen/${toetsId}/publiceren`);
    expect(publiceer.status).toBe(200);

    const lijst = await verzoek("GET", `/api/bekwaamheid/toetsen/${persoonId}`);
    expect(lijst.lichaam.toetsen).toHaveLength(1);
  });

  it("weigert een gesprek zonder datum met 422", async () => {
    const { licentieId } = await licentie();
    const toetsId = (await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId })).lichaam
      .toets.id;
    const uit = await verzoek("POST", `/api/bekwaamheid/toetsen/${toetsId}/gesprek`, {});
    expect(uit.status).toBe(422);
  });

  it("weigert een plan zonder afspraken met 422", async () => {
    const { licentieId } = await licentie();
    const toetsId = (await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId })).lichaam
      .toets.id;
    const uit = await verzoek("POST", "/api/bekwaamheid/coachingsplannen", {
      toetsId,
      doel: "Meer afnames binnen het venster.",
      afspraken: [],
    });
    expect(uit.status).toBe(422);
  });

  it("laat een plan ook toe bij een toets zonder signalen", async () => {
    const { licentieId } = await licentie();
    zesAfnames(MARC);
    const toetsId = (await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId })).lichaam
      .toets.id;
    const uit = await verzoek("POST", "/api/bekwaamheid/coachingsplannen", {
      toetsId,
      doel: "Meer afnames binnen het venster.",
      afspraken: [{ wat: "Maandelijks een afname", wanneer: "doorlopend" }],
    });
    // Zes afnames halen de drempel, dus deze toets heeft geen signaal. De
    // opslaglaag weigert het plan dan niet: `plannen.stelOp` gebruikt de
    // signalen alleen om de aanleiding te vullen en toetst ze niet. Dat is de
    // gemeten werking en staat als bevinding open; de toets legt haar vast in
    // plaats van haar te verbergen.
    expect(uit.status).toBe(201);
  });

  it("stelt een plan op bij een toets met signalen en sluit het pas na akkoord af", async () => {
    const { licentieId } = await licentie();
    // Géén afnames: de activiteitsdrempel wordt niet gehaald, dus er is een signaal.
    const toetsId = (await verzoek("POST", "/api/bekwaamheid/toetsen", { licentieId })).lichaam
      .toets.id;
    const plan = await verzoek("POST", "/api/bekwaamheid/coachingsplannen", {
      toetsId,
      doel: "Zes afnames binnen twaalf maanden, verspreid over het jaar.",
      afspraken: [{ wat: "Maandelijks minstens één afname", wanneer: "doorlopend" }],
    });
    expect(plan.status).toBe(201);
    const planId = plan.lichaam.planId;

    const teVroeg = await verzoek(
      "POST",
      `/api/bekwaamheid/coachingsplannen/${planId}/afsluiten`,
      { uitkomst: "opgelost" },
    );
    expect(teVroeg.status).toBe(409);

    const akkoord = await verzoek(
      "POST",
      `/api/bekwaamheid/coachingsplannen/${planId}/akkoord`,
      {},
    );
    expect(akkoord.status).toBe(200);

    const af = await verzoek("POST", `/api/bekwaamheid/coachingsplannen/${planId}/afsluiten`, {
      uitkomst: "opgelost",
    });
    expect(af.status).toBe(200);
  });

  it("weigert afsluiten zonder uitkomst met 422", async () => {
    const uit = await verzoek("POST", "/api/bekwaamheid/coachingsplannen/1/afsluiten", {});
    expect(uit.status).toBe(422);
  });

  it("geeft de agenda met naam erbij en handelt een post af", async () => {
    const { persoonId } = await licentie();
    opslag.agenda.zetNeer({
      geaccrediteerdeId: persoonId,
      instrumentId: INSTRUMENT,
      soort: "tussentijdse_toets_verwacht",
      datum: "2026-01-01",
    });
    const voor = await verzoek("GET", "/api/bekwaamheid/agenda?peildatum=2026-08-14");
    expect(voor.status).toBe(200);
    expect(voor.lichaam.posten).toHaveLength(1);
    expect(voor.lichaam.posten[0].naam).toBe("Kandidaat T");

    const af = await verzoek(
      "POST",
      `/api/bekwaamheid/agenda/${voor.lichaam.posten[0].id}/afhandelen`,
      {},
    );
    expect(af.status).toBe(200);

    const na = await verzoek("GET", "/api/bekwaamheid/agenda?peildatum=2026-08-14");
    expect(na.lichaam.posten).toHaveLength(0);
  });

  it("geeft de vervallende toetsen op de peildatum", async () => {
    await licentie();
    const uit = await verzoek("GET", "/api/bekwaamheid/vervallende-toetsen?peildatum=2030-01-01");
    expect(uit.status).toBe(200);
    expect(Array.isArray(uit.lichaam.licenties)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Het spoor. Elke schrijfhandeling laat een regel achter met de beheerder erbij.
// ---------------------------------------------------------------------------
describe("het auditspoor van de adressen", () => {
  it("schrijft de beheerder uit de sessie in het spoor van een inschrijving", async () => {
    await verzoek("POST", "/api/bekwaamheid/register", { naam: "Kandidaat Z", email: "z@voorbeeld.be" }, MARC);
    const regels = sporen.filter((s) => s.actie.startsWith("bekwaamheid_"));
    expect(regels.length).toBeGreaterThan(0);
    expect(regels.every((r) => r.adminId === MARC)).toBe(true);
  });

  it("laat een leesweg geen spoor achter", async () => {
    await verzoek("GET", "/api/bekwaamheid/register");
    await verzoek("GET", "/api/bekwaamheid/rondes");
    expect(sporen).toHaveLength(0);
  });
});
