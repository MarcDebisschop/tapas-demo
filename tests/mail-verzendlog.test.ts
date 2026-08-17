// ---------------------------------------------------------------------------
// tests/mail-verzendlog.test.ts - het blijvende verzendlogboek van uitgaande mail
//
// AANLEIDING. Een uitnodiging werd verstuurd, de ontvanger meldde dat er niets
// aankwam, en achteraf was niet vast te stellen of het bericht ooit vertrokken
// was. De verzendmodule kende de stand wel (verstuurd, gesimuleerd, fout), maar
// bewaarde die nergens. Dit logboek dicht dat gat.
//
// Wat deze toetsen vastleggen:
//   1. Een regel legt tijdstip, soort, ontvanger, afzender, onderwerp, stand en
//      kanaal vast. Zonder tijdstip is een logboek geen logboek.
//   2. Het kanaal wordt bij elke regel opnieuw bepaald uit de omgeving, want een
//      omgevingsvariabele kan tussen twee verzendingen wijzigen.
//   3. Schrijven werpt nooit. Een logboek is een hulpmiddel, geen voorwaarde:
//      een ontbrekende tabel mag geen enkele mail tegenhouden.
//   4. De filters laten enkel bekende waarden door. Een onbekende waarde wordt
//      genegeerd in plaats van in de vraag te belanden.
//   5. De databank weigert een onbekende soort, stand of kanaal. De grens ligt
//      dus niet enkel in de code maar ook in het schema.
//   6. Broncontrole: de verzendmodule legt alle vier de soorten vast, en noch de
//      module noch het logboek raakt de persoonlijke link of de berichttekst aan.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const geheugenDb = new Database(":memory:");
vi.mock("../server/storage", () => ({ sqlite: geheugenDb }));

const { schrijfVerzendregel, leesVerzendlog, kanaalNu } = await import(
  "../server/bulk-import/verzendlog"
);

const MIGRATIE = readFileSync("migrations/0009_mailverzendlog.sql", "utf8");
const MAILER = readFileSync("server/bulk-import/mailer.ts", "utf8");
const VERZENDLOG = readFileSync("server/bulk-import/verzendlog.ts", "utf8");

/** De tabel opbouwen uit het echte migratiebestand, niet uit een kopie ervan. */
function bouwTabel(): void {
  geheugenDb.exec(MIGRATIE);
}

const bewaardeOmgeving = {
  brevo: process.env.BREVO_API_KEY,
  host: process.env.SMTP_HOST,
};

beforeEach(() => {
  geheugenDb.exec("DROP TABLE IF EXISTS mail_verzendlog");
  bouwTabel();
  delete process.env.BREVO_API_KEY;
  delete process.env.SMTP_HOST;
});

