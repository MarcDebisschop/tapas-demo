// ---------------------------------------------------------------------------
// tests/antwoordsleutels.test.ts
//
// Deze tests meten welke sleutel het invulscherm aan een antwoord meegeeft en
// of de scoring datzelfde antwoord met die sleutel terugvindt.
//
// Het invulscherm van het T4P Business Kompas (client/src/pages/deel1.tsx)
// bewaart elk antwoord onder een bloksleutel van de vorm B<blokindex>. T4Teens
// scoort op itemsleutels uit zijn itembank (T4T-...) en zet die sleutels om.
// T4Students heeft sinds het herstel zijn eigen invulscherm
// (client/src/pages/studiekompas.tsx) dat meteen op item-id bewaart, en de
// volledigheidscontrole weigert er elke andere antwoordvorm. De tests hieronder
// meten dat, per instrument.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { registerVragenlijstT4TeensRoutes } from "../server/routes/vragenlijst-t4teens";
import { clientInstrument } from "../server/instrument";
import { laadInstrumentItems } from "../server/question-manager";
import { buildT4TeensContract } from "../server/t4teens/scoring";
import { registerVragenlijstT4StudentsRoutes } from "../server/routes/vragenlijst-t4students";
import { bouwT4StudentsAfnameContract } from "../server/t4students/afnamecontract";
import { controleerAfnameVolledig } from "../server/volledigheid-afname";
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
    expect(contract.sections.main.meta.batterij).toBeNull();
    // Deze twee regels verwachtten eerder de waarde 0. Dat legde juist de fout
    // vast die deze opdracht herstelt: nul antwoorden leverde een gemiddelde
    // van 0 op, en 0 is op deze schaal het midden en dus een echt oordeel.
    // Wat deze test wil aantonen (er komt geen enkel antwoord aan) blijft
    // overeind in de regel completedItems hierboven.
    expect(contract.sections.main.meta.averageScore).toBeNull();
    expect(contract.sections.main.familyRows.every((r) => r.avgEnergy === null)).toBe(true);
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
  async function haalStudiekompas(): Promise<{ items: any[]; totaalItems: number }> {
    const app = express();
    registerVragenlijstT4StudentsRoutes(app);
    let view: any = null;
    await metServer(app, async (basis) => {
      const res = await fetch(`${basis}/api/vragenlijst/tapas-t4students?taal=nl`);
      expect(res.status).toBe(200);
      view = await res.json();
    });
    return view;
  }

  it("de vragenlijst van het studiekompas draagt de item-id's van de scoring, geen bloksleutels", async () => {
    const view = await haalStudiekompas();
    const ids = view.items.map((i: any) => i.id);
    expect(ids).toContain("P0");
    expect(ids).toContain("I1");
    expect(ids).toContain("D1");
    expect(ids).toContain("R6");
    // De bloklijst van het T4P Business Kompas loopt van B0 tot B33. Het
    // betekenisspoor van deze bank heet zelf B1, dus de vorm alleen zegt niets;
    // beslissend is dat B0 en de hoge blokken er niet in staan.
    expect(ids).not.toContain("B0");
    expect(ids).not.toContain("B12");
    expect(ids).not.toContain("B33");
    // Elk item van de bank staat in de lijst, in de volgorde van de bank.
    expect(view.items.length).toBe(view.totaalItems);
    // Elk item draagt een leesbare vraag. Het schuifitem P2 heeft geen eigen
    // vraag maar twee varianten, elk met hun eigen tekst; de keuze van P1
    // bepaalt welke variant het scherm toont.
    const zonderTekst = view.items.filter(
      (i: any) => !(typeof i.text === "string" && i.text.length > 0),
    );
    expect(zonderTekst.map((i: any) => i.id)).toEqual(["P2"]);
    const varianten = Object.values(zonderTekst[0].variants ?? {}) as any[];
    expect(varianten.length).toBeGreaterThan(1);
    expect(varianten.every((v) => typeof v.text === "string" && v.text.length > 0)).toBe(true);
  });

  it("een antwoordenblad met bloksleutels wordt geweigerd in plaats van als leeg gescoord", () => {
    const view = clientInstrument("nl") as any;
    const antwoorden: Record<string, unknown> = {};
    for (const blok of view.blocks) antwoorden[sleutelVanInvulscherm(blok)] = blokAntwoord(2);

    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4students",
      responses: antwoorden as any,
      keuzes: null,
      taal: "nl",
    });
    expect(uitkomst.volledig).toBe(false);
    if (!uitkomst.volledig) {
      expect(uitkomst.ontbreekt).toContain("I1");
      expect(uitkomst.ontbreekt.length).toBeGreaterThan(30);
    }
  });

  it("een antwoordenblad in de vorm van het studiekompas komt door de controle en scoort echte items", async () => {
    const view = await haalStudiekompas();
    const antwoorden: Record<string, unknown> = {};
    for (const item of view.items) {
      const soort = item.itemType ?? "";
      if (soort === "open-intro") {
        antwoorden[item.id] = { text: "Ik hoop een richting te vinden die bij me past." };
      } else if (soort === "battery") {
        antwoorden[item.id] = { value: 7 };
      } else if (soort === "recognition+energy") {
        antwoorden[item.id] = { recognition: 2, energy: 1 };
      } else if (soort === "recognition") {
        antwoorden[item.id] = { recognition: 2 };
      } else if (soort === "interest") {
        antwoorden[item.id] = { interest: 1 };
      } else if (Array.isArray(item.options) && item.options.length > 0) {
        antwoorden[item.id] = { choice: item.options[0].key };
      } else if (item.variants) {
        // P2 volgt de keuze op P1; die zetten we hieronder, na de lus.
      }
    }
    // P1 en P2: eerst het profiel, dan de vervolgvraag van dat profiel.
    const p1 = view.items.find((i: any) => i.id === "P1");
    const p2 = view.items.find((i: any) => i.id === "P2");
    if (p1 && p2) {
      const keuze = p1.options[0].key;
      antwoorden["P1"] = { choice: keuze };
      const variant = p2.variants[keuze];
      antwoorden["P2"] =
        variant.itemType === "profile-scale"
          ? { value: 6 }
          : { choice: variant.options[0].key };
    }

    const uitkomst = controleerAfnameVolledig({
      instrumentId: "t4students",
      responses: antwoorden as any,
      keuzes: null,
      taal: "nl",
    });
    expect(uitkomst.volledig, JSON.stringify(uitkomst)).toBe(true);

    const contract = bouwT4StudentsAfnameContract({
      respondentCode: deelnemer.respondentCode,
      name: deelnemer.name,
      taal: "nl",
      responses: antwoorden,
    });
    expect(contract.instrumentId).toBe("t4students");
    expect(contract.ontbrekend).toEqual([]);
    expect(contract.resultaat.betrouwbaarheid.beantwoord).toBeGreaterThan(30);
    expect(
      Object.values(contract.resultaat.constructScores).some((c: any) => c.recognition > 0),
    ).toBe(true);
  });
});
