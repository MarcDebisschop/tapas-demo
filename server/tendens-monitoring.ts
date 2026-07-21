// ---------------------------------------------------------------------------
// TaPas Platform — Inzichtcentrum: Tendensmonitoring (Fase 0-1)
//
// Additieve module conform het bouwplan "Tendensen monitoren in het
// Inzichtcentrum". Raakt GEEN bestaande bestanden aan; registreert eigen
// endpoints en maakt eigen tabellen idempotent aan.
//
// FASE 0 — Datalaag:
//   tabel tendens_snapshot : periodieke, GEAGGREGEERDE meetpunten (nooit
//                            individuele profielen). Bron voor alle detectie.
//   tabel tendens_signaal  : observaties en bevestigde signalen (fase 2 vult
//                            deze later; fase 0-1 maakt enkel de structuur).
//
// FASE 1 — Baseline:
//   Berekent uit de bestaande `afnames`-data de referentie-meetpunten
//   (volume per maand, per instrument, voltooiingsgraad) en schrijft ze als
//   snapshot weg. Uitsluitend geaggregeerd; groepen < 5 worden onderdrukt
//   (k-anonimiteit), conform het migratieplan.
//
// PRINCIPE (strikt): geen verzonnen cijfers. Alles wordt live uit de database
// berekend. Onder de drempels toont het systeem eerlijk "nog niet gehaald".
//
// REGELS (protocol):
// - routes.ts wordt NIET gewijzigd (aparte registratie).
// - Tabellen via CREATE TABLE IF NOT EXISTS (idempotent).
// - Alle endpoints vereisen admin-sessie.
// - Detectie/aggregatie draait uitsluitend op geaggregeerde snapshots.
// ---------------------------------------------------------------------------

import type { Express } from "express";
import type { Request, Response } from "express";
import { sqlite as sqliteInstance } from "./storage";

// k-anonimiteit: groepen kleiner dan dit worden onderdrukt in aggregaten.
const K_ANONIMITEIT = 5;

// Drempels voor gevorderde analyses (spiegel van het bestaande overzicht).
const DREMPEL_FACTORANALYSE = 300;

// ---------------------------------------------------------------------------
// UA-IJKPUNT — extern gevalideerde structuur-referentie (T4Sports).
//
// Dit is GEEN live-berekende waarde en mag dat ook niet zijn: het is de
// gevalideerde uitkomst van de factoranalyse op de UA-export (T4S). Het dient
// als vast referentiepunt waartegen latere structuurdrift (fase 2, familie C)
// wordt afgezet. Elke waarde draagt zijn herkomst (bron) mee, zodat nooit
// verward wordt met een live-cijfer.
//
// Herkomst per waarde:
//   "herbevestigd" = deze sessie opnieuw uit de scripts gedraaid (hard).
//   "gedocumenteerd" = uit de eerdere UA-analyse; niet live herbereken baar
//                      omdat de ruwe itemmatrix hier niet aanwezig is.
// ---------------------------------------------------------------------------
const UA_IJKPUNT = {
  bron: "UA-factoranalyse T4Sports (extern gevalideerd)",
  vastgesteldOp: "2026-07",
  waarden: [
    { sleutel: "f1_variantie",      label: "Verklaarde variantie energie-as (Factor 1)", waarde: 0.232, herkomst: "herbevestigd" },
    { sleutel: "omega_18",          label: "McDonald's omega energie-as (18 items)",       waarde: 0.939, herkomst: "herbevestigd" },
    { sleutel: "omega_14_kern",     label: "McDonald's omega kern-energie-as (14 items)",  waarde: 0.946, herkomst: "herbevestigd" },
    { sleutel: "tucker_phi_f1",     label: "Tucker's phi Factor 1 (reproductie)",          waarde: 0.994, herkomst: "herbevestigd" },
    { sleutel: "tucker_phi_gem",    label: "Tucker's phi gemiddeld (11 factoren)",         waarde: 0.929, herkomst: "herbevestigd" },
    { sleutel: "kmo",               label: "KMO (steekproefadequaatheid)",                waarde: 0.828, herkomst: "gedocumenteerd" },
  ],
} as const;

// Haal de sqlite-instantie op (zelfde patroon als routes-coaches-academy-mail).
function getSqlite(db: any, storage: any): any {
  return sqliteInstance ?? db?._db ?? storage?.sqlite ?? null;
}

