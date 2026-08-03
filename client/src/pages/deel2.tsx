import { useMemo, useState } from "react";
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
import { ontbrekendeSchaalvragen } from "@shared/verplicht-antwoorden";
import { bewijsSleutel } from "@/pages/klaar";
import { useEffect } from "react";

/**
 * De stand waarop een nog niet aangeraakte regelaar getoond wordt. Dit is enkel
 * een beeld: zolang de deelnemer de regelaar niet zelf gezet heeft, geldt de
 * vraag als onbeantwoord en blijft de knop afronden dicht.
 */
const MIDDEN = 5;

export default function Deel2() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  // De regelaars starten leeg. Vroeger stonden ze op 5, waardoor een deelnemer
  // die niets aanraakte toch vier antwoorden inleverde die hij nooit gegeven
  // heeft.
  const [vals, setVals] = useState<Record<string, number | null>>({});

  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  // Instrumenten zonder eigen deel 2 (organisatieverbondenheid horen niet bij
  // T4Teens/T4Kids/T4Students, zie bevindingen-punt-a-instrumentkaart.md) mogen
  // dit scherm nooit tonen, ook niet als iemand hier rechtstreeks naartoe
  // navigeert. Dit is de tweede, client-zijdige laag onder de serverlaag in
  // routes/afnames.ts (GEEN_EIGEN_DEEL2): een deelnemer krijgt zo nooit de
  // vragen van een ander instrument te zien.
  const GEEN_EIGEN_DEEL2 = new Set(["t4teens", "t4kids", "t4students"]);
  useEffect(() => {
    if (afname && GEEN_EIGEN_DEEL2.has(afname.instrumentId ?? "")) {
      navigate(`/afname/${id}/klaar`, { replace: true });
    }
  }, [afname, id, navigate]);

  const { data: inst, isLoading } = useQuery<ClientInstrument>({
    queryKey: ["/api/instrument", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/instrument?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });
  const questions = inst?.connectionQuestions ?? [];

  // Verplicht doorklikken: afronden kan pas als elke regelaar echt gezet is.
  const nogOpen = useMemo(
    () => ontbrekendeSchaalvragen(questions.map((q) => q.id), vals),
    [questions, vals],
  );
  const alleBeantwoord = questions.length > 0 && nogOpen.length === 0;

  async function finish() {
    if (!alleBeantwoord) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/afnames/${id}/connection`, {
        answers: { q1: vals.q1, q2: vals.q2, q3: vals.q3, q4: vals.q4 },
      });
      // K-1 (audit): het eindscherm koppelt enkel met een bezitsbewijs. De
      // Het bezitsToken komt hier mee in het afrondantwoord; we bewaren het in de
      // tabbladopslag zodat het eindscherm ze kan meesturen zonder dat de
      // publieke afnameroute ze aan iedereen hoeft prijs te geven.
      try {
        const uitkomst = await res.json();
        const code = uitkomst?.afname?.bezitsToken;
        if (typeof code === "string" && code) {
          window.sessionStorage.setItem(bewijsSleutel(id), code);
        }
      } catch {
        // Mislukt bewaren mag het afronden nooit blokkeren.
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      queryClient.invalidateQueries({ queryKey: ["/api/afnames", id] });
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
                  <span
                    className={
                      vals[q.id] == null
                        ? "rounded-md bg-muted px-2.5 py-1 text-sm font-semibold text-muted-foreground"
                        : "rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary"
                    }
                    data-testid={`value-${q.id}`}
                  >
                    {vals[q.id] ?? "?"}
                  </span>
                </div>
                <Slider
                  value={[vals[q.id] ?? MIDDEN]}
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
                {vals[q.id] == null && (
                  <p className="text-xs text-muted-foreground" data-testid={`hint-${q.id}`}>
                    {t("schaal_nog_te_zetten")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {!alleBeantwoord && questions.length > 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground" data-testid="text-nog-open">
            {t("schaal_nog_open")
              .replace("{aantal}", String(nogOpen.length))
              .replace("{totaal}", String(questions.length))}
          </p>
        )}

        <Button onClick={finish} disabled={submitting || !alleBeantwoord} size="lg" className="mt-6 w-full" data-testid="button-finish">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {submitting ? t("knop_genereren_bezig") : t("knop_afronden")}
        </Button>
      </main>
    </div>
  );
}
