import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientInstrument, ClientBlock, AnswerState, BlockAnswer, EnergyOption, Afname } from "@/lib/types";
import { ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Check, CheckCircle2 } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL, publiekeFamilie } from "@shared/i18n";

function emptyAnswer(): BlockAnswer {
  return { most: null, least: null, itemEnergy: { most: null, least: null }, blockEnergy: null };
}

// Energieknoppen-rij.
function EnergyRow({
  options,
  value,
  onChange,
  testidPrefix,
}: {
  options: EnergyOption[];
  value: number | null;
  onChange: (v: number) => void;
  testidPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.label}
            data-testid={`${testidPrefix}-${o.value}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
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

export default function Deel1() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitting, setSubmitting] = useState(false);
  const [conceptStatus, setConceptStatus] = useState<"idle" | "bezig" | "bewaard">("idle");
  const [hervat, setHervat] = useState(false);
  const geladenRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Eerst de afname ophalen om de (bevroren) taal te kennen.
  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  // Instrument in de taal van de afname ophalen.
  const { data: inst, isLoading } = useQuery<ClientInstrument>({
    queryKey: ["/api/instrument", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/instrument?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });

  const blocks = inst?.blocks ?? [];
  const block: ClientBlock | undefined = blocks[idx];
  const stateKey = block ? `B${block.blockIndex}` : "";
  const cur = answers[stateKey] ?? emptyAnswer();
  const energyOptions = inst?.responseScales.energy.options ?? [];

  // Herstel eerder (tussentijds) bewaarde antwoorden zodra zowel de afname als
  // het instrument geladen zijn. We doen dit eenmalig (geladenRef) zodat lokale
  // wijzigingen daarna niet overschreven worden.
  useEffect(() => {
    if (geladenRef.current) return;
    if (!afname || !inst) return;
    geladenRef.current = true;
    const raw = (afname as any).mainResponses;
    if (!raw) return;
    let parsed: AnswerState | null = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) return;
    setAnswers(parsed);
    setHervat(true);
    // Zet de cursor op het eerste blok dat nog niet volledig is.
    const bl = inst.blocks;
    let firstIncomplete = -1;
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i]!;
      const a = parsed[`B${b.blockIndex}`];
      const compleet =
        !!a && !!a.most && !!a.least &&
        (b.energyMode === "block"
          ? a.blockEnergy != null
          : a.itemEnergy?.most != null && a.itemEnergy?.least != null);
      if (!compleet) { firstIncomplete = i; break; }
    }
    setIdx(firstIncomplete === -1 ? bl.length - 1 : firstIncomplete);
  }, [afname, inst]);


  // Debounced tussentijds bewaren. Pas actief nadat herstel-poging klaar is en
  // er minstens iets is ingevuld. Slaat stil over bij een voltooide afname.
  useEffect(() => {
    if (!geladenRef.current) return;
    if (!afname || afname.status === "voltooid") return;
    if (Object.keys(answers).length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setConceptStatus("bezig");
    saveTimer.current = setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/afnames/${id}/concept`, { responses: answers });
        setConceptStatus("bewaard");
      } catch {
        // Stil falen: tussentijds bewaren mag de afname nooit blokkeren.
        setConceptStatus("idle");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  function update(patch: Partial<BlockAnswer>) {
    setAnswers((prev) => ({ ...prev, [stateKey]: { ...emptyAnswer(), ...prev[stateKey], ...patch } }));
  }

  function setMost(pos: string) {
    const least = cur.least === pos ? null : cur.least;
    update({ most: cur.most === pos ? null : pos, least });
  }
  function setLeast(pos: string) {
    const most = cur.most === pos ? null : cur.most;
    update({ least: cur.least === pos ? null : pos, most });
  }

  // Validatie van het huidige blok.
  const blockComplete = useMemo(() => {
    if (!block) return false;
    if (!cur.most || !cur.least) return false;
    if (block.energyMode === "block") {
      return cur.blockEnergy !== null;
    }
    // item-energy: energie voor most én least gekozen item.
    return cur.itemEnergy.most !== null && cur.itemEnergy.least !== null;
  }, [block, cur]);

  const answeredCount = Object.keys(answers).filter((k) => {
    const a = answers[k];
    return a && a.most && a.least;
  }).length;

  async function finishDeel1() {
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/afnames/${id}/main`, { responses: answers });
      navigate(`/afname/${id}/deel2`);
    } catch (e: any) {
      toast({ title: t("fout_opslaan_titel"), description: String(e.message ?? e), variant: "destructive" });
      setSubmitting(false);
    }
  }

  // Wat ontbreekt er nog in dit blok? (voor de zichtbare hint)
  const ontbreekt = useMemo(() => {
    if (!block) return [] as string[];
    const m: string[] = [];
    if (!cur.most) m.push(t("ontbreekt_meest"));
    if (!cur.least) m.push(t("ontbreekt_minst"));
    if (block.energyMode === "block") {
      if (cur.blockEnergy === null) m.push(t("ontbreekt_energie_blok"));
    } else {
      if (cur.most && cur.itemEnergy.most === null) m.push(t("ontbreekt_energie_meest"));
      if (cur.least && cur.itemEnergy.least === null) m.push(t("ontbreekt_energie_minst"));
    }
    return m;
  }, [block, cur, taal]);

  function next() {
    if (!blockComplete) return;
    if (idx < blocks.length - 1) setIdx((i) => i + 1);
    else finishDeel1();
  }

  // Vergrendeling: een voltooide afname mag niet opnieuw worden ingevuld.
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

  const pct = Math.round(((idx + 1) / blocks.length) * 100);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<span className="text-sm text-muted-foreground">{t("deel1_voortgang")}</span>} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {hervat && (
          <div
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs text-foreground"
            data-testid="text-hervat-melding"
          >
            {t("deel1_hervat_melding")}
          </div>
        )}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground" data-testid="text-block-counter">
              {t("deel1_blok")} {idx + 1} <span className="text-muted-foreground">{t("deel1_van")} {blocks.length}</span>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {conceptStatus === "bezig" && (
                <span className="text-xs" data-testid="text-concept-status">{t("deel1_concept_bewaren_bezig")}</span>
              )}
              {conceptStatus === "bewaard" && (
                <span className="flex items-center gap-1 text-xs text-accent" data-testid="text-concept-status">
                  <Check className="h-3 w-3" /> {t("deel1_concept_bewaard")}
                </span>
              )}
              <span>{publiekeFamilie(block.family, taal)}</span>
            </span>
          </div>
          <Progress value={pct} className="mt-2 h-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {answeredCount} {t("deel1_van")} {blocks.length} {t("deel1_blokken_volledig")}
          </p>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">{t("deel1_instructie")}</p>

            <div className="mt-4 space-y-3">
              {block.items.map((it) => {
                const isMost = cur.most === it.pos;
                const isLeast = cur.least === it.pos;
                return (
                  <div
                    key={it.pos}
                    className={`rounded-lg border p-3 sm:p-4 ${
                      isMost
                        ? "border-accent bg-accent/10"
                        : isLeast
                        ? "border-destructive/60 bg-destructive/5"
                        : "border-border bg-card"
                    }`}
                    data-testid={`item-${it.pos}`}
                  >
                    <p className="text-sm text-foreground">{it.text}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setMost(it.pos)}
                        data-testid={`button-most-${it.pos}`}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          isMost ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover-elevate"
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {t("deel1_meest")}
                      </button>
                      <button
                        onClick={() => setLeast(it.pos)}
                        data-testid={`button-least-${it.pos}`}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          isLeast ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground hover-elevate"
                        }`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> {t("deel1_minst")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Energie-bevraging */}
            <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              {block.energyMode === "block" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t("energie_thema_vraag")}</p>
                  <EnergyRow
                    options={energyOptions}
                    value={cur.blockEnergy}
                    onChange={(v) => update({ blockEnergy: v })}
                    testidPrefix="energy-block"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("energie_meest_vraag")}
                      {!cur.most && <span className="text-xs text-muted-foreground">{t("energie_kies_meest_eerst")}</span>}
                    </p>
                    <EnergyRow
                      options={energyOptions}
                      value={cur.itemEnergy.most}
                      onChange={(v) => update({ itemEnergy: { ...cur.itemEnergy, most: v } })}
                      testidPrefix="energy-item-most"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("energie_minst_vraag")}
                      {!cur.least && <span className="text-xs text-muted-foreground">{t("energie_kies_minst_eerst")}</span>}
                    </p>
                    <EnergyRow
                      options={energyOptions}
                      value={cur.itemEnergy.least}
                      onChange={(v) => update({ itemEnergy: { ...cur.itemEnergy, least: v } })}
                      testidPrefix="energy-item-least"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status van dit blok: zichtbare hint of bevestiging */}
            <div className="mt-5 min-h-[1.25rem]" aria-live="polite">
              {blockComplete ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-accent" data-testid="text-block-status">
                  <Check className="h-3.5 w-3.5" /> {t("blok_volledig")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-block-status">
                  {t("blok_nog_te_doen")} {ontbreekt.join(" · ")}
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
                <ChevronLeft className="mr-1 h-4 w-4" /> {t("knop_vorige")}
              </Button>
              <Button
                onClick={next}
                disabled={submitting || !blockComplete}
                data-testid="button-next"
              >
                {idx < blocks.length - 1 ? (
                  <>{t("knop_volgende")} <ChevronRight className="ml-1 h-4 w-4" /></>
                ) : submitting ? (
                  t("knop_opslaan_bezig")
                ) : (
                  t("knop_deel1_afronden")
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
