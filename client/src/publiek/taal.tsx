// ===========================================================================
// publiek/taal.tsx: de taal van de publieke laag van Tapas CORE.
//
// WAAROM DIT BESTAND BESTAAT
// De publieke laag is de voordeur van een internationaal aanbod. Wie hier voor
// het eerst binnenkomt, leest daarom Engels. Nederlands blijft volwaardig
// aanwezig en staat één knop ver. Frans komt later; de opzet hieronder laat
// een derde taal toe zonder dat er iets aan de pagina's verandert.
//
// WAAROM ZONDER PROVIDER
// De keuze staat in een kleine winkel op moduleniveau, gelezen met
// useSyncExternalStore. Zo hoeft App.tsx niet aangeraakt te worden en merkt
// geen enkel ander deel van het platform iets van deze laag. De deelnemerpoort
// houdt haar eigen taalkeuze uit shared/i18n; die twee staan los van elkaar.
//
// WAT DIT BESTAND NIET DOET
// Het raakt de afname, de scoring, de rapporten en de taal van de deelnemer
// niet aan. Het gaat uitsluitend over de taal van de publieke teksten.
// ===========================================================================

import { useSyncExternalStore } from "react";

/** De talen van de publieke laag. Engels is de standaard. */
export type PubliekeTaal = "en" | "nl";

/** De volgorde waarin de talen in de schakelaar staan. */
export const PUBLIEKE_TALEN: PubliekeTaal[] = ["en", "nl"];

/** Het opschrift van elke taal, altijd in de taal zelf. */
export const PUBLIEKE_TAALNAMEN: Record<PubliekeTaal, string> = {
  en: "English",
  nl: "Nederlands",
};

/** Een tekst in beide talen. */
export type Tweetalig = Record<PubliekeTaal, string>;

const BEWAARSLEUTEL = "tapas.publiek.taal";

function geldig(x: unknown): PubliekeTaal | null {
  return x === "en" || x === "nl" ? x : null;
}

/**
 * De taal bij het eerste bezoek. De volgorde is bewust: een uitdrukkelijke
 * vraag in de adresbalk gaat voor, dan de eerdere keuze van deze bezoeker, en
 * anders Engels. De browsertaal beslist hier niet: een Nederlandstalige
 * bezoeker mag de internationale positionering even goed te zien krijgen, en
 * de knop staat er meteen naast.
 */
function beginTaal(): PubliekeTaal {
  if (typeof window === "undefined") return "en";
  try {
    const uitAdres = geldig(
      new URLSearchParams(window.location.search).get("taal"),
    );
    if (uitAdres) return uitAdres;
    const uitHash = window.location.hash.includes("taal=nl")
      ? "nl"
      : window.location.hash.includes("taal=en")
        ? "en"
        : null;
    if (uitHash) return uitHash;
    const bewaard = geldig(window.localStorage.getItem(BEWAARSLEUTEL));
    if (bewaard) return bewaard;
  } catch {
    // Een browser die opslag weigert, krijgt gewoon de standaardtaal.
  }
  return "en";
}

let huidige: PubliekeTaal = beginTaal();
const luisteraars = new Set<() => void>();

function abonneer(fn: () => void): () => void {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

function lees(): PubliekeTaal {
  return huidige;
}

/** De taal buiten een component opvragen. */
export function publiekeTaal(): PubliekeTaal {
  return huidige;
}

/** De taal zetten en iedereen die meekijkt verwittigen. */
export function zetPubliekeTaal(taal: PubliekeTaal): void {
  if (taal === huidige) return;
  huidige = taal;
  try {
    window.localStorage.setItem(BEWAARSLEUTEL, taal);
  } catch {
    // Zonder opslag geldt de keuze enkel voor dit bezoek.
  }
  luisteraars.forEach((fn) => fn());
}

/** De huidige taal van de publieke laag, met de schakelfunctie erbij. */
export function usePubliekeTaal(): {
  taal: PubliekeTaal;
  zet: (taal: PubliekeTaal) => void;
} {
  const taal = useSyncExternalStore(abonneer, lees, () => "en" as PubliekeTaal);
  return { taal, zet: zetPubliekeTaal };
}

/** Kiest uit een tweetalige waarde het lid van de gevraagde taal. */
export function kies<T>(paar: Record<PubliekeTaal, T>, taal: PubliekeTaal): T {
  return paar[taal];
}

/**
 * De schakelaar. Twee opschriften naast elkaar, de actieve staat gemarkeerd,
 * net zoals de taalkeuze bij de films. Het is geen keuzelijst: met twee talen
 * is één klik korter dan een lijst openen, en de bezoeker ziet meteen dat de
 * pagina ook in de andere taal bestaat.
 */
export function TaalKeuze({ className }: { className?: string }) {
  const { taal, zet } = usePubliekeTaal();
  return (
    <div
      className={className ? `taalkeuze ${className}` : "taalkeuze"}
      role="group"
      aria-label="Language"
      data-testid="publieke-taalkeuze"
    >
      {PUBLIEKE_TALEN.map((t) => (
        <button
          key={t}
          type="button"
          className={t === taal ? "taal aan" : "taal"}
          aria-pressed={t === taal}
          onClick={() => zet(t)}
          data-testid={`publieke-taal-${t}`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default TaalKeuze;
