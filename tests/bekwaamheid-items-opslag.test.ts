import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import {
  BLOKPLAN,
  BLOKPLAN_TOTAAL,
  KENNISCHECKBLOKKEN,
  type Kennischeckblok,
} from "../server/bekwaamheid/schema";
import { verkortPlan } from "../server/bekwaamheid/kennischeck";

/**
 * Een databank in het geheugen met alleen wat deze test leest.
 *
 * Niet de volledige migratie: die zou breken op wijzigingen in tabellen die hier
 * geen rol spelen. Wél met alle CHECK-beperkingen en de unieke index op deze
 * tabellen, want die horen bij het gedrag dat getest wordt — de weigering van een
 * tweede itemset leunt erop.
 */
function geheugenDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE bekwaamheid_geaccrediteerden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      email TEXT
    );

    CREATE TABLE bekwaamheid_rondes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      geaccrediteerde_id INTEGER NOT NULL
        REFERENCES bekwaamheid_geaccrediteerden (id),
      instrument_id TEXT NOT NULL,
      soort TEXT NOT NULL,
      codenummer TEXT NOT NULL,
      fase TEXT NOT NULL DEFAULT 'voorbereiding',
      geopend_op TEXT NOT NULL,
      venster_tot TEXT NOT NULL,
      CONSTRAINT bekwaamheid_ronde_soort
        CHECK (soort IN ('nulmeting','bekrachtiging','herkansing','reactivatie'))
    );
    CREATE UNIQUE INDEX uq_bekwaamheid_ronde_codenummer
      ON bekwaamheid_rondes (codenummer);

    CREATE TABLE bekwaamheid_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id TEXT NOT NULL,
      "as" TEXT NOT NULL,
      blok TEXT,
      soort TEXT NOT NULL,
      stam TEXT NOT NULL,
      opties TEXT,
      sleutel TEXT NOT NULL,
      toelichting_goed TEXT NOT NULL,
      toelichting_fout TEXT NOT NULL,
      gebruik TEXT NOT NULL DEFAULT 'oefenen',
      versie INTEGER NOT NULL DEFAULT 1,
      actief INTEGER NOT NULL DEFAULT 1,
      p_waarde REAL,
      discriminatie REAL,
      bron_verwijzing TEXT,
      CONSTRAINT bekwaamheid_item_as
        CHECK ("as" IN ('weten','zien','zeggen','zorgen')),
      CONSTRAINT bekwaamheid_item_soort
        CHECK (soort IN ('scenario','meerkeuze','juistfout','open')),
      CONSTRAINT bekwaamheid_item_gebruik
        CHECK (gebruik IN ('oefenen','meten','verbrand')),
      CONSTRAINT bekwaamheid_item_blok
        CHECK (blok IS NULL OR blok IN ('A','B','C','D','E')),
      CONSTRAINT bekwaamheid_item_blok_alleen_weten
        CHECK (blok IS NULL OR "as" = 'weten')
    );

    CREATE TABLE bekwaamheid_itemsets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ronde_id INTEGER NOT NULL REFERENCES bekwaamheid_rondes (id),
      bewijsstuk_nummer INTEGER NOT NULL,
      item_ids TEXT NOT NULL,
      antwoorden TEXT,
      item_tijden TEXT,
      samengesteld_op TEXT NOT NULL,
      CONSTRAINT bekwaamheid_itemset_bewijsstuk_bereik
        CHECK (bewijsstuk_nummer BETWEEN 1 AND 5)
    );
    CREATE UNIQUE INDEX uq_bekwaamheid_itemset_bewijsstuk
      ON bekwaamheid_itemsets (ronde_id, bewijsstuk_nummer);
  `);
  return db;
}

function opslagMetLog() {
  const db = geheugenDb();
  const log: { actie: string; detail: string }[] = [];
  const opslag = maakBekwaamheidOpslag(db, (invoer) => {
    log.push({ actie: invoer.actie, detail: invoer.detail });
    return undefined as never;
  });
  return { db, log, opslag };
}

type Opslag = ReturnType<typeof maakBekwaamheidOpslag>;

const INSTRUMENT = "t4p-business-kompas";

function itemInvoer(overschrijf: Record<string, unknown> = {}) {
  return {
    instrumentId: INSTRUMENT,
    as: "weten",
    blok: "C",
    soort: "meerkeuze",
    stam:
      "Een coach wil de scores van het Business Kompas gebruiken om te bepalen " +
      "wie in aanmerking komt voor een promotie. Wat is hier het probleem?",
    opties: [
      "Er is geen probleem, mits de coach de handleiding volgt.",
      "Het instrument is niet gevalideerd voor selectiebeslissingen.",
      "De scores zijn te oud om nog te gebruiken.",
      "De coach moet eerst een tweede instrument afnemen.",
    ],
    sleutel: "B",
    toelichtingGoed:
      "Juist. Het Business Kompas is ontwikkeld voor ontwikkelingsgesprekken en " +
      "niet voor selectie; die toepassing valt buiten het validatiebereik.",
    toelichtingFout:
      "Het gaat hier niet om de ouderdom van de scores of om een tweede meting, " +
      "maar om het gebruiksdoel waarvoor het instrument is onderzocht.",
    ...overschrijf,
  } as Parameters<Opslag["items"]["zetNeer"]>[0];
}

/** Vult de bank met per blok het gevraagde aantal meetitems. */
function vulBank(
  opslag: Opslag,
  perBlok: Partial<Record<Kennischeckblok, number>> = BLOKPLAN,
  instrument = INSTRUMENT,
): number[] {
  const ids: number[] = [];
  for (const blok of KENNISCHECKBLOKKEN) {
    for (let i = 0; i < (perBlok[blok] ?? 0); i += 1) {
      const item = opslag.items.zetNeer(
        itemInvoer({
          instrumentId: instrument,
          blok,
          gebruik: "meten",
          stam: `Vraag ${blok}${i} met een stam die ruim lang genoeg is om te tellen.`,
        }),
      );
      ids.push(item.id);
    }
  }
  return ids;
}

function maakRonde(
  db: ReturnType<typeof geheugenDb>,
  opties: { persoonId?: number; codenummer?: string; instrument?: string } = {},
): { rondeId: number; persoonId: number } {
  let persoonId = opties.persoonId;
  if (persoonId === undefined) {
    persoonId = Number(
      db
        .prepare("INSERT INTO bekwaamheid_geaccrediteerden (naam, email) VALUES (?, ?)")
        .run("Els Vermeulen", "els.vermeulen@voorbeeld.be").lastInsertRowid,
    );
  }
  const rondeId = Number(
    db
      .prepare(
        `INSERT INTO bekwaamheid_rondes
           (geaccrediteerde_id, instrument_id, soort, codenummer, geopend_op, venster_tot)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        persoonId,
        opties.instrument ?? INSTRUMENT,
        "bekrachtiging",
        opties.codenummer ?? `BK-2026-${Math.random().toString(36).slice(2, 8)}`,
        "2026-01-05",
        "2026-04-05",
      ).lastInsertRowid,
  );
  return { rondeId, persoonId };
}

