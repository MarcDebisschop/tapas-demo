// Temperamentenwiel — de vaste bladstructuur van het energetisch teamprofiel.
//
// Deze lijst is de enige waarheid over welke bladen in het teamrapport staan en
// in welke orde. Ze komt uit het goedgekeurde teamprofiel. Wie een blad wil
// toevoegen of weghalen, past hier aan; tests/twominscan-teamrapport-bladen.test.ts
// bewaakt de structuur en het aantal bladen, zodat er nooit stil bladen kunnen
// wegvallen uit het rapport.
//
// Op één blad "individuele energie" staan drie deelnemers. Bij vijf deelnemers
// geeft dat twee zulke bladen en dus tien bladen in totaal.

export const DEELNEMERS_PER_BLAD = 3;

export type BladSoort =
  | "cover"
  | "leeswijzer"
  | "teamwiel"
  | "deelnemers"
  | "individueel"
  | "dynamiek"
  | "kleuren"
  | "overleg"
  | "slot";

/** Vaste orde van de bladen; "individueel" wordt herhaald per drie deelnemers. */
export const BLADEN: BladSoort[] = [
  "cover",
  "leeswijzer",
  "teamwiel",
  "deelnemers",
  "individueel",
  "dynamiek",
  "kleuren",
  "overleg",
  "slot",
];

/** Aantal bladen "individuele energie" voor dit aantal deelnemers. */
export function individueleBladen(aantalDeelnemers: number): number {
  return Math.max(1, Math.ceil(aantalDeelnemers / DEELNEMERS_PER_BLAD));
}

/** Volledige bladlijst voor dit aantal deelnemers, in printorde. */
export function bladenVoor(aantalDeelnemers: number): BladSoort[] {
  const uit: BladSoort[] = [];
  for (const blad of BLADEN) {
    if (blad === "individueel") {
      for (let i = 0; i < individueleBladen(aantalDeelnemers); i++) uit.push("individueel");
    } else {
      uit.push(blad);
    }
  }
  return uit;
}
