// ---------------------------------------------------------------------------
// server/toc-kompas/service.ts
//
// De werkstappen van het TOC Commitmentkompas, los van HTTP. De routes toetsen
// wie iets mag; deze module doet het werk en bewaakt de rondestatus:
//
//   INTAKE        de vier Captains vullen individueel in via hun eigen link;
//                 niemand ziet antwoorden van een ander, ook de beheerder niet.
//   CONSOLIDATIE  alle vier hebben ingediend (automatisch) of de ronde werd met
//                 een reden vergrendeld; signalen, register, Coverage Matrix en
//                 Decision Log worden in de workshop opgebouwd.
//   VASTGESTELD   het TOC heeft het register vastgesteld; enkel de status van
//                 een commitment (groen, amber, rood, geblokkeerd) wijzigt nog.
//   AFGESLOTEN    het kwartaal is afgesloten; alles is alleen-lezen.
//
// Een overgang gebeurt atomisch: de rij verandert enkel als de vertrekstatus
// nog klopt, zodat twee gelijktijdige verzoeken nooit allebei slagen.
// ---------------------------------------------------------------------------
import {
  ACCEPTATIECRITERIA,
  BELEGD_DOMEINEN,
  CAPTAIN_ROL_INFO,
  CAPTAIN_ROLLEN,
  DOMEINEN,
  KAART_VERPLICHT_VOOR_VASTSTELLING,
  TOC_KOMPAS_MODULE_VERSIE,
  antwoordenSchema,
  bedrijfsleidingRijenGevuld,
  commitmentCode,
  deliveryRijenGevuld,
  indienFouten,
  isLeeg,
  legeAntwoorden,
  type Antwoorden,
  type BesluitInvoer,
  type CaptainRol,
  type CommitmentInvoer,
  type CommitmentStatus,
  type CoverageRij,
  type MaakRondeInvoer,
  type RapportType,
  type RondeStatus,
} from "@shared/toc-kompas";
import { alleRondes, canoniek, captainVoorToken, db, haal, lijst, nieuwToken, nu, sha256, transactie, voegToe, wijzig } from "./storage";
import { consolideer, toetsAutomatisch, type CaptainInvoer, type Consolidatie } from "./consolidatie";
import { RENDERERS } from "./rapporten";

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

const VOLGORDE: RondeStatus[] = ["INTAKE", "CONSOLIDATIE", "VASTGESTELD", "AFGESLOTEN"];
export function minstens(huidig: string, s: RondeStatus): boolean {
  return VOLGORDE.indexOf(huidig as RondeStatus) >= VOLGORDE.indexOf(s);
}

function eisStatus(ronde: any, ...toegestaan: RondeStatus[]): void {
  if (!toegestaan.includes(ronde.status)) {
    throw new ServiceFout(`Deze stap kan niet in de fase "${ronde.status}". Toegestaan: ${toegestaan.join(", ")}.`, 409);
  }
}

/** Zet de status enkel als de vertrekstatus nog klopt. */
function zetStatus(rondeId: number, van: RondeStatus, naar: RondeStatus, extra: Record<string, unknown> = {}): void {
  const r = haalRonde(rondeId);
  const n = wijzig("toc_kompas_rondes", rondeId, { status: naar, versie: r.versie + 1, updatedAt: nu(), ...extra }, { kolom: "status", waarde: van });
  if (n !== 1) throw new ServiceFout("De ronde werd intussen door iemand anders gewijzigd. Laad de pagina opnieuw.", 409);
}

// ---- Rondes en Captains ----------------------------------------------------------------------
export function haalRonde(id: number): any {
  const r = haal("toc_kompas_rondes", id);
  if (!r) throw new ServiceFout("Ronde niet gevonden.", 404);
  return r;
}

export function captainsVan(rondeId: number): any[] {
  const rijen = lijst("toc_kompas_captains", "rondeId", rondeId);
  return rijen.sort((a, b) => CAPTAIN_ROLLEN.indexOf(a.rol) - CAPTAIN_ROLLEN.indexOf(b.rol));
}

function haalCaptain(rondeId: number, captainId: number): any {
  const c = haal("toc_kompas_captains", captainId);
  if (!c || c.rondeId !== rondeId) throw new ServiceFout("Captain niet gevonden in deze ronde.", 404);
  return c;
}

