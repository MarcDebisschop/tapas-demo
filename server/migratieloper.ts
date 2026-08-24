import type BetterSqlite3 from "better-sqlite3";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Past de migratiebestanden uit `migrations/` toe op de databank en houdt bij
 * welke al gelopen hebben.
 *
 * Waarom dit bestaat. De tabellen van een onderdeel worden beschreven in een
 * migratiebestand. Zonder een loper werd zo'n bestand nooit uitgevoerd en
 * ontbraken die tabellen op elke installatie die niet met de hand was
 * bijgewerkt. De Regiekamer viel daardoor om met "no such table: traject".
 *
 * Waarom er wordt bijgehouden wat al gelopen heeft. Niet elke migratie mag een
 * tweede keer lopen. Twee ervan breken een tabel af en bouwen haar opnieuw op.
 * Loopt zo'n bestand nog eens over een databank die al gevuld is, dan blijven de
 * rijen wel staan maar raakt een later toegevoegde kolom haar inhoud kwijt.
 * Het register sluit dat uit.
 */

/** Naam van de tabel waarin staat welke migraties gelopen hebben. */
export const REGISTERTABEL = "migratie_register";

/**
 * Toets per migratie of het resultaat ervan al in de databank zit.
 *
 * Deze toetsen worden op één moment gebruikt: bij een databank die al gevuld is
 * maar nog geen register heeft. Dat is de toestand van elke installatie die
 * bestond voordat dit register er was. Zonder deze toetsen zou de loper daar
 * alles opnieuw draaien, ook de twee migraties die dat niet verdragen.
 *
 * Bij een lege databank levert elke toets onwaar en loopt gewoon alles.
 */
export const REEDS_TOEGEPAST: Record<string, (db: BetterSqlite3.Database) => boolean> = {
  "0000_beginstand": (db) => tabelBestaat(db, "afnames"),
  "0001_brainy_wiccan": (db) => tabelBestaat(db, "gdpr_audit_log"),
  "0002_clammy_talisman": (db) => tabelBestaat(db, "traject"),
  "0003_smiling_shape": (db) => tabelBestaat(db, "traject_personen"),
  // 0004 en 0005 hernoemen hun werktabel, dus de naam alleen zegt niets. Wat de
  // migratie oplevert is wel te zien: 0004 voegt de auteur toe en 0005 verruimt
  // de toegestane soorten.
  "0004_supreme_freak": (db) =>
    kolomBestaat(db, "traject_gebeurtenissen", "vastgelegd_door_persoon_id"),
  // Let op de aanhalingstekens. Het woord vaststelling is ook een kolomnaam, dus
  // zonder die tekens zou deze toets al aanslaan op de tabel van voor 0005.
  // Gezocht wordt naar een soort die alleen 0005 toevoegt.
  "0005_soorten_gebeurtenis": (db) =>
    tabelOmschrijvingBevat(db, "traject_gebeurtenissen", "'overleg'"),
  // 0006 is strikt additief: alleen CREATE TABLE en CREATE INDEX, allemaal met
  // IF NOT EXISTS. Ze verdraagt dus wel een tweede loop. De toets staat er toch,
  // omdat een registerregel duidelijker is dan een migratie die stil opnieuw
  // over de databank gaat. Getoetst wordt op de laatste tabel van het bestand:
  // wie die heeft, heeft alles wat ervoor komt ook.
  "0006_bekwaamheid": (db) => tabelBestaat(db, "bekwaamheid_agenda"),
  // 0007 herbouwt de tabel bekwaamheid_beslissingen om haar CHECK te wijzigen.
  // Dat verdraagt GEEN tweede loop: hij zou de tabel afbreken en opnieuw
  // opbouwen. De toets kijkt daarom naar de nieuwe toegestane waarde. Let op de
  // aanhalingstekens, om dezelfde reden als bij 0005: zonder die tekens sloeg de
  // toets ook aan op de kolomnaam.
  "0007_beslisuitkomsten": (db) =>
    tabelOmschrijvingBevat(db, "bekwaamheid_beslissingen", "'opgeschort'"),
  // 0008 herbouwt bekwaamheid_items om er de kolom `blok` met twee CHECKs aan toe
  // te voegen; SQLite kan een kolom met CHECK niet los toevoegen. Ook dit
  // verdraagt geen tweede loop. De toets kijkt naar de kolom en niet naar de
  // CHECK-tekst: de kolom is wat de rest van de module nodig heeft, en een
  // kolomtoets blijft kloppen als een latere migratie de CHECK aanscherpt.
  "0008_itemblokken": (db) => kolomBestaat(db, "bekwaamheid_items", "blok"),
  // 0009 is strikt additief: één nieuwe tabel en drie indexen, alles met
  // IF NOT EXISTS. Ze verdraagt dus een tweede loop. De toets staat er om
  // dezelfde reden als bij 0006: een uitdrukkelijke registerregel is duidelijker
  // dan een migratie die stil opnieuw over de databank gaat.
  "0009_mailverzendlog": (db) => tabelBestaat(db, "mail_verzendlog"),
  // 0010 herbouwt mail_verzendlog om de soort "herinnering" toe te laten; SQLite
  // kan een CHECK niet wijzigen. Dat verdraagt GEEN tweede loop: hij zou de tabel
  // afbreken en opnieuw opbouwen, en het logboek is juist bedoeld om te blijven.
  // De toets kijkt naar de nieuwe toegestane waarde, met aanhalingstekens om
  // dezelfde reden als bij 0005 en 0007.
  "0010_herinnering_in_verzendlog": (db) =>
    tabelOmschrijvingBevat(db, "mail_verzendlog", "'herinnering'"),
};

