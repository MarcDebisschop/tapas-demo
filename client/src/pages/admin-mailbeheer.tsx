/**
 * Admin Mailbeheer — overzicht van mailsjablonen
 *
 * Demo-versie: toont de vaste mailsjablonen die het platform verstuurt.
 * Read-only — geen bewerking mogelijk in de demo.
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
import { Mail, Languages, Send, Bell, CheckCircle2, FileText } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

// Vaste mailsjablonen — beschrijving van wat het platform verstuurt
const SJABLONEN = [
  {
    id: "uitnodiging",
    icon: Send,
    trigger: { nl: "Bij aanmaken uitnodiging", fr: "Lors de la création d'une invitation", en: "On invitation creation" },
    titel: { nl: "Uitnodiging voor deelname", fr: "Invitation à participer", en: "Invitation to participate" },
    ontvanger: { nl: "Deelnemer", fr: "Participant", en: "Participant" },
    omschrijving: {
      nl: "Verstuurd naar de deelnemer met hun persoonlijke deelname-link. Bevat naam, instrument en taal.",
      fr: "Envoyé au participant avec son lien personnel. Contient le nom, l'instrument et la langue.",
      en: "Sent to the participant with their personal participation link. Contains name, instrument and language.",
    },
    talen: ["nl", "fr", "en", "es", "ru"],
    status: "actief",
  },
  {
    id: "herinnering",
    icon: Bell,
    trigger: { nl: "Bij klik op 'Herinner'", fr: "Au clic sur 'Rappeler'", en: "On click 'Remind'" },
    titel: { nl: "Herinnering deelname", fr: "Rappel de participation", en: "Participation reminder" },
    ontvanger: { nl: "Deelnemer", fr: "Participant", en: "Participant" },
    omschrijving: {
      nl: "Herinneringsmail voor deelnemers die nog niet gestart zijn. Bevat opnieuw de deelname-link.",
      fr: "E-mail de rappel pour les participants qui n'ont pas encore commencé.",
      en: "Reminder email for participants who have not yet started. Contains the participation link again.",
    },
    talen: ["nl", "fr", "en", "es", "ru"],
    status: "actief",
  },
  {
    id: "voltooid",
    icon: CheckCircle2,
    trigger: { nl: "Bij voltooiing vragenlijst", fr: "À la fin du questionnaire", en: "On questionnaire completion" },
    titel: { nl: "Bevestiging voltooiing", fr: "Confirmation de completion", en: "Completion confirmation" },
    ontvanger: { nl: "Deelnemer + beheerder", fr: "Participant + gestionnaire", en: "Participant + admin" },
    omschrijving: {
      nl: "Automatische bevestiging na voltooiing. De deelnemer ontvangt een dankbetuiging; de beheerder een melding.",
      fr: "Confirmation automatique après la complétion. Le participant reçoit un remerciement; le gestionnaire une notification.",
      en: "Automatic confirmation after completion. The participant receives a thank-you; the admin a notification.",
    },
    talen: ["nl", "fr", "en", "es", "ru"],
    status: "actief",
  },
  {
    id: "rapport",
    icon: FileText,
    trigger: { nl: "Bij genereren rapport", fr: "Lors de la génération du rapport", en: "On report generation" },
    titel: { nl: "Rapport beschikbaar", fr: "Rapport disponible", en: "Report available" },
    ontvanger: { nl: "Deelnemer", fr: "Participant", en: "Participant" },
    omschrijving: {
      nl: "Verstuurd zodra het TaPas Kompas of Coachatlas beschikbaar is. Bevat link naar het persoonlijk dashboard.",
      fr: "Envoyé dès que le TaPas Kompas ou le Coachatlas est disponible. Contient le lien vers le tableau de bord.",
      en: "Sent as soon as the TaPas Kompas or Coach Atlas is available. Contains link to the personal dashboard.",
    },
    talen: ["nl", "fr", "en", "es", "ru"],
    status: "actief",
  },
  {
    id: "consent",
    icon: Mail,
    trigger: { nl: "Bij toestemmingsstap", fr: "À l'étape de consentement", en: "At consent step" },
    titel: { nl: "Toestemmingsbevestiging", fr: "Confirmation de consentement", en: "Consent confirmation" },
    ontvanger: { nl: "Deelnemer", fr: "Participant", en: "Participant" },
    omschrijving: {
      nl: "GDPR-conforme bevestiging van toestemming voor dataverwerking. Bevat overzicht van verwerkte gegevens.",
      fr: "Confirmation conforme RGPD du consentement au traitement des données.",
      en: "GDPR-compliant confirmation of consent for data processing.",
    },
    talen: ["nl", "fr", "en", "es", "ru"],
    status: "actief",
  },
  {
    id: "factuur",
    icon: FileText,
    trigger: { nl: "Bij betaling creditpakket", fr: "Lors du paiement d'un pack de crédits", en: "On credit package payment" },
    titel: { nl: "Factuur creditpakket", fr: "Facture pack de crédits", en: "Credit package invoice" },
    ontvanger: { nl: "Beheerder / organisatie", fr: "Gestionnaire / organisation", en: "Admin / organisation" },
    omschrijving: {
      nl: "Factuurbevestiging na aankoop van credits. Bevat factuurdetails en transactiereferentie.",
      fr: "Confirmation de facture après achat de crédits.",
      en: "Invoice confirmation after purchasing credits. Contains invoice details and transaction reference.",
    },
    talen: ["nl"],
    status: "actief",
  },
];

export default function AdminMailbeheer() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const naam = (o: Record<string, string>) => o[uiTaal] ?? o.nl;

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
          <Mail className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("mailbeheer_nav")}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {uiTaal === "nl"
            ? "Overzicht van alle automatische mailsjablonen die het platform verstuurt."
            : uiTaal === "fr"
            ? "Aperçu de tous les modèles d'e-mails automatiques envoyés par la plateforme."
            : "Overview of all automatic email templates sent by the platform."}
        </p>

        {/* Info banner */}
        <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {uiTaal === "nl"
            ? "Mailsjablonen zijn beschikbaar in alle platformtalen (NL, FR, EN, ES, RU). Bewerken is beschikbaar in de volledige versie."
            : uiTaal === "fr"
            ? "Les modèles sont disponibles dans toutes les langues (NL, FR, EN, ES, RU). La modification est disponible dans la version complète."
            : "Templates are available in all platform languages (NL, FR, EN, ES, RU). Editing is available in the full version."}
        </div>

        {/* KPI */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Mail className="h-8 w-8 text-accent opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">{SJABLONEN.length}</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Sjablonen" : uiTaal === "fr" ? "Modèles" : "Templates"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-80" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {SJABLONEN.filter((s) => s.status === "actief").length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Actief" : uiTaal === "fr" ? "Actifs" : "Active"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">5</div>
              <div>
                <p className="text-2xl font-bold text-foreground">5</p>
                <p className="text-xs text-muted-foreground">
                  {uiTaal === "nl" ? "Talen" : uiTaal === "fr" ? "Langues" : "Languages"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sjablonen lijst */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {uiTaal === "nl" ? "Mailsjablonen" : uiTaal === "fr" ? "Modèles d'e-mails" : "Email templates"}
        </h2>
        <div className="mt-4 space-y-3">
          {SJABLONEN.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{naam(s.titel)}</span>
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                          {uiTaal === "nl" ? "Actief" : uiTaal === "fr" ? "Actif" : "Active"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {uiTaal === "nl" ? "Trigger" : "Trigger"}:
                        </span>{" "}{naam(s.trigger)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {uiTaal === "nl" ? "Ontvanger" : uiTaal === "fr" ? "Destinataire" : "Recipient"}:
                        </span>{" "}{naam(s.ontvanger)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{naam(s.omschrijving)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.talen.map((l) => (
                          <Badge key={l} variant="outline" className="text-xs uppercase">{l}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
