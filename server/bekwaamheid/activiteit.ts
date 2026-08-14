// =============================================================================
// server/bekwaamheid/activiteit.ts — bewijsstuk 5, zuiver
//
// Bouwplan §4: "Bewijsstuk 5 — praktijkdossier en activiteit — is niets anders
// dan een query op `afnames`. De activiteitsdrempel van zes afnames per
// instrument per 24 maanden is een `SELECT COUNT(*)`. En `server/afnamekwaliteit.ts`
// meet al hoe zorgvuldig een deelnemer een vragenlijst doorloopt. (…) Die module
// is nu een melding bij één afname. Ze is een handtekening van praktijkzorg over
// 24 afnames."
//
// Deze module is die aggregatie, en niets meer. Ze krijgt afnamerijen binnen en
// geeft twee dingen terug: hoeveel er in het venster vallen, en wat het
// kwaliteitsbeeld over die afnames is. Geen databank, geen Express.
//
// Wat deze module met opzet NIET doet: een oordeel vellen. Draaiboek §5.2:
// "Onder de drempel is **geen tekortkoming**: het is de trigger voor de route
// slapende licentie of reactivatie." Vandaar dat de uitkomst `haalt` heet en niet
// `voldoet`, en dat er nergens het woord onvoldoende valt. Wat er met een
// onderschrijding gebeurt, beslist de beslismachine, en die zakt er niemand op.
// =============================================================================

import {
  berekenAfnamekwaliteit,
  leesItemTijden,
  AANDEEL_DREMPEL,
  type Afnamekwaliteit,
} from "../afnamekwaliteit";

/**
 * Eén afname, zoals de telling hem nodig heeft.
 *
 * `voltooidOp` en niet `createdAt`: een aangemaakte maar nooit afgeronde afname
 * is geen praktijkactiviteit. Zou de telling op aanmaakdatum gaan, dan haalt
 * iemand de drempel door zes uitnodigingen te versturen die niemand invult.
 */
export type AfnameVoorActiviteit = {
  id: number;
  instrumentId: string | null;
  /** ISO-datum, of null zolang de afname niet voltooid is. */
  voltooidOp: string | null;
  /** Ruwe kolominhoud; wordt met `leesItemTijden` veilig geparseerd. */
  itemTijden?: unknown;
};

export type Praktijkzorgsignaal = {
  /** Aantal voltooide afnames in het venster waarvan tijdgegevens bestaan. */
  metTijdgegevens: number;
  /** Aantal daarvan waarop de kwaliteitsvlag aan stond. */
  metVlag: number;
  /**
   * Aandeel afnames met een vlag, of null wanneer er geen enkele afname
   * tijdgegevens had.
   */
  aandeelMetVlag: number | null;
  /**
   * True wanneer het aandeel gevlagde afnames de drempel overschrijdt én er
   * genoeg afnames zijn om er iets over te zeggen. Een signaal, geen oordeel.
   */
  signaal: boolean;
};

export type ActiviteitUitkomst = {
  instrumentId: string;
  vensterVan: string;
  vensterTot: string;
  /** Aantal voltooide afnames van dit instrument binnen het venster. */
  aantal: number;
  drempel: number;
  /** True zodra `aantal >= drempel`. Onderschrijding is geen tekortkoming. */
  haalt: boolean;
  /** Hoeveel afnames er nog nodig zijn; 0 zodra de drempel gehaald is. */
  tekort: number;
  praktijkzorg: Praktijkzorgsignaal;
};

/**
 * Minimaal aantal afnames met tijdgegevens voordat het praktijkzorgsignaal aan
 * mag.
 *
 * Vier, niet vijf en niet één. `afnamekwaliteit.ts` gebruikt zelf een ondergrens
 * van vijf items binnen één afname, met de reden: "Onder de vijf gemeten items is
 * het aandeel te wankel om iets over te zeggen." Diezelfde logica geldt een laag
 * hoger, maar met een andere teller: hier gaat het om afnames, niet om items, en
 * de activiteitsdrempel zelf is zes. Een ondergrens van vijf of zes zou betekenen
 * dat juist bij wie weinig afneemt nooit een signaal kan ontstaan, terwijl daar
 * de aanleiding tot kijken het grootst is. Vier laat een signaal toe bij twee van
 * de vier gevlagde afnames en houdt het tegen bij één van de drie.
 */
