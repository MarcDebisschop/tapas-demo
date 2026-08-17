import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  REEDS_TOEGEPAST,
  REGISTERTABEL,
  kolomBestaat,
  leesMigratieNamen,
  pasMigratiesToe,
  tabelBestaat,
  vindMigratieMap,
} from "../server/migratieloper";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const echteMigraties = resolve(projectRoot, "migrations");

let werkmap: string;
let db: Database.Database;

beforeEach(() => {
  werkmap = mkdtempSync(join(tmpdir(), "tapas-migratie-"));
  db = new Database(join(werkmap, "proef.db"));
});

afterEach(() => {
  db.close();
  rmSync(werkmap, { recursive: true, force: true });
});

/**
 * Zet een klein maar volledig traject met één gebeurtenis in de databank, met een
 * bekende auteur. De kolomnamen komen uit de migratiebestanden zelf.
 */
function vulProeftrajectMetEenGebeurtenis(db: Database.Database): void {
  const nu = Date.now();
  const nuTekst = new Date(nu).toISOString();
  // Een traject hangt aan een organisatie en aan de beheerder die het aanmaakte.
  db.prepare("INSERT INTO organisaties (id, naam, created_at) VALUES (?, ?, ?)").run(
    1,
    "Proeforganisatie",
    nuTekst,
  );
  db.prepare(
    "INSERT INTO beheerders (id, naam, email, created_at) VALUES (?, ?, ?, ?)",
  ).run(1, "Marc", "marc@example.org", nuTekst);
  db.prepare(
    `INSERT INTO traject
       (id, naam, organisatie_id, aangemaakt_door_beheerder_id, huidige_fase, zekerheidstrap, status, aangemaakt_op)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, "Proeftraject", 1, 1, 1, 1, "open", nu);
  for (const [id, soort, naam] of [
    [1, "investeerder", "Investeerder"],
    [2, "onderneming", "Onderneming"],
  ] as const) {
    db.prepare(
      `INSERT INTO traject_partijen (id, traject_id, soort, naam, ankerpunt, kring, rol)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, 1, soort, naam, "Ankerpunt", 1, "partij");
  }
  db.prepare(
    `INSERT INTO traject_lijnen
       (id, traject_id, partij_een_id, partij_twee_id, stiltedrempel_dagen, aangemaakt_op)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(1, 1, 1, 2, 14, nu);
  db.prepare(
    `INSERT INTO traject_personen
       (id, traject_id, partij_id, naam, email, actief, aangemaakt_op)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, 1, 1, "Marc", "marc@example.org", 1, nu);
  db.prepare(
    `INSERT INTO traject_gebeurtenissen
       (id, traject_id, lijn_id, tijdstip, soort, vaststelling, indruk, vastgelegd_door_persoon_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, 1, 1, nu, "gesprek", "Eerste gesprek gevoerd.", "Rustig verlopen.", 1);
}

function maakEigenMigraties(bestanden: Record<string, string>): string {
  const map = join(werkmap, "migraties");
  mkdirSync(map, { recursive: true });
  for (const [naam, inhoud] of Object.entries(bestanden)) {
    writeFileSync(join(map, naam), inhoud, "utf8");
  }
  return map;
}

describe("De migratieloper op een lege databank", () => {
  it("maakt alle tabellen van het traject aan", () => {
    pasMigratiesToe(db, echteMigraties);

    for (const naam of [
      "traject",
      "traject_fasen",
      "traject_partijen",
      "traject_lijnen",
      "traject_werkstromen",
      "traject_vragen",
      "traject_gebeurtenissen",
      "traject_personen",
      "traject_rollen",
    ]) {
      expect(tabelBestaat(db, naam), `tabel ${naam} ontbreekt`).toBe(true);
    }
  });

  it("legt elke migratie vast in het register", () => {
    const uitkomst = pasMigratiesToe(db, echteMigraties);
    const namenOpSchijf = leesMigratieNamen(echteMigraties);

    expect(uitkomst.toegepast).toEqual(namenOpSchijf);
    expect(uitkomst.alAanwezig).toEqual([]);

    const vastgelegd = db
      .prepare(`SELECT naam FROM ${REGISTERTABEL} ORDER BY naam`)
      .all()
      .map(({ naam }: { naam: string }) => naam);
    expect(vastgelegd).toEqual(namenOpSchijf);
  });

  it("levert de gebeurtenissen op met auteur en met de ruimere soorten", () => {
    pasMigratiesToe(db, echteMigraties);

    expect(kolomBestaat(db, "traject_gebeurtenissen", "vastgelegd_door_persoon_id")).toBe(
      true,
    );
    const omschrijving = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
      .get("table", "traject_gebeurtenissen") as { sql: string };
    for (const soort of [
      "gesprek",
      "bericht",
      "overleg",
      "vaststelling",
      "rechtstreeks_contact",
    ]) {
      expect(omschrijving.sql).toContain(soort);
    }
  });
});

describe("De migratieloper een tweede keer", () => {
  it("doet niets meer en laat vastgelegde auteurs staan", () => {
    pasMigratiesToe(db, echteMigraties);

    vulProeftrajectMetEenGebeurtenis(db);
    const tweedeLoop = pasMigratiesToe(db, echteMigraties);

    expect(tweedeLoop.toegepast).toEqual([]);
    expect(tweedeLoop.alAanwezig).toEqual([]);

    // Dit is de kern. Zonder register zou de tabelherbouw opnieuw lopen en de
    // auteur leeg achterlaten, terwijl de rij zelf blijft staan.
    const rij = db
      .prepare("SELECT vaststelling, vastgelegd_door_persoon_id FROM traject_gebeurtenissen")
      .get() as { vaststelling: string; vastgelegd_door_persoon_id: number | null };
    expect(rij.vaststelling).toBe("Eerste gesprek gevoerd.");
    expect(rij.vastgelegd_door_persoon_id).toBe(1);
  });

  it("laat ook de indruk staan, die de eigen partij niet verlaat", () => {
    pasMigratiesToe(db, echteMigraties);
    vulProeftrajectMetEenGebeurtenis(db);
    pasMigratiesToe(db, echteMigraties);

    const rij = db
      .prepare("SELECT indruk FROM traject_gebeurtenissen")
      .get() as { indruk: string };
    expect(rij.indruk).toBe("Rustig verlopen.");
  });
});

describe("De migratieloper op een databank die al gevuld is", () => {
  it("legt bestaande migraties vast zonder ze opnieuw uit te voeren", () => {
    // Eerst de volledige eindtoestand opbouwen, daarna het register weghalen.
    // Dat is precies de toestand van een installatie van voor dit register.
    pasMigratiesToe(db, echteMigraties);
    db.exec(`DROP TABLE ${REGISTERTABEL}`);

    const uitkomst = pasMigratiesToe(db, echteMigraties);

    expect(uitkomst.toegepast).toEqual([]);
    expect(uitkomst.alAanwezig).toEqual(leesMigratieNamen(echteMigraties));
  });

  it("draait alleen wat er nog niet is", () => {
    // Een databank met enkel de oudste tabellen, zoals de opstartcode die maakt.
    db.exec("CREATE TABLE afnames (id INTEGER PRIMARY KEY)");
    db.exec("CREATE TABLE gdpr_audit_log (id INTEGER PRIMARY KEY)");

    const uitkomst = pasMigratiesToe(db, echteMigraties);

    expect(uitkomst.alAanwezig).toEqual(["0000_beginstand", "0001_brainy_wiccan"]);
    expect(uitkomst.toegepast).toEqual([
      "0002_clammy_talisman",
      "0003_smiling_shape",
      "0004_supreme_freak",
      "0005_soorten_gebeurtenis",
      "0006_bekwaamheid",
      "0007_beslisuitkomsten",
      "0008_itemblokken",
      "0009_mailverzendlog",
    ]);
    expect(tabelBestaat(db, "traject")).toBe(true);
    expect(tabelBestaat(db, "mail_verzendlog")).toBe(true);
    expect(kolomBestaat(db, "traject_gebeurtenissen", "vastgelegd_door_persoon_id")).toBe(
      true,
    );
  });

  it("laat na 0007 de vijf uitkomsten uit het draaiboek toe en de oude twee niet", () => {
    // 0007 herbouwt bekwaamheid_beslissingen om haar CHECK te wijzigen. Zou die
    // migratie stil overgeslagen worden of half lopen, dan bleef het oude
    // vocabulaire staan en stelde de machine straks een uitkomst voor die de
    // databank weigert. Deze test meet de eindtoestand, niet de tekst.
    pasMigratiesToe(db, echteMigraties);

    const omschrijving = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
      .get("table", "bekwaamheid_beslissingen") as { sql: string };

    for (const toegestaan of [
      "'bekrachtigd'",
      "'bekrachtigd_met_aandachtspunt'",
      "'voorwaardelijk'",
      "'opgeschort'",
      "'beeindigd'",
    ]) {
      expect(omschrijving.sql).toContain(toegestaan);
    }
    expect(omschrijving.sql).not.toContain("'niet_bekrachtigd'");
    // Let op: 'herkansing' blijft wel een geldige RONDESOORT, dus er mag alleen
    // in DEZE tabelomschrijving niet meer naar verwezen worden.
    expect(omschrijving.sql).not.toContain("'herkansing'");

    // En de index moet de herbouw overleefd hebben EN nog uniek zijn, anders kon
    // er stil een tweede beslissing op dezelfde ronde komen te staan. Op de naam
    // alleen toetsen volstaat niet: een mutatieproef liet zien dat een index die
    // zijn UNIQUE verliest, dan onopgemerkt doorging.
    const indexen = db
      .prepare("PRAGMA index_list(bekwaamheid_beslissingen)")
      .all() as { name: string; unique: number }[];
    const opRonde = indexen.find((i) => i.name === "uq_bekwaamheid_beslissing_ronde");
    expect(opRonde, "de index op ronde_id is verdwenen").toBeDefined();
    expect(opRonde?.unique, "de index op ronde_id is niet meer uniek").toBe(1);

    // De werktabel mag niet blijven staan.
    expect(tabelBestaat(db, "bekwaamheid_beslissingen_nieuw")).toBe(false);
  });

  it("levert na 0008 een itembank met de kolom blok en beide grenzen erop", () => {
    // 0008 herbouwt bekwaamheid_items. Zou die herbouw half lopen of stil worden
    // overgeslagen, dan staat er een tabel zonder blokkolom en is de verdeling
    // A10/B6/C8/D8/E8 uit het draaiboek niet af te dwingen. Erger: de
    // samensteller zou dan items zonder blok aannemen en een set opleveren
    // waarvan niemand kan zeggen of ze de verdeling haalt. Deze test meet de
    // eindtoestand.
    pasMigratiesToe(db, echteMigraties);

    expect(kolomBestaat(db, "bekwaamheid_items", "blok")).toBe(true);

    // De twee CHECKs moeten er echt staan, niet alleen de kolom. Een kolom
    // zonder grens laat 'F' en 'blok 3' toe.
    db.exec(
      `INSERT INTO bekwaamheid_items
         (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
          toelichting_fout, gebruik, versie, actief)
       VALUES ('t4p', 'weten', 'C', 'meerkeuze', 'Een stam die lang genoeg is.',
               'B', 'Omdat dit klopt volgens de handleiding.',
               'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
    );

    // Een blok buiten A tot E moet stuklopen.
    expect(() =>
      db.exec(
        `INSERT INTO bekwaamheid_items
           (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
            toelichting_fout, gebruik, versie, actief)
         VALUES ('t4p', 'weten', 'F', 'meerkeuze', 'Een stam die lang genoeg is.',
                 'B', 'Omdat dit klopt volgens de handleiding.',
                 'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
      ),
    ).toThrow();

    // Een blok op een andere as dan weten moet ook stuklopen: de blokken zijn de
    // indeling van de kennischeck, en die meet weten.
    expect(() =>
      db.exec(
        `INSERT INTO bekwaamheid_items
           (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
            toelichting_fout, gebruik, versie, actief)
         VALUES ('t4p', 'zien', 'C', 'meerkeuze', 'Een stam die lang genoeg is.',
                 'B', 'Omdat dit klopt volgens de handleiding.',
                 'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
      ),
    ).toThrow();

    // Een item zonder blok blijft toegestaan: er zijn drie andere assen die geen
    // blokindeling hebben.
    db.exec(
      `INSERT INTO bekwaamheid_items
         (instrument_id, "as", soort, stam, sleutel, toelichting_goed,
          toelichting_fout, gebruik, versie, actief)
       VALUES ('t4p', 'zien', 'open', 'Een stam die lang genoeg is.',
               'De sleutel beschrijft waaraan het antwoord moet voldoen.',
               'Omdat dit klopt volgens de handleiding.',
               'Omdat dit niet klopt volgens de handleiding.', 'oefenen', 1, 1)`,
    );

    // De index op instrument moet de herbouw overleefd hebben. Op de naam alleen
    // toetsen volstaat niet: bij 0007 liet een mutatieproef zien dat een index
    // die zijn eigenschappen verliest onopgemerkt doorging. Hier is de
    // eigenschap dat blok in de index zit, want daar loopt de dekkingsvraag over.
    const kolommen = db
      .prepare("PRAGMA index_info(idx_bekwaamheid_item_instrument)")
      .all() as { name: string }[];
    expect(kolommen.map((k) => k.name)).toContain("blok");

    // En de tweede index moet er ook nog zijn.
    const indexen = db
      .prepare("PRAGMA index_list(bekwaamheid_items)")
      .all() as { name: string }[];
    expect(indexen.map((i) => i.name)).toContain("idx_bekwaamheid_item_gebruik");

    // De werktabel mag niet blijven staan.
    expect(tabelBestaat(db, "bekwaamheid_items_nieuw")).toBe(false);
  });
});

