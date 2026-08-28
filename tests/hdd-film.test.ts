// ---------------------------------------------------------------------------
// tests/hdd-film.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. De film van Human Due Diligence staat op de publieke trajectpagina, met
//      een posterbeeld en een ondertitelspoor, en speelt niet uit zichzelf.
//   B. De bestanden van beide taalversies staan werkelijk in de map die de
//      webserver uitlevert, en elk ondertitelspoor is een geldig WebVTT-bestand
//      dat gelijk loopt met de gesproken tekst.
//   B2. De bezoeker kan tussen de Nederlandse en de Engelse film kiezen.
//   C. Het geraamte van de trajectpagina laat de film weg wanneer een traject
//      er geen heeft: het blok staat achter een voorwaarde en het veld is
//      optioneel.
//   D. De film van het platform zelf blijft staan waar ze stond, in de demo.
//   E. Geen enkel liggend streepje van het lange soort in wat de bezoeker leest.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const pad = (p: string) => resolve(__dirname, "..", p);
const paginaHdd = readFileSync(pad("client/src/pages/journey-hdd.tsx"), "utf8");
const geraamte = readFileSync(pad("client/src/components/TrajectPagina.tsx"), "utf8");
const demo = readFileSync(pad("client/src/pages/demo.tsx"), "utf8");
const vtt = readFileSync(pad("client/public/film/hdd-nl.vtt"), "utf8");
const vttEn = readFileSync(pad("client/public/film/hdd-en.vtt"), "utf8");
const css = readFileSync(pad("client/src/pages/publiek.css"), "utf8");

// De speelduur van elke film, in seconden. Geen ondertitelregel mag daarbuiten
// vallen; de laatste seconden zijn het rustpunt op de slotkaart.
const DUUR = { nl: 76.6, en: 96.7 };

describe("A. De film staat op de trajectpagina", () => {
  it("de pagina draagt de film aan met bron, poster en ondertitels", () => {
    expect(paginaHdd).toContain('bron: "/film/hdd-nl.mp4"');
    expect(paginaHdd).toContain('poster: "/film/hdd-nl-beeld.jpg"');
    expect(paginaHdd).toContain('ondertitels: "/film/hdd-nl.vtt"');
    expect(paginaHdd).toContain('testid: "hdd-film"');
  });

  it("het geraamte zet beeld, poster en ondertitels van de gekozen versie in de speler", () => {
    expect(geraamte).toContain("<source src={nu.bron}");
    expect(geraamte).toContain("poster={nu.poster}");
    expect(geraamte).toContain("src={nu.ondertitels}");
    expect(geraamte).toContain('kind="subtitles"');
    expect(geraamte).toContain("srcLang={nu.taal}");
  });

  it("de film speelt niet uit zichzelf en laadt niet ongevraagd", () => {
    const speler = geraamte.slice(geraamte.indexOf("<video"), geraamte.indexOf("</video>"));
    expect(speler).toContain("controls");
    expect(speler).toContain('preload="none"');
    expect(speler).toContain("playsInline");
    expect(speler).not.toContain("autoPlay");
  });

  it("er staat een uitweg voor wie de film niet kan spelen", () => {
    // Het tekstalternatief staat in de tweetalige catalogus; het geraamte
    // haalt het per taal op.
    expect(geraamte).toContain("kies(T.traject.geenFilm, taal)");
    const teksten = readFileSync(pad("client/src/publiek/teksten-paginas.ts"), "utf8");
    expect(teksten).toContain("Uw browser kan deze film niet spelen");
    expect(teksten).toContain("Your browser cannot play this film");
  });
});

