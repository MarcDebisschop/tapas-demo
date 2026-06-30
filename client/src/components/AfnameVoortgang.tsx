// =============================================================================
// AfnameVoortgang — Fase 3, item 2.3
// Toont "Blok X van Y" + voortgangsbalk op deel1-pagina.
// Nieuw bestand: geen bestaande code aangepast.
// =============================================================================
import { Progress } from "@/components/ui/progress";

interface AfnameVoortgangProps {
  /**  0-gebaseerde huidige index */
  huidigIndex: number;
  /** Totaal aantal blokken */
  totaal: number;
  /** Optioneel: label dat voor "Blok" komt (bv. "Vraag") */
  labelSingulier?: string;
  /** CSS class voor de wrapper */
  className?: string;
}

/**
 * AfnameVoortgang
 *
 * Gebruik in deel1.tsx:
 *
 *   import { AfnameVoortgang } from "@/components/AfnameVoortgang";
 *   ...
 *   <AfnameVoortgang huidigIndex={idx} totaal={blocks.length} />
 *
 * De component vervangt de losse "Blok X van Y" tekst + Progress in deel1.tsx
 * niet — hij wrapt ze in één herbruikbaar component dat ook op deel2 gebruikt
 * kan worden.
 */
export function AfnameVoortgang({
  huidigIndex,
  totaal,
  labelSingulier = "Blok",
  className = "",
}: AfnameVoortgangProps) {
  const huidig = huidigIndex + 1; // 1-gebaseerd voor weergave
  const pct = totaal > 0 ? Math.round((huidig / totaal) * 100) : 0;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} aria-label={`Voortgang: ${huidig} van ${totaal}`}>
      {/* Tekstregel: "Blok 3 van 7" */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="tapas-text-sm font-medium text-foreground">
          {labelSingulier}{" "}
          <span className="tabular-nums">{huidig}</span>
        </span>
        <span className="tapas-text-sm text-muted-foreground tabular-nums">
          {totaal} {totaal === 1 ? labelSingulier.toLowerCase() : `${labelSingulier.toLowerCase()}ken`}
        </span>
      </div>

      {/* Voortgangsbalk */}
      <Progress
        value={pct}
        className="h-2 tapas-progress-track"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* Percentage — subtiel, voor toegankelijkheid */}
      <span className="sr-only">{pct}% voltooid</span>
    </div>
  );
}

export default AfnameVoortgang;
