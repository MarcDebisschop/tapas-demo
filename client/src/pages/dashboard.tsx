import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import UitlegPaneel from "@/components/UitlegPaneel";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Camera,
  Compass,
  Lightbulb,
  Bell,
  FileText,
  Download,
  Eye,
  Quote as QuoteIcon,
  Mail,
  ChevronRight,
  MessageCircle,
  Send,
  Lock,
  HeartHandshake,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Home as HomeIcon,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  ArrowRight,
  CreditCard,
  Loader2,
  BookOpen,
  BarChart2,
  Clock,
  Trophy,
  Target,
  CheckCircle,
  Zap,
} from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  normaliseerTaal,
  DATE_LOCALE,
  type Taal,
} from "@shared/i18n";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal) => m[t] ?? m.nl;

const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

interface DashboardData {
  labels: {
    energieMomentopname: string;
    vragenlijstEnergie: string;
    eigenInschatting: string;
    beeldInHetKort: string;
    remindersTitel: string;
  };
  quotes: string[];
  energie: { vragenlijst: number; baseline: number; label: string };
  kaarten: Array<{ titel: string; tekst: string }>;
  reminders: string[];
  gradient: { van: string; naar: string };
}
interface GalerijItem {
  id: string;
  titel: string;
  ondertitel: string;
  beschrijving: string;
  duurMin: number;
  thema: "talent" | "energie" | "drivers" | "team" | "loopbaan";
  preview: string[];
  beschikbaar: boolean;
  aanbevolen?: boolean;
  reden?: string;
  matchScore?: number;
}
interface GalerijData {
  labels: {
    titel: string;
    ondertitel: string;
    start: string;
    binnenkort: string;
    aanbevolen: string;
    preview: string;
    minuten: string;
  };
  items: GalerijItem[];
}

// --- Module-lezer (sluit aan op server/modules.ts) ---
interface ModuleBlok {
  type: "intro" | "sectie" | "citaat" | "spanning" | "reflectie" | "synthese";
  kop?: string;
  paragrafen?: string[];
  citaten?: string[];
  vragen?: string[];
}
interface ModuleInhoud {
  id: string;
  titel: string;
  ondertitel: string;
  duurMin: number;
  beschikbaar: boolean;
  blokken: ModuleBlok[];
  doorvraagHint: string;
  disclaimer: string;
}
interface ModuleResponse {
  module: ModuleInhoud;
}
// Gedeeld signaal om een reflectie naar de chatbot door te sturen.
interface ChatPrefill {
  tekst: string;
  nonce: number;
}
interface DashboardResponse {
  deelnemer: {
    id: number;
    email: string;
    naam: string | null;
    fotoUrl: string | null;
    taal: string;
    mailCadans: string;
  };
  dashboard: DashboardData | null;
  afnames: Array<{
    id: number;
    naam: string;
    bedrijf: string | null;
    status: string;
    taal: string;
    voltooidOp: string | null;
    rapporten: Array<{ id: number; variant: string; titel: string }>;
  }>;
  galerij: GalerijData;
}

// --- Chat-types (sluiten aan op de Node-backend / sidecar) ---
interface ChatBericht {
  id: number;
  rol: "user" | "assistant";
  inhoud: string;
  veiligheid: string | null;
}
interface Limiet {
  gebruikt: number;
  gratisLimiet: number;
  tegoed: number;
  totaal: number;
  resterend: number;
  pakketGrootte: number;
  geblokkeerd: boolean;
}
interface CoachKaart {
  naam: string;
  rol: string;
  regio: string;
  bericht: string;
  plaats?: string | null;
  expertise?: string[];
  email?: string | null;
  demo?: boolean;
  demoLabel?: string | null;
}
interface ChatResponse {
  berichten: ChatBericht[];
  limiet: Limiet;
  suggesties: string[];
  coach: CoachKaart;
}
interface ChatPostResponse {
  antwoord: ChatBericht;
  limiet: Limiet;
  coach: CoachKaart | null;
}

