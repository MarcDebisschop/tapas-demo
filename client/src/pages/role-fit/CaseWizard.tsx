// ---------------------------------------------------------------------------
// CaseWizard: de contextwizard (stappen 1 tot 6 van het bouwplan) en de
// bronnen (vacaturetekst, organisatie-URL, PDF/DOCX/TXT). Niets wat hier
// ingevoerd wordt is actief: de extractie maakt enkel voorstellen, die in
// ContextReview door een mens goedgekeurd worden.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Link2, Trash2, Upload, Wand2 } from "lucide-react";
import { type CaseWeergave, foutTekst, herlaadCase, rfDelete, rfPost, rfPut } from "./api";

type Veld = { sleutel: string; label: string; lang?: boolean };
const STAPPEN: Array<{ titel: string; groep: string | null; velden: Veld[] }> = [
  { titel: "1. Doel en besliscontext", groep: null, velden: [{ sleutel: "doel", label: "Waarover wordt beslist, en waarom nu?", lang: true }] },
  {
    titel: "2. Rolmissie en verwachtingen",
    groep: null,
    velden: [
      { sleutel: "missie", label: "Rolmissie in een of twee zinnen", lang: true },
      { sleutel: "verwachting90", label: "Wat is er na 90 dagen zichtbaar?", lang: true },
      { sleutel: "verwachting180", label: "Na 180 dagen", lang: true },
      { sleutel: "verwachting365", label: "Na een jaar", lang: true },
    ],
  },
  {
    titel: "4. Omgeving",
    groep: "omgeving",
    velden: [
      { sleutel: "sector", label: "Sector" },
      { sleutel: "schaal", label: "Schaal" },
      { sleutel: "regulering", label: "Regulering" },
      { sleutel: "risico", label: "Risico" },
      { sleutel: "tempo", label: "Tempo" },
      { sleutel: "autonomie", label: "Autonomie" },
      { sleutel: "veranderfase", label: "Veranderfase" },
    ],
  },
  {
    titel: "5. Organisatiecontext",
    groep: "organisatie",
    velden: [
      { sleutel: "waardenInActie", label: "Waarden in actie (wat men concreet doet)", lang: true },
      { sleutel: "besluitstijl", label: "Besluitstijl" },
      { sleutel: "conflictstijl", label: "Omgang met conflict" },
      { sleutel: "leiderschapscontext", label: "Leiderschapscontext", lang: true },
    ],
  },
  {
    titel: "6. Team en stakeholders",
    groep: "team",
    velden: [
      { sleutel: "rapportering", label: "Rapporteert aan" },
      { sleutel: "teamgrootte", label: "Teamgrootte" },
      { sleutel: "maturiteit", label: "Maturiteit van het team" },
      { sleutel: "stakeholders", label: "Belangrijkste stakeholders", lang: true },
    ],
  },
];

function leesBestand(file: File): Promise<string> {
  return new Promise((ok, fout) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      ok(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => fout(new Error("Bestand kon niet gelezen worden."));
    r.readAsDataURL(file);
  });
}

