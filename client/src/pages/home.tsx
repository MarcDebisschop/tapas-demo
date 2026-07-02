import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Languages,
  Plane,
  ShieldCheck,
  GraduationCap,
  Sofa,
  Briefcase,
  BookOpen,
  Users,
  BarChart2,
  ScanLine,
  ClipboardList,
  UserCheck,
  Dumbbell,
} from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  normaliseerTaal,
} from "@shared/i18n";
import { useUiTaal } from "@/contexts/TaalContext";
import { Rondleiding, startRondleiding } from "@/components/Rondleiding";

// ---------------------------------------------------------------------------
// HeroKompas — exact gereproduceerd vanuit de originele bundle (upe component)
// NIET AANRAKEN
// ---------------------------------------------------------------------------
function HeroKompas() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      className="h-44 w-44 text-accent sm:h-56 sm:w-56"
      role="img"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="92" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="100" cy="100" r="74" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i * 360) / 32;
        const major = i % 8 === 0;
        return (
          <line
            key={i}
            x1="100" y1={major ? 12 : 16}
            x2="100" y2={major ? 22 : 20}
            stroke="currentColor"
            strokeWidth={major ? 1.6 : 0.8}
            opacity={major ? 0.5 : 0.25}
            transform={`rotate(${angle} 100 100)`}
          />
        );
      })}
      <g transform="rotate(-6 100 100)">
        <path d="M100 24 L116 100 L100 88 L84 100 Z" fill="currentColor" />
        <path d="M100 176 L84 100 L100 112 L116 100 Z" fill="currentColor" opacity="0.3" />
      </g>
      <path d="M28 100 L172 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <circle cx="100" cy="100" r="9" fill="currentColor" />
      <circle cx="100" cy="100" r="4" fill="var(--card, #fff)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LoungeWidget — exact overgenomen uit Kme() in ZIP-8 bundle (index-CxFhBwUz.js)
