// =============================================================================
// client/src/pages/instrumenten.tsx  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// De Instrumentengids: één centrale, publiek raadpleegbare pagina met ALLE
// TaPas-instrumenten. Filterbaar op oriëntatie (alles / business / education /
// beide). "Beide"-instrumenten krijgen een gesplitste rand (links werk-teal,
// rechts studie-amber) — de duo-kleur die Marc bevestigde.
//
// Databronnen worden op canoniek `id` samengevoegd (Regel 1: nooit herbouwen):
//   1. INSTRUMENTENGIDS (client/src/data/instrumentengids.ts) — gids-metadata
//   2. /api/instrumenten/catalogus                            — beschrijving,
//                                                               credits, rapport
//   3. /api/gids                                              — admin-overrides
//
// Per kaart: fiche-PDF-download (/api/instrumentengids/:id/fiche.pdf).
// Bovenaan: link naar de volledige brochure (HTML-preview + PDF).
// =============================================================================

import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Zap,
  Users,
  Flower2,
  Target,
  Landmark,
  Trophy,
  Backpack,
  GraduationCap,
  Download,
  BookOpen,
  ArrowRight,
  UserSearch,
  Layers,
} from "lucide-react";
import {
  INSTRUMENTENGIDS,
  orientatieLabel,
  type GidsInstrument,
  type Orientatie,
} from "@/data/instrumentengids";

// --- CSS-variabelen (hergebruik bestaande platformkleuren, NIET wijzigen) ---
const WERK_VAR = "--werk";
const STUDIE_VAR = "--studie";
const werkKleur = `hsl(var(${WERK_VAR}))`;
const studieKleur = `hsl(var(${STUDIE_VAR}))`;

// Lucide-icoonnaam (string in de data) → component
const ICONEN: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Compass,
  Zap,
  Users,
  Flower2,
  Target,
  Landmark,
  Trophy,
  Backpack,
  GraduationCap,
};

type Filter = "alles" | "business" | "education" | "beide";

// Override-shape uit /api/gids: { [id]: { [veld]: { [taal]: tekst } } }
type GidsOverrides = Record<string, Record<string, Record<string, string>>>;

interface CatalogusItem {
  id: string;
  naam: string;
  flowType: string;
  beschrijving: string | null;
  creditCost: number | null;
  doelgroep: string | null;
  useCases: string[];
  outcome: string | null;
  rapport: string | null;
  emoji: string;
}

/** Pas een NL-override toe (valt terug op de default). */
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

function orientatieKleur(o: Orientatie): string {
  if (o === "business") return werkKleur;
  if (o === "education") return studieKleur;
  return werkKleur; // "beide": primaire tekst-accent = werk (rand is gesplitst)
}

