// ---------------------------------------------------------------------------
// tests/publieke-taal.test.ts
//
// De publieke laag van Tapas CORE start in het Engels en kan met een knop naar
// het Nederlands. De inhoud staat daarom twee keer: de Nederlandse reeks in
// client/src/data/oplossingen.ts en de Engelse in client/src/publiek/inhoud-en.ts,
// met daarnaast twee tekstcatalogi met vaste nl/en-koppels. Als een van die
// twee reeksen uit elkaar loopt, valt een pagina in de andere taal stil of
// toont ze een half beeld. Deze toetsen leggen de pariteit vast.
//
// Wat deze toetsen bewijzen:
//
//   A. Engels is de standaardtaal en Nederlands is de tweede keuze.
//   B. Elke Engelse reeks heeft dezelfde lengte en dezelfde sleutels als de
//      Nederlandse, en de padden en sleutels zijn niet vertaald.
//   C. De tekstcatalogi dragen voor elk koppel zowel nl als en, beide gevuld.
//   D. De categorieclaim staat in de catalogus en in beide talen in het Engels.
//   E. De twee Engelse films staan als bestand in het platform en de
//      trajectpagina's kiezen ze per taal.
//   F. Geen van de bestanden van de taallaag bevat een em-dash of en-dash.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIEKE_TALEN,
  PUBLIEKE_TAALNAMEN,
  kies,
  publiekeTaal,
} from "../client/src/publiek/taal";
import {
  HOOFDNAVIGATIE,
  CLUSTERS,
  AANSLUITING_RECRUITMENT,
  BESLISMOMENTEN,
  OUTPUTSTAPEL,
  MARKERINGEN,
  HDD_STAPPEN,
  HDD_OUTPUTS,
  HDD_UITKOMST,
  LTE_STAPPEN,
  LTE_UITKOMST,
  RR_STAPPEN,
  RR_UITKOMST,
  DEMO_JOURNEYS,
  DEMO_CASES,
  LICENTIES,
  DEUREN,
} from "../client/src/data/oplossingen";
import {
  HOOFDNAVIGATIE_EN,
  CLUSTERS_EN,
  AANSLUITING_RECRUITMENT_EN,
  BESLISMOMENTEN_EN,
  OUTPUTSTAPEL_EN,
  MARKERINGEN_EN,
  HDD_STAPPEN_EN,
  HDD_OUTPUTS_EN,
  HDD_UITKOMST_EN,
  LTE_STAPPEN_EN,
  LTE_UITKOMST_EN,
  RR_STAPPEN_EN,
  RR_UITKOMST_EN,
  DEMO_JOURNEYS_EN,
  DEMO_CASES_EN,
  LICENTIES_EN,
  DEUREN_EN,
} from "../client/src/publiek/inhoud-en";
import { T, CATEGORIECLAIM, CATEGORIECLAIM_ZAKELIJK } from "../client/src/publiek/teksten-onthaal";
import { T as TP } from "../client/src/publiek/teksten-paginas";
import {
  clusters,
  hoofdnavigatie,
  beslismomenten,
  outputstapel,
  cluster,
} from "../client/src/publiek/inhoud";

function lees(pad: string): string {
  return readFileSync(resolve(__dirname, "..", pad), "utf8");
}

const bestandenTaallaag = [
  "client/src/publiek/taal.tsx",
  "client/src/publiek/inhoud.ts",
  "client/src/publiek/inhoud-en.ts",
  "client/src/publiek/teksten-onthaal.ts",
  "client/src/publiek/teksten-paginas.ts",
];

describe("A. Engels is de standaardtaal", () => {
  it("de reeks talen begint met Engels", () => {
    expect(PUBLIEKE_TALEN).toEqual(["en", "nl"]);
  });

  it("de store valt terug op Engels zonder bewaarde keuze", () => {
    // Zonder bewaarde keuze en zonder taal in de adresbalk staat de store op
    // Engels. De browsertaal beslist hier bewust niet mee.
    expect(publiekeTaal()).toBe("en");
    const bron = lees("client/src/publiek/taal.tsx");
    expect(bron).not.toContain("navigator.language");
  });

  it("beide talen hebben een leesbare naam voor de knop", () => {
    for (const t of PUBLIEKE_TALEN) {
      expect(PUBLIEKE_TAALNAMEN[t].length).toBeGreaterThan(1);
    }
  });

  it("de keuze wordt bewaard, zodat een terugkeer in de gekozen taal opent", () => {
    const bron = lees("client/src/publiek/taal.tsx");
    expect(bron).toContain("tapas.publiek.taal");
    expect(bron).toContain("localStorage");
  });

  it("kies geeft de reeks van de gevraagde taal terug", () => {
    const paar = { en: "one", nl: "een" };
    expect(kies(paar, "en")).toBe("one");
    expect(kies(paar, "nl")).toBe("een");
  });

  it("de getters volgen de taal", () => {
    expect(clusters("nl")).toBe(CLUSTERS);
    expect(clusters("en")).toBe(CLUSTERS_EN);
    expect(hoofdnavigatie("en")).toBe(HOOFDNAVIGATIE_EN);
    expect(beslismomenten("en")).toBe(BESLISMOMENTEN_EN);
    expect(outputstapel("en")).toBe(OUTPUTSTAPEL_EN);
    expect(cluster("hdd", "en")?.sleutel).toBe("hdd");
  });
});

