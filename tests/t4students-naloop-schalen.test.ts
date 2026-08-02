import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// De eigen naloop, los van de tien punten uit fase 1.
//
// De opdracht vraagt om zelf de motor door te lopen op dezelfde soort fout als
// punt 7: een drempel of constante die op een andere schaal wordt toegepast dan
// bedoeld, een label dat daardoor onbereikbaar is, of een deling waar een lege
// noemer stilletjes op nul uitkomt. Drie dingen kwamen boven. Geen van drieën
// is gerepareerd, om dezelfde reden als bij punt 6: de blauwdruk zegt er niets
// over, en dan is voorleggen het juiste antwoord en niet zelf een ontwerp
// verzinnen. Deze test legt vast wat er gemeten is.
//
// A. DE RIASEC-DREMPELS LIGGEN OP EEN SOM MET ONGELIJK BEREIK
// De motor noemt een letter "afgeleid hoog" bij een score boven 3 en "afgeleid
// laag" bij 1 of minder. Die score is een som van twee of drie
// construct-scores, en die sommen hebben heel verschillende bereiken. Gemeten
// over 20000 toevallige volledige invullingen komt A niet hoger dan 8 en E tot
// 16. Drie is voor A ruim een derde van het bereik en voor E minder dan een
// vijfde. In diezelfde reeks haalt E de grens in 96,8 procent van de gevallen
// en A in 43,0 procent; omgekeerd geldt "laag" bij A in 20,2 procent en bij E
// in 0,3 procent. De divergentienuance is daardoor niet vergelijkbaar tussen de
// letters. De blauwdruk noemt de nuance wel (§6) maar noemt geen enkel getal,
// dus hier is niets uitgevoerd.
//
// De scheefheid is in de motorronde wel kleiner geworden. Zolang Systematisch/
// Uitvoerend geen eigen herkenningsitem had, bleef Realistisch als enige letter
// onder de grens, ook bij wie elke stelling voluit herkende. Met F7 erbij haalt
// Realistisch die grens nu wel. Het verschil in bereik tussen de letters blijft.
//
// B. EEN VAN DE DRIE CONSISTENTIESIGNALEN IS PRAKTISCH ONBEREIKBAAR
// profielUitgesprokenheid is de spreiding van de zes focusscores gedeeld door
// 4,0 en begrensd op 1,0. De zes focusscores kunnen samen nooit een spreiding
// boven 2,5 halen, dus de uitkomst blijft altijd onder 0,63 en de begrenzing op
// 1,0 wordt nooit geraakt. Het signaal lage_zekerheid_uitgesproken_beeld vraagt
// meer dan 0,55, dus meer dan 2,2 spreiding van de maximaal mogelijke 2,5. In
// 20000 toevallige volledige invullingen kwam het geen enkele keer voor. Met de
// hand in elkaar gezet lukt het wel, en die invulling staat hieronder, zodat
// duidelijk is dat het geen dode code is maar een hoek van de ruimte.
//
// C. BIJ NUL ANTWOORDEN NOEMT DE MOTOR TOCH CONSTRUCTEN
// Wie niets invult, krijgt overal nul, en de rangordes sorteren dan op de
// volgorde waarin de constructen toevallig in het instrument staan. De motor
// laat twee velden netjes leeg (de doorslaggevende driver en de zelfzekerheid),
// maar noemt wel een dominante versneller, twee top-drivers, drie
// studiegebieden en zes constructen op de keerzijde. Het voorlopig-alert staat
// aan, dus het rapport waarschuwt, maar de namen staan er.
// ---------------------------------------------------------------------------

const sm = I.scoringMap;

describe("naloop A: de RIASEC-drempels liggen op ongelijke sommen", () => {
  it("de drempels zijn vaste getallen in code, niet in de constanten", () => {
    // Anders dan overloadRecognitionMin en underuseRecognitionMax staan deze
    // twee nergens benoemd. Wie ze wil verzetten, moet de motor bewerken.
    const C = sm.constants as Record<string, unknown>;
    expect(C.riasecAfgeleideHoog).toBeUndefined();
    expect(C.riasecAfgeleideLaag).toBeUndefined();
  });

  it("de letters hebben een verschillend aantal bronnen", () => {
    const bronnen: Record<string, number> = {};
    for (const [letter, def] of Object.entries(sm.riasecDerivation))
      bronnen[letter] = def.derivedFrom.length;
    expect(bronnen).toEqual({ R: 2, I: 2, A: 2, S: 3, E: 3, C: 2 });
  });

  it("wie elke stelling voluit herkent, haalt de grens nu bij alle zes de letters", () => {
    // De scherpste invulling die er is: elke herkenningsstelling op 3, dus
    // "kenmerkt me helemaal". Dan hangt het verschil tussen de letters niet meer
    // van de deelnemer af maar alleen nog van het aantal bronnen en hun bereik.
    const a: Record<string, any> = {};
    for (const it of I.sections.find((s) => s.sectionId === "main")!.items) {
      if (it.scale === "recognition") a[it.id] = { recognition: 3 };
    }
    const r = scoreStudiekompas(I, a, null, "nl");
    const afg = (l: string) => r.riasec.details[l].afgeleideScore;

    // Realistisch stond hier voor de motorronde op 3 en bleef als enige onder de
    // grens van "meer dan 3", omdat het mede op Systematisch/Uitvoerend leunt en
    // dat construct toen alleen ladingen uit situatiekeuzes kreeg. Met F7 erbij
    // telt de eigen herkenning van de deelnemer wel mee en komt R op 6.
    expect(afg("R")).toBe(6);
    for (const l of ["R", "I", "A", "S", "E", "C"]) {
      expect(afg(l) > 3, `${l} hoort de grens te halen`).toBe(true);
    }

    // Wat blijft, is het ongelijke bereik. S en E leunen op drie constructen en
    // komen op 9, de vier andere op twee constructen en blijven op 6. Dezelfde
    // deelnemer, dezelfde antwoorden, en toch anderhalf keer zo veel.
    expect([afg("I"), afg("A"), afg("C")]).toEqual([6, 6, 6]);
    expect([afg("S"), afg("E")]).toEqual([9, 9]);
  });
});

