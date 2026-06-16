// =============================================================================
// Rondleiding — "De vlucht" door het platform.
//
// Een onderscheidende product-tour die voortbouwt op het Earhart-merkteken:
// de gebruiker maakt geen "rondleiding" maar een korte VLUCHT door het platform.
// Elke etappe dimt het scherm, zet een zachte spotlight (teal/goud-gloed) op het
// echte element, en tekent een fijne gouden vluchtroute-boog naar het volgende
// punt. Warm, bezield, topprofessioneel — talent & passie tot in het detail.
//
// - Werkt bovenop de echte schermen via data-tour anchors (geen losse mock).
// - Meertalig (NL/FR/EN/ES/RU), zelf-bevattend (geen i18n-vervuiling).
// - Toetsenbord: → / Enter = verder, ← = terug, Esc = sluiten.
// - Respecteert prefers-reduced-motion (geen drift/teken-animatie).
// - Eerste-bezoek-trigger via localStorage; herstartbaar via startRondleiding().
// =============================================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plane, ArrowRight, ArrowLeft, X, Compass, Volume2, VolumeX } from "lucide-react";
import { type Taal } from "@shared/i18n";
import { vlucht, geluidUit, zetGeluidUit } from "@/lib/flightSound";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal) => m[t] ?? m.nl;

const LS_KEY = "tapas_rondleiding_gezien_v1";

