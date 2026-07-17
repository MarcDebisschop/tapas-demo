// ---------------------------------------------------------------------------
// T4Teens — scoring-adapter (NIEUW, strikt additief).
//
// Produceert DEZELFDE contract-vorm als server/scoring.ts buildGeneratorContract
// (contractVersion 1.0.0, participant/consent/sections.main met constructRows +
// familyRows + meta), maar met instrumentId "t4teens" en aggregatie over de
// T4Teens-domeinen uit de itembank (question-manager.ts T4TEENS_ITEMS_DEF).
//
// WAAROM EEN EIGEN ADAPTER
// De gedeelde server/scoring.ts hardcodeert op de T4P-blocks; T4Teens heeft een
// eigen itembank (24 items, agreement-schaal -2..+2, domeinen Energie/Drivers/
// Talent-versnellers/Talent-foci/Interesse/Betekenis). Mirror van t4students/
// scoring.ts zodat de registry-entry "t4teens" een correct, instrument-eigen
// contract krijgt i.p.v. de generieke fallback.
//
// server/scoring.ts wordt NIET gewijzigd. ConstructRow/FamilyRow worden als type
// geïmporteerd (read-only); de aggregatie is hier lokaal geherimplementeerd.
// ---------------------------------------------------------------------------

import type { ConstructRow, FamilyRow } from "../scoring";
import { laadInstrumentItems } from "../question-manager";

const T4TEENS_INSTRUMENT = "tapas-t4teens";

export const T4TEENS_FAMILIES = {
  energie: "Energie",
  drivers: "Drivers",
  versnellers: "Talent-versnellers",
  foci: "Talent-foci",
  interesse: "Interesse",
  betekenis: "Betekenis",
} as const;

// JS toFixed(2)-equivalent (identiek aan scoring.ts round2).
function round2(x: number): number {
  return Number(x.toFixed(2));
}

function clampScore(x: number): number {
  if (x > 2) return 2;
  if (x < -2) return -2;
  return x;
}

// Normaliseert één ruwe itemrespons naar een score op -2..+2 (of null).
// Accepteert een kaal getal of een blockResponse-achtig object (blockEnergy/
// itemEnergy.most/score) zodat de bestaande afname-vorm hergebruikt kan worden.
function scoreVan(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return clampScore(raw);
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, any>;
    if (typeof o.blockEnergy === "number" && Number.isFinite(o.blockEnergy)) return clampScore(o.blockEnergy);
    const ie = o.itemEnergy;
    if (ie && typeof ie.most === "number" && Number.isFinite(ie.most)) return clampScore(ie.most);
    if (typeof o.score === "number" && Number.isFinite(o.score)) return clampScore(o.score);
  }
  return null;
}

export interface T4TeensMainMeta {
  completedItems: number;
  totalItems: number;
  averageScore: number;
  batterij: number | null;
}

export interface T4TeensContract {
  contractVersion: "1.0.0";
  instrumentId: "t4teens";
  generatedAt: string;
  taal: string;
  participant: {
    respondentCode: string;
    name: string;
    company: string | null;
    role: string | null;
  };
  consent: { given: boolean; scope: string; timestamp: string | null };
  sections: {
    main: {
      meta: T4TeensMainMeta;
      constructRows: ConstructRow[];
      familyRows: FamilyRow[];
    };
  };
}

interface ClusterAcc {
  family: string;
  shown: number;
  most: number;
  least: number;
  scores: number[];
  mostItems: string[];
}

export interface BuildT4TeensOpts {
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  // itemId -> ruwe respons (getal of blockResponse-achtig object).
  responses: Record<string, unknown>;
  taal?: string | null;
}

export function buildT4TeensContract(opts: BuildT4TeensOpts): T4TeensContract {
  const items = laadInstrumentItems(T4TEENS_INSTRUMENT);
  const responses = opts.responses ?? {};

  const clusters: Record<string, ClusterAcc> = {};
  const familyScores: Record<string, number[]> = {};

  let completedItems = 0;
  let batterij: number | null = null;
  const alleScores: number[] = [];

  for (const it of items) {
    const family = it.family;
    const cluster = it.construct;
    const tekst = it.tekst?.nl ?? "";
    const score = scoreVan(responses[it.itemId]);

    // Energie/Batterij is een aparte momentopname (geen talent-score); we tonen
    // die als eigen meta-veld en nemen hem niet mee in de gemiddelde talent-score.
    if (family === T4TEENS_FAMILIES.energie) {
      if (score !== null) batterij = score;
      continue;
    }

    if (!clusters[cluster]) {
      clusters[cluster] = { family, shown: 0, most: 0, least: 0, scores: [], mostItems: [] };
    }
    if (!familyScores[family]) familyScores[family] = [];

    const c = clusters[cluster];
    c.shown += 1;

    if (score !== null) {
      completedItems += 1;
      c.scores.push(score);
      familyScores[family].push(score);
      alleScores.push(score);
      if (score > 0) {
        c.most += 1;
        c.mostItems.push(tekst);
      } else if (score < 0) {
        c.least += 1;
      }
    }
  }

  const constructRows: ConstructRow[] = Object.entries(clusters).map(([construct, v]) => ({
    construct,
    family: v.family,
    most: v.most,
    least: v.least,
    net: v.most - v.least,
    shown: v.shown,
    avgEnergy: v.scores.length ? round2(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : 0,
    energySource: v.scores.length ? "item" : "geen",
    mostItems: v.mostItems,
    toelichtingen: [],
  }));

  const familyRows: FamilyRow[] = Object.entries(familyScores).map(([family, scores]) => ({
    family,
    avgEnergy: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  }));

  const averageScore = alleScores.length
    ? round2(alleScores.reduce((a, b) => a + b, 0) / alleScores.length)
    : 0;

  return {
    contractVersion: "1.0.0",
    instrumentId: "t4teens",
    generatedAt: new Date().toISOString(),
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
      main: {
        meta: {
          completedItems,
          totalItems: items.filter((i) => i.family !== T4TEENS_FAMILIES.energie).length,
          averageScore,
          batterij,
        },
        constructRows,
        familyRows,
      },
    },
  };
}