// ---------------------------------------------------------------------------
// De itembank in de datalaag
// ---------------------------------------------------------------------------

describe("blok 4 - de itembank in de datalaag", () => {
  it("zet een item neer en leest het terug", () => {
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer());
    expect(item.instrumentId).toBe(INSTRUMENT);
    expect(item.blok).toBe("C");
    expect(item.opties).toHaveLength(4);
    expect(item.versie).toBe(1);
    expect(item.actief).toBe(true);
  });

  it("zet een nieuw item standaard op oefenen", () => {
    // De weg van oefenen naar meten is afgesloten, dus wie een meetitem wil, moet
    // dat expliciet zeggen. Dat is precies één handeling extra op de plaats waar
    // de beslissing hoort te vallen.
    const { opslag } = opslagMetLog();
    expect(opslag.items.zetNeer(itemInvoer()).gebruik).toBe("oefenen");
    expect(opslag.items.zetNeer(itemInvoer({ gebruik: "meten" })).gebruik).toBe("meten");
  });

  it("weigert een item dat de constructieregels niet haalt", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.items.zetNeer(itemInvoer({ sleutel: "E" }))).toThrow(/sleutel/);
    expect(() => opslag.items.zetNeer(itemInvoer({ stam: "Te kort." }))).toThrow(/stam/);
  });

  it("laat niets in de databank achter wanneer het item is afgekeurd", () => {
    const { db, opslag } = opslagMetLog();
    try {
      opslag.items.zetNeer(itemInvoer({ stam: "Te kort." }));
    } catch {
      /* verwacht */
    }
    const aantal = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_items")
      .get() as { n: number };
    expect(aantal.n).toBe(0);
  });

  it("weigert oefenen naar meten ook in de datalaag", () => {
    // De poorttest uit bouwplan §10. De weigering staat in de opslaglaag en niet
    // alleen in een route, want anders kan een migratiescript of een tweede route
    // erlangs.
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "oefenen" }));
    expect(() => opslag.items.wijzig(item.id, { gebruik: "meten" })).toThrow(
      /nooit meetitem/,
    );
    expect(opslag.items.vindOp(item.id)!.gebruik).toBe("oefenen");
  });

  it("weigert elke weg terug uit verbrand", () => {
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "meten" }));
    opslag.items.wijzig(item.id, { gebruik: "verbrand" });
    for (const naar of ["meten", "oefenen"] as const) {
      expect(() => opslag.items.wijzig(item.id, { gebruik: naar }), naar).toThrow(
        /blijft verbrand/,
      );
    }
    expect(opslag.items.vindOp(item.id)!.gebruik).toBe("verbrand");
  });

  it("laat degraderen van meten naar oefenen wel toe", () => {
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "meten" }));
    expect(opslag.items.wijzig(item.id, { gebruik: "oefenen" }).gebruik).toBe("oefenen");
  });

  it("logt een gebruikswijziging apart van een inhoudelijke wijziging", () => {
    // Bij een bezwaar over een itemset is de vraag altijd wanneer welk item van
    // status wisselde. Dat moet los te zien zijn van een spelfoutherstel.
    const { opslag, log } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "meten" }));
    log.length = 0;
    opslag.items.wijzig(item.id, { gebruik: "verbrand" });
    expect(log.map((r) => r.actie)).toEqual(["bekwaamheid_item_gebruik_gewijzigd"]);
    expect(log[0]!.detail).toMatch(/van meten naar verbrand/);
  });

  it("verhoogt de versie bij een inhoudelijke wijziging en niet bij itemanalyse", () => {
    // Een itemset verwijst naar een itemnummer, en dat nummer mag niet naar een
    // ander item gaan wijzen. De versie maakt zichtbaar dat de tekst na de afname
    // is aangepast. Een p-waarde is uitkomst van itemanalyse en geen wijziging van
    // het item zelf.
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "meten" }));
    expect(item.versie).toBe(1);

    const na = opslag.items.wijzig(item.id, {
      stam: "Een herschreven stam die opnieuw ruim lang genoeg is om te tellen.",
    });
    expect(na.versie).toBe(2);

    const naAnalyse = opslag.items.wijzig(item.id, { pWaarde: 0.42, discriminatie: 0.31 });
    expect(naAnalyse.versie).toBe(2);
    expect(naAnalyse.pWaarde).toBeCloseTo(0.42, 10);
  });

  it("weigert een wijziging die het item ongeldig zou maken", () => {
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer({ gebruik: "meten" }));
    expect(() => opslag.items.wijzig(item.id, { sleutel: "Z" })).toThrow(/sleutel/);
    expect(opslag.items.vindOp(item.id)!.sleutel).toBe("B");
  });

  it("gooit bij een item dat niet bestaat", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.items.wijzig(999, { gebruik: "verbrand" })).toThrow(/bestaat niet/);
  });

  it("filtert de lijst op as, blok en gebruik", () => {
    const { opslag } = opslagMetLog();
    opslag.items.zetNeer(itemInvoer({ blok: "A", gebruik: "meten" }));
    opslag.items.zetNeer(itemInvoer({ blok: "C", gebruik: "meten" }));
    opslag.items.zetNeer(itemInvoer({ blok: "C", gebruik: "oefenen" }));
    opslag.items.zetNeer(itemInvoer({ as: "zien", blok: null, gebruik: "meten" }));

    expect(opslag.items.lijst(INSTRUMENT)).toHaveLength(4);
    expect(opslag.items.lijst(INSTRUMENT, { as: "weten" })).toHaveLength(3);
    expect(opslag.items.lijst(INSTRUMENT, { blok: "C" })).toHaveLength(2);
    expect(opslag.items.lijst(INSTRUMENT, { blok: "C", gebruik: "meten" })).toHaveLength(1);
    expect(opslag.items.lijst("ander-instrument")).toHaveLength(0);
  });

  it("laat niet-actieve items standaard meekomen in de lijst", () => {
    // Een beheerscherm dat het bestaan van een gedeactiveerd item verbergt, laat
    // iemand hetzelfde item een tweede keer schrijven.
    const { opslag } = opslagMetLog();
    const item = opslag.items.zetNeer(itemInvoer());
    opslag.items.wijzig(item.id, { actief: false });
    expect(opslag.items.lijst(INSTRUMENT)).toHaveLength(1);
    expect(opslag.items.lijst(INSTRUMENT, { alleenActief: true })).toHaveLength(0);
  });

  it("geeft de blokdekking van een instrument", () => {
    const { opslag } = opslagMetLog();
    vulBank(opslag, { A: 3, C: 2 });
    opslag.items.zetNeer(itemInvoer({ blok: "A", gebruik: "oefenen" }));
    expect(opslag.items.dekking(INSTRUMENT)).toEqual({ A: 3, B: 0, C: 2, D: 0, E: 0 });
  });

  it("laat de databank een blok op een andere as dan weten weigeren", () => {
    // De grens staat niet alleen in de validatie maar ook in de tabel. Zou alleen
    // de validatie hem hebben, dan kan een migratiescript erlangs.
    const { db } = opslagMetLog();
    expect(() =>
      db.exec(
        `INSERT INTO bekwaamheid_items
           ("as", blok, instrument_id, soort, stam, sleutel, toelichting_goed,
            toelichting_fout)
         VALUES ('zorgen', 'C', 't4p', 'meerkeuze', 'Een stam die lang genoeg is.',
                 'A', 'Een toelichting die lang genoeg is.',
                 'Een toelichting die lang genoeg is.')`,
      ),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// De itemsets in de datalaag
// ---------------------------------------------------------------------------

describe("blok 4 - het samenstellen van een kennischeck in de datalaag", () => {
  it("stelt veertig items samen uit een volle bank", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 5 });
    expect(set.itemIds).toHaveLength(BLOKPLAN_TOTAAL);
    expect(set.bewijsstukNummer).toBe(1);
    expect(set.antwoorden).toBeNull();
    expect(set.samengesteldOp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("weigert met een tekort per blok wanneer de bank te dun is", () => {
    // Een tekort dat je niet kan benoemen, wordt niet gedicht. De melding noemt
    // het blok, de leesbare naam, en wat er beschikbaar was.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { ...BLOKPLAN, C: 3 });
    const { rondeId } = maakRonde(db);
    expect(() => opslag.itemsets.stelSamen({ rondeId, zaad: 1 })).toThrow(
      /blok C \(Grenzen\): 3 van 8/,
    );
  });

  it("legt niets vast wanneer de samenstelling geweigerd is", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { A: 1 });
    const { rondeId } = maakRonde(db);
    try {
      opslag.itemsets.stelSamen({ rondeId, zaad: 1 });
    } catch {
      /* verwacht */
    }
    expect(opslag.itemsets.vindVoorBewijsstuk(rondeId, 1)).toBeUndefined();
  });

  it("negeert items van een ander instrument", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, BLOKPLAN, "ander-instrument");
    const { rondeId } = maakRonde(db);
    expect(() => opslag.itemsets.stelSamen({ rondeId, zaad: 1 })).toThrow(/niet samen te stellen/);
  });

  it("weigert een tweede samenstelling voor hetzelfde bewijsstuk", () => {
    // Opnieuw samenstellen zou betekenen dat een kandidaat die de eerste set al
    // heeft gezien een nieuwe krijgt, en dan is de eerste set uitgelekt zonder dat
    // er iemand van weet.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { A: 20, B: 12, C: 16, D: 16, E: 16 });
    const { rondeId } = maakRonde(db);
    opslag.itemsets.stelSamen({ rondeId, zaad: 1 });
    expect(() => opslag.itemsets.stelSamen({ rondeId, zaad: 2 })).toThrow(
      /al een itemset/,
    );
  });

  it("gooit bij een ronde die niet bestaat", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.itemsets.stelSamen({ rondeId: 999 })).toThrow(/bestaat niet/);
  });

  it("sluit bij een tweede ronde de items van de eerste uit", () => {
    // Draaiboek §4.3 eist twee equivalente versies voor herkansingen. Uitsluiten
    // op wat deze persoon werkelijk zag haalt dezelfde eis en werkt ook bij een
    // derde ronde.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { A: 20, B: 12, C: 16, D: 16, E: 16 });
    const eerste = maakRonde(db, { codenummer: "BK-2026-0001" });
    const setEen = opslag.itemsets.stelSamen({ rondeId: eerste.rondeId, zaad: 1 });

    const tweede = maakRonde(db, {
      persoonId: eerste.persoonId,
      codenummer: "BK-2026-0002",
    });
    const setTwee = opslag.itemsets.stelSamen({ rondeId: tweede.rondeId, zaad: 2 });

    const overlap = setTwee.itemIds.filter((id) => setEen.itemIds.includes(id));
    expect(overlap).toEqual([]);
  });

  it("sluit bij een derde ronde beide eerdere sets uit", () => {
    // Wie alleen de vorige ronde uitsluit, biedt in ronde drie de items van ronde
    // één opnieuw aan.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { A: 30, B: 18, C: 24, D: 24, E: 24 });
    const een = maakRonde(db, { codenummer: "BK-A" });
    const setEen = opslag.itemsets.stelSamen({ rondeId: een.rondeId, zaad: 1 });
    const twee = maakRonde(db, { persoonId: een.persoonId, codenummer: "BK-B" });
    const setTwee = opslag.itemsets.stelSamen({ rondeId: twee.rondeId, zaad: 2 });
    const drie = maakRonde(db, { persoonId: een.persoonId, codenummer: "BK-C" });
    const setDrie = opslag.itemsets.stelSamen({ rondeId: drie.rondeId, zaad: 3 });

    const eerder = new Set([...setEen.itemIds, ...setTwee.itemIds]);
    expect(setDrie.itemIds.filter((id) => eerder.has(id))).toEqual([]);
  });

  it("sluit alleen de items van dezelfde persoon uit", () => {
    // De uitsluiting hoort bij een kandidaat en niet bij een instrument. Zou ze
    // over alle personen lopen, dan raakt de bank na een paar rondes leeg en kan
    // niemand nog een check afleggen.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const een = maakRonde(db, { codenummer: "BK-P1" });
    opslag.itemsets.stelSamen({ rondeId: een.rondeId, zaad: 1 });

    const ander = maakRonde(db, { codenummer: "BK-P2" });
    const setAnder = opslag.itemsets.stelSamen({ rondeId: ander.rondeId, zaad: 1 });
    expect(setAnder.itemIds).toHaveLength(BLOKPLAN_TOTAAL);
  });

  it("weigert wanneer de uitsluiting de bank te klein maakt", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const een = maakRonde(db, { codenummer: "BK-K1" });
    opslag.itemsets.stelSamen({ rondeId: een.rondeId, zaad: 1 });
    const twee = maakRonde(db, { persoonId: een.persoonId, codenummer: "BK-K2" });
    expect(() => opslag.itemsets.stelSamen({ rondeId: twee.rondeId, zaad: 2 })).toThrow(
      /niet samen te stellen/,
    );
  });

  it("stelt ook de verkorte check van twintig samen", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, plan: verkortPlan(), zaad: 4 });
    expect(set.itemIds).toHaveLength(20);
  });

  it("logt de samenstelling met het zaad erin", () => {
    // Met bank en zaad is de set exact te herbouwen. Staat het zaad niet in het
    // logboek, dan is die herbouw bij een bezwaar niet meer te doen.
    const { db, opslag, log } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    log.length = 0;
    opslag.itemsets.stelSamen({ rondeId, zaad: 17 });
    const regel = log.find((r) => r.actie === "bekwaamheid_itemset_samengesteld");
    expect(regel).toBeDefined();
    expect(regel!.detail).toMatch(/zaad 17/);
    expect(regel!.detail).toMatch(/40 items/);
  });
});

