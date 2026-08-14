import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { maakBekwaamheidOpslag, naarHonderdschaal } from "../server/bekwaamheid/storage";
import {
  OEFENGEMIDDELDE_ONDERGRENS,
  TUSSENTIJDSE_DREMPEL,
} from "../server/bekwaamheid/cyclus";
import type { AuditInvoer } from "../server/audit-log";

const migratie = readFileSync("migrations/0006_bekwaamheid.sql", "utf8").replaceAll(
  "--> statement-breakpoint",
  "",
);

/**
 * De voorlopers die migratie 0006 en de opslaglaag nodig hebben. Bewust
 * minimaal: deze test moet de bekwaamheidsmodule meten en niet het hele schema.
 */
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
    7,
    "Marc Debisschop",
    "marc@tapascity.com",
  );
  return db;
}

/** Legt een voltooide afname vast op een datum. */
function afname(db: Database.Database, id: number, datum: string, instrument = "t4p-business") {
  db.prepare(
    `INSERT INTO afnames (id, aangemaakt_door_beheerder_id, instrument_id, status, completed_at)
     VALUES (?, 7, ?, 'voltooid', ?)`,
  ).run(id, instrument, `${datum}T12:00:00.000Z`);
}

/** Legt een afgeronde oefensessie vast. `score` op de schaal die meegegeven is. */
function oefensessie(
  db: Database.Database,
  id: number,
  datum: string,
  score: number,
  perLaag: Record<string, number>,
) {
  db.prepare(
    `INSERT INTO stm_sessies (id, beheerder_id, afgerond_at, score_totaal, scores_per_laag)
     VALUES (?, 7, ?, ?, ?)`,
  ).run(id, `${datum}T12:00:00.000Z`, score, JSON.stringify(perLaag));
}

describe("het register", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = maakProefdatabank();
  });

  it("neemt iemand op zonder e-mailadres, mits die via het coachregister te vinden is", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const persoon = opslag.register.zetNeer({ naam: "Erik Franck", coachRegisterId: 9 });
    expect(persoon.email).toBeNull();
    expect(persoon.coachRegisterId).toBe(9);
  });

  it("weigert iemand die met geen van de drie sleutels te identificeren is", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    expect(() => opslag.register.zetNeer({ naam: "Onbekend" })).toThrow(/identificeerbaar/);
  });

  it("voegt samen op e-mailadres en nooit op naam", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const eerste = opslag.register.zetNeer({ naam: "Kris Debisschop", email: "kris@tapascity.com" });
    const tweede = opslag.register.zetNeer({
      naam: "Kris Debisschop",
      email: "kris.debisschop@tapascity.com",
    });
    // Zelfde naam, ander adres: twee mensen, want op naam samenvoegen is gokken.
    expect(tweede.id).not.toBe(eerste.id);
    const derde = opslag.register.zetNeer({
      naam: "Kris De Bisschop",
      email: "kris@tapascity.com",
    });
    // Zelfde adres, andere spelling: één mens.
    expect(derde.id).toBe(eerste.id);
    expect(derde.naam).toBe("Kris De Bisschop");
  });

  it("laat een e-mailadres later aanvullen, maar nooit stil verdwijnen", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const zonder = opslag.register.zetNeer({ naam: "Erik Franck", coachRegisterId: 9 });
    expect(zonder.email).toBeNull();
    const met = opslag.register.zetNeer({
      naam: "Erik Franck",
      coachRegisterId: 9,
      email: "erik@voorbeeld.be",
    });
    expect(met.id).toBe(zonder.id);
    expect(met.email).toBe("erik@voorbeeld.be");
    const opnieuwZonder = opslag.register.zetNeer({ naam: "Erik Franck", coachRegisterId: 9 });
    expect(opnieuwZonder.email).toBe("erik@voorbeeld.be");
  });

  it("houdt het te behouden nummer aan wanneer dat wordt meegegeven", () => {
    // Aan de monitor-ids 1001 en verder hangen kwaliteitsnormen, overrides en
    // verstuurde alerteringen vast.
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const persoon = opslag.register.zetNeer({
      naam: "Herman Van Esbroeck",
      coachRegisterId: 3,
      id: 1002,
    });
    expect(persoon.id).toBe(1002);
  });

  it("kent geen verwijderfunctie, alleen inactief zetten", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    expect("verwijder" in opslag.register).toBe(false);
    const persoon = opslag.register.zetNeer({ naam: "Karen Thiers", coachRegisterId: 22 });
    opslag.register.zetInactief(persoon.id, 7, "Opleiding niet afgerond.");
    expect(opslag.register.lijst()).toHaveLength(0);
    // Wie inactief staat, is niet gewist: een register waaruit gewist kan worden,
    // kan achteraf niet aantonen wie er ooit in stond.
    expect(opslag.register.vindOp(persoon.id)?.actief).toBe(false);
  });
});

