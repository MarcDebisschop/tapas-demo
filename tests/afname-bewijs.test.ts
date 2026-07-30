// ---------------------------------------------------------------------------
// tests/afname-bewijs.test.ts
//
// Auditbevinding K-1 (kritiek), derde ronde. De invulroutes van een afname
// (/concept, /main, /connection) stonden open voor wie het oplopende id gokte.
// Sinds deze ronde vragen ze hetzelfde bezitsbewijs als het koppelpad.
//
// Deze tests dekken de poortwachter zelf (met een nagemaakt verzoek) en het
// contract: de poortwachter staat werkelijk op alle drie de routes, en de
// webclient stuurt het bewijs automatisch mee.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BEWIJS_KOP, bewijsUitVerzoek } from "../server/afname-bewijs";

const bron = (pad: string) => readFileSync(resolve(__dirname, "..", pad), "utf8");

function verzoek(over: Record<string, unknown> = {}) {
  return { headers: {}, body: {}, params: { id: "7" }, method: "POST", path: "/api/afnames/7/main", ...over } as any;
}

describe("het bewijs uit het verzoek halen", () => {
  it("leest de kop", () => {
    expect(bewijsUitVerzoek(verzoek({ headers: { [BEWIJS_KOP]: "  ABC123 " } }))).toBe("ABC123");
  });

  it("valt terug op de body wanneer er geen kop is", () => {
    expect(bewijsUitVerzoek(verzoek({ body: { respondentCode: "XYZ" } }))).toBe("XYZ");
  });

  it("geeft een lege tekst wanneer er niets meekomt", () => {
    expect(bewijsUitVerzoek(verzoek())).toBe("");
  });

  it("neemt de eerste waarde bij een dubbel meegestuurde kop", () => {
    expect(bewijsUitVerzoek(verzoek({ headers: { [BEWIJS_KOP]: ["EEN", "TWEE"] } }))).toBe("EEN");
  });
});

describe("de poortwachter", () => {
  async function loop(over: Record<string, unknown>, afname: unknown, admin: number | null) {
    vi.resetModules();
    vi.doMock("../server/storage", () => ({
      storage: { getAfname: async () => afname },
      CreditError: class extends Error {},
    }));
    vi.doMock("../server/admin-guard", () => ({
      adminIdVanSessie: () => admin,
      vereisAdmin: () => undefined,
    }));
    const { vereisAfnameBewijs } = await import("../server/afname-bewijs");
    let status = 0;
    let lichaam: unknown = null;
    let doorgelaten = false;
    const res = {
      status(c: number) {
        status = c;
        return this;
      },
      json(b: unknown) {
        lichaam = b;
        return this;
      },
    } as any;
    await vereisAfnameBewijs(verzoek(over), res, () => {
      doorgelaten = true;
    });
    return { status, lichaam, doorgelaten };
  }

  const afname = {
    respondentCode: "PB-2026-089", // leesbaar en dus raadbaar: geldt NIET als bewijs
    bezitsToken: "TOKEN-ONRAADBAAR-1",
    inviteToken: "TOKEN-ONRAADBAAR-2",
    deelnemerEmail: null,
  };

  it("laat door met het bezitsToken", async () => {
    const r = await loop({ headers: { [BEWIJS_KOP]: "TOKEN-ONRAADBAAR-1" } }, afname, null);
    expect(r.doorgelaten).toBe(true);
  });

  it("weigert de leesbare respondentCode, want die is raadbaar", async () => {
    const r = await loop({ headers: { [BEWIJS_KOP]: "PB-2026-089" } }, afname, null);
    expect(r.doorgelaten).toBe(false);
    expect(r.status).toBe(404);
  });

  it("laat door met het invite-token", async () => {
    const r = await loop({ body: { token: "TOKEN-ONRAADBAAR-2" } }, afname, null);
    expect(r.doorgelaten).toBe(true);
  });

  it("weigert zonder bewijs met 404, zonder te verklappen dat de afname bestaat", async () => {
    const r = await loop({}, afname, null);
    expect(r.doorgelaten).toBe(false);
    expect(r.status).toBe(404);
    expect(r.lichaam).toEqual({ error: "Afname niet gevonden" });
  });

  it("weigert een fout bewijs", async () => {
    const r = await loop({ headers: { [BEWIJS_KOP]: "TOKEN-ONRAADBAAR-" } }, afname, null);
    expect(r.doorgelaten).toBe(false);
    expect(r.status).toBe(404);
  });

  it("geeft hetzelfde antwoord voor een onbestaande afname", async () => {
    const r = await loop({ headers: { [BEWIJS_KOP]: "TOKEN-ONRAADBAAR-1" } }, undefined, null);
    expect(r.status).toBe(404);
    expect(r.lichaam).toEqual({ error: "Afname niet gevonden" });
  });

  it("laat een beheerderssessie altijd door", async () => {
    const r = await loop({}, afname, 1);
    expect(r.doorgelaten).toBe(true);
  });

  it("weigert een id dat geen getal is", async () => {
    const r = await loop({ params: { id: "abc" } }, afname, null);
    expect(r.status).toBe(404);
  });
});

