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
  ArrowDown,
  Languages,
  Plane,
  UserCircle,
  Compass,
  Target,
  Users,
  Sparkles,
  Coffee,
  ArrowRight,
  Building2,
  GraduationCap,
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
// Kompas SVG — merkteken rechts in hero
// ---------------------------------------------------------------------------
function HeroKompas() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      className="h-56 w-56 sm:h-72 sm:w-72 opacity-80"
      role="img"
      aria-hidden="true"
    >
      {/* Buitenringen */}
      <circle cx="100" cy="100" r="94" stroke="hsl(38 47% 40%)" strokeWidth="1" opacity="0.35" />
      <circle cx="100" cy="100" r="76" stroke="hsl(38 47% 40%)" strokeWidth="0.8" opacity="0.2" />
      <circle cx="100" cy="100" r="58" stroke="hsl(38 47% 40%)" strokeWidth="0.6" opacity="0.15" />
      {/* Tick-markeringen */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 360) / 36;
        const major = i % 9 === 0;
        return (
          <line
            key={i}
            x1="100" y1={major ? 8 : 14}
            x2="100" y2={major ? 20 : 18}
            stroke="hsl(38 47% 40%)"
            strokeWidth={major ? 1.8 : 0.7}
            opacity={major ? 0.6 : 0.25}
            transform={`rotate(${angle} 100 100)`}
          />
        );
      })}
      {/* Noordnaald — teal/groen */}
      <path d="M100 22 L112 100 L100 90 L88 100 Z" fill="hsl(174 60% 40%)" />
      {/* Zuidnaald — goud, zwakker */}
      <path d="M100 178 L88 100 L100 110 L112 100 Z" fill="hsl(38 47% 40%)" opacity="0.4" />
      {/* Horizontale as */}
      <line x1="20" y1="100" x2="180" y2="100" stroke="hsl(38 47% 40%)" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
      {/* Kern */}
      <circle cx="100" cy="100" r="10" fill="hsl(174 60% 40%)" opacity="0.9" />
      <circle cx="100" cy="100" r="4" fill="hsl(220 15% 8%)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hoofdpagina
