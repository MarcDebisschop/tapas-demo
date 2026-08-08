import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { maakTrajectOpslag } from "../server/traject/storage";
import { trajectGebeurtenissen } from "../server/traject/schema";

/**
 * Een gebeurtenis moet kunnen zeggen wie ze vastlegde. Zonder die auteur kan de
 * rechtenmodule niet beslissen wie de indruk mag zien. Deze tests bewijzen dat
 * de kolom in de databank staat, dat ze leeg mag blijven, dat ze alleen naar een
 * persoon van hetzelfde traject kan wijzen, en dat de opslaglaag de auteur
 * meeneemt.
 */

function leesMigraties(): string {
  const bestanden = readdirSync("migrations")
    .filter((naam) => naam.endsWith(".sql"))
    .sort();
  return bestanden
    .filter((naam) => {
      const inhoud = readFileSync(`migrations/${naam}`, "utf8");
      return (
        inhoud.includes("traject_fasen") ||
        inhoud.includes("traject_personen") ||
        inhoud.includes("traject_rollen") ||
        inhoud.includes("traject_gebeurtenissen")
      );
    })
    .map((naam) => readFileSync(`migrations/${naam}`, "utf8"))
    .join("\n")
    .replaceAll("--> statement-breakpoint", "");
}

const migraties = leesMigraties();

function maakProefdatabank(): Database.Database {
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
  databank.exec(migraties);
  databank.prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)").run(1, "Noordbeek");
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(10, 1, 0);
  databank
    .prepare(
      `INSERT INTO traject (id, naam, organisatie_id, aangemaakt_door_beheerder_id,
         huidige_fase, zekerheidstrap, status, aangemaakt_op)
       VALUES (1, 'Overname Noordbeek', 1, 10, 1, 1, 'open', 1000),
              (2, 'Ander dossier', 1, 10, 1, 1, 'open', 1000)`,
    )
    .run();
  databank
    .prepare(
      `INSERT INTO traject_partijen (id, traject_id, soort, naam, ankerpunt, kring, rol)
       VALUES (1, 1, 'onderneming', 'Asterra Machines', 'Sofie Van Loon', 0, 'ankerpunt_onderneming'),
              (2, 1, 'investeerder', 'Kaaidok Partners', 'Bram Peeters', 0, 'ankerpunt_investeerder')`,
    )
    .run();
  databank
    .prepare(
      `INSERT INTO traject_lijnen (id, traject_id, partij_een_id, partij_twee_id,
         stiltedrempel_dagen, aangemaakt_op)
       VALUES (1, 1, 1, 2, 7, 1000)`,
    )
    .run();
  databank
    .prepare(
      `INSERT INTO traject_personen (id, traject_id, partij_id, naam, email, actief, aangemaakt_op)
       VALUES (1, 1, 1, 'Sofie Van Loon', 'sofie@asterra.be', 1, 1000),
              (2, 2, NULL, 'Iemand elders', 'elders@voorbeeld.be', 1, 1000)`,
    )
    .run();
  return databank;
}