// Controleer admin-sessie (zelfde patroon als elders in de codebase).
function requireAdmin(req: Request, res: Response): boolean {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) {
    res.status(401).json({ error: "Niet ingelogd." });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// FASE 0 — Datalaag: tabellen aanmaken (idempotent).
// ---------------------------------------------------------------------------
export function maakTendensTabellen(sqlite: any): void {
  if (!sqlite) return;

  // Eén rij per meetpunt per periode. De detectie leest UITSLUITEND deze tabel.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tendens_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument TEXT NOT NULL DEFAULT 'platform',
      dimensie TEXT NOT NULL,
      sleutel TEXT NOT NULL DEFAULT '',
      periode TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      gemiddelde REAL,
      sd REAL,
      aandeel REAL,
      onderdrukt INTEGER NOT NULL DEFAULT 0,
      is_baseline INTEGER NOT NULL DEFAULT 0,
      berekend_op TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tendens_snapshot_meetpunt
    ON tendens_snapshot (instrument, dimensie, sleutel, periode)
  `);

  // Observaties en bevestigde signalen. Fase 2 vult deze; fase 0-1 maakt structuur.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tendens_signaal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument TEXT NOT NULL DEFAULT 'platform',
      dimensie TEXT NOT NULL,
      sleutel TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'niveau',
      changepoint_datum TEXT,
      effectgrootte REAL,
      richting TEXT,
      status TEXT NOT NULL DEFAULT 'observatie',
      n INTEGER NOT NULL DEFAULT 0,
      toelichting TEXT NOT NULL DEFAULT '',
      gedetecteerd_op TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tendens_signaal_status
    ON tendens_signaal (status, instrument, dimensie)
  `);
}

// ---------------------------------------------------------------------------
// FASE 1 — Baseline berekenen uit de bestaande afnames-data.
// Uitsluitend geaggregeerd; groepen < K_ANONIMITEIT worden onderdrukt.
// Retourneert het aantal weggeschreven baseline-meetpunten.
// ---------------------------------------------------------------------------
export function berekenBaseline(sqlite: any): { meetpunten: number; onderdrukt: number } {
  if (!sqlite) return { meetpunten: 0, onderdrukt: 0 };

  maakTendensTabellen(sqlite);

  // Verse baseline: verwijder vorige baseline-rijen (niet-baseline snapshots blijven).
  sqlite.prepare("DELETE FROM tendens_snapshot WHERE is_baseline = 1").run();

  const insert = sqlite.prepare(`
    INSERT INTO tendens_snapshot
      (instrument, dimensie, sleutel, periode, n, gemiddelde, sd, aandeel, onderdrukt, is_baseline, berekend_op)
    VALUES (@instrument, @dimensie, @sleutel, @periode, @n, @gemiddelde, @sd, @aandeel, @onderdrukt, 1, datetime('now'))
  `);

  let meetpunten = 0;
  let onderdrukt = 0;

  const schrijf = (rij: {
    instrument: string; dimensie: string; sleutel: string; periode: string;
    n: number; gemiddelde: number | null; sd: number | null; aandeel: number | null;
  }) => {
    const isOnderdrukt = rij.n > 0 && rij.n < K_ANONIMITEIT;
    insert.run({
      instrument: rij.instrument,
      dimensie: rij.dimensie,
      sleutel: rij.sleutel,
      periode: rij.periode,
      // Bij onderdrukking tonen we het meetpunt wél, maar zonder detailwaarden.
      n: rij.n,
      gemiddelde: isOnderdrukt ? null : rij.gemiddelde,
      sd: isOnderdrukt ? null : rij.sd,
      aandeel: isOnderdrukt ? null : rij.aandeel,
      onderdrukt: isOnderdrukt ? 1 : 0,
    });
    meetpunten += 1;
    if (isOnderdrukt) onderdrukt += 1;
  };

  const totaal = (sqlite.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any)?.n ?? 0;

  // (a) Volume-baseline per maand (laatste 24 maanden) — familie A/B, bron voor regelkaart op tellingen.
  const perMaand = sqlite.prepare(`
    SELECT strftime('%Y-%m', created_at) AS periode, COUNT(*) AS n
    FROM afnames
    WHERE created_at >= date('now', '-24 months')
    GROUP BY periode
    ORDER BY periode ASC
  `).all() as any[];
  for (const r of perMaand) {
    schrijf({ instrument: "platform", dimensie: "volume_maand", sleutel: "", periode: r.periode, n: r.n, gemiddelde: null, sd: null, aandeel: null });
  }

  // (b) Volume-baseline per instrument (over de volledige periode) — familie A.
  const perInstrument = sqlite.prepare(`
    SELECT COALESCE(instrument_id, 'onbekend') AS sleutel, COUNT(*) AS n
    FROM afnames
    GROUP BY instrument_id
    ORDER BY n DESC
  `).all() as any[];
  for (const r of perInstrument) {
    const aandeel = totaal > 0 ? r.n / totaal : null;
    schrijf({ instrument: r.sleutel, dimensie: "volume_instrument", sleutel: r.sleutel, periode: "baseline", n: r.n, gemiddelde: null, sd: null, aandeel });
  }

  // (c) Voltooiingsgraad-baseline (base-rate) — familie B, bron voor p-kaart.
  const voltooid = (sqlite.prepare("SELECT COUNT(*) AS n FROM afnames WHERE status = 'voltooid'").get() as any)?.n ?? 0;
  schrijf({
    instrument: "platform", dimensie: "voltooiingsgraad", sleutel: "", periode: "baseline",
    n: totaal, gemiddelde: null, sd: null, aandeel: totaal > 0 ? voltooid / totaal : null,
  });

  // (d) Structuur-ijkpunt uit de UA-factoranalyse (extern gevalideerd, T4Sports).
  //     Vast referentiepunt voor structuurdrift (fase 2, familie C). Geen live
  //     cijfer: de waarde staat in `gemiddelde`, de metriek in `sleutel`. n=0
  //     want dit is geen steekproeftelling, dus geen k-anonimiteit van toepassing.
  schrijfUaIjkpunt(sqlite);
  for (const _ of UA_IJKPUNT.waarden) meetpunten += 1;

  return { meetpunten, onderdrukt };
}

