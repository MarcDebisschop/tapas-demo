import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import { sterksteUitGroep, duidingVan, rangschik, FAM_FOCI, FAM_DRIVERS } from "../server/t4students/rapport-contract";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Ingreep 1 en 2 van de opdracht "Slotnoot en opmaak".
//
// INGREEP 1: de hoofdstukken met de onderbouwing en de bronnen
// ("Verantwoording en grenzen" en "Waarop dit rapport gebouwd is") verhuizen
// naar het einde, achter de bijlagen met de eigen antwoorden. Het bestaande
// hoofdstuk "In één zin" blijft bestaan zoals het is (een andere, bestaande
// test bewaakt dat al en mag niet worden afgezwakt); het schuift mee naar
// zijn nieuwe plaats, samen met "Wat je hier zocht" en "Voor wie meeleest,
// slot".
//
// INGREEP 2: het nieuwe slothoofdstuk "Een zin om mee te nemen" komt na
// "Voor wie meeleest, slot" en voor de bijlagen met de eigen antwoorden.
// ---------------------------------------------------------------------------

function bouw(): T4SPagina[] {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
  return rapport.paginas;
}

function titelIndex(paginas: T4SPagina[], regex: RegExp): number {
  return paginas.findIndex((p) => regex.test(p.titel));
}

describe("ingreep 1: de nieuwe hoofdstukvolgorde aan het einde van het rapport", () => {
  it("Verantwoording en grenzen en Waarop dit rapport gebouwd is staan na de bijlagen met eigen antwoorden", () => {
    const paginas = bouw();
    const iVerantwoording = titelIndex(paginas, /^verantwoording en grenzen$/i);
    const iGebouwd = titelIndex(paginas, /^waarop dit rapport gebouwd is$/i);
    const iBijlageFoci = titelIndex(paginas, /alles wat je zelf antwoordde over je talent-foci/i);
    const iBijlageVersnellers = titelIndex(paginas, /alles wat je zelf antwoordde over je talent-versnellers/i);
    const iBijlageDrivers = titelIndex(paginas, /alles wat je zelf antwoordde over je drivers/i);
    for (const i of [iVerantwoording, iGebouwd, iBijlageFoci, iBijlageVersnellers, iBijlageDrivers]) {
      expect(i, "een van de hoofdstukken werd niet gevonden").toBeGreaterThanOrEqual(0);
    }
    expect(iVerantwoording).toBeGreaterThan(iBijlageDrivers);
    expect(iVerantwoording).toBeGreaterThan(iBijlageVersnellers);
    expect(iVerantwoording).toBeGreaterThan(iBijlageFoci);
    expect(iGebouwd).toBeGreaterThan(iVerantwoording);
  });

  it("Waarop dit rapport gebouwd is is het allerlaatste hoofdstuk", () => {
    const paginas = bouw();
    expect(paginas[paginas.length - 1].titel).toBe("Waarop dit rapport gebouwd is");
  });

  it("In één zin blijft bestaan en blijft onmiddellijk voor Wat je hier zocht staan (bestaande waarborg)", () => {
    const paginas = bouw();
    const iInEenZin = titelIndex(paginas, /^in één zin$/i);
    const iWatJeHierZocht = titelIndex(paginas, /^wat je hier zocht$/i);
    expect(iInEenZin).toBeGreaterThanOrEqual(0);
    expect(iWatJeHierZocht).toBe(iInEenZin + 1);
  });

  it("het nieuwe slothoofdstuk staat na Voor wie meeleest, slot en voor de bijlagen met eigen antwoorden", () => {
    const paginas = bouw();
    const iSlot = titelIndex(paginas, /^voor wie meeleest, slot$/i);
    const iNieuw = titelIndex(paginas, /een zin om mee te nemen/i);
    const iBijlageFoci = titelIndex(paginas, /alles wat je zelf antwoordde over je talent-foci/i);
    expect(iNieuw).toBeGreaterThanOrEqual(0);
    expect(iNieuw).toBeGreaterThan(iSlot);
    expect(iNieuw).toBeLessThan(iBijlageFoci);
  });

  it("de hoofdstuknummers lopen in de Verdieping nog steeds ononderbroken op, ook na de herschikking", () => {
    const paginas = bouw();
    const nummers = paginas.map((p) => p.nr);
    const verwacht = nummers.map((_, i) => i + 1);
    expect(nummers).toEqual(verwacht);
  });
});

