/**
 * De Belgische feestdagen, geijkt op onafhankelijke bronnen.
 *
 * Waarom er twaalf paasdata in dit bestand staan en niet twee. Een paasberekening
 * die één jaar goed uitkomt, is niet gecontroleerd — de formule van Meeus/Butcher
 * heeft juist bij de overgang tussen eeuwcorrecties de gevallen waar ze fout kan
 * gaan. De reeks 2024 tot 2035 dekt zowel maart- als aprilpasen en zowel gewone
 * als schrikkeljaren.
 *
 * De ijkbron is `dateutil.easter` uit de Python-standaardomgeving, methode 3
 * (gregoriaans, westers). Dat is een andere implementatie van dezelfde
 * astronomische regel, dus een overeenkomst over twaalf jaar is een echte
 * controle en niet een herhaling van dezelfde code.
 */
import { describe, it, expect } from "vitest";
import {
  eerstePaasdag,
  feestdagenVan,
  feestdatumsTussenJaren,
  isFeestdag,
} from "../server/bekwaamheid/feestdagen";
import { werkdagenTussen } from "../server/bekwaamheid/regiekamer";

/** Eerste paasdag volgens `dateutil.easter(jaar, 3)`. */
const PAASDATA: ReadonlyArray<[number, string]> = [
  [2024, "2024-03-31"],
  [2025, "2025-04-20"],
  [2026, "2026-04-05"],
  [2027, "2027-03-28"],
  [2028, "2028-04-16"],
  [2029, "2029-04-01"],
  [2030, "2030-04-21"],
  [2031, "2031-04-13"],
  [2032, "2032-03-28"],
  [2033, "2033-04-17"],
  [2034, "2034-04-09"],
  [2035, "2035-03-25"],
];

describe("de eerste paasdag", () => {
  it("komt over twaalf jaar overeen met dateutil", () => {
    for (const [jaar, verwacht] of PAASDATA) {
      expect(eerstePaasdag(jaar).toISOString().slice(0, 10)).toBe(verwacht);
    }
  });

  it("valt altijd op een zondag", () => {
    // Een onafhankelijke eigenschap: geen enkele paasdatum kan op een andere dag
    // vallen. Zou de formule een dag verschuiven, dan valt deze test om, ook al
    // zou de reeks hierboven ooit worden aangepast.
    for (let jaar = 2020; jaar <= 2060; jaar += 1) {
      expect(eerstePaasdag(jaar).getUTCDay()).toBe(0);
    }
  });

  it("valt altijd tussen 22 maart en 25 april", () => {
    // De grenzen van de gregoriaanse paasregel. Ze gelden voor elk jaar en zijn
    // dus een sterkere controle dan een reeks losse data.
    for (let jaar = 1900; jaar <= 2200; jaar += 1) {
      const d = eerstePaasdag(jaar);
      const maand = d.getUTCMonth() + 1;
      const dag = d.getUTCDate();
      const vroegGenoeg = maand === 3 ? dag >= 22 : true;
      const laatGenoeg = maand === 4 ? dag <= 25 : true;
      expect(maand === 3 || maand === 4).toBe(true);
      expect(vroegGenoeg && laatGenoeg).toBe(true);
    }
  });
});

