// =============================================================================
// client/src/pages/admin-instrumentengids.tsx  —  NIEUW BESTAND (Regel 2)
// -----------------------------------------------------------------------------
// Prior-beheer voor De Instrumentengids: overschrijf de tekstvelden van elk
// instrument per taal. Blauwdruk = admin-vraagbeheer.tsx (zelfde stijl, prior-
// gate, audit-log). De server verifieert prior bij elke schrijf-call.
//
// Bewerkbare velden (whitelist server-side): omschrijving, beantwoordt,
// gebruik, doelgroep, rapportTeaser. Talen: nl / fr / en / es / ru.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Clock,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { INSTRUMENTENGIDS, orientatieLabel, type GidsInstrument } from "@/data/instrumentengids";

const VELDEN: { key: keyof GidsInstrument; label: string }[] = [
  { key: "omschrijving", label: "Omschrijving" },
  { key: "beantwoordt", label: "Welke vragen beantwoordt het?" },
  { key: "gebruik", label: "Hoe kan ik het verder gebruiken?" },
  { key: "doelgroep", label: "Voor wie is het bedoeld?" },
  { key: "rapportTeaser", label: "Wat je terugkrijgt (rapport-teaser)" },
];

const TALEN: { code: string; naam: string }[] = [
  { code: "nl", naam: "Nederlands" },
  { code: "fr", naam: "Frans" },
  { code: "en", naam: "Engels" },
  { code: "es", naam: "Spaans" },
  { code: "ru", naam: "Russisch" },
];

// Override-shape uit /api/admin/gids/:id → { [veld]: { [taal]: tekst } }
type InstrumentOverrides = Record<string, Record<string, string>>;

interface LogRegel {
  taal: string;
  actie: string;
  door: string;
  wanneer: string;
}

