// ===========================================================================
// opnieuw-aanmelden.ts: de weg vanaf een publieke pagina loopt altijd langs
// de poort.
//
// Een aanmelding blijft een etmaal geldig. Wie eerder op de dag was
// binnengegaan, kwam vanaf de onthaalpagina met een klik op Beheer zonder iets
// in te vullen weer in de beheeromgeving terecht. Binnen de beheeromgeving is
// dat gewenst: daar hoort niemand bij elke tab opnieuw zijn wachtwoord te
// moeten geven. Vanaf een publieke pagina hoort de poort er wel te staan.
//
// De verwijzing Beheer op de onthaalpagina zet daarom een vlag klaar. De poort
// leest die vlag bij het openen, beeindigt eerst de lopende aanmelding bij de
// server en toont dan het aanmeldscherm.
//
// De vlag staat in de sessieopslag van het tabblad en niet in het adres. Een
// adres kan door de router herschreven worden en blijft achter in de
// geschiedenis; een vlag die bij het lezen meteen wordt weggehaald, werkt
// precies een keer en laat geen spoor na.
// ===========================================================================

export const OPNIEUW_SLEUTEL = "tapas_beheer_opnieuw";

/** Minimale opslag: precies wat deze regel nodig heeft. */
export interface Vlagopslag {
  lees(sleutel: string): string | null;
  schrijf(sleutel: string, waarde: string): void;
  wis(sleutel: string): void;
}

/** De sessieopslag van de browser, met een stille terugval. */
export function sessieOpslag(): Vlagopslag {
  return {
    lees(sleutel) {
      try {
        return window.sessionStorage.getItem(sleutel);
      } catch {
        return null;
      }
    },
    schrijf(sleutel, waarde) {
      try {
        window.sessionStorage.setItem(sleutel, waarde);
      } catch {
        /* geen opslag: dan blijft de lopende aanmelding gewoon staan */
      }
    },
    wis(sleutel) {
      try {
        window.sessionStorage.removeItem(sleutel);
      } catch {
        /* niets te wissen */
      }
    },
  };
}

/** Zet de vlag: de eerstvolgende keer dat de poort opent, wordt afgemeld. */
export function vraagOpnieuwAanmelden(opslag: Vlagopslag): void {
  opslag.schrijf(OPNIEUW_SLEUTEL, "1");
}

/**
 * Leest de vlag en haalt hem meteen weg. Geeft true als er afgemeld moet
 * worden. Een tweede lezing geeft altijd false.
 */
export function neemOpnieuwVlag(opslag: Vlagopslag): boolean {
  const staat = opslag.lees(OPNIEUW_SLEUTEL) === "1";
  if (staat) opslag.wis(OPNIEUW_SLEUTEL);
  return staat;
}

/** Gemaksfunctie voor de verwijzing op de onthaalpagina. */
export function vraagOpnieuwAanmeldenNu(): void {
  if (typeof window === "undefined") return;
  vraagOpnieuwAanmelden(sessieOpslag());
}

/** Gemaksfunctie voor de poort. */
export function neemOpnieuwVlagNu(): boolean {
  if (typeof window === "undefined") return false;
  return neemOpnieuwVlag(sessieOpslag());
}
