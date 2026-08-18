// ---------------------------------------------------------------------------
// client/src/pages/studiekompas.tsx
//
// Het invulscherm van het T4Students Studiekompas.
//
// WAAROM DIT BESTAAT
// Dit instrument had geen eigen invulscherm. De afname viel terug op het scherm
// van het T4P Business Kompas (client/src/pages/deel1.tsx), dat 34 blokken van
// een ander instrument toont en elk antwoord bewaart onder een bloksleutel
// (B0, B1, ...). De scoringsmotor van het studiekompas leest zijn antwoorden
// per item-id (P0, I1, BE1, D1, ...). Daardoor scoorde een volledig ingevulde
// afname nul items en kwam het rapport eruit met louter nulwaarden.
//
// Dit scherm haalt de echte vragenlijst op bij
// GET /api/vragenlijst/tapas-t4students en bewaart elk antwoord onder het
// item-id, in precies de vorm die de motor leest: recognition, energy,
// interest, choice, value of text. De regel over wat een item verwacht staat
// niet hier maar in server/t4students/antwoorden.ts; de server weigert een
// inzending die daar niet aan voldoet, dus dit scherm kan niet stil afwijken.
// ---------------------------------------------------------------------------

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { AfnameVoortgang } from "@/components/AfnameVoortgang";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Afname, ItemTijden } from "@/lib/types";
import { ChevronLeft, ChevronRight, Check, CheckCircle2 } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";
import { bewijsSleutel } from "@/pages/klaar";

/** Een schaal zoals de vragenlijstroute die meegeeft. */
interface Schaal {
  type?: string;
  min?: number;
  max?: number;
  label?: string;
  options?: { value: number; label: string }[];
}

interface Optie {
  key: string;
  text: string;
}

interface Variant {
  itemType: string;
  scale?: string;
  text: string;
  options?: Optie[];
}

interface Item {
  id: string;
  family: string;
  familyLabel: string;
  construct?: string;
  itemType?: string;
  scale?: string;
  energyScale?: string;
  text: string;
  placeholder?: string;
  required?: boolean;
  options?: Optie[];
  dependsOn?: string;
  variants?: Record<string, Variant>;
}

interface Vragenlijst {
  instrumentId: string;
  version: string;
  name: string;
  language: string;
  instructions: string;
  scales: Record<string, Schaal>;
  items: Item[];
  totaalItems: number;
}

/** Eén antwoord, in de vorm van de scoringsmotor. */
interface Antwoord {
  recognition?: number;
  energy?: number;
  interest?: number;
  value?: number;
  choice?: string;
  text?: string;
}

type Antwoorden = Record<string, Antwoord>;

// Kleine inline woordenboeken. Het scherm gebruikt de gedeelde vertaler voor de
// knoppen en de voortgang; deze twee regels bestaan alleen hier en hebben nog
// geen sleutel in shared/i18n.
const LABEL_SCHUIF: Record<string, string> = {
  nl: "Kies een getal van 0 tot 10.",
  fr: "Choisissez un chiffre de 0 à 10.",
  en: "Pick a number from 0 to 10.",
};

const LABEL_ENERGIE: Record<string, string> = {
  nl: "En wat doet dit met je energie?",
  fr: "Et quel effet cela a sur votre énergie ?",
  en: "And what does this do to your energy?",
};

const LABEL_OVERSLAAN: Record<string, string> = {
  nl: "Deze vraag is niet verplicht.",
  fr: "Cette question n'est pas obligatoire.",
  en: "This question is optional.",
};

/** Hele milliseconden sinds een eerder meetpunt, nooit negatief. */
function verstrekenMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

/**
 * De itemsoort van een item. Bij P2 hangt die af van het antwoord op P1: elk
 * profiel stelt een andere vervolgvraag. Dezelfde regel staat server-side in
 * server/t4students/antwoorden.ts (itemSoort).
 */
function soortVanItem(item: Item, keuzeVanP1: string | null): string {
  if (item.variants) {
    const variant = keuzeVanP1 ? item.variants[keuzeVanP1] : undefined;
    return variant?.itemType ?? "";
  }
  return item.itemType ?? "";
}

/** De vraagtekst, met bij P2 de tekst van de gekozen variant. */
function tekstVanItem(item: Item, keuzeVanP1: string | null): string {
  if (item.variants && keuzeVanP1) {
    const variant = item.variants[keuzeVanP1];
    if (variant?.text) return variant.text;
  }
  return item.text;
}

/** De opties van dit item, met bij P2 de opties van de gekozen variant. */
function optiesVanItem(item: Item, keuzeVanP1: string | null): Optie[] {
  if (item.variants && keuzeVanP1) {
    const variant = item.variants[keuzeVanP1];
    if (variant?.options) return variant.options;
  }
  return item.options ?? [];
}

