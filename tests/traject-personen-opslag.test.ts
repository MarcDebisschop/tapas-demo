import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { maakTrajectOpslag } from "../server/traject/storage";
import { SOORTEN_MET_BELANG } from "../server/traject/schema";

const migraties = [
  "migrations/0002_clammy_talisman.sql",
  "migrations/0003_smiling_shape.sql",
  "migrations/0004_supreme_freak.sql",
  "migrations/0005_soorten_gebeurtenis.sql",
]
  .map((pad) => readFileSync(pad, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

interface Auditregel {
  actie: string;
  adminId: number | null;
  afnameId: number | null;
  detail?: string | null;
}

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
  databank.prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)").run(2, "Zuidkant");
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(10, 1, 0);
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(11, 1, 0);
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(12, 2, 0);
  databank.prepare("INSERT INTO deelnemers (id, naam) VALUES (?, ?)").run(70, "Sofie");
  return databank;
}

/**
 * Bouwt een dossier met drie partijen: de investeerder en de onderneming
 * hebben belang bij de uitkomst, de adviseur niet.
 */
function maakOpstelling(databank: Database.Database, auditregels: Auditregel[]) {
  const opslag = maakTrajectOpslag(databank, (regel) => auditregels.push(regel));
  const traject = opslag.maakTraject({
    naam: "Overname Noordbeek",
    organisatieId: 1,
    beheerderId: 10,
    aangemaaktOp: 1000,
  });
  const investeerder = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "investeerder",
    naam: "Noordzee Participaties",
    ankerpunt: "Bram Peeters",
    kring: 0,
    rol: "ankerpunt_investeerder",
  });
  const onderneming = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "onderneming",
    naam: "Asterra Machines",
    ankerpunt: "Sofie Van Loon",
    kring: 0,
    rol: "ankerpunt_onderneming",
  });
  const adviseur = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId: 10,
    soort: "adviseur",
    naam: "Helder & Partners",
    ankerpunt: "Ans De Wit",
    kring: 2,
    rol: "financieel_adviseur",
  });
  const werkstromen = opslag.haalTrajectOp(traject.id, 10).werkstromen;
  return { opslag, traject, investeerder, onderneming, adviseur, werkstromen };
}

describe("een persoon aan een dossier toevoegen", () => {
  it("bewaart de naam, het adres in kleine letters en schrijft een auditregel", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, onderneming } = maakOpstelling(databank, auditregels);

    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "  Sofie Van Loon  ",
      email: "  Sofie.VanLoon@Asterra.BE ",
      partijId: onderneming.id,
      aangemaaktOp: 2000,
    });

    expect(persoon.naam).toBe("Sofie Van Loon");
    expect(persoon.email).toBe("sofie.vanloon@asterra.be");
    expect(persoon.actief).toBe(1);
    expect(persoon.partijId).toBe(onderneming.id);
    expect(auditregels.map((regel) => regel.actie)).toContain("traject_persoon_toegevoegd");
    databank.close();
  });

  it("kan een persoon aan een bestaande aanmelding hangen", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      persoonBeheerderId: 11,
      persoonDeelnemerId: 70,
    });
    expect(persoon.beheerderId).toBe(11);
    expect(persoon.deelnemerId).toBe(70);
    databank.close();
  });

  it("laat een persoon zonder partij toe, want de facilitator hangt aan geen partij", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    expect(persoon.partijId).toBeNull();
    databank.close();
  });

  it("weigert een lege naam met een duidelijke melding", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    expect(() =>
      opslag.voegPersoonToe({
        trajectId: traject.id,
        beheerderId: 10,
        naam: "   ",
        email: "sofie@asterra.be",
      }),
    ).toThrow(/naam/i);
    databank.close();
  });

  it("weigert een adres zonder apenstaartje met een duidelijke melding", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    expect(() =>
      opslag.voegPersoonToe({
        trajectId: traject.id,
        beheerderId: 10,
        naam: "Sofie Van Loon",
        email: "sofie.asterra.be",
      }),
    ).toThrow(/e-mailadres/i);
    databank.close();
  });

  it("weigert een partij die bij een ander dossier hoort", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const tweede = opslag.maakTraject({
      naam: "Tweede dossier",
      organisatieId: 1,
      beheerderId: 10,
      aangemaaktOp: 1000,
    });
    const vreemdePartij = opslag.voegPartijToe({
      trajectId: tweede.id,
      beheerderId: 10,
      soort: "onderneming",
      naam: "Andere NV",
      ankerpunt: "Iemand",
      kring: 0,
      rol: "ankerpunt_onderneming",
    });
    expect(() =>
      opslag.voegPersoonToe({
        trajectId: traject.id,
        beheerderId: 10,
        naam: "Sofie Van Loon",
        email: "sofie@asterra.be",
        partijId: vreemdePartij.id,
      }),
    ).toThrow(/partij hoort niet bij dit traject/i);
    databank.close();
  });

  it("weigert een beheerder van een andere organisatie", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    expect(() =>
      opslag.voegPersoonToe({
        trajectId: traject.id,
        beheerderId: 12,
        naam: "Sofie Van Loon",
        email: "sofie@asterra.be",
      }),
    ).toThrow(/organisatiegrens/i);
    databank.close();
  });

  it("weigert hetzelfde adres tweemaal in hetzelfde dossier", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
    });
    expect(() =>
      opslag.voegPersoonToe({
        trajectId: traject.id,
        beheerderId: 10,
        naam: "Sofie V.",
        email: "SOFIE@asterra.be",
      }),
    ).toThrow();
    databank.close();
  });
});

