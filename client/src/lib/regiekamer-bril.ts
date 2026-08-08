/**
 * Rekenhulpjes voor de zichtbaarheidsbril van de Regiekamer. Het scherm zeeft
 * zelf niets: het vraagt het dossier op met de vraag om het te zien zoals een
 * bepaalde mens het ziet, en toont wat er terugkomt.
 */

/** Het adres van het dossier, met of zonder de bril erop. */
export function bouwDossierAdres(
  trajectId: string,
  brilPersoonId: number | null,
): string {
  const basis = `/api/traject/trajecten/${trajectId}`;
  if (brilPersoonId === null) return basis;
  return `${basis}?alsPersoon=${brilPersoonId}`;
}

/** De zin in de strook bovenaan het scherm. */
export function brilStrookTekst(naam: string): string {
  return `U kijkt door de ogen van ${naam}.`;
}

/**
 * Zegt of bij deze gebeurtenis een indruk meegekomen is. Komt het veld niet
 * mee, dan hoort er ook niets over te staan: geen lege plek en geen melding.
 */
export function heeftIndruk(gebeurtenis: {
  indruk?: string | null;
}): boolean {
  const indruk = gebeurtenis.indruk;
  if (typeof indruk !== "string") return false;
  return indruk.trim().length > 0;
}
