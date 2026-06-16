import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Session, Stakeholder, Answer, UpsertAnswer, CandidateReport, SaveCandidateReport } from "./t4r-schema";
import type { MatchUitkomst } from "../match";

/**
 * T4Recruitment — React Query hooks (ingeplugde versie).
 * ------------------------------------------------------------------
 * Eén-op-één overgenomen uit de canonieke stand-alone app
 * (t4r_src/client/src/lib/session-data.ts). De ENIGE wijzigingen:
 *   • Types komen uit ./t4r-schema en ../match (i.p.v. @shared/*).
 *   • Endpoints hangen onder /api/t4r/sessions/... (de ingeplugde namespace).
 * De hooklogica en query-keys blijven verder identiek.
 */

export function useSession(id: number) {
  return useQuery<Session>({ queryKey: ["/api/t4r/sessions", id], enabled: !!id });
}

export function useStakeholders(id: number) {
  return useQuery<Stakeholder[]>({ queryKey: ["/api/t4r/sessions", id, "stakeholders"], enabled: !!id });
}

export function useAnswers(id: number) {
  return useQuery<Answer[]>({ queryKey: ["/api/t4r/sessions", id, "answers"], enabled: !!id });
}

export function useUpsertAnswer(sessionId: number) {
  return useMutation({
    mutationFn: async (payload: Omit<UpsertAnswer, "sessionId">) => {
      const res = await apiRequest("POST", `/api/t4r/sessions/${sessionId}/answers`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", sessionId, "answers"] });
    },
  });
}

export function usePatchSession(sessionId: number) {
  return useMutation({
    mutationFn: async (patch: { status?: string; closedRing?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/t4r/sessions/${sessionId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions"] });
    },
  });
}

export function answerFor(answers: Answer[] | undefined, itemId: string): Answer | undefined {
  return answers?.find((a) => a.itemId === itemId);
}

// ---------------------------------------------------------------------------
// Vergelijkende studie (kandidaatrapport + match)
// ---------------------------------------------------------------------------

export type EnergieStatus = "geeft" | "neutraal" | "kost";

export interface ExtractedMeting {
  net: number | null;
  energie: EnergieStatus | null;
  confident: boolean;
}

export interface ExtractContext {
  energieDiscrepantie?: number | null;
  herstelTraag?: boolean | null;
  perfectionistischeBelasting?: boolean | null;
  scheveWederkerigheid?: boolean | null;
}

export interface ExtractResult {
  fileName: string | null;
  numpages: number;
  metingen: Record<string, ExtractedMeting>;
  context: ExtractContext;
}

export interface MatchResponse {
  uitkomst: MatchUitkomst;
  candidate: { label: string; decision: string | null; decisionReason: string | null };
}

export function useCandidateReport(id: number) {
  return useQuery<CandidateReport | null>({
    queryKey: ["/api/t4r/sessions", id, "candidate"],
    enabled: !!id,
  });
}

export function useExtractCandidate(sessionId: number) {
  return useMutation({
    mutationFn: async (payload: { fileName: string; pdfBase64: string }): Promise<ExtractResult> => {
      const res = await apiRequest("POST", `/api/t4r/sessions/${sessionId}/candidate/extract`, payload);
      return res.json();
    },
  });
}

export function useSaveCandidate(sessionId: number) {
  return useMutation({
    mutationFn: async (payload: Omit<SaveCandidateReport, "sessionId">) => {
      const res = await apiRequest("POST", `/api/t4r/sessions/${sessionId}/candidate`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", sessionId, "candidate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", sessionId, "match"] });
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", sessionId, "audit"] });
    },
  });
}

export function useMatch(id: number, enabled: boolean) {
  return useQuery<MatchResponse>({
    queryKey: ["/api/t4r/sessions", id, "match"],
    enabled: !!id && enabled,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Studie-assistent (chatbot) — ALLEEN recruiter/coach, NOOIT de kandidaat.
// Bevraagt het eindrapport (vergelijkende studie). Zelfde voorwaarden als de
// Kompas-chatbot + recruitment-zorgkompas (weigert selectie-/rangschikkings-/
// aanwervingsoordelen). Verkeer loopt via de Node-backend naar de sidecar.
// ---------------------------------------------------------------------------
export interface T4rChatBerichtUI {
  id: number;
  rol: "user" | "assistant";
  inhoud: string;
  veiligheid: string | null;
}
export interface T4rChatLimiet {
  gebruikt: number;
  tegoed: number;
  gratisLimiet: number;
  totaal: number;
  resterend: number;
  pakketGrootte: number;
  geblokkeerd: boolean;
}
export interface T4rChatCoach {
  naam: string;
  rol: string;
  bericht: string;
}
export interface T4rChatResponse {
  berichten: T4rChatBerichtUI[];
  limiet: T4rChatLimiet;
  suggesties: string[];
  coach: T4rChatCoach;
}
export interface T4rChatPostResponse {
  antwoord: T4rChatBerichtUI;
  limiet: T4rChatLimiet;
  coach: T4rChatCoach | null;
}

export function useChat(id: number, enabled: boolean) {
  return useQuery<T4rChatResponse>({
    queryKey: ["/api/t4r/sessions", id, "chat"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4r/sessions/${id}/chat`);
      return res.json();
    },
    enabled: !!id && enabled,
    staleTime: 0,
  });
}

export function usePostChat(id: number) {
  return useMutation({
    mutationFn: async (vraag: string): Promise<T4rChatPostResponse> => {
      const res = await apiRequest("POST", `/api/t4r/sessions/${id}/chat`, { vraag });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", id, "chat"] });
    },
  });
}

export function useKoopExtra(id: number) {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/t4r/sessions/${id}/chat/koop-extra`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", id, "chat"] });
    },
  });
}
