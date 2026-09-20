/**
 * client/src/lib/hash-herstel.ts
 *
 * Herstelt een adres met twee hekjes erin.
 * ---------------------------------------------------------------------------
 * AANLEIDING. De toepassing leest zijn route uit de hash, dus elke route staat
 * achter een hekje. Bouwt de code de uitnodigingslink op een adres dat zelf al
 * een hash heeft, dan staan er twee hekjes in dezelfde link:
 *
 *     https://voorbeeld.be/#/hdd#/deelnemer/abc123
 *
 * De router leest dan de route "/hdd#/deelnemer/abc123", vindt die niet, en de
 * deelnemer ziet de melding "404, pagina niet gevonden". De link is nochtans
 * geldig: het token erin klopt en de uitnodiging staat klaar.
 *
 * Deze functie zet zo'n adres recht. Zij houdt het laatste stuk dat met een
 * hekje en een schuine streep begint, want daar zit de werkelijke bestemming. De
 * zoekreeks van het eerste deel laat zij staan, want de 2MINSCAN leest zijn token
 * daaruit. Een adres met een enkel hekje raakt zij niet aan.
 *
 * Zij staat apart van main.tsx zodat de tests haar los kunnen aanroepen, en zij
 * herstelt ook de links die al in een mailbox liggen. Dat laatste is de reden
 * dat dit herstel in de toepassing zit en niet enkel in de verzending.
 */

/**
 * Geeft het herstelde adres terug, of null wanneer er niets te herstellen is.
 *
 * @param href Het volledige adres, gewoonlijk window.location.href.
 */
export function herstelHash(href: string): string | null {
  const eerste = href.indexOf("#");
  if (eerste < 0) return null;

  const voor = href.slice(0, eerste);
  const hash = href.slice(eerste + 1);
  if (!hash.includes("#")) return null;

  // Alle stukken achter de hekjes. Het laatste stuk dat als een route leest,
  // is de bestemming; de eerdere stukken zijn de pagina waarop de link werd
  // samengesteld en die de deelnemer niet nodig heeft.
  const stukken = hash.split("#").filter((s) => s.length > 0);
  const route = [...stukken].reverse().find((s) => s.startsWith("/"));
  if (!route) return null;

  const herstel = `${voor}#${route}`;
  return herstel === href ? null : herstel;
}

/**
 * Past het herstel toe op de adresbalk, zonder de pagina opnieuw te laden.
 *
 * Geeft true terug wanneer er iets hersteld is, zodat main.tsx dat kan loggen
 * en de tests het gedrag kunnen nakijken.
 */
export function pasHashHerstelToe(venster: Window = window): boolean {
  const herstel = herstelHash(venster.location.href);
  if (!herstel) return false;
  venster.history.replaceState(null, "", herstel);
  return true;
}
