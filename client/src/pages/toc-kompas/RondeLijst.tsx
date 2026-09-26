// ---------------------------------------------------------------------------
// RondeLijst: de kwartaalrondes van het TOC Commitmentkompas en het formulier
// om een nieuwe ronde te starten. Route: /admin/toc-kompas (enkel de
// hoofdbeheerder). Bij het starten krijgt elk van de vier Captains een eigen
// invullink. Die links worden hier een keer getoond; de server bewaart enkel
// een hash. Een verloren link vernieuwt u in het detail van de ronde.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import { CAPTAIN_ROLLEN, CAPTAIN_ROL_INFO, CIRKEL_TEKST, RONDE_STATUS_LABEL, type CaptainRol, type RondeStatus } from "@shared/toc-kompas";
import { TK_API, foutTekst, invulLink, tkPost } from "./api";
import { queryClient } from "@/lib/queryClient";

type RondeRij = { id: number; titel: string; periode: string; deadline: string; status: RondeStatus; ingediend: number; captains: number; createdAt: string };
type NieuweLink = { captainId: number; rol: CaptainRol; naam: string; token: string };

function volgendKwartaal(): string {
  const d = new Date();
  let q = Math.floor(d.getMonth() / 3) + 2;
  let j = d.getFullYear();
  if (q > 4) { q = 1; j += 1; }
  return `${j}-Q${q}`;
}

export function KopieerLink({ token, testid }: { token: string; testid?: string }) {
  const { toast } = useToast();
  const url = invulLink(token);
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} className="h-8 font-mono text-xs" data-testid={testid} onFocus={(e) => e.currentTarget.select()} />
      <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(url).then(() => toast({ title: "Link gekopieerd" }))} aria-label="Kopieer link">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function TocKompasRondeLijst() {
  const { toast } = useToast();
  const { data: rondes = [], isLoading } = useQuery<RondeRij[]>({ queryKey: [`${TK_API}/rondes`] });
  const [nieuw, setNieuw] = useState(false);
  const [periode, setPeriode] = useState(volgendKwartaal());
  const [titel, setTitel] = useState("");
  const [deadline, setDeadline] = useState("");
  const [captains, setCaptains] = useState(() => CAPTAIN_ROLLEN.map((rol) => ({ rol, naam: CAPTAIN_ROL_INFO[rol].standaardNaam, email: "" })));
  const [links, setLinks] = useState<{ rondeId: number; links: NieuweLink[] } | null>(null);

  const maak = useMutation({
    mutationFn: () => tkPost(`/rondes`, { titel: titel || `TOC Commitmentkompas ${periode}`, periode, deadline, captains }),
    onSuccess: (r: any) => {
      setLinks({ rondeId: r.ronde.id, links: r.links });
      setNieuw(false);
      queryClient.invalidateQueries({ queryKey: [`${TK_API}/rondes`] });
      toast({ title: "Ronde gestart", description: "Deel nu elke link met de juiste Captain." });
    },
    onError: (e) => toast({ title: "Ronde niet gestart", description: foutTekst(e), variant: "destructive" }),
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Beheer</Link>
            <h1 className="text-2xl font-semibold mt-1">TOC Commitmentkompas</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">{CIRKEL_TEKST}</p>
          </div>
          <Button onClick={() => setNieuw((v) => !v)} data-testid="tk-nieuwe-ronde"><Plus className="mr-1 h-4 w-4" /> Nieuwe ronde</Button>
        </div>

        {links && (
          <Card className="border-primary/50" data-testid="tk-nieuwe-links">
            <CardHeader><CardTitle>Invullinks voor deze ronde</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">Deze links worden maar een keer getoond. Stuur elke Captain enkel de eigen link. Een verloren link vernieuwt u in het detail van de ronde; de oude link werkt dan niet meer.</p>
              {links.links.map((l) => (
                <div key={l.captainId} className="grid gap-1">
                  <div className="font-medium">{CAPTAIN_ROL_INFO[l.rol].titel} · {l.naam}</div>
                  <KopieerLink token={l.token} testid={`tk-link-${l.rol}`} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button asChild size="sm"><Link href={`/admin/toc-kompas/${links.rondeId}`}>Naar de ronde</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => setLinks(null)}>Sluiten</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {nieuw && (
          <Card>
            <CardHeader><CardTitle>Nieuwe kwartaalronde</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1"><Label htmlFor="tk-periode">Periode (JJJJ-Qn)</Label><Input id="tk-periode" value={periode} onChange={(e) => setPeriode(e.target.value.toUpperCase())} data-testid="tk-periode" /></div>
                <div className="grid gap-1"><Label htmlFor="tk-titel">Titel</Label><Input id="tk-titel" value={titel} placeholder={`TOC Commitmentkompas ${periode}`} onChange={(e) => setTitel(e.target.value)} data-testid="tk-titel" /></div>
                <div className="grid gap-1"><Label htmlFor="tk-deadline">Indienen tegen</Label><Input id="tk-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="tk-deadline" /></div>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">De vier Captains</div>
                {captains.map((c, i) => (
                  <div key={c.rol} className="grid gap-2 sm:grid-cols-[14rem_1fr_1fr] items-center">
                    <div className="text-sm">{CAPTAIN_ROL_INFO[c.rol].titel}</div>
                    <Input value={c.naam} aria-label={`Naam ${CAPTAIN_ROL_INFO[c.rol].titel}`} onChange={(e) => setCaptains((cs) => cs.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} data-testid={`tk-naam-${c.rol}`} />
                    <Input value={c.email} placeholder="E-mail (optioneel)" aria-label={`E-mail ${CAPTAIN_ROL_INFO[c.rol].titel}`} onChange={(e) => setCaptains((cs) => cs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  </div>
                ))}
              </div>
              <div><Button onClick={() => maak.mutate()} disabled={maak.isPending} data-testid="tk-ronde-starten">Ronde starten en links maken</Button></div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Laden...</div>
            ) : rondes.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Er is nog geen ronde. Start een nieuwe ronde om de nulmeting te beginnen.</div>
            ) : (
              <ul className="divide-y">
                {rondes.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/toc-kompas/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50" data-testid={`tk-ronde-${r.id}`}>
                      <div>
                        <div className="font-medium">{r.titel}</div>
                        <div className="text-xs text-muted-foreground">{r.periode}{r.deadline ? ` · indienen tegen ${r.deadline}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{r.ingediend} van {r.captains} ingediend</Badge>
                        <Badge>{RONDE_STATUS_LABEL[r.status]}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
