import { describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const beheerders = new Map<number, any>([
  [1, { id: 1, actief: true, isPrior: false, organisatie: "Organisatie A", organisatieId: 1 }],
  [2, { id: 2, actief: true, isPrior: false, organisatie: "Losse beheerder", organisatieId: null }],
]);

vi.mock("../server/storage", () => ({
  storage: {
    getBeheerder: async (id: number) => beheerders.get(id),
  },
}));

vi.mock("../server/hdd/storage", () => ({
  hddStorage: {
    alleTrajecten: () => [],
    getTraject: () => undefined,
    maakTraject: () => ({ id: 1 }),
    setStatus: () => undefined,
    setGateResultaat: () => undefined,
    getGateResultaat: () => null,
    ledenVanTraject: () => [],
    voegLidToe: () => ({ id: 1 }),
  },
}));

vi.mock("../server/registry", () => ({
  getDescriptor: () => ({
    instrumentId: "hdd",
    name: "HDD",
    version: "1",
    description: "test",
    flowType: "journey",
    creditCost: 0,
    journey: [],
  }),
}));

const { registerHddRoutes } = await import("../server/hdd/routes");

type HddRoute = { methode: "GET" | "POST"; pad: string };

function maakApp(aanmelding: "geen" | "organisatie" | "zonderRecht") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (aanmelding === "organisatie") (req as any).session = { adminId: 1 };
    if (aanmelding === "zonderRecht") (req as any).session = { adminId: 2 };
    next();
  });
  registerHddRoutes(app);
  return app;
}

function geregistreerdeHddRoutes(app: express.Express): HddRoute[] {
  const router = (app as any).router;
  const routes = (router?.stack ?? [])
    .filter((laag: any) => laag.route?.path?.startsWith("/api/hdd/"))
    .flatMap((laag: any) =>
      Object.keys(laag.route.methods)
        .filter((methode) => laag.route.methods[methode])
        .map((methode) => ({ methode: methode.toUpperCase(), pad: laag.route.path })),
    );
  return routes as HddRoute[];
}

async function roep(route: HddRoute, aanmelding: "geen" | "organisatie" | "zonderRecht") {
  const server = createServer(maakApp(aanmelding));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const antwoord = await fetch(`http://127.0.0.1:${poort}${route.pad.replace(":id", "1")}`, {
      method: route.methode,
      headers: route.methode === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: route.methode === "POST" ? "{}" : undefined,
    });
    return antwoord.status;
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

describe("HDD-endpoint-poort", () => {
  it("weigert zonder aanmelding elk geregistreerd HDD-endpoint", async () => {
    const routes = geregistreerdeHddRoutes(maakApp("geen"));
    expect(routes).toHaveLength(11);
    for (const route of routes) {
      expect(await roep(route, "geen"), `${route.methode} ${route.pad}`).toBe(403);
    }
  });

  it("weigert een aangemelde beheerder zonder organisatie-scope", async () => {
    const routes = geregistreerdeHddRoutes(maakApp("zonderRecht"));
    expect(routes).toHaveLength(11);
    for (const route of routes) {
      expect(await roep(route, "zonderRecht"), `${route.methode} ${route.pad}`).toBe(403);
    }
  });
});
