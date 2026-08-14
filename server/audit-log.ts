// =============================================================================
// server/audit-log.ts - Append-only audit-log voor persoonsdata-acties
//
// Wettelijk kader: AVG art. 5.2 (aantoonbaarheid) en art. 32 (beveiliging). Het
// bestaande auditspoor dekte enkel wijzigingen aan vraagteksten
// (vraag_overschrijvingen); toegang tot en ingrepen op persoonsgegevens werden
// nergens vastgelegd. Zonder dat spoor kan niet aangetoond worden wie wanneer
// welke persoonsgegevens heeft geexporteerd of gewist.
//
// Wat we loggen: GDPR-export, anonimisering (handmatig en automatisch),
// consent-intrekking, bewaartermijnwijziging en admin-inzage in afnamedetails.
// Wat we NIET loggen: de persoonsgegevens zelf. Het log bevat enkel wie
// (adminId), wat (actie + afnameId), wanneer (ISO) en een korte reden. Zo wordt
// het audit-log zelf geen tweede kopie van de persoonsgegevens.
//
// Append-only: naast de afspraak in code dwingen SQLite-triggers af dat rijen
// niet gewijzigd of verwijderd kunnen worden. Ook een beheerder met
// databasetoegang via de applicatie kan het spoor dus niet stilletjes bijwerken.
// =============================================================================

import { sqlite } from "./storage";

export const AUDIT_ACTIES = [
  "gdpr_export",
  "gdpr_export_download",
  "anonimisering",
  "auto_anonimisering",
  "consent_intrekking",
  "bewaartermijn_wijziging",
  "afname_inzage",
  "gdpr_rectificatie",
  "prive_intake_anonimisering",
  "traject_aangemaakt",
  "traject_partij_toegevoegd",
  "traject_lijn_toegevoegd",
  "traject_gebeurtenis_toegevoegd",
  "traject_vraag_aangemaakt",
  "traject_vraag_toestand_gewijzigd",
  "traject_werkstroom_bijgewerkt",
  "traject_persoon_toegevoegd",
  "traject_persoon_inactief_gezet",
  "traject_rol_toegekend",
  "traject_rol_ingetrokken",
  "traject_rol_belangwaarschuwing",
  "traject_personen_ingekeken",
  "traject_indruk_vrijgegeven",
  "traject_bril_gebruikt",
  "traject_gebeurtenis_auteur_gezet",
  // Module Bekwaamheid. Alleen handelingen die een gevolg hebben voor een
  // persoon staan hier. Het lezen van een dashboard is geen auditgebeurtenis;
  // het vaststellen van een uitkomst over iemand wel.
  "bekwaamheid_register_gewijzigd",
  "bekwaamheid_licentie_gewijzigd",
  "bekwaamheid_tussentijdse_toets_vastgesteld",
  "bekwaamheid_tussentijdse_toets_gepubliceerd",
  "bekwaamheid_coachingsplan_opgesteld",
  "bekwaamheid_coachingsplan_afgesloten",
  "bekwaamheid_poort_geweigerd",
  "bekwaamheid_poort_zou_weigeren",
  "bekwaamheid_normprofiel_vastgelegd",
  "bekwaamheid_normprofiel_gewijzigd",
  "bekwaamheid_normprofiel_bevroren",
  // Itembank en kennischeck. Het wijzigen van `gebruik` staat er apart in en
  // niet als gewone itemwijziging: dat is de enige handeling die een item uit de
  // meting haalt of erin houdt, en bij een bezwaar over een itemset is de vraag
  // altijd wanneer welk item van status wisselde.
  "bekwaamheid_item_neergezet",
  "bekwaamheid_item_gewijzigd",
  "bekwaamheid_item_gebruik_gewijzigd",
  "bekwaamheid_itemset_samengesteld",
  "bekwaamheid_itemset_ingeleverd",
  // Blok 3 en 4. Het lezen van een ronde staat er niet in, het verzetten van
  // haar fase wel: dat is de handeling die bepaalt wat er daarna nog mag
  // gebeuren, en bij een bezwaar is de eerste vraag altijd wanneer welke fase
  // is ingegaan. De accreditatie staat er apart in naast de licentie, omdat het
  // twee verschillende feiten zijn: wat iemand ooit behaalde tegenover wat hij
  // vandaag mag.
  "bekwaamheid_accreditatie_vastgelegd",
  "bekwaamheid_accreditatie_ingetrokken",
  "bekwaamheid_ronde_geopend",
  "bekwaamheid_ronde_fase_verzet",
  "bekwaamheid_ronde_aanpassing_vastgelegd",
  "bekwaamheid_bewijsstuk_nvt",
  "bekwaamheid_bewijsstuk_beoordeeld",
  "bekwaamheid_beslissing_vastgelegd",
  "bekwaamheid_beslissing_gepubliceerd",
  "bekwaamheid_bezwaar_ingediend",
  "bekwaamheid_bezwaar_uitspraak",
] as const;

