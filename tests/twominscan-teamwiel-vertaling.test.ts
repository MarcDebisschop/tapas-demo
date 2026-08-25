// Teamwielpagina en teamdynamiek in drie talen (NL, FR, EN).
//
// Waarom deze test bestaat
//   De teamwielpagina en de dynamiekmodule vragen hun teksten op met
//   `tr("sleutel", "nl-tekst")` respectievelijk `t("sleutel", "nl-tekst")`. Die
//   functies vallen bewust terug op de Nederlandse tekst wanneer een sleutel
//   ontbreekt. Dat is prettig voor de gebruiker maar stil voor de ontwikkelaar:
//   een vergeten vertaling geeft dan een Franstalig rapport met Nederlandse
//   zinnen erin, zonder dat iets faalt. Deze test maakt dat luidruchtig.
//
// Wat hier geborgd wordt
//   1. elke sleutel die de teamwielpagina en de dynamiekmodule gebruiken staat
//      in fr en en (nl is de bron en heeft geen tabel nodig);
//   2. geen vertaling laat een accolade-plaatshouder vallen, want dan verdwijnt
//      er stil een naam, een percentage of een gradenaantal uit de tekst;
//   3. de Nederlandse bronteksten blijven energietaal, zonder talent-,
//      potentieel-, competentie-, diagnose- of geschiktheidsclaims en zonder
//      "creativiteit" (2MINSCAN-taalregel).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const wortel = process.cwd();
const bronnen = [
  "client/src/pages/twominscan-teamwiel.tsx",
  "client/src/temperamentenwiel/dynamiek.ts",
].map((rel) => ({ rel, bron: readFileSync(path.join(wortel, rel), "utf8") }));

const vertalingen = JSON.parse(
  readFileSync(path.join(wortel, "client/src/twominscan/vertalingen.json"), "utf8"),
) as Record<string, Record<string, string>>;

const DOELTALEN = ["fr", "en"] as const;

/** Alle `tr("sleutel", "nl")` / `t("sleutel", "nl")`-paren, ook meerregelig. */
function sleutelParen(bron: string): Array<{ sleutel: string; nl: string }> {
  const paren: Array<{ sleutel: string; nl: string }> = [];
  const re = /\b(?:tr|t)\(\s*"((?:ui|wiel|dyn)\.[^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bron)) !== null) {
    paren.push({ sleutel: m[1], nl: m[2].replace(/\\"/g, '"') });
  }
  return paren;
}

const paren = bronnen.flatMap(({ bron }) => sleutelParen(bron));
const perSleutel = new Map(paren.map((p) => [p.sleutel, p.nl]));

function plaatshouders(tekst: string): string[] {
  return [...tekst.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("Teamwiel — vertaalsleutels", () => {
  it("vindt de sleutels in de bron", () => {
    // Vangnet onder het vangnet: vindt de scan niets, dan is de regex stuk en
    // zou de rest van deze suite altijd slagen zonder iets te controleren.
    expect(perSleutel.size).toBeGreaterThan(60);
    expect(perSleutel.has("ui.tw.titel")).toBe(true);
    expect(perSleutel.has("dyn.afstand.tekst")).toBe(true);
  });

  for (const taal of DOELTALEN) {
    it(`heeft elke teamwielsleutel in ${taal}`, () => {
      const map = vertalingen[taal];
      expect(map).toBeTruthy();
      const ontbreekt = [...perSleutel.keys()].filter(
        (sleutel) => typeof map[sleutel] !== "string" || map[sleutel].length === 0,
      );
      expect(ontbreekt, `${taal} mist: ${ontbreekt.join(", ")}`).toEqual([]);
    });

    it(`houdt elke plaatshouder overeind in ${taal}`, () => {
      const map = vertalingen[taal];
      const scheef: string[] = [];
      for (const [sleutel, nl] of perSleutel) {
        const vertaald = map[sleutel];
        if (typeof vertaald !== "string") continue;
        const bron = plaatshouders(nl);
        const doel = plaatshouders(vertaald);
        if (bron.join(",") !== doel.join(",")) {
          scheef.push(`${sleutel}: nl {${bron.join(",")}} vs ${taal} {${doel.join(",")}}`);
        }
      }
      expect(scheef, scheef.join("\n")).toEqual([]);
    });
  }
});

describe("Teamwiel — energietaal in de bronteksten", () => {
  const verboden = [
    "talent",
    "potentieel",
    "competentie",
    "creativiteit",
    "diagnose",
    "geschikt",
    "beter dan",
  ];

  it("houdt de Nederlandse teksten in energietaal", () => {
    const fout: string[] = [];
    for (const [sleutel, nl] of perSleutel) {
      const laag = nl.toLowerCase();
      for (const woord of verboden) {
        // De slotalert mag talent en potentieel wél noemen: ze zegt uitdrukkelijk
        // dat dit rapport daar géén uitspraak over doet, en verwijst voor die
        // vraag naar het TaPas Kompas.
        if (sleutel === "ui.tw.eerlijk_1") continue;
        if (laag.includes(woord)) fout.push(`${sleutel} bevat "${woord}"`);
      }
    }
    expect(fout, fout.join("\n")).toEqual([]);
  });

  it("zegt in de slotalert wat het rapport niet is", () => {
    const alert = perSleutel.get("ui.tw.eerlijk_1");
    expect(alert).toBeTruthy();
    const laag = alert!.toLowerCase();
    expect(laag).toContain("zegt niets over");
    expect(laag).toContain("selectie");
    expect(laag).toContain("tapas kompas");
  });
});
