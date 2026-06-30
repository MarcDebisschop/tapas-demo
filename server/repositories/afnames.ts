/**
 * server/repositories/afnames.ts
 * 
 * Domein: Afnames — het centrale meetinstrument-record. Bevat ook
 * uitnodigingen (inviteToken) en GDPR-operaties.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { afnames, rapporten } from "@shared/schema";
import type { Afname } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "../storage";
import { cryptoRandom } from "./db";

// Re-export van constanten die elders gebruikt worden
export const PRIVACY_VERKLARING_VERSIE = "v1.0 (2026-06)";
export const STANDAARD_BEWAARMAANDEN = 24;

export interface NewAfname {
  organisatieId?: number | null;
  respondentCode: string;
  name: string;
  company?: string | null;
  role?: string | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  verwerkingsdoel?: string | null;
  rechtsgrond?: string | null;
  privacyverklaringVersie?: string | null;
  consentIp?: string | null;
  consentUserAgent?: string | null;
  bewaartotDatum?: string | null;
  baselineEnergy: number;
  taal?: string | null;
}

export async function createAfname(data: NewAfname): Promise<Afname> {
  return db
    .insert(afnames)
    .values({
      organisatieId: data.organisatieId ?? null,
      respondentCode: data.respondentCode,
      name: data.name,
      company: data.company ?? null,
      role: data.role ?? null,
      consentGiven: true,
      consentScope: data.consentScope,
      consentTimestamp: data.consentTimestamp,
      verwerkingsdoel:
        data.verwerkingsdoel ??
        "Genereren van een professioneel energetisch gedragsprofiel (T4P Business Kompas)",
      rechtsgrond: data.rechtsgrond ?? "toestemming",
      privacyverklaringVersie: data.privacyverklaringVersie ?? PRIVACY_VERKLARING_VERSIE,
      consentIp: data.consentIp ?? null,
      consentUserAgent: data.consentUserAgent ?? null,
      bewaartotDatum:
        data.bewaartotDatum ??
        new Date(
          Date.now() + STANDAARD_BEWAARMAANDEN * 30 * 24 * 3600 * 1000,
        ).toISOString(),
      baselineEnergy: data.baselineEnergy,
      taal: data.taal ?? "nl",
      status: "deel1",
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

export async function getAfname(id: number): Promise<Afname | undefined> {
  return db.select().from(afnames).where(eq(afnames.id, id)).get();
}

export async function getAfnameByCode(code: string): Promise<Afname | undefined> {
  return db.select().from(afnames).where(eq(afnames.respondentCode, code)).get();
}

export async function listAfnames(): Promise<Afname[]> {
  return db.select().from(afnames).orderBy(desc(afnames.id)).all();
}

export async function updateAfname(
  id: number,
  patch: Partial<Afname>,
): Promise<Afname | undefined> {
  return db.update(afnames).set(patch).where(eq(afnames.id, id)).returning().get();
}

// --- Uitnodigingen (Fase D) -----------------------------------------------

export async function maakUitnodiging(data: {
  organisatieId?: number | null;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  taal?: string | null;
}): Promise<Afname> {
  const now = new Date().toISOString();
  const token = `${cryptoRandom(8)}-${cryptoRandom(8)}-${cryptoRandom(8)}`;
  const tempCode = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return db
    .insert(afnames)
    .values({
      organisatieId: data.organisatieId ?? null,
      respondentCode: tempCode,
      name: data.name && data.name.trim() ? data.name.trim() : "(nog niet ingevuld)",
      company: data.company ?? null,
      role: data.role ?? null,
      consentGiven: false,
      baselineEnergy: 5,
      taal: data.taal ?? "nl",
      status: "uitgenodigd",
      inviteToken: token,
      uitgenodigdAt: now,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function getAfnameByToken(token: string): Promise<Afname | undefined> {
  return db.select().from(afnames).where(eq(afnames.inviteToken, token)).get();
}

export async function markeerHerinnerd(id: number): Promise<Afname | undefined> {
  return db
    .update(afnames)
    .set({ herinnerdAt: new Date().toISOString() })
    .where(eq(afnames.id, id))
    .returning()
    .get();
}

// --- GDPR (Fase C4c) -----------------------------------------------------

export async function gdprExport(
  afnameId: number,
  opts: {
    getOrganisatieNaam: (id: number) => Promise<string | null>;
    getBillerNaam: () => Promise<string | null>;
  },
): Promise<any> {
  const a = await getAfname(afnameId);
  if (!a) throw new Error("Afname niet gevonden");
  const org = a.organisatieId
    ? { id: a.organisatieId, naam: await opts.getOrganisatieNaam(a.organisatieId) }
    : null;
  const reps = await listRapportenVoorAfname(afnameId);
  return {
    exportType: "GDPR-betrokkenenexport (AVG art. 15 & 20)",
    gegenereerdOp: new Date().toISOString(),
    verwerkingsverantwoordelijke: await opts.getBillerNaam(),
    betrokkene: {
      afnameId: a.id,
      respondentCode: a.respondentCode,
      naam: a.geanonimiseerdAt ? "[geanonimiseerd]" : a.name,
      bedrijf: a.company,
      rol: a.role,
    },
    verwerking: {
      doel: a.verwerkingsdoel,
      rechtsgrond: a.rechtsgrond,
      toestemmingGegeven: a.consentGiven,
      toestemmingScope: a.consentScope,
      toestemmingTijdstip: a.consentTimestamp,
      privacyverklaringVersie: a.privacyverklaringVersie,
      toestemmingIngetrokkenOp: a.consentIngetrokkenAt,
      bewaartotDatum: a.bewaartotDatum,
      geanonimiseerdOp: a.geanonimiseerdAt,
      opdrachtgevendeOrganisatie: org,
    },
    verzameldeGegevens: {
      baselineEnergie: a.baselineEnergy,
      status: a.status,
      aangemaaktOp: a.createdAt,
      voltooidOp: a.completedAt,
      ruweAntwoordenDeel1: a.mainResponses ? JSON.parse(a.mainResponses) : null,
      ruweAntwoordenDeel2: a.connectionAnswers ? JSON.parse(a.connectionAnswers) : null,
      gegenereerdProfiel: a.generatorContract ? JSON.parse(a.generatorContract) : null,
    },
    afgeleideDocumenten: reps.map((r) => ({
      id: r.id,
      variant: r.variant,
      titel: r.titel,
      aangemaaktOp: r.createdAt,
    })),
  };
}

async function listRapportenVoorAfname(afnameId: number) {
  return db
    .select()
    .from(rapporten)
    .where(eq(rapporten.afnameId, afnameId))
    .orderBy(desc(rapporten.id))
    .all();
}

export async function anonimiseerAfname(
  afnameId: number,
  _reden: string,
): Promise<Afname | undefined> {
  const a = await getAfname(afnameId);
  if (!a) return undefined;
  if (a.geanonimiseerdAt) return a;
  const now = new Date().toISOString();
  return db
    .update(afnames)
    .set({
      name: "[geanonimiseerd]",
      company: null,
      role: null,
      mainResponses: null,
      connectionAnswers: null,
      generatorContract: null,
      consentIp: null,
      consentUserAgent: null,
      geanonimiseerdAt: now,
      consentScope: `geanonimiseerd: ${_reden}`,
    })
    .where(eq(afnames.id, afnameId))
    .returning()
    .get();
}

export async function trekConsentIn(afnameId: number): Promise<Afname | undefined> {
  const a = await getAfname(afnameId);
  if (!a) return undefined;
  const now = new Date().toISOString();
  return db
    .update(afnames)
    .set({ consentIngetrokkenAt: now })
    .where(eq(afnames.id, afnameId))
    .returning()
    .get();
}
