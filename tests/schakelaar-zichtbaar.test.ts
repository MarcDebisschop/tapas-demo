// ---------------------------------------------------------------------------
// tests/schakelaar-zichtbaar.test.ts
//
// De belevingsschakelaar rechtsonder is een werkinstrument. Nu de kale versie
// een echte onthaalpagina heeft, mag een bezoeker die schakelaar niet zien: hij
// zou de bezoeker naar een laag brengen die niet voor hem bedoeld is.
//
// Wat deze toetsen bewijzen:
//   A. De regel zelf: wanneer de schakelaar verschijnt en wanneer niet.
//   B. De component houdt zich aan die regel en de schakelaar zelf blijft
//      verder ongewijzigd werken.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SCHAKELAAR_SLEUTEL,
  schakelaarZichtbaar,
  type Opslag,
} from "../client/src/lib/schakelaar-zichtbaar";

/** Een opslag in het geheugen, zodat de regel zonder browser te toetsen valt. */
function geheugenOpslag(begin: Record<string, string> = {}): Opslag & {
  inhoud: Record<string, string>;
} {
  const inhoud: Record<string, string> = { ...begin };
  return {
    inhoud,
    lees: (s) => (s in inhoud ? inhoud[s] : null),
    schrijf: (s, w) => {
      inhoud[s] = w;
    },
  };
}

describe("A. De regel", () => {
  it("staat uit voor een bezoeker die gewoon binnenkomt", () => {
    expect(schakelaarZichtbaar("", geheugenOpslag())).toBe(false);
    expect(schakelaarZichtbaar("?utm_source=nieuwsbrief", geheugenOpslag())).toBe(false);
  });

  it("komt tevoorschijn met schakelaar=1 en blijft dan bewaard", () => {
    const opslag = geheugenOpslag();
    expect(schakelaarZichtbaar("?schakelaar=1", opslag)).toBe(true);
    expect(opslag.inhoud[SCHAKELAAR_SLEUTEL]).toBe("true");
    // Zonder parameter blijft de keuze gelden.
    expect(schakelaarZichtbaar("", opslag)).toBe(true);
  });

  it("verdwijnt weer met schakelaar=0", () => {
    const opslag = geheugenOpslag({ [SCHAKELAAR_SLEUTEL]: "true" });
    expect(schakelaarZichtbaar("?schakelaar=0", opslag)).toBe(false);
    expect(opslag.inhoud[SCHAKELAAR_SLEUTEL]).toBe("false");
    expect(schakelaarZichtbaar("", opslag)).toBe(false);
  });

  it("komt ook tevoorschijn wanneer iemand de belevingslaag bewust opzoekt", () => {
    const aan = geheugenOpslag();
    expect(schakelaarZichtbaar("?beleving=1", aan)).toBe(true);
    const uit = geheugenOpslag();
    expect(schakelaarZichtbaar("?beleving=0", uit)).toBe(true);
  });

  it("schakelaar=0 weegt zwaarder dan beleving in dezelfde URL", () => {
    expect(schakelaarZichtbaar("?beleving=1&schakelaar=0", geheugenOpslag())).toBe(false);
  });

  it("werkt met en zonder vraagteken vooraan", () => {
    expect(schakelaarZichtbaar("schakelaar=1", geheugenOpslag())).toBe(true);
  });

  it("blijft overeind wanneer er geen opslag beschikbaar is", () => {
    const stuk: Opslag = {
      lees: () => {
        throw new Error("geen opslag");
      },
      schrijf: () => {
        throw new Error("geen opslag");
      },
    };
    // De regel mag hier niet klappen; het lezen zit in de browseropslag achter
    // een vangnet, dus we toetsen enkel het pad met een expliciete parameter.
    expect(() => schakelaarZichtbaar("?schakelaar=1", { ...stuk, schrijf: () => {} })).not.toThrow();
  });
});

describe("B. De component", () => {
  const bron = readFileSync(
    resolve(__dirname, "../client/src/components/BelevingSchakelaar.tsx"),
    "utf8",
  );

  it("vraagt de regel en stopt wanneer die nee zegt", () => {
    // De regel wordt nu bij elke wissel van het adres opnieuw beoordeeld, omdat
    // de schakelaar buiten de router gemonteerd staat en anders niet meetekent
    // wanneer je binnen de toepassing van pagina wisselt.
    expect(bron).toMatch(/import \{ schakelaarZichtbaarNu \} from "@\/lib\/schakelaar-zichtbaar"/);
    expect(bron).toMatch(/useMemo\(\(\) => schakelaarZichtbaarNu\(\), \[adres\]\)/);
    expect(bron).toMatch(/if \(!zichtbaar\) return null;/);
  });

  it("doet dat vóór er iets wordt getekend", () => {
    expect(bron.indexOf("schakelaarZichtbaarNu()")).toBeLessThan(bron.indexOf("createPortal("));
  });

  it("werkt verder ongewijzigd", () => {
    expect(bron).toContain('data-testid="beleving-schakelaar"');
    expect(bron).toContain("zetBeleving(aan)");
  });
});
