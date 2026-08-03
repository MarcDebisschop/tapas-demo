import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt C: de bladen "In één zin" en "Wat je hier zocht"
// putten voortaan uit de groep sterk aanwezig (op aandeel), niet meer
// rechtstreeks uit rang 1 van de motor.
//
// Het gewone voorbeeldprofiel (VOORBEELDAFNAME) heeft altijd hoogstens twee
// gelijke hoogste aandelen en heeft nooit een lege groep sterk aanwezig,
// dus deze test bouwt twee eigen antwoordsets die de twee gevallen uit punt
// C wel raken: drie gelijke hoogste aandelen bij talent-foci, en een lege
// groep sterk aanwezig bij talent-foci.
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

function vindEenZin(paginas: T4SPagina[]): T4SPagina {
  const blad = paginas.find((p) => /^in één zin$/i.test(p.titel));
  expect(blad, "geen blad In één zin gevonden").toBeDefined();
  return blad!;
}

function vindWatJeHierZocht(paginas: T4SPagina[]): T4SPagina {
  const blad = paginas.find((p) => /wat je hier zocht/i.test(p.titel));
  expect(blad, "geen blad Wat je hier zocht gevonden").toBeDefined();
  return blad!;
}

function alleTeksten(p: T4SPagina): string {
  const stukken: string[] = [p.titel, p.ondertitel];
  for (const b of p.blokken) {
    if ("tekst" in b && typeof b.tekst === "string") stukken.push(b.tekst);
    if ("kop" in b && typeof (b as { kop?: unknown }).kop === "string") stukken.push((b as { kop: string }).kop);
    if ("punten" in b && Array.isArray((b as { punten?: unknown }).punten)) {
      stukken.push(...((b as { punten: string[] }).punten));
    }
  }
  return stukken.join(" \n ");
}

describe("In één zin en Wat je hier zocht putten uit de groep sterk aanwezig (herstelronde 2, punt C)", () => {
  it("benoemt twee talent-foci en meldt het aantal, wanneer drie constructen gelijk op het hoogste aandeel staan", () => {
    // Functioneel Innovatief, Artistiek Innovatief en Complexiteit/Conceptueel
    // staan alle drie op aandeel 1,0 (herkenning 3 van 3): een echt drievoudig
    // gelijkspel op de hoogste plaats binnen sterk aanwezig.
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      F1: { recognition: 3, energy: 1 },
      F2: { recognition: 3, energy: 2 },
      F3: { recognition: 3, energy: 0 },
      F6: { recognition: 2, energy: 2 },
      F7: { recognition: 1, energy: 0 },
      F8: { recognition: 2, energy: 1 },
    };
    const rapport = bouw(antwoorden);
    const blad = vindEenZin(rapport.paginas);
    const eersteZin = (blad.blokken[0] as { tekst: string }).tekst;
    // Precies twee van de drie bouwstenen worden benoemd in de samenvattende
    // zin zelf (de bouwstenen komen uit rapportteksten.json en zijn geen
    // constructnamen, dus dit controleert de echte D1-zin, niet toevallig
    // gelijke tekst elders op het blad zoals bij de balanslabels).
    const bouwstenen = {
      "Functioneel Innovatief": "dingen die niet werken opnieuw kunt bedenken",
      "Artistiek Innovatief": "met verbeelding iets kunt laten ontstaan",
      "Complexiteit/Conceptueel": "ingewikkelde dingen kunt doordenken",
    };
    const genoemd = Object.values(bouwstenen).filter((b) => eersteZin.includes(b));
    expect(genoemd).toHaveLength(2);
    // En er staat een zin bij die zegt dat er drie even sterk uitkwamen.
    const tekst = alleTeksten(blad);
    expect(tekst).toContain("drie onderdelen even sterk naar voren");
  });

  it("valt terug op het middenveld en zegt dat niets sterk uitkomt, wanneer de groep sterk aanwezig leeg is voor talent-foci", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      F1: { recognition: 1, energy: 1 },
      F2: { recognition: 1, energy: 2 },
      F3: { recognition: 1, energy: 0 },
      F6: { recognition: 1, energy: 2 },
      F7: { recognition: 1, energy: 0 },
      F8: { recognition: 0, energy: 1 },
      F4: { choice: "a" },
      F5: { choice: "a" },
    };
    const rapport = bouw(antwoorden);
    const blad = vindEenZin(rapport.paginas);
    const tekst = alleTeksten(blad);
    // De hoogste in het middenveld voor foci is Systematisch/Uitvoerend.
    expect(tekst).toContain("Systematisch/Uitvoerend");
    expect(tekst.toLowerCase()).toContain("niets in dit beeld sterk uitkomen");
  });

  it("toont op Wat je hier zocht ook de terugval op het middenveld, wanneer sterk aanwezig leeg is", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      F1: { recognition: 1, energy: 1 },
      F2: { recognition: 1, energy: 2 },
      F3: { recognition: 1, energy: 0 },
      F6: { recognition: 1, energy: 2 },
      F7: { recognition: 1, energy: 0 },
      F8: { recognition: 0, energy: 1 },
      F4: { choice: "a" },
      F5: { choice: "a" },
    };
    const rapport = bouw(antwoorden);
    const blad = vindWatJeHierZocht(rapport.paginas);
    const tekst = alleTeksten(blad);
    expect(tekst).toContain("Systematisch/Uitvoerend");
    expect(tekst.toLowerCase()).toContain("niets in dit beeld sterk uitkomen");
  });

  it("benoemt op Wat je hier zocht twee talent-foci uit de groep sterk aanwezig, net als vroeger uit rang 1 en 2", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindWatJeHierZocht(rapport.paginas);
    const tekst = alleTeksten(blad);
    expect(tekst).toContain("Sociaal Interactief");
    expect(tekst).toContain("Overdrachtelijk Interactief");
  });
});
