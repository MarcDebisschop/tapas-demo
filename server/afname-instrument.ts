// ---------------------------------------------------------------------------
// server/afname-instrument.ts
//
// Eén plek die beantwoordt: moet er meteen bij het afronden van een afname een
// rapport gebouwd worden, en om welk instrument gaat het dan?
//
// WAAROM DIT BESTAAT
// Het deelnemersdashboard toont een bekijk- en een downloadknop zodra er een
// rapport bij de afname hoort (client/src/pages/dashboard.tsx). Is er geen
// rapport, dan blijft daar "Rapport in voorbereiding" staan, zonder enige knop.
// Een deelnemer kan zelf geen rapport laten bouwen: POST /api/rapporten staat
// achter een beheerderssessie (server/routes/rapporten.ts, vereisScope). Wordt
// er bij het afronden dus niets gebouwd, dan blijft die zin er eeuwig staan.
//
// WAAR DE GRENS LIGT
// Niet elk instrument kan hier veilig gebouwd worden. In
// storage.genereerRapport draait de AI-duiding uitsluitend wanneer een
// instrument GEEN eigen generator heeft; instrumenten mét een eigen generator
// (server/rapport-registry.ts) bouwen zuiver synchroon uit het bevroren
// contract, zonder externe oproep. Precies die groep kan tijdens het afronden
// mee. De rest blijft op het bestaande, beheerder-gestuurde pad, zodat een
// trage of falende externe oproep de afronding van een afname nooit ophoudt.
// ---------------------------------------------------------------------------

import { heeftDedicatedGenerator } from "./rapport-registry";

/**
 * Leest het bevroren generatorcontract van een afname. Geeft null wanneer er
 * geen contract is of wanneer het niet leesbaar is; een onleesbaar contract mag
 * nooit een verzoek doen stranden.
 */
export function leesContract(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Welk instrument hoort bij deze afname?
 *
 * Het bevroren contract gaat voor: dat is de bron waaruit het rapport
 * werkelijk gebouwd wordt, en storage.genereerRapport kiest zijn generator op
 * precies datzelfde veld. De kolom `instrumentId` is de terugval; in oudere
 * gegevens is die leeg terwijl het contract de waarde wel draagt.
 *
 * Geeft een lege tekst wanneer geen van beide bruikbaar is.
 */
export function instrumentVanAfname(
  contract: unknown,
  kolomInstrumentId: string | null | undefined,
): string {
  if (contract && typeof contract === "object") {
    const uitContract = (contract as { instrumentId?: unknown }).instrumentId;
    if (typeof uitContract === "string" && uitContract.trim()) return uitContract.trim();
  }
  if (typeof kolomInstrumentId === "string" && kolomInstrumentId.trim()) {
    return kolomInstrumentId.trim();
  }
  return "";
}

/**
 * Mag het rapport voor dit instrument meteen bij het afronden gebouwd worden?
 * Waar voor elk instrument met een eigen, synchrone generator.
 */
export function magRapportDirectNaAfronden(instrumentId: unknown): boolean {
  return heeftDedicatedGenerator(instrumentId);
}
