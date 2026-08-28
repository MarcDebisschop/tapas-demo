// ---------------------------------------------------------------------------
// tests/recruitment-vindbaar.test.ts
//
// Recruitment & Role Fit was gebouwd en uitgerold, maar stond op de
// oplossingenpagina tussen de clusters zonder eigen pagina en kwam op de
// onthaalpagina niet voor. Wie de journey niet kende, vond ze niet. Deze
// toetsen leggen de vindbaarheid vast, zodat ze niet stil terugvalt.
//
// Wat deze toetsen bewijzen:
//
//   A. De vierde journey heeft een eigen band op de oplossingenpagina en staat
//      niet meer in de rij van de clusters zonder trajectpagina.
//   B. De vier journeys staan er als beslismomenten op een motor, met per
//      journey de verhouding tot de instroombeslissing.
//   C. De onthaalpagina draagt vier ingangen, met Recruitment erbij, en de
//      opmaak vangt vier kaarten op elk schermformaat op.
//   D. De brugregel uit het integratiedossier staat woordelijk bij Human Due
//      Diligence, bij Leadership & Team Energy en bij Development & Mobility.
//   E. De brugregel is een optioneel veld: een traject zonder brug blijft
//      werken en toont geen leeg blok.
//   F. Geen van de geraakte bestanden bevat een lang liggend streepje.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AANSLUITING_RECRUITMENT,
  BESLISMOMENTEN,
  CLUSTERS,
} from "../client/src/data/oplossingen";

function lees(pad: string): string {
  return readFileSync(resolve(__dirname, "..", pad), "utf8");
}

const geraakt = [
  "client/src/data/oplossingen.ts",
  "client/src/pages/oplossingen.tsx",
  "client/src/pages/onthaal.tsx",
  "client/src/pages/onthaal.css",
  "client/src/pages/publiek.css",
  "client/src/components/TrajectPagina.tsx",
  "client/src/pages/journey-hdd.tsx",
  "client/src/pages/journey-leiderschap.tsx",
];

const oplossingen = lees("client/src/pages/oplossingen.tsx");
const onthaal = lees("client/src/pages/onthaal.tsx");
const onthaalCss = lees("client/src/pages/onthaal.css");
const publiekCss = lees("client/src/pages/publiek.css");
const frame = lees("client/src/components/TrajectPagina.tsx");
const hdd = lees("client/src/pages/journey-hdd.tsx");
const lte = lees("client/src/pages/journey-leiderschap.tsx");

describe("A. De vierde journey heeft een eigen band", () => {
  it("Recruitment staat niet meer in de rij van de clusters zonder pagina", () => {
    // De rij eronder is uitdrukkelijk gefilterd op alles behalve recruitment.
    expect(oplossingen).toContain('c.sleutel !== "recruitment"');
    expect(oplossingen).toContain('CLUSTERS.find((c) => c.sleutel === "recruitment")');
  });

  it("de band draagt een aanklikbare kaart naar de trajectpagina", () => {
    expect(oplossingen).toContain('data-testid="kaart-vierde-journey"');
    const iKaart = oplossingen.indexOf('data-testid="kaart-vierde-journey"');
    const iRest = oplossingen.indexOf("Verdere clusters");
    // De band staat boven de verdere clusters, niet eronder.
    expect(iKaart).toBeGreaterThan(0);
    expect(iKaart).toBeLessThan(iRest);
  });

  it("de kaart wijst naar het pad dat het cluster zelf draagt", () => {
    const c = CLUSTERS.find((x) => x.sleutel === "recruitment")!;
    expect(c.pad).toBe("/oplossingen/recruitment-role-fit");
    expect(oplossingen).toContain("href={vierde.pad as string}");
  });

  it("de instrumentnaam T4Recruitment blijft onder de journey staan", () => {
    expect(oplossingen).toContain("T4Recruitment");
    const c = CLUSTERS.find((x) => x.sleutel === "recruitment")!;
    expect(c.instrumenten).toContain("T4Recruitment");
    // De journeynaam is de publieke naam, niet de instrumentnaam.
    expect(c.naam).toBe("Recruitment & Role Fit");
  });

  it("de twee resterende clusters staan in een rij van twee", () => {
    const zonderPagina = CLUSTERS.filter((c) => !c.wedge && c.sleutel !== "recruitment");
    expect(zonderPagina).toHaveLength(2);
    expect(zonderPagina.every((c) => c.pad === null)).toBe(true);
    expect(oplossingen).not.toContain('className="rooster-3"');
  });
});

describe("B. Vier beslismomenten op een motor", () => {
  it("er zijn precies vier beslismomenten, met Recruitment erbij", () => {
    expect(BESLISMOMENTEN).toHaveLength(4);
    expect(BESLISMOMENTEN.map((b) => b.sleutel)).toEqual([
      "hdd",
      "leiderschap",
      "ontwikkeling",
      "recruitment",
    ]);
  });

  it("de vraag van elk beslismoment komt woordelijk uit het cluster zelf", () => {
    for (const b of BESLISMOMENTEN) {
      const c = CLUSTERS.find((x) => x.sleutel === b.sleutel)!;
      expect(b.naam).toBe(c.naam);
      expect(b.vraag).toBe(c.beslissing);
      expect(b.pad).toBe(c.pad);
    }
  });

  it("elk beslismoment benoemt zijn verhouding tot instroom", () => {
    for (const b of BESLISMOMENTEN) {
      expect(b.relatie.length).toBeGreaterThan(40);
      expect(b.relatie.toLowerCase()).toMatch(/instroom|journey/);
    }
  });

  it("het blok staat op de pagina", () => {
    expect(oplossingen).toContain('data-testid="beslismomenten"');
    expect(oplossingen).toContain("BESLISMOMENTEN.map");
  });
});

