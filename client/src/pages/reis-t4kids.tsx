// ---------------------------------------------------------------------------
// client/src/pages/reis-t4kids.tsx — NIEUW BESTAND (strikt additief).
//
// De kindvriendelijke belevings-UX voor T4Kids (10-13 jaar): een echte
// ontdekkingsreis langs drie eilanden (= de 3 modules van het instrument).
// Geen scores, geen tijdsdruk, vrije eilandvolgorde, "sla over"/"stop"-opties.
//
// Deze route (/reis/:id) staat volledig los van het generieke deel1-pad; enkel
// afnames met instrumentId "t4kids" landen hier (via deelnemer.tsx). De reis
// submit uiteindelijk naar dezelfde endpoints als elke afname:
//   POST /api/afnames/:id/main        { responses }
//   POST /api/afnames/:id/connection  { answers, keuzes }
// waarna buildT4KidsContract server-side het rapport bouwt en de reis naar
// /afname/:id/t4kids-rapport navigeert (het nieuwe rijke T4Kids-rapport).
//
// Deze versie is een GROTE presentatie-make-over (Deel A van de blauwdruk):
//   • grote sfeervolle reiskaart met 3 duidelijk zichtbare eilanden;
//   • per eiland een eigen immersieve achtergrond (CSS-gradients + decor);
//   • archetypen als grote aardappel-beeldkaarten (manifest → afbeelding);
//   • keuzewoorden/"waarom" verschijnen BOVENAAN (nieuwste eerst);
//   • gamified met framer-motion, badges en micro-animaties.
// De data-flow is ONgewijzigd — enkel de presentatie is nieuw.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Afname, BlockAnswer } from "@/lib/types";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";

// ── Vorm van het /api/vragenlijst/tapas-t4kids-antwoord (additief modules-veld).
interface InteressePaarView {
  id: string;
  links: { tekst: string };
  rechts: { tekst: string };
}
interface ArchetypeView {
  id: string;
  naam: string;
}
interface StellingView {
  id: string;
  tekst: string;
}
interface T4KidsView {
  name: string;
  modules: [
    { id: string; naam: string; uitleg: string; paren: InteressePaarView[] },
    {
      id: string;
      naam: string;
      uitleg: string;
      maxKeuze: number;
      topN: number;
      archetypen: ArchetypeView[];
    },
    {
      id: string;
      naam: string;
      uitleg: string;
      schaal: { waarde: number; label: string }[];
      stellingen: StellingView[];
    },
  ];
}

interface ManifestEntry { naam: string; focus: string; bestand: string; emoji: string }
interface Manifest { archetypen: Record<string, ManifestEntry> }

const leegAntwoord = (): BlockAnswer => ({
  most: null,
  least: null,
  itemEnergy: { most: null, least: null },
  blockEnergy: null,
});

// Fisher-Yates — itemvolgorde per eiland randomiseren (belevingswaarde).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Fase = "assent" | "kaart" | "eiland1" | "eiland2" | "eiland3";

// ── Eiland-thema's (elk een eigen kleurwereld + immersieve achtergrond) ──────
interface EilandThema {
  korteNaam: string;
  gradient: string; // achtergrond van het eilandscherm
  accent: string; // knop/rand-accent
  scene: React.ReactNode; // grote eiland-illustratie (SVG)
  decor: React.ReactNode; // sfeer-decor voor het eilandscherm
}

