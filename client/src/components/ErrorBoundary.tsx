// =============================================================================
// ErrorBoundary — vangt onverwachte render-/laadfouten op zodat de bezoeker
// nooit een leeg scherm krijgt. Toont een rustige melding met een knop die de
// pagina hard herlaadt (inclusief cache-omzeiling), wat ook stale-bundle-
// problemen na een nieuwe publicatie oplost.
// =============================================================================
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    // Stil loggen voor diagnose; geen externe service nodig in de demo.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary ving een fout op:", error);
  }

  handleReload = () => {
    // Hard herladen met cache-buster: lost ook een verouderde JS-bundle op
    // die na een nieuwe publicatie naar een niet meer bestaand bestand wijst.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  handleHome = () => {
    window.location.href = window.location.origin + "/#/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Er ging even iets mis bij het laden
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Dit komt meestal door een verouderde versie in je browser. Herlaad de
            pagina om de meest recente versie op te halen.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="button-error-reload"
            >
              Pagina herladen
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              data-testid="button-error-home"
            >
              Naar startpagina
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
