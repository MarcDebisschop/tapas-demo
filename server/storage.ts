import {
  afnames,
  billerEntiteiten,
  organisaties,
  creditSaldi,
  creditTransacties,
  betalingen,
  facturen,
  rapporten,
  creditnotas,
  deelnemers,
  chatBerichten,
  licenties,
  sessies,
  sessieDeelnemers,
  sessieStudies,
  beheerders,
  toegangen,
  tarieven,
} from '@shared/schema';
import type {
  Afname,
  BillerEntiteit,
  InsertBiller,
  Organisatie,
  InsertOrganisatie,
  CreditSaldo,
  CreditTransactie,
  Betaling,
  Factuur,
  Rapport,
  Creditnota,
  Deelnemer,
  UpdateDeelnemer,
  ChatBericht,
  Licentie,
  Sessie,
  SessieDeelnemer,
  SessieStudie,
  SessieRol,
  Beheerder,
  InsertBeheerder,
  Toegang,
  Tarief,
  ZetTarief,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import { eq, desc, and } from "drizzle-orm";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { bouwRapportInhoud, renderRapportHtml } from "./rapportgenerator";

// -----------------------------------------------------------------------------
// Database-pad: ROBUUST oplossen.
//
// De bug die het lege/404-profiel veroorzaakte: `new Database("data.db")` opent
// het bestand RELATIEF t.o.v. de werkmap waarin het proces start. Lokaal is dat
// de projectroot (werkt), maar in de gepubliceerde sandbox kan de werkmap anders
// zijn — dan maakte SQLite een VERSE, LEGE database aan en gaf elk token 404.
//
// We zoeken daarom de bestaande `data.db` op een paar bekende locaties en kiezen
// de eerste die bestaat. Bestaat er nog geen, dan ankeren we het bestand in de
// projectroot (één niveau boven de gebundelde `dist/`), zodat de publish-snapshot
// hem altijd terugvindt.
// -----------------------------------------------------------------------------
function vindDatabasePad(): string {
  // Expliciete override wint altijd (ook als het bestand nog niet bestaat).
  if (process.env.TAPAS_DB_PATH) return resolve(process.env.TAPAS_DB_PATH);

  // __dirname wijst in de CommonJS-bundle naar de map van dist/index.cjs (= dist/).
  const distDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const projectRoot = resolve(distDir, ".."); // projectroot = boven dist/
  const kandidaten = [
    resolve(projectRoot, "data.db"),           // projectroot (publish-snapshot) — eerst
    resolve(process.cwd(), "data.db"),         // werkmap (lokale dev)
    resolve(distDir, "data.db"),               // naast de bundle (vangnet)
  ].filter(Boolean) as string[];

  for (const p of kandidaten) {
    if (existsSync(p)) return p;
  }
  // Niets gevonden: anker in de projectroot zodat de snapshot werkt.
  return resolve(projectRoot, "data.db");
}

const DB_PAD = vindDatabasePad();
// Zichtbaar in de serverlogs zodat we altijd weten welk bestand gebruikt wordt.
console.log(`[tapas] SQLite database: ${DB_PAD}`);

const sqlite = new Database(DB_PAD);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);
export { sqlite }; // Directe export voor modules die raw SQLite nodig hebben

// Genereert een korte, onraadbare, URL-veilige tekenreeks voor toegangstokens.
function cryptoRandom(len: number): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

// Zorg dat de tabellen bestaan (geen aparte migratiestap nodig in dit prototype).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS afnames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organisatie_id INTEGER,
    respondent_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    company TEXT,
    role TEXT,
    consent_given INTEGER NOT NULL DEFAULT 0,
    consent_scope TEXT,
    consent_timestamp TEXT,
    baseline_energy INTEGER NOT NULL DEFAULT 5,
    taal TEXT NOT NULL DEFAULT 'nl',
    status TEXT NOT NULL DEFAULT 'consent',
    main_responses TEXT,
    connection_answers TEXT,
    generator_contract TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS biller_entiteiten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    vennootschapsnaam TEXT NOT NULL,
    adres TEXT,
    postcode TEXT,
    gemeente TEXT,
    land TEXT NOT NULL DEFAULT 'België',
    btw_nummer TEXT,
    kbo_nummer TEXT,
    peppol_id TEXT,
    iban TEXT,
    logo TEXT,
    factuur_prefix TEXT NOT NULL DEFAULT 'INV',
    btw_tarief INTEGER NOT NULL DEFAULT 21,
    geldig_van TEXT NOT NULL,
    geldig_tot TEXT,
    actief INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS organisaties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bedrijf',
    btw_nummer TEXT,
    kbo_nummer TEXT,
    peppol_id TEXT,
    peppol_bereikbaar INTEGER NOT NULL DEFAULT 0,
    factuur_type TEXT NOT NULL DEFAULT 'pdf',
    contactpersoon TEXT,
    email TEXT,
    adres TEXT,
    postcode TEXT,
    gemeente TEXT,
    land TEXT NOT NULL DEFAULT 'België',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_saldi (
    organisatie_id INTEGER PRIMARY KEY,
    beschikbaar INTEGER NOT NULL DEFAULT 0,
    gereserveerd INTEGER NOT NULL DEFAULT 0,
    verbruikt INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_transacties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organisatie_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    aantal INTEGER NOT NULL,
    afname_id INTEGER,
    biller_entiteit_id INTEGER,
    omschrijving TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS betalingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organisatie_id INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'mollie',
    provider_ref TEXT,
    methode TEXT,
    pakket_id TEXT,
    credits INTEGER NOT NULL,
    bedrag_excl_btw_cent INTEGER NOT NULL,
    btw_tarief INTEGER NOT NULL DEFAULT 21,
    btw_bedrag_cent INTEGER NOT NULL,
    bedrag_incl_btw_cent INTEGER NOT NULL,
    munt TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'open',
    credit_transactie_id INTEGER,
    factuur_id INTEGER,
    checkout_url TEXT,
    created_at TEXT NOT NULL,
    betaald_at TEXT
  );

  CREATE TABLE IF NOT EXISTS facturen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factuurnummer TEXT NOT NULL UNIQUE,
    biller_entiteit_id INTEGER NOT NULL,
    organisatie_id INTEGER NOT NULL,
    betaling_id INTEGER,
    biller_snapshot TEXT NOT NULL,
    klant_snapshot TEXT NOT NULL,
    regels TEXT NOT NULL,
    bedrag_excl_btw_cent INTEGER NOT NULL,
    btw_bedrag_cent INTEGER NOT NULL,
    bedrag_incl_btw_cent INTEGER NOT NULL,
    munt TEXT NOT NULL DEFAULT 'EUR',
    kanaal TEXT NOT NULL DEFAULT 'pdf',
    peppol_status TEXT NOT NULL DEFAULT 'n.v.t.',
    peppol_document TEXT,
    factuurdatum TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rapporten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    afname_id INTEGER NOT NULL,
    variant TEXT NOT NULL DEFAULT 'kompas',
    titel TEXT NOT NULL,
    inhoud TEXT NOT NULL,
    html TEXT NOT NULL,
    pdf_base64 TEXT,
    contract_versie TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS creditnotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creditnotanummer TEXT NOT NULL UNIQUE,
    factuur_id INTEGER NOT NULL,
    biller_entiteit_id INTEGER NOT NULL,
    organisatie_id INTEGER NOT NULL,
    reden TEXT,
    biller_snapshot TEXT NOT NULL,
    klant_snapshot TEXT NOT NULL,
    regels TEXT NOT NULL,
    bedrag_excl_btw_cent INTEGER NOT NULL,
    btw_bedrag_cent INTEGER NOT NULL,
    bedrag_incl_btw_cent INTEGER NOT NULL,
    munt TEXT NOT NULL DEFAULT 'EUR',
    kanaal TEXT NOT NULL DEFAULT 'pdf',
    peppol_status TEXT NOT NULL DEFAULT 'n.v.t.',
    peppol_document TEXT,
    credits_teruggeboekt INTEGER NOT NULL DEFAULT 0,
    creditnota_datum TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deelnemers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    naam TEXT,
    foto_url TEXT,
    taal TEXT NOT NULL DEFAULT 'nl',
    dashboard_token TEXT NOT NULL UNIQUE,
    mail_cadans TEXT NOT NULL DEFAULT 'uit',
    mail_uitgeschreven_at TEXT,
    vragen_gebruikt INTEGER NOT NULL DEFAULT 0,
    vragen_tegoed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_berichten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deelnemer_id INTEGER NOT NULL,
    rol TEXT NOT NULL,
    inhoud TEXT NOT NULL,
    veiligheid TEXT,
    created_at TEXT NOT NULL
  );

  -- T4Recruitment — Fase 2: collaboratief instrument.
  CREATE TABLE IF NOT EXISTS licenties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleutel TEXT NOT NULL UNIQUE,
    klantnaam TEXT NOT NULL,
    klant_email TEXT,
    max_profielen INTEGER,
    prijs_per_profiel_cent INTEGER NOT NULL DEFAULT 0,
    munt TEXT NOT NULL DEFAULT 'EUR',
    gebruikte_profielen INTEGER NOT NULL DEFAULT 0,
    geldig_van TEXT NOT NULL,
    geldig_tot TEXT,
    status TEXT NOT NULL DEFAULT 'actief',
    notities TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id TEXT NOT NULL DEFAULT 't4recruitment',
    organisatie_id INTEGER,
    licentie_id INTEGER,
    titel TEXT NOT NULL,
    facilitator_naam TEXT,
    facilitator_email TEXT,
    taal TEXT NOT NULL DEFAULT 'nl',
    status TEXT NOT NULL DEFAULT 'draft',
    kring_vergrendeld INTEGER NOT NULL DEFAULT 0,
    heropeningen INTEGER NOT NULL DEFAULT 0,
    sessie_state TEXT,
    rolprofiel_contract TEXT,
    created_at TEXT NOT NULL,
    vergrendeld_at TEXT,
    gefinaliseerd_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessie_deelnemers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    rol TEXT NOT NULL DEFAULT 'stakeholder',
    naam TEXT,
    email TEXT,
    invite_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'uitgenodigd',
    individuele_input TEXT,
    uitgenodigd_at TEXT,
    toegetreden_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessie_studies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    kandidaat_label TEXT NOT NULL,
    studie_contract TEXT,
    created_at TEXT NOT NULL
  );

  -- Toegang & accreditatie (governance).
  CREATE TABLE IF NOT EXISTS beheerders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    organisatie TEXT NOT NULL DEFAULT 'TaPasCity',
    is_prior INTEGER NOT NULL DEFAULT 0,
    toegevoegd_door TEXT,
    actief INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS toegangen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beheerder_id INTEGER NOT NULL,
    platformdeel TEXT NOT NULL,
    toegestaan INTEGER NOT NULL DEFAULT 0,
    gewijzigd_door TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(beheerder_id, platformdeel)
  );

  CREATE TABLE IF NOT EXISTS tarieven (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id TEXT NOT NULL UNIQUE,
    naam TEXT NOT NULL,
    omschrijving TEXT NOT NULL DEFAULT '',
    flow_type TEXT NOT NULL DEFAULT 'individual',
    model TEXT NOT NULL DEFAULT 'per-stuk',
    credit_cost INTEGER NOT NULL DEFAULT 1,
    bundel_grootte INTEGER,
    bundel_credits INTEGER,
    is_custom INTEGER NOT NULL DEFAULT 0,
    gewijzigd_door TEXT,
    updated_at TEXT NOT NULL
  );
`);

// Migratie voor bestaande databases: chat-tegoeden op deelnemers (Fase 2).
try {
  const cols = sqlite.prepare(`PRAGMA table_info(deelnemers)`).all() as Array<{ name: string }>;
  const heeft = (n: string) => cols.some((c) => c.name === n);
  const add = (sql: string) => { try { sqlite.exec(sql); } catch { /* bestaat al */ } };
  if (!heeft("vragen_gebruikt")) add(`ALTER TABLE deelnemers ADD COLUMN vragen_gebruikt INTEGER NOT NULL DEFAULT 0;`);
  if (!heeft("vragen_tegoed")) add(`ALTER TABLE deelnemers ADD COLUMN vragen_tegoed INTEGER NOT NULL DEFAULT 0;`);
  // Uitleg-tegoeden (gesproken profieluitleg, deelnemer + coach-toon).
  if (!heeft("uitleg_gebruikt_deelnemer")) add(`ALTER TABLE deelnemers ADD COLUMN uitleg_gebruikt_deelnemer INTEGER NOT NULL DEFAULT 0;`);
  if (!heeft("uitleg_tegoed_deelnemer")) add(`ALTER TABLE deelnemers ADD COLUMN uitleg_tegoed_deelnemer INTEGER NOT NULL DEFAULT 0;`);
  if (!heeft("uitleg_gebruikt_coach")) add(`ALTER TABLE deelnemers ADD COLUMN uitleg_gebruikt_coach INTEGER NOT NULL DEFAULT 0;`);
  if (!heeft("uitleg_tegoed_coach")) add(`ALTER TABLE deelnemers ADD COLUMN uitleg_tegoed_coach INTEGER NOT NULL DEFAULT 0;`);
} catch {
  // negeerbaar in nieuwe databases
}

// Migratie voor bestaande databases: voeg GDPR-kolommen toe aan afnames.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(afnames)`).all() as Array<{ name: string }>;
  const heeft = (n: string) => cols.some((c) => c.name === n);
  const add = (sql: string) => { try { sqlite.exec(sql); } catch { /* bestaat al */ } };
  if (!heeft("verwerkingsdoel")) add(`ALTER TABLE afnames ADD COLUMN verwerkingsdoel TEXT;`);
  if (!heeft("rechtsgrond")) add(`ALTER TABLE afnames ADD COLUMN rechtsgrond TEXT NOT NULL DEFAULT 'toestemming';`);
  if (!heeft("privacyverklaring_versie")) add(`ALTER TABLE afnames ADD COLUMN privacyverklaring_versie TEXT;`);
  if (!heeft("consent_ip")) add(`ALTER TABLE afnames ADD COLUMN consent_ip TEXT;`);
  if (!heeft("consent_user_agent")) add(`ALTER TABLE afnames ADD COLUMN consent_user_agent TEXT;`);
  if (!heeft("bewaartot_datum")) add(`ALTER TABLE afnames ADD COLUMN bewaartot_datum TEXT;`);
  if (!heeft("geanonimiseerd_at")) add(`ALTER TABLE afnames ADD COLUMN geanonimiseerd_at TEXT;`);
  if (!heeft("consent_ingetrokken_at")) add(`ALTER TABLE afnames ADD COLUMN consent_ingetrokken_at TEXT;`);
  // Fase D — deelnemerslink / uitnodiging.
  if (!heeft("invite_token")) add(`ALTER TABLE afnames ADD COLUMN invite_token TEXT;`);
  if (!heeft("uitgenodigd_at")) add(`ALTER TABLE afnames ADD COLUMN uitgenodigd_at TEXT;`);
  if (!heeft("herinnerd_at")) add(`ALTER TABLE afnames ADD COLUMN herinnerd_at TEXT;`);
  // Fase E — afname-taal.
  if (!heeft("taal")) add(`ALTER TABLE afnames ADD COLUMN taal TEXT NOT NULL DEFAULT 'nl';`);
  // TaPas Persoonlijk Fase 1 — koppeling naar deelnemer via e-mail.
  if (!heeft("deelnemer_email")) add(`ALTER TABLE afnames ADD COLUMN deelnemer_email TEXT;`);
} catch {
  // negeerbaar in nieuwe databases
}