const STR = {
  hallo: { nl: "Dag", fr: "Bonjour", en: "Hello", es: "Hola", ru: "Здравствуйте" } as ML,
  jouwRuimte: {
    nl: "Dit is jouw persoonlijke ruimte",
    fr: "Voici ton espace personnel",
    en: "This is your personal space",
    es: "Este es tu espacio personal",
    ru: "Это ваше личное пространство",
  } as ML,
  // Warme, oprechte welkomstboodschap — mens-tot-mens, vanuit verbinding.
  welkomWarm: {
    nl: "Fijn dat je er bent. Wat hier staat is geen oordeel, maar een spiegel — samen kijken we naar wat jou doet bewegen.",
    fr: "Heureux que tu sois là. Ce qui suit n'est pas un jugement, mais un miroir — ensemble, regardons ce qui te fait avancer.",
    en: "Glad you're here. What follows isn't a verdict but a mirror — together we look at what moves you.",
    es: "Nos alegra que estés aquí. Lo que sigue no es un juicio, sino un espejo — juntos miramos lo que te impulsa.",
    ru: "Рады, что вы здесь. Это не приговор, а зеркало — вместе посмотрим, что движет вами.",
  } as ML,
  mijnAfnames: { nl: "Mijn vragenlijsten", fr: "Mes questionnaires", en: "My questionnaires", es: "Mis cuestionarios", ru: "Мои опросники" } as ML,
  bekijkRapport: { nl: "Bekijk rapport", fr: "Voir le rapport", en: "View report", es: "Ver informe", ru: "Открыть отчёт" } as ML,
  geenRapport: { nl: "Rapport in voorbereiding", fr: "Rapport en préparation", en: "Report in preparation", es: "Informe en preparación", ru: "Отчёт готовится" } as ML,
  volledigProfielTitel: { nl: "Mijn volledige profiel", fr: "Mon profil complet", en: "My full profile", es: "Mi perfil completo", ru: "Мой полный профиль" } as ML,
  volledigProfielIntro: {
    nl: "Het beeld hierboven is een korte samenvatting. Hieronder lees je je volledige profiel — bekijk het in je browser of bewaar het als bestand.",
    fr: "L'aperçu ci-dessus est un bref résumé. Ci-dessous, tu trouves ton profil complet — consulte-le dans ton navigateur ou enregistre-le comme fichier.",
    en: "The picture above is a short summary. Below you'll find your full profile — view it in your browser or save it as a file.",
    es: "La vista anterior es un breve resumen. A continuación encontrarás tu perfil completo: consúltalo en tu navegador o guárdalo como archivo.",
    ru: "Выше — краткая сводка. Ниже представлен ваш полный профиль: откройте его в браузере или сохраните как файл.",
  } as ML,
  bekijkenKnop: { nl: "Bekijken", fr: "Consulter", en: "View", es: "Ver", ru: "Открыть" } as ML,
  downloadKnop: { nl: "Downloaden", fr: "Télécharger", en: "Download", es: "Descargar", ru: "Скачать" } as ML,
  profiel: { nl: "Mijn profiel", fr: "Mon profil", en: "My profile", es: "Mi perfil", ru: "Мой профиль" } as ML,
  fotoUpload: { nl: "Foto wijzigen", fr: "Changer la photo", en: "Change photo", es: "Cambiar foto", ru: "Изменить фото" } as ML,
  taalLabel: { nl: "Taal", fr: "Langue", en: "Language", es: "Idioma", ru: "Язык" } as ML,
  mailLabel: { nl: "Inspiratie per e-mail", fr: "Inspiration par e-mail", en: "Inspiration by email", es: "Inspiración por correo", ru: "Вдохновение по почте" } as ML,
  opgeslagen: { nl: "Opgeslagen", fr: "Enregistré", en: "Saved", es: "Guardado", ru: "Сохранено" } as ML,
  geenData: {
    nl: "Zodra je een vragenlijst hebt afgerond, verschijnt hier je persoonlijke beeld.",
    fr: "Dès que tu auras terminé un questionnaire, ton image personnelle apparaîtra ici.",
    en: "Once you complete a questionnaire, your personal picture will appear here.",
    es: "Cuando completes un cuestionario, tu imagen personal aparecerá aquí.",
    ru: "Как только вы пройдёте опросник, здесь появится ваш личный портрет.",
  } as ML,
  status: {
    voltooid: { nl: "Voltooid", fr: "Terminé", en: "Completed", es: "Completado", ru: "Завершён" } as ML,
    deel1: { nl: "Bezig (deel 1)", fr: "En cours (partie 1)", en: "In progress (part 1)", es: "En curso (parte 1)", ru: "В процессе (часть 1)" } as ML,
    deel2: { nl: "Bezig (deel 2)", fr: "En cours (partie 2)", en: "In progress (part 2)", es: "En curso (parte 2)", ru: "В процессе (часть 2)" } as ML,
    uitgenodigd: { nl: "Uitgenodigd", fr: "Invité", en: "Invited", es: "Invitado", ru: "Приглашён" } as ML,
  },
  // --- Chat ---
  chatTitel: { nl: "Jouw profielassistent", fr: "Ton assistant de profil", en: "Your profile assistant", es: "Tu asistente de perfil", ru: "Ваш ассистент профиля" } as ML,
  chatOndertitel: {
    nl: "Stel je vragen over je beeld. Een reflectiehulp — geen diagnose of therapie.",
    fr: "Pose tes questions sur ton image. Une aide à la réflexion — pas un diagnostic ni une thérapie.",
    en: "Ask questions about your picture. A reflection aid — not a diagnosis or therapy.",
    es: "Haz preguntas sobre tu imagen. Una ayuda de reflexión — no un diagnóstico ni terapia.",
    ru: "Задавайте вопросы о вашем портрете. Помощь для размышления — не диагноз и не терапия.",
  } as ML,
  chatPlaceholder: { nl: "Typ je vraag…", fr: "Écris ta question…", en: "Type your question…", es: "Escribe tu pregunta…", ru: "Введите вопрос…" } as ML,
  chatVerstuur: { nl: "Versturen", fr: "Envoyer", en: "Send", es: "Enviar", ru: "Отправить" } as ML,
  chatWelkom: {
    nl: "Hallo. Ik help je je beeld beter te begrijpen. Waar wil je mee beginnen?",
    fr: "Bonjour. Je t'aide à mieux comprendre ton image. Par quoi veux-tu commencer ?",
    en: "Hello. I'll help you understand your picture better. Where would you like to start?",
    es: "Hola. Te ayudo a entender mejor tu imagen. ¿Por dónde quieres empezar?",
    ru: "Здравствуйте. Я помогу вам лучше понять ваш портрет. С чего хотите начать?",
  } as ML,
  chatSuggesties: { nl: "Suggesties", fr: "Suggestions", en: "Suggestions", es: "Sugerencias", ru: "Подсказки" } as ML,
  chatTeller: { nl: "vragen over", fr: "questions restantes", en: "questions left", es: "preguntas restantes", ru: "вопросов осталось" } as ML,
  chatDenkt: { nl: "Aan het nadenken…", fr: "Réflexion…", en: "Thinking…", es: "Pensando…", ru: "Думаю…" } as ML,
  chatFout: {
    nl: "De assistent is even niet bereikbaar. Probeer het zo opnieuw.",
    fr: "L'assistant est momentanément indisponible. Réessaie dans un instant.",
    en: "The assistant is briefly unavailable. Please try again shortly.",
    es: "El asistente no está disponible por un momento. Inténtalo de nuevo en breve.",
    ru: "Ассистент временно недоступен. Повторите попытку чуть позже.",
  } as ML,
  // --- Paywall ---
  paywallTitel: { nl: "Je gratis vragen zijn op", fr: "Tes questions gratuites sont épuisées", en: "You've used your free questions", es: "Has agotado tus preguntas gratuitas", ru: "Бесплатные вопросы закончились" } as ML,
  paywallTekst: {
    nl: "Wil je verder reflecteren? Koop een extra pakket vragen en ga meteen door.",
    fr: "Envie de continuer ta réflexion ? Achète un pack de questions et continue tout de suite.",
    en: "Want to keep reflecting? Buy an extra pack of questions and continue right away.",
    es: "¿Quieres seguir reflexionando? Compra un paquete extra de preguntas y continúa al instante.",
    ru: "Хотите продолжить размышления? Купите дополнительный пакет вопросов и продолжайте сразу.",
  } as ML,
  paywallKoop: { nl: "Koop", fr: "Acheter", en: "Buy", es: "Comprar", ru: "Купить" } as ML,
  paywallVragen: { nl: "extra vragen", fr: "questions en plus", en: "more questions", es: "preguntas más", ru: "доп. вопросов" } as ML,
  paywallDemo: { nl: "Betaal met Bancontact (demo)", fr: "Payer avec Bancontact (démo)", en: "Pay with Bancontact (demo)", es: "Pagar con Bancontact (demo)", ru: "Оплатить через Bancontact (демо)" } as ML,
  paywallDemoNote: {
    nl: "Dit is een demo-betaling. In productie verloopt dit via Mollie/Bancontact.",
    fr: "Ceci est un paiement de démonstration. En production via Mollie/Bancontact.",
    en: "This is a demo payment. In production it runs via Mollie/Bancontact.",
    es: "Este es un pago de demostración. En producción se realiza vía Mollie/Bancontact.",
    ru: "Это демонстрационная оплата. В продакшене — через Mollie/Bancontact.",
  } as ML,
  paywallGelukt: { nl: "Betaling gelukt — je kunt weer verder.", fr: "Paiement réussi — tu peux continuer.", en: "Payment successful — you can continue.", es: "Pago realizado — puedes continuar.", ru: "Оплата прошла — можно продолжать." } as ML,
  // --- Coach / zorg-kompas ---
  coachTitel: { nl: "Even persoonlijk contact", fr: "Un contact plus personnel", en: "A more personal conversation", es: "Un contacto más personal", ru: "Личный разговор" } as ML,
  coachContact: { nl: "Contact opnemen", fr: "Prendre contact", en: "Get in touch", es: "Contactar", ru: "Связаться" } as ML,
  coachExpertise: { nl: "Specialisaties", fr: "Spécialisations", en: "Specializations", es: "Especializaciones", ru: "Специализации" } as ML,
  coachToon: { nl: "Coach bij jou in de buurt", fr: "Un coach près de chez toi", en: "A coach near you", es: "Un coach cerca de ti", ru: "Коуч рядом с вами" } as ML,
  coachVerberg: { nl: "Coach verbergen", fr: "Masquer le coach", en: "Hide coach", es: "Ocultar coach", ru: "Скрыть коуча" } as ML,
  // --- Module-lezer (Galerij "Starten") ---
  modLaden: { nl: "Je verdieping wordt opgebouwd…", fr: "Ton approfondissement se prépare…", en: "Your deep-dive is being built…", es: "Tu profundización se está preparando…", ru: "Ваше углубление готовится…" } as ML,
  modFout: { nl: "Deze verdieping kon even niet worden geladen. Probeer het zo opnieuw.", fr: "Cet approfondissement n'a pas pu être chargé. Réessaie dans un instant.", en: "This deep-dive couldn't be loaded just now. Please try again shortly.", es: "No se pudo cargar esta profundización ahora. Inténtalo de nuevo en breve.", ru: "Не удалось загрузить это углубление. Повторите попытку чуть позже." } as ML,
  modVorige: { nl: "Vorige", fr: "Précédent", en: "Previous", es: "Anterior", ru: "Назад" } as ML,
  modVolgende: { nl: "Volgende", fr: "Suivant", en: "Next", es: "Siguiente", ru: "Далее" } as ML,
  modAfronden: { nl: "Afronden", fr: "Terminer", en: "Finish", es: "Finalizar", ru: "Завершить" } as ML,
  modStap: { nl: "Stap", fr: "Étape", en: "Step", es: "Paso", ru: "Шаг" } as ML,
  modVan: { nl: "van", fr: "sur", en: "of", es: "de", ru: "из" } as ML,
  modEigenWoorden: { nl: "In je eigen woorden", fr: "Dans tes propres mots", en: "In your own words", es: "En tus propias palabras", ru: "Вашими словами" } as ML,
  modReflectie: { nl: "Om over na te denken", fr: "À méditer", en: "To reflect on", es: "Para reflexionar", ru: "Для размышления" } as ML,
  modBespreek: { nl: "Bespreek met de assistent", fr: "En parler avec l'assistant", en: "Discuss with the assistant", es: "Comentar con el asistente", ru: "Обсудить с ассистентом" } as ML,
  modBespreekKort: { nl: "Bespreken", fr: "En parler", en: "Discuss", es: "Comentar", ru: "Обсудить" } as ML,
  modKlaarTitel: { nl: "Je hebt deze verdieping doorlopen", fr: "Tu as parcouru cet approfondissement", en: "You've completed this deep-dive", es: "Has completado esta profundización", ru: "Вы прошли это углубление" } as ML,
  modKlaarTekst: { nl: "Neem gerust de tijd. Wil je hier samen verder over nadenken? Stel een vraag aan de assistent.", fr: "Prends ton temps. Envie d'y réfléchir ensemble ? Pose une question à l'assistant.", en: "Take your time. Want to think this through together? Ask the assistant a question.", es: "Tómate tu tiempo. ¿Quieres reflexionarlo juntos? Hazle una pregunta al asistente.", ru: "Не торопитесь. Хотите подумать об этом вместе? Задайте вопрос ассистенту." } as ML,
  modSluiten: { nl: "Sluiten", fr: "Fermer", en: "Close", es: "Cerrar", ru: "Закрыть" } as ML,
};

