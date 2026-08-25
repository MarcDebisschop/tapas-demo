// =============================================================================
// server/twominscan/afname-opslag.ts — bewaarde 2MINSCAN-afnames voor het teamwiel
// -----------------------------------------------------------------------------
// Waarom deze module bestaat
//   De 2MINSCAN werd tot nu volledig in de browser berekend en nergens bewaard.
//   Wie een teamwiel wilde maken, typte de wielposities daarna met de hand over.
//   Deze module bewaart per afname enkel wat een teamwiel nodig heeft, zodat de
//   teamwielpagina de deelnemers automatisch kan inladen.
//
// Wat er bewaard wordt (dataminimalisatie, AVG art. 5.1.c)
//   naam, optioneel rol en organisatie, de EG-code, de wielpositie, de taal en
//   de afnamedatum. NIET bewaard: de gegeven antwoorden, de losse scores, een
//   portretfoto of enige tekst uit het rapport. Een bewaarde rij is dus niet
//   genoeg om het individuele rapport te reconstrueren.
//
// Toegang
//   Bewaren mag zonder aanmelding: de deelnemer rondt zijn eigen afname af en
//   kiest zelf of die in de teamlijst mag. Lezen en verwijderen vraagt een
//   beheerderssessie (server/admin-guard.ts), want dat is een lijst met namen.
//
// Tabel
//   Eigen SQLite-tabel `twominscan_afnames`, lazy aangemaakt volgens het
//   bewezen patroon in deze codebase (server/instrument-beschikbaarheid.ts,
//   server/gids-manager.ts): geen Drizzle-schema, geen migratie, en dus geen
//   invloed op bestaande tabellen of afnamepaden.
// =============================================================================
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { sqlite } from "../storage";
import { vereisAdmin } from "../admin-guard";

export interface BewaardeAfname {
  id: number;
  organisatie: string;
  naam: string;
  rol: string;
  egCode: string;
  wielpositie: string;
  taal: string;
  datum: string;
  bewaardOp: string;
}

// De 24 wielposities zelf staan in de client (client/src/temperamentenwiel/
// posities.ts), de bron van de speelmat. De server spiegelt die lijst NIET —
// dat zou twee waarheden geven. Ze toetst enkel de vorm: twee getallen met een
// koppelteken, zoals "24-44" of "128-148". De teamwielpagina laat daarna alleen
// posities door die in de echte lijst van 24 staan.
const WIELPOSITIE = /^\d{2,3}-\d{2,3}$/;

const bewaarSchema = z.object({
  naam: z.string().trim().min(1).max(120),
  wielpositie: z.string().trim().regex(WIELPOSITIE),
  organisatie: z.string().trim().max(120).optional(),
  rol: z.string().trim().max(120).optional(),
  egCode: z.string().trim().max(24).optional(),
  taal: z.enum(["nl", "fr", "en", "es", "ru"]).optional(),
  datum: z.string().trim().max(40).optional(),
});

let tabelKlaar = false;

function zorgVoorTabel(): void {
  if (tabelKlaar || !sqlite) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS twominscan_afnames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organisatie TEXT NOT NULL DEFAULT '',
      naam TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT '',
      eg_code TEXT NOT NULL DEFAULT '',
      wielpositie TEXT NOT NULL,
      taal TEXT NOT NULL DEFAULT 'nl',
      datum TEXT NOT NULL DEFAULT '',
      bewaard_op TEXT NOT NULL
    )
  `);
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_twominscan_afnames_org ON twominscan_afnames (organisatie, bewaard_op)`,
  );
  tabelKlaar = true;
}

function naarAfname(rij: any): BewaardeAfname {
  return {
    id: Number(rij.id),
    organisatie: String(rij.organisatie ?? ""),
    naam: String(rij.naam ?? ""),
    rol: String(rij.rol ?? ""),
    egCode: String(rij.eg_code ?? ""),
    wielpositie: String(rij.wielpositie ?? ""),
    taal: String(rij.taal ?? "nl"),
    datum: String(rij.datum ?? ""),
    bewaardOp: String(rij.bewaard_op ?? ""),
  };
}

