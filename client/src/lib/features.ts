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
 *   2. Build-time env  VITE_BELEVING="true"  (fallback/standaard bij eerste bezoek)
 *
 * Als geen van deze een waarde geeft, is de DEFAULT de KALE VERSIE (Core).
 * De standaard van de toepassing is dus Core, en de onthaalpagina is de
 * voordeur. Elk nieuw bezoek begint daar.
 *
 * DE KEUZE WORDT NERGENS BEWAARD. Dat is een bewuste beslissing van 16 augustus
 * 2026. Vroeger bleef een keuze voor de belevingslaag in localStorage staan,
 * ook na het sluiten van de browser. Wie een keer gewisseld had, kreeg bij elk
 * volgend bezoek de poorten in plaats van de onthaalpagina, zonder te kunnen
 * zien waarom. De belevingslaag is nu alleen bereikbaar zolang ?beleving=1 in
 * het adres staat. De schakelaar zet die parameter en haalt hem weer weg.
 *
 * Wisselen gebeurt met zetBeleving(true|false): dat zet of wist de parameter en
 * herlaadt de pagina. Een herlaad (geen herbouw) volstaat om
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
 * Bepaalt de actuele BELEVING-waarde uit de URL, met de env als fallback.
 * Er wordt niets bewaard: verdwijnt de parameter ?beleving=… uit het adres,
 * dan staat de toepassing weer in Core.
 */
function bepaalBeleving(): boolean {
  // Een keuze die vroeger wel bewaard werd, wordt bij het laden opgeruimd. Zo
  // komt een browser die de oude sleutel nog draagt vanzelf weer in Core
  // terecht, zonder dat er iets met de hand gewist hoeft te worden.
  ruimOudeKeuzeOp();

  // 1. URL-parameter. Dit is de enige manier om de belevingslaag aan te zetten.
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("beleving");
    if (raw !== null) {
      return raw === "1" || raw === "true" || raw === "aan";
    }
  } catch {
    /* geen window/URL, negeren */
  }

  // 2. Build-time env als fallback en standaard. Staat die niet op "true", dan
  //    is de uitkomst Core en staat de onthaalpagina op de voordeur.
  return envBeleving();
}

/** Wist de sleutel waarin de keuze vroeger bewaard werd. */
function ruimOudeKeuzeOp(): void {
  try {
    if (window.localStorage.getItem(OPSLAG_SLEUTEL) !== null) {
      window.localStorage.removeItem(OPSLAG_SLEUTEL);
    }
  } catch {
    /* localStorage niet beschikbaar, negeren */
  }
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
 * Wisselt de belevingsmodus tijdens runtime: zet of wist de parameter in het
 * adres en herlaadt de pagina. Er wordt niets bewaard. Geen rebuild nodig.
 *
 * @param aan  true = volledig platform, false = TaPas Core.
 */
export function zetBeleving(aan: boolean): void {
  // Een sleutel uit de oude opzet mag het adres niet overstemmen.
  ruimOudeKeuzeOp();
  // Aanzetten schrijft ?beleving=1 in het adres, uitzetten haalt de parameter
  // weg. Daarna volgt altijd een volledige herlaad, zodat BELEVING opnieuw
  // bepaald wordt. We gebruiken location.replace() met een expliciete
  // herlaad-fallback: enkel location.href toewijzen aan dezelfde URL herlaadt
  // niet wanneer er aan het adres niets veranderde.
  try {
    const url = new URL(window.location.href);
    const oudeWaarde = url.searchParams.get("beleving");
    if (aan) {
      url.searchParams.set("beleving", "1");
    } else {
      url.searchParams.delete("beleving");
    }
    const hadParam = oudeWaarde !== url.searchParams.get("beleving");

    // BELANGRIJK — 404 vermijden bij terugschakelen naar Core.
    // De app gebruikt hash-routing (#/pad). Bepaalde routes bestaan alléén in
    // het volledige platform (/academy, /academy/jester, /impact, /lounge,
    // /poort, /poort/:skin). Wie op zo'n pagina staat en naar Core schakelt,
    // zou na de herlaad op een niet-geregistreerde route belanden -> 404.
    // Daarom sturen we bij het uitschakelen (aan === false) de hash terug naar
    // de startpagina, die in beide modi bestaat. Inschakelen behoudt de hash:
    // alle Core-routes bestaan ook in het volledige platform.
    let hashGewijzigd = false;
    if (!aan) {
      const belevingPaden = [
        /^#\/academy(\/|$)/,
        /^#\/impact(\/|$)/,
        /^#\/lounge(\/|$)/,
        /^#\/poort(\/|$)/,
      ];
      const huidigeHash = url.hash || "";
      if (belevingPaden.some((re) => re.test(huidigeHash))) {
        url.hash = "#/";
        hashGewijzigd = true;
      }
    }

    if (hadParam) {
      // De query-parameter verandert -> replace laadt een echt andere URL en
      // herlaadt het document (de hash is hierboven, indien nodig, al gezet).
      window.location.replace(url.toString());
    } else if (hashGewijzigd) {
      // Enkel de hash wijzigt. Een hash-only wijziging via replace() of href
      // herlaadt het document NIET (browsers zien dit als in-page navigatie).
      // Daarom zetten we eerst de hash en forceren daarna expliciet een
      // volledige herlaad, zodat BELEVING opnieuw wordt bepaald en de
      // belevings-modus-class in main.tsx correct wordt (her)toegepast.
      window.location.hash = url.hash;
      window.location.reload();
    } else {
      // URL blijft identiek -> expliciet herladen.
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
