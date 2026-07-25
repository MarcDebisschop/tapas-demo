/**
 * Feature-flags — TaPas Core (kale instrumenten-versie) vs. volledig platform
 * ───────────────────────────────────────────────────────────────────────────
 * Het volledige TaPas-platform bevat een belevingslaag: poorten-intro,
 * TaPasAcademy, TaPas Lounge, magic-schermen, impact-etalage, webinars en de
 * verhalende Jester-chat. De investeerdersvisie ("TaPas Core") wil enkel de
 * zakelijke kern: instrumenten uitsturen, afname opvolgen van link tot PDF,
 * credits/facturatie en het deelnemersdashboard.
 *
 * RUNTIME-TOGGLE (geen rebuild nodig)
 * ───────────────────────────────────
 * BELEVING wordt bij het laden bepaald in deze volgorde van prioriteit:
 *   1. URL-parameter  ?beleving=1  (aan)  of  ?beleving=0  (uit)
 *   2. localStorage-sleutel "tapas_beleving" ("true"/"false")
 *   3. Build-time env  VITE_BELEVING="true"  (fallback/standaard bij eerste bezoek)
 *
 * Als geen van deze een waarde geeft, is de DEFAULT de KALE VERSIE (Core).
 *
 * Wisselen gebeurt met zetBeleving(true|false): dat bewaart de keuze in
 * localStorage en herlaadt de pagina. Een herlaad (geen herbouw) volstaat om
 * alle voorwaardelijke paden (routes in App.tsx, het neveneffect in main.tsx,
 * de begin-state van de poorten-intro) consistent te maken. Zo kan de keuze
 * op Render zonder nieuwe build worden gewisseld.
 *
 * Niets wordt verwijderd — de belevingscode blijft volledig in de repo.
 */

const OPSLAG_SLEUTEL = "tapas_beleving";

/** Leest de env-fallback (build-time). Standaard = uit (Core). */
function envBeleving(): boolean {
  try {
    return import.meta.env.VITE_BELEVING === "true";
  } catch {
    return false;
  }
}

/**
 * Bepaalt de actuele BELEVING-waarde uit URL → localStorage → env.
 * Een ?beleving=…-parameter in de URL wordt meteen doorgeschreven naar
 * localStorage, zodat de keuze ook na het wegvallen van de parameter blijft.
 */
function bepaalBeleving(): boolean {
  // 1. URL-parameter heeft voorrang (handig om een directe link te delen).
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("beleving");
    if (raw !== null) {
      const aan = raw === "1" || raw === "true" || raw === "aan";
      try {
        window.localStorage.setItem(OPSLAG_SLEUTEL, aan ? "true" : "false");
      } catch {
        /* localStorage niet beschikbaar — negeren */
      }
      return aan;
    }
  } catch {
    /* geen window/URL — negeren */
  }

  // 2. Eerder bewaarde keuze in localStorage.
  try {
    const opgeslagen = window.localStorage.getItem(OPSLAG_SLEUTEL);
    if (opgeslagen === "true") return true;
    if (opgeslagen === "false") return false;
  } catch {
    /* localStorage niet beschikbaar — negeren */
  }

  // 3. Build-time env als fallback/standaard.
  return envBeleving();
}

/**
 * BELEVING bepaalt of de belevingslaag zichtbaar is:
 *   true  → volledig platform (poort, Academy, Lounge, ...).
 *   false → TaPas Core (default): kale instrumenten-versie.
 *
 * Waarde wordt éénmaal bij het laden bepaald. Wisselen = zetBeleving() +
 * automatische herlaad, waarna deze constante opnieuw wordt geëvalueerd.
 */
export const BELEVING: boolean = bepaalBeleving();

/** True wanneer de app in de kale "TaPas Core"-modus draait (beleving uit). */
export const CORE_MODE: boolean = !BELEVING;

/**
 * Zichtbare productnaam. In Core-modus tonen we "TaPas Core" zodat er geen
 * verwarring is met het volledige belevingsplatform, met behoud van de
 * TaPas-look & feel en het gedachtegoed als endorsement.
 */
export const PRODUCT_NAAM: string = CORE_MODE ? "TaPas Core" : "TaPas";

/**
 * Wisselt de belevingsmodus tijdens runtime: bewaart de keuze in localStorage
 * en herlaadt de pagina. Geen rebuild nodig.
 *
 * @param aan  true = volledig platform, false = TaPas Core.
 */
export function zetBeleving(aan: boolean): void {
  try {
    window.localStorage.setItem(OPSLAG_SLEUTEL, aan ? "true" : "false");
  } catch {
    /* localStorage niet beschikbaar — de herlaad met parameter vangt dit op */
  }
  // Verwijder een eventuele ?beleving=…-parameter uit de URL (zodat de
  // localStorage-keuze leidend wordt) en forceer een volledige herlaad. We
  // gebruiken location.replace() met een expliciete herlaad-fallback: enkel
  // location.href toewijzen aan dezelfde URL herlaadt niet als de parameter
  // al ontbrak.
  try {
    const url = new URL(window.location.href);
    const hadParam = url.searchParams.has("beleving");
    url.searchParams.delete("beleving");
    if (hadParam) {
      // URL verandert echt → replace laadt de nieuwe URL en herlaadt.
      window.location.replace(url.toString());
    } else {
      // URL blijft identiek → expliciet herladen.
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
}

/** Schakelt tussen Core en volledig platform (gemaksfunctie voor de toggle-UI). */
export function wisselBeleving(): void {
  zetBeleving(!BELEVING);
}

/**
 * Gebruik in een component:
 *
 *   import { BELEVING, CORE_MODE, PRODUCT_NAAM, wisselBeleving } from "@/lib/features";
 *
 *   {BELEVING && <Route path="/academy" component={Academy} />}
 *   {BELEVING && <JesterSectie />}
 *   <span>{PRODUCT_NAAM}</span>
 *   <button onClick={wisselBeleving}>Wissel modus</button>
 */
