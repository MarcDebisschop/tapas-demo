// ---------------------------------------------------------------------------
// Rapporten: een rapport (opnieuw) laten maken en de bewaarde versies openen.
// De server hergebruikt een versie wanneer de invoer niet veranderde; dezelfde
// invoer geeft dus altijd hetzelfde rapport.
// ---------------------------------------------------------------------------
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileDown, FileText } from "lucide-react";
import { RAPPORT_TYPE_LABEL, type RapportType } from "@shared/role-fit";
import { type CaseWeergave, artefactUrl, foutTekst, herlaadCase, rfPost } from "./api";

export default function Rapporten({ v, types }: { v: CaseWeergave; types: RapportType[] }) {
  const { toast } = useToast();
  const id = v.zaak.id;
  const maak = useMutation({
    mutationFn: (type: RapportType) => rfPost(`/cases/${id}/rapporten/${type}`),
    onSuccess: (r: any) => {
      toast({ title: r.hergebruikt ? "Rapport ongewijzigd" : `Rapport versie ${r.versie} gemaakt`, description: r.heeftPdf ? undefined : "Er is geen PDF gemaakt; de HTML-versie is beschikbaar." });
      herlaadCase(id);
    },
    onError: (e) => toast({ title: "Rapport niet gemaakt", description: foutTekst(e), variant: "destructive" }),
  });

  if (v.semiBlind) return null;
  return (
    <div className="grid gap-3">
      {types.map((t) => {
        const versies = v.artefacten.filter((a) => a.type === t).sort((a, b) => b.versie - a.versie);
        return (
          <div key={t} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{RAPPORT_TYPE_LABEL[t]}</div>
              <Button size="sm" onClick={() => maak.mutate(t)} disabled={maak.isPending} data-testid={`rf-rapport-${t}`}>
                <FileText className="mr-1 h-4 w-4" /> Rapport maken
              </Button>
            </div>
            {versies.length > 0 && (
              <ul className="mt-2 grid gap-1 text-sm">
                {versies.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3">
                    <span>Versie {a.versie}, {a.createdAt?.slice(0, 16).replace("T", " ")}</span>
                    <a className="underline" href={artefactUrl(id, a.id, "html")} target="_blank" rel="noreferrer">Openen</a>
                    {a.heeftPdf && (
                      <a className="inline-flex items-center gap-1 underline" href={artefactUrl(id, a.id, "pdf")}>
                        <FileDown className="h-3.5 w-3.5" /> PDF
                      </a>
                    )}
                    <span className="font-mono text-xs text-muted-foreground" title="Invoerhash">{String(a.inputHash).slice(0, 12)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
