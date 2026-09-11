/**
 * server/hdd/teamanalyse-routes.ts
 *
 * De 2MINSCAN-teamanalyse binnen een HDD-traject.
 * ---------------------------------------------------------------------------
 *   POST /api/hdd/trajecten/:id/teamanalyse-2ms       - de analyse als JSON
 *   POST /api/hdd/trajecten/:id/teamanalyse-2ms/pdf   - dezelfde analyse als PDF
 *
 * De deelnemers komen uit de 2MINSCAN-afnames van de board members van het
 * traject (zie ./bronnen.ts). De body mag met `deelnemers` overschrijven, net
 * zoals `leden` dat mag op de rapportroutes: handig voor een proefdraai, maar
 * nooit de standaardweg.
 *
 * De rekenkern en de PDF-opmaak komen uit het andere spoor:
 *
 *   server/twominscan/teamanalyse.ts
 *     export function bouwTeamanalyse(deelnemers): TeamanalyseResultaat
 *     export const TEAMANALYSE_MIN_DEELNEMERS = 3
 *   server/hdd/pdf/teamanalyse-2ms.ts
 *     export async function renderTeamanalysePdf(input): Promise<Buffer>
 *
 * Waarom worden die twee modules hier met een samengestelde padnaam geladen en
 * niet met een gewone import bovenaan? Ze bestaan op dit ogenblik nog niet: het
 * spoor dat ze schrijft loopt parallel. Een gewone import zou de typecontrole
 * laten struikelen en, erger, de hele server niet meer laten opstarten omdat de
 * module bij het inlezen al ontbreekt. Met een import die pas in de afhandeling
 * gebeurt, blijft de rest van HDD gewoon werken en geeft alleen deze route een
 * duidelijke 503 zolang de rekenkern er niet is. Zodra de bestanden er staan,
 * werkt de route zonder verdere wijziging: het contract hierboven is het
 * afgesproken contract.
 */

import type { Express } from "express";
import { hddStorage } from "./storage";
import { teamanalyseDeelnemers } from "./bronnen";
import { z } from "zod";

// Het contract van het andere spoor, zoals afgesproken. TeamanalyseResultaat
// wordt hier niet nagebouwd: HDD geeft het resultaat door zoals het komt.
type TeamanalyseResultaat = unknown;

interface TeamanalyseDeelnemer {
  naam: string;
  rol?: string;
  egCode: string;
  wielpositie: string;
}

const deelnemersSchema = z.array(
  z.object({
    naam: z.string(),
    rol: z.string().optional(),
    egCode: z.string(),
    wielpositie: z.string(),
  }),
);

/** Pad samengesteld op looptijd; zie de kopnoot voor het waarom. */
const PAD_TEAMANALYSE = ["..", "twominscan", "teamanalyse"].join("/");
const PAD_TEAMANALYSE_PDF = [".", "pdf", "teamanalyse-2ms"].join("/");

interface Rekenkern {
  bouwTeamanalyse(deelnemers: TeamanalyseDeelnemer[]): TeamanalyseResultaat;
  TEAMANALYSE_MIN_DEELNEMERS: number;
}

class KernOntbreekt extends Error {}

