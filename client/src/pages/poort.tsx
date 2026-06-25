// ---------------------------------------------------------------------------
// TaPas Platform — Poort (Cijferslot)
//
// Toegangsschil voor het persoonlijk dashboard.
// Drie skins via route-parameter:
//   /#/poort           → Business  (Kluisslot, marineblauw)
//   /#/poort/students  → Students  (Combinatieslot, warm goud)
//   /#/poort/teens     → Teens     (Geheime Slot, paars/magisch)
//
// Drie lagen:
//   1. Slot       — vier draaischijven + e-mailveld → POST /api/deelnemers/login
//   2. Ademhaling — gloeiende cirkel (4s in / 2s vast / 6s uit) + mantra + skip
//   3. Overgang   — dissolve-tekst → navigate naar /#/dashboard/:token
//
// Hergebruikt volledig de bestaande backend:
//   POST /api/deelnemers/login  → { dashboardToken, dashboardCode? }
//   GET  /api/dashboard/:token  → bestaande dashboard-pagina
//
// dashboardCode is optioneel: als de server het niet meestuurt, valt de
// component terug op de vaste fallback-combinatie [2,0,2,6].
// Geen schema-wijzigingen, geen nieuwe backend-routes.
//
// CSS: twee regels in index.css supprimeren het Earhart-watermerk op deze pagina.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { normaliseerTaal, TAAL_CODES, type Taal } from "@shared/i18n";

// ---------------------------------------------------------------------------
// Hulpfunctie: taal detecteren uit navigator
// ---------------------------------------------------------------------------
function detecteerTaal(nav: string): Taal {
  return normaliseerTaal(nav?.slice(0, 2) ?? "nl");
}

// ---------------------------------------------------------------------------
// Skin-configuratie (exact uit originele bundle)
// ---------------------------------------------------------------------------
interface SkinConfig {
  id: string;
  naam: string;
  bg: string;              // CSS gradient fallback
  bgImage: string;         // sfeerfoto
  bgPositie: string;
  accent: string;
  accentZacht: string;
  schijf: string;          // gradient voor draaischijf-achtergrond
  schijfRand: string;
  welkom: Record<Taal, string>;
  ondertitel: Record<Taal, string>;
  mantra: Record<Taal, string>;
}