// ---------------------------------------------------------------------------
// Inleveren
// ---------------------------------------------------------------------------

describe("blok 4 - het inleveren van een kennischeck", () => {
  function klaarOmInTeLeveren() {
    const { db, opslag, log } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    return { db, opslag, log, set };
  }

  it("neemt de antwoorden aan", () => {
    const { opslag, set } = klaarOmInTeLeveren();
    const na = opslag.itemsets.leverIn({
      itemsetId: set.id,
      antwoorden: { [String(set.itemIds[0])]: "B" },
    });
    expect(na.antwoorden).toEqual({ [String(set.itemIds[0])]: "B" });
  });

  it("weigert een tweede inlevering", () => {
    // De poorttest uit bouwplan §10. Zonder die weigering kan een kandidaat na het
    // zien van zijn score opnieuw inleveren, en dan meet de check niet meer wat
    // iemand wist maar hoe vaak hij het probeerde.
    const { opslag, set } = klaarOmInTeLeveren();
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "A" } });
    expect(() =>
      opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "B" } }),
    ).toThrow(/al ingeleverd/);
  });

  it("laat de eerste antwoorden staan wanneer een tweede inlevering is geweigerd", () => {
    const { opslag, set } = klaarOmInTeLeveren();
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "A" } });
    try {
      opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "B" } });
    } catch {
      /* verwacht */
    }
    expect(opslag.itemsets.vindOp(set.id)!.antwoorden).toEqual({ "1": "A" });
  });

  it("bewaart de itemtijden", () => {
    const { opslag, set } = klaarOmInTeLeveren();
    const na = opslag.itemsets.leverIn({
      itemsetId: set.id,
      antwoorden: { "1": "A" },
      itemTijden: { "1": 42000 },
    });
    expect(na.itemTijden).toEqual({ "1": 42000 });
  });

  it("wist bewaarde tijden niet met een leeg object", () => {
    // Het patroon van server/routes/afnames.ts: een oudere client die het veld
    // niet kent, stuurt een leeg object mee, en dat mag geen meetgegevens wissen.
    const { db, opslag, set } = klaarOmInTeLeveren();
    db.prepare("UPDATE bekwaamheid_itemsets SET item_tijden = ? WHERE id = ?").run(
      JSON.stringify({ "1": 1000 }),
      set.id,
    );
    const na = opslag.itemsets.leverIn({
      itemsetId: set.id,
      antwoorden: { "1": "A" },
      itemTijden: {},
    });
    expect(na.itemTijden).toEqual({ "1": 1000 });
  });

  it("gooit bij een itemset die niet bestaat", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.itemsets.leverIn({ itemsetId: 999, antwoorden: {} })).toThrow(
      /bestaat niet/,
    );
  });
});

