// ---------------------------------------------------------------------------
// tests/fase9-branding.test.ts - Fase 9: een organisatie personaliseert haar
// eigen scherm, en het Earhart-vliegtuigje blijft van TaPasCity.
//
// Wat de tests bewijzen:
//   1. DE HARDE REGEL: bij organisatie-scope verschijnt het Earhart-watermerk
//      niet. Getest op het niveau waar de beslissing valt: de pure functie
//      `brandingBesluit` in shared/branding.ts. Plus een broncontrole dat de
//      CSS het watermerk daadwerkelijk uitschakelt en dat geen enkel scherm het
//      vliegtuigje als organisatielogo kan tonen.
//   2. Organisatie A wijzigt enkel haar EIGEN branding. Een `organisatieId` in
//      de body van A wordt genegeerd; de prior mag er wel een meegeven.
//   3. `GET /api/organisatie/me` levert de branding van de eigen scope.
//   4. De invoerpoort laat `javascript:` en `data:` niet door.
//   5. De migratie is additief en idempotent.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";
import {
  brandingBesluit,
  headerTitel,
  schoonBranding,
  veiligeAfbeeldingsUrl,
  veiligeKleur,
  veiligeQuote,
  ORGANISATIE_BRANDING_KLASSE,
  QUOTE_MAX,
} from "@shared/branding";
import { MERKTEKEN_KLASSE } from "../client/src/lib/document-klassen";

vi.mock("../server/storage", async () => {
  const { default: Db } = await import("better-sqlite3");
  const sq = new Db(":memory:");
  const beheerders = new Map<number, any>();
  return {
    CreditError: class CreditError extends Error {},
    CREDITPAKKETTEN: [],
    sqlite: sq,
    db: {},
    storage: {
      __beheerders: beheerders,
      getBeheerder: async (id: number) => beheerders.get(id),
      getOrganisatie: async (id: number) => ({ id, naam: `Org ${id}` }),
    },
  };
});

vi.mock("../server/audit-log", () => ({
  schrijfAuditLog: vi.fn(),
  zorgVoorAuditTabel: vi.fn(),
}));

const opslag = (await import("../server/storage")) as unknown as {
  sqlite: any;
  storage: { __beheerders: Map<number, any> };
};
const beheerders = opslag.storage.__beheerders;
const { registerOrganisatieAuthRoutes } = await import("../server/routes/organisatie-auth");

const PRIOR = 1;
const BEHEERDER_A = 2;

function app(als: string) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    const sessie: any = { save: (cb: (e?: unknown) => void) => cb() };
    if (als === "prior") sessie.adminId = PRIOR;
    if (als === "a") sessie.adminId = BEHEERDER_A;
    if (als === "org1") sessie.organisatieId = 1;
    if (als === "org2") sessie.organisatieId = 2;
    (req as any).session = sessie;
    next();
  });
  registerOrganisatieAuthRoutes(a);
  return a;
}