export function tabelBestaat(db: BetterSqlite3.Database, naam: string): boolean {
  const rij = db
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?")
    .get("table", naam);
  return rij !== undefined;
}

export function kolomBestaat(
  db: BetterSqlite3.Database,
  tabel: string,
  kolom: string,
): boolean {
  if (!tabelBestaat(db, tabel)) return false;
  const kolommen = db.prepare(`PRAGMA table_info(${tabel})`).all() as { name: string }[];
  return kolommen.some(({ name }) => name === kolom);
}

/**
 * Kijkt of de opgeslagen omschrijving van een tabel een bepaald woord bevat.
 * Zo is een controlebeperking na te gaan zonder haar te moeten ontleden.
 */
export function tabelOmschrijvingBevat(
  db: BetterSqlite3.Database,
  tabel: string,
  woord: string,
): boolean {
  const rij = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
    .get("table", tabel) as { sql: string } | undefined;
  return rij?.sql?.includes(woord) ?? false;
}

/**
 * Zoekt de map met migratiebestanden. In een gebouwde uitvoer staat de map naast
 * de bundel, tijdens ontwikkeling in de projectmap.
 */
export function vindMigratieMap(startpunt?: string): string | null {
  if (process.env.TAPAS_MIGRATIE_MAP) {
    const opgegeven = resolve(process.env.TAPAS_MIGRATIE_MAP);
    return existsSync(opgegeven) ? opgegeven : null;
  }

  const basis = startpunt ?? (typeof __dirname !== "undefined" ? __dirname : process.cwd());
  const kandidaten = [
    resolve(basis, "..", "migrations"),
    resolve(process.cwd(), "migrations"),
    resolve(basis, "migrations"),
  ];

  for (const pad of kandidaten) {
    if (existsSync(pad)) return pad;
  }
  return null;
}

/** Geeft de migratienamen in de volgorde waarin ze moeten lopen. */
export function leesMigratieNamen(map: string): string[] {
  return readdirSync(map)
    .filter((naam) => naam.endsWith(".sql"))
    .map((naam) => naam.replace(/\.sql$/, ""))
    .sort();
}

