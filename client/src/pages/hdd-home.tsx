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
import { ArrowRight, Compass, Layers, GitBranch } from "lucide-react";

/**
 * Human Due Diligence — facilitatorscherm (vlaggenschip-traject).
 * ------------------------------------------------------------------
 * Een consultant maakt een board-traject aan, ziet de twee fasen en het
 * Go/No-Go-scharnier, en beheert lopende trajecten. Dit is de eerste
 * prototype-aanzet (stap A uit het bouwplan): traject-CRUD + visueel
 * fasen-dashboard. De live link-generatie/uitsturing en de geaggregeerde
 * rapportage worden in een volgende stap aangesloten.
 */

type Traject = {
  id: number;
  boardNaam: string;
  orgLabel: string;
  context: string;
  status: string;
  createdAt: number;
};

const INK = "#16384a";
const SUB = "#5b6b73";
const ACCENT = "#1f6f8b";

function FaseKaart(props: {
  nr: string;
  titel: string;
  instrumenten: string;
  uitleg: string;
  icoon: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: "1 1 240px",
        background: "#fff",
        border: "1px solid #eef1f2",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "#eef5f7",
            color: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {props.icoon}
        </div>
        <div style={{ color: SUB, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase" }}>
          {props.nr}
        </div>
      </div>
      <h3 style={{ color: INK, fontSize: 17, margin: "0 0 4px" }}>{props.titel}</h3>
      <div style={{ color: ACCENT, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {props.instrumenten}
      </div>
      <p style={{ color: SUB, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{props.uitleg}</p>
    </div>
  );
}

export default function HddHome() {
  const { data: trajecten } = useQuery<Traject[]>({ queryKey: ["/api/hdd/trajecten"] });
  const [boardNaam, setBoardNaam] = useState("");
  const [orgLabel, setOrgLabel] = useState("");
  const [context, setContext] = useState("self-screening");

  const maak = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hdd/trajecten", {
        boardNaam,
        orgLabel,
        context,
      });
      return res.json();
    },
    onSuccess: () => {
      setBoardNaam("");
      setOrgLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/hdd/trajecten"] });
    },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div
          style={{
            color: SUB,
            fontSize: 13,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Vlaggenschip-instrument
        </div>
        <h1 style={{ color: INK, fontSize: 30, margin: "0 0 6px" }}>Human Due Diligence</h1>
        <p style={{ color: SUB, fontSize: 16, maxWidth: 680, lineHeight: 1.55 }}>
          Een gefaseerde, wetenschappelijk onderbouwde diagnose van het menselijk kapitaal van
          een board. Eén team, dezelfde mensen, door twee fasen heen — met een Go/No-Go-scharnier
          dat bepaalt of er onder de motorkap gekeken moet worden.
        </p>

        {/* Fasen-overzicht */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch", marginTop: 24 }}>
          <FaseKaart
            nr="Fase 1 · Verkenning"
            titel="Teamfoto + energiebalans"
            instrumenten="TaPas Teamscan + 2MINSCAN"
            uitleg="Twee links per board member. Levert de teamdynamiek (Lencioni 6-laags), de energiebalans en de risicosignalen."
            icoon={<Layers className="h-4 w-4" />}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 150px",
              background: "#fff",
              border: "1px dashed #cfe0e6",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <GitBranch className="h-5 w-5" style={{ color: ACCENT, marginBottom: 8 }} />
            <div style={{ color: INK, fontSize: 13, fontWeight: 700, textAlign: "center" }}>
              Go / No-Go
            </div>
            <div style={{ color: SUB, fontSize: 11, textAlign: "center", marginTop: 2 }}>
              "Onder de motorkap?"
            </div>
          </div>
          <FaseKaart
            nr="Fase 2 · Diepteanalyse"
            titel="Talent, drivers & cognitie"
            instrumenten="T4P Business Kompas (per lid)"
            uitleg="Talentkaart, driverpatroon en het geaggregeerde cognitieve profiel (Elliott Jaques-indicatie), SWOT en roladviezen."
            icoon={<Compass className="h-4 w-4" />}
          />
        </div>

        {/* Eindrapport-preview */}
        <div style={{ marginTop: 16 }}>
          <Link href="/hdd/rapport">
            <a
              data-testid="link-rapport-preview"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#0f2733",
                color: "#fff",
                borderRadius: 10,
                padding: "12px 18px",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Bekijk het Engelstalige vlaggenschiprapport (Investor &amp; Team)
              <ArrowRight className="h-4 w-4" />
            </a>
          </Link>
        </div>

        {/* Nieuw traject */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eef1f2",
            borderRadius: 12,
            padding: 24,
            marginTop: 24,
          }}
        >
          <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>Nieuw board-traject</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Label>Board / team</Label>
              <Input
                value={boardNaam}
                onChange={(e) => setBoardNaam(e.target.value)}
                placeholder="bv. Directieteam Acme NV"
                data-testid="input-board-naam"
              />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <Label>Organisatie (optioneel)</Label>
              <Input
                value={orgLabel}
                onChange={(e) => setOrgLabel(e.target.value)}
                placeholder="bv. Acme NV"
                data-testid="input-org-label"
              />
            </div>
            <div style={{ flex: "0 1 200px" }}>
              <Label>Context</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger data-testid="select-context">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self-screening">Matuur team — self-screening</SelectItem>
                  <SelectItem value="ma">M&amp;A — overname</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => maak.mutate()}
              disabled={!boardNaam.trim() || maak.isPending}
              data-testid="button-maak-traject"
            >
              Traject starten <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Lopende trajecten */}
        <div style={{ marginTop: 28 }}>
          <h2 style={{ color: INK, fontSize: 18 }}>Lopende trajecten</h2>
          {(!trajecten || trajecten.length === 0) && (
            <p style={{ color: SUB, fontSize: 14 }}>Nog geen trajecten. Start hierboven een board-traject.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trajecten?.map((tr) => (
              <Link key={tr.id} href={`/hdd/traject/${tr.id}`}>
                <a
                  data-testid={`link-traject-${tr.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#fff",
                    border: "1px solid #eef1f2",
                    borderRadius: 10,
                    padding: "14px 18px",
                    textDecoration: "none",
                  }}
                >
                  <div>
                    <div style={{ color: INK, fontSize: 15, fontWeight: 600 }}>{tr.boardNaam}</div>
                    <div style={{ color: SUB, fontSize: 12 }}>
                      {tr.orgLabel ? `${tr.orgLabel} · ` : ""}
                      {tr.context === "ma" ? "M&A-overname" : "Self-screening"} · status: {tr.status}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4" style={{ color: ACCENT }} />
                </a>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
