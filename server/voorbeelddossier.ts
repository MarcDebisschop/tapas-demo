/**
 * server/voorbeelddossier.ts
 *
 * Eén vraag, en niets anders: mag deze omgeving een herkenbaar voorbeelddossier
 * tonen in de Regiekamer?
 *
 * Waarom dit apart staat van de demonstratiemodus.
 *
 * De demonstratiemodus doet iets ingrijpends: ze slaat de wachtwoordcontrole
 * bij het aanmelden over. Daarom is ze in productie onmogelijk gemaakt, en dat
 * blijft zo. Het tonen van een voorbeelddossier is iets heel anders. Het maakt
 * gegevens aan die als voorbeeld herkenbaar zijn en raakt de aanmelding niet.
 *
 * Zolang beide aan dezelfde knop hingen, kon een echte omgeving geen
 * voorbeeldgegevens tonen zonder ook de wachtwoorden los te laten. Dat is een
 * keuze die niemand wil maken. Sinds deze module bestaat hoeft dat ook niet.
 *
 * De oude schakelaar blijft meetellen, zodat elke bestaande demonstratie- en
 * testopstelling ongewijzigd blijft werken.
 */

import { isDemoModus } from "./demomodus";

/**
 * De naam van de omgevingsvariabele. Staat hier als waarde, zodat de tests en
 * de opstartmelding dezelfde naam gebruiken en die naam nooit uiteen kan lopen.
 */
export const VOORBEELDDOSSIER_SCHAKELAAR = "TAPAS_VOORBEELDDOSSIER";

/**
 * Waar wanneer deze omgeving om een voorbeelddossier vraagt.
 *
 * Enkel de waarde "1" telt. Een half ingevulde variabele zoals "true", "ja" of
 * "graag" zet niets aan: bij een schakelaar die gegevens aanmaakt, hoort geen
 * ruimte voor interpretatie.
 */
export function voorbeelddossierGevraagd(): boolean {
  if (process.env[VOORBEELDDOSSIER_SCHAKELAAR] === "1") return true;
  return isDemoModus();
}

/**
 * Wordt bij het opstarten aangeroepen. Maakt in het logboek zichtbaar of deze
 * omgeving voorbeeldgegevens aanmaakt, zodat niemand zich later afvraagt waar
 * het dossier "DEMO - Overname Asterra Machines" vandaan komt. Geeft de gelogde
 * regel terug zodat een test ze kan nalezen.
 */
export function meldVoorbeelddossierBijOpstart(
  log: (regel: string) => void = console.warn,
): string {
  const regel = voorbeelddossierGevraagd()
    ? `[voorbeelddossier] Aan (${VOORBEELDDOSSIER_SCHAKELAAR}): de Regiekamer ` +
      "krijgt een herkenbaar voorbeelddossier. Dit raakt de wachtwoordcontrole niet."
    : "[voorbeelddossier] Uit: er worden geen voorbeeldgegevens aangemaakt.";
  log(regel);
  return regel;
}
