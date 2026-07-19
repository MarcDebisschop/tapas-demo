// =============================================================================
// client/src/pages/koop.tsx  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Privé-aankoopflow voor particulieren. Eén pagina met drie interne stappen:
//   1. GDPR-informatie + strikt minimale intake (naam, e-mail; kind bij t4teens/
//      t4students) + verplichte consent.
//   2. Mollie-betaalpagina (SIMULATIE) — toont bedrag, bevestigt de betaling.
//   3. Bevestiging — factuurnummer + downloadknop + "Start nu je [instrument]".
//
// Alle teksten in het Nederlands (Vlaams). Hergebruikt de bestaande prijzen-
// store (/api/prive-prijzen) en privé-aankoop-endpoints.
// =============================================================================

import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vindInstrument } from "@/data/instrumentengids";
import { ShieldCheck, Download, ArrowRight, CreditCard, Loader2, Lock } from "lucide-react";

interface PubliekePrijs {
  instrumentId: string;
  naam: string;
  bedragInclBtwCent: number;
  bedragInclBtw: number;
}

function euro(cent: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cent / 100);
}

type Stap = "intake" | "betaal" | "klaar";

export default function Koop() {
  const params = useParams<{ instrument: string }>();
  const instrumentId = params.instrument ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: prijzen, isLoading } = useQuery<PubliekePrijs[]>({
    queryKey: ["/api/prive-prijzen"],
  });
  const prijs = useMemo(
    () => (prijzen ?? []).find((p) => p.instrumentId === instrumentId),
    [prijzen, instrumentId],
  );

  const isKind =
    instrumentId === "t4kids" ||
    instrumentId === "t4teens" ||
    instrumentId === "t4students";
  const instr = vindInstrument(instrumentId);
  const startRoute = instr?.start.route ?? "/";

  const [stap, setStap] = useState<Stap>("intake");
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [kindNaam, setKindNaam] = useState("");
  const [kindEmail, setKindEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [bezig, setBezig] = useState(false);

  const [betalingId, setBetalingId] = useState<number | null>(null);
  const [factuurnummer, setFactuurnummer] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const intakeGeldig =
    voornaam.trim() &&
    achternaam.trim() &&
    /.+@.+\..+/.test(email) &&
    consent &&
    (!isKind || (kindNaam.trim() && /.+@.+\..+/.test(kindEmail)));

  async function verzendIntake() {
    if (!intakeGeldig) return;
    setBezig(true);
    try {
      const res = await apiRequest("POST", "/api/prive-aankoop/intake", {
        instrumentId,
        voornaam: voornaam.trim(),
        achternaam: achternaam.trim(),
        email: email.trim(),
        consent: true,
        ...(isKind ? { kindNaam: kindNaam.trim(), kindEmail: kindEmail.trim() } : {}),
      });
      const data = await res.json();
      setBetalingId(data.betalingId);
      setStap("betaal");
    } catch (e: any) {
      toast({ title: "Er ging iets mis", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  async function betaal() {
    if (betalingId == null) return;
    setBezig(true);
    try {
      const res = await apiRequest("POST", "/api/prive-aankoop/bevestig", { betalingId });
      const data = await res.json();
      setFactuurnummer(data.factuurnummer);
      setDownloadUrl(data.downloadUrl);
      setStap("klaar");
    } catch (e: any) {
      toast({ title: "Betaling mislukt", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  const naam = prijs?.naam ?? instr?.naam ?? instrumentId;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {naam} — privé aankopen
        </h1>

        {isLoading && (
          <p className="mt-6 text-sm text-muted-foreground">Prijs wordt geladen…</p>
        )}

        {!isLoading && !prijs && (
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Dit instrument is momenteel niet privé beschikbaar. Neem contact op met je
              organisatie of vraag het aan via de Instrumentengids.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/instrumenten")}>
              Terug naar de Instrumentengids
            </Button>
          </div>
        )}

        {!isLoading && prijs && (
          <>
            {/* Prijsbanner */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
              <span className="text-sm text-muted-foreground">Te betalen (incl. btw)</span>
              <span className="font-serif text-xl font-semibold text-foreground">
                {euro(prijs.bedragInclBtwCent)}
              </span>
            </div>

            {/* ---- Stap 1: GDPR + intake ---- */}
            {stap === "intake" && (
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Jouw gegevens & privacy (GDPR)</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    We vragen enkel de gegevens die strikt nodig zijn om je rapport op te
                    maken en de factuur te bezorgen. Niets meer.
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li><strong>Doelbinding:</strong> je gegevens worden uitsluitend gebruikt voor het rapport en de facturatie.</li>
                    <li><strong>Bewaartermijn:</strong> we bewaren je gegevens niet langer dan wettelijk of operationeel noodzakelijk.</li>
                    <li><strong>Jouw rechten:</strong> je hebt recht op inzage, correctie en verwijdering van je gegevens.</li>
                    <li><strong>Verwerkingsverantwoordelijke:</strong> TaPasCity.</li>
                  </ul>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="voornaam">Voornaam</Label>
                    <Input id="voornaam" value={voornaam} onChange={(e) => setVoornaam(e.target.value)} data-testid="input-voornaam" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="achternaam">Achternaam</Label>
                    <Input id="achternaam" value={achternaam} onChange={(e) => setAchternaam(e.target.value)} data-testid="input-achternaam" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mailadres</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
                </div>

                {isKind && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Gegevens van je kind / de student</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Als ouder/koper vul je hier de gegevens in van het kind of de student voor wie je koopt.
                    </p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="kindNaam">Naam kind / student</Label>
                        <Input id="kindNaam" value={kindNaam} onChange={(e) => setKindNaam(e.target.value)} data-testid="input-kind-naam" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kindEmail">E-mailadres kind / student</Label>
                        <Input id="kindEmail" type="email" value={kindEmail} onChange={(e) => setKindEmail(e.target.value)} data-testid="input-kind-email" />
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} data-testid="checkbox-consent" className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Ik geef toestemming om mijn gegevens te verwerken voor het opmaken van het rapport en
                    de facturatie, zoals hierboven beschreven. Ik weet dat ik recht heb op inzage en verwijdering.
                  </span>
                </label>

                <Button onClick={verzendIntake} disabled={!intakeGeldig || bezig} className="gap-1.5" data-testid="button-naar-betaling">
                  {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Ga naar de betaling
                </Button>
              </div>
            )}

            {/* ---- Stap 2: Mollie-betaalpagina (simulatie) ---- */}
            {stap === "betaal" && (
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Je gaat betalen voor</p>
                  <p className="font-serif text-lg font-semibold text-foreground">{naam}</p>
                  <p className="mt-2 font-serif text-2xl font-bold text-foreground">{euro(prijs.bedragInclBtwCent)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Beveiligde betaling via Mollie (demo)</p>
                  <Button onClick={betaal} disabled={bezig} className="mt-6 w-full gap-1.5" data-testid="button-betaal">
                    {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Betaal met Mollie (demo)
                  </Button>
                </div>
              </div>
            )}

            {/* ---- Stap 3: Bevestiging ---- */}
            {stap === "klaar" && (
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-sm font-semibold">Betaling geslaagd — bedankt!</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Je factuur is aangemaakt met nummer{" "}
                    <span className="font-mono font-semibold text-foreground">{factuurnummer}</span>.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {downloadUrl && (
                      <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="gap-1.5" data-testid="button-download-factuur">
                          <Download className="h-4 w-4" />
                          Download factuur
                        </Button>
                      </a>
                    )}
                    <Button className="gap-1.5" onClick={() => navigate(startRoute)} data-testid="button-start-instrument">
                      <ArrowRight className="h-4 w-4" />
                      Start nu je {naam}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
