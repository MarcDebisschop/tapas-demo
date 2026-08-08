import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  controleerVraagovergang,
  maakTrajectOpslag,
} from "../server/traject/storage";

const migratie = [
  "migrations/0002_clammy_talisman.sql",
  "migrations/0003_smiling_shape.sql",
  "migrations/0004_supreme_freak.sql",
]
  .map((pad) => readFileSync(pad, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

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
  `);
  databank.exec(migratie);
  databank.prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)").run(1, "Noordbeek");
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(10, 1, 0);
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(11, 1, 0);
  databank
    .prepare("INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)")
    .run(12, 2, 0);
  return databank;
}

describe("toestandsovergangen van vraagkaarten", () => {
  it("weigert alle sprongen behalve de onmiddellijke volgende toestand", () => {
    const volgende = {
      gesteld: "erkend",
      erkend: "in_behandeling",
      in_behandeling: "beantwoord",
      beantwoord: "gedeeld",
      gedeeld: null,
    } as const;
    const toestanden = ["gesteld", "erkend", "in_behandeling", "beantwoord", "gedeeld"] as const;

    for (const huidig of toestanden) {
      for (const doel of toestanden) {
        const isEnigeToegelatenOvergang = volgende[huidig] === doel;
        const dubbeleVrijgave = huidig === "beantwoord" && doel === "gedeeld";
        const uitvoeren = () => controleerVraagovergang(huidig, doel, dubbeleVrijgave);

        if (isEnigeToegelatenOvergang) {
          expect(uitvoeren).not.toThrow();
        } else {
          expect(uitvoeren).toThrow();
        }
      }
    }
  });

  it("weigert gedeeld zonder uitdrukkelijke dubbele vrijgave", () => {
    expect(() => controleerVraagovergang("beantwoord", "gedeeld", false)).toThrow(
      /dubbele vrijgave/i,
    );
  });
});

describe("opslag van het trajectregister", () => {
  it("maakt vaste onderdelen, bewaakt de organisatiegrens en schrijft auditregels", () => {
    const databank = maakProefdatabank();
    const auditregels: Array<{ actie: string; adminId: number | null; afnameId: number | null }> = [];
    const opslag = maakTrajectOpslag(databank, (regel) => auditregels.push(regel));

    const traject = opslag.maakTraject({
      naam: "Overname Noordbeek",
      organisatieId: 1,
      beheerderId: 10,
      zekerheidstrap: 2,
      aangemaaktOp: 1000,
    });
    const volledigNaAanmaken = opslag.haalTrajectOp(traject.id, 10);

    expect(volledigNaAanmaken.fasen).toHaveLength(9);
    expect(volledigNaAanmaken.werkstromen.map((werkstroom) => werkstroom.naam)).toEqual([
      "financieel",
      "juridisch",
      "fiscaal",
      "commercieel",
      "technisch",
      "menselijk",
    ]);
    expect(() =>
      opslag.maakTraject({
        naam: "Verkeerde organisatie",
        organisatieId: 1,
        beheerderId: 12,
        aangemaaktOp: 1000,
      }),
    ).toThrow(/organisatiegrens/i);

    const investeerder = opslag.voegPartijToe({
      trajectId: traject.id,
      beheerderId: 10,
      soort: "investeerder",
      naam: "Investeerder",
      ankerpunt: "Ankerpunt investeerder",
      kring: 0,
      rol: "ankerpunt_investeerder",
    });
    const onderneming = opslag.voegPartijToe({
      trajectId: traject.id,
      beheerderId: 10,
      soort: "onderneming",
      naam: "Noordbeek",
      ankerpunt: "Ankerpunt onderneming",
      kring: 0,
      rol: "ankerpunt_onderneming",
    });
    const lijn = opslag.voegLijnToe({
      trajectId: traject.id,
      beheerderId: 10,
      partijEenId: onderneming.id,
      partijTweeId: investeerder.id,
      stiltedrempelDagen: 7,
      aangemaaktOp: 2000,
    });

    expect(lijn.partijEenId).toBe(Math.min(investeerder.id, onderneming.id));
    expect(lijn.partijTweeId).toBe(Math.max(investeerder.id, onderneming.id));
    expect(() =>
      opslag.voegLijnToe({
        trajectId: traject.id,
        beheerderId: 10,
        partijEenId: investeerder.id,
        partijTweeId: onderneming.id,
        stiltedrempelDagen: 7,
        aangemaaktOp: 2000,
      }),
    ).toThrow(/bestaat al/i);

    const gebeurtenis = opslag.voegGebeurtenisToe({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      tijdstip: 3000,
      soort: "gesprek",
      vaststelling: "Er is een gesprek gevoerd.",
      indruk: "De toon was constructief.",
    });
    expect(gebeurtenis.vaststelling).toBe("Er is een gesprek gevoerd.");
    expect(gebeurtenis.indruk).toBe("De toon was constructief.");

    const werkstroom = volledigNaAanmaken.werkstromen[0]!;
    const vraag = opslag.maakVraagkaart({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      vragerPartijId: investeerder.id,
      ontvangerPartijId: onderneming.id,
      werkstroomId: werkstroom.id,
      vraagtekst: "Kan de aansluiting worden toegelicht?",
      kader: "Nodig om het waarderingsmodel te sluiten.",
      antwoordtermijnOp: 10_000,
      antwoordKring: 1,
      aangemaaktOp: 4000,
    });

    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "erkend",
      veranderdOp: 5000,
    });
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "in_behandeling",
      veranderdOp: 6000,
    });
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "beantwoord",
      veranderdOp: 7000,
    });
    expect(() =>
      opslag.veranderVraagtoestand({
        vraagId: vraag.id,
        beheerderId: 10,
        toestand: "gedeeld",
        veranderdOp: 8000,
      }),
    ).toThrow(/dubbele vrijgave/i);

    const gedeeldeVraag = opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "gedeeld",
      vrijgaveVragerDoorBeheerderId: 10,
      vrijgaveOntvangerDoorBeheerderId: 11,
      veranderdOp: 8000,
    });
    expect(gedeeldeVraag.toestand).toBe("gedeeld");
    expect(gedeeldeVraag.vrijgaveVragerDoorBeheerderId).toBe(10);
    expect(gedeeldeVraag.vrijgaveOntvangerDoorBeheerderId).toBe(11);
    expect(auditregels.map((regel) => regel.actie)).toEqual([
      "traject_aangemaakt",
      "traject_partij_toegevoegd",
      "traject_partij_toegevoegd",
      "traject_lijn_toegevoegd",
      "traject_gebeurtenis_toegevoegd",
      "traject_vraag_aangemaakt",
      "traject_vraag_toestand_gewijzigd",
      "traject_vraag_toestand_gewijzigd",
      "traject_vraag_toestand_gewijzigd",
      "traject_vraag_toestand_gewijzigd",
    ]);

    databank.close();
  });
});
