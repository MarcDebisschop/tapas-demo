/**
 * server/routes/afnames.ts
 *
 * Domeinrouter: Afnames (vragenlijsten), uitnodigingen, GDPR-betrokkenenrechten.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 *
 * Routes:
 *   POST /api/afnames                         — nieuwe afname starten
 *   GET  /api/afnames/:id                     — afname ophalen
 *   POST /api/uitnodigingen                   — uitnodigingslink aanmaken
 *   GET  /api/uitnodigingen/:token            — uitnodiging ophalen via token
 *   POST /api/uitnodigingen/:token/start      — deelnemer start via link
 *   POST /api/afnames/:id/herinner            — herinnering markeren
 *   POST /api/afnames/:id/concept             — deel 1 tussentijds bewaren
 *   POST /api/afnames/:id/main                — deel 1 inleveren
 *   POST /api/afnames/:id/connection          — deel 2 inleveren + profiel genereren
 *   GET  /api/gdpr/afnames/:id/export         — GDPR persoonsexport (JSON)
 *   GET  /api/gdpr/afnames/:id/export.json    — GDPR persoonsexport (download)
 *   POST /api/gdpr/bewaartermijn              — bewaartermijn instellen
 *   POST /api/gdpr/afnames/:id/intrekken      — consent intrekken
 *   POST /api/gdpr/afnames/:id/anonimiseer    — afname anonimiseren
 */

import type { Express } from "express";
import { storage, CreditError } from "../storage";
import { normaliseerTaal } from "@shared/i18n";
import {
  insertAfnameSchema,
  submitMainSchema,
  submitConnectionSchema,
  inviteAfnameSchema,
  startViaLinkSchema,
  bewaartermijnSchema,
} from "@shared/schema";
import { buildGeneratorContract } from "../scoring";
import { z } from "zod";

// Genereert een leesbare respondentCode op basis van naam + jaar + volgnummer.
function makeRespondentCode(name: string, id: number): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
  const year = new Date().getFullYear();
  const seq = String(id).padStart(3, "0");
  return `${initials || "RES"}-${year}-${seq}`;
}

// In de demo is er geen live LLM. We laten de assistent toch 'leven' met een
// reflectief, niet-diagnostisch antwoord dat ECHT uit het profiel put.
const DEMO_MODE = process.env.TAPAS_DEMO === "1";

