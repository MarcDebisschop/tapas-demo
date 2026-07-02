// =============================================================================
// lounge.tsx — EXACT overgenomen uit tapas-zip-8 bundle (index-CxFhBwUz.js)
// Geen interpretaties. Alle data-arrays, classNames, structuur en tekst zijn verbatim.
//
// Symbool mapping (minified → leesbaar):
//   a.jsx / a.jsxs  → JSX (React)
//   j.useState etc  → React hooks
//   ni()            → useLocation (wouter)
//   St              → AppHeader
//   Ti              → Sparkles (lucide)
//   Wn              → ArrowRight (lucide)
//   ml              → ArrowLeft (lucide)
//   Tb              → Pause (lucide)
//   sm (icon)       → Play (lucide)
//   boe             → Wind (lucide)
//   W4              → BookOpen (lucide)
//   fK              → Music2 (lucide)
//   coe             → ShoppingBag (lucide)
//   rK              → Coffee (lucide)
//   eoe             → Image (lucide)
//   hK              → PenTool (lucide)
//   m3              → Sun (lucide)
//   aoe             → NotebookPen (lucide)
//   Xr              → LOUNGE_VAR (CSS variabele naam)
//   or              → LOUNGE_KLEUR (hsl waarde)
//   Bre             → KAMERS (kamer array)
//   K8e             → (auth wrapper — vervangen door fragment)
//   W8e             → (login modal — niet gebruikt in demo)
//   G8e             → (lid status — niet gebruikt in demo)
//   eh()            → (auth context — niet gebruikt in demo)
// =============================================================================

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/Brand";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Pause,
  Play,
  Wind,
  BookOpen,
  Music2,
  ShoppingBag,
  Coffee,
  Image,
  PenTool,
  Sun,
  NotebookPen,
  Radio,
  Languages,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TALEN, TAAL_NAMEN, TAAL_CODES, normaliseerTaal } from "@shared/i18n";
import { useUiTaal } from "@/contexts/TaalContext";

// =============================================================================
// CSS variabelen en kleur (verbatim uit bundle: const Xr="--lounge", or=...)
// =============================================================================
const LOUNGE_VAR = "--lounge";
const LOUNGE_KLEUR = `hsl(var(${LOUNGE_VAR}))`;

// =============================================================================
// Kamer array (verbatim uit bundle: const Bre=[...])
// icon-namen vervangen door geïmporteerde Lucide componenten
// =============================================================================
const KAMERS = [
  { id: "stilte",         naam_key: "lounge_kamer_stilte_naam",         eyebrow_key: "lounge_kamer_stilte_eyebrow",         korte_key: "lounge_kamer_stilte_korte",         icon: Wind         },
  { id: "studie",         naam_key: "lounge_kamer_studie_naam",         eyebrow_key: "lounge_kamer_studie_eyebrow",         korte_key: "lounge_kamer_studie_korte",         icon: BookOpen     },
  { id: "muziek",         naam_key: "lounge_kamer_muziek_naam",         eyebrow_key: "lounge_kamer_muziek_eyebrow",         korte_key: "lounge_kamer_muziek_korte",         icon: Music2       },
  { id: "webshop",        naam_key: "lounge_kamer_webshop_naam",        eyebrow_key: "lounge_kamer_webshop_eyebrow",        korte_key: "lounge_kamer_webshop_korte",        icon: ShoppingBag  },
  { id: "talentencafe",   naam_key: "lounge_kamer_talentencafe_naam",   eyebrow_key: "lounge_kamer_talentencafe_eyebrow",   korte_key: "lounge_kamer_talentencafe_korte",   icon: Coffee       },
  { id: "inspiratiewand", naam_key: "lounge_kamer_inspiratiewand_naam", eyebrow_key: "lounge_kamer_inspiratiewand_eyebrow", korte_key: "lounge_kamer_inspiratiewand_korte", icon: Image        },
  { id: "werkplaats",     naam_key: "lounge_kamer_werkplaats_naam",     eyebrow_key: "lounge_kamer_werkplaats_eyebrow",     korte_key: "lounge_kamer_werkplaats_korte",     icon: PenTool      },
  { id: "reflectie",      naam_key: "lounge_kamer_reflectie_naam",      eyebrow_key: "lounge_kamer_reflectie_eyebrow",      korte_key: "lounge_kamer_reflectie_korte",      icon: NotebookPen  },
  { id: "terras",         naam_key: "lounge_kamer_terras_naam",         eyebrow_key: "lounge_kamer_terras_eyebrow",         korte_key: "lounge_kamer_terras_korte",         icon: Sun          },
];

// =============================================================================
// Adem oefeningen (verbatim uit bundle: const X$=[...])
// =============================================================================
const ADEM_OEFENINGEN = [
  { naam_key: "lounge_adem_oef_vierkant_naam", omschr_key: "lounge_adem_oef_vierkant_omschr", in: 4, vast: 4, uit: 4, rust: 4 },
  { naam_key: "lounge_adem_oef_verlengd_naam", omschr_key: "lounge_adem_oef_verlengd_omschr", in: 4, vast: 0, uit: 6, rust: 0 },
  { naam_key: "lounge_adem_oef_golf_naam",     omschr_key: "lounge_adem_oef_golf_omschr",     in: 5, vast: 0, uit: 5, rust: 0 },
];

