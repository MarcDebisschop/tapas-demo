// ---------------------------------------------------------------------------
// Convergence: pas na de vergrendeling van beide observaties. Per hypothese
// staan de bewijsregels van recruiter en hiring manager naast elkaar (niet
// enkel de cijfers), met de richting van het profielsignaal. De engine stelt
// een integratiestatus voor; een reviewer kan die met reden aanpassen en zet
// de status van elke knock-outgate.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BEWIJSKWALITEIT_LABEL,
  CONFIDENCE_LABEL,
  GATE_STATUS_LABEL,
  INTEGRATIE_STATUSSEN,
  INTEGRATIE_STATUS_LABEL,
  OBSERVATOR_ROLLEN,
  OBSERVATOR_ROL_LABEL,
} from "@shared/role-fit";
import { type CaseWeergave, bereikt, foutTekst, herlaadCase, rfPost, rfPut } from "./api";

const RICHTING: Record<string, string> = {
  ondersteunend: "Profiel ondersteunt",
  gemengd: "Profiel gemengd",
  spanning: "Profiel wijst op spanning",
  onbekend: "Geen profielsignaal",
};

function Bewijsregel({ o }: { o: any }) {
  if (!o) return <p className="text-xs text-muted-foreground">Geen observatie.</p>;
  if (o.onvoldoendeKans) return <p className="text-sm">Onvoldoende observatiekans{o.alternatieveVerklaring ? `: ${o.alternatieveVerklaring}` : "."}</p>;
  return (
    <dl className="grid gap-1 text-sm">
      <div><dt className="inline font-medium">Context: </dt><dd className="inline">{o.contextTrigger}</dd></div>
      <div><dt className="inline font-medium">Gedrag: </dt><dd className="inline">{o.gedrag}</dd></div>
      <div><dt className="inline font-medium">Citaat of actie: </dt><dd className="inline">{o.quoteActie}</dd></div>
      <div><dt className="inline font-medium">Effect: </dt><dd className="inline">{o.effect}</dd></div>
      <div><dt className="inline font-medium">Andere verklaring: </dt><dd className="inline">{o.alternatieveVerklaring}</dd></div>
      <div className="flex flex-wrap gap-1 pt-1 text-xs">
        <Badge>Anker {o.barsScore}</Badge>
        {o.bewijskwaliteit && <Badge variant="outline">{BEWIJSKWALITEIT_LABEL[o.bewijskwaliteit as keyof typeof BEWIJSKWALITEIT_LABEL]}</Badge>}
        {o.confidence && <Badge variant="outline">Zekerheid: {CONFIDENCE_LABEL[o.confidence as keyof typeof CONFIDENCE_LABEL]}</Badge>}
        {o.versie > 1 && <Badge variant="outline">Gecorrigeerd (versie {o.versie})</Badge>}
      </div>
    </dl>
  );
}

