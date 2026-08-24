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
  logUrl,
  regels = 3,
  bronLabel = "Concept-default",
  herstelLabel = "Herstel default",
  onSave,
  onReset,
}: {
  titel: string;
  familie?: string;
  tekst: string;
  origineel: string;
  heeftOverride: boolean;
  logUrl: string;
  regels?: number;
  bronLabel?: string;
  herstelLabel?: string;
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
      const r = await fetch(logUrl);
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
          <p className="text-xs text-blue-400 font-medium mb-0.5">{bronLabel}:</p>
          <p className="text-xs text-muted-foreground italic">{origineel || "geen"}</p>
        </div>
      )}

      <Textarea
        value={huidige}
        onChange={(e) => setEdit(e.target.value)}
        rows={regels}
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
            {herstelLabel}
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

// ─── Paneel: beheer van de VASTE duidingsteksten ──────────────────────────────
//
// Dit is het deel dat werkelijk in de rapporten terechtkomt. De tekst in de
// broncode of in het tekstbestand blijft de terugval; een bewaarde tekst wint op
// leestijd. Elke wijziging draagt wie en wanneer.

interface TekstVeldData {
  sleutel: string;
  label: string;
  lang: boolean;
  bron: string;
  tekst: string;
  heeftOverride: boolean;
}

interface TekstOverzicht {
  instrument: string;
  label: string;
  taal: string;
  talen: string[];
  waar: string;
  scope: string;
  groepen: { groep: string; toelichting: string; velden: TekstVeldData[] }[];
}

