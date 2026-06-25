/**
 * PoortenIntro — exact gereconstrueerd vanuit de originele gecompileerde bundle
 * (tapas-zip/assets/index-BGJqNXPf.js, functie `fie`)
 *
 * Originele timing (Ko):
 *   kier: 1500ms, openen: 2400ms, poortVol: 6200ms
 *   mist: 3000ms, condens: 5200ms, woordVol: 8200ms
 *   oplossen: 10200ms, einde: 11600ms
 *
 * Audio: /poort/poort-open.mp3 + synthetische drone
 * Canvas: 2× canvas — mist/nevel + particle "TaPas"
 * Poorten: CSS 3D rotateY via perspective 1700px
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PoortenIntroProps {
  onComplete: () => void;
}

// ─── Timing constanten (exact uit origineel) ─────────────────────────────────
const Ko = {
  kier: 1500,
  openen: 2400,
  poortVol: 6200,
  mist: 3000,
  condens: 5200,
  woordVol: 8200,
  oplossen: 10200,
  einde: 11600,
};

// ─── Easing functies (exact uit origineel) ───────────────────────────────────
function easeInOutCubic(e: number) {
  return e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
}
function easeOutCubic(e: number) {
  return 1 - Math.pow(1 - e, 3);
}
function easeInOutQuad(e: number) {
  return e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
}
function clamp01(e: number) {
  return e < 0 ? 0 : e > 1 ? 1 : e;
}

// ─── Houtnerf achtergrond (exact uit origineel lL functie) ───────────────────
function houtNerf(kant: "links" | "rechts"): string {
  return [
    `linear-gradient(${kant === "links" ? "90deg" : "270deg"}, #14110d 0%, #0e0c09 60%, #080705 100%)`,
    "repeating-linear-gradient(90deg, rgba(255,235,200,0.018) 0px, rgba(255,235,200,0.018) 1px, transparent 1px, transparent 58px)",
    "repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, transparent 1px, transparent 7px)",
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 2px, transparent 2px, transparent 220px)",
  ].join(", ");
}

// ─── Scharnieren en nagels (exact uit origineel cL functie) ──────────────────
function PoortDetails({ kant }: { kant: "links" | "rechts" }) {
  const nagels: React.ReactNode[] = [];
  const xPosities = [0.18, 0.82];
  const yPosities = [0.12, 0.34, 0.56, 0.78, 0.95];
  for (const y of yPosities) {
    for (const x of xPosities) {
      nagels.push(
        <span
          key={`${kant}-${x}-${y}`}
          style={{
            position: "absolute",
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: 9,
            height: 9,
            marginLeft: -4.5,
            marginTop: -4.5,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, #57534a 0%, #2b2823 55%, #100f0c 100%)",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.8), inset 0 0 1px rgba(255,235,200,0.2)",
          }}
        />
      );
    }
  }
  const banden = [0.26, 0.7].map((y) => (
    <div
      key={`${kant}-band-${y}`}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: `${y * 100}%`,
        height: 18,
        marginTop: -9,
        background:
          "linear-gradient(180deg, #2a2722 0%, #16140f 50%, #0c0a07 100%)",
        boxShadow:
          "0 2px 5px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,235,200,0.08)",
      }}
    />
  ));
  return (
    <>
      {banden}
      {nagels}
    </>
  );
}

// ─── Audio setup (exact uit origineel) ───────────────────────────────────────
interface AudioHandles {
  ctx: AudioContext;
  droneGain: GainNode;
  drone: OscillatorNode;
  poortGain: GainNode;
}

export default function PoortenIntro({ onComplete }: PoortenIntroProps) {
  const canvasMistRef = useRef<HTMLCanvasElement>(null);
  const canvasTekstRef = useRef<HTMLCanvasElement>(null);
  const [weggaand, setWeggaand] = useState(false);
  const [wachtOpKlik, setWachtOpKlik] = useState(false);
  const [geluidAan, setGeluidAan] = useState(true);

  const afgeslotenRef = useRef(false);
  const audioRef = useRef<AudioHandles | null>(null);
  const mp3BufferRef = useRef<ArrayBuffer | null>(null);
  const mp3GespeeldRef = useRef(false);
  const animatieGestartRef = useRef(false);
  const startTijdRef = useRef(0);
  const vorigeFrameRef = useRef(0);
  const rafRef = useRef(0);
  const mp3SourceLoadedRef = useRef<AudioBuffer | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Animatiestatus — identiek aan origineel g state
  const [staat, setStaat] = useState({ open: 0, kier: 0, mist: 0, weg: 0 });

  // MP3 prefetchen
  useEffect(() => {
    let cancelled = false;
    fetch("/poort/poort-open.mp3")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!cancelled) mp3BufferRef.current = buf;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape / spatie / enter
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        sluitAf();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        behandelKlik();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Audio initialiseren
  function initAudio() {
    if (audioRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      droneGain.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 2.6);
      droneGain.connect(ctx.destination);

      const drone = ctx.createOscillator();
      drone.type = "sine";
      drone.frequency.setValueAtTime(73, ctx.currentTime);
      const drone2 = ctx.createOscillator();
      drone2.type = "sine";
      drone2.frequency.setValueAtTime(110, ctx.currentTime);
      const drone2Gain = ctx.createGain();
      drone2Gain.gain.setValueAtTime(0.35, ctx.currentTime);
      drone.connect(droneGain);
      drone2.connect(drone2Gain);
      drone2Gain.connect(droneGain);
      drone.start();
      drone2.start();

      const poortGain = ctx.createGain();
      poortGain.gain.setValueAtTime(0.9, ctx.currentTime);
      poortGain.connect(ctx.destination);

      audioRef.current = { ctx, droneGain, drone, poortGain };
      mp3GespeeldRef.current = false;

      // Decode MP3 buffer als al geladen
      const decodeer = (buf: ArrayBuffer) => {
        ctx
          .decodeAudioData(buf.slice(0))
          .then((decoded) => {
            mp3SourceLoadedRef.current = decoded;
          })
          .catch(() => {});
      };
      if (mp3BufferRef.current) {
        decodeer(mp3BufferRef.current);
      } else {
        fetch("/poort/poort-open.mp3")
          .then((r) => r.arrayBuffer())
          .then((buf) => {
            mp3BufferRef.current = buf;
            decodeer(buf);
          })
          .catch(() => {});
      }
    } catch {}
  }

  // MP3 afspelen op het juiste moment
  function speelMp3() {
    const audio = audioRef.current;
    if (!audio || mp3GespeeldRef.current) return;
    const decoded = mp3SourceLoadedRef.current;
    if (decoded) {
      if (audio.ctx.state !== "running") {
        audio.ctx.resume().catch(() => {});
        return;
      }
      mp3GespeeldRef.current = true;
      try {
        const src = audio.ctx.createBufferSource();
        src.buffer = decoded;
        src.connect(audio.poortGain);
        src.start();
      } catch {}
    }
  }

  // Sluit de intro af en roep onComplete aan
  function sluitAf() {
    if (afgeslotenRef.current) return;
    afgeslotenRef.current = true;
    setWeggaand(true);
    const audio = audioRef.current;
    if (audio) {
      try {
        const t = audio.ctx.currentTime;
        audio.droneGain.gain.cancelScheduledValues(t);
        audio.droneGain.gain.setValueAtTime(audio.droneGain.gain.value, t);
        audio.droneGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        audio.poortGain.gain.cancelScheduledValues(t);
        audio.poortGain.gain.setValueAtTime(audio.poortGain.gain.value, t);
        audio.poortGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        audio.drone.stop(t + 0.7);
        setTimeout(() => audio.ctx.close().catch(() => {}), 800);
      } catch {}
    }
    window.setTimeout(onComplete, 750);
  }

  // Klik handler
  function behandelKlik() {
    if (!animatieGestartRef.current) {
      // Klik 1: start animatie + audio
      if (geluidAan && !afgeslotenRef.current) {
        if (audioRef.current) {
          audioRef.current.ctx.resume().catch(() => {});
        } else {
          initAudio();
        }
      }
      setWachtOpKlik(false);
      animatieGestartRef.current = true;
      return;
    }
    sluitAf();
  }

  // Geluid toggle
  function toggleGeluid() {
    const nieuw = !geluidAan;
    setGeluidAan(nieuw);
    if (nieuw) {
      initAudio();
    } else {
      const audio = audioRef.current;
      if (audio) {
        try {
          const t = audio.ctx.currentTime;
          audio.droneGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
          audio.poortGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
          audio.drone.stop(t + 0.5);
          setTimeout(() => audio.ctx.close().catch(() => {}), 600);
        } catch {}
        audioRef.current = null;
      }
    }
  }

  // Pointer/touch → audio starten bij eerste interactie
  useEffect(() => {
    let used = false;
    function handler() {
      if (used) return;
      if (geluidAan && !afgeslotenRef.current) {
        if (audioRef.current) {
          audioRef.current.ctx.resume().catch(() => {});
        } else {
          initAudio();
        }
      }
      used = true;
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    }
    if (geluidAan && !audioRef.current) initAudio();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      used = true;
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [geluidAan]);

  // ─── Canvas animatielus ────────────────────────────────────────────────────
  useEffect(() => {
    let geannuleerd = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let breedte = window.innerWidth;
    let hoogte = window.innerHeight;
    let lettertypeGrootte = 140;

    const canvasMist = canvasMistRef.current;
    const canvasTekst = canvasTekstRef.current;
    const ctxMist = canvasMist ? canvasMist.getContext("2d") : null;
    const ctxTekst = canvasTekst ? canvasTekst.getContext("2d") : null;

    // Drijvende mistbollen
    const mistBollen: {
      x: number;
      y: number;
      r: number;
      vx: number;
      faze: number;
      warm: number;
    }[] = [];

    // Particle posities voor "TaPas"
    const deeltjes: {
      x: number;
      y: number;
      dx: number;
      dy: number;
      basisX: number;
      basisY: number;
      driftFaze: number;
      driftAmp: number;
      driftSnel: number;
      r: number;
      helder: number;
      tint: number;
    }[] = [];

    function herstelAfmeting() {
      breedte = window.innerWidth;
      hoogte = window.innerHeight;
      for (const cv of [canvasMist, canvasTekst]) {
        if (!cv) continue;
        cv.width = Math.floor(breedte * dpr);
        cv.height = Math.floor(hoogte * dpr);
        cv.style.width = breedte + "px";
        cv.style.height = hoogte + "px";
      }
      ctxMist?.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxTekst?.setTransform(dpr, 0, 0, dpr, 0, 0);
      mistBollen.length = 0;
      const aantalBollen = breedte < 520 ? 7 : 11;
      for (let i = 0; i < aantalBollen; i++) {
        mistBollen.push({
          x: Math.random() * breedte,
          y: hoogte * 0.32 + Math.random() * hoogte * 0.5,
          r: Math.min(breedte, hoogte) * (0.16 + Math.random() * 0.22),
          vx: (Math.random() - 0.5) * 5,
          faze: Math.random() * Math.PI * 2,
          warm: Math.random(),
        });
      }
      berekenDeeltjes();
    }

    function berekenDeeltjes() {
      const tijdelijkCanvas = document.createElement("canvas");
      const tijdelijkCtx = tijdelijkCanvas.getContext("2d");
      if (!tijdelijkCtx) return;

      const maxBreedte = Math.min(breedte * 0.62, 760);
      lettertypeGrootte = Math.max(64, Math.min(maxBreedte / 3, 200));
      const fs = lettertypeGrootte;

      tijdelijkCanvas.width = breedte;
      tijdelijkCanvas.height = hoogte;
      tijdelijkCtx.clearRect(0, 0, breedte, hoogte);
      tijdelijkCtx.fillStyle = "#fff";
      tijdelijkCtx.textAlign = "center";
      tijdelijkCtx.textBaseline = "middle";
      tijdelijkCtx.font = `600 ${fs}px "Playfair Display", Georgia, serif`;
      tijdelijkCtx.fillText("TaPas", breedte / 2, hoogte * 0.5);

      const pixelData = tijdelijkCtx.getImageData(0, 0, breedte, hoogte).data;
      const stap = breedte < 520 ? 6 : 5;
      const doelPunten: { x: number; y: number }[] = [];

      for (let y = 0; y < hoogte; y += stap) {
        for (let x = 0; x < breedte; x += stap) {
          const idx = (y * breedte + x) * 4;
          if (pixelData[idx + 3] > 128) {
            doelPunten.push({
              x: x + (Math.random() - 0.5) * stap,
              y: y + (Math.random() - 0.5) * stap,
            });
          }
        }
      }

      deeltjes.length = 0;
      const midX = breedte / 2;
      const midY = hoogte * 0.5;
      for (const punt of doelPunten) {
        const hoek = Math.random() * Math.PI * 2;
        const afstand =
          Math.min(breedte, hoogte) * (0.12 + Math.random() * 0.34);
        const startX = midX + Math.cos(hoek) * afstand;
        const startY = midY + Math.sin(hoek) * afstand * 0.7;
        deeltjes.push({
          x: startX,
          y: startY,
          dx: punt.x,
          dy: punt.y,
          basisX: startX,
          basisY: startY,
          driftFaze: Math.random() * Math.PI * 2,
          driftAmp: 14 + Math.random() * 26,
          driftSnel: 0.4 + Math.random() * 0.7,
          r: 0.8 + Math.random() * 1.5,
          helder: 0.5 + Math.random() * 0.5,
          tint: Math.random(),
        });
      }
    }

    // Lettertype laden → dan pas deeltjes berekenen (font moet klaar zijn voor pixel-sampling)
    const fontPromise = typeof document !== "undefined" && document.fonts
      ? Promise.all([
          document.fonts.load('600 140px "Playfair Display"').catch(() => {}),
          document.fonts.load('600 120px "Playfair Display"').catch(() => {}),
          document.fonts.ready.catch(() => {}),
        ])
      : Promise.resolve();

    fontPromise.then(() => {
      herstelAfmeting();
    });

    // Fallback: als font na 600ms nog niet klaar is, laad toch
    const fontTimeout = setTimeout(() => {
      if (deeltjes.length === 0) herstelAfmeting();
    }, 600);

    window.addEventListener("resize", herstelAfmeting);
    // fontTimeout cleanup happens in return() below

    let eersteFrame = 0;
    let feedbackTimer = 0;

    function frame(tijdstip: number) {
      if (geannuleerd) return;

      // Wacht op audio voordat animatie start
      if (!animatieGestartRef.current) {
        if (!eersteFrame) eersteFrame = tijdstip;
        const verstreken = tijdstip - eersteFrame;
        const audioActief =
          !!audioRef.current &&
          audioRef.current.ctx.state === "running" &&
          !!mp3SourceLoadedRef.current;

        // Wacht altijd op klik — nooit automatisch starten
        const geenAudioCtx =
          !audioRef.current || audioRef.current.ctx.state !== "running";
        setWachtOpKlik(geenAudioCtx && verstreken > 700);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // Eerste frame na klik: starttijd initialiseren
      if (!startTijdRef.current) {
        startTijdRef.current = tijdstip;
        vorigeFrameRef.current = tijdstip;
      }

      let verstreken = tijdstip - startTijdRef.current;
      const dt = Math.min(0.05, (tijdstip - vorigeFrameRef.current) / 1000);
      vorigeFrameRef.current = tijdstip;

      // Bereken animatiewaarden (exact uit origineel)
      const kier = clamp01((verstreken - Ko.kier) / 700);
      const open = easeInOutQuad(
        clamp01((verstreken - Ko.openen) / (Ko.poortVol - Ko.openen))
      );
      const mist = easeOutCubic(clamp01((verstreken - Ko.mist) / 1800));
      const woord = easeInOutCubic(
        clamp01((verstreken - Ko.condens) / (Ko.woordVol - Ko.condens))
      );
      const weg = easeInOutCubic(
        clamp01((verstreken - Ko.oplossen) / (Ko.einde - Ko.oplossen))
      );

      setStaat({ open, kier, mist, weg });

      // MP3 starten bij poortopening
      if (geluidAan && verstreken >= Ko.kier) speelMp3();

      // Einde: afsluiten
      if (verstreken >= Ko.einde) {
        if (!afgeslotenRef.current) sluitAf();
        return;
      }

      // ── Mist-canvas ──────────────────────────────────────────────────────
      const mistBreedte = breedte * 0.5 * Math.max(open, kier * 0.06) + 24;
      const midX = breedte / 2;
      const mistAlpha = clamp01(mist) * (1 - weg);

      if (ctxMist) {
        ctxMist.clearRect(0, 0, breedte, hoogte);
        if (mistAlpha > 0.005) {
          ctxMist.save();
          ctxMist.beginPath();
          ctxMist.rect(midX - mistBreedte, 0, mistBreedte * 2, hoogte);
          ctxMist.clip();

          const grad = ctxMist.createRadialGradient(
            midX,
            hoogte * 0.52,
            0,
            midX,
            hoogte * 0.52,
            Math.max(breedte, hoogte) * 0.6
          );
          grad.addColorStop(0, `rgba(228, 206, 170, ${0.5 * mistAlpha})`);
          grad.addColorStop(
            0.22,
            `rgba(150, 152, 168, ${0.42 * mistAlpha})`
          );
          grad.addColorStop(
            0.55,
            `rgba(78, 86, 104, ${0.5 * mistAlpha})`
          );
          grad.addColorStop(1, `rgba(20, 24, 34, ${0.2 * mistAlpha})`);
          ctxMist.fillStyle = grad;
          ctxMist.fillRect(midX - mistBreedte, 0, mistBreedte * 2, hoogte);

          ctxMist.globalCompositeOperation = "screen";
          for (const bol of mistBollen) {
            bol.x += bol.vx * dt;
            bol.faze += dt * 0.15;
            if (bol.x < -bol.r) bol.x = breedte + bol.r;
            if (bol.x > breedte + bol.r) bol.x = -bol.r;
            const bolY = bol.y + Math.sin(bol.faze) * 14;
            const bolGrad = ctxMist.createRadialGradient(
              bol.x,
              bolY,
              0,
              bol.x,
              bolY,
              bol.r
            );
            const w = bol.warm;
            const r = Math.round(120 + w * 110);
            const g = Math.round(130 + w * 70);
            const b = Math.round(150 - w * 40);
            bolGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.16 * mistAlpha})`);
            bolGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.07 * mistAlpha})`);
            bolGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctxMist.fillStyle = bolGrad;
            ctxMist.beginPath();
            ctxMist.arc(bol.x, bolY, bol.r, 0, Math.PI * 2);
            ctxMist.fill();
          }
          ctxMist.restore();
        }
      }

      // ── Tekst-canvas (particle "TaPas" + fillText glow) — exact uit origineel ──
      if (ctxTekst) {
        ctxTekst.clearRect(0, 0, breedte, hoogte);
        const tekstAlpha = clamp01(mist) * (1 - weg);
        if (tekstAlpha > 0.005 && deeltjes.length > 0) {
          // condensFactor: 0→1 over volledige woord-range (exact origineel: ht = woord)
          const condensFactor = easeInOutCubic(
            clamp01((woord - 0.55) / 0.45)
          );

          // ── fillText met shadowBlur glow — origineel: altijd tekenen als condensFactor > 0.01
          if (condensFactor > 0.01) {
            const fs = lettertypeGrootte;
            ctxTekst.globalCompositeOperation = "lighter";
            ctxTekst.textAlign = "center";
            ctxTekst.textBaseline = "middle";
            ctxTekst.font = `600 ${fs}px "Playfair Display", Georgia, serif`;
            // glow shadow (exact origineel)
            ctxTekst.shadowColor = "rgba(247, 222, 176, 0.85)";
            ctxTekst.shadowBlur = 26 * condensFactor;
            const tekstVulAlpha = tekstAlpha * condensFactor * 0.82;
            ctxTekst.fillStyle = `rgba(236, 214, 176, ${tekstVulAlpha})`;
            ctxTekst.fillText("TaPas", breedte / 2, hoogte * 0.5);
            ctxTekst.shadowBlur = 0;
          }

          // ── Particles — exact origineel: positie via woord direct (xt = woord)
          ctxTekst.globalCompositeOperation = "lighter";
          const tijdSec = (verstreken) / 1000;
          for (const d of deeltjes) {
            // drift vanuit basisX/Y (origineel: yn = cos(driftFaze + t*driftSnel)*driftAmp)
            const driftX = Math.cos(d.driftFaze + tijdSec * d.driftSnel) * d.driftAmp;
            const driftY = Math.sin(d.driftFaze * 1.3 + tijdSec * d.driftSnel * 0.8) * d.driftAmp * 0.7;
            const huidigBaseX = d.basisX + driftX;
            const huidigBaseY = d.basisY + driftY;
            // lerp naar doel via woord (xt = woord direct)
            d.x = huidigBaseX + (d.dx - huidigBaseX) * woord;
            d.y = huidigBaseY + (d.dy - huidigBaseY) * woord;

            const alpha = tekstAlpha * d.helder * (0.34 + 0.66 * woord);
            if (alpha < 0.012) continue;

            // kleur (exact origineel: Dn, Tn, Fn, hr)
            const Dn = clamp01(woord * 1.1) * (0.55 + 0.45 * d.tint);
            const Tn = Math.round(196 + Dn * 40);
            const Fn = Math.round(186 + Dn * 24);
            const hr = Math.round(168 - Dn * 36);
            // radius schaal (origineel: 1.8 - 0.8*xt)
            const straal = d.r * (1.8 - 0.8 * woord);

            ctxTekst.beginPath();
            ctxTekst.fillStyle = `rgba(${Tn}, ${Fn}, ${hr}, ${alpha})`;
            ctxTekst.arc(d.x, d.y, straal, 0, Math.PI * 2);
            ctxTekst.fill();
          }
          ctxTekst.globalCompositeOperation = "source-over";
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      geannuleerd = true;
      cancelAnimationFrame(rafRef.current);
      clearTimeout(fontTimeout);
      window.removeEventListener("resize", herstelAfmeting);
    };
  }, [geluidAan]);

  // Berekende CSS waarden
  const openGraden = staat.open * 96;
  const wegAlpha = staat.weg;
  const kierAlpha = clamp01(staat.kier * (1 - staat.weg));

  return createPortal(
    <div
      onClick={behandelKlik}
      role="dialog"
      aria-label="TaPas-intro"
      className={`overflow-hidden transition-opacity duration-700 ${
        weggaand ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "#08090c",
      }}
    >
      <style>{`@keyframes tapasHintPuls { 0%,100% { opacity: 0.35 } 50% { opacity: 0.85 } }`}</style>

      {/* Mist canvas */}
      <canvas
        ref={canvasMistRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          opacity: 1 - wegAlpha * 0.4,
        }}
      />

      {/* Tekst/particle canvas */}
      <canvas
        ref={canvasTekstRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          opacity: 1 - wegAlpha,
        }}
      />

      {/* Twee poorten */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          perspective: "1700px",
          perspectiveOrigin: "50% 50%",
          pointerEvents: "none",
          opacity: 1 - wegAlpha,
          transition: "opacity 200ms linear",
        }}
      >
        {/* Linker poort */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "50%",
            transformStyle: "preserve-3d",
            transformOrigin: "left center",
            transform: `rotateY(${openGraden}deg)`,
            transition: "transform 60ms linear",
            backgroundColor: "#0b0a09",
            backgroundImage: houtNerf("links"),
            boxShadow:
              "inset -2px 0 0 rgba(243,205,138,0.10), inset -22px 0 60px rgba(0,0,0,0.65), 6px 0 40px rgba(0,0,0,0.6)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
          }}
        >
          <PoortDetails kant="links" />
          {/* Lichtstreep in de kier */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 3,
              opacity: kierAlpha,
              background:
                "linear-gradient(180deg, rgba(247,222,176,0) 0%, rgba(247,222,176,0.8) 50%, rgba(247,222,176,0) 100%)",
              boxShadow: "0 0 22px 3px rgba(247,222,176,0.55)",
              transition: "opacity 140ms linear",
            }}
          />
        </div>

        {/* Rechter poort */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "50%",
            transformStyle: "preserve-3d",
            transformOrigin: "right center",
            transform: `rotateY(${-openGraden}deg)`,
            transition: "transform 60ms linear",
            backgroundColor: "#0b0a09",
            backgroundImage: houtNerf("rechts"),
            boxShadow:
              "inset 2px 0 0 rgba(243,205,138,0.10), inset 22px 0 60px rgba(0,0,0,0.65), -6px 0 40px rgba(0,0,0,0.6)",
            borderLeft: "1px solid rgba(0,0,0,0.6)",
          }}
        >
          <PoortDetails kant="rechts" />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 3,
              opacity: kierAlpha,
              background:
                "linear-gradient(180deg, rgba(247,222,176,0) 0%, rgba(247,222,176,0.8) 50%, rgba(247,222,176,0) 100%)",
              boxShadow: "0 0 22px 3px rgba(247,222,176,0.55)",
              transition: "opacity 140ms linear",
            }}
          />
        </div>
      </div>

      {/* Rand-vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Geluid knop */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleGeluid();
        }}
        aria-label={geluidAan ? "Geluid uitzetten" : "Geluid aanzetten"}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white/90"
      >
        {geluidAan ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 6a9 9 0 0 1 0 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        )}
      </button>

      {/* Overslaan knop */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sluitAf();
        }}
        className="absolute bottom-5 right-5 z-10 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-white/55 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white/85"
      >
        Overslaan
      </button>

      {/* Hint — twee toestanden: voor animatie / na woord zichtbaar */}
      {!weggaand && staat.open === 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10 flex justify-center"
          style={{ animation: "tapasHintPuls 2.4s ease-in-out infinite" }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: "1.35rem",
              color: "hsl(38 60% 62%)",
              letterSpacing: "0.04em",
              textShadow: "0 1px 8px rgba(0,0,0,0.7)",
            }}
          >
            Duw de poorten open
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}
// BUILD VERIFICATIE: 2026-06-24 18:20 UTC — hint tekst = 'Duw de poorten open', Playfair italic goud, altijd zichtbaar
