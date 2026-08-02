// tests/audit-ronde5.test.ts
//
// Waarborgen van auditronde 5:
//   S-4  Demomodus komt uit één bron en is in productie onmogelijk.
//   F-1  Factuurnummers worden ondeelbaar toegekend, uit één bron.
//   S-2  Inhoudsbeleid voor de browser staat aan (minstens in meldmodus).
//   S-5  De dashboardtokens zijn snelheidsbegrensd.
//   O-4  Er wordt geen dode Python-code meer meegeleverd.
//
// De broncontroles gebeuren met readFileSync, in lijn met de bestaande
// contracttests: zo kan een latere wijziging de waarborg niet stil weghalen.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Dit bestand maakt echte tellerregels aan voor de factuurnummering. Zou dat in
// de gedeelde data.db gebeuren, dan schrijven twee testbestanden tegelijk in
// dezelfde SQLite-databank en kan een andere test sporadisch omvallen. We wijzen
// de databank daarom naar een eigen tijdelijk bestand, vóór de eerste import van
// de opslagmodule. Deze regel moet bovenaan blijven staan.
process.env.TAPAS_DB_PATH =
  process.env.TAPAS_DB_PATH_TEST_RONDE5 ?? join(tmpdir(), `tapas-audit-ronde5-${process.pid}.db`);

function bron(pad: string): string {
  return readFileSync(pad, "utf8");
}

// ---------------------------------------------------------------------------
// S-4 — demomodus
// ---------------------------------------------------------------------------
describe("S-4 demomodus", () => {
  const oudeOmgeving = { ...process.env };
  beforeEach(() => {
    delete process.env.TAPAS_DEMO;
    delete process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env = { ...oudeOmgeving };
  });

  it("is uit wanneer de schakelaar niet gezet is", async () => {
    const { isDemoModus } = await import("../server/demomodus");
    expect(isDemoModus()).toBe(false);
  });

  it("kan buiten productie aan", async () => {
    process.env.TAPAS_DEMO = "1";
    process.env.NODE_ENV = "development";
    const { isDemoModus } = await import("../server/demomodus");
    expect(isDemoModus()).toBe(true);
  });

  it("is in productie ALTIJD uit, ook met de schakelaar aan", async () => {
    process.env.TAPAS_DEMO = "1";
    process.env.NODE_ENV = "production";
    const { isDemoModus } = await import("../server/demomodus");
    expect(isDemoModus()).toBe(false);
  });

  it("waarschuwt luid wanneer de schakelaar in productie gezet staat", async () => {
    process.env.TAPAS_DEMO = "1";
    process.env.NODE_ENV = "production";
    const { meldDemoModusBijOpstart } = await import("../server/demomodus");
    const regels: string[] = [];
    const regel = meldDemoModusBijOpstart((r) => regels.push(r));
    expect(regel).toMatch(/GENEGEERD/);
    expect(regels).toHaveLength(1);
  });

  it("leest de schakelaar nergens anders nog rechtstreeks uit de omgeving", () => {
    const bestanden = [
      "server/routes/afnames.ts",
      "server/routes/organisatie-auth.ts",
      "server/routes/admin.ts",
      "server/routes/dashboard.ts",
      "server/routes-deelnemer.ts",
      "server/routes-stm.ts",
      "server/t4sports/routes.ts",
      "server/t4r/routes.ts",
      "server/storage.ts",
    ];
    for (const pad of bestanden) {
      const inhoud = bron(pad)
        .split("\n")
        .filter((r) => !r.trim().startsWith("//") && !r.trim().startsWith("*"))
        .join("\n");
      expect(inhoud, pad).not.toContain("process.env.TAPAS_DEMO");
      expect(inhoud, pad).toContain("isDemoModus");
    }
  });

  it("meldt de stand van de demomodus bij het opstarten van de server", () => {
    expect(bron("server/index.ts")).toContain("meldDemoModusBijOpstart()");
  });
});

