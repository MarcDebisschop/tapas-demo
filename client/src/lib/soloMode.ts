/**
 * Solo-modus detectie (T4Teens-only pilot)
 * ─────────────────────────────────────────────────────────────────────────────
 * NIEUW BESTAND (Werkprotocol Regel 2 — strikt additief).
 *
 * Als de build-time variabele VITE_SOLO_INSTRUMENT is gezet (bv. "t4teens"),
 * draait de app in "solo-modus": één instrument staat centraal, alle andere
 * ingangen/werelden worden in de UI verborgen en de PoortenIntro wordt
 * overgeslagen. Zo landt een leerling via zijn persoonlijke #/deelnemer/:token
 * link rechtstreeks in de vragenlijst → rapport, zonder zijpaden.
 *
 * Default-uit: is de variabele leeg/afwezig (zoals in .env.production), dan
 * gedraagt het platform zich EXACT als vandaag. Bestaand gedrag ongewijzigd
 * (Regel 1). Deze module raakt geen bestaand pad aan; ze levert enkel helpers
 * die App.tsx op één plek raadpleegt.
 *
 * Spiegel van client/src/lib/demoMode.ts qua stijl en env-detectie.
 */

/** Het actieve solo-instrument, of "" als solo-modus uit staat. */
export const SOLO_INSTRUMENT: string =
  (import.meta.env.VITE_SOLO_INSTRUMENT ?? "").trim();

/** True zodra er een solo-instrument is ingesteld. */
export const SOLO_MODE: boolean = SOLO_INSTRUMENT.length > 0;

/**
 * Slaat de PoortenIntro over in solo-modus.
 * Wordt in App.tsx additief in OR gezet met de bestaande isAdminRoute():
 *   useState(() => isAdminRoute() || soloSkipIntro())
 * Staat de vlag uit → retourneert false → gedrag identiek aan nu.
 */
export function soloSkipIntro(): boolean {
  return SOLO_MODE;
}

/**
 * Bepaalt of een navigatie-element naar een ander instrument/wereld
 * verborgen moet worden. In solo-modus verbergen we alles wat niet bij het
 * actieve instrument hoort. Buiten solo-modus altijd tonen (false = niet
 * verbergen), zodat de bestaande UI onaangeroerd blijft.
 *
 * Gebruik in een nav-component:
 *   {!verbergBuitenSolo() && <NavLinks ... />}
 */
export function verbergBuitenSolo(): boolean {
  return SOLO_MODE;
}
