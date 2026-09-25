// ---------------------------------------------------------------------------
// Observer: het publieke observatiescherm (route /role-fit/observatie/:token).
// Het token is de authenticatie. De observator ziet geen profiel, geen
// fitkaart en niets van de andere observator (semi-blind).
//
// Opbouw volgens het bouwplan (par. 12): een scherm per hypothese; bovenaan
// scenario en doel, in het midden wat letterlijk gezien of gehoord werd,
// onderaan het anker 1/3/5 en de zekerheid. Een knop "onvoldoende
// observatiekans" in plaats van een gedwongen score. Een taalcoach markeert
// interpretaties terwijl u schrijft; hij herschrijft niets. Voor de eerste
// observatie volgt u een korte training met drie voorbeelden en een
// kalibratiecheck.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  BARS_WAARDEN,
  BEWIJSKWALITEITEN,
  BEWIJSKWALITEIT_LABEL,
  CONFIDENCES,
  CONFIDENCE_LABEL,
  METHODE_LABEL,
  OBSERVATOR_ROL_LABEL,
  taalcoachMeldingen,
  type ObservatieRegel,
} from "@shared/role-fit";
import { RF_API, foutDetails, foutTekst, rfPost, rfPut } from "./api";

const KALIBRATIE_SLEUTEL = "rf-kalibratie-v1";

const VOORBEELDEN = [
  {
    fout: "Ze is een natuurlijke leider en erg empathisch.",
    goed: "Toen twee collega's elkaar onderbraken, vroeg ze beiden om hun voorstel in een zin samen te vatten en noteerde ze die op het bord.",
    waarom: "Een label zegt wie iemand zou zijn. De goede versie beschrijft wat u zag, in welke situatie.",
  },
  {
    fout: "Hij denkt heel strategisch.",
    goed: "Hij vroeg eerst naar het budget voor volgend jaar en koppelde zijn voorstel aan twee doelen uit het jaarplan.",
    waarom: "Strategisch is een interpretatie. Noteer de vraag, de actie en waarop die gericht was.",
  },
  {
    fout: "Weinig overtuigend, hij zal het moeilijk hebben met het team.",
    goed: "Op de tegenwerping van de hiring manager antwoordde hij: 'Dat weet ik niet, dat zoek ik uit.' Er volgde geen voorstel.",
    waarom: "Een voorspelling over later is geen observatie. Beschrijf het antwoord en het effect in het gesprek.",
  },
];

const KALIBRATIE = [
  { zin: "Ze vatte de drie bezwaren van de klant samen voor ze een voorstel deed.", observatie: true },
  { zin: "Hij is dominant in een groep.", observatie: false },
  { zin: "Op de vraag naar een fout antwoordde ze: 'Ik had de planning niet gecontroleerd.'", observatie: true },
  { zin: "Ze heeft duidelijk veel talent voor verkoop.", observatie: false },
];

type Weergave = {
  rol: "recruiter" | "hiring_manager";
  actorNaam: string;
  functieTitel: string;
  kandidaatLabel: string;
  status: string;
  ingediendOp: string | null;
  concept: { regels?: ObservatieRegel[] };
  oefeningen: Array<{ id: number; volgorde: number; methode: string; titel: string; instructie: string; probes: string[]; ankers: Record<string, string> }>;
  eigenObservaties: any[];
  magCorrigeren: boolean;
};

function leegRegel(exerciseId: number): ObservatieRegel {
  return {
    exerciseId,
    contextTrigger: "",
    gedrag: "",
    quoteActie: "",
    effect: "",
    barsScore: null,
    onvoldoendeKans: false,
    bewijskwaliteit: null,
    alternatieveVerklaring: "",
    confidence: null,
  };
}

