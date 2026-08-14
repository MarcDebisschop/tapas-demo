// =============================================================================
// tests/bekwaamheid-normprofiel.test.ts
//
// Blok 3, laag 1: de cesuur en de rekenkern eronder.
//
// De poort van blok 3 vraagt een tabelgestuurde test met minstens twintig
// gevallen "inclusief de gemene". De gemene gevallen staan in de tabel
// GRENSGEVALLEN en zijn met opzet zo gekozen dat een plausibele maar verkeerde
// implementatie erop stukloopt:
//
//   - totaal net boven 0,70 met een as op 0,59  -> mag NIET door
//   - totaal 0,69 met alle assen ruim boven de drempel -> mag NIET door
//   - activiteit precies op 6 -> mag door
//   - activiteit 5 -> slapend, niet gezakt
//
// De beslismachine zelf (beslisregels.ts) hangt nog op een openstaande vraag over
// het beslisvocabulaire. Wat hier getest wordt, is alles wat aan die beslissing
// voorafgaat: of de asscores en het totaal kloppen, en of de activiteitstelling
// klopt. Elk grensgeval legt daarom het GEMETEN feit vast plus wat de nog te
// bouwen beslisregel eruit moet halen. Zo blijft de tabel de norm wanneer de
// machine erbij komt.
// =============================================================================

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import {
  valideerNormprofiel,
  berekenAsscores,
  WEGING_TOLERANTIE,
  ONDERBOUWING_MINIMUM,
  type BewijsstukScore,
  type Weging,
} from "../server/bekwaamheid/normprofiel";
import {
  berekenActiviteit,
  vensterBegin,
  MINIMUM_AFNAMES_VOOR_SIGNAAL,
  type AfnameVoorActiviteit,
} from "../server/bekwaamheid/activiteit";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import { ASSEN, type As } from "../server/bekwaamheid/schema";

// -----------------------------------------------------------------------------
// Hulpstukken
// -----------------------------------------------------------------------------

const WEGING_BOUWPLAN: Weging = { weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.2 };
const DREMPELS_60 = { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 };
const ONDERBOUWING = "x".repeat(ONDERBOUWING_MINIMUM);

/** Eén beoordeeld bewijsstuk per as, met de opgegeven scores. */
function stukkenPerAs(scores: Record<As, number>): BewijsstukScore[] {
  return ASSEN.map((as, i) => ({
    nummer: i + 1,
    as,
    ruweScore: scores[as],
    status: "beoordeeld" as const,
  }));
}

function geldigProfiel() {
  return {
    weging: WEGING_BOUWPLAN,
    drempelTotaal: 0.7,
    drempelPerAs: DREMPELS_60,
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    onderbouwing: ONDERBOUWING,
  };
}

// -----------------------------------------------------------------------------
// De tabel met grensgevallen
// -----------------------------------------------------------------------------

type Grensgeval = {
  naam: string;
  scores: Record<As, number>;
  /** Verwacht totaal, of null wanneer het niet berekenbaar is. */
  totaal: number;
  /** Haalt het totaal de drempel van 0,70? */
  totaalHaalt: boolean;
  /** Halen ALLE assen de drempel van 0,60? */
  assenHalen: boolean;
  /** Welke assen onder 0,60 zitten. */
  assenOnder: As[];
  /** Wat de beslisregel hieruit moet halen, in gewone taal. */
  regel: string;
};

