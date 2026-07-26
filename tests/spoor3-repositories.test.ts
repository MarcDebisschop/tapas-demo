// ---------------------------------------------------------------------------
// tests/spoor3-repositories.test.ts - de ontvlechting van server/storage.ts.
//
// Achtergrond: `server/repositories/` bestond al, maar werd door NIEMAND
// aangeroepen. `grep -rn "repositories" server` vond enkel commentaarregels en
// geen enkele import in storage.ts. Het waren dus kopieen van de code in de
// god-module, met alle kans op uiteenlopen. `server/rapport-registry.ts:5`
// spreekt zelfs letterlijk van "een duplicaat in repositories/rapporten.ts".
//
// Twee clusters zijn nu echt verhuisd: billers en organisaties. De methodes op
// DatabaseStorage bestaan nog en delegeren; de kopie in storage.ts is weg.
//
// Wat hier getest wordt:
//   1. Het GEDRAG van de verhuisde functies, op een databank in het geheugen.
//      Zonder dit is "de suite bleef groen" geen bewijs: de bestaande tests
//      bootsen storage juist na en raken deze code niet.
//   2. Dat de delegatie ook echt bestaat. Zou iemand de implementatie weer in
//      storage.ts zetten, dan staan er opnieuw twee kopieen en faalt dit.
//
// De mock van "../server/storage" is nodig omdat de repositories `db` en
// `sqlite` daaruit importeren. Zonder mock zouden ze de echte data.db openen.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const geheugenDb = new Database(":memory:");
geheugenDb.exec(`
  CREATE TABLE biller_entiteiten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    vennootschapsnaam TEXT NOT NULL,
    adres TEXT, postcode TEXT, gemeente TEXT,
    land TEXT NOT NULL DEFAULT 'Belgie',
    btw_nummer TEXT, kbo_nummer TEXT, peppol_id TEXT, iban TEXT, logo TEXT,
    huisstijl_kleur TEXT NOT NULL DEFAULT '#b08b3f',
    factuur_footer TEXT,
    factuur_prefix TEXT NOT NULL DEFAULT 'INV',
    btw_tarief INTEGER NOT NULL DEFAULT 21,
    geldig_van TEXT NOT NULL,
    geldig_tot TEXT,
    actief INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE organisaties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bedrijf',
    btw_nummer TEXT, kbo_nummer TEXT, peppol_id TEXT,
    peppol_bereikbaar INTEGER NOT NULL DEFAULT 0,
    factuur_type TEXT NOT NULL DEFAULT 'pdf',
    contactpersoon TEXT, email TEXT, adres TEXT, postcode TEXT, gemeente TEXT,
    land TEXT NOT NULL DEFAULT 'Belgie',
    huisstijl_logo TEXT, huisstijl_kleur TEXT, huisstijl_footer TEXT,
    login_email TEXT UNIQUE, wachtwoord_hash TEXT,
    login_actief INTEGER NOT NULL DEFAULT 0,
    branding_logo_url TEXT, branding_achtergrond_url TEXT,
    branding_achtergrond_kleur TEXT, branding_quote TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE credit_saldi (
    organisatie_id INTEGER PRIMARY KEY,
    beschikbaar INTEGER NOT NULL DEFAULT 0,
    gereserveerd INTEGER NOT NULL DEFAULT 0,
    verbruikt INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
`);

vi.mock("../server/storage", () => ({
  db: drizzle(geheugenDb),
  sqlite: geheugenDb,
  storage: {},
}));

const billers = await import("../server/repositories/billers");
const organisatiesRepo = await import("../server/repositories/organisaties");

function leeg() {
  geheugenDb.exec("DELETE FROM biller_entiteiten; DELETE FROM organisaties; DELETE FROM credit_saldi;");
}

describe("spoor 3 - billers-repository", () => {
  beforeEach(leeg);

  it("maakt een biller aan en zet geldigVan en createdAt", async () => {
    const biller = await billers.createBiller({
      naam: "2BQ CONSULT",
      vennootschapsnaam: "2BQ CONSULT BV",
    } as any);
    expect(biller.id).toBeGreaterThan(0);
    expect(biller.naam).toBe("2BQ CONSULT");
    expect(biller.geldigVan).toBeTruthy();
    expect(biller.createdAt).toBeTruthy();
  });

  it("sorteert de lijst op aflopend id: de nieuwste eerst", async () => {
    await billers.createBiller({ naam: "Eerste", vennootschapsnaam: "Eerste BV" } as any);
    await billers.createBiller({ naam: "Tweede", vennootschapsnaam: "Tweede BV" } as any);
    const lijst = await billers.listBillers();
    expect(lijst.map((b) => b.naam)).toEqual(["Tweede", "Eerste"]);
  });

  it("houdt bij de entiteitswissel precies EEN actieve biller over", async () => {
    // Dit is de kern van activeerBiller: twee actieve facturerende entiteiten
    // zou betekenen dat niet vaststaat wie de factuur uitschrijft.
    const oud = await billers.createBiller({ naam: "Oud", vennootschapsnaam: "Oud BV" } as any);
    const nieuw = await billers.createBiller({ naam: "Nieuw", vennootschapsnaam: "Nieuw BV" } as any);

    const uit = await billers.activeerBiller(nieuw.id);
    expect(uit?.id).toBe(nieuw.id);
    expect(uit?.actief).toBe(true);
    expect(uit?.geldigTot).toBeNull();

    const alle = await billers.listBillers();
    expect(alle.filter((b) => b.actief).map((b) => b.naam)).toEqual(["Nieuw"]);

    // De afgesloten entiteit houdt een geldigTot: het spoor van de wissel.
    const afgesloten = alle.find((b) => b.id === oud.id);
    expect(afgesloten?.actief).toBe(false);
    expect(afgesloten?.geldigTot).toBeTruthy();

    expect((await billers.getActieveBiller())?.naam).toBe("Nieuw");
  });

  it("geeft undefined wanneer er geen actieve biller is", async () => {
    expect(await billers.getActieveBiller()).toBeUndefined();
  });
});

