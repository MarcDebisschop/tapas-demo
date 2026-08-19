// ---------------------------------------------------------------------------
// tests/t4teens-volledigheidspoort.test.ts
//
// De testronde van 19 augustus 2026 vond bij T4Teens twee zware punten, met
// dezelfde oorzaak:
//   1. Een lijst met een ontbrekend antwoord kon afgerond worden. De server
//      weigerde niets en bouwde het contract.
//   2. Die afname eindigde daarna als voltooid, met een rapport klaar.
//
// De oorzaak: T4Teens stond niet in de volledigheidspoort van
// server/volledigheid-afname.ts, omdat de descriptor van T4Teens geen blokken
// draagt. Die blokken worden gebouwd in server/routes/vragenlijst-t4teens.ts,
// uit de itembank van de question-manager.
//
// Deze tests leggen vast dat het gat gesloten is en dat de poort niemand
// buitensluit die werkelijk geantwoord heeft:
//   - de verwachte sleutels lopen gelijk met de blokken van de echte route;
//   - een lijst met één gat wordt geweigerd, met dat gat in de melding;
//   - een volledige lijst komt door;
//   - een antwoord onder een itemsleutel telt ook mee;
//   - een waarde nul is een geldig antwoord, niet een gat;
//   - de melding volgt de taal van de afname.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// De route leest opgeslagen vraag-overschrijvingen uit de databank. Die zijn
// voor deze meting niet van belang: zonder overschrijvingen levert de route de
// originele teksten en exact dezelfde blokvorm.
vi.mock("../server/question-manager", async () => {
  const echt = await vi.importActual<any>("../server/question-manager");
  return { ...echt, getOverridesMap: () => new Map() };
});

const { registerVragenlijstT4TeensRoutes } = await import(
  "../server/routes/vragenlijst-t4teens"
);
const { laadInstrumentItems } = await import("../server/question-manager");
const { verwachteT4TeensSleutels, ontbrekendeT4TeensBlokken } = await import(
  "../server/t4teens/volledigheid"
);
const { controleerAfnameVolledig } = await import("../server/volledigheid-afname");
const { buildT4TeensContract } = await import("../server/t4teens/scoring");
const { naarItemSleutels } = await import("../server/t4teens/antwoordsleutels");
const { t: vertaal } = await import("@shared/i18n");

let blokken: { blockIndex: number; stateKey: string }[] = [];

beforeAll(async () => {
  const app = express();
  registerVragenlijstT4TeensRoutes(app);
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  const res = await fetch(`http://127.0.0.1:${poort}/api/vragenlijst/tapas-t4teens?taal=nl`);
  expect(res.status).toBe(200);
  blokken = (await res.json()).blocks;
  await new Promise<void>((klaar) => server.close(() => klaar()));
});

/** Een volledig ingevulde lijst, zoals het invulscherm ze inlevert. */
function volledigeAntwoorden(waarde = 1): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  for (const blok of blokken) {
    uit[blok.stateKey] = {
      most: null,
      least: null,
      itemEnergy: { most: null, least: null },
      blockEnergy: waarde,
    };
  }
  return uit;
}

describe("de verwachte sleutels komen van de echte vragenlijst", () => {
  it("evenveel sleutels als blokken, in dezelfde volgorde", () => {
    const sleutels = verwachteT4TeensSleutels();
    expect(sleutels.length).toBe(blokken.length);
    expect(sleutels).toEqual(blokken.map((b) => b.stateKey));
  });

  it("elke sleutel hoort bij een item van de itembank", () => {
    expect(verwachteT4TeensSleutels().length).toBe(
      laadInstrumentItems("tapas-t4teens").length,
    );
  });
});

describe("de poort weigert een onvolledige T4Teens-lijst", () => {
  it("een weggelaten blok komt in de melding", () => {
    const antwoorden = volledigeAntwoorden();
    delete antwoorden["B7"];

    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4teens",
      responses: antwoorden as any,
      keuzes: null,
      taal: "nl",
    });
    expect(uitkomst.volledig).toBe(false);
    if (!uitkomst.volledig) {
      expect(uitkomst.ontbreekt).toEqual(["B7"]);
      expect(uitkomst.melding).toBe(vertaal("onvolledig_indienen", "nl"));
    }
  });

  it("een blok met een lege waarde telt ook als gat", () => {
    const antwoorden = volledigeAntwoorden();
    (antwoorden["B9"] as any).blockEnergy = null;

    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4teens",
      responses: antwoorden as any,
      keuzes: null,
      taal: "nl",
    });
    expect(uitkomst.volledig).toBe(false);
    if (!uitkomst.volledig) expect(uitkomst.ontbreekt).toEqual(["B9"]);
  });

  it("een lege inzending laat elk blok ontbreken", () => {
    expect(ontbrekendeT4TeensBlokken({})).toEqual(blokken.map((b) => b.stateKey));
  });

  it("de melding volgt de taal van de afname", () => {
    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4teens",
      responses: {} as any,
      keuzes: null,
      taal: "fr",
    });
    expect(uitkomst.volledig).toBe(false);
    if (!uitkomst.volledig) {
      expect(uitkomst.melding).toBe(vertaal("onvolledig_indienen", "fr"));
      expect(uitkomst.melding).not.toBe(vertaal("onvolledig_indienen", "nl"));
    }
  });
});

describe("de poort sluit niemand buiten die geantwoord heeft", () => {
  it("een volledige lijst komt door", () => {
    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4teens",
      responses: volledigeAntwoorden() as any,
      keuzes: null,
      taal: "nl",
    });
    expect(uitkomst.volledig, JSON.stringify(uitkomst)).toBe(true);
  });

  it("de waarde nul is een geldig antwoord en geen gat", () => {
    expect(ontbrekendeT4TeensBlokken(volledigeAntwoorden(0))).toEqual([]);
  });

  it("de poort en de scoring volgen dezelfde regel", () => {
    // Het invulscherm van T4P zet de waardering in itemEnergy.most. De scoring
    // van T4Teens rekent die vorm mee, dus mag de poort ze niet weigeren.
    const antwoorden: Record<string, unknown> = {};
    for (const blok of blokken) {
      antwoorden[blok.stateKey] = {
        most: null,
        least: null,
        itemEnergy: { most: 1, least: null },
        blockEnergy: null,
      };
    }
    expect(ontbrekendeT4TeensBlokken(antwoorden)).toEqual([]);

    const contract = buildT4TeensContract({
      respondentCode: "TT-TEST-1",
      name: "Testkandidaat",
      responses: naarItemSleutels(antwoorden),
      taal: "nl",
    });
    // 25 blokken, waarvan de batterijvraag apart staat.
    expect(contract.sections.main.meta.completedItems).toBe(blokken.length - 1);
  });

  it("een antwoord onder een itemsleutel telt ook mee", () => {
    const items = laadInstrumentItems("tapas-t4teens");
    const antwoorden: Record<string, unknown> = {};
    for (const item of items) {
      antwoorden[item.itemId] = {
        most: null,
        least: null,
        itemEnergy: { most: null, least: null },
        blockEnergy: 2,
      };
    }
    expect(ontbrekendeT4TeensBlokken(antwoorden)).toEqual([]);
  });
});
