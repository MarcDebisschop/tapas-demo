// ---------------------------------------------------------------------------
// tests/opvolging-per-instrument.test.ts
//
// Wat de tests bewijzen:
//   1. De aggregatie telt per instrument correct: voltooid, in uitvoering,
//      niet gestart en de voltooiingsgraad - en niet langer globaal.
//   2. Afnames zonder instrumentId komen in een aparte groep "onbekend"; er
//      wordt nooit een instrument bij verzonnen.
//   3. Instrumenten zonder afnames blijven zichtbaar (totaal 0) en de sortering
//      is aflopend op totaal, dan alfabetisch.
//   4. BEVEILIGING: de organisatie-scope geeft NOOIT afnames van een andere
//      organisatie terug en nooit afnames zonder organisatie (null-org).
//   5. parseOrganisatieId weigert alles wat geen positief geheel getal is, zodat
//      een ontbrekende of gemanipuleerde scope nooit "toon alles" wordt.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  aggregeerPerInstrument,
  filterAfnames,
  leesAfnameRijen,
  parseOrganisatieId,
  voltooiingsgraad,
  ONBEKEND_INSTRUMENT_ID,
  ONBEKEND_LABEL,
  type AfnameRij,
} from "../server/opvolging-per-instrument";

const INSTRUMENTEN = [
  { instrumentId: "t4p-business-kompas", label: "T4P Business Kompas" },
  { instrumentId: "t4teens", label: "T4Teens" },
  { instrumentId: "t4kids", label: "T4Kids" },
];

function rij(instrumentId: string | null, status: string): AfnameRij {
  return { instrumentId, status };
}

describe("aggregeerPerInstrument", () => {
  it("telt per instrument in plaats van globaal", () => {
    const { rijen } = aggregeerPerInstrument(
      [
        rij("t4teens", "voltooid"),
        rij("t4teens", "voltooid"),
        rij("t4teens", "deel1"),
        rij("t4teens", "uitgenodigd"),
        rij("t4kids", "voltooid"),
        rij("t4kids", "consent"),
      ],
      INSTRUMENTEN,
    );

    const teens = rijen.find((r) => r.instrumentId === "t4teens")!;
    expect(teens).toMatchObject({
      label: "T4Teens",
      totaal: 4,
      voltooid: 2,
      inUitvoering: 1,
      nietGestart: 1,
      voltooiingsgraad: 50,
    });

    const kids = rijen.find((r) => r.instrumentId === "t4kids")!;
    expect(kids).toMatchObject({ totaal: 2, voltooid: 1, inUitvoering: 0, nietGestart: 1 });
    expect(kids.voltooiingsgraad).toBe(50);
  });

  it("rekent deel1, deel2 en gestart als in uitvoering", () => {
    const { totalen } = aggregeerPerInstrument(
      [rij("t4teens", "deel1"), rij("t4teens", "deel2"), rij("t4teens", "gestart")],
      INSTRUMENTEN,
    );
    expect(totalen.inUitvoering).toBe(3);
    expect(totalen.nietGestart).toBe(0);
    expect(totalen.voltooid).toBe(0);
  });

  it("zet afnames zonder instrumentId in de groep onbekend", () => {
    const { rijen } = aggregeerPerInstrument(
      [rij(null, "voltooid"), rij("", "uitgenodigd"), rij("t4teens", "voltooid")],
      INSTRUMENTEN,
    );
    const onbekend = rijen.find((r) => r.instrumentId === ONBEKEND_INSTRUMENT_ID)!;
    expect(onbekend.label).toBe(ONBEKEND_LABEL);
    expect(onbekend.totaal).toBe(2);
    expect(onbekend.voltooid).toBe(1);
  });

  it("toont de onbekend-groep niet wanneer elke afname een instrument heeft", () => {
    const { rijen } = aggregeerPerInstrument([rij("t4teens", "voltooid")], INSTRUMENTEN);
    expect(rijen.some((r) => r.instrumentId === ONBEKEND_INSTRUMENT_ID)).toBe(false);
  });

  it("behoudt instrumenten zonder afnames en sorteert op totaal, dan label", () => {
    const { rijen } = aggregeerPerInstrument(
      [rij("t4kids", "voltooid"), rij("t4kids", "deel1")],
      INSTRUMENTEN,
    );
    expect(rijen).toHaveLength(3);
    expect(rijen[0]!.instrumentId).toBe("t4kids");
    // De twee lege instrumenten staan alfabetisch: T4P Business Kompas, T4Teens.
    expect(rijen.slice(1).map((r) => r.label)).toEqual(["T4P Business Kompas", "T4Teens"]);
    expect(rijen[1]!.totaal).toBe(0);
    expect(rijen[1]!.voltooiingsgraad).toBe(0);
  });

  it("laat een niet-geregistreerd instrument-id niet uit de telling vallen", () => {
    const { rijen, totalen } = aggregeerPerInstrument(
      [rij("verdwenen-instrument", "voltooid")],
      INSTRUMENTEN,
    );
    const gevonden = rijen.find((r) => r.instrumentId === "verdwenen-instrument")!;
    expect(gevonden.label).toBe("verdwenen-instrument");
    expect(gevonden.totaal).toBe(1);
    expect(totalen.totaal).toBe(1);
  });

  it("houdt de optelling sluitend, ook bij een onbekende status", () => {
    const { rijen, totalen } = aggregeerPerInstrument(
      [rij("t4teens", "voltooid"), rij("t4teens", "iets-nieuws"), rij(null, "deel2")],
      INSTRUMENTEN,
    );
    for (const r of rijen) {
      expect(r.voltooid + r.inUitvoering + r.nietGestart).toBe(r.totaal);
    }
    expect(totalen.voltooid + totalen.inUitvoering + totalen.nietGestart).toBe(totalen.totaal);
    expect(totalen.totaal).toBe(3);
  });

  it("geeft voltooiingsgraad op 1 decimaal en 0 bij een leeg totaal", () => {
    expect(voltooiingsgraad(0, 0)).toBe(0);
    expect(voltooiingsgraad(1, 3)).toBe(33.3);
    expect(voltooiingsgraad(2, 3)).toBe(66.7);
    expect(voltooiingsgraad(3, 3)).toBe(100);
  });
});

