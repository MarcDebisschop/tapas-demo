// ---------------------------------------------------------------------------
// Gedeelde afleiding van het 4-cijferige dashboard-slot en de voornaam.
//
// De dashboardCode is een deterministisch 4-cijferig cijferslot dat volledig
// wordt AFGELEID uit het dashboard-token (er is geen aparte DB-kolom). Deze
// afleiding stond eerder gedupliceerd in /api/deelnemers/login; ze is hier
// gecentraliseerd zodat het eindscherm (Optie A) exact dezelfde code toont.
// ---------------------------------------------------------------------------

// Deterministisch 4-cijferig slot (0-9) afgeleid van het dashboard-token.
export function dashboardCodeVanToken(dashboardToken: string): string {
  const cijfers = (dashboardToken ?? "").replace(/[^0-9]/g, "");
  return [
    parseInt(cijfers.charAt(0) || "2"),
    parseInt(cijfers.charAt(1) || "0"),
    parseInt(cijfers.charAt(2) || "2"),
    parseInt(cijfers.charAt(3) || "6"),
  ].join("");
}

// Voornaam = eerste woord van de naam ("Marc Debisschop" -> "Marc"); null als leeg.
export function voornaamVanNaam(naam: string | null | undefined): string | null {
  if (!naam) return null;
  return naam.trim().split(/\s+/)[0] ?? null;
}
