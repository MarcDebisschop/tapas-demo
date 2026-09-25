// ---------------------------------------------------------------------------
// server/role-fit/reports/index.ts
//
// Eigen rapportregister van de module. Staat bewust los van
// server/rapport-registry.ts, zodat de bestaande rapporten onaangeroerd
// blijven.
// ---------------------------------------------------------------------------
import type { RapportType } from "@shared/role-fit";
import { renderFitDossier } from "./fit-dossier";
import { renderHbomGids } from "./hbom-guide";
import { renderBesluitDossier, renderKandidaatFeedback } from "./decision-dossier";

export const RENDERERS: Record<RapportType, (contract: any) => string> = {
  "fit-dossier": renderFitDossier,
  "hbom-guide": renderHbomGids,
  "decision-dossier": renderBesluitDossier,
  "kandidaat-feedback": renderKandidaatFeedback,
};
