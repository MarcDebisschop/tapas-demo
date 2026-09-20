/**
 * server/traject-poort.ts
 *
 * Een traject is geen vragenlijst.
 * ---------------------------------------------------------------------------
 * Human Due Diligence staat in de registry met flowType "journey": het bezit
 * geen vragen en geen antwoorden, het stuurt in twee fasen andere instrumenten
 * aan. Toch kon een traject tot nu toe als gewoon instrument uitgestuurd worden,
 * via Bulk-import en via POST /api/uitnodigingen. Dat leverde een afnamerij met
 * instrumentId "hdd" en een link naar /deelnemer/TOKEN, en die link opende de
 * standaardvragenlijst: het TaPas Business Kompas. De deelnemer vulde dus het
 * Kompas in, en de Teamscan en de 2MINSCAN volgden nooit, want alleen het
 * trajectscherm maakt die twee uitnodigingen aan.
 *
 * Deze poort sluit die deur. Wie een traject uitstuurt, krijgt geen halve
 * vragenlijst maar een melding die naar het trajectscherm wijst.
 */

import { getDescriptor } from "./registry";

/** Is dit instrument een traject (flowType "journey") in plaats van een vragenlijst? */
export function isTrajectInstrument(instrumentId: string | null | undefined): boolean {
  if (!instrumentId) return false;
  return getDescriptor(instrumentId)?.flowType === "journey";
}

/**
 * De melding bij een geweigerde uitsturing. Eén tekst voor alle drie de deuren,
 * zodat de beheerder overal hetzelfde leest.
 */
export const MELDING_TRAJECT_NIET_INVULBAAR =
  "Human Due Diligence is een traject van twee fasen en geen vragenlijst. " +
  "Stuurt u dat traject toch als vragenlijst uit, via Bulk-import of via een " +
  "losse uitnodiging, dan ziet het lid alleen het TaPas Business Kompas. " +
  "U nodigt de leden daarom uit via het trajectscherm. In fase 1 krijgt elk lid " +
  "daar twee links: een link voor de Teamscan en een link voor de 2MINSCAN. " +
  "In fase 2 volgt de link voor het TaPas Business Kompas.";

export const CODE_TRAJECT_NIET_INVULBAAR = "TRAJECT_GEEN_VRAGENLIJST";

/** Het antwoord dat de routes teruggeven wanneer de poort sluit. */
export function trajectWeigering(): {
  status: number;
  lichaam: { error: string; code: string };
} {
  return {
    status: 400,
    lichaam: {
      error: MELDING_TRAJECT_NIET_INVULBAAR,
      code: CODE_TRAJECT_NIET_INVULBAAR,
    },
  };
}
