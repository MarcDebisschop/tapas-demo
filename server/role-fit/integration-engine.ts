// ---------------------------------------------------------------------------
// server/role-fit/integration-engine.ts
//
// Integratie van profiel, context en observatie per hypothese (regelversie
// RF_INTEGRATIE_REGELVERSIE), plus de besluitregels rond gates.
//
// GEEN GEMIDDELDE. Twee observatoren worden niet uitgemiddeld. De regels kijken
// naar overeenstemming, bewijskwaliteit en het profielsignaal en geven een van
// vier statussen. Een reviewer kan elke status overschrijven, alleen met een
// geschreven reden; die reden staat in het besluitdossier.
//
// GATES ZIJN NIET-COMPENSEERBAAR. Een sterk bewijs elders maakt een niet
// voldane gate nooit goed.
// ---------------------------------------------------------------------------
import {
  RF_INTEGRATIE_REGELVERSIE,
  type Aanbeveling,
  type Bewijskwaliteit,
  type Confidence,
  type FitIndicatie,
  type GateStatus,
  type IntegratieStatus,
} from "@shared/role-fit";

export interface ObservatieVoorIntegratie {
  rol: "recruiter" | "hiring_manager";
  barsScore: number | null;
  onvoldoendeKans: boolean;
  bewijskwaliteit: Bewijskwaliteit | null;
}

export interface IntegratieUitkomst {
  status: IntegratieStatus;
  confidence: Confidence;
  profielRichting: "ondersteunend" | "gemengd" | "spanning" | "onbekend";
  scores: { recruiter: number | null; hiring_manager: number | null };
  redenen: string[];
  regelversie: string;
}

export function profielRichting(indicatie: FitIndicatie): IntegratieUitkomst["profielRichting"] {
  if (indicatie === "strong_support" || indicatie === "likely_support") return "ondersteunend";
  if (indicatie === "mixed") return "gemengd";
  if (indicatie === "likely_friction") return "spanning";
  return "onbekend";
}

export function integreerHypothese(
  profielIndicatie: FitIndicatie,
  observaties: ObservatieVoorIntegratie[],
): IntegratieUitkomst {
  const richting = profielRichting(profielIndicatie);
  const r = observaties.find((o) => o.rol === "recruiter");
  const h = observaties.find((o) => o.rol === "hiring_manager");
  const scores = { recruiter: r?.barsScore ?? null, hiring_manager: h?.barsScore ?? null };
  const basis = { profielRichting: richting, scores, regelversie: RF_INTEGRATIE_REGELVERSIE };

  const bruikbaar = (o?: ObservatieVoorIntegratie) =>
    !!o && !o.onvoldoendeKans && o.barsScore !== null && o.bewijskwaliteit !== "limited";

  if (!bruikbaar(r) || !bruikbaar(h)) {
    const redenen: string[] = [];
    if (!r || !h) redenen.push("Niet beide observatoren leverden een observatie aan.");
    if ([r, h].some((o) => o?.onvoldoendeKans)) redenen.push("Minstens een observator meldde onvoldoende observatiekans.");
    if ([r, h].some((o) => o && o.barsScore === null && !o.onvoldoendeKans)) redenen.push("Minstens een observatie heeft geen ankerscore.");
    if ([r, h].some((o) => o?.bewijskwaliteit === "limited")) redenen.push("Minstens een observatie heeft beperkte bewijskwaliteit.");
    redenen.push("Met een enkele bruikbare bron wordt geen richting vastgesteld.");
    return { ...basis, status: "insufficient_evidence", confidence: "low", redenen };
  }

  const a = r!.barsScore!;
  const b = h!.barsScore!;
  const direct = [r!, h!].filter((o) => o.bewijskwaliteit === "direct").length;

  if (a === 5 && b === 5) {
    return {
      ...basis,
      status: "convergent_support",
      confidence: direct === 2 ? "high" : "medium",
      redenen: [
        "Beide observatoren zagen onafhankelijk gedrag op het hoogste anker.",
        richting === "ondersteunend"
          ? "Het profielsignaal wijst dezelfde richting uit."
          : "Het profielsignaal wijst niet eenduidig dezelfde richting uit; de observatie weegt hier door.",
      ],
    };
  }
  if ((a === 5 && b === 3) || (a === 3 && b === 5)) {
    if (richting === "ondersteunend" && direct >= 1) {
      return {
        ...basis,
        status: "convergent_support",
        confidence: "medium",
        redenen: [
          "Een observator zag het hoogste anker, de andere het middelste; het profielsignaal ondersteunt.",
          "Minstens een observatie steunt op direct gezien of gehoord gedrag.",
        ],
      };
    }
    return {
      ...basis,
      status: "mixed_context_dependent",
      confidence: "medium",
      redenen: ["De observaties liggen dicht bij elkaar, maar profiel of bewijskwaliteit geven geen eenduidige steun."],
    };
  }
  if (a === 1 && b === 1) {
    return {
      ...basis,
      status: "repeated_counter_indication",
      confidence: direct >= 1 ? "medium" : "low",
      redenen: [
        "Beide observatoren zagen onafhankelijk gedrag op het laagste anker.",
        "Dit gaat over gedrag binnen deze oefening; het is geen uitspraak over talent of persoon.",
      ],
    };
  }
  const redenen: string[] = [];
  if (a !== b) redenen.push(`De observatoren verschillen (${a} tegenover ${b}); de context van beide observaties is doorslaggevend.`);
  else redenen.push("Beide observatoren zagen het middelste anker.");
  if (richting === "spanning") redenen.push("Het profielsignaal wijst op mogelijke frictie.");
  return { ...basis, status: "mixed_context_dependent", confidence: "medium", redenen };
}

