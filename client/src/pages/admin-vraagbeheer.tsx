/**
 * Admin Vraagbeheer — prior-beheerder beheert stellingen van alle instrumenten
 *
 * Beveiliging: enkel zichtbaar/werkend voor is_prior=true beheerders.
 * De server verifieert dit ook bij elke API-call.
 *
 * Features:
 *  - Instrument-kiezer (T4P Business Kompas, Teamscan)
 *  - Volledig doorzoekbaar (vrije tekst, construct, family)
 *  - Per item: originele tekst per taal, inline bewerken, opslaan
 *  - Overschreven items zijn visueel gemarkeerd (goudkleurig badge)
 *  - Reset naar origineel per taal met één klik
 *  - Audit-log per item (wie, wanneer, wat)
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Search,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Languages,
  FileEdit,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VraagItem {
  itemId: string;
  instrument: string;
  family?: string;
  construct?: string;
  tekst: Record<string, string>;
  heeftOverride: boolean;
  origineel?: Record<string, string>;
}

interface InstrumentData {
  instrument: string;
  totaal: number;
  aantalOverrides: number;
  items: VraagItem[];
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

const INSTRUMENTEN = [
  { id: "tapas-t4p", naam: "T4P Business Kompas", beschrijving: "136 stellingen + verbindingsvragen" },
  { id: "tapas-teamscan", naam: "TaPas Teamscan", beschrijving: "Lencioni-gebaseerde teamvragen" },
  { id: "tapas-t4recruitment", naam: "T4Recruitment", beschrijving: "Rekruterings-profileringsmodules" },
  { id: "tapas-2minscan", naam: "2MinScan", beschrijving: "Energetisch gedragsprofiel (EG-code)" },
  { id: "tapas-t4students", naam: "T4Students / Studiekompas", beschrijving: "Studiekeuze-oriëntatie voor jongeren" },
  { id: "tapas-t4teens", naam: "T4Teens", beschrijving: "Vonk-instrument (25 items: energie, drivers, versnellers, foci, interesse, betekenis)" },
  { id: "tapas-t4sports", naam: "T4Sports Modules", beschrijving: "M1 ACSI-28 (28 items) · M2 DFS-2/FSS-2 (18 items) · M3 AIMS-7 (7 items)" },
];

// ─── Item-kaart ───────────────────────────────────────────────────────────────

function VraagKaart({
  item,
  instrument,
  onSave,
  onReset,
}: {
  item: VraagItem;
  instrument: string;
  onSave: (itemId: string, taal: string, tekst: string) => Promise<void>;
  onReset: (itemId: string, taal: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [activeTaal, setActiveTaal] = useState<Taal>("nl");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<any[]>([]);

  const huidigeTekst = (taal: Taal) => edits[taal] ?? item.tekst[taal] ?? "";
  const isGewijzigd = (taal: Taal) => edits[taal] !== undefined && edits[taal] !== (item.tekst[taal] ?? "");
  const heeftOverrideVoorTaal = (taal: Taal) => item.heeftOverride && item.origineel?.[taal] !== undefined;

  async function opslaan(taal: Taal) {
    const tekst = edits[taal];
    if (!tekst?.trim()) return;
    setSaving(taal);
    await onSave(item.itemId, taal, tekst);
    setSaving(null);
    setSaved(taal);
    setEdits(prev => { const n = { ...prev }; delete n[taal]; return n; });
    setTimeout(() => setSaved(null), 2000);
  }

  async function reset(taal: Taal) {
    await onReset(item.itemId, taal);
    setEdits(prev => { const n = { ...prev }; delete n[taal]; return n; });
  }

  async function laadLog() {
    try {
      const r = await fetch(`/api/admin/vraagbeheer/${instrument}/${encodeURIComponent(item.itemId)}/log`);
      const d = await r.json();
      setLog(d.log ?? []);
    } catch {}
    setLogOpen(true);
  }

  return (
    <div
      className={`rounded-xl border ${item.heeftOverride ? "border-amber-400/50 bg-amber-50/5" : "border-border"} bg-card`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-xs text-muted-foreground">{item.itemId}</span>
            {item.family && (
              <Badge variant="outline" className="text-xs">{item.family}</Badge>
            )}
            {item.construct && (
              <Badge variant="secondary" className="text-xs">{item.construct}</Badge>
            )}
            {item.heeftOverride && (
              <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30">
                ✏️ Aangepast
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed line-clamp-2">
            {item.tekst.nl ?? item.tekst.fr ?? Object.values(item.tekst)[0] ?? "—"}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>

      {/* Uitklapbaar bewerkingsgedeelte */}
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Taalknoppenbalk */}
          <div className="flex flex-wrap gap-2">
            {TALEN.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTaal(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  activeTaal === t
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/20"
                } ${isGewijzigd(t) ? "ring-1 ring-amber-400" : ""}`}
              >
                {TAAL_LABELS[t]}
                {isGewijzigd(t) && " •"}
              </button>
            ))}
          </div>

          {/* Editor voor actieve taal */}
          <div className="space-y-2">
            {heeftOverrideVoorTaal(activeTaal) && (
              <div className="rounded-lg bg-blue-50/10 border border-blue-400/20 p-2">
                <p className="text-xs text-blue-400 font-medium mb-0.5">Originele tekst:</p>
                <p className="text-xs text-muted-foreground italic">
                  {item.origineel?.[activeTaal] ?? "—"}
                </p>
              </div>
            )}
            <Textarea
              value={huidigeTekst(activeTaal)}
              onChange={e => setEdits(prev => ({ ...prev, [activeTaal]: e.target.value }))}
              rows={3}
              className="resize-none text-sm"
              placeholder={`Tekst in ${TAAL_LABELS[activeTaal]}...`}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => opslaan(activeTaal)}
                disabled={!isGewijzigd(activeTaal) || saving === activeTaal}
                className="gap-1.5"
              >
                {saving === activeTaal ? (
                  <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
                ) : saved === activeTaal ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved === activeTaal ? "Opgeslagen!" : "Opslaan"}
              </Button>
              {heeftOverrideVoorTaal(activeTaal) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reset(activeTaal)}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Origineel herstellen
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
          </div>

          {/* Audit log */}
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
      )}
    </div>
  );
}

// ─── Hoofdpagina ──────────────────────────────────────────────────────────────

export default function AdminVraagbeheer() {
  const [instrument, setInstrument] = useState("tapas-t4p");
  const [data, setData] = useState<InstrumentData | null>(null);
  const [zoek, setZoek] = useState("");
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [alleenOverrides, setAlleenOverrides] = useState(false);

  const laadItems = useCallback(async () => {
    setLoading(true);
    setFout(null);
    try {
      const params = new URLSearchParams();
      if (zoek) params.set("q", zoek);
      const r = await fetch(`/api/admin/vraagbeheer/${instrument}?${params}`);
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
  }, [instrument, zoek]);

  useEffect(() => { laadItems(); }, [instrument]);

  async function opslaan(itemId: string, taal: string, tekst: string) {
    await fetch(`/api/admin/vraagbeheer/${instrument}/${encodeURIComponent(itemId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taal, tekst }),
    });
    await laadItems();
  }

  async function reset(itemId: string, taal: string) {
    await fetch(`/api/admin/vraagbeheer/${instrument}/${encodeURIComponent(itemId)}/${taal}`, {
      method: "DELETE",
    });
    await laadItems();
  }

  const zichtbareItems = (data?.items ?? []).filter(it =>
    !alleenOverrides || it.heeftOverride
  );

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
            <FileEdit className="h-4 w-4 text-accent" />
            Vraagbeheer
          </span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">
            Vraagbeheer
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Pas stellingen aan in alle talen. Wijzigingen zijn onmiddellijk operatief bij de
            volgende afname. Originele teksten blijven bewaard — je kunt altijd herstellen.
            Enkel toegankelijk voor prior-beheerders.
          </p>
          {data && (
            <div className="mt-3 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                <Languages className="h-3.5 w-3.5" />
                {data.totaal} vragen totaal
              </span>
              {data.aantalOverrides > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-3 py-1">
                  <FileEdit className="h-3.5 w-3.5" />
                  {data.aantalOverrides} aangepaste vragen
                </span>
              )}
            </div>
          )}
        </div>

        {/* Instrument-kiezer */}
        <div className="flex flex-wrap gap-3 mb-6">
          {INSTRUMENTEN.map(inst => (
            <button
              key={inst.id}
              type="button"
              onClick={() => setInstrument(inst.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                instrument === inst.id
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/40"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${instrument === inst.id ? "text-accent" : "text-foreground"}`}>
                  {inst.naam}
                </p>
                <p className="text-xs text-muted-foreground">{inst.beschrijving}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Zoekbalk + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={zoek}
              onChange={e => setZoek(e.target.value)}
              onKeyDown={e => e.key === "Enter" && laadItems()}
              placeholder="Zoek in vragen, construct, family…"
              className="pl-9"
            />
          </div>
          <Button onClick={laadItems} variant="outline" className="gap-1.5">
            <Search className="h-4 w-4" />
            Zoeken
          </Button>
          <a
            href={`/api/admin/vraagbeheer/export/csv?instrument=${instrument}`}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV export
          </a>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={alleenOverrides}
              onChange={e => setAlleenOverrides(e.target.checked)}
              className="rounded border-border"
            />
            Alleen aangepaste vragen
          </label>
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

        {/* Items */}
        {!loading && data && (
          <div className="space-y-3">
            {zichtbareItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Languages className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Geen vragen gevonden.</p>
              </div>
            ) : (
              zichtbareItems.map(item => (
                <VraagKaart
                  key={item.itemId}
                  item={item}
                  instrument={instrument}
                  onSave={opslaan}
                  onReset={reset}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
