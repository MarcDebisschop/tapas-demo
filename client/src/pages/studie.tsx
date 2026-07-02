// =============================================================================
// studie.tsx — exact overgenomen uit tapas-fase1-preview bundle (index-BGJqNXPf.js)
// Geen interpretaties. Elke component, data-array en className is verbatim.
// Bundle vars: eze=Studie, rze=StudieScholen, lze=StudieLeerlingen, dze=StudieInstrumenten
// Icon mapping (Ye factory → lucide):
//   kV=ClipboardList, db=Send, RP=ChartLine(→TrendingUp), TV=Heart, ma=Sparkles
//   ub=Lightbulb, Sse=Route, Lu=GraduationCap, Su=Users, Ug=Building2
//   B4=CircleUserRound, As=Compass, Fu=ArrowLeft, ra=ShieldCheck, dr=ArrowRight
//   Mse=UserSearch
// =============================================================================

import { useLocation, Link } from "wouter";
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
  ClipboardList,
  Send,
  TrendingUp,
  Heart,
  Sparkles,
  Lightbulb,
  Route,
  GraduationCap,
  Users,
  Building2,
  CircleUserRound,
  Compass,
  ArrowLeft,
  ShieldCheck,
  ArrowRight,
  UserSearch,
  Languages,
} from "lucide-react";
import { TALEN, TAAL_NAMEN, TAAL_CODES, normaliseerTaal } from "@shared/i18n";
import { useUiTaal } from "@/contexts/TaalContext";

// --studie CSS variable (verbatim: tf / Cm / Bm = "--studie", Wo/qa/cs/Ql = hsl(var(...)))
const STUDIE_VAR = "--studie";
const cs = `hsl(var(${STUDIE_VAR}))`;

