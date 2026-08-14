/**
 * De rekenkundige kant van het tussentijdse controlemoment.
 *
 * Zuivere functies: geen databank, geen express, geen opslaglaag. Alles wat hier
 * staat, is met drie getallen en een datum te testen. De opslaglaag levert de
 * gelezen waarden aan; deze module beslist wat ze betekenen.
 *
 * Waarom de uitkomstregel zo kort is. Er zijn twee signalen die iets kunnen
 * zeggen, en één regel die ze combineert. Een ingewikkelder regel zou meer
 * lijken te weten dan er gemeten is. Bij één signaal is er iets om over te
 * praten; bij twee signalen is er een patroon — weinig praktijk én weinig of
 * zwakke oefening — en dat is het enige patroon waarbij vroeg ingrijpen
 * goedkoper is dan wachten tot de bekrachtiging.
 *
 * Wat een alert niet doet: de poort sluiten. Deze module raakt de licentiestatus
 * niet en levert geen waarde op die de poort leest. Dat is geen toeval maar de
 * afbakening: `mag_afnemen` staat in `rechten.ts` en kent het begrip alert niet.
 */

import {
  OEFENGEMIDDELDE_ONDERGRENS,
  TUSSENTIJDSE_DREMPEL,
  TUSSENTIJDS_VENSTER_MAANDEN,
  vensterTot,
} from "./cyclus";
import type { Toetsuitkomst } from "./schema";

/** De namen van de twee signalen die kunnen aanslaan. */
export const SIGNAALNAMEN = ["afnames_onder_drempel", "oefening_zwak_of_afwezig"] as const;
export type Signaalnaam = (typeof SIGNAALNAMEN)[number];

export interface Signaal {
  naam: Signaalnaam;
  /** De gelezen waarde, zodat in het dossier staat waarop het signaal berust. */
  gelezenWaarde: number | null;
  /** De grens waaraan die waarde is getoetst. */
  grens: number;
  toelichting: string;
}

/**
 * Wat de opslaglaag heeft gelezen.
 *
 * `stmGemiddelde` is leeg wanneer er geen afgeronde oefensessies in het venster
 * zijn. Nul zou daar een score suggereren die niemand heeft gehaald.
 */
export interface GelezenSignaalwaarden {
  peildatum: string;
  afnamesAantal: number;
  stmSessies: number;
  stmGemiddelde: number | null;
  stmPerLaag?: Record<string, number> | null;
}

export interface ToetsBerekening {
  peildatum: string;
  vensterVan: string;
  vensterTot: string;
  afnamesAantal: number;
  afnamesDrempel: number;
  stmSessies: number;
  stmGemiddelde: number | null;
  stmPerLaag: Record<string, number> | null;
  signalen: Signaal[];
  uitkomst: Toetsuitkomst;
  /** Welke regel de uitkomst bepaalde, in leesbare vorm, voor het dossier. */
  bindendeRegel: string;
}

/**
 * Signaal 1 — aantal afnames.
 *
 * Onder de drempel is dit een signaal en geen sanctie. De drempel is de helft
 * van de tweejaarsdrempel en wordt in `cyclus.ts` berekend, niet apart gezet:
 * twee losse getallen kunnen uit elkaar gaan lopen.
 */
function toetsAfnames(aantal: number): Signaal | null {
  if (aantal >= TUSSENTIJDSE_DREMPEL) return null;
  return {
    naam: "afnames_onder_drempel",
    gelezenWaarde: aantal,
    grens: TUSSENTIJDSE_DREMPEL,
    toelichting:
      `${aantal} afname(s) in ${TUSSENTIJDS_VENSTER_MAANDEN} maanden, ` +
      `onder de verwachting van ${TUSSENTIJDSE_DREMPEL}.`,
  };
}

/**
 * Signaal 2 — de oefensessies.
 *
 * Slaat op twee manieren aan: nul afgeronde sessies in het venster, of een
 * gemiddelde onder de ondergrens. Die twee zijn niet hetzelfde geval maar wel
 * hetzelfde signaal: in beide gevallen is er geen aanwijzing dat de kennis
 * onderhouden wordt.
 *
 * Er wordt uitsluitend naar het aggregaat gekeken. Nooit een individueel
 * antwoord, nooit itemniveau. Deze module krijgt die gegevens ook niet.
 */
