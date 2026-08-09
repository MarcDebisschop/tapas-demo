/**
 * Het vastleggen van een gebeurtenis op een lijn.
 *
 * Dit bestand meet uitsluitend het schrijfadres. Wie een gebeurtenis mag lezen
 * staat in tests/traject-rechten.test.ts en tests/traject-routes.test.ts; wat
 * hier gemeten wordt is wie er een mag bijschrijven, en wat er gebeurt met de
 * twee tekstvelden.
 *
 * De zichtbaarheid van de indruk wordt hier bewust NIET met een eigen
 * berekening nagegaan. De test schrijft een gebeurtenis weg langs het echte
 * webadres en leest ze daarna terug langs het echte leesadres, met de aanmelding
 * van iemand anders. Zo loopt de vraag door dezelfde rechtenmodule als in
 * bedrijf, en kan een tweede, afwijkende versie van dezelfde regel niet
 * ongemerkt ontstaan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { maakTrajectOpslag } from "../server/traject/storage";

const beheerdersVoorScope = vi.hoisted(() => new Map<number, any>());

vi.mock("../server/storage", () => ({
  storage: {
    getBeheerder: async (id: number) => beheerdersVoorScope.get(id),
  },
}));

const { registerTrajectRoutes } = await import("../server/traject/routes");

const migratie = [
  "migrations/0002_clammy_talisman.sql",
  "migrations/0003_smiling_shape.sql",
  "migrations/0004_supreme_freak.sql",
  "migrations/0005_soorten_gebeurtenis.sql",
]
  .map((pad) => readFileSync(pad, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

const NU = Date.parse("2026-08-08T10:00:00.000Z");
const DAG = 24 * 60 * 60 * 1000;

/**
 * Elke persoon van het traject krijgt een eigen beheerdersnummer, zodat een
 * verzoek werkelijk als die persoon binnenkomt en de oproeper op de gewone weg
 * ontstaat.
 */
const BEHEERDERS = {
  facilitator: 12,
  investeerder: 13,
  onderneming: 14,
  tweedeInvesteerder: 15,
  werkstroomleider: 16,
  buitenstaander: 17,
  inactieveMens: 18,
  betrokkene: 19,
} as const;

let databank: Database.Database;
let opslag: ReturnType<typeof maakTrajectOpslag>;

function maakProefdatabank(): Database.Database {
  const proefdatabank = new Database(":memory:");
  proefdatabank.pragma("foreign_keys = ON");
  proefdatabank.exec(`
    CREATE TABLE organisaties (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
    );
    CREATE TABLE beheerders (
      id INTEGER PRIMARY KEY,
      organisatie_id INTEGER,
      is_prior INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE deelnemers (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
    );
  `);
  proefdatabank.exec(migratie);
  proefdatabank
    .prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)")
    .run(1, "Organisatie A");
  const zetBeheerder = proefdatabank.prepare(
    "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
  );
  zetBeheerder.run(10, 1, 0);
  for (const beheerderId of Object.values(BEHEERDERS)) {
    zetBeheerder.run(beheerderId, 1, 0);
  }
  return proefdatabank;
}

function zetBeheerdersVoorScope(): void {
  beheerdersVoorScope.clear();
  const alle = [10, ...Object.values(BEHEERDERS)];
  for (const id of alle) {
    beheerdersVoorScope.set(id, {
      id,
      actief: true,
      isPrior: false,
      organisatie: "Organisatie A",
      organisatieId: 1,
    });
  }
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
  beheerderId: number,
  methode: "GET" | "POST",
  pad: string,
  lichaam?: unknown,
): Promise<{ status: number; lichaam: any }> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { adminId: beheerderId };
    next();
  });
  registerTrajectRoutes(app, opslag);
  return metServer(app, async (basis) => {
    const heeftLichaam = lichaam !== undefined && methode !== "GET";
    const antwoord = await fetch(`${basis}${pad}`, {
      method: methode,
      headers: heeftLichaam
        ? { "Content-Type": "application/json" }
        : undefined,
      body: heeftLichaam ? JSON.stringify(lichaam) : undefined,
    });
    return {
      status: antwoord.status,
      lichaam: await antwoord.json().catch(() => null),
    };
  });
}

/**
 * Een traject met twee partijen, een lijn ertussen, en de mensen die in de
 * tests voorkomen. Daarnaast een tweede traject met een eigen lijn, om te meten
 * dat een lijn van elders geweigerd wordt.
 */
