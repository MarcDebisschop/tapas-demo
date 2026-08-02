import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 2 van de motorronde: rangschikken gebeurt op herkenning.
//
// WAT ER MIS WAS, IN GEWONE TAAL
// Een deelnemer beantwoordt een stelling twee keer: hoe sterk herkent hij zich
// erin (0 tot 3) en hoeveel energie geeft het hem (min 2 tot plus 2). De motor
// telde die twee samen tot een gemengd getal: de herkenning plus de helft van
// de gemiddelde energie. Op dat gemengde getal werden de talent-foci en de
// talent-versnellers gerangschikt, en langs de RIASEC-letters ook de tien
// studiegebieden.
//
// Dat mengsel laat energie de plaats bepalen. Wie een talent duidelijk herkent
// maar er weinig energie uit haalt, zakt daardoor onder iemand die zich er
// nauwelijks in herkent maar het wel leuk vindt. De rangorde zegt dan niet meer
// wie de deelnemer is, maar een optelsom van wie hij is en wat hij graag doet.
// De opdrachtgever heeft beslist: rangschikken gebeurt op herkenning.
//
// WAT ENERGIE DAN NOG DOET
// Energie verdwijnt niet. Zij bepaalt nog altijd het balanslabel (kernsterkte,
// overbelast, onderbenut, latent), de energiebronnen en de energielekken. Zij
// bepaalt alleen niet langer de volgorde.
//
// WAT HIERONDER STAAT
// De eerste twee tests tonen de fout: twee deelnemers met dezelfde herkenning
// maar andere energie horen dezelfde volgorde te krijgen. De rest legt vast dat
// het gemengde getal nergens meer een volgorde of een uitspraak stuurt.
// ---------------------------------------------------------------------------

const C = I.scoringMap.constants;

/**
 * Twee versnellers met elk maar een bron, zodat de herkenning van het construct
 * gelijk is aan het antwoord van de deelnemer en er niets tussen kan komen.
 * Impact (V4) wordt duidelijk herkend maar kost energie; Constructief
 * onderscheidend (V6) wordt nauwelijks herkend maar geeft energie.
 */
const HERKEND_MAAR_ZWAAR = {
  V4: { recognition: 2, energy: -2 },
  V6: { recognition: 1, energy: 2 },
};

describe("punt 2: de volgorde volgt de herkenning en niet de energie", () => {
  it("wie zich sterker herkent, staat hoger, ook als het hem energie kost", () => {
    const r = scoreStudiekompas(I, HERKEND_MAAR_ZWAAR, null, "nl");

    // Zo staat het in de antwoorden van de deelnemer zelf.
    expect(r.constructScores["Impact"].recognition).toBe(2);
    expect(r.constructScores["Constructief onderscheidend"].recognition).toBe(1);

    // De energie wijst de andere kant op. Wie herkenning en energie tot een
    // getal zou samenvoegen, draait de verhouding hier dus om.
    expect(r.constructScores["Impact"].avgEnergy!).toBeLessThan(
      r.constructScores["Constructief onderscheidend"].avgEnergy!,
    );

    // De rangorde hoort de herkenning te volgen.
    const plaats = (con: string) => r.versnellers.rangorde.indexOf(con);
    expect(
      plaats("Impact"),
      "Impact wordt sterker herkend en hoort dus boven Constructief onderscheidend te staan",
    ).toBeLessThan(plaats("Constructief onderscheidend"));
  });

  it("dezelfde herkenning met andere energie geeft dezelfde volgorde", () => {
    // De scherpste vorm van dezelfde vraag. Twee deelnemers vullen bij de
    // herkenning precies hetzelfde in en verschillen alleen in energie. Alles
    // wat een volgorde is, hoort gelijk te zijn.
    const zonder = scoreStudiekompas(
      I,
      { V1: { recognition: 3 }, V4: { recognition: 2 }, V6: { recognition: 1 } },
      null,
      "nl",
    );
    const met = scoreStudiekompas(
      I,
      {
        V1: { recognition: 3, energy: -2 },
        V4: { recognition: 2, energy: 2 },
        V6: { recognition: 1, energy: 2 },
      },
      null,
      "nl",
    );

    expect(met.versnellers.rangorde).toEqual(zonder.versnellers.rangorde);
    expect(met.foci.sorted).toEqual(zonder.foci.sorted);
    expect(met.studiegebieden.top.map((g) => g.naam)).toEqual(
      zonder.studiegebieden.top.map((g) => g.naam),
    );
    expect(met.studiegebieden.gesorteerd).toEqual(zonder.studiegebieden.gesorteerd);
    expect(met.riasec.scores).toEqual(zonder.riasec.scores);
    expect(met.convergentie).toEqual(zonder.convergentie);

    // En het verschil dat energie wel hoort te maken, is er nog wel.
    expect(met.versnellers.balanslabels).not.toEqual(zonder.versnellers.balanslabels);
  });

  it("de getallen naast de rangorde zijn dezelfde getallen waarop gerangschikt is", () => {
    // Als de lijst op herkenning geordend is maar er een gemengd getal naast
    // staat, leest de deelnemer een volgorde die zijn eigen getallen tegenspreekt.
    const r = scoreStudiekompas(I, HERKEND_MAAR_ZWAAR, null, "nl");
    for (const con of Object.keys(r.versnellers.scores)) {
      expect(r.versnellers.scores[con], `${con}`).toBe(r.constructScores[con].recognition);
    }
    for (const con of Object.keys(r.foci.scores)) {
      expect(r.foci.scores[con], `${con}`).toBe(r.constructScores[con].recognition);
    }
  });

  it("ook de afgeleide RIASEC-score telt herkenning op en geen mengsel", () => {
    const r = scoreStudiekompas(I, HERKEND_MAAR_ZWAAR, null, "nl");
    for (const [letter, def] of Object.entries(I.scoringMap.riasecDerivation)) {
      const som = def.derivedFrom.reduce(
        (s, bron) => s + r.constructScores[bron[1]].recognition,
        0,
      );
      expect(r.riasec.details[letter].afgeleideScore, `letter ${letter}`).toBe(som);
    }
  });

  it("het gemengde getal bestaat niet meer in de motor", () => {
    // Er mag geen volgorde, drempel of label meer van een mengsel afhangen.
    // Dat is met de hand niet te zien, dus wordt het hier op de bron zelf
    // nagelezen: het woord komt er niet meer in voor. De volledige bewaking
    // over de hele rapportketen staat in
    // tests/t4students-geen-gemengd-getal.test.ts.
    const bron = readFileSync(
      path.resolve(__dirname, "..", "server", "t4students", "kompas-scoring.ts"),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const regels = bron.split("\n").filter((r) => /\bcombined\b/.test(r));
    expect(regels.map((r) => r.trim())).toEqual([]);
  });

  it("de energie blijft even zwaar meewegen als voorheen in het balanslabel", () => {
    // Tegenproef. Punt 2 gaat over volgorde, niet over het wegstrepen van
    // energie. De vier labels uit TABEL 2 van de blauwdruk blijven bereikbaar.
    const r = scoreStudiekompas(I, HERKEND_MAAR_ZWAAR, null, "nl");
    expect(r.versnellers.balanslabels["Impact"]).toBe("overbelast");
    expect(r.versnellers.balanslabels["Constructief onderscheidend"]).toBe("onderbenut");
  });
});