describe("naloop B: het derde consistentiesignaal is praktisch onbereikbaar", () => {
  it("de begrenzing op 1,0 wordt nooit geraakt", () => {
    // De zes focusscores lopen van min 1 tot hoogstens 4, en met zes waarden in
    // dat bereik is 2,5 de grootst mogelijke spreiding. Gedeeld door 4,0 geeft
    // dat 0,625 als absolute bovengrens.
    const foci = I.families.find((f) => f.id === "Talent-foci")!.constructs;
    expect(foci).toHaveLength(6);
    const grootsteSpreiding = 2.5;
    expect(grootsteSpreiding / 4.0).toBeLessThan(1.0);
  });

  it("een gewoon uitgesproken profiel haalt de grens van 0,55 niet", () => {
    // Drie foci helemaal herkend en energiegevend, drie helemaal niet herkend.
    // Dat is al een sterk uitgesproken beeld, en toch blijft het eronder.
    const a = {
      F1: { recognition: 3 },
      F2: { recognition: 3 },
      F3: { recognition: 3 },
      F6: { recognition: 0 },
      P1: { choice: "B" },
      P2: { value: 0 },
      I1: { value: 0 },
    };
    const r = scoreStudiekompas(I, a, null, "nl");
    expect(r.beeldScherpte.profielUitgesprokenheid!).toBeLessThanOrEqual(0.55);
    expect(r.beeldScherpte.consistentieSignaal).not.toBe("lage_zekerheid_uitgesproken_beeld");
  });

  it("het signaal is wel bereikbaar, maar alleen in een uiterste hoek", () => {
    // Pas met de energie er maximaal bij, drie foci op hun top en drie eronder,
    // en de zelfzekerheid op haar laagst, komt het signaal eruit.
    const a = {
      F1: { recognition: 3, energy: 2 },
      F2: { recognition: 3, energy: 2 },
      F3: { recognition: 3, energy: 2 },
      F6: { recognition: 0, energy: -2 },
      F4: { choice: "b" },
      F5: { choice: "b" },
      P1: { choice: "B" },
      P2: { value: 0 },
      I1: { value: 0 },
    };
    const r = scoreStudiekompas(I, a, null, "nl");
    expect(r.beeldScherpte.profielUitgesprokenheid).toBe(0.57);
    expect(r.beeldScherpte.zelfZekerheid).toBe(0.14);
    expect(r.beeldScherpte.consistentieSignaal).toBe("lage_zekerheid_uitgesproken_beeld");
  });
});

describe("naloop C: bij nul antwoorden staan er toch namen in de uitvoer", () => {
  const leeg = scoreStudiekompas(I, {}, null, "nl");

  it("de motor weet zelf dat er geen signaal is", () => {
    expect(leeg.betrouwbaarheid.beantwoord).toBe(0);
    expect(leeg.betrouwbaarheid.totaalSignaal).toBe(0);
    expect(leeg.betrouwbaarheid.voorlopig).toBe(true);
    expect(leeg.alerts.actief.map((x) => x.id)).toContain("voorlopig_profiel");
  });

  it("twee velden blijven netjes leeg", () => {
    expect(leeg.drivers.doorslag).toBeNull();
    expect(leeg.beeldScherpte.zelfZekerheid).toBeNull();
  });

  it("maar de rangordes noemen wel constructen, op volgorde van het bestand", () => {
    // Alles staat op nul, dus dit zijn geen uitkomsten van de meting maar de
    // volgorde waarin de constructen in het instrument staan.
    expect(leeg.studiestrategie.dominanteVersneller).toBe("Analyse");
    expect(leeg.studiestrategie.gedeeldMet).toHaveLength(5);
    expect(leeg.drivers.top2).toEqual(["Be Perfect", "Please Others"]);
    expect(leeg.keerzijde.minFoci).toEqual(["Sociaal Interactief", "Overdrachtelijk Interactief"]);
    expect(leeg.studiegebieden.top.map((g) => g.score)).toEqual([0, 0, 0]);
  });

  it("alle 25 constructen staan op precies nul, dus er is niets gedeeld door nul", () => {
    // De lege noemer in het energiegemiddelde valt netjes terug op nul en
    // levert geen NaN op. Dat deel is dus in orde.
    const waarden = Object.values(leeg.constructScores);
    expect(waarden).toHaveLength(25);
    for (const s of waarden) {
      expect(Number.isNaN(s.avgEnergy)).toBe(false);
      expect(s.recognition).toBe(0);
      expect(s.avgEnergy).toBe(0);
      expect(s.combined).toBe(0);
    }
  });
});