function PalmEiland() {
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36 drop-shadow-lg sm:h-40 sm:w-40">
      <ellipse cx="80" cy="132" rx="60" ry="14" fill="#38bdf8" opacity="0.5" />
      <path d="M28 132 Q80 100 132 132 Z" fill="#fcd34d" />
      <path d="M40 132 Q80 112 120 132" fill="#fbbf24" />
      <g stroke="#065f46" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M80 118 Q84 90 82 66" />
      </g>
      <g fill="#10b981">
        <path d="M82 64 Q54 52 40 64 Q60 60 82 72 Z" />
        <path d="M82 64 Q110 52 124 66 Q104 60 82 72 Z" />
        <path d="M82 62 Q70 40 58 34 Q74 46 84 66 Z" />
        <path d="M82 62 Q94 40 106 34 Q90 46 80 66 Z" />
      </g>
      <circle cx="122" cy="40" r="14" fill="#fde68a" />
    </svg>
  );
}
function KasteelEiland() {
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36 drop-shadow-lg sm:h-40 sm:w-40">
      <ellipse cx="80" cy="134" rx="58" ry="13" fill="#c4b5fd" opacity="0.6" />
      <path d="M30 134 Q80 108 130 134 Z" fill="#a78bfa" />
      <g fill="#7c3aed">
        <rect x="56" y="72" width="48" height="50" rx="3" />
        <rect x="48" y="60" width="14" height="62" />
        <rect x="98" y="60" width="14" height="62" />
        <rect x="74" y="48" width="12" height="74" />
      </g>
      <g fill="#5b21b6">
        <rect x="47" y="54" width="6" height="8" /><rect x="55" y="54" width="6" height="8" />
        <rect x="97" y="54" width="6" height="8" /><rect x="105" y="54" width="6" height="8" />
      </g>
      <polygon points="80,30 86,48 74,48" fill="#f472b6" />
      <rect x="72" y="98" width="16" height="24" rx="8" fill="#4c1d95" />
      <circle cx="122" cy="40" r="12" fill="#fde68a" />
    </svg>
  );
}
function RegenboogEiland() {
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36 drop-shadow-lg sm:h-40 sm:w-40">
      <ellipse cx="80" cy="134" rx="58" ry="13" fill="#fca5a5" opacity="0.55" />
      <path d="M32 134 Q80 110 128 134 Z" fill="#34d399" />
      <g fill="none" strokeWidth="9" strokeLinecap="round">
        <path d="M40 118 A40 40 0 0 1 120 118" stroke="#f87171" />
        <path d="M50 118 A30 30 0 0 1 110 118" stroke="#fbbf24" />
        <path d="M60 118 A20 20 0 0 1 100 118" stroke="#34d399" />
        <path d="M70 118 A10 10 0 0 1 90 118" stroke="#60a5fa" />
      </g>
      <circle cx="126" cy="42" r="12" fill="#fde68a" />
      <g fill="#ffffff" opacity="0.85">
        <circle cx="40" cy="52" r="8" /><circle cx="52" cy="52" r="10" /><circle cx="30" cy="52" r="7" />
      </g>
    </svg>
  );
}

const THEMAS: EilandThema[] = [
  {
    korteNaam: "Het Keuze-eiland",
    gradient: "from-sky-200 via-cyan-100 to-teal-100",
    accent: "#0d9488",
    scene: <PalmEiland />,
    decor: (
      <>
        <div className="pointer-events-none absolute left-6 top-8 h-12 w-24 rounded-full bg-white/70 blur-[1px]" />
        <div className="pointer-events-none absolute right-10 top-16 h-8 w-16 rounded-full bg-white/60 blur-[1px]" />
        <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-60" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 40 Q 180 10 360 40 T 720 40 T 1080 40 T 1440 40 V80 H0 Z" fill="#5eead4" />
        </svg>
      </>
    ),
  },
  {
    korteNaam: "Het Figuren-eiland",
    gradient: "from-violet-200 via-purple-100 to-fuchsia-100",
    accent: "#7c3aed",
    scene: <KasteelEiland />,
    decor: (
      <>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute text-2xl opacity-70"
            style={{ left: `${8 + i * 15}%`, top: `${6 + (i % 3) * 10}%` }}
          >
            ✨
          </div>
        ))}
      </>
    ),
  },
  {
    korteNaam: "Het Zo-ben-ik-eiland",
    gradient: "from-amber-100 via-rose-100 to-teal-100",
    accent: "#0d9488",
    scene: <RegenboogEiland />,
    decor: (
      <>
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute text-xl opacity-70"
            style={{ left: `${6 + i * 13}%`, top: `${8 + (i % 4) * 9}%` }}
          >
            ⭐
          </div>
        ))}
      </>
    ),
  },
];

