// ---------------------------------------------------------------------------
// server/sessie-cookie.ts — naam van de aanmeldcookie (Punt C, doorloop-herstel).
//
// __Host- is geen decoratie: het is een voorvoegsel dat elke standaardconforme
// browser en http-client afdwingt. Een cookie met die naam wordt geweigerd
// (nooit gezet, nooit meegestuurd) zodra hij niet ALTIJD de Secure-vlag
// draagt, ongeacht wat de "auto"-instelling van secure/sameSite er per
// verzoek van maakt. Op een gewone (niet-HTTPS) verbinding staat Secure
// terecht uit, maar dan mag de naam dus ook geen __Host- voorvoegsel dragen,
// anders wordt de cookie nooit gezet en is aanmelden onmogelijk.
//
// bepaalSessieCookieNaam() beslist dit bij het opstarten, op basis van de
// omgevingsvariabelen die vaststellen of de app ALTIJD achter een
// HTTPS-terminatie draait:
//   - NODE_ENV === "production"   → Render-productie, eigen HTTPS.
//   - PPLX_SANDBOX === "true"     → pplx.app-sandbox, HTTPS-proxy ervoor.
// In beide gevallen behoudt de cookie het __Host- voorvoegsel, exact zoals
// voorheen: de beveiliging op een echte, beveiligde omgeving wordt door deze
// wijziging niet verzwakt. Overal elders (lokale ontwikkeling, tests, of een
// installatie zonder eigen HTTPS-terminatie) vervalt enkel het voorvoegsel,
// niet de Secure/SameSite/HttpOnly-instellingen zelf.
export function bepaalSessieCookieNaam(env: Record<string, string | undefined>): string {
  const echteHttpsOmgeving = env.NODE_ENV === "production" || env.PPLX_SANDBOX === "true";
  return echteHttpsOmgeving ? "__Host-tapas-sid" : "tapas-sid";
}
