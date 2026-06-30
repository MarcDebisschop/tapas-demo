// =============================================================================
// BrandedError — Fase 3, item 2.6
// TaPas-waardige foutmeldingen met duidelijke vervolgstap.
// Vervangt generieke React-fouten voor de meest voorkomende gevallen:
//   - Sessie verlopen
//   - Onvoldoende credits
//   - Netwerk-/laadfouten
//   - Token ongeldig/verlopen
//
// NIEUW BESTAND — geen bestaande code aangepast.
// Gebruik naast de bestaande ErrorBoundary (die vangt render-crashes op).
// =============================================================================
import { AlertTriangle, CreditCard, Clock, Wifi, KeyRound, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ErrorType =
  | "sessie-verlopen"
  | "onvoldoende-credits"
  | "netwerk"
  | "token-ongeldig"
  | "algemeen";

interface BrandedErrorProps {
  type?: ErrorType;
  /** Overschrijf de standaard titel */
  titel?: string;
  /** Overschrijf de standaard beschrijving */
  beschrijving?: string;
  /** Primaire actie-knop label + handler */
  actiePrimair?: { label: string; onClick: () => void };
  /** Secundaire actie-knop label + handler */
  actieSecundair?: { label: string; onClick: () => void };
  /** Extra CSS class voor de wrapper */
  className?: string;
}

const ERROR_CONFIG: Record<
  ErrorType,
  {
    icoon: React.ReactNode;
    iconKleur: string;
    titel: string;
    beschrijving: string;
    actiePrimair: string;
    actieSecundair: string;
  }
> = {
  "sessie-verlopen": {
    icoon: <Clock className="h-6 w-6" aria-hidden="true" />,
    iconKleur: "text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)]",
    titel: "Je sessie is verlopen",
    beschrijving:
      "Om je gegevens te beschermen wordt een inactieve sessie automatisch beëindigd. Start opnieuw om verder te gaan — je voortgang is bewaard.",
    actiePrimair: "Opnieuw starten",
    actieSecundair: "Naar startpagina",
  },
  "onvoldoende-credits": {
    icoon: <CreditCard className="h-6 w-6" aria-hidden="true" />,
    iconKleur: "text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.12)]",
    titel: "Onvoldoende credits",
    beschrijving:
      "Je organisatie heeft momenteel niet genoeg credits om deze afname te starten. Neem contact op met je beheerder om credits bij te laden.",
    actiePrimair: "Terug naar overzicht",
    actieSecundair: "Beheerder contacteren",
  },
  netwerk: {
    icoon: <Wifi className="h-6 w-6" aria-hidden="true" />,
    iconKleur: "text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.10)]",
    titel: "Verbindingsprobleem",
    beschrijving:
      "De server kon niet bereikt worden. Controleer je internetverbinding en probeer opnieuw. Als het probleem aanhoudt, vernieuw dan de pagina.",
    actiePrimair: "Opnieuw proberen",
    actieSecundair: "Pagina vernieuwen",
  },
  "token-ongeldig": {
    icoon: <KeyRound className="h-6 w-6" aria-hidden="true" />,
    iconKleur: "text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)]",
    titel: "Ongeldige of verlopen uitnodiging",
    beschrijving:
      "Deze uitnodigingslink is niet langer geldig. Links verlopen na 7 dagen of worden eenmalig gebruikt. Vraag een nieuwe link aan bij je coach of beheerder.",
    actiePrimair: "Naar startpagina",
    actieSecundair: "Beheerder contacteren",
  },
  algemeen: {
    icoon: <AlertTriangle className="h-6 w-6" aria-hidden="true" />,
    iconKleur: "text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.10)]",
    titel: "Er is iets fout gegaan",
    beschrijving:
      "Er trad een onverwachte fout op. Probeer de pagina te vernieuwen. Als het probleem blijft, contacteer dan de ondersteuning.",
    actiePrimair: "Pagina vernieuwen",
    actieSecundair: "Naar startpagina",
  },
};

/**
 * BrandedError
 *
 * Gebruik in route-handlers of query-error states:
 *
 *   import { BrandedError } from "@/components/BrandedError";
 *
 *   if (error?.message?.includes("credits")) {
 *     return <BrandedError type="onvoldoende-credits" actiePrimair={{ label: "Terug", onClick: () => navigate("/") }} />;
 *   }
 */
export function BrandedError({
  type = "algemeen",
  titel,
  beschrijving,
  actiePrimair,
  actieSecundair,
  className = "",
}: BrandedErrorProps) {
  const cfg = ERROR_CONFIG[type];

  const handlePrimair = actiePrimair?.onClick ?? (() => window.location.reload());
  const handleSecundair = actieSecundair?.onClick ?? (() => { window.location.href = "/"; });

  const labelPrimair = actiePrimair?.label ?? cfg.actiePrimair;
  const labelSecundair = actieSecundair?.label ?? cfg.actieSecundair;

  return (
    <div
      className={`flex min-h-[60dvh] items-center justify-center px-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {/* Icoon */}
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${cfg.iconKleur}`}>
          {cfg.icoon}
        </div>

        {/* Titel */}
        <h2 className="tapas-text-lg tapas-heading">
          {titel ?? cfg.titel}
        </h2>

        {/* Beschrijving */}
        <p className="mt-3 tapas-text-sm leading-relaxed text-muted-foreground">
          {beschrijving ?? cfg.beschrijving}
        </p>

        {/* Acties */}
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={handlePrimair}
            className="gap-2"
            data-testid={`btn-error-primair-${type}`}
          >
            {type === "netwerk" ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            )}
            {labelPrimair}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSecundair}
            data-testid={`btn-error-secundair-${type}`}
          >
            {labelSecundair}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BrandedError;
