// ---------------------------------------------------------------------------
// server/scope.ts - het scope-TYPE en de datalaag-primitieven (fase 4).
//
// Dit bestand staat bewust los van `scope-guard.ts`. De guard leidt een scope
// af uit een verzoek en heeft daarvoor `storage` nodig; de datalaag heeft
// enkel het type en de vertaling naar een SQL-filter nodig. Zaten die samen,
// dan zou `repositories/afnames.ts` -> `scope-guard.ts` -> `storage.ts` ->
// `repositories/afnames.ts` een kringverwijzing opleveren.
//
// `scope-guard.ts` exporteert alles hier opnieuw, zodat oproepers een van beide
// modules kunnen gebruiken zonder na te denken over welke.
// ---------------------------------------------------------------------------

export type Scope =
  | { soort: "prior" }
  | { soort: "organisatie"; organisatieId: number }
  | { soort: "geen" };

export const SCOPE_PRIOR: Scope = { soort: "prior" };
export const SCOPE_GEEN: Scope = { soort: "geen" };

/**
 * Wordt geworpen wanneer de datalaag een scope "geen" krijgt. Dat is altijd een
 * programmeerfout: een endpoint hoort scope "geen" al met 403 te hebben
 * afgewezen voor het de datalaag bereikt. Luid falen is hier veiliger dan een
 * lege lijst teruggeven, want een lege lijst is niet van een geslaagde query te
 * onderscheiden en zou het gat verbergen.
 */
export class ScopeFout extends Error {
  constructor(functie: string) {
    super(`${functie} kreeg scope "geen"; dit hoort al met 403 afgewezen te zijn.`);
    this.name = "ScopeFout";
  }
}

/**
 * Vertaalt een scope naar het organisatiefilter dat de datalaag gebruikt:
 *
 *   prior        -> null, oftewel geen filter: alle organisaties EN de afnames
 *                   zonder organisatie (particuliere afnames).
 *   organisatie  -> het id, oftewel `organisatie_id = ?`. Door de
 *                   SQL-NULL-semantiek vallen particuliere afnames daar
 *                   automatisch buiten, wat precies de bedoeling is.
 *   geen         -> werpt.
 *
 * Let op het verschil in betekenis van `null`: hier staat het voor "prior, dus
 * geen beperking", nooit voor "scope onbekend". Een onbekende scope bestaat
 * niet; dat is `{soort:"geen"}` en die werpt.
 */
export function organisatieFilterVanScope(scope: Scope, functie: string): number | null {
  if (scope.soort === "geen") throw new ScopeFout(functie);
  if (scope.soort === "prior") return null;
  return scope.organisatieId;
}

/**
 * Valt een record dat bij `organisatieId` hoort binnen deze scope? Voor
 * losse records (een afname, een rapport) waar geen lijstquery aan te pas
 * komt.
 *
 * Een record zonder organisatie (`null`) is particulier en hoort bij geen
 * enkele organisatie; enkel de prior ziet het. Zou een organisatie het wel
 * zien, dan zou elke organisatie alle particuliere afnames kunnen lezen.
 */
/**
 * Bepaalt onder welke organisatie een NIEUW record mag worden weggeschreven.
 *
 * De prior houdt vrije keuze; hij bedient alle organisaties. Een organisatie
 * krijgt haar eigen id opgelegd, ongeacht wat er in de body stond. Een
 * afwijkende waarde in de body wordt GEWEIGERD en niet stil overschreven: stil
 * overschrijven zou de oproeper laten geloven dat zijn invoer is aanvaard,
 * terwijl er iets anders in de databank belandt.
 */
export function schrijfOrganisatieId(
  scope: Scope,
  gevraagd: number | null | undefined,
): { ok: true; organisatieId: number | null } | { ok: false; fout: string } {
  if (scope.soort === "geen") {
    // Zonder scope mag er wel iets aangemaakt worden, maar niet OP NAAM van een
    // organisatie. Dat is het deelnemerspad: een particuliere afname hoort bij
    // geen enkele organisatie en kost dus ook niemands credits.
    return gevraagd == null
      ? { ok: true, organisatieId: null }
      : { ok: false, fout: "Geen toegang tot deze organisatie." };
  }
  if (scope.soort === "prior") return { ok: true, organisatieId: gevraagd ?? null };
  if (gevraagd != null && gevraagd !== scope.organisatieId) {
    return { ok: false, fout: "U kunt enkel voor uw eigen organisatie aanmaken." };
  }
  return { ok: true, organisatieId: scope.organisatieId };
}

export function valtBinnenScope(scope: Scope, organisatieId: number | null | undefined): boolean {
  if (scope.soort === "geen") return false;
  if (scope.soort === "prior") return true;
  return organisatieId != null && organisatieId === scope.organisatieId;
}
