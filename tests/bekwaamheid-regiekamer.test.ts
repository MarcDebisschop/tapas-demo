// ---------------------------------------------------------------------------
// tests/bekwaamheid-regiekamer.test.ts
//
// Scherm 9.6, de regiekamer: de rekenkern eronder en de twee leeswegen erboven.
//
// De ICC is het enige getal in dit scherm dat niet met tellen te controleren is.
// Daarom is de kern ervan geijkt op een gepubliceerd voorbeeld en niet op een
// zelf uitgerekende verwachting: de zes-bij-vier matrix uit Shrout & Fleiss
// (1979), waarvoor in de literatuur ICC(2,1) = .29 staat. Een test die zijn
// verwachting uit dezelfde formule haalt als de code, toetst niets.
//
// De rest van de kern is bewust wél met de hand na te rekenen: tellingen per
// fase, dagen tussen twee datums, werkdagen over een weekend, aandelen. Elk
// grensgeval hieronder is gekozen omdat een plausibele maar verkeerde
// implementatie erop stukloopt:
//
//   - een verstreken venster bij een afgesloten ronde  -> mag NIET meetellen
//   - alle beoordelaars geven overal hetzelfde         -> GEEN ICC, niet 1,00
//   - meer verschil binnen dan tussen dossiers         -> negatieve ICC blijft
//   - een beoordelaar die één dossier oversloeg        -> die valt weg, niet het dossier
//   - een item dat uit de scoring is gehaald           -> geen tekort meer
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import {
  telRondesPerFase,
  vatAgendaSamen,
  dagenTussen,
  berekenIcc,
  iccPerBewijsstuk,
  grootsteVolledigeBlok,
  vindOnvolledigBeoordeeld,
  werkdagenTussen,
  meetProcesKpis,
  beoordeelItembank,
  NIET_GEMETEN,
  type RondeRegel,
  type AgendaRegel,
  type ScoreRegel,
} from "../server/bekwaamheid/regiekamer";
import { leesRegiekamer, registerRegiekamerRoutes } from "../server/bekwaamheid/routes-regiekamer";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import { RONDEFASEN, AGENDASOORTEN } from "../server/bekwaamheid/schema";
import { P_ONDERGRENS, P_BOVENGRENS } from "../server/bekwaamheid/itemanalyse";

// ---------------------------------------------------------------------------
// 1. Rondes per fase
// ---------------------------------------------------------------------------

function ronde(id: number, fase: string, vensterTot: string, instrument = "t4p-business"): RondeRegel {
  return { id, fase: fase as RondeRegel["fase"], soort: "bekrachtiging", instrumentId: instrument, vensterTot };
}