describe("De migratieloper bij een fout", () => {
  it("laat niets half toegepast achter", () => {
    const map = maakEigenMigraties({
      "0000_goed.sql": "CREATE TABLE eerste (id INTEGER PRIMARY KEY);",
      "0001_stuk.sql":
        "CREATE TABLE tweede (id INTEGER PRIMARY KEY);\n--> statement-breakpoint\nDIT IS GEEN GELDIGE SQL;",
    });

    expect(() => pasMigratiesToe(db, map)).toThrow(/0001_stuk/);

    expect(tabelBestaat(db, "eerste")).toBe(true);
    // De eerste stap van de mislukte migratie mag niet blijven staan.
    expect(tabelBestaat(db, "tweede")).toBe(false);
    const vastgelegd = db
      .prepare(`SELECT naam FROM ${REGISTERTABEL} ORDER BY naam`)
      .all()
      .map(({ naam }: { naam: string }) => naam);
    expect(vastgelegd).toEqual(["0000_goed"]);
  });

  it("stopt luid wanneer de migratiemap ontbreekt", () => {
    expect(() => pasMigratiesToe(db, null)).toThrow(/niet gevonden/);
  });
});

describe("De toetsen op reeds toegepaste migraties", () => {
  it("kijken naar de toestand bij binnenkomst en niet naar tussenstanden", () => {
    // Zonder deze regel zou de toets voor de ruimere soorten aanslaan zodra een
    // eerdere migratie uit dezelfde loop de tabel had aangemaakt, en zou de
    // laatste migratie stil worden overgeslagen.
    const uitkomst = pasMigratiesToe(db, echteMigraties);
    expect(uitkomst.alAanwezig).toEqual([]);
    expect(uitkomst.toegepast).toContain("0005_soorten_gebeurtenis");

    const omschrijving = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
      .get("table", "traject_gebeurtenissen") as { sql: string };
    expect(omschrijving.sql).toContain("'overleg'");
  });

  it("bestaan voor elk migratiebestand", () => {
    const namenOpSchijf = leesMigratieNamen(echteMigraties);
    const zonderToets = namenOpSchijf.filter((naam) => !(naam in REEDS_TOEGEPAST));

    // Een migratie zonder toets zou op een bestaande installatie opnieuw lopen.
    expect(
      zonderToets,
      `Deze migraties hebben geen toets op reeds toegepast: ${zonderToets.join(", ")}`,
    ).toEqual([]);
  });

  it("leveren onwaar op een lege databank", () => {
    for (const [naam, toets] of Object.entries(REEDS_TOEGEPAST)) {
      expect(toets(db), `${naam} meldt ten onrechte dat ze al toegepast is`).toBe(false);
    }
  });

  it("leveren waar nadat de migraties gelopen hebben", () => {
    pasMigratiesToe(db, echteMigraties);
    for (const [naam, toets] of Object.entries(REEDS_TOEGEPAST)) {
      expect(toets(db), `${naam} wordt niet als toegepast herkend`).toBe(true);
    }
  });
});

describe("Het zoeken van de migratiemap", () => {
  it("vindt de map van dit project", () => {
    const gevonden = vindMigratieMap(resolve(projectRoot, "server"));
    expect(gevonden).toBe(echteMigraties);
  });
});
