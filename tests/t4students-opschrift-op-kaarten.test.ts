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
