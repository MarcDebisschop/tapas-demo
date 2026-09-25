// ---------------------------------------------------------------------------
// server/role-fit/service.ts
//
// De werkstappen van een Role Fit-case, los van HTTP. De routes toetsen wie
// iets mag; deze module doet het werk en bewaakt de statusmachine. Elke stap
// die een overgang maakt, doet dat atomisch (zetStatus met de verwachte
// vertrekstatus), zodat twee gelijktijdige verzoeken nooit allebei slagen.
// ---------------------------------------------------------------------------
import { randomBytes } from "node:crypto";
import {
  DIMENSIE_PER_ID,
  RF_CONTEXT_REGELVERSIE,
  RF_RAPPORTCONTRACT_VERSIE,
  taalcoachMeldingen,
  vindVerbodenTaal,
  type Aanbeveling,
  type BesluitInvoer,
  type CaseStatus,
  type ObservatieRegel,
  type Pakket,
  type RapportType,
} from "@shared/role-fit";
import {
  canoniek,
  db as rfDb,
  haal,
  hashToken,
  huidigeObservaties,
  laatsteArtefact,
  lijstVoorCase,
  nu,
  sha256,
  transactie,
  verwijderVoorCase,
  voegToe,
  volgendeArtefactVersie,
  wijzig,
  zetStatus,
} from "./storage";
import { berekenFitItems } from "./fit-engine";
import { maakOefening, standaardSelectie, stelHbomVoor, toetsSelectieAantal } from "./hbom-engine";
import { integreerHypothese, toetsBesluit, type GateVoorBesluit } from "./integration-engine";
import { claimsUitWizard, extraheerContext } from "./context-engine";
import { actieveAiProvider, AI_SYSTEEMPROMPT, bouwGebruikersprompt, valideerAiUitvoer, AI_PROMPT_VERSIE } from "./ai-provider";
import { CONTRACT_BOUWERS, invoerHash, lintContract, type Bundel } from "./report-contract";
import { RENDERERS } from "./reports";

export class ServiceFout extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(s: unknown, terug: T): T {
  if (typeof s !== "string") return terug;
  try {
    return JSON.parse(s) as T;
  } catch {
    return terug;
  }
}

const VOLGORDE: CaseStatus[] = [
  "DRAFT",
  "CONTEXT_REVIEW",
  "CONTEXT_FROZEN",
  "HBOM_READY",
  "OBSERVING",
  "OBSERVATIONS_LOCKED",
  "INTEGRATION_REVIEW",
  "DECISION_READY",
  "SIGNED",
];
/** Is de case minstens in status `s`? Een gearchiveerde case telt als voorbij alles. */
export function minstens(huidig: string, s: CaseStatus): boolean {
  if (huidig === "ARCHIVED") return true;
  return VOLGORDE.indexOf(huidig as CaseStatus) >= VOLGORDE.indexOf(s);
}

export function haalCase(id: number): any {
  const c = haal("role_fit_cases", id);
  if (!c || c.verwijderdOp) throw new ServiceFout("Case niet gevonden.", 404);
  return c;
}

function eisStatus(c: any, ...toegestaan: CaseStatus[]): void {
  // De status wordt altijd opnieuw uit de databank gelezen. Een route laadt de
  // case voor een await (toegangscontrole); een ander verzoek kan de status
  // intussen gewijzigd hebben. Wat hierna volgt, loopt synchroon.
  const actueel = rfDb().prepare("SELECT status FROM role_fit_cases WHERE id = ?").get(c.id) as { status: string } | undefined;
  if (actueel) c.status = actueel.status;
  if (!toegestaan.includes(c.status)) {
    throw new ServiceFout(`Deze stap kan niet in de status ${c.status}.`, 409, { status: c.status, toegestaan });
  }
}

function overgang(c: any, naar: CaseStatus, extra: Record<string, unknown> = {}): void {
  if (!zetStatus(c.id, c.status, naar, extra)) {
    throw new ServiceFout("De case werd intussen door iemand anders gewijzigd. Laad opnieuw.", 409);
  }
}

// ---- Taal ---------------------------------------------------------------------
export function eisSchoneTaal(velden: Record<string, string | string[] | undefined>): void {
  const meldingen: Array<{ veld: string; regel: string; fragment: string; uitleg: string }> = [];
  for (const [veld, waarde] of Object.entries(velden)) {
    const lijst = Array.isArray(waarde) ? waarde : [waarde];
    for (const t of lijst) for (const m of vindVerbodenTaal(t)) meldingen.push({ veld, regel: m.regel, fragment: m.fragment, uitleg: m.uitleg });
  }
  if (meldingen.length) throw new ServiceFout("De tekst bevat formuleringen die in dit dossier niet toegelaten zijn.", 422, { taal: meldingen });
}

// ---- Case -----------------------------------------------------------------------
export function maakCase(invoer: {
  organisatieId: number;
  afnameId: number;
  ownerAdminId: number;
  kandidaatLabel: string;
  velden: Record<string, unknown>;
  profiel: { instrument: string; contractversie: string; claims: any[] };
}): number {
  return transactie(() => {
    const id = voegToe("role_fit_cases", {
      ...invoer.velden,
      organisatieId: invoer.organisatieId,
      afnameId: invoer.afnameId,
      ownerAdminId: invoer.ownerAdminId,
      kandidaatLabel: invoer.kandidaatLabel,
      kandidaatGeinformeerd: true,
      status: "DRAFT",
      herkomst: "mens",
    });
    for (const p of invoer.profiel.claims) {
      voegToe("role_fit_profile_claims", {
        caseId: id,
        organisatieId: invoer.organisatieId,
        afnameId: invoer.afnameId,
        bronInstrument: invoer.profiel.instrument,
        bronContractversie: invoer.profiel.contractversie,
        claimCode: p.claimCode,
        construct: p.construct,
        familie: p.familie,
        net: p.net,
        gemEnergie: p.gemEnergie,
        energieStatus: p.energieStatus,
        volledig: p.volledig,
        contentHash: p.contentHash,
      });
    }
    return id;
  });
}