/** Wat de beheerder over een Captain mag zien. Nooit het token, nooit de antwoorden. */
export function captainPubliek(c: any) {
  const concept = json<Record<string, unknown>>(c.conceptJson, {});
  return {
    id: c.id,
    rol: c.rol as CaptainRol,
    titel: CAPTAIN_ROL_INFO[c.rol as CaptainRol].titel,
    naam: c.naam,
    email: c.email,
    status: c.ingediendOp ? "ingediend" : c.conceptVersie > 0 && Object.keys(concept).length > 0 ? "concept" : "niet_gestart",
    conceptOp: c.conceptOp,
    ingediendOp: c.ingediendOp,
    linkVernieuwdOp: c.linkVernieuwdOp,
    heeftIndiening: c.laatsteIndieningId !== null,
  };
}

export function rondePubliek(r: any) {
  return {
    id: r.id,
    titel: r.titel,
    periode: r.periode,
    deadline: r.deadline,
    status: r.status as RondeStatus,
    vergrendeldOp: r.vergrendeldOp,
    vergrendelReden: r.vergrendelReden,
    vastgesteldOp: r.vastgesteldOp,
    vaststelToelichting: r.vaststelToelichting,
    afgeslotenOp: r.afgeslotenOp,
    afsluitToelichting: r.afsluitToelichting,
    coverageVersie: r.coverageVersie,
    acceptatieVersie: r.acceptatieVersie,
    versie: r.versie,
    createdAt: r.createdAt,
  };
}

export function lijstRondes() {
  return alleRondes().map((r) => {
    const cs = captainsVan(r.id).map(captainPubliek);
    return { ...rondePubliek(r), ingediend: cs.filter((c) => c.status === "ingediend").length, captains: cs.length };
  });
}

export function maakRonde(invoer: MaakRondeInvoer, adminId: number): { ronde: any; links: Array<{ captainId: number; rol: CaptainRol; naam: string; token: string }> } {
  const rollen = new Set(invoer.captains.map((c) => c.rol));
  if (rollen.size !== CAPTAIN_ROLLEN.length) {
    throw new ServiceFout("Elke ronde heeft precies de vier Captains: Talent & Innovation, Execution & Horizon, The Academy en Visibility.", 400);
  }
  const bestaand = db().prepare("SELECT id FROM toc_kompas_rondes WHERE periode = ?").get(invoer.periode);
  if (bestaand) throw new ServiceFout(`Er bestaat al een ronde voor ${invoer.periode}.`, 409);
  const t = nu();
  return transactie(() => {
    const rondeId = voegToe("toc_kompas_rondes", {
      titel: invoer.titel,
      periode: invoer.periode,
      deadline: invoer.deadline,
      status: "INTAKE",
      ownerAdminId: adminId,
      createdAt: t,
      updatedAt: t,
    });
    const links = CAPTAIN_ROLLEN.map((rol) => {
      const c = invoer.captains.find((x) => x.rol === rol)!;
      const { token, hash } = nieuwToken();
      const captainId = voegToe("toc_kompas_captains", { rondeId, rol, naam: c.naam, email: c.email, tokenHash: hash, createdAt: t, updatedAt: t });
      return { captainId, rol, naam: c.naam, token };
    });
    return { ronde: haalRonde(rondeId), links };
  });
}

export function vernieuwLink(rondeId: number, captainId: number): { token: string } {
  const r = haalRonde(rondeId);
  if (r.status === "AFGESLOTEN") throw new ServiceFout("Het kwartaal is afgesloten; links worden niet meer vernieuwd.", 409);
  haalCaptain(rondeId, captainId);
  const { token, hash } = nieuwToken();
  const t = nu();
  wijzig("toc_kompas_captains", captainId, { tokenHash: hash, linkVernieuwdOp: t, updatedAt: t });
  return { token };
}

// ---- Invullen via de persoonlijke link --------------------------------------------------------
export function captainVoorLink(token: string): { captain: any; ronde: any } {
  const captain = captainVoorToken(token);
  if (!captain) throw new ServiceFout("Link niet gevonden.", 404);
  return { captain, ronde: haalRonde(captain.rondeId) };
}

function laatsteIndiening(c: any): any | null {
  return c.laatsteIndieningId ? haal("toc_kompas_indieningen", c.laatsteIndieningId) : null;
}

