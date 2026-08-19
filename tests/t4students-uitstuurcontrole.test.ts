// ---------------------------------------------------------------------------
// tests/t4students-uitstuurcontrole.test.ts
//
// De poort voor het uitsturen van een studiekompas.
//
// De opdrachtgever vroeg geen belofte over de code maar over de uitnodiging:
// wat de deur uitgaat, werkt. Die belofte hangt aan
// server/t4students/uitstuurcontrole.ts. Deze toets meet drie dingen:
//
//   1. Op een gezonde keten sluit de controle, in elk van de drie talen van het
//      instrument, tot en met een echte PDF.
//   2. Op een gebroken keten sluit ze niet. Zes verschillende breuken worden
//      nagespeeld op het instrument en op de app; elke breuk moet de controle
//      rood zetten, met een leesbare reden.
//   3. De poort laat elk ander instrument ongemoeid, zodat geen enkel bestaand
//      pad hinder ondervindt.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import express from "express";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import type { T4SInstrument } from "../server/t4students/instrument";
import { registerVragenlijstT4StudentsRoutes } from "../server/routes/vragenlijst-t4students";
import {
  keurUitstuurT4Students,
  poortVoorUitstuur,
  vergeetUitstuuroordeel,
  redenenVanWeigering,
  bundelBevindingen,
} from "../server/t4students/uitstuurcontrole";
import type { Uitstuuroordeel } from "../server/t4students/uitstuurcontrole";

/** Een app met de wegen die de keten nodig heeft. */
function gezondeApp() {
  const a = express();
  registerVragenlijstT4StudentsRoutes(a);
  a.post("/api/afnames/:id/connection", (_req, res) => res.json({ ok: true }));
  return a;
}

/**
 * Een wortel zonder gebouwde frontend. De controle op de uitgeleverde bundel
 * wordt dan overgeslagen en gemeld. Die controle heeft haar eigen toetsen
 * hieronder, met een nagebootste bundel, zodat de ketentoetsen niet afhangen van
 * de vraag of er in deze werkmap toevallig een bouw staat.
 */
function wortelZonderBouw(): string {
  return mkdtempSync(join(tmpdir(), "t4s-zonder-bouw-"));
}

/** Een wortel met een nagebootste, uitgeleverde frontendbundel. */
function wortelMetBundel(inhoud: string): string {
  const wortel = mkdtempSync(join(tmpdir(), "t4s-met-bundel-"));
  const map = join(wortel, "dist", "public", "assets");
  mkdirSync(map, { recursive: true });
  writeFileSync(join(map, "index-abc123.js"), inhoud, "utf8");
  return wortel;
}

/** Een diepe kopie van het instrument, om zonder gevolgen te kunnen breken. */
function kopie(): T4SInstrument {
  return JSON.parse(JSON.stringify(T4STUDENTS_INSTRUMENT)) as T4SInstrument;
}

beforeEach(() => {
  vergeetUitstuuroordeel();
});