export function bewaarWizard(c: any, wizard: Record<string, unknown>, adminId: number): void {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  transactie(() => {
    if (wijzig("role_fit_cases", c.id, { wizardJson: JSON.stringify(wizard) }, { verwachteVersie: c.versie }) !== 1) {
      throw new ServiceFout("De case werd intussen gewijzigd. Laad opnieuw.", 409);
    }
    verwijderVoorCase("role_fit_context_claims", c.id, "AND herkomst = 'wizard'");
    for (const w of claimsUitWizard(wizard)) {
      voegToe("role_fit_context_claims", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        sourceId: null,
        categorie: w.categorie,
        claim: w.claim,
        bronpassage: w.claim,
        confidence: "medium",
        status: "approved",
        herkomst: "wizard",
        beoordeeldDoor: adminId,
        beoordeeldOp: nu(),
        contentHash: sha256({ categorie: w.categorie, claim: w.claim }),
      });
    }
  });
}

export function voegBronToe(c: any, bron: { type: string; titel: string; url: string | null; tekst: string }, adminId: number): number {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  return voegToe("role_fit_sources", {
    caseId: c.id,
    organisatieId: c.organisatieId,
    type: bron.type,
    titel: bron.titel,
    url: bron.url,
    tekst: bron.tekst,
    lengte: bron.tekst.length,
    toegevoegdDoor: adminId,
    contentHash: sha256(bron.tekst),
  });
}

export function verwijderBron(c: any, bronId: number): void {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  const b = haal("role_fit_sources", bronId);
  if (!b || b.caseId !== c.id) throw new ServiceFout("Bron niet gevonden.", 404);
  transactie(() => {
    verwijderVoorCase("role_fit_context_claims", c.id, "AND source_id = ?", bronId);
    verwijderVoorCase("role_fit_sources", c.id, "AND id = ?", bronId);
  });
}

// ---- Context-extractie ------------------------------------------------------
export async function extraheer(c: any, adminId: number): Promise<{ modus: "ai" | "regels"; voorstellen: number; verworpen: number; fout?: string }> {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  const bronnen = lijstVoorCase("role_fit_sources", c.id);
  const aiBronnen = bronnen.map((b) => ({ id: b.id as number, tekst: b.tekst as string }));
  const inputHash = sha256(canoniek({ bronnen: bronnen.map((b) => b.contentHash), prompt: AI_PROMPT_VERSIE }));
  const provider = actieveAiProvider();
  let voorstellen: Array<{ sourceId: number; categorie: string; claim: string; passage: string; passageStart: number; confidence: string; herkomst: string }> = [];
  let modus: "ai" | "regels" = "regels";
  let fout: string | undefined;
  let verworpen = 0;
  let aiRunId: number | null = null;

  if (provider && aiBronnen.length) {
    const runBasis = {
      caseId: c.id,
      organisatieId: c.organisatieId,
      taak: "context_extractie",
      provider: provider.naam,
      model: provider.model,
      promptversie: AI_PROMPT_VERSIE,
      bronIdsJson: JSON.stringify(aiBronnen.map((b) => b.id)),
      inputHash,
      gestartDoor: adminId,
    };
    try {
      const ruw = await provider.voerUit(AI_SYSTEEMPROMPT, bouwGebruikersprompt(aiBronnen));
      const v = valideerAiUitvoer(ruw, aiBronnen);
      if (!v.ok) {
        fout = v.fout;
        aiRunId = voegToe("role_fit_ai_runs", { ...runBasis, status: "rejected", fout: v.fout, outputHash: sha256(ruw) });
      } else {
        modus = "ai";
        verworpen = v.verworpen;
        aiRunId = voegToe("role_fit_ai_runs", { ...runBasis, status: "accepted", outputHash: sha256(ruw), aantalVoorstellen: v.claims.length });
        voorstellen = v.claims.map((k) => ({ sourceId: k.sourceId, categorie: k.categorie, claim: k.claim, passage: k.passage, passageStart: k.passageStart, confidence: "low", herkomst: "ai" }));
      }
    } catch (e: any) {
      fout = "De AI-provider was niet bereikbaar.";
      aiRunId = voegToe("role_fit_ai_runs", { ...runBasis, status: "failed", fout: String(e?.message ?? e).slice(0, 300) });
    }
  }
  if (modus === "regels") {
    for (const b of aiBronnen) {
      for (const k of extraheerContext(b.tekst)) {
        voorstellen.push({ sourceId: b.id, categorie: k.categorie, claim: k.claim, passage: k.bronpassage, passageStart: k.passageStart, confidence: k.confidence, herkomst: "engine" });
      }
    }
  }

  transactie(() => {
    // Tijdens de AI-oproep kan de case verder gegaan zijn.
    eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
    // Nog niet beoordeelde voorstellen van een vorige ronde vervallen; wat een
    // mens al goedkeurde of afwees, blijft staan.
    verwijderVoorCase("role_fit_context_claims", c.id, "AND status = 'proposed' AND herkomst IN ('engine','ai')");
    const bestaand = new Set(lijstVoorCase("role_fit_context_claims", c.id).map((k) => `${k.sourceId}|${k.claim}`));
    for (const v of voorstellen) {
      if (bestaand.has(`${v.sourceId}|${v.claim}`)) continue;
      voegToe("role_fit_context_claims", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        sourceId: v.sourceId,
        categorie: v.categorie,
        claim: v.claim,
        bronpassage: v.passage,
        passageStart: v.passageStart,
        confidence: v.confidence,
        aiRunId: v.herkomst === "ai" ? aiRunId : null,
        status: "proposed",
        herkomst: v.herkomst,
        contentHash: sha256({ categorie: v.categorie, claim: v.claim, passage: v.passage, regels: RF_CONTEXT_REGELVERSIE }),
      });
    }
    if (c.status === "DRAFT") overgang(c, "CONTEXT_REVIEW");
  });
  return { modus, voorstellen: voorstellen.length, verworpen, fout };
}