function antwoordenUit(s: unknown): Antwoorden {
  const p = antwoordenSchema.safeParse(json(s, {}));
  return p.success ? p.data : legeAntwoorden();
}

/** Wat de Captain ziet: enkel eigen gegevens. */
export function invulStatus(token: string) {
  const { captain, ronde } = captainVoorLink(token);
  const ind = laatsteIndiening(captain);
  const bewerkbaar = ronde.status === "INTAKE" && !captain.ingediendOp;
  // Na indienen staat de ingediende inhoud ook in het concept, zodat een
  // heropende vragenlijst verder gaat waar de Captain was.
  const heeftConcept = Object.keys(json<Record<string, unknown>>(captain.conceptJson, {})).length > 0;
  const antwoorden = bewerkbaar || !ind
    ? heeftConcept
      ? antwoordenUit(captain.conceptJson)
      : legeAntwoorden()
    : antwoordenUit(ind.antwoordenJson);
  return {
    ronde: { titel: ronde.titel, periode: ronde.periode, deadline: ronde.deadline, status: ronde.status },
    captain: { rol: captain.rol as CaptainRol, naam: captain.naam, titel: CAPTAIN_ROL_INFO[captain.rol as CaptainRol].titel },
    antwoorden,
    conceptVersie: captain.conceptVersie,
    conceptOp: captain.conceptOp,
    ingediendOp: captain.ingediendOp,
    indieningVersie: ind?.versie ?? null,
    bewerkbaar,
  };
}

export function bewaarConcept(token: string, antwoorden: Antwoorden, versie: number): { conceptVersie: number; conceptOp: string } {
  const { captain, ronde } = captainVoorLink(token);
  if (ronde.status !== "INTAKE") throw new ServiceFout("De vragenlijst is vergrendeld; bewaren kan niet meer.", 409);
  if (captain.ingediendOp) throw new ServiceFout("Je hebt al ingediend. Vraag het TOC om je vragenlijst te heropenen als je iets wil aanpassen.", 409);
  const t = nu();
  const n = wijzig(
    "toc_kompas_captains",
    captain.id,
    { conceptJson: canoniek(antwoorden), conceptVersie: captain.conceptVersie + 1, conceptOp: t, updatedAt: t },
    { kolom: "conceptVersie", waarde: versie },
  );
  if (n !== 1) throw new ServiceFout("Deze vragenlijst werd intussen in een ander venster bewaard. Laad de pagina opnieuw.", 409);
  return { conceptVersie: captain.conceptVersie + 1, conceptOp: t };
}

export function dienIn(token: string, antwoorden: Antwoorden): { indieningVersie: number; alleIngediend: boolean } {
  const { captain, ronde } = captainVoorLink(token);
  if (ronde.status !== "INTAKE") throw new ServiceFout("De vragenlijst is vergrendeld; indienen kan niet meer.", 409);
  if (captain.ingediendOp) throw new ServiceFout("Je hebt al ingediend.", 409);
  const fouten = indienFouten(antwoorden);
  if (fouten.length) throw new ServiceFout("De vragenlijst is nog niet volledig genoeg om in te dienen.", 422, { fouten });
  return transactie(() => {
    const vorige = db().prepare("SELECT MAX(versie) AS v FROM toc_kompas_indieningen WHERE captain_id = ?").get(captain.id) as any;
    const versie = Number(vorige?.v ?? 0) + 1;
    const t = nu();
    const inhoud = canoniek(antwoorden);
    const indieningId = voegToe("toc_kompas_indieningen", {
      rondeId: ronde.id,
      captainId: captain.id,
      versie,
      antwoordenJson: inhoud,
      contentHash: sha256(inhoud),
      ingediendOp: t,
    });
    wijzig("toc_kompas_captains", captain.id, { laatsteIndieningId: indieningId, ingediendOp: t, conceptJson: inhoud, updatedAt: t });
    const open = db().prepare("SELECT COUNT(*) AS n FROM toc_kompas_captains WHERE ronde_id = ? AND ingediend_op IS NULL").get(ronde.id) as any;
    const alleIngediend = Number(open.n) === 0;
    if (alleIngediend) zetStatus(ronde.id, "INTAKE", "CONSOLIDATIE", { vergrendeldOp: t, vergrendelReden: "Alle vier Captains hebben ingediend." });
    return { indieningVersie: versie, alleIngediend };
  });
}

