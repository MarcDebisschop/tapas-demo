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
// haalbaar maximum van 3 (V4 alleen). De motor zet Groepsondersteunend boven
// Impact (4 > 3). Geschaald naar 0 tot 3 wordt dat 4/6*3 = 2,0 tegenover
// 3/3*3 = 3,0: op het afgeronde cijfer zou Impact plots boven Groepsondersteunend
// komen te staan. Dat mag niet: de rangorde op papier volgt de motor, altijd.
// ---------------------------------------------------------------------------

const ANTWOORDEN_VERSNELLERS = {
  V3: { recognition: 2, energy: 1 },
  V4: { recognition: 3, energy: 1 },
  D5: { choice: "b" },
  F5: { choice: "a" },
  S1: { choice: "overzicht" },
} as const;

describe("punt 1: de rangorde op papier volgt letterlijk die van de motor", () => {
  it("talent-versnellers: Groepsondersteunend blijft boven Impact staan, zoals de motor het zet", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN_VERSNELLERS, null, "nl");

    // Vooropstelling: de motor zet Groepsondersteunend boven Impact.
    const motorPlaats = (con: string) => resultaat.versnellers.rangorde.indexOf(con);
    expect(motorPlaats("Groepsondersteunend")).toBeLessThan(motorPlaats("Impact"));

    const dim = rangschik(I, resultaat, ANTWOORDEN_VERSNELLERS, FAM_VERSNELLERS);
    const papierPlaats = (con: string) => dim.gerangschikt.findIndex((r) => r.construct === con);

    expect(
      papierPlaats("Groepsondersteunend"),
      "op papier moet Groepsondersteunend boven Impact staan, precies zoals bij de motor",
    ).toBeLessThan(papierPlaats("Impact"));
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
