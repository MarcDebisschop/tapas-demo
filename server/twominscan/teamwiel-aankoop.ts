// =============================================================================
// server/twominscan/teamwiel-aankoop.ts — een temperamentenwiel kost credits
// -----------------------------------------------------------------------------
// Waarom deze module bestaat
//   Het teamwiel van de 2MINSCAN was tot nu gratis: wie de pagina bereikte,
//   kreeg een volledig energetisch teamprofiel van tien bladen zonder dat er
//   iets werd afgeboekt. Een teamwiel is nochtans een eigen product. Sinds de
//   beslissing kost één temperamentenwiel het tarief uit
//   `shared/twominscan-teamwiel.ts` (vandaag vier credits).
//
//   De knop op de teamwielpagina verbergen zou niet volstaan: wie de route
//   kent, komt er dan nog. Daarom staat de afdwinging hier, op de server, en
//   levert de pagina het rapport pas nadat deze route de aankoop bevestigt.
//
// Idempotentie — waarom een sleutel en niet een teller
//   Een coach opent hetzelfde teamwiel meermaals: hij bekijkt het, drukt het af
//   in het Nederlands, daarna in het Frans, komt de dag erna terug. Elke keer
//   opnieuw afboeken zou hetzelfde product meermaals verkopen. Daarom wordt per
//   organisatie een SLEUTEL bewaard: de gesorteerde lijst van deelnemers met hun
//   wielpositie, gehasht. Dezelfde ploeg = dezelfde sleutel = geen tweede
//   afboeking, in welke taal ook. Een andere samenstelling (iemand erbij, iemand
//   eruit) is een ander teamwiel en kost dus opnieuw.
//
// Wie betaalt
//   De organisatie van de aangemelde beheerder (server/scope-guard.ts). De
//   hoofdbeheerder (prior) heeft geen creditrekening: hij is het platform zelf
//   en niet een klant. Voor die scope wordt het wiel geleverd zonder afboeking,
//   maar wel geregistreerd, zodat het spoor bestaat.
//
// Wat er bewaard wordt (dataminimalisatie, AVG art. 5.1.c)
//   De sleutel (een hash), het aantal deelnemers, het tarief, het tijdstip en
//   wie het kocht. GEEN namen: de namen staan al in `twominscan_afnames` en
//   horen niet nog eens in een aankooptabel.
// =============================================================================
import type { Express, Request, Response } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlite, storage, CreditError } from "../storage";
import { vereisScope, scopeVanVerzoek } from "../scope-guard";
import { adminIdVanSessie } from "../admin-guard";
import { teamwielCredits } from "@shared/twominscan-teamwiel";

const WIELPOSITIE = /^\d{2,3}-\d{2,3}$/;

const deelnemerSchema = z.object({
  naam: z.string().trim().min(1).max(120),
  wielpositie: z.string().trim().regex(WIELPOSITIE),
});

const aankoopSchema = z.object({
  deelnemers: z.array(deelnemerSchema).min(2).max(60),
  // true = enkel kijken of dit wiel al betaald is; er wordt niets afgeboekt.
  controleerAlleen: z.boolean().optional(),
});

let tabelKlaar = false;

function zorgVoorTabel(): void {
  if (tabelKlaar || !sqlite) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS twominscan_teamwiel_aankopen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organisatie_id INTEGER NOT NULL,
      sleutel TEXT NOT NULL,
      aantal_deelnemers INTEGER NOT NULL,
      credits INTEGER NOT NULL,
      beheerder_id INTEGER,
      aangekocht_op TEXT NOT NULL
    )
  `);
  sqlite.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_teamwiel_aankoop_sleutel
       ON twominscan_teamwiel_aankopen (organisatie_id, sleutel)`,
  );
  tabelKlaar = true;
}

/**
 * De sleutel van één teamwiel: de deelnemers, elk als "naam|wielpositie",
 * genormaliseerd (kleine letters, samengedrukte spaties), gesorteerd en gehasht.
 * Sorteren maakt de sleutel onafhankelijk van de invoerorde; de taal zit er
 * bewust niet in, want NL/FR/EN zijn hetzelfde wiel.
 */
export function teamwielSleutel(deelnemers: { naam: string; wielpositie: string }[]): string {
  const regels = deelnemers
    .map((d) => `${d.naam.trim().toLowerCase().replace(/\s+/g, " ")}|${d.wielpositie.trim()}`)
    .sort();
  return createHash("sha256").update(regels.join("\n")).digest("hex").slice(0, 40);
}