/** De beheerder heropent een indiening, enkel zolang de nulmeting loopt. De vorige indiening blijft bewaard. */
export function heropen(rondeId: number, captainId: number): void {
  const r = haalRonde(rondeId);
  eisStatus(r, "INTAKE");
  const c = haalCaptain(rondeId, captainId);
  if (!c.ingediendOp) throw new ServiceFout("Deze Captain heeft nog niet ingediend.", 409);
  const t = nu();
  wijzig("toc_kompas_captains", captainId, { ingediendOp: null, conceptVersie: c.conceptVersie + 1, conceptOp: t, updatedAt: t });
}

export function vergrendel(rondeId: number, reden: string): void {
  const r = haalRonde(rondeId);
  eisStatus(r, "INTAKE");
  if (reden.trim().length < 10) throw new ServiceFout("Geef een reden van minstens tien tekens: waarom wordt de nulmeting afgesloten voor iedereen indiende?", 400);
  const zonder = captainsVan(rondeId).filter((c) => !c.laatsteIndieningId);
  if (zonder.length === CAPTAIN_ROLLEN.length) throw new ServiceFout("Nog geen enkele Captain heeft ingediend; er valt niets te consolideren.", 409);
  zetStatus(rondeId, "INTAKE", "CONSOLIDATIE", { vergrendeldOp: nu(), vergrendelReden: reden.trim() });
}

// ---- Consolidatie ------------------------------------------------------------------------------
function eisNaIntake(r: any): void {
  if (r.status === "INTAKE") {
    throw new ServiceFout("De antwoorden blijven afgeschermd tot alle Captains hebben ingediend of de nulmeting met een reden werd vergrendeld.", 409);
  }
}

export function invoerVoorConsolidatie(rondeId: number): { invoer: CaptainInvoer[]; zonderIndiening: any[] } {
  const invoer: CaptainInvoer[] = [];
  const zonderIndiening: any[] = [];
  for (const c of captainsVan(rondeId)) {
    const ind = laatsteIndiening(c);
    if (!ind) {
      zonderIndiening.push(captainPubliek(c));
      continue;
    }
    invoer.push({ captainId: c.id, rol: c.rol, naam: c.naam, antwoorden: antwoordenUit(ind.antwoordenJson) });
  }
  return { invoer, zonderIndiening };
}

export function consolidatie(rondeId: number): Consolidatie & { zonderIndiening: any[] } {
  const r = haalRonde(rondeId);
  eisNaIntake(r);
  const { invoer, zonderIndiening } = invoerVoorConsolidatie(rondeId);
  return { ...consolideer(invoer), zonderIndiening };
}

export function antwoordenVan(rondeId: number, captainId: number) {
  const r = haalRonde(rondeId);
  eisNaIntake(r);
  const c = haalCaptain(rondeId, captainId);
  const ind = laatsteIndiening(c);
  if (!ind) throw new ServiceFout("Deze Captain heeft geen vragenlijst ingediend.", 404);
  return { captain: captainPubliek(c), indiening: { id: ind.id, versie: ind.versie, ingediendOp: ind.ingediendOp, contentHash: ind.contentHash }, antwoorden: antwoordenUit(ind.antwoordenJson) };
}

// ---- Commitment Register ---------------------------------------------------------------------
export function commitmentsVan(rondeId: number): any[] {
  return lijst("toc_kompas_commitments", "rondeId", rondeId, "volgnummer");
}

function volgendNummer(rondeId: number): number {
  const r = db().prepare("SELECT MAX(volgnummer) AS v FROM toc_kompas_commitments WHERE ronde_id = ?").get(rondeId) as any;
  return Number(r?.v ?? 0) + 1;
}

function toetsOwner(rondeId: number, captainId: number): void {
  haalCaptain(rondeId, captainId);
}

export function maakCommitment(rondeId: number, invoer: CommitmentInvoer, adminId: number): any {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  toetsOwner(rondeId, invoer.ownerCaptainId);
  const volgnummer = volgendNummer(rondeId);
  const t = nu();
  const id = voegToe("toc_kompas_commitments", {
    ...invoer,
    rondeId,
    code: commitmentCode(r.periode, volgnummer),
    volgnummer,
    createdByAdminId: adminId,
    createdAt: t,
    updatedAt: t,
  });
  return haal("toc_kompas_commitments", id);
}

