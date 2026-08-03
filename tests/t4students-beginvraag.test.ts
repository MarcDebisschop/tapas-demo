import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT, t4studentsItems, T4STUDENTS_AANTAL_ITEMS } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import type { T4SAntwoorden } from "../server/t4students/kompas-scoring";

// ---------------------------------------------------------------------------
// Onderdeel B1 van de opdracht "Studiekompas persoonlijk maken".
//
// Een open beginvraag komt vóór alle andere vragen: "Welke vraag of vragen
// hoop je dat deze vragenlijst voor jou duidelijk of duidelijker kan maken?"
// Ze telt niet mee in enige score, in geen enkele rangorde en niet in het
// signaalgetal, en is niet verplicht.
//
// Vóór de bouw is dit rood: het item bestaat nog niet.
// ---------------------------------------------------------------------------

describe("de open beginvraag bestaat en staat vóór alle andere items", () => {
  it("het eerste item van het instrument is de beginvraag P0", () => {
    const items = t4studentsItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBe("P0");
    expect(items[0].itemType).toBe("open-intro");
  });

  it("de beginvraag heeft de letterlijke tekst in het Nederlands, Frans en Engels", () => {
    const p0 = t4studentsItems().find((i) => i.id === "P0");
    expect(p0).toBeDefined();
    expect(p0!.text!.nl).toBe(
      "Welke vraag of vragen hoop je dat deze vragenlijst voor jou duidelijk of duidelijker kan maken?",
    );
    expect(p0!.text!.fr).toBeTruthy();
    expect(p0!.text!.en).toBeTruthy();
  });

  it("de beginvraag hoort bij geen enkele familie die in scoring meetelt", () => {
    const p0 = t4studentsItems().find((i) => i.id === "P0");
    expect(p0).toBeDefined();
    const familieIds = T4STUDENTS_INSTRUMENT.families.map((f) => f.id);
    expect(familieIds).not.toContain(p0!.family);
  });
});

describe("de beginvraag telt nergens mee in score, rangorde of signaalgetal", () => {
  it("de beginvraag staat niet in enige voedingslijst van de scoringMap", () => {
    const sm = T4STUDENTS_INSTRUMENT.scoringMap;
    expect(Object.keys(sm.recognitionItems)).not.toContain("P0");
    expect(Object.keys(sm.beeldItems)).not.toContain("P0");
    expect(Object.keys(sm.motivationItems)).not.toContain("P0");
    expect(Object.keys(sm.interestItems)).not.toContain("P0");
    expect(sm.energyItems).not.toContain("P0");
    expect(sm.sjtItems).not.toContain("P0");
  });

  it("het signaalgetal totaalItems verandert niet door de beginvraag toe te voegen", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, {}, null, "nl");
    // 39 bestaande items uit fase 1b, de beginvraag telt niet mee.
    expect(resultaat.betrouwbaarheid.totaalItems).toBe(39);
  });

  it("een antwoord op de beginvraag beïnvloedt geen enkele score", () => {
    const zonder = scoreStudiekompas(T4STUDENTS_INSTRUMENT, {}, null, "nl");
    const antwoorden: T4SAntwoorden = { P0: { text: "Ik hoop te weten of ik wetenschappen moet kiezen." } as any };
    const met = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(met.betrouwbaarheid.totaalSignaal).toBe(zonder.betrouwbaarheid.totaalSignaal);
    expect(met.betrouwbaarheid.totaalItems).toBe(zonder.betrouwbaarheid.totaalItems);
    expect(JSON.stringify(met.constructs)).toBe(JSON.stringify(zonder.constructs));
  });

  it("T4STUDENTS_AANTAL_ITEMS blijft de bekende telling exclusief de beginvraag", () => {
    // De beginvraag is toegevoegd aan het instrument maar is geen "vraag" in
    // de zin van iets dat meetelt in de omvang van de vragenlijst voor de
    // registerbeschrijving; ze blijft daarom buiten deze telling.
    expect(T4STUDENTS_AANTAL_ITEMS).toBe(39);
  });
});
