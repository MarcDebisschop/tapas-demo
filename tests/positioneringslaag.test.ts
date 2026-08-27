// ---------------------------------------------------------------------------
// tests/positioneringslaag.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. Er is één bron van waarheid voor de journeys, de outputstapel en de
//      markeringen, en die bron dekt de vijf clusters uit de opdracht.
//   B. De routes van de nieuwe publieke laag staan in de app, en elke pagina
//      bestaat met haar eigen kenmerk.
//   C. De hoofdnavigatie draagt de vijf labels uit de opdracht, en de
//      onthaalpagina gebruikt die navigatie in plaats van een eigen lijst.
//   D. De onthaalpagina is beslisgericht: de belofte staat vooraan, de wedge
//      staat boven de breedte, en de breedte staat er als bewijs.
//   E. De prijssignalen blijven trajectsignalen. Nergens staat een prijs per
//      deelnemer bij Human Due Diligence.
//   F. Geen enkel bestand van deze laag bevat een lang liggend streepje.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CLUSTERS,
  DEMO_CASES,
  DEMO_JOURNEYS,
  DEUREN,
  HDD_STAPPEN,
  HOOFDNAVIGATIE,
  LTE_STAPPEN,
  MARKERINGEN,
  OUTPUTSTAPEL,
  WEDGE_CLUSTERS,
} from "../client/src/data/oplossingen";

function lees(pad: string): string {
  return readFileSync(resolve(__dirname, "..", pad), "utf8");
}

const app = lees("client/src/App.tsx");
const onthaal = lees("client/src/pages/onthaal.tsx");
const onthaalCss = lees("client/src/pages/onthaal.css");
const data = lees("client/src/data/oplossingen.ts");

const nieuweBestanden = [
  "client/src/data/oplossingen.ts",
  "client/src/lib/naar-blok.ts",
  "client/src/pages/publiek.css",
  "client/src/components/PubliekeKop.tsx",
  "client/src/components/PubliekeVoet.tsx",
  "client/src/components/TrajectPagina.tsx",
  "client/src/pages/oplossingen.tsx",
  "client/src/pages/journey-hdd.tsx",
  "client/src/pages/journey-leiderschap.tsx",
  "client/src/pages/outputs.tsx",
  "client/src/pages/partners.tsx",
  "client/src/pages/partners.tsx",
  "client/src/pages/aanmelden.tsx",
  "client/src/pages/demo.tsx",
];

describe("A. Eén bron van waarheid", () => {
  it("de vijf clusters staan er, elk met een beslissing en een doelgroep", () => {
    expect(CLUSTERS).toHaveLength(5);
    const namen = CLUSTERS.map((c) => c.naam);
    expect(namen).toContain("Human Due Diligence");
    expect(namen).toContain("Leadership & Team Energy");
    expect(namen).toContain("Development & Mobility");
    expect(namen).toContain("Recruitment");
    expect(namen).toContain("Education & Youth");
    for (const c of CLUSTERS) {
      expect(c.beslissing.length).toBeGreaterThan(20);
      expect(c.doelgroep.length).toBeGreaterThan(10);
      expect(c.instrumenten.length).toBeGreaterThan(0);
      expect(c.moment.length).toBeGreaterThan(20);
      expect(c.prijssignaal.length).toBeGreaterThan(10);
    }
  });

  it("de wedge bestaat uit precies twee clusters met een eigen pagina", () => {
    expect(WEDGE_CLUSTERS).toHaveLength(2);
    expect(WEDGE_CLUSTERS.map((c) => c.pad)).toEqual([
      "/oplossingen/human-due-diligence",
      "/oplossingen/leadership-team-energy",
    ]);
  });

  it("de outputstapel heeft vier lagen, elk met één lezer", () => {
    expect(OUTPUTSTAPEL).toHaveLength(4);
    expect(OUTPUTSTAPEL.map((o) => o.naam)).toEqual([
      "Individueel inzicht",
      "Begeleidersrapport",
      "Managementsamenvatting",
      "Bestuursrapport",
    ]);
    for (const o of OUTPUTSTAPEL) {
      expect(o.lezer.length).toBeGreaterThan(3);
      expect(o.inhoud.length).toBeGreaterThan(20);
    }
  });

  it("de markeringen dekken versie, taal, datum en vertrouwelijkheid", () => {
    const labels = MARKERINGEN.map((m) => m.label.toLowerCase()).join(" ");
    for (const woord of ["versie", "taal", "datum", "vertrouwelijkheid"]) {
      expect(labels).toContain(woord);
    }
  });

  it("de twee trajecten hebben elk vijf stappen, van intake tot bestuursklare oplevering", () => {
    expect(HDD_STAPPEN).toHaveLength(5);
    expect(LTE_STAPPEN).toHaveLength(5);
    const hdd = HDD_STAPPEN.map((s) => `${s.naam} ${s.inhoud}`.toLowerCase()).join(" ");
    for (const woord of ["intake", "teamscan", "energiescan", "synthese", "bestuur"]) {
      expect(hdd).toContain(woord);
    }
    const lte = LTE_STAPPEN.map((s) => `${s.naam} ${s.inhoud}`.toLowerCase()).join(" ");
    for (const woord of ["vraagstelling", "energiescan", "kompas", "ploeg", "opvolging"]) {
      expect(lte).toContain(woord);
    }
    for (const s of [...HDD_STAPPEN, ...LTE_STAPPEN]) {
      expect(s.inhoud.length).toBeGreaterThan(30);
      expect(s.duur.length).toBeGreaterThan(2);
    }
  });

  it("de demo-omgeving draagt drie journeys en drie casecontexten", () => {
    expect(DEMO_JOURNEYS).toHaveLength(3);
    expect(DEMO_CASES).toHaveLength(3);
    for (const j of DEMO_JOURNEYS) {
      expect(j.probleem.length).toBeGreaterThan(20);
      expect(j.deelnemers.length).toBeGreaterThan(10);
      expect(j.flow.length).toBeGreaterThan(2);
      expect(j.outputs.length).toBeGreaterThan(1);
      expect(j.vervolgactie.length).toBeGreaterThan(20);
    }
    const caseNamen = DEMO_CASES.map((c) => `${c.naam} ${c.context}`.toLowerCase()).join(" ");
    expect(caseNamen).toMatch(/scale-?up/);
    expect(caseNamen).toContain("consultancy");
    expect(caseNamen).toContain("investering");
  });

  it("de bestaande deuren blijven bestaan", () => {
    expect(DEUREN.length).toBeGreaterThanOrEqual(4);
    const paden = DEUREN.map((d) => d.pad);
    expect(paden).toContain("/mijn");
    expect(paden).toContain("/coach");
    expect(paden).toContain("/organisatie");
  });
});

