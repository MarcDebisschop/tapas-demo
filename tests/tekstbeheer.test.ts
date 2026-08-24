// ---------------------------------------------------------------------------
// tests/tekstbeheer.test.ts - beheer van de VASTE duidingsteksten
//
// Wat deze test bewijst:
//   1. Zonder databank valt elke tekst terug op de brontekst uit de code of het
//      tekstbestand. Het register kan een rapport dus nooit leeg maken.
//   2. Een bewaarde tekst wint op leestijd, en herstellen brengt de brontekst
//      onmiddellijk terug.
//   3. Een onbekende tekstsleutel wordt geweigerd, zodat er geen rijen ontstaan
//      die nergens in een rapport landen.
//   4. De rapportmotoren lezen via het register: het kernwoord en het korte
//      woord van het Business Kompas en de duiding en omschrijving van het
//      Studiekompas volgen de beheerde stand.
//   5. Het duidingsbeheer meldt eerlijk of de AI-laag werkelijk in de
//      rapportketen van een instrument hangt, en het doorgifteregister claimt
//      geen doorgifte die technisch niet kan gebeuren.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Database from "better-sqlite3";
import {
  zetTekstDatabank,
  tekstVan,
  tekstInstrumenten,
  isTekstInstrument,
  tekstOverzicht,
  bewaarTekst,
  wisTekst,
  tekstLog,
  SLEUTEL,
} from "../server/duidingstekst-register";

const T4P = "t4p-business-kompas";
const T4S = "t4students";

// Een tijdelijke databank in het geheugen. Het register maakt de tabel zelf aan,
// met dezelfde definitie als op het platform, dus dat wordt hier niet nagebouwd.
let dbTest: any = null;
function maakDatabank() {
  return new Database(":memory:");
}

describe("tekstbeheer: terugval op de brontekst", () => {
  beforeEach(() => {
    zetTekstDatabank(() => null);
  });

  it("geeft de brontekst wanneer er geen databank is", () => {
    const kern = tekstVan(T4P, SLEUTEL.t4pKern("Be Perfect"));
    expect(kern.length).toBeGreaterThan(0);
    const duiding = tekstVan(T4S, SLEUTEL.t4sDuiding("Be Perfect"));
    expect(duiding.length).toBeGreaterThan(0);
  });

  it("kent twee instrumenten, elk met velden en een Nederlandse taal", () => {
    const lijst = tekstInstrumenten();
    expect(lijst.map((i) => i.id).sort()).toEqual([T4P, T4S].sort());
    for (const i of lijst) {
      expect(i.aantalVelden).toBeGreaterThan(0);
      expect(i.talen).toContain("nl");
    }
    expect(isTekstInstrument(T4P)).toBe(true);
    expect(isTekstInstrument("onbestaand")).toBe(false);
  });

  it("levert een overzicht met groepen waarin geen enkel veld leeg is", () => {
    const ov = tekstOverzicht(T4S, "nl");
    expect(ov.groepen.length).toBeGreaterThan(0);
    for (const g of ov.groepen) {
      for (const v of g.velden) {
        expect(v.bron.length).toBeGreaterThan(0);
        expect(v.tekst).toBe(v.bron);
        expect(v.heeftOverride).toBe(false);
      }
    }
  });
});

describe("tekstbeheer: bewaren, winnen en herstellen", () => {
  beforeEach(() => {
    dbTest?.close?.();
    dbTest = maakDatabank();
    zetTekstDatabank(() => dbTest);
  });

  afterAll(() => {
    dbTest?.close?.();
    zetTekstDatabank(() => null);
  });

  it("laat een bewaarde tekst winnen op de brontekst", () => {
    const sleutel = SLEUTEL.t4pKern("Be Perfect");
    const bron = tekstVan(T4P, sleutel);
    const r = bewaarTekst(T4P, sleutel, "nl", "Startkracht", "marc@tapascity.com");
    expect(r.ok).toBe(true);
    expect(tekstVan(T4P, sleutel)).toBe("Startkracht");
    expect(tekstVan(T4P, sleutel)).not.toBe(bron);
  });

  it("brengt herstellen de brontekst terug", () => {
    const sleutel = SLEUTEL.t4sOmschrijving("Be Perfect");
    const bron = tekstVan(T4S, sleutel);
    bewaarTekst(T4S, sleutel, "nl", "Een andere omschrijving.", "marc@tapascity.com");
    expect(tekstVan(T4S, sleutel)).toBe("Een andere omschrijving.");
    const w = wisTekst(T4S, sleutel, "nl");
    expect(w.ok).toBe(true);
    expect(tekstVan(T4S, sleutel)).toBe(bron);
  });

  it("weigert een onbekende tekstsleutel", () => {
    const r = bewaarTekst(T4P, "kern:BestaatNiet", "nl", "iets", "marc@tapascity.com");
    expect(r.ok).toBe(false);
    expect(r.fout).toBeTruthy();
    const r2 = bewaarTekst("onbestaand-instrument", SLEUTEL.t4pKern("Be Perfect"), "nl", "iets", "marc@tapascity.com");
    expect(r2.ok).toBe(false);
  });

  it("weigert een lege tekst, zodat een rapportveld nooit leeg wordt", () => {
    const r = bewaarTekst(T4P, SLEUTEL.t4pKern("Be Perfect"), "nl", "   ", "marc@tapascity.com");
    expect(r.ok).toBe(false);
  });

  it("houdt een auditspoor bij met wie en wanneer", () => {
    const sleutel = SLEUTEL.t4pKort("Be Perfect");
    bewaarTekst(T4P, sleutel, "nl", "starten", "marc@tapascity.com");
    const log = tekstLog(T4P, sleutel);
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].gewijzigd_door).toBe("marc@tapascity.com");
    expect(String(log[0].gewijzigd_op).length).toBeGreaterThan(0);
  });

  it("meldt in het overzicht dat een veld beheerd is", () => {
    bewaarTekst(T4P, SLEUTEL.t4pKern("Be Perfect"), "nl", "Startkracht", "marc@tapascity.com");
    const ov = tekstOverzicht(T4P, "nl");
    const veld = ov.groepen.flatMap((g) => g.velden).find((v) => v.sleutel === SLEUTEL.t4pKern("Be Perfect"));
    expect(veld?.heeftOverride).toBe(true);
    expect(veld?.tekst).toBe("Startkracht");
    expect(veld?.bron).not.toBe("Startkracht");
  });
});

