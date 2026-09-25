// ---------------------------------------------------------------------------
// tests/role-fit-fixture.ts
//
// Gedeelde opbouw voor de Role Fit-tests. Geen testbestand op zich (geen
// .test.ts): wordt geimporteerd NADAT het testbestand TAPAS_DB_PATH gezet
// heeft, zodat elk testbestand een eigen databank heeft.
// ---------------------------------------------------------------------------
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type ProfielWaarden = Record<string, { net: number | null; avg: number | null }>;

/** Profiel zoals het T4P Business Kompas het in contract.sections.main.constructRows schrijft. */
export function maakContract(w: ProfielWaarden): string {
  return JSON.stringify({
    contractVersion: "t4p-contract-test",
    generatedAt: "2026-09-01T10:00:00.000Z",
    sections: {
      main: {
        constructRows: Object.entries(w).map(([construct, v]) => ({
          construct,
          family: "test",
          net: v.net,
          avgEnergy: v.avg,
        })),
      },
    },
  });
}

export const ALLE_CONSTRUCTEN = [
  "Be Strong",
  "Be Perfect",
  "Hurry Up",
  "Try Hard",
  "Please Others",
  "Inter-relationeel",
  "Operationeel",
  "Strategie",
  "Innovatie",
  "TaPas-Beeld",
  "Analyse",
  "Coaching",
  "Constructief onderscheidend",
  "Faciliteren",
  "Impact",
  "Resultaatgericht",
];

export function volledigProfiel(over: ProfielWaarden = {}): ProfielWaarden {
  const w: ProfielWaarden = {};
  for (const c of ALLE_CONSTRUCTEN) w[c] = { net: 1, avg: 0 };
  return { ...w, ...over };
}

export async function opzet() {
  const { storage, sqlite } = await import("../server/storage");
  const { registerRoleFitRoutes } = await import("../server/role-fit/routes");
  const { wisGrenzenVoorTest } = await import("../server/role-fit/routes");

  let teller = 0;
  async function organisatie(naam: string): Promise<number> {
    const o: any = await storage.createOrganisatie({ naam } as any);
    return o.id;
  }
  async function beheerder(naam: string, organisatieId: number | null, isPrior = false): Promise<number> {
    teller++;
    const b: any = await storage.maakBeheerder({
      naam,
      email: `rf-${teller}-${Date.now()}@voorbeeld.test`,
      organisatie: isPrior ? "TaPasCity" : `org-${organisatieId}`,
      isPrior,
    } as any);
    if (organisatieId !== null) sqlite.prepare("UPDATE beheerders SET organisatie_id = ? WHERE id = ?").run(organisatieId, b.id);
    return b.id;
  }
  async function afname(organisatieId: number | null, w: ProfielWaarden, naam = "Kandidaat Test"): Promise<number> {
    teller++;
    const a: any = await storage.createAfname({
      organisatieId,
      respondentCode: `RF-${teller}-${Date.now()}`,
      name: naam,
      company: null,
      role: null,
    } as any);
    await storage.updateAfname(a.id, {
      instrumentId: "t4p-business-kompas",
      status: "voltooid",
      generatorContract: maakContract(w),
    } as any);
    return a.id;
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  // Sessie nagebootst: de header x-test-admin zet het beheerders-id.
  app.use((req, _res, next) => {
    const id = req.header("x-test-admin");
    (req as any).session = id ? { adminId: Number(id) } : {};
    next();
  });
  registerRoleFitRoutes(app);
  const server: Server = createServer(app);
  await new Promise<void>((k) => server.listen(0, k));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function api(admin: number | null, methode: string, pad: string, body?: unknown) {
    const r = await fetch(`${basis}/api/role-fit${pad}`, {
      method: methode,
      headers: { "content-type": "application/json", ...(admin ? { "x-test-admin": String(admin) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const tekst = await r.text();
    let json: any = tekst;
    try {
      json = JSON.parse(tekst);
    } catch {
      /* html of pdf */
    }
    return { status: r.status, json, headers: r.headers };
  }

  return {
    storage,
    sqlite,
    organisatie,
    beheerder,
    afname,
    api,
    wisGrenzen: wisGrenzenVoorTest,
    sluit: () => new Promise<void>((k) => server.close(() => k())),
  };
}

export function caseInvoer(afnameId: number, signer: number, extra: Record<string, unknown> = {}) {
  return {
    afnameId,
    functieTitel: "Plant Manager",
    beslisdoel: "selectie",
    senioriteit: "senior",
    beslisdatum: "2026-11-01",
    taal: "nl",
    recruiterNaam: "Rita Recruiter",
    recruiterEmail: "rita@voorbeeld.test",
    hmNaam: "Hugo Manager",
    hmEmail: "hugo@voorbeeld.test",
    signerAdminId: signer,
    rechtsgrond: "precontractuele_maatregelen",
    kandidaatGeinformeerd: true,
    bewaarTot: "2027-06-30",
    ...extra,
  };
}

export const ORILY_BRON = [
  "Orily is een producent van voedingsingredienten met een fabriek van 180 medewerkers in drie ploegen.",
  "De plant manager rapporteert aan de operationeel directeur en stuurt vijf teamleiders aan.",
  "De sector is streng gereguleerd: voedselveiligheid en audits volgens BRCGS zijn dagelijkse realiteit.",
  "Binnen de eerste 90 dagen verwachten we een stabiele OEE en een duidelijk overlegritme met de ploegen.",
  "De organisatie zit midden in een verandertraject naar lean werken en er is spanning tussen productie en kwaliteit.",
  "Beslissingen worden in consensus genomen met het managementteam, maar bij incidenten moet de plant manager snel zelf beslissen.",
  "Een diploma ingenieur of gelijkwaardige ervaring is vereist, net als een geldig VCA-VOL-attest.",
].join(" ");

export function observatieRegels(oefeningIds: number[], score: 1 | 3 | 5, kwaliteit: "direct" | "indirect" | "limited" = "direct") {
  return oefeningIds.map((id) => ({
    exerciseId: id,
    contextTrigger: "Bij de vraag hoe een stilstand in ploeg twee werd aangepakt.",
    gedrag: "Beschreef stap voor stap wie gebeld werd en welke meting eerst gebeurde.",
    quoteActie: "Ik heb eerst de ploegleider gebeld en daarna de logdata opgevraagd.",
    effect: "De stilstand werd binnen de ploeg opgelost volgens het verhaal.",
    barsScore: score,
    onvoldoendeKans: false,
    bewijskwaliteit: kwaliteit,
    alternatieveVerklaring: "Mogelijk een ingestudeerd voorbeeld.",
    confidence: "medium",
  }));
}
