/**
 * FIX 6 - Encryptie at rest (AVG art. 32).
 *
 * Centrale hook voor databank-encryptie at rest. Bewust conservatief: past enkel
 * een SQLCipher-compatibele `PRAGMA key` toe WANNEER de omgeving een sleutel levert
 * (`TAPAS_DB_SLEUTEL`). Zonder sleutel is dit een no-op, zodat de bestaande
 * (niet-versleutelde) demo-databank blijft werken.
 *
 * Volledige omschakeling naar een versleutelde databank staat beschreven in
 * docs/GDPR-FIX6-encryptie-at-rest.md (Optie A: managed Postgres, of Optie B:
 * better-sqlite3-multiple-ciphers). Deze hook maakt Optie B een kwestie van de
 * driver vervangen en pasEncryptieToe(db) op elke handle aanroepen.
 *
 * BELANGRIJK: de standaard better-sqlite3-driver negeert `PRAGMA key`. De hook
 * heeft pas effect met de cipher-driver (better-sqlite3-multiple-ciphers). We
 * roepen de pragma daarom defensief aan binnen een try/catch, zodat het onder de
 * huidige driver nooit crasht.
 */
export function pasEncryptieToe(db: { pragma?: (s: string) => unknown }): void {
  const sleutel = (process.env.TAPAS_DB_SLEUTEL ?? "").trim();
  if (!sleutel) return; // Geen sleutel gezet -> no-op (huidige demo).
  if (typeof db.pragma !== "function") return;
  try {
    // SQLCipher-compatibele sleuteltoepassing. Enkelvoudige aanhalingstekens in de
    // sleutel worden ontdubbeld om SQL-injectie in de pragma te vermijden.
    const veilig = sleutel.replace(/'/g, "''");
    db.pragma(`key='${veilig}'`);
  } catch {
    // Onder de standaard better-sqlite3-driver bestaat PRAGMA key niet; stil.
  }
}

/** True wanneer een databank-sleutel geconfigureerd is (voor status/rapportage). */
export function isEncryptieGeconfigureerd(): boolean {
  return (process.env.TAPAS_DB_SLEUTEL ?? "").trim().length > 0;
}
