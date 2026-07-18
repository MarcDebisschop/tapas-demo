import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { AdminAfnameDetail } from "@/lib/types";
import { CheckCircle2, Mail, ArrowRight } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL, DATE_LOCALE } from "@shared/i18n";

interface KoppelResultaat {
  dashboardToken: string;
  dashboardCode: string;
  voornaam: string | null;
}

// Absolute, deelbare link naar het persoonlijk dashboard (hash-routing).
function dashboardUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/#/dashboard/${token}`;
}

export default function Klaar() {
  const params = useParams();
  const id = Number(params.id);

  // Het profiel wordt door de connection-POST al aangemaakt (status "voltooid")
  // vóór navigatie hierheen. We pollen zacht tot dat bevestigd is, zodat de
  // "Naar mijn dashboard"-knop pas verschijnt als het profiel echt klaar is.
  const { data, isLoading } = useQuery<AdminAfnameDetail>({
    queryKey: ["/api/admin/afnames", id],
    refetchInterval: (q) =>
      (q.state.data as AdminAfnameDetail | undefined)?.status === "voltooid" ? false : 2000,
  });
  const taal = normaliseerTaal((data as any)?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  const profielKlaar = data?.status === "voltooid";

  const [email, setEmail] = useState("");
  const [resultaat, setResultaat] = useState<KoppelResultaat | null>(null);

  const koppel = useMutation({
    mutationFn: async (adres: string) => {
      const res = await apiRequest("POST", `/api/afnames/${id}/koppel-dashboard`, { email: adres });
      return (await res.json()) as KoppelResultaat;
    },
    onSuccess: (r) => setResultaat(r),
  });

  const emailGeldig = /.+@.+\..+/.test(email.trim());

  function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (!emailGeldig) return;
    koppel.mutate(email.trim());
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {t("klaar_geregistreerd_titel")}
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("klaar_geregistreerd_body")}</p>
        </div>

        <Card className="mt-8">
          <CardContent className="p-5">
            {isLoading || !data ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("klaar_respondentcode")}</dt>
                  <dd className="font-medium text-foreground" data-testid="text-code">{data.respondentCode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("klaar_voltooid_op")}</dt>
                  <dd className="font-medium text-foreground">
                    {data.completedAt ? new Date(data.completedAt).toLocaleString(DATE_LOCALE[taal]) : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Optie A — e-mail verzamelen op het eindscherm (niet in deel2). */}
        {!resultaat ? (
          <Card className="mt-6">
            <CardContent className="p-5">
              <form onSubmit={verstuur} className="flex flex-col gap-3">
                <label htmlFor="klaar-email" className="text-sm font-medium text-foreground">
                  {t("klaar_email_prompt")}
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="klaar-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t("klaar_email_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label={t("klaar_email_label")}
                    data-testid="input-email"
                    className="sm:flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!emailGeldig || koppel.isPending}
                    data-testid="button-koppel-dashboard"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {koppel.isPending ? t("klaar_bezig") : t("knop_stuur_toegang")}
                  </Button>
                </div>
                {koppel.isError && (
                  <p className="text-sm text-destructive" data-testid="text-email-error">
                    {t("klaar_email_fout")}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 border-accent/40">
            <CardContent className="p-5">
              <h2 className="text-base font-semibold text-foreground">{t("klaar_toegang_titel")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("klaar_dashboard_uitleg")}</p>

              <div className="mt-4">
                <div className="text-xs text-muted-foreground">{t("klaar_dashboard_link_label")}</div>
                <a
                  href={dashboardUrl(resultaat.dashboardToken)}
                  className="break-all text-sm font-medium text-accent underline underline-offset-2"
                  data-testid="link-dashboard-url"
                >
                  {dashboardUrl(resultaat.dashboardToken)}
                </a>
              </div>

              <div className="mt-4">
                <div className="text-xs text-muted-foreground">{t("klaar_code_label")}</div>
                <div
                  className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em] text-foreground"
                  data-testid="text-dashboard-code"
                >
                  {resultaat.dashboardCode}
                </div>
              </div>

              <div className="mt-5">
                {profielKlaar ? (
                  <Button asChild className="w-full sm:w-auto" data-testid="button-naar-dashboard">
                    <a href={dashboardUrl(resultaat.dashboardToken)}>
                      {t("knop_naar_dashboard")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-wacht-profiel">
                    {t("klaar_wacht_profiel")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-to-home">{t("knop_naar_start")}</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
