// Borgt de vaste bladstructuur van het energetisch teamprofiel.
// Het goedgekeurde rapport heeft bij 5 deelnemers 10 bladen. Deze test bestaat
// zodat het teamrapport nooit meer stil kan terugvallen op minder bladen.

import { describe, expect, it } from "vitest";

import {
  BLADEN,
  DEELNEMERS_PER_BLAD,
  bladenVoor,
  individueleBladen,
  type BladSoort,
} from "../client/src/temperamentenwiel/bladen";

describe("bladstructuur van het teamrapport", () => {
  it("houdt de vaste orde van de negen basisbladen aan", () => {
    expect(BLADEN).toEqual([
      "cover",
      "leeswijzer",
      "teamwiel",
      "deelnemers",
      "individueel",
      "dynamiek",
      "kleuren",
      "overleg",
      "slot",
    ]);
  });

  it("levert bij vijf deelnemers tien bladen, zoals het goedgekeurde rapport", () => {
    const bladen = bladenVoor(5);
    expect(bladen).toHaveLength(10);
    expect(bladen.filter((b) => b === "individueel")).toHaveLength(2);
  });

  it("groepeert de individuele bladen per drie deelnemers", () => {
    expect(DEELNEMERS_PER_BLAD).toBe(3);
    expect(individueleBladen(1)).toBe(1);
    expect(individueleBladen(3)).toBe(1);
    expect(individueleBladen(4)).toBe(2);
    expect(individueleBladen(6)).toBe(2);
    expect(individueleBladen(7)).toBe(3);
  });

  it("schaalt mee met het aantal deelnemers", () => {
    expect(bladenVoor(3)).toHaveLength(9);
    expect(bladenVoor(7)).toHaveLength(11);
    expect(bladenVoor(12)).toHaveLength(12);
  });

  it("gebruikt elk bladsoort minstens één keer", () => {
    const bladen = new Set<BladSoort>(bladenVoor(5));
    for (const soort of BLADEN) {
      expect(bladen.has(soort)).toBe(true);
    }
  });

  it("begint met de cover en eindigt met het slotblad", () => {
    for (const aantal of [1, 2, 5, 9]) {
      const bladen = bladenVoor(aantal);
      expect(bladen[0]).toBe("cover");
      expect(bladen[bladen.length - 1]).toBe("slot");
    }
  });
});
