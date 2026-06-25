// =============================================================================
// /studie — Wereld Studie landingspagina
// Exact gebaseerd op tapas-fase1-preview /#/studie (screenshot Marc, 25/06/2026)
// Kleur: hsl(var(--studie)) = warm amber
// =============================================================================
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  GraduationCap,
  UserCircle,
  BookOpen,
  School,
  Compass,
  Heart,
  ChevronLeft,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Kompas SVG (hergebruikt van home.tsx — zelfde SVG-component)
// ---------------------------------------------------------------------------
function StudieKompas() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      className="h-44 w-44 sm:h-56 sm:w-56"
      style={{ color: "hsl(var(--studie))" }}
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
      <g transform="rotate(12 100 100)">
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
// Studie — Hoofd component
// ---------------------------------------------------------------------------
export default function Studie() {
  const studie = "hsl(var(--studie))";

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* NAVIGATIE */}
      <AppHeader
        right={
          <Link href="/">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Terug</span>
            </button>
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">

        {/* ---------------------------------------------------------------- */}
        {/* HERO                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {/* Breadcrumb badge */}
            <div
              className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]"
              style={{ borderColor: studie, color: studie }}
            >
              <Compass className="h-3.5 w-3.5" />
              Wereld — Studie
            </div>

            <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: studie }}>
              Studie
            </p>
            <h1 className="mt-4 font-serif text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[3.25rem]">
              Mobiliseer je talent<br />
              <span style={{ color: studie }}>in je studie</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Warm, sereen en uitnodigend. Hier wordt talent ontdekt en gevormd —
              voor wie jongeren begeleidt én voor wie zelf zijn studiekoers zoekt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                data-testid="button-studie-leerling"
                style={{ background: studie, color: "#fff", borderColor: studie }}
                onClick={() => {
                  document.getElementById("ingangen")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <Heart className="mr-1.5 h-4 w-4" />
                Ik ben leerling of student
              </Button>
              <Button
                variant="outline"
                data-testid="button-studie-school"
                onClick={() => {
                  document.getElementById("ingangen")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Ik begeleid een school
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <StudieKompas />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* KIES JE INGANG                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section id="ingangen" className="mt-16 scroll-mt-24 sm:mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: studie }}>
              Kies je ingang
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2.4rem] sm:leading-[1.15]">
              Begeleid je, of verken je zelf?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Dezelfde gedachtegang, twee invalshoeken. De weg is hoe dan ook dezelfde — je
              talent zichtbaar maken en in beweging brengen.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {/* Voor scholen & begeleiders */}
            <div
              className="group relative overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1 cursor-default"
              style={{
                borderTopColor: studie,
                background: `radial-gradient(120% 95% at 100% 0%, hsl(var(--studie)/0.14) 0%, hsl(var(--card)) 60%)`,
              }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ background: `hsl(var(--studie)/0.15)` }}
              >
                <School className="h-5 w-5" style={{ color: studie }} />
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.12em]" style={{ color: studie }}>
                Voor scholen &amp; begeleiders
              </p>
              <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                Begeleid, verstuur &amp; volg
              </h3>
              <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                Nodig leerlingen en studenten uit, volg hun verkenning en lees
                hun studiekompas — individueel en per klas. Breng waar nodig
                begeleiding op maat.
              </p>
              <div className="mt-5">
                <Link href="/start">
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition group-hover:gap-2"
                    style={{ color: studie }}
                  >
                    Ga naar de begeleideromgeving
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>

            {/* Voor leerlingen & studenten */}
            <div
              className="group relative overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1 cursor-default"
              style={{
                borderTopColor: studie,
                background: `radial-gradient(120% 95% at 100% 0%, hsl(var(--studie)/0.14) 0%, hsl(var(--card)) 60%)`,
              }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ background: `hsl(var(--studie)/0.15)` }}
              >
                <UserCircle className="h-5 w-5" style={{ color: studie }} />
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.12em]" style={{ color: studie }}>
                Voor leerlingen &amp; studenten
              </p>
              <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                Ontdek welke koers bij je talent past
              </h3>
              <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                Een rustige, uitnodigende weg naar je eigen studiekompas. Geen
                druk, geen oordeel — alleen aandacht voor wat jou
                uniek maakt en wat je in beweging brengt.
              </p>
              <div className="mt-5">
                <Link href="/mijn">
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition group-hover:gap-2"
                    style={{ color: studie }}
                  >
                    Start je verkenning
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* WAT IS HET STUDIEKOMPAS                                           */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-16 scroll-mt-20 sm:mt-24">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: studie }}>
              Het instrument
            </p>
            <h2 className="mt-3 font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Wat is het T4Students Studiekompas?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Het Studiekompas is een psychometrisch instrument dat jongeren in de laatste
              jaren van het secundair onderwijs of bij de instroom in het hoger onderwijs helpt
              om hun talentfoci, talentversnellers en drivers te ontdekken. Geen loopbaantest,
              geen hokjesdenken — een spiegel die laat zien wat er al in je zit.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  titel: "Talentfoci",
                  body: "Drie of vier focusgebieden die laten zien waar je talent van nature zijn beste kant laat zien.",
                },
                {
                  icon: GraduationCap,
                  titel: "Talentversnellers",
                  body: "De contexten, werkvormen en omstandigheden die jouw talent versnellen en in beweging brengen.",
                },
                {
                  icon: Compass,
                  titel: "Drivers",
                  body: "Wat je intrinsiek motiveert — de innerlijke krachten die bepalen of je ergens energie van krijgt of verliest.",
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex flex-col gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: `hsl(var(--studie)/0.15)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: studie }} />
                    </div>
                    <h3 className="font-semibold text-foreground">{item.titel}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CTA onderaan                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-16 sm:mt-24">
          <div
            className="overflow-hidden rounded-2xl border border-t-[3px] p-8 text-center sm:p-12"
            style={{
              borderTopColor: studie,
              background: `radial-gradient(ellipse at top, hsl(var(--studie)/0.12) 0%, hsl(var(--card)) 65%)`,
              borderColor: `hsl(var(--border))`,
            }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: studie }}>
              Klaar om te beginnen?
            </p>
            <h2 className="mt-3 font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Eén blik volstaat om te zien: dit is TaPas.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Of je nu een leerling bent die zijn koers zoekt, of een begeleider die
              jongeren wil helpen groeien — hier begin je.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/start">
                <Button
                  data-testid="button-studie-start"
                  style={{ background: studie, color: "#fff", borderColor: studie }}
                >
                  Start het studiekompas
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" data-testid="button-studie-terug">
                  Terug naar de startpagina
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 border-t border-border pt-6 sm:mt-24">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TaPas — Eén platform, één gedachtegang. Voor werk én voor studie.
          </p>
        </footer>
      </main>
    </div>
  );
}
