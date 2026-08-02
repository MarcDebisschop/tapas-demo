// ---------------------------------------------------------------------------
// shared/verplicht-antwoorden.ts
//
// Eén bron voor de vraag "is deze vraag beantwoord?". Gedeeld door het
// invulscherm (dat de knop "verder" dichthoudt) en de server (die een
// onvolledige inzending weigert). Zo kan de browserkant en de serverkant nooit
// uit elkaar lopen.
//
// De regel van de opdrachtgever: een construct krijgt pas een score of een
// label als al zijn antwoorden er zijn. Dat werkt alleen als het invullen zelf
// geen gaten meer kan opleveren.
//
// Deze module beslist NIET welke vragen verplicht zijn. Ze zegt enkel of een
// gegeven antwoord er is. Welke vragen bewust vrijblijvend blijven, staat bij
// het scherm zelf en in het verslag.
// ---------------------------------------------------------------------------

/** Eén blok-antwoord uit een keuzeschaal-/forced-choice-vragenlijst. */
export interface BlokAntwoord {
  most?: string | null;
  least?: string | null;
  itemEnergy?: { most?: number | null; least?: number | null } | null;
  blockEnergy?: number | null;
}

/** De vorm van een blok zoals het invulscherm het krijgt. */
export interface BlokVorm {
  stateKey: string;
  energyMode: "item" | "block" | string;
  items?: unknown[];
}

/**
 * Is een schaalantwoord gegeven? Een schuifregelaar of energieknop telt pas als
 * beantwoord wanneer er werkelijk een waarde staat. Nul is een geldig antwoord;
 * "niets aangeraakt" is dat niet.
 */
export function schaalAntwoordGegeven(waarde: number | null | undefined): boolean {
  return typeof waarde === "number" && Number.isFinite(waarde);
}

/** Is een keuze uit een lijst gemaakt? Lege tekst telt niet als keuze. */
export function keuzeGemaakt(waarde: string | null | undefined): boolean {
  return typeof waarde === "string" && waarde.trim() !== "";
}

/**
 * Draagt dit blok één uitspraak in plaats van een keuze tussen uitspraken?
 *
 * Twee blokvormen komen voor. Een keuzeblok legt meerdere uitspraken naast
 * elkaar en vraagt welke het meest en welke het minst past; dat is de vorm van
 * T4P Business. Een waarderingsblok draagt één uitspraak en vraagt hoe sterk
 * die past; dat is de vorm van T4Teens. Bij één uitspraak valt er niets te
 * rangschikken, dus een meest- en minst-keuze zijn daar niet te maken.
 *
 * Een blok zonder itemlijst wordt als keuzeblok behandeld: dat is de vorm die
 * er altijd al was, en de oude regel blijft dan gelden.
 */
export function isWaarderingsblok(blok: Pick<BlokVorm, "items">): boolean {
  return Array.isArray(blok.items) && blok.items.length < 2;
}

/**
 * Is dit blok volledig beantwoord?
 *
 * Een keuzeblok vraagt drie dingen: welk item past het meest, welk item past
 * het minst, en hoeveel energie het kost of geeft. Bij energyMode "block" is
 * dat één energiewaarde voor het hele blok, bij "item" een waarde voor de
 * meest- en voor de minst-keuze.
 *
 * Een waarderingsblok vraagt één ding: de waardering van zijn enige uitspraak.
 */
export function blokAntwoordVolledig(
  blok: Pick<BlokVorm, "energyMode" | "items">,
  antwoord: BlokAntwoord | undefined | null,
): boolean {
  if (!antwoord) return false;
  if (isWaarderingsblok(blok)) return schaalAntwoordGegeven(antwoord.blockEnergy);
  if (!keuzeGemaakt(antwoord.most) || !keuzeGemaakt(antwoord.least)) return false;
  if (blok.energyMode === "block") {
    return schaalAntwoordGegeven(antwoord.blockEnergy);
  }
  return (
    schaalAntwoordGegeven(antwoord.itemEnergy?.most) &&
    schaalAntwoordGegeven(antwoord.itemEnergy?.least)
  );
}

/** Welke blokken zijn nog niet af? Geeft de stateKeys terug, in volgorde. */
export function ontbrekendeBlokken(
  blokken: BlokVorm[],
  antwoorden: Record<string, BlokAntwoord> | null | undefined,
): string[] {
  const gegeven = antwoorden ?? {};
  return blokken
    .filter((b) => !blokAntwoordVolledig(b, gegeven[b.stateKey]))
    .map((b) => b.stateKey);
}

/**
 * Welke schaalvragen (0 tot 10, verbondenheid) zijn nog niet beantwoord?
 * Een ontbrekende sleutel en een null tellen allebei als onbeantwoord.
 */
export function ontbrekendeSchaalvragen(
  vraagIds: string[],
  antwoorden: Record<string, number | null | undefined> | null | undefined,
): string[] {
  const gegeven = antwoorden ?? {};
  return vraagIds.filter((id) => !schaalAntwoordGegeven(gegeven[id]));
}

/** Welke van deze vragen hebben nog geen keuze uit een lijst gekregen? */
export function ontbrekendeKeuzevragen(
  vraagIds: string[],
  antwoorden: Record<string, string | null | undefined> | null | undefined,
): string[] {
  const gegeven = antwoorden ?? {};
  return vraagIds.filter((id) => !keuzeGemaakt(gegeven[id]));
}

/**
 * Is een ordenopdracht af? Elke te ordenen sleutel moet precies één rang
 * gekregen hebben, zonder dubbels.
 */
export function ordeningVolledig(
  sleutels: string[],
  volgorde: string[] | null | undefined,
): boolean {
  if (!volgorde || volgorde.length !== sleutels.length) return false;
  const gezien = new Set(volgorde);
  return gezien.size === sleutels.length && sleutels.every((s) => gezien.has(s));
}
