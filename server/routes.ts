import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { storage, db, CreditError, CREDITPAKKETTEN } from "./storage";
import { buildQuestionManagerRoutes } from "./question-manager";
import { registerCoachesAcademyMailRoutes } from "./routes-coaches-academy-mail";
import { registerStmRoutes } from "./routes-stm";
import { clientInstrument } from "./instrument";
import { instrumentSamenvattingen, clientInstrumentVoor } from "./registry";
import { buildGeneratorContract } from "./scoring";
import { normaliseerTaal } from "@shared/i18n";
import { isTalentFocusConstruct } from "@shared/talent-constructs";
import {
  insertAfnameSchema,
  submitMainSchema,
  submitConnectionSchema,
  insertOrganisatieSchema,
  insertBillerSchema,
  laadCreditsSchema,
  overdrachtSchema,
  startBetalingSchema,
  genereerRapportSchema,
  creditnotaSchema,
  bewaartermijnSchema,
  inviteAfnameSchema,
  startViaLinkSchema,
  deelnemerLoginSchema,
  updateDeelnemerSchema,
  chatVraagSchema,
  maakLicentieSchema,
  maakSessieSchema,
  voegKringlidSchema,
} from "@shared/schema";
import { bouwDashboardData } from "./dashboard";
import { bouwChatProfiel, chatSuggesties, CHAT_CONFIG, COACH_PLACEHOLDER } from "./chat";
import { parseProfiel, beantwoord as beantwoordProfielvraag, detecteerVraagTaal } from "./chat-engine";
import { bepaalRegio, kiesCoach, COACH_ROL, type RegioSleutel } from "./coach-register";
import { bouwGalerij, galerijLabels } from "./galerij";
import { bouwModule, MODULE_IDS } from "./modules";
import { bouwUitlegScript, VLAAMSE_STEM_PROMPT, type Toon } from "./uitleg";
import { registerT4RRoutes } from "./t4r/routes";
import { registerTeamscanRoutes } from "./teamscan/routes";
import { registerHddRoutes } from "./hdd/routes";
import { registerToegangRoutes } from "./toegang/routes";
import { z } from "zod";

// De Python-LLM-sidecar draait op poort 8000 binnen de sandbox.
const CHAT_SIDECAR_URL = process.env.TAPAS_CHAT_SIDECAR ?? "http://127.0.0.1:8000";

// In de gepubliceerde demo-omgeving is er geen live LLM-sidecar. We laten de
// assistent dan toch "leven" met een reflectief, niet-diagnostisch demo-antwoord.
const DEMO_MODE = process.env.TAPAS_DEMO === "1";

