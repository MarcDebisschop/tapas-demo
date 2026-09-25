// ---------------------------------------------------------------------------
// HbomSetup: de H-BOM Evidence Check opstellen. De engine stelt een pool van
// hypothesen voor (kritisch, onzeker, observeerbaar, niet beter met een toets
// te onderzoeken); de eigenaar kiest Light of Standard, past de selectie aan en
// keurt goed. De observatorlinks worden daarna EENMALIG getoond.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Copy, Play, RefreshCw } from "lucide-react";
import {
  KRITICITEIT_LABEL,
  METHODE_LABEL,
  NIVEAU_HML_LABEL,
  OBSERVATOR_ROL_LABEL,
  PAKKETTEN,
  PAKKET_LABEL,
  type Pakket,
} from "@shared/role-fit";
import { type CaseWeergave, bereikt, foutTekst, herlaadCase, rfPost } from "./api";
import Rapporten from "./Rapporten";

function volledigeLink(pad: string): string {
  return typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${pad}` : pad;
}

export default function HbomSetup({ v }: { v: CaseWeergave }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const rollen = new Set(v.rollen);
  const eigenaar = rollen.has("owner") || rollen.has("prior");
  const bevroren = v.zaak.status === "CONTEXT_FROZEN";
  const [selectie, setSelectie] = useState<number[]>([]);
  const [links, setLinks] = useState<Record<string, string> | null>(null);
  const fout = (t: string) => (e: unknown) => toast({ title: t, description: foutTekst(e), variant: "destructive" });

  useEffect(() => {
    setSelectie(v.hypothesen.filter((h) => h.geselecteerd).map((h) => h.id));
  }, [v.hypothesen]);

  const voorstel = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/hbom/voorstel`),
    onSuccess: (r: any) => {
      toast({ title: `Pool van ${r.pool} hypothesen`, description: (r.waarschuwingen ?? []).join(" ") || undefined });
      herlaadCase(id);
    },
    onError: fout("Geen voorstel"),
  });
  const pakket = useMutation({
    mutationFn: (p: Pakket) => rfPost(`/cases/${id}/hbom/pakket`, { pakket: p }),
    onSuccess: (r: any) => { setSelectie(r.standaardSelectie); herlaadCase(id); },
    onError: fout("Pakket niet gekozen"),
  });
  const keurGoed = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/hbom/goedkeuren`, { hypotheseIds: selectie }),
    onSuccess: (r: any) => { setLinks(r.links); herlaadCase(id); },
    onError: fout("Niet goedgekeurd"),
  });
  const nieuweLink = useMutation({
    mutationFn: (rol: string) => rfPost(`/cases/${id}/opdrachten/${rol}/nieuwe-link`),
    onSuccess: (r: any, rol) => { setLinks((o) => ({ ...(o ?? {}), [rol]: r.link })); herlaadCase(id); },
    onError: fout("Geen nieuwe link"),
  });
  const start = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/hbom/start`),
    onSuccess: () => { toast({ title: "Observatie gestart" }); herlaadCase(id); },
    onError: fout("Niet gestart"),
  });

  if (!bereikt(v.zaak.status, "CONTEXT_FROZEN")) {
    return <p className="text-sm text-muted-foreground">De Evidence Check wordt opgesteld nadat de context bevroren is.</p>;
  }

  const kopieer = async (tekst: string) => {
    try {
      await navigator.clipboard.writeText(tekst);
      toast({ title: "Link gekopieerd" });
    } catch {
      toast({ title: "Kopieer de link met de hand", description: tekst });
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        H-BOM Evidence Check: een korte, gerichte observatie van enkele hypothesen. Het is geen assessment center en vervangt er geen.
      </p>
      {bevroren && eigenaar && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Button variant="outline" onClick={() => voorstel.mutate()} disabled={voorstel.isPending} data-testid="rf-hbom-voorstel">
              <RefreshCw className="mr-1 h-4 w-4" /> Hypothesen voorstellen
            </Button>
            {v.hypothesen.length > 0 &&
              PAKKETTEN.map((p) => (
                <Button
                  key={p}
                  variant={v.zaak.pakket === p ? "default" : "outline"}
                  disabled={p === "standard" && v.hypothesen.length < 4}
                  title={p === "standard" && v.hypothesen.length < 4 ? "Te weinig hypothesen voor Standard: leg meer vereisten vast of kies Light." : undefined}
                  onClick={() => pakket.mutate(p)}
                  data-testid={`rf-pakket-${p}`}
                >
                  {PAKKET_LABEL[p]}
                </Button>
              ))}
          </CardContent>
        </Card>
      )}

      {v.hypothesen.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Hypothesen</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {v.hypothesen.map((h) => {
              const aan = selectie.includes(h.id);
              return (
                <label key={h.id} className="flex items-start gap-3 rounded-md border p-3 text-sm" data-testid={`rf-hyp-${h.id}`}>
                  {bevroren && eigenaar && (
                    <Checkbox
                      checked={aan}
                      onCheckedChange={(x) => setSelectie((s) => (x === true ? [...s, h.id] : s.filter((y) => y !== h.id)))}
                    />
                  )}
                  <div className="grid gap-1">
                    <div className="font-medium">{h.stelling}</div>
                    <div className="text-muted-foreground">Tegenhypothese: {h.tegenhypothese}</div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant="outline">{METHODE_LABEL[h.methode as keyof typeof METHODE_LABEL] ?? h.methode}</Badge>
                      <Badge variant="outline">{KRITICITEIT_LABEL[h.kriticiteit as keyof typeof KRITICITEIT_LABEL]}</Badge>
                      <Badge variant="outline">Observeerbaar: {NIVEAU_HML_LABEL[h.observeerbaarheid as keyof typeof NIVEAU_HML_LABEL]}</Badge>
                      {h.onzekerheid && <Badge variant="outline">Onzekerheid: {NIVEAU_HML_LABEL[h.onzekerheid as keyof typeof NIVEAU_HML_LABEL]}</Badge>}
                    </div>
                    {h.verbodenInferentie && <div className="text-xs text-muted-foreground">Niet afleiden: {h.verbodenInferentie}</div>}
                  </div>
                </label>
              );
            })}
            {bevroren && eigenaar && v.zaak.pakket && (
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-sm text-muted-foreground">{selectie.length} gekozen.</span>
                <Button onClick={() => keurGoed.mutate()} disabled={keurGoed.isPending} data-testid="rf-hbom-goedkeuren">Selectie goedkeuren</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {v.oefeningen.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Observatoren</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {links && (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">Deze links worden maar een keer getoond. Bezorg ze nu aan de observatoren.</p>
            )}
            {v.opdrachten.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <div>
                  <span className="font-medium">{OBSERVATOR_ROL_LABEL[o.rol as keyof typeof OBSERVATOR_ROL_LABEL]}</span>: {o.actorNaam}
                  <span className="ml-2 text-muted-foreground">{o.ingediendOp ? `ingediend ${o.ingediendOp.slice(0, 10)}` : `open tot ${String(o.verlooptOp).slice(0, 10)}`}</span>
                </div>
                <div className="flex gap-2">
                  {links?.[o.rol] && (
                    <Button size="sm" variant="outline" onClick={() => kopieer(volledigeLink(links[o.rol]))} data-testid={`rf-link-${o.rol}`}>
                      <Copy className="mr-1 h-4 w-4" /> Link kopieren
                    </Button>
                  )}
                  {eigenaar && !o.ingediendOp && (v.zaak.status === "HBOM_READY" || v.zaak.status === "OBSERVING") && (
                    <Button size="sm" variant="ghost" onClick={() => nieuweLink.mutate(o.rol)}>Nieuwe link</Button>
                  )}
                </div>
              </div>
            ))}
            {v.zaak.status === "HBOM_READY" && eigenaar && (
              <div className="flex justify-end">
                <Button onClick={() => start.mutate()} disabled={start.isPending} data-testid="rf-hbom-start"><Play className="mr-1 h-4 w-4" /> Observatie starten</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Rapporten v={v} types={["hbom-guide"]} />
    </div>
  );
}
