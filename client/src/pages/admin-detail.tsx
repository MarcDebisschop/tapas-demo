import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import UitlegPaneel from "@/components/UitlegPaneel";
import { normaliseerTaal } from "@shared/i18n";
import { isTapasBeeld } from "@shared/talent-constructs";
import type { AdminAfnameDetail, RapportSamenvatting } from "@/lib/types";
import { ChevronLeft, Copy, Check, ShieldCheck, FileText, ExternalLink } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// TaPas-Beeld zit administratief in de familie "Talent-foci", maar is inhoudelijk
// GEEN talent-focus (het is een zelfbeeld-/kalibratielens). In deze diagnostische
// tabel tonen we daarom een afwijkend, expliciet label zodat het nooit lijkt alsof
// TaPas-Beeld deel uitmaakt van de talent-foci.
function familieLabelVoorWeergave(construct: unknown, family: unknown): string {
  if (isTapasBeeld(construct)) return "Zelfbeeld (geen talent-focus)";
  return String(family ?? "");
}

function RapportTab({ afnameId }: { afnameId: number }) {
  const { toast } = useToast();
  const { data: rapporten, isLoading } = useQuery<RapportSamenvatting[]>({
    queryKey: ["/api/rapporten", afnameId],
    queryFn: () => apiRequest("GET", `/api/rapporten?afnameId=${afnameId}`).then((r) => r.json()),
  });

  const genereer = useMutation({
    mutationFn: (variant: "kompas" | "coachatlas") =>
      apiRequest("POST", "/api/rapporten", { afnameId, variant }).then((r) => r.json()),
    onSuccess: (rapport: RapportSamenvatting) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rapporten", afnameId] });
      toast({ title: "Rapport gegenereerd", description: rapport.titel });
    },
    onError: (e: any) => {
      toast({ title: "Rapportgeneratie mislukt", description: String(e.message ?? e), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium text-foreground">Nieuw rapport genereren</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kies een variant. Het rapport vertaalt het profiel naar energie- en gedragstaal — zonder
            talent-, selectie- of diagnoseclaims.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => genereer.mutate("kompas")}
              disabled={genereer.isPending}
              data-testid="button-genereer-kompas"
            >
              <FileText className="mr-1.5 h-4 w-4" />
              {genereer.isPending ? "Bezig..." : "Kompas genereren"}
            </Button>
            <Button
              variant="outline"
              onClick={() => genereer.mutate("coachatlas")}
              disabled={genereer.isPending}
              data-testid="button-genereer-coachatlas"
            >
              <FileText className="mr-1.5 h-4 w-4" />
              {genereer.isPending ? "Bezig..." : "Coachatlas genereren"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !rapporten || rapporten.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground" data-testid="text-rapporten-leeg">
              Nog geen rapporten voor deze afname.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="hidden sm:table-cell">Aangemaakt</TableHead>
                  <TableHead className="text-right">Openen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rapporten.map((r) => (
                  <TableRow key={r.id} data-testid={`row-rapport-${r.id}`}>
                    <TableCell className="font-medium text-foreground">{r.titel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-variant-${r.id}`}>
                        {r.variant === "kompas" ? "Kompas" : "Coachatlas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`${API_BASE}/api/rapporten/${r.id}/html`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-sm text-accent underline-offset-2 hover:underline"
                        data-testid={`link-rapport-html-${r.id}`}
                      >
                        Bekijk <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<AdminAfnameDetail>({
    queryKey: ["/api/admin/afnames", id],
  });

  const contract = data?.generatorContract ?? null;
  const contractText = contract ? JSON.stringify(contract, null, 2) : "";

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(contractText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Kopiëren mislukt", description: "Kopieer handmatig uit het tekstvak.", variant: "destructive" });
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-64 w-full" />
        </main>
      </div>
    );
  }

  const meta = contract?.sections?.main?.meta;
  const constructRows = contract?.sections?.main?.constructRows ?? [];
  const connection = contract?.sections?.connection;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/admin">
          <a className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
            <ChevronLeft className="mr-1 h-4 w-4" /> Terug naar overzicht
          </a>
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground" data-testid="text-detail-name">
              {data.name}
            </h1>
            <p className="text-sm text-muted-foreground">{data.respondentCode}</p>
          </div>
          <Badge variant="outline" data-testid="badge-status">{data.status}</Badge>
        </div>

        {/* Identiteit + consent */}
        <Card className="mt-6">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Organisatie</dt><dd className="font-medium">{data.company || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Functie</dt><dd className="font-medium">{data.role || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Baseline-energie</dt><dd className="font-medium">{data.baselineEnergy} / 10</dd></div>
            </dl>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" /> Toestemming
              </p>
              <p className="mt-1 text-muted-foreground">
                {data.consentGiven ? "Gegeven" : "Niet gegeven"}
                {data.consentTimestamp ? ` · ${new Date(data.consentTimestamp).toLocaleString("nl-BE")}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.consentScope}</p>
            </div>
          </CardContent>
        </Card>

        {data.status !== "voltooid" || !contract ? (
          <Card className="mt-6">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Deze afname is nog niet voltooid. Het profiel en de generator-JSON verschijnen
              zodra deel 1 en deel 2 zijn ingeleverd.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="profiel" className="mt-6">
            <TabsList>
              <TabsTrigger value="profiel" data-testid="tab-profiel">Profiel</TabsTrigger>
              <TabsTrigger value="json" data-testid="tab-json">Generator-JSON</TabsTrigger>
              <TabsTrigger value="rapport" data-testid="tab-rapport">Rapport</TabsTrigger>
            </TabsList>

            <TabsContent value="profiel" className="mt-4 space-y-4">
              {/* Kerncijfers */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Gemiddelde energie", value: meta?.averageEnergy },
                  { label: "Genormaliseerd (0-10)", value: meta?.normalizedQuestionnaireEnergy },
                  { label: "Energieverschil", value: meta?.energyDiscrepancy },
                ].map((m, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="mt-1 text-lg font-semibold text-foreground" data-testid={`metric-${i}`}>{m.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Driver-risico</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {meta?.driverRisk?.label} <span className="text-sm font-normal text-muted-foreground">(gem. {meta?.driverRisk?.avg})</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Consistentie</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {meta?.consistency?.label} <span className="text-sm font-normal text-muted-foreground">({meta?.consistency?.score}/100)</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Constructen */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Construct</TableHead>
                        <TableHead className="hidden sm:table-cell">Familie</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Energie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {constructRows.map((r: any) => (
                        <TableRow key={r.construct}>
                          <TableCell className="font-medium text-foreground">{r.construct}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{familieLabelVoorWeergave(r.construct, r.family)}</TableCell>
                          <TableCell className="text-right">{r.net}</TableCell>
                          <TableCell className="text-right">{r.avgEnergy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Gesproken duiding voor de coach (zakelijk, coaching-toon, eigen paywall) */}
              {data.dashboardToken && (
                <UitlegPaneel
                  token={data.dashboardToken}
                  taal={normaliseerTaal(data.taal ?? "nl")}
                  toon="coach"
                />
              )}

              {/* Verbondenheid */}
              {connection && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-foreground">Organisatieverbondenheid (0–10)</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(connection.labels).map(([k, label]) => (
                        <div key={k} className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">{label as string}</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{connection.answers[k]}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button onClick={copyJson} size="sm" data-testid="button-copy-json">
                  {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                  {copied ? "Gekopieerd" : "Kopieer JSON"}
                </Button>
                <a
                  href={`${API_BASE}/api/admin/afnames/${id}/contract.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" data-testid="button-download-json">Download als bestand</Button>
                </a>
                <span className="text-xs text-muted-foreground">
                  Contract v{contract.contractVersion} · klaar voor de TaPas-generator
                </span>
              </div>
              <pre
                className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground"
                data-testid="pre-json"
              >
                {contractText}
              </pre>
            </TabsContent>

            <TabsContent value="rapport" className="mt-4">
              <RapportTab afnameId={id} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
