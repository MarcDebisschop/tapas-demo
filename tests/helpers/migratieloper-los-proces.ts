/**
 * Los proces dat de echte migratieloper op één databank laat lopen.
 *
 * Bestaat alleen voor tests/migratieloper-wedloop.test.ts. Die toets start dit
 * bestand twee keer tegelijk op dezelfde verse databank en eist dat beide
 * processen slagen. Dat is niet in één proces na te bouwen: de wedloop die hier
 * getoetst wordt, gaat over twee verbindingen die elk hun eigen SQLite-slot
 * aanvragen, en dat gedrag is alleen echt tussen processen.
 *
 * Aanroep: tsx tests/helpers/migratieloper-los-proces.ts <databankpad> <migratiemap>
 * Uitvoer op stdout: "ok <aantal toegepast> <aantal alAanwezig>" of "FOUT <melding>".
 * Afsluitcode 0 bij goed, 1 bij fout.
 */
import Database from "better-sqlite3";
import { pasMigratiesToe } from "../../server/migratieloper";

const [databankpad, migratiemap] = process.argv.slice(2);

if (!databankpad || !migratiemap) {
  process.stdout.write("FOUT ontbrekende argumenten\n");
  process.exit(1);
}

const db = new Database(databankpad);
try {
  const uitkomst = pasMigratiesToe(db, migratiemap);
  process.stdout.write(`ok ${uitkomst.toegepast.length} ${uitkomst.alAanwezig.length}\n`);
  process.exit(0);
} catch (oorzaak) {
  const melding = oorzaak instanceof Error ? oorzaak.message : String(oorzaak);
  process.stdout.write(`FOUT ${melding}\n`);
  process.exit(1);
} finally {
  db.close();
}
