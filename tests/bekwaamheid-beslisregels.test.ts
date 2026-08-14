// =============================================================================
// tests/bekwaamheid-beslisregels.test.ts
//
// De poort van blok 3 vraagt een tabelgestuurde test met minstens twintig
// gevallen, inclusief de gemene. De gemene gevallen staan onderaan de tabel en
// zijn met naam aangeduid: het zijn de gevallen waarin twee regels tegelijk van
// toepassing zijn en de volgorde dus alles bepaalt.
// =============================================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AANDACHTSZONE_BOVENGRENS,
  beoordeel,
  type BeslisInvoer,
  type BindendeRegel,
  type Voorstel,
} from "../server/bekwaamheid/beslisregels";
import { ASSEN, BESLISUITKOMSTEN, VOORSTELBARE_UITKOMSTEN } from "../server/bekwaamheid/schema";
import type { AsscoreUitkomst, Normprofiel } from "../server/bekwaamheid/normprofiel";
import type { ActiviteitUitkomst } from "../server/bekwaamheid/activiteit";

// --- gereedschap -----------------------------------------------------------

/** Het normprofiel uit het bouwplan: weging 20/30/30/20, drempels 0,70 en 0,60. */
const PROFIEL: Normprofiel = {
  weging: { weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.2 },
  drempelTotaal: 0.7,
  drempelPerAs: { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 },
  activiteitsdrempel: 6,
  activiteitsvensterMaanden: 24,
};

/**
 * Bouwt een asscore-uitkomst uit vier scores.
 *
 * Het totaal wordt hier met de hand gewogen en niet via `berekenAsscores`
 * genomen. Dat is opzet: zou deze test de rekenkern gebruiken om haar eigen
 * verwachting te maken, dan bewees ze alleen dat de kern met zichzelf overeenkomt.
 */
function scores(weten: number, zien: number, zeggen: number, zorgen: number): AsscoreUitkomst {
  const ruw = { weten, zien, zeggen, zorgen };
  const totaal =
    weten * PROFIEL.weging.weten +
    zien * PROFIEL.weging.zien +
    zeggen * PROFIEL.weging.zeggen +
    zorgen * PROFIEL.weging.zorgen;
  return {
    perAs: Object.fromEntries(
      ASSEN.map((as) => [as, { as, score: ruw[as], meegerekend: 1, openstaand: 0 }]),
    ) as AsscoreUitkomst["perAs"],
    totaal,
    volledig: true,
    onbeoordeeld: [],
  };
}

function activiteit(aantal: number, drempel = 6): ActiviteitUitkomst {
  return {
    instrumentId: "t4p-business",
    vensterVan: "2024-08-13",
    vensterTot: "2026-08-13",
    aantal,
    drempel,
    haalt: aantal >= drempel,
    tekort: Math.max(0, drempel - aantal),
    praktijkzorg: { metTijdgegevens: 0, metVlag: 0, aandeelMetVlag: null, signaal: false },
  };
}

const MODULEPAD = resolve(__dirname, "../server/bekwaamheid/beslisregels.ts");

/**
 * Leest de module zonder commentaar.
 *
 * De brontests hieronder controleren dat bepaalde woorden NIET in de module
 * staan. Bij de eerste versie sloegen drie van die tests aan op het commentaar
 * dat juist uitlegt waarom die woorden er niet horen: het commentaar citeert
 * "gezakt, afgekeurd en onvoldoende" en noemt `beeindigd` bij naam. Een test die
 * op de uitleg struikelt, meet de uitleg en niet de code.
 *
 * Bewust simpel: de module bevat geen tekenreeks met // of een sterretje erin, en
 * een test die alles vervangt door een volwaardige ontleder is zelf een bron van
 * fouten. Een aparte test controleert dat die aanname geldt.
 */
