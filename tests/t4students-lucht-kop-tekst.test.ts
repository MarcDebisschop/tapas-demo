import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Opmaakherstel-2, punt 2: er zit geen lucht tussen de kop van een kaart en
// de tekst eronder. In het referentiebeeld zit daar duidelijk ruimte. Deze
// test legt vast dat er, na de kopregel (getekend op y + KOP_Y_OFFSET, met
// een lettergrootte van ongeveer 11.5), een vaste, merkbare tussenruimte zit
// voor de eerste regel tekst begint, en een iets kleinere tussen het
// opschriftje en de kop. Het gaat om de bloksoorten "kader" en "kaartvlak"
// (de "citaat"-uitleg voor het aanhalingsteken staat los omdat dat blok
// meerdere regels kan hebben).
//
// We meten dit aan de broncode: het verschil tussen de y-positie van de kop
// (blok.kop) en de y-positie waar de hoofdtekst (blok.tekst) begint moet
// minstens 15 punten zijn (bij een koplettergrootte van 11.5 valt de
// basislijn-op-basislijn-afstand van een enkele regel doorgaans rond de
// 13-14 punten; 15 of meer laat dus zichtbare lucht over de vorige situatie
// van 14 punten, wat tegen de kop aan plakte).
// ---------------------------------------------------------------------------

