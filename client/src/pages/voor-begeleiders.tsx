// =============================================================================
// voor-begeleiders.tsx — exact reconstructed from zip-8 bundle (C8e + k8e + L4)
// Bundle vars: C8e=component, k8e=Tegel, L4=Sectie
// Tegels-data: w8e=Dagelijks werk, _8e=Mensen & communicatie, j8e=Begeleiding
// Icon mapping:
//   eK=ClipboardList, iK=Coins, ca=ShieldCheck
//   Ef=Mail, c3=TrendingUp (ChartLine→TrendingUp), dK=LogIn
//   zc=Users, voe=UserCog, ml=ArrowLeft, Wn=ArrowRight
// =============================================================================

import { useLocation, Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Coins,
  LogIn,
  Mail,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

// WereldNav (Mm) — identiek aan werk.tsx en studie.tsx
function WereldNav() {
  const [, navigate] = useLocation();
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
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[13px] text-muted-foreground transition hover:text-foreground"
        data-testid="button-voordeur"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voordeur
      </button>
    </div>
  );
}

// k8e — Tegel component (exact uit bundle)
function Tegel({
  tegel,
}: {
  tegel: {
    icon: React.ComponentType<{ className?: string }>;
    titel: string;
    body: string;
    href: string;
    route: string;
    testid: string;
    primair?: boolean;
  };
}) {
  const Icon = tegel.icon;
  const kleur = tegel.primair ? "hsl(var(--primary))" : "hsl(var(--accent))";
  return (
    <Link href={tegel.href}>
      <a
        data-testid={tegel.testid}
        className="group block rounded-xl border border-l-[3px] border-border bg-card p-6 transition hover:-translate-y-0.5"
        style={{ borderLeftColor: kleur }}
      >
        <div
          className="grid h-10 w-10 place-items-center rounded-lg"
          style={{
            background: tegel.primair
              ? "hsl(var(--primary)/0.18)"
              : "hsl(var(--accent)/0.14)",
            color: kleur,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="mt-3.5 text-base font-semibold text-foreground">
          {tegel.titel}
        </h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {tegel.body}
        </p>
        <span
          className="mt-3 block font-mono text-[11.5px]"
          style={{ color: kleur }}
        >
          behoudt {tegel.route}
        </span>
      </a>
    </Link>
  );
}

// L4 — Sectie met tegels (exact uit bundle)
function Sectie({
  titel,
  tegels,
}: {
  titel: string;
  tegels: React.ComponentProps<typeof Tegel>["tegel"][];
}) {
  return (
    <>
      <div className="mt-10 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {titel}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tegels.map((t) => (
          <Tegel key={t.testid} tegel={t} />
        ))}
      </div>
    </>
  );
}

// w8e — Dagelijks werk
const dagellijksWerk = [
  {
    icon: ClipboardList,
    titel: "Afnames & uitnodigingen",
    body: "Overzicht van alle afnames, nieuwe deelnemers uitnodigen en links delen.",
    href: "/admin",
    route: "/admin",
    testid: "tegel-admin",
  },
  {
    icon: Coins,
    titel: "Credits & saldo",
    body: "Het creditsysteem dat afnames mogelijk maakt, per organisatie.",
    href: "/admin/credits",
    route: "/admin/credits",
    testid: "tegel-credits",
  },
  {
    icon: ShieldCheck,
    titel: "Toegang",
    body: "Wie mag wat — toegangsbeheer voor je organisatie.",
    href: "/admin/toegang",
    route: "/admin/toegang",
    testid: "tegel-toegang",
  },
];

// _8e — Mensen & communicatie
const mensenCommunicatie = [
  {
    icon: Users,
    titel: "Coaches",
    body: "Accreditaties en zichtbaarheid in het publieke coachregister.",
    href: "/admin/coaches",
    route: "/admin/coaches",
    testid: "tegel-coaches",
  },
  {
    icon: Mail,
    titel: "Mailbeheer & huisstijl",
    body: "Mailteksten per taal, logo, accentkleur en white-label per organisatie.",
    href: "/admin/mailbeheer",
    route: "/admin/mailbeheer",
    testid: "tegel-mailbeheer",
  },
  {
    icon: TrendingUp,
    titel: "Inzichten & onderzoek",
    body: "Analytics en het onderzoeksgezicht van de Academy.",
    href: "/admin/inzichten",
    route: "/admin/inzichten",
    testid: "tegel-inzichten",
  },
];

// j8e — Begeleiding
const begeleiding = [
  {
    icon: UserCog,
    titel: "Coach-werkomgeving",
    body: "De eigen werkplek voor coaches, los van het organisatiebeheer.",
    href: "/coach",
    route: "/coach",
    testid: "tegel-coach",
    primair: true,
  },
];

// C8e — /voor-begeleiders pagina (exact uit bundle)
export default function VoorBegeleiders() {
  const [, navigate] = useLocation();

  return (
    <div className="wereld-pagina min-h-[100dvh] bg-background">
      <AppHeader right={<WereldNav />} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
          ● Wereld 1 — sturen & begeleiden
        </span>

        {/* Titel */}
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Voor begeleiders & organisaties
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Eén overzichtelijke regiekamer: nodig deelnemers uit, volg de voortgang en lees rapporten. Alles wat je nodig hebt om te sturen, op één plek.
        </p>

        {/* Admin CTA */}
        <div className="mt-7 flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Beheerder? Kom hier binnen.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Meld je aan met je beheerderstoegang en open het volledige Admin-platform.
            </p>
          </div>
          <Link href="/admin">
            <a
              data-testid="button-open-admin"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              Open het Admin-platform
              <ArrowRight className="h-4 w-4" />
            </a>
          </Link>
        </div>

        {/* Tegels-secties */}
        <Sectie titel="Dagelijks werk" tegels={dagellijksWerk} />
        <Sectie titel="Mensen & communicatie" tegels={mensenCommunicatie} />
        <Sectie titel="Begeleiding" tegels={begeleiding} />

        {/* Terug knop */}
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
            TaPas-platform · Wereld 1 voor begeleiders & organisaties · zelfde routes, heldere indeling
          </p>
        </footer>
      </main>
    </div>
  );
}
