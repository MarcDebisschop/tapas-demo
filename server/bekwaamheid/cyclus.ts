/**
 * De licentiecyclus in cijfers, en het rekenwerk op data.
 *
 * Waarom dit een eigen bestand is en geen constanten bovenaan de opslaglaag.
 * De duur van een cyclus is de enige grootheid in deze module die een besluit is
 * en geen gevolg van een besluit. Ze staat hier één keer, met de onderbouwing
 * ernaast, zodat een latere wijziging op één plaats gebeurt en niet op zeven.
 *
 * Zuivere functies. Geen databank, geen express, geen opslaglaag — hetzelfde
 * uitgangspunt als `server/traject/rechten.ts`. Alles wat hier rekent, is met een
 * datum en een getal te testen.
 *
 * De cyclus. Twee jaar, met een licht controlemoment na twaalf maanden.
 *
 * Waarom twee en niet drie. Drie jaar sluit aan bij wat ICF en PMI hanteren,
 * maar die beroepsomgevingen hebben een dichtheid — verplichte intervisie,
 * grote registers, permanente vorming met plafonds — die hier niet bestaat. De
 * literatuur over verval van vaardigheid laat aanzienlijk verval zien na twaalf
 * maanden zonder gebruik. Bij een cyclus van drie jaar zit er dan tot dertig
 * maanden tussen twee momenten waarop iemand naar dat verval kijkt. Twee jaar
 * met een tussentijds moment na twaalf maanden halveert dat gat tot twaalf
 * maanden, zonder dat de zware meting twee keer zo vaak moet gebeuren.
 *
 * Waarom het tussentijdse moment geen meting is. Het kijkt naar drie signalen
 * die het platform al kent of goedkoop kan kennen. Het levert geen score op,
 * geen norm en geen statuswijziging. De enige uitkomst met gevolg is een alert,
 * en die vraagt een coachingsplan — geen sanctie.
 */

/** Duur van een licentie in maanden. */
export const CYCLUS_MAANDEN = 24;

/** Wanneer het tussentijdse controlemoment valt, in maanden na de bekrachtiging. */
export const TUSSENTIJDSE_TOETS_MAANDEN = 12;

/** Venster waarover praktijkactiviteit voor de bekrachtiging wordt geteld. */
export const ACTIVITEITSVENSTER_MAANDEN = 24;

/** Aantal afnames per instrument dat over het volledige venster wordt verwacht. */
export const ACTIVITEITSDREMPEL = 6;

/**
 * Venster en drempel van het tussentijdse moment.
 *
 * De drempel is de helft van de tweejaarsdrempel en wordt hier berekend en niet
 * apart gezet. Reden: twee losse getallen kunnen uit elkaar gaan lopen zodra
 * iemand er één wijzigt. Bij een oneven drempel wordt naar boven afgerond, want
 * de helft van vijf is drie in het voordeel van de norm en niet twee.
 */
export const TUSSENTIJDS_VENSTER_MAANDEN = TUSSENTIJDSE_TOETS_MAANDEN;
export const TUSSENTIJDSE_DREMPEL = Math.ceil(
  (ACTIVITEITSDREMPEL * TUSSENTIJDSE_TOETS_MAANDEN) / ACTIVITEITSVENSTER_MAANDEN,
);

/**
 * Ondergrens voor het gemiddelde van de oefensessies waaronder signaal 2
 * aanslaat, op een schaal van 0 tot 100.
 *
 * Dit getal is niet gekozen maar overgenomen. `bepaalInschaling` in
 * `server/routes-stm.ts:452` legt de grens tussen "onvoldoende" en
 * "net_voldoende" op 0,55. Het platform vertelt de practitioner dus al jaren dat
 * 55 procent de ondergrens is. Een tweede, eigen grens verzinnen zou betekenen
 * dat iemand "net voldoende" te zien krijgt en tegelijk een signaal.
 *
 * De schaal is 0 tot 100 en niet 0 tot 1, omdat de opslaglaag alles naar die
 * schaal omrekent. Waarom dat nodig is, staat bij `leesOefenaggregaat` in
 * `storage.ts`: de kolom bevat twee schalen naast elkaar.
 *
 * Zodra er itemanalyse is, hoort dit getal opnieuw te worden vastgesteld en niet
 * stilletjes te blijven staan.
 */
export const OEFENGEMIDDELDE_ONDERGRENS = 55;

/** Standaardtermijn waarop een coachingsplan wordt geëvalueerd, in maanden. */
export const COACHINGSPLAN_EVALUATIE_MAANDEN = 6;

/**
 * Telt maanden bij een ISO-datum op en levert opnieuw een ISO-datum (YYYY-MM-DD).
 *
 * Waarom niet met `setMonth` alleen. Van 31 maart twaalf maanden verder is 31
 * maart, maar van 31 augustus zes maanden verder bestaat niet: `setMonth` maakt
 * daar 3 maart van, een maand verder dan bedoeld. Deze functie zet zo'n datum op
 * de laatste dag van de doelmaand. Een agendapost die een dag opschuift is
 * onschuldig; een agendapost die een maand opschuift is een gemiste termijn.
 */
export function telMaandenOp(isoDatum: string, maanden: number): string {
  const bron = new Date(`${isoDatum.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(bron.getTime())) {
    throw new Error(`Ongeldige datum: ${isoDatum}`);
  }
  const jaar = bron.getUTCFullYear();
  const maand = bron.getUTCMonth();
  const dag = bron.getUTCDate();

  const doelMaandTotaal = maand + maanden;
  const doelJaar = jaar + Math.floor(doelMaandTotaal / 12);
  const doelMaand = ((doelMaandTotaal % 12) + 12) % 12;

  // Laatste dag van de doelmaand: dag 0 van de maand erna.
  const laatsteDag = new Date(Date.UTC(doelJaar, doelMaand + 1, 0)).getUTCDate();
  const doelDag = Math.min(dag, laatsteDag);

  return new Date(Date.UTC(doelJaar, doelMaand, doelDag)).toISOString().slice(0, 10);
}

/** Trekt maanden van een ISO-datum af. */
export function telMaandenAf(isoDatum: string, maanden: number): string {
  return telMaandenOp(isoDatum, -maanden);
}

export interface CyclusData {
  /** Datum van de bekrachtiging waarop deze cyclus start. */
  bekrachtigdOp: string;
  /** Einde van de licentie. */
  geldigTot: string;
  /** Het tussentijdse controlemoment. */
  tussentijdseToets: string;
}

/**
 * Bepaalt de twee data die uit één bekrachtiging volgen.
 *
 * Beide data worden bij de bekrachtiging gezet en niet bij het naderen ervan.
 * Een termijn die pas bestaat wanneer iemand eraan denkt, is precies de termijn
 * die vergeten wordt.
 */
export function berekenCyclus(bekrachtigdOp: string): CyclusData {
  return {
    bekrachtigdOp: bekrachtigdOp.slice(0, 10),
    geldigTot: telMaandenOp(bekrachtigdOp, CYCLUS_MAANDEN),
    tussentijdseToets: telMaandenOp(bekrachtigdOp, TUSSENTIJDSE_TOETS_MAANDEN),
  };
}

export interface Venster {
  van: string;
  tot: string;
}

/** Het venster van n maanden dat op de peildatum eindigt. */
export function vensterTot(peildatum: string, maanden: number): Venster {
  return { van: telMaandenAf(peildatum, maanden), tot: peildatum.slice(0, 10) };
}