// ---------------------------------------------------------------------------
// Schrijf het UA-structuurijkpunt als baseline-snapshots weg (dimensie
// "structuur_ua", instrument "t4sports"). Idempotent binnen een baseline-run:
// oude structuur_ua-baselinerijen worden eerst verwijderd.
// ---------------------------------------------------------------------------
export function schrijfUaIjkpunt(sqlite: any): number {
  if (!sqlite) return 0;
  maakTendensTabellen(sqlite);

  sqlite.prepare(
    "DELETE FROM tendens_snapshot WHERE is_baseline = 1 AND dimensie = 'structuur_ua'"
  ).run();

  const insert = sqlite.prepare(`
    INSERT INTO tendens_snapshot
      (instrument, dimensie, sleutel, periode, n, gemiddelde, sd, aandeel, onderdrukt, is_baseline, berekend_op)
    VALUES ('t4sports', 'structuur_ua', @sleutel, @periode, 0, @waarde, NULL, NULL, 0, 1, datetime('now'))
  `);

  let geschreven = 0;
  for (const w of UA_IJKPUNT.waarden) {
    insert.run({ sleutel: w.sleutel, periode: UA_IJKPUNT.vastgesteldOp, waarde: w.waarde });
    geschreven += 1;
  }
  return geschreven;
}

