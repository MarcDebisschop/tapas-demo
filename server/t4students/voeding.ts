// ---------------------------------------------------------------------------
// server/t4students/voeding.ts
//
// Hoeveel elk construct hoogstens kan halen, uitsluitend uit het instrument
// gerekend. Dit bestand staat los van kompas-scoring.ts en van
// rapport-contract.ts, zodat beide ervan kunnen importeren zonder dat er een
// kringverwijzing ontstaat: de motor gebruikt maxHerkenning voor het aandeel
// (herstelronde, tweede deel, punt A), en de rapportlaag gebruikt het voor
// dezelfde reden als voorheen.
//
// Deze functies stonden eerder in rapport-contract.ts. rapport-contract.ts
// voert ze hier opnieuw uit (re-export), zodat bestaande imports elders in de
// code en in tests ongewijzigd blijven werken.
// ---------------------------------------------------------------------------

import type { T4SInstrument, T4SItem } from "./instrument";

/**
 * Per construct: welke items eraan kunnen bijdragen, en hoeveel elk item er
 * hoogstens aan bij kan dragen. Alles uit het instrument gerekend, niets met de
 * hand. Een keuze-item telt mee bij elk construct dat in een van zijn opties
 * geladen wordt, want de student kan die optie kiezen.
 */
export interface T4SVoeding {
  /** Item-id's die de herkenning van dit construct kunnen voeden. */
  herkenningsItems: string[];
  /** Item-id's die de energie van dit construct kunnen voeden. */
  energieItems: string[];
  /** De hoogst haalbare herkenningssom voor dit construct. */
  maxHerkenning: number;
}

export function voedingPerConstruct(inst: T4SInstrument): Record<string, T4SVoeding> {
  const sm = inst.scoringMap;
  const items = itemIndex(inst);
  const uit: Record<string, T4SVoeding> = {};

  function reserveer(con: string): T4SVoeding {
    if (!uit[con]) uit[con] = { herkenningsItems: [], energieItems: [], maxHerkenning: 0 };
    return uit[con];
  }
  for (const fam of inst.families) for (const con of fam.constructs) reserveer(con);

  const schaalMax = (naam: string | undefined): number => {
    if (!naam) return 0;
    const s = (inst.responseScales as Record<string, { max?: number }>)[naam];
    return s && typeof s.max === "number" ? s.max : 0;
  };

  for (const [itemId, con] of Object.entries(sm.recognitionItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  for (const [itemId, con] of Object.entries(sm.beeldItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  for (const [itemId, con] of Object.entries(sm.interestItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  // De vijf motivatie-items (MOT-INT-*/MOT-EXT-*) voeden hun eigen construct
  // in de familie Motivatie op precies dezelfde manier als recognitionItems.
  // Zonder deze lus telde de familie Motivatie nul voedende items, en toonde
  // het dekkingsblad "0 van 0" ook wanneer de motivatievragen wel beantwoord
  // waren (onderdeel A1 van de opdracht "Studiekompas persoonlijk maken").
  // Dit raakt uitsluitend de telling op het dekkingsblad; het signaalgetal
  // van de motor (totaalSignaal, drempel voorlopig/voldoende) blijft de vaste
  // lijst SIGNAALDRAGENDE_ITEMS gebruiken en leest hier niet uit.
  for (const [itemId, con] of Object.entries(sm.motivationItems)) {
    const v = reserveer(con);
    v.herkenningsItems.push(itemId);
    v.maxHerkenning += schaalMax(items[itemId]?.scale);
  }
  // Keuze-items: D5, D6, F4, F5 uit sjtItems, en S1 dat de motor apart leest.
  for (const itemId of [...sm.sjtItems, "S1"]) {
    const it = items[itemId];
    if (!it || !it.options) continue;
    const zwaarste: Record<string, number> = {};
    for (const opt of it.options) {
      for (const load of opt.loads || []) {
        if (load.weight <= 0) continue;
        zwaarste[load.construct] = Math.max(zwaarste[load.construct] || 0, load.weight);
      }
    }
    for (const [con, gewicht] of Object.entries(zwaarste)) {
      const v = reserveer(con);
      v.herkenningsItems.push(itemId);
      v.maxHerkenning += gewicht;
    }
  }
  for (const itemId of sm.energyItems) {
    const it = items[itemId];
    if (!it || !it.construct) continue;
    reserveer(it.construct).energieItems.push(itemId);
  }
  return uit;
}

export function itemIndex(inst: T4SInstrument): Record<string, T4SItem> {
  const uit: Record<string, T4SItem> = {};
  const main = inst.sections.find((s) => s.sectionId === "main");
  for (const it of main ? main.items : []) uit[it.id] = it;
  return uit;
}
