// ---------------------------------------------------------------------------
// T4Students — scoring-adapter (NIEUW, strikt additief).
//
// Produceert DEZELFDE contract-vorm als server/scoring.ts buildGeneratorContract
// (contractVersion 1.0.0, participant/consent/sections.main met constructRows +
// familyRows + meta), maar met instrumentId "t4students" en aggregatie over de
// T4Students-families uit de itembank (question-manager.ts T4STUDENTS_ITEMS_DEF).
//
// server/scoring.ts wordt NIET gewijzigd. De ConstructRow/FamilyRow-vormen
// worden als type geïmporteerd (read-only); de aggregatielogica is hier lokaal
// geherimplementeerd omdat scoring.ts hardcodeert op de T4P-blocks.
//
// De T4Students-itembank bestaat uit agreement-statements (geen forced-choice
// most/least). Elke gesloten item krijgt een score op de energie-schaal -2..+2
// (helemaal oneens .. helemaal eens). Per cluster (construct) en per familie
// wordt de gemiddelde score berekend; net = #positief - #negatief zodat de
// clusters gerangschikt en (bij Drivers) als rem/gaspedaal geduid kunnen worden.
// ---------------------------------------------------------------------------

import type { ConstructRow, FamilyRow } from "../scoring";
import { laadInstrumentItems } from "../question-manager";

const T4STUDENTS_INSTRUMENT = "tapas-t4students";

export const T4S_FAMILIES = {
  talentfoci: "Talentfoci",
  drivers: "Drivers",
  versnellers: "Versnellers",
  motivatieIntrinsiek: "Motivatie (intrinsiek)",
  motivatieExtrinsiek: "Motivatie (extrinsiek)",
  reflectie: "Reflectie",
} as const;

// JS toFixed(2)-equivalent (identiek aan scoring.ts round2).
function round2(x: number): number {
  return Number(x.toFixed(2));
}

// Normaliseert één ruwe itemrespons naar een score op -2..+2 (of null).
// Accepteert een kaal getal of een object met blockEnergy/itemEnergy (zodat de
// bestaande blockResponseSchema-vorm uit de afname hergebruikt kan worden).
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

function clampScore(x: number): number {
  if (x > 2) return 2;
  if (x < -2) return -2;
  return x;
}

export interface T4StudentsReflectieAntwoord {
  itemId: string;
  vraag: string;
  antwoord: string;
}

export interface T4StudentsMainMeta {
  completedItems: number;
  totalItems: number;
  averageScore: number;
  motivatie: {
    intrinsiek: number;
    extrinsiek: number;
    balansLabel: "intrinsiek" | "extrinsiek" | "evenwichtig";
  };
}

export interface T4StudentsContract {
  contractVersion: "1.0.0";
  instrumentId: "t4students";
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
      meta: T4StudentsMainMeta;
      constructRows: ConstructRow[];
      familyRows: FamilyRow[];
    };
    reflectie: { antwoorden: T4StudentsReflectieAntwoord[] };
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

export interface BuildT4StudentsOpts {
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  // itemId -> ruwe respons (getal of blockResponse-achtig object).
  responses: Record<string, unknown>;
  // itemId -> open antwoord (voor de Reflectie-familie).
  reflectie?: Record<string, string> | null;
  taal?: string | null;
}

export function buildT4StudentsContract(opts: BuildT4StudentsOpts): T4StudentsContract {
  const items = laadInstrumentItems(T4STUDENTS_INSTRUMENT);
  const responses = opts.responses ?? {};
  const reflectieIn = opts.reflectie ?? {};

  const clusters: Record<string, ClusterAcc> = {};
  const familyScores: Record<string, number[]> = {};
  const reflectieAntwoorden: T4StudentsReflectieAntwoord[] = [];

  let completedItems = 0;
  const alleScores: number[] = [];

  for (const it of items) {
    const family = it.family;
    const cluster = it.construct;
    const tekst = it.tekst?.nl ?? "";

    // Reflectie-familie = open vragen: geen score, wél letterlijk meenemen.
    if (family === T4S_FAMILIES.reflectie) {
      const antwoord = reflectieIn[it.itemId];
      reflectieAntwoorden.push({
        itemId: it.itemId,
        vraag: tekst,
        antwoord: typeof antwoord === "string" ? antwoord : "",
      });
      continue;
    }

    if (!clusters[cluster]) {
      clusters[cluster] = { family, shown: 0, most: 0, least: 0, scores: [], mostItems: [] };
    }
    if (!familyScores[family]) familyScores[family] = [];

    const c = clusters[cluster];
    c.shown += 1;

    const score = scoreVan(responses[it.itemId]);
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
  }));

  const familyRows: FamilyRow[] = Object.entries(familyScores).map(([family, scores]) => ({
    family,
    avgEnergy: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  }));

  const intrinsiek =
    familyRows.find((f) => f.family === T4S_FAMILIES.motivatieIntrinsiek)?.avgEnergy ?? 0;
  const extrinsiek =
    familyRows.find((f) => f.family === T4S_FAMILIES.motivatieExtrinsiek)?.avgEnergy ?? 0;
  let balansLabel: "intrinsiek" | "extrinsiek" | "evenwichtig" = "evenwichtig";
  if (round2(intrinsiek - extrinsiek) >= 0.5) balansLabel = "intrinsiek";
  else if (round2(extrinsiek - intrinsiek) >= 0.5) balansLabel = "extrinsiek";

  const averageScore = alleScores.length
    ? round2(alleScores.reduce((a, b) => a + b, 0) / alleScores.length)
    : 0;

  return {
    contractVersion: "1.0.0",
    instrumentId: "t4students",
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
          totalItems: items.filter((i) => i.family !== T4S_FAMILIES.reflectie).length,
          averageScore,
          motivatie: { intrinsiek, extrinsiek, balansLabel },
        },
        constructRows,
        familyRows,
      },
      reflectie: { antwoorden: reflectieAntwoorden },
    },
  };
}
