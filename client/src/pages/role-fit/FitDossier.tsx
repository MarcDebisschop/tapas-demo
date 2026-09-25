// ---------------------------------------------------------------------------
// FitDossier: de fitkaart per vereiste op twee onafhankelijke assen
// (fitindicatie en zekerheid van het bewijs), met energie, ontwikkelafstand,
// alternatieve verklaringen, onbekenden en verificatievragen. Geen totaalcijfer
// en geen percentage: dat is een bewuste keuze van de module.
// ---------------------------------------------------------------------------
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BEWIJSSOORT_LABEL,
  CONFIDENCE_LABEL,
  DIMENSIES,
  FIT_INDICATIE_LABEL,
  FIT_TYPE_LABEL,
  KRITICITEIT_LABEL,
  ONTWIKKELAFSTAND_LABEL,
} from "@shared/role-fit";
import { type CaseWeergave, bereikt } from "./api";
import Rapporten from "./Rapporten";

const KLEUR: Record<string, string> = {
  strong_support: "bg-emerald-100 text-emerald-900",
  likely_support: "bg-emerald-50 text-emerald-900",
  mixed: "bg-amber-50 text-amber-900",
  likely_friction: "bg-rose-50 text-rose-900",
  not_assessable: "bg-slate-100 text-slate-700",
};

const ENERGIE: Record<string, string> = { geeft: "Geeft energie", neutraal: "Neutraal", kost: "Kost energie" };

export function BewijsLegende() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="rf-legende">
      <span className="font-medium">Soorten bewijs:</span>
      {Object.entries(BEWIJSSOORT_LABEL).map(([k, l]) => <Badge key={k} variant="outline">{l}</Badge>)}
    </div>
  );
}

export default function FitDossier({ v }: { v: CaseWeergave }) {
  if (v.semiBlind) {
    return (
      <Card><CardContent className="p-5 text-sm text-muted-foreground" data-testid="rf-semiblind">
        U observeert in deze case. Tot beide observaties ingediend zijn, ziet u het profiel en de fitkaart niet: zo blijft uw observatie onafhankelijk.
      </CardContent></Card>
    );
  }
  if (!bereikt(v.zaak.status, "CONTEXT_FROZEN")) {
    return <p className="text-sm text-muted-foreground">Het Fit Dossier verschijnt zodra de context bevroren is.</p>;
  }
  const vereisten = new Map(v.vereisten.map((r) => [r.id, r]));
  return (
    <div className="grid gap-4">
      <BewijsLegende />
      <p className="text-sm text-muted-foreground">
        Elke kaart toont twee assen: de richting van de signalen en hoe zeker dat bewijs is. Profielgegevens zijn zelfrapportage; ze zijn een hypothese, geen vaststelling.
      </p>
      <div className="grid gap-3">
        {v.fitItems.map((f) => {
          const r = vereisten.get(f.requirementId);
          const d = f.detail ?? {};
          return (
            <Card key={f.id} data-testid={`rf-fit-${f.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{r?.vereiste ?? `Vereiste ${f.requirementId}`}</CardTitle>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${KLEUR[f.indicatie] ?? ""}`}>{FIT_INDICATIE_LABEL[f.indicatie as keyof typeof FIT_INDICATIE_LABEL]}</span>
                  <Badge variant="outline">Zekerheid: {CONFIDENCE_LABEL[f.confidence as keyof typeof CONFIDENCE_LABEL]}</Badge>
                  <Badge variant="outline">{KRITICITEIT_LABEL[f.kriticiteit as keyof typeof KRITICITEIT_LABEL]}</Badge>
                  {!d.gate && <Badge variant="outline">{DIMENSIES.find((x) => x.id === r?.dimensie)?.label ?? r?.dimensie}</Badge>}
                  <Badge variant="outline">{FIT_TYPE_LABEL[f.fitType as keyof typeof FIT_TYPE_LABEL]}</Badge>
                  {f.energie && <Badge variant="outline">{ENERGIE[f.energie] ?? f.energie}</Badge>}
                  <Badge variant="outline">Ontwikkelafstand: {ONTWIKKELAFSTAND_LABEL[f.ontwikkelafstand as keyof typeof ONTWIKKELAFSTAND_LABEL]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {(d.uitleg ?? []).length > 0 && <ul className="list-disc pl-5">{d.uitleg.map((u: string, i: number) => <li key={i}>{u}</li>)}</ul>}
                {(d.alternatieveVerklaringen ?? []).length > 0 && (
                  <div><span className="font-medium">Andere verklaringen: </span>{d.alternatieveVerklaringen.join("; ")}</div>
                )}
                {(d.onbekenden ?? []).length > 0 && <div><span className="font-medium">Nog onbekend: </span>{d.onbekenden.join("; ")}</div>}
                {(d.verificatievragen ?? []).length > 0 && (
                  <div>
                    <span className="font-medium">Te verifieren:</span>
                    <ul className="list-disc pl-5">{d.verificatievragen.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">Regelversie {f.regelversie}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Rapporten v={v} types={["fit-dossier"]} />
    </div>
  );
}