// =============================================================================
// WereldNav (wp) — taalkiezer (gedeeld/gepersisteerd) + terug-naar-voordeur
// =============================================================================
function WereldNav() {
  const [, navigate] = useLocation();
  const { uiTaal, setUiTaal, t } = useUiTaal();

  function handleTerug() {
    navigate("/");
  }

  return (
    <div className="flex items-center gap-2">
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
// Y8e / ize — Studie Kompas SVG (verbatim, 24 tick marks)
// =============================================================================
function StudieKompasSVG() {
  const lijnen = Array.from({ length: 24 }).map((_, n) => {
    const r = (n / 24) * Math.PI * 2;
    const i = n % 6 === 0;
    const s = 84;
    const o = i ? 74 : 79;
    return (
      <line
        key={n}
        x1={(100 + Math.sin(r) * s).toFixed(1)}
        y1={(100 - Math.cos(r) * s).toFixed(1)}
        x2={(100 + Math.sin(r) * o).toFixed(1)}
        y2={(100 - Math.cos(r) * o).toFixed(1)}
        strokeWidth={i ? 1.3 : 0.7}
      />
    );
  });

  return (
    <svg
      width="240"
      height="240"
      viewBox="0 0 200 200"
      fill="none"
      stroke={cs}
      role="img"
      aria-hidden="true"
      className="h-44 w-44 max-w-full sm:h-56 sm:w-56"
    >
      <circle cx="100" cy="100" r="88" strokeWidth="1" opacity="0.35" />
      <g opacity="0.5" strokeWidth="1">
        {lijnen}
      </g>
      <g transform="rotate(22 100 100)">
        <path d="M100 30 L110 100 L100 100 Z" fill={cs} stroke="none" />
        <path d="M100 170 L90 100 L100 100 Z" fill={cs} stroke="none" opacity="0.3" />
      </g>
      <circle cx="100" cy="100" r="6" fill="hsl(var(--background))" stroke={cs} strokeWidth="1.5" />
    </svg>
  );
}

// =============================================================================
// J8e — rolkaart data for /studie main (verbatim)
// =============================================================================
function getRolkaartData(t: (k: string) => string) {
  return [
    {
      eyebrow: t("studie_rol_scholen_eyebrow"),
      titel: t("studie_rol_scholen_titel"),
      body: t("studie_rol_scholen_body"),
      href: "/studie/scholen",
      cta: t("studie_rol_scholen_cta"),
      icon: GraduationCap,
      testid: "rolkaart-scholen",
    },
    {
      eyebrow: t("studie_rol_leerlingen_eyebrow"),
      titel: t("studie_rol_leerlingen_titel"),
      body: t("studie_rol_leerlingen_body"),
      href: "/studie/leerlingen",
      cta: t("studie_rol_leerlingen_cta"),
      icon: CircleUserRound,
      testid: "rolkaart-leerlingen",
    },
  ];
}

// =============================================================================
// Z8e — rolkaart component (verbatim)
// =============================================================================
function Rolkaart({ rol }: { rol: ReturnType<typeof getRolkaartData>[0] }) {
  const Icon = rol.icon;
  return (
    <Link href={rol.href}>
      <a
        data-testid={rol.testid}
        className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1"
        style={{
          borderTopColor: cs,
          background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${STUDIE_VAR})/0.13) 0%, hsl(var(--card)) 60%)`,
        }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em]" style={{ color: cs }}>
          {rol.eyebrow}
        </p>
        <h3 className="mt-2 font-serif text-xl font-semibold text-foreground sm:text-2xl">
          {rol.titel}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{rol.body}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: cs }}>
          {rol.cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </a>
    </Link>
  );
}

// =============================================================================
// eze — /studie main page (verbatim)
// =============================================================================
export default function Studie() {
  const [, navigate] = useLocation();
  const { t } = useUiTaal();
  const rolkaartData = getRolkaartData(t);

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* radial gradient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80"
          style={{
            background: `radial-gradient(70% 100% at 50% -20%, hsl(var(${STUDIE_VAR})/0.12) 0%, transparent 70%)`,
          }}
        />

        {/* badge */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${STUDIE_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${STUDIE_VAR})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          {t("studie_badge")}
        </span>

        {/* hero grid */}
        <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_eyebrow")}
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
              {t("studie_titel")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("studie_intro")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                data-testid="button-start-leerling"
                onClick={() => navigate("/studie/leerlingen")}
                style={{ background: cs, color: "#1a1a1a" }}
              >
                <Heart className="mr-1.5 h-4 w-4" />
                {t("studie_btn_leerling")}
              </Button>
              <Button
                variant="outline"
                data-testid="button-start-school"
                onClick={() => navigate("/studie/scholen")}
              >
                {t("studie_btn_school")}
              </Button>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <StudieKompasSVG />
          </div>
        </div>

        {/* rolkaarten section */}
        <section className="mt-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_kies_ingang")}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("studie_kies_vraag")}
            </h2>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {rolkaartData.map((rol) => (
              <Rolkaart key={rol.testid} rol={rol} />
            ))}
          </div>
        </section>

        {/* instrumenten card */}
        <section className="mt-14">
          <div
            className="relative overflow-hidden rounded-2xl border border-border p-7 sm:p-9"
            style={{
              background: `radial-gradient(120% 120% at 0% 0%, hsl(var(${STUDIE_VAR})/0.10) 0%, hsl(var(--card)) 55%)`,
            }}
          >
            <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
                  >
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                    {t("studie_instr_eyebrow")}
                  </p>
                </div>
                <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                  {t("studie_instr_titel")}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t("studie_instr_body")}
                </p>
              </div>
              <Button
                variant="outline"
                data-testid="button-bekijk-instrumenten"
                onClick={() => navigate("/studie/instrumenten")}
                className="shrink-0"
              >
                {t("studie_instr_cta")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* school context card */}
        <section className="mt-8">
          <div
            className="mx-auto max-w-3xl rounded-2xl border border-l-[3px] border-border bg-card/60 p-6"
            style={{ borderLeftColor: cs }}
          >
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cs }} aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("studie_school_context")}
              </p>
            </div>
          </div>
        </section>

        {/* terug button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          data-testid="link-terug-voordeur"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("studie_terug_voordeur")}
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · {t("studie_eyebrow")} · {t("studie_footer_note")}
          </p>
        </footer>
      </main>
    </div>
  );
}

// =============================================================================
// tze — scholen stappen data (verbatim)
// Icons: kV=ClipboardList, db=Send, RP=ChartLine→TrendingUp
// =============================================================================
function getScholenStappen(t: (k: string) => string) {
  return [
    {
      icon: ClipboardList,
      titel: t("studie_sc_stap1_titel"),
      body: t("studie_sc_stap1_body"),
    },
    {
      icon: Send,
      titel: t("studie_sc_stap2_titel"),
      body: t("studie_sc_stap2_body"),
    },
    {
      icon: TrendingUp,
      titel: t("studie_sc_stap3_titel"),
      body: t("studie_sc_stap3_body"),
    },
  ];
}

// =============================================================================
// nze — scholen instrumenten data (verbatim)
// Icons: Lu=GraduationCap, Su=Users, Ug=Building2
// =============================================================================
function getScholenInstrumenten(t: (k: string) => string) {
  return [
    {
      icon: GraduationCap,
      eyebrow: t("studie_sc_inst1_eyebrow"),
      titel: t("studie_sc_inst1_titel"),
      body: t("studie_sc_inst1_body"),
      chips: ["T4Students", "T4Teens"],
    },
    {
      icon: Users,
      eyebrow: t("studie_sc_inst2_eyebrow"),
      titel: t("studie_sc_inst2_titel"),
      body: t("studie_sc_inst2_body"),
      chips: ["TaPas Teamscan", "T4P Business Kompas"],
    },
    {
      icon: Building2,
      eyebrow: t("studie_sc_inst3_eyebrow"),
      titel: t("studie_sc_inst3_titel"),
      body: t("studie_sc_inst3_body"),
      chips: ["T4P Business Kompas", "T4Recruitment"],
    },
  ];
}

// =============================================================================
// rze — /studie/scholen component (verbatim)
// =============================================================================
export function StudieScholenPagina() {
  const [, navigate] = useLocation();
  const { t } = useUiTaal();
  const scholenStappen = getScholenStappen(t);
  const scholenInstrumenten = getScholenInstrumenten(t);

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* radial gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
          style={{
            background: `radial-gradient(70% 100% at 50% -20%, hsl(var(${STUDIE_VAR})/0.12) 0%, transparent 70%)`,
          }}
        />

        {/* badge */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${STUDIE_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${STUDIE_VAR})/0.4)`,
          }}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          {t("studie_sc_badge")}
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("studie_sc_titel")}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t("studie_sc_intro")}
        </p>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin">
            <Button
              data-testid="button-naar-beheer"
              style={{ background: cs, color: "#1a1a1a" }}
            >
              {t("studie_sc_cta_beheer")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/studie/instrumenten">
            <Button variant="outline" data-testid="button-bekijk-instrumenten">
              {t("studie_sc_cta_instr")}
            </Button>
          </Link>
        </div>

        {/* stappen section */}
        <section className="mt-14">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_sc_stap_eyebrow")}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("studie_sc_stap_titel")}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {scholenStappen.map((stap, n) => {
              const Icon = stap.icon;
              return (
                <div
                  key={stap.titel}
                  data-testid={`begeleider-stap-${n + 1}`}
                  className="rounded-xl border border-t-[3px] border-border bg-card p-6"
                  style={{ borderTopColor: cs }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono font-bold"
                      style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
                    >
                      {n + 1}
                    </div>
                    <Icon className="h-5 w-5" style={{ color: cs }} aria-hidden="true" />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-foreground">{stap.titel}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stap.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* instrumenten section */}
        <section className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_sc_instr_eyebrow")}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("studie_sc_instr_titel")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("studie_sc_instr_intro")}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {scholenInstrumenten.map((inst) => {
              const Icon = inst.icon;
              return (
                <div
                  key={inst.titel}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6"
                >
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl"
                    style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: cs }}>
                    {inst.eyebrow}
                  </p>
                  <h4 className="mt-1 font-serif text-lg font-semibold text-foreground">{inst.titel}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{inst.body}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {inst.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
                        style={{
                          color: cs,
                          borderColor: `hsl(var(${STUDIE_VAR})/0.35)`,
                          background: `hsl(var(${STUDIE_VAR})/0.07)`,
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* privacy section */}
        <section className="mt-12">
          <div
            className="mx-auto max-w-3xl rounded-2xl border border-l-[3px] border-border bg-card/60 p-6"
            style={{ borderLeftColor: cs }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cs }} aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("studie_sc_privacy")}
              </p>
            </div>
          </div>
        </section>

        {/* terug button */}
        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("studie_sc_terug")}
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · {t("studie_sc_footer")}
          </p>
        </footer>
      </main>
    </div>
  );
}

