/**
 * Toetsen op de wedloop in de migratieloper.
 *
 * WAAROM DIT BESTAND BESTAAT
 * De bouwpijplijn sloeg onregelmatig rood met "Migratie <naam> is niet
 * toegepast: UNIQUE constraint failed: migratie_register.naam". De naam in de
 * melding wisselde per loop, wat op timing wees en niet op een vaste fout. De
 * oorzaak: het migratieregister werd één keer vooraf uitgelezen, buiten elk
 * slot. Openen twee testwerkers tegelijk dezelfde verse databank, dan zien ze
 * beide een leeg register, besluiten beide dat alles nog moet lopen, en valt de
 * tweede om op zijn registerregel.
 *
 * Deze toetsen leggen het gedrag vast dat de fout wegneemt. Ze gaan met opzet
 * over gedrag en niet over de manier waarop het gedrag bereikt wordt: of het
 * slot per migratie of anders geregeld is, mag later veranderen zolang twee
 * gelijktijdige lopers beide slagen.
 */
import Database from "better-sqlite3";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REGISTERTABEL, pasMigratiesToe, tabelBestaat } from "../server/migratieloper";

const uitvoeren = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const losProces = resolve(projectRoot, "tests/helpers/migratieloper-los-proces.ts");
const tsx = resolve(projectRoot, "node_modules/.bin/tsx");

let werkmap: string;

beforeEach(() => {
  werkmap = mkdtempSync(join(tmpdir(), "tapas-wedloop-"));
});

afterEach(() => {
  rmSync(werkmap, { recursive: true, force: true });
});

/** Zet een kleine reeks migratiebestanden klaar en geeft de map terug. */
function maakMigraties(bestanden: Record<string, string>): string {
  const map = join(werkmap, "migrations");
  rmSync(map, { recursive: true, force: true });
  mkdirSync(map, { recursive: true });
  for (const [naam, inhoud] of Object.entries(bestanden)) {
    writeFileSync(join(map, naam), inhoud);
  }
  return map;
}

/** De reeks die in de proeven gebruikt wordt: negen kleine migraties. */
function negenMigraties(): Record<string, string> {
  const bestanden: Record<string, string> = {};
  for (let i = 0; i < 9; i += 1) {
    const nummer = String(i).padStart(4, "0");
    bestanden[`${nummer}_proef.sql`] =
      `CREATE TABLE proef_${nummer} (id INTEGER PRIMARY KEY, waarde TEXT);`;
  }
  return bestanden;
}

describe("Twee lopers tegelijk op één verse databank", () => {
  // Vier rondes. De oude code viel hierop in ongeveer een derde van de rondes
  // om; één ronde zou dus te weinig bewijs zijn en tien zou de suite traag
  // maken. Elke ronde start twee losse processen, dus dit duurt merkbaar lang.
  const RONDES = 4;

  it(
    "laten beide processen slagen, zonder botsing op het register",
    async () => {
      const map = maakMigraties(negenMigraties());

      for (let ronde = 0; ronde < RONDES; ronde += 1) {
        const databankpad = join(werkmap, `ronde-${ronde}.db`);

        const beide = await Promise.all([
          uitvoeren(tsx, [losProces, databankpad, map]),
          uitvoeren(tsx, [losProces, databankpad, map]),
        ]);

        for (const { stdout } of beide) {
          // Een afsluitcode anders dan 0 laat execFile al struikelen; deze toets
          // vangt de melding zelf, zodat een fout leesbaar in het verslag komt.
          expect(stdout.trim(), `ronde ${ronde}`).toMatch(/^ok /);
        }

        // Samen moeten de negen migraties precies één keer toegepast zijn: het
        // ene proces doet ze, het andere ziet ze staan en doet niets.
        const totaalToegepast = beide
          .map(({ stdout }) => Number(stdout.trim().split(" ")[1]))
          .reduce((a, b) => a + b, 0);
        expect(totaalToegepast, `ronde ${ronde}`).toBe(9);

        // En het register mag geen dubbels bevatten.
        const db = new Database(databankpad, { readonly: true });
        try {
          const rijen = db.prepare(`SELECT naam FROM ${REGISTERTABEL}`).all() as {
            naam: string;
          }[];
          expect(rijen).toHaveLength(9);
          expect(new Set(rijen.map(({ naam }) => naam)).size).toBe(9);
          expect(tabelBestaat(db, "proef_0008")).toBe(true);
        } finally {
          db.close();
        }
      }
    },
    60_000,
  );
});

