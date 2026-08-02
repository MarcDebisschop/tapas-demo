// ---------------------------------------------------------------------------
// shared/energie-schaal.ts
//
// De enige bron van waarheid voor alles wat met de energieschaal 0 tot 10 te
// maken heeft: de omzetting vanuit de itemschaal, de knipverdeling in banden en
// de waarde die geldt wanneer er geen energie gemeten is.
//
// WAAROM DIT BESTAAT
// Vier plaatsen legden elk een andere knipverdeling op precies dezelfde schaal:
// het dashboard knipte op 7,5 / 6 / 4,5, het rapport op 7,5 / 5 / 3, T4Sports op
// 7 / 4,5 en de HDD-aggregatie op 7,0 / 5,0. Daarnaast bestonden er twee kopieen
// van de omzetformule en twee verschillende terugvalwaarden (5 en 6). Dezelfde
// score kreeg daardoor in het ene scherm een ander label dan in het andere,
// zonder dat ergens stond waarom. Alles staat nu hier, en alleen hier.
//
// STATUS VAN DE GRENZEN
// Alle grenzen hieronder zijn conventies van de ontwikkelaar. Ze zijn NIET
// empirisch geijkt op een normgroep: er is geen steekproef waarin gemeten is
// waar de overgang tussen "hoog" en "stevig" werkelijk ligt. Ze horen te worden
// herzien zodra er normdata beschikbaar zijn. Er is bewust geen onderbouwing
// bijgeschreven die er niet is.
// ---------------------------------------------------------------------------

// Uiteinden van de itemschaal waarop energie per item wordt bevraagd.
export const ITEM_ENERGIE_MIN = -2;
export const ITEM_ENERGIE_MAX = 2;

// Uiteinden van de gedeelde energieschaal.
export const ENERGIE_MIN = 0;
export const ENERGIE_MAX = 10;

/**
 * Zet een gemiddelde item-energie op de schaal min 2 tot plus 2 om naar de
 * schaal 0 tot 10. Dit is de bestaande formule, letterlijk overgenomen uit
 * server/scoring.ts, inclusief dezelfde afronding op twee decimalen via
 * Number(x.toFixed(2)). Die afrondingswijze staat vast: de scoringsmotor is een
 * getrouwe port van de gevalideerde engine en moet dezelfde getallen geven.
 *
 * De omzetting zelf is een rekenkundige herschaling en geen conventie: min 2
 * wordt 0, 0 wordt 5 en plus 2 wordt 10.
 */
export function energieNaarTienschaal(gemiddeldeItemEnergie: number): number {
  const bereik = ITEM_ENERGIE_MAX - ITEM_ENERGIE_MIN;
  const genormaliseerd = ((gemiddeldeItemEnergie - ITEM_ENERGIE_MIN) / bereik) * ENERGIE_MAX;
  return Number(genormaliseerd.toFixed(2));
}

/**
 * De canonieke knipverdeling met vier banden.
 *
 * CONVENTIE, GEEN IJKING. Deze drie grenzen zijn door de ontwikkelaar gekozen
 * en niet empirisch geijkt op een normgroep. Er bestaat geen onderzoek waaruit
 * volgt dat een 7,4 wezenlijk anders is dan een 7,6. Zij horen te worden
 * herzien zodra er normdata beschikbaar zijn.
 *
 * Dit is de verdeling die het T4P-rapport vandaag al gebruikte; zij is als
 * canoniek gekozen omdat zij de schaal het gelijkmatigst verdeelt en omdat het
 * rapport het stuk is dat de deelnemer meekrijgt.
 */
export const ENERGIE_GRENZEN = {
  // Vanaf hier heet de energie "hoog".
  hoog: 7.5,
  // Vanaf hier heet de energie "stevig". Deze grens ligt op het midden van de
  // schaal en scheidt daarmee de bovenhelft van de onderhelft.
  stevig: 5,
  // Vanaf hier heet de energie "wisselend"; daaronder "kwetsbaar".
  wisselend: 3,
} as const;

export type EnergieBand = "hoog" | "stevig" | "wisselend" | "kwetsbaar";

/** De canonieke band van een score op de schaal 0 tot 10. */
export function energieBand(score: number): EnergieBand {
  if (score >= ENERGIE_GRENZEN.hoog) return "hoog";
  if (score >= ENERGIE_GRENZEN.stevig) return "stevig";
  if (score >= ENERGIE_GRENZEN.wisselend) return "wisselend";
  return "kwetsbaar";
}

export type EnergieBandDrie = "hoog" | "midden" | "laag";

// Sommige plaatsen tonen maar drie niveaus. Die driedeling is een SAMENVOEGING
// van de canonieke vierdeling en bevat daarom geen eigen getallen: de twee
// onderste banden worden samen "laag". Wie de grenzen hierboven verzet, verzet
// automatisch ook deze.
const BAND_NAAR_DRIE: Record<EnergieBand, EnergieBandDrie> = {
  hoog: "hoog",
  stevig: "midden",
  wisselend: "laag",
  kwetsbaar: "laag",
};

/** De afgeleide knipverdeling met drie banden. */
export function energieBandDrie(score: number): EnergieBandDrie {
  return BAND_NAAR_DRIE[energieBand(score)];
}

/** Ligt deze score in de onderste band van de driedeling? */
export function isLageEnergie(score: number): boolean {
  return energieBandDrie(score) === "laag";
}

/** Ligt deze score in de bovenhelft van de schaal (dus niet laag)? */
export function isPositieveEnergie(score: number): boolean {
  return !isLageEnergie(score);
}

/**
 * De waarde die geldt wanneer er geen energie gemeten is.
 *
 * CONVENTIE, GEEN METING. Dit is het midden van de schaal, gekozen omdat het
 * geen richting suggereert. Het blijft een aanname: een terugval op deze waarde
 * betekent niet dat er iets gemeten is. Waar het uitmaakt of er werkelijk
 * gemeten is, hoort de code het ontbreken van energie apart te behandelen in
 * plaats van deze waarde in te vullen.
 */
export const ENERGIE_TERUGVAL = 5;
