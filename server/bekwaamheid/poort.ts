/**
 * De poort.
 *
 * Sectie 7 van het bouwplan noemt dit het kortste en belangrijkste onderdeel:
 * wordt alleen dit gebouwd en de rest niet, dan is er nog steeds iets; wordt
 * alles gebouwd behalve dit, dan is er niets.
 *
 * Dit bestand is de volledige beslissing en niets anders. Geen express, geen
 * databank, geen opslaglaag — alles wat de poort nodig heeft komt binnen als
 * argument. Dat is dezelfde grondhouding als `rechten.ts` en `traject/rechten.ts`,
 * en ze heeft hier een extra reden: een poort die zelf gaat zoeken, is een poort
 * die je niet volledig kan uittesten. De aansluiting op de drie schrijfwegen komt
 * in een aparte laag erboven.
 *
 * De poort bouwt voort op `magAfnemen` uit `rechten.ts` en vervangt die niet.
 * `magAfnemen` weet alleen wat een licentie zegt. De poort weet vier dingen meer:
 * welke handeling wordt gevraagd, of het platformdeel openstaat, of de afnemer
 * een persoon is, en of er een bezwaar loopt.
 *
 * ----------------------------------------------------------------------------
 * Vier dingen die de poort nooit doet (bouwplan 7.3), en waar dat hier staat
 * ----------------------------------------------------------------------------
 *
 * 1. Nooit een lopende afname afbreken. → `HANDELINGEN_BUITEN_DE_POORT`. De
 *    handeling komt binnen als argument, en alles behalve aanmaken verlaat de
 *    functie meteen met `zouWeigeren: false`. Dit staat er expliciet en niet
 *    impliciet, want "wij hangen de poort alleen op aanmaakroutes" is een
 *    afspraak die iemand ooit vergeet.
 * 2. Nooit rapporten of historiek blokkeren. → dezelfde lijst.
 * 3. Nooit weigeren tijdens een lopend bezwaar. → `bezwaarLoopt`, getoetst vóór
 *    elke andere regel. Ook dit bewust expliciet: het mag niet iets zijn dat uit
 *    de statuslogica volgt, want dan verdwijnt het bij de eerste herziening
 *    daarvan.
 * 4. Nooit stil falen. → elke tak geeft een `grond` terug, ook de takken die
 *    doorlaten. `poortregelVoorAudit` maakt daar een auditregel van. Er is geen
 *    pad door deze functie dat niets vastlegt.
 */

import {
  magAfnemen,
  poortstandUitOmgeving,
  type LicentieVoorPoort,
  type Poortstand,
} from "./rechten";
import {
  isWeigerendeGrond,
  poorttekst,
  POORTTEKSTEN,
  type Poortgrond,
} from "./poort-teksten";
import type { Taal } from "@shared/talen";

/**
 * Waar de poort over gaat, en waar niet.
 *
 * Alleen het aanmaken van iets nieuws kan geweigerd worden. De rest van de lijst
 * staat er om punt 1 en 2 van sectie 7.3 in code te zetten in plaats van in een
 * afspraak.
 */
export const HANDELINGEN = [
  "afname_aanmaken",
  "uitnodiging_aanmaken",
  "afname_voortzetten",
  "rapport_bekijken",
  "historiek_bekijken",
] as const;
export type Handeling = (typeof HANDELINGEN)[number];

export const HANDELINGEN_BINNEN_DE_POORT: readonly Handeling[] = [
  "afname_aanmaken",
  "uitnodiging_aanmaken",
];

export function valtBinnenDePoort(handeling: Handeling): boolean {
  return HANDELINGEN_BINNEN_DE_POORT.includes(handeling);
}

/**
 * Wie de handeling stelt.
 *
 * Drie soorten, en het verschil is de hele reden dat dit type bestaat. De
 * inventarisatie van blok 2 stelde vast dat de drie schrijfwegen van de vier
 * individuele families niet dezelfde soort afnemer opleveren:
 *
 *   • `persoon`     — er is een beheerder-sessie; de keten naar een licentie is
 *                     rond en de poort kan doen waarvoor ze bestaat.
 *   • `organisatie` — `bepaalScope` gaf scope "organisatie" zonder beheerder.
 *                     Er is geen persoon, dus geen licentie. Zie beslissing 2.
 *   • `deelnemer`   — het publieke zelfstartpad; geen sessie, geen afnemer.
 *                     Zie beslissing 1.
 */
export type Afnemer =
  | { soort: "persoon"; geaccrediteerdeId: number | null }
  | { soort: "organisatie"; organisatieId: number }
  | { soort: "deelnemer" };

export interface PoortInvoer {
  handeling: Handeling;
  afnemer: Afnemer;
  /** Zoals het op de rij komt te staan. `null` is een echte mogelijkheid. */
  instrumentId: string | null;
  /**
   * De toegangsvlag voor het platformdeel van dit instrument.
   * `true` = open, `false` = dicht, `null` = er is geen platformdeel voor dit
   * instrument gedefinieerd. Die derde waarde is geen luiheid: van de zestien
   * instrumenten in het register hebben er tien geen platformdeel.
   */
  platformdeelToegestaan: boolean | null;
  licentie: LicentieVoorPoort | null;
  /** Staat de persoon in het register van geaccrediteerden? */
  staatInRegister: boolean;
  /** Sectie 7.3 punt 3. Weegt zwaarder dan elke andere regel. */
  bezwaarLoopt: boolean;
  peildatum: string;
  stand?: Poortstand;
  taal?: Taal;
}

