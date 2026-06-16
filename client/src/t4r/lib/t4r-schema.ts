/**
 * T4Recruitment — client-side types (ingeplugde versie).
 * ------------------------------------------------------------------
 * Eén-op-één de TYPES uit de canonieke stand-alone schema
 * (t4r_src/shared/schema.ts). De client heeft alleen de TypeScript-types
 * nodig (geen Drizzle-tabellen), dus we leveren ze hier puur als interfaces.
 * De vorm is identiek aan wat de stand-alone componenten verwachtten, zodat
 * de T4R-componentlogica ONGEWIJZIGD blijft.
 */

export interface Session {
  id: number;
  functionTitle: string;
  orgLabel: string;
  roleType: string;
  roleLevel: string;
  fillMode: string;
  endMoment: string;
  contextVersion: string;
  status: string;
  closedRing: boolean;
  platformSessieId?: number | null;
  createdAt: number;
}

export interface InsertSession {
  functionTitle: string;
  orgLabel: string;
  roleType: string;
  roleLevel: string;
  fillMode: string;
  endMoment: string;
}

export interface Stakeholder {
  id: number;
  sessionId: number;
  name: string;
  stakeholderRole: string;
  systemRole: string;
  voting: boolean;
}

export interface InsertStakeholder {
  sessionId: number;
  name: string;
  stakeholderRole: string;
  systemRole?: string;
  voting?: boolean;
}

export interface Answer {
  id: number;
  sessionId: number;
  itemId: string;
  classification: string | null;
  contextValue: string | null;
  critical: boolean;
  rank: number | null;
  note: string | null;
  conflict: boolean;
  finalDecision: string | null;
  finalReason: string | null;
  updatedBy: number | null;
  updatedAt: number;
}

export interface UpsertAnswer {
  sessionId: number;
  itemId: string;
  classification?: "need" | "nice" | "not-needed" | null;
  contextValue?: string | null;
  critical?: boolean;
  rank?: number | null;
  note?: string | null;
  conflict?: boolean;
  finalDecision?: "alignment" | "ondanks-restverschil" | null;
  finalReason?: string | null;
  updatedBy?: number | null;
}

export interface CandidateReport {
  id: number;
  sessionId: number;
  candidateLabel: string;
  sourceFile: string | null;
  metingen: string;
  context: string;
  rawText: string | null;
  verified: boolean;
  decision: string | null;
  decisionReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SaveCandidateReport {
  sessionId: number;
  candidateLabel: string;
  sourceFile?: string | null;
  metingen: Record<string, { net: number; energie: "geeft" | "neutraal" | "kost" }>;
  context?: {
    energieDiscrepantie?: number | null;
    herstelTraag?: boolean | null;
    perfectionistischeBelasting?: boolean | null;
    scheveWederkerigheid?: boolean | null;
  };
  rawText?: string | null;
  verified?: boolean;
  decision?: "doorgaan" | "afwijzen" | "voorbehoud" | null;
  decisionReason?: string | null;
}

export interface AuditEvent {
  id: number;
  sessionId: number;
  event: string;
  detail: string | null;
  at: number;
}