const GRENSGEVALLEN: Grensgeval[] = [
  // --- de vier gemene gevallen uit de poort ---------------------------------
  {
    naam: "totaal net boven 0,70 maar een as op 0,59 - de as bindt",
    // 0.2*0.59 + 0.3*0.80 + 0.3*0.80 + 0.2*0.75 = 0.118+0.24+0.24+0.15 = 0.748
    scores: { weten: 0.59, zien: 0.8, zeggen: 0.8, zorgen: 0.75 },
    totaal: 0.748,
    totaalHaalt: true,
    assenHalen: false,
    assenOnder: ["weten"],
    regel: "een as onder 0,60 bindt, ook al is het totaal ruim gehaald",
  },
  {
    naam: "totaal 0,69 met alle assen ruim boven de drempel - het totaal bindt",
    // alle assen 0.69: totaal = 0.69 exact, want de wegingen tellen tot 1
    scores: { weten: 0.69, zien: 0.69, zeggen: 0.69, zorgen: 0.69 },
    totaal: 0.69,
    totaalHaalt: false,
    assenHalen: true,
    assenOnder: [],
    regel: "het totaal onder 0,70 bindt, ook al haalt elke as haar eigen drempel",
  },
  {
    naam: "totaal exact op 0,70 - de drempel is inclusief",
    scores: { weten: 0.7, zien: 0.7, zeggen: 0.7, zorgen: 0.7 },
    totaal: 0.7,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "exact op de drempel haalt de drempel",
  },
  {
    naam: "een as exact op 0,60 - de asdrempel is inclusief",
    // 0.2*0.60 + 0.3*0.85 + 0.3*0.85 + 0.2*0.80 = 0.12+0.255+0.255+0.16 = 0.79
    scores: { weten: 0.6, zien: 0.85, zeggen: 0.85, zorgen: 0.8 },
    totaal: 0.79,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "exact op de asdrempel haalt de asdrempel",
  },
  // --- de zone met aandachtspunt (as tussen 0,60 en 0,65) -------------------
  {
    naam: "een as op 0,62 - norm gehaald, aandachtspunt",
    // 0.2*0.62 + 0.3*0.85 + 0.3*0.85 + 0.2*0.80 = 0.124+0.255+0.255+0.16 = 0.794
    scores: { weten: 0.62, zien: 0.85, zeggen: 0.85, zorgen: 0.8 },
    totaal: 0.794,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "as tussen 0,60 en 0,65: bekrachtigd met aandachtspunt",
  },
  {
    naam: "een as exact op 0,65 - de bovengrens van de aandachtszone",
    // 0.2*0.65 + 0.3*0.85 + 0.3*0.85 + 0.2*0.80 = 0.13+0.255+0.255+0.16 = 0.80
    scores: { weten: 0.65, zien: 0.85, zeggen: 0.85, zorgen: 0.8 },
    totaal: 0.8,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "0,65 is de bovengrens van de aandachtszone",
  },
  // --- een as onder 0,60 ----------------------------------------------------
  {
    naam: "een as onder 0,60 met een hoog totaal",
    // 0.2*0.40 + 0.3*0.95 + 0.3*0.95 + 0.2*0.95 = 0.08+0.285+0.285+0.19 = 0.84
    scores: { weten: 0.4, zien: 0.95, zeggen: 0.95, zorgen: 0.95 },
    totaal: 0.84,
    totaalHaalt: true,
    assenHalen: false,
    assenOnder: ["weten"],
    regel: "een as onder 0,60: voorwaardelijk, licentie blijft actief",
  },
  {
    naam: "een as net onder de drempel, 0,5999",
    scores: { weten: 0.5999, zien: 0.9, zeggen: 0.9, zorgen: 0.9 },
    totaal: 0.2 * 0.5999 + 0.3 * 0.9 + 0.3 * 0.9 + 0.2 * 0.9,
    totaalHaalt: true,
    assenHalen: false,
    assenOnder: ["weten"],
    regel: "0,5999 haalt 0,60 niet",
  },
  // --- twee of meer assen onder 0,60 ---------------------------------------
  {
    naam: "twee assen onder 0,60",
    // 0.2*0.50 + 0.3*0.50 + 0.3*0.90 + 0.2*0.90 = 0.10+0.15+0.27+0.18 = 0.70
    scores: { weten: 0.5, zien: 0.5, zeggen: 0.9, zorgen: 0.9 },
    totaal: 0.7,
    totaalHaalt: true,
    assenHalen: false,
    assenOnder: ["weten", "zien"],
    regel: "twee assen onder 0,60: de zwaarste uitkomst, ook bij totaal op 0,70",
  },
  {
    naam: "alle vier de assen onder 0,60",
    scores: { weten: 0.3, zien: 0.3, zeggen: 0.3, zorgen: 0.3 },
    totaal: 0.3,
    totaalHaalt: false,
    assenHalen: false,
    assenOnder: ["weten", "zien", "zeggen", "zorgen"],
    regel: "vier assen onder de drempel: de zwaarste uitkomst",
  },
  // --- totaal in de band 0,60 tot 0,70 -------------------------------------
  {
    naam: "totaal exact op 0,60 met alle assen boven de drempel",
    scores: { weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 },
    totaal: 0.6,
    totaalHaalt: false,
    assenHalen: true,
    assenOnder: [],
    regel: "totaal tussen 0,60 en 0,70: voorwaardelijk",
  },
  {
    naam: "totaal net onder 0,70, namelijk 0,6999",
    scores: { weten: 0.6999, zien: 0.6999, zeggen: 0.6999, zorgen: 0.6999 },
    totaal: 0.6999,
    totaalHaalt: false,
    assenHalen: true,
    assenOnder: [],
    regel: "0,6999 haalt 0,70 niet",
  },
  // --- de zwaarte van de weging telt echt ----------------------------------
  {
    naam: "de lichtste as laag, het totaal blijft hoog",
    // weten weegt 0.20: 0.2*0.61 + 0.3*0.95 + 0.3*0.95 + 0.2*0.95 = 0.122+0.285+0.285+0.19
    scores: { weten: 0.61, zien: 0.95, zeggen: 0.95, zorgen: 0.95 },
    totaal: 0.882,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "de weging wordt echt toegepast, niet ongewogen gemiddeld",
  },
  {
    naam: "de zwaarste as laag, het totaal zakt harder",
    // zien weegt 0.30: 0.2*0.95 + 0.3*0.61 + 0.3*0.95 + 0.2*0.95 = 0.19+0.183+0.285+0.19
    scores: { weten: 0.95, zien: 0.61, zeggen: 0.95, zorgen: 0.95 },
    totaal: 0.848,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "dezelfde score op een zwaardere as drukt het totaal meer",
  },
  // --- de uitersten ---------------------------------------------------------
  {
    naam: "alles op 1",
    scores: { weten: 1, zien: 1, zeggen: 1, zorgen: 1 },
    totaal: 1,
    totaalHaalt: true,
    assenHalen: true,
    assenOnder: [],
    regel: "de bovengrens rekent zuiver",
  },
  {
    naam: "alles op 0",
    scores: { weten: 0, zien: 0, zeggen: 0, zorgen: 0 },
    totaal: 0,
    totaalHaalt: false,
    assenHalen: false,
    assenOnder: ["weten", "zien", "zeggen", "zorgen"],
    regel: "de ondergrens rekent zuiver en levert geen deling door nul",
  },
];

