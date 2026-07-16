/**
 * client/src/pages/klaar-t4teens.tsx
 *
 * NIEUW BESTAND — Werkprotocol Regel 2 (strikt additief, aparte code-tak).
 *
 * Einde van de T4Teens-platform/mail-flow. Waar de klassieke `klaar.tsx` stil
 * eindigt, toont dit component de leerling:
 *   (a) een uitlezing van de opvallende headline-kaarten (titel + korte tekst),
 *       exact dezelfde selectie als de losse vonk-client (scoreVonk + selectVonk),
 *       opgehaald via GET /api/t4teens/afname/:id/uitlezing, en
 *   (b) een "Bewaren als PDF"-knop die het al gegenereerde Studiekompas downloadt
 *       via GET /api/t4teens/rapport/:id/pdf.
 *
 * Wordt ENKEL gerenderd voor instrumentId "t4teens" (guard in klaar.tsx); de
 * klassieke klaar-flow voor alle andere instrumenten blijft ongewijzigd.
 */

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Download, BookOpen } from "lucide-react";

interface UitlezingKaart {
  icon: string;
  title: string;
  body: string;
}
interface UitlezingResponse {
  naam: string;
  voltooid: boolean;
  kaarten: UitlezingKaart[];
  rapportId: string | null;
  rapportUrl: string | null;
  pdfUrl: string | null;
}

export default function KlaarT4Teens({ id }: { id: number }) {
  const { data, isLoading } = useQuery<UitlezingResponse>({
    queryKey: ["/api/t4teens/afname", id, "uitlezing"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/t4teens/afname/${id}/uitlezing`);
      return res.json();
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground" data-testid="text-uitlezing-titel">
            Klaar! Dit is wat er bij jou uitspringt
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Een eerlijke blik op wat je vandaag goed kan en graag doet. Het is een momentopname &mdash; dit mag nog groeien en veranderen.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-3" data-testid="list-uitlezing-kaarten">
              {(data?.kaarten ?? []).map((k, i) => (
                <Card key={i} data-testid={`card-uitlezing-${i}`}>
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold text-foreground">{k.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{k.body}</p>
                  </CardContent>
                </Card>
              ))}
              {(!data?.kaarten || data.kaarten.length === 0) && (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground" data-testid="text-uitlezing-leeg">
                    Je verkenning is opgeslagen. Bekijk of bewaar hieronder je volledige Studiekompas.
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {data?.rapportUrl && (
                <a href={data.rapportUrl} target="_blank" rel="noopener noreferrer" data-testid="link-bekijk-rapport">
                  <Button variant="outline" size="lg" className="w-full">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Lees of beluister je verkenning
                  </Button>
                </a>
              )}
              {data?.pdfUrl && (
                <a href={data.pdfUrl} download data-testid="link-download-pdf">
                  <Button size="lg" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Bewaren als PDF
                  </Button>
                </a>
              )}
            </div>

            {!data?.pdfUrl && (
              <p className="mt-4 text-center text-xs text-muted-foreground" data-testid="text-pdf-onbeschikbaar">
                Je Studiekompas wordt nog klaargezet. Kijk zo nog eens terug om het als PDF te bewaren.
              </p>
            )}
          </>
        )}

        <div className="mt-10 flex justify-center">
          <Link href="/">
            <Button variant="ghost" data-testid="link-to-home">Naar start</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