function codeZonderCommentaar(): string {
  return readFileSync(MODULEPAD, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function voorstel(invoer: BeslisInvoer): Voorstel {
  const uitkomst = beoordeel(invoer);
  if (uitkomst.uitkomst === null) {
    throw new Error(`Verwacht een voorstel, kreeg onvolledig: ${uitkomst.onvolledig.join(" | ")}`);
  }
  return uitkomst;
}

// --- de tabel --------------------------------------------------------------

type Geval = {
  naam: string;
  scores: [number, number, number, number];
  leemten?: string[];
  uitkomst: string;
  regel: BindendeRegel;
};

const TABEL: Geval[] = [
  // --- ruim binnen de norm -------------------------------------------------
  {
    naam: "alles ruim boven de norm",
    scores: [0.9, 0.9, 0.9, 0.9],
    uitkomst: "bekrachtigd",
    regel: "norm_gehaald",
  },
  {
    naam: "alle assen op 0,70, totaal 0,70",
    scores: [0.7, 0.7, 0.7, 0.7],
    uitkomst: "bekrachtigd",
    regel: "norm_gehaald",
  },
  {
    naam: "alles op 1,00",
    scores: [1, 1, 1, 1],
    uitkomst: "bekrachtigd",
    regel: "norm_gehaald",
  },

  // --- de aandachtszone ----------------------------------------------------
  {
    naam: "een as op 0,60, precies de drempel, norm gehaald",
    scores: [0.6, 0.8, 0.8, 0.8],
    uitkomst: "bekrachtigd_met_aandachtspunt",
    regel: "as_in_aandachtszone",
  },
  {
    naam: "een as op 0,65, precies de bovengrens van de zone",
    scores: [0.65, 0.8, 0.8, 0.8],
    uitkomst: "bekrachtigd_met_aandachtspunt",
    regel: "as_in_aandachtszone",
  },
  {
    naam: "een as op 0,651, net boven de zone",
    scores: [0.651, 0.8, 0.8, 0.8],
    uitkomst: "bekrachtigd",
    regel: "norm_gehaald",
  },
  {
    naam: "twee assen in de aandachtszone, norm nog gehaald",
    scores: [0.62, 0.63, 0.85, 0.85],
    uitkomst: "bekrachtigd_met_aandachtspunt",
    regel: "as_in_aandachtszone",
  },

  // --- administratieve leemte ---------------------------------------------
  {
    naam: "alles ruim in orde maar een administratieve leemte",
    scores: [0.9, 0.9, 0.9, 0.9],
    leemten: ["De verklaring bij de eigen opname ontbreekt."],
    uitkomst: "bekrachtigd_met_aandachtspunt",
    regel: "administratieve_leemte",
  },

  // --- voorwaardelijk ------------------------------------------------------
  {
    naam: "een as op 0,59, net onder de drempel",
    scores: [0.59, 0.9, 0.9, 0.9],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
  {
    naam: "een as op 0,5999",
    scores: [0.5999, 0.9, 0.9, 0.9],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
  {
    naam: "een as op 0,00 en de rest perfect",
    scores: [0, 1, 1, 1],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },

  // --- opgeschort ----------------------------------------------------------
  {
    naam: "twee assen onder de drempel",
    scores: [0.5, 0.5, 0.9, 0.9],
    uitkomst: "opgeschort",
    regel: "twee_of_meer_assen_onder_drempel",
  },
  {
    naam: "drie assen onder de drempel",
    scores: [0.5, 0.5, 0.5, 0.9],
    uitkomst: "opgeschort",
    regel: "twee_of_meer_assen_onder_drempel",
  },
  {
    naam: "vier assen onder de drempel",
    scores: [0.4, 0.4, 0.4, 0.4],
    uitkomst: "opgeschort",
    regel: "twee_of_meer_assen_onder_drempel",
  },
  {
    naam: "alles op 0,00",
    scores: [0, 0, 0, 0],
    uitkomst: "opgeschort",
    regel: "twee_of_meer_assen_onder_drempel",
  },

  // --- de gemene gevallen -------------------------------------------------
  {
    // Uit de tabel met grensgevallen van het bouwplan (r898): "totaal net boven
    // 0,70 met één as op 0,59 (moet zakken)". Nagerekend: 0,59·0,20 + 0,70·0,30
    // + 0,75·0,30 + 0,75·0,20 = 0,703. Het totaal HAALT de norm en toch mag hier
    // geen bekrachtiging uit komen.
    naam: "GEMEEN: totaal 0,703 met een as op 0,59 — de as bindt",
    scores: [0.59, 0.7, 0.75, 0.75],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
  {
    // Hetzelfde geval met ruimer marge op het totaal, zodat de as werkelijk de
    // enige grond is: 0,59·0,20 + 0,80·0,80 = 0,758.
    naam: "GEMEEN: totaal 0,758 met een as op 0,59 — de as bindt nog steeds",
    scores: [0.59, 0.8, 0.8, 0.8],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
  {
    // Ook uit die tabel. Elke as haalt haar eigen drempel ruim, en toch mag hier
    // geen bekrachtiging uit komen.
    naam: "GEMEEN: totaal 0,69 met alle assen op 0,69 — het totaal bindt",
    scores: [0.69, 0.69, 0.69, 0.69],
    uitkomst: "voorwaardelijk",
    regel: "totaal_onder_drempel",
  },
  {
    naam: "GEMEEN: totaal 0,6999 — net onder de totaaldrempel, alle assen ruim",
    scores: [0.6999, 0.6999, 0.6999, 0.6999],
    uitkomst: "voorwaardelijk",
    regel: "totaal_onder_drempel",
  },
  {
    // Twee assen onder de drempel EN het totaal onder de drempel. De zwaarste
    // regel moet binden, niet de eerste die je toevallig test.
    naam: "GEMEEN: twee assen onder de drempel EN totaal onder de drempel",
    scores: [0.5, 0.5, 0.7, 0.7],
    uitkomst: "opgeschort",
    regel: "twee_of_meer_assen_onder_drempel",
  },
  {
    // Een as onder de drempel EN een andere in de aandachtszone. De zwaardere
    // regel bindt; de aandachtszone mag de uitkomst niet oppoetsen.
    naam: "GEMEEN: een as onder de drempel EN een as in de aandachtszone",
    scores: [0.55, 0.62, 0.9, 0.9],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
  {
    // Een leemte mag een tekortkoming op een as niet verzachten.
    naam: "GEMEEN: een as onder de drempel EN een administratieve leemte",
    scores: [0.5, 0.9, 0.9, 0.9],
    leemten: ["Het gespreksverslag ontbreekt."],
    uitkomst: "voorwaardelijk",
    regel: "een_as_onder_drempel",
  },
];

describe("beoordeel — de cesuurtabel", () => {
  it.each(TABEL)("$naam", ({ scores: s, leemten, uitkomst, regel }) => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(...s),
      activiteit: activiteit(8),
      administratieveLeemten: leemten,
    });
    expect(resultaat.uitkomst).toBe(uitkomst);
    expect(resultaat.bindendeRegel).toBe(regel);
  });

  it("de tabel dekt minstens twintig gevallen", () => {
    expect(TABEL.length).toBeGreaterThanOrEqual(20);
  });

  it("de tabel dekt elke voorstelbare uitkomst", () => {
    const gedekt = new Set(TABEL.map((g) => g.uitkomst));
    for (const u of VOORSTELBARE_UITKOMSTEN) {
      expect(gedekt.has(u)).toBe(true);
    }
  });

  it("de tabel dekt elke bindende regel", () => {
    const gedekt = new Set(TABEL.map((g) => g.regel));
    const alle: BindendeRegel[] = [
      "twee_of_meer_assen_onder_drempel",
      "een_as_onder_drempel",
      "totaal_onder_drempel",
      "as_in_aandachtszone",
      "administratieve_leemte",
      "norm_gehaald",
    ];
    for (const r of alle) expect(gedekt.has(r)).toBe(true);
  });
});

// =============================================================================
// De grens die het zwaarst weegt: beeindigd komt nooit uit de machine
// =============================================================================

describe("beoordeel stelt nooit beeindigd voor", () => {
  it("beeindigd staat in BESLISUITKOMSTEN maar niet in VOORSTELBARE_UITKOMSTEN", () => {
    expect(BESLISUITKOMSTEN).toContain("beeindigd");
    expect(VOORSTELBARE_UITKOMSTEN as readonly string[]).not.toContain("beeindigd");
  });

  it("geen enkel geval in de tabel stelt beeindigd voor", () => {
    for (const geval of TABEL) {
      expect(geval.uitkomst).not.toBe("beeindigd");
    }
  });

  it("over 1300 scorecombinaties komt beeindigd nooit uit de machine", () => {
    // Uitputtend over een raster van 0,00 tot 1,00 in stappen van 0,05 op twee
    // assen, met de twee andere assen mee gevarieerd. Een gerichte test bewijst
    // alleen dat de gevallen die ik bedacht heb goed gaan; dit dekt ook de
    // gevallen die ik niet bedacht heb.
    const gezien = new Set<string>();
    let aantal = 0;
    for (let a = 0; a <= 20; a++) {
      for (let b = 0; b <= 20; b++) {
        for (const rest of [0, 0.55, 0.6, 0.65, 0.7, 1]) {
          const resultaat = voorstel({
            normprofiel: PROFIEL,
            asscores: scores(a / 20, b / 20, rest, rest),
            activiteit: activiteit(a % 12),
            administratieveLeemten: b % 3 === 0 ? ["leemte"] : [],
          });
          expect(resultaat.uitkomst).not.toBe("beeindigd");
          expect(VOORSTELBARE_UITKOMSTEN as readonly string[]).toContain(resultaat.uitkomst);
          gezien.add(resultaat.uitkomst);
          aantal++;
        }
      }
    }
    expect(aantal).toBeGreaterThan(1300);
    // en het raster moet werkelijk alle vier de uitkomsten hebben geraakt,
    // anders bewijst het bovenstaande niets.
    expect(gezien.size).toBe(VOORSTELBARE_UITKOMSTEN.length);
  });

  it("de code noemt beeindigd nergens als waarde — alleen het commentaar legt uit waarom", () => {
    const code = codeZonderCommentaar();
    expect(code).not.toMatch(/beeindigd/);
    // en het commentaar legt het wél uit, want een stille afwezigheid is bij een
    // bezwaar geen verantwoording.
    expect(readFileSync(MODULEPAD, "utf8")).toMatch(/beeindigd/);
  });
});

// =============================================================================
// De activiteitsroute drukt de uitkomst niet
// =============================================================================

describe("de activiteitsroute staat los van de uitkomst", () => {
  it("te weinig afnames verandert een bekrachtiging niet", () => {
    const veel = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(20),
    });
    const weinig = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(1),
    });
    expect(veel.uitkomst).toBe("bekrachtigd");
    expect(weinig.uitkomst).toBe("bekrachtigd");
    expect(veel.bindendeRegel).toBe(weinig.bindendeRegel);
    expect(veel.activiteitsroute).toBe("voldoende_activiteit");
    expect(weinig.activiteitsroute).toBe("slapend");
  });

  it("nul afnames geeft slapend, niet opgeschort", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(0),
    });
    expect(resultaat.uitkomst).toBe("bekrachtigd");
    expect(resultaat.activiteitsroute).toBe("slapend");
  });

  it("activiteit precies op de drempel haalt", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(6),
    });
    expect(resultaat.activiteitsroute).toBe("voldoende_activiteit");
    expect(resultaat.berekening.activiteit.haalt).toBe(true);
  });

  it("een afname onder de drempel geeft slapend met tekort 1", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(5),
    });
    expect(resultaat.activiteitsroute).toBe("slapend");
    expect(resultaat.berekening.activiteit.aantal).toBe(5);
  });

  it("de uitkomst is identiek voor elk activiteitsaantal van 0 tot 20", () => {
    const uitkomsten = new Set<string>();
    for (let n = 0; n <= 20; n++) {
      uitkomsten.add(
        voorstel({
          normprofiel: PROFIEL,
          asscores: scores(0.62, 0.9, 0.9, 0.9),
          activiteit: activiteit(n),
        }).uitkomst,
      );
    }
    expect([...uitkomsten]).toEqual(["bekrachtigd_met_aandachtspunt"]);
  });
});

