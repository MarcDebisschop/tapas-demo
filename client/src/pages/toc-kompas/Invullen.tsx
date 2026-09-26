// ---------------------------------------------------------------------------
// Invullen: de persoonlijke vragenlijst van een Captain (route
// /toc-kompas/invullen/:token). Het token is de authenticatie. De Captain ziet
// enkel de eigen vragenlijst, nooit die van een andere Captain.
//
// Opbouw: een stap per blok van het Commitmentkompas (A tot E), daarna de
// dekkingsscan, de reflectie en een controle voor het indienen. Het concept
// wordt automatisch bewaard, twee seconden na de laatste wijziging. Het
// platform rekent de uren uit de percentages voor, maar beslist niets.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Lock, Printer, Plus, Trash2 } from "lucide-react";
import {
  BEDRIJFSLEIDING_KOLOMMEN,
  CAPACITEIT_CATEGORIEEN,
  CAPTAIN_ROL_INFO,
  CIRKEL_TEKST,
  DELIVERY_KOLOMMEN,
  DOMEINEN,
  INVULINSTRUCTIE,
  KERNREGEL,
  MAX_COMMITMENTS,
  RACI,
  RACI_OF_GEEN,
  RACI_UITLEG,
  REFLECTIE,
  REFLECTIE_BD,
  REFLECTIE_BD_TITEL,
  VISIBILITY_GRENZEN,
  VISIBILITY_ROLBEDOELING,
  VRAAGBLOKKEN,
  beschikbareUren,
  capaciteitSom,
  indienFouten,
  urenVoor,
  voortgang,
  type Antwoorden,
  type CaptainRol,
  type Vraag,
} from "@shared/toc-kompas";
import { TK_API, charterUrl, foutLijst, foutStatus, foutTekst, tkPost, tkPut } from "./api";

type Weergave = {
  ronde: { titel: string; periode: string; deadline: string; status: string };
  captain: { rol: CaptainRol; naam: string; titel: string };
  antwoorden: Antwoorden;
  conceptVersie: number;
  conceptOp: string | null;
  ingediendOp: string | null;
  indieningVersie: number | null;
  bewerkbaar: boolean;
};

const STAPPEN = ["Start", "A", "B", "C", "D", "E", "Dekkingsscan", "Reflectie", "Indienen"] as const;