/** Bewaart één afname en geeft de bewaarde rij terug. */
export function bewaarAfname(gegevens: {
  naam: string;
  wielpositie: string;
  organisatie?: string;
  rol?: string;
  egCode?: string;
  taal?: string;
  datum?: string;
}): BewaardeAfname {
  if (!sqlite) throw new Error("Geen databank beschikbaar.");
  zorgVoorTabel();
  const bewaardOp = new Date().toISOString();
  const info = sqlite
    .prepare(
      `INSERT INTO twominscan_afnames
         (organisatie, naam, rol, eg_code, wielpositie, taal, datum, bewaard_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      gegevens.organisatie?.trim() ?? "",
      gegevens.naam.trim(),
      gegevens.rol?.trim() ?? "",
      gegevens.egCode?.trim() ?? "",
      gegevens.wielpositie.trim(),
      gegevens.taal ?? "nl",
      gegevens.datum?.trim() ?? "",
      bewaardOp,
    );
  return {
    id: Number(info.lastInsertRowid),
    organisatie: gegevens.organisatie?.trim() ?? "",
    naam: gegevens.naam.trim(),
    rol: gegevens.rol?.trim() ?? "",
    egCode: gegevens.egCode?.trim() ?? "",
    wielpositie: gegevens.wielpositie.trim(),
    taal: gegevens.taal ?? "nl",
    datum: gegevens.datum?.trim() ?? "",
    bewaardOp,
  };
}

/** Bewaarde afnames, nieuwste eerst. Zonder organisatie: alle afnames. */
export function leesAfnames(organisatie?: string, limiet = 200): BewaardeAfname[] {
  if (!sqlite) return [];
  zorgVoorTabel();
  const max = Math.min(Math.max(Math.trunc(limiet) || 0, 1), 500);
  const rijen = organisatie && organisatie.trim()
    ? sqlite
        .prepare(
          `SELECT * FROM twominscan_afnames
             WHERE organisatie = ? COLLATE NOCASE
             ORDER BY bewaard_op DESC, id DESC LIMIT ?`,
        )
        .all(organisatie.trim(), max)
    : sqlite
        .prepare(`SELECT * FROM twominscan_afnames ORDER BY bewaard_op DESC, id DESC LIMIT ?`)
        .all(max);
  return (rijen as any[]).map(naarAfname);
}

/** De organisaties waarvoor er afnames bewaard zijn, met hun aantal. */
export function leesOrganisaties(): { organisatie: string; aantal: number }[] {
  if (!sqlite) return [];
  zorgVoorTabel();
  const rijen = sqlite
    .prepare(
      `SELECT organisatie, COUNT(*) AS aantal FROM twominscan_afnames
         GROUP BY organisatie COLLATE NOCASE ORDER BY aantal DESC, organisatie ASC`,
    )
    .all() as Array<{ organisatie: string; aantal: number }>;
  return rijen.map((r) => ({ organisatie: String(r.organisatie ?? ""), aantal: Number(r.aantal) }));
}

/** Verwijdert één bewaarde afname. Geeft true als er iets verwijderd is. */
export function verwijderAfname(id: number): boolean {
  if (!sqlite) return false;
  zorgVoorTabel();
  const info = sqlite.prepare(`DELETE FROM twominscan_afnames WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function registerTwominscanAfnameRoutes(app: Express): void {
  // Bewaren: de deelnemer rondt zijn eigen afname af en kiest zelf of ze in de
  // teamlijst mag. Er wordt niets over eerdere afnames teruggegeven.
  app.post("/api/twominscan/afname", (req: Request, res: Response) => {
    const ontleed = bewaarSchema.safeParse(req.body);
    if (!ontleed.success) {
      return res.status(400).json({
        error: ontleed.error.errors[0]?.message ?? "Ongeldige gegevens voor het bewaren.",
      });
    }
    try {
      const bewaard = bewaarAfname(ontleed.data);
      return res.status(201).json({ afname: bewaard });
    } catch (e: any) {
      console.error("[twominscan] afname bewaren mislukt:", e?.message ?? e);
      return res.status(500).json({ error: "Bewaren mislukt." });
    }
  });

  // Lezen: enkel voor een aangemelde beheerder — dit is een lijst met namen.
  app.get("/api/twominscan/afnames", vereisAdmin, (req: Request, res: Response) => {
    const organisatie = typeof req.query.organisatie === "string" ? req.query.organisatie : "";
    const limiet = Number(req.query.limiet ?? 200);
    return res.json({
      afnames: leesAfnames(organisatie, Number.isFinite(limiet) ? limiet : 200),
      organisaties: leesOrganisaties(),
    });
  });

  // Verwijderen: recht op vergetelheid, ook voor deze kleine lijst.
  app.delete("/api/twominscan/afname/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Ongeldig id." });
    return res.json({ verwijderd: verwijderAfname(id) });
  });
}
