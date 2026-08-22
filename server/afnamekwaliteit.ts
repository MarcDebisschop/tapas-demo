// ---------------------------------------------------------------------------
// TaPas Platform - Afnamekwaliteit op basis van de tijd per item
//
// Waarom deze module bestaat (normentoetsing, criteria C07, C08, C20):
// tot nu toe legde het platform nergens vast hoe lang een deelnemer over een
// item deed. Zonder die tijd is niet te zien of een vragenlijst aandachtig of
// juist heel snel is doorlopen. Deze module rekent de tijd per item om naar een
// eenvoudige kwaliteitsmelding OVER DE AFNAME.
//
// Uitdrukkelijk geen oordeel over de persoon: de uitkomst is geen score, geen
// eigenschap en geen diagnose. Ze zegt alleen iets over de manier waarop deze
// ene vragenlijst is ingevuld, zodat een begeleider de uitkomsten met de juiste
// voorzichtigheid leest.
//
// KEUZE VAN DE DREMPELS (onderbouwd, bewust conservatief):
//
// 1. Tijdsdrempel per item: 2000 milliseconden.
//    In de literatuur over onzorgvuldig invulgedrag geldt ongeveer twee
//    seconden per item als ondergrens: sneller dan dat is een item in de
//    praktijk niet te lezen, te begrijpen en te beantwoorden. Items onder deze
//    grens worden geteld als "erg snel beantwoord".
//
// 2. Aandeel dat een melding oplevert: 15 procent.
//    Een enkel snel antwoord is normaal. Iemand kan een item herkennen, twijfel
//    hebben weggenomen of gewoon vlot zijn. Pas wanneer meer dan vijftien
//    procent van de items erg snel is beantwoord, wijst het patroon op haast
//    over de hele vragenlijst heen. Vijftien procent is bewust aan de hoge kant
//    gekozen: liever geen melding dan een onterechte melding.
//
// 3. Minimaal aantal items met tijdgegevens: 5.
//    Onder de vijf gemeten items is het aandeel te wankel om iets over te
//    zeggen. Dan berekenen we het aandeel wel, maar zetten we nooit een vlag.
//
// BACKWARD COMPATIBEL: afnames van voor de invoering van de tijdmeting hebben
// geen tijdgegevens. Die leveren `null` op, dus geen vlag en geen foutmelding.
// Ze tonen simpelweg geen kwaliteitsmelding.
// ---------------------------------------------------------------------------

// Ondergrens waaronder een item als "erg snel beantwoord" telt (milliseconden).
export const ITEM_TIJDSDREMPEL_MS = 2000;

// Vanaf welk aandeel erg snel beantwoorde items we een melding tonen.
export const AANDEEL_DREMPEL = 0.15;

// Minimaal aantal items met een bruikbare tijdmeting voor een vlag.
export const MINIMUM_ITEMS_MET_TIJD = 5;

// Duur per item, in milliseconden, met de itemsleutel als sleutel.
// In dit instrument is een item een getoond scherm met bijbehorende keuzes.
export type ItemTijden = Record<string, unknown>;

export interface Afnamekwaliteit {
  // Aantal items waarvoor een bruikbare duur beschikbaar is.
  itemsMetTijd: number;
  // Aantal daarvan dat onder de tijdsdrempel viel.
  itemsOnderDrempel: number;
  // Aandeel tussen 0 en 1, afgerond op drie decimalen.
  aandeelOnderDrempel: number;
  // De gehanteerde drempels, zodat achteraf na te gaan is welke beslisregel
  // op deze afname is toegepast.
  tijdsdrempelMs: number;
  aandeelDrempel: number;
  // Staat de kwaliteitsmelding aan?
  vlag: boolean;
  // Neutrale melding in gewone taal, of null wanneer er niets te melden is.
  melding: string | null;
}

// Alleen eindige, niet-negatieve getallen zijn een bruikbare duur. Een negatieve
// of onmogelijke waarde (klok verzet, ontbrekend beginpunt) telt niet mee in
// plaats van de hele berekening te laten mislukken.
function bruikbareDuren(itemTijden: ItemTijden | null | undefined): number[] {
  if (!itemTijden || typeof itemTijden !== "object") return [];
  return Object.values(itemTijden).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0,
  );
}

// Berekent de afnamekwaliteit uit de tijd per item.
// Geeft null terug wanneer er geen enkele bruikbare tijdmeting is: die afname
// toont dan gewoon geen kwaliteitsmelding.
export function berekenAfnamekwaliteit(
  itemTijden: ItemTijden | null | undefined,
): Afnamekwaliteit | null {
  const duren = bruikbareDuren(itemTijden);
  if (!duren.length) return null;

  const itemsOnderDrempel = duren.filter((d) => d < ITEM_TIJDSDREMPEL_MS).length;
  const aandeel = Math.round((itemsOnderDrempel / duren.length) * 1000) / 1000;

  // Te weinig gemeten items: het aandeel is dan te wankel om er iets aan op te
  // hangen, dus wel rapporteren maar nooit vlaggen.
  const genoegItems = duren.length >= MINIMUM_ITEMS_MET_TIJD;
  const vlag = genoegItems && aandeel > AANDEEL_DREMPEL;

  return {
    itemsMetTijd: duren.length,
    itemsOnderDrempel,
    aandeelOnderDrempel: aandeel,
    tijdsdrempelMs: ITEM_TIJDSDREMPEL_MS,
    aandeelDrempel: AANDEEL_DREMPEL,
    vlag,
    melding: vlag ? meldingVoor(itemsOnderDrempel, duren.length) : null,
  };
}

