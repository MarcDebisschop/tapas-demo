import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 4 van de motorronde: geen halve oordelen, ook niet bij energie.
//
// WAT ER MIS WAS
// De energieschaal loopt van min twee tot plus twee. Nul is daar geen leeg
// vakje maar een antwoord: "dit doet me niets". De motor rekende het gemiddelde
// van de energie-antwoorden uit en gaf nul terug wanneer er helemaal geen
// antwoorden waren. Wie niets invulde en wie uitdrukkelijk "dit doet me niets"
// antwoordde, kwamen daarmee op precies hetzelfde getal uit. Alles wat daarna
// op dat getal steunt, sprak dus een oordeel uit over iemand van wie niets
// gemeten was.
//
// Dat gold op drie plaatsen tegelijk:
//   1. constructScores[...].avgEnergy, het getal zelf.
//   2. het balanslabel, dat bij een lege invulling "latent" gaf. Dat is een
//      uitspraak over de deelnemer: hij zou een sterkte hebben die nog niet tot
//      leven komt. Er was niets ingevuld.
//   3. energie.kaart, die bij een onbeantwoord item "neutraal" gaf, hetzelfde
//      woord als bij wie werkelijk neutraal antwoordde.
//
// WAT ER NU GEBEURT
// Een construct waarvan de nodige antwoorden ontbreken, krijgt geen getal en
// geen oordeel, maar een uitdrukkelijke toestand: avgEnergy is leeg (null) en
// het oordeel luidt "te_weinig_antwoorden". Zo is aan de uitvoer zelf te zien
// dat er niet gemeten is, in plaats van dat er een middenwaarde staat die op
// een meting lijkt. Dit is dezelfde oplossing als in T4Teens en T4Kids, waar
// een onvolledig construct "niet ingevuld" en "te weinig antwoorden" krijgt in
// plaats van een score en een duiding.
//
// WAT "DE NODIGE ANTWOORDEN" BETEKENT
// Het balanslabel leest twee dingen van het anker-item: de herkenning en de
// energie. Ontbreekt er een van de twee, dan valt het oordeel weg. Een halve
// invulling levert geen half oordeel op.
//
// WAT NIET VERANDERT
// De herkenning blijft wel een getal, ook bij nul antwoorden. Dat is geen
// gemiddelde maar een optelsom, en een optelsom van niets is nul. De rangordes
// rangschikken sinds punt 2 op de herkenning en werken dus gewoon door. Wat
// daaraan schuurt, staat beschreven in tests/t4students-naloop-schalen.test.ts
// onder naloop C.
// ---------------------------------------------------------------------------

/** Niets ingevuld. */
const LEEG = {};

/** Uitdrukkelijk geantwoord, en de energie staat uitdrukkelijk op nul. */
const NEUTRAAL = { V1: { recognition: 2, energy: 0 } };

/** Wel de herkenning beantwoord, de energie niet. Een halve invulling. */
const HALF = { V1: { recognition: 2 } };

const leeg = scoreStudiekompas(I, LEEG, null, "nl");
const neutraal = scoreStudiekompas(I, NEUTRAAL, null, "nl");
const half = scoreStudiekompas(I, HALF, null, "nl");

describe("punt 4: leeg en neutraal zijn nu uit elkaar te houden", () => {
  it("zonder energie-antwoorden staat er geen getal", () => {
    expect(leeg.constructScores["Analyse"].avgEnergy).toBeNull();
  });

  it("met een uitdrukkelijk nul-antwoord staat er wel een getal", () => {
    // Dit is de tegenproef. Nul mag geen synoniem voor leeg worden.
    expect(neutraal.constructScores["Analyse"].avgEnergy).toBe(0);
  });

  it("het balanslabel spreekt geen oordeel uit over wie niets invulde", () => {
    // "latent" zegt: je hebt hier een sterkte die nog niet tot leven komt. Dat
    // is een uitspraak, en er is niets om haar op te baseren.
    expect(leeg.versnellers.balanslabels["Analyse"]).toBe("te_weinig_antwoorden");
    expect(neutraal.versnellers.balanslabels["Analyse"]).toBe("latent");
  });

  it("een halve invulling levert geen half oordeel op", () => {
    expect(half.constructScores["Analyse"].avgEnergy).toBeNull();
    expect(half.versnellers.balanslabels["Analyse"]).toBe("te_weinig_antwoorden");
  });

  it("de energiekaart maakt hetzelfde onderscheid per item", () => {
    expect(leeg.energie.kaart["V1"]).toBe("te_weinig_antwoorden");
    expect(half.energie.kaart["V1"]).toBe("te_weinig_antwoorden");
    expect(neutraal.energie.kaart["V1"]).toBe("neutraal");
  });

  it("bij een lege invulling staat nergens nog een energieoordeel", () => {
    for (const s of Object.values(leeg.constructScores)) {
      expect(s.avgEnergy).toBeNull();
    }
    for (const fam of [leeg.versnellers.balanslabels, leeg.foci.balanslabels]) {
      for (const [con, label] of Object.entries(fam)) {
        expect(label, `${con} krijgt een oordeel zonder antwoorden`).toBe("te_weinig_antwoorden");
      }
    }
    for (const [item, status] of Object.entries(leeg.energie.kaart)) {
      expect(status, `${item} krijgt een status zonder antwoord`).toBe("te_weinig_antwoorden");
    }
  });

  it("de herkenning blijft wel een getal, want dat is een optelsom", () => {
    // Een optelsom van niets is nul en dat is geen verzonnen middenwaarde.
    expect(leeg.constructScores["Analyse"].recognition).toBe(0);
    expect(leeg.versnellers.scores["Analyse"]).toBe(0);
  });

  it("bronnen en lekken blijven leeg in plaats van iedereen te noemen", () => {
    expect(leeg.energie.bronnen).toEqual([]);
    expect(leeg.energie.lekken).toEqual([]);
  });

  it("een volledige invulling levert nog altijd echte oordelen op", () => {
    // Tegenproef bij het geheel: de nieuwe toestand mag de gewone werking niet
    // verdringen.
    const vol = scoreStudiekompas(
      I,
      {
        V1: { recognition: 3, energy: 2 },
        V4: { recognition: 3, energy: -2 },
        V5: { recognition: 0, energy: 2 },
        V6: { recognition: 0, energy: 0 },
      },
      null,
      "nl",
    );
    expect(vol.versnellers.balanslabels["Analyse"]).toBe("kernsterkte");
    expect(vol.versnellers.balanslabels["Impact"]).toBe("overbelast");
    expect(vol.versnellers.balanslabels["Resultaat"]).toBe("onderbenut");
    expect(vol.versnellers.balanslabels["Constructief onderscheidend"]).toBe("latent");
    expect(vol.constructScores["Analyse"].avgEnergy).toBe(2);
    expect(vol.energie.bronnen).toContain("Analyse");
    expect(vol.energie.lekken).toContain("Impact");
  });
});