describe("de feestdagen van een jaar", () => {
  it("geeft de tien wettelijke dagen, niet meer en niet minder", () => {
    // Tien dagen, vastgelegd in de wet van 4 januari 1974 en sinds 1947
    // onveranderd. Elf zou betekenen dat er een niet-wettelijke dag is
    // binnengeslopen; negen dat er een is weggevallen.
    for (let jaar = 2024; jaar <= 2035; jaar += 1) {
      expect(feestdagenVan(jaar)).toHaveLength(10);
    }
  });

  it("noemt de zeven vaste dagen op hun vaste datum", () => {
    const vast = feestdagenVan(2026).map((f) => f.datum);
    for (const datum of [
      "2026-01-01",
      "2026-05-01",
      "2026-07-21",
      "2026-08-15",
      "2026-11-01",
      "2026-11-11",
      "2026-12-25",
    ]) {
      expect(vast).toContain(datum);
    }
  });

  it("legt de drie beweeglijke dagen op de juiste afstand van Pasen", () => {
    // Paasmaandag is de dag na Pasen, Onze-Heer-Hemelvaart de negenendertigste
    // dag erna en pinkstermaandag de vijftigste. Die afstanden zijn kerkelijk
    // vastgelegd en veranderen niet.
    for (const [jaar, pasen] of PAASDATA) {
      const dagen = feestdagenVan(jaar).map((f) => f.datum);
      const pasenMs = Date.parse(`${pasen}T00:00:00Z`);
      const plus = (n: number) =>
        new Date(pasenMs + n * 86_400_000).toISOString().slice(0, 10);
      expect(dagen).toContain(plus(1));
      expect(dagen).toContain(plus(39));
      expect(dagen).toContain(plus(50));
    }
  });

  it("geeft elke dag een naam en levert geen dubbels", () => {
    const dagen = feestdagenVan(2027);
    for (const dag of dagen) {
      expect(dag.naam.length).toBeGreaterThan(2);
      expect(dag.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(new Set(dagen.map((d) => d.datum)).size).toBe(dagen.length);
  });

  it("geeft de dagen oplopend op datum", () => {
    const datums = feestdagenVan(2028).map((f) => f.datum);
    expect([...datums].sort()).toEqual(datums);
  });
});

describe("de verzameling feestdatums over meerdere jaren", () => {
  it("bevat tien dagen per jaar in het bereik", () => {
    const uit = feestdatumsTussenJaren(2026, 2028);
    expect(uit.size).toBe(30);
    expect(uit.has("2026-07-21")).toBe(true);
    expect(uit.has("2028-12-25")).toBe(true);
  });

  it("geeft één jaar wanneer begin en einde samenvallen", () => {
    expect(feestdatumsTussenJaren(2026, 2026).size).toBe(10);
  });

  it("geeft niets wanneer het einde voor het begin ligt", () => {
    // Geen stille lus over een omgekeerd bereik: liever leeg dan een verzameling
    // waarvan niemand kan navertellen hoe ze is opgebouwd.
    expect(feestdatumsTussenJaren(2028, 2026).size).toBe(0);
  });

  it("herkent een feestdag en verwerpt een gewone dag", () => {
    expect(isFeestdag("2026-05-01")).toBe(true);
    expect(isFeestdag("2026-05-02")).toBe(false);
  });
});

describe("de werkdagenteller met feestdagen erin", () => {
  it("telt 21 juli 2026 niet mee", () => {
    // 20 juli 2026 is een maandag, 21 juli een dinsdag en dus een feestdag, 22
    // juli een woensdag. Van maandag naar woensdag zijn twee werkdagen; met de
    // feestdag ertussenuit blijft er één over.
    expect(werkdagenTussen("2026-07-20", "2026-07-22")).toBe(1);
  });

  it("telt een gewone week nog steeds als vijf werkdagen", () => {
    // Maandag 1 juni 2026 tot maandag 8 juni 2026: vijf werkdagen, geen
    // feestdag ertussen. Dit is de controle dat de feestdagenmodule niets
    // wegneemt wat ze niet mag wegnemen.
    expect(werkdagenTussen("2026-06-01", "2026-06-08")).toBe(5);
  });

  it("telt een feestdag die op een zaterdag valt niet dubbel weg", () => {
    // 1 mei 2027 is een zaterdag. Die dag was al geen werkdag; de feestdag mag
    // er dus geen tweede keer af. Van vrijdag 30 april naar maandag 3 mei is
    // precies één werkdag.
    expect(werkdagenTussen("2027-04-30", "2027-05-03")).toBe(1);
  });

  it("houdt de teller op nul of hoger over een lange periode met feestdagen", () => {
    // Een heel jaar: 2026 telt 261 weekdagen. Van de tien feestdagen vallen er
    // enkele in het weekend; het aantal werkdagen ligt dus onder 261 maar zeker
    // boven 240. Deze test bewaakt de orde van grootte en niet een exact getal,
    // want dat exacte getal is precies wat de module hoort te berekenen.
    const uit = werkdagenTussen("2026-01-01", "2027-01-01");
    expect(uit).toBeLessThan(261);
    expect(uit).toBeGreaterThan(240);
  });
});