function maakDossier() {
  const traject = opslag.maakTraject({
    naam: "Overname Asterra",
    beheerderId: 10,
    organisatieId: 1,
    aangemaaktOp: NU - 42 * DAG,
  });
  const partijInvest = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "investeerder",
    naam: "Noordzee Invest",
    ankerpunt: "Sofie Van Loon",
    kring: 0,
    rol: "ankerpunt_investeerder",
  });
  const partijOnderneming = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "onderneming",
    naam: "Asterra",
    ankerpunt: "Tom Aerts",
    kring: 0,
    rol: "ankerpunt_onderneming",
  });
  const partijDerde = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "adviseur",
    naam: "Helder Advies",
    ankerpunt: "Lina Mertens",
    kring: 1,
    rol: "adviseur",
  });
  const lijn = opslag.voegLijnToe({
    trajectId: traject.id,
    beheerderId: 10,
    partijEenId: partijInvest.id,
    partijTweeId: partijOnderneming.id,
    stiltedrempelDagen: 7,
    aangemaaktOp: NU - 42 * DAG,
  });

  const voegPersoon = (
    naam: string,
    email: string,
    partijId: number | null,
    persoonBeheerderId: number,
  ) =>
    opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam,
      email,
      partijId,
      persoonBeheerderId,
      aangemaaktOp: NU - 30 * DAG,
    });

  const facilitator = voegPersoon(
    "Ruth Vandewalle",
    "ruth@buitenstaander.be",
    null,
    BEHEERDERS.facilitator,
  );
  const investeerder = voegPersoon(
    "Sofie Van Loon",
    "sofie@noordzee.be",
    partijInvest.id,
    BEHEERDERS.investeerder,
  );
  const onderneming = voegPersoon(
    "Tom Aerts",
    "tom@asterra.be",
    partijOnderneming.id,
    BEHEERDERS.onderneming,
  );
  // Een tweede mens aan dezelfde partij als de auteur. Die moet de indruk zien.
  const tweedeInvesteerder = voegPersoon(
    "Jonas Van Loon",
    "jonas@noordzee.be",
    partijInvest.id,
    BEHEERDERS.tweedeInvesteerder,
  );
  // Hoort bij de derde partij, dus niet bij een van beide zijden van de lijn.
  const buitenstaander = voegPersoon(
    "Lina Mertens",
    "lina@helder.be",
    partijDerde.id,
    BEHEERDERS.buitenstaander,
  );
  const inactieveMens = voegPersoon(
    "Wim Claes",
    "wim@asterra.be",
    partijOnderneming.id,
    BEHEERDERS.inactieveMens,
  );
  const betrokkene = voegPersoon(
    "Jens Peeters",
    "jens@asterra.be",
    partijOnderneming.id,
    BEHEERDERS.betrokkene,
  );

  const kenToe = (persoonId: number, rol: string) =>
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId,
      rol: rol as any,
      werkstroomId: null,
      toegekendOp: NU - 29 * DAG,
    });
  kenToe(facilitator.id, "facilitator");
  kenToe(investeerder.id, "ankerpunt_investeerder");
  kenToe(onderneming.id, "ankerpunt_onderneming");
  // Niet nog een ankerpunt: de databank laat er per traject maar een toe. De
  // rol doet er voor deze tests ook niet toe, want zowel het leesrecht op een
  // lijn als het zicht op een indruk hangt aan de partij en niet aan de rol.
  kenToe(tweedeInvesteerder.id, "overlegorgaan");
  kenToe(buitenstaander.id, "adviseur");
  kenToe(inactieveMens.id, "overlegorgaan");
  kenToe(betrokkene.id, "betrokkene");

  opslag.zetPersoonInactief({
    persoonId: inactieveMens.id,
    beheerderId: 10,
    organisatieScope: 1,
  });

  // Een tweede dossier, met een lijn die nergens in het eerste voorkomt.
  const anderTraject = opslag.maakTraject({
    naam: "Ander dossier",
    beheerderId: 10,
    organisatieId: 1,
    aangemaaktOp: NU - 42 * DAG,
  });
  const andereEen = opslag.voegPartijToe({
    trajectId: anderTraject.id,
    beheerderId: 10,
    soort: "investeerder",
    naam: "Elders Invest",
    ankerpunt: "Iemand",
    kring: 0,
    rol: "ankerpunt_investeerder",
  });
  const andereTwee = opslag.voegPartijToe({
    trajectId: anderTraject.id,
    beheerderId: 10,
    soort: "onderneming",
    naam: "Elders NV",
    ankerpunt: "Iemand anders",
    kring: 0,
    rol: "ankerpunt_onderneming",
  });
  const andereLijn = opslag.voegLijnToe({
    trajectId: anderTraject.id,
    beheerderId: 10,
    partijEenId: andereEen.id,
    partijTweeId: andereTwee.id,
    stiltedrempelDagen: 7,
    aangemaaktOp: NU - 42 * DAG,
  });
  const anderePersoon = opslag.voegPersoonToe({
    trajectId: anderTraject.id,
    beheerderId: 10,
    naam: "Els Elders",
    email: "els@elders.be",
    partijId: andereEen.id,
    persoonBeheerderId: null,
    aangemaaktOp: NU - 30 * DAG,
  });

  return {
    traject,
    lijn,
    partijInvest,
    partijOnderneming,
    facilitator,
    investeerder,
    onderneming,
    tweedeInvesteerder,
    buitenstaander,
    inactieveMens,
    betrokkene,
    andereLijn,
    anderePersoon,
  };
}

