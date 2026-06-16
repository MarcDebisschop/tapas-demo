import { useState } from "react";
import { useLocation } from "wouter";
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
import { Sparkles, Mail, ArrowRight } from "lucide-react";
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
    nl: "Vul je e-mailadres in en we sturen je een persoonlijke toegangslink naar je dashboard — geen wachtwoord nodig.",
    fr: "Saisis ton e-mail et nous t'enverrons un lien d'accès personnel vers ton tableau de bord — sans mot de passe.",
    en: "Enter your email and we'll send you a personal access link to your dashboard — no password needed.",
    es: "Introduce tu correo y te enviaremos un enlace de acceso personal a tu panel — sin contraseña.",
    ru: "Введите вашу почту, и мы отправим персональную ссылку на ваш дашборд — без пароля.",
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
    nl: "Je toegangslink staat klaar",
    fr: "Ton lien d'accès est prêt",
    en: "Your access link is ready",
    es: "Tu enlace de acceso está listo",
    ru: "Ваша ссылка доступа готова",
  } as ML,
  klaarBody: {
    nl: "In de definitieve versie ontvang je deze link per e-mail. Klik hieronder om meteen door te gaan naar je dashboard.",
    fr: "Dans la version finale, tu recevras ce lien par e-mail. Clique ci-dessous pour accéder directement à ton tableau de bord.",
    en: "In the final version you'll receive this link by email. Click below to go straight to your dashboard.",
    es: "En la versión final recibirás este enlace por correo. Haz clic abajo para ir directamente a tu panel.",
    ru: "В финальной версии вы получите эту ссылку по почте. Нажмите ниже, чтобы сразу перейти к дашборду.",
  } as ML,
  naarDashboard: { nl: "Ga naar mijn dashboard", fr: "Aller à mon tableau de bord", en: "Go to my dashboard", es: "Ir a mi panel", ru: "Перейти к дашборду" } as ML,
  fout: { nl: "Er ging iets mis. Controleer je e-mailadres.", fr: "Une erreur s'est produite. Vérifie ton e-mail.", en: "Something went wrong. Check your email.", es: "Algo salió mal. Revisa tu correo.", ru: "Что-то пошло не так. Проверьте почту." } as ML,
};

export default function Mijn() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [taal, setTaal] = useState<Taal>(normaliseerTaal(navigator.language?.slice(0, 2)));
  const [token, setToken] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deelnemers/login", { email, taal });
      return res.json() as Promise<{ dashboardToken: string }>;
    },
    onSuccess: (data) => setToken(data.dashboardToken),
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
            {token ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Mail className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{k(STR.klaarTitel, taal)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{k(STR.klaarBody, taal)}</p>
                <Button
                  className="mt-4 w-full"
                  data-testid="button-naar-dashboard"
                  onClick={() => navigate(`/dashboard/${token}`)}
                >
                  {k(STR.naarDashboard, taal)}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
