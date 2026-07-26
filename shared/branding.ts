// ---------------------------------------------------------------------------
// shared/branding.ts - organisatie-personalisatie (fase 9).
//
// Twee dingen wonen hier samen omdat ze allebei een REGEL zijn en geen scherm:
//
//   1. `schoonBranding` - wat een organisatie mag opslaan. De server vertrouwt
//      niets uit de body; dit is de enige poort.
//   2. `brandingBesluit` - WELKE achtergrond een sessie te zien krijgt, en
//      vooral: of het Earhart-watermerk mag verschijnen.
//
// Regel 2 staat hier en niet in een React-component omdat het een merk- en
// identiteitsregel is, geen stijlkeuze. Zo is ze te testen zonder DOM, en zo
// kan niemand haar per ongeluk omzeilen door een component te herschrijven.
// ---------------------------------------------------------------------------

/** De vier personaliseerbare velden. Null betekent: niet ingesteld. */
export interface Branding {
  logoUrl: string | null;
  achtergrondUrl: string | null;
  achtergrondKleur: string | null;
  quote: string | null;
}

export const LEEG_BRANDING: Branding = {
  logoUrl: null,
  achtergrondUrl: null,
  achtergrondKleur: null,
  quote: null,
};

export const QUOTE_MAX = 240;
export const URL_MAX = 500;

/**
 * Alleen `https:`, `http:` en een pad binnen de site zijn toegestaan.
 *
 * Wat hiermee tegengehouden wordt is `javascript:` en `data:` in een
 * `src`-attribuut. Dat is geen theoretisch geval: een organisatie mag haar
 * eigen logo zetten, en zonder deze poort zou dat een manier zijn om script
 * uit te voeren bij iedereen die het portaal opent.
 */
export function veiligeAfbeeldingsUrl(ruw: unknown): string | null {
  if (typeof ruw !== "string") return null;
  const s = ruw.trim();
  if (!s || s.length > URL_MAX) return null;
  // Een pad binnen de site: geen schema, dus niets uit te voeren.
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? s : null;
  } catch {
    return null;
  }
}

/** Enkel `#rgb` en `#rrggbb`. Alles anders is geen kleur maar invoer. */
export function veiligeKleur(ruw: unknown): string | null {
  if (typeof ruw !== "string") return null;
  const s = ruw.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : null;
}

/**
 * De quote is platte tekst en wordt ook als platte tekst weergegeven. De
 * scherpe haken gaan er toch uit: zo kan het veld nooit iets betekenen op een
 * plek waar het later per ongeluk als HTML terechtkomt.
 */
export function veiligeQuote(ruw: unknown): string | null {
  if (typeof ruw !== "string") return null;
  const s = ruw.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.slice(0, QUOTE_MAX);
}

/**
 * Maakt van willekeurige invoer een geldige branding. Elk veld dat de poort
 * niet haalt wordt null: bewust WISSEN in plaats van de oude waarde bewaren,
 * zodat "ik heb het weggehaald" ook echt weghaalt.
 */
export function schoonBranding(ruw: unknown): Branding {
  const b = (ruw ?? {}) as Record<string, unknown>;
  return {
    logoUrl: veiligeAfbeeldingsUrl(b.logoUrl),
    achtergrondUrl: veiligeAfbeeldingsUrl(b.achtergrondUrl),
    achtergrondKleur: veiligeKleur(b.achtergrondKleur),
    quote: veiligeQuote(b.quote),
  };
}

// ── De Earhart-regel ───────────────────────────────────────────────────────

export type BrandingScope = "prior" | "organisatie" | "geen";

export interface BrandingBesluit {
  /**
   * Het Amelia-Earhart-vliegtuigje is het merkteken van TaPasCity zelf. Het
   * hoort NOOIT op het scherm van een klant: dat zou het merk van de een op
   * het portaal van de ander plakken.
   */
  toonEarhart: boolean;
  /** Class op `documentElement`, of null. Schakelt `body::after` uit. */
  klasse: string | null;
  /** Waarde voor `background-image`, of null. */
  achtergrondAfbeelding: string | null;
  /** Waarde voor `background-color`, of null. */
  achtergrondKleur: string | null;
  /** De naam die naast de productnaam in de header hoort, of null. */
  headerToevoeging: string | null;
}

export const ORGANISATIE_BRANDING_KLASSE = "organisatie-branding";

/**
 * Beslist in EEN functie wat een sessie visueel te zien krijgt.
 *
 * De harde regel: zodra de scope een organisatie is, gaat het Earhart-watermerk
 * uit. Ook wanneer die organisatie zelf niets heeft ingesteld. Bij twijfel niet
 * tonen; een klant zonder eigen achtergrond krijgt dan gewoon de effen
 * basisachtergrond, en dat is beter dan andermans merkteken.
 */
export function brandingBesluit(
  scope: BrandingScope,
  organisatieNaam: string | null,
  branding: Branding | null,
): BrandingBesluit {
  if (scope !== "organisatie") {
    // Prior en "geen sessie" houden het platformuiterlijk. De belevingslaag
    // beslist verder zelf of het watermerk daar zichtbaar is (Core toont het
    // sowieso niet); deze functie neemt dat niet over.
    return {
      toonEarhart: true,
      klasse: null,
      achtergrondAfbeelding: null,
      achtergrondKleur: null,
      headerToevoeging: null,
    };
  }
  const b = branding ?? LEEG_BRANDING;
  return {
    toonEarhart: false,
    klasse: ORGANISATIE_BRANDING_KLASSE,
    achtergrondAfbeelding: b.achtergrondUrl ? `url("${b.achtergrondUrl}")` : null,
    achtergrondKleur: b.achtergrondKleur,
    headerToevoeging: organisatieNaam?.trim() ? organisatieNaam.trim() : null,
  };
}

/** "TaPas" plus, binnen een organisatie, haar naam: "TaPas - 2BQ CONSULT". */
export function headerTitel(productNaam: string, toevoeging: string | null): string {
  return toevoeging ? `${productNaam} - ${toevoeging}` : productNaam;
}
