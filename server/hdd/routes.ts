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
import { vereisScope, scopeVanVerzoek, verzenderVanVerzoek } from "../scope-guard";
import { CreditError } from "../storage";
import { boekTrajectCredits, stuurFaseUit } from "./uitsturen";
import { mailFaseUit } from "./uitnodigingsmail";
import { keurVerzendweg } from "../mailpoort/poort";
import { afzenderVoor } from "../bulk-import/mailer";
import { bouwLedenInvoer, leesVoortgang } from "./bronnen";
import { registerHddTeamanalyseRoutes } from "./teamanalyse-routes";

/**
 * Human Due Diligence - routes (prefix /api/hdd/...).
 * ------------------------------------------------------------------
 * HDD orkestreert in twee fasen bestaande instrumenten voor één board: de
 * traject-CRUD, het fasen-/statusbeheer, het Go/No-Go-scharnier, het werkelijke
 * uitsturen van de fasen (zie ./uitsturen.ts) en de rapportage op de echte
 * meetwaarden uit de bronnen (zie ./bronnen.ts).
 *
 * Twee regels die overal in dit bestand terugkomen:
 *   - Uitsturen is idempotent. Een tweede start maakt geen tweede uitnodiging
 *     en boekt geen tweede keer credits af; bestaande tokens komen terug.
 *   - De ledeninvoer komt standaard uit de bronnen. `leden` in de body blijft
 *     bestaan als uitdrukkelijke overschrijving (proefdraai, specimen), nooit
 *     als stille terugval.
 */

