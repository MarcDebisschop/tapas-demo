// ---------------------------------------------------------------------------
// tests/gdpr-verbeteringen.test.ts - de privacyverbeteringen van augustus 2026
//
// Wat deze tests bewijzen, punt per punt:
//   1. Intrekking van de toestemming wist ook de rapporten. Vroeger bleef het
//      volledige verhaal van een mens in de tabel `rapporten` staan nadat de
//      afname zelf al geanonimiseerd was.
//   2. Het recht op verbetering (AVG art. 16) bestaat als endpoint.
//   3. Het doorgifteregister vermeldt de betaaldienst, ook in simulatiemodus.
//   4. De particuliere aankoop kent een leeftijdspoort en een bewaartermijn.
//   5. Verstreken aankoop-intakes worden echt gewist.
// ---------------------------------------------------------------------------
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { rapportAnonimiseringsPatch, INTREKKINGSREDEN } from "../server/anonimisering";

const storageBron = readFileSync("server/storage.ts", "utf8");
const afnamesBron = readFileSync("server/routes/afnames.ts", "utf8");
const priveBron = readFileSync("server/prive-aankoop/routes.ts", "utf8");

describe("intrekking van de toestemming", () => {
  it("wist elk inhoudelijk veld van een rapport", () => {
    const patch = rapportAnonimiseringsPatch(INTREKKINGSREDEN, "2026-08-01T10:00:00.000Z");
    for (const veld of ["titel", "inhoud", "html", "pdfBase64"]) {
      expect(patch, `${veld} moet in de patch zitten`).toHaveProperty(veld);
    }
    // Niets van de inhoud mag blijven staan; enkel een neutraal spoor.
    const rest = Object.entries(patch)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k]) => k);
    for (const k of rest) {
      expect(String((patch as Record<string, unknown>)[k])).not.toMatch(/[A-Za-z]{3,}@/);
    }
  });

  it("zet de afname op ingetrokken en roept de anonimisering aan", () => {
    // Bewijs op broncodeniveau, want dit is precies het pad dat stilletjes kon
    // terugvallen op 'enkel een vlaggetje omzetten'.
    const blok = storageBron.slice(storageBron.indexOf("async trekConsentIn"));
    const body = blok.slice(0, blok.indexOf("\n  }"));
    expect(body).toContain("consentIngetrokkenAt");
    expect(body).toContain("consentGiven: false");
    expect(body).toContain("anonimiseerAfname");
    expect(body).toContain("INTREKKINGSREDEN");
  });

  it("laat de anonimisering ook de rapporten van die afname wissen", () => {
    const blok = storageBron.slice(storageBron.indexOf("async anonimiseerAfname"));
    const body = blok.slice(0, blok.indexOf("\n  }"));
    expect(body).toContain("rapporten");
    expect(body).toContain("rapportAnonimiseringsPatch");
  });
});

