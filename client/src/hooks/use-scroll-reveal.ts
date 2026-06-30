// =============================================================================
// useScrollReveal — Fase 3, item 4.2
// IntersectionObserver hook die .tapas-reveal elementen animeert
// zodra ze in beeld scrollen.
//
// NIEUW BESTAND — geen bestaande code aangepast.
// =============================================================================
import { useEffect, useRef } from "react";

interface ScrollRevealOptions {
  /** IntersectionObserver threshold (0-1). Default: 0.15 */
  threshold?: number;
  /** Root margin (CSS string). Default: "0px 0px -48px 0px" */
  rootMargin?: string;
  /** Voeg is-visible toe zodra in beeld (niet verwijderen bij uit-beeld). Default: true */
  once?: boolean;
}

/**
 * useScrollReveal
 *
 * Attach aan een container-ref. Alle kinderen met .tapas-reveal krijgen
 * de class .is-visible zodra ze in het viewport scrollen.
 *
 * Gebruik:
 *   const containerRef = useScrollReveal<HTMLDivElement>();
 *   <div ref={containerRef}>
 *     <div className="tapas-reveal tapas-reveal-delay-1">...</div>
 *     <div className="tapas-reveal tapas-reveal-delay-2">...</div>
 *   </div>
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {}
) {
  const containerRef = useRef<T>(null);
  const { threshold = 0.15, rootMargin = "0px 0px -48px 0px", once = true } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(".tapas-reveal")
    );
    if (elements.length === 0) return;

    // Fallback: als IntersectionObserver niet beschikbaar (SSR / oud browser)
    if (typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("is-visible");
          }
        });
      },
      { threshold, rootMargin }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return containerRef;
}

/**
 * useScoreBarReveal
 *
 * Animeert .tapas-score-bar-fill elementen door --tapas-bar-target in te stellen
 * en .is-animated toe te voegen zodra de balk in beeld komt.
 *
 * Gebruik:
 *   const barRef = useScoreBarReveal<HTMLDivElement>();
 *   <div ref={barRef}>
 *     <div className="tapas-score-bar">
 *       <div
 *         className="tapas-score-bar-fill"
 *         style={{ "--tapas-bar-target": `${pct}%` } as React.CSSProperties}
 *       />
 *     </div>
 *   </div>
 */
export function useScoreBarReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {}
) {
  const containerRef = useRef<T>(null);
  const { threshold = 0.2, rootMargin = "0px 0px -32px 0px", once = true } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fills = Array.from(
      container.querySelectorAll<HTMLElement>(".tapas-score-bar-fill")
    );
    if (fills.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      fills.forEach((el) => el.classList.add("is-animated"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-animated");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("is-animated");
          }
        });
      },
      { threshold, rootMargin }
    );

    fills.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return containerRef;
}