describe("een persoon op inactief zetten", () => {
  it("zet actief op nul, verwijdert niets en schrijft een auditregel", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
    });

    const na = opslag.zetPersoonInactief({ persoonId: persoon.id, beheerderId: 10 });

    expect(na.actief).toBe(0);
    expect(na.id).toBe(persoon.id);
    const aantal = databank
      .prepare("SELECT count(*) AS aantal FROM traject_personen")
      .get() as { aantal: number };
    expect(aantal.aantal).toBe(1);
    expect(auditregels.map((regel) => regel.actie)).toContain("traject_persoon_inactief_gezet");
    databank.close();
  });

  it("weigert een beheerder van een andere organisatie", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
    });
    expect(() =>
      opslag.zetPersoonInactief({ persoonId: persoon.id, beheerderId: 12 }),
    ).toThrow(/organisatiegrens/i);
    databank.close();
  });

  it("weigert een persoon die niet bestaat", () => {
    const databank = maakProefdatabank();
    const { opslag } = maakOpstelling(databank, []);
    expect(() => opslag.zetPersoonInactief({ persoonId: 999, beheerderId: 10 })).toThrow(
      /persoon/i,
    );
    databank.close();
  });
});

describe("een rol toekennen", () => {
  it("legt de rol vast met tijdstip en toekenner en schrijft een auditregel", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, adviseur } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
      partijId: adviseur.id,
    });

    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "adviseur",
      toegekendOp: 3000,
    });

    expect(toekenning.rol.rol).toBe("adviseur");
    expect(toekenning.rol.werkstroomId).toBeNull();
    expect(toekenning.rol.toegekendDoorBeheerderId).toBe(10);
    expect(toekenning.rol.toegekendOp).toBe(3000);
    expect(toekenning.rol.ingetrokkenOp).toBeNull();
    expect(toekenning.waarschuwing).toBeNull();
    expect(auditregels.map((regel) => regel.actie)).toContain("traject_rol_toegekend");
    databank.close();
  });

  it("legt een werkstroomleider vast met zijn werkstroom", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, adviseur, werkstromen } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
      partijId: adviseur.id,
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "werkstroomleider",
      werkstroomId: werkstromen[0].id,
    });
    expect(toekenning.rol.werkstroomId).toBe(werkstromen[0].id);
    databank.close();
  });

  it("weigert een rol die niet in de lijst van zeven staat", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "toezichthouder" as never,
      }),
    ).toThrow(/rol/i);
    databank.close();
  });

  it("weigert een persoon die bij een ander dossier hoort", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const tweede = opslag.maakTraject({
      naam: "Tweede dossier",
      organisatieId: 1,
      beheerderId: 10,
      aangemaaktOp: 1000,
    });
    const vreemdePersoon = opslag.voegPersoonToe({
      trajectId: tweede.id,
      beheerderId: 10,
      naam: "Iemand Anders",
      email: "iemand@elders.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: vreemdePersoon.id,
        rol: "adviseur",
      }),
    ).toThrow(/persoon hoort niet bij dit traject/i);
    databank.close();
  });

  it("weigert een werkstroom die bij een ander dossier hoort", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const tweede = opslag.maakTraject({
      naam: "Tweede dossier",
      organisatieId: 1,
      beheerderId: 10,
      aangemaaktOp: 1000,
    });
    const vreemdeWerkstroom = opslag.haalTrajectOp(tweede.id, 10).werkstromen[0];
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "werkstroomleider",
        werkstroomId: vreemdeWerkstroom.id,
      }),
    ).toThrow(/werkstroom hoort niet bij dit traject/i);
    databank.close();
  });

  it("weigert een werkstroomleider zonder werkstroom", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "werkstroomleider",
      }),
    ).toThrow(/werkstroom/i);
    databank.close();
  });

  it("weigert een werkstroom bij een rol die geen werkstroomleider is", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, werkstromen } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "adviseur",
        werkstroomId: werkstromen[0].id,
      }),
    ).toThrow(/werkstroom/i);
    databank.close();
  });

  it("weigert een beheerder van een andere organisatie", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 12,
        persoonId: persoon.id,
        rol: "adviseur",
      }),
    ).toThrow(/organisatiegrens/i);
    databank.close();
  });
});

