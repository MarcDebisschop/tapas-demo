// ---------------------------------------------------------------------------
// ImpactRoosSvg — Fase 4 (item 4.3)
// Inline SVG octant-radar voor de Impact-roos.
//
// De Impact-roos heeft 8 octanten langs twee assen:
//   Verticale as: Ruimte nemen (N) ↔ Ruimte laten (S)
//   Horizontale as: Verbinding (W) ↔ Afstand (E)
//
// Elke octant krijgt een "score" (0–7) die de straal bepaalt.
// De component accepteert een optioneel `scores`-array van 8 waarden
// (NO, N, NW, W, SW, S, SE, E) en een optioneel `congruentie`-object
// voor de twee assen. Bij afwezigheid van scores worden voorbeeldwaarden
// gebruikt (specimen-modus).
//
// Animatie: elke octantstraal groeit bij mount via CSS-transition.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

// Octant-namen (met de klok mee vanaf boven-rechts)
const OCTANT_LABELS = [
  "Initiatief", // NE — Ruimte nemen + Afstand
  "Regie",       // N  — Ruimte nemen + neutraal
  "Uitnodiging", // NW — Ruimte nemen + Verbinding
  "Warmte",      // W  — neutraal + Verbinding
  "Aandacht",    // SW — Ruimte laten + Verbinding
  "Rust",        // S  — Ruimte laten + neutraal
  "Terughouding",// SE — Ruimte laten + Afstand
  "Focus",       // E  — neutraal + Afstand
];

// Assen-labels
const AS_V_POS = "Ruimte nemen";
const AS_V_NEG = "Ruimte laten";
const AS_H_POS = "Verbinding";
const AS_H_NEG = "Afstand";

interface Props {
  /** 8 scores in volgorde: NE, N, NW, W, SW, S, SE, E (elk 0–7) */
  scores?: number[];
  /** Congruentie per as (0–100) */
  congruentie?: { v: number; h: number };
  /** Breedte in pixels (default 380) */
  grootte?: number;
  /** Als true: verberg octant-labels (compacte modus) */
  compact?: boolean;
}

const SPECIMEN_SCORES = [5, 4, 6, 7, 3, 2, 3, 4];
const MAX_SCORE = 7;

function graden(octant: number): number {
  // Octant 0 = NE = 45°, elke stap = 45°
  return 45 + octant * 45;
}

function poolNaarXY(hoek: number, straal: number, cx: number, cy: number): [number, number] {
  const rad = ((hoek - 90) * Math.PI) / 180;
  return [cx + straal * Math.cos(rad), cy + straal * Math.sin(rad)];
}

