import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAfnameDetail } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";
import { maakVertaler, normaliseerTaal, STANDAARD_TAAL, DATE_LOCALE } from "@shared/i18n";

export default function Klaar() {
  const params = useParams();
  const id = Number(params.id);
  const { data, isLoading } = useQuery<AdminAfnameDetail>({
    queryKey: ["/api/admin/afnames", id],
  });
  const taal = normaliseerTaal((data as any)?.taal ?? STANDAARD_TAAL);
  const t = maakVertaler(taal);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{t("klaar_dank_titel")}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("klaar_body")}</p>
        </div>

        <Card className="mt-8">
          <CardContent className="p-5">
            {isLoading || !data ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("klaar_respondentcode")}</dt>
                  <dd className="font-medium text-foreground" data-testid="text-code">{data.respondentCode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("veld_naam")}</dt>
                  <dd className="font-medium text-foreground" data-testid="text-name">{data.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("klaar_status")}</dt>
                  <dd className="font-medium text-foreground" data-testid="text-status">{data.status}</dd>
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

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/admin">
            <Button variant="outline" data-testid="link-to-admin">{t("knop_naar_admin")}</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" data-testid="link-to-home">{t("knop_naar_start")}</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
