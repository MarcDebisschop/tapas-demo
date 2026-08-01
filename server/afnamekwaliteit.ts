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
