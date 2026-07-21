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

// ===========================================================================
// FASE 2 — Detectiemotor.
//
// Leest UITSLUITEND geaggregeerde snapshots + baseline en detecteert tendensen
// via drie wetenschappelijk onderbouwde families:
//   Familie A/B (volume, base-rate) : Shewhart 3-sigma control chart + CUSUM
//                                      (changepoint) + p-chart (proporties).
//   Familie C   (structuurdrift)     : vergelijking van een live structuur-
//                                      metriek tegen het UA-ijkpunt.
//
// STRIKT PRINCIPE: geen verzonnen signalen. Elke methode heeft een minimum-
// datavereiste (min-n / min-aantal-perioden). Onder die grens rapporteert de
// motor eerlijk "onvoldoende data" en schrijft GEEN signaal weg.
// ===========================================================================

// Minimum aantal historische perioden voor een betrouwbare control chart.
const MIN_PERIODEN_CONTROLCHART = 8;
// Minimum aantal afnames voor een betrouwbare voltooiingsgraad-p-kaart.
const MIN_N_PCHART = 30;
// CUSUM-parameters (in eenheden van sigma): k = toegestane drift (0,5 sigma),
// h = beslissingsgrens (5 sigma) — standaard, robuuste keuze uit de literatuur.
const CUSUM_K_SIGMA = 0.5;
const CUSUM_H_SIGMA = 5.0;
// Structuurdrift-drempels t.o.v. het UA-ijkpunt.
const DRIFT_PHI_MIN = 0.85;        // Tucker phi < 0,85 = onvoldoende reproductie.
const DRIFT_OMEGA_REL_DALING = 0.10; // omega-daling van >10% t.o.v. ijkpunt = signaal.

export interface ControlChartResultaat {
  gemiddelde: number;
  sd: number;
  ondergrens: number;   // gemiddelde - 3 sigma
  bovengrens: number;   // gemiddelde + 3 sigma
  uitschieters: { index: number; waarde: number; richting: "boven" | "onder" }[];
  voldoendeData: boolean;
}

