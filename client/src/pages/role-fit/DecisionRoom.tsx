// ---------------------------------------------------------------------------
// DecisionRoom: de aangeduide ondertekenaar legt een menselijk besluit vast
// met rationale, voorwaarden, vervolgstappen, een 100- en 180-dagenplan en
// feedback voor de kandidaat. Het systeem stelt geen besluit voor; het toont
// alleen welke aanbevelingen de gates toelaten.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Archive, PenLine, Plus, Trash2, Undo2 } from "lucide-react";
import { AANBEVELINGEN, AANBEVELING_LABEL, GATE_STATUS_LABEL, type Aanbeveling } from "@shared/role-fit";
import { type CaseWeergave, RF_API, bereikt, foutDetails, foutTekst, herlaadCase, rfPost } from "./api";
import Rapporten from "./Rapporten";

type Stap = { stap: string; eigenaar: string; termijn: string };

export default function DecisionRoom({ v }: { v: CaseWeergave }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const rollen = new Set(v.rollen);
  const signer = rollen.has("signer");
  const eigenaar = rollen.has("owner") || rollen.has("prior");
  const klaar = v.zaak.status === "DECISION_READY";
  const [aanbeveling, setAanbeveling] = useState<Aanbeveling | "">("");
  const [rationale, setRationale] = useState("");
  const [voorwaarden, setVoorwaarden] = useState("");
  const [stappen, setStappen] = useState<Stap[]>([]);
  const [plan100, setPlan100] = useState("");
  const [plan180, setPlan180] = useState("");
  const [feedback, setFeedback] = useState("");
  const [meldingen, setMeldingen] = useState<string[]>([]);

  const { data: toets } = useQuery<{ toegestaan: Aanbeveling[] }>({
    queryKey: [`${RF_API}/cases/${id}/besluit/toegestaan`],
    enabled: klaar && signer,
  });
  const toegestaan = new Set(toets?.toegestaan ?? AANBEVELINGEN);

  const teken = useMutation({
    mutationFn: () =>
      rfPost(`/cases/${id}/besluit`, {
        aanbeveling,
        rationale,
        voorwaarden: voorwaarden.split("\n").map((s) => s.trim()).filter(Boolean),
        vervolgstappen: stappen.filter((s) => s.stap.trim()),
        plan100,
        plan180,
        kandidaatFeedback: feedback,
      }),
    onSuccess: () => { setMeldingen([]); toast({ title: "Besluit getekend" }); herlaadCase(id); },
    onError: (e) => {
      const d = foutDetails(e);
      const lijst: string[] = d?.fouten ?? (d?.taal ?? []).map((t: any) => `${t.veld}: "${t.fragment}", ${t.uitleg}`);
      setMeldingen(lijst);
      toast({ title: "Niet getekend", description: foutTekst(e), variant: "destructive" });
    },
  });
  const terug = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/integratie/terug`),
    onSuccess: () => herlaadCase(id),
    onError: (e) => toast({ title: "Niet teruggezet", description: foutTekst(e), variant: "destructive" }),
  });
  const archiveer = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/archiveer`),
    onSuccess: () => { toast({ title: "Case gearchiveerd" }); herlaadCase(id); },
    onError: (e) => toast({ title: "Niet gearchiveerd", description: foutTekst(e), variant: "destructive" }),
  });

  if (!bereikt(v.zaak.status, "DECISION_READY")) {
    return <p className="text-sm text-muted-foreground">De beslisruimte opent wanneer de integratie klaar is voor besluit.</p>;
  }

  const b = v.besluit;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Knock-outgates</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          {v.gates.length === 0 && <span className="text-muted-foreground">Geen gates vastgelegd.</span>}
          {v.gates.map((g) => (
            <div key={g.vereisteId}>{g.vereiste}: <Badge variant="outline">{GATE_STATUS_LABEL[g.status as keyof typeof GATE_STATUS_LABEL]}</Badge></div>
          ))}
        </CardContent>
      </Card>

      {b ? (
        <Card data-testid="rf-besluit">
          <CardHeader className="pb-2"><CardTitle className="text-base">Getekend besluit: {AANBEVELING_LABEL[b.aanbeveling as Aanbeveling]}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>{b.rationale}</p>
            {(b.detail?.voorwaarden ?? []).length > 0 && <div><span className="font-medium">Voorwaarden: </span>{b.detail.voorwaarden.join("; ")}</div>}
            <div className="text-xs text-muted-foreground">Getekend door {b.detail?.ondertekenaarNaam} op {String(b.signedAt).slice(0, 16).replace("T", " ")}. Invoerhash {String(b.inputHash).slice(0, 12)}.</div>
          </CardContent>
        </Card>
      ) : klaar && signer ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Besluit tekenen</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {AANBEVELINGEN.map((a) => (
                <Button key={a} variant={aanbeveling === a ? "default" : "outline"} disabled={!toegestaan.has(a)} onClick={() => setAanbeveling(a)} data-testid={`rf-aanbeveling-${a}`}>
                  {AANBEVELING_LABEL[a]}
                </Button>
              ))}
            </div>
            {toets && toets.toegestaan.length < AANBEVELINGEN.length && (
              <p className="text-xs text-muted-foreground">Niet alle aanbevelingen zijn mogelijk: een of meer gates zijn niet voldaan of nog te verifieren.</p>
            )}
            <div>
              <Label>Rationale (minstens 40 tekens, in gedrag en bewijs)</Label>
              <Textarea rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} data-testid="rf-rationale" />
            </div>
            <div>
              <Label>Voorwaarden (een per regel; noem elke open gate bij voorwaardelijk positief)</Label>
              <Textarea rows={3} value={voorwaarden} onChange={(e) => setVoorwaarden(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Vervolgstappen</Label>
              {stappen.map((s, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_180px_140px_auto]">
                  <Input placeholder="Stap" value={s.stap} onChange={(e) => setStappen((o) => o.map((x, k) => (k === i ? { ...x, stap: e.target.value } : x)))} />
                  <Input placeholder="Eigenaar" value={s.eigenaar} onChange={(e) => setStappen((o) => o.map((x, k) => (k === i ? { ...x, eigenaar: e.target.value } : x)))} />
                  <Input placeholder="Termijn" value={s.termijn} onChange={(e) => setStappen((o) => o.map((x, k) => (k === i ? { ...x, termijn: e.target.value } : x)))} />
                  <Button variant="ghost" size="sm" onClick={() => setStappen((o) => o.filter((_, k) => k !== i))} aria-label="Stap verwijderen"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setStappen((o) => [...o, { stap: "", eigenaar: "", termijn: "" }])}>
                <Plus className="mr-1 h-4 w-4" /> Stap toevoegen
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Plan eerste 100 dagen</Label><Textarea rows={3} value={plan100} onChange={(e) => setPlan100(e.target.value)} /></div>
              <div><Label>Plan tot 180 dagen</Label><Textarea rows={3} value={plan180} onChange={(e) => setPlan180(e.target.value)} /></div>
            </div>
            <div><Label>Feedback voor de kandidaat</Label><Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
            {meldingen.length > 0 && (
              <ul className="list-disc rounded-md bg-rose-50 p-3 pl-7 text-rose-900" data-testid="rf-besluit-meldingen">
                {meldingen.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => terug.mutate()} disabled={terug.isPending}><Undo2 className="mr-1 h-4 w-4" /> Terug naar integratie</Button>
              <Button disabled={!aanbeveling || rationale.trim().length < 40 || teken.isPending} onClick={() => teken.mutate()} data-testid="rf-teken">
                <PenLine className="mr-1 h-4 w-4" /> Besluit tekenen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Enkel de aangeduide ondertekenaar tekent het besluit.</p>
      )}

      <Rapporten v={v} types={["fit-dossier", "hbom-guide", "decision-dossier", "kandidaat-feedback"]} />

      {eigenaar && v.zaak.status === "SIGNED" && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          {v.zaak.status === "SIGNED" && (
            <Button variant="outline" onClick={() => archiveer.mutate()} disabled={archiveer.isPending}><Archive className="mr-1 h-4 w-4" /> Archiveren</Button>
          )}
        </div>
      )}
    </div>
  );
}