// =============================================================================
// Meditatie data (verbatim uit bundle: const Px={...})
// =============================================================================
const MEDITATIE_STAP_KEYS = [
  { kop_key: "lounge_meditatie_stap1_kop", tekst_key: "lounge_meditatie_stap1_tekst" },
  { kop_key: "lounge_meditatie_stap2_kop", tekst_key: "lounge_meditatie_stap2_tekst" },
  { kop_key: "lounge_meditatie_stap3_kop", tekst_key: "lounge_meditatie_stap3_tekst" },
  { kop_key: "lounge_meditatie_stap4_kop", tekst_key: "lounge_meditatie_stap4_tekst" },
  { kop_key: "lounge_meditatie_stap5_kop", tekst_key: "lounge_meditatie_stap5_tekst" },
];

// =============================================================================
// Radio config (behouden uit vorige versie)
// =============================================================================
const RADIO_STREAMS = [
  "https://stream.radiomediterranea.com:8160/lounge.mp3",
  "https://de.auroramedia.am/jazz.mp3",
];

// =============================================================================
// Helper componenten (verbatim uit bundle)
// =============================================================================

// Ru — eyebrow label
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: LOUNGE_KLEUR }}>
      {children}
    </p>
  );
}

// gF — sectie header
function SectieHeader({ eyebrow, titel, intro }: { eyebrow: string; titel: string; intro: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.15]">
        {titel}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{intro}</p>
    </div>
  );
}

// aA — kaart container
function KaartContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-t-[3px] border-border p-5 sm:p-6 ${className}`}
      style={{
        borderTopColor: LOUNGE_KLEUR,
        background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.10) 0%, hsl(var(--card)) 60%)`,
      }}
    >
      {children}
    </div>
  );
}

// GP — badge
function LoungebBadge({ tekst }: { tekst: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
      style={{
        color: LOUNGE_KLEUR,
        borderColor: `hsl(var(${LOUNGE_VAR})/0.4)`,
        background: `hsl(var(${LOUNGE_VAR})/0.10)`,
      }}
    >
      <Sparkles className="h-3 w-3" />
      {tekst}
    </span>
  );
}

// =============================================================================
// WereldNav: taalkiezer (gedeeld/gepersisteerd) + terug-naar-voordeur
// Exact patroon overgenomen van werk.tsx
// =============================================================================
function WereldNav() {
  const [, navigate] = useLocation();
  const { uiTaal, setUiTaal, t } = useUiTaal();

  function handleTerug() {
    navigate("/");
  }

  return (
    <div className="flex items-center gap-2">
      <RadioKnop />
      <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
        <SelectTrigger
          className="h-9 w-auto gap-1.5 px-2.5"
          data-testid="select-ui-taal"
          aria-label={t("taal_kiezer_label")}
        >
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
      <button
        type="button"
        onClick={handleTerug}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[13px] text-muted-foreground transition hover:text-foreground"
        data-testid="button-voordeur"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("wereld_nav_voordeur")}
      </button>
    </div>
  );
}

