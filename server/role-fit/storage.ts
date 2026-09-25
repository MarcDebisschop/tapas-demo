// ---------------------------------------------------------------------------
// server/role-fit/storage.ts
//
// Opslag voor Recruitment & Role Fit. Werkt op de hoofdhandle van het platform
// (server/storage.ts exporteert `sqlite`), zodat versleuteling, WAL en het
// migratiespoor van het platform vanzelf gelden. De tabellen worden bij het
// opstarten aangemaakt met exact dezelfde definitie als
// migrations/0012_role_fit.sql (server/role-fit/ddl.ts).
//
// Alle toegang loopt via prepared statements met gebonden parameters. Tabel-
// en kolomnamen komen nooit uit invoer: ze worden getoetst aan een vaste lijst.
//
// Tokens van observatoren worden alleen als sha256-hash bewaard.
// ---------------------------------------------------------------------------
import { createHash } from "node:crypto";
import { sqlite } from "../storage";
import { roleFitStatements, ROLE_FIT_TABELLEN } from "./ddl";

export type Tabel = (typeof ROLE_FIT_TABELLEN)[number];

let klaar = false;
export function zorgVoorTabellen(): void {
  if (klaar) return;
  for (const stap of roleFitStatements()) sqlite.exec(stap);
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

function naarSnake(k: string): string {
  return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
function naarCamel(k: string): string {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toetsTabel(t: string): asserts t is Tabel {
  if (!(ROLE_FIT_TABELLEN as readonly string[]).includes(t)) throw new Error(`Onbekende tabel ${t}`);
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
    const s = naarSnake(k);
    if (!toegestaan.has(s)) throw new Error(`Onbekende kolom ${t}.${s}`);
    uit[s] = typeof v === "boolean" ? (v ? 1 : 0) : v;
  }
  return uit;
}

export function vanRij<T = any>(rij: any): T {
  if (!rij) return rij;
  const uit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rij)) uit[naarCamel(k)] = v;
  return uit as T;
}

/** Voegt een rij toe. created_at en updated_at worden automatisch gezet. */
export function voegToe(t: Tabel, obj: Record<string, unknown>): number {
  toetsTabel(t);
  const tijd = nu();
  const rij = naarRij(t, { createdAt: tijd, updatedAt: tijd, ...obj });
  const namen = Object.keys(rij);
  const sql = `INSERT INTO ${t} (${namen.join(",")}) VALUES (${namen.map(() => "?").join(",")})`;
  const r = sqlite.prepare(sql).run(...namen.map((n) => rij[n]));
  return Number(r.lastInsertRowid);
}

export function haal<T = any>(t: Tabel, id: number): T | undefined {
  toetsTabel(t);
  return vanRij<T>(sqlite.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id));
}

export function lijstVoorCase<T = any>(t: Tabel, caseId: number, extra = "", ...params: unknown[]): T[] {
  toetsTabel(t);
  const rijen = sqlite.prepare(`SELECT * FROM ${t} WHERE case_id = ? ${extra} ORDER BY id`).all(caseId, ...params);
  return rijen.map((r) => vanRij<T>(r));
}

/**
 * Wijzigt velden van een rij. Met `verwachteVersie` gebeurt dat alleen wanneer
 * de versie in de databank nog gelijk is (optimistische vergrendeling); het
 * versienummer stijgt dan met een. Geeft het aantal gewijzigde rijen terug.
 */
export function wijzig(
  t: Tabel,
  id: number,
  velden: Record<string, unknown>,
  voorwaarden: { verwachteVersie?: number; status?: string; statusNiet?: string } = {},
): number {
  toetsTabel(t);
  const rij = naarRij(t, { ...velden, updatedAt: nu() });
  const namen = Object.keys(rij);
  const sets = namen.map((n) => `${n} = ?`);
  sets.push("versie = versie + 1");
  const waar: string[] = ["id = ?"];
  const params: unknown[] = [...namen.map((n) => rij[n]), id];
  if (voorwaarden.verwachteVersie !== undefined) {
    waar.push("versie = ?");
    params.push(voorwaarden.verwachteVersie);
  }
  if (voorwaarden.status !== undefined) {
    waar.push("status = ?");
    params.push(voorwaarden.status);
  }
  if (voorwaarden.statusNiet !== undefined) {
    waar.push("status != ?");
    params.push(voorwaarden.statusNiet);
  }
  const r = sqlite.prepare(`UPDATE ${t} SET ${sets.join(", ")} WHERE ${waar.join(" AND ")}`).run(...params);
  return r.changes;
}