function getal(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function VraagVeld({ v, waarde, zet, uit }: { v: Vraag; waarde: string; zet: (s: string) => void; uit: boolean }) {
  const id = `tk-veld-${v.sleutel}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-medium">{v.label}</Label>
      <p className="text-xs text-muted-foreground">{v.hulp}</p>
      {v.soort === "keuze" && v.opties ? (
        <div className="flex flex-wrap gap-2">
          {v.opties.map((o) => (
            <Button key={o} type="button" size="sm" variant={waarde === o ? "default" : "outline"} disabled={uit} onClick={() => zet(waarde === o ? "" : o)} data-testid={`${id}-${o}`}>
              {o}
            </Button>
          ))}
        </div>
      ) : v.soort === "getal" ? (
        <Input id={id} inputMode="decimal" value={waarde} disabled={uit} onChange={(e) => zet(e.target.value)} className="max-w-[12rem]" data-testid={id} />
      ) : (
        <Textarea id={id} value={waarde} disabled={uit} onChange={(e) => zet(e.target.value)} rows={3} data-testid={id} />
      )}
    </div>
  );
}

export default function TocKompasInvullen() {
  const [, params] = useRoute("/toc-kompas/invullen/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();
  const sleutel = [`${TK_API}/invullen/${token}`];
  const { data: w, isLoading, error, refetch } = useQuery<Weergave>({ queryKey: sleutel, enabled: !!token, retry: false });
  const [a, setA] = useState<Antwoorden | null>(null);
  const [stap, setStap] = useState(0);
  const [bewaard, setBewaard] = useState<string>("");
  const [conflict, setConflict] = useState(false);
  const [fouten, setFouten] = useState<string[]>([]);
  const [bevestig, setBevestig] = useState(false);
  const [bezig, setBezig] = useState(false);
  const versie = useRef(0);
  const vuil = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!w) return;
    setA(w.antwoorden);
    versie.current = w.conceptVersie;
    vuil.current = false;
  }, [w]);

  const uit = !w?.bewerkbaar;

  async function bewaarNu(huidig: Antwoorden) {
    if (!vuil.current || conflict) return;
    try {
      const r = await tkPut(`/invullen/${token}/concept`, { antwoorden: huidig, versie: versie.current });
      versie.current = r.conceptVersie;
      vuil.current = false;
      setBewaard(new Date(r.conceptOp).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      if (foutStatus(e) === 409) setConflict(true);
      else toast({ title: "Concept niet bewaard", description: foutTekst(e), variant: "destructive" });
    }
  }

  function wijzig(f: (x: Antwoorden) => Antwoorden) {
    if (!a || uit) return;
    const nieuw = f(a);
    setA(nieuw);
    vuil.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => bewaarNu(nieuw), 2000);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const uren = a ? beschikbareUren(a) : null;
  const som = a ? capaciteitSom(a) : null;
  const vg = useMemo(() => (a && w ? voortgang(a, w.captain.rol) : { ingevuld: 0, totaal: 1 }), [a, w]);
  const lokaleFouten = a ? indienFouten(a) : [];

  async function dienIn() {
    if (!a) return;
    setBezig(true);
    setFouten([]);
    try {
      if (timer.current) clearTimeout(timer.current);
      await tkPost(`/invullen/${token}/indienen`, { antwoorden: a, bevestig: true });
      toast({ title: "Vragenlijst ingediend", description: "Dank je. Je antwoorden zijn vastgelegd voor de workshop." });
      await refetch();
    } catch (e) {
      const l = foutLijst(e);
      setFouten(l.length ? l : [foutTekst(e)]);
    } finally {
      setBezig(false);
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Laden...</div>;
  if (error || !w || !a) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold mb-2">Deze link werkt niet</h1>
          <p className="text-sm text-muted-foreground">{error ? foutTekst(error) : "Link niet gevonden."} Vraag de hoofdbeheerder om een nieuwe link.</p>
        </div>
      </div>
    );
  }

  const info = CAPTAIN_ROL_INFO[w.captain.rol];
  const naam = STAPPEN[stap];
  const blok = VRAAGBLOKKEN.find((b) => b.sleutel === naam);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 grid gap-6">
        <div className="grid gap-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">TOC Commitmentkompas · {w.ronde.titel} · {w.ronde.periode}</div>
          <h1 className="text-2xl font-semibold" data-testid="tk-captain-titel">{info.titel}</h1>
          <div className="text-sm text-muted-foreground">{w.captain.naam}{w.ronde.deadline ? ` · in te dienen tegen ${w.ronde.deadline}` : ""}</div>
        </div>

        {!w.bewerkbaar && (
          <Card className="border-primary/40">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4" />
                {w.ingediendOp
                  ? `Ingediend op ${new Date(w.ingediendOp).toLocaleString("nl-BE")} (versie ${w.indieningVersie}). Wijzigen kan enkel als de hoofdbeheerder de vragenlijst heropent.`
                  : "De nulmeting is afgesloten. Deze vragenlijst kan niet meer worden gewijzigd."}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={charterUrl(token)} target="_blank" rel="noreferrer" data-testid="tk-charter-afdrukken"><Printer className="mr-1 h-4 w-4" /> Mijn charter afdrukken</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {conflict && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-sm">
              Je vragenlijst werd intussen op een ander toestel of tabblad gewijzigd. Laad de pagina opnieuw om verder te gaan met de recentste versie.
              <Button size="sm" className="ml-3" onClick={() => window.location.reload()}>Opnieuw laden</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STAPPEN.map((s, i) => (
              <Button key={s} size="sm" variant={i === stap ? "default" : "ghost"} onClick={() => setStap(i)} data-testid={`tk-stap-${i}`}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Progress value={Math.round((vg.ingevuld / vg.totaal) * 100)} className="h-1.5 max-w-xs" />
            <span>{vg.ingevuld} van {vg.totaal} onderdelen ingevuld</span>
            {w.bewerkbaar && <span>{bewaard ? `Concept bewaard om ${bewaard}` : "Het concept wordt automatisch bewaard"}</span>}
          </div>
        </div>

        {naam === "Start" && (
          <Card>
            <CardHeader><CardTitle>Jouw rol in de cirkel</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <p>{CIRKEL_TEKST}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">Primaire waarde</div><div className="font-medium">{info.primaireWaarde}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">Grens</div><div className="font-medium">{info.grens}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">Deliveryfocus</div><div>{info.deliveryfocus}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">Bedrijfsleidingfocus</div><div>{info.bedrijfsleidingfocus}</div></div>
              </div>
              {w.captain.rol === "visibility" && (
                <div className="grid gap-2">
                  <p>{VISIBILITY_ROLBEDOELING}</p>
                  <ul className="list-disc pl-5">{VISIBILITY_GRENZEN.map((g) => <li key={g}>{g}</li>)}</ul>
                </div>
              )}
              <div className="rounded-md bg-muted p-3"><b>Invulinstructie.</b> {INVULINSTRUCTIE}</div>
              <div className="rounded-md bg-muted p-3"><b>Kernregel.</b> {KERNREGEL}</div>
            </CardContent>
          </Card>
        )}

        {blok && (
          <Card>
            <CardHeader><CardTitle>{blok.titel}</CardTitle></CardHeader>
            <CardContent className="grid gap-5">
              {blok.vragen.map((v) => (
                <VraagVeld key={v.sleutel} v={v} uit={uit} waarde={a.velden?.[v.sleutel] ?? ""} zet={(s) => wijzig((x) => ({ ...x, velden: { ...x.velden, [v.sleutel]: s } }))} />
              ))}

              {blok.sleutel === "B" && (
                <div className="grid gap-2">
                  <Label className="font-medium">Verdeling van je capaciteit</Label>
                  <p className="text-xs text-muted-foreground">Delivery, bedrijfsleiding en buffer tellen samen op tot 100%. De uren volgen uit je beschikbare capaciteit bij A{uren !== null ? ` (${uren} uur per week)` : ""}.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {CAPACITEIT_CATEGORIEEN.map((k) => (
                      <div key={k.sleutel} className="rounded-md border p-3 grid gap-1">
                        <Label htmlFor={`tk-pct-${k.sleutel}`}>{k.label} (%)</Label>
                        <Input id={`tk-pct-${k.sleutel}`} inputMode="decimal" disabled={uit} value={a.capaciteit[k.sleutel] ?? ""} onChange={(e) => wijzig((x) => ({ ...x, capaciteit: { ...x.capaciteit, [k.sleutel]: getal(e.target.value) } }))} data-testid={`tk-pct-${k.sleutel}`} />
                        <div className="text-xs text-muted-foreground">{k.uitleg}</div>
                        <div className="text-xs">{urenVoor(a.capaciteit[k.sleutel], uren) ?? "?"} uur per week</div>
                      </div>
                    ))}
                  </div>
                  <div className={`text-sm ${som !== null && Math.abs(som - 100) > 0.01 ? "text-destructive" : "text-muted-foreground"}`} data-testid="tk-som">
                    Totaal: {som === null ? "nog niet volledig" : `${som}%`}
                  </div>
                </div>
              )}

              {blok.sleutel === "C" && (
                <RijenEditor
                  titel="Delivery commitments"
                  kolommen={DELIVERY_KOLOMMEN as any}
                  rijen={a.delivery as any[]}
                  uit={uit}
                  metRaci
                  leeg={{ outcome: "", ontvanger: "", bewijs: "", deadline: "", uren: null, raci: "" }}
                  zet={(rijen) => wijzig((x) => ({ ...x, delivery: rijen as any }))}
                  testid="tk-delivery"
                />
              )}
              {blok.sleutel === "D" && (
                <RijenEditor
                  titel="Bedrijfsleiding commitments"
                  kolommen={BEDRIJFSLEIDING_KOLOMMEN as any}
                  rijen={a.bedrijfsleiding as any[]}
                  uit={uit}
                  leeg={{ uitkomst: "", beslissing: "", bewijs: "", deadline: "", uren: null, mandaat: "" }}
                  zet={(rijen) => wijzig((x) => ({ ...x, bedrijfsleiding: rijen as any }))}
                  testid="tk-bedrijfsleiding"
                />
              )}
            </CardContent>
          </Card>
        )}

        {naam === "Dekkingsscan" && (
          <Card>
            <CardHeader><CardTitle>Dekkingsscan</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-xs text-muted-foreground">{RACI_UITLEG} Vul per domein je huidige en gewenste rol in. Laat leeg of kies "geen" als het domein niet bij jou ligt.</p>
              {DOMEINEN.map((d) => {
                const r = a.dekking?.[d.sleutel] ?? { mijnRol: "", gewensteRol: "", urenPerMaand: null, zekerheid: null, ontbrekend: "" };
                const zetRij = (veld: string, waarde: any) => wijzig((x) => ({ ...x, dekking: { ...x.dekking, [d.sleutel]: { ...r, [veld]: waarde } as any } }));
                return (
                  <div key={d.sleutel} className="rounded-md border p-3 grid gap-2" data-testid={`tk-dekking-${d.sleutel}`}>
                    <div><b>{d.naam}</b> <span className="text-xs text-muted-foreground">{d.leiden}</span></div>
                    <div className="flex flex-wrap items-center gap-3">
                      <RolKiezer label="Mijn rol" waarde={r.mijnRol} uit={uit} zet={(v) => zetRij("mijnRol", v)} testid={`tk-mijnrol-${d.sleutel}`} />
                      <RolKiezer label="Gewenst" waarde={r.gewensteRol} uit={uit} zet={(v) => zetRij("gewensteRol", v)} testid={`tk-gewenst-${d.sleutel}`} />
                      <div className="flex items-center gap-1"><Label className="text-xs">Uren/maand</Label><Input className="h-8 w-20" inputMode="decimal" disabled={uit} value={r.urenPerMaand ?? ""} onChange={(e) => zetRij("urenPerMaand", getal(e.target.value))} data-testid={`tk-uren-${d.sleutel}`} /></div>
                      <div className="flex items-center gap-1"><Label className="text-xs">Zekerheid 1 tot 5</Label><Input className="h-8 w-14" inputMode="numeric" disabled={uit} value={r.zekerheid ?? ""} onChange={(e) => { const n = getal(e.target.value); zetRij("zekerheid", n !== null && n >= 1 && n <= 5 ? Math.round(n) : null); }} /></div>
                    </div>
                    <Input placeholder="Wat ontbreekt" disabled={uit} value={r.ontbrekend} onChange={(e) => zetRij("ontbrekend", e.target.value)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {naam === "Reflectie" && (
          <Card>
            <CardHeader><CardTitle>Reflectie voor de {info.titel}</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {REFLECTIE[w.captain.rol].map((v, i) => (
                <div key={v} className="grid gap-1.5">
                  <Label className="font-medium">{v}</Label>
                  <Textarea rows={3} disabled={uit} value={a.reflectie?.[`r${i + 1}`] ?? ""} onChange={(e) => wijzig((x) => ({ ...x, reflectie: { ...x.reflectie, [`r${i + 1}`]: e.target.value } }))} data-testid={`tk-reflectie-${i + 1}`} />
                </div>
              ))}
              <div className="border-t pt-4 grid gap-3">
                <div className="font-medium">{REFLECTIE_BD_TITEL}</div>
                <p className="text-xs text-muted-foreground">Optioneel. Enkel invullen als je ook een rol in de statutaire raad van bestuur hebt; die rol staat los van het TOC.</p>
                {REFLECTIE_BD.map((v, i) => (
                  <div key={v} className="grid gap-1.5">
                    <Label>{v}</Label>
                    <Textarea rows={2} disabled={uit} value={a.reflectie?.[`bd${i + 1}`] ?? ""} onChange={(e) => wijzig((x) => ({ ...x, reflectie: { ...x.reflectie, [`bd${i + 1}`]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {naam === "Indienen" && (
          <Card>
            <CardHeader><CardTitle>Controle en indienen</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="grid gap-1">
                <div>Beschikbare capaciteit: <b>{uren ?? "niet ingevuld"}</b> uur per week</div>
                <div>Verdeling: <b>{som === null ? "onvolledig" : `${som}%`}</b></div>
                <div>Delivery commitments: <b>{a.delivery.filter((r) => r.outcome.trim()).length}</b>, bedrijfsleiding commitments: <b>{a.bedrijfsleiding.filter((r) => r.uitkomst.trim()).length}</b></div>
              </div>
              {(fouten.length > 0 || lokaleFouten.length > 0) && (
                <div className="rounded-md border border-destructive/50 p-3" data-testid="tk-fouten">
                  <div className="font-medium mb-1">Nog te doen voor je kunt indienen</div>
                  <ul className="list-disc pl-5">{(fouten.length ? fouten : lokaleFouten).map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
              {w.bewerkbaar && (
                <>
                  <label className="flex items-start gap-2">
                    <Checkbox checked={bevestig} onCheckedChange={(v) => setBevestig(v === true)} data-testid="tk-bevestig" />
                    <span>Ik heb deze vragenlijst individueel ingevuld en bevestig dat de capaciteit en commitments realistisch zijn.</span>
                  </label>
                  <div>
                    <Button onClick={dienIn} disabled={!bevestig || bezig || lokaleFouten.length > 0 || conflict} data-testid="tk-indienen">Indienen</Button>
                  </div>
                </>
              )}
              <div>
                <Button variant="outline" size="sm" asChild>
                  <a href={charterUrl(token)} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" /> Voorbeeld van mijn charter</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <Button variant="outline" disabled={stap === 0} onClick={() => setStap((s) => s - 1)} data-testid="tk-vorige"><ChevronLeft className="mr-1 h-4 w-4" /> Vorige</Button>
          <Button variant="outline" disabled={stap === STAPPEN.length - 1} onClick={() => { if (a) bewaarNu(a); setStap((s) => s + 1); }} data-testid="tk-volgende">Volgende <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </main>
    </div>
  );
}

function RolKiezer({ label, waarde, zet, uit, testid }: { label: string; waarde: string; zet: (v: string) => void; uit: boolean; testid: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {RACI_OF_GEEN.map((r) => (
        <Button key={r} type="button" size="sm" className="h-7 px-2" variant={waarde === r ? "default" : "outline"} disabled={uit} onClick={() => zet(waarde === r ? "" : r)} data-testid={`${testid}-${r}`}>
          {r}
        </Button>
      ))}
    </div>
  );
}

function RijenEditor({
  titel,
  kolommen,
  rijen,
  zet,
  uit,
  leeg,
  metRaci,
  testid,
}: {
  titel: string;
  kolommen: Array<{ sleutel: string; label: string }>;
  rijen: any[];
  zet: (r: any[]) => void;
  uit: boolean;
  leeg: Record<string, unknown>;
  metRaci?: boolean;
  testid: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="font-medium">{titel}</Label>
      <p className="text-xs text-muted-foreground">Maximaal {MAX_COMMITMENTS}. Vul per commitment de uren per week in.</p>
      {rijen.map((r, i) => (
        <div key={i} className="rounded-md border p-3 grid gap-2" data-testid={`${testid}-${i}`}>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{i + 1}</Badge>
            {!uit && <Button size="sm" variant="ghost" onClick={() => zet(rijen.filter((_, j) => j !== i))} aria-label="Verwijder"><Trash2 className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {kolommen.map((k) => (
              <div key={k.sleutel} className="grid gap-1">
                <Label className="text-xs">{k.label}</Label>
                <Input disabled={uit} value={r[k.sleutel] ?? ""} onChange={(e) => zet(rijen.map((x, j) => (j === i ? { ...x, [k.sleutel]: e.target.value } : x)))} data-testid={`${testid}-${i}-${k.sleutel}`} />
              </div>
            ))}
            <div className="grid gap-1">
              <Label className="text-xs">Uren per week</Label>
              <Input disabled={uit} inputMode="decimal" value={r.uren ?? ""} onChange={(e) => zet(rijen.map((x, j) => (j === i ? { ...x, uren: getal(e.target.value) } : x)))} data-testid={`${testid}-${i}-uren`} />
            </div>
            {metRaci && (
              <div className="grid gap-1">
                <Label className="text-xs">A/R/C/I</Label>
                <div className="flex gap-1">
                  {RACI.map((x) => (
                    <Button key={x} type="button" size="sm" className="h-7 px-2" variant={r.raci === x ? "default" : "outline"} disabled={uit} onClick={() => zet(rijen.map((y, j) => (j === i ? { ...y, raci: y.raci === x ? "" : x } : y)))}>
                      {x}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      {!uit && rijen.length < MAX_COMMITMENTS && (
        <div><Button size="sm" variant="outline" onClick={() => zet([...rijen, { ...leeg }])} data-testid={`${testid}-toevoegen`}><Plus className="mr-1 h-4 w-4" /> Commitment toevoegen</Button></div>
      )}
    </div>
  );
}