export function wijzigCommitment(rondeId: number, id: number, invoer: CommitmentInvoer & { versie: number }): any {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const c = haal("toc_kompas_commitments", id);
  if (!c || c.rondeId !== rondeId) throw new ServiceFout("Commitment niet gevonden.", 404);
  toetsOwner(rondeId, invoer.ownerCaptainId);
  const { versie, ...velden } = invoer;
  const n = wijzig("toc_kompas_commitments", id, { ...velden, versie: versie + 1, updatedAt: nu() }, { kolom: "versie", waarde: versie });
  if (n !== 1) throw new ServiceFout("Dit commitment werd intussen gewijzigd. Laad de pagina opnieuw.", 409);
  return haal("toc_kompas_commitments", id);
}

export function verwijderCommitment(rondeId: number, id: number): any {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const c = haal("toc_kompas_commitments", id);
  if (!c || c.rondeId !== rondeId) throw new ServiceFout("Commitment niet gevonden.", 404);
  db().prepare("DELETE FROM toc_kompas_commitments WHERE id = ?").run(id);
  return c;
}

export function zetCommitmentStatus(rondeId: number, id: number, status: CommitmentStatus, toelichting: string, versie: number): any {
  const r = haalRonde(rondeId);
  eisStatus(r, "VASTGESTELD");
  const c = haal("toc_kompas_commitments", id);
  if (!c || c.rondeId !== rondeId) throw new ServiceFout("Commitment niet gevonden.", 404);
  if (status !== "groen" && toelichting.trim().length < 5) throw new ServiceFout("Licht een amber, rode of geblokkeerde status kort toe.", 400);
  const n = wijzig("toc_kompas_commitments", id, { status, statusToelichting: toelichting.trim(), versie: versie + 1, updatedAt: nu() }, { kolom: "versie", waarde: versie });
  if (n !== 1) throw new ServiceFout("Dit commitment werd intussen gewijzigd. Laad de pagina opnieuw.", 409);
  return { voor: c, na: haal("toc_kompas_commitments", id) };
}

/**
 * Neemt de delivery- en bedrijfsleidingcommitments uit de ingediende
 * vragenlijsten over als conceptkaarten in het register. Wat de Captain schreef,
 * komt letterlijk over; wat de vragenlijst niet vraagt (domein, stopkeuze per
 * commitment, beslissingsrecht bij delivery) blijft leeg en wordt in de
 * workshop ingevuld. Een rij die al werd overgenomen, wordt niet opnieuw
 * toegevoegd.
 */
export function neemOver(rondeId: number, adminId: number): { toegevoegd: number } {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const bestaand = commitmentsVan(rondeId);
  const al = new Set(bestaand.filter((c) => c.bronIndieningId).map((c) => `${c.bronIndieningId}|${c.type}|${c.deliverable}|${c.objective}`));
  let toegevoegd = 0;
  transactie(() => {
    for (const c of captainsVan(rondeId)) {
      const ind = laatsteIndiening(c);
      if (!ind) continue;
      const a = antwoordenUit(ind.antwoordenJson);
      const nieuw: Array<Partial<CommitmentInvoer> & { type: "delivery" | "bedrijfsleiding" }> = [];
      for (const d of deliveryRijenGevuld(a)) {
        nieuw.push({
          type: "delivery",
          objective: "",
          deliverable: d.outcome,
          consultedInformed: d.ontvanger ? `Ontvanger: ${d.ontvanger}` : "",
          acceptatiebewijs: d.bewijs,
          deadline: d.deadline,
          urenPerWeek: d.uren,
          capaciteit: d.uren !== null ? `${d.uren} u/week` : "",
          responsible: d.raci === "R" ? c.naam : "",
        });
      }
      for (const b of bedrijfsleidingRijenGevuld(a)) {
        nieuw.push({
          type: "bedrijfsleiding",
          objective: b.uitkomst,
          deliverable: b.beslissing,
          acceptatiebewijs: b.bewijs,
          deadline: b.deadline,
          urenPerWeek: b.uren,
          capaciteit: b.uren !== null ? `${b.uren} u/week` : "",
          beslissingsrecht: b.mandaat,
        });
      }
      for (const n of nieuw) {
        const sleutel = `${ind.id}|${n.type}|${n.deliverable ?? ""}|${n.objective ?? ""}`;
        if (al.has(sleutel)) continue;
        al.add(sleutel);
        const volgnummer = volgendNummer(rondeId);
        const t = nu();
        voegToe("toc_kompas_commitments", {
          ...n,
          rondeId,
          ownerCaptainId: c.id,
          code: commitmentCode(r.periode, volgnummer),
          volgnummer,
          status: "groen",
          bronIndieningId: ind.id,
          createdByAdminId: adminId,
          createdAt: t,
          updatedAt: t,
        });
        toegevoegd += 1;
      }
    }
  });
  return { toegevoegd };
}

