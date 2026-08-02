import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  T4KIDS_FOCI,
  T4KIDS_ARCHETYPEN,
  T4KIDS_INTERESSE_PAREN,
  type Focus,
} from "../server/t4kids/itembank";

// ---------------------------------------------------------------------------
// Ronde C, punt 6. De itembank noemde de 28 archetypen "gebalanceerd over 6
// foci". Geteld zijn het er 5-5-5-5-4-4: Overdracht-gericht en
// Artistiek-Creatief hebben er elk een minder. De itembank is bewust niet
// gewijzigd, want welke archetypen een kind voorgelegd krijgt is een
// inhoudelijke keuze. De beschrijving is aan de werkelijkheid aangepast.
//
// Deze test telt het echte aantal en houdt de beschrijving daaraan vast, zodat
// de tekst niet opnieuw kan gaan afwijken van de data.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");
const bron = readFileSync(path.join(wortel, "server/t4kids/itembank.ts"), "utf-8");

// Standaard sorteert JavaScript getallen als tekst, waardoor 9 achter 11 komt.
function getalOplopend(perFocus: Record<Focus, number>): number[] {
  return Object.values(perFocus).sort((a, b) => a - b);
}

function tel(foci: Focus[]): Record<Focus, number> {
  const uit = Object.fromEntries(T4KIDS_FOCI.map((f) => [f, 0])) as Record<Focus, number>;
  for (const f of foci) uit[f] += 1;
  return uit;
}

describe("T4Kids: de verdeling over de zes foci", () => {
  const perFocusArchetypen = tel(T4KIDS_ARCHETYPEN.map((a) => a.focus));
  const perFocusInteresse = tel(
    T4KIDS_INTERESSE_PAREN.flatMap((p) => [p.links.focus, p.rechts.focus]),
  );

  it("module 2 verdeelt 28 archetypen als 5-5-5-5-4-4 en niet gelijk", () => {
    expect(T4KIDS_ARCHETYPEN).toHaveLength(28);
    expect(getalOplopend(perFocusArchetypen)).toEqual([4, 4, 5, 5, 5, 5]);
    expect(perFocusArchetypen["Overdracht-gericht"]).toBe(4);
    expect(perFocusArchetypen["Artistiek-Creatief"]).toBe(4);
  });

  it("module 1 verdeelt 32 keuzekanten als 6-6-5-5-5-5", () => {
    expect(T4KIDS_INTERESSE_PAREN).toHaveLength(16);
    expect(getalOplopend(perFocusInteresse)).toEqual([5, 5, 5, 5, 6, 6]);
    expect(perFocusInteresse["Abstraherend"]).toBe(6);
    expect(perFocusInteresse["Sociaal-gericht"]).toBe(6);
  });

  it("het hoogst haalbare aantal punten verschilt per focus: 11, 10 of 9", () => {
    // Beide modules tellen op in dezelfde teller, dus de bovengrens per focus is
    // de som van beide. Dit is het getal dat in de kop van de itembank staat.
    const bovengrens = Object.fromEntries(
      T4KIDS_FOCI.map((f) => [f, perFocusInteresse[f] + perFocusArchetypen[f]]),
    ) as Record<Focus, number>;
    expect(getalOplopend(bovengrens)).toEqual([9, 9, 10, 10, 11, 11]);
    expect(bovengrens["Abstraherend"]).toBe(11);
    expect(bovengrens["Artistiek-Creatief"]).toBe(9);
  });

  it("de itembank noemt de verdeling niet langer gebalanceerd", () => {
    expect(bron).not.toMatch(/gebalanceerd/i);
    expect(bron).toContain("5-5-5-5-4-4");
    expect(bron).toContain("6-6-5-5-5-5");
  });
});
