import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import {
  rangschik,
  FAM_FOCI,
  FAM_VERSNELLERS,
  FAM_DRIVERS,
} from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 1: de rangorde op papier moet gelijk zijn aan die van de
// rekenmotor.
//
// WAT ER MIS GING
// rangschik() (server/t4students/rapport-contract.ts) sorteerde op de
// herschaalde, op een decimaal afgeronde herkenning (de schaal 0 tot 3 die de
// student op het scherm zag). De motor zelf sorteert op de ruwe, ongeschaalde
// herkenningssom. Omdat elk construct een ander haalbaar maximum heeft, kan
// het afronden na de deling de volgorde tussen twee gehele motorscores
// omdraaien. Het rapport toonde dan een andere volgorde dan de motor, precies
// wat het bouwscript meldde met "De rangorde van ... wijkt af".
//
// DEZE TESTCASUS
// Groepsondersteunend haalt een ruwe herkenning van 4 op een haalbaar
// maximum van 6 (V3 + D5 + F5), Impact haalt een ruwe herkenning van 3 op een
// haalbaar maximum van 3 (V4 alleen). Op de RUWE SOM zou Groepsondersteunend
// boven Impact staan (4 > 3), en dat was tot herstelronde 2 punt A ook wat de
// motor deed. Geschaald naar 0 tot 3 werd dat destijds 4/6*3 = 2,0 tegenover
// 3/3*3 = 3,0: op het afgeronde cijfer stond Impact toen plots boven
// Groepsondersteunend, terwijl de motor zelf nog op de ruwe som Groepsonder-
// steunend bovenaan zette. Dat mocht niet: de rangorde op papier moest de
// motor volgen, altijd.
//
// HERSTELRONDE 2, PUNT A: DE VOOROPSTELLING ZELF IS VERANDERD, DE WAARBORG NIET
// Sinds punt A rangschikt de motor zelf ook op AANDEEL van het haalbare
// maximum, niet meer op de ruwe som. Groepsondersteunend heeft hier een
// aandeel van 4/6 = 0,667, Impact een aandeel van 3/3 = 1,0. De motor zet nu
// dus terecht Impact boven Groepsondersteunend, en dat is exact gelijk aan
// wat het afgeronde 0-3-cijfer altijd al liet zien (3,0 tegenover 2,0). De
// oude "vooropstelling" in deze test (dat de motor Groepsondersteunend boven
// Impact zet) was dus zelf op de ruwe som gebaseerd en klopt niet meer. De
// eigenlijke waarborg van deze test blijft echter overeind en is zelfs
// strenger te toetsen: rangschik() op papier moet nog steeds letterlijk de
// volgorde van de motor volgen, wat de motor ook rangschikt. Daarom toetst
// de test hieronder nu dat papier Impact boven Groepsondersteunend zet, exact
// zoals de motor dat nu doet.
// ---------------------------------------------------------------------------

const ANTWOORDEN_VERSNELLERS = {
  V3: { recognition: 2, energy: 1 },
  V4: { recognition: 3, energy: 1 },
  D5: { choice: "b" },
  F5: { choice: "a" },
  S1: { choice: "overzicht" },
} as const;

describe("punt 1: de rangorde op papier volgt letterlijk die van de motor", () => {
  it("talent-versnellers: Impact staat boven Groepsondersteunend, zoals de motor het zet", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN_VERSNELLERS, null, "nl");

    // Vooropstelling (herstelronde 2, punt A): de motor rangschikt op aandeel
    // van het haalbare maximum, dus zet Impact (aandeel 1,0) boven
    // Groepsondersteunend (aandeel 0,667), ook al is de ruwe som van
    // Groepsondersteunend hoger (4 om 3).
    const motorPlaats = (con: string) => resultaat.versnellers.rangorde.indexOf(con);
    expect(motorPlaats("Impact")).toBeLessThan(motorPlaats("Groepsondersteunend"));

    const dim = rangschik(I, resultaat, ANTWOORDEN_VERSNELLERS, FAM_VERSNELLERS);
    const papierPlaats = (con: string) => dim.gerangschikt.findIndex((r) => r.construct === con);

    expect(
      papierPlaats("Impact"),
      "op papier moet Impact boven Groepsondersteunend staan, precies zoals bij de motor",
    ).toBeLessThan(papierPlaats("Groepsondersteunend"));
  });

  it("de volgorde van de volledig ingevulde rijen komt voor elke laag exact overeen met de motor", () => {
    // Een brede, willekeurige invulling over de drie genoemde lagen, zodat de
    // test niet toevallig alleen op het geconstrueerde geval slaagt.
    const antwoorden = {
      ...ANTWOORDEN_VERSNELLERS,
      F1: { recognition: 3, energy: 1 },
      F2: { recognition: 1, energy: -1 },
      F3: { recognition: 2, energy: 0 },
      F6: { recognition: 3, energy: 2 },
      D1: { recognition: 2 },
      D2: { recognition: 1 },
      D3: { recognition: 3 },
      D4: { recognition: 0 },
      D6: { choice: "a" },
      D7: { recognition: 2 },
    } as const;
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");

    const controleer = (familie: string, motorVolgorde: string[]) => {
      const dim = rangschik(I, resultaat, antwoorden, familie);
      const papier = dim.gerangschikt.map((r) => r.construct);
      const motorGefilterd = motorVolgorde.filter((c) => papier.includes(c));
      expect(papier, `${familie}: papier moet de motor letterlijk volgen`).toEqual(motorGefilterd);
    };

    controleer(FAM_FOCI, resultaat.foci.sorted);
    controleer(FAM_VERSNELLERS, resultaat.versnellers.rangorde);
    controleer(FAM_DRIVERS, resultaat.drivers.sorted);
  });
});
