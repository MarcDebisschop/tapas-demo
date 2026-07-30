// ---------------------------------------------------------------------------
// tests/sessie-opslag.test.ts - Auditbevinding L-1 (hoog, licentie).
//
// Wat deze tests bewijzen:
//   1. Het GPL-3.0-pakket better-sqlite3-session-store zit niet meer in het
//      project: niet in package.json, niet in het slotbestand, en nergens
//      geimporteerd. De sessieopslag is eigen code.
//   2. De eigen SessieOpslag doet alles wat express-session van een store
//      verwacht: bewaren, ophalen, verlengen, verwijderen, tellen, leegmaken en
//      opsommen - en verlopen sessies gelden als onbestaand.
//   3. De cookie-instellingen in server/index.ts blijven ongewijzigd (dezelfde
//      naam, maxAge en sameSite/secure-strategie), zodat de wissel van opslag
//      geen enkele gebruiker uitlogt.
// ---------------------------------------------------------------------------
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { SessieOpslag } from "../server/sessie-opslag";

function nieuweOpslag() {
  const db = new Database(":memory:");
  const opslag = new SessieOpslag({ client: db as any, ruimVerlopenOp: false });
  return { db, opslag };
}

function sessie(maxAgeMs: number, extra: Record<string, unknown> = {}): any {
  return { cookie: { maxAge: maxAgeMs, originalMaxAge: maxAgeMs }, ...extra };
}

const opTeRuimen: Array<{ stop: () => void }> = [];
afterEach(() => {
  while (opTeRuimen.length) opTeRuimen.pop()!.stop();
});

describe("L-1: geen GPL-sessieopslag meer in het project", () => {
  const pkg = readFileSync(resolve(__dirname, "../package.json"), "utf8");
  const lock = readFileSync(resolve(__dirname, "../package-lock.json"), "utf8");
  const index = readFileSync(resolve(__dirname, "../server/index.ts"), "utf8");

  it("staat niet meer bij de afhankelijkheden", () => {
    const json = JSON.parse(pkg);
    expect(Object.keys(json.dependencies ?? {})).not.toContain("better-sqlite3-session-store");
    expect(Object.keys(json.devDependencies ?? {})).not.toContain("better-sqlite3-session-store");
  });

  it("staat niet meer in het slotbestand", () => {
    expect(lock).not.toContain("better-sqlite3-session-store");
  });

  it("wordt nergens meer geimporteerd", () => {
    expect(index).not.toMatch(/^\s*import .*better-sqlite3-session-store/m);
    expect(index).toMatch(/import \{ SessieOpslag \} from "\.\/sessie-opslag"/);
    expect(index).toMatch(/store:\s*new SessieOpslag\(/);
  });

  it("laat de cookie-instellingen ongewijzigd, zodat niemand uitgelogd raakt", () => {
    expect(index).toContain('name: "__Host-tapas-sid"');
    expect(index).toMatch(/sameSite:\s*"auto"/);
    expect(index).toMatch(/secure:\s*"auto"/);
    expect(index).toMatch(/maxAge:\s*24 \* 60 \* 60 \* 1000/);
  });
});

describe("L-1: de eigen SessieOpslag gedraagt zich als een express-session store", () => {
  it("bewaart en haalt een sessie op", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("sid-1", sessie(60_000, { adminId: 7 }), () => r()));
    const gelezen = await new Promise<any>((r) => opslag.get("sid-1", (_f, s) => r(s)));
    expect(gelezen.adminId).toBe(7);
  });

  it("geeft null voor een onbekend sessie-id", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    const gelezen = await new Promise<any>((r) => opslag.get("bestaat-niet", (_f, s) => r(s)));
    expect(gelezen).toBeNull();
  });

  it("overschrijft een bestaande sessie in plaats van te dubbelen", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("sid-2", sessie(60_000, { adminId: 1 }), () => r()));
    await new Promise<void>((r) => opslag.set("sid-2", sessie(60_000, { adminId: 2 }), () => r()));
    const gelezen = await new Promise<any>((r) => opslag.get("sid-2", (_f, s) => r(s)));
    expect(gelezen.adminId).toBe(2);
    const aantal = await new Promise<number>((r) => opslag.length((_f, n) => r(n ?? -1)));
    expect(aantal).toBe(1);
  });

  it("behandelt een verlopen sessie als onbestaand en ruimt ze op", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("sid-oud", sessie(-1000, { adminId: 9 }), () => r()));
    const gelezen = await new Promise<any>((r) => opslag.get("sid-oud", (_f, s) => r(s)));
    expect(gelezen).toBeNull();
    const aantal = await new Promise<number>((r) => opslag.length((_f, n) => r(n ?? -1)));
    expect(aantal).toBe(0);
  });

  it("verlengt een geldige sessie met touch en laat een verlopen sessie verlopen", async () => {
    const { opslag, db } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("sid-3", sessie(1_000), () => r()));
    const voor = db.prepare("SELECT expire FROM sessions WHERE sid = ?").get("sid-3") as any;
    await new Promise<void>((r) => opslag.touch("sid-3", sessie(600_000), () => r()));
    const na = db.prepare("SELECT expire FROM sessions WHERE sid = ?").get("sid-3") as any;
    expect(new Date(na.expire).getTime()).toBeGreaterThan(new Date(voor.expire).getTime());
  });

  it("verwijdert een sessie met destroy", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("sid-4", sessie(60_000), () => r()));
    await new Promise<void>((r) => opslag.destroy("sid-4", () => r()));
    const gelezen = await new Promise<any>((r) => opslag.get("sid-4", (_f, s) => r(s)));
    expect(gelezen).toBeNull();
  });

  it("telt, somt op en maakt leeg", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("a", sessie(60_000, { coachId: 1 }), () => r()));
    await new Promise<void>((r) => opslag.set("b", sessie(60_000, { coachId: 2 }), () => r()));
    const alle = await new Promise<any[]>((r) => opslag.all((_f, s) => r(s ?? [])));
    expect(alle.map((s) => s.coachId).sort()).toEqual([1, 2]);
    await new Promise<void>((r) => opslag.clear(() => r()));
    const aantal = await new Promise<number>((r) => opslag.length((_f, n) => r(n ?? -1)));
    expect(aantal).toBe(0);
  });

  it("ruimt met ruimVerlopenOp alleen de verlopen sessies op", async () => {
    const { opslag } = nieuweOpslag();
    opTeRuimen.push(opslag);
    await new Promise<void>((r) => opslag.set("geldig", sessie(60_000), () => r()));
    await new Promise<void>((r) => opslag.set("verlopen", sessie(-5_000), () => r()));
    expect(opslag.ruimVerlopenOp()).toBe(1);
    const nog = await new Promise<any>((r) => opslag.get("geldig", (_f, s) => r(s)));
    expect(nog).not.toBeNull();
  });

  it("eist een SQLite-verbinding", () => {
    expect(() => new SessieOpslag({} as any)).toThrow(/SQLite/);
  });
});