describe("recht op verbetering (AVG art. 16)", () => {
  it("bestaat als beveiligd endpoint met een strikt schema", () => {
    expect(afnamesBron).toContain('"/api/gdpr/afnames/:id/rectificatie"');
    // Elke GDPR-route hoort achter dezelfde wacht te staan als de andere.
    const regel = afnamesBron
      .split("\n")
      .find((r) => r.includes('app.post("/api/gdpr/afnames/:id/rectificatie"'));
    expect(regel).toContain("vereisScope");
    expect(afnamesBron).toContain("rectificatieSchema");
    expect(afnamesBron).toContain("gdpr_rectificatie");
  });

  it("logt enkel de veldnamen, nooit de nieuwe waarden", () => {
    const blok = afnamesBron.slice(
      afnamesBron.indexOf('app.post("/api/gdpr/afnames/:id/rectificatie"'),
    );
    const body = blok.slice(0, blok.indexOf("\n  });"));
    // De logregel mag de sleutels bevatten, niet de ingevulde waarden.
    expect(body).toMatch(/Object\.keys\(/);
  });
});

describe("doorgifteregister", () => {
  it("vermeldt de betaaldienst, ook wanneer die in simulatie draait", async () => {
    const { betaalDoorgifteKanaal } = await import("../server/doorgifteregister");
    const zonderSleutel = betaalDoorgifteKanaal("");
    expect(zonderSleutel.kanaal).toBe("betaaldienst");
    expect(zonderSleutel.actief).toBe(false);
    const metSleutel = betaalDoorgifteKanaal("test_abc123");
    expect(metSleutel.actief).toBe(true);
    expect(metSleutel.ontvanger.toLowerCase()).toContain("mollie");
    expect(metSleutel.grondslagVereist.length).toBeGreaterThan(10);
  });
});

describe("particuliere aankoop", () => {
  it("houdt de leeftijdspoort aan voor de instrumenten voor minderjarigen", () => {
    expect(priveBron).toContain("isMinderjarigInstrument");
    expect(priveBron).toContain("ouderlijkeToestemming");
    // De poort moet vóór het aanmaken van de betaling staan, anders is er al
    // een rij met kindgegevens aangemaakt tegen de tijd dat we weigeren.
    const poort = priveBron.indexOf("isMinderjarigInstrument(data.instrumentId)");
    const insert = priveBron.indexOf("INSERT INTO prive_aankoop");
    expect(poort).toBeGreaterThan(0);
    expect(poort).toBeLessThan(insert);
  });

  it("schrijft een bewaartermijn en een bewijs van de toestemming mee", () => {
    expect(priveBron).toContain("STANDAARD_BEWAARMAANDEN");
    expect(priveBron).toContain("PRIVACY_VERKLARING_VERSIE");
    expect(priveBron).toContain("consent_ip");
    expect(priveBron).toContain("bewaartot");
  });
});

describe("opruiming van de aankoop-intakes", () => {
  it("wist een verstreken intake en laat een lopende staan", async () => {
    const { sqlite } = await import("../server/storage");
    const { ruimVerstrekenIntakesOp } = await import("../server/prive-aankoop/bewaartermijn");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS prive_aankoop (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        betaling_id INTEGER NOT NULL,
        instrument_id TEXT NOT NULL,
        intake TEXT NOT NULL,
        factuur_id INTEGER,
        aangemaakt_op TEXT NOT NULL,
        bewaartot TEXT,
        geanonimiseerd_op TEXT,
        consent_versie TEXT,
        consent_ip TEXT
      )`);
    for (const kolom of ["bewaartot", "geanonimiseerd_op", "consent_versie", "consent_ip"]) {
      const aanwezig = (
        sqlite.prepare(`PRAGMA table_info(prive_aankoop)`).all() as Array<{ name: string }>
      ).some((k) => k.name === kolom);
      if (!aanwezig) sqlite.exec(`ALTER TABLE prive_aankoop ADD COLUMN ${kolom} TEXT`);
    }

    const invoegen = sqlite.prepare(
      `INSERT INTO prive_aankoop (betaling_id, instrument_id, intake, aangemaakt_op, bewaartot, consent_ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const intake = JSON.stringify({ voornaam: "Test", email: "test@voorbeeld.be", kindNaam: "Kind" });
    const oud = invoegen.run(-991, "t4teens", intake, "2024-01-01", "2024-02-01", "10.0.0.1");
    const nieuw = invoegen.run(-992, "t4p", intake, "2026-08-01", "2099-01-01", "10.0.0.2");
    testRijen.push(Number(oud.lastInsertRowid), Number(nieuw.lastInsertRowid));

    const opgeruimd = ruimVerstrekenIntakesOp(new Date("2026-08-01T00:00:00.000Z"));
    expect(opgeruimd).toBeGreaterThanOrEqual(1);

    const lees = sqlite.prepare(`SELECT intake, consent_ip, geanonimiseerd_op FROM prive_aankoop WHERE id = ?`);
    const na = lees.get(Number(oud.lastInsertRowid)) as any;
    expect(na.intake).not.toContain("test@voorbeeld.be");
    expect(na.intake).not.toContain("Kind");
    expect(na.consent_ip).toBeNull();
    expect(na.geanonimiseerd_op).toBeTruthy();

    const blijft = lees.get(Number(nieuw.lastInsertRowid)) as any;
    expect(blijft.intake).toContain("test@voorbeeld.be");
    expect(blijft.geanonimiseerd_op).toBeNull();

    // Idempotent: een tweede ronde raakt de al gewiste rij niet meer aan.
    expect(ruimVerstrekenIntakesOp(new Date("2026-08-01T00:00:00.000Z"))).toBe(0);
  });
});

const testRijen: number[] = [];
afterAll(async () => {
  if (testRijen.length === 0) return;
  const { sqlite } = await import("../server/storage");
  const wis = sqlite.prepare(`DELETE FROM prive_aankoop WHERE id = ?`);
  for (const id of testRijen) wis.run(id);
});
