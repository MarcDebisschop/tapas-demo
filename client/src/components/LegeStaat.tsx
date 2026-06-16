// =============================================================================
// LegeStaat — elegante, bezielde "empty state" in TaPas-signatuur.
//
// Geen kale "geen resultaten"-melding, maar een klein moment van richting:
// een fijne, met de hand getekende vluchtroute (stippellijn + vliegtuigje dat
// net opstijgt naar een bestemmingspunt), een gouden haarlijn, warme microcopy
// en — optioneel — een uitnodigende actie. Sluit visueel aan op de rondleiding
// ("De vlucht") en op het Earhart-merkteken van het platform.
//
// Talent & passie tot in het detail: zelfs een leeg scherm "teast".
// =============================================================================
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  /** Korte bovenregel, bv. "NOG NIETS OP DE RADAR". */
  oog?: string;
  titel: string;
  body?: string;
  /** Optionele actie (knop) onder de tekst. */
  actie?: ReactNode;
  className?: string;
}

/**
 * Fijne lijn-illustratie: een gestippelde vluchtroute die opstijgt van een
 * vertrekpunt links-onder naar een bestemmingsster rechts-boven, met een klein
 * vliegtuigje halverwege. Kleuren volgen de theme-tokens (teal + goud).
 */
function VluchtTekening({ animeer }: { animeer: boolean }) {
  // Boog van vertrek (28,92) naar bestemming (152,28).
  const d = "M28 92 Q 78 18 152 28";
  return (
    <svg
      viewBox="0 0 180 120"
      fill="none"
      className="h-28 w-44"
      role="img"
      aria-hidden="true"
    >
      {/* zachte grondlijn */}
      <line x1="14" y1="100" x2="166" y2="100" stroke="hsl(var(--border))" strokeWidth="1" />
      {/* vertrekpunt */}
      <circle cx="28" cy="92" r="4" fill="hsl(var(--accent))" />
      <circle cx="28" cy="92" r="9" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.35" fill="none" />
      {/* gestippelde vluchtroute, tekent zich (subtiel) */}
      <motion.path
        d={d}
        stroke="hsl(var(--gold))"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        strokeLinecap="round"
        opacity="0.85"
        initial={animeer ? { pathLength: 0, opacity: 0 } : false}
        animate={animeer ? { pathLength: 1, opacity: 0.85 } : undefined}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />
      {/* bestemmings-ster rechtsboven */}
      <g transform="translate(152 28)">
        <motion.g
          initial={animeer ? { scale: 0, opacity: 0 } : false}
          animate={animeer ? { scale: 1, opacity: 1 } : undefined}
          transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 14 }}
        >
          <path
            d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z"
            fill="hsl(var(--gold))"
          />
        </motion.g>
      </g>
      {/* vliegtuigje halverwege de boog, licht omhoog gericht */}
      <motion.g
        initial={animeer ? { opacity: 0 } : false}
        animate={animeer ? { opacity: 1 } : undefined}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <g transform="translate(86 40) rotate(-24)">
          {/* eenvoudige top-down silhouet, in teal */}
          <path
            d="M10 0 L-4 3.2 L-4 1.1 L-8 1.1 L-8 -1.1 L-4 -1.1 L-4 -3.2 Z"
            fill="hsl(var(--accent))"
          />
          <path d="M-1 0 L-6 6 L-3.4 6 Z" fill="hsl(var(--accent))" opacity="0.7" />
          <path d="M-1 0 L-6 -6 L-3.4 -6 Z" fill="hsl(var(--accent))" opacity="0.7" />
        </g>
      </motion.g>
    </svg>
  );
}

export function LegeStaat({ oog, titel, body, actie, className = "" }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className={`flex flex-col items-center px-6 py-16 text-center ${className}`}>
      <VluchtTekening animeer={!reduce} />
      {oog && (
        <span className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          {oog}
        </span>
      )}
      <p className="mt-2 text-base font-semibold tracking-tight text-foreground">{titel}</p>
      {body && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      )}
      {actie && <div className="mt-5">{actie}</div>}
    </div>
  );
}
