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
// eigen itembank (25 items: 1 batterij-momentopname + 24 talentitems;
// agreement-schaal -2..+2, domeinen Energie/Drivers/Talent-versnellers/
// Talent-foci/Interesse/Betekenis). Mirror van t4students/
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
  // null zolang er geen enkel antwoord is: een gemiddelde over nul antwoorden
  // bestaat niet, en 0 is op deze schaal het midden en dus een echt oordeel.
  averageScore: number | null;
  batterij: number | null;
}

// Zelfde vorm als ConstructRow, met twee toevoegingen die het rapport nodig
// heeft om een niet gegeven antwoord van een gegeven antwoord te onderscheiden:
// `beantwoord` naast `shown`, en een gemiddelde dat null is als er niets is
// ingevuld. Lokaal gehouden zodat de gedeelde ConstructRow ongemoeid blijft.
export interface T4TeensConstructRow extends Omit<ConstructRow, "avgEnergy"> {
  beantwoord: number;
  avgEnergy: number | null;
}

export interface T4TeensFamilyRow extends Omit<FamilyRow, "avgEnergy"> {
  avgEnergy: number | null;
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
      constructRows: T4TeensConstructRow[];
      familyRows: T4TeensFamilyRow[];
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

  const gemiddelde = (xs: number[]): number | null =>
    xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

  const constructRows: T4TeensConstructRow[] = Object.entries(clusters).map(([construct, v]) => ({
    construct,
    family: v.family,
    most: v.most,
    least: v.least,
    net: v.most - v.least,
    shown: v.shown,
    beantwoord: v.scores.length,
    avgEnergy: gemiddelde(v.scores),
    energySource: v.scores.length ? "item" : "geen",
    mostItems: v.mostItems,
    toelichtingen: [],
  }));

  const familyRows: T4TeensFamilyRow[] = Object.entries(familyScores).map(([family, scores]) => ({
    family,
    avgEnergy: gemiddelde(scores),
  }));

  const averageScore = gemiddelde(alleScores);

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
