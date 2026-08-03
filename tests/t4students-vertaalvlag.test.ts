import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// De vertaalvlag van T4Students.
//
// WAT DE VLAG NU ZEGT
// translationStatus staat op "nl-fr-en" en dat klopt met de inhoud: elk
// vertaalbaar veld van het instrument draagt een Nederlandse, een Franse en een
// Engelse tekst. Eerder stond er "nl-only" terwijl er al 76 van de 79 velden
// drietalig waren; die tegenspraak is weg nu D7, F7 en F8 hun Franse en Engelse
// tekst hebben gekregen.
//
// WAT DE VLAG NIET ZEGT
// Zij zegt welke talen aanwezig zijn, niet dat ze nagelezen zijn. De
// opdrachtgever leest de vertalingen na; tot dat gebeurd is mag geen enkele
// regel code de vlag gebruiken om vertalingen te tonen of te verbergen, want
// dan zou de vlag een vrijgave betekenen die er niet is. Dat is wat de laatste
// test hieronder bewaakt.
// ---------------------------------------------------------------------------

const TALEN = ["nl", "fr", "en"] as const;

/** Een object is een vertaalbaar tekstveld als al zijn sleutels talen zijn. */
function isVertaalbaar(w: unknown): boolean {
  if (w == null || typeof w !== "object" || Array.isArray(w)) return false;
  const sleutels = Object.keys(w as Record<string, unknown>);
  if (sleutels.length === 0) return false;
  return sleutels.every((s) => ["nl", "fr", "en", "de"].includes(s));
}

function telVertaalbareVelden(): { totaal: number; gevuld: Record<string, number> } {
  const gevuld: Record<string, number> = { nl: 0, fr: 0, en: 0 };
  let totaal = 0;
  function loop(w: unknown) {
    if (isVertaalbaar(w)) {
      totaal++;
      for (const t of TALEN) {
        const v = (w as Record<string, unknown>)[t];
        if (typeof v === "string" && v.trim() !== "") gevuld[t]++;
      }
      return;
    }
    if (Array.isArray(w)) {
      for (const k of w) loop(k);
      return;
    }
    if (w != null && typeof w === "object") {
      for (const k of Object.values(w as Record<string, unknown>)) loop(k);
    }
  }
  loop(I);
  return { totaal, gevuld };
}

describe("de vertaalvlag en de inhoud zeggen hetzelfde", () => {
  it("de vlag noemt de drie talen die er werkelijk in staan", () => {
    expect(I.translationStatus).toBe("nl-fr-en");
  });

  it("het instrument noemt zich meertalig, met Nederlands als voertaal", () => {
    expect(I.multilingual).toBe(true);
    expect(I.language).toBe("nl");
  });

  it("elk vertaalbaar veld draagt alle drie de talen", () => {
    // 86 sinds de beginvraag (onderdeel B1 van "Studiekompas persoonlijk
    // maken"): de 84 bestaande velden plus de twee tekstvelden van de open
    // beginvraag P0 (de vraagtekst zelf en de voorbeeldtekst), die ook in fr
    // en en zijn ingevuld. Zie het verslag voor de melding dat die twee
    // vertalingen niet door een moedertaalspreker zijn nagelezen.
    const { totaal, gevuld } = telVertaalbareVelden();
    expect(totaal).toBe(86);
    expect(gevuld.nl).toBe(86);
    expect(gevuld.fr).toBe(86);
    expect(gevuld.en).toBe(86);
  });

  it("geen enkel item mist nog Frans of Engels", () => {
    const main = I.sections.find((s) => s.sectionId === "main")!;
    const leeg = main.items
      .filter((i) => i.text != null && (!i.text.fr?.trim() || !i.text.en?.trim()))
      .map((i) => i.id);
    expect(leeg).toEqual([]);
  });

  it("de motor levert Frans en Engels zonder de vlag te raadplegen", () => {
    // Een lege invulling zet het alert voorlopig_profiel aan. Dat alert draagt
    // een boodschap in de gevraagde taal. De vlag speelt daar geen rol in.
    const nl = scoreStudiekompas(I, {}, null, "nl");
    const fr = scoreStudiekompas(I, {}, null, "fr");
    const en = scoreStudiekompas(I, {}, null, "en");
    expect(nl.taal).toBe("nl");
    expect(fr.taal).toBe("fr");
    expect(en.taal).toBe("en");
    const boodschap = (r: typeof nl) =>
      r.alerts.actief.find((a) => a.id === "voorlopig_profiel")!.boodschap;
    expect(boodschap(nl)).toContain("te weinig antwoorden");
    expect(boodschap(fr)).toContain("trop peu de r");
    expect(boodschap(en)).toContain("too few answers");
    expect(boodschap(fr)).not.toBe(boodschap(nl));
    expect(boodschap(en)).not.toBe(boodschap(nl));
  });

  it("een onbekende taal valt terug op Nederlands, en niet op de vlag", () => {
    const r = scoreStudiekompas(I, {}, null, "de");
    expect(r.taal).toBe("nl");
  });

  it("geen enkele regel code stuurt vertalingen op de vlag", () => {
    const wortel = path.resolve(__dirname, "..");
    const uit: string[] = [];
    function loop(map: string) {
      for (const naam of readdirSync(map)) {
        if (naam === "node_modules" || naam.startsWith(".")) continue;
        const p = path.join(map, naam);
        if (statSync(p).isDirectory()) loop(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(naam)) uit.push(p);
      }
    }
    for (const m of ["server", "client", "shared", "tests"]) loop(path.join(wortel, m));

    const uitgesloten = [
      // Dit bestand zelf: het noemt de vlag om haar te bewaken.
      "t4students-vertaalvlag.test.ts",
      // De typedeclaratie plus de uitleg bij de vlag. Geen sturing.
      path.join("t4students", "instrument.ts"),
      // Gaat over een ander instrument (server/data/instrument.json) en toont
      // juist aan dat de vlag de inhoudsvingerafdruk niet raakt. Geen sturing.
      "instrument-inhoudsversie.test.ts",
    ];

    const noemers = uit
      .filter((p) => !uitgesloten.some((u) => p.endsWith(u)))
      .filter((p) =>
        readFileSync(p, "utf-8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/(^|[^:])\/\/.*$/gm, "$1")
          .includes("translationStatus"),
      )
      .map((p) => path.relative(wortel, p));

    expect(
      noemers,
      "translationStatus zegt welke talen aanwezig zijn, niet dat ze nagelezen " +
        "zijn. Zolang de opdrachtgever de vertalingen niet heeft nagelezen, mag " +
        "geen code de vlag gebruiken om vertalingen te tonen of te verbergen.",
    ).toEqual([]);
  });
});
