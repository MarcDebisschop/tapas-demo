/**
 * server/routes/admin.ts
 * 
 * Domeinrouter: Admin authenticatie en afname-inzicht.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 * 
 * Routes:
 *   POST /api/admin/login
 *   GET  /api/admin/me
 *   POST /api/admin/logout
 *   GET  /api/admin/afnames
 *   GET  /api/admin/afnames/:id
 *   GET  /api/admin/afnames/:id/dashboardtoken
 *   GET  /api/admin/afnames/:id/contract.json
 *   GET  /api/admin/interesse
 */

import type { Express } from "express";
import { storage, db } from "../storage";
import { verifieerWachtwoord } from "../auth/wachtwoord";
import { vereisAdmin, adminIdVanSessie, AANMELD_VERSIE } from "../admin-guard";
import { zetSessieIdentiteit, wisSessieIdentiteit } from "../sessie-identiteit";
import { vereisScope, scopeVanVerzoek, bepaalScope } from "../scope-guard";
import { schrijfAuditLog } from "../audit-log";
import { alleInstrumenten } from "../registry";
import { isDemoModus } from "../demomodus";
import {
  parseOrganisatieId,
  filterAfnames,
  ONBEKEND_LABEL,
} from "../opvolging-per-instrument";

// Demo-modus: identiek criterium als elders in de server (TAPAS_DEMO="1").
// In demo blijft de login e-mail-only (wachtwoord wordt genegeerd), zodat de
// publieke demo alles automatisch invult. In de definitieve modus (geen
// demo-vlag) is een correct wachtwoord verplicht.
// S-4 (audit): de demomodus komt uit één bron (server/demomodus.ts) en is in
// productie altijd uit, ook wanneer TAPAS_DEMO=1 gezet zou zijn.
const DEMO_MODE = isDemoModus();

