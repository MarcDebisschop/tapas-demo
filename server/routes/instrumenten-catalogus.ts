/**
 * server/routes/instrumenten-catalogus.ts
 *
 * Verrijkte instrumentencatalogus voor demo-bezoekers en admin-overzicht.
 * Geeft een leesbaar overzicht van alle 16 TaPas-instrumenten met
 * doelgroep, use case, outcome en credits.
 *
 * Routes:
 *   GET /api/instrumenten/catalogus       — volledige catalogus (alle instrumenten)
 *   GET /api/instrumenten/catalogus/:id   — detail voor één instrument
 */

import type { Express } from "express";
import { instrumentSamenvattingen, publiekeInstrumenten } from "../registry";
import { T4TEENS_LEEFTIJDSTEKST } from "@shared/doelgroep-leeftijd";

// Statische verrijking: beschrijving, doelgroep, use case en outcome per instrument.
// Keys = instrumentId uit de registry.
const VERRIJKING: Record<string, {
  doelgroep: string;
  useCases: string[];
  outcome: string;
  rapport: string;
  emoji: string;
}> = {
  // Standaard individueel instrument (T4P Business Kompas)
  // Het instrumentId wordt dynamisch opgehaald uit de registry via het
  // standaard-instrument — we voegen een alias toe voor de vaste ID.
  "t4p-business": {
    doelgroep: "Professionals, leidinggevenden, coaches",
    useCases: [
      "Talentprofiel bij loopbaancoaching",
      "Selectie en onboarding in HR",
      "Leiderschapsontwikkeling",
      "Team-samenstelling en rolverdeling",
    ],
    outcome:
      "Een volledig TaPas Kompas: talent-foci, talent-versnellers, drivers en energieprofiel. Inclusief TaPas Jester-classificatie en optionele Coachatlas.",
    rapport: "TaPas Kompas PDF + online dashboard",
    emoji: "🧭",
  },
  "t4recruitment": {
    doelgroep: "Recruiters, hiring managers, selectiepanels",
    useCases: [
      "Rolprofiel opstellen via stakeholder-kring",
      "Kandidatenvergelijking op talentniveau",
      "Fit-analyse: kandidaat vs. rolprofiel",
      "Objectiveren van selectiegesprekken",
    ],
    outcome:
      "Een rolprofiel gebouwd via consensusproces met de hiring-kring, plus een fit-score per kandidaat. Vergelijkingsrapport met visuele match-analyse.",
    rapport: "Rolprofiel PDF + fit-rapport per kandidaat",
    emoji: "🎯",
  },
  "tapas-teamscan": {
    doelgroep: "Teams, afdelingsmanagers, teamcoaches",
    useCases: [
      "Teamdynamieken in kaart brengen",
      "Lencioni-disfuncties herkennen en adresseren",
      "Teamontwikkeling na fusie of reorganisatie",
      "Facilitatie van teamgesprekken",
    ],
    outcome:
      "Collectief teamrapport: sterktes, spanningsvelden en concrete actiepunten. Inclusief facilitatiegids voor de teamcoach.",
    rapport: "Teamrapport PDF + facilitatiegids",
    emoji: "🫂",
  },
  "hdd": {
    doelgroep: "Boards, directieteams, executive coaches",
    useCases: [
      "Due diligence bij leiderschapswissels",
      "Strategische teamcomposities evalueren",
      "Board-dynamieken objectiveren",
      "Pre-merger talent mapping",
    ],
    outcome:
      "Gefaseerd vlaggenschip-traject (Teamscan + 2MinScan per boardlid) met bestuurlijk talentrapport en aanbevelingen voor governance-inrichting.",
    rapport: "Executive rapport + boardpresentatie",
    emoji: "🏛️",
  },
  // T4O: organisatiescan in drie ringen (collaboratief)
  "t4o": {
    doelgroep: "Organisaties, directieteams, organisatiecoaches en -adviseurs",
    useCases: [
      "De identiteit en het vermogen van een organisatie bespreekbaar maken",
      "Spanningsvelden tussen leiding, medewerkers en buitenwereld zichtbaar maken",
      "Nulmeting van de energie in de organisatie",
      "Gerichte organisatieontwikkeling sturen",
    ],
    outcome:
      "Een organisatierapport met identiteitskern, energie- en vermogensprofiel, spanningsvelden tussen de drie ringen en concrete ontwikkelaanbevelingen.",
    rapport: "T4O Organisatierapport (HTML en PDF)",
    emoji: "🏢",
  },
  "impact-roos": {
    doelgroep: "360°-feedback trajecten, teamleiders, HR",
    useCases: [
      "360°-feedback visualiseren als rozendiagram",
      "Zelfperceptie vs. omgevingsperceptie",
      "Ontwikkelgesprekken met visueel ankerpunt",
      "Groeps-benchmarking",
    ],
    outcome:
      "Visueel impactrapport: een SVG-roos die per dimensie zelfscores en omgevingsscores vergelijkt. Batch-tarifering (10 rozen = 5 credits).",
    rapport: "Impact-roos SVG + PDF-rapport",
    emoji: "🌹",
  },
  "t4teens": {
    doelgroep: `Jongeren ${T4TEENS_LEEFTIJDSTEKST}, CLB-begeleiders, schoolcoaches`,
    useCases: [
      "Studiekeuze-begeleiding",
      "Talentherkenning in het secundair onderwijs",
      "Preventie van studiedropout",
      "Ouder-kind gesprekken over richting",
    ],
    outcome:
      "Leeftijdsspecifiek talentprofiel in toegankelijke taal. Inclusief studierichtingssuggesties op basis van talent-foci.",
    rapport: "T4Teens talentkaart + studiegids",
    emoji: "🎒",
  },
  "t4kids": {
    doelgroep: "Kinderen 10-13 jaar, ouders, CLB & lagere-schoolteams",
    useCases: [
      "Talentontdekking einde lagere school",
      "Voorbereiding studiekeuze secundair",
      "Ouder-kind gesprek over interesses",
      "Zelfvertrouwen & zelfkennis",
    ],
    outcome:
      "Kindvriendelijk, procesgericht talentbeeld in 'nu'-taal, met apart ouder-/coachdeel. Geen etiket, wel richting.",
    rapport: "T4Kids Ontdekkingsreis-rapport (kinddeel + ouderdeel)",
    emoji: "🧭",
  },
  "t4students": {
    doelgroep: "Studenten hoger onderwijs, studentenbegeleiders",
    useCases: [
      "Studierichtingsbevestiging of -bijsturing",
      "Voorbereiding op stagezoekproces",
      "Eerste loopbaanoriëntatie",
      "Persoonlijke ontwikkeling in studentencoaching",
    ],
    outcome:
      "Talentprofiel afgestemd op de overgang studie-arbeidsmarkt. Inclusief jobdomein-mapping en eerste LinkedIn-formulering.",
    rapport: "T4Students talentpaspoort + jobdomein-gids",
    emoji: "🎓",
  },
  // T4Sports — Mental Talent Profiel voor atleten
  "t4sports": {
    doelgroep: "Topsporters, mental coaches, sportpsychologen",
    useCases: [
      "Mentaal talentprofiel voor elite-atleten",
      "Driver-analyse onder prestatiedruk",
      "Talent-Route en foci in sporttaal",
      "Modules: Resilience (M1), Flow-State (M2), Atletische Identiteit (M3)",
    ],
    outcome:
      "Volledig T4Sports Mental Talent Profiel: talent-toegang, talent-route, drivers, energiestaat. Optionele modules M1/M2/M3.",
    rapport: "T4Sports Profiel PDF (Deel 1 + Deel 2) + online dashboard",
    emoji: "🏆",
  },
  // 2MinScan — energetisch gedragsprofiel (individueel)
  "twominscan": {
    doelgroep: "Professionals die hun energetisch gedragsprofiel in een werkcontext willen kennen",
    useCases: [
      "Energetisch gedragsprofiel in een professionele context",
      "Inzicht in waar de professionele energie zit en hoe ze zich vertaalt naar gedrag",
      "Verdiepend vertrekpunt voor een coachtraject",
      "Meertalige afname en rapportage binnen één team",
    ],
    outcome:
      "Energetisch gedragsprofiel in professionele context: een uitgewerkt 15-pagina \"Energetisch Gedragsprofiel\"-rapport in 5 talen (NL/FR/EN/ES/RU).",
    rapport: "Energetisch Gedragsprofiel PDF (15 pagina's, 5 talen)",
    emoji: "⚡",
  },
  // Driver-scan — 5 Kahler-drivers via forced-choice (individueel)
  "driverscan": {
    doelgroep: "Professionals en coaches die de onbewuste drivers achter gedrag willen kennen",
    useCases: [
      "De volgorde van de 5 Kahler-drivers in beeld brengen",
      "Zien welke driver het sterkst 'aan het stuur' zit onder druk",
      "Begrijpen wanneer eenzelfde driver een rem óf een gaspedaal wordt",
      "Kort, visueel gespreksvertrekpunt vóór een coachtraject",
    ],
    outcome:
      "Gerangschikte driver-volgorde (net-score + energie per driver) met per driver de rem/gaspedaal-duiding, afhankelijk van de context. Meet via exact dezelfde forced-choice blokken als T4P Business.",
    rapport: "Kort visueel Driver-scan PDF (1–2 pagina's, forced-choice, 5 talen)",
    emoji: "🎚️",
  },
  // STM — Self-Training Module (voor coaches)
  "stm": {
    doelgroep: "TaPas-coaches in accreditatietraject",
    useCases: [
      "Zelfgestuurd leren van het TaPas-gedachtegoed",
      "Oefenen met profielinterpretatie",
      "Voorbereiding op accreditatietoets",
      "Bijscholing na accreditatie",
    ],
    outcome:
      "Persoonlijk leertraject met voortgangsregistratie. Toegang tot casussen, quizzen en oefenprofielen. Geblokkeerd tot accreditatieaanvraag goedgekeurd is.",
    rapport: "Voortgangsrapport coach-platform",
    emoji: "📚",
  },
};

