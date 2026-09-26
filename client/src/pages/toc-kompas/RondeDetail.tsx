// ---------------------------------------------------------------------------
// RondeDetail: een kwartaalronde van het TOC Commitmentkompas.
// Route: /admin/toc-kompas/:id (enkel de hoofdbeheerder).
//
// De ronde doorloopt vier fasen: nulmeting (INTAKE), consolidatie en workshop
// (CONSOLIDATIE), register vastgesteld (VASTGESTELD) en kwartaal afgesloten
// (AFGESLOTEN). Tijdens de nulmeting ziet ook de hoofdbeheerder geen
// inhoudelijke antwoorden: enkel wie gestart of ingediend heeft. Zo blijft de
// individuele invulling onafhankelijk. Het platform signaleert en telt; het
// TOC beslist in de workshop.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, FileText, Lock, Pencil, Plus, RefreshCw, Trash2, Unlock } from "lucide-react";
import {
  CAPTAIN_ROL_INFO,
  COMMITMENT_STATUSSEN,
  COMMITMENT_STATUS_LABEL,
  COMMITMENT_TYPE_LABEL,
  DEKKINGSSCORES,
  DOMEINEN,
  GEEN_GEMIDDELDE,
  KAART_VELDEN,
  RAPPORT_TYPES,
  RAPPORT_TYPE_LABEL,
  RONDE_STATUS_LABEL,
  SIGNAAL_INFO,
  type CaptainRol,
  type CommitmentStatus,
  type CommitmentType,
  type CoverageRij,
  type RapportType,
  type RondeStatus,
} from "@shared/toc-kompas";
import { CAPTAIN_STATUS_LABEL, artefactUrl, foutLijst, foutTekst, herlaadRonde, minstens, rondeSleutel, tkDelete, tkPost, tkPut } from "./api";
import { KopieerLink } from "./RondeLijst";
import { apiRequest } from "@/lib/queryClient";

type Captain = { id: number; rol: CaptainRol; titel: string; naam: string; email: string; status: string; conceptOp: string | null; ingediendOp: string | null; linkVernieuwdOp: string | null; heeftIndiening: boolean };
type Weergave = {
  ronde: { id: number; titel: string; periode: string; deadline: string; status: RondeStatus; vergrendeldOp: string | null; vastgesteldOp: string | null; afgeslotenOp: string | null; coverageVersie: number };
  captains: Captain[];
  consolidatie: any | null;
  commitments: any[];
  coverage: CoverageRij[];
  besluiten: any[];
  acceptatie: { criteria: Array<{ sleutel: string; tekst: string; automatisch: boolean; voldaan: boolean; toelichting: string }>; versie: number; alleVoldaan: boolean } | null;
  vaststelFouten: string[];
  artefacten: Array<{ id: number; type: RapportType; captainId: number | null; versie: number; heeftPdf: boolean; createdAt: string }>;
};

