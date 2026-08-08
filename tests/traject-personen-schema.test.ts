import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  ROLLEN_VAN_TRAJECT,
  trajectPersonen,
  trajectRollen,
} from "../server/traject/schema";

/**
 * Deze tests bewijzen dat de databank zelf de verkeerde rij weigert. Er komt
 * bewust geen enkele opslagfunctie aan te pas: alle invoegingen gaan met de
 * hand, rechtstreeks in SQLite. Wat hier faalt, faalt dus in het schema en niet
 * in de code eromheen.
 */

function leesMigraties(): string {
  const bestanden = readdirSync("migrations")
    .filter((naam) => naam.endsWith(".sql"))
    .sort();
  const nodig = bestanden.filter((naam) => {
    const inhoud = readFileSync(`migrations/${naam}`, "utf8");
    return (
      inhoud.includes("traject_fasen") ||
      inhoud.includes("traject_personen") ||
      inhoud.includes("traject_rollen")
    );
  });
  return nodig
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
  databank.prepare("INSERT INTO deelnemers (id, naam) VALUES (?, ?)").run(70, "Sofie");
  databank
    .prepare(
      `INSERT INTO traject (id, naam, organisatie_id, aangemaakt_door_beheerder_id,
         huidige_fase, zekerheidstrap, status, aangemaakt_op)
       VALUES (1, 'Overname Noordbeek', 1, 10, 1, 1, 'open', 1000)`,
    )
    .run();
  databank
    .prepare(
      `INSERT INTO traject_partijen (id, traject_id, soort, naam, ankerpunt, kring, rol)
       VALUES (1, 1, 'onderneming', 'Asterra Machines', 'Sofie Van Loon', 0, 'ankerpunt_onderneming')`,
    )
    .run();
  databank
    .prepare(
      `INSERT INTO traject_werkstromen (id, traject_id, naam, leider_partij_id, status)
       VALUES (1, 1, 'financieel', NULL, 'niet_gestart'),
              (2, 1, 'juridisch', NULL, 'niet_gestart')`,
    )
    .run();
  return databank;
}

function voegPersoonToe(
  databank: Database.Database,
  id: number,
  email: string,
  actief = 1,
  trajectId = 1,
): void {
  databank
    .prepare(
      `INSERT INTO traject_personen (id, traject_id, partij_id, naam, email,
         beheerder_id, deelnemer_id, actief, aangemaakt_op)
       VALUES (?, ?, 1, 'Sofie Van Loon', ?, NULL, NULL, ?, 2000)`,
    )
    .run(id, trajectId, email, actief);
}

function kenRolToe(
  databank: Database.Database,
  gegevens: {
    persoonId: number;
    rol: string;
    werkstroomId?: number | null;
    ingetrokkenOp?: number | null;
    trajectId?: number;
  },
): void {
  databank
    .prepare(
      `INSERT INTO traject_rollen (traject_id, persoon_id, rol, werkstroom_id,
         toegekend_door_beheerder_id, toegekend_op, ingetrokken_op,
         ingetrokken_door_beheerder_id)
       VALUES (?, ?, ?, ?, 10, 3000, ?, ?)`,
    )
    .run(
      gegevens.trajectId ?? 1,
      gegevens.persoonId,
      gegevens.rol,
      gegevens.werkstroomId ?? null,
      gegevens.ingetrokkenOp ?? null,
      gegevens.ingetrokkenOp ? 10 : null,
    );
}

describe("de zeven rolnamen", () => {
  it("bevat precies de zeven namen uit het protocol, letterlijk zo geschreven", () => {
    expect(ROLLEN_VAN_TRAJECT).toEqual([
      "facilitator",
      "ankerpunt_investeerder",
      "ankerpunt_onderneming",
      "werkstroomleider",
      "adviseur",
      "overlegorgaan",
      "betrokkene",
    ]);
    expect(new Set(ROLLEN_VAN_TRAJECT).size).toBe(7);
  });

  it("staat met dezelfde zeven namen in de controlebeperking van de databank", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    for (const rol of ROLLEN_VAN_TRAJECT) {
      const werkstroomId = rol === "werkstroomleider" ? 1 : null;
      expect(() => kenRolToe(databank, { persoonId: 1, rol, werkstroomId })).not.toThrow();
    }
    databank.close();
  });

  it("noemt de twee nieuwe tabellen bij hun naam in de databank", () => {
    expect(trajectPersonen[Symbol.for("drizzle:Name")]).toBe("traject_personen");
    expect(trajectRollen[Symbol.for("drizzle:Name")]).toBe("traject_rollen");
  });
});

