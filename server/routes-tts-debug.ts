// ---------------------------------------------------------------------------
// server/routes-tts-debug.ts — TIJDELIJK diagnostisch endpoint voor TTS-debug
//
// GET /api/tts-debug
//   Roept tts.py aan met een korte testtekst en retourneert de volledige
//   stderr-output als JSON. Zo kunnen we zonder Render-dashboard zien
//   welke fout de Gemini API geeft.
//
// VERWIJDER dit bestand (en de registratie in routes.ts) zodra TTS werkt.
// ---------------------------------------------------------------------------

import type { Express } from "express";
import { spawn } from "node:child_process";
import { join } from "node:path";

export function registerTtsDebugRoute(app: Express): void {
  app.get("/api/tts-debug", (_req, res) => {
    const ttsScript = join(process.cwd(), "dist", "tts.py");
    const testTekst =
      "Lees onderstaande voor in vlot Belgisch-Nederlands met een zachte Vlaamse tongval " +
      "(Oost-Vlaanderen): zachte g, geen scherpe Hollandse klanken, geen Randstad-intonatie. " +
      "Klink warm, kalm en uitnodigend.\n\nDit is een korte diagnostische test van de Vlaamse stem.";

    const py = spawn("python3", [ttsScript, testTekst]);
    const stderrLines: string[] = [];
    const stdoutChunks: Buffer[] = [];

    py.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    py.stderr.on("data", (d: Buffer) => {
      stderrLines.push(d.toString());
      console.error("[tts-debug]", d.toString());
    });

    py.on("close", (code) => {
      const stdoutBytes = Buffer.concat(stdoutChunks).length;
      res.json({
        exitCode: code,
        stdoutBytes,
        stderr: stderrLines.join(""),
        success: code === 0 && stdoutBytes > 0,
        diagnose: code !== 0
          ? "TTS mislukt — zie stderr voor exacte fout"
          : stdoutBytes === 0
          ? "Python sloot zonder fout maar produceerde geen audio"
          : "TTS geslaagd — audio gegenereerd",
      });
    });
  });
}