describe("C. Vier ingangen op de onthaalpagina", () => {
  it("de rij ingangen bevat Recruitment", () => {
    expect(onthaal).toContain('["hdd", "leiderschap", "recruitment", "ontwikkeling"]');
    expect(onthaal).toContain("Vier ingangen");
    expect(onthaal).not.toContain("Drie ingangen");
  });

  it("de rij draagt de opmaak voor vier kaarten", () => {
    expect(onthaal).toContain('className="ingangen vier"');
    expect(onthaalCss).toContain(".onthaal .ingangen.vier{grid-template-columns:repeat(4,minmax(0,1fr))");
  });

  it("vier kaarten vallen terug op twee en daarna op een kolom", () => {
    expect(onthaalCss).toContain(
      ".onthaal .ingangen.vier{grid-template-columns:repeat(2,minmax(0,1fr))}",
    );
    expect(onthaalCss).toContain(".onthaal .ingangen,.onthaal .ingangen.vier{grid-template-columns:1fr}");
  });

  it("de wedge in de kop blijft de twee trajecten van de eerste lijn", () => {
    // Vier ingangen mogen de internationale eerste lijn niet verwateren.
    expect(onthaal).toContain("CLUSTERS.filter((c) => c.wedge)");
    expect(CLUSTERS.filter((c) => c.wedge).map((c) => c.sleutel)).toEqual(["hdd", "leiderschap"]);
  });
});

describe("D. De brugregels uit het dossier staan er woordelijk", () => {
  const verwacht: Array<[string, string]> = [
    [
      "hdd",
      "Als het huidige team onvoldoende draagkracht of complementariteit toont, ondersteunt Tapas CORE ook de gerichte zoektocht naar externe versterking vanuit hetzelfde mensbeeld.",
    ],
    [
      "leiderschap",
      "Wanneer een ploeg versterking vraagt, maakt Tapas CORE niet alleen zichtbaar waar leiderschapsaandacht nodig is, maar ook welk type instroom het team waarschijnlijk sterker maakt.",
    ],
    [
      "ontwikkeling",
      "Tapas CORE ondersteunt niet alleen de keuze voor interne ontwikkeling of mobiliteit, maar scherpt ook het onderscheid aan tussen wat best intern groeit en wat best extern wordt aangetrokken.",
    ],
  ];

  for (const [sleutel, tekst] of verwacht) {
    it(`de formule voor ${sleutel} staat woordelijk in de bron`, () => {
      expect(AANSLUITING_RECRUITMENT[sleutel]).toBe(tekst);
    });
  }

  it("er zijn precies drie formules, en niet een voor Recruitment zelf", () => {
    expect(Object.keys(AANSLUITING_RECRUITMENT).sort()).toEqual([
      "hdd",
      "leiderschap",
      "ontwikkeling",
    ]);
  });

  it("Human Due Diligence draagt de brug naar de trajectpagina", () => {
    expect(hdd).toContain("AANSLUITING_RECRUITMENT.hdd");
    expect(hdd).toContain('pad: "/oplossingen/recruitment-role-fit"');
  });

  it("Leadership & Team Energy draagt de brug naar de trajectpagina", () => {
    expect(lte).toContain("AANSLUITING_RECRUITMENT.leiderschap");
    expect(lte).toContain('pad: "/oplossingen/recruitment-role-fit"');
  });

  it("Development & Mobility draagt de brug op zijn clusterkaart", () => {
    // Dit cluster heeft geen eigen trajectpagina, dus de begeleidende tekst
    // staat op de kaart zelf.
    expect(CLUSTERS.find((c) => c.sleutel === "ontwikkeling")!.pad).toBeNull();
    expect(oplossingen).toContain("AANSLUITING_RECRUITMENT[c.sleutel]");
    expect(oplossingen).toContain("data-testid={`aansluiting-${c.sleutel}`}");
  });

  it("de brug bevat geen absolute claim over de juiste kandidaat", () => {
    const alles = Object.values(AANSLUITING_RECRUITMENT).join(" ").toLowerCase();
    expect(alles).not.toContain("de juiste persoon");
    expect(alles).not.toContain("gegarandeerd");
    expect(alles).not.toMatch(/\b(test|vragenlijst|rapporttool)\b/);
  });
});

describe("E. De brug is een optioneel veld", () => {
  it("het veld staat als optioneel in het geraamte", () => {
    expect(frame).toMatch(/aansluiting\?:\s*\{ tekst: string; pad: string; linktekst: string \}/);
  });

  it("het blok staat achter een voorwaarde, dus een traject zonder brug blijft leeg", () => {
    expect(frame).toContain("{inhoud.aansluiting && (");
    expect(frame).toContain('data-testid="aansluiting"');
  });

  it("de opmaak van de brug blijft binnen de publieke laag", () => {
    expect(publiekCss).toContain(".publiek .aansluiting{");
    expect(publiekCss).toContain(".publiek .kaart .aansluiting{");
  });

  it("Recruitment & Role Fit draagt zelf geen brug naar zichzelf", () => {
    const rrf = lees("client/src/pages/journey-recruitment.tsx");
    expect(rrf).not.toContain("aansluiting:");
  });
});

describe("F. Geen lang liggend streepje", () => {
  for (const pad of geraakt) {
    it(`${pad} bevat geen em-dash of en-dash`, () => {
      const inhoud = lees(pad);
      expect(inhoud).not.toContain("\u2014");
      expect(inhoud).not.toContain("\u2013");
    });
  }
});
