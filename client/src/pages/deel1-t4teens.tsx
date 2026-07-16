/**
 * client/src/pages/deel1-t4teens.tsx
 *
 * NIEUW BESTAND — Werkprotocol Regel 2 (strikt additief, aparte code-tak).
 *
 * T4Teens-specifieke deel-1-render. Legt de vonk-Likert PER ITEM vast (battery /
 * recognition / recognition+energy / sjt / interest / meaning) i.p.v. de generieke
 * most/least-engine. De gekozen waarden worden in een T4Teens-specifiek
 * antwoordobject `{ answers, energy }` (gekeyd op korte vonk-id's) naar
 * POST /api/afnames/:id/main gestuurd, dat het Studiekompas voedt bij voltooiing.
 *
 * De klassieke Deel1-component (client/src/pages/deel1.tsx) blijft ONGEWIJZIGD voor
 * alle andere instrumenten; deze component wordt daar enkel voor instrumentId
 * "t4teens" gerenderd.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { AfnameVoortgang } from "@/components/AfnameVoortgang";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientInstrument, ClientBlock, Afname, T4TeensVonkOption } from "@/lib/types";
import { ChevronLeft, ChevronRight, Check, CheckCircle2 } from "lucide-react";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";

type VonkAnswers = Record<string, number | string>;
type VonkEnergy = Record<string, number>;

// Keuze-rij (recognition / interest / sjt / meaning). Waarden zijn getal of string.
function KeuzeRij({
  options,
  value,
  onChange,
  testidPrefix,
}: {
  options: T4TeensVonkOption[];
  value: number | string | null;
  onChange: (v: number | string) => void;
  testidPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const v: number | string = "value" in o ? o.value : o.key;
        const active = value === v;
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            title={o.label}
            data-testid={`${testidPrefix}-${v}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover-elevate"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Deel1T4Teens({ id, afname }: { id: number; afname: Afname }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<VonkAnswers>({});
  const [energy, setEnergy] = useState<VonkEnergy>({});
  const [submitting, setSubmitting] = useState(false);
  const [conceptStatus, setConceptStatus] = useState<"idle" | "bezig" | "bewaard">("idle");
  const [hervat, setHervat] = useState(false);
  const geladenRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);

  const { data: inst, isLoading } = useQuery<ClientInstrument>({
    queryKey: ["/api/vragenlijst/tapas-t4teens", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vragenlijst/tapas-t4teens?taal=${taal}`);
      return res.json();
    },
  });

  const blocks = inst?.blocks ?? [];
  const block: ClientBlock | undefined = blocks[idx];
  const meta = block?.t4teens ?? null;
  const vonkId = meta?.vonkId ?? "";

  // Herstel eerder (tussentijds) bewaarde vonk-antwoorden zodra afname + instrument
  // geladen zijn. Eenmalig (geladenRef) zodat lokale wijzigingen niet overschreven worden.
  useEffect(() => {
    if (geladenRef.current) return;
    if (!afname || !inst) return;
    geladenRef.current = true;
    const raw = (afname as any).mainResponses;
    if (!raw) return;
    let parsed: any = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object") return;
    const a: VonkAnswers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    const e: VonkEnergy = parsed.energy && typeof parsed.energy === "object" ? parsed.energy : {};
    if (Object.keys(a).length === 0) return;
    setAnswers(a);
    setEnergy(e);
    setHervat(true);
    // Cursor op het eerste onvolledige blok.
    let firstIncomplete = -1;
    for (let i = 0; i < inst.blocks.length; i++) {
      if (!blokVolledig(inst.blocks[i]!, a, e)) { firstIncomplete = i; break; }
    }
    setIdx(firstIncomplete === -1 ? inst.blocks.length - 1 : firstIncomplete);
  }, [afname, inst]);

  // Debounced tussentijds bewaren (best-effort — mag de afname nooit blokkeren).
  useEffect(() => {
    if (!geladenRef.current) return;
    if (!afname || afname.status === "voltooid") return;
    if (Object.keys(answers).length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setConceptStatus("bezig");
    saveTimer.current = setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/afnames/${id}/concept`, {
          responses: {},
          t4teens: { answers, energy },
        });
        setConceptStatus("bewaard");
      } catch {
        setConceptStatus("idle");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, energy]);

  function setAns(v: number | string) {
    if (!vonkId) return;
    setAnswers((prev) => ({ ...prev, [vonkId]: v }));
  }
  function setEne(v: number) {
    if (!vonkId) return;
    setEnergy((prev) => ({ ...prev, [vonkId]: v }));
  }

  const curAns = vonkId in answers ? answers[vonkId] : null;
  const curEne = vonkId in energy ? energy[vonkId] : null;

  const blockComplete = useMemo(() => (block ? blokVolledig(block, answers, energy) : false), [block, answers, energy]);

  const answeredCount = blocks.filter((b) => blokVolledig(b, answers, energy)).length;

  async function finish() {
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/afnames/${id}/main`, {
        responses: {},
        t4teens: { answers, energy },
      });
      navigate(`/afname/${id}/deel2`);
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: String(e.message ?? e), variant: "destructive" });
      setSubmitting(false);
    }
  }

  function next() {
    if (!blockComplete) return;
    if (idx < blocks.length - 1) setIdx((i) => i + 1);
    else finish();
  }

  // Vergrendeling: een voltooide afname mag niet opnieuw ingevuld worden.
  if (afname?.status === "voltooid") {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent" />
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-al-voltooid-titel">
                Deze vragenlijst is al afgerond
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Je hoeft niets meer te doen. Je Studiekompas is klaargezet.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading || !inst || !block) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-64 w-full" />
        </main>
      </div>
    );
  }

  const itemText = block.items[0]?.text ?? "";

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<span className="text-sm text-muted-foreground">Deel 1</span>} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {hervat && (
          <div
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs text-foreground"
            data-testid="text-hervat-melding"
          >
            We hebben je eerdere antwoorden teruggezet. Ga gerust verder waar je gebleven was.
          </div>
        )}
        <div className="mb-6">
          <AfnameVoortgang huidigIndex={idx} totaal={blocks.length} className="mb-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{block.family}</span>
            <span className="flex items-center gap-2">
              {conceptStatus === "bezig" && <span data-testid="text-concept-status">Bewaren…</span>}
              {conceptStatus === "bewaard" && (
                <span className="flex items-center gap-1 text-accent" data-testid="text-concept-status">
                  <Check className="h-3 w-3" /> Bewaard
                </span>
              )}
              <span>{answeredCount} van {blocks.length} beantwoord</span>
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-base text-foreground">{itemText}</p>

            <div className="mt-5 space-y-5">
              {/* Batterij-slider (I1) */}
              {meta?.type === "battery" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{meta.min ?? 0}</span>
                    <span
                      className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary"
                      data-testid="value-battery"
                    >
                      {typeof curAns === "number" ? curAns : (meta.max ?? 10) / 2}
                    </span>
                    <span className="text-xs text-muted-foreground">{meta.max ?? 10}</span>
                  </div>
                  <Slider
                    value={[typeof curAns === "number" ? curAns : Math.round((meta.max ?? 10) / 2)]}
                    onValueChange={(v) => setAns(v[0]!)}
                    min={meta.min ?? 0}
                    max={meta.max ?? 10}
                    step={1}
                    data-testid="slider-battery"
                  />
                </div>
              )}

              {/* Recognition / interest / sjt / meaning: keuze-rij */}
              {(meta?.type === "recognition" ||
                meta?.type === "recognition+energy" ||
                meta?.type === "interest" ||
                meta?.type === "sjt" ||
                meta?.type === "meaning") && (
                <KeuzeRij
                  options={meta.options ?? []}
                  value={curAns}
                  onChange={setAns}
                  testidPrefix="vonk-answer"
                />
              )}

              {/* Energie-schaal (enkel recognition+energy) */}
              {meta?.type === "recognition+energy" && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">
                    En hoeveel energie geeft dit je?
                    {curAns === null && (
                      <span className="ml-1 text-xs text-muted-foreground">(kies eerst hierboven)</span>
                    )}
                  </p>
                  <KeuzeRij
                    options={meta.energyOptions ?? []}
                    value={curEne}
                    onChange={(v) => setEne(v as number)}
                    testidPrefix="vonk-energy"
                  />
                </div>
              )}

              {/* Moeite-schaal (enkel driver-items D1..D4). Naast de 0..3 herkenning
                  vraagt de vonk-client hoeveel moeite het kost om zo te zijn; de waarde
                  belandt in energy[vonkId] (drvEnergy → gaspedaal/rem + contextBrake). */}
              {meta?.moeiteOptions && meta.moeiteOptions.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">
                    En hoeveel moeite kost het je om zo te zijn?
                    {curAns === null && (
                      <span className="ml-1 text-xs text-muted-foreground">(kies eerst hierboven)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Niet of je zo bént, maar of het je moeite kost of net vanzelf gaat. Kies wat het best past.
                  </p>
                  <KeuzeRij
                    options={meta.moeiteOptions}
                    value={curEne}
                    onChange={(v) => setEne(v as number)}
                    testidPrefix="vonk-moeite"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 min-h-[1.25rem]" aria-live="polite">
              {blockComplete ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-accent" data-testid="text-block-status">
                  <Check className="h-3.5 w-3.5" /> Beantwoord
                </p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-block-status">
                  Kies een antwoord om verder te gaan.
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                data-testid="button-prev"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Vorige
              </Button>
              <Button onClick={next} disabled={submitting || !blockComplete} data-testid="button-next">
                {idx < blocks.length - 1 ? (
                  <>Volgende <ChevronRight className="ml-1 h-4 w-4" /></>
                ) : submitting ? (
                  "Bezig met opslaan…"
                ) : (
                  "Deel 1 afronden"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Is een blok volledig beantwoord? recognition+energy én de driver-moeite-items (D1..D4)
// vereisen zowel het antwoord als de energie/moeite-waarde. Battery telt als beantwoord
// zodra er een numerieke waarde gekozen is.
function blokVolledig(block: ClientBlock, answers: VonkAnswers, energy: VonkEnergy): boolean {
  const meta = block.t4teens;
  if (!meta) return false;
  const heeftAntwoord = meta.vonkId in answers && answers[meta.vonkId] !== null && answers[meta.vonkId] !== undefined;
  if (!heeftAntwoord) return false;
  const vereistEnergie = meta.type === "recognition+energy" || (meta.moeiteOptions?.length ?? 0) > 0;
  if (vereistEnergie) {
    return meta.vonkId in energy && energy[meta.vonkId] !== null && energy[meta.vonkId] !== undefined;
  }
  return true;
}
