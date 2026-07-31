/**
 * FIX 6 - Encryptie at rest (AVG art. 32).
 *
 * Centrale hook voor databank-encryptie at rest. Bewust conservatief: past enkel
 * een SQLCipher-compatibele `PRAGMA key` toe WANNEER de omgeving een sleutel
 * levert (`TAPAS_DB_SLEUTEL`). Zonder sleutel is dit een no-op, zodat de
 * bestaande, niet-versleutelde demo-databank blijft werken.
 *
 * WAAROM DIT BESTAAND EN NIET GEWOON AANGEZET IS
 * ----------------------------------------------
 * De standaard `better-sqlite3`-driver NEGEERT `PRAGMA key` zonder te klagen.
 * Een pragma-aanroep die stil niets doet is de gevaarlijkste soort: het lijkt of
 * er versleuteld wordt terwijl het bestand in klaartekst op schijf staat.
 * Daarom meldt deze module bij het opstarten expliciet of encryptie-at-rest
 * ACTIEF is of als no-op draait; zie `logEncryptieStatus()`. Zonder die melding
 * is de productiestatus niet auditbaar en is "we hebben een hook" geen bewijs.
 *
 * ACTIVATIESTAPPEN (volledige uitleg in docs/GDPR-FIX6-encryptie-at-rest.md)
 * -------------------------------------------------------------------------
 * Optie A - managed Postgres (aanbevolen). De provider levert encryptie-at-rest;
 *   de drizzle-config schakelt van better-sqlite3 naar de Postgres-driver en
 *   deze module wordt overbodig. Sleutelbeheer ligt bij de provider.
 *
 * Optie B - versleutelde SQLite, als SQLite blijft:
 *   1. `npm i better-sqlite3-multiple-ciphers` (drop-in, zelfde API).
 *   2. Vervang de `better-sqlite3`-import in ELKE handle die `data.db` opent
 *      (zie `GEKENDE_HANDLES` hieronder) en roep daar `pasEncryptieToe(db, naam)`
 *      aan direct na het openen.
 *   3. Migreer het bestaande klaartekst-bestand eenmalig met
 *      `sqlcipher_export`. Zonder die migratie is de bestaande data onleesbaar.
 *   4. Zet `TAPAS_DB_SLEUTEL` als geheim in de hostingomgeving, nooit in git.
 *      Verlies van de sleutel is verlies van alle data, dus leg sleutelbeheer en
 *      roulatie vast VOOR je aanzet.
 *   5. Herstart en controleer de opstartregel: die moet ACTIEF melden met een
 *      cipher-versie. Meldt ze nog steeds no-op, dan is stap 2 onvolledig.
 *
 * AANZETTEN IN PRODUCTIE IS EEN PRODUCTIEBESLISSING en wordt hier bewust NIET
 * geforceerd. Deze module maakt de beslissing uitvoerbaar en de uitkomst
 * zichtbaar; ze neemt de beslissing niet.
 */

/**
 * Elke plaats die zelf `new Database(...)` op de databank doet. Bij Optie B moet
 * ELKE handle dezelfde sleutel toepassen; eén handle die het vergeet opent het
 * bestand zonder sleutel en faalt (of, erger, schrijft klaartekst).
 *
 * Feitelijk nagegaan met `grep -rn "new Database(" server` op 26-07-2026.
 * `server/repositories/db.ts` staat er NIET bij: dat bestand hergebruikt de
 * handle van storage.ts via een re-export en opent niets zelf.
 */
export const GEKENDE_HANDLES = [
  "server/storage.ts",
  "server/stm-storage.ts",
  "server/kwaliteit-storage.ts",
  "server/hdd/storage.ts",
  "server/t4r/storage.ts",
  "server/teamscan/storage.ts",
  "server/t4organizations/storage.ts",
  "server/t4sports/module-routes.ts",
] as const;

/** Minimale vorm die de hook van een databank-handle nodig heeft. */
export interface PragmaDb {
  pragma?: (s: string) => unknown;
}

/** Namen van de handles waarop de hook daadwerkelijk een sleutel toepaste. */
const toegepasteHandles = new Set<string>();
/** De cipher-versie zoals de driver ze rapporteerde, of null. */
let gemeteneCipherVersie: string | null = null;

/** De geconfigureerde sleutel, ontdaan van omringende witruimte. */
function sleutelUitOmgeving(): string {
  return (process.env.TAPAS_DB_SLEUTEL ?? "").trim();
}

/**
 * Vraagt de driver naar zijn cipher-versie. De standaard better-sqlite3 kent
 * `PRAGMA cipher_version` niet en geeft een lege lijst terug; enkel een
 * cipher-driver (better-sqlite3-multiple-ciphers / SQLCipher) antwoordt met een
 * versie. Dit is dus de enige betrouwbare manier om te weten of `PRAGMA key`
 * echt iets doet in plaats van stil genegeerd te worden.
 *
 * Geeft null bij afwezigheid, een lege uitkomst of een fout.
 */
