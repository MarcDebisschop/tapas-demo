// ---------------------------------------------------------------------------
// server/toc-kompas/storage.ts
//
// Opslag voor het TOC Commitmentkompas. Werkt op de hoofdhandle van het
// platform (server/storage.ts exporteert `sqlite`), zodat versleuteling, WAL en
// het migratiespoor van het platform vanzelf gelden. De tabellen worden bij het
// opstarten aangemaakt met exact dezelfde definitie als
// migrations/0013_toc_kompas.sql (server/toc-kompas/ddl.ts).
//
// Alle toegang loopt via prepared statements met gebonden parameters. Tabel-
// en kolomnamen komen nooit uit invoer: ze worden getoetst aan een vaste lijst.
//
// Tokens van de Captains worden alleen als sha256-hash bewaard.
// ---------------------------------------------------------------------------
import { createHash, randomBytes } from "node:crypto";
import { sqlite } from "../storage";
import { tocKompasStatements, TOC_KOMPAS_TABELLEN } from "./ddl";

export type Tabel = (typeof TOC_KOMPAS_TABELLEN)[number];

let klaar = false;
export function zorgVoorTabellen(): void {
  if (klaar) return;
  for (const stap of tocKompasStatements()) sqlite.exec(stap);
  klaar = true;
}
zorgVoorTabellen();

export function db() {
  return sqlite;
}

export function nu(): string {
  return new Date().toISOString();
}

/** Stabiele JSON: sleutels gesorteerd, zodat dezelfde inhoud dezelfde hash geeft. */
export function canoniek(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canoniek).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canoniek(o[k])}`)
    .join(",")}}`;
}

export function sha256(v: unknown): string {
  const s = typeof v === "string" ? v : canoniek(v);
  return createHash("sha256").update(s).digest("hex");
}

/** Een nieuw token: 32 willekeurige bytes, url-veilig. Enkel de hash wordt bewaard. */
export function nieuwToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

function naarSnake(k: string): string {
  return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
function naarCamel(k: string): string {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toetsTabel(t: string): asserts t is Tabel {
  if (!(TOC_KOMPAS_TABELLEN as readonly string[]).includes(t)) throw new Error(`Onbekende tabel ${t}`);
}

const kolomCache = new Map<string, Set<string>>();
function kolommen(t: Tabel): Set<string> {
  let k = kolomCache.get(t);
  if (!k) {
    const rijen = sqlite.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>;
    k = new Set(rijen.map((r) => r.name));
    kolomCache.set(t, k);
  }
  return k;
}

function naarRij(t: Tabel, obj: Record<string, unknown>): Record<string, unknown> {
  const toegestaan = kolommen(t);
  const uit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const kolom = naarSnake(k);
    if (!toegestaan.has(kolom)) throw new Error(`Onbekende kolom ${t}.${kolom}`);
    uit[kolom] = typeof v === "boolean" ? (v ? 1 : 0) : v;
  }
  return uit;
}

export function vanRij<T = any>(rij: Record<string, unknown> | undefined): T | null {
  if (!rij) return null;
  const uit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rij)) uit[naarCamel(k)] = v;
  return uit as T;
}

export function voegToe(t: Tabel, obj: Record<string, unknown>): number {
  toetsTabel(t);
  const rij = naarRij(t, obj);
  const namen = Object.keys(rij);
  const sql = `INSERT INTO ${t} (${namen.join(", ")}) VALUES (${namen.map(() => "?").join(", ")})`;
  const r = sqlite.prepare(sql).run(...namen.map((n) => rij[n]));
  return Number(r.lastInsertRowid);
}

/**
 * Wijzigt een rij. Met `verwachteVersie` wordt optimistisch vergrendeld: de
 * rij verandert enkel als de versie nog klopt. Geeft het aantal gewijzigde
 * rijen terug.
 */
export function wijzig(t: Tabel, id: number, obj: Record<string, unknown>, verwachteVersie?: { kolom: string; waarde: string | number }): number {
  toetsTabel(t);
  const rij = naarRij(t, obj);
  const namen = Object.keys(rij);
  if (namen.length === 0) return 0;
  let sql = `UPDATE ${t} SET ${namen.map((n) => `${n} = ?`).join(", ")} WHERE id = ?`;
  const params: unknown[] = [...namen.map((n) => rij[n]), id];
  if (verwachteVersie) {
    const kolom = naarSnake(verwachteVersie.kolom);
    if (!kolommen(t).has(kolom)) throw new Error(`Onbekende kolom ${t}.${kolom}`);
    sql += ` AND ${kolom} = ?`;
    params.push(verwachteVersie.waarde);
  }
  return sqlite.prepare(sql).run(...params).changes;
}

export function haal<T = any>(t: Tabel, id: number): T | null {
  toetsTabel(t);
  return vanRij<T>(sqlite.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id) as any);
}

export function lijst<T = any>(t: Tabel, kolom: string, waarde: unknown, volgorde = "id"): T[] {
  toetsTabel(t);
  const k = naarSnake(kolom);
  const v = naarSnake(volgorde);
  if (!kolommen(t).has(k) || !kolommen(t).has(v)) throw new Error("Onbekende kolom");
  return (sqlite.prepare(`SELECT * FROM ${t} WHERE ${k} = ? ORDER BY ${v}`).all(waarde) as any[]).map((r) => vanRij<T>(r)!);
}

export function captainVoorToken(token: string): any | null {
  return vanRij(sqlite.prepare("SELECT * FROM toc_kompas_captains WHERE token_hash = ?").get(sha256(token)) as any);
}

export function alleRondes(): any[] {
  return (sqlite.prepare("SELECT * FROM toc_kompas_rondes ORDER BY periode DESC, id DESC").all() as any[]).map((r) => vanRij(r));
}

export function transactie<T>(f: () => T): T {
  return sqlite.transaction(f)();
}