describe("regel acht: een ankerpunt is nooit tegelijk facilitator", () => {
  it("weigert de facilitator aan iemand die al ankerpunt van de investeerder is", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, investeerder } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Bram Peeters",
      email: "bram@noordzee.be",
      partijId: investeerder.id,
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "ankerpunt_investeerder",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "facilitator",
      }),
    ).toThrow(/eigen traject|niet de facilitator/i);
    databank.close();
  });

  it("weigert de facilitator aan iemand die al ankerpunt van de onderneming is", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, onderneming } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      partijId: onderneming.id,
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "ankerpunt_onderneming",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "facilitator",
      }),
    ).toThrow(/eigen traject|niet de facilitator/i);
    databank.close();
  });

  it("weigert een ankerpunt aan iemand die al facilitator is", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "facilitator",
    });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "ankerpunt_investeerder",
      }),
    ).toThrow(/eigen traject|niet de facilitator/i);
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "ankerpunt_onderneming",
      }),
    ).toThrow(/eigen traject|niet de facilitator/i);
    databank.close();
  });

  it("legt in gewone taal uit waarom het niet kan", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "facilitator",
    });
    let melding = "";
    try {
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "ankerpunt_onderneming",
      });
    } catch (fout) {
      melding = (fout as Error).message;
    }
    expect(melding.length).toBeGreaterThan(60);
    expect(melding).toMatch(/facilitator/i);
    expect(melding).toMatch(/onpartijdig|belang|eigen/i);
    databank.close();
  });

  it("laat de facilitator wel toe wanneer het vroegere ankerpunt is ingetrokken", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, onderneming } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      partijId: onderneming.id,
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "ankerpunt_onderneming",
    });
    opslag.trekRolIn({ rolId: toekenning.rol.id, beheerderId: 10 });
    expect(() =>
      opslag.kenRolToe({
        trajectId: traject.id,
        beheerderId: 10,
        persoonId: persoon.id,
        rol: "facilitator",
      }),
    ).not.toThrow();
    databank.close();
  });
});