describe("spoor 3 - organisaties-repository", () => {
  beforeEach(leeg);

  it("geeft elke nieuwe organisatie meteen een nulsaldo", async () => {
    // Zonder saldoregel zou elke latere saldo-opvraging moeten raden wat 0 is.
    const org = await organisatiesRepo.createOrganisatie({ naam: "Innovatech NV", type: "bedrijf" } as any);
    const saldo = geheugenDb
      .prepare("SELECT * FROM credit_saldi WHERE organisatie_id = ?")
      .get(org.id) as { beschikbaar: number; gereserveerd: number; verbruikt: number } | undefined;
    expect(saldo).toBeDefined();
    expect(saldo!.beschikbaar).toBe(0);
    expect(saldo!.gereserveerd).toBe(0);
    expect(saldo!.verbruikt).toBe(0);
  });

  it("leidt factuurType af uit peppolBereikbaar", async () => {
    const met = await organisatiesRepo.createOrganisatie({
      naam: "Met Peppol", type: "bedrijf", peppolBereikbaar: true,
    } as any);
    const zonder = await organisatiesRepo.createOrganisatie({
      naam: "Zonder Peppol", type: "bedrijf", peppolBereikbaar: false,
    } as any);
    expect(met.factuurType).toBe("peppol");
    expect(zonder.factuurType).toBe("pdf");
  });

  it("vult het saldo per organisatie via de meegegeven functie", async () => {
    // De repository mag de credits-repository niet importeren, want dat zou een
    // kringverwijzing geven. Daarom komt de saldo-opvraging als argument binnen.
    const a = await organisatiesRepo.createOrganisatie({ naam: "A", type: "bedrijf" } as any);
    const b = await organisatiesRepo.createOrganisatie({ naam: "B", type: "bedrijf" } as any);
    const gevraagd: number[] = [];
    const lijst = await organisatiesRepo.listOrganisaties((id) => {
      gevraagd.push(id);
      return { organisatieId: id, beschikbaar: id * 10, gereserveerd: 0, verbruikt: 0, updatedAt: "" };
    });
    expect(lijst.map((o) => o.naam)).toEqual(["B", "A"]); // aflopend id
    expect(gevraagd.sort()).toEqual([a.id, b.id].sort());
    expect(lijst.find((o) => o.id === a.id)!.saldo.beschikbaar).toBe(a.id * 10);
  });

  it("geeft undefined voor een onbestaande organisatie", async () => {
    expect(await organisatiesRepo.getOrganisatie(9999)).toBeUndefined();
  });
});

describe("spoor 3 - de ontvlechting blijft ontvlecht", () => {
  const bron = readFileSync("server/storage.ts", "utf8");

  it("importeert de twee verhuisde repositories in storage.ts", () => {
    // Dit ontbrak: de repositories bestonden maar werden nergens ingevoerd.
    expect(bron).toContain('from "./repositories/billers"');
    expect(bron).toContain('from "./repositories/organisaties"');
  });

  it("delegeert en houdt geen tweede kopie van de implementatie", () => {
    // De queries van deze twee clusters horen enkel nog in de repositories te
    // staan. Zou iemand ze in storage.ts terugzetten, dan zijn er weer twee
    // kopieen die stil kunnen uiteenlopen; precies wat spoor 3 opruimt.
    expect(bron).toContain("billersRepo.activeerBiller(id)");
    expect(bron).toContain("organisatiesRepo.createOrganisatie(data)");
    // Toetsen op de queries die UNIEK bij de verhuisde methodes horen. Breder
    // toetsen kan niet: storage.ts raakt `billerEntiteiten` en `organisaties`
    // nog wel aan voor de huisstijl van documenten en voor de startmigraties, en
    // die horen bij een cluster dat nog niet verhuisd is.
    expect(bron).not.toContain("set({ actief: false, geldigTot: now })");
    expect(bron).not.toContain(".insert(organisaties)");
    expect(bron).not.toContain("orderBy(desc(billerEntiteiten.id))");
    expect(bron).not.toContain("orderBy(desc(organisaties.id))");
  });

  it("houdt de publieke methodes op de klasse in stand", () => {
    // De façade is het contract. Aanroepers gebruiken `storage.listBillers()` en
    // mogen niets van de verhuizing merken.
    for (const naam of [
      "listBillers", "getActieveBiller", "createBiller", "activeerBiller",
      "listOrganisaties", "getOrganisatie", "createOrganisatie",
    ]) {
      expect(bron, naam).toContain(`async ${naam}(`);
    }
  });
});