// =============================================================================
// Een onvolledig dossier is geen tekortkoming
// =============================================================================

describe("een onvolledig dossier levert geen voorstel", () => {
  function metGat(): AsscoreUitkomst {
    const basis = scores(0.9, 0.9, 0.9, 0.9);
    return {
      perAs: { ...basis.perAs, zorgen: { as: "zorgen", score: null, meegerekend: 0, openstaand: 1 } },
      totaal: null,
      volledig: false,
      onbeoordeeld: [4],
    };
  }

  it("een ontbrekende as geeft uitkomst null, niet een lage uitkomst", () => {
    const resultaat = beoordeel({
      normprofiel: PROFIEL,
      asscores: metGat(),
      activiteit: activiteit(8),
    });
    expect(resultaat.uitkomst).toBeNull();
  });

  it("de ontbrekende as wordt met naam benoemd", () => {
    const resultaat = beoordeel({
      normprofiel: PROFIEL,
      asscores: metGat(),
      activiteit: activiteit(8),
    });
    expect(resultaat.onvolledig.some((r) => r.includes("zorgen"))).toBe(true);
  });

  it("het onbeoordeelde bewijsstuk wordt genoemd", () => {
    const resultaat = beoordeel({
      normprofiel: PROFIEL,
      asscores: metGat(),
      activiteit: activiteit(8),
    });
    expect(resultaat.onvolledig.some((r) => r.includes("4"))).toBe(true);
  });

  it("een null totaal zonder ontbrekende as valt op het vangnet", () => {
    const resultaat = beoordeel({
      normprofiel: PROFIEL,
      asscores: { ...scores(0.9, 0.9, 0.9, 0.9), totaal: null, volledig: true },
      activiteit: activiteit(8),
    });
    expect(resultaat.uitkomst).toBeNull();
    expect(resultaat.onvolledig).toContain("De totaalscore is niet berekend.");
  });
});

