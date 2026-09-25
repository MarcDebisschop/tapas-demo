// ---------------------------------------------------------------------------
// server/role-fit/routes.ts
//
// HTTP-laag van TaPas CORE Role Fit met de H-BOM Evidence Check.
//
// TOEGANG. Elke beheerroute zit achter vereisAdmin en daarna achter twee
// toetsen: de tenant (bepaalScope, een case buiten de organisatie van de
// beheerder bestaat voor hem niet: 404) en need-to-know (enkel eigenaar,
// ondertekenaar, reviewer, de gekoppelde recruiter of hiring manager, of een
// prior-beheerder: anders 403).
//
// SEMI-BLIND. Een gekoppelde recruiter of hiring manager die geen andere rol in
// de case heeft, ziet tot de observaties vergrendeld zijn geen profielgegevens,
// geen fitindicaties en geen observaties van de andere observator. De
// convergentie blijft voor iedereen onder embargo tot de integratiereview.
//
// PUBLIEKE ROUTES. De observatorlink werkt met een eenmalig getoond token. In
// de databank staat enkel de hash.
//
// AUDIT. Elke lees-, download- en schrijfhandeling komt in het audit-log.
// ---------------------------------------------------------------------------
import type { Express, Request, Response, NextFunction } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bepaalScope, valtBinnenScope } from "../scope-guard";
import type { Scope } from "../scope";
import { schrijfAuditLog, type AuditActie } from "../audit-log";
import { storage as platformStorage } from "../storage";
import {
  RAPPORT_TYPES,
  besluitSchema,
  bronSchema,
  claimBeoordelingSchema,
  freezeSchema,
  handmatigeClaimSchema,
  hbomGoedkeuringSchema,
  hbomKeuzeSchema,
  integratieSchema,
  maakCaseSchema,
  observatieConceptSchema,
  observatieCorrectieSchema,
  observatieIndienSchema,
  vereisteSchema,
  taalcoachMeldingen,
  wizardSchema,
  RF_MODULE_VERSIE,
  type RapportType,
} from "@shared/role-fit";
import { controleerAfname, leesProfielUitContract, ProfielFout } from "./profiel";
import { BronFout, decodeerBase64, tekstUitDocx, tekstUitPdf, tekstUitTxt, tekstUitUrl } from "./bron-invoer";
import { lijstCases, lijstVoorCase, opdrachtVoorToken, wisCaseInhoud, zorgVoorTabellen } from "./storage";
import * as svc from "./service";
import { ServiceFout, json, minstens } from "./service";

type Rol = "prior" | "owner" | "signer" | "reviewer" | "recruiter" | "hiring_manager";

interface Toegang {
  adminId: number;
  scope: Scope;
  rollen: Set<Rol>;
  zaak: any;
}

const TIJDEN_PER_SLEUTEL = new Map<string, number[]>();
/** Eenvoudige schuivende venstergrens in het geheugen. */
export function binnenGrens(sleutel: string, max: number, vensterMs: number, nu = Date.now()): boolean {
  const lijst = (TIJDEN_PER_SLEUTEL.get(sleutel) ?? []).filter((t) => nu - t < vensterMs);
  if (lijst.length >= max) {
    TIJDEN_PER_SLEUTEL.set(sleutel, lijst);
    return false;
  }
  lijst.push(nu);
  TIJDEN_PER_SLEUTEL.set(sleutel, lijst);
  return true;
}
export function wisGrenzenVoorTest(): void {
  TIJDEN_PER_SLEUTEL.clear();
}

const AI_PER_UUR = 10;
const TOKEN_PER_MINUUT = 60;

function audit(adminId: number | null, actie: AuditActie, zaak: any | null, detail: Record<string, unknown> = {}): void {
  schrijfAuditLog({
    adminId,
    actie,
    afnameId: zaak?.afnameId ?? null,
    detail: JSON.stringify({ caseId: zaak?.id ?? null, ...detail }),
  });
}

function stuurFout(res: Response, e: unknown): void {
  if (e instanceof ServiceFout || e instanceof ProfielFout || e instanceof BronFout) {
    res.status(e.status).json({ error: e.message, ...((e as ServiceFout).details ? { details: (e as ServiceFout).details } : {}) });
    return;
  }
  console.error("[role-fit]", e);
  res.status(500).json({ error: "Er liep iets mis in Role Fit." });
}

function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, body: unknown, res: Response): T | null {
  const p = schema.safeParse(body ?? {});
  if (!p.success) {
    res.status(400).json({ error: "Ongeldige invoer.", details: p.error.flatten() });
    return null;
  }
  return p.data;
}

