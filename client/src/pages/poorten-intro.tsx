/**
 * PoortenIntro — TaPas demo opening experience
 *
 * Visuele flow:
 *  0.0s  Zwart scherm, instructietekst "Duw de poorten open" zichtbaar
 *  0.5s  Klik/tik → poorten beginnen te openen (scharnier links/rechts)
 *  1.5s  Poorten volledig open → mistige nevel vult het scherm
 *  2.8s  "TaPas" condenseert uit de mist (fade + blur-in)
 *  4.2s  "TaPas" lost zacht op, nevel trekt weg
 *  5.0s  Callback onComplete() → homepage wordt zichtbaar
 *
 * Escape / klik na start → overslaan
 * Reduced-motion → rustige fade-variant (geen rotate)
 * Geen localStorage — elke bezoeker ziet het altijd
 */

import { useEffect, useRef, useState, useCallback } from "react";

interface PoortenIntroProps {
  onComplete: () => void;
}

// ─── Web Audio: kriekelend houten poortgeluid ────────────────────────────────
function playPoortenSound(): () => void {
  let ctx: AudioContext | null = null;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return () => {};
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.18, now + 0.3);
  master.gain.linearRampToValueAtTime(0.12, now + 2.5);
  master.gain.linearRampToValueAtTime(0, now + 4.5);
  master.connect(ctx.destination);

  // Laag gekreun van de scharnieren — lage oscillator met freq-sweep
  function addCreak(freq: number, detune: number, startDelay: number) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now + startDelay);
    osc.frequency.linearRampToValueAtTime(freq * 1.8, now + startDelay + 1.8);
    osc.frequency.linearRampToValueAtTime(freq * 0.9, now + startDelay + 3.5);
    osc.detune.setValueAtTime(detune, now + startDelay);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, now + startDelay);
    filter.frequency.linearRampToValueAtTime(320, now + startDelay + 2.0);
    filter.Q.setValueAtTime(4, now + startDelay);

    gain.gain.setValueAtTime(0, now + startDelay);
    gain.gain.linearRampToValueAtTime(0.6, now + startDelay + 0.25);
    gain.gain.linearRampToValueAtTime(0.35, now + startDelay + 2.0);
    gain.gain.linearRampToValueAtTime(0, now + startDelay + 4.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now + startDelay);
    osc.stop(now + startDelay + 4.2);
  }

  // Warme resonantie onder het gekreun
  function addResonance() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(55, now + 0.2);
    osc.frequency.linearRampToValueAtTime(80, now + 2.5);

    gain.gain.setValueAtTime(0, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.8);
    gain.gain.linearRampToValueAtTime(0.25, now + 2.5);
    gain.gain.linearRampToValueAtTime(0, now + 4.5);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now + 0.2);
    osc.stop(now + 4.8);
  }

  // Zachte hoge kriebel voor textuur
  function addTexture() {
    if (!ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015;
    }
    const source = ctx.createBufferSource();
    source.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.5, now + 1.0);
    gain.gain.linearRampToValueAtTime(0.2, now + 3.0);
    gain.gain.linearRampToValueAtTime(0, now + 4.0);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now + 0.5);
  }

  addCreak(90, 0, 0.4);
  addCreak(110, -15, 0.55);
  addResonance();
  addTexture();

  return () => {
    try {
      ctx?.close();
    } catch {}
  };
}

// ─── Animatiefases ───────────────────────────────────────────────────────────
type Phase =
  | "idle"       // wacht op klik
  | "opening"    // poorten draaien open
  | "mist"       // nevel vult scherm
  | "tapas"      // "TaPas" condenseert
  | "dissolve"   // "TaPas" lost op
  | "done";      // fade-out volledig