// =============================================================================
// De berekening is navolgbaar
// =============================================================================

describe("de berekening legt vast waarop het voorstel rust", () => {
  it("bevat het totaal, de drempel en of die gehaald is", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.59, 0.8, 0.8, 0.8),
      activiteit: activiteit(8),
    });
    // Nagerekend: 0,59·0,20 + 0,80·0,30 + 0,80·0,30 + 0,80·0,20 = 0,758.
    expect(resultaat.berekening.totaal).toBeCloseTo(0.758, 10);
    expect(resultaat.berekening.drempelTotaal).toBe(0.7);
    expect(resultaat.berekening.totaalHaalt).toBe(true);
  });

  it("noemt welke assen onder hun drempel bleven", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.5, 0.5, 0.9, 0.9),
      activiteit: activiteit(8),
    });
    expect(resultaat.berekening.assenOnderDrempel).toEqual(["weten", "zien"]);
  });

  it("noemt welke assen in de aandachtszone vielen", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.62, 0.63, 0.85, 0.85),
      activiteit: activiteit(8),
    });
    expect(resultaat.berekening.assenInAandachtszone).toEqual(["weten", "zien"]);
  });

  it("houdt alle toegepaste regels bij, niet alleen de bindende", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.5, 0.62, 0.9, 0.9),
      activiteit: activiteit(8),
      administratieveLeemten: ["leemte"],
    });
    expect(resultaat.berekening.toegepasteRegels).toEqual([
      "een_as_onder_drempel",
      "as_in_aandachtszone",
      "administratieve_leemte",
    ]);
    expect(resultaat.bindendeRegel).toBe("een_as_onder_drempel");
  });

  it("de bindende regel is altijd de eerste van de toegepaste regels", () => {
    for (const geval of TABEL) {
      const resultaat = voorstel({
        normprofiel: PROFIEL,
        asscores: scores(...geval.scores),
        activiteit: activiteit(8),
        administratieveLeemten: geval.leemten,
      });
      expect(resultaat.bindendeRegel).toBe(resultaat.berekening.toegepasteRegels[0]);
    }
  });

  it("de berekening overleeft een rondgang door JSON", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.59, 0.8, 0.8, 0.8),
      activiteit: activiteit(8),
    });
    // Dit veld gaat als JSON in de kolom voorstel_berekening. Zit er iets in dat
    // JSON niet overleeft, dan staat er later iets anders in de databank dan wat
    // er besloten is.
    expect(JSON.parse(JSON.stringify(resultaat.berekening))).toEqual(resultaat.berekening);
  });

  it("de vier assen staan alle vier in perAs met score en drempel", () => {
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.7, 0.8, 0.9, 0.75),
      activiteit: activiteit(8),
    });
    for (const as of ASSEN) {
      expect(resultaat.berekening.perAs[as].drempel).toBe(0.6);
      expect(typeof resultaat.berekening.perAs[as].score).toBe("number");
    }
  });

  it("het praktijkzorgsignaal wordt doorgegeven maar verandert de uitkomst niet", () => {
    const basis = activiteit(8);
    const metSignaal: ActiviteitUitkomst = {
      ...basis,
      praktijkzorg: { metTijdgegevens: 8, metVlag: 4, aandeelMetVlag: 0.5, signaal: true },
    };
    const zonder = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: basis,
    });
    const met = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: metSignaal,
    });
    expect(met.berekening.praktijkzorgsignaal).toBe(true);
    expect(met.uitkomst).toBe(zonder.uitkomst);
    expect(met.bindendeRegel).toBe(zonder.bindendeRegel);
  });
});