export function beoordeelClaim(c: any, claimId: number, inv: { status: string; claim?: string; categorie?: string; versie: number }, adminId: number): void {
  eisStatus(c, "CONTEXT_REVIEW");
  const k = haal("role_fit_context_claims", claimId);
  if (!k || k.caseId !== c.id) throw new ServiceFout("Claim niet gevonden.", 404);
  if (inv.status === "approved") eisSchoneTaal({ claim: inv.claim ?? k.claim });
  const velden: Record<string, unknown> = { status: inv.status, beoordeeldDoor: adminId, beoordeeldOp: nu() };
  if (inv.claim && inv.claim !== k.claim) {
    velden.claim = inv.claim;
    velden.herkomst = k.herkomst === "mens" ? "mens" : `${k.herkomst}+mens`;
  }
  if (inv.categorie) velden.categorie = inv.categorie;
  velden.contentHash = sha256({ categorie: velden.categorie ?? k.categorie, claim: velden.claim ?? k.claim, passage: k.bronpassage });
  if (wijzig("role_fit_context_claims", claimId, velden, { verwachteVersie: inv.versie }) !== 1) {
    throw new ServiceFout("Deze claim werd intussen door iemand anders beoordeeld. Laad opnieuw.", 409);
  }
}

export function voegClaimToe(c: any, inv: { categorie: string; claim: string }, adminId: number): number {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  eisSchoneTaal({ claim: inv.claim });
  return voegToe("role_fit_context_claims", {
    caseId: c.id,
    organisatieId: c.organisatieId,
    sourceId: null,
    categorie: inv.categorie,
    claim: inv.claim,
    bronpassage: inv.claim,
    confidence: "medium",
    status: "approved",
    herkomst: "mens",
    beoordeeldDoor: adminId,
    beoordeeldOp: nu(),
    contentHash: sha256({ categorie: inv.categorie, claim: inv.claim }),
  });
}

export function voegVereisteToe(c: any, inv: { dimensie: string; fitType?: string; vereiste: string; niveau: string; kriticiteit: string; bronClaimIds: number[] }, adminId: number): number {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  const gate = inv.kriticiteit === "gate" || inv.dimensie === "gate";
  const dim = DIMENSIE_PER_ID[inv.dimensie];
  if (!gate && !dim) throw new ServiceFout("Onbekende dimensie.", 400);
  if (gate && inv.niveau !== "knockout") throw new ServiceFout("Een gate heeft het niveau knock-out.", 400);
  if (!gate && inv.niveau === "knockout") throw new ServiceFout("Een knock-out-vereiste is altijd een gate.", 400);
  eisSchoneTaal({ vereiste: inv.vereiste });
  const claims = new Set(lijstVoorCase("role_fit_context_claims", c.id).map((k) => k.id));
  for (const id of inv.bronClaimIds) if (!claims.has(id)) throw new ServiceFout("Een gekoppelde claim hoort niet bij deze case.", 400);
  return voegToe("role_fit_requirements", {
    caseId: c.id,
    organisatieId: c.organisatieId,
    dimensie: gate ? "gate" : inv.dimensie,
    fitType: gate ? "demands_abilities" : inv.fitType ?? dim!.standaardFitType,
    vereiste: inv.vereiste,
    niveau: inv.niveau,
    kriticiteit: gate ? "gate" : inv.kriticiteit,
    bronClaimIds: JSON.stringify(inv.bronClaimIds),
    gateStatus: gate ? "open" : null,
    toegevoegdDoor: adminId,
    contentHash: sha256({ ...inv, gate }),
  });
}

export function verwijderVereiste(c: any, id: number): void {
  eisStatus(c, "DRAFT", "CONTEXT_REVIEW");
  if (!verwijderVoorCase("role_fit_requirements", c.id, "AND id = ?", id)) throw new ServiceFout("Vereiste niet gevonden.", 404);
}

export function bevestigContext(c: any, rol: "recruiter" | "hiring_manager"): void {
  eisStatus(c, "CONTEXT_REVIEW");
  const veld = rol === "recruiter" ? "recruiterBevestigdOp" : "hmBevestigdOp";
  if (wijzig("role_fit_cases", c.id, { [veld]: nu() }, { status: "CONTEXT_REVIEW" }) !== 1) throw new ServiceFout("De case is intussen gewijzigd.", 409);
}