// ---------------------------------------------------------------------------
export default function Home() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const instrumenten = [
    {
      icon: UserCircle,
      titel: "Mijn profiel",
      body: "Bekijk een uitgewerkt voorbeeld van een persoonlijk dashboard: je beeld in het kort, een gesproken uitleg en een profielassistent.",
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
      body: "Collaboratief reflectie-instrument dat zelfperceptie naast die van collega's legt langs de assen Ruimte en Verbinding.",
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

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* NAVIGATIE                                                            */}
      {/* ------------------------------------------------------------------ */}
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
              aria-label="De vlucht starten"
            >
              <Plane className="h-4 w-4" />
              <span className="hidden sm:inline">De vlucht</span>
            </button>
          </div>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative flex min-h-[92dvh] flex-col items-start justify-center overflow-hidden px-6 sm:px-12 lg:px-20"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 68% 44%, hsl(174 60% 12% / 0.35) 0%, transparent 70%), hsl(220 15% 8%)",
        }}
      >
        {/* Kompas achtergrond rechts */}
        <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-30 sm:right-16 sm:opacity-40 lg:right-24 lg:opacity-55">
          <HeroKompas />
        </div>

        <div className="relative z-10 max-w-2xl">
          {/* Eyebrow */}
          <p
            className="mb-5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "hsl(174 60% 52%)" }}
          >
            Het TaPas-Platform
          </p>

          {/* Hoofdtitel */}
          <h1
            className="text-4xl font-light leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.6rem]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Zie mensen{" "}
            <span
              className="italic"
              style={{ color: "hsl(174 60% 52%)" }}
            >
              zoals ze werkelijk
            </span>{" "}
            zijn.
            <br />
            En breng ze in beweging.
          </h1>

          {/* Subtekst */}
          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Eén platform, één doordachte gedachtegang — voor het werk én voor de studie. Met
            aandacht, zonder oordeel, en met respect voor wat ieder mens uniek maakt.
          </p>

          {/* CTA-knoppen */}
          <div className="mt-9 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => {
                document.getElementById("werelden")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              style={{ background: "hsl(174 60% 40%)" }}
            >
              Kies je wereld
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("instrumenten-suite")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-sm font-semibold transition hover:bg-accent/10"
              style={{
                borderColor: "hsl(var(--gold) / 0.5)",
                color: "hsl(var(--gold))",
              }}
            >
              Ik ben deelnemer
            </button>
          </div>
        </div>

        {/* Scroll-hint onderaan */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-30">
          <ArrowDown className="h-5 w-5 animate-bounce text-muted-foreground" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTIE 2 — ÉÉN HUIS, TWEE WERELDEN                                 */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="werelden"
        className="px-6 py-20 sm:px-12 sm:py-28 lg:px-20"
        style={{ background: "hsl(220 15% 6%)" }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "hsl(var(--gold))" }}
          >
            Één huis, twee werelden
          </p>
          <h2
            className="text-3xl font-light leading-tight tracking-tight sm:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Waar wil je je talent mobiliseren?
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Het is dezelfde innerlijke kern — alleen in een andere fase van je leven. Kies je wereld,
            en je voelt je meteen op je plek.
          </p>

          {/* Twee wereld-kaarten */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* Wereld 1: Werk */}
            <div
              className="group relative rounded-2xl border p-8 text-left transition hover:border-[hsl(174_60%_40%/0.6)]"
              style={{
                borderColor: "hsl(174 60% 40% / 0.2)",
                background: "hsl(174 60% 40% / 0.05)",
              }}
            >
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "hsl(174 60% 40% / 0.15)" }}
              >
                <Building2 className="h-6 w-6" style={{ color: "hsl(174 60% 52%)" }} />
              </div>
              <h3 className="text-xl font-semibold">Voor het werk</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Talentprofiel, teamanalyse, selectie en ontwikkeling — voor professionals, coaches en
                organisaties die mensen begrijpen én in beweging brengen.
              </p>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("instrumenten-suite")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition"
                style={{ color: "hsl(174 60% 52%)" }}
              >
                Ontdek de instrumenten
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Wereld 2: Studie */}
            <div
              className="group relative rounded-2xl border p-8 text-left transition hover:border-[hsl(38_47%_40%/0.6)]"
              style={{
                borderColor: "hsl(38 47% 40% / 0.2)",
                background: "hsl(38 47% 40% / 0.05)",
              }}
            >
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "hsl(38 47% 40% / 0.15)" }}
              >
                <GraduationCap className="h-6 w-6" style={{ color: "hsl(38 60% 62%)" }} />
              </div>
              <h3 className="text-xl font-semibold">Voor de studie</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Studiekompas voor jongeren die hun richting zoeken — gefundeerd in talent, gedreven
                door wat hen werkelijk beweegt.
              </p>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("instrumenten-suite")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition"
                style={{ color: "hsl(38 60% 62%)" }}
              >
                Ontdek T4Students
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTIE 3 — INSTRUMENTEN-SUITE                                       */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="instrumenten-suite"
        className="scroll-mt-20 px-6 py-20 sm:px-12 sm:py-28 lg:px-20"
        style={{ background: "hsl(220 15% 8%)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "hsl(var(--gold))" }}
          >
            Wat je hier vindt
          </p>
          <h2
            className="text-3xl font-light tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {t("home_suite_titel")}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t("home_suite_intro")}
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {instrumenten.map((inst, i) => {
              const Icon = inst.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col rounded-xl border p-6 transition hover:border-[hsl(174_60%_40%/0.4)]"
                  style={{ borderColor: "hsl(215 20% 18%)", background: "hsl(220 15% 6%)" }}
                  data-testid={`card-instrument-${i}`}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "hsl(174 60% 40% / 0.12)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "hsl(174 60% 52%)" }} />
                  </div>
                  <h3 className="text-base font-semibold">{inst.titel}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {inst.body}
                  </p>
                  <div className="mt-5">
                    <Link href={inst.href}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-accent/10"
                        style={{
                          borderColor: "hsl(174 60% 40% / 0.35)",
                          color: "hsl(174 60% 52%)",
                        }}
                        data-testid={inst.testid}
                      >
                        {inst.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="border-t px-6 py-10 text-center sm:px-12 lg:px-20"
        style={{ borderColor: "hsl(215 20% 14%)", background: "hsl(220 15% 6%)" }}
      >
        <p className="text-xs text-muted-foreground" data-testid="text-footer-note">
          {t("home_footer_note")}
        </p>
      </footer>

      {/* ------------------------------------------------------------------ */}
      {/* RONDLEIDING — autoStart uitgeschakeld in demo-modus                 */}
      {/* ------------------------------------------------------------------ */}
      <Rondleiding taal={uiTaal} autoStart={!DEMO_MODE} />
    </div>
  );
}