describe("ingreep 2: het nieuwe slothoofdstuk Een zin om mee te nemen", () => {
  function vindSlot(paginas: T4SPagina[]): T4SPagina {
    const p = paginas.find((pg) => /een zin om mee te nemen/i.test(pg.titel));
    expect(p, "geen slothoofdstuk gevonden").toBeDefined();
    return p!;
  }

  it("draagt de ondertitel Jouw profiel, samengevat in één beweging.", () => {
    const paginas = bouw();
    const slot = vindSlot(paginas);
    expect(slot.ondertitel).toBe("Jouw profiel, samengevat in één beweging.");
  });

  it("het citaatvlak toont letterlijk dezelfde zin als de bestaande In één zin berekening", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const inEenZin = rapport.paginas.find((p) => /^in één zin$/i.test(p.titel));
    expect(inEenZin).toBeDefined();
    const bronZin = (inEenZin!.blokken.find((b) => b.soort === "alinea") as { tekst: string }).tekst;
    const slot = vindSlot(rapport.paginas);
    const citaatBlok = slot.blokken.find((b) => b.soort === "citaat") as
      | (T4SBlok & { soort: "citaat" })
      | undefined;
    expect(citaatBlok, "geen citaatvlak op het slothoofdstuk").toBeDefined();
    const citaatTekst = citaatBlok!.regels[0]?.vraag ?? "";
    expect(citaatTekst).toBe(bronZin);
  });

  it("de kaart WAT AL STERK IS noemt het construct met het hoogste aandeel uit de groep sterk aanwezig van de talent-foci", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const foci = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_FOCI);
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const slot = vindSlot(rapport.paginas);
    const kaart = slot.blokken.find(
      (b) => (b as unknown as { opschrift?: string }).opschrift === "WAT AL STERK IS",
    ) as (T4SBlok & { kop: string; tekst: string }) | undefined;
    expect(kaart, "geen kaart met opschrift WAT AL STERK IS gevonden").toBeDefined();
    const { constructen } = sterksteUitGroep(foci);
    expect(constructen.length).toBeGreaterThan(0);
    expect(kaart!.kop).toContain(constructen[0].construct);
    expect(kaart!.tekst).toBe(duidingVan(constructen[0].construct));
  });

  it("de kaart WAT NOG STERKER KAN gebruikt de keerzijdetekst van de sterkste driver met label gaspedaal", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const drivers = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_DRIVERS);
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const slot = vindSlot(rapport.paginas);
    const kaart = slot.blokken.find(
      (b) => (b as unknown as { opschrift?: string }).opschrift === "WAT NOG STERKER KAN",
    ) as (T4SBlok & { kop: string; tekst: string }) | undefined;
    const gaspedaal = drivers.gerangschikt.filter((r) => r.leeswoord === "gaspedaal");
    expect(gaspedaal.length, "voorbeeldprofiel heeft geen gaspedaal-driver, test niets").toBeGreaterThan(0);
    expect(kaart, "geen kaart met opschrift WAT NOG STERKER KAN gevonden").toBeDefined();
    expect(kaart!.kop).toContain(gaspedaal[0].construct);
    expect(kaart!.tekst).toBe(duidingVan(gaspedaal[0].construct));
  });

  it("de kaart MET DANK bevat de letterlijke, vaste tekst en de contactregel", () => {
    const paginas = bouw();
    const slot = vindSlot(paginas);
    const kaart = slot.blokken.find(
      (b) => (b as unknown as { opschrift?: string }).opschrift === "MET DANK",
    ) as (T4SBlok & { kop: string; tekst: string; contactregel?: string }) | undefined;
    expect(kaart, "geen kaart met opschrift MET DANK gevonden").toBeDefined();
    expect(kaart!.kop).toBe("Bedankt dat je dit met ons deelde");
    expect(kaart!.tekst).toBe(
      "Dank dat je de tijd nam om jezelf te leren kennen via TaPasCity. We hopen dat dit beeld je " +
        "verder helpt in je keuze. Wil je verder lezen over zichtbaar worden in wie je bent? Lees dan " +
        "Zichtbaar, van onbegrepen talent naar gewaardeerde eigenheid.",
    );
    expect(kaart!.contactregel).toBe("www.tapascity.com · info@tapascity.com");
  });

  it("bevat de vaste toelichtingsregel dat er niets nieuws in dit hoofdstuk staat", () => {
    const paginas = bouw();
    const slot = vindSlot(paginas);
    const heeftRegel = slot.blokken.some(
      (b) => b.soort === "alinea" && b.tekst === "Dit blad vat samen wat je hiervoor las. Er staat niets nieuws in.",
    );
    expect(heeftRegel).toBe(true);
  });

  it("is het laatste hoofdstuk voor de bijlagen met eigen antwoorden", () => {
    const paginas = bouw();
    const iNieuw = titelIndex(paginas, /een zin om mee te nemen/i);
    const volgende = paginas[iNieuw + 1];
    expect(volgende.titel).toMatch(/alles wat je zelf antwoordde/i);
  });
});
