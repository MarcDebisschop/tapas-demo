// Temperamentenwiel — React-omhulsel rond de renderer.
//
// Deze component is bewust dun: alle tekenlogica staat in wiel.ts, zodat het
// wiel ook buiten React gebruikt kan worden (print, export, server-side render
// via een DOM-implementatie).
//
// Nog niet aangesloten op een pagina. Zie README.md in deze map.

import { useEffect, useRef } from "react";
import { bouwWiel, type WielDeelnemer, type WielOpties } from "./wiel";

export interface TemperamentenwielProps extends WielOpties {
  /** Toegankelijke omschrijving; standaard afgeleid van de deelnemers. */
  titel?: string;
  className?: string;
}

export function Temperamentenwiel({
  titel,
  className,
  acroniemen = true,
  wielposities = true,
  sectoren = true,
  kern = false,
  deelnemers = [] as WielDeelnemer[],
}: TemperamentenwielProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    bouwWiel(ref.current, { acroniemen, wielposities, sectoren, kern, deelnemers });
  }, [acroniemen, wielposities, sectoren, kern, deelnemers]);

  const label =
    titel ??
    (deelnemers.length
      ? `Temperamentenwiel met ${deelnemers.length} deelnemer(s) op hun wielpositie`
      : "Temperamentenwiel met 24 posities");

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={label}
      viewBox="0 0 1000 1000"
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

export default Temperamentenwiel;
