// =============================================================================
// server/bewaartermijn-job.ts - Automatische anonimisering na de bewaartermijn
//
// Wettelijk kader: AVG art. 5.1.e (opslagbeperking) en art. 25 (privacy by
// design). Persoonsgegevens mogen niet langer bewaard worden dan nodig voor het
// doel. Tot nu toe werden verstreken afnames alleen GETELD op het GDPR-overzicht;
// wissen bleef een handmatige actie en gebeurde in de praktijk dus niet.
//
// Deze taak anonimiseert elke afname waarvan `bewaartotDatum` verstreken is en
// die nog niet geanonimiseerd is. Ze volgt hetzelfde patroon als
// server/credit-recovery.ts: eerste run kort na serverstart, daarna periodiek.
//
// Eigenschappen:
//   - Idempotent: anonimiseerAfname geeft een reeds geanonimiseerde rij
//     onveranderd terug, dus dubbel draaien is onschadelijk.
//   - Faalt zacht: een fout op één afname stopt de rest niet en laat de server
//     niet crashen.
//   - Logbaar: elke geanonimiseerde afname en elke fout wordt gelogd, en de
//     reden "bewaartermijn verstreken - automatisch" komt in consentScope
//     terecht zodat het verwerkingsregister aantoonbaar klopt.
// =============================================================================

import { storage, sqlite } from "./storage";
import { schrijfAuditLog } from "./audit-log";
import { ruimVerstrekenIntakesOp } from "./prive-aankoop/bewaartermijn";

export const ANONIMISERINGSREDEN = "bewaartermijn verstreken - automatisch";

// Interval in uren, instelbaar via env. Standaard dagelijks: vaak genoeg om de
// bewaartermijn scherp te houden, rustig genoeg voor een kleine SQLite-database.
const STANDAARD_INTERVAL_UREN = 24;

export function bewaartermijnIntervalUren(): number {
  const ruw = process.env.TAPAS_BEWAARTERMIJN_INTERVAL_UREN;
  if (!ruw) return STANDAARD_INTERVAL_UREN;
  const uren = Number(ruw);
  // Onbruikbare of extreme waarden negeren we bewust in plaats van ze te
  // volgen: een verkeerd gezette env-variabele mag de opslagbeperking niet
  // stilzwijgend uitschakelen.
  if (!Number.isFinite(uren) || uren < 1 || uren > 24 * 30) {
    console.warn(
      `[bewaartermijn] Onbruikbare TAPAS_BEWAARTERMIJN_INTERVAL_UREN="${ruw}", ` +
        `val terug op ${STANDAARD_INTERVAL_UREN}u.`,
    );
    return STANDAARD_INTERVAL_UREN;
  }
  return uren;
}

// De ids van afnames waarvan de bewaartermijn verstreken is en die nog niet
// geanonimiseerd zijn. Datumvergelijking op ISO-strings is hier veilig omdat
// bewaartotDatum altijd als ISO-timestamp wordt opgeslagen.
export function verstrekenAfnameIds(nu = new Date()): number[] {
  const grens = nu.toISOString();
  const rijen = sqlite
    .prepare(
      `SELECT id FROM afnames
        WHERE bewaartot_datum IS NOT NULL
          AND bewaartot_datum < ?
          AND geanonimiseerd_at IS NULL
        ORDER BY id`,
    )
    .all(grens) as Array<{ id: number }>;
  return rijen.map((r) => r.id);
}

// Voert de opruiming eenmalig uit. Geeft het aantal geanonimiseerde afnames
// terug zodat een test of een handmatige run het resultaat kan nakijken.
export async function voerBewaartermijnOpruimingUit(): Promise<number> {
  let ids: number[];
  try {
    ids = verstrekenAfnameIds();
  } catch (err) {
    console.error("[bewaartermijn] Kon verstreken afnames niet opzoeken:", err);
    return 0;
  }
  // De intakes van particuliere aankopen vallen onder dezelfde opslagbeperking
  // en worden in dezelfde ronde opgeruimd, ook wanneer er geen enkele afname
  // verstreken is.
  try {
    ruimVerstrekenIntakesOp();
  } catch (err) {
    console.error("[bewaartermijn] Opruiming van de aankoop-intakes mislukt:", err);
  }

  if (ids.length === 0) {
    console.log("[bewaartermijn] Geen verstreken afnames gevonden.");
    return 0;
  }

  let geanonimiseerd = 0;
  for (const id of ids) {
    try {
      const resultaat = await storage.anonimiseerAfname(id, ANONIMISERINGSREDEN);
      if (!resultaat) continue;
      geanonimiseerd++;
      // Aantoonbaarheid (AVG art. 5.2): de automatische wissing wordt met
      // adminId null gelogd, want er zit geen mens achter deze actie.
      schrijfAuditLog({ adminId: null, actie: "auto_anonimisering", afnameId: id, detail: ANONIMISERINGSREDEN });
      console.log(`[bewaartermijn] Afname #${id} geanonimiseerd (bewaartermijn verstreken).`);
    } catch (err) {
      console.error(`[bewaartermijn] Fout bij afname #${id}:`, err);
    }
  }

  console.log(`[bewaartermijn] Klaar - ${geanonimiseerd} van ${ids.length} afname(s) geanonimiseerd.`);
  return geanonimiseerd;
}

// Start de periodieke taak. Zelfde opzet als startCreditRecoveryJob.
export function startBewaartermijnJob(): void {
  const intervalUren = bewaartermijnIntervalUren();

  setTimeout(() => {
    console.log("[bewaartermijn] Eerste run bij serverstart.");
    void voerBewaartermijnOpruimingUit();
  }, 10_000);

  setInterval(
    () => {
      console.log(`[bewaartermijn] Periodieke run (elke ${intervalUren}u).`);
      void voerBewaartermijnOpruimingUit();
    },
    intervalUren * 60 * 60 * 1000,
  );
}