function VeldEditor({
  instrument,
  veld,
  label,
  defaultTekst,
  overrides,
  onGewijzigd,
}: {
  instrument: string;
  veld: string;
  label: string;
  defaultTekst: string;
  overrides: Record<string, string>;
  onGewijzigd: () => void;
}) {
  const { toast } = useToast();
  const [taal, setTaal] = useState("nl");
  const [waarde, setWaarde] = useState("");
  const [bezig, setBezig] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<LogRegel[]>([]);

  const heeftOverride = (t: string) => typeof overrides[t] === "string";

  useEffect(() => {
    // toon override indien aanwezig, anders de default (enkel nl heeft default-tekst hier)
    if (heeftOverride(taal)) setWaarde(overrides[taal]);
    else if (taal === "nl") setWaarde(defaultTekst);
    else setWaarde("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taal, JSON.stringify(overrides), defaultTekst]);

  const opslaan = async () => {
    if (!waarde.trim()) {
      toast({ title: "Leeg", description: "Tekst mag niet leeg zijn.", variant: "destructive" });
      return;
    }
    setBezig(true);
    try {
      await apiRequest("PUT", `/api/admin/gids/${instrument}/${veld}`, { taal, tekst: waarde.trim() });
      toast({ title: "Opgeslagen", description: `${label} (${taal.toUpperCase()}) bijgewerkt.` });
      onGewijzigd();
    } catch (e) {
      toast({ title: "Fout", description: String(e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  };

  const herstellen = async () => {
    setBezig(true);
    try {
      await apiRequest("DELETE", `/api/admin/gids/${instrument}/${veld}/${taal}`);
      toast({ title: "Hersteld", description: `${label} (${taal.toUpperCase()}) terug naar standaard.` });
      if (taal === "nl") setWaarde(defaultTekst);
      else setWaarde("");
      onGewijzigd();
    } catch (e) {
      toast({ title: "Fout", description: String(e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  };

  const logLaden = async () => {
    if (logOpen) {
      setLogOpen(false);
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/admin/gids/${instrument}/${veld}/log`);
      const data = (await res.json()) as LogRegel[];
      setLog(Array.isArray(data) ? data : []);
      setLogOpen(true);
    } catch {
      setLog([]);
      setLogOpen(true);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex flex-wrap gap-1">
          {TALEN.map((t) => (
            <button
              key={t.code}
              onClick={() => setTaal(t.code)}
              className="rounded-md border px-2 py-1 text-xs font-medium transition-colors"
              style={
                taal === t.code
                  ? { background: "hsl(var(--foreground))", color: "hsl(var(--background))", borderColor: "hsl(var(--foreground))" }
                  : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
              }
            >
              {t.code.toUpperCase()}
              {heeftOverride(t.code) && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: "hsl(var(--gold))" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {taal === "nl" && !heeftOverride("nl") && (
        <p className="mt-2 text-xs text-muted-foreground">Standaardtekst (nog geen override).</p>
      )}
      {taal !== "nl" && !heeftOverride(taal) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nog geen {TALEN.find((x) => x.code === taal)?.naam}-vertaling — vul hieronder in om er een toe te voegen.
        </p>
      )}

      <Textarea
        className="mt-2 min-h-[96px]"
        value={waarde}
        onChange={(e) => setWaarde(e.target.value)}
        placeholder={`${label} (${taal.toUpperCase()})`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" disabled={bezig} onClick={opslaan}>
          <Save className="h-3.5 w-3.5" />
          Opslaan
        </Button>
        {heeftOverride(taal) && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={bezig} onClick={herstellen}>
            <RotateCcw className="h-3.5 w-3.5" />
            Herstel standaard
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={logLaden}>
          <Clock className="h-3.5 w-3.5" />
          Wijzigingslog
          {logOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {logOpen && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          {log.length === 0 ? (
            <p className="text-muted-foreground">Nog geen wijzigingen geregistreerd.</p>
          ) : (
            <ul className="space-y-1">
              {log.map((r, i) => (
                <li key={i} className="flex flex-wrap gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{r.taal?.toUpperCase()}</Badge>
                  <span>{r.actie}</span>
                  <span>·</span>
                  <span>{r.door}</span>
                  <span>·</span>
                  <span>{r.wanneer}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function InstrumentBlok({ instr }: { instr: GidsInstrument }) {
  const [overrides, setOverrides] = useState<InstrumentOverrides>({});
  const [open, setOpen] = useState(false);

  const laadOverrides = useCallback(async () => {
    try {
      const res = await apiRequest("GET", `/api/admin/gids/${instr.id}`);
      const data = (await res.json()) as InstrumentOverrides;
      setOverrides(data && typeof data === "object" ? data : {});
    } catch {
      setOverrides({});
    }
  }, [instr.id]);

  useEffect(() => {
    if (open) laadOverrides();
  }, [open, laadOverrides]);

  const aantalOverrides = Object.values(overrides).reduce(
    (n, perTaal) => n + Object.keys(perTaal || {}).length,
    0
  );

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div>
          <p className="font-serif text-lg font-semibold text-foreground">{instr.naam}</p>
          <p className="text-xs text-muted-foreground">
            {orientatieLabel(instr.orientatie)} · {instr.eyebrow}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aantalOverrides > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3" style={{ color: "hsl(var(--gold))" }} />
              {aantalOverrides} override{aantalOverrides === 1 ? "" : "s"}
            </Badge>
          )}
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-5">
          {VELDEN.map((v) => (
            <VeldEditor
              key={v.key as string}
              instrument={instr.id}
              veld={v.key as string}
              label={v.label}
              defaultTekst={String(instr[v.key] ?? "")}
              overrides={overrides[v.key as string] ?? {}}
              onGewijzigd={laadOverrides}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInstrumentengids() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <Link href="/admin">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Terug naar admin
          </Button>
        </Link>

        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{ background: "hsl(var(--werk)/0.14)", color: "hsl(var(--werk))" }}
          >
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Beheer De Instrumentengids
            </h1>
            <p className="text-sm text-muted-foreground">
              Overschrijf de tekstvelden per instrument en per taal. Leeg laten = standaardtekst.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {INSTRUMENTENGIDS.map((instr) => (
            <InstrumentBlok key={instr.id} instr={instr} />
          ))}
        </div>
      </main>
    </div>
  );
}