// Neutrale melding in gewone taal. Gaat over de afname, nooit over de persoon:
// geen woorden als "slordig", "onbetrouwbaar" of "niet serieus".
function meldingVoor(itemsOnderDrempel: number, itemsMetTijd: number): string {
  const procent = Math.round((itemsOnderDrempel / itemsMetTijd) * 100);
  return (
    `Deze vragenlijst is deels in een hoog tempo ingevuld: ${itemsOnderDrempel} van de ` +
    `${itemsMetTijd} items werden binnen twee seconden beantwoord (${procent} procent). ` +
    "Dat kan gewoon vlotheid zijn, maar het kan ook betekenen dat een deel van de vragen " +
    "snel is doorlopen. Lees de uitkomsten daarom als een startpunt voor gesprek en toets " +
    "ze samen met de deelnemer."
  );
}

/**
 * Dezelfde melding, maar gericht aan de deelnemer zelf. De rapporten van
 * T4Students en T4Teens spreken de jongere aan; een tekst over "de deelnemer"
 * klinkt daar alsof er over iemand heen gepraat wordt. Levert null wanneer er
 * niets te melden is, zodat de aanroeper geen eigen vlagcontrole hoeft te doen.
 */
export function tempoMeldingJij(kwaliteit: Afnamekwaliteit | null | undefined): string | null {
  if (!kwaliteit || !kwaliteit.vlag || !kwaliteit.itemsMetTijd) return null;
  const procent = Math.round((kwaliteit.itemsOnderDrempel / kwaliteit.itemsMetTijd) * 100);
  return (
    `Je hebt deze vragenlijst deels in een hoog tempo ingevuld: ${kwaliteit.itemsOnderDrempel} ` +
    `van de ${kwaliteit.itemsMetTijd} vragen kregen binnen twee seconden een antwoord ` +
    `(${procent} procent). Dat kan gewoon vlotheid zijn, en het kan betekenen dat een deel van ` +
    "de vragen snel is doorlopen. Het zegt niets over jou en niets over je talenten: het gaat " +
    "alleen over de manier waarop de lijst is doorlopen. Lees de uitkomsten daarom rustig na " +
    "en bespreek ze met iemand die je kent."
  );
}

