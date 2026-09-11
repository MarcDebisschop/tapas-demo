/**
 * server/hdd/bronnen.ts
 *
 * De brug van de bronnen naar de aggregatie.
 * ---------------------------------------------------------------------------
 * HDD bezit geen antwoorden. Een traject bewaart per board member enkel tokens
 * naar de onderliggende instrumenten. Tot nu toe moest de oproeper de
 * meetwaarden zelf in de body meegeven (`leden`), wat betekende dat het rapport
 * even goed op verzonnen cijfers kon draaien. Dit bestand leest die waarden waar
 * ze echt staan en zet ze om naar `BoardMemberInput` uit ./aggregatie.
 *
 * Het contract van de aggregatie verandert NIET. Deze module vult het alleen.
 *
 * Drie bronnen, drie verschillende wegen:
 *
 *   tapas-teamscan   token -> teamscan_deelnemers -> teamscan_antwoorden
 *                    -> scoorIndividueel() -> pijlergemiddelden 1 tot 5.
 *   t4p-business-kompas
 *                    token -> afnames.invite_token -> mainResponses
 *                    -> buildMainScores() -> energie, talent, drivers, stratum.
 *   twominscan       De 2MINSCAN wordt in de client berekend en belandt als rij
 *                    in twominscan_afnames, zonder tokenkolom. "Ingevuld" is
 *                    daarom: er staat een rij op naam van dit lid binnen de
 *                    organisatie van het traject, of de afnamerij van de
 *                    uitnodiging staat op voltooid. De 2MINSCAN levert BEWUST
 *                    geen energiecijfer: ENERGIE_INSTRUMENTEN in aggregatie.ts
 *                    laat die scan er niet in, en wie alleen een 2MINSCAN heeft,
 *                    hoort als ontbrekende energiemeting zichtbaar te blijven.
 *
 * Wat niet gemeten is, blijft leeg. Nergens een middenwaarde, nergens een
 * terugval: een leeg veld leest als "niet gemeten", een ingevuld veld als
 * "gemeten", en dat verschil mag een rapport niet verliezen.
 */

import { storage } from "../storage";
import { hddStorage } from "./storage";
import { leesAfnames } from "../twominscan/afname-opslag";
import { scoorIndividueel } from "../teamscan/scoring";
import { buildMainScores } from "../scoring";
import type { MainScores } from "../scoring";
import type { BoardMemberInput, MemberEnergy, MemberTalent, MemberTeamscan } from "./aggregatie";
import type { HddTraject, HddBoardLid } from "./schema";
import {
  TEAMSCAN_INSTRUMENT,
  TWOMINSCAN_INSTRUMENT,
  T4P_INSTRUMENT,
} from "./uitsturen";

// ---------------------------------------------------------------------------
// Vertaaltabellen
// ---------------------------------------------------------------------------

/**
 * De T4P-constructen heten in het instrument Nederlands; de aggregatie telt
 * dekking op de vier Engelstalige families uit TALENT_FAMILIES en het rapport is
 * Engelstalig. "TaPas-Beeld" staat bewust niet in deze tabel: dat construct is
 * geen van de vier families en telt dus niet mee voor dekking.
 */
const FOCUS_NAAR_FAMILIE: Record<string, string> = {
  Strategie: "Strategy",
  Operationeel: "Operational",
  Innovatie: "Innovation",
  "Inter-relationeel": "Interrelational",
};

/** Talent-versnellers, zoals ze in het Engelstalige rapport horen te staan. */
const VERSNELLER_ENGELS: Record<string, string> = {
  Analyse: "Analysis",
  Coaching: "Coaching",
  "Constructief onderscheidend": "Constructively distinctive",
  Faciliteren: "Facilitation",
  Impact: "Impact",
  Resultaatgericht: "Result-driven",
};

// DRIVER(S) blijven onvertaald (Be Strong, Be Perfect, Hurry Up, Try Hard,
// Please Others): dat is de regel van het instrument zelf.

// ---------------------------------------------------------------------------
// Teamscan
// ---------------------------------------------------------------------------