function adres(trajectId: number): string {
  return `/api/traject/trajecten/${trajectId}/gebeurtenissen`;
}

/** Een geldig verzoek, waar elke test iets aan verandert. */
function geldig(dossier: ReturnType<typeof maakDossier>) {
  return {
    lijnId: dossier.lijn.id,
    soort: "gesprek",
    vaststelling: "De documentlijst is samen doorgenomen.",
    vastgelegdDoorPersoonId: dossier.investeerder.id,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NU);
  zetBeheerdersVoorScope();
  databank = maakProefdatabank();
  opslag = maakTrajectOpslag(databank, () => {});
});

afterEach(() => {
  vi.useRealTimers();
  databank.close();
});

describe("het vastleggen van een gebeurtenis: de auteur", () => {
  it("weigert een gebeurtenis zonder auteur", async () => {
    const dossier = maakDossier();
    const zonderAuteur: Record<string, unknown> = { ...geldig(dossier) };
    delete zonderAuteur.vastgelegdDoorPersoonId;

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      zonderAuteur,
    );

    expect(antwoord.status).toBe(400);
    expect(antwoord.lichaam.error).toContain("wie");
  });

  it("weigert een auteur die niet aan dit traject hangt", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vastgelegdDoorPersoonId: dossier.anderePersoon.id,
      },
    );

    // Dezelfde stijl als de rest van dit bestand: wat niet bij dit dossier
    // hoort, bestaat hier niet.
    expect(antwoord.status).toBe(404);
    expect(antwoord.lichaam.error).toBeTruthy();
    // Geen databanktaal op het scherm.
    expect(antwoord.lichaam.error).not.toMatch(/SQLITE|constraint|FOREIGN/i);
  });

  it("weigert een auteur die op inactief staat", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.onderneming,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vastgelegdDoorPersoonId: dossier.inactieveMens.id,
      },
    );

    expect(antwoord.status).toBe(400);
    expect(antwoord.lichaam.error).toContain("actief");
  });
});

describe("het vastleggen van een gebeurtenis: de lijn", () => {
  it("weigert een lijn die bij een ander traject hoort", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      { ...geldig(dossier), lijnId: dossier.andereLijn.id },
    );

    expect(antwoord.status).toBe(404);
    expect(antwoord.lichaam.error).not.toMatch(/SQLITE|constraint|FOREIGN/i);
  });

  it("weigert wie de lijn niet mag zien", async () => {
    const dossier = maakDossier();

    // Lina hoort bij een derde partij en heeft geen kaart op deze lijn, dus zij
    // leest de lijn niet en mag er dus ook niet op schrijven.
    const antwoord = await verzoek(
      BEHEERDERS.buitenstaander,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vastgelegdDoorPersoonId: dossier.buitenstaander.id,
      },
    );

    expect(antwoord.status).toBe(403);
    expect(antwoord.lichaam.error).toBeTruthy();
  });

  it("laat de facilitator wel schrijven, want die leest elke lijn", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.facilitator,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vastgelegdDoorPersoonId: dossier.facilitator.id,
      },
    );

    expect(antwoord.status).toBe(201);
  });
});