// Leest de opgeslagen JSON-tekst met tijden per item veilig uit. Onleesbare of
// ontbrekende inhoud levert null op in plaats van een fout: de afname blijft
// dan gewoon werken, alleen zonder kwaliteitsmelding.
export function leesItemTijden(ruw: unknown): ItemTijden | null {
  if (!ruw) return null;
  if (typeof ruw === "object") return ruw as ItemTijden;
  if (typeof ruw !== "string") return null;
  try {
    const parsed = JSON.parse(ruw);
    return parsed && typeof parsed === "object" ? (parsed as ItemTijden) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Invulpatroon: dezelfde antwoordkeuze in een lange reeks
//
// Naast het tempo zegt ook het PATROON van de antwoorden iets over de manier
// van invullen. Wie op elke stelling hetzelfde antwoord aanduidt, doorloopt de
// lijst mogelijk zonder de stellingen echt te wegen. In de literatuur over
// onzorgvuldig invulgedrag heet dat straightlining.
//
// Ook hier: geen oordeel over de persoon en geen score. Twee mensen kunnen
// dezelfde reeks hebben en toch oprecht antwoorden, bijvoorbeeld wanneer een
// heel blok stellingen echt niet op hen past. De uitkomst is een leessignaal.
//
// KEUZE VAN DE DREMPELS (ontwerpconventie, niet empirisch geijkt):
//
// 1. Langste reeks gelijke antwoorden: 10.
//    Bij een vierpuntsschaal is een reeks van tien gelijke antwoorden op rij
//    ongewoon lang. Tien is bewust ruim gekozen: liever geen melding dan een
//    onterechte.
//
// 2. Aandeel van het meest gekozen antwoord: 0,80.
//    Wie tachtig procent of meer van alle stellingen met hetzelfde antwoord
//    beantwoordt, gebruikt de schaal nauwelijks. Ook dit is ruim gekozen.
//
// 3. Minimaal aantal antwoorden: 15.
//    Onder de vijftien antwoorden is een reeks of een aandeel te wankel om er
//    iets aan op te hangen. Dan berekenen we wel, maar vlaggen we nooit.
// ---------------------------------------------------------------------------

/** Langste reeks gelijke antwoorden waarboven we een melding tonen. */
export const REEKS_DREMPEL = 10;

/** Aandeel van het meest gekozen antwoord waarboven we een melding tonen. */
export const AANDEEL_ZELFDE_DREMPEL = 0.8;

/** Minimaal aantal antwoorden voor een melding over het invulpatroon. */
export const MINIMUM_ANTWOORDEN_PATROON = 15;

export interface Invulpatroon {
  /** Aantal bruikbare antwoorden waarop dit berekend is. */
  antwoorden: number;
  /** Langste reeks identieke antwoorden op rij. */
  langsteReeks: number;
  /** Aandeel van het meest gekozen antwoord, tussen 0 en 1, op drie decimalen. */
  aandeelZelfdeAntwoord: number;
  /** Aantal verschillende antwoordwaarden dat gebruikt is. */
  gebruikteWaarden: number;
  /** De gehanteerde drempels, zodat de beslisregel achteraf leesbaar blijft. */
  reeksDrempel: number;
  aandeelDrempel: number;
  vlag: boolean;
  melding: string | null;
}

/**
 * Berekent het invulpatroon uit de antwoordwaarden IN DE VOLGORDE waarin de
 * stellingen zijn aangeboden. De volgorde doet ertoe: de langste reeks is
 * anders niet te bepalen. Levert null wanneer er geen bruikbare antwoorden zijn.
 */
export function berekenInvulpatroon(waarden: Array<number | null | undefined>): Invulpatroon | null {
  const reeks = waarden.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!reeks.length) return null;

  let langste = 1;
  let lopend = 1;
  for (let i = 1; i < reeks.length; i++) {
    lopend = reeks[i] === reeks[i - 1] ? lopend + 1 : 1;
    if (lopend > langste) langste = lopend;
  }

  const tellingen = new Map<number, number>();
  for (const v of reeks) tellingen.set(v, (tellingen.get(v) ?? 0) + 1);
  const meest = Math.max(...Array.from(tellingen.values()));
  const aandeel = Math.round((meest / reeks.length) * 1000) / 1000;

  const genoeg = reeks.length >= MINIMUM_ANTWOORDEN_PATROON;
  const vlag = genoeg && (langste >= REEKS_DREMPEL || aandeel >= AANDEEL_ZELFDE_DREMPEL);

  return {
    antwoorden: reeks.length,
    langsteReeks: langste,
    aandeelZelfdeAntwoord: aandeel,
    gebruikteWaarden: tellingen.size,
    reeksDrempel: REEKS_DREMPEL,
    aandeelDrempel: AANDEEL_ZELFDE_DREMPEL,
    vlag,
    melding: vlag ? patroonMelding(langste, aandeel, reeks.length) : null,
  };
}

// De vaststelling zelf, zonder lezing: welke van de twee patronen opvalt.
// Staat apart omdat zowel de coachtekst als de tekst voor de deelnemer haar
// gebruikt; twee losse formuleringen zouden vroeg of laat uiteenlopen.
function patroonVaststelling(langsteReeks: number, aandeel: number, antwoorden: number): string {
  const procent = Math.round(aandeel * 100);
  const stukken: string[] = [];
  if (langsteReeks >= REEKS_DREMPEL) {
    stukken.push(`${langsteReeks} stellingen op rij kregen hetzelfde antwoord`);
  }
  if (aandeel >= AANDEEL_ZELFDE_DREMPEL) {
    stukken.push(`${procent} procent van de ${antwoorden} antwoorden is dezelfde keuze`);
  }
  return stukken.join(" en ");
}

/**
 * De patroonmelding gericht aan de deelnemer zelf, om dezelfde reden als bij
 * tempoMeldingJij. Levert null wanneer er niets te melden is.
 */
export function patroonMeldingJij(patroon: Invulpatroon | null | undefined): string | null {
  if (!patroon || !patroon.vlag) return null;
  const vaststelling = patroonVaststelling(
    patroon.langsteReeks,
    patroon.aandeelZelfdeAntwoord,
    patroon.antwoorden,
  );
  return (
    `In je antwoorden valt een patroon op: ${vaststelling}. Dat kan betekenen dat die vragen ` +
    "echt op dezelfde manier bij je passen, en het kan betekenen dat de lijst in een vast ritme " +
    "is doorlopen. Het zegt niets over wie je bent. Bespreek bij het nalezen vooral de " +
    "onderdelen waar je jezelf het minst herkende: juist daar wordt zichtbaar of de antwoorden " +
    "voor jou nog kloppen."
  );
}

// Neutrale melding over de afname, nooit over de persoon.
function patroonMelding(langsteReeks: number, aandeel: number, antwoorden: number): string {
  const stukken = patroonVaststelling(langsteReeks, aandeel, antwoorden);
  return (
    `In deze vragenlijst valt het antwoordpatroon op: ${stukken}. ` +
    "Dat kan betekenen dat een reeks stellingen echt op dezelfde manier past, en het kan " +
    "betekenen dat de lijst in een vast ritme is doorlopen. Het zegt niets over de deelnemer " +
    "zelf. Toets bij het nalezen samen of de antwoorden nog kloppen."
  );
}
