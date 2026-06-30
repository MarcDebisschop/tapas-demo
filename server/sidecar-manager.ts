// =============================================================================
// sidecar-manager.ts — TTS FastAPI sidecar configuratie & health-check
//
// Aangemaakt: 2026-06-30 (Fase 1 stabilisatie, NP-1)
// Reden: routes-deelnemer.ts importeert ttsSidecarLive en TTS_SERVICE_URL
//        uit dit bestand, maar het bestand bestond niet — crashrisico bij start.
//
// Logica identiek aan de oorspronkelijke inline definitie in routes.ts (Ronde 8).
// De FastAPI TTS-service draait op poort 8001 als persistent sidecar.
// In de gepubliceerde demo-omgeving is de sidecar niet actief.
// =============================================================================

// URL van de persistente TTS FastAPI sidecar (poort 8001).
// Overschrijfbaar via omgevingsvariabele TAPAS_TTS_SIDECAR.
export const TTS_SERVICE_URL: string =
  process.env.TAPAS_TTS_SIDECAR ?? "http://127.0.0.1:8001";

// Bepaalt of de sidecar als actief beschouwd wordt.
// Standaard uit (false) zodat de spawn-fallback (tts.py) altijd werkt.
// Zet TAPAS_TTS_LIVE=1 in de productieomgeving als de sidecar draait.
export function ttsSidecarLive(): boolean {
  return process.env.TAPAS_TTS_LIVE === "1";
}