// Migratie voor bestaande databases: optioneel echt PDF-document op rapporten.
// Wanneer pdf_base64 gevuld is wordt dat definitieve document getoond/gedownload
// i.p.v. de gegenereerde HTML — zo toont een T4P Business Kompas met een echt
// document altijd dat document.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(rapporten)`).all() as Array<{ name: string }>;
  const heeft = (n: string) => cols.some((c) => c.name === n);
  const add = (sql: string) => { try { sqlite.exec(sql); } catch { /* bestaat al */ } };
  if (!heeft("pdf_base64")) add(`ALTER TABLE rapporten ADD COLUMN pdf_base64 TEXT;`);
} catch {
  // negeerbaar in nieuwe databases
}

// Migratie voor bestaande Fase B-databases: voeg organisatie_id toe indien afwezig.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(afnames)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "organisatie_id")) {
    sqlite.exec(`ALTER TABLE afnames ADD COLUMN organisatie_id INTEGER;`);
  }
} catch {
  // negeerbaar in nieuwe databases
}

// ---------------------------------------------------------------------------
// Seeding: 2BQ CONSULT als actieve biller. 2BQ CONSULT is de juridische
// entiteit achter het merk TaPasCity. Bij het PMV-traject wordt later een
// nieuwe biller geactiveerd; deze blijft bestaan voor historische facturen.
// ---------------------------------------------------------------------------
function seedBiller() {
  const bestaat = db.select().from(billerEntiteiten).limit(1).all();
  if (bestaat.length > 0) return;
  const kbo = "0810464001"; // BE0810.464.001 zonder punten/prefix
  db.insert(billerEntiteiten).values({
    naam: "2BQ CONSULT",
    vennootschapsnaam: "2BQ CONSULT",
    adres: "Zandstraat 85",
    postcode: "2110",
    gemeente: "Wijnegem",
    land: "België",
    btwNummer: "BE0810.464.001",
    kboNummer: kbo,
    // Belgisch Peppol-ID = 0208: + 10-cijferig KBO-nummer.
    peppolId: `0208:${kbo}`,
    iban: null,
    logo: null,
    factuurPrefix: "2BQ",
    btwTarief: 21,
    geldigVan: new Date().toISOString(),
    geldigTot: null,
    actief: true,
    createdAt: new Date().toISOString(),
  }).run();
}
seedBiller();

// ---------------------------------------------------------------------------
// Showcase-profiel (Marc Debisschop) idempotent seeden.
//
// ACHTERGROND: bij publicatie wordt `data.db` uit de VORIGE gepubliceerde
// sandbox overgenomen — niet uit deze workspace. Daardoor kwam het lokaal
// ingevoerde showcase-profiel nooit in productie terecht en gaf de profiel-API
// op de live site 404 (leeg/donker scherm). We borgen het profiel daarom via
// een meegeleverd seed-bestand: bestaat het token nog niet, dan plaatsen we de
// deelnemer + organisatie + voltooide afname + rapporten terug. Volledig
// idempotent: bij een herstart of herpublicatie verandert er niets als het al
// bestaat.
// ---------------------------------------------------------------------------
// Houdt het showcase-profiel altijd op een schone democtoestand: lege chat en
// volle vragenquota. Draait idempotent bij elke serverstart, ook als het
// profiel al bestaat (de publish-snapshot kan een 'gebruikte' staat meedragen).
function verversShowcase(deelnemerId: number) {
  try {
    sqlite.prepare("DELETE FROM chat_berichten WHERE deelnemer_id = ?").run(deelnemerId);
    sqlite
      .prepare(
        "UPDATE deelnemers SET vragen_gebruikt = 0, vragen_tegoed = 25, " +
          "uitleg_gebruikt_deelnemer = 0, uitleg_gebruikt_coach = 0 WHERE id = ?",
      )
      .run(deelnemerId);
    console.log("[tapas] Showcase-profiel teruggezet op schone demostaat.");
  } catch (e) {
    console.warn("[tapas] Showcase verversen overgeslagen:", e);
  }
}

function laadShowcaseSeed():
  | {
      deelnemer: Record<string, unknown>;
      afname: Record<string, unknown>;
      rapporten: Array<Record<string, unknown>>;
      organisatie: Record<string, unknown> | null;
    }
  | null {
  const kandidaten = [
    resolve(process.cwd(), "server", "data", "showcase-seed.json"),
    resolve(process.cwd(), "data", "showcase-seed.json"),
    typeof __dirname !== "undefined"
      ? resolve(__dirname, "..", "server", "data", "showcase-seed.json")
      : "",
    typeof __dirname !== "undefined"
      ? resolve(__dirname, "data", "showcase-seed.json")
      : "",
  ].filter(Boolean) as string[];
  const pad = kandidaten.find((p) => existsSync(p));
  if (!pad) {
    console.warn("[tapas] showcase-seed.json niet gevonden.");
    return null;
  }
  return JSON.parse(readFileSync(pad, "utf8"));
}

// Synchroniseert de profielinhoud (generator_contract + rapporten) van een
// BESTAANDE showcase-deelnemer met het seed-bestand. Nodig omdat de publish-
// snapshot een oude data.db meedraagt: zonder deze sync zouden gecorrigeerde
// profielwaarden nooit live komen. Volledig idempotent.
function syncShowcaseInhoud(afnameId: number, deelnemerId?: number) {
  try {
    const seed = laadShowcaseSeed();
    if (!seed) return;
    const contract = (seed.afname as any)?.generator_contract;
    if (typeof contract === "string") {
      sqlite
        .prepare("UPDATE afnames SET generator_contract = ? WHERE id = ?")
        .run(contract, afnameId);
    }
    // Profielfoto van de showcase-deelnemer altijd vanuit het seed-bestand zetten,
    // zodat een bijgewerkte foto ook na een publish-snapshot of cold-start zichtbaar is.
    if (deelnemerId != null) {
      const seedFoto = (seed.deelnemer as any)?.foto_url;
      if (typeof seedFoto === "string" && seedFoto.length > 0) {
        // Foto altijd overschrijven vanuit seed, zodat een bijgewerkte profielfoto
        // ook na een publish-snapshot of cold-start zichtbaar is.
        sqlite
          .prepare("UPDATE deelnemers SET foto_url = ? WHERE id = ?")
          .run(seedFoto, deelnemerId);
      }
    }
    // Detecteer of de rapporten-tabel het optionele pdf_base64-veld heeft, zodat
    // de sync ook een echt PDF-document meeneemt/behoudt na een publish-snapshot.
    const heeftPdfKolom = (
      sqlite.prepare(`PRAGMA table_info(rapporten)`).all() as Array<{ name: string }>
    ).some((c) => c.name === "pdf_base64");
    for (const r of seed.rapporten) {
      const rid = (r as any).id;
      if (rid == null) continue;
      if (heeftPdfKolom) {
        sqlite
          .prepare(
            "UPDATE rapporten SET inhoud = ?, html = ?, titel = ?, pdf_base64 = ? WHERE id = ?",
          )
          .run(
            (r as any).inhoud,
            (r as any).html,
            (r as any).titel,
            (r as any).pdf_base64 ?? null,
            rid,
          );
      } else {
        sqlite
          .prepare("UPDATE rapporten SET inhoud = ?, html = ?, titel = ? WHERE id = ?")
          .run((r as any).inhoud, (r as any).html, (r as any).titel, rid);
      }
    }
    console.log("[tapas] Showcase-profielinhoud gesynchroniseerd met seed.");
  } catch (e) {
    console.warn("[tapas] Showcase-inhoud sync overgeslagen:", e);
  }
}

function seedShowcase() {
  try {
    const TOKEN = "MarcDebisschopShowcaseT4P01";
    const SHOWCASE_EMAIL = "marc@tapascity.com";
    let reeds = sqlite
      .prepare("SELECT id FROM deelnemers WHERE dashboard_token = ?")
      .get(TOKEN) as { id: number } | undefined;
    if (!reeds) {
      // Controleer of er al een deelnemer bestaat met hetzelfde e-mailadres maar
      // een ander token (bv. xPLdpvGr9fpav4SDH17vHAjzlz0QAA op Render).
      // Zo ja: corrigeer het token naar de showcase-waarde zodat de login
      // altijd naar het showcase-profiel leidt.
      const perEmail = sqlite
        .prepare("SELECT id FROM deelnemers WHERE email = ?")
        .get(SHOWCASE_EMAIL) as { id: number } | undefined;
      if (perEmail) {
        sqlite
          .prepare("UPDATE deelnemers SET dashboard_token = ? WHERE id = ?")
          .run(TOKEN, perEmail.id);
        console.log("[tapas] Showcase-token gecorrigeerd voor bestaand e-mailrecord.");
        reeds = perEmail;
      }
    }
    if (reeds) {
      verversShowcase(reeds.id); // bestaat al — chat/quota schoonmaken
      // Koppel alle afnames die nog aan een oud e-mailadres hangen aan het
      // correcte showcase-adres, zodat listAfnamesVoorDeelnemer ze vindt.
      const OUD_EMAILS = ["marc.debisschop@hatch-coaching.be"];
      for (const oudEmail of OUD_EMAILS) {
        const gelinkt = sqlite
          .prepare("SELECT COUNT(*) as n FROM afnames WHERE email = ?")
          .get(oudEmail) as { n: number };
        if (gelinkt.n > 0) {
          sqlite
            .prepare("UPDATE afnames SET email = ? WHERE email = ?")
            .run(SHOWCASE_EMAIL, oudEmail);
          console.log(`[tapas] Afnames van ${oudEmail} hergekoppeld aan ${SHOWCASE_EMAIL}.`);
        }
      }
      // En de profielinhoud opnieuw uit het seed-bestand zetten, zodat
      // gecorrigeerde waarden ook na een publish-snapshot live komen.
      const afnameId =
        (sqlite
          .prepare("SELECT id FROM afnames WHERE respondent_code = ? LIMIT 1")
          .get("MD-2026-001") as { id: number } | undefined)?.id ?? null;
      if (afnameId != null) syncShowcaseInhoud(afnameId, reeds.id);
      return;
    }

    const seed = laadShowcaseSeed();
    if (!seed) {
      console.warn("[tapas] showcase-seed.json niet gevonden — showcase-profiel niet geseed.");
      return;
    }

    const insertRow = (tabel: string, row: Record<string, unknown>) => {
      // Alleen kolommen invoegen die ook echt in de doeltabel bestaan, zodat de
      // seed bestand blijft tegen kleine schemaverschillen tussen omgevingen.
      const bestaande = new Set(
        (sqlite.prepare(`PRAGMA table_info(${tabel})`).all() as Array<{ name: string }>).map(
          (c) => c.name,
        ),
      );
      const kolommen = Object.keys(row).filter((k) => bestaande.has(k));
      if (kolommen.length === 0) return;
      const placeholders = kolommen.map(() => "?").join(", ");
      const sql = `INSERT OR IGNORE INTO ${tabel} (${kolommen
        .map((k) => `"${k}"`)
        .join(", ")}) VALUES (${placeholders})`;
      const waarden = kolommen.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return null;
        if (typeof v === "boolean") return v ? 1 : 0;
        if (typeof v === "object") return JSON.stringify(v);
        return v as string | number;
      });
      sqlite.prepare(sql).run(...waarden);
    };

    const tx = sqlite.transaction(() => {
      if (seed.organisatie) insertRow("organisaties", seed.organisatie);
      insertRow("deelnemers", seed.deelnemer);
      insertRow("afnames", seed.afname);
      for (const r of seed.rapporten) insertRow("rapporten", r);
    });
    tx();
    console.log("[tapas] Showcase-profiel (Marc Debisschop) geseed.");
  } catch (e) {
    console.error("[tapas] Showcase seeden mislukt:", e);
  }
}
seedShowcase();

