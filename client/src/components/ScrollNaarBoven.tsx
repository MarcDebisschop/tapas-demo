// ---------------------------------------------------------------------------
// ScrollNaarBoven — globale scroll-reset bij paginawissel
// ---------------------------------------------------------------------------
// Probleem (herhaald gemeld door Marc): bij het navigeren naar een nieuwe
// pagina behield de browser de vorige scrollpositie, waardoor een pagina
// soms "ergens in het midden" opende i.p.v. bovenaan. Dat oogt slordig.
//
// Oorzaak: wouter (de router, met useHashLocation) herstelt de scrollpositie
// NIET automatisch bij een route-wijziging. Slechts enkele losse pagina's
// deden dit handmatig; de meeste (o.a. /coaches) niet.
//
// Oplossing (Regel 2 — nieuwe feature = apart bestand): deze component wordt
// ÉÉN keer binnen de <Router> gemount. Ze rendert niets zichtbaars, maar
// luistert op elke locatie-wijziging en scrollt het venster netjes naar boven.
// Geen enkele bestaande pagina-component wordt aangeraakt (Regel 1).
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ScrollNaarBoven() {
  const [location] = useLocation();

  useEffect(() => {
    // Sommige browsers herstellen scroll bij history-navigatie; uitschakelen
    // zodat wij de controle houden.
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      /* niet beschikbaar — negeren */
    }

    // Scroll het venster naar boven bij elke route-wissel. 'instant' zodat de
    // nieuwe pagina meteen bovenaan verschijnt zonder zichtbare sprong-animatie.
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      // Oudere browsers zonder options-object.
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}
