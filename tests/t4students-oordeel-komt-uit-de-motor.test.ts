import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME, VOORBEELDAFNAME_ONVOLLEDIG } from "../server/t4students/rapport-voorbeeld";
import {
  FAM_DRIVERS,
  FAM_FOCI,
  FAM_VERSNELLERS,
  type T4SRij,
  type T4SVorm,
} from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Het oordeel op papier komt uit de motor en wordt daar niet nog eens overgedaan.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// De tekenlaag heeft herkenning en energie van elk construct in handen. Daarmee
// kan ze het oordeelwoord zelf uitrekenen, en dat is ook een tijd gebeurd. Het
// ging mis op twee manieren tegelijk. De motor leest het balanslabel van de ruwe
// herkenning van het anker-item, terwijl de rangorde op de pagina op de
// geschaalde herkenning van het hele construct staat; dat zijn twee getallen die
// uit elkaar kunnen lopen, zodat de one-page "kernsterkte" kon zeggen waar de
// motor "latent" zei. En de vijf drivers kregen zo de vier balanslabels van de
// foci en de versnellers, terwijl een driver geen talent is.
//
// WAT DEZE TEST VASTLEGT
// Elk oordeelwoord dat in de uitvoer van het rapport staat is de schrijfwijze
// van precies het woord dat de motor voor dat construct heeft teruggegeven. Gaat
// iemand het opnieuw uitrekenen, dan loopt het bij de eerste afname waar de twee
// herkenningen verschillen meteen uiteen en zakt deze test.
// ---------------------------------------------------------------------------

/** De schrijfwijze op papier van elk woord dat de motor kan teruggeven. */
const SCHRIJFWIJZE: Record<string, string> = {
  kernsterkte: "kernsterkte",
  overbelast: "overbelast",
  onderbenut: "onderbenut",
  latent: "latent",
  remmend: "remmend",
  neutraal: "neutraal",
  gaspedaal: "gaspedaal",
  te_weinig_antwoorden: "te weinig antwoorden",
  niet_van_toepassing: "niet gemeten",
};

const BALANSWOORDEN = ["kernsterkte", "overbelast", "onderbenut", "latent"];
const DRIVERWOORDEN = ["remmend", "neutraal", "gaspedaal"];

/** In welke familie een construct thuishoort, gelezen uit het instrument. */
const FAMILIE_VAN: Record<string, string> = {};
for (const f of I.families) for (const c of f.constructs) FAMILIE_VAN[c] = f.id;

function rapportVan(antwoorden: Record<string, unknown>) {
  const r = scoreStudiekompas(I, antwoorden as never, null, "nl");
  const rapport = bouwT4StudentsRapport(I, r, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: "1.0.0",
  });
  return { resultaat: r, rapport };
}

/** Elke rij die ergens in de uitvoer een oordeelwoord draagt. */
function alleRijen(rapport: ReturnType<typeof rapportVan>["rapport"]): T4SRij[] {
  const uit: T4SRij[] = [];
  for (const pagina of rapport.paginas) {
    for (const blok of pagina.blokken) {
      if (blok.soort === "banden") for (const band of blok.banden) uit.push(...band.rijen);
      else if (blok.soort === "rangtabel") uit.push(...blok.rijen);
    }
  }
  return uit;
}

/** Het woord dat de motor voor dit construct heeft bepaald. */
function motorwoord(resultaat: ReturnType<typeof rapportVan>["resultaat"], construct: string): string {
  const familie = FAMILIE_VAN[construct];
  if (familie === FAM_FOCI) return resultaat.foci.balanslabels[construct];
  if (familie === FAM_VERSNELLERS) return resultaat.versnellers.balanslabels[construct];
  if (familie === FAM_DRIVERS) return resultaat.drivers.energielabels[construct];
  return "";
}

