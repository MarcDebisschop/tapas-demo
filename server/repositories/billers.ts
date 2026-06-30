/**
 * server/repositories/billers.ts
 * 
 * Domein: BillerEntiteiten — facturerende juridische entiteiten.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { billerEntiteiten } from "@shared/schema";
import type { BillerEntiteit, InsertBiller } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db, sqlite } from "../storage";

export async function listBillers(): Promise<BillerEntiteit[]> {
  return db.select().from(billerEntiteiten).orderBy(desc(billerEntiteiten.id)).all();
}

export async function getActieveBiller(): Promise<BillerEntiteit | undefined> {
  return db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
}

export async function createBiller(data: InsertBiller): Promise<BillerEntiteit> {
  return db
    .insert(billerEntiteiten)
    .values({
      ...data,
      geldigVan: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

/**
 * Activeer één biller: sluit de huidige actieve af (geldigTot) en zet de
 * nieuwe actief. Dit is de entiteitswissel (bv. 2BQ CONSULT → PMV-entiteit).
 */
export async function activeerBiller(id: number): Promise<BillerEntiteit | undefined> {
  const tx = sqlite.transaction(() => {
    const now = new Date().toISOString();
    db.update(billerEntiteiten)
      .set({ actief: false, geldigTot: now })
      .where(eq(billerEntiteiten.actief, true))
      .run();
    db.update(billerEntiteiten)
      .set({ actief: true, geldigTot: null })
      .where(eq(billerEntiteiten.id, id))
      .run();
  });
  tx();
  return db.select().from(billerEntiteiten).where(eq(billerEntiteiten.id, id)).get();
}
