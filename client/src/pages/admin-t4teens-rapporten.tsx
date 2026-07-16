// =============================================================================
// client/src/pages/admin-t4teens-rapporten.tsx  —  NIEUW BESTAND (Regel 2)
// -----------------------------------------------------------------------------
// Admin-pagina op /admin/t4teens-rapporten: centraal overzicht van alle
// gegenereerde T4Teens-"Studiekompas"-rapporten, met ÉÉN knop om alle PDF's
// samen als ZIP te downloaden (elk bestand met de leerlingnaam).
//
// Volledig additief: leest enkel de nieuwe endpoints
//   GET /api/t4teens/rapporten        (lijst)
//   GET /api/t4teens/rapporten.zip    (alle PDF's in één ZIP)
// en raakt geen bestaand pad of bestaande pagina aan. Hergebruikt de bestaande
// admin-look (shadcn Card/Button/Table), net als admin-bulk-import.tsx.
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Download,
  FileText,
  ArrowLeft,
  Loader2,
  Info,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

// Herleid API_BASE identiek aan queryClient (pplx.app proxy → /port/5000).
const API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

interface RapportRij {
  id: string;
  naam: string;
  aangemaakt: number;
  heeftPdf: boolean;
  rapportUrl: string;
  pdfUrl: string | null;
}
interface RapportenResponse {
  aantal: number;
  metPdf: number;
  rapporten: RapportRij[];
}

function formatDatum(ms: number): string {
  try {
    return new Date(ms).toLocaleString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function AdminT4TeensRapporten() {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<RapportenResponse>({
    queryKey: ["/api/t4teens/rapporten"],
    queryFn: () => apiRequest("GET", "/api/t4teens/rapporten").then((r) => r.json()),
  });

  const rapporten = data?.rapporten ?? [];
  const aantalMetPdf = data?.metPdf ?? 0;

  async function downloadAlleZip() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`${API_BASE}/api/t4teens/rapporten.zip`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Er zijn nog geen PDF's beschikbaar om te bundelen.");
        }
        throw new Error(`Download mislukt (${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stempel = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `T4Teens-Studiekompas-rapporten-${stempel}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Download mislukt.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/admin">
          <a className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Terug naar beheer
          </a>
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              T4Teens — Studiekompas-rapporten
            </h1>
            <p className="text-sm text-muted-foreground">
              Alle gegenereerde rapporten centraal, met één knop om alle PDF's samen te downloaden.
            </p>
          </div>
        </div>

        {/* De centrale knop */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Alle PDF's centraal downloaden</CardTitle>
            <CardDescription>
              Bundelt alle beschikbare Studiekompas-PDF's in één ZIP-bestand. Elk bestand draagt de
              naam van de leerling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={downloadAlleZip}
                disabled={bezig || aantalMetPdf === 0}
                data-testid="btn-download-alle-zip"
              >
                {bezig ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Alle PDF's downloaden (ZIP)
                {aantalMetPdf > 0 ? ` — ${aantalMetPdf}` : ""}
              </Button>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="btn-vernieuw"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Vernieuwen
              </Button>
            </div>

            {aantalMetPdf === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground" data-testid="text-geen-pdf">
                Nog geen PDF's beschikbaar. Zodra leerlingen hun T4Teens-verkenning afronden,
                verschijnen de rapporten hier automatisch.
              </p>
            )}

            {fout && (
              <Alert variant="destructive">
                <AlertTitle>Er ging iets mis</AlertTitle>
                <AlertDescription>{fout}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Goed om te weten</AlertTitle>
              <AlertDescription>
                Rapporten worden op de server bewaard en overleven een herstart. Voor de eerste
                officiële test bewaar je de gedownloade ZIP best ook lokaal in een gedeelde map.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Lijst van rapporten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Gegenereerde rapporten{data ? ` (${data.aantal})` : ""}
            </CardTitle>
            <CardDescription>
              Overzicht van alle Studiekompas-rapporten, van nieuw naar oud.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 px-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : rapporten.length === 0 ? (
              <div
                className="px-6 py-12 text-center text-sm text-muted-foreground"
                data-testid="text-rapporten-leeg"
              >
                Nog geen rapporten.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leerling</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Bekijken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rapporten.map((r) => (
                    <TableRow key={r.id} data-testid={`row-rapport-${r.id}`}>
                      <TableCell className="font-medium">{r.naam}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDatum(r.aangemaakt)}
                      </TableCell>
                      <TableCell>
                        {r.heeftPdf ? (
                          <a
                            href={`${API_BASE}${r.pdfUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            data-testid={`link-pdf-${r.id}`}
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`${API_BASE}${r.rapportUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          data-testid={`link-html-${r.id}`}
                        >
                          Openen <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
