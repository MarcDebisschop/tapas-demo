import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel-2, punt 1 en punt 4: wat de student zelf letterlijk schreef,
// hoort in het INGETOGEN VLAK (getint, zonder balk, schuin en tussen
// aanhalingstekens), nooit in de UITLEGKAART (wit, met balk). Op het blad
// "Dit hoopte je te vinden" (pagina 3) staat het antwoord dat de student
// helemaal aan het begin gaf op "wat hoopte je dat deze vragenlijst
// duidelijk zou maken". Dat antwoord werd per ongeluk als "kader" (de witte
// uitlegkaart) getekend, met het opschrift "JOUW EIGEN WOORDEN" erboven —
// een tegenstrijdigheid: het opschrift zegt dat het om eigen woorden gaat,
// maar de kaartsoort was die van de uitleg. Deze test legt vast dat het
// blok met de eigen tekst van de student nooit van het soort "kader" is.
// ---------------------------------------------------------------------------

function bouwRapport() {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
}

function vindPagina(paginas: ReturnType<typeof bouwRapport>["paginas"], titelDeel: string) {
  const p = paginas.find((p) => p.titel.toLowerCase().includes(titelDeel.toLowerCase()));
  expect(p, `geen pagina gevonden met titel die "${titelDeel}" bevat`).toBeDefined();
  return p!;
}

describe("het blad Dit hoopte je te vinden toont de eigen tekst van de student in het ingetogen vlak", () => {
  it("het blok met de letterlijke tekst van de student is geen uitlegkaart (kader)", () => {
    const rapport = bouwRapport();
    const pagina = vindPagina(rapport.paginas, "Dit hoopte je te vinden");
    // Het antwoord van de voorbeeldafname op de openingsvraag staat er
    // letterlijk in; zoek het blok dat die tekst draagt.
    const p0Tekst = (VOORBEELDAFNAME.antwoorden["P0"] as { text?: string } | undefined)?.text?.trim();
    expect(p0Tekst, "de voorbeeldafname heeft geen antwoord op P0").toBeTruthy();
    const blokMetTekst = pagina.blokken.find((b) => {
      if ("tekst" in b && typeof b.tekst === "string" && b.tekst === p0Tekst) return true;
      if ("regels" in b) {
        return (b as Extract<T4SBlok, { soort: "citaat" }>).regels.some((r) => r.herkenning === p0Tekst);
      }
      return false;
    });
    expect(blokMetTekst, "geen blok gevonden dat de letterlijke tekst van de student draagt").toBeDefined();
    expect(
      blokMetTekst!.soort,
      "het blok met de eigen tekst van de student is een 'kader' (de witte uitlegkaart): dat hoort het ingetogen vlak te zijn",
    ).not.toBe("kader");
  });
});
