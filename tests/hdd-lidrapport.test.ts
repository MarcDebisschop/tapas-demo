import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// De begeleider leest de rapporten van één lid via het traject, niet via de link
// van het lid. Deze test legt die weg vast, want ze bestaat precies om de
// rapportsluis niet in de weg te laten staan bij de begeleider.

const leden: any[] = [];
const tokens = new Map<number, Record<string, string>>();
const teamscanDeelnemers = new Map<string, any>();
const teamscanAntwoorden = new Map<number, any>();
let bewaardeAfname: any = null;
let kompasAfname: any = null;

vi.mock("../server/hdd/storage", () => ({
  hddStorage: {
    getTokens: (lidId: number) => tokens.get(lidId) ?? {},
    getTeamscanDeelnemerViaToken: (token: string) => teamscanDeelnemers.get(token),
    getTeamscanAntwoorden: (id: number) => teamscanAntwoorden.get(id) ?? null,
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getAfnameByToken: async () => kompasAfname,
  },
}));

vi.mock("../server/teamscan/scoring", () => ({
  scoorIndividueel: () => ({ fundament: { gemiddelde: 4 } }),
}));

vi.mock("../server/teamscan/rapport", () => ({
  renderIndividueelRapport: (_r: any, label: string) => `<html><body>${label}</body></html>`,
}));

vi.mock("../server/twominscan/afname-opslag", () => ({
  leesAfnameVoor: () => bewaardeAfname,
}));

const { leesLidRapportBronnen, teamscanAlsHtml } = await import("../server/hdd/lidrapport");

const traject: any = { id: 7, orgLabel: "Organisatie A", status: "fase1_open" };
const lid: any = { id: 3, naam: "Herman Van Esbroeck", email: "h@example.com", rapportVrijgaveOp: null };

beforeEach(() => {
  tokens.clear();
  teamscanDeelnemers.clear();
  teamscanAntwoorden.clear();
  bewaardeAfname = null;
  kompasAfname = null;
  leden.length = 0;
});

describe("de rapporten van één lid, gelezen door de begeleider", () => {
  it("meldt per instrument dat er nog niets is zolang er geen link uit staat", async () => {
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.teamscan).toEqual({ uitgestuurd: false, ingevuld: false, label: null, resultaat: null });
    expect(bronnen.twominscan.ingevuld).toBe(false);
    expect(bronnen.kompas).toEqual({ uitgestuurd: false, ingevuld: false, afnameId: null, status: null });
    expect(bronnen.lid.naam).toBe("Herman Van Esbroeck");
    expect(bronnen.lid.vrijgegeven).toBe(false);
  });

  it("geeft het Teamscan-resultaat zonder langs de sluis te gaan", async () => {
    tokens.set(3, { "tapas-teamscan": "tok-ts" });
    teamscanDeelnemers.set("tok-ts", { id: 11, label: "Herman" });
    teamscanAntwoorden.set(11, { fundament: {} });
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.teamscan.ingevuld).toBe(true);
    expect(bronnen.teamscan.label).toBe("Herman");
    expect(teamscanAlsHtml(lid)).toContain("Herman");
  });

  it("meldt een Teamscan die uit staat maar nog niet ingevuld is", async () => {
    tokens.set(3, { "tapas-teamscan": "tok-ts" });
    teamscanDeelnemers.set("tok-ts", { id: 11, label: "Herman" });
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.teamscan.uitgestuurd).toBe(true);
    expect(bronnen.teamscan.ingevuld).toBe(false);
    expect(teamscanAlsHtml(lid)).toBeNull();
  });

  it("noemt een 2MINSCAN herbouwbaar wanneer de uitkomst bewaard is", async () => {
    tokens.set(3, { twominscan: "tok-ms" });
    bewaardeAfname = {
      id: 1,
      naam: "Herman Van Esbroeck",
      organisatie: "Organisatie A",
      rol: "",
      egCode: "RgEEO-a",
      wielpositie: "24-44",
      taal: "nl",
      datum: "21/9/2026",
      bewaardOp: "2026-09-21T07:00:00.000Z",
      rapport: {
        score: { blauw: 2, groen: 9, geel: 10, rood: 3 },
        ie: { uitkomst: "meer_extravert", label: "uitgesproken extravert", verschil: -3, xStand: "EE" },
        egCode: "RgEEO-a",
        egCodePositief: "RgEEO",
        minSegment: "-a",
        profielCode: "RgXO-a",
        exact: true,
      },
    };
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.twominscan.ingevuld).toBe(true);
    expect(bronnen.twominscan.herbouwbaar).toBe(true);
  });

  it("noemt een oude 2MINSCAN ingevuld maar niet herbouwbaar", async () => {
    tokens.set(3, { twominscan: "tok-ms" });
    bewaardeAfname = { id: 1, naam: "Herman Van Esbroeck", organisatie: "Organisatie A", rol: "", egCode: "", wielpositie: "24-44", taal: "nl", datum: "", bewaardOp: "2026-09-20T07:00:00.000Z", rapport: null };
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.twominscan.ingevuld).toBe(true);
    expect(bronnen.twominscan.herbouwbaar).toBe(false);
  });

  it("wijst naar de afname van het Kompas zodra fase 2 loopt", async () => {
    tokens.set(3, { "t4p-business-kompas": "tok-k" });
    kompasAfname = { id: 42, status: "voltooid" };
    const bronnen = await leesLidRapportBronnen(traject, lid);
    expect(bronnen.kompas).toEqual({ uitgestuurd: true, ingevuld: true, afnameId: 42, status: "voltooid" });
  });
});

describe("het scherm van de begeleider", () => {
  const pagina = readFileSync(resolve(import.meta.dirname, "../client/src/pages/hdd-lid-rapport.tsx"), "utf8");
  const traject = readFileSync(resolve(import.meta.dirname, "../client/src/pages/hdd-traject.tsx"), "utf8");

  it("leest de bronnen achter de beheerderslogin", () => {
    expect(pagina).toContain("/rapportbronnen");
    expect(pagina).toContain("/teamscan-rapport");
  });

  it("opent het 2MINSCAN-rapport zonder uitnodiging, dus buiten de sluis", () => {
    expect(pagina).toContain("#/2minscan/rapport");
    expect(pagina).not.toContain("uitnodiging:");
  });

  it("staat als knop bij elk lid op het trajectscherm", () => {
    expect(traject).toContain("button-rapport-lid-");
    expect(traject).toContain("/lid/${lid.id}");
  });

  it("gebruikt nergens een lang of half lang streepje", () => {
    for (const tekst of [pagina, traject]) {
      expect(tekst.includes(String.fromCharCode(0x2014))).toBe(false);
      expect(tekst.includes(String.fromCharCode(0x2013))).toBe(false);
    }
  });
});
