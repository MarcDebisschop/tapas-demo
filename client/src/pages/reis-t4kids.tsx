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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Afname, BlockAnswer } from "@/lib/types";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";
import { ISLAND_PALETTES, TAPPIE_SRC } from "@/pages/t4kids/palette";

// Tappie-mascotte: subtiel "zwevend", respecteert prefers-reduced-motion.
function Tappie({
  size = 80,
  bob = true,
  className = "",
}: {
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const zweef = bob && !reduced;
  return (
    <motion.img
      src={TAPPIE_SRC}
      alt="Tappie, jouw reisgids"
      style={{ width: size, height: size }}
      className={`select-none object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] ${className}`}
      draggable={false}
      animate={zweef ? { y: [0, -8, 0] } : undefined}
      transition={zweef ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : undefined}
    />
  );
}

// Aanmoedigende Tappie-zin per eiland (letterlijk uit de brief).
const TAPPIE_EILAND_ZIN = [
  "Kies gewoon wat jij het leukst vindt — er is geen fout antwoord!",
  "In welke figuren zie jij jezelf? Ik kan er ook allemaal eentje worden!",
  "Nog even volhouden — dit vertelt veel over hoe jij dingen aanpakt!",
];

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

type Fase = "assent" | "kaart" | "eiland1" | "eiland2" | "eiland3" | "afronden";

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
    <svg viewBox="0 0 160 160" className="h-28 w-28 drop-shadow-lg sm:h-32 sm:w-32">
      <ellipse cx="80" cy="132" rx="60" ry="14" fill="#0E7490" opacity="0.7" />
      <path d="M28 132 Q80 100 132 132 Z" fill="#0E7490" />
      <path d="M40 132 Q80 112 120 132" fill="#06B6D4" />
      <g stroke="#0B1220" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M80 118 Q84 90 82 66" />
      </g>
      <g fill="#06B6D4">
        <path d="M82 64 Q54 52 40 64 Q60 60 82 72 Z" />
        <path d="M82 64 Q110 52 124 66 Q104 60 82 72 Z" />
        <path d="M82 62 Q70 40 58 34 Q74 46 84 66 Z" />
        <path d="M82 62 Q94 40 106 34 Q90 46 80 66 Z" />
      </g>
      <circle cx="122" cy="40" r="14" fill="#F97316" />
    </svg>
  );
}
function KasteelEiland() {
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28 drop-shadow-lg sm:h-32 sm:w-32">
      <ellipse cx="80" cy="134" rx="58" ry="13" fill="#7C3AED" opacity="0.7" />
      <path d="M30 134 Q80 108 130 134 Z" fill="#6D28D9" />
      <g fill="#7C3AED">
        <rect x="56" y="72" width="48" height="50" rx="3" />
        <rect x="48" y="60" width="14" height="62" />
        <rect x="98" y="60" width="14" height="62" />
        <rect x="74" y="48" width="12" height="74" />
      </g>
      <g fill="#0B1220">
        <rect x="47" y="54" width="6" height="8" /><rect x="55" y="54" width="6" height="8" />
        <rect x="97" y="54" width="6" height="8" /><rect x="105" y="54" width="6" height="8" />
      </g>
      <polygon points="80,30 86,48 74,48" fill="#EC4899" />
      <rect x="72" y="98" width="16" height="24" rx="8" fill="#0B1220" />
      <circle cx="122" cy="40" r="12" fill="#EC4899" />
    </svg>
  );
}
function RegenboogEiland() {
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28 drop-shadow-lg sm:h-32 sm:w-32">
      <ellipse cx="80" cy="134" rx="58" ry="13" fill="#F97316" opacity="0.65" />
      <path d="M32 134 Q80 110 128 134 Z" fill="#EA580C" />
      <g fill="none" strokeWidth="9" strokeLinecap="round">
        <path d="M40 118 A40 40 0 0 1 120 118" stroke="#F97316" />
        <path d="M50 118 A30 30 0 0 1 110 118" stroke="#EC4899" />
        <path d="M60 118 A20 20 0 0 1 100 118" stroke="#7C3AED" />
        <path d="M70 118 A10 10 0 0 1 90 118" stroke="#06B6D4" />
      </g>
      <circle cx="126" cy="42" r="12" fill="#F97316" />
      <g fill="#F8FAFC" opacity="0.9">
        <circle cx="40" cy="52" r="8" /><circle cx="52" cy="52" r="10" /><circle cx="30" cy="52" r="7" />
      </g>
    </svg>
  );
}