describe("blok 3 - de tabel met grensgevallen op de cesuur", () => {
  it("bevat minstens twintig gevallen samen met de activiteitstabel", () => {
    // De poort vraagt twintig gevallen over de cesuur heen. De scoretabel en de
    // activiteitstabel toetsen samen de volledige rekenkern.
    expect(GRENSGEVALLEN.length + ACTIVITEITSGEVALLEN.length).toBeGreaterThanOrEqual(20);
  });

  for (const geval of GRENSGEVALLEN) {
    it(`${geval.naam} (${geval.regel})`, () => {
      const uitkomst = berekenAsscores(stukkenPerAs(geval.scores), WEGING_BOUWPLAN);

      expect(uitkomst.volledig).toBe(true);
      expect(uitkomst.totaal).not.toBeNull();
      expect(uitkomst.totaal as number).toBeCloseTo(geval.totaal, 10);

      // Het totaal tegen de drempel van 0,70.
      expect((uitkomst.totaal as number) >= 0.7).toBe(geval.totaalHaalt);

      // Elke as tegen haar eigen drempel van 0,60.
      const onder = ASSEN.filter((as) => (uitkomst.perAs[as].score as number) < 0.6);
      expect(onder).toEqual(geval.assenOnder);
      expect(onder.length === 0).toBe(geval.assenHalen);

      // De asscore is de ruwe score: met één bewijsstuk per as mag er niets
      // tussen zitten.
      for (const as of ASSEN) {
        expect(uitkomst.perAs[as].score).toBeCloseTo(geval.scores[as], 12);
        expect(uitkomst.perAs[as].meegerekend).toBe(1);
        expect(uitkomst.perAs[as].openstaand).toBe(0);
      }
    });
  }
});

// -----------------------------------------------------------------------------
// De activiteitstabel
// -----------------------------------------------------------------------------

type Activiteitsgeval = {
  naam: string;
  aantal: number;
  haalt: boolean;
  tekort: number;
  regel: string;
};

const ACTIVITEITSGEVALLEN: Activiteitsgeval[] = [
  {
    naam: "activiteit precies op 6",
    aantal: 6,
    haalt: true,
    tekort: 0,
    regel: "precies op de drempel mag door",
  },
  {
    naam: "activiteit 5",
    aantal: 5,
    haalt: false,
    tekort: 1,
    regel: "onder de drempel is slapend, geen tekortkoming",
  },
  {
    naam: "activiteit 7",
    aantal: 7,
    haalt: true,
    tekort: 0,
    regel: "boven de drempel mag door",
  },
  {
    naam: "activiteit 0",
    aantal: 0,
    haalt: false,
    tekort: 6,
    regel: "geen enkele afname is slapend, geen tekortkoming",
  },
  {
    naam: "activiteit 1",
    aantal: 1,
    haalt: false,
    tekort: 5,
    regel: "een enkele afname is slapend",
  },
];

/** Afnames verspreid binnen het venster, zonder tijdgegevens. */
function afnamesBinnen(aantal: number, instrumentId = "t4p"): AfnameVoorActiviteit[] {
  const rijen: AfnameVoorActiviteit[] = [];
  for (let i = 0; i < aantal; i++) {
    // 2026-01-01 en verder; ruim binnen een venster van 24 maanden op 2026-08-13.
    const dag = String((i % 28) + 1).padStart(2, "0");
    rijen.push({ id: i + 1, instrumentId, voltooidOp: `2026-01-${dag}` });
  }
  return rijen;
}

