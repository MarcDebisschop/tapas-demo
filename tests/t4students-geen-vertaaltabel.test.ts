import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Geen enkele vertaaltabel voor constructnamen.
//
// WAT HET BREEKPUNT IS
// Het bestaande voorbeeldrapport hertaalt de constructnamen: wat in het
// instrument "Constructief onderscheidend" heet, staat daar onder een andere
// naam. Zodra er twee namen voor hetzelfde ding bestaan, weet niemand meer
// welke van de twee de echte is, en gaat de ene schuiven zonder de andere.
//
// DE REGEL
// Er is een plaats waar een constructnaam vastligt: server/data/t4students.json,
// in families[].constructs. Elke naam die in het rapport op papier komt, is
// letterlijk die naam. Het rapport mag namen tonen, sorteren en herhalen, maar
// nooit vervangen.
//
// WAT DEZE TEST DOET
// Drie dingen. Ze rekent een volledige voorbeeldafname door en kijkt na of elke
// constructnaam die in de uitvoer van de rapportlaag terechtkomt, letterlijk in
// het instrument staat. Ze kijkt na of alle zeventien duidingsteksten op een
// bestaande naam gesleuteld zijn. En ze leest de rapportbestanden na op een
// tabel die namen op namen afbeeldt.
//
// De test zakt dus zodra iemand een naam hertaalt, hoe hij het ook doet.
// ---------------------------------------------------------------------------

const WORTEL = path.resolve(__dirname, "..");

/** Alle namen die het instrument kent, uit families[].constructs. */
const ECHTE_NAMEN: string[] = I.families.flatMap((f) => f.constructs);

const RAPPORTBESTANDEN = [
  path.join("server", "t4students", "rapport-contract.ts"),
  path.join("server", "t4students", "rapport-paginas.ts"),
  path.join("server", "t4students", "rapport-pdf.ts"),
  path.join("server", "t4students", "rapport-voorbeeld.ts"),
];

