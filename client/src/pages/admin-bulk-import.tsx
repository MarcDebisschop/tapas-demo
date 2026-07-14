// =============================================================================
// client/src/pages/admin-bulk-import.tsx  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Admin-pagina op /admin/bulk-import: nodig meerdere deelnemers tegelijk uit via
// een Excel/CSV-upload. Kiest een instrument, downloadt de bijhorende template,
// controleert de upload (preview + foutrapport) en verwerkt de rijen
// (uitnodigingen aanmaken + mail versturen/simuleren).
//
// Hergebruikt de bestaande admin-look (shadcn Card/Button/Table) en de
// bestaande organisatie-lijst (/api/organisaties). De 1-voor-1 uitnodig-flow
// blijft onveranderd bestaan; dit is een aanvulling.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from "lucide-react";

// Herleid API_BASE identiek aan queryClient (pplx.app proxy → /port/5000).
const API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

interface VeldDef {
  kolom: string;
  verplicht: boolean;
  hint: string;
}
interface InstrumentDef {
  instrumentId: string;
  titel: string;
  instructie: string;
  velden: VeldDef[];
}
interface InstrumentenResponse {
  simulatiemodus: boolean;
  instrumenten: InstrumentDef[];
}
interface Organisatie {
  id: number;
  naam: string;
}
interface PreviewRij {
  rij: number;
  email: string;
  naam: string;
  taal: string;
  fout: boolean;
  meldingen: string[];
}
interface PreviewResponse {
  instrumentId: string;
  titel: string;
  totaal: number;
  aantalGeldig: number;
  aantalFout: number;
  preview: PreviewRij[];
}
interface VerwerkRij {
  rij: number;
  email: string;
  status: "ok" | "fout" | "overgeslagen";
  link: string | null;
  mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-";
  melding: string;
}
interface VerwerkResponse {
  simulatiemodus: boolean;
  totaal: number;
  aantalOk: number;
  aantalOvergeslagen: number;
  aantalFout: number;
  resultaten: VerwerkRij[];
}

function leesAlsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Bestand kon niet gelezen worden."));
    reader.readAsDataURL(file);
  });
}