describe("het oordeel op papier komt uit de motor", () => {
  it("er staan wel degelijk oordeelwoorden in de uitvoer", () => {
    // Tegenproef vooraf. Zonder deze zou de hele test slagen op een rapport dat
    // toevallig nergens meer een oordeel toont.
    const { rapport } = rapportVan(VOORBEELDAFNAME.antwoorden);
    const woorden = alleRijen(rapport).filter((r) => r.leeswoord !== "");
    expect(woorden.length).toBeGreaterThan(10);
  });

  it.each([
    ["een volledige afname", VOORBEELDAFNAME.antwoorden],
    ["een afname met gaten", VOORBEELDAFNAME_ONVOLLEDIG.antwoorden],
  ])("%s: elk woord op papier is het woord van de motor", (_naam, antwoorden) => {
    const { resultaat, rapport } = rapportVan(antwoorden);
    for (const rij of alleRijen(rapport)) {
      if (rij.leeswoord === "") continue;
      const verwacht = SCHRIJFWIJZE[motorwoord(resultaat, rij.construct)];
      expect(rij.leeswoord, `${rij.construct} (${FAMILIE_VAN[rij.construct]})`).toBe(verwacht);
    }
  });

  it("geen enkel woord op papier is erbij verzonnen", () => {
    const toegestaan = Object.values(SCHRIJFWIJZE);
    for (const antwoorden of [VOORBEELDAFNAME.antwoorden, VOORBEELDAFNAME_ONVOLLEDIG.antwoorden]) {
      const { rapport } = rapportVan(antwoorden);
      for (const rij of alleRijen(rapport)) {
        if (rij.leeswoord === "") continue;
        expect(toegestaan, `${rij.construct} draagt "${rij.leeswoord}"`).toContain(rij.leeswoord);
      }
    }
  });

  it("de drivers dragen nooit een balanslabel en de foci nooit een driverwoord", () => {
    const { rapport } = rapportVan(VOORBEELDAFNAME.antwoorden);
    for (const rij of alleRijen(rapport)) {
      if (rij.leeswoord === "") continue;
      const familie = FAMILIE_VAN[rij.construct];
      if (familie === FAM_DRIVERS) {
        expect(BALANSWOORDEN, `${rij.construct} is een driver`).not.toContain(rij.leeswoord);
      }
      if (familie === FAM_FOCI || familie === FAM_VERSNELLERS) {
        expect(DRIVERWOORDEN, `${rij.construct} is geen driver`).not.toContain(rij.leeswoord);
      }
    }
  });

  it("de vorm naast het woord staat alleen bij drivers en zegt hetzelfde als het woord", () => {
    // De vorm draagt de betekenis zonder kleur en zonder het woord te lezen.
    // Wijkt zij van het woord af, dan zegt de pagina twee dingen tegelijk.
    const bijWoord: Record<string, T4SVorm> = {
      gaspedaal: "stijgend",
      neutraal: "vlak",
      remmend: "dalend",
    };
    for (const antwoorden of [VOORBEELDAFNAME.antwoorden, VOORBEELDAFNAME_ONVOLLEDIG.antwoorden]) {
      const { rapport } = rapportVan(antwoorden);
      for (const rij of alleRijen(rapport)) {
        const verwacht =
          FAMILIE_VAN[rij.construct] === FAM_DRIVERS ? (bijWoord[rij.leeswoord] ?? "geen") : "geen";
        expect(rij.vorm, `${rij.construct} draagt "${rij.leeswoord}"`).toBe(verwacht);
      }
    }
  });

  it("alle drie de driverwoorden kunnen op papier vallen", () => {
    // Zonder deze tegenproef zou een driverkolom die altijd hetzelfde woord toont
    // ongemerkt door alle tests hierboven komen.
    const gezien = new Set<string>();
    for (const energy of [-2, -1, 0, 1, 2]) {
      const antwoorden = Object.fromEntries(
        ["D1", "D2", "D3", "D4", "D5", "D6", "D7"].map((i) => [i, { recognition: 2, energy }]),
      );
      const { rapport } = rapportVan(antwoorden);
      for (const rij of alleRijen(rapport)) {
        if (FAMILIE_VAN[rij.construct] === FAM_DRIVERS && rij.leeswoord) gezien.add(rij.leeswoord);
      }
    }
    for (const w of DRIVERWOORDEN) expect([...gezien], `"${w}" viel nergens`).toContain(w);
  });
});
