// ---------------------------------------------------------------------------
// TaPas Platform — Fase E: taal-constanten (zonder DB-afhankelijkheden)
//
// Apart van schema.ts zodat zowel de client (geen drizzle) als de server deze
// constanten veilig kunnen importeren. NL is de bron- en standaardtaal.
// ---------------------------------------------------------------------------

export const TALEN = ["nl", "fr", "en", "es", "ru"] as const;
export type Taal = (typeof TALEN)[number];
export const STANDAARD_TAAL: Taal = "nl";

export function isTaal(x: unknown): x is Taal {
  return (TALEN as readonly string[]).includes(String(x));
}

// Normaliseert willekeurige invoer naar een geldige Taal (terugval op NL).
export function normaliseerTaal(x: unknown): Taal {
  return isTaal(x) ? (x as Taal) : STANDAARD_TAAL;
}
