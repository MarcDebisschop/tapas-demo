// client/src/pages/t4sports-dashboard.tsx
// T4Sports Dashboard — persoonlijk dashboard voor de atleet na voltooiing.
// Kleurstijl: donker navy (#0D1B3E) + goud (#C9A84C) + wit.

import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, Mic, MessageSquare, Download, ExternalLink } from "lucide-react";

// ============================================================
// Constanten
// ============================================================
const NAVY = "#0D1B3E";
const GOUD = "#C9A84C";
const BLAUW_LICHT = "#162852";

// ============================================================
// Types
// ============================================================
interface DashboardData {
  naam: string;
  sporttak: string | null;
  ploeg: string | null;
  rol: string | null;
  datum: string;
  dominanteFocus: string;
  dominanteVersneller: string;
  dominanteDriver: string;
  energieProfiel: "hoog" | "midden" | "laag";
  drukProfiel: "gaspedaal" | "rem" | "wisselvallig";
  normalizedEnergy: number | null;
  baselineEnergy: number | null;
  consistentie: number | null;
  rapportUrl: string;
  downloadUrl: string;
}

interface UitlegBlok {
  id: string;
  titel: string;
  tekst: string;
}

interface UitlegScript {
  blokken: UitlegBlok[];
}

interface BibliotheekItem {
  titel: string;
  auteur: string;
  jaar: number;
  beschrijving: string;
  url: string | null;
  tags: string[];
}

interface PodcastItem {
  naam: string;
  podcast: string;
  aflevering?: string;
  beschrijving: string;
  url: string | null;
  tags: string[];
}

// ============================================================
// Helpers
// ============================================================
function formatDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function EnergiBadge({ waarde, label }: { waarde: "hoog" | "midden" | "laag"; label: string }) {
  const kleur = waarde === "hoog" ? "#2ecc71" : waarde === "midden" ? "#f39c12" : "#e74c3c";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: `${kleur}22`, color: kleur, border: `1px solid ${kleur}` }}
    >
      {label}
    </span>
  );
}

function DrukBadge({ profiel }: { profiel: "gaspedaal" | "rem" | "wisselvallig" }) {
  const config = {
    gaspedaal: { kleur: GOUD, label: "⚡ Gaspedaal" },
    rem: { kleur: "#e74c3c", label: "⛔ Rem" },
    wisselvallig: { kleur: "#888", label: "⚖ Wisselvallig" },
  };
  const c = config[profiel];
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-sm font-bold"
      style={{ background: `${c.kleur}22`, color: c.kleur, border: `1px solid ${c.kleur}` }}
    >
      {c.label}
    </span>
  );
}

function ProfielKaart({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: BLAUW_LICHT }}
    >
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#8aa8d0" }}>{label}</div>
      <div className="font-bold text-sm" style={{ color: GOUD }}>{waarde}</div>
    </div>
  );
}

