import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// De gelijkheidstoets, nu met twee reeksen bewijsmateriaal naast elkaar.
//
// WAT DEZE TEST OORSPRONKELIJK AANTOONDE (FASE 1)
// De scoringsmotor die naar het platform is overgezet levert voor zeventien
// vaste antwoordpatronen precies dezelfde uitkomst als de originele motor die
// buiten het platform draait. Niet alleen dezelfde getallen: dezelfde velden,
// in dezelfde volgorde, met dezelfde afronding en dezelfde volgorde bij gelijke
// stand.
//
// WAT ER IN FASE 1C IS VERANDERD, EN WAAROM DEZE TEST NIET STIL ROOD WORDT
// Fase 1c heeft twee rekenfouten hersteld. Daardoor wijkt de motor op een paar
// velden bewust van de bron af. Dat mag deze test niet wegpoetsen en het mag
// haar ook niet zomaar rood maken. De oplossing is dat zij nu twee dingen
// tegelijk bewijst:
//
//   1. Tegen de EERSTE reeks (uitkomsten/, uit de originele browsermotor):
//      alles is nog steeds gelijk, BEHALVE op een uitputtende, hieronder met
//      naam en reden opgesomde lijst velden. Elk ander verschil, hoe klein ook,
//      maakt de test rood. De overzetting van fase 1 blijft dus bewezen.
//
//   2. Tegen de TWEEDE reeks (uitkomsten-na-fase1c/, uit deze motor zoals hij
//      na fase 1c rekent): alles is exact gelijk, zonder enige uitzondering.
//      Dat is de nieuwe ijkmaat. Schuift er hierna nog iets, dan valt het op.
//
// Bovendien wordt hieronder gecontroleerd dat de verzameling verschillen tussen
// de twee reeksen precies de opgesomde lijst is, niet meer en niet minder. Een
// uitzondering die niets meer dekt is dus ook een fout: dan klopt de uitleg
// niet meer met de werkelijkheid.
//
// DE NEGEN TOEGESTANE AFWIJKINGEN, MET REDEN
// A tot en met C komen uit fase 1c, D tot en met I uit de motorronde.
//
// A. alerts.actief[].boodschap (10 velden over 6 patronen)
//    Al bekend uit fase 1 en niet nieuw. De alertteksten staan in de motor
//    zelf, niet in het instrument. Twee van de vier bevatten in de bron een
//    lang streepje, in alle drie de talen; dat teken mag hier niet staan en is
//    vervangen door een punt of een komma. De betekenis is ongewijzigd. De
//    letterlijke tabel staat in tests/t4students-kompas-alertteksten.test.ts.
//
// B. foci.balanslabels en versnellers.balanslabels (64 velden)
//    Punt 7 en motorronde punt 4 samen. Punt 7: de bronmotor legde de drempels
//    overloadRecognitionMin (2) en underuseRecognitionMax (1) op de SOM van de
//    herkenning over een heel construct, terwijl het waarden op de schaal van
//    een enkel item zijn (0 tot 3). De motor beoordeelt het label nu op het
//    energie-ankeritem van het construct, zoals de blauwdruk het beschrijft.
//    Motorronde punt 4: waar de nodige antwoorden ontbreken staat er nu
//    "te_weinig_antwoorden" in plaats van een oordeel. Zie
//    tests/t4students-balanslabel-schaal.test.ts en
//    tests/t4students-geen-halve-oordelen.test.ts.
//
// C. betrouwbaarheid.beantwoord (3 velden)
//    Punt 8. Wie alleen een energie-antwoord gaf en geen herkenning, telde in
//    de bron als onbeantwoord. Dat telt nu mee. Zie
//    tests/t4students-teller-beantwoord.test.ts.
//
// D. energie.kaart bij D1 tot D4, D7, F7 en F8 (119 velden)
//    Motorronde punt 1. De vijf drivers en de foci Systematisch/Uitvoerend en
//    Sociaal Interactief hebben nu ook een energie-anker, dus die zeven items
//    staan nu in de energiekaart en stonden er in de bron niet. Zie
//    tests/t4students-energie-bij-drivers.test.ts.
//
// E. betrouwbaarheid.totaalItems (17 velden, een per patroon)
//    Motorronde punt 1. De vragenlijst gaat van 31 naar 34 items, omdat Be
//    Strong, Systematisch/Uitvoerend en Sociaal Interactief er met D7, F7 en F8
//    voor het eerst een eigen vraag bij krijgen.
//
// F. alles wat een volgorde is of eruit volgt (1180 velden)
//    Motorronde punt 2 en punt 3 samen. De bronmotor rangschikte de foci en de
//    versnellers op het gemengde getal van herkenning plus de helft van de
//    gemiddelde energie. Dat gebeurt nu op de herkenning alleen. Omdat de
//    RIASEC-letters uit dezelfde constructscores worden opgeteld, schuiven ook
//    de letters, de tien studiegebieden, de studiestrategie, de
//    convergentie-assen, de keerzijde en de profieluitgesprokenheid mee. Boven
//    op die verschuiving komt de kleinere marge voor gelijke stand uit punt 3,
//    die dezelfde groepsvelden nog eens anders indeelt. Dit is veruit de
//    grootste post; het gaat telkens om dezelfde twee besluiten. Zie
//    tests/t4students-rangschikken-op-herkenning.test.ts en
//    tests/t4students-gelijke-stand.test.ts.
//
// G. interesse.topGroep (51 velden)
//    Motorronde punt 3. De zes interessegebieden werden altijd al op de
//    herkenning gerangschikt, want het antwoord op een interessevraag telt daar
//    rechtstreeks bij op en er is geen energie-anker. Punt 2 raakt ze dus niet.
//    Wat ze wel raakt, is de marge voor gelijke stand: met 1,0 stonden gebieden
//    die een punt uiteenliepen samen bovenaan, met 0,3 alleen nog gebieden die
//    precies gelijk scoren. Zie tests/t4students-gelijke-stand.test.ts.
//
// H. constructScores[...].avgEnergy en .combined (639 velden)
//    Twee redenen tegelijk. Waar geen enkel energie-antwoord is, stond in de
//    bron een nul bij avgEnergy, en nul is het midden van de energieschaal; nu
//    blijft dat getal leeg (motorronde punt 4, zie
//    tests/t4students-geen-halve-oordelen.test.ts). En combined bestaat niet
//    meer: het mengsel van herkenning en energie is volledig uit de motor en de
//    uitvoer gehaald, dus de bron heeft daar een getal waar wij niets meer
//    hebben. Zie tests/t4students-geen-gemengd-getal.test.ts.
//
// I. de overige velden van energie.kaart (27 velden)
//    Motorronde punt 4. Een onbeantwoord of half beantwoord energie-item kreeg
//    "neutraal", hetzelfde woord als wie werkelijk neutraal antwoordde. Het
//    krijgt nu "te_weinig_antwoorden". Uitzondering D gaat over dezelfde kaart
//    maar over de zeven items die in de bron nog niet bestonden.
//
// HOE HET BEWIJSMATERIAAL TOT STAND KWAM
// De patronen staan in tests/t4students-gelijkheidstoets/patronen.json. De
// eerste reeks is eenmalig door de ORIGINELE scorer.js gehaald, samen met het
// ORIGINELE instrument-data.js; de tweede reeks door de motor van dit platform.
// Beide scripts staan ernaast, met uitleg hoe je ze opnieuw draait. De bevroren
// bestanden worden hier alleen gelezen, nooit geschreven.
//
// Doordat de eerste reeks van het originele instrumentbestand komt en deze test
// het omgezette server/data/t4students.json gebruikt, toont de vergelijking
// meteen ook aan dat het vervangen van de lange streepjes in de itemteksten de
// uitkomst niet raakt.
// ---------------------------------------------------------------------------

