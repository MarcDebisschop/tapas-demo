// ---------------------------------------------------------------------------
// server/role-fit/hbom-engine.ts
//
// H-BOM Evidence Check, deterministische hypothesenselectie (regelversie
// RF_HBOM_REGELVERSIE).
//
// Prioriteit = kriticiteit x onzekerheid x observeerbaarheid, elk op een schaal
// van 1 tot 3. Gates komen niet in de hypothesenpool: die gaan naar een
// aparte verificatielijst (technisch bewijs of referentie).
//
// De motor maakt voorstellen. Een mens keurt de selectie goed voordat er
// oefeningen en observatoropdrachten ontstaan.
// ---------------------------------------------------------------------------
import {
  DIMENSIE_PER_ID,
  METHODE_LABEL,
  RF_HBOM_REGELVERSIE,
  type Confidence,
  type FitIndicatie,
  type Kriticiteit,
  type Methode,
  type NiveauHml,
  type Pakket,
} from "@shared/role-fit";

export const POOL_MIN = 6;
export const POOL_MAX = 10;
export const PAKKET_AANTAL: Record<Pakket, { min: number; max: number }> = {
  light: { min: 3, max: 3 },
  standard: { min: 4, max: 6 },
};

const KRIT_GEWICHT: Record<Exclude<Kriticiteit, "gate">, number> = { critical: 3, important: 2, supporting: 1 };
const OBS_GEWICHT: Record<NiveauHml, number> = { high: 3, medium: 2, low: 1 };
const ONZEKERHEID_BASIS: Record<FitIndicatie, number> = {
  strong_support: 1,
  likely_support: 2,
  mixed: 3,
  likely_friction: 2,
  not_assessable: 3,
};

export interface FitItemVoorHbom {
  id: number;
  requirementId: number;
  indicatie: FitIndicatie;
  confidence: Confidence;
  kriticiteit: Kriticiteit;
  gate: boolean;
  dimensie: string;
  vereiste: string;
  bronClaimIds: number[];
  profielClaimCodes: string[];
}

export interface HypotheseVoorstel {
  fitItemId: number;
  requirementId: number;
  dimensie: string;
  stelling: string;
  tegenhypothese: string;
  bronClaimIds: number[];
  profielClaimCodes: string[];
  kriticiteit: Exclude<Kriticiteit, "gate">;
  onzekerheid: number;
  observeerbaarheid: NiveauHml;
  prioriteit: number;
  methode: Methode;
  bevestigendeIndicatoren: string[];
  tegenIndicatoren: string[];
  alternatieveVerklaringen: string[];
  verbodenInferentie: string;
  rang: number;
  regelversie: string;
}

export interface GateVerificatie {
  requirementId: number;
  vereiste: string;
  route: "technisch_bewijs_of_referentie";
}

export interface HbomVoorstel {
  pool: HypotheseVoorstel[];
  gates: GateVerificatie[];
  waarschuwingen: string[];
  regelversie: string;
}

export function onzekerheidVoor(indicatie: FitIndicatie, confidence: Confidence): number {
  const basis = ONZEKERHEID_BASIS[indicatie];
  return Math.min(3, basis + (confidence === "low" ? 1 : 0));
}

export const VERBODEN_INFERENTIE =
  "Een lage of ontbrekende observatie toont enkel dat het bewijs binnen deze oefening beperkt bleef. Er mag geen besluit over afwezig talent, intentie of persoonlijkheid uit volgen.";

export function stelHbomVoor(items: FitItemVoorHbom[]): HbomVoorstel {
  const gates: GateVerificatie[] = [];
  const kandidaten: Omit<HypotheseVoorstel, "rang">[] = [];

  for (const it of items) {
    if (it.gate || it.kriticiteit === "gate") {
      gates.push({ requirementId: it.requirementId, vereiste: it.vereiste, route: "technisch_bewijs_of_referentie" });
      continue;
    }
    const dim = DIMENSIE_PER_ID[it.dimensie];
    if (!dim) continue;
    const krit = it.kriticiteit as Exclude<Kriticiteit, "gate">;
    const onzekerheid = onzekerheidVoor(it.indicatie, it.confidence);
    const prioriteit = KRIT_GEWICHT[krit] * onzekerheid * OBS_GEWICHT[dim.observeerbaarheid];
    kandidaten.push({
      fitItemId: it.id,
      requirementId: it.requirementId,
      dimensie: dim.id,
      stelling: `In situaties die deze rol vraagt, wordt ${dim.gedrag} zichtbaar (vereiste: ${it.vereiste}).`,
      tegenhypothese: `In situaties die deze rol vraagt, blijft ${dim.gedrag} beperkt zichtbaar of vraagt het uitzonderlijk veel energie.`,
      bronClaimIds: it.bronClaimIds,
      profielClaimCodes: it.profielClaimCodes,
      kriticiteit: krit,
      onzekerheid,
      observeerbaarheid: dim.observeerbaarheid,
      prioriteit,
      methode: dim.standaardMethode,
      bevestigendeIndicatoren: dim.bevestigend,
      tegenIndicatoren: dim.tegen,
      alternatieveVerklaringen: dim.alternatief,
      verbodenInferentie: VERBODEN_INFERENTIE,
      regelversie: RF_HBOM_REGELVERSIE,
    });
  }

  // Hoogste prioriteit eerst; bij gelijke prioriteit de hogere kriticiteit,
  // daarna de vereiste die eerst werd vastgelegd. Volledig deterministisch.
  kandidaten.sort(
    (a, b) =>
      b.prioriteit - a.prioriteit ||
      KRIT_GEWICHT[b.kriticiteit] - KRIT_GEWICHT[a.kriticiteit] ||
      a.requirementId - b.requirementId,
  );
  const pool = kandidaten.slice(0, POOL_MAX).map((k, i) => ({ ...k, rang: i + 1 }));
  const waarschuwingen: string[] = [];
  if (pool.length < 3) waarschuwingen.push("Minder dan drie observeerbare hypothesen: leg eerst meer vereisten vast.");
  else if (pool.length < POOL_MIN)
    waarschuwingen.push(`De pool telt ${pool.length} hypothesen; aanbevolen is minstens ${POOL_MIN}.`);
  return { pool, gates, waarschuwingen, regelversie: RF_HBOM_REGELVERSIE };
}