// Normaliseer de instrument-ID om de statische verrijking te vinden.
// De registry gebruikt soms licht afwijkende IDs t.o.v. de verrijkingstabel.
function vindVerrijking(id: string) {
  if (VERRIJKING[id]) return VERRIJKING[id];
  // Aliassen
  if (id.includes("business") || id === "tapas" || id === "t4p") return VERRIJKING["t4p-business"];
  if (id.includes("driverscan") || id.includes("driver-scan")) return VERRIJKING["driverscan"];
  if (id.includes("2min") || id.includes("twominscan")) return VERRIJKING["twominscan"];
  if (id.includes("stm") || id.includes("self")) return VERRIJKING["stm"];
  if (id.includes("t4sports") || id.includes("sports")) return VERRIJKING["t4sports"];
  return null;
}

export function registerInstrumentenCatalogusRoutes(app: Express): void {
  // C-1 (audit) — De catalogus is nu volledig een afgeleide van de registry.
  // Vroeger stond hier een handmatige extra-lijst (2MinScan en de Self-Training
  // Module) en een filter op de naam "driverscan". Beide zijn weg: de registry
  // bepaalt met de vlag `publiekZichtbaar` wat in het aanbod hoort. Eén nieuw
  // instrument inschrijven in de registry volstaat vanaf nu.
  app.get("/api/instrumenten/catalogus", (_req, res) => {
    const catalogus = publiekeInstrumenten().map((inst) => {
      const verr = vindVerrijking(inst.instrumentId);
      return {
        id: inst.instrumentId,
        naam: inst.name,
        flowType: inst.flowType,
        beschrijving: inst.description,
        creditCost: inst.creditCost ?? null,
        doelgroep: verr?.doelgroep ?? null,
        useCases: verr?.useCases ?? [],
        outcome: verr?.outcome ?? null,
        rapport: verr?.rapport ?? null,
        emoji: verr?.emoji ?? "\u{1F537}",
      };
    });
    res.json(catalogus);
  });

  app.get("/api/instrumenten/catalogus/:id", (req, res) => {
    const id = req.params.id;
    const basis = instrumentSamenvattingen();
    const inst = basis.find((i) => i.instrumentId === id);
    const verr = vindVerrijking(id);

    if (!inst && !verr) {
      return res.status(404).json({ error: "Instrument niet gevonden" });
    }

    res.json({
      id,
      naam: inst?.name ?? id,
      flowType: inst?.flowType ?? "individual",
      beschrijving: inst?.description ?? null,
      creditCost: inst?.creditCost ?? null,
      doelgroep: verr?.doelgroep ?? null,
      useCases: verr?.useCases ?? [],
      outcome: verr?.outcome ?? null,
      rapport: verr?.rapport ?? null,
      emoji: verr?.emoji ?? "🔷",
    });
  });
}