describe("beperking 1: rol is een van de zeven", () => {
  it("weigert een rol die niet in de lijst staat", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() => kenRolToe(databank, { persoonId: 1, rol: "toezichthouder" })).toThrow(
      /traject_rollen_rol_geldig|CHECK/i,
    );
    databank.close();
  });

  it("weigert ook een rol met een hoofdletter of een spatie erin", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() => kenRolToe(databank, { persoonId: 1, rol: "Facilitator" })).toThrow();
    expect(() => kenRolToe(databank, { persoonId: 1, rol: "ankerpunt investeerder" })).toThrow();
    databank.close();
  });
});

describe("beperking 2: werkstroom hoort bij precies een rol", () => {
  it("weigert een werkstroom bij een rol die geen werkstroomleider is", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() =>
      kenRolToe(databank, { persoonId: 1, rol: "adviseur", werkstroomId: 1 }),
    ).toThrow(/traject_rollen_werkstroom_geldig|CHECK/i);
    databank.close();
  });

  it("weigert een werkstroomleider zonder werkstroom", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() =>
      kenRolToe(databank, { persoonId: 1, rol: "werkstroomleider", werkstroomId: null }),
    ).toThrow(/traject_rollen_werkstroom_geldig|CHECK/i);
    databank.close();
  });
});

describe("beperking 3: actief is 0 of 1", () => {
  it("weigert elke andere waarde dan 0 of 1", () => {
    const databank = maakProefdatabank();
    expect(() => voegPersoonToe(databank, 1, "sofie@asterra.be", 2)).toThrow(
      /traject_personen_actief_geldig|CHECK/i,
    );
    expect(() => voegPersoonToe(databank, 2, "bram@asterra.be", -1)).toThrow();
    databank.close();
  });

  it("laat 0 en 1 wel toe", () => {
    const databank = maakProefdatabank();
    expect(() => voegPersoonToe(databank, 1, "sofie@asterra.be", 1)).not.toThrow();
    expect(() => voegPersoonToe(databank, 2, "bram@asterra.be", 0)).not.toThrow();
    databank.close();
  });
});

describe("beperking 4: een e-mailadres komt een keer voor per traject", () => {
  it("weigert hetzelfde adres tweemaal in hetzelfde traject", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() => voegPersoonToe(databank, 2, "sofie@asterra.be")).toThrow(
      /uq_traject_personen_email|UNIQUE/i,
    );
    databank.close();
  });

  it("laat hetzelfde adres wel toe in een ander traject", () => {
    const databank = maakProefdatabank();
    databank
      .prepare(
        `INSERT INTO traject (id, naam, organisatie_id, aangemaakt_door_beheerder_id,
           huidige_fase, zekerheidstrap, status, aangemaakt_op)
         VALUES (2, 'Tweede dossier', 1, 10, 1, 1, 'open', 1000)`,
      )
      .run();
    databank
      .prepare(
        `INSERT INTO traject_partijen (id, traject_id, soort, naam, ankerpunt, kring, rol)
         VALUES (9, 2, 'onderneming', 'Andere NV', 'Iemand', 0, 'ankerpunt_onderneming')`,
      )
      .run();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    expect(() =>
      databank
        .prepare(
          `INSERT INTO traject_personen (id, traject_id, partij_id, naam, email,
             beheerder_id, deelnemer_id, actief, aangemaakt_op)
           VALUES (2, 2, 9, 'Sofie Van Loon', 'sofie@asterra.be', NULL, NULL, 1, 2000)`,
        )
        .run(),
    ).not.toThrow();
    databank.close();
  });
});

describe("beperking 5: dezelfde geldige toekenning komt niet tweemaal voor", () => {
  it("weigert dezelfde rol tweemaal voor dezelfde persoon zonder werkstroom", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "adviseur" });
    expect(() => kenRolToe(databank, { persoonId: 1, rol: "adviseur" })).toThrow(
      /uq_traject_rollen_toekenning|UNIQUE/i,
    );
    databank.close();
  });

  it("laat dezelfde rol opnieuw toe nadat de eerste is ingetrokken", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "adviseur", ingetrokkenOp: 5000 });
    expect(() => kenRolToe(databank, { persoonId: 1, rol: "adviseur" })).not.toThrow();
    databank.close();
  });

  it("weigert dezelfde werkstroomleiderrol tweemaal voor dezelfde werkstroom en persoon", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "werkstroomleider", werkstroomId: 1 });
    expect(() =>
      kenRolToe(databank, { persoonId: 1, rol: "werkstroomleider", werkstroomId: 1 }),
    ).toThrow(/UNIQUE/i);
    databank.close();
  });
});

