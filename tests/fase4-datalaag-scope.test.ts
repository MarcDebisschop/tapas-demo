// ---------------------------------------------------------------------------
// tests/fase4-datalaag-scope.test.ts - Fase 4 van de organisatie-scoping: het
// filter zit in de DATALAAG, niet in een `.filter()` achteraf.
//
// Wat de tests bewijzen:
//   1. `organisatieFilterVanScope` vertaalt de drie scopes correct, en scope
//      "geen" WERPT in plaats van een lege lijst op te leveren. Een lege lijst
//      is niet van een geslaagde query te onderscheiden en zou het gat
//      verbergen.
//   2. `listAfnames(scope)` geeft een organisatie enkel haar eigen afnames:
//      geen rijen van een andere organisatie en geen particuliere rijen
//      (organisatie_id IS NULL).
//   3. De prior krijgt alles, inclusief de particuliere rijen.
//   4. De scope is een VERPLICHTE parameter; er is geen oproep zonder.
//   5. Hetzelfde geldt voor de aggregatiekant via `leesAfnameRijenVoorScope`.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import {
  organisatieFilterVanScope,
  ScopeFout,
  SCOPE_PRIOR,
  SCOPE_GEEN,
  type Scope,
} from "../server/scope";
import { leesAfnameRijenVoorScope } from "../server/opvolging-per-instrument";

const ORG_A: Scope = { soort: "organisatie", organisatieId: 1 };
const ORG_B: Scope = { soort: "organisatie", organisatieId: 2 };

// ── 1. De vertaling van scope naar SQL-filter ──────────────────────────────

describe("organisatieFilterVanScope", () => {
  it("geeft null voor de prior: geen beperking", () => {
    expect(organisatieFilterVanScope(SCOPE_PRIOR, "test")).toBeNull();
  });

  it("geeft het id voor een organisatie", () => {
    expect(organisatieFilterVanScope(ORG_A, "test")).toBe(1);
  });

  it("werpt bij scope geen in plaats van stil niets terug te geven", () => {
    // Luid falen: scope "geen" hoort al met 403 afgewezen te zijn, dus als de
    // datalaag hem toch ziet is er een guard vergeten.
    expect(() => organisatieFilterVanScope(SCOPE_GEEN, "listAfnames")).toThrow(ScopeFout);
    expect(() => organisatieFilterVanScope(SCOPE_GEEN, "listAfnames")).toThrow(/listAfnames/);
  });
});

// ── 2. Isolatie op echte SQL ───────────────────────────────────────────────

