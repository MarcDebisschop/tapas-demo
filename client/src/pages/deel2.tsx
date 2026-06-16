import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientInstrument, Afname } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";

export default function Deel2() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [vals, setVals] = useState<Record<string, number>>({ q1: 5, q2: 5, q3: 5, q4: 5 });

  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  const { data: inst, isLoading } = useQuery<ClientInstrument>({
    queryKey: ["/api/instrument", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/instrument?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });
  const questions = inst?.connectionQuestions ?? [];

  async function finish() {
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/afnames/${id}/connection`, {
        answers: { q1: vals.q1, q2: vals.q2, q3: vals.q3, q4: vals.q4 },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      navigate(`/afname/${id}/klaar`);
    } catch (e: any) {
      toast({ title: t("fout_afronden_titel"), description: String(e.message ?? e), variant: "destructive" });
      setSubmitting(false);
    }
  }

  // Vergrendeling: een voltooide afname mag deel 2 niet opnieuw invullen.
  if (afname?.status === "voltooid") {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent" />
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-al-voltooid-titel">
                {t("deel1_al_voltooid_titel")}
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">{t("deel1_al_voltooid_tekst")}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading || !inst) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<span className="text-sm text-muted-foreground">{t("deel2_voortgang")}</span>} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("deel2_titel")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("deel2_intro")}</p>

        <div className="mt-6 space-y-4">
          {questions.map((q, i) => (
            <Card key={q.id} data-testid={`card-vraag-${q.id}`}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-accent">{q.label}</p>
                    <p className="mt-1 text-sm text-foreground">{q.text}</p>
                  </div>
                  <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary" data-testid={`value-${q.id}`}>
                    {vals[q.id]}
                  </span>
                </div>
                <Slider
                  value={[vals[q.id]!]}
                  onValueChange={(v) => setVals((p) => ({ ...p, [q.id]: v[0]! }))}
                  min={0}
                  max={10}
                  step={1}
                  data-testid={`slider-${q.id}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>10</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button onClick={finish} disabled={submitting} size="lg" className="mt-6 w-full" data-testid="button-finish">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {submitting ? t("knop_genereren_bezig") : t("knop_afronden")}
        </Button>
      </main>
    </div>
  );
}