// =============================================================================
// aze — leerlingen stappen data (verbatim)
// Icons: TV=Heart, As=Compass, Sse=Route
// =============================================================================
function getLeerlingenStappen(t: (k: string) => string) {
  return [
    {
      nr: "1",
      icon: Heart,
      titel: t("studie_ll_stap1_titel"),
      body: t("studie_ll_stap1_body"),
    },
    {
      nr: "2",
      icon: Compass,
      titel: t("studie_ll_stap2_titel"),
      body: t("studie_ll_stap2_body"),
    },
    {
      nr: "3",
      icon: Route,
      titel: t("studie_ll_stap3_titel"),
      body: t("studie_ll_stap3_body"),
    },
  ];
}

// =============================================================================
// sze — leerlingen kompas inhoud data (verbatim)
// Icons: ma=Sparkles, ub=Lightbulb, Sse=Route
// =============================================================================
function getLeerlingenKompass(t: (k: string) => string) {
  return [
    {
      icon: Sparkles,
      titel: t("studie_ll_komp1_titel"),
      body: t("studie_ll_komp1_body"),
    },
    {
      icon: Lightbulb,
      titel: t("studie_ll_komp2_titel"),
      body: t("studie_ll_komp2_body"),
    },
    {
      icon: Route,
      titel: t("studie_ll_komp3_titel"),
      body: t("studie_ll_komp3_body"),
    },
  ];
}

