import type { Express } from "express";
import { hddStorage as storage } from "./storage";
import {
  insertHddTrajectSchema,
  insertHddBoardLidSchema,
  hddContextSchema,
} from "./schema";
import { getDescriptor } from "../registry";
import { evalueerGate, type Fase1Aggregaat } from "./gate";
import { bouwFase2Aggregaat, type Fase2Input, type BoardMemberInput } from "./aggregatie";
import { bouwRapport, type Audience } from "./rapport";
import { buildFlagshipInput } from "./pdf/mapping";
import { renderFlagshipPdf } from "./pdf/index";
import { z } from "zod";

/**
 * Human Due Diligence — routes (prefix /api/hdd/...).
 * ------------------------------------------------------------------
 * HDD orkestreert in twee fasen bestaande instrumenten voor één board. Deze
 * eerste oplevering levert de traject-CRUD, het fasen-/statusbeheer en het
 * Go/No-Go-scharnier. De daadwerkelijke link-generatie/uitsturing en de
 * geaggregeerde rapportage worden in een volgende stap aangesloten op de
 * Teamscan-, 2MINSCAN- en T4P Business-bronnen (zie bouwplan §7, stappen B–E).
 */

export function registerHddRoutes(app: Express): void {
  // ---- Descriptor (client haalt fasen/credits hier op) ----
  app.get("/api/hdd/descriptor", (_req, res) => {
    const d = getDescriptor("hdd");
    if (!d) return res.status(404).json({ error: "HDD niet geregistreerd" });
    res.json({
      instrumentId: d.instrumentId,
      name: d.name,
      version: d.version,
      description: d.description,
      flowType: d.flowType,
      creditCost: d.creditCost,
      journey: d.journey,
    });
  });

  // ---- Trajecten (één board) ----
  app.get("/api/hdd/trajecten", (_req, res) => {
    res.json(storage.alleTrajecten());
  });

  app.post("/api/hdd/trajecten", (req, res) => {
    const parsed = insertHddTrajectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    // Context valideren als variabele (géén aparte modus).
    if (parsed.data.context && !hddContextSchema.safeParse(parsed.data.context).success) {
      return res.status(400).json({ error: "Ongeldige context" });
    }
    const platformSessieId =
      req.body?.platformSessieId != null ? Number(req.body.platformSessieId) : undefined;
    const traject = storage.maakTraject(parsed.data, platformSessieId);
    res.json(traject);
  });

  app.get("/api/hdd/trajecten/:id", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const leden = storage.ledenVanTraject(traject.id);
    res.json({
      ...traject,
      leden,
      gate: storage.getGateResultaat(traject.id),
    });
  });

  // ---- Board members ----
  app.post("/api/hdd/trajecten/:id/leden", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const parsed = insertHddBoardLidSchema.safeParse({
      ...req.body,
      trajectId: traject.id,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const lid = storage.voegLidToe(traject.id, parsed.data);
    res.json(lid);
  });

  // ---- Fase 1 starten (link-generatie + uitsturen — skelet) ----
  // Volledige implementatie hangt samen met Teamscan-/2MINSCAN-token-aanmaak
  // (bouwplan §3.1). Deze route zet de trajectstatus en is het inhaakpunt.
  app.post("/api/hdd/trajecten/:id/start-fase1", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    storage.setStatus(traject.id, "fase1_open");
    res.json({
      ok: true,
      status: "fase1_open",
      todo:
        "Genereer per board member een Teamscan- en 2MINSCAN-token en stuur twee " +
        "links uit (zie bouwplan §3.1).",
    });
  });

  // ---- Go/No-Go-scharnier ----
  // Evalueert het Fase 1-aggregaat. In de prototype-fase mag het aggregaat als
  // body worden meegegeven; later leest aggregatie.ts dit uit de bronnen.
  app.post("/api/hdd/trajecten/:id/gate", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });

    const aggregaatSchema = z
      .object({
        waardenfitGemiddelde: z.number().optional(),
        vertrouwenOnderDrempel: z.boolean().optional(),
        vertrouwensGaps: z.array(z.number()).optional(),
        conflictZwak: z.boolean().optional(),
        energieBalans: z.number().optional(),
        spreiding: z.number().optional(),
      })
      .optional();
    const parsed = aggregaatSchema.safeParse(req.body?.aggregaat ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const gate = evalueerGate((parsed.data ?? {}) as Fase1Aggregaat);

    // Optionele consultant-overschrijving (de mens beslist uiteindelijk).
    if (req.body?.consultantBesluit === "go" || req.body?.consultantBesluit === "no-go") {
      gate.consultantBesluit = req.body.consultantBesluit;
      gate.consultantMotivatie =
        typeof req.body?.consultantMotivatie === "string" ? req.body.consultantMotivatie : "";
    }

    storage.setGateResultaat(traject.id, gate);
    res.json(gate);
  });

  // ---- Fase 2 starten (T4P-links — skelet) ----
  app.post("/api/hdd/trajecten/:id/start-fase2", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    storage.setStatus(traject.id, "fase2_open");
    res.json({
      ok: true,
      status: "fase2_open",
      todo:
        "Genereer per board member een T4P Business-token en stuur één link uit " +
        "(zie bouwplan §3.2).",
    });
  });

  // ---- Fase 2-aggregaat (vier dimensies + HDD Human Capital Index) ----
  // De already-scored member-inputs mogen in de prototype-fase als body worden
  // meegegeven; later assembleert aggregatie.ts ze uit de Teamscan-/2MINSCAN-/
  // T4P-bronnen via de opgeslagen tokens.
  const ledenSchema = z.array(
    z.object({
      id: z.number(),
      naam: z.string().default(""),
      rol: z.string().optional(),
      samenvatting: z.string().optional(),
      teamscan: z
        .object({
          vertrouwen: z.number().optional(),
          conflict: z.number().optional(),
          betrokkenheid: z.number().optional(),
          verantwoordelijkheid: z.number().optional(),
          resultaten: z.number().optional(),
        })
        .optional(),
      energy: z
        .object({ fase: z.number().optional(), energie: z.number().optional() })
        .optional(),
      talent: z
        .object({
          talentFoci: z.array(z.string()).optional(),
          versnellers: z.array(z.string()).optional(),
          drivers: z.array(z.string()).optional(),
          driverRisico: z.enum(["laag", "matig", "hoog"]).optional(),
          stratumIndicatie: z.number().optional(),
          congruentie: z.number().optional(),
        })
        .optional(),
    }),
  );

  function leesFase2Input(traject: { context: string; vereistStratum: number | null }, body: unknown): Fase2Input | null {
    const parsed = ledenSchema.safeParse((body as { leden?: unknown })?.leden ?? []);
    if (!parsed.success) return null;
    return {
      context: (traject.context === "ma" ? "ma" : "self-screening"),
      vereistStratum: traject.vereistStratum,
      leden: parsed.data as BoardMemberInput[],
    };
  }

  app.post("/api/hdd/trajecten/:id/fase2", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const input = leesFase2Input(traject, req.body);
    if (!input) return res.status(400).json({ error: "Ongeldige leden-input" });
    res.json(bouwFase2Aggregaat(input));
  });

  // ---- Eindrapport (ALTIJD Engelstalig) — audience = investor | team ----
  app.post("/api/hdd/trajecten/:id/rapport", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const audience: Audience = req.query.audience === "team" ? "team" : "investor";
    const input = leesFase2Input(traject, req.body);
    if (!input) return res.status(400).json({ error: "Ongeldige leden-input" });
    const agg = bouwFase2Aggregaat(input);
    const rapport = bouwRapport({
      audience,
      boardLabel: traject.boardNaam || "the board",
      investorLabel: typeof req.body?.investorLabel === "string" ? req.body.investorLabel : "",
      context: input.context,
      agg,
      leden: input.leden,
    });
    res.json(rapport);
  });

  // ---- Eindrapport als PDF (vlaggenschip-specimen — ALTIJD Engelstalig) ----
  // Eén print-knop -> exact specimen-format. Genereert het goedgekeurde
  // vlaggenschiprapport (investor | team) als gestreamde PDF, gevoed met de
  // live fase-2 leden-data uit de body (zelfde body als POST .../rapport).
  // De renderer is pure-Node (pdfkit) zodat de PDF on-demand kan worden
  // gegenereerd zonder Python-runtime.
  app.post("/api/hdd/trajecten/:id/rapport/pdf", async (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const audience: Audience = req.query.audience === "team" ? "team" : "investor";
    const input = leesFase2Input(traject, req.body);
    if (!input) return res.status(400).json({ error: "Ongeldige leden-input" });

    try {
      const agg = bouwFase2Aggregaat(input);
      // Narratieve groei-feiten + bedrijfsnaam komen uit de body (variabel);
      // veilige specimen-defaults wanneer niet meegegeven. Investeerder is een
      // VARIABELE (niet altijd PMV).
      const body = (req.body ?? {}) as Record<string, unknown>;
      const str = (v: unknown): string | undefined =>
        typeof v === "string" && v.trim() ? v.trim() : undefined;
      const num = (v: unknown): number | undefined =>
        typeof v === "number" && Number.isFinite(v) ? v : undefined;

      const fi = buildFlagshipInput({
        audience,
        agg,
        leden: input.leden,
        company: str(body.company) ?? traject.boardNaam ?? "the Company",
        investorLabel: str(body.investorLabel),
        revenueNow: str(body.revenueNow),
        revenueTarget: str(body.revenueTarget),
        fteFrom: num(body.fteFrom),
        fteTo: num(body.fteTo),
        date: str(body.date),
        confidentiality: str(body.confidentiality),
      });

      const pdf = await renderFlagshipPdf(fi);
      const slug = (fi.meta.company || "company")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "company";
      const filename = `hdd-${slug}-${audience}-report.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(pdf.length));
      res.end(pdf);
    } catch (err) {
      res.status(500).json({
        error: "Rapport-generatie mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
