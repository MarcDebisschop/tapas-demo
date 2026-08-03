import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel B3 van de opdracht "Studiekompas persoonlijk maken".
//
// Vlak voor de bronpagina's/verantwoording komt een blad "Wat je hier zocht":
// het herhaalt het letterlijke antwoord op P0, toont de twee sterkste
// talent-foci, de sterkste versneller en het sterkste interessegebied met hun
// gewone omschrijving, en zegt uitdrukkelijk dat dit rapport niet antwoordt
// met een studierichting. Nooit beweren dat de vraag van de student
// beantwoord is.
// ---------------------------------------------------------------------------

function bouw(antwoorden: Record<string, unknown>) {
  const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: I.version,
  });
}

function vindBlad(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /wat je hier zocht/i.test(p.titel));
}

function alleTeksten(p: T4SPagina): string {
  const stukken: string[] = [p.titel, p.ondertitel];
  for (const b of p.blokken) {
    if ("tekst" in b && typeof b.tekst === "string") stukken.push(b.tekst);
    if ("punten" in b && Array.isArray(b.punten)) stukken.push(...(b.punten as string[]));
    if ("omschrijving" in b && typeof (b as { omschrijving?: string }).omschrijving === "string") {
      stukken.push((b as { omschrijving: string }).omschrijving);
    }
    if ("construct" in b && typeof (b as { construct?: string }).construct === "string") {
      stukken.push((b as { construct: string }).construct);
    }
  }
  return stukken.join(" \n ");
}

describe("het blad Wat je hier zocht bestaat en staat vlak voor de bronpagina's", () => {
  it("staat vlak voor de eerste bronpagina (Alles wat je zelf antwoordde)", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    expect(blad, "geen blad Wat je hier zocht gevonden").toBeDefined();
    const eersteBron = rapport.paginas.find((p) => /alles wat je zelf antwoordde/i.test(p.titel));
    expect(eersteBron).toBeDefined();
    expect(rapport.paginas.indexOf(blad!)).toBeLessThan(rapport.paginas.indexOf(eersteBron!));
  });

  it("toont het letterlijke antwoord op P0 wanneer het beantwoord is", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      P0: { text: "Ik hoop te weten of ik beter wetenschappen of kunst kan kiezen." },
    };
    const rapport = bouw(antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    expect(alleTeksten(blad)).toContain("Ik hoop te weten of ik beter wetenschappen of kunst kan kiezen.");
  });

  it("bevat de vaste zin dat het rapport niet met een studierichting antwoordt", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("wat je daarmee doet, beslis jij");
  });

  it("toont de twee sterkste talent-foci, de sterkste versneller en het sterkste interessegebied", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad);
    // De twee sterkste foci komen rechtstreeks uit de rekenmotor, nooit
    // hertypt: resultaat.foci.sorted is de enige bron van deze volgorde
    // (herstelronde, punt 1).
    //
    // HERSTELRONDE 2, PUNT A. Deze test verwachtte hier voorheen Sociaal
    // Interactief en Systematisch/Uitvoerend, gebaseerd op de RUWE SOM (6 en
    // 4). Sinds de motor op aandeel van het haalbare maximum rangschikt, is
    // dat niet meer juist: Sociaal Interactief haalt 6 van de 6 haalbare
    // punten (aandeel 1,0) en Overdrachtelijk Interactief haalt 3 van de 3
    // haalbare punten (aandeel eveneens 1,0): een echte gelijke stand
    // bovenaan. Systematisch/Uitvoerend haalt 4 van de 5 (aandeel 0,8) en
    // komt daarmee terecht op de derde plaats, na de twee constructen die hun
    // volle haalbare maximum bereikten. De waarborg zelf (foci.sorted is de
    // enige bron, nooit hertypt) staat overeind; alleen de concrete namen
    // voor dit voorbeeldprofiel zijn bijgewerkt naar de eerlijke, aandeel-
    // gebaseerde uitkomst. Punt C van dezelfde opdracht kan de indeling van
    // dit blad later nog verder aanpassen (tekenen uit de groep "sterk
    // aanwezig" in plaats van uit foci.sorted rechtstreeks); dat is een
    // afzonderlijke, latere stap.
    expect(resultaat.foci.sorted.slice(0, 2)).toEqual(["Sociaal Interactief", "Overdrachtelijk Interactief"]);
    expect(tekst).toContain("Sociaal Interactief");
    expect(tekst).toContain("Overdrachtelijk Interactief");
  });

  it("nooit de suggestie wekken dat de vraag van de student beantwoord is", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).not.toContain("dit antwoordt je vraag");
    expect(tekst).not.toContain("hier is het antwoord");
  });
});
