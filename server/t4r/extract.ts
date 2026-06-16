/**
 * TAPAS 4 Recruitment — PDF-extractie van een ingevuld TaPas/T4P-kandidaatrapport.
 *
 * BELANGRIJK: deze extractie is een BEST-EFFORT hulpmiddel, geen waarheid.
 * Tekstextractie uit PDF is nooit 100% betrouwbaar (lay-out, versies, kolommen).
 * Daarom levert de app de geëxtraheerde waarden ALTIJD eerst aan de beoordelaar
 * ter verificatie/correctie vóór er een match berekend wordt. Een stille
 * extractiefout mag nooit ongezien een aanwervingsbeslissing voeden.
 *
 * De extractor herkent de drie scoretabellen (drivers H05, talent-foci H07,
 * talent-versnellers H09), het zelfbeeldsaldo (H04) en de energie-/risicosignalen
 * (H03 energiediscrepantie, H16). Wat niet betrouwbaar herkend wordt, blijft leeg
 * en moet de beoordelaar zelf invullen.
 */

import type { EnergieStatus } from "./match";

export interface ExtractedMeting {
  net: number | null;
  energie: EnergieStatus | null;
  /** vertrouwensindicatie zodat het verificatiescherm twijfels kan markeren */
  confident: boolean;
}

export interface ExtractedContext {
  energieDiscrepantie: number | null;
  herstelTraag: boolean | null;
  perfectionistischeBelasting: boolean | null;
  scheveWederkerigheid: boolean | null;
}

export interface ExtractionResult {
  metingen: Record<string, ExtractedMeting>;
  context: ExtractedContext;
  rawText: string;
}

// Construct-key → woorden die in het rapport bij dat construct voorkomen.
// De namen worden in de PDF soms over twee regels gesplitst (bv. "Be\nPerfect"),
// daarom matchen we op een spatie-genormaliseerde tekst.
const CONSTRUCT_PATTERNS: { key: string; patterns: string[] }[] = [
  { key: "be_strong", patterns: ["be strong"] },
  { key: "be_perfect", patterns: ["be perfect"] },
  { key: "hurry_up", patterns: ["hurry up"] },
  { key: "try_hard", patterns: ["try hard"] },
  { key: "please_others", patterns: ["please others"] },
  { key: "interrelatie", patterns: ["interrelatie"] },
  { key: "operatie", patterns: ["operatie", "operationeel"] },
  { key: "strategie", patterns: ["strategie", "strategisch"] },
  { key: "innovatie", patterns: ["innovatie", "innovatief"] },
  { key: "analyse", patterns: ["analyse", "analytisch"] },
  { key: "coaching", patterns: ["coaching", "coachend"] },
  { key: "onderscheiden", patterns: ["onderscheiden", "onderscheidend"] },
  { key: "faciliteren", patterns: ["faciliteren", "facilitatie"] },
  { key: "impacteren", patterns: ["impacteren", "impact"] },
  { key: "resultaat", patterns: ["resultaat", "resultaatgericht"] },
  { key: "introspect", patterns: ["introspect", "zelfbeeld", "identiteit"] },
];

function normNumber(s: string): number {
  // TaPas gebruikt zowel "−" (U+2212) als "-" en komma als decimaalteken.
  return parseFloat(s.replace(/\u2212/g, "-").replace(",", "."));
}

function statusWord(s: string): EnergieStatus | null {
  const t = s.toLowerCase();
  if (t.includes("geeft")) return "geeft";
  if (t.includes("kost")) return "kost";
  if (t.includes("neutraal")) return "neutraal";
  return null;
}

/**
 * Zoekt per construct het eerstvolgende patroon "net  [energiedelta]  status".
 * In de TaPas-tabellen staat de naam, daarna op losse regels de nettoscore
 * (geheel getal met teken), de energiedelta (decimaal) en het statuswoord.
 */
export function extractFromText(rawText: string): ExtractionResult {
  // Normaliseer: voeg regels samen tot één doorzoekbare stroom met enkele spaties,
  // maar bewaar regelgrenzen als spatie zodat "Be\nPerfect" → "be perfect".
  const flat = rawText.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();

  const metingen: Record<string, ExtractedMeting> = {};

  for (const { key, patterns } of CONSTRUCT_PATTERNS) {
    let result: ExtractedMeting = { net: null, energie: null, confident: false };

    for (const pat of patterns) {
      let idx = lower.indexOf(pat);
      while (idx !== -1) {
        // Kijk in een venster ná de constructnaam naar "net + energiedelta + status".
        const window = flat.slice(idx + pat.length, idx + pat.length + 120);
        // Patroon: een net-score (geheel getal, +/−, 1-2 cijfers) gevolgd door
        // een energiedelta (decimaal met komma/punt) en een statuswoord.
        const m = window.match(
          /([+\u2212-]?\s?\d{1,2})\s+([+\u2212-]?\s?\d[.,]\d{1,2})\s+(geeft|kost|neutraal)/i
        );
        if (m) {
          const net = normNumber(m[1].replace(/\s/g, ""));
          const energie = statusWord(m[3]);
          if (Number.isFinite(net) && net >= -10 && net <= 10 && energie) {
            result = { net, energie, confident: true };
            break;
          }
        }
        idx = lower.indexOf(pat, idx + pat.length);
      }
      if (result.confident) break;
    }

    metingen[key] = result;
  }

  // Context: energiediscrepantie (H03), risicosignalen (H16).
  const context: ExtractedContext = {
    energieDiscrepantie: null,
    herstelTraag: null,
    perfectionistischeBelasting: null,
    scheveWederkerigheid: null,
  };

  // De energiediscrepantie staat als getal met teken en decimaal direct na het woord,
  // bv. "Energiediscrepantie−3,5". We eisen het teken + decimaal zodat we niet per
  // ongeluk een naburig geheel getal (bv. een consistentiescore) oppikken.
  const disc = flat.match(/energiediscrepantie\s*([+\u2212-]\s?\d{1,2}[.,]\d{1,2})/i);
  if (disc) {
    const v = normNumber(disc[1].replace(/\s/g, ""));
    if (Number.isFinite(v)) context.energieDiscrepantie = v;
  }

  if (/perfectionis\w*\s+(belasting|uitputting|uitputting|druk)/i.test(flat) || /perfectionistische belasting/i.test(flat))
    context.perfectionistischeBelasting = true;
  if (/scheve wederkerigheid|wederkerigheid[^.]*scheef/i.test(flat)) context.scheveWederkerigheid = true;
  if (/herstel\w*\s+(traag|onvoldoende|beperkt)|schakelt\s+niet\s+(snel|vlot)\s+terug/i.test(flat))
    context.herstelTraag = true;

  return { metingen, context, rawText };
}
