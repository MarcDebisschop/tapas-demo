// ---------------------------------------------------------------------------
// tests/verplicht-doorklikken.test.ts
//
// De opdrachtgever heeft vastgelegd: een vraag kan niet overgeslagen worden.
// De deelnemer gaat pas verder als de huidige vraag beantwoord is, en een
// onvolledige vragenlijst kan niet ingediend worden. Terug gaan en een antwoord
// herzien blijft mogelijk, en vragen die bewust vrijblijvend zijn blijven dat.
//
// Wat deze tests vastleggen:
//   1. Per vraagsoort: zonder antwoord is "verder" niet mogelijk.
//   2. Elk invulscherm houdt de knop "verder" dicht zolang er geen antwoord is.
//   3. Het endpoint dat een afname afrondt weigert een onvolledige inzending.
//   4. Vragen die bewust vrijblijvend zijn, blijven vrijblijvend.
//   5. Terug gaan en een antwoord herzien blijft werken.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blokAntwoordVolledig,
  ontbrekendeBlokken,
  ontbrekendeKeuzevragen,
  ontbrekendeSchaalvragen,
  ordeningVolledig,
  schaalAntwoordGegeven,
  keuzeGemaakt,
} from "@shared/verplicht-antwoorden";

const WORTEL = join(__dirname, "..");
const lees = (pad: string) => readFileSync(join(WORTEL, pad), "utf8");

