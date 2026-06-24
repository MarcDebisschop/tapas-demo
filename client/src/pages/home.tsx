import { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Activity,
  FileText,
  ShieldCheck,
  Link2,
  Server,
  LayoutDashboard,
  Compass,
  Users,
  Target,
  ArrowRight,
  Languages,
  Sparkles,
  UserCircle,
  Plane,
  Coffee,
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

/**
 * Onderscheidend merkteken voor de hero: een grote kompasroos met
 * concentrische ring. Bouwt voort op het Logo-mark maar staat op zichzelf
 * als rustig, internationaal beeld. Kleur volgt de theme-tokens.
 */
function HeroKompas() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      className="h-44 w-44 sm:h-56 sm:w-56 text-accent"
      role="img"
      aria-hidden="true"
    >
      {/* Buitenring */}
      <circle cx="100" cy="100" r="92" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="100" cy="100" r="74" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      {/* Tick-markeringen rondom (32 streepjes) */}
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i * 360) / 32;
        const major = i % 8 === 0;
        return (
          <line
            key={i}
            x1="100"
            y1={major ? 12 : 16}
            x2="100"
            y2={major ? 22 : 20}
            stroke="currentColor"
            strokeWidth={major ? 1.6 : 0.8}
            opacity={major ? 0.5 : 0.25}
            transform={`rotate(${angle} 100 100)`}
          />
        );
      })}
      {/* Kompasnaald — noord (gevuld), zuid (zacht) */}
      <path d="M100 24 L116 100 L100 88 L84 100 Z" fill="currentColor" />
      <path d="M100 176 L84 100 L100 112 L116 100 Z" fill="currentColor" opacity="0.3" />
      {/* Horizontale as */}
      <path d="M28 100 L172 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Kern */}
      <circle cx="100" cy="100" r="9" fill="currentColor" />
      <circle cx="100" cy="100" r="4" fill="var(--card, #fff)" />
    </svg>
  );
}

export default function Home() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const pijlers = [
    {
      icon: Send,
      iconClass: "text-accent",
      titel: t("home_pijler_versturen_titel"),
      body: t("home_pijler_versturen_body"),
    },
    {
      icon: Activity,
      iconClass: "text-accent",
      titel: t("home_pijler_monitoren_titel"),
      body: t("home_pijler_monitoren_body"),
    },
    {
      icon: FileText,
      iconClass: "text-accent",
      titel: t("home_pijler_rapporteren_titel"),
      body: t("home_pijler_rapporteren_body"),
    },
  ];

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
      icon: Coffee,
      titel: "TaPas Lounge",
      body: "De gemeenschappelijke ruimte van TaPasCity. Negen kamers: stilte, studie, muziek, café, inspiratie, werkplaats, reflectie, terras en webshop.",
      href: "/lounge",
      cta: "De lounge betreden",
      testid: "link-inst-lounge",
    },
  ];

  const stappen = [
    { icon: ShieldCheck, titel: t("home_stap1_titel"), body: t("home_stap1_body") },
    { icon: Link2, titel: t("home_stap2_titel"), body: t("home_stap2_body") },
    { icon: Server, titel: t("home_stap3_titel"), body: t("home_stap3_body") },
    { icon: LayoutDashboard, titel: t("home_stap4_titel"), body: t("home_stap4_body") },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
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
              aria-label={uiTaal === "fr" ? "Refaire le vol" : uiTaal === "en" ? "Take the flight" : uiTaal === "es" ? "Hacer el vuelo" : uiTaal === "ru" ? "\u0421\u043e\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u043f\u043e\u043b\u0451\u0442" : "Maak de vlucht"}
            >
              <Plane className="h-4 w-4" />
              <span className="hidden sm:inline">
                {uiTaal === "fr" ? "Le vol" : uiTaal === "en" ? "The flight" : uiTaal === "es" ? "El vuelo" : uiTaal === "ru" ? "\u041f\u043e\u043b\u0451\u0442" : "De vlucht"}
              </span>
            </button>
            <Link href="/admin">
              <Button variant="outline" size="sm" data-testid="link-admin" data-tour="admin-cta">
                {t("admin_titel")}
              </Button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        {/* ---------- Warm welkom (subtiel goud-accent) ---------- */}
        <section
          className="mb-10 rounded-xl border-l-2 py-4 pl-5 pr-4 sm:mb-12 sm:py-5 sm:pl-6"
          style={{
            borderLeftColor: "hsl(var(--gold))",
            background:
              "linear-gradient(90deg, hsl(var(--gold) / 0.08) 0%, hsl(var(--gold) / 0.025) 60%, transparent 100%)",
          }}
          data-testid="section-welkom"
        >
          <h2
            className="text-base font-semibold tracking-tight sm:text-lg"
            style={{ color: "hsl(var(--gold))" }}
            data-testid="text-welkom-titel"
          >
            {t("home_welkom_titel")}
          </h2>
          <p
            className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]"
            data-testid="text-welkom-body"
          >
            {t("home_welkom_body")}
          </p>
        </section>

        {/* ---------- Hero ---------- */}
        <section className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent" data-testid="text-eyebrow">
              {t("home_eyebrow")}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[2.4rem] sm:leading-[1.15]">
              {t("home_titel")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {t("home_intro")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                data-testid="button-start-afname"
                data-tour="start-cta"
                onClick={() => {
                  const el = document.getElementById("instrumenten-suite");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t("home_cta_ontdek")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Link href="/admin">
                <Button variant="outline" data-testid="button-open-admin">
                  {t("home_cta_admin")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="rounded-full bg-card p-6 ring-1 ring-border">
              <HeroKompas />
            </div>
          </div>
        </section>

        {/* ---------- Drie pijlers ---------- */}
        <section className="mt-16 sm:mt-20">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {t("home_pijlers_titel")}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {pijlers.map((p, i) => {
              const Icon = p.icon;
              return (
                <Card key={i} data-testid={`card-pijler-${i}`}>
                  <CardContent className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className={`h-5 w-5 ${p.iconClass}`} />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{p.titel}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------- Instrumenten-suite ---------- */}
        <section id="instrumenten-suite" className="mt-16 scroll-mt-20 sm:mt-20" data-tour="suite">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {t("home_suite_titel")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("home_suite_intro")}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instrumenten.map((inst, i) => {
              const Icon = inst.icon;
              return (
                <Card key={i} className="flex flex-col" data-testid={`card-instrument-${i}`}>
                  <CardContent className="flex flex-1 flex-col p-5">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------- Hoe het werkt ---------- */}
        <section className="mt-16 sm:mt-20" data-tour="keten">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {t("home_keten_titel")}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stappen.map((s, i) => {
              const Icon = s.icon;
              return (
                <Card key={i} data-testid={`card-stap-${i}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{s.titel}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------- Footer-noot ---------- */}
        <footer className="mt-16 border-t border-border pt-6 sm:mt-20">
          <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-footer-note">
            {t("home_footer_note")}
          </p>
        </footer>
      </main>

      {/* In-app rondleiding: "De vlucht" — start automatisch bij eerste bezoek,
          herstartbaar via de knop in de header. */}
      <Rondleiding taal={uiTaal} autoStart />
    </div>
  );
}