// ---------------------------------------------------------------------------
// Registratie van de endpoints.
// ---------------------------------------------------------------------------
export function registerTendensMonitoringRoutes(app: Express, db: any, storage: any): void {
  const sqlite = getSqlite(db, storage);
  // Fase 0: zorg dat de tabellen bestaan zodra de server start.
  if (sqlite) {
    maakTendensTabellen(sqlite);
    // Het UA-structuurijkpunt is een vaste referentie; zet het meteen klaar
    // zodat het beschikbaar is ook nog vóór een eerste baseline-run.
    try { schrijfUaIjkpunt(sqlite); } catch (e) { console.error("[tendensen] ijkpunt init", e); }
  }

  // GET status: read-only overzicht van de tendenslaag. Verzint niets.
  app.get("/api/inzichtcentrum/tendensen/status", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) {
      return res.json({
        beschikbaar: false, fase: "0-1", baselineAanwezig: false,
        meetpunten: 0, signalen: { observatie: 0, bevestigd: 0, gepubliceerd: 0 },
        drempel: { factoranalyse: { benodigd: DREMPEL_FACTORANALYSE, huidig: 0, gehaald: false } },
        gegenereerdOp: new Date().toISOString(),
      });
    }
    try {
      maakTendensTabellen(sq);

      const baselineCount = (sq.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1").get() as any)?.n ?? 0;
      const snapshotTotaal = (sq.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot").get() as any)?.n ?? 0;
      const laatsteBaseline = (sq.prepare("SELECT MAX(berekend_op) AS t FROM tendens_snapshot WHERE is_baseline = 1").get() as any)?.t ?? null;

      const sigRijen = sq.prepare("SELECT status, COUNT(*) AS n FROM tendens_signaal GROUP BY status").all() as any[];
      const signalen = { observatie: 0, bevestigd: 0, gepubliceerd: 0 } as Record<string, number>;
      for (const r of sigRijen) if (r.status in signalen) signalen[r.status] = r.n;

      const afnamesTotaal = (sq.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any)?.n ?? 0;

      const ijkpuntCount = (sq.prepare(
        "SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1 AND dimensie = 'structuur_ua'"
      ).get() as any)?.n ?? 0;

      return res.json({
        beschikbaar: true,
        fase: "0-1",
        baselineAanwezig: baselineCount > 0,
        laatsteBaselineOp: laatsteBaseline,
        meetpunten: snapshotTotaal,
        baselineMeetpunten: baselineCount,
        signalen,
        structuurIjkpunt: {
          bron: UA_IJKPUNT.bron,
          vastgesteldOp: UA_IJKPUNT.vastgesteldOp,
          aanwezig: ijkpuntCount > 0,
          aantalWaarden: ijkpuntCount,
        },
        drempel: {
          factoranalyse: {
            benodigd: DREMPEL_FACTORANALYSE,
            huidig: afnamesTotaal,
            gehaald: afnamesTotaal >= DREMPEL_FACTORANALYSE,
          },
        },
        gegenereerdOp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[tendensen/status]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // GET baseline-meetpunten: read-only lijst van de baseline-snapshots.
  app.get("/api/inzichtcentrum/tendensen/baseline", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json({ meetpunten: [] });
    try {
      maakTendensTabellen(sq);
      const rijen = sq.prepare(`
        SELECT instrument, dimensie, sleutel, periode, n, gemiddelde, sd, aandeel, onderdrukt, berekend_op
        FROM tendens_snapshot
        WHERE is_baseline = 1
        ORDER BY dimensie ASC, periode ASC, sleutel ASC
      `).all() as any[];
      return res.json({
        meetpunten: rijen.map((r: any) => ({ ...r, onderdrukt: Boolean(r.onderdrukt) })),
      });
    } catch (e) {
      console.error("[tendensen/baseline]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // GET structuur-ijkpunt: de vaste, extern gevalideerde UA-referentie met
  // volledige herkomst per waarde. Read-only. Verzint niets — dit is de bron
  // waartegen fase 2 structuurdrift zal afzetten.
  app.get("/api/inzichtcentrum/tendensen/ijkpunt", (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({
      bron: UA_IJKPUNT.bron,
      vastgesteldOp: UA_IJKPUNT.vastgesteldOp,
      toelichting:
        "Extern gevalideerd structuurijkpunt uit de UA-factoranalyse (T4Sports). " +
        "Vast referentiepunt voor structuurdrift; geen live-berekend cijfer. " +
        "Herkomst 'herbevestigd' = opnieuw uit de bronscripts gedraaid; " +
        "'gedocumenteerd' = uit de eerdere UA-analyse, ruwe itemmatrix niet live aanwezig.",
      waarden: UA_IJKPUNT.waarden.map((w) => ({
        sleutel: w.sleutel, label: w.label, waarde: w.waarde, herkomst: w.herkomst,
      })),
    });
  });

  // POST baseline (her)berekenen: draait fase 1 op de actuele afnames-data.
  app.post("/api/inzichtcentrum/tendensen/baseline/herbereken", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const resultaat = berekenBaseline(sq);
      return res.json({ ok: true, ...resultaat, berekendOp: new Date().toISOString() });
    } catch (e) {
      console.error("[tendensen/baseline/herbereken]", e);
      return res.status(500).json({ error: "Berekenen mislukt." });
    }
  });
}
