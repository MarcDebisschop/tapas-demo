// ---------------------------------------------------------------------------
// server/csrf-bescherming.ts
//
// Auditbevinding H-2 (hoog): "Geen bescherming tegen cross-site request forgery".
// De sessiecookie staat op sameSite "auto", wat op HTTPS neerkomt op
// SameSite=None. Dat is een bewuste keuze - de frontend praat cross-origin met de
// backend achter de pplx.app-proxy - maar het schakelt de ingebouwde
// browserbescherming uit, en een compenserende maatregel ontbrak volledig.
//
// DE MAATREGEL: oorsprongverificatie op alle statuswijzigende verzoeken.
// Een browser stuurt bij elk statuswijzigend verzoek (POST, PUT, PATCH, DELETE)
// verplicht een `Origin`-header mee, en die header kan door pagina-JavaScript niet
// vervalst worden. Een kwaadaardige pagina die op de achtergrond een verzoek naar
// dit platform stuurt, verraadt zich dus met haar eigen oorsprong. Wij laten enkel
// oorsprongen door die we kennen; al de rest krijgt 403 en de sessie wordt niet
// aangesproken.
//
// Waarom geen tokengebaseerde aanpak? Een CSRF-token vraagt aanpassingen aan elke
// formulier- en fetch-oproep in de frontend en aan elk extern koppelpunt. Dat is
// een grotere ingreep met meer breukrisico, terwijl oorsprongverificatie exact
// dezelfde aanvalsklasse blokkeert. De tokenaanpak blijft de logische volgende
// stap zodra de cross-origin-opstelling verdwijnt en de cookie op
// SameSite=Strict kan.
//
// WAT DEZE MAATREGEL NIET DOET: een verzoek zonder Origin- en zonder
// Referer-header wordt doorgelaten. Dat is nodig voor server-naar-server-verkeer
// zoals de betaalwebhook en voor scripts, en het is geen browseraanval: een
// browser laat die header bij statuswijzigende verzoeken niet weg. Wie dat gat
// ook wil sluiten, zet TAPAS_CSRF_STRIKT=1; dan worden verzoeken zonder oorsprong
// eveneens geweigerd.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";

const STATUSWIJZIGEND = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Haalt de hostnaam uit een oorsprong of een volledige verwijzende URL. */
function hostVan(waarde: string | undefined): string | null {
  if (!waarde) return null;
  try {
    return new URL(waarde).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Bouwt de lijst van toegestane hosts op. Bevat altijd de host van het verzoek
 * zelf (same-origin blijft dus werken), de lokale ontwikkelhosts, en alles wat in
 * TAPAS_TOEGESTANE_ORIGINS staat (komma-gescheiden, met of zonder schema).
 */
export function toegestaneHosts(eigenHost: string | undefined): Set<string> {
  const lijst = new Set<string>();
  if (eigenHost) lijst.add(eigenHost.toLowerCase());
  for (const h of ["localhost:5000", "127.0.0.1:5000", "localhost:5173", "127.0.0.1:5173"]) {
    lijst.add(h);
  }
  const uitOmgeving = [
    process.env.TAPAS_TOEGESTANE_ORIGINS ?? "",
    process.env.RENDER_EXTERNAL_URL ?? "",
  ].join(",");
  for (const stuk of uitOmgeving.split(",")) {
    const waarde = stuk.trim();
    if (!waarde) continue;
    lijst.add((hostVan(waarde) ?? waarde).toLowerCase());
  }
  return lijst;
}

/**
 * Bepaalt of een verzoek doorgelaten mag worden. Apart van de middleware zodat
 * het gedrag rechtstreeks te testen is.
 */
export function mag(
  methode: string,
  oorsprong: string | undefined,
  verwijzer: string | undefined,
  eigenHost: string | undefined,
  strikt = false,
): { toegestaan: boolean; reden: string } {
  if (!STATUSWIJZIGEND.has(methode.toUpperCase())) {
    return { toegestaan: true, reden: "leesverzoek" };
  }
  const host = hostVan(oorsprong) ?? hostVan(verwijzer);
  if (!host) {
    return strikt
      ? { toegestaan: false, reden: "geen oorsprong (strikte modus)" }
      : { toegestaan: true, reden: "geen oorsprong (geen browserverzoek)" };
  }
  const toegestaan = toegestaneHosts(eigenHost);
  // Subdomeinen van een toegestane host mogen mee (bv. de pplx.app-proxy).
  const treffer =
    toegestaan.has(host) || Array.from(toegestaan).some((h) => !!h && host.endsWith(`.${h}`));
  return treffer
    ? { toegestaan: true, reden: "bekende oorsprong" }
    : { toegestaan: false, reden: "onbekende oorsprong" };
}

/**
 * Express-middleware. Plaats deze VOOR de sessiemiddleware, zodat een geweigerd
 * verzoek de sessieopslag niet eens aanspreekt.
 */
export function csrfBescherming(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) return next();
  const strikt = process.env.TAPAS_CSRF_STRIKT === "1";
  const uitslag = mag(
    req.method,
    req.headers.origin as string | undefined,
    req.headers.referer as string | undefined,
    req.headers.host,
    strikt,
  );
  if (uitslag.toegestaan) return next();
  // Geen persoonsgegevens in het logboek (bevinding S-1): methode, pad en reden.
  console.warn(`[csrf] geweigerd: ${req.method} ${req.path} (${uitslag.reden})`);
  return res.status(403).json({
    error: "Verzoek geweigerd: onbekende oorsprong.",
  });
}
