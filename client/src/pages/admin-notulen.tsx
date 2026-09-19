// =============================================================================
// client/src/pages/admin-notulen.tsx  -  NIEUW BESTAND
// -----------------------------------------------------------------------------
// Beheerpagina op /admin/notulen: beknopte notulen van het Team of Captains in
// Word uploaden en terugkrijgen als volledig verslag in het vaste verslagmodel,
// in de huisstijl van TaPasCity.
//
// De pagina werkt in drie stappen. Eerst het invulblad, zodat de verslaggever
// weet welke koppen de omzetting leest. Dan de upload van de beknopte notulen.
// Dan het rapport met wat de omzetting gevonden heeft en wat de beheerder nog moet nakijken,
// met daarnaast de knop om het verslag te downloaden.
//
// De omzetting bewaart niets op de server. Het bestand gaat heen, het verslag
// komt terug, en dat is het.
// =============================================================================

import { useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";

// Zelfde herleiding als in queryClient: achter de pplx.app-proxy loopt alles
// langs /port/5000.
const API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

interface Omzetrapport {
  bestandsnaam: string;
  alineas: number;
  tabellen: number;
  streepjesVervangen: number;
  kerngegevensGevonden: string[];
  kerngegevensOntbreken: string[];
  themasMetInhoud: string[];
  aantallen: {
    besluiten: number;
    acties: number;
    openPunten: number;
    risicos: number;
    vragen: number;
    werkafspraken: number;
    kernboodschap: number;
    opvolging: number;
    bijlagen: number;
    nietGeplaatst: number;
  };
  aandacht: string[];
}

interface Wijziging {
  plaats: string;
  categorie: string;
  voor: string;
  na: string;
}

interface Aandachtspunt {
  plaats: string;
  categorie: string;
  melding: string;
  fragment: string;
}

interface Redactierapport {
  aantalWijzigingen: number;
  wijzigingen: Wijziging[];
  aandacht: Aandachtspunt[];
  gemiddeldeZinslengte: number;
  lijdendeVormProcent: number;
  leesrondeNodig: boolean;
  slotwoord: string;
}

interface OmzetAntwoord {
  rapport: Omzetrapport;
  redactie: Redactierapport | null;
  bestandsnaam: string;
  bestandBase64: string;
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Leesbare namen van de kerngegevens, gelijk aan die in het verslag. */
const KERNVELD_LABEL: Record<string, string> = {
  vergadering: "Vergadering",
  datumEnUur: "Datum en uur",
  locatie: "Locatie",
  voorzitter: "Voorzitter",
  verslaggever: "Verslaggever",
  aanwezig: "Aanwezig",
  verontschuldigd: "Verontschuldigd",
  gast: "Gast of genodigde",
  verspreiding: "Verspreiding",
  status: "Status van dit verslag",
  vertrouwelijkheid: "Vertrouwelijkheid",
  volgende: "Volgende vergadering",
};

const THEMA_LABEL: Record<string, string> = {
  A: "A. Platform en technologie",
  B: "B. Psychometrie en academische onderbouwing",
  C: "C. Commercie, klanten en groei",
  D: "D. Organisatie, rollen en governance",
  E: "E. Coachnetwerk en kwaliteitsbewaking",
  F: "F. TaPas Academy en opleiding",
  G: "G. Merk en positionering",
  H: "H. Financiën, facturatie en rapportering",
  I: "I. Samenwerking binnen het Team of Captains",
};

function leesAlsBase64(bestand: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader();
    lezer.onload = () => resolve(String(lezer.result ?? ""));
    lezer.onerror = () => reject(new Error("De omzetting kon het bestand niet lezen."));
    lezer.readAsDataURL(bestand);
  });
}

