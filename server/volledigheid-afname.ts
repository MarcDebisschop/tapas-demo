/**
 * server/volledigheid-afname.ts
 *
 * De serverkant van "verplicht doorklikken".
 *
 * Een invulscherm kan omzeild worden. Wie het endpoint rechtstreeks aanroept,
 * kan vandaag een halve vragenlijst inleveren. De opdrachtgever heeft
 * vastgelegd dat dat niet meer mag: een onvolledige vragenlijst kan niet
 * ingediend worden. Deze module beslist of een inzending volledig is, en levert
 * de vriendelijke melding die de deelnemer terugkrijgt.
 *
 * Uitgangspunten:
 *   - Dezelfde regel als het scherm. De rekenkant zit in
 *     shared/verplicht-antwoorden.ts en wordt door beide kanten gebruikt.
 *   - Alleen weigeren waar de verwachte vragenlijst met zekerheid bekend is.
 *     Voor een instrument waarvan de server de vragenset niet kent, blijft
 *     alles zoals het was. Liever geen regel dan een verkeerde regel die een
 *     deelnemer buitensluit.
 *   - Bestaande afnames gaan hier nooit langs. De controle staat op het
 *     inleverpad, niet op het lees- of rapportpad.
 */
import { ontbrekendeBlokken } from "@shared/verplicht-antwoorden";
import type { BlokAntwoord } from "@shared/verplicht-antwoorden";
import { normaliseerTaal, t as vertaal, STANDAARD_TAAL } from "@shared/i18n";
import type { Taal } from "@shared/talen";
import { getDescriptor, getDefaultDescriptor } from "./registry";
import {
  T4KIDS_INTERESSE_PAREN,
  T4KIDS_STELLINGEN,
  T4KIDS_ARCHETYPE_TOP_N,
} from "./t4kids/itembank";

/** Uitkomst van de volledigheidscontrole. */
export type Volledigheid =
  | { volledig: true }
  | { volledig: false; melding: string; ontbreekt: string[] };

/**
 * Instrumenten waarvoor de server de verwachte vragenset kent en dus mag
 * weigeren. Staat een instrument hier niet in, dan verandert er niets aan het
 * gedrag van vandaag.
 *
 * Bewust nog niet in deze lijst:
 *   - t4teens: het invulscherm bouwt per item een blok met één uitspraak,
 *     waardoor "meest" en "minst" nooit allebei gezet kunnen worden. Zolang dat
 *     niet opgelost is, zou een controle elke T4Teens-afname weigeren. Zie het
 *     verslag.
 *   - t4students: het invulscherm wordt in een andere fase gebouwd.
 */
function kentVerwachteVragenset(instrumentId: string | null | undefined): boolean {
  if (instrumentId === "t4kids") return true;
  if (!instrumentId) return true; // het standaard-instrument (T4P Business)
  return instrumentId === getDefaultDescriptor().instrumentId;
}

/** De blokken die de server voor dit instrument verwacht. */
function verwachteBlokken(instrumentId: string | null | undefined) {
  const desc = (instrumentId && getDescriptor(instrumentId)) || getDefaultDescriptor();
  return desc.instrument?.blocks ?? [];
}

/**
 * Controleert of een afname volledig genoeg is om afgerond te worden.
 *
 * @param instrumentId  het instrument van de afname (null = standaard)
 * @param responses     de bewaarde antwoorden van deel 1
 * @param keuzes        de galerij-keuzes van T4Kids, indien meegestuurd
 * @param taal          de taal van de afname, voor de melding
 */
export function controleerAfnameVolledig(opties: {
  instrumentId: string | null | undefined;
  responses: Record<string, BlokAntwoord> | null | undefined;
  keuzes?: { archetypen?: unknown[]; top3?: unknown[] } | null;
  taal?: string | null;
}): Volledigheid {
  const taal: Taal = normaliseerTaal(opties.taal ?? STANDAARD_TAAL);
  if (!kentVerwachteVragenset(opties.instrumentId)) return { volledig: true };

  const ontbreekt =
    opties.instrumentId === "t4kids"
      ? ontbrekendT4Kids(opties.responses, opties.keuzes)
      : ontbrekendStandaard(opties.responses);

  if (ontbreekt.length === 0) return { volledig: true };
  return {
    volledig: false,
    melding: vertaal("onvolledig_indienen", taal),
    ontbreekt,
  };
}

/**
 * T4P Business en alles wat het standaard-instrument gebruikt.
 *
 * De verbondenheidsvragen worden hier niet nagelopen: het schema van het
 * endpoint eist ze al alle vier als geheel getal, dus een inzending zonder die
 * vragen komt hier nooit aan.
 */
function ontbrekendStandaard(
  responses: Record<string, BlokAntwoord> | null | undefined,
): string[] {
  return ontbrekendeBlokken(verwachteBlokken(null), responses);
}

/**
 * T4Kids levert antwoorden onder de eigen item-sleutels aan: elk interessepaar
 * krijgt een kant ("most"), elke stelling een waarde ("blockEnergy"), en de
 * galerij levert een top drie.
 */
function ontbrekendT4Kids(
  responses: Record<string, BlokAntwoord> | null | undefined,
  keuzes: { archetypen?: unknown[]; top3?: unknown[] } | null | undefined,
): string[] {
  const gegeven = responses ?? {};
  const uit: string[] = [];
  for (const paar of T4KIDS_INTERESSE_PAREN) {
    const a = gegeven[paar.id];
    if (!a || typeof a.most !== "string" || a.most.trim() === "") uit.push(paar.id);
  }
  for (const stelling of T4KIDS_STELLINGEN) {
    const a = gegeven[stelling.id];
    if (!a || typeof a.blockEnergy !== "number" || !Number.isFinite(a.blockEnergy)) {
      uit.push(stelling.id);
    }
  }
  const top3 = Array.isArray(keuzes?.top3) ? keuzes!.top3! : [];
  if (top3.length !== T4KIDS_ARCHETYPE_TOP_N) uit.push("top3");
  return uit;
}