function rollenVoor(zaak: any, adminId: number, scope: Scope): Set<Rol> {
  const r = new Set<Rol>();
  if (scope.soort === "prior") r.add("prior");
  if (zaak.ownerAdminId === adminId) r.add("owner");
  if (zaak.signerAdminId === adminId) r.add("signer");
  if (zaak.reviewerAdminId === adminId) r.add("reviewer");
  if (zaak.recruiterAdminId === adminId) r.add("recruiter");
  if (zaak.hmAdminId === adminId) r.add("hiring_manager");
  return r;
}

async function toegang(req: Request, res: Response): Promise<Toegang | null> {
  const adminId = adminIdVanSessie(req);
  if (adminId === null) {
    res.status(401).json({ error: "Niet aangemeld." });
    return null;
  }
  const scope = await bepaalScope(req);
  if (scope.soort === "geen") {
    res.status(403).json({ error: "Geen toegang." });
    return null;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige case." });
    return null;
  }
  let zaak: any;
  try {
    zaak = svc.haalCase(id);
  } catch (e) {
    stuurFout(res, e);
    return null;
  }
  // Tenant eerst: een case van een andere organisatie bestaat voor deze
  // beheerder niet.
  if (!valtBinnenScope(scope, zaak.organisatieId)) {
    res.status(404).json({ error: "Case niet gevonden." });
    return null;
  }
  const rollen = rollenVoor(zaak, adminId, scope);
  if (rollen.size === 0) {
    audit(adminId, "role_fit_toegang_geweigerd", zaak, { pad: req.path });
    res.status(403).json({ error: "Je bent niet betrokken bij deze case." });
    return null;
  }
  return { adminId, scope, rollen, zaak };
}

function heeftEen(t: Toegang, ...rollen: Rol[]): boolean {
  return rollen.some((r) => t.rollen.has(r));
}

function eis(t: Toegang, res: Response, ...rollen: Rol[]): boolean {
  if (heeftEen(t, ...rollen)) return true;
  res.status(403).json({ error: "Deze stap is voorbehouden aan een andere rol in de case." });
  return false;
}

/** Een observator zonder andere rol ziet tot de vergrendeling geen profiel- of fitinformatie. */
export function isSemiBlind(t: { rollen: Set<Rol>; zaak: any }): boolean {
  const alleenObservator = !heeftEen(t as Toegang, "prior", "owner", "signer", "reviewer");
  return alleenObservator && !minstens(t.zaak.status, "OBSERVATIONS_LOCKED");
}

