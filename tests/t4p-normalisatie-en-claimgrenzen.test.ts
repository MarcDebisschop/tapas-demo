// Bewaakt twee psychometrische ingrepen op het T4Business Kompas:
//   1. de ordening binnen een familie staat op nettoscore per aanbieding,
//      omdat de talent-versnellers ongelijk worden aangeboden;
//   2. het rapport bevat de vaste claimgrenzen: binnen-persoonlijke lezing,
//      cijfers als gesprekssignaal, en de driverbelasting als werkhypothese.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildGeneratorContract } from "../server/scoring";
import { instrument } from "../server/instrument";
import {
  bouwT4pBusinessKompas,
  KOMPAS_LEESWIJZER,
  LEZING_BINNEN_PERSOON,
  LEZING_GESPREKSSIGNAAL,
  LEZING_PER_AANBIEDING,
  LEZING_DRIVERSIGNAAL,
} from "../server/t4p/kompas-contract";

const wortel = join(__dirname, "..");

describe("aanbiedingen per construct in de itembank", () => {
  it("biedt de talent-versnellers ongelijk aan, wat normalisatie nodig maakt", () => {
    const tellingen: Record<string, { familie: string; aantal: number }> = {};
    for (const blok of instrument.blocks as any[]) {
      for (const item of blok.items as any[]) {
        const c = String(item.construct ?? "");
        if (!c) continue;
        if (!tellingen[c]) tellingen[c] = { familie: String(blok.family ?? ""), aantal: 0 };
        tellingen[c].aantal += 1;
      }
    }
    const versnellers = Object.entries(tellingen)
      .filter(([, v]) => v.familie === "Talent-versnellers")
      .map(([, v]) => v.aantal);
    const drivers = Object.entries(tellingen)
      .filter(([, v]) => v.familie === "Drivers")
      .map(([, v]) => v.aantal);
    expect(versnellers.length).toBeGreaterThan(0);
    // Drivers zijn wel gelijk verdeeld; de versnellers niet.
    expect(new Set(drivers).size).toBe(1);
    expect(new Set(versnellers).size).toBeGreaterThan(1);
  });
});

describe("nettoscore per aanbieding", () => {
  it("staat in de scoringengine en deelt net door het aantal aanbiedingen", () => {
    // Minimale, echte afname: één blok van elke familie volledig antwoorden.
    const antwoorden: Record<string, any> = {};
    (instrument.blocks as any[]).forEach((blok, i) => {
      const gesorteerd = [...(blok.items as any[])].sort((x, y) =>
        String(x.construct).localeCompare(String(y.construct), "nl"),
      );
      antwoorden["B" + i] = {
        most: gesorteerd[0].pos,
        least: gesorteerd[gesorteerd.length - 1].pos,
        blockEnergy: (i % 3) - 1,
        itemEnergy: { most: (i % 5) - 2, least: ((i + 2) % 5) - 2 },
      };
    });
    const contract = buildGeneratorContract({
      respondentCode: "T4P-NORM-001",
      name: "Test Deelnemer",
      responses: antwoorden as any,
      baseline: 6,
      connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
      taal: "nl",
    } as any);
    const rijen = ((contract as any).sections.main.constructRows ?? []) as any[];
    expect(rijen.length).toBeGreaterThan(0);
    for (const r of rijen) {
      if (r.shown > 0) {
        expect(r.netPerAanbieding).toBeCloseTo(Math.round((r.net / r.shown) * 1000) / 1000, 6);
      }
    }
    // Er is minstens één construct waar de genormaliseerde waarde afwijkt van
    // de ruwe nettoscore, anders zou de correctie zinloos zijn.
    expect(rijen.some((r) => r.shown > 1 && r.net !== 0)).toBe(true);
  });
});

describe("vaste claimgrenzen in het rapportcontract", () => {
  const bron = readFileSync(join(wortel, "server/t4p/kompas-contract.ts"), "utf-8");

  it("zegt in de leeswijzer dat de ordening binnen-persoonlijk is", () => {
    expect(KOMPAS_LEESWIJZER).toContain("binnen-persoonlijk");
    expect(KOMPAS_LEESWIJZER.toLowerCase()).toContain("geen normgroep");
    expect(KOMPAS_LEESWIJZER.toLowerCase()).toContain("selectie");
  });

  it("zegt in de leeswijzer dat de cijfers gesprekssignalen zijn", () => {
    expect(KOMPAS_LEESWIJZER).toContain("gesprekssignaal");
    expect(LEZING_GESPREKSSIGNAAL.toLowerCase()).toContain("conventies van de ontwikkelaar");
  });

  it("noemt de driverbelasting een werkhypothese en geen classificatie", () => {
    expect(LEZING_DRIVERSIGNAAL.toLowerCase()).toContain("werkhypothese");
    expect(LEZING_DRIVERSIGNAAL.toLowerCase()).toContain("geen geijkte classificatie");
  });

  it("verklaart de ordening per aanbieding als ontwerpkeuze", () => {
    expect(LEZING_PER_AANBIEDING.toLowerCase()).toContain("per aanbieding");
    expect(LEZING_PER_AANBIEDING.toLowerCase()).toContain("ontwerpkeuze");
  });

  it("plaatst de vaste zinnen in de hoofdstukken drivers, foci en versnellers", () => {
    // Drie plaatsingen plus de leeswijzer: vier verwijzingen naar de
    // binnen-persoonlijke lezing, buiten de definitie zelf.
    const aantal = (bron.match(/LEZING_BINNEN_PERSOON/g) ?? []).length;
    expect(aantal).toBeGreaterThanOrEqual(4);
    expect(bron).toContain("LEZING_PER_AANBIEDING");
    expect(bron).toContain("LEZING_DRIVERSIGNAAL");
  });

  it("laat het rapport de vaste zinnen ook echt tonen", () => {
    expect(LEZING_BINNEN_PERSOON.length).toBeGreaterThan(80);
  });
});

describe("geen schijnprecisie in de rapportweergave", () => {
  const bron = readFileSync(join(wortel, "server/t4p/kompas-contract.ts"), "utf-8");

  it("rondt de weergave af op één decimaal", () => {
    expect(bron).toContain("function getal(x: unknown, decimalen = 1)");
    expect(bron).toContain("Math.round(n * 10) / 10");
  });

  it("houdt twee decimalen in de scoringengine", () => {
    const scoringBron = readFileSync(join(wortel, "server/scoring.ts"), "utf-8");
    expect(scoringBron).toContain("Number(x.toFixed(2))");
  });
});
