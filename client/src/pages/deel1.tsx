import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { AfnameVoortgang } from "@/components/AfnameVoortgang";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientInstrument, ClientBlock, AnswerState, BlockAnswer, EnergyOption, Afname, ItemTijden } from "@/lib/types";
import { ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Check, CheckCircle2 } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL, publiekeFamilie } from "@shared/i18n";
import { blokAntwoordVolledig, isWaarderingsblok } from "@shared/verplicht-antwoorden";
import { bewijsSleutel } from "@/pages/klaar";

function emptyAnswer(): BlockAnswer {
  return { most: null, least: null, itemEnergy: { most: null, least: null }, blockEnergy: null, toelichting: null };
}

// Hele milliseconden sinds een eerder meetpunt, nooit negatief.
function verstrekenMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

// Label voor de optionele driver-toelichting bij een energiekostende keuze.
// Klein inline-woordenboek zodat de feature in alle afname-talen leesbaar is;
// valt terug op NL wanneer de taal ontbreekt.
const TOELICHTING_LABELS: Record<string, string> = {
  nl: "Wat maakt dit energiekostend? (optioneel)",
  en: "What makes this energy-draining? (optional)",
  fr: "Qu'est-ce qui rend cela épuisant ? (facultatif)",
  de: "Was macht dies energieraubend? (optional)",
  es: "¿Qué hace que esto reste energía? (opcional)",
};

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
  // Tijdmeting per item (normentoetsing C07, C08, C20). Per item tellen we op
  // hoe lang het scherm zichtbaar was. Terugbladeren telt gewoon mee: de totale
  // aandacht per item is wat we willen weten.
  const tijdenRef = useRef<ItemTijden>({});
  const itemStartRef = useRef<number | null>(null);

  // Eerst de afname ophalen om de (bevroren) taal te kennen.
  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  // Instrument in de taal van de afname ophalen.
  // T4Teens gebruikt een eigen override-aware endpoint; andere instrumenten
  // vallen terug op het standaard T4P Business endpoint.
  const isT4Teens = afname?.instrumentId === "t4teens";
  const isT4Kids = afname?.instrumentId === "t4kids";
  const instrumentEndpoint = isT4Kids
    ? `/api/vragenlijst/tapas-t4kids?taal=${taal}`
    : isT4Teens
      ? `/api/vragenlijst/tapas-t4teens?taal=${taal}`
      : `/api/instrument?taal=${taal}`;
  const { data: inst, isLoading } = useQuery<ClientInstrument>({
    queryKey: [
      isT4Kids
        ? "/api/vragenlijst/tapas-t4kids"
        : isT4Teens
          ? "/api/vragenlijst/tapas-t4teens"
          : "/api/instrument",
      taal,
    ],
    queryFn: async () => {
      const res = await apiRequest("GET", instrumentEndpoint);
      return res.json();
    },
    enabled: !!afname,
  });

  const blocks = inst?.blocks ?? [];
  const block: ClientBlock | undefined = blocks[idx];
  const stateKey = block ? `B${block.blockIndex}` : "";
  const cur = answers[stateKey] ?? emptyAnswer();
  const energyOptions = inst?.responseScales.energy.options ?? [];
  // "Energiekostend" = de laagste/negatieve energie-optie. Zodra die gekozen is,
  // tonen we een optioneel toelichting-veld (blokkeert de afname nooit).
  const minEnergie = energyOptions.length ? Math.min(...energyOptions.map((o) => o.value)) : 0;
  const isEnergieKostend = (v: number | null | undefined) =>
    v !== null && v !== undefined && (v < 0 || v === minEnergie);
  // Een blok met één uitspraak wordt gewaardeerd, niet gerangschikt: "meest" en
  // "minst" hebben daar geen betekenis.
  const waarderingsblok = block ? isWaarderingsblok(block) : false;
  // Eén schaal voor het hele blok, of een aparte schaal voor de meest- en de
  // minst-keuze. Bij één uitspraak is er maar één schaal, wat het blok verder
  // ook over zichzelf zegt: er valt geen tweede keuze te waarderen.
  const eenSchaalVoorHetBlok = waarderingsblok || block?.energyMode === "block";
  const isDriverBlok = block?.family === "Drivers";
  const toonToelichting =
    isDriverBlok &&
    (eenSchaalVoorHetBlok
      ? isEnergieKostend(cur.blockEnergy)
      : isEnergieKostend(cur.itemEnergy.most) || isEnergieKostend(cur.itemEnergy.least));
  const toelichtingLabel = TOELICHTING_LABELS[taal] ?? TOELICHTING_LABELS.nl;

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
      if (!blokAntwoordVolledig(b, parsed[`B${b.blockIndex}`])) { firstIncomplete = i; break; }
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
        await apiRequest("POST", `/api/afnames/${id}/concept`, {
          responses: answers,
          tijden: huidigeTijden(),
        });
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

  // Meet hoe lang elk item zichtbaar was. Start de klok zodra een item in beeld
  // komt en tel de verstreken tijd op bij dat item zodra het uit beeld gaat.
  // performance.now() is ongevoelig voor het verzetten van de systeemklok.
  useEffect(() => {
    if (!stateKey) return;
    itemStartRef.current = performance.now();
    return () => {
      const start = itemStartRef.current;
      itemStartRef.current = null;
      if (start === null) return;
      tijdenRef.current[stateKey] = (tijdenRef.current[stateKey] ?? 0) + verstrekenMs(start);
    };
  }, [stateKey]);

  // De tijd van het item dat nu nog in beeld staat, is nog niet afgesloten.
  // Tel die er bij het versturen alsnog bij op.
  function huidigeTijden(): ItemTijden {
    const tijden = { ...tijdenRef.current };
    const start = itemStartRef.current;
    if (stateKey && start !== null) {
      tijden[stateKey] = (tijden[stateKey] ?? 0) + verstrekenMs(start);
    }
    return tijden;
  }

  function update(patch: Partial<BlockAnswer>) {
    setAnswers((prev) => ({
      ...prev,
      [stateKey]: {
        ...emptyAnswer(),
        ...prev[stateKey],
        ...patch,
        beantwoordOp: new Date().toISOString(),
      },
    }));
  }

  function setMost(pos: string) {
    const least = cur.least === pos ? null : cur.least;
    update({ most: cur.most === pos ? null : pos, least });
  }
  function setLeast(pos: string) {
    const most = cur.most === pos ? null : cur.most;
    update({ least: cur.least === pos ? null : pos, most });
  }

  // Validatie van het huidige blok. De regel zelf staat in
  // shared/verplicht-antwoorden.ts, zodat het scherm en de server niet uit
  // elkaar kunnen lopen over wat een blok vraagt.
  const blockComplete = useMemo(
    () => (block ? blokAntwoordVolledig(block, cur) : false),
    [block, cur],
  );

  const answeredCount = blocks.filter((b) => blokAntwoordVolledig(b, answers[`B${b.blockIndex}`])).length;

  async function finishDeel1() {
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/afnames/${id}/main`, {
        responses: answers,
        tijden: huidigeTijden(),
      });
      // T4Teens heeft geen eigen deel 2: de vier organisatieverbondenheids-
      // vragen van het T4P Business Kompas ('is je job correct verloond?')
      // horen niet bij een jongere. Zie bevindingen-punt-a-instrumentkaart.md.
      // In plaats van naar /deel2 te gaan (dat toont altijd de T4P-vragen,
      // ongeacht instrument) rondt T4Teens hier meteen af: dezelfde
      // /connection-route, maar zonder q1-q4, wat de server nu toestaat voor
      // instrumenten zonder eigen deel 2.
      if (isT4Teens) {
        const res = await apiRequest("POST", `/api/afnames/${id}/connection`, {});
        try {
          const uitkomst = await res.json();
          const code = uitkomst?.afname?.bezitsToken;
          if (typeof code === "string" && code) {
            window.sessionStorage.setItem(bewijsSleutel(id), code);
          }
        } catch {
          // Mislukt bewaren mag het afronden nooit blokkeren.
        }
        navigate(`/afname/${id}/klaar`);
        return;
      }
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
    if (waarderingsblok) {
      if (cur.blockEnergy === null) m.push(t("ontbreekt_waardering"));
      return m;
    }
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
          {/* 2.3 — AfnameVoortgang component */}
          <AfnameVoortgang
            huidigIndex={idx}
            totaal={blocks.length}
            className="mb-2"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{publiekeFamilie(block.family, taal)}</span>
            <span className="flex items-center gap-2">
              {conceptStatus === "bezig" && (
                <span data-testid="text-concept-status">{t("deel1_concept_bewaren_bezig")}</span>
              )}
              {conceptStatus === "bewaard" && (
                <span className="flex items-center gap-1 text-accent" data-testid="text-concept-status">
                  <Check className="h-3 w-3" /> {t("deel1_concept_bewaard")}
                </span>
              )}
              <span>{answeredCount} {t("deel1_van")} {blocks.length} {t("deel1_blokken_volledig")}</span>
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              {t(waarderingsblok ? "deel1_instructie_waardering" : "deel1_instructie")}
            </p>

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
                    {!waarderingsblok && (
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
                    )}
                  </div>
                );
              })}
            </div>

            {/* Energie-bevraging */}
            <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              {eenSchaalVoorHetBlok ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {t(waarderingsblok ? "deel1_waardering_vraag" : "energie_thema_vraag")}
                  </p>
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

              {/* Optionele driver-toelichting: alleen bij een energiekostende keuze. */}
              {toonToelichting && (
                <div className="space-y-2 border-t border-border pt-4">
                  <label
                    htmlFor="toelichting"
                    className="text-sm font-medium text-foreground"
                  >
                    {toelichtingLabel}
                  </label>
                  <textarea
                    id="toelichting"
                    value={cur.toelichting ?? ""}
                    onChange={(e) => update({ toelichting: e.target.value || null })}
                    rows={2}
                    data-testid="input-toelichting"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  />
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