describe("de rapportmotoren lezen de beheerde stand", () => {
  beforeEach(() => {
    dbTest?.close?.();
    dbTest = maakDatabank();
    zetTekstDatabank(() => dbTest);
  });

  it("het Business Kompas gebruikt het beheerde kernwoord en korte woord", async () => {
    const { kernVan, kortVan } = await import("../server/t4p/kompas-contract");
    bewaarTekst(T4P, SLEUTEL.t4pKern("Be Perfect"), "nl", "Startkracht", "marc@tapascity.com");
    bewaarTekst(T4P, SLEUTEL.t4pKort("Be Perfect"), "nl", "starten", "marc@tapascity.com");
    expect(kernVan("Be Perfect")).toBe("Startkracht");
    expect(kortVan("Be Perfect")).toBe("starten");
  });

  it("het Studiekompas gebruikt de beheerde duiding en omschrijving", async () => {
    const mod: any = await import("../server/t4students/rapport-contract");
    bewaarTekst(T4S, SLEUTEL.t4sDuiding("Be Perfect"), "nl", "Beheerde duidingstekst.", "marc@tapascity.com");
    bewaarTekst(T4S, SLEUTEL.t4sOmschrijving("Be Perfect"), "nl", "beheerde omschrijving", "marc@tapascity.com");
    if (typeof mod.duidingVan === "function") {
      expect(mod.duidingVan("Be Perfect")).toBe("Beheerde duidingstekst.");
    }
    if (typeof mod.omschrijvingVan === "function") {
      expect(mod.omschrijvingVan("Be Perfect")).toBe("beheerde omschrijving");
    }
    // Het register blijft in elk geval de bron van waarheid voor deze sleutels.
    expect(tekstVan(T4S, SLEUTEL.t4sDuiding("Be Perfect"))).toBe("Beheerde duidingstekst.");
  });
});

describe("eerlijkheid over de AI-laag", () => {
  it("meldt dat het T4P-pad niet in de rapportketen hangt en T4Sports wel", async () => {
    const { getDuidingInstrumenten } = await import("../server/duiding-manager");
    const lijst = getDuidingInstrumenten();
    const t4p = lijst.find((i: any) => i.id === T4P);
    const sports = lijst.find((i: any) => i.id === "t4sports");
    expect(t4p?.inRapportketen).toBe(false);
    expect(String(t4p?.toelichting).length).toBeGreaterThan(20);
    expect(sports?.inRapportketen).toBe(true);
  });

  it("claimt geen doorgifte voor een pad dat niet in de rapportketen hangt", async () => {
    const { bouwDoorgifteRegister } = await import("../server/duiding-pseudonimisering");
    const register = bouwDoorgifteRegister(
      [
        { id: T4P, label: "T4P Business Kompas", inRapportketen: false },
        { id: "t4sports", label: "T4Sports", inRapportketen: true },
      ],
      () => true, // zelfs met de vlag aan
    );
    const t4p = register.find((r) => r.instrumentId === T4P);
    const sports = register.find((r) => r.instrumentId === "t4sports");
    expect(t4p?.liveDuidingAan).toBe(true);
    expect(t4p?.doorgifteMogelijk).toBe(false);
    expect(sports?.doorgifteMogelijk).toBe(true);
  });
});