// ---------------------------------------------------------------------------
// F-1 — factuurnummering
// ---------------------------------------------------------------------------
describe("F-1 factuurnummering", () => {
  it("kent opeenvolgende nummers toe zonder gaten of herhaling", async () => {
    const { neemFactuurnummer } = await import("../server/factuurnummer");
    const jaar = 2999; // eigen jaar, raakt geen echte reeks
    const eerste = neemFactuurnummer("TESTF1", jaar);
    const nummers = new Set<string>([eerste]);
    for (let i = 0; i < 25; i++) nummers.add(neemFactuurnummer("TESTF1", jaar));
    // 26 aanvragen, 26 verschillende nummers.
    expect(nummers.size).toBe(26);
    expect(eerste).toMatch(/^TESTF1-2999-\d{4}$/);
    const reeks = [...nummers]
      .map((n) => parseInt(n.split("-")[2], 10))
      .sort((a, b) => a - b);
    // Aaneensluitend: elk volgend nummer is exact één hoger.
    for (let i = 1; i < reeks.length; i++) expect(reeks[i]).toBe(reeks[i - 1] + 1);
  });

  it("houdt reeksen per prefix en per jaar apart", async () => {
    const { neemFactuurnummer } = await import("../server/factuurnummer");
    // De teller blijft in de databank staan, dus we vergelijken de vorm en de
    // onderlinge onafhankelijkheid, niet een absoluut startnummer.
    const a1 = neemFactuurnummer("TESTF1A", 2998);
    const b1 = neemFactuurnummer("TESTF1B", 2998);
    const a2 = neemFactuurnummer("TESTF1A", 2998);
    const c1 = neemFactuurnummer("TESTF1A", 2997);
    expect(a1).toMatch(/^TESTF1A-2998-\d{4}$/);
    expect(b1).toMatch(/^TESTF1B-2998-\d{4}$/);
    expect(c1).toMatch(/^TESTF1A-2997-\d{4}$/);
    // Een nummer in reeks A verhoogt reeks B niet, en jaar 2997 staat los.
    const nr = (s: string) => parseInt(s.split("-")[2], 10);
    expect(nr(a2)).toBe(nr(a1) + 1);
  });

  it("gebruikt een ondeelbare transactie in plaats van lezen-dan-schrijven", () => {
    const inhoud = bron("server/factuurnummer.ts");
    expect(inhoud).toContain("transactie.immediate");
    expect(inhoud).toContain("factuur_reeks");
  });

  it("heeft geen tweede kopie van de nummerlogica meer", () => {
    for (const pad of ["server/storage.ts", "server/prive-aankoop/routes.ts"]) {
      const inhoud = bron(pad);
      expect(inhoud, pad).not.toMatch(/function volgendFactuurnummer/);
      expect(inhoud, pad).toContain("neemFactuurnummer(biller.factuurPrefix)");
    }
  });
});

// ---------------------------------------------------------------------------
// S-2 — inhoudsbeleid voor de browser
// ---------------------------------------------------------------------------
describe("S-2 inhoudsbeleid voor de browser", () => {
  const inhoud = bron("server/index.ts");

  it("staat niet meer volledig uit", () => {
    expect(inhoud).not.toContain("contentSecurityPolicy: false,\n    crossOrigin");
    expect(inhoud).toContain("cspRichtlijnen");
  });

  it("draait standaard in meldmodus zodat niets breekt", () => {
    expect(inhoud).toContain('process.env.TAPAS_CSP ?? "melden"');
    expect(inhoud).toContain('reportOnly: cspStand !== "handhaven"');
  });

  it("heeft een ontvangstpunt voor de meldingen", () => {
    expect(inhoud).toContain('"/api/csp-melding"');
    expect(inhoud).toContain("[csp-melding]");
  });
});

// ---------------------------------------------------------------------------
// S-5 — begrenzing op de dashboardtokens
// ---------------------------------------------------------------------------
describe("S-5 begrenzing op de dashboardtokens", () => {
  const inhoud = bron("server/index.ts");

  it("begrenst de tokenpaden van alle dashboards", () => {
    expect(inhoud).toContain("tokenLimiter");
    for (const pad of [
      "/api/dashboard/:token",
      "/api/t4sports/dashboard/:token",
      "/api/teamscan/deelnemer/:token",
      "/api/t4o/respondent/:token",
      "/api/r/:token",
    ]) {
      expect(inhoud, pad).toContain(pad);
    }
  });

  it("laat normaal gebruik ruim toe", () => {
    const blok = inhoud.slice(inhoud.indexOf("const tokenLimiter"));
    expect(blok).toMatch(/limit:\s*120/);
  });
});

// ---------------------------------------------------------------------------
// O-4 — geen dode Python-code
// ---------------------------------------------------------------------------
describe("O-4 dode Python-code", () => {
  it("bevat de ongebruikte Python-bestanden niet meer", () => {
    for (const pad of [
      "server/generate_audio.py",
      "server/llm_fallback.py",
      "server/llm_fallback_recruiter.py",
      "server/llm_prompts_recruiter.py",
      "server/llm_sidecar.py",
      "script/simulate_responses.py",
    ]) {
      expect(existsSync(pad), pad).toBe(false);
    }
  });

  it("behoudt het Python-script dat wél gebruikt wordt", () => {
    expect(existsSync("server/tts.py")).toBe(true);
    expect(bron("script/build.mjs")).toContain("tts.py");
  });
});

