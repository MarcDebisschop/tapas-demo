import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 7 uit fase 1: het balanslabel werd op de verkeerde schaal bepaald.
//
// WAT ER MIS WAS, IN GEWONE TAAL
// Een deelnemer beantwoordt elk herkenningsitem op een schaal van 0 tot 3:
// 0 is "dit ben ik niet", 3 is "dit ben ik helemaal". De blauwdruk zet op die
// schaal twee grenzen: vanaf 2 noemen we iets kenmerkend, tot en met 1 noemen
// we het laag. Met de energie erbij levert dat vier labels op, zie TABEL 2 van
// de blauwdruk: kenmerkend plus energie is een kernsterkte, kenmerkend maar
// energievretend is overbelasting, laag maar energiegevend is onderbenutting.
//
// Die twee grenzen horen dus bij EEN antwoord op EEN item. De motor legde ze
// echter naast de OPTELSOM van alles wat aan een construct bijdraagt. Bij
// Groepsondersteunend zijn dat vier bijdragen: het item V3 plus een lading uit
// elk van D5, F5 en S1. Die som loopt op tot 6, terwijl de grenzen voor 0 tot 3
// gemaakt zijn.
//
// WAT EEN DEELNEMER DAARVAN MERKTE
// Wie bij V3 antwoordt "dit kenmerkt me nauwelijks" (herkenning 1) en daarbij
// "dit geeft me energie" (energie +2), beschrijft precies wat de blauwdruk
// onderbenutting noemt: een talent dat energie geeft maar weinig wordt ingezet.
// Doordat de drie situatiekeuzes er elk nog 1 bij optelden, kwam de som op 4
// en zei het rapport "kernsterkte". De deelnemer kreeg dus te lezen dat dit een
// kernsterkte is, terwijl hij net had aangegeven dat het hem nauwelijks
// kenmerkt. Het label wees de andere kant op dan het eigen antwoord.
//
// HOE HET NU WERKT
// De grenzen worden weer gelegd naast de grootheid waarvoor ze gemaakt zijn:
// de herkenning die de deelnemer zelf gaf op het item met de energie-anker.
// Blauwdruk TABEL 1 noemt die items met naam (BE, alle V, F1/F2/F3/F6), en
// blauwdruk 4 legt uit dat F4 en F5 er geen hebben omdat die twee foci via een
// situatie-item gemeten worden. Het middelen van de som was geen optie: dat
// mengt een zelfbeoordeling van 0 tot 3 met situatieladingen van 1 of 2, en
// dan zakt iemand die "dit ben ik helemaal" antwoordt alsnog onder de grens.
// ---------------------------------------------------------------------------

const C = I.scoringMap.constants;

/**
 * Een deelnemer die bij V3 zegt: dit kenmerkt me nauwelijks (herkenning 1),
 * maar het geeft me energie (+2). De drie situatiekeuzes die Groepsondersteunend
 * aanraken staan alle drie aan, elk goed voor een lading van 1.
 */
const NAUWELIJKS_MAAR_ENERGIEGEVEND = {
  V3: { recognition: 1, energy: 2 },
  D5: { choice: "b" },
  F5: { choice: "a" },
  S1: { choice: "structuur" },
};