describe("de tellers", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = maakProefdatabank();
  });

  it("telt voltooide afnames binnen het venster en niets daarbuiten", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    afname(db, 1, "2026-08-13");
    afname(db, 2, "2027-01-01");
    afname(db, 3, "2025-08-12"); // net buiten
    afname(db, 4, "2027-08-14"); // net buiten
    db.prepare(
      `INSERT INTO afnames (id, aangemaakt_door_beheerder_id, instrument_id, status, completed_at)
       VALUES (5, 7, 't4p-business', 'uitgestuurd', '2026-09-01T12:00:00.000Z')`,
    ).run();
    expect(
      opslag.tellers.telAfnames({ beheerderId: 7, van: "2025-08-13", tot: "2027-08-13" }),
    ).toBe(2);
  });

  it("telt oefensessies niet mee als afnames", () => {
    // Dit is de fout die het dashboard maakte: wie de quiz tien keer deed en
    // nooit een vragenlijst uitstuurde, stond op norm gehaald.
    const opslag = maakBekwaamheidOpslag(db, () => {});
    for (let i = 1; i <= 10; i += 1) oefensessie(db, i, "2026-09-01", 0.9, { laag1: 0.9 });
    expect(
      opslag.tellers.telAfnames({ beheerderId: 7, van: "2026-01-01", tot: "2026-12-31" }),
    ).toBe(0);
  });

  it("scheidt de afnames per instrument wanneer daarom gevraagd wordt", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    afname(db, 1, "2026-09-01", "t4p-business");
    afname(db, 2, "2026-09-02", "t4students");
    expect(
      opslag.tellers.telAfnames({
        beheerderId: 7,
        van: "2026-01-01",
        tot: "2026-12-31",
        instrumentId: "t4p-business",
      }),
    ).toBe(1);
  });

  it("geeft de laatste voltooide afname en niet de laatste oefensessie", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    afname(db, 1, "2026-03-01");
    oefensessie(db, 1, "2026-09-01", 0.9, { laag1: 0.9 });
    expect(opslag.tellers.laatsteAfname(7)).toContain("2026-03-01");
  });

  it("geeft niets terug wanneer er geen enkele afname is", () => {
    const opslag = maakBekwaamheidOpslag(db, () => {});
    expect(opslag.tellers.laatsteAfname(7)).toBeNull();
  });
});