function TekstbeheerPaneel() {
  const [instrumenten, setInstrumenten] = useState<
    { id: string; label: string; talen: string[]; waar: string; aantalVelden: number }[]
  >([]);
  const [instrument, setInstrument] = useState<string>("");
  const [taal, setTaal] = useState<string>("nl");
  const [data, setData] = useState<TekstOverzicht | null>(null);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/tekstbeheer/instrumenten");
        if (!r.ok) { setFout("Kan de instrumenten niet laden."); return; }
        const d = await r.json();
        setInstrumenten(d.instrumenten ?? []);
        if (d.instrumenten?.length) {
          setInstrument(d.instrumenten[0].id);
          setTaal(d.instrumenten[0].talen?.[0] ?? "nl");
        }
      } catch { setFout("Netwerkfout."); }
    })();
  }, []);

  const laad = useCallback(async () => {
    if (!instrument) return;
    setLoading(true);
    setFout(null);
    try {
      const r = await fetch(`/api/admin/tekstbeheer/${encodeURIComponent(instrument)}/${taal}`);
      if (!r.ok) { setFout("Kan de teksten niet laden."); return; }
      const d: TekstOverzicht = await r.json();
      setData(d);
      setOpen((vorig) => {
        const nieuw = { ...vorig };
        for (const g of d.groepen) if (nieuw[g.groep] === undefined) nieuw[g.groep] = false;
        return nieuw;
      });
    } catch { setFout("Netwerkfout."); }
    finally { setLoading(false); }
  }, [instrument, taal]);

  useEffect(() => { laad(); }, [laad]);

  async function bewaar(sleutel: string, tekst: string) {
    await fetch(`/api/admin/tekstbeheer/${encodeURIComponent(instrument)}/${taal}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleutel, tekst }),
    });
    await laad();
  }

  async function herstel(sleutel: string) {
    await fetch(
      `/api/admin/tekstbeheer/${encodeURIComponent(instrument)}/${taal}?sleutel=${encodeURIComponent(sleutel)}`,
      { method: "DELETE" },
    );
    await laad();
  }

  const gekozen = instrumenten.find((i) => i.id === instrument);
  const aantalAangepast =
    data?.groepen.reduce((n, g) => n + g.velden.filter((v) => v.heeftOverride).length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-foreground font-semibold mb-1">Wat u hier beheert</p>
        <p className="text-sm text-muted-foreground">
          De vaste duidingsteksten van een instrument: de woorden en zinnen die in elk rapport
          op dezelfde plaats terugkomen. De tekst blijft deterministisch, dus twee gelijke
          profielen lezen dezelfde duiding. Herstellen brengt altijd de brontekst terug.
        </p>
      </div>

      {/* Instrument-kiezer */}
      {instrumenten.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Instrument</span>
          {instrumenten.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => { setInstrument(it.id); setTaal(it.talen?.[0] ?? "nl"); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                instrument === it.id ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
              }`}
            >
              {it.label}
              <span className="ml-1.5 opacity-70">{it.aantalVelden}</span>
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
      )}

      {gekozen && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{gekozen.waar}</span>
          {aantalAangepast > 0 && (
            <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30">
              {aantalAangepast} beheerde tekst{aantalAangepast === 1 ? "" : "en"}
            </Badge>
          )}
        </div>
      )}

      {fout && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{fout}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && data && data.groepen.map((g) => (
        <section key={g.groep} className="space-y-3">
          <button
            type="button"
            onClick={() => setOpen((v) => ({ ...v, [g.groep]: !v[g.groep] }))}
            className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider"
          >
            {g.groep}
            <span className="text-xs font-normal normal-case text-muted-foreground">
              {g.velden.length} velden
            </span>
            {open[g.groep] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {open[g.groep] && (
            <>
              <p className="text-xs text-muted-foreground max-w-2xl">{g.toelichting}</p>
              {g.velden.map((v) => (
                <TekstKaart
                  key={v.sleutel}
                  titel={v.label}
                  tekst={v.tekst}
                  origineel={v.bron}
                  heeftOverride={v.heeftOverride}
                  regels={v.lang ? 5 : 2}
                  bronLabel="Brontekst"
                  herstelLabel="Herstel brontekst"
                  logUrl={`/api/admin/tekstbeheer/${encodeURIComponent(instrument)}/veldlog?sleutel=${encodeURIComponent(v.sleutel)}`}
                  onSave={(tekst) => bewaar(v.sleutel, tekst)}
                  onReset={() => herstel(v.sleutel)}
                />
              ))}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

// ─── Hoofdpagina ──────────────────────────────────────────────────────────────

const DEFAULT_INSTRUMENT = "t4p-business-kompas";

export default function AdminDuidingbeheer() {
  const [taal, setTaal] = useState<Taal>("nl");
  const [instrument, setInstrument] = useState<string>(DEFAULT_INSTRUMENT);
  const [instrumenten, setInstrumenten] = useState<
    { id: string; label: string; inRapportketen?: boolean; toelichting?: string }[]
  >([]);
  const [data, setData] = useState<DuidingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [ankersOpen, setAnkersOpen] = useState(true);
  // Twee werkvormen op dit scherm: de vaste teksten (die altijd meegaan in een
  // rapport) en de optionele AI-laag. De vaste teksten staan voorop, want dat is
  // wat een beheerder in de praktijk verfijnt.
  const [weergave, setWeergave] = useState<"teksten" | "ai">("teksten");

  // Query-suffix voor de instrument-parameter (default t4p = backwards compat).
  const instQuery = `?instrument=${encodeURIComponent(instrument)}`;
  // Scope-encoding voor de audit-log (spiegel van scopeVoor op de server).
  const scopedScope = useCallback(
    (base: string) => (instrument === DEFAULT_INSTRUMENT ? base : `${base}:${instrument}`),
    [instrument],
  );

  // Beheerbare instrumenten eenmalig ophalen (voor de selector).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/duidingbeheer/instrumenten`);
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d.instrumenten) && d.instrumenten.length) setInstrumenten(d.instrumenten);
        }
      } catch {}
    })();
  }, []);

  const laad = useCallback(async () => {
    setLoading(true);
    setFout(null);
    try {
      const r = await fetch(`/api/admin/duidingbeheer/${taal}${instQuery}`);
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
  }, [taal, instQuery]);

  useEffect(() => { laad(); }, [taal, instrument]);

  async function zetLive(aan: boolean) {
    await fetch(`/api/admin/duidingbeheer/config/live${instQuery}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aan }),
    });
    await laad();
  }

  async function saveRegie(tekst: string) {
    await fetch(`/api/admin/duidingbeheer/regie-prompt/${taal}${instQuery}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst }),
    });
    await laad();
  }

  async function resetRegie() {
    await fetch(`/api/admin/duidingbeheer/regie-prompt/${taal}${instQuery}`, { method: "DELETE" });
    await laad();
  }

  async function saveAnker(dimensie: string, tekst: string) {
    await fetch(`/api/admin/duidingbeheer/anker/${encodeURIComponent(dimensie)}/${taal}${instQuery}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst }),
    });
    await laad();
  }

  async function resetAnker(dimensie: string) {
    await fetch(`/api/admin/duidingbeheer/anker/${encodeURIComponent(dimensie)}/${taal}${instQuery}`, { method: "DELETE" });
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
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">
            Duidingsbeheer
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Hier beheert een prior-beheerder de duiding in de rapporten. Cijfers, scores en
            grafieken blijven onaangeraakt: die komen uitsluitend uit de rekenlaag. Elke
            wijziging draagt wie en wanneer, en is altijd terug te zetten naar de brontekst.
          </p>
        </div>

        {/* Werkvorm */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setWeergave("teksten")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              weergave === "teksten" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
            }`}
          >
            Rapportteksten
          </button>
          <button
            type="button"
            onClick={() => setWeergave("ai")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              weergave === "ai" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
            }`}
          >
            AI-duiding (optioneel)
          </button>
        </div>

        {weergave === "teksten" && <TekstbeheerPaneel />}

        {weergave === "ai" && (
        <div className="space-y-0">
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <p className="text-sm text-foreground font-semibold mb-1">Wat deze laag doet</p>
          <p className="text-sm text-muted-foreground">
            Een optionele laag die een duidingstekst door een taalmodel laat schrijven binnen een
            vaste regie-prompt en per-dimensie ankers. De cijfers gaan nooit mee als vrije tekst en
            het model mag geen getal invoeren dat niet uit de rekenlaag komt. Faalt de AI, dan blijft
            de bestaande tekst staan. De schakelaar staat standaard uit, en aanzetten is een
            verwerkingsbeslissing: er gaan profielgegevens naar een verwerker buiten de EER.
          </p>
        </div>

        {/* Instrument-kiezer (additief; default = T4P Business Kompas) */}
        {instrumenten.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Instrument</span>
            {instrumenten.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setInstrument(it.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  instrument === it.id ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}

        {/* Eerlijkheid: hangt dit pad werkelijk in de rapportketen van dit instrument? */}
        {(() => {
          const def = instrumenten.find((i) => i.id === instrument);
          if (!def || def.inRapportketen !== false) return null;
          return (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50/10 p-4 mb-6">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                  Niet aangesloten op de rapportketen
                </p>
                <p className="text-sm text-muted-foreground">{def.toelichting}</p>
              </div>
            </div>
          );
        })()}

        {/* Aan/uit-schakelaar */}
        {data && (
          <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 mb-6 ${data.liveDuidingAan ? "border-emerald-400/50 bg-emerald-50/5" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${data.liveDuidingAan ? "text-emerald-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-semibold text-foreground">Live AI-duiding</p>
                <p className="text-xs text-muted-foreground">
                  {data.liveDuidingAan
                    ? "Aan: nieuwe rapporten van dit instrument krijgen een AI-duiding, met terugval op de vaste tekst."
                    : "Uit: rapporten van dit instrument gebruiken uitsluitend de vaste tekst."}
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
                logUrl={`/api/admin/duidingbeheer/${scopedScope("regie-prompt")}/${encodeURIComponent("__algemeen__")}/log`}
                regels={10}
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
                      logUrl={`/api/admin/duidingbeheer/${scopedScope("anker")}/${encodeURIComponent(a.dimensie)}/log`}
                      onSave={(tekst) => saveAnker(a.dimensie, tekst)}
                      onReset={() => resetAnker(a.dimensie)}
                    />
                  ))}
                </div>
              ))}
            </section>
          </div>
        )}
        </div>
        )}
      </main>
    </div>
  );
}