export interface PoortUitkomst {
  /** Wat er nú gebeurt. Volgt de stand. */
  toegestaan: boolean;
  /** Wat er bij `handhaaf` zou gebeuren. Volgt de regels, niet de stand. */
  zouWeigeren: boolean;
  /** Altijd gevuld — sectie 7.3 punt 4. */
  grond: Poortgrond;
  stand: Poortstand;
  /** De tekst in de gevraagde taal, met de weg vooruit erbij. */
  tekst: string;
  watNu: { actie: string; url: string | null };
  /**
   * Er bestaat geen platformdeel voor dit instrument, dus voorwaarde 1 van
   * sectie 7.1 kon niet worden getoetst.
   *
   * Dit is uitdrukkelijk géén weigergrond en ook geen uitkomst: iemand met een
   * geldige licentie voor T4Students is bevoegd, ook al is er voor T4Students
   * nooit een afsluitbaar platformdeel gedefinieerd. Het is een signaal over de
   * productdefinitie, niet over de persoon. Het staat als apart veld op de
   * uitkomst zodat de meting de leemte kan tellen zonder dat iemand er last van
   * heeft.
   */
  platformdeelLeemte: boolean;
}

/**
 * De poort.
 *
 * De uitkomst wordt altijd volledig berekend, ook in stand `uit` en `log`. Dat
 * is het hele punt van een schaduwstand: je wil precies weten wat er zou
 * gebeuren, zonder dat het gebeurt. `toegestaan` volgt de stand, `zouWeigeren`
 * volgt de regels.
 */
export function beoordeelPoort(invoer: PoortInvoer): PoortUitkomst {
  const stand = invoer.stand ?? poortstandUitOmgeving();
  const taal: Taal = invoer.taal ?? "nl";

  const uitkomst = (grond: Poortgrond): PoortUitkomst => {
    const zouWeigeren = isWeigerendeGrond(grond);
    return {
      // Alleen `handhaaf` bindt. In `log` en `uit` is de uitkomst een meting.
      toegestaan: stand === "handhaaf" ? !zouWeigeren : true,
      zouWeigeren,
      grond,
      stand,
      tekst: poorttekst(grond, taal),
      watNu: POORTTEKSTEN[grond].watNu,
      platformdeelLeemte: invoer.platformdeelToegestaan === null,
    };
  };

  // 7.3 punt 1 en 2. Vóór alles: wie al bezig is of iets opvraagt uit het
  // verleden, wordt door deze functie nooit tegengehouden.
  if (!valtBinnenDePoort(invoer.handeling)) {
    return uitkomst("handeling_valt_buiten_de_poort");
  }

  // 7.3 punt 3. Vóór elke inhoudelijke regel, en met opzet vóór de
  // statustoets: tijdens bezwaar blijft de situatie ongewijzigd.
  if (invoer.bezwaarLoopt) {
    return uitkomst("bezwaar_loopt");
  }

  // Beslissing 1 — het zelfstartpad valt buiten het licentiekader.
  // Een deelnemer die zelf begint heeft geen afnemer. De poort weigert daar
  // niet op, maar legt het wel vast, zodat het volume zichtbaar blijft.
  if (invoer.afnemer.soort === "deelnemer") {
    return uitkomst("zelfstart_buiten_licentiekader");
  }

  // Beslissing 2 — een organisatieaccount is geen persoon.
  // Een licentie staat altijd op naam. Zolang een organisatiesessie kan
  // uitnodigen zonder aanwijsbare persoon, is de poort op dat pad een lege
  // controle. Dit weigert dus wél, maar de stand bepaalt of het bijt.
  if (invoer.afnemer.soort === "organisatie") {
    return uitkomst("afnemer_niet_herleidbaar");
  }

  // Beslissing 3 — een ontbrekend instrument wordt niet stil aangevuld.
  // De poort mag `null` niet als het standaardinstrument lezen. Deed ze dat,
  // dan verbergt ze een gegevensfout en wordt elke meting per instrument
  // onbetrouwbaar.
  if (invoer.instrumentId === null || invoer.instrumentId.trim() === "") {
    return uitkomst("instrument_onbekend");
  }

  if (!invoer.staatInRegister) {
    return uitkomst("niet_in_register");
  }

  // Voorwaarde 1 van sectie 7.1: de toegangsvlag.
  // `null` betekent dat er voor dit instrument geen platformdeel bestaat. Dan
  // valt er niets te toetsen en weigert de poort daar niet op — een leemte in
  // de productdefinitie hoort geen sanctie voor de gebruiker te worden.
  if (invoer.platformdeelToegestaan === false) {
    return uitkomst("platformdeel_geblokkeerd");
  }

  // Voorwaarde 2 van sectie 7.1: de licentie. Bewust op stand `handhaaf`
  // aangeroepen: de schaduwstand hoort op één plaats te wonen en dat is deze
  // functie. Liet de poort de stand hier doorwerken, dan zou `zouWeigeren` in
  // stand `log` altijd onwaar zijn en meet de nulmeting niets.
  const licentie = magAfnemen({
    licentie: invoer.licentie,
    instrumentId: invoer.instrumentId,
    peildatum: invoer.peildatum,
    stand: "handhaaf",
  });
  if (licentie.grond !== null) {
    return uitkomst(licentie.grond);
  }

  return uitkomst("bevoegd");
}