export function registerAdminRoutes(app: Express): void {
  // --- Admin: login ---
  app.post("/api/admin/login", async (req, res) => {
    const { email, wachtwoord } = req.body || {};
    if (!email) return res.status(400).json({ message: "E-mailadres ontbreekt." });
    const beheerder = await storage.getBeheerderByEmail(email.trim().toLowerCase());
    if (!beheerder || !beheerder.actief) {
      return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
    }
    // Heeft dit account een wachtwoord, dan wordt dat wachtwoord ALTIJD
    // gevraagd, ook in demo-modus. De beheeromgeving stond anders open voor
    // iedereen die een geldig e-mailadres kende, want de demo-modus sloeg de
    // controle over. Een demo mag schermen tonen, geen sloten openzetten.
    if (beheerder.wachtwoordHash) {
      if (!wachtwoord) {
        return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
      }
      const geldig = await verifieerWachtwoord(String(wachtwoord), beheerder.wachtwoordHash);
      if (!geldig) {
        return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
      }
    } else if (!DEMO_MODE) {
      // Geen wachtwoord ingesteld voor dit account in de definitieve modus.
      if (!wachtwoord) {
        return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
      }
      return res.status(403).json({
        message:
          "Voor dit account is nog geen wachtwoord ingesteld. Neem contact op met de hoofdbeheerder.",
      });
    }
    // H-1 (audit): sessie-id vernieuwen vóór het zetten van de identiteit
    // (bescherming tegen session fixation).
    try {
      await zetSessieIdentiteit(req, { adminId: beheerder.id, aanmeldVersie: AANMELD_VERSIE });
    } catch {
      return res.status(500).json({ message: "Sessie opslaan mislukt." });
    }
    res.json({
      ok: true,
      naam: beheerder.naam,
      email: beheerder.email,
      isPrior: beheerder.isPrior,
    });
  });

  app.get("/api/admin/me", async (req, res) => {
    try {
      const adminId = (req as any).session?.adminId;
      if (!adminId) return res.status(401).json({ message: "Niet ingelogd." });
      const beheerder = await storage.getBeheerder(Number(adminId));
      if (!beheerder || !beheerder.actief)
        return res.status(401).json({ message: "Sessie verlopen." });
      // De frontend moet weten WAT ze mag tonen. `isPrior` alleen volstaat
      // niet: fase 3 beslist prior centraal op `isPrior` EN de
      // prior-organisatie, en een scherm dat enkel naar de vlag kijkt zou
      // ruimer zijn dan de server. Daarom sturen we de scope zelf mee, uit
      // dezelfde bron als de guards.
      const scope = await bepaalScope(req);
      const organisatieId = scope.soort === "organisatie" ? scope.organisatieId : null;
      res.json({
        ok: true,
        naam: beheerder.naam,
        email: beheerder.email,
        // Blijft staan voor bestaande oproepers; nieuwe schermen horen naar
        // `scope` te kijken.
        isPrior: beheerder.isPrior,
        scope: scope.soort,
        organisatieId,
        organisatieNaam:
          organisatieId === null
            ? null
            : ((await storage.getOrganisatie(organisatieId))?.naam ?? null),
      });
    } catch {
      res.status(401).json({ message: "Niet ingelogd." });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    // H-1 (audit): identiteit wissen én het sessie-id vervangen, zodat een
    // eerder buitgemaakte cookie na uitloggen niets meer oplevert.
    try {
      await wisSessieIdentiteit(req, ["adminId"]);
    } catch {
      // Uitloggen mag nooit falen voor de gebruiker; de identiteit is al weg.
    }
    res.json({ ok: true });
  });

  // --- Admin: lijst van afnames ---
  // ADDITIEF: optionele filters `instrument` en `organisatie_id`. Zonder
  // filters is het gedrag exact zoals voordien (alle afnames, zelfde volgorde).
  // Per rij komen instrumentId/instrumentLabel en organisatieId/organisatieNaam
  // mee, zodat de UI per instrument kan groeperen zonder extra bevragingen.
  app.get("/api/admin/afnames", vereisScope, async (req, res) => {
    // De scope komt uit de sessie. `organisatie_id` hieronder is voor de prior
    // een FILTER binnen wat hij toch al mag zien, nooit een manier om buiten
    // de eigen scope te kijken: de datalaag heeft de rijen dan al beperkt.
    const scope = scopeVanVerzoek(req);
    const list = await storage.listAfnames(scope);

    const instrumentFilter = String(req.query.instrument ?? "").trim();
    const ruweOrg = req.query.organisatie_id;
    let orgFilter: number | null = null;
    if (ruweOrg !== undefined && String(ruweOrg).trim() !== "") {
      // Enkel de prior kan zinvol op organisatie filteren. Bij een
      // organisatie-scope weigeren we de parameter in plaats van hem te
      // negeren: stil negeren zou de indruk wekken dat het filter werkte.
      if (scope.soort !== "prior") {
        return res.status(403).json({ error: "Filteren op organisatie is voorbehouden aan de hoofdbeheerder." });
      }
      orgFilter = parseOrganisatieId(ruweOrg);
      // Een ongeldige filterwaarde stil negeren zou ongefilterd alles tonen.
      if (orgFilter === null) {
        return res.status(400).json({ error: "Ongeldige organisatie_id." });
      }
    }

    const labels = new Map(alleInstrumenten().map((d) => [d.instrumentId, d.name]));
    const orgNamen = new Map(
      (await storage.listOrganisaties()).map((o) => [o.id, o.naam] as const),
    );

    const gefilterd = filterAfnames(list, {
      instrument: instrumentFilter,
      organisatieId: orgFilter,
    });

    res.json(
      gefilterd.map((a) => ({
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
        instrumentId: a.instrumentId ?? null,
        instrumentLabel: a.instrumentId
          ? (labels.get(a.instrumentId) ?? a.instrumentId)
          : ONBEKEND_LABEL,
        organisatieId: a.organisatieId ?? null,
        organisatieNaam: a.organisatieId ? (orgNamen.get(a.organisatieId) ?? null) : null,
      })),
    );
  });

  // --- Admin: volledig profiel + generator-JSON van één afname ---
  //
  // Stond tot fase 1 volledig open: iedereen kon met een oplopend id het
  // volledige profiel van elke deelnemer opvragen. De respons bevatte boven-
  // dien de `dashboardToken` van de deelnemer, en die token geeft rechtstreeks
  // toegang tot het persoonlijke dashboard. Die token zit nu achter een eigen,
  // geauditeerde actie (zie hieronder), net zoals contract.json.
  app.get("/api/admin/afnames/:id", vereisAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json({
      ...a,
      mainResponses: a.mainResponses ? JSON.parse(a.mainResponses) : null,
      connectionAnswers: a.connectionAnswers ? JSON.parse(a.connectionAnswers) : null,
      generatorContract: a.generatorContract ? JSON.parse(a.generatorContract) : null,
    });
  });

  // --- Admin: het volledige doorgifteregister (AVG art. 30) ---------------
  // P-2 (audit): het register bevatte enkel de taalmodelkoppeling. De
  // mailkoppeling - het tweede kanaal waarlangs persoonsgegevens het platform
  // verlaten - stond er niet in. Dit endpoint geeft beide kanalen in één lijst,
  // afgeleid uit de feitelijke configuratie, zodat het register controleerbaar is.
  app.get("/api/admin/doorgifteregister", vereisAdmin, async (_req, res) => {
    const { duidingDoorgifteRegister } = await import("../duiding-manager");
    const { volledigDoorgifteRegister } = await import("../doorgifteregister");
    res.json({
      opgevraagdOp: new Date().toISOString(),
      kanalen: volledigDoorgifteRegister(duidingDoorgifteRegister()),
    });
  });

  // --- Admin: dashboardtoken van de deelnemer, expliciet en geauditeerd ---
  // Aparte actie omdat deze token toegang geeft tot het deelnemersdashboard.
  // Aantoonbaarheid (AVG art. 5.2): elke opvraging laat een spoor na.
  app.get("/api/admin/afnames/:id/dashboardtoken", vereisAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    let dashboardToken: string | null = null;
    if (a.deelnemerEmail) {
      const deelnemer = await storage.getDeelnemerByEmail(a.deelnemerEmail);
      if (deelnemer) dashboardToken = deelnemer.dashboardToken;
    }
    schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "afname_inzage",
      afnameId: id,
      detail: "opvraging dashboardtoken",
    });
    res.json({ dashboardToken });
  });

  // --- Download generator-JSON als bestand ---
  app.get("/api/admin/afnames/:id/contract.json", vereisAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a || !a.generatorContract) {
      return res.status(404).json({ error: "Geen generator-JSON beschikbaar" });
    }
    // Aantoonbaarheid (AVG art. 5.2): een beheerder die profieldata downloadt,
    // laat een spoor na.
    schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "afname_inzage",
      afnameId: id,
      detail: "download generator-contract",
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${a.respondentCode}_generator-contract.json"`,
    );
    res.send(a.generatorContract);
  });

  // --- Admin: interesse-registraties ---
  app.get("/api/admin/interesse", async (req, res) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
    try {
      const sqlite = (db as any)._db ?? (storage as any).sqlite ?? null;
      if (!sqlite) return res.json([]);
      const rows = sqlite
        .prepare(
          "SELECT id, naam, email, product, bericht, geregistreerd_op FROM interesse_registraties ORDER BY geregistreerd_op DESC",
        )
        .all();
      return res.json(rows);
    } catch {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });
}
