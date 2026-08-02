// ---------------------------------------------------------------------------
// server/t4kids/scoring.ts — NIEUW BESTAND (strikt additief).
//
// Produceert DEZELFDE contract-vorm als server/scoring.ts buildGeneratorContract
// (contractVersion 1.0.0, participant/consent/sections.main met constructRows +
// familyRows + meta), maar met instrumentId "t4kids" en aggregatie over de
// T4Kids-itembank (server/t4kids/itembank.ts). Blauwdruk = t4students/scoring.ts.
//
// server/scoring.ts wordt NIET gewijzigd. ConstructRow/FamilyRow worden als type
// (read-only) geïmporteerd. De aggregatie is hier lokaal geherimplementeerd.
//
// Meetmodel (3 modules):
//  • Module 1 — Interesseparen: per keuze wint één focus (links/rechts).
//  • Module 2 — Archetypen: gekozen figuren voegen hun focus toe (secundair
//    interessesignaal) en de "waarom"-woorden + top-3 komen letterlijk in het
//    rapport (herkenning, geen interpretatie).
//  • Module 3 — Woordschaal (0..3): sterktes (versnellers) en drivers
//    (TA-drivers) + autonomie-as (intrinsiek vs extrinsiek gemotiveerd).
//
// Rapport = twee gescheiden delen (kinddeel + ouder-/coachdeel), procesgericht,
// GEEN trait-labels of eindoordeel (Columbus/Dweck). Talent zichtbaar via de
// hogere-orde Bloom-vaardigheden (analyseren/evalueren/creëren), in kindtaal.
// ---------------------------------------------------------------------------

import type { ConstructRow, FamilyRow } from "../scoring";
import {
  T4KIDS_FOCI,
  FOCUS_ACTIVITEIT,
  INTERESSE_PAAR_BY_ID,
  ARCHETYPE_BY_ID,
  STELLING_BY_ID,
  T4KIDS_STELLINGEN,
  T4KIDS_INTERESSE_PAREN,
  T4KIDS_WOORDSCHAAL,
  type Focus,
} from "./itembank";

function round2(x: number): number {
  return Number(x.toFixed(2));
}

// ── Contract-types ──────────────────────────────────────────────────────────
export interface T4KidsArchetypeKeuze {
  id: string;
  naam: string;
  focus: string;
  waarom: string;
}

export interface T4KidsRapportKind {
  titel: string;
  reiskaart: { focus: string; activiteit: string; keuzes: number }[];
  energieVan: string[]; // 2-3 sterkste interessedomeinen, activiteitentaal
  topArchetypen: { naam: string; waarom: string }[]; // met eigen woorden, letterlijk
  watMeTypeert: string[]; // karaktersterktes als gedrag ("je gaf blijk van...")
  vanzelfGing: string[]; // Bloom-HOTS in kindtaal
  verkennen: string[]; // uitnodigingen, geen adviezen
}

export interface T4KidsRapportOuder {
  methodiek: string;
  autonomieSignaal: string;
  gesprekstips: string[];
  talentVolgensBloom: string;
  nuance: string;
}

// ── Exacte antwoorden (additief) — de letterlijke keuzes van het kind ────────
// Dit veld is puur additief: het bevat GEEN nieuwe interpretatie, enkel de
// letterlijke input van het kind (keuze-teksten, waarom-woorden, gekozen woord
// uit de woordschaal). Het rapport gebruikt dit voor de "exacte antwoorden"-
// sectie én als databron voor de staafgrafieken.
export interface T4KidsExacteInteresse {
  id: string; // T4K-I-NN
  gekozenKant: "links" | "rechts";
  gekozenTekst: string; // letterlijke tekst van de gekozen kant
  andereTekst: string; // de niet-gekozen kant (context)
  focus: string; // interne focus achter de gekozen kant
}
export interface T4KidsExacteArchetype {
  id: string; // T4K-A-NN
  naam: string;
  focus: string;
  waarom: string; // letterlijke woorden van het kind
  topRang: number | null; // 1..3 als het in de top-3 zit, anders null
}
export interface T4KidsExacteStelling {
  id: string; // T4K-Z-NN
  tekst: string; // letterlijke stelling
  soort: StellingSoort;
  gekozenWaarde: number; // 0..3
  gekozenWoord: string; // "bijna nooit" | "soms" | "vaak" | "bijna altijd"
}
export interface T4KidsFocusTally {
  focus: string;
  activiteit: string;
  keuzes: number; // aantal interessekeuzes voor deze focus (alleen Eiland 1)
}
export interface T4KidsExacteAntwoorden {
  interesses: T4KidsExacteInteresse[];
  focusTally: T4KidsFocusTally[]; // interesse-only, gesorteerd hoog→laag
  archetypen: T4KidsExacteArchetype[];
  top3: { rang: number; id: string; naam: string }[];
  stellingen: T4KidsExacteStelling[];
}

