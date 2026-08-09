/**
 * tests/voorbeelddossier-ook-in-productie.test.ts
 *
 * Waarom deze test bestaat.
 *
 * De Regiekamer bleef op de echte omgeving leeg. De oorzaak lag niet in de
 * Regiekamer zelf maar in de schakelaar ervoor: het voorbeelddossier hing aan
 * dezelfde schakelaar die de wachtwoordcontrole uitzet. Die schakelaar is in
 * productie met opzet onmogelijk gemaakt, en dus werd het voorbeelddossier daar
 * nooit aangemaakt.
 *
 * Twee dingen die niets met elkaar te maken hebben zaten dus aan een knop:
 *
 *   1. De wachtwoordcontrole overslaan. Dat mag nooit in productie.
 *   2. Een herkenbaar voorbeelddossier tonen. Dat is onschuldig en mag overal.
 *
 * Deze test legt vast dat die twee uit elkaar liggen, en dat de eerste onder
 * geen enkele omstandigheid meebeweegt met de tweede.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { isDemoModus } from "../server/demomodus";
import {
  VOORBEELDDOSSIER_SCHAKELAAR,
  voorbeelddossierGevraagd,
} from "../server/voorbeelddossier";
import { seedDemonstratietraject } from "../server/traject/demo";
import { maakTrajectOpslag } from "../server/traject/storage";

const migratie = [
  "migrations/0002_clammy_talisman.sql",
  "migrations/0003_smiling_shape.sql",
  "migrations/0004_supreme_freak.sql",
  "migrations/0005_soorten_gebeurtenis.sql",
]
  .map((pad) => readFileSync(pad, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

function maakDatabank(priorAanwezig: boolean): Database.Database {
  const databank = new Database(":memory:");
  databank.pragma("foreign_keys = ON");
  databank.exec(`
    CREATE TABLE organisaties (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
    );
    CREATE TABLE beheerders (
      id INTEGER PRIMARY KEY,
      organisatie_id INTEGER,
      is_prior INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE deelnemers (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
    );
  `);
  databank.exec(migratie);
  databank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(1, null, priorAanwezig ? 1 : 0);
  return databank;
}

function maakPlatform(
  databank: Database.Database,
  beheerders: ReadonlyArray<{
    id: number;
    actief: boolean;
    isPrior: boolean;
    organisatieId?: number | null;
  }>,
) {
  const organisaties: Array<{ id: number; naam: string }> = [];
  return {
    listBeheerders: async () => beheerders,
    listOrganisaties: async () => organisaties,
    createOrganisatie: async (invoer: { naam: string }) => {
      const uitkomst = databank
        .prepare("INSERT INTO organisaties (naam) VALUES (?)")
        .run(invoer.naam);
      const organisatie = {
        id: Number(uitkomst.lastInsertRowid),
        naam: invoer.naam,
      };
      organisaties.push(organisatie);
      return organisatie;
    },
  };
}

describe("het voorbeelddossier staat los van de wachtwoordcontrole", () => {
  const bewaardeOmgeving = { ...process.env };

  afterEach(() => {
    process.env = { ...bewaardeOmgeving };
  });

  it("is standaard uit, zodat een gewone omgeving geen verzonnen gegevens krijgt", () => {
    delete process.env[VOORBEELDDOSSIER_SCHAKELAAR];
    delete process.env.TAPAS_DEMO;
    process.env.NODE_ENV = "production";

    expect(voorbeelddossierGevraagd()).toBe(false);
  });

  it("staat aan in productie zodra de eigen schakelaar gezet is", () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";

    expect(voorbeelddossierGevraagd()).toBe(true);
  });

  it("laat de wachtwoordcontrole ongemoeid, ook met de eigen schakelaar aan", () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";

    expect(isDemoModus()).toBe(false);
  });

  it("staat ook aan wanneer enkel de oude demonstratiemodus actief is", () => {
    process.env.NODE_ENV = "development";
    process.env.TAPAS_DEMO = "1";
    delete process.env[VOORBEELDDOSSIER_SCHAKELAAR];

    expect(voorbeelddossierGevraagd()).toBe(true);
  });

  it("aanvaardt enkel de waarde een, niet zomaar elke ingevulde waarde", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TAPAS_DEMO;
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "graag";

    expect(voorbeelddossierGevraagd()).toBe(false);
  });
});

describe("het voorbeelddossier wordt in productie wel degelijk opgebouwd", () => {
  const bewaardeOmgeving = { ...process.env };
  let databank: Database.Database;
  let opslag: ReturnType<typeof maakTrajectOpslag>;

  beforeEach(() => {
    databank = maakDatabank(true);
    opslag = maakTrajectOpslag(databank, () => undefined);
  });

  afterEach(() => {
    process.env = { ...bewaardeOmgeving };
  });

  it("bouwt het dossier op met NODE_ENV op productie en de eigen schakelaar aan", async () => {
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";
    delete process.env.TAPAS_DEMO;

    const platform = maakPlatform(databank, [
      { id: 1, actief: true, isPrior: true },
    ]);

    // Bewust zonder derde argument: de standaardvoorwaarde moet zelf al kloppen.
    await seedDemonstratietraject(platform as any, opslag);

    const trajecten = opslag.haalTrajectenVoorBeheerder(1);
    expect(
      trajecten,
      "de Regiekamer blijft leeg in productie",
    ).toHaveLength(1);
    expect(trajecten[0]!.naam).toBe("DEMO - Overname Asterra Machines");
  });

  it("bouwt niets op wanneer geen van beide schakelaars gezet is", async () => {
    process.env.NODE_ENV = "production";
    delete process.env[VOORBEELDDOSSIER_SCHAKELAAR];
    delete process.env.TAPAS_DEMO;

    const platform = maakPlatform(databank, [
      { id: 1, actief: true, isPrior: true },
    ]);

    await seedDemonstratietraject(platform as any, opslag);

    expect(opslag.haalTrajectenVoorBeheerder(1)).toEqual([]);
  });
});

describe("het voorbeelddossier komt terecht waar het ook gezien wordt", () => {
  const bewaardeOmgeving = { ...process.env };
  let databank: Database.Database;
  let opslag: ReturnType<typeof maakTrajectOpslag>;

  /** Zet een beheerder in de databank en geeft zijn organisatienummer terug. */
  function zetBeheerder(
    id: number,
    organisatieNaam: string | null,
    isPrior: boolean,
  ): number | null {
    let organisatieId: number | null = null;
    if (organisatieNaam !== null) {
      organisatieId = Number(
        databank
          .prepare("INSERT INTO organisaties (naam) VALUES (?)")
          .run(organisatieNaam).lastInsertRowid,
      );
    }
    databank
      .prepare(
        "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
      )
      .run(id, organisatieId, isPrior ? 1 : 0);
    return organisatieId;
  }

  beforeEach(() => {
    databank = maakDatabank(false);
    opslag = maakTrajectOpslag(databank, () => undefined);
    process.env.NODE_ENV = "production";
    process.env[VOORBEELDDOSSIER_SCHAKELAAR] = "1";
  });

  afterEach(() => {
    process.env = { ...bewaardeOmgeving };
  });

  it("zet het dossier in de eigen organisatie van een beheerder zonder priorstatus", async () => {
    // Beheerder 1 staat al zonder organisatie in de databank; beheerder 2 krijgt
    // er wel een. Een beheerder zonder priorstatus mag enkel dossiers van zijn
    // eigen organisatie zien, dus daar hoort het voorbeelddossier te staan.
    const organisatieId = zetBeheerder(2, "Kantoor Noord", false);

    const platform = maakPlatform(databank, [
      { id: 2, actief: true, isPrior: false, organisatieId },
    ]);

    await seedDemonstratietraject(platform as any, opslag);

    const trajecten = opslag.haalTrajectenVoorBeheerder(2);
    expect(
      trajecten,
      "zonder prior blijft de Regiekamer stil leeg",
    ).toHaveLength(1);
    expect(trajecten[0]!.organisatieId).toBe(organisatieId);
  });

  it("kiest de prior wanneer die er is, ook als een andere beheerder eerst staat", async () => {
    const organisatieId = zetBeheerder(2, "Kantoor Noord", false);
    zetBeheerder(3, null, true);

    const platform = maakPlatform(databank, [
      { id: 2, actief: true, isPrior: false, organisatieId },
      { id: 3, actief: true, isPrior: true, organisatieId: null },
    ]);

    await seedDemonstratietraject(platform as any, opslag);

    expect(opslag.haalTrajectenVoorBeheerder(3)).toHaveLength(1);
  });

  it("slaat een beheerder over die niet actief is", async () => {
    const organisatieId = zetBeheerder(2, "Kantoor Noord", false);

    const platform = maakPlatform(databank, [
      { id: 1, actief: false, isPrior: true, organisatieId: null },
      { id: 2, actief: true, isPrior: false, organisatieId },
    ]);

    await seedDemonstratietraject(platform as any, opslag);

    expect(opslag.haalTrajectenVoorBeheerder(2)).toHaveLength(1);
  });

  it("maakt niets aan wanneer geen enkele beheerder het dossier zou kunnen zien", async () => {
    // Enkel een actieve beheerder zonder priorstatus en zonder organisatie. Een
    // dossier zou hier voor niemand zichtbaar zijn; dan is niets aanmaken beter
    // dan gegevens die nergens verschijnen.
    const platform = maakPlatform(databank, [
      { id: 1, actief: true, isPrior: false, organisatieId: null },
    ]);

    await seedDemonstratietraject(platform as any, opslag);

    expect(
      databank.prepare("SELECT COUNT(*) AS aantal FROM traject").get(),
    ).toEqual({ aantal: 0 });
  });
});

describe("de omgeving van Render vraagt het voorbeelddossier op", () => {
  it("zet de schakelaar in render.yaml", () => {
    const opgave = readFileSync("render.yaml", "utf8");

    expect(
      opgave,
      "zonder deze regel blijft de Regiekamer op Render leeg",
    ).toContain(VOORBEELDDOSSIER_SCHAKELAAR);
  });

  it("zet de wachtwoordschakelaar niet in render.yaml", () => {
    const opgave = readFileSync("render.yaml", "utf8");
    const regelsMetWaarde = opgave
      .split("\n")
      .filter((regel) => !regel.trim().startsWith("#"))
      .join("\n");

    expect(regelsMetWaarde).not.toContain("TAPAS_DEMO=1");
    expect(regelsMetWaarde).not.toMatch(/key:\s*TAPAS_DEMO\s*$/m);
  });
});
