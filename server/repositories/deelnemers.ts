/**
 * server/repositories/deelnemers.ts
 * 
 * Domein: Deelnemers (TaPas Persoonlijk), ChatBerichten, Uitleg-tegoeden.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { deelnemers, chatBerichten, afnames } from "@shared/schema";
import type { Deelnemer, ChatBericht, UpdateDeelnemer } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "../storage";
import { cryptoRandom } from "./db";

/** Normaliseert e-mailadressen: lowercase + trim. */
function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

// --- Deelnemers -----------------------------------------------------------

export async function vindOfMaakDeelnemer(email: string, taal?: string): Promise<Deelnemer> {
  const e = normEmail(email);
  const bestaand = await getDeelnemerByEmail(e);
  if (bestaand) {
    // Synchroniseer naam vanuit meest recente afname als die nog leeg is.
    if (!bestaand.naam) {
      const afn = await listAfnamesVoorDeelnemer(e);
      const naam = afn.find((a) => a.name && a.name !== "(nog niet ingevuld)")?.name;
      if (naam) {
        return (await updateDeelnemer(bestaand.id, { naam })) ?? bestaand;
      }
    }
    return bestaand;
  }
  const afn = await listAfnamesVoorDeelnemer(e);
  const naam = afn.find((a) => a.name && a.name !== "(nog niet ingevuld)")?.name ?? null;
  const token = `${cryptoRandom(10)}${cryptoRandom(10)}${cryptoRandom(10)}`;
  return db
    .insert(deelnemers)
    .values({
      email: e,
      naam,
      taal: taal ?? afn[0]?.taal ?? "nl",
      dashboardToken: token,
      mailCadans: "uit",
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

export async function getDeelnemerByEmail(email: string): Promise<Deelnemer | undefined> {
  return db.select().from(deelnemers).where(eq(deelnemers.email, normEmail(email))).get();
}

export async function getDeelnemerByToken(token: string): Promise<Deelnemer | undefined> {
  return db.select().from(deelnemers).where(eq(deelnemers.dashboardToken, token)).get();
}

export async function updateDeelnemer(
  id: number,
  patch: UpdateDeelnemer,
): Promise<Deelnemer | undefined> {
  const set: Record<string, unknown> = {};
  if (patch.naam !== undefined) set.naam = patch.naam;
  if (patch.fotoUrl !== undefined) set.fotoUrl = patch.fotoUrl;
  if (patch.taal !== undefined) set.taal = patch.taal;
  if (patch.mailCadans !== undefined) {
    set.mailCadans = patch.mailCadans;
    set.mailUitgeschrevenAt = patch.mailCadans === "uit" ? new Date().toISOString() : null;
  }
  if (Object.keys(set).length === 0) {
    return db.select().from(deelnemers).where(eq(deelnemers.id, id)).get();
  }
  return db.update(deelnemers).set(set).where(eq(deelnemers.id, id)).returning().get();
}

export async function koppelAfnameAanDeelnemer(
  afnameId: number,
  email: string,
): Promise<import("@shared/schema").Afname | undefined> {
  return db
    .update(afnames)
    .set({ deelnemerEmail: normEmail(email) })
    .where(eq(afnames.id, afnameId))
    .returning()
    .get();
}

export async function listAfnamesVoorDeelnemer(
  email: string,
): Promise<import("@shared/schema").Afname[]> {
  return db
    .select()
    .from(afnames)
    .where(eq(afnames.deelnemerEmail, normEmail(email)))
    .orderBy(desc(afnames.id))
    .all();
}

// --- AI-chatbot (Fase 2) -------------------------------------------------

export async function verhoogVragenGebruikt(deelnemerId: number): Promise<Deelnemer | undefined> {
  const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
  if (!huidig) return undefined;
  return db
    .update(deelnemers)
    .set({ vragenGebruikt: (huidig.vragenGebruikt ?? 0) + 1 })
    .where(eq(deelnemers.id, deelnemerId))
    .returning()
    .get();
}

export async function voegVragenTegoedToe(
  deelnemerId: number,
  aantal: number,
): Promise<Deelnemer | undefined> {
  const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
  if (!huidig) return undefined;
  return db
    .update(deelnemers)
    .set({ vragenTegoed: (huidig.vragenTegoed ?? 0) + aantal })
    .where(eq(deelnemers.id, deelnemerId))
    .returning()
    .get();
}

export async function listChatBerichten(deelnemerId: number): Promise<ChatBericht[]> {
  return db
    .select()
    .from(chatBerichten)
    .where(eq(chatBerichten.deelnemerId, deelnemerId))
    .orderBy(chatBerichten.id)
    .all();
}

export async function voegChatBerichtToe(
  deelnemerId: number,
  rol: string,
  inhoud: string,
  veiligheid?: string | null,
): Promise<ChatBericht> {
  return db
    .insert(chatBerichten)
    .values({
      deelnemerId,
      rol,
      inhoud,
      veiligheid: veiligheid ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

// --- Gesproken profieluitleg (audio) -------------------------------------

export async function verhoogUitlegGebruikt(
  deelnemerId: number,
  toon: "deelnemer" | "coach",
): Promise<Deelnemer | undefined> {
  const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
  if (!huidig) return undefined;
  const set =
    toon === "coach"
      ? { uitlegGebruiktCoach: (huidig.uitlegGebruiktCoach ?? 0) + 1 }
      : { uitlegGebruiktDeelnemer: (huidig.uitlegGebruiktDeelnemer ?? 0) + 1 };
  return db
    .update(deelnemers)
    .set(set)
    .where(eq(deelnemers.id, deelnemerId))
    .returning()
    .get();
}

export async function voegUitlegTegoedToe(
  deelnemerId: number,
  toon: "deelnemer" | "coach",
  aantal: number,
): Promise<Deelnemer | undefined> {
  const huidig = db.select().from(deelnemers).where(eq(deelnemers.id, deelnemerId)).get();
  if (!huidig) return undefined;
  const set =
    toon === "coach"
      ? { uitlegTegoedCoach: (huidig.uitlegTegoedCoach ?? 0) + aantal }
      : { uitlegTegoedDeelnemer: (huidig.uitlegTegoedDeelnemer ?? 0) + aantal };
  return db
    .update(deelnemers)
    .set(set)
    .where(eq(deelnemers.id, deelnemerId))
    .returning()
    .get();
}
