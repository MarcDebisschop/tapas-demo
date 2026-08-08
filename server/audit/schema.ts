import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * GDPR-auditspoor, gebruikt door server/audit-log.ts bij privacyacties.
 */
export const gdprAuditLog = sqliteTable(
  "gdpr_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminId: integer("admin_id"),
    actie: text("actie").notNull(),
    afnameId: integer("afname_id"),
    detail: text("detail"),
    tijdstip: text("tijdstip").notNull(),
  },
  (tabel) => [index("idx_gdpr_audit_afname").on(tabel.afnameId)],
);
