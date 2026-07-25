// =============================================================================
// server/instrument-backfill.ts - afnames.instrument_id aanvullen voor
// bestaande rijen die de kolom nog leeg hebben.
//
// Aanleiding: de kolom werd bij aanmaak niet altijd gevuld, waardoor de
// opvolging per instrument oudere afnames onder "Onbekend / niet-gekoppeld"
// toont. De aanmaakpaden vullen de kolom nu wel; deze module haalt de
// achterstand in voor wat er al in de databank staat.
//
// ENIGE TOEGELATEN BRON: het bevroren generatorContract van de afname zelf.
// Dat contract wordt server-side opgebouwd op het moment van voltooien en
// bevat het instrumentId dat toen effectief gebruikt is. Er wordt niets
// afgeleid uit de naam, de respondentCode of de consentScope: dat zouden
// gissingen zijn.
//
// Bovendien wordt een waarde enkel overgenomen als ze EXACT overeenkomt met
// een instrument dat vandaag in het register staat. Oudere contracten dragen
// soms een historische variantnaam (bijvoorbeeld "t4p-teens-kompas") die geen
// geregistreerd instrument is. Zulke rijen blijven bewust NULL en dus zichtbaar
// als "Onbekend": liever een eerlijk gat dan een verzonnen instrument.
//
// De backfill is idempotent: ze raakt enkel rijen aan waar instrument_id NULL
// is, dus een tweede uitvoering doet niets meer.
// =============================================================================

import { sqlite } from "./storage";
import { alleInstrumenten } from "./registry";

export interface BackfillRij {
  id: number;
  generatorContract: string | null;
}

export interface BackfillResultaat {
  bekeken: number;
  ingevuld: number;
  overgeslagen: number;
}

/**
 * Leidt het instrument af uit het bevroren generatorContract van één afname.
 * Geeft null wanneer er geen contract is, het contract onleesbaar is, er geen
 * instrumentId in staat, of het instrumentId niet (meer) geregistreerd is.
 */
export function leidInstrumentAfUitContract(
  generatorContract: string | null,
  isGeregistreerd: (instrumentId: string) => boolean,
): string | null {
  if (!generatorContract) return null;
  let ontleed: unknown;
  try {
    ontleed = JSON.parse(generatorContract);
  } catch {
    return null;
  }
  if (!ontleed || typeof ontleed !== "object") return null;
  const ruw = (ontleed as { instrumentId?: unknown }).instrumentId;
  if (typeof ruw !== "string") return null;
  const id = ruw.trim();
  if (!id || !isGeregistreerd(id)) return null;
  return id;
}

// Minimale vorm van de sqlite-handle die deze module nodig heeft.
interface SqliteAchtig {
  prepare(sql: string): {
    all(...params: any[]): any[];
    run(...params: any[]): unknown;
  };
}

/**
 * Vult instrument_id aan voor alle afnames waar de kolom nog NULL is en het
 * instrument betrouwbaar uit het contract volgt. Rijen zonder betrouwbaar
 * signaal blijven ongemoeid.
 */
export function backfillInstrumentIds(
  sq: SqliteAchtig,
  isGeregistreerd: (instrumentId: string) => boolean,
): BackfillResultaat {
  const rijen = sq
    .prepare(
      `SELECT id, generator_contract FROM afnames WHERE instrument_id IS NULL`,
    )
    .all() as Array<{ id: number; generator_contract: string | null }>;

  const zet = sq.prepare(`UPDATE afnames SET instrument_id = ? WHERE id = ? AND instrument_id IS NULL`);

  let ingevuld = 0;
  for (const rij of rijen) {
    const instrumentId = leidInstrumentAfUitContract(rij.generator_contract, isGeregistreerd);
    if (!instrumentId) continue;
    zet.run(instrumentId, rij.id);
    ingevuld++;
  }

  return { bekeken: rijen.length, ingevuld, overgeslagen: rijen.length - ingevuld };
}

/**
 * Eenmalige uitvoering bij het opstarten van de server. Faalt nooit hard: een
 * mislukte backfill mag het opstarten niet blokkeren, want de afnames blijven
 * dan gewoon onder "Onbekend" staan.
 */
export function startInstrumentBackfill(): void {
  try {
    const geregistreerd = new Set(alleInstrumenten().map((d) => d.instrumentId));
    const res = backfillInstrumentIds(sqlite as any, (id) => geregistreerd.has(id));
    if (res.bekeken > 0) {
      console.log(
        `[instrument-backfill] ${res.ingevuld} van ${res.bekeken} afnames zonder instrument aangevuld; ` +
          `${res.overgeslagen} blijven onbekend (geen betrouwbaar signaal).`,
      );
    }
  } catch (e) {
    console.error("[instrument-backfill] overgeslagen:", e);
  }
}
