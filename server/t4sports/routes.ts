// server/t4sports/routes.ts
// Routes voor T4Sports — Mental Talent Profiel.
// Gebruikt bestaande storage (afnames-tabel), geen nieuwe tabellen.

import type { Express } from "express";
import { z } from "zod";
import { storage, CreditError } from "../storage";
import { clientInstrumentVan } from "../instrument";
import { getDescriptor } from "../registry";
import { buildT4SportsContract } from "./scoring";
import type { BlockResponse } from "./scoring";
import { genereerT4SportsRapport } from "./rapport";
import { bouwT4SportsUitlegScript } from "./uitleg";
import { bouwT4SportsChatProfiel } from "./chat";
import { getAthleteBibliotheek, getAthletePodcasts } from "./bibliotheek";
import type { Toon } from "./uitleg";

// Demo modus: geen echte LLM chat
const DEMO_MODE = process.env.TAPAS_DEMO === "1";
const CHAT_SIDECAR_URL = process.env.TAPAS_CHAT_SIDECAR ?? "http://127.0.0.1:8000";

function makeRespondentCode(name: string, id: number): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
  const year = new Date().getFullYear();
  const seq = String(id).padStart(3, "0");
  return `T4S-${initials || "ATL"}-${year}-${seq}`;
}

// Schema voor het starten van een T4Sports afname
const SPORT_NIVEAUS = ["elite", "topsport", "hoog_amateurs", "recreatief_competitief", "recreatief"] as const;
const SPORT_TYPES = ["individueel", "ploeg"] as const;
const AMBITIES = ["best_of_world", "topper", "subtopper", "recreatief_limieten", "plezier"] as const;

const startT4SportsSchema = z.object({
  name: z.string().min(1).max(120),
  sporttak: z.string().min(1).max(80).optional(),
  ploeg: z.string().max(80).optional(),
  rol: z.string().max(80).optional(),
  niveau: z.enum(SPORT_NIVEAUS).optional(),
  sportType: z.enum(SPORT_TYPES).optional(),
  ambitie: z.enum(AMBITIES).optional(),
  taal: z.string().max(5).optional().default("nl"),
  baselineEnergy: z.number().int().min(0).max(10).default(5),
  organisatieId: z.number().int().positive().optional(),
  deelnemerEmail: z.string().email().optional(),
});

// Schema voor responses opslaan
const saveResponsesSchema = z.object({
  responses: z.record(z.any()),
});

// Schema voor voltooiing
const voltooiSchema = z.object({
  responses: z.record(z.any()),
  connection: z.object({
    q1: z.number().min(0).max(10),
    q2: z.number().min(0).max(10),
    q3: z.number().min(0).max(10),
    q4: z.number().min(0).max(10),
  }),
  baselineEnergy: z.number().min(0).max(10).optional(),
});