describe("B. Elke Engelse reeks loopt gelijk met de Nederlandse", () => {
  const paren: Array<[string, unknown[], unknown[]]> = [
    ["hoofdnavigatie", HOOFDNAVIGATIE, HOOFDNAVIGATIE_EN],
    ["clusters", CLUSTERS, CLUSTERS_EN],
    ["beslismomenten", BESLISMOMENTEN, BESLISMOMENTEN_EN],
    ["outputstapel", OUTPUTSTAPEL, OUTPUTSTAPEL_EN],
    ["markeringen", MARKERINGEN, MARKERINGEN_EN],
    ["hdd-stappen", HDD_STAPPEN, HDD_STAPPEN_EN],
    ["hdd-outputs", HDD_OUTPUTS, HDD_OUTPUTS_EN],
    ["hdd-uitkomst", HDD_UITKOMST, HDD_UITKOMST_EN],
    ["lte-stappen", LTE_STAPPEN, LTE_STAPPEN_EN],
    ["lte-uitkomst", LTE_UITKOMST, LTE_UITKOMST_EN],
    ["rr-stappen", RR_STAPPEN, RR_STAPPEN_EN],
    ["rr-uitkomst", RR_UITKOMST, RR_UITKOMST_EN],
    ["demo-journeys", DEMO_JOURNEYS, DEMO_JOURNEYS_EN],
    ["demo-cases", DEMO_CASES, DEMO_CASES_EN],
    ["licenties", LICENTIES, LICENTIES_EN],
    ["deuren", DEUREN, DEUREN_EN],
  ];

  for (const [naam, nl, en] of paren) {
    it(`${naam} heeft in beide talen even veel elementen`, () => {
      expect(en).toHaveLength(nl.length);
    });
  }

  it("de clusters dragen in beide talen dezelfde sleutels en padden", () => {
    expect(CLUSTERS_EN.map((c) => c.sleutel)).toEqual(CLUSTERS.map((c) => c.sleutel));
    expect(CLUSTERS_EN.map((c) => c.pad)).toEqual(CLUSTERS.map((c) => c.pad));
    // De wedge is een structuurkeuze en niet een tekst, dus die staat gelijk.
    expect(CLUSTERS_EN.map((c) => c.wedge)).toEqual(CLUSTERS.map((c) => c.wedge));
  });

  it("de beslismomenten dragen in beide talen dezelfde sleutels en padden", () => {
    expect(BESLISMOMENTEN_EN.map((b) => b.sleutel)).toEqual(BESLISMOMENTEN.map((b) => b.sleutel));
    expect(BESLISMOMENTEN_EN.map((b) => b.pad)).toEqual(BESLISMOMENTEN.map((b) => b.pad));
  });

  it("de navigatie wijst in beide talen naar dezelfde padden", () => {
    expect(HOOFDNAVIGATIE_EN.map((n) => n.pad)).toEqual(HOOFDNAVIGATIE.map((n) => n.pad));
  });

  it("de brugregels dragen in beide talen dezelfde drie sleutels", () => {
    expect(Object.keys(AANSLUITING_RECRUITMENT_EN).sort()).toEqual(
      Object.keys(AANSLUITING_RECRUITMENT).sort(),
    );
  });

  it("geen Engelse tekst is per ongeluk Nederlands gebleven op de kernvelden", () => {
    for (const c of CLUSTERS_EN) {
      const nl = CLUSTERS.find((x) => x.sleutel === c.sleutel)!;
      // De publieke journeynamen zijn in beide talen Engels; de beslissing en
      // de doelgroep zijn wel vertaald en mogen dus niet identiek zijn.
      expect(c.beslissing).not.toBe(nl.beslissing);
      expect(c.doelgroep).not.toBe(nl.doelgroep);
    }
  });
});

