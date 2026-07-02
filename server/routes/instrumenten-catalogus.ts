/**
 * server/routes/instrumenten-catalogus.ts
 *
 * Verrijkte instrumentencatalogus voor demo-bezoekers en admin-overzicht.
 * Geeft een leesbaar overzicht van alle 10 TaPas-instrumenten met
 * doelgroep, use case, outcome en credits.
 *
 * Routes:
 *   GET /api/instrumenten/catalogus       — volledige catalogus (alle instrumenten)
 *   GET /api/instrumenten/catalogus/:id   — detail voor één instrument
 */

import type { Express } from "express";
import { instrumentSamenvattingen } from "../registry";

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
    doelgroep: "Jongeren 14-18 jaar, CLB-begeleiders, schoolcoaches",
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
  // 2MinScan — het snelle energieprofiel (individueel)
  "twominscan": {
    doelgroep: "Iedereen — als instap of aanvulling op een volledig profiel",
    useCases: [
      "Snelle energiescan vóór een coachgesprek",
      "Teamcheck: wie is op dit moment in zijn kracht?",
      "Onboarding-tool bij nieuwe medewerkers",
      "Zelfcheck voor drukke periodes",
    ],
    outcome:
      "2-minuten energieprofiel: één visuele score die aangeeft waar de professionele energie nu zit. Geen uitgebreide rapportage — ideaal als instap.",
    rapport: "Energiekaart (inline, geen PDF)",
    emoji: "⚡",
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
  if (id.includes("2min") || id.includes("twominscan")) return VERRIJKING["twominscan"];
  if (id.includes("stm") || id.includes("self")) return VERRIJKING["stm"];
  if (id.includes("t4sports") || id.includes("sports")) return VERRIJKING["t4sports"];
  return null;
}

export function registerInstrumentenCatalogusRoutes(app: Express): void {
  app.get("/api/instrumenten/catalogus", (_req, res) => {
    const basis = instrumentSamenvattingen();
    const catalogus = basis.map((inst) => {
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
        emoji: verr?.emoji ?? "🔷",
      };
    });

    // Voeg instrumenten toe die niet in de registry zitten maar wel bestaan
    // (STM en 2MinScan zijn soms collaborative/journey en verschijnen niet altijd).
    const ids = catalogus.map((c) => c.id);
    const extra = [
      {
        id: "twominscan",
        naam: "2MinScan",
        flowType: "individual" as const,
        beschrijving: "Snelle 2-minuten energiescan.",
        creditCost: 0,
        ...VERRIJKING["twominscan"],
      },
      {
        id: "stm",
        naam: "Self-Training Module",
        flowType: "individual" as const,
        beschrijving: "Zelfstudie-platform voor coaches in accreditatietraject.",
        creditCost: 0,
        ...VERRIJKING["stm"],
      },
    ].filter((e) => !ids.includes(e.id));

    res.json([...catalogus, ...extra]);
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