export default function ImpactRoosSvg({
  scores = SPECIMEN_SCORES,
  congruentie = { v: 74, h: 82 },
  grootte = 380,
  compact = false,
}: Props) {
  const cx = grootte / 2;
  const cy = grootte / 2;
  const maxStraal = grootte * 0.36;
  const [zichtbaar, setZichtbaar] = useState(false);
  const containerRef = useRef<SVGSVGElement>(null);

  // Scroll-reveal: animeer zodra het element in beeld komt
  useEffect(() => {
    const el = containerRef.current;
    if (!el) { setZichtbaar(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setZichtbaar(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Geanimeerde stralen: gaan van 0 naar doel-waarde
  const [huidig, setHuidig] = useState(scores.map(() => 0));
  useEffect(() => {
    if (!zichtbaar) return;
    let frame: number;
    const start = performance.now();
    const duur = 800; // ms
    function tick(nu: number) {
      const t = Math.min(1, (nu - start) / duur);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out
      setHuidig(scores.map((s) => s * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [zichtbaar, scores]);

  // Bouw het radar-pad (gesloten polygoon langs alle 8 octanten)
  const radarPad = huidig
    .map((s, i) => {
      const hoek = graden(i);
      const straal = (s / MAX_SCORE) * maxStraal;
      const [x, y] = poolNaarXY(hoek, straal, cx, cy);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  // Raster-cirkels
  const cirkels = [1, 2, 3, 4, 5, 6, 7].map((r) => (maxStraal * r) / MAX_SCORE);

  // Kleuren per octant (gebaseerd op TaPas huisstijl)
  const octantKleuren = [
    "#0d9488", "#14b8a6", "#0d9488", "#0e7490",
    "#1e293b", "#334155", "#1e293b", "#0e7490",
  ];

  return (
    <div
      className="relative mx-auto"
      style={{ width: grootte, maxWidth: "100%" }}
      data-testid="impact-roos-svg"
    >
      <svg
        ref={containerRef}
        viewBox={`0 0 ${grootte} ${grootte}`}
        width={grootte}
        height={grootte}
        aria-label="Impact-roos octant-radar"
        role="img"
        style={{ overflow: "visible" }}
      >
        {/* Raster-cirkels */}
        {cirkels.map((r, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={i === cirkels.length - 1 ? 1.5 : 0.75}
          />
        ))}

        {/* Assen-lijnen */}
        {[0, 45, 90, 135].map((hoek) => {
          const [x1, y1] = poolNaarXY(hoek, maxStraal, cx, cy);
          const [x2, y2] = poolNaarXY(hoek + 180, maxStraal, cx, cy);
          return (
            <line
              key={hoek}
              x1={x1.toFixed(1)} y1={y1.toFixed(1)}
              x2={x2.toFixed(1)} y2={y2.toFixed(1)}
              stroke="#cbd5e1"
              strokeWidth={0.75}
              strokeDasharray="4 3"
            />
          );
        })}

        {/* Octant-vlakken (individuele taartpunten, lichte kleur) */}
        {huidig.map((s, i) => {
          const hoekStart = graden(i) - 22.5;
          const hoekEind = graden(i) + 22.5;
          const straal = (s / MAX_SCORE) * maxStraal;
          const [x1, y1] = poolNaarXY(hoekStart, straal, cx, cy);
          const [x2, y2] = poolNaarXY(hoekEind, straal, cx, cy);
          const groot = straal > maxStraal / 2 ? 0 : 0;
          const d = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${straal.toFixed(1)},${straal.toFixed(1)} 0 ${groot} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
          return (
            <path
              key={i}
              d={d}
              fill={octantKleuren[i]}
              fillOpacity={0.15}
              stroke={octantKleuren[i]}
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* Radar-polygoon (gecombineerd vlak) */}
        <path
          d={radarPad}
          fill="#0d9488"
          fillOpacity={0.18}
          stroke="#0d9488"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Hoekpunten */}
        {huidig.map((s, i) => {
          const hoek = graden(i);
          const straal = (s / MAX_SCORE) * maxStraal;
          const [x, y] = poolNaarXY(hoek, straal, cx, cy);
          return (
            <circle
              key={i}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={3.5}
              fill="#0d9488"
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Octant-labels */}
        {!compact && OCTANT_LABELS.map((lbl, i) => {
          const hoek = graden(i);
          const straal = maxStraal + 22;
          const [x, y] = poolNaarXY(hoek, straal, cx, cy);
          return (
            <text
              key={i}
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="#64748b"
              fontFamily="system-ui, sans-serif"
            >
              {lbl}
            </text>
          );
        })}

        {/* Assen-labels */}
        <text x={cx} y={cy - maxStraal - 32} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b" fontFamily="system-ui, sans-serif">{AS_V_POS}</text>
        <text x={cx} y={cy + maxStraal + 36} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b" fontFamily="system-ui, sans-serif">{AS_V_NEG}</text>
        <text x={cx - maxStraal - 36} y={cy} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b" fontFamily="system-ui, sans-serif" transform={`rotate(-90, ${cx - maxStraal - 36}, ${cy})`}>{AS_H_POS}</text>
        <text x={cx + maxStraal + 36} y={cy} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b" fontFamily="system-ui, sans-serif" transform={`rotate(90, ${cx + maxStraal + 36}, ${cy})`}>{AS_H_NEG}</text>

        {/* Centerpunt */}
        <circle cx={cx} cy={cy} r={3} fill="#1e293b" />
      </svg>

      {/* Congruentie-indicatoren */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Congruentie Ruimte-as</p>
          <p className="mt-0.5 text-lg font-semibold text-foreground" style={{ color: "#0d9488" }}>
            {congruentie.v}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Congruentie Verbindings-as</p>
          <p className="mt-0.5 text-lg font-semibold" style={{ color: "#0d9488" }}>
            {congruentie.h}%
          </p>
        </div>
      </div>
    </div>
  );
}