// =============================================================================
// oze — leerlingen niet-beloftes list (verbatim)
// =============================================================================
function getLeerlingenNietBeloftes(t: (k: string) => string) {
  return [
    t("studie_ll_niet1"),
    t("studie_ll_niet2"),
    t("studie_ll_niet3"),
  ];
}

// =============================================================================
// ize — leerlingen kompas SVG (verbatim — identical to Y8e but different width/height)
// =============================================================================
function LeerlingenKompasSVG() {
  const lijnen = Array.from({ length: 24 }).map((_, n) => {
    const r = (n / 24) * Math.PI * 2;
    const i = n % 6 === 0;
    const s = 84;
    const o = i ? 74 : 79;
    return (
      <line
        key={n}
        x1={(100 + Math.sin(r) * s).toFixed(1)}
        y1={(100 - Math.cos(r) * s).toFixed(1)}
        x2={(100 + Math.sin(r) * o).toFixed(1)}
        y2={(100 - Math.cos(r) * o).toFixed(1)}
        strokeWidth={i ? 1.3 : 0.7}
      />
    );
  });

  return (
    <svg
      width="220"
      height="220"
      viewBox="0 0 200 200"
      fill="none"
      stroke={cs}
      role="img"
      aria-hidden="true"
      className="max-w-full"
    >
      <circle cx="100" cy="100" r="88" strokeWidth="1" opacity="0.35" />
      <g opacity="0.5" strokeWidth="1">
        {lijnen}
      </g>
      <g transform="rotate(22 100 100)">
        <path d="M100 30 L110 100 L100 100 Z" fill={cs} stroke="none" />
        <path d="M100 170 L90 100 L100 100 Z" fill={cs} stroke="none" opacity="0.3" />
      </g>
      <circle cx="100" cy="100" r="6" fill="hsl(var(--background))" stroke={cs} strokeWidth="1.5" />
    </svg>
  );
}