describe("B. De routes en de pagina's", () => {
  const routes = [
    "/oplossingen/human-due-diligence",
    "/oplossingen/leadership-team-energy",
    "/oplossingen",
    "/outputs",
    "/partners",
    "/demo",
    "/aanmelden",
  ];

  for (const route of routes) {
    it(`de route ${route} staat in de app`, () => {
      expect(app).toContain(`<Route path="${route}"`);
    });
  }

  it("de bestaande wortelroute blijft ongemoeid", () => {
    expect(app).toMatch(/<Route path="\/" component=\{CORE_MODE \? Onthaal : Home\} \/>/);
    expect((app.match(/<Route path="\/" /g) ?? []).length).toBe(1);
  });

  it("de diepe oplossingroutes staan vóór de korte, anders vangt de korte alles", () => {
    expect(app.indexOf('path="/oplossingen/human-due-diligence"')).toBeLessThan(
      app.indexOf('path="/oplossingen"'),
    );
  });

  const kenmerken: Array<[string, string]> = [
    ["client/src/pages/oplossingen.tsx", "oplossingenpagina"],
    ["client/src/pages/journey-hdd.tsx", "journey-hdd"],
    ["client/src/pages/journey-leiderschap.tsx", "journey-leiderschap"],
    ["client/src/pages/outputs.tsx", "outputspagina"],
    ["client/src/pages/partners.tsx", "partnerspagina"],
    ["client/src/pages/aanmelden.tsx", "aanmeldenpagina"],
    ["client/src/pages/demo.tsx", "demopagina"],
  ];

  for (const [pad, kenmerk] of kenmerken) {
    it(`${pad} bestaat en draagt het kenmerk ${kenmerk}`, () => {
      const bron = lees(pad);
      const eigen = bron.includes(`data-testid="${kenmerk}"`);
      const viaFrame = bron.includes(`testid: "${kenmerk}"`);
      expect(eigen || viaFrame).toBe(true);
    });
  }

  it("de publieke opmaak lekt niet buiten de publieke laag", () => {
    const opmaak = lees("client/src/pages/publiek.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors: string[] = [];
    let i = 0;
    while (i < opmaak.length) {
      const open = opmaak.indexOf("{", i);
      if (open === -1) break;
      const sel = opmaak.slice(i, open).trim();
      let diepte = 1;
      let j = open + 1;
      while (j < opmaak.length && diepte > 0) {
        if (opmaak[j] === "{") diepte += 1;
        if (opmaak[j] === "}") diepte -= 1;
        j += 1;
      }
      if (sel && !sel.startsWith("@")) selectors.push(sel);
      if (sel.startsWith("@media")) {
        // De regels binnen een mediablok worden apart nagekeken.
        const binnen = opmaak.slice(open + 1, j - 1);
        for (const deel of binnen.split("}")) {
          const s = deel.split("{")[0].trim();
          if (s) selectors.push(s);
        }
      }
      i = j;
    }
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) {
      expect(sel).toContain(".publiek");
    }
  });
});