export function registerT4SportsRoutes(app: Express): void {
  // =========================================================================
  // GET /api/t4sports/instrument — instrument-definitie voor de client
  // =========================================================================
  app.get("/api/t4sports/instrument", (req, res) => {
    const taal = (req.query.taal as string) ?? "nl";
    const desc = getDescriptor("t4sports");
    if (!desc?.instrument) return res.status(404).json({ error: "T4Sports instrument niet gevonden" });
    const clientView = clientInstrumentVan(desc.instrument, taal as any);
    res.json(clientView);
  });

  // =========================================================================
  // POST /api/t4sports/afnames — nieuwe T4Sports afname starten
  // =========================================================================
  app.post("/api/t4sports/afnames", async (req, res) => {
    const parsed = startT4SportsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const data = parsed.data;

    // Credits checken
    if (data.organisatieId != null) {
      const org = await storage.getOrganisatie(data.organisatieId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
      const saldo = await storage.getSaldo(data.organisatieId);
      if (saldo.beschikbaar < 1) {
        return res.status(402).json({
          error: "Onvoldoende credits.",
          code: "GEEN_CREDITS",
        });
      }
    }

    const consentIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    const consentUserAgent = (req.headers["user-agent"] as string) ?? null;

    const created = await storage.createAfname({
      organisatieId: data.organisatieId ?? null,
      respondentCode: `TMP-T4S-${Date.now()}`,
      name: data.name,
      company: null,
      role: data.rol ?? null,
      baselineEnergy: data.baselineEnergy,
      taal: data.taal,
      consentScope: "t4sports-profiel-generatie",
      consentTimestamp: new Date().toISOString(),
      consentIp,
      consentUserAgent,
    });

    // Credit reserveren
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
    // Sla extra T4Sports-specifieke velden op in generatorContract als JSON
    const niveauLabels: Record<string, string> = {
      elite: "Elite / Professioneel",
      topsport: "Topsport / Semi-professioneel",
      hoog_amateurs: "Hoog competitief amateur",
      recreatief_competitief: "Recreatief maar competitief",
      recreatief: "Puur recreatief",
    };
    const ambitieLabels: Record<string, string> = {
      best_of_world: "Best of the world — absolute top",
      topper: "Topper in mijn discipline",
      subtopper: "Subtopper — sterk nationaal niveau",
      recreatief_limieten: "Recreatief maar mijn limieten opzoeken",
      plezier: "Plezier en gezondheid voorop",
    };
    const t4sportsContext = JSON.stringify({
      instrumentId: "t4sports",
      sporttak: data.sporttak ?? null,
      ploeg: data.ploeg ?? null,
      rol: data.rol ?? null,
      niveau: data.niveau ?? null,
      niveauLabel: data.niveau ? (niveauLabels[data.niveau] ?? data.niveau) : null,
      sportType: data.sportType ?? null,
      ambitie: data.ambitie ?? null,
      ambitieLabel: data.ambitie ? (ambitieLabels[data.ambitie] ?? data.ambitie) : null,
    });
    const updated = await storage.updateAfname(created.id, {
      respondentCode: finalCode,
      generatorContract: t4sportsContext,
      deelnemerEmail: data.deelnemerEmail ?? null,
    });
    res.json(updated);
  });

  // =========================================================================
  // GET /api/t4sports/afnames/:id — afname ophalen
  // =========================================================================
  app.get("/api/t4sports/afnames/:id", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json(a);
  });

  // =========================================================================
  // POST /api/t4sports/afnames/:id/responses — responses tussentijds bewaren
  // =========================================================================
  app.post("/api/t4sports/afnames/:id/responses", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    const parsed = saveResponsesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ongeldige responses" });
    const updated = await storage.updateAfname(id, {
      mainResponses: JSON.stringify(parsed.data.responses),
      status: "deel1",
    });
    res.json({ ok: true, status: updated?.status });
  });

  // =========================================================================
  // POST /api/t4sports/afnames/:id/voltooien — voltooien + contract genereren
  // =========================================================================
  app.post("/api/t4sports/afnames/:id/voltooien", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });

    const parsed = voltooiSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }

    const { responses, connection } = parsed.data;
    const baselineEnergy = parsed.data.baselineEnergy ?? a.baselineEnergy;

    // Lees T4Sports context uit eerder opgeslagen contract
    let t4sContext: any = {};
    try {
      if (a.generatorContract) t4sContext = JSON.parse(a.generatorContract);
    } catch { /* ignore */ }

    const contract = buildT4SportsContract({
      respondentCode: a.respondentCode,
      name: a.name,
      sporttak: t4sContext.sporttak ?? null,
      ploeg: t4sContext.ploeg ?? null,
      rol: t4sContext.rol ?? a.role ?? null,
      baselineEnergy,
      responses: responses as Record<string, BlockResponse>,
      connection,
      taal: a.taal,
    });

    const updated = await storage.updateAfname(id, {
      mainResponses: JSON.stringify(responses),
      connectionAnswers: JSON.stringify(connection),
      generatorContract: JSON.stringify(contract),
      status: "voltooid",
      completedAt: new Date().toISOString(),
    });

    // Credit definitief verbruiken
    if (a.organisatieId != null) {
      try {
        await storage.verbruik(a.organisatieId, id);
      } catch { /* geen error naar client */ }
    }

    res.json({ ok: true, contract, afname: updated });
  });

  // =========================================================================
  // POST /api/t4sports/afnames/:id/rapport — rapport genereren
  // =========================================================================
  app.post("/api/t4sports/afnames/:id/rapport", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!a.generatorContract) return res.status(400).json({ error: "Profiel nog niet voltooid" });

    let contract: any;
    try { contract = JSON.parse(a.generatorContract); } catch {
      return res.status(400).json({ error: "Ongeldig contract" });
    }

    const html = genereerT4SportsRapport(contract, a.taal);
    res.json({ html, afnameId: id, naam: a.name });
  });

  // =========================================================================
  // GET /api/t4sports/afnames/:id/rapport — rapport ophalen
  // =========================================================================
  app.get("/api/t4sports/afnames/:id/rapport", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!a.generatorContract) return res.status(400).json({ error: "Profiel nog niet voltooid" });

    let contract: any;
    try { contract = JSON.parse(a.generatorContract); } catch {
      return res.status(400).json({ error: "Ongeldig contract" });
    }

    res.json({ contract, name: a.name });
  });

  // =========================================================================
  // GET /api/t4sports/afnames/:id/rapport/html — rapport HTML bekijken
  // =========================================================================
  app.get("/api/t4sports/afnames/:id/rapport/html", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).send("Afname niet gevonden");
    if (!a.generatorContract) return res.status(400).send("Profiel nog niet voltooid");

    let contract: any;
    try { contract = JSON.parse(a.generatorContract); } catch {
      return res.status(400).send("Ongeldig contract");
    }

    const html = genereerT4SportsRapport(contract, a.taal);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // =========================================================================
  // GET /api/t4sports/afnames/:id/rapport/download — rapport downloaden
  // =========================================================================
  app.get("/api/t4sports/afnames/:id/rapport/download", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).send("Afname niet gevonden");
    if (!a.generatorContract) return res.status(400).send("Profiel nog niet voltooid");

    let contract: any;
    try { contract = JSON.parse(a.generatorContract); } catch {
      return res.status(400).send("Ongeldig contract");
    }

    const html = genereerT4SportsRapport(contract, a.taal);
    const veiligNaam = (a.name || "atleet")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "atleet";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="t4sports-profiel-${veiligNaam}.html"`);
    res.send(html);
  });

  // =========================================================================
  // GET /api/t4sports/dashboard/:token — atleet dashboard data
  // =========================================================================
  app.get("/api/t4sports/dashboard/:token", async (req, res) => {
    const token = req.params.token;
    // Token = respondentCode of inviteToken
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });
    if (afname.status !== "voltooid" || !afname.generatorContract) {
      return res.status(400).json({ error: "Profiel nog niet voltooid" });
    }

    let contract: any;
    try { contract = JSON.parse(afname.generatorContract); } catch {
      return res.status(400).json({ error: "Ongeldig profiel" });
    }

    const sportprofiel = contract?.sections?.meta?.sportprofiel ?? {};
    res.json({
      naam: afname.name,
      sporttak: contract?.sporttak ?? null,
      ploeg: contract?.ploeg ?? null,
      rol: contract?.rol ?? null,
      datum: afname.completedAt ?? afname.createdAt,
      dominanteFocus: sportprofiel.dominanteFocus ?? "—",
      dominanteVersneller: sportprofiel.dominanteVersneller ?? "—",
      dominanteDriver: sportprofiel.dominanteDriver ?? "—",
      energieProfiel: sportprofiel.energieProfiel ?? "midden",
      drukProfiel: sportprofiel.drukProfiel ?? "wisselvallig",
      normalizedEnergy: contract?.sections?.meta?.normalizedQuestionnaireEnergy ?? null,
      baselineEnergy: contract?.sections?.meta?.baselineAthleetEnergy ?? null,
      consistentie: contract?.sections?.meta?.consistency?.score ?? null,
      rapportUrl: `/api/t4sports/afnames/${afname.id}/rapport/html`,
      downloadUrl: `/api/t4sports/afnames/${afname.id}/rapport/download`,
    });
  });

  // =========================================================================
  // GET /api/t4sports/dashboard/:token/bibliotheek — persoonlijke bibliotheek
  // =========================================================================
  app.get("/api/t4sports/dashboard/:token/bibliotheek", async (req, res) => {
    const token = req.params.token;
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });

    let contract: any = null;
    if (afname.generatorContract) {
      try { contract = JSON.parse(afname.generatorContract); } catch { /* ignore */ }
    }

    res.json(getAthleteBibliotheek(contract));
  });

  // =========================================================================
  // GET /api/t4sports/dashboard/:token/podcasts — persoonlijke podcasts
  // =========================================================================
  app.get("/api/t4sports/dashboard/:token/podcasts", async (req, res) => {
    const token = req.params.token;
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });

    let contract: any = null;
    if (afname.generatorContract) {
      try { contract = JSON.parse(afname.generatorContract); } catch { /* ignore */ }
    }

    res.json(getAthletePodcasts(contract));
  });

  // =========================================================================
  // GET /api/t4sports/dashboard/:token/uitleg — uitleg-script ophalen
  // =========================================================================
  app.get("/api/t4sports/dashboard/:token/uitleg", async (req, res) => {
    const token = req.params.token;
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });
    if (!afname.generatorContract) return res.status(400).json({ error: "Profiel nog niet voltooid" });

    let contract: any;
    try { contract = JSON.parse(afname.generatorContract); } catch {
      return res.status(400).json({ error: "Ongeldig profiel" });
    }

    const toon = (req.query.toon === "coach" ? "coach" : "deelnemer") as Toon;
    const script = bouwT4SportsUitlegScript(contract, afname.taal, toon, afname.name);
    res.json(script);
  });

  // =========================================================================
  // POST /api/t4sports/dashboard/:token/uitleg — uitleg-sessie registreren
  // =========================================================================
  app.post("/api/t4sports/dashboard/:token/uitleg", async (req, res) => {
    // Registreer dat de atleet de uitleg beluisterd heeft (log-only voor nu)
    const token = req.params.token;
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });
    res.json({ ok: true, message: "Uitleg-sessie geregistreerd" });
  });

  // =========================================================================
  // POST /api/t4sports/dashboard/:token/chat — chat met de atleet-assistent
  // =========================================================================
  app.post("/api/t4sports/dashboard/:token/chat", async (req, res) => {
    const token = req.params.token;
    let afname = await storage.getAfnameByToken(token);
    if (!afname) afname = await storage.getAfnameByCode(token);
    if (!afname) return res.status(404).json({ error: "Profiel niet gevonden" });
    if (!afname.generatorContract) return res.status(400).json({ error: "Profiel nog niet voltooid" });

    const { vraag } = req.body ?? {};
    if (!vraag || typeof vraag !== "string") {
      return res.status(400).json({ error: "Geen vraag meegegeven" });
    }

    let contract: any;
    try { contract = JSON.parse(afname.generatorContract); } catch {
      return res.status(400).json({ error: "Ongeldig profiel" });
    }

    const chatProfiel = bouwT4SportsChatProfiel(contract, afname.taal, afname.name);

    if (DEMO_MODE) {
      return res.json({
        antwoord:
          `Op basis van jouw T4Sports profiel kan ik je vertellen: jouw dominante focus is ` +
          `"${contract?.sections?.meta?.sportprofiel?.dominanteFocus ?? "—"}". ` +
          `Dat is een sterke basis voor je ontwikkeling als atleet. ` +
          `[Demo-modus: echte AI-coaching beschikbaar na activatie]`,
        demo: true,
      });
    }

    try {
      const resp = await fetch(`${CHAT_SIDECAR_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiel: chatProfiel,
          vraag,
          taal: afname.taal,
          context: "t4sports",
        }),
      });
      if (!resp.ok) throw new Error(`Sidecar error: ${resp.status}`);
      const data = await resp.json() as any;
      res.json({ antwoord: data.antwoord ?? data.response ?? "Geen antwoord ontvangen." });
    } catch {
      res.json({
        antwoord:
          "De AI-coach is momenteel niet bereikbaar. Probeer het later opnieuw. " +
          "Je kunt ondertussen je rapport downloaden voor een uitgebreid overzicht van je profiel.",
        error: true,
      });
    }
  });
}