function maakRegister(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${REGISTERTABEL} (
      naam TEXT PRIMARY KEY,
      toegepast_op TEXT NOT NULL,
      overgeslagen INTEGER NOT NULL DEFAULT 0
    )
  `);
}

/**
 * Staat deze migratie al vastgelegd? Wordt binnen de transactie van de migratie
 * zelf opnieuw gesteld, zodat het antwoord van vóór het slot niet meetelt.
 */
function staatInRegister(db: BetterSqlite3.Database, naam: string): boolean {
  return !!db.prepare(`SELECT 1 FROM ${REGISTERTABEL} WHERE naam = ?`).get(naam);
}

function reedsInRegister(db: BetterSqlite3.Database): Set<string> {
  const rijen = db.prepare(`SELECT naam FROM ${REGISTERTABEL}`).all() as { naam: string }[];
  return new Set(rijen.map(({ naam }) => naam));
}

export interface MigratieUitkomst {
  /** Migraties die daadwerkelijk zijn uitgevoerd. */
  toegepast: string[];
  /**
   * Migraties waarvan het resultaat al aanwezig was. Die zijn niet uitgevoerd
   * maar wel vastgelegd, zodat ze later niet alsnog gaan lopen.
   */
  alAanwezig: string[];
}

/**
 * Hoe lang een tweede proces wacht op het schrijfslot van het eerste voordat
 * SQLite opgeeft met "database is locked". Vijftien seconden is ruim: de negen
 * migraties samen lopen in minder dan een seconde.
 */
const SLOT_WACHTTIJD_MS = 15_000;

/**
 * Voert de openstaande migraties uit. Elke migratie loopt in één transactie
 * samen met haar registerregel, zodat er nooit een half toegepaste migratie
 * achterblijft.
 *
 * DE WEDLOOP DIE HIER DICHTGEZET IS
 * Het register werd één keer vooraf uitgelezen, buiten elk slot, en daarna werd
 * per migratie een eigen transactie geopend. Openen twee processen tegelijk
 * dezelfde verse databank, dan zien ze beide een leeg register, besluiten beide
 * dat alles nog moet lopen, en valt de tweede om op zijn registerregel:
 * "UNIQUE constraint failed: migratie_register.naam". Dat is de fout waarop de
 * bouwpijplijn onregelmatig rood sloeg; met twee processen op één verse databank
 * was ze in twee van zes proefrondes uit te lokken.
 *
 * Twee dingen samen zetten hem dicht, en met opzet niet meer dan dat:
 *
 *   1. Elke migratie neemt haar schrijfslot meteen bij het openen van haar
 *      transactie (`immediate`) in plaats van pas bij de eerste schrijfopdracht.
 *      Een tweede proces wacht dan, in plaats van ondertussen door te lezen.
 *   2. De vraag "staat deze migratie al in het register?" wordt opnieuw gesteld
 *      BINNEN die transactie. Het antwoord van vóór het slot kan verouderd zijn;
 *      het antwoord erbinnen niet. Wie te laat komt, ziet de regel van de ander
 *      en slaat over.
 *
 * Wat uitdrukkelijk NIET verandert: de reeks loopt niet in één grote transactie.
 * Dat zou het slot ook dichtzetten, maar het zou bij een fout in de derde
 * migratie ook de eerste twee terugdraaien. `tests/migratieloper.test.ts` eist
 * het tegendeel — wat gelukt is, blijft staan — en dat is de juiste eis: een
 * gedeeltelijk gevorderde databank is te hervatten, een teruggedraaide niet.
 *
 * Wordt de map met migratiebestanden niet gevonden, dan stopt dit met een fout.
 * Dat is met opzet luid: een databank waarvan niet vaststaat welke tabellen
 * erin horen, is erger dan een server die niet start.
 */
export function pasMigratiesToe(
  db: BetterSqlite3.Database,
  map?: string | null,
): MigratieUitkomst {
  const migratieMap = map === undefined ? vindMigratieMap() : map;
  if (!migratieMap) {
    throw new Error(
      "De map met migratiebestanden is niet gevonden. Gezocht naast de gebouwde " +
        "uitvoer, in de werkmap en in de projectmap. Zet eventueel TAPAS_MIGRATIE_MAP.",
    );
  }

  // Zonder wachttijd geeft SQLite meteen "database is locked" zodra een ander
  // proces het slot heeft. De oude waarde wordt achteraf teruggezet: deze functie
  // mag geen blijvende instelling achterlaten op de verbinding van de aanroeper.
  const oudeWachttijd = Number(db.pragma("busy_timeout", { simple: true })) || 0;
  if (oudeWachttijd < SLOT_WACHTTIJD_MS) db.pragma(`busy_timeout = ${SLOT_WACHTTIJD_MS}`);
  try {
    return loopMigraties(db, migratieMap);
  } finally {
    if (oudeWachttijd < SLOT_WACHTTIJD_MS) db.pragma(`busy_timeout = ${oudeWachttijd}`);
  }
}

/**
 * De eigenlijke reeks. Staat apart zodat pasMigratiesToe alleen over de
 * wachttijd gaat en deze functie alleen over de migraties.
 */
function loopMigraties(db: BetterSqlite3.Database, migratieMap: string): MigratieUitkomst {
  maakRegister(db);
  const alGeregistreerd = reedsInRegister(db);
  const uitkomst: MigratieUitkomst = { toegepast: [], alAanwezig: [] };
  const namen = leesMigratieNamen(migratieMap);

  // De toestand wordt één keer vooraf opgenomen, voordat er iets draait. Zou een
  // toets pas gebeuren op het moment dat haar migratie aan de beurt is, dan kan
  // een eerdere migratie uit dezelfde loop hem al waar hebben gemaakt en wordt
  // werk ten onrechte overgeslagen.
  const wasErAlBijBinnenkomst = new Map<string, boolean>();
  for (const naam of namen) {
    const toets = REEDS_TOEGEPAST[naam];
    wasErAlBijBinnenkomst.set(naam, toets ? toets(db) : false);
  }

  for (const naam of namen) {
    if (alGeregistreerd.has(naam)) continue;

    if (wasErAlBijBinnenkomst.get(naam)) {
      const vastleggen = db.transaction(() => {
        // Kwam een ander proces ons voor tussen het uitlezen en dit slot, dan
        // staat de regel er al en valt er niets vast te leggen.
        if (staatInRegister(db, naam)) return false;
        db.prepare(
          `INSERT INTO ${REGISTERTABEL} (naam, toegepast_op, overgeslagen) VALUES (?, ?, 1)`,
        ).run(naam, new Date().toISOString());
        return true;
      });
      if (vastleggen.immediate()) uitkomst.alAanwezig.push(naam);
      continue;
    }

    const inhoud = readFileSync(resolve(migratieMap, `${naam}.sql`), "utf8");
    const stappen = inhoud
      .split("--> statement-breakpoint")
      .map((stap) => stap.trim())
      .filter((stap) => stap.length > 0);

    const voerUit = db.transaction(() => {
      // Zelfde vraag als hierboven, nu mét het slot in de hand. Heeft een ander
      // proces deze migratie al gedaan, dan zou onze SQL erbovenop lopen en
      // onze registerregel botsen. Dus: overslaan.
      if (staatInRegister(db, naam)) return false;
      for (const stap of stappen) db.exec(stap);
      db.prepare(
        `INSERT INTO ${REGISTERTABEL} (naam, toegepast_op, overgeslagen) VALUES (?, ?, 0)`,
      ).run(naam, new Date().toISOString());
      return true;
    });

    let uitgevoerd: boolean;
    try {
      uitgevoerd = voerUit.immediate();
    } catch (oorzaak) {
      const melding = oorzaak instanceof Error ? oorzaak.message : String(oorzaak);
      throw new Error(`Migratie ${naam} is niet toegepast: ${melding}`);
    }

    if (uitgevoerd) uitkomst.toegepast.push(naam);
  }

  return uitkomst;
}