function toetsOefening(sessies: number, gemiddelde: number | null): Signaal | null {
  if (sessies === 0) {
    return {
      naam: "oefening_zwak_of_afwezig",
      gelezenWaarde: 0,
      grens: 1,
      toelichting: `Geen afgeronde oefensessies in ${TUSSENTIJDS_VENSTER_MAANDEN} maanden.`,
    };
  }
  if (gemiddelde !== null && gemiddelde < OEFENGEMIDDELDE_ONDERGRENS) {
    return {
      naam: "oefening_zwak_of_afwezig",
      gelezenWaarde: gemiddelde,
      grens: OEFENGEMIDDELDE_ONDERGRENS,
      toelichting:
        `Gemiddelde van de oefensessies ${gemiddelde} ligt onder ` +
        `${OEFENGEMIDDELDE_ONDERGRENS} over ${sessies} sessie(s).`,
    };
  }
  return null;
}

/**
 * De uitkomstregel.
 *
 * Geen signaal → `geen_signaal`. Eén signaal → `aandachtspunt`: benoemd in het
 * gesprek en in het dossier, zonder verplichting. Twee of meer → `alert`, en dan
 * is een coachingsplan verplicht voordat de toets kan worden afgesloten.
 *
 * De derde voorwaarde uit het ontwerp — een laag oefengemiddelde beslist nooit
 * alleen — volgt uit deze regel en hoeft niet apart te worden afgedwongen: één
 * signaal levert hoogstens een aandachtspunt op, wat dat signaal ook is. Er
 * staat toch een uitdrukkelijke toets op in de tests, want een latere wijziging
 * aan de regel mag die eigenschap niet stil verliezen.
 */
export function bepaalUitkomst(signalen: Signaal[]): {
  uitkomst: Toetsuitkomst;
  bindendeRegel: string;
} {
  if (signalen.length === 0) {
    return { uitkomst: "geen_signaal", bindendeRegel: "Geen van de twee signalen sloeg aan." };
  }
  if (signalen.length === 1) {
    return {
      uitkomst: "aandachtspunt",
      bindendeRegel: `Eén signaal sloeg aan (${signalen[0].naam}); één signaal geeft nooit meer dan een aandachtspunt.`,
    };
  }
  return {
    uitkomst: "alert",
    bindendeRegel: `Twee of meer signalen sloegen aan (${signalen
      .map((s) => s.naam)
      .join(", ")}); een coachingsplan is verplicht.`,
  };
}

/** Berekent de volledige toets uit de gelezen waarden. */
export function berekenTussentijdseToets(
  gelezen: GelezenSignaalwaarden,
): ToetsBerekening {
  const venster = vensterTot(gelezen.peildatum, TUSSENTIJDS_VENSTER_MAANDEN);

  const signalen: Signaal[] = [];
  const afnameSignaal = toetsAfnames(gelezen.afnamesAantal);
  if (afnameSignaal) signalen.push(afnameSignaal);
  const oefenSignaal = toetsOefening(gelezen.stmSessies, gelezen.stmGemiddelde);
  if (oefenSignaal) signalen.push(oefenSignaal);

  const { uitkomst, bindendeRegel } = bepaalUitkomst(signalen);

  return {
    peildatum: gelezen.peildatum.slice(0, 10),
    vensterVan: venster.van,
    vensterTot: venster.tot,
    afnamesAantal: gelezen.afnamesAantal,
    afnamesDrempel: TUSSENTIJDSE_DREMPEL,
    stmSessies: gelezen.stmSessies,
    stmGemiddelde: gelezen.stmGemiddelde,
    stmPerLaag: gelezen.stmPerLaag ?? null,
    signalen,
    uitkomst,
    bindendeRegel,
  };
}

/** Of bij deze uitkomst een coachingsplan verplicht is. */
export function vraagtCoachingsplan(uitkomst: Toetsuitkomst): boolean {
  return uitkomst === "alert";
}