const hier = path.resolve(__dirname, "t4students-gelijkheidstoets");

interface Patroon {
  naam: string;
  toelichting: string;
  taal: string;
  deelnemer: { naam?: string; code?: string } | null;
  antwoorden: Record<string, any>;
}

const patronen: Patroon[] = JSON.parse(
  readFileSync(path.join(hier, "patronen.json"), "utf-8"),
);

function bevroren(reeks: "uitkomsten" | "uitkomsten-na-fase1c", naam: string): any {
  return JSON.parse(readFileSync(path.join(hier, reeks, `${naam}.json`), "utf-8"));
}

function draai(p: Patroon): any {
  return scoreStudiekompas(T4STUDENTS_INSTRUMENT, p.antwoorden, p.deelnemer, p.taal);
}

/**
 * De uitputtende lijst van velden waarop de motor bewust van de bron afwijkt.
 * Elk pad wordt geschreven als patroonnaam gevolgd door het pad in de uitvoer.
 * De reden staat in de kop van dit bestand, met een verwijzing naar de test die
 * de afwijking zelf bewijst.
 */
const TOEGESTANE_AFWIJKINGEN: { reden: string; patroon: RegExp }[] = [
  {
    reden: "A. alertteksten: lang streepje vervangen, betekenis ongewijzigd (fase 1)",
    patroon: /^[^.]+\.alerts\.actief\.\d+\.boodschap$/,
  },
  {
    reden:
      "B. balanslabels: drempels weer op de itemschaal beoordeeld (punt 7) en geen oordeel zonder antwoorden (motorronde punt 4)",
    patroon: /^[^.]+\.(foci|versnellers)\.balanslabels\..+$/,
  },
  {
    reden: "C. teller beantwoord: een enkel energie-antwoord telt nu mee (punt 8)",
    patroon: /^[^.]+\.betrouwbaarheid\.beantwoord$/,
  },
  {
    reden: "D. energie.kaart: de vijf drivers en twee foci hebben nu ook een anker (motorronde punt 1)",
    patroon: /^[^.]+\.energie\.kaart\.(D1|D2|D3|D4|D7|F7|F8)$/,
  },
  {
    reden: "E. totaalItems: drie nieuwe items, 31 wordt 34 (motorronde punt 1)",
    patroon: /^[^.]+\.betrouwbaarheid\.totaalItems$/,
  },
  {
    reden:
      "F. rangschikken gebeurt op herkenning en niet meer op het gemengde getal, en de marge voor gelijke stand is kleiner (motorronde punt 2 en 3)",
    patroon: new RegExp(
      "^[^.]+\\.(" +
        [
          "foci\\.(scores|sorted|topGroep|top2|groepen)",
          "versnellers\\.(scores|rangorde|kopGroep|groepen|dominante|gedeeldMet)",
          "convergentie",
          "riasec\\.(scores|details)",
          "studiegebieden",
          "studiestrategie",
          "keerzijde\\.(minFoci|minVersnellers)",
          "beeldScherpte\\.profielUitgesprokenheid",
        ].join("|") +
        ")(\\..+)?$",
    ),
  },
  {
    reden: "G. interesse.topGroep: de kleinere marge deelt ook de interessegebieden anders in (motorronde punt 3)",
    patroon: /^[^.]+\.interesse\.topGroep(\..+)?$/,
  },
  {
    reden: "H. constructScores: geen energiegetal waar geen energie gemeten is (motorronde punt 4), en het gemengde getal bestaat niet meer",
    patroon: /^[^.]+\.constructScores\.[^.]+\.(avgEnergy|combined)$/,
  },
  {
    reden: "I. energie.kaart: een onbeantwoord item heet niet langer neutraal (motorronde punt 4)",
    patroon: /^[^.]+\.energie\.kaart\.[^.]+$/,
  },
];

