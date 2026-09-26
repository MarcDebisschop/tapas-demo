// ---------------------------------------------------------------------------
// server/toc-kompas/routes.ts
//
// HTTP-laag van het TOC Commitmentkompas.
//
// TOEGANG. De beheerroutes zitten achter vereisAdmin en vereisPrior: het
// Commitmentkompas gaat over de eigen organisatie en is enkel voor de
// hoofdbeheerder. Het TOC en de statutaire raad van bestuur blijven
// onderscheiden; deze module kent enkel het Team of Captains.
//
// PUBLIEKE ROUTES. Elke Captain vult zijn vragenlijst in via een persoonlijke
// link. Het token wordt een keer getoond; in de databank staat enkel de hash.
// Een Captain ziet enkel zijn eigen vragenlijst, nooit die van een andere.
//
// EMBARGO. Tijdens de nulmeting (INTAKE) ziet de beheerder enkel de status per
// Captain, geen antwoorden. Zo blijft de nulmeting individueel.
//
// AUDIT. Elke lees-, schrijf- en downloadhandeling komt in het audit-log.
// ---------------------------------------------------------------------------
import type { Express, Request, Response, NextFunction } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { vereisPrior } from "../scope-guard";
import { schrijfAuditLog, type AuditActie } from "../audit-log";
import {
  RAPPORT_TYPES,
  acceptatieSchema,
  afsluitSchema,
  besluitSchema,
  commitmentSchema,
  commitmentStatusSchema,
  commitmentWijzigSchema,
  conceptSchema,
  coverageSchema,
  indienSchema,
  maakRondeSchema,
  vaststelSchema,
  vergrendelSchema,
  type RapportType,
} from "@shared/toc-kompas";
import * as svc from "./service";
import { ServiceFout } from "./service";

const P = "/api/toc-kompas";
const TOKEN_PER_MINUUT = 60;

const TIJDEN = new Map<string, number[]>();
/** Eenvoudige schuivende venstergrens in het geheugen. */
export function binnenGrens(sleutel: string, max: number, vensterMs: number, nu = Date.now()): boolean {
  const l = (TIJDEN.get(sleutel) ?? []).filter((t) => nu - t < vensterMs);
  if (l.length >= max) {
    TIJDEN.set(sleutel, l);
    return false;
  }
  l.push(nu);
  TIJDEN.set(sleutel, l);
  return true;
}
export function wisGrenzenVoorTest(): void {
  TIJDEN.clear();
}

function audit(adminId: number | null, actie: AuditActie, detail: Record<string, unknown>): void {
  try {
    schrijfAuditLog({ adminId, actie, afnameId: null, detail: JSON.stringify(detail) });
  } catch {
    // Het audit-log mag een handeling niet laten mislukken.
  }
}

function stuurFout(res: Response, e: unknown): void {
  if (e instanceof ServiceFout) {
    res.status(e.status).json({ error: e.message, ...((e.details as Record<string, unknown>) ?? {}) });
    return;
  }
  console.error("[toc-kompas]", e);
  res.status(500).json({ error: "Er ging iets mis. Probeer het opnieuw." });
}