// Shewhart 3-sigma control chart op een reeks tellingen.
// De laatste waarde geldt als "actueel"; historie = alle waarden ervoor.
export function berekenControlChart(reeks: number[]): ControlChartResultaat {
  const leeg: ControlChartResultaat = {
    gemiddelde: 0, sd: 0, ondergrens: 0, bovengrens: 0, uitschieters: [], voldoendeData: false,
  };
  if (!Array.isArray(reeks) || reeks.length < MIN_PERIODEN_CONTROLCHART) return leeg;

  const n = reeks.length;
  const gemiddelde = reeks.reduce((a, b) => a + b, 0) / n;
  // Steekproef-SD (n-1). Bij SD=0 is er geen variatie en dus geen uitschieter.
  const variance = reeks.reduce((a, b) => a + (b - gemiddelde) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const ondergrens = gemiddelde - 3 * sd;
  const bovengrens = gemiddelde + 3 * sd;

  const uitschieters: ControlChartResultaat["uitschieters"] = [];
  if (sd > 0) {
    reeks.forEach((waarde, index) => {
      if (waarde > bovengrens) uitschieters.push({ index, waarde, richting: "boven" });
      else if (waarde < ondergrens) uitschieters.push({ index, waarde, richting: "onder" });
    });
  }
  return { gemiddelde, sd, ondergrens, bovengrens, uitschieters, voldoendeData: true };
}

export interface CusumResultaat {
  changepointIndex: number | null; // eerste index waar de grens wordt overschreden
  richting: "stijging" | "daling" | null;
  maxCusumPositief: number;
  maxCusumNegatief: number;
  voldoendeData: boolean;
}

// Tabellaire CUSUM voor changepoint-detectie op een reeks.
// Detecteert een geleidelijke niveauverschuiving (niet enkel losse uitschieters).
export function berekenCusum(reeks: number[]): CusumResultaat {
  const leeg: CusumResultaat = {
    changepointIndex: null, richting: null, maxCusumPositief: 0, maxCusumNegatief: 0, voldoendeData: false,
  };
  if (!Array.isArray(reeks) || reeks.length < MIN_PERIODEN_CONTROLCHART) return leeg;

  const n = reeks.length;
  const gemiddelde = reeks.reduce((a, b) => a + b, 0) / n;
  const variance = reeks.reduce((a, b) => a + (b - gemiddelde) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return { ...leeg, voldoendeData: true };

  const k = CUSUM_K_SIGMA * sd;
  const h = CUSUM_H_SIGMA * sd;
  let sHoog = 0, sLaag = 0;
  let maxHoog = 0, maxLaag = 0;
  let changepointIndex: number | null = null;
  let richting: "stijging" | "daling" | null = null;

  for (let i = 0; i < n; i++) {
    const afwijking = reeks[i] - gemiddelde;
    sHoog = Math.max(0, sHoog + afwijking - k);
    sLaag = Math.max(0, sLaag - afwijking - k);
    maxHoog = Math.max(maxHoog, sHoog);
    maxLaag = Math.max(maxLaag, sLaag);
    if (changepointIndex === null) {
      if (sHoog > h) { changepointIndex = i; richting = "stijging"; }
      else if (sLaag > h) { changepointIndex = i; richting = "daling"; }
    }
  }
  return { changepointIndex, richting, maxCusumPositief: maxHoog, maxCusumNegatief: maxLaag, voldoendeData: true };
}

export interface PChartResultaat {
  baselineProportie: number;
  actueleProportie: number;
  ondergrens: number;
  bovengrens: number;
  buitenGrens: boolean;
  richting: "boven" | "onder" | null;
  voldoendeData: boolean;
}

// p-chart: toetst of een actuele proportie buiten de 3-sigma-grenzen valt
// rond de baseline-proportie, gegeven de actuele steekproefgrootte n.
export function berekenPChart(baselineProportie: number, actueleProportie: number, nActueel: number): PChartResultaat {
  const leeg: PChartResultaat = {
    baselineProportie, actueleProportie, ondergrens: 0, bovengrens: 1,
    buitenGrens: false, richting: null, voldoendeData: false,
  };
  if (nActueel < MIN_N_PCHART || baselineProportie <= 0 || baselineProportie >= 1) return leeg;

  const sigma = Math.sqrt((baselineProportie * (1 - baselineProportie)) / nActueel);
  const ondergrens = Math.max(0, baselineProportie - 3 * sigma);
  const bovengrens = Math.min(1, baselineProportie + 3 * sigma);
  let buitenGrens = false;
  let richting: "boven" | "onder" | null = null;
  if (actueleProportie > bovengrens) { buitenGrens = true; richting = "boven"; }
  else if (actueleProportie < ondergrens) { buitenGrens = true; richting = "onder"; }
  return { baselineProportie, actueleProportie, ondergrens, bovengrens, buitenGrens, richting, voldoendeData: true };
}

export interface StructuurdriftResultaat {
  metriek: string;
  ijkpunt: number;
  live: number;
  drift: boolean;
  toelichting: string;
}

// Structuurdrift tegen het UA-ijkpunt. Vergelijkt een live structuur-metriek
// (bv. Tucker phi of omega) met de gevalideerde referentie.
export function detecteerStructuurdrift(metriek: string, ijkpunt: number, live: number): StructuurdriftResultaat {
  let drift = false;
  let toelichting = "Binnen de verwachte marge t.o.v. het UA-ijkpunt.";
  if (metriek.startsWith("tucker_phi")) {
    if (live < DRIFT_PHI_MIN) {
      drift = true;
      toelichting = `Tucker phi ${live.toFixed(3)} onder de drempel ${DRIFT_PHI_MIN} — onvoldoende structuurreproductie.`;
    }
  } else if (metriek.startsWith("omega")) {
    const relDaling = ijkpunt > 0 ? (ijkpunt - live) / ijkpunt : 0;
    if (relDaling > DRIFT_OMEGA_REL_DALING) {
      drift = true;
      toelichting = `Omega ${live.toFixed(3)} is ${(relDaling * 100).toFixed(1)}% lager dan het ijkpunt ${ijkpunt.toFixed(3)} — betrouwbaarheidsdaling.`;
    }
  }
  return { metriek, ijkpunt, live, drift, toelichting };
}

// ---------------------------------------------------------------------------
// Orchestrator: draait de detectie op de live data + baseline en schrijft
// gevonden signalen weg als observaties. Retourneert een samenvatting.
// Idempotent: verwijdert eerst eerdere niet-gepubliceerde observaties.
// ---------------------------------------------------------------------------
export interface DetectieSamenvatting {
  onderzocht: string[];
  signalen: number;
  overgeslagen: { dimensie: string; reden: string }[];
  uitgevoerdOp: string;
}

export function draaiDetectie(sqlite: any): DetectieSamenvatting {
  const samenvatting: DetectieSamenvatting = {
    onderzocht: [], signalen: 0, overgeslagen: [], uitgevoerdOp: new Date().toISOString(),
  };
  if (!sqlite) return samenvatting;
  maakTendensTabellen(sqlite);

  // Verse detectie: verwijder eerdere, nog niet bevestigde/gepubliceerde observaties.
  sqlite.prepare("DELETE FROM tendens_signaal WHERE status = 'observatie'").run();

  const insertSignaal = sqlite.prepare(`
    INSERT INTO tendens_signaal
      (instrument, dimensie, sleutel, type, changepoint_datum, effectgrootte, richting, status, n, toelichting, gedetecteerd_op)
    VALUES (@instrument, @dimensie, @sleutel, @type, @changepoint_datum, @effectgrootte, @richting, 'observatie', @n, @toelichting, datetime('now'))
  `);

  // --- Familie A/B: volume per maand (control chart + CUSUM) ---
  const maandRijen = sqlite.prepare(`
    SELECT strftime('%Y-%m', created_at) AS periode, COUNT(*) AS n
    FROM afnames
    WHERE created_at >= date('now', '-24 months')
    GROUP BY periode ORDER BY periode ASC
  `).all() as any[];
  samenvatting.onderzocht.push("volume_maand");
  const maandReeks = maandRijen.map((r) => r.n as number);
  const maandPerioden = maandRijen.map((r) => r.periode as string);

  if (maandReeks.length < MIN_PERIODEN_CONTROLCHART) {
    samenvatting.overgeslagen.push({
      dimensie: "volume_maand",
      reden: `Onvoldoende perioden (${maandReeks.length}/${MIN_PERIODEN_CONTROLCHART}) voor een betrouwbare control chart.`,
    });
  } else {
    const cc = berekenControlChart(maandReeks);
    for (const u of cc.uitschieters) {
      insertSignaal.run({
        instrument: "platform", dimensie: "volume_maand", sleutel: maandPerioden[u.index] ?? "",
        type: "niveau", changepoint_datum: maandPerioden[u.index] ?? null,
        effectgrootte: cc.sd > 0 ? (u.waarde - cc.gemiddelde) / cc.sd : null,
        richting: u.richting === "boven" ? "stijging" : "daling", n: u.waarde,
        toelichting: `Volume ${u.waarde} in ${maandPerioden[u.index]} valt buiten de 3-sigma-grens (gem. ${cc.gemiddelde.toFixed(1)}, sd ${cc.sd.toFixed(1)}).`,
      });
      samenvatting.signalen += 1;
    }
    const cusum = berekenCusum(maandReeks);
    if (cusum.changepointIndex !== null) {
      insertSignaal.run({
        instrument: "platform", dimensie: "volume_maand", sleutel: maandPerioden[cusum.changepointIndex] ?? "",
        type: "changepoint", changepoint_datum: maandPerioden[cusum.changepointIndex] ?? null,
        effectgrootte: null, richting: cusum.richting, n: maandReeks[cusum.changepointIndex] ?? 0,
        toelichting: `CUSUM detecteert een ${cusum.richting} vanaf ${maandPerioden[cusum.changepointIndex]} (geleidelijke niveauverschuiving).`,
      });
      samenvatting.signalen += 1;
    }
  }

  // --- Familie B: voltooiingsgraad (p-chart) ---
  samenvatting.onderzocht.push("voltooiingsgraad");
  const baselineGraad = sqlite.prepare(
    "SELECT aandeel FROM tendens_snapshot WHERE dimensie = 'voltooiingsgraad' AND is_baseline = 1 ORDER BY berekend_op DESC LIMIT 1"
  ).get() as any;
  const totaalNu = (sqlite.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any)?.n ?? 0;
  const voltooidNu = (sqlite.prepare("SELECT COUNT(*) AS n FROM afnames WHERE status = 'voltooid'").get() as any)?.n ?? 0;
  if (!baselineGraad || baselineGraad.aandeel == null) {
    samenvatting.overgeslagen.push({ dimensie: "voltooiingsgraad", reden: "Geen baseline-proportie beschikbaar." });
  } else if (totaalNu < MIN_N_PCHART) {
    samenvatting.overgeslagen.push({
      dimensie: "voltooiingsgraad",
      reden: `Onvoldoende afnames (${totaalNu}/${MIN_N_PCHART}) voor een betrouwbare p-kaart.`,
    });
  } else {
    const actueel = totaalNu > 0 ? voltooidNu / totaalNu : 0;
    const p = berekenPChart(baselineGraad.aandeel as number, actueel, totaalNu);
    if (p.buitenGrens) {
      insertSignaal.run({
        instrument: "platform", dimensie: "voltooiingsgraad", sleutel: "",
        type: "proportie", changepoint_datum: null,
        effectgrootte: p.actueleProportie - p.baselineProportie, richting: p.richting === "boven" ? "stijging" : "daling", n: totaalNu,
        toelichting: `Voltooiingsgraad ${(actueel * 100).toFixed(1)}% valt buiten de p-kaartgrenzen [${(p.ondergrens * 100).toFixed(1)}%, ${(p.bovengrens * 100).toFixed(1)}%] rond de baseline ${(p.baselineProportie * 100).toFixed(1)}%.`,
      });
      samenvatting.signalen += 1;
    }
  }

  // --- Familie C: structuurdrift tegen het UA-ijkpunt ---
  samenvatting.onderzocht.push("structuur_ua");
  // Een LIVE structuur-metriek vergt een volwaardige factoranalyse (>= drempel).
  // Zolang die drempel niet gehaald is, is er geen betrouwbare live-metriek en
  // wordt de familie eerlijk overgeslagen — er wordt NIETS verzonnen.
  if (totaalNu < DREMPEL_FACTORANALYSE) {
    samenvatting.overgeslagen.push({
      dimensie: "structuur_ua",
      reden: `Onvoldoende afnames (${totaalNu}/${DREMPEL_FACTORANALYSE}) voor een live structuur-metriek; vergelijking met het UA-ijkpunt is nog niet mogelijk.`,
    });
  }
  // (Wanneer de drempel wél gehaald wordt, levert een aparte structuur-snapshot
  //  de live phi/omega; detecteerStructuurdrift() vergelijkt die dan met UA_IJKPUNT.)

  return samenvatting;
}

// ---------------------------------------------------------------------------
// Fase 4 - Draft-generator wetenschappelijke duiding.
//
// Zet BEVESTIGDE (of gepubliceerde) signalen om in een wetenschappelijk
// geformuleerde concepttekst met methodische onderbouwing en bronverwijzing.
// Kernprincipes:
//  - Alleen status 'bevestigd'/'gepubliceerd' telt mee. Losse 'observatie'-
//    signalen zijn nog niet bevestigd en horen NIET in een duidingstekst.
//  - Elk signaaltype krijgt de bijbehorende methode-onderbouwing + genummerde
//    bronverwijzing (dezelfde peer-reviewed bronnen als het ontwerpdocument).
//  - Verzint niets: zonder bevestigde signalen volgt een eerlijke lege draft.
// ---------------------------------------------------------------------------

// Vaste, peer-reviewed bronnen (identiek aan het ontwerpdocument Tendensmonitoring).
const DRAFT_BRONNEN: { nr: number; tekst: string; url: string }[] = [
  { nr: 1, tekst: "Statistische procesbeheersing - regelkaarten voor gedragswetenschappelijke data. Behavior Research Methods (Springer, 2021).", url: "https://link.springer.com/article/10.3758/s13428-021-01619-0" },
  { nr: 2, tekst: "Univariate mean change point detection: penalization, CUSUM and optimality. Electronic Journal of Statistics, 14(1), 2020.", url: "https://projecteuclid.org/journals/electronic-journal-of-statistics/volume-14/issue-1/Univariate-mean-change-point-detection-Penalization-CUSUM-and-optimality/10.1214/20-EJS1710.pdf" },
  { nr: 3, tekst: "A survey of methods for time series change point detection. Knowledge and Information Systems (PMC5464762), 2017.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5464762/" },
  { nr: 4, tekst: "Longitudinal measurement invariance within a confirmatory factor analysis framework. Assessment (PMC10363935), 2022.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10363935/" },
  { nr: 6, tekst: "McDonald's omega en betrouwbaarheid - reporting reliability, convergent and discriminant validity.", url: "https://scispace.com/pdf/reporting-reliability-convergent-and-discriminant-validity-3dn13k48.pdf" },
];

// Methode-onderbouwing per signaaltype: welke techniek, welke bronnummers.
function methodeOnderbouwing(type: string): { methode: string; bronnen: number[] } {
  switch (type) {
    case "niveau":
      return {
        methode:
          "Gedetecteerd met een Shewhart-regelkaart: een waarneming buiten de " +
          "3-sigma-grens rond het referentiegemiddelde is statistisch onwaarschijnlijk " +
          "onder natuurlijke variatie en wijst op een bijzondere oorzaak.",
        bronnen: [1],
      };
    case "changepoint":
      return {
        methode:
          "Gedetecteerd en gedateerd met de CUSUM-methode (cumulatieve som): deze " +
          "lokaliseert het omslagpunt van een geleidelijke niveauverschuiving die een " +
          "losse regelkaart nog niet als uitschieter zou markeren.",
        bronnen: [2, 3],
      };
    case "proportie":
      return {
        methode:
          "Gedetecteerd met een p-kaart: de actuele proportie valt buiten de " +
          "3-sigma-grenzen die rond de baseline-proportie zijn berekend, gecorrigeerd " +
          "voor de actuele steekproefgrootte.",
        bronnen: [1],
      };
    case "structuur":
      return {
        methode:
          "Gedetecteerd via structuurdrift tegen het gevalideerde UA-ijkpunt: " +
          "factorcongruentie (Tucker phi) en interne consistentie (McDonald's omega) " +
          "worden vergeleken met de referentiewaarden uit de UA-factoranalyse.",
        bronnen: [4, 6],
      };
    default:
      return { methode: "Gedetecteerd binnen de tendensmonitoring.", bronnen: [1] };
  }
}

export interface DraftResultaat {
  titel: string;
  gegenereerdOp: string;
  aantalBevestigd: number;
  samenvatting: string;
  secties: { kop: string; alineas: string[]; bronnen: number[] }[];
  bronnenlijst: { nr: number; tekst: string; url: string }[];
  leeg: boolean;
}

export function genereerDraft(sqlite: any): DraftResultaat {
  const gegenereerdOp = new Date().toISOString();
  const titel = "Tendensen in het TaPas-platform - concept duiding";

  // Alleen BEVESTIGDE of GEPUBLICEERDE signalen tellen mee. Verzint niets.
  const rijen = (sqlite
    .prepare(
      `SELECT instrument, dimensie, sleutel, type, changepoint_datum, effectgrootte,
              richting, status, n, toelichting, gedetecteerd_op
       FROM tendens_signaal
       WHERE status IN ('bevestigd', 'gepubliceerd')
       ORDER BY dimensie ASC, gedetecteerd_op ASC`
    )
    .all() as any[]) ?? [];

  if (rijen.length === 0) {
    return {
      titel,
      gegenereerdOp,
      aantalBevestigd: 0,
      leeg: true,
      samenvatting:
        "Er zijn op dit moment geen bevestigde tendenssignalen. Losse observaties " +
        "worden pas in een duidingstekst opgenomen nadat ze zijn bevestigd. Zolang " +
        "de datadrempels niet gehaald zijn (regelkaart minimaal 8 perioden, p-kaart " +
        "minimaal 30 afnames, structuurvergelijking minimaal 300 afnames) blijft deze " +
        "concepttekst bewust leeg - er wordt niets verondersteld of verzonnen.",
      secties: [],
      bronnenlijst: [],
    };
  }

  // Groepeer per dimensie zodat de duiding thematisch gebundeld is.
  const perDimensie = new Map<string, any[]>();
  for (const r of rijen) {
    const lijst = perDimensie.get(r.dimensie) ?? [];
    lijst.push(r);
    perDimensie.set(r.dimensie, lijst);
  }

  const dimensieKop: Record<string, string> = {
    volume_maand: "Volume per maand",
    voltooiingsgraad: "Voltooiingsgraad",
    structuur_ua: "Structuurstabiliteit (UA-ijkpunt)",
  };

  const gebruikteBronnen = new Set<number>();
  const secties: DraftResultaat["secties"] = [];

  for (const dimensie of Array.from(perDimensie.keys())) {
    const lijst = perDimensie.get(dimensie) ?? [];
    const alineas: string[] = [];
    const sectieBronnen = new Set<number>();
    for (const s of lijst) {
      const ond = methodeOnderbouwing(s.type);
      ond.bronnen.forEach((b) => {
        sectieBronnen.add(b);
        gebruikteBronnen.add(b);
      });
      const cites = ond.bronnen.map((b) => `[${b}]`).join("");
      const effect =
        s.effectgrootte != null
          ? ` De geschatte effectgrootte bedraagt ${Number(s.effectgrootte).toFixed(2).replace(".", ",")}.`
          : "";
      alineas.push(`${s.toelichting} ${ond.methode}${effect} ${cites}`);
    }
    secties.push({
      kop: dimensieKop[dimensie] ?? dimensie,
      alineas,
      bronnen: Array.from(sectieBronnen).sort((a, b) => a - b),
    });
  }

  const samenvatting =
    `Deze concepttekst vat ${rijen.length} bevestigd(e) tendenssignaal/signalen samen, ` +
    `verdeeld over ${perDimensie.size} dimensie(s). Elke bevinding is gedetecteerd met een ` +
    `gevestigde statistische methode (regelkaart, CUSUM of p-kaart) en, waar van toepassing, ` +
    `afgezet tegen het extern gevalideerde UA-structuurijkpunt. De genummerde verwijzingen ` +
    `koppelen elke methode aan de onderliggende peer-reviewed bron.`;

  const bronnenlijst = DRAFT_BRONNEN.filter((b) => gebruikteBronnen.has(b.nr));

  return {
    titel,
    gegenereerdOp,
    aantalBevestigd: rijen.length,
    leeg: false,
    samenvatting,
    secties,
    bronnenlijst,
  };
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
        beschikbaar: false, fase: "0-4", baselineAanwezig: false,
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
        fase: "0-4",
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

  // POST detectie draaien (fase 2): control chart + CUSUM + p-chart +
  // structuurdrift tegen het UA-ijkpunt. Schrijft observaties weg. Verzint
  // niets — families zonder voldoende data worden eerlijk overgeslagen.
  app.post("/api/inzichtcentrum/tendensen/detectie", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const resultaat = draaiDetectie(sq);
      return res.json({ ok: true, ...resultaat });
    } catch (e) {
      console.error("[tendensen/detectie]", e);
      return res.status(500).json({ error: "Detectie mislukt." });
    }
  });

  // GET signalen: read-only lijst van gedetecteerde signalen (fase 2).
  app.get("/api/inzichtcentrum/tendensen/signalen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json({ signalen: [] });
    try {
      maakTendensTabellen(sq);
      const rijen = sq.prepare(`
        SELECT instrument, dimensie, sleutel, type, changepoint_datum, effectgrootte,
               richting, status, n, toelichting, gedetecteerd_op
        FROM tendens_signaal
        ORDER BY gedetecteerd_op DESC, id DESC
      `).all() as any[];
      return res.json({ signalen: rijen });
    } catch (e) {
      console.error("[tendensen/signalen]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // GET draft (fase 4): concept duidingstekst op basis van BEVESTIGDE signalen,
  // met methodische onderbouwing en peer-reviewed bronverwijzing. Read-only.
  // Verzint niets - zonder bevestigde signalen volgt een eerlijke lege draft.
  app.get("/api/inzichtcentrum/tendensen/draft", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      maakTendensTabellen(sq);
      return res.json(genereerDraft(sq));
    } catch (e) {
      console.error("[tendensen/draft]", e);
      return res.status(500).json({ error: "Genereren mislukt." });
    }
  });
}
