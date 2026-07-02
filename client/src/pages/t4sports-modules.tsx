// client/src/pages/t4sports-modules.tsx
// T4Sports Extra Modules — coach-selectie + vragenlijst-afname.
// NIEUW BESTAND — raakt geen bestaande bestanden aan.
// Stijl: navy/goud consistent met t4sports-vragenlijst.tsx.

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, CheckCircle, Download, ExternalLink } from "lucide-react";

const NAVY = "#0D1B3E";
const GOUD = "#C9A84C";
const BLAUW = "#162852";

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

interface ModuleInfo {
  id: string;
  naam: string;
  subtitel: string;
  beschrijving: string;
  instrument: string;
  betrouwbaarheid: string;
  afnameduur: string;
  aantalItems: number;
  wetenschappelijkeBron: string;
  doi?: string;
}

interface ModuleItem {
  nr: number;
  tekst: string;
  schaal: string;
}

interface AntwoordOptie {
  waarde: number;
  label: string;
}

interface ModuleDefinitie extends ModuleInfo {
  items: ModuleItem[];
  antwoordOpties: AntwoordOptie[];
}

type Fase = "selectie" | "afname" | "voltooid";

// ──────────────────────────────────────────────────────
// SportBg decoratief
// ──────────────────────────────────────────────────────
function SportBg({ opacity = 0.03 }: { opacity?: number }) {
  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity, pointerEvents: "none" }}
      viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"
    >
      <circle cx="350" cy="50" r="120" fill="none" stroke={GOUD} strokeWidth="1.5" />
      <circle cx="350" cy="50" r="80" fill="none" stroke={GOUD} strokeWidth="0.8" />
      <line x1="0" y1="150" x2="400" y2="150" stroke={GOUD} strokeWidth="0.5" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────
