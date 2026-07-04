import { t4oInstrument, type Ring, type T4OItem } from "./instrument";
import type { T4ORespondentMetAntwoorden } from "./storage";
import { GROEP_NAAR_RING, type T4OGroep } from "./schema";

/**
 * TaPas 4 Organizations — scoringsmotor.
 * ------------------------------------------------------------------
 * Aggregeert de per-respondent antwoorden (verdeeld over de ringen
 * binnen/midden/buiten) tot organisatiescores: 8 collectieve vermogens,
 * 4 KPI's, spanningsvelden (leiding vs werkvloer), een congruentie-tabel
 * en 4 groeizones. Reverse-items worden hier omgedraaid (6 − score).
 * Robuust wanneer een ring ontbreekt (bv. geen buitenkring).
 */

// De 8 vermogens (volgorde = weergavevolgorde in het rapport).
export const VERMOGENS = [
  { dimensie: "identiteitscoherentie", label: "Identiteitscoherentie" },
  { dimensie: "exploitatiekracht", label: "Exploitatiekracht" },
  { dimensie: "transforming", label: "Transforming" },
  { dimensie: "sensing", label: "Sensing" },
  { dimensie: "ambidextere-integratie", label: "Ambidextere integratie" },
  { dimensie: "organisatorische-leerlus", label: "Organisatorische leerlus" },
  { dimensie: "seizing", label: "Seizing" },
  { dimensie: "exploratiekracht", label: "Exploratiekracht" },
] as const;

const CONGRUENTIE_THEMAS = [
  { gapGroup: "g_woorddaad", label: "Woord en daad" },
  { gapGroup: "g_zelfbeeld", label: "Zelfbeeld vs buitenbeeld" },
  { gapGroup: "g_luisteren", label: "Responsiviteit naar buiten" },
] as const;

const SPANNING_DREMPEL = 0.8;

export interface VermogenScore {
  dimensie: string;
  label: string;
  score: number | null; // null = geen data
  aantal: number;
}
export interface Spanningsveld {
  dimensie: string;
  label: string;
  leiding: number;
  werkvloer: number;
  verschil: number;
}
export interface CongruentieRij {
  gapGroup: string;
  label: string;
  binnen: number | null;
  midden: number | null;
  buiten: number | null;
  duiding: string;
}
export interface RoutineEnergie {
  id: string;
  prompt: string;
  saldo: number; // gemiddelde -1..+1
  aantal: number;
}
export interface T4OScores {
  aantalPerRing: Record<Ring, number>;
  aantalTotaal: number;
  vermogens: VermogenScore[];
  orgGemiddelde: number;
  kpi: { identiteit: number | null; presteren: number | null; vernieuwen: number | null; energie: number | null };
  spanningsvelden: Spanningsveld[];
  congruentie: CongruentieRij[];
  groeizones: VermogenScore[];
  routineEnergie: RoutineEnergie[];
  vitaliteit: number | null;
}

const items = t4oInstrument.items;
const itemById: Record<string, T4OItem> = Object.fromEntries(items.map((it) => [it.id, it]));

// Numerieke likert/congruentie-waarde met reverse-correctie (6 − score).
function likertWaarde(item: T4OItem, ruw: unknown): number | null {
  if (typeof ruw !== "number" || !isFinite(ruw)) return null;
  if (ruw < 1 || ruw > 5) return null;
  return item.reverse ? 6 - ruw : ruw;
}

function gemiddelde(waarden: number[]): number | null {
  if (waarden.length === 0) return null;
  return waarden.reduce((a, b) => a + b, 0) / waarden.length;
}