// ---- Coverage Matrix ------------------------------------------------------------------------
export function coverageVan(r: any): CoverageRij[] {
  const opgeslagen = json<CoverageRij[]>(r.coverageJson, []);
  return DOMEINEN.map(
    (d) => opgeslagen.find((x) => x.domein === d.sleutel) ?? { domein: d.sleutel, aOwner: "", aOwnerCaptainId: null, score: null, actie: "" },
  );
}

export function bewaarCoverage(rondeId: number, rijen: CoverageRij[], versie: number): CoverageRij[] {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const ids = new Set(captainsVan(rondeId).map((c) => c.id));
  for (const rij of rijen) {
    if (rij.aOwnerCaptainId !== null && !ids.has(rij.aOwnerCaptainId)) throw new ServiceFout("Een A-owner in de Coverage Matrix hoort niet bij deze ronde.", 400);
  }
  const uniek = new Set(rijen.map((x) => x.domein));
  if (uniek.size !== rijen.length) throw new ServiceFout("Elk domein staat maar een keer in de Coverage Matrix: een domein heeft nul of een A-owner.", 400);
  const n = wijzig(
    "toc_kompas_rondes",
    rondeId,
    { coverageJson: canoniek(rijen), coverageVersie: versie + 1, updatedAt: nu() },
    { kolom: "coverageVersie", waarde: versie },
  );
  if (n !== 1) throw new ServiceFout("De Coverage Matrix werd intussen gewijzigd. Laad de pagina opnieuw.", 409);
  return coverageVan(haalRonde(rondeId));
}

// ---- Decision Log --------------------------------------------------------------------------
export function besluitenVan(rondeId: number): any[] {
  return lijst("toc_kompas_besluiten", "rondeId", rondeId);
}

export function legBesluitVast(rondeId: number, invoer: BesluitInvoer, adminId: number): any {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE", "VASTGESTELD");
  if (invoer.vervangtBesluitId !== null) {
    const v = haal("toc_kompas_besluiten", invoer.vervangtBesluitId);
    if (!v || v.rondeId !== rondeId) throw new ServiceFout("Het besluit dat vervangen wordt, bestaat niet in deze ronde.", 400);
  }
  const id = voegToe("toc_kompas_besluiten", { ...invoer, rondeId, vastgelegdDoorAdminId: adminId, createdAt: nu() });
  return haal("toc_kompas_besluiten", id);
}

// ---- Acceptatiecriteria --------------------------------------------------------------------
export function acceptatie(rondeId: number) {
  const r = haalRonde(rondeId);
  eisNaIntake(r);
  const { invoer, zonderIndiening } = invoerVoorConsolidatie(rondeId);
  const cons = consolideer(invoer);
  const automatisch = toetsAutomatisch(cons, commitmentsVan(rondeId), coverageVan(r), BELEGD_DOMEINEN);
  if (zonderIndiening.length) {
    const cap = automatisch.find((a) => a.sleutel === "capaciteit100")!;
    cap.voldaan = false;
    cap.toelichting = `Zonder ingediende vragenlijst: ${zonderIndiening.map((c) => c.naam).join(", ")}. ${cap.toelichting}`;
  }
  const handmatig = json<Record<string, boolean>>(r.acceptatieJson, {});
  const criteria = ACCEPTATIECRITERIA.map((k) => {
    if (k.automatisch) {
      const a = automatisch.find((x) => x.sleutel === k.sleutel)!;
      return { sleutel: k.sleutel, tekst: k.tekst, automatisch: true, voldaan: a.voldaan, toelichting: a.toelichting };
    }
    return { sleutel: k.sleutel, tekst: k.tekst, automatisch: false, voldaan: handmatig[k.sleutel] === true, toelichting: handmatig[k.sleutel] ? "Bevestigd door het TOC." : "Nog te bevestigen door het TOC." };
  });
  return { criteria, versie: r.acceptatieVersie, alleVoldaan: criteria.every((c) => c.voldaan) };
}