export function cipherVersie(db: PragmaDb): string | null {
  if (typeof db.pragma !== "function") return null;
  try {
    const uit = db.pragma("cipher_version");
    if (uit == null) return null;
    if (Array.isArray(uit)) {
      if (uit.length === 0) return null;
      const eerste = uit[0] as unknown;
      if (typeof eerste === "string") return eerste.trim() || null;
      if (eerste && typeof eerste === "object") {
        const waarde = Object.values(eerste as Record<string, unknown>)[0];
        return typeof waarde === "string" ? waarde.trim() || null : null;
      }
      return null;
    }
    if (typeof uit === "string") return uit.trim() || null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Past de sleutel toe op één databank-handle. No-op zonder sleutel, zodat de
 * demo blijft werken.
 *
 * `naam` is enkel voor de statusmelding; laat ze weg en de handle wordt als
 * "onbenoemd" geteld.
 */
export function pasEncryptieToe(db: PragmaDb, naam?: string): void {
  const sleutel = sleutelUitOmgeving();
  if (!sleutel) return; // Geen sleutel gezet -> no-op (huidige demo).
  if (typeof db.pragma !== "function") return;

  // Eerst meten, dan pas de sleutel zetten. Andersom zou de meting de laatste
  // pragma-aanroep zijn, en de sleuteltoepassing moet de laatste blijven: de
  // driver verwacht `key` als eerste echte handeling op de verbinding.
  const versie = cipherVersie(db);
  if (versie) gemeteneCipherVersie = versie;

  try {
    // SQLCipher-compatibele sleuteltoepassing. Enkelvoudige aanhalingstekens in
    // de sleutel worden ontdubbeld om injectie in de pragma te vermijden.
    const veilig = sleutel.replace(/'/g, "''");
    db.pragma(`key='${veilig}'`);
    toegepasteHandles.add(naam ?? "onbenoemd");
  } catch {
    // Onder de standaard better-sqlite3-driver bestaat PRAGMA key niet; stil.
    // De opstartmelding maakt duidelijk dat er dan niets versleuteld is.
  }
}

/** True wanneer een databank-sleutel geconfigureerd is (voor status/rapportage). */
export function isEncryptieGeconfigureerd(): boolean {
  return sleutelUitOmgeving().length > 0;
}

export interface EncryptieStatus {
  /** Is `TAPAS_DB_SLEUTEL` gezet? */
  sleutelGezet: boolean;
  /** De cipher-versie van de driver, of null bij de standaarddriver. */
  cipherDriver: string | null;
  /** Enkel true als sleutel EN cipher-driver aanwezig zijn. */
  actief: boolean;
  /** Handles waarop de sleutel is toegepast, op moment van vragen. */
  handles: string[];
  /** Korte, leesbare reden achter `actief`. */
  reden: string;
}

/**
 * De status van encryptie-at-rest, bedoeld om te loggen en te rapporteren.
 *
 * `actief` is bewust streng: sleutel EN cipher-driver. Een sleutel zonder
 * cipher-driver is de valkuil van deze hele module, want dan lijkt alles in orde
 * terwijl de databank in klaartekst op schijf staat.
 *
 * Zonder sleutel wordt de driver NIET bevraagd. Dat is opzet: in de demo mag
 * deze module geen enkele pragma op de databank uitvoeren.
 */
export function encryptieStatus(): EncryptieStatus {
  const sleutelGezet = isEncryptieGeconfigureerd();
  // Array.from en geen spread: het tsconfig-doel laat het uitspreiden van een Set
  // niet toe en de baseline van 77 meldingen van de typecontrole mag niet stijgen.
  const handles = Array.from(toegepasteHandles).sort();
  if (!sleutelGezet) {
    return {
      sleutelGezet: false,
      cipherDriver: null,
      actief: false,
      handles,
      reden: "TAPAS_DB_SLEUTEL is niet gezet; de hook draait als no-op.",
    };
  }
  const cipherDriver = gemeteneCipherVersie;
  if (!cipherDriver) {
    return {
      sleutelGezet: true,
      cipherDriver: null,
      actief: false,
      handles,
      reden:
        "TAPAS_DB_SLEUTEL is gezet, maar de driver kent PRAGMA cipher_version niet. " +
        "De standaard better-sqlite3 negeert PRAGMA key: de databank staat in klaartekst op schijf. " +
        "Zie stap 1 en 2 van Optie B in docs/GDPR-FIX6-encryptie-at-rest.md.",
    };
  }
  const volledig = handles.length >= GEKENDE_HANDLES.length;
  return {
    sleutelGezet: true,
    cipherDriver,
    actief: true,
    handles,
    reden: volledig
      ? `Encryptie-at-rest is actief op alle ${handles.length} gekende handles (cipher ${cipherDriver}).`
      : `Encryptie-at-rest is actief op ${handles.length} van ${GEKENDE_HANDLES.length} gekende handles ` +
        `(cipher ${cipherDriver}). De overige handles openen de databank mogelijk zonder sleutel.`,
  };
}

/**
 * Eenmalige, goed zichtbare opstartmelding. Draait de app als no-op, dan staat
 * dat er ook zo: liever een ongemakkelijke logregel dan een stille aanname.
 */
export function logEncryptieStatus(
  schrijf: (regel: string) => void = (r) => console.log(r),
): EncryptieStatus {
  const status = encryptieStatus();
  const kop = status.actief ? "ACTIEF" : "NIET ACTIEF (no-op)";
  schrijf(`[tapas] encryptie-at-rest: ${kop} - ${status.reden}`);
  return status;
}