// ---------------------------------------------------------------------------
// Nakijken
// ---------------------------------------------------------------------------

describe("blok 4 - het nakijken van een ingeleverde kennischeck", () => {
  it("rekent een volledig ingevulde set na", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    // Alle items van vulBank hebben sleutel B.
    const antwoorden: Record<string, string> = {};
    for (const id of set.itemIds) antwoorden[String(id)] = "B";
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden });

    const uitkomst = opslag.itemsets.keurNa({ itemsetId: set.id });
    expect(uitkomst.volledig).toBe(true);
    expect(uitkomst.meetbaar).toBe(BLOKPLAN_TOTAAL);
    expect(uitkomst.ruweScore).toBeCloseTo(1, 10);
  });

  it("houdt de volgorde van perItem gelijk aan de bewaarde itemset", () => {
    // perItem moet naast de itemset te leggen zijn; de volgorde van de databank
    // is een andere dan de volgorde waarin de kandidaat de items zag.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 9 });
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: {} });
    const uitkomst = opslag.itemsets.keurNa({ itemsetId: set.id });
    expect(uitkomst.perItem.map((i) => i.itemId)).toEqual(set.itemIds);
  });

  it("houdt de score leeg zolang een open item op een mens wacht", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag, { ...BLOKPLAN, E: BLOKPLAN.E - 1 });
    const open = opslag.items.zetNeer(
      itemInvoer({
        blok: "E",
        soort: "open",
        opties: null,
        sleutel: "Het antwoord benoemt de rechtsgrond waarop de verwerking rust.",
        gebruik: "meten",
      }),
    );
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    expect(set.itemIds).toContain(open.id);

    const antwoorden: Record<string, string> = {};
    for (const id of set.itemIds) antwoorden[String(id)] = "B";
    antwoorden[String(open.id)] = "Omdat de overeenkomst de rechtsgrond is.";
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden });

    const halve = opslag.itemsets.keurNa({ itemsetId: set.id });
    expect(halve.volledig).toBe(false);
    expect(halve.ruweScore).toBeNull();
    expect(halve.wachtOp).toEqual([open.id]);

    const hele = opslag.itemsets.keurNa({
      itemsetId: set.id,
      handmatigeScores: { [String(open.id)]: 1 },
    });
    expect(hele.volledig).toBe(true);
    expect(hele.ruweScore).toBeCloseTo(1, 10);
  });

  it("weigert na te kijken wat nog niet is ingeleverd", () => {
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    expect(() => opslag.itemsets.keurNa({ itemsetId: set.id })).toThrow(
      /nog niet ingeleverd/,
    );
  });

  it("gooit wanneer een item uit de set verdwenen is", () => {
    // Nakijken met een ontbrekend item zou een score opleveren over een andere set
    // dan de kandidaat kreeg.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: {} });
    db.prepare("DELETE FROM bekwaamheid_items WHERE id = ?").run(set.itemIds[0]);
    expect(() => opslag.itemsets.keurNa({ itemsetId: set.id })).toThrow(
      /dat niet bestaat/,
    );
  });

  it("schrijft bij het nakijken niets weg", () => {
    // Nakijken en vaststellen mogen niet dezelfde handeling worden: dan is er geen
    // moment meer waarop een beoordelaar naar een open item kan kijken vóór er een
    // uitkomst ligt.
    const { db, opslag, log } = opslagMetLog();
    vulBank(opslag);
    const { rondeId } = maakRonde(db);
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 3 });
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "B" } });
    const voor = db
      .prepare("SELECT * FROM bekwaamheid_itemsets WHERE id = ?")
      .get(set.id);
    log.length = 0;

    opslag.itemsets.keurNa({ itemsetId: set.id });

    const na = db.prepare("SELECT * FROM bekwaamheid_itemsets WHERE id = ?").get(set.id);
    expect(na).toEqual(voor);
    expect(log).toEqual([]);
  });

  it("gooit bij een itemset die niet bestaat", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.itemsets.keurNa({ itemsetId: 999 })).toThrow(/bestaat niet/);
  });
});