describe("regel negen: de waarschuwing over belang", () => {
  it("noemt de investeerder en de onderneming als soorten met belang bij de uitkomst", () => {
    expect(SOORTEN_MET_BELANG).toEqual(["investeerder", "onderneming"]);
  });

  it("waarschuwt zonder te blokkeren bij een facilitator die aan de onderneming hangt", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, onderneming } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      partijId: onderneming.id,
    });

    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "facilitator",
    });

    expect(toekenning.rol.id).toBeGreaterThan(0);
    expect(toekenning.waarschuwing).toMatch(/belang/i);
    const waarschuwingen = auditregels.filter(
      (regel) => regel.actie === "traject_rol_belangwaarschuwing",
    );
    expect(waarschuwingen).toHaveLength(1);
    expect(waarschuwingen[0].detail ?? "").toMatch(/belang/i);
    const bewaard = databank
      .prepare("SELECT count(*) AS aantal FROM traject_rollen WHERE rol = 'facilitator'")
      .get() as { aantal: number };
    expect(bewaard.aantal).toBe(1);
    databank.close();
  });

  it("waarschuwt ook bij een facilitator die aan de investeerder hangt", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, investeerder } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Bram Peeters",
      email: "bram@noordzee.be",
      partijId: investeerder.id,
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "facilitator",
    });
    expect(toekenning.waarschuwing).toMatch(/belang/i);
    databank.close();
  });

  it("waarschuwt niet bij een facilitator zonder partij of bij een adviseurpartij", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, adviseur } = maakOpstelling(databank, auditregels);
    const buitenstaander = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    const zonderPartij = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: buitenstaander.id,
      rol: "facilitator",
    });
    expect(zonderPartij.waarschuwing).toBeNull();

    const tweede = opslag.maakTraject({
      naam: "Tweede dossier",
      organisatieId: 1,
      beheerderId: 10,
      aangemaaktOp: 1000,
    });
    const adviseurPartijTweede = opslag.voegPartijToe({
      trajectId: tweede.id,
      beheerderId: 10,
      soort: "adviseur",
      naam: "Helder & Partners",
      ankerpunt: "Ans De Wit",
      kring: 2,
      rol: "financieel_adviseur",
    });
    expect(adviseur.soort).toBe("adviseur");
    const adviseurPersoon = opslag.voegPersoonToe({
      trajectId: tweede.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
      partijId: adviseurPartijTweede.id,
    });
    const uitkomst = opslag.kenRolToe({
      trajectId: tweede.id,
      beheerderId: 10,
      persoonId: adviseurPersoon.id,
      rol: "facilitator",
    });
    expect(uitkomst.waarschuwing).toBeNull();
    expect(
      auditregels.filter((regel) => regel.actie === "traject_rol_belangwaarschuwing"),
    ).toHaveLength(0);
    databank.close();
  });

  it("waarschuwt niet bij een andere rol dan facilitator aan een partij met belang", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject, onderneming } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      partijId: onderneming.id,
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "ankerpunt_onderneming",
    });
    expect(toekenning.waarschuwing).toBeNull();
    expect(
      auditregels.filter((regel) => regel.actie === "traject_rol_belangwaarschuwing"),
    ).toHaveLength(0);
    databank.close();
  });
});

describe("een rol intrekken", () => {
  it("vult het intrekmoment en de intrekker en laat de rij staan", () => {
    const databank = maakProefdatabank();
    const auditregels: Auditregel[] = [];
    const { opslag, traject } = maakOpstelling(databank, auditregels);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "adviseur",
      toegekendOp: 3000,
    });

    const ingetrokken = opslag.trekRolIn({
      rolId: toekenning.rol.id,
      beheerderId: 11,
      ingetrokkenOp: 4000,
    });

    expect(ingetrokken.ingetrokkenOp).toBe(4000);
    expect(ingetrokken.ingetrokkenDoorBeheerderId).toBe(11);
    expect(ingetrokken.rol).toBe("adviseur");
    const aantal = databank
      .prepare("SELECT count(*) AS aantal FROM traject_rollen")
      .get() as { aantal: number };
    expect(aantal.aantal).toBe(1);
    expect(auditregels.map((regel) => regel.actie)).toContain("traject_rol_ingetrokken");
    databank.close();
  });

  it("weigert een rol die al ingetrokken is", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "adviseur",
    });
    opslag.trekRolIn({ rolId: toekenning.rol.id, beheerderId: 10, ingetrokkenOp: 4000 });
    expect(() =>
      opslag.trekRolIn({ rolId: toekenning.rol.id, beheerderId: 10, ingetrokkenOp: 5000 }),
    ).toThrow(/al ingetrokken/i);
    databank.close();
  });

  it("weigert een beheerder van een andere organisatie", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "adviseur",
    });
    expect(() => opslag.trekRolIn({ rolId: toekenning.rol.id, beheerderId: 12 })).toThrow(
      /organisatiegrens/i,
    );
    databank.close();
  });

  it("weigert een rol die niet bestaat", () => {
    const databank = maakProefdatabank();
    const { opslag } = maakOpstelling(databank, []);
    expect(() => opslag.trekRolIn({ rolId: 999, beheerderId: 10 })).toThrow(/rol/i);
    databank.close();
  });
});

