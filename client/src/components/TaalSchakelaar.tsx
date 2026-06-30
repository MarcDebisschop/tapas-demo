// =============================================================================
// TaalSchakelaar — Fase 3, item 2.4
// Centraal herbruikbaar taalschakelaar-component voor de deelnemer-poort.
// Vervangt de inline TaalKiezer() in start.tsx en deelnemer.tsx niet (die
// blijven werken) — dit is een verbeterde variant met vlag-emoji en tooltip
// voor gebruik op de poortpagina en eventuele nieuwe pagina's.
//
// NIEUW BESTAND — geen bestaande code aangepast.
// =============================================================================
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

/** Vlag-emoji per taalcode */
const TAAL_VLAGGEN: Record<string, string> = {
  nl: "🇧🇪",
  fr: "🇫🇷",
  en: "🇬🇧",
  es: "🇪🇸",
  ru: "🇷🇺",
};

interface TaalSchakelaarProps {
  /** Huidige geselecteerde taal */
  taal: Taal;
  /** Callback bij taalwijziging */
  onWissel: (nieuweTaal: Taal) => void;
  /** Label voor screenreaders */
  ariaLabel?: string;
  /** Toon vlaggen naast taalcode */
  metVlaggen?: boolean;
  /** Compacte variant (geen label, enkel vlag + code) */
  compact?: boolean;
  /** Extra CSS class */
  className?: string;
}

/**
 * TaalSchakelaar
 *
 * Gebruik op een poortpagina:
 *
 *   import { TaalSchakelaar } from "@/components/TaalSchakelaar";
 *   ...
 *   <TaalSchakelaar taal={uiTaal} onWissel={setUiTaal} metVlaggen />
 */
export function TaalSchakelaar({
  taal,
  onWissel,
  ariaLabel = "Kies je taal",
  metVlaggen = false,
  compact = false,
  className = "",
}: TaalSchakelaarProps) {
  return (
    <Select value={taal} onValueChange={(v) => onWissel(normaliseerTaal(v))}>
      <SelectTrigger
        className={`h-9 w-auto gap-1.5 px-2.5 ${className}`}
        data-testid="select-ui-taal"
        aria-label={ariaLabel}
      >
        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        {!compact && <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {TALEN.map((t) => (
          <SelectItem key={t} value={t} data-testid={`option-taal-${t}`}>
            {metVlaggen && (
              <span className="mr-1.5" aria-hidden="true">
                {TAAL_VLAGGEN[t] ?? "🌐"}
              </span>
            )}
            <span className="font-mono text-xs opacity-60">{TAAL_CODES[t]}</span>
            {" · "}
            {TAAL_NAMEN[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default TaalSchakelaar;