/** Zet base64 om naar een blob en biedt die aan als download. */
function biedAan(base64: string, naam: string): void {
  const ruw = atob(base64);
  const bytes = new Uint8Array(ruw.length);
  for (let i = 0; i < ruw.length; i++) bytes[i] = ruw.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminNotulen() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [antwoord, setAntwoord] = useState<OmzetAntwoord | null>(null);
  const [bezig, setBezig] = useState<"omzetten" | "invulblad" | null>(null);
  const [redactieAan, setRedactieAan] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  async function haalInvulblad() {
    setBezig("invulblad");
    setFout(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/notulen-toc/invulblad`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`De download is mislukt (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TaPasCity-Beknopte-notulen-invulblad.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "De download is mislukt.");
    } finally {
      setBezig(null);
    }
  }

  async function zetOm() {
    if (!bestand) return;
    setBezig("omzetten");
    setFout(null);
    setAntwoord(null);
    try {
      const bestandBase64 = await leesAlsBase64(bestand);
      const res = await apiRequest("POST", "/api/admin/notulen-toc/omzetten", {
        bestandsnaam: bestand.name,
        bestandBase64,
        redactie: redactieAan,
      });
      setAntwoord((await res.json()) as OmzetAntwoord);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "De omzetting is mislukt.");
    } finally {
      setBezig(null);
    }
  }

  const rapport = antwoord?.rapport ?? null;
  const redactie = antwoord?.redactie ?? null;
  const tellingen: Array<[string, number]> = rapport
    ? [
        ["Besluiten", rapport.aantallen.besluiten],
        ["Acties", rapport.aantallen.acties],
        ["Openstaande punten", rapport.aantallen.openPunten],
        ["Risico's", rapport.aantallen.risicos],
        ["Vragen aan de partner", rapport.aantallen.vragen],
        ["Werkafspraken", rapport.aantallen.werkafspraken],
        ["Kernboodschap", rapport.aantallen.kernboodschap],
        ["Opvolging vorige acties", rapport.aantallen.opvolging],
        ["Bijlagen", rapport.aantallen.bijlagen],
        ["Nog te plaatsen", rapport.aantallen.nietGeplaatst],
      ]
    : [];

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
              Notulen Team of Captains
            </h1>
            <p className="text-sm text-muted-foreground">
              Zet beknopte notulen om naar het vaste verslagmodel, klaar voor aandeelhouders en
              investeringspartners.
            </p>
          </div>
        </div>

        {fout && (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Er ging iets mis</AlertTitle>
            <AlertDescription data-testid="text-fout">{fout}</AlertDescription>
          </Alert>
        )}

        {/* Stap 1: het invulblad. */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Schrijf de beknopte notulen</CardTitle>
            <CardDescription>
              Het invulblad toont welke koppen de omzetting leest. Wie dat blad gebruikt, krijgt een
              verslag dat meteen klopt. Een eigen opmaak werkt ook: de omzetting leest koppen,
              opsommingen en tabellen. Wat ze niet kan plaatsen, zet ze achteraan onder "Nog te
              plaatsen", zodat niets verloren gaat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={haalInvulblad}
              disabled={bezig !== null}
              data-testid="button-invulblad"
            >
              {bezig === "invulblad" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Invulblad downloaden
            </Button>
          </CardContent>
        </Card>

        {/* Stap 2: de upload. */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Voeg de beknopte notulen toe</CardTitle>
            <CardDescription>
              Een Word-bestand met de uitkomst van het overleg. De grens ligt op 8 MB. De omzetting
              bewaart het bestand niet op de server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bestand">Word-bestand (.docx)</Label>
              <Input
                id="bestand"
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  setBestand(e.target.files?.[0] ?? null);
                  setAntwoord(null);
                  setFout(null);
                }}
                data-testid="input-bestand"
              />
            </div>
            <label className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={redactieAan}
                onChange={(e) => setRedactieAan(e.target.checked)}
                data-testid="input-redactie"
              />
              <span>
                <span className="font-medium text-foreground">Ook de redactieronde uitvoeren</span>
                <span className="block text-muted-foreground">
                  De omzetting vervangt dan Engelse leenwoorden, ambtelijke wendingen en
                  naamwoordstijl door gewoon Nederlands. Zij meldt ook de zinnen die u zelf moet
                  herschrijven. Achteraf krijgt u de tabel met wat er stond en wat er nu staat.
                </span>
              </span>
            </label>

            <Button onClick={zetOm} disabled={!bestand || bezig !== null} data-testid="button-omzetten">
              {bezig === "omzetten" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Omzetten naar het vaste verslagmodel
            </Button>
          </CardContent>
        </Card>

        {/* Stap 3: rapport en download. */}
        {rapport && antwoord && (
          <Card className="mb-6" data-testid="card-rapport">
            <CardHeader>
              <CardTitle>3. Het verslag is klaar</CardTitle>
              <CardDescription>
                Kijk eerst na wat hieronder staat, vul dat aan in het verslag en verstuur het
                daarna.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-primary/40 bg-primary/5">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{antwoord.bestandsnaam}</AlertTitle>
                <AlertDescription>
                  Gelezen uit "{rapport.bestandsnaam}": {rapport.alineas} alinea's en{" "}
                  {rapport.tabellen} tabel(len). Vervangen gedachtestreepjes:{" "}
                  {rapport.streepjesVervangen}. In het verslag staat er nu geen enkel meer.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => biedAan(antwoord.bestandBase64, antwoord.bestandsnaam)}
                data-testid="button-download-verslag"
              >
                <Download className="mr-2 h-4 w-4" />
                Verslag downloaden
              </Button>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Wat de omzetting vond</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tellingen.map(([naam, aantal]) => (
                    <div
                      key={naam}
                      className="flex items-baseline justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">{naam}</span>
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {aantal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Thema's met inhoud ({rapport.themasMetInhoud.length} van 9)
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {rapport.themasMetInhoud.length === 0 && <li>De omzetting herkende geen enkel thema.</li>}
                    {rapport.themasMetInhoud.map((letter) => (
                      <li key={letter}>{THEMA_LABEL[letter] ?? letter}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Kerngegevens die nog ontbreken
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {rapport.kerngegevensOntbreken.length === 0 && (
                      <li>De omzetting vond alle kerngegevens.</li>
                    )}
                    {rapport.kerngegevensOntbreken.map((veld) => (
                      <li key={veld}>{KERNVELD_LABEL[veld] ?? veld}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {redactie && (
                <div data-testid="blok-redactie">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">De redactieronde</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {redactie.aantalWijzigingen === 0
                      ? "De ronde vond geen enkel woord om te vervangen."
                      : `De ronde verving ${redactie.aantalWijzigingen} woord(en) of wending(en).`}{" "}
                    Gemiddelde zinslengte: {redactie.gemiddeldeZinslengte} woorden, streefwaarde
                    achttien. Zinnen in de lijdende vorm: {redactie.lijdendeVormProcent} procent,
                    hoogstens twintig.
                  </p>

                  {redactie.wijzigingen.length > 0 && (
                    <div className="mb-4 overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-left text-sm" data-testid="tabel-redactie">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Waar</th>
                            <th className="px-3 py-2 font-medium">Er stond</th>
                            <th className="px-3 py-2 font-medium">Er staat nu</th>
                            <th className="px-3 py-2 font-medium">Soort</th>
                          </tr>
                        </thead>
                        <tbody>
                          {redactie.wijzigingen.map((w, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-3 py-2 text-muted-foreground">{w.plaats}</td>
                              <td className="px-3 py-2 text-foreground">{w.voor}</td>
                              <td className="px-3 py-2 font-medium text-foreground">{w.na}</td>
                              <td className="px-3 py-2 text-muted-foreground">{w.categorie}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {redactie.aandacht.length > 0 && (
                    <div className="mb-3">
                      <h4 className="mb-1.5 text-sm font-medium text-foreground">
                        Zinnen die u zelf moet herschrijven ({redactie.aandacht.length})
                      </h4>
                      <ul className="space-y-2 text-sm" data-testid="lijst-redactie-aandacht">
                        {redactie.aandacht.map((a, i) => (
                          <li key={i} className="rounded-md border border-border px-3 py-2">
                            <span className="block text-muted-foreground">
                              {a.plaats}, {a.categorie}: {a.melding}
                            </span>
                            <span className="mt-1 block italic text-foreground">"{a.fragment}"</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Alert className="border-amber-500/40 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>De ronde keurt de vorm, niet de betekenis</AlertTitle>
                    <AlertDescription>{redactie.slotwoord}</AlertDescription>
                  </Alert>
                </div>
              )}

              {rapport.aandacht.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Wat u nog moet nakijken</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground" data-testid="list-aandacht">
                    {rapport.aandacht.map((melding, i) => (
                      <li key={i} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>{melding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
