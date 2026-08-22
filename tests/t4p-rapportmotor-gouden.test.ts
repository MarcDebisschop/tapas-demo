// ---------------------------------------------------------------------------
// tests/t4p-rapportmotor-gouden.test.ts
//
// Gouden tests op de rapportmotor van het T4P Business Kompas — het
// kernactivum van het platform. De onafhankelijke broncode-audit stelde vast
// dat de privacylaag goed getest is, maar dat net de rapportmotor (de
// intellectuele kern) geen enkele test had. Deze test legt daarom het gemeten
// gedrag van de motor vast:
//
//   1. de vaste 24-hoofdstukkenarchitectuur (profiel- en kompascontract),
//   2. determinisme: dezelfde invoer geeft byte-identieke uitvoer,
//   3. geen lekkende plekhouders (undefined / NaN / [object Object]) in de HTML,
//   4. de rangorde-regel: netscore aflopend, energie nooit als sorteersleutel,
//   5. de talentmotor toont exact dezelfde rangorde als de constructtabellen,
//   6. TaPas-Beeld staat niet in de talent-foci-tabel,
//   7. de bestandsnaamconventie van het rapport.
//
// De testinvoer is een vast, synthetisch antwoordpatroon (geen persoonsgegevens
// van een echte deelnemer): per blok wordt de alfabetisch eerste construct als
// "meest" en de alfabetisch laatste als "minst" gekozen. Dat geeft sterk
// gedifferentieerde nettoscores en dus een betekenisvolle rangordecontrole.
//
// Let op: `most`/`least` in een BlockResponse bevatten de POSITIE ("A".."D")
// van het gekozen item, niet het item-id, en de sleutel van een antwoord is
// "B" + blokindex. Dat is gemeten in server/scoring.ts (aggregate).
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { instrument } from "../server/instrument";
import { buildGeneratorContract, type Responses } from "../server/scoring";
import { bouwT4pBusinessProfiel } from "../server/t4p/rapport";
import {
  bouwT4pBusinessKompas,
  renderT4pBusinessKompasHtml,
  kompasBestandsnaam,
} from "../server/t4p/kompas";

// --- vaste testinvoer -------------------------------------------------------

/**
 * `richting = "az"` kiest per blok het alfabetisch eerste construct als
 * "meest", `"za"` het alfabetisch laatste. Zo kan dezelfde test twee
 * tegengestelde rangordes afdwingen: als de motor of een tabel alfabetisch zou
 * sorteren in plaats van op netscore, faalt minstens één van de twee gevallen.
 */
function maakAntwoorden(richting: "az" | "za"): Responses {
  const responses: Responses = {};
  (instrument.blocks as any[]).forEach((b, i) => {
    const gesorteerd = [...b.items].sort((x: any, y: any) =>
      String(x.construct).localeCompare(String(y.construct), "nl"),
    );
    const eerste = gesorteerd[0];
    const laatste = gesorteerd[gesorteerd.length - 1];
    responses["B" + i] = {
      most: richting === "az" ? eerste.pos : laatste.pos,
      least: richting === "az" ? laatste.pos : eerste.pos,
      itemEnergy: { most: (i % 5) - 2, least: ((i + 2) % 5) - 2 },
      blockEnergy: (i % 3) - 1,
    };
  });
  return responses;
}

function maakContract(richting: "az" | "za" = "az") {
  return buildGeneratorContract({
    respondentCode: "T4P-GOUDEN-001",
    name: "Test Deelnemer",
    company: "TaPasCity",
    role: "Coach",
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    responses: maakAntwoorden(richting),
    baseline: 6,
    connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
    taal: "nl",
  });
}

/** Ingebedde fonts bevatten toevallig de letterreeks "NaN"; die strippen we. */
function zonderIngebedeBinaireData(html: string): string {
  return html.replace(/base64,[A-Za-z0-9+/=]+/g, "base64,GESTRIPT");
}

/** De A4-pagina's van de gerenderde HTML, in verschijningsvolgorde. */
function paginas(html: string): string[] {
  return zonderIngebedeBinaireData(html).split('<section class="sheet"');
}

