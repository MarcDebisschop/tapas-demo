/**
 * server/repositories/organisaties.ts
 * 
 * Domein: Organisaties — klanten/opdrachtgevers van het platform.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 */

import { organisaties, creditSaldi } from "@shared/schema";
import type { Organisatie, InsertOrganisatie, CreditSaldo } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "../storage";

/**
 * Hulpfunctie: synchrone saldo-opvraging (geïnjecteerd vanuit storage.ts
 * om circulaire import te vermijden met credits-repository).
 */
export type SaldoSyncFn = (organisatieId: number) => CreditSaldo;

export async function listOrganisaties(saldoSync: SaldoSyncFn): Promise<Array<Organisatie & { saldo: CreditSaldo }>> {
  const orgs = db.select().from(organisaties).orderBy(desc(organisaties.id)).all();
  return orgs.map((o) => ({ ...o, saldo: saldoSync(o.id) }));
}

export async function getOrganisatie(id: number): Promise<Organisatie | undefined> {
  return db.select().from(organisaties).where(eq(organisaties.id, id)).get();
}

export async function createOrganisatie(data: InsertOrganisatie): Promise<Organisatie> {
  const factuurType = data.peppolBereikbaar ? "peppol" : "pdf";
  const org = db
    .insert(organisaties)
    .values({
      naam: data.naam,
      type: data.type,
      btwNummer: data.btwNummer || null,
      kboNummer: data.kboNummer || null,
      peppolId: data.peppolId || null,
      peppolBereikbaar: data.peppolBereikbaar ?? false,
      factuurType,
      contactpersoon: data.contactpersoon || null,
      email: data.email || null,
      adres: data.adres || null,
      postcode: data.postcode || null,
      gemeente: data.gemeente || null,
      land: data.land || "België",
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
  // Initialiseer een nulsaldo zodat elke organisatie altijd een saldoregel heeft.
  db.insert(creditSaldi)
    .values({
      organisatieId: org.id,
      beschikbaar: 0,
      gereserveerd: 0,
      verbruikt: 0,
      updatedAt: new Date().toISOString(),
    })
    .run();
  return org;
}
