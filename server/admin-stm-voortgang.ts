// =============================================================================
// server/admin-stm-voortgang.ts — NIEUW BESTAND (Werkprotocol Regel 2)
//
// Aangemaakt: 2026-07-08
//
// Doel: de admin-kwaliteitsmonitor (/admin/kwaliteit) een EXPLICIETE, per-
// practitioner STM-modulevoortgang tonen. Volledig additief en read-only:
// dit endpoint leest uitsluitend uit de bestaande stm_sessies-tabel (via
// stmSessieOpslagen — dezelfde bron die berekenKwaliteitsStatus gebruikt voor
// afnames_count). Er wordt GEEN scoringlogica gedupliceerd en geen beschermd
// bestand aangeraakt.
//
// Waarom een apart admin-endpoint?
//   /api/stm/laagscores en /api/stm/historiek zijn coach-scoped: ze werken enkel
//   op de ingelogde practitioner (coachId/adminId). De admin wil de voortgang
//   van een WILLEKEURIGE practitioner zien, gekeyd op dezelfde beheerder_id die
//   het kwaliteitsdashboard al gebruikt. Daarom één minimale admin-guard-route.
//
// Datawaarheid (uit stm-storage.ts + kwaliteit-storage.ts gelezen):
//   - stm_sessies is gekeyd per practitioner (beheerder_id). ✔ per-practitioner.
//   - scores_per_laag bevat een score per LAAG (1..4). Twee sleutel-/schaal-
//     formaten in omloop:
//       * echte STM-flow (routes-stm.ts):  { laag1..laag4 } als fractie 0..1
//       * demo-seed (kwaliteit-storage.ts): { "1".."4" }    als percentage 0..100
//     Deze helper normaliseert beide naar een fractie 0..1.
//   - Per-THEMA (5 thema's) wordt NIET per sessie opgeslagen. De enige bron
//     daarvoor zou het feedback-veld zijn (vraag_id → thema), maar de demo-seed
//     schrijft een leeg feedback-array ("[]"). Daarom is per-thema-voltooiing
//     niet betrouwbaar herleidbaar en tonen we die NIET als voltooiingsmatrix
//     (Werkprotocol Regel 4: nooit data verzinnen). De 4 lagen zijn de fijnste
//     waarheidsgetrouwe granulariteit; de 5 thema's tonen we louter als
//     curriculumcontext.
// =============================================================================

import type { Express, Request, Response } from "express";
import { stmSessieOpslagen } from "./stm-storage";

// STM-lagen (identiek aan coach-dashboard.tsx laagNamen en de VRAAGBANK-lagen).
const LAAG_LABELS: Record<number, string> = {
  1: "Parate kennis",
  2: "Begrip",
  3: "Analyse",
  4: "Synthese",
};

// Curriculum-thema's van de STM-vraagbank (routes-stm.ts). Louter context —
// per-thema-voltooiing wordt niet per sessie opgeslagen (zie kopcommentaar).
const THEMA_LABELS = [
  "TaPas-methodiek",
  "Drivers",
  "Energiemanagement",
  "Instrumenten",
  "TaPas Jester",
];

// Drempel "net voldoende" — identiek aan bepaalInschaling() in routes-stm.ts.
const DREMPEL_GEHAALD = 0.55;

// Normaliseer één laag-score naar een fractie 0..1, ongeacht sleutel/schaal.
function laagScoreUit(scoresPerLaag: Record<string, number>, laag: number): number | null {
  const ruw = scoresPerLaag?.[`laag${laag}`] ?? scoresPerLaag?.[String(laag)];
  if (ruw === undefined || ruw === null || isNaN(Number(ruw))) return null;
  const v = Number(ruw);
  // > 1 ⇒ percentage (demo-seed 0..100); anders al een fractie (echte flow).
  return v > 1 ? v / 100 : v;
}

export interface StmLaagVoortgang {
  laag: number;
  label: string;
  gem_score: number | null;      // gemiddelde fractie 0..1 over sessies met een score
  gehaald: boolean;              // gem_score >= DREMPEL_GEHAALD
  sessies_met_score: number;
}

export interface StmVoortgang {
  sessies_afgerond: number;
  drempel: number;
  lagen: StmLaagVoortgang[];
  lagen_op_niveau: number;       // aantal lagen met gehaald === true
  lagen_totaal: number;          // altijd 4
  themas: string[];              // curriculumcontext (niet per sessie gemeten)
  per_thema_gemeten: boolean;    // waarheidsvlag: false in de demo
  laatste_sessie: string | null;
}

// Bereken de STM-voortgang van één practitioner uit zijn afgeronde sessies.
export function berekenStmVoortgang(beheerderId: number): StmVoortgang {
  const afgerond = stmSessieOpslagen.historiek(beheerderId); // enkel afgerond
  const perLaagWaarden: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
  let laatste: string | null = null;

  for (const s of afgerond) {
    for (let l = 1; l <= 4; l++) {
      const v = laagScoreUit(s.scores_per_laag, l);
      if (v !== null) perLaagWaarden[l].push(v);
    }
    if (s.afgerond_at && (!laatste || s.afgerond_at > laatste)) laatste = s.afgerond_at;
  }

  const lagen: StmLaagVoortgang[] = [1, 2, 3, 4].map((l) => {
    const arr = perLaagWaarden[l];
    const gem = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return {
      laag: l,
      label: LAAG_LABELS[l],
      gem_score: gem,
      gehaald: gem !== null && gem >= DREMPEL_GEHAALD,
      sessies_met_score: arr.length,
    };
  });

  return {
    sessies_afgerond: afgerond.length,
    drempel: DREMPEL_GEHAALD,
    lagen,
    lagen_op_niveau: lagen.filter((x) => x.gehaald).length,
    lagen_totaal: 4,
    themas: THEMA_LABELS,
    per_thema_gemeten: false,
    laatste_sessie: laatste,
  };
}

// Route-registratie — één read-only admin-endpoint.
export function registerAdminStmVoortgangRoutes(app: Express): void {
  // GET /api/admin/stm-voortgang/:id — STM-voortgang van één practitioner.
  // Gekeyd op beheerder_id (dezelfde identifier als het kwaliteitsdashboard).
  app.get("/api/admin/stm-voortgang/:id", (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s?.adminId) return res.status(401).json({ error: "Enkel toegankelijk voor admins." });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ongeldig practitioner-id." });
    try {
      res.json({ voortgang: berekenStmVoortgang(id) });
    } catch (e) {
      res.status(500).json({ error: "STM-voortgang kon niet berekend worden." });
    }
  });
}