// =============================================================================
// Het normprofiel is werkelijk de norm
// =============================================================================

describe("de drempels komen uit het normprofiel", () => {
  it("dezelfde scores geven onder een strengere cesuur een andere uitkomst", () => {
    const s = scores(0.72, 0.72, 0.72, 0.72);
    const mild = voorstel({ normprofiel: PROFIEL, asscores: s, activiteit: activiteit(8) });
    const streng = voorstel({
      normprofiel: { ...PROFIEL, drempelTotaal: 0.75 },
      asscores: s,
      activiteit: activiteit(8),
    });
    expect(mild.uitkomst).toBe("bekrachtigd");
    expect(streng.uitkomst).toBe("voorwaardelijk");
    expect(streng.bindendeRegel).toBe("totaal_onder_drempel");
  });

  it("een asdrempel per as apart werkt", () => {
    const resultaat = voorstel({
      normprofiel: {
        ...PROFIEL,
        drempelPerAs: { weten: 0.5, zien: 0.8, zeggen: 0.6, zorgen: 0.6 },
      },
      asscores: scores(0.55, 0.75, 0.9, 0.9),
      activiteit: activiteit(8),
    });
    // weten haalt haar lage drempel van 0,50; zien zakt op haar hoge van 0,80.
    expect(resultaat.berekening.assenOnderDrempel).toEqual(["zien"]);
    expect(resultaat.uitkomst).toBe("voorwaardelijk");
  });

  it("de activiteitsdrempel komt uit de activiteitsuitkomst, niet uit een constante", () => {
    const resultaat = voorstel({
      normprofiel: { ...PROFIEL, activiteitsdrempel: 3 },
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(4, 3),
    });
    expect(resultaat.berekening.activiteit.drempel).toBe(3);
    expect(resultaat.activiteitsroute).toBe("voldoende_activiteit");
  });

  it("de bovengrens van de aandachtszone is een benoemde constante", () => {
    expect(AANDACHTSZONE_BOVENGRENS).toBe(0.65);
  });
});