// ---------------------------------------------------------------------------
// De poort op persoonsgegevens
// ---------------------------------------------------------------------------

describe("blok 4 - de itemset draagt geen persoonsgegevens", () => {
  it("houdt naam, e-mail en initialen uit de itemset en uit het nakijkresultaat", () => {
    // De poorttest uit bouwplan §10, hier op de twee vormen die in deze laag
    // bestaan. De reden is dezelfde als bij de beoordelaarsweg: wie een itemset of
    // een nakijkresultaat doorgeeft, mag daarmee niet ongemerkt de identiteit van
    // de kandidaat meesturen. Een naam die er nu insluipt, staat straks in een
    // logregel, een foutmelding of een uitvoerbestand.
    const { db, opslag } = opslagMetLog();
    vulBank(opslag);
    const persoonId = Number(
      db
        .prepare("INSERT INTO bekwaamheid_geaccrediteerden (naam, email) VALUES (?, ?)")
        .run("Ruben Aerts", "ruben.aerts@voorbeeld.be").lastInsertRowid,
    );
    const { rondeId } = maakRonde(db, { persoonId, codenummer: "BK-PRIV-1" });
    const set = opslag.itemsets.stelSamen({ rondeId, zaad: 6 });
    opslag.itemsets.leverIn({ itemsetId: set.id, antwoorden: { "1": "B" } });
    const uitkomst = opslag.itemsets.keurNa({ itemsetId: set.id });

    // Naam, e-mail, de losse voor- en achternaam, en de initialen.
    const verboden = [
      "Ruben Aerts",
      "ruben.aerts@voorbeeld.be",
      "Ruben",
      "Aerts",
      "R.A.",
      "RA",
    ];
    for (const vorm of [set, uitkomst]) {
      const tekst = JSON.stringify(vorm);
      for (const term of verboden) {
        expect(tekst, `${term} staat in de payload`).not.toContain(term);
      }
    }
  });
});