const CADANS: Record<string, ML> = {
  uit: { nl: "Geen e-mails", fr: "Aucun e-mail", en: "No emails", es: "Sin correos", ru: "Без писем" },
  wekelijks: { nl: "Wekelijks", fr: "Hebdomadaire", en: "Weekly", es: "Semanal", ru: "Еженедельно" },
  tweewekelijks: { nl: "Tweewekelijks", fr: "Bimensuel", en: "Every two weeks", es: "Quincenal", ru: "Раз в две недели" },
  maandelijks: { nl: "Maandelijks", fr: "Mensuel", en: "Monthly", es: "Mensual", ru: "Ежемесячно" },
};

function initialen(naam: string | null, email: string): string {
  const bron = (naam && naam.trim()) || email;
  return bron
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function Dashboard() {
  const params = useParams();
  const token = params.token as string;
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  // Reflectie vanuit een leesmodule wordt hiermee in het chat-invoerveld gezet.
  const [chatPrefill, setChatPrefill] = useState<ChatPrefill | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  // 4.2 — scroll-reveal voor inzichtkaarten
  const kaartRevealRef = useScrollReveal<HTMLDivElement>();
  function naarChat(tekst: string) {
    setChatPrefill({ tekst, nonce: Date.now() });
    // Laat de prefill-effect eerst lopen, scroll daarna naar het chatpaneel.
    setTimeout(() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ["/api/dashboard", token],
    staleTime: 0,
    refetchOnMount: "always",
    // De gepubliceerde sandbox kan na inactiviteit 'opstarten' (cold start),
    // wat de eerste seconden kan duren. We proberen daarom ruim opnieuw, maar
    // NOOIT bij een 404 (profiel bestaat echt niet) — dan is opnieuw proberen
    // zinloos en tonen we meteen de juiste melding.
    retry: (count, err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.startsWith("404")) return false;
      return count < 8;
    },
    retryDelay: (n) => Math.min(2000 * (n + 1), 6000),
  });

  const taal = normaliseerTaal(data?.deelnemer?.taal ?? "nl");

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/dashboard/${token}`, patch);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token] }),
  });

  // Wisselende quote in de hero.
  const quotes = data?.dashboard?.quotes ?? [];
  useEffect(() => {
    if (quotes.length < 2) return;
    const id = setInterval(() => setQuoteIdx((i) => (i + 1) % quotes.length), 5000);
    return () => clearInterval(id);
  }, [quotes.length]);

  const gradient = data?.dashboard?.gradient ?? { van: "190 70% 50%", naar: "225 65% 42%" };
  const heroStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(135deg, hsl(${gradient.van}) 0%, hsl(${gradient.naar}) 100%)`,
    }),
    [gradient.van, gradient.naar],
  );

  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update.mutate({ fotoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  // Geen leeg/donker scherm meer: toon altijd een duidelijke melding wanneer
  // het profiel (nog) niet kon laden — met de optie om opnieuw te proberen of
  // terug te keren naar de startpagina.
  if (!data) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <AlertCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold" data-testid="text-dashboard-leeg-titel">
                  {isError
                    ? "We konden je profiel even niet laden"
                    : "Profiel niet gevonden"}
                </h1>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {isError
                    ? "De verbinding met de server lukte niet. Dit gebeurt soms wanneer de demo na een rustige periode opnieuw opstart. Probeer het gerust opnieuw — meestal werkt het de tweede keer meteen."
                    : "Deze profiellink lijkt niet (meer) te bestaan. Controleer de link of keer terug naar de startpagina."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  data-testid="button-dashboard-opnieuw"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Bezig met laden…" : "Opnieuw proberen"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  data-testid="button-dashboard-home"
                >
                  <HomeIcon className="mr-2 h-4 w-4" />
                  Naar startpagina
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  const d = data.deelnemer;
  const dash = data.dashboard;
  const voornaam = (d.naam && d.naam.trim().split(/\s+/)[0]) || "";

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      {/* ── Deelnemer navigatiebalk ── discreet, uitnodigend ── */}
      <nav
        className="border-b border-border/40 bg-muted/30 backdrop-blur-sm"
        data-testid="deelnemer-nav"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-1.5 sm:px-6">
          <a
            href="#/lounge"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-testid="nav-naar-lounge"
          >
            <span>☕</span> TaPas Lounge
          </a>
          <a
            href="#/academy"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-testid="nav-naar-academy"
          >
            <span>🎓</span> TaPas Academy
          </a>
          <span className="flex-1" />
          <a
            href="#/"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            data-testid="nav-naar-home"
          >
            ← Terug naar start
          </a>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* HERO */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8"
          style={heroStyle}
          data-testid="hero-header"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-black/10" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar / foto */}
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/20 text-2xl font-semibold ring-2 ring-white/60 backdrop-blur">
                {d.fotoUrl ? (
                  <img src={d.fotoUrl} alt="" className="h-full w-full object-cover" data-testid="img-foto" />
                ) : (
                  <span data-testid="text-initialen">{initialen(d.naam, d.email)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow hover:bg-white/90"
                aria-label={k(STR.fotoUpload, taal)}
                data-testid="button-foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFoto} data-testid="input-foto" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80">
                {k(STR.hallo, taal)}{voornaam ? `, ${voornaam}` : ""}
              </p>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-welkom">
                {k(STR.jouwRuimte, taal)}
              </h1>
              {/* Warme, oprechte welkomstboodschap */}
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90" data-testid="text-welkom-warm">
                {k(STR.welkomWarm, taal)}
              </p>
              {/* Wisselende quote */}
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/10 p-3 backdrop-blur">
                <QuoteIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                <p className="text-sm text-white/95 transition-opacity duration-500" data-testid="text-quote">
                  {quotes[quoteIdx] ?? k(STR.geenData, taal)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {dash ? (
          <>
            {/* INZICHTSKAARTEN */}
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-4 w-4" /> {dash.labels.beeldInHetKort}
              </h2>
              {/* 4.2 — scroll-reveal wrapper */}
              <div className="mt-3 grid gap-4 md:grid-cols-3" ref={kaartRevealRef}>
                {dash.kaarten.map((kaart, i) => (
                  <Card
                    key={i}
                    className={`h-full tapas-reveal tapas-reveal-delay-${Math.min(i + 1, 5)}`}
                    data-testid={`card-inzicht-${i}`}
                  >
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground">{kaart.titel}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{kaart.tekst}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* ENERGIE-MOMENTOPNAME */}
            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <Card data-testid="card-energie">
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Compass className="h-4 w-4 text-accent" /> {dash.labels.energieMomentopname}
                  </h2>
                  <div className="mt-4 space-y-4">
                    <EnergieBalk
                      label={dash.labels.vragenlijstEnergie}
                      waarde={dash.energie.vragenlijst}
                      badge={dash.energie.label}
                    />
                    <EnergieBalk
                      label={dash.labels.eigenInschatting}
                      waarde={dash.energie.baseline}
                      muted
                    />
                  </div>
                </CardContent>
              </Card>

              {/* REMINDERS */}
              <Card data-testid="card-reminders">
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Bell className="h-4 w-4 text-accent" /> {dash.labels.remindersTitel}
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {dash.reminders.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`reminder-${i}`}>
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <Card className="mt-8">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {k(STR.geenData, taal)}
            </CardContent>
          </Card>
        )}

        {/* GESPROKEN PROFIELUITLEG (6 blokken, audio) */}
        <section className="mt-8">
          <UitlegPaneel token={token} taal={taal} toon="deelnemer" />
        </section>

        {/* AI-PROFIELASSISTENT (chatbot) */}
        <section className="mt-8" ref={chatRef}>
          <ChatPaneel token={token} taal={taal} prefill={chatPrefill} />
        </section>

        {/* VRAGENLIJST-GALERIJ */}
        {data.galerij && data.galerij.items.length > 0 && (
          <section className="mt-8">
            <Galerij galerij={data.galerij} taal={taal} token={token} onReflectie={naarChat} />
          </section>
        )}

        {/* MIJN VOLLEDIGE PROFIEL */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4" /> {k(STR.volledigProfielTitel, taal)}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {k(STR.volledigProfielIntro, taal)}
          </p>
          <div className="mt-3 space-y-3">
            {data.afnames.length === 0 && (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">{k(STR.geenData, taal)}</CardContent></Card>
            )}
            {data.afnames.map((a) => {
              const statusML = (STR.status as any)[a.status] as ML | undefined;
              return (
                <Card key={a.id} data-testid={`afname-${a.id}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          T4P Business Kompas{a.bedrijf ? ` · ${a.bedrijf}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={a.status === "voltooid" ? "default" : "secondary"}>
                            {statusML ? k(statusML, taal) : a.status}
                          </Badge>
                          {a.voltooidOp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(a.voltooidOp).toLocaleDateString(DATE_LOCALE[taal])}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {a.rapporten.length > 0 ? (
                      <div className="mt-4 space-y-2.5 border-t border-border pt-4">
                        {a.rapporten.map((rapport) => (
                          <div
                            key={rapport.id}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            data-testid={`rapport-rij-${rapport.id}`}
                          >
                            <p className="flex items-center gap-2 text-sm text-foreground">
                              <FileText className="h-4 w-4 shrink-0 text-accent" />
                              {rapport.titel}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`${API_BASE}/api/rapporten/${rapport.id}/html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`link-rapport-bekijk-${rapport.id}`}
                              >
                                <Button size="sm" variant="outline">
                                  <Eye className="mr-2 h-4 w-4" /> {k(STR.bekijkenKnop, taal)}
                                </Button>
                              </a>
                              <a
                                href={`${API_BASE}/api/rapporten/${rapport.id}/download`}
                                data-testid={`link-rapport-download-${rapport.id}`}
                              >
                                <Button size="sm">
                                  <Download className="mr-2 h-4 w-4" /> {k(STR.downloadKnop, taal)}
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">{k(STR.geenRapport, taal)}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* PROFIEL */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{k(STR.profiel, taal)}</h2>
          <Card className="mt-3">
            <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{k(STR.taalLabel, taal)}</label>
                <Select value={d.taal} onValueChange={(v) => update.mutate({ taal: v })}>
                  <SelectTrigger data-testid="select-profiel-taal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TALEN.map((t) => (
                      <SelectItem key={t} value={t}>{TAAL_NAMEN[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Mail className="h-3.5 w-3.5" /> {k(STR.mailLabel, taal)}
                </label>
                <Select value={d.mailCadans} onValueChange={(v) => update.mutate({ mailCadans: v })}>
                  <SelectTrigger data-testid="select-cadans"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(CADANS).map((c) => (
                      <SelectItem key={c} value={c}>{k(CADANS[c], taal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {update.isSuccess && (
                <p className="text-xs text-accent sm:col-span-2" data-testid="text-opgeslagen">{k(STR.opgeslagen, taal)}</p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* STM — Self-Training Module (enkel voor geaccrediteerde TaPas coaches) */}
        <StmSectie token={token} />
      </main>
    </div>
  );
}

function EnergieBalk({ label, waarde, badge, muted }: { label: string; waarde: number; badge?: string; muted?: boolean }) {
  const pct = Math.max(0, Math.min(100, (waarde / 10) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {waarde.toFixed(1)}/10
          {badge && <Badge variant="secondary" className="font-normal">{badge}</Badge>}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={muted ? "h-full rounded-full bg-muted-foreground/40" : "h-full rounded-full bg-accent"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// AI-profielassistent (chatbot) — meertalig, met limiet, paywall en zorg-kompas.
// Alle verkeer loopt via de Node-backend (poort 5000); die proxyt naar de
// Python-sidecar. "Driver" blijft beschermd & onvertaald (afgehandeld backend).
// =============================================================================
function ChatPaneel({ token, taal, prefill }: { token: string; taal: Taal; prefill?: ChatPrefill | null }) {
  const [invoer, setInvoer] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Coachpaneel: standaard verborgen. De deelnemer opent het zelf via de knop,
  // of het opent AUTOMATISCH zodra de assistent doorverwijst (existentiële of
  // expliciete coach-vraag -> veiligheid === "coach").
  const [coachOpen, setCoachOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const invoerRef = useRef<HTMLTextAreaElement>(null);

  // Reflectie uit een leesmodule: vul het invoerveld en focus erop.
  useEffect(() => {
    if (!prefill?.tekst) return;
    setInvoer(prefill.tekst);
    const el = invoerRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(prefill.tekst.length, prefill.tekst.length);
    }
  }, [prefill?.nonce]);

  const { data: chat, isLoading } = useQuery<ChatResponse>({
    queryKey: ["/api/dashboard", token, "chat"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/${token}/chat`);
      return res.json();
    },
    staleTime: 0,
  });

  const berichten = chat?.berichten ?? [];
  const limiet = chat?.limiet;
  const suggesties = chat?.suggesties ?? [];
  const coachActief = berichten.some((b) => b.rol === "assistant" && b.veiligheid === "coach");
  const coach = chat?.coach;

  // Zorg-kompas: zodra de assistent doorverwijst (existentiële/coach-vraag),
  // opent het coachpaneel AUTOMATISCH. Daarbuiten blijft het verborgen tot de
  // deelnemer er zelf voor kiest. Eenmaal automatisch geopend laten we het open.
  useEffect(() => {
    if (coachActief) setCoachOpen(true);
  }, [coachActief]);

  const verstuur = useMutation({
    mutationFn: async (vraag: string) => {
      const res = await apiRequest("POST", `/api/dashboard/${token}/chat`, { vraag });
      return res.json() as Promise<ChatPostResponse>;
    },
    onSuccess: () => {
      setInvoer("");
      setFout(null);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token, "chat"] });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("402") || msg.includes("limiet_bereikt")) {
        setPaywallOpen(true);
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token, "chat"] });
      } else {
        setFout(k(STR.chatFout, taal));
      }
    },
  });

  const koop = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dashboard/${token}/koop-extra`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token, "chat"] });
    },
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [berichten.length, verstuur.isPending]);

  const geblokkeerd = limiet?.geblokkeerd ?? false;

  function indienen(vraag: string) {
    const v = vraag.trim();
    if (!v || verstuur.isPending) return;
    if (geblokkeerd) {
      setPaywallOpen(true);
      return;
    }
    verstuur.mutate(v);
  }

  return (
    <Card className="overflow-hidden" data-testid="card-chat">
      <div className="flex items-start gap-3 border-b border-border bg-gradient-to-r from-accent/10 to-transparent p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground" data-testid="text-chat-titel">{k(STR.chatTitel, taal)}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{k(STR.chatOndertitel, taal)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {coach && (
            <button
              type="button"
              onClick={() => setCoachOpen((v) => !v)}
              aria-expanded={coachOpen}
              data-testid="button-coach-toggle"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/5 px-3 py-1 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-accent/10"
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              {coachOpen ? k(STR.coachVerberg, taal) : k(STR.coachToon, taal)}
              {coachOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
          {limiet && (
            <div className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:flex" data-testid="text-chat-teller">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              {limiet.resterend} {k(STR.chatTeller, taal)}
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="flex max-h-[26rem] min-h-[14rem] flex-col gap-3 overflow-y-auto p-5"
          data-testid="chat-stroom"
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-3/4 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            </div>
          ) : berichten.length === 0 ? (
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
                {k(STR.chatWelkom, taal)}
              </div>
            </div>
          ) : (
            berichten.map((b) => <Bubbel key={b.id} bericht={b} taal={taal} />)
          )}

          {verstuur.isPending && (
            <div className="flex items-start gap-2.5" data-testid="chat-typing">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
              </div>
            </div>
          )}
        </div>

        {coachOpen && coach && <CoachCard coach={coach} taal={taal} />}

        {!isLoading && !geblokkeerd && suggesties.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{k(STR.chatSuggesties, taal)}</p>
            <div className="flex flex-wrap gap-2">
              {suggesties.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => indienen(s)}
                  disabled={verstuur.isPending}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-50"
                  data-testid={`chip-suggestie-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {fout && (
          <p className="border-t border-border bg-destructive/5 px-5 py-2.5 text-sm text-destructive" data-testid="text-chat-fout">{fout}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            indienen(invoer);
          }}
          className="flex items-end gap-2 border-t border-border p-4"
        >
          {geblokkeerd ? (
            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={() => setPaywallOpen(true)}
              data-testid="button-chat-geblokkeerd"
            >
              <Lock className="mr-2 h-4 w-4" /> {k(STR.paywallTitel, taal)}
            </Button>
          ) : (
            <>
              <textarea
                ref={invoerRef}
                value={invoer}
                onChange={(e) => setInvoer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    indienen(invoer);
                  }
                }}
                rows={1}
                placeholder={k(STR.chatPlaceholder, taal)}
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
                disabled={verstuur.isPending}
                data-testid="input-chat"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={verstuur.isPending || !invoer.trim()}
                data-testid="button-chat-verstuur"
                aria-label={k(STR.chatVerstuur, taal)}
              >
                {verstuur.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </>
          )}
        </form>
      </CardContent>

      <Paywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        taal={taal}
        limiet={limiet}
        bezig={koop.isPending}
        gelukt={koop.isSuccess}
        onKoop={() => koop.mutate()}
      />
    </Card>
  );
}

function Bubbel({ bericht, taal }: { bericht: ChatBericht; taal: Taal }) {
  const isUser = bericht.rol === "user";
  if (isUser) {
    return (
      <div className="flex justify-end" data-testid={`bubbel-user-${bericht.id}`}>
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm leading-relaxed text-accent-foreground">
          {bericht.inhoud}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5" data-testid={`bubbel-assistent-${bericht.id}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
        {bericht.inhoud}
      </div>
    </div>
  );
}

function CoachCard({ coach, taal }: { coach: CoachKaart; taal: Taal }) {
  return (
    <div
      className="mx-5 mb-1 mt-1 rounded-xl border border-accent/30 bg-accent/5 p-4"
      data-testid="card-coach"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{k(STR.coachTitel, taal)}</p>
            {coach.demo && coach.demoLabel && (
              <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wide text-muted-foreground">
                {coach.demoLabel}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{coach.bericht}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{coach.naam}</span>
            <Badge variant="secondary" className="font-normal">{coach.rol}</Badge>
            <span className="text-xs text-muted-foreground">{coach.plaats ?? coach.regio}</span>
          </div>
          {coach.expertise && coach.expertise.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-foreground/70">{k(STR.coachExpertise, taal)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {coach.expertise.map((e) => (
                  <Badge key={e} variant="outline" className="font-normal">{e}</Badge>
                ))}
              </div>
            </div>
          )}
          {coach.email ? (
            <Button asChild size="sm" variant="outline" className="mt-3" data-testid="button-coach-contact">
              <a href={`mailto:${coach.email}`}>
                <Mail className="mr-2 h-4 w-4" /> {k(STR.coachContact, taal)}
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="mt-3" data-testid="button-coach-contact">
              <Mail className="mr-2 h-4 w-4" /> {k(STR.coachContact, taal)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Paywall({
  open,
  onOpenChange,
  taal,
  limiet,
  bezig,
  gelukt,
  onKoop,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taal: Taal;
  limiet?: Limiet;
  bezig: boolean;
  gelukt: boolean;
  onKoop: () => void;
}) {
  const pakket = limiet?.pakketGrootte ?? 25;
  useEffect(() => {
    if (gelukt && limiet && !limiet.geblokkeerd) {
      const id = setTimeout(() => onOpenChange(false), 1200);
      return () => clearTimeout(id);
    }
  }, [gelukt, limiet?.geblokkeerd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-paywall">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Lock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{k(STR.paywallTitel, taal)}</DialogTitle>
          <DialogDescription className="text-center">{k(STR.paywallTekst, taal)}</DialogDescription>
        </DialogHeader>

        {gelukt && limiet && !limiet.geblokkeerd ? (
          <p className="rounded-lg bg-accent/10 px-4 py-3 text-center text-sm font-medium text-accent" data-testid="text-paywall-gelukt">
            {k(STR.paywallGelukt, taal)}
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">{k(STR.paywallKoop, taal)}</p>
              <p className="mt-1 text-xl font-semibold text-foreground" data-testid="text-paywall-pakket">
                {pakket} {k(STR.paywallVragen, taal)}
              </p>
            </div>
            <Button onClick={onKoop} disabled={bezig} className="w-full" data-testid="button-koop-extra">
              {bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {k(STR.paywallDemo, taal)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{k(STR.paywallDemoNote, taal)}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Vragenlijst-galerij — "Vragenlijsten voor jou" met match-aanbevelingen.
// =============================================================================
function Galerij({
  galerij,
  taal,
  token,
  onReflectie,
}: {
  galerij: GalerijData;
  taal: Taal;
  token: string;
  onReflectie: (tekst: string) => void;
}) {
  const [preview, setPreview] = useState<GalerijItem | null>(null);
  // Geopende leesmodule (id van het galerij-item) of null.
  const [actiefId, setActiefId] = useState<string | null>(null);
  const L = galerij.labels;

  function start(item: GalerijItem) {
    setPreview(null);
    setActiefId(item.id);
  }

  return (
    <>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <LayoutGrid className="h-4 w-4" /> {L.titel}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{L.ondertitel}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galerij.items.map((item) => (
          <Card
            key={item.id}
            className={`flex h-full flex-col ${item.aanbevolen ? "ring-1 ring-accent/40" : ""}`}
            data-testid={`card-galerij-${item.id}`}
          >
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <ThemaIcoon thema={item.thema} />
                {item.aanbevolen && (
                  <Badge className="shrink-0" data-testid={`badge-aanbevolen-${item.id}`}>{L.aanbevolen}</Badge>
                )}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{item.titel}</h3>
              <p className="mt-0.5 text-xs font-medium text-accent">{item.ondertitel}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.beschrijving}</p>

              {item.aanbevolen && item.reden && (
                <p className="mt-2 rounded-lg bg-accent/5 px-3 py-2 text-xs italic text-foreground" data-testid={`reden-${item.id}`}>
                  {item.reden}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 text-muted-foreground"
                  onClick={() => setPreview(item)}
                  data-testid={`button-preview-${item.id}`}
                >
                  {L.preview}
                </Button>
                {item.beschikbaar ? (
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => start(item)}
                    data-testid={`button-start-${item.id}`}
                  >
                    {L.start} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <Badge variant="secondary" className="ml-auto font-normal" data-testid={`badge-binnenkort-${item.id}`}>
                    {L.binnenkort}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent data-testid="dialog-preview">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.titel}</DialogTitle>
                <DialogDescription>{preview.ondertitel}</DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-muted-foreground">{preview.beschrijving}</p>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{L.preview}</p>
                <ul className="space-y-2">
                  {preview.preview.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {preview.beschikbaar ? (
                <Button className="w-full" onClick={() => start(preview)} data-testid="button-preview-start">
                  {L.start} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button className="w-full" variant="secondary" disabled>
                  {L.binnenkort}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ModuleLezer
        token={token}
        moduleId={actiefId}
        taal={taal}
        onClose={() => setActiefId(null)}
        onReflectie={(tekst) => {
          setActiefId(null);
          onReflectie(tekst);
        }}
      />
    </>
  );
}

// =============================================================================
// Module-lezer — meerstaps lees-/reflectie-ervaring, 100% uit het eigen profiel.
// Haalt de inhoud op bij /module/:id en toont per stap een blok. Reflectie kan
// met een klik naar de assistent worden doorgestuurd.
// =============================================================================
function ModuleLezer({
  token,
  moduleId,
  taal,
  onClose,
  onReflectie,
}: {
  token: string;
  moduleId: string | null;
  taal: Taal;
  onClose: () => void;
  onReflectie: (tekst: string) => void;
}) {
  const [stap, setStap] = useState(0);
  const open = moduleId !== null;

  const { data, isLoading, isError } = useQuery<ModuleResponse>({
    queryKey: ["/api/dashboard", token, "module", moduleId, taal],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/${token}/module/${moduleId}?taal=${taal}`);
      return res.json();
    },
  });

  // Bij openen of wisselen van module terug naar stap 0.
  useEffect(() => {
    if (open) setStap(0);
  }, [moduleId, open]);

  const mod = data?.module ?? null;
  const blokken = mod?.blokken ?? [];
  const totaal = blokken.length;
  const huidig = blokken[stap] ?? null;
  const laatste = stap >= totaal - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-2xl" data-testid="dialog-module">
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">{k(STR.modLaden, taal)}</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <p className="text-sm text-muted-foreground">{k(STR.modFout, taal)}</p>
            <Button variant="secondary" onClick={onClose}>{k(STR.modSluiten, taal)}</Button>
          </div>
        )}

        {mod && !isLoading && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-accent" />
                <span>{mod.titel}</span>
              </DialogTitle>
              <DialogDescription>{mod.ondertitel}</DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${totaal > 0 ? ((stap + 1) / totaal) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {k(STR.modStap, taal)} {stap + 1} {k(STR.modVan, taal)} {totaal}
              </span>
            </div>

            <div className="max-h-[52vh] overflow-y-auto pr-1" data-testid="module-blok">
              {huidig && <BlokWeergave blok={huidig} taal={taal} onReflectie={onReflectie} />}
            </div>

            <p className="text-xs italic text-muted-foreground">{mod.disclaimer}</p>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={stap === 0}
                onClick={() => setStap((s) => Math.max(0, s - 1))}
                data-testid="button-module-vorige"
              >
                {k(STR.modVorige, taal)}
              </Button>
              {laatste ? (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={onClose}
                  data-testid="button-module-afronden"
                >
                  {k(STR.modAfronden, taal)}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => setStap((s) => Math.min(totaal - 1, s + 1))}
                  data-testid="button-module-volgende"
                >
                  {k(STR.modVolgende, taal)} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Een leesblok, weergave afhankelijk van het type.
function BlokWeergave({
  blok,
  taal,
  onReflectie,
}: {
  blok: ModuleBlok;
  taal: Taal;
  onReflectie: (tekst: string) => void;
}) {
  const paragrafen = blok.paragrafen ?? [];
  const citaten = blok.citaten ?? [];
  const vragen = blok.vragen ?? [];

  return (
    <div className="space-y-4">
      {blok.kop && (
        <h3 className="text-base font-semibold text-foreground">{blok.kop}</h3>
      )}

      {paragrafen.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-foreground/90">{p}</p>
      ))}

      {citaten.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {k(STR.modEigenWoorden, taal)}
          </p>
          {citaten.map((c, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-accent/50 bg-accent/5 px-3 py-2 text-sm italic leading-relaxed text-foreground"
            >
              {c}
            </blockquote>
          ))}
        </div>
      )}

      {vragen.length > 0 && (
        <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-accent">
            <Lightbulb className="h-3.5 w-3.5" /> {k(STR.modReflectie, taal)}
          </p>
          <ul className="space-y-2.5">
            {vragen.map((v, i) => (
              <li key={i} className="flex flex-col gap-1.5">
                <span className="text-sm leading-relaxed text-foreground">{v}</span>
                <button
                  type="button"
                  onClick={() => onReflectie(v)}
                  className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-accent transition-colors hover:border-accent hover:bg-accent/10"
                  data-testid={`button-module-bespreek-${i}`}
                >
                  <MessageCircle className="h-3 w-3" /> {k(STR.modBespreekKort, taal)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThemaIcoon({ thema }: { thema: GalerijItem["thema"] }) {
  const map: Record<GalerijItem["thema"], JSX.Element> = {
    talent: <Sparkles className="h-5 w-5" />,
    energie: <Compass className="h-5 w-5" />,
    drivers: <ShieldCheck className="h-5 w-5" />,
    team: <LayoutGrid className="h-5 w-5" />,
    loopbaan: <Lightbulb className="h-5 w-5" />,
  };
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
      {map[thema]}
    </div>
  );
}

// ── STM helpers (identiek aan coach-dashboard.tsx) ───────────────────────────

function stmInschalingKleur(inschaling: string) {
  const map: Record<string, string> = {
    expert: "#2E7D5A",
    meer_dan_voldoende: "#1a5fa8",
    net_voldoende: "#8B6914",
    onvoldoende: "#A13544",
  };
  return map[inschaling] || "#7a7468";
}

function StmScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = Math.round((score ?? 0) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#14213d", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#7a7468" }}>{score !== null ? `${pct}%` : "n/a"}</span>
      </div>
      <div style={{ background: "#e8e4dc", borderRadius: 4, height: 8 }}>
        <div style={{
          background: pct >= 70 ? "#2E7D5A" : pct >= 50 ? "#8B6914" : "#A13544",
          width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

// ── DashboardStmModule — volledig werkende STM voor coaches via token-auth ──

function DashboardStmModule({ token }: { token: string }) {
  type StmFase = "menu" | "bezig" | "resultaat";
  const [fase, setFase] = useState<StmFase>("menu");
  const [sessieId, setSessieId] = useState<number | null>(null);
  const [vragen, setVragen] = useState<any[]>([]);
  const [huidigVraagIdx, setHuidigVraagIdx] = useState(0);
  const [antwoorden, setAntwoorden] = useState<Record<number, string>>({});
  const [gekozenAntwoord, setGekozenAntwoord] = useState<string | null>(null);
  const [startTijd, setStartTijd] = useState<number>(0);
  const [resultaat, setResultaat] = useState<any>(null);

  const historiekQuery = useQuery({
    queryKey: ["/api/stm/token/historiek", token],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/stm/token/historiek?token=${token}`).then(r => r.json()),
  });

  const laagscoresQuery = useQuery({
    queryKey: ["/api/stm/token/laagscores", token],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/stm/token/laagscores?token=${token}`).then(r => r.json()),
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${API_BASE}/api/stm/token/start`, { aantal: 12, token }).then(r => r.json()),
    onSuccess: (data) => {
      setSessieId(data.sessie_id);
      setVragen(data.vragen);
      setHuidigVraagIdx(0);
      setAntwoorden({});
      setGekozenAntwoord(null);
      setStartTijd(Date.now());
      setFase("bezig");
    },
  });

  const afrondenMutation = useMutation({
    mutationFn: (payload: { sessie_id: number; antwoorden: Record<number, string>; duur_seconden: number; token: string }) =>
      apiRequest("POST", `${API_BASE}/api/stm/token/afronden`, payload).then(r => r.json()),
    onSuccess: (data) => {
      setResultaat(data);
      setFase("resultaat");
      queryClient.invalidateQueries({ queryKey: ["/api/stm/token/historiek", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/stm/token/laagscores", token] });
    },
  });

  function selecteerAntwoord(antwoord: string) {
    if (gekozenAntwoord !== null) return;
    setAntwoorden({ ...antwoorden, [vragen[huidigVraagIdx].id]: antwoord });
    setGekozenAntwoord(antwoord);
  }

  function volgende() {
    setGekozenAntwoord(null);
    if (huidigVraagIdx < vragen.length - 1) {
      setHuidigVraagIdx(huidigVraagIdx + 1);
    } else {
      const duur = Math.round((Date.now() - startTijd) / 1000);
      afrondenMutation.mutate({ sessie_id: sessieId!, antwoorden, duur_seconden: duur, token });
    }
  }

  const laagNamen: Record<number, string> = { 1: "Parate kennis", 2: "Begrip", 3: "Analyse", 4: "Synthese" };

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (fase === "menu") {
    const scores = laagscoresQuery.data?.scores;
    const historiek = historiekQuery.data?.sessies || [];

    return (
      <div>
        {scores && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 20 }}>
            <CardContent className="pt-4 px-5 pb-4">
              <p style={{ fontWeight: 600, color: "#14213d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart2 className="inline w-4 h-4" /> Jouw kennisprofiel ({scores.sessies_totaal} sessies)
              </p>
              <StmScoreBar score={scores.laag1} label="Laag 1 — Parate kennis" />
              <StmScoreBar score={scores.laag2} label="Laag 2 — Begrip" />
              <StmScoreBar score={scores.laag3} label="Laag 3 — Analyse" />
              <StmScoreBar score={scores.laag4} label="Laag 4 — Synthese" />
              {scores.laatste_sessie && (
                <p style={{ fontSize: 12, color: "#7a7468", marginTop: 8 }}>
                  Laatste sessie: {new Date(scores.laatste_sessie).toLocaleDateString("nl-BE")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card style={{ background: "#14213d", border: "none", marginBottom: 20 }}>
          <CardContent className="p-8 text-center">
            <Zap className="w-10 h-10 mx-auto mb-4" style={{ color: "#d8c9a3" }} />
            <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Start een nieuwe sessie
            </h3>
            <p style={{ color: "#d8c9a3", fontSize: 13, marginBottom: 20, opacity: 0.8 }}>
              12 adaptieve vragen · max. 15 minuten · directe feedback
            </p>
            <Button
              style={{ background: "#d8c9a3", color: "#14213d", fontWeight: 700, padding: "10px 28px" }}
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <BookOpen className="w-4 h-4 mr-2" />}
              Start sessie
            </Button>
          </CardContent>
        </Card>

        {historiek.length > 0 && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
            <CardContent className="p-0">
              <p style={{ padding: "12px 16px", fontWeight: 600, color: "#14213d", borderBottom: "1px solid #e8e4dc", display: "flex", alignItems: "center", gap: 6 }}>
                <Clock className="inline w-4 h-4" /> Recente sessies
              </p>
              {historiek.slice(0, 5).map((s: any) => (
                <div key={s.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f0ede6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#14213d", fontWeight: 500 }}>
                      {new Date(s.afgerond_at).toLocaleDateString("nl-BE")}
                    </div>
                    <div style={{ fontSize: 12, color: "#7a7468" }}>
                      {s.duur_seconden ? `${Math.round(s.duur_seconden / 60)} min` : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: stmInschalingKleur(s.inschaling) }}>
                      {Math.round((s.score_totaal ?? 0) * 100)}%
                    </div>
                    <Badge style={{ background: stmInschalingKleur(s.inschaling) + "20", color: stmInschalingKleur(s.inschaling), fontSize: 10 }}>
                      {s.inschaling?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!scores && historiek.length === 0 && (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
            <CardContent className="p-8 text-center">
              <Target className="w-10 h-10 mx-auto mb-3" style={{ color: "#d8c9a3" }} />
              <p style={{ color: "#7a7468", fontSize: 14 }}>
                Nog geen sessies voltooid. Start je eerste sessie hierboven.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── SESSIE BEZIG ──────────────────────────────────────────────────────────
  if (fase === "bezig") {
    const vraag = vragen[huidigVraagIdx];
    const opties: string[] = vraag?.opties || [];
    const progress = Math.round((huidigVraagIdx / vragen.length) * 100);
    const isLaatste = huidigVraagIdx === vragen.length - 1;

    return (
      <div>
        <div style={{ background: "#14213d", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#d8c9a3", fontSize: 13 }}>Vraag {huidigVraagIdx + 1} / {vragen.length}</span>
            <span style={{ color: "#d8c9a3", fontSize: 12 }}>Laag {vraag?.laag} — {laagNamen[vraag?.laag]}</span>
          </div>
          <div style={{ background: "#060a16", borderRadius: 20, height: 6, overflow: "hidden" }}>
            <div style={{ background: "#d8c9a3", width: `${progress}%`, height: "100%", transition: "width 0.3s" }} />
          </div>
        </div>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
          <CardContent className="p-6">
            <Badge style={{ background: "#f4f1ec", color: "#14213d", marginBottom: 16, fontSize: 11 }}>
              {vraag?.thema}
            </Badge>
            <h3 style={{ color: "#14213d", fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
              {vraag?.vraag_tekst}
            </h3>
            <div className="flex flex-col gap-3">
              {opties.map((optie: string, i: number) => {
                const isGekozen = gekozenAntwoord === optie;
                return (
                  <button key={i} onClick={() => selecteerAntwoord(optie)}
                    disabled={gekozenAntwoord !== null}
                    style={{
                      textAlign: "left", padding: "12px 16px", borderRadius: 8,
                      border: isGekozen ? "2px solid #14213d" : "2px solid #e8e4dc",
                      background: isGekozen ? "#f4f1ec" : "#fff",
                      color: "#14213d", fontSize: 14,
                      cursor: gekozenAntwoord !== null ? "default" : "pointer",
                      fontWeight: isGekozen ? 600 : 400,
                    }}>
                    {optie}
                  </button>
                );
              })}
            </div>
            {gekozenAntwoord !== null && (
              <div style={{ marginTop: 16 }}>
                <Button
                  style={{ background: "#14213d", color: "#d8c9a3", width: "100%" }}
                  onClick={volgende}
                  disabled={afrondenMutation.isPending}
                >
                  {afrondenMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isLaatste ? "Afronden & resultaat bekijken" : "Volgende vraag"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── RESULTAAT ─────────────────────────────────────────────────────────────
  if (fase === "resultaat" && resultaat) {
    const kleur = stmInschalingKleur(resultaat.inschaling);
    const totalePct = Math.round((resultaat.scores?.totaal ?? 0) * 100);

    return (
      <div>
        <Card style={{ background: "#fff", border: `2px solid ${kleur}`, marginBottom: 16 }}>
          <CardContent className="p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: kleur }} />
            <div style={{ fontSize: 48, fontWeight: 800, color: kleur, lineHeight: 1 }}>{totalePct}%</div>
            <div style={{ fontSize: 18, color: kleur, fontWeight: 600, marginTop: 8 }}>
              {resultaat.inschaling_label}
            </div>
            {resultaat.reminder_over_dagen && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#7a7468" }}>
                Volgende aanbevolen sessie over {resultaat.reminder_over_dagen} dagen
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 16 }}>
          <CardContent className="pt-4 px-5 pb-4">
            <p style={{ fontWeight: 600, color: "#14213d", marginBottom: 12 }}>Score per laag</p>
            <StmScoreBar score={resultaat.scores?.laag1} label="Laag 1 — Parate kennis" />
            <StmScoreBar score={resultaat.scores?.laag2} label="Laag 2 — Begrip" />
            <StmScoreBar score={resultaat.scores?.laag3} label="Laag 3 — Analyse" />
            <StmScoreBar score={resultaat.scores?.laag4} label="Laag 4 — Synthese" />
          </CardContent>
        </Card>

        <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 16 }}>
          <CardContent className="p-0">
            <p style={{ padding: "12px 16px", fontWeight: 600, color: "#14213d", borderBottom: "1px solid #e8e4dc" }}>Feedback per vraag</p>
            {(resultaat.feedback || []).map((f: any, i: number) => (
              <div key={f.vraag_id} style={{ padding: "10px 14px", borderBottom: "1px solid #f0ede6", display: "flex", gap: 10 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {f.correct
                    ? <CheckCircle className="w-5 h-5" style={{ color: "#2E7D5A" }} />
                    : <AlertCircle className="w-5 h-5" style={{ color: "#A13544" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#7a7468", marginBottom: 2 }}>Vraag {i + 1}</div>
                  <div style={{ fontSize: 13, color: "#14213d" }}>{f.feedback}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            style={{ background: "#14213d", color: "#d8c9a3", flex: 1 }}
            onClick={() => { setFase("menu"); setResultaat(null); }}>
            Terug naar menu
          </Button>
          <Button variant="outline" style={{ flex: 1 }}
            onClick={() => { setResultaat(null); startMutation.mutate(); }}>
            Nieuwe sessie
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ── StmSectie — wrapper met coach-detectie ────────────────────────────────

function StmSectie({ token }: { token: string }) {
  const coachQuery = useQuery({
    queryKey: ["/api/dashboard/is-coach", token],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/dashboard/${token}/is-coach`).then(r => r.json()),
    staleTime: 60000,
  });

  // Niet laden of niet-coach: niets tonen
  if (coachQuery.isLoading || !coachQuery.data?.isCoach) return null;

  return (
    <section className="mt-8" data-testid="stm-sectie">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground" style={{ marginBottom: 16 }}>
        <BookOpen className="h-4 w-4" /> Self-Training Module
      </h2>
      <div style={{ background: "#f9f6f0", borderRadius: 12, padding: "4px 0 0 0", border: "1px solid #e8e4dc" }}>
        <div style={{ padding: "12px 16px 4px", borderBottom: "1px solid #e8e4dc", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#7a7468" }}>
            Als geaccrediteerd TaPas coach train je hier je kennis van de methodiek.
            Je scores worden bijgehouden voor kwaliteitsmonitoring.
          </p>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <DashboardStmModule token={token} />
        </div>
      </div>
    </section>
  );
}