/** Standaardselectie per pakket: de hoogst gerangschikte hypothesen. */
export function standaardSelectie(pool: Array<{ rang: number }>, pakket: Pakket, aantal?: number): number[] {
  const grens = PAKKET_AANTAL[pakket];
  const n = Math.max(grens.min, Math.min(grens.max, aantal ?? grens.max));
  return pool
    .slice()
    .sort((a, b) => a.rang - b.rang)
    .slice(0, n)
    .map((h) => h.rang);
}

export function toetsSelectieAantal(pakket: Pakket, aantal: number): string | null {
  const g = PAKKET_AANTAL[pakket];
  const naam = pakket === "light" ? "Light" : "Standard";
  if (aantal < g.min || aantal > g.max)
    return g.min === g.max
      ? `Het pakket ${naam} vraagt precies ${g.min} hypothesen.`
      : `Het pakket ${naam} vraagt ${g.min} tot ${g.max} hypothesen.`;
  return null;
}

export interface OefeningVoorstel {
  methode: Methode;
  titel: string;
  instructie: string;
  probes: string[];
  ankers: { "1": string; "3": string; "5": string; onvoldoende: string };
}

/**
 * Een oefening per hypothese. De observator ziet de oefening en de ankers,
 * maar nooit de hypothese, de verwachte richting of het profielsignaal.
 */
export function maakOefening(dimensieId: string, functieTitel: string): OefeningVoorstel {
  const dim = DIMENSIE_PER_ID[dimensieId];
  const methode = dim.standaardMethode;
  const instructies: Record<Methode, string> = {
    structured_evidence_interview: `Vraag naar een recente, concrete situatie uit het eigen werk waarin ${dim.gedrag} nodig was. Vraag door naar context, eigen handeling en effect. Noteer letterlijke citaten.`,
    scenario_probe: `Leg een korte situatie voor die typisch is voor de rol ${functieTitel} en waarin ${dim.gedrag} nodig is. Vraag hoe de persoon concreet zou handelen en laat de eerste stappen uitspreken. Noteer wat letterlijk gezegd wordt.`,
    mini_work_sample: `Geef een korte opdracht van ongeveer tien minuten uit de werkelijkheid van de rol ${functieTitel}, waarin ${dim.gedrag} nodig is. Observeer werkwijze en resultaat en noteer concreet wat gebeurt.`,
  };
  const probes: Record<Methode, string[]> = {
    structured_evidence_interview: [
      "Wat was de situatie en wat werd er van jou verwacht?",
      "Wat deed je zelf, stap voor stap?",
      "Wat was het effect, en hoe weet je dat?",
    ],
    scenario_probe: [
      "Wat doe je als eerste, en waarom?",
      "Wat doe je wanneer de ander anders reageert dan verwacht?",
      "Hoe weet je achteraf of je aanpak werkte?",
    ],
    mini_work_sample: [
      "Licht toe hoe je de opdracht aangepakt hebt.",
      "Welke keuze heb je bewust gemaakt, en welke bewust niet?",
      "Wat zou je met meer tijd anders doen?",
    ],
  };
  return {
    methode,
    titel: `${METHODE_LABEL[methode]}: ${dim.label}`,
    instructie: instructies[methode],
    probes: probes[methode],
    ankers: {
      "1": dim.anker1,
      "3": dim.anker3,
      "5": dim.anker5,
      onvoldoende: "Onvoldoende observatiekans: de oefening bood geen gelegenheid om dit gedrag te zien.",
    },
  };
}
