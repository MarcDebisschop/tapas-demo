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
// hoofdstuk, vroeger "In één zin" en sinds het opmaakherstel van 2026-08-03
// "Wat vlot gaat en wat energie kost", schuift mee naar zijn nieuwe plaats,
// samen met "Wat je hier zocht" en "Voor wie meeleest, slot".
//
// INGREEP 2: het nieuwe slothoofdstuk "Een zin om mee te nemen" komt na
// "Voor wie meeleest, slot" en voor de bijlagen met de eigen antwoorden.
//
// OPMAAKHERSTEL (2026-08-03), PUNT 2: de grote samenvattende zin stond eerst
// zowel op het toenmalige blad "In één zin" als in het citaatvlak van dit
// nieuwe slothoofdstuk; de student las dezelfde zin dus twee keer. De zin
// staat voortaan alleen nog in het citaatvlak hier. Het oude blad bestaat nog
// steeds en heet nu "Wat vlot gaat en wat energie kost": het toont alleen nog
// de twee lijstjes die uniek voor dat blad zijn (bewaakt door de bestaande
// tests t4students-in-een-zin.test.ts en
// t4students-in-een-zin-gelijkspel-grammatica.test.ts, die zelf aangepast
// zijn om de zin op de nieuwe plaats te controleren, zonder de bewaakte
// tekst zelf te veranderen).
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

  it("Wat vlot gaat en wat energie kost (vroeger In één zin) blijft bestaan en blijft onmiddellijk voor Wat je hier zocht staan (bestaande waarborg)", () => {
    const paginas = bouw();
    const iInEenZin = titelIndex(paginas, /^wat vlot gaat en wat energie kost$/i);
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

  // Opmaakherstel-2, punt 5: het citaatvlak van weleer (opschrift, kop én
  // decoratief aanhalingsteken) is vervangen door het nieuwe, rustigere
  // "zinvlak" (alleen de zin, gecentreerd, schuin en tussen
  // aanhalingstekens, zonder opschrift en zonder kop). De vindplaats in deze
  // test is verlegd van "citaat" naar "zinvlak"; de bewaakte tekst (de
  // samenvattende zin zelf, en dat ze nergens anders voorkomt) is ongewijzigd.
  it("het zinvlak toont de grote samenvattende zin, en die zin staat nergens anders meer in het rapport", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const slot = vindSlot(rapport.paginas);
    const zinvlakBlok = slot.blokken.find((b) => b.soort === "zinvlak") as
      | (T4SBlok & { soort: "zinvlak" })
      | undefined;
    expect(zinvlakBlok, "geen zinvlak op het slothoofdstuk").toBeDefined();
    const citaatTekst = zinvlakBlok!.tekst ?? "";
    expect(citaatTekst.length).toBeGreaterThan(0);
    // De zin bevat de sterkste bouwsteen van de talent-focus (rechtstreeks uit
    // de motor, niet hertypt), net als vroeger op het blad In één zin.
    expect(citaatTekst).toContain("waar je");
    // De zin komt nergens anders in het gerenderde rapport voor: dat was
    // precies het probleem dat hersteld is.
    let elders = 0;
    for (const pagina of rapport.paginas) {
      if (pagina === slot) continue;
      for (const blok of pagina.blokken) {
        if ("tekst" in blok && typeof blok.tekst === "string" && blok.tekst === citaatTekst) elders++;
      }
    }
    expect(elders, "de samenvattende zin staat nog ergens anders in het rapport").toBe(0);
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
