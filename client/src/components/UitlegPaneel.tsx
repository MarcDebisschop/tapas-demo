// =============================================================================
// UitlegPaneel — gesproken uitleg van het profiel (6 blokken).
// Audio via server-side TTS (Sulafat, Vlaamse stem, Gemini 2.5 Pro TTS).
// Backend levert script (al in de juiste taal) + limiet-status.
// Twee tonen: "deelnemer" (warm) en "coach" (zakelijk).
// Elke toon heeft een eigen 10-gratis-dan-betalen limiet.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Volume2,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Lock,
  Loader2,
  CreditCard,
  AudioLines,
} from "lucide-react";
import { type Taal } from "@shared/i18n";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal) => m[t] ?? m.nl;

export type Toon = "deelnemer" | "coach";

interface UitlegBlok {
  id: string;
  titel: string;
  tekst: string;
}
interface UitlegScript {
  taal: Taal;
  toon: Toon;
  naam: string | null;
  blokken: UitlegBlok[];
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
interface UitlegResponse {
  script: UitlegScript | null;
  limiet: Limiet;
}

const STR = {
  titelDeelnemer: {
    nl: "Laat je profiel uitleggen",
    fr: "Fais-toi expliquer ton profil",
    en: "Have your profile explained",
    es: "Deja que te expliquen tu perfil",
    ru: "Послушайте объяснение вашего профиля",
  } as ML,
  titelCoach: {
    nl: "Gesproken duiding voor de coach",
    fr: "Explication orale pour le coach",
    en: "Spoken briefing for the coach",
    es: "Explicación hablada para el coach",
    ru: "Устный разбор для коуча",
  } as ML,
  ondertitelDeelnemer: {
    nl: "Een rustige, gesproken uitleg van je profiel in zes korte stukken.",
    fr: "Une explication orale et posée de ton profil en six courtes parties.",
    en: "A calm, spoken walkthrough of your profile in six short parts.",
    es: "Una explicación hablada y tranquila de tu perfil en seis partes breves.",
    ru: "Спокойное устное объяснение вашего профиля в шести коротких частях.",
  } as ML,
  ondertitelCoach: {
    nl: "Een zakelijke, op coaching gerichte duiding van het profiel in zes blokken.",
    fr: "Une lecture professionnelle, orientee coaching, du profil en six blocs.",
    en: "A professional, coaching-oriented reading of the profile in six blocks.",
    es: "Una lectura profesional, orientada al coaching, del perfil en seis bloques.",
    ru: "Профессиональный, ориентированный на коучинг разбор профиля в шести блоках.",
  } as ML,
  start: {
    nl: "Start uitleg",
    fr: "Demarrer l'explication",
    en: "Start explanation",
    es: "Iniciar explicacion",
    ru: "Начать объяснение",
  } as ML,
  laden: {
    nl: "Uitleg wordt klaargezet...",
    fr: "Preparation de l'explication...",
    en: "Preparing the explanation...",
    es: "Preparando la explicacion...",
    ru: "Подготовка объяснения...",
  } as ML,
  stemLaden: {
    nl: "Stem laden...",
    fr: "Chargement de la voix...",
    en: "Loading voice...",
    es: "Cargando voz...",
    ru: "Загрузка голоса...",
  } as ML,
  blok: {
    nl: "Blok",
    fr: "Bloc",
    en: "Block",
    es: "Bloque",
    ru: "Блок",
  } as ML,
  van: {
    nl: "van",
    fr: "sur",
    en: "of",
    es: "de",
    ru: "из",
  } as ML,
  vorige: {
    nl: "Vorige",
    fr: "Precedent",
    en: "Previous",
    es: "Anterior",
    ru: "Назад",
  } as ML,
  volgende: {
    nl: "Volgende",
    fr: "Suivant",
    en: "Next",
    es: "Siguiente",
    ru: "Dalej",
  } as ML,
  speel: {
    nl: "Afspelen",
    fr: "Lire",
    en: "Play",
    es: "Reproducir",
    ru: "Воспроизвести",
  } as ML,
  pauze: {
    nl: "Pauze",
    fr: "Pause",
    en: "Pause",
    es: "Pausa",
    ru: "Пауза",
  } as ML,
  stop: {
    nl: "Stop",
    fr: "Arreter",
    en: "Stop",
    es: "Detener",
    ru: "Стоп",
  } as ML,
  teller: {
    nl: "gratis uitleg over",
    fr: "explications gratuites restantes",
    en: "free explanations left",
    es: "explicaciones gratuitas restantes",
    ru: "бесплатных объяснений осталось",
  } as ML,
  fout: {
    nl: "Er ging iets mis. Probeer het opnieuw.",
    fr: "Une erreur s'est produite. Reessaie.",
    en: "Something went wrong. Please try again.",
    es: "Algo salio mal. Intentalo de nuevo.",
    ru: "Что-то пошло не так. Попробуйте ещё раз.",
  } as ML,
  // Paywall
  paywallTitel: {
    nl: "Je gratis uitleg is op",
    fr: "Tes explications gratuites sont epuisees",
    en: "Your free explanations are used up",
    es: "Tus explicaciones gratuitas se han agotado",
    ru: "Бесплатные объяснения закончились",
  } as ML,
  paywallTekst: {
    nl: "Koop een pakket extra uitleg-beurten om verder te gaan.",
    fr: "Achete un pack d'explications supplementaires pour continuer.",
    en: "Buy a pack of extra explanation turns to continue.",
    es: "Compra un paquete de explicaciones extra para continuar.",
    ru: "Купите пакет дополнительных объяснений, чтобы продолжить.",
  } as ML,
  paywallKoop: {
    nl: "Dit pakket bevat",
    fr: "Ce pack contient",
    en: "This pack contains",
    es: "Este paquete contiene",
    ru: "Этот пакет содержит",
  } as ML,
  paywallEenheid: {
    nl: "uitleg-beurten",
    fr: "explications",
    en: "explanation turns",
    es: "explicaciones",
    ru: "объяснений",
  } as ML,
  paywallDemo: {
    nl: "Pakket toevoegen (demo)",
    fr: "Ajouter le pack (demo)",
    en: "Add pack (demo)",
    es: "Anadir paquete (demo)",
    ru: "Добавить пакет (демо)",
  } as ML,
  paywallNote: {
    nl: "In deze testfase wordt er niets aangerekend.",
    fr: "Aucun frais durant cette phase de test.",
    en: "Nothing is charged during this test phase.",
    es: "No se cobra nada en esta fase de prueba.",
    ru: "В тестовой фазе оплата не взимается.",
  } as ML,
  paywallGelukt: {
    nl: "Gelukt — je kunt weer verder.",
    fr: "C'est bon — tu peux continuer.",
    en: "Done — you can continue.",
    es: "Listo — puedes continuar.",
    ru: "Готово — можно продолжать.",
  } as ML,
};

function UitlegPaneel({ token, taal, toon = "deelnemer" }: { token: string; taal: Taal; toon?: Toon }) {
  const [actief, setActief] = useState(false);
  const [index, setIndex] = useState(0);
  const [spreekt, setSpreekt] = useState(false);
  const [gepauzeerd, setGepauzeerd] = useState(false);
  const [ttsLaden, setTtsLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Server-side audio (Sulafat — Vlaamse stem, altijd dezelfde ongeacht browser/taal)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const status = useQuery<UitlegResponse>({
    queryKey: ["/api/dashboard", token, "uitleg", toon],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/${token}/uitleg?toon=${toon}`);
      return res.json();
    },
  });

  const [script, setScript] = useState<UitlegScript | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dashboard/${token}/uitleg`, { toon });
      return (await res.json()) as UitlegResponse;
    },
    onSuccess: (data) => {
      setFout(null);
      setScript(data.script);
      setIndex(0);
      setActief(true);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token, "uitleg", toon] });
    },
    onError: (e: Error) => {
      if (String(e.message).includes("402")) {
        setPaywallOpen(true);
      } else {
        setFout(k(STR.fout, taal));
      }
    },
  });

  const koop = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dashboard/${token}/uitleg/koop-extra`, { toon });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", token, "uitleg", toon] });
    },
  });

  const blokken = script?.blokken ?? [];
  const huidig = blokken[index];

  // --- Sulafat TTS helpers (server-side, Vlaamse stem — altijd dezelfde ongeacht browser) ---
  function stopSpraak() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
    audioRef.current = null;
    setSpreekt(false);
    setGepauzeerd(false);
    setTtsLaden(false);
  }

  async function spreek(tekst: string) {
    stopSpraak();
    setTtsLaden(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("TTS mislukt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpreekt(false);
        setGepauzeerd(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpreekt(false);
        setGepauzeerd(false);
      };
      setTtsLaden(false);
      setSpreekt(true);
      audio.play();
    } catch {
      setTtsLaden(false);
      setSpreekt(false);
      setFout(k(STR.fout, taal));
    }
  }

  function speelHuidig() {
    if (huidig) spreek(huidig.tekst);
  }

  function pauzeOfHervat() {
    const a = audioRef.current;
    if (!a) return;
    if (gepauzeerd) {
      a.play();
      setGepauzeerd(false);
    } else {
      a.pause();
      setGepauzeerd(true);
    }
  }

  function ga(naar: number) {
    const n = Math.max(0, Math.min(blokken.length - 1, naar));
    setIndex(n);
    stopSpraak();
    const b = blokken[n];
    if (b) spreek(b.tekst);
  }

  // Stop audio bij unmount.
  useEffect(() => () => stopSpraak(), []);

  const limiet = status.data?.limiet;
  const resterend = limiet?.resterend ?? 0;
  const titel = toon === "coach" ? STR.titelCoach : STR.titelDeelnemer;
  const ondertitel = toon === "coach" ? STR.ondertitelCoach : STR.ondertitelDeelnemer;

  return (
    <Card data-testid={`card-uitleg-${toon}`}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <AudioLines className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">{k(titel, taal)}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{k(ondertitel, taal)}</p>
            </div>
          </div>
          {limiet && (
            <Badge variant="secondary" className="shrink-0" data-testid={`badge-uitleg-teller-${toon}`}>
              {resterend} {k(STR.teller, taal)}
            </Badge>
          )}
        </div>

        {fout && <p className="mt-4 text-sm text-destructive">{fout}</p>}

        {!actief ? (
          <div className="mt-5">
            <Button
              onClick={() => start.mutate()}
              disabled={start.isPending || status.isLoading}
              data-testid={`button-uitleg-start-${toon}`}
            >
              {start.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className="mr-2 h-4 w-4" />
              )}
              {start.isPending ? k(STR.laden, taal) : k(STR.start, taal)}
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Voortgang */}
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span data-testid={`text-uitleg-voortgang-${toon}`}>
                {k(STR.blok, taal)} {index + 1} {k(STR.van, taal)} {blokken.length}
              </span>
            </div>

            {/* Huidig blok */}
            {huidig && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground" data-testid={`text-uitleg-titel-${toon}`}>
                  {huidig.titel}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                  data-testid={`text-uitleg-tekst-${toon}`}
                >
                  {huidig.tekst}
                </p>
              </div>
            )}

            {/* Audio-bediening */}
            <div className="flex flex-wrap items-center gap-2">
              {ttsLaden ? (
                <Button size="sm" disabled data-testid={`button-uitleg-laden-${toon}`}>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {k(STR.stemLaden, taal)}
                </Button>
              ) : !spreekt ? (
                <Button size="sm" onClick={speelHuidig} data-testid={`button-uitleg-speel-${toon}`}>
                  <Play className="mr-2 h-4 w-4" /> {k(STR.speel, taal)}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={pauzeOfHervat} data-testid={`button-uitleg-pauze-${toon}`}>
                  {gepauzeerd ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {gepauzeerd ? k(STR.speel, taal) : k(STR.pauze, taal)}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={stopSpraak} data-testid={`button-uitleg-stop-${toon}`}>
                <Square className="mr-2 h-4 w-4" /> {k(STR.stop, taal)}
              </Button>
            </div>

            {/* Bloknavigatie */}
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => ga(index - 1)}
                disabled={index === 0}
                data-testid={`button-uitleg-vorige-${toon}`}
              >
                <SkipBack className="mr-2 h-4 w-4" /> {k(STR.vorige, taal)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ga(index + 1)}
                disabled={index >= blokken.length - 1}
                data-testid={`button-uitleg-volgende-${toon}`}
              >
                {k(STR.volgende, taal)} <SkipForward className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Paywall */}
      <UitlegPaywall
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

function UitlegPaywall({
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
      <DialogContent data-testid="dialog-uitleg-paywall">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Lock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{k(STR.paywallTitel, taal)}</DialogTitle>
          <DialogDescription className="text-center">{k(STR.paywallTekst, taal)}</DialogDescription>
        </DialogHeader>

        {gelukt && limiet && !limiet.geblokkeerd ? (
          <p
            className="rounded-lg bg-accent/10 px-4 py-3 text-center text-sm font-medium text-accent"
            data-testid="text-uitleg-paywall-gelukt"
          >
            {k(STR.paywallGelukt, taal)}
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">{k(STR.paywallKoop, taal)}</p>
              <p className="mt-1 text-xl font-semibold text-foreground" data-testid="text-uitleg-paywall-pakket">
                {pakket} {k(STR.paywallEenheid, taal)}
              </p>
            </div>
            <Button onClick={onKoop} disabled={bezig} className="w-full" data-testid="button-uitleg-koop-extra">
              {bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {k(STR.paywallDemo, taal)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{k(STR.paywallNote, taal)}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UitlegPaneel;
