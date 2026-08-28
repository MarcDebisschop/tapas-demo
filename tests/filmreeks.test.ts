// ---------------------------------------------------------------------------
// tests/filmreeks.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. De twee nieuwe films van de reeks staan werkelijk in de map die de
//      webserver uitlevert, met beeld, posterbeeld en ondertitelspoor.
//   B. Elk ondertitelspoor is geldig WebVTT, loopt oplopend en blijft binnen de
//      gemeten speelduur van de bijhorende film.
//   C. De twee trajectpagina's dragen hun eigen film aan, elk met een eigen
//      merkteken, en vermengen de journeys niet.
//   D. De journey Recruitment & Role Fit heeft een pagina, een route en een
//      eigen stappenreeks die uit de module zelf komt.
//   E. Geen liggend streepje van het lange soort in wat de bezoeker leest.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { CLUSTERS, RR_STAPPEN, RR_UITKOMST } from "../client/src/data/oplossingen";

const pad = (p: string) => resolve(__dirname, "..", p);
const paginaLeiderschap = readFileSync(pad("client/src/pages/journey-leiderschap.tsx"), "utf8");
const paginaRecruitment = readFileSync(pad("client/src/pages/journey-recruitment.tsx"), "utf8");
const app = readFileSync(pad("client/src/App.tsx"), "utf8");
const vttLte = readFileSync(pad("client/public/film/lte-nl.vtt"), "utf8");
const vttRrf = readFileSync(pad("client/public/film/rrf-nl.vtt"), "utf8");

// De gemeten speelduur van elke film, in seconden. Geen ondertitelregel mag
// daarbuiten vallen; de laatste seconden zijn het rustpunt op de slotkaart.
const DUUR = { lte: 80.88, rrf: 76.44 };

describe("A. De bestanden van de reeks staan er echt", () => {
  it("beeld, poster en ondertitels bestaan en zijn niet leeg", () => {
    for (const naam of [
      "lte-nl.mp4",
      "lte-nl-beeld.jpg",
      "lte-nl.vtt",
      "rrf-nl.mp4",
      "rrf-nl-beeld.jpg",
      "rrf-nl.vtt",
    ]) {
      const p = pad(`client/public/film/${naam}`);
      expect(existsSync(p), naam).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(1000);
    }
  });
});