// =============================================================================
// Zuiverheid en de grenzen van de module
// =============================================================================

describe("de module is zuiver en blijft binnen haar grenzen", () => {
  it("de invoer wordt niet gewijzigd", () => {
    const profiel = structuredClone(PROFIEL);
    const s = scores(0.5, 0.5, 0.9, 0.9);
    const sVoor = structuredClone(s);
    const a = activiteit(3);
    const aVoor = structuredClone(a);
    const leemten = ["leemte"];
    beoordeel({ normprofiel: profiel, asscores: s, activiteit: a, administratieveLeemten: leemten });
    expect(profiel).toEqual(PROFIEL);
    expect(s).toEqual(sVoor);
    expect(a).toEqual(aVoor);
    expect(leemten).toEqual(["leemte"]);
  });

  it("de meegegeven lijst met leemten wordt gekopieerd, niet vastgehouden", () => {
    const leemten = ["een"];
    const resultaat = voorstel({
      normprofiel: PROFIEL,
      asscores: scores(0.9, 0.9, 0.9, 0.9),
      activiteit: activiteit(8),
      administratieveLeemten: leemten,
    });
    leemten.push("twee");
    expect(resultaat.berekening.administratieveLeemten).toEqual(["een"]);
  });

  it("tweemaal dezelfde invoer geeft tweemaal dezelfde uitvoer", () => {
    const maak = () =>
      voorstel({
        normprofiel: PROFIEL,
        asscores: scores(0.62, 0.71, 0.83, 0.59),
        activiteit: activiteit(5),
        administratieveLeemten: ["leemte"],
      });
    expect(maak()).toEqual(maak());
  });

  it("de module raakt de accreditatie niet aan", () => {
    const bron = readFileSync(
      resolve(__dirname, "../server/bekwaamheid/beslisregels.ts"),
      "utf8",
    );
    expect(bron).not.toMatch(/ingetrokkenOp|ingetrokken_op/);
    // Het woord accreditatie mag alleen in het commentaar staan dat uitlegt dat
    // ze niet wordt aangeraakt, nooit als identificator.
    expect(bron).not.toMatch(/accreditatie[sA-Z_.[(]/);
  });

  it("de module gebruikt geen databank en geen Express", () => {
    const bron = readFileSync(
      resolve(__dirname, "../server/bekwaamheid/beslisregels.ts"),
      "utf8",
    );
    expect(bron).not.toMatch(/from "express"|better-sqlite3|drizzle-orm|\bdb\./);
  });

  it("de code bevat geen afkeurende taal", () => {
    const code = codeZonderCommentaar().toLowerCase();
    for (const woord of ["gezakt", "afgekeurd", "onvoldoende", "niet_bekrachtigd", "herkansing"]) {
      expect(code).not.toContain(woord);
    }
  });

  it("de aanname onder het strippen van commentaar geldt", () => {
    // Zou de module een tekenreeks met // of een sterretje bevatten, dan sneed
    // codeZonderCommentaar echte code weg en werden de tests hierboven stil
    // waardeloos.
    const bron = readFileSync(MODULEPAD, "utf8");
    const regels = bron.split("\n").filter((r) => !r.trimStart().startsWith("//") && !r.trimStart().startsWith("*"));
    for (const regel of regels) {
      const strings = regel.match(/"[^"]*"|'[^']*'/g) ?? [];
      for (const s of strings) {
        expect(s).not.toContain("//");
        expect(s).not.toContain("*");
      }
    }
  });

  it("de module leest geen weging uit een bewijsstuk", () => {
    const bron = readFileSync(
      resolve(__dirname, "../server/bekwaamheid/beslisregels.ts"),
      "utf8",
    );
    // De weging hoort alleen via het normprofiel binnen te komen. Deze module
    // hoort haar zelfs niet te noemen, want berekenAsscores heeft het totaal al
    // gewogen.
    expect(bron).not.toMatch(/bewijsstuk\.weging|\.weging\b/);
  });
});