// In de demo is er geen live LLM. We laten de assistent toch 'leven' met een
// reflectief, niet-diagnostisch antwoord dat ECHT uit het profiel put: de
// profielcontext (talentfoci, versterkend gedrag, energie, drivers) zit al in
// `profielContext`. We weven daar een passende, gevarieerde reflectie omheen.
function demoChatReply(taal: string, profielContext?: string, vraag?: string): string {
  const t = (taal || "nl").toLowerCase();
  const ctx = (profielContext || "").trim();
  const heeftProfiel = ctx.length > 0 && !/algemene|g\u00e9n\u00e9rale|general/i.test(ctx.slice(0, 40));

  // Korte, leesbare samenvatting van het profiel uit de meegegeven context.
  const fociMatch = ctx.match(/(?:talentfoci|focus de talent|talent foci)[^:]*:\s*([^.]+)\./i);
  const versnMatch = ctx.match(/(?:Versterkend gedrag|comportement amplificateur|Amplifying behaviour)\s*:\s*([^.]+)\./i);
  const energieMatch = ctx.match(/([0-9]+[\.,][0-9])\s*\/\s*10/);
  const driverMatch = ctx.match(/(?:Drivers om in het oog te houden|Drivers \u00e0 surveiller|Drivers to keep an eye on)[^:]*:\s*([^.;]+)[.;]/i);
  const foci = fociMatch ? fociMatch[1].trim() : null;
  const versn = versnMatch ? versnMatch[1].trim() : null;
  const energie = energieMatch ? energieMatch[1] : null;
  const driver = driverMatch ? driverMatch[1].trim() : null;

  if (t.startsWith("fr")) {
    if (!heeftProfiel)
      return "Bonne question. Termine d'abord le questionnaire : ton profil personnel rendra mes r\u00e9ponses bien plus concr\u00e8tes. En attendant, observe quand ton \u00e9nergie monte au travail \u2014 c'est d\u00e9j\u00e0 une piste. Ceci est une aide \u00e0 la r\u00e9flexion, pas un diagnostic.";
    const p: string[] = [];
    if (foci) p.push(`Tes focus de talent les plus forts (${foci}) sont l\u00e0 o\u00f9 le travail est le plus fluide.`);
    if (versn) p.push(`Tu les amplifies via ${versn} : appuie-toi dessus cette semaine.`);
    if (energie) p.push(`Ton \u00e9nergie mesur\u00e9e \u00e9tait de ${energie}/10 \u2014 compare-la \u00e0 ton ressenti.`);
    if (driver) p.push(`Garde un \u0153il sur le driver ${driver}, qui peut te co\u00fbter de l'\u00e9nergie.`);
    p.push("Choisis une t\u00e2che concr\u00e8te qui s'appuie sur tes forces et observe ce qui change. Ceci est une aide \u00e0 la r\u00e9flexion, pas un diagnostic.");
    return p.join(" ");
  }
  if (t.startsWith("en")) {
    if (!heeftProfiel)
      return "Good question. Complete the questionnaire first \u2014 your personal profile will make my answers far more concrete. Meanwhile, notice when your energy rises at work; that's already a clue. This is a reflection aid, not a diagnosis.";
    const p: string[] = [];
    if (foci) p.push(`Your strongest talent foci (${foci}) are where work feels most effortless.`);
    if (versn) p.push(`You amplify them through ${versn} \u2014 lean on that this week.`);
    if (energie) p.push(`Your measured energy was ${energie}/10 \u2014 compare it with how you felt.`);
    if (driver) p.push(`Keep an eye on the ${driver} driver, which can cost you energy.`);
    p.push("Pick one concrete task that draws on your strengths and notice what shifts. This is a reflection aid, not a diagnosis.");
    return p.join(" ");
  }
  if (!heeftProfiel)
    return "Goede vraag. Rond eerst de vragenlijst af \u2014 met je persoonlijke profiel worden mijn antwoorden veel concreter. Let ondertussen op wanneer je energie stijgt op het werk; dat is al een aanwijzing. Dit is een reflectiehulp, geen diagnose.";
  const p: string[] = [];
  if (foci) p.push(`Je sterkste talentfoci (${foci}) zijn waar werk het meest moeiteloos verloopt.`);
  if (versn) p.push(`Je versterkt dat via ${versn} \u2014 daar mag je deze week op leunen.`);
  if (energie) p.push(`Je gemeten energie was ${energie}/10 \u2014 leg die naast hoe je het zelf beleefde.`);
  if (driver) p.push(`Houd de driver ${driver} in het oog; die kan je net energie kosten.`);
  p.push("Kies \u00e9\u00e9n concrete taak die op je sterktes leunt en merk op wat er verschuift. Dit is een reflectiehulp, geen diagnose.");
  return p.join(" ");
}

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Instrumentdefinitie voor de frontend (vragenlijst-structuur) ---
  // Optionele ?taal= bepaalt in welke taal item-/vraagteksten worden geleverd.
  app.get("/api/instrument", (req, res) => {
    const taal = normaliseerTaal(req.query.taal);
    res.json(clientInstrument(taal));
  });

  // --- Instrument-registry (Fase 1): lijst van beschikbare instrumenten ---
  // Maakt het platform multi-instrument: de frontend kan straks kiezen welk
  // instrument (individueel of collaboratief) wordt getoond. Gedrag-behoudend:
  // de bestaande /api/instrument blijft het standaard individuele instrument.
  app.get("/api/instruments", (_req, res) => {
    res.json(instrumentSamenvattingen());
  });

  // Taalbewuste client-view voor een specifiek (individueel) instrument uit de
  // registry. Valt terug op het standaard-instrument; levert 404 voor een
  // onbekend id en 415 voor een (nog) niet-individueel instrument.
  app.get("/api/instruments/:instrumentId", (req, res) => {
    const taal = normaliseerTaal(req.query.taal);
    const view = clientInstrumentVoor(req.params.instrumentId, taal);
    if (view === null) {
      return res
        .status(415)
        .json({ error: "Dit instrument levert geen individuele vragenlijst-view." });
    }
    res.json(view);
  });

  // --- Nieuwe afname starten (consent + identiteit + baseline) ---
  // Optioneel gekoppeld aan een organisatie. Is er een organisatie, dan moet
  // er een credit beschikbaar zijn: dat credit wordt meteen GERESERVEERD
  // (reservering bij linkaanmaak) en definitief verbruikt bij voltooiing.
  const startAfnameSchema = insertAfnameSchema.extend({
    organisatieId: z.number().int().positive().optional(),
  });
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
  // De beheerder maakt een uitnodiging (link) aan zonder zelf in te vullen.
  // Het credit wordt al gereserveerd bij het aanmaken van de link. De
  // deelnemer komt binnen via /deelnemer/:token, geeft toestemming + baseline,
  // en doorloopt dan deel 1 en deel 2.
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
      // Escape-hatch: de deelnemer mag de taal nog wijzigen vóór deel 1. We
      // bevriezen ze hier definitief (status wordt 'deel1').
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

  // --- Deel 1 (hoofdvragenlijst) inleveren ---
  // --- Tussentijds bewaren van deel 1 (concept) ---
  // De deelnemer kan onderweg stoppen en later verdergaan waar hij stopte.
  // We bewaren de (mogelijk onvolledige) antwoorden in mainResponses ZONDER de
  // status naar 'deel2' te schakelen. Alleen toegestaan zolang de afname nog
  // niet voltooid is. Het blok-schema laat null-velden toe, dus halve blokken
  // bewaren prima.
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
    // Idempotent: als er niets gereserveerd is, gebeurt er niets.
    if (a.organisatieId != null) {
      try {
        await storage.verbruik(a.organisatieId, a.id);
      } catch {
        // Verbruik mag de profielgeneratie nooit blokkeren; loggen volstaat.
      }
    }

    res.json({ afname: updated, contract, dashboardToken });
  });

  // --- Admin: login / sessie (demo-versie) ---
  // In de demo-versie: e-mail wordt gecheckt tegen de beheerders-tabel.
  // Wachtwoord wordt niet opgeslagen — elke beheerder kan inloggen met zijn e-mail.
  app.post("/api/admin/login", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "E-mailadres ontbreekt." });
    const beheerder = await storage.getBeheerderByEmail(email.trim().toLowerCase());
    if (!beheerder || !beheerder.actief) {
      return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
    }
    // Sla beheerder-id op in sessie (cookie-gebaseerd, in-memory)
    (req.session as any).adminId = beheerder.id;
    // Expliciet opslaan zodat de Set-Cookie header zeker in de response zit.
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Sessie opslaan mislukt." });
      res.json({ ok: true, naam: beheerder.naam, email: beheerder.email, isPrior: beheerder.isPrior });
    });
  });

  app.get("/api/admin/me", async (req, res) => {
    try {
      const adminId = (req as any).session?.adminId;
      if (!adminId) return res.status(401).json({ message: "Niet ingelogd." });
      const beheerder = await storage.getBeheerder(Number(adminId));
      if (!beheerder || !beheerder.actief) return res.status(401).json({ message: "Sessie verlopen." });
      res.json({ ok: true, naam: beheerder.naam, email: beheerder.email, isPrior: beheerder.isPrior });
    } catch (err) {
      res.status(401).json({ message: "Niet ingelogd." });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  // --- Admin: lijst van afnames ---
  app.get("/api/admin/afnames", async (_req, res) => {
    const list = await storage.listAfnames();
    // Lichte samenvatting voor de tabel.
    res.json(
      list.map((a) => ({
        id: a.id,
        respondentCode: a.respondentCode,
        name: a.name,
        company: a.company,
        role: a.role,
        status: a.status,
        taal: a.taal,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
        inviteToken: a.inviteToken,
        uitgenodigdAt: a.uitgenodigdAt,
        herinnerdAt: a.herinnerdAt,
      }))
    );
  });

  // --- Admin: volledig profiel + generator-JSON van één afname ---
  app.get("/api/admin/afnames/:id", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    // Dashboard-token van de gekoppelde deelnemer (voor o.a. gesproken uitleg voor de coach).
    let dashboardToken: string | null = null;
    if (a.deelnemerEmail) {
      const deelnemer = await storage.getDeelnemerByEmail(a.deelnemerEmail);
      if (deelnemer) dashboardToken = deelnemer.dashboardToken;
    }
    res.json({
      ...a,
      dashboardToken,
      mainResponses: a.mainResponses ? JSON.parse(a.mainResponses) : null,
      connectionAnswers: a.connectionAnswers ? JSON.parse(a.connectionAnswers) : null,
      generatorContract: a.generatorContract ? JSON.parse(a.generatorContract) : null,
    });
  });

  // --- Download generator-JSON als bestand (Content-Disposition attachment) ---
  app.get("/api/admin/afnames/:id/contract.json", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a || !a.generatorContract) {
      return res.status(404).json({ error: "Geen generator-JSON beschikbaar" });
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${a.respondentCode}_generator-contract.json"`
    );
    res.send(a.generatorContract);
  });

  // =========================================================================
  // Fase C1 — Organisaties, credits & biller (commerciële laag)
  // =========================================================================

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

  // --- Organisatietendenzen: geaggregeerd, niet-individueel teambeeld --------
  // Bundelt de voltooide profielen van een organisatie tot een collectief
  // beeld: dominante talentfoci, energieverdeling en driver-belasting. Strikt
  // geaggregeerd (min. 3 profielen) zodat geen enkel individu herleidbaar is.
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

  // --- Credits handmatig opladen (aankoop registreren) ---
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

  // --- Credits overdragen tussen organisaties (boekhoudkundige overdracht) ---
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

  // Helper: bepaal het aantal credits uit pakket of expliciet aantal.
  function creditsUitPayload(pakketId?: string, credits?: number): number | null {
    if (pakketId) {
      const p = CREDITPAKKETTEN.find((x) => x.id === pakketId);
      if (p) return p.credits;
    }
    if (credits && credits > 0) return credits;
    return null;
  }

  // Start een betaling: maakt een 'open' betaling aan. In productie zou hier de
  // Mollie-API een checkout-URL teruggeven; in dit prototype simuleren we dat.
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

  // Webhook-equivalent: bevestig een geslaagde betaling. In productie roept
  // Mollie deze endpoint aan na een geslaagde betaling. Hier triggeren we 'm
  // expliciet (gesimuleerde betaling). Dit laadt credits op én maakt de factuur.
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

  // Markeer een betaling als mislukt (gesimuleerde annulatie/mislukking).
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

  // Download het Peppol/UBL-document (provider-neutraal) als JSON-bestand.
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
  // Fase C3 — Rapportgeneratie (contract -> afgewerkt TaPas-rapport)
  // =========================================================================

  app.post("/api/rapporten", async (req, res) => {
    const parsed = genereerRapportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    try {
      const rapport = await storage.genereerRapport(parsed.data.afnameId, parsed.data.variant);
      res.json({
        id: rapport.id,
        afnameId: rapport.afnameId,
        variant: rapport.variant,
        titel: rapport.titel,
        contractVersie: rapport.contractVersie,
        createdAt: rapport.createdAt,
        inhoud: JSON.parse(rapport.inhoud),
      });
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Rapportgeneratie mislukt";
      res.status(400).json({ error: msg });
    }
  });

  app.get("/api/rapporten", async (req, res) => {
    const afnameId = req.query.afnameId ? Number(req.query.afnameId) : undefined;
    const list = await storage.listRapporten(afnameId);
    res.json(
      list.map((r) => ({
        id: r.id,
        afnameId: r.afnameId,
        variant: r.variant,
        titel: r.titel,
        contractVersie: r.contractVersie,
        createdAt: r.createdAt,
      }))
    );
  });

  app.get("/api/rapporten/:id", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Rapport niet gevonden" });
    // pdfBase64 kan groot zijn en is alleen nodig in de /html en /download
    // endpoints — hou de JSON-payload licht en geef enkel een vlag mee.
    const { pdfBase64, ...rest } = r as any;
    res.json({ ...rest, heeftPdf: !!pdfBase64, inhoud: JSON.parse(r.inhoud) });
  });

  // Bekijk het rapport (voor weergave/afdruk). Wanneer er een echt PDF-document
  // aan het rapport hangt (pdfBase64), wordt dat definitieve document inline
  // getoond — zo toont een T4P Business Kompas met een echt document altijd dat
  // document. Anders valt de weergave terug op de gegenereerde HTML.
  app.get("/api/rapporten/:id/html", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).send("Rapport niet gevonden");
    const pdf = (r as any).pdfBase64 as string | null | undefined;
    if (pdf) {
      const buf = Buffer.from(pdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return res.send(buf);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(r.html);
  });

  // Download het volledige rapport als zelfstandig HTML-bestand. Identieke
  // inhoud als /html, maar met Content-Disposition: attachment zodat de browser
  // het bestand bewaart in plaats van het in een tabblad te tonen. De
  // bestandsnaam wordt afgeleid van de rapporttitel (veilig genormaliseerd).
  app.get("/api/rapporten/:id/download", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).send("Rapport niet gevonden");
    const veiligeNaam =
      (r.titel || "profiel")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80) || "profiel";
    const pdf = (r as any).pdfBase64 as string | null | undefined;
    if (pdf) {
      const buf = Buffer.from(pdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${veiligeNaam}.pdf"`,
      );
      return res.send(buf);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${veiligeNaam}.html"`,
    );
    res.send(r.html);
  });

  // =========================================================================
  // Fase C4a — Creditnota's (boekhoudkundige correctie op een factuur)
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
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lijnen = [kolommen.join(";")];
    for (const r of regels) {
      lijnen.push(kolommen.map((k) => esc((r as any)[k])).join(";"));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="boekhoudexport_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send("\uFEFF" + lijnen.join("\n"));
  });

  // =========================================================================
  // Fase C4c — GDPR: betrokkenenrechten
  // =========================================================================

  // In de publieke demo-modus worden de raadbare GDPR-persoonsexports
  // afgeschermd: deze leveren volledige persoonsgegevens op via een eenvoudig
  // volgnummer en horen niet thuis op een open demolink. De demo-UI gebruikt
  // deze routes niet; in productie/intern (TAPAS_DEMO != "1") blijven ze actief.
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

  // -------------------------------------------------------------------------
  // TaPas Persoonlijk — Fase 1: deelnemer-login (magic-link) & dashboard.
  //
  // GEEN wachtwoorden. De deelnemer geeft zijn e-mail op; we maken/vinden een
  // deelnemer-account en geven de persoonlijke dashboard-URL terug. In Fase 1
  // retourneren we het token rechtstreeks (de e-mailverzending komt in Fase 3).
  // De URL is /#/dashboard/:token — een lange, onraadbare sleutel.
  // -------------------------------------------------------------------------
  app.post("/api/deelnemers/login", async (req, res) => {
    const parsed = deelnemerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldig e-mailadres" });
    }
    const deelnemer = await storage.vindOfMaakDeelnemer(parsed.data.email, parsed.data.taal);
    // Fase 3 stuurt hier een echte e-mail; nu geven we het token direct terug.
    res.json({
      ok: true,
      dashboardToken: deelnemer.dashboardToken,
      taal: deelnemer.taal,
      // Indicatie of er al ingevulde vragenlijsten gekoppeld zijn.
      heeftAfnames: (await storage.listAfnamesVoorDeelnemer(deelnemer.email)).length > 0,
    });
  });

  // Het persoonlijk dashboard: deelnemer + afnames + afgeleide dashboard-data.
  app.get("/api/dashboard/:token", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const taal = normaliseerTaal(deelnemer.taal);
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);

    // De meest recente voltooide afname bepaalt de hero/quotes/energie.
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    const dashboard = recentste ? bouwDashboardData(recentste.generatorContract, taal) : null;

    // Afnamelijst met (eventuele) gegenereerde rapporten.
    const afnameLijst = [] as Array<{
      id: number;
      naam: string;
      bedrijf: string | null;
      status: string;
      taal: string;
      voltooidOp: string | null;
      rapporten: Array<{ id: number; variant: string; titel: string }>;
    }>;
    for (const a of afnames) {
      const raps = await storage.listRapporten(a.id);
      afnameLijst.push({
        id: a.id,
        naam: a.name,
        bedrijf: a.company ?? null,
        status: a.status,
        taal: a.taal,
        voltooidOp: a.completedAt ?? null,
        rapporten: raps.map((r) => ({ id: r.id, variant: r.variant, titel: r.titel })),
      });
    }

    // Fase 2: vragenlijst-galerij ('Vragenlijsten voor jou') met matching.
    const galerij = {
      labels: galerijLabels(taal as any),
      items: bouwGalerij(recentste?.generatorContract ?? null, taal as any),
    };

    res.json({
      deelnemer: {
        id: deelnemer.id,
        email: deelnemer.email,
        naam: deelnemer.naam,
        fotoUrl: deelnemer.fotoUrl,
        taal: deelnemer.taal,
        mailCadans: deelnemer.mailCadans,
      },
      dashboard,
      afnames: afnameLijst,
      galerij,
    });
  });

  // Profiel bijwerken (naam, foto, taal, mailcadans) vanuit het dashboard.
  app.patch("/api/dashboard/:token", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const parsed = updateDeelnemerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    // Bescherm tegen overdreven grote foto-uploads (data-URL > ~3 MB).
    if (parsed.data.fotoUrl && parsed.data.fotoUrl.length > 4_000_000) {
      return res.status(413).json({ error: "Foto is te groot (max ~3 MB)" });
    }
    const updated = await storage.updateDeelnemer(deelnemer.id, parsed.data);
    res.json({
      ok: true,
      deelnemer: updated && {
        id: updated.id,
        email: updated.email,
        naam: updated.naam,
        fotoUrl: updated.fotoUrl,
        taal: updated.taal,
        mailCadans: updated.mailCadans,
      },
    });
  });

  // -------------------------------------------------------------------------
  // TaPas Persoonlijk — Fase 2: AI-profielassistent (chatbot).
  //
  // - Gratis limiet + bijgekocht tegoed (CHAT_CONFIG, centraal instelbaar).
  // - Zorg-kompas: profielsignalen (laag A) reizen mee naar de sidecar; die
  //   doet live inhoudsdetectie (laag B/C) en kan warm naar een coach verwijzen.
  // - "Driver" blijft beschermd & onvertaald (afgehandeld in de sidecar/prompt).
  // -------------------------------------------------------------------------

  async function chatProfielVoor(deelnemerEmail: string, taal: string, naam: string | null) {
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    return bouwChatProfiel(recentste?.generatorContract ?? null, normaliseerTaal(taal) as any, naam);
  }

  // Levert het ruwe contract (voor de profielassistent-engine) van de recentste
  // voltooide afname; null als er nog geen voltooid profiel is.
  async function ruwChatContractVoor(deelnemerEmail: string): Promise<unknown | null> {
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    return voltooid[0]?.generatorContract ?? null;
  }

  function limietStatus(deelnemer: { vragenGebruikt: number; vragenTegoed: number }) {
    const totaal = CHAT_CONFIG.gratisLimiet + (deelnemer.vragenTegoed ?? 0);
    const gebruikt = deelnemer.vragenGebruikt ?? 0;
    return {
      gebruikt,
      gratisLimiet: CHAT_CONFIG.gratisLimiet,
      tegoed: deelnemer.vragenTegoed ?? 0,
      totaal,
      resterend: Math.max(0, totaal - gebruikt),
      pakketGrootte: CHAT_CONFIG.pakketGrootte,
      geblokkeerd: gebruikt >= totaal,
    };
  }

  // Begeleidende boodschap bij de coach-doorverwijzing (warm, niet-diagnostisch),
  // per taal. Los van de coachgegevens zelf, die uit het coach-register komen.
  const COACH_BERICHT: Record<string, string> = {
    nl: "Sommige vragen verdienen een echt gesprek. Hieronder vind je een coach bij jou in de buurt die samen met jou, rustig en in vertrouwen, kan kijken naar wat er speelt.",
    fr: "Certaines questions méritent une vraie conversation. Voici un coach près de chez vous qui peut regarder avec vous, en confiance, ce qui se passe.",
    en: "Some questions deserve a real conversation. Below is a coach near you who can look at what's going on together with you, calmly and in confidence.",
    es: "Algunas preguntas merecen una conversación real. Aquí tienes un coach cerca de ti que puede observar contigo, con calma y confianza, lo que ocurre.",
    ru: "Некоторые вопросы заслуживают настоящего разговора. Ниже — коуч рядом с вами, который спокойно и доверительно посмотрит вместе с вами на то, что происходит.",
  };
  const DEMO_LABEL: Record<string, string> = {
    nl: "Voorbeeldgegevens (demo)",
    fr: "Données d'exemple (démo)",
    en: "Sample data (demo)",
    es: "Datos de ejemplo (demo)",
    ru: "Демо-данные (пример)",
  };

  // Leid de regio van de deelnemer af uit de organisatie van zijn afname(s).
  // Terugval op "Vlaanderen" (landelijke coach) als er geen gemeente bekend is.
  async function regioVoorDeelnemer(email: string): Promise<RegioSleutel> {
    try {
      const afnames = await storage.listAfnamesVoorDeelnemer(email);
      for (const af of afnames) {
        const orgId = (af as any).organisatieId as number | null | undefined;
        if (orgId == null) continue;
        const org = await storage.getOrganisatie(orgId);
        const gemeente = (org as any)?.gemeente as string | null | undefined;
        if (gemeente) return bepaalRegio(gemeente);
      }
    } catch {
      // stil terugvallen
    }
    return "Vlaanderen";
  }

  // Bouw de coachkaart voor de UI: echte (of demo-)coach uit het register,
  // gekozen op de regio van de deelnemer, met een warme begeleidende boodschap.
  function coachKaart(taal: string, regio: RegioSleutel) {
    const tt = normaliseerTaal(taal) as keyof typeof COACH_ROL;
    const coach = kiesCoach(regio);
    if (!coach) {
      // Uiterste terugval: generieke placeholder (zou normaal niet voorkomen).
      return {
        naam: COACH_PLACEHOLDER.naam,
        rol: COACH_PLACEHOLDER.rol[tt] ?? COACH_PLACEHOLDER.rol.nl,
        regio: COACH_PLACEHOLDER.regio,
        bericht: COACH_BERICHT[tt] ?? COACH_BERICHT.nl,
        plaats: null,
        expertise: [] as string[],
        email: null,
        demo: false,
        demoLabel: null,
      };
    }
    return {
      naam: coach.naam,
      rol: COACH_ROL[tt] ?? COACH_ROL.nl,
      regio: coach.plaats,
      bericht: COACH_BERICHT[tt] ?? COACH_BERICHT.nl,
      plaats: coach.plaats,
      expertise: coach.expertise,
      email: coach.email,
      demo: coach.demo === true,
      demoLabel: coach.demo === true ? (DEMO_LABEL[tt] ?? DEMO_LABEL.nl) : null,
    };
  }

  app.get("/api/dashboard/:token/chat", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const taal = normaliseerTaal(deelnemer.taal);
    const berichten = await storage.listChatBerichten(deelnemer.id);
    const regio = await regioVoorDeelnemer(deelnemer.email);
    res.json({
      berichten: berichten.map((b) => ({ id: b.id, rol: b.rol, inhoud: b.inhoud, veiligheid: b.veiligheid })),
      limiet: limietStatus(deelnemer),
      suggesties: chatSuggesties(taal as any),
      coach: coachKaart(taal, regio),
    });
  });

  // -------------------------------------------------------------------------
  // Verdiepende leesmodule (Galerij "Starten"-knop).
  //
  // Bouwt 100% uit het eigen profiel een meerstaps lees-/reflectie-ervaring
  // (talent-verdieping, energie-monitor, drivers-onder-druk). Geen live LLM,
  // dus geen hallucinaties: elk feit, cijfer en citaat komt uit het contract.
  // Zelfde token->contract-pad als de chat.
  // -------------------------------------------------------------------------
  app.get("/api/dashboard/:token/module/:id", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });

    const moduleId = req.params.id;
    if (!MODULE_IDS.includes(moduleId)) {
      return res.status(404).json({ error: "Module niet gevonden" });
    }

    const taal = normaliseerTaal(req.query.taal ?? deelnemer.taal);
    const ruwContract = await ruwChatContractVoor(deelnemer.email);
    const inhoud = bouwModule(moduleId, ruwContract, taal as any, deelnemer.naam ?? null);
    if (!inhoud) return res.status(404).json({ error: "Module niet gevonden" });

    res.json({ module: inhoud });
  });

  app.post("/api/dashboard/:token/chat", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });

    const parsed = chatVraagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Stel een vraag" });
    }

    const status = limietStatus(deelnemer);
    if (status.geblokkeerd) {
      return res.status(402).json({ error: "limiet_bereikt", limiet: status });
    }

    const standaardTaal = normaliseerTaal(deelnemer.taal);
    // Antwoord in de taal van de VRAAG (NL/FR/EN/ES/RU), met de deelnemer-taal
    // als terugval. Zo krijgt elke bezoeker antwoord in zijn eigen taal.
    const taal = detecteerVraagTaal(parsed.data.vraag, standaardTaal as any);

    // De profielassistent-engine draait altijd lokaal in de server: ze leest het
    // ECHTE contract, herkent de intentie van de vraag (begrip/energie/talent/
    // driver/taak/coach ...) en bouwt een antwoord uit een gecureerde kennisbank
    // + de echte profieldata. Geen externe LLM nodig -> werkt in de gepubliceerde
    // demo en kan per definitie niet hallucineren.
    const ruwContract = await ruwChatContractVoor(deelnemer.email);
    const feiten = parseProfiel(ruwContract, deelnemer.naam);

    let reply = "";
    let veiligheid: string | null = null;

    // Optioneel: als er tóch een live LLM-sidecar bereikbaar is (ontwikkel-/
    // toekomst-omgeving), gebruiken we die; anders valt alles terug op de engine.
    let sidecarGelukt = false;
    if (!DEMO_MODE) {
      try {
        const profiel = await chatProfielVoor(deelnemer.email, deelnemer.taal, deelnemer.naam);
        const historie = await storage.listChatBerichten(deelnemer.id);
        const messages = [
          ...historie.map((b) => ({ role: b.rol, content: b.inhoud })),
          { role: "user", content: parsed.data.vraag },
        ];
        const r = await fetch(`${CHAT_SIDECAR_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taal, profiel_context: profiel.context, risico: profiel.risico, messages }),
        });
        const data: any = await r.json().catch(() => ({}));
        if (r.ok && !data.error && String(data.reply ?? "").trim()) {
          reply = String(data.reply).trim();
          veiligheid = data.veiligheid ?? null;
          sidecarGelukt = true;
        }
      } catch {
        // stil terugvallen op de engine
      }
    }

    if (!sidecarGelukt) {
      const uit = beantwoordProfielvraag(parsed.data.vraag, feiten, taal as any);
      reply = uit.reply;
      veiligheid = uit.veiligheid;
    }

    if (!reply) {
      return res.status(502).json({ error: "Leeg antwoord van de assistent." });
    }

    await storage.voegChatBerichtToe(deelnemer.id, "user", parsed.data.vraag, null);
    const opgeslagen = await storage.voegChatBerichtToe(deelnemer.id, "assistant", reply, veiligheid);
    const bijgewerkt = await storage.verhoogVragenGebruikt(deelnemer.id);

    const coachRegio = veiligheid === "coach" ? await regioVoorDeelnemer(deelnemer.email) : null;
    res.json({
      antwoord: { id: opgeslagen.id, rol: "assistant", inhoud: reply, veiligheid },
      limiet: limietStatus(bijgewerkt ?? deelnemer),
      coach: coachRegio ? coachKaart(taal, coachRegio) : null,
    });
  });

  // Extra vragen bijkopen (DEMO: simuleert een Mollie/Bancontact-betaling).
  app.post("/api/dashboard/:token/koop-extra", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const bijgewerkt = await storage.voegVragenTegoedToe(deelnemer.id, CHAT_CONFIG.pakketGrootte);
    if (!bijgewerkt) return res.status(404).json({ error: "Deelnemer niet gevonden" });
    res.json({ ok: true, demo: true, pakketGrootte: CHAT_CONFIG.pakketGrootte, limiet: limietStatus(bijgewerkt) });
  });

  // -------------------------------------------------------------------------
  // GESPROKEN PROFIELUITLEG (audio, 6 blokken)
  // - Twee tonen: "deelnemer" (warm) en "coach" (zakelijk, coachgericht).
  // - Elke toon heeft een eigen 10-gratis-dan-betalen limiet (testfase: de coach
  //   betaalt zelf na 10 sessies).
  // - Audio is browser-side (Web Speech API); de backend levert alleen het script
  //   (6 blokken) + de limietstatus. "Driver" blijft beschermd & onvertaald.
  // -------------------------------------------------------------------------

  const UITLEG_CONFIG = { gratisLimiet: 10, pakketGrootte: 25 };

  function uitlegLimietStatus(
    deelnemer: {
      uitlegGebruiktDeelnemer?: number;
      uitlegTegoedDeelnemer?: number;
      uitlegGebruiktCoach?: number;
      uitlegTegoedCoach?: number;
    },
    toon: Toon,
  ) {
    const gebruikt =
      (toon === "coach" ? deelnemer.uitlegGebruiktCoach : deelnemer.uitlegGebruiktDeelnemer) ?? 0;
    const tegoed =
      (toon === "coach" ? deelnemer.uitlegTegoedCoach : deelnemer.uitlegTegoedDeelnemer) ?? 0;
    const totaal = UITLEG_CONFIG.gratisLimiet + tegoed;
    return {
      toon,
      gebruikt,
      gratisLimiet: UITLEG_CONFIG.gratisLimiet,
      tegoed,
      totaal,
      resterend: Math.max(0, totaal - gebruikt),
      pakketGrootte: UITLEG_CONFIG.pakketGrootte,
      geblokkeerd: gebruikt >= totaal,
    };
  }

  // Haalt het ruwe generatorContract van de recentste voltooide afname op.
  async function ruwContractVoor(deelnemerEmail: string): Promise<unknown | null> {
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    return recentste?.generatorContract ?? null;
  }

  function leesToon(raw: unknown): Toon {
    return raw === "coach" ? "coach" : "deelnemer";
  }

  // GET: levert het uitleg-script (6 blokken) + limietstatus voor de gevraagde toon.
  app.get("/api/dashboard/:token/uitleg", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.query.toon);
    const taal = normaliseerTaal(deelnemer.taal);
    const contractRaw = await ruwContractVoor(deelnemer.email);
    const script = bouwUitlegScript(contractRaw, taal as any, toon, deelnemer.naam ?? undefined);
    res.json({
      script,
      limiet: uitlegLimietStatus(deelnemer, toon),
    });
  });

  // POST: registreert één uitleg-sessie (verhoogt de juiste teller) en levert
  // het script terug. 402 wanneer de limiet voor die toon bereikt is.
  app.post("/api/dashboard/:token/uitleg", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.body?.toon);

    const status = uitlegLimietStatus(deelnemer, toon);
    if (status.geblokkeerd) {
      return res.status(402).json({ error: "limiet_bereikt", limiet: status });
    }

    const taal = normaliseerTaal(deelnemer.taal);
    const contractRaw = await ruwContractVoor(deelnemer.email);
    const script = bouwUitlegScript(contractRaw, taal as any, toon, deelnemer.naam ?? undefined);
    if (!script) {
      return res.status(404).json({ error: "Nog geen voltooid profiel om uit te leggen." });
    }

    const bijgewerkt = await storage.verhoogUitlegGebruikt(deelnemer.id, toon);
    res.json({
      script,
      limiet: uitlegLimietStatus(bijgewerkt ?? deelnemer, toon),
    });
  });

  // Extra uitleg-sessies bijkopen per toon (DEMO: simuleert een betaling).
  app.post("/api/dashboard/:token/uitleg/koop-extra", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.body?.toon);
    const bijgewerkt = await storage.voegUitlegTegoedToe(deelnemer.id, toon, UITLEG_CONFIG.pakketGrootte);
    if (!bijgewerkt) return res.status(404).json({ error: "Deelnemer niet gevonden" });
    res.json({
      ok: true,
      demo: true,
      toon,
      pakketGrootte: UITLEG_CONFIG.pakketGrootte,
      limiet: uitlegLimietStatus(bijgewerkt, toon),
    });
  });


  // =========================================================================
  // SULAFAT TTS — Vlaamse stem (Gemini 2.5 Pro TTS, voice=sulafat)
  // POST /api/tts  { tekst: string }
  // Geeft mp3-audio terug. Altijd Vlaamse tongval via VLAAMSE_STEM_PROMPT.
  // Geen token vereist (tekst komt van de client, niet uit de DB).
  // =========================================================================
  app.post("/api/tts", (req, res) => {
    const tekst: string = (req.body?.tekst ?? "").trim();
    if (!tekst) return res.status(400).json({ error: "tekst vereist" });
    if (tekst.length > 4000) return res.status(400).json({ error: "tekst te lang (max 4000 tekens)" });

    const volledigeTekst = VLAAMSE_STEM_PROMPT + "\n\n" + tekst;
    // tts.py staat naast index.cjs in dist/ (gekopieerd door build.mjs)
    const ttsScript = join(process.cwd(), "dist", "tts.py");

    const py = spawn("python3", [ttsScript, volledigeTekst]);
    const chunks: Buffer[] = [];

    py.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    py.stderr.on("data", (d: Buffer) => console.error("[tts]", d.toString()));

    py.on("close", (code) => {
      if (code !== 0 || chunks.length === 0) {
        if (!res.headersSent) res.status(500).json({ error: "TTS mislukt" });
        return;
      }
      const audio = Buffer.concat(chunks);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audio.length);
      res.setHeader("Cache-Control", "no-store");
      res.end(audio);
    });
  });

  // =========================================================================
  // T4Recruitment — Fase 2: collaboratief instrument (sessies, kring, links).
  //
  // Inhoud/logica van T4Recruitment wijzigt niet: de collaboratieve toestand,
  // de vergelijkende studie en het virtuele rolprofiel worden als JSON-
  // contracten één-op-één bewaard. Deze routes regelen enkel de platform-schil:
  // betaalbron (credits/licentie), uitnodigingslinks en statusovergangen.
  // =========================================================================

  // --- Licenties (losse, buiten-platform verkoop) --------------------------
  // De beheerder maakt zelf een licentiesleutel met twee instelbare variabelen:
  // het aantal toegestane profielen en de prijs per profiel.
  app.get("/api/licenties", async (_req, res) => {
    res.json(await storage.listLicenties());
  });

  app.post("/api/licenties", async (req, res) => {
    const parsed = maakLicentieSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const d = parsed.data;
    const lic = await storage.maakLicentie({
      klantnaam: d.klantnaam,
      klantEmail: d.klantEmail || null,
      maxProfielen: d.maxProfielen ?? null,
      prijsPerProfielCent: Math.round((d.prijsPerProfiel ?? 0) * 100),
      geldigTot: d.geldigTot || null,
      notities: d.notities || null,
    });
    res.status(201).json(lic);
  });

  app.post("/api/licenties/:id/intrekken", async (req, res) => {
    const lic = await storage.trekLicentieIn(Number(req.params.id));
    if (!lic) return res.status(404).json({ error: "Licentie niet gevonden" });
    res.json(lic);
  });

  // --- Sessies (rolprofiel-trajecten) --------------------------------------
  app.get("/api/sessies", async (_req, res) => {
    res.json(await storage.listSessies());
  });

  // Een sessie aanmaken. Precies één betaalbron: een organisatie (platform-
  // credits) OF een licentiesleutel (losse verkoop). Het credit wordt nog niet
  // gereserveerd — dat gebeurt pas bij het vergrendelen van de kring.
  app.post("/api/sessies", async (req, res) => {
    const parsed = maakSessieSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const d = parsed.data;
    let licentieId: number | null = null;
    if (d.licentieSleutel) {
      const lic = await storage.getLicentieBySleutel(d.licentieSleutel.trim().toUpperCase());
      if (!lic) return res.status(404).json({ error: "Onbekende licentiesleutel" });
      if (lic.status !== "actief") return res.status(403).json({ error: "Licentie is niet actief" });
      licentieId = lic.id;
    }
    const sessie = await storage.maakSessie({
      titel: d.titel,
      facilitatorNaam: d.facilitatorNaam || null,
      facilitatorEmail: d.facilitatorEmail || null,
      taal: d.taal ?? "nl",
      organisatieId: d.organisatieId ?? null,
      licentieId,
    });
    res.status(201).json(sessie);
  });

  // Sessie-detail incl. kring en studies (samengesteld beeld voor de facilitator).
  app.get("/api/sessies/:id", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const [kring, studies] = await Promise.all([
      storage.listKringleden(sessie.id),
      storage.listStudies(sessie.id),
    ]);
    res.json({ ...sessie, kring, studies });
  });

  // De collaboratieve toestand bijwerken (modules, keuzes, alignment, ...).
  // De inhoud is een "black box": we bewaren ze één-op-één als JSON.
  app.put("/api/sessies/:id/state", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const updated = await storage.updateSessie(sessie.id, {
      sessieState: JSON.stringify(req.body ?? {}),
      ...(typeof req.body?.status === "string" ? { status: req.body.status } : {}),
    });
    res.json(updated);
  });

  // Een kringlid (stakeholder/observer) toevoegen — alleen vóór vergrendeling.
  app.post("/api/sessies/:id/kring", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    if (sessie.kringVergrendeld) {
      return res.status(409).json({ error: "kring_vergrendeld", boodschap: "De kring is vergrendeld. Heropen ze eerst (kost credits)." });
    }
    const parsed = voegKringlidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const lid = await storage.voegKringlidToe(sessie.id, {
      rol: parsed.data.rol,
      naam: parsed.data.naam || null,
      email: parsed.data.email || null,
    });
    res.status(201).json(lid);
  });

  // Een kringlid verwijderen — alleen vóór vergrendeling.
  app.delete("/api/sessies/:id/kring/:lidId", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    if (sessie.kringVergrendeld) {
      return res.status(409).json({ error: "kring_vergrendeld" });
    }
    await storage.verwijderKringlid(Number(req.params.lidId));
    res.status(204).end();
  });

  // De kring vergrendelen + het sessietarief reserveren (credits) of de
  // licentie valideren. Hierna kan de individuele input starten.
  app.post("/api/sessies/:id/vergrendel", async (req, res) => {
    try {
      const sessie = await storage.vergrendelKring(Number(req.params.id));
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // De kring heropenen (uitzonderlijk) — kost het instelbare heropeningstarief.
  app.post("/api/sessies/:id/heropen", async (req, res) => {
    try {
      const sessie = await storage.heropenKring(Number(req.params.id));
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // De sessie finaliseren — definitief verbruik (credits) of licentieteller +1.
  app.post("/api/sessies/:id/finaliseer", async (req, res) => {
    try {
      const sessie = await storage.finaliseerSessie(Number(req.params.id), req.body?.rolprofielContract);
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // Een vergelijkende studie toevoegen (kandidaat vs. rolprofiel) — 0 credits.
  app.post("/api/sessies/:id/studies", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const label = typeof req.body?.kandidaatLabel === "string" ? req.body.kandidaatLabel : "Kandidaat";
    const studie = await storage.voegStudieToe(sessie.id, label, req.body?.studieContract);
    res.status(201).json(studie);
  });

  // --- Publieke kringlid-link: /r/:token -----------------------------------
  // Een kringlid komt via zijn persoonlijke, rolgebonden link binnen. Observers
  // krijgen alleen-lezen; stakeholders mogen input geven. Het token onthult het
  // volgnummer-id niet (zelfde principe als de deelnemerslink).
  app.get("/api/r/:token", async (req, res) => {
    const lid = await storage.getKringlidByToken(req.params.token);
    if (!lid) return res.status(404).json({ error: "Uitnodiging niet gevonden" });
    const sessie = await storage.getSessie(lid.sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    // Markeer toegetreden bij eerste bezoek.
    if (lid.status === "uitgenodigd") {
      await storage.updateKringlid(lid.id, { status: "toegetreden", toegetredenAt: new Date().toISOString() });
    }
    res.json({
      rol: lid.rol,
      readOnly: lid.rol === "observer",
      naam: lid.naam,
      lidId: lid.id,
      sessie: {
        id: sessie.id,
        titel: sessie.titel,
        taal: sessie.taal,
        status: sessie.status,
        kringVergrendeld: sessie.kringVergrendeld,
        sessieState: sessie.sessieState ? JSON.parse(sessie.sessieState) : null,
      },
    });
  });

  // Een stakeholder bewaart zijn individuele input via zijn link. Observers
  // mogen dit niet (alleen lezen).
  app.put("/api/r/:token/input", async (req, res) => {
    const lid = await storage.getKringlidByToken(req.params.token);
    if (!lid) return res.status(404).json({ error: "Uitnodiging niet gevonden" });
    if (lid.rol === "observer") {
      return res.status(403).json({ error: "Observers hebben alleen-leestoegang." });
    }
    const updated = await storage.updateKringlid(lid.id, {
      individueleInput: JSON.stringify(req.body ?? {}),
      status: "input-klaar",
    });
    res.json({ ok: true, lidId: updated?.id });
  });

  // -------------------------------------------------------------------------
  // T4Recruitment — ingeplugde routes (eigen module-namespace).
  // De volledige T4R-beslislogica draait ONGEWIJZIGD onder /api/t4r/...
  // met credit-/collaboratiebrug naar de Fase 2-laag. Zie server/t4r/routes.ts.
  // -------------------------------------------------------------------------
  registerT4RRoutes(app);

  // -------------------------------------------------------------------------
  // TaPas Teamscan — collaboratief reflectie-/ontwikkelinstrument (Lencioni).
  // -------------------------------------------------------------------------
  registerTeamscanRoutes(app);

  // -------------------------------------------------------------------------
  // Human Due Diligence — vlaggenschip-traject (journey). Orkestreert Teamscan
  // + 2MINSCAN (Fase 1) en T4P Business (Fase 2) voor één board, met een
  // Go/No-Go-scharnier. Zie server/hdd/routes.ts.
  // -------------------------------------------------------------------------
  registerHddRoutes(app);

  // -------------------------------------------------------------------------
  // Toegang & accreditatie — governance-laag. Prior beheerders (TaPasCity)
  // beheren wie toegang heeft tot welk platformdeel, en wie geaccrediteerd is
  // om T4P Business-profielen aan te maken. Zie server/toegang/routes.ts.
  // -------------------------------------------------------------------------
  registerToegangRoutes(app);

  // -------------------------------------------------------------------------
  // Question Manager — prior-beheerder beheert stellingen van alle instrumenten
  // Enkel toegankelijk voor is_prior=true beheerders.
  // -------------------------------------------------------------------------
  buildQuestionManagerRoutes(app);

  // -------------------------------------------------------------------------
  // Webshop — interesse-registratie
  // Publiek endpoint: iedereen (ook demo-bezoekers) kan interesse registreren.
  // Opgeslagen in SQLite-tabel `interesse_registraties`.
  // Beheerders kunnen ophalen via GET /api/admin/interesse.
  // -------------------------------------------------------------------------
  app.post("/api/interesse", async (req, res) => {
    const { naam, email, product, bericht } = req.body ?? {};
    if (!naam?.trim() || !email?.trim() || !product?.trim()) {
      return res.status(400).json({ error: "naam, email en product zijn verplicht." });
    }
    // Simpele e-mailvalidatie
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Ongeldig e-mailadres." });
    }
    try {
      const sqlite = (db as any)._db ?? (storage as any).sqlite ?? null;
      if (sqlite) {
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS interesse_registraties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            naam TEXT NOT NULL,
            email TEXT NOT NULL,
            product TEXT NOT NULL,
            bericht TEXT,
            geregistreerd_op TEXT NOT NULL
          )
        `);
        sqlite.prepare(
          "INSERT INTO interesse_registraties (naam, email, product, bericht, geregistreerd_op) VALUES (?, ?, ?, ?, ?)"
        ).run(
          naam.trim(),
          email.trim().toLowerCase(),
          product.trim(),
          (bericht ?? "").trim() || null,
          new Date().toISOString()
        );
      }
      console.log(`[Webshop] Interesse: ${naam.trim()} <${email.trim()}> → ${product.trim()}`);
      return res.json({ ok: true });
    } catch (e) {
      console.error("[Webshop] Interesse opslaan mislukt:", e);
      return res.status(500).json({ error: "Opslaan mislukt — probeer later opnieuw." });
    }
  });

  // Beheerder-overzicht: alle interesse-registraties
  app.get("/api/admin/interesse", async (req, res) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
    try {
      const sqlite = (db as any)._db ?? (storage as any).sqlite ?? null;
      if (!sqlite) return res.json([]);
      const rows = sqlite.prepare(
        "SELECT id, naam, email, product, bericht, geregistreerd_op FROM interesse_registraties ORDER BY geregistreerd_op DESC"
      ).all();
      return res.json(rows);
    } catch {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // Extra routes: coaches, academy, mailbeheer, inzichtcentrum
  registerCoachesAcademyMailRoutes(app, db, storage);

  // Extra routes: coach-login + Self-Training Module (STM)
  registerStmRoutes(app, storage);

  return httpServer;
}