type StellingSoort = (typeof T4KIDS_STELLINGEN)[number]["soort"];

export type T4KidsBalansLabel =
  | "eerder autonoom"
  | "eerder extern"
  | "in evenwicht"
  | "te weinig antwoorden";

export interface T4KidsMainMeta {
  completedInteresse: number;
  totalInteresse: number;
  gekozenArchetypen: number;
  completedStellingen: number;
  totalStellingen: number;
  autonomie: {
    // null zolang niet alle stellingen van die groep beantwoord zijn. Op deze
    // woordschaal is 0 niet het midden maar de bodem ("bijna nooit"), dus een
    // overgeslagen stelling die als 0 meetelt, verschuift het label echt.
    intrinsiek: number | null;
    extrinsiek: number | null;
    balansLabel: T4KidsBalansLabel;
  };
}

// Zelfde vorm als ConstructRow, met `beantwoord` naast `shown` en een
// gemiddelde dat null is zolang niet alle stellingen van het construct
// beantwoord zijn. Lokaal gehouden zodat de gedeelde ConstructRow ongemoeid
// blijft.
export interface T4KidsConstructRow extends Omit<ConstructRow, "avgEnergy"> {
  beantwoord: number;
  avgEnergy: number | null;
}

export interface T4KidsFamilyRow extends Omit<FamilyRow, "avgEnergy"> {
  avgEnergy: number | null;
}

export interface T4KidsContract {
  contractVersion: "1.0.0";
  instrumentId: "t4kids";
  generatedAt: string;
  taal: string;
  participant: {
    respondentCode: string;
    name: string;
    company: string | null;
    role: string | null;
  };
  consent: { given: boolean; scope: string; timestamp: string | null };
  sections: {
    main: {
      meta: T4KidsMainMeta;
      constructRows: T4KidsConstructRow[];
      familyRows: T4KidsFamilyRow[];
    };
    rapport: {
      kind: T4KidsRapportKind;
      ouder: T4KidsRapportOuder;
      exacteAntwoorden: T4KidsExacteAntwoorden;
    };
  };
}

export interface BuildT4KidsOpts {
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  // itemId -> ruwe respons (blockResponse-achtig object of getal).
  responses: Record<string, unknown>;
  // Module 2: gekozen archetypen (met "waarom") + top-3 ranking (itemIds).
  keuzes?: {
    archetypen?: { id: string; waarom?: string }[];
    top3?: string[];
  } | null;
  taal?: string | null;
}

// Leest een interesse-keuze: "links" | "rechts" | null.
function interesseKant(raw: unknown): "links" | "rechts" | null {
  if (raw && typeof raw === "object") {
    const most = (raw as Record<string, any>).most;
    if (most === "links" || most === "rechts") return most;
  }
  if (raw === "links" || raw === "rechts") return raw;
  return null;
}

// Leest een woordschaal-score 0..3 (of null).
function schaalScore(raw: unknown): number | null {
  let n: number | null = null;
  if (typeof raw === "number") n = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, any>;
    if (typeof o.blockEnergy === "number") n = o.blockEnergy;
    else if (typeof o.score === "number") n = o.score;
    else if (o.itemEnergy && typeof o.itemEnergy.most === "number") n = o.itemEnergy.most;
  }
  if (n === null || !Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 3) return 3;
  return n;
}

const voornaamVan = (naam: string) => (naam || "").trim().split(/\s+/)[0] || "jij";

