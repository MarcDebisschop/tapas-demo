// ---------------------------------------------------------------------------
// CaseDetail: de schil rond een Role Fit-case (route /admin/role-fit/:id).
// Bovenaan de status en de waarschuwingen, daaronder een tab per fase:
// wizard, contextreview, fit dossier, evidence check, convergentie, besluit.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { BESLISDOEL_LABEL, CASE_STATUS_LABEL, type CaseStatus } from "@shared/role-fit";
import { type CaseWeergave, caseSleutel, foutTekst, rfDelete } from "./api";
import CaseWizard from "./CaseWizard";
import ContextReview from "./ContextReview";
import FitDossier from "./FitDossier";
import HbomSetup from "./HbomSetup";
import Convergence from "./Convergence";
import DecisionRoom from "./DecisionRoom";

function standaardTab(status: string): string {
  if (status === "DRAFT") return "wizard";
  if (status === "CONTEXT_REVIEW") return "context";
  if (status === "CONTEXT_FROZEN" || status === "HBOM_READY" || status === "OBSERVING") return "hbom";
  if (status === "OBSERVATIONS_LOCKED" || status === "INTEGRATION_REVIEW") return "convergentie";
  return "besluit";
}

export default function RoleFitCaseDetail() {
  const [, params] = useRoute("/admin/role-fit/:id");
  const id = params?.id ?? "";
  const { toast } = useToast();
  const [, naar] = useLocation();
  const { data: v, isLoading, error } = useQuery<CaseWeergave>({ queryKey: caseSleutel(id), enabled: !!id });
  const [tab, setTab] = useState<string | null>(null);

  const wis = useMutation({
    mutationFn: () => rfDelete(`/cases/${id}`),
    onSuccess: () => { toast({ title: "Case verwijderd" }); naar("/admin/role-fit"); },
    onError: (e) => toast({ title: "Niet verwijderd", description: foutTekst(e), variant: "destructive" }),
  });

  const rollen = new Set(v?.rollen ?? []);
  const eigenaar = rollen.has("owner") || rollen.has("prior");
  const magContext = eigenaar || rollen.has("recruiter") || rollen.has("hiring_manager");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/admin/role-fit">
          <a className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Alle cases
          </a>
        </Link>
        {isLoading && <p className="text-sm text-muted-foreground">Laden...</p>}
        {error && <p className="text-sm text-destructive">{foutTekst(error)}</p>}
        {v && (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold" data-testid="rf-case-titel">{v.zaak.functieTitel}</h1>
                <p className="text-sm text-muted-foreground">
                  {v.zaak.kandidaatLabel}, {BESLISDOEL_LABEL[v.zaak.beslisdoel as keyof typeof BESLISDOEL_LABEL]}, bewaren tot {v.zaak.bewaarTot}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge data-testid="rf-status">{CASE_STATUS_LABEL[v.zaak.status as CaseStatus] ?? v.zaak.status}</Badge>
                {eigenaar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { if (window.confirm("De case en alle bijhorende gegevens definitief verwijderen?")) wis.mutate(); }}
                    aria-label="Case verwijderen"
                    data-testid="rf-verwijder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {v.waarschuwingen.map((w, i) => (
              <Card key={i} className="mb-3 border-amber-300">
                <CardContent className="flex items-start gap-2 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /> {w}</CardContent>
              </Card>
            ))}
            <p className="mb-4 text-xs text-muted-foreground">
              Dit is beslisondersteuning. Het systeem geeft geen totaalcijfer, geen percentage en geen besluit. Profieldata zijn zelfrapportage en worden als hypothese gebruikt.
            </p>
            <Tabs value={tab ?? standaardTab(v.zaak.status)} onValueChange={setTab}>
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="wizard">Wizard</TabsTrigger>
                <TabsTrigger value="context">Contextreview</TabsTrigger>
                <TabsTrigger value="fit">Fit Dossier</TabsTrigger>
                <TabsTrigger value="hbom">Evidence Check</TabsTrigger>
                <TabsTrigger value="convergentie">Convergentie</TabsTrigger>
                <TabsTrigger value="besluit">Besluit</TabsTrigger>
              </TabsList>
              <TabsContent value="wizard"><CaseWizard v={v} magBewerken={magContext} /></TabsContent>
              <TabsContent value="context"><ContextReview v={v} /></TabsContent>
              <TabsContent value="fit"><FitDossier v={v} /></TabsContent>
              <TabsContent value="hbom"><HbomSetup v={v} /></TabsContent>
              <TabsContent value="convergentie"><Convergence v={v} /></TabsContent>
              <TabsContent value="besluit"><DecisionRoom v={v} /></TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
