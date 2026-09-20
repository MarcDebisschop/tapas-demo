import type { Express } from "express";
import { teamscanStorage as storage } from "./storage";
import { teamscanAntwoordenInhoudSchema, insertTeamscanSessieSchema } from "./schema";
import { scoorIndividueel, aggregeerTeam, itembank, interpretatie } from "./scoring";
import { vertaalItembank } from "./itembank-i18n";
import { renderIndividueelRapport, renderTeamRapport } from "./rapport";
import { renderRapportPdf } from "../rapport-pdf";
import { z } from "zod";
import { vereisScope, scopeVanVerzoek } from "../scope-guard";
import { storage as platformStorage } from "../storage";
// De rapportsluis van Human Due Diligence: hoort dit token bij een lid van een
// traject, dan leest het lid zijn Teamscan-rapport niet voor de begeleider het
// vrijgeeft. Zie ../hdd/rapportsluis.ts.
import { rapportGesloten, sluisWeigering } from "../hdd/rapportsluis";

/**
 * TaPas Teamscan - routes (prefix /api/teamscan/...).
 * ------------------------------------------------------------------
 * Reflectie- en ontwikkelinstrument. Een coach/teamleider maakt een
 * sessie, voegt (anonieme) deelnemers toe, deelnemers vullen via hun
 * token in. Het teamrapport vereist minimaal 3 afgeronde invullingen
 * (privacy/aggregatie).
 *
 * Twee soorten weg, twee soorten poort:
 *
 *   1. De BEHEERDERSWEG (sessies aanmaken en bekijken, deelnemers aanmaken,
 *      sluiten, teamrapport) toont en maakt organisatiegegevens. Die routes
 *      staan achter `vereisScope`, net zoals de HDD-routes in
 *      server/hdd/routes.ts. Tot nu toe stonden ze helemaal open: iedereen kon
 *      alle sessies van alle organisaties opsommen en er deelnemers bij maken.
 *
 *   2. De DEELNEMERSWEG loopt over het token in de link en heeft per definitie
 *      geen aanmelding. Die routes (itembank, /deelnemer/:token en het eigen
 *      rapport daarachter) blijven dus open; hun bescherming is het onraadbare
 *      token plus de tokenbegrenzer in server/index.ts.
 */

const MIN_DEELNEMERS_TEAMRAPPORT = 3;

export function registerTeamscanRoutes(app: Express): void {
  // ---- Itembank (afname-UI haalt items + config hier op) ----
  app.get("/api/teamscan/itembank", (req, res) => {
    const taal = typeof req.query.taal === "string" ? req.query.taal : "nl";
    res.json(vertaalItembank(taal));
  });

  // ---- Sessies ----
  app.get("/api/teamscan/sessies", vereisScope, (_req, res) => {
    res.json(storage.alleSessies());
  });

  app.post("/api/teamscan/sessies", vereisScope, async (req, res) => {
    const parsed = insertTeamscanSessieSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const platformSessieId =
      req.body?.platformSessieId != null ? Number(req.body.platformSessieId) : undefined;
    // De sessie hoort bij een organisatie, niet bij een leeg label. Staat er
    // geen orgLabel in de body, dan komt het uit de scope van de oproeper, en
    // dus uit de sessie en nooit uit het verzoek. Bij een prior-oproeper blijft
    // het leeg tenzij hij er zelf een meegeeft: het platform is geen klant.
    const scope = scopeVanVerzoek(req);
    let orgLabel = parsed.data.orgLabel ?? "";
    if (!orgLabel.trim() && scope.soort === "organisatie") {
      const org = await platformStorage.getOrganisatie(scope.organisatieId);
      orgLabel = org?.naam ?? "";
    }
    const sessie = storage.maakSessie({ ...parsed.data, orgLabel }, platformSessieId);
    res.json(sessie);
  });

  app.get("/api/teamscan/sessies/:id", vereisScope, (req, res) => {
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

  app.post("/api/teamscan/sessies/:id/sluiten", vereisScope, (req, res) => {
    const sessie = storage.sluitSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Niet gevonden" });
    res.json(sessie);
  });

  // ---- Deelnemers ----
  app.post("/api/teamscan/sessies/:id/deelnemers", vereisScope, (req, res) => {
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
  app.get("/api/teamscan/deelnemer/:token/rapport", async (req, res) => {
    const deelnemer = storage.getDeelnemerViaToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Ongeldige link" });
    // Deze route staat open op het token, want een Teamscan-deelnemer heeft geen
    // login. Precies daarom hoort de sluis hier: een board member van een
    // Human Due Diligence zou anders zijn eigen Teamscan-rapport lezen voordat
    // de begeleider het gezien heeft.
    if (rapportGesloten(req.params.token)) return sluisWeigering(res);
    const antwoorden = storage.getAntwoorden(deelnemer.id);
    if (!antwoorden) return res.status(404).json({ error: "Nog geen antwoorden ingediend" });
    const resultaat = scoorIndividueel(antwoorden);
    const formaat = (req.query.formaat as string) ?? "json";
    if (formaat === "pdf") {
      const html = renderIndividueelRapport(resultaat, deelnemer.label);
      try {
        const buffer = await renderRapportPdf(html, { titel: `Teamscan - ${deelnemer.label}` });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="teamscan-individueel.pdf"');
        return res.send(buffer);
      } catch (e) {
        console.error("[teamscan] PDF-render mislukt, terugval op HTML:", e);
        return res.type("html").send(html);
      }
    }
    if (formaat === "html") {
      res.type("html").send(renderIndividueelRapport(resultaat, deelnemer.label));
    } else {
      res.json(resultaat);
    }
  });

  // ---- Teamrapport (aggregatie) ----
  app.get("/api/teamscan/sessies/:id/teamrapport", vereisScope, async (req, res) => {
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
    if (formaat === "pdf") {
      const html = renderTeamRapport(team, sessie.teamNaam);
      try {
        const buffer = await renderRapportPdf(html, { titel: `Teamscan - ${sessie.teamNaam}` });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="teamscan-teamrapport.pdf"');
        return res.send(buffer);
      } catch (e) {
        console.error("[teamscan] PDF-render mislukt, terugval op HTML:", e);
        return res.type("html").send(html);
      }
    }
    if (formaat === "html") {
      res.type("html").send(renderTeamRapport(team, sessie.teamNaam));
    } else {
      res.json(team);
    }
  });
}
