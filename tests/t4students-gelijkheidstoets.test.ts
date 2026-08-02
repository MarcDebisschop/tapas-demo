import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// De gelijkheidstoets van fase 1.
//
// WAT DEZE TEST AANTOONT
// De scoringsmotor die naar het platform is overgezet levert voor zeventien
// vaste antwoordpatronen precies dezelfde uitkomst als de originele motor die
// buiten het platform draait. Niet alleen dezelfde getallen: dezelfde velden,
// in dezelfde volgorde, met dezelfde afronding en dezelfde volgorde bij gelijke
// stand.
//
// HOE HET BEWIJS TOT STAND KWAM
// De patronen staan in tests/t4students-gelijkheidstoets/patronen.json. Ze zijn
// eenmalig door de ORIGINELE scorer.js gehaald, samen met het ORIGINELE
// instrument-data.js, en de uitkomsten zijn bevroren in
// tests/t4students-gelijkheidstoets/uitkomsten/. Die bestanden zijn het
// bewijsmateriaal; ze worden hier alleen gelezen, nooit geschreven. Het script
// dat ze maakte staat ernaast, met uitleg hoe je het opnieuw draait.
//
// Doordat de bevroren uitkomsten van het originele instrumentbestand komen en
// deze test het omgezette server/data/t4students.json gebruikt, toont de
// vergelijking meteen ook aan dat het vervangen van de lange streepjes in de
// itemteksten de uitkomst niet raakt.
//
// HET ENIGE VERSCHIL
// De alertteksten staan in de motor zelf, niet in het instrument. Twee van de
// vier bevatten in de bron een lang streepje, in alle drie de talen. Dat mag
// hier niet staan, dus daar staat nu een punt of een komma. Dat verschil wordt
// hieronder niet weggepoetst: het staat als letterlijke tabel in
// tests/t4students-kompas-alertteksten.test.ts, en de test "buiten de
// alertteksten is er geen enkel verschil" hieronder bewijst dat er nergens
// anders iets afwijkt.
// ---------------------------------------------------------------------------

const hier = path.resolve(__dirname, "t4students-gelijkheidstoets");

interface Patroon {
  naam: string;
  toelichting: string;
  taal: string;
  deelnemer: { naam?: string; code?: string } | null;
  antwoorden: Record<string, any>;
}

const patronen: Patroon[] = JSON.parse(
  readFileSync(path.join(hier, "patronen.json"), "utf-8"),
);

function bevrorenUitkomst(naam: string): any {
  return JSON.parse(readFileSync(path.join(hier, "uitkomsten", `${naam}.json`), "utf-8"));
}

function draai(p: Patroon): any {
  return scoreStudiekompas(
    T4STUDENTS_INSTRUMENT,
    p.antwoorden,
    p.deelnemer,
    p.taal,
  );
}

/** Dezelfde boom, maar zonder de alertboodschappen. */
function zonderAlertteksten(o: any): any {
  const kopie = JSON.parse(JSON.stringify(o));
  for (const a of kopie?.alerts?.actief ?? []) delete a.boodschap;
  return kopie;
}