function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, body: unknown, res: Response): T | null {
  const r = schema.safeParse(body);
  if (!r.success) {
    res.status(400).json({ error: "Ongeldige invoer.", details: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    return null;
  }
  return r.data;
}

function rondeId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ServiceFout("Ronde niet gevonden.", 404);
  svc.haalRonde(id);
  return id;
}

type Handler = (req: Request, res: Response, adminId: number) => unknown | Promise<unknown>;
function beheer(h: Handler) {
  return async (req: Request, res: Response) => {
    try {
      const adminId = adminIdVanSessie(req);
      if (adminId === null) return void res.status(401).json({ error: "Niet aangemeld." });
      await h(req, res, adminId);
    } catch (e) {
      stuurFout(res, e);
    }
  };
}

function tokenGrens(req: Request, res: Response, next: NextFunction): void {
  const token = String(req.params.token ?? "");
  if (token.length < 20 || token.length > 100) {
    res.status(404).json({ error: "Link niet gevonden." });
    return;
  }
  if (!binnenGrens(`toc:${req.ip}`, TOKEN_PER_MINUUT, 60000)) {
    res.status(429).json({ error: "Te veel verzoeken. Probeer zo dadelijk opnieuw." });
    return;
  }
  next();
}

async function laadPdfRenderer(): Promise<svc.PdfRenderer | null> {
  if (process.env.TOC_KOMPAS_GEEN_PDF === "1") return null;
  const m = await import("../rapport-pdf");
  return (html, opts) => m.renderRapportPdf(html, opts);
}

export function registerTocKompasRoutes(app: Express): void {
  const B = [vereisAdmin, vereisPrior] as const;

  // ---- Rondes --------------------------------------------------------------
  app.get(`${P}/rondes`, ...B, beheer((_req, res) => res.json(svc.lijstRondes())));

  app.post(
    `${P}/rondes`,
    ...B,
    beheer((req, res, adminId) => {
      const inv = parse(maakRondeSchema, req.body, res);
      if (!inv) return;
      const r = svc.maakRonde(inv, adminId);
      audit(adminId, "toc_kompas_ronde_aangemaakt", { rondeId: r.ronde.id, periode: r.ronde.periode });
      res.status(201).json(r);
    }),
  );

  app.get(
    `${P}/rondes/:id`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const r = svc.haalRonde(id);
      const na = svc.minstens(r.status, "CONSOLIDATIE");
      audit(adminId, "toc_kompas_gelezen", { rondeId: id, onderdeel: "ronde" });
      res.json({
        ronde: svc.rondePubliek(r),
        captains: svc.captainsVan(id).map(svc.captainPubliek),
        consolidatie: na ? svc.consolidatie(id) : null,
        commitments: na ? svc.commitmentsVan(id) : [],
        coverage: na ? svc.coverageVan(r) : [],
        besluiten: na ? svc.besluitenVan(id) : [],
        acceptatie: na ? svc.acceptatie(id) : null,
        vaststelFouten: r.status === "CONSOLIDATIE" ? svc.vaststelFouten(id) : [],
        artefacten: svc.artefactenVan(id),
      });
    }),
  );

  app.post(
    `${P}/rondes/:id/captains/:cid/link`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const r = svc.vernieuwLink(id, Number(req.params.cid));
      audit(adminId, "toc_kompas_link_vernieuwd", { rondeId: id, captainId: Number(req.params.cid) });
      res.json(r);
    }),
  );

  app.post(
    `${P}/rondes/:id/captains/:cid/heropen`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      svc.heropen(id, Number(req.params.cid));
      audit(adminId, "toc_kompas_heropend", { rondeId: id, captainId: Number(req.params.cid) });
      res.json({ ok: true });
    }),
  );

  app.get(
    `${P}/rondes/:id/captains/:cid/antwoorden`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const a = svc.antwoordenVan(id, Number(req.params.cid));
      audit(adminId, "toc_kompas_gelezen", { rondeId: id, captainId: Number(req.params.cid), onderdeel: "antwoorden" });
      res.json(a);
    }),
  );

  app.post(
    `${P}/rondes/:id/vergrendel`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(vergrendelSchema, req.body, res);
      if (!inv) return;
      svc.vergrendel(id, inv.reden);
      audit(adminId, "toc_kompas_vergrendeld", { rondeId: id, reden: inv.reden });
      res.json({ ok: true });
    }),
  );

  // ---- Register ------------------------------------------------------------
  app.post(
    `${P}/rondes/:id/commitments/overnemen`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const r = svc.neemOver(id, adminId);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "overnemen", toegevoegd: r.toegevoegd });
      res.json(r);
    }),
  );

  app.post(
    `${P}/rondes/:id/commitments`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(commitmentSchema, req.body, res);
      if (!inv) return;
      const c = svc.maakCommitment(id, inv, adminId);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "commitment", commitmentId: c.id, actie: "aangemaakt" });
      res.status(201).json(c);
    }),
  );

  app.put(
    `${P}/rondes/:id/commitments/:cid`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(commitmentWijzigSchema, req.body, res);
      if (!inv) return;
      const c = svc.wijzigCommitment(id, Number(req.params.cid), inv);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "commitment", commitmentId: c.id, actie: "gewijzigd" });
      res.json(c);
    }),
  );

  app.delete(
    `${P}/rondes/:id/commitments/:cid`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const c = svc.verwijderCommitment(id, Number(req.params.cid));
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "commitment", commitmentId: c.id, code: c.code, actie: "verwijderd" });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/rondes/:id/commitments/:cid/status`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(commitmentStatusSchema, req.body, res);
      if (!inv) return;
      const r = svc.zetCommitmentStatus(id, Number(req.params.cid), inv.status, inv.toelichting, inv.versie);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "status", commitmentId: Number(req.params.cid), voor: r.voor?.status, na: r.na?.status });
      res.json(r.na);
    }),
  );

  // ---- Coverage, besluiten, acceptatie ---------------------------------------
  app.put(
    `${P}/rondes/:id/coverage`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(coverageSchema, req.body, res);
      if (!inv) return;
      const rijen = svc.bewaarCoverage(id, inv.rijen, inv.versie);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "coverage" });
      res.json({ rijen, versie: svc.haalRonde(id).coverageVersie });
    }),
  );

  app.post(
    `${P}/rondes/:id/besluiten`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(besluitSchema, req.body, res);
      if (!inv) return;
      const b = svc.legBesluitVast(id, inv, adminId);
      audit(adminId, "toc_kompas_besluit_vastgelegd", { rondeId: id, besluitId: b.id, onderwerp: b.onderwerp });
      res.status(201).json(b);
    }),
  );

  app.put(
    `${P}/rondes/:id/acceptatie`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(acceptatieSchema, req.body, res);
      if (!inv) return;
      const a = svc.bewaarAcceptatie(id, inv.handmatig, inv.versie);
      audit(adminId, "toc_kompas_gewijzigd", { rondeId: id, onderdeel: "acceptatie", handmatig: inv.handmatig });
      res.json(a);
    }),
  );

  app.post(
    `${P}/rondes/:id/vaststellen`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(vaststelSchema, req.body, res);
      if (!inv) return;
      svc.stelVast(id, adminId, inv.toelichting);
      audit(adminId, "toc_kompas_vastgesteld", { rondeId: id });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/rondes/:id/afsluiten`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const inv = parse(afsluitSchema, req.body, res);
      if (!inv) return;
      svc.sluitAf(id, inv.toelichting);
      audit(adminId, "toc_kompas_afgesloten", { rondeId: id });
      res.json({ ok: true });
    }),
  );

  // ---- Rapporten -------------------------------------------------------------
  app.post(
    `${P}/rondes/:id/rapporten/:type`,
    ...B,
    beheer(async (req, res, adminId) => {
      const id = rondeId(req);
      const type = req.params.type as RapportType;
      if (!RAPPORT_TYPES.includes(type)) return void res.status(404).json({ error: "Onbekend rapporttype." });
      const captainId = type === "captain-charter" ? Number(req.body?.captainId) || null : null;
      const r = await svc.maakRapport(id, type, captainId, adminId, await laadPdfRenderer());
      audit(adminId, "toc_kompas_rapport_gemaakt", { rondeId: id, type, captainId, versie: r.artefact.versie, hergebruikt: r.hergebruikt });
      res.status(r.hergebruikt ? 200 : 201).json({ id: r.artefact.id, versie: r.artefact.versie, inputHash: r.artefact.inputHash, hergebruikt: r.hergebruikt, heeftPdf: !!r.artefact.pdfBase64 });
    }),
  );

  app.get(
    `${P}/rondes/:id/artefacten/:aid`,
    ...B,
    beheer((req, res, adminId) => {
      const id = rondeId(req);
      const a = svc.haalArtefact(id, Number(req.params.aid));
      const formaat = req.query.formaat === "html" ? "html" : "pdf";
      audit(adminId, "toc_kompas_rapport_gedownload", { rondeId: id, artefactId: a.id, type: a.type, versie: a.versie, formaat });
      if (formaat === "html" || !a.pdfBase64) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return void res.send(a.html);
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="toc-kompas-${id}-${a.type}-v${a.versie}.pdf"`);
      res.send(Buffer.from(a.pdfBase64, "base64"));
    }),
  );

  // ---- Publieke invulroutes ------------------------------------------------------
  const I = `${P}/invullen/:token`;
  const tok = (req: Request): string => String(req.params.token);
  const publiek = (h: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    try {
      await h(req, res);
    } catch (e) {
      stuurFout(res, e);
    }
  };

  app.get(I, tokenGrens, publiek((req, res) => res.json(svc.invulStatus(tok(req)))));

  app.put(
    `${I}/concept`,
    tokenGrens,
    publiek((req, res) => {
      const inv = parse(conceptSchema, req.body, res);
      if (!inv) return;
      res.json(svc.bewaarConcept(tok(req), inv.antwoorden, inv.versie));
    }),
  );

  app.post(
    `${I}/indienen`,
    tokenGrens,
    publiek((req, res) => {
      const inv = parse(indienSchema, req.body, res);
      if (!inv) return;
      const { captain, ronde } = svc.captainVoorLink(tok(req));
      const r = svc.dienIn(tok(req), inv.antwoorden);
      audit(null, "toc_kompas_ingediend", { rondeId: ronde.id, captainId: captain.id, versie: r.indieningVersie, alleIngediend: r.alleIngediend });
      res.json(r);
    }),
  );

  app.get(
    `${I}/charter`,
    tokenGrens,
    publiek((req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(svc.eigenCharterHtml(tok(req)));
    }),
  );
}
