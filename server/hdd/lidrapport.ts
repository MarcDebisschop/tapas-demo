// =============================================================================
// server/hdd/lidrapport.ts: de rapporten van één lid, gelezen door de begeleider
// -----------------------------------------------------------------------------
// Waarom deze module bestaat
//   De rapportsluis houdt een lid van een traject weg van zijn eigen rapport tot
//   de begeleider vrijgeeft. Die regel rust op het token, en daardoor hield de
//   sluis ook de begeleider tegen: hij kwam alleen binnen via dezelfde link als
//   het lid. Dat draaide de bedoeling om, want juist de begeleider hoort eerst
//   te lezen.
//
//   Deze module opent de andere weg: niet via het token van het lid, maar via
//   het traject en het lid, achter de beheerderslogin. Elke route die haar
//   gebruikt, staat onder /api/hdd en dus achter vereisScope (zie
//   ./routes.ts en ../scope-guard.ts).
//
// Wat de begeleider per lid terugkrijgt
//   Teamscan   het individuele resultaat, berekend uit de antwoorden in de
//              Teamscan-tabellen. Ook als html of pdf.
//   2MINSCAN   de bewaarde uitkomst uit twominscan_afnames. Daarmee bouwt het
//              scherm hetzelfde rapport opnieuw op. Rijen van voor die
//              uitbreiding dragen enkel een wielpositie, en dat zegt deze
//              module dan ook.
//   Kompas     het nummer van de afname, zodat het scherm naar de bestaande
//              rapportpagina van het beheer kan verwijzen.
// =============================================================================
import { hddStorage } from "./storage";
import { storage } from "../storage";
import { scoorIndividueel } from "../teamscan/scoring";
import { renderIndividueelRapport } from "../teamscan/rapport";
import { leesAfnames, type BewaardeAfname } from "../twominscan/afname-opslag";
import type { HddTraject, HddBoardLid } from "./schema";

const TEAMSCAN = "tapas-teamscan";
const TWOMINSCAN = "twominscan";
const KOMPAS = "t4p-business-kompas";

export interface TeamscanBron {
  uitgestuurd: boolean;
  ingevuld: boolean;
  /** Het label waarmee het lid in de Teamscan staat. */
  label: string | null;
  /** Het berekende resultaat, of null zolang er geen antwoorden zijn. */
  resultaat: unknown | null;
}

export interface TwominscanBron {
  uitgestuurd: boolean;
  ingevuld: boolean;
  /** Alles wat bewaard is, inclusief de uitkomst waarmee het rapport heropbouwt. */
  afname: BewaardeAfname | null;
  /** Kan het volledige rapport opnieuw getoond worden? */
  herbouwbaar: boolean;
}

export interface KompasBron {
  uitgestuurd: boolean;
  ingevuld: boolean;
  afnameId: number | null;
  status: string | null;
}

export interface LidRapportBronnen {
  trajectId: number;
  lid: {
    id: number;
    naam: string;
    email: string | null;
    organisatie: string;
    vrijgegeven: boolean;
  };
  teamscan: TeamscanBron;
  twominscan: TwominscanBron;
  kompas: KompasBron;
}

function tokensVan(lidId: number): Record<string, string> {
  try {
    return hddStorage.getTokens(lidId) ?? {};
  } catch {
    return {};
  }
}

/** Het individuele Teamscan-resultaat van één lid, of null. */
export function leesTeamscan(lid: HddBoardLid): TeamscanBron {
  const token = tokensVan(lid.id)[TEAMSCAN] ?? "";
  if (!token) return { uitgestuurd: false, ingevuld: false, label: null, resultaat: null };
  const deelnemer = hddStorage.getTeamscanDeelnemerViaToken(token);
  if (!deelnemer) return { uitgestuurd: true, ingevuld: false, label: null, resultaat: null };
  const antwoorden = hddStorage.getTeamscanAntwoorden(deelnemer.id);
  if (!antwoorden) {
    return { uitgestuurd: true, ingevuld: false, label: deelnemer.label ?? null, resultaat: null };
  }
  return {
    uitgestuurd: true,
    ingevuld: true,
    label: deelnemer.label ?? null,
    resultaat: scoorIndividueel(antwoorden as any),
  };
}

/** Hetzelfde resultaat als opgemaakte html, of null wanneer er niets is. */
export function teamscanAlsHtml(lid: HddBoardLid): string | null {
  const bron = leesTeamscan(lid);
  if (!bron.ingevuld || !bron.resultaat) return null;
  return renderIndividueelRapport(bron.resultaat as any, bron.label ?? lid.naam);
}

/** Namen vergelijken zoals de voortgang dat doet: kleine letters, één spatie. */
function normaliseerNaam(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * De bewaarde 2MINSCAN van één lid.
 *
 * De tabel twominscan_afnames draagt geen token, dus de naam is de enige
 * sleutel. Deze functie zoekt precies zoals de voortgang op /hdd zoekt, eerst
 * binnen de organisatie van het traject en daarna over alle organisaties. Die
 * tweede ronde is er omdat de organisatie bij de scan uit de uitnodiging komt en
 * niet altijd woord voor woord gelijk is aan het label van het traject. Zonder
 * die ronde meldde dit scherm dat er niets was, terwijl de voortgang de scan wel
 * zag staan.
 */
export function leesTwominscan(traject: HddTraject, lid: HddBoardLid): TwominscanBron {
  const token = tokensVan(lid.id)[TWOMINSCAN] ?? "";
  const gezocht = normaliseerNaam(lid.naam);
  let afname: BewaardeAfname | null = null;
  try {
    const org = (traject.orgLabel ?? "").trim();
    const binnenOrg = org ? leesAfnames(org, 500) : [];
    afname = binnenOrg.find((r) => normaliseerNaam(r.naam) === gezocht) ?? null;
    if (!afname) {
      afname = leesAfnames(undefined, 500).find((r) => normaliseerNaam(r.naam) === gezocht) ?? null;
    }
  } catch {
    afname = null;
  }
  return {
    uitgestuurd: Boolean(token),
    ingevuld: Boolean(afname),
    afname,
    herbouwbaar: Boolean(afname?.rapport),
  };
}

/** Het Kompas van één lid: het nummer van de afname en haar status. */
export async function leesKompas(lid: HddBoardLid): Promise<KompasBron> {
  const token = tokensVan(lid.id)[KOMPAS] ?? "";
  if (!token) return { uitgestuurd: false, ingevuld: false, afnameId: null, status: null };
  const afname = await storage.getAfnameByToken(token);
  if (!afname) return { uitgestuurd: true, ingevuld: false, afnameId: null, status: null };
  return {
    uitgestuurd: true,
    ingevuld: afname.status === "voltooid",
    afnameId: afname.id,
    status: afname.status ?? null,
  };
}

/** De drie bronnen samen, voor één lid van één traject. */
export async function leesLidRapportBronnen(
  traject: HddTraject,
  lid: HddBoardLid,
): Promise<LidRapportBronnen> {
  const [kompas] = await Promise.all([leesKompas(lid)]);
  return {
    trajectId: traject.id,
    lid: {
      id: lid.id,
      naam: lid.naam,
      email: lid.email ?? null,
      organisatie: traject.orgLabel ?? "",
      vrijgegeven: Boolean(lid.rapportVrijgaveOp),
    },
    teamscan: leesTeamscan(lid),
    twominscan: leesTwominscan(traject, lid),
    kompas,
  };
}
