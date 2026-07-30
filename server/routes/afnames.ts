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

import type { Express, Request, Response } from "express";
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
import { valideerLeeftijdspoort } from "@shared/leeftijd";
import { bewijsGeldig, bewijsUitBody, koppelBeslissing } from "../koppel-bewijs";
import { vereisAfnameBewijs } from "../afname-bewijs";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import {
  vereisScope,
  scopeVanVerzoek,
  valtBinnenScope,
  schrijfOrganisatieId,
  bepaalScope,
  verzenderVanVerzoek,
} from "../scope-guard";
import { getDefaultDescriptor } from "../registry";
import { schrijfAuditLog } from "../audit-log";
import { dashboardCodeVanToken, voornaamVanNaam } from "../dashboard-code";
import { buildGeneratorContract } from "../scoring";
import { buildT4StudentsContract } from "../t4students/scoring";
import { buildT4TeensContract } from "../t4teens/scoring";
import { buildT4KidsContract } from "../t4kids/scoring";
import { z } from "zod";

// Het instrument dat geldt wanneer de client er geen meestuurt.
//
// Dit is geen gok. Zowel de scoring (server/scoring.ts buildGeneratorContract)
// als de rapportregistry behandelen een afname zonder instrumentId vandaag al
// als het standaard-instrument: de else-tak hieronder in /connection bouwt het
// T4P-contract. Door dat bij aanmaak ook echt in de kolom te zetten, komt de
// opvolging per instrument overeen met wat de deelnemer feitelijk invult, in
// plaats van alles op "Onbekend" te laten vallen.
function standaardInstrumentId(): string {
  return getDefaultDescriptor().instrumentId;
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

    // Deze route heeft GEEN vereisScope: de deelnemersroutes (deel1, deel2,
    // reis-t4kids) starten hun afname hier en hebben per definitie geen sessie.
    // De organisatie in de body is daarom wel gescoped: wie geen scope heeft
    // mag geen organisatie aanduiden, want anders kan een anonieme bezoeker de
    // credits van een willekeurige organisatie opsouperen. De juiste weg voor
    // een organisatie-afname is een uitnodiging met token.
    const scope = await bepaalScope(req);
    const keuze = schrijfOrganisatieId(scope, parsed.data.organisatieId);
    if (!keuze.ok) {
      return res.status(403).json({
        error:
          scope.soort === "geen"
            ? "Een afname op naam van een organisatie vraagt een uitnodiging."
            : keuze.fout,
      });
    }
    const data = { ...parsed.data, organisatieId: keuze.organisatieId ?? undefined };

    // Leeftijdspoort (AVG art. 8) - ook hier afgedwongen, want de
    // T4Kids-belevingsroute start haar afname rechtstreeks via deze route en
    // niet via een uitnodigingslink.
    const poort = valideerLeeftijdspoort({
      instrumentId: data.instrumentId ?? null,
      leeftijdsband: data.leeftijdsband ?? null,
      ouderlijkeToestemming: data.ouderlijkeToestemming ?? false,
      ouderNaam: data.ouderNaam ?? null,
      ouderEmail: data.ouderEmail ?? null,
    });
    if (!poort.ok) {
      return res.status(400).json({ error: poort.fout });
    }

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
      // De verzender komt uit de sessie. Op het deelnemerspad is er geen
      // sessie en blijven beide velden null.
      ...(await verzenderVanVerzoek(req)),
      respondentCode: tempCode,
      name: data.name,
      company: data.company ?? null,
      role: data.role ?? null,
      baselineEnergy: data.baselineEnergy,
      taal: normaliseerTaal(data.taal),
      instrumentId: data.instrumentId ?? standaardInstrumentId(),
      consentScope: "profiel-generatie + rapport",
      consentTimestamp: new Date().toISOString(),
      consentIp,
      consentUserAgent,
      leeftijdsband: poort.band,
      ouderlijkeToestemming: poort.ouderlijkeToestemmingVereist,
      ouderlijkeToestemmingAt: poort.ouderlijkeToestemmingVereist ? new Date().toISOString() : null,
      ouderNaam: poort.ouderlijkeToestemmingVereist ? (data.ouderNaam ?? "").trim() : null,
      ouderEmail: poort.ouderlijkeToestemmingVereist ? (data.ouderEmail ?? "").trim() : null,
      ouderlijkeToestemmingIp: poort.ouderlijkeToestemmingVereist ? consentIp : null,
      ouderlijkeToestemmingUserAgent: poort.ouderlijkeToestemmingVereist ? consentUserAgent : null,
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
  //
  // Dit endpoint kan NIET achter `vereisAdmin`: de deelnemer zelf bevraagt het
  // tijdens het invullen (deel1, deel2, reis-t4kids) om de bevroren taal en het
  // instrument te kennen, en die deelnemer heeft geen adminsessie. Tot fase 1
  // gaf het echter de VOLLEDIGE rij terug aan iedereen die een id kon raden,
  // inclusief antwoorden, generatorcontract, e-mailadres en organisatie.
  //
  // Oplossing: een beheerder krijgt de volledige rij, elke andere oproeper
  // enkel de velden die de vragenlijst echt nodig heeft. Deny by default geldt
  // dus op veldniveau in plaats van op endpointniveau.
  app.get("/api/afnames/:id", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (adminIdVanSessie(req) !== null) return res.json(a);
    res.json({
      id: a.id,
      status: a.status,
      taal: a.taal,
      instrumentId: a.instrumentId ?? null,
      name: a.name,
      leeftijdsband: a.leeftijdsband ?? null,
      ouderlijkeToestemming: a.ouderlijkeToestemming ?? null,
    });
  });

  // =========================================================================
  // Fase D — Deelnemerslink / uitnodiging
  // =========================================================================

  // Beheerder: maak een uitnodiging (link) aan.
  // Stond tot fase 1 open: iedereen kon uitnodigingen aanmaken en zo credits
  // van een willekeurige organisatie opsouperen.
  app.post("/api/uitnodigingen", vereisScope, async (req, res) => {
    const parsed = inviteAfnameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const gevraagd = parsed.data;
    // De organisatie komt uit de scope, niet uit de body. Een organisatie die
    // een ander id meestuurt krijgt 403; anders zou ze uitnodigingen op kosten
    // van een andere organisatie kunnen aanmaken.
    const keuze = schrijfOrganisatieId(scopeVanVerzoek(req), gevraagd.organisatieId);
    if (!keuze.ok) return res.status(403).json({ error: keuze.fout });
    const data = { ...gevraagd, organisatieId: keuze.organisatieId ?? undefined };
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
      ...(await verzenderVanVerzoek(req)),
      name: data.name ?? null,
      company: data.company ?? null,
      role: data.role ?? null,
      taal: normaliseerTaal(data.taal),
      instrumentId: data.instrumentId ?? standaardInstrumentId(),
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
      // Additief (Regel 2): het instrument meegeven zodat het landingsscherm
      // instrument-passende koppen/labels kan tonen. Bestaande clients die dit
      // veld negeren, gedragen zich exact zoals voorheen.
      instrumentId: a.instrumentId ?? null,
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

    // Leeftijdspoort (AVG art. 8) - server-side afgedwongen, niet enkel in de
    // client. Het instrument komt uit de afname zelf zodat de deelnemer de
    // poort niet kan omzeilen door een ander instrument te sturen. Voor
    // niet-minderjarige instrumenten is dit altijd ok en verandert er niets.
    const poort = valideerLeeftijdspoort({
      instrumentId: a.instrumentId,
      leeftijdsband: data.leeftijdsband ?? null,
      ouderlijkeToestemming: data.ouderlijkeToestemming ?? false,
      ouderNaam: data.ouderNaam ?? null,
      ouderEmail: data.ouderEmail ?? null,
    });
    if (!poort.ok) {
      return res.status(400).json({ error: poort.fout });
    }

    const nu = new Date().toISOString();
    const finalCode = makeRespondentCode(data.name, a.id);
    const updated = await storage.updateAfname(a.id, {
      name: data.name,
      company: data.company ?? null,
      role: data.role ?? null,
      baselineEnergy: data.baselineEnergy,
      taal: normaliseerTaal(data.taal ?? a.taal),
      consentGiven: true,
      consentScope: "profiel-generatie + rapport",
      consentTimestamp: nu,
      consentIp,
      consentUserAgent,
      respondentCode: finalCode,
      status: "deel1",
      // Leeftijdsband wordt enkel bewaard wanneer de poort geldt (dus voor
      // T4Teens/T4Kids); andere instrumenten houden NULL.
      leeftijdsband: poort.band,
      // Bewijslast van de ouderlijke toestemming. Enkel gevuld wanneer die
      // toestemming daadwerkelijk vereist was en gegeven werd.
      ouderlijkeToestemming: poort.ouderlijkeToestemmingVereist,
      ouderlijkeToestemmingAt: poort.ouderlijkeToestemmingVereist ? nu : null,
      ouderNaam: poort.ouderlijkeToestemmingVereist ? (data.ouderNaam ?? "").trim() : null,
      ouderEmail: poort.ouderlijkeToestemmingVereist ? (data.ouderEmail ?? "").trim() : null,
      ouderlijkeToestemmingIp: poort.ouderlijkeToestemmingVereist ? consentIp : null,
      ouderlijkeToestemmingUserAgent: poort.ouderlijkeToestemmingVereist ? consentUserAgent : null,
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
  app.post("/api/afnames/:id/concept", vereisAfnameBewijs, async (req, res) => {
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
  app.post("/api/afnames/:id/main", vereisAfnameBewijs, async (req, res) => {
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
  app.post("/api/afnames/:id/connection", vereisAfnameBewijs, async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!a.mainResponses) {
      return res.status(400).json({ error: "Deel 1 is nog niet ingeleverd" });
    }

    // Auditbevinding K-1, tweede ronde: HERHAALD AFRONDEN GESLOTEN.
    // Zonder deze controle kon iedereen met een gok op het oplopende id een al
    // voltooide afname opnieuw afronden. Dat overschreef het gegenereerde
    // contract met eigen antwoorden en gaf in het antwoord de volledige
    // afnamerij terug, inclusief de onraadbare respondentCode die net het
    // bezitsbewijs van het koppelpad vormt. Een voltooide afname wordt daarom
    // nooit een tweede keer afgerond.
    if (a.status === "voltooid") {
      return res.status(409).json({ error: "Deze afname is al afgerond." });
    }
    const parsed = submitConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ongeldige antwoorden voor deel 2" });
    }
    const connection = parsed.data.answers;
    const responses = JSON.parse(a.mainResponses);

    // Server-side scoring + generatie van het bevroren A3-contract.
    // Additief (T4Students): een T4Students-afname krijgt een eigen contract met
    // instrumentId "t4students". Het T4P-pad (en elk ander instrument) blijft
    // volledig ongewijzigd via buildGeneratorContract.
    let contract: any;
    if (a.instrumentId === "t4kids") {
      // T4Kids: de galerij-keuzes (gekozen archetypen + "waarom" + top-3) reizen
      // additief mee in de request-body. Het contract volgt dezelfde vorm als
      // T4Students (constructRows/familyRows), maar met instrumentId "t4kids".
      const keuzes =
        req.body && typeof req.body.keuzes === "object" && req.body.keuzes
          ? (req.body.keuzes as { archetypen?: { id: string; waarom?: string }[]; top3?: string[] })
          : null;
      contract = buildT4KidsContract({
        respondentCode: a.respondentCode,
        name: a.name,
        company: a.company,
        role: a.role,
        consentScope: a.consentScope,
        consentTimestamp: a.consentTimestamp,
        responses,
        keuzes,
        taal: a.taal,
      });
    } else if (a.instrumentId === "t4students") {
      // Open reflectie-antwoorden reizen optioneel additief mee in de request.
      const reflectie =
        req.body && typeof req.body.reflectie === "object" && req.body.reflectie
          ? (req.body.reflectie as Record<string, string>)
          : null;
      contract = buildT4StudentsContract({
        respondentCode: a.respondentCode,
        name: a.name,
        company: a.company,
        role: a.role,
        consentScope: a.consentScope,
        consentTimestamp: a.consentTimestamp,
        responses,
        reflectie,
        taal: a.taal,
      });
    } else if (a.instrumentId === "t4teens") {
      // T4Teens: eigen itembank + eigen scoringscontract (instrumentId "t4teens"),
      // zodat de registry de T4Teens-generator kiest i.p.v. de generieke fallback.
      contract = buildT4TeensContract({
        respondentCode: a.respondentCode,
        name: a.name,
        company: a.company,
        role: a.role,
        consentScope: a.consentScope,
        consentTimestamp: a.consentTimestamp,
        responses,
        taal: a.taal,
      });
    } else {
      contract = buildGeneratorContract({
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
    }

    let updated = await storage.updateAfname(id, {
      connectionAnswers: JSON.stringify(connection),
      generatorContract: JSON.stringify(contract),
      status: "voltooid",
      completedAt: new Date().toISOString(),
    });

    // TaPas Persoonlijk — Fase 1: als de deelnemer (optioneel) een e-mailadres
    // opgaf bij het afronden, koppelen we deze afname meteen aan een
    // deelnemer-account zodat ze later via hun persoonlijk dashboard inloggen.
    //
    // Auditbevinding K-1, tweede ronde: ook hier geldt het bezitsbewijs. Deze
    // afrondroute kende dat bewijs niet, waardoor het koppelen van een
    // e-mailadres langs de gedichte koppelroute heen kon. Zonder geldig bewijs
    // wordt het meegestuurde adres genegeerd; het afronden zelf blijft slagen,
    // want koppelen mag de profielgeneratie nooit blokkeren. De eigen webclient
    // stuurt hier geen e-mailadres mee: die koppelt via
    // /api/afnames/:id/koppel-dashboard, mét bewijs.
    const emailRaw = (req.body && typeof req.body.email === "string") ? req.body.email.trim() : "";
    const bewijsOk = bewijsGeldig(a, bewijsUitBody(req.body));
    let dashboardToken: string | null = null;
    if (emailRaw && !bewijsOk) {
      // Geen persoonsgegevens in het logboek (auditbevinding S-1): enkel het id.
      console.warn(`[koppel] e-mailkoppeling bij afronden geweigerd zonder bezitsbewijs (afname ${id})`);
    }
    if (emailRaw && bewijsOk && /.+@.+\..+/.test(emailRaw)) {
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

  // --- Optie A: eindscherm koppelt e-mail aan een persoonlijk dashboard ------
  // Apart en idempotent van de connection-flow: het eindscherm (klaar.tsx)
  // verzamelt HIER het e-mailadres (zodat de afrondingsknop in deel2 ongewijzigd
  // blijft). Bestaande deelnemer -> zelfde dashboardToken; nieuwe deelnemer ->
  // aangemaakt. De afname wordt gekoppeld en we geven token + afgeleide
  // 4-cijfercode + voornaam terug voor de rechtstreekse dashboardlink.
  //
  // Auditbevinding K-1 (kritiek), hier gedicht:
  //   * BEZITSBEWIJS: naast het oplopende id moet de oproeper de onraadbare
  //     respondentCode (of het invite-token) van deze afname meesturen. Zonder
  //     geldig bewijs: 404, net als bij de scope-routes, zodat het antwoord niet
  //     verklapt of de afname bestaat.
  //   * GEEN OVERSCHRIJVING: een afname die al aan een e-mailadres hangt wordt
  //     nooit naar een ander adres omgezet (409). Hetzelfde adres blijft
  //     idempotent doorlopen.
  //   * SNELHEIDSBEGRENZING: dit pad staat in server/index.ts onder de
  //     authLimiter.
  app.post("/api/afnames/:id/koppel-dashboard", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });

    // Bezitsbewijs vóór alle andere verwerking.
    if (!bewijsGeldig(a, bewijsUitBody(req.body))) {
      return res.status(404).json({ error: "Afname niet gevonden" });
    }

    const emailRaw = (req.body && typeof req.body.email === "string") ? req.body.email.trim() : "";
    if (!emailRaw || !/.+@.+\..+/.test(emailRaw)) {
      return res.status(400).json({ error: "Geef een geldig e-mailadres op." });
    }

    const beslissing = koppelBeslissing(a, emailRaw);
    if (!beslissing.toegestaan) {
      return res.status(409).json({
        error:
          "Deze afname is al aan een ander e-mailadres gekoppeld. Neem contact op met je begeleider.",
      });
    }

    try {
      // Bij een reeds bestaande koppeling met hetzelfde adres niets herschrijven.
      if (!beslissing.reeds) {
        await storage.koppelAfnameAanDeelnemer(id, emailRaw);
      }
      const deelnemer = await storage.vindOfMaakDeelnemer(emailRaw, a.taal);
      return res.json({
        dashboardToken: deelnemer.dashboardToken,
        dashboardCode: dashboardCodeVanToken(deelnemer.dashboardToken),
        voornaam: voornaamVanNaam(deelnemer.naam),
      });
    } catch {
      return res.status(500).json({ error: "Koppelen aan dashboard mislukt." });
    }
  });

  // =========================================================================
  // Fase C4c — GDPR: betrokkenenrechten
  // =========================================================================

  // Toegangscontrole (AVG art. 32): al deze routes raken persoonsgegevens van
  // betrokkenen. Ze staan achter `vereisScope`, en daarbovenop controleert
  // `afnameBuitenScope` per afname of ze binnen de scope van de oproeper valt.
  // Zonder die tweede controle zou een organisatie via een gegokt id de
  // persoonsgegevens van een andere organisatie kunnen exporteren of wissen.
  //
  // Buiten scope levert 404 op en niet 403: een 403 zou bevestigen dat de
  // afname bestaat, en dat is op zich al informatie over een andere
  // organisatie.
  async function afnameBuitenScope(req: Request, res: Response, id: number): Promise<boolean> {
    const afname = await storage.getAfname(id);
    if (!afname || !valtBinnenScope(scopeVanVerzoek(req), afname.organisatieId)) {
      res.status(404).json({ error: "Afname niet gevonden" });
      return true;
    }
    return false;
  }

  app.get("/api/gdpr/afnames/:id/export", vereisScope, async (req, res) => {
    if (DEMO_MODE) {
      return res.status(403).json({ error: "Niet beschikbaar in de publieke demo." });
    }
    if (await afnameBuitenScope(req, res, Number(req.params.id))) return;
    try {
      const pakket = await storage.gdprExport(Number(req.params.id));
      schrijfAuditLog({
        adminId: adminIdVanSessie(req),
        actie: "gdpr_export",
        afnameId: Number(req.params.id),
      });
      res.json(pakket);
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Export mislukt";
      res.status(404).json({ error: msg });
    }
  });

  app.get("/api/gdpr/afnames/:id/export.json", vereisScope, async (req, res) => {
    if (DEMO_MODE) {
      return res.status(403).json({ error: "Niet beschikbaar in de publieke demo." });
    }
    if (await afnameBuitenScope(req, res, Number(req.params.id))) return;
    try {
      const pakket = await storage.gdprExport(Number(req.params.id));
      schrijfAuditLog({
        adminId: adminIdVanSessie(req),
        actie: "gdpr_export_download",
        afnameId: Number(req.params.id),
      });
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="gdpr-export_afname-${req.params.id}.json"`);
      res.send(JSON.stringify(pakket, null, 2));
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Export mislukt";
      res.status(404).json({ error: msg });
    }
  });

  app.post("/api/gdpr/bewaartermijn", vereisScope, async (req, res) => {
    const parsed = bewaartermijnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    if (await afnameBuitenScope(req, res, parsed.data.afnameId)) return;
    const updated = await storage.updateAfname(parsed.data.afnameId, {
      bewaartotDatum: parsed.data.bewaartotDatum,
    });
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "bewaartermijn_wijziging",
      afnameId: parsed.data.afnameId,
      detail: `bewaartot ${parsed.data.bewaartotDatum}`,
    });
    res.json(updated);
  });

  app.post("/api/gdpr/afnames/:id/intrekken", vereisScope, async (req, res) => {
    if (await afnameBuitenScope(req, res, Number(req.params.id))) return;
    const updated = await storage.trekConsentIn(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "consent_intrekking",
      afnameId: Number(req.params.id),
    });
    res.json(updated);
  });

  app.post("/api/gdpr/afnames/:id/anonimiseer", vereisScope, async (req, res) => {
    const reden = typeof req.body?.reden === "string" ? req.body.reden : "verzoek betrokkene";
    if (await afnameBuitenScope(req, res, Number(req.params.id))) return;
    const updated = await storage.anonimiseerAfname(Number(req.params.id), reden);
    if (!updated) return res.status(404).json({ error: "Afname niet gevonden" });
    schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "anonimisering",
      afnameId: Number(req.params.id),
      detail: reden,
    });
    res.json(updated);
  });
}