describe("scope-isolatie op afnames", () => {
  function db() {
    const d = new Database(":memory:");
    d.exec(`
      CREATE TABLE afnames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organisatie_id INTEGER,
        instrument_id TEXT,
        status TEXT
      );
    `);
    const ins = d.prepare(
      `INSERT INTO afnames (organisatie_id, instrument_id, status) VALUES (?, ?, ?)`,
    );
    ins.run(1, "tfi", "voltooid");
    ins.run(1, "tfi", "deel1");
    ins.run(2, "t4kids", "voltooid");
    ins.run(3, "t4teens", "voltooid");
    ins.run(null, "tfi", "voltooid"); // particulier, hoort bij geen organisatie
    return d;
  }

  // Zelfde SQL-vorm als de repository: `organisatie_id = ?`, of geen where
  // voor de prior.
  function haal(d: InstanceType<typeof Database>, scope: Scope) {
    const filter = organisatieFilterVanScope(scope, "test");
    return filter === null
      ? (d.prepare(`SELECT id, organisatie_id FROM afnames ORDER BY id`).all() as any[])
      : (d
          .prepare(`SELECT id, organisatie_id FROM afnames WHERE organisatie_id = ? ORDER BY id`)
          .all(filter) as any[]);
  }

  it("geeft organisatie A enkel haar eigen afnames", () => {
    const rijen = haal(db(), ORG_A);
    expect(rijen.map((r) => r.id)).toEqual([1, 2]);
    expect(rijen.every((r) => r.organisatie_id === 1)).toBe(true);
  });

  it("lekt geen rijen van organisatie B of C naar A", () => {
    const rijen = haal(db(), ORG_A);
    expect(rijen.some((r) => r.organisatie_id === 2)).toBe(false);
    expect(rijen.some((r) => r.organisatie_id === 3)).toBe(false);
  });

  it("lekt geen particuliere afnames naar een organisatie", () => {
    // Door de SQL-NULL-semantiek valt `organisatie_id IS NULL` vanzelf buiten
    // `organisatie_id = 1`. Deze test verankert dat gedrag.
    const rijen = haal(db(), ORG_A);
    expect(rijen.some((r) => r.organisatie_id === null)).toBe(false);
  });

  it("geeft organisatie B enkel haar eigen afname", () => {
    expect(haal(db(), ORG_B).map((r) => r.id)).toEqual([3]);
  });

  it("geeft de prior alles, inclusief de particuliere afname", () => {
    const rijen = haal(db(), SCOPE_PRIOR);
    expect(rijen.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(rijen.some((r) => r.organisatie_id === null)).toBe(true);
  });

  it("doet geen enkele query bij scope geen", () => {
    expect(() => haal(db(), SCOPE_GEEN)).toThrow(ScopeFout);
  });

  it("geeft een organisatie zonder afnames een lege lijst en geen terugval", () => {
    expect(haal(db(), { soort: "organisatie", organisatieId: 99 })).toEqual([]);
  });
});

// ── 3. De aggregatiekant ───────────────────────────────────────────────────

describe("leesAfnameRijenVoorScope", () => {
  function db() {
    const d = new Database(":memory:");
    d.exec(`CREATE TABLE afnames (organisatie_id INTEGER, instrument_id TEXT, status TEXT);`);
    const ins = d.prepare(
      `INSERT INTO afnames (organisatie_id, instrument_id, status) VALUES (?, ?, ?)`,
    );
    ins.run(1, "tfi", "voltooid");
    ins.run(2, "t4kids", "voltooid");
    ins.run(null, "tfi", "voltooid");
    return d;
  }

  it("aggregeert voor een organisatie enkel over haar eigen rijen", () => {
    const rijen = leesAfnameRijenVoorScope(db() as any, ORG_A);
    expect(rijen).toEqual([{ instrumentId: "tfi", status: "voltooid" }]);
  });

  it("aggregeert voor de prior over alle rijen", () => {
    expect(leesAfnameRijenVoorScope(db() as any, SCOPE_PRIOR)).toHaveLength(3);
  });

  it("werpt bij scope geen", () => {
    expect(() => leesAfnameRijenVoorScope(db() as any, SCOPE_GEEN)).toThrow(ScopeFout);
  });
});

// ── 4. De scope is verplicht, niet optioneel ───────────────────────────────

describe("listAfnames dwingt een scope af", () => {
  it("heeft een verplichte scope-parameter in de interface en de implementatie", () => {
    const storageBron = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
    // Geen `scope?:` en geen oproep zonder argument: dat zou de scope
    // optioneel maken en dus omzeilbaar.
    expect(storageBron).toContain("listAfnames(scope: Scope): Promise<Afname[]>;");
    expect(storageBron).not.toContain("listAfnames(scope?:");
    expect(storageBron).not.toContain("async listAfnames(): ");
  });

  // Auditbevinding A-2: de ongebruikte kopie server/repositories/afnames.ts is
  // verwijderd. De bewaking staat nu op de enige levende implementatie.
  it("filtert in de SQL en niet met een filter achteraf", () => {
    const bron = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
    expect(bron).toContain("organisatieFilterVanScope(scope, \"listAfnames\")");
    expect(bron).toContain("eq(afnames.organisatieId, orgFilter)");
  });

  it("heeft geen enkele oproep van listAfnames() zonder scope meer", () => {
    for (const pad of ["../server/routes/admin.ts", "../server/routes/financieel.ts"]) {
      const bron = readFileSync(new URL(pad, import.meta.url), "utf8");
      expect(bron, pad).not.toContain("listAfnames()");
    }
  });
});