describe("B. De ondertitelsporen zijn geldig en lopen binnen de film", () => {
  it.each([
    ["leiderschap", vttLte, DUUR.lte],
    ["recruitment", vttRrf, DUUR.rrf],
  ])("het spoor van %s is geldig WebVTT", (_naam, spoor, duur) => {
    expect(spoor.startsWith("WEBVTT")).toBe(true);
    const tijden = [
      ...spoor.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> (\d\d):(\d\d):(\d\d)\.(\d\d\d)/g),
    ];
    expect(tijden.length).toBeGreaterThan(10);
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

  it("elke film begint met een rustpunt in beeld voor het eerste woord valt", () => {
    for (const spoor of [vttLte, vttRrf]) {
      const eerste = spoor.match(/00:00:(\d\d)\.(\d\d\d) -->/);
      expect(eerste).not.toBeNull();
      const start = Number(eerste![1]) + Number(eerste![2]) / 1000;
      expect(start).toBeGreaterThanOrEqual(1.2);
    }
  });

  it("de slotregels zijn de gesproken slotregels van elke film", () => {
    expect(vttLte).toContain("De beslissing blijft bij de organisatie.");
    expect(vttRrf).toContain("De organisatie beslist.");
  });
});

describe("C. Elke trajectpagina draagt haar eigen film aan", () => {
  it("Leadership & Team Energy heeft de eigen film", () => {
    expect(paginaLeiderschap).toContain('bron: "/film/lte-nl.mp4"');
    expect(paginaLeiderschap).toContain('poster: "/film/lte-nl-beeld.jpg"');
    expect(paginaLeiderschap).toContain('ondertitels: "/film/lte-nl.vtt"');
    expect(paginaLeiderschap).toContain('testid: "lte-film"');
  });

  it("Recruitment & Role Fit heeft de eigen film", () => {
    expect(paginaRecruitment).toContain('bron: "/film/rrf-nl.mp4"');
    expect(paginaRecruitment).toContain('poster: "/film/rrf-nl-beeld.jpg"');
    expect(paginaRecruitment).toContain('ondertitels: "/film/rrf-nl.vtt"');
    expect(paginaRecruitment).toContain('testid: "rrf-film"');
  });

  it("de journeys vermengen niet: geen enkele pagina draagt de film van een andere", () => {
    expect(paginaLeiderschap).not.toContain("rrf-nl");
    expect(paginaLeiderschap).not.toContain("hdd-nl");
    expect(paginaRecruitment).not.toContain("lte-nl");
    expect(paginaRecruitment).not.toContain("hdd-nl");
    expect(paginaRecruitment).not.toContain("tapas-core-nl");
  });
});

describe("D. De journey Recruitment & Role Fit staat volledig in het platform", () => {
  it("het cluster heeft een eigen pad met de tekst van het dossier", () => {
    const c = CLUSTERS.find((x) => x.sleutel === "recruitment")!;
    expect(c.naam).toBe("Recruitment & Role Fit");
    expect(c.pad).toBe("/oplossingen/recruitment-role-fit");
    expect(c.beslissing).toBe(
      "Welke kandidaat past werkelijk bij deze rol, dit team en deze context?",
    );
    expect(c.ondertitel).toBe(
      "Aanwervingsbeslissingen onderbouwen met talent, drivers, energie en context-fit.",
    );
    expect(c.doelgroep).toBe(
      "HR-verantwoordelijken, recruiters en leidinggevenden die sterker en eerlijker willen aanwerven.",
    );
    // T4Recruitment blijft de instrumentnaam onder de journey.
    expect(c.instrumenten).toContain("T4Recruitment");
    expect(c.prijssignaal).toContain("225 euro per kandidaat");
  });

  it("de route staat naast de twee bestaande trajectroutes", () => {
    expect(app).toContain('<Route path="/oplossingen/recruitment-role-fit"');
    expect(app).toContain("JourneyRecruitment");
    // De bestaande routes blijven staan.
    expect(app).toContain('<Route path="/oplossingen/human-due-diligence"');
    expect(app).toContain('<Route path="/oplossingen/leadership-team-energy"');
  });

  it("het traject heeft vijf stappen en een uitkomst per stap benoemd", () => {
    expect(RR_STAPPEN).toHaveLength(5);
    expect(RR_STAPPEN.map((s) => s.nummer)).toEqual([1, 2, 3, 4, 5]);
    for (const s of RR_STAPPEN) {
      expect(s.naam.length).toBeGreaterThan(3);
      expect(s.inhoud.length).toBeGreaterThan(40);
      expect(s.duur.length).toBeGreaterThan(3);
    }
    expect(RR_UITKOMST.length).toBeGreaterThanOrEqual(4);
  });

  it("de pagina belooft geen selectiebeslissing en geen voorspelling", () => {
    // De grens staat in de tweetalige catalogus, de pagina haalt ze per taal op.
    const tekstenPaginas = readFileSync(pad("client/src/publiek/teksten-paginas.ts"), "utf8");
    expect(tekstenPaginas).toContain("Geen automatische selectie");
    expect(tekstenPaginas).toContain("geen voorspelling van toekomstige prestaties");
    expect(paginaRecruitment).not.toContain("de juiste persoon meteen");
  });
});

describe("E. Taal", () => {
  it("geen liggend streepje van het lange soort", () => {
    for (const bron of [paginaLeiderschap, paginaRecruitment, vttLte, vttRrf]) {
      expect(bron).not.toMatch(/[\u2013\u2014]/);
    }
    for (const s of [...RR_STAPPEN, ...RR_UITKOMST.map((u) => ({ inhoud: u }))]) {
      expect(JSON.stringify(s)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
