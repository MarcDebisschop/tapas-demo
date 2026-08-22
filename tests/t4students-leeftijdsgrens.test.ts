import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  T4STUDENTS_DOELGROEP,
  T4STUDENTS_LEEFTIJDSBEREIK,
  T4STUDENTS_LEEFTIJDSTEKST,
  T4STUDENTS_LEEFTIJDSTEKST_VOLUIT,
} from "../shared/doelgroep-leeftijd";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { getDescriptor } from "../server/registry";
import { vindInstrumentServer } from "../server/gids/data";
import { TEMPLATES } from "../server/bulk-import/templates";

// ---------------------------------------------------------------------------
// De doelgroepgrens van T4Students komt uit een enkele bron.
//
// WAT DEZE TEST AFDWINGT
// De vastgelegde doelgroep is 17 tot 23 jaar. Die twee getallen staan in
// shared/doelgroep-leeftijd.ts en nergens anders. Elke plaats die de leeftijd
// aan een lezer toont, leest hem daar: het register, de gids op de server en in
// de client, en de titel van het invoersjabloon.
//
// WAT DEZE TEST NIET BEWEERT
// Er is geen leeftijdsonderzoek dat deze grens onderbouwt. Meetinvariantie over
// leeftijd is niet onderzocht, dus of de items voor een zeventienjarige en een
// drieentwintigjarige hetzelfde betekenen is onbekend. De grens is een
// ontwerpconventie. Deze test toetst enkel dat er over die conventie op geen
// enkele plaats een ander getal staat.
//
// DE ONDERGRENS BLIJFT EEN OPEN PUNT
// Zeventien valt zowel binnen T4Teens als binnen T4Students, en de
// leeftijdspoort wordt voor T4Students niet toegepast. Dat is met deze grens
// niet opgelost; het staat vast in tests/t4students-doelgroep-ondergrens.test.ts.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");

function bronbestanden(): string[] {
  const gevonden: string[] = [];
  const overslaan = new Set(["node_modules", ".git", "dist", "tests", "public"]);
  (function loop(map: string) {
    for (const naam of readdirSync(map)) {
      if (overslaan.has(naam)) continue;
      const pad = path.join(map, naam);
      if (statSync(pad).isDirectory()) loop(pad);
      else if (/\.(ts|tsx|md)$/.test(naam)) gevonden.push(pad);
    }
  })(wortel);
  return gevonden;
}

describe("T4Students: de doelgroepgrens komt uit een enkele bron", () => {
  it("de vastgelegde grens is 17 tot 23 jaar", () => {
    expect(T4STUDENTS_DOELGROEP.minLeeftijd).toBe(17);
    expect(T4STUDENTS_DOELGROEP.maxLeeftijd).toBe(23);
  });

  it("de teksten zijn afgeleid en niet apart opgeschreven", () => {
    expect(T4STUDENTS_LEEFTIJDSBEREIK).toBe("17-23");
    expect(T4STUDENTS_LEEFTIJDSTEKST).toBe("17-23 jaar");
    expect(T4STUDENTS_LEEFTIJDSTEKST_VOLUIT).toBe("17 tot 23 jaar");
  });

  it("het register, de gids en het invoersjabloon tonen diezelfde grens", () => {
    expect(getDescriptor("t4students")!.description).toContain(
      T4STUDENTS_LEEFTIJDSTEKST_VOLUIT,
    );

    const gids = vindInstrumentServer("t4students")!;
    expect(gids.doelgroep).toContain(T4STUDENTS_LEEFTIJDSTEKST_VOLUIT);
    expect(gids.leeftijdsfocus).toBe(T4STUDENTS_LEEFTIJDSTEKST_VOLUIT);

    expect(TEMPLATES.t4students.titel).toContain(T4STUDENTS_LEEFTIJDSTEKST_VOLUIT);
  });

  it("het databestand van het instrument noemt de bovengrens niet meer open", () => {
    // Het gegevensbestand is statische JSON en kan de bron niet importeren.
    // Daarom staat de leeftijd daar als tekst, maar wel als hetzelfde bereik en
    // zonder het open einde dat er eerder stond.
    expect(T4STUDENTS_INSTRUMENT.description).toContain("17-23");
    expect(T4STUDENTS_INSTRUMENT.description).not.toContain("25");
  });

  it("geen enkel bronbestand noemt nog de oude bovengrens", () => {
    // De oude teksten waren "17-25+", "17 tot 25 jaar en ouder" en
    // "17 tot 25 jaar". Het lange en het korte streepje staan beide in het
    // patroon omdat de oude teksten door elkaar gebruikt werden.
    const oud = /17\s*(?:[-\u2013\u2014]|tot(?:\s+en\s+met)?)\s*(?:25|24)/;
    const treffers = bronbestanden()
      .map((pad) => path.relative(wortel, pad))
      // De bron zelf mag de oude grens noemen: daar staat opgeschreven wat er
      // vroeger stond en waarom er nu een grens gekozen is.
      .filter((pad) => pad !== path.join("shared", "doelgroep-leeftijd.ts"))
      .filter((pad) => oud.test(readFileSync(path.join(wortel, pad), "utf-8")));
    expect(treffers, `oude leeftijdsgrens gevonden in:\n${treffers.join("\n")}`).toEqual([]);
  });
});
