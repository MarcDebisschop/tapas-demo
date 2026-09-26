// ---------------------------------------------------------------------------
// TOC Commitmentkompas: gedeelde hulpfuncties voor de schermen onder
// /admin/toc-kompas en de publieke invullink /toc-kompas/invullen/:token.
// De server is de enige bron van waarheid: deze module rekent niets uit, ze
// haalt op, verstuurt en vertaalt foutmeldingen naar gewone taal.
// ---------------------------------------------------------------------------
import { apiRequest, queryClient } from "@/lib/queryClient";

export const TK_API = "/api/toc-kompas";

function ontleed(e: unknown): { status: number | null; json: any; tekst: string } {
  const ruw = e instanceof Error ? e.message : String(e);
  const i = ruw.indexOf(":");
  const n = Number(ruw.slice(0, i));
  const rest = i >= 0 ? ruw.slice(i + 1).trim() : ruw;
  let json: any = null;
  try {
    json = JSON.parse(rest);
  } catch {
    // Geen JSON: toon de tekst zoals ze is.
  }
  return { status: Number.isFinite(n) ? n : null, json, tekst: rest };
}

/** De leesbare boodschap uit een fout van apiRequest ("409: {json}"). */
export function foutTekst(e: unknown): string {
  const o = ontleed(e);
  if (typeof o.json?.error === "string") return o.json.error;
  return o.tekst || "Er liep iets mis.";
}

/** De lijst met concrete fouten bij een 422 (indienen of vaststellen). */
export function foutLijst(e: unknown): string[] {
  const o = ontleed(e);
  const l = o.json?.fouten ?? o.json?.details;
  return Array.isArray(l) ? l.map(String) : [];
}

export function foutStatus(e: unknown): number | null {
  return ontleed(e).status;
}

export async function tkPost<T = any>(pad: string, body?: unknown): Promise<T> {
  const r = await apiRequest("POST", `${TK_API}${pad}`, body ?? {});
  return r.json();
}
export async function tkPut<T = any>(pad: string, body: unknown): Promise<T> {
  const r = await apiRequest("PUT", `${TK_API}${pad}`, body);
  return r.json();
}
export async function tkDelete<T = any>(pad: string): Promise<T> {
  const r = await apiRequest("DELETE", `${TK_API}${pad}`);
  return r.json();
}

export function rondeSleutel(id: number | string) {
  return [`${TK_API}/rondes/${id}`];
}
export function herlaadRonde(id: number | string) {
  return queryClient.invalidateQueries({ queryKey: rondeSleutel(id) });
}

function basis(): string {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app") ? "/port/5000" : "";
}

export function artefactUrl(rondeId: number, artefactId: number, formaat: "html" | "pdf"): string {
  return `${basis()}${TK_API}/rondes/${rondeId}/artefacten/${artefactId}?formaat=${formaat}`;
}

export function charterUrl(token: string): string {
  return `${basis()}${TK_API}/invullen/${token}/charter`;
}

/** De volledige invullink voor een Captain, zoals ze gedeeld wordt. */
export function invulLink(token: string): string {
  const pad = `/toc-kompas/invullen/${token}`;
  return typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${pad}` : pad;
}

export const STATUS_VOLGORDE = ["INTAKE", "CONSOLIDATIE", "VASTGESTELD", "AFGESLOTEN"] as const;
export function minstens(huidig: string, s: (typeof STATUS_VOLGORDE)[number]): boolean {
  return STATUS_VOLGORDE.indexOf(huidig as any) >= STATUS_VOLGORDE.indexOf(s);
}

export const CAPTAIN_STATUS_LABEL: Record<string, string> = {
  niet_gestart: "Nog niet gestart",
  concept: "Concept bewaard",
  ingediend: "Ingediend",
};
