// ---------------------------------------------------------------------------
// tests/t4students-uitstuur-bulk.test.ts
//
// De uitstuurcontrole op de deur waar de meeste uitnodigingen tegelijk buiten
// gaan: de bulk-import met mailverzending.
//
// De vraag die deze toets beantwoordt: als de keten van het studiekompas niet
// sluit, blijft dan ook een bulkverzending staan? Er wordt gemeten op de echte
// route (POST /api/admin/bulk-import/verwerk), met een nagebootste opslag en een
// nagebootste mailer, zodat zichtbaar is dat er niets aangemaakt en niets
// verstuurd wordt.
//
// Drie metingen:
//   1. Gebroken keten, instrument t4students: status 503, code
//      T4S_NIET_UITSTUURBAAR, geen enkele aanmaak, geen enkele mail.
//   2. Zelfde gebroken keten, ander instrument: de poort laat door en de route
//      loopt gewoon verder. Geen enkel bestaand pad ondervindt hinder.
//   3. Gezonde keten, instrument t4students: de poort laat door.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const aanmaken: unknown[] = [];
const verstuurd: unknown[] = [];

vi.mock("../server/storage", () => {
  class CreditError extends Error {}
  const rij = {
    id: 1,
    inviteToken: "PROEF-TOKEN",
    name: "Proef",
    taal: "nl",
    instrumentId: null,
  };
  const bouwer = {
    values: (data: unknown) => {
      aanmaken.push(data);
      return { returning: () => ({ get: () => rij, all: () => [rij] }) };
    },
  };
  return {
    CreditError,
    CREDITPAKKETTEN: [],
    sqlite: { prepare: () => ({ all: () => [], get: () => undefined, run: () => undefined }) },
    db: {
      insert: () => bouwer,
      select: () => ({ from: () => ({ where: () => ({ all: () => [], get: () => undefined }) }) }),
    },
    storage: {
      async getOrganisatie() {
        return { id: 1, naam: "Proeforganisatie" };
      },
      async getSaldo() {
        return { beschikbaar: 100 };
      },
      async verbruik() {
        return null;
      },
    },
  };
});

vi.mock("../server/bulk-import/mailer", () => ({
  isSimulatiemodus: () => true,
  async verstuurUitnodiging(input: unknown) {
    verstuurd.push(input);
    return { status: "gesimuleerd", melding: "proef" };
  },
}));

vi.mock("../server/scope-guard", () => ({
  async vereisScope(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
  async vereisPrior(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
  scopeVanVerzoek: () => ({ soort: "prior" }),
  async bepaalScope() {
    return { soort: "prior" };
  },
  valtBinnenScope: () => true,
  schrijfOrganisatieId: () => ({ ok: true, organisatieId: null }),
  async verzenderVanVerzoek() {
    return { aangemaaktDoorBeheerderId: 1, aangemaaktDoorOrganisatieId: null };
  },
}));

vi.mock("../server/bekwaamheid/poortbrug", () => ({
  async beoordeelSchrijfweg() {
    return { mag: true };
  },
  weigeringslichaam: () => ({ error: "geweigerd" }),
}));

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const { registerBulkImportRoutes } = await import("../server/bulk-import/routes");
const { vergeetUitstuuroordeel, keurUitstuurT4Students } = await import(
  "../server/t4students/uitstuurcontrole"
);
const { registerVragenlijstT4StudentsRoutes } = await import(
  "../server/routes/vragenlijst-t4students"
);

async function metServer(app: express.Express, fn: (basis: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

/** Een app waarop de keten van het studiekompas gebroken is: geen wegen. */
function appMetGebrokenKeten() {
  const a = express();
  a.use(express.json({ limit: "2mb" }));
  registerBulkImportRoutes(a);
  return a;
}

/** Een app waarop de keten sluit. */
function appMetGezondeKeten() {
  const a = express();
  a.use(express.json({ limit: "2mb" }));
  registerVragenlijstT4StudentsRoutes(a);
  a.post("/api/afnames/:id/connection", (_req, res) => res.json({ ok: true }));
  registerBulkImportRoutes(a);
  return a;
}

beforeEach(() => {
  aanmaken.length = 0;
  verstuurd.length = 0;
  vergeetUitstuuroordeel();
});

describe("uitstuurcontrole op de bulk-import", () => {
  it(
    "houdt een bulkverzending van het studiekompas tegen zolang de keten niet sluit",
    async () => {
      await metServer(appMetGebrokenKeten(), async (basis) => {
        const r = await fetch(`${basis}/api/admin/bulk-import/verwerk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instrumentId: "t4students",
            organisatieId: null,
            rijen: [{ rij: 2, waarden: { naam: "Proef Kandidaat", email: "proef@example.org" } }],
          }),
        });
        expect(r.status).toBe(503);
        const lichaam = (await r.json()) as Record<string, unknown>;
        expect(lichaam.code).toBe("T4S_NIET_UITSTUURBAAR");
        expect(Array.isArray(lichaam.redenen)).toBe(true);
        expect((lichaam.redenen as string[]).length).toBeGreaterThan(0);
        // Niets aangemaakt, niets verstuurd.
        expect(aanmaken.length).toBe(0);
        expect(verstuurd.length).toBe(0);
      });
    },
    120000,
  );

  it(
    "laat een ander instrument op dezelfde route ongemoeid door de poort",
    async () => {
      await metServer(appMetGebrokenKeten(), async (basis) => {
        const r = await fetch(`${basis}/api/admin/bulk-import/verwerk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instrumentId: "t4p-business",
            organisatieId: null,
            rijen: [],
          }),
        });
        // Welk antwoord de route daarna ook geeft, het mag niet de weigering van
        // de uitstuurcontrole zijn: die poort geldt enkel voor het studiekompas.
        const lichaam = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        expect(lichaam.code).not.toBe("T4S_NIET_UITSTUURBAAR");
      });
    },
    120000,
  );

  it(
    "laat een bulkverzending van het studiekompas door zodra de keten sluit",
    async () => {
      // Eerst de keten laten keuren op een app waar ze sluit. De uitslag wordt
      // bewaard, precies zoals op een levende server.
      const gezond = appMetGezondeKeten();
      const oordeel = await keurUitstuurT4Students({
        app: gezond,
        wortel: "/dev/null-bestaat-niet",
        negeerBewaard: true,
      });
      expect(oordeel.ok).toBe(true);

      await metServer(gezond, async (basis) => {
        const r = await fetch(`${basis}/api/admin/bulk-import/verwerk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instrumentId: "t4students",
            organisatieId: null,
            rijen: [],
          }),
        });
        const lichaam = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        expect(lichaam.code).not.toBe("T4S_NIET_UITSTUURBAAR");
        expect(r.status).not.toBe(503);
      });
    },
    120000,
  );
});
