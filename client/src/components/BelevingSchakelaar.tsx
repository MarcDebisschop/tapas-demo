// =============================================================================
// BelevingSchakelaar — runtime-toggle tussen TaPas Core en volledig platform
// -----------------------------------------------------------------------------
// Een discrete, zwevende schakelaar (rechtsonder) waarmee je zonder rebuild kunt
// wisselen tussen de kale "TaPas Core"-modus en het volledige belevingsplatform.
// De keuze wordt bewaard in localStorage (zie lib/features.ts) en de pagina
// herlaadt automatisch, zodat alle voorwaardelijke paden consistent zijn.
//
// NIEUW BESTAND — geen bestaande code aangepast.
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BELEVING, zetBeleving } from "@/lib/features";
import { schakelaarZichtbaarNu } from "@/lib/schakelaar-zichtbaar";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Layers } from "lucide-react";

/**
 * Zwevende belevingsschakelaar. Plaats één keer in de app (App.tsx), buiten de
 * router, zodat hij op elke pagina zichtbaar is.
 *
 * Aan  = volledig platform (poort, Academy, Lounge, ...).
 * Uit  = TaPas Core (kale instrumenten-versie).
 */
export function BelevingSchakelaar() {
  // De schakelaar staat buiten de router gemonteerd en hertekent dus niet mee
  // met een paginawissel. Daarom volgt hij het adres zelf: bij elke wissel van
  // het deel achter het hekje wordt de zichtbaarheid opnieuw beoordeeld. Zonder
  // dit bleef de schakelaar weg wanneer je van de onthaalpagina naar de
  // platformpagina wandelde zonder de pagina te herladen.
  const [adres, setAdres] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const volg = () => setAdres(window.location.hash);
    window.addEventListener("hashchange", volg);
    window.addEventListener("popstate", volg);
    return () => {
      window.removeEventListener("hashchange", volg);
      window.removeEventListener("popstate", volg);
    };
  }, []);

  // De schakelaar is een werkinstrument. Een bezoeker die voor het eerst op de
  // onthaalpagina landt, ziet hem niet. Op de onthaalpagina komt hij
  // tevoorschijn met ?schakelaar=1 of met ?beleving=... in de URL, en die keuze
  // blijft bewaard. Buiten de onthaalpagina staat hij er gewoon. Zie
  // lib/schakelaar-zichtbaar.ts voor de volledige regel.
  const zichtbaar = useMemo(() => schakelaarZichtbaarNu(), [adres]);

  // Via een portal rechtstreeks in document.body geplaatst, zodat de schakelaar
  // een top-level kind is en met z-index boven de poorten-intro (zIndex 10000)
  // uitkomt. Zonder portal kan de intro-canvas de klikken opvangen doordat de
  // schakelaar in een lagere stacking-context van de app-boom zit.
  if (typeof document === "undefined") return null;
  if (!zichtbaar) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[10001] flex items-center gap-2.5 rounded-full border border-border bg-background/95 px-3.5 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      data-testid="beleving-schakelaar"
      role="group"
      aria-label="Wissel tussen TaPas Core en volledig platform"
    >
      {BELEVING ? (
        <Sparkles className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Layers className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="select-none text-xs font-medium leading-none">
        {BELEVING ? "Volledig platform" : "TaPas Core"}
      </span>
      <Switch
        checked={BELEVING}
        onCheckedChange={(aan) => zetBeleving(aan)}
        aria-label={
          BELEVING
            ? "Schakel over naar TaPas Core (kale versie)"
            : "Schakel over naar het volledige platform"
        }
        data-testid="switch-beleving"
      />
    </div>,
    document.body,
  );
}

export default BelevingSchakelaar;