/**
 * De vijf pijlergemiddelden van een lid, of undefined wanneer het lid de
 * Teamscan nog niet invulde. De codes van de itembank (vertrouwen, conflict,
 * betrokkenheid, verantwoordelijkheid, resultaten) vallen samen met de velden
 * van MemberTeamscan; het fundament hoort niet bij die vijf.
 */
export function leesTeamscanVanToken(token: string): MemberTeamscan | undefined {
  if (!token || !hddStorage.teamscanTabellenAanwezig()) return undefined;
  const deelnemer = hddStorage.getTeamscanDeelnemerViaToken(token);
  if (!deelnemer) return undefined;
  const antwoorden = hddStorage.getTeamscanAntwoorden(deelnemer.id);
  if (!antwoorden) return undefined;
  const resultaat = scoorIndividueel(antwoorden);
  const uit: MemberTeamscan = {};
  for (const pijler of resultaat.pijlers) {
    if (typeof pijler.gemiddelde !== "number" || Number.isNaN(pijler.gemiddelde)) continue;
    if (pijler.code === "vertrouwen") uit.vertrouwen = pijler.gemiddelde;
    if (pijler.code === "conflict") uit.conflict = pijler.gemiddelde;
    if (pijler.code === "betrokkenheid") uit.betrokkenheid = pijler.gemiddelde;
    if (pijler.code === "verantwoordelijkheid") uit.verantwoordelijkheid = pijler.gemiddelde;
    if (pijler.code === "resultaten") uit.resultaten = pijler.gemiddelde;
  }
  return Object.keys(uit).length ? uit : undefined;
}

// ---------------------------------------------------------------------------
// T4P Business
// ---------------------------------------------------------------------------

/** De gescoorde T4P-afname achter een uitnodigingstoken, of null. */
async function leesT4pScores(token: string): Promise<{ scores: MainScores; rol: string | null } | null> {
  if (!token) return null;
  const afname = await storage.getAfnameByToken(token);
  if (!afname?.mainResponses) return null;
  let responses: any;
  try {
    responses = JSON.parse(afname.mainResponses);
  } catch {
    return null;
  }
  if (!responses || !Object.keys(responses).length) return null;
  let itemTijden: any = null;
  try {
    itemTijden = afname.itemTijden ? JSON.parse(afname.itemTijden) : null;
  } catch {
    itemTijden = null;
  }
  const scores = buildMainScores(responses, afname.baselineEnergy ?? 5, itemTijden);
  return { scores, rol: afname.role ?? null };
}

/** Netto per aanbieding: de vergelijkbare ordening binnen een familie. */
function netVergelijkbaar(rij: { net: number; shown: number; netPerAanbieding?: number }): number {
  if (typeof rij.netPerAanbieding === "number") return rij.netPerAanbieding;
  return rij.shown > 0 ? rij.net / rij.shown : rij.net;
}

/**
 * Indicatief Jaques-stratum uit het T4P-profiel.
 *
 * Dezelfde formule als in server/t4p/kompas-contract.ts (conceptuele lading uit
 * Analyse, TaPas-Beeld en Innovatie, knipt op 3, 8 en 14). Die module valt
 * buiten het bestandsbezit van dit spoor en exporteert de berekening niet, dus
 * ze staat hier na, met deze verwijzing als bron. Blijft een INDICATIE en nooit
 * een meting waarmee mensen gerangschikt worden.
 */
function stratumIndicatie(scores: MainScores): number {
  const net = (construct: string) =>
    scores.constructRows.find((r) => r.construct === construct)?.net ?? 0;
  const conceptueel = net("Analyse") + net("TaPas-Beeld") + net("Innovatie");
  if (conceptueel >= 14) return 5;
  if (conceptueel >= 8) return 4;
  if (conceptueel >= 3) return 3;
  return 2;
}

/** Energie uit T4P. De bron moet in ENERGIE_INSTRUMENTEN staan: "t4p-business". */
function energieUitT4p(scores: MainScores): MemberEnergy {
  // itemEnergie op de schaal min 2 tot plus 2; de aggregatie zet die zelf om
  // met de gedeelde omzetting. `fase` blijft weg: die hoort bij de 2MINSCAN en
  // een null zou door het invoerschema geweigerd worden.
  return { bron: "t4p-business", itemEnergie: scores.meta.averageEnergy };
}

