import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 9 uit fase 1: translationStatus staat op "nl-only" terwijl de Franse en
// Engelse teksten er wel degelijk allemaal in staan.
//
// ER IS HIER MET OPZET NIETS GEREPAREERD
// De opdracht is duidelijk: laat allebei staan. De vlag omzetten zou zeggen
// dat de vertalingen nagelezen en vrijgegeven zijn, en dat weten we niet. De
// vertalingen weghalen zou werk vernietigen dat er al is. Er zijn ook geen
// vertalingen bijgemaakt of geraden.
//
// WAT DEZE TEST BEWAAKT
// Zolang de vlag en de inhoud elkaar tegenspreken, mag geen enkele regel code
// zich op die vlag baseren om vertalingen te tonen of te verbergen. Wie dat
// wel doet, bouwt op een uitspraak waarvan hier gemeten is dat ze niet klopt:
// de vlag zegt "alleen Nederlands", de inhoud is drietalig, en het instrument
// zegt zelf multilingual: true. Welke van die drie je ook gelooft, je verbergt
// of toont het verkeerde.
//
// Deze test wordt dus rood zodra iemand de vlag gaat uitlezen, en blijft rood
// tot de tegenspraak zelf is opgelost: ofwel de vertalingen zijn nagelezen en
// de vlag gaat om, ofwel de vertalingen verdwijnen. Pas dan mag de uitsluiting
// hieronder weg.
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

describe("punt 9: de vertaalvlag spreekt de inhoud tegen", () => {
  it("de vlag zegt alleen Nederlands", () => {
    expect(I.translationStatus).toBe("nl-only");
  });

  it("het instrument zegt tegelijk dat het meertalig is", () => {
    // Twee velden in hetzelfde bestand die elkaar tegenspreken. Dit is de kern
    // van punt 9 en de reden dat de vlag niets mag sturen.
    expect(I.multilingual).toBe(true);
    expect(I.language).toBe("nl");
  });

  it("alle overgezette teksten staan in drie talen, de drie nieuwe alleen in het Nederlands", () => {
    // De drie energie-items die in de motorronde zijn bijgemaakt (D7, F7 en F8)
    // dragen met opzet een lege Franse en Engelse tekst. Er is niets vertaald
    // en niets geraden: de Nederlandse vraagtekst moet eerst door de
    // opdrachtgever nagelezen worden, en pas daarna heeft vertalen zin.
    const { totaal, gevuld } = telVertaalbareVelden();
    expect(totaal).toBe(79);
    expect(gevuld.nl).toBe(79);
    expect(gevuld.fr).toBe(76);
    expect(gevuld.en).toBe(76);
  });

  it("precies de drie nieuwe energie-items missen Frans en Engels", () => {
    const main = I.sections.find((s) => s.sectionId === "main")!;
    const leeg = main.items
      .filter((i) => i.text != null && (!i.text.fr?.trim() || !i.text.en?.trim()))
      .map((i) => i.id);
    expect(leeg).toEqual(["D7", "F7", "F8"]);
  });

  it("de motor levert vandaag gewoon Frans en Engels, ongeacht de vlag", () => {
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

  it("geen enkele regel code baseert zich op de vlag om vertalingen te sturen", () => {
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
      // De typedeclaratie plus de uitleg waarom de vlag niet klopt. Geen sturing.
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
      "Zolang translationStatus (\"nl-only\") de inhoud (76 van 76 velden in " +
        "nl, fr en en) tegenspreekt, mag geen code die vlag gebruiken om " +
        "vertalingen te tonen of te verbergen. Los eerst de tegenspraak op.",
    ).toEqual([]);
  });
});
