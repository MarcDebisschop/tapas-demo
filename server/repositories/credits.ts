/**
 * server/repositories/credits.ts
 * 
 * Domein: Credits, Betalingen, Facturen, Creditnota's, Bestuursrapportage.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Niet rechtstreeks
 * importeren vanuit routes of andere modules.
 * 
 * Alle bedragen in eurocent om afrondingsfouten te vermijden.
 * Append-only grootboek: elke kredietbeweging als transactieregel bewaren.
 */

import {
  creditSaldi,
  creditTransacties,
  betalingen,
  facturen,
  creditnotas,
  billerEntiteiten,
  organisaties,
  afnames,
  rapporten,
} from "@shared/schema";
import type {
  CreditSaldo,
  CreditTransactie,
  Betaling,
  Factuur,
  Creditnota,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db, sqlite } from "../storage";

export class CreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditError";
  }
}

export interface Creditpakket {
  id: string;
  naam: string;
  credits: number;
  prijsExclBtw: number;
}

export const CREDITPAKKETTEN: Creditpakket[] = [
  { id: "start", naam: "Starter", credits: 10, prijsExclBtw: 49 },
  { id: "groei", naam: "Groei", credits: 25, prijsExclBtw: 110 },
  { id: "schaal", naam: "Schaal", credits: 60, prijsExclBtw: 240 },
];

export const SESSIE_CREDIT_KOST = Number(process.env.T4R_SESSIE_CREDITS ?? 20);
export const HEROPENING_CREDIT_KOST = Number(process.env.T4R_HEROPENING_CREDITS ?? 10);

// --- Interne helpers ---------------------------------------------------

