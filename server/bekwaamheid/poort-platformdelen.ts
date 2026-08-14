/**
 * Van instrument naar platformdeel.
 *
 * Voorwaarde 1 van sectie 7.1 luidt: staat `toegangen.toegestaan` op waar voor
 * het platformdeel van dit instrument? Om die vraag te kunnen stellen is een
 * afbeelding nodig van instrument-id naar platformdeel-id, en die bestond niet.
 * Het register (`server/registry.ts`, zestien instrumenten) en de platformdelen
 * (`shared/platformdelen.ts`, negen delen) stonden los van elkaar.
 *
 * Dit bestand legt die afbeelding vast, expliciet en volledig: elk instrument
 * uit het register staat hieronder, ook de tien waarvoor géén platformdeel
 * bestaat. Die staan er met `null`. Dat is het verschil tussen "ik weet dat er
 * geen deel is" en "ik heb er niet aan gedacht", en de poort behandelt die twee
 * verschillend: bij `null` weigert ze niet.
 *
 * ----------------------------------------------------------------------------
 * De vondst die hierachter zit
 * ----------------------------------------------------------------------------
 *
 * Van de vier families waar blok 2 zich op richt heeft alleen T4P Business een
 * platformdeel. T4Students, T4Teens en T4Kids hebben er geen. Voorwaarde 1 is
 * voor drie van de vier dus niet te toetsen — niet omdat de code iets mist, maar
 * omdat er nooit een afsluitbaar onderdeel voor is gedefinieerd. Dat is een
 * beslissing voor het productoverleg en geen bug om weg te programmeren.
 *
 * Tweede vondst, breder: `toegangen` werd tot nu toe door geen enkel endpoint
 * gelezen om iets te weigeren. De enige aanroepers van `listAlleToegangen` en
 * `zetToegang` zitten in `server/toegang/routes.ts` — één leest de lijst voor het
 * beheerscherm, één zet een waarde. De vlaggen in `/admin/toegang` waren dus
 * decoratief. De poort is de eerste plaats waar ze iets doen.
 */

import { PLATFORMDELEN } from "@shared/platformdelen";

/**
 * Instrument-id → platformdeel-id, of `null` als er geen platformdeel bestaat.
 *
 * De sleutels zijn de zestien ids die `server/registry.ts` inschrijft. Bij een
 * nieuw instrument hoort hier een regel bij; de test bewaakt dat.
 */
export const PLATFORMDEEL_VAN_INSTRUMENT: Record<string, string | null> = {
  // Wel een platformdeel
  "t4p-business-kompas": "kompas",
  t4recruitment: "t4r",
  "tapas-teamscan": "teamscan",
  twominscan: "twominscan",
  "impact-roos": "impact",
  hdd: "hdd",

  // Geen platformdeel gedefinieerd
  t4teens: null,
  t4students: null,
  t4kids: null,
  t4o: null,
  t4sports: null,
  "t4sports-m1": null,
  "t4sports-m2": null,
  "t4sports-m3": null,
  stm: null,
  driverscan: null,
};

/**
 * Het platformdeel van een instrument.
 *
 * Drie uitkomsten, en het onderscheid tussen de laatste twee is het hele punt:
 *   • een id      — er is een platformdeel; de toegangsvlag is te toetsen
 *   • `null`      — bekend instrument zonder platformdeel; niets te toetsen
 *   • `undefined` — het instrument staat niet in de afbeelding
 *
 * `undefined` hoort nooit voor te komen; de test vergelijkt de sleutels met het
 * register. Komt het toch voor, dan is dat een programmeerfout en geen
 * gebruikersfout, en de aanroeper hoort het als leemte te behandelen en niet als
 * weigering.
 */
export function platformdeelVanInstrument(instrumentId: string): string | null | undefined {
  return PLATFORMDEEL_VAN_INSTRUMENT[instrumentId];
}

/**
 * De toegangsvlag zoals de poort die wil zien.
 *
 * Zet de rijen uit `toegangen` van één beheerder om in de drieledige waarde die
 * `beoordeelPoort` als `platformdeelToegestaan` verwacht.
 *
 * Afwezigheid van een rij betekent niet toegestaan. Dat is de strenge lezing en
 * ze past bij de grondhouding van `scope-guard.ts`: weigeren tenzij aantoonbaar
 * toegestaan. In de huidige databank hebben beide beheerders acht rijen en staat
 * `bekwaamheid` bij niemand — wie de module zelf zou openen, komt er zonder
 * expliciete toekenning dus niet in.
 */
export function toegangsvlagVoorInstrument(
  instrumentId: string,
  toegangen: readonly { platformdeel: string; toegestaan: boolean }[],
): boolean | null {
  const deel = platformdeelVanInstrument(instrumentId);
  // Zowel `null` (geen deel) als `undefined` (onbekend instrument) leveren een
  // leemte op. De poort weigert op geen van beide.
  if (deel === null || deel === undefined) return null;
  const rij = toegangen.find((t) => t.platformdeel === deel);
  return rij ? rij.toegestaan : false;
}

/** De platformdeel-ids die werkelijk bestaan. Voor de test. */
export function bestaandePlatformdeelIds(): string[] {
  return PLATFORMDELEN.map((d) => d.id);
}