function vereistenInvoer(caseId: number) {
  return lijstVoorCase("role_fit_requirements", caseId).map((v) => ({
    id: v.id,
    dimensie: v.dimensie,
    fitType: v.fitType,
    vereiste: v.vereiste,
    niveau: v.niveau,
    kriticiteit: v.kriticiteit,
    bronClaimIds: json<number[]>(v.bronClaimIds, []),
  }));
}

export function bevries(c: any, overrideReden: string | undefined, magOverride: boolean): void {
  eisStatus(c, "CONTEXT_REVIEW");
  const vereisten = vereistenInvoer(c.id);
  if (!vereisten.some((v) => v.kriticiteit !== "gate")) throw new ServiceFout("Leg minstens een vereiste vast die geen gate is.", 409);
  const claims = lijstVoorCase("role_fit_context_claims", c.id);
  if (claims.some((k) => k.status === "proposed")) throw new ServiceFout("Er staan nog claimvoorstellen open. Keur ze goed of wijs ze af.", 409);
  const beideBevestigd = !!c.recruiterBevestigdOp && !!c.hmBevestigdOp;
  if (!beideBevestigd) {
    if (!overrideReden) throw new ServiceFout("Recruiter en hiring manager moeten de context bevestigen, of geef een reden om zonder beide bevestigingen te bevriezen.", 409);
    if (!magOverride) throw new ServiceFout("Enkel de case-eigenaar of een prior-beheerder mag zonder beide bevestigingen bevriezen.", 403);
    eisSchoneTaal({ overrideReden });
  }
  const profiel = lijstVoorCase("role_fit_profile_claims", c.id).map((p) => ({
    claimCode: p.claimCode,
    construct: p.construct,
    net: p.net,
    gemEnergie: p.gemEnergie,
    energieStatus: p.energieStatus,
    volledig: !!p.volledig,
  }));
  const items = berekenFitItems(
    vereisten as any,
    profiel,
    claims.map((k) => ({ id: k.id, sourceId: k.sourceId, status: k.status })),
  );
  transactie(() => {
    verwijderVoorCase("role_fit_fit_items", c.id);
    for (const it of items) {
      voegToe("role_fit_fit_items", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        requirementId: it.requirementId,
        fitType: it.fitType,
        indicatie: it.indicatie,
        confidence: it.confidence,
        kriticiteit: it.kriticiteit,
        ontwikkelafstand: it.ontwikkelafstand,
        energie: it.energie,
        detailJson: JSON.stringify(it),
        regelversie: it.regelversie,
        contentHash: sha256(it),
      });
    }
    overgang(c, "CONTEXT_FROZEN", { bevrorenOp: nu(), freezeOverrideReden: beideBevestigd ? null : overrideReden });
  });
}

// ---- H-BOM ------------------------------------------------------------------
export function stelHbomOp(c: any): { pool: number; waarschuwingen: string[] } {
  eisStatus(c, "CONTEXT_FROZEN");
  const vereisten = new Map(lijstVoorCase("role_fit_requirements", c.id).map((v) => [v.id, v]));
  const items = lijstVoorCase("role_fit_fit_items", c.id).map((f) => {
    const d = json<any>(f.detailJson, {});
    const v = vereisten.get(f.requirementId);
    return {
      id: f.id,
      requirementId: f.requirementId,
      indicatie: f.indicatie,
      confidence: f.confidence,
      kriticiteit: f.kriticiteit,
      gate: !!d.gate,
      dimensie: v?.dimensie ?? "",
      vereiste: v?.vereiste ?? "",
      bronClaimIds: json<number[]>(v?.bronClaimIds, []),
      profielClaimCodes: d.profielClaimCodes ?? [],
    };
  });
  const voorstel = stelHbomVoor(items as any);
  if (voorstel.pool.length < 3) throw new ServiceFout(voorstel.waarschuwingen[0] ?? "Te weinig hypothesen.", 409);
  transactie(() => {
    verwijderVoorCase("role_fit_hypotheses", c.id);
    for (const h of voorstel.pool) {
      voegToe("role_fit_hypotheses", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        fitItemId: h.fitItemId,
        requirementId: h.requirementId,
        stelling: h.stelling,
        tegenhypothese: h.tegenhypothese,
        bronClaimIds: JSON.stringify(h.bronClaimIds),
        kriticiteit: h.kriticiteit,
        onzekerheid: h.onzekerheid,
        observeerbaarheid: h.observeerbaarheid,
        prioriteit: h.prioriteit,
        methode: h.methode,
        detailJson: JSON.stringify({
          dimensie: h.dimensie,
          profielClaimCodes: h.profielClaimCodes,
          bevestigendeIndicatoren: h.bevestigendeIndicatoren,
          tegenIndicatoren: h.tegenIndicatoren,
          alternatieveVerklaringen: h.alternatieveVerklaringen,
        }),
        verbodenInferentie: h.verbodenInferentie,
        rang: h.rang,
        geselecteerd: false,
        regelversie: h.regelversie,
        contentHash: sha256(h),
      });
    }
  });
  return { pool: voorstel.pool.length, waarschuwingen: voorstel.waarschuwingen };
}

export function kiesPakket(c: any, pakket: Pakket, aantal?: number): number[] {
  eisStatus(c, "CONTEXT_FROZEN");
  const pool = lijstVoorCase("role_fit_hypotheses", c.id);
  if (!pool.length) throw new ServiceFout("Stel eerst de hypothesepool op.", 409);
  const rangen = new Set(standaardSelectie(pool, pakket, aantal));
  transactie(() => {
    wijzig("role_fit_cases", c.id, { pakket }, { status: "CONTEXT_FROZEN" });
    for (const h of pool) wijzig("role_fit_hypotheses", h.id, { geselecteerd: rangen.has(h.rang) });
  });
  return pool.filter((h) => rangen.has(h.rang)).map((h) => h.id);
}

