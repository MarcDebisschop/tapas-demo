import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { bepaalLijntoestand } from "../server/traject/afleiding";
import { seedDemonstratietraject } from "../server/traject/demo";
import { maakTrajectOpslag } from "../server/traject/storage";

const migratie = readFileSync(
  "migrations/0002_clammy_talisman.sql",
  "utf8",
).replaceAll("--> statement-breakpoint", "");

function maakDatabank(): Database.Database {
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
  `);
  databank.exec(migratie);
  databank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(1, null, 1);
  return databank;
}

describe("demonstratietraject van de Regiekamer", () => {
  let databank: Database.Database;
  let opslag: ReturnType<typeof maakTrajectOpslag>;

  beforeEach(() => {
    databank = maakDatabank();
    opslag = maakTrajectOpslag(databank, () => undefined);
  });

  it("doet niets wanneer de demonstratiemodus niet actief is", async () => {
    await seedDemonstratietraject(
      {
        listBeheerders: async () => {
          throw new Error("Deze opslag mag niet worden geraadpleegd.");
        },
        listOrganisaties: async () => {
          throw new Error("Deze opslag mag niet worden geraadpleegd.");
        },
        createOrganisatie: async () => {
          throw new Error("Deze opslag mag niet worden geraadpleegd.");
        },
      } as any,
      opslag,
      () => false,
    );

    expect(opslag.haalTrajectenVoorBeheerder(1)).toEqual([]);
  });

  it("maakt een apart, idempotent demonstratietraject met uiteenlopende Regiekamergegevens", async () => {
    const organisaties: Array<{ id: number; naam: string }> = [];
    const platform = {
      listBeheerders: async () => [{ id: 1, actief: true, isPrior: true }],
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

    await seedDemonstratietraject(platform as any, opslag, () => true);
    await seedDemonstratietraject(platform as any, opslag, () => true);

    const trajecten = opslag.haalTrajectenVoorBeheerder(1);
    expect(trajecten).toHaveLength(1);
    expect(trajecten[0]!.naam).toBe("DEMO - Overname Asterra Machines");
    const volledig = opslag.haalTrajectOp(trajecten[0]!.id, 1);
    expect(volledig.partijen).toHaveLength(5);
    expect(volledig.lijnen).toHaveLength(5);
    expect(volledig.gebeurtenissen).toHaveLength(9);
    expect(volledig.vragen.map((vraag) => vraag.toestand).sort()).toEqual([
      "beantwoord",
      "erkend",
      "gesteld",
      "in_behandeling",
    ]);
    const toestanden = volledig.lijnen.map((lijn) =>
      bepaalLijntoestand({
        nu: Date.now(),
        trajectAangemaaktOp: volledig.traject.aangemaaktOp,
        stiltedrempelDagen: lijn.stiltedrempelDagen,
        gebeurtenissen: volledig.gebeurtenissen.filter(
          (gebeurtenis) => gebeurtenis.lijnId === lijn.id,
        ),
        vragen: volledig.vragen.filter((vraag) => vraag.lijnId === lijn.id),
      }),
    );
    expect(new Set(toestanden)).toEqual(
      new Set(["aandacht", "lopend", "stil", "in_orde"]),
    );
  });
});
