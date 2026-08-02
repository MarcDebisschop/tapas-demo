import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { basisVersieVan } from "../server/instrument-inhoudsversie";

// ---------------------------------------------------------------------------
// Ronde C, punt 2. De descriptor van T4Sports vermeldde versie 1.0.0 terwijl
// server/data/t4sports.json al op 2.0.0 stond. Het databestand beschrijft de
// werkelijke inhoud, want dat is het bestand dat de descriptor ook echt laadt.
//
// Afspraak die deze test bewaakt: het gezaghebbende versienummer van een
// instrument staat in het databestand van dat instrument, en nergens anders.
// Het register mag dat nummer tonen en er een inhoudsvingerafdruk achter
// hangen, maar mag er geen eigen nummer naast zetten.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");

function lees(relatiefPad: string): any {
  return JSON.parse(readFileSync(path.join(wortel, relatiefPad), "utf-8"));
}

describe("register en databestand noemen hetzelfde versienummer", () => {
  it("T4Sports volgt server/data/t4sports.json", async () => {
    const { getDescriptor } = await import("../server/registry");
    const bestand = lees("server/data/t4sports.json");
    const d = getDescriptor("t4sports");
    expect(d).toBeDefined();
    expect(bestand.version).toBe("2.0.0");
    expect(basisVersieVan(d!.version)).toBe(bestand.version);
  });

  it("de drie T4Sports-modules volgen server/data/t4sports-modules.json", async () => {
    const { getDescriptor } = await import("../server/registry");
    const bestand = lees("server/data/t4sports-modules.json");
    for (const id of ["t4sports-m1", "t4sports-m2", "t4sports-m3"]) {
      const d = getDescriptor(id);
      expect(d, `geen descriptor voor ${id}`).toBeDefined();
      expect(basisVersieVan(d!.version), `${id} loopt uit de pas`).toBe(bestand.version);
    }
  });

  it("T4Professional volgt server/data/instrument.json", async () => {
    const { getDefaultDescriptor } = await import("../server/registry");
    const bestand = lees("server/data/instrument.json");
    expect(basisVersieVan(getDefaultDescriptor().version)).toBe(bestand.version);
  });

  it("elk instrument dat een gehydrateerde definitie meedraagt, noemt hetzelfde nummer", async () => {
    const { alleInstrumenten } = await import("../server/registry");
    const afwijkend = alleInstrumenten()
      .filter((d) => d.instrument?.version)
      .filter((d) => basisVersieVan(d.version) !== d.instrument!.version)
      .map((d) => `${d.instrumentId}: register ${d.version}, bestand ${d.instrument!.version}`);
    expect(afwijkend, `versienummers lopen uiteen:\n${afwijkend.join("\n")}`).toEqual([]);
  });

  it("geen enkele descriptor zet nog een vaste versietekst naast het databestand", () => {
    const bron = readFileSync(path.join(wortel, "server/registry.ts"), "utf-8");
    // De instrumenten met een eigen databestand mogen hun nummer niet meer als
    // letterlijke tekst in het register hebben staan.
    const blok = bron.slice(bron.indexOf('map.set("t4sports"'), bron.indexOf('map.set("t4teens"'));
    expect(blok).not.toMatch(/version:\s*"\d+\.\d+\.\d+"/);
  });
});