export function bewaarAcceptatie(rondeId: number, handmatig: Record<string, boolean>, versie: number) {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const toegestaan = new Set<string>(ACCEPTATIECRITERIA.filter((k) => !k.automatisch).map((k) => k.sleutel));
  const schoon: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(handmatig)) {
    if (!toegestaan.has(k)) throw new ServiceFout(`Onbekend of automatisch criterium: ${k}.`, 400);
    schoon[k] = v;
  }
  const n = wijzig(
    "toc_kompas_rondes",
    rondeId,
    { acceptatieJson: canoniek(schoon), acceptatieVersie: versie + 1, updatedAt: nu() },
    { kolom: "acceptatieVersie", waarde: versie },
  );
  if (n !== 1) throw new ServiceFout("De acceptatiecriteria werden intussen gewijzigd. Laad de pagina opnieuw.", 409);
  return acceptatie(rondeId);
}

// ---- Vaststellen en afsluiten --------------------------------------------------------------
export function vaststelFouten(rondeId: number): string[] {
  const r = haalRonde(rondeId);
  const fouten: string[] = [];
  const cs = commitmentsVan(rondeId);
  if (cs.length === 0) fouten.push("Het register bevat nog geen commitments.");
  for (const c of cs) {
    const mist = KAART_VERPLICHT_VOOR_VASTSTELLING.filter((v) => {
      if (v === "capaciteit") return isLeeg(c.capaciteit) && (c.urenPerWeek === null || c.urenPerWeek <= 0);
      return isLeeg(c[v]);
    });
    if (mist.length) fouten.push(`${c.code}: ${mist.join(", ")} ontbreekt.`);
  }
  const zonderScore = coverageVan(r).filter((x) => x.score === null);
  if (zonderScore.length) fouten.push(`Coverage Matrix: ${zonderScore.length} domein(en) zonder dekkingsscore van het TOC.`);
  const acc = acceptatie(rondeId);
  for (const k of acc.criteria.filter((x) => !x.voldaan)) fouten.push(`Acceptatiecriterium niet voldaan: ${k.tekst}`);
  return fouten;
}

export function stelVast(rondeId: number, adminId: number, toelichting: string): void {
  const r = haalRonde(rondeId);
  eisStatus(r, "CONSOLIDATIE");
  const fouten = vaststelFouten(rondeId);
  if (fouten.length) throw new ServiceFout("Het register kan nog niet worden vastgesteld.", 422, { fouten });
  zetStatus(rondeId, "CONSOLIDATIE", "VASTGESTELD", { vastgesteldOp: nu(), vastgesteldDoorAdminId: adminId, vaststelToelichting: toelichting });
}

export function sluitAf(rondeId: number, toelichting: string): void {
  const r = haalRonde(rondeId);
  eisStatus(r, "VASTGESTELD");
  zetStatus(rondeId, "VASTGESTELD", "AFGESLOTEN", { afgeslotenOp: nu(), afsluitToelichting: toelichting });
}

// ---- Rapporten ---------------------------------------------------------------------------------
export type PdfRenderer = (html: string, opts: { titel: string }) => Promise<Buffer>;

const RAPPORT_MINIMUM: Record<RapportType, RondeStatus> = {
  "captain-charter": "INTAKE",
  workshopdossier: "CONSOLIDATIE",
  "commitment-register": "CONSOLIDATIE",
  kwartaalscorecard: "VASTGESTELD",
};

export function captainNamen(rondeId: number): Map<number, string> {
  return new Map(captainsVan(rondeId).map((c) => [c.id, `${c.naam}, ${CAPTAIN_ROL_INFO[c.rol as CaptainRol].titel}`]));
}