function talentUitT4p(scores: MainScores): MemberTalent {
  const perFamilie = (familie: string) =>
    scores.constructRows
      .filter((r) => r.family === familie)
      .sort((a, b) => netVergelijkbaar(b) - netVergelijkbaar(a));

  const foci = perFamilie("Talent-foci")
    .map((r) => FOCUS_NAAR_FAMILIE[r.construct])
    .filter((f): f is string => Boolean(f))
    .slice(0, 3);

  const versnellers = perFamilie("Talent-versnellers")
    .slice(0, 3)
    .map((r) => VERSNELLER_ENGELS[r.construct] ?? r.construct);

  const drivers = perFamilie("Drivers")
    .slice(0, 3)
    .map((r) => r.construct);

  const risico = scores.meta.driverRisk.label;
  return {
    talentFoci: foci,
    versnellers,
    drivers,
    driverRisico:
      risico === "laag" || risico === "matig" || risico === "hoog" ? risico : undefined,
    stratumIndicatie: stratumIndicatie(scores),
    congruentie: scores.meta.consistency.score,
  };
}

// ---------------------------------------------------------------------------
// 2MINSCAN
// ---------------------------------------------------------------------------

export interface TwominscanTreffer {
  naam: string;
  rol: string | null;
  egCode: string;
  wielpositie: string;
  datum: string;
}