const STATUS_KLEUR: Record<CommitmentStatus, string> = { groen: "#437A22", amber: "#D19900", rood: "#B42318", geblokkeerd: "#7A7974" };
const domeinNaam = (s: string) => DOMEINEN.find((d) => d.sleutel === s)?.naam ?? s;
const tijd = (s: string | null) => (s ? new Date(s).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" }) : "");

export default function TocKompasRondeDetail() {
  const [, params] = useRoute("/admin/toc-kompas/:id");
  const id = Number(params?.id);
  const { data: w, isLoading, error } = useQuery<Weergave>({ queryKey: rondeSleutel(id), enabled: Number.isFinite(id) });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Laden...</div>;
  if (error || !w) return <div className="p-8 text-sm">{error ? foutTekst(error) : "Ronde niet gevonden."}</div>;
  const s = w.ronde.status;
  const na = minstens(s, "CONSOLIDATIE");

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 grid gap-6">
        <div>
          <Link href="/admin/toc-kompas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Alle rondes</Link>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-semibold" data-testid="tk-ronde-titel">{w.ronde.titel}</h1>
            <Badge data-testid="tk-ronde-status">{RONDE_STATUS_LABEL[s]}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">{w.ronde.periode}{w.ronde.deadline ? ` · indienen tegen ${w.ronde.deadline}` : ""}</div>
        </div>

        <Tabs defaultValue="captains">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="captains">Captains</TabsTrigger>
            <TabsTrigger value="consolidatie" disabled={!na}>Consolidatie</TabsTrigger>
            <TabsTrigger value="register" disabled={!na}>Register</TabsTrigger>
            <TabsTrigger value="coverage" disabled={!na}>Coverage Matrix</TabsTrigger>
            <TabsTrigger value="besluiten" disabled={!na}>Decision Log</TabsTrigger>
            <TabsTrigger value="acceptatie" disabled={!na}>Acceptatie</TabsTrigger>
            <TabsTrigger value="rapporten">Rapporten</TabsTrigger>
          </TabsList>
          <TabsContent value="captains"><CaptainsTab w={w} /></TabsContent>
          {na && <TabsContent value="consolidatie"><ConsolidatieTab w={w} /></TabsContent>}
          {na && <TabsContent value="register"><RegisterTab w={w} /></TabsContent>}
          {na && <TabsContent value="coverage"><CoverageTab w={w} /></TabsContent>}
          {na && <TabsContent value="besluiten"><BesluitenTab w={w} /></TabsContent>}
          {na && <TabsContent value="acceptatie"><AcceptatieTab w={w} /></TabsContent>}
          <TabsContent value="rapporten"><RapportenTab w={w} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---- Captains ---------------------------------------------------------------
function CaptainsTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const [nieuweLink, setNieuweLink] = useState<{ captainId: number; token: string } | null>(null);
  const [reden, setReden] = useState("");
  const [inzage, setInzage] = useState<{ naam: string; data: any } | null>(null);

  const link = useMutation({
    mutationFn: (cid: number) => tkPost(`/rondes/${id}/captains/${cid}/link`),
    onSuccess: (r: any, cid) => { setNieuweLink({ captainId: cid, token: r.token }); herlaadRonde(id); toast({ title: "Nieuwe link gemaakt", description: "De vorige link werkt niet meer." }); },
    onError: (e) => toast({ title: "Link niet vernieuwd", description: foutTekst(e), variant: "destructive" }),
  });
  const heropen = useMutation({
    mutationFn: (cid: number) => tkPost(`/rondes/${id}/captains/${cid}/heropen`),
    onSuccess: () => { herlaadRonde(id); toast({ title: "Vragenlijst heropend" }); },
    onError: (e) => toast({ title: "Niet heropend", description: foutTekst(e), variant: "destructive" }),
  });
  const vergrendel = useMutation({
    mutationFn: () => tkPost(`/rondes/${id}/vergrendel`, { reden }),
    onSuccess: () => { herlaadRonde(id); toast({ title: "Nulmeting afgesloten", description: "De consolidatie is beschikbaar." }); },
    onError: (e) => toast({ title: "Niet afgesloten", description: foutTekst(e), variant: "destructive" }),
  });
  const bekijk = useMutation({
    mutationFn: async (c: Captain) => ({ naam: c.naam, data: await (await apiRequest("GET", `/api/toc-kompas/rondes/${id}/captains/${c.id}/antwoorden`)).json() }),
    onSuccess: (r) => setInzage(r),
    onError: (e) => toast({ title: "Antwoorden niet geladen", description: foutTekst(e), variant: "destructive" }),
  });

  const intake = w.ronde.status === "INTAKE";
  const alle = w.captains.every((c) => c.status === "ingediend");

  return (
    <div className="grid gap-4 mt-4">
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {w.captains.map((c) => (
              <li key={c.id} className="p-4 grid gap-2" data-testid={`tk-captain-${c.rol}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.titel}</div>
                    <div className="text-xs text-muted-foreground">{c.naam}{c.email ? ` · ${c.email}` : ""}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={c.status === "ingediend" ? "default" : "secondary"}>{CAPTAIN_STATUS_LABEL[c.status] ?? c.status}</Badge>
                    {c.ingediendOp && <span className="text-xs text-muted-foreground">{tijd(c.ingediendOp)}</span>}
                    {w.ronde.status !== "AFGESLOTEN" && (
                      <Button size="sm" variant="outline" onClick={() => link.mutate(c.id)} disabled={link.isPending} data-testid={`tk-link-vernieuwen-${c.rol}`}><RefreshCw className="mr-1 h-4 w-4" /> Nieuwe link</Button>
                    )}
                    {intake && c.status === "ingediend" && (
                      <Button size="sm" variant="outline" onClick={() => heropen.mutate(c.id)} data-testid={`tk-heropen-${c.rol}`}><Unlock className="mr-1 h-4 w-4" /> Heropenen</Button>
                    )}
                    {!intake && c.heeftIndiening && (
                      <Button size="sm" variant="ghost" onClick={() => bekijk.mutate(c)}>Antwoorden bekijken</Button>
                    )}
                  </div>
                </div>
                {nieuweLink?.captainId === c.id && <KopieerLink token={nieuweLink.token} testid={`tk-nieuwe-link-${c.rol}`} />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {intake && (
        <Card>
          <CardHeader><CardTitle>Nulmeting afsluiten</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Tijdens de nulmeting blijven de antwoorden afgeschermd, ook voor de hoofdbeheerder. Na het afsluiten worden de ingediende vragenlijsten geconsolideerd voor de workshop en kan niemand nog indienen.
              {!alle && " Nog niet elke Captain heeft ingediend. Een Captain zonder indiening telt in de consolidatie als ontbrekend."}
            </p>
            <Input placeholder="Reden of opmerking (optioneel)" value={reden} onChange={(e) => setReden(e.target.value)} />
            <div><Button onClick={() => vergrendel.mutate()} disabled={vergrendel.isPending} data-testid="tk-vergrendel"><Lock className="mr-1 h-4 w-4" /> Nulmeting afsluiten</Button></div>
          </CardContent>
        </Card>
      )}

      {inzage && (
        <Card>
          <CardHeader><CardTitle>Ingediende antwoorden van {inzage.naam}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{JSON.stringify(inzage.data?.antwoorden ?? inzage.data, null, 2)}</pre>
            <div><Button size="sm" variant="ghost" onClick={() => setInzage(null)}>Sluiten</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Consolidatie -----------------------------------------------------------
function ConsolidatieTab({ w }: { w: Weergave }) {
  const c = w.consolidatie;
  if (!c) return null;
  const naam = new Map(w.captains.map((x) => [x.id, x.naam]));
  return (
    <div className="grid gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle>Capaciteit</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tk-capaciteit">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1 pr-3">Captain</th><th className="pr-3">Uren/week</th><th className="pr-3">Delivery</th><th className="pr-3">Bedrijfsleiding</th><th className="pr-3">Buffer</th><th className="pr-3">Som</th><th className="pr-3">Gepland</th><th className="pr-3">Inzetbaar</th><th>Zekerheid</th></tr>
            </thead>
            <tbody>
              {c.capaciteit.map((r: any) => (
                <tr key={r.captainId} className="border-t">
                  <td className="py-2 pr-3"><div className="font-medium">{r.titel}</div><div className="text-xs text-muted-foreground">{r.naam}</div></td>
                  <td className="pr-3">{r.beschikbareUren ?? "?"}</td>
                  <td className="pr-3">{r.deliveryPct ?? "?"}% · {r.deliveryUren ?? "?"} u</td>
                  <td className="pr-3">{r.bedrijfsleidingPct ?? "?"}% · {r.bedrijfsleidingUren ?? "?"} u</td>
                  <td className="pr-3">{r.bufferPct ?? "?"}% · {r.bufferUren ?? "?"} u</td>
                  <td className={`pr-3 ${r.som !== 100 ? "text-destructive font-medium" : ""}`}>{r.som ?? "?"}%</td>
                  <td className="pr-3">{r.geplandeUren} u</td>
                  <td className="pr-3">{r.inzetbaarUren ?? "?"} u</td>
                  <td>{r.zekerheid || "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.zonderIndiening?.length > 0 && <p className="mt-2 text-sm text-destructive">Zonder indiening: {c.zonderIndiening.map((x: any) => x.naam).join(", ")}.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Signalen voor de workshop</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {(["rood", "oranje", "geel", "blauw"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SIGNAAL_INFO[k].kleur }} /> {SIGNAAL_INFO[k].label}: {c.tellingen[k] ?? 0}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{GEEN_GEMIDDELDE}</p>
          <ul className="grid gap-1" data-testid="tk-signalen">
            {c.signalen.map((g: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: g.soort === "aandacht" ? "#7A7974" : SIGNAAL_INFO[g.soort as keyof typeof SIGNAAL_INFO].kleur }} />
                <span>{g.tekst}</span>
              </li>
            ))}
            {c.signalen.length === 0 && <li className="text-muted-foreground">Geen signalen.</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dekking per domein</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tk-heatmap">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1 pr-3">Domein</th>{w.captains.map((x) => <th key={x.id} className="pr-3">{x.naam}</th>)}<th>Signalen</th></tr>
            </thead>
            <tbody>
              {c.domeinen.map((d: any) => (
                <tr key={d.domein} className="border-t">
                  <td className="py-1.5 pr-3">{d.naam}</td>
                  {w.captains.map((x) => {
                    const r = d.rollen.find((y: any) => y.captainId === x.id);
                    const rol = r?.mijnRol || "";
                    const gewenst = r?.gewensteRol && r.gewensteRol !== r.mijnRol ? ` → ${r.gewensteRol}` : "";
                    return <td key={x.id} className={`pr-3 ${rol === "A" ? "font-semibold" : "text-muted-foreground"}`}>{rol || "."}{gewenst}</td>;
                  })}
                  <td>{d.signalen.map((k: string) => <span key={k} className="mr-1 inline-block h-2.5 w-2.5 rounded-full" title={SIGNAAL_INFO[k as keyof typeof SIGNAAL_INFO].label} style={{ background: SIGNAAL_INFO[k as keyof typeof SIGNAAL_INFO].kleur }} />)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Huidige rol, en na de pijl de gewenste rol als die verschilt. Captains: {Array.from(naam.values()).join(", ")}.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Register ---------------------------------------------------------------
function leegKaart(ownerCaptainId: number, type: CommitmentType = "delivery"): Record<string, any> {
  const k: Record<string, any> = { type, ownerCaptainId, domein: "", urenPerWeek: null, status: "groen", bronIndieningId: null };
  for (const v of KAART_VELDEN) k[v.sleutel] = "";
  return k;
}

function RegisterTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const bewerkbaar = w.ronde.status === "CONSOLIDATIE";
  const statusBaar = w.ronde.status === "CONSOLIDATIE" || w.ronde.status === "VASTGESTELD";
  const [kaart, setKaart] = useState<Record<string, any> | null>(null);
  const naam = new Map(w.captains.map((x) => [x.id, `${x.naam} (${CAPTAIN_ROL_INFO[x.rol].titel})`]));

  const neemOver = useMutation({
    mutationFn: () => tkPost(`/rondes/${id}/commitments/overnemen`),
    onSuccess: (r: any) => { herlaadRonde(id); toast({ title: `${r.toegevoegd} commitments overgenomen`, description: "Vul de kaarten aan tijdens de workshop." }); },
    onError: (e) => toast({ title: "Niet overgenomen", description: foutTekst(e), variant: "destructive" }),
  });
  const bewaar = useMutation({
    mutationFn: (k: Record<string, any>) => (k.id ? tkPut(`/rondes/${id}/commitments/${k.id}`, schoon(k, true)) : tkPost(`/rondes/${id}/commitments`, schoon(k, false))),
    onSuccess: () => { setKaart(null); herlaadRonde(id); toast({ title: "Commitment bewaard" }); },
    onError: (e) => toast({ title: "Niet bewaard", description: [foutTekst(e), ...foutLijst(e)].join(" "), variant: "destructive" }),
  });
  const wis = useMutation({
    mutationFn: (cid: number) => tkDelete(`/rondes/${id}/commitments/${cid}`),
    onSuccess: () => { herlaadRonde(id); toast({ title: "Commitment verwijderd" }); },
    onError: (e) => toast({ title: "Niet verwijderd", description: foutTekst(e), variant: "destructive" }),
  });
  const status = useMutation({
    mutationFn: (v: { c: any; status: CommitmentStatus }) => tkPost(`/rondes/${id}/commitments/${v.c.id}/status`, { status: v.status, toelichting: "", versie: v.c.versie }),
    onSuccess: () => herlaadRonde(id),
    onError: (e) => toast({ title: "Status niet gewijzigd", description: foutTekst(e), variant: "destructive" }),
  });

  return (
    <div className="grid gap-4 mt-4">
      {bewerkbaar && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => neemOver.mutate()} disabled={neemOver.isPending} data-testid="tk-overnemen">Commitments uit de vragenlijsten overnemen</Button>
          <Button onClick={() => setKaart(leegKaart(w.captains[0].id))} data-testid="tk-commitment-nieuw"><Plus className="mr-1 h-4 w-4" /> Nieuwe commitment</Button>
        </div>
      )}

      {kaart && (
        <Card data-testid="tk-kaart">
          <CardHeader><CardTitle>{kaart.id ? `Commitment ${kaart.code} bewerken` : "Nieuwe commitment"}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label>Type</Label>
                <Select value={kaart.type} onValueChange={(v) => setKaart({ ...kaart, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["delivery", "bedrijfsleiding"] as const).map((t) => <SelectItem key={t} value={t}>{COMMITMENT_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Accountable owner</Label>
                <Select value={String(kaart.ownerCaptainId)} onValueChange={(v) => setKaart({ ...kaart, ownerCaptainId: Number(v) })}>
                  <SelectTrigger data-testid="tk-kaart-owner"><SelectValue /></SelectTrigger>
                  <SelectContent>{w.captains.map((x) => <SelectItem key={x.id} value={String(x.id)}>{naam.get(x.id)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Domein</Label>
                <Select value={kaart.domein || "geen"} onValueChange={(v) => setKaart({ ...kaart, domein: v === "geen" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geen">Geen domein</SelectItem>
                    {DOMEINEN.map((d) => <SelectItem key={d.sleutel} value={d.sleutel}>{d.naam}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {KAART_VELDEN.map((v) => (
                <div key={v.sleutel} className="grid gap-1">
                  <Label className="text-xs">{v.label}</Label>
                  <Textarea rows={2} placeholder={v.hulp} value={kaart[v.sleutel] ?? ""} onChange={(e) => setKaart({ ...kaart, [v.sleutel]: e.target.value })} data-testid={`tk-kaart-${v.sleutel}`} />
                </div>
              ))}
              <div className="grid gap-1">
                <Label className="text-xs">Uren per week</Label>
                <Input inputMode="decimal" value={kaart.urenPerWeek ?? ""} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); setKaart({ ...kaart, urenPerWeek: e.target.value.trim() === "" || !Number.isFinite(n) ? null : n }); }} data-testid="tk-kaart-uren" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => bewaar.mutate(kaart)} disabled={bewaar.isPending} data-testid="tk-kaart-bewaren">Bewaren</Button>
              <Button variant="ghost" onClick={() => setKaart(null)}>Annuleren</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {w.commitments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Het register is nog leeg.</p>
      ) : (
        <div className="grid gap-3" data-testid="tk-register">
          {w.commitments.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4 grid gap-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.code}</Badge>
                    <span className="font-medium">{c.deliverable || c.objective || "(zonder deliverable)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_KLEUR[c.status as CommitmentStatus] }} />{COMMITMENT_STATUS_LABEL[c.status as CommitmentStatus]}</span>
                    {statusBaar && (
                      <Select value={c.status} onValueChange={(v) => status.mutate({ c, status: v as CommitmentStatus })}>
                        <SelectTrigger className="h-8 w-36" data-testid={`tk-status-${c.code}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{COMMITMENT_STATUSSEN.map((x) => <SelectItem key={x} value={x}>{COMMITMENT_STATUS_LABEL[x]}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {bewerkbaar && <Button size="sm" variant="ghost" onClick={() => setKaart({ ...c })} aria-label="Bewerk"><Pencil className="h-4 w-4" /></Button>}
                    {bewerkbaar && <Button size="sm" variant="ghost" onClick={() => wis.mutate(c.id)} aria-label="Verwijder"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {COMMITMENT_TYPE_LABEL[c.type as CommitmentType]} · A: {naam.get(c.ownerCaptainId)}{c.domein ? ` · ${domeinNaam(c.domein)}` : ""}{c.deadline ? ` · ${c.deadline}` : ""}{c.urenPerWeek !== null ? ` · ${c.urenPerWeek} u/week` : ""}
                </div>
                <div className="grid gap-1 sm:grid-cols-3 text-xs">
                  <div><b>Acceptatiebewijs:</b> {c.acceptatiebewijs || "ontbreekt"}</div>
                  <div><b>Beslissingsrecht:</b> {c.beslissingsrecht || "ontbreekt"}</div>
                  <div><b>Stopkeuze:</b> {c.stopkeuze || "ontbreekt"}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function schoon(k: Record<string, any>, metVersie: boolean): Record<string, any> {
  const uit: Record<string, any> = { type: k.type, ownerCaptainId: k.ownerCaptainId, domein: k.domein ?? "", urenPerWeek: k.urenPerWeek ?? null, status: k.status ?? "groen", bronIndieningId: k.bronIndieningId ?? null };
  for (const v of KAART_VELDEN) uit[v.sleutel] = k[v.sleutel] ?? "";
  if (metVersie) uit.versie = k.versie;
  return uit;
}

// ---- Coverage Matrix --------------------------------------------------------
function CoverageTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const bewerkbaar = w.ronde.status === "CONSOLIDATIE";
  const [rijen, setRijen] = useState<CoverageRij[]>(w.coverage);
  useEffect(() => setRijen(w.coverage), [w.coverage]);
  const bewaar = useMutation({
    mutationFn: () => tkPut(`/rondes/${id}/coverage`, { rijen, versie: w.ronde.coverageVersie }),
    onSuccess: () => { herlaadRonde(id); toast({ title: "Coverage Matrix bewaard" }); },
    onError: (e) => toast({ title: "Niet bewaard", description: foutTekst(e), variant: "destructive" }),
  });
  const zet = (i: number, v: Partial<CoverageRij>) => setRijen((rs) => rs.map((r, j) => (j === i ? { ...r, ...v } : r)));

  return (
    <div className="grid gap-3 mt-4">
      <p className="text-sm text-muted-foreground">Per domein een A-owner, de dekkingsscore van 0 tot 4 en de actie. De score beschrijft de dekking, niet de persoon.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="tk-coverage">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Domein</th><th className="pr-3">A-owner</th><th className="pr-3">Score</th><th>Actie</th></tr></thead>
          <tbody>
            {rijen.map((r, i) => (
              <tr key={r.domein} className="border-t align-top">
                <td className="py-2 pr-3 w-56">{domeinNaam(r.domein)}</td>
                <td className="pr-3 w-60">
                  <Select disabled={!bewerkbaar} value={r.aOwnerCaptainId ? String(r.aOwnerCaptainId) : "geen"} onValueChange={(v) => { const c = w.captains.find((x) => String(x.id) === v); zet(i, { aOwnerCaptainId: c ? c.id : null, aOwner: c ? c.naam : "" }); }}>
                    <SelectTrigger className="h-8" data-testid={`tk-cov-owner-${r.domein}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geen">Nog geen A-owner</SelectItem>
                      {w.captains.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.naam}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="pr-3 w-44">
                  <Select disabled={!bewerkbaar} value={r.score === null ? "leeg" : String(r.score)} onValueChange={(v) => zet(i, { score: v === "leeg" ? null : Number(v) })}>
                    <SelectTrigger className="h-8" data-testid={`tk-cov-score-${r.domein}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leeg">Nog niet gescoord</SelectItem>
                      {DEKKINGSSCORES.map((d) => <SelectItem key={d.score} value={String(d.score)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td><Input className="h-8" disabled={!bewerkbaar} value={r.actie} onChange={(e) => zet(i, { actie: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bewerkbaar && <div><Button onClick={() => bewaar.mutate()} disabled={bewaar.isPending} data-testid="tk-coverage-bewaren">Coverage Matrix bewaren</Button></div>}
    </div>
  );
}

// ---- Decision Log -----------------------------------------------------------
const LEEG_BESLUIT = { datum: new Date().toISOString().slice(0, 10), onderwerp: "", besluit: "", beslisser: "", rationale: "", aannames: "", gevolgen: "", reviewmoment: "" };

function BesluitenTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const open = w.ronde.status !== "AFGESLOTEN";
  const [b, setB] = useState({ ...LEEG_BESLUIT });
  const leg = useMutation({
    mutationFn: () => tkPost(`/rondes/${id}/besluiten`, b),
    onSuccess: () => { setB({ ...LEEG_BESLUIT }); herlaadRonde(id); toast({ title: "Besluit vastgelegd" }); },
    onError: (e) => toast({ title: "Niet vastgelegd", description: [foutTekst(e), ...foutLijst(e)].join(" "), variant: "destructive" }),
  });
  const velden: Array<[keyof typeof LEEG_BESLUIT, string]> = [["onderwerp", "Onderwerp"], ["besluit", "Besluit"], ["beslisser", "Beslisser"], ["rationale", "Rationale"], ["aannames", "Aannames"], ["gevolgen", "Gevolgen"], ["reviewmoment", "Reviewmoment"]];
  return (
    <div className="grid gap-4 mt-4">
      <p className="text-sm text-muted-foreground">Een besluit wordt nooit overschreven. Een gewijzigd besluit is een nieuw besluit dat naar het vorige verwijst.</p>
      {w.besluiten.length > 0 && (
        <ul className="grid gap-2" data-testid="tk-besluiten">
          {w.besluiten.map((x) => (
            <li key={x.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{x.datum} · {x.onderwerp}</div>
              <div>{x.besluit}</div>
              <div className="text-xs text-muted-foreground">Beslisser: {x.beslisser}{x.reviewmoment ? ` · review ${x.reviewmoment}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Card>
          <CardHeader><CardTitle>Besluit vastleggen</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1"><Label className="text-xs">Datum</Label><Input type="date" value={b.datum} onChange={(e) => setB({ ...b, datum: e.target.value })} /></div>
            {velden.map(([k, l]) => (
              <div key={k} className="grid gap-1"><Label className="text-xs">{l}</Label><Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} data-testid={`tk-besluit-${k}`} /></div>
            ))}
            <div className="sm:col-span-2"><Button onClick={() => leg.mutate()} disabled={leg.isPending} data-testid="tk-besluit-vastleggen">Besluit vastleggen</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Acceptatie, vaststellen en afsluiten ------------------------------------
function AcceptatieTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const a = w.acceptatie;
  const [toelichting, setToelichting] = useState("");
  const [zeker, setZeker] = useState(false);
  const zet = useMutation({
    mutationFn: (h: Record<string, boolean>) => tkPut(`/rondes/${id}/acceptatie`, { handmatig: h, versie: a?.versie ?? 0 }),
    onSuccess: () => herlaadRonde(id),
    onError: (e) => toast({ title: "Niet bewaard", description: foutTekst(e), variant: "destructive" }),
  });
  const vaststellen = useMutation({
    mutationFn: () => tkPost(`/rondes/${id}/vaststellen`, { bevestig: true, toelichting }),
    onSuccess: () => { setZeker(false); herlaadRonde(id); toast({ title: "Register vastgesteld" }); },
    onError: (e) => toast({ title: "Niet vastgesteld", description: [foutTekst(e), ...foutLijst(e)].join(" "), variant: "destructive" }),
  });
  const afsluiten = useMutation({
    mutationFn: () => tkPost(`/rondes/${id}/afsluiten`, { bevestig: true, toelichting }),
    onSuccess: () => { setZeker(false); herlaadRonde(id); toast({ title: "Kwartaal afgesloten" }); },
    onError: (e) => toast({ title: "Niet afgesloten", description: foutTekst(e), variant: "destructive" }),
  });
  if (!a) return null;
  const handmatig = Object.fromEntries(a.criteria.filter((c) => !c.automatisch).map((c) => [c.sleutel, c.voldaan]));
  const s = w.ronde.status;

  return (
    <div className="grid gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle>Acceptatiecriteria</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm" data-testid="tk-acceptatie">
          {a.criteria.map((c) => (
            <div key={c.sleutel} className="flex items-start gap-3 rounded-md border p-3">
              {c.automatisch ? (
                <Badge variant={c.voldaan ? "default" : "destructive"} className="shrink-0">{c.voldaan ? "Voldaan" : "Niet voldaan"}</Badge>
              ) : (
                <Checkbox checked={c.voldaan} disabled={s !== "CONSOLIDATIE"} onCheckedChange={(v) => zet.mutate({ ...handmatig, [c.sleutel]: v === true })} data-testid={`tk-acc-${c.sleutel}`} />
              )}
              <div>
                <div>{c.tekst}</div>
                <div className="text-xs text-muted-foreground">{c.automatisch ? "Automatisch getoetst. " : "Bevestiging door het TOC. "}{c.toelichting}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {s === "CONSOLIDATIE" && (
        <Card>
          <CardHeader><CardTitle>Register vaststellen</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {w.vaststelFouten.length > 0 ? (
              <div className="rounded-md border border-destructive/50 p-3" data-testid="tk-vaststelfouten">
                <div className="font-medium mb-1">Nog op te lossen voor vaststelling</div>
                <ul className="list-disc pl-5">{w.vaststelFouten.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            ) : (
              <p className="text-muted-foreground">Alle voorwaarden zijn vervuld. Na vaststelling liggen het register, de Coverage Matrix en de acceptatie vast; enkel de status van commitments en het Decision Log blijven open.</p>
            )}
            <Input placeholder="Toelichting (optioneel)" value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
            <label className="flex items-center gap-2"><Checkbox checked={zeker} onCheckedChange={(v) => setZeker(v === true)} /> Het TOC heeft dit register in de workshop samen vastgesteld.</label>
            <div><Button onClick={() => vaststellen.mutate()} disabled={!zeker || w.vaststelFouten.length > 0 || vaststellen.isPending} data-testid="tk-vaststellen">Register vaststellen</Button></div>
          </CardContent>
        </Card>
      )}

      {s === "VASTGESTELD" && (
        <Card>
          <CardHeader><CardTitle>Kwartaal afsluiten</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">Sluit het kwartaal af na de kwartaalherijking. Daarna is de ronde alleen nog leesbaar; maak eerst de kwartaalscorecard.</p>
            <Textarea placeholder="Toelichting bij de afsluiting (optioneel)" value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
            <label className="flex items-center gap-2"><Checkbox checked={zeker} onCheckedChange={(v) => setZeker(v === true)} /> Ik sluit dit kwartaal definitief af.</label>
            <div><Button onClick={() => afsluiten.mutate()} disabled={!zeker || afsluiten.isPending} data-testid="tk-afsluiten">Kwartaal afsluiten</Button></div>
          </CardContent>
        </Card>
      )}
      {s === "AFGESLOTEN" && <p className="text-sm text-muted-foreground">Dit kwartaal is afgesloten op {tijd(w.ronde.afgeslotenOp)}.</p>}
    </div>
  );
}

// ---- Rapporten --------------------------------------------------------------
function RapportenTab({ w }: { w: Weergave }) {
  const { toast } = useToast();
  const id = w.ronde.id;
  const na = minstens(w.ronde.status, "CONSOLIDATIE");
  const maak = useMutation({
    mutationFn: (v: { type: RapportType; captainId?: number }) => tkPost(`/rondes/${id}/rapporten/${v.type}`, v.captainId ? { captainId: v.captainId } : {}),
    onSuccess: (r: any) => { herlaadRonde(id); toast({ title: r.hergebruikt ? "Rapport ongewijzigd" : `Rapport versie ${r.versie} gemaakt`, description: r.heeftPdf ? undefined : "Er is geen PDF gemaakt; de HTML-versie is beschikbaar." }); },
    onError: (e) => toast({ title: "Rapport niet gemaakt", description: foutTekst(e), variant: "destructive" }),
  });
  const naam = new Map(w.captains.map((x) => [x.id, x.naam]));

  const Versies = ({ type, captainId }: { type: RapportType; captainId?: number }) => {
    const vs = w.artefacten.filter((a) => a.type === type && (captainId === undefined || a.captainId === captainId)).sort((a, b) => b.versie - a.versie);
    if (!vs.length) return null;
    return (
      <ul className="mt-2 grid gap-1 text-sm">
        {vs.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">Versie {a.versie} · {tijd(a.createdAt)}</span>
            <a className="inline-flex items-center gap-1 underline" href={artefactUrl(id, a.id, "html")} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> HTML</a>
            {a.heeftPdf && <a className="inline-flex items-center gap-1 underline" href={artefactUrl(id, a.id, "pdf")} target="_blank" rel="noreferrer" data-testid={`tk-pdf-${type}-${a.versie}`}><FileDown className="h-3.5 w-3.5" /> PDF</a>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="grid gap-3 mt-4">
      <p className="text-sm text-muted-foreground">Dezelfde invoer geeft altijd hetzelfde rapport; een nieuwe versie ontstaat pas als er iets veranderde.</p>
      {RAPPORT_TYPES.map((t) => {
        const kan = t === "captain-charter" || na;
        return (
          <div key={t} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{RAPPORT_TYPE_LABEL[t]}</div>
              {t !== "captain-charter" && (
                <Button size="sm" disabled={!kan || maak.isPending} onClick={() => maak.mutate({ type: t })} data-testid={`tk-rapport-${t}`}><FileText className="mr-1 h-4 w-4" /> Rapport maken</Button>
              )}
            </div>
            {t === "captain-charter" ? (
              <div className="mt-2 grid gap-2">
                {w.captains.map((c) => (
                  <div key={c.id} className="rounded border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{c.titel} · {naam.get(c.id)}</span>
                      <Button size="sm" variant="outline" disabled={!c.heeftIndiening || maak.isPending} onClick={() => maak.mutate({ type: t, captainId: c.id })} data-testid={`tk-charter-${c.rol}`}>Charter maken</Button>
                    </div>
                    <Versies type={t} captainId={c.id} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {!kan && <p className="mt-1 text-xs text-muted-foreground">Beschikbaar na het afsluiten van de nulmeting.</p>}
                <Versies type={t} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
