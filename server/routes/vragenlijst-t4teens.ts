/**
 * server/routes/vragenlijst-t4teens.ts
 *
 * GET /api/vragenlijst/tapas-t4teens
 *   Retourneert de T4Teens vraaglijst als ClientInstrument-compatibel object,
 *   met opgeslagen overrides verwerkt (vraag-overschrijvingen tabel).
 *
 * Nieuw bestand — Regel 2: nieuwe features in aparte bestanden.
 * Koppelt question-manager (overrides) aan de afname-flow voor T4Teens.
 *
 * Hoe te gebruiken in deel1.tsx:
 *   Als afname.instrumentId === "t4teens", haal dan dit endpoint op
 *   i.p.v. /api/instrument — zelfde ClientInstrument-structuur, T4Teens inhoud.
 */

import type { Express } from "express";
import { getOverridesMap } from "../question-manager";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";

// ─── T4Teens items definitie (1-op-1 copy van question-manager) ──────────────
// Gedupliceerd zodat dit bestand onafhankelijk te testen is.
// Bron: question-manager.ts → T4TEENS_ITEMS_DEF
const T4TEENS_ITEMS: {
  id: string;
  domein: string;
  cluster: string;
  tekst: string;
}[] = [
  { id: "T4T-I1-1", domein: "Energie", cluster: "Batterij", tekst: "Hoe vol zit je batterij vandaag? Schuif hem naar waar jij je voelt." },
  { id: "T4T-D1-1", domein: "Drivers", cluster: "Be Perfect", tekst: "Ik wil dat iets echt klopt voordat ik het loslaat — ook al kost dat meer tijd." },
  { id: "T4T-D2-1", domein: "Drivers", cluster: "Please Others", tekst: "Ik vind het fijn als iedereen om me heen het naar zijn zin heeft, soms zet ik mezelf daarvoor opzij." },
  { id: "T4T-D3-1", domein: "Drivers", cluster: "Try Hard", tekst: "Er is iemand die ik echt ken en naar wie ik opkijk — en als ik weet dat die in mij gelooft, doe ik alles om te laten zien wat ik kan." },
  { id: "T4T-D4-1", domein: "Drivers", cluster: "Hurry Up", tekst: "Wachten en traag vooruitgaan vind ik lastig — het mag voor mij snel gaan." },
  { id: "T4T-D5-1", domein: "Drivers", cluster: "Be Strong / Please Others", tekst: "Stel: jullie moeten met de groep iets oplossen en het loopt vast. Wat doe jij het liefst?" },
  { id: "T4T-D6-1", domein: "Drivers", cluster: "Be Strong / Hurry Up", tekst: "Stel: je hebt iemand iets beloofd, maar er komt iets leukers tussen. Wat doe jij?" },
  { id: "T4T-V1-1", domein: "Talent-versnellers", cluster: "Analyse", tekst: "Ik wil eerst snappen hoe iets in elkaar zit voor ik begin — en daar krijg ik energie van." },
  { id: "T4T-V2-1", domein: "Talent-versnellers", cluster: "Coaching", tekst: "Ik leer het best als ik er met iemand over kan praten of het mag uitleggen." },
  { id: "T4T-V3-1", domein: "Talent-versnellers", cluster: "Facilitatie", tekst: "Ik help graag dat alles vlot en geordend loopt voor de groep." },
  { id: "T4T-V4-1", domein: "Talent-versnellers", cluster: "Facilitatie", tekst: "Ik wil dat wat ik doe echt iets verandert of betekent — dan zet ik door." },
  { id: "T4T-V5-1", domein: "Talent-versnellers", cluster: "Resultaat", tekst: "Ik wil vooral zien wat het oplevert; ik werk graag naar een duidelijk eindresultaat toe." },
  { id: "T4T-V6-1", domein: "Talent-versnellers", cluster: "Constructief onderscheidend", tekst: "Ik bedenk vaak een eigen, andere manier om iets aan te pakken." },
  { id: "T4T-F1-1", domein: "Talent-foci", cluster: "Bedenken/creatie", tekst: "Ik vind het leuk om nieuwe dingen te bedenken die er nog niet zijn — daar kan ik in opgaan." },
  { id: "T4T-F2-1", domein: "Talent-foci", cluster: "Uitzoeken/onderzoek", tekst: "Ik krijg er energie van om iets uit te zoeken of een probleem te ontrafelen." },
  { id: "T4T-F3-1", domein: "Talent-foci", cluster: "Doen/uitvoeren (SJT)", tekst: "Stel: er moet iets concreet gemaakt of uitgevoerd worden. Voel jij je daar goed bij?" },
  { id: "T4T-F4-1", domein: "Talent-foci", cluster: "Leren/overdragen", tekst: "Ik vind het fijn om iemand iets te leren of uit te leggen." },
  { id: "T4T-F5-1", domein: "Talent-foci", cluster: "Samenwerken (SJT)", tekst: "Stel: je mag kiezen om iets alleen of samen met anderen te doen. Waar word je blijer van?" },
  { id: "T4T-R1-1", domein: "Interesse", cluster: "Realistisch", tekst: "Dingen maken, bouwen, herstellen of met je handen en machines werken." },
  { id: "T4T-R2-1", domein: "Interesse", cluster: "Investigative", tekst: "Uitzoeken hoe iets werkt: onderzoek, computers, meten of berekenen." },
  { id: "T4T-R3-1", domein: "Interesse", cluster: "Artistiek", tekst: "Iets creatiefs doen: film, muziek, toneel, schilderen of vormgeven." },
  { id: "T4T-R4-1", domein: "Interesse", cluster: "Sociaal", tekst: "Met en voor mensen bezig zijn: helpen, verzorgen, begeleiden." },
  { id: "T4T-R5-1", domein: "Interesse", cluster: "Ondernemend", tekst: "De leiding nemen, overtuigen, iets organiseren of ondernemen." },
  { id: "T4T-R6-1", domein: "Interesse", cluster: "Conventioneel", tekst: "Orde en overzicht houden: plannen, administratie, alles op zijn plek." },
  { id: "T4T-B1-1", domein: "Betekenis", cluster: "Betekenis", tekst: "Waar zou jij iets willen betekenen voor anderen of voor de wereld?" },
];

