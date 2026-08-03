import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { rangschik, FAM_VERSNELLERS, FAM_FOCI } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt B: geen genummerde rangorde meer, wel drie groepen.
//
// WAT ER MOET GELDEN
// Een genummerde plaats van 1 tot 6 suggereert een nauwkeurigheid die dit
// aantal vragen niet kan dragen. In plaats daarvan krijgt elk construct een
// groep, op basis van het aandeel (de herkenning op de schaal van 0 tot 3,
// wat neerkomt op aandeel * 3):
//   - sterk aanwezig: aandeel van 2 tot en met 3
//   - middenveld: aandeel van 1 tot onder 2
//   - minder aanwezig: aandeel onder 1
//
// Binnen een groep staan de constructen nog wel op aandeel onder elkaar,
// maar zonder plaatsnummer.
// ---------------------------------------------------------------------------

describe("punt B: rangschik() geeft een groep terug in plaats van een plaatsnummer", () => {
  it("een construct met aandeel 3 (volle score) valt in sterk aanwezig", () => {
    // Impact: enig item V4, max 3. Recognition 3 geeft aandeel 1,0, dus
    // herkenning (geschaald) = 3,0.
    const antwoorden = { V4: { recognition: 3 } };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const rij = dim.gerangschikt.find((r) => r.construct === "Impact")!;
    expect(rij.herkenning).toBe(3);
    expect(rij.groep).toBe("sterk aanwezig");
  });

  it("een construct met aandeel precies 2 op de schaal van 0 tot 3 valt nog in sterk aanwezig (grens inbegrepen)", () => {
    // Groepsondersteunend: herkenningsitems V3, D5, F5, S1, max 6 (zie
    // server/t4students/voeding.ts). S1 draagt zelf geen lading voor dit
    // construct maar moet wel beantwoord zijn, anders telt het construct als
    // onvolledig ("geen half oordeel"). Ruwe herkenning V3=2 plus D5(b) en
    // F5(a) elk lading 1 geeft 4 op 6, aandeel 0,6667, geschaald exact 2,0.
    const antwoorden = {
      V3: { recognition: 2, energy: 0 },
      D5: { choice: "b" },
      F5: { choice: "a" },
      S1: { choice: "overzicht" },
    };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const rij = dim.gerangschikt.find((r) => r.construct === "Groepsondersteunend")!;
    expect(rij.herkenning).toBe(2);
    expect(rij.groep).toBe("sterk aanwezig");
  });

  it("een construct met aandeel net onder 2 op de schaal van 0 tot 3 valt in middenveld", () => {
    // Groepsondersteunend, zelfde opbouw als hierboven maar met optie b bij
    // F5, die geen lading naar Groepsondersteunend draagt: ruwe herkenning
    // 3 op 6, aandeel 0,5, geschaald 1,5.
    const antwoorden = {
      V3: { recognition: 2, energy: 0 },
      D5: { choice: "b" },
      F5: { choice: "b" },
      S1: { choice: "overzicht" },
    };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const rij = dim.gerangschikt.find((r) => r.construct === "Groepsondersteunend")!;
    expect(rij.herkenning).toBe(1.5);
    expect(rij.groep).toBe("middenveld");
  });

  it("een construct met aandeel precies 1 op de schaal van 0 tot 3 valt nog in middenveld (grens inbegrepen)", () => {
    // Resultaat: items V5, F4, S1, max 5. Ruwe herkenning van 5/3 zou
    // geschaald exact 1,0 geven, maar dat getal is niet heel. Gebruik in
    // plaats daarvan Constructief onderscheidend (max 3): ruwe herkenning 1
    // geeft aandeel 1/3, geschaald 1,0 op de kop.
    const antwoorden = { V6: { recognition: 1 } };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const rij = dim.gerangschikt.find((r) => r.construct === "Constructief onderscheidend")!;
    expect(rij.herkenning).toBe(1);
    expect(rij.groep).toBe("middenveld");
  });

  it("een construct met aandeel onder 1 op de schaal van 0 tot 3 valt in minder aanwezig", () => {
    const antwoorden = { V6: { recognition: 0 } };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const rij = dim.gerangschikt.find((r) => r.construct === "Constructief onderscheidend")!;
    expect(rij.herkenning).toBe(0);
    expect(rij.groep).toBe("minder aanwezig");
  });

  it("een niet-ingevuld construct heeft geen groep", () => {
    const antwoorden = { V4: { recognition: 3 } };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_VERSNELLERS);
    const nietIngevuld = dim.zonderOordeel;
    expect(nietIngevuld.length).toBeGreaterThan(0);
    for (const r of nietIngevuld) expect(r.groep).toBeNull();
  });

  it("de groep komt uitsluitend uit het aandeel, nooit uit een plaatsnummer", () => {
    // Twee constructen met een verschillend haalbaar maximum maar hetzelfde
    // aandeel horen in dezelfde groep, ook al staan ze niet op dezelfde
    // plaats in de lijst.
    const antwoorden = {
      F1: { recognition: 3 }, // Functioneel Innovatief, max 3, aandeel 1,0
      F7: { recognition: 4, energy: 0 }, // Systematisch/Uitvoerend bijdrage
      F4: { choice: "a" },
    };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, FAM_FOCI);
    const fi = dim.gerangschikt.find((r) => r.construct === "Functioneel Innovatief")!;
    expect(fi.groep).toBe("sterk aanwezig");
  });
});