// ============================================================
// Hoofd-component
// ============================================================
export default function T4SportsDashboard() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { toast } = useToast();

  const [uitlegOpen, setUitlegOpen] = useState(false);
  const [actUitlegIdx, setActUitlegIdx] = useState(0);
  const [chatVraag, setChatVraag] = useState("");
  const [chatAntwoord, setChatAntwoord] = useState<string | null>(null);
  const [chatBezig, setChatBezig] = useState(false);
  const [bibliotheekOpen, setBibliotheekOpen] = useState(false);
  const [podcastsOpen, setPodcastsOpen] = useState(false);

  // Dashboard data
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/t4sports/dashboard", token],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4sports/dashboard/${token}`);
      return res.json();
    },
    enabled: !!token,
  });

  // Uitleg script
  const { data: uitleg } = useQuery<UitlegScript>({
    queryKey: ["/api/t4sports/dashboard", token, "uitleg"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4sports/dashboard/${token}/uitleg`);
      return res.json();
    },
    enabled: !!token && uitlegOpen,
  });

  // Bibliotheek
  const { data: bibliotheek } = useQuery<BibliotheekItem[]>({
    queryKey: ["/api/t4sports/dashboard", token, "bibliotheek"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4sports/dashboard/${token}/bibliotheek`);
      return res.json();
    },
    enabled: !!token && bibliotheekOpen,
  });

  // Podcasts
  const { data: podcasts } = useQuery<PodcastItem[]>({
    queryKey: ["/api/t4sports/dashboard", token, "podcasts"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4sports/dashboard/${token}/podcasts`);
      return res.json();
    },
    enabled: !!token && podcastsOpen,
  });

  async function stuurChatVraag() {
    if (!chatVraag.trim()) return;
    setChatBezig(true);
    try {
      const res = await apiRequest("POST", `/api/t4sports/dashboard/${token}/chat`, {
        vraag: chatVraag.trim(),
      });
      const d: any = await res.json();
      setChatAntwoord(d.antwoord ?? "Geen antwoord ontvangen.");
    } catch {
      setChatAntwoord("De AI-coach is momenteel niet bereikbaar. Probeer het later opnieuw.");
    } finally {
      setChatBezig(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}>
        <div style={{ color: GOUD }} className="text-xl font-bold animate-pulse">
          Profiel laden...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}>
        <div className="text-center px-6">
          <div className="text-white text-xl font-bold mb-3">Profiel niet gevonden</div>
          <p className="text-blue-200 text-sm">
            Controleer de link of neem contact op met je mental coach.
          </p>
        </div>
      </div>
    );
  }

  const voornaam = data.naam.split(" ")[0] || "Atleet";

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>

      {/* HEADER */}
      <div className="px-6 py-10" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #162852 100%)` }}>
        <div className="max-w-2xl mx-auto">
          <div style={{ color: GOUD }} className="text-xs font-bold tracking-widest uppercase mb-3">
            T4Sports · Mental Talent Profiel
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">{data.naam}</h1>
          <p className="text-blue-300 text-sm">
            {data.sporttak ?? "—"}{data.ploeg ? ` · ${data.ploeg}` : ""}{data.rol ? ` · ${data.rol}` : ""}
          </p>
          <p className="text-blue-400 text-xs mt-1">Profiel gegenereerd op {formatDatum(data.datum)}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* SPORTPROFIEL SAMENVATTING */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: NAVY }}>
          <div className="px-6 py-5">
            <h2 className="font-bold text-white mb-4">Je Sportprofiel</h2>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <ProfielKaart label="Talent-focus" waarde={data.dominanteFocus} />
              <ProfielKaart label="Versneller" waarde={data.dominanteVersneller} />
              <ProfielKaart label="Driver" waarde={data.dominanteDriver} />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <DrukBadge profiel={data.drukProfiel} />
              {data.energieProfiel && (
                <EnergiBadge
                  waarde={data.energieProfiel}
                  label={`Energie: ${data.energieProfiel}`}
                />
              )}
              {data.normalizedEnergy !== null && (
                <span className="text-xs" style={{ color: "#8aa8d0" }}>
                  {data.normalizedEnergy.toFixed(1)}/10 mentale energie
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DRUKPROFIEL UITLEG */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <h2 className="font-bold mb-3" style={{ color: NAVY }}>Jouw Drukprofiel</h2>
          <DrukBadge profiel={data.drukProfiel} />
          <p className="text-gray-600 text-sm mt-3 leading-relaxed">
            {data.drukProfiel === "gaspedaal" &&
              "Jouw driver werkt als een gaspedaal: in kritieke momenten accelereer je. Druk maakt jou scherper. Dat is een zeldzame kracht."}
            {data.drukProfiel === "rem" &&
              "Jouw driver werkt op dit moment als een rem: in kritieke momenten dreigt je energie te blokkeren. Mental coaching kan dit ombuigen."}
            {data.drukProfiel === "wisselvallig" &&
              "Jouw drukprofiel is wisselvallig: soms gaspedaal, soms rem. De sleutel is bewustzijn — weten wanneer welke modus actief is."}
          </p>
        </div>

        {/* RAPPORT */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <h2 className="font-bold mb-3" style={{ color: NAVY }}>Volledig Rapport</h2>
          <p className="text-gray-500 text-sm mb-4">
            Jouw gedetailleerde T4Sports Mental Talent Profiel — alle constructs, scores en coaching-aanwijzingen.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a
              href={data.rapportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: NAVY, color: GOUD }}
            >
              <ExternalLink className="h-4 w-4" />
              Bekijk rapport
            </a>
            <a
              href={data.downloadUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <Download className="h-4 w-4" />
              Download HTML
            </a>
          </div>
        </div>

        {/* GESPROKEN UITLEG */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${GOUD}22` }}
            >
              <Mic className="h-5 w-5" style={{ color: GOUD }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: NAVY }}>Gesproken Profieluitleg</h2>
              <p className="text-gray-400 text-xs">6 blokken over jouw mentaal profiel</p>
            </div>
          </div>
          {!uitlegOpen ? (
            <Button
              onClick={() => setUitlegOpen(true)}
              className="w-full font-bold"
              style={{ background: NAVY, color: GOUD }}
            >
              Beluister je profiel
            </Button>
          ) : (
            <div>
              {uitleg?.blokken && uitleg.blokken.length > 0 ? (
                <div>
                  <div
                    className="rounded-xl p-4 mb-4"
                    style={{ background: `${NAVY}0d` }}
                  >
                    <div style={{ color: GOUD }} className="text-xs font-bold uppercase tracking-wide mb-1">
                      {uitleg.blokken[actUitlegIdx]?.titel}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                      {uitleg.blokken[actUitlegIdx]?.tekst}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActUitlegIdx(Math.max(0, actUitlegIdx - 1))}
                      disabled={actUitlegIdx === 0}
                    >
                      ←
                    </Button>
                    <span className="text-xs text-gray-400 flex-1 text-center">
                      {actUitlegIdx + 1} / {uitleg.blokken.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActUitlegIdx(Math.min(uitleg.blokken.length - 1, actUitlegIdx + 1))}
                      disabled={actUitlegIdx === uitleg.blokken.length - 1}
                    >
                      →
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Uitleg laden...</p>
              )}
            </div>
          )}
        </div>

        {/* AI-COACH CHAT */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${GOUD}22` }}
            >
              <MessageSquare className="h-5 w-5" style={{ color: GOUD }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: NAVY }}>AI Mental Coach</h2>
              <p className="text-gray-400 text-xs">Stel een vraag gebaseerd op jouw profiel</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={chatVraag}
              onChange={(e) => setChatVraag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !chatBezig && stuurChatVraag()}
              placeholder={`Stel een vraag aan je mental coach, ${voornaam}...`}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400"
            />
            <Button
              onClick={stuurChatVraag}
              disabled={chatBezig || !chatVraag.trim()}
              style={{ background: NAVY, color: GOUD }}
              className="font-bold px-4"
            >
              {chatBezig ? "..." : "→"}
            </Button>
          </div>
          {chatAntwoord && (
            <div
              className="rounded-xl p-4 text-sm text-gray-700 leading-relaxed"
              style={{ background: `${NAVY}08` }}
            >
              {chatAntwoord}
            </div>
          )}
        </div>

        {/* BIBLIOTHEEK */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${GOUD}22` }}
              >
                <BookOpen className="h-5 w-5" style={{ color: GOUD }} />
              </div>
              <div>
                <h2 className="font-bold" style={{ color: NAVY }}>Jouw Boekenlijst</h2>
                <p className="text-gray-400 text-xs">Geselecteerd op basis van jouw profiel</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBibliotheekOpen(!bibliotheekOpen)}
            >
              {bibliotheekOpen ? "Sluiten" : "Bekijk"}
            </Button>
          </div>
          {bibliotheekOpen && (
            <div className="space-y-4 mt-4">
              {bibliotheek ? bibliotheek.slice(0, 5).map((b, i) => (
                <div key={i} className="border-l-2 pl-4" style={{ borderColor: GOUD }}>
                  <div className="font-semibold text-sm" style={{ color: NAVY }}>{b.titel}</div>
                  <div className="text-gray-400 text-xs mb-1">{b.auteur} ({b.jaar})</div>
                  <p className="text-gray-600 text-xs leading-relaxed">{b.beschrijving}</p>
                  {b.url && (
                    <a href={b.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium mt-1 inline-block"
                      style={{ color: GOUD }}>
                      Meer info →
                    </a>
                  )}
                </div>
              )) : <p className="text-gray-400 text-sm">Laden...</p>}
            </div>
          )}
        </div>

        {/* PODCASTS */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${GOUD}22` }}
              >
                <Mic className="h-5 w-5" style={{ color: GOUD }} />
              </div>
              <div>
                <h2 className="font-bold" style={{ color: NAVY }}>Jouw Podcast-aanbevelingen</h2>
                <p className="text-gray-400 text-xs">Op basis van jouw driver-profiel</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPodcastsOpen(!podcastsOpen)}
            >
              {podcastsOpen ? "Sluiten" : "Bekijk"}
            </Button>
          </div>
          {podcastsOpen && (
            <div className="space-y-4 mt-4">
              {podcasts ? podcasts.slice(0, 5).map((p, i) => (
                <div key={i} className="border-l-2 pl-4" style={{ borderColor: `${GOUD}66` }}>
                  <div className="font-semibold text-sm" style={{ color: NAVY }}>{p.naam}</div>
                  <div className="text-gray-400 text-xs mb-1">{p.podcast}{p.aflevering ? ` · ${p.aflevering}` : ""}</div>
                  <p className="text-gray-600 text-xs leading-relaxed">{p.beschrijving}</p>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium mt-1 inline-block"
                      style={{ color: GOUD }}>
                      Beluisteren →
                    </a>
                  )}
                </div>
              )) : <p className="text-gray-400 text-sm">Laden...</p>}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="text-center py-6">
          <p className="text-gray-400 text-xs">
            T4Sports Mental Talent Profiel v1.0.0 · TaPas Platform
          </p>
          <p className="text-gray-300 text-xs mt-1">
            Dit profiel is vertrouwelijk en bedoeld voor persoonlijk gebruik in een coaching-context.
          </p>
        </div>

      </div>
    </div>
  );
}