export const MINIMUM_AFNAMES_VOOR_SIGNAAL = 4;

/**
 * Berekent de eerste dag van het venster.
 *
 * Aparte functie omdat de maandaftrek de enige plek is waar een datumfout kan
 * insluipen die niemand opmerkt: 31 maart minus één maand is in JavaScript
 * 3 maart, niet 28 februari. Bij een venster van 24 maanden speelt dat alleen op
 * 29 februari, en dan precies één keer per vier jaar — het soort fout dat pas in
 * 2028 aan het licht komt en dan een bezwaar oplevert. De correctie klemt de dag
 * naar de laatste dag van de doelmaand.
 */
export function vensterBegin(peildatum: string, maanden: number): string {
  const d = new Date(`${peildatum.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Ongeldige peildatum: ${peildatum}`);
  }
  const dag = d.getUTCDate();
  const doel = new Date(d.getTime());
  doel.setUTCDate(1);
  doel.setUTCMonth(doel.getUTCMonth() - maanden);
  // Laatste dag van de doelmaand: dag 0 van de volgende maand.
  const laatsteDag = new Date(
    Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0),
  ).getUTCDate();
  doel.setUTCDate(Math.min(dag, laatsteDag));
  return doel.toISOString().slice(0, 10);
}

/**
 * Telt de praktijkactiviteit van één instrument over het venster.
 *
 * Het venster is halfopen aan de onderkant en gesloten aan de bovenkant:
 * `vensterVan <= voltooidOp <= peildatum`. Beide grenzen tellen mee. Dat is een
 * keuze en ze staat hier zodat ze bij een bezwaar na te lezen is: een afname die
 * exact op de eerste dag van het venster is voltooid, valt erbinnen. De
 * alternatieve keuze zou iemand op één dag laten struikelen zonder dat daar een
 * inhoudelijke reden voor is.
 */
export function berekenActiviteit(
  afnames: readonly AfnameVoorActiviteit[],
  opties: {
    instrumentId: string;
    peildatum: string;
    drempel: number;
    vensterMaanden: number;
  },
): ActiviteitUitkomst {
  const vensterTot = opties.peildatum.slice(0, 10);
  const vensterVan = vensterBegin(vensterTot, opties.vensterMaanden);

  const binnen = afnames.filter((a) => {
    if (a.instrumentId !== opties.instrumentId) return false;
    if (!a.voltooidOp) return false;
    const dag = a.voltooidOp.slice(0, 10);
    return dag >= vensterVan && dag <= vensterTot;
  });

  let metTijdgegevens = 0;
  let metVlag = 0;
  for (const a of binnen) {
    const tijden = leesItemTijden(a.itemTijden);
    const kwaliteit: Afnamekwaliteit | null = berekenAfnamekwaliteit(tijden);
    if (!kwaliteit) continue;
    metTijdgegevens += 1;
    if (kwaliteit.vlag) metVlag += 1;
  }

  const aandeelMetVlag =
    metTijdgegevens > 0 ? Math.round((metVlag / metTijdgegevens) * 1000) / 1000 : null;

  const aantal = binnen.length;
  return {
    instrumentId: opties.instrumentId,
    vensterVan,
    vensterTot,
    aantal,
    drempel: opties.drempel,
    haalt: aantal >= opties.drempel,
    tekort: Math.max(0, opties.drempel - aantal),
    praktijkzorg: {
      metTijdgegevens,
      metVlag,
      aandeelMetVlag,
      signaal:
        metTijdgegevens >= MINIMUM_AFNAMES_VOOR_SIGNAAL &&
        aandeelMetVlag !== null &&
        aandeelMetVlag > AANDEEL_DREMPEL,
    },
  };
}