function Kalibratie({ klaar }: { klaar: () => void }) {
  const [antwoorden, setAntwoorden] = useState<Record<number, boolean>>({});
  const [getoond, setGetoond] = useState(false);
  const alles = Object.keys(antwoorden).length === KALIBRATIE.length;
  const juist = KALIBRATIE.every((k, i) => antwoorden[i] === k.observatie);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Korte training voor uw eerste observatie</CardTitle></CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p>U noteert wat u letterlijk ziet en hoort. Drie voorbeelden:</p>
        {VOORBEELDEN.map((v, i) => (
          <div key={i} className="grid gap-1 rounded-md border p-3">
            <div><span className="font-medium text-rose-700">Liever niet: </span>{v.fout}</div>
            <div><span className="font-medium text-emerald-700">Wel: </span>{v.goed}</div>
            <div className="text-muted-foreground">{v.waarom}</div>
          </div>
        ))}
        <p className="font-medium">Kalibratiecheck: is dit een waarneming of een interpretatie?</p>
        {KALIBRATIE.map((k, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <span>{k.zin}</span>
            <div className="flex gap-1">
              {[true, false].map((w) => (
                <Button key={String(w)} size="sm" variant={antwoorden[i] === w ? "default" : "outline"} onClick={() => setAntwoorden((o) => ({ ...o, [i]: w }))} data-testid={`rf-kal-${i}-${w ? "obs" : "int"}`}>
                  {w ? "Waarneming" : "Interpretatie"}
                </Button>
              ))}
            </div>
          </div>
        ))}
        {getoond && !juist && <p className="text-rose-700">Nog niet alles juist. Lees de voorbeelden opnieuw en pas uw antwoorden aan.</p>}
        <div className="flex justify-end">
          <Button
            disabled={!alles}
            onClick={() => {
              setGetoond(true);
              if (juist) {
                try { localStorage.setItem(KALIBRATIE_SLEUTEL, "1"); } catch { /* privevenster: niet bewaren */ }
                klaar();
              }
            }}
            data-testid="rf-kal-klaar"
          >
            Controleren
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Taalcoach({ tekst }: { tekst: string }) {
  const meldingen = useMemo(() => taalcoachMeldingen(tekst), [tekst]);
  if (!meldingen.length) return null;
  return (
    <ul className="grid gap-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900" data-testid="rf-taalcoach">
      {meldingen.map((m, i) => (
        <li key={i}><span className="font-medium">"{m.fragment}"</span>: {m.uitleg}</li>
      ))}
    </ul>
  );
}

export default function RoleFitObserver() {
  const [, params] = useRoute("/role-fit/observatie/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();
  const sleutel = [`${RF_API}/observatie/${token}`];
  const { data: w, isLoading, error, refetch } = useQuery<Weergave>({ queryKey: sleutel, enabled: !!token, retry: false });
  const [gekalibreerd, setGekalibreerd] = useState(() => {
    try { return localStorage.getItem(KALIBRATIE_SLEUTEL) === "1"; } catch { return false; }
  });
  const [regels, setRegels] = useState<ObservatieRegel[]>([]);
  const [stap, setStap] = useState(0);
  const [taalBevestiging, setTaalBevestiging] = useState<any[] | null>(null);
  const [correctieReden, setCorrectieReden] = useState("");
  const geladen = useRef(false);

  useEffect(() => {
    if (!w || geladen.current) return;
    geladen.current = true;
    const concept = new Map((w.concept?.regels ?? []).map((r) => [r.exerciseId, r]));
    const eigen = new Map<number, any>();
    for (const o of w.eigenObservaties) if (!eigen.has(o.exerciseId) || eigen.get(o.exerciseId).versie < o.versie) eigen.set(o.exerciseId, o);
    setRegels(
      w.oefeningen.map((e) => {
        const o = eigen.get(e.id);
        if (o) {
          return { ...leegRegel(e.id), ...Object.fromEntries(Object.keys(leegRegel(e.id)).map((k) => [k, o[k] ?? (leegRegel(e.id) as any)[k]])), onvoldoendeKans: !!o.onvoldoendeKans } as ObservatieRegel;
        }
        return concept.get(e.id) ?? leegRegel(e.id);
      }),
    );
  }, [w]);

  const zet = (veld: keyof ObservatieRegel, waarde: any) => setRegels((rs) => rs.map((r, i) => (i === stap ? { ...r, [veld]: waarde } : r)));

  const concept = useMutation({
    mutationFn: () => rfPut(`/observatie/${token}/concept`, { regels }),
    onSuccess: () => toast({ title: "Concept bewaard" }),
    onError: (e) => toast({ title: "Concept niet bewaard", description: foutTekst(e), variant: "destructive" }),
  });
  const dienIn = useMutation({
    mutationFn: (bevestig: boolean) => rfPost(`/observatie/${token}/indienen`, { regels, bevestigTaalcoach: bevestig }),
    onSuccess: (r: any) => {
      setTaalBevestiging(null);
      toast({ title: "Ingediend en vergrendeld", description: r.vergrendeld ? "Beide observaties zijn binnen." : "De andere observator is nog bezig." });
      geladen.current = false;
      refetch();
    },
    onError: (e) => {
      const d = foutDetails(e);
      if (d?.taal) {
        setTaalBevestiging(d.taal);
        return;
      }
      toast({ title: "Niet ingediend", description: foutTekst(e), variant: "destructive" });
    },
  });
  const corrigeer = useMutation({
    mutationFn: () => rfPost(`/observatie/${token}/correctie`, { regel: regels[stap], reden: correctieReden }),
    onSuccess: (r: any) => { toast({ title: `Correctie bewaard als versie ${r.versie}` }); setCorrectieReden(""); geladen.current = false; refetch(); },
    onError: (e) => toast({ title: "Correctie niet bewaard", description: foutTekst(e), variant: "destructive" }),
  });

  // Toont voor het indienen welk scherm nog onvolledig is, en springt ernaartoe.
  const onvolledig = (): { index: number; wat: string } | null => {
    for (let i = 0; i < regels.length; i++) {
      const x = regels[i];
      if (x.onvoldoendeKans) continue;
      const mist = [
        !x.contextTrigger.trim() && "context",
        x.gedrag.trim().length < 10 && "gedrag",
        !x.quoteActie.trim() && "citaat of actie",
        !x.effect.trim() && "effect",
        !x.alternatieveVerklaring.trim() && "andere verklaring",
        x.barsScore === null && "anker",
        !x.bewijskwaliteit && "bewijskwaliteit",
      ].filter(Boolean);
      if (mist.length) return { index: i, wat: mist.join(", ") };
    }
    return null;
  };
  const probeerIndienen = () => {
    const o = onvolledig();
    if (o) {
      setStap(o.index);
      toast({ title: `Hypothese ${o.index + 1} is nog onvolledig`, description: `Ontbreekt: ${o.wat}. Of duid onvoldoende observatiekans aan.`, variant: "destructive" });
      return;
    }
    dienIn.mutate(false);
  };

  const kop = (
    <>
      <AppHeader />
    </>
  );

  if (isLoading) return <div className="min-h-screen bg-background">{kop}<main className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Laden...</main></div>;
  if (error || !w) {
    return (
      <div className="min-h-screen bg-background">{kop}
        <main className="mx-auto max-w-3xl px-4 py-8 text-sm">{error ? foutTekst(error) : "Deze link is niet geldig."}</main>
      </div>
    );
  }

  const open = w.status === "OBSERVING" && !w.ingediendOp;
  const e = w.oefeningen[stap];
  const r = regels[stap];
  const alleTekst = r ? [r.contextTrigger, r.gedrag, r.quoteActie, r.effect, r.alternatieveVerklaring].join("\n") : "";
  const bewerkbaar = open || w.magCorrigeren;

  return (
    <div className="min-h-screen bg-background">
      {kop}
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold" data-testid="rf-obs-titel">H-BOM Evidence Check: {w.functieTitel}</h1>
          <p className="text-sm text-muted-foreground">
            {OBSERVATOR_ROL_LABEL[w.rol]}: {w.actorNaam}. Kandidaat: {w.kandidaatLabel}. U ziet bewust geen profiel en niets van de andere observator.
          </p>
        </div>

        {w.status === "HBOM_READY" && <Card><CardContent className="p-4 text-sm">De observatie is nog niet gestart. Probeer later opnieuw.</CardContent></Card>}
        {w.ingediendOp && (
          <Card><CardContent className="flex items-center gap-2 p-4 text-sm" data-testid="rf-obs-vergrendeld">
            <Lock className="h-4 w-4" /> Ingediend op {w.ingediendOp.slice(0, 16).replace("T", " ")}. Uw observatie is vergrendeld.
            {w.magCorrigeren ? " U kunt nog een correctie met reden indienen; die wordt een nieuwe versie." : ""}
          </CardContent></Card>
        )}

        {open && !gekalibreerd ? (
          <Kalibratie klaar={() => setGekalibreerd(true)} />
        ) : (
          e && r && (w.status !== "HBOM_READY") && (
            <Card data-testid={`rf-obs-scherm-${e.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Hypothese {stap + 1} van {w.oefeningen.length}</span>
                  <Badge variant="outline">{METHODE_LABEL[e.methode as keyof typeof METHODE_LABEL] ?? e.methode}</Badge>
                </div>
                <CardTitle className="text-base">{e.titel}</CardTitle>
                <p className="text-sm">{e.instructie}</p>
                {e.probes.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">{e.probes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                )}
                <p className="text-xs text-muted-foreground">Richttijd: ten hoogste zeven minuten invullen.</p>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {r.onvoldoendeKans ? (
                  <div className="grid gap-2 rounded-md border border-dashed p-3">
                    <p>U duidde onvoldoende observatiekans aan. Er wordt geen score gegeven.</p>
                    <Label>Waarom was er onvoldoende kans? (optioneel)</Label>
                    <Textarea disabled={!bewerkbaar} rows={2} value={r.alternatieveVerklaring} onChange={(x) => zet("alternatieveVerklaring", x.target.value)} />
                    {bewerkbaar && <Button variant="outline" size="sm" className="w-fit" onClick={() => zet("onvoldoendeKans", false)}>Toch observeren</Button>}
                  </div>
                ) : (
                  <>
                    <div><Label>Context of aanleiding</Label><Textarea disabled={!bewerkbaar} rows={2} value={r.contextTrigger} onChange={(x) => zet("contextTrigger", x.target.value)} data-testid="rf-obs-context" /></div>
                    <div><Label>Wat deed of zei de kandidaat? (concreet gedrag)</Label><Textarea disabled={!bewerkbaar} rows={3} value={r.gedrag} onChange={(x) => zet("gedrag", x.target.value)} data-testid="rf-obs-gedrag" /></div>
                    <div><Label>Letterlijk citaat of concrete actie</Label><Textarea disabled={!bewerkbaar} rows={2} value={r.quoteActie} onChange={(x) => zet("quoteActie", x.target.value)} data-testid="rf-obs-citaat" /></div>
                    <div><Label>Effect of gevolg</Label><Textarea disabled={!bewerkbaar} rows={2} value={r.effect} onChange={(x) => zet("effect", x.target.value)} data-testid="rf-obs-effect" /></div>
                    <div><Label>Mogelijke andere verklaring</Label><Textarea disabled={!bewerkbaar} rows={2} value={r.alternatieveVerklaring} onChange={(x) => zet("alternatieveVerklaring", x.target.value)} data-testid="rf-obs-alternatief" /></div>
                    <Taalcoach tekst={alleTekst} />
                    <div className="grid gap-2 border-t pt-3">
                      <Label>Anker</Label>
                      <div className="grid gap-2 md:grid-cols-3">
                        {BARS_WAARDEN.map((b) => (
                          <button
                            key={b}
                            type="button"
                            disabled={!bewerkbaar}
                            onClick={() => zet("barsScore", b)}
                            className={`rounded-md border p-2 text-left text-xs ${r.barsScore === b ? "border-primary bg-primary/10" : ""}`}
                            data-testid={`rf-obs-anker-${b}`}
                          >
                            <div className="font-medium">{b}</div>
                            {e.ankers[String(b)]}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Bewijskwaliteit:</span>
                        {BEWIJSKWALITEITEN.map((k) => (
                          <Button key={k} size="sm" variant={r.bewijskwaliteit === k ? "default" : "outline"} disabled={!bewerkbaar} onClick={() => zet("bewijskwaliteit", k)}>{BEWIJSKWALITEIT_LABEL[k]}</Button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Zekerheid:</span>
                        {CONFIDENCES.map((c) => (
                          <Button key={c} size="sm" variant={r.confidence === c ? "default" : "outline"} disabled={!bewerkbaar} onClick={() => zet("confidence", c)}>{CONFIDENCE_LABEL[c]}</Button>
                        ))}
                      </div>
                      {bewerkbaar && (
                        <Button variant="outline" size="sm" className="w-fit" onClick={() => { zet("onvoldoendeKans", true); zet("barsScore", null); }} data-testid="rf-obs-onvoldoende">
                          Onvoldoende observatiekans
                        </Button>
                      )}
                      {e.ankers.onvoldoende && <p className="text-xs text-muted-foreground">{e.ankers.onvoldoende}</p>}
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <Button variant="ghost" size="sm" disabled={stap === 0} onClick={() => setStap((s) => s - 1)}><ChevronLeft className="h-4 w-4" /> Vorige</Button>
                  {open && <Button variant="outline" size="sm" onClick={() => concept.mutate()} disabled={concept.isPending}>Concept bewaren</Button>}
                  <Button variant="ghost" size="sm" disabled={stap >= w.oefeningen.length - 1} onClick={() => setStap((s) => s + 1)} data-testid="rf-obs-volgende">Volgende <ChevronRight className="h-4 w-4" /></Button>
                </div>
                {w.magCorrigeren && (
                  <div className="grid gap-2 border-t pt-3">
                    <Label>Reden voor de correctie van deze hypothese (minstens 10 tekens)</Label>
                    <Textarea rows={2} value={correctieReden} onChange={(x) => setCorrectieReden(x.target.value)} />
                    <Button className="w-fit" disabled={correctieReden.trim().length < 10 || corrigeer.isPending} onClick={() => corrigeer.mutate()}>Correctie indienen</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        )}

        {open && gekalibreerd && (
          <Card>
            <CardContent className="grid gap-3 p-4 text-sm">
              {taalBevestiging && (
                <div className="grid gap-1 rounded-md bg-amber-50 p-3 text-amber-900" data-testid="rf-obs-taalbevestiging">
                  <p className="font-medium">De taalcoach vond interpretaties in plaats van waarnemingen:</p>
                  <ul className="list-disc pl-5">{taalBevestiging.map((t, i) => <li key={i}>"{t.fragment}": {t.uitleg}</li>)}</ul>
                  <p>Pas uw tekst aan, of bevestig bewust dat u zo wilt indienen.</p>
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => dienIn.mutate(true)}>Toch indienen</Button>
                </div>
              )}
              <p>Na het indienen is uw observatie vergrendeld. U ziet de andere observatie niet; de integratie gebeurt pas wanneer beide binnen zijn.</p>
              <Button className="w-fit" onClick={probeerIndienen} disabled={dienIn.isPending} data-testid="rf-obs-indienen">Alles indienen</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
