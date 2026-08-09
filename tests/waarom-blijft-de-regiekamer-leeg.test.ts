/**
 * tests/waarom-blijft-de-regiekamer-leeg.test.ts
 *
 * Waarom deze test bestaat.
 *
 * De Regiekamer bleef op de echte omgeving leeg. Er zijn precies twee redenen
 * mogelijk, en van buitenaf waren ze niet uit elkaar te houden:
 *
 *   1. De omgeving vraagt helemaal niet om een voorbeelddossier. Dan staat de
 *      schakelaar niet goed en moet die gezet worden.
 *   2. De omgeving vraagt er wel om, maar er is geen beheerder die het dossier
 *      zou kunnen zien. Dan helpt de schakelaar niets en ligt het elders.
 *
 * Zonder dat onderscheid blijft er alleen gissen over. Het gezondheidsvenster
 * antwoordt daarom voortaan op beide vragen. Deze test legt vast dat het die
 * twee antwoorden geeft en dat het geen enkel gegeven over mensen prijsgeeft.
 */

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  VOORBEELDDOSSIER_SCHAKELAAR,
  VOORBEELDDOSSIER_TRAJECTNAAM,
  beschrijfVoorbeelddossier,
} from "../server/voorbeelddossier";

describe("het gezondheidsvenster zegt waarom de Regiekamer leeg is", () => {
  const bewaardeOmgeving = { ...process.env };

  afterEach(() => {
    process.env = { ...bewaardeOmgeving };
  });

  it("meldt dat de omgeving niet om een voorbeelddossier vraagt", () => {
    process.env.NODE_ENV = "production";
    delete process.env[VOORBEELDDOSSIER_SCHAKELAAR];
    delete process.env.TAPAS_DEMO;

    expect(beschrijfVoorbeelddossier(() => 0)).toEqual({
      gevraagd: false,
      aanwezig: false,
    });
  });

  it("meldt gevraagd maar afwezig wanneer het dossier niet opgebouwd raakte", () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";

    expect(beschrijfVoorbeelddossier(() => 0)).toEqual({
      gevraagd: true,
      aanwezig: false,
    });
  });

  it("meldt gevraagd en aanwezig wanneer het dossier er wel staat", () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";

    expect(beschrijfVoorbeelddossier(() => 1)).toEqual({
      gevraagd: true,
      aanwezig: true,
    });
  });

  it("blijft antwoorden wanneer de databank niet te bevragen valt", () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";

    expect(
      beschrijfVoorbeelddossier(() => {
        throw new Error("de tabel bestaat nog niet");
      }),
    ).toEqual({ gevraagd: true, aanwezig: false });
  });

  it("telt enkel het voorbeelddossier en niet elk willekeurig dossier", () => {
    const bron = readFileSync("server/voorbeelddossier.ts", "utf8");

    expect(bron).toContain(VOORBEELDDOSSIER_TRAJECTNAAM);
  });

  it("laat de demonstratiegegevens diezelfde ene naam gebruiken", () => {
    const bron = readFileSync("server/traject/demo.ts", "utf8");

    expect(
      bron,
      "schrijft de naam een tweede keer uit, dan kunnen de twee uiteenlopen",
    ).toContain("VOORBEELDDOSSIER_TRAJECTNAAM");
    expect(bron).not.toContain(`"${VOORBEELDDOSSIER_TRAJECTNAAM}"`);
  });
});

describe("het gezondheidsvenster geeft niets prijs over mensen", () => {
  const bewaardeOmgeving = { ...process.env };

  afterEach(() => {
    process.env = { ...bewaardeOmgeving };
  });

  it("geeft enkel twee ja-of-nee-antwoorden terug", () => {
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";
    const uitkomst = beschrijfVoorbeelddossier(() => 1);

    expect(Object.keys(uitkomst).sort()).toEqual(["aanwezig", "gevraagd"]);
    for (const waarde of Object.values(uitkomst)) {
      expect(typeof waarde).toBe("boolean");
    }
  });
});

describe("het venster wordt ook werkelijk uitgeserveerd", () => {
  it("neemt het antwoord op in het gezondheidsvenster", () => {
    const bron = readFileSync("server/index.ts", "utf8");

    expect(
      bron,
      "zonder deze regel blijft het antwoord onzichtbaar van buitenaf",
    ).toContain("beschrijfVoorbeelddossier");
  });
});
