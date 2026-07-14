/**
 * server/routes/vragenlijst-t4kids.ts — NIEUW BESTAND (strikt additief).
 *
 * GET /api/vragenlijst/tapas-t4kids?taal=…
 *   Retourneert de T4Kids-ontdekkingsreis als ClientInstrument-compatibel object
 *   MET een additief `modules`-veld (de 3 "eilanden"), zodat de kindvriendelijke
 *   belevings-UX de reis kan renderen. Overrides uit de vraag_overschrijvingen-
 *   tabel worden per item/taal toegepast (question-manager).
 *
 * Analoog aan server/routes/vragenlijst-t4teens.ts. De interne mapping
 * (focus/versneller/driver) blijft server-side en wordt NIET meegestuurd naar
 * het kind — het `modules`-veld bevat enkel wat op het scherm hoort.
 *
 * Gebruik in deel1.tsx / de belevings-route:
 *   Als afname.instrumentId === "t4kids", haal dan dit endpoint op.
 */

import type { Express } from "express";
import { getOverridesMap } from "../question-manager";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";
import {
  T4KIDS_INTERESSE_PAREN,
  T4KIDS_ARCHETYPEN,
  T4KIDS_STELLINGEN,
  T4KIDS_WOORDSCHAAL,
  T4KIDS_ITEMS_FLAT,
  T4KIDS_ARCHETYPE_MAX_KEUZE,
  T4KIDS_ARCHETYPE_TOP_N,
} from "../t4kids/itembank";

const T4KIDS_INSTRUMENT = "tapas-t4kids";

// Pas een eventuele override toe op een itemtekst (per itemId + taal).
function metOverride(
  overrides: Map<string, Record<string, string>>,
  itemId: string,
  taal: string,
  origineel: string,
): string {
  const ov = overrides.get(itemId);
  return ov && ov[taal] ? ov[taal] : origineel;
}

/**
 * Bouw het T4Kids-view: ClientInstrument-compatibel (blocks + responseScales)
 * met een additief `modules`-veld voor de belevings-UX.
 */
function buildT4KidsClientInstrument(taal: string) {
  const overrides = getOverridesMap(T4KIDS_INSTRUMENT);

  // ── Module 1 — Ontdekkingsreis (interesseparen) ──────────────────────────
  const module1 = {
    id: "ontdekkingsreis",
    nr: 1,
    naam: "Eiland 1 — De Ontdekkingsreis",
    uitleg: "Kies telkens wat jij het liefst doet. Er is geen goed of fout.",
    type: "forced-choice-paren" as const,
    paren: T4KIDS_INTERESSE_PAREN.map((p) => ({
      id: p.id,
      links: { tekst: metOverride(overrides, `${p.id}-L`, taal, p.links.tekst) },
      rechts: { tekst: metOverride(overrides, `${p.id}-R`, taal, p.rechts.tekst) },
    })),
  };

  // ── Module 2 — Archetypen-galerij ────────────────────────────────────────
  const module2 = {
    id: "galerij",
    nr: 2,
    naam: "Eiland 2 — De Galerij",
    uitleg:
      "Kies de figuren die jij nu het leukst vindt. Vertel in een paar woorden waarom, en kies daarna je top 3.",
    type: "archetype-galerij" as const,
    maxKeuze: T4KIDS_ARCHETYPE_MAX_KEUZE,
    topN: T4KIDS_ARCHETYPE_TOP_N,
    archetypen: T4KIDS_ARCHETYPEN.map((a) => ({
      id: a.id,
      naam: metOverride(overrides, a.id, taal, a.naam),
    })),
  };

  // ── Module 3 — Zo-ben-ik-nu (woordschaal) ────────────────────────────────
  const module3 = {
    id: "zo-ben-ik",
    nr: 3,
    naam: "Eiland 3 — Zo ben ik nu",
    uitleg: "Kies telkens het woord dat het best bij jou past. Denk aan hoe het nu is.",
    type: "woordschaal" as const,
    schaal: T4KIDS_WOORDSCHAAL,
    stellingen: T4KIDS_STELLINGEN.map((s) => ({
      id: s.id,
      tekst: metOverride(overrides, s.id, taal, s.tekst),
    })),
  };

  // ── ClientInstrument-pariteit (blocks) — één blok per flat-item ──────────
  const blocks = T4KIDS_ITEMS_FLAT.map((item, idx) => ({
    blockIndex: idx,
    stateKey: `B${idx}`,
    family: item.domein,
    energyMode: "item" as const,
    items: [{ pos: "A", text: metOverride(overrides, item.id, taal, item.tekst) }],
  }));

  return {
    instrumentId: T4KIDS_INSTRUMENT,
    name: "T4Kids — Ontdekkingsreis",
    language: taal,
    description:
      "Een speelse talent-ontdekkingsreis langs drie eilanden. Voor kinderen van 10 tot 13 jaar.",
    responseScales: {
      energy: {
        type: "ordinal",
        min: 0,
        max: 3,
        options: T4KIDS_WOORDSCHAAL.map((w) => ({ value: w.waarde, label: w.label })),
      },
      connection0to10: null,
      baselineEnergy0to10: null,
    },
    // Additief: de 3 eilanden die de belevings-UX rendert.
    modules: [module1, module2, module3],
    blocks,
    connectionQuestions: [],
    totalBlocks: blocks.length,
  };
}

export function registerVragenlijstT4KidsRoutes(app: Express): void {
  app.get("/api/vragenlijst/tapas-t4kids", (req, res) => {
    try {
      const taal = normaliseerTaal((req.query.taal as string) ?? STANDAARD_TAAL);
      const view = buildT4KidsClientInstrument(taal);
      res.json(view);
    } catch (e) {
      console.error("[T4Kids route] Fout bij ophalen vragenlijst:", e);
      res.status(500).json({ error: "Ontdekkingsreis tijdelijk niet beschikbaar." });
    }
  });
}
