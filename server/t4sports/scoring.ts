// server/t4sports/scoring.ts
// Scoring engine voor T4Sports — Mental Talent Profiel.
// Identieke logica als server/scoring.ts maar gericht op t4sports instrument.

import { hydrateInstrument } from "../instrument";
import type { InstrumentBlock } from "../instrument";
import t4sportsJson from "../data/t4sports.json";

const t4sportsInstrument = hydrateInstrument(t4sportsJson);
const blocks: InstrumentBlock[] = t4sportsInstrument.blocks;

function round2(x: number): number {
  return Number(x.toFixed(2));
}

export interface BlockResponse {
  most: string | null;
  least: string | null;
  itemEnergy: { most: number | null; least: number | null };
  blockEnergy: number | null;
}
export type Responses = Record<string, BlockResponse>;

export interface ConstructRow {
  construct: string;
  family: string;
  most: number;
  least: number;
  net: number;
  shown: number;
  avgEnergy: number;
  energySource: string;
  mostItems: string[];
}
export interface FamilyRow {
  family: string;
  avgEnergy: number;
}

interface ConstructAcc {
  family: string;
  shown: number;
  most: number;
  least: number;
  energyVals: number[];
  energySource: Set<string>;
  mostItems: string[];
}
interface FamilyAcc {
  energyVals: number[];
}

function aggregate(responses: Responses): { rows: ConstructRow[]; famRows: FamilyRow[] } {
  const constructs: Record<string, ConstructAcc> = {};
  const families: Record<string, FamilyAcc> = {};

  blocks.forEach((b, idx) => {
    const r = responses["B" + idx];
    if (!r) return;
    if (!families[b.family]) families[b.family] = { energyVals: [] };
    if (b.energyMode === "block" && r.blockEnergy !== null && r.blockEnergy !== undefined) {
      families[b.family].energyVals.push(r.blockEnergy);
    }
    b.items.forEach((it) => {
      if (!constructs[it.construct]) {
        constructs[it.construct] = {
          family: it.family,
          shown: 0,
          most: 0,
          least: 0,
          energyVals: [],
          energySource: new Set<string>(),
          mostItems: [],
        };
      }
      const c = constructs[it.construct];
      c.shown += 1;
      if (r.most === it.pos) {
        c.most += 1;
        c.mostItems.push(typeof it.text === "string" ? it.text : (it.text as any)?.nl ?? "");
        if (b.energyMode === "item" && r.itemEnergy.most !== null && r.itemEnergy.most !== undefined) {
          c.energyVals.push(r.itemEnergy.most);
          c.energySource.add("item");
          families[b.family].energyVals.push(r.itemEnergy.most);
        }
      }
      if (r.least === it.pos) {
        c.least += 1;
        if (b.energyMode === "item" && r.itemEnergy.least !== null && r.itemEnergy.least !== undefined) {
          c.energyVals.push(r.itemEnergy.least);
          c.energySource.add("item");
          families[b.family].energyVals.push(r.itemEnergy.least);
        }
      }
      if (b.energyMode === "block" && r.blockEnergy !== null && r.blockEnergy !== undefined) {
        c.energyVals.push(r.blockEnergy);
        c.energySource.add("block");
      }
    });
  });

  const rows: ConstructRow[] = Object.entries(constructs).map(([construct, v]) => ({
    construct,
    family: v.family,
    most: v.most,
    least: v.least,
    net: v.most - v.least,
    shown: v.shown,
    avgEnergy: v.energyVals.length
      ? round2(v.energyVals.reduce((a, b) => a + b, 0) / v.energyVals.length)
      : 0,
    energySource: Array.from(v.energySource).join("+") || "geen",
    mostItems: v.mostItems,
  }));

  const famRows: FamilyRow[] = Object.entries(families).map(([family, v]) => ({
    family,
    avgEnergy: v.energyVals.length
      ? round2(v.energyVals.reduce((a, b) => a + b, 0) / v.energyVals.length)
      : 0,
  }));

  return { rows, famRows };
}

// Sport-hertaling van construct-namen
const SPORT_NAAM: Record<string, string> = {
  // Talent-foci
  "Functioneel Innovatief": "De Probleemoplosser",
  "Artistiek Innovatief": "De Expressionist",
  "Complexiteit/Conceptueel": "De Strateeg",
  "Systematisch/Uitvoerend": "De Uitvoerder",
  "Sociaal Interactief": "De Verbinder",
  "Overdrachtelijk Interactief": "De Activator",
  // Talent-versnellers
  "Analyse": "De Ontleder",
  "Individueel ondersteunend": "De Mentor",
  "Groepsondersteunend": "De Orkestrator",
  "Impact": "De Performer",
  "Resultaat": "De Finisher",
  "Constructief onderscheidend": "De Vrijdenker",
};

export function sportNaam(construct: string): string {
  return SPORT_NAAM[construct] ?? construct;
}

