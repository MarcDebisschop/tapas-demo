/**
 * Admin Inzichten — rapportagedashboard op basis van afnames
 *
 * Demo-versie: toont geaggregeerde statistieken uit /api/admin/afnames
 * en per organisatie tendenzen via /api/organisaties/:id/tendenzen.
 * Read-only — geen acties.
 */

import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartColumn, Languages, TrendingUp, Users, CheckCircle2, Clock } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import type { Afname, OrganisatieMetSaldo } from "@/lib/types";

const DATE_LOCALE: Record<Taal, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
  en: "en-GB",
  es: "es-ES",
  ru: "ru-RU",
};

interface Tendenzen {
  organisatie: string;
  aantalProfielen: number;
  voldoende: boolean;
  minimum?: number;
  energie?: {
    gemVragenlijst: number | null;
    gemBaseline: number | null;
    gemConsistentie: number | null;
  };
  talentfoci?: { naam: string; gemNet: number }[];
  talentversnellers?: { naam: string; gemNet: number }[];
  drivers?: { naam: string; gemNet: number }[];
  driverBelasting?: { hoog: number; matig: number; laag: number };
}

export default function AdminInzichten() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const [gekozenOrgId, setGekozenOrgId] = useState<string>("");

  const { data: afnames, isLoading: loadingAfnames } = useQuery<Afname[]>({
    queryKey: ["/api/admin/afnames"],
  });
  const { data: organisaties } = useQuery<OrganisatieMetSaldo[]>({
    queryKey: ["/api/organisaties"],
  });

  // Tendenzen ophalen zodra een organisatie gekozen is
  const { data: tendenzen, isLoading: loadingTend } = useQuery<Tendenzen>({
    queryKey: [`/api/organisaties/${gekozenOrgId}/tendenzen`],
    enabled: !!gekozenOrgId,
  });

  // Afname statistieken
  const totaal = (afnames ?? []).length;
  const voltooid = (afnames ?? []).filter((a) => a.status === "voltooid").length;
  const bezig = (afnames ?? []).filter((a) => a.status === "deel1" || a.status === "deel2").length;
  const uitgenodigd = (afnames ?? []).filter((a) => a.status === "uitgenodigd").length;

  // Instrument-verdeling
  const perInstrument: Record<string, number> = {};
  for (const a of afnames ?? []) {
    const key = (a as any).instrumentNaam ?? (a as any).instrument ?? "T4P Business Kompas";
    perInstrument[key] = (perInstrument[key] ?? 0) + 1;
  }

  // Recente voltooide afnames (laatste 5)
  const recente = [...(afnames ?? [])]
    .filter((a) => a.status === "voltooid")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const pct = (n: number) => (totaal > 0 ? Math.round((n / totaal) * 100) : 0);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-8 w-[112px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALEN.map((code) => (
                    <SelectItem key={code} value={code}>{TAAL_NAMEN[code]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/admin">
              <Button size="sm" variant="outline">{t("admin_titel")}</Button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2">
          <ChartColumn className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("iz_nav")}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {uiTaal === "nl"
            ? "Geaggregeerde statistieken over alle afnames en organisaties."
            : uiTaal === "fr"
            ? "Statistiques agrégées sur toutes les prises et organisations."
            : "Aggregated statistics across all assessments and organisations."}
        </p>

        {/* KPI balk */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              icon: <Users className="h-6 w-6 text-accent opacity-80" />,
              waarde: totaal,
              label: uiTaal === "nl" ? "Totaal afnames" : uiTaal === "fr" ? "Total prises" : "Total assessments",
            },
            {
              icon: <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-80" />,
              waarde: `${voltooid} (${pct(voltooid)}%)`,
              label: uiTaal === "nl" ? "Voltooid" : uiTaal === "fr" ? "Terminés" : "Completed",
            },
            {
              icon: <Clock className="h-6 w-6 text-primary opacity-80" />,
              waarde: bezig,
              label: uiTaal === "nl" ? "Bezig" : uiTaal === "fr" ? "En cours" : "In progress",
            },
            {
              icon: <TrendingUp className="h-6 w-6 text-amber-500 opacity-80" />,
              waarde: uitgenodigd,
              label: uiTaal === "nl" ? "Uitgenodigd" : uiTaal === "fr" ? "Invités" : "Invited",
            },
          ].map((k, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                {k.icon}
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {loadingAfnames ? <Skeleton className="h-6 w-12" /> : k.waarde}
                  </p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Verdeling per instrument */}
        {Object.keys(perInstrument).length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {uiTaal === "nl" ? "Verdeling per instrument" : uiTaal === "fr" ? "Répartition par instrument" : "Distribution by instrument"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(perInstrument).map(([naam, aantal]) => (
                <Badge key={naam} variant="outline" className="text-sm px-3 py-1">
                  {naam} <span className="ml-1.5 font-bold">{aantal}</span>
                </Badge>
              ))}
            </div>
          </>
        )}

        {/* Recente voltooide afnames */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {uiTaal === "nl" ? "Recent voltooid" : uiTaal === "fr" ? "Récemment terminés" : "Recently completed"}
        </h2>
        {loadingAfnames ? (
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : recente.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {uiTaal === "nl" ? "Nog geen voltooide afnames." : "No completed assessments yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-2">
            {recente.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <span className="font-medium text-foreground">{a.name || "—"}</span>
                    {a.company && (
                      <span className="ml-2 text-sm text-muted-foreground">· {a.company}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString(DATE_LOCALE[uiTaal])}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Organisatie tendenzen */}
        {(organisaties ?? []).length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {uiTaal === "nl" ? "Organisatietendenzen" : uiTaal === "fr" ? "Tendances par organisation" : "Organisation trends"}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <Select value={gekozenOrgId} onValueChange={setGekozenOrgId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder={uiTaal === "nl" ? "Kies organisatie…" : uiTaal === "fr" ? "Choisir une organisation…" : "Select organisation…"} />
                </SelectTrigger>
                <SelectContent>
                  {(organisaties ?? []).map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gekozenOrgId && (
              loadingTend ? (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : tendenzen && !tendenzen.voldoende ? (
                <Card className="mt-4">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {uiTaal === "nl"
                      ? `Minimaal ${tendenzen.minimum ?? 3} voltooide profielen nodig voor tendenzen. Huidig: ${tendenzen.aantalProfielen}.`
                      : `At least ${tendenzen.minimum ?? 3} completed profiles needed. Current: ${tendenzen.aantalProfielen}.`}
                  </CardContent>
                </Card>
              ) : tendenzen ? (
                <div className="mt-4 space-y-4">
                  {/* Energie */}
                  {tendenzen.energie && (
                    <Card>
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {uiTaal === "nl" ? "Energieprofiel" : "Energy profile"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            n={tendenzen.aantalProfielen}
                          </span>
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          {[
                            { label: uiTaal === "nl" ? "Vragenlijst" : "Questionnaire", val: tendenzen.energie.gemVragenlijst },
                            { label: "Baseline", val: tendenzen.energie.gemBaseline },
                            { label: uiTaal === "nl" ? "Consistentie" : "Consistency", val: tendenzen.energie.gemConsistentie },
                          ].map((e) => (
                            <div key={e.label}>
                              <p className="text-2xl font-bold text-foreground">
                                {e.val !== null && e.val !== undefined ? e.val : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">{e.label}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Top talentfoci */}
                  {(tendenzen.talentfoci ?? []).length > 0 && (
                    <Card>
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {uiTaal === "nl" ? "Top talentfoci" : "Top talent foci"}
                        </h3>
                        <div className="space-y-1.5">
                          {tendenzen.talentfoci!.slice(0, 5).map((f) => (
                            <div key={f.naam} className="flex items-center justify-between">
                              <span className="text-sm text-foreground">{f.naam}</span>
                              <Badge variant="outline" className="text-xs">{f.gemNet > 0 ? "+" : ""}{f.gemNet}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Driver belasting */}
                  {tendenzen.driverBelasting && (
                    <Card>
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {uiTaal === "nl" ? "Driver belasting" : "Driver load"}
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          {[
                            { label: uiTaal === "nl" ? "Hoog risico" : "High risk", val: tendenzen.driverBelasting.hoog, cls: "text-destructive" },
                            { label: uiTaal === "nl" ? "Matig" : "Moderate", val: tendenzen.driverBelasting.matig, cls: "text-amber-600 dark:text-amber-400" },
                            { label: uiTaal === "nl" ? "Laag" : "Low", val: tendenzen.driverBelasting.laag, cls: "text-emerald-600 dark:text-emerald-400" },
                          ].map((d) => (
                            <div key={d.label}>
                              <p className={`text-2xl font-bold ${d.cls}`}>{d.val}</p>
                              <p className="text-xs text-muted-foreground">{d.label}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null
            )}
          </>
        )}
      </main>
    </div>
  );
}
