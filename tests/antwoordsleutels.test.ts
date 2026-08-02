// ---------------------------------------------------------------------------
// tests/antwoordsleutels.test.ts
//
// Deze tests meten welke sleutel het invulscherm aan een antwoord meegeeft en
// of de scoring datzelfde antwoord met die sleutel terugvindt.
//
// Het invulscherm (client/src/pages/deel1.tsx) bewaart elk antwoord onder een
// bloksleutel van de vorm B<blokindex>. De scoringsmodules van T4Students en
// T4Teens zoeken een antwoord op met de itemsleutel uit de itembank
// (T4S-... respectievelijk T4T-...). De tests hieronder tonen wat daar in
// werkelijkheid van terechtkomt, per instrument.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { registerVragenlijstT4TeensRoutes } from "../server/routes/vragenlijst-t4teens";
import { clientInstrument } from "../server/instrument";
import { laadInstrumentItems } from "../server/question-manager";
import { buildT4TeensContract } from "../server/t4teens/scoring";
import { buildT4StudentsContract } from "../server/t4students/scoring";
import { naarItemSleutels } from "../server/t4teens/antwoordsleutels";

// Eén blok-antwoord zoals deel1.tsx het opbouwt (shared/schema blockResponseSchema).
function blokAntwoord(energie: number) {
  return {
    most: "A",
    least: null,
    itemEnergy: { most: energie, least: null },
    blockEnergy: null,
    toelichting: null,
  };
}

// Exact de sleutel die deel1.tsx zet: `B${block.blockIndex}` (deel1.tsx:126).
function sleutelVanInvulscherm(block: { blockIndex: number }): string {
  return `B${block.blockIndex}`;
}