describe("rondes per fase", () => {
  it("geeft alle elf fasen terug, ook de lege", () => {
    const telling = telRondesPerFase([], "2026-08-14");
    expect(telling).toHaveLength(RONDEFASEN.length);
    expect(telling.map((t) => t.fase)).toEqual([...RONDEFASEN]);
    expect(telling.every((t) => t.aantal === 0 && t.vensterVerstreken === 0)).toBe(true);
  });

  it("telt per fase en houdt de orde van RONDEFASEN aan", () => {
    const telling = telRondesPerFase(
      [
        ronde(1, "open", "2026-12-31"),
        ronde(2, "open", "2026-12-31"),
        ronde(3, "beslist", "2026-12-31"),
      ],
      "2026-08-14",
    );
    expect(telling.find((t) => t.fase === "open")!.aantal).toBe(2);
    expect(telling.find((t) => t.fase === "beslist")!.aantal).toBe(1);
    expect(telling.find((t) => t.fase === "overleg")!.aantal).toBe(0);
  });

  it("meet het venster tegen de peildatum en niet tegen vandaag", () => {
    const rondes = [ronde(1, "open", "2026-06-30")];
    // Peildatum ná het venster: verstreken.
    expect(telRondesPerFase(rondes, "2026-08-14")[1].vensterVerstreken).toBe(1);
    // Peildatum vóór het venster: nog niet.
    expect(telRondesPerFase(rondes, "2026-06-01")[1].vensterVerstreken).toBe(0);
    // Peildatum precies op het venster: nog niet verstreken.
    expect(telRondesPerFase(rondes, "2026-06-30")[1].vensterVerstreken).toBe(0);
  });

  it("telt een verstreken venster niet mee bij een afgesloten of gestaakte ronde", () => {
    const telling = telRondesPerFase(
      [
        ronde(1, "afgesloten", "2020-01-01"),
        ronde(2, "gestaakt", "2020-01-01"),
        ronde(3, "in_beoordeling", "2020-01-01"),
      ],
      "2026-08-14",
    );
    expect(telling.find((t) => t.fase === "afgesloten")!.vensterVerstreken).toBe(0);
    expect(telling.find((t) => t.fase === "gestaakt")!.vensterVerstreken).toBe(0);
    // De lopende ronde met hetzelfde venster wél.
    expect(telling.find((t) => t.fase === "in_beoordeling")!.vensterVerstreken).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. De agenda
// ---------------------------------------------------------------------------

function post(id: number, soort: string, datum: string): AgendaRegel {
  return { id, geaccrediteerdeId: 1, instrumentId: "t4p-business", soort: soort as AgendaRegel["soort"], datum };
}

describe("de agenda samengevat", () => {
  it("geeft alle acht soorten terug, ook de lege", () => {
    const samenvatting = vatAgendaSamen([], "2026-08-14");
    expect(samenvatting).toHaveLength(AGENDASOORTEN.length);
    expect(samenvatting.map((s) => s.soort)).toEqual([...AGENDASOORTEN]);
    expect(samenvatting.every((s) => s.aantal === 0 && s.oudste === null && s.dagenOud === null)).toBe(
      true,
    );
  });

  it("houdt de oudste datum per soort aan, niet de eerste in de lijst", () => {
    const samenvatting = vatAgendaSamen(
      [
        post(1, "venster_sluit", "2026-08-01"),
        post(2, "venster_sluit", "2026-05-04"),
        post(3, "venster_sluit", "2026-07-15"),
      ],
      "2026-08-14",
    );
    const rij = samenvatting.find((s) => s.soort === "venster_sluit")!;
    expect(rij.aantal).toBe(3);
    expect(rij.oudste).toBe("2026-05-04");
    // 4 mei tot 14 augustus 2026: 27 + 30 + 31 + 14 = 102 dagen.
    expect(rij.dagenOud).toBe(102);
  });

  it("meet dagen over een maandgrens en over een jaargrens heen", () => {
    expect(dagenTussen("2026-08-14", "2026-08-14")).toBe(0);
    expect(dagenTussen("2026-02-28", "2026-03-01")).toBe(1); // 2026 is geen schrikkeljaar
    expect(dagenTussen("2024-02-28", "2024-03-01")).toBe(2); // 2024 wel
    expect(dagenTussen("2025-12-31", "2026-01-01")).toBe(1);
    expect(dagenTussen("2026-08-14", "2026-08-01")).toBe(-13); // omgekeerd: negatief
  });
});

// ---------------------------------------------------------------------------
// 3. De ICC
// ---------------------------------------------------------------------------

/**
 * De matrix uit Shrout & Fleiss (1979), zes doelen bij vier beoordelaars.
 * Gepubliceerde uitkomsten: ICC(1,1) = .17, ICC(2,1) = .29, ICC(3,1) = .71.
 * Alleen de tweede hoort hier uit te komen.
 */
const SHROUT_FLEISS = [
  [9, 2, 5, 8],
  [6, 1, 3, 2],
  [8, 4, 6, 8],
  [7, 1, 2, 6],
  [10, 5, 6, 9],
  [6, 2, 4, 7],
];

describe("de ICC", () => {
  it("reproduceert de gepubliceerde ICC(2,1) van .29", () => {
    const uit = berekenIcc(SHROUT_FLEISS);
    expect(uit.icc).toBeCloseTo(0.2898, 4);
    expect(uit.dossiers).toBe(6);
    expect(uit.beoordelaars).toBe(4);
    expect(uit.reden).toBeNull();
  });

  it("is niet de consistentievorm ICC(3,1) en niet ICC(1,1)", () => {
    const uit = berekenIcc(SHROUT_FLEISS);
    // Zou de code de consistentievorm rekenen, dan stond hier .71; zou ze de
    // eenwegvorm rekenen, dan .17. Beide zijn hier fout.
    expect(uit.icc).not.toBeCloseTo(0.7148, 2);
    expect(uit.icc).not.toBeCloseTo(0.1657, 2);
  });

  it("reproduceert het gepubliceerde 95%-interval van .02 tot .76", () => {
    // Geijkt op pingouin 0.6.1, dat op deze matrix ICC(A,1) = 0,289764 met
    // CI95% [0.02, 0.76] geeft. De ijking is onafhankelijk: die bibliotheek is
    // een andere implementatie van dezelfde formules van McGraw & Wong (1996).
    const uit = berekenIcc(SHROUT_FLEISS);
    expect(uit.intervalGemeten).toBe(true);
    expect(uit.onder).not.toBeNull();
    expect(uit.boven).not.toBeNull();
    expect(uit.onder!).toBeCloseTo(0.018787, 5);
    expect(uit.boven!).toBeCloseTo(0.761084, 5);
    expect(uit.intervalReden).toBeNull();
  });

  it("noemt de norm onbeslist wanneer .75 binnen het interval valt", () => {
    // Dit is het geval van de gepubliceerde matrix: de puntschatting is .29,
    // maar de bovengrens ligt boven .75. Er is dus te weinig gemeten om te
    // zeggen dat de norm niet gehaald is. "Onbeslist" mag hier nooit als
    // "niet gehaald" op het scherm komen.
    expect(berekenIcc(SHROUT_FLEISS).normbeeld).toBe("onbeslist");
  });

  it("noemt de norm gehaald zodra de ondergrens op of boven .75 ligt", () => {
    const uit = berekenIcc([
      [1, 1],
      [3, 3],
      [5, 5],
      [7, 7],
    ]);
    expect(uit.icc).toBeCloseTo(1, 6);
    expect(uit.onder).toBe(1);
    expect(uit.boven).toBe(1);
    expect(uit.normbeeld).toBe("gehaald");
  });

  it("laat het interval weg zodra de ICC nul of negatief is", () => {
    // De formules van McGraw & Wong veronderstellen een positieve ICC. Bij nul
    // of lager is er geen ondergrens te berekenen, en dus mag de norm van §13.1
    // niet beoordeeld worden. De puntschatting blijft wel staan.
    const uit = berekenIcc([
      [1, 5],
      [5, 1],
      [3, 3],
    ]);
    expect(uit.icc!).toBeCloseTo(-3, 6);
    expect(uit.intervalGemeten).toBe(false);
    expect(uit.onder).toBeNull();
    expect(uit.normbeeld).toBeNull();
    expect(uit.intervalReden).toMatch(/negatief/);
  });

  it("meldt bij te weinig data geen interval en dus geen normoordeel", () => {
    // De belangrijkste eigenschap van de hele indicator: een leeg scherm zegt
    // "te weinig dossiers" en niet "de norm is niet gehaald".
    for (const matrix of [[], [[3, 4, 5]], [[3], [4], [5]]]) {
      const uit = berekenIcc(matrix);
      expect(uit.icc).toBeNull();
      expect(uit.normbeeld).toBeNull();
      expect(uit.intervalGemeten).toBe(false);
      expect(uit.reden).not.toBeNull();
    }
  });

  it("weigert minder dan drie dossiers", () => {
    // Rekenkundig kan het bij twee dossiers ook, maar dan hangt het getal aan
    // één vergelijking en sluit het interval niets uit.
    const uit = berekenIcc([
      [3, 4],
      [4, 5],
    ]);
    expect(uit.icc).toBeNull();
    expect(uit.reden).toMatch(/3 dossiers/);
  });

  it("weigert minder dan twee beoordelaars", () => {
    const uit = berekenIcc([[3], [4], [5]]);
    expect(uit.icc).toBeNull();
    expect(uit.reden).toMatch(/2 beoordelaars/);
  });

  it("weigert een onvolledige matrix in plaats van er een gat in te rekenen", () => {
    const uit = berekenIcc([
      [3, 4],
      [4, 5],
      [5],
    ]);
    expect(uit.icc).toBeNull();
    expect(uit.reden).toMatch(/niet volledig/);
  });

  it("meldt geen 1,00 wanneer alle scores gelijk zijn", () => {
    const uit = berekenIcc([
      [4, 4],
      [4, 4],
      [4, 4],
    ]);
    expect(uit.icc).toBeNull();
    expect(uit.reden).toMatch(/geen variantie/);
  });

  it("laat een negatieve ICC staan in plaats van hem op nul te kappen", () => {
    // Drie dossiers waarin de beoordelaars elkaar tegenspreken: het verschil
    // binnen een dossier is groter dan dat tussen de dossiers.
    const uit = berekenIcc([
      [1, 5],
      [5, 1],
      [3, 3],
    ]);
    expect(uit.icc).not.toBeNull();
    expect(uit.icc!).toBeCloseTo(-3, 6);
  });

  it("weigert de gespiegelde matrix met nul-noemer al op de dossierdrempel", () => {
    // Twee dossiers, volledig gespiegeld: rij- en kolomgemiddelden vallen samen
    // en de noemer van ICC(2,1) wordt exact nul. Sinds de dossierdrempel op drie
    // staat, wordt deze matrix eerder geweigerd en komt de noemercheck er niet
    // meer aan te pas.
    //
    // Die check blijft wel staan. Een uitputtende zoektocht over alle matrices
    // met waarden 1 tot 6 bij drie dossiers en twee beoordelaars, en over 1 tot 4
    // bij vier bij twee en drie bij drie, leverde geen enkele nul-noemer op.
    // "Niet gevonden in die ruimte" is geen bewijs van onmogelijkheid, dus de
    // deling door nul blijft afgeschermd.
    const uit = berekenIcc([
      [1, 5],
      [5, 1],
    ]);
    expect(uit.icc).toBeNull();
    expect(uit.reden).toMatch(/3 dossiers/);
  });
});

// ---------------------------------------------------------------------------
// 4. ICC per bewijsstuknummer
// ---------------------------------------------------------------------------

function score(
  bewijsstukId: number,
  nummer: number,
  beoordelaarId: number,
  waarde: number,
  onderdeel = "geheel",
  isKalibratie = false,
): ScoreRegel {
  return {
    bewijsstukId,
    bewijsstukNummer: nummer,
    beoordelaarId,
    onderdeel,
    score: waarde,
    isKalibratie,
  };
}

describe("de ICC per bewijsstuknummer", () => {
  it("groepeert per nummer en niet per dossier", () => {
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2),
      score(12, 1, 2, 3),
      score(13, 1, 1, 7),
      score(13, 1, 2, 6),
      score(21, 2, 1, 4),
      score(21, 2, 2, 4),
      score(22, 2, 1, 1),
      score(22, 2, 2, 2),
      score(23, 2, 1, 8),
      score(23, 2, 2, 7),
    ]);
    expect(uit.map((r) => r.bewijsstukNummer)).toEqual([1, 2]);
    expect(uit[0].uitkomst.dossiers).toBe(3);
    expect(uit[0].uitkomst.beoordelaars).toBe(2);
  });

  it("rapporteert de dekkingsgraad ook wanneer de matrix volledig is", () => {
    // Een volledige matrix hoort dekkingsgraad 1 en nul ontbrekende cellen te
    // melden. Dat getal staat er altijd bij, juist opdat de lezer niet hoeft te
    // raden of het ontbreken van een melding "volledig" of "niet gekeken" betekent.
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2),
      score(12, 1, 2, 3),
      score(13, 1, 1, 7),
      score(13, 1, 2, 6),
    ]);
    expect(uit[0].dekkingsgraad).toBe(1);
    expect(uit[0].ontbrekendeCellen).toBe(0);
    expect(uit[0].beoordelaarsAfgevallen).toBe(0);
    expect(uit[0].dossiersAfgevallen).toBe(0);
  });

  it("neemt per cel het gemiddelde over de onderdelen", () => {
    // Beoordelaar 1 geeft 2 en 6 op dossier 11: cel = 4. Beoordelaar 2 geeft 4.
    // Dossier 12 krijgt van beiden 1. Dan is er tussenvariantie en geen residu:
    // de ICC hoort 1,00 te zijn.
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 2, "inhoud"),
      score(11, 1, 1, 6, "vorm"),
      score(11, 1, 2, 4, "inhoud"),
      score(12, 1, 1, 1, "inhoud"),
      score(12, 1, 2, 1, "inhoud"),
      score(13, 1, 1, 7, "inhoud"),
      score(13, 1, 2, 7, "inhoud"),
    ]);
    expect(uit[0].uitkomst.icc).toBeCloseTo(1, 6);
  });

  it("kiest het grootste volledige blok in cellen en niet een vaste schiftorde", () => {
    // Vier dossiers, drie beoordelaars, één gat: beoordelaar 3 sloeg dossier 14
    // over. De oude vaste orde gooide eerst beoordelaar 3 weg en hield 4 × 2 = 8
    // cellen over. Het grootste volledige blok is 3 × 3 = 9 cellen: dossier 14
    // valt weg en beoordelaar 3 blijft. Nagerekend op deze scores geeft de oude
    // orde ICC 0,9143 en de nieuwe 0,9268.
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(11, 1, 3, 4),
      score(12, 1, 1, 2),
      score(12, 1, 2, 3),
      score(12, 1, 3, 2),
      score(13, 1, 1, 8),
      score(13, 1, 2, 7),
      score(13, 1, 3, 8),
      score(14, 1, 1, 6),
      score(14, 1, 2, 6),
    ]);
    expect(uit[0].uitkomst.dossiers).toBe(3);
    expect(uit[0].uitkomst.beoordelaars).toBe(3);
    expect(uit[0].dossiersAfgevallen).toBe(1);
    expect(uit[0].beoordelaarsAfgevallen).toBe(0);
    // Één gat op twaalf mogelijke cellen.
    expect(uit[0].ontbrekendeCellen).toBe(1);
    expect(uit[0].dekkingsgraad).toBeCloseTo(11 / 12, 6);
  });

  it("houdt een ICC over waar de oude schiftorde er geen meer overhield", () => {
    // Drie dossiers, twee beoordelaars; beoordelaar 2 sloeg dossier 14 over. Onder
    // de vaste orde viel beoordelaar 2 weg, bleef er één beoordelaar over en was
    // er geen getal meer. Nu valt dossier 14 weg en blijft er een blok van drie
    // bij twee — precies de fragiliteit die deze wijziging wegneemt.
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2),
      score(12, 1, 2, 3),
      score(13, 1, 1, 8),
      score(13, 1, 2, 7),
      score(14, 1, 1, 3),
    ]);
    expect(uit[0].uitkomst.icc).not.toBeNull();
    expect(uit[0].uitkomst.dossiers).toBe(3);
    expect(uit[0].uitkomst.beoordelaars).toBe(2);
    expect(uit[0].dossiersAfgevallen).toBe(1);
    expect(uit[0].ontbrekendeCellen).toBe(1);
  });

  it("laat bij gelijk aantal cellen het blok met meer dossiers winnen", () => {
    // Vier dossiers, twee beoordelaars, twee gaten die elkaar spiegelen. Er zijn
    // twee volledige blokken van zes cellen mogelijk: 3 × 2 en — als één
    // beoordelaar wegvalt — niets bruikbaars. De regel zegt: meer dossiers wint.
    const { dossiers, beoordelaars } = grootsteVolledigeBlok(
      [1, 2, 3, 4],
      [1, 2],
      (d, b) => !(d === 4 && b === 2),
    );
    expect(dossiers).toEqual([1, 2, 3]);
    expect(beoordelaars).toEqual([1, 2]);
  });

  it("geeft een leeg blok wanneer geen enkele cel gevuld is", () => {
    const uit = grootsteVolledigeBlok([1, 2], [1, 2], () => false);
    expect(uit.dossiers).toEqual([]);
  });

  it("kiest hetzelfde blok ongeacht de volgorde van de invoer", () => {
    // Determinisme is de voorwaarde om het getal te mogen rapporteren.
    const gat = (d: number, b: number) => !(d === 3 && b === 2);
    const eerste = grootsteVolledigeBlok([1, 2, 3], [1, 2, 3], gat);
    const tweede = grootsteVolledigeBlok([3, 1, 2], [3, 2, 1], gat);
    expect(tweede).toEqual(eerste);
  });

  it("telt de kalibratiescores in het gebruikte blok", () => {
    const uit = iccPerBewijsstuk([
      score(11, 1, 1, 4, "geheel", true),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2, "geheel", true),
      score(12, 1, 2, 3),
      score(13, 1, 1, 8),
      score(13, 1, 2, 7),
      // Buiten het blok: beoordelaar 9 keek maar naar één dossier en valt weg.
      score(11, 1, 9, 5, "geheel", true),
    ]);
    expect(uit[0].kalibratieScores).toBe(2);
  });

  it("zet elk bewijsstuk met gaten op de lijst onvolledig beoordeeld", () => {
    // De melding verhuist: onvolledigheid is een procesfeit en hoort niet in het
    // wegvallen van de ICC verstopt te zitten. Bewijsstuk 1 heeft een gat en een
    // ICC; bewijsstuk 2 is volledig en hoort er niet bij te staan.
    const icc = iccPerBewijsstuk([
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2),
      score(12, 1, 2, 3),
      score(13, 1, 1, 8),
      score(13, 1, 2, 7),
      score(14, 1, 1, 3),
      score(21, 2, 1, 4),
      score(21, 2, 2, 4),
      score(22, 2, 1, 1),
      score(22, 2, 2, 2),
      score(23, 2, 1, 8),
      score(23, 2, 2, 7),
    ]);
    const lijst = vindOnvolledigBeoordeeld(icc);
    expect(lijst).toHaveLength(1);
    expect(lijst[0].bewijsstukNummer).toBe(1);
    expect(lijst[0].ontbrekendeCellen).toBe(1);
    expect(lijst[0].iccBerekend).toBe(true);
    expect(lijst[0].dekkingsgraad).toBeCloseTo(7 / 8, 6);
  });

  it("zet het slechtst bekeken bewijsstuk bovenaan", () => {
    const icc = iccPerBewijsstuk([
      // Nummer 1: één gat op vier cellen.
      score(11, 1, 1, 4),
      score(11, 1, 2, 5),
      score(12, 1, 1, 2),
      // Nummer 2: drie gaten op zes cellen.
      score(21, 2, 1, 4),
      score(22, 2, 1, 1),
      score(23, 2, 2, 8),
    ]);
    const lijst = vindOnvolledigBeoordeeld(icc);
    expect(lijst.map((r) => r.bewijsstukNummer)).toEqual([2, 1]);
    expect(lijst[0].dekkingsgraad).toBeCloseTo(0.5, 6);
    expect(lijst[0].iccBerekend).toBe(false);
  });

  it("geeft een lege lijst onvolledig beoordeeld wanneer er geen scores zijn", () => {
    expect(vindOnvolledigBeoordeeld([])).toEqual([]);
  });

  it("geeft een lege lijst wanneer er geen scores zijn", () => {
    expect(iccPerBewijsstuk([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Werkdagen en de termijnen
// ---------------------------------------------------------------------------

describe("werkdagen tussen twee datums", () => {
  it("telt de begindag niet en de einddag wel", () => {
    // Maandag 10 augustus 2026 tot dinsdag 11 augustus: één werkdag.
    expect(werkdagenTussen("2026-08-10", "2026-08-11")).toBe(1);
    expect(werkdagenTussen("2026-08-10", "2026-08-10")).toBe(0);
  });

  it("slaat het weekend over", () => {
    // Vrijdag 14 augustus 2026 tot maandag 17 augustus: één werkdag.
    expect(werkdagenTussen("2026-08-14", "2026-08-17")).toBe(1);
    // Maandag tot maandag een week later: vijf werkdagen.
    expect(werkdagenTussen("2026-08-10", "2026-08-17")).toBe(5);
  });

  it("geeft nul terug wanneer de einddatum niet later is", () => {
    expect(werkdagenTussen("2026-08-17", "2026-08-10")).toBe(0);
  });
});

describe("de KPI's van het proces", () => {
  it("meet niets en meldt niets wanneer er geen dossiers zijn", () => {
    const kpi = meetProcesKpis({ debriefs: [], publicaties: [], bezwaren: [] });
    for (const rij of [kpi.debrief, kpi.publicatie, kpi.bezwaar]) {
      expect(rij.gemeten).toBe(0);
      expect(rij.aandeel).toBeNull();
      expect(rij.buiten).toEqual([]);
      expect(rij.nogOpen).toBe(0);
      expect(rij.norm.length).toBeGreaterThan(10);
    }
  });

  it("meldt feestdagen bij de werkdagentermijnen en niet bij de kalendertermijn", () => {
    // De debrief en de publicatie lopen in werkdagen en houden dus rekening met
    // de tien Belgische feestdagen. De bezwaartermijn loopt in kalenderdagen en
    // raakt ze per definitie niet. Zou deze vlag ook bij het bezwaar op waar
    // staan, dan zou het scherm een correctie beweren die er niet is.
    const kpi = meetProcesKpis({ debriefs: [], publicaties: [], bezwaren: [] });
    expect(kpi.debrief.feestdagen).toBe(true);
    expect(kpi.publicatie.feestdagen).toBe(true);
    expect(kpi.bezwaar.feestdagen).toBe(false);
  });

  it("meldt nergens dat vervangingsdagen verwerkt zijn", () => {
    // Een vervangingsdag wordt per onderneming collectief vastgelegd en is niet
    // te berekenen. Deze vlag hoort dus altijd op onwaar te staan.
    const kpi = meetProcesKpis({ debriefs: [], publicaties: [], bezwaren: [] });
    for (const rij of [kpi.debrief, kpi.publicatie, kpi.bezwaar]) {
      expect(rij.vervangingsdagen).toBe(false);
    }
  });

  it("scheidt binnen, buiten en nog open", () => {
    const kpi = meetProcesKpis({
      debriefs: [
        // 3 augustus (ma) tot 14 augustus (vr) 2026: 9 werkdagen, binnen de tien.
        { rondeId: 1, laatsteOnderdeelOp: "2026-08-03", debriefOp: "2026-08-14" },
        // 3 augustus tot 18 augustus (di): 11 werkdagen, buiten.
        { rondeId: 2, laatsteOnderdeelOp: "2026-08-03", debriefOp: "2026-08-18" },
        // Nog geen debrief.
        { rondeId: 3, laatsteOnderdeelOp: "2026-08-03", debriefOp: null },
        // Geen begindatum: niet meetbaar, en ook niet "nog open".
        { rondeId: 4, laatsteOnderdeelOp: null, debriefOp: null },
      ],
      publicaties: [],
      bezwaren: [],
    });
    expect(kpi.debrief.gemeten).toBe(2);
    expect(kpi.debrief.binnen).toBe(1);
    expect(kpi.debrief.buiten).toEqual([2]);
    expect(kpi.debrief.nogOpen).toBe(1);
    expect(kpi.debrief.aandeel).toBeCloseTo(0.5, 6);
  });

  it("meet de publicatie in werkdagen en het bezwaar in kalenderdagen", () => {
    const kpi = meetProcesKpis({
      debriefs: [],
      publicaties: [
        // Vrijdag 14 tot woensdag 19 augustus 2026: 3 werkdagen, precies op de grens.
        { beslissingId: 1, debriefOp: "2026-08-14", gepubliceerdOp: "2026-08-19" },
        // Vrijdag 14 tot donderdag 20 augustus: 4 werkdagen, buiten.
        { beslissingId: 2, debriefOp: "2026-08-14", gepubliceerdOp: "2026-08-20" },
      ],
      bezwaren: [
        // Precies 30 kalenderdagen: binnen.
        { bezwaarId: 1, ingediendOp: "2026-07-15", uitspraakOp: "2026-08-14" },
        // 31 dagen: buiten. Zou hier in werkdagen gerekend worden, dan haalde
        // dit dossier de norm en dat is de fout die deze regel afdekt.
        { bezwaarId: 2, ingediendOp: "2026-07-14", uitspraakOp: "2026-08-14" },
      ],
    });
    expect(kpi.publicatie.buiten).toEqual([2]);
    expect(kpi.bezwaar.binnen).toBe(1);
    expect(kpi.bezwaar.buiten).toEqual([2]);
  });
});

// ---------------------------------------------------------------------------
// 6. De itembank
// ---------------------------------------------------------------------------

describe("de itembank tegen sectie 13.1", () => {
  it("gebruikt de grenzen uit de itemanalyse en verzint er geen tweede", () => {
    const kpi = beoordeelItembank([]);
    expect(kpi.pOndergrens).toBe(P_ONDERGRENS);
    expect(kpi.pBovengrens).toBe(P_BOVENGRENS);
    expect(kpi.items).toBe(0);
    expect(kpi.aandeelBuitenBereik).toBeNull();
  });

  it("kijkt alleen naar actieve items", () => {
    const kpi = beoordeelItembank([
      { id: 1, pWaarde: 0.1, discriminatie: -0.4, actief: false },
      { id: 2, pWaarde: 0.6, discriminatie: 0.3, actief: true },
    ]);
    expect(kpi.items).toBe(1);
    expect(kpi.buitenBereik).toEqual([]);
    expect(kpi.negatieveDiscriminatie).toEqual([]);
  });

  it("legt de grens bij de grens: erop is binnen, eronder is buiten", () => {
    const kpi = beoordeelItembank([
      { id: 1, pWaarde: P_ONDERGRENS, discriminatie: null, actief: true },
      { id: 2, pWaarde: P_BOVENGRENS, discriminatie: null, actief: true },
      { id: 3, pWaarde: P_ONDERGRENS - 0.01, discriminatie: null, actief: true },
      { id: 4, pWaarde: P_BOVENGRENS + 0.01, discriminatie: null, actief: true },
    ]);
    expect(kpi.buitenBereik).toEqual([3, 4]);
    expect(kpi.aandeelBuitenBereik).toBeCloseTo(0.5, 6);
  });

  it("rekent het aandeel over de items met p-waarde en niet over de hele bank", () => {
    const kpi = beoordeelItembank([
      { id: 1, pWaarde: 0.1, discriminatie: null, actief: true },
      { id: 2, pWaarde: 0.6, discriminatie: null, actief: true },
      { id: 3, pWaarde: null, discriminatie: null, actief: true },
      { id: 4, pWaarde: null, discriminatie: null, actief: true },
    ]);
    expect(kpi.items).toBe(4);
    expect(kpi.metPWaarde).toBe(2);
    expect(kpi.aandeelBuitenBereik).toBeCloseTo(0.5, 6);
  });

  it("noemt de items met een negatieve item-restcorrelatie bij nummer", () => {
    const kpi = beoordeelItembank([
      { id: 7, pWaarde: 0.5, discriminatie: -0.02, actief: true },
      { id: 8, pWaarde: 0.5, discriminatie: 0, actief: true },
      { id: 9, pWaarde: 0.5, discriminatie: null, actief: true },
    ]);
    expect(kpi.negatieveDiscriminatie).toEqual([7]);
  });
});

// ---------------------------------------------------------------------------
// 7. Wat niet gemeten wordt
// ---------------------------------------------------------------------------

describe("de lijst van niet gemeten indicatoren", () => {
  it("noemt acht indicatoren, elk met een sectieverwijzing en een reden", () => {
    expect(NIET_GEMETEN).toHaveLength(8);
    for (const rij of NIET_GEMETEN) {
      expect(rij.indicator).toMatch(/§13/);
      expect(rij.waarom.length).toBeGreaterThan(20);
    }
  });

  it("noemt de vervangingsdagen voor feestdagen als eerste post", () => {
    // Het betrouwbaarheidsinterval stónd hier; dat wordt nu berekend en is dus
    // van de lijst gehaald. Wat overblijft is de vervangingsdag: die wordt per
    // onderneming collectief vastgelegd en is niet uit een kalender te leiden.
    expect(NIET_GEMETEN[0].indicator).toMatch(/vervangingsdag/i);
  });

  it("noemt het betrouwbaarheidsinterval niet meer, want dat wordt gemeten", () => {
    for (const rij of NIET_GEMETEN) {
      expect(rij.indicator).not.toMatch(/betrouwbaarheidsinterval/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Het beeld uit de databank
// ---------------------------------------------------------------------------

const MIGRATIES = ["0006_bekwaamheid", "0007_beslisuitkomsten", "0008_itemblokken"]
  .map((naam) => readFileSync(`migrations/${naam}.sql`, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

const ONDERBOUWING =
  "De cesuur volgt de Angoff-schatting van het panel van vier beoordelaars, " +
  "afgerond naar beneden op het eerstvolgende veelvoud van vijf procentpunt. " +
  "De asdrempel van zestig procent komt uit de spreiding van de nulmeting; " +
  "de totaaldrempel van zeventig procent uit de tweede ronde van het panel.";

const SCORE_ONDERBOUWING =
  "De kandidaat benoemt de versnellers en verbindt ze aan de gedragsvoorbeelden uit het gesprek.";

function proefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE beheerders (id INTEGER PRIMARY KEY, naam TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY,
      aangemaakt_door_beheerder_id INTEGER,
      instrument_id TEXT,
      status TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE stm_sessies (
      id INTEGER PRIMARY KEY,
      beheerder_id INTEGER,
      afgerond_at TEXT,
      score_totaal REAL,
      scores_per_laag TEXT
    );
  `);
  db.exec(MIGRATIES);
  db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (1, 'Marc Debisschop', 'marc@tapascity.com')").run();
  db.prepare(
    `INSERT INTO bekwaamheid_geaccrediteerden (id, beheerder_id, naam, email, created_at, updated_at)
     VALUES (1, 1, 'Proefpersoon een', 'een@voorbeeld.be', '2026-01-01', '2026-01-01'),
            (2, NULL, 'Proefpersoon twee', 'twee@voorbeeld.be', '2026-01-01', '2026-01-01'),
            (3, NULL, 'Proefpersoon drie', 'drie@voorbeeld.be', '2026-01-01', '2026-01-01')`,
  ).run();
  for (const [id, instrument] of [
    [1, "t4p-business"],
    [2, "t4p-teens"],
  ] as Array<[number, string]>) {
    db.prepare(
      `INSERT INTO bekwaamheid_normprofielen
         (id, instrument_id, versie, weging, drempel_totaal, drempel_per_as, activiteitsdrempel,
          activiteitsvenster_maanden, methode, paneel_omschrijving, vastgesteld_op, vastgesteld_door, onderbouwing)
       VALUES (?, ?, 1, ?, 0.7, ?, 6, 24, 'angoff', 'vier beoordelaars', '2026-01-01', 'Marc', ?)`,
    ).run(
      id,
      instrument,
      JSON.stringify({ weten: 0.2, zien: 0.3, zeggen: 0.3, zorgen: 0.2 }),
      JSON.stringify({ weten: 0.6, zien: 0.6, zeggen: 0.6, zorgen: 0.6 }),
      ONDERBOUWING,
    );
  }
  return db;
}

/** Legt een ronde neer en geeft het id terug. */
function zetRonde(
  db: Database.Database,
  id: number,
  opties: { instrument?: string; fase?: string; vensterTot?: string; persoon?: number } = {},
): number {
  const instrument = opties.instrument ?? "t4p-business";
  db.prepare(
    `INSERT INTO bekwaamheid_rondes
       (id, geaccrediteerde_id, instrument_id, normprofiel_id, soort, codenummer, fase, geopend_op, venster_tot)
     VALUES (?, ?, ?, ?, 'bekrachtiging', ?, ?, '2026-01-05', ?)`,
  ).run(
    id,
    opties.persoon ?? 1,
    instrument,
    instrument === "t4p-business" ? 1 : 2,
    `R-${id}`,
    opties.fase ?? "open",
    opties.vensterTot ?? "2026-12-31",
  );
  return id;
}

describe("het beeld uit de databank", () => {
  let db: Database.Database;
  let opslag: ReturnType<typeof maakBekwaamheidOpslag>;

  beforeEach(() => {
    db = proefdatabank();
    opslag = maakBekwaamheidOpslag(db, () => {});
  });

  it("geeft een volledig beeld op een lege databank", () => {
    const beeld = leesRegiekamer("2026-08-14", null, opslag);
    expect(beeld.peildatum).toBe("2026-08-14");
    expect(beeld.rondes).toHaveLength(RONDEFASEN.length);
    expect(beeld.agenda).toHaveLength(AGENDASOORTEN.length);
    expect(beeld.icc).toEqual([]);
    expect(beeld.itembank.items).toBe(0);
    expect(beeld.nietGemeten).toHaveLength(8);
    // Het scherm mag op een lege bank geen aandeel van 100% laten zien.
    expect(beeld.proces.debrief.aandeel).toBeNull();
  });

  it("leest de rondes met hun fase en venster", () => {
    zetRonde(db, 1, { fase: "open", vensterTot: "2026-06-30" });
    zetRonde(db, 2, { fase: "beslist" });
    const beeld = leesRegiekamer("2026-08-14", null, opslag);
    expect(beeld.rondes.find((r) => r.fase === "open")!.aantal).toBe(1);
    expect(beeld.rondes.find((r) => r.fase === "open")!.vensterVerstreken).toBe(1);
    expect(beeld.rondes.find((r) => r.fase === "beslist")!.aantal).toBe(1);
  });

  it("filtert op instrument via de ronde en niet via een tweede kolom", () => {
    zetRonde(db, 1, { instrument: "t4p-business" });
    zetRonde(db, 2, { instrument: "t4p-teens" });
    const alles = leesRegiekamer("2026-08-14", null, opslag);
    const alleen = leesRegiekamer("2026-08-14", "t4p-teens", opslag);
    expect(alles.rondes.find((r) => r.fase === "open")!.aantal).toBe(2);
    expect(alleen.rondes.find((r) => r.fase === "open")!.aantal).toBe(1);
  });

  it("neemt de openstaande agenda over en filtert die op instrument", () => {
    opslag.agenda.zetNeer({
      geaccrediteerdeId: 1,
      instrumentId: "t4p-business",
      soort: "venster_sluit",
      datum: "2026-08-01",
    });
    opslag.agenda.zetNeer({
      geaccrediteerdeId: 2,
      instrumentId: "t4p-teens",
      soort: "venster_sluit",
      datum: "2026-07-01",
    });
    // Nog niet aan de orde op de peildatum: hoort er niet in.
    opslag.agenda.zetNeer({
      geaccrediteerdeId: 1,
      instrumentId: "t4p-business",
      soort: "bezwaartermijn",
      datum: "2026-09-30",
    });

    const alles = leesRegiekamer("2026-08-14", null, opslag);
    const venster = alles.agenda.find((a) => a.soort === "venster_sluit")!;
    expect(venster.aantal).toBe(2);
    expect(venster.oudste).toBe("2026-07-01");
    expect(alles.agenda.find((a) => a.soort === "bezwaartermijn")!.aantal).toBe(0);

    const alleen = leesRegiekamer("2026-08-14", "t4p-business", opslag);
    expect(alleen.agenda.find((a) => a.soort === "venster_sluit")!.aantal).toBe(1);
    expect(alleen.agenda.find((a) => a.soort === "venster_sluit")!.oudste).toBe("2026-08-01");
  });

  it("berekent de ICC over de scores achter twee rondes heen", () => {
    // Drie rondes, want een bewijsstuknummer mag maar één keer per ronde bestaan.
    // Dat is precies waarom de ICC over rondes heen moet worden berekend: één
    // ronde levert nooit genoeg dossiers voor hetzelfde nummer.
    zetRonde(db, 1);
    zetRonde(db, 2, { persoon: 2 });
    zetRonde(db, 3, { persoon: 3 });
    const stuk = db.prepare(
      `INSERT INTO bekwaamheid_bewijsstukken (id, ronde_id, nummer, "as", weging, status, ingeleverd_op)
       VALUES (?, ?, 1, 'zien', 0.3, 'beoordeeld', ?)`,
    );
    stuk.run(11, 1, "2026-03-02");
    stuk.run(21, 2, "2026-03-02");
    stuk.run(31, 3, "2026-03-02");
    const invoer = db.prepare(
      `INSERT INTO bekwaamheid_scores (bewijsstuk_id, beoordelaar_id, onderdeel, score, onderbouwing, ingevoerd_op)
       VALUES (?, ?, 'geheel', ?, ?, '2026-03-05')`,
    );
    invoer.run(11, 1, 4, SCORE_ONDERBOUWING);
    invoer.run(11, 2, 4, SCORE_ONDERBOUWING);
    invoer.run(21, 1, 1, SCORE_ONDERBOUWING);
    invoer.run(21, 2, 1, SCORE_ONDERBOUWING);
    invoer.run(31, 1, 7, SCORE_ONDERBOUWING);
    invoer.run(31, 2, 7, SCORE_ONDERBOUWING);

    const beeld = leesRegiekamer("2026-08-14", null, opslag);
    expect(beeld.icc).toHaveLength(1);
    expect(beeld.icc[0].bewijsstukNummer).toBe(1);
    // Drie dossiers uit drie rondes, allemaal met bewijsstuknummer 1.
    expect(beeld.icc[0].uitkomst.dossiers).toBe(3);
    expect(beeld.icc[0].uitkomst.icc).toBeCloseTo(1, 6);
    // Volledige overeenstemming: het interval is het punt zelf en de norm van
    // §13.1 is gehaald.
    expect(beeld.icc[0].uitkomst.intervalGemeten).toBe(true);
    expect(beeld.icc[0].uitkomst.normbeeld).toBe("gehaald");
    // Volledig beoordeeld, dus niets op de lijst met gaten.
    expect(beeld.onvolledigBeoordeeld).toEqual([]);
  });

  it("neemt de jongste inleverdatum als begin van de debrieftermijn", () => {
    zetRonde(db, 1);
    const stuk = db.prepare(
      `INSERT INTO bekwaamheid_bewijsstukken (id, ronde_id, nummer, "as", weging, status, ingeleverd_op, beoordeeld_op)
       VALUES (?, 1, ?, 'zien', 0.3, 'beoordeeld', ?, ?)`,
    );
    // Twee onderdelen; het tweede is later ingeleverd. De termijn hoort vanaf
    // 3 augustus te lopen en niet vanaf 1 juli, en ook niet vanaf beoordeeld_op.
    stuk.run(11, 1, "2026-07-01", "2026-07-02");
    stuk.run(12, 2, "2026-08-03", "2026-08-04");
    db.prepare(
      `INSERT INTO bekwaamheid_beslissingen
         (id, ronde_id, voorstel_uitkomst, voorstel_berekening, definitieve_uitkomst,
          bekrachtiger_een_id, bekrachtiger_twee_id, bekrachtigd_op, debrief_op, gepubliceerd_op)
       VALUES (1, 1, 'bekrachtigd', '{}', 'bekrachtigd', 1, 2, '2026-08-12', '2026-08-14', '2026-08-19')`,
    ).run();

    const beeld = leesRegiekamer("2026-08-14", null, opslag);
    // 3 augustus (ma) tot 14 augustus (vr): 9 werkdagen, binnen de tien.
    expect(beeld.proces.debrief.gemeten).toBe(1);
    expect(beeld.proces.debrief.buiten).toEqual([]);
    // Debrief 14 augustus tot publicatie 19 augustus: 3 werkdagen, op de grens.
    expect(beeld.proces.publicatie.gemeten).toBe(1);
    expect(beeld.proces.publicatie.buiten).toEqual([]);
  });

  it("meet het bezwaar in kalenderdagen en houdt een openstaand bezwaar apart", () => {
    zetRonde(db, 1, { fase: "bezwaar" });
    zetRonde(db, 2, { fase: "bezwaar", persoon: 2 });
    const bezwaar = db.prepare(
      `INSERT INTO bekwaamheid_bezwaren (id, ronde_id, ingediend_op, grond, uitspraak_op, uitspraak, uitspraak_motivering)
       VALUES (?, ?, ?, 'De weging van het derde bewijsstuk is verkeerd toegepast.', ?, ?, ?)`,
    );
    bezwaar.run(1, 1, "2026-06-01", "2026-07-20", "ongegrond", "De weging volgt het bevroren normprofiel.");
    bezwaar.run(2, 2, "2026-08-01", null, null, null);

    const beeld = leesRegiekamer("2026-08-14", null, opslag);
    // 1 juni tot 20 juli: 49 dagen, buiten de dertig.
    expect(beeld.proces.bezwaar.gemeten).toBe(1);
    expect(beeld.proces.bezwaar.buiten).toEqual([1]);
    expect(beeld.proces.bezwaar.nogOpen).toBe(1);
  });

  it("leest de itembank en negeert de items van een ander instrument", () => {
    const item = db.prepare(
      `INSERT INTO bekwaamheid_items
         (id, instrument_id, "as", soort, stam, sleutel, toelichting_goed, toelichting_fout, p_waarde, discriminatie, actief)
       VALUES (?, ?, 'weten', 'meerkeuze', 'Stam', 'a', 'Goed', 'Fout', ?, ?, ?)`,
    );
    item.run(1, "t4p-business", 0.1, 0.3, 1);
    item.run(2, "t4p-business", 0.6, -0.2, 1);
    item.run(3, "t4p-business", 0.6, 0.3, 0);
    item.run(4, "t4p-teens", 0.02, -0.9, 1);

    const alleen = leesRegiekamer("2026-08-14", "t4p-business", opslag);
    expect(alleen.itembank.items).toBe(2);
    expect(alleen.itembank.buitenBereik).toEqual([1]);
    expect(alleen.itembank.negatieveDiscriminatie).toEqual([2]);

    const alles = leesRegiekamer("2026-08-14", null, opslag);
    expect(alles.itembank.items).toBe(3);
  });

  it("schrijft niets: het is een leesscherm", () => {
    zetRonde(db, 1);
    opslag.agenda.zetNeer({
      geaccrediteerdeId: 1,
      instrumentId: "t4p-business",
      soort: "venster_sluit",
      datum: "2026-08-01",
    });
    const tel = () =>
      (
        db
          .prepare(
            `SELECT (SELECT COUNT(*) FROM bekwaamheid_rondes) AS rondes,
                    (SELECT COUNT(*) FROM bekwaamheid_agenda) AS agenda,
                    (SELECT COUNT(*) FROM bekwaamheid_agenda WHERE afgehandeld_op IS NOT NULL) AS afgehandeld`,
          )
          .get() as Record<string, number>
      );
    const voor = tel();
    leesRegiekamer("2026-08-14", null, opslag);
    leesRegiekamer("2026-08-14", "t4p-business", opslag);
    expect(tel()).toEqual(voor);
  });
});

// ---------------------------------------------------------------------------
// 9. De twee webadressen
// ---------------------------------------------------------------------------

function maakApp(adminId: number | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (adminId !== null) (req as any).session = { adminId };
    next();
  });
  registerRegiekamerRoutes(app as any);
  return app;
}

async function verzoek(
  adminId: number | null,
  methode: "GET" | "POST",
  pad: string,
  lichaam?: unknown,
): Promise<{ status: number; lichaam: any }> {
  const server = createServer(maakApp(adminId));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const antwoord = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: methode,
      headers: lichaam !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: lichaam !== undefined ? JSON.stringify(lichaam) : undefined,
    });
    const tekst = await antwoord.text();
    return { status: antwoord.status, lichaam: tekst === "" ? null : JSON.parse(tekst) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

describe("de webadressen van de regiekamer", () => {
  it("weigert een verzoek zonder beheerderssessie", async () => {
    const beeld = await verzoek(null, "GET", "/api/bekwaamheid/regiekamer?peildatum=2026-08-14");
    expect(beeld.status).toBe(401);
    const simulatie = await verzoek(null, "POST", "/api/bekwaamheid/regiekamer/poortsimulatie", {
      handeling: "afname_aanmaken",
    });
    expect(simulatie.status).toBe(401);
  });

  it("weigert een onleesbare peildatum in plaats van er stil vandaag van te maken", async () => {
    for (const ruw of ["gisteren", "14-08-2026", "2026-8-4"]) {
      const antwoord = await verzoek(
        1,
        "GET",
        `/api/bekwaamheid/regiekamer?peildatum=${encodeURIComponent(ruw)}`,
      );
      expect(antwoord.status).toBe(400);
      expect(antwoord.lichaam.error).toMatch(/Peildatum/);
    }
  });

  it("weigert een onbekende handeling en een onbekende stand in de simulatie", async () => {
    const handeling = await verzoek(1, "POST", "/api/bekwaamheid/regiekamer/poortsimulatie", {
      handeling: "iets_anders",
    });
    expect(handeling.status).toBe(400);
    expect(handeling.lichaam.error).toMatch(/Handeling/);

    const stand = await verzoek(1, "POST", "/api/bekwaamheid/regiekamer/poortsimulatie", {
      handeling: "afname_aanmaken",
      stand: "streng",
    });
    expect(stand.status).toBe(400);
    expect(stand.lichaam.error).toMatch(/Stand/);
  });

  it("weigert een onleesbare peildatum ook in de simulatie", async () => {
    const antwoord = await verzoek(1, "POST", "/api/bekwaamheid/regiekamer/poortsimulatie", {
      handeling: "afname_aanmaken",
      stand: "handhaaf",
      peildatum: "ooit",
    });
    expect(antwoord.status).toBe(400);
    expect(antwoord.lichaam.error).toMatch(/Peildatum/);
  });
});
