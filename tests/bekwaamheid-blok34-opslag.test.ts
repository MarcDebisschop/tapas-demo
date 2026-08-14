import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import type { AuditInvoer } from "../server/audit-log";

/**
 * Alle drie de migraties, niet alleen 0006. Blok 3 en 4 raken
 * `bekwaamheid_beslissingen` en die tabel wordt in 0007 herbouwd met het
 * vocabulaire uit het draaiboek. Zou deze test alleen 0006 laden, dan zou ze
 * 'herkansing' als geldige uitkomst accepteren en zou de vijf-woordenlijst waar
 * de module op draait hier stil anders zijn dan in productie.
 */
const migraties = ["0006_bekwaamheid.sql", "0007_beslisuitkomsten.sql", "0008_itemblokken.sql"]
  .map((naam) => readFileSync(`migrations/${naam}`, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

function maakProefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE beheerders (id INTEGER PRIMARY KEY, naam TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY, aangemaakt_door_beheerder_id INTEGER, instrument_id TEXT,
      status TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE stm_sessies (
      id INTEGER PRIMARY KEY, beheerder_id INTEGER, afgerond_at TEXT,
      score_totaal REAL, scores_per_laag TEXT
    );
  `);
  db.exec(migraties);
  db.pragma("foreign_keys = ON");
  db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (?, ?, ?)").run(
    7,
    "Marc Debisschop",
    "marc@tapascity.com",
  );
  return db;
}

const INSTRUMENT = "t4p-business-kompas";

let db: Database.Database;
let sporen: AuditInvoer[];
let opslag: ReturnType<typeof maakBekwaamheidOpslag>;

/** Een geldige, bevroren cesuur. Zonder deze kan er geen ronde openen. */
function bevriesNorm(instrument = INSTRUMENT): number {
  const concept = opslag.normprofielen.zetNeer({
    instrumentId: instrument,
    weging: { weten: 0.25, zien: 0.25, zeggen: 0.25, zorgen: 0.25 },
    drempelTotaal: 0.7,
    drempelPerAs: { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 },
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    methode: "Angoff",
    paneelOmschrijving: "Drie beoordelaars, zonder namen",
    vastgesteldDoor: "De normcommissie",
    onderbouwing:
      "Deze cesuur is vastgesteld met een gemodificeerde Angoff-procedure door drie beoordelaars " +
      "die onafhankelijk van elkaar per item hebben ingeschat welk deel van de grensgroep het " +
      "item juist zou beantwoorden. De uitkomsten zijn besproken, de tweede ronde is gemiddeld, " +
      "en de totaaldrempel is daarna naar boven afgerond op een tiende. De drempel per as ligt " +
      "lager dan het totaal omdat een enkele zwakke as niet automatisch tot opschorting hoort " +
      "te leiden; twee zwakke assen wel, en dat is elders in de beslisregels geregeld.",
    doorBeheerderId: 7,
  });
  opslag.normprofielen.bevries(concept.id, 7);
  return concept.id;
}

/** Zet een persoon in het register en geeft zijn id. */
function persoon(naam = "Kandidaat A"): number {
  return opslag.register.zetNeer({
    naam,
    email: `${naam.toLowerCase().replaceAll(" ", ".")}@voorbeeld.be`,
    doorBeheerderId: 7,
  }).id;
}

beforeEach(() => {
  db = maakProefdatabank();
  sporen = [];
  opslag = maakBekwaamheidOpslag(db, (invoer) => {
    sporen.push(invoer);
  });
});

// ---------------------------------------------------------------------------

describe("accreditaties", () => {
  it("legt een behaalde accreditatie vast en laat haar terugvinden", () => {
    const id = persoon();
    const acc = opslag.accreditaties.legVast({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 2,
      behaaldOp: "2019-06-14",
      bewijsHerkomst: "historisch",
      doorBeheerderId: 7,
    });
    expect(acc.niveau).toBe(2);
    expect(acc.behaaldOp).toBe("2019-06-14");
    expect(acc.ingetrokkenOp).toBeNull();
    expect(opslag.accreditaties.vanPersoon(id)).toHaveLength(1);
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_accreditatie_vastgelegd");
  });

  it("weigert tweemaal hetzelfde niveau op hetzelfde instrument", () => {
    const id = persoon();
    const invoer = {
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 2,
      behaaldOp: "2019-06-14",
      bewijsHerkomst: "historisch" as const,
    };
    opslag.accreditaties.legVast(invoer);
    expect(() => opslag.accreditaties.legVast(invoer)).toThrow(/staat al een accreditatie/);
  });

  it("laat wel twee niveaus naast elkaar bestaan", () => {
    const id = persoon();
    opslag.accreditaties.legVast({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 1,
      behaaldOp: "2017-03-01",
      bewijsHerkomst: "historisch",
    });
    opslag.accreditaties.legVast({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 2,
      behaaldOp: "2019-06-14",
      bewijsHerkomst: "academy",
    });
    expect(opslag.accreditaties.vanPersoon(id)).toHaveLength(2);
  });

  it("bewaart een ingetrokken accreditatie in plaats van haar te verwijderen", () => {
    const id = persoon();
    const acc = opslag.accreditaties.legVast({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 2,
      behaaldOp: "2019-06-14",
      bewijsHerkomst: "handmatig",
    });
    const na = opslag.accreditaties.trekIn({
      id: acc.id,
      reden: "Bewijsstuk bleek niet echt te zijn.",
      doorBeheerderId: 7,
    });
    expect(na.ingetrokkenOp).not.toBeNull();
    expect(na.ingetrokkenReden).toBe("Bewijsstuk bleek niet echt te zijn.");
    expect(opslag.accreditaties.vanPersoon(id)).toHaveLength(1);
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_accreditatie_ingetrokken");
  });

  it("weigert intrekken zonder reden en tweemaal intrekken", () => {
    const id = persoon();
    const acc = opslag.accreditaties.legVast({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      niveau: 2,
      behaaldOp: "2019-06-14",
      bewijsHerkomst: "handmatig",
    });
    expect(() => opslag.accreditaties.trekIn({ id: acc.id, reden: "fout" })).toThrow(/tien tekens/);
    opslag.accreditaties.trekIn({ id: acc.id, reden: "Bewijsstuk bleek niet echt." });
    expect(() =>
      opslag.accreditaties.trekIn({ id: acc.id, reden: "Nogmaals ingetrokken." }),
    ).toThrow(/al ingetrokken/);
  });

  it("weigert een accreditatie voor iemand die niet in het register staat", () => {
    expect(() =>
      opslag.accreditaties.legVast({
        geaccrediteerdeId: 999,
        instrumentId: INSTRUMENT,
        niveau: 1,
        behaaldOp: "2019-06-14",
        bewijsHerkomst: "handmatig",
      }),
    ).toThrow(/bestaat niet/);
  });
});

// ---------------------------------------------------------------------------

describe("rondes", () => {
  it("opent geen ronde zonder bevroren norm", () => {
    const id = persoon();
    expect(() =>
      opslag.rondes.open({
        geaccrediteerdeId: id,
        instrumentId: INSTRUMENT,
        soort: "bekrachtiging",
      }),
    ).toThrow(/geen bevroren normprofiel/);
  });

  it("legt bij het openen de geldende normversie vast", () => {
    const normId = bevriesNorm();
    const id = persoon();
    const ronde = opslag.rondes.open({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
      geopendOp: "2026-03-02",
      doorBeheerderId: 7,
    });
    expect(ronde.normprofielId).toBe(normId);
    expect(ronde.fase).toBe("voorbereiding");
    expect(ronde.codenummer).toBe("R-2026-0001");
    expect(ronde.vensterTot).toBe("2026-06-02");
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_ronde_geopend");
  });

  it("houdt een lopende ronde vast op de oude norm wanneer er een nieuwe bevriest", () => {
    const eerste = bevriesNorm();
    const id = persoon();
    const ronde = opslag.rondes.open({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    const tweede = bevriesNorm();
    expect(tweede).not.toBe(eerste);
    expect(opslag.rondes.vindOp(ronde.id)!.normprofielId).toBe(eerste);
    expect(opslag.normprofielen.geldend(INSTRUMENT)!.id).toBe(tweede);
  });

  it("telt codenummers per jaar door en hergebruikt geen nummer", () => {
    bevriesNorm();
    const een = opslag.rondes.open({
      geaccrediteerdeId: persoon("A"),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
      geopendOp: "2026-01-05",
    });
    const twee = opslag.rondes.open({
      geaccrediteerdeId: persoon("B"),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
      geopendOp: "2026-02-05",
    });
    expect(een.codenummer).toBe("R-2026-0001");
    expect(twee.codenummer).toBe("R-2026-0002");
    opslag.rondes.verzetFase({ id: twee.id, naar: "gestaakt", reden: "Kandidaat stopt ermee." });
    const drie = opslag.rondes.open({
      geaccrediteerdeId: persoon("C"),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
      geopendOp: "2026-03-05",
    });
    expect(drie.codenummer).toBe("R-2026-0003");
  });

  it("weigert een tweede lopende ronde voor dezelfde persoon op hetzelfde instrument", () => {
    bevriesNorm();
    const id = persoon();
    opslag.rondes.open({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    expect(() =>
      opslag.rondes.open({
        geaccrediteerdeId: id,
        instrumentId: INSTRUMENT,
        soort: "herkansing",
      }),
    ).toThrow(/loopt al een ronde/);
  });

  it("laat een nieuwe ronde toe zodra de vorige gestaakt is", () => {
    bevriesNorm();
    const id = persoon();
    const eerste = opslag.rondes.open({
      geaccrediteerdeId: id,
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    opslag.rondes.verzetFase({
      id: eerste.id,
      naar: "gestaakt",
      reden: "Kandidaat is langdurig afwezig.",
    });
    expect(() =>
      opslag.rondes.open({
        geaccrediteerdeId: id,
        instrumentId: INSTRUMENT,
        soort: "herkansing",
      }),
    ).not.toThrow();
  });

  it("weigert een fase die de loop niet toestaat", () => {
    bevriesNorm();
    const ronde = opslag.rondes.open({
      geaccrediteerdeId: persoon(),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    expect(() => opslag.rondes.verzetFase({ id: ronde.id, naar: "beslist" })).toThrow(
      /kan alleen naar/,
    );
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("voorbereiding");
  });

  it("eist een reden bij staken en legt een spoor", () => {
    bevriesNorm();
    const ronde = opslag.rondes.open({
      geaccrediteerdeId: persoon(),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    expect(() => opslag.rondes.verzetFase({ id: ronde.id, naar: "gestaakt" })).toThrow(
      /tien tekens/,
    );
    opslag.rondes.verzetFase({
      id: ronde.id,
      naar: "gestaakt",
      reden: "Kandidaat trekt zich terug.",
      doorBeheerderId: 7,
    });
    const na = opslag.rondes.vindOp(ronde.id)!;
    expect(na.fase).toBe("gestaakt");
    expect(na.afgerondOp).not.toBeNull();
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_ronde_fase_verzet");
  });

  it("filtert op fase en instrument", () => {
    bevriesNorm();
    bevriesNorm("t4recruitment");
    const een = opslag.rondes.open({
      geaccrediteerdeId: persoon("A"),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    opslag.rondes.open({
      geaccrediteerdeId: persoon("B"),
      instrumentId: "t4recruitment",
      soort: "nulmeting",
    });
    opslag.rondes.verzetFase({ id: een.id, naar: "open" });
    expect(opslag.rondes.lijst({ fase: "open" })).toHaveLength(1);
    expect(opslag.rondes.lijst({ instrumentId: "t4recruitment" })).toHaveLength(1);
    expect(opslag.rondes.lijst()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

/** Opent een ronde met vier bewijsstukken, één per as, en zet haar op `open`. */
function rondeMetStukken() {
  bevriesNorm();
  const ronde = opslag.rondes.open({
    geaccrediteerdeId: persoon(),
    instrumentId: INSTRUMENT,
    soort: "bekrachtiging",
  });
  const assen = ["weten", "zien", "zeggen", "zorgen"] as const;
  const stukken = assen.map((as, i) =>
    opslag.bewijsstukken.zetNeer({ rondeId: ronde.id, nummer: i + 1, as, weging: 1 }),
  );
  return { ronde, stukken };
}

describe("bewijsstukken", () => {
  it("legt stukken neer in de voorbereiding en daarna niet meer", () => {
    const { ronde } = rondeMetStukken();
    opslag.rondes.verzetFase({ id: ronde.id, naar: "open" });
    expect(() =>
      opslag.bewijsstukken.zetNeer({ rondeId: ronde.id, nummer: 5, as: "weten", weging: 1 }),
    ).toThrow(/voorbereiding/);
  });

  it("weigert een nummer buiten 1 tot 5 en een dubbel nummer", () => {
    bevriesNorm();
    const ronde = opslag.rondes.open({
      geaccrediteerdeId: persoon(),
      instrumentId: INSTRUMENT,
      soort: "bekrachtiging",
    });
    expect(() =>
      opslag.bewijsstukken.zetNeer({ rondeId: ronde.id, nummer: 6, as: "weten", weging: 1 }),
    ).toThrow(/tussen 1 en 5/);
    opslag.bewijsstukken.zetNeer({ rondeId: ronde.id, nummer: 1, as: "weten", weging: 1 });
    expect(() =>
      opslag.bewijsstukken.zetNeer({ rondeId: ronde.id, nummer: 1, as: "zien", weging: 1 }),
    ).toThrow(/bestaat al/);
  });

  it("laat inleveren alleen op een open ronde", () => {
    const { ronde, stukken } = rondeMetStukken();
    expect(() => opslag.bewijsstukken.leverIn({ id: stukken[0].id })).toThrow(/open staat/);
    opslag.rondes.verzetFase({ id: ronde.id, naar: "open" });
    const na = opslag.bewijsstukken.leverIn({ id: stukken[0].id });
    expect(na.status).toBe("ingeleverd");
    expect(na.ingeleverdOp).not.toBeNull();
    expect(() => opslag.bewijsstukken.leverIn({ id: stukken[0].id })).toThrow(/status/);
  });

  it("vraagt een reden voor niet van toepassing en weigert het na beoordeling", () => {
    const { ronde, stukken } = rondeMetStukken();
    expect(() => opslag.bewijsstukken.markeerNvt({ id: stukken[0].id, reden: "nee" })).toThrow(
      /tien tekens/,
    );
    const na = opslag.bewijsstukken.markeerNvt({
      id: stukken[0].id,
      reden: "Deze kandidaat werkt niet met groepen; dit onderdeel is niet observeerbaar.",
      doorBeheerderId: 7,
    });
    expect(na.status).toBe("nvt");
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_bewijsstuk_nvt");
    expect(ronde.fase).toBe("voorbereiding");
  });
});

// ---------------------------------------------------------------------------

/** Brengt een ronde tot in de beoordeling, met alle vier de stukken ingeleverd. */
function rondeInBeoordeling() {
  const { ronde, stukken } = rondeMetStukken();
  opslag.rondes.verzetFase({ id: ronde.id, naar: "open" });
  for (const s of stukken) opslag.bewijsstukken.leverIn({ id: s.id });
  opslag.rondes.verzetFase({ id: ronde.id, naar: "ingeleverd" });
  opslag.rondes.verzetFase({ id: ronde.id, naar: "in_beoordeling" });
  return { ronde, stukken };
}

const ONDERBOUWING =
  "De kandidaat benoemt het onderliggende patroon en checkt het bij de coachee voordat hij " +
  "een conclusie trekt; dat is op deze rubriek het verschil tussen twee en drie.";

describe("scores", () => {
  it("voert een score in en weigert een tweede van dezelfde beoordelaar", () => {
    const { stukken } = rondeInBeoordeling();
    const score = opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 7,
      onderdeel: "waarneming",
      score: 3,
      onderbouwing: ONDERBOUWING,
    });
    expect(score.score).toBe(3);
    expect(score.isKalibratie).toBe(false);
    expect(() =>
      opslag.scores.voerIn({
        bewijsstukId: stukken[0].id,
        beoordelaarId: 7,
        onderdeel: "waarneming",
        score: 2,
        onderbouwing: ONDERBOUWING,
      }),
    ).toThrow(/al gescoord/);
  });

  it("weigert scoren buiten de beoordelingsfasen", () => {
    const { ronde, stukken } = rondeMetStukken();
    expect(() =>
      opslag.scores.voerIn({
        bewijsstukId: stukken[0].id,
        beoordelaarId: 7,
        onderdeel: "waarneming",
        score: 2,
        onderbouwing: ONDERBOUWING,
      }),
    ).toThrow(/tijdens de beoordeling/);
    expect(ronde.fase).toBe("voorbereiding");
  });

  it("weigert een score buiten 0 tot 3 en een te korte onderbouwing", () => {
    const { stukken } = rondeInBeoordeling();
    expect(() =>
      opslag.scores.voerIn({
        bewijsstukId: stukken[0].id,
        beoordelaarId: 7,
        onderdeel: "waarneming",
        score: 4,
        onderbouwing: ONDERBOUWING,
      }),
    ).toThrow(/0 tot en met 3/);
    expect(() =>
      opslag.scores.voerIn({
        bewijsstukId: stukken[0].id,
        beoordelaarId: 7,
        onderdeel: "waarneming",
        score: 2,
        onderbouwing: "goed gedaan",
      }),
    ).toThrow(/veertig tekens/);
  });

  it("laat alleen de eigen beoordelaar herzien", () => {
    const { stukken } = rondeInBeoordeling();
    const score = opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 7,
      onderdeel: "waarneming",
      score: 1,
      onderbouwing: ONDERBOUWING,
    });
    expect(() =>
      opslag.scores.herzie({
        id: score.id,
        beoordelaarId: 9,
        score: 3,
        onderbouwing: ONDERBOUWING,
      }),
    ).toThrow(/beoordelaar die haar invoerde/);
    const na = opslag.scores.herzie({
      id: score.id,
      beoordelaarId: 7,
      score: 3,
      onderbouwing: ONDERBOUWING,
    });
    expect(na.score).toBe(3);
    expect(opslag.scores.vanBewijsstuk(stukken[0].id)).toHaveLength(1);
  });

  it("middelt naar de schaal 0 tot 1 en laat kalibratiescores buiten de telling", () => {
    const { stukken } = rondeInBeoordeling();
    // Twee echte scores van 3 en 0 -> gemiddeld 1,5 -> gedeeld door 3 = 0,5.
    opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 7,
      onderdeel: "waarneming",
      score: 3,
      onderbouwing: ONDERBOUWING,
    });
    opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 9,
      onderdeel: "waarneming",
      score: 0,
      onderbouwing: ONDERBOUWING,
    });
    // Een kalibratiescore die het gemiddelde zou optrekken als ze meetelde.
    opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 11,
      onderdeel: "waarneming",
      score: 3,
      onderbouwing: ONDERBOUWING,
      isKalibratie: true,
    });
    const na = opslag.scores.rondBewijsstukAf({
      bewijsstukId: stukken[0].id,
      doorBeheerderId: 7,
    });
    expect(na.ruweScore).toBeCloseTo(0.5, 10);
    expect(na.status).toBe("beoordeeld");
    expect(na.beoordeeldOp).not.toBeNull();
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_bewijsstuk_beoordeeld");
  });

  it("rondt niets af zonder score", () => {
    const { stukken } = rondeInBeoordeling();
    expect(() => opslag.scores.rondBewijsstukAf({ bewijsstukId: stukken[0].id })).toThrow(
      /nog geen enkele score/,
    );
  });

  it("geeft alle scores van een ronde in de volgorde van de bewijsstukken", () => {
    const { ronde, stukken } = rondeInBeoordeling();
    opslag.scores.voerIn({
      bewijsstukId: stukken[2].id,
      beoordelaarId: 7,
      onderdeel: "waarneming",
      score: 2,
      onderbouwing: ONDERBOUWING,
    });
    opslag.scores.voerIn({
      bewijsstukId: stukken[0].id,
      beoordelaarId: 7,
      onderdeel: "waarneming",
      score: 1,
      onderbouwing: ONDERBOUWING,
    });
    const alle = opslag.scores.vanRonde(ronde.id);
    expect(alle).toHaveLength(2);
    expect(alle[0].bewijsstukId).toBe(stukken[0].id);
  });
});

// ---------------------------------------------------------------------------

/** Brengt een ronde tot aan het beslismoment. */
function rondeBijHetVoorstel() {
  const { ronde, stukken } = rondeInBeoordeling();
  for (const s of stukken) {
    opslag.scores.voerIn({
      bewijsstukId: s.id,
      beoordelaarId: 7,
      onderdeel: "geheel",
      score: 3,
      onderbouwing: ONDERBOUWING,
    });
    opslag.scores.rondBewijsstukAf({ bewijsstukId: s.id });
  }
  opslag.rondes.verzetFase({ id: ronde.id, naar: "beslissing_voorstel" });
  return { ronde, stukken };
}

describe("beslissingen", () => {
  it("legt voorstel en beslissing samen vast en verzet de fase", () => {
    const { ronde } = rondeBijHetVoorstel();
    const beslissing = opslag.beslissingen.legVast({
      rondeId: ronde.id,
      voorstelUitkomst: "bekrachtigd",
      voorstelBerekening: { totaal: 1, toegepasteRegels: ["norm_gehaald"] },
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: 7,
      bekrachtigerTweeId: 9,
      doorBeheerderId: 7,
    });
    expect(beslissing.voorstelUitkomst).toBe("bekrachtigd");
    expect(beslissing.afwijkingMotivering).toBeNull();
    expect(beslissing.voorstelBerekening).toEqual({
      totaal: 1,
      toegepasteRegels: ["norm_gehaald"],
    });
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("beslist");
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_beslissing_vastgelegd");
  });

  it("eist een motivering zodra de mens van de machine afwijkt", () => {
    const { ronde } = rondeBijHetVoorstel();
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "voorwaardelijk",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 9,
      }),
    ).toThrow(/motivering van minstens veertig tekens/);
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "voorwaardelijk",
        afwijkingMotivering: "te kort",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 9,
      }),
    ).toThrow(/veertig tekens/);
    const goed = opslag.beslissingen.legVast({
      rondeId: ronde.id,
      voorstelUitkomst: "bekrachtigd",
      voorstelBerekening: {},
      definitieveUitkomst: "voorwaardelijk",
      afwijkingMotivering:
        "Het panel weegt zwaarder dat de kandidaat tweemaal buiten het kader trad dan de scores laten zien.",
      bekrachtigerEenId: 7,
      bekrachtigerTweeId: 9,
    });
    expect(goed.definitieveUitkomst).toBe("voorwaardelijk");
    expect(goed.afwijkingMotivering).toContain("buiten het kader");
  });

  it("weigert één en dezelfde bekrachtiger tweemaal", () => {
    const { ronde } = rondeBijHetVoorstel();
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "bekrachtigd",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 7,
      }),
    ).toThrow(/twee verschillende mensen/);
  });

  it("weigert een tweede beslissing wanneer de ronde na een gegrond bezwaar terugkomt", () => {
    // Dit is het enige pad waarlangs een ronde tweemaal bij een beslismoment
    // komt. Bij een tweede poging vanuit dezelfde fase weigert de loop al
    // eerder; hier is de fase geldig en moet de beslissing zelf de deur
    // dichthouden. Dat is precies het moment waarop het misgaat als niemand
    // kijkt: het dossier is heropend, de fase klopt, en zonder deze weigering
    // zou de databank een ruwe uniciteitsfout geven in plaats van een uitleg.
    const { ronde } = rondeBijHetVoorstel();
    opslag.beslissingen.legVast({
      rondeId: ronde.id,
      voorstelUitkomst: "bekrachtigd",
      voorstelBerekening: {},
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: 7,
      bekrachtigerTweeId: 9,
    });
    opslag.beslissingen.legDebriefVast({ rondeId: ronde.id, debriefDoor: 7 });
    const bezwaar = opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND });
    opslag.bezwaren.doeUitspraak({
      id: bezwaar.id,
      uitspraak: "gegrond",
      motivering:
        "Het derde bewijsstuk is beoordeeld op een rubriek die in deze normversie niet gold.",
    });
    opslag.rondes.verzetFase({ id: ronde.id, naar: "beslissing_voorstel" });
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("beslissing_voorstel");
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "voorwaardelijk",
        afwijkingMotivering:
          "Na het gegronde bezwaar valt het derde bewijsstuk weg en haalt de kandidaat de as zeggen niet.",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 9,
      }),
    ).toThrow(/al een beslissing/);
  });

  it("weigert een tweede beslissing vanuit dezelfde fase al op de loop", () => {
    const { ronde } = rondeBijHetVoorstel();
    opslag.beslissingen.legVast({
      rondeId: ronde.id,
      voorstelUitkomst: "bekrachtigd",
      voorstelBerekening: {},
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: 7,
      bekrachtigerTweeId: 9,
    });
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "bekrachtigd",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 9,
      }),
    ).toThrow(/na het voorstel of na overleg/);
  });

  it("publiceert niet voordat het debriefgesprek is vastgelegd", () => {
    const { ronde } = rondeBijHetVoorstel();
    opslag.beslissingen.legVast({
      rondeId: ronde.id,
      voorstelUitkomst: "bekrachtigd",
      voorstelBerekening: {},
      definitieveUitkomst: "bekrachtigd",
      bekrachtigerEenId: 7,
      bekrachtigerTweeId: 9,
    });
    expect(() => opslag.beslissingen.publiceer({ rondeId: ronde.id })).toThrow(
      /pas nadat het debriefgesprek/,
    );
    opslag.beslissingen.legDebriefVast({ rondeId: ronde.id, debriefDoor: 7 });
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("gedebrieft");
    const na = opslag.beslissingen.publiceer({ rondeId: ronde.id, doorBeheerderId: 7 });
    expect(na.gepubliceerdOp).not.toBeNull();
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_beslissing_gepubliceerd");
    expect(() => opslag.beslissingen.publiceer({ rondeId: ronde.id })).toThrow(/al gepubliceerd/);
  });

  it("beslist niet vanuit een fase waar dat niet hoort", () => {
    const { ronde } = rondeInBeoordeling();
    expect(() =>
      opslag.beslissingen.legVast({
        rondeId: ronde.id,
        voorstelUitkomst: "bekrachtigd",
        voorstelBerekening: {},
        definitieveUitkomst: "bekrachtigd",
        bekrachtigerEenId: 7,
        bekrachtigerTweeId: 9,
      }),
    ).toThrow(/na het voorstel of na overleg/);
  });
});

// ---------------------------------------------------------------------------

/** Een ronde met een gepubliceerde beslissing, klaar voor bezwaar. */
function rondeMetUitkomst() {
  const { ronde } = rondeBijHetVoorstel();
  opslag.beslissingen.legVast({
    rondeId: ronde.id,
    voorstelUitkomst: "bekrachtigd",
    voorstelBerekening: {},
    definitieveUitkomst: "bekrachtigd",
    bekrachtigerEenId: 7,
    bekrachtigerTweeId: 9,
  });
  opslag.beslissingen.legDebriefVast({ rondeId: ronde.id, debriefDoor: 7 });
  return ronde;
}

const GROND = "De opname was onbruikbaar en dat is niet meegewogen bij de beoordeling.";

describe("bezwaren", () => {
  it("neemt geen bezwaar aan zonder beslissing", () => {
    const { ronde } = rondeInBeoordeling();
    expect(() => opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND })).toThrow(
      /nog geen beslissing/,
    );
  });

  it("zet de ronde op bezwaar en houdt de status ongewijzigd", () => {
    const ronde = rondeMetUitkomst();
    const bezwaar = opslag.bezwaren.dienIn({
      rondeId: ronde.id,
      grond: GROND,
      doorBeheerderId: 7,
    });
    expect(bezwaar.statusTijdensBezwaarOngewijzigd).toBe(true);
    expect(bezwaar.uitspraak).toBeNull();
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("bezwaar");
    expect(opslag.bezwaren.openstaand()).toHaveLength(1);
    expect(sporen.map((s) => s.actie)).toContain("bekwaamheid_bezwaar_ingediend");
  });

  it("neemt een laat bezwaar wél aan; ontvankelijkheid is geen zaak van de opslag", () => {
    const ronde = rondeMetUitkomst();
    expect(() =>
      opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND, ingediendOp: "2030-01-01" }),
    ).not.toThrow();
  });

  it("sluit de ronde bij ongegrond en heropent de beoordeling bij gegrond", () => {
    const ronde = rondeMetUitkomst();
    const een = opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND });
    opslag.bezwaren.doeUitspraak({
      id: een.id,
      uitspraak: "ongegrond",
      motivering:
        "De opname is opnieuw bekeken door een derde beoordelaar en bleek wel degelijk bruikbaar.",
      doorBeheerderId: 7,
    });
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("afgesloten");
    expect(opslag.bezwaren.openstaand()).toHaveLength(0);

    const twee = opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND });
    opslag.bezwaren.doeUitspraak({
      id: twee.id,
      uitspraak: "gegrond",
      motivering:
        "Het tweede bezwaar treft doel: het derde bewijsstuk is beoordeeld op een rubriek die niet gold.",
    });
    expect(opslag.rondes.vindOp(ronde.id)!.fase).toBe("in_beoordeling");
  });

  it("weigert een tweede uitspraak en een te korte motivering", () => {
    const ronde = rondeMetUitkomst();
    const bezwaar = opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND });
    expect(() =>
      opslag.bezwaren.doeUitspraak({ id: bezwaar.id, uitspraak: "gegrond", motivering: "ja" }),
    ).toThrow(/veertig tekens/);
    opslag.bezwaren.doeUitspraak({
      id: bezwaar.id,
      uitspraak: "ongegrond",
      motivering: "De aangevoerde grond raakt de beoordeling niet en is feitelijk onjuist.",
    });
    expect(() =>
      opslag.bezwaren.doeUitspraak({
        id: bezwaar.id,
        uitspraak: "gegrond",
        motivering: "Toch nog een tweede uitspraak over hetzelfde bezwaar proberen te doen.",
      }),
    ).toThrow(/al een uitspraak/);
  });

  it("bevestigt de ontvangst met een datum", () => {
    const ronde = rondeMetUitkomst();
    const bezwaar = opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: GROND });
    const na = opslag.bezwaren.bevestigOntvangst({ id: bezwaar.id, op: "2026-05-01" });
    expect(na.ontvangstbevestigdOp).toBe("2026-05-01");
  });

  it("weigert een grond die te kort is om te behandelen", () => {
    const ronde = rondeMetUitkomst();
    expect(() => opslag.bezwaren.dienIn({ rondeId: ronde.id, grond: "oneens" })).toThrow(
      /twintig tekens/,
    );
  });
});
