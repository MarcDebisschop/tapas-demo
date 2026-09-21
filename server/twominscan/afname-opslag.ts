// =============================================================================
// server/twominscan/afname-opslag.ts: bewaarde 2MINSCAN-afnames voor het teamwiel
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
import { sqlite, storage } from "../storage";
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
  /**
   * De afgeleide uitkomst waarmee het rapport opnieuw op te bouwen valt: de
   * kleurscores, de I/E-stand en de EG-code. Null bij een rij van voor deze
   * uitbreiding, en dan valt er enkel een wielpositie te tonen.
   */
  rapport: RapportKern | null;
}

/**
 * Wat een begeleider nodig heeft om het rapport van een lid opnieuw te tonen.
 * Dit zijn afgeleide waarden, geen antwoorden: de vier kleurscores, de I/E-stand
 * en de codes die naar het profiel wijzen. De gegeven antwoorden, de losse
 * itemscores en de portretfoto blijven ook nu buiten de databank.
 */
export interface RapportKern {
  score: { blauw: number; groen: number; geel: number; rood: number };
  ie: { uitkomst: string; label: string; verschil: number; xStand: string };
  egCode: string;
  egCodePositief: string;
  minSegment: string | null;
  profielCode: string;
  exact: boolean;
}

const rapportKernSchema = z.object({
  score: z.object({
    blauw: z.number(),
    groen: z.number(),
    geel: z.number(),
    rood: z.number(),
  }),
  ie: z.object({
    uitkomst: z.string().max(40),
    label: z.string().max(80),
    verschil: z.number(),
    xStand: z.enum(["II", "EE", "X"]),
  }),
  egCode: z.string().max(24),
  egCodePositief: z.string().max(24),
  minSegment: z.string().max(4).nullable(),
  profielCode: z.string().max(24),
  exact: z.boolean(),
}).strict();

// De 24 wielposities zelf staan in de client (client/src/temperamentenwiel/
// posities.ts), de bron van de speelmat. De server spiegelt die lijst NIET,
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

// Een lid van een traject vult de 2MINSCAN in via zijn eigen uitnodigingslink.
// Dan mag het bewaren niet van een knop in het rapport afhangen: die knop stond
// achter het rapport, en een lid van een traject ziet dat rapport niet. De naam
// en de organisatie komen hier uit de uitnodiging zelf, nooit uit de body, want
// de voortgang van een traject zoekt de scan op precies die twee terug.
const uitnodigingSchema = z.object({
  wielpositie: z.string().trim().regex(WIELPOSITIE),
  rapport: rapportKernSchema.optional(),
  egCode: z.string().trim().max(24).optional(),
  rol: z.string().trim().max(120).optional(),
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
  // De kolom kwam er later bij, toen een begeleider het rapport van een lid
  // moest kunnen nalezen. Een bestaande databank krijgt ze hier, want deze
  // tabel staat buiten de migraties.
  const kolommen = sqlite
    .prepare(`PRAGMA table_info(twominscan_afnames)`)
    .all()
    .map((k: any) => String(k.name));
  if (!kolommen.includes("rapport_json")) {
    sqlite.exec(`ALTER TABLE twominscan_afnames ADD COLUMN rapport_json TEXT`);
  }
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
    rapport: leesRapportKern(rij.rapport_json),
  };
}