describe("contract: de poortwachter staat op alle invulroutes", () => {
  const routes = bron("server/routes/afnames.ts");

  for (const route of ["concept", "main", "connection"]) {
    it(`/${route} staat achter het bezitsbewijs`, () => {
      expect(routes).toContain(`app.post("/api/afnames/:id/${route}", vereisAfnameBewijs,`);
    });
  }
});

describe("contract: de webclient stuurt het bewijs automatisch mee", () => {
  it("de gedeelde API-helper voegt de kop toe", () => {
    const helper = bron("client/src/lib/queryClient.ts");
    expect(helper).toContain("bewijsKop(url)");
  });

  it("elk startpunt bewaart het bewijs meteen", () => {
    for (const pad of [
      "client/src/pages/start.tsx",
      "client/src/pages/deelnemer.tsx",
      "client/src/pages/reis-t4kids-start.tsx",
    ]) {
      expect(bron(pad)).toContain("bewaarBewijs(afname.id");
    }
  });

  it("er is maar één plaats waar de sleutel van het bewijs gedefinieerd wordt", () => {
    const lib = bron("client/src/lib/afname-bewijs.ts");
    expect(lib).toContain("tapas-afnamebewijs-");
    expect(bron("client/src/pages/klaar.tsx")).not.toContain("`tapas-afnamebewijs-");
  });
});

describe("contract: het bezitsbewijs is een echt geheim", () => {
  it("wordt bij het aanmaken van elke afname willekeurig getrokken", () => {
    const opslag = bron("server/storage.ts");
    expect(opslag).toMatch(/bezitsToken: randomBytes\(24\)\.toString\("hex"\)/);
  });

  it("bestaande afnames krijgen bij de start een token, zodat de oude code nergens meer werkt", () => {
    const opslag = bron("server/storage.ts");
    expect(opslag).toContain("ALTER TABLE afnames ADD COLUMN bezits_token TEXT;");
    expect(opslag).toMatch(/UPDATE afnames SET bezits_token = \? WHERE id = \?/);
  });

  it("de leesbare respondentCode geldt niet meer als bewijs", () => {
    const bewijs = bron("server/koppel-bewijs.ts");
    expect(bewijs).toMatch(/const geldigeWaarden = \[afname\.bezitsToken, afname\.inviteToken\]/);
  });

  it("de publieke afnameroute geeft het token niet prijs", () => {
    const routes = bron("server/routes/afnames.ts");
    const publiek = routes.slice(routes.indexOf('app.get("/api/afnames/:id"'));
    const blok = publiek.slice(0, publiek.indexOf("});"));
    expect(blok).not.toContain("bezitsToken");
  });

  it("T4Sports geeft geen toegang meer via de leesbare code", () => {
    const sport = bron("server/t4sports/routes.ts");
    expect(sport).not.toContain("getAfnameByCode(token)");
    expect(sport).toContain("getAfnameByBezitsToken(token)");
  });

  it("de T4Sports-infoserve staat achter het bezitsbewijs", () => {
    const mod = bron("server/t4sports/module-routes.ts");
    expect(mod).toContain('app.get("/api/t4sports/afnames/:id/info", vereisAfnameBewijs,');
  });
});
