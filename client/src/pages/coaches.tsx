// ---------------------------------------------------------------------------
// Coaches (publiek register) — gereconstrueerd uit bundle (index-DPZKsx0y.js)
// Functienaam in bundle: qTe()
// Sub-componenten: zTe (JesterSectie), HTe (foto), DTe (regio)
// API: GET /api/coaches/publiek
// ZIP-6 bron: TaPas-Platform-6.zip (correcte versie)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight, Mail } from "lucide-react";

// -----------------------------------------------------------------------
// Foto-overrides voor de algemene lijst (op verzoek Marc, 2026-07):
// de vier kernpersonen worden OOK in de publieke coach-grid in plain
// zwart-wit getoond i.p.v. hun Rembrandt-portret. Rembrandt blijft
// uitsluitend in de Galerij der Jesters. We wijzigen GEEN serverdata:
// we mappen enkel de bekende Rembrandt-bronpaden naar de nieuwe B&W-assets.
// -----------------------------------------------------------------------
const FOTO_BW_OVERRIDE: Record<string, string> = {
  "/jester/portret-marc.jpg": "/coaches-lijst/marc-bw.jpg",
  "/jester/portret-kris.jpg": "/coaches-lijst/kris-bw.jpg",
  "/jester/portret-leen.jpg": "/coaches-lijst/leen-bw.jpg",
  "/jester/portret-herman.jpg": "/coaches-lijst/herman-bw.jpg",
};

function bwFoto(url?: string): string | undefined {
  if (!url) return url;
  return FOTO_BW_OVERRIDE[url] ?? url;
}

// Jester array — exacte volgorde en data uit ZIP-6 bundle (QTe array, pos. 1469289)
// FOTO'S: algemene lijst toont plain zwart-wit portretten (op verzoek Marc, 2026-07).
// Rembrandt-portretten blijven uitsluitend in de Galerij der Jesters (/academy/jester).
// Bronbestanden: client/public/coaches-lijst/*-bw.jpg (nieuwe, aparte assets — Regel 2).
const JESTERS = [
  { naam: "Marc Debisschop", rol: "Grondlegger van het TaPas-gedachtegoed", foto: "/coaches-lijst/marc-bw.jpg" },
  { naam: "Prof. Leen Adams", rol: "Het academische en deontologische geweten", foto: "/coaches-lijst/leen-bw.jpg" },
  { naam: "Herman Van Esbroeck", rol: "Bewaker van de menselijke maat", foto: "/coaches-lijst/herman-bw.jpg" },
  { naam: "Kris Debisschop", rol: "Mede-architect van het instrumentarium", foto: "/coaches-lijst/kris-bw.jpg" },
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
  const foto = bwFoto(coach.fotoUrl);
  if (foto) {
    return (
      <img
        src={foto}
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
function CoachContactDialog(props: { coach: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { coach, open, onOpenChange } = props;
  const { toast } = useToast();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [bericht, setBericht] = useState("");
  const [verzonden, setVerzonden] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      return (await apiRequest("POST", "/api/coaches/" + coach.id + "/contact", {
        naam: naam.trim(),
        email: email.trim(),
        bericht: bericht.trim(),
      })).json();
    },
    onSuccess: () => {
      setVerzonden(true);
      toast({ title: "Bericht verzonden", description: "Je bericht voor " + coach.naam + " is goed ontvangen." });
    },
    onError: (e: any) => {
      toast({ title: "Versturen mislukt", description: e?.message ?? "Probeer het later opnieuw.", variant: "destructive" });
    },
  });

  function reset() { setNaam(""); setEmail(""); setBericht(""); setVerzonden(false); }
  function handleOpenChange(v: boolean) { if (!v) reset(); onOpenChange(v); }

  const kanVersturen =
    naam.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    bericht.trim().length > 0 &&
    !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid={"dialog-contact-" + coach.id}>
        <DialogHeader>
          <DialogTitle>Contact opnemen met {coach.naam}</DialogTitle>
          <DialogDescription>
            Je bericht wordt bezorgd aan <span className="font-medium text-foreground">{coach.naam}</span>. Vul je gegevens in en {coach.naam} neemt met jou contact op.
          </DialogDescription>
        </DialogHeader>

        {verzonden ? (
          <div className="py-4 text-sm text-muted-foreground" data-testid="contact-bevestiging">
            Bedankt, je bericht is verzonden. We bezorgen het aan {coach.naam}.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={"ct-naam-" + coach.id}>Je naam</Label>
              <Input id={"ct-naam-" + coach.id} value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Voor- en achternaam" data-testid="input-contact-naam" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={"ct-email-" + coach.id}>Je e-mailadres</Label>
              <Input id={"ct-email-" + coach.id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jij@voorbeeld.be" data-testid="input-contact-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={"ct-bericht-" + coach.id}>Je bericht</Label>
              <Textarea id={"ct-bericht-" + coach.id} value={bericht} onChange={(e) => setBericht(e.target.value)} rows={4} placeholder="Waarmee kan de coach je helpen?" data-testid="input-contact-bericht" />
            </div>
          </div>
        )}

        <DialogFooter>
          {verzonden ? (
            <Button onClick={() => handleOpenChange(false)} data-testid="btn-contact-sluiten">Sluiten</Button>
          ) : (
            <Button onClick={() => mut.mutate()} disabled={!kanVersturen} data-testid="btn-contact-versturen">
              {mut.isPending ? "Versturen…" : "Verstuur bericht"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoachKaart({ coach }: { coach: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Card data-testid={"kaart-coach-" + coach.id}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex gap-4">
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
                  <Badge key={inst.id} className="bg-primary/10 text-primary" data-testid={"instrument-" + coach.id + "-" + inst.id}>{inst.naam}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-1">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} data-testid={"btn-contact-open-" + coach.id}>
            <Mail className="h-4 w-4" />
            Contact opnemen
          </Button>
        </div>
      </CardContent>
      <CoachContactDialog coach={coach} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

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
              <CoachKaart key={coach.id} coach={coach} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
