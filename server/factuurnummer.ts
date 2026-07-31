/**
 * server/factuurnummer.ts
 *
 * Auditbevinding F-1 (ernst midden, "Race condition op de factuurnummering").
 *
 * Het probleem bestond uit twee delen:
 *
 *   1. Het volgende factuurnummer werd bepaald door ALLE facturen op te halen, het
 *      hoogste nummer te zoeken en daar één bij op te tellen. Tussen het lezen en
 *      het wegschrijven zat geen slot. Twee gelijktijdige aankopen konden dus
 *      hetzelfde nummer krijgen (de databank weigert dat dankzij de UNIQUE-regel,
 *      wat betekent dat de tweede aankoop klapt) of een gat in de reeks maken.
 *      Boekhoudkundig is beide bezwaarlijk.
 *   2. Dezelfde logica stond twee keer, in server/storage.ts en in
 *      server/prive-aankoop/routes.ts, met alle kans om uiteen te lopen.
 *
 * De oplossing is een eigen tellertabel plus een echte transactie:
 *
 *   - `factuur_reeks(prefix, jaar, laatste)` houdt per facturerende entiteit en per
 *     jaar het laatst uitgegeven nummer bij.
 *   - Bij de eerste aanvraag voor een prefix/jaar wordt de teller éénmalig
 *     bijgezet op basis van de bestaande facturen, zodat een bestaande reeks
 *     gewoon doorloopt en er nooit een nummer hergebruikt wordt.
 *   - Het verhogen en uitlezen gebeurt in één `BEGIN IMMEDIATE`-transactie van
 *     better-sqlite3. SQLite serialiseert schrijvers, dus twee gelijktijdige
 *     aanvragen krijgen onvermijdelijk twee opeenvolgende nummers.
 *
 * Deze module is vanaf nu de ENIGE plaats waar een factuurnummer ontstaat.
 */

import { sqlite } from "./storage";

/** Eenmalige aanmaak van de tellertabel. Idempotent. */
function zorgVoorTabel(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS factuur_reeks (
      prefix TEXT NOT NULL,
      jaar INTEGER NOT NULL,
      laatste INTEGER NOT NULL,
      PRIMARY KEY (prefix, jaar)
    );
  `);
}

/**
 * Hoogste nummer dat al in de facturentabel staat voor deze prefix en dit jaar.
 * Wordt enkel gebruikt om de teller de eerste keer bij te zetten.
 */
function hoogsteBestaande(prefix: string, jaar: number): number {
  const zoek = `${prefix}-${jaar}-`;
  const rijen = sqlite
    .prepare(`SELECT factuurnummer FROM facturen WHERE factuurnummer LIKE ?`)
    .all(`${zoek}%`) as Array<{ factuurnummer: string }>;
  let max = 0;
  for (const r of rijen) {
    const n = parseInt(r.factuurnummer.slice(zoek.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max;
}

/**
 * Geeft het volgende factuurnummer in de vorm PREFIX-JAAR-NNNN en legt meteen
 * vast dat dit nummer uitgegeven is. Ondeelbaar: bij gelijktijdige aanroepen
 * krijgt elke aanroeper een eigen, opeenvolgend nummer.
 */
export function neemFactuurnummer(prefix: string, jaar?: number): string {
  zorgVoorTabel();
  const j = jaar ?? new Date().getFullYear();

  const transactie = sqlite.transaction((p: string, jr: number): number => {
    const bestaand = sqlite
      .prepare(`SELECT laatste FROM factuur_reeks WHERE prefix = ? AND jaar = ?`)
      .get(p, jr) as { laatste: number } | undefined;

    if (!bestaand) {
      // Eerste keer voor deze prefix/dit jaar: begin waar de bestaande facturen
      // eindigen, zodat een reeds gebruikte reeks nooit opnieuw uitgegeven wordt.
      const start = hoogsteBestaande(p, jr);
      sqlite
        .prepare(`INSERT INTO factuur_reeks (prefix, jaar, laatste) VALUES (?, ?, ?)`)
        .run(p, jr, start + 1);
      return start + 1;
    }

    const volgende = bestaand.laatste + 1;
    sqlite
      .prepare(`UPDATE factuur_reeks SET laatste = ? WHERE prefix = ? AND jaar = ?`)
      .run(volgende, p, jr);
    return volgende;
  });

  // `immediate` neemt de schrijfvergrendeling meteen bij het openen van de
  // transactie, in plaats van pas bij de eerste schrijfopdracht. Daardoor kan
  // geen tweede aanvrager tussen het lezen en het verhogen glippen.
  const nummer = transactie.immediate(prefix, j) as number;
  return `${prefix}-${j}-${String(nummer).padStart(4, "0")}`;
}