/** Leest de bewaarde uitkomst terug en weigert een rij die niet meer klopt. */
function leesRapportKern(ruw: unknown): RapportKern | null {
  if (typeof ruw !== "string" || !ruw.trim()) return null;
  try {
    const ontleed = rapportKernSchema.safeParse(JSON.parse(ruw));
    return ontleed.success ? (ontleed.data as RapportKern) : null;
  } catch {
    return null;
  }
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
  rapport?: RapportKern | null;
}): BewaardeAfname {
  if (!sqlite) throw new Error("Geen databank beschikbaar.");
  zorgVoorTabel();
  const bewaardOp = new Date().toISOString();
  const info = sqlite
    .prepare(
      `INSERT INTO twominscan_afnames
         (organisatie, naam, rol, eg_code, wielpositie, taal, datum, bewaard_op, rapport_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      gegevens.rapport ? JSON.stringify(gegevens.rapport) : null,
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
    rapport: gegevens.rapport ?? null,
  };
}

/**
 * De laatste bewaarde afname van één persoon binnen één organisatie. Het
 * trajectscherm zoekt zo het rapport van een lid terug, want de 2MINSCAN draagt
 * geen token in deze tabel.
 */
export function leesAfnameVoor(naam: string, organisatie: string): BewaardeAfname | null {
  if (!sqlite) return null;
  zorgVoorTabel();
  const rij = sqlite
    .prepare(
      `SELECT * FROM twominscan_afnames
         WHERE naam = ? COLLATE NOCASE AND organisatie = ? COLLATE NOCASE
         ORDER BY bewaard_op DESC, id DESC LIMIT 1`,
    )
    .get(naam.trim(), organisatie.trim());
  return rij ? naarAfname(rij) : null;
}

/**
 * Verwijdert eerder bewaarde rijen van dezelfde persoon binnen dezelfde
 * organisatie. Wie zijn scan opnieuw doet, hoort één rij te houden en niet twee
 * die elkaar tegenspreken in een teamwiel.
 */
export function verwijderAfnamesVoor(naam: string, organisatie: string): number {
  if (!sqlite) return 0;
  zorgVoorTabel();
  const info = sqlite
    .prepare(
      `DELETE FROM twominscan_afnames
         WHERE naam = ? COLLATE NOCASE AND organisatie = ? COLLATE NOCASE`,
    )
    .run(naam.trim(), organisatie.trim());
  return info.changes;
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

  // Afronden via een uitnodiging: de scan wordt bewaard zonder dat de deelnemer
  // er iets voor moet doen, en de uitnodiging gaat op voltooid. Zo ziet de
  // begeleider in de voortgang van zijn traject dat dit lid klaar is, ook al
  // krijgt dat lid zelf geen rapport te zien.
  app.post(
    "/api/twominscan/uitnodiging/:token/resultaat",
    async (req: Request, res: Response) => {
      const ontleed = uitnodigingSchema.safeParse(req.body);
      if (!ontleed.success) {
        return res.status(400).json({
          error: ontleed.error.errors[0]?.message ?? "Ongeldige gegevens voor het bewaren.",
        });
      }
      const token = String(req.params.token ?? "").trim();
      if (!token) return res.status(400).json({ error: "Er is geen uitnodiging meegegeven." });
      try {
        const afname = await storage.getAfnameByToken(token);
        if (!afname) return res.status(404).json({ error: "Deze uitnodiging bestaat niet." });
        const naam = (afname.name ?? "").trim();
        if (!naam) {
          return res.status(409).json({ error: "Deze uitnodiging heeft geen naam." });
        }
        const organisatie = (afname.company ?? "").trim();
        verwijderAfnamesVoor(naam, organisatie);
        const bewaard = bewaarAfname({
          naam,
          organisatie,
          rol: ontleed.data.rol ?? (afname.role ?? ""),
          egCode: ontleed.data.egCode,
          wielpositie: ontleed.data.wielpositie,
          taal: ontleed.data.taal,
          datum: ontleed.data.datum,
          rapport: (ontleed.data.rapport as RapportKern | undefined) ?? null,
        });
        if (afname.status !== "voltooid") {
          await storage.updateAfname(afname.id, {
            status: "voltooid",
            completedAt: new Date().toISOString(),
          } as any);
        }
        return res.status(201).json({ afname: bewaard });
      } catch (e: any) {
        console.error("[twominscan] afronden via uitnodiging mislukt:", e?.message ?? e);
        return res.status(500).json({ error: "Bewaren mislukt." });
      }
    },
  );

  // Lezen: enkel voor een aangemelde beheerder, dit is een lijst met namen.
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
