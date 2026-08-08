import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * STM-trainingssessies, gebruikt door server/stm-storage.ts.
 */
export const stmSessies = sqliteTable(
  "stm_sessies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    beheerderId: integer("beheerder_id").notNull(),
    gestartAt: text("gestart_at").notNull(),
    afgerondAt: text("afgerond_at"),
    scoreTotaal: real("score_totaal"),
    inschaling: text("inschaling"),
    duurSeconden: integer("duur_seconden"),
    scoresPerLaag: text("scores_per_laag").notNull().default("{}"),
    feedback: text("feedback").notNull().default("[]"),
  },
  (tabel) => [index("idx_stm_sessies_beheerder").on(tabel.beheerderId)],
);

/**
 * Kwaliteitsnormen per beheerder, gebruikt door server/kwaliteit-storage.ts.
 */
export const kwaliteitNormen = sqliteTable("kwaliteit_normen", {
  beheerderId: integer("beheerder_id").primaryKey(),
  norm: integer("norm").notNull(),
  bijgewerktAt: text("bijgewerkt_at").notNull(),
});

/**
 * Kwaliteitsstatusoverrides per beheerder, gebruikt door server/kwaliteit-storage.ts.
 */
export const kwaliteitOverrides = sqliteTable("kwaliteit_overrides", {
  beheerderId: integer("beheerder_id").primaryKey(),
  status: text("status"),
  reden: text("reden"),
  bijgewerktAt: text("bijgewerkt_at").notNull(),
});

/**
 * Verzonden kwaliteitssignalen per beheerder, gebruikt door server/kwaliteit-storage.ts.
 */
export const kwaliteitAlerts = sqliteTable("kwaliteit_alerts", {
  beheerderId: integer("beheerder_id").primaryKey(),
  trap1Verstuurd: integer("trap1_sent").notNull().default(0),
  trap2Verstuurd: integer("trap2_sent").notNull().default(0),
  trap3Verstuurd: integer("trap3_sent").notNull().default(0),
  bijgewerktAt: text("bijgewerkt_at"),
});

/**
 * Verzendlog van kwaliteitssignalen, gebruikt door server/kwaliteit-storage.ts.
 */
export const kwaliteitMaillog = sqliteTable(
  "kwaliteit_maillog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    beheerderId: integer("beheerder_id").notNull(),
    trap: integer("trap").notNull(),
    naam: text("naam").notNull(),
    email: text("email").notNull(),
    verstuurdAt: text("verstuurd_at").notNull(),
  },
  (tabel) => [index("idx_kwaliteit_maillog_beheerder").on(tabel.beheerderId)],
);

/**
 * Kwaliteitsnotities per beheerder, gebruikt door server/kwaliteit-storage.ts.
 */
export const kwaliteitNotities = sqliteTable(
  "kwaliteit_notities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    beheerderId: integer("beheerder_id").notNull(),
    soort: text("soort").notNull(),
    tekst: text("tekst").notNull(),
    opgelost: integer("opgelost").notNull().default(0),
    aangemaaktAt: text("aangemaakt_at").notNull(),
  },
  (tabel) => [index("idx_kwaliteit_notities_beheerder").on(tabel.beheerderId)],
);
