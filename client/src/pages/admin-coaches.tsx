/**
 * Admin Coaches — overzicht van coaches/beheerders gekoppeld aan het platform
 *
 * Demo-versie: toont bestaande beheerders via /api/toegang/beheerders
 * Read-only — geen acties, enkel informatief overzicht voor demo-doeleinden.
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
import { Languages, Award, Users, Mail, Building2, CalendarDays } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

interface BeheerderMetToegang {
  id: number;
  naam: string;
  email: string;
  organisatie: string;
  isPrior: boolean;
  toegevoegdDoor: string | null;
  actief: boolean;
  createdAt: string;
  toegang: Record<string, boolean>;
}

const DATE_LOCALE: Record<Taal, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
  en: "en-GB",
  es: "es-ES",
  ru: "ru-RU",
};

export default function AdminCoaches() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const { data: beheerders, isLoading } = useQuery<BeheerderMetToegang[]>({
    queryKey: ["/api/toegang/beheerders"],
  });

  const actief = (beheerders ?? []).filter((b) => b.actief);
  const inactief = (beheerders ?? []).filter((b) => !b.actief);

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
          <Users className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("admin_nav_coaches")}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {uiTaal === "nl"
            ? "Overzicht van alle coaches en beheerders op het platform."
            : uiTaal === "fr"
            ? "Aperçu de tous les coachs et gestionnaires de la plateforme."
            : "Overview of all coaches and administrators on the platform."}
        </p>

        {/* KPI balk */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-accent opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">{(beheerders ?? []).length}</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Totaal" : uiTaal === "fr" ? "Total" : "Total"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                <span className="text-sm font-bold text-accent">{actief.length}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{actief.length}</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Actief" : uiTaal === "fr" ? "Actifs" : "Active"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Award className="h-8 w-8 text-amber-500 opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {(beheerders ?? []).filter((b) => b.isPrior).length}
                </p>
                <p className="text-xs text-muted-foreground">Prior</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actieve coaches */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {uiTaal === "nl" ? "Actieve coaches" : uiTaal === "fr" ? "Coachs actifs" : "Active coaches"}
          {" "}({actief.length})
        </h2>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : actief.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {uiTaal === "nl" ? "Geen actieve coaches gevonden." : "No active coaches found."}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {actief.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{b.naam}</span>
                        {b.isPrior && (
                          <Badge variant="outline" className="border-accent/30 bg-accent/15 text-accent text-xs">
                            <Award className="mr-1 h-3 w-3" /> Prior
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                          {uiTaal === "nl" ? "Actief" : uiTaal === "fr" ? "Actif" : "Active"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />{b.email}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />{b.organisatie}
                        </span>
                        {b.createdAt && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {new Date(b.createdAt).toLocaleDateString(DATE_LOCALE[uiTaal])}
                          </span>
                        )}
                      </div>
                      {/* Toegang-modules */}
                      {!b.isPrior && Object.keys(b.toegang ?? {}).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(b.toegang)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Inactieve coaches */}
        {inactief.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {uiTaal === "nl" ? "Inactieve coaches" : uiTaal === "fr" ? "Coachs inactifs" : "Inactive coaches"}
              {" "}({inactief.length})
            </h2>
            <div className="mt-4 space-y-3 opacity-60">
              {inactief.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{b.naam}</span>
                      <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive text-xs">
                        {uiTaal === "nl" ? "Inactief" : uiTaal === "fr" ? "Inactif" : "Inactive"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{b.email}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
