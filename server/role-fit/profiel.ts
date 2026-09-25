// ---------------------------------------------------------------------------
// server/role-fit/profiel.ts
//
// Leest de profielclaims uit het gegenereerde contract van een T4P Business
// Kompas-afname. Alleen lezen: dit bestand wijzigt niets aan de afname of aan
// het contract, en herberekent geen enkele score. De waarden komen letterlijk
// uit contract.sections.main.constructRows.
//
// ONTBREKEND IS ONTBREKEND. Waar server/t4r/uit-afname.ts een ontbrekende
// energie als neutraal behandelt, doet Role Fit dat bewust niet. Ontbreekt de
// nettoscore of de gemiddelde energie van een construct, dan is de claim
// onvolledig (volledig = false). De fit-motor geeft zo'n claim geen label en
// geen score: geen imputatie, geen gemiddelde, geen nul en geen middenwaarde.
// ---------------------------------------------------------------------------
import { createHash } from "node:crypto";
import { CONSTRUCT_NAAR_T4R_SLEUTEL, T4P_INSTRUMENT } from "../t4r/uit-afname";
import { energieStatusVanGemiddelde, type EnergieStatusDrie } from "@shared/energie-schaal";

export interface ProfielClaim {
  claimCode: string;
  construct: string;
  familie: string;
  net: number | null;
  gemEnergie: number | null;
  energieStatus: EnergieStatusDrie | null;
  volledig: boolean;
  contentHash: string;
}

export interface ProfielUitlezing {
  instrument: string;
  contractversie: string;
  gegenereerdOp: string | null;
  claims: ProfielClaim[];
  ontbrekendeConstructen: string[];
}

export class ProfielFout extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function getal(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function hash(v: unknown): string {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}

/**
 * Controleert of een afname bruikbaar is voor een Role Fit-case en geeft de
 * reden terug wanneer dat niet zo is. Dezelfde controles als bij de overname
 * in server/t4r/routes.ts.
 */
export function controleerAfname(afname: any, vandaag = new Date().toISOString().slice(0, 10)): void {
  if (!afname) throw new ProfielFout("Afname niet gevonden.", 404);
  if (afname.geanonimiseerdAt) throw new ProfielFout("Deze afname is geanonimiseerd.", 409);
  if (afname.consentIngetrokkenAt) throw new ProfielFout("De toestemming voor deze afname is ingetrokken.", 409);
  if (afname.bewaartotDatum && String(afname.bewaartotDatum).slice(0, 10) < vandaag)
    throw new ProfielFout("De bewaartermijn van deze afname is verstreken.", 409);
  if (afname.instrumentId !== T4P_INSTRUMENT)
    throw new ProfielFout("Deze afname is geen T4P Business Kompas-afname.", 409);
  if (afname.status !== "voltooid" || !afname.generatorContract)
    throw new ProfielFout("Deze afname heeft nog geen afgerond profiel.", 409);
}

export function leesProfielUitContract(contractRuw: unknown): ProfielUitlezing {
  let contract: any = contractRuw;
  if (typeof contractRuw === "string") {
    try {
      contract = JSON.parse(contractRuw);
    } catch {
      throw new ProfielFout("Het profielcontract van deze afname is niet leesbaar.", 409);
    }
  }
  const main: any = contract?.sections?.main ?? {};
  const rijen: any[] = Array.isArray(main?.constructRows) ? main.constructRows : [];
  const perConstruct = new Map<string, any>();
  for (const rij of rijen) {
    if (typeof rij?.construct === "string") perConstruct.set(rij.construct, rij);
  }
  const claims: ProfielClaim[] = [];
  const ontbrekend: string[] = [];
  for (const [construct, sleutel] of Object.entries(CONSTRUCT_NAAR_T4R_SLEUTEL)) {
    const rij = perConstruct.get(construct);
    const net = getal(rij?.net);
    const gem = getal(rij?.avgEnergy);
    const volledig = net !== null && gem !== null;
    if (!volledig) ontbrekend.push(construct);
    const basis = {
      claimCode: `t4p.${sleutel}`,
      construct,
      familie: typeof rij?.family === "string" ? rij.family : "",
      net,
      gemEnergie: gem,
      energieStatus: gem !== null ? energieStatusVanGemiddelde(gem) : null,
      volledig,
    };
    claims.push({ ...basis, contentHash: hash(basis) });
  }
  return {
    instrument: T4P_INSTRUMENT,
    contractversie: typeof contract?.contractVersion === "string" ? contract.contractVersion : "",
    gegenereerdOp: typeof contract?.generatedAt === "string" ? contract.generatedAt : null,
    claims,
    ontbrekendeConstructen: ontbrekend,
  };
}