describe("punt 7: de grenzen van het balanslabel horen op de itemschaal", () => {
  it("de twee grenzen zijn waarden op de itemschaal 0 tot 3", () => {
    // Dit legt vast waar de grenzen vandaan komen. Zolang dit klopt, is een
    // som die tot 6 oploopt aantoonbaar de verkeerde grootheid om ze naast
    // te leggen.
    expect(C.overloadRecognitionMin).toBe(2);
    expect(C.underuseRecognitionMax).toBe(1);

    const items = I.sections.find((s) => s.sectionId === "main")!.items;
    const v3 = items.find((i) => i.id === "V3")!;
    expect(v3.scale).toBe("recognition");
    expect(v3.construct).toBe("Groepsondersteunend");
  });

  it("wie zegt dat iets hem nauwelijks kenmerkt, krijgt geen kernsterkte te lezen", () => {
    const r = scoreStudiekompas(I, NAUWELIJKS_MAAR_ENERGIEGEVEND, null, "nl");

    // De deelnemer gaf op het enige item dat hij zelf over dit construct
    // invulde een 1, oftewel: dit kenmerkt me nauwelijks.
    expect(NAUWELIJKS_MAAR_ENERGIEGEVEND.V3.recognition)
      .toBeLessThanOrEqual(C.underuseRecognitionMax);
    // En hij gaf aan dat het energie geeft.
    expect(NAUWELIJKS_MAAR_ENERGIEGEVEND.V3.energy).toBeGreaterThan(0);

    // Laag plus energiegevend is volgens de blauwdruk onderbenutting. Het label
    // mag in geen geval de tegenovergestelde kant op wijzen.
    expect(
      r.versnellers.balanslabels["Groepsondersteunend"],
      "de deelnemer noemde dit nauwelijks kenmerkend, dus dit mag geen kernsterkte heten",
    ).toBe("onderbenut");
  });

  it("de motor beoordeelt dit hetzelfde als de itemmatrix van de blauwdruk", () => {
    // De motor bepaalt per item met een energie-anker ook al een status, en
    // die kant klopte wel. Beide uitspraken gaan over hetzelfde antwoord van
    // dezelfde deelnemer, dus ze horen dezelfde richting op te wijzen.
    const r = scoreStudiekompas(I, NAUWELIJKS_MAAR_ENERGIEGEVEND, null, "nl");
    expect(r.energie.kaart["V3"]).toBe("onderbenutting");
    expect(r.versnellers.balanslabels["Groepsondersteunend"]).toBe("onderbenut");
  });

  it("een construct met vier bijdragen wordt niet anders beoordeeld dan een met een", () => {
    // Impact krijgt maar een bijdrage (V4), Groepsondersteunend vier. Als beide
    // deelnemers op hun eigen item hetzelfde antwoorden, hoort er hetzelfde
    // label uit te komen. Onder de oude regel niet: daar telde het aantal
    // bijdragen mee in de uitkomst.
    const impact = scoreStudiekompas(I, { V4: { recognition: 1, energy: 2 } }, null, "nl");
    const groep = scoreStudiekompas(I, NAUWELIJKS_MAAR_ENERGIEGEVEND, null, "nl");

    expect(impact.versnellers.balanslabels["Impact"]).toBe("onderbenut");
    expect(groep.versnellers.balanslabels["Groepsondersteunend"]).toBe(
      impact.versnellers.balanslabels["Impact"],
    );
  });

  it("kenmerkend blijft kenmerkend: de reparatie maakt het label niet onbereikbaar", () => {
    // Tegenproef, en meteen de reden waarom het gemiddelde niet deugde. Deze
    // deelnemer antwoordt bij V3 "dit ben ik helemaal" (3) en haalt er energie
    // uit. Dat is een kernsterkte. Onder een middelingsregel zou hij door
    // dezelfde drie situatieladingen op gemiddeld 1.5 uitkomen en "latent"
    // heten, wat zijn eigen antwoord tegenspreekt.
    const r = scoreStudiekompas(
      I,
      { V3: { recognition: 3, energy: 2 }, D5: { choice: "b" }, F5: { choice: "a" }, S1: { choice: "structuur" } },
      null,
      "nl",
    );
    expect(r.versnellers.balanslabels["Groepsondersteunend"]).toBe("kernsterkte");
  });

  it("een lege vragenlijst levert geen deling door nul en geen loze uitspraak op", () => {
    // Hier stond eerder "latent" als verwachting. Sinds motorronde punt 4 is dat
    // geen loze uitspraak meer maar helemaal geen uitspraak: latent zegt tegen
    // de deelnemer dat hij een sterkte heeft die nog niet tot leven komt, en er
    // is niets ingevuld om dat op te baseren. Zie
    // tests/t4students-geen-halve-oordelen.test.ts.
    const r = scoreStudiekompas(I, {}, null, "nl");
    for (const con of I.families.find((f) => f.id === "Talent-versnellers")!.constructs) {
      expect(r.versnellers.scores[con], `${con} moet een getal zijn`).not.toBeNaN();
      expect(r.versnellers.balanslabels[con]).toBe("te_weinig_antwoorden");
    }
  });

  it("nu elke focus een anker heeft, is geen enkel label meer onbepaald", () => {
    // Tot de motorronde hadden Systematisch/Uitvoerend en Sociaal Interactief
    // geen energie-anker en gaven zij "niet_van_toepassing" terug: de matrix
    // van TABEL 2 bestond voor hen niet. Zij hebben er nu een, F7 en F8, dus
    // die uitkomst hoort nergens meer te vallen.
    const r = scoreStudiekompas(
      I,
      { F4: { choice: "a" }, F5: { choice: "a" }, D5: { choice: "b" } },
      null,
      "nl",
    );
    const alle = { ...r.foci.balanslabels, ...r.versnellers.balanslabels };
    expect(Object.keys(alle).length).toBe(12);
    for (const [con, label] of Object.entries(alle)) {
      expect(label, `${con} hoort een echt label te krijgen`).not.toBe("niet_van_toepassing");
    }
  });
});