describe("C. De tekstcatalogi zijn volledig tweetalig", () => {
  function loopKoppels(
    knoop: unknown,
    pad: string,
    raak: (pad: string, paar: Record<string, unknown>) => void,
  ): void {
    if (knoop === null || typeof knoop !== "object") return;
    const o = knoop as Record<string, unknown>;
    if (typeof o.nl === "string" || typeof o.en === "string") {
      raak(pad, o);
      return;
    }
    for (const [k, v] of Object.entries(o)) loopKoppels(v, pad ? `${pad}.${k}` : k, raak);
  }

  for (const [naam, catalogus] of [
    ["teksten-onthaal", T],
    ["teksten-paginas", TP],
  ] as Array<[string, unknown]>) {
    it(`${naam}: elk koppel draagt zowel nl als en, beide gevuld`, () => {
      const stuk: string[] = [];
      let aantal = 0;
      loopKoppels(catalogus, "", (pad, paar) => {
        aantal += 1;
        if (typeof paar.nl !== "string" || (paar.nl as string).trim() === "") stuk.push(`${pad}.nl`);
        if (typeof paar.en !== "string" || (paar.en as string).trim() === "") stuk.push(`${pad}.en`);
      });
      expect(stuk).toEqual([]);
      expect(aantal).toBeGreaterThan(100);
    });
  }
});

describe("D. De categorieclaim staat bovenaan de onthaalpagina", () => {
  it("de claim staat woordelijk in de catalogus", () => {
    expect(CATEGORIECLAIM).toBe(
      "Tapas CORE is the talent operating system for passion-driven performance.",
    );
  });

  it("de claim is één vaste tekst, want de categorienaam blijft Engels", () => {
    // Geen nl/en-koppel: de claim staat ook op de Nederlandse pagina in het
    // Engels, omdat het de naam van de categorie zelf is.
    expect(typeof CATEGORIECLAIM).toBe("string");
    expect(typeof CATEGORIECLAIM_ZAKELIJK).toBe("string");
  });

  it("de zakelijke variant benoemt potentieel, motivatie en teamenergie", () => {
    const t = CATEGORIECLAIM_ZAKELIJK;
    expect(t).toContain("human potential");
    expect(t).toContain("motivation");
    expect(t).toContain("team energy");
    expect(t).toContain("measurable talent decisions");
    // Britse spelling, zoals de rest van de Engelse laag.
    expect(t).toContain("organisations");
    expect(t).not.toContain("organizations");
  });

  it("de claim staat als eerste blok in de kop van de onthaalpagina", () => {
    const onthaal = lees("client/src/pages/onthaal.tsx");
    expect(onthaal).toContain('data-testid="categorieclaim"');
    expect(onthaal).toContain('data-testid="categorieclaim-zakelijk"');
    expect(onthaal).toContain("CATEGORIECLAIM");
  });
});

describe("E. De films staan er in beide talen", () => {
  const films = [
    "hdd-nl",
    "hdd-en",
    "lte-nl",
    "lte-en",
    "rrf-nl",
    "rrf-en",
  ];

  for (const naam of films) {
    it(`${naam} staat er met film, beeld en ondertitels`, () => {
      for (const bestand of [`${naam}.mp4`, `${naam}-beeld.jpg`, `${naam}.vtt`]) {
        expect(existsSync(resolve(__dirname, "..", "client/public/film", bestand))).toBe(true);
      }
    });
  }

  it("de trajectpagina's kiezen de film per taal", () => {
    const lte = lees("client/src/pages/journey-leiderschap.tsx");
    const rrf = lees("client/src/pages/journey-recruitment.tsx");
    const hdd = lees("client/src/pages/journey-hdd.tsx");
    expect(lte).toContain("lte-en");
    expect(lte).toContain("lte-nl");
    expect(rrf).toContain("rrf-en");
    expect(rrf).toContain("rrf-nl");
    expect(hdd).toContain("hdd-en");
    expect(hdd).toContain("hdd-nl");
  });
});

describe("F. Geen lang liggend streepje in de taallaag", () => {
  for (const pad of bestandenTaallaag) {
    it(`${pad} bevat geen em-dash of en-dash`, () => {
      const inhoud = lees(pad);
      expect(inhoud).not.toContain("\u2014");
      expect(inhoud).not.toContain("\u2013");
      expect(inhoud).not.toContain("\u2011");
    });
  }
});