// --- Publieke API: start de rondleiding van buitenaf (bv. via een knop). ---
export function startRondleiding() {
  window.dispatchEvent(new CustomEvent("tapas:rondleiding-start"));
}
export function rondleidingGezien(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

// --- Eén etappe van de vlucht. ---
interface Etappe {
  anchor: string; // data-tour attribuutwaarde van het doel-element
  etappe: ML; // klein label, bv. "Etappe 1 · Vertrek"
  titel: ML;
  body: ML;
  // Voorkeurszijde van de kaart t.o.v. het doel.
  voorkeur?: "boven" | "onder" | "auto";
}

// De vlucht-route over de homepagina. Anchors verwijzen naar data-tour="...".
const ETAPPES: Etappe[] = [
  {
    anchor: "taalkiezer",
    etappe: { nl: "Etappe 1 · Vertrek", fr: "Étape 1 · Départ", en: "Leg 1 · Departure", es: "Etapa 1 · Salida", ru: "Этап 1 · Отправление" },
    titel: { nl: "Eerst je taal", fr: "D'abord votre langue", en: "Your language first", es: "Primero tu idioma", ru: "Сначала язык" },
    body: {
      nl: "Kies hier de taal. Ze bepaalt straks de volledige vragenlijst én het rapport — een bewuste eerste keuze.",
      fr: "Choisissez la langue ici. Elle déterminera tout le questionnaire et le rapport — un premier choix réfléchi.",
      en: "Pick your language here. It will shape the whole questionnaire and the report — a deliberate first choice.",
      es: "Elige tu idioma aquí. Determinará todo el cuestionario y el informe: una primera elección consciente.",
      ru: "Выберите язык здесь. Он определит весь опросник и отчёт — осознанный первый выбор.",
    },
    voorkeur: "onder",
  },
  {
    anchor: "start-cta",
    etappe: { nl: "Etappe 2 · Opstijgen", fr: "Étape 2 · Décollage", en: "Leg 2 · Take-off", es: "Etapa 2 · Despegue", ru: "Этап 2 · Взлёт" },
    titel: { nl: "Een profiel starten", fr: "Lancer un profil", en: "Start a profile", es: "Iniciar un perfil", ru: "Начать профиль" },
    body: {
      nl: "Hier vertrekt alles: een deelnemer vult de vragenlijst in en ontvangt automatisch een professioneel profiel.",
      fr: "Tout part d'ici : un participant remplit le questionnaire et reçoit automatiquement un profil professionnel.",
      en: "Everything departs here: a participant fills in the questionnaire and automatically receives a professional profile.",
      es: "Todo parte de aquí: un participante completa el cuestionario y recibe automáticamente un perfil profesional.",
      ru: "Всё начинается отсюда: участник заполняет опросник и автоматически получает профессиональный профиль.",
    },
    voorkeur: "onder",
  },
  {
    anchor: "suite",
    etappe: { nl: "Etappe 3 · Op koers", fr: "Étape 3 · En route", en: "Leg 3 · On course", es: "Etapa 3 · En rumbo", ru: "Этап 3 · На курсе" },
    titel: { nl: "Eén suite, meerdere instrumenten", fr: "Une suite, plusieurs instruments", en: "One suite, several instruments", es: "Una suite, varios instrumentos", ru: "Один набор, несколько инструментов" },
    body: {
      nl: "Elk instrument heeft zijn eigen doel, maar deelt dezelfde omgeving. Elk rapport behoudt altijd zijn eigen, vaste layout.",
      fr: "Chaque instrument a son objectif propre, mais partage le même environnement. Chaque rapport garde toujours sa mise en page fixe.",
      en: "Each instrument has its own purpose but shares one environment. Every report always keeps its own fixed layout.",
      es: "Cada instrumento tiene su propósito pero comparte un mismo entorno. Cada informe mantiene siempre su diseño fijo.",
      ru: "У каждого инструмента своя цель, но единая среда. Каждый отчёт всегда сохраняет свой фиксированный макет.",
    },
    voorkeur: "boven",
  },
  {
    anchor: "keten",
    etappe: { nl: "Etappe 4 · De route", fr: "Étape 4 · L'itinéraire", en: "Leg 4 · The route", es: "Etapa 4 · La ruta", ru: "Этап 4 · Маршрут" },
    titel: { nl: "Van uitnodiging tot rapport", fr: "De l'invitation au rapport", en: "From invitation to report", es: "De la invitación al informe", ru: "От приглашения до отчёта" },
    body: {
      nl: "De volledige keten in vier stappen: uitnodigen, invullen, scoren en rapporteren — beveiligd en meertalig.",
      fr: "La chaîne complète en quatre étapes : inviter, remplir, scorer et rapporter — sécurisée et multilingue.",
      en: "The full chain in four steps: invite, complete, score and report — secure and multilingual.",
      es: "La cadena completa en cuatro pasos: invitar, completar, puntuar e informar — segura y multilingüe.",
      ru: "Полная цепочка в четыре шага: пригласить, заполнить, оценить и отчитаться — безопасно и многоязычно.",
    },
    voorkeur: "boven",
  },
  {
    anchor: "admin-cta",
    etappe: { nl: "Etappe 5 · Landen", fr: "Étape 5 · Atterrissage", en: "Leg 5 · Landing", es: "Etapa 5 · Aterrizaje", ru: "Этап 5 · Посадка" },
    titel: { nl: "Opvolgen in de beheeromgeving", fr: "Suivre dans l'administration", en: "Follow up in the admin area", es: "Seguimiento en administración", ru: "Контроль в админ-зоне" },
    body: {
      nl: "Hier volg je deelnemers en sessies op: wie is uitgenodigd, wie is bezig, wie is klaar. Klaar voor je eigen vlucht.",
      fr: "Ici vous suivez participants et sessions : qui est invité, en cours, terminé. Prêt pour votre propre vol.",
      en: "Here you track participants and sessions: who is invited, in progress, done. Ready for your own flight.",
      es: "Aquí sigues participantes y sesiones: invitados, en curso, terminados. Listo para tu propio vuelo.",
      ru: "Здесь вы отслеживаете участников и сессии: приглашён, в процессе, завершён. Готовы к своему полёту.",
    },
    voorkeur: "onder",
  },
];

// Welkom-/slottekst.
const WELKOM = {
  oog: { nl: "AAN BOORD", fr: "À BORD", en: "ALL ABOARD", es: "A BORDO", ru: "НА БОРТУ" },
  titel: { nl: "Klaar voor een korte vlucht?", fr: "Prêt pour un court vol ?", en: "Ready for a short flight?", es: "¿Listo para un vuelo corto?", ru: "Готовы к короткому полёту?" } as ML,
  body: {
    nl: "In vijf etappes laten we je het platform van begin tot eind zien. Het duurt nog geen minuut — en je kunt op elk moment uitstappen.",
    fr: "En cinq étapes, découvrez le platform de bout en bout. Moins d'une minute — et vous pouvez descendre à tout moment.",
    en: "In five legs we show you the platform end to end. Under a minute — and you can step off any time.",
    es: "En cinco etapas te mostramos el platform de principio a fin. Menos de un minuto, y puedes bajarte cuando quieras.",
    ru: "За пять этапов мы покажем платформу от начала до конца. Меньше минуты — и вы можете сойти в любой момент.",
  } as ML,
  start: { nl: "Start de vlucht", fr: "Commencer le vol", en: "Start the flight", es: "Iniciar el vuelo", ru: "Начать полёт" } as ML,
  later: { nl: "Misschien later", fr: "Plus tard", en: "Maybe later", es: "Quizás luego", ru: "Позже" } as ML,
};
const SLOT = {
  oog: { nl: "AANGEKOMEN", fr: "ARRIVÉ", en: "ARRIVED", es: "LLEGADA", ru: "ПРИБЫЛИ" } as ML,
  titel: { nl: "Je bent rond.", fr: "Le tour est bouclé.", en: "You're all set.", es: "Listo, ya está.", ru: "Готово." } as ML,
  body: {
    nl: "Nu is het platform van jou. Start een profiel, of duik in de beheeromgeving — met talent en passie gebouwd, tot in het kleinste detail.",
    fr: "Le platform est à vous. Lancez un profil ou explorez l'administration — conçu avec talent et passion, jusqu'au moindre détail.",
    en: "The platform is yours now. Start a profile, or dive into the admin area — built with talent and passion, down to the smallest detail.",
    es: "Ahora el platform es tuyo. Inicia un perfil o explora la administración — hecho con talento y pasión, hasta el último detalle.",
    ru: "Теперь платформа ваша. Начните профиль или загляните в админ-зону — сделано с талантом и страстью, до мелочей.",
  } as ML,
  sluit: { nl: "Aan de slag", fr: "C'est parti", en: "Get started", es: "Empezar", ru: "Начать" } as ML,
};

const ALG = {
  verder: { nl: "Verder", fr: "Suivant", en: "Next", es: "Siguiente", ru: "Далее" } as ML,
  terug: { nl: "Terug", fr: "Retour", en: "Back", es: "Atrás", ru: "Назад" } as ML,
  sluiten: { nl: "Vlucht beëindigen", fr: "Terminer le vol", en: "End flight", es: "Terminar vuelo", ru: "Завершить полёт" } as ML,
  van: { nl: "van", fr: "sur", en: "of", es: "de", ru: "из" } as ML,
  geluidAan: { nl: "Motorgeluid aanzetten", fr: "Activer le son moteur", en: "Turn engine sound on", es: "Activar el sonido del motor", ru: "Включить звук двигателя" } as ML,
  geluidUit: { nl: "Motorgeluid dempen", fr: "Couper le son moteur", en: "Mute engine sound", es: "Silenciar el sonido del motor", ru: "Выключить звук двигателя" } as ML,
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  taal: Taal;
  /** Toon de welkom-uitnodiging automatisch bij eerste bezoek. */
  autoStart?: boolean;
}

type Fase = "dicht" | "welkom" | "etappe" | "slot";

export function Rondleiding({ taal, autoStart = true }: Props) {
  const reduce = useReducedMotion();
  const [fase, setFase] = useState<Fase>("dicht");
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const vorigRectRef = useRef<Rect | null>(null);
  // Geluid: discreet motorgeluid, met gebruikers-mute (onthouden in localStorage).
  const [gedempt, setGedempt] = useState<boolean>(() => geluidUit());

  // --- Doel-element opmeten ---
  const meet = useCallback((anchor: string): Rect | null => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, []);

  const naarEtappe = useCallback(
    (n: number) => {
      const e = ETAPPES[n];
      if (!e) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${e.anchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
      // Meet na een korte tick zodat scroll is verwerkt.
      window.setTimeout(() => {
        const r = meet(e.anchor);
        if (r) {
          vorigRectRef.current = rect;
          setRect(r);
        }
      }, reduce ? 0 : 320);
    },
    [meet, rect, reduce],
  );

  const open = useCallback(() => {
    if (rondleidingGezien()) {
      // herstart: spring meteen naar eerste etappe — en start de motor.
      vlucht.start();
      setFase("etappe");
      setIdx(0);
    } else {
      setFase("welkom");
    }
  }, []);

  // Mute-toggle: zet onthouden voorkeur en demp/herstart het lopende geluid.
  const wisselGeluid = useCallback(() => {
    setGedempt((vorig) => {
      const nu = !vorig;
      zetGeluidUit(nu);
      if (nu) {
        vlucht.demp();
      } else if (fase === "etappe") {
        // Midden in de vlucht weer aanzetten: motor slaat opnieuw aan.
        vlucht.start();
      }
      return nu;
    });
  }, [fase]);

  const sluit = useCallback((markeer = true) => {
    // Motor netjes uitzetten (geleidelijk, niet abrupt) zodra de vlucht eindigt.
    vlucht.stop();
    setFase("dicht");
    setRect(null);
    if (markeer) {
      try {
        localStorage.setItem(LS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startVlucht = useCallback(() => {
    // Motor slaat aan: toerental loopt op terwijl de eerste etappe verschijnt.
    vlucht.start();
    setFase("etappe");
    setIdx(0);
  }, []);

  const verder = useCallback(() => {
    setIdx((i) => {
      if (i >= ETAPPES.length - 1) {
        // Laatste etappe (landen) → motor geleidelijk uitzetten bij het slot.
        vlucht.stop();
        setFase("slot");
        return i;
      }
      return i + 1;
    });
  }, []);

  const terug = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // --- Eerste-bezoek autostart ---
  useEffect(() => {
    if (autoStart && !rondleidingGezien()) {
      const tmr = window.setTimeout(() => setFase("welkom"), 700);
      return () => window.clearTimeout(tmr);
    }
  }, [autoStart]);

  // --- Externe start-trigger (knop) ---
  useEffect(() => {
    const h = () => open();
    window.addEventListener("tapas:rondleiding-start", h);
    return () => window.removeEventListener("tapas:rondleiding-start", h);
  }, [open]);

  // --- Veiligheid: stop de motor als het component verdwijnt ---
  useEffect(() => {
    return () => vlucht.stop();
  }, []);

  // --- Bij etappe-wissel opnieuw meten ---
  useLayoutEffect(() => {
    if (fase === "etappe") naarEtappe(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, idx]);

  // --- Hermeten bij resize/scroll tijdens een etappe ---
  useEffect(() => {
    if (fase !== "etappe") return;
    const e = ETAPPES[idx];
    const hermeet = () => {
      const r = meet(e.anchor);
      if (r) setRect(r);
    };
    window.addEventListener("resize", hermeet);
    window.addEventListener("scroll", hermeet, true);
    return () => {
      window.removeEventListener("resize", hermeet);
      window.removeEventListener("scroll", hermeet, true);
    };
  }, [fase, idx, meet]);

  // --- Toetsenbord ---
  useEffect(() => {
    if (fase === "dicht") return;
    const h = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") sluit();
      else if (fase === "etappe") {
        if (ev.key === "ArrowRight" || ev.key === "Enter") verder();
        else if (ev.key === "ArrowLeft") terug();
      } else if (fase === "welkom" && ev.key === "Enter") startVlucht();
      else if (fase === "slot" && ev.key === "Enter") sluit();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fase, sluit, verder, terug, startVlucht]);

  if (fase === "dicht") return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const PAD = 8; // ruimte rond de spotlight

  // Spotlight-rect (met padding), geklemd binnen viewport.
  const sx = rect ? Math.max(0, rect.left - PAD) : 0;
  const sy = rect ? Math.max(0, rect.top - PAD) : 0;
  const sw = rect ? rect.width + PAD * 2 : 0;
  const sh = rect ? rect.height + PAD * 2 : 0;

  // Kaartpositie bepalen t.o.v. de spotlight.
  const e = ETAPPES[idx];
  const kaartBreed = Math.min(360, vw - 32);
  let kaartTop = 0;
  let kaartLeft = 0;
  if (rect) {
    const onder = e?.voorkeur !== "boven";
    const ruimteOnder = vh - (sy + sh);
    const plaatsOnder = e?.voorkeur === "onder" || (onder && ruimteOnder > 240);
    kaartTop = plaatsOnder ? sy + sh + 14 : Math.max(16, sy - 14 - 210);
    kaartLeft = Math.min(Math.max(16, sx + sw / 2 - kaartBreed / 2), vw - kaartBreed - 16);
  }

  // Vluchtroute-boog: van vorige spotlight-midden naar huidige.
  const vorig = vorigRectRef.current;
  const p0 = vorig ? { x: vorig.left + vorig.width / 2, y: vorig.top + vorig.height / 2 } : null;
  const p1 = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  const boog =
    p0 && p1 && !reduce
      ? `M ${p0.x} ${p0.y} Q ${(p0.x + p1.x) / 2} ${Math.min(p0.y, p1.y) - 70} ${p1.x} ${p1.y}`
      : null;

  const totaal = ETAPPES.length;

  // === Overlay-inhoud ===
  const inhoud = (
    <div className="fixed inset-0 z-[100]" aria-live="polite" role="dialog" aria-modal="true">
      {/* ---- WELKOM / SLOT: gecentreerde uitnodiging ---- */}
      {(fase === "welkom" || fase === "slot") && (
        <>
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => sluit()}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-card-border bg-card p-7 shadow-xl"
            >
              {/* gouden haarlijn bovenaan */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold))] to-transparent" />
              {/* zwevend vliegtuig-merkteken */}
              <motion.div
                aria-hidden
                className="absolute -right-6 -top-6 text-[hsl(var(--gold))]/15"
                animate={reduce ? {} : { y: [0, -6, 0], rotate: [0, -3, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <Plane className="h-28 w-28 -rotate-12" />
              </motion.div>

              <div className="relative">
                <div className="flex items-center gap-2 text-accent">
                  {fase === "welkom" ? <Plane className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {k(fase === "welkom" ? WELKOM.oog : SLOT.oog, taal)}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {k(fase === "welkom" ? WELKOM.titel : SLOT.titel, taal)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {k(fase === "welkom" ? WELKOM.body : SLOT.body, taal)}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  {fase === "welkom" ? (
                    <>
                      <button
                        onClick={startVlucht}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
                      >
                        {k(WELKOM.start, taal)}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => sluit()}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        {k(WELKOM.later, taal)}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => sluit()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
                    >
                      {k(SLOT.sluit, taal)}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* ---- ETAPPE: dim + spotlight + kaart ---- */}
      {fase === "etappe" && rect && (
        <>
          {/* Dim-laag met uitgesneden spotlight via SVG-mask */}
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="spotmask">
                <rect x="0" y="0" width={vw} height={vh} fill="white" />
                <motion.rect
                  initial={false}
                  animate={{ x: sx, y: sy, width: sw, height: sh }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
                  rx="12"
                  fill="black"
                />
              </mask>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
              </radialGradient>
            </defs>
            {/* donkere dim met gat */}
            <rect x="0" y="0" width={vw} height={vh} fill="hsl(var(--background))" fillOpacity="0.82" mask="url(#spotmask)" />
            {/* spotlight-randgloed (teal) */}
            <motion.rect
              initial={false}
              animate={{ x: sx, y: sy, width: sw, height: sh }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
              rx="12"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="1.5"
              strokeOpacity="0.9"
            />
            {/* zachte goud-veeg langs de bovenrand van de spotlight */}
            <motion.rect
              initial={false}
              animate={{ x: sx, y: sy, width: sw, height: sh }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
              rx="12"
              fill="none"
              stroke="hsl(var(--gold))"
              strokeWidth="3"
              strokeOpacity="0.18"
            />
            {/* vluchtroute-boog die zich tekent */}
            {boog && (
              <motion.path
                key={`boog-${idx}`}
                d={boog}
                fill="none"
                stroke="hsl(var(--gold))"
                strokeWidth="1.5"
                strokeDasharray="3 5"
                strokeOpacity="0.55"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />
            )}
          </svg>

          {/* klikvanger om de spotlight heen (sluit niet, voorkomt per ongeluk klikken) */}
          <div className="absolute inset-0" onClick={(ev) => ev.stopPropagation()} />

          {/* De etappe-kaart */}
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="absolute overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl"
              style={{ top: kaartTop, left: kaartLeft, width: kaartBreed }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold))] to-transparent" />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-accent">
                    <Plane className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {k(e.etappe, taal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={wisselGeluid}
                      aria-label={k(gedempt ? ALG.geluidAan : ALG.geluidUit, taal)}
                      title={k(gedempt ? ALG.geluidAan : ALG.geluidUit, taal)}
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      {gedempt ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => sluit()}
                      aria-label={k(ALG.sluiten, taal)}
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-2.5 text-lg font-semibold tracking-tight text-foreground">
                  {k(e.titel, taal)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {k(e.body, taal)}
                </p>

                {/* Etappe-voortgang: kleine vlieg-puntjes i.p.v. saaie stippen */}
                <div className="mt-4 flex items-center gap-1.5" aria-hidden>
                  {ETAPPES.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === idx
                          ? "w-6 bg-accent"
                          : i < idx
                            ? "w-1.5 bg-[hsl(var(--gold))]"
                            : "w-1.5 bg-border"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {idx + 1} {k(ALG.van, taal)} {totaal}
                  </span>
                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <button
                        onClick={terug}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {k(ALG.terug, taal)}
                      </button>
                    )}
                    <button
                      onClick={verder}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
                    >
                      {idx >= totaal - 1 ? k(SLOT.sluit, taal) : k(ALG.verder, taal)}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );

  return createPortal(<AnimatePresence>{inhoud}</AnimatePresence>, document.body);
}
