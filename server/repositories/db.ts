/**
 * server/repositories/db.ts
 * 
 * Gedeelde database-verbinding voor alle domein-repositories.
 * Exporteert db, sqlite en cryptoRandom helper.
 * 
 * NOOIT rechtstreeks importeren vanuit routes of andere niet-repository code —
 * gebruik altijd de storage-façade (server/storage.ts).
 */
export { db, sqlite } from "../storage";

import { randomBytes } from "crypto";

/** Genereert een korte, onraadbare, URL-veilige tekenreeks. */
export function cryptoRandom(len: number): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}
