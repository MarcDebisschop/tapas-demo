// ---------------------------------------------------------------------------
// server/kwaliteit-evaluaties/storage.ts
//
// Eigen better-sqlite3-handle op hetzelfde data.db-bestand als het platform
// (WAL laat meerdere handles toe) — hetzelfde huispatroon als
// server/t4organizations/storage.ts. Tabellen krijgen het prefix `evaluatie_`
// en botsen niet met de bestaande `kwaliteit_*`-tabellen van de STM-module.
//
// TOKENBEVEILIGING (uitnodigingen). Zelfde grondpatroon als
// server/magic-link.ts: 32 willekeurige bytes uit crypto.randomBytes,
// hexadecimaal (64 tekens), vergelijking in constante tijd. Twee verschillen,
// bewust: de geldigheid is hier UITNODIGING_GELDIG_DAGEN dagen (een
// organisatiecontact vult dit niet noodzakelijk meteen in), en het token
// wordt pas bij INDIENEN als gebruikt gemarkeerd, niet bij de eerste opening
// — tussentijds terugkeren zonder dataverlies is een expliciete eis (§14.3).
// ---------------------------------------------------------------------------

import { randomBytes, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { vindDatabasePad } from "../db-pad";
import { pasEncryptieToe } from "../db-encryptie";
import {
  evaluatieOrganisatieContacten as contactenTabel,
  evaluatieCoaches as coachesTabel,
  evaluatieSessies as sessiesTabel,
  evaluatieOrganisatieEvaluaties as evaluatiesTabel,
  evaluatieAntwoorden as antwoordenTabel,
  evaluatieSignalen as signalenTabel,
  type InsertEvaluatieOrganisatieContact,
  type InsertEvaluatieCoach,
  type InsertEvaluatieSessie,
  type EvaluatieOrganisatieContact,
  type EvaluatieCoach,
  type EvaluatieSessie,
  type EvaluatieUitnodiging,
  type EvaluatieOrganisatieEvaluatie,
  type EvaluatieAntwoord,
  type EvaluatieSignaal,
} from "./schema";
import { eq } from "drizzle-orm";
import { berekenOrganisatieScores, bepaalAutomatischSignaal } from "./scoring";
import type { OrgEvalAntwoordInvoer } from "./scoring";
import { vindVraag } from "./vragen";

export const databestandPad = vindDatabasePad();
export const sqlite = new Database(databestandPad);
pasEncryptieToe(sqlite, "server/kwaliteit-evaluaties/storage.ts");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS evaluatie_organisatie_contacten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisatie_id INTEGER NOT NULL,
  naam TEXT NOT NULL,
  email TEXT NOT NULL,
  functie TEXT,
  actief INTEGER NOT NULL DEFAULT 1,
  aangemaakt_op TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluatie_contacten_org ON evaluatie_organisatie_contacten(organisatie_id);

CREATE TABLE IF NOT EXISTS evaluatie_coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naam TEXT NOT NULL,
  email TEXT,
  actief INTEGER NOT NULL DEFAULT 1,
  aangemaakt_op TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluatie_sessies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titel TEXT NOT NULL,
  organisatie_id INTEGER NOT NULL,
  coach_id INTEGER,
  start_datetime TEXT NOT NULL,
  eind_datetime TEXT,
  locatie TEXT,
  taal TEXT NOT NULL DEFAULT 'nl',
  aantal_deelnemers_verwacht INTEGER,
  aantal_deelnemers_werkelijk INTEGER,
  bevestigde_doelstellingen TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'gepland',
  is_testdata INTEGER NOT NULL DEFAULT 0,
  aangemaakt_op TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluatie_sessies_org ON evaluatie_sessies(organisatie_id);

CREATE TABLE IF NOT EXISTS evaluatie_uitnodigingen (
  token TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'organisatie',
  sessie_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  taal TEXT NOT NULL DEFAULT 'nl',
  verloopt_op TEXT NOT NULL,
  ingewisseld_op TEXT,
  ingetrokken_op TEXT,
  aangemaakt_op TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluatie_uitnodigingen_sessie ON evaluatie_uitnodigingen(sessie_id);

CREATE TABLE IF NOT EXISTS evaluatie_organisatie_evaluaties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uitnodiging_token TEXT NOT NULL,
  sessie_id INTEGER NOT NULL,
  organisatie_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  taal TEXT NOT NULL DEFAULT 'nl',
  status TEXT NOT NULL DEFAULT 'concept',
  basisinfo_klopt TEXT,
  basisinfo_toelichting TEXT,
  score_passend REAL,
  score_professioneel REAL,
  score_activerend REAL,
  score_toepasbaar REAL,
  score_duurzaam REAL,
  score_totaal REAL,
  aanbevelingsscore REAL,
  signaal_niveau TEXT,
  signaal_types TEXT,
  signaal_beschrijving TEXT,
  signaal_wil_contact INTEGER,
  signaal_contact_naam TEXT,
  signaal_contact_email TEXT,
  signaal_contact_telefoon TEXT,
  mag_contact_opnemen INTEGER,
  is_testdata INTEGER NOT NULL DEFAULT 0,
  ingediend_op TEXT,
  aangemaakt_op TEXT NOT NULL,
  bijgewerkt_op TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluatie_orgeval_token ON evaluatie_organisatie_evaluaties(uitnodiging_token);
CREATE INDEX IF NOT EXISTS idx_evaluatie_orgeval_sessie ON evaluatie_organisatie_evaluaties(sessie_id);

CREATE TABLE IF NOT EXISTS evaluatie_antwoorden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluatie_type TEXT NOT NULL DEFAULT 'organisatie',
  evaluatie_id INTEGER NOT NULL,
  vraag_code TEXT NOT NULL,
  vraag_tekst TEXT NOT NULL,
  taal TEXT NOT NULL DEFAULT 'nl',
  numerieke_waarde REAL,
  tekst_waarde TEXT,
  aangemaakt_op TEXT NOT NULL,
  bijgewerkt_op TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluatie_antwoorden_uniek
  ON evaluatie_antwoorden(evaluatie_type, evaluatie_id, vraag_code);

CREATE TABLE IF NOT EXISTS evaluatie_signalen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bron_type TEXT NOT NULL DEFAULT 'organisatie_evaluatie',
  bron_id INTEGER NOT NULL,
  sessie_id INTEGER NOT NULL,
  organisatie_id INTEGER NOT NULL,
  coach_id INTEGER,
  ernst TEXT NOT NULL,
  types TEXT NOT NULL DEFAULT '[]',
  beschrijving TEXT,
  wil_contact INTEGER NOT NULL DEFAULT 0,
  contact_naam TEXT,
  contact_email TEXT,
  contact_telefoon TEXT,
  status TEXT NOT NULL DEFAULT 'nieuw',
  aangemaakt_op TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluatie_signalen_status ON evaluatie_signalen(status);
`);

const db = drizzle(sqlite);

// ---- Tokenparameters --------------------------------------------------
export const UITNODIGING_GELDIG_DAGEN = 21;

function nuIso(): string {
  return new Date().toISOString();
}

function gelijkInConstanteTijd(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---- Contactpersonen ----------------------------------------------------
export async function maakContact(
  invoer: InsertEvaluatieOrganisatieContact,
): Promise<EvaluatieOrganisatieContact> {
  const [rij] = await db
    .insert(contactenTabel)
    .values({ ...invoer, actief: true, aangemaaktOp: nuIso() })
    .returning();
  return rij;
}

export async function lijstContacten(
  organisatieId: number,
): Promise<EvaluatieOrganisatieContact[]> {
  return db
    .select()
    .from(contactenTabel)
    .where(eq(contactenTabel.organisatieId, organisatieId));
}

export async function vindContact(id: number): Promise<EvaluatieOrganisatieContact | undefined> {
  const [rij] = await db.select().from(contactenTabel).where(eq(contactenTabel.id, id));
  return rij;
}

// ---- Coaches -------------------------------------------------------------
export async function maakCoach(invoer: InsertEvaluatieCoach): Promise<EvaluatieCoach> {
  const [rij] = await db
    .insert(coachesTabel)
    .values({ ...invoer, actief: true, aangemaaktOp: nuIso() })
    .returning();
  return rij;
}

export async function lijstCoaches(): Promise<EvaluatieCoach[]> {
  return db.select().from(coachesTabel);
}

export async function vindCoach(id: number): Promise<EvaluatieCoach | undefined> {
  const [rij] = await db.select().from(coachesTabel).where(eq(coachesTabel.id, id));
  return rij;
}

// ---- Sessies --------------------------------------------------------------
export async function maakSessie(invoer: InsertEvaluatieSessie): Promise<EvaluatieSessie> {
  const [rij] = await db
    .insert(sessiesTabel)
    .values({
      ...invoer,
      bevestigdeDoelstellingen: JSON.stringify(invoer.bevestigdeDoelstellingen ?? []),
      status: "gepland",
      isTestdata: false,
      aangemaaktOp: nuIso(),
    })
    .returning();
  return rij;
}

export async function lijstSessies(): Promise<EvaluatieSessie[]> {
  return db.select().from(sessiesTabel).orderBy(sessiesTabel.id);
}

export async function vindSessie(id: number): Promise<EvaluatieSessie | undefined> {
  const [rij] = await db.select().from(sessiesTabel).where(eq(sessiesTabel.id, id));
  return rij;
}

// ---- Uitnodigingen ----------------------------------------------------
export interface UitnodigingResultaat {
  token: string;
  verlooptOp: string;
}

export function maakUitnodiging(
  sessieId: number,
  contactId: number,
  taal = "nl",
): UitnodigingResultaat {
  const token = randomBytes(32).toString("hex");
  const nu = new Date();
  const verlooptOp = new Date(
    nu.getTime() + UITNODIGING_GELDIG_DAGEN * 24 * 60 * 60 * 1000,
  ).toISOString();
  sqlite
    .prepare(
      `INSERT INTO evaluatie_uitnodigingen
         (token, type, sessie_id, contact_id, taal, verloopt_op, ingewisseld_op, ingetrokken_op, aangemaakt_op)
       VALUES (?, 'organisatie', ?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .run(token, sessieId, contactId, taal, verlooptOp, nu.toISOString());
  return { token, verlooptOp };
}

export type UitnodigingStatus =
  | { ok: true; uitnodiging: EvaluatieUitnodiging }
  | { ok: false; reden: "onbekend" | "verlopen" | "ingetrokken" };

/** Zoekt een uitnodiging op. Geeft geen ingewisseld_op-status door zolang
 * er nog geen indiening is: tussentijds terugkeren mag altijd. */
export function vindUitnodiging(token: string): UitnodigingStatus {
  const t = (token ?? "").trim();
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return { ok: false, reden: "onbekend" };

  const rij = sqlite
    .prepare(`SELECT * FROM evaluatie_uitnodigingen WHERE token = ?`)
    .get(t) as Record<string, any> | undefined;
  if (!rij) return { ok: false, reden: "onbekend" };
  if (!gelijkInConstanteTijd(String(rij.token), t)) return { ok: false, reden: "onbekend" };
  if (rij.ingetrokken_op) return { ok: false, reden: "ingetrokken" };
  if (new Date(rij.verloopt_op).getTime() <= Date.now()) return { ok: false, reden: "verlopen" };

  return {
    ok: true,
    uitnodiging: {
      token: rij.token,
      type: rij.type,
      sessieId: rij.sessie_id,
      contactId: rij.contact_id,
      taal: rij.taal,
      verloogtOp: rij.verloopt_op,
      ingewisseldOp: rij.ingewisseld_op,
      ingetrokkenOp: rij.ingetrokken_op,
      aangemaaktOp: rij.aangemaakt_op,
    },
  };
}

export function trekUitnodigingIn(token: string): void {
  sqlite
    .prepare(
      `UPDATE evaluatie_uitnodigingen SET ingetrokken_op = ? WHERE token = ? AND ingetrokken_op IS NULL`,
    )
    .run(nuIso(), token);
}

function markeerUitnodigingIngewisseld(token: string): void {
  sqlite
    .prepare(
      `UPDATE evaluatie_uitnodigingen SET ingewisseld_op = ? WHERE token = ? AND ingewisseld_op IS NULL`,
    )
    .run(nuIso(), token);
}

// ---- Organisatie-evaluatie (concept + indienen) --------------------------

/** Zoekt de evaluatie bij een token, of maakt een lege conceptrij aan bij de
 * eerste opening. Idempotent: een tweede opening vindt de bestaande rij. */
export async function vindOfMaakConceptEvaluatie(
  uitnodiging: EvaluatieUitnodiging,
  organisatieId: number,
): Promise<EvaluatieOrganisatieEvaluatie> {
  const [bestaand] = await db
    .select()
    .from(evaluatiesTabel)
    .where(eq(evaluatiesTabel.uitnodigingToken, uitnodiging.token));
  if (bestaand) return bestaand;

  const nu = nuIso();
  const [rij] = await db
    .insert(evaluatiesTabel)
    .values({
      uitnodigingToken: uitnodiging.token,
      sessieId: uitnodiging.sessieId,
      organisatieId,
      contactId: uitnodiging.contactId,
      taal: uitnodiging.taal,
      status: "concept",
      isTestdata: false,
      aangemaaktOp: nu,
      bijgewerktOp: nu,
    })
    .returning();
  return rij;
}

export async function vindEvaluatieById(
  id: number,
): Promise<EvaluatieOrganisatieEvaluatie | undefined> {
  const [rij] = await db.select().from(evaluatiesTabel).where(eq(evaluatiesTabel.id, id));
  return rij;
}

export async function lijstOrganisatieEvaluaties(): Promise<EvaluatieOrganisatieEvaluatie[]> {
  return db.select().from(evaluatiesTabel).orderBy(evaluatiesTabel.id);
}

export interface ConceptBewaring {
  basisinfoKlopt?: string | null;
  basisinfoToelichting?: string | null;
  magContactOpnemen?: boolean | null;
  signaalNiveau?: string | null;
  signaalTypes?: string[] | null;
  signaalBeschrijving?: string | null;
  signaalWilContact?: boolean | null;
  signaalContactNaam?: string | null;
  signaalContactEmail?: string | null;
  signaalContactTelefoon?: string | null;
  antwoorden?: OrgEvalAntwoordInvoer[];
}

/** Slaat een concepttussenstand op: mag na indienen niet meer wijzigen. */
export async function bewaarConcept(
  evaluatieId: number,
  taal: string,
  invoer: ConceptBewaring,
): Promise<EvaluatieOrganisatieEvaluatie | undefined> {
  const bestaand = await vindEvaluatieById(evaluatieId);
  if (!bestaand || bestaand.status !== "concept") return bestaand;

  const nu = nuIso();
  const updateVeld: Record<string, any> = { bijgewerktOp: nu };
  if (invoer.basisinfoKlopt !== undefined) updateVeld.basisinfoKlopt = invoer.basisinfoKlopt;
  if (invoer.basisinfoToelichting !== undefined)
    updateVeld.basisinfoToelichting = invoer.basisinfoToelichting;
  if (invoer.magContactOpnemen !== undefined)
    updateVeld.magContactOpnemen = invoer.magContactOpnemen;
  if (invoer.signaalNiveau !== undefined) updateVeld.signaalNiveau = invoer.signaalNiveau;
  if (invoer.signaalTypes !== undefined)
    updateVeld.signaalTypes = JSON.stringify(invoer.signaalTypes ?? []);
  if (invoer.signaalBeschrijving !== undefined)
    updateVeld.signaalBeschrijving = invoer.signaalBeschrijving;
  if (invoer.signaalWilContact !== undefined)
    updateVeld.signaalWilContact = invoer.signaalWilContact;
  if (invoer.signaalContactNaam !== undefined)
    updateVeld.signaalContactNaam = invoer.signaalContactNaam;
  if (invoer.signaalContactEmail !== undefined)
    updateVeld.signaalContactEmail = invoer.signaalContactEmail;
  if (invoer.signaalContactTelefoon !== undefined)
    updateVeld.signaalContactTelefoon = invoer.signaalContactTelefoon;

  await db.update(evaluatiesTabel).set(updateVeld).where(eq(evaluatiesTabel.id, evaluatieId));

  if (invoer.antwoorden) {
    for (const a of invoer.antwoorden) {
      await bewaarAntwoord(evaluatieId, taal, a, a.vraagCode);
    }
  }

  return vindEvaluatieById(evaluatieId);
}

async function bewaarAntwoord(
  evaluatieId: number,
  taal: string,
  antwoord: OrgEvalAntwoordInvoer,
  vraagTekstFallback: string,
): Promise<void> {
  const vraag = vindVraag(antwoord.vraagCode);
  const vraagTekst = vraag?.tekst ?? vraagTekstFallback;
  const nu = nuIso();

  const gevonden = await db
    .select()
    .from(antwoordenTabel)
    .where(eq(antwoordenTabel.evaluatieId, evaluatieId));
  const rij = gevonden.find((r) => r.vraagCode === antwoord.vraagCode);

  if (rij) {
    await db
      .update(antwoordenTabel)
      .set({
        vraagTekst,
        numeriekeWaarde: antwoord.numeriekeWaarde ?? null,
        tekstWaarde: antwoord.tekstWaarde ?? null,
        bijgewerktOp: nu,
      })
      .where(eq(antwoordenTabel.id, rij.id));
  } else {
    await db.insert(antwoordenTabel).values({
      evaluatieType: "organisatie",
      evaluatieId,
      vraagCode: antwoord.vraagCode,
      vraagTekst,
      taal,
      numeriekeWaarde: antwoord.numeriekeWaarde ?? null,
      tekstWaarde: antwoord.tekstWaarde ?? null,
      aangemaaktOp: nu,
      bijgewerktOp: nu,
    });
  }
}

export async function lijstAntwoorden(evaluatieId: number): Promise<EvaluatieAntwoord[]> {
  return db.select().from(antwoordenTabel).where(eq(antwoordenTabel.evaluatieId, evaluatieId));
}

export interface IndienResultaat {
  evaluatie: EvaluatieOrganisatieEvaluatie;
  signaalAangemaakt: boolean;
}

/** Berekent scores, zet status op verzonden, markeert het token als
 * ingewisseld, en legt een kwaliteitssignaal vast wanneer nodig — beschermd
 * tegen dubbele indiening (§16-vereiste): een tweede aanroep op een reeds
 * verzonden evaluatie doet niets en geeft de bestaande rij terug. */
export async function diendeEvaluatieIn(
  evaluatieId: number,
): Promise<IndienResultaat | undefined> {
  const bestaand = await vindEvaluatieById(evaluatieId);
  if (!bestaand) return undefined;
  if (bestaand.status === "verzonden") return { evaluatie: bestaand, signaalAangemaakt: false };

  const antwoorden = await lijstAntwoorden(evaluatieId);
  const scores = berekenOrganisatieScores(
    antwoorden.map((a) => ({
      vraagCode: a.vraagCode,
      numeriekeWaarde: a.numeriekeWaarde,
      tekstWaarde: a.tekstWaarde,
    })),
  );

  const nu = nuIso();
  await db
    .update(evaluatiesTabel)
    .set({
      status: "verzonden",
      scorePassend: scores.passend,
      scoreProfessioneel: scores.professioneel,
      scoreActiverend: scores.activerend,
      scoreToepasbaar: scores.toepasbaar,
      scoreDuurzaam: scores.duurzaam,
      scoreTotaal: scores.totaal,
      aanbevelingsscore: scores.aanbeveling,
      ingediendOp: nu,
      bijgewerktOp: nu,
    })
    .where(eq(evaluatiesTabel.id, evaluatieId));

  markeerUitnodigingIngewisseld(bestaand.uitnodigingToken);

  const bijgewerkt = await vindEvaluatieById(evaluatieId);
  if (!bijgewerkt) return undefined;

  let signaalAangemaakt = false;

  // Signaal door de respondent zelf gemeld (§7.5).
  if (bijgewerkt.signaalNiveau && bijgewerkt.signaalNiveau !== "geen") {
    await maakSignaal({
      bronType: "organisatie_evaluatie",
      bronId: evaluatieId,
      sessieId: bijgewerkt.sessieId,
      organisatieId: bijgewerkt.organisatieId,
      coachId: null,
      ernst: bijgewerkt.signaalNiveau,
      types: JSON.parse(bijgewerkt.signaalTypes ?? "[]"),
      beschrijving: bijgewerkt.signaalBeschrijving,
      wilContact: !!bijgewerkt.signaalWilContact,
      contactNaam: bijgewerkt.signaalContactNaam,
      contactEmail: bijgewerkt.signaalContactEmail,
      contactTelefoon: bijgewerkt.signaalContactTelefoon,
    });
    signaalAangemaakt = true;
  }

  // Automatisch signaal op basis van de score (§6.5), los van een eventueel
  // door de respondent zelf gemeld signaal.
  const automatisch = bepaalAutomatischSignaal(scores);
  if (automatisch) {
    await maakSignaal({
      bronType: "organisatie_evaluatie",
      bronId: evaluatieId,
      sessieId: bijgewerkt.sessieId,
      organisatieId: bijgewerkt.organisatieId,
      coachId: null,
      ernst: "automatisch_laag",
      types: [],
      beschrijving: automatisch.reden,
      wilContact: false,
      contactNaam: null,
      contactEmail: null,
      contactTelefoon: null,
    });
    signaalAangemaakt = true;
  }

  return { evaluatie: bijgewerkt, signaalAangemaakt };
}

// ---- Signalen -------------------------------------------------------------
export interface SignaalInvoer {
  bronType: string;
  bronId: number;
  sessieId: number;
  organisatieId: number;
  coachId: number | null;
  ernst: string;
  types: string[];
  beschrijving?: string | null;
  wilContact: boolean;
  contactNaam?: string | null;
  contactEmail?: string | null;
  contactTelefoon?: string | null;
}

export async function maakSignaal(invoer: SignaalInvoer): Promise<EvaluatieSignaal> {
  const [rij] = await db
    .insert(signalenTabel)
    .values({
      bronType: invoer.bronType,
      bronId: invoer.bronId,
      sessieId: invoer.sessieId,
      organisatieId: invoer.organisatieId,
      coachId: invoer.coachId,
      ernst: invoer.ernst,
      types: JSON.stringify(invoer.types ?? []),
      beschrijving: invoer.beschrijving ?? null,
      wilContact: invoer.wilContact,
      contactNaam: invoer.contactNaam ?? null,
      contactEmail: invoer.contactEmail ?? null,
      contactTelefoon: invoer.contactTelefoon ?? null,
      status: "nieuw",
      aangemaaktOp: nuIso(),
    })
    .returning();
  return rij;
}

export async function lijstSignalen(): Promise<EvaluatieSignaal[]> {
  return db.select().from(signalenTabel).orderBy(signalenTabel.id);
}