describe("het vastleggen van een gebeurtenis: de twee tekstvelden", () => {
  it("weigert een lege vaststelling", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      { ...geldig(dossier), vaststelling: "" },
    );

    expect(antwoord.status).toBe(400);
  });

  it("weigert een vaststelling van enkel spaties", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      { ...geldig(dossier), vaststelling: "     " },
    );

    expect(antwoord.status).toBe(400);
  });

  it("weigert een gebeurtenis met alleen een indruk", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vaststelling: "   ",
        indruk: "Het voelde gespannen aan.",
      },
    );

    expect(antwoord.status).toBe(400);
  });

  it("aanvaardt een gebeurtenis zonder indruk", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      geldig(dossier),
    );

    expect(antwoord.status).toBe(201);
    expect(antwoord.lichaam.indruk).toBe("");
    expect(antwoord.lichaam.vastgelegdDoorPersoonId).toBe(
      dossier.investeerder.id,
    );
  });

  it("aanvaardt de vier soorten die het scherm aanbiedt", async () => {
    const dossier = maakDossier();

    for (const soort of ["gesprek", "bericht", "overleg", "vaststelling"]) {
      const antwoord = await verzoek(
        BEHEERDERS.investeerder,
        "POST",
        adres(dossier.traject.id),
        { ...geldig(dossier), soort },
      );
      expect(antwoord.status, `soort ${soort}`).toBe(201);
      expect(antwoord.lichaam.soort).toBe(soort);
    }
  });

  it("weigert een soort die niet bestaat", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      { ...geldig(dossier), soort: "verzinsel" },
    );

    expect(antwoord.status).toBe(400);
  });

  it("zet zelf het tijdstip wanneer het scherm er geen meegeeft", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      geldig(dossier),
    );

    expect(antwoord.status).toBe(201);
    expect(antwoord.lichaam.tijdstip).toBe(NU);
  });

  it("houdt de vaststelling zonder spaties aan de randen over", async () => {
    const dossier = maakDossier();

    const antwoord = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vaststelling: "  De termijn is bevestigd.  ",
        indruk: "  Het ging rustig.  ",
      },
    );

    expect(antwoord.status).toBe(201);
    expect(antwoord.lichaam.vaststelling).toBe("De termijn is bevestigd.");
    expect(antwoord.lichaam.indruk).toBe("Het ging rustig.");
  });
});

describe("de indruk van een vastgelegde gebeurtenis", () => {
  /**
   * Legt een gebeurtenis met indruk vast namens de investeerder, en geeft terug
   * wat de lijst met gebeurtenissen van de lijn toont voor een gegeven mens.
   * Het lezen loopt langs het bestaande leesadres, dus langs de bestaande
   * rechtenmodule.
   */
  async function legVastEnLeesTerug(
    dossier: ReturnType<typeof maakDossier>,
    leesAlsBeheerder: number,
  ) {
    const geschreven = await verzoek(
      BEHEERDERS.investeerder,
      "POST",
      adres(dossier.traject.id),
      {
        ...geldig(dossier),
        vaststelling: "De cijferbundel is overhandigd.",
        indruk: "Ik vond de sfeer aan tafel gespannen.",
      },
    );
    expect(geschreven.status).toBe(201);

    const gelezen = await verzoek(
      leesAlsBeheerder,
      "GET",
      `/api/traject/trajecten/${dossier.traject.id}/lijnen/${dossier.lijn.id}/gebeurtenissen`,
    );
    expect(gelezen.status).toBe(200);
    // Dit adres geeft de gebeurtenissen van de lijn als lijst terug.
    const rij = (gelezen.lichaam as any[]).find(
      (gebeurtenis: any) => gebeurtenis.id === geschreven.lichaam.id,
    );
    return rij;
  }

  it("is zichtbaar voor iemand van de eigen partij van de auteur", async () => {
    const dossier = maakDossier();

    const rij = await legVastEnLeesTerug(
      dossier,
      BEHEERDERS.tweedeInvesteerder,
    );

    expect(rij).toBeDefined();
    expect(rij).toHaveProperty("indruk");
    expect(rij.indruk).toBe("Ik vond de sfeer aan tafel gespannen.");
  });

  it("is onzichtbaar voor de andere partij van de lijn", async () => {
    const dossier = maakDossier();

    const rij = await legVastEnLeesTerug(dossier, BEHEERDERS.onderneming);

    // De vaststelling gaat wel mee naar de overkant.
    expect(rij).toBeDefined();
    expect(rij.vaststelling).toBe("De cijferbundel is overhandigd.");
    // Het veld is werkelijk weg, niet leeggemaakt.
    expect(rij).not.toHaveProperty("indruk");
  });

  it("is onzichtbaar voor de facilitator", async () => {
    const dossier = maakDossier();

    const rij = await legVastEnLeesTerug(dossier, BEHEERDERS.facilitator);

    expect(rij).toBeDefined();
    expect(rij.vaststelling).toBe("De cijferbundel is overhandigd.");
    expect(rij).not.toHaveProperty("indruk");
  });
});