const TOKEN_GELDIG_DAGEN = 30;
function nieuwToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Keurt de selectie goed, maakt oefeningen en observatorlinks. Geeft de tokens EENMALIG terug. */
export function keurHbomGoed(c: any, hypotheseIds: number[], adminId: number): { recruiter: string; hiring_manager: string } {
  eisStatus(c, "CONTEXT_FROZEN");
  if (!c.pakket) throw new ServiceFout("Kies eerst een pakket.", 409);
  const fout = toetsSelectieAantal(c.pakket, hypotheseIds.length);
  if (fout) throw new ServiceFout(fout, 400);
  const pool = lijstVoorCase("role_fit_hypotheses", c.id);
  const perId = new Map(pool.map((h) => [h.id, h]));
  for (const id of hypotheseIds) if (!perId.has(id)) throw new ServiceFout("Een gekozen hypothese hoort niet bij deze case.", 400);
  if (new Set(hypotheseIds).size !== hypotheseIds.length) throw new ServiceFout("Een hypothese staat dubbel in de selectie.", 400);
  const tokens = { recruiter: nieuwToken(), hiring_manager: nieuwToken() };
  const verloopt = new Date(Date.now() + TOKEN_GELDIG_DAGEN * 86400000).toISOString();
  transactie(() => {
    verwijderVoorCase("role_fit_exercises", c.id);
    verwijderVoorCase("role_fit_observer_assignments", c.id);
    const gekozen = hypotheseIds.map((id) => perId.get(id)!).sort((a, b) => a.rang - b.rang);
    for (const h of pool) wijzig("role_fit_hypotheses", h.id, { geselecteerd: hypotheseIds.includes(h.id), status: hypotheseIds.includes(h.id) ? "approved" : "proposed" });
    gekozen.forEach((h, i) => {
      const d = json<any>(h.detailJson, {});
      const o = maakOefening(d.dimensie, c.functieTitel);
      voegToe("role_fit_exercises", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        hypothesisId: h.id,
        volgorde: i + 1,
        methode: o.methode,
        titel: o.titel,
        instructie: o.instructie,
        probesJson: JSON.stringify(o.probes),
        ankersJson: JSON.stringify(o.ankers),
        goedgekeurdDoor: adminId,
        goedgekeurdOp: nu(),
        contentHash: sha256(o),
      });
    });
    for (const rol of ["recruiter", "hiring_manager"] as const) {
      voegToe("role_fit_observer_assignments", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        rol,
        actorNaam: rol === "recruiter" ? c.recruiterNaam : c.hmNaam,
        actorEmail: rol === "recruiter" ? c.recruiterEmail : c.hmEmail,
        adminId: rol === "recruiter" ? c.recruiterAdminId : c.hmAdminId,
        tokenHash: hashToken(tokens[rol]),
        verlooptOp: verloopt,
        status: "issued",
      });
    }
    overgang(c, "HBOM_READY");
  });
  return tokens;
}

export function vernieuwLink(c: any, rol: "recruiter" | "hiring_manager"): string {
  eisStatus(c, "HBOM_READY", "OBSERVING");
  const o = lijstVoorCase("role_fit_observer_assignments", c.id, "AND rol = ?", rol)[0];
  if (!o) throw new ServiceFout("Opdracht niet gevonden.", 404);
  if (o.ingediendOp) throw new ServiceFout("Deze observator heeft al ingediend.", 409);
  const token = nieuwToken();
  const verloopt = new Date(Date.now() + TOKEN_GELDIG_DAGEN * 86400000).toISOString();
  if (wijzig("role_fit_observer_assignments", o.id, { tokenHash: hashToken(token), verlooptOp: verloopt }, { verwachteVersie: o.versie }) !== 1)
    throw new ServiceFout("De opdracht werd intussen gewijzigd.", 409);
  return token;
}

export function startObservatie(c: any): void {
  eisStatus(c, "HBOM_READY");
  overgang(c, "OBSERVING");
}

// ---- Observatie (publiek, via token) ----------------------------------------
export function opdrachtContext(o: any): { zaak: any; oefeningen: any[] } {
  const zaak = haalCase(o.caseId);
  if (new Date(o.verlooptOp).getTime() < Date.now()) throw new ServiceFout("Deze link is verlopen.", 410);
  if (zaak.status === "ARCHIVED") throw new ServiceFout("Deze case is gearchiveerd.", 410);
  const oefeningen = lijstVoorCase("role_fit_exercises", zaak.id).sort((a, b) => a.volgorde - b.volgorde);
  return { zaak, oefeningen };
}