export function registerHddRoutes(app: Express): void {
  app.use("/api/hdd", vereisScope);

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

  /**
   * Stuurt een fase werkelijk uit.
   *
   * Volgorde: eerst de credits (een leeg saldo mag geen halve uitsturing
   * achterlaten), dan de uitnodigingen, dan pas de status. Alles idempotent.
   */
  async function startFase(req: any, res: any, fase: number, status: string) {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const leden = storage.ledenVanTraject(traject.id);
    if (!leden.length) {
      return res.status(400).json({
        error: "Dit traject heeft nog geen board members, dus er valt niets uit te sturen.",
      });
    }

    // -----------------------------------------------------------------------
    // DE MAILPOORT, vóór de credits en vóór de tokens.
    //
    // Een fase uitsturen betekent voor de opdrachtgever: mijn board members
    // krijgen een bericht. Staat de deur naar buiten dicht, dan hoort dat te
    // blijken vóór de trajectprijs eraf gaat, en niet achteraf uit het feit dat
    // niemand antwoordt. Wie enkel de links wil om ze zelf door te geven,
    // stuurt tochUitsturen mee en kiest daarmee uitdrukkelijk.
    //
    // Heeft geen enkel lid een e-mailadres, dan wordt er niets gevraagd van de
    // mailweg en mag de poort niet in de weg staan.
    // -----------------------------------------------------------------------
    const tochUitsturen = req.body?.tochUitsturen === true;
    const afzenderNaarBuiten = afzenderVoor(null);
    const iemandMetAdres = leden.some((l: { email?: string | null }) => (l.email ?? "").trim());
    let mailweg = null as Awaited<ReturnType<typeof keurVerzendweg>> | null;
    if (iemandMetAdres) {
      mailweg = await keurVerzendweg(afzenderNaarBuiten, { vers: true });
      if (!mailweg.bruikbaar && !tochUitsturen) {
        return res.status(409).json({
          error:
            "Het systeem kan nu geen enkel bericht versturen. Het traject is niet uitgestuurd en de trajectprijs is niet aangerekend." +
            (mailweg.bezwaren[0] ?? ""),
          code: "MAILWEG_ONBRUIKBAAR",
          mailweg,
          hoeToch:
            "Stuur tochUitsturen mee als je alleen de links wilt aanmaken en ze zelf wilt doorgeven.",
        });
      }
    }

    const scope = scopeVanVerzoek(req);
    let credits;
    try {
      credits = await boekTrajectCredits(traject, scope);
    } catch (err) {
      if (err instanceof CreditError) {
        return res.status(402).json({ error: err.message, code: "GEEN_CREDITS" });
      }
      throw err;
    }

    // Het traject opnieuw lezen: boekTrajectCredits kan het net bijgewerkt
    // hebben, en stuurFaseUit heeft het actuele teamscanSessieId nodig.
    const vers = storage.getTraject(traject.id) ?? traject;
    const verzender = await verzenderVanVerzoek(req);
    const uitgestuurd = await stuurFaseUit({
      traject: vers,
      leden,
      fase,
      scope,
      verzender,
      taal: typeof req.body?.taal === "string" ? req.body.taal : "nl",
    });

    storage.setStatus(traject.id, status);

    // De ontbrekende stap van 12 september: het bericht zelf. Zie
    // ./uitnodigingsmail.ts voor waarom dit hier hoort en niet in uitsturen.ts.
    const origin =
      typeof req.body?.origin === "string" && req.body.origin.trim()
        ? req.body.origin.trim().replace(/\/+$/, "")
        : "";
    const post = await mailFaseUit({
      boardNaam: vers.boardNaam,
      fase,
      uitsturingen: uitgestuurd.leden,
      origin,
      afzender: null,
    });

    res.json({
      ok: true,
      status,
      credits,
      ...uitgestuurd,
      // Uitgestuurd is niet verstuurd. Deze vier velden zeggen wat er werkelijk
      // de deur uit ging; het scherm leest ze en maakt er geen groene kop van
      // wanneer er niets vertrok.
      mail: post.leden,
      aantalMailVerstuurd: post.aantalMailVerstuurd,
      aantalZonderMail: post.aantalZonderMail,
      mailGeslaagd: post.mailGeslaagd,
      mailAlarm: post.mailAlarm,
      mailweg,
    });
  }

  // ---- Fase 1 starten: Teamscan + 2MINSCAN per board member ----
  app.post("/api/hdd/trajecten/:id/start-fase1", async (req, res) => {
    try {
      await startFase(req, res, 1, "fase1_open");
    } catch (err) {
      res.status(500).json({
        error: "Fase 1 uitsturen is mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ---- Voortgang: wie vulde wat in, gelezen bij de bronnen zelf ----
  app.get("/api/hdd/trajecten/:id/voortgang", async (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    try {
      const leden = storage.ledenVanTraject(traject.id);
      const voortgang = await leesVoortgang(traject, leden);
      const ingevuld = (instrument: string) =>
        voortgang.filter((l) => l.instrumenten.some((i) => i.instrumentId === instrument && i.ingevuld))
          .length;
      res.json({
        trajectId: traject.id,
        status: traject.status,
        aantalLeden: leden.length,
        totalen: {
          "tapas-teamscan": ingevuld("tapas-teamscan"),
          twominscan: ingevuld("twominscan"),
          "t4p-business-kompas": ingevuld("t4p-business-kompas"),
        },
        leden: voortgang,
      });
    } catch (err) {
      res.status(500).json({
        error: "Voortgang lezen mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
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

  // ---- Fase 2 starten: T4P Business Kompas per board member ----
  app.post("/api/hdd/trajecten/:id/start-fase2", async (req, res) => {
    try {
      await startFase(req, res, 2, "fase2_open");
    } catch (err) {
      res.status(500).json({
        error: "Fase 2 uitsturen is mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ---- Traject afronden ----
  // Mag alleen vanuit fase2_open of gate. Vanuit fase1_open is er nog geen
  // diepteanalyse en vanuit afgerond valt er niets meer af te ronden; in beide
  // gevallen hoort daar een duidelijke melding bij en geen stille statuswissel.
  const AFRONDEN_VANUIT = ["fase2_open", "gate"];
  app.post("/api/hdd/trajecten/:id/afronden", (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    if (!AFRONDEN_VANUIT.includes(traject.status)) {
      return res.status(409).json({
        error:
          `Een traject met status "${traject.status}" kan niet afgerond worden. ` +
          `Afronden kan vanuit ${AFRONDEN_VANUIT.join(" of ")}.`,
        code: "ONGELDIGE_STATUSOVERGANG",
        status: traject.status,
        toegestaanVanuit: AFRONDEN_VANUIT,
      });
    }
    storage.setStatus(traject.id, "afgerond");
    res.json({ ok: true, status: "afgerond", vorigeStatus: traject.status });
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
      // De herkomst is verplicht om de waarde te laten meetellen: zonder bron
      // kunnen we niet nagaan of er werkelijk naar energie gevraagd is. Zie
      // ENERGIE_INSTRUMENTEN in aggregatie.ts.
      energy: z
        .object({
          bron: z.string().optional(),
          itemEnergie: z.number().optional(),
          fase: z.number().optional(),
          energie: z.number().optional(),
        })
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

  /**
   * De ledeninvoer van een traject.
   *
   * Staat er `leden` in de body, dan is dat een uitdrukkelijke overschrijving
   * en wordt die gebruikt. Staat er niets, dan leest de brug in ./bronnen.ts de
   * echte meetwaarden bij de instrumenten via de bewaarde tokens. Wat niet
   * gemeten is, blijft leeg; er wordt nooit een middenwaarde ingevuld.
   */
  async function leesFase2Input(
    traject: { id: number; context: string; vereistStratum: number | null },
    body: unknown,
  ): Promise<Fase2Input | null> {
    const context = traject.context === "ma" ? "ma" : "self-screening";
    const uitBody = (body as { leden?: unknown })?.leden;
    if (uitBody !== undefined) {
      const parsed = ledenSchema.safeParse(uitBody);
      if (!parsed.success) return null;
      return {
        context,
        vereistStratum: traject.vereistStratum,
        leden: parsed.data as BoardMemberInput[],
      };
    }
    const volledig = storage.getTraject(traject.id);
    if (!volledig) return null;
    const leden = await bouwLedenInvoer(volledig, storage.ledenVanTraject(volledig.id));
    return { context, vereistStratum: traject.vereistStratum, leden };
  }

  app.post("/api/hdd/trajecten/:id/fase2", async (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const input = await leesFase2Input(traject, req.body);
    if (!input) return res.status(400).json({ error: "Ongeldige leden-input" });
    res.json(bouwFase2Aggregaat(input));
  });

  // ---- Eindrapport (ALTIJD Engelstalig) - audience = investor | team ----
  app.post("/api/hdd/trajecten/:id/rapport", async (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const audience: Audience = req.query.audience === "team" ? "team" : "investor";
    const input = await leesFase2Input(traject, req.body);
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

  // ---- Eindrapport als PDF (vlaggenschip-specimen - ALTIJD Engelstalig) ----
  // Eén print-knop -> exact specimen-format. Genereert het goedgekeurde
  // vlaggenschiprapport (investor | team) als gestreamde PDF, gevoed met de
  // live fase-2 leden-data uit de body (zelfde body als POST .../rapport).
  // De renderer is pure-Node (pdfkit) zodat de PDF on-demand kan worden
  // gegenereerd zonder Python-runtime.
  app.post("/api/hdd/trajecten/:id/rapport/pdf", async (req, res) => {
    const traject = storage.getTraject(Number(req.params.id));
    if (!traject) return res.status(404).json({ error: "Niet gevonden" });
    const audience: Audience = req.query.audience === "team" ? "team" : "investor";
    const input = await leesFase2Input(traject, req.body);
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
        error: "Rapport maken is mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ---- 2MINSCAN-teamanalyse (JSON + PDF) ----
  // Staat in een eigen bestand omdat de rekenkern en de opmaak uit een ander
  // spoor komen; registreren gebeurt hier zodat de scope-poort hierboven ook
  // voor die routes geldt.
  registerHddTeamanalyseRoutes(app);
}
