import { instrument } from "./instrument";
import type { InstrumentBlock } from "./instrument";

// ---------------------------------------------------------------------------
// Server-side scoringengine — getrouwe port van de gevalideerde JS-engine
// (Fase A, _js_reference_engine.js). De afronding gebruikt exact dezelfde
// JS-semantiek: Number((x).toFixed(2)). In Node/V8 is dat identiek aan de
// browser, dus de scores zijn bit-voor-bit gelijk aan de oorspronkelijke
// frontend-output.
// ---------------------------------------------------------------------------

const blocks: InstrumentBlock[] = instrument.blocks;

// JS toFixed(2)-equivalent: gebruik gewoon de native Number/toFixed van Node,
// die identiek is aan de browser-engine (beide V8 / IEEE-754).
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
        c.mostItems.push(it.text);
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
    energySource: [...v.energySource].join("+") || "geen",
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

export interface DriverRisk {
  avg: number;
  label: string;
  top: ConstructRow[];
}
function driverRisk(rows: ConstructRow[]): DriverRisk {
  const drivers = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net);
  const top = drivers.slice(0, 2);
  const avg = top.length ? round2(top.reduce((a, r) => a + r.avgEnergy, 0) / top.length) : 0;
  let label = "laag";
  if (avg < 0 && avg > -1) label = "matig";
  else if (avg <= -1) label = "hoog";
  return { avg, label, top };
}

function energyToTenScale(avg: number): number {
  return round2(((avg + 2) / 4) * 10);
}

export interface Consistency {
  score: number;
  label: string;
  driverAlignment: number;
  topDrivers: ConstructRow[];
}
function consistencyMetrics(rows: ConstructRow[], responses: Responses): Consistency {
  const answered = Object.values(responses);
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
  const energySpread = rows
    .filter((r) => r.family === "Drivers")
    .map((r) => Math.abs(r.avgEnergy))
    .reduce((a, b) => a + b, 0);
  const topDrivers = rows
    .filter((r) => r.family === "Drivers")
    .sort((a, b) => b.net - a.net)
    .slice(0, 3);
  const aligned = topDrivers.filter((r) => r.avgEnergy >= 0).length;
  const indexBase = blocks.length
    ? (choicePairs / blocks.length) * 40 + (energyPresence / blocks.length) * 30
    : 0;
  const driverPart = topDrivers.length ? (aligned / topDrivers.length) * 20 : 0;
  const spreadPart = Math.max(0, 10 - Math.min(10, energySpread));
  const score = Math.round(indexBase + driverPart + spreadPart);
  let label = "laag";
  if (score >= 80) label = "hoog";
  else if (score >= 60) label = "middelmatig";
  return {
    score: Math.max(0, Math.min(100, score)),
    label,
    driverAlignment: aligned,
    topDrivers,
  };
}

export interface MainScores {
  meta: {
    completedScreens: number;
    totalScreens: number;
    totalChoices: number;
    averageEnergy: number;
    baselineProfessionalEnergy: number;
    normalizedQuestionnaireEnergy: number;
    energyDiscrepancy: number;
    driverRisk: DriverRisk;
    consistency: Consistency;
  };
  constructRows: ConstructRow[];
  familyRows: FamilyRow[];
}

export function buildMainScores(responses: Responses, baseline: number): MainScores {
  const { rows, famRows } = aggregate(responses);
  const completed = Object.keys(responses).length;
  const risk = driverRisk(rows);
  const allEnergy = rows.map((r) => r.avgEnergy).filter((v) => typeof v === "number");
  const avgEnergy = allEnergy.length
    ? round2(allEnergy.reduce((a, b) => a + b, 0) / allEnergy.length)
    : 0;
  const consistency = consistencyMetrics(rows, responses);
  const normalized = energyToTenScale(avgEnergy);
  const discrepancy = round2(baseline - normalized);
  return {
    meta: {
      completedScreens: completed,
      totalScreens: blocks.length,
      totalChoices: completed * 3,
      averageEnergy: avgEnergy,
      baselineProfessionalEnergy: baseline,
      normalizedQuestionnaireEnergy: normalized,
      energyDiscrepancy: discrepancy,
      driverRisk: risk,
      consistency,
    },
    constructRows: rows,
    familyRows: famRows,
  };
}

// ---------------------------------------------------------------------------
// Genereert het bevroren A3 generator-contract (v1.0.0).
// ---------------------------------------------------------------------------
const CONNECTION_LABELS: Record<string, string> = {
  q1: "Psychologische verbondenheid",
  q2: "Billijkheid / verloning",
  q3: "Zelfinvestering",
  q4: "Organisatie-investering",
};

export interface ConnectionAnswers {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export function buildGeneratorContract(opts: {
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  responses: Responses;
  baseline: number;
  connection: ConnectionAnswers;
  taal?: string | null;
}) {
  const main = buildMainScores(opts.responses, opts.baseline);
  return {
    contractVersion: "1.0.0",
    instrumentId: instrument.instrumentId,
    generatedAt: new Date().toISOString(),
    // Fase E: de afname-taal reist mee met het contract, zodat de
    // rapportgenerator in de juiste taal kan renderen.
    taal: opts.taal ?? "nl",
    participant: {
      respondentCode: opts.respondentCode,
      name: opts.name,
      company: opts.company ?? null,
      role: opts.role ?? null,
    },
    consent: {
      given: true,
      scope: opts.consentScope ?? "profiel-generatie + rapport",
      timestamp: opts.consentTimestamp ?? null,
    },
    sections: {
      main,
      connection: {
        scale: "0-10",
        answers: opts.connection,
        labels: CONNECTION_LABELS,
      },
    },
  };
}