// NIET AANRAKEN
// ---------------------------------------------------------------------------
function LoungeWidget() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useUiTaal();
  const r = "hsl(var(--lounge))";
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="button-entry-lounge"
        aria-expanded={open}
        className="group relative block w-full overflow-hidden rounded-2xl border border-dashed p-6 text-left transition hover:-translate-y-0.5"
        style={{
          borderColor: "hsl(var(--lounge)/0.55)",
          background: "radial-gradient(120% 140% at 50% 0%, hsl(var(--lounge)/0.14) 0%, hsl(var(--card)) 70%)",
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{ background: "hsl(var(--lounge)/0.16)", color: r }}
          >
            <Sofa className="h-5 w-5" />
          </span>
          <span>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: r }}
            >
              {t("hp_lounge_entry")}
            </span>
            <span className="block font-serif text-xl font-semibold text-foreground sm:text-2xl">
              {t("hp_lounge_titel")}
            </span>
          </span>
        </div>
        <p className="mx-auto mt-2 max-w-md text-center text-xs italic text-muted-foreground">
          {t("hp_lounge_subtitel")}
        </p>
      </button>
      {open && (
        <div
          className="mt-3 rounded-2xl border p-5 text-center"
          style={{
            borderColor: "hsl(var(--lounge)/0.4)",
            background: "hsl(var(--lounge)/0.06)",
          }}
          data-testid="lounge-melding"
        >
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("hp_lounge_body")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/lounge")}
            data-testid="button-naar-lounge"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition"
            style={{
              color: r,
              borderColor: "hsl(var(--lounge)/0.5)",
              background: "hsl(var(--lounge)/0.10)",
            }}
          >
            {t("hp_lounge_cta")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AcademyLink — uitnodiging naar TaPasAcademy, zichtbaar voor iedereen
// NIET AANRAKEN
// ---------------------------------------------------------------------------
function AcademyLink() {
  const { t } = useUiTaal();
  const goud = "hsl(var(--gold))";
  return (
    <div className="mt-4">
      <Link href="/academy">
        <a
          data-testid="link-naar-academy"
          className="group flex items-center justify-between rounded-2xl border border-dashed p-5 transition hover:-translate-y-0.5"
          style={{
            borderColor: "hsl(var(--gold)/0.45)",
            background: "radial-gradient(120% 140% at 8% 0%, hsl(var(--gold)/0.10) 0%, hsl(var(--card)) 70%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "hsl(var(--gold)/0.16)", color: goud }}
            >
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <span
                className="font-mono text-[11px] uppercase tracking-[0.2em]"
                style={{ color: goud }}
              >
                {t("hp_acad_open")}
              </span>
              <span className="block font-serif text-xl font-semibold text-foreground sm:text-2xl">
                {t("hp_acad_titel")}
              </span>
              <p className="mt-1 max-w-md text-xs italic text-muted-foreground">
                {t("hp_acad_body")}
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5"
            style={{ color: goud }}
          />
        </a>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlatformOverzicht — Zone C: visuele voorstelling van het volledige platform
// NIEUW in R32 — informatieve tegels, geen instrumenten-navigatie
// ---------------------------------------------------------------------------
interface PlatformTegel {
  label: string;
  titel: string;
  omschrijving: string;
  href: string;
  kleurVar: string;
  icon: React.ReactNode;
  badges: string[];
}

function PlatformOverzicht() {
  const { t } = useUiTaal();
  const tegels: PlatformTegel[] = [
    {
      label: t("hp_tegel_werk_label"),
      titel: t("hp_tegel_werk_titel"),
      omschrijving: t("hp_tegel_werk_body"),
      href: "/werk",
      kleurVar: "--werk",
      icon: <Briefcase className="h-5 w-5" />,
      badges: ["T4P Business", "T4Recruitment", "Teamscan", "2MINSCAN", "Human Due Diligence", "Impact-roos", "T4Sports"],
    },
    {
      label: t("hp_tegel_studie_label"),
      titel: t("hp_tegel_studie_titel"),
      omschrijving: t("hp_tegel_studie_body"),
      href: "/studie",
      kleurVar: "--studie",
      icon: <BookOpen className="h-5 w-5" />,
      badges: ["T4Students", "T4Teens"],
    },
    {
      label: t("hp_acad_open"),
      titel: t("hp_acad_titel"),
      omschrijving: t("hp_tegel_acad_body"),
      href: "/academy",
      kleurVar: "--gold",
      icon: <GraduationCap className="h-5 w-5" />,
      badges: ["TaPas Jester", "Accreditaties", "Coaches"],
    },
  ];

  return (
    <section className="mt-16 sm:mt-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("hp_ov_eyebrow")}
        </p>
        <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.2]">
          {t("hp_ov_titel")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("hp_ov_intro")}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {tegels.map((tegel) => (
          <a
            key={tegel.href}
            href={`#${tegel.href}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-t-[3px] border-border p-6 transition hover:-translate-y-1"
            style={{
              borderTopColor: `hsl(var(${tegel.kleurVar}))`,
              background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${tegel.kleurVar})/0.12) 0%, hsl(var(--card)) 65%)`,
            }}
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{
                background: `hsl(var(${tegel.kleurVar})/0.14)`,
                color: `hsl(var(${tegel.kleurVar}))`,
              }}
            >
              {tegel.icon}
            </span>
            <p
              className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em]"
              style={{ color: `hsl(var(${tegel.kleurVar}))` }}
            >
              {tegel.label}
            </p>
            <h3 className="mt-1 font-serif text-lg font-semibold text-foreground">
              {tegel.titel}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {tegel.omschrijving}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tegel.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    borderColor: `hsl(var(${tegel.kleurVar})/0.3)`,
                    color: `hsl(var(${tegel.kleurVar}))`,
                    background: `hsl(var(${tegel.kleurVar})/0.07)`,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
            <span
              className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: `hsl(var(${tegel.kleurVar}))` }}
            >
              {t("hp_ov_verken")}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hoofdpagina — ZIP-8 referentie: Gme() in index-CxFhBwUz.js
// R32: Zone A (banner uitgebreid) + Zone C (PlatformOverzicht) toegevoegd
// Alle bestaande blokken ongewijzigd
// ---------------------------------------------------------------------------
export default function Home() {
  const { uiTaal, setUiTaal, t } = useUiTaal();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* NAVIGATIE — Zone A: taalswitch + rondleiding + admin (ongewijzigd qua functie, admin iets prominenter) */}
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
              <SelectTrigger
                className="h-9 w-auto gap-1.5 px-2.5"
                data-testid="select-ui-taal"
                data-tour="taalkiezer"
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
              onClick={startRondleiding}
              data-testid="button-rondleiding"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[hsl(var(--gold)/0.4)] px-2.5 text-sm font-medium text-[hsl(var(--gold))] transition hover:bg-[hsl(var(--gold)/0.08)]"
              aria-label={t("hp_nav_flight_label")}
            >
              <Plane className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("hp_nav_flight_kort")}
              </span>
            </button>
            {/* Admin-knop: iets prominenter met label zichtbaar op sm+ */}
            <Link href="/admin">
              <button
                type="button"
                data-testid="button-admin-home"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 text-sm font-medium text-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label={t("hp_nav_beheer")}
              >
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span className="hidden sm:inline">{t("hp_nav_beheer")}</span>
              </button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">

        {/* ---------------------------------------------------------------- */}
        {/* HERO — Zone B: ongewijzigd                                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              {t("hp_hero_eyebrow")}
            </p>
            <h1 className="mt-4 font-serif text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[3.25rem]">
              {t("hp_hero_titel_r1")}<br />
              {t("hp_hero_titel_r2_pre")}<span className="text-accent">{t("hp_hero_titel_r2_klem")}</span>{t("hp_hero_titel_r2_post")}<br />
              {t("hp_hero_titel_r3")}
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("hp_hero_intro")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                data-testid="button-kies-ingang"
                onClick={() => {
                  document.getElementById("kies")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t("hp_hero_cta_kies")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Link href="/poort">
                <Button variant="outline" data-testid="button-ik-ben-deelnemer">
                  {t("hp_hero_cta_deelnemer")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroKompas />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* ZONE C — Platform in één oogopslag (NIEUW R32)                   */}
        {/* ---------------------------------------------------------------- */}
        <PlatformOverzicht />

        {/* ---------------------------------------------------------------- */}
        {/* KIES JE WERELD — blok "Waar wil je je talent mobiliseren?"        */}
        {/* op verzoek van Marc definitief verwijderd (behoud Lounge/Academy) */}
        {/* ---------------------------------------------------------------- */}
        <section id="kies" className="mt-16 scroll-mt-24 sm:mt-24">
          {/* Lounge-uitnodiging — exact Kme() uit ZIP-8 bundle — NIET AANRAKEN */}
          <LoungeWidget />

          {/* Academy-link — zichtbaar voor iedereen — NIET AANRAKEN */}
          <AcademyLink />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* T4SPORTS DEMO LINK — directe toegang via hash-routing             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-10">
          <a
            href="#/t4sports"
            data-testid="link-t4sports-demo"
            className="group flex items-center justify-between rounded-2xl border border-dashed p-5 transition hover:-translate-y-0.5"
            style={{
              borderColor: "hsl(var(--accent)/0.45)",
              background: "radial-gradient(120% 140% at 8% 0%, hsl(var(--accent)/0.10) 0%, hsl(var(--card)) 70%)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "hsl(var(--accent)/0.14)", color: "hsl(var(--accent))" }}
              >
                <Dumbbell className="h-5 w-5" />
              </span>
              <div>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: "hsl(var(--accent))" }}
                >
                  {t("hp_t4s_demo")}
                </span>
                <span className="block font-serif text-xl font-semibold text-foreground sm:text-2xl">
                  T4Sports
                </span>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {t("hp_t4s_body")}
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5"
              style={{ color: "hsl(var(--accent))" }}
            />
          </a>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 border-t border-border pt-6 sm:mt-24">
          <p className="text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-footer-note">
            {t("home_footer_note")}
          </p>
        </footer>
      </main>

      {/* Rondleiding — welkom-uitnodiging bij eerste bezoek, vlucht pas na klik — NIET AANRAKEN */}
      <Rondleiding taal={uiTaal} autoStart={true} />
    </div>
  );
}