describe("C. De navigatie komt uit de journeys", () => {
  it("de vijf labels uit de opdracht staan in de navigatie", () => {
    expect(HOOFDNAVIGATIE.map((n) => n.label)).toEqual([
      "Platform",
      "Oplossingen",
      "Outputs",
      "Voor partners",
      "Aanmelden",
    ]);
  });

  it("de onthaalpagina gebruikt die ene navigatie", () => {
    expect(onthaal).toContain("HOOFDNAVIGATIE.map");
    expect(onthaal).toContain('aria-label="Hoofdnavigatie"');
    expect(onthaalCss).toContain(".onthaal nav.hoofdnav{");
  });

  it("een verwijzing naar een blok op de onthaalpagina overleeft de paginawissel", () => {
    const hulp = lees("client/src/lib/naar-blok.ts");
    expect(hulp).toContain("export function onthoudBlok");
    expect(hulp).toContain("export function neemBlokOp");
    expect(onthaal).toContain("neemBlokOp()");
  });
});

describe("D. De onthaalpagina is beslisgericht", () => {
  it("de belofte staat in de kop", () => {
    expect(onthaal).toContain("Tapas CORE helpt organisaties");
    expect(onthaal).toContain("betere talentbeslissingen");
  });

  it("de wedge staat in de kop, boven alle breedte", () => {
    const iWedge = onthaal.indexOf('className="wedge"');
    const iBreedte = onthaal.indexOf("BREEDTE ALS BEWIJS");
    const iNamen = onthaal.indexOf("Drie namen");
    expect(iWedge).toBeGreaterThan(0);
    expect(iWedge).toBeLessThan(iBreedte);
    expect(iBreedte).toBeLessThan(iNamen);
  });

  it("de drie zakelijke ingangen staan boven de breedte", () => {
    for (const sleutel of ["hdd", "leiderschap", "ontwikkeling"]) {
      expect(onthaal).toContain(sleutel);
    }
    expect(onthaal).toContain("Welke beslissing ligt bij u op tafel?");
    expect(onthaal.indexOf('id="ingangen"')).toBeLessThan(onthaal.indexOf("BREEDTE ALS BEWIJS"));
  });

  it("de outputstapel staat op de onthaalpagina met een verwijzing naar de volle opbouw", () => {
    expect(onthaal).toContain("OUTPUTSTAPEL.map");
    expect(onthaal).toContain('href="/outputs"');
  });

  it("de breedte staat er als bewijs, niet als catalogus", () => {
    expect(onthaal).toContain("Breedte als bewijs");
    expect(onthaal).toContain("bewijs dat de motor het aankan");
  });

  it("de bestaande bouwstenen blijven staan", () => {
    expect(onthaal).toContain('data-testid="onthaal-film"');
    expect(onthaal).toContain('data-testid="onthaal-formulier"');
    expect(onthaal).toContain('id="werking"');
    expect(onthaal).toContain('id="aanmelden"');
    expect(onthaal).toContain('id="contact"');
    expect(onthaal).toContain("Geen diagnose");
  });
});

describe("E. De prijssignalen blijven trajectsignalen", () => {
  const hdd = lees("client/src/pages/journey-hdd.tsx");

  it("Human Due Diligence draagt een trajectprijs, niet een prijs per deelnemer", () => {
    const cluster = CLUSTERS.find((c) => c.sleutel === "hdd");
    expect(cluster?.prijssignaal).toContain("7.500");
    expect(cluster?.prijssignaal).toContain("op trajectniveau");
    // Een bedrag met "per deelnemer" erachter mag hier niet staan. De
    // uitdrukkelijke ontkenning "niet per deelnemer" mag wel.
    expect(cluster?.prijssignaal).not.toMatch(/euro per (deelnemer|respondent|kandidaat)/i);
    expect(hdd).not.toMatch(/euro per (deelnemer|respondent|kandidaat)/i);
  });

  it("het standaardtraject staat er als vanaf-signaal", () => {
    expect(data).toContain("12.500");
    expect(data).toMatch(/vanaf 7\.500 euro/);
  });

  it("nergens staat een streepje als bereikteken tussen twee bedragen", () => {
    for (const pad of nieuweBestanden) {
      expect(lees(pad)).not.toMatch(/\d\.\d{3}\s*-\s*\d\.\d{3}/);
    }
  });
});

describe("F. Geen lang liggend streepje", () => {
  for (const pad of [...new Set([...nieuweBestanden, "client/src/pages/onthaal.tsx", "client/src/pages/onthaal.css"])]) {
    it(`${pad} bevat geen em-dash of en-dash`, () => {
      const inhoud = lees(pad);
      expect(inhoud).not.toContain("\u2014");
      expect(inhoud).not.toContain("\u2013");
    });
  }
});