// ---------------------------------------------------------------------------
// Demo-data: fictieve organisaties, afnames en credits zodat de admin-beheer
// pagina gevuld is bij een eerste demo. Volledig idempotent via INSERT OR IGNORE
// op unieke codes/emails.
// ---------------------------------------------------------------------------
(function seedDemoData() {
  try {
    // Enkel seeden als er nog geen demo-organisaties zijn
    const check = sqlite
      .prepare("SELECT COUNT(*) AS n FROM organisaties WHERE naam = 'Innovatech NV'")
      .get() as { n: number };
    if (check.n > 0) return;

    const now = new Date().toISOString();
    const d2025 = "2025-11-15T09:00:00.000Z";
    const d2026a = "2026-01-08T10:30:00.000Z";
    const d2026b = "2026-03-22T14:00:00.000Z";
    const d2026c = "2026-05-10T08:45:00.000Z";

    // 3 fictieve organisaties
    const orgIns = sqlite.prepare(
      `INSERT OR IGNORE INTO organisaties (naam, type, contactpersoon, email, gemeente, land, created_at)
       VALUES (?, ?, ?, ?, ?, 'België', ?)`
    );
    orgIns.run("Innovatech NV",       "bedrijf",    "Sofie Hermans",    "sofie@innovatech.be",    "Gent",      now);
    orgIns.run("Academie De Horizon", "school",     "Maarten Claes",    "m.claes@dehorizon.be",  "Leuven",    now);
    orgIns.run("Vantage Consulting",  "bedrijf",    "Elke Van Damme",   "e.vandamme@vantage.be", "Antwerpen", now);

    // IDs ophalen
    const orgId = (tabel: string) =>
      (sqlite.prepare(`SELECT id FROM organisaties WHERE naam = ?`).get(tabel) as { id: number } | undefined)?.id;
    const idInno = orgId("Innovatech NV");
    const idAcad = orgId("Academie De Horizon");
    const idVant = orgId("Vantage Consulting");

    // Credits seeden per organisatie
    const creditIns = sqlite.prepare(
      `INSERT OR IGNORE INTO credit_saldi (organisatie_id, beschikbaar, gereserveerd, verbruikt, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    if (idInno) creditIns.run(idInno, 42, 3, 15, now);
    if (idAcad) creditIns.run(idAcad, 18, 1,  6, now);
    if (idVant) creditIns.run(idVant, 75, 0, 25, now);

    // 6 fictieve afnames in verschillende statussen
    const afnameIns = sqlite.prepare(
      `INSERT OR IGNORE INTO afnames
         (respondent_code, name, company, role, taal, status,
          organisatie_id, consent_given, rechtsgrond,
          created_at, completed_at)
       VALUES (?, ?, ?, ?, 'nl', ?, ?, 1, 'toestemming', ?, ?)`
    );
    // voltooid
    afnameIns.run("IT-2025-001", "Thomas Peeters",   "Innovatech NV",       "Senior Developer",    "voltooid",  idInno ?? null, d2025,  "2025-11-18T16:20:00.000Z");
    afnameIns.run("IT-2025-002", "Laura Janssen",    "Innovatech NV",       "Product Manager",     "voltooid",  idInno ?? null, d2025,  "2025-11-20T11:05:00.000Z");
    afnameIns.run("DH-2026-001", "Axel De Smet",     "Academie De Horizon", "Lector Communicatie", "voltooid",  idAcad ?? null, d2026a, "2026-01-12T09:30:00.000Z");
    // uitgenodigd (link verstuurd, nog niet gestart)
    afnameIns.run("VC-2026-001", "Nathalie Wouters", "Vantage Consulting",  "HR Manager",          "uitgenodigd", idVant ?? null, d2026b, null);
    // gestart (consent gegeven, niet voltooid)
    afnameIns.run("VC-2026-002", "Pieter Vanhout",   "Vantage Consulting",  "Business Analyst",    "gestart",   idVant ?? null, d2026c, null);
    // consent (enkel aangemaakt, niet uitgenodigd)
    afnameIns.run("DH-2026-002", "Ines Claeys",      "Academie De Horizon", "Stafmedewerker",      "consent",   idAcad ?? null, now,    null);

    // -----------------------------------------------------------------------
    // Credit-transacties (grootboek)
    // -----------------------------------------------------------------------
    const txIns = sqlite.prepare(
      `INSERT OR IGNORE INTO credit_transacties
         (organisatie_id, type, aantal, omschrijving, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    if (idInno) {
      txIns.run(idInno, "aankoop",   50, "Starter-pakket 50 credits \u2014 Innovatech NV",       "2025-10-01T10:00:00.000Z");
      txIns.run(idInno, "verbruik",  -1, "Afname IT-2025-001 Thomas Peeters voltooid",           "2025-11-18T16:20:00.000Z");
      txIns.run(idInno, "verbruik",  -1, "Afname IT-2025-002 Laura Janssen voltooid",            "2025-11-20T11:05:00.000Z");
      txIns.run(idInno, "aankoop",   10, "Bijkopen 10 credits \u2014 Innovatech NV",              "2026-01-15T09:30:00.000Z");
    }
    if (idAcad) {
      txIns.run(idAcad, "aankoop",   25, "Starter-pakket 25 credits \u2014 Academie De Horizon", "2025-12-05T11:00:00.000Z");
      txIns.run(idAcad, "verbruik",  -1, "Afname DH-2026-001 Axel De Smet voltooid",             "2026-01-12T09:30:00.000Z");
    }
    if (idVant) {
      txIns.run(idVant, "aankoop",  100, "Team-pakket 100 credits \u2014 Vantage Consulting",    "2025-09-15T08:00:00.000Z");
      txIns.run(idVant, "verbruik",  -1, "Afname gearchiveerd VC-2025",                           "2025-10-10T14:00:00.000Z");
      txIns.run(idVant, "overdracht", -5, "Overdracht naar Academie De Horizon",                  "2026-02-01T10:00:00.000Z");
    }

    // -----------------------------------------------------------------------
    // Facturen (bevroren snapshots, volledig conform schema)
    // -----------------------------------------------------------------------
    const billerRow = sqlite
      .prepare("SELECT * FROM biller_entiteiten WHERE actief = 1 LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    const billerSnap = billerRow
      ? JSON.stringify(billerRow)
      : JSON.stringify({ naam: "2BQ CONSULT", btwNummer: "BE0810.464.001" });
    const billerId = billerRow ? Number((billerRow as any).id) : 1;

    const factuurIns = sqlite.prepare(
      `INSERT OR IGNORE INTO facturen
         (factuurnummer, biller_entiteit_id, organisatie_id,
          biller_snapshot, klant_snapshot, regels,
          bedrag_excl_btw_cent, btw_bedrag_cent, bedrag_incl_btw_cent,
          munt, kanaal, peppol_status, factuurdatum, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', 'pdf', 'n.v.t.', ?, ?)`
    );
    const mkKlant = (naam: string, gemeente: string, email: string) =>
      JSON.stringify({ naam, gemeente, email });
    const mkRegel = (oms: string, n: number, totaalExcl: number) =>
      JSON.stringify([{ omschrijving: oms, aantal: n,
        eenheidsprijsExclCent: Math.round(totaalExcl / n), btwTarief: 21, totaalExclCent: totaalExcl }]);

    if (idInno) {
      factuurIns.run("2BQ-2025-0001", billerId, idInno,
        billerSnap, mkKlant("Innovatech NV", "Gent", "sofie@innovatech.be"),
        mkRegel("TaPas credits \u2014 Starter 50", 50, 25000),
        25000, 5250, 30250, "2025-10-01", "2025-10-01T10:05:00.000Z");
      factuurIns.run("2BQ-2026-0002", billerId, idInno,
        billerSnap, mkKlant("Innovatech NV", "Gent", "sofie@innovatech.be"),
        mkRegel("TaPas credits \u2014 bijkoop 10", 10, 5000),
        5000, 1050, 6050, "2026-01-15", "2026-01-15T09:35:00.000Z");
    }
    if (idAcad) {
      factuurIns.run("2BQ-2025-0003", billerId, idAcad,
        billerSnap, mkKlant("Academie De Horizon", "Leuven", "m.claes@dehorizon.be"),
        mkRegel("TaPas credits \u2014 Starter 25", 25, 12500),
        12500, 2625, 15125, "2025-12-05", "2025-12-05T11:05:00.000Z");
    }
    if (idVant) {
      factuurIns.run("2BQ-2025-0004", billerId, idVant,
        billerSnap, mkKlant("Vantage Consulting", "Antwerpen", "e.vandamme@vantage.be"),
        mkRegel("TaPas credits \u2014 Team 100", 100, 50000),
        50000, 10500, 60500, "2025-09-15", "2025-09-15T08:05:00.000Z");
    }

    // -----------------------------------------------------------------------
    // Licenties (T4Recruitment losse verkoop)
    // -----------------------------------------------------------------------
    const licIns = sqlite.prepare(
      `INSERT OR IGNORE INTO licenties
         (sleutel, klantnaam, klant_email, max_profielen, prijs_per_profiel_cent,
          gebruikte_profielen, geldig_van, geldig_tot, status, notities, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'actief', ?, ?)`
    );
    licIns.run(
      "T4R-LIC-DEMO-001", "Vantage Consulting", "e.vandamme@vantage.be",
      20, 8900, 7, d2026b, "2027-03-22",
      "Jaarlicentie T4Recruitment \u2014 20 profielen @ \u20ac89/profiel", d2026b
    );
    licIns.run(
      "T4R-LIC-DEMO-002", "Innovatech NV", "sofie@innovatech.be",
      10, 9500, 2, d2026c, "2027-05-10",
      "Licentie T4Recruitment \u2014 10 profielen @ \u20ac95/profiel", d2026c
    );

    // -----------------------------------------------------------------------
    // T4Recruitment demo-sessies (t4r_sessions tabel — eigen prefix)
    // -----------------------------------------------------------------------
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS t4r_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        function_title TEXT NOT NULL,
        org_label TEXT NOT NULL,
        role_type TEXT NOT NULL,
        role_level TEXT NOT NULL,
        fill_mode TEXT NOT NULL,
        end_moment TEXT NOT NULL,
        context_version TEXT NOT NULL DEFAULT 'v1',
        status TEXT NOT NULL DEFAULT 'draft',
        closed_ring INTEGER NOT NULL DEFAULT 0,
        platform_sessie_id INTEGER,
        chat_gebruikt INTEGER NOT NULL DEFAULT 0,
        chat_tegoed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`
    );
    const t4rLeeg = (
      sqlite.prepare("SELECT COUNT(*) AS n FROM t4r_sessions").get() as { n: number }
    ).n === 0;
    if (t4rLeeg) {
      const msAgo = (dagen: number) => Date.now() - dagen * 86400000;
      const t4rIns = sqlite.prepare(
        `INSERT INTO t4r_sessions
           (function_title, org_label, role_type, role_level, fill_mode,
            end_moment, status, closed_ring, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      t4rIns.run("HR Business Partner",      "Vantage Consulting",  "staf",       "expert", "individueel", "2026-04-30T23:59:00.000Z", "stakeholders-bevestigd", 1, msAgo(30));
      t4rIns.run("Digital Marketing Manager","Innovatech NV",       "management", "senior", "individueel", "2026-07-15T23:59:00.000Z", "individuele-input",      1, msAgo(5));
      t4rIns.run("Data Scientist",           "Academie De Horizon", "specialist", "medior", "individueel", "2026-08-01T23:59:00.000Z", "draft",                  0, msAgo(2));

      sqlite.exec(
        `CREATE TABLE IF NOT EXISTS t4r_stakeholders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          stakeholder_role TEXT NOT NULL,
          system_role TEXT NOT NULL DEFAULT 'stakeholder',
          voting INTEGER NOT NULL DEFAULT 1
        )`
      );
      const s1Id = (
        sqlite.prepare("SELECT id FROM t4r_sessions ORDER BY id ASC LIMIT 1").get() as { id: number }
      ).id;
      const stIns = sqlite.prepare(
        `INSERT INTO t4r_stakeholders (session_id, name, stakeholder_role, system_role, voting) VALUES (?, ?, ?, ?, ?)`
      );
      stIns.run(s1Id, "Elke Van Damme",  "HR Director",         "stakeholder", 1);
      stIns.run(s1Id, "Nathalie Wouters","Business Unit Lead",  "stakeholder", 1);
      stIns.run(s1Id, "Pieter Vanhout",  "Finance Manager",     "stakeholder", 1);
      stIns.run(s1Id, "Marc Debisschop", "Coach / Facilitator", "facilitator", 0);
      console.log("[tapas] T4Recruitment demo-sessies geseed.");
    }

    // -----------------------------------------------------------------------
    // TaPas Teamscan demo-sessies (teamscan_sessies tabel)
    // -----------------------------------------------------------------------
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS teamscan_sessies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_naam TEXT NOT NULL,
        org_label TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        platform_sessie_id INTEGER,
        created_at INTEGER NOT NULL
      )`
    );
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS teamscan_deelnemers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessie_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL DEFAULT '',
        afgerond INTEGER NOT NULL DEFAULT 0,
        afgerond_at INTEGER,
        created_at INTEGER NOT NULL
      )`
    );
    const tsLeeg = (
      sqlite.prepare("SELECT COUNT(*) AS n FROM teamscan_sessies").get() as { n: number }
    ).n === 0;
    if (tsLeeg) {
      const msAgo2 = (dagen: number) => Date.now() - dagen * 86400000;
      const tsIns = sqlite.prepare(
        `INSERT INTO teamscan_sessies (team_naam, org_label, status, created_at) VALUES (?, ?, ?, ?)`
      );
      tsIns.run("Leadership Team",       "Innovatech NV",       "open",     msAgo2(7));
      tsIns.run("Kernteam Communicatie", "Academie De Horizon", "gesloten", msAgo2(45));

      const ts1Id = (
        sqlite.prepare("SELECT id FROM teamscan_sessies ORDER BY id ASC LIMIT 1").get() as { id: number }
      ).id;
      const ts2Id = (
        sqlite.prepare("SELECT id FROM teamscan_sessies ORDER BY id DESC LIMIT 1").get() as { id: number }
      ).id;
      const tdNow = Date.now();
      const tdIns = sqlite.prepare(
        `INSERT OR IGNORE INTO teamscan_deelnemers (sessie_id, token, label, afgerond, created_at) VALUES (?, ?, ?, ?, ?)`
      );
      tdIns.run(ts1Id, "TSDEMO-SOFIE-001",    "Sofie Hermans",   1, tdNow);
      tdIns.run(ts1Id, "TSDEMO-THOMAS-001",   "Thomas Peeters",  1, tdNow);
      tdIns.run(ts1Id, "TSDEMO-LAURA-001",    "Laura Janssen",   1, tdNow);
      tdIns.run(ts1Id, "TSDEMO-AXEL-001",     "Axel De Smet",    0, tdNow);
      tdIns.run(ts1Id, "TSDEMO-INES-001",     "Ines Claeys",     0, tdNow);
      tdIns.run(ts2Id, "TSDEMO2-MAARTEN-01",  "Maarten Claes",   1, tdNow);
      tdIns.run(ts2Id, "TSDEMO2-NATHALIE-01", "Nathalie Wouters",1, tdNow);
      tdIns.run(ts2Id, "TSDEMO2-PIETER-01",   "Pieter Vanhout",  1, tdNow);
      console.log("[tapas] Teamscan demo-sessies geseed.");
    }

    // -----------------------------------------------------------------------
    // Human Due Diligence (HDD) demo-traject
    // Vlaggenschip-instrument: 1 volledig afgerond M&A-traject voor
    // "Loop Founder-Management Team" (Loop Earplugs — fictief).
    // 5 boardleden, fase 1 klaar, gate = Go, fase 2 klaar, status = afgerond.
    // Idempotent via COUNT hdd_trajecten = 0.
    // -----------------------------------------------------------------------
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS hdd_trajecten (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_naam TEXT NOT NULL,
        org_label TEXT NOT NULL DEFAULT '',
        context TEXT NOT NULL DEFAULT 'self-screening',
        vereist_stratum INTEGER,
        status TEXT NOT NULL DEFAULT 'fase1_open',
        gate_resultaat TEXT,
        platform_sessie_id INTEGER,
        created_at INTEGER NOT NULL
      )`
    );
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS hdd_board_leden (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        traject_id INTEGER NOT NULL,
        naam TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        instrument_tokens TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )`
    );
    const hddLeeg = (
      sqlite.prepare("SELECT COUNT(*) AS n FROM hdd_trajecten").get() as { n: number }
    ).n === 0;
    if (hddLeeg) {
      const msAgo3 = (dagen: number) => Date.now() - dagen * 86400000;

      // Traject: Loop Founder-Management Team (M&A, vereist stratum 5, afgerond)
      const hddTrIns = sqlite.prepare(
        `INSERT INTO hdd_trajecten
           (board_naam, org_label, context, vereist_stratum, status, gate_resultaat, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const gateResultaat = JSON.stringify({
        advies: "go",
        signalen: [
          {
            indicator: "waardenfit",
            ernst: "midden",
            toelichting: "Twee leden tonen een lichte waardendivergentie op langetermijn-oriëntatie; follow-up in fase 2 aanbevolen."
          }
        ],
        samenvatting: "Het board toont solide teamsamenwerking (gemiddeld vertrouwen 4.1/5) en een gezonde energiebalans. De enige rode vlag is een matig waardenverschil bij twee leden — onvoldoende zwaar om de diepteanalyse te blokkeren. Advies: GO voor fase 2.",
        consultantBesluit: "go",
        consultantMotivatie: "Bevestigd na bespreking met investerende partij. Waardenverschil is bespreekbaar en manageable in integratiefase."
      });
      hddTrIns.run(
        "Loop Founder-Management Team",
        "Loop Earplugs",
        "ma",
        5,
        "afgerond",
        gateResultaat,
        msAgo3(60)
      );

      const hddTrId = (
        sqlite.prepare("SELECT id FROM hdd_trajecten ORDER BY id ASC LIMIT 1").get() as { id: number }
      ).id;

      // Boardleden: 5 fictieve personen met instrument-tokens
      const hddLidIns = sqlite.prepare(
        `INSERT INTO hdd_board_leden
           (traject_id, naam, email, instrument_tokens, created_at)
         VALUES (?, ?, ?, ?, ?)`
      );
      const boardLeden = [
        {
          naam: "Dimitri Oosterlinck",
          email: "dimitri@loop-earplugs.com",
          tokens: {
            "tapas-teamscan": "TSDEMO-DIMITRI-HDD01",
            "twominscan": "2MS-DIMITRI-HDD01",
            "t4p-business-kompas": "T4P-DIMITRI-HDD01"
          }
        },
        {
          naam: "Maarten Bodewes",
          email: "maarten@loop-earplugs.com",
          tokens: {
            "tapas-teamscan": "TSDEMO-MAARTEN-HDD01",
            "twominscan": "2MS-MAARTEN-HDD01",
            "t4p-business-kompas": "T4P-MAARTEN-HDD01"
          }
        },
        {
          naam: "Marloes Mantel",
          email: "marloes@loop-earplugs.com",
          tokens: {
            "tapas-teamscan": "TSDEMO-MARLOES-HDD01",
            "twominscan": "2MS-MARLOES-HDD01",
            "t4p-business-kompas": "T4P-MARLOES-HDD01"
          }
        },
        {
          naam: "Cedric Schepers",
          email: "cedric@loop-earplugs.com",
          tokens: {
            "tapas-teamscan": "TSDEMO-CEDRIC-HDD01",
            "twominscan": "2MS-CEDRIC-HDD01",
            "t4p-business-kompas": "T4P-CEDRIC-HDD01"
          }
        },
        {
          naam: "Rob Weston",
          email: "rob@loop-earplugs.com",
          tokens: {
            "tapas-teamscan": "TSDEMO-ROB-HDD01",
            "twominscan": "2MS-ROB-HDD01",
            "t4p-business-kompas": "T4P-ROB-HDD01"
          }
        }
      ];
      const hddNow = Date.now();
      for (const lid of boardLeden) {
        hddLidIns.run(hddTrId, lid.naam, lid.email, JSON.stringify(lid.tokens), hddNow);
      }
      console.log("[tapas] HDD demo-traject geseed: Loop Founder-Management Team (M&A, afgerond, 5 boardleden).");
    }

    console.log("[tapas] Demo-data volledig: org + afnames + credits + transacties + facturen + licenties + T4R + Teamscan + HDD.");
  } catch (e) {
    console.warn("[tapas] Demo-data seed overgeslagen:", (e as Error)?.message);
  }
})();

// ---------------------------------------------------------------------------
// Creditpakketten als config (geen aparte tabel nodig in C1). De prijzen zijn
// indicatief en exclusief BTW; bij enkelvoudig gebruik (single-purpose voucher)
// wordt de BTW bij aankoop aangerekend volgens het tarief van de biller.
// ---------------------------------------------------------------------------
export interface Creditpakket {
  id: string;
  naam: string;
  credits: number;
  prijsExclBtw: number; // in euro
}

export const CREDITPAKKETTEN: Creditpakket[] = [
  { id: "start", naam: "Starter", credits: 10, prijsExclBtw: 250 },
  { id: "team", naam: "Team", credits: 50, prijsExclBtw: 1125 },
  { id: "school", naam: "School", credits: 100, prijsExclBtw: 2000 },
  { id: "enterprise", naam: "Enterprise", credits: 250, prijsExclBtw: 4375 },
];

// ---------------------------------------------------------------------------
// Storage-interface
// ---------------------------------------------------------------------------

export interface NewAfname {
  organisatieId?: number | null;
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  baselineEnergy: number;
  taal?: string | null;
  consentScope: string;
  consentTimestamp: string;
  verwerkingsdoel?: string | null;
  rechtsgrond?: string | null;
  privacyverklaringVersie?: string | null;
  consentIp?: string | null;
  consentUserAgent?: string | null;
  bewaartotDatum?: string | null;
}

// Centrale GDPR-config: de versie van de privacyverklaring en de standaard
// bewaartermijn voor afnamegegevens. Bewaartermijn = doelgebonden (AVG art. 5).
// De boekhoudkundige bewaarplicht (10 jaar) geldt enkel voor facturen, NIET
// voor de psychometrische antwoorden — die kennen een kortere doelbinding.
export const PRIVACY_VERKLARING_VERSIE = "v1.0 (2026-06)";
export const STANDAARD_BEWAARMAANDEN = 24; // 2 jaar doelbinding voor profieldata

// ---------------------------------------------------------------------------
// T4Recruitment — Fase 2: instelbare credit-tarieven (per sessie / heropening).
//
// Deze waarden zijn de STANDAARD; ze kunnen door de beheerder worden
// overschreven (env-variabele of latere instellingen-UI). Ze staan bewust
// los van het individuele afname-tarief (dat blijft 1 credit per afname).
//   • SESSIE_CREDIT_KOST       — prijs van één volledig rolprofiel-traject.
//   • HEROPENING_CREDIT_KOST   — prijs om een vergrendelde kring opnieuw te
//                                openen (toevoegen/vervangen van stakeholders).
// ---------------------------------------------------------------------------
export const SESSIE_CREDIT_KOST = Number(process.env.T4R_SESSIE_CREDITS ?? 20);
export const HEROPENING_CREDIT_KOST = Number(process.env.T4R_HEROPENING_CREDITS ?? 10);

export class CreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditError";
  }
}

export interface IStorage {
  // Afnames (Fase B)
  createAfname(data: NewAfname): Promise<Afname>;
  getAfname(id: number): Promise<Afname | undefined>;
  getAfnameByCode(code: string): Promise<Afname | undefined>;
  listAfnames(): Promise<Afname[]>;
  updateAfname(id: number, patch: Partial<Afname>): Promise<Afname | undefined>;

  // Deelnemerslink / uitnodiging (Fase D)
  maakUitnodiging(data: {
    organisatieId?: number | null;
    name?: string | null;
    company?: string | null;
    role?: string | null;
    taal?: string | null;
  }): Promise<Afname>;
  getAfnameByToken(token: string): Promise<Afname | undefined>;
  markeerHerinnerd(id: number): Promise<Afname | undefined>;

  // Billers (Fase C1)
  listBillers(): Promise<BillerEntiteit[]>;
  getActieveBiller(): Promise<BillerEntiteit | undefined>;
  createBiller(data: InsertBiller): Promise<BillerEntiteit>;
  activeerBiller(id: number): Promise<BillerEntiteit | undefined>;

  // Organisaties (Fase C1)
  listOrganisaties(): Promise<Array<Organisatie & { saldo: CreditSaldo }>>;
  getOrganisatie(id: number): Promise<Organisatie | undefined>;
  createOrganisatie(data: InsertOrganisatie): Promise<Organisatie>;

  // Credits (Fase C1)
  getSaldo(organisatieId: number): Promise<CreditSaldo>;
  laadCredits(organisatieId: number, aantal: number, omschrijving?: string): Promise<CreditSaldo>;
  reserveer(organisatieId: number, afnameId: number): Promise<CreditSaldo>;
  verbruik(organisatieId: number, afnameId: number): Promise<CreditSaldo>;
  geefVrij(organisatieId: number, afnameId: number): Promise<CreditSaldo>;
  overdracht(vanId: number, naarId: number, aantal: number, omschrijving?: string): Promise<void>;
  listTransacties(organisatieId?: number): Promise<CreditTransactie[]>;

  // Betalingen (Fase C2)
  startBetaling(organisatieId: number, credits: number, pakketId?: string | null): Promise<Betaling>;
  getBetaling(id: number): Promise<Betaling | undefined>;
  listBetalingen(organisatieId?: number): Promise<Betaling[]>;
  bevestigBetaling(id: number, methode?: string): Promise<{ betaling: Betaling; factuur: Factuur } | undefined>;
  markeerBetalingMislukt(id: number): Promise<Betaling | undefined>;

  // Facturen (Fase C2-C3)
  getFactuur(id: number): Promise<Factuur | undefined>;
  listFacturen(organisatieId?: number): Promise<Factuur[]>;

  // Rapporten (Fase C3)
  genereerRapport(afnameId: number, variant: "kompas" | "coachatlas"): Promise<Rapport>;
  getRapport(id: number): Promise<Rapport | undefined>;
  listRapporten(afnameId?: number): Promise<Rapport[]>;

  // Creditnota's (Fase C4a)
  maakCreditnota(factuurId: number, reden: string, creditsTerugboeken: boolean): Promise<Creditnota>;
  getCreditnota(id: number): Promise<Creditnota | undefined>;
  listCreditnotas(organisatieId?: number): Promise<Creditnota[]>;

  // Bestuursrapportage (Fase C4b)
  bestuursKpis(): Promise<BestuursKpis>;
  boekhoudExport(): Promise<BoekhoudExportRegel[]>;

  // GDPR (Fase C4c)
  gdprExport(afnameId: number): Promise<any>;
  anonimiseerAfname(afnameId: number, reden: string): Promise<Afname | undefined>;
  trekConsentIn(afnameId: number): Promise<Afname | undefined>;

  // Deelnemers & persoonlijk dashboard (TaPas Persoonlijk — Fase 1)
  // Vind of maak een deelnemer op basis van zijn e-mail (login via magic-link).
  vindOfMaakDeelnemer(email: string, taal?: string): Promise<Deelnemer>;
  getDeelnemerByEmail(email: string): Promise<Deelnemer | undefined>;
  getDeelnemerByToken(token: string): Promise<Deelnemer | undefined>;
  updateDeelnemer(id: number, patch: UpdateDeelnemer): Promise<Deelnemer | undefined>;
  // Koppel een (voltooide) afname aan een deelnemer-e-mail.
  koppelAfnameAanDeelnemer(afnameId: number, email: string): Promise<Afname | undefined>;
  // Alle afnames van één deelnemer (gekoppeld via e-mail).
  listAfnamesVoorDeelnemer(email: string): Promise<Afname[]>;

  // AI-chatbot (Fase 2) — tegoeden & gespreksgeschiedenis.
  // Verhoog het aantal gestelde vragen met 1; geeft de bijgewerkte deelnemer terug.
  verhoogVragenGebruikt(deelnemerId: number): Promise<Deelnemer | undefined>;
  // Voeg extra-tegoed toe (bv. na een demo-aankoop van een vragenpakket).
  voegVragenTegoedToe(deelnemerId: number, aantal: number): Promise<Deelnemer | undefined>;
  // Volledige chatgeschiedenis van één deelnemer (oudste eerst).
  listChatBerichten(deelnemerId: number): Promise<ChatBericht[]>;
  // Bewaar één bericht (rol: 'user' | 'assistant').
  voegChatBerichtToe(deelnemerId: number, rol: string, inhoud: string, veiligheid?: string | null): Promise<ChatBericht>;

  // Gesproken profieluitleg (audio) — per toon ('deelnemer' | 'coach') een eigen teller.
  // Verhoog het aantal beluisterde uitleg-sessies met 1 voor de gevraagde toon.
  verhoogUitlegGebruikt(deelnemerId: number, toon: "deelnemer" | "coach"): Promise<Deelnemer | undefined>;
  // Voeg extra uitleg-tegoed toe voor de gevraagde toon (bv. na een demo-aankoop).
  voegUitlegTegoedToe(deelnemerId: number, toon: "deelnemer" | "coach", aantal: number): Promise<Deelnemer | undefined>;

  // --- T4Recruitment — Fase 2: licenties (losse verkoop) -------------------
  maakLicentie(data: {
    klantnaam: string;
    klantEmail?: string | null;
    maxProfielen?: number | null;
    prijsPerProfielCent: number;
    geldigTot?: string | null;
    notities?: string | null;
  }): Promise<Licentie>;
  listLicenties(): Promise<Licentie[]>;
  getLicentie(id: number): Promise<Licentie | undefined>;
  getLicentieBySleutel(sleutel: string): Promise<Licentie | undefined>;
  trekLicentieIn(id: number): Promise<Licentie | undefined>;

  // --- T4Recruitment — Fase 2: collaboratieve sessies ----------------------
  maakSessie(data: {
    titel: string;
    facilitatorNaam?: string | null;
    facilitatorEmail?: string | null;
    taal?: string | null;
    organisatieId?: number | null;
    licentieId?: number | null;
  }): Promise<Sessie>;
  getSessie(id: number): Promise<Sessie | undefined>;
  listSessies(): Promise<Sessie[]>;
  updateSessie(id: number, patch: Partial<Sessie>): Promise<Sessie | undefined>;
  // Vergrendel de kring + reserveer het sessietarief (credits OF licentie).
  vergrendelKring(sessieId: number): Promise<Sessie | undefined>;
  // Heropen een vergrendelde kring — kost het (instelbare) heropeningstarief.
  heropenKring(sessieId: number): Promise<Sessie | undefined>;
  // Finaliseer: verbruik definitief het sessietarief (credits) of verhoog de
  // licentieteller; bevries het rolprofiel-contract.
  finaliseerSessie(sessieId: number, rolprofielContract?: unknown): Promise<Sessie | undefined>;

  // Kringleden (stakeholders/observers).
  voegKringlidToe(sessieId: number, data: { rol: SessieRol; naam?: string | null; email?: string | null }): Promise<SessieDeelnemer>;
  listKringleden(sessieId: number): Promise<SessieDeelnemer[]>;
  getKringlidByToken(token: string): Promise<SessieDeelnemer | undefined>;
  verwijderKringlid(id: number): Promise<void>;
  updateKringlid(id: number, patch: Partial<SessieDeelnemer>): Promise<SessieDeelnemer | undefined>;

  // Vergelijkende studie (0 credits).
  voegStudieToe(sessieId: number, kandidaatLabel: string, studieContract?: unknown): Promise<SessieStudie>;
  listStudies(sessieId: number): Promise<SessieStudie[]>;
}

// Bestuurs-KPI's: alle bedragen in euro (afgerond op 2 decimalen).
export interface BestuursKpis {
  gegenereerdOp: string;
  munt: string;
  omzet: {
    totaalExclBtw: number;
    totaalBtw: number;
    totaalInclBtw: number;
    nettoExclBtwNaCreditnotas: number;
    aantalFacturen: number;
    aantalCreditnotas: number;
  };
  klanten: {
    aantalOrganisaties: number;
    aantalBetalendeOrganisaties: number;
    perType: Record<string, number>;
  };
  credits: {
    verkocht: number;
    verbruikt: number;
    gereserveerd: number;
    beschikbaarUitstaand: number;
    verzilveringsgraad: number; // verbruikt / verkocht
  };
  afnames: {
    totaal: number;
    voltooid: number;
    inUitvoering: number;
    voltooiingsgraad: number;
    rapportenGegenereerd: number;
  };
  betalingen: {
    geslaagd: number;
    mislukt: number;
    open: number;
    slagingsgraad: number;
  };
  gemiddelden: {
    gemiddeldeOrderwaardeExclBtw: number;
    omzetPerBetalendeOrganisatie: number;
  };
  gdpr: {
    afnamesMetPersoonsgegevens: number;
    geanonimiseerd: number;
    consentIngetrokken: number;
    bewaartermijnVerstreken: number;
  };
}

export interface BoekhoudExportRegel {
  documenttype: string; // 'factuur' | 'creditnota'
  nummer: string;
  datum: string;
  klant: string;
  klantBtw: string | null;
  bedragExclBtw: number;
  btwTarief: number;
  btwBedrag: number;
  bedragInclBtw: number;
  munt: string;
  kanaal: string;
}

export class DatabaseStorage implements IStorage {
  // --- Afnames -------------------------------------------------------------
  async createAfname(data: NewAfname): Promise<Afname> {
    return db
      .insert(afnames)
      .values({
        organisatieId: data.organisatieId ?? null,
        respondentCode: data.respondentCode,
        name: data.name,
        company: data.company ?? null,
        role: data.role ?? null,
        consentGiven: true,
        consentScope: data.consentScope,
        consentTimestamp: data.consentTimestamp,
        verwerkingsdoel: data.verwerkingsdoel ?? "Genereren van een professioneel energetisch gedragsprofiel (T4P Business Kompas)",
        rechtsgrond: data.rechtsgrond ?? "toestemming",
        privacyverklaringVersie: data.privacyverklaringVersie ?? PRIVACY_VERKLARING_VERSIE,
        consentIp: data.consentIp ?? null,
        consentUserAgent: data.consentUserAgent ?? null,
        bewaartotDatum:
          data.bewaartotDatum ??
          new Date(Date.now() + STANDAARD_BEWAARMAANDEN * 30 * 24 * 3600 * 1000).toISOString(),
        baselineEnergy: data.baselineEnergy,
        taal: data.taal ?? "nl",
        status: "deel1",
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  async getAfname(id: number): Promise<Afname | undefined> {
    return db.select().from(afnames).where(eq(afnames.id, id)).get();
  }

  async getAfnameByCode(code: string): Promise<Afname | undefined> {
    return db.select().from(afnames).where(eq(afnames.respondentCode, code)).get();
  }

  async listAfnames(): Promise<Afname[]> {
    return db.select().from(afnames).orderBy(desc(afnames.id)).all();
  }

  async updateAfname(id: number, patch: Partial<Afname>): Promise<Afname | undefined> {
    return db.update(afnames).set(patch).where(eq(afnames.id, id)).returning().get();
  }

  // --- Deelnemerslink / uitnodiging (Fase D) -------------------------------
  // Maakt een afname in status 'uitgenodigd' met een onraadbaar toegangstoken.
  // De deelnemer geeft zelf toestemming + baseline bij het binnenkomen via de
  // link; pas dan worden consentGiven/consentTimestamp/GDPR-velden gezet.
  async maakUitnodiging(data: {
    organisatieId?: number | null;
    name?: string | null;
    company?: string | null;
    role?: string | null;
    taal?: string | null;
  }): Promise<Afname> {
    const now = new Date().toISOString();
    // Tijdelijke unieke respondentCode; wordt na voltooiing/start verfijnd.
    const token = `${cryptoRandom(8)}-${cryptoRandom(8)}-${cryptoRandom(8)}`;
    const tempCode = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return db
      .insert(afnames)
      .values({
        organisatieId: data.organisatieId ?? null,
        respondentCode: tempCode,
        name: data.name && data.name.trim() ? data.name.trim() : "(nog niet ingevuld)",
        company: data.company ?? null,
        role: data.role ?? null,
        consentGiven: false,
        baselineEnergy: 5,
        taal: data.taal ?? "nl",
        status: "uitgenodigd",
        inviteToken: token,
        uitgenodigdAt: now,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async getAfnameByToken(token: string): Promise<Afname | undefined> {
    return db.select().from(afnames).where(eq(afnames.inviteToken, token)).get();
  }

  async markeerHerinnerd(id: number): Promise<Afname | undefined> {
    return db
      .update(afnames)
      .set({ herinnerdAt: new Date().toISOString() })
      .where(eq(afnames.id, id))
      .returning()
      .get();
  }

  // --- Billers -------------------------------------------------------------
  async listBillers(): Promise<BillerEntiteit[]> {
    return db.select().from(billerEntiteiten).orderBy(desc(billerEntiteiten.id)).all();
  }

  async getActieveBiller(): Promise<BillerEntiteit | undefined> {
    return db
      .select()
      .from(billerEntiteiten)
      .where(eq(billerEntiteiten.actief, true))
      .orderBy(desc(billerEntiteiten.id))
      .get();
  }

  async createBiller(data: InsertBiller): Promise<BillerEntiteit> {
    return db
      .insert(billerEntiteiten)
      .values({
        ...data,
        geldigVan: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  // Activeer één biller: sluit de huidige actieve af (geldigTot) en zet de
  // nieuwe actief. Dit is de entiteitswissel (bv. 2BQ CONSULT -> PMV-entiteit).
  async activeerBiller(id: number): Promise<BillerEntiteit | undefined> {
    const tx = sqlite.transaction(() => {
      const now = new Date().toISOString();
      // Sluit alle huidige actieve billers af.
      db.update(billerEntiteiten)
        .set({ actief: false, geldigTot: now })
        .where(eq(billerEntiteiten.actief, true))
        .run();
      // Heractiveer de gekozen biller.
      db.update(billerEntiteiten)
        .set({ actief: true, geldigTot: null })
        .where(eq(billerEntiteiten.id, id))
        .run();
    });
    tx();
    return db.select().from(billerEntiteiten).where(eq(billerEntiteiten.id, id)).get();
  }

  // --- Organisaties --------------------------------------------------------
  async listOrganisaties(): Promise<Array<Organisatie & { saldo: CreditSaldo }>> {
    const orgs = db.select().from(organisaties).orderBy(desc(organisaties.id)).all();
    return orgs.map((o) => ({ ...o, saldo: this.saldoSync(o.id) }));
  }

  async getOrganisatie(id: number): Promise<Organisatie | undefined> {
    return db.select().from(organisaties).where(eq(organisaties.id, id)).get();
  }

  async createOrganisatie(data: InsertOrganisatie): Promise<Organisatie> {
    // Afgeleid: peppol-bereikbare organisaties krijgen factuurType 'peppol'.
    const factuurType = data.peppolBereikbaar ? "peppol" : "pdf";
    const org = db
      .insert(organisaties)
      .values({
        naam: data.naam,
        type: data.type,
        btwNummer: data.btwNummer || null,
        kboNummer: data.kboNummer || null,
        peppolId: data.peppolId || null,
        peppolBereikbaar: data.peppolBereikbaar ?? false,
        factuurType,
        contactpersoon: data.contactpersoon || null,
        email: data.email || null,
        adres: data.adres || null,
        postcode: data.postcode || null,
        gemeente: data.gemeente || null,
        land: data.land || "België",
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
    // Initialiseer een nulsaldo zodat elke organisatie altijd een saldoregel heeft.
    db.insert(creditSaldi)
      .values({ organisatieId: org.id, beschikbaar: 0, gereserveerd: 0, verbruikt: 0, updatedAt: new Date().toISOString() })
      .run();
    return org;
  }

  // --- Credits: synchrone helper voor saldo (gebruikt binnen transacties) --
  private saldoSync(organisatieId: number): CreditSaldo {
    let s = db.select().from(creditSaldi).where(eq(creditSaldi.organisatieId, organisatieId)).get();
    if (!s) {
      s = db
        .insert(creditSaldi)
        .values({ organisatieId, beschikbaar: 0, gereserveerd: 0, verbruikt: 0, updatedAt: new Date().toISOString() })
        .returning()
        .get();
    }
    return s;
  }

  async getSaldo(organisatieId: number): Promise<CreditSaldo> {
    return this.saldoSync(organisatieId);
  }

  // Logboekregel + saldo-update gebeuren altijd samen binnen één transactie.
  private async boekTransactie(
    organisatieId: number,
    type: string,
    aantal: number,
    patch: Partial<CreditSaldo>,
    opts: { afnameId?: number | null; omschrijving?: string | null }
  ): Promise<CreditSaldo> {
    const billerId = (await this.getActieveBiller())?.id ?? null;
    const tx = sqlite.transaction(() => {
      const now = new Date().toISOString();
      this.saldoSync(organisatieId); // zorgt dat de saldoregel bestaat
      db.update(creditSaldi)
        .set({ ...patch, updatedAt: now })
        .where(eq(creditSaldi.organisatieId, organisatieId))
        .run();
      db.insert(creditTransacties)
        .values({
          organisatieId,
          type,
          aantal,
          afnameId: opts.afnameId ?? null,
          billerEntiteitId: billerId,
          omschrijving: opts.omschrijving ?? null,
          createdAt: now,
        })
        .run();
    });
    tx();
    return this.saldoSync(organisatieId);
  }

  // Aankoop: credits opladen -> beschikbaar stijgt.
  async laadCredits(organisatieId: number, aantal: number, omschrijving?: string): Promise<CreditSaldo> {
    const s = this.saldoSync(organisatieId);
    return this.boekTransactie(
      organisatieId,
      "aankoop",
      aantal,
      { beschikbaar: s.beschikbaar + aantal },
      { omschrijving: omschrijving ?? `Aankoop ${aantal} credits` }
    );
  }

  // Reservering bij linkaanmaak: beschikbaar -> gereserveerd.
  async reserveer(organisatieId: number, afnameId: number): Promise<CreditSaldo> {
    const s = this.saldoSync(organisatieId);
    if (s.beschikbaar < 1) {
      throw new CreditError("Onvoldoende credits beschikbaar om een link aan te maken");
    }
    return this.boekTransactie(
      organisatieId,
      "reservering",
      -1,
      { beschikbaar: s.beschikbaar - 1, gereserveerd: s.gereserveerd + 1 },
      { afnameId, omschrijving: `Reservering voor afname #${afnameId}` }
    );
  }

  // Definitief verbruik bij voltooiing: gereserveerd -> verbruikt.
  async verbruik(organisatieId: number, afnameId: number): Promise<CreditSaldo> {
    const s = this.saldoSync(organisatieId);
    if (s.gereserveerd < 1) {
      // Defensief: niets gereserveerd, niets te verbruiken (idempotent).
      return s;
    }
    return this.boekTransactie(
      organisatieId,
      "verbruik",
      -1,
      { gereserveerd: s.gereserveerd - 1, verbruikt: s.verbruikt + 1 },
      { afnameId, omschrijving: `Verbruik bij voltooiing afname #${afnameId}` }
    );
  }

  // Vrijgave bij verval/annulatie: gereserveerd -> beschikbaar.
  async geefVrij(organisatieId: number, afnameId: number): Promise<CreditSaldo> {
    const s = this.saldoSync(organisatieId);
    if (s.gereserveerd < 1) return s;
    return this.boekTransactie(
      organisatieId,
      "vrijgave",
      1,
      { gereserveerd: s.gereserveerd - 1, beschikbaar: s.beschikbaar + 1 },
      { afnameId, omschrijving: `Vrijgave reservering afname #${afnameId}` }
    );
  }

  // Boekhoudkundige overdracht van beschikbare credits tussen organisaties
  // (bv. bij entiteitswissel of herverdeling). Atomair: af bij de bron,
  // bij bij de bestemming, met twee grootboekregels.
  async overdracht(vanId: number, naarId: number, aantal: number, omschrijving?: string): Promise<void> {
    if (vanId === naarId) throw new CreditError("Bron en bestemming mogen niet gelijk zijn");
    if (aantal < 1) throw new CreditError("Aantal moet groter dan 0 zijn");
    const bron = this.saldoSync(vanId);
    if (bron.beschikbaar < aantal) {
      throw new CreditError("Onvoldoende beschikbare credits voor overdracht");
    }
    const bestemming = this.saldoSync(naarId);
    const billerId = (await this.getActieveBiller())?.id ?? null;
    const tx = sqlite.transaction(() => {
      const now = new Date().toISOString();
      db.update(creditSaldi)
        .set({ beschikbaar: bron.beschikbaar - aantal, updatedAt: now })
        .where(eq(creditSaldi.organisatieId, vanId))
        .run();
      db.update(creditSaldi)
        .set({ beschikbaar: bestemming.beschikbaar + aantal, updatedAt: now })
        .where(eq(creditSaldi.organisatieId, naarId))
        .run();
      db.insert(creditTransacties)
        .values({
          organisatieId: vanId,
          type: "overdracht",
          aantal: -aantal,
          afnameId: null,
          billerEntiteitId: billerId,
          omschrijving: omschrijving ?? `Overdracht naar organisatie #${naarId}`,
          createdAt: now,
        })
        .run();
      db.insert(creditTransacties)
        .values({
          organisatieId: naarId,
          type: "overdracht",
          aantal: aantal,
          afnameId: null,
          billerEntiteitId: billerId,
          omschrijving: omschrijving ?? `Overdracht van organisatie #${vanId}`,
          createdAt: now,
        })
        .run();
    });
    tx();
  }

  async listTransacties(organisatieId?: number): Promise<CreditTransactie[]> {
    if (organisatieId != null) {
      return db
        .select()
        .from(creditTransacties)
        .where(eq(creditTransacties.organisatieId, organisatieId))
        .orderBy(desc(creditTransacties.id))
        .all();
    }
    return db.select().from(creditTransacties).orderBy(desc(creditTransacties.id)).all();
  }

  // --- Betalingen (Fase C2) ------------------------------------------------
  // Prijs per credit: afgeleid van het Starter-pakket (single-purpose voucher,
  // één tarief). Alle bedragen in eurocent om afrondingsfouten te vermijden.
  private prijsPerCreditCent(): number {
    const starter = CREDITPAKKETTEN.find((p) => p.id === "start") ?? CREDITPAKKETTEN[0];
    return Math.round((starter.prijsExclBtw / starter.credits) * 100);
  }

  async startBetaling(
    organisatieId: number,
    credits: number,
    pakketId?: string | null
  ): Promise<Betaling> {
    const biller = await this.getActieveBiller();
    const btwTarief = biller?.btwTarief ?? 21;
    const exclCent = this.prijsPerCreditCent() * credits;
    const btwCent = Math.round((exclCent * btwTarief) / 100);
    const inclCent = exclCent + btwCent;
    const now = new Date().toISOString();
    const betaling = db
      .insert(betalingen)
      .values({
        organisatieId,
        provider: "mollie",
        providerRef: `tr_sim_${Date.now()}`,
        pakketId: pakketId ?? null,
        credits,
        bedragExclBtw: exclCent,
        btwTarief,
        btwBedrag: btwCent,
        bedragInclBtw: inclCent,
        munt: "EUR",
        status: "open",
        // Gesimuleerde checkout-URL (in productie: de Mollie-redirect).
        checkoutUrl: `#/betaling/sim`,
        createdAt: now,
      })
      .returning()
      .get();
    return betaling;
  }

  async getBetaling(id: number): Promise<Betaling | undefined> {
    return db.select().from(betalingen).where(eq(betalingen.id, id)).get();
  }

  async listBetalingen(organisatieId?: number): Promise<Betaling[]> {
    if (organisatieId != null) {
      return db
        .select()
        .from(betalingen)
        .where(eq(betalingen.organisatieId, organisatieId))
        .orderBy(desc(betalingen.id))
        .all();
    }
    return db.select().from(betalingen).orderBy(desc(betalingen.id)).all();
  }

  async markeerBetalingMislukt(id: number): Promise<Betaling | undefined> {
    return db
      .update(betalingen)
      .set({ status: "mislukt" })
      .where(eq(betalingen.id, id))
      .returning()
      .get();
  }

  // Volgend factuurnummer voor de actieve biller: PREFIX-JAAR-NNNN.
  private volgendFactuurnummer(prefix: string): string {
    const jaar = new Date().getFullYear();
    const zoek = `${prefix}-${jaar}-`;
    const bestaande = db.select().from(facturen).all();
    let max = 0;
    for (const f of bestaande) {
      if (f.factuurnummer.startsWith(zoek)) {
        const n = parseInt(f.factuurnummer.slice(zoek.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `${zoek}${String(max + 1).padStart(4, "0")}`;
  }

  // Bevestig een geslaagde betaling (de webhook-equivalent). Atomair:
  //   1) credits opladen (aankooptransactie),
  //   2) factuur aanmaken (provider-neutraal, Peppol-klaar indien bereikbaar),
  //   3) betaling op 'betaald' zetten en koppelen.
  // Idempotent: een reeds betaalde betaling levert de bestaande factuur terug.
  async bevestigBetaling(
    id: number,
    methode?: string
  ): Promise<{ betaling: Betaling; factuur: Factuur } | undefined> {
    const betaling = await this.getBetaling(id);
    if (!betaling) return undefined;
    // Idempotent: een reeds betaalde betaling levert gewoon de bestaande factuur terug.
    if (betaling.status === "betaald") {
      const bestaand = betaling.factuurId ? await this.getFactuur(betaling.factuurId) : undefined;
      if (bestaand) return { betaling, factuur: bestaand };
    }
    // Een mislukte of verlopen betaling mag NOOIT alsnog credits opladen of een
    // factuur aanmaken. Alleen 'open' betalingen kunnen bevestigd worden.
    if (betaling.status !== "open") {
      throw new CreditError(`Betaling kan niet bevestigd worden (status: ${betaling.status})`);
    }
    const org = await this.getOrganisatie(betaling.organisatieId);
    if (!org) throw new CreditError("Organisatie niet gevonden voor betaling");
    const biller = await this.getActieveBiller();
    if (!biller) throw new CreditError("Geen actieve facturerende entiteit");

    const now = new Date().toISOString();
    const kanaal = org.peppolBereikbaar ? "peppol" : "pdf";
    const factuurnummer = this.volgendFactuurnummer(biller.factuurPrefix);

    // Provider-neutraal UBL-achtig document (zodat latere PSP/Peppol-wissel kan).
    const peppolDocument = {
      profiel: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      documenttype: "Invoice",
      factuurnummer,
      uitgiftedatum: now.slice(0, 10),
      munt: betaling.munt,
      verkoper: {
        naam: biller.vennootschapsnaam,
        btw: biller.btwNummer,
        kbo: biller.kboNummer,
        peppolId: biller.peppolId,
        adres: { straat: biller.adres, postcode: biller.postcode, gemeente: biller.gemeente, land: biller.land },
      },
      koper: {
        naam: org.naam,
        btw: org.btwNummer,
        kbo: org.kboNummer,
        peppolId: org.peppolId,
        adres: { straat: org.adres, postcode: org.postcode, gemeente: org.gemeente, land: org.land },
      },
      regels: [
        {
          omschrijving: `TaPas credits (${betaling.credits} stuks)`,
          aantal: betaling.credits,
          eenheidsprijsExclCent: this.prijsPerCreditCent(),
          btwTarief: betaling.btwTarief,
          totaalExclCent: betaling.bedragExclBtw,
        },
      ],
      totalen: {
        exclBtwCent: betaling.bedragExclBtw,
        btwCent: betaling.btwBedrag,
        inclBtwCent: betaling.bedragInclBtw,
      },
    };

    const regels = [
      {
        omschrijving: `TaPas credits (${betaling.credits} stuks)`,
        aantal: betaling.credits,
        eenheidsprijsExclCent: this.prijsPerCreditCent(),
        btwTarief: betaling.btwTarief,
        totaalExclCent: betaling.bedragExclBtw,
      },
    ];

    // Eerst de credits opladen (eigen transactie binnen boekTransactie).
    await this.laadCredits(
      betaling.organisatieId,
      betaling.credits,
      `Online betaling #${betaling.id} (${betaling.credits} credits)`
    );
    // Haal de zojuist aangemaakte aankooptransactie op (meest recente aankoop).
    const laatsteAankoop = db
      .select()
      .from(creditTransacties)
      .where(eq(creditTransacties.organisatieId, betaling.organisatieId))
      .orderBy(desc(creditTransacties.id))
      .get();

    // Factuur + betaling-update atomair.
    const factuur = db
      .insert(facturen)
      .values({
        factuurnummer,
        billerEntiteitId: biller.id,
        organisatieId: org.id,
        betalingId: betaling.id,
        billerSnapshot: JSON.stringify({
          naam: biller.naam,
          vennootschapsnaam: biller.vennootschapsnaam,
          adres: biller.adres,
          postcode: biller.postcode,
          gemeente: biller.gemeente,
          land: biller.land,
          btwNummer: biller.btwNummer,
          kboNummer: biller.kboNummer,
          peppolId: biller.peppolId,
        }),
        klantSnapshot: JSON.stringify({
          naam: org.naam,
          btwNummer: org.btwNummer,
          kboNummer: org.kboNummer,
          peppolId: org.peppolId,
          email: org.email,
          adres: org.adres,
          postcode: org.postcode,
          gemeente: org.gemeente,
          land: org.land,
        }),
        regels: JSON.stringify(regels),
        bedragExclBtw: betaling.bedragExclBtw,
        btwBedrag: betaling.btwBedrag,
        bedragInclBtw: betaling.bedragInclBtw,
        munt: betaling.munt,
        kanaal,
        peppolStatus: kanaal === "peppol" ? "klaar" : "n.v.t.",
        peppolDocument: kanaal === "peppol" ? JSON.stringify(peppolDocument) : null,
        factuurdatum: now,
        createdAt: now,
      })
      .returning()
      .get();

    const bijgewerkt = db
      .update(betalingen)
      .set({
        status: "betaald",
        methode: methode ?? "bancontact",
        betaaldAt: now,
        creditTransactieId: laatsteAankoop?.id ?? null,
        factuurId: factuur.id,
      })
      .where(eq(betalingen.id, betaling.id))
      .returning()
      .get();

    return { betaling: bijgewerkt, factuur };
  }

  // --- Facturen (Fase C2-C3) -----------------------------------------------
  async getFactuur(id: number): Promise<Factuur | undefined> {
    return db.select().from(facturen).where(eq(facturen.id, id)).get();
  }

  async listFacturen(organisatieId?: number): Promise<Factuur[]> {
    if (organisatieId != null) {
      return db
        .select()
        .from(facturen)
        .where(eq(facturen.organisatieId, organisatieId))
        .orderBy(desc(facturen.id))
        .all();
    }
    return db.select().from(facturen).orderBy(desc(facturen.id)).all();
  }

  // --- Rapporten (Fase C3) -------------------------------------------------
  async genereerRapport(
    afnameId: number,
    variant: "kompas" | "coachatlas"
  ): Promise<Rapport> {
    const afname = await this.getAfname(afnameId);
    if (!afname) throw new CreditError("Afname niet gevonden");
    if (afname.status !== "voltooid" || !afname.generatorContract) {
      throw new CreditError("Afname is nog niet voltooid; er is geen contract om een rapport uit te genereren");
    }
    const contract = JSON.parse(afname.generatorContract);
    const inhoud = bouwRapportInhoud(contract, variant);
    const html = renderRapportHtml(inhoud);
    const now = new Date().toISOString();
    return db
      .insert(rapporten)
      .values({
        afnameId,
        variant,
        titel: `${inhoud.titel} — ${inhoud.respondent.naam}`,
        inhoud: JSON.stringify(inhoud),
        html,
        contractVersie: contract?.contractVersion ?? "1.0.0",
        createdAt: now,
      })
      .returning()
      .get();
  }

  async getRapport(id: number): Promise<Rapport | undefined> {
    return db.select().from(rapporten).where(eq(rapporten.id, id)).get();
  }

  async listRapporten(afnameId?: number): Promise<Rapport[]> {
    if (afnameId != null) {
      return db
        .select()
        .from(rapporten)
        .where(eq(rapporten.afnameId, afnameId))
        .orderBy(desc(rapporten.id))
        .all();
    }
    return db.select().from(rapporten).orderBy(desc(rapporten.id)).all();
  }

  // --- Creditnota's (Fase C4a) ---------------------------------------------
  // Volgend creditnotanummer: PREFIX-CN-JAAR-NNNN (eigen doorlopende reeks).
  private volgendCreditnotanummer(prefix: string): string {
    const jaar = new Date().getFullYear();
    const zoek = `${prefix}-CN-${jaar}-`;
    const bestaande = db.select().from(creditnotas).all();
    let max = 0;
    for (const c of bestaande) {
      if (c.creditnotanummer.startsWith(zoek)) {
        const n = parseInt(c.creditnotanummer.slice(zoek.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `${zoek}${String(max + 1).padStart(4, "0")}`;
  }

  // Een creditnota corrigeert een bestaande factuur. De factuur zelf blijft
  // onveranderd (onveranderlijkheid). Bedragen zijn de negatieve spiegel van
  // de factuur. Optioneel worden de verkochte credits teruggeboekt.
  async maakCreditnota(
    factuurId: number,
    reden: string,
    creditsTerugboeken: boolean
  ): Promise<Creditnota> {
    const factuur = await this.getFactuur(factuurId);
    if (!factuur) throw new CreditError("Factuur niet gevonden");
    const bestaand = db
      .select()
      .from(creditnotas)
      .where(eq(creditnotas.factuurId, factuurId))
      .get();
    if (bestaand) {
      throw new CreditError("Er bestaat al een creditnota voor deze factuur");
    }
    const biller = await this.getActieveBiller();
    if (!biller) throw new CreditError("Geen actieve facturerende entiteit");
    const now = new Date().toISOString();
    const nummer = this.volgendCreditnotanummer(biller.factuurPrefix);

    const origRegels = JSON.parse(factuur.regels) as Array<any>;
    const negRegels = origRegels.map((r) => ({
      ...r,
      aantal: -Math.abs(r.aantal),
      totaalExclCent: -Math.abs(r.totaalExclCent),
    }));

    const peppolDocument = {
      profiel: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      documenttype: "CreditNote",
      creditnotanummer: nummer,
      verwijstNaarFactuur: factuur.factuurnummer,
      uitgiftedatum: now.slice(0, 10),
      munt: factuur.munt,
      verkoper: JSON.parse(factuur.billerSnapshot),
      koper: JSON.parse(factuur.klantSnapshot),
      regels: negRegels,
      totalen: {
        exclBtwCent: -Math.abs(factuur.bedragExclBtw),
        btwCent: -Math.abs(factuur.btwBedrag),
        inclBtwCent: -Math.abs(factuur.bedragInclBtw),
      },
      reden,
    };

    const creditnota = db
      .insert(creditnotas)
      .values({
        creditnotanummer: nummer,
        factuurId: factuur.id,
        billerEntiteitId: factuur.billerEntiteitId,
        organisatieId: factuur.organisatieId,
        reden,
        billerSnapshot: factuur.billerSnapshot,
        klantSnapshot: factuur.klantSnapshot,
        regels: JSON.stringify(negRegels),
        bedragExclBtw: -Math.abs(factuur.bedragExclBtw),
        btwBedrag: -Math.abs(factuur.btwBedrag),
        bedragInclBtw: -Math.abs(factuur.bedragInclBtw),
        munt: factuur.munt,
        kanaal: factuur.kanaal,
        peppolStatus: factuur.kanaal === "peppol" ? "klaar" : "n.v.t.",
        peppolDocument: factuur.kanaal === "peppol" ? JSON.stringify(peppolDocument) : null,
        creditsTeruggeboekt: creditsTerugboeken,
        creditnotaDatum: now,
        createdAt: now,
      })
      .returning()
      .get();

    if (creditsTerugboeken) {
      const aantal = origRegels.reduce((s, r) => s + Math.abs(r.aantal), 0);
      const s = this.saldoSync(factuur.organisatieId);
      const terug = Math.min(aantal, s.beschikbaar);
      if (terug > 0) {
        await this.boekTransactie(
          factuur.organisatieId,
          "correctie",
          -terug,
          { beschikbaar: s.beschikbaar - terug },
          { omschrijving: `Terugboeking via creditnota ${nummer} (factuur ${factuur.factuurnummer})` }
        );
      }
    }

    return creditnota;
  }

  async getCreditnota(id: number): Promise<Creditnota | undefined> {
    return db.select().from(creditnotas).where(eq(creditnotas.id, id)).get();
  }

  async listCreditnotas(organisatieId?: number): Promise<Creditnota[]> {
    if (organisatieId != null) {
      return db
        .select()
        .from(creditnotas)
        .where(eq(creditnotas.organisatieId, organisatieId))
        .orderBy(desc(creditnotas.id))
        .all();
    }
    return db.select().from(creditnotas).orderBy(desc(creditnotas.id)).all();
  }

  // --- Bestuursrapportage (Fase C4b) ---------------------------------------
  async bestuursKpis(): Promise<BestuursKpis> {
    const euro = (cent: number) => Number((cent / 100).toFixed(2));
    const pct = (deel: number, geheel: number) =>
      geheel > 0 ? Number(((deel / geheel) * 100).toFixed(1)) : 0;

    const alleFacturen = db.select().from(facturen).all();
    const alleCreditnotas = db.select().from(creditnotas).all();
    const alleOrgs = db.select().from(organisaties).all();
    const alleSaldi = db.select().from(creditSaldi).all();
    const alleAfnames = db.select().from(afnames).all();
    const alleBetalingen = db.select().from(betalingen).all();
    const alleRapporten = db.select().from(rapporten).all();
    const alleTransacties = db.select().from(creditTransacties).all();

    const omzetExcl = alleFacturen.reduce((s, f) => s + f.bedragExclBtw, 0);
    const omzetBtw = alleFacturen.reduce((s, f) => s + f.btwBedrag, 0);
    const omzetIncl = alleFacturen.reduce((s, f) => s + f.bedragInclBtw, 0);
    const cnExcl = alleCreditnotas.reduce((s, c) => s + c.bedragExclBtw, 0);
    const nettoExcl = omzetExcl + cnExcl;

    const betalendeOrgIds = new Set(alleFacturen.map((f) => f.organisatieId));
    const perType: Record<string, number> = {};
    for (const o of alleOrgs) perType[o.type] = (perType[o.type] ?? 0) + 1;

    const verkocht = alleTransacties
      .filter((t) => t.type === "aankoop")
      .reduce((s, t) => s + t.aantal, 0);
    const verbruikt = alleSaldi.reduce((s, x) => s + x.verbruikt, 0);
    const gereserveerd = alleSaldi.reduce((s, x) => s + x.gereserveerd, 0);
    const beschikbaar = alleSaldi.reduce((s, x) => s + x.beschikbaar, 0);

    const voltooid = alleAfnames.filter((a) => a.status === "voltooid").length;
    const inUitvoering = alleAfnames.filter(
      (a) => a.status === "deel1" || a.status === "deel2"
    ).length;

    const geslaagd = alleBetalingen.filter((b) => b.status === "betaald").length;
    const mislukt = alleBetalingen.filter(
      (b) => b.status === "mislukt" || b.status === "verlopen"
    ).length;
    const openBet = alleBetalingen.filter((b) => b.status === "open").length;

    const metPg = alleAfnames.filter((a) => !a.geanonimiseerdAt).length;
    const geanon = alleAfnames.filter((a) => !!a.geanonimiseerdAt).length;
    const ingetrokken = alleAfnames.filter((a) => !!a.consentIngetrokkenAt).length;
    const nu = new Date().toISOString().slice(0, 10);
    const verstreken = alleAfnames.filter(
      (a) => !a.geanonimiseerdAt && a.bewaartotDatum && a.bewaartotDatum.slice(0, 10) < nu
    ).length;

    return {
      gegenereerdOp: new Date().toISOString(),
      munt: "EUR",
      omzet: {
        totaalExclBtw: euro(omzetExcl),
        totaalBtw: euro(omzetBtw),
        totaalInclBtw: euro(omzetIncl),
        nettoExclBtwNaCreditnotas: euro(nettoExcl),
        aantalFacturen: alleFacturen.length,
        aantalCreditnotas: alleCreditnotas.length,
      },
      klanten: {
        aantalOrganisaties: alleOrgs.length,
        aantalBetalendeOrganisaties: betalendeOrgIds.size,
        perType,
      },
      credits: {
        verkocht,
        verbruikt,
        gereserveerd,
        beschikbaarUitstaand: beschikbaar,
        verzilveringsgraad: pct(verbruikt, verkocht),
      },
      afnames: {
        totaal: alleAfnames.length,
        voltooid,
        inUitvoering,
        voltooiingsgraad: pct(voltooid, alleAfnames.length),
        rapportenGegenereerd: alleRapporten.length,
      },
      betalingen: {
        geslaagd,
        mislukt,
        open: openBet,
        slagingsgraad: pct(geslaagd, geslaagd + mislukt),
      },
      gemiddelden: {
        gemiddeldeOrderwaardeExclBtw:
          alleFacturen.length > 0 ? euro(omzetExcl / alleFacturen.length) : 0,
        omzetPerBetalendeOrganisatie:
          betalendeOrgIds.size > 0 ? euro(nettoExcl / betalendeOrgIds.size) : 0,
      },
      gdpr: {
        afnamesMetPersoonsgegevens: metPg,
        geanonimiseerd: geanon,
        consentIngetrokken: ingetrokken,
        bewaartermijnVerstreken: verstreken,
      },
    };
  }

  async boekhoudExport(): Promise<BoekhoudExportRegel[]> {
    const euro = (cent: number) => Number((cent / 100).toFixed(2));
    const regels: BoekhoudExportRegel[] = [];
    const fs = db.select().from(facturen).orderBy(facturen.id).all();
    for (const f of fs) {
      const klant = JSON.parse(f.klantSnapshot);
      const eersteRegel = (JSON.parse(f.regels) as Array<any>)[0];
      regels.push({
        documenttype: "factuur",
        nummer: f.factuurnummer,
        datum: f.factuurdatum.slice(0, 10),
        klant: klant.naam ?? "",
        klantBtw: klant.btwNummer ?? null,
        bedragExclBtw: euro(f.bedragExclBtw),
        btwTarief: eersteRegel?.btwTarief ?? 21,
        btwBedrag: euro(f.btwBedrag),
        bedragInclBtw: euro(f.bedragInclBtw),
        munt: f.munt,
        kanaal: f.kanaal,
      });
    }
    const cns = db.select().from(creditnotas).orderBy(creditnotas.id).all();
    for (const c of cns) {
      const klant = JSON.parse(c.klantSnapshot);
      const eersteRegel = (JSON.parse(c.regels) as Array<any>)[0];
      regels.push({
        documenttype: "creditnota",
        nummer: c.creditnotanummer,
        datum: c.creditnotaDatum.slice(0, 10),
        klant: klant.naam ?? "",
        klantBtw: klant.btwNummer ?? null,
        bedragExclBtw: euro(c.bedragExclBtw),
        btwTarief: eersteRegel?.btwTarief ?? 21,
        btwBedrag: euro(c.btwBedrag),
        bedragInclBtw: euro(c.bedragInclBtw),
        munt: c.munt,
        kanaal: c.kanaal,
      });
    }
    return regels;
  }

  // --- GDPR (Fase C4c) -----------------------------------------------------
  async gdprExport(afnameId: number): Promise<any> {
    const a = await this.getAfname(afnameId);
    if (!a) throw new CreditError("Afname niet gevonden");
    const org = a.organisatieId ? await this.getOrganisatie(a.organisatieId) : undefined;
    const reps = await this.listRapporten(afnameId);
    return {
      exportType: "GDPR-betrokkenenexport (AVG art. 15 & 20)",
      gegenereerdOp: new Date().toISOString(),
      verwerkingsverantwoordelijke: (await this.getActieveBiller())?.vennootschapsnaam ?? null,
      betrokkene: {
        afnameId: a.id,
        respondentCode: a.respondentCode,
        naam: a.geanonimiseerdAt ? "[geanonimiseerd]" : a.name,
        bedrijf: a.company,
        rol: a.role,
      },
      verwerking: {
        doel: a.verwerkingsdoel,
        rechtsgrond: a.rechtsgrond,
        toestemmingGegeven: a.consentGiven,
        toestemmingScope: a.consentScope,
        toestemmingTijdstip: a.consentTimestamp,
        privacyverklaringVersie: a.privacyverklaringVersie,
        toestemmingIngetrokkenOp: a.consentIngetrokkenAt,
        bewaartotDatum: a.bewaartotDatum,
        geanonimiseerdOp: a.geanonimiseerdAt,
        opdrachtgevendeOrganisatie: org ? { id: org.id, naam: org.naam } : null,
      },
      verzameldeGegevens: {
        baselineEnergie: a.baselineEnergy,
        status: a.status,
        aangemaaktOp: a.createdAt,
        voltooidOp: a.completedAt,
        ruweAntwoordenDeel1: a.mainResponses ? JSON.parse(a.mainResponses) : null,
        ruweAntwoordenDeel2: a.connectionAnswers ? JSON.parse(a.connectionAnswers) : null,
        gegenereerdProfiel: a.generatorContract ? JSON.parse(a.generatorContract) : null,
      },
      afgeleideDocumenten: reps.map((r) => ({
        id: r.id,
        variant: r.variant,
        titel: r.titel,
        aangemaaktOp: r.createdAt,
      })),
    };
  }

  async anonimiseerAfname(afnameId: number, reden: string): Promise<Afname | undefined> {
    const a = await this.getAfname(afnameId);
    if (!a) return undefined;
    if (a.geanonimiseerdAt) return a;
    const now = new Date().toISOString();
    return db
      .update(afnames)
      .set({
        name: "[geanonimiseerd]",
        company: null,
        role: null,
        mainResponses: null,
        connectionAnswers: null,
        generatorContract: null,
        consentIp: null,
        consentUserAgent: null,
        geanonimiseerdAt: now,
        consentScope: `geanonimiseerd: ${reden}`,
      })
      .where(eq(afnames.id, afnameId))
      .returning()
      .get();
  }

  async trekConsentIn(afnameId: number): Promise<Afname | undefined> {
    const a = await this.getAfname(afnameId);
    if (!a) return undefined;
    const now = new Date().toISOString();
    return db
      .update(afnames)
      .set({ consentIngetrokkenAt: now })
      .where(eq(afnames.id, afnameId))
      .returning()
      .get();
  }

  // --- Deelnemers & persoonlijk dashboard (TaPas Persoonlijk — Fase 1) ------
  // E-mail wordt genormaliseerd (lowercase, trim) zodat login en koppeling
  // hoofdletterongevoelig zijn.
  private normEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async vindOfMaakDeelnemer(email: string, taal?: string): Promise<Deelnemer> {
    const e = this.normEmail(email);
    const bestaand = await this.getDeelnemerByEmail(e);
    if (bestaand) {
      // Synchroniseer de naam vanuit de meest recente afname als die nog leeg is.
      if (!bestaand.naam) {
        const afn = await this.listAfnamesVoorDeelnemer(e);
        const naam = afn.find((a) => a.name && a.name !== "(nog niet ingevuld)")?.name;
        if (naam) {
          return (await this.updateDeelnemer(bestaand.id, { naam })) ?? bestaand;
        }
      }
      return bestaand;
    }
    // Nieuwe deelnemer: haal (optioneel) naam uit een reeds gekoppelde afname.
    const afn = await this.listAfnamesVoorDeelnemer(e);
    const naam = afn.find((a) => a.name && a.name !== "(nog niet ingevuld)")?.name ?? null;
    const token = `${cryptoRandom(10)}${cryptoRandom(10)}${cryptoRandom(10)}`;
    return db
      .insert(deelnemers)
      .values({
        email: e,
        naam,
        taal: taal ?? afn[0]?.taal ?? "nl",
        dashboardToken: token,
        mailCadans: "uit",
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  async getDeelnemerByEmail(email: string): Promise<Deelnemer | undefined> {
    return db.select().from(deelnemers).where(eq(deelnemers.email, this.normEmail(email))).get();
  }

  async getDeelnemerByToken(token: string): Promise<Deelnemer | undefined> {
    return db.select().from(deelnemers).where(eq(deelnemers.dashboardToken, token)).get();
  }

  async updateDeelnemer(id: number, patch: UpdateDeelnemer): Promise<Deelnemer | undefined> {
    const set: Record<string, unknown> = {};
    if (patch.naam !== undefined) set.naam = patch.naam;
    if (patch.fotoUrl !== undefined) set.fotoUrl = patch.fotoUrl;
    if (patch.taal !== undefined) set.taal = patch.taal;
    if (patch.mailCadans !== undefined) {
      set.mailCadans = patch.mailCadans;
      set.mailUitgeschrevenAt = patch.mailCadans === "uit" ? new Date().toISOString() : null;
    }
    if (Object.keys(set).length === 0) {
      return db.select().from(deelnemers).where(eq(deelnemers.id, id)).get();
    }
    return db.update(deelnemers).set(set).where(eq(deelnemers.id, id)).returning().get();
  }

  async koppelAfnameAanDeelnemer(afnameId: number, email: string): Promise<Afname | undefined> {
    return db
      .update(afnames)
      .set({ deelnemerEmail: this.normEmail(email) })
      .where(eq(afnames.id, afnameId))
      .returning()
      .get();
  }

  async listAfnamesVoorDeelnemer(email: string): Promise<Afname[]> {
    return db
      .select()
      .from(afnames)
      .where(eq(afnames.deelnemerEmail, this.normEmail(email)))
      .orderBy(desc(afnames.id))
      .all();
  }

  // --- AI-chatbot (Fase 2) -------------------------------------------------
  async verhoogVragenGebruikt(deelnemerId: number): Promise<Deelnemer | undefined> {
    const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
    if (!huidig) return undefined;
    return db
      .update(deelnemers)
      .set({ vragenGebruikt: (huidig.vragenGebruikt ?? 0) + 1 })
      .where(eq(deelnemers.id, deelnemerId))
      .returning()
      .get();
  }

  async voegVragenTegoedToe(deelnemerId: number, aantal: number): Promise<Deelnemer | undefined> {
    const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
    if (!huidig) return undefined;
    return db
      .update(deelnemers)
      .set({ vragenTegoed: (huidig.vragenTegoed ?? 0) + aantal })
      .where(eq(deelnemers.id, deelnemerId))
      .returning()
      .get();
  }

  // --- Gesproken profieluitleg (audio) -------------------------------------
  // Twee onafhankelijke tonen: "deelnemer" (warm) en "coach" (zakelijker).
  // Elke toon heeft een eigen teller en eigen tegoed; de coach betaalt apart.
  async verhoogUitlegGebruikt(
    deelnemerId: number,
    toon: "deelnemer" | "coach",
  ): Promise<Deelnemer | undefined> {
    const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
    if (!huidig) return undefined;
    const set =
      toon === "coach"
        ? { uitlegGebruiktCoach: (huidig.uitlegGebruiktCoach ?? 0) + 1 }
        : { uitlegGebruiktDeelnemer: (huidig.uitlegGebruiktDeelnemer ?? 0) + 1 };
    return db
      .update(deelnemers)
      .set(set)
      .where(eq(deelnemers.id, deelnemerId))
      .returning()
      .get();
  }

  async voegUitlegTegoedToe(
    deelnemerId: number,
    toon: "deelnemer" | "coach",
    aantal: number,
  ): Promise<Deelnemer | undefined> {
    const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
    if (!huidig) return undefined;
    const set =
      toon === "coach"
        ? { uitlegTegoedCoach: (huidig.uitlegTegoedCoach ?? 0) + aantal }
        : { uitlegTegoedDeelnemer: (huidig.uitlegTegoedDeelnemer ?? 0) + aantal };
    return db
      .update(deelnemers)
      .set(set)
      .where(eq(deelnemers.id, deelnemerId))
      .returning()
      .get();
  }

  async listChatBerichten(deelnemerId: number): Promise<ChatBericht[]> {
    return db
      .select()
      .from(chatBerichten)
      .where(eq(chatBerichten.deelnemerId, deelnemerId))
      .orderBy(chatBerichten.id)
      .all();
  }

  async voegChatBerichtToe(
    deelnemerId: number,
    rol: string,
    inhoud: string,
    veiligheid?: string | null,
  ): Promise<ChatBericht> {
    return db
      .insert(chatBerichten)
      .values({
        deelnemerId,
        rol,
        inhoud,
        veiligheid: veiligheid ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  // =========================================================================
  // T4Recruitment — Fase 2: licenties, sessies, kringleden, studies.
  //
  // Credit-boekingen voor sessies hergebruiken EXACT hetzelfde append-only
  // grootboek (boekTransactie) als de individuele afnames; enkel het bedrag
  // verschilt (sessietarief i.p.v. 1). Daardoor blijven saldo, KPI's en
  // facturatie consistent zonder parallel boekhoudspoor.
  // =========================================================================

  // --- Licenties (losse verkoop, buiten platform-credits) ------------------
  async maakLicentie(data: {
    klantnaam: string;
    klantEmail?: string | null;
    maxProfielen?: number | null;
    prijsPerProfielCent: number;
    geldigTot?: string | null;
    notities?: string | null;
  }): Promise<Licentie> {
    const now = new Date().toISOString();
    // Onraadbare, leesbare sleutel: T4R-XXXX-XXXX-XXXX.
    const sleutel = `T4R-${cryptoRandom(4)}-${cryptoRandom(4)}-${cryptoRandom(4)}`.toUpperCase();
    return db
      .insert(licenties)
      .values({
        sleutel,
        klantnaam: data.klantnaam,
        klantEmail: data.klantEmail ?? null,
        maxProfielen: data.maxProfielen ?? null,
        prijsPerProfielCent: data.prijsPerProfielCent,
        munt: "EUR",
        gebruikteProfielen: 0,
        geldigVan: now,
        geldigTot: data.geldigTot ?? null,
        status: "actief",
        notities: data.notities ?? null,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async listLicenties(): Promise<Licentie[]> {
    return db.select().from(licenties).orderBy(desc(licenties.id)).all();
  }

  async getLicentie(id: number): Promise<Licentie | undefined> {
    return db.select().from(licenties).where(eq(licenties.id, id)).get();
  }

  async getLicentieBySleutel(sleutel: string): Promise<Licentie | undefined> {
    return db.select().from(licenties).where(eq(licenties.sleutel, sleutel)).get();
  }

  async trekLicentieIn(id: number): Promise<Licentie | undefined> {
    return db
      .update(licenties)
      .set({ status: "ingetrokken" })
      .where(eq(licenties.id, id))
      .returning()
      .get();
  }

  // Valideert dat een licentie nog een profiel toelaat (geldig + niet uitgeput).
  private valideerLicentie(lic: Licentie): void {
    if (lic.status !== "actief") throw new CreditError("Licentie is niet actief");
    if (lic.geldigTot && new Date(lic.geldigTot) < new Date()) {
      throw new CreditError("Licentie is verlopen");
    }
    if (lic.maxProfielen != null && lic.gebruikteProfielen >= lic.maxProfielen) {
      throw new CreditError("Licentie heeft geen profielen meer beschikbaar");
    }
  }

  // --- Sessies (collaboratief rolprofiel-traject) --------------------------
  async maakSessie(data: {
    titel: string;
    facilitatorNaam?: string | null;
    facilitatorEmail?: string | null;
    taal?: string | null;
    organisatieId?: number | null;
    licentieId?: number | null;
  }): Promise<Sessie> {
    const now = new Date().toISOString();
    return db
      .insert(sessies)
      .values({
        instrumentId: "t4recruitment",
        organisatieId: data.organisatieId ?? null,
        licentieId: data.licentieId ?? null,
        titel: data.titel,
        facilitatorNaam: data.facilitatorNaam ?? null,
        facilitatorEmail: data.facilitatorEmail ?? null,
        taal: data.taal ?? "nl",
        status: "draft",
        kringVergrendeld: false,
        heropeningen: 0,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async getSessie(id: number): Promise<Sessie | undefined> {
    return db.select().from(sessies).where(eq(sessies.id, id)).get();
  }

  async listSessies(): Promise<Sessie[]> {
    return db.select().from(sessies).orderBy(desc(sessies.id)).all();
  }

  async updateSessie(id: number, patch: Partial<Sessie>): Promise<Sessie | undefined> {
    return db.update(sessies).set(patch).where(eq(sessies.id, id)).returning().get();
  }

  // Vergrendel de kring + reserveer het sessietarief. Modus A (credits):
  // beschikbaar -> gereserveerd voor SESSIE_CREDIT_KOST. Modus B (licentie):
  // valideer de licentie (geen reservering; verbruik gebeurt bij finalisatie).
  async vergrendelKring(sessieId: number): Promise<Sessie | undefined> {
    const s = await this.getSessie(sessieId);
    if (!s) return undefined;
    if (s.kringVergrendeld) return s; // idempotent
    if (s.organisatieId) {
      const saldo = this.saldoSync(s.organisatieId);
      if (saldo.beschikbaar < SESSIE_CREDIT_KOST) {
        throw new CreditError(
          `Onvoldoende credits: een T4Recruitment-sessie kost ${SESSIE_CREDIT_KOST} credits`,
        );
      }
      await this.boekTransactie(
        s.organisatieId,
        "reservering",
        -SESSIE_CREDIT_KOST,
        { beschikbaar: saldo.beschikbaar - SESSIE_CREDIT_KOST, gereserveerd: saldo.gereserveerd + SESSIE_CREDIT_KOST },
        { omschrijving: `Reservering T4Recruitment-sessie #${sessieId} (${SESSIE_CREDIT_KOST} credits)` },
      );
    } else if (s.licentieId) {
      const lic = await this.getLicentie(s.licentieId);
      if (!lic) throw new CreditError("Licentie niet gevonden");
      this.valideerLicentie(lic);
    } else {
      throw new CreditError("Sessie heeft geen betaalbron (organisatie of licentie)");
    }
    const now = new Date().toISOString();
    return this.updateSessie(sessieId, {
      kringVergrendeld: true,
      status: "sessie-geopend",
      vergrendeldAt: now,
    });
  }

  // Heropen een vergrendelde kring — kost het instelbare heropeningstarief
  // (alleen in credit-modus; bij een licentie is heropenen gratis binnen het
  // afgenomen profiel, want het profiel is al "in gebruik").
  async heropenKring(sessieId: number): Promise<Sessie | undefined> {
    const s = await this.getSessie(sessieId);
    if (!s) return undefined;
    if (!s.kringVergrendeld) return s; // al open
    if (s.organisatieId) {
      const saldo = this.saldoSync(s.organisatieId);
      if (saldo.beschikbaar < HEROPENING_CREDIT_KOST) {
        throw new CreditError(
          `Onvoldoende credits: een kring heropenen kost ${HEROPENING_CREDIT_KOST} credits`,
        );
      }
      // Heropenen kost het heropeningstarief (definitief verbruik) éN geeft de
      // lopende sessiereservering vrij, zodat ze bij de volgende vergrendeling
      // opnieuw — en niet dubbel — wordt gereserveerd. Beide boekingen lopen via
      // hetzelfde grootboek, zodat saldo-cache en grootboek consistent blijven.
      await this.boekTransactie(
        s.organisatieId,
        "verbruik",
        -HEROPENING_CREDIT_KOST,
        { beschikbaar: saldo.beschikbaar - HEROPENING_CREDIT_KOST, verbruikt: saldo.verbruikt + HEROPENING_CREDIT_KOST },
        { omschrijving: `Heropening kring sessie #${sessieId} (${HEROPENING_CREDIT_KOST} credits)` },
      );
      const naVerbruik = this.saldoSync(s.organisatieId);
      const vrij = Math.min(SESSIE_CREDIT_KOST, naVerbruik.gereserveerd);
      if (vrij > 0) {
        await this.boekTransactie(
          s.organisatieId,
          "vrijgave",
          vrij,
          { gereserveerd: naVerbruik.gereserveerd - vrij, beschikbaar: naVerbruik.beschikbaar + vrij },
          { omschrijving: `Vrijgave reservering sessie #${sessieId} bij heropening (${vrij} credits)` },
        );
      }
    }
    return this.updateSessie(sessieId, {
      kringVergrendeld: false,
      status: "stakeholders-bevestigd",
      heropeningen: (s.heropeningen ?? 0) + 1,
    });
  }

  // Finaliseer: definitief verbruik (credits: gereserveerd -> verbruikt) of
  // verhoog de licentieteller. Bevries optioneel het rolprofiel-contract.
  async finaliseerSessie(sessieId: number, rolprofielContract?: unknown): Promise<Sessie | undefined> {
    const s = await this.getSessie(sessieId);
    if (!s) return undefined;
    if (s.status === "vergrendeld") return s; // al gefinaliseerd (idempotent)
    if (s.organisatieId) {
      const saldo = this.saldoSync(s.organisatieId);
      const teVerbruiken = Math.min(SESSIE_CREDIT_KOST, saldo.gereserveerd);
      if (teVerbruiken > 0) {
        await this.boekTransactie(
          s.organisatieId,
          "verbruik",
          -teVerbruiken,
          { gereserveerd: saldo.gereserveerd - teVerbruiken, verbruikt: saldo.verbruikt + teVerbruiken },
          { omschrijving: `Verbruik T4Recruitment-sessie #${sessieId} bij finalisatie (${teVerbruiken} credits)` },
        );
      }
    } else if (s.licentieId) {
      const lic = await this.getLicentie(s.licentieId);
      if (lic) {
        db.update(licenties)
          .set({ gebruikteProfielen: lic.gebruikteProfielen + 1 })
          .where(eq(licenties.id, lic.id))
          .run();
      }
    }
    const now = new Date().toISOString();
    return this.updateSessie(sessieId, {
      status: "vergrendeld",
      gefinaliseerdAt: now,
      ...(rolprofielContract !== undefined
        ? { rolprofielContract: JSON.stringify(rolprofielContract) }
        : {}),
    });
  }

  // --- Kringleden ----------------------------------------------------------
  async voegKringlidToe(
    sessieId: number,
    data: { rol: SessieRol; naam?: string | null; email?: string | null },
  ): Promise<SessieDeelnemer> {
    const now = new Date().toISOString();
    const token = `${cryptoRandom(8)}-${cryptoRandom(8)}-${cryptoRandom(8)}`;
    return db
      .insert(sessieDeelnemers)
      .values({
        sessieId,
        rol: data.rol,
        naam: data.naam ?? null,
        email: data.email ?? null,
        inviteToken: token,
        status: "uitgenodigd",
        uitgenodigdAt: now,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async listKringleden(sessieId: number): Promise<SessieDeelnemer[]> {
    return db
      .select()
      .from(sessieDeelnemers)
      .where(eq(sessieDeelnemers.sessieId, sessieId))
      .orderBy(sessieDeelnemers.id)
      .all();
  }

  async getKringlidByToken(token: string): Promise<SessieDeelnemer | undefined> {
    return db.select().from(sessieDeelnemers).where(eq(sessieDeelnemers.inviteToken, token)).get();
  }

  async verwijderKringlid(id: number): Promise<void> {
    db.delete(sessieDeelnemers).where(eq(sessieDeelnemers.id, id)).run();
  }

  async updateKringlid(id: number, patch: Partial<SessieDeelnemer>): Promise<SessieDeelnemer | undefined> {
    return db
      .update(sessieDeelnemers)
      .set(patch)
      .where(eq(sessieDeelnemers.id, id))
      .returning()
      .get();
  }

  // --- Vergelijkende studie (0 credits) ------------------------------------
  async voegStudieToe(
    sessieId: number,
    kandidaatLabel: string,
    studieContract?: unknown,
  ): Promise<SessieStudie> {
    const now = new Date().toISOString();
    return db
      .insert(sessieStudies)
      .values({
        sessieId,
        kandidaatLabel,
        studieContract: studieContract !== undefined ? JSON.stringify(studieContract) : null,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async listStudies(sessieId: number): Promise<SessieStudie[]> {
    return db
      .select()
      .from(sessieStudies)
      .where(eq(sessieStudies.sessieId, sessieId))
      .orderBy(desc(sessieStudies.id))
      .all();
  }

  // --- Toegang & accreditatie -------------------------------------------

  async listBeheerders(): Promise<Beheerder[]> {
    return db.select().from(beheerders).orderBy(desc(beheerders.isPrior), beheerders.id).all();
  }

  async getBeheerder(id: number): Promise<Beheerder | undefined> {
    return db.select().from(beheerders).where(eq(beheerders.id, id)).get();
  }

  async getBeheerderByEmail(email: string): Promise<Beheerder | undefined> {
    return db.select().from(beheerders).where(eq(beheerders.email, email.toLowerCase())).get();
  }

  async maakBeheerder(data: InsertBeheerder & { toegevoegdDoor?: string }): Promise<Beheerder> {
    const now = new Date().toISOString();
    return db
      .insert(beheerders)
      .values({
        naam: data.naam,
        email: data.email.toLowerCase(),
        organisatie: data.organisatie ?? "TaPasCity",
        isPrior: data.isPrior ?? false,
        toegevoegdDoor: data.toegevoegdDoor ?? null,
        actief: data.actief ?? true,
        createdAt: now,
      })
      .returning()
      .get();
  }

  async zetBeheerderActief(id: number, actief: boolean): Promise<Beheerder | undefined> {
    return db
      .update(beheerders)
      .set({ actief })
      .where(eq(beheerders.id, id))
      .returning()
      .get();
  }

  async listToegangen(beheerderId: number): Promise<Toegang[]> {
    return db.select().from(toegangen).where(eq(toegangen.beheerderId, beheerderId)).all();
  }

  async listAlleToegangen(): Promise<Toegang[]> {
    return db.select().from(toegangen).all();
  }

  async zetToegang(
    beheerderId: number,
    platformdeel: string,
    toegestaan: boolean,
    gewijzigdDoor?: string,
  ): Promise<Toegang> {
    const now = new Date().toISOString();
    const bestaand = db
      .select()
      .from(toegangen)
      .where(and(eq(toegangen.beheerderId, beheerderId), eq(toegangen.platformdeel, platformdeel)))
      .get();
    if (bestaand) {
      return db
        .update(toegangen)
        .set({ toegestaan, gewijzigdDoor: gewijzigdDoor ?? null, updatedAt: now })
        .where(eq(toegangen.id, bestaand.id))
        .returning()
        .get();
    }
    return db
      .insert(toegangen)
      .values({ beheerderId, platformdeel, toegestaan, gewijzigdDoor: gewijzigdDoor ?? null, updatedAt: now })
      .returning()
      .get();
  }

  // --- Tarieven (prior-only) -------------------------------------------------

  async listTarieven(): Promise<Tarief[]> {
    return db.select().from(tarieven).orderBy(tarieven.id).all();
  }

  async getTarief(instrumentId: string): Promise<Tarief | undefined> {
    return db.select().from(tarieven).where(eq(tarieven.instrumentId, instrumentId)).get();
  }

  // Upsert op instrumentId: bewerkt een bestaande regel of maakt een nieuwe aan.
  async zetTarief(data: ZetTarief, gewijzigdDoor?: string): Promise<Tarief> {
    const now = new Date().toISOString();
    const isBundel = data.model === "bundel";
    const waarden = {
      naam: data.naam,
      omschrijving: data.omschrijving ?? "",
      flowType: data.flowType,
      model: data.model,
      creditCost: data.creditCost,
      bundelGrootte: isBundel ? (data.bundelGrootte ?? null) : null,
      bundelCredits: isBundel ? (data.bundelCredits ?? null) : null,
      isCustom: data.isCustom ?? false,
      gewijzigdDoor: gewijzigdDoor ?? null,
      updatedAt: now,
    };
    const bestaand = await this.getTarief(data.instrumentId);
    if (bestaand) {
      return db
        .update(tarieven)
        .set(waarden)
        .where(eq(tarieven.id, bestaand.id))
        .returning()
        .get();
    }
    return db
      .insert(tarieven)
      .values({ instrumentId: data.instrumentId, ...waarden })
      .returning()
      .get();
  }

  // Verwijdert enkel LOSSE (custom) regels. Een override van een
  // registry-instrument wordt niet hard verwijderd — "verwijderen" daarvan
  // betekent terugvallen op het code-default (override-rij wissen).
  async verwijderTarief(instrumentId: string): Promise<boolean> {
    const res = db.delete(tarieven).where(eq(tarieven.instrumentId, instrumentId)).run();
    return res.changes > 0;
  }
}

export const storage = new DatabaseStorage();

// ---------------------------------------------------------------------------
// Seed: twee prior beheerders (TaPasCity). Idempotent — draait enkel als er nog
// geen beheerders zijn. Beide krijgen volledige toegang tot alle platformdelen
// EN de T4P-accreditatie, want zij vertegenwoordigen TaPasCity zelf.
// ---------------------------------------------------------------------------
(function seedPriorBeheerders() {
  try {
    const bestaand = sqlite.prepare(`SELECT COUNT(*) AS n FROM beheerders`).get() as { n: number };
    if (bestaand.n > 0) return;

    const now = new Date().toISOString();
    const priors = [
      { naam: "Marc Debisschop", email: "marc@tapascity.com" },
      { naam: "Roald Borr\u00e9", email: "roald@tapascity.com" },
    ];
    const insBeheerder = sqlite.prepare(
      `INSERT INTO beheerders (naam, email, organisatie, is_prior, toegevoegd_door, actief, created_at)
       VALUES (?, ?, 'TaPasCity', 1, 'systeem', 1, ?)`,
    );
    const insToegang = sqlite.prepare(
      `INSERT INTO toegangen (beheerder_id, platformdeel, toegestaan, gewijzigd_door, updated_at)
       VALUES (?, ?, 1, 'systeem', ?)`,
    );
    // Platformdeel-ids hardgecodeerd om geen cyclische import te krijgen; blijft
    // in sync met shared/platformdelen.ts.
    const delen = [
      "kompas", "t4r", "teamscan", "twominscan", "impact", "hdd", "credits", "t4p-profielen",
    ];
    const tx = sqlite.transaction(() => {
      for (const p of priors) {
        const r = insBeheerder.run(p.naam, p.email, now);
        const id = Number(r.lastInsertRowid);
        for (const deel of delen) insToegang.run(id, deel, now);
      }
    });
    tx();
    console.log("[tapas] Twee prior beheerders aangemaakt (Marc Debisschop, Roald Borre).");
  } catch (e) {
    console.warn("[tapas] Seed prior beheerders overgeslagen:", (e as Error)?.message);
  }
})();
