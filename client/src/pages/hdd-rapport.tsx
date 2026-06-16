import { useState } from "react";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";

/**
 * Human Due Diligence — flagship report viewer (ALWAYS English).
 * ------------------------------------------------------------------
 * Renders TWO fully separate reports from the engine: an Investor Report and a
 * Team Report, each in its own block with its own confidentiality banner,
 * controls and PDF download. The two are never merged into one document. The
 * report content itself is always English; only the surrounding facilitator
 * chrome stays in the app language.
 */

// API base: works locally (relative) and after deploy (proxy path injected by deploy_website).
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const INK = "#16384a";
const SUB = "#5b6b73";
const ACCENT = "#1f6f8b";
const PAGE = "#0f2733";

type Sectie = {
  id: string;
  title: string;
  body?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  cards?: Array<{ title: string; lines: string[] }>;
  callout?: { label: string; text: string };
};
type RapportModel = {
  language: string;
  audience: "investor" | "team";
  meta: {
    title: string;
    subtitle: string;
    boardLabel: string;
    investorLabel: string;
    contextLabel: string;
    date: string;
    confidentiality: string;
    basis: string;
  };
  index: { value: number; band: string; verdict: string; verdictLabel: string };
  secties: Sectie[];
};

// Demo board (Loop-style) so the report renders immediately for preview.
const DEMO_LEDEN = [
  { id: 1, naam: "Dimitri O", teamscan: { vertrouwen: 4.2, conflict: 4.0, betrokkenheid: 4.3, verantwoordelijkheid: 4.1, resultaten: 4.4 }, energy: { fase: 0, energie: 9 }, talent: { talentFoci: ["Strategy", "Operational", "Interrelational"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Try Hard", "Be Strong", "Hurry Up"], driverRisico: "matig", stratumIndicatie: 4 } },
  { id: 2, naam: "Maarten Bodewes", teamscan: { vertrouwen: 4.1, conflict: 4.2, betrokkenheid: 4.0, verantwoordelijkheid: 4.2, resultaten: 4.5 }, energy: { fase: 0, energie: 9 }, talent: { talentFoci: ["Operational", "Innovation", "Strategy"], versnellers: ["Analysis", "Facilitation", "Result-orientation"], drivers: ["Try Hard", "Be Strong", "Hurry Up"], driverRisico: "matig", stratumIndicatie: 4 } },
  { id: 3, naam: "Marloes Mantel", teamscan: { vertrouwen: 4.0, conflict: 3.8, betrokkenheid: 4.1, verantwoordelijkheid: 3.9, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Operational", "Strategy"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Hurry Up", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 3 } },
  { id: 4, naam: "Cedric Schepers", teamscan: { vertrouwen: 3.9, conflict: 3.7, betrokkenheid: 4.0, verantwoordelijkheid: 3.8, resultaten: 4.1 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Interrelational", "Strategy", "Operational"], versnellers: ["Analysis", "Impact"], drivers: ["Hurry Up", "Be Strong", "Please Others"], driverRisico: "matig", stratumIndicatie: 3 } },
  { id: 5, naam: "Rob Weston", teamscan: { vertrouwen: 4.1, conflict: 4.0, betrokkenheid: 4.2, verantwoordelijkheid: 4.0, resultaten: 4.3 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Strategy", "Innovation", "Operational"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Be Perfect", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 4 } },
  { id: 6, naam: "Ryan Helps", teamscan: { vertrouwen: 4.0, conflict: 3.9, betrokkenheid: 4.1, verantwoordelijkheid: 3.9, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Operational", "Strategy", "Innovation"], versnellers: ["Facilitation", "Result-orientation", "Analysis"], drivers: ["Be Perfect", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 3 } },
  { id: 7, naam: "Menno Schreuder", teamscan: { vertrouwen: 4.2, conflict: 4.1, betrokkenheid: 4.0, verantwoordelijkheid: 4.1, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Strategy", "Operational", "Interrelational"], versnellers: ["Analysis", "Facilitation", "Result-orientation"], drivers: ["Be Perfect", "Be Strong", "Try Hard"], driverRisico: "matig", stratumIndicatie: 3 } },
];

function verdictColor(verdict: string): string {
  if (verdict === "proceed") return "#1f7a4d";
  if (verdict === "conditional") return "#b87514";
  if (verdict === "hold-conditional") return "#b85814";
  return "#a33636";
}

function Gauge({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 15, color: "rgba(255,255,255,.7)" }}>/100 · {label}</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,.18)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#7fd1c0" }} />
      </div>
    </div>
  );
}

function SectieBlok({ s }: { s: Sectie }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ color: INK, fontSize: 20, margin: "0 0 12px", borderBottom: "2px solid #eef1f2", paddingBottom: 6 }}>
        {s.title}
      </h2>
      {s.body?.map((p, i) => (
        <p key={i} style={{ color: "#34474f", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 10px" }}>{p}</p>
      ))}
      {s.table && (
        <div style={{ overflowX: "auto", margin: "10px 0" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
            <thead>
              <tr>
                {s.table.headers.map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "8px 12px", background: "#f1f6f7", color: INK, fontWeight: 700, border: "1px solid #e4eaec" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ padding: "8px 12px", color: "#34474f", border: "1px solid #eef1f2" }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.cards && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, margin: "10px 0" }}>
          {s.cards.map((c, i) => (
            <div key={i} style={{ border: "1px solid #eef1f2", borderRadius: 10, padding: 14, background: "#fbfcfc" }}>
              <div style={{ color: INK, fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{c.title}</div>
              {c.lines.map((l, li) => (
                <div key={li} style={{ color: SUB, fontSize: 12.5, lineHeight: 1.5 }}>{l}</div>
              ))}
            </div>
          ))}
        </div>
      )}
      {s.bullets && (
        <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
          {s.bullets.map((b, i) => (
            <li key={i} style={{ color: "#34474f", fontSize: 14, lineHeight: 1.55, marginBottom: 5 }}>{b}</li>
          ))}
        </ul>
      )}
      {s.callout && (
        <div style={{ background: "#eef5f7", borderLeft: `4px solid ${ACCENT}`, borderRadius: 8, padding: "12px 16px", margin: "10px 0" }}>
          <div style={{ color: ACCENT, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>{s.callout.label}</div>
          <div style={{ color: "#34474f", fontSize: 13.5, lineHeight: 1.55 }}>{s.callout.text}</div>
        </div>
      )}
    </section>
  );
}

// Confidentiality banner — different copy and weight per report.
function VertrouwelijkheidsBanner({ aud }: { aud: "investor" | "team" }) {
  if (aud === "investor") {
    return (
      <div
        style={{
          background: "#fdecec",
          border: "1px solid #e7a6a6",
          borderLeft: "5px solid #a33636",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
        }}
        data-testid="banner-investor-confidential"
      >
        <div style={{ color: "#8a2a2a", fontWeight: 800, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>
          Strictly Confidential · Investor Report
        </div>
        <div style={{ color: "#7a2e2e", fontSize: 13, lineHeight: 1.5 }}>
          Uitsluitend bestemd voor de investerende partij. Dit rapport mag nooit gedeeld worden met het
          beoordeelde board-team of de over te nemen organisatie. Het is een afzonderlijk rapport, los van het Team Report.
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#eef5f7",
        border: "1px solid #bcd6dd",
        borderLeft: "5px solid #1f6f8b",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
      }}
      data-testid="banner-team-confidential"
    >
      <div style={{ color: "#155a72", fontWeight: 800, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>
        Confidential · Team Report
      </div>
      <div style={{ color: "#1f5266", fontSize: 13, lineHeight: 1.5 }}>
        Bestemd voor het team zelf. Bevat geen investeerder-materiaal. Dit is een afzonderlijk rapport, los van het Investor Report.
      </div>
    </div>
  );
}

// Eén volledig rapportpaneel (cover + body) voor één doelgroep.
function RapportPaneel({ aud, model }: { aud: "investor" | "team"; model: RapportModel }) {
  const isInv = aud === "investor";
  const border = isInv ? "#e7c2c2" : "#c4dbe2";
  const confBg = isInv ? "#f0b8b8" : "#a9d3df";
  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 18px rgba(15,39,51,.08)", border: `2px solid ${border}` }}>
      {/* Cover */}
      <div style={{ background: PAGE, color: "#fff", padding: "32px 36px" }}>
        <div style={{ display: "inline-block", background: confBg, color: "#16384a", fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 6, marginBottom: 12 }}>
          {isInv ? "Investor Report" : "Team Report"}
        </div>
        <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", marginBottom: 10 }}>
          {model.meta.confidentiality} · {model.meta.date}
        </div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px", color: "#fff" }}>{model.meta.title}</h1>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,.8)", marginBottom: 4 }}>{model.meta.subtitle}</div>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.65)", marginBottom: 20 }}>
          {model.meta.boardLabel} · {model.meta.contextLabel} · Basis: {model.meta.basis}
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <Gauge value={model.index.value} label={model.index.band} />
          <div style={{ background: verdictColor(model.index.verdict), color: "#fff", padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 16 }}>
            {model.index.verdictLabel}
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "28px 36px" }}>
        {model.secties.map((s) => (
          <SectieBlok key={s.id} s={s} />
        ))}
        <div style={{ color: SUB, fontSize: 11.5, borderTop: "1px solid #eef1f2", paddingTop: 12, marginTop: 8 }}>
          TaPasCity · www.tapascity.com · info@tapascity.com — {model.meta.confidentiality}
        </div>
      </div>
    </div>
  );
}

// Eén volledig gescheiden rapport-sectie met eigen titel, banner, knoppen en paneel.
function RapportBlok({
  aud,
  titel,
  omschrijving,
  model,
  investorLabel,
  setInvestorLabel,
  bezig,
  pdfBezig,
  genereer,
  downloadPdf,
}: {
  aud: "investor" | "team";
  titel: string;
  omschrijving: string;
  model: RapportModel | null;
  investorLabel: string;
  setInvestorLabel: (v: string) => void;
  bezig: "investor" | "team" | null;
  pdfBezig: "investor" | "team" | null;
  genereer: (aud: "investor" | "team") => void;
  downloadPdf: (aud: "investor" | "team") => void;
}) {
  const accent = aud === "investor" ? "#a33636" : "#1f6f8b";
  return (
    <section style={{ marginBottom: 40 }} data-testid={`block-${aud}-report`}>
      <div style={{ borderLeft: `5px solid ${accent}`, paddingLeft: 14, marginBottom: 16 }}>
        <h2 style={{ color: accent, fontSize: 22, margin: "0 0 4px" }}>{titel}</h2>
        <div style={{ color: SUB, fontSize: 13.5, lineHeight: 1.5 }}>{omschrijving}</div>
      </div>

      <VertrouwelijkheidsBanner aud={aud} />

      <div style={{ background: "#fff", border: "1px solid #eef1f2", borderRadius: 12, padding: 18, marginBottom: 18 }}>
        {aud === "investor" && (
          <input
            value={investorLabel}
            onChange={(e) => setInvestorLabel(e.target.value)}
            placeholder="Investing party (variable)"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d8dee0", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            data-testid="input-investor-label"
          />
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={() => genereer(aud)} disabled={bezig !== null} data-testid={`button-${aud}-report`}>
            {bezig === aud ? "Bezig…" : "Toon rapport"}
          </Button>
          <Button variant="outline" onClick={() => downloadPdf(aud)} disabled={pdfBezig !== null} data-testid={`button-${aud}-pdf`}>
            {pdfBezig === aud ? "Bezig…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {model && <RapportPaneel aud={aud} model={model} />}
    </section>
  );
}

export default function HddRapport() {
  const [investorLabel, setInvestorLabel] = useState("the investment committee");
  // Twee volledig gescheiden rapporten, elk met eigen state.
  const [investorModel, setInvestorModel] = useState<RapportModel | null>(null);
  const [teamModel, setTeamModel] = useState<RapportModel | null>(null);
  const [bezig, setBezig] = useState<"investor" | "team" | null>(null);

  const [fout, setFout] = useState<string | null>(null);
  const [pdfBezig, setPdfBezig] = useState<"investor" | "team" | null>(null);

  // One-click PDF: generate the approved flagship specimen (always English) as
  // a downloadable PDF, fed by the live board data. Same body as the JSON
  // report endpoint; the server renders the fixed specimen format.
  async function downloadPdf(aud: "investor" | "team") {
    setPdfBezig(aud);
    setFout(null);
    try {
      // Demo: create a throwaway traject, then stream its flagship PDF.
      const tr = await fetch(`${API_BASE}/api/hdd/trajecten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardNaam: "Loop Founder-Management Team", orgLabel: "Loop", context: "ma", vereistStratum: 5 }),
      }).then((r) => r.json());
      if (!tr || typeof tr.id !== "number") {
        throw new Error("Kon geen demo-traject aanmaken.");
      }
      const resp = await fetch(`${API_BASE}/api/hdd/trajecten/${tr.id}/rapport/pdf?audience=${aud}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorLabel,
          leden: DEMO_LEDEN,
          company: "Loop Earplugs",
          revenueNow: "\u20ac190M",
          revenueTarget: "\u20ac500M+",
          fteFrom: 300,
          fteTo: 600,
        }),
      });
      if (!resp.ok) {
        let detail = "Het PDF-rapport kon niet worden gegenereerd.";
        try {
          const j = await resp.json();
          if (j?.error) detail = j.detail ? `${j.error}: ${j.detail}` : j.error;
        } catch { /* niet-JSON respons */ }
        throw new Error(detail);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hdd-loop-earplugs-${aud}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout bij genereren van de PDF.");
    } finally {
      setPdfBezig(null);
    }
  }

  async function genereer(aud: "investor" | "team") {
    setBezig(aud);
    setFout(null);
    try {
      // Demo: create a throwaway traject then render the report.
      const tr = await fetch(`${API_BASE}/api/hdd/trajecten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardNaam: "Loop Founder-Management Team", orgLabel: "Loop", context: "ma", vereistStratum: 5 }),
      }).then((r) => r.json());
      if (!tr || typeof tr.id !== "number") {
        throw new Error("Kon geen demo-traject aanmaken.");
      }
      const rap = await fetch(`${API_BASE}/api/hdd/trajecten/${tr.id}/rapport?audience=${aud}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorLabel, leden: DEMO_LEDEN }),
      }).then((r) => r.json());
      // Guard: only render a valid RapportModel (has meta), never an error object.
      if (!rap || !rap.meta || !Array.isArray(rap.secties)) {
        throw new Error("Het rapport kon niet worden gegenereerd.");
      }
      if (aud === "investor") setInvestorModel(rap);
      else setTeamModel(rap);
    } catch (e) {
      if (aud === "investor") setInvestorModel(null);
      else setTeamModel(null);
      setFout(e instanceof Error ? e.message : "Onbekende fout bij genereren.");
    } finally {
      setBezig(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header (app language) */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: SUB, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Human Due Diligence · twee afzonderlijke eindrapporten · altijd Engelstalig
          </div>
          <p style={{ color: "#34474f", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 6px" }}>
            Het HDD-traject levert <strong>twee volledig afzonderlijke rapporten</strong> op: een Investor Report en een Team Report. Ze worden nooit als één document samengevoegd. Het Investor Report mag nooit in handen komen van het beoordeelde board-team.
          </p>
          <div style={{ color: SUB, fontSize: 12 }}>
            Demovoorbeeld met een Loop-achtig board (7 leden). De investerende partij is een variabele. De PDF is het goedgekeurde vlaggenschiprapport in vast specimen-format.
          </div>
        </div>

        {fout && (
          <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", color: "#9b2c2c", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 14 }} data-testid="text-error">
            {fout}
          </div>
        )}

        <RapportBlok
          aud="investor"
          titel="Investor Report"
          omschrijving="Het due-diligence-rapport voor de investerende partij: gescoorde constructen, risico-register en verificatie. Bevat geen ruwe item-antwoorden."
          model={investorModel}
          investorLabel={investorLabel}
          setInvestorLabel={setInvestorLabel}
          bezig={bezig}
          pdfBezig={pdfBezig}
          genereer={genereer}
          downloadPdf={downloadPdf}
        />

        <RapportBlok
          aud="team"
          titel="Team Report"
          omschrijving="Het inzichtsrapport voor het team zelf: samenwerking, energie en talentcombinatie. Bevat geen investeerder-materiaal."
          model={teamModel}
          investorLabel={investorLabel}
          setInvestorLabel={setInvestorLabel}
          bezig={bezig}
          pdfBezig={pdfBezig}
          genereer={genereer}
          downloadPdf={downloadPdf}
        />
      </div>
    </div>
  );
}
