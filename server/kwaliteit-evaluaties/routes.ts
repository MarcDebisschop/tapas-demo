// ---------------------------------------------------------------------------
// server/kwaliteit-evaluaties/routes.ts
//
// Module Kwaliteit & Evaluaties — stap organisatie-evaluatie (§7 en het
// bijbehorende deel van §16 uit de bouwspecificatie). Endpointpaden volgen
// zoveel mogelijk de paden die de specificatie zelf noemt:
//   POST /api/training-sessions/:id/evaluations/invite
//   GET  /api/evaluations/public/:token
//   POST /api/evaluations/public/:token/save
//   POST /api/evaluations/public/:token/submit
// Daarnaast enkele admin-routes die de specificatie veronderstelt maar niet
// letterlijk opsomt (een sessie/contact/coach moet ergens ontstaan): die
// staan onder /api/admin/kwaliteit-evaluaties/... en zijn een redelijke,
// duidelijk afgebakende aanvulling — geen onderdeel van de officiële
// minimale lijst uit §16.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { schrijfAuditLog } from "../audit-log";
import { storage as hoofdopslag } from "../storage";
import {
  insertEvaluatieOrganisatieContactSchema,
  insertEvaluatieCoachSchema,
  insertEvaluatieSessieSchema,
} from "./schema";
import * as opslag from "./storage";
import { verstuurOrganisatieUitnodiging } from "./mailer";
import { ORG_EVAL_SECTIES, SIGNAAL_NIVEAUS, SIGNAAL_TYPES } from "./vragen";
import { z } from "zod";

function magSchrijven(status: string | undefined): boolean {
  return status === "concept" || status === undefined;
}