/** De schaalnaam van dit item, met bij P2 de schaal van de gekozen variant. */
function schaalVanItem(item: Item, keuzeVanP1: string | null): string | undefined {
  if (item.variants && keuzeVanP1) {
    const variant = item.variants[keuzeVanP1];
    if (variant?.scale) return variant.scale;
  }
  return item.scale;
}

/**
 * Welke velden dit item verwacht. Spiegel van verwachtVeld() in
 * server/t4students/antwoorden.ts. De server beslist; dit is enkel om de
 * volgende-knop pas vrij te geven wanneer het antwoord volledig is.
 */
function verwachteVelden(soort: string): (keyof Antwoord)[] {
  switch (soort) {
    case "open-intro":
      return ["text"];
    case "battery":
    case "profile-scale":
      return ["value"];
    case "recognition+energy":
      return ["recognition", "energy"];
    case "recognition":
      return ["recognition"];
    case "interest":
      return ["interest"];
    case "sjt":
    case "profile-select":
    case "profile-choice":
    case "context-choice":
    case "meaning":
      return ["choice"];
    default:
      return [];
  }
}

function antwoordVolledig(item: Item, antwoord: Antwoord | undefined, keuzeVanP1: string | null): boolean {
  if (item.required === false) return true;
  const velden = verwachteVelden(soortVanItem(item, keuzeVanP1));
  if (velden.length === 0) return true;
  if (!antwoord) return false;
  return velden.every((veld) => {
    const waarde = antwoord[veld];
    if (veld === "choice" || veld === "text") return typeof waarde === "string" && waarde.trim().length > 0;
    return typeof waarde === "number" && Number.isFinite(waarde);
  });
}

