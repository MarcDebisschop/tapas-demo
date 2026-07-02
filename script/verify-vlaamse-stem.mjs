#!/usr/bin/env node
// =============================================================================
// verify-vlaamse-stem.mjs — PERMANENTE BEWAKING van de Vlaamse Sulafat-stem
//
// Waarom dit bestand bestaat:
//   De Vlaamse stem is in het verleden ~5x geregresseerd naar een Hollandse
//   browserstem. Telkens door één van dezelfde twee oorzaken:
//     (1) De Web Speech API-terugval (speechSynthesis) sloop terug in de client
//         → browsers hebben geen nl-BE-stem, dus je hoort nl-NL (Hollands).
//     (2) De /api/tts-route brak (bv. ontbrekende import → "spawn is not defined")
//         → HTTP 500 → frontend toont "niet beschikbaar".
//
//   Dit script faalt LUID (exit 1) zodra één van de garanties breekt. Zo kan
//   een toekomstige wijziging de stem niet stilletjes terugdraaien.
//
// Gebruik:
//   node script/verify-vlaamse-stem.mjs           # statische controles
//   node script/verify-vlaamse-stem.mjs --live <URL>   # + echte audio-test
//
// Voeg dit toe aan je build/CI om elke regressie automatisch te blokkeren.
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rood = (s) => `\x1b[31m${s}\x1b[0m`;
const groen = (s) => `\x1b[32m${s}\x1b[0m`;

let fouten = 0;
const check = (naam, ok, detail = "") => {
  if (ok) {
    console.log(groen(`  OK   `) + naam);
  } else {
    console.log(rood(`  FAIL `) + naam + (detail ? `  — ${detail}` : ""));
    fouten++;
  }
};

const lees = (rel) => {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

console.log("\n== Vlaamse stem (Sulafat) — structurele garanties ==\n");

// -- Garantie 1: GEEN Web Speech API-terugval in de client -------------------
// Dit is dé oorzaak van de terugkerende Hollandse stem. Mag nergens staan.
const clientBestanden = [
  "client/src/components/UitlegPaneel.tsx",
];
let webSpeechGevonden = false;
for (const f of clientBestanden) {
  const inhoud = lees(f) ?? "";
  if (/speechSynthesis|SpeechSynthesisUtterance|webkitSpeechRecognition/.test(inhoud)) {
    webSpeechGevonden = true;
  }
}
check(
  "Geen Web Speech API-terugval in UitlegPaneel (voorkomt Hollandse stem)",
  !webSpeechGevonden,
  "speechSynthesis mag NIET terugkeren in de client",
);

// -- Garantie 2: de stem staat hard op Sulafat ------------------------------
const tts = lees("server/tts.py") ?? "";
check('tts.py: TTS_VOICE = "Sulafat"', /TTS_VOICE\s*=\s*"Sulafat"/.test(tts));
check('tts.py: prebuiltVoiceConfig gebruikt Sulafat', /voiceName["']?\s*:\s*TTS_VOICE/.test(tts));
check('tts.py: pplx-fallback ook voice="sulafat"', /voice\s*=\s*"sulafat"/.test(tts));

// -- Garantie 3: de Vlaamse prompt wordt altijd meegestuurd -----------------
const uitleg = lees("server/uitleg.ts") ?? "";
check("uitleg.ts exporteert VLAAMSE_STEM_PROMPT", /export const VLAAMSE_STEM_PROMPT/.test(uitleg));
check("uitleg.ts: prompt beschrijft Vlaamse tongval", /Vlaamse tongval/.test(uitleg));

// -- Garantie 4: /api/tts-route is correct bedraad --------------------------
const route = lees("server/routes-deelnemer.ts") ?? "";
check(
  'routes-deelnemer.ts importeert spawn (voorkomt "spawn is not defined")',
  /import\s*\{\s*spawn\s*\}\s*from\s*"node:child_process"/.test(route),
);
check("routes-deelnemer.ts: /api/tts-route bestaat", /app\.post\(["']\/api\/tts["']/.test(route));
check("routes-deelnemer.ts: prompt wordt vóór de tekst geplakt", /VLAAMSE_STEM_PROMPT\s*\+/.test(route));
check("routes-deelnemer.ts: spawn-error wordt afgevangen", /py\.on\(["']error["']/.test(route));

// -- Optioneel: live audio-rooktest -----------------------------------------
const liveIdx = process.argv.indexOf("--live");
if (liveIdx !== -1 && process.argv[liveIdx + 1]) {
  const url = process.argv[liveIdx + 1].replace(/\/$/, "") + "/api/tts";
  console.log(`\n== Live rooktest: ${url} ==\n`);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst: "Dit is een controletest van de Vlaamse stem." }),
    });
    const type = resp.headers.get("content-type") ?? "";
    const buf = Buffer.from(await resp.arrayBuffer());
    check(`live /api/tts geeft HTTP 200 (kreeg ${resp.status})`, resp.status === 200);
    check(`live /api/tts geeft audio/mpeg (kreeg "${type}")`, type.includes("audio/mpeg"));
    check(`live /api/tts levert audio-bytes (kreeg ${buf.length})`, buf.length > 1000);
    // MP3/ID3-magic controle
    const isMp3 = buf.slice(0, 3).toString("ascii") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
    check("live audio is een geldig MP3-bestand", isMp3);
  } catch (e) {
    check("live /api/tts bereikbaar", false, String(e));
  }
}

console.log();
if (fouten > 0) {
  console.log(rood(`✗ ${fouten} garantie(s) gebroken — de Vlaamse stem is NIET veilig.`));
  process.exit(1);
}
console.log(groen("✓ Alle garanties intact — de Vlaamse Sulafat-stem is beschermd."));
process.exit(0);
