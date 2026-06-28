// ---------------------------------------------------------------------------
// coach-aanvraag.tsx — Self-service accreditatie-aanvraag voor coaches
// (Regel 2: nieuw bestand — raakt geen bestaand protected of gevalideerd bestand)
//
// FLOW
//   1. Coach vult formulier in (naam, email, opleiding, motivatie, regio).
//   2. POST /api/coach-aanvraag → server slaat op in coach_aanvragen tabel.
//   3. Admin ziet de aanvraag in AdminCoaches (stub: bevestiging-tekst getoond).
//   4. Admin keurt goed → maakt coach aan via bestaande POST /api/admin/coaches.
//
// UX-principes
//   - Zelfde visuele stijl als Academy-pagina (TaPas business skin).
//   - Geen admin-knop zichtbaar — puur publieke self-service flow.
//   - Na indiening: bevestigingscherm, geen redirect.
//   - Velden: naam, email, regio, opleidingTitel, motivatie (vrij tekstveld).
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Award, CheckCircle2, Send } from "lucide-react";

// ─── Constanten ──────────────────────────────────────────────────────────────

const REGIO_OPTIES = [
  "Antwerpen",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Vlaams-Brabant",
  "Limburg",
  "Brussel",
  "Vlaanderen",
  "Nederland",
  "Andere",
];

const NIVEAUS = [
  "TaPas Accreditatie – Niveau 1",
  "TaPas Accreditatie – Niveau 2",
  "TaPas Accreditatie – Niveau 3",
  "TaPas Jester – Niveau 4",
];

const LEEG = {
  naam: "",
  email: "",
  regio: "",
  opleidingTitel: "",
  motivatie: "",
  niveau: "",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CoachAanvraag() {
  const { toast } = useToast();
  const [form, setForm] = useState(LEEG);
  const [ingediend, setIngediend] = useState(false);

  // ── Mutatie ──
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/coach-aanvraag", {
        naam: form.naam.trim(),
        email: form.email.trim(),
        regio: form.regio,
        opleidingTitel: form.opleidingTitel.trim(),
        niveau: form.niveau,
        motivatie: form.motivatie.trim(),
      }),
    onSuccess: () => {
      setIngediend(true);
    },
    onError: () => {
      toast({
        title: "Oops — aanvraag niet verstuurd",
        description:
          "Probeer het opnieuw of neem contact op via info@tapascity.com.",
        variant: "destructive",
      });
    },
  });

  // ── Validatie ──
  const geldig =
    form.naam.trim().length >= 2 &&
    form.email.includes("@") &&
    form.regio &&
    form.opleidingTitel.trim().length >= 3 &&
    form.niveau &&
    form.motivatie.trim().length >= 20;

  // ── Helpers ──
  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Bevestigingscherm ──
  if (ingediend) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader
          right={
            <Link href="/academy">
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar Academy
              </Button>
            </Link>
          }
        />
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent" />
          <h1 className="mt-6 text-2xl font-semibold text-foreground">
            Aanvraag ontvangen
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Bedankt, {form.naam.split(" ")[0]}. We hebben je accreditatie-aanvraag
            ontvangen en bezorgen je binnen enkele werkdagen een reactie op{" "}
            <span className="font-medium text-foreground">{form.email}</span>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Heb je vragen? Mail naar{" "}
            <a
              href="mailto:info@tapascity.com"
              className="text-accent underline underline-offset-2"
            >
              info@tapascity.com
            </a>
            .
          </p>
          <Link href="/coaches">
            <Button className="mt-10" variant="outline">
              Bekijk het coachregister
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  // ── Aanvraagformulier ──
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <Link href="/academy">
            <Button size="sm" variant="outline" data-testid="link-terug-academy">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar Academy
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* ── Intro ── */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Award className="h-3.5 w-3.5 text-accent" />
            Coach self-service · accreditatie aanvragen
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Word geaccrediteerd TaPas-coach
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Dien hier je aanvraag in voor een TaPas-accreditatie. Na beoordeling
            door het TaPas-team wordt je profiel — mits goedgekeurd en na je
            toestemming — zichtbaar in het publieke coachregister.
          </p>
        </div>

        {/* ── Formulier ── */}
        <Card className="mt-8">
          <CardContent className="space-y-5 p-6">
            {/* Naam */}
            <div className="space-y-1.5">
              <Label htmlFor="naam">Volledige naam</Label>
              <Input
                id="naam"
                data-testid="input-naam"
                placeholder="Voornaam Familienaam"
                value={form.naam}
                onChange={(e) => set("naam", e.target.value)}
                autoComplete="name"
              />
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="jouw@email.be"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Regio */}
            <div className="space-y-1.5">
              <Label>Regio / provincie</Label>
              <Select value={form.regio} onValueChange={(v) => set("regio", v)}>
                <SelectTrigger data-testid="select-regio">
                  <SelectValue placeholder="Selecteer een regio" />
                </SelectTrigger>
                <SelectContent>
                  {REGIO_OPTIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opleiding */}
            <div className="space-y-1.5">
              <Label htmlFor="opleiding">
                Gevolgde opleiding of certificering
              </Label>
              <Input
                id="opleiding"
                data-testid="input-opleiding"
                placeholder="Bv. TaPas Basisopleiding 2024, Leuven"
                value={form.opleidingTitel}
                onChange={(e) => set("opleidingTitel", e.target.value)}
              />
            </div>

            {/* Niveau */}
            <div className="space-y-1.5">
              <Label>Gevraagd accreditatieniveau</Label>
              <Select value={form.niveau} onValueChange={(v) => set("niveau", v)}>
                <SelectTrigger data-testid="select-niveau">
                  <SelectValue placeholder="Selecteer een niveau" />
                </SelectTrigger>
                <SelectContent>
                  {NIVEAUS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Motivatie */}
            <div className="space-y-1.5">
              <Label htmlFor="motivatie">
                Motivatie / aanvullende informatie
              </Label>
              <Textarea
                id="motivatie"
                data-testid="textarea-motivatie"
                placeholder="Vertel kort waarom je TaPas-coach wil worden en welke ervaring je meebrengt…"
                className="min-h-[110px] resize-none"
                value={form.motivatie}
                onChange={(e) => set("motivatie", e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {form.motivatie.length} / min. 20 tekens
              </p>
            </div>

            {/* GDPR-nota */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Door in te dienen geef je TaPasCity toestemming om je gegevens te
              bewaren voor de beoordeling van je aanvraag. Je gegevens worden
              nooit zonder expliciete toestemming in het publieke register
              opgenomen.
            </p>

            {/* Submit */}
            <Button
              className="w-full"
              disabled={!geldig || isPending}
              onClick={() => mutate()}
              data-testid="button-indienen"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Versturen…" : "Aanvraag indienen"}
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Vragen over het accreditatietraject? Bezoek{" "}
          <Link href="/academy">
            <a className="text-accent underline underline-offset-2">de Academy</a>
          </Link>{" "}
          of mail naar{" "}
          <a
            href="mailto:info@tapascity.com"
            className="text-accent underline underline-offset-2"
          >
            info@tapascity.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
