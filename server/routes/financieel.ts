/**
 * server/routes/financieel.ts
 *
 * Domeinrouter: Financiële laag — creditpakketten, organisaties, credits,
 * billers, betalingen, facturen, creditnota's, bestuursrapportage.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 *
 * Routes:
 *   GET  /api/creditpakketten                    — pakketconfiguratie
 *   GET  /api/organisaties                       — lijst met saldo
 *   GET  /api/organisaties/:id                   — detail + saldo
 *   POST /api/organisaties                       — aanmaken
 *   GET  /api/organisaties/:id/saldo             — saldo
 *   GET  /api/organisaties/:id/tendenzen         — geaggregeerd teambeeld
 *   POST /api/credits/opladen                    — credits handmatig opladen
 *   POST /api/credits/overdracht                 — credits overdragen
 *   GET  /api/credits/transacties                — grootboek
 *   GET  /api/billers                            — alle billers
 *   GET  /api/billers/actief                     — actieve biller
 *   POST /api/billers                            — biller aanmaken
 *   POST /api/billers/:id/activeer               — biller activeren
 *   POST /api/betalingen                         — betaling starten
 *   POST /api/betalingen/:id/bevestig            — betaling bevestigen
 *   POST /api/betalingen/:id/mislukt             — betaling als mislukt markeren
 *   GET  /api/betalingen                         — betalingen ophalen
 *   GET  /api/betalingen/:id                     — betaling detail
 *   GET  /api/facturen                           — facturen ophalen
 *   GET  /api/facturen/:id                       — factuur detail
 *   GET  /api/facturen/:id/peppol.json           — Peppol/UBL-document download
 *   POST /api/creditnotas                        — creditnota aanmaken
 *   GET  /api/creditnotas                        — creditnota's ophalen
 *   GET  /api/creditnotas/:id                    — creditnota detail
 *   GET  /api/creditnotas/:id/peppol.json        — Peppol-document download
 *   GET  /api/bestuur/kpis                       — KPI's voor bestuur
 *   GET  /api/bestuur/boekhoudexport             — boekhoudexport JSON
 *   GET  /api/bestuur/boekhoudexport.csv         — boekhoudexport CSV
 */

import type { Express } from "express";
import { storage, CreditError, CREDITPAKKETTEN } from "../storage";
import {
  insertOrganisatieSchema,
  insertBillerSchema,
  laadCreditsSchema,
  overdrachtSchema,
  startBetalingSchema,
  creditnotaSchema,
} from "@shared/schema";
import { isTalentFocusConstruct } from "@shared/talent-constructs";

// Helper: bepaal het aantal credits uit pakket of expliciet aantal.
function creditsUitPayload(pakketId?: string, credits?: number): number | null {
  if (pakketId) {
    const p = CREDITPAKKETTEN.find((x) => x.id === pakketId);
    if (p) return p.credits;
  }
  if (credits && credits > 0) return credits;
  return null;
}

