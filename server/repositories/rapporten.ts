/**
 * server/repositories/rapporten.ts
 * 
 * Domein: Rapporten — gegenereerde profielrapporten (PDF/HTML) per afname.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { rapporten, afnames } from "@shared/schema";
import type { Rapport, Afname } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "../storage";
import { bouwRapportInhoud, renderRapportHtml } from "../rapportgenerator";

export class RapportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RapportError";
  }
}

/**
 * Genereert een nieuw rapport op basis van de afname. Vereist status 'voltooid'
 * en een geldig generatorContract.
 */
export async function genereerRapport(
  afnameId: number,
  variant: "kompas" | "coachatlas",
): Promise<Rapport> {
  const afname = db.select().from(afnames).where(eq(afnames.id, afnameId)).get();
  if (!afname) throw new RapportError("Afname niet gevonden");
  if (afname.status !== "voltooid" || !afname.generatorContract) {
    throw new RapportError(
      "Afname is nog niet voltooid; er is geen contract om een rapport uit te genereren",
    );
  }
  const contract = JSON.parse(afname.generatorContract);
  const inhoud = bouwRapportInhoud(contract, variant);
  const html = renderRapportHtml(inhoud);
  const now = new Date().toISOString();
  return db
    .insert(rapporten)
    .values({
      afnameId,
      variant,
      titel: `${inhoud.titel} — ${inhoud.respondent.naam}`,
      inhoud: JSON.stringify(inhoud),
      html,
      contractVersie: contract?.contractVersion ?? "1.0.0",
      createdAt: now,
    })
    .returning()
    .get();
}

export async function getRapport(id: number): Promise<Rapport | undefined> {
  return db.select().from(rapporten).where(eq(rapporten.id, id)).get();
}

export async function listRapporten(afnameId?: number): Promise<Rapport[]> {
  if (afnameId != null) {
    return db
      .select()
      .from(rapporten)
      .where(eq(rapporten.afnameId, afnameId))
      .orderBy(desc(rapporten.id))
      .all();
  }
  return db.select().from(rapporten).orderBy(desc(rapporten.id)).all();
}
