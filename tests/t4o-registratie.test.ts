// tests/t4o-registratie.test.ts
//
// Correctie 1: TaPas 4 Organizations (T4O) hoort in het instrumentregister.
// Het instrument was volledig gebouwd en bereikbaar via /api/t4o/..., maar
// stond nergens in server/registry.ts. Daardoor had het geen creditkost, geen
// versie en geen beschrijving, en sloegen de catalogus en het tarievenoverzicht
// het over. Deze tests leggen vast dat dat niet opnieuw kan wegvallen.
//
// Het register raakt bij het inladen de databank aan. Net als in de andere
// tests wijzen we die eerst naar een eigen tijdelijk bestand, zodat twee
// testbestanden niet tegelijk in dezelfde SQLite-databank schrijven. Deze regel
// moet boven de eerste import van de registry blijven staan.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TAPAS_DB_PATH =
  process.env.TAPAS_DB_PATH_TEST_T4O ?? join(tmpdir(), `tapas-t4o-registratie-${process.pid}.db`);

function bron(pad: string): string {
  return readFileSync(pad, "utf8");
}

describe("T4O staat in het instrumentregister", () => {
  it("heeft een volwaardige descriptor onder de identificator t4o", async () => {
    const { getDescriptor } = await import("../server/registry");
    const d = getDescriptor("t4o");
    expect(d, "geen descriptor voor t4o in de registry").toBeDefined();
    expect(d!.name).toBe("TaPas 4 Organizations");
    expect(d!.flowType).toBe("collaborative");
    expect(d!.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(d!.description.length).toBeGreaterThan(40);
    expect(d!.creditCost).toBeGreaterThan(0);
    expect(d!.isDefault).toBe(false);
  });

  it("levert geen dubbele invoeren op in het register", async () => {
    const { alleInstrumenten } = await import("../server/registry");
    const ids = alleInstrumenten().map((d) => d.instrumentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("duikt op in het publieke aanbod en in het tarievenoverzicht", async () => {
    const { publiekeInstrumenten, tarievenOverzicht } = await import("../server/registry");
    expect(publiekeInstrumenten().map((d) => d.instrumentId)).toContain("t4o");
    const regels = tarievenOverzicht().filter((r) => r.instrumentId === "t4o");
    expect(regels).toHaveLength(1);
    expect(regels[0].tariefOmschrijving).toMatch(/credit/);
  });

  it("gebruikt dezelfde identificator als de instrumentengids en de bulk-import", () => {
    expect(bron("client/src/data/instrumentengids.ts")).toContain('id: "t4o"');
    expect(bron("server/bulk-import/templates.ts")).toContain('instrumentId: "t4o"');
  });

  it("houdt de catalogusverrijking bij de identificator uit het register", () => {
    expect(bron("server/routes/instrumenten-catalogus.ts")).toContain('"t4o": {');
  });
});

describe("T4O: de tellingen in het commentaar kloppen met de code", () => {
  it("noemt het gemeten aantal items", async () => {
    const { t4oInstrument } = await import("../server/t4organizations/instrument");
    const aantal = t4oInstrument.items.length;
    expect(aantal).toBe(56);
    const inhoud = bron("server/t4organizations/instrument.ts");
    expect(inhoud).toContain(`Bevat de ${aantal} productie-items`);
    expect(inhoud).toContain(`De ${aantal} productie-items`);
    expect(inhoud).not.toContain("57 productie-items");
  });

  it("noemt het gemeten aantal rapportsecties", () => {
    const inhoud = bron("server/t4organizations/rapport.ts");
    // De samenstelling van het rapport staat in de array `inhoud` onderaan
    // renderT4ORapport(). We tellen de onderdelen daar, en vergelijken met wat
    // het kopcommentaar beweert.
    const blok = inhoud.match(/const inhoud = \[([\s\S]*?)\]\.join/);
    expect(blok, "samenstelling van het rapport niet gevonden").not.toBeNull();
    const aantal = blok![1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0).length;
    expect(aantal).toBe(13);
    expect(inhoud).toContain(`demo-rapport (${aantal} secties)`);
  });
});