export default function PoortenIntro({ onComplete }: PoortenIntroProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tapasOpacity, setTapasOpacity] = useState(0);
  const [tapasBlur, setTapasBlur] = useState(18);
  const [mistOpacity, setMistOpacity] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [leftDeg, setLeftDeg] = useState(0);
  const [rightDeg, setRightDeg] = useState(0);
  const completedRef = useRef(false);
  const stopAudioRef = useRef<(() => void) | null>(null);
  // Cooldown: accepteer geen clicks in de eerste 400ms na mount
  // zodat een navigatie-klik die de pagina laadde niet meteen de animatie start én skip
  const readyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { readyRef.current = true; }, 400);
    return () => clearTimeout(t);
  }, []);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopAudioRef.current?.();
    setOverlayOpacity(0);
    setTimeout(() => onComplete(), 600);
  }, [onComplete]);

  // Veiligheidsgrens: nooit langer dan 7s hangen
  useEffect(() => {
    const safety = setTimeout(finish, 7000);
    return () => clearTimeout(safety);
  }, [finish]);

  // Escape → overslaan
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [finish]);

  // Animatievolgorde starten na klik
  const startAnimation = useCallback(() => {
    if (phase !== "idle") return;

    // Start audio
    stopAudioRef.current = playPoortenSound();

    if (prefersReducedMotion) {
      // Reduced-motion: gewoon rustige fade
      setPhase("mist");
      setMistOpacity(1);
      setTimeout(() => {
        setTapasOpacity(1);
        setTapasBlur(0);
        setPhase("tapas");
      }, 800);
      setTimeout(() => {
        setTapasOpacity(0);
        setPhase("dissolve");
      }, 2600);
      setTimeout(finish, 3400);
      return;
    }

    // Normale animatie
    setPhase("opening");

    // Poorten openen: 0 → -110deg (links) en 0 → 110deg (rechts)
    // CSS transition doet het werk, we triggeren via state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLeftDeg(-108);
        setRightDeg(108);
      });
    });

    // Na 1.4s: nevel
    setTimeout(() => {
      setPhase("mist");
      setMistOpacity(1);
    }, 1400);

    // Na 2.7s: TaPas condenseert
    setTimeout(() => {
      setPhase("tapas");
      setTapasOpacity(1);
      setTapasBlur(0);
    }, 2700);

    // Na 4.1s: TaPas lost op
    setTimeout(() => {
      setPhase("dissolve");
      setTapasOpacity(0);
      setMistOpacity(0);
    }, 4100);

    // Na 5.0s: done
    setTimeout(finish, 5000);
  }, [phase, prefersReducedMotion, finish]);

  // Klik na start → skip
  const handleClick = useCallback(() => {
    if (!readyRef.current) return; // negeer clicks direct na mount
    if (phase === "idle") {
      startAnimation();
    } else {
      finish();
    }
  }, [phase, startAnimation, finish]);

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: phase === "idle" ? "pointer" : "default",
        opacity: overlayOpacity,
        transition: "opacity 0.6s ease",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Achtergrond: diepe nacht — volledig dekkend, blokkeert alles eronder */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#050a0f",
          zIndex: 0,
        }}
      />

      {/* Mistige nevel — koel blauwgrijs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 55%, hsla(210,30%,68%,0.55) 0%, hsla(210,25%,40%,0.3) 45%, transparent 75%)",
          opacity: mistOpacity,
          transition: "opacity 1.2s ease",
          pointerEvents: "none",
        }}
      />

      {/* Twee poorten — links en rechts, scharnieren aan de buitenranden */}
      {!prefersReducedMotion && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            display: "flex",
            pointerEvents: "none",
          }}
        >
          {/* Linker poort — scharnier links */}
          <div
            style={{
              flex: 1,
              transformOrigin: "left center",
              transform: `perspective(900px) rotateY(${leftDeg}deg)`,
              transition: "transform 1.6s cubic-bezier(0.25, 0.1, 0.1, 1.0)",
              background:
                "linear-gradient(to right, #0e0904 0%, #231608 30%, #2e1f0a 55%, #1a1008 80%, #0e0904 100%)",
              boxShadow: "inset -8px 0 32px rgba(0,0,0,0.9), -4px 0 20px rgba(0,0,0,0.8)",
              position: "relative",
              overflow: "hidden",
              backfaceVisibility: "hidden",
            }}
          >
            {/* Houtnerf textuur */}
            <WoodGrain side="left" />
            {/* Scharnier — boven */}
            <Hinge position="top" />
            {/* Scharnier — onder */}
            <Hinge position="bottom" />
            {/* Handgreep */}
            <Handle side="left" />
          </div>

          {/* Rechter poort — scharnier rechts */}
          <div
            style={{
              flex: 1,
              transformOrigin: "right center",
              transform: `perspective(900px) rotateY(${rightDeg}deg)`,
              transition: "transform 1.6s cubic-bezier(0.25, 0.1, 0.1, 1.0)",
              background:
                "linear-gradient(to left, #0e0904 0%, #231608 30%, #2e1f0a 55%, #1a1008 80%, #0e0904 100%)",
              boxShadow: "inset 8px 0 32px rgba(0,0,0,0.9), 4px 0 20px rgba(0,0,0,0.8)",
              position: "relative",
              overflow: "hidden",
              backfaceVisibility: "hidden",
            }}
          >
            <WoodGrain side="right" />
            <Hinge position="top" />
            <Hinge position="bottom" />
            <Handle side="right" />
          </div>
        </div>
      )}

      {/* Instrucietekst — alleen in idle fase */}
      {phase === "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            pointerEvents: "none",
          }}
        >
          {/* Lichtstreep in het midden van de poorten */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              transform: "translateX(-50%)",
              background:
                "linear-gradient(to bottom, transparent 0%, hsla(38,60%,68%,0.0) 10%, hsla(38,60%,68%,0.7) 40%, hsla(38,60%,68%,0.9) 50%, hsla(38,60%,68%,0.7) 60%, hsla(38,60%,68%,0.0) 90%, transparent 100%)",
              boxShadow: "0 0 18px 6px hsla(38,60%,68%,0.35)",
              pointerEvents: "none",
            }}
          />

          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(1.1rem, 3vw, 1.6rem)",
              color: "hsl(38, 60%, 72%)",
              textShadow:
                "0 0 20px hsla(38,60%,68%,0.6), 0 0 40px hsla(38,60%,68%,0.3)",
              letterSpacing: "0.04em",
              margin: 0,
              animation: "poortenPulse 2.8s ease-in-out infinite",
            }}
          >
            Duw de poorten open
          </p>

          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(0.7rem, 1.8vw, 0.9rem)",
              color: "hsla(38, 40%, 60%, 0.55)",
              margin: 0,
              letterSpacing: "0.06em",
            }}
          >
            klik of tik · esc om over te slaan
          </p>
        </div>
      )}

      {/* "TaPas" tekst uit de mist */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(4rem, 14vw, 11rem)",
            color: "hsl(38, 60%, 78%)",
            textShadow:
              "0 0 40px hsla(38,60%,68%,0.8), 0 0 80px hsla(38,60%,68%,0.4), 0 0 120px hsla(38,50%,50%,0.2)",
            letterSpacing: "0.08em",
            opacity: tapasOpacity,
            filter: `blur(${tapasBlur}px)`,
            transition:
              "opacity 1.1s ease, filter 1.1s ease",
            userSelect: "none",
          }}
        >
          TaPas
        </span>
      </div>

      {/* CSS animaties */}
      <style>{`
        @keyframes poortenPulse {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-componenten ─────────────────────────────────────────────────────────

function WoodGrain({ side }: { side: "left" | "right" }) {
  // SVG houtnerf patroon als data-URI
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.08,
        mixBlendMode: "overlay",
      }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <filter id={`grain-${side}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency={side === "left" ? "0.65 0.015" : "0.65 0.012"}
          numOctaves="4"
          seed={side === "left" ? 2 : 7}
          result="noise"
        />
        <feColorMatrix type="saturate" values="0" in="noise" />
      </filter>
      <rect
        width="100%"
        height="100%"
        filter={`url(#grain-${side})`}
        fill="hsl(30,40%,60%)"
      />
    </svg>
  );
}

function Hinge({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        ...(position === "top" ? { top: "10%" } : { bottom: "10%" }),
        width: 18,
        height: 52,
        background:
          "linear-gradient(to right, #8a6a2a 0%, #c9a84c 40%, #a07830 70%, #6a4e18 100%)",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,200,80,0.3)",
      }}
    />
  );
}

function Handle({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        ...(isLeft ? { right: "12%" } : { left: "12%" }),
        width: 12,
        height: 48,
        borderRadius: 6,
        background:
          "linear-gradient(to bottom, #b8922e 0%, #dbb84a 30%, #c9a030 65%, #8a6a1e 100%)",
        boxShadow:
          "0 3px 12px rgba(0,0,0,0.7), inset 0 1px 3px rgba(255,220,100,0.4)",
      }}
    />
  );
}