/** Keuzeknoppen op een ordinale schaal. */
function SchaalRij({
  opties,
  waarde,
  onKies,
  testidPrefix,
}: {
  opties: { value: number; label: string }[];
  waarde: number | undefined;
  onKies: (v: number) => void;
  testidPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opties.map((o) => {
        const actief = waarde === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onKies(o.value)}
            data-testid={`${testidPrefix}-${o.value}`}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
              actief
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

/** Keuzeknoppen op tekstopties, onder elkaar want de teksten zijn lang. */
function OptieLijst({
  opties,
  waarde,
  onKies,
}: {
  opties: Optie[];
  waarde: string | undefined;
  onKies: (k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {opties.map((o) => {
        const actief = waarde === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onKies(o.key)}
            data-testid={`button-optie-${o.key}`}
            className={`rounded-md border px-4 py-3 text-left text-sm transition ${
              actief
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover-elevate"
            }`}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

/** Een schuif van min tot max, met de gekozen stand in cijfers ernaast. */
function Schuif({
  min,
  max,
  waarde,
  onKies,
}: {
  min: number;
  max: number;
  waarde: number | undefined;
  onKies: (v: number) => void;
}) {
  const standen: number[] = [];
  for (let i = min; i <= max; i++) standen.push(i);
  return (
    <div className="flex flex-wrap gap-2">
      {standen.map((stand) => {
        const actief = waarde === stand;
        return (
          <button
            key={stand}
            onClick={() => onKies(stand)}
            data-testid={`button-schuif-${stand}`}
            className={`h-10 w-10 rounded-md border text-sm font-medium transition ${
              actief
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover-elevate"
            }`}
          >
            {stand}
          </button>
        );
      })}
    </div>
  );
}

export default function Studiekompas() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [antwoorden, setAntwoorden] = useState<Antwoorden>({});
  const [inzenden, setInzenden] = useState(false);
  const [conceptStatus, setConceptStatus] = useState<"idle" | "bezig" | "bewaard">("idle");
  const [hervat, setHervat] = useState(false);
  const geladenRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tijdenRef = useRef<ItemTijden>({});
  const itemStartRef = useRef<number | null>(null);

  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  const { data: lijst, isLoading } = useQuery<Vragenlijst>({
    queryKey: ["/api/vragenlijst/tapas-t4students", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vragenlijst/tapas-t4students?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });

  const alleItems = lijst?.items ?? [];
  const keuzeVanP1 = typeof antwoorden["P1"]?.choice === "string" ? antwoorden["P1"]!.choice! : null;

  // Een vraag die van een eerder antwoord afhangt (P2) verschijnt pas zodra dat
  // antwoord er is, en verdwijnt wanneer het profiel geen vervolgvraag kent.
  const items = useMemo(
    () =>
      alleItems.filter((item) => {
        if (!item.variants) return true;
        if (!keuzeVanP1) return false;
        return Boolean(item.variants[keuzeVanP1]);
      }),
    [alleItems, keuzeVanP1],
  );

  const item: Item | undefined = items[idx];
  const huidig = item ? antwoorden[item.id] : undefined;

  // Tijdmeting per item, net als in deel 1 van het T4P Business Kompas.
  function huidigeTijden(): ItemTijden {
    const uit: ItemTijden = { ...tijdenRef.current };
    if (item && itemStartRef.current !== null) {
      const sleutel = item.id;
      uit[sleutel] = (uit[sleutel] ?? 0) + verstrekenMs(itemStartRef.current);
    }
    return uit;
  }

  useEffect(() => {
    itemStartRef.current = performance.now();
    return () => {
      if (item && itemStartRef.current !== null) {
        const sleutel = item.id;
        tijdenRef.current[sleutel] = (tijdenRef.current[sleutel] ?? 0) + verstrekenMs(itemStartRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Eerder bewaarde antwoorden herstellen. Alleen antwoorden in de vorm van dit
  // instrument komen door: een blad uit een ander instrument (bloksleutels
  // B0, B1, ...) wordt hier niet ingelezen, zodat het ook niet stil meegaat in
  // een nieuwe inzending.
  useEffect(() => {
    if (geladenRef.current) return;
    if (!afname || !lijst) return;
    geladenRef.current = true;
    const ruw = (afname as unknown as { mainResponses?: unknown }).mainResponses;
    if (!ruw) return;
    let ontleed: unknown = null;
    try {
      ontleed = typeof ruw === "string" ? JSON.parse(ruw) : ruw;
    } catch {
      ontleed = null;
    }
    if (!ontleed || typeof ontleed !== "object") return;
    const bekend = new Set(lijst.items.map((i) => i.id));
    const herstel: Antwoorden = {};
    for (const [sleutel, waarde] of Object.entries(ontleed as Record<string, unknown>)) {
      if (!bekend.has(sleutel)) continue;
      if (!waarde || typeof waarde !== "object") continue;
      const rij = waarde as Record<string, unknown>;
      const a: Antwoord = {};
      if (typeof rij.recognition === "number") a.recognition = rij.recognition;
      if (typeof rij.energy === "number") a.energy = rij.energy;
      if (typeof rij.interest === "number") a.interest = rij.interest;
      if (typeof rij.value === "number") a.value = rij.value;
      if (typeof rij.choice === "string") a.choice = rij.choice;
      if (typeof rij.text === "string") a.text = rij.text;
      if (Object.keys(a).length > 0) herstel[sleutel] = a;
    }
    if (Object.keys(herstel).length === 0) return;
    setAntwoorden(herstel);
    setHervat(true);
    const p1 = typeof herstel["P1"]?.choice === "string" ? herstel["P1"]!.choice! : null;
    const zichtbaar = lijst.items.filter((i) => !i.variants || (p1 !== null && Boolean(i.variants[p1])));
    let eerste = -1;
    for (let i = 0; i < zichtbaar.length; i++) {
      if (!antwoordVolledig(zichtbaar[i]!, herstel[zichtbaar[i]!.id], p1)) {
        eerste = i;
        break;
      }
    }
    setIdx(eerste === -1 ? Math.max(0, zichtbaar.length - 1) : eerste);
  }, [afname, lijst]);

  // Tussentijds bewaren, met dezelfde route als deel 1.
  useEffect(() => {
    if (!geladenRef.current) return;
    if (!afname || afname.status === "voltooid") return;
    if (Object.keys(antwoorden).length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setConceptStatus("bezig");
    saveTimer.current = setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/afnames/${id}/concept`, {
          responses: antwoorden,
          tijden: huidigeTijden(),
        });
        setConceptStatus("bewaard");
      } catch {
        setConceptStatus("idle");
      }
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antwoorden, afname?.status, id]);

  function zet(velden: Partial<Antwoord>) {
    if (!item) return;
    setAntwoorden((oud) => ({ ...oud, [item.id]: { ...(oud[item.id] ?? {}), ...velden } }));
  }

  const volledig = item ? antwoordVolledig(item, huidig, keuzeVanP1) : false;
  const aantalVolledig = items.filter((i) => antwoordVolledig(i, antwoorden[i.id], keuzeVanP1)).length;

  async function rondAf() {
    setInzenden(true);
    try {
      await apiRequest("POST", `/api/afnames/${id}/main`, {
        responses: antwoorden,
        tijden: huidigeTijden(),
      });
      // Het studiekompas heeft geen eigen deel 2: de vier vragen over
      // organisatieverbondenheid horen enkel bij het T4P Business Kompas. De
      // afronding gaat daarom rechtstreeks over dezelfde /connection-route, die
      // dit toestaat voor instrumenten zonder eigen deel 2.
      const res = await apiRequest("POST", `/api/afnames/${id}/connection`, {});
      try {
        const uitkomst = await res.json();
        const code = uitkomst?.afname?.bezitsToken;
        if (typeof code === "string" && code) {
          window.sessionStorage.setItem(bewijsSleutel(id), code);
        }
      } catch {
        // Mislukt bewaren van het bewijs mag het afronden nooit blokkeren.
      }
      navigate(`/afname/${id}/klaar`);
    } catch (e: unknown) {
      const melding = e instanceof Error ? e.message : String(e);
      toast({ title: t("fout_opslaan_titel"), description: melding, variant: "destructive" });
      setInzenden(false);
    }
  }

  function volgende() {
    if (!volledig) return;
    if (idx < items.length - 1) setIdx((i) => i + 1);
    else rondAf();
  }

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

  if (isLoading || !lijst || !item) {
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

  const soort = soortVanItem(item, keuzeVanP1);
  const vraagtekst = tekstVanItem(item, keuzeVanP1);
  const schaalNaam = schaalVanItem(item, keuzeVanP1);
  const schaal = schaalNaam ? lijst.scales[schaalNaam] : undefined;
  const energieSchaal = item.energyScale ? lijst.scales[item.energyScale] : undefined;
  const opties = optiesVanItem(item, keuzeVanP1);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<span className="text-sm text-muted-foreground">{lijst.name}</span>} />
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
          <AfnameVoortgang huidigIndex={idx} totaal={items.length} className="mb-2" />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.familyLabel}</span>
            <span className="flex items-center gap-2">
              {conceptStatus === "bezig" && (
                <span data-testid="text-concept-status">{t("deel1_concept_bewaren_bezig")}</span>
              )}
              {conceptStatus === "bewaard" && (
                <span className="flex items-center gap-1 text-accent" data-testid="text-concept-status">
                  <Check className="h-3 w-3" /> {t("deel1_concept_bewaard")}
                </span>
              )}
              <span>
                {aantalVolledig} {t("deel1_van")} {items.length}
              </span>
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-base font-medium text-foreground" data-testid="text-vraag">
              {vraagtekst}
            </p>

            <div className="mt-5 space-y-5">
              {soort === "open-intro" && (
                <div>
                  <textarea
                    value={huidig?.text ?? ""}
                    onChange={(e) => zet({ text: e.target.value })}
                    rows={4}
                    placeholder={item.placeholder ?? ""}
                    data-testid="input-open-intro"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {LABEL_OVERSLAAN[taal] ?? LABEL_OVERSLAAN.nl}
                  </p>
                </div>
              )}

              {(soort === "battery" || soort === "profile-scale") && (
                <div>
                  {schaal?.label && <p className="mb-2 text-sm text-muted-foreground">{schaal.label}</p>}
                  <Schuif
                    min={schaal?.min ?? 0}
                    max={schaal?.max ?? 10}
                    waarde={huidig?.value}
                    onKies={(v) => zet({ value: v })}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{LABEL_SCHUIF[taal] ?? LABEL_SCHUIF.nl}</p>
                </div>
              )}

              {(soort === "recognition+energy" || soort === "recognition") && (
                <div className="space-y-4">
                  <SchaalRij
                    opties={schaal?.options ?? []}
                    waarde={huidig?.recognition}
                    onKies={(v) => zet({ recognition: v })}
                    testidPrefix="button-herkenning"
                  />
                  {soort === "recognition+energy" && (
                    <div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        {LABEL_ENERGIE[taal] ?? LABEL_ENERGIE.nl}
                      </p>
                      <SchaalRij
                        opties={energieSchaal?.options ?? []}
                        waarde={huidig?.energy}
                        onKies={(v) => zet({ energy: v })}
                        testidPrefix="button-energie"
                      />
                    </div>
                  )}
                </div>
              )}

              {soort === "interest" && (
                <SchaalRij
                  opties={schaal?.options ?? []}
                  waarde={huidig?.interest}
                  onKies={(v) => zet({ interest: v })}
                  testidPrefix="button-interesse"
                />
              )}

              {(soort === "sjt" ||
                soort === "profile-select" ||
                soort === "profile-choice" ||
                soort === "context-choice" ||
                soort === "meaning") && (
                <OptieLijst opties={opties} waarde={huidig?.choice} onKies={(k) => zet({ choice: k })} />
              )}
            </div>

            <div className="mt-5 min-h-[1.25rem]" aria-live="polite">
              {volledig ? (
                <p
                  className="flex items-center gap-1.5 text-xs font-medium text-accent"
                  data-testid="text-item-status"
                >
                  <Check className="h-3.5 w-3.5" /> {t("blok_volledig")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-item-status">
                  {t("blok_nog_te_doen")}
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
              <Button onClick={volgende} disabled={inzenden || !volledig} data-testid="button-next">
                {idx < items.length - 1 ? (
                  <>
                    {t("knop_volgende")} <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                ) : inzenden ? (
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
