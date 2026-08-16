import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { db, storage } from "./storage";
import { buildQuestionManagerRoutes } from "./question-manager";
import { buildDuidingManagerRoutes } from "./duiding-manager";
import { buildGidsManagerRoutes } from "./gids-manager";
import { registerGidsPdfRoutes } from "./gids/routes";
import { registerCoachesAcademyMailRoutes } from "./routes-coaches-academy-mail";
import { registerTendensMonitoringRoutes } from "./tendens-monitoring";
import { registerStmRoutes } from "./routes-stm";
import { registerAdminStmVoortgangRoutes } from "./admin-stm-voortgang";
import { registerT4RRoutes } from "./t4r/routes";
import { registerTeamscanRoutes } from "./teamscan/routes";
import { registerHddRoutes } from "./hdd/routes";
import { registerTrajectRoutes } from "./traject/routes";
import { registerToegangRoutes } from "./toegang/routes";
import { registerDeelnemerRoutes } from "./routes-deelnemer";
import { startCreditRecoveryJob } from "./credit-recovery";
import { startBewaartermijnJob } from "./bewaartermijn-job";
import { startInstrumentBackfill } from "./instrument-backfill";
import { startOrganisatieKoppeling } from "./organisatie-koppeling";
import { registerOrganisatieAuthRoutes } from "./routes/organisatie-auth";
import { registerOrganisatieBeheerRoutes } from "./routes/organisatie-beheer";
import { registerT4SportsRoutes } from "./t4sports/routes";
import { registerT4SportsModuleRoutes } from "./t4sports/module-routes";
import { registerCoachContactRoutes } from "./routes-coach-contact";
import { registerOnthaalContactRoutes } from "./routes-onthaal-contact";
import { registerPriveAankoopRoutes } from "./prive-aankoop/routes";
import { registerBulkImportRoutes } from "./bulk-import/routes";
import { registerNormprofielRoutes } from "./bekwaamheid/routes-normprofiel";
import { registerRegiekamerRoutes } from "./bekwaamheid/routes-regiekamer";
import { registerLicentiebeeldRoutes } from "./bekwaamheid/routes-licentiebeeld";
import { registerRegisterRoutes } from "./bekwaamheid/routes-register";
import { registerItemRoutes } from "./bekwaamheid/routes-items";
import { registerRondeRoutes } from "./bekwaamheid/routes-rondes";
import { registerBeslissingRoutes } from "./bekwaamheid/routes-beslissingen";
import { registerCyclusRoutes } from "./bekwaamheid/routes-cyclus";
import { registerT4OrganizationsRoutes } from "./t4organizations/routes";
import { registerDriverScanRoutes } from "./driverscan/routes";
import { registerTwominscanRoutes } from "./twominscan/routes";
import { buildInstrumentBeschikbaarheidRoutes } from "./instrument-beschikbaarheid";

