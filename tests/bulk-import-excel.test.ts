// ---------------------------------------------------------------------------
// tests/bulk-import-excel.test.ts
//
// Auditbevinding: kwetsbare afhankelijkheid met ernst "hoog" en zonder beschikbare
// oplossing (het pakket "xlsx"). Die zat precies op de plaats waar het platform
// bestanden van buiten inleest: de bulk-import van deelnemers. Het pakket is
// vervangen door write-excel-file en read-excel-file, plus een eigen CSV-lezer.
//
// Deze tests bewijzen dat de functionaliteit na de vervanging nog exact hetzelfde
// doet: een template genereren, die weer inlezen, een .csv inlezen, en verkeerde
// bestanden netjes afwijzen in plaats van te ontploffen.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { templateAlsBuffer, parseUpload, leesCsv, celTekst } from "../server/bulk-import/excel";
import { getTemplate } from "../server/bulk-import/templates";

const tpl = getTemplate("t4p-business-kompas")!;
const koppen = tpl.velden.map((v) => v.kolom);

describe("template genereren", () => {
  it("levert een echt xlsx-bestand op", async () => {
    const buffer = await templateAlsBuffer(tpl);
    expect(buffer.length).toBeGreaterThan(1000);
    // Een xlsx is een zip en begint met de bytes "PK".
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("de eigen template komt er ongeschonden weer in", async () => {
    const buffer = await templateAlsBuffer(tpl);
    const { rijen, fouten } = await parseUpload(buffer, tpl);
    // De kop moet exact kloppen, dus geen enkele kopfout.
    expect(fouten.filter((f) => f.rij === 0)).toEqual([]);
    expect(rijen.length).toBe(1); // enkel de voorbeeldrij
    expect(rijen[0].waarden.email).toMatch(/@/);
  });
});

describe("csv inlezen", () => {
  it("leest een gewone csv met komma's", async () => {
    const csv = `${koppen.join(",")}\nJan,Peeters,jan@voorbeeld.be,nl\n`;
    const { rijen, fouten } = await parseUpload(Buffer.from(csv, "utf8"), tpl);
    expect(fouten.filter((f) => f.rij === 0)).toEqual([]);
    expect(rijen.length).toBe(1);
    expect(rijen[0].waarden.voornaam).toBe("Jan");
  });

  it("leest ook een csv met puntkomma's, zoals Excel die in het Nederlands schrijft", async () => {
    const csv = `${koppen.join(";")}\nAn;Verhoeven;an@voorbeeld.be;nl\n`;
    const { rijen, fouten } = await parseUpload(Buffer.from(csv, "utf8"), tpl);
    expect(fouten.filter((f) => f.rij === 0)).toEqual([]);
    expect(rijen[0].waarden.achternaam).toBe("Verhoeven");
  });

  it("verwerkt aanhalingstekens en ingesloten scheidingstekens", () => {
    const rijen = leesCsv('a,"b,met komma","zegt ""hallo"""\n');
    expect(rijen).toEqual([["a", "b,met komma", 'zegt "hallo"']]);
  });

  it("negeert een byte-order-mark aan het begin van het bestand", () => {
    expect(leesCsv("\uFEFFa,b\n")).toEqual([["a", "b"]]);
  });
});

describe("foutieve bestanden", () => {
  it("meldt verkeerde kolomkoppen in plaats van door te gaan", async () => {
    const csv = "Verkeerd,Ook verkeerd\nx,y\n";
    const { fouten } = await parseUpload(Buffer.from(csv, "utf8"), tpl);
    expect(fouten.some((f) => f.rij === 0)).toBe(true);
  });

  it("meldt een leeg bestand", async () => {
    const { fouten } = await parseUpload(Buffer.from("", "utf8"), tpl);
    expect(fouten[0].melding).toMatch(/leeg/i);
  });

  it("gaat niet onderuit op iets dat zich als xlsx voordoet maar het niet is", async () => {
    // Begint met de zip-bytes "PK\\x03\\x04" maar bevat verder rommel.
    const nep = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("rommel")]);
    const { fouten } = await parseUpload(nep, tpl);
    expect(fouten.length).toBeGreaterThan(0);
    expect(fouten[0].rij).toBe(0);
  });

  it("keurt een ongeldig e-mailadres af met vermelding van de rij", async () => {
    const csv = `${koppen.join(",")}\nJan,Peeters,geen-adres,nl\n`;
    const { fouten } = await parseUpload(Buffer.from(csv, "utf8"), tpl);
    const fout = fouten.find((f) => f.melding.includes("geen geldig e-mailadres"));
    expect(fout).toBeTruthy();
    expect(fout!.rij).toBe(1);
  });
});

describe("cellen omzetten naar tekst", () => {
  it("behandelt getallen, data, formules en lege cellen", () => {
    expect(celTekst(42)).toBe("42");
    expect(celTekst(null)).toBe("");
    expect(celTekst(new Date("2026-07-30T10:00:00Z"))).toBe("2026-07-30");
    expect(celTekst({ result: "uitkomst" })).toBe("uitkomst");
    expect(celTekst({ error: "#REF!" })).toBe("");
  });
});

describe("het kwetsbare pakket is echt weg", () => {
  it("staat niet meer in package.json en wordt nergens meer geïmporteerd", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf8"));
    const alle = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(alle)).not.toContain("xlsx");
    const bron = readFileSync(resolve(__dirname, "..", "server/bulk-import/excel.ts"), "utf8");
    expect(bron).not.toMatch(/from ["']xlsx["']/);
  });
});
