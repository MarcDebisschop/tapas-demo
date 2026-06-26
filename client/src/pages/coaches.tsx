// ---------------------------------------------------------------------------
// Coaches (publiek register) — gereconstrueerd uit bundle (index-DPZKsx0y.js)
// Functienaam in bundle: qTe()
// Sub-componenten: zTe (JesterSectie), HTe (foto), DTe (regio)
// API: GET /api/coaches/publiek
// ZIP-6 bron: TaPas-Platform-6.zip (correcte versie)
// ---------------------------------------------------------------------------

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

// Jester array — exacte volgorde en data uit ZIP-6 bundle (QTe array, pos. 1469289)
const JESTERS = [
  { naam: "Marc Debisschop", rol: "Grondlegger van het TaPas-gedachtegoed", foto: "/jester/portret-marc.jpg" },
  { naam: "Prof. Leen Adams", rol: "Het academische en deontologische geweten", foto: "/jester/portret-leen.jpg" },
  { naam: "Herman", rol: "Bewaker van de menselijke maat", foto: "/jester/portret-herman.jpg" },
  { naam: "Kris Debisschop", rol: "Mede-architect van het instrumentarium", foto: "/jester/portret-kris.jpg" },
];

// JesterSectie component — exact overgenomen uit zTe() in ZIP-6 bundle (pos. 1469692)
// Zichtbare tekst "De ereklasse" vervangen door "TaPas Jester" op verzoek van Marc
function JesterSectie() {
  return (
    <section
      className="jester-ereklasse mb-12 rounded-2xl border p-6 sm:p-8"
      data-testid="section-ereklasse"
    >
      <div className="flex items-center gap-3">
        <img
          src="/jester/jester-zegel.png"
          alt=""
          aria-hidden="true"
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div>
          <span className="jester-ereklasse-label text-xs font-semibold uppercase tracking-[0.18em]">
            TaPas Jester
          </span>
          <h2 className="jester-ereklasse-titel mt-1 text-lg font-semibold sm:text-xl">
            De Jesters
          </h2>
        </div>
      </div>
      <p className="jester-ereklasse-tekst mt-3 max-w-2xl text-sm leading-relaxed">
        Boven de drie accreditatieniveaus staat een bekronend niveau, voorbehouden aan wie het volledige instrumentarium meesterlijk beheerst en de menselijke maat bewaakt.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {JESTERS.map((jester) => (
          <div
            key={jester.naam}
            className="flex flex-col items-center text-center"
            data-testid={`jester-${jester.naam.split(" ")[0]?.toLowerCase()}`}
          >
            <div className="jester-portret-lijst">
              <img
                src={jester.foto}
                alt={`Portret van ${jester.naam}`}
                className="jester-portret h-28 w-24 object-cover sm:h-32 sm:w-28"
              />
            </div>
            <div className="jester-ereklasse-naam mt-3 font-semibold">{jester.naam}</div>
            <div className="jester-ereklasse-rol mt-0.5 text-xs leading-relaxed">{jester.rol}</div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/academy/jester">
          <a
            className="jester-ereklasse-cta inline-flex items-center gap-1.5 text-sm font-medium"
            data-testid="link-jester-register"
          >
            Tree binnen in de Galerij der Jesters
            <ChevronRight className="h-4 w-4" />
          </a>
        </Link>
      </div>
    </section>
  );
}

// Fotocomponent (HTe uit bundle) — h-16 w-16, 2 initialen uppercase
function CoachFoto({ coach }: { coach: any }) {
  if (coach.fotoUrl) {
    return (
      <img
        src={coach.fotoUrl}
        alt={`Portret van ${coach.naam}`}
        className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
        data-testid={`foto-coach-${coach.id}`}
        loading="lazy"
      />
    );
  }
  const initialen = coach.naam
    .split(/\s+/)
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold text-muted-foreground">
      {initialen}
    </div>
  );
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit qTe() in ZIP-6 bundle
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

        {/* JesterSectie — boven de coaches grid (zTe uit bundle) */}
        <JesterSectie />

        {!isLoading && !isError && coaches.length > 0 && (
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
        )}
      </main>
    </div>
  );
}