describe("blok 3 - de activiteitstelling", () => {
  for (const geval of ACTIVITEITSGEVALLEN) {
    it(`${geval.naam} (${geval.regel})`, () => {
      const u = berekenActiviteit(afnamesBinnen(geval.aantal), {
        instrumentId: "t4p",
        peildatum: "2026-08-13",
        drempel: 6,
        vensterMaanden: 24,
      });
      expect(u.aantal).toBe(geval.aantal);
      expect(u.haalt).toBe(geval.haalt);
      expect(u.tekort).toBe(geval.tekort);
    });
  }

  it("telt alleen het gevraagde instrument", () => {
    const rijen = [...afnamesBinnen(6, "t4p"), ...afnamesBinnen(9, "t4teens")];
    const u = berekenActiviteit(rijen, {
      instrumentId: "t4p",
      peildatum: "2026-08-13",
      drempel: 6,
      vensterMaanden: 24,
    });
    expect(u.aantal).toBe(6);
  });

  it("telt onvoltooide afnames niet mee", () => {
    // Zes uitnodigingen die niemand invulde, halen de drempel niet.
    const rijen: AfnameVoorActiviteit[] = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      instrumentId: "t4p",
      voltooidOp: null,
    }));
    const u = berekenActiviteit(rijen, {
      instrumentId: "t4p",
      peildatum: "2026-08-13",
      drempel: 6,
      vensterMaanden: 24,
    });
    expect(u.aantal).toBe(0);
    expect(u.haalt).toBe(false);
  });

  it("telt afnames buiten het venster niet mee", () => {
    const u = berekenActiviteit(
      [
        { id: 1, instrumentId: "t4p", voltooidOp: "2024-08-12" }, // een dag te oud
        { id: 2, instrumentId: "t4p", voltooidOp: "2026-08-14" }, // na de peildatum
      ],
      { instrumentId: "t4p", peildatum: "2026-08-13", drempel: 6, vensterMaanden: 24 },
    );
    expect(u.aantal).toBe(0);
  });

  it("rekent beide vensterranden mee", () => {
    const u = berekenActiviteit(
      [
        { id: 1, instrumentId: "t4p", voltooidOp: "2024-08-13" }, // eerste dag
        { id: 2, instrumentId: "t4p", voltooidOp: "2026-08-13" }, // peildatum
      ],
      { instrumentId: "t4p", peildatum: "2026-08-13", drempel: 6, vensterMaanden: 24 },
    );
    expect(u.aantal).toBe(2);
    expect(u.vensterVan).toBe("2024-08-13");
    expect(u.vensterTot).toBe("2026-08-13");
  });

  it("klemt 29 februari naar 28 februari bij de maandaftrek", () => {
    // 2028 is een schrikkeljaar, 2026 niet. Zonder klemming zou 29-02-2028 min
    // 24 maanden op 01-03-2026 uitkomen en zou een afname van 28-02-2026 buiten
    // het venster vallen. Dat is de fout die pas in 2028 aan het licht komt.
    expect(vensterBegin("2028-02-29", 24)).toBe("2026-02-28");
    expect(vensterBegin("2026-03-31", 1)).toBe("2026-02-28");
    expect(vensterBegin("2026-08-13", 24)).toBe("2024-08-13");
  });

  it("gooit op een onleesbare peildatum in plaats van stil te rekenen", () => {
    expect(() => vensterBegin("geen datum", 24)).toThrow(/Ongeldige peildatum/);
  });
});

// -----------------------------------------------------------------------------
// De asscoreberekening in de gevallen die de tabel niet dekt
// -----------------------------------------------------------------------------

