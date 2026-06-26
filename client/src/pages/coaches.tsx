// ---------------------------------------------------------------------------
// Coaches (publiek register) — gereconstrueerd uit bundle (index-CxFhBwUz.js)
// Functienaam in bundle: a3e()
// Sub-componenten: r3e (regio filter), t3e (kaart overzicht), i3e (foto)
// API: GET /api/coaches/publiek
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Fotocomponent (i3e uit bundle)
function CoachFoto({ coach }: { coach: any }) {
  if (!coach.fotoUrl) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
        {coach.naam?.charAt(0) ?? "?"}
      </div>
    );
  }
  return (
    <img
      src={coach.fotoUrl}
      alt={coach.naam}
      className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
      loading="lazy"
    />
  );
}

// Regio-sectie (r3e uit bundle — vereenvoudigd)
function RegioSectie() {
  return null; // In de bundle is dit een compacte regiolegenda
}

// Kaart-overzicht per regio (t3e uit bundle — vereenvoudigd)
function RegioPinnen({ coaches }: { coaches: any[] }) {
  return null; // Visuele kaart — niet aanwezig zonder maplib
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit a3e() in bundle
// -----------------------------------------------------------------------
export default function Coaches() {
  const { data, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/coaches/publiek"],
  });
  const coaches = data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Onze geaccrediteerde coaches
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Deze coaches zijn binnen TaPas geaccrediteerd voor één of meer instrumenten.
            Je vindt hieronder waar ze actief zijn en waarmee ze je kunnen begeleiden.
          </p>
        </header>

        {isLoading && (
          <p className="text-muted-foreground" data-testid="status-laden">Coaches worden geladen…</p>
        )}
        {isError && (
          <p className="text-muted-foreground" data-testid="status-fout">
            De lijst kon even niet worden geladen. Probeer het later opnieuw.
          </p>
        )}
        {!isLoading && !isError && coaches.length === 0 && (
          <Card data-testid="status-leeg">
            <CardContent className="py-10 text-center text-muted-foreground">
              Er zijn op dit moment nog geen geaccrediteerde coaches om te tonen.
            </CardContent>
          </Card>
        )}

        <RegioSectie />

        {!isLoading && !isError && coaches.length > 0 && (
          <>
            <section className="mb-10">
              <RegioPinnen coaches={coaches} />
            </section>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-coaches">
              {coaches.map((coach: any) => (
                <Card key={coach.id} data-testid={`kaart-coach-${coach.id}`}>
                  <CardContent className="flex gap-4 p-5">
                    <CoachFoto coach={coach} />
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{coach.naam}</div>
                      <div className="text-sm text-muted-foreground">{coach.plaats}</div>
                      {coach.expertise?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {coach.expertise.map((ex: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-muted-foreground">{ex}</Badge>
                          ))}
                        </div>
                      )}
                      {coach.instrumenten?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {coach.instrumenten.map((inst: any) => (
                            <Badge
                              key={inst.id}
                              className="bg-primary/10 text-primary"
                              data-testid={`instrument-${coach.id}-${inst.id}`}
                            >
                              {inst.naam}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
