// ---------------------------------------------------------------------------
// TaPas Platform — Centrale regels rond talent-constructs (één bron van waarheid)
//
// WAAROM DIT BESTAAT
// "TaPas-Beeld" zit in het instrument administratief in de familie "Talent-foci"
// (samen met Strategie, Operationeel, Inter-relationeel, Innovatie). Maar
// inhoudelijk is TaPas-Beeld GEEN talent-focus: het is een identiteits-/
// zelfbeeldlens en een interne kalibratie-/controleconstruct. Het mag daarom
// NOOIT meetellen of getoond worden in de VOLGORDE of LIJST van talent-foci —
// niet in de app, niet in de uitleg, niet in de chatbot, niet in het dashboard.
//
// Het mag wel in de "Talent en energie"-grafiek blijven staan (als losse lens)
// en de INHOUD ervan (hoe iemand zichzelf ziet / wie iemand IS) mag wel diep
// bevraagd worden in de chatbot — maar dan expliciet als zelfbeeld, niet als
// een focus in de focus-rangschikking.
//
// Deze module is dependency-vrij zodat zowel client als server hem veilig
// kunnen importeren. Alle code die talent-foci sorteert/telt/toont MOET via
// isTalentFocusConstruct() / filterTalentFoci() lopen, zodat dit nooit meer
// per ongeluk ergens kan terugkeren.
// ---------------------------------------------------------------------------

// Het canonieke interne construct dat nooit als talent-focus mag verschijnen.
// Alle voorkomende schrijfwijzen (case-insensitief, met/zonder streepje/spatie)
// worden afgevangen.
export const TAPAS_BEELD_CONSTRUCT = "TaPas-Beeld";

// Normaliseer een constructnaam voor robuuste vergelijking: lowercase en
// verwijder spaties/streepjes. Zo matchen "TaPas-Beeld", "TaPas Beeld",
// "tapasbeeld", "TAPASBEELD", "Tapas-beeld", ... allemaal.
function normaliseerConstruct(naam: unknown): string {
  return String(naam ?? "")
    .toLowerCase()
    .replace(/[\s\-_]+/g, "");
}

const TAPAS_BEELD_GENORMALISEERD = normaliseerConstruct(TAPAS_BEELD_CONSTRUCT);

// True als dit construct het (verborgen) TaPas-Beeld is — in welke schrijfwijze
// dan ook.
export function isTapasBeeld(construct: unknown): boolean {
  return normaliseerConstruct(construct) === TAPAS_BEELD_GENORMALISEERD;
}

// True als dit construct een ECHTE, toonbare talent-focus is. Vereist dat de
// familie "Talent-foci" is én dat het NIET TaPas-Beeld is.
export function isTalentFocusConstruct(rij: { family?: unknown; construct?: unknown }): boolean {
  return String(rij?.family ?? "") === "Talent-foci" && !isTapasBeeld(rij?.construct);
}

// Filtert een rijenlijst tot de ECHTE talent-foci (TaPas-Beeld eruit).
// Sorteert NIET — de aanroeper bepaalt zelf de sortering (meestal net aflopend).
export function filterTalentFoci<T extends { family?: unknown; construct?: unknown }>(rows: T[]): T[] {
  return (rows ?? []).filter((r) => isTalentFocusConstruct(r));
}

// Algemene "mag dit construct getoond worden?"-check: TaPas-Beeld wordt overal
// waar constructs in een lijst/rangschikking verschijnen verborgen.
export function isVerborgenConstruct(construct: unknown): boolean {
  return isTapasBeeld(construct);
}
