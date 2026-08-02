// ---------------------------------------------------------------------------
// tests/t4teens-invulbaar.test.ts
//
// Stap 1 van de opdracht: nameten of T4Teens werkelijk niet invulbaar is.
//
// De melding luidde dat het invulscherm per blok minstens twee uitspraken
// verwacht terwijl de server er een aanlevert. Die melding kwam uit een
// leesbeurt van de code. Deze tests meten het.
//
// Wat hier gemeten wordt, en hoe:
//   1. Wat de server werkelijk per blok aanlevert. Niet uit de code afgeleid,
//      maar opgehaald bij de echte route via een echte HTTP-aanroep.
//   2. Of de deelnemer een blok af kan krijgen. Het scherm biedt maar twee
//      handelingen per uitspraak: "meest" en "minst". Die twee handelingen
//      staan hieronder nagebouwd zoals deel1.tsx ze uitvoert, en we lopen
//      alle bereikbare toestanden af. Kan geen enkele toestand het blok
//      afronden, dan blijft de deelnemer werkelijk steken.
//   3. Of het bij elk blok misgaat of alleen bij sommige.
//   4. Of er een omweg is: het scherm laat "volgende" en "afronden" alleen toe
//      als het blok af is, dus als geen blok af kan, is er geen weg vooruit.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// De route leest opgeslagen vraag-overschrijvingen uit de databank. Die zijn
// voor deze meting niet van belang; zonder overschrijvingen levert de route
// de originele teksten en exact dezelfde blokvorm.
vi.mock("../server/question-manager", async () => {
  const echt = await vi.importActual<any>("../server/question-manager");
  return { ...echt, getOverridesMap: () => new Map() };
});

import { registerVragenlijstT4TeensRoutes } from "../server/routes/vragenlijst-t4teens";
import { blokAntwoordVolledig } from "@shared/verplicht-antwoorden";
import type { BlokAntwoord } from "@shared/verplicht-antwoorden";

interface GemetenBlok {
  blockIndex: number;
  stateKey: string;
  family: string;
  energyMode: "item" | "block";
  items: { pos: string; text: string }[];
}

let blokken: GemetenBlok[] = [];

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

// ─── Het scherm nagebouwd ────────────────────────────────────────────────────
// setMost en setLeast uit client/src/pages/deel1.tsx, letterlijk overgenomen.
// Een uitspraak kan niet tegelijk de meest- en de minst-keuze zijn: wie een
// uitspraak op "meest" zet terwijl ze al op "minst" stond, maakt de andere leeg.

const leegAntwoord = (): BlokAntwoord => ({
  most: null,
  least: null,
  itemEnergy: { most: null, least: null },
  blockEnergy: null,
});

function klikMeest(a: BlokAntwoord, pos: string): BlokAntwoord {
  const least = a.least === pos ? null : a.least;
  return { ...a, most: a.most === pos ? null : pos, least };
}

function klikMinst(a: BlokAntwoord, pos: string): BlokAntwoord {
  const most = a.most === pos ? null : a.most;
  return { ...a, least: a.least === pos ? null : pos, most };
}

/**
 * Kan de deelnemer dit blok afkrijgen? Loopt alle keuzetoestanden af die met
 * de knoppen van het scherm bereikbaar zijn, en vult daarna de energieschaal
 * maximaal in. Levert een van die toestanden een volledig blok, dan is het
 * blok invulbaar.
 */
function blokIsAfTeKrijgen(blok: GemetenBlok): boolean {
  const posities = blok.items.map((i) => i.pos);
  const gezien = new Set<string>();
  const wachtrij: BlokAntwoord[] = [leegAntwoord()];

  while (wachtrij.length > 0) {
    const huidig = wachtrij.shift()!;
    const vinger = `${huidig.most ?? "-"}|${huidig.least ?? "-"}`;
    if (gezien.has(vinger)) continue;
    gezien.add(vinger);

    // Energie mag de deelnemer altijd invullen; we gunnen hem elke waarde.
    const ingevuld: BlokAntwoord = {
      ...huidig,
      itemEnergy: { most: 1, least: -1 },
      blockEnergy: 1,
    };
    if (blokAntwoordVolledig(blok, ingevuld)) return true;

    for (const pos of posities) {
      wachtrij.push(klikMeest(huidig, pos));
      wachtrij.push(klikMinst(huidig, pos));
    }
  }
  return false;
}

describe("T4Teens: wat de server per blok aanlevert", () => {
  it("levert blokken aan", () => {
    expect(blokken.length).toBeGreaterThan(0);
  });

  // Gemeten, niet aangenomen: elk blok draagt precies één uitspraak. Dat is de
  // vorm van T4Teens en ze is juist. De itembank kent 25 losse uitspraken, de
  // schaal waardeert er één per keer, en de scoring leest één waarde per item.
  // De melding vermoedde dat de server hier te weinig leverde; de meting wijst
  // uit dat het scherm te veel verwachtte.
  it("draagt één uitspraak per blok, voor alle blokken", () => {
    const aantallen = new Set(blokken.map((b) => b.items.length));
    expect([...aantallen]).toEqual([1]);
  });

  it("benoemt zo'n blok als waarderingsblok, met één waardering voor het blok", () => {
    const afwijkend = blokken.filter((b) => b.energyMode !== "block").map((b) => b.stateKey);
    expect(afwijkend).toEqual([]);
  });
});

describe("T4Teens: kan de deelnemer de vragenlijst afmaken", () => {
  it("elk blok is met de knoppen van het scherm af te krijgen", () => {
    const vastlopers = blokken.filter((b) => !blokIsAfTeKrijgen(b)).map((b) => b.stateKey);
    expect(vastlopers).toEqual([]);
  });

  it("de deelnemer komt voorbij het eerste blok", () => {
    expect(blokIsAfTeKrijgen(blokken[0]!)).toBe(true);
  });

  // De keerzijde: invulbaar maken mag niet betekenen dat een blok zonder
  // antwoord doorgelaten wordt.
  it("laat geen blok door waarin niets ingevuld is", () => {
    const doorgelaten = blokken
      .filter((b) => blokAntwoordVolledig(b, leegAntwoord()))
      .map((b) => b.stateKey);
    expect(doorgelaten).toEqual([]);
  });
});