// =============================================================================
// Ademhaling animatie (verbatim uit bundle: function iHe)
// =============================================================================
function AdemhalingAnimatie({ oefening }: { oefening: typeof ADEM_OEFENINGEN[0] }) {
  const { t } = useUiTaal();

  const stappen = [
    { label: t("lounge_adem_in"),   labelKey: "lounge_adem_in",   sec: oefening.in   },
    { label: t("lounge_adem_vast"), labelKey: "lounge_adem_vast", sec: oefening.vast  },
    { label: t("lounge_adem_uit"),  labelKey: "lounge_adem_uit",  sec: oefening.uit   },
    { label: t("lounge_adem_rust"), labelKey: "lounge_adem_rust", sec: oefening.rust  },
  ].filter((s) => s.sec > 0);

  const [actief, setActief] = useState(false);
  const [stapIdx, setStapIdx] = useState(0);
  const [secOver, setSecOver] = useState(stappen[0].sec);

  useEffect(() => {
    setStapIdx(0);
    setSecOver(stappen[0].sec);
    setActief(false);
  }, [oefening.naam_key]);

  useEffect(() => {
    if (!actief) return;
    const interval = window.setInterval(() => {
      setSecOver((p) => {
        if (p > 1) return p - 1;
        setStapIdx((v) => (v + 1) % stappen.length);
        return stappen[(stapIdx + 1) % stappen.length].sec;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [actief, stapIdx]);

  const huidigeStp = stappen[stapIdx];
  const isIn  = huidigeStp.labelKey === "lounge_adem_in";
  const isUit = huidigeStp.labelKey === "lounge_adem_uit";
  const schaal = actief ? (isIn ? 1 : isUit ? 0.7 : stapIdx === 1 ? 1 : 0.7) : 0.78;

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid h-56 w-56 place-items-center">
        <div
          aria-hidden="true"
          className="absolute h-48 w-48 rounded-full ease-in-out"
          style={{
            transform: `scale(${schaal})`,
            background: `hsl(var(${LOUNGE_VAR})/0.16)`,
            transition: "transform 1000ms ease-in-out",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute h-48 w-48 rounded-full border-2 ease-in-out"
          style={{
            transform: `scale(${schaal})`,
            borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`,
            transition: "transform 1000ms ease-in-out",
          }}
        />
        <div className="relative text-center">
          <p className="font-serif text-xl font-semibold text-foreground">
            {actief ? huidigeStp.label : t("lounge_adem_klaar")}
          </p>
          {actief && (
            <p className="mt-1 font-mono text-3xl tabular-nums" style={{ color: LOUNGE_KLEUR }}>
              {secOver}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActief((v) => !v)}
        data-testid="button-adem-start"
        className="mt-5 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition"
        style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
      >
        {actief ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {actief ? t("lounge_adem_pauzeer") : t("lounge_adem_begin")}
      </button>
    </div>
  );
}

// =============================================================================
// Meditatie audio speler (verbatim uit bundle: function aHe)
// =============================================================================
function MeditatieSPeler() {
  const { t } = useUiTaal();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);
  const [tijd, setTijd] = useState(0);
  const [duur, setDuur] = useState(0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    speelt ? el.pause() : el.play();
  }

  function formatTijd(d: number) {
    if (!isFinite(d)) return "0:00";
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const voortgang = duur ? (tijd / duur) * 100 : 0;

  return (
    <div>
      <audio
        ref={audioRef}
        src="/lounge/audio/meditatie-stilte.mp3"
        loop
        preload="metadata"
        onPlay={() => setSpeelt(true)}
        onPause={() => setSpeelt(false)}
        onTimeUpdate={(e) => setTijd(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuur(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          data-testid="button-meditatie-muziek"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-background transition hover:scale-105"
          style={{ background: LOUNGE_KLEUR }}
          aria-label={speelt ? t("lounge_meditatie_muziek_pauzeer") : t("lounge_meditatie_muziek_speel")}
        >
          {speelt ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-serif text-sm font-semibold text-foreground">
              {t("lounge_klankschaal_naam")}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatTijd(tijd)} / {formatTijd(duur)}
            </p>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${voortgang}%`, background: LOUNGE_KLEUR }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("lounge_klankschaal_beschr")}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Stilte Kamer (verbatim uit bundle: function sHe)
// =============================================================================
function StilteKamer() {
  const { t } = useUiTaal();
  const [oefeningIdx, setOefeningIdx] = useState(0);
  const oefening = ADEM_OEFENINGEN[oefeningIdx];
  const [meditatieTonen, setMeditatieTonen] = useState(false);

  return (
    <div>
      <SectieHeader
        eyebrow={t("lounge_stilte_eyebrow")}
        titel={t("lounge_stilte_titel")}
        intro={t("lounge_stilte_intro")}
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/stiltekamer.jpg"
          alt={t("lounge_stilte_img_alt")}
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <KaartContainer>
          <Eyebrow>{t("lounge_adem_eyebrow")}</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{t("lounge_adem_titel")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("lounge_adem_beschrijving")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ADEM_OEFENINGEN.map((o, idx) => {
              const actief = idx === oefeningIdx;
              return (
                <button
                  key={o.naam_key}
                  type="button"
                  onClick={() => setOefeningIdx(idx)}
                  data-testid={`adem-${t(o.naam_key)}`}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={
                    actief
                      ? { color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.6)`, background: `hsl(var(${LOUNGE_VAR})/0.12)` }
                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                  }
                >
                  {t(o.naam_key)}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">{t(oefening.omschr_key)}</p>
          <div className="mt-5">
            <AdemhalingAnimatie oefening={oefening} />
          </div>
        </KaartContainer>
        <div className="space-y-4">
          <KaartContainer>
            <Eyebrow>{t("lounge_mediteer_eyebrow")}</Eyebrow>
            <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{t("lounge_mediteer_titel")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("lounge_meditatie_intro")}</p>
            <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
              <MeditatieSPeler />
            </div>
            <button
              type="button"
              onClick={() => setMeditatieTonen((v) => !v)}
              data-testid="button-meditatie-open"
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
              style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
            >
              {meditatieTonen ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {meditatieTonen ? t("lounge_meditatie_knop_sluit") : `${t("lounge_meditatie_knop_lees")} — ${t("lounge_meditatie_titel")}`}
            </button>
            {meditatieTonen && (
              <div className="mt-4" data-testid="meditatie-stappen">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
                  {t("lounge_meditatie_titel")} · {t("lounge_meditatie_duur")}
                </p>
                <ol className="mt-3 space-y-3">
                  {MEDITATIE_STAP_KEYS.map((stap, i) => (
                    <li key={stap.kop_key} className="rounded-xl border border-border bg-card/60 p-4">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs tabular-nums" style={{ color: LOUNGE_KLEUR }}>
                          {(i + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="font-serif text-base font-semibold text-foreground">{t(stap.kop_key)}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(stap.tekst_key)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </KaartContainer>
          <KaartContainer>
            <Eyebrow>{t("lounge_gewoon_eyebrow")}</Eyebrow>
            <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{t("lounge_gewoon_titel")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("lounge_gewoon_tekst")}
            </p>
          </KaartContainer>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Generieke kamer — open voor demo, met zachte lidmaatschapsteaser onderaan.
// In de live versie worden de inhoud-secties vervangen door echte content per kamer.
// =============================================================================
function KamerKomTerug({ titel, eyebrow, intro, img, imgAlt }: {
  titel: string; eyebrow: string; intro: string; img?: string; imgAlt?: string;
}) {
  const { t } = useUiTaal();
  return (
    <div>
      <SectieHeader eyebrow={eyebrow} titel={titel} intro={intro} />
      {img && (
        <div className="mt-7 overflow-hidden rounded-2xl border border-border">
          <img src={img} alt={imgAlt || titel} className="h-60 w-full object-cover sm:h-72" loading="lazy" />
        </div>
      )}

      {/* Demo inhoud — toegankelijk voor iedereen */}
      <div className="mt-8 space-y-6">
        <KaartContainer>
          <Eyebrow>{t("lounge_kamer_kom_terug_wat_eyebrow")}</Eyebrow>
          <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{titel}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {intro}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("lounge_kamer_kom_terug_p2")}
          </p>
        </KaartContainer>

        {/* Zachte teaser — geen blokkade, wel uitnodiging */}
        <div
          className="rounded-2xl border border-dashed p-5 text-center"
          style={{
            borderColor: `hsl(var(${LOUNGE_VAR})/0.45)`,
            background: `radial-gradient(120% 120% at 50% 0%, hsl(var(${LOUNGE_VAR})/0.10) 0%, hsl(var(--card)) 70%)`,
          }}
        >
          <LoungebBadge tekst={t("lounge_kamer_tipascity_leden")} />
          <p className="mt-3 max-w-md mx-auto text-sm leading-relaxed text-muted-foreground">
            {t("lounge_kamer_lid_toegang")}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Muziek Kamer (verbatim uit bundle: function uHe)
// =============================================================================
const MUZIEK_COMPOSITIES = [
  {
    naam: "Erik Satie",
    context_key: "lounge_satie_context",
    composities: [
      { titel: "Gymnopédie No. 1",               beschrijving_key: "lounge_gymn1_beschr",   url: "https://www.youtube.com/watch?v=q59H8q7Yo5Q" },
      { titel: "Gymnopédies (complete, No. 1–3)", beschrijving_key: "lounge_gymn123_beschr", url: "https://www.youtube.com/watch?v=aIo66AGh2J8" },
      { titel: "Gnossienne No. 1",                beschrijving_key: "lounge_gnoss1_beschr",  url: "https://www.youtube.com/watch?v=lqZehFAwoTM" },
      { titel: "Gnossienne No. 3",                beschrijving_key: "lounge_gnoss3_beschr",  url: "https://www.youtube.com/watch?v=gQtE401LA_o" },
    ],
  },
];

const TAPAS_LIED_TEKST = [
  { kop_key: "lounge_lied_kop_refrein", regels: ["I am on my way,","not yet where I want to be —","but no longer where I didn't fit.","I fall forward, I don't give up.","What I do as if it's nothing saves someone's day.","I am visible. I am on my way."] },
  { kop_key: "lounge_lied_kop_vers1",   regels: ["Stop a moment in the morning,","there's someone you don't know yet —","the person you could be today,","if you let them in.","Carry your doubts like a coat,","you're allowed to take it off when it grows heavy.","Beneath the lining breathes","a sentence that belongs only to you."] },
  { kop_key: "lounge_lied_kop_brug",    regels: ["And when you stumble — fall forward.","Don't write off the evening, write only this:","I am on my way.","Your talent is already there.","It was waiting for you.","Make yourself visible —","for yourself first, then the world."] },
];

function MuziekKamer() {
  const { t } = useUiTaal();
  const [liedTonen, setLiedTonen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    speelt ? el.pause() : el.play();
  }

  return (
    <div>
      <SectieHeader
        eyebrow={t("lounge_muziek_eyebrow")}
        titel={t("lounge_muziek_titel")}
        intro={t("lounge_muziek_intro")}
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/muziek.jpg"
          alt={t("lounge_muziek_img_alt")}
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 space-y-6">
        <KaartContainer>
          <Eyebrow>{t("lounge_tapas_lied_eyebrow")}</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">On My Way — Zichtbaar</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("lounge_tapas_lied_beschr")}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <audio
              ref={audioRef}
              src="/lounge/audio/on-my-way.mp3"
              onPlay={() => setSpeelt(true)}
              onPause={() => setSpeelt(false)}
            />
            <button
              type="button"
              onClick={toggle}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-background transition hover:scale-105"
              style={{ background: LOUNGE_KLEUR }}
              aria-label={speelt ? t("lounge_muziek_pauzeer_aria") : t("lounge_muziek_speel_aria")}
            >
              {speelt ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div>
              <p className="font-serif text-sm font-semibold text-foreground">On My Way</p>
              <p className="text-[11px] text-muted-foreground">TaPasCity · Zichtbaar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLiedTonen((v) => !v)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium transition"
            style={{ color: LOUNGE_KLEUR }}
          >
            {liedTonen ? t("lounge_lied_verberg") : t("lounge_lied_lees")}
            <ArrowRight className="h-4 w-4" />
          </button>
          {liedTonen && (
            <div className="mt-4 space-y-4">
              {TAPAS_LIED_TEKST.map((sectie) => (
                <div key={sectie.kop_key} className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
                    {t(sectie.kop_key)}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {sectie.regels.map((r, i) => (
                      <p key={i} className="text-sm italic leading-relaxed text-foreground">{r}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KaartContainer>
        {MUZIEK_COMPOSITIES.map((componist) => (
          <KaartContainer key={componist.naam}>
            <Eyebrow>{componist.naam}</Eyebrow>
            <p className="mt-1 text-sm text-muted-foreground">{t(componist.context_key)}</p>
            <div className="mt-4 space-y-3">
              {componist.composities.map((c) => (
                <a
                  key={c.titel}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-xl border border-border p-4 transition hover:border-[--lounge] hover:bg-card/80"
                >
                  <div
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                    style={{ background: `hsl(var(${LOUNGE_VAR})/0.14)`, color: LOUNGE_KLEUR }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-serif text-sm font-semibold text-foreground">{c.titel}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(c.beschrijving_key)}</p>
                  </div>
                </a>
              ))}
            </div>
          </KaartContainer>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Webshop (verbatim uit bundle: function dHe — geïntegreerd met interesse form)
// =============================================================================
function Webshop() {
  const { t } = useUiTaal();

  const WEBSHOP_PRODUCTEN = [
    {
      id: "tapas-business-kompas",
      naam: t("lounge_ws_prod_kompas_naam"),
      prijs: t("lounge_ws_prod_kompas_prijs"),
      beschrijving: t("lounge_ws_prod_kompas_beschr"),
      features: [t("lounge_ws_prod_kompas_f1"), t("lounge_ws_prod_kompas_f2"), t("lounge_ws_prod_kompas_f3"), t("lounge_ws_prod_kompas_f4")],
    },
    {
      id: "amelia-earhart",
      naam: t("lounge_ws_prod_amelia_naam"),
      prijs: t("lounge_ws_prod_amelia_prijs"),
      premium: true,
      beschrijving: t("lounge_ws_prod_amelia_beschr"),
      features: [t("lounge_ws_prod_amelia_f1"), t("lounge_ws_prod_amelia_f2"), t("lounge_ws_prod_amelia_f3"), t("lounge_ws_prod_amelia_f4"), t("lounge_ws_prod_amelia_f5"), t("lounge_ws_prod_amelia_f6"), t("lounge_ws_prod_amelia_f7"), t("lounge_ws_prod_amelia_f8")],
    },
    {
      id: "t4recruitment",
      naam: t("lounge_ws_prod_recr_naam"),
      prijs: t("lounge_ws_prod_recr_prijs"),
      beschrijving: t("lounge_ws_prod_recr_beschr"),
      features: [t("lounge_ws_prod_recr_f1"), t("lounge_ws_prod_recr_f2"), t("lounge_ws_prod_recr_f3"), t("lounge_ws_prod_recr_f4")],
    },
    {
      id: "teamscan",
      naam: t("lounge_ws_prod_team_naam"),
      prijs: t("lounge_ws_prod_team_prijs"),
      beschrijving: t("lounge_ws_prod_team_beschr"),
      features: [t("lounge_ws_prod_team_f1"), t("lounge_ws_prod_team_f2"), t("lounge_ws_prod_team_f3"), t("lounge_ws_prod_team_f4")],
    },
  ];

  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [uitgevouwen, setUitgevouwen] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [bericht, setBericht] = useState("");
  const [verzondenOk, setVerzondenOk] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (!geselecteerd || !naam || !email) return;
    setBezig(true);
    setFout("");
    try {
      const res = await fetch("/api/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam, email, product: geselecteerd, bericht }),
      });
      if (res.ok) {
        setVerzondenOk(true);
      } else {
        setFout(t("lounge_ws_fout"));
      }
    } catch {
      setFout(t("lounge_ws_fout"));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div>
      <SectieHeader
        eyebrow={t("lounge_webshop_eyebrow")}
        titel={t("lounge_webshop_titel")}
        intro={t("lounge_webshop_intro")}
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/webshop.jpg"
          alt={t("lounge_webshop_img_alt")}
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {WEBSHOP_PRODUCTEN.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border border-t-[3px] p-5 transition ${geselecteerd === p.id ? "ring-2" : ""} ${p.premium ? "ring-1 ring-yellow-400/20" : ""}`}
            style={{
              borderTopColor: LOUNGE_KLEUR,
              background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.10) 0%, hsl(var(--card)) 60%)`,
            }}
          >
            {p.premium && (
              <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-yellow-400">
                Premium
              </span>
            )}
            <h3 className="font-serif text-lg font-semibold text-foreground">{p.naam}</h3>
            <p className="mt-0.5 font-mono text-sm" style={{ color: LOUNGE_KLEUR }}>{p.prijs}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.beschrijving}</p>
            <button
              type="button"
              onClick={() => setUitgevouwen(uitgevouwen === p.id ? null : p.id)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium transition"
              style={{ color: LOUNGE_KLEUR }}
            >
              {uitgevouwen === p.id ? t("lounge_ws_verberg_details") : t("lounge_ws_bekijk_details")}
              <ArrowRight className="h-3 w-3" />
            </button>
            {uitgevouwen === p.id && (
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span style={{ color: LOUNGE_KLEUR }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setGeselecteerd(p.id)}
              className="mt-4 w-full rounded-xl border py-2 text-sm font-semibold transition hover:-translate-y-0.5"
              style={
                geselecteerd === p.id
                  ? { color: "hsl(var(--background))", background: LOUNGE_KLEUR, borderColor: LOUNGE_KLEUR }
                  : { color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.08)` }
              }
            >
              {geselecteerd === p.id ? t("lounge_ws_geselecteerd") : t("lounge_ws_interesse")}
            </button>
          </div>
        ))}
      </div>
      {geselecteerd && !verzondenOk && (
        <KaartContainer className="mt-8">
          <Eyebrow>{t("lounge_ws_form_eyebrow")}</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{t("lounge_ws_form_titel")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("lounge_ws_form_intro")}{" "}
            <strong>{WEBSHOP_PRODUCTEN.find((p) => p.id === geselecteerd)?.naam}</strong>.
          </p>
          <form onSubmit={verstuur} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("lounge_ws_label_naam")}</label>
                <input
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  required
                  placeholder={t("lounge_ws_placeholder_naam")}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                  style={{ focusBorderColor: LOUNGE_KLEUR } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("lounge_ws_label_email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("lounge_ws_placeholder_email")}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("lounge_ws_label_bericht")}</label>
              <textarea
                value={bericht}
                onChange={(e) => setBericht(e.target.value)}
                rows={3}
                placeholder={t("lounge_ws_placeholder_bericht")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 resize-none"
              />
            </div>
            {fout && <p className="text-xs text-red-500">{fout}</p>}
            <button
              type="submit"
              disabled={bezig}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-background transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: LOUNGE_KLEUR }}
            >
              {bezig ? t("lounge_ws_versturen") : t("lounge_ws_verstuur_btn")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </KaartContainer>
      )}
      {verzondenOk && (
        <KaartContainer className="mt-8">
          <div className="flex flex-col items-center py-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
              {t("lounge_ws_ontvangen")}
            </p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{t("lounge_ws_bedankt_titel")}</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t("lounge_ws_bedankt_tekst")}
            </p>
          </div>
        </KaartContainer>
      )}
    </div>
  );
}

// =============================================================================
// =============================================================================
// TIP Card Teaser — zichtbaar in het Onthaal als uitnodiging tot lidmaatschap.
// Toont de Evarist Galois TIP-card als visueel voorbeeld + voordelen + CTA.
// =============================================================================
function TipCardTeaser({ gaaNaar }: { gaaNaar?: (id: string) => void }) {
  const { t } = useUiTaal();

  const VOORDELEN = [
    { icon: "✦", tekst: t("lounge_tipcard_voord1") },
    { icon: "✦", tekst: t("lounge_tipcard_voord2") },
    { icon: "✦", tekst: t("lounge_tipcard_voord3") },
    { icon: "✦", tekst: t("lounge_tipcard_voord4") },
    { icon: "✦", tekst: t("lounge_tipcard_voord5") },
    { icon: "✦", tekst: t("lounge_tipcard_voord6") },
  ];

  return (
    <section className="mt-14">
      <div className="text-center">
        <Eyebrow>{t("lounge_tipcard_eyebrow")}</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-xl font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("lounge_tipcard_titel")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("lounge_tipcard_intro")}
        </p>
      </div>

      {/* Visuele TIP card + voordelen naast elkaar */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2 items-start">

        {/* TIP card afbeelding — Evarist Galois als voorbeeld */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-t-[3px] shadow-xl"
            style={{
              borderTopColor: LOUNGE_KLEUR,
              background: `radial-gradient(140% 110% at 0% 0%, hsl(var(${LOUNGE_VAR})/0.18) 0%, hsl(var(--card)) 65%)`,
            }}
          >
            <img
              src="/lounge/img/jester-card.png"
              alt={t("lounge_tipcard_kaart_alt")}
              className="w-full object-contain"
              loading="lazy"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground max-w-xs">
            {t("lounge_tipcard_kaart_caption")}
          </p>
        </div>

        {/* Voordelen + CTA */}
        <div className="flex flex-col gap-5">
          <KaartContainer>
            <Eyebrow>{t("lounge_tipcard_voord_eyebrow")}</Eyebrow>
            <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{t("lounge_tipcard_voord_titel")}</h3>
            <ul className="mt-4 space-y-3">
              {VOORDELEN.map((v, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-base" style={{ color: LOUNGE_KLEUR }}>{v.icon}</span>
                  <span>{v.tekst}</span>
                </li>
              ))}
            </ul>
          </KaartContainer>

          {/* Lidmaatschap info */}
          <div
            className="rounded-2xl border border-dashed p-5"
            style={{
              borderColor: `hsl(var(${LOUNGE_VAR})/0.45)`,
              background: `radial-gradient(120% 120% at 50% 0%, hsl(var(${LOUNGE_VAR})/0.08) 0%, hsl(var(--card)) 70%)`,
            }}
          >
            <Eyebrow>{t("lounge_tipcard_wordlid_eyebrow")}</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("lounge_tipcard_wordlid_p1")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("lounge_tipcard_wordlid_p2")}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-background transition hover:-translate-y-0.5"
              style={{ background: LOUNGE_KLEUR }}
              onClick={() => gaaNaar ? gaaNaar("webshop") : undefined}
            >
              {t("lounge_tipcard_wordlid_cta")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Aanwezigen sectie (verbatim uit bundle: function AHe)
// Vereenvoudigd voor demo — geen live member data
// =============================================================================
function AanwezigenSectie() {
  const { t } = useUiTaal();
  return (
    <div className="mt-5">
      <button
        type="button"
        data-testid="button-entry-lounge"
        className="group relative block w-full overflow-hidden rounded-2xl border border-dashed p-6 text-left transition hover:-translate-y-0.5"
        style={{
          borderColor: `hsl(var(${LOUNGE_VAR})/0.55)`,
          background: `radial-gradient(120% 140% at 50% 0%, hsl(var(${LOUNGE_VAR})/0.14) 0%, hsl(var(--card)) 70%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <LoungebBadge tekst="TaPasCity Live" />
          <p className="text-sm text-muted-foreground">
            {t("lounge_aanwezigen_live")}
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("lounge_aanwezigen_uitleg")}
        </p>
      </button>
    </div>
  );
}

// =============================================================================
// Radio knop (behouden uit vorige versie)
// =============================================================================
function RadioKnop() {
  const { t } = useUiTaal();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);
  const [streamIdx, setStreamIdx] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = RADIO_STREAMS[streamIdx];
    audio.play().catch(() => {});
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (speelt) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        const next = (streamIdx + 1) % RADIO_STREAMS.length;
        setStreamIdx(next);
        audio.src = RADIO_STREAMS[next];
        audio.play().catch(() => {});
      });
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setSpeelt(true)}
        onPause={() => setSpeelt(false)}
        onError={() => {
          const next = (streamIdx + 1) % RADIO_STREAMS.length;
          setStreamIdx(next);
          const audio = audioRef.current;
          if (audio) { audio.src = RADIO_STREAMS[next]; audio.play().catch(() => {}); }
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={speelt ? t("lounge_radio_stop") : t("lounge_radio_speel")}
        title={speelt ? t("lounge_radio_stoppen") : t("lounge_radio_speel")}
        className="grid h-8 w-8 place-items-center rounded-full border transition hover:scale-105"
        style={
          speelt
            ? { background: LOUNGE_KLEUR, color: "hsl(var(--background))", borderColor: LOUNGE_KLEUR }
            : { borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, color: LOUNGE_KLEUR, background: `hsl(var(${LOUNGE_VAR})/0.10)` }
        }
      >
        <Radio className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

// =============================================================================
// Onthaal — hero + kamer grid (verbatim uit bundle: function rHe)
// =============================================================================
function Onthaal({ gaaNaar, gaaNaarWebshop }: { gaaNaar: (id: string) => void; gaaNaarWebshop?: () => void }) {
  const { t } = useUiTaal();
  return (
    <div>
      {/* Hero sectie — verbatim uit rHe */}
      <section className="relative overflow-hidden rounded-3xl border border-border">
        <img
          src="/lounge/img/onthaal.jpg"
          alt={t("lounge_onthaal_img_alt")}
          className="h-[44vh] min-h-[280px] w-full object-cover sm:h-[56vh]"
          loading="eager"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--background)/0.10) 0%, hsl(var(--background)/0.30) 45%, hsl(var(--background)/0.92) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <Eyebrow>{t("lounge_onthaal_eyebrow")}</Eyebrow>
          <h1 className="mt-3 max-w-2xl font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
            {t("lounge_onthaal_titel")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("lounge_onthaal_intro")}
          </p>
        </div>
      </section>

      {/* Keuze sectie — verbatim uit rHe */}
      <section className="mt-10 text-center">
        <Eyebrow>{t("lounge_keuze_eyebrow")}</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-xl font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("lounge_keuze_titel")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("lounge_keuze_intro")}
        </p>
      </section>

      {/* Kamer grid — verbatim uit rHe */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KAMERS.map((kamer) => {
          const Icon = kamer.icon;
          return (
            <button
              key={kamer.id}
              type="button"
              onClick={() => gaaNaar(kamer.id)}
              data-testid={`kamer-${kamer.id}`}
              className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-6 text-left transition hover:-translate-y-1"
              style={{
                borderTopColor: LOUNGE_KLEUR,
                background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.12) 0%, hsl(var(--card)) 62%)`,
              }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: `hsl(var(${LOUNGE_VAR})/0.16)`, color: LOUNGE_KLEUR }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: LOUNGE_KLEUR }}>
                {t(kamer.eyebrow_key)}
              </p>
              <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{t(kamer.naam_key)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(kamer.korte_key)}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: LOUNGE_KLEUR }}>
                {t("lounge_ga_naar_binnen")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </section>

      {/* TIP card teaser — zichtbaar in onthaal, onder het kamer-grid */}
      <TipCardTeaser gaaNaar={gaaNaar} />
    </div>
  );
}

// =============================================================================
// Hoofd Lounge component (verbatim uit bundle: function pHe)
// =============================================================================
function LoungePagina() {
  const [, navigeer] = useLocation();
  const { t } = useUiTaal();
  const [actieveKamer, setActieveKamer] = useState("onthaal");
  const topRef = useRef<HTMLDivElement>(null);

  // Scroll naar boven bij kamer wissel (verbatim uit bundle: useEffect in pHe)
  useEffect(() => {
    const scrollNaarBoven = () => {
      window.scrollTo(0, 0);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollNaarBoven();
    const raf = window.requestAnimationFrame(() => { scrollNaarBoven(); window.requestAnimationFrame(scrollNaarBoven); });
    const t1 = window.setTimeout(scrollNaarBoven, 60);
    const t2 = window.setTimeout(scrollNaarBoven, 180);
    return () => { window.cancelAnimationFrame(raf); window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [actieveKamer]);

  function gaaNaar(id: string) { setActieveKamer(id); }

  // Render actieve kamer inhoud
  function renderKamer() {
    switch (actieveKamer) {
      case "stilte":         return <StilteKamer />;
      case "muziek":         return <MuziekKamer />;
      case "webshop":        return <Webshop />;
      case "studie":         return <KamerKomTerug titel={t("lounge_kamer_studie_naam")}         eyebrow={t("lounge_kamer_studie_eyebrow")}         intro={t("lounge_kamer_binnenkort_studie")}         img="/lounge/img/studiekamer.jpg"    imgAlt={t("lounge_studie_img_alt")} />;
      case "talentencafe":   return <KamerKomTerug titel={t("lounge_kamer_talentencafe_naam")}   eyebrow={t("lounge_kamer_talentencafe_eyebrow")}   intro={t("lounge_kamer_binnenkort_talentencafe")}   img="/lounge/img/talentencafe.jpg"   imgAlt={t("lounge_talentencafe_img_alt")} />;
      case "inspiratiewand": return <KamerKomTerug titel={t("lounge_kamer_inspiratiewand_naam")} eyebrow={t("lounge_kamer_inspiratiewand_eyebrow")} intro={t("lounge_kamer_binnenkort_inspiratiewand")} img="/lounge/img/inspiratiewand.jpg" imgAlt={t("lounge_inspiratiewand_img_alt")} />;
      case "werkplaats":     return <KamerKomTerug titel={t("lounge_kamer_werkplaats_naam")}     eyebrow={t("lounge_kamer_werkplaats_eyebrow")}     intro={t("lounge_kamer_binnenkort_werkplaats")}     img="/lounge/img/werkplaats.jpg"     imgAlt={t("lounge_werkplaats_img_alt")} />;
      case "reflectie":      return <KamerKomTerug titel={t("lounge_kamer_reflectie_naam")}      eyebrow={t("lounge_kamer_reflectie_eyebrow")}      intro={t("lounge_kamer_binnenkort_reflectie")}      img="/lounge/img/reflectie.jpg"      imgAlt={t("lounge_reflectie_img_alt")} />;
      case "terras":         return <KamerKomTerug titel={t("lounge_kamer_terras_naam")}         eyebrow={t("lounge_kamer_terras_eyebrow")}         intro={t("lounge_kamer_binnenkort_terras")}         />;
      default:               return <><Onthaal gaaNaar={gaaNaar} /><AanwezigenSectie /></>;
    }
  }

  return (
    <div className="lounge-pagina min-h-[100dvh] bg-background">
      {/* AppHeader — WereldNav vervangt RadioKnop zodat taalkiezer beschikbaar is */}
      <AppHeader right={<WereldNav />} />

      <main className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Achtergrond glow — verbatim uit pHe */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80"
          style={{ background: `radial-gradient(70% 100% at 50% -10%, hsl(var(${LOUNGE_VAR})/0.12) 0%, transparent 70%)` }}
        />

        <div ref={topRef} />

        {/* Breadcrumb — verbatim uit pHe */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ background: `hsl(var(${LOUNGE_VAR})/0.14)`, color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.4)` }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("lounge_breadcrumb")}
          </span>
          {actieveKamer !== "onthaal" && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium text-foreground">{t(KAMERS.find((k) => k.id === actieveKamer)?.naam_key ?? "lounge_breadcrumb")}</span>
            </>
          )}
        </div>

        {/* Terugknop — verbatim uit pHe */}
        <div className="mt-4">
          {actieveKamer === "onthaal" ? (
            <button
              type="button"
              onClick={() => navigeer("/")}
              data-testid="link-terug-voordeur"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("lounge_nav_voordeur")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => gaaNaar("onthaal")}
              data-testid="link-terug-onthaal"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("lounge_nav_onthaal")}
            </button>
          )}
        </div>

        {/* Kamer inhoud */}
        <div className="mt-6">{renderKamer()}</div>

        {/* Navigatie naar andere kamers (onder in kamer) — verbatim uit pHe */}
        {actieveKamer !== "onthaal" && (
          <nav className="mt-14 border-t border-border pt-6" aria-label="Andere kamers">
            <button
              type="button"
              onClick={() => gaaNaar("onthaal")}
              data-testid="link-terug-onthaal-onder"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
              style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("lounge_nav_onthaal")}
            </button>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("lounge_of_dwaal_verder")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {KAMERS.filter((k) => k.id !== actieveKamer).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => gaaNaar(k.id)}
                  data-testid={`spring-${k.id}`}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t(k.naam_key)}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Footer — verbatim uit pHe */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t("lounge_footer")}
          </p>
        </footer>
      </main>
    </div>
  );
}

// mHe wrapper — verbatim uit bundle
export default function Lounge() {
  return <LoungePagina />;
}
