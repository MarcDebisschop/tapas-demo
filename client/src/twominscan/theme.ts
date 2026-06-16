// 2MINSCAN — Energetic Flow visuele identiteit, afgestemd op de T4P Business Kompas-stijl.
export const KLEUR = {
  petrol: "#1F4E4A",      // diepgroen/teal-donker (primair, = T4P Business Profiel)
  teal: "#2E7D6B",        // positieve energiestroom
  goud: "#C8932B",        // herstel / bewuste keuze / nummering
  roest: "#B14B3A",       // energiekost / frictie
  aubergine: "#6B2F4A",   // professionele identiteit
  inkt: "#1F2A28",        // body-tekst
  zacht: "#F6F4EF",       // achtergrond (warm crème)
  lijn: "#E3DED3",        // rustige scheidingslijn
  // accentkleuren van de 4 energiekleuren
  blauw: "#2F6F8F",
  groen: "#2E7D5B",
  geel: "#C8932B",
  rood: "#B14B3A",
} as const;

export const KLEUR_HEX: Record<string, string> = {
  blauw: KLEUR.blauw, groen: KLEUR.groen, geel: KLEUR.geel, rood: KLEUR.rood,
};
