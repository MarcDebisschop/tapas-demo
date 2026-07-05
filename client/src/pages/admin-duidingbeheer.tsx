/**
 * Admin Duidingsbeheer — prior-beheerder beheert de LIVE AI-duidinglaag van T4P
 *
 * Blauwdruk = admin-vraagbeheer.tsx (zelfde stijl, prior-only). Strikt additief:
 * raakt het bestaande statische rapportpad niet aan.
 *
 * Features:
 *  - Aan/uit-schakelaar "Live AI-duiding" (default UIT — veilig voor de pilot)
 *  - Regie-prompt per taal (bewerkbaar, herstelbaar naar de concept-default)
 *  - Per-dimensie ankers per taal (bewerkbaar, herstelbaar), gegroepeerd per familie
 *  - Zichtbaar of een veld een override heeft t.o.v. de concept-default
 *  - Audit-historiek per veld + CSV-export
 *
 * Beveiliging: enkel is_prior=true beheerders. De server verifieert dit ook.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Power,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Anker {
  dimensie: string;
  familie: string;
  tekst: string;
  heeftOverride: boolean;
  origineel: string;
}

interface DuidingData {
  taal: string;
  instrument: string;
  liveDuidingAan: boolean;
  regiePrompt: { tekst: string; heeftOverride: boolean; origineel: string };
  ankers: Anker[];
}

const TALEN = ["nl", "fr", "en", "es", "ru"] as const;
type Taal = typeof TALEN[number];

const TAAL_LABELS: Record<Taal, string> = {
  nl: "🇧🇪 NL",
  fr: "🇫🇷 FR",
  en: "🇬🇧 EN",
  es: "🇪🇸 ES",
  ru: "🇷🇺 RU",
};

// ─── Bewerkbaar tekstveld (regie-prompt of anker) ─────────────────────────────

function TekstKaart({
  titel,
  familie,
  tekst,
  origineel,
  heeftOverride,
  logKey,
  onSave,
  onReset,
}: {
  titel: string;
  familie?: string;
  tekst: string;
  origineel: string;
  heeftOverride: boolean;
  logKey: { scope: string; dimensie: string };
  onSave: (tekst: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<any[]>([]);

  const huidige = edit ?? tekst;
  const gewijzigd = edit !== null && edit !== tekst;

  async function opslaan() {
    if (!huidige.trim() || !gewijzigd) return;
    setSaving(true);
    await onSave(huidige.trim());
    setSaving(false);
    setSaved(true);
    setEdit(null);
    setTimeout(() => setSaved(false), 2000);
  }

  async function laadLog() {
    try {
      const r = await fetch(`/api/admin/duidingbeheer/${logKey.scope}/${encodeURIComponent(logKey.dimensie)}/log`);
      const d = await r.json();
      setLog(d.log ?? []);
    } catch {}
    setLogOpen(true);
  }

  return (
    <div className={`rounded-xl border ${heeftOverride ? "border-amber-400/50 bg-amber-50/5" : "border-border"} bg-card p-4 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{titel}</span>
        {familie && <Badge variant="outline" className="text-xs">{familie}</Badge>}
        {heeftOverride && (
          <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30">
            ✏️ Aangepast
          </Badge>
        )}
      </div>

      {heeftOverride && (
        <div className="rounded-lg bg-blue-50/10 border border-blue-400/20 p-2">
          <p className="text-xs text-blue-400 font-medium mb-0.5">Concept-default:</p>
          <p className="text-xs text-muted-foreground italic">{origineel || "—"}</p>
        </div>
      )}

      <Textarea
        value={huidige}
        onChange={(e) => setEdit(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={opslaan} disabled={!gewijzigd || saving} className="gap-1.5">
          {saving ? (
            <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
          ) : saved ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saved ? "Opgeslagen!" : "Opslaan"}
        </Button>
        {heeftOverride && (
          <Button size="sm" variant="outline" onClick={onReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Herstel default
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { if (!logOpen) laadLog(); else setLogOpen(false); }}
          className="gap-1.5 text-muted-foreground ml-auto"
        >
          <Clock className="h-3.5 w-3.5" />
          Historiek
        </Button>
      </div>

      {logOpen && (
        <div className="rounded-lg bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Wijzigingshistoriek</p>
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Geen wijzigingen geregistreerd.</p>
          ) : log.map((entry, i) => (
            <div key={i} className="text-xs text-muted-foreground border-l-2 border-accent/30 pl-2">
              <span className="font-medium text-foreground">{TAAL_LABELS[entry.taal as Taal] ?? entry.taal}</span>
              {" — "}
              <span className="italic">"{entry.tekst.slice(0, 60)}{entry.tekst.length > 60 ? "…" : ""}"</span>
              <br />
              <span className="text-muted-foreground/70">{entry.gewijzigd_door} · {new Date(entry.gewijzigd_op).toLocaleString("nl-BE")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hoofdpagina ──────────────────────────────────────────────────────────────

export default function AdminDuidingbeheer() {
  const [taal, setTaal] = useState<Taal>("nl");
  const [data, setData] = useState<DuidingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [ankersOpen, setAnkersOpen] = useState(true);

  const laad = useCallback(async () => {
    setLoading(true);
    setFout(null);
    try {
      const r = await fetch(`/api/admin/duidingbeheer/${taal}`);
      if (!r.ok) {
        const e = await r.json();
        setFout(e.error ?? "Fout bij laden.");
        return;
      }
      setData(await r.json());
    } catch {
      setFout("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }, [taal]);

  useEffect(() => { laad(); }, [taal]);

  async function zetLive(aan: boolean) {
    await fetch(`/api/admin/duidingbeheer/config/live`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aan }),
    });
    await laad();
  }

  async function saveRegie(tekst: string) {
    await fetch(`/api/admin/duidingbeheer/regie-prompt/${taal}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst }),
    });
    await laad();
  }

  async function resetRegie() {
    await fetch(`/api/admin/duidingbeheer/regie-prompt/${taal}`, { method: "DELETE" });
    await laad();
  }

  async function saveAnker(dimensie: string, tekst: string) {
    await fetch(`/api/admin/duidingbeheer/anker/${encodeURIComponent(dimensie)}/${taal}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst }),
    });
    await laad();
  }

  async function resetAnker(dimensie: string) {
    await fetch(`/api/admin/duidingbeheer/anker/${encodeURIComponent(dimensie)}/${taal}`, { method: "DELETE" });
    await laad();
  }

  // Groepeer ankers per familie voor de weergave.
  const families = (data?.ankers ?? []).reduce<Record<string, Anker[]>>((acc, a) => {
    (acc[a.familie] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin">
            <a className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </a>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-accent" />
            Duidingsbeheer
          </span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">
            Duidingsbeheer
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Stuur de LIVE AI-duiding van het T4P-profiel: de regie-prompt (hoe het model duidt)
            en de per-dimensie ankers (toon en nadruk per T4P-dimensie), per taal. De cijfers
            komen uitsluitend uit de rekenlaag — het model verzint niets bij. Faalt de AI, dan
            valt de duiding automatisch terug op de bestaande sjabloontekst. Enkel toegankelijk
            voor prior-beheerders.
          </p>
        </div>

        {/* Aan/uit-schakelaar */}
        {data && (
          <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 mb-6 ${data.liveDuidingAan ? "border-emerald-400/50 bg-emerald-50/5" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${data.liveDuidingAan ? "text-emerald-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-semibold text-foreground">Live AI-duiding</p>
                <p className="text-xs text-muted-foreground">
                  {data.liveDuidingAan
                    ? "AAN — nieuwe T4P-rapporten krijgen een live AI-duiding (met sjabloon-fallback)."
                    : "UIT — T4P-rapporten gebruiken de bestaande statische sjabloontekst."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={data.liveDuidingAan ? "outline" : "default"}
              onClick={() => zetLive(!data.liveDuidingAan)}
              className="gap-1.5"
            >
              {data.liveDuidingAan ? "Zet uit" : "Zet aan"}
            </Button>
          </div>
        )}

        {/* Taalkiezer */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TALEN.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTaal(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                taal === t ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
              }`}
            >
              {TAAL_LABELS[t]}
            </button>
          ))}
          <a
            href={`/api/admin/duidingbeheer/export/csv`}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors ml-auto"
          >
            <Download className="h-4 w-4" />
            CSV export
          </a>
        </div>

        {/* Foutmelding */}
        {fout && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{fout}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="h-6 w-6 animate-spin border-2 border-accent border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {/* Regie-prompt */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Regie-prompt</h2>
              <TekstKaart
                titel={`Regie-prompt (${TAAL_LABELS[taal]})`}
                tekst={data.regiePrompt.tekst}
                origineel={data.regiePrompt.origineel}
                heeftOverride={data.regiePrompt.heeftOverride}
                logKey={{ scope: "regie-prompt", dimensie: "__algemeen__" }}
                onSave={saveRegie}
                onReset={resetRegie}
              />
            </section>

            {/* Ankers per familie */}
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setAnkersOpen(!ankersOpen)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider"
              >
                Ankers per dimensie
                {ankersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {ankersOpen && Object.entries(families).map(([familie, ankers]) => (
                <div key={familie} className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{familie}</p>
                  {ankers.map((a) => (
                    <TekstKaart
                      key={a.dimensie}
                      titel={a.dimensie}
                      familie={a.familie}
                      tekst={a.tekst}
                      origineel={a.origineel}
                      heeftOverride={a.heeftOverride}
                      logKey={{ scope: "anker", dimensie: a.dimensie }}
                      onSave={(tekst) => saveAnker(a.dimensie, tekst)}
                      onReset={() => resetAnker(a.dimensie)}
                    />
                  ))}
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
