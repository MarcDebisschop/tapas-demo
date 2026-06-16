import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowRight, Users, Languages } from "lucide-react";
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
 * TaPas Teamscan — facilitatorscherm.
 * ------------------------------------------------------------------
 * Een teamleider of coach maakt een team-afname, beheert de afnames en
 * opent de geaggregeerde teamanalyse. Reflectie- en ontwikkelinstrument.
 */

type Sessie = { id: number; teamNaam: string; orgLabel: string; status: string; createdAt: number };

export default function TeamscanHome() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const { data: sessies } = useQuery<Sessie[]>({ queryKey: ["/api/teamscan/sessies"] });
  const [teamNaam, setTeamNaam] = useState("");
  const [orgLabel, setOrgLabel] = useState("");

  const maak = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/teamscan/sessies", { teamNaam, orgLabel });
      return res.json();
    },
    onSuccess: () => {
      setTeamNaam("");
      setOrgLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/teamscan/sessies"] });
    },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader
        right={
          <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
            <SelectTrigger className="h-9 w-auto gap-1.5 px-2.5" data-testid="select-ui-taal" aria-label={t("taal_kiezer_label")}>
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
        }
      />
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ color: "#5b6b73", fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 8 }}>
          {t("home_eyebrow")}
        </div>
        <h1 style={{ color: "#16384a", fontSize: 30, margin: "0 0 6px" }}>{t("ts_home_titel")}</h1>
        <p style={{ color: "#5b6b73", fontSize: 16, maxWidth: 640 }}>
          {t("ts_home_intro")}
        </p>

        {/* Nieuwe afname */}
        <div style={{ background: "#fff", border: "1px solid #eef1f2", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0 }}>{t("ts_home_nieuwe")}</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 240px" }}>
              <Label>{t("ts_home_teamnaam")}</Label>
              <Input value={teamNaam} onChange={(e) => setTeamNaam(e.target.value)} placeholder={t("ts_home_teamnaam_ph")} />
            </div>
            <div style={{ flex: "1 1 240px" }}>
              <Label>{t("ts_home_org")}</Label>
              <Input value={orgLabel} onChange={(e) => setOrgLabel(e.target.value)} placeholder={t("ts_home_org_ph")} />
            </div>
            <Button onClick={() => maak.mutate()} disabled={!teamNaam || maak.isPending}>
              <Plus size={16} style={{ marginRight: 6 }} /> {t("ts_home_aanmaken")}
            </Button>
          </div>
        </div>

        {/* Bestaande afnames */}
        <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 36 }}>{t("ts_home_lijst_titel")}</h2>
        {(!sessies || sessies.length === 0) && (
          <p style={{ color: "#5b6b73" }}>{t("ts_home_leeg")}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessies?.map((s) => (
            <Link key={s.id} href={`/teamscan/sessie/${s.id}`}>
              <a style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: "14px 18px", cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16384a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Users size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#16384a" }}>{s.teamNaam}</div>
                    <div style={{ fontSize: 13, color: "#5b6b73" }}>{s.orgLabel || "—"} · {s.status}</div>
                  </div>
                  <ArrowRight size={18} color="#5b6b73" />
                </div>
              </a>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <Link href="/"><a style={{ color: "#16384a", fontSize: 14 }}>{t("algemeen_terug_platform")}</a></Link>
        </div>
      </div>
    </div>
  );
}
