import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { T4TEENS_DOELGROEP } from "../shared/doelgroep-leeftijd";
import {
  MINDERJARIGE_INSTRUMENTEN,
  toegestaneBandenVoor,
  valideerLeeftijdspoort,
  vereistOuderlijkeToestemming,
  LEEFTIJDSBANDEN,
} from "../shared/leeftijd";

// ---------------------------------------------------------------------------
// Punt 10 uit fase 1: de ondergrens van de doelgroep van T4Students.
//
// ER IS HIER MET OPZET NIETS GEREPAREERD
// De opdracht is uitdrukkelijk: dit niet zelf herstellen. Het raakt wie welk
// instrument mag invullen, en dat is een beleidskeuze van de opdrachtgever, met
// een deontologische en een AVG-kant. Deze test meet wat er vandaag gebeurt en
// legt dat vast, zodat het niet ongemerkt schuift en zodat de keuze op tafel
// ligt met de gevolgen erbij.
//
// WAT ER GEMETEN IS
// Drie plaatsen spreken over de leeftijd van dit instrument:
//   1. server/data/t4students.json: "jongvolwassenen (17-23 jaar)"
//   2. server/registry.ts: leest de grens uit shared/doelgroep-leeftijd.ts
//   3. shared/doelgroep-leeftijd.ts: T4Teens loopt tot en met 17, en de
//      opmerking daar zegt "Daarboven is T4Students het passende instrument",
//      wat 18 als ondergrens impliceert.
// Punt 1 en 2 zeggen 17. Punt 3 impliceert 18. Zeventien jaar valt dus in
// allebei de instrumenten tegelijk, of in geen van beide, afhankelijk van welke
// zin je gelooft.
//
// WAT ER MET EEN ZEVENTIENJARIGE GEBEURT
// Bij T4Teens komt hij door de leeftijdspoort in band "16-17", zonder
// ouderlijke toestemming. Bij T4Students komt hij er ook door, maar om een
// heel andere reden: t4students staat niet in MINDERJARIGE_INSTRUMENTEN, dus de
// poort wordt voor dit instrument helemaal niet toegepast. Er wordt niet eens
// naar een leeftijdsband gevraagd. Praktisch gevolg: niet alleen een
// zeventienjarige, maar ook een twaalfjarige kan een afname van T4Students
// starten en afronden, zonder band en zonder ouderlijke bevestiging.
//
// WAT ER BIJ HET METEN ONVERWACHT BOVENKWAM
// Het instrument vraagt wel degelijk naar een leeftijd, maar als optioneel
// veld, en geen enkele regel code leest het. Het kan dus geen grens
// handhaven; wie dat wil, moet in de leeftijdspoort zijn.
//
// De drie mogelijkheden en hun gevolgen staan in het verslag van fase 1c.
// ---------------------------------------------------------------------------

describe("punt 10: de doelgroepgrens van T4Students is niet beslist", () => {
  it("het instrument zelf noemt 17 als ondergrens", () => {
    expect(I.description).toContain("jongvolwassenen (17-23 jaar)");
  });

  it("T4Teens loopt tot en met datzelfde jaar, dus 17 valt in allebei", () => {
    expect(T4TEENS_DOELGROEP.maxLeeftijd).toBe(17);
    // De band waarin een zeventienjarige bij T4Teens valt bestaat en is
    // toegestaan, zonder ouderlijke toestemming.
    expect(toegestaneBandenVoor("t4teens")).toContain("16-17");
    expect(vereistOuderlijkeToestemming("t4teens", "16-17")).toBe(false);
    const teens = valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "16-17" });
    expect(teens.ok).toBe(true);
  });

  it("voor T4Students geldt de leeftijdspoort helemaal niet", () => {
    expect(MINDERJARIGE_INSTRUMENTEN).not.toContain("t4students");
    expect(toegestaneBandenVoor("t4students")).toBeNull();
    expect(vereistOuderlijkeToestemming("t4students", "13-15")).toBe(false);
  });

  it("daardoor komt elke leeftijd door de poort, ook zonder band", () => {
    // Zonder band: geen enkele vraag, meteen ok.
    const zonderBand = valideerLeeftijdspoort({ instrumentId: "t4students" });
    expect(zonderBand).toEqual({ ok: true, band: null, ouderlijkeToestemmingVereist: false });

    // Met eender welke band, ook de jongste: ook ok, en de band wordt niet
    // eens teruggegeven. Dit is het punt dat voorgelegd wordt.
    for (const band of LEEFTIJDSBANDEN) {
      const r = valideerLeeftijdspoort({ instrumentId: "t4students", leeftijdsband: band });
      expect(r, `band ${band} zou vandaag geweigerd moeten worden als 18 de grens is`).toEqual({
        ok: true,
        band: null,
        ouderlijkeToestemmingVereist: false,
      });
    }
  });

  it("het instrument vraagt wel een leeftijd, maar vrijblijvend", () => {
    // Verrast: er staat wel degelijk een leeftijdsveld in het instrument. Het
    // is alleen optioneel, dus een deelnemer mag het leeg laten. Een optioneel
    // veld kan geen grens afdwingen. Wie de grens wil handhaven, moet dat in de
    // leeftijdspoort doen en niet in dit veld.
    expect(I.identity.required).toEqual(["respondentCode", "name"]);
    expect(I.identity.optional).toContain("leeftijd");
  });

  it("en niets in de motor of de poort kijkt naar dat veld", () => {
    // De scoringsmotor rekent zonder leeftijd, en de poort krijgt alleen een
    // band mee, nooit dit veld. Het staat er dus wel, maar het doet niets.
    const motor = readFileSync(
      path.resolve(__dirname, "../server/t4students/kompas-scoring.ts"),
      "utf-8",
    );
    expect(motor).not.toMatch(/\bleeftijd\b/);
    const poort = readFileSync(path.resolve(__dirname, "../shared/leeftijd.ts"), "utf-8");
    expect(poort).not.toContain("t4students");
  });
});