/** De code zonder commentaar. Een uitgezette regel telt dus niet mee. */
function werkzameCode(pad: string): string {
  return readFileSync(join(process.cwd(), pad), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((regel) => regel.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("de poort hangt op elke deur waar een studiekompas kan ontstaan", () => {
  it("op de zelfstart en op de uitnodiging in server/routes/afnames.ts", () => {
    const bron = werkzameCode("server/routes/afnames.ts");
    expect(bron).toContain('from "../t4students/uitstuurcontrole"');
    // Twee deuren in dit bestand: POST /api/afnames en POST /api/uitnodigingen.
    const aanroepen = bron.match(/await poortVoorUitstuur\(/g) ?? [];
    expect(aanroepen.length).toBeGreaterThanOrEqual(2);
  });

  it("op de bulk-import in server/bulk-import/routes.ts", () => {
    const bron = werkzameCode("server/bulk-import/routes.ts");
    expect(bron).toContain('from "../t4students/uitstuurcontrole"');
    expect(bron).toContain("await poortVoorUitstuur(");
  });
});

describe("uitstuurcontrole T4Students, gezonde keten", () => {
  // De keuring speelt de keten in drie talen na, tot en met twee echte PDF's.
  // Dat is zwaar werk, en de uitslag is voor elke bewering hieronder dezelfde.
  // Daarom wordt ze een keer gedaan en daarna gelezen. Zo blijft de volledige
  // suite binnen haar geheugen, ook op een kleine bouwmachine.
  let gezond: Uitstuuroordeel;

  beforeAll(async () => {
    gezond = await keurUitstuurT4Students({
      app: gezondeApp(),
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
  }, 180000);

  it("sluit in elke taal, van vragenlijst tot PDF", () => {
    if (!gezond.ok) console.error(redenenVanWeigering(gezond));
    expect(gezond.gefaald).toBe(0);
    expect(gezond.ok).toBe(true);
    // Drie talen maal minstens tien controles, plus de wegen en de bundel.
    expect(gezond.geslaagd).toBeGreaterThanOrEqual(30);
    for (const taal of ["nl", "fr", "en"]) {
      const pdf = gezond.bevindingen.find((b) => b.code === "D2" && b.taal === taal);
      expect(pdf, `geen PDF-bevinding voor ${taal}`).toBeTruthy();
      expect(pdf!.geslaagd).toBe(true);
      expect(pdf!.detail).toContain("%PDF-");
    }
    // De keuring neemt de controle op de uitgeleverde frontend werkelijk mee.
    // Hier staat geen bouw, dus hoort dat de eerlijke melding F0 te zijn.
    expect(gezond.bevindingen.some((b) => b.code.startsWith("F"))).toBe(true);
  });

  it("de poort laat een gezonde keten door", async () => {
    expect(gezond.ok).toBe(true);
    // De poort keurt zelf en laat door zodra de keten sluit. De wortel met een
    // nagebootste bundel maakt de uitslag onafhankelijk van de vraag of er in
    // deze werkmap toevallig een bouw staat, en zo ja, welke.
    const uitslag = await poortVoorUitstuur(
      "t4students",
      gezondeApp(),
      wortelMetBundel(
        "fetch('/api/vragenlijst/tapas-t4students?taal=nl'); navigate('/afname/1/studiekompas');",
      ),
    );
    expect(uitslag).toBeNull();
  }, 180000);

  it("de poort laat elk ander instrument ongemoeid", async () => {
    expect(await poortVoorUitstuur(null, null)).toBeNull();
    expect(await poortVoorUitstuur("t4p-business", null)).toBeNull();
    expect(await poortVoorUitstuur("t4kids", null)).toBeNull();
    expect(await poortVoorUitstuur("t4teens", null)).toBeNull();
  });
});

describe("uitstuurcontrole T4Students, gebroken keten", () => {
  it("betrapt een ontbrekende vragenlijstroute op de levende server", async () => {
    const zonder = express();
    zonder.post("/api/afnames/:id/connection", (_req, res) => res.json({ ok: true }));
    const oordeel = await keurUitstuurT4Students({
      app: zonder,
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
    expect(oordeel.ok).toBe(false);
    expect(oordeel.bevindingen.find((b) => b.code === "R1")!.geslaagd).toBe(false);
  }, 120000);

  it("betrapt een ontbrekende inleverroute op de levende server", async () => {
    const zonder = express();
    registerVragenlijstT4StudentsRoutes(zonder);
    const oordeel = await keurUitstuurT4Students({
      app: zonder,
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
    expect(oordeel.ok).toBe(false);
    expect(oordeel.bevindingen.find((b) => b.code === "R2")!.geslaagd).toBe(false);
  }, 120000);

  it("betrapt een instrument zonder items", async () => {
    const stuk = kopie();
    stuk.sections = [];
    const oordeel = await keurUitstuurT4Students({
      app: gezondeApp(),
      instrument: stuk,
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
    expect(oordeel.ok).toBe(false);
  }, 120000);

  it("betrapt een item dat uit de vragenlijst verdwenen is", async () => {
    const stuk = kopie();
    const sectie = stuk.sections![0]!;
    // Het eerste herkenningsitem weghalen. De scoring blijft het verwachten,
    // dus de sleutels sluiten niet meer.
    const items = sectie.items as unknown[];
    items.splice(4, 1);
    const oordeel = await keurUitstuurT4Students({
      app: gezondeApp(),
      instrument: stuk,
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
    expect(oordeel.ok).toBe(false);
  }, 120000);

  it("betrapt een item zonder tekst in een van de talen", async () => {
    const stuk = kopie();
    const items = stuk.sections![0]!.items as { text?: Record<string, string> }[];
    const metTekst = items.find((i) => i.text && i.text.nl);
    metTekst!.text = { nl: "", fr: "", en: "" } as Record<string, string>;
    const oordeel = await keurUitstuurT4Students({
      app: gezondeApp(),
      instrument: stuk,
      wortel: wortelZonderBouw(),
      negeerBewaard: true,
    });
    expect(oordeel.ok).toBe(false);
    expect(oordeel.bevindingen.some((b) => b.code === "V3" && !b.geslaagd)).toBe(true);
  }, 120000);

  it("betrapt een uitgeleverde frontend die het adres van de vragenlijst niet draagt", () => {
    const bevindingen = bundelBevindingen(wortelMetBundel("const x=1; fetch('/api/instrument');"));
    expect(bevindingen.find((b) => b.code === "F1")!.geslaagd).toBe(false);
    expect(bevindingen.find((b) => b.code === "F2")!.geslaagd).toBe(false);
  });

  it("aanvaardt een uitgeleverde frontend die de adressen van de keten draagt", () => {
    const bevindingen = bundelBevindingen(
      wortelMetBundel(
        "fetch('/api/vragenlijst/tapas-t4students?taal=nl'); navigate('/afname/1/studiekompas');",
      ),
    );
    expect(bevindingen.find((b) => b.code === "F1")!.geslaagd).toBe(true);
    expect(bevindingen.find((b) => b.code === "F2")!.geslaagd).toBe(true);
  });

  it("meldt eerlijk dat er geen bouw staat om na te kijken", () => {
    const bevindingen = bundelBevindingen(wortelZonderBouw());
    expect(bevindingen.find((b) => b.code === "F0")).toBeTruthy();
  });

  it("levert bij een gebroken keten leesbare redenen en een 503 uit de poort", async () => {
    const zonder = express();
    const uitslag = await poortVoorUitstuur("t4students", zonder, wortelZonderBouw());
    expect(uitslag).not.toBeNull();
    expect(uitslag!.status).toBe(503);
    expect(uitslag!.lichaam.code).toBe("T4S_NIET_UITSTUURBAAR");
    const redenen = uitslag!.lichaam.redenen as string[];
    expect(Array.isArray(redenen)).toBe(true);
    expect(redenen.length).toBeGreaterThan(0);
    expect(redenen.join(" ")).toMatch(/vragenlijstroute|inleverroute/);
  }, 120000);
});
