import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  maakTendensTabellen,
  berekenBaseline,
  schrijfUaIjkpunt,
  berekenControlChart,
  berekenCusum,
  berekenPChart,
  detecteerStructuurdrift,
  draaiDetectie,
  genereerDraft,
} from "../server/tendens-monitoring";

// Fase 0-1 tests — Inzichtcentrum tendensmonitoring.
// Doel: de datalaag en baseline-berekening vastleggen. We gebruiken een
// in-memory SQLite-database met een minimale `afnames`-tabel, zodat de test
// deterministisch is en NOOIT afhangt van de live data.db.

function maakTestDb(): any {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id TEXT,
      status TEXT NOT NULL DEFAULT 'gestart',
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

function voegAfnameToe(db: any, instrument: string | null, status: string, datum: string) {
  db.prepare("INSERT INTO afnames (instrument_id, status, created_at) VALUES (?, ?, ?)")
    .run(instrument, status, datum);
}

describe("tendensmonitoring fase 0 — datalaag", () => {
  it("maakt tendens_snapshot en tendens_signaal aan (idempotent)", () => {
    const db = maakTestDb();
    maakTendensTabellen(db);
    // Tweede keer mag niet falen (IF NOT EXISTS).
    maakTendensTabellen(db);

    const tabellen = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tendens_snapshot','tendens_signaal') ORDER BY name"
    ).all().map((r: any) => r.name);

    expect(tabellen).toEqual(["tendens_signaal", "tendens_snapshot"]);
  });

  it("tendens_signaal start standaard leeg", () => {
    const db = maakTestDb();
    maakTendensTabellen(db);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM tendens_signaal").get() as any).n;
    expect(n).toBe(0);
  });
});

