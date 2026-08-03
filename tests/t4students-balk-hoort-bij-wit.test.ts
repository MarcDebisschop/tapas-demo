import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Opmaak afwerken, punt 1: een blok met een gekleurde balk aan de linkerrand
// heeft altijd een witte achtergrond (KLEUR.kaart), en een getint vlak heeft
// nooit een balk. Twee plaatsen volgden dat nog niet:
//
// - Het introblok (soort "intro"), bovenaan bijna elk hoofdstuk, was getint
//   (KLEUR.papier2) EN had een balk. Dat moet een getint vlak zonder balk
//   worden: geen uitleg van een onderdeel, maar een aanloop.
// - De kaart "WAT AL STERK IS" op het slothoofdstuk was een kaartvlak
//   (getint, geen balk), terwijl zijn tegenhanger "WAT NOG STERKER KAN"
//   ernaast een kader (wit, met balk) is. Ze horen hetzelfde te zijn: beide
//   zijn uitleg. "WAT AL STERK IS" wordt daarom een kader.
//
// Deze test bestaat uit twee delen: (1) een regelrechte broncodetoets die
// vastlegt dat "intro" getint tekent zonder balk te vullen, zodat het niet
// opnieuw kan schuiven, en (2) een toets op het echte, gebouwde rapport dat
// het blok "WAT AL STERK IS" van het soort "kader" is (wit, met balk),
// dezelfde soort als zijn tegenhanger "WAT NOG STERKER KAN".
// ---------------------------------------------------------------------------

function leesTekenaar(): string {
  return readFileSync(join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"), "utf-8");
}

function pakTekenBlokCase(bron: string, soort: string): string {
  const marker = `function tekenBlok(`;
  const startTeken = bron.indexOf(marker);
  const tekenBlokBron = bron.slice(startTeken);
  const caseMarker = `case "${soort}": {`;
  const caseStart = tekenBlokBron.indexOf(caseMarker);
  expect(caseStart, `case "${soort}" niet gevonden binnen tekenBlok()`).toBeGreaterThan(-1);
  const na = tekenBlokBron.slice(caseStart + caseMarker.length);
  const volgendeCase = na.search(/\n\s*case "/);
  return na.slice(0, volgendeCase > -1 ? volgendeCase : na.length);
}

describe("de regel: een balk hoort bij wit, een getint vlak heeft nooit een balk", () => {
  it("het introblok vult zijn achtergrond getint (papier2), en tekent geen balk aan de linkerrand", () => {
    const code = pakTekenBlokCase(leesTekenaar(), "intro");
    // De achtergrond moet getint zijn.
    expect(code, "het introblok tekent zijn achtergrond niet met KLEUR.papier2").toMatch(
      /vulRechthoek\(doc, x, y, TEKST_B, [^,]+, KLEUR\.papier2/,
    );
    // Er mag geen tweede, smalle rechthoek (de balk) in de accentkleur getekend worden.
    // Een balk herkent men aan een vulRechthoek-aanroep met een vaste, smalle breedte
    // (zoals 2.4 of 2.6, de breedtes die elders voor een balk gebruikt worden) vóór de
    // hoogte-parameter.
    const balkPatroon = /vulRechthoek\(doc, x, y, 2\.[0-9]+,/;
    expect(code, "het introblok tekent nog een balk aan de linkerrand; dat mag niet meer").not.toMatch(balkPatroon);
  });

  it("het blok WAT AL STERK IS op het slothoofdstuk is een kader (wit, met balk), net als zijn tegenhanger WAT NOG STERKER KAN", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const slotblad = rapport.paginas.find((p) => /een zin om mee te nemen/i.test(p.titel));
    expect(slotblad, "geen slothoofdstuk Een zin om mee te nemen gevonden").toBeDefined();
    const blokken = slotblad!.blokken as any[];
    const sterkIs = blokken.find((b) => b.opschrift === "WAT AL STERK IS");
    const sterkerKan = blokken.find((b) => b.opschrift === "WAT NOG STERKER KAN");
    // Beide kaarten zijn afhankelijk van de voorbeeldafname; als de een er is,
    // controleren we dat ze van hetzelfde, witte soort zijn als de ander.
    if (sterkIs) {
      expect(sterkIs.soort, "WAT AL STERK IS moet een kader zijn (wit met balk), niet een kaartvlak").toBe("kader");
    }
    if (sterkerKan) {
      expect(sterkerKan.soort).toBe("kader");
    }
    if (sterkIs && sterkerKan) {
      expect(sterkIs.soort).toBe(sterkerKan.soort);
    }
  });
});

describe("invariant over alle bloksoorten: wit-met-balk of getint-zonder-balk, nooit iets anders", () => {
  // Deze test leest de broncode van tekenBlok() en controleert voor elke
  // kaartachtige bloksoort (die zijn eigen achtergrond vult) welke kleur de
  // achtergrond krijgt en of er een balk (een tweede, smalle vulRechthoek in
  // een kleurvariabele) getekend wordt. Zo kan de afspraak niet meer
  // ongemerkt verschuiven: elk kaartachtig blok is óf wit met een balk, óf
  // getint zonder balk.
  const KAARTACHTIGE_SOORTEN = ["intro", "constructblok", "citaat", "kader", "kaartvlak", "zinvlak"];

  function achtergrondVan(code: string): "wit" | "getint" | "onbekend" {
    const m = code.match(/vulRechthoek\(doc, x, y, TEKST_B,[^,]+,\s*(KLEUR\.\w+)/);
    if (!m) return "onbekend";
    return m[1] === "KLEUR.kaart" ? "wit" : "getint";
  }

  function heeftBalk(code: string): boolean {
    // Een balk is een tweede vulRechthoek-aanroep met een vaste, smalle
    // breedte (tussen 2 en 3.5 punten) vóór de hoogte- of totaalvariabele.
    return /vulRechthoek\(doc, x, y, [23](\.[0-9]+)?,/.test(code);
  }

  for (const soort of KAARTACHTIGE_SOORTEN) {
    it(`"${soort}" is óf wit-met-balk óf getint-zonder-balk`, () => {
      const code = pakTekenBlokCase(leesTekenaar(), soort);
      const achtergrond = achtergrondVan(code);
      expect(achtergrond, `kon de achtergrondkleur van "${soort}" niet bepalen`).not.toBe("onbekend");
      const balk = heeftBalk(code);
      if (achtergrond === "wit") {
        expect(balk, `"${soort}" heeft een witte achtergrond maar tekent geen balk`).toBe(true);
      } else {
        expect(balk, `"${soort}" is getint maar tekent toch een balk; dat mag niet`).toBe(false);
      }
    });
  }
});
