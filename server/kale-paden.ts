/**
 * server/kale-paden.ts
 *
 * Waar een kaal pad naartoe hoort.
 * ---------------------------------------------------------------------------
 * AANLEIDING. De links in de post dragen geen hekje meer, want een deelnemer
 * verloor het laatste stuk van zijn link en kwam op een foutpagina. Sindsdien
 * rust elke uitnodiging op deze regel: een kaal pad hoort achter het hekje, en de
 * zoekreeks hoort VOOR het hekje te blijven staan, want de 2MINSCAN leest zijn
 * token uit de gewone zoekreeks van het adres.
 *
 * Die regel stond in server/static.ts, en daar was zij niet te keuren zonder een
 * volledige bouw van de client. Nu staat zij hier, los, en houdt een test haar
 * vast.
 */

import path from "node:path";

/** De korte vorm van een 2MINSCAN-uitnodiging: /s/:token. */
const KORTE_2MINSCAN = /^\/s\/([^/]+)\/?$/;

/**
 * Het doel van een doorverwijzing, of null wanneer het pad hier niet thuishoort.
 *
 * `pad` is het pad zonder zoekreeks, `zoekreeks` bevat het vraagteken zelf wel.
 */
export function doorstuurDoel(pad: string, zoekreeks = ""): string | null {
  const p = pad ?? "";
  // De api, de assets en echte bestanden blijven met rust. De startpagina ook:
  // daar zet de client zelf zijn hekje.
  if (p.startsWith("/api") || p.startsWith("/assets") || path.extname(p)) return null;
  if (p === "/" || p === "") return null;

  const kort = p.match(KORTE_2MINSCAN);
  if (kort) {
    return `/?uitnodiging=${encodeURIComponent(kort[1])}#/2minscan`;
  }

  return zoekreeks ? `/${zoekreeks}#${p}` : `/#${p}`;
}