function leesTekenaar(): string {
  return readFileSync(join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"), "utf-8");
}

function pakCase(bron: string, soort: string): string {
  const marker = `function tekenBlok(`;
  const startTeken = bron.indexOf(marker);
  const tekenBlokBron = bron.slice(startTeken);
  const caseMarker = `case "${soort}": {`;
  const caseStart = tekenBlokBron.indexOf(caseMarker);
  expect(caseStart, `case "${soort}" niet gevonden binnen tekenBlok()`).toBeGreaterThan(-1);
  const na = tekenBlokBron.slice(caseStart + caseMarker.length);
  const volgendeCase = na.search(/\n\s*case "/);
  return na.slice(0, volgendeCase > -1 ? volgendeCase : na.length);
}

// Herstel, punt 1 en 4: het "kaartvlak"-blok tekent zijn hoofdtekst niet
// langer als het kale blok.tekst, maar als een tussenvariabele (bijvoorbeeld
// kaartvlakTekst) die bij citaatstijl blok.tekst tussen aanhalingstekens
// zet. De vindplaats hieronder is daarom verlegd: naast het letterlijke
// "blok.tekst" wordt ook een variabele herkend die is toegekend met een
// uitdrukking waar "blok.tekst" in voorkomt (bijvoorbeeld
// "const kaartvlakTekst = blok.citaatstijl ? ... blok.tekst;"). De bewaakte
// meting zelf (het aantal punten tussen kop en tekst) blijft ongewijzigd.
function vindTekstvariabele(code: string): string | null {
  const m = code.match(/const (\w+) = [^\n;]*blok\.tekst[^\n;]*;/);
  return m ? m[1] : null;
}

// Opmaakherstel-3, punt 3: een ingetogen vlak zonder kop houdt de regel waar
// de kop zou staan niet langer open. Het beginpunt van de hoofdtekst staat
// daarom niet meer als een vast getal in de aanroep, maar als een
// tussenvariabele: "const tekstY = y + 22 + kopH + omschrijvingH;", waarbij
// kopH de hoogte van die ene kopregel is (nul als er geen kop is). Voor de
// meting hieronder geldt het geval MET kop, want alleen dan bestaat er een
// afstand tussen kop en tekst. We lezen die kophoogte uit de constante in de
// broncode, zodat de test niet met een eigen getal gaat rekenen.
function constanteUitBron(bron: string, naam: string): number {
  const m = bron.match(new RegExp(`const ${naam} = ([0-9.]+);`));
  expect(m, `constante ${naam} niet gevonden in rapport-pdf.ts`).not.toBeNull();
  return Number(m![1]);
}

/**
 * Het beginpunt van de hoofdtekst in een vlak dat zijn kopregel overslaat als
 * er geen kop is: het vaste getal uit "const tekstY = y + N + kopH" plus de
 * hoogte van de kopregel zelf.
 */
function tekstYViaKopHoogte(code: string, bron: string): number | null {
  const m = code.match(/const tekstY = y \+ ([0-9.]+) \+ kopH/);
  if (!m) return null;
  return Number(m[1]) + constanteUitBron(bron, "KAARTVLAK_KOP_H");
}

/** Haalt het getal na "y + " uit een regel met blok.kop of blok.tekst. */
function yOffsetVan(code: string, veld: "blok.kop" | "blok.tekst", bron?: string): number {
  if (veld === "blok.tekst" && bron) {
    const viaKop = tekstYViaKopHoogte(code, bron);
    if (viaKop != null) return viaKop;
  }
  const regex = new RegExp(`doc\\.text\\(${veld.replace(".", "\\.")},[^\\n]*y \\+ ([0-9.]+)`);
  const schrijfRegex = new RegExp(`schrijf\\(doc, ${veld.replace(".", "\\.")},[^\\n]*y \\+ ([0-9.]+)`);
  let m = code.match(regex) ?? code.match(schrijfRegex);
  if (!m && veld === "blok.tekst") {
    const variabele = vindTekstvariabele(code);
    if (variabele) {
      const variabeleRegex = new RegExp(`schrijf\\(doc, ${variabele},[^\\n]*y \\+ ([0-9.]+)`);
      m = code.match(variabeleRegex);
    }
  }
  expect(m, `geen y-positie gevonden voor ${veld}`).not.toBeNull();
  return Number(m![1]);
}

describe("lucht tussen de kop van een kaart en de tekst eronder", () => {
  it("kader: de afstand tussen de kop en de eerste tekstregel is minstens 15 punten", () => {
    const code = pakCase(leesTekenaar(), "kader");
    const kopY = yOffsetVan(code, "blok.kop");
    const tekstY = yOffsetVan(code, "blok.tekst");
    expect(tekstY - kopY).toBeGreaterThanOrEqual(15);
  });

  it("kaartvlak: de afstand tussen de kop en de eerste tekstregel is minstens 15 punten", () => {
    const bron = leesTekenaar();
    const code = pakCase(bron, "kaartvlak");
    const kopY = yOffsetVan(code, "blok.kop");
    const tekstY = yOffsetVan(code, "blok.tekst", bron);
    expect(tekstY - kopY).toBeGreaterThanOrEqual(15);
  });

  it("kader: de afstand tussen het opschriftje en de kop is kleiner dan die tussen de kop en de tekst", () => {
    const code = pakCase(leesTekenaar(), "kader");
    // kapitalen() tekent het opschrift op y + N; de kop staat op y + M.
    const opschriftMatch = code.match(/kapitalen\(doc, blok\.opschrift, x \+ 16, y \+ ([0-9.]+)/);
    expect(opschriftMatch, "geen y-positie gevonden voor het opschrift").not.toBeNull();
    const opschriftY = Number(opschriftMatch![1]);
    const kopY = yOffsetVan(code, "blok.kop");
    const kopTekstAfstand = yOffsetVan(code, "blok.tekst") - kopY;
    expect(kopY - opschriftY).toBeLessThan(kopTekstAfstand);
  });

  // De dankkaart op het slotblad is van het soort "kaartvlak" (het getinte
  // vlak), terwijl de uitlegkaarten van het soort "kader" zijn (het witte
  // vlak). Deze test legt vast dat de afstand tussen de kop en de eerste
  // tekstregel in beide bloksoorten precies even groot is, zodat de eerste
  // tekstregel in een getint vlak niet dichter tegen de kop plakt dan in een
  // wit vlak.
  it("de afstand tussen kop en tekst is in het getinte vlak (kaartvlak) even groot als in het witte vlak (kader)", () => {
    const bron = leesTekenaar();
    const kaderCode = pakCase(bron, "kader");
    const kaartvlakCode = pakCase(bron, "kaartvlak");
    const kaderAfstand = yOffsetVan(kaderCode, "blok.tekst") - yOffsetVan(kaderCode, "blok.kop");
    const kaartvlakAfstand = yOffsetVan(kaartvlakCode, "blok.tekst", bron) - yOffsetVan(kaartvlakCode, "blok.kop");
    expect(kaartvlakAfstand).toBe(kaderAfstand);
  });
});
