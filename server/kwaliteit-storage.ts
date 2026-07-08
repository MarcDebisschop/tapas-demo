// =============================================================================
// kwaliteit-storage.ts — SQLite persistentie voor de Kwaliteitsmonitor
//
// Aangemaakt: 2026-07-08 (Ronde 40)
//
// Probleem (systeemgap 1 + 5): de kwaliteitsmonitor hield normen,
// statusoverrides, alert-flags en de mail-log uitsluitend in in-memory Maps bij
// (routes-stm.ts, R37). Bij elke server-herstart verdween álle kwaliteitsstate.
// Bovendien konden "ontbrekende info" en "open kwaliteitsvragen" nergens worden
// opgeslagen — ze zaten niet in het datamodel.
//
// Oplossing: dezelfde data.db (WAL) als stm-storage.ts, met vier dedicated
// tabellen. Zelfde patroon en conventies als stm-storage.ts (NP-4).
//
// Bovendien (systeemgap 3): een idempotente demo-seed die realistische
// afname-historiek in stm_sessies schrijft voor alle practitioners, zodat het
// dashboard een geloofwaardig, gevarieerd "werkend" beeld toont in plaats van
// overal 0 afnames / zware achterstand.
//
// Exports:
//   kwaliteitDb           — sqlite handle (dezelfde data.db)
//   kwaliteitOpslag       — CRUD helpers voor normen/overrides/alerts/maillog/notities
//   seedDemoKwaliteit()   — idempotente demo-seed van afname-historiek
// =============================================================================

import Database from "better-sqlite3";
import { join } from "node:path";

// Gebruik dezelfde data.db als de hoofdapp en stm-storage (WAL laat
// meerdere handles toe).
const DB_PAD = join(process.cwd(), "data.db");
const kwaliteitDb = new Database(DB_PAD);
kwaliteitDb.pragma("journal_mode = WAL");
kwaliteitDb.pragma("synchronous = NORMAL");

// ---------------------------------------------------------------------------
// Schema — vier tabellen, allemaal idempotent (CREATE TABLE IF NOT EXISTS)
// ---------------------------------------------------------------------------

kwaliteitDb.exec(`
  -- Per practitioner een norm-override (jaartarget aantal afnames).
  CREATE TABLE IF NOT EXISTS kwaliteit_normen (
    beheerder_id INTEGER PRIMARY KEY,
    norm         INTEGER NOT NULL,
    bijgewerkt_at TEXT   NOT NULL
  );

  -- Per practitioner een status-override (opgeschort / uitzondering).
  CREATE TABLE IF NOT EXISTS kwaliteit_overrides (
    beheerder_id INTEGER PRIMARY KEY,
    status       TEXT,
    reden        TEXT,
    bijgewerkt_at TEXT NOT NULL
  );

  -- Per practitioner de verzonden alert-trappen (1/2/3).
  CREATE TABLE IF NOT EXISTS kwaliteit_alerts (
    beheerder_id INTEGER PRIMARY KEY,
    trap1_sent   INTEGER NOT NULL DEFAULT 0,
    trap2_sent   INTEGER NOT NULL DEFAULT 0,
    trap3_sent   INTEGER NOT NULL DEFAULT 0,
    bijgewerkt_at TEXT
  );

  -- Volledige mail-/signaal-log (append-only).
  CREATE TABLE IF NOT EXISTS kwaliteit_maillog (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    beheerder_id INTEGER NOT NULL,
    trap         INTEGER NOT NULL,
    naam         TEXT    NOT NULL,
    email        TEXT    NOT NULL,
    verstuurd_at TEXT    NOT NULL
  );

  -- Ontbrekende info (checklist) + open kwaliteitsvragen/notities per practitioner.
  -- soort: 'ontbrekend' (checklist-item) of 'open_vraag' (notitie/vraag).
  CREATE TABLE IF NOT EXISTS kwaliteit_notities (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    beheerder_id  INTEGER NOT NULL,
    soort         TEXT    NOT NULL,
    tekst         TEXT    NOT NULL,
    opgelost      INTEGER NOT NULL DEFAULT 0,
    aangemaakt_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kwaliteit_notities_beheerder
    ON kwaliteit_notities (beheerder_id);
  CREATE INDEX IF NOT EXISTS idx_kwaliteit_maillog_beheerder
    ON kwaliteit_maillog (beheerder_id);
`);

