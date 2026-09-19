// ---------------------------------------------------------------------------
// client/src/components/mailpoort-paneel.tsx
//
// Het paneel van de mailpoort: kijkt na of er werkelijk berichten kunnen
// vertrekken, verstuurt op vraag een proefbericht, en haalt een blokkering weg.
//
// WAAROM DIT PANEEL BESTAAT. Er werd een batch van drie uitnodigingen verstuurd
// en het scherm meldde in het groen dat alles gelukt was. Er kwam nergens iets
// aan. De verzendweg stond niet ingesteld, en dat stond in geen enkel scherm te
// lezen. Wie berichten de deur uit stuurt, hoort vooraf te kunnen zien of de deur
// open staat, en achteraf te kunnen bewijzen dat er iets door ging.
//
// Het paneel belooft nooit bezorging. Aanvaard door de leverancier is niet
// hetzelfde als gelezen door de ontvanger, en alleen de ontvanger kan het laatste
// vaststellen. Daarom eindigt de proef met de vraag om in de postbus te kijken.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, MailCheck, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export interface Wegkeuring {
  weg: "brevo-api" | "smtp" | "geen";
  bruikbaar: boolean;
  bezwaren: string[];
  wathelpt: string[];
  gevraagdeAfzender: string;
  werkelijkeAfzender: string;
  afzenderStand: "gevalideerd" | "niet gevalideerd" | "onbekend";
  geldigeAfzenders: string[];
  resterendTegoed: number | null;
  gecontroleerdOp: string;
}

interface ProefUitslag {
  status: "verstuurd" | "gesimuleerd" | "fout";
  melding: string | null;
  pogingen: number;
  verstuurdOp: string;
  weg: string;
  afzender: string;
  wat_nu: string;
}

function wegNaam(weg: string): string {
  if (weg === "brevo-api") return "de mailleverancier over HTTPS";
  if (weg === "smtp") return "een eigen mailserver";
  return "geen weg";
}

function foutTekst(e: unknown): string {
  const ruw = e instanceof Error ? e.message : String(e);
  const haakje = ruw.indexOf("{");
  if (haakje > -1) {
    try {
      const lijf = JSON.parse(ruw.slice(haakje));
      if (typeof lijf?.error === "string") return lijf.error;
    } catch {
      // Geen json: dan is de ruwe tekst het beste wat er is.
    }
  }
  return ruw;
}