async function laadRekenkern(): Promise<Rekenkern> {
  try {
    const mod: any = await import(PAD_TEAMANALYSE);
    if (typeof mod?.bouwTeamanalyse !== "function") throw new Error("bouwTeamanalyse ontbreekt");
    return {
      bouwTeamanalyse: mod.bouwTeamanalyse,
      TEAMANALYSE_MIN_DEELNEMERS: Number(mod.TEAMANALYSE_MIN_DEELNEMERS ?? 3),
    };
  } catch (err) {
    throw new KernOntbreekt(
      `De 2MINSCAN-teamanalyse is nog niet beschikbaar: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function laadPdfRenderer(): Promise<
  (input: {
    company: string;
    boardLabel: string;
    date: string;
    confidentiality: string;
    analyse: TeamanalyseResultaat;
  }) => Promise<Buffer>
> {
  try {
    const mod: any = await import(PAD_TEAMANALYSE_PDF);
    if (typeof mod?.renderTeamanalysePdf !== "function") {
      throw new Error("renderTeamanalysePdf ontbreekt");
    }
    return mod.renderTeamanalysePdf;
  } catch (err) {
    throw new KernOntbreekt(
      `De PDF van de 2MINSCAN-teamanalyse is nog niet beschikbaar: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * De deelnemerslijst: uit de body wanneer die er staat, anders uit de
 * 2MINSCAN-afnames van de board members van dit traject.
 */
function leesDeelnemers(
  trajectId: number,
  body: unknown,
): { ok: true; deelnemers: TeamanalyseDeelnemer[] } | { ok: false; fout: string } {
  const uitBody = (body as { deelnemers?: unknown })?.deelnemers;
  if (uitBody !== undefined) {
    const parsed = deelnemersSchema.safeParse(uitBody);
    if (!parsed.success) return { ok: false, fout: "Ongeldige deelnemers-input" };
    return { ok: true, deelnemers: parsed.data };
  }
  const traject = hddStorage.getTraject(trajectId);
  if (!traject) return { ok: false, fout: "Niet gevonden" };
  const leden = hddStorage.ledenVanTraject(trajectId);
  return { ok: true, deelnemers: teamanalyseDeelnemers(traject, leden) };
}

export function registerHddTeamanalyseRoutes(app: Express): void {
  app.post("/api/hdd/trajecten/:id/teamanalyse-2ms", async (req, res) => {
    const traject = hddStorage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });

    const gelezen = leesDeelnemers(traject.id, req.body);
    if (!gelezen.ok) return res.status(400).json({ error: gelezen.fout });

    try {
      const kern = await laadRekenkern();
      if (gelezen.deelnemers.length < kern.TEAMANALYSE_MIN_DEELNEMERS) {
        return res.status(400).json({
          error:
            `Een teamanalyse vraagt minstens ${kern.TEAMANALYSE_MIN_DEELNEMERS} ingevulde ` +
            "2MINSCANs; er zijn er " + gelezen.deelnemers.length + ".",
          code: "TE_WEINIG_DEELNEMERS",
          aantal: gelezen.deelnemers.length,
        });
      }
      res.json({
        trajectId: traject.id,
        aantalDeelnemers: gelezen.deelnemers.length,
        analyse: kern.bouwTeamanalyse(gelezen.deelnemers),
      });
    } catch (err) {
      if (err instanceof KernOntbreekt) {
        return res.status(503).json({ error: err.message, code: "TEAMANALYSE_NIET_BESCHIKBAAR" });
      }
      res.status(500).json({
        error: "Teamanalyse mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Zelfde patroon en zelfde foutafhandeling als /rapport/pdf: gestreamde PDF
  // met Content-Type, Content-Disposition en Content-Length, en bij een fout
  // een JSON-lichaam in plaats van een half bestand.
  app.post("/api/hdd/trajecten/:id/teamanalyse-2ms/pdf", async (req, res) => {
    const traject = hddStorage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });

    const gelezen = leesDeelnemers(traject.id, req.body);
    if (!gelezen.ok) return res.status(400).json({ error: gelezen.fout });

    try {
      const kern = await laadRekenkern();
      if (gelezen.deelnemers.length < kern.TEAMANALYSE_MIN_DEELNEMERS) {
        return res.status(400).json({
          error:
            `Een teamanalyse vraagt minstens ${kern.TEAMANALYSE_MIN_DEELNEMERS} ingevulde ` +
            "2MINSCANs; er zijn er " + gelezen.deelnemers.length + ".",
          code: "TE_WEINIG_DEELNEMERS",
          aantal: gelezen.deelnemers.length,
        });
      }
      const analyse = kern.bouwTeamanalyse(gelezen.deelnemers);
      const renderTeamanalysePdf = await laadPdfRenderer();

      const body = (req.body ?? {}) as Record<string, unknown>;
      const str = (v: unknown): string | undefined =>
        typeof v === "string" && v.trim() ? v.trim() : undefined;

      const pdf = await renderTeamanalysePdf({
        company: str(body.company) ?? traject.orgLabel ?? traject.boardNaam ?? "the Company",
        boardLabel: traject.boardNaam || "the board",
        date: str(body.date) ?? new Date().toISOString().slice(0, 10),
        confidentiality: str(body.confidentiality) ?? "Confidential",
        analyse,
      });

      const slug =
        (traject.boardNaam || "board")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "board";
      const filename = `hdd-${slug}-2minscan-teamanalyse.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(pdf.length));
      res.end(pdf);
    } catch (err) {
      if (err instanceof KernOntbreekt) {
        return res.status(503).json({ error: err.message, code: "TEAMANALYSE_NIET_BESCHIKBAAR" });
      }
      res.status(500).json({
        error: "Teamanalyse-generatie mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
