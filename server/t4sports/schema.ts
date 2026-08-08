import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * Resultaten van T4Sports-modules, gebruikt door server/t4sports/module-routes.ts.
 */
export const t4sportsModuleResultaten = sqliteTable(
  "t4sports_module_resultaten",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    afnameId: integer("afname_id").notNull(),
    moduleId: text("module_id").notNull(),
    resultaatJson: text("resultaat_json").notNull(),
    aangemaaktAt: text("aangemaakt_at").notNull(),
  },
  (tabel) => [
    unique().on(tabel.afnameId, tabel.moduleId),
  ],
);
