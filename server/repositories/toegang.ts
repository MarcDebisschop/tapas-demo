/**
 * server/repositories/toegang.ts
 * 
 * Domein: Beheerders, Toegangen, Tarieven, Coach accreditatie-aanvragen.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { beheerders, toegangen, tarieven, coachAccreditatieAanvragen } from "@shared/schema";
import type {
  Beheerder,
  InsertBeheerder,
  Toegang,
  Tarief,
  ZetTarief,
  CoachAccreditatieAanvraag,
  InsertCoachAccreditatieAanvraag,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../storage";

// --- Beheerders -----------------------------------------------------------

export async function listBeheerders(): Promise<Beheerder[]> {
  return db.select().from(beheerders).orderBy(desc(beheerders.isPrior), beheerders.id).all();
}

export async function getBeheerder(id: number): Promise<Beheerder | undefined> {
  return db.select().from(beheerders).where(eq(beheerders.id, id)).get();
}

export async function getBeheerderByEmail(email: string): Promise<Beheerder | undefined> {
  return db
    .select()
    .from(beheerders)
    .where(eq(beheerders.email, email.toLowerCase()))
    .get();
}

export async function maakBeheerder(
  data: InsertBeheerder & { toegevoegdDoor?: string },
): Promise<Beheerder> {
  const now = new Date().toISOString();
  return db
    .insert(beheerders)
    .values({
      naam: data.naam,
      email: data.email.toLowerCase(),
      organisatie: data.organisatie ?? "TaPasCity",
      isPrior: data.isPrior ?? false,
      toegevoegdDoor: data.toegevoegdDoor ?? null,
      actief: data.actief ?? true,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function zetBeheerderActief(
  id: number,
  actief: boolean,
): Promise<Beheerder | undefined> {
  return db
    .update(beheerders)
    .set({ actief })
    .where(eq(beheerders.id, id))
    .returning()
    .get();
}

// --- Toegangen -----------------------------------------------------------

export async function listToegangen(beheerderId: number): Promise<Toegang[]> {
  return db.select().from(toegangen).where(eq(toegangen.beheerderId, beheerderId)).all();
}

export async function listAlleToegangen(): Promise<Toegang[]> {
  return db.select().from(toegangen).all();
}

export async function zetToegang(
  beheerderId: number,
  platformdeel: string,
  toegestaan: boolean,
  gewijzigdDoor?: string,
): Promise<Toegang> {
  const now = new Date().toISOString();
  const bestaand = db
    .select()
    .from(toegangen)
    .where(
      and(
        eq(toegangen.beheerderId, beheerderId),
        eq(toegangen.platformdeel, platformdeel),
      ),
    )
    .get();
  if (bestaand) {
    return db
      .update(toegangen)
      .set({ toegestaan, gewijzigdDoor: gewijzigdDoor ?? null, updatedAt: now })
      .where(eq(toegangen.id, bestaand.id))
      .returning()
      .get();
  }
  return db
    .insert(toegangen)
    .values({
      beheerderId,
      platformdeel,
      toegestaan,
      gewijzigdDoor: gewijzigdDoor ?? null,
      updatedAt: now,
    })
    .returning()
    .get();
}

// --- Tarieven (prior-only) -----------------------------------------------

export async function listTarieven(): Promise<Tarief[]> {
  return db.select().from(tarieven).orderBy(tarieven.id).all();
}

export async function getTarief(instrumentId: string): Promise<Tarief | undefined> {
  return db.select().from(tarieven).where(eq(tarieven.instrumentId, instrumentId)).get();
}

/** Upsert op instrumentId: bewerkt een bestaande regel of maakt een nieuwe aan. */
export async function zetTarief(data: ZetTarief, gewijzigdDoor?: string): Promise<Tarief> {
  const now = new Date().toISOString();
  const isBundel = data.model === "bundel";
  const waarden = {
    naam: data.naam,
    omschrijving: data.omschrijving ?? "",
    flowType: data.flowType,
    model: data.model,
    creditCost: data.creditCost,
    bundelGrootte: isBundel ? (data.bundelGrootte ?? null) : null,
    bundelCredits: isBundel ? (data.bundelCredits ?? null) : null,
    isCustom: data.isCustom ?? false,
    gewijzigdDoor: gewijzigdDoor ?? null,
    updatedAt: now,
  };
  const bestaand = await getTarief(data.instrumentId);
  if (bestaand) {
    return db
      .update(tarieven)
      .set(waarden)
      .where(eq(tarieven.id, bestaand.id))
      .returning()
      .get();
  }
  return db
    .insert(tarieven)
    .values({ instrumentId: data.instrumentId, ...waarden })
    .returning()
    .get();
}

/**
 * Verwijdert enkel LOSSE (custom) regels. Een override van een
 * registry-instrument wordt niet hard verwijderd.
 */
export async function verwijderTarief(instrumentId: string): Promise<boolean> {
  const res = db.delete(tarieven).where(eq(tarieven.instrumentId, instrumentId)).run();
  return res.changes > 0;
}

// --- Coach accreditatie-aanvragen (Fase 4 — item 2.7) -------------------

export async function maakCoachAccreditatieAanvraag(
  data: InsertCoachAccreditatieAanvraag,
): Promise<CoachAccreditatieAanvraag> {
  const now = new Date().toISOString();
  return db
    .insert(coachAccreditatieAanvragen)
    .values({ ...data, status: "ingediend", createdAt: now })
    .returning()
    .get();
}

export async function getCoachAccreditatieAanvragen(): Promise<CoachAccreditatieAanvraag[]> {
  return db
    .select()
    .from(coachAccreditatieAanvragen)
    .orderBy(desc(coachAccreditatieAanvragen.createdAt))
    .all();
}