export type AuditActie = (typeof AUDIT_ACTIES)[number];

export interface AuditInvoer {
  // Null wanneer er geen mens achter de actie zit (achtergrondtaak).
  adminId: number | null;
  actie: AuditActie;
  afnameId: number | null;
  detail?: string | null;
}

let tabelKlaar = false;

// Maakt de tabel en de append-only triggers aan. Idempotent en stil bij fouten:
// het audit-log mag nooit de reden zijn dat een GDPR-actie faalt.
export function zorgVoorAuditTabel(): void {
  if (tabelKlaar) return;
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS gdpr_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        actie TEXT NOT NULL,
        afname_id INTEGER,
        detail TEXT,
        tijdstip TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gdpr_audit_afname ON gdpr_audit_log(afname_id);
      CREATE TRIGGER IF NOT EXISTS gdpr_audit_geen_update
        BEFORE UPDATE ON gdpr_audit_log
        BEGIN SELECT RAISE(ABORT, 'audit-log is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS gdpr_audit_geen_delete
        BEFORE DELETE ON gdpr_audit_log
        BEGIN SELECT RAISE(ABORT, 'audit-log is append-only'); END;
    `);
    tabelKlaar = true;
  } catch (err) {
    console.error("[audit] Audit-tabel aanmaken mislukt:", err);
  }
}

// Schrijft één regel weg. Faalt zacht: een mislukte logregel mag de
// onderliggende GDPR-actie niet blokkeren, maar wordt wel luid gelogd.
export function schrijfAuditLog(invoer: AuditInvoer): void {
  try {
    zorgVoorAuditTabel();
    sqlite
      .prepare(
        `INSERT INTO gdpr_audit_log (admin_id, actie, afname_id, detail, tijdstip)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        invoer.adminId,
        invoer.actie,
        invoer.afnameId,
        invoer.detail ?? null,
        new Date().toISOString(),
      );
  } catch (err) {
    console.error("[audit] Wegschrijven van auditregel mislukt:", err);
  }
}

export interface AuditRegel {
  id: number;
  adminId: number | null;
  actie: string;
  afnameId: number | null;
  detail: string | null;
  tijdstip: string;
}

// Uitlezen voor controle en rapportage. Nieuwste eerst.
export function leesAuditLog(limiet = 200): AuditRegel[] {
  try {
    zorgVoorAuditTabel();
    const rijen = sqlite
      .prepare(
        `SELECT id, admin_id, actie, afname_id, detail, tijdstip
           FROM gdpr_audit_log ORDER BY id DESC LIMIT ?`,
      )
      .all(limiet) as Array<Record<string, any>>;
    return rijen.map((r) => ({
      id: r.id,
      adminId: r.admin_id ?? null,
      actie: r.actie,
      afnameId: r.afname_id ?? null,
      detail: r.detail ?? null,
      tijdstip: r.tijdstip,
    }));
  } catch (err) {
    console.error("[audit] Uitlezen van het audit-log mislukt:", err);
    return [];
  }
}
