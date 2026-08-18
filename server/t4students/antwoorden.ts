// ---------------------------------------------------------------------------
// server/t4students/antwoorden.ts
//
// De ene plaats die weet hoe een T4Students-antwoordenblad eruit hoort te zien.
//
// WAAROM DIT BESTAAT
// Het studiekompas bewaart zijn antwoorden per item-id (P0, I1, BE1, D1, ...)
// in de vorm die de scoringsmotor leest: recognition, energy, interest, choice,
// value of text. Het invulscherm van het T4P Business Kompas bewaart antwoorden
// per blok (B0, B1, ...) in een heel andere vorm. Zolang die twee vormen
// nergens tegen elkaar gehouden werden, kon een afname met blokantwoorden
// ongehinderd afgerond worden en scoorde de motor daarna nul items: het rapport
// kwam er dan uit met louter nulwaarden. Deze module maakt dat structureel
// onmogelijk. Zij levert:
//
//   itemsVanInstrument()   de vlakke itemlijst uit het instrument
//   verwachtVeld()         welk veld een item verwacht, per itemsoort
//   ontbrekendeItems()     welke items nog geen bruikbaar antwoord hebben
//   naarT4SAntwoorden()    ruwe invoer omzetten naar de vorm van de motor
//
// De inleverroute weigert een onvolledige inzending met ontbrekendeItems(), en
// de rapportketen leest dezelfde lijst. Een antwoordenblad in de verkeerde vorm
// heeft daardoor geen enkele weg meer naar een rapport.
// ---------------------------------------------------------------------------

import { T4STUDENTS_INSTRUMENT, OPEN_INTRO_ITEMTYPE } from "./instrument";
import type { T4SInstrument, T4SItem } from "./instrument";
import type { T4SAntwoord, T4SAntwoorden } from "./kompas-scoring";

/** Welk veld van een antwoord een itemsoort vult. */
export type T4SVeld = "recognition" | "energy" | "interest" | "choice" | "value" | "text";

/** De vlakke itemlijst van het instrument, in afnamevolgorde. */
export function itemsVanInstrument(instrument: T4SInstrument = T4STUDENTS_INSTRUMENT): T4SItem[] {
  const uit: T4SItem[] = [];
  for (const sectie of instrument.sections ?? []) {
    for (const item of sectie.items ?? []) uit.push(item);
  }
  return uit;
}

/**
 * Welke velden dit item verwacht. Een leeg antwoord (geen enkel veld) betekent
 * dat het item geen score voedt en dus ook niet verplicht is.
 */
export function verwachtVeld(item: T4SItem, keuzeVanP1?: string | null): T4SVeld[] {
  const soort = itemSoort(item, keuzeVanP1);
  switch (soort) {
    case OPEN_INTRO_ITEMTYPE:
      return ["text"];
    case "battery":
    case "profile-scale":
      return ["value"];
    case "recognition+energy":
      return ["recognition", "energy"];
    case "recognition":
      return ["recognition"];
    case "interest":
      return ["interest"];
    case "sjt":
    case "profile-select":
    case "profile-choice":
    case "context-choice":
    case "meaning":
      return ["choice"];
    default:
      return [];
  }
}

/**
 * De itemsoort. Bij P2 hangt die af van het antwoord op P1: elk van de drie
 * profielen (nog kiezen, vastgelopen, master) stelt een andere vraag.
 */
export function itemSoort(item: T4SItem, keuzeVanP1?: string | null): string {
  if (item.variants) {
    const sleutel = typeof keuzeVanP1 === "string" ? keuzeVanP1 : "";
    const variant = item.variants[sleutel];
    return variant?.itemType ?? "";
  }
  return item.itemType ?? "";
}

/** Waar of het item bij deze P1-keuze gesteld wordt. */
export function itemWordtGesteld(item: T4SItem, keuzeVanP1?: string | null): boolean {
  if (!item.variants) return true;
  const sleutel = typeof keuzeVanP1 === "string" ? keuzeVanP1 : "";
  return Boolean(item.variants[sleutel]);
}

