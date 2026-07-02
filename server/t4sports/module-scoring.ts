// server/t4sports/module-scoring.ts
// Scoring engine voor T4Sports extra modules (M1 / M2 / M3).
// NIEUW BESTAND — raakt geen bestaande bestanden aan.
// Gebaseerd op:
//   M1: Smith et al. (1995) ACSI-28, doi: 10.1123/jsep.17.4.379
//   M2: Jackson & Eklund (2002) DFS-2/FSS-2, doi: 10.1123/jsep.24.2.133
//   M3: Brewer et al. (1993) AIMS-7

import modulesData from "../data/t4sports-modules.json";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ModuleAntwoord {
  moduleId: string;
  antwoorden: Record<string, number>; // itemNr (string) → waarde
}

export interface SchaalResultaat {
  id: string;
  naam: string;
  score: number;       // ruwe somscore
  gemiddelde: number;  // score / aantal items (1 decimaal)
  normLabel: string;
  normKleur: string;
  normOmschrijving: string;
}

export interface ModuleResultaat {
  moduleId: string;
  moduleNaam: string;
  totaalScore: number;
  maxScore: number;
  schalen: SchaalResultaat[];
  interpretatie: string;
  coachtips: string[];
  wetenschappelijkeBron: string;
  doi?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Hulpfuncties
// ────────────────────────────────────────────────────────────────────────────

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function normVoor(gemiddelde: number, normen: Record<string, any>): { label: string; kleur: string; omschrijving: string } {
  // Zoek het juiste normbereik op basis van gemiddelde * 10 (integer-vergelijking)
  const val = Math.round(gemiddelde * 10) / 10;
  for (const [, norm] of Object.entries(normen)) {
    if (val >= norm.min && val <= norm.max) {
      return { label: norm.label, kleur: norm.kleur, omschrijving: norm.omschrijving };
    }
  }
  // fallback: laagste norm
  const fallback = Object.values(normen)[0] as any;
  return { label: fallback.label, kleur: fallback.kleur, omschrijving: fallback.omschrijving };
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring M1 — ACSI-28
// ────────────────────────────────────────────────────────────────────────────

function scoreM1(antwoorden: Record<string, number>): ModuleResultaat {
  const mod = (modulesData as any).modules.M1;
  const schalen: SchaalResultaat[] = mod.schalen.map((schaal: any) => {
    const itemNrs: number[] = schaal.items;
    let som = 0;
    let n = 0;
    for (const nr of itemNrs) {
      const val = antwoorden[String(nr)];
      if (typeof val === "number") {
        som += val;
        n++;
      }
    }
    // Schaal max = 4 items × 3 = 12; min = 0
    const max = itemNrs.length * 3;
    const gem = n > 0 ? round1((som / max) * 12) : 0; // normeer naar 0–12 schaal
    const gemRaw = n > 0 ? round1(som / n) : 0;
    const normInfo = normVoor(gem, mod.normen);
    return {
      id: schaal.id,
      naam: schaal.naam,
      score: som,
      gemiddelde: gem,
      normLabel: normInfo.label,
      normKleur: normInfo.kleur,
      normOmschrijving: normInfo.omschrijving,
    };
  });

  const totaal = schalen.reduce((acc, s) => acc + s.score, 0);
  const maxScore = mod.aantalItems * 3;

  // Interpretatie op basis van gemiddeld over alle schalen
  const gemiddeldAlleSchalen = round1(schalen.reduce((a, s) => a + s.score, 0) / maxScore * 100);
  let interpretatie = "";
  const zwaksteSchalen = [...schalen].sort((a, b) => a.gemiddelde - b.gemiddelde).slice(0, 2);
  const sterksteSchalen = [...schalen].sort((a, b) => b.gemiddelde - a.gemiddelde).slice(0, 2);

  interpretatie = `De overall copingkracht scoort ${gemiddeldAlleSchalen}% van maximaal. ` +
    `Sterkste vaardigheid: ${sterksteSchalen[0].naam} (${sterksteSchalen[0].normLabel}). ` +
    `Meeste groeipotentieel: ${zwaksteSchalen[0].naam} (${zwaksteSchalen[0].normLabel}).`;

  const coachtips: string[] = [];
  for (const s of zwaksteSchalen) {
    if (s.id === "coping_adversity") coachtips.push("Train bewuste herstelrituelen na fouten: 3-adem-reset voor je verdergaat.");
    if (s.id === "peaking_pressure") coachtips.push("Simuleer druksituaties in training — routine maakt grote momenten behapbaar.");
    if (s.id === "goal_setting") coachtips.push("Werk met SMART-doelen op dagbasis: 1 doel per training, kort en concreet.");
    if (s.id === "concentration") coachtips.push("Gebruik focuswoorden of -beelden als anker voor concentratieherstel.");
    if (s.id === "freedom_worry") coachtips.push("Cognitieve herframing: train de atleet om negatieve gedachten te herformuleren.");
    if (s.id === "confidence") coachtips.push("Bouw prestatielogboek op: documenteer successen om intern referentiekader te versterken.");
    if (s.id === "coachability") coachtips.push("Bespreek feedback-verwachtingen open: creëer een veilige ruimte voor coach-atleet dialoog.");
  }

  return {
    moduleId: "M1",
    moduleNaam: mod.naam,
    totaalScore: totaal,
    maxScore,
    schalen,
    interpretatie,
    coachtips,
    wetenschappelijkeBron: mod.wetenschappelijkeBron,
    doi: mod.doi,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring M2 — DFS-2 / FSS-2
// ────────────────────────────────────────────────────────────────────────────

function scoreM2(antwoorden: Record<string, number>): ModuleResultaat {
  const mod = (modulesData as any).modules.M2;
  const schalen: SchaalResultaat[] = mod.schalen.map((schaal: any) => {
    const itemNrs: number[] = schaal.items;
    let som = 0;
    let n = 0;
    for (const nr of itemNrs) {
      const val = antwoorden[String(nr)];
      if (typeof val === "number") {
        som += val;
        n++;
      }
    }
    const gem = n > 0 ? round1(som / n) : 0; // gemiddelde per schaal (1–5)
    const normInfo = normVoor(gem, mod.normen);
    return {
      id: schaal.id,
      naam: schaal.naam,
      score: som,
      gemiddelde: gem,
      normLabel: normInfo.label,
      normKleur: normInfo.kleur,
      normOmschrijving: normInfo.omschrijving,
    };
  });

  const totaal = schalen.reduce((acc, s) => acc + s.score, 0);
  const maxScore = mod.aantalItems * 5; // max = 18 × 5 = 90

  const gemiddeldFlow = round1(totaal / mod.aantalItems); // 1–5 schaal
  const topFlow = [...schalen].sort((a, b) => b.gemiddelde - a.gemiddelde)[0];
  const zwaksteFlow = [...schalen].sort((a, b) => a.gemiddelde - b.gemiddelde)[0];

  let interpretatie = `Gemiddelde flow-score: ${gemiddeldFlow}/5. `;
  if (gemiddeldFlow >= 4) interpretatie += "Regelmatige en diepe flow-ervaring. Bescherm en activeer de condities die dit mogelijk maken.";
  else if (gemiddeldFlow >= 3) interpretatie += "Periodieke flow-ervaring. Optimaliseer de omgeving en zorg voor challenge-skill balans.";
  else interpretatie += "Flow wordt weinig ervaren. Verken welke condities de toegang tot flow belemmeren.";

  interpretatie += ` Sterkste flow-dimensie: ${topFlow.naam}. Meeste groeipotentieel: ${zwaksteFlow.naam}.`;

  const coachtips: string[] = [];
  if (zwaksteFlow.id === "challenge_skill") coachtips.push("Herijk de trainingsintensiteit: te makkelijk = saai, te moeilijk = angst. Flow leeft in de zone daartussen.");
  if (zwaksteFlow.id === "action_awareness") coachtips.push("Oefen automatisering via repetitie: hoe meer routines geautomatiseerd zijn, hoe minder bewuste aandacht nodig.");
  if (zwaksteFlow.id === "clear_goals") coachtips.push("Stel per training 1 helder processdoel: niet 'winnen' maar 'mijn eerste stap altijd explosief'.");
  if (zwaksteFlow.id === "concentration") coachtips.push("Gebruik pre-performance routines als concentratieanker. Ritme en bewegingspatronen activeren focus.");
  if (zwaksteFlow.id === "sense_control") coachtips.push("Verklein de scope: focus op wat controleerbaar is (eigen uitvoering), niet op uitkomst (score/resultaat).");
  if (zwaksteFlow.id === "autotelic") coachtips.push("Herontdek de intrinsieke motivatie: wat maakte sport ooit echt leuk? Bouw die elementen terug in.");
  if (coachtips.length === 0) coachtips.push("Flow-profiel is sterk. Documenteer de optimale condities en bescherm ze actief in trainingsplanning.");

  return {
    moduleId: "M2",
    moduleNaam: mod.naam,
    totaalScore: totaal,
    maxScore,
    schalen,
    interpretatie,
    coachtips,
    wetenschappelijkeBron: mod.wetenschappelijkeBron,
    doi: mod.doi,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring M3 — AIMS-7
// ────────────────────────────────────────────────────────────────────────────

function scoreM3(antwoorden: Record<string, number>): ModuleResultaat {
  const mod = (modulesData as any).modules.M3;
  let totaal = 0;
  let n = 0;
  for (let nr = 1; nr <= 7; nr++) {
    const val = antwoorden[String(nr)];
    if (typeof val === "number") {
      totaal += val;
      n++;
    }
  }

  const maxScore = 7 * 7; // 49
  const normen = mod.normen;

  // Bepaal normcategorie
  let normInfo = { label: "Laag", kleur: "#3498db", omschrijving: "" };
  if (totaal <= 20) normInfo = { ...normen.laag };
  else if (totaal <= 31) normInfo = { ...normen.gemiddeld };
  else if (totaal <= 42) normInfo = { ...normen.hoog };
  else normInfo = { ...normen.exclusief };

  const schalen: SchaalResultaat[] = [{
    id: "atletische_identiteit",
    naam: "Atletische Identiteit",
    score: totaal,
    gemiddelde: round1(totaal / 7),
    normLabel: normInfo.label,
    normKleur: normInfo.kleur,
    normOmschrijving: normInfo.omschrijving,
  }];

  let interpretatie = `Totaalscore: ${totaal}/49 → ${normInfo.label}. ${normInfo.omschrijving}`;

  const coachtips: string[] = [];
  if (totaal >= 43) {
    coachtips.push("Exclusieve identiteit: werk proactief aan loopbaantransitie. Bouw niet-sportgebonden identiteitsankers.");
    coachtips.push("Blessure-protocol: stel nu al een mentale herstelstrategie op voor wanneer sport tijdelijk niet mogelijk is.");
    coachtips.push("Verbreed het zelfconcept: welke andere rollen (vriend, student, professional) geven ook betekenis?");
  } else if (totaal >= 32) {
    coachtips.push("Sterke identiteit: kracht voor prestatie. Benoem expliciet dat atleet-zijn meer is dan alleen sportresultaten.");
    coachtips.push("Verken loopbaanperspectief: wie wil je zijn als dit hoofdstuk afsluit?");
  } else if (totaal <= 20) {
    coachtips.push("Lage identiteit: verken intrinsieke motivatiebronnen. Wat trekt de atleet echt aan in de sport?");
    coachtips.push("Overweeg identiteitsverankering: help de atleet zich bewust te worden van zijn/haar kwaliteiten als sporter.");
  }

  return {
    moduleId: "M3",
    moduleNaam: mod.naam,
    totaalScore: totaal,
    maxScore,
    schalen,
    interpretatie,
    coachtips,
    wetenschappelijkeBron: mod.wetenschappelijkeBron,
    doi: undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Publieke API
// ────────────────────────────────────────────────────────────────────────────

export function scoreModule(moduleAntwoord: ModuleAntwoord): ModuleResultaat {
  switch (moduleAntwoord.moduleId) {
    case "M1": return scoreM1(moduleAntwoord.antwoorden);
    case "M2": return scoreM2(moduleAntwoord.antwoorden);
    case "M3": return scoreM3(moduleAntwoord.antwoorden);
    default: throw new Error(`Onbekende module: ${moduleAntwoord.moduleId}`);
  }
}

export function getModuleDefinitie(moduleId: string): any {
  const mod = (modulesData as any).modules[moduleId];
  if (!mod) throw new Error(`Module ${moduleId} niet gevonden`);
  return mod;
}

export function getAlleModuleIds(): string[] {
  return Object.keys((modulesData as any).modules);
}