function controleerRegels(regels: ObservatieRegel[], oefeningen: any[], volledig: boolean): void {
  const ids = new Set(oefeningen.map((e) => e.id));
  const gezien = new Set<number>();
  for (const r of regels) {
    if (!ids.has(r.exerciseId)) throw new ServiceFout("Een observatie verwijst naar een oefening die niet bij deze case hoort.", 400);
    if (gezien.has(r.exerciseId)) throw new ServiceFout("Een oefening staat dubbel.", 400);
    gezien.add(r.exerciseId);
  }
  if (!volledig) return;
  if (gezien.size !== ids.size) throw new ServiceFout("Leg voor elke oefening een observatie vast, of duid onvoldoende observatiekans aan.", 400);
  for (const r of regels) {
    if (r.onvoldoendeKans) continue;
    if (r.barsScore === null) throw new ServiceFout("Kies een anker (1, 3 of 5) of duid onvoldoende observatiekans aan.", 400);
    if (!r.bewijskwaliteit) throw new ServiceFout("Geef bij elke observatie de bewijskwaliteit aan.", 400);
    if (r.gedrag.trim().length < 10) throw new ServiceFout("Beschrijf het waargenomen gedrag concreet (minstens tien tekens).", 400);
    // Verplichte velden volgens de observator-UX van het bouwplan (par. 12).
    if (!r.contextTrigger.trim()) throw new ServiceFout("Beschrijf de context of de aanleiding van het gedrag.", 400);
    if (!r.quoteActie.trim()) throw new ServiceFout("Noteer een letterlijk citaat of een concrete actie.", 400);
    if (!r.effect.trim()) throw new ServiceFout("Beschrijf het effect of het gevolg van het gedrag.", 400);
    if (!r.alternatieveVerklaring.trim()) throw new ServiceFout("Noteer een mogelijke andere verklaring voor wat u zag.", 400);
  }
}

export function taalSignalen(r: ObservatieRegel) {
  const tekst = [r.contextTrigger, r.gedrag, r.quoteActie, r.effect, r.alternatieveVerklaring].join("\n");
  return taalcoachMeldingen(tekst);
}

export function bewaarConcept(o: any, regels: ObservatieRegel[]): void {
  const { zaak, oefeningen } = opdrachtContext(o);
  if (zaak.status !== "OBSERVING") throw new ServiceFout("De observatie staat niet open.", 409);
  if (o.ingediendOp) throw new ServiceFout("Deze observatie is al ingediend en vergrendeld.", 409);
  controleerRegels(regels, oefeningen, false);
  if (wijzig("role_fit_observer_assignments", o.id, { conceptJson: JSON.stringify({ regels }), status: "in_progress" }, { verwachteVersie: o.versie }) !== 1)
    throw new ServiceFout("Het concept werd intussen gewijzigd. Laad opnieuw.", 409);
}

export function dienIn(o: any, regels: ObservatieRegel[], bevestigTaalcoach: boolean): { vergrendeld: boolean } {
  const { zaak, oefeningen } = opdrachtContext(o);
  if (zaak.status !== "OBSERVING") throw new ServiceFout("De observatie staat niet open.", 409);
  controleerRegels(regels, oefeningen, true);
  const signalen = regels.flatMap((r) => taalSignalen(r).map((m) => ({ oefening: r.exerciseId, ...m })));
  if (signalen.length && !bevestigTaalcoach) {
    throw new ServiceFout("De taalcoach vond interpretaties in plaats van waarnemingen. Pas aan of bevestig bewust.", 422, { taal: signalen });
  }
  let vergrendeld = false;
  transactie(() => {
    // Atomisch: enkel de eerste indiening slaagt. Een tweede indiening vindt
    // geen rij meer met ingediend_op IS NULL.
    const gewijzigd = wijzigIndien(o.id);
    if (gewijzigd !== 1) throw new ServiceFout("Deze observatie is al ingediend.", 409);
    for (const regel of regels) {
      const inhoud = { ...regel, taalsignalen: taalSignalen(regel) };
      voegToe("role_fit_observations", {
        caseId: zaak.id,
        organisatieId: zaak.organisatieId,
        assignmentId: o.id,
        exerciseId: regel.exerciseId,
        contextTrigger: regel.contextTrigger,
        gedrag: regel.gedrag,
        quoteActie: regel.quoteActie,
        effect: regel.effect,
        barsScore: regel.onvoldoendeKans ? null : regel.barsScore,
        onvoldoendeKans: regel.onvoldoendeKans,
        bewijskwaliteit: regel.bewijskwaliteit,
        alternatieveVerklaring: regel.alternatieveVerklaring,
        confidence: regel.confidence,
        taalsignalenJson: JSON.stringify(inhoud.taalsignalen),
        versie: 1,
        status: "submitted",
        contentHash: sha256(inhoud),
      });
    }
    const open = lijstVoorCase("role_fit_observer_assignments", zaak.id, "AND ingediend_op IS NULL");
    if (open.length === 0) {
      vergrendeld = zetStatus(zaak.id, "OBSERVING", "OBSERVATIONS_LOCKED");
    }
  });
  return { vergrendeld };
}

function wijzigIndien(opdrachtId: number): number {
  const t = nu();
  return rfDb()
    .prepare(
      "UPDATE role_fit_observer_assignments SET ingediend_op = ?, status = 'submitted', concept_json = '{}', versie = versie + 1, updated_at = ? WHERE id = ? AND ingediend_op IS NULL",
    )
    .run(t, t, opdrachtId).changes;
}