export default function AdminBulkImport() {
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [organisatieId, setOrganisatieId] = useState<string>("geen");
  const [afzenderEmail, setAfzenderEmail] = useState<string>("");
  const [linkType, setLinkType] = useState<"vragenlijst" | "dashboard">("vragenlijst");
  const [bestand, setBestand] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [verwerkt, setVerwerkt] = useState<VerwerkResponse | null>(null);
  const [bezig, setBezig] = useState<"controle" | "verwerk" | "template" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const { data: instrumentenData } = useQuery<InstrumentenResponse>({
    queryKey: ["/api/admin/bulk-import/instrumenten"],
  });
  const { data: organisaties } = useQuery<Organisatie[]>({
    queryKey: ["/api/organisaties"],
  });
  // Prior-beheerder? Enkel de hoofdbeheerder mag gratis (zonder organisatie)
  // versturen. Gewone admins moeten een organisatie kiezen (credits).
  const { data: mijnProfiel } = useQuery<{ isPrior: boolean }>({
    queryKey: ["/api/admin/me"],
  });
  const isPrior = mijnProfiel?.isPrior === true;

  const instrumenten = instrumentenData?.instrumenten ?? [];
  const simulatiemodus = instrumentenData?.simulatiemodus ?? false;
  const gekozen = useMemo(
    () => instrumenten.find((i) => i.instrumentId === instrumentId),
    [instrumenten, instrumentId],
  );

  // Niet-prior admins mogen niet 'Geen organisatie' (gratis) kiezen. Zodra de
  // organisatie-lijst geladen is, selecteren we voor hen automatisch de eerste
  // organisatie. Prior-beheerders houden de vrije keuze (incl. 'geen').
  useEffect(() => {
    if (isPrior) return;
    if (organisatieId === "geen" && (organisaties?.length ?? 0) > 0) {
      setOrganisatieId(String(organisaties![0].id));
    }
  }, [isPrior, organisaties, organisatieId]);

  function reset() {
    setPreview(null);
    setVerwerkt(null);
    setFout(null);
  }

  async function downloadTemplate() {
    if (!instrumentId) return;
    setBezig("template");
    setFout(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bulk-import/template/${instrumentId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Download mislukt (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk-import_${instrumentId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Download mislukt.");
    } finally {
      setBezig(null);
    }
  }

  async function controleer() {
    if (!instrumentId || !bestand) return;
    setBezig("controle");
    reset();
    try {
      const bestandBase64 = await leesAlsBase64(bestand);
      const res = await apiRequest("POST", "/api/admin/bulk-import/preview", {
        instrumentId,
        bestandBase64,
      });
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Controle mislukt.");
    } finally {
      setBezig(null);
    }
  }

  async function verwerk() {
    if (!instrumentId || !bestand) return;
    setBezig("verwerk");
    setFout(null);
    setVerwerkt(null);
    try {
      const bestandBase64 = await leesAlsBase64(bestand);
      const res = await apiRequest("POST", "/api/admin/bulk-import/verwerk", {
        instrumentId,
        bestandBase64,
        organisatieId: organisatieId !== "geen" ? Number(organisatieId) : null,
        afzenderEmail: afzenderEmail.trim() || null,
        linkType,
        origin: `${window.location.origin}${window.location.pathname}`,
      });
      const data = (await res.json()) as VerwerkResponse;
      setVerwerkt(data);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Verwerken mislukt.");
    } finally {
      setBezig(null);
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
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Bulk-import (Excel)</h1>
            <p className="text-sm text-muted-foreground">
              Nodig meerdere deelnemers tegelijk uit via een Excel- of CSV-bestand.
            </p>
          </div>
        </div>

        {simulatiemodus && (
          <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>SMTP nog niet geconfigureerd</AlertTitle>
            <AlertDescription>
              Mails worden <strong>gesimuleerd</strong> — de deelnemerslinks worden wél aangemaakt.
              Stel de SMTP-omgevingsvariabelen in om echt te versturen.
            </AlertDescription>
          </Alert>
        )}

        {fout && (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Er ging iets mis</AlertTitle>
            <AlertDescription>{fout}</AlertDescription>
          </Alert>
        )}

        {/* Stap 1: instrument + template */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Kies instrument &amp; download de template</CardTitle>
            <CardDescription>
              Elk instrument heeft eigen kolommen. Gebruik altijd de bijhorende template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Instrument</Label>
                <Select
                  value={instrumentId}
                  onValueChange={(v) => {
                    setInstrumentId(v);
                    reset();
                  }}
                >
                  <SelectTrigger data-testid="select-instrument">
                    <SelectValue placeholder="Kies een instrument…" />
                  </SelectTrigger>
                  <SelectContent>
                    {instrumenten.map((i) => (
                      <SelectItem key={i.instrumentId} value={i.instrumentId}>
                        {i.titel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  disabled={!instrumentId || bezig === "template"}
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  {bezig === "template" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Excel-template
                </Button>
              </div>
            </div>
            {gekozen && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">{gekozen.titel}</p>
                <p className="mb-2">{gekozen.instructie}</p>
                <p className="text-xs">
                  Kolommen:{" "}
                  {gekozen.velden.map((v) => (v.verplicht ? `${v.kolom} (verplicht)` : v.kolom)).join(" · ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stap 2: organisatie + upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Organisatie &amp; bestand</CardTitle>
            <CardDescription>
              De organisatie draagt de credits (1 credit per uitnodiging).{" "}
              {isPrior
                ? "Als hoofdbeheerder kun je 'Geen organisatie' kiezen om gratis (zonder credits) te versturen, bv. voor een promo."
                : "Kies een organisatie; de credits worden op die organisatie verrekend."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Organisatie (optioneel)</Label>
                <Select value={organisatieId} onValueChange={setOrganisatieId}>
                  <SelectTrigger data-testid="select-organisatie">
                    <SelectValue placeholder="Geen organisatie" />
                  </SelectTrigger>
                  <SelectContent>
                    {isPrior && (
                      <SelectItem value="geen">Geen organisatie (gratis — hoofdbeheerder)</SelectItem>
                    )}
                    {(organisaties ?? []).map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.naam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Afzender-e-mail (optioneel, org-eigen)</Label>
                <Input
                  type="email"
                  placeholder="info@tapascity.com"
                  value={afzenderEmail}
                  onChange={(e) => setAfzenderEmail(e.target.value)}
                  data-testid="input-afzender"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Soort uitnodigingslink</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as "vragenlijst" | "dashboard")}>
                <SelectTrigger data-testid="select-linktype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vragenlijst">Vragenlijst starten (#/deelnemer/TOKEN)</SelectItem>
                  <SelectItem value="dashboard">Rechtstreeks naar dashboard (cijferslot — /toegang.html?t=TOKEN)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {linkType === "dashboard"
                  ? "De deelnemer komt via de neutrale pagina op het cijferslot met de juiste achtergrond en daarna rechtstreeks op zijn dashboard."
                  : "De deelnemer opent de vragenlijst om het instrument in te vullen (standaard)."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Bestand (.xlsx of .csv)</Label>
              <Input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  setBestand(e.target.files?.[0] ?? null);
                  reset();
                }}
                data-testid="input-bestand"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                disabled={!instrumentId || !bestand || bezig === "controle"}
                onClick={controleer}
                data-testid="button-controleer"
              >
                {bezig === "controle" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Controleer
              </Button>
              <Button
                variant="default"
                className="gap-1.5"
                disabled={!instrumentId || !bestand || bezig === "verwerk" || !preview || preview.aantalGeldig === 0}
                onClick={verwerk}
                data-testid="button-verwerk"
              >
                {bezig === "verwerk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Verwerk &amp; verstuur
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {preview && !verwerkt && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Controle-resultaat</CardTitle>
              <CardDescription>
                {preview.totaal} rijen · {preview.aantalGeldig} geldig · {preview.aantalFout} met fouten.
                {preview.aantalGeldig > 0
                  ? " Klik op 'Verwerk & verstuur' om de geldige rijen aan te maken."
                  : " Corrigeer de fouten en probeer opnieuw."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rij</TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Taal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((r) => (
                    <TableRow key={r.rij}>
                      <TableCell>{r.rij}</TableCell>
                      <TableCell>{r.naam}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.taal}</TableCell>
                      <TableCell>
                        {r.fout ? (
                          <span className="text-destructive">{r.meldingen.join("; ")}</span>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Verwerk-resultaat */}
        {verwerkt && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Verwerkt</CardTitle>
              <CardDescription>
                {verwerkt.aantalOk} aangemaakt · {verwerkt.aantalOvergeslagen} overgeslagen ·{" "}
                {verwerkt.aantalFout} mislukt.
                {verwerkt.simulatiemodus && " Mails werden gesimuleerd (SMTP niet geconfigureerd)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rij</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mail</TableHead>
                    <TableHead>Link / melding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verwerkt.resultaten.map((r) => (
                    <TableRow key={r.rij}>
                      <TableCell>{r.rij}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>
                        <span
                          className={
                            r.status === "ok"
                              ? "text-emerald-600"
                              : r.status === "overgeslagen"
                                ? "text-amber-600"
                                : "text-destructive"
                          }
                        >
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell>{r.mailStatus}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {r.link ? (
                          <a href={r.link} className="text-primary hover:underline" title={r.link}>
                            {r.link}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{r.melding}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
