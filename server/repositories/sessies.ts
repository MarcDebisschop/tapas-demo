/**
 * server/repositories/sessies.ts
 * 
 * Domein: T4Recruitment — Licenties, Sessies, Kringleden, Studies.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 * 
 * Credit-boekingen voor sessies hergebruiken EXACT hetzelfde append-only
 * grootboek als de individuele afnames; enkel het bedrag verschilt.
 * Daardoor blijven saldo, KPI's en facturatie consistent.
 */

import { licenties, sessies, sessieDeelnemers, sessieStudies } from "@shared/schema";
import type {
  Licentie,
  Sessie,
  SessieDeelnemer,
  SessieStudie,
  SessieRol,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "../storage";
import { cryptoRandom } from "./db";
import { CreditError } from "./credits";

export { CreditError };

/** Geïnjecteerde credit-constanten vanuit storage.ts om circulaire import te vermijden. */
export interface SessieCredits {
  SESSIE_CREDIT_KOST: number;
  HEROPENING_CREDIT_KOST: number;
}

// Hulptype voor credit-injectie
export interface CreditHelpers {
  saldoSync: (organisatieId: number) => import("@shared/schema").CreditSaldo;
  boekTransactie: (
    organisatieId: number,
    type: string,
    aantal: number,
    patch: Partial<import("@shared/schema").CreditSaldo>,
    opts: { afnameId?: number | null; omschrijving?: string | null },
  ) => Promise<import("@shared/schema").CreditSaldo>;
  kosten: SessieCredits;
}

// --- Licenties -----------------------------------------------------------

export async function maakLicentie(data: {
  klantnaam: string;
  klantEmail?: string | null;
  maxProfielen?: number | null;
  prijsPerProfielCent: number;
  geldigTot?: string | null;
  notities?: string | null;
}): Promise<Licentie> {
  const now = new Date().toISOString();
  const sleutel = `T4R-${cryptoRandom(4)}-${cryptoRandom(4)}-${cryptoRandom(4)}`.toUpperCase();
  return db
    .insert(licenties)
    .values({
      sleutel,
      klantnaam: data.klantnaam,
      klantEmail: data.klantEmail ?? null,
      maxProfielen: data.maxProfielen ?? null,
      prijsPerProfielCent: data.prijsPerProfielCent,
      munt: "EUR",
      gebruikteProfielen: 0,
      geldigVan: now,
      geldigTot: data.geldigTot ?? null,
      status: "actief",
      notities: data.notities ?? null,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function listLicenties(): Promise<Licentie[]> {
  return db.select().from(licenties).orderBy(desc(licenties.id)).all();
}

export async function getLicentie(id: number): Promise<Licentie | undefined> {
  return db.select().from(licenties).where(eq(licenties.id, id)).get();
}

export async function getLicentieBySleutel(sleutel: string): Promise<Licentie | undefined> {
  return db.select().from(licenties).where(eq(licenties.sleutel, sleutel)).get();
}

export async function trekLicentieIn(id: number): Promise<Licentie | undefined> {
  return db
    .update(licenties)
    .set({ status: "ingetrokken" })
    .where(eq(licenties.id, id))
    .returning()
    .get();
}

function valideerLicentie(lic: Licentie): void {
  if (lic.status !== "actief") throw new CreditError("Licentie is niet actief");
  if (lic.geldigTot && new Date(lic.geldigTot) < new Date()) {
    throw new CreditError("Licentie is verlopen");
  }
  if (lic.maxProfielen != null && lic.gebruikteProfielen >= lic.maxProfielen) {
    throw new CreditError("Licentie heeft geen profielen meer beschikbaar");
  }
}

// --- Sessies -------------------------------------------------------------

export async function maakSessie(data: {
  titel: string;
  facilitatorNaam?: string | null;
  facilitatorEmail?: string | null;
  taal?: string | null;
  organisatieId?: number | null;
  licentieId?: number | null;
}): Promise<Sessie> {
  const now = new Date().toISOString();
  return db
    .insert(sessies)
    .values({
      instrumentId: "t4recruitment",
      organisatieId: data.organisatieId ?? null,
      licentieId: data.licentieId ?? null,
      titel: data.titel,
      facilitatorNaam: data.facilitatorNaam ?? null,
      facilitatorEmail: data.facilitatorEmail ?? null,
      taal: data.taal ?? "nl",
      status: "draft",
      kringVergrendeld: false,
      heropeningen: 0,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function getSessie(id: number): Promise<Sessie | undefined> {
  return db.select().from(sessies).where(eq(sessies.id, id)).get();
}

export async function listSessies(): Promise<Sessie[]> {
  return db.select().from(sessies).orderBy(desc(sessies.id)).all();
}

export async function updateSessie(
  id: number,
  patch: Partial<Sessie>,
): Promise<Sessie | undefined> {
  return db.update(sessies).set(patch).where(eq(sessies.id, id)).returning().get();
}

export async function vergrendelKring(
  sessieId: number,
  credits: CreditHelpers,
): Promise<Sessie | undefined> {
  const s = await getSessie(sessieId);
  if (!s) return undefined;
  if (s.kringVergrendeld) return s;
  if (s.organisatieId) {
    const saldo = credits.saldoSync(s.organisatieId);
    if (saldo.beschikbaar < credits.kosten.SESSIE_CREDIT_KOST) {
      throw new CreditError(
        `Onvoldoende credits: een T4Recruitment-sessie kost ${credits.kosten.SESSIE_CREDIT_KOST} credits`,
      );
    }
    await credits.boekTransactie(
      s.organisatieId,
      "reservering",
      -credits.kosten.SESSIE_CREDIT_KOST,
      {
        beschikbaar: saldo.beschikbaar - credits.kosten.SESSIE_CREDIT_KOST,
        gereserveerd: saldo.gereserveerd + credits.kosten.SESSIE_CREDIT_KOST,
      },
      {
        omschrijving: `Reservering T4Recruitment-sessie #${sessieId} (${credits.kosten.SESSIE_CREDIT_KOST} credits)`,
      },
    );
  } else if (s.licentieId) {
    const lic = await getLicentie(s.licentieId);
    if (!lic) throw new CreditError("Licentie niet gevonden");
    valideerLicentie(lic);
  } else {
    throw new CreditError("Sessie heeft geen betaalbron (organisatie of licentie)");
  }
  const now = new Date().toISOString();
  return updateSessie(sessieId, {
    kringVergrendeld: true,
    status: "sessie-geopend",
    vergrendeldAt: now,
  });
}

export async function heropenKring(
  sessieId: number,
  credits: CreditHelpers,
): Promise<Sessie | undefined> {
  const s = await getSessie(sessieId);
  if (!s) return undefined;
  if (!s.kringVergrendeld) return s;
  if (s.organisatieId) {
    const saldo = credits.saldoSync(s.organisatieId);
    if (saldo.beschikbaar < credits.kosten.HEROPENING_CREDIT_KOST) {
      throw new CreditError(
        `Onvoldoende credits: een kring heropenen kost ${credits.kosten.HEROPENING_CREDIT_KOST} credits`,
      );
    }
    await credits.boekTransactie(
      s.organisatieId,
      "verbruik",
      -credits.kosten.HEROPENING_CREDIT_KOST,
      {
        beschikbaar: saldo.beschikbaar - credits.kosten.HEROPENING_CREDIT_KOST,
        verbruikt: saldo.verbruikt + credits.kosten.HEROPENING_CREDIT_KOST,
      },
      {
        omschrijving: `Heropening kring sessie #${sessieId} (${credits.kosten.HEROPENING_CREDIT_KOST} credits)`,
      },
    );
    const naVerbruik = credits.saldoSync(s.organisatieId);
    const vrij = Math.min(credits.kosten.SESSIE_CREDIT_KOST, naVerbruik.gereserveerd);
    if (vrij > 0) {
      await credits.boekTransactie(
        s.organisatieId,
        "vrijgave",
        vrij,
        {
          gereserveerd: naVerbruik.gereserveerd - vrij,
          beschikbaar: naVerbruik.beschikbaar + vrij,
        },
        {
          omschrijving: `Vrijgave reservering sessie #${sessieId} bij heropening (${vrij} credits)`,
        },
      );
    }
  }
  return updateSessie(sessieId, {
    kringVergrendeld: false,
    status: "stakeholders-bevestigd",
    heropeningen: (s.heropeningen ?? 0) + 1,
  });
}

export async function finaliseerSessie(
  sessieId: number,
  credits: CreditHelpers,
  rolprofielContract?: unknown,
): Promise<Sessie | undefined> {
  const s = await getSessie(sessieId);
  if (!s) return undefined;
  if (s.status === "vergrendeld") return s;
  if (s.organisatieId) {
    const saldo = credits.saldoSync(s.organisatieId);
    const teVerbruiken = Math.min(credits.kosten.SESSIE_CREDIT_KOST, saldo.gereserveerd);
    if (teVerbruiken > 0) {
      await credits.boekTransactie(
        s.organisatieId,
        "verbruik",
        -teVerbruiken,
        {
          gereserveerd: saldo.gereserveerd - teVerbruiken,
          verbruikt: saldo.verbruikt + teVerbruiken,
        },
        {
          omschrijving: `Verbruik T4Recruitment-sessie #${sessieId} bij finalisatie (${teVerbruiken} credits)`,
        },
      );
    }
  } else if (s.licentieId) {
    const lic = await getLicentie(s.licentieId);
    if (lic) {
      db.update(licenties)
        .set({ gebruikteProfielen: lic.gebruikteProfielen + 1 })
        .where(eq(licenties.id, lic.id))
        .run();
    }
  }
  const now = new Date().toISOString();
  return updateSessie(sessieId, {
    status: "vergrendeld",
    gefinaliseerdAt: now,
    ...(rolprofielContract !== undefined
      ? { rolprofielContract: JSON.stringify(rolprofielContract) }
      : {}),
  });
}

// --- Kringleden ----------------------------------------------------------

export async function voegKringlidToe(
  sessieId: number,
  data: { rol: SessieRol; naam?: string | null; email?: string | null },
): Promise<SessieDeelnemer> {
  const now = new Date().toISOString();
  const token = `${cryptoRandom(8)}-${cryptoRandom(8)}-${cryptoRandom(8)}`;
  return db
    .insert(sessieDeelnemers)
    .values({
      sessieId,
      rol: data.rol,
      naam: data.naam ?? null,
      email: data.email ?? null,
      inviteToken: token,
      status: "uitgenodigd",
      uitgenodigdAt: now,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function listKringleden(sessieId: number): Promise<SessieDeelnemer[]> {
  return db
    .select()
    .from(sessieDeelnemers)
    .where(eq(sessieDeelnemers.sessieId, sessieId))
    .orderBy(sessieDeelnemers.id)
    .all();
}

export async function getKringlidByToken(token: string): Promise<SessieDeelnemer | undefined> {
  return db
    .select()
    .from(sessieDeelnemers)
    .where(eq(sessieDeelnemers.inviteToken, token))
    .get();
}

export async function verwijderKringlid(id: number): Promise<void> {
  db.delete(sessieDeelnemers).where(eq(sessieDeelnemers.id, id)).run();
}

export async function updateKringlid(
  id: number,
  patch: Partial<SessieDeelnemer>,
): Promise<SessieDeelnemer | undefined> {
  return db
    .update(sessieDeelnemers)
    .set(patch)
    .where(eq(sessieDeelnemers.id, id))
    .returning()
    .get();
}

// --- Vergelijkende studie (0 credits) ------------------------------------

export async function voegStudieToe(
  sessieId: number,
  kandidaatLabel: string,
  studieContract?: unknown,
): Promise<SessieStudie> {
  const now = new Date().toISOString();
  return db
    .insert(sessieStudies)
    .values({
      sessieId,
      kandidaatLabel,
      studieContract: studieContract !== undefined ? JSON.stringify(studieContract) : null,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function listStudies(sessieId: number): Promise<SessieStudie[]> {
  return db
    .select()
    .from(sessieStudies)
    .where(eq(sessieStudies.sessieId, sessieId))
    .orderBy(desc(sessieStudies.id))
    .all();
}