describe("punt B (vervolg): evenSterk moet op het aandeel werken, niet op de ruwe motorscore", () => {
  it("twee drivers met gelijke ruwe score maar ongelijk aandeel zijn geen echt gelijkspel meer", () => {
    // Be Strong (max 8: D7, D5, D6, F5) en Try Hard (max 3: enkel D3) op
    // ruw 3: dat is het voorbeeld uit de opdracht zelf
    // (opdracht-herstelronde-2.md, "Achtergrond die je moet kennen"). Op de
    // ruwe score zijn ze gelijk (3 = 3), op het aandeel niet
    // (3/8 = 0,375 tegenover 3/3 = 1,0). Voor deze reparatie kende
    // rangschik() ze dezelfde rang toe en zette ze binnen de marge, wat de
    // aandeel-maatstaf van punt A tegenspreekt.
    //
    // Be Strong: D7 (eigen item) recognition 3. D5="b" en D6="b" leggen geen
    // lading op Be Strong (zie server/data/t4students.json); F5="a" evenmin.
    // Zo blijft Be Strong op ruwe herkenning 3 staan, aandeel 3/8.
    // Try Hard: D3 (enige herkenningsitem) recognition 3, aandeel 3/3 = 1,0.
    const antwoorden = {
      D7: { recognition: 3, energy: 0 },
      D5: { choice: "b" },
      D6: { choice: "b" },
      F5: { choice: "a" },
      D3: { recognition: 3, energy: 0 },
    };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, "Drivers" as any);
    const beStrong = dim.gerangschikt.find((r) => r.construct === "Be Strong")!;
    const tryHard = dim.gerangschikt.find((r) => r.construct === "Try Hard")!;

    // Vooropstelling: de ruwe scores zijn inderdaad gelijk.
    expect((beStrong as any)._ruweScore).toBe(3);
    expect((tryHard as any)._ruweScore).toBe(3);

    // Het aandeel loopt fors uiteen: Be Strong 0,375, Try Hard 1,0 op de
    // schaal van 0 tot 3 dus 1,125 tegenover 3,0. Het cijfer wordt intern op
    // twee decimalen afgerond (zie rangschik(), "geschaald"), dus 1,13.
    expect(beStrong.herkenning).toBeCloseTo(1.13, 2);
    expect(tryHard.herkenning).toBe(3);

    // Dit mag geen gelijkspel zijn: verschillende groep, en niet als
    // evenSterk gemarkeerd (het verschil in geschaalde herkenning is bijna
    // 1,9, ver boven de marge van 0,3).
    expect(beStrong.groep).not.toBe(tryHard.groep);
    expect(beStrong.evenSterk).toBe(false);
    expect(tryHard.evenSterk).toBe(false);
  });

  it("twee drivers met gelijk aandeel maar ongelijke ruwe score zijn wel een echt gelijkspel", () => {
    // Try Hard (max 3, enkel D3) met ruw 3 geeft aandeel 1,0. Hurry Up
    // (max 5: D4 eigen item plus D6 keuze b, lading 2) met ruw 5 geeft ook
    // aandeel 1,0, ook al is de ruwe score anders (5 tegenover 3). Op
    // aandeel horen ze in dezelfde groep en tellen ze als een echt
    // gelijkspel.
    const antwoorden = {
      D3: { recognition: 3, energy: 0 },
      D4: { recognition: 3, energy: 0 },
      D6: { choice: "b" },
    };
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, antwoorden, "Drivers" as any);
    const tryHard = dim.gerangschikt.find((r) => r.construct === "Try Hard")!;
    const hurryUp = dim.gerangschikt.find((r) => r.construct === "Hurry Up")!;
    expect(tryHard.herkenning).toBe(3);
    expect(hurryUp.herkenning).toBe(3);
    expect((tryHard as any)._ruweScore).not.toBe((hurryUp as any)._ruweScore);
    expect(tryHard.groep).toBe("sterk aanwezig");
    expect(hurryUp.groep).toBe("sterk aanwezig");
    expect(tryHard.rang).toBe(hurryUp.rang);
  });
});