/** Titelmarkering van een hoofdstukkop; lange titels krijgen de extra klasse w2. */
function titelMarkering(titel: string): RegExp {
  const veilig = titel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<span class="chap-title(?: w2)?">${veilig}</span>`);
}

/** De pagina('s) van het hoofdstuk met exact deze titel, aan elkaar geplakt. */
function hoofdstukHtml(html: string, titel: string): string {
  const markering = titelMarkering(titel);
  const treffers = paginas(html).filter((p) => markering.test(p));
  expect(treffers.length, `hoofdstuk niet gevonden: ${titel}`).toBeGreaterThan(0);
  return treffers.join("\n");
}

/** Volgorde waarin de gegeven namen in een fragment voorkomen. */
function verschijningsvolgorde(fragment: string, namen: string[]): string[] {
  return namen
    .map((n) => ({ n, i: fragment.indexOf(n) }))
    .filter((x) => x.i > -1)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.n);
}

/** Alleen de tabellen van een hoofdstuk (dus zonder de duidende tekstlagen). */
function tabellenVan(fragment: string): string {
  return [...fragment.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]).join("\n");
}

/** De constructnamen per motorpaneel van hoofdstuk 13, in renderorde. */
function motorPanelen(fragment: string): string[][] {
  return [...fragment.matchAll(/<div class="motor[^"]*">([\s\S]*?)(?=<div class="motor|<div class="rk|$)/g)].map(
    (m) => [...m[1].matchAll(/<span class="mi-naam">([^<]+)<\/span>/g)].map((x) => x[1]),
  );
}

// Spiegelt de rangorderegel van het rapportcontract: nettoscore PER AANBIEDING
// aflopend, dan ruwe nettoscore, dan meest, dan minst, dan alfabetisch. De
// normalisatie per aanbieding is nodig omdat de talent-versnellers ongelijk
// worden aangeboden (8, 9 of 10 keer).
function perAanbieding(r: any): number {
  if (typeof r.netPerAanbieding === "number" && Number.isFinite(r.netPerAanbieding)) {
    return r.netPerAanbieding;
  }
  return Number(r.shown) > 0 ? Math.round((Number(r.net) / Number(r.shown)) * 1000) / 1000 : 0;
}

function rijenVanFamilie(contract: any, familie: string) {
  return (contract.sections.main.constructRows as any[])
    .filter((r) => r.family === familie)
    .filter((r) => !(familie === "Talent-foci" && String(r.construct).startsWith("TaPas-Beeld")))
    .sort((a, b) => {
      if (perAanbieding(b) !== perAanbieding(a)) return perAanbieding(b) - perAanbieding(a);
      if (b.net !== a.net) return b.net - a.net;
      if (b.most !== a.most) return b.most - a.most;
      if (a.least !== b.least) return a.least - b.least;
      return a.construct < b.construct ? -1 : a.construct > b.construct ? 1 : 0;
    });
}

// --- gouden hoofdstukkenlijst ----------------------------------------------

const HOOFDSTUKKEN = [
  "Profiel in één oogopslag",
  "Leeswijzer en datakwaliteit",
  "Professionele energiestaat",
  "TaPas-Beeld — identiteit, waarden en congruentie",
  "Drivers",
  "Bronstellingen — drivers",
  "Talent-foci",
  "Bronstellingen — aandacht",
  "Talent-versnellers",
  "Bronstellingen — inzet",
  "Bronlezing — herkenbare talentcombinaties",
  "Drieledige talentdynamiek",
  "De talentmotor in één oogopslag",
  "Verbondenheid met de organisatie",
  "Werkcontext en rolfit",
  "Ontwikkelrisico's en waakpunten",
  "Energielekken en minder vanzelfsprekende talentlijnen",
  "Toekomstgerichte synthese",
  "Toekomstpistes en carrièrekansen",
  "Vertaling naar gevestigde kaders",
  "Wetenschappelijke onderbouwing",
  "Technische bijlage",
  "Grondslagen",
  "Mantra en dankwoord",
];

describe("T4P-rapportmotor — gouden tests op het kernactivum", () => {
  it("het kompascontract heeft exact de 24 vastgelegde hoofdstukken, in deze volgorde", () => {
    const kompas = bouwT4pBusinessKompas(maakContract());
    const titels = (kompas.secties as any[]).map((s) => s.titel);
    expect(titels).toEqual(HOOFDSTUKKEN);
  });

  it("rendert alle 24 hoofdstukken als eigen pagina, genummerd 01 t.e.m. 24", () => {
    const html = zonderIngebedeBinaireData(
      renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(maakContract())),
    );
    const koppen = [
      ...html.matchAll(
        /<span class="chap-num">(\d{2})<\/span><span class="chap-title(?: w2)?">([^<]+)<\/span>/g,
      ),
    ];
    expect(koppen.map((m) => m[1])).toEqual(
      HOOFDSTUKKEN.map((_, i) => String(i + 1).padStart(2, "0")),
    );
    expect(koppen.map((m) => m[2])).toEqual(HOOFDSTUKKEN);
  });

  it("het profielcontract heeft even veel secties als het kompascontract", () => {
    const contract = maakContract();
    const profiel = bouwT4pBusinessProfiel(contract);
    const kompas = bouwT4pBusinessKompas(contract);
    expect(profiel.secties.length).toBe(24);
    expect(profiel.secties.length).toBe((kompas.secties as any[]).length);
  });

  it("is deterministisch: dezelfde invoer geeft byte-identieke HTML", () => {
    const contract = maakContract();
    const eerste = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract));
    const tweede = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract));
    expect(tweede).toBe(eerste);
    // Ook een tweede, los opgebouwd contract met dezelfde antwoorden moet
    // dezelfde inhoud geven (alleen generatedAt verschilt, en die staat niet
    // als tijdstempel in de gerenderde HTML).
    const derde = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(maakContract()));
    expect(derde).toBe(eerste);
  });

  it("rendert geen lekkende plekhouders in de HTML", () => {
    const html = zonderIngebedeBinaireData(
      renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(maakContract())),
    );
    for (const naald of ["undefined", "NaN", "[object Object]", ">null<"]) {
      expect(html.split(naald).length - 1, `plekhouder in rapport: ${naald}`).toBe(0);
    }
    expect(html.length).toBeGreaterThan(50_000);
  });

  it.each(["az", "za"] as const)(
    "sorteert de constructtabellen op netscore aflopend, niet alfabetisch (%s-invoer)",
    (richting) => {
      const contract = maakContract(richting);
      const html = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract));
      for (const familie of ["Drivers", "Talent-foci", "Talent-versnellers"]) {
        const verwacht = rijenVanFamilie(contract, familie).map((r) => r.construct);
        const tabellen = tabellenVan(hoofdstukHtml(html, familie));
        expect(verschijningsvolgorde(tabellen, verwacht), `rangorde ${familie}`).toEqual(verwacht);
      }
    },
  );

  it.each(["az", "za"] as const)(
    "toont in de talentmotor exact dezelfde rangorde als in de constructtabellen (%s-invoer, v6.2)",
    (richting) => {
      const contract = maakContract(richting);
      const html = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract));
      const panelen = motorPanelen(hoofdstukHtml(html, "De talentmotor in één oogopslag"));
      // Paneelvolgorde in hoofdstuk 13: foci, versnellers, drivers.
      expect(panelen.length).toBe(3);
      const families = ["Talent-foci", "Talent-versnellers", "Drivers"];
      families.forEach((familie, i) => {
        const verwacht = rijenVanFamilie(contract, familie).map((r) => r.construct);
        expect(panelen[i], `motorvolgorde ${familie}`).toEqual(verwacht);
      });
    },
  );

  it("zet TaPas-Beeld niet in de talent-foci-tabel maar in het eigen identiteitshoofdstuk", () => {
    const html = renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(maakContract()));
    const fociTabellen = tabellenVan(hoofdstukHtml(html, "Talent-foci"));
    expect(fociTabellen.includes("TaPas-Beeld")).toBe(false);
    // In de duidende tekst mág het TaPas-Beeld wél genoemd worden: het
    // hoofdstuk verwijst bewust naar hoofdstuk 4 (Inner Why).
    expect(hoofdstukHtml(html, "Talent-foci").includes("TaPas-Beeld")).toBe(true);
    expect(
      hoofdstukHtml(html, "TaPas-Beeld — identiteit, waarden en congruentie").length,
    ).toBeGreaterThan(0);
  });

  it("gebruikt nergens het woord 'drijfveren' — de term is altijd 'drivers'", () => {
    const html = zonderIngebedeBinaireData(
      renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(maakContract())),
    );
    expect(html.toLowerCase().includes("drijfve")).toBe(false);
  });

  it("blijft overeind bij een onvolledige afname (halve vragenlijst)", () => {
    const alle = maakAntwoorden("az");
    const helft: Responses = {};
    Object.keys(alle)
      .slice(0, Math.floor(Object.keys(alle).length / 2))
      .forEach((k) => {
        helft[k] = alle[k];
      });
    const contract = buildGeneratorContract({
      respondentCode: "T4P-GOUDEN-002",
      name: "Halve Afname",
      company: null,
      role: null,
      consentScope: null,
      consentTimestamp: null,
      responses: helft,
      baseline: 4,
      connection: { q1: 0, q2: 0, q3: 0, q4: 0 },
      taal: "nl",
    });
    const html = zonderIngebedeBinaireData(
      renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract)),
    );
    for (const naald of ["undefined", "NaN", "[object Object]"]) {
      expect(html.split(naald).length - 1, `plekhouder bij halve afname: ${naald}`).toBe(0);
    }
    const koppen = [...html.matchAll(/<span class="chap-num">(\d{2})<\/span>/g)].map((m) => m[1]);
    expect(koppen.length).toBe(24);
  });

  it("volgt de bestandsnaamconventie 'T4P Business Kompas - <naam> - DDMMJJJJ (confidential).pdf'", () => {
    expect(kompasBestandsnaam("Marc Debisschop", "2026-06-14T10:00:00.000Z")).toBe(
      "T4P Business Kompas - Marc Debisschop - 14062026 (confidential).pdf",
    );
    expect(kompasBestandsnaam("Ann Verhoeven", "2026-06-05T23:30:00.000Z")).toBe(
      "T4P Business Kompas - Ann Verhoeven - 05062026 (confidential).pdf",
    );
  });
});