// ---- Besluitregels -------------------------------------------------------------
export interface GateVoorBesluit {
  vereisteId: number;
  vereiste: string;
  status: GateStatus;
}

export interface BesluitToets {
  toegestaan: Aanbeveling[];
  fouten: string[];
}

/**
 * Welke aanbevelingen zijn toegestaan gegeven de gates, en voldoet het
 * voorgestelde besluit? Een niet voldane gate laat enkel uitstellen of negatief
 * toe. Een open of te verifiëren gate sluit positief uit; bij voorwaardelijk
 * positief moet elke zo'n gate als voorwaarde genoemd worden.
 */
export function toetsBesluit(
  gates: GateVoorBesluit[],
  aanbeveling: Aanbeveling,
  voorwaarden: string[],
): BesluitToets {
  const nietVoldaan = gates.filter((g) => g.status === "not_met");
  const onzeker = gates.filter((g) => g.status === "open" || g.status === "to_verify");
  let toegestaan: Aanbeveling[] = ["positive", "conditionally_positive", "postpone", "negative"];
  if (nietVoldaan.length > 0) toegestaan = ["postpone", "negative"];
  else if (onzeker.length > 0) toegestaan = ["conditionally_positive", "postpone", "negative"];

  const fouten: string[] = [];
  if (!toegestaan.includes(aanbeveling)) {
    fouten.push(
      nietVoldaan.length > 0
        ? "Er is een niet voldane gate. Een gate is niet-compenseerbaar: enkel uitstellen of negatief is mogelijk."
        : "Er is een gate die nog niet geverifieerd is. Positief is pas mogelijk wanneer elke gate voldaan is.",
    );
  }
  if (aanbeveling === "conditionally_positive") {
    if (voorwaarden.length === 0) fouten.push("Voorwaardelijk positief vraagt minstens een voorwaarde.");
    for (const g of onzeker) {
      const genoemd = voorwaarden.some((v) => v.toLowerCase().includes(`gate ${g.vereisteId}`) || v.toLowerCase().includes(g.vereiste.toLowerCase().slice(0, 40)));
      if (!genoemd) fouten.push(`De nog niet geverifieerde gate "${g.vereiste}" moet als voorwaarde genoemd worden.`);
    }
  }
  return { toegestaan, fouten };
}