// MODULE KAART (selectie-scherm)
// ──────────────────────────────────────────────────────
function ModuleKaart({
  module,
  geselecteerd,
  onToggle,
}: {
  module: ModuleInfo;
  geselecteerd: boolean;
  onToggle: () => void;
}) {
  const moduleKleuren: Record<string, string> = {
    M1: "#C9A84C",
    M2: "#4FC3F7",
    M3: "#81C784",
  };
  const kleur = moduleKleuren[module.id] ?? GOUD;

  return (
    <button
      onClick={onToggle}
      style={{
        background: geselecteerd ? `${kleur}15` : "#1a2a4a",
        border: `2px solid ${geselecteerd ? kleur : "#2a3a5a"}`,
        borderRadius: "12px",
        padding: "20px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.2s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <span
            style={{
              background: `${kleur}22`,
              border: `1px solid ${kleur}55`,
              color: kleur,
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: "12px",
              letterSpacing: "1px",
            }}
          >
            {module.id}
          </span>
          <span style={{ color: "#8aa8d0", fontSize: "0.72rem", marginLeft: "8px" }}>
            {module.aantalItems} items · {module.afnameduur}
          </span>
        </div>
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: `2px solid ${geselecteerd ? kleur : "#4a5a6a"}`,
            background: geselecteerd ? kleur : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {geselecteerd && <CheckCircle size={14} color={NAVY} />}
        </div>
      </div>
      <div style={{ color: geselecteerd ? kleur : "#ccd6e8", fontWeight: 700, fontSize: "1rem", marginBottom: "6px" }}>
        {module.naam}
      </div>
      <div style={{ color: "#8aa8d0", fontSize: "0.82rem", marginBottom: "10px", lineHeight: "1.5" }}>
        {module.subtitel}
      </div>
      <div style={{ color: "#7A8FAA", fontSize: "0.78rem", lineHeight: "1.5" }}>
        {module.beschrijving}
      </div>
      <div
        style={{
          marginTop: "12px",
          paddingTop: "10px",
          borderTop: `1px solid #2a3a5a`,
          fontSize: "0.72rem",
          color: "#5A6A7A",
          lineHeight: "1.4",
        }}
      >
        <span style={{ color: "#4a5a6a", fontWeight: 600 }}>Instrument: </span>
        {module.instrument} · {module.betrouwbaarheid}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────
// VRAAGCOMPONENT (afname scherm)
// ──────────────────────────────────────────────────────
function VraagComponent({
  item,
  opties,
  waarde,
  onChange,
  kleur,
}: {
  item: ModuleItem;
  opties: AntwoordOptie[];
  waarde: number | null;
  onChange: (v: number) => void;
  kleur: string;
}) {
  return (
    <div>
      <p style={{ color: "white", fontSize: "1rem", lineHeight: "1.7", marginBottom: "20px", fontWeight: 500 }}>
        {item.tekst}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {opties.map((o) => {
          const actief = waarde === o.waarde;
          return (
            <button
              key={o.waarde}
              onClick={() => onChange(o.waarde)}
              style={{
                background: actief ? kleur : "#1a2a4a",
                border: `2px solid ${actief ? kleur : "#2a3a5a"}`,
                color: actief ? NAVY : "#ccd6e8",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "0.82rem",
                fontWeight: actief ? 700 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// VOORTGANGSBALK
// ──────────────────────────────────────────────────────
function VoortgangsBalk({ huidig, totaal, kleur }: { huidig: number; totaal: number; kleur: string }) {
  const pct = Math.round((huidig / totaal) * 100);
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ color: "#8aa8d0", fontSize: "0.75rem" }}>Vraag {huidig} van {totaal}</span>
        <span style={{ color: kleur, fontSize: "0.75rem", fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: "#1a2a4a", borderRadius: "4px", height: "6px" }}>
        <div style={{ background: kleur, borderRadius: "4px", height: "6px", width: `${pct}%`, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// HOOFDCOMPONENT
// ──────────────────────────────────────────────────────
export default function T4SportsModules() {
  const { afnameId } = useParams<{ afnameId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [fase, setFase] = useState<Fase>("selectie");
  const [geselecteerdeModules, setGeselecteerdeModules] = useState<string[]>([]);
  const [actieveModuleIdx, setActieveModuleIdx] = useState(0);
  const [actieveItemIdx, setActieveItemIdx] = useState(0);
  const [allAntwoorden, setAllAntwoorden] = useState<Record<string, Record<string, number>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rapportCompleetUrl, setRapportCompleetUrl] = useState<string | null>(null);
  const [respondentCode, setRespondentCode] = useState<string | null>(null);

  const moduleKleuren: Record<string, string> = { M1: GOUD, M2: "#4FC3F7", M3: "#81C784" };

  // Ophalen basisinfo (respondentCode voor terug-navigatie)
  useEffect(() => {
    if (!afnameId) return;
    apiRequest("GET", `/api/t4sports/afnames/${afnameId}/info`)
      .then((info: any) => setRespondentCode(info.respondentCode ?? null))
      .catch(() => {/* negeerbaar */});
  }, [afnameId]);

  // Helper: navigeer terug naar dashboard met juiste token
  const naarDashboard = () => navigate(`/t4sports/dashboard/${respondentCode ?? afnameId}`);

  // Ophalen module-definities (overzicht)
  const { data: modulesData, isLoading: isLoadingModules } = useQuery({
    queryKey: ["/api/t4sports/modules"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/t4sports/modules");
      return res as { modules: ModuleInfo[] };
    },
  });

  // Ophalen volledige definitie per geselecteerde module
  const [moduleDefinities, setModuleDefinities] = useState<Record<string, ModuleDefinitie>>({});

  useEffect(() => {
    if (fase !== "afname") return;
    for (const id of geselecteerdeModules) {
      if (!moduleDefinities[id]) {
        apiRequest("GET", `/api/t4sports/modules/${id}`)
          .then((def) => setModuleDefinities((prev) => ({ ...prev, [id]: def as ModuleDefinitie })))
          .catch(() => toast({ title: "Fout bij laden module", variant: "destructive" }));
      }
    }
  }, [fase, geselecteerdeModules]);

  if (!afnameId) return <div>Geen afname-id gevonden.</div>;

  const actieveModuleId = geselecteerdeModules[actieveModuleIdx];
  const actieveDef = actieveModuleId ? moduleDefinities[actieveModuleId] : null;
  const actieveKleur = actieveModuleId ? (moduleKleuren[actieveModuleId] ?? GOUD) : GOUD;

  function toggleModule(id: string) {
    setGeselecteerdeModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function startAfname() {
    if (geselecteerdeModules.length === 0) {
      toast({ title: "Selecteer minstens één module", variant: "destructive" });
      return;
    }
    setFase("afname");
    setActieveModuleIdx(0);
    setActieveItemIdx(0);
  }

  function slaAntwoordOp(moduleId: string, itemNr: number, waarde: number) {
    setAllAntwoorden((prev) => ({
      ...prev,
      [moduleId]: { ...(prev[moduleId] ?? {}), [String(itemNr)]: waarde },
    }));
  }

  function vorigeVraag() {
    if (actieveItemIdx > 0) {
      setActieveItemIdx(actieveItemIdx - 1);
    } else if (actieveModuleIdx > 0) {
      const vorigeModuleId = geselecteerdeModules[actieveModuleIdx - 1];
      const vorigeDef = moduleDefinities[vorigeModuleId];
      setActieveModuleIdx(actieveModuleIdx - 1);
      setActieveItemIdx(vorigeDef ? vorigeDef.items.length - 1 : 0);
    }
  }

  async function volgendeVraagOfVoltooien() {
    if (!actieveDef) return;

    if (actieveItemIdx < actieveDef.items.length - 1) {
      setActieveItemIdx(actieveItemIdx + 1);
    } else if (actieveModuleIdx < geselecteerdeModules.length - 1) {
      setActieveModuleIdx(actieveModuleIdx + 1);
      setActieveItemIdx(0);
    } else {
      // Alle modules afgerond — verstuur
      setIsSubmitting(true);
      try {
        const payload = {
          modules: geselecteerdeModules.map((id) => ({
            moduleId: id,
            antwoorden: allAntwoorden[id] ?? {},
          })),
        };
        await apiRequest("POST", `/api/t4sports/afnames/${afnameId}/module-antwoorden`, payload);
        setRapportCompleetUrl(`/api/t4sports/afnames/${afnameId}/rapport-compleet/html`);
        setFase("voltooid");
      } catch (err: any) {
        toast({ title: "Fout bij opslaan", description: err.message, variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  function huidigeAntwoord(): number | null {
    if (!actieveDef) return null;
    const item = actieveDef.items[actieveItemIdx];
    return allAntwoorden[actieveModuleId!]?.[String(item.nr)] ?? null;
  }

  function isModuleVolledig(moduleId: string): boolean {
    const def = moduleDefinities[moduleId];
    if (!def) return false;
    const ant = allAntwoorden[moduleId] ?? {};
    return def.items.every((it) => typeof ant[String(it.nr)] === "number");
  }

  // ── SELECTIE-SCHERM ──
  if (fase === "selectie") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, overflowX: "hidden" }}>
        <div style={{ position: "relative", padding: "48px 24px 32px", maxWidth: "600px", margin: "0 auto" }}>
          <SportBg opacity={0.04} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ color: GOUD, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "8px" }}>
              T4Sports · Extra Modules
            </div>
            <h1 style={{ color: "white", fontSize: "1.8rem", fontWeight: 800, marginBottom: "8px", lineHeight: 1.2 }}>
              Verdiep het profiel
            </h1>
            <p style={{ color: "#8aa8d0", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "32px" }}>
              De T4Sports basisvragenlijst is voltooid. Selecteer 1 of 2 extra modules om het profiel te verdiepen met wetenschappelijk gevalideerde instrumenten.
            </p>

            {isLoadingModules ? (
              <div style={{ color: "#8aa8d0", textAlign: "center", padding: "40px" }}>Modules laden…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "32px" }}>
                {(modulesData?.modules ?? []).map((m) => (
                  <ModuleKaart
                    key={m.id}
                    module={m}
                    geselecteerd={geselecteerdeModules.includes(m.id)}
                    onToggle={() => toggleModule(m.id)}
                  />
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                variant="outline"
                onClick={naarDashboard}
                style={{ borderColor: "#2a3a5a", color: "#8aa8d0", background: "transparent", flex: 1 }}
              >
                Sla modules over
              </Button>
              <Button
                onClick={startAfname}
                disabled={geselecteerdeModules.length === 0 || isLoadingModules}
                style={{ background: GOUD, color: NAVY, fontWeight: 700, flex: 2 }}
              >
                Start {geselecteerdeModules.length > 0 ? `(${geselecteerdeModules.join(" + ")})` : ""}
                <ChevronRight size={16} style={{ marginLeft: "6px" }} />
              </Button>
            </div>

            {geselecteerdeModules.length > 0 && (
              <div style={{ marginTop: "14px", padding: "12px 16px", background: "#1a2a4a", borderRadius: "8px", fontSize: "0.78rem", color: "#8aa8d0" }}>
                Geschatte extra afnameduur:{" "}
                <strong style={{ color: GOUD }}>
                  {(modulesData?.modules ?? [])
                    .filter((m) => geselecteerdeModules.includes(m.id))
                    .map((m) => m.afnameduur)
                    .join(" + ")}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── AFNAME-SCHERM ──
  if (fase === "afname") {
    if (!actieveDef) {
      return (
        <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#8aa8d0" }}>Module laden…</div>
        </div>
      );
    }

    const item = actieveDef.items[actieveItemIdx];
    const totaalItems = geselecteerdeModules.reduce((acc, id) => acc + (moduleDefinities[id]?.items.length ?? 0), 0);
    const voltooideItems = geselecteerdeModules.slice(0, actieveModuleIdx).reduce((acc, id) => acc + (moduleDefinities[id]?.items.length ?? 0), 0) + actieveItemIdx;
    const antwoord = huidigeAntwoord();
    const kanVolgende = antwoord !== null;

    const isLaatsteVraag =
      actieveModuleIdx === geselecteerdeModules.length - 1 &&
      actieveItemIdx === actieveDef.items.length - 1;

    return (
      <div style={{ minHeight: "100vh", background: NAVY }}>
        {/* Header */}
        <div style={{ background: BLAUW, borderBottom: `1px solid #1a2a4a`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: actieveKleur, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
              {actieveModuleId} · {actieveDef.naam}
            </div>
            <div style={{ color: "#8aa8d0", fontSize: "0.72rem" }}>
              {actieveDef.instrument}
            </div>
          </div>
          <div style={{ color: "#8aa8d0", fontSize: "0.75rem" }}>
            Module {actieveModuleIdx + 1}/{geselecteerdeModules.length}
          </div>
        </div>

        {/* Inhoud */}
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 24px" }}>
          <VoortgangsBalk
            huidig={voltooideItems + actieveItemIdx + 1}
            totaal={totaalItems}
            kleur={actieveKleur}
          />

          <div style={{ background: "#111f3a", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
            <div style={{ color: actieveKleur, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Vraag {actieveItemIdx + 1} / {actieveDef.items.length}
            </div>
            <VraagComponent
              item={item}
              opties={actieveDef.antwoordOpties}
              waarde={antwoord}
              onChange={(v) => slaAntwoordOp(actieveModuleId!, item.nr, v)}
              kleur={actieveKleur}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <Button
              variant="outline"
              onClick={vorigeVraag}
              disabled={actieveModuleIdx === 0 && actieveItemIdx === 0}
              style={{ borderColor: "#2a3a5a", color: "#8aa8d0", background: "transparent" }}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              onClick={volgendeVraagOfVoltooien}
              disabled={!kanVolgende || isSubmitting}
              style={{ background: kanVolgende ? actieveKleur : "#1a2a4a", color: kanVolgende ? NAVY : "#4a5a6a", fontWeight: 700, flex: 1 }}
            >
              {isSubmitting
                ? "Verwerken…"
                : isLaatsteVraag
                ? "Rapport genereren"
                : "Volgende"}
              {!isSubmitting && <ChevronRight size={16} style={{ marginLeft: "6px" }} />}
            </Button>
          </div>

          {/* Wetenschappelijke bron */}
          <div style={{ marginTop: "20px", padding: "12px 16px", background: "#0a1428", borderRadius: "8px", fontSize: "0.72rem", color: "#4a5a6a", lineHeight: 1.5 }}>
            <span style={{ color: "#5a6a7a", fontWeight: 600 }}>Bron: </span>
            {actieveDef.wetenschappelijkeBron}
            {actieveDef.doi && (
              <> · <span style={{ color: actieveKleur }}>doi: {actieveDef.doi}</span></>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── VOLTOOID-SCHERM ──
  if (fase === "voltooid") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: `${GOUD}22`, border: `3px solid ${GOUD}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <CheckCircle size={36} color={GOUD} />
          </div>
          <div style={{ color: GOUD, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>
            Modules voltooid
          </div>
          <h1 style={{ color: "white", fontSize: "2rem", fontWeight: 800, marginBottom: "12px" }}>
            Je volledig profiel is klaar
          </h1>
          <p style={{ color: "#8aa8d0", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "32px" }}>
            T4Sports basisrapport + {geselecteerdeModules.join(" + ")} zijn verwerkt. Jouw mental coach ontvangt een volledig rapport.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rapportCompleetUrl && (
              <Button
                onClick={() => window.open(rapportCompleetUrl, "_blank")}
                style={{ background: GOUD, color: NAVY, fontWeight: 700 }}
              >
                <ExternalLink size={16} style={{ marginRight: "8px" }} />
                Volledig rapport bekijken
              </Button>
            )}
            {rapportCompleetUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(`/api/t4sports/afnames/${afnameId}/rapport-compleet/download`, "_blank")}
                style={{ borderColor: GOUD, color: GOUD, background: "transparent" }}
              >
                <Download size={16} style={{ marginRight: "8px" }} />
                Rapport downloaden (HTML)
              </Button>
            )}
            <Button
              variant="outline"
              onClick={naarDashboard}
              style={{ borderColor: "#2a3a5a", color: "#8aa8d0", background: "transparent" }}
            >
              Terug naar dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
