import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { db, storage } from "./storage";
import { buildQuestionManagerRoutes } from "./question-manager";
import { registerCoachesAcademyMailRoutes } from "./routes-coaches-academy-mail";
import { registerStmRoutes } from "./routes-stm";
import { registerT4RRoutes } from "./t4r/routes";
import { registerTeamscanRoutes } from "./teamscan/routes";
import { registerHddRoutes } from "./hdd/routes";
import { registerToegangRoutes } from "./toegang/routes";
import { registerDeelnemerRoutes } from "./routes-deelnemer";
import { startCreditRecoveryJob } from "./credit-recovery";

// Domeinrouters (item 1.1, Fase 5)
import { registerInstrumentRoutes } from "./routes/instrumenten";
import { registerAdminRoutes } from "./routes/admin";
import { registerInteresseRoutes } from "./routes/interesse";
import { registerAfnameRoutes } from "./routes/afnames";
import { registerFinancieelRoutes } from "./routes/financieel";
import { registerRapportenRoutes } from "./routes/rapporten";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerT4RInlineRoutes } from "./routes/t4r";
import { registerWebinarRoutes } from "./routes/webinars";
import { registerInstrumentenCatalogusRoutes } from "./routes/instrumenten-catalogus";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Instrument-registry ---
  registerInstrumentRoutes(app);

  // --- Afnames, uitnodigingen, GDPR ---
  registerAfnameRoutes(app);

  // --- Admin: login, sessie, afnames-overzicht ---
  registerAdminRoutes(app);

  // --- Financieel: organisaties, credits, billers, betalingen, facturen,
  //     creditnota's, bestuursrapportage ---
  registerFinancieelRoutes(app);

  // --- Rapportgeneratie ---
  registerRapportenRoutes(app);

  // --- TaPas Persoonlijk: dashboard, chat, uitleg, TTS ---
  registerDashboardRoutes(app);

  // --- T4Recruitment: licenties, sessies, kring, /api/r ---
  registerT4RInlineRoutes(app);

  // --- Webinar Ecosysteem (TaPas Terras) ---
  registerWebinarRoutes(app);

  // --- Instrumentencatalogus (demo-overzicht + admin) ---
  registerInstrumentenCatalogusRoutes(app);

  // -------------------------------------------------------------------------
  // T4Recruitment — ingeplugde routes (eigen module-namespace).
  // -------------------------------------------------------------------------
  registerT4RRoutes(app);

  // -------------------------------------------------------------------------
  // TaPas Teamscan — collaboratief reflectie-/ontwikkelinstrument (Lencioni).
  // -------------------------------------------------------------------------
  registerTeamscanRoutes(app);

  // -------------------------------------------------------------------------
  // Human Due Diligence — vlaggenschip-traject (journey).
  // -------------------------------------------------------------------------
  registerHddRoutes(app);

  // -------------------------------------------------------------------------
  // Toegang & accreditatie — governance-laag.
  // -------------------------------------------------------------------------
  registerToegangRoutes(app);

  // -------------------------------------------------------------------------
  // Question Manager — prior-beheerder beheert stellingen van alle instrumenten.
  // -------------------------------------------------------------------------
  buildQuestionManagerRoutes(app);

  // -------------------------------------------------------------------------
  // Webshop — interesse-registratie.
  // -------------------------------------------------------------------------
  registerInteresseRoutes(app);

  // Extra routes: coaches, academy, mailbeheer, inzichtcentrum
  registerCoachesAcademyMailRoutes(app, db, storage);

  // Extra routes: coach-login + Self-Training Module (STM)
  registerStmRoutes(app, storage);

  // Deelnemer-domeinrouter: login, magic-link, dashboard, TTS (NP-2 fix 2026-06-30)
  registerDeelnemerRoutes(app);

  // Credit-recovery job: verlopen afnames vrijgeven (item 1.6, 2026-06-30)
  startCreditRecoveryJob(6);

  return httpServer;
}
