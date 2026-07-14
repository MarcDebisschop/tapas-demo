/**
 * server/auth/wachtwoord.ts
 *
 * Veilige wachtwoord-hashing zonder externe dependency.
 * Gebruikt Node's ingebouwde crypto.scrypt (gesalte, trage KDF).
 *
 * ADDITIEF (Werkprotocol Regel 2): nieuw bestand, raakt niets aan.
 * Enkel gebruikt door de definitieve (niet-demo) admin-login.
 *
 * Formaat van een opgeslagen hash:  scrypt$<saltHex>$<hashHex>
 * Zo blijft het zelfbeschrijvend en toekomstbestendig.
 */

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt);

const KEYLEN = 64;
const SALT_BYTES = 16;

/** Maak een nieuwe hash voor een wachtwoord in klaartekst. */
export async function hashWachtwoord(klaartekst: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scrypt(klaartekst, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

/**
 * Verifieer een wachtwoord tegen een opgeslagen hash.
 * Timing-safe. Geeft false bij ongeldige of ontbrekende hash.
 */
export async function verifieerWachtwoord(
  klaartekst: string,
  opgeslagen: string | null | undefined,
): Promise<boolean> {
  if (!opgeslagen || typeof opgeslagen !== "string") return false;
  const delen = opgeslagen.split("$");
  if (delen.length !== 3 || delen[0] !== "scrypt") return false;
  const [, salt, hashHex] = delen;
  try {
    const derived = (await scrypt(klaartekst, salt, KEYLEN)) as Buffer;
    const verwacht = Buffer.from(hashHex, "hex");
    if (verwacht.length !== derived.length) return false;
    return timingSafeEqual(verwacht, derived);
  } catch {
    return false;
  }
}
