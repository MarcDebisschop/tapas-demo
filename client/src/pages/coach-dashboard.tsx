// ---------------------------------------------------------------------------
// client/src/pages/coach-dashboard.tsx — Practitioner Dashboard
// Route: /coach/dashboard (beschermd door CoachLoginGate)
//
// Inhoud:
//   - Profielinfo + afmeld-knop
//   - Self-Training Module (STM) — volledig ingebed
//   - Navigatie terug naar platform
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { useCoachAuth } from "@/components/CoachLoginGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, CheckCircle, AlertTriangle, Trophy, ChevronRight,
  BarChart2, Clock, RefreshCw, Zap, Target, LogOut, User,
} from "lucide-react";

const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

// ---------------------------------------------------------------------------
// STM helpers (identiek aan stm.tsx)
// ---------------------------------------------------------------------------

type Fase = "menu" | "bezig" | "resultaat";

function inschalingKleur(inschaling: string) {
  const map: Record<string, string> = {
    expert: "#2E7D5A",
    meer_dan_voldoende: "#1a5fa8",
    net_voldoende: "#8B6914",
    onvoldoende: "#A13544",
  };
  return map[inschaling] || "#7a7468";
}

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = Math.round((score ?? 0) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#14213d", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#7a7468" }}>{score !== null ? `${pct}%` : "n/a"}</span>
      </div>
      <div style={{ background: "#e8e4dc", borderRadius: 4, height: 8 }}>
        <div style={{
          background: pct >= 70 ? "#2E7D5A" : pct >= 50 ? "#8B6914" : "#A13544",
          width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STM component (volledig functioneel)
// ---------------------------------------------------------------------------

function StmModule() {
  const [fase, setFase] = useState<Fase>("menu");
  const [sessieId, setSessieId] = useState<number | null>(null);
  const [vragen, setVragen] = useState<any[]>([]);
  const [huidigVraagIdx, setHuidigVraagIdx] = useState(0);
  const [antwoorden, setAntwoorden] = useState<Record<number, string>>({});
  const [gekozenAntwoord, setGekozenAntwoord] = useState<string | null>(null);
  const [startTijd, setStartTijd] = useState<number>(0);
  const [resultaat, setResultaat] = useState<any>(null);

  const historiekQuery = useQuery({
    queryKey: ["/api/stm/historiek"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/stm/historiek`).then(r => r.json()),
  });

  const laagscoresQuery = useQuery({
    queryKey: ["/api/stm/laagscores"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/stm/laagscores`).then(r => r.json()),
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${API_BASE}/api/stm/start`, { aantal: 12 }).then(r => r.json()),
    onSuccess: (data) => {
      setSessieId(data.sessie_id);
      setVragen(data.vragen);
      setHuidigVraagIdx(0);
      setAntwoorden({});
      setGekozenAntwoord(null);
      setStartTijd(Date.now());
      setFase("bezig");
    },
  });

  const afrondenMutation = useMutation({
    mutationFn: (payload: { sessie_id: number; antwoorden: Record<number, string>; duur_seconden: number }) =>
      apiRequest("POST", `${API_BASE}/api/stm/afronden`, payload).then(r => r.json()),
    onSuccess: (data) => {
      setResultaat(data);
      setFase("resultaat");
      queryClient.invalidateQueries({ queryKey: ["/api/stm/historiek"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stm/laagscores"] });
    },
  });

  function selecteerAntwoord(antwoord: string) {
    if (gekozenAntwoord !== null) return;
    const nieuweAntwoorden = { ...antwoorden, [vragen[huidigVraagIdx].id]: antwoord };
    setAntwoorden(nieuweAntwoorden);
    setGekozenAntwoord(antwoord);
  }

  function volgende() {
    setGekozenAntwoord(null);
    if (huidigVraagIdx < vragen.length - 1) {
      setHuidigVraagIdx(huidigVraagIdx + 1);
    } else {
      const duur = Math.round((Date.now() - startTijd) / 1000);
      afrondenMutation.mutate({ sessie_id: sessieId!, antwoorden, duur_seconden: duur });
    }
  }

  const laagNamen: Record<number, string> = {
    1: "Parate kennis", 2: "Begrip", 3: "Analyse", 4: "Synthese",
  };

  // ── MENU ────────────────────────────────────────────────────────────────
  if (fase === "menu") {
    const scores = laagscoresQuery.data?.scores;
    const historiek = historiekQuery.data?.sessies || [];

    return (
      <div>
        {/* Laagscores */}
        {scores && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 20 }}>
            <CardHeader style={{ borderBottom: "1px solid #e8e4dc", paddingBottom: 12 }}>
              <CardTitle style={{ color: "#14213d", fontSize: 16 }}>
                <BarChart2 className="inline w-4 h-4 mr-2" />
                Jouw kennisprofiel ({scores.sessies_totaal} sessies)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ScoreBar score={scores.laag1} label="Laag 1 — Parate kennis" />
              <ScoreBar score={scores.laag2} label="Laag 2 — Begrip" />
              <ScoreBar score={scores.laag3} label="Laag 3 — Analyse" />
              <ScoreBar score={scores.laag4} label="Laag 4 — Synthese" />
              {scores.laatste_sessie && (
                <p style={{ fontSize: 12, color: "#7a7468", marginTop: 8 }}>
                  Laatste sessie: {new Date(scores.laatste_sessie).toLocaleDateString("nl-BE")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Start knop */}
        <Card style={{ background: "#14213d", border: "none", marginBottom: 20 }}>
          <CardContent className="p-8 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: "#d8c9a3" }} />
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Start een nieuwe sessie
            </h2>
            <p style={{ color: "#d8c9a3", fontSize: 14, marginBottom: 20, opacity: 0.8 }}>
              12 adaptieve vragen · max. 15 minuten · directe feedback
            </p>
            <Button
              style={{ background: "#d8c9a3", color: "#14213d", fontWeight: 700, fontSize: 16, padding: "12px 32px" }}
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <BookOpen className="w-4 h-4 mr-2" />}
              Start sessie
            </Button>
          </CardContent>
        </Card>

        {/* Historiek */}
        {historiek.length > 0 && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
            <CardHeader style={{ borderBottom: "1px solid #e8e4dc", paddingBottom: 12 }}>
              <CardTitle style={{ color: "#14213d", fontSize: 16 }}>
                <Clock className="inline w-4 h-4 mr-2" />
                Recente sessies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historiek.slice(0, 5).map((s: any) => (
                <div key={s.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f0ede6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#14213d", fontWeight: 500 }}>
                      {new Date(s.afgerond_at).toLocaleDateString("nl-BE")}
                    </div>
                    <div style={{ fontSize: 12, color: "#7a7468" }}>
                      {s.duur_seconden ? `${Math.round(s.duur_seconden / 60)} min` : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: inschalingKleur(s.inschaling) }}>
                      {Math.round((s.score_totaal ?? 0) * 100)}%
                    </div>
                    <Badge style={{ background: inschalingKleur(s.inschaling) + "20", color: inschalingKleur(s.inschaling), fontSize: 10 }}>
                      {s.inschaling?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lege staat */}
        {!scores && historiek.length === 0 && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
            <CardContent className="p-8 text-center">
              <Target className="w-10 h-10 mx-auto mb-3" style={{ color: "#d8c9a3" }} />
              <p style={{ color: "#7a7468", fontSize: 14 }}>
                Nog geen sessies voltooid. Start je eerste sessie hierboven.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── SESSIE BEZIG ────────────────────────────────────────────────────────
  if (fase === "bezig") {
    const vraag = vragen[huidigVraagIdx];
    const opties: string[] = vraag?.opties || [];
    const progress = Math.round(((huidigVraagIdx) / vragen.length) * 100);
    const isLaatste = huidigVraagIdx === vragen.length - 1;

    return (
      <div>
        {/* Progress */}
        <div style={{ background: "#14213d", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#d8c9a3", fontSize: 13 }}>Vraag {huidigVraagIdx + 1} / {vragen.length}</span>
            <span style={{ color: "#d8c9a3", fontSize: 12 }}>Laag {vraag?.laag} — {laagNamen[vraag?.laag]}</span>
          </div>
          <div style={{ background: "#060a16", borderRadius: 20, height: 6, overflow: "hidden" }}>
            <div style={{ background: "#d8c9a3", width: `${progress}%`, height: "100%", transition: "width 0.3s" }} />
          </div>
        </div>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
          <CardContent className="p-6">
            <Badge style={{ background: "#f4f1ec", color: "#14213d", marginBottom: 16, fontSize: 11 }}>
              {vraag?.thema}
            </Badge>
            <h2 style={{ color: "#14213d", fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
              {vraag?.vraag_tekst}
            </h2>
            <div className="flex flex-col gap-3">
              {opties.map((optie: string, i: number) => {
                const isGekozen = gekozenAntwoord === optie;
                return (
                  <button key={i} onClick={() => selecteerAntwoord(optie)}
                    disabled={gekozenAntwoord !== null}
                    style={{
                      textAlign: "left", padding: "12px 16px", borderRadius: 8,
                      border: isGekozen ? "2px solid #14213d" : "2px solid #e8e4dc",
                      background: isGekozen ? "#f4f1ec" : "#fff",
                      color: "#14213d", fontSize: 14,
                      cursor: gekozenAntwoord !== null ? "default" : "pointer",
                      transition: "all 0.15s",
                      fontWeight: isGekozen ? 600 : 400,
                    }}>
                    {optie}
                  </button>
                );
              })}
            </div>
            {gekozenAntwoord !== null && (
              <div style={{ marginTop: 16 }}>
                <Button
                  style={{ background: "#14213d", color: "#d8c9a3", width: "100%" }}
                  onClick={volgende}
                  disabled={afrondenMutation.isPending}>
                  {afrondenMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isLaatste ? "Afronden & resultaat bekijken" : "Volgende vraag"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── RESULTAAT ─────────────────────────────────────────────────────────
  if (fase === "resultaat" && resultaat) {
    const kleur = inschalingKleur(resultaat.inschaling);
    const totalePct = Math.round((resultaat.scores?.totaal ?? 0) * 100);

    return (
      <div>
        <Card style={{ background: "#fff", border: `2px solid ${kleur}`, marginBottom: 16 }}>
          <CardContent className="p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: kleur }} />
            <div style={{ fontSize: 48, fontWeight: 800, color: kleur, lineHeight: 1 }}>{totalePct}%</div>
            <div style={{ fontSize: 18, color: kleur, fontWeight: 600, marginTop: 8 }}>
              {resultaat.inschaling_label}
            </div>
            {resultaat.reminder_over_dagen && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#7a7468" }}>
                Volgende aanbevolen sessie over {resultaat.reminder_over_dagen} dagen
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 16 }}>
          <CardHeader><CardTitle style={{ color: "#14213d", fontSize: 15 }}>Score per laag</CardTitle></CardHeader>
          <CardContent>
            <ScoreBar score={resultaat.scores?.laag1} label="Laag 1 — Parate kennis" />
            <ScoreBar score={resultaat.scores?.laag2} label="Laag 2 — Begrip" />
            <ScoreBar score={resultaat.scores?.laag3} label="Laag 3 — Analyse" />
            <ScoreBar score={resultaat.scores?.laag4} label="Laag 4 — Synthese" />
          </CardContent>
        </Card>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 16 }}>
          <CardHeader><CardTitle style={{ color: "#14213d", fontSize: 15 }}>Feedback per vraag</CardTitle></CardHeader>
          <CardContent className="p-0">
            {(resultaat.feedback || []).map((f: any, i: number) => (
              <div key={f.vraag_id} style={{ padding: "10px 14px", borderBottom: "1px solid #f0ede6", display: "flex", gap: 10 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {f.correct
                    ? <CheckCircle className="w-5 h-5" style={{ color: "#2E7D5A" }} />
                    : <AlertTriangle className="w-5 h-5" style={{ color: "#A13544" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#7a7468", marginBottom: 2 }}>Vraag {i + 1}</div>
                  <div style={{ fontSize: 13, color: "#14213d" }}>{f.feedback}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            style={{ background: "#14213d", color: "#d8c9a3", flex: 1 }}
            onClick={() => { setFase("menu"); setResultaat(null); }}>
            Terug naar menu
          </Button>
          <Button variant="outline" style={{ flex: 1 }}
            onClick={() => { setResultaat(null); startMutation.mutate(); }}>
            Nieuwe sessie
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Coach Dashboard — hoofd-component
// ---------------------------------------------------------------------------

export default function CoachDashboard() {
  const { coach, afmelden } = useCoachAuth();

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button size="sm" variant="outline" data-testid="link-home">
                ← Platform
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={afmelden} data-testid="button-afmelden">
              <LogOut className="w-4 h-4 mr-1" />
              Afmelden
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Profielheader */}
        <div style={{ background: "#14213d", borderRadius: 12, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "#d8c9a3", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User style={{ color: "#14213d", width: 22, height: 22 }} />
          </div>
          <div>
            <p style={{ color: "#d8c9a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
              Practitioner-dashboard
            </p>
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
              {coach.naam}
            </h1>
            <p style={{ color: "#d8c9a3", fontSize: 13, opacity: 0.8, margin: 0 }}>
              {coach.email}
              {coach.isPrior && (
                <span style={{ marginLeft: 8, background: "#d8c9a3", color: "#14213d", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                  Prior
                </span>
              )}
            </p>
          </div>
        </div>

        {/* STM sectie */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BookOpen style={{ color: "#14213d", width: 20, height: 20 }} />
            <h2 style={{ color: "#14213d", fontSize: 18, fontWeight: 700, margin: 0 }}>
              Self-Training Module
            </h2>
          </div>
          <StmModule />
        </div>
      </main>
    </div>
  );
}
