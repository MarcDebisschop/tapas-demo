#!/usr/bin/env node
// =============================================================================
// verify-duidingsbeheer.mjs — PERMANENTE BEWAKING van de LIVE AI-duidinglaag (T4P)
//
// Waarom dit bestand bestaat:
//   De duidingpilot voegt een LIVE AI-laag toe bovenop het bestaande statische
//   rapportpad. Twee dingen mogen NOOIT stilletjes wegvallen:
//     (1) De regie-prompt moet het model expliciet verbieden cijfers te
//         verzinnen ("verzin geen ... uitsluitend de meegegeven").
//     (2) Het AI-duidingpad moet ALTIJD terugvallen op de bestaande statische
//         bouwRapportInhoud-tekst — een afname mag nooit blokkeren.
//   Bovendien mag het verborgen TaPas-Beeld-construct nooit als anker of
//   duiding-uitvoer worden meegegeven.
//
//   Dit script faalt LUID (exit 1) zodra één van die garanties breekt, zodat een
//   toekomstige wijziging de pilot niet ongemerkt onveilig kan maken.
//
// Gebruik:
//   node script/verify-duidingsbeheer.mjs           # statische controles
//   node script/verify-duidingsbeheer.mjs --live    # + rooktest AI-call (indien GEMINI_API_KEY)
//
// Spiegel van verify-vlaamse-stem.mjs. Toegevoegd aan de build om regressie te blokkeren.
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

console.log("\n== Duidingsbeheer (LIVE AI-duiding T4P) — structurele garanties ==\n");

// -- Garantie 1: duiding-manager.ts bestaat en exporteert de kern-API ---------
const dm = lees("server/duiding-manager.ts");
check("server/duiding-manager.ts bestaat", dm !== null);
if (dm) {
  check("duiding-manager.ts exporteert getRegiePrompt", /export function getRegiePrompt/.test(dm));
  check("duiding-manager.ts exporteert getAnker", /export function getAnker/.test(dm));
  check("duiding-manager.ts exporteert buildDuidingManagerRoutes", /export function buildDuidingManagerRoutes/.test(dm));
}

// -- Garantie 2: de regie-prompt verbiedt het bijverzinnen van cijfers --------
// Kern-instructie (in de NL-default): "verzin geen" + "uitsluitend de meegegeven".
check(
  "regie-prompt-default bevat kern-instructie 'verzin geen'",
  !!dm && /verzin geen/i.test(dm),
  "de regie-prompt moet het model verbieden getallen/feiten bij te verzinnen",
);
check(
  "regie-prompt-default bevat 'uitsluitend de meegegeven'",
  !!dm && /uitsluitend de meegegeven/i.test(dm),
);

// -- Garantie 3: het AI-duidingpad valt terug op bouwRapportInhoud -------------
// Bewijs dat de statische weg de fallback is: de repository bouwt eerst de
// statische inhoud (bouwRapportInhoud) en verrijkt daarna enkel bij succes.
const repo = lees("server/repositories/rapporten.ts");
check("rapporten.ts bouwt nog steeds de statische bouwRapportInhoud", !!repo && /bouwRapportInhoud/.test(repo));
check("rapporten.ts roept genereerAiDuiding aan (additief AI-pad)", !!repo && /genereerAiDuiding/.test(repo));
check(
  "rapporten.ts: AI-pad heeft een fallback naar de statische inhoud",
  !!repo && /fallback naar bouwRapportInhoud/.test(repo),
  "de statische inhoud/html moet behouden blijven als de AI faalt",
);
check(
  "duiding-manager.ts: genereerAiDuiding retourneert null bij falen (fallback-signaal)",
  !!dm && /return null/.test(dm),
);

// -- Garantie 4: TaPas-Beeld wordt nooit als anker/uitvoer meegegeven ---------
check(
  "duiding-manager.ts: geen 'TaPas-Beeld' in de anker-defaults",
  !!dm && !/["']TaPas-Beeld["']\s*:/.test(dm),
  "TaPas-Beeld mag geen concept-anker hebben",
);
check(
  "duiding-manager.ts: TaPas-Beeld expliciet uitgesloten via isTapasBeeld",
  !!dm && /isTapasBeeld/.test(dm),
);

// -- Garantie 5 (informatief): scoring.ts wordt niet gewijzigd via dit pad -----
check(
  "duiding-manager.ts importeert scoring.ts NIET om te wijzigen (informatief)",
  !!dm && !/from ["']\.\/scoring["']/.test(dm),
);

// -- Optioneel: live rooktest van de AI-call ----------------------------------
if (process.argv.includes("--live")) {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) {
    console.log("\n(live) GEMINI_API_KEY ontbreekt — rooktest overgeslagen (fallback blijft actief).");
  } else {
    console.log("\n== Live rooktest: Gemini generateContent ==\n");
    try {
      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Antwoord met exact het woord OK." }] }] }),
        },
      );
      check(`live Gemini geeft HTTP 200 (kreeg ${resp.status})`, resp.status === 200);
    } catch (e) {
      check("live Gemini bereikbaar", false, String(e));
    }
  }
}

console.log();
if (fouten > 0) {
  console.log(rood(`✗ ${fouten} garantie(s) gebroken — de duidingpilot is NIET veilig.`));
  process.exit(1);
}
console.log(groen("✓ Alle garanties intact — de LIVE AI-duiding is veilig (met sjabloon-fallback)."));
process.exit(0);
