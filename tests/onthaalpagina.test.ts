// ---------------------------------------------------------------------------
// tests/onthaalpagina.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. De voordeur van TaPas Core is de onthaalpagina, en de startpagina van
//      het belevingsplatform blijft onaangeroerd staan voor de volle stand.
//   B. De opmaak van de onthaalpagina raakt geen ander scherm: elke regel in
//      onthaal.css staat binnen .onthaal.
//   C. De pagina brengt haar eigen merkteken niet mee. Het vliegtuigje komt uit
//      index.css, dus een tweede watermerk mag hier niet staan.
//   D. Wat op de pagina staat en wat er bewust niet op staat: de kernzin, de
//      grenzen van het instrument, geen taalkiezer, geen getuigenissen, geen
//      interne bouwtaal en geen enkel liggend streepje van het lange soort.
//   E. De verwijzingen binnen de pagina breken de hash-routing niet.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pagina = readFileSync(resolve(__dirname, "../client/src/pages/onthaal.tsx"), "utf8");
const opmaak = readFileSync(resolve(__dirname, "../client/src/pages/onthaal.css"), "utf8");
const app = readFileSync(resolve(__dirname, "../client/src/App.tsx"), "utf8");
const home = readFileSync(resolve(__dirname, "../client/src/pages/home.tsx"), "utf8");

/** De bron zonder commentaarregels, voor toetsen die iets moeten uitsluiten. */
const paginaCode = pagina
  .split("\n")
  .filter((r) => !r.trim().startsWith("//") && !r.trim().startsWith("*"))
  .join("\n");

describe("A. De voordeur", () => {
  it("Core krijgt de onthaalpagina op de wortelroute", () => {
    expect(app).toMatch(/import Onthaal from "@\/pages\/onthaal"/);
    expect(app).toMatch(/<Route path="\/" component=\{CORE_MODE \? Onthaal : Home\} \/>/);
  });

  it("het volledige platform houdt de bestaande startpagina", () => {
    expect(app).toMatch(/import Home from "@\/pages\/home"/);
    // De startpagina zelf blijft bestaan met haar rondleiding.
    expect(home).toContain("data-tour");
  });

  it("er is precies één wortelroute", () => {
    const aantal = (app.match(/<Route path="\/" /g) ?? []).length;
    expect(aantal).toBe(1);
  });
});

describe("B. De opmaak raakt geen ander scherm", () => {
  it("elke regel staat binnen .onthaal", () => {
    // Haal de blokken eruit en kijk naar de selectors op diepte nul.
    const zonderCommentaar = opmaak.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors: string[] = [];
    let i = 0;
    while (i < zonderCommentaar.length) {
      const open = zonderCommentaar.indexOf("{", i);
      if (open === -1) break;
      const sel = zonderCommentaar.slice(i, open).trim();
      let diepte = 1;
      let k = open + 1;
      while (k < zonderCommentaar.length && diepte > 0) {
        if (zonderCommentaar[k] === "{") diepte += 1;
        else if (zonderCommentaar[k] === "}") diepte -= 1;
        k += 1;
      }
      if (sel) selectors.push(sel);
      i = k;
    }
    expect(selectors.length).toBeGreaterThan(50);
    for (const sel of selectors) {
      if (sel.startsWith("@")) continue;
      for (const deel of sel.split(",")) {
        expect(deel.trim()).toMatch(/(^|\s)\.onthaal(\s|$|\*)/);
      }
    }
  });

  it("stuurt html of body niet aan", () => {
    const zonderCommentaar = opmaak.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(zonderCommentaar).not.toMatch(/(^|[},])\s*body\s*\{/);
    expect(zonderCommentaar).not.toMatch(/(^|[},])\s*html\s*\{/);
  });

  it("volgt het thema van de app via de klasse dark op de wortel", () => {
    expect(opmaak).toContain("html.dark .onthaal{");
  });
});