export function verwijderVoorCase(t: Tabel, caseId: number, extra = "", ...params: unknown[]): number {
  toetsTabel(t);
  return sqlite.prepare(`DELETE FROM ${t} WHERE case_id = ? ${extra}`).run(caseId, ...params).changes;
}

export function transactie<T>(fn: () => T): T {
  return sqlite.transaction(fn)();
}

// ---- Specifiek ---------------------------------------------------------------

export function lijstCases(organisatieId: number | null): any[] {
  const rijen =
    organisatieId === null
      ? sqlite.prepare("SELECT * FROM role_fit_cases ORDER BY id DESC").all()
      : sqlite.prepare("SELECT * FROM role_fit_cases WHERE organisatie_id = ? ORDER BY id DESC").all(organisatieId);
  return rijen.map((r) => vanRij(r));
}

/**
 * Zet de status van een case atomisch van `van` naar `naar`. Slaagt enkel
 * wanneer de case op dat moment nog in `van` staat; zo kunnen twee gelijktijdige
 * verzoeken nooit allebei dezelfde overgang maken.
 */
export function zetStatus(caseId: number, van: string, naar: string, extra: Record<string, unknown> = {}): boolean {
  return wijzig("role_fit_cases", caseId, { ...extra, status: naar }, { status: van }) === 1;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(`role-fit:${token}`).digest("hex");
}

export function opdrachtVoorToken(token: string): any | undefined {
  const rij = sqlite
    .prepare("SELECT * FROM role_fit_observer_assignments WHERE token_hash = ?")
    .get(hashToken(token));
  return vanRij(rij);
}

export function laatsteArtefact(caseId: number, type: string): any | undefined {
  return vanRij(
    sqlite
      .prepare("SELECT * FROM role_fit_artifacts WHERE case_id = ? AND type = ? ORDER BY versie DESC LIMIT 1")
      .get(caseId, type),
  );
}

export function volgendeArtefactVersie(caseId: number, type: string): number {
  const r = sqlite
    .prepare("SELECT COALESCE(MAX(versie), 0) AS m FROM role_fit_artifacts WHERE case_id = ? AND type = ?")
    .get(caseId, type) as { m: number };
  return r.m + 1;
}

/** Huidige versie per (opdracht, oefening): de hoogste versie telt. */
export function huidigeObservaties(caseId: number): any[] {
  const rijen = sqlite
    .prepare(
      `SELECT o.* FROM role_fit_observations o
       WHERE o.case_id = ? AND o.versie = (
         SELECT MAX(o2.versie) FROM role_fit_observations o2
         WHERE o2.assignment_id = o.assignment_id AND o2.exercise_id = o.exercise_id
       ) ORDER BY o.assignment_id, o.exercise_id`,
    )
    .all(caseId);
  return rijen.map((r) => vanRij(r));
}

/** Bewaartermijn: verwijdert alle inhoud van een case en laat een leeg skelet staan. */
export function wisCaseInhoud(caseId: number): void {
  transactie(() => {
    for (const t of ROLE_FIT_TABELLEN) {
      if (t === "role_fit_cases") continue;
      sqlite.prepare(`DELETE FROM ${t} WHERE case_id = ?`).run(caseId);
    }
    sqlite
      .prepare(
        `UPDATE role_fit_cases SET kandidaat_label = 'verwijderd', recruiter_naam = 'verwijderd',
         recruiter_email = 'verwijderd', hm_naam = 'verwijderd', hm_email = 'verwijderd',
         wizard_json = '{}', verwijderd_op = ?, updated_at = ?, versie = versie + 1 WHERE id = ?`,
      )
      .run(nu(), nu(), caseId);
  });
}
