import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { bepaalLijntoestand } from "../server/traject/afleiding";
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
    .run(1, null, 1);
  return databank;
}

const DAG = 24 * 60 * 60 * 1000;

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
  it("zet voor de zes werkstromen een geloofwaardige stand", async () => {
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

    const trajectId = opslag.haalTrajectenVoorBeheerder(1)[0]!.id;
    const werkstromen = opslag.haalTrajectOp(trajectId, 1).werkstromen;
    const perNaam = new Map(
      werkstromen.map((werkstroom) => [werkstroom.naam, werkstroom]),
    );
    const dagenTot = (waarde: string | null) =>
      Math.round((Date.parse(waarde!) - Date.now()) / DAG);

    expect(perNaam.get("financieel")!.status).toBe("lopend");
    expect(dagenTot(perNaam.get("financieel")!.eerstvolgendeOpleveringOp)).toBe(6);
    expect(perNaam.get("juridisch")!.status).toBe("lopend");
    expect(dagenTot(perNaam.get("juridisch")!.eerstvolgendeOpleveringOp)).toBe(12);
    expect(perNaam.get("fiscaal")!.status).toBe("niet_gestart");
    expect(perNaam.get("fiscaal")!.eerstvolgendeOplevering).toBeNull();
    expect(perNaam.get("fiscaal")!.eerstvolgendeOpleveringOp).toBeNull();
    expect(perNaam.get("commercieel")!.status).toBe("geblokkeerd");
    expect(perNaam.get("commercieel")!.eerstvolgendeOpleveringOp).toBeNull();
    expect(perNaam.get("technisch")!.status).toBe("lopend");
    expect(dagenTot(perNaam.get("technisch")!.eerstvolgendeOpleveringOp)).toBe(20);
    expect(perNaam.get("menselijk")!.status).toBe("afgerond");
    expect(perNaam.get("menselijk")!.eerstvolgendeOpleveringOp).toBeNull();
    for (const werkstroom of werkstromen) {
      if (werkstroom.eerstvolgendeOpleveringOp !== null) {
        expect(werkstroom.eerstvolgendeOplevering).toBeTruthy();
      }
    }
    expect(new Set(werkstromen.map((werkstroom) => werkstroom.status))).toEqual(
      new Set(["niet_gestart", "lopend", "geblokkeerd", "afgerond"]),
    );
  });

  it("zet in het demonstratiedossier personen met rollen en geeft elke gebeurtenis een auteur", async () => {
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

    const trajectId = opslag.haalTrajectenVoorBeheerder(1)[0]!.id;
    const personen = opslag.haalPersonenVanTraject(trajectId, 1);
    const rollenVan = (naam: string) =>
      personen
        .find((persoon) => persoon.naam === naam)!
        .rollen.map((rol) => rol.rol);

    expect(personen.length).toBeGreaterThanOrEqual(6);
    // Een facilitator zonder partij, want wie belang heeft kan het gesprek niet
    // leiden.
    const facilitator = personen.find((persoon) =>
      persoon.rollen.some((rol) => rol.rol === "facilitator"),
    )!;
    expect(facilitator.partijId).toBeNull();
    expect(facilitator.kring).toBeNull();
    // Een ankerpunt aan beide kanten.
    expect(
      personen.filter((persoon) =>
        persoon.rollen.some((rol) => rol.rol === "ankerpunt_investeerder"),
      ),
    ).toHaveLength(1);
    expect(
      personen.filter((persoon) =>
        persoon.rollen.some((rol) => rol.rol === "ankerpunt_onderneming"),
      ),
    ).toHaveLength(1);
    // Een leider voor elk van de zes werkstromen.
    const werkstromen = opslag.haalTrajectOp(trajectId, 1).werkstromen;
    const geleideWerkstromen = new Set(
      personen
        .flatMap((persoon) => persoon.rollen)
        .filter((rol) => rol.rol === "werkstroomleider")
        .map((rol) => rol.werkstroomId),
    );
    expect(geleideWerkstromen.size).toBe(werkstromen.length);
    // Een adviseur en een betrokkene.
    expect(
      personen.filter((persoon) =>
        persoon.rollen.some((rol) => rol.rol === "adviseur"),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      personen.filter((persoon) =>
        persoon.rollen.some((rol) => rol.rol === "betrokkene"),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(rollenVan(facilitator.naam)).toEqual(["facilitator"]);

    // Elke gebeurtenis heeft een auteur, anders schermt de indruk in de demo
    // niets af maar verdwijnt hij bij iedereen.
    const volledig = opslag.haalTrajectOp(trajectId, 1);
    expect(volledig.gebeurtenissen).toHaveLength(9);
    for (const gebeurtenis of volledig.gebeurtenissen) {
      expect(
        gebeurtenis.vastgelegdDoorPersoonId,
        gebeurtenis.vaststelling,
      ).not.toBeNull();
    }
    const auteurs = new Set(
      volledig.gebeurtenissen.map(
        (gebeurtenis) => gebeurtenis.vastgelegdDoorPersoonId,
      ),
    );
    expect(auteurs.size).toBeGreaterThanOrEqual(3);
  });

  it("bouwt het demonstratiedossier tweemaal op zonder te breken op de uniciteitsregels", async () => {
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
    const trajectId = opslag.haalTrajectenVoorBeheerder(1)[0]!.id;
    const eerstePersonen = opslag.haalPersonenVanTraject(trajectId, 1);
    const eersteAuteurs = opslag
      .haalTrajectOp(trajectId, 1)
      .gebeurtenissen.map((gebeurtenis) => gebeurtenis.vastgelegdDoorPersoonId);

    await seedDemonstratietraject(platform as any, opslag, () => true);
    await seedDemonstratietraject(platform as any, opslag, () => true);

    expect(opslag.haalTrajectenVoorBeheerder(1)).toHaveLength(1);
    const tweedePersonen = opslag.haalPersonenVanTraject(trajectId, 1);
    expect(tweedePersonen).toHaveLength(eerstePersonen.length);
    expect(
      tweedePersonen.flatMap((persoon) => persoon.rollen).length,
    ).toBe(eerstePersonen.flatMap((persoon) => persoon.rollen).length);
    expect(
      opslag
        .haalTrajectOp(trajectId, 1)
        .gebeurtenissen.map(
          (gebeurtenis) => gebeurtenis.vastgelegdDoorPersoonId,
        ),
    ).toEqual(eersteAuteurs);
  });
});
