// ---------------------------------------------------------------------------
// tests/gdpr-toegangscontrole.test.ts - AVG art. 32: toegangscontrole
//
// Twee bewijzen:
//   1. De middleware zelf weigert een verzoek zonder admin-sessie met 401 en
//      laat een verzoek met sessie door.
//   2. Elke /api/gdpr/-route in server/routes/afnames.ts is geregistreerd met
//      de guard. Dit vangt de fout die deze fix aanleiding gaf: een nieuwe
//      GDPR-route die per ongeluk zonder guard wordt toegevoegd.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { vereisAdmin, adminIdVanSessie } from "../server/admin-guard";

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

describe("GDPR-toegangscontrole", () => {
  it("weigert zonder admin-sessie met 401 en laat een sessie door", async () => {
    const app = express();
    // Simuleer de sessie: ?admin=1 zet een adminId, net zoals express-session dat
    // na inloggen doet. Zo blijft de test onafhankelijk van de sessie-store.
    app.use((req, _res, next) => {
      if (req.query.admin === "1") (req as any).session = { adminId: 7 };
      next();
    });
    app.get("/api/gdpr/test", vereisAdmin, (_req, res) => res.json({ ok: true }));

    await metServer(app, async (basis) => {
      const zonder = await fetch(`${basis}/api/gdpr/test`);
      expect(zonder.status).toBe(401);
      expect((await zonder.json()).error).toBe("Niet ingelogd.");

      const met = await fetch(`${basis}/api/gdpr/test?admin=1`);
      expect(met.status).toBe(200);
      expect((await met.json()).ok).toBe(true);
    });
  });

  it("leest het adminId enkel uit een geldige sessie", () => {
    expect(adminIdVanSessie({} as any)).toBeNull();
    expect(adminIdVanSessie({ session: {} } as any)).toBeNull();
    expect(adminIdVanSessie({ session: { adminId: 0 } } as any)).toBeNull();
    expect(adminIdVanSessie({ session: { adminId: "12" } } as any)).toBe(12);
  });

  it("registreert elke /api/gdpr-route met de admin-guard", () => {
    const bron = readFileSync("server/routes/afnames.ts", "utf8");
    const registraties = [...bron.matchAll(/app\.(get|post|put|patch|delete)\(\s*"(\/api\/gdpr\/[^"]*)"\s*,\s*([^\n]*)/g)];
    expect(registraties.length).toBeGreaterThanOrEqual(5);
    for (const [, , pad, rest] of registraties) {
      expect(rest, `route ${pad} mist een guard`).toMatch(/vereisAdmin|vereisScope/);
    }
  });
});