export default function CaseWizard({ v, magBewerken }: { v: CaseWeergave; magBewerken: boolean }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const bewerkbaar = magBewerken && (v.zaak.status === "DRAFT" || v.zaak.status === "CONTEXT_REVIEW");
  const [w, setW] = useState<any>(v.wizard ?? {});
  const [resultaten, setResultaten] = useState<string>((v.wizard?.resultaten ?? []).join("\n"));
  const [tekst, setTekst] = useState("");
  const [titel, setTitel] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setW(v.wizard ?? {});
    setResultaten((v.wizard?.resultaten ?? []).join("\n"));
  }, [v.wizard]);

  const zet = (groep: string | null, sleutel: string, waarde: string) =>
    setW((o: any) => (groep ? { ...o, [groep]: { ...(o[groep] ?? {}), [sleutel]: waarde } } : { ...o, [sleutel]: waarde }));

  const fout = (titel: string) => (e: unknown) => toast({ title: titel, description: foutTekst(e), variant: "destructive" });

  const bewaar = useMutation({
    mutationFn: () => {
      const lijst = resultaten.split("\n").map((s) => s.trim()).filter(Boolean);
      return rfPut(`/cases/${id}/wizard`, { ...w, resultaten: lijst });
    },
    onSuccess: () => { toast({ title: "Wizard bewaard" }); herlaadCase(id); },
    onError: fout("Niet bewaard"),
  });
  const voegTekstToe = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/bronnen`, { type: "text", titel: titel || undefined, tekst }),
    onSuccess: () => { setTekst(""); setTitel(""); herlaadCase(id); },
    onError: fout("Tekst niet toegevoegd"),
  });
  const voegUrlToe = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/bronnen`, { type: "url", url }),
    onSuccess: () => { setUrl(""); herlaadCase(id); },
    onError: fout("Pagina niet opgehaald"),
  });
  const voegBestandToe = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.toLowerCase().split(".").pop();
      const type = ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : "txt";
      if (file.size > 700 * 1024) throw new Error("0: Het bestand is groter dan 700 kB.");
      return rfPost(`/cases/${id}/bronnen`, { type, bestandsnaam: file.name, inhoudBase64: await leesBestand(file) });
    },
    onSuccess: () => herlaadCase(id),
    onError: fout("Bestand niet toegevoegd"),
  });
  const verwijder = useMutation({
    mutationFn: (bronId: number) => rfDelete(`/cases/${id}/bronnen/${bronId}`),
    onSuccess: () => herlaadCase(id),
    onError: fout("Bron niet verwijderd"),
  });
  const extraheer = useMutation({
    mutationFn: () => rfPost(`/cases/${id}/context/extraheer`),
    onSuccess: (r: any) => {
      const via = r?.modus === "ai" ? "met AI" : "met de regels (zonder AI)";
      const extra = r?.fout ? ` De AI was niet bruikbaar: ${r.fout}` : "";
      toast({ title: "Voorstellen klaar", description: `${r?.voorstellen ?? 0} voorstellen, gemaakt ${via}. Beoordeel ze bij Contextreview.${extra}` });
      herlaadCase(id);
    },
    onError: fout("Extractie mislukt"),
  });

  return (
    <div className="grid gap-4">
      {!bewerkbaar && (
        <p className="text-sm text-muted-foreground">De context is bevroren of u hebt geen bewerkrecht. De wizard is alleen-lezen.</p>
      )}
      {STAPPEN.map((s) => (
        <Card key={s.titel}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{s.titel}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {s.velden.map((vd) => {
              const waarde = (s.groep ? w?.[s.groep]?.[vd.sleutel] : w?.[vd.sleutel]) ?? "";
              return (
                <div key={vd.sleutel} className={vd.lang ? "md:col-span-2" : ""}>
                  <Label>{vd.label}</Label>
                  {vd.lang ? (
                    <Textarea disabled={!bewerkbaar} value={waarde} onChange={(e) => zet(s.groep, vd.sleutel, e.target.value)} data-testid={`rf-w-${vd.sleutel}`} />
                  ) : (
                    <Input disabled={!bewerkbaar} value={waarde} onChange={(e) => zet(s.groep, vd.sleutel, e.target.value)} data-testid={`rf-w-${vd.sleutel}`} />
                  )}
                </div>
              );
            })}
            {s.titel.startsWith("2.") && (
              <div className="md:col-span-2">
                <Label>Verwachte resultaten (5 tot 8, een per regel)</Label>
                <Textarea disabled={!bewerkbaar} rows={5} value={resultaten} onChange={(e) => setResultaten(e.target.value)} data-testid="rf-w-resultaten" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        Stap 3 (instap- versus ontwikkelbare vereisten), stap 7 (knock-outgates) en stap 8 (review en freeze) staan bij Contextreview.
      </p>
      {bewerkbaar && (
        <div className="flex justify-end">
          <Button onClick={() => bewaar.mutate()} disabled={bewaar.isPending} data-testid="rf-wizard-bewaar">Wizard bewaren</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Bronnen</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {v.bronnen.length === 0 && <p className="text-sm text-muted-foreground">Nog geen bronnen.</p>}
          {v.bronnen.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <div className="flex items-center gap-2">
                {b.type === "url" ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                <span className="font-medium">{b.titel || b.url || `Bron ${b.id}`}</span>
                <Badge variant="outline">{b.type}</Badge>
                <span className="text-muted-foreground">{b.lengte} tekens</span>
              </div>
              {bewerkbaar && b.type !== "wizard" && (
                <Button size="sm" variant="ghost" onClick={() => verwijder.mutate(b.id)} aria-label="Bron verwijderen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {bewerkbaar && (
            <>
              <div className="grid gap-2">
                <Label>Vacaturetekst of andere tekst</Label>
                <Input placeholder="Titel (optioneel)" value={titel} onChange={(e) => setTitel(e.target.value)} />
                <Textarea rows={5} value={tekst} onChange={(e) => setTekst(e.target.value)} data-testid="rf-bron-tekst" />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!tekst.trim() || voegTekstToe.isPending} onClick={() => voegTekstToe.mutate()} data-testid="rf-bron-tekst-toevoegen">Tekst toevoegen</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Organisatiepagina (URL)</Label>
                <div className="flex gap-2">
                  <Input placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <Button size="sm" disabled={!url.trim() || voegUrlToe.isPending} onClick={() => voegUrlToe.mutate()}>Ophalen</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Document (PDF, DOCX of TXT, ten hoogste 700 kB)</Label>
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Bestand kiezen
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) voegBestandToe.mutate(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  De extractie leest de wizard en de bronnen en maakt voorstellen met een letterlijke bronpassage. Geen enkel voorstel is actief zonder uw goedkeuring.
                </p>
                <Button onClick={() => extraheer.mutate()} disabled={extraheer.isPending} data-testid="rf-extraheer">
                  <Wand2 className="mr-1 h-4 w-4" /> Voorstellen maken
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