export function registerKwaliteitEvaluatiesRoutes(app: Express): void {
  // ---- Vaste vragenset (voor de admin-preview en eventuele tests) --------
  app.get("/api/admin/kwaliteit-evaluaties/vragenset", vereisAdmin, (_req, res) => {
    res.json({ secties: ORG_EVAL_SECTIES, signaalNiveaus: SIGNAAL_NIVEAUS, signaalTypes: SIGNAAL_TYPES });
  });

  // ---- Contactpersonen -----------------------------------------------------
  app.get(
    "/api/admin/kwaliteit-evaluaties/organisaties/:organisatieId/contacten",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const organisatieId = Number(req.params.organisatieId);
      res.json(await opslag.lijstContacten(organisatieId));
    },
  );

  app.post(
    "/api/admin/kwaliteit-evaluaties/organisaties/:organisatieId/contacten",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const organisatieId = Number(req.params.organisatieId);
      const org = await hoofdopslag.getOrganisatie(organisatieId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden." });

      const parsed = insertEvaluatieOrganisatieContactSchema.safeParse({
        ...req.body,
        organisatieId,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      res.json(await opslag.maakContact(parsed.data));
    },
  );

  // ---- Coaches ---------------------------------------------------------
  app.get("/api/admin/kwaliteit-evaluaties/coaches", vereisAdmin, async (_req, res) => {
    res.json(await opslag.lijstCoaches());
  });

  app.post(
    "/api/admin/kwaliteit-evaluaties/coaches",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const parsed = insertEvaluatieCoachSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      res.json(await opslag.maakCoach(parsed.data));
    },
  );

  // ---- Sessies (training_sessions, minimale velden per §15.2) -----------
  app.get("/api/admin/kwaliteit-evaluaties/sessies", vereisAdmin, async (_req, res) => {
    const sessies = await opslag.lijstSessies();
    const organisaties = await hoofdopslag.listOrganisaties();
    const organisatieNaamPerId = new Map(organisaties.map((o) => [o.id, o.naam]));
    res.json(
      sessies.map((s) => ({
        ...s,
        organisatieNaam: organisatieNaamPerId.get(s.organisatieId) ?? null,
        bevestigdeDoelstellingen: JSON.parse(s.bevestigdeDoelstellingen || "[]"),
      })),
    );
  });

  app.post(
    "/api/admin/kwaliteit-evaluaties/sessies",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const parsed = insertEvaluatieSessieSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const org = await hoofdopslag.getOrganisatie(parsed.data.organisatieId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden." });

      const sessie = await opslag.maakSessie(parsed.data);
      res.json(sessie);
    },
  );

  app.get(
    "/api/admin/kwaliteit-evaluaties/sessies/:id",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const sessie = await opslag.vindSessie(Number(req.params.id));
      if (!sessie) return res.status(404).json({ error: "Niet gevonden." });
      res.json({ ...sessie, bevestigdeDoelstellingen: JSON.parse(sessie.bevestigdeDoelstellingen || "[]") });
    },
  );

  // ---- Uitnodiging versturen (§16: POST /api/training-sessions/:id/evaluations/invite) --
  const uitnodigingInvoerSchema = z.object({
    contactId: z.number().int().positive(),
    taal: z.string().min(2).max(5).optional(),
    origin: z.string().optional(),
  });

  app.post(
    "/api/training-sessions/:id/evaluations/invite",
    vereisAdmin,
    async (req: Request, res: Response) => {
      const sessieId = Number(req.params.id);
      const parsed = uitnodigingInvoerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const sessie = await opslag.vindSessie(sessieId);
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden." });

      const contact = await opslag.vindContact(parsed.data.contactId);
      if (!contact || contact.organisatieId !== sessie.organisatieId) {
        return res.status(404).json({ error: "Contactpersoon niet gevonden bij deze organisatie." });
      }

      const taal = parsed.data.taal ?? sessie.taal ?? "nl";
      const { token, verlooptOp } = opslag.maakUitnodiging(sessie.id, contact.id, taal);

      const mailResultaat = await verstuurOrganisatieUitnodiging({
        naar: contact.email,
        naamContact: contact.naam,
        opleidingTitel: sessie.titel,
        origin: parsed.data.origin ?? "",
        token,
      });

      schrijfAuditLog({
        adminId: adminIdVanSessie(req),
        actie: "evaluatie_organisatie_uitnodiging_verstuurd",
        afnameId: sessie.id,
        detail: `sessieId=${sessie.id}; contactId=${contact.id}; mailStatus=${mailResultaat.status}`,
      });

      res.json({ token, verlooptOp, mailStatus: mailResultaat.status });
    },
  );

  // ---- Publieke flow (§16 org-evaluatie-subset) --------------------------
  app.get("/api/evaluations/public/:token", async (req: Request, res: Response) => {
    const status = opslag.vindUitnodiging(String(req.params.token));
    if (!status.ok) return res.status(404).json({ error: status.reden });

    const sessie = await opslag.vindSessie(status.uitnodiging.sessieId);
    if (!sessie) return res.status(404).json({ error: "onbekend" });
    const org = await hoofdopslag.getOrganisatie(sessie.organisatieId);
    const contact = await opslag.vindContact(status.uitnodiging.contactId);
    const coach = sessie.coachId ? await opslag.vindCoach(sessie.coachId) : undefined;

    const evaluatie = await opslag.vindOfMaakConceptEvaluatie(
      status.uitnodiging,
      sessie.organisatieId,
    );
    if (evaluatie.status === "verzonden") {
      return res.status(409).json({ error: "al_ingediend" });
    }
    const antwoorden = await opslag.lijstAntwoorden(evaluatie.id);

    res.json({
      evaluatieId: evaluatie.id,
      taal: status.uitnodiging.taal,
      context: {
        opleidingTitel: sessie.titel,
        organisatieNaam: org?.naam ?? "",
        datum: sessie.startDatetime,
        coachNaam: coach?.naam ?? "",
        aantalDeelnemers: sessie.aantalDeelnemersWerkelijk ?? sessie.aantalDeelnemersVerwacht ?? null,
        doelstellingSamenvatting: JSON.parse(sessie.bevestigdeDoelstellingen || "[]").join(" · "),
        contactNaam: contact?.naam ?? "",
        contactEmail: contact?.email ?? "",
      },
      secties: ORG_EVAL_SECTIES,
      evaluatie,
      antwoorden,
    });
  });

  const conceptSchema = z.object({
    basisinfoKlopt: z.enum(["ja", "gedeeltelijk", "nee"]).optional(),
    basisinfoToelichting: z.string().max(2000).optional(),
    magContactOpnemen: z.boolean().optional(),
    signaalNiveau: z.enum(SIGNAAL_NIVEAUS).optional(),
    signaalTypes: z.array(z.enum(SIGNAAL_TYPES)).optional(),
    signaalBeschrijving: z.string().max(2000).optional(),
    signaalWilContact: z.boolean().optional(),
    signaalContactNaam: z.string().max(200).optional(),
    signaalContactEmail: z.string().max(200).optional(),
    signaalContactTelefoon: z.string().max(60).optional(),
    antwoorden: z
      .array(
        z.object({
          vraagCode: z.string(),
          numeriekeWaarde: z.number().min(0).max(10).nullable().optional(),
          tekstWaarde: z.string().max(2000).nullable().optional(),
        }),
      )
      .optional(),
  });

  app.post("/api/evaluations/public/:token/save", async (req: Request, res: Response) => {
    const status = opslag.vindUitnodiging(String(req.params.token));
    if (!status.ok) return res.status(404).json({ error: status.reden });

    const sessie = await opslag.vindSessie(status.uitnodiging.sessieId);
    if (!sessie) return res.status(404).json({ error: "onbekend" });

    const evaluatie = await opslag.vindOfMaakConceptEvaluatie(
      status.uitnodiging,
      sessie.organisatieId,
    );
    if (!magSchrijven(evaluatie.status)) {
      return res.status(409).json({ error: "al_ingediend" });
    }

    const parsed = conceptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const bijgewerkt = await opslag.bewaarConcept(evaluatie.id, status.uitnodiging.taal, parsed.data);
    res.json({ ok: true, evaluatie: bijgewerkt });
  });

  app.post("/api/evaluations/public/:token/submit", async (req: Request, res: Response) => {
    const status = opslag.vindUitnodiging(String(req.params.token));
    if (!status.ok) return res.status(404).json({ error: status.reden });

    const sessie = await opslag.vindSessie(status.uitnodiging.sessieId);
    if (!sessie) return res.status(404).json({ error: "onbekend" });

    const evaluatie = await opslag.vindOfMaakConceptEvaluatie(
      status.uitnodiging,
      sessie.organisatieId,
    );
    if (evaluatie.status === "verzonden") {
      // Bescherming tegen dubbele indiening (§16-vereiste): geen fout, want
      // een dubbelklik of teruggekeerde tab mag de gebruiker niet met een
      // foutmelding confronteren over iets dat al gelukt is.
      return res.json({ ok: true, evaluatie, alReedsIngediend: true });
    }

    // Sla een eventuele laatste tussenstand nog op vóór het indienen.
    const parsed = conceptSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (Object.keys(parsed.data).length > 0) {
      await opslag.bewaarConcept(evaluatie.id, status.uitnodiging.taal, parsed.data);
    }

    // Verplichte vragen controleren (§7.4 — enkel de vragen die verplicht zijn).
    const antwoordenTotDusver = await opslag.lijstAntwoorden(evaluatie.id);
    const beantwoordeCodes = new Set(
      antwoordenTotDusver
        .filter((a) => a.numeriekeWaarde != null || (a.tekstWaarde ?? "").trim() !== "")
        .map((a) => a.vraagCode),
    );
    const ontbrekend = ORG_EVAL_SECTIES.flatMap((s) => s.vragen)
      .filter((v) => v.verplicht && !beantwoordeCodes.has(v.code))
      .map((v) => v.code);
    if (ontbrekend.length > 0) {
      return res.status(400).json({ error: "verplichte_vragen_ontbreken", vragen: ontbrekend });
    }

    const resultaat = await opslag.diendeEvaluatieIn(evaluatie.id);
    if (!resultaat) return res.status(404).json({ error: "onbekend" });

    schrijfAuditLog({
      adminId: null,
      actie: "evaluatie_organisatie_evaluatie_ingediend",
      afnameId: evaluatie.id,
      detail: `sessieId=${sessie.id}; signaalAangemaakt=${resultaat.signaalAangemaakt}`,
    });
    if (resultaat.signaalAangemaakt) {
      schrijfAuditLog({
        adminId: null,
        actie: "evaluatie_organisatie_signaal_aangemaakt",
        afnameId: evaluatie.id,
        detail: `sessieId=${sessie.id}`,
      });
    }

    res.json({ ok: true, evaluatie: resultaat.evaluatie });
  });

  // ---- Admin: overzicht van ingediende/lopende organisatie-evaluaties ---
  app.get("/api/admin/quality/evaluations", vereisAdmin, async (_req, res) => {
    const evaluaties = await opslag.lijstOrganisatieEvaluaties();
    const sessies = await opslag.lijstSessies();
    const sessieMap = new Map(sessies.map((s) => [s.id, s]));
    const organisaties = await hoofdopslag.listOrganisaties();
    const orgMap = new Map(organisaties.map((o) => [o.id, o.naam]));
    res.json(
      evaluaties.map((e) => ({
        ...e,
        opleidingTitel: sessieMap.get(e.sessieId)?.titel ?? null,
        organisatieNaam: orgMap.get(e.organisatieId) ?? null,
      })),
    );
  });

  app.get("/api/admin/quality/evaluations/:id", vereisAdmin, async (req: Request, res: Response) => {
    const evaluatie = await opslag.vindEvaluatieById(Number(req.params.id));
    if (!evaluatie) return res.status(404).json({ error: "Niet gevonden." });
    const antwoorden = await opslag.lijstAntwoorden(evaluatie.id);
    res.json({ evaluatie, antwoorden });
  });

  app.get("/api/admin/quality/signals", vereisAdmin, async (_req, res) => {
    const signalen = await opslag.lijstSignalen();
    res.json(signalen.map((s) => ({ ...s, types: JSON.parse(s.types || "[]") })));
  });
}
