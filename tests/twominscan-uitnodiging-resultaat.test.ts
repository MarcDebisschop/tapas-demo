// ---------------------------------------------------------------------------
// tests/twominscan-uitnodiging-resultaat.test.ts
//
// Het gat: de 2MINSCAN rekende alles in de browser uit en stuurde niets naar de
// server. Het enige wat ooit bewaard werd, kwam van de knop "Bewaar voor
// teamrapport" onderaan het rapport. Een lid van een Human Due Diligence-traject
// ziet dat rapport niet meer, dus kon die knop nooit meer geklikt worden. Gevolg:
// de begeleider zag "Verstuurd" staan bij een lid dat de scan wel afwerkte, en de
// teamanalyse van het traject vond niets.
//
// De regel nu: wie via een uitnodiging invult, wordt bij het afronden bewaard,
// zonder knop. Naam en organisatie komen uit de uitnodiging, niet uit de body,
// want de voortgang van een traject zoekt de scan op precies die twee terug.
// ---------------------------------------------------------------------------
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bewaarAfname,
  leesAfnames,
  verwijderAfnamesVoor,
  verwijderAfname,
} from "../server/twominscan/afname-opslag";

const opslag = readFileSync(
  resolve(__dirname, "../server/twominscan/afname-opslag.ts"),
  "utf8",
);
const afnamePagina = readFileSync(
  resolve(__dirname, "../client/src/pages/twominscan-afname.tsx"),
  "utf8",
);

/** Enkel de route zelf, niet de route die erachter geregistreerd staat. */
function routeblok(): string {
  const start = opslag.indexOf('"/api/twominscan/uitnodiging/:token/resultaat"');
  const einde = opslag.indexOf("app.get(", start);
  return opslag.slice(start, einde > start ? einde : start + 2000);
}

/** Enkel het stuk van rond_af dat met de server praat. */
function bewaarblok(): string {
  const start = afnamePagina.indexOf("if (uitnodiging) {");
  const einde = afnamePagina.indexOf("// resultaat doorgeven", start);
  return afnamePagina.slice(start, einde);
}

describe("de route die een uitnodiging afrondt", () => {
  it("bestaat en is publiek, want een deelnemer heeft geen login", () => {
    expect(opslag.indexOf('"/api/twominscan/uitnodiging/:token/resultaat"')).toBeGreaterThan(-1);
    expect(routeblok()).not.toMatch(/vereisAdmin/);
  });

  it("neemt naam en organisatie uit de uitnodiging en niet uit de body", () => {
    const route = routeblok();
    expect(route).toMatch(/getAfnameByToken\(token\)/);
    expect(route).toMatch(/const naam = \(afname\.name \?\? ""\)\.trim\(\)/);
    expect(route).toMatch(/const organisatie = \(afname\.company \?\? ""\)\.trim\(\)/);
    // De body mag alleen de uitkomst aandragen, geen identiteit.
    expect(opslag).toMatch(/const uitnodigingSchema = z\.object\(\{/);
    const schema = opslag.slice(
      opslag.indexOf("const uitnodigingSchema"),
      opslag.indexOf("let tabelKlaar"),
    );
    expect(schema).not.toMatch(/naam:/);
    expect(schema).not.toMatch(/organisatie:/);
  });

  it("zet de uitnodiging op voltooid, zodat de voortgang van het traject klopt", () => {
    const route = routeblok();
    expect(route).toMatch(/updateAfname\(afname\.id, \{/);
    expect(route).toMatch(/status: "voltooid"/);
    expect(route).toMatch(/completedAt/);
  });

  it("weigert een onbekende uitnodiging met 404", () => {
    expect(routeblok()).toMatch(/if \(!afname\) return res\.status\(404\)/);
  });
});

describe("het afnamescherm bewaart zelf bij het afronden", () => {
  it("verstuurt de uitkomst wanneer er een uitnodiging is", () => {
    expect(afnamePagina).toMatch(/async function rond_af\(\)/);
    expect(afnamePagina).toMatch(/\/api\/twominscan\/uitnodiging\/\$\{encodeURIComponent\(uitnodiging\)\}\/resultaat/);
    expect(afnamePagina).toMatch(/wielpositie: match\.profiel\.wielpositie/);
  });

  it("stuurt geen antwoorden en geen scores mee", () => {
    const blok = bewaarblok();
    expect(blok).not.toMatch(/ronde1/);
    expect(blok).not.toMatch(/ronde2/);
    expect(blok).not.toMatch(/score,/);
    expect(blok).not.toMatch(/foto/);
  });

  it("laat de deelnemer verder gaan wanneer het bewaren mislukt", () => {
    const blok = bewaarblok();
    expect(blok).toMatch(/catch \(e\) \{/);
    // Geen return in de catch: het rapport van de deelnemer volgt altijd.
    expect(blok.slice(blok.indexOf("catch (e) {"))).not.toMatch(/return;/);
  });
});

describe("een tweede scan van dezelfde persoon laat geen dubbele rij achter", () => {
  const naam = "Testlid Rapportsluis";
  const org = "Testorganisatie Rapportsluis";

  afterAll(() => {
    verwijderAfnamesVoor(naam, org);
  });

  it("vervangt de vorige rij binnen dezelfde organisatie", () => {
    verwijderAfnamesVoor(naam, org);
    const eerste = bewaarAfname({ naam, organisatie: org, wielpositie: "24-44", egCode: "TbXN-a" });
    expect(eerste.id).toBeGreaterThan(0);

    const verwijderd = verwijderAfnamesVoor(naam, org);
    expect(verwijderd).toBe(1);
    const tweede = bewaarAfname({ naam, organisatie: org, wielpositie: "21-41", egCode: "TbXO-g" });

    const rijen = leesAfnames(org, 50).filter((r) => r.naam === naam);
    expect(rijen).toHaveLength(1);
    expect(rijen[0].wielpositie).toBe("21-41");
    verwijderAfname(tweede.id);
  });
});
