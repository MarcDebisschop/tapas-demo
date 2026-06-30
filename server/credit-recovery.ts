// =============================================================================
// credit-recovery.ts — Automatische credit-vrijgave bij verlopen afnames
//
// Aangemaakt: 2026-06-30 (Fase 2, item 1.6)
//
// Probleem: als een deelnemer de browser sluit halverwege een afname blijft
// een credit hangen in status "gereserveerd". Die credit komt nooit meer vrij
// tenzij de beheerder handmatig ingrijpt.
//
// Oplossing: bij elke serverstart + elke 6 uur worden afnames in status
// 'uitgenodigd' | 'consent' | 'deel1' | 'deel2' die ouder zijn dan
// VERLOPEN_UREN vrijgegeven (gereserveerd → beschikbaar).
//
// Enkel afnames MET een organisatieId worden vrijgegeven — legacy afnames
// zonder credit-koppeling worden overgeslagen.
// =============================================================================

import { sqlite } from "./storage";

// Een afname die langer dan dit aantal uren niet voltooid werd, beschouwen
// we als verlopen. Ruim gekozen zodat langlopende schoolsessies niet vroegtijdig
// worden vrijgegeven.
const VERLOPEN_UREN = 72;

interface VerlatenAfname {
  id: number;
  organisatie_id: number;
  status: string;
  created_at: string;
}

/**
 * Voert de credit-recovery eenmalig uit.
 * Geeft alle verlopen niet-voltooide afnames vrij en logt het resultaat.
 */
export function voerCreditRecoveryUit(): void {
  const grens = new Date(Date.now() - VERLOPEN_UREN * 60 * 60 * 1000).toISOString();

  // Zoek verlaten afnames: niet voltooid, heeft een organisatieId (dus een credit),
  // en aangemaakt vóór de grenstijd.
  const verlatenAfnames: VerlatenAfname[] = sqlite
    .prepare(
      `SELECT id, organisatie_id, status, created_at
       FROM afnames
       WHERE status IN ('uitgenodigd', 'consent', 'deel1', 'deel2')
         AND organisatie_id IS NOT NULL
         AND created_at < ?`
    )
    .all(grens) as VerlatenAfname[];

  if (verlatenAfnames.length === 0) {
    console.log("[credit-recovery] Geen verlaten afnames gevonden — niets te doen.");
    return;
  }

  console.log(`[credit-recovery] ${verlatenAfnames.length} verlaten afname(s) gevonden — vrijgave starten.`);

  let vrijgegeven = 0;
  let overgeslagen = 0;

  for (const afname of verlatenAfnames) {
    try {
      // Controleer of er daadwerkelijk een reservering is voor deze afname
      const saldo = sqlite
        .prepare(
          `SELECT gereserveerd FROM credit_saldi WHERE organisatie_id = ?`
        )
        .get(afname.organisatie_id) as { gereserveerd: number } | undefined;

      if (!saldo || saldo.gereserveerd < 1) {
        // Geen gereserveerd credit — ofwel al vrijgegeven, ofwel nooit gereserveerd
        overgeslagen++;
        continue;
      }

      // Vrijgave: gereserveerd → beschikbaar (atomaire UPDATE)
      sqlite
        .prepare(
          `UPDATE credit_saldi
           SET gereserveerd  = gereserveerd - 1,
               beschikbaar   = beschikbaar  + 1,
               updated_at    = ?
           WHERE organisatie_id = ?
             AND gereserveerd   > 0`
        )
        .run(new Date().toISOString(), afname.organisatie_id);

      // Boek een grootboekregel voor de audit trail
      sqlite
        .prepare(
          `INSERT INTO credit_transacties
             (organisatie_id, type, aantal, afname_id, omschrijving, created_at)
           VALUES (?, 'vrijgave', 1, ?, ?, ?)`
        )
        .run(
          afname.organisatie_id,
          afname.id,
          `Auto-vrijgave verlopen afname #${afname.id} (status: ${afname.status}, ouder dan ${VERLOPEN_UREN}u)`,
          new Date().toISOString()
        );

      // Markeer de afname als 'verlaten' zodat ze niet opnieuw wordt opgepikt
      sqlite
        .prepare(`UPDATE afnames SET status = 'verlaten' WHERE id = ?`)
        .run(afname.id);

      vrijgegeven++;
      console.log(`[credit-recovery] Afname #${afname.id} (org ${afname.organisatie_id}) vrijgegeven.`);
    } catch (err) {
      console.error(`[credit-recovery] Fout bij afname #${afname.id}:`, err);
    }
  }

  console.log(
    `[credit-recovery] Klaar — ${vrijgegeven} vrijgegeven, ${overgeslagen} overgeslagen (geen reservering).`
  );
}

/**
 * Start de periodieke credit-recovery job.
 * Voert onmiddellijk een eerste run uit en daarna elke INTERVAL_MS milliseconden.
 */
export function startCreditRecoveryJob(intervalUren = 6): void {
  // Eerste run bij serverstart (na 5 seconden — DB volledig geïnitialiseerd)
  setTimeout(() => {
    console.log("[credit-recovery] Eerste run bij serverstart.");
    voerCreditRecoveryUit();
  }, 5_000);

  // Periodieke run
  const intervalMs = intervalUren * 60 * 60 * 1000;
  setInterval(() => {
    console.log(`[credit-recovery] Periodieke run (elke ${intervalUren}u).`);
    voerCreditRecoveryUit();
  }, intervalMs);
}
