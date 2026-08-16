// ===========================================================================
// schakelaar-zichtbaar.ts: mag de belevingsschakelaar op het scherm staan?
//
// De schakelaar rechtsonder is een werkinstrument, geen onderdeel van het
// aanbod. Een bezoeker die voor het eerst op de onthaalpagina landt, hoort er
// niets van te merken. Wie de belevingslaag bewust opzoekt, moet er wel bij
// kunnen zonder telkens een parameter te moeten meesleuren.
//
// De regel geldt alleen op de onthaalpagina zelf. Dat is de enige plaats waar
// een onbekende bezoeker binnenkomt. Overal daarbuiten, en dus ook op de
// platformpagina, blijft de schakelaar gewoon staan zoals voorheen: wie daar
// terechtkomt, heeft de weg er bewust naartoe genomen en heeft het instrument
// nodig.
//
// De regel op de onthaalpagina
//   1. Staat ?schakelaar=1 in de URL, dan komt de schakelaar tevoorschijn en
//      blijft hij zichtbaar (de keuze wordt bewaard).
//   2. Staat ?schakelaar=0 in de URL, dan verdwijnt hij weer, ook later.
//   3. Staat ?beleving= in de URL, dan zoekt iemand de belevingslaag bewust op:
//      de schakelaar wordt zichtbaar en blijft dat.
//   4. Zonder een van die drie geldt de bewaarde keuze.
//   5. Is er niets bewaard, dan staat de schakelaar uit.
//
// De functie is bewust puur op één punt na: het lezen en schrijven van de
// bewaarde vlag. Daarom staat de opslag achter een klein, injecteerbaar
// koppelstuk, zodat de regel volledig te toetsen valt.
// ===========================================================================

export const SCHAKELAAR_SLEUTEL = "tapas_schakelaar";

/** Minimale opslag: precies wat deze regel nodig heeft. */
export interface Opslag {
  lees(sleutel: string): string | null;
  schrijf(sleutel: string, waarde: string): void;
}

/** De echte opslag van de browser, met een stille terugval. */
export function browserOpslag(): Opslag {
  return {
    lees(sleutel) {
      try {
        return window.localStorage.getItem(sleutel);
      } catch {
        return null;
      }
    },
    schrijf(sleutel, waarde) {
      try {
        window.localStorage.setItem(sleutel, waarde);
      } catch {
        /* geen opslag beschikbaar: de parameter in de URL blijft dan werken */
      }
    },
  };
}

/**
 * Is dit de onthaalpagina, de publieke voordeur?
 *
 * De toepassing gebruikt een hash-router, dus het pad binnen de toepassing
 * staat achter het hekje. Zonder hekje kijken we naar het gewone pad.
 */
export function isOnthaalpagina(hash: string, pad: string): boolean {
  const naHekje = (hash || "").replace(/^#/, "").split("?")[0];
  const binnenpad = naHekje !== "" ? naHekje : pad || "/";
  const genormaliseerd = binnenpad.replace(/\/+$/, "");
  return genormaliseerd === "" || genormaliseerd === "/";
}

/**
 * Beslist of de belevingsschakelaar zichtbaar mag zijn.
 *
 * @param zoekreeks De querystring van de pagina, met of zonder vraagteken.
 * @param opslag    Waar de bewaarde keuze staat.
 */
export function schakelaarZichtbaar(zoekreeks: string, opslag: Opslag): boolean {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(zoekreeks || "");
  } catch {
    params = new URLSearchParams();
  }

  const expliciet = params.get("schakelaar");
  if (expliciet !== null) {
    const aan = expliciet === "1" || expliciet === "true" || expliciet === "aan";
    opslag.schrijf(SCHAKELAAR_SLEUTEL, aan ? "true" : "false");
    return aan;
  }

  if (params.get("beleving") !== null) {
    opslag.schrijf(SCHAKELAAR_SLEUTEL, "true");
    return true;
  }

  const bewaard = opslag.lees(SCHAKELAAR_SLEUTEL);
  if (bewaard === "true") return true;
  if (bewaard === "false") return false;
  return false;
}

/** Gemaksfunctie voor de component: leest de echte URL en de echte opslag. */
export function schakelaarZichtbaarNu(): boolean {
  if (typeof window === "undefined") return false;
  // Buiten de onthaalpagina staat de schakelaar er gewoon, zoals altijd.
  if (!isOnthaalpagina(window.location.hash, window.location.pathname)) return true;
  return schakelaarZichtbaar(window.location.search, browserOpslag());
}