describe("parseOrganisatieId - scope mag nooit stilzwijgend wegvallen", () => {
  it("aanvaardt enkel een positief geheel getal", () => {
    expect(parseOrganisatieId("7")).toBe(7);
    expect(parseOrganisatieId(7)).toBe(7);
    expect(parseOrganisatieId(" 7 ")).toBe(7);
  });

  it("weigert lege, niet-numerieke, negatieve en gemanipuleerde waarden", () => {
    for (const ongeldig of [
      undefined,
      null,
      "",
      "   ",
      "0",
      "-1",
      "abc",
      "1.5",
      "1 OR 1=1",
      "1; DROP TABLE afnames",
      "%",
      ["1"],
      {},
      NaN,
    ]) {
      expect(parseOrganisatieId(ongeldig as unknown)).toBeNull();
    }
  });
});

describe("instrument-filter op /api/admin/afnames", () => {
  const AFNAMES = [
    { id: 1, instrumentId: "t4teens", organisatieId: 1 },
    { id: 2, instrumentId: "t4teens", organisatieId: 2 },
    { id: 3, instrumentId: "t4kids", organisatieId: 1 },
    { id: 4, instrumentId: null, organisatieId: 1 },
    { id: 5, instrumentId: "t4kids", organisatieId: null },
  ];

  it("geeft zonder filters de volledige lijst ongewijzigd terug", () => {
    expect(filterAfnames(AFNAMES, {})).toEqual(AFNAMES);
    expect(filterAfnames(AFNAMES, { instrument: "", organisatieId: null })).toEqual(AFNAMES);
  });

  it("filtert op instrument", () => {
    expect(filterAfnames(AFNAMES, { instrument: "t4teens" }).map((a) => a.id)).toEqual([1, 2]);
    expect(filterAfnames(AFNAMES, { instrument: "t4kids" }).map((a) => a.id)).toEqual([3, 5]);
  });

  it("haalt afnames zonder instrument op via instrument=onbekend", () => {
    expect(filterAfnames(AFNAMES, { instrument: ONBEKEND_INSTRUMENT_ID }).map((a) => a.id)).toEqual([4]);
  });

  it("geeft een lege lijst voor een instrument zonder afnames", () => {
    expect(filterAfnames(AFNAMES, { instrument: "bestaat-niet" })).toEqual([]);
  });

  it("combineert het instrument- en organisatiefilter", () => {
    expect(filterAfnames(AFNAMES, { instrument: "t4kids", organisatieId: 1 }).map((a) => a.id)).toEqual([3]);
  });

  it("laat bij een organisatiefilter nooit afnames zonder organisatie door", () => {
    const resultaat = filterAfnames(AFNAMES, { organisatieId: 1 });
    expect(resultaat.map((a) => a.id)).toEqual([1, 3, 4]);
    expect(resultaat.every((a) => a.organisatieId === 1)).toBe(true);
  });
});