async function roep(als: string, methode: string, pad: string, lichaam?: unknown) {
  const server = createServer(app(als));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${poort}${pad}`, {
      method: methode,
      ...(lichaam === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(lichaam) }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

function brandingVan(id: number) {
  return opslag.sqlite
    .prepare(
      `SELECT branding_logo_url AS logo, branding_achtergrond_url AS achtergrond,
              branding_achtergrond_kleur AS kleur, branding_quote AS quote
         FROM organisaties WHERE id = ?`,
    )
    .get(id);
}

beforeEach(() => {
  beheerders.clear();
  beheerders.set(PRIOR, {
    id: PRIOR, naam: "Prior", email: "p@x.be", organisatie: PRIOR_ORGANISATIE,
    isPrior: true, actief: true, organisatieId: null,
  });
  beheerders.set(BEHEERDER_A, {
    id: BEHEERDER_A, naam: "A", email: "a@x.be", organisatie: "Org A",
    isPrior: false, actief: true, organisatieId: 1,
  });

  opslag.sqlite.exec(`
    DROP TABLE IF EXISTS organisaties;
    CREATE TABLE organisaties (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL,
      login_email TEXT,
      wachtwoord_hash TEXT,
      login_actief INTEGER NOT NULL DEFAULT 0,
      branding_logo_url TEXT,
      branding_achtergrond_url TEXT,
      branding_achtergrond_kleur TEXT,
      branding_quote TEXT
    );
  `);
  const ins = opslag.sqlite.prepare(
    `INSERT INTO organisaties (id, naam, login_actief, branding_quote) VALUES (?, ?, 1, ?)`,
  );
  ins.run(1, "Org A", "Samen verder");
  ins.run(2, "Org B", "Quote van B");
});

// ── 1. DE HARDE REGEL: het Earhart-vliegtuigje ─────────────────────────────

describe("het Earhart-watermerk is en blijft van TaPasCity", () => {
  it("verschijnt NOOIT bij organisatie-scope", () => {
    const besluit = brandingBesluit("organisatie", "2BQ CONSULT", {
      logoUrl: null, achtergrondUrl: null, achtergrondKleur: null, quote: null,
    });
    expect(besluit.toonEarhart).toBe(false);
  });

  it("verdwijnt ook wanneer de organisatie zelf niets instelde", () => {
    // Het kritieke geval: geen eigen achtergrond mag NOOIT betekenen dat het
    // watermerk maar blijft staan. Dan liever de effen basisachtergrond.
    const besluit = brandingBesluit("organisatie", "Org A", null);
    expect(besluit.toonEarhart).toBe(false);
    expect(besluit.klasse).toBe(ORGANISATIE_BRANDING_KLASSE);
    expect(besluit.achtergrondAfbeelding).toBeNull();
    expect(besluit.achtergrondKleur).toBeNull();
  });

  it("blijft toegestaan voor de prior en buiten elke organisatie", () => {
    for (const scope of ["prior", "geen"] as const) {
      const besluit = brandingBesluit(scope, null, null);
      expect(besluit.toonEarhart, scope).toBe(true);
      expect(besluit.klasse, scope).toBeNull();
    }
  });

  it("wordt door de CSS daadwerkelijk uitgeschakeld onder de branding-class", () => {
    const css = readFileSync("client/src/index.css", "utf8");
    expect(css).toContain(`.${ORGANISATIE_BRANDING_KLASSE} body::after { display: none !important }`);

    const watermerkRegel = `.${MERKTEKEN_KLASSE} body::after`;
    const plaatsWatermerk = css.indexOf(watermerkRegel);
    const plaatsSuppressor = css.indexOf(`.${ORGANISATIE_BRANDING_KLASSE} body::after`);

    // Eerst vaststellen dat beide regels er echt staan. Zonder deze controle zou
    // een ontbrekende watermerkregel de plaatsvergelijking hieronder laten
    // slagen: een regel die niet gevonden wordt levert de waarde min een op, en
    // dan is elke andere plaats daar groter dan.
    expect(plaatsWatermerk, `${watermerkRegel} ontbreekt in de opmaak`).toBeGreaterThan(-1);
    expect(plaatsSuppressor).toBeGreaterThan(-1);

    // De suppressor moet NA de watermerkregel staan, anders wint de eerste.
    expect(plaatsSuppressor).toBeGreaterThan(plaatsWatermerk);
  });

  it("wordt nergens als organisatielogo of org-achtergrond gebruikt", () => {
    for (const pad of [
      "client/src/components/Brand.tsx",
      "client/src/pages/organisatie-dashboard.tsx",
      "client/src/lib/organisatie-branding.tsx",
      "shared/branding.ts",
    ]) {
      expect(readFileSync(pad, "utf8"), pad).not.toContain("earhart-vega-watermark");
    }
  });

  it("brengt de class aan op documentElement en niet ergens in een component", () => {
    // De beslissing hoort in de pure functie te vallen; het scherm brengt haar
    // enkel aan. Zou een component de class zelf zetten, dan viel de regel
    // buiten de test.
    const bron = readFileSync("client/src/lib/organisatie-branding.tsx", "utf8");
    expect(bron).toContain("brandingBesluit(");
    expect(bron).toContain("document.documentElement");
  });
});

// ── 2. De header ───────────────────────────────────────────────────────────

describe("de header toont de organisatienaam naast de productnaam", () => {
  it("plakt de naam achter de productnaam", () => {
    expect(headerTitel("TaPas platform", "2BQ CONSULT")).toBe("TaPas platform - 2BQ CONSULT");
  });

  it("laat de header ongemoeid zonder organisatie", () => {
    expect(headerTitel("TaPas", null)).toBe("TaPas");
  });

  it("gebruikt Brand.tsx die helper en verzint zelf niets", () => {
    const bron = readFileSync("client/src/components/Brand.tsx", "utf8");
    expect(bron).toContain("headerTitel(PRODUCT_NAAM");
    expect(bron).toContain("useOrganisatieMij()");
  });
});

// ── 3. De invoerpoort ──────────────────────────────────────────────────────

describe("schoonBranding laat enkel ongevaarlijke waarden door", () => {
  it("weigert javascript: en data: in een afbeeldingsadres", () => {
    // Een logo komt in een `src`. Zonder deze poort was dat een manier om
    // script uit te voeren bij iedereen die het portaal opent.
    expect(veiligeAfbeeldingsUrl("javascript:alert(1)")).toBeNull();
    expect(veiligeAfbeeldingsUrl("data:text/html;base64,AAAA")).toBeNull();
    expect(veiligeAfbeeldingsUrl("  ")).toBeNull();
  });

  it("laat https en een pad binnen de site wel door", () => {
    expect(veiligeAfbeeldingsUrl("https://x.be/logo.png")).toBe("https://x.be/logo.png");
    expect(veiligeAfbeeldingsUrl("/img/logo.png")).toBe("/img/logo.png");
    // Een protocolloos adres wijst naar een andere host en is dus geen pad.
    expect(veiligeAfbeeldingsUrl("//kwaad.be/x.png")).toBeNull();
  });

  it("aanvaardt enkel een hexkleur", () => {
    expect(veiligeKleur("#abc")).toBe("#abc");
    expect(veiligeKleur("#A1B2C3")).toBe("#A1B2C3");
    expect(veiligeKleur("red")).toBeNull();
    expect(veiligeKleur("#12345")).toBeNull();
    expect(veiligeKleur("url(javascript:alert(1))")).toBeNull();
  });

  it("strookt scherpe haken uit de quote en kort hem af", () => {
    expect(veiligeQuote("<script>kwaad</script>")).toBe("scriptkwaad/script");
    expect(veiligeQuote("x".repeat(QUOTE_MAX + 50))?.length).toBe(QUOTE_MAX);
    expect(veiligeQuote("   ")).toBeNull();
  });

  it("maakt een veld leeg in plaats van de oude waarde te bewaren", () => {
    // "Ik heb het weggehaald" moet ook echt weghalen.
    const schoon = schoonBranding({ logoUrl: "", quote: "" });
    expect(schoon.logoUrl).toBeNull();
    expect(schoon.quote).toBeNull();
  });
});

// ── 4. PATCH /api/organisatie/branding ─────────────────────────────────────

describe("PATCH /api/organisatie/branding", () => {
  it("laat organisatie A haar eigen branding aanpassen", async () => {
    const res = await roep("org1", "PATCH", "/api/organisatie/branding", {
      logoUrl: "/img/a.png",
      achtergrondKleur: "#112233",
      quote: "Onze zin",
    });
    expect(res.status).toBe(200);
    const rij = brandingVan(1);
    expect(rij.logo).toBe("/img/a.png");
    expect(rij.kleur).toBe("#112233");
    expect(rij.quote).toBe("Onze zin");
  });

  it("negeert een organisatieId in de body van A", async () => {
    // DE KERN: kon A dit zetten, dan kon ze het portaal van B herschilderen.
    const res = await roep("org1", "PATCH", "/api/organisatie/branding", {
      organisatieId: 2,
      quote: "Overgenomen door A",
    });
    expect(res.status).toBe(200);
    expect(res.body.organisatieId).toBe(1);
    expect(brandingVan(1).quote).toBe("Overgenomen door A");
    // B is ongemoeid gebleven.
    expect(brandingVan(2).quote).toBe("Quote van B");
  });

  it("werkt ook via een beheerder die aan een organisatie hangt", async () => {
    const res = await roep("a", "PATCH", "/api/organisatie/branding", {
      organisatieId: 2,
      quote: "Via beheerder",
    });
    expect(res.status).toBe(200);
    expect(res.body.organisatieId).toBe(1);
    expect(brandingVan(2).quote).toBe("Quote van B");
  });

  it("laat de prior wel namens een organisatie wijzigen", async () => {
    const res = await roep("prior", "PATCH", "/api/organisatie/branding", {
      organisatieId: 2,
      quote: "Door de prior",
    });
    expect(res.status).toBe(200);
    expect(brandingVan(2).quote).toBe("Door de prior");
  });

  it("vraagt de prior WELKE organisatie hij aanpast", async () => {
    // Zonder organisatie is er geen redelijke gok; raden zou de verkeerde klant
    // herschilderen.
    const res = await roep("prior", "PATCH", "/api/organisatie/branding", { quote: "x" });
    expect(res.status).toBe(400);
  });

  it("weigert zonder scope", async () => {
    const res = await roep("niets", "PATCH", "/api/organisatie/branding", { quote: "x" });
    expect(res.status).toBe(403);
  });

  it("slaat een javascript:-logo niet op", async () => {
    const res = await roep("org1", "PATCH", "/api/organisatie/branding", {
      logoUrl: "javascript:alert(1)",
    });
    expect(res.status).toBe(200);
    expect(brandingVan(1).logo).toBeNull();
  });
});

// ── 5. GET /api/organisatie/me ─────────────────────────────────────────────

describe("GET /api/organisatie/me levert de branding", () => {
  it("geeft de velden van de eigen organisatie", async () => {
    const res = await roep("org1", "GET", "/api/organisatie/me");
    expect(res.status).toBe(200);
    expect(res.body.naam).toBe("Org A");
    expect(res.body.branding.quote).toBe("Samen verder");
    expect(res.body.branding.logoUrl).toBeNull();
  });

  it("geeft niets zonder organisatiesessie", async () => {
    expect((await roep("niets", "GET", "/api/organisatie/me")).status).toBe(401);
  });
});

// ── 6. De migratie ─────────────────────────────────────────────────────────

describe("de branding-migratie is additief en idempotent", () => {
  it("voegt de vier kolommen toe zonder bestaande rijen aan te raken", () => {
    const sq = new Database(":memory:");
    sq.exec(`CREATE TABLE organisaties (id INTEGER PRIMARY KEY, naam TEXT NOT NULL);`);
    sq.prepare(`INSERT INTO organisaties (id, naam) VALUES (1, 'Bestaand')`).run();

    const migreer = () => {
      const cols = sq.prepare(`PRAGMA table_info(organisaties)`).all() as Array<{ name: string }>;
      const heeft = (n: string) => cols.some((c) => c.name === n);
      const add = (sql: string) => { try { sq.exec(sql); } catch { /* bestaat al */ } };
      for (const k of [
        "branding_logo_url",
        "branding_achtergrond_url",
        "branding_achtergrond_kleur",
        "branding_quote",
      ]) {
        if (!heeft(k)) add(`ALTER TABLE organisaties ADD COLUMN ${k} TEXT;`);
      }
    };
    migreer();
    migreer();

    const rij = sq.prepare(`SELECT * FROM organisaties WHERE id = 1`).get() as any;
    expect(rij.naam).toBe("Bestaand");
    expect(rij.branding_logo_url).toBeNull();
    expect(rij.branding_quote).toBeNull();
    sq.close();
  });

  it("staat in storage.ts achter een bestaanscontrole en raakt niets aan", () => {
    const bron = readFileSync("server/storage.ts", "utf8");
    for (const k of [
      "branding_logo_url",
      "branding_achtergrond_url",
      "branding_achtergrond_kleur",
      "branding_quote",
    ]) {
      expect(bron, k).toContain(
        `if (!heeft("${k}")) add(\`ALTER TABLE organisaties ADD COLUMN ${k} TEXT;\`);`,
      );
    }
    expect(bron).not.toMatch(/ALTER TABLE organisaties DROP/);
    // Het vrije-tekstveld `beheerders.organisatie` blijft bestaan.
    expect(bron).not.toMatch(/ALTER TABLE beheerders DROP COLUMN organisatie/);
  });
});
