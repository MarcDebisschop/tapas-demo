// ---------------------------------------------------------------------------
// onderbouwing.tsx — PUBLIEKE pagina "Onderbouwing & validatie"
//   Route: /onderbouwing (buiten AdminLoginGate — vrij toegankelijk)
//   Toont de wetenschappelijke onderbouwing van het TaPas-instrumentarium:
//   vertrouwensbanner met kerncijfers + publieke rapporten (preview/download)
//   + "op aanvraag"-documenten. Interne stukken worden hier NIET getoond.
//
//   Meertalig (NL/FR/EN) via maakVertaler; content uit shared/i18n.ts.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { Languages, ArrowLeft, ShieldCheck } from "lucide-react";
import { OnderbouwingSectie } from "@/components/OnderbouwingSectie";

export default function Onderbouwing() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-8 w-[112px]" data-testid="select-ui-taal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALEN.map((l) => (
                    <SelectItem key={l} value={l}>
                      {TAAL_NAMEN[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          data-testid="link-terug-voordeur"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {n("ob_terug_voordeur")}
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600/10">
            <ShieldCheck className="h-6 w-6 text-teal-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="kop-onderbouwing-publiek">
              {n("ob_titel")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {n("ob_intro")}
            </p>
          </div>
        </div>

        {/* Gedeelde sectie in publieke modus (isAdmin=false => intern verborgen) */}
        <div className="mt-6">
          <OnderbouwingSectie isAdmin={false} n={n} compact />
        </div>
      </main>
    </div>
  );
}