export function scoorOrganisatie(respondenten: T4ORespondentMetAntwoorden[]): T4OScores {
  const perRing: Record<Ring, T4ORespondentMetAntwoorden[]> = { binnen: [], midden: [], buiten: [] };
  for (const r of respondenten) {
    const ring = GROEP_NAAR_RING[r.groep as T4OGroep];
    if (ring) perRing[ring].push(r);
  }
  const aantalPerRing: Record<Ring, number> = {
    binnen: perRing.binnen.length,
    midden: perRing.midden.length,
    buiten: perRing.buiten.length,
  };

  // Verzamel alle likert/congruentie-waarden per dimensie (over alle respondenten).
  function vermogenGemiddelde(dimensie: string, bron: T4ORespondentMetAntwoorden[]): { score: number | null; aantal: number } {
    const waarden: number[] = [];
    for (const r of bron) {
      for (const [id, ruw] of Object.entries(r.antwoorden)) {
        const item = itemById[id];
        if (!item || item.dimensie !== dimensie) continue;
        if (item.itemType !== "likert" && item.itemType !== "congruence") continue;
        const w = likertWaarde(item, ruw);
        if (w != null) waarden.push(w);
      }
    }
    return { score: gemiddelde(waarden), aantal: waarden.length };
  }

  const vermogens: VermogenScore[] = VERMOGENS.map((v) => {
    const g = vermogenGemiddelde(v.dimensie, respondenten);
    return { dimensie: v.dimensie, label: v.label, score: g.score, aantal: g.aantal };
  });

  const metScore = vermogens.filter((v) => v.score != null) as (VermogenScore & { score: number })[];
  const orgGemiddelde = metScore.length ? metScore.reduce((a, v) => a + v.score, 0) / metScore.length : 0;

  // ---- 4 KPI's -------------------------------------------------------------
  const vermogenScore = (dim: string) => vermogens.find((v) => v.dimensie === dim)?.score ?? null;

  const batterijWaarden: number[] = [];
  for (const r of respondenten) {
    const b = r.antwoorden["nulmeting"];
    if (typeof b === "number" && isFinite(b)) batterijWaarden.push(b);
  }
  const kpi = {
    identiteit: vermogenScore("identiteitscoherentie"),
    presteren: vermogenScore("exploitatiekracht"),
    vernieuwen: vermogenScore("exploratiekracht"),
    energie: gemiddelde(batterijWaarden),
  };

  // ---- Spanningsvelden: leiding (binnen) vs werkvloer (midden) -------------
  const spanningsvelden: Spanningsveld[] = [];
  for (const v of VERMOGENS) {
    const l = vermogenGemiddelde(v.dimensie, perRing.binnen).score;
    const w = vermogenGemiddelde(v.dimensie, perRing.midden).score;
    if (l == null || w == null) continue;
    const verschil = Math.abs(l - w);
    if (verschil >= SPANNING_DREMPEL) {
      spanningsvelden.push({ dimensie: v.dimensie, label: v.label, leiding: l, werkvloer: w, verschil });
    }
  }
  spanningsvelden.sort((a, b) => b.verschil - a.verschil);

  // ---- Congruentie-tabel per thema (gap-group) -----------------------------
  function themaGemiddelde(gapGroup: string, bron: T4ORespondentMetAntwoorden[]): number | null {
    const waarden: number[] = [];
    for (const r of bron) {
      for (const [id, ruw] of Object.entries(r.antwoorden)) {
        const item = itemById[id];
        if (!item || item.gapGroup !== gapGroup) continue;
        const w = likertWaarde(item, ruw);
        if (w != null) waarden.push(w);
      }
    }
    return gemiddelde(waarden);
  }
  const congruentie: CongruentieRij[] = CONGRUENTIE_THEMAS.map((th) => {
    const binnen = themaGemiddelde(th.gapGroup, perRing.binnen);
    const midden = themaGemiddelde(th.gapGroup, perRing.midden);
    const buiten = themaGemiddelde(th.gapGroup, perRing.buiten);
    const aanwezig = [binnen, midden, buiten].filter((x): x is number => x != null);
    let duiding = "Onvoldoende gegevens";
    if (aanwezig.length >= 2) {
      const spreiding = Math.max(...aanwezig) - Math.min(...aanwezig);
      duiding = spreiding < 0.5 ? "Sterke congruentie" : spreiding < 1.0 ? "Lichte spanning" : "Duidelijke spanning";
    } else if (aanwezig.length === 1) {
      duiding = "Sterke congruentie";
    }
    return { gapGroup: th.gapGroup, label: th.label, binnen, midden, buiten, duiding };
  });

  // ---- 4 groeizones = 4 laagste vermogens ----------------------------------
  const groeizones = [...metScore].sort((a, b) => a.score - b.score).slice(0, 4);

  // ---- Energie per routine (ENE-items i9-i14) ------------------------------
  const routineEnergie: RoutineEnergie[] = items
    .filter((it) => it.itemType === "energy")
    .map((it) => {
      const waarden: number[] = [];
      for (const r of respondenten) {
        const ruw = r.antwoorden[it.id];
        if (typeof ruw === "number" && ruw >= -1 && ruw <= 1) waarden.push(ruw);
      }
      return { id: it.id, prompt: it.prompt.nl, saldo: gemiddelde(waarden) ?? 0, aantal: waarden.length };
    });

  // Vitaliteit = gemiddelde van de vitaliteits-likertitems (i15-i18).
  const vitItems = ["i15", "i16", "i17", "i18"];
  const vitWaarden: number[] = [];
  for (const r of respondenten) {
    for (const id of vitItems) {
      const item = itemById[id];
      const w = item ? likertWaarde(item, r.antwoorden[id]) : null;
      if (w != null) vitWaarden.push(w);
    }
  }

  return {
    aantalPerRing,
    aantalTotaal: respondenten.length,
    vermogens,
    orgGemiddelde,
    kpi,
    spanningsvelden,
    congruentie,
    groeizones,
    routineEnergie,
    vitaliteit: gemiddelde(vitWaarden),
  };
}
