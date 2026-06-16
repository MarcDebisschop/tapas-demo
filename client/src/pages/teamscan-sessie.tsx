import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, CheckCircle2, Clock, FileText, ExternalLink, Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

/**
 * TaPas Teamscan — sessiedetail (facilitator).
 * ------------------------------------------------------------------
 * Voeg (anonieme) deelnemers toe en deel hun persoonlijke link. Volg de
 * voortgang en open het teamrapport zodra het minimum aantal invullingen
 * is bereikt.
 */

type Deelnemer = { id: number; token: string; label: string; afgerond: boolean };
type SessieDetail = {
  id: number;
  teamNaam: string;
  orgLabel: string;
  status: string;
  deelnemers: Deelnemer[];
  aantalAfgerond: number;
  minVoorTeamrapport: number;
};

function deelnemerLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/teamscan/r/${token}`;
}

function TaalKiezer({ uiTaal, setUiTaal, label }: { uiTaal: Taal; setUiTaal: (t: Taal) => void; label: string }) {
  return (
    <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
      <SelectTrigger className="h-9 w-auto gap-1.5 px-2.5" data-testid="select-ui-taal" aria-label={label}>
        <Languages className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TALEN.map((taal) => (
          <SelectItem key={taal} value={taal} data-testid={`option-taal-${taal}`}>
            {TAAL_CODES[taal]} · {TAAL_NAMEN[taal]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function TeamscanSessie() {
  const { id } = useParams<{ id: string }>();
  const key = [`/api/teamscan/sessies/${id}`];
  const { data: sessie } = useQuery<SessieDetail>({ queryKey: key });
  const [aantal, setAantal] = useState(1);
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const voegToe = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/teamscan/sessies/${id}/deelnemers`, { aantal });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  function kopieer(token: string) {
    navigator.clipboard.writeText(deelnemerLink(token));
    setGekopieerd(token);
    setTimeout(() => setGekopieerd(null), 1500);
  }

  if (!sessie) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 64, color: "#5b6b73" }}>{t("algemeen_laden")}</div>
      </div>
    );
  }

  const kanTeamrapport = sessie.aantalAfgerond >= sessie.minVoorTeamrapport;
  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
  const teamrapportUrl = `${API_BASE}/api/teamscan/sessies/${sessie.id}/teamrapport?formaat=html`;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header-rij met teruglink en taalkiezer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <a href="#/teamscan" style={{ color: "#16384a", fontSize: 14 }}>{t("ts_sessie_terug")}</a>
          <TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_ui_label")} />
        </div>
        <h1 style={{ color: "#16384a", fontSize: 28, margin: "10px 0 2px" }}>{sessie.teamNaam}</h1>
        <p style={{ color: "#5b6b73" }}>{sessie.orgLabel || "—"}</p>

        {/* Voortgang */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "20px 0" }}>
          <div style={{ flex: "1 1 200px", background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, color: "#5b6b73" }}>{t("ts_sessie_deelnemers_label")}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#16384a" }}>{sessie.deelnemers.length}</div>
          </div>
          <div style={{ flex: "1 1 200px", background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, color: "#5b6b73" }}>{t("ts_sessie_afgerond_label")}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#3f8f5b" }}>{sessie.aantalAfgerond}</div>
          </div>
        </div>

        {/* Teamrapport */}
        <div style={{ background: kanTeamrapport ? "#eef7f1" : "#f1f5f7", border: `1px solid ${kanTeamrapport ? "#bfe0cd" : "#dde5e8"}`, borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={18} /> {t("ts_sessie_teamanalyse")}
          </h2>
          {kanTeamrapport ? (
            <>
              <p style={{ color: "#5b6b73", margin: "0 0 12px" }}>
                {t("ts_sessie_rapport_beschikbaar").replace("{n}", String(sessie.aantalAfgerond))}
              </p>
              <a href={teamrapportUrl} target="_blank" rel="noreferrer">
                <Button>{t("ts_sessie_open_teamrapport")} <ExternalLink size={15} style={{ marginLeft: 6 }} /></Button>
              </a>
            </>
          ) : (
            <p style={{ color: "#5b6b73", margin: 0 }}>
              {t("ts_sessie_rapport_wacht")
                .replace("{min}", String(sessie.minVoorTeamrapport))
                .replace("{n}", String(sessie.aantalAfgerond))}
            </p>
          )}
        </div>

        {/* Deelnemers toevoegen */}
        <div style={{ background: "#fff", border: "1px solid #eef1f2", borderRadius: 12, padding: 20 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0 }}>{t("ts_sessie_deelnemers_toevoegen")}</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 13, color: "#5b6b73" }}>{t("ts_sessie_aantal_label")}</label>
              <Input type="number" min={1} max={50} value={aantal} onChange={(e) => setAantal(Math.max(1, Number(e.target.value)))} />
            </div>
            <Button onClick={() => voegToe.mutate()} disabled={voegToe.isPending}>
              <Plus size={16} style={{ marginRight: 6 }} /> {t("ts_sessie_genereer_links")}
            </Button>
          </div>
        </div>

        {/* Lijst deelnemers met links */}
        <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 32 }}>{t("ts_sessie_persoonlijke_links")}</h2>
        {sessie.deelnemers.length === 0 && <p style={{ color: "#5b6b73" }}>{t("ts_sessie_geen_deelnemers")}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessie.deelnemers.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: "12px 14px" }}>
              {d.afgerond ? <CheckCircle2 size={20} color="#3f8f5b" /> : <Clock size={20} color="#e0922f" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#16384a" }}>{t("ts_sessie_deelnemer_nr").replace("{n}", String(i + 1))}</div>
                <div style={{ fontSize: 12, color: "#5b6b73", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deelnemerLink(d.token)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => kopieer(d.token)}>
                {gekopieerd === d.token ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                <span style={{ marginLeft: 6 }}>{gekopieerd === d.token ? t("ts_sessie_gekopieerd") : t("ts_sessie_kopieer")}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
