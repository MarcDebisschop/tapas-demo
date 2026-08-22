// Bewaakt de canonieke naam van de invulindex. De index onder
// `meta.consistency` is geen psychometrische betrouwbaarheidsmaat en mag
// daarom nergens meer als "invulzorgvuldigheid" aan een lezer worden getoond.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  INVULLING_NAAM,
  INVULLING_NAAM_KORT,
  INVULLING_NAAM_WOORDEN,
  INVULLING_GEEN_BETROUWBAARHEID,
  INVULLING_GRENS_HOOG,
  INVULLING_GRENS_MIDDEN,
  invullingNaam,
  invullingGeenBetrouwbaarheid,
} from "../shared/invulling-index";
import { TALEN } from "../shared/talen";

const wortel = join(__dirname, "..");
const lees = (p: string): string => readFileSync(join(wortel, p), "utf-8");

describe("canonieke naam van de invulindex", () => {
  it("bestaat in alle ondersteunde talen", () => {
    for (const taal of TALEN) {
      for (const tabel of [
        INVULLING_NAAM,
        INVULLING_NAAM_KORT,
        INVULLING_NAAM_WOORDEN,
        INVULLING_GEEN_BETROUWBAARHEID,
      ]) {
        expect(String((tabel as Record<string, string>)[taal] ?? "").length).toBeGreaterThan(5);
      }
    }
  });

  it("valt terug op het Nederlands bij een onbekende taal", () => {
    expect(invullingNaam("kl")).toBe(INVULLING_NAAM.nl);
    expect(invullingGeenBetrouwbaarheid(undefined)).toBe(INVULLING_GEEN_BETROUWBAARHEID.nl);
  });

  it("noemt de Nederlandse naam volledigheid en samenhang", () => {
    expect(INVULLING_NAAM.nl).toBe("Volledigheid en samenhang van de invulling");
  });

  it("zegt expliciet dat het geen betrouwbaarheidsmaat is", () => {
    expect(INVULLING_GEEN_BETROUWBAARHEID.nl.toLowerCase()).toContain("geen betrouwbaarheidsmaat");
    expect(INVULLING_GEEN_BETROUWBAARHEID.nl.toLowerCase()).toContain("psychometrische");
  });

  it("houdt de labelgrenzen als ontwerpconventie vast", () => {
    expect(INVULLING_GRENS_HOOG).toBe(80);
    expect(INVULLING_GRENS_MIDDEN).toBe(60);
  });
});

describe("geen zichtbare oude naam meer", () => {
  const bestanden = [
    "server/t4p/kompas-contract.ts",
    "server/t4p/rapport.ts",
    "server/chat.ts",
    "server/chat-engine.ts",
    "server/dashboard.ts",
    "client/src/pages/admin-detail.tsx",
    "client/src/pages/admin-credits.tsx",
  ];

  it("gebruikt de term invulzorgvuldigheid niet meer in zichtbare tekst", () => {
    const treffers: string[] = [];
    for (const bestand of bestanden) {
      const inhoud = lees(bestand);
      for (const regel of inhoud.split("\n")) {
        const schoon = regel.trim();
        // Commentaar en interne sleutelnamen mogen de oude term nog bevatten.
        if (schoon.startsWith("//") || schoon.startsWith("*")) continue;
        if (/kaartInvulzorgvuldigheid|invulzorgvuldigheid_uitleg|ind_invulzorgvuldigheid|invulzorgvuldigheidLaag/.test(schoon)) continue;
        if (/invulzorgvuldigheid/i.test(schoon)) treffers.push(`${bestand}: ${schoon.slice(0, 90)}`);
      }
    }
    expect(treffers).toEqual([]);
  });

  it("laat het T4Business-rapport zeggen dat het cijfer geen betrouwbaarheidsmaat is", () => {
    const inhoud = lees("server/t4p/kompas-contract.ts");
    expect(inhoud).toContain("INVULLING_GEEN_BETROUWBAARHEID");
  });

  it("laat de meertalige rapportgenerator de canonieke naam gebruiken", () => {
    const inhoud = lees("server/rapportgenerator.ts");
    expect(inhoud).toContain("INVULLING_NAAM_KORT.nl");
  });
});