export function corrigeer(o: any, regel: ObservatieRegel, reden: string): number {
  const { zaak, oefeningen } = opdrachtContext(o);
  if (zaak.status !== "OBSERVATIONS_LOCKED") throw new ServiceFout("Correcties kunnen enkel na vergrendeling en voor de integratie.", 409);
  controleerRegels([regel], oefeningen, false);
  controleerRegels([regel], oefeningen.filter((e) => e.id === regel.exerciseId), true);
  eisSchoneTaal({ reden });
  return transactie(() => {
    const vorige = lijstVoorCase("role_fit_observations", zaak.id, "AND assignment_id = ? AND exercise_id = ?", o.id, regel.exerciseId);
    const versie = vorige.reduce((m, x) => Math.max(m, x.versie), 0) + 1;
    const inhoud = { ...regel, taalsignalen: taalSignalen(regel) };
    voegToe("role_fit_observations", {
      caseId: zaak.id,
      organisatieId: zaak.organisatieId,
      assignmentId: o.id,
      exerciseId: regel.exerciseId,
      contextTrigger: regel.contextTrigger,
      gedrag: regel.gedrag,
      quoteActie: regel.quoteActie,
      effect: regel.effect,
      barsScore: regel.onvoldoendeKans ? null : regel.barsScore,
      onvoldoendeKans: regel.onvoldoendeKans,
      bewijskwaliteit: regel.bewijskwaliteit,
      alternatieveVerklaring: regel.alternatieveVerklaring,
      confidence: regel.confidence,
      taalsignalenJson: JSON.stringify(inhoud.taalsignalen),
      correctieReden: reden,
      versie,
      status: "submitted",
      contentHash: sha256(inhoud),
    });
    return versie;
  });
}

// ---- Integratie ------------------------------------------------------------
export function berekenIntegratie(c: any): void {
  eisStatus(c, "OBSERVATIONS_LOCKED");
  const hyp = lijstVoorCase("role_fit_hypotheses", c.id, "AND geselecteerd = 1");
  const fit = new Map(lijstVoorCase("role_fit_fit_items", c.id).map((f) => [f.id, f]));
  const oef = lijstVoorCase("role_fit_exercises", c.id);
  const opdr = new Map(lijstVoorCase("role_fit_observer_assignments", c.id).map((o) => [o.id, o]));
  const obs = huidigeObservaties(c.id);
  transactie(() => {
    verwijderVoorCase("role_fit_integrations", c.id);
    for (const h of hyp) {
      const e = oef.find((x) => x.hypothesisId === h.id);
      const perRol = obs
        .filter((o) => e && o.exerciseId === e.id)
        .map((o) => ({
          rol: opdr.get(o.assignmentId)?.rol,
          barsScore: o.barsScore,
          onvoldoendeKans: !!o.onvoldoendeKans,
          bewijskwaliteit: o.bewijskwaliteit,
        }));
      const indicatie = fit.get(h.fitItemId)?.indicatie ?? "not_assessable";
      const u = integreerHypothese(indicatie, perRol as any);
      voegToe("role_fit_integrations", {
        caseId: c.id,
        organisatieId: c.organisatieId,
        hypothesisId: h.id,
        berekendeStatus: u.status,
        integratieStatus: u.status,
        detailJson: JSON.stringify(u),
        regelversie: u.regelversie,
        contentHash: sha256(u),
      });
    }
    overgang(c, "INTEGRATION_REVIEW");
  });
}

export function reviewIntegratie(
  c: any,
  inv: { overrides: Array<{ hypotheseId: number; status: string; reden: string }>; gates: Array<{ vereisteId: number; status: string; toelichting: string }> },
  adminId: number,
): void {
  eisStatus(c, "INTEGRATION_REVIEW");
  const integr = lijstVoorCase("role_fit_integrations", c.id);
  const vereisten = new Map(lijstVoorCase("role_fit_requirements", c.id).map((v) => [v.id, v]));
  eisSchoneTaal({ reden: inv.overrides.map((o) => o.reden), toelichting: inv.gates.map((g) => g.toelichting) });
  transactie(() => {
    for (const o of inv.overrides) {
      const i = integr.find((x) => x.hypothesisId === o.hypotheseId);
      if (!i) throw new ServiceFout("Hypothese hoort niet bij deze integratie.", 400);
      wijzig("role_fit_integrations", i.id, {
        integratieStatus: o.status,
        overrideReden: o.status === i.berekendeStatus ? null : o.reden,
        reviewerId: adminId,
        herkomst: o.status === i.berekendeStatus ? "engine" : "engine+mens",
        contentHash: sha256({ detail: i.detailJson, status: o.status, reden: o.reden }),
      });
    }
    for (const g of inv.gates) {
      const v = vereisten.get(g.vereisteId);
      if (!v || v.kriticiteit !== "gate") throw new ServiceFout("Enkel een gate van deze case krijgt een gatestatus.", 400);
      wijzig("role_fit_requirements", v.id, { gateStatus: g.status, gateToelichting: g.toelichting, contentHash: sha256({ v: v.contentHash, g }) });
    }
  });
}

export function integratieKlaar(c: any): void {
  eisStatus(c, "INTEGRATION_REVIEW");
  overgang(c, "DECISION_READY");
}

export function terugNaarIntegratie(c: any): void {
  eisStatus(c, "DECISION_READY");
  overgang(c, "INTEGRATION_REVIEW");
}

export function gatesVoorBesluit(caseId: number): GateVoorBesluit[] {
  return lijstVoorCase("role_fit_requirements", caseId, "AND kriticiteit = 'gate'").map((v) => ({ vereisteId: v.id, vereiste: v.vereiste, status: v.gateStatus ?? "open" }));
}

