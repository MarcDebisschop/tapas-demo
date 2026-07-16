// Minimale typedeclaratie voor better-sqlite3-session-store (levert geen eigen
// types). Enkel wat we gebruiken: de default-export is een factory die een
// express-session Store-constructor teruggeeft.
declare module "better-sqlite3-session-store" {
  import type { Store } from "express-session";
  interface BetterSqlite3StoreOptions {
    client: unknown;
    expired?: { clear?: boolean; intervalMs?: number };
  }
  interface BetterSqlite3StoreClass {
    new (options: BetterSqlite3StoreOptions): Store;
  }
  export default function (session: unknown): BetterSqlite3StoreClass;
}