const SKINS: Record<string, SkinConfig> = {
  business: {
    id: "business",
    naam: "Kluisslot",
    bg: "radial-gradient(120% 90% at 50% 0%, #14213d 0%, #0b1326 55%, #060a16 100%)",
    bgImage: "/poort/bg-business.png",
    bgPositie: "center center",
    accent: "#d8c9a3",
    accentZacht: "rgba(216,201,163,0.45)",
    schijf: "linear-gradient(180deg, #344158 0%, #1b2740 50%, #0e1830 100%)",
    schijfRand: "rgba(216,201,163,0.35)",
    welkom: {
      nl: "Welkom terug. Jouw plek is er nog.",
      fr: "Bon retour. Ta place est toujours là.",
      en: "Welcome back. Your place is still here.",
      es: "Bienvenido de nuevo. Tu lugar sigue aquí.",
      ru: "С возвращением. Ваше место всё ещё здесь.",
    },
    ondertitel: {
      nl: "Draai de combinatie om verder te gaan naar wat van jou is.",
      fr: "Compose la combinaison pour accéder à ce qui t'appartient.",
      en: "Turn the combination to reach what is yours.",
      es: "Gira la combinación para llegar a lo que es tuyo.",
      ru: "Наберите комбинацию, чтобы попасть к тому, что ваше.",
    },
    mantra: {
      nl: "Leiderschap begint bij zelfkennis.",
      fr: "Le leadership commence par la connaissance de soi.",
      en: "Leadership begins with self-knowledge.",
      es: "El liderazgo empieza por el autoconocimiento.",
      ru: "Лидерство начинается с самопознания.",
    },
  },
  students: {
    id: "students",
    naam: "Combinatieslot",
    bg: "radial-gradient(120% 90% at 50% 0%, #2a1f3d 0%, #1a1530 55%, #0f0b1c 100%)",
    bgImage: "/poort/bg-students.png",
    bgPositie: "center center",
    accent: "#e9c46a",
    accentZacht: "rgba(233,196,106,0.45)",
    schijf: "linear-gradient(180deg, #4a3d2a 0%, #2c2418 50%, #1a140c 100%)",
    schijfRand: "rgba(233,196,106,0.4)",
    welkom: {
      nl: "Fijn dat je er weer bent. Jouw plek is er nog.",
      fr: "Content de te revoir. Ta place est toujours là.",
      en: "Good to see you again. Your place is still here.",
      es: "Qué bueno verte de nuevo. Tu lugar sigue aquí.",
      ru: "Рады снова видеть. Ваше место всё ещё здесь.",
    },
    ondertitel: {
      nl: "Stel de combinatie in en open wat je over jezelf ontdekte.",
      fr: "Règle la combinaison et ouvre ce que tu as découvert sur toi.",
      en: "Set the combination and open what you discovered about yourself.",
      es: "Ajusta la combinación y abre lo que descubriste sobre ti.",
      ru: "Наберите комбинацию и откройте то, что узнали о себе.",
    },
    mantra: {
      nl: "Jij bent meer dan je cijfers.",
      fr: "Tu es bien plus que tes notes.",
      en: "You are more than your grades.",
      es: "Eres más que tus notas.",
      ru: "Вы — больше, чем ваши оценки.",
    },
  },
  teens: {
    id: "teens",
    naam: "Geheime Slot",
    bg: "radial-gradient(120% 90% at 50% 0%, #3a2150 0%, #241338 55%, #150a26 100%)",
    bgImage: "/poort/bg-teens.png",
    bgPositie: "center center",
    accent: "#c9a8ff",
    accentZacht: "rgba(201,168,255,0.5)",
    schijf: "linear-gradient(180deg, #4d3a6e 0%, #2e2147 50%, #1b1230 100%)",
    schijfRand: "rgba(201,168,255,0.45)",
    welkom: {
      nl: "Hé, daar ben je weer. Jouw plek is er nog.",
      fr: "Hé, te revoilà. Ta place est toujours là.",
      en: "Hey, you're back. Your place is still here.",
      es: "Hey, has vuelto. Tu lugar sigue aquí.",
      ru: "Привет, ты вернулся. Твоё место всё ещё здесь.",
    },
    ondertitel: {
      nl: "Draai aan het slot en ontdek opnieuw wie je bent.",
      fr: "Tourne le cadenas et redécouvre qui tu es.",
      en: "Turn the lock and rediscover who you are.",
      es: "Gira el candado y redescubre quién eres.",
      ru: "Поверни замок и заново открой, кто ты.",
    },
    mantra: {
      nl: "Je bent al genoeg.",
      fr: "Tu es déjà assez.",
      en: "You are already enough.",
      es: "Ya eres suficiente.",
      ru: "Ты уже достаточно хорош.",
    },
  },
};

// ---------------------------------------------------------------------------
// UI-strings (exact uit originele bundle)
// ---------------------------------------------------------------------------
const T: Record<string, Record<Taal, string>> = {
  emailLabel: {
    nl: "Jouw e-mailadres",
    fr: "Ton adresse e-mail",
    en: "Your email address",
    es: "Tu correo electrónico",
    ru: "Ваш адрес почты",
  },
  taalLabel: {
    nl: "Taal",
    fr: "Langue",
    en: "Language",
    es: "Idioma",
    ru: "Язык",
  },
  draai: {
    nl: "Draai de combinatie",
    fr: "Composer la combinaison",
    en: "Turn the combination",
    es: "Girar la combinación",
    ru: "Набрать комбинацию",
  },
  bezig: {
    nl: "De schijven draaien…",
    fr: "Les cadrans tournent…",
    en: "The dials are turning…",
    es: "Los discos están girando…",
    ru: "Диски вращаются…",
  },
  fout: {
    nl: "Dit slot herkent dit e-mailadres nog niet. Controleer of het juist is.",
    fr: "Ce cadenas ne reconnaît pas encore cette adresse. Vérifie qu'elle est correcte.",
    en: "This lock doesn't recognize this email yet. Check that it's correct.",
    es: "Este candado aún no reconoce este correo. Comprueba que sea correcto.",
    ru: "Этот замок пока не узнаёт эту почту. Проверьте правильность.",
  },
  ademIn: { nl: "Adem in", fr: "Inspire", en: "Breathe in", es: "Inhala", ru: "Вдох" },
  ademVast: { nl: "Houd vast", fr: "Retiens", en: "Hold", es: "Sostén", ru: "Задержи" },
  ademUit: { nl: "Adem uit", fr: "Expire", en: "Breathe out", es: "Exhala", ru: "Выдох" },
  slaOver: { nl: "Sla over", fr: "Passer", en: "Skip", es: "Omitir", ru: "Пропустить" },
  binnen: { nl: "Je bent binnen", fr: "Tu es entré", en: "You're in", es: "Has entrado", ru: "Вы вошли" },
};