describe("gelijkheidstoets T4Students: de overgezette motor tegen de originele", () => {
  it("er zijn minstens acht patronen en ze dekken de gevraagde gevallen", () => {
    const namen = patronen.map((p) => p.naam);
    expect(patronen.length).toBeGreaterThanOrEqual(8);
    expect(namen).toContain("alles-minimaal");
    expect(namen).toContain("alles-maximaal");
    expect(namen).toContain("midden");
    expect(namen).toContain("ontbrekende-antwoorden");
    expect(namen.filter((n) => n.startsWith("gemengd-")).length).toBeGreaterThanOrEqual(3);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("elke situatie-optie is in de patronen minstens eenmaal gekozen", () => {
    const main = T4STUDENTS_INSTRUMENT.sections.find((s) => s.sectionId === "main")!;
    const situatieItems = main.items.filter((i) => i.itemType === "sjt");
    expect(situatieItems.map((i) => i.id)).toEqual(["D5", "D6", "F4", "F5"]);

    const gekozen = new Set<string>();
    for (const p of patronen) {
      for (const it of situatieItems) {
        const keuze = p.antwoorden[it.id]?.choice;
        if (keuze != null) gekozen.add(`${it.id}:${keuze}`);
      }
    }
    const verwacht = situatieItems.flatMap((i) =>
      (i.options ?? []).map((o) => `${i.id}:${o.key}`),
    );
    const ontbreekt = verwacht.filter((k) => !gekozen.has(k));
    expect(ontbreekt, `nooit gekozen situatie-opties: ${ontbreekt.join(", ")}`).toEqual([]);
  });

  it("voor elk patroon bestaat een bevroren uitkomst en omgekeerd", () => {
    const opSchijf = readdirSync(path.join(hier, "uitkomsten"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    expect(opSchijf).toEqual(patronen.map((p) => p.naam).sort());
  });

  for (const p of patronen) {
    it(`patroon ${p.naam}: elk veld buiten de alertteksten is gelijk aan de bron`, () => {
      expect(zonderAlertteksten(draai(p))).toEqual(zonderAlertteksten(bevrorenUitkomst(p.naam)));
    });
  }

  it("ook de volgorde van de velden is gelijk, inclusief de volgorde bij gelijke stand", () => {
    // toEqual kijkt niet naar sleutelvolgorde. De volgorde van constructScores
    // volgt de families uit het instrument, en de ranglijsten volgen een
    // sortering waarin gelijke scores voorkomen. Als de overzetting daar iets
    // aan veranderd had, zou dat hier zichtbaar worden en nergens anders.
    for (const p of patronen) {
      const nieuw = JSON.stringify(zonderAlertteksten(draai(p)));
      const bron = JSON.stringify(zonderAlertteksten(bevrorenUitkomst(p.naam)));
      expect(nieuw, `veldvolgorde loopt uiteen bij patroon ${p.naam}`).toBe(bron);
    }
  });

  it("buiten de alertteksten is er geen enkel verschil", () => {
    // Dit is de test die aantoont dat de afwijking nergens anders zit. We
    // vergelijken de volledige uitvoer, ongefilterd, en verzamelen elk pad
    // waarop iets verschilt. Er mag niets overblijven dat niet een
    // alerts.actief[..].boodschap is.
    const paden: string[] = [];
    function loop(a: any, b: any, pad: string) {
      if (a === b) return;
      if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
        if (a !== b) paden.push(pad);
        return;
      }
      const sleutels = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of sleutels) loop(a[k], b[k], `${pad}.${k}`);
    }
    for (const p of patronen) loop(draai(p), bevrorenUitkomst(p.naam), p.naam);

    const onverwacht = paden.filter((pad) => !/^[^.]+\.alerts\.actief\.\d+\.boodschap$/.test(pad));
    expect(onverwacht, `verschillen buiten de alertteksten:\n${onverwacht.join("\n")}`).toEqual([]);
    expect(paden.length, "er werd juist wel een verschil in de alertteksten verwacht")
      .toBeGreaterThan(0);
  });

  it("de motor is zuiver: tweemaal draaien geeft hetzelfde en de invoer blijft ongemoeid", () => {
    for (const p of patronen) {
      const voor = JSON.stringify(p.antwoorden);
      const een = JSON.stringify(draai(p));
      const twee = JSON.stringify(draai(p));
      expect(een, `${p.naam} levert twee verschillende uitkomsten`).toBe(twee);
      expect(JSON.stringify(p.antwoorden), `${p.naam} wijzigt zijn invoer`).toBe(voor);
    }
  });

  it("het contractnummer in de uitvoer is dat van het instrumentbestand", () => {
    for (const p of patronen) {
      expect(draai(p).contractVersion).toBe(T4STUDENTS_INSTRUMENT.scoringMap.scorerVersion);
    }
  });
});
