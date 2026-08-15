// ---------------------------------------------------------------------------
// tests/deelnemerslogin-afgesloten.test.ts
//
// WAT DEZE TOETSEN VASTHOUDEN
// POST /api/deelnemers/login gaf het dashboardToken van een deelnemer terug
// zodra iemand het bijbehorende e-mailadres intikte, en maakte bij een onbekend
// adres zelfs een nieuwe deelnemer aan. Dat is de open weg naast de aanmeldlink
// op /mijn.
//
// De controle vooraf wees uit dat de route geen dode code was:
// client/src/pages/poort.tsx roept ze aan, en die pagina staat achter de
// clientvlag BELEVING die runtime aan te zetten is. Er waren dus twee zaken te
// scheiden: een tweede, werkelijk onbereikbare registratie in
// server/routes-deelnemer.ts, en de actieve registratie in
// server/routes/dashboard.ts.
//
// De gekozen weg volgt server/demomodus.ts (auditbevinding S-4): één plaats
// waar de schakelaar bepaald wordt, en in productie is hij onmogelijk. Deze
// toetsen leggen dat vast, plus dat de opruiming niet stilletjes terugkomt.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function bron(pad: string): string {
  return readFileSync(resolve(__dirname, "..", pad), "utf8");
}

/** Bron zonder commentaarregels, zodat verantwoordingskoppen niet meetellen. */
function code(pad: string): string {
  return bron(pad)
    .split("\n")
    .filter((r) => {
      const t = r.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

describe("De belevingsmodus — de schakelaar", () => {
  const oudeOmgeving = { ...process.env };
  beforeEach(() => {
    delete process.env.TAPAS_BELEVING;
    delete process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env = { ...oudeOmgeving };
  });

  it("is uit wanneer de schakelaar niet gezet is", async () => {
    const { isBelevingsmodus } = await import("../server/belevingsmodus");
    expect(isBelevingsmodus()).toBe(false);
  });

  it("kan buiten productie aan", async () => {
    process.env.TAPAS_BELEVING = "1";
    process.env.NODE_ENV = "development";
    const { isBelevingsmodus } = await import("../server/belevingsmodus");
    expect(isBelevingsmodus()).toBe(true);
  });

  it("is in productie ALTIJD uit, ook met de schakelaar aan", async () => {
    process.env.TAPAS_BELEVING = "1";
    process.env.NODE_ENV = "production";
    const { isBelevingsmodus } = await import("../server/belevingsmodus");
    expect(isBelevingsmodus()).toBe(false);
  });

  it("negeert elke andere waarde dan 1", async () => {
    process.env.NODE_ENV = "development";
    for (const waarde of ["0", "true", "ja", "aan", ""]) {
      process.env.TAPAS_BELEVING = waarde;
      const { isBelevingsmodus } = await import("../server/belevingsmodus");
      expect(isBelevingsmodus()).toBe(false);
    }
  });

  it("waarschuwt luid wanneer de schakelaar in productie gezet staat", async () => {
    process.env.TAPAS_BELEVING = "1";
    process.env.NODE_ENV = "production";
    const { meldBelevingsmodusBijOpstart } = await import("../server/belevingsmodus");
    const regels: string[] = [];
    const regel = meldBelevingsmodusBijOpstart((r) => regels.push(r));
    expect(regel).toMatch(/GENEGEERD/);
    expect(regels).toHaveLength(1);
  });

  it("meldt in de standaardstand dat het pad niet bestaat", async () => {
    const { meldBelevingsmodusBijOpstart } = await import("../server/belevingsmodus");
    const regel = meldBelevingsmodusBijOpstart(() => {});
    expect(regel).toMatch(/bestaat niet/);
    expect(regel).toMatch(/aanmeldlink/);
  });

  it("waarschuwt wanneer de poort werkelijk actief is", async () => {
    process.env.TAPAS_BELEVING = "1";
    process.env.NODE_ENV = "development";
    const { meldBelevingsmodusBijOpstart } = await import("../server/belevingsmodus");
    const regel = meldBelevingsmodusBijOpstart(() => {});
    expect(regel).toMatch(/ACTIEF/);
    expect(regel).toMatch(/Nooit met echte deelnemersgegevens/);
  });

  it("leest de schakelaar nergens anders rechtstreeks uit de omgeving", () => {
    for (const pad of [
      "server/routes/dashboard.ts",
      "server/routes-deelnemer.ts",
      "server/index.ts",
    ]) {
      expect(code(pad)).not.toMatch(/process\.env\.TAPAS_BELEVING/);
    }
  });
});

describe("De onbereikbare tweede registratie is weg", () => {
  it("server/routes-deelnemer.ts registreert het loginpad niet meer", () => {
    expect(code("server/routes-deelnemer.ts")).not.toMatch(
      /app\.post\(\s*["']\/api\/deelnemers\/login["']/,
    );
  });

  it("dat bestand maakt geen deelnemer meer aan langs een loginweg", () => {
    expect(code("server/routes-deelnemer.ts")).not.toMatch(/vindOfMaakDeelnemer/);
  });

  it("het ongebruikte loginschema is niet meer geïmporteerd", () => {
    expect(code("server/routes-deelnemer.ts")).not.toMatch(/deelnemerLoginSchema/);
  });

  it("er blijft precies één registratie van het pad in de server over", () => {
    const bestanden = ["server/routes/dashboard.ts", "server/routes-deelnemer.ts"];
    const totaal = bestanden.reduce(
      (n, pad) =>
        n + (code(pad).match(/app\.post\(\s*["']\/api\/deelnemers\/login["']/g) ?? []).length,
      0,
    );
    expect(totaal).toBe(1);
  });

  it("de registratie-orde die de tweede versie onbereikbaar maakte, staat nog zo", () => {
    // De verantwoording van de verwijdering leunt hierop: in server/routes.ts
    // komt registerDashboardRoutes vóór registerDeelnemerRoutes, en in Express
    // wint de eerste handler. Verschuift die orde ooit, dan moet de
    // verantwoording herzien worden en faalt deze toets.
    const r = code("server/routes.ts");
    const dash = r.indexOf("registerDashboardRoutes(app)");
    const deel = r.indexOf("registerDeelnemerRoutes(app)");
    expect(dash).toBeGreaterThan(-1);
    expect(deel).toBeGreaterThan(-1);
    expect(dash).toBeLessThan(deel);
  });
});

describe("De overgebleven registratie staat achter de vlag", () => {
  const dash = code("server/routes/dashboard.ts");

  it("de route wordt alleen geregistreerd binnen isBelevingsmodus()", () => {
    expect(dash).toMatch(
      /if\s*\(\s*isBelevingsmodus\(\)\s*\)\s*\{[\s\S]*app\.post\(\s*["']\/api\/deelnemers\/login["']/,
    );
  });

  it("de schakelaar komt uit de ene module, niet uit de omgeving", () => {
    expect(dash).toMatch(/import \{ isBelevingsmodus \} from "\.\.\/belevingsmodus"/);
  });

  it("maakt geen deelnemer meer aan bij een onbekend adres", () => {
    const blok = dash.slice(dash.indexOf("if (isBelevingsmodus())"));
    const route = blok.slice(0, blok.indexOf('app.get("/api/dashboard/:token"'));
    expect(route).not.toMatch(/vindOfMaakDeelnemer/);
    expect(route).toMatch(/getDeelnemerByEmail/);
  });

  it("antwoordt 404 wanneer er geen dossier is", () => {
    const blok = dash.slice(dash.indexOf("if (isBelevingsmodus())"));
    const route = blok.slice(0, blok.indexOf('app.get("/api/dashboard/:token"'));
    expect(route).toMatch(/res\.status\(404\)/);
  });
});

describe("De randvoorwaarden blijven staan", () => {
  it("de authLimiter dekt het pad nog, want het kan achter de vlag bestaan", () => {
    expect(code("server/index.ts")).toMatch(/"\/api\/deelnemers\/login"/);
  });

  it("de stand staat bij elke opstart in het logboek", () => {
    const idx = code("server/index.ts");
    expect(idx).toMatch(/meldBelevingsmodusBijOpstart\(\)/);
    expect(idx).toMatch(/import \{ meldBelevingsmodusBijOpstart \} from "\.\/belevingsmodus"/);
  });

  it("de belevingscode blijft in de repo, zoals features.ts belooft", () => {
    // client/src/lib/features.ts: "Niets wordt verwijderd — de belevingscode
    // blijft volledig in de repo." De poortpagina en haar twee routes blijven
    // dus bestaan; alleen de serverdeur gaat in productie dicht.
    expect(bron("client/src/pages/poort.tsx").length).toBeGreaterThan(1000);
    const app = code("client/src/App.tsx");
    expect(app).toMatch(/path="\/poort"/);
    expect(app).toMatch(/path="\/poort\/:skin"/);
  });

  it("de poort kan een afwezige route zichtbaar melden", () => {
    // Bij een 404 valt de mutatie in isError; de pagina heeft daar al een
    // melding voor, dus ze faalt zichtbaar en niet stil.
    const poort = code("client/src/pages/poort.tsx");
    expect(poort).toMatch(/loginMutatie\.isError/);
    expect(poort).toMatch(/data-testid="text-fout"/);
  });

  it("de veilige weg op /mijn is niet aangeraakt", () => {
    expect(code("client/src/pages/mijn.tsx")).toMatch(/\/api\/deelnemers\/magic-link/);
    expect(code("client/src/pages/mijn.tsx")).not.toMatch(/\/api\/deelnemers\/login/);
  });
});

// ---------------------------------------------------------------------------
// Vangnet buiten deze opdracht, aangetroffen bij de push naar main.
//
// De CI-loop op main stond rood: tests/bekwaamheid-licentiebeeld.test.ts en
// tests/bekwaamheid-licentiebeeld-route.test.ts importeerden hun bronbestanden
// via een absoluut pad uit de ontwikkelzandbak
// ("/home/user/workspace/core/server/..."). Lokaal werkt dat; op elke andere
// machine — de CI-loop, een collega, een verse checkout — bestaat dat pad niet
// en faalt het hele testbestand met "Cannot find module".
//
// Zeven imports zijn omgezet naar relatieve paden. Deze toets houdt vast dat er
// geen achtste bijkomt.
// ---------------------------------------------------------------------------
describe("Geen absolute zandbakpaden in de tests", () => {
  it("geen enkel testbestand importeert via /home/user/workspace", () => {
    const map = resolve(__dirname);
    const overtreders = readdirSync(map)
      .filter((n) => n.endsWith(".test.ts"))
      .filter((n) => /from\s+["']\/home\/user\//.test(readFileSync(resolve(map, n), "utf8")));
    expect(overtreders).toEqual([]);
  });
});
