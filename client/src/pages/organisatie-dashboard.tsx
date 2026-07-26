// ---------------------------------------------------------------------------
// client/src/pages/organisatie-dashboard.tsx - het organisatieportaal (fase 7).
//
// Een organisatie ziet hier uitsluitend haar eigen deelnemers, afnames en
// opvolging. Er zit BEWUST geen organisatiekeuze in dit scherm: de organisatie
// komt uit de sessie en niet uit de URL. Zou het scherm de organisatie zelf
// meesturen, dan zou het een keuze suggereren die de server toch weigert.
//
// De endpoints hieronder staan alle drie achter `vereisScope` en filteren
// server-zijdig. Dit scherm hoeft dus niets weg te laten; het toont wat het
// terugkrijgt.
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useOrganisatieAuth } from "@/components/OrganisatieLoginGate";
import { Building2, Users, LogOut, Loader2 } from "lucide-react";

interface Afname {
  id: number;
  name: string;
  status: string;
  instrumentId: string | null;
  createdAt: string;
}

interface OpvolgingRij {
  instrumentId: string;
  label: string;
  totaal: number;
  voltooid: number;
}

interface Opvolging {
  organisatieId: number | null;
  organisatieNaam: string | null;
  rijen: OpvolgingRij[];
  totalen: { totaal: number; voltooid: number };
}

export default function OrganisatieDashboard() {
  const { organisatie, afmelden } = useOrganisatieAuth();

  const { data: afnames, isLoading: afnamesBezig } = useQuery<Afname[]>({
    queryKey: ["/api/admin/afnames"],
  });
  // Geen organisatie in de queriesleutel: de server leidt haar af uit de sessie.
  const { data: opvolging } = useQuery<Opvolging>({
    queryKey: ["/api/organisatie/opvolging-per-instrument"],
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              <Building2 className="h-5 w-5 text-primary" />
              Organisatieportaal
            </h1>
            {/* Maak zichtbaar wiens gegevens dit scherm toont. */}
            <p
              className="mt-1 text-sm font-medium text-foreground"
              data-testid="tekst-organisatiecontext"
            >
              U bekijkt: {organisatie.naam}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={afmelden} data-testid="button-organisatie-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Afmelden
          </Button>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Opvolging per instrument</h2>
          {opvolging ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Instrument</th>
                    <th className="px-4 py-2 font-medium">Totaal</th>
                    <th className="px-4 py-2 font-medium">Voltooid</th>
                  </tr>
                </thead>
                <tbody data-testid="tabel-opvolging">
                  {opvolging.rijen.map((r) => (
                    <tr key={r.instrumentId} className="border-t border-border">
                      <td className="px-4 py-2 text-foreground">{r.label}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.totaal}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.voltooid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nog geen cijfers beschikbaar.</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" />
            Uw deelnemers
          </h2>
          {afnamesBezig ? (
            <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
          ) : afnames && afnames.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border" data-testid="lijst-afnames">
              {afnames.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-foreground">{a.name}</span>
                  <span className="text-muted-foreground">{a.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Er zijn nog geen afnames voor uw organisatie.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
