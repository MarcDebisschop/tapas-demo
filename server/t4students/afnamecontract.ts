// ---------------------------------------------------------------------------
// server/t4students/afnamecontract.ts
//
// Het bevroren contract van een afgeronde T4Students-afname: alles wat nodig is
// om er later, zonder de afname opnieuw te lezen, hetzelfde rapport uit te
// bouwen. Dit is het enige contract dat de rapportketen van het studiekompas
// aanvaardt.
//
// WAAROM DIT BESTAAT
// Er liepen twee ketens met dezelfde naam: een oude (server/t4students/scoring.ts
// plus rapport.ts, die alleen HTML kon en op itemsleutels van een oude itembank
// zocht) en de nieuwe studiekompasmotor (kompas-scoring.ts, rapport-paginas.ts,
// rapport-pdf.ts, 35 bladen). De live afname liep door de oude keten en scoorde
// nul items. Vanaf nu is er één keten, en dit contract is de enige overgang van
// afname naar rapport.
// ---------------------------------------------------------------------------

import { T4STUDENTS_INSTRUMENT, T4STUDENTS_SCORER_VERSIE } from "./instrument";
import type { T4SInstrument } from "./instrument";
import { scoreStudiekompas } from "./kompas-scoring";
import type { T4SAntwoorden, T4SResultaat, T4STaal } from "./kompas-scoring";
import type { T4SLicentie } from "./rapport-contract";
import { naarT4SAntwoorden, ontbrekendeItems } from "./antwoorden";

export const T4STUDENTS_CONTRACT_VERSIE = "2.0.0";

export interface T4SAfnameContract {
  contractVersion: string;
  /** De sleutel waarop server/rapport-registry.ts de generator kiest. */
  instrumentId: "t4students";
  taal: T4STaal;
  licentie: T4SLicentie;
  respondent: { naam: string; code: string };
  datum: string;
  instrumentVersie: string;
  scorerVersie: string;
  resultaat: T4SResultaat;
  antwoorden: T4SAntwoorden;
  /** Welke items geen antwoord droegen. Leeg bij een volledige afname. */
  ontbrekend: string[];
  itemTijden?: Record<string, number>;
  consent?: { scope: string | null; timestamp: string | null };
}

/**
 * Welke licentie het rapport draagt. Het instrument zelf noemt zijn licentie
 * (server/data/t4students.json, veld license); staat daar iets anders dan basis,
 * dan geldt de verdieping: het volledige rapport van 35 bladen.
 */
export function licentieVanInstrument(
  instrument: T4SInstrument = T4STUDENTS_INSTRUMENT,
): T4SLicentie {
  return instrument.license === "basis" ? "basis" : "verdieping";
}

function kiesTaal(ruw: unknown): T4STaal {
  return ruw === "fr" || ruw === "en" ? ruw : "nl";
}

/** Alleen echte, eindige getallen uit de bewaarde itemtijden. */
function tijdenAlsGetallen(
  ruw: Record<string, unknown> | null | undefined,
): Record<string, number> | undefined {
  if (!ruw || typeof ruw !== "object") return undefined;
  const uit: Record<string, number> = {};
  for (const [sleutel, waarde] of Object.entries(ruw)) {
    if (typeof waarde === "number" && Number.isFinite(waarde)) uit[sleutel] = waarde;
  }
  return Object.keys(uit).length > 0 ? uit : undefined;
}

/**
 * Bouwt het contract uit een afgeronde afname. De antwoorden gaan eerst door
 * naarT4SAntwoorden(): alleen sleutels die een item van dit instrument zijn en
 * alleen de zes bekende velden komen door. Scoren gebeurt hier, éénmaal, zodat
 * elke latere lezer van het contract exact dezelfde cijfers ziet.
 */
export function bouwT4StudentsAfnameContract(input: {
  respondentCode: string;
  name?: string | null;
  taal?: string | null;
  responses: unknown;
  // De tijden komen uit de databank en zijn daar los getypeerd (zie
  // ItemTijden in server/afnamekwaliteit.ts: Record<string, unknown>). We laten
  // daarom alleen echte getallen door in plaats van de waarde over te typen.
  itemTijden?: Record<string, unknown> | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  datum?: string | null;
  instrument?: T4SInstrument;
}): T4SAfnameContract {
  const instrument = input.instrument ?? T4STUDENTS_INSTRUMENT;
  const antwoorden = naarT4SAntwoorden(input.responses, instrument);
  const taal = kiesTaal(input.taal);
  const naam = (input.name ?? "").trim() || input.respondentCode;
  const resultaat = scoreStudiekompas(
    instrument,
    antwoorden,
    { naam, code: input.respondentCode },
    taal,
  );
  return {
    contractVersion: T4STUDENTS_CONTRACT_VERSIE,
    instrumentId: "t4students",
    taal,
    licentie: licentieVanInstrument(instrument),
    respondent: { naam, code: input.respondentCode },
    datum: (input.datum ?? "").trim() || new Date().toISOString().slice(0, 10),
    instrumentVersie: instrument.version,
    scorerVersie: T4STUDENTS_SCORER_VERSIE,
    resultaat,
    antwoorden,
    ontbrekend: ontbrekendeItems(antwoorden, instrument),
    itemTijden: tijdenAlsGetallen(input.itemTijden),
    consent: {
      scope: input.consentScope ?? null,
      timestamp: input.consentTimestamp ?? null,
    },
  };
}

/**
 * Leest een contract dat uit de databank komt en weigert alles wat niet uit de
 * studiekompasketen komt. Zo kan een oud of vreemd contract niet stil een
 * rapport met nulwaarden opleveren: het faalt zichtbaar, met een leesbare reden.
 */
export function leesT4StudentsContract(ruw: unknown): T4SAfnameContract {
  const c = ruw as Partial<T4SAfnameContract> | null;
  if (!c || typeof c !== "object") {
    throw new Error("T4Students: er is geen contract om een rapport uit te bouwen.");
  }
  if (!c.resultaat || typeof c.resultaat !== "object") {
    throw new Error(
      "T4Students: dit contract draagt geen scoringsresultaat en komt niet uit de " +
        "studiekompasketen. De afname moet opnieuw ingevuld worden.",
    );
  }
  if (!c.antwoorden || typeof c.antwoorden !== "object") {
    throw new Error("T4Students: dit contract draagt geen antwoorden.");
  }
  return {
    contractVersion: c.contractVersion ?? T4STUDENTS_CONTRACT_VERSIE,
    instrumentId: "t4students",
    taal: kiesTaal(c.taal),
    licentie: c.licentie === "basis" ? "basis" : "verdieping",
    respondent: {
      naam: c.respondent?.naam ?? "",
      code: c.respondent?.code ?? "",
    },
    datum: c.datum ?? new Date().toISOString().slice(0, 10),
    instrumentVersie: c.instrumentVersie ?? T4STUDENTS_INSTRUMENT.version,
    scorerVersie: c.scorerVersie ?? T4STUDENTS_SCORER_VERSIE,
    resultaat: c.resultaat as T4SResultaat,
    antwoorden: c.antwoorden as T4SAntwoorden,
    ontbrekend: Array.isArray(c.ontbrekend) ? c.ontbrekend : [],
    itemTijden: c.itemTijden,
    consent: c.consent,
  };
}
