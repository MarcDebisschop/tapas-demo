// ---------------------------------------------------------------------------
// server/role-fit/fit-engine.ts
//
// Deterministische fit-motor (regelversie RF_FIT_REGELVERSIE). Zet per actieve
// vereiste het profielsignaal uit het T4P Business Kompas naast de bevestigde
// rolcontext en geeft een ordinale fit-indicatie, een betrouwbaarheid, een
// ontwikkelafstand en een uitleg terug.
//
// WAT DE MOTOR NIET DOET
// - Hij telt niets op tot een totaalscore of percentage.
// - Hij beoordeelt geen gate: een knock-out wordt nooit uit een profiel
//   afgeleid, enkel uit technisch bewijs of een referentie.
// - Hij vult geen ontbrekende waarde in. Een onvolledig construct geeft
//   "niet beoordeelbaar", lage betrouwbaarheid en een onbekende afstand.
// - Hij kent nooit een hoge betrouwbaarheid toe: dat kan pas na observatie.
// ---------------------------------------------------------------------------
import {
  DIMENSIE_PER_ID,
  GATE_DIMENSIE,
  RF_FIT_REGELVERSIE,
  type Confidence,
  type FitIndicatie,
  type FitType,
  type Kriticiteit,
  type Ontwikkelafstand,
} from "@shared/role-fit";

export interface VereisteInvoer {
  id: number;
  dimensie: string;
  fitType: FitType;
  vereiste: string;
  niveau: string;
  kriticiteit: Kriticiteit;
  bronClaimIds: number[];
}

export interface ProfielClaimInvoer {
  claimCode: string;
  construct: string;
  net: number | null;
  gemEnergie: number | null;
  energieStatus: "geeft" | "neutraal" | "kost" | null;
  volledig: boolean;
}

export interface ContextClaimInvoer {
  id: number;
  sourceId: number | null;
  status: string;
}

export interface FitItemUitkomst {
  requirementId: number;
  fitType: FitType;
  indicatie: FitIndicatie;
  confidence: Confidence;
  kriticiteit: Kriticiteit;
  ontwikkelafstand: Ontwikkelafstand;
  energie: "geeft" | "neutraal" | "kost" | null;
  gate: boolean;
  construct: string | null;
  net: number | null;
  profielClaimCodes: string[];
  contextClaimIds: number[];
  uitleg: string[];
  alternatieveVerklaringen: string[];
  onbekenden: string[];
  verificatievragen: string[];
  regelversie: string;
}

export const NET_STERK = 3;

type NetKlasse = "hoog" | "midden" | "laag";
export function netKlasse(net: number): NetKlasse {
  if (net >= NET_STERK) return "hoog";
  if (net >= 0) return "midden";
  return "laag";
}

const NET_KLASSE_TEKST: Record<NetKlasse, string> = {
  hoog: "duidelijk aanwezig",
  midden: "aanwezig",
  laag: "weinig aanwezig",
};
const ENERGIE_TEKST = {
  geeft: "met energie die het oplevert",
  neutraal: "met neutrale energie",
  kost: "met energie die het kost",
} as const;

/** Regel voor talentdimensies (vraag van de rol en beschikbare energie/talent). */
export function talentIndicatie(net: number, energie: "geeft" | "neutraal" | "kost"): FitIndicatie {
  const k = netKlasse(net);
  if (k === "hoog") return energie === "geeft" ? "strong_support" : energie === "neutraal" ? "likely_support" : "mixed";
  if (k === "midden") return energie === "geeft" ? "likely_support" : energie === "neutraal" ? "mixed" : "likely_friction";
  return energie === "geeft" ? "mixed" : "likely_friction";
}

/**
 * Regel voor drivers (behoeften en wat de omgeving biedt). Een driver die
 * duidelijk aanwezig is en energie kost, geeft frictie wanneer de rol er veel
 * beroep op doet; aanwezig met energie die het oplevert, geeft waarschijnlijk
 * ondersteuning. Weinig aanwezig betekent dat de omgeving iets vraagt wat in
 * het profiel weinig zichtbaar is: gemengd, te verkennen.
 */
export function driverIndicatie(net: number, energie: "geeft" | "neutraal" | "kost"): FitIndicatie {
  const k = netKlasse(net);
  if (k === "hoog") return energie === "kost" ? "likely_friction" : energie === "geeft" ? "likely_support" : "mixed";
  if (k === "midden") return energie === "geeft" ? "likely_support" : energie === "kost" ? "likely_friction" : "mixed";
  return "mixed";
}

export function afstandVoor(indicatie: FitIndicatie): Ontwikkelafstand {
  switch (indicatie) {
    case "strong_support":
    case "likely_support":
      return "short";
    case "mixed":
      return "medium";
    case "likely_friction":
      return "long";
    default:
      return "unknown";
  }
}

/**
 * Betrouwbaarheid voor dossier 1. Profiel alleen: laag. Midden wanneer de
 * vereiste steunt op minstens twee bevestigde contextclaims uit minstens twee
 * verschillende bronnen. Hoog is hier nooit mogelijk.
 */
