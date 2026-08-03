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
// 4,0 en begrensd op 1,0. Alle mogelijke invullingen van de zes focusitems en
// de vier situatie-items zijn nagerekend: de hoogst haalbare waarde is 0,65,
// dus de begrenzing op 1,0 wordt nooit geraakt. Het signaal
// lage_zekerheid_uitgesproken_beeld vraagt meer dan 0,55 en zit daarmee in de
// bovenste tien procent van wat er te halen valt. In 20000 toevallige volledige
// invullingen kwam het geen enkele keer voor. Met de hand in elkaar gezet lukt
// het wel, en die invulling staat hieronder, zodat duidelijk is dat het geen
// dode code is maar een hoek van de ruimte.
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

/**
 * De scherpst mogelijke invulling van het focusbeeld, gevonden door alle
 * combinaties van de zes focusitems (elk 0 of 3) en de vier situatie-items door
 * de motor te halen. P1 op B en de twee schuiven op nul zetten de zelfzekerheid
 * zo laag mogelijk, want het signaal vraagt allebei tegelijk.
 */
const SCHERPST_MOGELIJKE_BEELD = {
  F1: { recognition: 0 },
  F2: { recognition: 0 },
  F3: { recognition: 0 },
  F6: { recognition: 0 },
  F7: { recognition: 3 },
  F8: { recognition: 3 },
  D5: { choice: "b" },
  D6: { choice: "a" },
  F4: { choice: "a" },
  F5: { choice: "a" },
  P1: { choice: "B" },
  P2: { value: 0 },
  I1: { value: 0 },
};

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
    // De zes focusscores zijn herkenningsscores (motorronde punt 2). Ze lopen
    // van 0 tot hoogstens 6, maar niet alle zes tegelijk: alleen Sociaal
    // Interactief haalt 6 en alleen Systematisch/Uitvoerend haalt 5, en dan
    // uitsluitend bij situatiekeuzes die de andere vier op nul laten. Alle
    // mogelijke combinaties van de zes focusitems en de vier situatie-items zijn
    // nagerekend; hieronder staat de scherpste die eruit kwam.
    const foci = I.families.find((f) => f.id === "Talent-foci")!.constructs;
    expect(foci).toHaveLength(6);
    const scherpst = scoreStudiekompas(I, SCHERPST_MOGELIJKE_BEELD, null, "nl");
    expect(scherpst.beeldScherpte.profielUitgesprokenheid).toBe(0.65);
    expect(scherpst.beeldScherpte.profielUitgesprokenheid!).toBeLessThan(1.0);
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
    // De twee foci met het grootste bereik helemaal boven, de vier andere op
    // nul, en de zelfzekerheid op haar laagst. Dan pas komt het signaal eruit.
    const r = scoreStudiekompas(I, SCHERPST_MOGELIJKE_BEELD, null, "nl");
    expect(r.foci.scores).toEqual({
      "Functioneel Innovatief": 0,
      "Artistiek Innovatief": 0,
      "Complexiteit/Conceptueel": 0,
      "Systematisch/Uitvoerend": 5,
      "Sociaal Interactief": 6,
      "Overdrachtelijk Interactief": 0,
    });
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

  it("alle 30 constructen staan op nul herkenning en hebben geen energiegetal", () => {
    // De lege noemer leverde nooit een NaN op, maar wel een nul, en nul is het
    // midden van de energieschaal. Sinds motorronde punt 4 blijft dat getal
    // leeg. De herkenning blijft wel nul, want dat is een optelsom en geen
    // gemiddelde. Zie tests/t4students-geen-halve-oordelen.test.ts.
    // 30 sinds fase 1b: 25 bestaande constructen plus de vijf van de nieuwe
    // familie Motivatie.
    const waarden = Object.values(leeg.constructScores);
    expect(waarden).toHaveLength(30);
    for (const s of waarden) {
      expect(s.recognition).toBe(0);
      expect(s.avgEnergy).toBeNull();
    }
  });
});
