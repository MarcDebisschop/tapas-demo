/**
 * Demo-modus detectie
 * ─────────────────────────────────────────────────────────────
 * Als de omgevingsvariabele VITE_DEMO_MODE="true" is gezet
 * (via Render environment variables), is de hele app in
 * read-only demo-modus. Bezoekers kunnen alles bekijken en
 * doorklikken, maar kunnen geen data invoeren of versturen.
 *
 * Lokale ontwikkeling: VITE_DEMO_MODE is niet gezet → false.
 */

export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Gebruik in een component:
 *
 *   import { DEMO_MODE } from "@/lib/demoMode";
 *
 *   <Button disabled={DEMO_MODE} onClick={...}>Verstuur</Button>
 *   <input disabled={DEMO_MODE} ... />
 *
 * Of voor een zachtere UX: laat de knop klikbaar zijn maar toon
 * een toast via useDemoToast():
 */

import { useToast } from "@/hooks/use-toast";

export function useDemoToast() {
  const { toast } = useToast();
  return () =>
    toast({
      title: "Demo-modus",
      description:
        "Dit is een read-only demo. Invoer en acties zijn uitgeschakeld.",
      duration: 2500,
    });
}
