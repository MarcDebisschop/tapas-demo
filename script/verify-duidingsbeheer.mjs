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

// -- Garantie 3: het AI-duidingpad valt terug op de statische generieke inhoud --
// De rapportkeuze loopt sinds de registry via server/rapport-registry.ts. De
// generieke fallback dáár gebruikt bouwRapportInhoud; het live pad (storage.ts)
// bouwt eerst de statische inhoud via de registry en verrijkt pas daarna, met
// behoud van de statische inhoud als fallback.
const registry = lees("server/rapport-registry.ts");
check("rapport-registry.ts bestaat", registry !== null);
check(
  "rapport-registry.ts: generieke fallback gebruikt bouwRapportInhoud",
  !!registry && /bouwRapportInhoud/.test(registry),
);
// Auditronde 3 verwijderde server/repositories/rapporten.ts: die kopie werd door
// niemand aangeroepen en kon uiteenlopen met het echte pad. Deze garantie test dus
// het ENIGE live rapportpad, in server/storage.ts. (Voorheen wees ze naar het
// verwijderde bestand, waardoor de bouw altijd faalde.)
const rapportPad = lees("server/storage.ts");
check(
  "het live rapportpad kiest de generator via de gedeelde registry",
  !!rapportPad && /kiesGenerator\(contract\?\.instrumentId\)/.test(rapportPad),
);
check(
  "het live rapportpad roept genereerAiDuiding aan (additief AI-pad)",
  !!rapportPad && /genereerAiDuiding\(inhoud, contract\)/.test(rapportPad),
);
check(
  "het live rapportpad valt bij een AI-fout terug op de statische inhoud",
  !!rapportPad && /fallback naar bouwRapportInhoud/.test(rapportPad),
  "de statische inhoud/html moet behouden blijven als de AI faalt",
);
const stor = lees("server/storage.ts");
check(
  "storage.ts kiest de generator via de gedeelde registry (één bron van waarheid)",
  !!stor && /kiesGenerator/.test(stor),
);
check(
  "storage.ts: AI-duiding draait nooit op een instrument met eigen generator",
  !!stor && /heeftDedicatedGenerator/.test(stor),
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

// -- Garantie 6: T4Sports-duidinglaag (ADDITIEF) — zelfde veiligheidsgaranties --
// De T4Sports-laag voegt een EXTRA duidingssectie toe aan de statische HTML. Ze
// moet (a) bestaan, (b) stil terugvallen op de originele HTML, (c) een regie-prompt
// hebben die cijfers verbiedt, en (d) concept-ankers zonder verzonnen getallen.
check(
  "duiding-manager.ts exporteert verrijkT4SportsRapport (T4Sports AI-pad)",
  !!dm && /export async function verrijkT4SportsRapport/.test(dm),
);
check(
  "duiding-manager.ts definieert T4SPORTS_INSTRUMENT",
  !!dm && /T4SPORTS_INSTRUMENT\s*=\s*["']t4sports["']/.test(dm),
);
check(
  "duiding-manager.ts heeft CONCEPT_ANKERS_T4SPORTS + regie-prompt (5 talen)",
  !!dm && /CONCEPT_ANKERS_T4SPORTS/.test(dm) && /CONCEPT_REGIE_PROMPT_T4SPORTS/.test(dm),
);
check(
  "verrijkT4SportsRapport valt stil terug op de originele HTML (return html)",
  !!dm && /export async function verrijkT4SportsRapport[\s\S]*?\breturn html\b/.test(dm),
  "faalt de AI, dan moet de originele statische HTML ongewijzigd terugkomen",
);
// Guardrail: de T4Sports regie-prompt verbiedt óók het bijverzinnen van cijfers.
{
  const m = dm && dm.match(/const CONCEPT_REGIE_PROMPT_T4SPORTS[\s\S]*?\n};/);
  const blok = m ? m[0] : "";
  check(
    "T4Sports regie-prompt verbiedt verzonnen getallen ('verzin' + 'geen getallen')",
    !!blok && /verzin/i.test(blok) && /geen getallen/i.test(blok),
    "de T4Sports regie-prompt moet het model verbieden getallen/feiten bij te verzinnen",
  );
}
// Statische 'geen verzonnen getallen'-check: de concept-anker-teksten zelf bevatten
// geen cijfers. We inspecteren enkel de OBJECT-BODY (na de openende { ), zodat de
// '4' in de identifier T4SPORTS niet meetelt.
{
  const m = dm && dm.match(/const CONCEPT_ANKERS_T4SPORTS[^{]*\{([\s\S]*?)\n};/);
  let body = m ? m[1] : "";
  // Strip regelcommentaar zodat toelichtende cijfers in commentaar niet meetellen.
  body = body.replace(/\/\/[^\n]*/g, "");
  check(
    "T4Sports concept-ankers bevatten geen verzonnen getallen (geen cijfers)",
    !!m && !/[0-9]/.test(body),
    "concept-anker-teksten mogen geen cijfers bevatten — cijfers komen enkel uit het contract",
  );
}

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
