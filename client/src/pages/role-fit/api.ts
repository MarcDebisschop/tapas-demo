// ---------------------------------------------------------------------------
// Recruitment & Role Fit: gedeelde hulpfuncties voor de schermen onder
// /admin/role-fit en de publieke observatorlink /role-fit/observatie/:token.
// De server is de enige bron van waarheid: deze module rekent niets uit, ze
// haalt op, verstuurt en vertaalt foutmeldingen naar gewone taal.
// ---------------------------------------------------------------------------
import { apiRequest, queryClient } from "@/lib/queryClient";

export const RF_API = "/api/role-fit";

/** Haalt de leesbare boodschap uit een fout van apiRequest ("409: {json}"). */
export function foutTekst(e: unknown): string {
  const ruw = e instanceof Error ? e.message : String(e);
  const i = ruw.indexOf(":");
  const rest = i >= 0 ? ruw.slice(i + 1).trim() : ruw;
  try {
    const j = JSON.parse(rest);
    if (typeof j?.error === "string") return j.error;
  } catch {
    // Geen JSON: toon de tekst zoals ze is.
  }
  return rest || "Er liep iets mis.";
}

/** Details van een fout (bijvoorbeeld de taalsignalen bij een 422). */
export function foutDetails(e: unknown): any {
  const ruw = e instanceof Error ? e.message : String(e);
  const i = ruw.indexOf(":");
  try {
    return JSON.parse(ruw.slice(i + 1).trim())?.details ?? null;
  } catch {
    return null;
  }
}

export function foutStatus(e: unknown): number | null {
  const ruw = e instanceof Error ? e.message : String(e);
  const n = Number(ruw.split(":")[0]);
  return Number.isFinite(n) ? n : null;
}

export async function rfPost<T = any>(pad: string, body?: unknown): Promise<T> {
  const r = await apiRequest("POST", `${RF_API}${pad}`, body ?? {});
  return r.json();
}
export async function rfPut<T = any>(pad: string, body: unknown): Promise<T> {
  const r = await apiRequest("PUT", `${RF_API}${pad}`, body);
  return r.json();
}
export async function rfPatch<T = any>(pad: string, body: unknown): Promise<T> {
  const r = await apiRequest("PATCH", `${RF_API}${pad}`, body);
  return r.json();
}
export async function rfDelete<T = any>(pad: string): Promise<T> {
  const r = await apiRequest("DELETE", `${RF_API}${pad}`);
  return r.json();
}

export function caseSleutel(id: number | string) {
  return [`${RF_API}/cases/${id}`];
}

export function herlaadCase(id: number | string) {
  return queryClient.invalidateQueries({ queryKey: caseSleutel(id) });
}

/** Volgorde van de statussen, om te weten of een stap al bereikt is. */
export const STATUS_VOLGORDE = [
  "DRAFT",
  "CONTEXT_REVIEW",
  "CONTEXT_FROZEN",
  "HBOM_READY",
  "OBSERVING",
  "OBSERVATIONS_LOCKED",
  "INTEGRATION_REVIEW",
  "DECISION_READY",
  "SIGNED",
  "ARCHIVED",
] as const;

export function bereikt(status: string, doel: (typeof STATUS_VOLGORDE)[number]): boolean {
  return STATUS_VOLGORDE.indexOf(status as any) >= STATUS_VOLGORDE.indexOf(doel);
}

/** Het datamodel dat GET /cases/:id teruggeeft (bewust ruim getypeerd). */
export interface CaseWeergave {
  moduleVersie: string;
  zaak: any;
  rollen: string[];
  semiBlind: boolean;
  convergentieEmbargo: boolean;
  waarschuwingen: string[];
  wizard: any;
  bronnen: any[];
  claims: any[];
  vereisten: any[];
  profielClaims: any[];
  fitItems: any[];
  hypothesen: any[];
  oefeningen: any[];
  opdrachten: any[];
  observaties: any[];
  integraties: any[];
  gates: Array<{ vereisteId: number; vereiste: string; status: string }>;
  besluit: any | null;
  artefacten: any[];
  aiRuns: any[];
}

/** Opent een rapport in een nieuw tabblad (html) of downloadt het (pdf). */
export function artefactUrl(caseId: number, artefactId: number, formaat: "html" | "pdf"): string {
  const basis =
    typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app") ? "/port/5000" : "";
  return `${basis}${RF_API}/cases/${caseId}/artefacten/${artefactId}?formaat=${formaat}`;
}