export default function Convergence({ v }: { v: CaseWeergave }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const rollen = new Set(v.rollen);
  const reviewer = ["owner", "prior", "reviewer"].some((r) => rollen.has(r));
  const inReview = v.zaak.status === "INTEGRATION_REVIEW";
  const [overrides, setOverrides] = useState<Record<number, { status: string; reden: string }>>({});
  const [gates, setGates] = useState<Record<number, { status: string; toelichting: string }>>({});
  const fout = (t: string) => (e: unknown) => toast({ title: t, description: foutTekst(e), variant: "destructive" });

  useEffect(() => {
    const o: Record<number, { status: string; reden: string }> = {};
    for (const i of v.integraties) o[i.hypothesisId] = { status: i.integratieStatus, reden: i.overrideReden ?? "" };
    setOverrides(o);
    const g: Record<number, { status: string; toelichting: string }> = {};
    for (const x of v.vereisten.filter((r) => r.kriticiteit === "gate")) g[x.id] = { status: x.gateStatus ?? "open", toelichting: x.gateToelichting ?? "" };
    setGates(g);
  }, [v.integraties, v.vereisten]);

  const bereken = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/integratie/bereken`),
    onSuccess: () => herlaadCase(id),
    onError: fout("Integratie niet berekend"),
  });
  const bewaar = useMutation({
    mutationFn: () =>
      rfPut(`/cases/${id}/integratie`, {
        overrides: v.integraties
          .filter((i) => overrides[i.hypothesisId] && overrides[i.hypothesisId].status !== i.integratieStatus)
          .map((i) => ({ hypotheseId: i.hypothesisId, status: overrides[i.hypothesisId].status, reden: overrides[i.hypothesisId].reden })),
        gates: Object.entries(gates)
          .filter(([, g]) => g.status !== "open")
          .map(([vid, g]) => ({ vereisteId: Number(vid), status: g.status, toelichting: g.toelichting })),
      }),
    onSuccess: () => { toast({ title: "Review bewaard" }); herlaadCase(id); },
    onError: fout("Review niet bewaard"),
  });
  const klaar = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/integratie/klaar`),
    onSuccess: () => { toast({ title: "Klaar voor besluit" }); herlaadCase(id); },
    onError: fout("Niet klaar"),
  });

  if (!bereikt(v.zaak.status, "OBSERVATIONS_LOCKED")) {
    const ingediend = v.opdrachten.filter((o) => o.ingediendOp).length;
    return (
      <p className="text-sm text-muted-foreground" data-testid="rf-embargo">
        De observaties worden pas zichtbaar wanneer beide observatoren ingediend hebben ({ingediend} van {v.opdrachten.length || 2}).
      </p>
    );
  }

  const rolVan = new Map(v.opdrachten.map((o) => [o.id, o.rol]));
  const laatste = (exId: number, rol: string) =>
    v.observaties
      .filter((o) => o.exerciseId === exId && rolVan.get(o.assignmentId) === rol)
      .sort((a, b) => b.versie - a.versie)[0];
  const integratieVan = new Map(v.integraties.map((i) => [i.hypothesisId, i]));
  const gateLijst = v.vereisten.filter((r) => r.kriticiteit === "gate");

  return (
    <div className="grid gap-4">
      {v.zaak.status === "OBSERVATIONS_LOCKED" && reviewer && (
        <Card><CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
          <span>Beide observaties zijn vergrendeld. Observatoren kunnen nog een correctie met reden indienen tot de integratie berekend is.</span>
          <Button onClick={() => bereken.mutate()} disabled={bereken.isPending} data-testid="rf-bereken">Integratie berekenen</Button>
        </CardContent></Card>
      )}
      {v.oefeningen.map((e) => {
        const i = integratieVan.get(e.hypothesisId);
        const hyp = v.hypothesen.find((h) => h.id === e.hypothesisId);
        return (
          <Card key={e.id} data-testid={`rf-conv-${e.id}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{e.volgorde}. {e.titel}</CardTitle>
              {hyp && <p className="text-sm text-muted-foreground">{hyp.stelling}</p>}
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                {OBSERVATOR_ROLLEN.map((r) => (
                  <div key={r} className="rounded-md border p-3">
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{OBSERVATOR_ROL_LABEL[r]}</div>
                    <Bewijsregel o={laatste(e.id, r)} />
                  </div>
                ))}
              </div>
              {i && (
                <div className="grid gap-2 rounded-md bg-secondary/50 p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{INTEGRATIE_STATUS_LABEL[i.integratieStatus as keyof typeof INTEGRATIE_STATUS_LABEL]}</Badge>
                    {i.integratieStatus !== i.berekendeStatus && (
                      <Badge variant="outline">Berekend: {INTEGRATIE_STATUS_LABEL[i.berekendeStatus as keyof typeof INTEGRATIE_STATUS_LABEL]}</Badge>
                    )}
                    <Badge variant="outline">Zekerheid: {CONFIDENCE_LABEL[i.detail?.confidence as keyof typeof CONFIDENCE_LABEL] ?? i.detail?.confidence}</Badge>
                    <Badge variant="outline">{RICHTING[i.detail?.profielRichting] ?? i.detail?.profielRichting}</Badge>
                  </div>
                  {(i.detail?.redenen ?? []).length > 0 && <ul className="list-disc pl-5">{i.detail.redenen.map((x: string, k: number) => <li key={k}>{x}</li>)}</ul>}
                  {inReview && reviewer && (
                    <div className="grid gap-2 md:grid-cols-[260px_1fr]">
                      <Select
                        value={overrides[e.hypothesisId]?.status ?? i.integratieStatus}
                        onValueChange={(s) => setOverrides((o) => ({ ...o, [e.hypothesisId]: { status: s, reden: o[e.hypothesisId]?.reden ?? "" } }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{INTEGRATIE_STATUSSEN.map((s) => <SelectItem key={s} value={s}>{INTEGRATIE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                      </Select>
                      {overrides[e.hypothesisId] && overrides[e.hypothesisId].status !== i.integratieStatus && (
                        <Textarea
                          rows={2}
                          placeholder="Reden voor de aanpassing (minstens 20 tekens)"
                          value={overrides[e.hypothesisId].reden}
                          onChange={(x) => setOverrides((o) => ({ ...o, [e.hypothesisId]: { ...o[e.hypothesisId], reden: x.target.value } }))}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {gateLijst.length > 0 && bereikt(v.zaak.status, "INTEGRATION_REVIEW") && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Knock-outgates</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {gateLijst.map((g) => (
              <div key={g.id} className="grid gap-2 rounded-md border p-3">
                <div className="font-medium">{g.vereiste}</div>
                {inReview && reviewer ? (
                  <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                    <Select value={gates[g.id]?.status ?? "open"} onValueChange={(s) => setGates((o) => ({ ...o, [g.id]: { status: s, toelichting: o[g.id]?.toelichting ?? "" } }))}>
                      <SelectTrigger data-testid={`rf-gate-${g.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["open", "met", "not_met", "to_verify"] as const).map((s) => <SelectItem key={s} value={s} disabled={s === "open"}>{GATE_STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Textarea rows={2} placeholder="Welk bewijs? (minstens 5 tekens)" value={gates[g.id]?.toelichting ?? ""} onChange={(x) => setGates((o) => ({ ...o, [g.id]: { ...o[g.id], toelichting: x.target.value } }))} />
                  </div>
                ) : (
                  <div>{GATE_STATUS_LABEL[(g.gateStatus ?? "open") as keyof typeof GATE_STATUS_LABEL]}{g.gateToelichting ? `: ${g.gateToelichting}` : ""}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inReview && reviewer && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => bewaar.mutate()} disabled={bewaar.isPending} data-testid="rf-review-bewaar">Review bewaren</Button>
          <Button onClick={() => klaar.mutate()} disabled={klaar.isPending} data-testid="rf-review-klaar">Klaar voor besluit</Button>
        </div>
      )}
      {inReview && reviewer && <Label className="text-xs text-muted-foreground">Bewaar de review voor u op "Klaar voor besluit" klikt.</Label>}
    </div>
  );
}
