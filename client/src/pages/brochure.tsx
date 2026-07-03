// =============================================================================
// client/src/pages/brochure.tsx  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// HTML-preview van de vlaggenschip-brochure van De Instrumentengids. Toont
// alle negen instrumenten gegroepeerd per oriëntatie, met bovenaan een cover-
// blok en een download-knop naar de drukklare PDF (/api/instrumentengids/
// brochure.pdf). Dezelfde inhoud/volgorde als de server-side PDF.
// =============================================================================

import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Layers, ArrowRight } from "lucide-react";
import {
  INSTRUMENTENGIDS,
  orientatieLabel,
  type GidsInstrument,
  type Orientatie,
} from "@/data/instrumentengids";

const werkKleur = "hsl(var(--werk))";
const studieKleur = "hsl(var(--studie))";

type GidsOverrides = Record<string, Record<string, Record<string, string>>>;

function metOverride(
  ov: GidsOverrides | undefined,
  id: string,
  veld: string,
  standaard: string
): string {
  const perVeld = ov?.[id]?.[veld];
  if (!perVeld) return standaard;
  return perVeld["nl"] ?? standaard;
}

function accentVoor(o: Orientatie): string {
  if (o === "business") return werkKleur;
  if (o === "education") return studieKleur;
  return werkKleur;
}

interface Groep {
  orientatie: Orientatie;
  titel: string;
  kicker: string;
  intro: string;
  instrumenten: GidsInstrument[];
}

const GROEP_META: Omit<Groep, "instrumenten">[] = [
  {
    orientatie: "beide",
    titel: "Voor business én onderwijs",
    kicker: "Universeel inzetbaar",
    intro:
      "Deze instrumenten werken even goed in een bedrijfscontext als in het onderwijs. Ze vormen de ruggengraat van het platform: van het volledige talentprofiel tot een snelle energiecheck en collectieve teamdynamiek.",
  },
  {
    orientatie: "business",
    titel: "Voor business",
    kicker: "Selectie, board & governance",
    intro:
      "Specifiek voor recruitment, leiderschap en bestuurlijke doorlichting. Hier zit ook het vlaggenschip Human Due Diligence — de diepste analyse in het TaPas-arsenaal.",
  },
  {
    orientatie: "education",
    titel: "Voor onderwijs & sport",
    kicker: "Studiekeuze, jongeren & atleten",
    intro:
      "Afgestemd op leerlingen, studenten en atleten — met leeftijdsspecifieke taal en focus op studiekeuze, loopbaanstart en mentaal talent onder druk.",
  },
];

function BrochureInstrument({
  instr,
  overrides,
}: {
  instr: GidsInstrument;
  overrides?: GidsOverrides;
}) {
  const [, navigate] = useLocation();
  const accent = accentVoor(instr.orientatie);
  const isBeide = instr.orientatie === "beide";

  const omschrijving = metOverride(overrides, instr.id, "omschrijving", instr.omschrijving);
  const beantwoordt = metOverride(overrides, instr.id, "beantwoordt", instr.beantwoordt);
  const gebruik = metOverride(overrides, instr.id, "gebruik", instr.gebruik);
  const doelgroep = metOverride(overrides, instr.id, "doelgroep", instr.doelgroep);
  const rapportTeaser = metOverride(overrides, instr.id, "rapportTeaser", instr.rapportTeaser);

  const randStyle: React.CSSProperties = isBeide
    ? {
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderImageSlice: 1,
        borderImageSource: `linear-gradient(180deg, ${werkKleur} 0%, ${werkKleur} 50%, ${studieKleur} 50%, ${studieKleur} 100%)`,
      }
    : { borderLeftColor: accent, borderLeftWidth: 4, borderLeftStyle: "solid" };

  return (
    <article className="rounded-2xl border border-border bg-card p-6 pl-7" style={randStyle}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: accent }}>
            {instr.eyebrow}
          </p>
          <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">{instr.naam}</h3>
          {instr.leeftijdsfocus && (
            <p className="mt-0.5 text-xs font-medium" style={{ color: accent }}>
              {instr.leeftijdsfocus}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}55` }}
        >
          {orientatieLabel(instr.orientatie)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{omschrijving}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Welke vragen beantwoordt het?</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{beantwoordt}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Hoe kan ik het verder gebruiken?</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{gebruik}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Voor wie?</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{doelgroep}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Wat je terugkrijgt</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{rapportTeaser}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          style={{ background: accent, color: "white" }}
          className="gap-1.5"
          onClick={() => navigate(instr.start.route)}
        >
          {instr.start.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <a
          href={`/api/instrumentengids/${instr.id}/fiche.pdf?taal=nl`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Fiche (PDF)
          </Button>
        </a>
      </div>
    </article>
  );
}

export default function Brochure() {
  const { data: overrides } = useQuery<GidsOverrides>({ queryKey: ["/api/gids"] });

  const groepen = useMemo<Groep[]>(
    () =>
      GROEP_META.map((g) => ({
        ...g,
        instrumenten: INSTRUMENTENGIDS.filter((i) => i.orientatie === g.orientatie),
      })),
    []
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <Link href="/instrumenten">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Terug naar de gids
          </Button>
        </Link>

        {/* Cover-blok */}
        <section
          className="overflow-hidden rounded-3xl p-8 sm:p-12"
          style={{
            background: "linear-gradient(135deg, #0f2733 0%, #16384a 100%)",
            color: "white",
          }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ background: "rgba(202,162,74,0.16)", color: "#caa24a" }}
          >
            <Layers className="h-3.5 w-3.5" />
            De volledige gids
          </span>
          <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            De Instrumentengids
          </h1>
          <div className="mt-4 h-1 w-20 rounded" style={{ background: "#caa24a" }} />
          <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "#cfe0e6" }}>
            Alle talentinstrumenten van het TaPas Platform in één overzicht — voor business én
            onderwijs. Negen instrumenten, gegroepeerd naar toepassing.
          </p>
          <a
            href="/api/instrumentengids/brochure.pdf?taal=nl"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-block"
          >
            <Button className="gap-2" style={{ background: "#caa24a", color: "#0f2733" }}>
              <Download className="h-4 w-4" />
              Download de brochure (PDF)
            </Button>
          </a>
        </section>

        {/* Groepen */}
        {groepen.map((g) => {
          const accent = accentVoor(g.orientatie);
          return (
            <section key={g.orientatie} className="mt-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: accent }}>
                {g.kicker}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                {g.titel}
              </h2>
              <div className="mt-2 h-0.5 w-16 rounded" style={{ background: accent }} />
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {g.intro}
              </p>
              <div className="mt-6 space-y-5">
                {g.instrumenten.map((instr) => (
                  <BrochureInstrument key={instr.id} instr={instr} overrides={overrides} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Afsluiter */}
        <section className="mt-14 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="font-serif text-2xl font-semibold text-foreground">Klaar om te starten?</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Twijfel je welk instrument past bij je vraag? Begin met de 2MinScan voor een snelle
            indicatie, of het volledige TaPas Kompas voor een diepgaand talentprofiel.
          </p>
          <Link href="/instrumenten">
            <Button className="mt-5 gap-2">
              Terug naar de gids
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