export { kwaliteitDb };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MailLogRegel {
  beheerderId: number;
  trap: number;
  naam: string;
  email: string;
  verstuurdAt: string;
}

export interface Notitie {
  id: number;
  beheerder_id: number;
  soort: "ontbrekend" | "open_vraag";
  tekst: string;
  opgelost: boolean;
  aangemaakt_at: string;
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export const kwaliteitOpslag = {
  // ── Normen ──────────────────────────────────────────────────────────────
  getNorm(beheerderId: number): number | undefined {
    const r = kwaliteitDb
      .prepare(`SELECT norm FROM kwaliteit_normen WHERE beheerder_id = ?`)
      .get(beheerderId) as { norm: number } | undefined;
    return r?.norm;
  },
  setNorm(beheerderId: number, norm: number): void {
    kwaliteitDb
      .prepare(
        `INSERT INTO kwaliteit_normen (beheerder_id, norm, bijgewerkt_at)
         VALUES (?, ?, ?)
         ON CONFLICT(beheerder_id) DO UPDATE SET norm = excluded.norm, bijgewerkt_at = excluded.bijgewerkt_at`
      )
      .run(beheerderId, norm, new Date().toISOString());
  },

  // ── Status-overrides ──────────────────────────────────────────────────────
  getOverride(beheerderId: number): { status?: string; reden?: string } | undefined {
    const r = kwaliteitDb
      .prepare(`SELECT status, reden FROM kwaliteit_overrides WHERE beheerder_id = ?`)
      .get(beheerderId) as { status: string | null; reden: string | null } | undefined;
    if (!r) return undefined;
    return { status: r.status ?? undefined, reden: r.reden ?? undefined };
  },
  setOverride(beheerderId: number, status: string | null, reden?: string): void {
    kwaliteitDb
      .prepare(
        `INSERT INTO kwaliteit_overrides (beheerder_id, status, reden, bijgewerkt_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(beheerder_id) DO UPDATE SET status = excluded.status, reden = excluded.reden, bijgewerkt_at = excluded.bijgewerkt_at`
      )
      .run(beheerderId, status, reden ?? null, new Date().toISOString());
  },

  // ── Alert-flags ─────────────────────────────────────────────────────────
  getAlerts(beheerderId: number): { trap1: boolean; trap2: boolean; trap3: boolean } {
    const r = kwaliteitDb
      .prepare(`SELECT trap1_sent, trap2_sent, trap3_sent FROM kwaliteit_alerts WHERE beheerder_id = ?`)
      .get(beheerderId) as { trap1_sent: number; trap2_sent: number; trap3_sent: number } | undefined;
    return {
      trap1: !!r?.trap1_sent,
      trap2: !!r?.trap2_sent,
      trap3: !!r?.trap3_sent,
    };
  },
  setAlertTrap(beheerderId: number, trap: 1 | 2 | 3): void {
    const kolom = trap === 1 ? "trap1_sent" : trap === 2 ? "trap2_sent" : "trap3_sent";
    kwaliteitDb
      .prepare(
        `INSERT INTO kwaliteit_alerts (beheerder_id, ${kolom}, bijgewerkt_at)
         VALUES (?, 1, ?)
         ON CONFLICT(beheerder_id) DO UPDATE SET ${kolom} = 1, bijgewerkt_at = excluded.bijgewerkt_at`
      )
      .run(beheerderId, new Date().toISOString());
  },

  // ── Mail-log ──────────────────────────────────────────────────────────────
  logMail(r: MailLogRegel): void {
    kwaliteitDb
      .prepare(
        `INSERT INTO kwaliteit_maillog (beheerder_id, trap, naam, email, verstuurd_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(r.beheerderId, r.trap, r.naam, r.email, r.verstuurdAt);
  },
  laatsteMails(limiet = 20): MailLogRegel[] {
    const rijen = kwaliteitDb
      .prepare(
        `SELECT beheerder_id, trap, naam, email, verstuurd_at
         FROM kwaliteit_maillog ORDER BY id DESC LIMIT ?`
      )
      .all(limiet) as Array<{
        beheerder_id: number; trap: number; naam: string; email: string; verstuurd_at: string;
      }>;
    return rijen
      .map((r) => ({
        beheerderId: r.beheerder_id,
        trap: r.trap,
        naam: r.naam,
        email: r.email,
        verstuurdAt: r.verstuurd_at,
      }))
      .reverse();
  },

  // ── Notities: ontbrekende info + open vragen ──────────────────────────────
  getNotities(beheerderId: number): Notitie[] {
    const rijen = kwaliteitDb
      .prepare(
        `SELECT id, beheerder_id, soort, tekst, opgelost, aangemaakt_at
         FROM kwaliteit_notities WHERE beheerder_id = ? ORDER BY id ASC`
      )
      .all(beheerderId) as Array<{
        id: number; beheerder_id: number; soort: string; tekst: string; opgelost: number; aangemaakt_at: string;
      }>;
    return rijen.map((r) => ({
      id: r.id,
      beheerder_id: r.beheerder_id,
      soort: (r.soort === "open_vraag" ? "open_vraag" : "ontbrekend") as Notitie["soort"],
      tekst: r.tekst,
      opgelost: !!r.opgelost,
      aangemaakt_at: r.aangemaakt_at,
    }));
  },
  voegNotitieToe(beheerderId: number, soort: "ontbrekend" | "open_vraag", tekst: string): number {
    const res = kwaliteitDb
      .prepare(
        `INSERT INTO kwaliteit_notities (beheerder_id, soort, tekst, opgelost, aangemaakt_at)
         VALUES (?, ?, ?, 0, ?)`
      )
      .run(beheerderId, soort, tekst, new Date().toISOString());
    return res.lastInsertRowid as number;
  },
  zetNotitieOpgelost(id: number, opgelost: boolean): void {
    kwaliteitDb
      .prepare(`UPDATE kwaliteit_notities SET opgelost = ? WHERE id = ?`)
      .run(opgelost ? 1 : 0, id);
  },
};

// ---------------------------------------------------------------------------
// Demo-seed — realistische afname-historiek (systeemgap 3)
// ---------------------------------------------------------------------------
//
// Doel: het dashboard toont in een publieke read-only demo een geloofwaardig,
// gevarieerd beeld i.p.v. overal 0 afnames. Volledig idempotent en enkel actief
// als de omgeving een demo is (DEMO_SEED_KWALITEIT of standaard aan buiten
// productie-met-echte-data). Schrijft uitsluitend in stm_sessies (bestaande
// tabel) en raakt geen enkel beschermd bestand aan.

interface DemoPractitioner {
  id: number;
  // Streefbeeld voor de demo: hoeveel afnames dit jaar tot nu toe.
  afnamesYtd: number;
  // Optionele norm-afwijking (anders default 12).
  norm?: number;
  // Optionele status-override voor de demo.
  override?: { status: "opgeschort" | "uitzondering"; reden: string };
}

// Verdeling zo gekozen dat het dashboard alle statusklassen toont:
// norm_gehaald, actief (op schema), achterstand_25 (licht), achterstand_50
// (zwaar), plus opgeschort en uitzondering.
const DEMO_VERDELING: DemoPractitioner[] = [
  // Beheerders (echte DB-records) — sterke cijfers.
  { id: 1, afnamesYtd: 14 },                         // Marc Debisschop → norm gehaald
  { id: 2, afnamesYtd: 8 },                          // Roald Borré → op schema
  // Extra practitioners (1001–1021).
  { id: 1001, afnamesYtd: 13 },                      // norm gehaald
  { id: 1002, afnamesYtd: 9 },                       // op schema
  { id: 1003, afnamesYtd: 12 },                      // norm gehaald
  { id: 1004, afnamesYtd: 7 },                       // op schema
  { id: 1005, afnamesYtd: 5 },                       // lichte achterstand
  { id: 1006, afnamesYtd: 8 },                       // op schema
  { id: 1007, afnamesYtd: 2 },                       // zware achterstand
  { id: 1008, afnamesYtd: 10 },                      // op schema / bijna norm
  { id: 1009, afnamesYtd: 4 },                       // lichte achterstand
  { id: 1010, afnamesYtd: 15 },                      // ruim norm gehaald
  { id: 1011, afnamesYtd: 6 },                       // op schema (grens)
  { id: 1012, afnamesYtd: 3 },                       // zware achterstand
  { id: 1013, afnamesYtd: 9 },                       // op schema
  { id: 1014, afnamesYtd: 1, override: { status: "opgeschort", reden: "Langdurig afwezig (ouderschapsverlof) — target opgeschort." } },
  { id: 1015, afnamesYtd: 7 },                       // op schema
  { id: 1016, afnamesYtd: 5 },                       // lichte achterstand
  { id: 1017, afnamesYtd: 11 },                      // op schema / bijna norm
  { id: 1018, afnamesYtd: 8, norm: 8, override: { status: "uitzondering", reden: "Nieuwe practitioner sinds Q2 — verlaagd jaartarget (8)." } },
  { id: 1019, afnamesYtd: 6 },                       // op schema
  { id: 1020, afnamesYtd: 2 },                       // zware achterstand
  { id: 1021, afnamesYtd: 10 },                      // op schema / bijna norm
];

// Demo "ontbrekende info" + "open vragen" per practitioner (subset, realistisch).
const DEMO_NOTITIES: Array<{ id: number; soort: "ontbrekend" | "open_vraag"; tekst: string; opgelost?: boolean }> = [
  { id: 1005, soort: "ontbrekend", tekst: "Recente supervisie-registratie ontbreekt (laatste > 6 maanden geleden)." },
  { id: 1007, soort: "ontbrekend", tekst: "Accreditatiebewijs niet geüpload in het dossier." },
  { id: 1007, soort: "open_vraag", tekst: "Waarom stagneert de afname-frequentie sinds Q1? Contact opnemen." },
  { id: 1009, soort: "open_vraag", tekst: "Wenst practitioner over te stappen naar T4Teens-instrument?" },
  { id: 1012, soort: "ontbrekend", tekst: "Profielfoto en korte bio ontbreken op de publieke coach-lijst." },
  { id: 1012, soort: "open_vraag", tekst: "Herbevestiging engagement nodig — reageerde niet op trap-2 signaal." },
  { id: 1016, soort: "ontbrekend", tekst: "Intervisiedeelname Q2 niet bevestigd." },
  { id: 1020, soort: "ontbrekend", tekst: "Contactgegevens (telefoon) ontbreken in het register." },
  { id: 1020, soort: "open_vraag", tekst: "Actief houden of naar 'slapend' verplaatsen? Beslissing RvB nodig." },
  { id: 1002, soort: "open_vraag", tekst: "Interesse in rol als supervisor voor nieuwe practitioners?" },
];

/**
 * Idempotente demo-seed. Voert enkel iets uit als:
 *   - er nog géén afgeronde stm_sessies bestaan (verse demo-db), OF
 *   - DEMO_SEED_KWALITEIT === "force".
 * Zo blijft echte productiedata (indien ooit aanwezig) volledig ongemoeid.
 */
export function seedDemoKwaliteit(): { geseed: boolean; sessies: number; notities: number } {
  const force = process.env.DEMO_SEED_KWALITEIT === "force";
  const uit = process.env.DEMO_SEED_KWALITEIT === "off";
  if (uit) return { geseed: false, sessies: 0, notities: 0 };

  const bestaandeAfgerond = kwaliteitDb
    .prepare(`SELECT COUNT(*) AS n FROM stm_sessies WHERE afgerond_at IS NOT NULL`)
    .get() as { n: number };

  if (bestaandeAfgerond.n > 0 && !force) {
    return { geseed: false, sessies: bestaandeAfgerond.n, notities: 0 };
  }

  const jaar = new Date().getFullYear();
  const nu = new Date();
  // Deterministische pseudo-random generator (seeded) voor reproduceerbare demo.
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const insert = kwaliteitDb.prepare(
    `INSERT INTO stm_sessies
       (beheerder_id, gestart_at, afgerond_at, score_totaal, inschaling, duur_seconden, scores_per_laag, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const inschalingen = ["Beginnend", "Ontwikkelend", "Bekwaam", "Gevorderd", "Expert"];
  let totaalSessies = 0;

  const seedTx = kwaliteitDb.transaction(() => {
    if (force) {
      kwaliteitDb.prepare(`DELETE FROM stm_sessies`).run();
    }
    for (const p of DEMO_VERDELING) {
      // Norm-override zetten indien afwijkend.
      if (p.norm) kwaliteitOpslag.setNorm(p.id, p.norm);
      // Status-override zetten indien opgegeven.
      if (p.override) kwaliteitOpslag.setOverride(p.id, p.override.status, p.override.reden);

      // Spreid de afnames over het jaar tot nu toe (dag 1 → vandaag).
      const dagVanJaar = Math.floor((nu.getTime() - new Date(jaar, 0, 1).getTime()) / 86400000) || 1;
      for (let i = 0; i < p.afnamesYtd; i++) {
        const offsetDagen = Math.floor((i + 0.5) / p.afnamesYtd * dagVanJaar);
        const afgerond = new Date(jaar, 0, 1 + offsetDagen, 9 + Math.floor(rnd() * 8), Math.floor(rnd() * 60));
        const gestart = new Date(afgerond.getTime() - (25 + Math.floor(rnd() * 20)) * 60000);
        const score = Math.round((62 + rnd() * 36) * 10) / 10; // 62–98%
        const inschaling = inschalingen[Math.min(inschalingen.length - 1, Math.floor(score / 20))];
        const duur = Math.round((afgerond.getTime() - gestart.getTime()) / 1000);
        const scoresPerLaag = JSON.stringify({
          "1": Math.round((score - 4 + rnd() * 8) * 10) / 10,
          "2": Math.round((score - 4 + rnd() * 8) * 10) / 10,
          "3": Math.round((score - 4 + rnd() * 8) * 10) / 10,
          "4": Math.round((score - 4 + rnd() * 8) * 10) / 10,
        });
        insert.run(
          p.id,
          gestart.toISOString(),
          afgerond.toISOString(),
          score,
          inschaling,
          duur,
          scoresPerLaag,
          "[]"
        );
        totaalSessies++;
      }
    }

    // Notities enkel seeden als er nog geen zijn (idempotent).
    const bestaandeNotities = kwaliteitDb
      .prepare(`SELECT COUNT(*) AS n FROM kwaliteit_notities`)
      .get() as { n: number };
    if (bestaandeNotities.n === 0 || force) {
      if (force) kwaliteitDb.prepare(`DELETE FROM kwaliteit_notities`).run();
      for (const n of DEMO_NOTITIES) {
        kwaliteitOpslag.voegNotitieToe(n.id, n.soort, n.tekst);
      }
    }
  });

  seedTx();

  const notitieCount = (kwaliteitDb
    .prepare(`SELECT COUNT(*) AS n FROM kwaliteit_notities`)
    .get() as { n: number }).n;

  return { geseed: true, sessies: totaalSessies, notities: notitieCount };
}