// =============================================================================
// Instrument-kaart
// =============================================================================
function GidsKaart({
  instr,
  catalog,
  overrides,
}: {
  instr: GidsInstrument;
  catalog?: CatalogusItem;
  overrides?: GidsOverrides;
}) {
  const [, navigate] = useLocation();
  const Icon = ICONEN[instr.icoon] ?? Layers;
  const isBeide = instr.orientatie === "beide";
  const accent = orientatieKleur(instr.orientatie);

  // Tekst: override > catalogus > gids-default
  const omschrijving = metOverride(
    overrides,
    instr.id,
    "omschrijving",
    catalog?.beschrijving || instr.omschrijving
  );
  const beantwoordt = metOverride(overrides, instr.id, "beantwoordt", instr.beantwoordt);
  const gebruik = metOverride(overrides, instr.id, "gebruik", instr.gebruik);
  const doelgroep = metOverride(
    overrides,
    instr.id,
    "doelgroep",
    catalog?.doelgroep || instr.doelgroep
  );
  const rapportTeaser = metOverride(overrides, instr.id, "rapportTeaser", instr.rapportTeaser);

  // Gesplitste rand voor "beide": links werk, rechts studie.
  const randStyle: React.CSSProperties = isBeide
    ? {
        borderTopWidth: 3,
        borderTopStyle: "solid",
        borderImageSlice: 1,
        borderImageSource: `linear-gradient(90deg, ${werkKleur} 0%, ${werkKleur} 50%, ${studieKleur} 50%, ${studieKleur} 100%)`,
      }
    : { borderTopColor: accent, borderTopWidth: 3, borderTopStyle: "solid" };

  return (
    <div
      className="flex flex-col rounded-2xl border border-border bg-card p-6"
      style={randStyle}
      data-orientatie={instr.orientatie}
    >
      {/* kop: icoon + oriëntatie-badge */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={
            isBeide
              ? {
                  background: `linear-gradient(90deg, ${werkKleur}22 0%, ${studieKleur}22 100%)`,
                  color: "hsl(var(--foreground))",
                  border: `1px solid ${werkKleur}55`,
                }
              : { background: `${accent}1a`, color: accent, border: `1px solid ${accent}55` }
          }
        >
          {orientatieLabel(instr.orientatie)}
        </span>
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: accent }}>
        {instr.eyebrow}
      </p>
      <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">{instr.naam}</h3>

      {instr.leeftijdsfocus && (
        <p className="mt-1 text-xs font-medium" style={{ color: accent }}>
          {instr.leeftijdsfocus}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{omschrijving}</p>

      {/* velden */}
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-foreground">Welke vragen beantwoordt het?</dt>
          <dd className="mt-0.5 leading-relaxed text-muted-foreground">{beantwoordt}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Hoe kan ik het verder gebruiken?</dt>
          <dd className="mt-0.5 leading-relaxed text-muted-foreground">{gebruik}</dd>
        </div>
      </dl>

      {/* rapport-teaser (deel A) + visuele mini-preview (deel B) */}
      <div
        className="mt-4 rounded-xl border border-border p-3"
        style={{ background: "hsl(var(--muted)/0.4)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: accent }}>
          Wat je terugkrijgt
        </p>
        <div className="mt-1 flex items-start gap-3">
          {instr.rapportPreview && (
            <img
              src={instr.rapportPreview}
              alt={`Rapport-voorbeeld ${instr.naam}`}
              className="h-16 w-12 shrink-0 rounded-md border border-border object-cover"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{rapportTeaser}</p>
        </div>
      </div>

      {/* doelgroep */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <UserSearch className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{doelgroep}</span>
      </div>

      {/* acties */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          style={{ background: accent, color: "white" }}
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
    </div>
  );
}

// =============================================================================
// Filterbalk
// =============================================================================
function FilterBalk({ actief, setActief }: { actief: Filter; setActief: (f: Filter) => void }) {
  const opties: { key: Filter; label: string; kleur?: string }[] = [
    { key: "alles", label: "Alle instrumenten" },
    { key: "beide", label: "Business & Education" },
    { key: "business", label: "Business", kleur: werkKleur },
    { key: "education", label: "Education", kleur: studieKleur },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter op oriëntatie">
      {opties.map((o) => {
        const aan = actief === o.key;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={aan}
            onClick={() => setActief(o.key)}
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            style={
              aan
                ? {
                    background: o.kleur ?? "hsl(var(--foreground))",
                    color: "white",
                    borderColor: o.kleur ?? "hsl(var(--foreground))",
                  }
                : {
                    background: "transparent",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Hoofdpagina
// =============================================================================
export default function Instrumenten() {
  const [filter, setFilter] = useState<Filter>("alles");

  const { data: catalogus } = useQuery<CatalogusItem[]>({
    queryKey: ["/api/instrumenten/catalogus"],
  });
  const { data: overrides } = useQuery<GidsOverrides>({
    queryKey: ["/api/gids"],
  });

  const catalogById = useMemo(() => {
    const m = new Map<string, CatalogusItem>();
    (catalogus ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [catalogus]);

  const zichtbaar = useMemo(
    () =>
      INSTRUMENTENGIDS.filter((i) => (filter === "alles" ? true : i.orientatie === filter)),
    [filter]
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* achtergrond-gloed */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
          style={{
            background: `radial-gradient(60% 100% at 50% -20%, ${werkKleur}14 0%, ${studieKleur}10 55%, transparent 80%)`,
          }}
        />

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{
            background: `${werkKleur}14`,
            color: werkKleur,
            borderColor: `${werkKleur}55`,
          }}
        >
          <Layers className="h-3.5 w-3.5" />
          De Instrumentengids
        </span>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Alle TaPas-instrumenten in één overzicht
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Van het volledige TaPas Kompas tot een snelle energiecheck, teamdynamiek, selectie,
          bestuurlijke doorlichting en talentprofielen voor sport en onderwijs. Elk instrument
          beantwoordt een eigen vraag — filter op toepassing en ontdek wat past.
        </p>

        {/* Brochure-call-to-action */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/instrumenten/brochure">
            <Button variant="outline" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Bekijk de volledige brochure
            </Button>
          </Link>
          <a href="/api/instrumentengids/brochure.pdf?taal=nl" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" className="gap-2">
              <Download className="h-4 w-4" />
              Brochure als PDF
            </Button>
          </a>
        </div>

        {/* Filter */}
        <div className="mt-8">
          <FilterBalk actief={filter} setActief={setFilter} />
        </div>

        {/* Grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {zichtbaar.map((instr) => (
            <GidsKaart
              key={instr.id}
              instr={instr}
              catalog={catalogById.get(instr.id)}
              overrides={overrides}
            />
          ))}
        </div>

        {zichtbaar.length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">
            Geen instrumenten in deze categorie.
          </p>
        )}
      </main>
    </div>
  );
}