function heeftGetal(waarde: unknown): boolean {
  return typeof waarde === "number" && Number.isFinite(waarde);
}

function heeftTekst(waarde: unknown): boolean {
  return typeof waarde === "string" && waarde.trim().length > 0;
}

/**
 * Welke items nog geen bruikbaar antwoord hebben. De open beginvraag (P0) staat
 * hier nooit in: die is uitdrukkelijk niet verplicht (required: false in het
 * instrument) en telt in geen enkele score mee.
 */
export function ontbrekendeItems(
  antwoorden: T4SAntwoorden | null | undefined,
  instrument: T4SInstrument = T4STUDENTS_INSTRUMENT,
): string[] {
  const gegeven = antwoorden ?? {};
  const p1 = gegeven["P1"];
  const keuzeVanP1 = p1 && typeof p1.choice === "string" ? p1.choice : null;
  const uit: string[] = [];
  for (const item of itemsVanInstrument(instrument)) {
    if (item.itemType === OPEN_INTRO_ITEMTYPE) continue;
    if (item.required === false) continue;
    if (!itemWordtGesteld(item, keuzeVanP1)) continue;
    const velden = verwachtVeld(item, keuzeVanP1);
    if (velden.length === 0) continue;
    const antwoord = gegeven[item.id];
    if (!antwoord || typeof antwoord !== "object") {
      uit.push(item.id);
      continue;
    }
    const volledig = velden.every((veld) =>
      veld === "choice" || veld === "text"
        ? heeftTekst((antwoord as Record<string, unknown>)[veld])
        : heeftGetal((antwoord as Record<string, unknown>)[veld]),
    );
    if (!volledig) uit.push(item.id);
  }
  return uit;
}

/**
 * Zet ruwe invoer om naar de antwoordvorm van de scoringsmotor. Alleen de zes
 * bekende velden komen door; al de rest wordt weggelaten in plaats van
 * meegesleept. Sleutels die geen item van dit instrument zijn, vallen weg: zo
 * kan een antwoordenblad van een ander instrument hier niet binnendringen.
 */
export function naarT4SAntwoorden(
  ruw: unknown,
  instrument: T4SInstrument = T4STUDENTS_INSTRUMENT,
): T4SAntwoorden {
  const uit: T4SAntwoorden = {};
  if (!ruw || typeof ruw !== "object") return uit;
  const bron = ruw as Record<string, unknown>;
  const bekend = new Set(itemsVanInstrument(instrument).map((i) => i.id));
  for (const [sleutel, waarde] of Object.entries(bron)) {
    if (!bekend.has(sleutel)) continue;
    if (!waarde || typeof waarde !== "object") continue;
    const rij = waarde as Record<string, unknown>;
    const antwoord: T4SAntwoord = {};
    if (heeftGetal(rij.recognition)) antwoord.recognition = rij.recognition as number;
    if (heeftGetal(rij.energy)) antwoord.energy = rij.energy as number;
    if (heeftGetal(rij.interest)) antwoord.interest = rij.interest as number;
    if (heeftGetal(rij.value)) antwoord.value = rij.value as number;
    if (heeftTekst(rij.choice)) antwoord.choice = (rij.choice as string).trim();
    if (typeof rij.text === "string" && rij.text.trim().length > 0) antwoord.text = rij.text;
    if (Object.keys(antwoord).length > 0) uit[sleutel] = antwoord;
  }
  return uit;
}

/**
 * Hoeveel items er bij een leeg antwoordenblad ontbreken. Dat zijn alle
 * verplichte items behalve P2: die vraag wordt pas gesteld zodra P1 beantwoord
 * is, en hangt dan af van welk profiel gekozen werd.
 */
export function aantalVerplichteItems(
  instrument: T4SInstrument = T4STUDENTS_INSTRUMENT,
): number {
  return ontbrekendeItems({}, instrument).length;
}