describe("organisatie-scope isolatie (beveiliging)", () => {
  const db = new Database(":memory:");

  beforeEach(() => {
    db.exec(`
      DROP TABLE IF EXISTS afnames;
      CREATE TABLE afnames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organisatie_id INTEGER,
        instrument_id TEXT,
        status TEXT NOT NULL
      );
    `);
    const ins = db.prepare(
      `INSERT INTO afnames (organisatie_id, instrument_id, status) VALUES (?, ?, ?)`,
    );
    // Organisatie 1 - de eigen afnames.
    ins.run(1, "t4teens", "voltooid");
    ins.run(1, "t4teens", "deel1");
    ins.run(1, null, "uitgenodigd");
    // Organisatie 2 - mag NOOIT zichtbaar zijn voor organisatie 1.
    ins.run(2, "t4teens", "voltooid");
    ins.run(2, "t4kids", "voltooid");
    // Particuliere afnames zonder organisatie - horen bij geen enkele org.
    ins.run(null, "t4kids", "voltooid");
    ins.run(null, "t4teens", "deel2");
  });

  it("geeft enkel de afnames van de gevraagde organisatie", () => {
    const rijen = leesAfnameRijen(db, 1);
    expect(rijen).toHaveLength(3);
    const { totalen } = aggregeerPerInstrument(rijen, INSTRUMENTEN);
    expect(totalen).toMatchObject({ totaal: 3, voltooid: 1, inUitvoering: 1, nietGestart: 1 });
  });

  it("lekt nooit afnames van een andere organisatie of zonder organisatie", () => {
    // Organisatie 1 ziet 3 van de 7 rijen. De 4 overige (org 2 en null-org)
    // mogen op geen enkele manier in het resultaat opduiken.
    const totaalInDb = (db.prepare(`SELECT COUNT(*) AS n FROM afnames`).get() as any).n;
    expect(totaalInDb).toBe(7);

    for (const orgId of [1, 2]) {
      const rijen = leesAfnameRijen(db, orgId);
      const ids = db
        .prepare(`SELECT id FROM afnames WHERE organisatie_id = ?`)
        .all(orgId) as Array<{ id: number }>;
      expect(rijen).toHaveLength(ids.length);
      const { totalen } = aggregeerPerInstrument(rijen, INSTRUMENTEN);
      expect(totalen.totaal).toBe(ids.length);
      expect(totalen.totaal).toBeLessThan(totaalInDb);
    }

    // Organisatie 1 en 2 samen zijn nog steeds minder dan het geheel: de
    // null-org afnames blijven voor iedereen buiten beeld.
    const org1 = leesAfnameRijen(db, 1).length;
    const org2 = leesAfnameRijen(db, 2).length;
    expect(org1 + org2).toBe(5);
    expect(org1 + org2).toBeLessThan(totaalInDb);
  });

  it("geeft een leeg maar geldig resultaat voor een organisatie zonder afnames", () => {
    const rijen = leesAfnameRijen(db, 999);
    expect(rijen).toEqual([]);
    const { rijen: perInstrument, totalen } = aggregeerPerInstrument(rijen, INSTRUMENTEN);
    expect(totalen).toMatchObject({ totaal: 0, voltooid: 0, voltooiingsgraad: 0 });
    // Het volledige palet blijft zichtbaar, alles op nul.
    expect(perInstrument).toHaveLength(3);
    expect(perInstrument.every((r) => r.totaal === 0)).toBe(true);
  });

  it("geeft met organisatieId null wel alles - enkel bedoeld voor het adminpad", () => {
    expect(leesAfnameRijen(db, null)).toHaveLength(7);
  });
});
