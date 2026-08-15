/**
 * server/belevingsmodus.ts
 *
 * WAAROM DIT BESTAAT
 * `POST /api/deelnemers/login` gaf het `dashboardToken` van een deelnemer terug
 * zodra iemand het bijbehorende e-mailadres intikte, en maakte bij een onbekend
 * adres zelfs een nieuwe deelnemer aan. Wie het adres van een collega kende, had
 * daarmee volledige toegang tot diens persoonlijke profiel en rapporten. Dat is
 * de open weg naast de veilige aanmeldlink die nu op /mijn loopt.
 *
 * De route bleek geen dode code: `client/src/pages/poort.tsx` — de
 * belevingspoort met de vier draaischijven — roept ze nog aan. Die pagina staat
 * achter de clientvlag `BELEVING` uit `client/src/lib/features.ts`, die
 * standaard uit is (TaPas Core) maar met `?beleving=1` of via localStorage
 * runtime aan gaat zonder herbouw. De route zonder meer weghalen zou die pagina
 * dus breken.
 *
 * DE GEKOZEN WEG
 * Exact het patroon van `server/demomodus.ts`, dat voor auditbevinding S-4
 * hetzelfde probleem oploste: één plaats waar de schakelaar bepaald wordt, en in
 * productie is hij onmogelijk. Toegepast op de belevingspoort betekent dat:
 *
 *   1. In productie bestaat `POST /api/deelnemers/login` NIET. Onvoorwaardelijk,
 *      ongeacht welke omgevingsvariabele gezet is. De open weg is daar dus dicht.
 *   2. Buiten productie kan de route bestaan wanneer `TAPAS_BELEVING=1` staat,
 *      zodat de belevingspoort demonstreerbaar blijft.
 *   3. De stand staat bij elke opstart in het logboek, zodat een beheerder of
 *      auditor nooit moet gokken of die deur open staat.
 *
 * Wat NIET verandert: `client/src/lib/features.ts` belooft uitdrukkelijk "niets
 * wordt verwijderd — de belevingscode blijft volledig in de repo". `poort.tsx`
 * en de twee routes in `App.tsx` blijven daarom staan. De pagina heeft al een
 * foutmelding (`data-testid="text-fout"`), dus bij een afwezige route faalt ze
 * zichtbaar en niet stil.
 */

/** Ruwe stand van de schakelaar, los van de omgeving. Enkel voor logging/tests. */
export function belevingSchakelaarStaatAan(): boolean {
  return process.env.TAPAS_BELEVING === "1";
}

/** True wanneer de server in productie draait. */
export function isProductie(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * De enige geldige vraag in de rest van de server: mag de belevingspoort hier
 * bestaan?
 *
 * In productie is het antwoord ALTIJD nee. De route die erbij hoort geeft een
 * toegangstoken zonder te controleren dat de aanvrager het adres bezit; die mag
 * op een omgeving met echte deelnemersgegevens niet bestaan, ook niet per
 * ongeluk.
 */
export function isBelevingsmodus(): boolean {
  if (isProductie()) return false;
  return belevingSchakelaarStaatAan();
}

/**
 * Wordt éénmalig bij het opstarten aangeroepen (server/index.ts), naast
 * meldDemoModusBijOpstart(). Geeft de gelogde regel terug zodat een test ze kan
 * nalezen.
 */
export function meldBelevingsmodusBijOpstart(
  log: (regel: string) => void = console.warn,
): string {
  if (isProductie() && belevingSchakelaarStaatAan()) {
    const regel =
      "[belevingsmodus] TAPAS_BELEVING=1 is gezet, maar dit is een productieomgeving: " +
      "de belevingspoort wordt GENEGEERD en POST /api/deelnemers/login bestaat niet.";
    log(regel);
    return regel;
  }
  if (isBelevingsmodus()) {
    const regel =
      "[belevingsmodus] Belevingspoort ACTIEF (geen productie): POST /api/deelnemers/login " +
      "bestaat en geeft een dashboardtoken terug op basis van een e-mailadres alleen. " +
      "Nooit met echte deelnemersgegevens gebruiken.";
    log(regel);
    return regel;
  }
  const regel =
    "[belevingsmodus] Belevingspoort uit: POST /api/deelnemers/login bestaat niet. " +
    "Deelnemers komen binnen via de aanmeldlink op /mijn.";
  log(regel);
  return regel;
}
