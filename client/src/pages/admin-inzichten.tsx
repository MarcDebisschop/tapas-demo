// ---------------------------------------------------------------------------
// AdminInzichten — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: KPe()
// Sub-componenten: b1 (KPI card), Md (grafiek), NS (binnenkort), VPe, $Pe
// API: /api/inzichtcentrum/overzicht, /api/organisaties
// ---------------------------------------------------------------------------

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  Languages,
  Download,
  TriangleAlert,
  Users,
  Building2,
  Clock,
} from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";


// -----------------------------------------------------------------------
// KPI card (b1 uit bundle)
// -----------------------------------------------------------------------
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------
// Staafgrafiek rij (Md uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
function VerdelingRij({ label, aantal, totaal, benchmarkPct, weergave, onderdrukt, t }: {
  label: string;
  aantal: number | null;
  totaal: number;
  benchmarkPct: number | null;
  weergave: "aantal" | "percentage";
  onderdrukt: boolean;
  t: (s: string) => string;
}) {
  if (onderdrukt) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground italic">{t("iz_te_weinig_data")}</span>
      </div>
    );
  }
  if (aantal == null || aantal === 0) return null;
  const pct = totaal > 0 ? Math.round((aantal / totaal) * 1000) / 10 : 0;
  const breedte = Math.min(100, totaal > 0 ? Math.round((aantal / totaal) * 100) : 0);
  const weergaveWaarde = weergave === "percentage" ? `${pct}%` : String(aantal);

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{weergaveWaarde}</span>
        {benchmarkPct != null && (
          <span className="shrink-0 text-xs text-muted-foreground/70">(ref: {benchmarkPct}%)</span>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${breedte}%` }} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Grafiek card (Md uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
interface VerdelingRijData {
  sleutel: string;
  label: string;
  aantal: number | null;
  onderdrukt?: boolean;
  benchmarkPct: number | null;
}

function GrafiekCard({ titel, rijen, weergave, toonBenchmark, t }: {
  titel: string;
  rijen: VerdelingRijData[];
  weergave: "aantal" | "percentage";
  toonBenchmark: boolean;
  t: (s: string) => string;
}) {
  const zichtbaar = rijen.filter((r) => !r.onderdrukt && (r.aantal ?? 0) > 0);
  const totaal = zichtbaar.reduce((s, r) => s + (r.aantal ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{titel}</CardTitle>
      </CardHeader>
      <CardContent>
        {rijen.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("iz_geen_data")}</p>
        ) : (
          <div className="space-y-0.5">
            {rijen.map((r) => (
              <VerdelingRij
                key={r.sleutel}
                label={r.label}
                aantal={r.aantal}
                totaal={totaal}
                benchmarkPct={toonBenchmark ? r.benchmarkPct : null}
                weergave={weergave}
                onderdrukt={r.onderdrukt ?? false}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Evolutiegrafiek ($Pe uit bundle — vereenvoudigd als tabel)
// -----------------------------------------------------------------------
function EvolutieGrafiek({ rijen, t }: { rijen: any[]; t: (s: string) => string }) {
  if (rijen.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("iz_evolutie_titel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t("iz_evolutie_geen")}</p>
        </CardContent>
      </Card>
    );
  }
  const max = Math.max(...rijen.map((r) => r.aantal ?? 0), 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("iz_evolutie_titel")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-24">
          {rijen.map((r, i) => {
            const h = r.onderdrukt ? 4 : Math.max(4, Math.round(((r.aantal ?? 0) / max) * 96));
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-primary/60"
                  style={{ height: `${h}px` }}
                  title={r.onderdrukt ? t("iz_te_weinig_data") : `${r.maand}: ${r.aantal}`}
                />
                <span className="text-[9px] text-muted-foreground rotate-45 origin-left translate-x-1">{r.maand?.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Binnenkort card (NS uit bundle)
// -----------------------------------------------------------------------
function BinnenkortCard({ titel, tekst, badge, drempel, t }: {
  titel: string;
  tekst: string;
  badge: string;
  drempel: { benodigd: number; huidig: number; gehaald: boolean };
  t: (s: string) => string;
}) {
  const pct = drempel.benodigd > 0 ? Math.min(100, Math.round((drempel.huidig / drempel.benodigd) * 100)) : 0;
  const beschikbaarVanaf = t("iz_drempel_beschikbaar_vanaf").replace("{benodigd}", String(drempel.benodigd));
  const stand = t("iz_drempel_stand").replace("{huidig}", String(drempel.huidig)).replace("{benodigd}", String(drempel.benodigd));

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{titel}</p>
          {drempel.gehaald ? (
            <Badge className="shrink-0 bg-primary/10 text-primary">{t("iz_drempel_gehaald")}</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">{badge}</Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{tekst}</p>
        {!drempel.gehaald && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{stand}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/50 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{beschikbaarVanaf}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Bevindingen (VPe uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
function Bevindingen({ bevindingen, t }: { bevindingen: string[]; t: (s: string) => string }) {
  if (bevindingen.length === 0) return null;
  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("iz_bevindingen_titel")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{t("iz_bevindingen_intro")}</p>
        <ul className="space-y-1.5">
          {bevindingen.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// CSV escape helper
// -----------------------------------------------------------------------
function csvEscape(s: string): string {
  const str = String(s ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit KPe() in bundle
// -----------------------------------------------------------------------
export default function AdminInzichten() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);
  const [as_, setAs] = useState<"platform" | "organisatie">("platform");
  const [orgId, setOrgId] = useState("");
  const [weergave, setWeergave] = useState<"aantal" | "percentage">("aantal");

  const { data: organisaties } = useQuery<any[]>({ queryKey: ["/api/organisaties"] });

  const apiUrl =
    as_ === "organisatie" && orgId
      ? `/api/inzichtcentrum/overzicht?organisatie_id=${orgId}`
      : "/api/inzichtcentrum/overzicht";
  const enabled = as_ === "platform" || (as_ === "organisatie" && !!orgId);

  const { data: overzicht, isLoading } = useQuery<any>({
    queryKey: [apiUrl],
    enabled,
  });

  const isOrg = as_ === "organisatie" && !!overzicht && overzicht.as === "organisatie";

  // Bevindingen (vereenvoudigd — op basis van beschikbare data)
  const bevindingen = useMemo((): string[] => {
    if (!overzicht) return [];
    const res: string[] = [];
    if (overzicht.totalen.afnamesTotaal > 0) {
      res.push(`${overzicht.totalen.afnamesVoltooid} van de ${overzicht.totalen.afnamesTotaal} afnames zijn voltooid.`);
    }
    if (overzicht.coachNetwerk?.totaalActief > 0) {
      res.push(`Het coachnetwerk telt ${overzicht.coachNetwerk.totaalActief} actieve coaches.`);
    }
    return res.slice(0, 3);
  }, [overzicht]);

  // CSV export (exact uit bundle — vereenvoudigd)
  function exporteerCsv() {
    if (!overzicht) return;
    const teWeinig = n("iz_te_weinig_data");
    const rijen: string[] = [];
    const titel = isOrg && overzicht.organisatie ? overzicht.organisatie.naam : n("iz_as_breed");
    rijen.push([n("iz_titel"), titel, overzicht.gegenereerdOp].map(csvEscape).join(","));
    rijen.push("");
    rijen.push(csvEscape(n("iz_export_sectie_kpi")));
    rijen.push([n("iz_kpi_afnames_totaal"), overzicht.totalen.afnamesTotaal].map(csvEscape).join(","));
    rijen.push([n("iz_kpi_afnames_voltooid"), overzicht.totalen.afnamesVoltooid].map(csvEscape).join(","));
    rijen.push([n("iz_kpi_organisaties"), overzicht.totalen.organisaties].map(csvEscape).join(","));
    rijen.push([n("iz_kpi_deelnemers"), overzicht.totalen.deelnemers].map(csvEscape).join(","));
    rijen.push("");
    rijen.push(csvEscape(n("iz_export_sectie_bevindingen")));
    if (bevindingen.length === 0) rijen.push(csvEscape(n("iz_bevindingen_geen")));
    else for (const b of bevindingen) rijen.push(csvEscape(b));
    rijen.push("");
    rijen.push(csvEscape(n("iz_export_sectie_evolutie")));
    for (const e of (overzicht.evolutie ?? [])) {
      const v = e.onderdrukt ? teWeinig : String(e.aantal ?? 0);
      rijen.push([e.maand, v].map(csvEscape).join(","));
    }
    const csv = "\uFEFF" + rijen.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    const orgSlug = isOrg && overzicht.organisatie ? `org-${overzicht.organisatie.id}` : "platform";
    a.href = URL.createObjectURL(blob);
    a.download = `inzichtcentrum-${orgSlug}-${overzicht.gegenereerdOp.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-8 w-[112px]" data-testid="select-ui-taal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALEN.map((l) => (
                    <SelectItem key={l} value={l}>{TAAL_NAMEN[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/admin">
              <Button size="sm" variant="outline" data-testid="link-admin-terug">{n("iz_nav")}</Button>
            </Link>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{n("iz_titel")}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{n("iz_intro")}</p>

        {/* Banner */}
        <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/5 p-4" data-testid="banner-claimgrenzen">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">{n("iz_banner_titel")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n("iz_banner_tekst")}</p>
            </div>
          </div>
        </div>

        {/* Bevindingen */}
        {overzicht && <Bevindingen bevindingen={bevindingen} t={n} />}

        {/* Tabs + organisatiekiezer */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="inline-flex rounded-md border border-border p-0.5" role="tablist">
            <button
              type="button"
              onClick={() => setAs("platform")}
              data-testid="tab-as-platform"
              className={`rounded px-3 py-1.5 text-sm transition-colors ${as_ === "platform" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {n("iz_as_breed")}
            </button>
            <button
              type="button"
              onClick={() => setAs("organisatie")}
              data-testid="tab-as-organisatie"
              className={`rounded px-3 py-1.5 text-sm transition-colors ${as_ === "organisatie" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {n("iz_as_organisatie")}
            </button>
          </div>
          {as_ === "organisatie" && (
            <div className="w-full sm:w-64">
              <Label className="text-xs">{n("iz_kies_org")}</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger className="mt-1" data-testid="select-inzicht-org">
                  <SelectValue placeholder={n("iz_kies_org")} />
                </SelectTrigger>
                <SelectContent>
                  {(organisaties ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Inhoud */}
        {as_ === "organisatie" && !orgId ? (
          <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="inzicht-kies-org">
            <Building2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
            {n("iz_kies_org_leeg")}
          </div>
        ) : isLoading || !overzicht ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label={n("iz_kpi_afnames_totaal")} value={String(overzicht.totalen.afnamesTotaal)} />
              <KpiCard label={n("iz_kpi_afnames_voltooid")} value={String(overzicht.totalen.afnamesVoltooid)} />
              <KpiCard label={n("iz_kpi_organisaties")} value={String(overzicht.totalen.organisaties)} />
              <KpiCard label={n("iz_kpi_deelnemers")} value={String(overzicht.totalen.deelnemers)} />
            </div>

            {/* Weergave toggle + export */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{n("iz_weergave_label")}</span>
                <div className="inline-flex rounded-md border border-border p-0.5" role="tablist">
                  <button
                    type="button"
                    onClick={() => setWeergave("aantal")}
                    data-testid="tab-weergave-aantal"
                    className={`rounded px-3 py-1 text-xs transition-colors ${weergave === "aantal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {n("iz_weergave_aantal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeergave("percentage")}
                    data-testid="tab-weergave-percentage"
                    className={`rounded px-3 py-1 text-xs transition-colors ${weergave === "percentage" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {n("iz_weergave_percentage")}
                  </button>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={exporteerCsv} data-testid="knop-export-csv">
                <Download className="mr-1.5 h-4 w-4" aria-hidden />
                {n("iz_export_knop")}
              </Button>
            </div>

            {/* Verdelingsgrafieken */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <GrafiekCard titel={n("iz_verdeling_gender")} rijen={overzicht.gender ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
              <GrafiekCard titel={n("iz_verdeling_niveau")} rijen={overzicht.roleLevel ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
              <GrafiekCard titel={n("iz_verdeling_sector")} rijen={overzicht.sector ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
              <GrafiekCard titel={n("iz_verdeling_land")} rijen={overzicht.land ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
              <GrafiekCard titel={n("iz_verdeling_type")} rijen={overzicht.organisatieType ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
              <GrafiekCard titel={n("iz_verdeling_instrument")} rijen={overzicht.instrument ?? []} weergave={weergave} toonBenchmark={isOrg} t={n} />
            </div>

            {/* Evolutie */}
            <div className="mt-4">
              <EvolutieGrafiek rijen={overzicht.evolutie ?? []} t={n} />
            </div>

            {/* Coach netwerk */}
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-foreground" data-testid="kop-coachnetwerk">{n("iz_coachnetwerk_titel")}</h2>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="coachnetwerk-totaal">
                {n("iz_coachnetwerk_totaal").replace("{n}", String(overzicht.coachNetwerk?.totaalActief ?? 0))}
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <GrafiekCard titel={n("iz_coachnetwerk_per_land")} rijen={overzicht.coachNetwerk?.perLand ?? []} weergave="aantal" toonBenchmark={false} t={n} />
                <GrafiekCard titel={n("iz_coachnetwerk_per_regio")} rijen={overzicht.coachNetwerk?.perRegio ?? []} weergave="aantal" toonBenchmark={false} t={n} />
                <GrafiekCard titel={n("iz_coachnetwerk_per_accreditatie")} rijen={overzicht.coachNetwerk?.perAccreditatie ?? []} weergave="aantal" toonBenchmark={false} t={n} />
              </div>
            </div>

            {/* Binnenkort */}
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-foreground">{n("iz_binnenkort_titel")}</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <BinnenkortCard
                  titel={n("iz_soon_factor_titel")}
                  tekst={n("iz_soon_factor_tekst")}
                  badge={n("iz_badge_ontwikkeling")}
                  drempel={overzicht.drempels?.factoranalyse ?? { benodigd: 300, huidig: 0, gehaald: false }}
                  t={n}
                />
                <BinnenkortCard
                  titel={n("iz_soon_radar_titel")}
                  tekst={n("iz_soon_radar_tekst")}
                  badge={n("iz_badge_ontwikkeling")}
                  drempel={overzicht.drempels?.radar ?? { benodigd: 150, huidig: 0, gehaald: false }}
                  t={n}
                />
                <BinnenkortCard
                  titel={n("iz_soon_brug_titel")}
                  tekst={n("iz_soon_brug_tekst")}
                  badge={n("iz_badge_ontwikkeling")}
                  drempel={overzicht.drempels?.brug ?? { benodigd: 500, huidig: 0, gehaald: false }}
                  t={n}
                />
              </div>
            </div>

            {/* Credits sectie */}
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{n("iz_credit_titel")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{n("iz_credit_tekst")}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                  <li>· {n("iz_credit_niveau_basis")}</li>
                  <li>· {n("iz_credit_niveau_verdieping")}</li>
                  <li>· {n("iz_credit_niveau_diepte")}</li>
                  <li>· {n("iz_credit_niveau_monitoring")}</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">{n("iz_credit_voet")}</p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
