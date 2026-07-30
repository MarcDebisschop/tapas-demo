// ---------------------------------------------------------------------------
// server/db-integriteit.ts
//
// Auditbevinding A-1 (hoog): "Geen foreign keys en geen indexen op kerntabellen".
// De audit stelde vast dat er dertien indexen bestonden, alle op randtabellen van
// losse instrumenten, en geen enkele op de kerntabellen (afnames, rapporten,
// credits, facturen, deelnemers). Verwijzingen tussen tabellen werden nergens
// door de databank afgedwongen.
//
// Dit bestand doet drie dingen, alle idempotent en veilig op een bestaande
// databank:
//
//   1. INDEXEN op de kolommen waarop de kerntabellen werkelijk bevraagd worden
//      (vreemde sleutels, statusvelden, tokens, e-mailadressen). Zonder index
//      leest SQLite de hele tabel; met index schaalt dat mee met het aantal
//      afnames in plaats van met de volledige historiek.
//
//   2. PRAGMA foreign_keys = ON, zodat elke verwijzing die in het schema staat
//      of nog toegevoegd wordt, ook echt afgedwongen wordt.
//
//   3. Een VERWIJZINGSCONTROLE die weeskinderen telt: rijen die verwijzen naar
//      een record dat niet (meer) bestaat. Dit is de eerlijke tussenstap: het
//      met terugwerkende kracht toevoegen van foreign-key-beperkingen op
//      bestaande tabellen vraagt in SQLite een volledige tabelherbouw, en dat is
//      een migratiebeslissing, geen randvoorwaarde. Tot die migratie is de
//      integriteit hier wél gemeten en zichtbaar in plaats van onbekend.
// ---------------------------------------------------------------------------

import type BetterSqlite3 from "better-sqlite3";

type Db = BetterSqlite3.Database;

/** Index-definities: [naam, tabel, kolom(men)]. */
const INDEXEN: Array<[string, string, string]> = [
  // Afnames: de tabel die bij vrijwel elke schermweergave bevraagd wordt.
  ["idx_afnames_organisatie", "afnames", "organisatie_id"],
  ["idx_afnames_status", "afnames", "status"],
  ["idx_afnames_instrument", "afnames", "instrument_id"],
  ["idx_afnames_deelnemer_email", "afnames", "deelnemer_email"],
  ["idx_afnames_invite_token", "afnames", "invite_token"],
  ["idx_afnames_created", "afnames", "created_at"],
  // Rapporten hangen één-op-één aan een afname en worden er altijd via opgezocht.
  ["idx_rapporten_afname", "rapporten", "afname_id"],
  // Creditlaag: saldo, transacties, betalingen, facturen, creditnota's.
  ["idx_credit_saldi_organisatie", "credit_saldi", "organisatie_id"],
  ["idx_credit_transacties_organisatie", "credit_transacties", "organisatie_id"],
  ["idx_credit_transacties_afname", "credit_transacties", "afname_id"],
  ["idx_betalingen_organisatie", "betalingen", "organisatie_id"],
  ["idx_betalingen_status", "betalingen", "status"],
  ["idx_facturen_organisatie", "facturen", "organisatie_id"],
  ["idx_facturen_biller", "facturen", "biller_entiteit_id"],
  ["idx_creditnotas_factuur", "creditnotas", "factuur_id"],
  // Deelnemers en hun persoonlijk dashboard.
  ["idx_deelnemers_email", "deelnemers", "email"],
  ["idx_deelnemers_dashboardtoken", "deelnemers", "dashboard_token"],
  ["idx_chat_berichten_deelnemer", "chat_berichten", "deelnemer_id"],
  // Sessies, licenties en toegangsrechten.
  ["idx_sessies_organisatie", "sessies", "organisatie_id"],
  ["idx_sessie_deelnemers_sessie", "sessie_deelnemers", "sessie_id"],
  ["idx_sessie_deelnemers_token", "sessie_deelnemers", "invite_token"],
  ["idx_licenties_klant", "licenties", "klant_email"],
  ["idx_toegangen_beheerder", "toegangen", "beheerder_id"],
  ["idx_beheerders_organisatie", "beheerders", "organisatie_id"],
];

