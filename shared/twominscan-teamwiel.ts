// =============================================================================
// shared/twominscan-teamwiel.ts — het tarief van één temperamentenwiel
// -----------------------------------------------------------------------------
// Waarom dit bestand bestaat
//   Het teamwiel van de 2MINSCAN werd tot nu zonder verrekening aangeboden: wie
//   de pagina vond, kon een volledig energetisch teamprofiel van tien bladen
//   maken zonder dat er iets werd afgeboekt. Een teamwiel is nochtans een eigen
//   product: het brengt meerdere afnames samen in één rapport dat een coach met
//   een team gebruikt.
//
//   Sinds die beslissing kost één temperamentenwiel vier credits. Dat getal
//   staat hier, en enkel hier: de server boekt ermee af, de teamwielpagina
//   toont het bij de aankoopstap en de instrumentengids zet het op de knop.
//   Stond het op drie plaatsen, dan zou het vroeg of laat op drie plaatsen
//   anders staan — en dan is het niet meer duidelijk wat een klant betaalt.
//
// Waarom een env-sleutel
//   De andere collectieve producten in dit platform werken zo ook
//   (T4R_SESSIE_CREDITS, HDD_TRAJECT_CREDITS): het tarief kan per omgeving
//   afwijken zonder code te wijzigen. Een ongeldige of ontbrekende waarde valt
//   terug op het afgesproken tarief in plaats van op nul, want gratis afboeken
//   is erger dan een verkeerd tarief.
// =============================================================================

/** Het afgesproken tarief: één temperamentenwiel kost vier credits. */
export const TEAMWIEL_CREDITS_STANDAARD = 4;

/**
 * Het geldende tarief. Leest `TWOMINSCAN_TEAMWIEL_CREDITS` uit de omgeving
 * wanneer die er is en een geheel getal groter dan nul bevat; anders geldt het
 * afgesproken tarief.
 */
export function teamwielCredits(omgeving?: Record<string, string | undefined>): number {
  const ruw = (omgeving ?? (typeof process !== "undefined" ? process.env : undefined))?.[
    "TWOMINSCAN_TEAMWIEL_CREDITS"
  ];
  if (ruw == null || String(ruw).trim() === "") return TEAMWIEL_CREDITS_STANDAARD;
  const getal = Number(ruw);
  if (!Number.isInteger(getal) || getal <= 0) return TEAMWIEL_CREDITS_STANDAARD;
  return getal;
}

/** Bijvoorbeeld "4 credits" — één credit blijft enkelvoud. */
export function teamwielCreditsTekst(credits: number = TEAMWIEL_CREDITS_STANDAARD): string {
  return `${credits} ${credits === 1 ? "credit" : "credits"}`;
}