describe("Twee verbindingen na elkaar op dezelfde databank", () => {
  it("laat de tweede loper niets dubbel doen en niets omvallen", () => {
    const map = maakMigraties(negenMigraties());
    const databankpad = join(werkmap, "na-elkaar.db");

    const eerste = new Database(databankpad);
    const tweede = new Database(databankpad);
    try {
      const een = pasMigratiesToe(eerste, map);
      expect(een.toegepast).toHaveLength(9);

      // De tweede verbinding heeft haar eigen beeld van de databank. Ze mag niets
      // opnieuw uitvoeren en niet omvallen op de registerregels van de eerste.
      const twee = pasMigratiesToe(tweede, map);
      expect(twee.toegepast).toEqual([]);
      expect(twee.alAanwezig).toEqual([]);

      const rijen = tweede.prepare(`SELECT naam FROM ${REGISTERTABEL}`).all();
      expect(rijen).toHaveLength(9);
    } finally {
      eerste.close();
      tweede.close();
    }
  });
});

describe("De wachttijd op het slot", () => {
  it("wordt achteraf teruggezet op de waarde van de aanroeper", () => {
    const map = maakMigraties(negenMigraties());
    const db = new Database(join(werkmap, "wachttijd.db"));
    try {
      const vooraf = Number(db.pragma("busy_timeout", { simple: true }));
      pasMigratiesToe(db, map);
      const achteraf = Number(db.pragma("busy_timeout", { simple: true }));

      // De loper mag geen blijvende instelling achterlaten op een verbinding die
      // hij niet zelf geopend heeft. De rest van de server deelt die verbinding.
      expect(achteraf).toBe(vooraf);
    } finally {
      db.close();
    }
  });

  it("laat een hogere wachttijd van de aanroeper ongemoeid", () => {
    const map = maakMigraties(negenMigraties());
    const db = new Database(join(werkmap, "hoge-wachttijd.db"));
    try {
      db.pragma("busy_timeout = 60000");
      pasMigratiesToe(db, map);
      expect(Number(db.pragma("busy_timeout", { simple: true }))).toBe(60_000);
    } finally {
      db.close();
    }
  });
});

describe("De reeks loopt niet in één grote transactie", () => {
  it("laat wat gelukt is staan als een latere migratie omvalt", () => {
    // Deze eis staat ook in tests/migratieloper.test.ts. Ze staat hier nog een
    // keer omdat de eerste poging om de wedloop te sluiten — de hele reeks in
    // één transactie — juist deze eigenschap sloopte. Dat mag niet opnieuw
    // onbemerkt gebeuren.
    const map = maakMigraties({
      "0000_goed.sql": "CREATE TABLE eerste (id INTEGER PRIMARY KEY);",
      "0001_ook_goed.sql": "CREATE TABLE tweede (id INTEGER PRIMARY KEY);",
      "0002_stuk.sql": "DIT IS GEEN GELDIGE SQL;",
    });
    const db = new Database(join(werkmap, "half.db"));
    try {
      expect(() => pasMigratiesToe(db, map)).toThrow(/0002_stuk/);
      expect(tabelBestaat(db, "eerste")).toBe(true);
      expect(tabelBestaat(db, "tweede")).toBe(true);

      const namen = (
        db.prepare(`SELECT naam FROM ${REGISTERTABEL} ORDER BY naam`).all() as {
          naam: string;
        }[]
      ).map(({ naam }) => naam);
      expect(namen).toEqual(["0000_goed", "0001_ook_goed"]);
    } finally {
      db.close();
    }
  });
});
