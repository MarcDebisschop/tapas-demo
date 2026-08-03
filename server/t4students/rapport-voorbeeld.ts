// ---------------------------------------------------------------------------
// server/t4students/rapport-voorbeeld.ts
//
// Een volledig ingevulde voorbeeldafname. Ze bestaat om het rapport te kunnen
// tonen en te kunnen testen zonder een echte deelnemer nodig te hebben.
//
// WAT HIER WEL EN NIET STAAT
// Hier staan uitsluitend antwoorden: wat een student op elk van de 39 items zou
// hebben aangeklikt (34 uit de motorronde plus de vijf van de motivatiefamilie,
// zie fase 1b). Geen enkele score, geen enkele rangorde en geen enkel label
// staat hier. Die worden gerekend door scoreStudiekompas en daarna door de
// rapportlaag. Wie hier een uitkomst wil veranderen, verandert een antwoord.
//
// WAAROM DIT PROFIEL
// Het is met opzet niet vlak. Er zit een duidelijke kop en een duidelijke staart
// in elke dimensie, er is een gelijke stand, er is een construct waar de
// herkenning hoog is terwijl de energie negatief is (een overbelasting), en er
// is er een waar het omgekeerde geldt (een onbenut vermogen). Zo laat een
// prototype zien wat het rapport aankan in plaats van alleen het makkelijke
// geval.
//
// EEN TWEEDE AFNAME MET EEN GAT
// VOORBEELDAFNAME_ONVOLLEDIG laat een antwoord weg, zodat de regel "geen half
// oordeel" op papier te zien is: het construct blijft staan, krijgt geen
// rangnummer en meldt dat er nog iets ontbreekt.
// ---------------------------------------------------------------------------

import type { T4SAntwoorden } from "./kompas-scoring";

export interface T4SVoorbeeld {
  naam: string;
  code: string;
  datum: string;
  antwoorden: T4SAntwoorden;
}

/**
 * De antwoorden, per item-id. De sleutels zijn item-id's uit het instrument en
 * geen constructnamen: zo kan dit bestand geen tweede namenlijst worden.
 */
const ANTWOORDEN: T4SAntwoorden = {
  // Het energie-ijkpunt.
  I1: { value: 6 },

  // TaPas-BEELD.
  BE1: { recognition: 1, energy: 0 },
  BE2: { recognition: 2, energy: 1 },

  // Drivers. Please Others en Be Perfect staan hoog, Hurry Up laag.
  D1: { recognition: 2, energy: -1 },
  D2: { recognition: 3, energy: 1 },
  D3: { recognition: 2, energy: 0 },
  D4: { recognition: 1, energy: -1 },
  D5: { choice: "b" },
  D6: { choice: "a" },
  D7: { recognition: 1, energy: 0 },

  // Talent-versnellers. Groepsondersteunend en Individueel ondersteunend
  // bovenaan, Constructief onderscheidend onderaan. Analyse is de overbelasting:
  // hoge herkenning met negatieve energie.
  V1: { recognition: 3, energy: -1 },
  V2: { recognition: 3, energy: 2 },
  V3: { recognition: 3, energy: 2 },
  V4: { recognition: 2, energy: 1 },
  V5: { recognition: 2, energy: 0 },
  V6: { recognition: 1, energy: -1 },

  // Talent-foci. De rangorde volgt de ruwe motorscore (herstelronde punt 1),
  // niet de geschaalde herkenning: Sociaal Interactief en
  // Systematisch/Uitvoerend staan met deze antwoorden bovenaan, ook al heeft
  // Overdrachtelijk Interactief hierna een hoger geschaald cijfer, want die
  // twee constructen hebben elk maar drie herkenningsitems terwijl Sociaal
  // Interactief en Systematisch/Uitvoerend er meer hebben. Artistiek
  // Innovatief is het onbenutte vermogen: lage herkenning, hoge energie.
  // Complexiteit/Conceptueel staat onderaan.
  F1: { recognition: 2, energy: 1 },
  F2: { recognition: 1, energy: 2 },
  F3: { recognition: 1, energy: 0 },
  F4: { choice: "a" },
  F5: { choice: "a" },
  F6: { recognition: 3, energy: 2 },
  F7: { recognition: 2, energy: 0 },
  F8: { recognition: 3, energy: 1 },

  // Interesse.
  R1: { interest: 0 },
  R2: { interest: 1 },
  R3: { interest: 2 },
  R4: { interest: 2 },
  R5: { interest: 1 },
  R6: { interest: 0 },

  // Profiel, studeerstijl en betekenisspoor.
  P1: { choice: "A" },
  P2: { value: 4 },
  S1: { choice: "dialoog" },
  B1: { choice: "mensen" },

  // Motivatie (fase 1b). Een lichte overwegend intrinsieke stand, om de
  // motivatiebalans op papier zichtbaar te maken zonder een van de andere
  // dimensies van dit voorbeeldprofiel te raken.
  "MOT-INT-1": { recognition: 3 },
  "MOT-INT-2": { recognition: 2 },
  "MOT-INT-3": { recognition: 3 },
  "MOT-EXT-1": { recognition: 1 },
  "MOT-EXT-2": { recognition: 2 },

  // De open beginvraag (P0, onderdeel B1). Vrije tekst, telt in geen score
  // mee en wordt uitsluitend letterlijk getoond op de bladen B2 en B3.
  P0: { text: "Ik hoop te weten of ik beter wetenschappen of kunst kan kiezen." },
};

export const VOORBEELDAFNAME: T4SVoorbeeld = {
  naam: "Lana De Vos",
  code: "T4S-2026-0147",
  datum: "2 augustus 2026",
  antwoorden: ANTWOORDEN,
};

/**
 * Dezelfde afname, maar met een ontbrekend antwoord op een van de items die de
 * herkenning van een construct voeden. Bedoeld om de regel "geen half oordeel"
 * op papier te kunnen tonen en te testen.
 */
export const VOORBEELDAFNAME_ONVOLLEDIG: T4SVoorbeeld = {
  naam: "Lana De Vos",
  code: "T4S-2026-0147-B",
  datum: "2 augustus 2026",
  antwoorden: (() => {
    const kopie: T4SAntwoorden = { ...ANTWOORDEN };
    delete kopie["F4"];
    delete kopie["V5"];
    return kopie;
  })(),
};
