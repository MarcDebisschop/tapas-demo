import { useState } from "react";
import { Link } from "wouter";
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
  UserCircle,
  Compass,
  Target,
  Users,
  Sparkles,
  Coffee,
  ShieldCheck,
  Zap,
  GitBranch,
} from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { Rondleiding, startRondleiding } from "@/components/Rondleiding";
import { DEMO_MODE } from "@/lib/demoMode";

// ---------------------------------------------------------------------------
// HeroKompas — exact gereproduceerd vanuit de originele bundle (upe component)
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
// Hoofdpagina — exact gereconstrueerd vanuit de originele TaPas-7-2 bundle
// ---------------------------------------------------------------------------
export default function Home() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const instrumenten = [
    {
      icon: UserCircle,
      titel: "Mijn profiel",
      body: "Bekijk een uitgewerkt voorbeeld van een persoonlijk dashboard: je beeld in het kort, een gesproken uitleg van je profiel en een profielassistent waaraan je vragen kunt stellen.",
      href: "/dashboard/MarcDebisschopShowcaseT4P01",
      cta: "Voorbeeld bekijken",
      testid: "link-inst-profiel",
    },
    {
      icon: Compass,
      titel: t("home_inst_kompas_titel"),
      body: t("home_inst_kompas_body"),
      href: "/start",
      cta: t("home_cta_start"),
      testid: "link-inst-kompas",
    },
    {
      icon: Target,
      titel: t("home_inst_t4r_titel"),
      body: t("home_inst_t4r_body"),
      href: "/t4r",
      cta: t("home_cta_t4r"),
      testid: "link-inst-t4r",
    },
    {
      icon: Users,
      titel: t("home_inst_teamscan_titel"),
      body: t("home_inst_teamscan_body"),
      href: "/teamscan",
      cta: t("home_cta_teamscan"),
      testid: "link-inst-teamscan",
    },
    {
      icon: Sparkles,
      titel: "Impact-roos",
      body: "Collaboratief reflectie-instrument dat zelfperceptie naast die van collega's legt langs de assen Ruimte en Verbinding. Bekijk een uitgewerkt voorbeeld.",
      href: "/impact",
      cta: "Voorbeeld bekijken",
      testid: "link-inst-impact",
    },
    {
      icon: Zap,
      titel: "2MINSCAN",
      body: "Energetisch gedragsprofiel in drie stappen. Breng in beeld hoe je energie geeft en krijgt in samenwerking. Bekijk een uitgewerkt voorbeeldrapport.",
      href: "/2minscan",
      cta: "Bekijk voorbeeldrapport",
      testid: "link-inst-2minscan",
    },
    {
      icon: GitBranch,
      titel: "Human Due Diligence",
      body: "Vlaggenschip-instrument. Gefaseerde boarddiagnose via TaPas Teamscan, 2MINSCAN en T4P Business Kompas — met Go/No-Go-scharnier en twee afzonderlijke eindrapporten.",
      href: "/hdd",
      cta: "Traject bekijken",
      testid: "link-inst-hdd",
    },
    {
      icon: Coffee,
      titel: "TaPas Lounge",
      body: "De gemeenschappelijke ruimte van TaPasCity. Negen kamers: stilte, studie, muziek, café, inspiratie, werkplaats, reflectie, terras en webshop.",
      href: "/lounge",
      cta: "De lounge betreden",
      testid: "link-inst-lounge",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* NAVIGATIE */}
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
              aria-label={
                uiTaal === "fr" ? "Refaire le vol"
                : uiTaal === "en" ? "Take the flight"
                : uiTaal === "es" ? "Hacer el vuelo"
                : uiTaal === "ru" ? "Совершить полёт"
                : "Maak de vlucht"
              }
            >
              <Plane className="h-4 w-4" />
              <span className="hidden sm:inline">
                {uiTaal === "fr" ? "Le vol"
                : uiTaal === "en" ? "The flight"
                : uiTaal === "es" ? "El vuelo"
                : uiTaal === "ru" ? "Полёт"
                : "De vlucht"}
              </span>
            </button>
            <Link href="/admin">
              <button
                type="button"
                data-testid="button-admin-home"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Admin"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">

        {/* ---------------------------------------------------------------- */}
        {/* HERO                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              Het TaPas-platform
            </p>
            <h1 className="mt-4 font-serif text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[3.25rem]">
              Zie mensen<br />
              zoals ze <span className="text-accent">werkelijk</span> zijn.<br />
              En breng ze in beweging.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Eén platform, één doordachte gedachtegang — voor het werk én voor de studie. Met
              aandacht, zonder oordeel, en met respect voor wat ieder mens uniek maakt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                data-testid="button-kies-ingang"
                onClick={() => {
                  document.getElementById("kies")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Kies je wereld
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Link href="/voor-deelnemers">
                <Button variant="outline" data-testid="button-ik-ben-deelnemer">
                  Ik ben deelnemer
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroKompas />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* KIES JE WERELD                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section id="kies" className="mt-16 scroll-mt-24 sm:mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className="font-mono text-xs uppercase tracking-[0.18em]"
              style={{ color: "hsl(var(--studie))" }}
            >
              Eén huis, twee werelden
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2.4rem] sm:leading-[1.15]">
              Waar wil je je talent mobiliseren?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Het is dezelfde innerlijke kern — alleen in een andere fase van je leven. Kies je
              wereld, en je voelt je meteen op je plek.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {/* Werk & organisatie */}
            <Link href="/werk">
              <a
                data-testid="card-wereld-werk"
                data-tour="admin-cta"
                className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1"
                style={{
                  borderTopColor: "hsl(var(--werk))",
                  background: "radial-gradient(120% 95% at 100% 0%, hsl(var(--werk)/0.16) 0%, hsl(var(--card)) 60%)",
                }}
              >
                <p
                  className="font-mono text-xs uppercase tracking-[0.12em]"
                  style={{ color: "hsl(var(--werk))" }}
                >
                  Werk & organisatie
                </p>
                <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                  Mobiliseer je talent op het werk
                </h3>
                <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                  Zie de mens achter de functie: waar het talent zit, hoe het energie krijgt, en in
                  welke context het tot zijn recht komt.
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: "hsl(var(--werk))" }}
                >
                  Verken deze wereld
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            </Link>

            {/* Studie */}
            <Link href="/studie">
              <a
                data-testid="card-wereld-studie"
                data-tour="start-cta"
                className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-7 transition hover:-translate-y-1"
                style={{
                  borderTopColor: "hsl(var(--studie))",
                  background: "radial-gradient(120% 95% at 100% 0%, hsl(var(--studie)/0.16) 0%, hsl(var(--card)) 60%)",
                }}
              >
                <p
                  className="font-mono text-xs uppercase tracking-[0.12em]"
                  style={{ color: "hsl(var(--studie))" }}
                >
                  Studie
                </p>
                <h3 className="mt-3 font-serif text-xl font-semibold text-foreground sm:text-2xl">
                  Mobiliseer je talent in je studie
                </h3>
                <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                  Ontdek wie je bent en wat je doet schitteren — een serene, uitnodigende weg naar de
                  studiekoers die bij je talent past.
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: "hsl(var(--studie))" }}
                >
                  Verken deze wereld
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            </Link>
          </div>

          <p className="mt-6 text-center text-sm italic text-muted-foreground">
            Eén blik volstaat om te zien: dit is TaPas.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* INSTRUMENTEN-SUITE (voor deelnemers die direct willen doorklikken) */}
        {/* ---------------------------------------------------------------- */}
        <section id="instrumenten-suite" className="mt-16 scroll-mt-20 sm:mt-24" data-tour="suite">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("home_suite_titel")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("home_suite_intro")}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instrumenten.map((inst, i) => {
              const Icon = inst.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col rounded-xl border border-border bg-card p-5"
                  data-testid={`card-instrument-${i}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{inst.titel}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {inst.body}
                  </p>
                  <div className="mt-4">
                    <Link href={inst.href}>
                      <Button variant="outline" size="sm" data-testid={inst.testid}>
                        {inst.cta}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 border-t border-border pt-6 sm:mt-24">
          <p className="text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-footer-note">
            {t("home_footer_note")}
          </p>
        </footer>
      </main>

      {/* Rondleiding — welkom-uitnodiging bij eerste bezoek, vlucht pas na klik */}
      <Rondleiding taal={uiTaal} autoStart={true} />
    </div>
  );
}
