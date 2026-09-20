import type { Response } from "express";
import { hddStorage } from "./storage";
import type { HddBoardLid } from "./schema";

/**
 * De rapportsluis van Human Due Diligence.
 * ---------------------------------------------------------------------------
 * Wie als lid van een board een traject invult, mag zijn eigen rapport niet
 * zelf openen of downloaden. Een Human Due Diligence is geen persoonlijke
 * coaching maar een doorlichting in opdracht: de begeleider leest de uitkomsten
 * eerst, bespreekt ze, en geeft daarna per lid vrij. Tot die vrijgave staat de
 * sluis dicht.
 *
 * Waarom dit een eigen bestand is en geen regel in een route: het lek zat niet
 * op één plaats. Een lid kon via het eigen dashboard bij het Kompas, via zijn
 * Teamscan-link bij het individuele Teamscan-rapport, en via de 2MINSCAN bij
 * het energetische profiel. Drie ingangen, dus één poortwachter die ze alle drie
 * hetzelfde beoordeelt.
 *
 * De sleutel is het token. Elk lid heeft per instrument een token (zie
 * instrumentTokens in ./schema.ts), en dat token is precies wat elke ingang bij
 * zich heeft. Herkent de sluis het token niet, dan hoort het niet bij een
 * traject en verandert er niets: rapporten buiten een traject blijven gewoon
 * bereikbaar voor de deelnemer zelf.
 *
 * De begeleider en de opdrachtgever komen niet langs deze sluis. Zij lezen via
 * de routes achter de beheerderslogin (/api/rapporten/... en
 * /api/hdd/trajecten/:id/rapport), en daar staat vereisScope voor.
 */

export const CODE_RAPPORT_NIET_VRIJGEGEVEN = "RAPPORT_NIET_VRIJGEGEVEN";

export const MELDING_RAPPORT_NIET_VRIJGEGEVEN =
  "Uw antwoorden zijn aangekomen en er ging niets verloren. De rapporten van dit " +
  "traject gaan eerst naar de begeleider. De begeleider bespreekt de uitkomst met u " +
  "en geeft uw rapport daarna vrij. Zolang de begeleider uw rapport niet vrijgegeven " +
  "heeft, kunt u het niet openen en niet downloaden.";

/** Wat de sluis over één token zegt. */
export interface SluisUitspraak {
  /** Hoort dit token bij een lid van een traject? */
  vanTraject: boolean;
  /** Mag het lid zijn eigen rapport zien? Buiten een traject: altijd waar. */
  vrijgegeven: boolean;
  trajectId?: number;
  lidId?: number;
  instrumentId?: string;
}

const BUITEN_TRAJECT: SluisUitspraak = { vanTraject: false, vrijgegeven: true };

/** Eén regel in de tokenindex. */
export interface SluisRegel {
  trajectId: number;
  lidId: number;
  instrumentId: string;
  vrijgegeven: boolean;
}

function schoon(token: unknown): string {
  return typeof token === "string" ? token.trim() : "";
}

/**
 * Bouwt de index van token naar lid uit een lijst leden.
 *
 * Pure functie, zodat de regel zonder databank te testen valt.
 */
export function bouwSluisIndex(leden: HddBoardLid[]): Map<string, SluisRegel> {
  const index = new Map<string, SluisRegel>();
  for (const lid of leden) {
    let tokens: Record<string, unknown> = {};
    try {
      tokens = JSON.parse(lid.instrumentTokens || "{}") ?? {};
    } catch {
      tokens = {};
    }
    const vrijgegeven = Boolean(lid.rapportVrijgaveOp);
    for (const [instrumentId, waarde] of Object.entries(tokens)) {
      const token = schoon(waarde);
      if (!token) continue;
      index.set(token, {
        trajectId: lid.trajectId,
        lidId: lid.id,
        instrumentId,
        vrijgegeven,
      });
    }
  }
  return index;
}

/** Leest de index bij de trajectopslag. */
export function leesSluisIndex(): Map<string, SluisRegel> {
  try {
    return bouwSluisIndex(hddStorage.alleLeden());
  } catch {
    // Staat de trajecttabel er nog niet, dan is er ook geen traject en dus geen
    // sluis. Een leesfout mag geen enkele rapportroute onderuit halen.
    return new Map();
  }
}

/** Beoordeelt één token tegen een index. */
export function beoordeelToken(
  token: unknown,
  index: Map<string, SluisRegel>,
): SluisUitspraak {
  const sleutel = schoon(token);
  if (!sleutel) return BUITEN_TRAJECT;
  const regel = index.get(sleutel);
  if (!regel) return BUITEN_TRAJECT;
  return {
    vanTraject: true,
    vrijgegeven: regel.vrijgegeven,
    trajectId: regel.trajectId,
    lidId: regel.lidId,
    instrumentId: regel.instrumentId,
  };
}

/** Dezelfde beoordeling, maar met de index uit de opslag. */
export function beoordeelTokenLive(token: unknown): SluisUitspraak {
  return beoordeelToken(token, leesSluisIndex());
}

/**
 * De korte vraag die elke route stelt: houdt de sluis dit tegen?
 *
 * Waar staat de sluis dicht: het token hoort bij een lid van een traject en de
 * begeleider heeft nog niet vrijgegeven.
 */
export function rapportGesloten(
  token: unknown,
  index?: Map<string, SluisRegel>,
): boolean {
  const uitspraak = beoordeelToken(token, index ?? leesSluisIndex());
  return uitspraak.vanTraject && !uitspraak.vrijgegeven;
}

/** Weigert een aanvraag aan de sluis. Eén antwoordvorm voor alle ingangen. */
export function sluisWeigering(res: Response): Response {
  return res.status(403).json({
    error: MELDING_RAPPORT_NIET_VRIJGEGEVEN,
    code: CODE_RAPPORT_NIET_VRIJGEGEVEN,
  });
}

/**
 * Meerdere tokens tegelijk: geeft de tokens terug die de sluis tegenhoudt.
 * Het deelnemersdashboard gebruikt dit om de rapporten van een traject niet als
 * link te tonen.
 */
export function geslotenTokens(
  tokens: Array<string | null | undefined>,
  index?: Map<string, SluisRegel>,
): Set<string> {
  const gebruikt = index ?? leesSluisIndex();
  const uit = new Set<string>();
  for (const token of tokens) {
    const sleutel = schoon(token);
    if (sleutel && rapportGesloten(sleutel, gebruikt)) uit.add(sleutel);
  }
  return uit;
}