describe("beperking 6: hoogstens een geldige facilitator en een ankerpunt per kant", () => {
  it("weigert een tweede geldige facilitator in hetzelfde traject", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "facilitator" });
    expect(() => kenRolToe(databank, { persoonId: 2, rol: "facilitator" })).toThrow(
      /uq_traject_rollen_facilitator|UNIQUE/i,
    );
    databank.close();
  });

  it("laat een nieuwe facilitator toe nadat de vorige is ingetrokken", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "facilitator", ingetrokkenOp: 5000 });
    expect(() => kenRolToe(databank, { persoonId: 2, rol: "facilitator" })).not.toThrow();
    databank.close();
  });

  it("weigert een tweede geldig ankerpunt van de investeerder", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "ankerpunt_investeerder" });
    expect(() => kenRolToe(databank, { persoonId: 2, rol: "ankerpunt_investeerder" })).toThrow(
      /uq_traject_rollen_ankerpunt_investeerder|UNIQUE/i,
    );
    databank.close();
  });

  it("weigert een tweede geldig ankerpunt van de onderneming", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "ankerpunt_onderneming" });
    expect(() => kenRolToe(databank, { persoonId: 2, rol: "ankerpunt_onderneming" })).toThrow(
      /uq_traject_rollen_ankerpunt_onderneming|UNIQUE/i,
    );
    databank.close();
  });
});

describe("beperking 7: hoogstens een geldige leider per werkstroom", () => {
  it("weigert een tweede leider voor dezelfde werkstroom", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "werkstroomleider", werkstroomId: 1 });
    expect(() =>
      kenRolToe(databank, { persoonId: 2, rol: "werkstroomleider", werkstroomId: 1 }),
    ).toThrow(/uq_traject_rollen_werkstroomleider|UNIQUE/i);
    databank.close();
  });

  it("laat wel een leider toe voor een andere werkstroom", () => {
    const databank = maakProefdatabank();
    voegPersoonToe(databank, 1, "sofie@asterra.be");
    voegPersoonToe(databank, 2, "bram@asterra.be");
    kenRolToe(databank, { persoonId: 1, rol: "werkstroomleider", werkstroomId: 1 });
    expect(() =>
      kenRolToe(databank, { persoonId: 2, rol: "werkstroomleider", werkstroomId: 2 }),
    ).not.toThrow();
    databank.close();
  });
});

describe("de migratie zelf", () => {
  it("kan tweemaal lopen zonder te breken", () => {
    const databank = maakProefdatabank();
    expect(() => databank.exec(migraties)).not.toThrow();
    databank.close();
  });

  it("maakt elke beperking en index met een uitdrukkelijke naam aan", () => {
    const databank = maakProefdatabank();
    const indexen = databank
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index'
           AND tbl_name IN ('traject_personen', 'traject_rollen')
           AND name IS NOT NULL ORDER BY name`,
      )
      .all()
      .map((rij) => (rij as { name: string }).name);
    expect(indexen).toEqual([
      "idx_traject_personen_traject",
      "idx_traject_rollen_persoon",
      "idx_traject_rollen_traject",
      "uq_traject_personen_email",
      "uq_traject_rollen_ankerpunt_investeerder",
      "uq_traject_rollen_ankerpunt_onderneming",
      "uq_traject_rollen_facilitator",
      "uq_traject_rollen_toekenning",
      "uq_traject_rollen_werkstroomleider",
    ]);
    databank.close();
  });
});

describe("de verwijzingen en de vaste velden", () => {
  it("weigert een persoon in een traject dat niet bestaat", () => {
    const databank = maakProefdatabank();
    expect(() => voegPersoonToe(databank, 1, "sofie@asterra.be", 1, 99)).toThrow(
      /FOREIGN KEY/i,
    );
    databank.close();
  });

  it("slaat geen kring op bij de persoon, want die volgt uit de partij", () => {
    const kolommen = Object.keys(trajectPersonen).map(
      (sleutel) => (trajectPersonen as Record<string, { name?: string }>)[sleutel]?.name,
    );
    expect(kolommen).not.toContain("kring");
  });
});