function driverRisk(rows: ConstructRow[]): { label: string; dominant: string } {
  const drivers = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net);
  const top = drivers[0];
  const avg = top ? top.avgEnergy : 0;
  let label = "laag";
  if (avg < 0 && avg > -1) label = "matig";
  else if (avg <= -1) label = "hoog";
  return { label, dominant: top?.construct ?? "—" };
}

function energyToTenScale(avg: number): number {
  return round2(((avg + 2) / 4) * 10);
}

function consistencyScore(rows: ConstructRow[], responses: Responses): { score: number; label: string } {
  const answered = Object.values(responses).filter((r): r is BlockResponse => r != null);
  const choicePairs = answered.filter((r) => r.most && r.least).length;
  const energyPresence = answered.filter((r, i) => {
    const b = blocks[i];
    return (
      b &&
      ((b.energyMode === "block" && r.blockEnergy !== null && r.blockEnergy !== undefined) ||
        (b.energyMode === "item" &&
          r.itemEnergy.most !== null &&
          r.itemEnergy.most !== undefined &&
          r.itemEnergy.least !== null &&
          r.itemEnergy.least !== undefined))
    );
  }).length;
  const topDrivers = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net).slice(0, 3);
  const aligned = topDrivers.filter((r) => r.avgEnergy >= 0).length;
  const energySpread = rows.filter((r) => r.family === "Drivers").map((r) => Math.abs(r.avgEnergy)).reduce((a, b) => a + b, 0);
  const indexBase = blocks.length ? (choicePairs / blocks.length) * 40 + (energyPresence / blocks.length) * 30 : 0;
  const driverPart = topDrivers.length ? (aligned / topDrivers.length) * 20 : 0;
  const spreadPart = Math.max(0, 10 - Math.min(10, energySpread));
  const score = Math.round(indexBase + driverPart + spreadPart);
  const clamped = Math.max(0, Math.min(100, score));
  let label = "laag";
  if (clamped >= 80) label = "hoog";
  else if (clamped >= 60) label = "middelmatig";
  return { score: clamped, label };
}

export interface ConnectionAnswers {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export function buildT4SportsContract(opts: {
  respondentCode: string;
  name: string;
  sporttak?: string | null;
  ploeg?: string | null;
  rol?: string | null;
  baselineEnergy: number;
  responses: Responses;
  connection: ConnectionAnswers;
  taal?: string | null;
}) {
  const { rows, famRows } = aggregate(opts.responses);

  const allEnergy = rows.map((r) => r.avgEnergy).filter((v) => typeof v === "number");
  const avgEnergy = allEnergy.length ? round2(allEnergy.reduce((a, b) => a + b, 0) / allEnergy.length) : 0;
  const normalizedQuestionnaireEnergy = energyToTenScale(avgEnergy);

  const consistency = consistencyScore(rows, opts.responses);
  const driverR = driverRisk(rows);

  const foci = rows.filter((r) => r.family === "Talent-foci").sort((a, b) => b.net - a.net);
  const versnellers = rows.filter((r) => r.family === "Talent-versnellers").sort((a, b) => b.net - a.net);

  const dominanteFocus = foci[0] ? sportNaam(foci[0].construct) : "—";
  const dominanteVersneller = versnellers[0] ? sportNaam(versnellers[0].construct) : "—";
  const dominanteDriver = driverR.dominant;

  const energieProfiel: "hoog" | "midden" | "laag" =
    normalizedQuestionnaireEnergy >= 7 ? "hoog" : normalizedQuestionnaireEnergy >= 4.5 ? "midden" : "laag";

  // Drukprofiel: dominant driver energie bepaalt gaspedaal/rem
  const dominantDriverRow = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net)[0];
  const drukProfiel: "gaspedaal" | "rem" | "wisselvallig" =
    !dominantDriverRow ? "wisselvallig" :
    dominantDriverRow.avgEnergy >= 0.5 ? "gaspedaal" :
    dominantDriverRow.avgEnergy <= -0.5 ? "rem" : "wisselvallig";

  return {
    instrumentId: "t4sports",
    contractVersion: "1.0.0",
    respondentCode: opts.respondentCode,
    name: opts.name,
    sporttak: opts.sporttak ?? null,
    ploeg: opts.ploeg ?? null,
    rol: opts.rol ?? null,
    taal: opts.taal ?? "nl",
    generatedAt: new Date().toISOString(),
    sections: {
      meta: {
        normalizedQuestionnaireEnergy,
        baselineAthleetEnergy: opts.baselineEnergy,
        consistency,
        driverRisk: driverR,
        sportprofiel: {
          dominanteFocus,
          dominanteVersneller,
          dominanteDriver,
          energieProfiel,
          drukProfiel,
        },
      },
      main: {
        constructRows: rows,
        familyRows: famRows,
      },
      connection: {
        answers: opts.connection,
        sportpassie: opts.connection.q1,
        billijkheid: opts.connection.q2,
        mentaleZelfinvestering: opts.connection.q3,
        clubInvestering: opts.connection.q4,
      },
    },
  };
}
