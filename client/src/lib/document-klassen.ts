// ---------------------------------------------------------------------------
// Welke klassen op het document horen te staan wanneer de toepassing opstart.
//
// Dit staat apart en niet in main.tsx omdat het een merkregel is en geen
// opstartdetail. Zo is ze te toetsen zonder browser, en zo kan ze niet per
// ongeluk sneuvelen wanneer iemand de opstartcode herschrijft.
// ---------------------------------------------------------------------------

/**
 * Zorgt dat het merkteken van TaPasCity zichtbaar is: het vliegtuigje van
 * Amelia Earhart, subtiel in de hoek van elk scherm.
 *
 * Deze klasse staat er altijd, ook in de kale versie. Het merkteken is geen
 * sfeerelement maar het teken van de maker. Waar het juist niet hoort, op het
 * portaal van een klant, wordt het door een eigen regel in de opmaak
 * uitgeschakeld; zie de organisatieklasse in shared/branding.ts.
 */
export const MERKTEKEN_KLASSE = "merkteken-modus";

/**
 * De sfeerlaag van het volledige platform. Staat uit in de kale versie.
 */
export const BELEVINGS_KLASSE = "belevings-modus";

/**
 * Geeft de klassen die bij het opstarten op het document horen.
 *
 * @param beleving true bij het volledige platform, false bij de kale versie.
 */
export function documentKlassen(beleving: boolean): string[] {
  const klassen = [MERKTEKEN_KLASSE];
  if (beleving) klassen.push(BELEVINGS_KLASSE);
  return klassen;
}
