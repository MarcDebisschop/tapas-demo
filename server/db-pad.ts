// -----------------------------------------------------------------------------
// Gedeelde SQLite-padresolutie — NIEUW (pilot, additief, Regel 2).
//
// Historisch openden enkele modules `new Database("data.db")` of
// `join(process.cwd(), "data.db")` rechtstreeks. Dat werkt zolang alle modules
// vanuit dezelfde werkmap starten, maar het negeert de expliciete override
// `TAPAS_DB_PATH`. Bij een deploy met een persistente schijf (Render-disk op
// /var/data) moet ÉÉN centraal bestand gedeeld worden door alle modules —
// anders ontstaat "split-brain" (verschillende handles op verschillende
// bestanden).
//
// Deze helper repliceert exact dezelfde logica als server/storage.ts:
//   1. TAPAS_DB_PATH wint altijd (ook als het bestand nog niet bestaat);
//   2. anders: zoek een bestaande data.db op de bekende locaties;
//   3. anders: anker in de projectroot.
//
// GEDRAG ONGEWIJZIGD wanneer TAPAS_DB_PATH leeg is: de fallback levert exact
// hetzelfde pad als voorheen (process.cwd()/data.db in de gangbare gevallen),
// dus lokaal en op de bestaande platform-service verandert er niets (Regel 1).
// -----------------------------------------------------------------------------
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function vindDatabasePad(): string {
  // Expliciete override wint altijd (ook als het bestand nog niet bestaat).
  if (process.env.TAPAS_DB_PATH) return resolve(process.env.TAPAS_DB_PATH);

  // __dirname wijst in de CommonJS-bundle naar de map van dist/index.cjs (= dist/).
  const distDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const projectRoot = resolve(distDir, ".."); // projectroot = boven dist/
  const kandidaten = [
    resolve(projectRoot, "data.db"),   // projectroot (publish-snapshot) — eerst
    resolve(process.cwd(), "data.db"), // werkmap (lokale dev)
    resolve(distDir, "data.db"),       // naast de bundle (vangnet)
  ].filter(Boolean) as string[];

  for (const p of kandidaten) {
    if (existsSync(p)) return p;
  }
  // Niets gevonden: anker in de projectroot zodat de snapshot werkt.
  return resolve(projectRoot, "data.db");
}