describe("B2. De herstellingen op de mockup", () => {
  it("zet de naam en de ondertitel in de kopbalk onder elkaar", () => {
    // Zonder deze regel lopen ze in de flexdoos aan elkaar vast:
    // "Tapas COREeen platform van TaPasCity".
    expect(opmaak).toMatch(
      /\.onthaal \.merk \.naam,\s*\.onthaal \.merk \.onder \{\s*display: block;/,
    );
  });

  it("houdt de mobiele opmaak van de drie roosters", () => {
    // Deze regel stond in dezelfde mediaquery als de getuigenissen. Wie die
    // regel in haar geheel weglaat, verliest de opmaak op een telefoon.
    expect(opmaak).toContain(
      ".onthaal .namen,.onthaal .paden,.onthaal .opbr{grid-template-columns:1fr}",
    );
  });
});

describe("C. Geen tweede merkteken", () => {
  it("de opmaak van de pagina brengt geen eigen watermerk mee", () => {
    expect(opmaak).not.toContain("body::after");
    expect(opmaak).not.toContain("earhart");
    expect(opmaak).not.toContain("data:image/svg+xml");
  });
});

describe("D. Wat er op de pagina staat", () => {
  it("de kernzin staat er woordelijk", () => {
    expect(pagina).toContain(
      "Dit is het Tapas platform waarmee een organisatie, een school of een coach een",
    );
    expect(pagina).toContain("talentinstrument uitstuurt, de afname opvolgt en er een rapport uit genereert dat");
  });

  it("de grens van het instrument staat er, in de voettekst en in het hoofddeel", () => {
    expect(pagina).toContain("Geen diagnose, selectie of");
    expect(pagina).toContain("Geen diagnose");
    expect(pagina).toContain("Geen selectiebeslissing");
    expect(pagina).toContain("Geen potentieelbepaling");
  });

  it("de belofte over het antwoord noemt een mens", () => {
    expect(pagina).toContain("antwoord van een Tapas-medewerker");
  });

  it("er staat geen taalkiezer op", () => {
    expect(paginaCode).not.toMatch(/className="talen"/);
    expect(paginaCode).not.toMatch(/>\s*NL\s*</);
  });

  it("de getuigenissen staan er niet op", () => {
    expect(paginaCode).not.toMatch(/getuig/i);
    expect(opmaak).not.toMatch(/\.getuig/);
  });

  it("er staat geen interne bouwtaal of proefaanduiding op", () => {
    expect(paginaCode).not.toMatch(/mockup/i);
    expect(paginaCode).not.toMatch(/\bTB\b/);
    expect(paginaCode).not.toMatch(/te bevestigen/i);
    expect(paginaCode).not.toMatch(/deur-nota/);
  });

  it("gebruikt nergens een lang liggend streepje", () => {
    expect(pagina).not.toContain("\u2014");
    expect(opmaak).not.toContain("\u2014");
  });

  it("het contactformulier stuurt naar de eigen route", () => {
    expect(pagina).toContain('"/api/onthaal-contact"');
  });

  it("de zes rollen staan in de keuzelijst", () => {
    for (const rol of [
      "Een particulier, voor mezelf",
      "Een organisatie",
      "Een school of onderwijsinstelling",
      "Een sportclub of mental coach",
      "Een coach of practitioner",
      "Een deelnemer met een vraag",
    ]) {
      expect(pagina).toContain(rol);
    }
  });
});

describe("D2. De themaknop", () => {
  it("noemt de weergave waarnaar je wisselt, niet de huidige stand", () => {
    // Een knop die de huidige stand toont, laat de bezoeker gissen. Deze knop
    // noemt de weergave die je krijgt wanneer je klikt.
    expect(pagina).toContain('{theme === "dark" ? "Licht" : "Donker"}');
    expect(pagina).toContain("Wissel naar de lichte weergave");
    expect(pagina).toContain("Wissel naar de donkere weergave");
  });

  it("gebruikt de themaschakelaar van de app zelf", () => {
    expect(pagina).toMatch(/const \{ theme, toggle \} = useTheme\(\)/);
    expect(pagina).toContain('import { useTheme } from');
  });
});

describe("E. De verwijzingen breken de routering niet", () => {
  it("gebruikt geen ankerverwijzingen die de hash-router meesturen", () => {
    // href="#contact" zou de hash-router naar een onbestaande route sturen.
    expect(paginaCode).not.toMatch(/href="#(?!\/)/);
  });

  it("schuift blokken in beeld met een eigen functie", () => {
    expect(pagina).toContain("function naarSectie");
    expect(pagina).toContain('naarSectie("contact")');
    expect(pagina).toContain('naarSectie("werking")');
  });

  it("verwijst naar bestaande routes van de app", () => {
    for (const pad of ["/mijn", "/coach", "/organisatie", "/instrumenten"]) {
      expect(pagina).toContain(`href="${pad}"`);
      expect(app).toContain(`path="${pad}"`);
    }
  });

  it("de blokken waarnaar verwezen wordt, bestaan op de pagina", () => {
    for (const id of ["contact", "werking", "aanmelden"]) {
      expect(pagina).toContain(`id="${id}"`);
    }
  });
});
