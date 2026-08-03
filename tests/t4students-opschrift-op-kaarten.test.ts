import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Ingreep 3, punt 1 van de opdracht "Slotnoot en opmaak": elke kaart in het
// Studiekompas draagt een vast opschriftje boven de kop, in kleine kapitalen
// en in een accentkleur. Het opschriftje benoemt telkens wat voor soort blok
// het is (bijvoorbeeld WAT AL STERK IS) en is bij de bestaande blokken gevuld
// met wat er al feitelijk staat, zonder een nieuwe bewering.
//
// WAT DEZE TEST ECHT MEET
// Ze rekent het echte voorbeeldprofiel door de motor en de rapportlaag en
// doorzoekt de werkelijk gebouwde bladen op de blokken "kader" en "citaat"
// (de kaart met een balk aan de linkerrand) en "kaartvlak" (het nieuwe warme
// vlak zonder balk). Van elk van die kaarten die een kop draagt, moet het
// veld "opschrift" een niet-lege tekst zijn.
// ---------------------------------------------------------------------------

function bouw(): T4SPagina[] {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
  return rapport.paginas;
}

/** Alle blokken van het soort kader, citaat of kaartvlak, met hun pagina erbij. */
function kaartBlokken(paginas: T4SPagina[]): { pagina: T4SPagina; blok: T4SBlok }[] {
  const uit: { pagina: T4SPagina; blok: T4SBlok }[] = [];
  for (const pagina of paginas) {
    for (const blok of pagina.blokken) {
      if (blok.soort === "kader" || blok.soort === "citaat" || blok.soort === "kaartvlak") {
        uit.push({ pagina, blok });
      }
    }
  }
  return uit;
}

describe("elke kaart in het Studiekompas draagt een opschriftje boven de kop", () => {
  it("bevat minstens een kaart van het soort kader of citaat", () => {
    const kaarten = kaartBlokken(bouw());
    expect(kaarten.length).toBeGreaterThan(0);
  });

  it("elke kaart (kader, citaat, kaartvlak) heeft een niet-leeg opschrift", () => {
    const kaarten = kaartBlokken(bouw());
    for (const { pagina, blok } of kaarten) {
      const opschrift = (blok as unknown as { opschrift?: string }).opschrift;
      expect(
        typeof opschrift === "string" && opschrift.trim().length > 0,
        `pagina ${pagina.nr} (${pagina.titel}), blok ${blok.soort}: mist een opschriftje`,
      ).toBe(true);
    }
  });

  it("het opschriftje bij WAT AL STERK IS op het slotblad is precies dat", () => {
    const paginas = bouw();
    const slot = paginas.find((p) => /een zin om mee te nemen/i.test(p.titel));
    expect(slot, "geen slotblad Een zin om mee te nemen gevonden").toBeDefined();
    const kaarten = kaartBlokken([slot!]);
    const gevonden = kaarten.some(
      (k) => (k.blok as unknown as { opschrift?: string }).opschrift === "WAT AL STERK IS",
    );
    expect(gevonden, "geen kaart met opschrift WAT AL STERK IS op het slotblad").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Herstelronde: op blad 3 ("Dit hoopte je te vinden") bleek bij visuele
// controle een blok met een gekleurde balk maar zonder opschriftje. Bij
// onderzoek bleek dit het soort "intro" te zijn: een inleidende alinea zonder
// kop, die in het hele rapport tweeentwintig keer voorkomt, altijd bovenaan
// een hoofdstuk, nooit als losstaande kaart met een titel. Dat is geen fout:
// een opschriftje hoort bij een kaart met een kop, en "intro" heeft geen kop.
// Ditzelfde geldt voor "constructblok": dat blok tekent ook een balk, maar is
// een herhaald lijst-item (er staan er vaak meerdere na elkaar) met de
// constructnaam zelf als kop, geen losstaande kaart uit de opdracht.
//
// Deze test legt daarom het bredere principe vast: van alle bloksoorten die
// een gekleurde balk aan de linkerrand tekenen, zijn "kader" en "citaat" de
// enige die een eigen kop dragen naast de balk, en die dragen altijd een
// niet-leeg opschriftje. "intro" is bewust vrijgesteld om de hierboven
// genoemde reden. Zo kan een balk-blok met een kop nooit zonder opschriftje
// verschijnen, en is de vrijstelling van de andere balk-soort expliciet in
// code vastgelegd in plaats van stilzwijgend.
// ---------------------------------------------------------------------------
describe("een blok met een gekleurde balk en een kop heeft altijd een opschriftje", () => {
  /** Bloksoorten die een gekleurde balk aan de linkerrand tekenen (rapport-pdf.ts). */
  const BALK_SOORTEN = ["intro", "citaat", "kader"] as const;
  /** Van de balk-soorten dragen alleen deze een eigen kop naast de balk. */
  const BALK_MET_KOP = ["citaat", "kader"] as const;

  it("elk balk-blok met een kop (kader, citaat) heeft een niet-leeg opschrift", () => {
    const paginas = bouw();
    for (const pagina of paginas) {
      for (const blok of pagina.blokken) {
        if (!(BALK_SOORTEN as readonly string[]).includes(blok.soort)) continue;
        if (!(BALK_MET_KOP as readonly string[]).includes(blok.soort)) continue;
        const opschrift = (blok as unknown as { opschrift?: string }).opschrift;
        expect(
          typeof opschrift === "string" && opschrift.trim().length > 0,
          `pagina ${pagina.nr} (${pagina.titel}), blok ${blok.soort}: balk met kop maar zonder opschriftje`,
        ).toBe(true);
      }
    }
  });

  it("intro-blokken dragen geen kop en dus terecht geen opschrift-veld", () => {
    const paginas = bouw();
    let introTelling = 0;
    for (const pagina of paginas) {
      for (const blok of pagina.blokken) {
        if (blok.soort !== "intro") continue;
        introTelling++;
        expect("opschrift" in blok, `pagina ${pagina.nr}: intro-blok heeft onverwacht een opschrift-veld`).toBe(
          false,
        );
      }
    }
    // Het rapport bevat effectief intro-blokken; anders test dit niets.
    expect(introTelling).toBeGreaterThan(0);
  });
});