describe("de dubbele scoreschaal in stm_sessies", () => {
  it("rekent breuken om naar de honderdschaal en laat percentages staan", () => {
    // Feit: POST /api/stm/afronden schrijft totaalCorrect/totaalVragen (0–1),
    // seedDemoKwaliteit schrijft 62 + rnd()*36 (62–98). Beide schalen staan in
    // dezelfde kolom. Zonder omrekening zou elke echte sessie onder de
    // ondergrens van 55 vallen en zou iedereen een signaal krijgen.
    expect(naarHonderdschaal(0.9)).toBe(90);
    expect(naarHonderdschaal(1)).toBe(100);
    expect(naarHonderdschaal(85)).toBe(85);
    expect(naarHonderdschaal(0)).toBe(0);
  });

  it("leest een echte sessie op breukschaal als ruim boven de ondergrens", () => {
    const db = maakProefdatabank();
    const opslag = maakBekwaamheidOpslag(db, () => {});
    oefensessie(db, 1, "2026-09-01", 0.8, { laag1: 0.8, laag2: 0.8 });
    const aggregaat = opslag.tellers.leesOefenaggregaat({
      beheerderId: 7,
      van: "2026-01-01",
      tot: "2026-12-31",
    });
    expect(aggregaat.sessies).toBe(1);
    expect(aggregaat.gemiddelde).toBe(80);
    expect(aggregaat.gemiddelde!).toBeGreaterThan(OEFENGEMIDDELDE_ONDERGRENS);
  });

  it("normaliseert de laagsleutels van de demo-seed naar dezelfde vorm", () => {
    const db = maakProefdatabank();
    const opslag = maakBekwaamheidOpslag(db, () => {});
    oefensessie(db, 1, "2026-09-01", 0.8, { laag1: 0.8 });
    oefensessie(db, 2, "2026-09-02", 90, { "1": 90 });
    const aggregaat = opslag.tellers.leesOefenaggregaat({
      beheerderId: 7,
      van: "2026-01-01",
      tot: "2026-12-31",
    });
    // Twee sleutelvormen voor dezelfde laag zouden anders twee lagen lijken.
    expect(Object.keys(aggregaat.perLaag ?? {})).toEqual(["laag1"]);
    expect(aggregaat.perLaag!.laag1).toBe(85);
  });

  it("houdt het gemiddelde leeg bij nul sessies en maakt er geen nul van", () => {
    const db = maakProefdatabank();
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const aggregaat = opslag.tellers.leesOefenaggregaat({
      beheerderId: 7,
      van: "2026-01-01",
      tot: "2026-12-31",
    });
    expect(aggregaat.sessies).toBe(0);
    expect(aggregaat.gemiddelde).toBeNull();
  });
});