describe("B. De bestanden staan er echt", () => {
  it("beeld, poster en ondertitels bestaan en zijn niet leeg, in beide talen", () => {
    for (const naam of [
      "hdd-nl.mp4",
      "hdd-nl-beeld.jpg",
      "hdd-nl.vtt",
      "hdd-en.mp4",
      "hdd-en-beeld.jpg",
      "hdd-en.vtt",
    ]) {
      const p = pad(`client/public/film/${naam}`);
      expect(existsSync(p), naam).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(1000);
    }
  });

  it.each([
    ["nl", vtt, DUUR.nl],
    ["en", vttEn, DUUR.en],
  ])("het ondertitelspoor %s is geldig WebVTT en loopt binnen de speelduur", (_taal, spoor, duur) => {
    expect(spoor.startsWith("WEBVTT")).toBe(true);
    const tijden = [...spoor.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> (\d\d):(\d\d):(\d\d)\.(\d\d\d)/g)];
    expect(tijden.length).toBeGreaterThan(15);
    const sec = (u: string, m: string, s: string, ms: string) =>
      Number(u) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
    let vorigEinde = 0;
    for (const t of tijden) {
      const van = sec(t[1], t[2], t[3], t[4]);
      const tot = sec(t[5], t[6], t[7], t[8]);
      expect(tot).toBeGreaterThan(van);
      expect(van).toBeGreaterThanOrEqual(vorigEinde);
      vorigEinde = tot;
    }
    expect(vorigEinde).toBeLessThanOrEqual(duur);
  });

  it("de slotregels staan op de gemeten onzet van de stem, niet op een schatting", () => {
    // De drie regels van de slotkaart vallen samen met het gesproken woord.
    for (const merk of ["01:08.385", "01:09.903", "01:10.784"]) {
      expect(vtt).toContain(merk);
    }
  });

  it("de eerste en de laatste regel zijn de gesproken tekst", () => {
    expect(vtt).toContain("Een overname.");
    expect(vtt).toContain("Wie beslist, blijft de organisatie.");
    expect(vtt).toContain("één voor het team zelf.");
  });

  it("het Engelse spoor is werkelijk Engels", () => {
    expect(vttEn).toContain("An acquisition.");
    expect(vttEn).toContain("The organisation is the one who decides.");
  });
});

describe("B2. De bezoeker kiest de taal van de film", () => {
  it("de pagina draagt beide taalversies aan", () => {
    expect(paginaHdd).toContain('taal: "nl"');
    expect(paginaHdd).toContain('taal: "en"');
    expect(paginaHdd).toContain('bron: "/film/hdd-en.mp4"');
    expect(paginaHdd).toContain('poster: "/film/hdd-en-beeld.jpg"');
    expect(paginaHdd).toContain('ondertitels: "/film/hdd-en.vtt"');
  });

  it("het geraamte zet er een keuze boven de speler", () => {
    expect(geraamte).toContain("versies.length > 1");
    expect(geraamte).toContain('data-testid={`film-taal-${v.taal}`}');
    expect(geraamte).toContain("aria-pressed={i === versie}");
    // de speler laadt opnieuw bij een andere taal
    expect(geraamte).toContain("key={nu.bron}");
  });

  it("een traject met één versie houdt zijn speler zoals hij was", () => {
    expect(geraamte).toContain("versies?: FilmVersie[];");
    expect(geraamte).toMatch(/inhoud\.film\.versies && inhoud\.film\.versies\.length > 0/);
  });

  it("de keuze heeft een stijl in het publieke blad", () => {
    expect(css).toContain(".publiek .film-talen");
    expect(css).toContain(".publiek .film-taal.aan");
  });
});

describe("C. Een traject zonder film houdt zijn pagina", () => {
  it("het blok staat achter een voorwaarde", () => {
    expect(geraamte).toContain("{inhoud.film && (");
    expect(geraamte).toMatch(/film\?: TrajectFilm;/);
  });

  it("zonder film blijft de lijst met versies leeg en valt het blok weg", () => {
    expect(geraamte).toMatch(/film\?: TrajectFilm;/);
    expect(geraamte).toContain(": [];");
  });
});

describe("D. De film van het platform blijft in de demo", () => {
  it("de demo houdt haar eigen film", () => {
    expect(demo).toContain('<source src="/film/tapas-core-nl.mp4" type="video/mp4" />');
    expect(demo).toContain('data-testid="demo-film"');
  });

  it("de trajectpagina neemt die film niet over", () => {
    expect(paginaHdd).not.toContain("tapas-core-nl");
  });
});

describe("E. Taal", () => {
  it("geen liggend streepje van het lange soort", () => {
    for (const bron of [paginaHdd, geraamte, vtt, vttEn]) {
      expect(bron).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