export function profielConfidence(
  volledig: boolean,
  bronClaimIds: number[],
  claims: Map<number, ContextClaimInvoer>,
): Confidence {
  if (!volledig) return "low";
  const bevestigd = bronClaimIds.map((id) => claims.get(id)).filter((c) => c && c.status === "approved") as ContextClaimInvoer[];
  const bronnen = new Set(bevestigd.map((c) => c.sourceId ?? -c.id));
  return bevestigd.length >= 2 && bronnen.size >= 2 ? "medium" : "low";
}

export function berekenFitItems(
  vereisten: VereisteInvoer[],
  profielClaims: ProfielClaimInvoer[],
  contextClaims: ContextClaimInvoer[],
): FitItemUitkomst[] {
  const perConstruct = new Map(profielClaims.map((c) => [c.construct, c]));
  const claimMap = new Map(contextClaims.map((c) => [c.id, c]));
  const uit: FitItemUitkomst[] = [];

  for (const v of vereisten) {
    const bevestigdeContext = v.bronClaimIds.filter((id) => claimMap.get(id)?.status === "approved");
    const basis = {
      requirementId: v.id,
      fitType: v.fitType,
      kriticiteit: v.kriticiteit,
      contextClaimIds: bevestigdeContext,
      regelversie: RF_FIT_REGELVERSIE,
    };

    if (v.kriticiteit === "gate" || v.dimensie === GATE_DIMENSIE) {
      uit.push({
        ...basis,
        indicatie: "not_assessable",
        confidence: "low",
        ontwikkelafstand: "unknown",
        energie: null,
        gate: true,
        construct: null,
        net: null,
        profielClaimCodes: [],
        uitleg: [
          "Dit is een niet-compenseerbare gate. Een profiel beoordeelt een gate niet.",
          "De gate wordt apart geverifieerd met technisch bewijs of een referentie.",
        ],
        alternatieveVerklaringen: [],
        onbekenden: ["Status van de gate tot verificatie"],
        verificatievragen: [`Welk document of welke referentie toont aan dat voldaan is aan: ${v.vereiste}?`],
      });
      continue;
    }

    const dim = DIMENSIE_PER_ID[v.dimensie];
    const construct = dim?.constructen[0] ?? null;
    const pc = construct ? perConstruct.get(construct) : undefined;

    if (!dim || !pc || !pc.volledig || pc.net === null || pc.energieStatus === null) {
      uit.push({
        ...basis,
        indicatie: "not_assessable",
        confidence: "low",
        ontwikkelafstand: "unknown",
        energie: null,
        gate: false,
        construct,
        net: null,
        profielClaimCodes: pc ? [pc.claimCode] : [],
        uitleg: [
          dim
            ? `Voor ${construct} ontbreekt een volledig profielsignaal (nettoscore en energie). Er wordt niets ingevuld of geschat.`
            : "Deze vereiste hangt aan geen gekende dimensie; het profiel kan er niets over zeggen.",
        ],
        alternatieveVerklaringen: [],
        onbekenden: ["Profielsignaal voor deze vereiste"],
        verificatievragen: dim ? [`Vraag naar een recent, concreet voorbeeld van ${dim.gedrag}.`] : [],
      });
      continue;
    }

    const isDriver = dim.standaardFitType === "needs_supplies";
    const indicatie = isDriver ? driverIndicatie(pc.net, pc.energieStatus) : talentIndicatie(pc.net, pc.energieStatus);
    const confidence = profielConfidence(true, v.bronClaimIds, claimMap);
    const klasse = netKlasse(pc.net);
    const uitleg = [
      `Profielsignaal ${construct}: nettoscore ${pc.net} (${NET_KLASSE_TEKST[klasse]}), ${ENERGIE_TEKST[pc.energieStatus]}.`,
      isDriver
        ? "Dit is een driver: het signaal zegt iets over wat de omgeving vraagt en hoe houdbaar dat energetisch is, niet over bekwaamheid."
        : "Het signaal zegt iets over waar energie en voorkeur liggen, niet over aangetoonde bekwaamheid.",
      bevestigdeContext.length > 0
        ? `De vereiste steunt op ${bevestigdeContext.length} bevestigde contextclaim(s).`
        : "De vereiste steunt nog op geen bevestigde contextclaim.",
    ];
    if (confidence === "low") uitleg.push("Betrouwbaarheid laag: er is enkel een profielsignaal met beperkte contextonderbouwing.");

    uit.push({
      ...basis,
      indicatie,
      confidence,
      ontwikkelafstand: afstandVoor(indicatie),
      energie: pc.energieStatus,
      gate: false,
      construct,
      net: pc.net,
      profielClaimCodes: [pc.claimCode],
      uitleg,
      alternatieveVerklaringen: dim.alternatief,
      onbekenden: ["Gedrag in de concrete situatie van deze rol", "Referentie of eerder werkresultaat"],
      verificatievragen: [
        `Vraag naar een recent, concreet voorbeeld van ${dim.gedrag}.`,
        `Vraag wat er in die situatie energie gaf en wat energie kostte.`,
      ],
    });
  }
  return uit;
}