describe("De auteur van een gebeurtenis", () => {
  it("staat als kolom in het schema van de gebeurtenissen", () => {
    expect(trajectGebeurtenissen.vastgelegdDoorPersoonId).toBeDefined();
    expect(trajectGebeurtenissen.vastgelegdDoorPersoonId.name).toBe(
      "vastgelegd_door_persoon_id",
    );
    expect(trajectGebeurtenissen.vastgelegdDoorPersoonId.notNull).toBe(false);
  });

  it("staat als kolom in de databank en mag leeg blijven", () => {
    const databank = maakProefdatabank();
    const kolommen = databank
      .prepare("PRAGMA table_info(traject_gebeurtenissen)")
      .all() as Array<{ name: string; notnull: number }>;
    const kolom = kolommen.find((rij) => rij.name === "vastgelegd_door_persoon_id");
    expect(kolom).toBeDefined();
    expect(kolom?.notnull).toBe(0);

    databank
      .prepare(
        `INSERT INTO traject_gebeurtenissen (traject_id, lijn_id, tijdstip, soort,
           vaststelling, indruk)
         VALUES (1, 1, 2000, 'gesprek', 'Kennismaking gehouden.', 'Voelde stroef aan.')`,
      )
      .run();
    const rij = databank
      .prepare(
        "SELECT vastgelegd_door_persoon_id FROM traject_gebeurtenissen ORDER BY id DESC LIMIT 1",
      )
      .get() as { vastgelegd_door_persoon_id: number | null };
    expect(rij.vastgelegd_door_persoon_id).toBeNull();
    databank.close();
  });

  it("weigert een auteur die geen bestaande persoon is", () => {
    const databank = maakProefdatabank();
    expect(() =>
      databank
        .prepare(
          `INSERT INTO traject_gebeurtenissen (traject_id, lijn_id, tijdstip, soort,
             vaststelling, indruk, vastgelegd_door_persoon_id)
           VALUES (1, 1, 2000, 'gesprek', 'Kennismaking gehouden.', '', 999)`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);
    databank.close();
  });

  it("legt via de opslaglaag de auteur vast wanneer die meegegeven wordt", () => {
    const databank = maakProefdatabank();
    const opslag = maakTrajectOpslag(databank, () => {});
    const gebeurtenis = opslag.voegGebeurtenisToe({
      trajectId: 1,
      beheerderId: 10,
      lijnId: 1,
      tijdstip: 2000,
      soort: "gesprek",
      vaststelling: "Kennismaking gehouden.",
      indruk: "Voelde stroef aan.",
      vastgelegdDoorPersoonId: 1,
    });
    expect(gebeurtenis.vastgelegdDoorPersoonId).toBe(1);
    databank.close();
  });

  it("laat een bestaande aanroep zonder auteur gewoon werken", () => {
    const databank = maakProefdatabank();
    const opslag = maakTrajectOpslag(databank, () => {});
    const gebeurtenis = opslag.voegGebeurtenisToe({
      trajectId: 1,
      beheerderId: 10,
      lijnId: 1,
      tijdstip: 2000,
      soort: "bericht",
      vaststelling: "Bericht verstuurd.",
    });
    expect(gebeurtenis.vastgelegdDoorPersoonId).toBeNull();
    databank.close();
  });

  it("houdt bij een tweede loop van de migraties elke rij en de kolom overeind", () => {
    const databank = maakProefdatabank();
    databank
      .prepare(
        `INSERT INTO traject_gebeurtenissen (traject_id, lijn_id, tijdstip, soort,
           vaststelling, indruk)
         VALUES (1, 1, 2000, 'gesprek', 'Eerste gesprek gehouden.', 'Voelde stroef aan.'),
                (1, 1, 3000, 'bericht', 'Bericht verstuurd.', '')`,
      )
      .run();

    expect(() => databank.exec(migraties)).not.toThrow();

    const kolommen = databank
      .prepare("PRAGMA table_info(traject_gebeurtenissen)")
      .all() as Array<{ name: string }>;
    expect(kolommen.map((rij) => rij.name)).toContain("vastgelegd_door_persoon_id");
    const aantal = databank
      .prepare("SELECT count(*) AS aantal FROM traject_gebeurtenissen")
      .get() as { aantal: number };
    expect(aantal.aantal).toBe(2);
    const indexen = databank
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index'
           AND tbl_name = 'traject_gebeurtenissen' AND name IS NOT NULL`,
      )
      .all() as Array<{ name: string }>;
    expect(indexen.map((rij) => rij.name)).toContain(
      "idx_traject_gebeurtenissen_lijn_tijdstip",
    );
    databank.close();
  });

  it("weigert een auteur die bij een ander traject hoort", () => {
    const databank = maakProefdatabank();
    const opslag = maakTrajectOpslag(databank, () => {});
    expect(() =>
      opslag.voegGebeurtenisToe({
        trajectId: 1,
        beheerderId: 10,
        lijnId: 1,
        tijdstip: 2000,
        soort: "gesprek",
        vaststelling: "Kennismaking gehouden.",
        vastgelegdDoorPersoonId: 2,
      }),
    ).toThrow();
    databank.close();
  });
});