export function teken(c: any, inv: BesluitInvoer, signer: { id: number; naam: string }): number {
  eisStatus(c, "DECISION_READY");
  const toets = toetsBesluit(gatesVoorBesluit(c.id), inv.aanbeveling as Aanbeveling, inv.voorwaarden);
  if (toets.fouten.length) throw new ServiceFout(toets.fouten[0], 422, { fouten: toets.fouten, toegestaan: toets.toegestaan });
  eisSchoneTaal({ rationale: inv.rationale, voorwaarden: inv.voorwaarden, plan100: inv.plan100, plan180: inv.plan180, kandidaatFeedback: inv.kandidaatFeedback, stappen: inv.vervolgstappen.map((s) => s.stap) });
  const bundel = laadBundel(c.id);
  const inputHash = invoerHash({ ...bundel, besluit: null }, "decision-dossier");
  const detail = {
    voorwaarden: inv.voorwaarden,
    vervolgstappen: inv.vervolgstappen,
    plan100: inv.plan100,
    plan180: inv.plan180,
    kandidaatFeedback: inv.kandidaatFeedback,
    ondertekenaarNaam: signer.naam,
  };
  return transactie(() => {
    const id = voegToe("role_fit_decisions", {
      caseId: c.id,
      organisatieId: c.organisatieId,
      aanbeveling: inv.aanbeveling,
      rationale: inv.rationale,
      detailJson: JSON.stringify(detail),
      signerAdminId: signer.id,
      signedAt: nu(),
      inputHash,
      contentHash: sha256({ aanbeveling: inv.aanbeveling, rationale: inv.rationale, detail, inputHash }),
    });
    overgang(c, "SIGNED");
    return id;
  });
}

export function archiveer(c: any): void {
  if (c.status === "ARCHIVED") throw new ServiceFout("De case is al gearchiveerd.", 409);
  overgang(c, "ARCHIVED", { gearchiveerdOp: nu() });
}

// ---- Bundel en rapporten -----------------------------------------------------
export function laadBundel(caseId: number): Bundel {
  const zaak = haalCase(caseId);
  const besluit = lijstVoorCase("role_fit_decisions", caseId)[0] ?? null;
  return {
    zaak,
    wizard: json<Record<string, any>>(zaak.wizardJson, {}),
    bronnen: lijstVoorCase("role_fit_sources", caseId),
    claims: lijstVoorCase("role_fit_context_claims", caseId),
    vereisten: lijstVoorCase("role_fit_requirements", caseId),
    profielClaims: lijstVoorCase("role_fit_profile_claims", caseId),
    fitItems: lijstVoorCase("role_fit_fit_items", caseId),
    hypothesen: lijstVoorCase("role_fit_hypotheses", caseId).sort((a, b) => a.rang - b.rang),
    oefeningen: lijstVoorCase("role_fit_exercises", caseId).sort((a, b) => a.volgorde - b.volgorde),
    opdrachten: lijstVoorCase("role_fit_observer_assignments", caseId),
    observaties: huidigeObservaties(caseId),
    integraties: lijstVoorCase("role_fit_integrations", caseId),
    besluit,
  };
}

export const RAPPORT_MINIMUM: Record<RapportType, CaseStatus> = {
  "fit-dossier": "CONTEXT_FROZEN",
  "hbom-guide": "HBOM_READY",
  "decision-dossier": "INTEGRATION_REVIEW",
  "kandidaat-feedback": "SIGNED",
};

export type PdfRenderer = (html: string, opts: { titel: string }) => Promise<Buffer>;

/**
 * Maakt of hergebruikt een rapportartefact. Is de invoer onveranderd sinds
 * de vorige versie, dan komt die versie terug. Anders volgt een nieuwe
 * versie; bestaande versies blijven onaangeroerd (de databank verbiedt ook
 * elke wijziging).
 */
export async function maakRapport(
  caseId: number,
  type: RapportType,
  adminId: number,
  renderPdf: PdfRenderer | null,
): Promise<{ artefact: any; hergebruikt: boolean }> {
  const bundel = laadBundel(caseId);
  if (!minstens(bundel.zaak.status, RAPPORT_MINIMUM[type]) || bundel.zaak.status === "ARCHIVED") {
    throw new ServiceFout(`Dit rapport kan pas vanaf status ${RAPPORT_MINIMUM[type]}.`, 409);
  }
  const inputHash = invoerHash(bundel, type);
  const vorige = laatsteArtefact(caseId, type);
  if (vorige && vorige.inputHash === inputHash) return { artefact: vorige, hergebruikt: true };

  const contract = CONTRACT_BOUWERS[type](bundel);
  const taal = lintContract(contract);
  if (taal.length) throw new ServiceFout("Het rapport bevat verboden formuleringen en werd niet aangemaakt.", 500, { taal });
  const html = RENDERERS[type](contract);
  let pdfBase64: string | null = null;
  if (renderPdf) {
    const buf = await renderPdf(html, { titel: String((contract as any).zaak?.functieTitel ?? type) });
    pdfBase64 = buf.toString("base64");
  }
  const contractJson = canoniek(contract);
  const versie = volgendeArtefactVersie(caseId, type);
  const id = voegToe("role_fit_artifacts", {
    caseId,
    organisatieId: bundel.zaak.organisatieId,
    type,
    contractJson,
    inputHash,
    pdfBase64,
    gegenereerdDoor: adminId,
    contractversie: RF_RAPPORTCONTRACT_VERSIE,
    versie,
    status: "final",
    contentHash: sha256(contractJson),
  });
  return { artefact: haal("role_fit_artifacts", id), hergebruikt: false };
}

/** HTML voor een contract, bijvoorbeeld voor een voorbeeldweergave of wanneer geen browser beschikbaar is. */
export function htmlVoorArtefact(a: any): string {
  return RENDERERS[a.type as RapportType](JSON.parse(a.contractJson));
}
