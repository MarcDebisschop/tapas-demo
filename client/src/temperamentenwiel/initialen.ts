// Temperamentenwiel — één regel voor initialen op het wiel.
//
// Waarom hier: zowel de wielpagina in het individuele 2MINSCAN-rapport als het
// teamwiel zetten mensen met initialen op het wiel. Stonden die regels op twee
// plaatsen, dan kreeg dezelfde persoon twee verschillende letters ("Naima El
// Amrani" werd NE in het ene en NA in het andere rapport). Deze functie is de
// enige plaats waar de regel staat.

/**
 * Naamdelen die geen initiaal opleveren. Tussenvoegsels en lidwoorden horen bij
 * de familienaam en niet bij de initialen.
 */
const TUSSENVOEGSELS = new Set([
  "van", "de", "den", "der", "d", "des", "ten", "ter", "te", "het", "'t", "in", "op", "tot", "uit",
  "vd", "vande", "vanden", "vander", "el", "al", "le", "la", "du", "da", "dal", "di", "do", "dos",
  "bin", "ben", "ibn", "abu", "mac", "mc", "von", "zu", "of", "san", "santa", "st",
]);

/** Losse tekens die geen letter zijn en dus geen initiaal kunnen worden. */
function eersteLetter(deel: string): string {
  const letter = deel.split("").find((teken) => teken.toLowerCase() !== teken.toUpperCase());
  return letter ? letter.toUpperCase() : "";
}

/**
 * Initialen voor het wiel: eerste letter van de voornaam en eerste letter van
 * het laatste betekenisvolle naamdeel. Tussenvoegsels vallen weg.
 *
 * "Naima El Amrani" -> "NA", "Bram De Cock" -> "BC", "Tom Peeters" -> "TP",
 * "Ilse" -> "IL", "" -> terugvalwaarde.
 */
export function initialenVan(naam: string, terugval = "IK"): string {
  const delen = (naam ?? "")
    .replace(/[.,;]/g, " ")
    .split(/[\s\-–]+/)
    .filter(Boolean);
  const echte = delen.filter((deel) => !TUSSENVOEGSELS.has(deel.toLowerCase()));
  const bruikbaar = echte.length ? echte : delen;

  if (bruikbaar.length === 0) return terugval;

  if (bruikbaar.length === 1) {
    const woord = bruikbaar[0];
    const letters = woord.split("").filter((t) => t.toLowerCase() !== t.toUpperCase());
    if (letters.length === 0) return terugval;
    if (letters.length === 1) return letters[0].toUpperCase();
    return (letters[0] + letters[1]).toUpperCase();
  }

  const eerste = eersteLetter(bruikbaar[0]);
  const laatste = eersteLetter(bruikbaar[bruikbaar.length - 1]);
  const uit = `${eerste}${laatste}`;
  return uit || terugval;
}
