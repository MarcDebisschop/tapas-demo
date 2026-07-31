/**
 * server/demomodus.ts
 *
 * Auditbevinding S-4 (ernst midden, "Demonstratiemodus omzeilt de
 * wachtwoordcontrole; de veiligheid hangt aan één omgevingsvariabele").
 *
 * Het probleem was niet dat er een demomodus bestaat - een demo zonder
 * wachtwoorden is voor een pilot verdedigbaar - maar dat de schakelaar
 * (`TAPAS_DEMO=1`) op negen plaatsen apart werd uitgelezen en dat één verkeerd
 * gezette omgevingsvariabele in productie meteen alle wachtwoordcontroles
 * uitzette. Dat is precies het soort fout dat niemand opmerkt tot het te laat is.
 *
 * Deze module maakt daar twee dingen van:
 *
 *   1. Er is nog exact één plaats waar de demomodus bepaald wordt.
 *   2. In productie (`NODE_ENV=production`) is de demomodus onmogelijk. Staat de
 *      schakelaar daar toch aan, dan wordt hij genegeerd EN luid gelogd. Wie het
 *      per ongeluk aanzet, verliest dus geen enkele wachtwoordcontrole.
 *
 * De omgekeerde weg blijft bewust open: buiten productie kan de demomodus wel
 * aan, want daar is ze bedoeld voor demonstraties en tests.
 */

/** Ruwe stand van de schakelaar, los van de omgeving. Enkel voor logging/tests. */
export function demoSchakelaarStaatAan(): boolean {
  return process.env.TAPAS_DEMO === "1";
}

/** True wanneer de server in productie draait. */
export function isProductie(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * De enige geldige vraag in de rest van de server: mag de demomodus hier gelden?
 *
 * In productie is het antwoord ALTIJD nee, ongeacht de omgevingsvariabele.
 */
export function isDemoModus(): boolean {
  if (isProductie()) return false;
  return demoSchakelaarStaatAan();
}

/**
 * Wordt éénmalig bij het opstarten aangeroepen (server/index.ts). Maakt de
 * gekozen stand zichtbaar in het opstartlogboek, zodat een beheerder of auditor
 * nooit moet gokken of wachtwoorden afgedwongen worden. Geeft de gelogde regel
 * terug zodat een test ze kan nalezen.
 */
export function meldDemoModusBijOpstart(
  log: (regel: string) => void = console.warn,
): string {
  if (isProductie() && demoSchakelaarStaatAan()) {
    const regel =
      "[demomodus] TAPAS_DEMO=1 is gezet, maar dit is een productieomgeving: " +
      "de demomodus wordt GENEGEERD en wachtwoorden blijven verplicht.";
    log(regel);
    return regel;
  }
  if (isDemoModus()) {
    const regel =
      "[demomodus] Demomodus ACTIEF (geen productie): wachtwoordcontrole bij het " +
      "inloggen wordt overgeslagen. Nooit met echte deelnemersgegevens gebruiken.";
    log(regel);
    return regel;
  }
  const regel = "[demomodus] Demomodus uit: wachtwoorden zijn verplicht.";
  log(regel);
  return regel;
}