const THEMAS: EilandThema[] = [
  {
    korteNaam: ISLAND_PALETTES[0]!.korteNaam,
    gradient: ISLAND_PALETTES[0]!.gradient,
    accent: ISLAND_PALETTES[0]!.accent,
    scene: <PalmEiland />,
    decor: (
      <>
        <div className="pointer-events-none absolute left-6 top-8 h-12 w-24 rounded-full bg-cyan-400/20 blur-md" />
        <div className="pointer-events-none absolute right-10 top-16 h-8 w-16 rounded-full bg-cyan-300/20 blur-md" />
        <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-30" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 40 Q 180 10 360 40 T 720 40 T 1080 40 T 1440 40 V80 H0 Z" fill="#06B6D4" />
        </svg>
      </>
    ),
  },
  {
    korteNaam: ISLAND_PALETTES[1]!.korteNaam,
    gradient: ISLAND_PALETTES[1]!.gradient,
    accent: ISLAND_PALETTES[1]!.accent,
    scene: <KasteelEiland />,
    decor: (
      <>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute text-2xl opacity-40"
            style={{ left: `${8 + i * 15}%`, top: `${6 + (i % 3) * 10}%` }}
          >
            ✨
          </div>
        ))}
      </>
    ),
  },
  {
    korteNaam: ISLAND_PALETTES[2]!.korteNaam,
    gradient: ISLAND_PALETTES[2]!.gradient,
    accent: ISLAND_PALETTES[2]!.accent,
    scene: <RegenboogEiland />,
    decor: (
      <>
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute text-xl opacity-40"
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

  // Naam van het kind komt uit de afname (view?.name is de instrument-titel, niet de invuller).
  const naam = (afname?.name ?? "").trim().split(/\s+/)[0] || "ontdekker";

  // Leeftijdspoort (AVG art. 8): T4Kids vereist altijd een leeftijdsband en
  // ouderlijke toestemming. Zolang de afname nog laadt tonen we niets extra.
  const poortOntbreekt = !!afname && (!afname.leeftijdsband || !afname.ouderlijkeToestemming);

  // Tappie-bevestiging tonen, dan automatisch terug naar de kaart.
  useEffect(() => {
    if (badge === null) return;
    const naarKaart = setTimeout(() => setFase("kaart"), 1200);
    const weg = setTimeout(() => setBadge(null), 1900);
    return () => {
      clearTimeout(naarKaart);
      clearTimeout(weg);
    };
  }, [badge]);

  function markeerVoltooid(nr: number) {
    setVoltooid((prev) => new Set(prev).add(nr));
    setBadge(nr);
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
      <div className="min-h-[100dvh] bg-gradient-to-b from-cyan-600 via-violet-700 to-slate-900">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="flex justify-center">
            <Tappie size={120} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">Je reis zit erop!</h1>
          <p className="mt-2 text-[17px] text-slate-200">Je hebt de ontdekkingsreis al helemaal afgemaakt. Goed gedaan!</p>
          <Button className="mt-6 bg-cyan-500 font-bold text-slate-900 hover:bg-cyan-400" onClick={() => navigate(`/afname/${id}/t4kids-rapport`)}>
            Bekijk mijn talenten-boekje 📖
          </Button>
        </main>
      </div>
    );
  }

  if (isLoading || !view || !m1 || !m2 || !m3) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-cyan-600 via-violet-700 to-slate-900">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Skeleton className="h-64 w-full bg-white/10" />
        </main>
      </div>
    );
  }

  const eilanden = [m1, m2, m3];
  const themaVan = (nr: number) => THEMAS[nr - 1]!;
  const huidigNr = fase === "eiland1" ? 1 : fase === "eiland2" ? 2 : fase === "eiland3" ? 3 : 0;
  const eilandGradient = huidigNr
    ? themaVan(huidigNr).gradient
    : "from-cyan-600 via-violet-700 to-slate-900";

  return (
    <div className={`min-h-[100dvh] bg-gradient-to-b ${eilandGradient} transition-colors duration-500`}>
      <AppHeader right={<span className="text-sm text-cyan-200">🧭 T4Kids Ontdekkingsreis</span>} />

      {/* Tappie-bevestiging bij het afronden van een eiland */}
      <AnimatePresence>
        {badge !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30 grid place-items-center bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="flex max-w-sm flex-col items-center rounded-3xl bg-slate-900 px-8 py-6 text-center shadow-2xl ring-2 ring-cyan-400"
            >
              <Tappie size={92} bob={false} />
              <p className="mt-3 text-lg font-black text-lime-400">Top! Eiland afgerond ✓</p>
              <p className="mt-1 text-sm text-slate-200">Tappie brengt je terug naar de kaart</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* ── Assent-scherm ─────────────────────────────────────────────── */}
        {fase === "assent" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-3xl border border-cyan-400/40 bg-slate-900/70 p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur">
              <div className="flex justify-center">
                <Tappie size={132} />
              </div>
              <h1 className="mt-4 text-3xl font-black text-white" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
                Hoi {naam}! Klaar voor de ontdekkingsreis?
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[17px] text-slate-200">
                Ik ben <strong className="text-cyan-300">Tappie</strong>, jouw reisgids! Je gaat op reis langs{" "}
                <strong>drie eilanden</strong>. Op elk eiland kies je gewoon wat het best bij jou past. Er zijn{" "}
                <strong>geen foute antwoorden</strong>, en je mag altijd iets overslaan of stoppen. Je bepaalt
                zelf welk eiland je eerst bezoekt.
              </p>
              {/* Leeftijdspoort (AVG art. 8): zonder leeftijdsband en ouderlijke
                  toestemming op de afname gaat de reis niet verder. De server
                  weigert zo'n afname al bij het aanmaken; dit is de zichtbare,
                  vriendelijke bevestiging voor het kind. */}
              {poortOntbreekt ? (
                <p className="mt-6 text-[17px] font-bold text-amber-300" data-testid="text-poort-ontbreekt">
                  Voor deze reis moet een ouder of voogd eerst toestemming geven. Vraag je begeleider
                  om de reis samen met je ouder opnieuw te starten.
                </p>
              ) : (
                <Button
                  size="lg"
                  className="mt-6 bg-cyan-500 text-lg font-bold text-slate-900 hover:bg-cyan-400"
                  onClick={() => setFase("kaart")}
                  data-testid="button-start-reis"
                >
                  Start mijn reis! 🚀
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Reiskaart (eilandkiezer) ──────────────────────────────────── */}
        {fase === "kaart" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Tappie-begroeting bovenaan de reiskaart */}
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-cyan-400/40 bg-slate-900/70 p-5 shadow-xl ring-1 ring-white/10 backdrop-blur sm:flex-row sm:items-center sm:text-left">
              <Tappie size={92} className="shrink-0" />
              <div>
                <p className="text-[17px] leading-relaxed text-slate-100">
                  Hoi, ik ben <strong className="text-cyan-300">Tappie</strong>! Ik ben jouw reisgids. Samen
                  trekken we langs drie eilanden. Kies maar een eiland om te starten — je mag ze in elke
                  volgorde doen. Ik moedig je onderweg aan! 🧭
                </p>
                <p className="mt-2 text-sm italic text-slate-300">
                  Tappie kan élke gedaante aannemen: detective, uitvinder, kunstenaar… net zoals jij veel
                  talenten in je hebt.
                </p>
              </div>
            </div>

            <h1 className="mt-8 text-center text-3xl font-black text-white" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
              Jouw reiskaart
            </h1>
            <p className="mt-2 text-center text-[17px] text-slate-200">
              Kies een eiland om te bezoeken. Je mag ze in elke volgorde doen.
            </p>

            {/* Sfeervolle kaart met zee, paadjes en 3 grote eilanden */}
            <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-[#0B1220] p-4 shadow-2xl ring-1 ring-cyan-400/30 sm:p-6">
              {/* gloed */}
              <div className="pointer-events-none absolute left-8 top-6 h-10 w-24 rounded-full bg-cyan-400/15 blur-xl" />
              <div className="pointer-events-none absolute right-12 top-10 h-8 w-20 rounded-full bg-violet-500/15 blur-xl" />
              {/* kronkelend paadje */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M15 30 Q50 10 50 50 T85 72" fill="none" stroke="#06B6D4" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.6" />
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
                      className={`relative flex flex-col items-center rounded-3xl border-2 p-4 text-center shadow-lg transition ${
                        klaar
                          ? "border-lime-400 bg-slate-800/90"
                          : "border-white/10 bg-slate-800/80 hover:border-cyan-400"
                      }`}
                      data-testid={`kaart-eiland-${nr}`}
                    >
                      {klaar && (
                        <span className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-lime-500 text-lg font-black text-slate-900 shadow">
                          ✓
                        </span>
                      )}
                      {thema.scene}
                      <p className="mt-2 text-base font-black text-white">{thema.korteNaam}</p>
                      <p className="text-xs text-slate-400">{eiland.naam}</p>
                      <p
                        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          klaar
                            ? "bg-lime-400/20 text-lime-300 ring-1 ring-lime-400/40"
                            : "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
                        }`}
                      >
                        {klaar ? "✓ Afgerond" : voortgang}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                className={
                  voltooid.size > 0
                    ? "bg-orange-500 text-lg font-bold text-white hover:bg-orange-400"
                    : "border-2 border-white/30 bg-transparent text-lg text-white hover:bg-white/10"
                }
                onClick={() => setFase("afronden")}
                data-testid="button-rond-af"
              >
                Rond mijn reis af 🏁
              </Button>
              <p className="mt-2 text-xs text-slate-300">
                Je mag afronden wanneer je wil — ook als je niet alle eilanden bezocht hebt.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Eiland 1 — Ontdekkingsreis (forced-choice) ────────────────── */}
        {fase === "eiland1" && (
          <IslandShell thema={themaVan(1)} naam={m1.naam} uitleg={m1.uitleg}
            tappieZin={TAPPIE_EILAND_ZIN[0]!}
            voortgang={`${Object.keys(interesse).length}/${m1.paren.length} gekozen`}>
            <div className="mt-6 space-y-4">
              {parenGemengd.map((paar, idx) => (
                <motion.div
                  key={paar.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-2xl border border-white/10 bg-[#F5F7FA] p-4 shadow-md"
                >
                  <p className="mb-2 text-center text-sm font-medium text-slate-500">Wat doe je het liefst?</p>
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
                              ? "border-cyan-500 bg-cyan-50 font-semibold text-cyan-900 shadow-inner"
                              : "border-slate-200 bg-white text-slate-800 hover:border-cyan-400 hover:bg-cyan-50/50"
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
            tappieZin={TAPPIE_EILAND_ZIN[1]!}
            voortgang={`${gekozen.length}/${m2.maxKeuze} gekozen`}>

            {/* Keuzewoorden/"waarom" BOVENAAN (nieuwste eerst) */}
            {gekozen.length > 0 && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#F5F7FA] p-4 shadow-md">
                <h3 className="text-lg font-bold text-slate-800">Waarom passen deze bij jou?</h3>
                <p className="text-sm text-slate-500">Je laatst gekozen figuur staat bovenaan.</p>
                <div className="mt-3 space-y-3">
                  {[...gekozen].reverse().map((aid) => {
                    const a = m2.archetypen.find((x) => x.id === aid);
                    const src = beeldVoor(aid);
                    return (
                      <div key={aid} className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                        {src ? (
                          <img src={src} alt={a?.naam ?? ""} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <img src={TAPPIE_SRC} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain p-1" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold capitalize text-violet-900">{a?.naam}</p>
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
                            ? "border-orange-500 bg-orange-100 font-semibold text-orange-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
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
                      isGekozen ? "border-violet-500 ring-2 ring-violet-300" : "border-transparent hover:border-violet-300"
                    }`}
                    data-testid={`archetype-${a.id}`}
                  >
                    {isGekozen && (
                      <span className="absolute left-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-violet-600 text-sm text-white shadow">
                        ✓
                      </span>
                    )}
                    {rang >= 0 && (
                      <span className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-sm font-black text-white shadow">
                        {rang + 1}
                      </span>
                    )}
                    {src ? (
                      <img src={src} alt={a.naam} className="aspect-square w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid aspect-square w-full place-items-center bg-violet-50 p-4">
                        <img src={TAPPIE_SRC} alt="" className="h-full w-full object-contain" />
                      </div>
                    )}
                    <p className="p-2 text-sm font-semibold capitalize text-slate-800">{a.naam}</p>
                  </motion.button>
                );
              })}
            </div>

            <IslandFooter
              accent={themaVan(2).accent}
              onKaart={() => setFase("kaart")}
              onKlaar={() => markeerVoltooid(2)}
              hint="Klaar met kiezen? Sluit dit eiland af met de knop hieronder ✓."
            />
          </IslandShell>
        )}

        {/* ── Eiland 3 — Zo ben ik nu (woordschaal) ─────────────────────── */}
        {fase === "eiland3" && (
          <IslandShell thema={themaVan(3)} naam={m3.naam} uitleg={m3.uitleg}
            tappieZin={TAPPIE_EILAND_ZIN[2]!}
            voortgang={`${Object.keys(schaal).length}/${m3.stellingen.length} beantwoord`}>
            <div className="mt-6 space-y-4">
              {stellingenGemengd.map((st, idx) => (
                <motion.div
                  key={st.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-2xl border border-white/10 bg-[#F5F7FA] p-4 shadow-md"
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
                              ? "border-orange-500 bg-orange-100 font-semibold text-orange-900 shadow-inner"
                              : "border-slate-200 bg-white text-slate-800 hover:border-orange-300"
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

        {/* ── Afronden — Tappie-afscheidsscherm ─────────────────────────── */}
        {fase === "afronden" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-cyan-400/40 bg-slate-900/80 p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur sm:p-12">
              <div className="flex justify-center">
                <Tappie size={150} />
              </div>
              <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
                Bedankt voor je reis, {naam}! 🎉
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-slate-200">
                Ik ben trots op je. Ik neem nu al jouw keuzes mee en maak er jouw persoonlijke
                talenten-boekje van. Klik op de knop hieronder om alles goed af te sluiten en je boekje te
                openen.
              </p>
              <Button
                size="lg"
                className="mt-8 bg-orange-500 px-8 py-6 text-lg font-black text-white shadow-lg ring-2 ring-white/30 hover:bg-orange-400"
                onClick={rondAf}
                disabled={submitting}
                data-testid="button-sluit-af"
              >
                {submitting ? "Bezig met verwerken…" : "Sluit af & open mijn boekje 📖"}
              </Button>
              {!submitting && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setFase("kaart")}
                    className="text-sm font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
                    data-testid="button-terug-kaart-afronden"
                  >
                    ← Nog even terug naar de kaart
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// Immersief eilandscherm: eigen achtergrond-decor + Tappie-gids in de kop.
function IslandShell({
  thema,
  naam,
  uitleg,
  voortgang,
  tappieZin,
  children,
}: {
  thema: EilandThema;
  naam: string;
  uitleg: string;
  voortgang: string;
  tappieZin: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${thema.gradient} p-5 shadow-2xl ring-1 ring-white/10 sm:p-7`}>
        {thema.decor}
        <div className="relative text-center">
          <div className="mx-auto flex items-center justify-center gap-3">
            <Tappie size={72} className="shrink-0" />
            {thema.scene}
          </div>
          <h1 className="mt-1 text-2xl font-black text-white drop-shadow sm:text-3xl" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
            {naam}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[16px] text-slate-100">{uitleg}</p>
          <p className="mx-auto mt-3 max-w-xl rounded-2xl bg-slate-900/50 px-4 py-2 text-[15px] text-white ring-1 ring-white/15">
            Tappie zegt: <em>{tappieZin}</em>
          </p>
          <span className="mt-3 inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-white ring-1 ring-white/20">
            {voortgang}
          </span>
        </div>
        <div className="relative">{children}</div>
      </div>
    </motion.div>
  );
}

function IslandFooter({
  accent,
  onKaart,
  onKlaar,
  hint,
}: {
  accent: string;
  onKaart: () => void;
  onKlaar: () => void;
  hint?: string;
}) {
  return (
    <div className="mt-8">
      {hint && (
        <p className="mb-3 text-center text-[15px] font-medium text-white">{hint}</p>
      )}
      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onKaart}
          className="text-sm font-medium text-white/80 underline-offset-2 hover:text-white hover:underline"
          data-testid="button-terug-kaart"
        >
          ← Terug naar de kaart
        </button>
        <Button
          size="lg"
          style={{ backgroundColor: accent }}
          className="w-full px-8 py-6 text-lg font-black text-white shadow-lg ring-2 ring-white/30 hover:opacity-90 sm:w-auto"
          onClick={onKlaar}
          data-testid="button-eiland-klaar"
        >
          Klaar met dit eiland ✓
        </Button>
      </div>
    </div>
  );
}