// Domeinrouters (item 1.1, Fase 5)
import { registerInstrumentRoutes } from "./routes/instrumenten";
import { registerAdminRoutes } from "./routes/admin";
import { registerOpvolgingRoutes } from "./routes/opvolging";
import { registerInteresseRoutes } from "./routes/interesse";
import { registerAfnameRoutes } from "./routes/afnames";
import { registerFinancieelRoutes } from "./routes/financieel";
import { registerRapportenRoutes } from "./routes/rapporten";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerT4RInlineRoutes } from "./routes/t4r";
import { registerWebinarRoutes } from "./routes/webinars";
import { registerInstrumentenCatalogusRoutes } from "./routes/instrumenten-catalogus";
import { registerVragenlijstT4TeensRoutes } from "./routes/vragenlijst-t4teens";
import { registerVragenlijstT4KidsRoutes } from "./routes/vragenlijst-t4kids";
import { registerT4KidsRapportRoutes } from "./routes/t4kids-rapport";

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

  // --- Organisatie-login: eigen e-mail + wachtwoord, zet organisatieId ---
  registerOrganisatieAuthRoutes(app);
  registerOrganisatieBeheerRoutes(app);

  // --- Opvolging per instrument (niveau 1 admin, niveau 2 organisatie) ---
  registerOpvolgingRoutes(app);

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

  // --- T4Teens vragenlijst (override-aware endpoint voor afname) ---
  registerVragenlijstT4TeensRoutes(app);

  // --- T4Kids vragenlijst (override-aware endpoint voor afname) ---
  registerVragenlijstT4KidsRoutes(app);

  // --- T4Kids rapport (additieve, T4Kids-eigen leesroute voor het kindrapport) ---
  registerT4KidsRapportRoutes(app);

  // -------------------------------------------------------------------------
  // T4Recruitment — ingeplugde routes (eigen module-namespace).
  // -------------------------------------------------------------------------
  registerT4RRoutes(app);

  // -------------------------------------------------------------------------
  // TaPas Teamscan — collaboratief reflectie-/ontwikkelinstrument (Lencioni).
  // -------------------------------------------------------------------------
  registerTeamscanRoutes(app);

  // -------------------------------------------------------------------------
  // TaPas 4 Organizations (T4O) — organisatie-talentprofiel via drie ringen
  // (leiding/medewerker/stakeholder). Nieuwe module (Regel 2): eigen bestanden.
  // -------------------------------------------------------------------------
  registerT4OrganizationsRoutes(app);

  // -------------------------------------------------------------------------
  // Driver-scan — 5 Kahler-drivers via de 10 T4P forced-choice blokken.
  // Nieuwe module (Regel 2): eigen bestanden; hergebruikt buildMainScores
  // ONGEWIJZIGD; raakt geen bestaand afname- of rapportpad aan.
  // -------------------------------------------------------------------------
  registerDriverScanRoutes(app);
  registerTwominscanRoutes(app);

  // -------------------------------------------------------------------------
  // Human Due Diligence — vlaggenschip-traject (journey).
  // -------------------------------------------------------------------------
  registerHddRoutes(app);

  // -------------------------------------------------------------------------
  // Regiekamer - organisatiegebonden trajectregister.
  // -------------------------------------------------------------------------
  registerTrajectRoutes(app);

  // -------------------------------------------------------------------------
  // Toegang & accreditatie — governance-laag.
  // -------------------------------------------------------------------------
  registerToegangRoutes(app);

  // -------------------------------------------------------------------------
  // Question Manager — prior-beheerder beheert stellingen van alle instrumenten.
  // -------------------------------------------------------------------------
  buildQuestionManagerRoutes(app);

  // -------------------------------------------------------------------------
  // Duiding Manager — prior-beheerder beheert de LIVE AI-duidinglaag (T4P-pilot).
  // Nieuwe module (Regel 2): eigen bestand, raakt geen bestaand rapportpad aan.
  // -------------------------------------------------------------------------
  buildDuidingManagerRoutes(app);

  // -------------------------------------------------------------------------
  // Instrument-beschikbaarheid — prior-beheerder geeft instrumenten vrij
  // (default UIT). Nieuwe module (Regel 2): eigen bestand, additief.
  // -------------------------------------------------------------------------
  buildInstrumentBeschikbaarheidRoutes(app);

  // -------------------------------------------------------------------------
  // De Instrumentengids — tekst-overrides (prior) + publieke PDF-downloads.
  // Nieuwe modules (Regel 2): raken geen bestaand bestand aan.
  // -------------------------------------------------------------------------
  buildGidsManagerRoutes(app);
  registerGidsPdfRoutes(app);

  // -------------------------------------------------------------------------
  // Webshop — interesse-registratie.
  // -------------------------------------------------------------------------
  registerInteresseRoutes(app);

  // Extra routes: coaches, academy, mailbeheer, inzichtcentrum
  registerCoachesAcademyMailRoutes(app, db, storage);

  // Inzichtcentrum — Tendensmonitoring (fase 0-1): datalaag + baseline.
  // Additief; maakt eigen tabellen idempotent aan, raakt bestaande niet.
  registerTendensMonitoringRoutes(app, db, storage);

  // Publiek coach-contactformulier (NIEUW, aparte module — Regel 2).
  // Hergebruikt coach_register.email (admin-beheerbaar); fallback info@tapascity.com.
  registerCoachContactRoutes(app);

  // Het contactformulier van de onthaalpagina (aparte module). Slaat de vraag
  // op en verstuurt ze naar info@tapascity.com, met de verzendstatus erbij.
  registerOnthaalContactRoutes(app);

  // Extra routes: coach-login + Self-Training Module (STM)
  registerStmRoutes(app, storage);

  // Admin: per-practitioner STM-modulevoortgang (read-only, additief)
  registerAdminStmVoortgangRoutes(app);

  // Deelnemer-domeinrouter: login, magic-link, dashboard, TTS (NP-2 fix 2026-06-30)
  registerDeelnemerRoutes(app);

  // -------------------------------------------------------------------------
  // T4Sports — mental talent profiel voor atleten.
  // -------------------------------------------------------------------------
  registerT4SportsRoutes(app);

  // T4Sports Extra Modules (M1/M2/M3) — ACSI-28, DFS-2/FSS-2, AIMS-7.
  // Additief: raakt geen bestaande bestanden aan.
  registerT4SportsModuleRoutes(app);

  // -------------------------------------------------------------------------
  // Privé-aankoopflow (particulieren) + admin-beheerbare prijzen-store.
  // Nieuwe module (Regel 2): eigen bestanden, hergebruikt factuur/Peppol-engine.
  // -------------------------------------------------------------------------
  registerPriveAankoopRoutes(app);

  // -------------------------------------------------------------------------
  // Bulk-import via Excel/CSV (meerdere instrumenten). Nieuwe module (Regel 2):
  // eigen bestanden, hergebruikt de bestaande uitnodig-/creditlogica.
  // -------------------------------------------------------------------------
  registerBulkImportRoutes(app);

  // -------------------------------------------------------------------------
  // Bekwaamheid — de norm (scherm 9.5). Drie schrijfwegen: neerleggen,
  // bijstellen zolang het concept is, en bevriezen. Er is met opzet geen weg
  // terug: de onwijzigbaarheid van een bevroren cesuur staat in de datalaag.
  // Nieuwe module (Regel 2): eigen bestanden.
  // -------------------------------------------------------------------------
  registerNormprofielRoutes(app);

  // -------------------------------------------------------------------------
  // Bekwaamheid — de regiekamer (scherm 9.6). Twee leeswegen: het beeld en de
  // poortsimulatie. Geen schrijfweg: dit scherm kijkt en verandert niets, ook
  // niet aan het auditlog. Nieuwe module (Regel 2): eigen bestanden.
  // -------------------------------------------------------------------------
  registerRegiekamerRoutes(app);

  // -------------------------------------------------------------------------
  // Bekwaamheid — het licentiebeeld (scherm 9.7). Eén leesweg die drie schermen
  // bedient: de kolom "licentie" op /admin/toegang, de statussen per coach op
  // /admin/coaches en de kaart op /coach/dashboard. Eén vraag, één antwoord.
  // Nieuwe module (Regel 2): eigen bestanden.
  // -------------------------------------------------------------------------
  registerLicentiebeeldRoutes(app);

  // -------------------------------------------------------------------------
  // Bekwaamheid — de vijf schrijfwegen van de module, in de volgorde waarin een
  // dossier ze doorloopt: het register en de licenties, de itembank, de ronde
  // met haar bewijsstukken en scores, de beslissing met het bezwaar, en de
  // tweejarige cyclus met haar tussentijdse controlemoment.
  //
  // Vijf bestanden en niet één: de scheiding volgt de blokken van het draaiboek,
  // zodat een wijziging in de beslisregels nooit een bestand raakt waarin het
  // register staat. Elke registratie neemt een injecteerbare opslaglaag aan, wat
  // de routetests op een databank in het geheugen laat lopen.
  // -------------------------------------------------------------------------
  registerRegisterRoutes(app);
  registerItemRoutes(app);
  registerRondeRoutes(app);
  registerBeslissingRoutes(app);
  registerCyclusRoutes(app);

  // Credit-recovery job: verlopen afnames vrijgeven (item 1.6, 2026-06-30)
  startCreditRecoveryJob(6);

  // Bewaartermijn-job: afnames met verstreken bewaartotDatum automatisch
  // anonimiseren (AVG art. 5.1.e opslagbeperking, art. 25 privacy by design).
  startBewaartermijnJob();

  // Eenmalige, idempotente aanvulling van afnames.instrument_id voor bestaande
  // rijen waar het instrument betrouwbaar uit het bevroren contract volgt.
  startInstrumentBackfill();

  // Eenmalige, idempotente naam-match van beheerders.organisatie naar
  // organisaties.id. Wat niet eenduidig matcht blijft NULL en wordt gelogd.
  startOrganisatieKoppeling();

  return httpServer;
}
