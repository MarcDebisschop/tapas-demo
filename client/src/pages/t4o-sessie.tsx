import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, CheckCircle2, Clock, FileText, ExternalLink } from "lucide-react";

/**
 * TaPas 4 Organizations — sessiedetail (route #/t4o/sessie/:id).
 * ------------------------------------------------------------------
 * Voeg respondenten toe per ring (leiding/medewerker/stakeholder) en deel
 * hun persoonlijke link. Volg de voortgang en open het organisatierapport
 * zodra het minimum aantal invullingen is bereikt. UI-strings hardcoded NL.
 */

type Groep = "leiding" | "medewerker" | "stakeholder";
const GROEPEN: Groep[] = ["leiding", "medewerker", "stakeholder"];
const GROEP_LABEL: Record<Groep, string> = {
  leiding: "Leiding / kernteam",
  medewerker: "Medewerkers",
  stakeholder: "Externe stakeholders",
};

type Respondent = { id: number; token: string; groep: Groep; rank: number; afgerond: boolean };
type SessieDetail = {
  id: number;
  orgNaam: string;
  orgLabel: string;
  status: string;
  respondenten: Respondent[];
  aantalAfgerond: number;
  minVoorRapport: number;
};

function respondentLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/t4o/r/${token}`;
}

export default function T4OSessie() {
  const { id } = useParams<{ id: string }>();
  const key = [`/api/t4o/sessies/${id}`];
  const { data: sessie } = useQuery<SessieDetail>({ queryKey: key });
  const [aantal, setAantal] = useState<Record<Groep, number>>({ leiding: 1, medewerker: 1, stakeholder: 1 });
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);

  const voegToe = useMutation({
    mutationFn: async (groep: Groep) => {
      await apiRequest("POST", `/api/t4o/sessies/${id}/respondenten`, { groep, aantal: aantal[groep] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  function kopieer(token: string) {
    navigator.clipboard.writeText(respondentLink(token));
    setGekopieerd(token);
    setTimeout(() => setGekopieerd(null), 1500);
  }

  if (!sessie) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 64, color: "#5b6b73" }}>Laden…</div>
      </div>
    );
  }

  const kanRapport = sessie.aantalAfgerond >= sessie.minVoorRapport;
  const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();
  const rapportUrl = `${API_BASE}/api/t4o/sessies/${sessie.id}/rapport?formaat=html`;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        <a href="#/t4o" style={{ color: "#16384a", fontSize: 14 }}>Terug naar overzicht</a>
        <h1 style={{ color: "#16384a", fontSize: 28, margin: "10px 0 2px" }}>{sessie.orgNaam}</h1>
        <p style={{ color: "#5b6b73" }}>{sessie.orgLabel || "—"}</p>

        {/* Voortgang */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "20px 0" }}>
          <div style={{ flex: "1 1 200px", background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, color: "#5b6b73" }}>Respondenten</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#16384a" }}>{sessie.respondenten.length}</div>
          </div>
          <div style={{ flex: "1 1 200px", background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, color: "#5b6b73" }}>Afgerond</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#3f8f5b" }}>{sessie.aantalAfgerond}</div>
          </div>
        </div>

        {/* Organisatierapport */}
        <div style={{ background: kanRapport ? "#eef7f1" : "#f1f5f7", border: `1px solid ${kanRapport ? "#bfe0cd" : "#dde5e8"}`, borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={18} /> Organisatieprofiel
          </h2>
          {kanRapport ? (
            <>
              <p style={{ color: "#5b6b73", margin: "0 0 12px" }}>
                {`Het organisatierapport is beschikbaar op basis van ${sessie.aantalAfgerond} afgeronde invullingen.`}
              </p>
              <a href={rapportUrl} target="_blank" rel="noreferrer">
                <Button>Open organisatierapport <ExternalLink size={15} style={{ marginLeft: 6 }} /></Button>
              </a>
            </>
          ) : (
            <p style={{ color: "#5b6b73", margin: 0 }}>
              {`Het organisatierapport verschijnt zodra minstens ${sessie.minVoorRapport} respondenten hebben afgerond. Nu afgerond: ${sessie.aantalAfgerond}.`}
            </p>
          )}
        </div>

        {/* Respondenten toevoegen per groep */}
        <div style={{ background: "#fff", border: "1px solid #eef1f2", borderRadius: 12, padding: 20 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0 }}>Respondenten toevoegen</h2>
          {GROEPEN.map((g) => (
            <div key={g} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 13, color: "#5b6b73" }}>Groep</label>
                <div style={{ fontWeight: 700, color: "#16384a", padding: "8px 0" }}>{GROEP_LABEL[g]}</div>
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 13, color: "#5b6b73" }}>Aantal</label>
                <Input type="number" min={1} max={100} value={aantal[g]} onChange={(e) => setAantal((p) => ({ ...p, [g]: Math.max(1, Number(e.target.value)) }))} />
              </div>
              <Button variant="outline" onClick={() => voegToe.mutate(g)} disabled={voegToe.isPending}>
                <Plus size={16} style={{ marginRight: 6 }} /> Genereer links
              </Button>
            </div>
          ))}
        </div>

        {/* Persoonlijke links per groep */}
        <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 32 }}>Persoonlijke links</h2>
        {sessie.respondenten.length === 0 && <p style={{ color: "#5b6b73" }}>Nog geen respondenten toegevoegd.</p>}
        {GROEPEN.map((g) => {
          const rs = sessie.respondenten.filter((r) => r.groep === g).sort((a, b) => a.rank - b.rank);
          if (rs.length === 0) return null;
          return (
            <div key={g} style={{ marginBottom: 20 }}>
              <h3 style={{ color: "#16384a", fontSize: 15, margin: "12px 0 8px" }}>{GROEP_LABEL[g]}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rs.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: "12px 14px" }}>
                    {r.afgerond ? <CheckCircle2 size={20} color="#3f8f5b" /> : <Clock size={20} color="#e0922f" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#16384a" }}>{`Respondent ${r.rank}`}</div>
                      <div style={{ fontSize: 12, color: "#5b6b73", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{respondentLink(r.token)}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => kopieer(r.token)}>
                      {gekopieerd === r.token ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                      <span style={{ marginLeft: 6 }}>{gekopieerd === r.token ? "Gekopieerd" : "Kopieer"}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
