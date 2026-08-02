// ---------------------------------------------------------------------------
// tests/blokvorm-scherm-en-server.test.ts
//
// De blijvende bewaking. Ze zakt zodra het scherm en de server het oneens
// worden over wat een blok bevat.
//
// AANLEIDING
// T4Teens was niet invulbaar. Het invulscherm legde de forced-choice-regel van
// T4P Business op aan blokken met één uitspraak, en vroeg zo om een meest- en
// een minst-keuze die daar niet te maken zijn. Niemand merkte het, want geen
// enkele controle legde de vorm die de server levert naast de eis die het
// scherm stelt.
//
// WAT HIER BEWAAKT WORDT
// Voor elke blokkenbron die een deelnemer werkelijk te zien krijgt:
//   1. elk blok draagt minstens één uitspraak;
//   2. elk blok is met de knoppen van het scherm af te krijgen;
//   3. geen enkel blok gaat door zonder antwoord.
//
// Punt 2 en punt 3 samen zijn de kern. Punt 2 alleen zou te bevredigen zijn
// door de eis te laten vallen; punt 3 sluit dat af. De regel mag dus meebewegen
// met de blokvorm, maar nooit verslappen.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { blokAntwoordVolledig } from "@shared/verplicht-antwoorden";
import {
  blokIsAfTeKrijgen,
  leegAntwoord,
  type GemetenBlok,
} from "./helpers/scherm-blokregel";

vi.mock("../server/question-manager", async () => {
  const echt = await vi.importActual<any>("../server/question-manager");
  return { ...echt, getOverridesMap: () => new Map() };
});

/** Haalt de blokken op bij een route, via een echte HTTP-aanroep. */
async function blokkenViaRoute(
  registreer: (app: express.Express) => void,
  pad: string,
): Promise<GemetenBlok[]> {
  const app = express();
  registreer(app);
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  const res = await fetch(`http://127.0.0.1:${poort}${pad}`);
  if (res.status !== 200) throw new Error(`${pad} gaf status ${res.status}`);
  const body = await res.json();
  await new Promise<void>((klaar) => server.close(() => klaar()));
  return body.blocks;
}

const bronnen: { naam: string; blokken: GemetenBlok[] }[] = [];

beforeAll(async () => {
  // T4P Business: het standaard-instrument, de forced-choice-vorm waarvoor het
  // scherm oorspronkelijk gebouwd is.
  const { clientInstrument } = await import("../server/instrument");
  bronnen.push({ naam: "T4P Business", blokken: clientInstrument("nl").blocks });

  // T4Teens: één uitspraak per blok, gewaardeerd in plaats van gerangschikt.
  const { registerVragenlijstT4TeensRoutes } = await import(
    "../server/routes/vragenlijst-t4teens"
  );
  bronnen.push({
    naam: "T4Teens",
    blokken: await blokkenViaRoute(
      registerVragenlijstT4TeensRoutes,
      "/api/vragenlijst/tapas-t4teens?taal=nl",
    ),
  });

  // T4Kids levert langs deze route dezelfde blokvorm aan. De eigen reis van
  // T4Kids gebruikt ze niet, maar het scherm van deel 1 kan er wel op
  // uitkomen; zie het verslag. Daarom loopt deze bron hier mee.
  const { registerVragenlijstT4KidsRoutes } = await import(
    "../server/routes/vragenlijst-t4kids"
  );
  bronnen.push({
    naam: "T4Kids",
    blokken: await blokkenViaRoute(
      registerVragenlijstT4KidsRoutes,
      "/api/vragenlijst/tapas-t4kids?taal=nl",
    ),
  });
});

describe("scherm en server zijn het eens over wat een blok bevat", () => {
  it("er zijn blokkenbronnen om te bewaken", () => {
    expect(bronnen.length).toBeGreaterThan(0);
    for (const bron of bronnen) {
      expect(bron.blokken.length, `${bron.naam} levert geen blokken`).toBeGreaterThan(0);
    }
  });

  it("elk blok draagt minstens één uitspraak", () => {
    for (const bron of bronnen) {
      const leeg = bron.blokken
        .filter((b) => !Array.isArray(b.items) || b.items.length === 0)
        .map((b) => b.stateKey);
      expect(leeg, `${bron.naam} levert blokken zonder uitspraak`).toEqual([]);
    }
  });

  it("elk blok is met de knoppen van het scherm af te krijgen", () => {
    for (const bron of bronnen) {
      const vastlopers = bron.blokken
        .filter((b) => !blokIsAfTeKrijgen(b))
        .map((b) => `${b.stateKey} (${b.items?.length ?? 0} uitspraken, ${b.energyMode})`);
      expect(vastlopers, `${bron.naam} laat de deelnemer vastlopen`).toEqual([]);
    }
  });

  it("geen enkel blok gaat door zonder antwoord", () => {
    for (const bron of bronnen) {
      const doorgelaten = bron.blokken
        .filter((b) => blokAntwoordVolledig(b, leegAntwoord()))
        .map((b) => b.stateKey);
      expect(doorgelaten, `${bron.naam} laat een leeg blok door`).toEqual([]);
    }
  });
});

describe("de regel beweegt mee met de blokvorm, en verslapt niet", () => {
  const keuzeblok: GemetenBlok = {
    stateKey: "K",
    energyMode: "item",
    items: [{ pos: "A" }, { pos: "B" }, { pos: "C" }, { pos: "D" }],
  };
  const waarderingsblok: GemetenBlok = {
    stateKey: "W",
    energyMode: "block",
    items: [{ pos: "A" }],
  };

  it("een keuzeblok blijft een meest- én een minst-keuze vragen", () => {
    expect(
      blokAntwoordVolledig(keuzeblok, {
        most: "A",
        itemEnergy: { most: 1, least: -1 },
        blockEnergy: 1,
      }),
    ).toBe(false);
    expect(
      blokAntwoordVolledig(keuzeblok, {
        most: "A",
        least: "B",
        itemEnergy: { most: 1, least: -1 },
      }),
    ).toBe(true);
  });

  it("een keuzeblok komt niet weg met alleen een blokwaardering", () => {
    expect(blokAntwoordVolledig(keuzeblok, { blockEnergy: 1 })).toBe(false);
  });

  it("een waarderingsblok vraagt zijn waardering, en niet minder", () => {
    expect(blokAntwoordVolledig(waarderingsblok, { most: "A", least: "A" })).toBe(false);
    expect(blokAntwoordVolledig(waarderingsblok, { blockEnergy: 0 })).toBe(true);
  });
});
