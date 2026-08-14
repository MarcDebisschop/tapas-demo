// ---------------------------------------------------------------------------
// server/bekwaamheid/rondeloop.ts — welke fase na welke fase mag komen.
//
// WAAROM DIT EEN EIGEN BESTAND IS. `RONDEFASEN` in schema.ts is een lijst van
// elf woorden, en de CHECK in de databank toetst alleen of een waarde in die
// lijst staat. Ze zegt niets over volgorde. Zonder deze tabel zou een ronde van
// `afgesloten` terug naar `voorbereiding` kunnen springen, of van
// `voorbereiding` rechtstreeks naar `beslist` — een beslissing zonder dat er
// ooit een bewijsstuk is ingeleverd. Beide zijn met een losse UPDATE mogelijk
// en beide zijn onverdedigbaar bij een bezwaar.
//
// WAAROM HET EEN ZUIVERE FUNCTIE IS EN GEEN METHODE OP DE OPSLAG. De vraag "mag
// deze overgang" hangt van niets anders af dan van twee woorden. Een zuivere
// functie is uitputtend te toetsen: elf maal elf is honderdeenentwintig paren,
// en de test loopt ze allemaal af. Zat dezelfde regel in een opslagmethode, dan
// zou elke toets een databank nodig hebben en zou niemand ze alle 121 schrijven.
//
// WAT DE TABEL NIET DOET. Ze zegt niet of een overgang inhoudelijk verantwoord
// is — of er genoeg bewijsstukken beoordeeld zijn, of twee bekrachtigers hebben
// getekend. Dat zijn vragen over gegevens en die staan in de opslaglaag en in
// beslisregels.ts. Deze tabel bewaakt uitsluitend de vorm van de loop.
// ---------------------------------------------------------------------------
import { RONDEFASEN, type Rondefase } from "./schema";

/**
 * Per fase de fasen die erop mogen volgen.
 *
 * Drie keuzes die niet vanzelf spreken en die hier staan opgeschreven omdat ze
 * anders over een jaar als toeval gelezen worden.
 *
 * 1. `ingeleverd` mag terug naar `open`. Een beoordelaar die vaststelt dat een
 *    bewijsstuk onbruikbaar is opgenomen, moet de kandidaat kunnen laten
 *    aanvullen zonder de ronde te staken. Dat is de enige toegestane stap terug
 *    in de hele loop.
 *
 * 2. `gestaakt` is bereikbaar tot en met `overleg`, en daarna niet meer. Vanaf
 *    `beslist` is er een uitkomst over een persoon vastgelegd; die uitkomst laten
 *    verdwijnen door de ronde te staken zou het spoor uitwissen. Wie een
 *    genomen beslissing wil aanvechten, gaat via `bezwaar`.
 *
 * 3. `bezwaar` kan terug naar `in_beoordeling`. Een gegrond bezwaar dat alleen
 *    tot een aantekening leidt, is geen bezwaarrecht. De ronde gaat dan opnieuw
 *    door de beoordeling heen, met dezelfde loop erna.
 */
export const TOEGESTANE_OVERGANGEN: Readonly<Record<Rondefase, readonly Rondefase[]>> = {
  voorbereiding: ["open", "gestaakt"],
  open: ["ingeleverd", "gestaakt"],
  ingeleverd: ["in_beoordeling", "open", "gestaakt"],
  in_beoordeling: ["beslissing_voorstel", "overleg", "gestaakt"],
  beslissing_voorstel: ["overleg", "beslist", "gestaakt"],
  overleg: ["beslist", "gestaakt"],
  beslist: ["gedebrieft"],
  gedebrieft: ["afgesloten", "bezwaar"],
  afgesloten: ["bezwaar"],
  bezwaar: ["afgesloten", "in_beoordeling"],
  gestaakt: [],
} as const;

/**
 * De fasen waarin een ronde blijvend tot stilstand is gekomen.
 *
 * `afgesloten` staat er niet bij, en dat is geen vergetelheid: de bezwaartermijn
 * van dertig kalenderdagen loopt door nadat de ronde is afgesloten. Een ronde
 * die afgesloten heet, kan dus nog bewegen.
 */
export const EINDFASEN: readonly Rondefase[] = ["gestaakt"];

/** Fasen waarin een kandidaat nog bewijsstukken mag inleveren. */
export const FASEN_MET_INLEVERRECHT: readonly Rondefase[] = ["open"];

/** Fasen waarin beoordelaars scores mogen invoeren of herzien. */
export const FASEN_MET_SCOREINVOER: readonly Rondefase[] = [
  "in_beoordeling",
  "beslissing_voorstel",
  "overleg",
];

export function magOvergang(van: Rondefase, naar: Rondefase): boolean {
  return TOEGESTANE_OVERGANGEN[van].includes(naar);
}

/**
 * Legt uit waarom een overgang niet mag, in woorden die een scherm kan tonen.
 *
 * Geeft `null` terug wanneer de overgang wél mag. De tekst noemt de toegestane
 * vervolgfasen, want een weigering zonder alternatief laat de gebruiker zoeken.
 */
export function bezwaarTegenOvergang(van: Rondefase, naar: Rondefase): string | null {
  if (magOvergang(van, naar)) return null;
  if (van === naar) {
    return `De ronde staat al in fase '${van}'.`;
  }
  const toegestaan = TOEGESTANE_OVERGANGEN[van];
  if (toegestaan.length === 0) {
    return `Fase '${van}' is een eindfase; er volgt geen fase meer op.`;
  }
  return `Van '${van}' kan alleen naar ${toegestaan.map((f) => `'${f}'`).join(" of ")}.`;
}

/** Toetst of een willekeurige tekst een bekende fase is. */
export function isRondefase(waarde: unknown): waarde is Rondefase {
  return typeof waarde === "string" && (RONDEFASEN as readonly string[]).includes(waarde);
}