// ---------------------------------------------------------------------------
// C-1 — instrumentenaanbod uit één bron
// ---------------------------------------------------------------------------
describe("C-1 instrumentenaanbod", () => {
  it("bevat alle instrumenten in de registry, met een zichtbaarheidsvlag", async () => {
    const { alleInstrumenten, publiekeInstrumenten } = await import("../server/registry");
    const ids = alleInstrumenten().map((d) => d.instrumentId);
    // De drie instrumenten die vroeger buiten de registry vielen.
    for (const id of ["twominscan", "stm", "driverscan"]) expect(ids).toContain(id);
    // De Driver-scan bestaat wel, maar hoort niet in het publieke aanbod.
    const publiek = publiekeInstrumenten().map((d) => d.instrumentId);
    expect(publiek).not.toContain("driverscan");
    expect(publiek).toContain("twominscan");
    expect(publiek).toContain("stm");
    // Het publieke aanbod is exact het volledige aanbod min de verborgen items.
    expect(publiek.length).toBe(ids.length - 1);
  });

  it("leidt de catalogus af uit de registry, zonder handmatige lijst of naamfilter", () => {
    const inhoud = bron("server/routes/instrumenten-catalogus.ts");
    expect(inhoud).toContain("publiekeInstrumenten()");
    // Geen filter op naam en geen tweede, handmatig samengestelde lijst meer.
    expect(inhoud).not.toContain('inst.instrumentId !== "driverscan"');
    expect(inhoud).not.toMatch(/const extra = \[/);
  });
});

// ---------------------------------------------------------------------------
// Terminologie — het woord "drijfveer/drijfveren" mag nergens staan; de
// vaste term is "driver(s)", in elke taal. Dit is een platformafspraak die in
// eerdere rondes telkens opnieuw insloop; daarom een test die ze afdwingt.
// ---------------------------------------------------------------------------
describe("Terminologie: altijd driver(s)", () => {
  // Ronde C, punt 5. Deze test keek eerder enkel in server, client/src, shared
  // en script. Daardoor kon het woord ongemerkt blijven staan in de
  // vertaalbestanden buiten die mappen, in losse HTML-pagina's onder
  // client/public en in de documentatie in de hoofdmap. De zoekopdracht loopt nu
  // over de hele boom.
  //
  // Twee soorten bestanden zijn uitgezonderd, en enkel deze twee:
  //   - de testbestanden die het woord noemen om het te kunnen verbieden;
  //   - client/public/assets, waar een oude, meegecommitte bundel staat. Die
  //     bundel is bouwresultaat en geen broncode: de bron waaruit hij ooit
  //     gemaakt is, is intussen verbeterd. Hij wordt door geen enkele pagina
  //     ingeladen (client/index.html wijst naar een verse bundel) en verdwijnt
  //     bij de eerstvolgende opruiming van meegecommitte bouwbestanden.
  it("gebruikt het verboden woord nergens, in geen enkele taal", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const uitvoer = execSync(
      'grep -rilI "drijfve" . ' +
        "--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist " +
        "--exclude-dir=assets --exclude-dir=tests || true",
      { encoding: "utf8", cwd: resolve(__dirname, "..") },
    ).trim();
    expect(uitvoer, `verboden term gevonden in:\n${uitvoer}`).toBe("");
  });
});

// ---------------------------------------------------------------------------
// P-2 — mailkoppeling in het doorgifteregister
// ---------------------------------------------------------------------------
describe("P-2 doorgifteregister", () => {
  const oud = process.env.SMTP_HOST;
  afterEach(() => {
    if (oud === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = oud;
  });

  it("vermeldt de mailkoppeling als niet-actief zonder SMTP-configuratie", async () => {
    delete process.env.SMTP_HOST;
    const { mailDoorgifteKanaal } = await import("../server/doorgifteregister");
    const regel = mailDoorgifteKanaal();
    expect(regel.kanaal).toBe("e-mail");
    expect(regel.actief).toBe(false);
    expect(regel.vaststelling).toMatch(/verstuurt niets/);
  });

  it("vermeldt de mailkoppeling als actief zodra SMTP geconfigureerd is", async () => {
    process.env.SMTP_HOST = "smtp-relay.example.net";
    const { mailDoorgifteKanaal } = await import("../server/doorgifteregister");
    const regel = mailDoorgifteKanaal();
    expect(regel.actief).toBe(true);
    expect(regel.ontvanger).toContain("smtp-relay.example.net");
    expect(regel.gegevens).toMatch(/e-mailadres/);
  });

  it("brengt taalmodel, e-mail en betaaldienst samen in één register", async () => {
    const { volledigDoorgifteRegister } = await import("../server/doorgifteregister");
    const register = volledigDoorgifteRegister([
      {
        instrumentId: "t4p-business-kompas",
        label: "T4P Business Kompas",
        liveDuidingAan: false,
        ontvanger: "Google (Gemini API)",
        land: "buiten de EER",
        grondslagVereist: "DPA met Google",
      },
    ]);
    // Drie kanalen: het taalmodel, de mailleverancier en de betaaldienst. Die
    // laatste hoort er sinds de privacydoorlichting bij: artikel 30 vraagt elke
    // ontvanger, ook wanneer het kanaal vandaag nog in simulatie draait.
    expect(register).toHaveLength(3);
    expect(register[0].kanaal).toContain("taalmodel");
    expect(register.map((r) => r.kanaal)).toContain("e-mail");
    expect(register[register.length - 1].kanaal).toBe("betaaldienst");
    for (const r of register) {
      expect(r.doel.length).toBeGreaterThan(10);
      expect(r.grondslagVereist.length).toBeGreaterThan(10);
    }
  });

  it("is voor een beheerder op te vragen", () => {
    const inhoud = bron("server/routes/admin.ts");
    expect(inhoud).toContain('"/api/admin/doorgifteregister"');
    expect(inhoud).toContain("volledigDoorgifteRegister");
  });
});