describe("een alert sluit de poort niet", () => {
  let db: Database.Database;
  let opslag: ReturnType<typeof maakBekwaamheidOpslag>;
  let acties: AuditInvoer[];

  beforeEach(() => {
    db = maakProefdatabank();
    acties = [];
    opslag = maakBekwaamheidOpslag(db, (invoer) => {
      acties.push(invoer);
    });
  });

  /** Iemand met een licentie, zonder enige afname en zonder enige oefensessie. */
  function persoonMetAlert() {
    const persoon = opslag.register.zetNeer({
      naam: "Marc Debisschop",
      email: "marc@tapascity.com",
      beheerderId: 7,
    });
    const licentie = opslag.licenties.zetOvergangsperiode({
      geaccrediteerdeId: persoon.id,
      instrumentId: "t4p-business",
      geldigVan: "2026-08-13",
    });
    const toets = opslag.toetsen.bereidVoor({
      licentieId: licentie.id,
      peildatum: "2027-08-13",
    });
    return { persoon, licentie, toets };
  }

  it("berekent een alert bij nul afnames en nul oefensessies", () => {
    const { toets } = persoonMetAlert();
    expect(toets.afnamesAantal).toBe(0);
    expect(toets.afnamesDrempel).toBe(TUSSENTIJDSE_DREMPEL);
    expect(toets.berekendeUitkomst).toBe("alert");
  });

  it("laat de licentiestatus onaangeroerd wanneer het alert wordt gezet", () => {
    const { licentie } = persoonMetAlert();
    const voor = opslag.licenties.vindOp(licentie.id)!;
    const na = opslag.licenties.zetAlert(licentie.id, true);
    expect(na.alertActief).toBe(true);
    expect(na.status).toBe(voor.status);
    expect(na.status).toBe("overgangsperiode");
    expect(na.geldigTot).toBe(voor.geldigTot);
  });

  it("weigert een alert vast te stellen zonder coachingsplan", () => {
    const { toets } = persoonMetAlert();
    expect(() =>
      opslag.toetsen.stelVast({ toetsId: toets.id, doorBeheerderId: 7 }),
    ).toThrow(/coachingsplan/);
  });

  it("houdt het afnamerecht overeind terwijl er een alert openstaat", () => {
    const { licentie, toets } = persoonMetAlert();
    opslag.plannen.stelOp({
      toetsId: toets.id,
      doel: "Drie afnames begeleiden in het komende halfjaar.",
      afspraken: [{ wat: "intervisie", wanneer: "2027-10-01" }],
      opgesteldDoor: 7,
    });
    opslag.toetsen.stelVast({ toetsId: toets.id, doorBeheerderId: 7 });
    const na = opslag.licenties.vindOp(licentie.id)!;
    expect(na.alertActief).toBe(true);
    expect(na.status).toBe("overgangsperiode");
  });

  it("vraagt een motivering van veertig tekens om van de berekening af te wijken", () => {
    const { toets } = persoonMetAlert();
    expect(() =>
      opslag.toetsen.stelVast({
        toetsId: toets.id,
        uitkomst: "geen_signaal",
        afwijkingMotivering: "te kort",
        doorBeheerderId: 7,
      }),
    ).toThrow(/veertig tekens/);
    const na = opslag.toetsen.stelVast({
      toetsId: toets.id,
      uitkomst: "geen_signaal",
      afwijkingMotivering:
        "De afnames stonden op naam van de organisatie en niet op naam van de coach; " +
        "nagekeken in de afnametabel op 13 augustus 2027.",
      doorBeheerderId: 7,
    });
    expect(na.uitkomst).toBe("geen_signaal");
    expect(na.berekendeUitkomst).toBe("alert");
  });

  it("bewaart de berekende uitkomst naast de vastgestelde", () => {
    // Anders is achteraf niet te zien dat er van de berekening is afgeweken.
    const { toets } = persoonMetAlert();
    expect(toets.berekendeUitkomst).toBe("alert");
    expect(toets.uitkomst).toBeNull();
  });

  it("publiceert niets voordat het gesprek heeft plaatsgevonden", () => {
    const { toets } = persoonMetAlert();
    opslag.plannen.stelOp({
      toetsId: toets.id,
      doel: "Drie afnames begeleiden.",
      afspraken: [],
      opgesteldDoor: 7,
    });
    opslag.toetsen.stelVast({ toetsId: toets.id, doorBeheerderId: 7 });
    expect(() => opslag.toetsen.publiceer(toets.id, 7)).toThrow();
    opslag.toetsen.legGesprekVast(toets.id, "2027-08-20");
    const gepubliceerd = opslag.toetsen.publiceer(toets.id, 7);
    expect(gepubliceerd.gepubliceerdOp).toBeTruthy();
  });

  it("schrijft elke stap naar het auditlogboek", () => {
    const { toets } = persoonMetAlert();
    opslag.plannen.stelOp({
      toetsId: toets.id,
      doel: "Drie afnames begeleiden.",
      afspraken: [],
      opgesteldDoor: 7,
    });
    opslag.toetsen.stelVast({ toetsId: toets.id, doorBeheerderId: 7 });
    opslag.toetsen.legGesprekVast(toets.id, "2027-08-20");
    opslag.toetsen.publiceer(toets.id, 7);
    const namen = acties.map((a) => a.actie);
    expect(namen).toContain("bekwaamheid_register_gewijzigd");
    expect(namen).toContain("bekwaamheid_licentie_gewijzigd");
    expect(namen).toContain("bekwaamheid_coachingsplan_opgesteld");
    expect(namen).toContain("bekwaamheid_tussentijdse_toets_vastgesteld");
    expect(namen).toContain("bekwaamheid_tussentijdse_toets_gepubliceerd");
  });
});
