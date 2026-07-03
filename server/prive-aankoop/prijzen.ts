/**
 * server/prive-aankoop/prijzen.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
 *
 * Admin-beheerbare prijzen-store voor privé-aankopen (particulieren).
 * Eigen, lichte SQLite-tabel (CREATE TABLE IF NOT EXISTS) — raakt shared/schema.ts
 * NIET aan. Alle bedragen in eurocent, INCL. btw (particulier ziet bruto-prijs).
 *
 * Patroon (raw SQLite) volgt server/storage.ts (sqlite.exec + prepare).
 */

import { sqlite } from "../storage";

export interface PriveePrijs {
  instrument_id: string;
  naam: string;
  bedrag_incl_btw_cent: number;
  actief: number; // 0 | 1
  bijgewerkt_op: string; // ISO
}

// Testprijzen (incl. btw) in eurocent — idempotente seed.
const SEED: Array<{ id: string; naam: string; cent: number }> = [
  { id: "twominscan", naam: "2MinScan", cent: 4500 },
  { id: "t4p-business", naam: "T4P Business", cent: 18500 },
  { id: "t4teens", naam: "T4Teens", cent: 6500 },
  { id: "t4students", naam: "T4Students", cent: 9500 },
];

let geinitialiseerd = false;

/** Maakt de tabel aan (indien nodig) en seedt de testprijzen idempotent. */
export function initPriveePrijzen(): void {
  if (geinitialiseerd) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prive_prijzen (
      instrument_id        TEXT PRIMARY KEY,
      naam                 TEXT NOT NULL,
      bedrag_incl_btw_cent INTEGER NOT NULL,
      actief               INTEGER NOT NULL DEFAULT 1,
      bijgewerkt_op        TEXT NOT NULL
    );
  `);
  const now = new Date().toISOString();
  const insert = sqlite.prepare(
    `INSERT OR IGNORE INTO prive_prijzen
       (instrument_id, naam, bedrag_incl_btw_cent, actief, bijgewerkt_op)
     VALUES (?, ?, ?, 1, ?)`,
  );
  for (const s of SEED) insert.run(s.id, s.naam, s.cent, now);
  geinitialiseerd = true;
}

/** Alle prijzen (admin). */
export function lijstAllePrijzen(): PriveePrijs[] {
  initPriveePrijzen();
  return sqlite
    .prepare(
      `SELECT instrument_id, naam, bedrag_incl_btw_cent, actief, bijgewerkt_op
         FROM prive_prijzen ORDER BY instrument_id`,
    )
    .all() as PriveePrijs[];
}

/** Enkel actieve prijzen (publieke koop-pagina). */
export function lijstActievePrijzen(): PriveePrijs[] {
  initPriveePrijzen();
  return sqlite
    .prepare(
      `SELECT instrument_id, naam, bedrag_incl_btw_cent, actief, bijgewerkt_op
         FROM prive_prijzen WHERE actief = 1 ORDER BY instrument_id`,
    )
    .all() as PriveePrijs[];
}

/** Eén prijs op id. */
export function getPrijs(instrumentId: string): PriveePrijs | undefined {
  initPriveePrijzen();
  return sqlite
    .prepare(
      `SELECT instrument_id, naam, bedrag_incl_btw_cent, actief, bijgewerkt_op
         FROM prive_prijzen WHERE instrument_id = ?`,
    )
    .get(instrumentId) as PriveePrijs | undefined;
}

/** Wijzig bedrag en/of actief-status. Retourneert de bijgewerkte rij. */
export function wijzigPrijs(
  instrumentId: string,
  patch: { bedrag_incl_btw_cent?: number; actief?: number },
): PriveePrijs | undefined {
  initPriveePrijzen();
  const bestaand = getPrijs(instrumentId);
  if (!bestaand) return undefined;
  const bedrag =
    patch.bedrag_incl_btw_cent != null
      ? patch.bedrag_incl_btw_cent
      : bestaand.bedrag_incl_btw_cent;
  const actief =
    patch.actief != null ? (patch.actief ? 1 : 0) : bestaand.actief;
  sqlite
    .prepare(
      `UPDATE prive_prijzen
         SET bedrag_incl_btw_cent = ?, actief = ?, bijgewerkt_op = ?
         WHERE instrument_id = ?`,
    )
    .run(bedrag, actief, new Date().toISOString(), instrumentId);
  return getPrijs(instrumentId);
}
