import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { T4TEENS_DOELGROEP } from "../shared/doelgroep-leeftijd";
import {
  MINDERJARIGE_INSTRUMENTEN,
  LEEFTIJDSPOORT_INSTRUMENTEN,
  geldtLeeftijdspoort,
  toegestaneBandenVoor,
  valideerLeeftijdspoort,
  vereistOuderlijkeToestemming,
} from "../shared/leeftijd";

// ---------------------------------------------------------------------------
// Punt 10 uit fase 1, en bevinding 07 uit het privacydossier: de ondergrens van
// de doelgroep van T4Students.
//
// WAT ER EERDER GEMETEN WERD
// T4Students stond niet in de leeftijdspoort. Praktisch gevolg: niet alleen een
// zeventienjarige, maar ook een twaalfjarige kon een afname van T4Students
// starten en afronden, zonder leeftijdsband en zonder enige weigering. De vorige
// versie van deze test legde die toestand vast en liet de keuze aan de
// opdrachtgever, want ze raakt wie welk instrument mag invullen.
//
// WAT ER NU BESLIST IS
// De opdrachtgever heeft gekozen: T4Students valt binnen de leeftijdspoort, met
// zestien als ondergrens.
//   - Er wordt een leeftijdsband gevraagd; zonder band gaat de afname niet door.
//   - Enkel "16-17" en "18+" worden aanvaard. Jonger wordt netjes geweigerd met
//     de verwijzing naar de begeleider.
//   - Er is GEEN ouderlijke toestemming vereist: vanaf zestien mag de jongere in
//     Belgie zelfstandig toestemmen (AVG art. 8 plus het beleid van TaPasCity,
//     dat zelfstandige toestemming vanaf zestien aanhoudt).
//
// WAAROM TWEE REEKSEN
// MINDERJARIGE_INSTRUMENTEN blijft beperkt tot T4Kids en T4Teens: die reeks
// bestuurt de ouderlijke toestemming, ook op het aankooppad. Zou T4Students daar
// bijstaan, dan zou een meerderjarige student bij aankoop plots een ouderlijke
// bevestiging moeten geven. Voor de band zelf is er een ruimere reeks,
// LEEFTIJDSPOORT_INSTRUMENTEN, waar T4Students wel in staat.
//
// WAT ER BIJ HET METEN BOVENKWAM EN NIET VERANDERD IS
// Het instrument vraagt zelf ook een leeftijd, maar als optioneel veld dat geen
// enkele regel code leest. Een optioneel veld kan geen grens handhaven; de grens
// zit in de poort. Dat veld blijft ongemoeid.
// ---------------------------------------------------------------------------

describe("bevinding 07: T4Students valt binnen de leeftijdspoort, ondergrens 16", () => {
  it("het instrument zelf noemt 17 als ondergrens", () => {
    expect(I.description).toContain("jongvolwassenen (17-23 jaar)");
  });

  it("T4Teens loopt tot en met datzelfde jaar, dus 17 valt in allebei", () => {
    expect(T4TEENS_DOELGROEP.maxLeeftijd).toBe(17);
    expect(toegestaneBandenVoor("t4teens")).toContain("16-17");
    expect(vereistOuderlijkeToestemming("t4teens", "16-17")).toBe(false);
    const teens = valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "16-17" });
    expect(teens.ok).toBe(true);
  });

  it("de poort geldt nu wel voor T4Students, met 16-17 en 18+ als banden", () => {
    expect(geldtLeeftijdspoort("t4students")).toBe(true);
    expect(LEEFTIJDSPOORT_INSTRUMENTEN).toContain("t4students");
    expect(toegestaneBandenVoor("t4students")).toEqual(["16-17", "18+"]);
  });

  it("maar T4Students vraagt geen ouderlijke toestemming", () => {
    // De reeks die de ouderlijke toestemming bestuurt blijft beperkt tot de twee
    // instrumenten die zich op kinderen onder de zestien richten.
    expect(MINDERJARIGE_INSTRUMENTEN).not.toContain("t4students");
    expect(vereistOuderlijkeToestemming("t4students", "16-17")).toBe(false);
    expect(vereistOuderlijkeToestemming("t4students", "18+")).toBe(false);
  });

  it("zonder leeftijdsband gaat een afname van T4Students niet door", () => {
    const zonderBand = valideerLeeftijdspoort({ instrumentId: "t4students" });
    expect(zonderBand.ok).toBe(false);
  });

  it("een te jonge deelnemer wordt geweigerd, zestien en ouder komt door", () => {
    for (const band of ["10-12", "13-15"] as const) {
      const r = valideerLeeftijdspoort({ instrumentId: "t4students", leeftijdsband: band });
      expect(r.ok, `band ${band} hoort geweigerd te worden`).toBe(false);
      if (!r.ok) expect(r.fout).toContain("T4Students");
    }
    for (const band of ["16-17", "18+"] as const) {
      const r = valideerLeeftijdspoort({ instrumentId: "t4students", leeftijdsband: band });
      expect(r, `band ${band} hoort aanvaard te worden`).toEqual({
        ok: true,
        band,
        ouderlijkeToestemmingVereist: false,
      });
    }
  });

  it("het instrument vraagt wel een leeftijd, maar vrijblijvend", () => {
    // Onveranderd gelaten: een optioneel veld kan geen grens afdwingen. De grens
    // zit in de poort, niet hier.
    expect(I.identity.required).toEqual(["respondentCode", "name"]);
    expect(I.identity.optional).toContain("leeftijd");
  });

  it("de motor rekent nog altijd zonder dat veld", () => {
    const motor = readFileSync(
      path.resolve(__dirname, "../server/t4students/kompas-scoring.ts"),
      "utf-8",
    );
    expect(motor).not.toMatch(/\bleeftijd\b/);
  });
});
