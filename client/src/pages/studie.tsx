// =============================================================================
// /studie — Wereld Studie — exact gereconstrueerd uit tapas-fase1-preview bundle
// Sub-routes: /studie/scholen  /studie/leerlingen  /studie/instrumenten
// =============================================================================
import { useLocation } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ChevronLeft,
  GraduationCap,
  UserCircle,
  School,
  Compass,
  BookOpen,
  ShieldCheck,
  Heart,
  CheckCircle,
} from "lucide-react";
import { Link } from "wouter";

const KLEUR_VAR = "--studie";
const cs = `hsl(var(${KLEUR_VAR}))`;

// ---------------------------------------------------------------------------
// Kompas SVG — exact uit fase1-preview (Y8e / ize)
// ---------------------------------------------------------------------------
function StudieKompas() {
  const lijnen = Array.from({ length: 24 }).map((_, n) => {
    const r = (n / 24) * Math.PI * 2;
    const major = n % 6 === 0;
    const s = 84;
    const o = major ? 74 : 79;
    return (
      <line
        key={n}
        x1={(100 + Math.sin(r) * s).toFixed(1)}
        y1={(100 - Math.cos(r) * s).toFixed(1)}
        x2={(100 + Math.sin(r) * o).toFixed(1)}
        y2={(100 - Math.cos(r) * o).toFixed(1)}
        stroke={cs}
        strokeWidth={major ? 1.5 : 0.8}
        opacity={major ? 0.6 : 0.3}
      />
    );
  });

  return (
    <svg viewBox="0 0 200 200" fill="none" className="h-44 w-44 sm:h-56 sm:w-56" aria-hidden="true">
      <circle cx="100" cy="100" r="92" stroke={cs} strokeWidth="1.5" opacity="0.2" />
      <circle cx="100" cy="100" r="74" stroke={cs} strokeWidth="1" opacity="0.12" />
      {lijnen}
      {/* Kompasnaald */}
      <g transform="rotate(12 100 100)">
        <path d="M100 20 L108 100 L100 90 L92 100 Z" fill={cs} />
        <path d="M100 180 L92 100 L100 110 L108 100 Z" fill={cs} opacity="0.25" />
      </g>
      <circle cx="100" cy="100" r="8" fill={cs} />
      <circle cx="100" cy="100" r="6" fill="hsl(var(--background))" stroke={cs} strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rol-kaart (gebruikt in hoofd /studie pagina)
// ---------------------------------------------------------------------------
interface RolKaartProps {
  eyebrow: string;
  titel: string;
  body: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  testid: string;
}

function RolKaart({ eyebrow, titel, body, href, cta, icon: Icon, testid }: RolKaartProps) {
  return (
    <Link href={href}>
      <a
        data-testid={testid}
        className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1"
        style={{
          borderTopColor: cs,
          background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${KLEUR_VAR})/0.16) 0%, hsl(var(--card)) 60%)`,
        }}
      >
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg"
          style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
        >
          <Icon className="h-5 w-5" style={{ color: cs }} />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.12em]" style={{ color: cs }}>
          {eyebrow}
        </p>
        <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
          {titel}
        </h3>
        <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">{body}</p>
        <span
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: cs }}
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </a>
    </Link>
  );
}

// ===========================================================================
// Pagina 1: /studie  (hoofd-landingspagina)
// ===========================================================================
export function StudiePagina() {
  const [, navigate] = useLocation();

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<LanguagelessTerug href="/" label="Terug naar de voordeur" />} />

      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Achtergrond-decoratie */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-25"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 60% 0%, hsl(var(${KLEUR_VAR})/0.35) 0%, transparent 70%)`,
          }}
        />

        {/* Badge */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${KLEUR_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${KLEUR_VAR})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          Wereld — studie
        </span>

        {/* Hero */}
        <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Studie
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
              Mobiliseer je talent in je studie
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Warm, sereen en uitnodigend. Hier wordt talent ontdekt en gevormd — voor wie
              jongeren begeleidt én voor wie zelf zijn studiekoers zoekt.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                data-testid="button-start-leerling"
                onClick={() => navigate("/studie/leerlingen")}
                style={{ background: cs, color: "#1a1a1a", borderColor: cs }}
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
            <StudieKompas />
          </div>
        </div>

        {/* Kies je ingang */}
        <section className="mt-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Kies je ingang
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Begeleid je, of verken je zelf?
            </h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <RolKaart
              eyebrow="Voor scholen & begeleiders"
              titel="Begeleid, verstuur & volg"
              body="Nodig leerlingen en studenten uit, volg hun verkenning en lees hun studiekompas — individueel en per klas. Alles in één veilige, meertalige beheeromgeving."
              href="/studie/scholen"
              cta="Naar de beheeromgeving"
              icon={School}
              testid="rolkaart-scholen"
            />
            <RolKaart
              eyebrow="Voor leerlingen & studenten"
              titel="Ontdek welke koers bij je talent past"
              body="Een rustige, uitnodigende weg naar je eigen studiekompas. Geen druk, geen oordeel — alleen aandacht voor wat jou doet schitteren."
              href="/studie/leerlingen"
              cta="Start jouw verkenning"
              icon={UserCircle}
              testid="rolkaart-leerlingen"
            />
          </div>
        </section>

        {/* De instrumenten block */}
        <section className="mt-12">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              De instrumenten
            </p>
            <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
              Eén kompas per vraag
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Het studiekompas voor leerlingen en studenten, plus de instrumenten voor teams en
              leiding binnen de school — telkens tegen het onderwijs-tarief.
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              data-testid="button-bekijk-instrumenten"
              onClick={() => navigate("/studie/instrumenten")}
            >
              Bekijk de instrumenten
            </Button>
          </div>
        </section>

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

// ===========================================================================
// Pagina 2: /studie/scholen
// ===========================================================================
export function StudieScholenPagina() {
  const [, navigate] = useLocation();

  const stappen = [
    {
      icon: School,
      titel: "Richt je school in",
      body: "Maak je schoolomgeving aan en bepaal wie begeleidt. Eén veilige, meertalige beheeromgeving voor je hele team.",
    },
    {
      icon: UserCircle,
      titel: "Nodig leerlingen uit",
      body: "Per leerling of per klas, met een persoonlijke link. Iedere jongere geeft eerst zelf toestemming — consent vooraf.",
    },
    {
      icon: BookOpen,
      titel: "Volg en lees mee",
      body: "Volg de voortgang en lees elk studiekompas — individueel en per klas — zodra het klaar is.",
    },
  ];

  const instrumenten = [
    {
      icon: UserCircle,
      eyebrow: "Leerlingen & studenten",
      titel: "Het studiekompas",
      body: "T4Students en T4Teens begeleiden jongeren naar een studiekeuze die bij hun talent past — als rustige verkenning, niet als test.",
      chips: ["T4Students", "T4Teens"],
    },
    {
      icon: School,
      eyebrow: "Lerarenteams & vakgroepen",
      titel: "Sterkere teams",
      body: "Laat een vakgroep of lerarenteam zichzelf in kaart brengen. Hoe werken we samen, wat versterkt ons en wat wrijft?",
      chips: ["Teamscan"],
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<LanguagelessTerug href="/studie" label="Terug naar de studie-wereld" />} />

      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-20"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 60% 0%, hsl(var(${KLEUR_VAR})/0.4) 0%, transparent 70%)`,
          }}
        />

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${KLEUR_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${KLEUR_VAR})/0.4)`,
          }}
        >
          <School className="h-3.5 w-3.5" />
          Studie — voor scholen &amp; begeleiders
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Begeleid, verstuur &amp; volg
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Nodig leerlingen en studenten uit, volg hun verkenning en lees hun studiekompas —
          individueel en per klas. En waar nodig breng je ook je eigen team en leiding in kaart.
          Alles in één veilige, meertalige beheeromgeving.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin">
            <Button
              data-testid="button-naar-beheer"
              style={{ background: cs, color: "#1a1a1a", borderColor: cs }}
            >
              Naar de beheeromgeving
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="outline"
            data-testid="button-bekijk-instrumenten"
            onClick={() => navigate("/studie/instrumenten")}
          >
            Bekijk de instrumenten
          </Button>
        </div>

        {/* 3 stappen */}
        <section className="mt-14">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              In drie stappen
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Van uitnodiging tot studiekompas
            </h2>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {stappen.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-6">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: cs }} />
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">{s.titel}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Instrumenten */}
        <section className="mt-14">
          <div className="grid gap-5 sm:grid-cols-2">
            {instrumenten.map((inst, i) => {
              const Icon = inst.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-6">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: cs }} />
                  </div>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                    {inst.eyebrow}
                  </p>
                  <h3 className="mt-1 font-semibold text-foreground">{inst.titel}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{inst.body}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {inst.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        style={{ borderColor: `hsl(var(${KLEUR_VAR})/0.4)`, color: cs }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Privacy */}
        <section className="mt-14">
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Privacy &amp; veiligheid
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Veilig, meertalig en GDPR-conform
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Elke jongere geeft vooraf toestemming, alle scoring gebeurt op de server en je
              gegevens blijven binnen je eigen schoolomgeving. Meertalig, GDPR-conform en met
              respect voor wat elke leerling uniek maakt.
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Terug naar de studie-wereld
        </button>

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

// ===========================================================================
// Pagina 3: /studie/leerlingen
// ===========================================================================
export function StudieLeerlingenPagina() {
  const [, navigate] = useLocation();

  const stappen = [
    {
      nr: "1",
      icon: UserCircle,
      titel: "Je ontvangt een uitnodiging",
      body: "Je begint met de uitnodiging van je school. Je geeft eerst zelf je toestemming — niets gebeurt zonder dat.",
    },
    {
      nr: "2",
      icon: BookOpen,
      titel: "Je verkent op je eigen tempo",
      body: "Een vragenlijst in twee delen, in je eigen taal. Geen goede of foute antwoorden — alleen wat bij jou past.",
    },
    {
      nr: "3",
      icon: Compass,
      titel: "Je ontdekt je studiekompas",
      body: "Een persoonlijk rapport dat laat zien waar je talent zit, wat je energie geeft, en welke richtingen daarbij passen.",
    },
  ];

  const resultaten = [
    {
      icon: Compass,
      titel: "Waar je talent zit",
      body: "De foci en versnellers die jou typeren — niet als etiket, maar als startpunt voor je keuze.",
    },
    {
      icon: Heart,
      titel: "Wat je energie geeft",
      body: "Waar je vanzelf naartoe beweegt en waar je juist energie verliest, zodat je koers ook vol te houden is.",
    },
    {
      icon: ArrowRight,
      titel: "Welke richtingen passen",
      body: "Studierichtingen en domeinen die aansluiten bij wie je bent — als inspiratie, niet als voorschrift.",
    },
  ];

  const geenOordeel = [
    "Geen test die je laat slagen of zakken.",
    "Geen oordeel over wie je bent of wat je kunt.",
    "Geen voorspelling die vastligt — jij houdt de koers.",
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<LanguagelessTerug href="/studie" label="Terug naar de studie-wereld" />} />

      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-20"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 60% 0%, hsl(var(${KLEUR_VAR})/0.4) 0%, transparent 70%)`,
          }}
        />

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${KLEUR_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${KLEUR_VAR})/0.4)`,
          }}
        >
          <UserCircle className="h-3.5 w-3.5" />
          Studie — voor leerlingen &amp; studenten
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Ontdek welke koers bij je talent past
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Een rustige, uitnodigende weg naar je eigen studiekompas. Geen druk, geen oordeel —
          alleen aandacht voor wat jou doet schitteren.
        </p>

        {/* 3 stappen */}
        <section className="mt-8 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className="rounded-2xl border border-l-[3px] border-border bg-card p-8"
            style={{ borderLeftColor: cs }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Hoe werkt het?
            </p>
            <div className="mt-5 space-y-6">
              {stappen.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.nr} className="flex items-start gap-4">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: `hsl(var(${KLEUR_VAR})/0.2)`, color: cs }}
                    >
                      {s.nr}
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">{s.titel}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Geen oordeel */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Wat dit níét is
            </p>
            <div className="mt-5 space-y-3">
              {geenOordeel.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cs }} />
                  <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wat je aan het eind hebt */}
        <section className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Je studiekompas
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Wat je aan het eind in handen hebt
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Geen cijfer en geen etiket. Wél een helder beeld van wie je bent en waar je energie
              vandaan komt.
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {resultaten.map((r, i) => {
              const Icon = r.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: cs }} />
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">{r.titel}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/mijn")}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            style={{ background: cs }}
          >
            <Heart className="h-4 w-4" />
            Start mijn verkenning
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Terug naar de studie-wereld
        </button>

        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TaPas-platform · Studie voor leerlingen &amp; studenten · zelfde flow, serene indeling
          </p>
        </footer>
      </main>
    </div>
  );
}

// ===========================================================================
// Pagina 4: /studie/instrumenten
// ===========================================================================
export function StudieInstrumentenPagina() {
  const [, navigate] = useLocation();

  const jongeren = [
    {
      naam: "T4Students",
      eyebrow: "Studiekompas",
      body: "Voor de laatste jaren secundair en de instroom in het hoger onderwijs. Een rustige verkenning die laat zien waar talent zit en welke studierichtingen daarbij aansluiten.",
      voorwie: "Leerlingen & studenten (16+)",
    },
    {
      naam: "T4Teens",
      eyebrow: "Studiekompas",
      body: "De jongere tegenhanger, met taal en beeldtaal afgestemd op wie nog zoekende is. Dezelfde ernst, een andere verpakking.",
      voorwie: "Jongeren (12–16)",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<LanguagelessTerug href="/studie" label="Terug naar de studie-wereld" />} />

      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-20"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 60% 0%, hsl(var(${KLEUR_VAR})/0.4) 0%, transparent 70%)`,
          }}
        />

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${KLEUR_VAR})/0.14)`,
            color: cs,
            borderColor: `hsl(var(${KLEUR_VAR})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          Studie — de instrumenten
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Eén kompas per vraag
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Voor de jongere is er het studiekompas. Voor het team is er de teamscan. Altijd tegen
          het onderwijs-tarief, altijd met dezelfde zorg.
        </p>

        {/* Voor jongeren */}
        <section className="mt-14">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
              style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
            >
              <UserCircle className="h-5 w-5" style={{ color: cs }} />
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
            {jongeren.map((inst) => (
              <div key={inst.naam} className="rounded-xl border border-border bg-card p-5">
                <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                  {inst.eyebrow}
                </p>
                <h3 className="mt-1 font-semibold text-foreground">{inst.naam}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{inst.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Voor wie:</span> {inst.voorwie}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Voor teams */}
        <section className="mt-14">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
              style={{ background: `hsl(var(${KLEUR_VAR})/0.15)` }}
            >
              <School className="h-5 w-5" style={{ color: cs }} />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
                Lerarenteams &amp; vakgroepen
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                Sterkere teams
              </h2>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Laat een vakgroep of lerarenteam zichzelf in kaart brengen. Hoe werken we samen, wat
              versterkt ons en wat wrijft? De teamscan geeft een helder, eerlijk beeld — zonder
              oordeel, met oog voor wat al werkt.
            </p>
            <span
              className="mt-3 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium"
              style={{ borderColor: `hsl(var(${KLEUR_VAR})/0.4)`, color: cs }}
            >
              Teamscan
            </span>
          </div>
        </section>

        {/* Privacy */}
        <section className="mt-14">
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: cs }}>
              Privacy &amp; veiligheid
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Gebouwd op vertrouwen
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Geen lek, geen oordeel. Alle scoring gebeurt op de server, elke deelnemer geeft
              vooraf toestemming en je gegevens blijven binnen je eigen schoolomgeving. Meertalig
              en GDPR-conform.
            </p>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            data-testid="button-naar-scholen"
            onClick={() => navigate("/studie/scholen")}
            style={{ background: cs, color: "#1a1a1a", borderColor: cs }}
          >
            <Heart className="mr-1.5 h-4 w-4" />
            Aan de slag als school
          </Button>
          <Button
            variant="outline"
            data-testid="button-naar-leerlingen"
            onClick={() => navigate("/studie/leerlingen")}
          >
            <UserCircle className="mr-1.5 h-4 w-4" />
            Ik ben leerling of student
          </Button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/studie")}
          data-testid="link-terug-studie"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Terug naar de studie-wereld
        </button>

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

// ---------------------------------------------------------------------------
// Gedeeld: kleine terug-knop zonder taalkiezer
// ---------------------------------------------------------------------------
function LanguagelessTerug({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </Link>
  );
}

// Default export = hoofd /studie
export default StudiePagina;
