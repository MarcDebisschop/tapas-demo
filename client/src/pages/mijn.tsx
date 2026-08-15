// ---------------------------------------------------------------------------
// TaPas Platform — De deelnemersdeur (/mijn).
//
// WAT HIER VERANDERDE EN WAAROM
// Deze pagina postte naar POST /api/deelnemers/login. Die route geeft het
// dashboardToken onmiddellijk terug zodra er een e-mailadres wordt ingetikt,
// zonder enige controle dat de bezoeker dat adres ook bezit. Wie een adres
// kende, stond dus in het persoonlijke dashboard van die persoon.
//
// De pagina loopt nu langs POST /api/deelnemers/magic-link: de server maakt een
// eenmalig token dat 15 minuten geldig is en stuurt de link naar de mailbox van
// de deelnemer. De pagina krijgt zelf GEEN token en GEEN dashboardToken meer,
// en toont altijd exact dezelfde boodschap — ook bij een onbekend adres, zodat
// niemand kan aftasten welke adressen bestaan.
//
// Alleen in de demostand geeft de server de link mee in het antwoord, zodat het
// verloop zonder mailserver te volgen is. Buiten de demo blijft het antwoord
// leeg en is de mailbox de enige weg.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { TALEN, TAAL_NAMEN, normaliseerTaal, type Taal } from "@shared/i18n";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal) => m[t] ?? m.nl;

const STR = {
  titel: {
    nl: "Welkom bij jouw persoonlijke ruimte",
    fr: "Bienvenue dans votre espace personnel",
    en: "Welcome to your personal space",
    es: "Bienvenido a tu espacio personal",
    ru: "Добро пожаловать в ваше личное пространство",
  } as ML,
  intro: {
    nl: "Vul je e-mailadres in en we sturen je een persoonlijke toegangslink naar je dashboard — geen wachtwoord nodig. De link blijft 15 minuten geldig en werkt één keer.",
    fr: "Saisis ton e-mail et nous t'enverrons un lien d'accès personnel vers ton tableau de bord — sans mot de passe. Le lien reste valable 15 minutes et ne fonctionne qu'une fois.",
    en: "Enter your email and we'll send you a personal access link to your dashboard — no password needed. The link stays valid for 15 minutes and works once.",
    es: "Introduce tu correo y te enviaremos un enlace de acceso personal a tu panel — sin contraseña. El enlace es válido 15 minutos y funciona una vez.",
    ru: "Введите вашу почту, и мы отправим персональную ссылку на ваш дашборд — без пароля. Ссылка действует 15 минут и работает один раз.",
  } as ML,
  emailLabel: { nl: "E-mailadres", fr: "Adresse e-mail", en: "Email address", es: "Correo electrónico", ru: "Электронная почта" } as ML,
  taalLabel: { nl: "Taal", fr: "Langue", en: "Language", es: "Idioma", ru: "Язык" } as ML,
  knop: {
    nl: "Stuur mijn toegangslink",
    fr: "Envoyer mon lien d'accès",
    en: "Send my access link",
    es: "Enviar mi enlace de acceso",
    ru: "Отправить мою ссылку доступа",
  } as ML,
  klaarTitel: {
    nl: "Kijk in je mailbox",
    fr: "Consulte ta boîte mail",
    en: "Check your mailbox",
    es: "Revisa tu correo",
    ru: "Проверьте почту",
  } as ML,
  // Deze boodschap is met opzet neutraal: ze staat er ook wanneer het adres
  // onbekend is, zodat de pagina nooit verklapt welke adressen bestaan.
  klaarBody: {
    nl: "Is dit adres bij ons bekend, dan staat er nu een persoonlijke toegangslink in je mailbox. De link blijft 15 minuten geldig en werkt één keer. Vind je niets? Kijk ook bij ongewenste e-mail, of vraag hieronder een nieuwe link aan.",
    fr: "Si cette adresse nous est connue, un lien d'accès personnel se trouve maintenant dans ta boîte mail. Le lien reste valable 15 minutes et ne fonctionne qu'une fois. Rien reçu ? Vérifie les indésirables ou demande un nouveau lien ci-dessous.",
    en: "If we know this address, a personal access link is now in your mailbox. The link stays valid for 15 minutes and works once. Nothing there? Check your spam folder, or request a new link below.",
    es: "Si conocemos esta dirección, ahora hay un enlace de acceso personal en tu correo. El enlace es válido 15 minutos y funciona una vez. ¿No encuentras nada? Revisa el correo no deseado o solicita un nuevo enlace abajo.",
    ru: "Если этот адрес нам известен, персональная ссылка доступа уже в вашей почте. Ссылка действует 15 минут и работает один раз. Ничего нет? Проверьте спам или запросите новую ссылку ниже.",
  } as ML,
  opnieuw: { nl: "Vraag een nieuwe link aan", fr: "Demander un nouveau lien", en: "Request a new link", es: "Solicitar un nuevo enlace", ru: "Запросить новую ссылку" } as ML,
  demoTitel: { nl: "Demostand — geen mailserver", fr: "Mode démo — pas de serveur mail", en: "Demo mode — no mail server", es: "Modo demo — sin servidor de correo", ru: "Демо-режим — без почтового сервера" } as ML,
  demoBody: { nl: "Omdat dit de demostand is, staat de link hier. In productie gaat ze uitsluitend naar je mailbox.", fr: "Comme il s'agit du mode démo, le lien s'affiche ici. En production, il n'est envoyé que par e-mail.", en: "Because this is demo mode, the link is shown here. In production it only goes to your mailbox.", es: "Como este es el modo demo, el enlace se muestra aquí. En producción solo llega por correo.", ru: "Это демо-режим, поэтому ссылка показана здесь. В продакшене она приходит только на почту." } as ML,
  demoKnop: { nl: "Open de toegangslink", fr: "Ouvrir le lien d'accès", en: "Open the access link", es: "Abrir el enlace de acceso", ru: "Открыть ссылку доступа" } as ML,
  fout: { nl: "Er ging iets mis. Controleer je e-mailadres.", fr: "Une erreur s'est produite. Vérifie ton e-mail.", en: "Something went wrong. Check your email.", es: "Algo salió mal. Revisa tu correo.", ru: "Что-то пошло не так. Проверьте почту." } as ML,
};

