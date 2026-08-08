import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Privaat-aankoopintakes, gebruikt door server/prive-aankoop/routes.ts.
 */
export const priveAankopen = sqliteTable("prive_aankoop", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  betalingId: integer("betaling_id").notNull(),
  instrumentId: text("instrument_id").notNull(),
  intake: text("intake").notNull(),
  factuurId: integer("factuur_id"),
  aangemaaktOp: text("aangemaakt_op").notNull(),
  bewaartot: text("bewaartot"),
  geanonimiseerdOp: text("geanonimiseerd_op"),
  consentVersie: text("consent_versie"),
  consentIp: text("consent_ip"),
});