function leesAankoop(organisatieId: number, sleutel: string): { credits: number; aangekochtOp: string } | null {
  if (!sqlite) return null;
  zorgVoorTabel();
  const rij = sqlite
    .prepare(
      `SELECT credits, aangekocht_op FROM twominscan_teamwiel_aankopen
         WHERE organisatie_id = ? AND sleutel = ?`,
    )
    .get(organisatieId, sleutel) as { credits: number; aangekocht_op: string } | undefined;
  if (!rij) return null;
  return { credits: Number(rij.credits), aangekochtOp: String(rij.aangekocht_op) };
}

function bewaarAankoop(
  organisatieId: number,
  sleutel: string,
  aantalDeelnemers: number,
  credits: number,
  beheerderId: number | null,
): string {
  if (!sqlite) throw new Error("Geen databank beschikbaar.");
  zorgVoorTabel();
  const nu = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO twominscan_teamwiel_aankopen
         (organisatie_id, sleutel, aantal_deelnemers, credits, beheerder_id, aangekocht_op)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(organisatieId, sleutel, aantalDeelnemers, credits, beheerderId, nu);
  return nu;
}

export function registerTwominscanTeamwielAankoopRoutes(app: Express): void {
  // Het tarief opvragen. Open: een tarief is publieke informatie en de pagina
  // moet het kunnen tonen voor iemand aanmeldt.
  app.get("/api/twominscan/teamwiel/tarief", (_req: Request, res: Response) => {
    res.json({ credits: teamwielCredits() });
  });

  // De aankoop zelf. Achter `vereisScope`: er moet een betalende partij zijn.
  app.post(
    "/api/twominscan/teamwiel/aankoop",
    vereisScope,
    async (req: Request, res: Response) => {
      const ontleed = aankoopSchema.safeParse(req.body);
      if (!ontleed.success) {
        return res.status(400).json({
          error:
            ontleed.error.errors[0]?.message ??
            "Een teamwiel vraagt minstens twee deelnemers met een geldige wielpositie.",
        });
      }
      const { deelnemers, controleerAlleen } = ontleed.data;
      const sleutel = teamwielSleutel(deelnemers);
      const kost = teamwielCredits();
      const scope = scopeVanVerzoek(req);

      // De hoofdbeheerder heeft geen creditrekening: het platform verkoopt niet
      // aan zichzelf. Wel geleverd, niets afgeboekt.
      if (scope.soort !== "organisatie") {
        return res.json({
          status: "geen-verrekening",
          credits: 0,
          tarief: kost,
          toelichting: "Als hoofdbeheerder wordt er geen credit afgeboekt.",
        });
      }

      const organisatieId = scope.organisatieId;
      const bestaand = leesAankoop(organisatieId, sleutel);
      if (bestaand) {
        const saldo = await storage.getSaldo(organisatieId);
        return res.json({
          status: "al-aangekocht",
          credits: 0,
          tarief: kost,
          aangekochtOp: bestaand.aangekochtOp,
          saldo: saldo.beschikbaar,
        });
      }

      if (controleerAlleen) {
        const saldo = await storage.getSaldo(organisatieId);
        return res.json({
          status: "te-koop",
          credits: 0,
          tarief: kost,
          saldo: saldo.beschikbaar,
          voldoende: saldo.beschikbaar >= kost,
        });
      }

      try {
        const saldo = await storage.verbruikVoorProduct(
          organisatieId,
          kost,
          `Temperamentenwiel (teamwiel 2MINSCAN, ${deelnemers.length} deelnemers)`,
        );
        const aangekochtOp = bewaarAankoop(
          organisatieId,
          sleutel,
          deelnemers.length,
          kost,
          adminIdVanSessie(req),
        );
        return res.status(201).json({
          status: "aangekocht",
          credits: kost,
          tarief: kost,
          aangekochtOp,
          saldo: saldo.beschikbaar,
        });
      } catch (e: any) {
        if (e instanceof CreditError) {
          const saldo = await storage.getSaldo(organisatieId);
          return res.status(402).json({
            error: e.message,
            status: "onvoldoende-credits",
            tarief: kost,
            saldo: saldo.beschikbaar,
          });
        }
        console.error("[twominscan] teamwiel-aankoop mislukt:", e?.message ?? e);
        return res.status(500).json({ error: "De aankoop van het teamwiel is niet gelukt." });
      }
    },
  );
}