type MagicAntwoord = {
  ok?: boolean;
  // Enkel in de demostand aanwezig. Buiten de demo geeft de server niets terug
  // waaruit je kunt aflezen of het adres bestaat.
  link?: string;
  geldigMinuten?: number;
};

export default function Mijn() {
  const [email, setEmail] = useState("");
  const [taal, setTaal] = useState<Taal>(normaliseerTaal(navigator.language?.slice(0, 2)));
  // `verzonden` zegt alleen dát de aanvraag verwerkt is — niet of het adres
  // bestaat. Er komt geen dashboardToken meer in deze pagina.
  const [verzonden, setVerzonden] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deelnemers/magic-link", { email });
      return res.json() as Promise<MagicAntwoord>;
    },
    onSuccess: (data) => {
      setVerzonden(true);
      setDemoLink(typeof data.link === "string" && data.link.length > 0 ? data.link : null);
    },
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground" data-testid="text-mijn-titel">
            {k(STR.titel, taal)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{k(STR.intro, taal)}</p>
        </div>

        <Card className="mt-8">
          <CardContent className="p-5">
            {verzonden ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Mail className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground" data-testid="text-mail-verstuurd">
                  {k(STR.klaarTitel, taal)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{k(STR.klaarBody, taal)}</p>

                {/* Enkel in de demostand: de link staat in het antwoord omdat er
                    geen mailserver is. In productie is dit blok afwezig. */}
                {demoLink && (
                  <div className="mt-4 w-full rounded-md border border-border bg-muted/40 p-3 text-left">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {k(STR.demoTitel, taal)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{k(STR.demoBody, taal)}</p>
                    <Button asChild className="mt-3 w-full" data-testid="button-demo-magic-link">
                      <a href={demoLink}>
                        {k(STR.demoKnop, taal)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  className="mt-3 w-full"
                  data-testid="button-nieuwe-link"
                  onClick={() => {
                    setVerzonden(false);
                    setDemoLink(null);
                    login.reset();
                  }}
                >
                  {k(STR.opnieuw, taal)}
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) login.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">{k(STR.emailLabel, taal)}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jij@voorbeeld.be"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{k(STR.taalLabel, taal)}</Label>
                  <Select value={taal} onValueChange={(v) => setTaal(v as Taal)}>
                    <SelectTrigger data-testid="select-taal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TALEN.map((t) => (
                        <SelectItem key={t} value={t} data-testid={`option-taal-${t}`}>
                          {TAAL_NAMEN[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {login.isError && (
                  <p className="text-sm text-destructive" data-testid="text-fout">{k(STR.fout, taal)}</p>
                )}
                <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-login">
                  {k(STR.knop, taal)}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
