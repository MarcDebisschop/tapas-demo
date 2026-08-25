// Temperamentenwiel in het individuele 2MINSCAN-rapport (stap 2).
//
// Deze test kijkt naar de bron van de rapportpagina in plaats van naar een
// gerenderde DOM: de repo heeft geen jsdom-opstelling en die willen we voor deze
// stap niet toevoegen. Wat hier geborgd wordt:
//   1. de wielpagina hangt in het rapport, tussen hoofdstuk 11 en het slot;
//   2. elke nieuwe tekstsleutel bestaat in alle vier de doeltalen;
//   3. de nieuwe teksten blijven energietaal, zonder talent-, potentieel-,
//      competentie-, diagnose- of geschiktheidsclaims en zonder "creativiteit";
//   4. de inhoudsopgave blijft twaalf regels houden: de wielpagina hoort bij
//      hoofdstuk 11 en krijgt geen eigen nummer.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const wortel = process.cwd();
const paginaPad = path.join(wortel, "client/src/pages/twominscan-rapport.tsx");
const pagina = readFileSync(paginaPad, "utf8");

const vertalingen = JSON.parse(
  readFileSync(path.join(wortel, "client/src/twominscan/vertalingen.json"), "utf8"),
) as Record<string, Record<string, string>>;

const DOELTALEN = ["fr", "en", "es", "ru"] as const;

// Alle tr("sleutel", "nl-tekst")-paren uit de pagina, ook meerregelig.
function sleutelParen(bron: string): Array<{ sleutel: string; nl: string }> {
  const paren: Array<{ sleutel: string; nl: string }> = [];
  const re = /tr\(\s*"([^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bron)) !== null) {
    paren.push({ sleutel: m[1], nl: m[2].replace(/\\"/g, '"') });
  }
  return paren;
}

const alleParen = sleutelParen(pagina);
const wielParen = alleParen.filter((p) => p.sleutel.startsWith("ui.h11wiel."));

describe("2MINSCAN-rapport — wielpagina aangesloten", () => {
  it("importeert de module en rendert de wielpagina tussen hoofdstuk 11 en het slot", () => {
    expect(pagina).toContain('from "@/temperamentenwiel"');
    const iH11 = pagina.indexOf("<H11 data=");
    const iWiel = pagina.indexOf("<H11Wiel data=");
    const iSlot = pagina.indexOf("<Slot data=");
    expect(iH11).toBeGreaterThan(-1);
    expect(iWiel).toBeGreaterThan(iH11);
    expect(iSlot).toBeGreaterThan(iWiel);
  });

  it("laat de wielpositie en de kleurvolgorde uit hetzelfde profiel komen", () => {
    const blok = pagina.slice(pagina.indexOf("function H11Wiel"), pagina.indexOf("// ---- Slot ----"));
    expect(blok).toContain("positieByWielpositie(data.wielpositie)");
    expect(blok).toContain("volgorde={data.profiel.kleurvolgorde}");
    // Geen eigen bron of eigen kleurenlijst in de pagina.
    expect(blok).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("valt stil terug wanneer de wielpositie onbekend is", () => {
    const blok = pagina.slice(pagina.indexOf("function H11Wiel"), pagina.indexOf("// ---- Slot ----"));
    expect(blok).toContain("if (!positie) return null;");
  });

  it("houdt de inhoudsopgave op twaalf regels", () => {
    const inhoud = pagina.slice(pagina.indexOf("function Inhoud"), pagina.indexOf("function Leeswijzer"));
    const regels = inhoud.split("\n").find((r) => r.includes("Een persoonlijke uitnodiging"));
    expect(regels).toBeTruthy();
    expect(inhoud).toContain("String(i + 1).padStart(2");
    const items = inhoud.slice(inhoud.indexOf("itemsNl = ["), inhoud.indexOf("];"));
    expect(items.split('"').length - 1).toBe(24); // 12 titels × 2 aanhalingstekens
  });
});

describe("2MINSCAN-rapport — wielpagina vertaald", () => {
  it("gebruikt minstens acht nieuwe tekstsleutels", () => {
    expect(wielParen.length).toBeGreaterThanOrEqual(8);
  });

  for (const taal of DOELTALEN) {
    it(`heeft elke wielsleutel in ${taal}`, () => {
      const map = vertalingen[taal];
      expect(map).toBeTruthy();
      for (const { sleutel } of wielParen) {
        expect(typeof map[sleutel], `${taal} mist ${sleutel}`).toBe("string");
        expect(map[sleutel].length).toBeGreaterThan(0);
      }
    });
  }
});

describe("2MINSCAN-rapport — energietaal op de wielpagina", () => {
  const verboden = [
    "talent",
    "potentieel",
    "competentie",
    "creativiteit",
    "diagnose",
    "geschikt",
    "score",
    "beter dan",
  ];

  it("houdt de Nederlandse teksten in energietaal", () => {
    for (const { sleutel, nl } of wielParen) {
      const laag = nl.toLowerCase();
      for (const woord of verboden) {
        expect(laag.includes(woord), `${sleutel} bevat "${woord}"`).toBe(false);
      }
    }
  });

  it("zegt uitdrukkelijk dat het wiel geen prestatie of hoeveelheid energie meet", () => {
    const lezen = wielParen.find((p) => p.sleutel === "ui.h11wiel.lezen.tekst");
    expect(lezen).toBeTruthy();
    expect(lezen!.nl.toLowerCase()).toContain("zegt niets over");
  });

  it("benoemt het wiel als energetische gedragsvisualisatie", () => {
    const lead = wielParen.find((p) => p.sleutel === "ui.h11wiel.lead");
    expect(lead).toBeTruthy();
    expect(lead!.nl.toLowerCase()).toContain("energetische gedragsvisualisatie");
  });
});