/**
 * Legt de indexen op de kerntabellen aan. Volledig idempotent: bestaande
 * indexen blijven, ontbrekende tabellen worden stil overgeslagen zodat een
 * nieuwe of afwijkende databank de opstart nooit blokkeert.
 */
export function zetKernIndexen(sqlite: Db): { aangelegd: number; overgeslagen: number } {
  let aangelegd = 0;
  let overgeslagen = 0;
  for (const [naam, tabel, kolom] of INDEXEN) {
    try {
      sqlite.exec(`CREATE INDEX IF NOT EXISTS ${naam} ON ${tabel}(${kolom});`);
      aangelegd += 1;
    } catch {
      overgeslagen += 1;
    }
  }
  return { aangelegd, overgeslagen };
}

/** Zet de afdwinging van verwijzingen aan. */
export function zetVerwijzingsafdwinging(sqlite: Db): boolean {
  try {
    sqlite.pragma("foreign_keys = ON");
    const uit = sqlite.pragma("foreign_keys", { simple: true });
    return uit === 1 || uit === true;
  } catch {
    return false;
  }
}

/** Relaties die we controleren: [kindtabel, kindkolom, oudertabel, ouderkolom]. */
const RELATIES: Array<[string, string, string, string]> = [
  ["rapporten", "afname_id", "afnames", "id"],
  ["afnames", "organisatie_id", "organisaties", "id"],
  ["credit_saldi", "organisatie_id", "organisaties", "id"],
  ["credit_transacties", "organisatie_id", "organisaties", "id"],
  ["credit_transacties", "afname_id", "afnames", "id"],
  ["betalingen", "organisatie_id", "organisaties", "id"],
  ["facturen", "organisatie_id", "organisaties", "id"],
  ["facturen", "biller_entiteit_id", "biller_entiteiten", "id"],
  ["creditnotas", "factuur_id", "facturen", "id"],
  ["chat_berichten", "deelnemer_id", "deelnemers", "id"],
  ["sessie_deelnemers", "sessie_id", "sessies", "id"],
  ["toegangen", "beheerder_id", "beheerders", "id"],
];

export type Weeskind = { kind: string; kolom: string; ouder: string; aantal: number };

/**
 * Telt per relatie de rijen die naar een niet-bestaand ouderrecord verwijzen.
 * NULL geldt niet als weeskind: een afname zonder organisatie is geldig.
 * Geeft alleen de relaties terug waar écht iets fout zit.
 */
export function controleerVerwijzingen(sqlite: Db): Weeskind[] {
  const gevonden: Weeskind[] = [];
  for (const [kind, kolom, ouder, ouderKolom] of RELATIES) {
    try {
      const rij = sqlite
        .prepare(
          `SELECT COUNT(*) AS n FROM ${kind} k
           WHERE k.${kolom} IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM ${ouder} o WHERE o.${ouderKolom} = k.${kolom})`,
        )
        .get() as { n: number };
      if (rij && rij.n > 0) gevonden.push({ kind, kolom, ouder, aantal: rij.n });
    } catch {
      // Ontbrekende tabel of kolom: stil overslaan, nooit de opstart blokkeren.
    }
  }
  return gevonden;
}

/**
 * Eén aanroep bij de opstart: indexen, afdwinging en een meldregel over de
 * verwijzingsintegriteit. Geen persoonsgegevens in de melding (bevinding S-1):
 * enkel tabelnamen en aantallen.
 */
export function borgDatabankIntegriteit(sqlite: Db): void {
  const { aangelegd, overgeslagen } = zetKernIndexen(sqlite);
  const afgedwongen = zetVerwijzingsafdwinging(sqlite);
  const wezen = controleerVerwijzingen(sqlite);
  const totaal = wezen.reduce((s, w) => s + w.aantal, 0);
  console.log(
    `[tapas] Databankintegriteit: ${aangelegd} kernindexen actief` +
      (overgeslagen ? ` (${overgeslagen} overgeslagen)` : "") +
      `, verwijzingsafdwinging ${afgedwongen ? "aan" : "uit"}, ` +
      (totaal === 0
        ? "geen verweesde verwijzingen"
        : `${totaal} verweesde verwijzing(en): ${wezen
            .map((w) => `${w.kind}.${w.kolom} -> ${w.ouder} (${w.aantal})`)
            .join(", ")}`),
  );
}