// =============================================================================
// lze — /studie/leerlingen component (verbatim)
// =============================================================================
export function StudieLeerlingenPagina() {
  const [, navigate] = useLocation();
  const { t } = useUiTaal();
  const leerlingenStappen = getLeerlingenStappen(t);
  const leerlingenKompass = getLeerlingenKompass(t);
  const leerlingenNietBeloftes = getLeerlingenNietBeloftes(t);

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* radial gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
          style={{
            background: `radial-gradient(70% 100% at 50% -20%, hsl(var(${STUDIE_VAR})/0.12) 0%, transparent 70%)`,
          }}
        />

        {/* badge */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${STUDIE_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${STUDIE_VAR})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          {t("studie_ll_badge")}
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("studie_ll_titel")}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t("studie_ll_intro")}
        </p>

        {/* welcome card + kompas svg */}
        <section className="mt-8 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className="rounded-2xl border border-l-[3px] border-border bg-card p-8"
            style={{ borderLeftColor: cs }}
          >
            <h3 className="font-serif text-xl font-semibold text-foreground sm:text-2xl">
              {t("studie_ll_welkom_titel")}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {t("studie_ll_welkom_body")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/t4teens/">
                <Button
                  data-testid="button-start-verkenning"
                  style={{ background: cs, color: "#1a1a1a" }}
                >
                  {t("studie_ll_btn_start")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </a>
              <Link href="/poort/teens">
                <Button variant="outline" data-testid="button-heb-code">
                  {t("studie_ll_btn_code")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid place-items-center">
            <LeerlingenKompasSVG />
          </div>
        </section>

        {/* stappen section */}
        <section className="mt-14">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_ll_stap_eyebrow")}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("studie_ll_stap_titel")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("studie_ll_stap_hint")}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {leerlingenStappen.map((stap) => {
              const Icon = stap.icon;
              return (
                <div
                  key={stap.nr}
                  data-testid={`stap-${stap.nr}`}
                  className="rounded-xl border border-t-[3px] border-border bg-card p-6"
                  style={{ borderTopColor: cs }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono font-bold"
                      style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
                    >
                      {stap.nr}
                    </div>
                    <Icon className="h-5 w-5" style={{ color: cs }} aria-hidden="true" />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-foreground">{stap.titel}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stap.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* studiekompas section */}
        <section className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_ll_komp_eyebrow")}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("studie_ll_komp_titel")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("studie_ll_komp_intro")}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {leerlingenKompass.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titel} className="rounded-xl border border-border bg-card p-6">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl"
                    style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-foreground">{item.titel}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>

          {/* niet-beloftes */}
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-card/60 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_ll_niet_eyebrow")}
            </p>
            <ul className="mt-3 space-y-2">
              {leerlingenNietBeloftes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cs }} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-center text-sm italic text-muted-foreground">
            {t("studie_ll_veilig")}
          </p>
        </section>

        {/* CTA section */}
        <section className="mx-auto mt-10 max-w-2xl">
          <div
            className="rounded-2xl border border-l-[3px] border-border bg-card p-7 text-center"
            style={{ borderLeftColor: cs }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              {t("studie_ll_cta_eyebrow")}
            </p>
            <h3 className="mt-3 font-serif text-xl font-semibold text-foreground">
              {t("studie_ll_cta_titel")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("studie_ll_cta_body")}
            </p>
            <button
              type="button"
              onClick={() => window.location.assign("/t4teens/")}
              data-testid="button-start-t4teens"
              className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              style={{ background: cs }}
            >
              <Sparkles className="h-4 w-4" />
              {t("studie_ll_cta_knop")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* terug button */}
        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("studie_ll_terug")}
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TaPas-platform · {t("studie_ll_footer")}
          </p>
        </footer>
      </main>
    </div>
  );
}

// =============================================================================
// cze — instrumenten voor leerlingen data (verbatim)
// =============================================================================
function getInstrLeerlingen(t: (k: string) => string) {
  return [
    {
      naam: "T4Students",
      eyebrow: t("studie_in_inst_t4s_eyebrow"),
      body: t("studie_in_inst_t4s_body"),
      voorwie: t("studie_in_inst_t4s_voorwie"),
    },
    {
      naam: "T4Teens",
      eyebrow: t("studie_in_inst_t4t_eyebrow"),
      body: t("studie_in_inst_t4t_body"),
      voorwie: t("studie_in_inst_t4t_voorwie"),
    },
  ];
}

// =============================================================================
// uze — instrumenten voor teams & leiding data (verbatim)
// =============================================================================
function getInstrTeams(t: (k: string) => string) {
  return [
    {
      naam: "TaPas Teamscan",
      eyebrow: t("studie_in_inst_ts_eyebrow"),
      body: t("studie_in_inst_ts_body"),
      voorwie: t("studie_in_inst_ts_voorwie"),
    },
    {
      naam: "T4P Business Kompas",
      eyebrow: t("studie_in_inst_t4p_eyebrow"),
      body: t("studie_in_inst_t4p_body"),
      voorwie: t("studie_in_inst_t4p_voorwie"),
    },
    {
      naam: "T4Recruitment",
      eyebrow: t("studie_in_inst_t4r_eyebrow"),
      body: t("studie_in_inst_t4r_body"),
      voorwie: t("studie_in_inst_t4r_voorwie"),
    },
  ];
}

// =============================================================================
// x$ — instrument card component (verbatim)
// =============================================================================
function InstrumentCard({ inst }: { inst: { naam: string; eyebrow: string; body: string; voorwie: string } }) {
  return (
    <div
      className="flex flex-col rounded-2xl border border-t-[3px] border-border bg-card p-6"
      style={{ borderTopColor: cs }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: cs }}>
        {inst.eyebrow}
      </p>
      <h4 className="mt-1 font-serif text-lg font-semibold text-foreground">{inst.naam}</h4>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{inst.body}</p>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <UserSearch className="h-3.5 w-3.5 shrink-0" style={{ color: cs }} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{inst.voorwie}</span>
      </div>
    </div>
  );
}

// =============================================================================
// dze — /studie/instrumenten component (verbatim)
// =============================================================================
export function StudieInstrumentenPagina() {
  const [, navigate] = useLocation();
  const { t } = useUiTaal();
  const instrLeerlingen = getInstrLeerlingen(t);
  const instrTeams = getInstrTeams(t);

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* radial gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
          style={{
            background: `radial-gradient(70% 100% at 50% -20%, hsl(var(${STUDIE_VAR})/0.12) 0%, transparent 70%)`,
          }}
        />

        {/* badge */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${STUDIE_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${STUDIE_VAR})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          {t("studie_in_badge")}
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("studie_in_titel")}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t("studie_in_intro")}
        </p>

        {/* leerlingen instrumenten */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
            >
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                {t("studie_in_ll_eyebrow")}
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {t("studie_in_ll_titel")}
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {instrLeerlingen.map((inst) => (
              <InstrumentCard key={inst.naam} inst={inst} />
            ))}
          </div>
        </section>

        {/* teams & leiding instrumenten */}
        <section className="mt-14">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: `hsl(var(${STUDIE_VAR})/0.16)`, color: cs }}
            >
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                {t("studie_in_teams_eyebrow")}
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {t("studie_in_teams_titel")}
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("studie_in_teams_body")}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {instrTeams.map((inst) => (
              <InstrumentCard key={inst.naam} inst={inst} />
            ))}
          </div>
        </section>

        {/* privacy section */}
        <section className="mt-12">
          <div
            className="mx-auto max-w-3xl rounded-2xl border border-l-[3px] border-border bg-card/60 p-6"
            style={{ borderLeftColor: cs }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cs }} aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("studie_in_privacy")}
              </p>
            </div>
          </div>
        </section>

        {/* bottom CTA buttons */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            data-testid="button-naar-scholen"
            onClick={() => navigate("/studie/scholen")}
            style={{ background: cs, color: "#1a1a1a" }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {t("studie_in_btn_scholen")}
          </Button>
          <Button
            variant="outline"
            data-testid="button-naar-leerlingen"
            onClick={() => navigate("/studie/leerlingen")}
          >
            <Users className="mr-1.5 h-4 w-4" />
            {t("studie_in_btn_leerlingen")}
          </Button>
        </div>

        {/* terug button */}
        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("studie_in_terug")}
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · {t("studie_in_footer")}
          </p>
        </footer>
      </main>
    </div>
  );
}
