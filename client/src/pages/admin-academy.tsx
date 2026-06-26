/**
 * Admin Academy — TaPasAcademy beheer
 *
 * Demo-versie: toont een overzicht van de beschikbare Academy-modules
 * en accreditaties op basis van PLATFORMDELEN (geen eigen API nodig).
 * Read-only — geen acties.
 */

import { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, Languages, BookOpen, Award, Star } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { PLATFORMDELEN, type Platformdeel } from "@shared/platformdelen";

// Academy modules — vast gedefinieerd voor demo
const ACADEMY_MODULES = [
  {
    id: "t4p-basis",
    titel: { nl: "T4P Business Kompas — Basisopleiding", fr: "T4P Business Kompas — Formation de base", en: "T4P Business Kompas — Basic Training" },
    omschrijving: { nl: "Introductie tot het TaPas-model, talentfoci en energiebeheer voor coaches en HR-professionals.", fr: "Introduction au modèle TaPas, aux foci de talent et à la gestion d'énergie.", en: "Introduction to the TaPas model, talent foci and energy management." },
    duur: "2 dagen",
    niveau: "starter",
    status: "beschikbaar",
  },
  {
    id: "t4p-verdieping",
    titel: { nl: "T4P Business Kompas — Verdieping", fr: "T4P Business Kompas — Approfondissement", en: "T4P Business Kompas — Advanced" },
    omschrijving: { nl: "Diepgaande analyse van talentversnellers, drivers en coachingsinterventies op organisatieniveau.", fr: "Analyse approfondie des accélérateurs de talent et des drivers.", en: "In-depth analysis of talent accelerators, drivers and coaching interventions." },
    duur: "3 dagen",
    niveau: "gevorderd",
    status: "beschikbaar",
  },
  {
    id: "t4r",
    titel: { nl: "T4Recruitment — Selectieprofessional", fr: "T4Recruitment — Professionnel de la sélection", en: "T4Recruitment — Selection Professional" },
    omschrijving: { nl: "Gebruik van T4Recruitment in wervings- en selectietrajecten. Interviewtechnieken en rapportinterpretatie.", fr: "Utilisation de T4Recruitment dans les processus de recrutement.", en: "Using T4Recruitment in recruitment and selection processes." },
    duur: "1 dag",
    niveau: "starter",
    status: "beschikbaar",
  },
  {
    id: "teamscan",
    titel: { nl: "TeamScan — Teamanalyse & Facilitation", fr: "TeamScan — Analyse d'équipe & Facilitation", en: "TeamScan — Team Analysis & Facilitation" },
    omschrijving: { nl: "Teamdynamieken analyseren en faciliteren met de TeamScan. Rol van de coach bij teamontwikkeling.", fr: "Analyser et faciliter les dynamiques d'équipe avec le TeamScan.", en: "Analysing and facilitating team dynamics with the TeamScan." },
    duur: "2 dagen",
    niveau: "gevorderd",
    status: "binnenkort",
  },
  {
    id: "2minscan",
    titel: { nl: "2MinScan — Energetisch gedragsprofiel", fr: "2MinScan — Profil comportemental énergétique", en: "2MinScan — Energetic Behaviour Profile" },
    omschrijving: { nl: "Snelle energiescans integreren in coaching- en HR-trajecten. Interpretatie en rapportage.", fr: "Intégrer des scans d'énergie rapides dans les trajets de coaching et RH.", en: "Integrating rapid energy scans in coaching and HR journeys." },
    duur: "0,5 dag",
    niveau: "starter",
    status: "binnenkort",
  },
];

const NIVEAU_COLORS: Record<string, string> = {
  starter: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  gevorderd: "border-primary/30 bg-primary/10 text-primary",
  expert: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export default function AdminAcademy() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const accreditaties = PLATFORMDELEN.filter((d) => d.type === "accreditatie");

  const naam = (o: Record<Taal, string>) => o[uiTaal] ?? o.nl;

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
          <GraduationCap className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("acad_admin_nav")}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {uiTaal === "nl"
            ? "Overzicht van alle opleidingen en accreditaties binnen TaPasAcademy."
            : uiTaal === "fr"
            ? "Aperçu de toutes les formations et accréditations TaPasAcademy."
            : "Overview of all training modules and accreditations in TaPasAcademy."}
        </p>

        {/* KPI */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-accent opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">{ACADEMY_MODULES.length}</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Modules" : "Modules"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Award className="h-8 w-8 text-amber-500 opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">{accreditaties.length}</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Accreditaties" : "Accreditations"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Star className="h-8 w-8 text-emerald-500 opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {ACADEMY_MODULES.filter((m) => m.status === "beschikbaar").length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Beschikbaar" : "Available"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Opleidingsmodules */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {uiTaal === "nl" ? "Opleidingsmodules" : uiTaal === "fr" ? "Modules de formation" : "Training modules"}
        </h2>
        <div className="mt-4 space-y-3">
          {ACADEMY_MODULES.map((m) => (
            <Card key={m.id} className={m.status === "binnenkort" ? "opacity-70" : ""}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{naam(m.titel as Record<Taal, string>)}</span>
                      <Badge variant="outline" className={`text-xs ${NIVEAU_COLORS[m.niveau] ?? ""}`}>
                        {m.niveau}
                      </Badge>
                      {m.status === "binnenkort" && (
                        <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                          {uiTaal === "nl" ? "Binnenkort" : uiTaal === "fr" ? "Bientôt" : "Coming soon"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {naam(m.omschrijving as Record<Taal, string>)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">
                        {uiTaal === "nl" ? "Duur" : uiTaal === "fr" ? "Durée" : "Duration"}:
                      </span>{" "}{m.duur}
                    </p>
                  </div>
                  {m.status === "beschikbaar" && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                      {uiTaal === "nl" ? "Beschikbaar" : uiTaal === "fr" ? "Disponible" : "Available"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Accreditaties */}
        {accreditaties.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {uiTaal === "nl" ? "Accreditaties" : uiTaal === "fr" ? "Accréditations" : "Accreditations"}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {accreditaties.map((a) => (
                <Card key={a.id}
                  style={{ borderColor: "hsl(var(--gold) / 0.4)", background: "hsl(var(--gold) / 0.04)" }}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--gold))" }} />
                      <div>
                        <p className="font-semibold" style={{ color: "hsl(var(--gold))" }}>
                          {(a.naam as any)[uiTaal] ?? (a.naam as any).nl}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {(a.omschrijving as any)[uiTaal] ?? (a.omschrijving as any).nl}
                        </p>
                      </div>
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
