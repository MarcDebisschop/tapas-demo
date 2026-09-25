// ---------------------------------------------------------------------------
// ContextReview: claimvoorstellen goedkeuren, aanpassen of afwijzen (met de
// letterlijke bronpassage ernaast), vereisten en knock-outgates vastleggen,
// de context laten bevestigen door recruiter en hiring manager, en bevriezen.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Lock, Trash2 } from "lucide-react";
import {
  CLAIM_CATEGORIEEN,
  CLAIM_CATEGORIE_LABEL,
  CONFIDENCE_LABEL,
  DIMENSIES,
  KRITICITEITEN,
  KRITICITEIT_LABEL,
  VEREISTE_NIVEAUS,
  VEREISTE_NIVEAU_LABEL,
} from "@shared/role-fit";
import { type CaseWeergave, foutTekst, herlaadCase, rfDelete, rfPatch, rfPost } from "./api";

export default function ContextReview({ v }: { v: CaseWeergave }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const rollen = new Set(v.rollen);
  const magBewerken = ["owner", "prior", "recruiter", "hiring_manager"].some((r) => rollen.has(r));
  const inReview = v.zaak.status === "CONTEXT_REVIEW";
  const bewerkbaar = magBewerken && (v.zaak.status === "DRAFT" || inReview);
  const [bewerkt, setBewerkt] = useState<Record<number, string>>({});
  const [nieuweClaim, setNieuweClaim] = useState({ categorie: "requirements", claim: "" });
  const [vr, setVr] = useState({ dimensie: DIMENSIES[0].id, vereiste: "", niveau: "entry", kriticiteit: "important", bronClaimIds: [] as number[] });
  const [overrideReden, setOverrideReden] = useState("");
  const fout = (t: string) => (e: unknown) => toast({ title: t, description: foutTekst(e), variant: "destructive" });

  const beoordeel = useMutation({
    mutationFn: (x: { claim: any; status: "approved" | "rejected" }) => {
      const tekst = bewerkt[x.claim.id];
      return rfPatch(`/cases/${id}/claims/${x.claim.id}`, {
        status: x.status,
        versie: x.claim.versie,
        ...(tekst && tekst !== x.claim.claim ? { claim: tekst } : {}),
      });
    },
    onSuccess: () => herlaadCase(id),
    onError: fout("Beoordeling niet bewaard"),
  });
  const claimToe = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/claims`, nieuweClaim),
    onSuccess: () => { setNieuweClaim({ ...nieuweClaim, claim: "" }); herlaadCase(id); },
    onError: fout("Claim niet toegevoegd"),
  });
  const vereisteToe = useMutation({
    mutationFn: () => {
      const gate = vr.kriticiteit === "gate";
      return rfPost(`/cases/${id}/vereisten`, { ...vr, dimensie: gate ? "gate" : vr.dimensie, niveau: gate ? "knockout" : vr.niveau });
    },
    onSuccess: () => { setVr({ ...vr, vereiste: "", bronClaimIds: [] }); herlaadCase(id); },
    onError: fout("Vereiste niet toegevoegd"),
  });
  const vereisteWeg = useMutation({
    mutationFn: (vid: number) => rfDelete(`/cases/${id}/vereisten/${vid}`),
    onSuccess: () => herlaadCase(id),
    onError: fout("Vereiste niet verwijderd"),
  });
  const bevestig = useMutation({
    mutationFn: (rol: "recruiter" | "hiring_manager") => rfPost(`/cases/${id}/bevestig`, { rol }),
    onSuccess: () => herlaadCase(id),
    onError: fout("Bevestiging niet bewaard"),
  });
  const bevries = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/freeze`, overrideReden.trim() ? { overrideReden: overrideReden.trim() } : {}),
    onSuccess: () => { toast({ title: "Context bevroren", description: "Het Fit Dossier is berekend." }); herlaadCase(id); },
    onError: fout("Niet bevroren"),
  });

  const voorstellen = v.claims.filter((k) => k.status === "proposed");
  const goedgekeurd = v.claims.filter((k) => k.status === "approved");
  const afgewezen = v.claims.filter((k) => k.status === "rejected");
  const beideBevestigd = !!v.zaak.recruiterBevestigdOp && !!v.zaak.hmBevestigdOp;

  return (
    <div className="grid gap-4">
      {v.zaak.status === "DRAFT" && (
        <p className="text-sm text-muted-foreground">Maak eerst voorstellen vanuit de wizard en de bronnen, of voeg zelf claims toe.</p>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Voorstellen ({voorstellen.length})</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {voorstellen.length === 0 && <p className="text-sm text-muted-foreground">Geen open voorstellen.</p>}
          {voorstellen.map((k) => (
            <div key={k.id} className="grid gap-2 rounded-md border p-3" data-testid={`rf-claim-${k.id}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{CLAIM_CATEGORIE_LABEL[k.categorie as keyof typeof CLAIM_CATEGORIE_LABEL] ?? k.categorie}</Badge>
                <Badge variant="outline">Zekerheid: {CONFIDENCE_LABEL[k.confidence as keyof typeof CONFIDENCE_LABEL] ?? k.confidence}</Badge>
                <Badge variant="outline">Herkomst: {k.herkomst}</Badge>
              </div>
              <Textarea
                disabled={!bewerkbaar}
                value={bewerkt[k.id] ?? k.claim}
                onChange={(e) => setBewerkt((o) => ({ ...o, [k.id]: e.target.value }))}
              />
              <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground">Bronpassage: "{k.bronpassage}"</blockquote>
              {bewerkbaar && inReview && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => beoordeel.mutate({ claim: k, status: "rejected" })} data-testid={`rf-claim-afwijzen-${k.id}`}>
                    <X className="mr-1 h-4 w-4" /> Afwijzen
                  </Button>
                  <Button size="sm" onClick={() => beoordeel.mutate({ claim: k, status: "approved" })} data-testid={`rf-claim-goedkeuren-${k.id}`}>
                    <Check className="mr-1 h-4 w-4" /> Goedkeuren
                  </Button>
                </div>
              )}
            </div>
          ))}
          {bewerkbaar && (
            <div className="grid gap-2 border-t pt-3 md:grid-cols-[220px_1fr_auto]">
              <Select value={nieuweClaim.categorie} onValueChange={(c) => setNieuweClaim({ ...nieuweClaim, categorie: c })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLAIM_CATEGORIEEN.map((c) => <SelectItem key={c} value={c}>{CLAIM_CATEGORIE_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea rows={2} placeholder="Eigen claim over de rol of de organisatie" value={nieuweClaim.claim} onChange={(e) => setNieuweClaim({ ...nieuweClaim, claim: e.target.value })} />
              <Button disabled={nieuweClaim.claim.trim().length < 3} onClick={() => claimToe.mutate()}>Toevoegen</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Goedgekeurde claims ({goedgekeurd.length})</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          {goedgekeurd.map((k) => (
            <div key={k.id}><span className="text-muted-foreground">#{k.id} {CLAIM_CATEGORIE_LABEL[k.categorie as keyof typeof CLAIM_CATEGORIE_LABEL]}:</span> {k.claim}</div>
          ))}
          {afgewezen.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{afgewezen.length} voorstel(len) afgewezen; die tellen nergens mee.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Vereisten en knock-outgates</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {v.vereisten.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm">
              <div>
                <div className="font-medium">{r.vereiste}</div>
                <div className="text-xs text-muted-foreground">
                  {r.kriticiteit === "gate" ? "Knock-outgate" : DIMENSIES.find((d) => d.id === r.dimensie)?.label ?? r.dimensie}
                  {", "}{VEREISTE_NIVEAU_LABEL[r.niveau as keyof typeof VEREISTE_NIVEAU_LABEL]}{", "}{KRITICITEIT_LABEL[r.kriticiteit as keyof typeof KRITICITEIT_LABEL]}
                  {r.bronClaimIds.length ? `, claims ${r.bronClaimIds.map((c: number) => `#${c}`).join(" ")}` : ""}
                </div>
              </div>
              {bewerkbaar && (
                <Button size="sm" variant="ghost" onClick={() => vereisteWeg.mutate(r.id)} aria-label="Vereiste verwijderen"><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
          {bewerkbaar && (
            <div className="grid gap-2 border-t pt-3 md:grid-cols-3">
              <div>
                <Label>Kriticiteit</Label>
                <Select value={vr.kriticiteit} onValueChange={(k) => setVr({ ...vr, kriticiteit: k })}>
                  <SelectTrigger data-testid="rf-vr-kriticiteit"><SelectValue /></SelectTrigger>
                  <SelectContent>{KRITICITEITEN.map((k) => <SelectItem key={k} value={k}>{KRITICITEIT_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {vr.kriticiteit !== "gate" && (
                <>
                  <div>
                    <Label>Dimensie</Label>
                    <Select value={vr.dimensie} onValueChange={(d) => setVr({ ...vr, dimensie: d })}>
                      <SelectTrigger data-testid="rf-vr-dimensie"><SelectValue /></SelectTrigger>
                      <SelectContent>{DIMENSIES.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Niveau</Label>
                    <Select value={vr.niveau} onValueChange={(n) => setVr({ ...vr, niveau: n })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VEREISTE_NIVEAUS.filter((n) => n !== "knockout").map((n) => <SelectItem key={n} value={n}>{VEREISTE_NIVEAU_LABEL[n]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="md:col-span-3">
                <Label>Vereiste (concreet, observeerbaar)</Label>
                <Textarea rows={2} value={vr.vereiste} onChange={(e) => setVr({ ...vr, vereiste: e.target.value })} data-testid="rf-vr-tekst" />
              </div>
              {goedgekeurd.length > 0 && (
                <div className="flex flex-wrap gap-1 md:col-span-3">
                  <span className="text-xs text-muted-foreground">Onderbouwd door claim:</span>
                  {goedgekeurd.map((k) => {
                    const aan = vr.bronClaimIds.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        className={`rounded border px-1.5 text-xs ${aan ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setVr({ ...vr, bronClaimIds: aan ? vr.bronClaimIds.filter((x) => x !== k.id) : [...vr.bronClaimIds, k.id] })}
                        title={k.claim}
                      >
                        #{k.id}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end md:col-span-3">
                <Button disabled={vr.vereiste.trim().length < 3 || vereisteToe.isPending} onClick={() => vereisteToe.mutate()} data-testid="rf-vr-toevoegen">Vereiste toevoegen</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {inReview && magBewerken && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bevestigen en bevriezen</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button variant={v.zaak.recruiterBevestigdOp ? "secondary" : "outline"} disabled={!!v.zaak.recruiterBevestigdOp} onClick={() => bevestig.mutate("recruiter")} data-testid="rf-bevestig-recruiter">
                {v.zaak.recruiterBevestigdOp ? "Recruiter heeft bevestigd" : "Bevestigen als recruiter"}
              </Button>
              <Button variant={v.zaak.hmBevestigdOp ? "secondary" : "outline"} disabled={!!v.zaak.hmBevestigdOp} onClick={() => bevestig.mutate("hiring_manager")} data-testid="rf-bevestig-hm">
                {v.zaak.hmBevestigdOp ? "Hiring manager heeft bevestigd" : "Bevestigen als hiring manager"}
              </Button>
            </div>
            {!beideBevestigd && (
              <div>
                <Label>Reden om te bevriezen zonder beide bevestigingen (enkel eigenaar of prior, minstens 20 tekens)</Label>
                <Textarea rows={2} value={overrideReden} onChange={(e) => setOverrideReden(e.target.value)} />
              </div>
            )}
            {v.vereisten.filter((r) => r.kriticiteit !== "gate").length < 3 && (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900" data-testid="rf-vr-te-weinig">
                Voor de H-BOM Evidence Check zijn minstens drie vereisten nodig die geen gate zijn. Met minder kunt u bevriezen, maar er volgt geen observatie.
              </p>
            )}
            <p className="text-muted-foreground">
              Na het bevriezen liggen claims en vereisten vast. Het Fit Dossier wordt dan berekend met enkel goedgekeurde context.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => bevries.mutate()} disabled={bevries.isPending || voorstellen.length > 0} data-testid="rf-bevries">
                <Lock className="mr-1 h-4 w-4" /> Context bevriezen
              </Button>
            </div>
            {voorstellen.length > 0 && <p className="text-xs text-muted-foreground">Beoordeel eerst alle open voorstellen.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
