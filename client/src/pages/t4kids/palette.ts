// ---------------------------------------------------------------------------
// client/src/pages/t4kids/palette.ts — presentatiehulp (strikt additief).
//
// Eén bron van waarheid voor het nieuwe "tiener"-kleurpalet (10-13 jaar):
// verzadigd, high-contrast en met donkere grounding i.p.v. pastel. Wordt
// gebruikt door zowel de reis (reis-t4kids.tsx) als het rapport
// (t4kids-rapport.tsx). Bevat GEEN dataflow/scoring — enkel kleuren/thema's.
// ---------------------------------------------------------------------------

// Basis (grounding — geeft de "oudere" look)
export const INK = "#0B1220"; // bijna-zwart navy
export const SLATE_DIEP = "#16233A";
export const SURFACE = "#F5F7FA"; // koel leesvlak
export const TEKST_LICHT = "#111827"; // tekst op licht
export const TEKST_DONKER = "#F8FAFC"; // tekst op donker

// Accenten (energiek, verzadigd — talent & passie)
export const CYAN = "#06B6D4";
export const DEEP_TEAL = "#0E7490";
export const ORANGE = "#F97316";
export const MAGENTA = "#EC4899";
export const VIOLET = "#7C3AED";
export const LIME = "#84CC16";

// Eiland-thema's — stoerder & verzadigd met donkere grounding.
export interface IslandPalette {
  korteNaam: string;
  gradient: string; // Tailwind gradient-klassen voor de hero/achtergrond
  accent: string; // hoofdaccent (hex)
  accentZacht: string; // lichtere variant voor badges/ringen
}

export const ISLAND_PALETTES: IslandPalette[] = [
  {
    korteNaam: "Het Keuze-eiland",
    gradient: "from-cyan-500 via-teal-600 to-slate-900",
    accent: CYAN,
    accentZacht: "#67E8F9",
  },
  {
    korteNaam: "Het Figuren-eiland",
    gradient: "from-violet-600 via-fuchsia-600 to-slate-900",
    accent: VIOLET,
    accentZacht: "#C4B5FD",
  },
  {
    korteNaam: "Het Zo-ben-ik-eiland",
    gradient: "from-orange-500 via-pink-600 to-slate-900",
    accent: ORANGE,
    accentZacht: "#FDBA74",
  },
];

// Rapport-brede gradients (tiener-look: teal → violet → ink).
export const COVER_GRADIENT = "from-cyan-500 via-violet-600 to-slate-900";
export const AFSLUITER_GRADIENT = "from-violet-600 via-cyan-500 to-slate-900";
export const AFRONDEN_GRADIENT = "from-cyan-500 via-violet-700 to-slate-900";

// Focus-kleuren voor grafieken/tegels (verzadigde varianten uit het palet).
export const FOCUS_KLEUR: Record<string, string> = {
  Abstraherend: VIOLET,
  "Doelgericht-Creatief": ORANGE,
  "Sociaal-gericht": MAGENTA,
  Uitvoerend: DEEP_TEAL,
  "Overdracht-gericht": CYAN,
  "Artistiek-Creatief": "#A855F7",
};

export const TAPPIE_SRC = "/t4kids/tappie_gids.png";
