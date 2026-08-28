// ===========================================================================
// publiek/inhoud.ts: één ingang naar de inhoud van de publieke laag.
//
// WAAROM DIT BESTAND BESTAAT
// De publieke pagina's mogen niet zelf weten in welke taal ze staan. Ze vragen
// hier hun inhoud op met de taal als argument, en krijgen de lijst terug die
// bij die taal hoort. De Nederlandse bron blijft ongewijzigd in
// data/oplossingen.ts staan; de Engelse tegenhanger staat in inhoud-en.ts.
//
// WAT DIT BESTAND NIET DOET
// Het vertaalt niets ter plekke en het bevat zelf geen zichtbare tekst. Het
// kiest enkel. Wie een derde taal toevoegt, voegt hier één regel per lijst toe
// en hoeft geen enkele pagina aan te raken.
//
// MACHINESLEUTELS
// De sleutels, paden en nummers zijn in beide talen identiek. Pagina's mogen
// dus op sleutel en pad vergelijken, nooit op een label.
// ===========================================================================

import {
  AANSLUITING_RECRUITMENT,
  BESLISMOMENTEN,
  CLUSTERS,
  DEMO_CASES,
  DEMO_JOURNEYS,
  DEUREN,
  HDD_OUTPUTS,
  HDD_STAPPEN,
  HDD_UITKOMST,
  HOOFDNAVIGATIE,
  LICENTIES,
  LTE_STAPPEN,
  LTE_UITKOMST,
  MARKERINGEN,
  OUTPUTSTAPEL,
  RR_STAPPEN,
  RR_UITKOMST,
  WEDGE_CLUSTERS,
} from "@/data/oplossingen";

import {
  AANSLUITING_RECRUITMENT_EN,
  BESLISMOMENTEN_EN,
  CLUSTERS_EN,
  DEMO_CASES_EN,
  DEMO_JOURNEYS_EN,
  DEUREN_EN,
  HDD_OUTPUTS_EN,
  HDD_STAPPEN_EN,
  HDD_UITKOMST_EN,
  HOOFDNAVIGATIE_EN,
  LICENTIES_EN,
  LTE_STAPPEN_EN,
  LTE_UITKOMST_EN,
  MARKERINGEN_EN,
  OUTPUTSTAPEL_EN,
  RR_STAPPEN_EN,
  RR_UITKOMST_EN,
  WEDGE_CLUSTERS_EN,
} from "@/publiek/inhoud-en";

import type { PubliekeTaal } from "@/publiek/taal";

/** Kiest tussen de Nederlandse en de Engelse lijst. */
function per<T>(nl: T, en: T, taal: PubliekeTaal): T {
  return taal === "nl" ? nl : en;
}

export const hoofdnavigatie = (t: PubliekeTaal) =>
  per(HOOFDNAVIGATIE, HOOFDNAVIGATIE_EN, t);
export const clusters = (t: PubliekeTaal) => per(CLUSTERS, CLUSTERS_EN, t);
export const wedgeClusters = (t: PubliekeTaal) =>
  per(WEDGE_CLUSTERS, WEDGE_CLUSTERS_EN, t);
export const aansluitingRecruitment = (t: PubliekeTaal) =>
  per(AANSLUITING_RECRUITMENT, AANSLUITING_RECRUITMENT_EN, t);
export const beslismomenten = (t: PubliekeTaal) =>
  per(BESLISMOMENTEN, BESLISMOMENTEN_EN, t);
export const outputstapel = (t: PubliekeTaal) =>
  per(OUTPUTSTAPEL, OUTPUTSTAPEL_EN, t);
export const markeringen = (t: PubliekeTaal) =>
  per(MARKERINGEN, MARKERINGEN_EN, t);
export const hddStappen = (t: PubliekeTaal) =>
  per(HDD_STAPPEN, HDD_STAPPEN_EN, t);
export const hddOutputs = (t: PubliekeTaal) =>
  per(HDD_OUTPUTS, HDD_OUTPUTS_EN, t);
export const hddUitkomst = (t: PubliekeTaal) =>
  per(HDD_UITKOMST, HDD_UITKOMST_EN, t);
export const lteStappen = (t: PubliekeTaal) =>
  per(LTE_STAPPEN, LTE_STAPPEN_EN, t);
export const lteUitkomst = (t: PubliekeTaal) =>
  per(LTE_UITKOMST, LTE_UITKOMST_EN, t);
export const rrStappen = (t: PubliekeTaal) => per(RR_STAPPEN, RR_STAPPEN_EN, t);
export const rrUitkomst = (t: PubliekeTaal) =>
  per(RR_UITKOMST, RR_UITKOMST_EN, t);
export const demoJourneys = (t: PubliekeTaal) =>
  per(DEMO_JOURNEYS, DEMO_JOURNEYS_EN, t);
export const demoCases = (t: PubliekeTaal) => per(DEMO_CASES, DEMO_CASES_EN, t);
export const licenties = (t: PubliekeTaal) => per(LICENTIES, LICENTIES_EN, t);
export const deuren = (t: PubliekeTaal) => per(DEUREN, DEUREN_EN, t);

/** Eén cluster op sleutel, in de gevraagde taal. */
export function cluster(sleutel: string, t: PubliekeTaal) {
  return clusters(t).find((c) => c.sleutel === sleutel);
}