afterEach(() => {
  if (bewaardeOmgeving.brevo === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = bewaardeOmgeving.brevo;
  if (bewaardeOmgeving.host === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = bewaardeOmgeving.host;
});

describe("verzendlogboek: een regel legt de poging vast", () => {
  it("bewaart tijdstip, soort, ontvanger, afzender, onderwerp en stand", () => {
    schrijfVerzendregel({
      soort: "uitnodiging",
      ontvanger: "deelnemer@voorbeeld.be",
      afzender: "info@tapascity.com",
      onderwerp: "Uitnodiging T4Students",
      status: "verstuurd",
      melding: "kenmerk-123",
      taal: "nl",
      instrument: "T4Students",
    });

    const uit = leesVerzendlog();
    expect(uit.logboekOntbreekt).toBe(false);
    expect(uit.regels).toHaveLength(1);
    const r = uit.regels[0]!;
    expect(r.soort).toBe("uitnodiging");
    expect(r.ontvanger).toBe("deelnemer@voorbeeld.be");
    expect(r.afzender).toBe("info@tapascity.com");
    expect(r.onderwerp).toBe("Uitnodiging T4Students");
    expect(r.status).toBe("verstuurd");
    expect(r.melding).toBe("kenmerk-123");
    expect(r.taal).toBe("nl");
    expect(r.instrument).toBe("T4Students");
    // Zonder tijdstip is een logboek geen logboek.
    expect(r.tijdstip).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("zet de jongste regel bovenaan", () => {
    for (const naam of ["een", "twee", "drie"]) {
      schrijfVerzendregel({
        soort: "bericht",
        ontvanger: `${naam}@voorbeeld.be`,
        afzender: "info@tapascity.com",
        onderwerp: naam,
        status: "verstuurd",
      });
    }
    const uit = leesVerzendlog();
    expect(uit.regels.map((r) => r.onderwerp)).toEqual(["drie", "twee", "een"]);
  });

  it("telt per stand over het volledige logboek", () => {
    const standen = ["verstuurd", "verstuurd", "gesimuleerd", "fout"] as const;
    standen.forEach((stand, i) => {
      schrijfVerzendregel({
        soort: "toegangsmail",
        ontvanger: `nr${i}@voorbeeld.be`,
        afzender: "info@tapascity.com",
        onderwerp: "toegang",
        status: stand,
      });
    });
    const uit = leesVerzendlog();
    expect(uit.telling).toEqual({ verstuurd: 2, gesimuleerd: 1, fout: 1 });
    expect(uit.totaal).toBe(4);
  });
});

describe("verzendlogboek: het kanaal komt uit de omgeving", () => {
  it("meldt brevo-api zodra er een Brevo-sleutel staat", () => {
    process.env.BREVO_API_KEY = "sleutel";
    process.env.SMTP_HOST = "smtp.voorbeeld.be";
    expect(kanaalNu()).toBe("brevo-api");
  });

  it("meldt smtp wanneer enkel een host staat", () => {
    process.env.SMTP_HOST = "smtp.voorbeeld.be";
    expect(kanaalNu()).toBe("smtp");
  });

  it("meldt geen wanneer er niets staat", () => {
    expect(kanaalNu()).toBe("geen");
  });

  it("legt het kanaal per regel vast en niet eenmalig bij het opstarten", () => {
    process.env.SMTP_HOST = "smtp.voorbeeld.be";
    schrijfVerzendregel({
      soort: "aanmeldlink",
      ontvanger: "een@voorbeeld.be",
      afzender: "info@tapascity.com",
      onderwerp: "aanmelden",
      status: "verstuurd",
    });
    process.env.BREVO_API_KEY = "sleutel";
    schrijfVerzendregel({
      soort: "aanmeldlink",
      ontvanger: "twee@voorbeeld.be",
      afzender: "info@tapascity.com",
      onderwerp: "aanmelden",
      status: "verstuurd",
    });
    const uit = leesVerzendlog();
    expect(uit.regels.map((r) => r.kanaal)).toEqual(["brevo-api", "smtp"]);
  });
});

describe("verzendlogboek: schrijven mag de verzending nooit breken", () => {
  it("werpt niet wanneer de tabel ontbreekt", () => {
    geheugenDb.exec("DROP TABLE IF EXISTS mail_verzendlog");
    const stil = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      schrijfVerzendregel({
        soort: "uitnodiging",
        ontvanger: "deelnemer@voorbeeld.be",
        afzender: "info@tapascity.com",
        onderwerp: "Uitnodiging",
        status: "verstuurd",
      }),
    ).not.toThrow();
    expect(stil).toHaveBeenCalled();
    stil.mockRestore();
  });

  it("meldt een ontbrekend logboek bij het lezen in plaats van te werpen", () => {
    geheugenDb.exec("DROP TABLE IF EXISTS mail_verzendlog");
    const stil = vi.spyOn(console, "error").mockImplementation(() => {});
    const uit = leesVerzendlog();
    expect(uit.logboekOntbreekt).toBe(true);
    expect(uit.regels).toEqual([]);
    expect(uit.totaal).toBe(0);
    stil.mockRestore();
  });
});

describe("verzendlogboek: de filters laten enkel bekende waarden door", () => {
  beforeEach(() => {
    schrijfVerzendregel({
      soort: "uitnodiging",
      ontvanger: "herman@voorbeeld.be",
      afzender: "info@tapascity.com",
      onderwerp: "Uitnodiging",
      status: "fout",
    });
    schrijfVerzendregel({
      soort: "bericht",
      ontvanger: "anders@voorbeeld.be",
      afzender: "info@tapascity.com",
      onderwerp: "Vraag",
      status: "verstuurd",
    });
  });

  it("filtert op stand", () => {
    expect(leesVerzendlog({ status: "fout" }).regels).toHaveLength(1);
    expect(leesVerzendlog({ status: "fout" }).regels[0]!.ontvanger).toBe("herman@voorbeeld.be");
  });

  it("filtert op soort", () => {
    expect(leesVerzendlog({ soort: "bericht" }).regels).toHaveLength(1);
  });

  it("zoekt op een deel van het adres", () => {
    expect(leesVerzendlog({ zoek: "herman" }).regels).toHaveLength(1);
    expect(leesVerzendlog({ zoek: "bestaatniet" }).regels).toHaveLength(0);
  });

  it("negeert een onbekende stand in plaats van die door te geven", () => {
    // Een waarde die niet bestaat mag geen selectie opleveren die stil leeg is,
    // en mag al zeker niet in de vraag terechtkomen.
    const uit = leesVerzendlog({ status: "'; DROP TABLE mail_verzendlog; --" });
    expect(uit.regels).toHaveLength(2);
    expect(uit.logboekOntbreekt).toBe(false);
  });

  it("houdt de limiet binnen de grens", () => {
    expect(leesVerzendlog({ limiet: 1 }).regels).toHaveLength(1);
    // Het totaal blijft het volledige aantal, ook als de limiet minder toont.
    expect(leesVerzendlog({ limiet: 1 }).totaal).toBe(2);
    expect(leesVerzendlog({ limiet: -5 }).regels).toHaveLength(2);
    expect(leesVerzendlog({ limiet: 99999 }).regels).toHaveLength(2);
  });
});

describe("verzendlogboek: de databank bewaakt de toegestane waarden", () => {
  const voegToe = (kolom: string, waarde: string) =>
    geheugenDb
      .prepare(
        `INSERT INTO mail_verzendlog (tijdstip, soort, ontvanger, afzender, onderwerp, status, kanaal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        new Date().toISOString(),
        kolom === "soort" ? waarde : "uitnodiging",
        "een@voorbeeld.be",
        "info@tapascity.com",
        "test",
        kolom === "status" ? waarde : "verstuurd",
        kolom === "kanaal" ? waarde : "smtp",
      );

  it("weigert een onbekende soort", () => {
    expect(() => voegToe("soort", "nieuwsbrief")).toThrow();
  });

  it("weigert een onbekende stand", () => {
    expect(() => voegToe("status", "misschien")).toThrow();
  });

  it("weigert een onbekend kanaal", () => {
    expect(() => voegToe("kanaal", "duif")).toThrow();
  });

  it("laat de drie kanalen wel toe", () => {
    for (const kanaal of ["brevo-api", "smtp", "geen"]) {
      expect(() => voegToe("kanaal", kanaal)).not.toThrow();
    }
  });
});

describe("verzendlogboek: bronvoorwaarden", () => {
  it("legt in de verzendmodule alle vier de soorten vast", () => {
    for (const soort of ["uitnodiging", "toegangsmail", "aanmeldlink", "bericht"]) {
      expect(MAILER, `soort ${soort} wordt niet vastgelegd`).toContain(`boek("${soort}"`);
    }
  });

  it("legt in elke verzendfunctie de drie uitgangen vast", () => {
    // Drie uitgangen per functie (gesimuleerd, de API-weg, SMTP plus fout) maal
    // vier functies. Zakt een uitgang weg, dan ontstaat er een stil gat in het
    // logboek, en een gat in een logboek merkt niemand.
    const aantal = (MAILER.match(/boek\(/g) ?? []).length;
    expect(aantal).toBeGreaterThanOrEqual(16);
  });

  it("bewaart de persoonlijke link niet en de berichttekst niet", () => {
    // Een deelnemerslink is een sleutel: wie hem heeft, opent de deur van die
    // deelnemer. Het logboek moet aantonen DAT er verstuurd is, niet WAT er in
    // stond. Deze toets kijkt naar de velden die naar de tabel gaan.
    expect(VERZENDLOG).not.toMatch(/\blink\b\s*:/);
    expect(VERZENDLOG).not.toMatch(/\btekst\b\s*:/);
    expect(MIGRATIE).not.toContain("`link`");
    expect(MIGRATIE).not.toContain("`tekst`");
    // En de boekhelper in de verzendmodule geeft enkel deze velden door.
    const helper = MAILER.slice(MAILER.indexOf("function boek("), MAILER.indexOf("let transporterCache"));
    expect(helper).not.toContain("input.link");
    expect(helper).not.toContain("text:");
  });

  it("houdt de migratie strikt additief", () => {
    // Een tweede loop mag niets stukmaken.
    expect(MIGRATIE).toContain("CREATE TABLE IF NOT EXISTS `mail_verzendlog`");
    expect(MIGRATIE).not.toMatch(/\bDROP\b/);
    expect(MIGRATIE).not.toMatch(/\bALTER\b/);
    for (const index of ["tijdstip", "status", "ontvanger"]) {
      expect(MIGRATIE).toContain(`idx_mail_verzendlog_${index}`);
    }
  });
});
