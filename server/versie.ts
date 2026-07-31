// Auditbevinding O-3 (operationele laag): het statusadres gaf `versie: null`,
// omdat het nummer via `process.env.npm_package_version` werd opgehaald. Die
// variabele bestaat alleen wanneer node via npm gestart wordt; Render start met
// `node dist/index.cjs` en dus rechtstreeks, waardoor het nummer nooit aankwam.
//
// Sinds v2.8.0 bakt het bouwscript (script/build.mjs) de drie waarden hieronder
// als vaste tekst in dist/index.cjs. Esbuild vervangt de drie `process.env`-
// verwijzingen letterlijk door hun waarde, zodat de draaiende toepassing niet
// meer afhangt van hoe ze gestart wordt.
//
// Eén bron van waarheid: het versienummer staat uitsluitend in package.json. Het
// bouwscript weigert te bouwen wanneer de bovenste kop van VERSION.md een ander
// nummer noemt, zodat documentatie en code niet uiteen kunnen lopen.

/** Semantisch versienummer uit package.json, ingebakken bij het bouwen. */
export const VERSIE: string =
  process.env.TAPAS_VERSIE ?? process.env.npm_package_version ?? "ontwikkelversie";

/** Korte commit-aanduiding van de gebouwde code, of "onbekend" bij ontwikkelen. */
export const COMMIT: string =
  process.env.TAPAS_COMMIT ?? process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "onbekend";

/** Tijdstip van de bouw in ISO-vorm, of "onbekend" bij ontwikkelen. */
export const BOUWDATUM: string = process.env.TAPAS_BOUWDATUM ?? "onbekend";

/** Alle drie samen, voor het statusadres en voor logboekregels bij het opstarten. */
export function versieGegevens(): { versie: string; commit: string; bouwdatum: string } {
  return { versie: VERSIE, commit: COMMIT, bouwdatum: BOUWDATUM };
}