export function registerFinancieelRoutes(app: Express): void {
  // --- Creditpakketten (config) ---
  app.get("/api/creditpakketten", (_req, res) => {
    res.json(CREDITPAKKETTEN);
  });

  // --- Organisaties: lijst met saldo ---
  app.get("/api/organisaties", async (_req, res) => {
    res.json(await storage.listOrganisaties());
  });

  // --- Organisatie: detail ---
  app.get("/api/organisaties/:id", async (req, res) => {
    const id = Number(req.params.id);
    const org = await storage.getOrganisatie(id);
    if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
    const saldo = await storage.getSaldo(id);
    res.json({ ...org, saldo });
  });

  // --- Organisatie aanmaken ---
  app.post("/api/organisaties", async (req, res) => {
    const parsed = insertOrganisatieSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const org = await storage.createOrganisatie(parsed.data);
    res.json(org);
  });

  // --- Saldo van één organisatie ---
  app.get("/api/organisaties/:id/saldo", async (req, res) => {
    const id = Number(req.params.id);
    const org = await storage.getOrganisatie(id);
    if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
    res.json(await storage.getSaldo(id));
  });

  // --- Organisatietendenzen: geaggregeerd, niet-individueel teambeeld ---
  app.get("/api/organisaties/:id/tendenzen", async (req, res) => {
    const id = Number(req.params.id);
    const org = await storage.getOrganisatie(id);
    if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
    const alle = await storage.listAfnames();
    const voltooid = alle.filter(
      (a) => a.organisatieId === id && a.status === "voltooid" && a.generatorContract
    );
    const N = voltooid.length;
    const MIN = 3;
    if (N < MIN) {
      return res.json({ organisatie: org.naam, aantalProfielen: N, voldoende: false, minimum: MIN });
    }
    const fociSom: Record<string, number> = {};
    const fociEnergie: Record<string, number[]> = {};
    const versnSom: Record<string, number> = {};
    const driverSom: Record<string, number> = {};
    const driverEnergie: Record<string, number[]> = {};
    const energieVragenlijst: number[] = [];
    const energieBaseline: number[] = [];
    const consistenties: number[] = [];
    let driverRisicoHoog = 0;
    let driverRisicoMatig = 0;
    const conn = { q1: [] as number[], q2: [] as number[], q3: [] as number[], q4: [] as number[] };

    for (const a of voltooid) {
      let c: any;
      try { c = JSON.parse(a.generatorContract as string); } catch { continue; }
      const main = c?.sections?.main ?? {};
      const meta = main?.meta ?? {};
      const rows: any[] = Array.isArray(main?.constructRows) ? main.constructRows : [];
      for (const r of rows) {
        // TaPas-Beeld is GEEN talent-focus en mag ook in geaggregeerde
        // statistieken nooit als focus meetellen.
        if (isTalentFocusConstruct(r)) {
          fociSom[r.construct] = (fociSom[r.construct] ?? 0) + r.net;
          (fociEnergie[r.construct] ??= []).push(r.avgEnergy);
        } else if (r.family === "Talent-versnellers") {
          versnSom[r.construct] = (versnSom[r.construct] ?? 0) + r.net;
        } else if (r.family === "Drivers") {
          driverSom[r.construct] = (driverSom[r.construct] ?? 0) + r.net;
          (driverEnergie[r.construct] ??= []).push(r.avgEnergy);
        }
      }
      if (typeof meta.normalizedQuestionnaireEnergy === "number") energieVragenlijst.push(meta.normalizedQuestionnaireEnergy);
      if (typeof meta.baselineProfessionalEnergy === "number") energieBaseline.push(meta.baselineProfessionalEnergy);
      if (typeof meta?.consistency?.score === "number") consistenties.push(meta.consistency.score);
      const dl = String(meta?.driverRisk?.label ?? "laag");
      if (dl === "hoog") driverRisicoHoog++;
      else if (dl === "matig") driverRisicoMatig++;
      const ca = c?.sections?.connection?.answers ?? {};
      for (const q of ["q1", "q2", "q3", "q4"] as const) {
        if (typeof ca[q] === "number") conn[q].push(ca[q]);
      }
    }
    const gem = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    const sorteer = (obj: Record<string, number>) =>
      Object.entries(obj).map(([naam, som]) => ({ naam, gemNet: Math.round((som / N) * 10) / 10 })).sort((a, b) => b.gemNet - a.gemNet);

    res.json({
      organisatie: org.naam,
      aantalProfielen: N,
      voldoende: true,
      energie: {
        gemVragenlijst: gem(energieVragenlijst),
        gemBaseline: gem(energieBaseline),
        gemConsistentie: gem(consistenties),
      },
      talentfoci: sorteer(fociSom),
      talentversnellers: sorteer(versnSom),
      drivers: sorteer(driverSom),
      driverBelasting: {
        hoog: driverRisicoHoog,
        matig: driverRisicoMatig,
        laag: N - driverRisicoHoog - driverRisicoMatig,
      },
      verbondenheid: {
        psychologisch: gem(conn.q1),
        billijkheid: gem(conn.q2),
        zelfinvestering: gem(conn.q3),
        organisatieInvestering: gem(conn.q4),
      },
    });
  });

  // --- Credits handmatig opladen ---
  app.post("/api/credits/opladen", async (req, res) => {
    const parsed = laadCreditsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const { organisatieId, aantal, omschrijving } = parsed.data;
    const org = await storage.getOrganisatie(organisatieId);
    if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
    const saldo = await storage.laadCredits(organisatieId, aantal, omschrijving);
    res.json(saldo);
  });

  // --- Credits overdragen tussen organisaties ---
  app.post("/api/credits/overdracht", async (req, res) => {
    const parsed = overdrachtSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const { vanOrganisatieId, naarOrganisatieId, aantal, omschrijving } = parsed.data;
    try {
      await storage.overdracht(vanOrganisatieId, naarOrganisatieId, aantal, omschrijving);
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Overdracht mislukt";
      res.status(400).json({ error: msg });
    }
  });

  // --- Creditgrootboek (transacties), optioneel gefilterd op organisatie ---
  app.get("/api/credits/transacties", async (req, res) => {
    const orgId = req.query.organisatieId ? Number(req.query.organisatieId) : undefined;
    res.json(await storage.listTransacties(orgId));
  });

  // --- Billers (facturerende entiteiten) ---
  app.get("/api/billers", async (_req, res) => {
    res.json(await storage.listBillers());
  });

  app.get("/api/billers/actief", async (_req, res) => {
    const b = await storage.getActieveBiller();
    if (!b) return res.status(404).json({ error: "Geen actieve biller" });
    res.json(b);
  });

  app.post("/api/billers", async (req, res) => {
    const parsed = insertBillerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const b = await storage.createBiller(parsed.data);
    res.json(b);
  });

  // Entiteitswissel: maak één biller actief (sluit de vorige af).
  app.post("/api/billers/:id/activeer", async (req, res) => {
    const id = Number(req.params.id);
    const b = await storage.activeerBiller(id);
    if (!b) return res.status(404).json({ error: "Biller niet gevonden" });
    res.json(b);
  });

  // =========================================================================
  // Fase C2 — Betaalintegratie (Mollie) & credits opladen via betaling
  // =========================================================================

  app.post("/api/betalingen", async (req, res) => {
    const parsed = startBetalingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const { organisatieId, pakketId, credits } = parsed.data;
    const org = await storage.getOrganisatie(organisatieId);
    if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
    const aantal = creditsUitPayload(pakketId, credits);
    if (!aantal) return res.status(400).json({ error: "Kon het aantal credits niet bepalen" });
    const betaling = await storage.startBetaling(organisatieId, aantal, pakketId ?? null);
    res.json(betaling);
  });

  // Webhook-equivalent: bevestig een geslaagde betaling.
  app.post("/api/betalingen/:id/bevestig", async (req, res) => {
    const id = Number(req.params.id);
    const methode = typeof req.body?.methode === "string" ? req.body.methode : undefined;
    try {
      const result = await storage.bevestigBetaling(id, methode);
      if (!result) return res.status(404).json({ error: "Betaling niet gevonden" });
      res.json(result);
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Bevestiging mislukt";
      res.status(400).json({ error: msg });
    }
  });

  // Markeer een betaling als mislukt.
  app.post("/api/betalingen/:id/mislukt", async (req, res) => {
    const id = Number(req.params.id);
    const b = await storage.markeerBetalingMislukt(id);
    if (!b) return res.status(404).json({ error: "Betaling niet gevonden" });
    res.json(b);
  });

  app.get("/api/betalingen", async (req, res) => {
    const orgId = req.query.organisatieId ? Number(req.query.organisatieId) : undefined;
    res.json(await storage.listBetalingen(orgId));
  });

  app.get("/api/betalingen/:id", async (req, res) => {
    const b = await storage.getBetaling(Number(req.params.id));
    if (!b) return res.status(404).json({ error: "Betaling niet gevonden" });
    res.json(b);
  });

  // =========================================================================
  // Fase C2-C3 — Facturen (provider-neutraal, Peppol-klaar)
  // =========================================================================

  app.get("/api/facturen", async (req, res) => {
    const orgId = req.query.organisatieId ? Number(req.query.organisatieId) : undefined;
    res.json(await storage.listFacturen(orgId));
  });

  app.get("/api/facturen/:id", async (req, res) => {
    const f = await storage.getFactuur(Number(req.params.id));
    if (!f) return res.status(404).json({ error: "Factuur niet gevonden" });
    res.json({
      ...f,
      billerSnapshot: JSON.parse(f.billerSnapshot),
      klantSnapshot: JSON.parse(f.klantSnapshot),
      regels: JSON.parse(f.regels),
      peppolDocument: f.peppolDocument ? JSON.parse(f.peppolDocument) : null,
    });
  });

  // Download het Peppol/UBL-document als JSON-bestand.
  app.get("/api/facturen/:id/peppol.json", async (req, res) => {
    const f = await storage.getFactuur(Number(req.params.id));
    if (!f || !f.peppolDocument) {
      return res.status(404).json({ error: "Geen Peppol-document beschikbaar voor deze factuur" });
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${f.factuurnummer}_peppol.json"`);
    res.send(f.peppolDocument);
  });

  // =========================================================================
  // Fase C4a — Creditnota's
  // =========================================================================

  app.post("/api/creditnotas", async (req, res) => {
    const parsed = creditnotaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    try {
      const cn = await storage.maakCreditnota(
        parsed.data.factuurId,
        parsed.data.reden,
        parsed.data.creditsTerugboeken
      );
      res.json({
        ...cn,
        billerSnapshot: JSON.parse(cn.billerSnapshot),
        klantSnapshot: JSON.parse(cn.klantSnapshot),
        regels: JSON.parse(cn.regels),
        peppolDocument: cn.peppolDocument ? JSON.parse(cn.peppolDocument) : null,
      });
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Creditnota mislukt";
      res.status(400).json({ error: msg });
    }
  });

  app.get("/api/creditnotas", async (req, res) => {
    const orgId = req.query.organisatieId ? Number(req.query.organisatieId) : undefined;
    res.json(await storage.listCreditnotas(orgId));
  });

  app.get("/api/creditnotas/:id", async (req, res) => {
    const c = await storage.getCreditnota(Number(req.params.id));
    if (!c) return res.status(404).json({ error: "Creditnota niet gevonden" });
    res.json({
      ...c,
      billerSnapshot: JSON.parse(c.billerSnapshot),
      klantSnapshot: JSON.parse(c.klantSnapshot),
      regels: JSON.parse(c.regels),
      peppolDocument: c.peppolDocument ? JSON.parse(c.peppolDocument) : null,
    });
  });

  app.get("/api/creditnotas/:id/peppol.json", async (req, res) => {
    const c = await storage.getCreditnota(Number(req.params.id));
    if (!c || !c.peppolDocument) {
      return res.status(404).json({ error: "Geen Peppol-document beschikbaar voor deze creditnota" });
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${c.creditnotanummer}_peppol.json"`);
    res.send(c.peppolDocument);
  });

  // =========================================================================
  // Fase C4b — Bestuursrapportage (Raad van Bestuur / investeerders)
  // =========================================================================

  app.get("/api/bestuur/kpis", async (_req, res) => {
    res.json(await storage.bestuursKpis());
  });

  app.get("/api/bestuur/boekhoudexport", async (_req, res) => {
    res.json(await storage.boekhoudExport());
  });

  app.get("/api/bestuur/boekhoudexport.csv", async (_req, res) => {
    const regels = await storage.boekhoudExport();
    const kolommen = [
      "documenttype", "nummer", "datum", "klant", "klantBtw",
      "bedragExclBtw", "btwTarief", "btwBedrag", "bedragInclBtw", "munt", "kanaal",
    ];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[";\\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lijnen = [kolommen.join(";")];
    for (const r of regels) {
      lijnen.push(kolommen.map((k) => esc((r as any)[k])).join(";"));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="boekhoudexport_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + lijnen.join("\n"));
  });
}
