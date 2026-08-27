// ---------------------------------------------------------------------------
// tests/hdd-film.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. De film van Human Due Diligence staat op de publieke trajectpagina, met
//      een posterbeeld en een ondertitelspoor, en speelt niet uit zichzelf.
//   B. De drie bestanden staan werkelijk in de map die de webserver uitlevert,
//      en het ondertitelspoor is een geldig WebVTT-bestand dat gelijk loopt met
//      de gesproken tekst.
//   C. Het geraamte van de trajectpagina laat de film weg wanneer een traject
//      er geen heeft. Leadership & Team Energy blijft dus onaangeroerd.
//   D. De film van het platform zelf blijft staan waar ze stond, in de demo.
//   E. Geen enkel liggend streepje van het lange soort in wat de bezoeker leest.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const pad = (p: string) => resolve(__dirname, "..", p);
const paginaHdd = readFileSync(pad("client/src/pages/journey-hdd.tsx"), "utf8");
const paginaLeiderschap = readFileSync(pad("client/src/pages/journey-leiderschap.tsx"), "utf8");
const geraamte = readFileSync(pad("client/src/components/TrajectPagina.tsx"), "utf8");
const demo = readFileSync(pad("client/src/pages/demo.tsx"), "utf8");
const vtt = readFileSync(pad("client/public/film/hdd-nl.vtt"), "utf8");

describe("A. De film staat op de trajectpagina", () => {
  it("de pagina draagt de film aan met bron, poster en ondertitels", () => {
    expect(paginaHdd).toContain('bron: "/film/hdd-nl.mp4"');
    expect(paginaHdd).toContain('poster: "/film/hdd-nl-beeld.jpg"');
    expect(paginaHdd).toContain('ondertitels: "/film/hdd-nl.vtt"');
    expect(paginaHdd).toContain('testid: "hdd-film"');
  });

  it("het geraamte zet die drie in de speler", () => {
    expect(geraamte).toContain("<source src={inhoud.film.bron}");
    expect(geraamte).toContain("poster={inhoud.film.poster}");
    expect(geraamte).toContain("src={inhoud.film.ondertitels}");
    expect(geraamte).toContain('kind="subtitles"');
    expect(geraamte).toContain('srcLang="nl"');
  });

  it("de film speelt niet uit zichzelf en laadt niet ongevraagd", () => {
    const speler = geraamte.slice(geraamte.indexOf("<video"), geraamte.indexOf("</video>"));
    expect(speler).toContain("controls");
    expect(speler).toContain('preload="none"');
    expect(speler).toContain("playsInline");
    expect(speler).not.toContain("autoPlay");
  });

  it("er staat een uitweg voor wie de film niet kan spelen", () => {
    expect(geraamte).toContain("Uw browser kan deze film niet spelen");
  });
});

describe("B. De bestanden staan er echt", () => {
  it("beeld, poster en ondertitels bestaan en zijn niet leeg", () => {
    for (const naam of ["hdd-nl.mp4", "hdd-nl-beeld.jpg", "hdd-nl.vtt"]) {
      const p = pad(`client/public/film/${naam}`);
      expect(existsSync(p), naam).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(1000);
    }
  });

  it("het ondertitelspoor is geldig WebVTT en loopt binnen de speelduur", () => {
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    const tijden = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> (\d\d):(\d\d):(\d\d)\.(\d\d\d)/g)];
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
    // De film duurt 73,8 seconden. Geen enkele regel mag daarbuiten vallen.
    expect(vorigEinde).toBeLessThanOrEqual(73.8);
  });

  it("de eerste en de laatste regel zijn de gesproken tekst", () => {
    expect(vtt).toContain("Een overname.");
    expect(vtt).toContain("Wie beslist, blijft de organisatie.");
    expect(vtt).toContain("één voor het team zelf.");
  });
});

describe("C. Een traject zonder film houdt zijn pagina", () => {
  it("het blok staat achter een voorwaarde", () => {
    expect(geraamte).toContain("{inhoud.film && (");
    expect(geraamte).toMatch(/film\?: TrajectFilm;/);
  });

  it("Leadership & Team Energy draagt geen film aan", () => {
    expect(paginaLeiderschap).not.toContain("film:");
    expect(paginaLeiderschap).not.toContain(".mp4");
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
    for (const bron of [paginaHdd, geraamte, vtt]) {
      expect(bron).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
