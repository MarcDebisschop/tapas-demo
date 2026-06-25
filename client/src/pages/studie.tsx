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
} from "lucide-react";

// --studie CSS variable (verbatim: tf / Cm / Bm = "--studie", Wo/qa/cs/Ql = hsl(var(...)))
const STUDIE_VAR = "--studie";
const cs = `hsl(var(${STUDIE_VAR}))`;

// =============================================================================
// WereldNav (wp) — verbatim from bundle: taal-indicator + terug-naar-voordeur
// =============================================================================
function WereldNav() {
  const [, navigate] = useLocation();

  function handleTerug() {
    navigate("/");
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="select-none px-2 py-1.5 font-mono text-[13px] text-muted-foreground"
        data-testid="lang-indicator"
        aria-label="Taal: Nederlands"
      >
        NL
      </span>
      <button
        type="button"
        onClick={handleTerug}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[13px] text-muted-foreground transition hover:text-foreground"
        data-testid="button-voordeur"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voordeur
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
const rolkaartData = [
  {
    eyebrow: "Voor scholen & begeleiders",
    titel: "Begeleid, verstuur & volg",
    body: "Nodig leerlingen en studenten uit, volg hun verkenning en lees hun studiekompas — individueel en per klas. Breng waar nodig ook je team en leiding in kaart.",
    href: "/studie/scholen",
    cta: "Naar de beheeromgeving",
    icon: GraduationCap,
    testid: "rolkaart-scholen",
  },
  {
    eyebrow: "Voor leerlingen & studenten",
    titel: "Ontdek welke koers bij je talent past",
    body: "Een rustige, uitnodigende weg naar je eigen studiekompas. Geen druk, geen oordeel — alleen aandacht voor wat jou doet schitteren.",
    href: "/studie/leerlingen",
    cta: "Start jouw verkenning",
    icon: CircleUserRound,
    testid: "rolkaart-leerlingen",
  },
];

// =============================================================================
// Z8e — rolkaart component (verbatim)
// =============================================================================
function Rolkaart({ rol }: { rol: typeof rolkaartData[0] }) {
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
          Wereld — studie
        </span>

        {/* hero grid */}
        <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Studie
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
              Mobiliseer je talent in je studie
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Warm, sereen en uitnodigend. Hier wordt talent ontdekt en gevormd — voor wie jongeren begeleidt én voor wie zelf zijn studiekoers zoekt.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                data-testid="button-start-leerling"
                onClick={() => navigate("/studie/leerlingen")}
                style={{ background: cs, color: "#1a1a1a" }}
              >
                <Heart className="mr-1.5 h-4 w-4" />
                Ik ben leerling of student
              </Button>
              <Button
                variant="outline"
                data-testid="button-start-school"
                onClick={() => navigate("/studie/scholen")}
              >
                Ik begeleid een school
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
              Kies je ingang
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Begeleid je, of verken je zelf?
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
                    De instrumenten
                  </p>
                </div>
                <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                  Eén kompas per vraag
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Het studiekompas voor leerlingen en studenten, plus de instrumenten voor teams en leiding binnen de school — telkens tegen het onderwijs-tarief.
                </p>
              </div>
              <Button
                variant="outline"
                data-testid="button-bekijk-instrumenten"
                onClick={() => navigate("/studie/instrumenten")}
                className="shrink-0"
              >
                Bekijk de instrumenten
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
                Een school is meer dan haar leerlingen. Binnen dezelfde omgeving breng je ook lerarenteams en directie in kaart, geef je elke jongere vooraf de keuze om mee te doen, en blijven alle gegevens binnen je eigen schoolomgeving.
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
          Terug naar de voordeur
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · Studie · dezelfde routes, dezelfde zorg
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
const scholenStappen = [
  {
    icon: ClipboardList,
    titel: "Richt je school in",
    body: "Maak je schoolomgeving aan en bepaal wie begeleidt. Eén veilige, meertalige beheeromgeving voor je hele team.",
  },
  {
    icon: Send,
    titel: "Nodig leerlingen uit",
    body: "Per leerling of per klas, met een persoonlijke link. Iedere jongere geeft eerst zelf toestemming — consent vooraf.",
  },
  {
    icon: TrendingUp,
    titel: "Volg en lees mee",
    body: "Volg de voortgang en lees elk studiekompas — individueel en per klas — zodra het klaar is.",
  },
];

// =============================================================================
// nze — scholen instrumenten data (verbatim)
// Icons: Lu=GraduationCap, Su=Users, Ug=Building2
// =============================================================================
const scholenInstrumenten = [
  {
    icon: GraduationCap,
    eyebrow: "Leerlingen & studenten",
    titel: "Het studiekompas",
    body: "T4Students en T4Teens begeleiden jongeren naar een studiekeuze die bij hun talent past — als rustige verkenning, niet als test.",
    chips: ["T4Students", "T4Teens"],
  },
  {
    icon: Users,
    eyebrow: "Lerarenteams & vakgroepen",
    titel: "Sterkere teams",
    body: "Laat een vakgroep of lerarenteam zichzelf in kaart brengen: hoe vullen talenten elkaar aan, waar zit de energie, waar de spanning.",
    chips: ["TaPas Teamscan", "T4P Business Kompas"],
  },
  {
    icon: Building2,
    eyebrow: "Directie & schoolleiding",
    titel: "Leiding in beeld",
    body: "Ook een directie of schoolleiding kan individueel of als team gescand worden — binnen dezelfde schoolcontext en tegen het onderwijs-tarief.",
    chips: ["T4P Business Kompas", "T4Recruitment"],
  },
];

// =============================================================================
// rze — /studie/scholen component (verbatim)
// =============================================================================
export function StudieScholenPagina() {
  const [, navigate] = useLocation();

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
          Studie — voor scholen &amp; begeleiders
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Begeleid, verstuur &amp; volg
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Nodig leerlingen en studenten uit, volg hun verkenning en lees hun studiekompas — individueel en per klas. En waar nodig breng je ook je eigen team en leiding in kaart. Alles in één veilige, meertalige beheeromgeving.
        </p>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin">
            <Button
              data-testid="button-naar-beheer"
              style={{ background: cs, color: "#1a1a1a" }}
            >
              Naar de beheeromgeving
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/studie/instrumenten">
            <Button variant="outline" data-testid="button-bekijk-instrumenten">
              Bekijk de instrumenten
            </Button>
          </Link>
        </div>

        {/* stappen section */}
        <section className="mt-14">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Zo richt je het in
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Van inrichten tot inzicht
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
              In de schoolcontext
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Niet alleen leerlingen
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Een school is meer dan haar leerlingen. Binnen dezelfde omgeving breng je ook teams en leiding in kaart — telkens tegen het onderwijs-tarief.
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
                Elke jongere geeft vooraf toestemming, alle scoring gebeurt op de server en je gegevens blijven binnen je eigen schoolomgeving. Meertalig, GDPR-conform en met respect voor wat elke leerling uniek maakt.
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
          Terug naar de studie-wereld
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · Studie voor scholen &amp; begeleiders · dezelfde routes, dezelfde zorg
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
const leerlingenStappen = [
  {
    nr: "1",
    icon: Heart,
    titel: "Je komt rustig binnen",
    body: "Via de poort of een persoonlijke uitnodiging van je school. Je geeft eerst zelf je toestemming — niets gebeurt zonder dat.",
  },
  {
    nr: "2",
    icon: Compass,
    titel: "Je verkent op je eigen tempo",
    body: "Een vragenlijst in twee delen, in je eigen taal. Geen goede of foute antwoorden — alleen wat bij jou past.",
  },
  {
    nr: "3",
    icon: Route,
    titel: "Je ontdekt je studiekompas",
    body: "Een persoonlijk rapport dat laat zien waar je talent zit, wat je energie geeft, en welke richtingen daarbij passen.",
  },
];

// =============================================================================
// sze — leerlingen kompas inhoud data (verbatim)
// Icons: ma=Sparkles, ub=Lightbulb, Sse=Route
// =============================================================================
const leerlingenKompass = [
  {
    icon: Sparkles,
    titel: "Waar je talent zit",
    body: "De foci en versnellers die jou typeren — niet als etiket, maar als startpunt voor je keuze.",
  },
  {
    icon: Lightbulb,
    titel: "Wat je energie geeft",
    body: "Waar je vanzelf naartoe beweegt en waar je juist energie verliest, zodat je koers ook vol te houden is.",
  },
  {
    icon: Route,
    titel: "Welke richtingen passen",
    body: "Studierichtingen en domeinen die aansluiten bij wie je bent — als inspiratie, niet als voorschrift.",
  },
];

// =============================================================================
// oze — leerlingen niet-beloftes list (verbatim)
// =============================================================================
const leerlingenNietBeloftes = [
  "Geen test die je laat slagen of zakken.",
  "Geen oordeel over wie je bent of wat je kunt.",
  "Geen voorspelling die vastligt — jij houdt de koers.",
];

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
          Studie — voor leerlingen &amp; studenten
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Ontdek welke koers bij je talent past
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Een rustige, uitnodigende weg naar je eigen studiekompas. Geen druk, geen oordeel — alleen aandacht voor wat jou doet schitteren.
        </p>

        {/* welcome card + kompas svg */}
        <section className="mt-8 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className="rounded-2xl border border-l-[3px] border-border bg-card p-8"
            style={{ borderLeftColor: cs }}
          >
            <h3 className="font-serif text-xl font-semibold text-foreground sm:text-2xl">
              Welkom. Hier komt jouw koers in beeld.
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Kiezen wat je wil studeren is groot. Hier helpen we je niet door te zeggen wat je moet doen, maar door te laten zien wie je bent. Neem rustig de tijd — je bent op je plek, en je bent al onderweg.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/t4teens/">
                <Button
                  data-testid="button-start-verkenning"
                  style={{ background: cs, color: "#1a1a1a" }}
                >
                  Start jouw verkenning
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </a>
              <Link href="/poort/teens">
                <Button variant="outline" data-testid="button-heb-code">
                  Ik heb een code
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
              Zo werkt het
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Drie rustige stappen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Meer hoef je niet te onthouden.
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
              Je studiekompas
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Wat je aan het eind in handen hebt
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Geen cijfer en geen etiket, maar een rustig, persoonlijk beeld dat je helpt kiezen — op jouw manier.
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
              En net zo belangrijk
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
            Alles veilig, meertalig en met serverzijdige scoring. Je gegevens blijven van jou.
          </p>
        </section>

        {/* CTA section */}
        <section className="mx-auto mt-10 max-w-2xl">
          <div
            className="rounded-2xl border border-l-[3px] border-border bg-card p-7 text-center"
            style={{ borderLeftColor: cs }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Klaar om te beginnen?
            </p>
            <h3 className="mt-3 font-serif text-xl font-semibold text-foreground">
              Start meteen jouw verkenning
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Een paar korte vragen, ongeveer tien minuten. Geen toets, geen oordeel — alleen aandacht voor wat jou doet schitteren.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign("/t4teens/")}
              data-testid="button-start-t4teens"
              className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              style={{ background: cs }}
            >
              <Sparkles className="h-4 w-4" />
              Start mijn verkenning
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
          Terug naar de studie-wereld
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TaPas-platform · Studie voor leerlingen &amp; studenten · zelfde flow, serene indeling
          </p>
        </footer>
      </main>
    </div>
  );
}

// =============================================================================
// cze — instrumenten voor leerlingen data (verbatim)
// =============================================================================
const instrLeerlingen = [
  {
    naam: "T4Students",
    eyebrow: "Studiekompas",
    body: "Voor de laatste jaren secundair en de instroom in het hoger onderwijs. Een rustige verkenning die laat zien waar talent zit en welke studierichtingen daarbij aansluiten.",
    voorwie: "Leerlingen & studenten (16+)",
  },
  {
    naam: "T4Teens",
    eyebrow: "Studiekompas",
    body: "De jongere tegenhanger, met taal en tempo op maat van tieners. Een eerste, voorzichtige momentopname van talent en interesse — nooit een oordeel of voorspelling.",
    voorwie: "Jongere leerlingen",
  },
];

// =============================================================================
// uze — instrumenten voor teams & leiding data (verbatim)
// =============================================================================
const instrTeams = [
  {
    naam: "TaPas Teamscan",
    eyebrow: "Teams in beeld",
    body: "Laat een vakgroep of lerarenteam zichzelf in kaart brengen: hoe vullen talenten elkaar aan, waar zit de energie, waar de spanning.",
    voorwie: "Lerarenteams & vakgroepen",
  },
  {
    naam: "T4P Business Kompas",
    eyebrow: "Individueel talent",
    body: "Het volwassen talentprofiel voor wie in de school een leidende of dragende rol vervult — individueel inzicht in talent, motivatie en energie.",
    voorwie: "Directie & teamleden",
  },
  {
    naam: "T4Recruitment",
    eyebrow: "Aanwerving",
    body: "Een gesloten kring bouwt samen één rolprofiel, bijvoorbeeld bij het aanstellen van een nieuwe directie of coördinator.",
    voorwie: "Schoolbestuur & selectiecommissie",
  },
];

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
          Studie — de instrumenten
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Eén kompas per vraag
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Voor de jongere is er het studiekompas. Voor de school eromheen — teams en leiding — zijn er de instrumenten uit de werk-wereld, hier ingezet tegen het onderwijs-tarief.
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
                Voor leerlingen &amp; studenten
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                Het studiekompas
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
                Voor teams &amp; leiding
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                De school eromheen
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Een school is meer dan haar leerlingen. Dezelfde instrumenten die organisaties gebruiken, staan ook hier klaar — binnen je eigen schoolomgeving en tegen het onderwijs-tarief.
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
                Elk instrument vertrekt van talent, niet van een oordeel. Alle scoring gebeurt op de server, elke deelnemer geeft vooraf toestemming en je gegevens blijven binnen je eigen schoolomgeving. Meertalig en GDPR-conform.
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
            Aan de slag als school
          </Button>
          <Button
            variant="outline"
            data-testid="button-naar-leerlingen"
            onClick={() => navigate("/studie/leerlingen")}
          >
            <Users className="mr-1.5 h-4 w-4" />
            Ik ben leerling of student
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
          Terug naar de studie-wereld
        </button>

        {/* footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
            <Compass className="h-3.5 w-3.5" style={{ color: cs }} aria-hidden="true" />
            TaPas-platform · Studie-instrumenten · talent eerst, altijd sereen
          </p>
        </footer>
      </main>
    </div>
  );
}
