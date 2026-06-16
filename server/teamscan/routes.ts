import type { Express } from "express";
import { teamscanStorage as storage } from "./storage";
import { teamscanAntwoordenInhoudSchema, insertTeamscanSessieSchema } from "./schema";
import { scoorIndividueel, aggregeerTeam, itembank, interpretatie } from "./scoring";
import { vertaalItembank } from "./itembank-i18n";
import { renderIndividueelRapport, renderTeamRapport } from "./rapport";
import { z } from "zod";

/**
 * TaPas Teamscan — routes (prefix /api/teamscan/...).
 * ------------------------------------------------------------------
 * Reflectie- en ontwikkelinstrument. Een coach/teamleider maakt een
 * sessie, voegt (anonieme) deelnemers toe, deelnemers vullen via hun
 * token in. Het teamrapport vereist minimaal 3 afgeronde invullingen
 * (privacy/aggregatie).
 */

const MIN_DEELNEMERS_TEAMRAPPORT = 3;

export function registerTeamscanRoutes(app: Express): void {
  // ---- Itembank (afname-UI haalt items + config hier op) ----
  app.get("/api/teamscan/itembank", (req, res) => {
    const taal = typeof req.query.taal === "string" ? req.query.taal : "nl";
    res.json(vertaalItembank(taal));
  });

  // ---- Sessies ----
  app.get("/api/teamscan/sessies", (_req, res) => {
    res.json(storage.alleSessies());
  });

  app.post("/api/teamscan/sessies", (req, res) => {
    const parsed = insertTeamscanSessieSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const platformSessieId =
      req.body?.platformSessieId != null ? Number(req.body.platformSessieId) : undefined;
    const sessie = storage.maakSessie(parsed.data, platformSessieId);
    res.json(sessie);
  });

  app.get("/api/teamscan/sessies/:id", (req, res) => {
    const sessie = storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Niet gevonden" });
    const deelnemers = storage.deelnemersVanSessie(sessie.id);
    res.json({
      ...sessie,
      deelnemers,
      aantalAfgerond: deelnemers.filter((d) => d.afgerond).length,
      minVoorTeamrapport: MIN_DEELNEMERS_TEAMRAPPORT,
    });
  });

  app.post("/api/teamscan/sessies/:id/sluiten", (req, res) => {
    const sessie = storage.sluitSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Niet gevonden" });
    res.json(sessie);
  });

  // ---- Deelnemers ----
  app.post("/api/teamscan/sessies/:id/deelnemers", (req, res) => {
    const sessieId = Number(req.params.id);
    const sessie = storage.getSessie(sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const aantal = Number(req.body?.aantal ?? 1);
    const veilig = Math.max(1, Math.min(50, isFinite(aantal) ? aantal : 1));
    const nieuwe = [];
    for (let i = 0; i < veilig; i++) {
      nieuwe.push(storage.maakDeelnemer(sessieId, req.body?.label ?? ""));
    }
    res.json(nieuwe);
  });

  // Deelnemer haalt zijn eigen afname-context op via token.
  app.get("/api/teamscan/deelnemer/:token", (req, res) => {
    const deelnemer = storage.getDeelnemerViaToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Ongeldige link" });
    const sessie = storage.getSessie(deelnemer.sessieId);
    res.json({
      deelnemer,
      sessie,
      reedsIngevuld: deelnemer.afgerond,
    });
  });

  // Deelnemer dient antwoorden in.
  app.post("/api/teamscan/deelnemer/:token/antwoorden", (req, res) => {
    const deelnemer = storage.getDeelnemerViaToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Ongeldige link" });
    const parsed = teamscanAntwoordenInhoudSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Validatie: volledigheid van de drie blokken.
    const fundamentIds: string[] = itembank.fundamentPijler.items;
    const lencioniIds: number[] = itembank.blokken.B_lencioni.items.map((it: any) => it.id);
    const elementIds: string[] = itembank.blokken.C_vertrouwensanatomie.elementen.map(
      (e: any) => e.id,
    );

    const missenF = fundamentIds.filter((id) => parsed.data.fundament[id] == null);
    const missenL = lencioniIds.filter((id) => parsed.data.lencioni[String(id)] == null);
    if (missenF.length || missenL.length) {
      return res.status(400).json({
        error: "Niet alle stellingen zijn ingevuld",
        ontbreektFundament: missenF,
        ontbreektLencioni: missenL,
      });
    }

    // Validatie ranking: alle 5 elementen, unieke rangen 1..5.
    const rangen = elementIds.map((id) => parsed.data.vertrouwenRanking[id]);
    const uniek = new Set(rangen);
    const correct =
      rangen.every((r) => r >= 1 && r <= 5) && uniek.size === 5 && rangen.length === elementIds.length;
    if (!correct) {
      return res.status(400).json({
        error: "De vertrouwenselementen moeten een unieke rangschikking 1 t/m 5 krijgen (geen dubbels).",
      });
    }
    const missenP = elementIds.filter((id) => parsed.data.vertrouwenPrestatie[id] == null);
    if (missenP.length) {
      return res.status(400).json({ error: "Niet alle prestatie-scores zijn ingevuld", ontbreekt: missenP });
    }

    storage.bewaarAntwoorden(deelnemer.id, parsed.data);
    res.json({ ok: true });
  });

  // ---- Individueel rapport (per deelnemer) ----
  app.get("/api/teamscan/deelnemer/:token/rapport", (req, res) => {
    const deelnemer = storage.getDeelnemerViaToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Ongeldige link" });
    const antwoorden = storage.getAntwoorden(deelnemer.id);
    if (!antwoorden) return res.status(404).json({ error: "Nog geen antwoorden ingediend" });
    const resultaat = scoorIndividueel(antwoorden);
    const formaat = (req.query.formaat as string) ?? "json";
    if (formaat === "html") {
      res.type("html").send(renderIndividueelRapport(resultaat, deelnemer.label));
    } else {
      res.json(resultaat);
    }
  });

  // ---- Teamrapport (aggregatie) ----
  app.get("/api/teamscan/sessies/:id/teamrapport", (req, res) => {
    const sessieId = Number(req.params.id);
    const sessie = storage.getSessie(sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const ruweAntwoorden = storage.afgerondeAntwoordenVanSessie(sessieId);
    if (ruweAntwoorden.length < MIN_DEELNEMERS_TEAMRAPPORT) {
      return res.status(409).json({
        error: `Een teamrapport vereist minstens ${MIN_DEELNEMERS_TEAMRAPPORT} afgeronde invullingen (privacy en betrouwbaarheid). Nu afgerond: ${ruweAntwoorden.length}.`,
        aantalAfgerond: ruweAntwoorden.length,
        minimum: MIN_DEELNEMERS_TEAMRAPPORT,
      });
    }
    const individuen = ruweAntwoorden.map((a) => scoorIndividueel(a));
    const team = aggregeerTeam(individuen);
    const formaat = (req.query.formaat as string) ?? "json";
    if (formaat === "html") {
      res.type("html").send(renderTeamRapport(team, sessie.teamNaam));
    } else {
      res.json(team);
    }
  });
}