/**
 * Bouw een ClientInstrument-compatibel object voor T4Teens.
 * Elk item wordt een eigen blok (blockIndex = itemIndex).
 * Overrides worden toegepast vanuit de vraag_overschrijvingen tabel.
 */
function buildT4TeensClientInstrument(taal: string) {
  const overrides = getOverridesMap("tapas-t4teens");

  const blocks = T4TEENS_ITEMS.map((item, idx) => {
    // Override of originele tekst
    const ovMap = overrides.get(item.id);
    const text = (ovMap && ovMap[taal]) ? ovMap[taal] : item.tekst;

    return {
      blockIndex: idx,
      stateKey: `B${idx}`,
      family: item.domein,
      energyMode: "item" as const,
      items: [
        {
          pos: "A",
          text,
        },
      ],
    };
  });

  return {
    instrumentId: "tapas-t4teens",
    name: "T4Teens — Vonk-instrument",
    language: taal,
    description: "Ontdek je talent, energie en gedragspatroon. Voor jongeren van 16 tot 21 jaar.",
    responseScales: {
      energy: {
        type: "ordinal",
        min: -2,
        max: 2,
        options: [
          { value: -2, label: "Past helemaal niet bij mij" },
          { value: -1, label: "Past niet zo bij mij" },
          { value: 0, label: "Neutraal" },
          { value: 1, label: "Past bij mij" },
          { value: 2, label: "Past helemaal bij mij" },
        ],
      },
      connection0to10: null,
      baselineEnergy0to10: null,
    },
    blocks,
    connectionQuestions: [],
    totalBlocks: blocks.length,
  };
}

export function registerVragenlijstT4TeensRoutes(app: Express): void {
  /**
   * GET /api/vragenlijst/tapas-t4teens
   * Retourneert T4Teens vraaglijst als ClientInstrument-compatibel JSON.
   * Overrides uit vraag_overschrijvingen worden automatisch verwerkt.
   */
  app.get("/api/vragenlijst/tapas-t4teens", (req, res) => {
    try {
      const taal = normaliseerTaal((req.query.taal as string) ?? STANDAARD_TAAL);
      const view = buildT4TeensClientInstrument(taal);
      res.json(view);
    } catch (e) {
      console.error("[T4Teens route] Fout bij ophalen vragenlijst:", e);
      res.status(500).json({ error: "Vragenlijst tijdelijk niet beschikbaar." });
    }
  });
}
