import type { Express } from "express";
import { t4oStorage as storage } from "./storage";
import { insertT4OSessieSchema, GROEP_NAAR_RING, T4O_GROEPEN, type T4OGroep } from "./schema";
import { t4oInstrument, itemsVoorRing, verplichteItemIdsVoorRing } from "./instrument";
import { scoorOrganisatie } from "./scoring";
import { renderT4ORapport } from "./rapport";
import { renderRapportPdf } from "../rapport-pdf";
import { seedBishop } from "./seed";

/**
 * TaPas 4 Organizations — routes (prefix /api/t4o/...).
 * ------------------------------------------------------------------
 * Een facilitator maakt een organisatie-afname, voegt respondenten toe
 * per ring (leiding/medewerker/stakeholder), respondenten vullen via hun
 * token de ring-specifieke vragen in. Het organisatierapport vereist
 * minimaal 3 afgeronde invullingen (privacy/aggregatie).
 */

const MIN_VOOR_RAPPORT = 3;

export function registerT4OrganizationsRoutes(app: Express): void {
  // Demonstratie-afname "Bishop & Bishop" idempotent seeden bij startup.
  seedBishop();

  // ---- Sessies -------------------------------------------------------------
  app.get("/api/t4o/sessies", (_req, res) => {
    res.json(storage.alleSessies());
  });

  app.post("/api/t4o/sessies", (req, res) => {
    const parsed = insertT4OSessieSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.maakSessie(parsed.data));
  });

  app.get("/api/t4o/sessies/:id", (req, res) => {
    const sessie = storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Niet gevonden" });
    const respondenten = storage.respondentenVanSessie(sessie.id);
    res.json({
      ...sessie,
      respondenten,
      aantalAfgerond: respondenten.filter((r) => r.afgerond).length,
      minVoorRapport: MIN_VOOR_RAPPORT,
    });
  });

  // ---- Respondenten (per groep/ring toevoegen) -----------------------------
  app.post("/api/t4o/sessies/:id/respondenten", (req, res) => {
    const sessieId = Number(req.params.id);
    const sessie = storage.getSessie(sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const groep = String(req.body?.groep ?? "");
    if (!T4O_GROEPEN.includes(groep as T4OGroep)) {
      return res.status(400).json({ error: "Ongeldige groep. Kies leiding, medewerker of stakeholder." });
    }
    const aantal = Number(req.body?.aantal ?? 1);
    const veilig = Math.max(1, Math.min(100, isFinite(aantal) ? aantal : 1));
    const nieuwe = [];
    for (let i = 0; i < veilig; i++) {
      nieuwe.push(storage.maakRespondent(sessieId, groep as T4OGroep));
    }
    res.json(nieuwe);
  });

  // ---- Instrument ----------------------------------------------------------
  app.get("/api/t4o/instrument", (_req, res) => {
    res.json(t4oInstrument);
  });

  // ---- Respondent-context via token ----------------------------------------
  app.get("/api/t4o/respondent/:token", (req, res) => {
    const respondent = storage.getRespondentViaToken(req.params.token);
    if (!respondent) return res.status(404).json({ error: "Ongeldige link" });
    const sessie = storage.getSessie(respondent.sessieId);
    const ring = GROEP_NAAR_RING[respondent.groep as T4OGroep];
    res.json({
      respondent: { groep: respondent.groep, ring },
      sessie: { orgNaam: sessie?.orgNaam ?? "" },
      ring,
      reedsIngevuld: respondent.afgerond,
    });
  });

  // ---- Antwoorden indienen -------------------------------------------------
  app.post("/api/t4o/respondent/:token/antwoorden", (req, res) => {
    const respondent = storage.getRespondentViaToken(req.params.token);
    if (!respondent) return res.status(404).json({ error: "Ongeldige link" });
    const ring = GROEP_NAAR_RING[respondent.groep as T4OGroep];
    const map = req.body;
    if (typeof map !== "object" || map == null) {
      return res.status(400).json({ error: "Ongeldige antwoorden" });
    }

    // Volledigheid valideren op basis van de ring-items.
    const items = itemsVoorRing(ring);
    const ontbreekt: string[] = [];
    for (const it of items) {
      const w = map[it.id];
      if (it.itemType === "forced-choice-rank") {
        if (!Array.isArray(w) || w.length !== (it.rank ?? 3)) ontbreekt.push(it.id);
      } else if (it.itemType === "forced-choice-multi") {
        if (!Array.isArray(w) || w.length !== (it.select ?? 2)) ontbreekt.push(it.id);
      } else if (w == null || w === "") {
        ontbreekt.push(it.id);
      }
    }
    if (ontbreekt.length) {
      return res.status(400).json({ error: "Niet alle vragen zijn ingevuld", ontbreekt });
    }

    // Enkel de ring-items bewaren (voorkomt vervuiling door irrelevante keys).
    const geldigeIds = new Set(verplichteItemIdsVoorRing(ring));
    const schoon: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(map)) {
      if (geldigeIds.has(k)) schoon[k] = v;
    }
    storage.bewaarAntwoorden(respondent.id, schoon as any);
    res.json({ ok: true });
  });

  // ---- Organisatierapport --------------------------------------------------
  app.get("/api/t4o/sessies/:id/rapport", async (req, res) => {
    const sessieId = Number(req.params.id);
    const sessie = storage.getSessie(sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const antwoorden = storage.afgerondeAntwoordenVanSessie(sessieId);
    if (antwoorden.length < MIN_VOOR_RAPPORT) {
      return res.status(409).json({
        error: `Een organisatierapport vereist minstens ${MIN_VOOR_RAPPORT} afgeronde invullingen. Nu afgerond: ${antwoorden.length}.`,
        aantalAfgerond: antwoorden.length,
        minimum: MIN_VOOR_RAPPORT,
      });
    }
    const scores = scoorOrganisatie(antwoorden);
    const formaat = (req.query.formaat as string) ?? "html";
    if (formaat === "pdf") {
      // Zelfde vaste HTML-layout, omgezet naar PDF via de gedeelde laag. Faalt de
      // render, dan terugval op HTML zodat de flow nooit breekt.
      const html = renderT4ORapport(scores, sessie);
      try {
        const buffer = await renderRapportPdf(html, { titel: "T4O Organisatierapport" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="t4o-organisatierapport.pdf"');
        return res.send(buffer);
      } catch (e) {
        console.error("[t4o] PDF-render mislukt, terugval op HTML:", e);
        return res.type("html").send(html);
      }
    }
    if (formaat === "html") {
      res.type("html").send(renderT4ORapport(scores, sessie));
    } else {
      res.json(scores);
    }
  });
}
