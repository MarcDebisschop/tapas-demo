// ---------------------------------------------------------------------------
// TaPas Platform — Gedeelde UI-taalcontext (NIEUW, apart bestand — Regel 2)
//
// Doel: één gedeelde, gepersisteerde UI-taal voor de HELE applicatie.
//
// Vóór deze context had elke pagina zijn eigen lokale
//   const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
// waardoor (a) de taalkeuze niet gedeeld werd tussen pagina's en
// (b) de keuze niet onthouden werd na navigatie/refresh.
//
// Deze provider bewaart de keuze in localStorage en deelt hem via React
// Context. De hook useUiTaal() geeft { uiTaal, setUiTaal, t } terug — exact
// de vorm die de bestaande pagina's al gebruikten, zodat de wijziging per
// pagina minimaal blijft (één regel state → één regel hook).
// ---------------------------------------------------------------------------

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  type Taal,
  STANDAARD_TAAL,
  normaliseerTaal,
  maakVertaler,
} from "@shared/i18n";

// Exact hetzelfde type als de bestaande maakVertaler-terugval, zodat pagina's
// die de vertaler doorgeven aan hulpfuncties (bv. sessieLabel(s, n)) blijven
// typechecken zoals voorheen.
type Vertaler = ReturnType<typeof maakVertaler>;

const OPSLAG_SLEUTEL = "tapas_ui_taal";

type TaalContextWaarde = {
  uiTaal: Taal;
  setUiTaal: (t: Taal) => void;
  /** Gebonden vertaler voor de huidige UI-taal. */
  t: Vertaler;
};

const TaalContext = createContext<TaalContextWaarde | null>(null);

// Leest de bewaarde taal uit localStorage (val terug op de standaardtaal).
function leesBewaardeTaal(): Taal {
  if (typeof window === "undefined") return STANDAARD_TAAL;
  try {
    const opgeslagen = window.localStorage.getItem(OPSLAG_SLEUTEL);
    if (opgeslagen) return normaliseerTaal(opgeslagen);
  } catch {
    /* localStorage niet beschikbaar (bv. private mode met blokkering) */
  }
  return STANDAARD_TAAL;
}

export function TaalProvider({ children }: { children: ReactNode }) {
  const [uiTaal, setUiTaalState] = useState<Taal>(leesBewaardeTaal);

  const setUiTaal = useCallback((nieuw: Taal) => {
    const genormaliseerd = normaliseerTaal(nieuw);
    setUiTaalState(genormaliseerd);
    try {
      window.localStorage.setItem(OPSLAG_SLEUTEL, genormaliseerd);
    } catch {
      /* opslag niet beschikbaar — taal blijft dan enkel voor deze sessie */
    }
  }, []);

  // Synchroniseer wijzigingen die in een ander tabblad zijn gemaakt.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === OPSLAG_SLEUTEL && e.newValue) {
        setUiTaalState(normaliseerTaal(e.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Houd het lang-attribuut van het document actueel voor toegankelijkheid.
  useEffect(() => {
    try {
      document.documentElement.lang = uiTaal;
    } catch {
      /* geen document (SSR/tests) */
    }
  }, [uiTaal]);

  const t = maakVertaler(uiTaal);

  return (
    <TaalContext.Provider value={{ uiTaal, setUiTaal, t }}>
      {children}
    </TaalContext.Provider>
  );
}

// Gedeelde hook. Gebruikt binnen de provider de gedeelde/gepersisteerde taal.
// Buiten de provider (defensief) valt hij terug op een lokale, niet-gedeelde
// taal zodat losstaand gebruik nooit crasht. De hook-volgorde is stabiel:
// useContext en useState worden altijd in dezelfde volgorde aangeroepen.
export function useUiTaal(): TaalContextWaarde {
  const ctx = useContext(TaalContext);
  const [lokaleTaal, setLokaleTaal] = useState<Taal>(STANDAARD_TAAL);
  if (ctx) return ctx;
  // Fallback: geen provider gevonden (losstaand gebruik). Werkt lokaal,
  // zonder deling/persistentie, i.p.v. te crashen.
  return {
    uiTaal: lokaleTaal,
    setUiTaal: (x) => setLokaleTaal(normaliseerTaal(x)),
    t: maakVertaler(lokaleTaal),
  };
}
