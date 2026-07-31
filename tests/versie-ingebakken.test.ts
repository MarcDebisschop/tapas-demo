import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Auditbevinding O-3. Het statusadres gaf `versie: null` omdat het nummer uit
// process.env.npm_package_version kwam, en die variabele bestaat niet wanneer
// Render met `node dist/index.cjs` start. Sinds v2.8.0 bakt het bouwscript het
// nummer, de commit en de bouwdatum als vaste tekst in de bundel.
//
// Deze test bewaakt dat mechanisme aan de bron, zodat het niet stil terugvalt:
// zij faalt zodra iemand het inbakken uit het bouwscript haalt, het statusadres
// terugzet op de omgevingsvariabele, of het versienummer in package.json
// verhoogt zonder VERSION.md bij te werken.

const wortel = path.resolve(__dirname, "..");
const lees = (p: string) => readFileSync(path.join(wortel, p), "utf-8");

describe("versie ingebakken bij het bouwen", () => {
  it("het bouwscript zet versie, commit en bouwdatum vast in de bundel", () => {
    const bouw = lees("script/build.mjs");
    expect(bouw).toContain('"process.env.TAPAS_VERSIE"');
    expect(bouw).toContain('"process.env.TAPAS_COMMIT"');
    expect(bouw).toContain('"process.env.TAPAS_BOUWDATUM"');
    expect(bouw).toContain("git rev-parse --short HEAD");
  });

  it("de versiemodule leest die drie ingebakken waarden", () => {
    const mod = lees("server/versie.ts");
    expect(mod).toContain("process.env.TAPAS_VERSIE");
    expect(mod).toContain("process.env.TAPAS_COMMIT");
    expect(mod).toContain("process.env.TAPAS_BOUWDATUM");
  });

  it("de module valt terug op package.json wanneer er niets ingebakken is", async () => {
    const mod = await import("../server/versie");
    const pakket = JSON.parse(lees("package.json")) as { version: string };
    // In de testomgeving is niets ingebakken, dus moet stap 2 het nummer
    // alsnog uit package.json halen in plaats van "ontwikkelversie" te tonen.
    expect(mod.VERSIE).toBe(pakket.version);
    expect(mod.BRON).toBe("afgelezen");
    expect(mod.versieGegevens()).toMatchObject({ versie: pakket.version });
  });

  it("het statusadres toont de ingebakken waarden en niet de npm-variabele", () => {
    const index = lees("server/index.ts");
    const blok = index.slice(index.indexOf('app.get("/api/gezondheid"'));
    expect(blok).toContain("versie: VERSIE");
    expect(blok).toContain("commit: COMMIT");
    expect(blok).toContain("bouwdatum: BOUWDATUM");
    expect(blok).toContain("bron: BRON");
    expect(blok).not.toContain("npm_package_version");
  });

  it("package.json en VERSION.md noemen hetzelfde nummer", () => {
    const versie = JSON.parse(lees("package.json")).version as string;
    expect(versie).toMatch(/^\d+\.\d+\.\d+$/);
    const gedocumenteerd = lees("VERSION.md").match(
      /^## Huidige versie: v(\d+\.\d+\.\d+)/m,
    )?.[1];
    expect(gedocumenteerd).toBe(versie);
  });

  it("het bouwscript blokkeert een release waarvan de documentatie achterloopt", () => {
    const bouw = lees("script/build.mjs");
    expect(bouw).toContain("## Huidige versie: v");
    expect(bouw).toContain("process.exit(1)");
  });
});