/** Alle gegevens die een rapport toont. Enkel vastgelegde gegevens; het rapport berekent niets bij. */
export function rapportContract(rondeId: number, type: RapportType, captainId: number | null): Record<string, unknown> {
  const r = haalRonde(rondeId);
  const ronde = rondePubliek(r);
  const basis = { moduleversie: TOC_KOMPAS_MODULE_VERSIE, type, ronde };
  if (type === "captain-charter") {
    if (captainId === null) throw new ServiceFout("Kies de Captain voor dit charter.", 400);
    const c = haalCaptain(rondeId, captainId);
    const ind = laatsteIndiening(c);
    const antwoorden = ind ? antwoordenUit(ind.antwoordenJson) : antwoordenUit(c.conceptJson);
    return {
      ...basis,
      captain: captainPubliek(c),
      indiening: ind ? { versie: ind.versie, ingediendOp: ind.ingediendOp, contentHash: ind.contentHash } : null,
      antwoorden,
    };
  }
  const namen = Object.fromEntries(captainNamen(rondeId));
  const cons = consolidatie(rondeId);
  const cs = commitmentsVan(rondeId).map((c) => ({ ...c, ownerLabel: namen[c.ownerCaptainId] ?? "" }));
  const coverage = coverageVan(r).map((x) => ({ ...x, naam: DOMEINEN.find((d) => d.sleutel === x.domein)?.naam ?? x.domein, ownerLabel: x.aOwnerCaptainId ? namen[x.aOwnerCaptainId] ?? "" : x.aOwner }));
  const besluiten = besluitenVan(rondeId);
  const captains = captainsVan(rondeId).map(captainPubliek);
  const acc = acceptatie(rondeId);
  return { ...basis, captains, consolidatie: cons, commitments: cs, coverage, besluiten, acceptatie: acc };
}

function laatsteArtefact(rondeId: number, type: RapportType, captainId: number | null): any | null {
  const rij = db()
    .prepare("SELECT id FROM toc_kompas_artefacten WHERE ronde_id = ? AND type = ? AND ((captain_id IS NULL AND ? IS NULL) OR captain_id = ?) ORDER BY versie DESC LIMIT 1")
    .get(rondeId, type, captainId, captainId) as any;
  return rij ? haal("toc_kompas_artefacten", rij.id) : null;
}

export async function maakRapport(
  rondeId: number,
  type: RapportType,
  captainId: number | null,
  adminId: number | null,
  renderPdf: PdfRenderer | null,
): Promise<{ artefact: any; hergebruikt: boolean }> {
  const r = haalRonde(rondeId);
  if (!minstens(r.status, RAPPORT_MINIMUM[type])) throw new ServiceFout(`Dit rapport kan pas vanaf de fase ${RAPPORT_MINIMUM[type]}.`, 409);
  if (type === "captain-charter" && r.status === "INTAKE" && adminId !== null) {
    throw new ServiceFout("Tijdens de nulmeting blijft een charter afgeschermd; enkel de Captain zelf kan het afdrukken.", 409);
  }
  const contract = rapportContract(rondeId, type, captainId);
  const inputHash = sha256({ contract, pdf: renderPdf !== null });
  const vorige = laatsteArtefact(rondeId, type, captainId);
  if (vorige && vorige.inputHash === inputHash) return { artefact: vorige, hergebruikt: true };
  const html = RENDERERS[type](contract as any);
  let pdfBase64: string | null = null;
  if (renderPdf) {
    const buf = await renderPdf(html, { titel: `${r.titel} ${type}` });
    pdfBase64 = buf.toString("base64");
  }
  const versie = (vorige?.versie ?? 0) + 1;
  const id = voegToe("toc_kompas_artefacten", { rondeId, captainId, type, versie, inputHash, html, pdfBase64, createdByAdminId: adminId, createdAt: nu() });
  return { artefact: haal("toc_kompas_artefacten", id), hergebruikt: false };
}

export function artefactenVan(rondeId: number): any[] {
  return lijst("toc_kompas_artefacten", "rondeId", rondeId).map((a) => ({
    id: a.id,
    type: a.type,
    captainId: a.captainId,
    versie: a.versie,
    heeftPdf: Boolean(a.pdfBase64),
    createdAt: a.createdAt,
    inputHash: a.inputHash,
  }));
}

export function haalArtefact(rondeId: number, id: number): any {
  const a = haal("toc_kompas_artefacten", id);
  if (!a || a.rondeId !== rondeId) throw new ServiceFout("Rapport niet gevonden.", 404);
  return a;
}

/** Het eigen charter voor de Captain, enkel als HTML om af te drukken. Geen opslag. */
export function eigenCharterHtml(token: string): string {
  const { captain, ronde } = captainVoorLink(token);
  return RENDERERS["captain-charter"](rapportContract(ronde.id, "captain-charter", captain.id) as any);
}