function normaliseerNaam(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * De 2MINSCAN-afnames binnen de organisatie van het traject, op naam.
 *
 * De tabel twominscan_afnames heeft geen tokenkolom (de scan wordt in de client
 * berekend en daarna bewaard). De naam binnen de organisatie is dus de enige
 * sleutel die er is; dat wordt hier eerlijk zo gelezen en niet mooier gemaakt.
 */
export function leesTwominscanVanOrganisatie(orgLabel: string): Map<string, TwominscanTreffer> {
  const kaart = new Map<string, TwominscanTreffer>();
  const rijen = leesAfnames(orgLabel || undefined, 500);
  for (const rij of rijen) {
    const sleutel = normaliseerNaam(rij.naam ?? "");
    if (!sleutel || kaart.has(sleutel)) continue;
    kaart.set(sleutel, {
      naam: rij.naam,
      rol: rij.rol || null,
      egCode: rij.egCode,
      wielpositie: rij.wielpositie,
      datum: rij.datum,
    });
  }
  return kaart;
}

// ---------------------------------------------------------------------------
// De brug
// ---------------------------------------------------------------------------

/**
 * Bouwt de ledeninvoer van een traject uit de echte bronnen.
 *
 * Elk lid komt in de lijst, ook wie nog niets invulde: de aggregatie telt zelf
 * wat er ontbreekt en het rapport hoort een leeg lid te tonen in plaats van het
 * weg te laten.
 */
export async function bouwLedenInvoer(
  traject: HddTraject,
  leden: HddBoardLid[],
): Promise<BoardMemberInput[]> {
  const tweeMin = leesTwominscanVanOrganisatie(traject.orgLabel ?? "");
  const uit: BoardMemberInput[] = [];

  for (const lid of leden) {
    const tokens = hddStorage.getTokens(lid.id);
    const invoer: BoardMemberInput = { id: lid.id, naam: lid.naam };

    const teamscan = leesTeamscanVanToken(tokens[TEAMSCAN_INSTRUMENT] ?? "");
    if (teamscan) invoer.teamscan = teamscan;

    const t4p = await leesT4pScores(tokens[T4P_INSTRUMENT] ?? "");
    if (t4p) {
      invoer.energy = energieUitT4p(t4p.scores);
      invoer.talent = talentUitT4p(t4p.scores);
      if (t4p.rol) invoer.rol = t4p.rol;
    }

    // De 2MINSCAN vult geen energiecijfer aan: zij levert een gedragsprofiel.
    // Wel de rol, wanneer die er alleen daar staat.
    const scan = tweeMin.get(normaliseerNaam(lid.naam));
    if (scan && !invoer.rol && scan.rol) invoer.rol = scan.rol;

    uit.push(invoer);
  }
  return uit;
}

// ---------------------------------------------------------------------------
// Voortgang
// ---------------------------------------------------------------------------

export interface InstrumentVoortgang {
  instrumentId: string;
  /** Is er een uitnodiging/token voor dit lid en dit instrument? */
  uitgestuurd: boolean;
  /** Staat er werkelijk een ingevulde afname tegenover? */
  ingevuld: boolean;
  /** De status zoals het bron-instrument die zelf kent, of null. */
  bronstatus: string | null;
}

export interface LidVoortgang {
  lidId: number;
  naam: string;
  instrumenten: InstrumentVoortgang[];
}

/**
 * Leest per lid per instrument of er al ingevuld is, bij de bronnen zelf.
 * HDD houdt geen tweede administratie bij van wie wat invulde: dat zou meteen
 * uit de pas lopen met het instrument.
 */
export async function leesVoortgang(
  traject: HddTraject,
  leden: HddBoardLid[],
): Promise<LidVoortgang[]> {
  const tweeMin = leesTwominscanVanOrganisatie(traject.orgLabel ?? "");
  const uit: LidVoortgang[] = [];

  for (const lid of leden) {
    const tokens = hddStorage.getTokens(lid.id);
    const regels: InstrumentVoortgang[] = [];

    // Teamscan: afgerond staat op de deelnemer, antwoorden in de antwoordtabel.
    const tsToken = tokens[TEAMSCAN_INSTRUMENT] ?? "";
    const deelnemer = tsToken ? hddStorage.getTeamscanDeelnemerViaToken(tsToken) : undefined;
    const tsAntwoorden = deelnemer ? hddStorage.getTeamscanAntwoorden(deelnemer.id) : null;
    regels.push({
      instrumentId: TEAMSCAN_INSTRUMENT,
      uitgestuurd: Boolean(tsToken),
      ingevuld: Boolean(tsAntwoorden),
      bronstatus: deelnemer ? (deelnemer.afgerond ? "afgerond" : "open") : null,
    });

    // 2MINSCAN: de uitnodiging staat in afnames, het resultaat in
    // twominscan_afnames (zonder token, dus op naam binnen de organisatie).
    const msToken = tokens[TWOMINSCAN_INSTRUMENT] ?? "";
    const msAfname = msToken ? await storage.getAfnameByToken(msToken) : undefined;
    const scan = tweeMin.get(normaliseerNaam(lid.naam));
    regels.push({
      instrumentId: TWOMINSCAN_INSTRUMENT,
      uitgestuurd: Boolean(msToken),
      ingevuld: Boolean(scan) || msAfname?.status === "voltooid",
      bronstatus: scan ? "bewaard" : (msAfname?.status ?? null),
    });

    // T4P: de afnamerij zelf weet hoe ver de deelnemer staat.
    const t4pToken = tokens[T4P_INSTRUMENT] ?? "";
    const t4pAfname = t4pToken ? await storage.getAfnameByToken(t4pToken) : undefined;
    regels.push({
      instrumentId: T4P_INSTRUMENT,
      uitgestuurd: Boolean(t4pToken),
      ingevuld: Boolean(t4pAfname?.mainResponses),
      bronstatus: t4pAfname?.status ?? null,
    });

    uit.push({ lidId: lid.id, naam: lid.naam, instrumenten: regels });
  }
  return uit;
}

/** De deelnemers voor de 2MINSCAN-teamanalyse van dit traject. */
export function teamanalyseDeelnemers(
  traject: HddTraject,
  leden: HddBoardLid[],
): { naam: string; rol?: string; egCode: string; wielpositie: string }[] {
  const tweeMin = leesTwominscanVanOrganisatie(traject.orgLabel ?? "");
  const uit: { naam: string; rol?: string; egCode: string; wielpositie: string }[] = [];
  for (const lid of leden) {
    const scan = tweeMin.get(normaliseerNaam(lid.naam));
    if (!scan) continue;
    uit.push({
      naam: scan.naam,
      rol: scan.rol ?? undefined,
      egCode: scan.egCode,
      wielpositie: scan.wielpositie,
    });
  }
  return uit;
}
