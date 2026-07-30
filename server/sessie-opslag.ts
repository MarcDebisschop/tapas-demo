/**
 * server/sessie-opslag.ts
 *
 * Auditbevinding L-1 (hoog, juridisch). De sessieopslag liep tot nu via
 * `better-sqlite3-session-store`, dat onder GPL-3.0-only staat. Een GPL-3.0
 * component die in de servertoepassing wordt meegebundeld raakt de
 * licentievrijheid van het volledige kernactivum. Deze module vervangt dat
 * pakket door een eigen implementatie op de gedeelde better-sqlite3-verbinding,
 * geschreven in TypeScript en volledig eigendom van TaPas.
 *
 * De opslag implementeert de express-session Store-interface:
 *   get / set / destroy / touch / length / clear / all
 * De tabel `sessions` (sid, sess, expire) blijft ongewijzigd, zodat bestaande
 * sessies na deze wissel gewoon doorlopen en er geen migratie nodig is.
 *
 * Vervaldatums staan als ISO-8601 in UTC in de kolom `expire`. Vergelijken
 * gebeurt in JavaScript en niet in SQL, zodat het gedrag niet afhangt van de
 * tijdzone-instellingen van SQLite.
 */
import { Store, type SessionData } from "express-session";

/** Minimale vorm van de better-sqlite3-verbinding die we gebruiken. */
export interface SqliteVerbinding {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: any[]): { changes: number };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
}

export interface SessieOpslagOpties {
  /** De gedeelde better-sqlite3-verbinding van de toepassing. */
  client: SqliteVerbinding;
  /** Levensduur wanneer de cookie zelf geen maxAge of expires meegeeft. */
  standaardLevensduurMs?: number;
  /** Periodiek verlopen sessies opruimen (standaard aan). */
  ruimVerlopenOp?: boolean;
  /** Interval van de opruimbeurt. */
  opruimIntervalMs?: number;
}

const EEN_DAG_MS = 24 * 60 * 60 * 1000;
const TABEL = "sessions";

export class SessieOpslag extends Store {
  private readonly client: SqliteVerbinding;
  private readonly standaardLevensduurMs: number;
  private opruimTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opties: SessieOpslagOpties) {
    super();
    if (!opties?.client) {
      throw new Error("SessieOpslag heeft een SQLite-verbinding nodig (opties.client).");
    }
    this.client = opties.client;
    this.standaardLevensduurMs = opties.standaardLevensduurMs ?? EEN_DAG_MS;
    this.maakTabel();
    if (opties.ruimVerlopenOp !== false) {
      this.startOpruimen(opties.opruimIntervalMs ?? EEN_DAG_MS);
    }
  }

  private maakTabel(): void {
    this.client.exec(
      `CREATE TABLE IF NOT EXISTS ${TABEL} (
         sid    TEXT NOT NULL PRIMARY KEY,
         sess   TEXT NOT NULL,
         expire TEXT NOT NULL
       )`,
    );
    // Index op de vervaldatum: de opruimbeurt scant anders de hele tabel.
    this.client.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON ${TABEL}(expire)`);
  }

  /** Zet de opruimtimer op; `unref` zodat hij het proces niet openhoudt. */
  private startOpruimen(intervalMs: number): void {
    this.opruimTimer = setInterval(() => {
      try {
        this.ruimVerlopenOp();
      } catch (fout) {
        console.error("[sessie-opslag] opruimen van verlopen sessies mislukt:", fout);
      }
    }, intervalMs);
    this.opruimTimer.unref?.();
  }

  /** Stopt de opruimtimer (gebruikt in tests en bij nette afsluiting). */
  stop(): void {
    if (this.opruimTimer) {
      clearInterval(this.opruimTimer);
      this.opruimTimer = null;
    }
  }

  /** Verwijdert alle verlopen sessies; geeft het aantal verwijderde rijen. */
  ruimVerlopenOp(nu: Date = new Date()): number {
    const res = this.client
      .prepare(`DELETE FROM ${TABEL} WHERE expire <= ?`)
      .run(nu.toISOString());
    return res.changes;
  }

  /** Bepaalt de vervaldatum uit de cookie, met de standaardlevensduur als val. */
  private vervalMoment(sess: SessionData | undefined, nu: number): string {
    const cookie: any = sess?.cookie;
    if (cookie?.expires) {
      const d = new Date(cookie.expires);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    // Elke numerieke maxAge wordt gevolgd, ook een negatieve: express-session
    // gebruikt dat om een sessie meteen te laten verlopen.
    if (typeof cookie?.maxAge === "number" && Number.isFinite(cookie.maxAge)) {
      return new Date(nu + cookie.maxAge).toISOString();
    }
    return new Date(nu + this.standaardLevensduurMs).toISOString();
  }

  get(sid: string, cb: (fout?: any, sessie?: SessionData | null) => void): void {
    try {
      const rij = this.client
        .prepare(`SELECT sess, expire FROM ${TABEL} WHERE sid = ?`)
        .get(sid);
      if (!rij) return cb(null, null);
      if (new Date(rij.expire).getTime() <= Date.now()) {
        // Verlopen: meteen opruimen en behandelen als onbestaand.
        this.client.prepare(`DELETE FROM ${TABEL} WHERE sid = ?`).run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(rij.sess) as SessionData);
    } catch (fout) {
      cb(fout);
    }
  }

  set(sid: string, sess: SessionData, cb?: (fout?: any) => void): void {
    try {
      this.client
        .prepare(
          `INSERT INTO ${TABEL} (sid, sess, expire) VALUES (?, ?, ?)
             ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
        )
        .run(sid, JSON.stringify(sess), this.vervalMoment(sess, Date.now()));
      cb?.(null);
    } catch (fout) {
      cb?.(fout);
    }
  }

  destroy(sid: string, cb?: (fout?: any) => void): void {
    try {
      this.client.prepare(`DELETE FROM ${TABEL} WHERE sid = ?`).run(sid);
      cb?.(null);
    } catch (fout) {
      cb?.(fout);
    }
  }

  touch(sid: string, sess: SessionData, cb?: (fout?: any) => void): void {
    try {
      this.client
        .prepare(`UPDATE ${TABEL} SET expire = ? WHERE sid = ? AND expire > ?`)
        .run(this.vervalMoment(sess, Date.now()), sid, new Date().toISOString());
      cb?.(null);
    } catch (fout) {
      cb?.(fout);
    }
  }

  length(cb: (fout: any, lengte?: number) => void): void {
    try {
      const rij = this.client
        .prepare(`SELECT COUNT(*) AS aantal FROM ${TABEL} WHERE expire > ?`)
        .get(new Date().toISOString());
      cb(null, Number(rij?.aantal ?? 0));
    } catch (fout) {
      cb(fout);
    }
  }

  clear(cb?: (fout?: any) => void): void {
    try {
      this.client.prepare(`DELETE FROM ${TABEL}`).run();
      cb?.(null);
    } catch (fout) {
      cb?.(fout);
    }
  }

  all(cb: (fout: any, sessies?: SessionData[]) => void): void {
    try {
      const rijen = this.client
        .prepare(`SELECT sess FROM ${TABEL} WHERE expire > ?`)
        .all(new Date().toISOString());
      cb(null, rijen.map((r: any) => JSON.parse(r.sess) as SessionData));
    } catch (fout) {
      cb(fout);
    }
  }
}