async function metServer(app: express.Express, fn: (basis: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

async function haalT4TeensVragenlijst(): Promise<{ blocks: { blockIndex: number; stateKey: string }[] }> {
  const app = express();
  registerVragenlijstT4TeensRoutes(app);
  let view: any = null;
  await metServer(app, async (basis) => {
    const res = await fetch(`${basis}/api/vragenlijst/tapas-t4teens?taal=nl`);
    expect(res.status).toBe(200);
    view = await res.json();
  });
  return view;
}

const deelnemer = {
  respondentCode: "TEST-SLEUTELS",
  name: "Testpersoon",
  company: null,
  role: null,
  consentScope: "test",
  consentTimestamp: null,
  taal: "nl",
};

describe("T4Teens - de weg van een antwoord van invulscherm tot scoring", () => {
  it("het invulscherm geeft elk antwoord een bloksleutel B<index>, geen itemsleutel", async () => {
    const view = await haalT4TeensVragenlijst();
    const sleutels = view.blocks.map(sleutelVanInvulscherm);

    expect(sleutels.length).toBe(25);
    expect(sleutels[0]).toBe("B0");
    expect(sleutels[24]).toBe("B24");
    // De vragenlijst zet zelf ook al stateKey; die is identiek aan wat het
    // invulscherm afleidt, dus er gebeurt onderweg geen omzetting.
    expect(view.blocks.map((b: any) => b.stateKey)).toEqual(sleutels);
    expect(sleutels.some((s: string) => s.startsWith("T4T-"))).toBe(false);
  });

  it("de scoring zoekt op itemsleutels, en die overlappen niet met de bloksleutels", async () => {
    const view = await haalT4TeensVragenlijst();
    const bloksleutels = new Set(view.blocks.map(sleutelVanInvulscherm));
    const itemsleutels = laadInstrumentItems("tapas-t4teens").map((i) => i.itemId);

    expect(itemsleutels.length).toBe(25);
    expect(itemsleutels.every((id) => id.startsWith("T4T-"))).toBe(true);
    expect(itemsleutels.filter((id) => bloksleutels.has(id))).toEqual([]);
  });

  it("de vragenlijst en de itembank staan in dezelfde volgorde, dus blokindex wijst één item aan", async () => {
    // Deze test bewaakt de aanname onder de omzetting in
    // server/t4teens/antwoordsleutels.ts. De vragenlijstroute houdt een eigen
    // kopie van de itemlijst bij; als die kopie uit de pas loopt met de
    // itembank, zou de omzetting stil op het verkeerde item landen.
    const view = await haalT4TeensVragenlijst();
    const items = laadInstrumentItems("tapas-t4teens");
    expect(view.blocks.length).toBe(items.length);
    for (const blok of view.blocks as any[]) {
      expect(items[blok.blockIndex]).toBeDefined();
    }
  });

  it("zonder omzetting landt een volledig ingevulde afname op nul items", async () => {
    const view = await haalT4TeensVragenlijst();
    const antwoorden: Record<string, unknown> = {};
    for (const blok of view.blocks) antwoorden[sleutelVanInvulscherm(blok)] = blokAntwoord(1);

    const contract = buildT4TeensContract({ ...deelnemer, responses: antwoorden });

    expect(contract.sections.main.meta.completedItems).toBe(0);
    expect(contract.sections.main.meta.averageScore).toBe(0);
    expect(contract.sections.main.meta.batterij).toBeNull();
    expect(contract.sections.main.familyRows.every((r) => r.avgEnergy === 0)).toBe(true);
  });

  it("met de omzetting landt elk antwoord op het item waarvoor het gegeven is", async () => {
    const view = await haalT4TeensVragenlijst();
    const items = laadInstrumentItems("tapas-t4teens");
    const antwoorden: Record<string, unknown> = {};
    for (const blok of view.blocks) {
      const itemId = items[blok.blockIndex]!.itemId;
      // Batterij +2, het analyse-item -2, al de rest +1. Zo is per cluster
      // controleerbaar of de score op het juiste item is terechtgekomen.
      const energie = itemId === "T4T-I1-1" ? 2 : itemId === "T4T-V1-1" ? -2 : 1;
      antwoorden[sleutelVanInvulscherm(blok)] = blokAntwoord(energie);
    }

    const contract = buildT4TeensContract({
      ...deelnemer,
      responses: naarItemSleutels(antwoorden),
    });

    expect(contract.sections.main.meta.completedItems).toBe(24);
    expect(contract.sections.main.meta.batterij).toBe(2);

    const rij = (construct: string) =>
      contract.sections.main.constructRows.find((r) => r.construct === construct);
    expect(rij("Analyse")).toMatchObject({ avgEnergy: -2, most: 0, least: 1, shown: 1 });
    expect(rij("Coaching")).toMatchObject({ avgEnergy: 1, most: 1, least: 0, shown: 1 });
    expect(rij("Betekenis")).toMatchObject({ avgEnergy: 1, shown: 1 });
  });

  it("de omzetting laat sleutels die al itemsleutels zijn ongemoeid", () => {
    const bron = { "T4T-D1-1": blokAntwoord(2), onbekend: blokAntwoord(1) };
    expect(Object.keys(naarItemSleutels(bron)).sort()).toEqual(["T4T-D1-1", "onbekend"]);
  });
});

describe("T4Students - de weg van een antwoord van invulscherm tot scoring", () => {
  it("het invulscherm toont voor T4Students niet de T4Students-vragenlijst", () => {
    // deel1.tsx kent alleen voor t4kids en t4teens een eigen endpoint; elke
    // andere afname valt terug op /api/instrument, en dat levert T4P Business.
    const view = clientInstrument("nl") as any;
    expect(view.instrumentId).toBe("t4p-business-kompas");
    expect(view.blocks.length).toBe(34);
  });

  it("de bloksleutels van dat scherm komen in niets overeen met de T4Students-itembank", () => {
    const view = clientInstrument("nl") as any;
    const bloksleutels = new Set(view.blocks.map(sleutelVanInvulscherm));
    const items = laadInstrumentItems("tapas-t4students");

    expect(items.length).toBe(37);
    expect(items.every((i) => i.itemId.startsWith("T4S-"))).toBe(true);
    expect(items.filter((i) => bloksleutels.has(i.itemId))).toEqual([]);
    // Er zijn ook niet evenveel blokken als items, dus ook een omzetting op
    // volgorde is hier niet mogelijk.
    expect(view.blocks.length).not.toBe(items.length);
  });

  it("een volledig ingevulde afname levert daardoor een leeg T4Students-contract", () => {
    const view = clientInstrument("nl") as any;
    const antwoorden: Record<string, unknown> = {};
    for (const blok of view.blocks) antwoorden[sleutelVanInvulscherm(blok)] = blokAntwoord(2);

    const contract = buildT4StudentsContract({ ...deelnemer, responses: antwoorden });

    expect(contract.sections.main.meta.completedItems).toBe(0);
    expect(contract.sections.main.meta.averageScore).toBe(0);
    expect(contract.sections.main.constructRows.every((r) => r.avgEnergy === 0)).toBe(true);
  });
});