/** Elk pad waarop twee uitvoerbomen van elkaar verschillen. */
function verschillen(a: any, b: any, wortel: string): string[] {
  const paden: string[] = [];
  function loop(x: any, y: any, pad: string) {
    if (x === y) return;
    if (x == null || y == null || typeof x !== "object" || typeof y !== "object") {
      if (x !== y) paden.push(pad);
      return;
    }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) loop(x[k], y[k], `${pad}.${k}`);
  }
  loop(a, b, wortel);
  return paden;
}

describe("gelijkheidstoets T4Students: de patronen zelf", () => {
  it("er zijn minstens acht patronen en ze dekken de gevraagde gevallen", () => {
    const namen = patronen.map((p) => p.naam);
    expect(patronen.length).toBeGreaterThanOrEqual(8);
    expect(namen).toContain("alles-minimaal");
    expect(namen).toContain("alles-maximaal");
    expect(namen).toContain("midden");
    expect(namen).toContain("ontbrekende-antwoorden");
    expect(namen.filter((n) => n.startsWith("gemengd-")).length).toBeGreaterThanOrEqual(3);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("elke situatie-optie is in de patronen minstens eenmaal gekozen", () => {
    const main = T4STUDENTS_INSTRUMENT.sections.find((s) => s.sectionId === "main")!;
    const situatieItems = main.items.filter((i) => i.itemType === "sjt");
    expect(situatieItems.map((i) => i.id)).toEqual(["D5", "D6", "F4", "F5"]);

    const gekozen = new Set<string>();
    for (const p of patronen) {
      for (const it of situatieItems) {
        const keuze = p.antwoorden[it.id]?.choice;
        if (keuze != null) gekozen.add(`${it.id}:${keuze}`);
      }
    }
    const verwacht = situatieItems.flatMap((i) => (i.options ?? []).map((o) => `${i.id}:${o.key}`));
    const ontbreekt = verwacht.filter((k) => !gekozen.has(k));
    expect(ontbreekt, `nooit gekozen situatie-opties: ${ontbreekt.join(", ")}`).toEqual([]);
  });

  it("beide reeksen bevatten precies dezelfde patronen", () => {
    const namen = patronen.map((p) => p.naam).sort();
    for (const reeks of ["uitkomsten", "uitkomsten-na-fase1c"] as const) {
      const opSchijf = readdirSync(path.join(hier, reeks))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort();
      expect(opSchijf, `reeks ${reeks} loopt niet gelijk met patronen.json`).toEqual(namen);
    }
  });
});

describe("gelijkheidstoets deel 1: tegen de originele motor, met benoemde uitzonderingen", () => {
  for (const p of patronen) {
    it(`patroon ${p.naam}: alleen de benoemde velden wijken af van de bron`, () => {
      const paden = verschillen(draai(p), bevroren("uitkomsten", p.naam), p.naam);
      const onverklaard = paden.filter(
        (pad) => !TOEGESTANE_AFWIJKINGEN.some((u) => u.patroon.test(pad)),
      );
      expect(
        onverklaard,
        "verschillen met de bron die door geen enkele uitzondering gedekt zijn:\n" +
          onverklaard.join("\n"),
      ).toEqual([]);
    });
  }

  it("elke opgesomde uitzondering komt ook werkelijk voor", () => {
    // Een uitzondering die niets meer dekt is een uitleg die niet meer klopt.
    // Dan hoort ze weg, en niet stilletjes te blijven staan.
    const alle: string[] = [];
    for (const p of patronen)
      alle.push(...verschillen(draai(p), bevroren("uitkomsten", p.naam), p.naam));
    for (const u of TOEGESTANE_AFWIJKINGEN) {
      expect(
        alle.some((pad) => u.patroon.test(pad)),
        `uitzondering "${u.reden}" dekt geen enkel werkelijk verschil meer`,
      ).toBe(true);
    }
  });

  it("het aantal afwijkende velden is precies wat het verslag noemt", () => {
    // Achttienhonderdnegenennegentig velden over zeventien patronen. Elk getal hieronder
    // staat ook in het verslag van de motorronde; loopt het uiteen, dan klopt
    // een van de twee niet meer.
    const perUitzondering: Record<string, number> = {};
    for (const u of TOEGESTANE_AFWIJKINGEN) perUitzondering[u.reden] = 0;
    let totaal = 0;
    for (const p of patronen) {
      for (const pad of verschillen(draai(p), bevroren("uitkomsten", p.naam), p.naam)) {
        const u = TOEGESTANE_AFWIJKINGEN.find((x) => x.patroon.test(pad))!;
        perUitzondering[u.reden]++;
        totaal++;
      }
    }
    expect(perUitzondering).toEqual({
      "A. alertteksten: lang streepje vervangen, betekenis ongewijzigd (fase 1)": 10,
      "B. balanslabels: drempels weer op de itemschaal beoordeeld (punt 7) en geen oordeel zonder antwoorden (motorronde punt 4)": 64,
      "C. teller beantwoord: een enkel energie-antwoord telt nu mee (punt 8)": 3,
      "D. energie.kaart: de vijf drivers en twee foci hebben nu ook een anker (motorronde punt 1)": 119,
      "E. totaalItems: drie nieuwe items, 31 wordt 34 (motorronde punt 1)": 17,
      "F. rangschikken gebeurt op herkenning en niet meer op het gemengde getal, en de marge voor gelijke stand is kleiner (motorronde punt 2 en 3)": 1180,
      "G. interesse.topGroep: de kleinere marge deelt ook de interessegebieden anders in (motorronde punt 3)": 51,
      "H. constructScores: geen energiegetal waar geen energie gemeten is (motorronde punt 4), en het gemengde getal bestaat niet meer": 639,
      "I. energie.kaart: een onbeantwoord item heet niet langer neutraal (motorronde punt 4)": 27,
    });
    expect(totaal).toBe(2110);
  });

  it("de veranderde balanslabels zijn precies de constructen met meer dan een bron", () => {
    // Bij een construct met maar één bijdrage is de som gelijk aan het antwoord
    // op het item zelf, dus daar kan het herstel per definitie niets veranderen.
    // Dat het inderdaad alleen de andere raakt, is de scherpste controle dat het
    // herstel doet wat het zegt te doen.
    // Sinds motorronde punt 4 verandert er ook een balanslabel zodra de nodige
    // antwoorden ontbreken, en dat kan bij elk construct. Die verschillen horen
    // hier niet thuis: ze komen niet van het herstel van de schaal maar van het
    // wegvallen van het oordeel. Daarom blijven ze buiten beschouwing.
    const geraakt = new Set<string>();
    for (const p of patronen) {
      const mijn = draai(p);
      for (const pad of verschillen(mijn, bevroren("uitkomsten", p.naam), p.naam)) {
        if (!/\.balanslabels\./.test(pad)) continue;
        const [fam, con] = pad.split(".balanslabels.");
        const nieuw = (mijn as any)[fam.split(".").pop()!].balanslabels[con];
        if (nieuw === "te_weinig_antwoorden") continue;
        geraakt.add(con);
      }
    }
    // Systematisch/Uitvoerend en Sociaal Interactief stonden hier ook, tot de
    // motorronde hun ankers F7 en F8 gaf. De zeventien patronen dateren van
    // voor die twee items en beantwoorden ze dus nooit, waardoor die twee
    // constructen nu onder punt 4 vallen en niet meer onder punt 7.
    expect([...geraakt].sort()).toEqual(["Analyse", "Groepsondersteunend", "Resultaat"]);
  });
});

describe("gelijkheidstoets deel 2: tegen de tweede reeks, zonder enige uitzondering", () => {
  for (const p of patronen) {
    it(`patroon ${p.naam}: elk veld is gelijk aan de tweede reeks`, () => {
      expect(draai(p)).toEqual(bevroren("uitkomsten-na-fase1c", p.naam));
    });
  }

  it("ook de volgorde van de velden is gelijk, inclusief de volgorde bij gelijke stand", () => {
    // toEqual kijkt niet naar sleutelvolgorde. De volgorde van constructScores
    // volgt de families uit het instrument, en de ranglijsten volgen een
    // sortering waarin gelijke scores voorkomen. Als daar iets aan veranderd
    // was, zou dat hier zichtbaar worden en nergens anders.
    for (const p of patronen) {
      expect(JSON.stringify(draai(p)), `veldvolgorde loopt uiteen bij patroon ${p.naam}`).toBe(
        JSON.stringify(bevroren("uitkomsten-na-fase1c", p.naam)),
      );
    }
  });

  it("de twee reeksen verschillen op precies dezelfde velden als de motor", () => {
    // Sluitstuk: het verschil tussen de twee bevroren reeksen is hetzelfde als
    // het verschil tussen de motor en de eerste reeks. De tweede reeks is dus
    // werkelijk deze motor en niet iets wat er ooit een keer op leek.
    for (const p of patronen) {
      const motorTegenBron = verschillen(draai(p), bevroren("uitkomsten", p.naam), p.naam).sort();
      const reeksTegenReeks = verschillen(
        bevroren("uitkomsten-na-fase1c", p.naam),
        bevroren("uitkomsten", p.naam),
        p.naam,
      ).sort();
      expect(reeksTegenReeks, `de twee reeksen lopen anders uiteen bij ${p.naam}`).toEqual(
        motorTegenBron,
      );
    }
  });
});

describe("gelijkheidstoets: eigenschappen van de motor zelf", () => {
  it("de motor is zuiver: tweemaal draaien geeft hetzelfde en de invoer blijft ongemoeid", () => {
    for (const p of patronen) {
      const voor = JSON.stringify(p.antwoorden);
      const een = JSON.stringify(draai(p));
      const twee = JSON.stringify(draai(p));
      expect(een, `${p.naam} levert twee verschillende uitkomsten`).toBe(twee);
      expect(JSON.stringify(p.antwoorden), `${p.naam} wijzigt zijn invoer`).toBe(voor);
    }
  });

  it("het contractnummer in de uitvoer is dat van het instrumentbestand", () => {
    for (const p of patronen) {
      expect(draai(p).contractVersion).toBe(T4STUDENTS_INSTRUMENT.scoringMap.scorerVersion);
    }
  });
});