describe("de personen van een dossier opvragen", () => {
  it("geeft naam, adres, partij, de kring uit die partij en de geldige rollen", () => {
    const databank = maakProefdatabank();
    const { opslag, traject, onderneming, adviseur, werkstromen } = maakOpstelling(
      databank,
      [],
    );
    const sofie = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Sofie Van Loon",
      email: "sofie@asterra.be",
      partijId: onderneming.id,
    });
    const ans = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
      partijId: adviseur.id,
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: sofie.id,
      rol: "ankerpunt_onderneming",
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: ans.id,
      rol: "adviseur",
    });
    opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: ans.id,
      rol: "werkstroomleider",
      werkstroomId: werkstromen[1].id,
    });

    const personen = opslag.haalPersonenVanTraject(traject.id, 10);

    expect(personen).toHaveLength(2);
    expect(personen[0].naam).toBe("Sofie Van Loon");
    expect(personen[0].email).toBe("sofie@asterra.be");
    expect(personen[0].partijNaam).toBe("Asterra Machines");
    expect(personen[0].kring).toBe(0);
    expect(personen[0].rollen.map((rol) => rol.rol)).toEqual(["ankerpunt_onderneming"]);
    expect(personen[1].kring).toBe(2);
    expect(personen[1].rollen.map((rol) => rol.rol)).toEqual(["adviseur", "werkstroomleider"]);
    expect(personen[1].rollen[1].werkstroomNaam).toBe(werkstromen[1].naam);
    databank.close();
  });

  it("laat een persoon zonder partij zien met een lege kring", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    const personen = opslag.haalPersonenVanTraject(traject.id, 10);
    expect(personen[0].partijId).toBeNull();
    expect(personen[0].partijNaam).toBeNull();
    expect(personen[0].kring).toBeNull();
    databank.close();
  });

  it("houdt een inactieve persoon in de lijst met een duidelijke aanduiding", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ruben Claes",
      email: "ruben@buiten.be",
    });
    opslag.zetPersoonInactief({ persoonId: persoon.id, beheerderId: 10 });

    const personen = opslag.haalPersonenVanTraject(traject.id, 10);

    expect(personen).toHaveLength(1);
    expect(personen[0].actief).toBe(false);
    expect(personen[0].aanduiding).toMatch(/niet meer|uit het traject|inactief/i);
    databank.close();
  });

  it("laat ingetrokken rollen weg uit de lijst van geldige rollen", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    const persoon = opslag.voegPersoonToe({
      trajectId: traject.id,
      beheerderId: 10,
      naam: "Ans De Wit",
      email: "ans@helder.be",
    });
    const toekenning = opslag.kenRolToe({
      trajectId: traject.id,
      beheerderId: 10,
      persoonId: persoon.id,
      rol: "adviseur",
    });
    opslag.trekRolIn({ rolId: toekenning.rol.id, beheerderId: 10 });
    const personen = opslag.haalPersonenVanTraject(traject.id, 10);
    expect(personen[0].rollen).toHaveLength(0);
    databank.close();
  });

  it("weigert een beheerder van een andere organisatie", () => {
    const databank = maakProefdatabank();
    const { opslag, traject } = maakOpstelling(databank, []);
    expect(() => opslag.haalPersonenVanTraject(traject.id, 12)).toThrow(/organisatiegrens/i);
    databank.close();
  });
});
