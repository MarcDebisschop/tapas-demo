// ---------------------------------------------------------------------------
// tests/afname-instrument-en-rapport.test.ts
//
// Wat deze tests vastleggen:
//   1. Wanneer een afname wordt afgerond, moet er meteen een rapport bestaan
//      voor elk instrument met een eigen, synchrone generator. Zonder dat
//      rapport blijft het deelnemersdashboard op "Rapport in voorbereiding"
//      staan en verschijnt er nooit een bekijk- of downloadknop: die knoppen
//      hangen in client/src/pages/dashboard.tsx aan `a.rapporten.length > 0`,
//      en POST /api/rapporten is enkel bereikbaar met een beheerderssessie.
//   2. De grens ligt bij een eigen generator, niet bij één hardgecodeerd
//      instrument. server/storage.ts draait de AI-duiding uitsluitend wanneer
//      `heeftDedicatedGenerator` onwaar is; instrumenten mét een eigen
//      generator zijn dus synchroon en kunnen veilig tijdens het afronden
//      gebouwd worden. Instrumenten zonder eigen generator blijven op het
//      bestaande, beheerder-gestuurde pad.
//   3. Het instrument wordt uit het bevroren contract gelezen, met terugval op
//      de kolom. In oudere gegevens is de kolom `instrumentId` leeg terwijl
//      het contract de werkelijke waarde wel draagt.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RAPPORT_GENERATORS } from "../server/rapport-registry";
import {
  instrumentVanAfname,
  magRapportDirectNaAfronden,
} from "../server/afname-instrument";

const afnamesBron = readFileSync(resolve(__dirname, "../server/routes/afnames.ts"), "utf8");

describe("welk instrument hoort bij een afgeronde afname", () => {
  it("leest het instrument uit het bevroren contract", () => {
    expect(instrumentVanAfname({ instrumentId: "t4p-business-kompas" }, null)).toBe(
      "t4p-business-kompas",
    );
  });

  it("valt terug op de kolom wanneer het contract geen instrument draagt", () => {
    expect(instrumentVanAfname({}, "t4teens")).toBe("t4teens");
    expect(instrumentVanAfname(null, "t4students")).toBe("t4students");
  });

  it("laat het contract voorgaan op de kolom", () => {
    // In oudere gegevens staat in de kolom soms een andere of lege waarde dan
    // in het contract waaruit het rapport werkelijk gebouwd wordt.
    expect(instrumentVanAfname({ instrumentId: "t4students" }, "t4p-business-kompas")).toBe(
      "t4students",
    );
  });

  it("geeft een lege tekst wanneer geen van beide een instrument draagt", () => {
    expect(instrumentVanAfname(null, null)).toBe("");
    expect(instrumentVanAfname({ instrumentId: "   " }, "  ")).toBe("");
  });

  it("verslikt zich niet in een onverwachte contractvorm", () => {
    expect(instrumentVanAfname("geen object" as unknown as null, "t4teens")).toBe("t4teens");
    expect(instrumentVanAfname({ instrumentId: 42 } as unknown as null, "t4teens")).toBe("t4teens");
  });
});

describe("mag het rapport meteen bij het afronden gebouwd worden", () => {
  it("bouwt het rapport voor elk instrument met een eigen generator", () => {
    const metEigenGenerator = Object.keys(RAPPORT_GENERATORS);
    // Vangnet: als de registry ooit leeg zou lopen, zegt deze test niets meer.
    expect(metEigenGenerator.length).toBeGreaterThanOrEqual(3);
    for (const instrumentId of metEigenGenerator) {
      expect(magRapportDirectNaAfronden(instrumentId)).toBe(true);
    }
  });

  it("dekt uitdrukkelijk T4P Business Kompas, T4Students en T4Teens", () => {
    expect(magRapportDirectNaAfronden("t4p-business-kompas")).toBe(true);
    expect(magRapportDirectNaAfronden("t4students")).toBe(true);
    expect(magRapportDirectNaAfronden("t4teens")).toBe(true);
  });

  it("laat instrumenten zonder eigen generator op het bestaande pad staan", () => {
    // Deze vallen in storage.genereerRapport terug op de generieke bouwer, die
    // een AI-duiding kan aanroepen; dat hoort niet in de afrondingsstap thuis.
    expect(magRapportDirectNaAfronden("t4o")).toBe(false);
    expect(magRapportDirectNaAfronden("hdd")).toBe(false);
    expect(magRapportDirectNaAfronden("")).toBe(false);
    expect(magRapportDirectNaAfronden(null)).toBe(false);
    expect(magRapportDirectNaAfronden(undefined)).toBe(false);
  });
});

describe("de afrondingsroute gebruikt die beslissing werkelijk", () => {
  it("bouwt het rapport op precies één plek, en pas na de gedeelde beslissing", () => {
    const aanroepen = afnamesBron.match(/storage\.genereerRapport\(/g) ?? [];
    expect(aanroepen).toHaveLength(1);
    const beslissing = afnamesBron.indexOf("magRapportDirectNaAfronden(");
    const bouw = afnamesBron.indexOf("storage.genereerRapport(");
    expect(beslissing).toBeGreaterThan(-1);
    expect(bouw).toBeGreaterThan(beslissing);
  });

  it("leest het instrument uit het contract in plaats van enkel uit de kolom", () => {
    // De contractbouw hierboven mag wél op de kolom beslissen; de rapportstap
    // niet, want in oudere gegevens is die kolom leeg.
    expect(afnamesBron).toMatch(/instrumentVanAfname\(contract, a\.instrumentId\)/);
  });

  it("laat een mislukte rapportbouw de afronding nooit blokkeren", () => {
    const start = afnamesBron.indexOf("magRapportDirectNaAfronden(");
    expect(start).toBeGreaterThan(-1);
    const blok = afnamesBron.slice(start, start + 700);
    expect(blok).toMatch(/try \{/);
    expect(blok).toMatch(/catch/);
  });
});