describe("blok 3 - de asscoreberekening", () => {
  it("geeft geen totaal zolang een as nog geen enkele score heeft", () => {
    const stukken: BewijsstukScore[] = [
      { nummer: 1, as: "weten", ruweScore: 0.9, status: "beoordeeld" },
      { nummer: 2, as: "zien", ruweScore: 0.9, status: "beoordeeld" },
      { nummer: 3, as: "zeggen", ruweScore: 0.9, status: "beoordeeld" },
      { nummer: 4, as: "zorgen", ruweScore: null, status: "ingeleverd" },
    ];
    const u = berekenAsscores(stukken, WEGING_BOUWPLAN);
    // Een gewogen som over drie assen zou 0.72 zijn en dus vals "gehaald" heten.
    expect(u.totaal).toBeNull();
    expect(u.volledig).toBe(false);
    expect(u.onbeoordeeld).toEqual([4]);
  });

  it("middelt meerdere bewijsstukken op een as ongewogen", () => {
    const stukken: BewijsstukScore[] = [
      { nummer: 1, as: "weten", ruweScore: 0.4, status: "beoordeeld" },
      { nummer: 2, as: "weten", ruweScore: 0.8, status: "beoordeeld" },
      { nummer: 3, as: "zien", ruweScore: 0.7, status: "beoordeeld" },
      { nummer: 4, as: "zeggen", ruweScore: 0.7, status: "beoordeeld" },
      { nummer: 5, as: "zorgen", ruweScore: 0.7, status: "beoordeeld" },
    ];
    const u = berekenAsscores(stukken, WEGING_BOUWPLAN);
    expect(u.perAs.weten.score).toBeCloseTo(0.6, 12);
    expect(u.perAs.weten.meegerekend).toBe(2);
  });

  it("laat status nvt buiten de telling en buiten de openstaande stukken", () => {
    const stukken: BewijsstukScore[] = [
      { nummer: 1, as: "weten", ruweScore: 0.8, status: "beoordeeld" },
      { nummer: 2, as: "weten", ruweScore: null, status: "nvt" },
      { nummer: 3, as: "zien", ruweScore: 0.8, status: "beoordeeld" },
      { nummer: 4, as: "zeggen", ruweScore: 0.8, status: "beoordeeld" },
      { nummer: 5, as: "zorgen", ruweScore: 0.8, status: "beoordeeld" },
    ];
    const u = berekenAsscores(stukken, WEGING_BOUWPLAN);
    expect(u.volledig).toBe(true);
    expect(u.perAs.weten.score).toBeCloseTo(0.8, 12);
    expect(u.perAs.weten.meegerekend).toBe(1);
    expect(u.perAs.weten.openstaand).toBe(0);
    expect(u.onbeoordeeld).toEqual([]);
  });

  it("negeert een ingeleverd stuk zonder score, ook als de status beoordeeld zegt", () => {
    // Een rij met status 'beoordeeld' maar ruweScore null is een gegevensfout.
    // Die als 0 meerekenen zou iemand laten zakken op een ontbrekend veld.
    const stukken: BewijsstukScore[] = [
      { nummer: 1, as: "weten", ruweScore: null, status: "beoordeeld" },
      ...stukkenPerAs({ weten: 0.9, zien: 0.9, zeggen: 0.9, zorgen: 0.9 }).slice(1),
    ];
    const u = berekenAsscores(stukken, WEGING_BOUWPLAN);
    expect(u.perAs.weten.score).toBeNull();
    expect(u.totaal).toBeNull();
    expect(u.onbeoordeeld).toContain(1);
  });

  it("leest de weging uit het normprofiel en niet uit het bewijsstuk", () => {
    // Het bewijsstuktype heeft geen wegingveld. Zou de berekening een weging op
    // het stuk lezen, dan bepaalde een verkeerd overgenomen kolom de uitkomst.
    const stukken = stukkenPerAs({ weten: 0.5, zien: 1, zeggen: 1, zorgen: 1 });
    const zwaarWeten: Weging = { weten: 0.7, zien: 0.1, zeggen: 0.1, zorgen: 0.1 };
    const licht = berekenAsscores(stukken, WEGING_BOUWPLAN);
    const zwaar = berekenAsscores(stukken, zwaarWeten);
    expect(licht.totaal).toBeCloseTo(0.9, 12);
    expect(zwaar.totaal).toBeCloseTo(0.65, 12);
  });

  it("geeft geen totaal bij een leeg dossier", () => {
    const u = berekenAsscores([], WEGING_BOUWPLAN);
    expect(u.totaal).toBeNull();
    expect(u.volledig).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// De validatie van het normprofiel
// -----------------------------------------------------------------------------

describe("blok 3 - de validatie van het normprofiel", () => {
  it("keurt het voorbeeld uit het bouwplan goed", () => {
    expect(valideerNormprofiel(geldigProfiel())).toEqual([]);
  });

  it("keurt een geldige weging goed die in IEEE-754 niet exact op 1 uitkomt", () => {
    // Gemeten, niet aangenomen. Van twaalf plausibele wegingen komen er twee
    // niet exact op 1 uit: 0,4+0,3+0,2+0,1 en 0,15+0,15+0,35+0,35 geven beide
    // 0.9999999999999999. De weging uit het bouwplan (0,2+0,3+0,3+0,2) komt wel
    // exact op 1 uit; een test die het tegendeel beweerde is hier eerst
    // gesneuveld. Een eis van exacte gelijkheid zou dus niet het voorbeeld uit
    // het bouwplan afkeuren, maar wel deze twee even geldige wegingen.
    const som = 0.4 + 0.3 + 0.2 + 0.1;
    expect(som).not.toBe(1);
    expect(Math.abs(som - 1)).toBeLessThan(WEGING_TOLERANTIE);
    expect(
      valideerNormprofiel({
        ...geldigProfiel(),
        weging: { weten: 0.4, zien: 0.3, zeggen: 0.2, zorgen: 0.1 },
      }),
    ).toEqual([]);
    // En de tweede afwijkende weging, om te bewijzen dat het geen toeval is.
    expect(
      valideerNormprofiel({
        ...geldigProfiel(),
        weging: { weten: 0.15, zien: 0.15, zeggen: 0.35, zorgen: 0.35 },
      }),
    ).toEqual([]);
  });

  it("keurt een weging af die niet tot 1 optelt", () => {
    const b = valideerNormprofiel({
      ...geldigProfiel(),
      weging: { weten: 0.2, zien: 0.3, zeggen: 0.25, zorgen: 0.2 },
    });
    expect(b.map((x) => x.veld)).toContain("weging");
  });

  it("keurt een weging met een ontbrekende as af", () => {
    const b = valideerNormprofiel({
      ...geldigProfiel(),
      weging: { weten: 0.3, zien: 0.4, zeggen: 0.3 } as never,
    });
    expect(b.map((x) => x.veld)).toContain("weging.zorgen");
  });

  it("keurt een negatieve weging af", () => {
    const b = valideerNormprofiel({
      ...geldigProfiel(),
      weging: { weten: -0.1, zien: 0.4, zeggen: 0.4, zorgen: 0.3 },
    });
    expect(b.map((x) => x.veld)).toContain("weging.weten");
  });

  it("keurt een totaaldrempel buiten 0 tot 1 af", () => {
    for (const waarde of [0, 1.01, -0.5, Number.NaN]) {
      const b = valideerNormprofiel({ ...geldigProfiel(), drempelTotaal: waarde });
      expect(b.map((x) => x.veld)).toContain("drempelTotaal");
    }
  });

  it("keurt een niet-geheel activiteitsvenster af", () => {
    const b = valideerNormprofiel({ ...geldigProfiel(), activiteitsvensterMaanden: 23.5 });
    expect(b.map((x) => x.veld)).toContain("activiteitsvensterMaanden");
  });

  it("keurt een te korte onderbouwing af", () => {
    const b = valideerNormprofiel({ ...geldigProfiel(), onderbouwing: "te kort" });
    expect(b.map((x) => x.veld)).toContain("onderbouwing");
  });

  it("controleert de onderbouwing niet wanneer het veld ontbreekt", () => {
    const { onderbouwing: _weg, ...zonder } = geldigProfiel();
    expect(valideerNormprofiel(zonder)).toEqual([]);
  });

  it("geeft alle bevindingen tegelijk en niet alleen de eerste", () => {
    const b = valideerNormprofiel({
      weging: { weten: 0.5, zien: 0.5, zeggen: 0.5, zorgen: 0.5 },
      drempelTotaal: 2,
      drempelPerAs: DREMPELS_60,
      activiteitsdrempel: -1,
      activiteitsvensterMaanden: 0,
      onderbouwing: "kort",
    });
    expect(b.length).toBeGreaterThanOrEqual(5);
  });
});

// -----------------------------------------------------------------------------
// De bevriezing in de datalaag
// -----------------------------------------------------------------------------

/**
 * Een databank in het geheugen met alleen de kolommen die deze test leest.
 *
 * Niet de volledige migratie: die zou breken op wijzigingen in tabellen die hier
 * geen rol spelen. Wel met alle CHECK-beperkingen op deze ene tabel, want die
 * horen bij het gedrag dat getest wordt.
 */
function geheugenDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE bekwaamheid_normprofielen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id TEXT NOT NULL,
      versie INTEGER NOT NULL,
      weging TEXT NOT NULL,
      drempel_totaal REAL NOT NULL,
      drempel_per_as TEXT NOT NULL,
      activiteitsdrempel INTEGER NOT NULL,
      activiteitsvenster_maanden INTEGER NOT NULL,
      methode TEXT NOT NULL,
      paneel_omschrijving TEXT,
      vastgesteld_op TEXT NOT NULL,
      vastgesteld_door TEXT NOT NULL,
      bevroren_op TEXT,
      onderbouwing TEXT NOT NULL,
      CONSTRAINT bekwaamheid_normprofiel_versie CHECK (versie >= 1),
      CONSTRAINT bekwaamheid_normprofiel_drempel
        CHECK (drempel_totaal > 0 AND drempel_totaal <= 1),
      CONSTRAINT bekwaamheid_normprofiel_onderbouwing
        CHECK (length(onderbouwing) >= 200)
    );
    CREATE UNIQUE INDEX bekwaamheid_normprofiel_versie_uniek
      ON bekwaamheid_normprofielen (instrument_id, versie);
  `);
  return db;
}

function opslagMetLog() {
  const db = geheugenDb();
  const log: string[] = [];
  const opslag = maakBekwaamheidOpslag(db, (invoer) => {
    log.push(invoer.actie);
    return undefined as never;
  });
  return { db, log, opslag };
}

function neerzetten(opslag: ReturnType<typeof maakBekwaamheidOpslag>, instrument = "t4p") {
  return opslag.normprofielen.zetNeer({
    instrumentId: instrument,
    weging: WEGING_BOUWPLAN,
    drempelTotaal: 0.7,
    drempelPerAs: DREMPELS_60,
    activiteitsdrempel: 6,
    activiteitsvensterMaanden: 24,
    methode: "Aangepaste Angoff met een panel van vijf beoordelaars",
    vastgesteldDoor: "cesuurpanel",
    onderbouwing: ONDERBOUWING,
  });
}

describe("blok 3 - de bevriezing wordt in de datalaag afgedwongen", () => {
  it("legt een nieuw profiel neer als concept, dus niet bevroren", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    expect(p.versie).toBe(1);
    expect(p.bevrorenOp).toBeNull();
    expect(p.weging).toEqual(WEGING_BOUWPLAN);
    expect(p.drempelPerAs).toEqual(DREMPELS_60);
  });

  it("laat een concept wijzigen", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    const na = opslag.normprofielen.wijzig(p.id, { drempelTotaal: 0.72 });
    expect(na.drempelTotaal).toBe(0.72);
  });

  it("gooit bij een wijziging op een bevroren profiel", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    opslag.normprofielen.bevries(p.id);
    expect(() => opslag.normprofielen.wijzig(p.id, { drempelTotaal: 0.5 })).toThrow(
      /bevroren/,
    );
  });

  it("laat de rij ongemoeid wanneer de wijziging gegooid heeft", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    opslag.normprofielen.bevries(p.id);
    try {
      opslag.normprofielen.wijzig(p.id, { drempelTotaal: 0.5 });
    } catch {
      /* verwacht */
    }
    expect(opslag.normprofielen.vindOp(p.id)!.drempelTotaal).toBe(0.7);
  });

  it("gooit bij een tweede bevriezing", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    opslag.normprofielen.bevries(p.id);
    expect(() => opslag.normprofielen.bevries(p.id)).toThrow(/al\s+bevroren/);
  });

  it("heeft geen enkele manier om te ontdooien", () => {
    const { opslag } = opslagMetLog();
    const namen = Object.keys(opslag.normprofielen);
    for (const verboden of ["ontdooi", "ontvries", "heropen", "maakWijzigbaar"]) {
      expect(namen).not.toContain(verboden);
    }
  });

  it("verhoogt het versienummer en laat de aanroeper het niet kiezen", () => {
    const { opslag } = opslagMetLog();
    const een = neerzetten(opslag);
    const twee = neerzetten(opslag);
    expect(een.versie).toBe(1);
    expect(twee.versie).toBe(2);
  });

  it("geeft als geldend profiel het hoogste BEVROREN nummer, niet het hoogste", () => {
    const { opslag } = opslagMetLog();
    const een = neerzetten(opslag);
    opslag.normprofielen.bevries(een.id);
    const twee = neerzetten(opslag); // versie 2, nog concept
    expect(opslag.normprofielen.geldend("t4p")!.versie).toBe(1);
    opslag.normprofielen.bevries(twee.id);
    expect(opslag.normprofielen.geldend("t4p")!.versie).toBe(2);
  });

  it("geeft geen geldend profiel zolang er niets bevroren is", () => {
    const { opslag } = opslagMetLog();
    neerzetten(opslag);
    expect(opslag.normprofielen.geldend("t4p")).toBeUndefined();
  });

  it("weigert een ongeldige weging al voor het wegschrijven", () => {
    const { opslag, db } = opslagMetLog();
    expect(() =>
      opslag.normprofielen.zetNeer({
        instrumentId: "t4p",
        weging: { weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.1 },
        drempelTotaal: 0.7,
        drempelPerAs: DREMPELS_60,
        activiteitsdrempel: 6,
        activiteitsvensterMaanden: 24,
        methode: "Aangepaste Angoff",
        vastgesteldDoor: "cesuurpanel",
        onderbouwing: ONDERBOUWING,
      }),
    ).toThrow(/tellen op tot/);
    const aantal = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_normprofielen")
      .get() as { n: number };
    expect(aantal.n).toBe(0);
  });

  it("weigert een wijziging die de weging ongeldig maakt", () => {
    const { opslag } = opslagMetLog();
    const p = neerzetten(opslag);
    expect(() =>
      opslag.normprofielen.wijzig(p.id, {
        weging: { weten: 0.5, zien: 0.5, zeggen: 0.5, zorgen: 0.5 },
      }),
    ).toThrow(/tellen op tot/);
  });

  it("schrijft een auditregel bij vastleggen, wijzigen en bevriezen", () => {
    const { opslag, log } = opslagMetLog();
    const p = neerzetten(opslag);
    opslag.normprofielen.wijzig(p.id, { drempelTotaal: 0.71 });
    opslag.normprofielen.bevries(p.id);
    expect(log).toEqual([
      "bekwaamheid_normprofiel_vastgelegd",
      "bekwaamheid_normprofiel_gewijzigd",
      "bekwaamheid_normprofiel_bevroren",
    ]);
  });

  it("gooit op onleesbare JSON in de weging in plaats van stil door te rekenen", () => {
    const { opslag, db } = opslagMetLog();
    const p = neerzetten(opslag);
    db.prepare("UPDATE bekwaamheid_normprofielen SET weging = ? WHERE id = ?").run(
      "{geen json",
      p.id,
    );
    expect(() => opslag.normprofielen.vindOp(p.id)).toThrow(/onleesbare/);
  });

  it("gooit bij bevriezen van een profiel dat niet bestaat", () => {
    const { opslag } = opslagMetLog();
    expect(() => opslag.normprofielen.bevries(999)).toThrow(/bestaat niet/);
  });

  it("houdt de versies per instrument apart", () => {
    const { opslag } = opslagMetLog();
    expect(neerzetten(opslag, "t4p").versie).toBe(1);
    expect(neerzetten(opslag, "t4teens").versie).toBe(1);
    expect(neerzetten(opslag, "t4p").versie).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// Wat de machine nooit mag doen
// -----------------------------------------------------------------------------

describe("blok 3 - wat deze laag nooit doet", () => {
  it("raakt de tabel bekwaamheid_accreditaties nergens aan", () => {
    // Draaiboek: de accreditatie is een verworven feit dat niet vervalt. De
    // rekenlaag mag er niet naar verwijzen, ook niet lezend.
    const bronnen = [
      "server/bekwaamheid/normprofiel.ts",
      "server/bekwaamheid/activiteit.ts",
    ];
    for (const pad of bronnen) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tekst = require("node:fs").readFileSync(pad, "utf8");
      expect(tekst).not.toContain("accreditatie");
      expect(tekst).not.toContain("ingetrokkenOp");
      expect(tekst).not.toContain("ingetrokken_op");
    }
  });

  it("gebruikt in de activiteitsmodule nergens afkeurende taal", () => {
    // Draaiboek: onder de activiteitsdrempel is geen tekortkoming. De woorden
    // die dat wel zouden suggereren, mogen er niet staan.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tekst = require("node:fs")
      .readFileSync("server/bekwaamheid/activiteit.ts", "utf8")
      .toLowerCase();
    for (const woord of ["gezakt", "afgekeurd", "onvoldoende", "faalt", "mislukt"]) {
      // 'onvoldoende' mag alleen voorkomen in de uitleg dat het er niet staat.
      const treffers = tekst.split(woord).length - 1;
      const toegestaan = woord === "onvoldoende" ? 1 : 0;
      expect(treffers).toBeLessThanOrEqual(toegestaan);
    }
  });

  it("gebruikt de minimumdrempel voor het praktijkzorgsignaal echt", () => {
    expect(MINIMUM_AFNAMES_VOOR_SIGNAAL).toBe(4);
    // Drie afnames met tijdgegevens leveren nooit een signaal, hoe slecht ook.
    const snel = JSON.stringify({ a: 100, b: 100, c: 100, d: 100, e: 100, f: 100 });
    const rijen: AfnameVoorActiviteit[] = [1, 2, 3].map((i) => ({
      id: i,
      instrumentId: "t4p",
      voltooidOp: "2026-01-10",
      itemTijden: snel,
    }));
    const u = berekenActiviteit(rijen, {
      instrumentId: "t4p",
      peildatum: "2026-08-13",
      drempel: 6,
      vensterMaanden: 24,
    });
    expect(u.praktijkzorg.metTijdgegevens).toBe(3);
    expect(u.praktijkzorg.metVlag).toBe(3);
    expect(u.praktijkzorg.signaal).toBe(false);
  });

  it("zet het praktijkzorgsignaal wel bij vier gevlagde afnames", () => {
    const snel = JSON.stringify({ a: 100, b: 100, c: 100, d: 100, e: 100, f: 100 });
    const rijen: AfnameVoorActiviteit[] = [1, 2, 3, 4].map((i) => ({
      id: i,
      instrumentId: "t4p",
      voltooidOp: "2026-01-10",
      itemTijden: snel,
    }));
    const u = berekenActiviteit(rijen, {
      instrumentId: "t4p",
      peildatum: "2026-08-13",
      drempel: 6,
      vensterMaanden: 24,
    });
    expect(u.praktijkzorg.signaal).toBe(true);
    expect(u.praktijkzorg.aandeelMetVlag).toBe(1);
  });

  it("geeft geen praktijkzorgsignaal zonder tijdgegevens", () => {
    const u = berekenActiviteit(afnamesBinnen(9), {
      instrumentId: "t4p",
      peildatum: "2026-08-13",
      drempel: 6,
      vensterMaanden: 24,
    });
    expect(u.praktijkzorg.metTijdgegevens).toBe(0);
    expect(u.praktijkzorg.aandeelMetVlag).toBeNull();
    expect(u.praktijkzorg.signaal).toBe(false);
  });
});