/** Synchrone saldo-opvraging (gebruikt binnen SQLite-transacties). */
export function saldoSync(organisatieId: number): CreditSaldo {
  let s = db
    .select()
    .from(creditSaldi)
    .where(eq(creditSaldi.organisatieId, organisatieId))
    .get();
  if (!s) {
    s = db
      .insert(creditSaldi)
      .values({
        organisatieId,
        beschikbaar: 0,
        gereserveerd: 0,
        verbruikt: 0,
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }
  return s;
}

/** Prijs per credit in eurocent (afgeleid van Starter-pakket). */
function prijsPerCreditCent(): number {
  const starter = CREDITPAKKETTEN.find((p) => p.id === "start") ?? CREDITPAKKETTEN[0];
  return Math.round((starter.prijsExclBtw / starter.credits) * 100);
}

/** Logboekregel + saldo-update altijd samen binnen één SQLite-transactie. */
export async function boekTransactie(
  organisatieId: number,
  type: string,
  aantal: number,
  patch: Partial<CreditSaldo>,
  opts: { afnameId?: number | null; omschrijving?: string | null },
): Promise<CreditSaldo> {
  const biller = db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
  const billerId = biller?.id ?? null;
  const tx = sqlite.transaction(() => {
    const now = new Date().toISOString();
    saldoSync(organisatieId);
    db.update(creditSaldi)
      .set({ ...patch, updatedAt: now })
      .where(eq(creditSaldi.organisatieId, organisatieId))
      .run();
    db.insert(creditTransacties)
      .values({
        organisatieId,
        type,
        aantal,
        afnameId: opts.afnameId ?? null,
        billerEntiteitId: billerId,
        omschrijving: opts.omschrijving ?? null,
        createdAt: now,
      })
      .run();
  });
  tx();
  return saldoSync(organisatieId);
}

// --- Saldo & Transacties -----------------------------------------------

export async function getSaldo(organisatieId: number): Promise<CreditSaldo> {
  return saldoSync(organisatieId);
}

export async function laadCredits(
  organisatieId: number,
  aantal: number,
  omschrijving?: string,
): Promise<CreditSaldo> {
  const s = saldoSync(organisatieId);
  return boekTransactie(
    organisatieId,
    "aankoop",
    aantal,
    { beschikbaar: s.beschikbaar + aantal },
    { omschrijving: omschrijving ?? `Aankoop ${aantal} credits` },
  );
}

export async function reserveer(
  organisatieId: number,
  afnameId: number,
): Promise<CreditSaldo> {
  const s = saldoSync(organisatieId);
  if (s.beschikbaar < 1) {
    throw new CreditError("Onvoldoende credits beschikbaar om een link aan te maken");
  }
  return boekTransactie(
    organisatieId,
    "reservering",
    -1,
    { beschikbaar: s.beschikbaar - 1, gereserveerd: s.gereserveerd + 1 },
    { afnameId, omschrijving: `Reservering voor afname #${afnameId}` },
  );
}

export async function verbruik(
  organisatieId: number,
  afnameId: number,
): Promise<CreditSaldo> {
  const s = saldoSync(organisatieId);
  if (s.gereserveerd < 1) return s;
  return boekTransactie(
    organisatieId,
    "verbruik",
    -1,
    { gereserveerd: s.gereserveerd - 1, verbruikt: s.verbruikt + 1 },
    { afnameId, omschrijving: `Verbruik bij voltooiing afname #${afnameId}` },
  );
}

export async function geefVrij(
  organisatieId: number,
  afnameId: number,
): Promise<CreditSaldo> {
  const s = saldoSync(organisatieId);
  if (s.gereserveerd < 1) return s;
  return boekTransactie(
    organisatieId,
    "vrijgave",
    1,
    { gereserveerd: s.gereserveerd - 1, beschikbaar: s.beschikbaar + 1 },
    { afnameId, omschrijving: `Vrijgave reservering afname #${afnameId}` },
  );
}

export async function overdracht(
  vanId: number,
  naarId: number,
  aantal: number,
  omschrijving?: string,
): Promise<void> {
  if (vanId === naarId) throw new CreditError("Bron en bestemming mogen niet gelijk zijn");
  if (aantal < 1) throw new CreditError("Aantal moet groter dan 0 zijn");
  const bron = saldoSync(vanId);
  if (bron.beschikbaar < aantal) {
    throw new CreditError("Onvoldoende beschikbare credits voor overdracht");
  }
  const bestemming = saldoSync(naarId);
  const biller = db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
  const billerId = biller?.id ?? null;
  const tx = sqlite.transaction(() => {
    const now = new Date().toISOString();
    db.update(creditSaldi)
      .set({ beschikbaar: bron.beschikbaar - aantal, updatedAt: now })
      .where(eq(creditSaldi.organisatieId, vanId))
      .run();
    db.update(creditSaldi)
      .set({ beschikbaar: bestemming.beschikbaar + aantal, updatedAt: now })
      .where(eq(creditSaldi.organisatieId, naarId))
      .run();
    db.insert(creditTransacties)
      .values({
        organisatieId: vanId,
        type: "overdracht",
        aantal: -aantal,
        afnameId: null,
        billerEntiteitId: billerId,
        omschrijving: omschrijving ?? `Overdracht naar organisatie #${naarId}`,
        createdAt: now,
      })
      .run();
    db.insert(creditTransacties)
      .values({
        organisatieId: naarId,
        type: "overdracht",
        aantal: aantal,
        afnameId: null,
        billerEntiteitId: billerId,
        omschrijving: omschrijving ?? `Overdracht van organisatie #${vanId}`,
        createdAt: now,
      })
      .run();
  });
  tx();
}

export async function listTransacties(
  organisatieId?: number,
): Promise<CreditTransactie[]> {
  if (organisatieId != null) {
    return db
      .select()
      .from(creditTransacties)
      .where(eq(creditTransacties.organisatieId, organisatieId))
      .orderBy(desc(creditTransacties.id))
      .all();
  }
  return db
    .select()
    .from(creditTransacties)
    .orderBy(desc(creditTransacties.id))
    .all();
}

// --- Betalingen -----------------------------------------------------------

export async function startBetaling(
  organisatieId: number,
  credits: number,
  pakketId?: string | null,
): Promise<Betaling> {
  const biller = db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
  const btwTarief = biller?.btwTarief ?? 21;
  const exclCent = prijsPerCreditCent() * credits;
  const btwCent = Math.round((exclCent * btwTarief) / 100);
  const inclCent = exclCent + btwCent;
  const now = new Date().toISOString();
  return db
    .insert(betalingen)
    .values({
      organisatieId,
      provider: "mollie",
      providerRef: `tr_sim_${Date.now()}`,
      pakketId: pakketId ?? null,
      credits,
      bedragExclBtw: exclCent,
      btwTarief,
      btwBedrag: btwCent,
      bedragInclBtw: inclCent,
      munt: "EUR",
      status: "open",
      checkoutUrl: `#/betaling/sim`,
      createdAt: now,
    })
    .returning()
    .get();
}

export async function getBetaling(id: number): Promise<Betaling | undefined> {
  return db.select().from(betalingen).where(eq(betalingen.id, id)).get();
}

export async function listBetalingen(organisatieId?: number): Promise<Betaling[]> {
  if (organisatieId != null) {
    return db
      .select()
      .from(betalingen)
      .where(eq(betalingen.organisatieId, organisatieId))
      .orderBy(desc(betalingen.id))
      .all();
  }
  return db.select().from(betalingen).orderBy(desc(betalingen.id)).all();
}

export async function markeerBetalingMislukt(id: number): Promise<Betaling | undefined> {
  return db
    .update(betalingen)
    .set({ status: "mislukt" })
    .where(eq(betalingen.id, id))
    .returning()
    .get();
}

// --- Facturen -------------------------------------------------------------

function volgendFactuurnummer(prefix: string): string {
  const jaar = new Date().getFullYear();
  const zoek = `${prefix}-${jaar}-`;
  const bestaande = db.select().from(facturen).all();
  let max = 0;
  for (const f of bestaande) {
    if (f.factuurnummer.startsWith(zoek)) {
      const n = parseInt(f.factuurnummer.slice(zoek.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${zoek}${String(max + 1).padStart(4, "0")}`;
}

/**
 * Bevestig een geslaagde betaling. Atomair:
 * 1) credits opladen, 2) factuur aanmaken, 3) betaling op 'betaald'.
 * Idempotent: een reeds betaalde betaling levert de bestaande factuur terug.
 */
export async function bevestigBetaling(
  id: number,
  methode?: string,
): Promise<{ betaling: Betaling; factuur: Factuur } | undefined> {
  const betaling = await getBetaling(id);
  if (!betaling) return undefined;
  if (betaling.status === "betaald") {
    const bestaand = betaling.factuurId ? await getFactuur(betaling.factuurId) : undefined;
    if (bestaand) return { betaling, factuur: bestaand };
  }
  if (betaling.status !== "open") {
    throw new CreditError(
      `Betaling kan niet bevestigd worden (status: ${betaling.status})`,
    );
  }
  const org = db
    .select()
    .from(organisaties)
    .where(eq(organisaties.id, betaling.organisatieId))
    .get();
  if (!org) throw new CreditError("Organisatie niet gevonden voor betaling");
  const biller = db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
  if (!biller) throw new CreditError("Geen actieve facturerende entiteit");

  const now = new Date().toISOString();
  const kanaal = org.peppolBereikbaar ? "peppol" : "pdf";
  const factuurnummer = volgendFactuurnummer(biller.factuurPrefix);

  const peppolDocument = {
    profiel: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    documenttype: "Invoice",
    factuurnummer,
    uitgiftedatum: now.slice(0, 10),
    munt: betaling.munt,
    verkoper: {
      naam: biller.vennootschapsnaam,
      btw: biller.btwNummer,
      kbo: biller.kboNummer,
      peppolId: biller.peppolId,
      adres: {
        straat: biller.adres,
        postcode: biller.postcode,
        gemeente: biller.gemeente,
        land: biller.land,
      },
    },
    koper: {
      naam: org.naam,
      btw: org.btwNummer,
      kbo: org.kboNummer,
      peppolId: org.peppolId,
      adres: {
        straat: org.adres,
        postcode: org.postcode,
        gemeente: org.gemeente,
        land: org.land,
      },
    },
    regels: [
      {
        omschrijving: `TaPas credits (${betaling.credits} stuks)`,
        aantal: betaling.credits,
        eenheidsprijsExclCent: prijsPerCreditCent(),
        btwTarief: betaling.btwTarief,
        totaalExclCent: betaling.bedragExclBtw,
      },
    ],
    totalen: {
      exclBtwCent: betaling.bedragExclBtw,
      btwCent: betaling.btwBedrag,
      inclBtwCent: betaling.bedragInclBtw,
    },
  };

  const regels = [
    {
      omschrijving: `TaPas credits (${betaling.credits} stuks)`,
      aantal: betaling.credits,
      eenheidsprijsExclCent: prijsPerCreditCent(),
      btwTarief: betaling.btwTarief,
      totaalExclCent: betaling.bedragExclBtw,
    },
  ];

  await laadCredits(
    betaling.organisatieId,
    betaling.credits,
    `Online betaling #${betaling.id} (${betaling.credits} credits)`,
  );
  const laatsteAankoop = db
    .select()
    .from(creditTransacties)
    .where(eq(creditTransacties.organisatieId, betaling.organisatieId))
    .orderBy(desc(creditTransacties.id))
    .get();

  const factuur = db
    .insert(facturen)
    .values({
      factuurnummer,
      billerEntiteitId: biller.id,
      organisatieId: org.id,
      betalingId: betaling.id,
      billerSnapshot: JSON.stringify({
        naam: biller.naam,
        vennootschapsnaam: biller.vennootschapsnaam,
        adres: biller.adres,
        postcode: biller.postcode,
        gemeente: biller.gemeente,
        land: biller.land,
        btwNummer: biller.btwNummer,
        kboNummer: biller.kboNummer,
        peppolId: biller.peppolId,
      }),
      klantSnapshot: JSON.stringify({
        naam: org.naam,
        btwNummer: org.btwNummer,
        kboNummer: org.kboNummer,
        peppolId: org.peppolId,
        email: org.email,
        adres: org.adres,
        postcode: org.postcode,
        gemeente: org.gemeente,
        land: org.land,
      }),
      regels: JSON.stringify(regels),
      bedragExclBtw: betaling.bedragExclBtw,
      btwBedrag: betaling.btwBedrag,
      bedragInclBtw: betaling.bedragInclBtw,
      munt: betaling.munt,
      kanaal,
      peppolStatus: kanaal === "peppol" ? "klaar" : "n.v.t.",
      peppolDocument: kanaal === "peppol" ? JSON.stringify(peppolDocument) : null,
      factuurdatum: now,
      createdAt: now,
    })
    .returning()
    .get();

  const bijgewerkt = db
    .update(betalingen)
    .set({
      status: "betaald",
      methode: methode ?? "bancontact",
      betaaldAt: now,
      creditTransactieId: laatsteAankoop?.id ?? null,
      factuurId: factuur.id,
    })
    .where(eq(betalingen.id, betaling.id))
    .returning()
    .get();

  return { betaling: bijgewerkt, factuur };
}

export async function getFactuur(id: number): Promise<Factuur | undefined> {
  return db.select().from(facturen).where(eq(facturen.id, id)).get();
}

export async function listFacturen(organisatieId?: number): Promise<Factuur[]> {
  if (organisatieId != null) {
    return db
      .select()
      .from(facturen)
      .where(eq(facturen.organisatieId, organisatieId))
      .orderBy(desc(facturen.id))
      .all();
  }
  return db.select().from(facturen).orderBy(desc(facturen.id)).all();
}

// --- Creditnota's ---------------------------------------------------------

function volgendCreditnotanummer(prefix: string): string {
  const jaar = new Date().getFullYear();
  const zoek = `${prefix}-CN-${jaar}-`;
  const bestaande = db.select().from(creditnotas).all();
  let max = 0;
  for (const c of bestaande) {
    if (c.creditnotanummer.startsWith(zoek)) {
      const n = parseInt(c.creditnotanummer.slice(zoek.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${zoek}${String(max + 1).padStart(4, "0")}`;
}

export async function maakCreditnota(
  factuurId: number,
  reden: string,
  creditsTerugboeken: boolean,
): Promise<Creditnota> {
  const factuur = await getFactuur(factuurId);
  if (!factuur) throw new CreditError("Factuur niet gevonden");
  const bestaand = db
    .select()
    .from(creditnotas)
    .where(eq(creditnotas.factuurId, factuurId))
    .get();
  if (bestaand) {
    throw new CreditError("Er bestaat al een creditnota voor deze factuur");
  }
  const biller = db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
  if (!biller) throw new CreditError("Geen actieve facturerende entiteit");
  const now = new Date().toISOString();
  const nummer = volgendCreditnotanummer(biller.factuurPrefix);

  const origRegels = JSON.parse(factuur.regels) as Array<any>;
  const negRegels = origRegels.map((r) => ({
    ...r,
    aantal: -Math.abs(r.aantal),
    totaalExclCent: -Math.abs(r.totaalExclCent),
  }));

  const peppolDocument = {
    profiel: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    documenttype: "CreditNote",
    creditnotanummer: nummer,
    verwijstNaarFactuur: factuur.factuurnummer,
    uitgiftedatum: now.slice(0, 10),
    munt: factuur.munt,
    verkoper: JSON.parse(factuur.billerSnapshot),
    koper: JSON.parse(factuur.klantSnapshot),
    regels: negRegels,
    totalen: {
      exclBtwCent: -Math.abs(factuur.bedragExclBtw),
      btwCent: -Math.abs(factuur.btwBedrag),
      inclBtwCent: -Math.abs(factuur.bedragInclBtw),
    },
    reden,
  };

  const creditnota = db
    .insert(creditnotas)
    .values({
      creditnotanummer: nummer,
      factuurId: factuur.id,
      billerEntiteitId: factuur.billerEntiteitId,
      organisatieId: factuur.organisatieId,
      reden,
      billerSnapshot: factuur.billerSnapshot,
      klantSnapshot: factuur.klantSnapshot,
      regels: JSON.stringify(negRegels),
      bedragExclBtw: -Math.abs(factuur.bedragExclBtw),
      btwBedrag: -Math.abs(factuur.btwBedrag),
      bedragInclBtw: -Math.abs(factuur.bedragInclBtw),
      munt: factuur.munt,
      kanaal: factuur.kanaal,
      peppolStatus: factuur.kanaal === "peppol" ? "klaar" : "n.v.t.",
      peppolDocument:
        factuur.kanaal === "peppol" ? JSON.stringify(peppolDocument) : null,
      creditsTeruggeboekt: creditsTerugboeken,
      creditnotaDatum: now,
      createdAt: now,
    })
    .returning()
    .get();

  if (creditsTerugboeken) {
    const aantal = origRegels.reduce((s: number, r: any) => s + Math.abs(r.aantal), 0);
    const s = saldoSync(factuur.organisatieId);
    const terug = Math.min(aantal, s.beschikbaar);
    if (terug > 0) {
      await boekTransactie(
        factuur.organisatieId,
        "correctie",
        -terug,
        { beschikbaar: s.beschikbaar - terug },
        {
          omschrijving: `Terugboeking via creditnota ${nummer} (factuur ${factuur.factuurnummer})`,
        },
      );
    }
  }

  return creditnota;
}

export async function getCreditnota(id: number): Promise<Creditnota | undefined> {
  return db.select().from(creditnotas).where(eq(creditnotas.id, id)).get();
}

export async function listCreditnotas(organisatieId?: number): Promise<Creditnota[]> {
  if (organisatieId != null) {
    return db
      .select()
      .from(creditnotas)
      .where(eq(creditnotas.organisatieId, organisatieId))
      .orderBy(desc(creditnotas.id))
      .all();
  }
  return db.select().from(creditnotas).orderBy(desc(creditnotas.id)).all();
}

// --- Bestuursrapportage --------------------------------------------------

export interface BestuursKpis {
  gegenereerdOp: string;
  munt: string;
  omzet: {
    totaalExclBtw: number;
    totaalBtw: number;
    totaalInclBtw: number;
    nettoExclBtwNaCreditnotas: number;
    aantalFacturen: number;
    aantalCreditnotas: number;
  };
  klanten: {
    aantalOrganisaties: number;
    aantalBetalendeOrganisaties: number;
    perType: Record<string, number>;
  };
  credits: {
    verkocht: number;
    verbruikt: number;
    gereserveerd: number;
    beschikbaarUitstaand: number;
    verzilveringsgraad: number;
  };
  afnames: {
    totaal: number;
    voltooid: number;
    inUitvoering: number;
    voltooiingsgraad: number;
    rapportenGegenereerd: number;
  };
  betalingen: {
    geslaagd: number;
    mislukt: number;
    open: number;
    slagingsgraad: number;
  };
  gemiddelden: {
    gemiddeldeOrderwaardeExclBtw: number;
    omzetPerBetalendeOrganisatie: number;
  };
  gdpr: {
    afnamesMetPersoonsgegevens: number;
    geanonimiseerd: number;
    consentIngetrokken: number;
    bewaartermijnVerstreken: number;
  };
}

export interface BoekhoudExportRegel {
  documenttype: string;
  nummer: string;
  datum: string;
  klant: string;
  klantBtw: string | null;
  bedragExclBtw: number;
  btwTarief: number;
  btwBedrag: number;
  bedragInclBtw: number;
  munt: string;
  kanaal: string;
}

export async function bestuursKpis(): Promise<BestuursKpis> {
  const euro = (cent: number) => Number((cent / 100).toFixed(2));
  const pct = (deel: number, geheel: number) =>
    geheel > 0 ? Number(((deel / geheel) * 100).toFixed(1)) : 0;

  const alleFacturen = db.select().from(facturen).all();
  const alleCreditnotas = db.select().from(creditnotas).all();
  const alleOrgs = db.select().from(organisaties).all();
  const alleSaldi = db.select().from(creditSaldi).all();
  const alleAfnames = db.select().from(afnames).all();
  const alleBetalingen = db.select().from(betalingen).all();
  const alleRapporten = db.select().from(rapporten).all();
  const alleTransacties = db.select().from(creditTransacties).all();

  const omzetExcl = alleFacturen.reduce((s, f) => s + f.bedragExclBtw, 0);
  const omzetBtw = alleFacturen.reduce((s, f) => s + f.btwBedrag, 0);
  const omzetIncl = alleFacturen.reduce((s, f) => s + f.bedragInclBtw, 0);
  const cnExcl = alleCreditnotas.reduce((s, c) => s + c.bedragExclBtw, 0);
  const nettoExcl = omzetExcl + cnExcl;

  const betalendeOrgIds = new Set(alleFacturen.map((f) => f.organisatieId));
  const perType: Record<string, number> = {};
  for (const o of alleOrgs) perType[o.type] = (perType[o.type] ?? 0) + 1;

  const verkocht = alleTransacties
    .filter((t) => t.type === "aankoop")
    .reduce((s, t) => s + t.aantal, 0);
  const verbruikt = alleSaldi.reduce((s, x) => s + x.verbruikt, 0);
  const gereserveerd = alleSaldi.reduce((s, x) => s + x.gereserveerd, 0);
  const beschikbaar = alleSaldi.reduce((s, x) => s + x.beschikbaar, 0);

  const voltooid = alleAfnames.filter((a) => a.status === "voltooid").length;
  const inUitvoering = alleAfnames.filter(
    (a) => a.status === "deel1" || a.status === "deel2",
  ).length;

  const geslaagd = alleBetalingen.filter((b) => b.status === "betaald").length;
  const mislukt = alleBetalingen.filter(
    (b) => b.status === "mislukt" || b.status === "verlopen",
  ).length;
  const openBet = alleBetalingen.filter((b) => b.status === "open").length;

  const metPg = alleAfnames.filter((a) => !a.geanonimiseerdAt).length;
  const geanon = alleAfnames.filter((a) => !!a.geanonimiseerdAt).length;
  const ingetrokken = alleAfnames.filter((a) => !!a.consentIngetrokkenAt).length;
  const nu = new Date().toISOString().slice(0, 10);
  const verstreken = alleAfnames.filter(
    (a) =>
      !a.geanonimiseerdAt && a.bewaartotDatum && a.bewaartotDatum.slice(0, 10) < nu,
  ).length;

  return {
    gegenereerdOp: new Date().toISOString(),
    munt: "EUR",
    omzet: {
      totaalExclBtw: euro(omzetExcl),
      totaalBtw: euro(omzetBtw),
      totaalInclBtw: euro(omzetIncl),
      nettoExclBtwNaCreditnotas: euro(nettoExcl),
      aantalFacturen: alleFacturen.length,
      aantalCreditnotas: alleCreditnotas.length,
    },
    klanten: {
      aantalOrganisaties: alleOrgs.length,
      aantalBetalendeOrganisaties: betalendeOrgIds.size,
      perType,
    },
    credits: {
      verkocht,
      verbruikt,
      gereserveerd,
      beschikbaarUitstaand: beschikbaar,
      verzilveringsgraad: pct(verbruikt, verkocht),
    },
    afnames: {
      totaal: alleAfnames.length,
      voltooid,
      inUitvoering,
      voltooiingsgraad: pct(voltooid, alleAfnames.length),
      rapportenGegenereerd: alleRapporten.length,
    },
    betalingen: {
      geslaagd,
      mislukt,
      open: openBet,
      slagingsgraad: pct(geslaagd, geslaagd + mislukt),
    },
    gemiddelden: {
      gemiddeldeOrderwaardeExclBtw:
        alleFacturen.length > 0 ? euro(omzetExcl / alleFacturen.length) : 0,
      omzetPerBetalendeOrganisatie:
        betalendeOrgIds.size > 0 ? euro(nettoExcl / betalendeOrgIds.size) : 0,
    },
    gdpr: {
      afnamesMetPersoonsgegevens: metPg,
      geanonimiseerd: geanon,
      consentIngetrokken: ingetrokken,
      bewaartermijnVerstreken: verstreken,
    },
  };
}

export async function boekhoudExport(): Promise<BoekhoudExportRegel[]> {
  const euro = (cent: number) => Number((cent / 100).toFixed(2));
  const regels: BoekhoudExportRegel[] = [];
  const fs = db.select().from(facturen).orderBy(facturen.id).all();
  for (const f of fs) {
    const klant = JSON.parse(f.klantSnapshot);
    const eersteRegel = (JSON.parse(f.regels) as Array<any>)[0];
    regels.push({
      documenttype: "factuur",
      nummer: f.factuurnummer,
      datum: f.factuurdatum.slice(0, 10),
      klant: klant.naam ?? "",
      klantBtw: klant.btwNummer ?? null,
      bedragExclBtw: euro(f.bedragExclBtw),
      btwTarief: eersteRegel?.btwTarief ?? 21,
      btwBedrag: euro(f.btwBedrag),
      bedragInclBtw: euro(f.bedragInclBtw),
      munt: f.munt,
      kanaal: f.kanaal,
    });
  }
  const cns = db.select().from(creditnotas).orderBy(creditnotas.id).all();
  for (const c of cns) {
    const klant = JSON.parse(c.klantSnapshot);
    const eersteRegel = (JSON.parse(c.regels) as Array<any>)[0];
    regels.push({
      documenttype: "creditnota",
      nummer: c.creditnotanummer,
      datum: c.creditnotaDatum.slice(0, 10),
      klant: klant.naam ?? "",
      klantBtw: klant.btwNummer ?? null,
      bedragExclBtw: euro(c.bedragExclBtw),
      btwTarief: eersteRegel?.btwTarief ?? 21,
      btwBedrag: euro(c.btwBedrag),
      bedragInclBtw: euro(c.bedragInclBtw),
      munt: c.munt,
      kanaal: c.kanaal,
    });
  }
  return regels;
}