describe("tendensmonitoring fase 1 — baseline", () => {
  beforeEach(() => {});

  it("schrijft baseline-meetpunten weg uit de afnames-data", () => {
    const db = maakTestDb();
    // 6 voltooide T4S-afnames in twee maanden (boven k-anonimiteit).
    for (let i = 0; i < 4; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-05-10");
    for (let i = 0; i < 2; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");

    const res = berekenBaseline(db);
    expect(res.meetpunten).toBeGreaterThan(0);

    // Er moet minstens een volume_instrument-, volume_maand- en voltooiingsgraad-meetpunt zijn.
    const dimensies = db.prepare(
      "SELECT DISTINCT dimensie FROM tendens_snapshot WHERE is_baseline = 1 ORDER BY dimensie"
    ).all().map((r: any) => r.dimensie);
    expect(dimensies).toContain("volume_instrument");
    expect(dimensies).toContain("volume_maand");
    expect(dimensies).toContain("voltooiingsgraad");
    // Baseline bevat ook het extern gevalideerde UA-structuurijkpunt.
    expect(dimensies).toContain("structuur_ua");
  });

  it("berekent de voltooiingsgraad als correcte base-rate", () => {
    const db = maakTestDb();
    // 8 afnames, 6 voltooid -> aandeel 0,75.
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    for (let i = 0; i < 2; i++) voegAfnameToe(db, "t4sports", "gestart", "2026-06-10");

    berekenBaseline(db);
    const rij = db.prepare(
      "SELECT n, aandeel, onderdrukt FROM tendens_snapshot WHERE dimensie = 'voltooiingsgraad' AND is_baseline = 1"
    ).get() as any;

    expect(rij.n).toBe(8);
    expect(rij.aandeel).toBeCloseTo(0.75, 5);
    expect(rij.onderdrukt).toBe(0);
  });

  it("onderdrukt kleine groepen (k-anonimiteit < 5)", () => {
    const db = maakTestDb();
    // Slechts 3 afnames van één instrument -> moet onderdrukt worden op instrumentniveau.
    for (let i = 0; i < 3; i++) voegAfnameToe(db, "t4kids", "voltooid", "2026-06-10");

    berekenBaseline(db);
    const rij = db.prepare(
      "SELECT n, aandeel, onderdrukt FROM tendens_snapshot WHERE dimensie = 'volume_instrument' AND sleutel = 't4kids' AND is_baseline = 1"
    ).get() as any;

    expect(rij.n).toBe(3);
    expect(rij.onderdrukt).toBe(1);
    // Detailwaarden onderdrukt.
    expect(rij.aandeel).toBeNull();
  });

  it("is herhaalbaar: opnieuw berekenen vervangt de baseline, dupliceert niet", () => {
    const db = maakTestDb();
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");

    berekenBaseline(db);
    const eerste = (db.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1").get() as any).n;
    berekenBaseline(db);
    const tweede = (db.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1").get() as any).n;

    expect(tweede).toBe(eerste);
  });

  it("werkt op een lege database zonder te crashen", () => {
    const db = maakTestDb();
    const res = berekenBaseline(db);
    // Geen afnames -> voltooiingsgraad-meetpunt bestaat wél (n=0), maar geen volume-rijen.
    expect(res.meetpunten).toBeGreaterThanOrEqual(1);
    const graad = db.prepare(
      "SELECT n, aandeel FROM tendens_snapshot WHERE dimensie = 'voltooiingsgraad' AND is_baseline = 1"
    ).get() as any;
    expect(graad.n).toBe(0);
    expect(graad.aandeel).toBeNull();
  });
});

describe("tendensmonitoring — UA-structuurijkpunt (extern gevalideerd)", () => {
  it("schrijft de zes gevalideerde UA-waarden weg als baseline-ijkpunt", () => {
    const db = maakTestDb();
    const aantal = schrijfUaIjkpunt(db);
    expect(aantal).toBe(6);

    const rijen = db.prepare(
      "SELECT sleutel, gemiddelde, instrument, n, onderdrukt FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).all() as any[];
    expect(rijen.length).toBe(6);
    // Alle rijen horen bij het t4sports-instrument en zijn geen steekproef (n=0).
    for (const r of rijen) {
      expect(r.instrument).toBe("t4sports");
      expect(r.n).toBe(0);
      expect(r.onderdrukt).toBe(0);
    }
  });

  it("bewaart de exacte gevalideerde referentiewaarden (geen afronding/verzinning)", () => {
    const db = maakTestDb();
    schrijfUaIjkpunt(db);
    const haal = (sleutel: string) =>
      (db.prepare("SELECT gemiddelde FROM tendens_snapshot WHERE dimensie='structuur_ua' AND sleutel=?").get(sleutel) as any)?.gemiddelde;

    expect(haal("f1_variantie")).toBeCloseTo(0.232, 3);
    expect(haal("omega_18")).toBeCloseTo(0.939, 3);
    expect(haal("omega_14_kern")).toBeCloseTo(0.946, 3);
    expect(haal("tucker_phi_f1")).toBeCloseTo(0.994, 3);
    expect(haal("tucker_phi_gem")).toBeCloseTo(0.929, 3);
    expect(haal("kmo")).toBeCloseTo(0.828, 3);
  });

  it("is idempotent: opnieuw schrijven dupliceert het ijkpunt niet", () => {
    const db = maakTestDb();
    schrijfUaIjkpunt(db);
    schrijfUaIjkpunt(db);
    const n = (db.prepare(
      "SELECT COUNT(*) AS n FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).get() as any).n;
    expect(n).toBe(6);
  });

  it("baseline-run neemt het ijkpunt mee", () => {
    const db = maakTestDb();
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    berekenBaseline(db);
    const n = (db.prepare(
      "SELECT COUNT(*) AS n FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).get() as any).n;
    expect(n).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Fase 2 — Detectiemotor: zuivere statistische functies.
// Deterministische reeksen; geen afhankelijkheid van live data.
// ---------------------------------------------------------------------------
describe("fase 2 — control chart (Shewhart 3-sigma)", () => {
  it("rapporteert onvoldoende data onder de minimumdrempel", () => {
    const r = berekenControlChart([5, 6, 7]);
    expect(r.voldoendeData).toBe(false);
    expect(r.uitschieters).toHaveLength(0);
  });

  it("vindt geen uitschieter in een stabiele reeks", () => {
    const r = berekenControlChart([10, 11, 9, 10, 12, 8, 10, 11, 9, 10]);
    expect(r.voldoendeData).toBe(true);
    expect(r.uitschieters).toHaveLength(0);
  });

  it("detecteert een duidelijke uitschieter boven de 3-sigma-grens", () => {
    // Lange stabiele reeks rond 10 met één piek. Voldoende stabiele punten zodat
    // de piek de sd niet zelf domineert (Shewhart is anders self-masking).
    const reeks = [10, 10, 11, 9, 10, 10, 11, 9, 10, 10, 10, 11, 9, 10, 10, 11, 9, 10, 10, 30];
    const r = berekenControlChart(reeks);
    expect(r.voldoendeData).toBe(true);
    const boven = r.uitschieters.find((u) => u.richting === "boven");
    expect(boven).toBeDefined();
    expect(boven!.waarde).toBe(30);
  });

  it("geeft geen uitschieter bij nul variatie (sd=0)", () => {
    const r = berekenControlChart([7, 7, 7, 7, 7, 7, 7, 7]);
    expect(r.voldoendeData).toBe(true);
    expect(r.sd).toBe(0);
    expect(r.uitschieters).toHaveLength(0);
  });
});

describe("fase 2 — CUSUM changepoint", () => {
  it("rapporteert onvoldoende data onder de minimumdrempel", () => {
    const r = berekenCusum([1, 2, 3]);
    expect(r.voldoendeData).toBe(false);
    expect(r.changepointIndex).toBeNull();
  });

  it("vindt geen changepoint in een stabiele reeks", () => {
    const r = berekenCusum([10, 11, 9, 10, 12, 8, 10, 11, 9, 10]);
    expect(r.voldoendeData).toBe(true);
    expect(r.changepointIndex).toBeNull();
  });

  it("detecteert een aanhoudende niveauverschuiving (changepoint)", () => {
    // Lange stabiele run gevolgd door een aanhoudend hoger niveau. De CUSUM
    // gebruikt het globale gemiddelde als referentie; de richting hangt af van
    // welke zijde de beslissingsgrens (5 sigma) als eerste overschrijdt — we
    // toetsen dus enkel DÁT er een changepoint is, niet de exacte richting.
    const reeks = [...Array(20).fill(10), ...Array(10).fill(20)];
    const r = berekenCusum(reeks);
    expect(r.voldoendeData).toBe(true);
    expect(r.changepointIndex).not.toBeNull();
    expect(["stijging", "daling"]).toContain(r.richting);
  });
});

describe("fase 2 — p-chart (proporties)", () => {
  it("rapporteert onvoldoende data onder de minimum-n", () => {
    const r = berekenPChart(0.7, 0.4, 10);
    expect(r.voldoendeData).toBe(false);
    expect(r.buitenGrens).toBe(false);
  });

  it("signaleert een proportie ver onder de baseline", () => {
    const r = berekenPChart(0.7, 0.2, 200);
    expect(r.voldoendeData).toBe(true);
    expect(r.buitenGrens).toBe(true);
    expect(r.richting).toBe("onder");
  });

  it("signaleert niets als de proportie binnen de grenzen valt", () => {
    const r = berekenPChart(0.7, 0.71, 200);
    expect(r.voldoendeData).toBe(true);
    expect(r.buitenGrens).toBe(false);
  });
});

describe("fase 2 — structuurdrift tegen UA-ijkpunt", () => {
  it("geen drift wanneer phi het ijkpunt benadert", () => {
    const r = detecteerStructuurdrift("tucker_phi_f1", 0.994, 0.99);
    expect(r.drift).toBe(false);
  });

  it("drift wanneer phi onder de drempel 0,85 zakt", () => {
    const r = detecteerStructuurdrift("tucker_phi_f1", 0.994, 0.80);
    expect(r.drift).toBe(true);
  });

  it("drift wanneer omega meer dan 10% onder het ijkpunt zakt", () => {
    const r = detecteerStructuurdrift("omega_18", 0.939, 0.80);
    expect(r.drift).toBe(true);
  });

  it("geen drift bij een kleine omega-daling binnen de marge", () => {
    const r = detecteerStructuurdrift("omega_18", 0.939, 0.92);
    expect(r.drift).toBe(false);
  });
});

describe("fase 2 — orchestrator draaiDetectie (geen verzinning)", () => {
  it("slaat alle families eerlijk over bij weinig data en schrijft geen signaal", () => {
    const db = maakTestDb();
    // Slechts een handvol afnames in één maand: onder alle drempels.
    for (let i = 0; i < 10; i++) voegAfnameToe(db, "t4sports", i < 7 ? "voltooid" : "gestart", "2026-07-05");
    berekenBaseline(db);
    const s = draaiDetectie(db);
    expect(s.onderzocht).toContain("volume_maand");
    expect(s.onderzocht).toContain("voltooiingsgraad");
    expect(s.onderzocht).toContain("structuur_ua");
    expect(s.signalen).toBe(0);
    // Elke familie moet een expliciete overslag-reden hebben.
    expect(s.overgeslagen.length).toBeGreaterThanOrEqual(3);
    const sig = (db.prepare("SELECT COUNT(*) AS n FROM tendens_signaal").get() as any).n;
    expect(sig).toBe(0);
  });

  it("detecteert een volume-uitschieter over meerdere maanden en schrijft observatie weg", () => {
    const db = maakTestDb();
    // 11 stabiele maanden à 10 afnames + 1 piekmaand à 35 afnames. Genoeg
    // stabiele perioden zodat de piek buiten de 3-sigma-grens valt.
    const maanden = [
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    ];
    for (const m of maanden) {
      for (let i = 0; i < 10; i++) voegAfnameToe(db, "t4sports", "voltooid", `${m}-10`);
    }
    // Piekmaand: 35 afnames.
    for (let i = 0; i < 35; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    berekenBaseline(db);
    const s = draaiDetectie(db);
    expect(s.signalen).toBeGreaterThanOrEqual(1);
    const rijen = db.prepare(
      "SELECT dimensie, type, status FROM tendens_signaal WHERE dimensie = 'volume_maand'"
    ).all() as any[];
    expect(rijen.length).toBeGreaterThanOrEqual(1);
    expect(rijen.every((r) => r.status === "observatie")).toBe(true);
  });

  it("is idempotent: observaties worden niet gedupliceerd bij herdetectie", () => {
    const db = maakTestDb();
    const maanden = [
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    ];
    for (const m of maanden) {
      for (let i = 0; i < 10; i++) voegAfnameToe(db, "t4sports", "voltooid", `${m}-10`);
    }
    for (let i = 0; i < 35; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    berekenBaseline(db);
    draaiDetectie(db);
    const na1 = (db.prepare("SELECT COUNT(*) AS n FROM tendens_signaal WHERE status='observatie'").get() as any).n;
    draaiDetectie(db);
    const na2 = (db.prepare("SELECT COUNT(*) AS n FROM tendens_signaal WHERE status='observatie'").get() as any).n;
    expect(na2).toBe(na1);
  });
});

// ---------------------------------------------------------------------------
// Fase 4 - draft-generator (wetenschappelijke duiding). We toetsen dat de
// generator UITSLUITEND bevestigde signalen gebruikt, de juiste methode +
// bronverwijzing per type koppelt, en eerlijk leeg blijft zonder bevestiging.
// ---------------------------------------------------------------------------
function voegSignaalToe(
  db: any,
  opts: { dimensie: string; type: string; status: string; toelichting: string; effectgrootte?: number | null; richting?: string | null }
) {
  db.prepare(
    `INSERT INTO tendens_signaal (instrument, dimensie, sleutel, type, changepoint_datum, effectgrootte, richting, status, n, toelichting, gedetecteerd_op)
     VALUES ('platform', @dimensie, '', @type, NULL, @effectgrootte, @richting, @status, 10, @toelichting, datetime('now'))`
  ).run({
    dimensie: opts.dimensie,
    type: opts.type,
    status: opts.status,
    toelichting: opts.toelichting,
    effectgrootte: opts.effectgrootte ?? null,
    richting: opts.richting ?? null,
  });
}

describe("fase 4 - draft-generator (wetenschappelijke duiding)", () => {
  let db: any;
  beforeEach(() => {
    db = maakTestDb();
    maakTendensTabellen(db);
  });

  it("geeft een eerlijke lege draft zonder bevestigde signalen", () => {
    // Alleen een observatie (niet bevestigd) mag NIET meetellen.
    voegSignaalToe(db, { dimensie: "volume_maand", type: "niveau", status: "observatie", toelichting: "x" });
    const draft = genereerDraft(db);
    expect(draft.leeg).toBe(true);
    expect(draft.aantalBevestigd).toBe(0);
    expect(draft.secties.length).toBe(0);
    expect(draft.bronnenlijst.length).toBe(0);
    expect(draft.samenvatting).toContain("geen bevestigde");
  });

  it("neemt een bevestigd niveau-signaal op met regelkaart-methode en bron [1]", () => {
    voegSignaalToe(db, {
      dimensie: "volume_maand", type: "niveau", status: "bevestigd",
      toelichting: "Volume 30 valt buiten de 3-sigma-grens.", effectgrootte: 4.2,
    });
    const draft = genereerDraft(db);
    expect(draft.leeg).toBe(false);
    expect(draft.aantalBevestigd).toBe(1);
    expect(draft.secties.length).toBe(1);
    expect(draft.secties[0].kop).toBe("Volume per maand");
    const tekst = draft.secties[0].alineas.join(" ");
    expect(tekst).toContain("Shewhart-regelkaart");
    expect(tekst).toContain("[1]");
    // effectgrootte met komma-decimaal
    expect(tekst).toContain("4,20");
    expect(draft.bronnenlijst.some((b) => b.nr === 1)).toBe(true);
  });

  it("koppelt een changepoint-signaal aan CUSUM en bronnen [2][3]", () => {
    voegSignaalToe(db, {
      dimensie: "volume_maand", type: "changepoint", status: "bevestigd",
      toelichting: "CUSUM detecteert een stijging.", richting: "stijging",
    });
    const draft = genereerDraft(db);
    const tekst = draft.secties[0].alineas.join(" ");
    expect(tekst).toContain("CUSUM");
    expect(tekst).toContain("[2][3]");
    expect(draft.bronnenlijst.map((b) => b.nr).sort()).toEqual([2, 3]);
  });

  it("telt alleen bevestigde signalen, niet observaties", () => {
    voegSignaalToe(db, { dimensie: "volume_maand", type: "niveau", status: "bevestigd", toelichting: "a" });
    voegSignaalToe(db, { dimensie: "volume_maand", type: "niveau", status: "observatie", toelichting: "b" });
    voegSignaalToe(db, { dimensie: "voltooiingsgraad", type: "proportie", status: "gepubliceerd", toelichting: "c" });
    const draft = genereerDraft(db);
    expect(draft.aantalBevestigd).toBe(2);
    // twee dimensies met bevestigde/gepubliceerde signalen
    expect(draft.secties.length).toBe(2);
  });

  it("neemt alleen daadwerkelijk gebruikte bronnen op in de bronnenlijst", () => {
    voegSignaalToe(db, { dimensie: "voltooiingsgraad", type: "proportie", status: "bevestigd", toelichting: "p" });
    const draft = genereerDraft(db);
    // proportie gebruikt enkel bron [1]
    expect(draft.bronnenlijst.map((b) => b.nr)).toEqual([1]);
  });
});