export function buildT4KidsContract(opts: BuildT4KidsOpts): T4KidsContract {
  const responses = opts.responses ?? {};
  const keuzes = opts.keuzes ?? {};
  const naam = voornaamVan(opts.name);

  // ── Module 1 — interesse focus-tally ────────────────────────────────────
  const focusPicks: Record<Focus, number> = {
    "Abstraherend": 0,
    "Doelgericht-Creatief": 0,
    "Sociaal-gericht": 0,
    "Uitvoerend": 0,
    "Overdracht-gericht": 0,
    "Artistiek-Creatief": 0,
  };
  let completedInteresse = 0;
  const totalInteresse = Object.keys(INTERESSE_PAAR_BY_ID).length;
  for (const [id, paar] of Object.entries(INTERESSE_PAAR_BY_ID)) {
    const kant = interesseKant(responses[id]);
    if (!kant) continue;
    completedInteresse += 1;
    const focus = kant === "links" ? paar.links.focus : paar.rechts.focus;
    focusPicks[focus] += 1;
  }

  // ── Module 2 — gekozen archetypen (+ secundair focus-signaal) ───────────
  const archIn = Array.isArray(keuzes.archetypen) ? keuzes.archetypen : [];
  const gekozenArchetypen: T4KidsArchetypeKeuze[] = [];
  for (const keuze of archIn) {
    const a = ARCHETYPE_BY_ID[keuze.id];
    if (!a) continue;
    gekozenArchetypen.push({
      id: a.id,
      naam: a.naam,
      focus: a.focus,
      waarom: typeof keuze.waarom === "string" ? keuze.waarom.trim() : "",
    });
    focusPicks[a.focus] += 1; // secundair signaal, zelfde eenheid als picks
  }
  const top3Ids = Array.isArray(keuzes.top3) ? keuzes.top3.slice(0, 3) : [];
  const topArchetypen = top3Ids
    .map((id) => gekozenArchetypen.find((g) => g.id === id) ?? null)
    .filter((x): x is T4KidsArchetypeKeuze => x !== null);

  // ── Module 3 — sterktes + drivers + autonomie ────────────────────────
  const versnellerScores: Record<string, number[]> = {};
  const driverScores: Record<string, number[]> = {};
  const intrinsiekScores: number[] = [];
  const extrinsiekScores: number[] = [];
  let completedStellingen = 0;
  const totalStellingen = T4KIDS_STELLINGEN.length;

  // Hoeveel stellingen elk construct en elke autonomiegroep in totaal heeft.
  // Zonder dit is een overgeslagen stelling niet te onderscheiden van een
  // construct dat er gewoon minder heeft.
  const totaalPerMapping: Record<string, number> = {};
  let totaalIntrinsiek = 0;
  let totaalExtrinsiek = 0;
  for (const s of T4KIDS_STELLINGEN) {
    totaalPerMapping[s.mapping] = (totaalPerMapping[s.mapping] ?? 0) + 1;
    if (s.autonomie === "intrinsiek") totaalIntrinsiek += 1;
    else if (s.autonomie === "extrinsiek") totaalExtrinsiek += 1;
  }

  for (const s of T4KIDS_STELLINGEN) {
    const score = schaalScore(responses[s.id]);
    // Een niet beantwoorde stelling wordt overgeslagen en komt dus nergens als
    // getal in de berekening; de teller `beantwoord` legt vast dat ze ontbreekt.
    if (score === null) {
      if (s.soort === "Sterkte") versnellerScores[s.mapping] ??= [];
      else driverScores[s.mapping] ??= [];
      continue;
    }
    completedStellingen += 1;
    if (s.soort === "Sterkte") {
      (versnellerScores[s.mapping] ??= []).push(score);
    } else {
      (driverScores[s.mapping] ??= []).push(score);
      if (s.autonomie === "intrinsiek") intrinsiekScores.push(score);
      else if (s.autonomie === "extrinsiek") extrinsiekScores.push(score);
    }
  }

  const gem = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  // Een gemiddelde dat pas bestaat als alle stellingen van de groep er zijn.
  const volledigGem = (xs: number[], totaal: number): number | null =>
    totaal > 0 && xs.length >= totaal ? gem(xs) : null;

  const intrinsiek = volledigGem(intrinsiekScores, totaalIntrinsiek);
  const extrinsiek = volledigGem(extrinsiekScores, totaalExtrinsiek);
  let balansLabel: T4KidsBalansLabel;
  if (intrinsiek === null || extrinsiek === null) {
    balansLabel = "te weinig antwoorden";
  } else if (round2(intrinsiek - extrinsiek) >= 0.5) {
    balansLabel = "eerder autonoom";
  } else if (round2(extrinsiek - intrinsiek) >= 0.5) {
    balansLabel = "eerder extern";
  } else {
    balansLabel = "in evenwicht";
  }

  // ── constructRows / familyRows (zelfde vorm als buildT4StudentsContract) ─
  const constructRows: T4KidsConstructRow[] = [];
  for (const focus of T4KIDS_FOCI) {
    const n = focusPicks[focus];
    constructRows.push({
      construct: String(focus),
      family: "Interesse",
      most: n,
      least: 0,
      net: n,
      shown: totalInteresse,
      beantwoord: completedInteresse,
      avgEnergy: null,
      energySource: "keuze",
      mostItems: n > 0 ? [FOCUS_ACTIVITEIT[focus]] : [],
      toelichtingen: [],
    });
  }
  const stellingRij = (
    construct: string,
    family: "Sterkte" | "Driver",
    scores: number[],
  ): T4KidsConstructRow => {
    const totaal = totaalPerMapping[construct] ?? scores.length;
    return {
      construct,
      family,
      most: scores.filter((s) => s >= 2).length,
      least: scores.filter((s) => s <= 1).length,
      net: scores.filter((s) => s >= 2).length - scores.filter((s) => s <= 1).length,
      shown: totaal,
      beantwoord: scores.length,
      avgEnergy: volledigGem(scores, totaal),
      energySource: scores.length ? "item" : "geen",
      mostItems: [],
      toelichtingen: [],
    };
  };
  for (const [versneller, scores] of Object.entries(versnellerScores)) {
    constructRows.push(stellingRij(versneller, "Sterkte", scores));
  }
  for (const [driver, scores] of Object.entries(driverScores)) {
    constructRows.push(stellingRij(driver, "Driver", scores));
  }

  // Het totaal aantal kleurkeuzes is een telling, geen deler: nul keuzes moet
  // ook nul blijven en mag niet op 1 worden gezet.
  const totalPicks = Object.values(focusPicks).reduce((a, b) => a + b, 0);
  const alleSterkteScores = Object.values(versnellerScores).flat();
  const alleDriverScores = Object.values(driverScores).flat();
  const familyRows: T4KidsFamilyRow[] = [
    { family: "Interesse", avgEnergy: round2(totalPicks) },
    {
      family: "Sterkte",
      avgEnergy: alleSterkteScores.length ? gem(alleSterkteScores) : null,
    },
    {
      family: "Driver",
      avgEnergy: alleDriverScores.length ? gem(alleDriverScores) : null,
    },
  ];

  // ── Rapport — kinddeel ───────────────────────────────────────────────────
  const fociGesorteerd = [...T4KIDS_FOCI].sort((a, b) => focusPicks[b] - focusPicks[a]);
  const sterksteFoci = fociGesorteerd.filter((f) => focusPicks[f] > 0).slice(0, 3);

  const reiskaart = fociGesorteerd.map((f) => ({
    focus: f,
    activiteit: FOCUS_ACTIVITEIT[f],
    keuzes: focusPicks[f],
  }));
  const energieVan = sterksteFoci.map((f) => `Je koos vaak dingen waarbij je ${FOCUS_ACTIVITEIT[f]}.`);

  // Sterktes als gedrag (procesgericht, "je gaf blijk van..."), enkel de sterkste.
  const versnellerGedrag: Record<string, string> = {
    "Resultaatgericht": "je gaf blijk van veel doorzettingsvermogen — je bleef doorgaan tot iets af was",
    "Analytisch vermogen": "je liet zien dat je graag uitzoekt hoe iets werkt",
    "Groepsondersteunend": "je hielp graag mee als iemand vastzat",
    "Excelleren": "je wou dingen echt goed doen",
    "Invloedrijk": "andere kinderen luisteren vaak naar jouw idee",
    "Individu-ondersteunend": "je voelt snel aan hoe het met iemand gaat",
    "Kernenergie": "je koos graag dingen die je zelf belangrijk vindt",
  };
  const watMeTypeert = Object.entries(versnellerScores)
    .map(([v, scores]) => ({ v, avg: gem(scores) }))
    .filter((x) => x.avg >= 2 && versnellerGedrag[x.v])
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((x) => versnellerGedrag[x.v]!);

  // Bloom-HOTS in kindtaal: combineren van vaardigheden.
  const vanzelfGing: string[] = [];
  if (sterksteFoci.includes("Doelgericht-Creatief") || sterksteFoci.includes("Uitvoerend")) {
    vanzelfGing.push("Je bedacht én maakte iets én paste het aan — en dat ging vlot achter elkaar.");
  }
  if (sterksteFoci.includes("Abstraherend")) {
    vanzelfGing.push("Je onderzocht iets, vergeleek en koos wat het beste werkt — bijna vanzelf.");
  }
  if (sterksteFoci.includes("Sociaal-gericht") || sterksteFoci.includes("Overdracht-gericht")) {
    vanzelfGing.push("Je merkte op wat anderen nodig hadden en legde het uit — dat combineerde je moeiteloos.");
  }
  if (vanzelfGing.length === 0) {
    vanzelfGing.push("Bij sommige keuzes ging het bedenken, kiezen en doen vlot in elkaar over.");
  }

  const verkennen = sterksteFoci.map((f) => {
    switch (f) {
      case "Abstraherend": return "Je zou eens kunnen verkennen: raadsels, experimentjes of hoe-werkt-het-filmpjes.";
      case "Doelgericht-Creatief": return "Je zou eens kunnen verkennen: iets uitvinden, bouwen of een eigen ontwerp maken.";
      case "Sociaal-gericht": return "Je zou eens kunnen verkennen: samen een project doen of iemand helpen leren.";
      case "Uitvoerend": return "Je zou eens kunnen verkennen: koken, knutselen of iets herstellen.";
      case "Overdracht-gericht": return "Je zou eens kunnen verkennen: iets voordoen, een verhaal vertellen of uitleggen.";
      case "Artistiek-Creatief": return "Je zou eens kunnen verkennen: tekenen, muziek, dans of schrijven.";
      default: return "Je zou nog van alles kunnen verkennen — er is nog veel te ontdekken.";
    }
  });

  const kind: T4KidsRapportKind = {
    titel: `De Ontdekkingsreis van ${naam}`,
    reiskaart,
    energieVan,
    topArchetypen: topArchetypen.map((a) => ({ naam: a.naam, waarom: a.waarom })),
    watMeTypeert,
    vanzelfGing,
    verkennen,
  };

  // ── Rapport — ouder-/coachdeel ────────────────────────────────────────────
  const autonomieZin =
    balansLabel === "eerder autonoom"
      ? `De antwoorden wijzen eerder op een autonome motivatie (${naam} doet dingen vooral omdat het zelf belangrijk of leuk voelt). Gebruik dit als gespreksopener, niet als vaststelling.`
      : balansLabel === "eerder extern"
        ? `De antwoorden wijzen eerder op een externe motivatie (${naam} laat zich nu wat meer leiden door wat anderen verwachten). Een uitnodigende gespreksopener, geen oordeel.`
        : `De antwoorden tonen een evenwicht tussen autonome en externe motivatie. Een mooie gespreksopener.`;

  const ouder: T4KidsRapportOuder = {
    methodiek:
      "Dit is een exploratie, geen diagnose of studieadvies. Het instrument laat een kind spelenderwijs verkennen waar het nu energie van krijgt. Er zijn geen scores, geen goed of fout en geen etiketten.",
    autonomieSignaal: autonomieZin,
    gesprekstips: [
      `Vraag ${naam} welke keuze op Eiland 1 het leukst was en waarom.`,
      "Laat het kind zelf vertellen bij de gekozen figuren — de eigen woorden zijn belangrijker dan de interpretatie.",
      "Focus op het proces (‘hoe kwam je tot je keuze?’) in plaats van op het resultaat.",
    ],
    talentVolgensBloom:
      "Talent = het vlot, bijna vanzelf combineren van meerdere vaardigheden, waardoor iets sneller en met minder moeite lukt — vooral de hogere Bloom-niveaus (analyseren, evalueren, creëren). Dit rapport signaleert aanzetten daartoe, geen vaststaand profiel.",
    nuance:
      "Interesses en talenten zijn op deze leeftijd nog volop in ontwikkeling (Marcia/Columbus). Wat vandaag boeit, kan volgend jaar verschuiven — en dat hoort er helemaal bij.",
  };

  // ── Exacte antwoorden (additief) ─────────────────────────────────────────
  // Interessekeuzes in de gedefinieerde volgorde, met de letterlijke teksten.
  const woordVan = (w: number) =>
    T4KIDS_WOORDSCHAAL.find((x) => x.waarde === w)?.label ?? String(w);

  const interesseFocusPicks: Record<Focus, number> = {
    "Abstraherend": 0,
    "Doelgericht-Creatief": 0,
    "Sociaal-gericht": 0,
    "Uitvoerend": 0,
    "Overdracht-gericht": 0,
    "Artistiek-Creatief": 0,
  };
  const exacteInteresses: T4KidsExacteInteresse[] = [];
  for (const paar of T4KIDS_INTERESSE_PAREN) {
    const kant = interesseKant(responses[paar.id]);
    if (!kant) continue;
    const gekozen = kant === "links" ? paar.links : paar.rechts;
    const ander = kant === "links" ? paar.rechts : paar.links;
    interesseFocusPicks[gekozen.focus] += 1;
    exacteInteresses.push({
      id: paar.id,
      gekozenKant: kant,
      gekozenTekst: gekozen.tekst,
      andereTekst: ander.tekst,
      focus: gekozen.focus,
    });
  }
  const focusTally: T4KidsFocusTally[] = T4KIDS_FOCI
    .map((f) => ({ focus: f, activiteit: FOCUS_ACTIVITEIT[f], keuzes: interesseFocusPicks[f] }))
    .sort((a, b) => b.keuzes - a.keuzes);

  const topRangById = new Map<string, number>();
  top3Ids.forEach((id, i) => topRangById.set(id, i + 1));
  const exacteArchetypen: T4KidsExacteArchetype[] = gekozenArchetypen.map((a) => ({
    id: a.id,
    naam: a.naam,
    focus: a.focus,
    waarom: a.waarom,
    topRang: topRangById.get(a.id) ?? null,
  }));
  const exacteTop3 = topArchetypen.map((a, i) => ({ rang: i + 1, id: a.id, naam: a.naam }));

  const exacteStellingen: T4KidsExacteStelling[] = [];
  for (const s of T4KIDS_STELLINGEN) {
    const score = schaalScore(responses[s.id]);
    if (score === null) continue;
    exacteStellingen.push({
      id: s.id,
      tekst: s.tekst,
      soort: s.soort,
      gekozenWaarde: score,
      gekozenWoord: woordVan(score),
    });
  }

  const exacteAntwoorden: T4KidsExacteAntwoorden = {
    interesses: exacteInteresses,
    focusTally,
    archetypen: exacteArchetypen,
    top3: exacteTop3,
    stellingen: exacteStellingen,
  };

  return {
    contractVersion: "1.0.0",
    instrumentId: "t4kids",
    generatedAt: new Date().toISOString(),
    taal: opts.taal ?? "nl",
    participant: {
      respondentCode: opts.respondentCode,
      name: opts.name,
      company: opts.company ?? null,
      role: opts.role ?? null,
    },
    consent: {
      given: true,
      scope: opts.consentScope ?? "ontdekkingsreis + rapport (kind + ouder)",
      timestamp: opts.consentTimestamp ?? null,
    },
    sections: {
      main: {
        meta: {
          completedInteresse,
          totalInteresse,
          gekozenArchetypen: gekozenArchetypen.length,
          completedStellingen,
          totalStellingen,
          autonomie: { intrinsiek, extrinsiek, balansLabel },
        },
        constructRows,
        familyRows,
      },
      rapport: { kind, ouder, exacteAntwoorden },
    },
  };
}