export function registerAfnameRoutes(app: Express): void {
  const startAfnameSchema = insertAfnameSchema.extend({
    organisatieId: z.number().int().positive().optional(),
  });

  // --- Nieuwe afname starten (consent + identiteit + baseline) ---
  app.post("/api/afnames", async (req, res) => {
    const parsed = startAfnameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const data = parsed.data;

    // Saldo-check vóór aanmaak: als er een organisatie is meegegeven, moet die
    // bestaan én minstens één beschikbaar credit hebben.
    if (data.organisatieId != null) {
      const org = await storage.getOrganisatie(data.organisatieId);
      if (!org) {
        return res.status(404).json({ error: "Organisatie niet gevonden" });
      }
      const saldo = await storage.getSaldo(data.organisatieId);
      if (saldo.beschikbaar < 1) {
        return res.status(402).json({
          error: "Onvoldoende credits. Laad credits op voordat je een link aanmaakt.",
          code: "GEEN_CREDITS",
        });
      }
    }

    // Tijdelijke unieke code; wordt na insert verfijnd met het echte id.
    const tempCode = `TMP-${Date.now()}`;
    // GDPR-bewijslast: leg IP + user-agent vast op het moment van toestemming.
    const consentIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    const consentUserAgent = (req.headers["user-agent"] as string) ?? null;
    const created = await storage.createAfname({
      organisatieId: data.organisatieId ?? null,
      respondentCode: tempCode,
      name: data.name,
      company: data.company ?? null,
      role: data.role ?? null,
      baselineEnergy: data.baselineEnergy,
      taal: normaliseerTaal(data.taal),
      instrumentId: data.instrumentId ?? null,
      consentScope: "profiel-generatie + rapport",
      consentTimestamp: new Date().toISOString(),
      consentIp,
      consentUserAgent,
    });

    // Reserveer het credit (beschikbaar -> gereserveerd). Lukt dit niet, dan
    // rollen we de afname terug zodat er geen "weeskind"-link ontstaat.
    if (data.organisatieId != null) {
      try {
        await storage.reserveer(data.organisatieId, created.id);
      } catch (e) {
        await storage.updateAfname(created.id, { status: "geannuleerd" });
        const msg = e instanceof CreditError ? e.message : "Reservering mislukt";
        return res.status(402).json({ error: msg, code: "GEEN_CREDITS" });
      }
    }

    const finalCode = makeRespondentCode(data.name, created.id);
    const updated = await storage.updateAfname(created.id, { respondentCode: finalCode });
    res.json(updated);
  });

  // --- Afname ophalen (voor hervatten / admin) ---
  app.get("/api/afnames/:id", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(a);
  });

  // =========================================================================
  // Fase D — Deelnemerslink / uitnodiging
  // =========================================================================

  // Beheerder: maak een uitnodiging (link) aan.
  app.post("/api/uitnodigingen", async (req, res) => {
    const parsed = inviteAfnameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const data = parsed.data;
    // Saldo-check + reservering wanneer er een organisatie is.
    if (data.organisatieId != null) {
      const org = await storage.getOrganisatie(data.organisatieId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
      const saldo = await storage.getSaldo(data.organisatieId);
      if (saldo.beschikbaar < 1) {
        return res.status(402).json({
          error: "Onvoldoende credits. Laad credits op voordat je een uitnodiging aanmaakt.",
          code: "GEEN_CREDITS",
        });
      }
    }
    const inv = await storage.maakUitnodiging({
      organisatieId: data.organisatieId ?? null,
      name: data.name ?? null,
      company: data.company ?? null,
      role: data.role ?? null,
      taal: normaliseerTaal(data.taal),
    });
    if (data.organisatieId != null) {
      try {
        await storage.reserveer(data.organisatieId, inv.id);
      } catch (e) {
        await storage.updateAfname(inv.id, { status: "geannuleerd" });
        const msg = e instanceof CreditError ? e.message : "Reservering mislukt";
        return res.status(402).json({ error: msg, code: "GEEN_CREDITS" });
      }
    }
    res.json(inv);
  });

  // Deelnemer: haal de uitnodiging op via het token (voor het landingsscherm).
  app.get("/api/uitnodigingen/:token", async (req, res) => {
    const a = await storage.getAfnameByToken(req.params.token);
    if (!a) return res.status(404).json({ error: "Deze link is ongeldig of verlopen." });
    // Geef enkel wat de deelnemer nodig heeft (geen interne velden).
    res.json({
      afnameId: a.id,
      token: a.inviteToken,
      name: a.name === "(nog niet ingevuld)" ? "" : a.name,
      company: a.company,
      role: a.role,
      status: a.status,
      taal: normaliseerTaal(a.taal),
      reedsGestart: a.status !== "uitgenodigd",
      voltooid: a.status === "voltooid",
    });
  });

  // Deelnemer: start via de link (toestemming + baseline + identiteit).
  app.post("/api/uitnodigingen/:token/start", async (req, res) => {
    const a = await storage.getAfnameByToken(req.params.token);
    if (!a) return res.status(404).json({ error: "Deze link is ongeldig of verlopen." });
    if (a.status === "voltooid") {
      return res.status(409).json({ error: "Deze afname is al voltooid." });
    }
    // Als de deelnemer al gestart is, sturen we de bestaande afname terug.
    if (a.status !== "uitgenodigd") {
      return res.json(a);
    }
    const parsed = startViaLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const data = parsed.data;
    const consentIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    const consentUserAgent = (req.headers["user-agent"] as string) ?? null;
    const finalCode = makeRespondentCode(data.name, a.id);
    const updated = await storage.updateAfname(a.id, {
      name: data.name,
      company: data.company ?? null,
      role: data.role ?? null,
      baselineEnergy: data.baselineEnergy,
      taal: normaliseerTaal(data.taal ?? a.taal),
      consentGiven: true,
      consentScope: "profiel-generatie + rapport",
      consentTimestamp: new Date().toISOString(),
      consentIp,
      consentUserAgent,
      respondentCode: finalCode,
      status: "deel1",
    });
    res.json(updated);
  });

  // Beheerder: markeer dat een herinnering werd verstuurd.
  app.post("/api/afnames/:id/herinner", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.markeerHerinnerd(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(a);
  });

  // --- Tussentijds bewaren van deel 1 (concept) ---
  app.post("/api/afnames/:id/concept", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (a.status === "voltooid") {
      return res.status(409).json({ error: "Deze afname is al voltooid." });
    }
    const parsed = submitMainSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ongeldige antwoorden voor deel 1" });
    }
    const updated = await storage.updateAfname(id, {
      mainResponses: JSON.stringify(parsed.data.responses),
    });
    res.json({ ok: true, status: updated?.status ?? a.status });
  });

  // --- Deel 1 (hoofdvragenlijst) inleveren ---
  app.post("/api/afnames/:id/main", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (a.status === "voltooid") {
      return res.status(409).json({ error: "Deze afname is al voltooid." });
    }
    const parsed = submitMainSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ongeldige antwoorden voor deel 1" });
    }
    const updated = await storage.updateAfname(id, {
      mainResponses: JSON.stringify(parsed.data.responses),
      status: "deel2",
    });
    res.json(updated);
  });

  // --- Deel 2 (verbondenheid) inleveren + profiel genereren ---
  app.post("/api/afnames/:id/connection", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!a.mainResponses) {
      return res.status(400).json({ error: "Deel 1 is nog niet ingeleverd" });
    }
    const parsed = submitConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ongeldige antwoorden voor deel 2" });
    }
    const connection = parsed.data.answers;
    const responses = JSON.parse(a.mainResponses);

    // Server-side scoring + generatie van het bevroren A3-contract.
    const contract = buildGeneratorContract({
      respondentCode: a.respondentCode,
      name: a.name,
      company: a.company,
      role: a.role,
      consentScope: a.consentScope,
      consentTimestamp: a.consentTimestamp,
      responses,
      baseline: a.baselineEnergy,
      connection,
      taal: a.taal,
    });

    let updated = await storage.updateAfname(id, {
      connectionAnswers: JSON.stringify(connection),
      generatorContract: JSON.stringify(contract),
      status: "voltooid",
      completedAt: new Date().toISOString(),
    });

    // TaPas Persoonlijk — Fase 1: als de deelnemer (optioneel) een e-mailadres
    // opgaf bij het afronden, koppelen we deze afname meteen aan een
    // deelnemer-account zodat ze later via hun persoonlijk dashboard inloggen.
    const emailRaw = (req.body && typeof req.body.email === "string") ? req.body.email.trim() : "";
    let dashboardToken: string | null = null;
    if (emailRaw && /.+@.+\..+/.test(emailRaw)) {
      try {
        updated = await storage.koppelAfnameAanDeelnemer(id, emailRaw) ?? updated;
        const deelnemer = await storage.vindOfMaakDeelnemer(emailRaw, a.taal);
        dashboardToken = deelnemer.dashboardToken;
      } catch {
        // Koppeling mag de profielgeneratie nooit blokkeren.
      }
    }

    // Definitief creditverbruik bij voltooiing (gereserveerd -> verbruikt).
    if (a.organisatieId != null) {
      try {
        await storage.verbruik(a.organisatieId, a.id);
      } catch {
        // Verbruik mag de profielgeneratie nooit blokkeren; loggen volstaat.
      }
    }

    res.json({ afname: updated, contract, dashboardToken });
  });

  // =========================================================================
  // Fase C4c — GDPR: betrokkenenrechten
  // =========================================================================

  app.get("/api/gdpr/afnames/:id/export", async (req, res) => {
    if (DEMO_MODE) {
      return res.status(403).json({ error: "Niet beschikbaar in de publieke demo." });
    }
    try {
      const pakket = await storage.gdprExport(Number(req.params.id));
      res.json(pakket);
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Export mislukt";
      res.status(404).json({ error: msg });
    }
  });

  app.get("/api/gdpr/afnames/:id/export.json", async (req, res) => {
    if (DEMO_MODE) {
      return res.status(403).json({ error: "Niet beschikbaar in de publieke demo." });
    }
    try {
      const pakket = await storage.gdprExport(Number(req.params.id));
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="gdpr-export_afname-${req.params.id}.json"`);
      res.send(JSON.stringify(pakket, null, 2));
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Export mislukt";
      res.status(404).json({ error: msg });
    }
  });

  app.post("/api/gdpr/bewaartermijn", async (req, res) => {
    const parsed = bewaartermijnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const updated = await storage.updateAfname(parsed.data.afnameId, {
      bewaartotDatum: parsed.data.bewaartotDatum,
    });
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(updated);
  });

  app.post("/api/gdpr/afnames/:id/intrekken", async (req, res) => {
    const updated = await storage.trekConsentIn(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(updated);
  });

  app.post("/api/gdpr/afnames/:id/anonimiseer", async (req, res) => {
    const reden = typeof req.body?.reden === "string" ? req.body.reden : "verzoek betrokkene";
    const updated = await storage.anonimiseerAfname(Number(req.params.id), reden);
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(updated);
  });
}