function zaakPubliek(z: any) {
  return {
    id: z.id,
    organisatieId: z.organisatieId,
    afnameId: z.afnameId,
    kandidaatLabel: z.kandidaatLabel,
    functieTitel: z.functieTitel,
    beslisdoel: z.beslisdoel,
    senioriteit: z.senioriteit,
    beslisdatum: z.beslisdatum,
    status: z.status,
    pakket: z.pakket,
    ownerAdminId: z.ownerAdminId,
    recruiterNaam: z.recruiterNaam,
    recruiterEmail: z.recruiterEmail,
    recruiterAdminId: z.recruiterAdminId,
    hmNaam: z.hmNaam,
    hmEmail: z.hmEmail,
    hmAdminId: z.hmAdminId,
    signerAdminId: z.signerAdminId,
    reviewerAdminId: z.reviewerAdminId,
    rechtsgrond: z.rechtsgrond,
    bewaarTot: z.bewaarTot,
    recruiterBevestigdOp: z.recruiterBevestigdOp,
    hmBevestigdOp: z.hmBevestigdOp,
    freezeOverrideReden: z.freezeOverrideReden,
    bevrorenOp: z.bevrorenOp,
    gearchiveerdOp: z.gearchiveerdOp,
    versie: z.versie,
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

/** De volledige weergave van een case, met de redacties die rol en status vragen. */
export function caseWeergave(t: { rollen: Set<Rol>; zaak: any; adminId: number }) {
  const z = t.zaak;
  const blind = isSemiBlind(t as Toegang);
  const embargo = !minstens(z.status, "INTEGRATION_REVIEW");
  const opdrachten = lijstVoorCase("role_fit_observer_assignments", z.id).map((o) => ({
    id: o.id,
    rol: o.rol,
    actorNaam: o.actorNaam,
    actorEmail: o.actorEmail,
    adminId: o.adminId,
    status: o.status,
    ingediendOp: o.ingediendOp,
    verlooptOp: o.verlooptOp,
  }));
  const observatiesZichtbaar = minstens(z.status, "OBSERVATIONS_LOCKED");
  const waarschuwingen: string[] = [];
  if (z.ownerAdminId && (z.ownerAdminId === z.recruiterAdminId || z.ownerAdminId === z.hmAdminId)) {
    waarschuwingen.push("De case-eigenaar is ook observator. Die ziet het profiel voor de observatie: de observatie is dan niet semi-blind.");
  }
  if (z.signerAdminId === z.recruiterAdminId || z.signerAdminId === z.hmAdminId) {
    waarschuwingen.push("De ondertekenaar is ook observator. Overweeg een reviewer die niet observeerde.");
  }
  const besluit = lijstVoorCase("role_fit_decisions", z.id)[0] ?? null;
  return {
    moduleVersie: RF_MODULE_VERSIE,
    zaak: zaakPubliek(z),
    rollen: Array.from(t.rollen),
    semiBlind: blind,
    convergentieEmbargo: embargo,
    waarschuwingen,
    wizard: json(z.wizardJson, {}),
    bronnen: lijstVoorCase("role_fit_sources", z.id).map((b) => ({ id: b.id, type: b.type, titel: b.titel, url: b.url, lengte: b.lengte, tekst: b.tekst, createdAt: b.createdAt })),
    claims: lijstVoorCase("role_fit_context_claims", z.id),
    vereisten: lijstVoorCase("role_fit_requirements", z.id).map((v) => ({ ...v, bronClaimIds: json(v.bronClaimIds, []) })),
    profielClaims: blind ? [] : lijstVoorCase("role_fit_profile_claims", z.id),
    fitItems: blind ? [] : lijstVoorCase("role_fit_fit_items", z.id).map((f) => ({ ...f, detail: json(f.detailJson, {}) })),
    hypothesen: lijstVoorCase("role_fit_hypotheses", z.id)
      .sort((a, b) => a.rang - b.rang)
      .map((h) => {
        const d = json<any>(h.detailJson, {});
        const basis = { ...h, bronClaimIds: json(h.bronClaimIds, []), detail: d };
        if (blind) {
          // Geen prioriteit en geen profielcodes: die verraden het profielsignaal.
          const { prioriteit: _p, onzekerheid: _o, fitItemId: _f, ...rest } = basis;
          return { ...rest, detail: { ...d, profielClaimCodes: [] } };
        }
        return basis;
      }),
    oefeningen: lijstVoorCase("role_fit_exercises", z.id)
      .sort((a, b) => a.volgorde - b.volgorde)
      .map((e) => ({ ...e, probes: json(e.probesJson, []), ankers: json(e.ankersJson, {}) })),
    opdrachten,
    observaties: observatiesZichtbaar ? svcObservaties(z.id) : [],
    integraties: embargo ? [] : lijstVoorCase("role_fit_integrations", z.id).map((i) => ({ ...i, detail: json(i.detailJson, {}) })),
    gates: svc.gatesVoorBesluit(z.id),
    besluit: besluit ? { ...besluit, detail: json(besluit.detailJson, {}) } : null,
    artefacten: lijstVoorCase("role_fit_artifacts", z.id).map((a) => ({ id: a.id, type: a.type, versie: a.versie, inputHash: a.inputHash, heeftPdf: !!a.pdfBase64, createdAt: a.createdAt })),
    aiRuns: lijstVoorCase("role_fit_ai_runs", z.id).map((r) => ({ id: r.id, taak: r.taak, provider: r.provider, model: r.model, promptversie: r.promptversie, status: r.status, fout: r.fout, aantalVoorstellen: r.aantalVoorstellen, createdAt: r.createdAt })),
  };
}

function svcObservaties(caseId: number) {
  return svc.laadBundel(caseId).observaties.map((o: any) => ({ ...o, taalsignalen: json(o.taalsignalenJson, []) }));
}

type Handler = (t: Toegang, req: Request, res: Response) => Promise<void> | void;
function metCase(h: Handler) {
  return async (req: Request, res: Response) => {
    try {
      const t = await toegang(req, res);
      if (!t) return;
      await h(t, req, res);
    } catch (e) {
      stuurFout(res, e);
    }
  };
}

function tokenGrens(req: Request, res: Response, next: NextFunction): void {
  if (!binnenGrens(`tok:${req.ip}`, TOKEN_PER_MINUUT, 60000)) {
    res.status(429).json({ error: "Te veel verzoeken. Probeer zo dadelijk opnieuw." });
    return;
  }
  next();
}

async function laadPdfRenderer(): Promise<svc.PdfRenderer | null> {
  if (process.env.ROLE_FIT_GEEN_PDF === "1") return null;
  const m = await import("../rapport-pdf");
  return (html, opts) => m.renderRapportPdf(html, opts);
}

async function bronTekst(b: any): Promise<{ type: string; titel: string; url: string | null; tekst: string }> {
  if (b.type === "text") return { type: "text", titel: b.titel || "Geplakte tekst", url: null, tekst: b.tekst.trim() };
  if (b.type === "url") {
    const r = await tekstUitUrl(b.url);
    return { type: "url", titel: r.titel || r.url, url: r.url, tekst: r.tekst };
  }
  const buf = decodeerBase64(b.inhoudBase64);
  const tekst = b.type === "pdf" ? await tekstUitPdf(buf) : b.type === "docx" ? await tekstUitDocx(buf) : tekstUitTxt(buf);
  return { type: b.type, titel: b.bestandsnaam, url: null, tekst };
}

export function registerRoleFitRoutes(app: Express): void {
  zorgVoorTabellen();
  const P = "/api/role-fit";

  // ---- Keuzelijsten --------------------------------------------------------
  app.get(`${P}/afname-kandidaten`, vereisAdmin, async (req, res) => {
    try {
      const scope = await bepaalScope(req);
      if (scope.soort === "geen") return void res.status(403).json({ error: "Geen toegang." });
      const vandaag = new Date().toISOString().slice(0, 10);
      const lijst = (await platformStorage.listAfnames(scope))
        .filter((a: any) => {
          try {
            controleerAfname(a, vandaag);
            return a.organisatieId != null;
          } catch {
            return false;
          }
        })
        .map((a: any) => ({ id: a.id, naam: a.name, rol: a.role, organisatieId: a.organisatieId, taal: a.taal }));
      audit(adminIdVanSessie(req), "role_fit_gelezen", null, { lijst: "afname-kandidaten", aantal: lijst.length });
      res.json(lijst);
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.get(`${P}/beheerders`, vereisAdmin, async (req, res) => {
    try {
      const scope = await bepaalScope(req);
      if (scope.soort === "geen") return void res.status(403).json({ error: "Geen toegang." });
      const orgId = scope.soort === "organisatie" ? scope.organisatieId : Number(req.query.organisatieId) || null;
      const lijst = (await platformStorage.listBeheerders())
        .filter((b: any) => b.actief && (orgId === null ? true : b.organisatieId === orgId || b.isPrior))
        .map((b: any) => ({ id: b.id, naam: b.naam, email: b.email, organisatieId: b.organisatieId, isPrior: !!b.isPrior }));
      res.json(lijst);
    } catch (e) {
      stuurFout(res, e);
    }
  });

  // ---- Cases ---------------------------------------------------------------
  app.get(`${P}/cases`, vereisAdmin, async (req, res) => {
    try {
      const adminId = adminIdVanSessie(req)!;
      const scope = await bepaalScope(req);
      if (scope.soort === "geen") return void res.status(403).json({ error: "Geen toegang." });
      const lijst = lijstCases(scope.soort === "organisatie" ? scope.organisatieId : null)
        .filter((z) => !z.verwijderdOp && rollenVoor(z, adminId, scope).size > 0)
        .map((z) => ({ ...zaakPubliek(z), rollen: Array.from(rollenVoor(z, adminId, scope)) }));
      audit(adminId, "role_fit_gelezen", null, { lijst: "cases", aantal: lijst.length });
      res.json(lijst);
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.post(`${P}/cases`, vereisAdmin, async (req, res) => {
    try {
      const adminId = adminIdVanSessie(req)!;
      const scope = await bepaalScope(req);
      if (scope.soort === "geen") return void res.status(403).json({ error: "Geen toegang." });
      const inv = parse(maakCaseSchema, req.body, res);
      if (!inv) return;
      const afname: any = await platformStorage.getAfname(inv.afnameId);
      if (!afname || !valtBinnenScope(scope, afname.organisatieId)) return void res.status(404).json({ error: "Afname niet gevonden." });
      if (afname.organisatieId == null) return void res.status(409).json({ error: "Deze afname is niet aan een organisatie gekoppeld." });
      if (inv.organisatieId && inv.organisatieId !== afname.organisatieId)
        return void res.status(400).json({ error: "De organisatie van de case moet die van de afname zijn." });
      controleerAfname(afname);
      const profiel = leesProfielUitContract(afname.generatorContract);

      // Ondertekenaar, reviewer en gekoppelde beheerders: actief, en uit dezelfde
      // organisatie of prior.
      const beheerders = new Map((await platformStorage.listBeheerders()).map((b: any) => [b.id, b]));
      const geldig = (id: number | null | undefined) => {
        if (id == null) return true;
        const b: any = beheerders.get(id);
        return !!b && b.actief && (b.isPrior || b.organisatieId === afname.organisatieId);
      };
      for (const [veld, id] of [
        ["ondertekenaar", inv.signerAdminId],
        ["reviewer", inv.reviewerAdminId],
        ["recruiter", inv.recruiterAdminId],
        ["hiring manager", inv.hmAdminId],
      ] as const) {
        if (!geldig(id)) return void res.status(400).json({ error: `De gekozen ${veld} is geen actieve beheerder van deze organisatie.` });
      }
      const vandaag = new Date().toISOString().slice(0, 10);
      if (inv.bewaarTot <= vandaag) return void res.status(400).json({ error: "De bewaartermijn moet in de toekomst liggen." });

      const { afnameId: _a, organisatieId: _o, ...velden } = inv;
      const id = svc.maakCase({
        organisatieId: afname.organisatieId,
        afnameId: afname.id,
        ownerAdminId: adminId,
        kandidaatLabel: afname.name,
        velden,
        profiel,
      });
      const zaak = svc.haalCase(id);
      audit(adminId, "role_fit_case_aangemaakt", zaak, { profielclaims: profiel.claims.length, ontbrekend: profiel.ontbrekendeConstructen });
      res.status(201).json({ id, ontbrekendeConstructen: profiel.ontbrekendeConstructen });
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.get(
    `${P}/cases/:id`,
    vereisAdmin,
    metCase((t, _req, res) => {
      audit(t.adminId, "role_fit_gelezen", t.zaak, { weergave: isSemiBlind(t) ? "semi-blind" : "volledig" });
      res.json(caseWeergave(t));
    }),
  );

  // ---- Context -------------------------------------------------------------
  app.put(
    `${P}/cases/:id/wizard`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const w = parse(wizardSchema, req.body, res);
      if (!w) return;
      svc.bewaarWizard(t.zaak, w as any, t.adminId);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "wizard" });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/bronnen`,
    vereisAdmin,
    metCase(async (t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const b = parse(bronSchema, req.body, res);
      if (!b) return;
      const bron = await bronTekst(b);
      if (bron.tekst.length < 20) return void res.status(422).json({ error: "De bron bevat te weinig leesbare tekst." });
      const id = svc.voegBronToe(t.zaak, bron, t.adminId);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "bron", type: bron.type, lengte: bron.tekst.length });
      res.status(201).json({ id, lengte: bron.tekst.length });
    }),
  );

  app.delete(
    `${P}/cases/:id/bronnen/:bronId`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      svc.verwijderBron(t.zaak, Number(req.params.bronId));
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "bron-verwijderd", bronId: Number(req.params.bronId) });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/context/extraheer`,
    vereisAdmin,
    metCase(async (t, _req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      if (!binnenGrens(`ai:${t.zaak.id}`, AI_PER_UUR, 3600000)) {
        return void res.status(429).json({ error: "De extractie is dit uur al vaak uitgevoerd voor deze case. Probeer later opnieuw." });
      }
      const r = await svc.extraheer(t.zaak, t.adminId);
      audit(t.adminId, "role_fit_extractie", t.zaak, r);
      res.json(r);
    }),
  );

  app.patch(
    `${P}/cases/:id/claims/:claimId`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const inv = parse(claimBeoordelingSchema, req.body, res);
      if (!inv) return;
      svc.beoordeelClaim(t.zaak, Number(req.params.claimId), inv, t.adminId);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "claim", claimId: Number(req.params.claimId), status: inv.status });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/claims`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const inv = parse(handmatigeClaimSchema, req.body, res);
      if (!inv) return;
      const id = svc.voegClaimToe(t.zaak, inv, t.adminId);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "claim-handmatig", claimId: id });
      res.status(201).json({ id });
    }),
  );

  app.post(
    `${P}/cases/:id/vereisten`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const inv = parse(vereisteSchema, req.body, res);
      if (!inv) return;
      const id = svc.voegVereisteToe(t.zaak, inv, t.adminId);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "vereiste", vereisteId: id });
      res.status(201).json({ id });
    }),
  );

  app.delete(
    `${P}/cases/:id/vereisten/:vid`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      svc.verwijderVereiste(t.zaak, Number(req.params.vid));
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "vereiste-verwijderd", vereisteId: Number(req.params.vid) });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/bevestig`,
    vereisAdmin,
    metCase((t, req, res) => {
      const rol = req.body?.rol;
      if (rol !== "recruiter" && rol !== "hiring_manager") return void res.status(400).json({ error: "Rol is recruiter of hiring_manager." });
      const gekoppeld = rol === "recruiter" ? t.zaak.recruiterAdminId : t.zaak.hmAdminId;
      // Is een beheerder gekoppeld, dan bevestigt enkel die. Anders bevestigt de
      // eigenaar namens de externe persoon.
      const mag = gekoppeld ? gekoppeld === t.adminId : heeftEen(t, "owner");
      if (!mag) return void res.status(403).json({ error: "Enkel de gekoppelde persoon bevestigt deze rol." });
      svc.bevestigContext(t.zaak, rol);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "bevestiging", rol, namens: gekoppeld ? null : "eigenaar" });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/freeze`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "recruiter", "hiring_manager")) return;
      const inv = parse(freezeSchema, req.body, res);
      if (!inv) return;
      svc.bevries(t.zaak, inv.overrideReden, heeftEen(t, "owner", "prior"));
      audit(t.adminId, "role_fit_bevroren", t.zaak, { override: !!inv.overrideReden });
      res.json({ ok: true });
    }),
  );

  // ---- H-BOM ---------------------------------------------------------------
  app.post(
    `${P}/cases/:id/hbom/voorstel`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      const r = svc.stelHbomOp(t.zaak);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "hbom-voorstel", pool: r.pool });
      res.json(r);
    }),
  );

  app.post(
    `${P}/cases/:id/hbom/pakket`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      const inv = parse(hbomKeuzeSchema, req.body, res);
      if (!inv) return;
      const ids = svc.kiesPakket(t.zaak, inv.pakket, inv.aantal);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "hbom-pakket", pakket: inv.pakket });
      res.json({ standaardSelectie: ids });
    }),
  );

  app.post(
    `${P}/cases/:id/hbom/goedkeuren`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      const inv = parse(hbomGoedkeuringSchema, req.body, res);
      if (!inv) return;
      const tokens = svc.keurHbomGoed(t.zaak, inv.hypotheseIds, t.adminId);
      audit(t.adminId, "role_fit_hbom_goedgekeurd", t.zaak, { hypothesen: inv.hypotheseIds });
      res.json({
        melding: "Deze links worden maar een keer getoond. Bezorg ze nu aan de observatoren.",
        links: {
          recruiter: `/role-fit/observatie/${tokens.recruiter}`,
          hiring_manager: `/role-fit/observatie/${tokens.hiring_manager}`,
        },
      });
    }),
  );

  app.post(
    `${P}/cases/:id/opdrachten/:rol/nieuwe-link`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      const rol = req.params.rol;
      if (rol !== "recruiter" && rol !== "hiring_manager") return void res.status(400).json({ error: "Onbekende rol." });
      const token = svc.vernieuwLink(t.zaak, rol);
      audit(t.adminId, "role_fit_link_vernieuwd", t.zaak, { rol });
      res.json({ link: `/role-fit/observatie/${token}` });
    }),
  );

  app.post(
    `${P}/cases/:id/hbom/start`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      svc.startObservatie(t.zaak);
      audit(t.adminId, "role_fit_gewijzigd", t.zaak, { stap: "observatie-gestart" });
      res.json({ ok: true });
    }),
  );

  // ---- Integratie -----------------------------------------------------------
  app.post(
    `${P}/cases/:id/integratie/bereken`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior", "reviewer")) return;
      svc.berekenIntegratie(t.zaak);
      audit(t.adminId, "role_fit_integratie", t.zaak, { stap: "berekend" });
      res.json({ ok: true });
    }),
  );

  app.put(
    `${P}/cases/:id/integratie`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (!eis(t, res, "owner", "prior", "reviewer")) return;
      const inv = parse(integratieSchema, req.body, res);
      if (!inv) return;
      svc.reviewIntegratie(t.zaak, inv, t.adminId);
      audit(t.adminId, "role_fit_integratie", t.zaak, {
        stap: "review",
        overrides: inv.overrides.length,
        gates: inv.gates.length,
        ontbrekendBehandeld: inv.ontbrekendBehandeld || null,
      });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/integratie/klaar`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior", "reviewer")) return;
      svc.integratieKlaar(t.zaak);
      audit(t.adminId, "role_fit_integratie", t.zaak, { stap: "klaar" });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/cases/:id/integratie/terug`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior", "reviewer", "signer")) return;
      svc.terugNaarIntegratie(t.zaak);
      audit(t.adminId, "role_fit_integratie", t.zaak, { stap: "terug" });
      res.json({ ok: true });
    }),
  );

  // ---- Besluit ---------------------------------------------------------------
  app.get(
    `${P}/cases/:id/besluit/toegestaan`,
    vereisAdmin,
    metCase(async (t, _req, res) => {
      const { toetsBesluit } = await import("./integration-engine");
      res.json(toetsBesluit(svc.gatesVoorBesluit(t.zaak.id), "positive", []));
    }),
  );

  app.post(
    `${P}/cases/:id/besluit`,
    vereisAdmin,
    metCase(async (t, req, res) => {
      if (t.zaak.signerAdminId !== t.adminId) return void res.status(403).json({ error: "Enkel de aangeduide ondertekenaar tekent het besluit." });
      const inv = parse(besluitSchema, req.body, res);
      if (!inv) return;
      const signer: any = await platformStorage.getBeheerder(t.adminId);
      const id = svc.teken(t.zaak, inv, { id: t.adminId, naam: signer?.naam ?? `Beheerder ${t.adminId}` });
      audit(t.adminId, "role_fit_besluit_getekend", t.zaak, { besluitId: id, aanbeveling: inv.aanbeveling });
      res.status(201).json({ id });
    }),
  );

  // ---- Rapporten ------------------------------------------------------------
  app.post(
    `${P}/cases/:id/rapporten/:type`,
    vereisAdmin,
    metCase(async (t, req, res) => {
      const type = req.params.type as RapportType;
      if (!RAPPORT_TYPES.includes(type)) return void res.status(404).json({ error: "Onbekend rapporttype." });
      if (isSemiBlind(t)) return void res.status(403).json({ error: "Rapporten zijn pas zichtbaar na de vergrendeling van de observaties." });
      if (type !== "hbom-guide" && !heeftEen(t, "owner", "prior", "signer", "reviewer") && !minstens(t.zaak.status, "INTEGRATION_REVIEW")) {
        return void res.status(403).json({ error: "Dit rapport is voorbehouden aan eigenaar, ondertekenaar en reviewer." });
      }
      const r = await svc.maakRapport(t.zaak.id, type, t.adminId, await laadPdfRenderer());
      audit(t.adminId, "role_fit_rapport_gemaakt", t.zaak, { type, versie: r.artefact.versie, hergebruikt: r.hergebruikt });
      res.status(r.hergebruikt ? 200 : 201).json({ id: r.artefact.id, versie: r.artefact.versie, inputHash: r.artefact.inputHash, hergebruikt: r.hergebruikt, heeftPdf: !!r.artefact.pdfBase64 });
    }),
  );

  app.get(
    `${P}/cases/:id/artefacten/:aid`,
    vereisAdmin,
    metCase((t, req, res) => {
      if (isSemiBlind(t)) return void res.status(403).json({ error: "Rapporten zijn pas zichtbaar na de vergrendeling van de observaties." });
      const a = lijstVoorCase("role_fit_artifacts", t.zaak.id, "AND id = ?", Number(req.params.aid))[0];
      if (!a) return void res.status(404).json({ error: "Rapport niet gevonden." });
      const formaat = req.query.formaat === "html" ? "html" : "pdf";
      audit(t.adminId, "role_fit_rapport_gedownload", t.zaak, { artefactId: a.id, type: a.type, versie: a.versie, formaat });
      const naam = `role-fit-${t.zaak.id}-${a.type}-v${a.versie}`;
      if (formaat === "html" || !a.pdfBase64) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return void res.send(svc.htmlVoorArtefact(a));
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${naam}.pdf"`);
      res.send(Buffer.from(a.pdfBase64, "base64"));
    }),
  );

  // ---- Levenscyclus -----------------------------------------------------------
  app.post(
    `${P}/cases/:id/archiveer`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      svc.archiveer(t.zaak);
      audit(t.adminId, "role_fit_gearchiveerd", t.zaak);
      res.json({ ok: true });
    }),
  );

  app.delete(
    `${P}/cases/:id`,
    vereisAdmin,
    metCase((t, _req, res) => {
      if (!eis(t, res, "owner", "prior")) return;
      wisCaseInhoud(t.zaak.id);
      audit(t.adminId, "role_fit_verwijderd", t.zaak, { reden: "op verzoek" });
      res.json({ ok: true });
    }),
  );

  app.post(`${P}/opruimen`, vereisAdmin, async (req, res) => {
    try {
      const adminId = adminIdVanSessie(req)!;
      const scope = await bepaalScope(req);
      if (scope.soort !== "prior") return void res.status(403).json({ error: "Enkel een prior-beheerder ruimt op." });
      const vandaag = new Date().toISOString().slice(0, 10);
      const verlopen = lijstCases(null).filter((z) => !z.verwijderdOp && z.bewaarTot < vandaag);
      for (const z of verlopen) {
        wisCaseInhoud(z.id);
        audit(adminId, "role_fit_verwijderd", z, { reden: "bewaartermijn verstreken" });
      }
      res.json({ verwijderd: verlopen.length });
    } catch (e) {
      stuurFout(res, e);
    }
  });

  // ---- Publieke observatorroutes -----------------------------------------------
  const opdracht = (req: Request, res: Response): any | null => {
    const token = String(req.params.token ?? "");
    if (token.length < 20 || token.length > 100) {
      res.status(404).json({ error: "Link niet gevonden." });
      return null;
    }
    const o = opdrachtVoorToken(token);
    if (!o) {
      res.status(404).json({ error: "Link niet gevonden." });
      return null;
    }
    return o;
  };

  app.get(`${P}/observatie/:token`, tokenGrens, (req, res) => {
    try {
      const o = opdracht(req, res);
      if (!o) return;
      const { zaak, oefeningen } = svc.opdrachtContext(o);
      audit(null, "role_fit_gelezen", zaak, { weergave: "observator", rol: o.rol });
      const eigen = minstens(zaak.status, "OBSERVATIONS_LOCKED") || o.ingediendOp
        ? svc.laadBundel(zaak.id).observaties.filter((x: any) => x.assignmentId === o.id)
        : [];
      // Semi-blind: geen profiel, geen fitindicaties, geen hypothesepool en niets
      // van de andere observator.
      res.json({
        rol: o.rol,
        actorNaam: o.actorNaam,
        functieTitel: zaak.functieTitel,
        kandidaatLabel: zaak.kandidaatLabel,
        status: zaak.status,
        ingediendOp: o.ingediendOp,
        versie: o.versie,
        concept: json(o.conceptJson, {}),
        oefeningen: oefeningen.map((e) => ({
          id: e.id,
          volgorde: e.volgorde,
          methode: e.methode,
          titel: e.titel,
          instructie: e.instructie,
          probes: json(e.probesJson, []),
          ankers: json(e.ankersJson, {}),
        })),
        eigenObservaties: eigen,
        magCorrigeren: zaak.status === "OBSERVATIONS_LOCKED",
      });
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.post(`${P}/observatie/:token/taalcoach`, tokenGrens, (req, res) => {
    const tekst = typeof req.body?.tekst === "string" ? req.body.tekst.slice(0, 5000) : "";
    res.json({ meldingen: taalcoachMeldingen(tekst) });
  });

  app.put(`${P}/observatie/:token/concept`, tokenGrens, (req, res) => {
    try {
      const o = opdracht(req, res);
      if (!o) return;
      const inv = parse(observatieConceptSchema, req.body, res);
      if (!inv) return;
      svc.bewaarConcept(o, inv.regels);
      res.json({ ok: true });
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.post(`${P}/observatie/:token/indienen`, tokenGrens, (req, res) => {
    try {
      const o = opdracht(req, res);
      if (!o) return;
      const inv = parse(observatieIndienSchema, req.body, res);
      if (!inv) return;
      const r = svc.dienIn(o, inv.regels, inv.bevestigTaalcoach);
      const zaak = svc.haalCase(o.caseId);
      audit(o.adminId ?? null, "role_fit_observatie_ingediend", zaak, { rol: o.rol, regels: inv.regels.length, vergrendeld: r.vergrendeld });
      res.json(r);
    } catch (e) {
      stuurFout(res, e);
    }
  });

  app.post(`${P}/observatie/:token/correctie`, tokenGrens, (req, res) => {
    try {
      const o = opdracht(req, res);
      if (!o) return;
      const inv = parse(observatieCorrectieSchema, req.body, res);
      if (!inv) return;
      const versie = svc.corrigeer(o, inv.regel, inv.reden);
      const zaak = svc.haalCase(o.caseId);
      audit(o.adminId ?? null, "role_fit_observatie_gecorrigeerd", zaak, { rol: o.rol, oefening: inv.regel.exerciseId, versie });
      res.json({ versie });
    } catch (e) {
      stuurFout(res, e);
    }
  });
}