function zonderCommentaar(bron: string): string {
  return bron.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function bestaat(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Elke tekenreeks die ergens in een geneste structuur voorkomt. */
function alleTeksten(waarde: unknown, uit: string[] = []): string[] {
  if (typeof waarde === "string") uit.push(waarde);
  else if (Array.isArray(waarde)) for (const w of waarde) alleTeksten(w, uit);
  else if (waarde != null && typeof waarde === "object")
    for (const w of Object.values(waarde as Record<string, unknown>)) alleTeksten(w, uit);
  return uit;
}

describe("geen enkele vertaaltabel voor constructnamen", () => {
  it("het instrument is de enige plaats waar de namen staan", () => {
    // 30 sinds fase 1b: de 25 bestaande constructen plus de vijf van de
    // nieuwe familie Motivatie (Autonomie, Competentie, Verbondenheid,
    // Erkenning, Verwachting).
    expect(ECHTE_NAMEN.length).toBe(30);
    expect(new Set(ECHTE_NAMEN).size).toBe(30);
  });

  it("elke constructnaam in het rapport staat letterlijk in het instrument", () => {
    const r = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, r, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: "Test",
      code: "TEST-1",
      datum: "2026-08-02",
      instrumentVersie: I.version,
    });

    // Elk veld dat een constructnaam draagt, moet er een van het instrument zijn.
    const gedragen: string[] = [];
    for (const p of rapport.paginas) {
      for (const b of p.blokken) {
        if (b.soort === "banden") for (const band of b.banden) for (const rij of band.rijen) gedragen.push(rij.construct);
        if (b.soort === "rangtabel") for (const rij of b.rijen) gedragen.push(rij.construct);
        if (b.soort === "constructblok") gedragen.push(b.construct);
      }
    }
    expect(gedragen.length).toBeGreaterThan(20);
    const vreemd = gedragen.filter((n) => !ECHTE_NAMEN.includes(n));
    expect(
      Array.from(new Set(vreemd)),
      "Een naam in het rapport komt niet uit het instrument. Namen worden getoond, niet vervangen.",
    ).toEqual([]);
  });

  it("geen enkele naam uit het instrument wordt in de lopende tekst hertaald", () => {
    // Elke naam die het instrument kent, mag in de rapporttekst alleen letterlijk
    // opduiken. Deze test zoekt het omgekeerde: een naam die in de uitvoer staat
    // maar die het instrument niet kent en die er wel als een constructnaam
    // uitziet, doordat hij vlak naast een rangnummer of een score staat.
    const r = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, r, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: "Test",
      code: "TEST-1",
      datum: "2026-08-02",
      instrumentVersie: I.version,
    });
    const tekst = alleTeksten(rapport.paginas).join("\n");

    // De zes talent-foci, de zes versnellers en de vijf drivers worden alle
    // zeventien ergens in de lopende tekst genoemd, en wel onder hun eigen naam.
    const dimensies = I.families
      .filter((f) => ["Talent-foci", "Talent-versnellers", "Drivers"].includes(f.id))
      .flatMap((f) => f.constructs);
    const ontbreekt = dimensies.filter((n) => !tekst.includes(n));
    expect(
      ontbreekt,
      "Deze constructen komen nergens onder hun eigen naam in het rapport voor. " +
        "Dat is precies hoe een vertaaltabel binnensluipt.",
    ).toEqual([]);
  });

  it("de eigen teksten van de bouwer zijn ook op bestaande namen gesleuteld", () => {
    const eigen = JSON.parse(
      readFileSync(path.join(WORTEL, "server", "data", "t4students-rapportteksten.json"), "utf-8"),
    ) as {
      interesse: { teksten: Record<string, string> };
      studiegebieden: { teksten: Record<string, string> };
    };
    const interesseNamen = Object.keys(eigen.interesse.teksten);
    expect(interesseNamen.filter((n) => !ECHTE_NAMEN.includes(n))).toEqual([]);
    const gebieden = Object.keys(I.scoringMap.tenStudyFields);
    expect(Object.keys(eigen.studiegebieden.teksten).filter((n) => !gebieden.includes(n))).toEqual([]);
  });

  it("de duidingsteksten zijn op een bestaande naam gesleuteld", () => {
    const bestand = JSON.parse(
      readFileSync(path.join(WORTEL, "server", "data", "t4students-duidingsteksten.json"), "utf-8"),
    ) as { constructen: Record<string, { familie: string; tekst: string }> };
    const sleutels = Object.keys(bestand.constructen);
    expect(sleutels.length).toBe(17);
    expect(sleutels.filter((s) => !ECHTE_NAMEN.includes(s))).toEqual([]);
    // En de familie die erbij staat, klopt met de familie in het instrument.
    for (const [naam, d] of Object.entries(bestand.constructen)) {
      const fam = I.families.find((f) => f.constructs.includes(naam));
      expect(fam?.id, `${naam} staat onder de verkeerde familie`).toBe(d.familie);
    }
  });

  it("geen enkel rapportbestand bevat een afbeelding van naam op naam", () => {
    // Een vertaaltabel herken je aan een sleutel die een constructnaam is en een
    // waarde die een korte tekst is zonder spatie of met hoogstens twee woorden:
    // dat is dan een alternatieve naam. Duidingsteksten zijn lange zinnen en
    // vallen daar niet onder.
    const overtreders: string[] = [];
    for (const rel of RAPPORTBESTANDEN) {
      const p = path.join(WORTEL, rel);
      if (!bestaat(p)) continue;
      const regels = zonderCommentaar(readFileSync(p, "utf-8")).split("\n");
      regels.forEach((regel, i) => {
        for (const naam of ECHTE_NAMEN) {
          // Een regel van de vorm  "Naam": "korte tekst"  of  Naam: "korte tekst"
          const patroon = new RegExp(
            `["']?${naam.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}["']?\\s*:\\s*["']([^"']{0,40})["']`,
          );
          const m = regel.match(patroon);
          if (m && m[1].trim().split(/\s+/).length <= 3) {
            overtreders.push(`${rel}:${i + 1}  ${regel.trim()}`);
          }
        }
      });
    }
    expect(
      overtreders,
      "Dit ziet eruit als een tweede naam voor een construct. Er is een naam, en die staat in " +
        "server/data/t4students.json.",
    ).toEqual([]);
  });

  it("de rapportbestanden lezen de namen uit het instrument en niet uit een eigen lijst", () => {
    // De constructnamen mogen in de rapportcode nergens als losse letterlijke
    // tekenreeks staan. De code werkt met sleutels die uit families[].constructs
    // en uit de motor komen.
    const overtreders: string[] = [];
    for (const rel of RAPPORTBESTANDEN) {
      const p = path.join(WORTEL, rel);
      if (!bestaat(p)) continue;
      const regels = zonderCommentaar(readFileSync(p, "utf-8")).split("\n");
      regels.forEach((regel, i) => {
        for (const naam of ECHTE_NAMEN) {
          if (regel.includes(`"${naam}"`) || regel.includes(`'${naam}'`)) {
            overtreders.push(`${rel}:${i + 1}  ${regel.trim()}`);
          }
        }
      });
    }
    // De duidingteksten en de voorbeeldafname mogen namen als sleutel gebruiken;
    // die staan in JSON en niet in code. In code staat geen enkele naam.
    expect(
      Array.from(new Set(overtreders)),
      "Een constructnaam staat letterlijk in de rapportcode. Lees hem uit het instrument.",
    ).toEqual([]);
  });

  it("de duidingsteksten dragen geen lang streepje en het woord driver blijft staan", () => {
    const ruw = readFileSync(
      path.join(WORTEL, "server", "data", "t4students-duidingsteksten.json"),
      "utf-8",
    );
    expect(ruw.includes("—"), "een em-dash in de duidingsteksten").toBe(false);
    expect(ruw.includes("–"), "een en-dash in de duidingsteksten").toBe(false);
    expect(/drijfve/i.test(ruw), "het woord drijfveer staat in de duidingsteksten").toBe(false);
  });

  it("in het nieuwe rapport staat geen drijfveer en geen lang streepje", () => {
    // Alleen de bestanden van het nieuwe rapport. De oudere T4Students-bestanden
    // rapport.ts en scoring.ts dragen wel lange streepjes; die zijn van voor deze
    // ronde en worden hier niet stilzwijgend meegetrokken.
    const fout: string[] = [];
    for (const rel of RAPPORTBESTANDEN) {
      const p = path.join(WORTEL, rel);
      if (!bestaat(p)) continue;
      const ruw = readFileSync(p, "utf-8");
      if (/drijfve/i.test(ruw)) fout.push(`${rel}: drijfveer`);
      if (ruw.includes("—")) fout.push(`${rel}: em-dash`);
      if (ruw.includes("–")) fout.push(`${rel}: en-dash`);
    }
    for (const rel of ["t4students-duidingsteksten.json", "t4students-rapportteksten.json"]) {
      const ruw = readFileSync(path.join(WORTEL, "server", "data", rel), "utf-8");
      if (/drijfve/i.test(ruw)) fout.push(`${rel}: drijfveer`);
      if (ruw.includes("—")) fout.push(`${rel}: em-dash`);
      if (ruw.includes("–")) fout.push(`${rel}: en-dash`);
    }
    expect(fout).toEqual([]);
  });
});
