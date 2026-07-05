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
import { genereerAiDuiding, isLiveDuidingAan, DUIDING_INSTRUMENT } from "../duiding-manager";

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
  let inhoud = bouwRapportInhoud(contract, variant);
  let html = renderRapportHtml(inhoud);

  // --- Additief (T4P-pilot): LIVE AI-duiding. De statische inhoud/html hierboven
  //     blijft de default én meteen de fallback. Enkel wanneer live-duiding AAN
  //     staat en het instrument T4P is, proberen we de prozateksten te verrijken.
  //     Faalt de AI (traag/geen key/fout/guardrail), dan behouden we de statische
  //     bouwRapportInhoud-tekst — een afname blokkeert nooit. De cijfers/tabellen
  //     (uit scoring.ts) blijven in alle gevallen ongemoeid. ---
  try {
    if (contract?.instrumentId === DUIDING_INSTRUMENT && isLiveDuidingAan()) {
      const verrijkt = await genereerAiDuiding(inhoud, contract);
      if (verrijkt) {
        inhoud = verrijkt;
        html = renderRapportHtml(verrijkt);
      }
    }
  } catch {
    // stil terugvallen op de statische inhoud/html (fallback naar bouwRapportInhoud)
  }

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