// Vertaalhulp
const vo = (m: Record<Taal, string>, t: Taal): string => m[t] ?? m.nl;

// ---------------------------------------------------------------------------
// Fallback combinatie + dashboardCode → cijfer-array parser
// ---------------------------------------------------------------------------
const FALLBACK_COMBO = [2, 0, 2, 6];

function parseCode(code: string | undefined): number[] {
  if (code && /^\d{4}$/.test(code)) {
    return code.split("").map(Number);
  }
  return FALLBACK_COMBO;
}

// ---------------------------------------------------------------------------
// Draaischijf-component (exact animatielogica uit bundle)
// ---------------------------------------------------------------------------
interface DraaischijfProps {
  waarde: number;
  actief: boolean;   // true = deze schijf draait op dit moment
  juist: boolean;    // true = op doelwaarde geland
  skin: SkinConfig;
}

function Draaischijf({ waarde, actief, juist, skin }: DraaischijfProps) {
  return (
    <div
      data-testid="draaischijf"
      style={{
        position: "relative",
        width: 56,
        height: 84,
        borderRadius: 12,
        background: skin.schijf,
        border: `1px solid ${juist ? skin.accent : skin.schijfRand}`,
        boxShadow: juist
          ? `0 0 18px ${skin.accentZacht}, inset 0 1px 0 rgba(255,255,255,0.12)`
          : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -8px 14px rgba(0,0,0,0.5)",
        overflow: "hidden",
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      {/* Bovenkant/onderkant schaduwoverlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={waarde}
          initial={{ y: actief ? 28 : 0, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -28, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: juist ? skin.accent : "rgba(255,255,255,0.82)",
            textShadow: juist ? `0 0 12px ${skin.accentZacht}` : "none",
          }}
        >
          {waarde}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ademhaling-component (exact timings uit bundle: 4s/2s/6s, totaal 12.5s)
// ---------------------------------------------------------------------------
interface AdemhalingProps {
  skin: SkinConfig;
  taal: Taal;
  onKlaar: () => void;
}

function Ademhaling({ skin, taal, onKlaar }: AdemhalingProps) {
  const [fase, setFase] = useState<"in" | "vast" | "uit">("in");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t1 = setTimeout(() => setFase("vast"), 4000);
    const t2 = setTimeout(() => setFase("uit"), 6000);
    const t3 = setTimeout(() => onKlaar(), 12500);
    timersRef.current = [t1, t2, t3];
    return () => timersRef.current.forEach(clearTimeout);
  }, [onKlaar]);

  const label =
    fase === "in" ? T.ademIn : fase === "vast" ? T.ademVast : T.ademUit;

  const circleAnim =
    fase === "in" || fase === "vast"
      ? { scale: 1.6, opacity: 0.95 }
      : { scale: 1.0, opacity: 0.7 };
  const circleDur = fase === "in" ? 4 : fase === "vast" ? 0.2 : 6;

  return (
    <motion.div
      data-testid="poort-ademhaling"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.8 }}
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          animate={circleAnim}
          transition={{ duration: circleDur, ease: "easeInOut" }}
          style={{
            position: "absolute",
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 45%, ${skin.accent} 0%, ${skin.accentZacht} 55%, transparent 75%)`,
            boxShadow: `0 0 60px ${skin.accentZacht}`,
          }}
        />
        <span
          data-testid="text-adem-label"
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: "0.04em",
          }}
        >
          {vo(label, taal)}
        </span>
      </div>

      <p
        data-testid="text-mantra"
        style={{
          maxWidth: 320,
          textAlign: "center",
          fontSize: 17,
          lineHeight: 1.5,
          color: skin.accent,
          fontStyle: "italic",
          margin: 0,
        }}
      >
        {vo(skin.mantra, taal)}
      </p>

      <button
        data-testid="button-sla-over"
        onClick={onKlaar}
        style={{
          marginTop: 4,
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          fontSize: 13.5,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {vo(T.slaOver, taal)}
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Hoofd-component: Poort
// ---------------------------------------------------------------------------
type Fase = "slot" | "ademhaling" | "overgang";

const TALEN_OPTIES: Taal[] = ["nl", "fr", "en", "es", "ru"];

export default function Poort() {
  const params = useParams<{ skin?: string }>();
  const [, navigate] = useLocation();

  // Skin bepalen op basis van route-parameter
  const skinKey = params.skin?.toLowerCase();
  const skin =
    skinKey === "students"
      ? SKINS.students
      : skinKey === "teens"
      ? SKINS.teens
      : SKINS.business;

  // Taal: detecteer uit browser, normaliseer
  const [taal, setTaal] = useState<Taal>(() =>
    detecteerTaal(navigator.language ?? "nl")
  );

  // Formulier
  const [email, setEmail] = useState("");

  // Draaischijven: [huidig cijfer per schijf], actieve schijf-index, doelcombinatie
  const [schijfWaarden, setSchijfWaarden] = useState([0, 0, 0, 0]);
  const [actieveSchijf, setActieveSchijf] = useState(-1);
  const [doelCombo, setDoelCombo] = useState(FALLBACK_COMBO);
  const doelRef = useRef(FALLBACK_COMBO);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dashboard-token (bewaard voor navigate na ademhaling)
  const [dashboardToken, setDashboardToken] = useState<string | null>(null);

  // Scherm-fase
  const [fase, setFase] = useState<Fase>("slot");

  // ---------------------------------------------------------------------------
  // Schijf-animatie (exact uit bundle: 8 ticks per schijf, 70ms interval)
  // ---------------------------------------------------------------------------
  function startSchijfAnimatie(doelArr: number[]) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const doel = doelArr;
    let tick = 0;
    let waarden = [0, 0, 0, 0];
    setActieveSchijf(0);

    intervalRef.current = setInterval(() => {
      const schijfIdx = Math.min(Math.floor(tick / 8), 4);

      if (schijfIdx > 3) {
        // Alle schijven klaar
        if (intervalRef.current) clearInterval(intervalRef.current);
        setActieveSchijf(-1);
        setTimeout(() => setFase("ademhaling"), 900);
        return;
      }

      const tickInSchijf = tick % 8;
      const activeIdx = Math.min(Math.max(schijfIdx, 0), 3);

      if (tickInSchijf < 7) {
        // Willekeurige waarde tonen
        waarden = [...waarden];
        waarden[activeIdx] = Math.floor(Math.random() * 10);
        setSchijfWaarden([...waarden]);
        setActieveSchijf(activeIdx);
      } else {
        // Op doel landen
        waarden = [...waarden];
        waarden[activeIdx] = doel[activeIdx];
        setSchijfWaarden([...waarden]);
      }

      tick++;
    }, 70);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Login-mutatie
  // ---------------------------------------------------------------------------
  const loginMutatie = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deelnemers/login", {
        email: email.trim(),
        taal,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setDashboardToken(data.dashboardToken);
      const combo = parseCode(data.dashboardCode);
      setDoelCombo(combo);
      doelRef.current = combo;
      startSchijfAnimatie(combo);
    },
  });

  // Alle schijven op doel?
  const alleJuist =
    schijfWaarden[0] === doelCombo[0] &&
    schijfWaarden[1] === doelCombo[1] &&
    schijfWaarden[2] === doelCombo[2] &&
    schijfWaarden[3] === doelCombo[3];

  // ---------------------------------------------------------------------------
  // Navigate naar dashboard na ademhaling
  // ---------------------------------------------------------------------------
  const naarDashboard = useCallback(() => {
    setFase("overgang");
    setTimeout(() => {
      if (dashboardToken) navigate(`/dashboard/${dashboardToken}`);
    }, 1100);
  }, [dashboardToken, navigate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="poort-pagina"
      data-testid={`poort-${skin.id}`}
      style={{
        minHeight: "100dvh",
        background: skin.bg,
        "--poort-bg": skin.bg,
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        position: "relative",
        overflow: "hidden",
      } as React.CSSProperties}
    >
      {/* Sfeerbeeldfoto */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${skin.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: skin.bgPositie,
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
        }}
      />

      {/* Donkere radiale overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(70% 60% at 50% 48%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 60%, rgba(0,0,0,0.52) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Accent glow overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(46% 36% at 50% 46%, ${skin.accentZacht} 0%, transparent 70%)`,
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />

      {/* Inhoud — AnimatePresence wisselt tussen slot / ademhaling / overgang */}
      <AnimatePresence mode="wait">
        {fase === "slot" && (
          <motion.div
            key="slot"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 420,
              textAlign: "center",
            }}
          >
            {/* Welkomtitel */}
            <h1
              data-testid="text-welkom"
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {vo(skin.welkom, taal)}
            </h1>

            {/* Ondertitel */}
            <p
              style={{
                marginTop: 10,
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.66)",
              }}
            >
              {vo(skin.ondertitel, taal)}
            </p>

            {/* Draaischijven */}
            <div
              style={{
                marginTop: 30,
                display: "flex",
                gap: 12,
                justifyContent: "center",
              }}
            >
              {schijfWaarden.map((w, i) => (
                <Draaischijf
                  key={i}
                  waarde={w}
                  actief={actieveSchijf === i}
                  juist={(alleJuist || schijfWaarden[i] === doelCombo[i]) && actieveSchijf < 0}
                  skin={skin}
                />
              ))}
            </div>

            {/* Formulier */}
            <form
              style={{ marginTop: 30, textAlign: "left" }}
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim() && !loginMutatie.isPending) {
                  loginMutatie.mutate();
                }
              }}
            >
              {/* E-mail */}
              <label
                htmlFor="poort-email"
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 6,
                }}
              >
                {vo(T.emailLabel, taal)}
              </label>
              <input
                id="poort-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@voorbeeld.be"
                data-testid="input-email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${skin.schijfRand}`,
                  background: "rgba(8,12,22,0.55)",
                  color: "white",
                  fontSize: 15,
                  outline: "none",
                  backdropFilter: "blur(2px)",
                }}
              />

              {/* Taal */}
              <label
                htmlFor="poort-taal"
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  margin: "14px 0 6px",
                }}
              >
                {vo(T.taalLabel, taal)}
              </label>
              <select
                id="poort-taal"
                value={taal}
                onChange={(e) => setTaal(e.target.value as Taal)}
                data-testid="select-taal"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${skin.schijfRand}`,
                  background: "rgba(8,12,22,0.55)",
                  color: "white",
                  fontSize: 15,
                  outline: "none",
                  backdropFilter: "blur(2px)",
                }}
              >
                {TALEN_OPTIES.map((t) => (
                  <option key={t} value={t} style={{ color: "#111" }}>
                    {TAAL_CODES[t]} — {t === "nl" ? "Nederlands" : t === "fr" ? "Français" : t === "en" ? "English" : t === "es" ? "Español" : "Русский"}
                  </option>
                ))}
              </select>

              {/* Foutmelding */}
              {loginMutatie.isError && (
                <p
                  data-testid="text-fout"
                  style={{ marginTop: 12, fontSize: 13, color: "#ffb4a8" }}
                >
                  {vo(T.fout, taal)}
                </p>
              )}

              {/* Submit-knop */}
              <button
                type="submit"
                disabled={loginMutatie.isPending}
                data-testid="button-draai"
                style={{
                  marginTop: 22,
                  width: "100%",
                  padding: "13px 16px",
                  borderRadius: 11,
                  border: "none",
                  cursor: loginMutatie.isPending ? "default" : "pointer",
                  background: skin.accent,
                  color: "#111626",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  opacity: loginMutatie.isPending ? 0.75 : 1,
                  boxShadow: `0 0 22px ${skin.accentZacht}`,
                  transition: "opacity 0.2s ease",
                }}
              >
                {loginMutatie.isPending ? vo(T.bezig, taal) : vo(T.draai, taal)}
              </button>
            </form>
          </motion.div>
        )}

        {fase === "ademhaling" && (
          <Ademhaling
            key="ademhaling"
            skin={skin}
            taal={taal}
            onKlaar={naarDashboard}
          />
        )}

        {fase === "overgang" && (
          <motion.div
            key="overgang"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{ position: "relative", zIndex: 1, textAlign: "center" }}
            data-testid="poort-overgang"
          >
            <p
              style={{
                fontSize: 18,
                color: skin.accent,
                letterSpacing: "0.02em",
              }}
            >
              {vo(T.binnen, taal)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
