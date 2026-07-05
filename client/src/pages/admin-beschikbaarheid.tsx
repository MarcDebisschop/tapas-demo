/**
 * Admin Instrument-vrijgave — prior-beheerder geeft instrumenten vrij (default UIT)
 *
 * Blauwdruk = admin-duidingbeheer.tsx (zelfde stijl, prior-only). Strikt additief:
 * raakt geen bestaand afname- of rapportpad aan.
 *
 * Per instrument uit GET /api/admin/beschikbaarheid tonen we een rij met naam +
 * een aan/uit-toggle. De toggle roept PUT /api/admin/beschikbaarheid/:instrument
 * aan met { beschikbaar }. Default UIT: eindgebruikers kunnen een instrument pas
 * afnemen wanneer het hier is vrijgegeven.
 *
 * Beveiliging: enkel is_prior=true beheerders. De server verifieert dit ook (403).
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AlertCircle,
  Power,
  ShieldAlert,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BeschikbaarheidInstrument {
  id: string;
  label: string;
  beschikbaar: boolean;
}

export default function AdminBeschikbaarheid() {
  const [instrumenten, setInstrumenten] = useState<BeschikbaarheidInstrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLoading(true);
    setFout(null);
    try {
      const r = await fetch(`/api/admin/beschikbaarheid`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setFout(e.error ?? "Fout bij laden.");
        return;
      }
      const d = await r.json();
      setInstrumenten(Array.isArray(d.instrumenten) ? d.instrumenten : []);
    } catch {
      setFout("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  async function zetBeschikbaar(id: string, beschikbaar: boolean) {
    setBezig(id);
    try {
      const r = await fetch(`/api/admin/beschikbaarheid/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beschikbaar }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setFout(e.error ?? "Opslaan mislukt.");
        return;
      }
      await laad();
    } catch {
      setFout("Netwerkfout.");
    } finally {
      setBezig(null);
    }
  }

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
            <Power className="h-4 w-4 text-accent" />
            Instrument-vrijgave
          </span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">
            Instrument-vrijgave
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Standaard UIT — eindgebruikers kunnen dit instrument pas afnemen wanneer jij het hier
            vrijgeeft. Zet je de vlag AAN, dan wordt het instrument beschikbaar voor afname. Enkel
            toegankelijk voor prior-beheerders.
          </p>
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

        {!loading && !fout && instrumenten.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-8">Geen beheerbare instrumenten.</p>
        )}

        {!loading && instrumenten.length > 0 && (
          <div className="space-y-4">
            {instrumenten.map((it) => (
              <div
                key={it.id}
                className={`rounded-xl border p-4 ${it.beschikbaar ? "border-emerald-400/50 bg-emerald-50/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Power className={`h-5 w-5 ${it.beschikbaar ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{it.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.beschikbaar
                          ? "AAN — eindgebruikers kunnen dit instrument afnemen."
                          : "UIT — eindgebruikers kunnen dit instrument nog niet afnemen."}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={it.beschikbaar ? "outline" : "default"}
                    onClick={() => zetBeschikbaar(it.id, !it.beschikbaar)}
                    disabled={bezig === it.id}
                    className="gap-1.5"
                  >
                    {bezig === it.id ? (
                      <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
                    ) : null}
                    {it.beschikbaar ? "Zet uit" : "Zet aan"}
                  </Button>
                </div>

                {it.id === "tapas-driverscan" && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-50/5 p-3">
                    <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      De Driver-scan is te delicaat om zonder begeleiding aan te bieden. Geef ze
                      enkel vrij binnen een begeleid coachtraject.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