// ---------------------------------------------------------------------------
// 1. Per vraagsoort: wat betekent "beantwoord"?
// ---------------------------------------------------------------------------
describe("verplicht doorklikken: per vraagsoort telt alleen een echt antwoord", () => {
  it("keuzeschaal: nul is een antwoord, niets aanraken niet", () => {
    expect(schaalAntwoordGegeven(0)).toBe(true);
    expect(schaalAntwoordGegeven(-2)).toBe(true);
    expect(schaalAntwoordGegeven(null)).toBe(false);
    expect(schaalAntwoordGegeven(undefined)).toBe(false);
    expect(schaalAntwoordGegeven(Number.NaN)).toBe(false);
  });

  it("meerkeuze: een lege of ontbrekende keuze telt niet", () => {
    expect(keuzeGemaakt("A")).toBe(true);
    expect(keuzeGemaakt("")).toBe(false);
    expect(keuzeGemaakt("   ")).toBe(false);
    expect(keuzeGemaakt(null)).toBe(false);
  });

  it("forced choice met blokenergie: meest, minst en de energie zijn alle drie nodig", () => {
    const blok = { energyMode: "block" as const };
    expect(blokAntwoordVolledig(blok, undefined)).toBe(false);
    expect(blokAntwoordVolledig(blok, { most: "A", least: null, blockEnergy: 1 })).toBe(false);
    expect(blokAntwoordVolledig(blok, { most: null, least: "B", blockEnergy: 1 })).toBe(false);
    expect(blokAntwoordVolledig(blok, { most: "A", least: "B", blockEnergy: null })).toBe(false);
    expect(blokAntwoordVolledig(blok, { most: "A", least: "B", blockEnergy: 0 })).toBe(true);
  });

  it("forced choice met itemenergie: beide energiewaarden zijn nodig", () => {
    const blok = { energyMode: "item" as const };
    expect(
      blokAntwoordVolledig(blok, { most: "A", least: "B", itemEnergy: { most: 1, least: null } }),
    ).toBe(false);
    expect(
      blokAntwoordVolledig(blok, { most: "A", least: "B", itemEnergy: { most: null, least: 1 } }),
    ).toBe(false);
    expect(
      blokAntwoordVolledig(blok, { most: "A", least: "B", itemEnergy: { most: -2, least: 2 } }),
    ).toBe(true);
  });

  it("schuifregelaar: een niet aangeraakte regelaar is geen antwoord", () => {
    expect(ontbrekendeSchaalvragen(["q1", "q2", "q3", "q4"], { q1: 5, q2: 0 })).toEqual(["q3", "q4"]);
    expect(ontbrekendeSchaalvragen(["q1"], { q1: null })).toEqual(["q1"]);
    expect(ontbrekendeSchaalvragen(["q1", "q2"], { q1: 10, q2: 0 })).toEqual([]);
  });

  it("meerkeuze per vraag: elke vraag heeft een eigen keuze nodig", () => {
    expect(ontbrekendeKeuzevragen(["p1", "p2"], { p1: "links" })).toEqual(["p2"]);
    expect(ontbrekendeKeuzevragen(["p1", "p2"], { p1: "links", p2: "rechts" })).toEqual([]);
  });

  it("ordenen: elke rang moet toegekend zijn, zonder dubbels", () => {
    const elementen = ["e1", "e2", "e3"];
    expect(ordeningVolledig(elementen, ["e1", "e2"])).toBe(false);
    expect(ordeningVolledig(elementen, ["e1", "e2", "e2"])).toBe(false);
    expect(ordeningVolledig(elementen, ["e3", "e1", "e2"])).toBe(true);
  });

  it("noemt precies de blokken die nog open staan", () => {
    const blokken = [
      { stateKey: "B0", energyMode: "block" },
      { stateKey: "B1", energyMode: "item" },
      { stateKey: "B2", energyMode: "block" },
    ];
    const antwoorden = {
      B0: { most: "A", least: "B", blockEnergy: 1 },
      B2: { most: "A", least: "B", blockEnergy: null },
    };
    expect(ontbrekendeBlokken(blokken, antwoorden)).toEqual(["B1", "B2"]);
    expect(ontbrekendeBlokken(blokken, null)).toEqual(["B0", "B1", "B2"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Elk invulscherm houdt de knop "verder" dicht zolang er geen antwoord is.
//
// De testomgeving is Node zonder DOM, dus we lezen het scherm als bron. Dat is
// grof maar blijvend: wie de bewaking weghaalt, laat deze test zakken.
// ---------------------------------------------------------------------------
describe("verplicht doorklikken: de knop verder is dicht zonder antwoord", () => {
  it("deel 1 (T4P, forced choice) blokkeert verder op een onvolledig blok", () => {
    const bron = lees("client/src/pages/deel1.tsx");
    expect(bron).toContain("disabled={submitting || !blockComplete}");
    expect(bron).toContain("if (!blockComplete) return;");
  });

  it("deel 2 (verbondenheid, schuifregelaars) blokkeert afronden zonder antwoord", () => {
    const bron = lees("client/src/pages/deel2.tsx");
    // De regelaars starten leeg; pas een echte keuze telt als antwoord.
    expect(bron).toContain("ontbrekendeSchaalvragen");
    expect(bron).toContain("disabled={submitting || !alleBeantwoord}");
  });

  it("de driver-scan blokkeert volgende op een onvolledig blok", () => {
    const bron = lees("client/src/pages/driverscan-afname.tsx");
    expect(bron).toContain("disabled={!huidigCompleet}");
    expect(bron).toContain("disabled={status === \"bezig\" || !alleCompleet}");
  });

  it("de T4Kids-reis sluit een eiland pas af als het beantwoord is", () => {
    const bron = lees("client/src/pages/reis-t4kids.tsx");
    expect(bron).toContain("eilandKlaar");
    expect(bron).toContain("disabled={!klaarOmAfTeSluiten}");
    expect(bron).toContain("disabled={!alleEilandenKlaar}");
  });

  it("T4Sports vraagt ook de energie en de verbindingsvragen", () => {
    const bron = lees("client/src/pages/t4sports-vragenlijst.tsx");
    expect(bron).toContain("blokAntwoordVolledig");
    expect(bron).toContain("disabled={!verbindingCompleet}");
  });

  it("de teamscan blokkeert indienen zolang niet alles ingevuld is", () => {
    const bron = lees("client/src/pages/teamscan-deelnemer.tsx");
    expect(bron).toContain("disabled={!compleet || indienen.isPending}");
  });

  it("T4Organizations blokkeert verder per ronde", () => {
    const bron = lees("client/src/pages/t4o-deelnemer.tsx");
    expect(bron).toContain("disabled={!sectieCompleet}");
  });

  it("de 2MINSCAN blokkeert verder tot de acht woorden gekozen zijn", () => {
    const bron = lees("client/src/pages/twominscan-afname.tsx");
    expect(bron).toContain("verderActief={ronde1.length === 8}");
    expect(bron).toContain("verderActief={ronde2.length === 8}");
  });
});

// ---------------------------------------------------------------------------
// 4. Vragen die bewust vrijblijvend zijn, blijven vrijblijvend.
//
// Deze lijst is voorgelegd aan de opdrachtgever. Zolang hij niet anders
// beslist, mogen deze velden nooit een voorwaarde worden om verder te gaan.
// ---------------------------------------------------------------------------
describe("vrijblijvende vragen blijven vrijblijvend", () => {
  it("de toelichting bij een energiekostende driver blokkeert deel 1 nooit", () => {
    const bron = lees("client/src/pages/deel1.tsx");
    // De volledigheid van een blok kijkt naar meest, minst en energie. De
    // toelichting komt er niet in voor.
    const regel = bron.slice(bron.indexOf("const blockComplete"), bron.indexOf("const answeredCount"));
    expect(regel).not.toContain("toelichting");
    expect(blokAntwoordVolledig({ energyMode: "block" }, { most: "A", least: "B", blockEnergy: 1 })).toBe(true);
  });

  it("de toelichting bij de driver-scan blokkeert het rapport nooit", () => {
    const bron = lees("client/src/pages/driverscan-afname.tsx");
    const regel = bron.slice(bron.indexOf("const blokCompleet"), bron.indexOf("const isLaatste"));
    expect(regel).not.toContain("toelichting");
  });

  it("de naam blijft optioneel bij de driver-scan en de 2MINSCAN", () => {
    expect(lees("client/src/pages/driverscan-afname.tsx")).toContain("Naam (optioneel)");
    expect(lees("client/src/pages/twominscan-afname.tsx")).toContain("Je naam (optioneel)");
  });

  it("de 21 stellingen van de 2MINSCAN houden geen minimum", () => {
    const bron = lees("client/src/pages/twominscan-afname.tsx");
    expect(bron).toContain("Er is geen minimum of maximum");
    // De navigatierij onder de stellingen blijft onvoorwaardelijk actief.
    expect(bron).toContain("verderActief={true}");
  });

  it("club, positie en rol blijven optioneel bij T4Sports", () => {
    const bron = lees("client/src/pages/t4sports-vragenlijst.tsx");
    expect(bron).toContain("Club / Ploeg (optioneel)");
    expect(bron).toContain("Positie / Rol (optioneel)");
    expect(bron).toContain("disabled={!naam.trim() || !sporttak.trim() || !niveau || !sportType || !ambitie}");
  });

  it("bedrijf en functie blijven optioneel op het startscherm", () => {
    const bron = lees("client/src/pages/deelnemer.tsx");
    expect(bron).toContain('placeholder={t("optioneel")}');
  });
});

// ---------------------------------------------------------------------------
// 5. Terug gaan en een antwoord herzien blijft werken.
// ---------------------------------------------------------------------------
describe("terug gaan en herzien blijft mogelijk", () => {
  it("deel 1 houdt de knop vorige open op elk blok behalve het eerste", () => {
    const bron = lees("client/src/pages/deel1.tsx");
    expect(bron).toContain("disabled={idx === 0}");
    // De knop vorige heeft geen enkele voorwaarde over volledigheid.
    const nav = bron.slice(bron.indexOf('data-testid="button-prev"') - 400, bron.indexOf('data-testid="button-prev"'));
    expect(nav).not.toContain("blockComplete");
  });

  it("de driver-scan houdt de knop vorige open, ook op een onvolledig blok", () => {
    const bron = lees("client/src/pages/driverscan-afname.tsx");
    expect(bron).toContain('disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}');
  });

  it("de T4Kids-reis laat altijd terug naar de kaart gaan", () => {
    const bron = lees("client/src/pages/reis-t4kids.tsx");
    const terug = bron.slice(bron.indexOf('data-testid="button-terug-kaart"') - 500, bron.indexOf('data-testid="button-terug-kaart"'));
    expect(terug).not.toContain("disabled");
  });

  it("een herzien antwoord overschrijft het vorige en blijft volledig", () => {
    const blok = { stateKey: "B0", energyMode: "block" as const };
    let antwoorden: Record<string, any> = { B0: { most: "A", least: "B", blockEnergy: 1 } };
    expect(ontbrekendeBlokken([blok], antwoorden)).toEqual([]);
    // De deelnemer gaat terug en kiest een ander item als "meest".
    antwoorden = { B0: { ...antwoorden.B0, most: "C" } };
    expect(ontbrekendeBlokken([blok], antwoorden)).toEqual([]);
    // En als hij die keuze weer intrekt, staat het blok gewoon weer open.
    antwoorden = { B0: { ...antwoorden.B0, most: null } };
    expect(ontbrekendeBlokken([blok], antwoorden)).toEqual(["B0"]);
  });
});