export default function ReisT4Kids() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [fase, setFase] = useState<Fase>("assent");
  const [voltooid, setVoltooid] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [badge, setBadge] = useState<number | null>(null);

  // Antwoorden per module.
  const [interesse, setInteresse] = useState<Record<string, "links" | "rechts">>({});
  const [gekozen, setGekozen] = useState<string[]>([]); // archetype-ids
  const [waarom, setWaarom] = useState<Record<string, string>>({});
  const [top3, setTop3] = useState<string[]>([]);
  const [schaal, setSchaal] = useState<Record<string, number>>({});

  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);

  const { data: view, isLoading } = useQuery<T4KidsView>({
    queryKey: ["/api/vragenlijst/tapas-t4kids", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vragenlijst/tapas-t4kids?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });

  // Aardappel-illustraties voor de archetypen (manifest → afbeelding).
  const { data: manifest } = useQuery<Manifest>({
    queryKey: ["t4kids-archetypen-manifest"],
    queryFn: async () => {
      const res = await fetch("/t4kids/archetypen/manifest.json");
      if (!res.ok) throw new Error("manifest niet gevonden");
      return res.json();
    },
  });
  const beeldVoor = (aid: string): string | null => {
    const e = manifest?.archetypen?.[aid];
    return e ? `/t4kids/archetypen/${e.bestand}` : null;
  };

  const m1 = view?.modules[0];
  const m2 = view?.modules[1];
  const m3 = view?.modules[2];

  // Randomiseer één keer per geladen view.
  const parenGemengd = useMemo(() => (m1 ? shuffle(m1.paren) : []), [m1]);
  const archetypenGemengd = useMemo(() => (m2 ? shuffle(m2.archetypen) : []), [m2]);
  const stellingenGemengd = useMemo(() => (m3 ? shuffle(m3.stellingen) : []), [m3]);

  const naam = (view?.name ?? afname?.name ?? "").trim().split(/\s+/)[0] || "ontdekker";

  // Badge-animatie automatisch laten verdwijnen.
  useEffect(() => {
    if (badge === null) return;
    const t = setTimeout(() => setBadge(null), 1800);
    return () => clearTimeout(t);
  }, [badge]);

  function markeerVoltooid(nr: number) {
    setVoltooid((prev) => new Set(prev).add(nr));
    setBadge(nr);
    setFase("kaart");
  }

  function toggleArchetype(aid: string) {
    setGekozen((prev) => {
      if (prev.includes(aid)) {
        setTop3((t) => t.filter((x) => x !== aid));
        return prev.filter((x) => x !== aid);
      }
      if (m2 && prev.length >= m2.maxKeuze) return prev;
      return [...prev, aid];
    });
  }

  function toggleTop3(aid: string) {
    setTop3((prev) => {
      if (prev.includes(aid)) return prev.filter((x) => x !== aid);
      if (m2 && prev.length >= m2.topN) return prev;
      return [...prev, aid];
    });
  }

  async function rondAf() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Bouw de responses in de blockResponse-vorm die de server verwacht.
      const responses: Record<string, BlockAnswer> = {};
      for (const [pairId, kant] of Object.entries(interesse)) {
        responses[pairId] = { ...leegAntwoord(), most: kant };
      }
      for (const [stId, waarde] of Object.entries(schaal)) {
        responses[stId] = { ...leegAntwoord(), blockEnergy: waarde };
      }

      await apiRequest("POST", `/api/afnames/${id}/main`, { responses });

      const keuzes = {
        archetypen: gekozen.map((aid) => ({ id: aid, waarom: waarom[aid] ?? "" })),
        top3,
      };
      // answers q1..q4 zijn schema-verplicht; voor T4Kids neutraal (geen 0-10-schaal
      // in de kind-UX). keuzes reist additief mee en wordt server-side gelezen.
      await apiRequest("POST", `/api/afnames/${id}/connection`, {
        answers: { q1: 5, q2: 5, q3: 5, q4: 5 },
        keuzes,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      navigate(`/afname/${id}/t4kids-rapport`);
    } catch (e: any) {
      toast({
        title: "Oeps, dat lukte niet",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  // ── Reeds voltooide afname niet opnieuw laten invullen ─────────────────────
  if (afname?.status === "voltooid") {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-sky-100 to-amber-50">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-800">Je reis zit erop!</h1>
          <p className="mt-2 text-[17px] text-slate-600">Je hebt de ontdekkingsreis al helemaal afgemaakt. Goed gedaan!</p>
          <Button className="mt-6 bg-teal-600 hover:bg-teal-700" onClick={() => navigate(`/afname/${id}/t4kids-rapport`)}>
            Bekijk mijn talenten-boekje 📖
          </Button>
        </main>
      </div>
    );
  }

  if (isLoading || !view || !m1 || !m2 || !m3) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-sky-100 to-amber-50">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const eilanden = [m1, m2, m3];
  const themaVan = (nr: number) => THEMAS[nr - 1]!;
  const huidigNr = fase === "eiland1" ? 1 : fase === "eiland2" ? 2 : fase === "eiland3" ? 3 : 0;
  const eilandGradient = huidigNr ? themaVan(huidigNr).gradient : "from-sky-100 via-teal-50 to-amber-50";

  return (
    <div className={`min-h-[100dvh] bg-gradient-to-b ${eilandGradient} transition-colors duration-500`}>
      <AppHeader right={<span className="text-sm text-slate-500">🧭 T4Kids Ontdekkingsreis</span>} />

      {/* Badge-animatie bij voltooiing van een eiland */}
      <AnimatePresence>
        {badge !== null && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30 grid place-items-center"
          >
            <div className="rounded-3xl bg-white/95 px-8 py-6 text-center shadow-2xl ring-2 ring-amber-300">
              <div className="text-6xl">🏅</div>
              <p className="mt-2 text-lg font-bold text-teal-800">Eiland bezocht!</p>
              <p className="text-sm text-slate-500">Vlaggetje geplant 🚩</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* ── Assent-scherm ─────────────────────────────────────────────── */}
        {fase === "assent" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-3xl border-2 border-teal-200 bg-white/85 p-8 text-center shadow-lg">
              <div className="text-7xl">🧭</div>
              <h1 className="mt-4 text-3xl font-black text-slate-800" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
                Hoi {naam}! Klaar voor de ontdekkingsreis?
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[17px] text-slate-600">
                Je gaat op reis langs <strong>drie eilanden</strong>. Op elk eiland kies je gewoon wat
                het best bij jou past. Er zijn <strong>geen foute antwoorden</strong>, en je mag altijd
                iets overslaan of stoppen. Je bepaalt zelf welk eiland je eerst bezoekt.
              </p>
              <Button
                size="lg"
                className="mt-6 bg-teal-600 text-lg hover:bg-teal-700"
                onClick={() => setFase("kaart")}
                data-testid="button-start-reis"
              >
                Start mijn reis! 🚀
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Reiskaart (eilandkiezer) ──────────────────────────────────── */}
        {fase === "kaart" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-center text-3xl font-black text-slate-800" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
              Jouw reiskaart
            </h1>
            <p className="mt-2 text-center text-[17px] text-slate-600">
              Kies een eiland om te bezoeken. Je mag ze in elke volgorde doen.
            </p>

            {/* Sfeervolle kaart met zee, paadjes en 3 grote eilanden */}
            <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-b from-sky-300 via-cyan-200 to-teal-200 p-4 shadow-lg ring-1 ring-white/50 sm:p-6">
              {/* wolken */}
              <div className="pointer-events-none absolute left-8 top-6 h-10 w-24 rounded-full bg-white/70 blur-[1px]" />
              <div className="pointer-events-none absolute right-12 top-10 h-8 w-20 rounded-full bg-white/60 blur-[1px]" />
              {/* kronkelend paadje */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M15 30 Q50 10 50 50 T85 72" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />
              </svg>

              <div className="relative grid gap-4 sm:grid-cols-3">
                {eilanden.map((eiland, i) => {
                  const nr = i + 1;
                  const thema = THEMAS[i]!;
                  const klaar = voltooid.has(nr);
                  const voortgang =
                    nr === 1 ? `${Object.keys(interesse).length}/${m1.paren.length} gekozen`
                    : nr === 2 ? `${gekozen.length} figuren gekozen`
                    : `${Object.keys(schaal).length}/${m3.stellingen.length} beantwoord`;
                  return (
                    <motion.button
                      key={eiland.id}
                      type="button"
                      whileHover={{ scale: 1.03, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFase(`eiland${nr}` as Fase)}
                      className={`relative flex flex-col items-center rounded-3xl border-2 bg-white/85 p-4 text-center shadow-md transition ${
                        klaar ? "border-emerald-400" : "border-white/70 hover:border-teal-300"
                      }`}
                      data-testid={`kaart-eiland-${nr}`}
                    >
                      {klaar && (
                        <span className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-lg text-white shadow">
                          ✓
                        </span>
                      )}
                      {thema.scene}
                      <p className="mt-2 text-base font-bold text-slate-800">{thema.korteNaam}</p>
                      <p className="text-xs text-slate-500">{eiland.naam}</p>
                      <p className="mt-2 inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800">
                        {klaar ? "🚩 Bezocht" : voortgang}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                variant={voltooid.size > 0 ? "default" : "outline"}
                className={voltooid.size > 0 ? "bg-amber-500 text-lg hover:bg-amber-600" : ""}
                onClick={rondAf}
                disabled={submitting}
                data-testid="button-rond-af"
              >
                {submitting ? "Bezig…" : "Rond mijn reis af 🏁"}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Je mag afronden wanneer je wil — ook als je niet alle eilanden bezocht hebt.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Eiland 1 — Ontdekkingsreis (forced-choice) ────────────────── */}
        {fase === "eiland1" && (
          <IslandShell thema={themaVan(1)} naam={m1.naam} uitleg={m1.uitleg}
            voortgang={`${Object.keys(interesse).length}/${m1.paren.length} gekozen`}>
            <div className="mt-6 space-y-4">
              {parenGemengd.map((paar, idx) => (
                <motion.div
                  key={paar.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-2xl border-2 border-white/70 bg-white/85 p-4 shadow-sm"
                >
                  <p className="mb-2 text-center text-sm font-medium text-slate-400">Wat doe je het liefst?</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["links", "rechts"] as const).map((kant) => {
                      const gekozenKant = interesse[paar.id] === kant;
                      const tekst = kant === "links" ? paar.links.tekst : paar.rechts.tekst;
                      return (
                        <button
                          key={kant}
                          type="button"
                          onClick={() => setInteresse((p) => ({ ...p, [paar.id]: kant }))}
                          className={`rounded-xl border-2 p-4 text-left text-base transition ${
                            gekozenKant
                              ? "border-teal-500 bg-teal-100 font-semibold text-teal-900 shadow-inner"
                              : "border-slate-200 bg-white text-slate-800 hover:border-teal-300 hover:bg-teal-50"
                          }`}
                          data-testid={`keuze-${paar.id}-${kant}`}
                        >
                          {gekozenKant ? "✓ " : ""}{tekst}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
            <IslandFooter accent={themaVan(1).accent} onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(1)} />
          </IslandShell>
        )}

        {/* ── Eiland 2 — Galerij (archetypen als beeldkaarten) ──────────── */}
        {fase === "eiland2" && (
          <IslandShell thema={themaVan(2)} naam={m2.naam} uitleg={m2.uitleg}
            voortgang={`${gekozen.length}/${m2.maxKeuze} gekozen`}>

            {/* Keuzewoorden/"waarom" BOVENAAN (nieuwste eerst) */}
            {gekozen.length > 0 && (
              <div className="mt-5 rounded-2xl border-2 border-purple-200 bg-white/90 p-4 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800">Waarom passen deze bij jou?</h3>
                <p className="text-sm text-slate-500">Je laatst gekozen figuur staat bovenaan.</p>
                <div className="mt-3 space-y-3">
                  {[...gekozen].reverse().map((aid) => {
                    const a = m2.archetypen.find((x) => x.id === aid);
                    const src = beeldVoor(aid);
                    return (
                      <div key={aid} className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                        {src ? (
                          <img src={src} alt={a?.naam ?? ""} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white text-2xl">🥔</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold capitalize text-purple-900">{a?.naam}</p>
                          <Textarea
                            rows={2}
                            placeholder="Waarom vind je dit leuk?"
                            value={waarom[aid] ?? ""}
                            onChange={(e) => setWaarom((p) => ({ ...p, [aid]: e.target.value }))}
                            className="mt-1 border-slate-300 bg-white text-[15px] text-slate-800 placeholder:text-slate-400"
                            data-testid={`waarom-${aid}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top-N ranking */}
                <h3 className="mt-5 font-bold text-slate-800">
                  Kies je top {m2.topN}: wat wil je NU het liefst zijn? ({top3.length}/{m2.topN})
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {gekozen.map((aid) => {
                    const a = m2.archetypen.find((x) => x.id === aid);
                    const rang = top3.indexOf(aid);
                    return (
                      <button
                        key={aid}
                        type="button"
                        onClick={() => toggleTop3(aid)}
                        className={`rounded-full border-2 px-4 py-2 text-sm capitalize transition ${
                          rang >= 0
                            ? "border-amber-500 bg-amber-100 font-semibold text-amber-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"
                        }`}
                        data-testid={`top3-${aid}`}
                      >
                        {rang >= 0 ? `${rang + 1}. ` : ""}
                        {a?.naam}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Galerij van grote aardappel-beeldkaarten */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {archetypenGemengd.map((a) => {
                const isGekozen = gekozen.includes(a.id);
                const src = beeldVoor(a.id);
                const rang = top3.indexOf(a.id);
                return (
                  <motion.button
                    key={a.id}
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleArchetype(a.id)}
                    className={`relative overflow-hidden rounded-2xl border-4 bg-white text-center shadow-sm transition ${
                      isGekozen ? "border-purple-500 ring-2 ring-purple-200" : "border-transparent hover:border-purple-200"
                    }`}
                    data-testid={`archetype-${a.id}`}
                  >
                    {isGekozen && (
                      <span className="absolute left-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-purple-600 text-sm text-white shadow">
                        ✓
                      </span>
                    )}
                    {rang >= 0 && (
                      <span className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-sm font-black text-white shadow">
                        {rang + 1}
                      </span>
                    )}
                    {src ? (
                      <img src={src} alt={a.naam} className="aspect-square w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid aspect-square w-full place-items-center bg-purple-50 text-5xl">🥔</div>
                    )}
                    <p className="p-2 text-sm font-semibold capitalize text-slate-800">{a.naam}</p>
                  </motion.button>
                );
              })}
            </div>

            <IslandFooter accent={themaVan(2).accent} onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(2)} />
          </IslandShell>
        )}

        {/* ── Eiland 3 — Zo ben ik nu (woordschaal) ─────────────────────── */}
        {fase === "eiland3" && (
          <IslandShell thema={themaVan(3)} naam={m3.naam} uitleg={m3.uitleg}
            voortgang={`${Object.keys(schaal).length}/${m3.stellingen.length} beantwoord`}>
            <div className="mt-6 space-y-4">
              {stellingenGemengd.map((st, idx) => (
                <motion.div
                  key={st.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-2xl border-2 border-white/70 bg-white/85 p-4 shadow-sm"
                >
                  <p className="text-base text-slate-800">{st.tekst}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {m3.schaal.map((opt) => {
                      const gekozenOpt = schaal[st.id] === opt.waarde;
                      return (
                        <button
                          key={opt.waarde}
                          type="button"
                          onClick={() => setSchaal((p) => ({ ...p, [st.id]: opt.waarde }))}
                          className={`rounded-lg border-2 px-2 py-2 text-sm transition ${
                            gekozenOpt
                              ? "border-teal-500 bg-teal-100 font-semibold text-teal-900 shadow-inner"
                              : "border-slate-200 bg-white text-slate-800 hover:border-teal-300"
                          }`}
                          data-testid={`schaal-${st.id}-${opt.waarde}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
            <IslandFooter accent={themaVan(3).accent} onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(3)} />
          </IslandShell>
        )}
      </main>
    </div>
  );
}

// Immersief eilandscherm: eigen achtergrond-decor + grote scene in de kop.
function IslandShell({
  thema,
  naam,
  uitleg,
  voortgang,
  children,
}: {
  thema: EilandThema;
  naam: string;
  uitleg: string;
  voortgang: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${thema.gradient} p-5 shadow-lg ring-1 ring-white/50 sm:p-7`}>
        {thema.decor}
        <div className="relative text-center">
          <div className="mx-auto flex justify-center">{thema.scene}</div>
          <h1 className="mt-1 text-2xl font-black text-slate-800 sm:text-3xl" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
            {naam}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[16px] text-slate-700">{uitleg}</p>
          <span className="mt-3 inline-block rounded-full bg-white/80 px-4 py-1 text-sm font-medium text-slate-700 shadow-sm">
            {voortgang}
          </span>
        </div>
        <div className="relative">{children}</div>
      </div>
    </motion.div>
  );
}

function IslandFooter({ accent, onKaart, onKlaar }: { accent: string; onKaart: () => void; onKlaar: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <Button variant="outline" onClick={onKaart} data-testid="button-terug-kaart">
        ← Terug naar de kaart
      </Button>
      <Button
        style={{ backgroundColor: accent }}
        className="text-white hover:opacity-90"
        onClick={onKlaar}
        data-testid="button-eiland-klaar"
      >
        Klaar met dit eiland ✓
      </Button>
    </div>
  );
}
