// =============================================================================
// werk.tsx — exact reconstructed from zip-8 bundle (T8e + E8e[werk] + K$)
// Bundle vars: T8e=component, E8e=data, K$=RolKaart
// Icon mapping (Xe factory → lucide):
//   zc=Users (werk begeleider), gg=CircleUserRound (deelnemer)
//   vs=Compass (badge), ml=ArrowLeft (terug), Wn=ArrowRight (K$ cta)
//   Mm=WereldNav (taal-indicator + terug-knop, identiek aan studie.tsx)
// =============================================================================

import { useLocation, Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import {
  ArrowLeft,
  ArrowRight,
  CircleUserRound,
  Compass,
  Users,
} from "lucide-react";

// Mm — WereldNav (verbatim from bundle: taal-indicator + terug-naar-voordeur)
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

// K$ rolkaart component (exact uit bundle)
function RolKaart({
  rol,
  kleurVar,
  primair,
}: {
  rol: {
    eyebrow: string;
    titel: string;
    body: string;
    href: string;
    cta: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  kleurVar: string;
  primair?: boolean;
}) {
  const Icon = rol.icon;
  const kleur = `hsl(var(${kleurVar}))`;
  return (
    <Link href={rol.href}>
      <a
        data-testid={`rolkaart-${primair ? "begeleider" : "deelnemer"}`}
        className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1"
        style={{
          borderTopColor: kleur,
          background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${kleurVar})/0.13) 0%, hsl(var(--card)) 60%)`,
        }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: `hsl(var(${kleurVar})/0.16)`, color: kleur }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p
          className="mt-4 font-mono text-xs uppercase tracking-[0.12em]"
          style={{ color: kleur }}
        >
          {rol.eyebrow}
        </p>
        <h3 className="mt-2 font-serif text-xl font-semibold text-foreground sm:text-2xl">
          {rol.titel}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {rol.body}
        </p>
        <span
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: kleur }}
        >
          {rol.cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </a>
    </Link>
  );
}

// E8e[werk] data (exact uit bundle)
const werkData = {
  slug: "werk",
  kleurVar: "--werk",
  badge: "Wereld — werk & organisatie",
  eyebrow: "Werk & organisatie",
  titel: "Mobiliseer je talent op het werk",
  intro:
    "Koel, helder en stabiel. Hier wordt talent herkend en geleid — voor wie mensen begeleidt én voor wie zelf op verkenning gaat.",
  begeleider: {
    eyebrow: "Voor begeleiders & organisaties",
    titel: "Bouw, verstuur & begeleid",
    body: "Nodig medewerkers uit, volg de voortgang en lees rapporten — individueel, in teams en op organisatieniveau. Alles in één veilige, meertalige beheeromgeving.",
    href: "/voor-begeleiders",
    cta: "Naar de beheeromgeving",
    icon: Users,
  },
  deelnemer: {
    eyebrow: "Voor deelnemers",
    titel: "Je TaPas verkennen op een veilige plek",
    body: "Een heldere, laagdrempelige weg naar je eigen profiel. Neem rustig de tijd — je bent op je plek, en je bent al onderweg.",
    href: "/voor-deelnemers",
    cta: "Naar de poort",
    icon: CircleUserRound,
  },
};

// T8e component (exact uit bundle) — wereld-pagina voor /werk
export default function Werk() {
  const [, navigate] = useLocation();
  const r = werkData;
  const kleur = `hsl(var(${r.kleurVar}))`;

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* radial gradient achtergrond */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
          style={{
            background: `radial-gradient(70% 100% at 50% -20%, hsl(var(${r.kleurVar})/0.12) 0%, transparent 70%)`,
          }}
        />

        {/* Badge (vs=Compass) */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `hsl(var(${r.kleurVar})/0.14)`,
            color: kleur,
            borderColor: `hsl(var(${r.kleurVar})/0.4)`,
          }}
        >
          <Compass className="h-3.5 w-3.5" />
          {r.badge}
        </span>

        {/* Titel grid */}
        <div className="mt-5 grid items-start gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p
              className="font-mono text-xs uppercase tracking-[0.16em]"
              style={{ color: kleur }}
            >
              {r.eyebrow}
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
              {r.titel}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              {r.intro}
            </p>
          </div>
        </div>

        {/* Kies je ingang */}
        <div className="mx-auto mt-9 max-w-2xl text-center">
          <p
            className="font-mono text-xs uppercase tracking-[0.16em]"
            style={{ color: kleur }}
          >
            Kies je ingang
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Begeleid je, of verken je zelf?
          </h2>
        </div>

        {/* Rolkaarten */}
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <RolKaart rol={r.begeleider} kleurVar={r.kleurVar} primair={true} />
          <RolKaart rol={r.deelnemer} kleurVar={r.kleurVar} />
        </div>

        {/* Terug knop (ml=ArrowLeft) */}
        <button
          type="button"
          onClick={() => navigate("/")}
          data-testid="link-terug-voordeur"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar de voordeur
        </button>

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TaPas-platform · {r.eyebrow} · dezelfde routes, dezelfde zorg
          </p>
        </footer>
      </main>
    </div>
  );
}