export function MailpoortPaneel({ afzender }: { afzender?: string }) {
  const [keuring, setKeuring] = useState<Wegkeuring | null>(null);
  const [proef, setProef] = useState<ProefUitslag | null>(null);
  const [naar, setNaar] = useState("");
  const [teDeblokkeren, setTeDeblokkeren] = useState("");
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState<"keuring" | "proef" | "deblokkeer" | null>(null);

  const vraagteken = afzender && afzender.trim() ? `&afzender=${encodeURIComponent(afzender.trim())}` : "";

  async function keur() {
    setBezig("keuring");
    setFout(null);
    setMelding(null);
    try {
      const res = await apiRequest("GET", `/api/admin/mailpoort/diagnose?vers=1${vraagteken}`);
      setKeuring((await res.json()) as Wegkeuring);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(null);
    }
  }

  async function verstuurProef() {
    if (!naar.trim()) return;
    setBezig("proef");
    setFout(null);
    setMelding(null);
    setProef(null);
    try {
      const res = await apiRequest("POST", "/api/admin/mailpoort/proef", {
        naar: naar.trim(),
        afzender: afzender?.trim() || undefined,
      });
      const uitslag = (await res.json()) as ProefUitslag;
      setProef(uitslag);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(null);
    }
  }

  async function haalBlokkeringWeg() {
    if (!teDeblokkeren.trim()) return;
    setBezig("deblokkeer");
    setFout(null);
    setMelding(null);
    try {
      const res = await apiRequest("POST", "/api/admin/mailpoort/deblokkeer", { email: teDeblokkeren.trim() });
      const uitslag = (await res.json()) as { melding?: string };
      setMelding(uitslag.melding ?? "De blokkering is weggehaald.");
      setTeDeblokkeren("");
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(null);
    }
  }

  return (
    <Card className="mb-6" data-testid="card-mailpoort">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="h-4 w-4" /> Verzendweg nakijken
        </CardTitle>
        <CardDescription>
          Kijk na of er werkelijk berichten kunnen vertrekken, en stuur een proefbericht naar uw eigen adres.
          Doe dit voor een reeks uitnodigingen: dan weet u vooraf of de deur open staat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={keur} disabled={bezig !== null} data-testid="button-mailpoort-keuring">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {bezig === "keuring" ? "Bezig met nakijken" : "Verzendweg nakijken"}
          </Button>
        </div>

        {keuring && (
          <Alert
            className={
              keuring.bruikbaar
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-destructive/40 bg-destructive/10"
            }
            data-testid="alert-mailpoort-keuring"
          >
            {keuring.bruikbaar ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>
              {keuring.bruikbaar ? "Er kunnen berichten vertrekken" : "Er kan nu geen enkel bericht vertrekken"}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Weg: {wegNaam(keuring.weg)}. Afzender: {keuring.werkelijkeAfzender} ({keuring.afzenderStand}).
                {keuring.resterendTegoed != null && ` Tegoed vandaag: ${keuring.resterendTegoed}.`}
              </p>
              {keuring.bezwaren.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {keuring.bezwaren.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {keuring.wathelpt.length > 0 && (
                <div>
                  <p className="font-medium">Wat helpt</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {keuring.wathelpt.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs opacity-70">Nagekeken op {keuring.gecontroleerdOp.replace("T", " ").slice(0, 19)}.</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="mailpoort-proef">Proefbericht naar</Label>
            <Input
              id="mailpoort-proef"
              type="email"
              placeholder="uw eigen adres"
              value={naar}
              onChange={(e) => setNaar(e.target.value)}
              data-testid="input-mailpoort-proef"
            />
          </div>
          <Button
            variant="secondary"
            onClick={verstuurProef}
            disabled={bezig !== null || !naar.trim()}
            data-testid="button-mailpoort-proef"
          >
            {bezig === "proef" ? "Bezig met versturen" : "Proefbericht versturen"}
          </Button>
        </div>

        {proef && (
          <Alert
            className={
              proef.status === "verstuurd"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-destructive/40 bg-destructive/10"
            }
            data-testid="alert-mailpoort-proef"
          >
            {proef.status === "verstuurd" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>
              {proef.status === "verstuurd" ? "Het proefbericht is vertrokken" : "Het proefbericht is niet vertrokken"}
            </AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                {proef.verstuurdOp} via {wegNaam(proef.weg)}, van {proef.afzender}, na {proef.pogingen} poging(en).
              </p>
              {proef.melding && <p className="text-xs opacity-80">Antwoord van de leverancier: {proef.melding}</p>}
              <p>{proef.wat_nu}</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="mailpoort-deblokkeer">Blokkering weghalen voor</Label>
            <Input
              id="mailpoort-deblokkeer"
              type="email"
              placeholder="adres dat de leverancier blokkeert"
              value={teDeblokkeren}
              onChange={(e) => setTeDeblokkeren(e.target.value)}
              data-testid="input-mailpoort-deblokkeer"
            />
            <p className="text-xs text-muted-foreground">
              Een adres komt op de blokkeerlijst na een harde weigering of een afmelding. Berichten aan zo'n adres
              worden wel aanvaard en niet bezorgd. Haal een blokkering alleen weg wanneer de ontvanger uw bericht
              verwacht.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={haalBlokkeringWeg}
            disabled={bezig !== null || !teDeblokkeren.trim()}
            data-testid="button-mailpoort-deblokkeer"
          >
            {bezig === "deblokkeer" ? "Bezig" : "Blokkering weghalen"}
          </Button>
        </div>

        {melding && (
          <Alert className="border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{melding}</AlertDescription>
          </Alert>
        )}
        {fout && (
          <Alert className="border-destructive/40 bg-destructive/10" data-testid="alert-mailpoort-fout">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dat lukte niet</AlertTitle>
            <AlertDescription>{fout}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default MailpoortPaneel;
