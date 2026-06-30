/**
 * server/routes/dashboard.ts
 *
 * Domeinrouter: TaPas Persoonlijk — deelnemer-login, dashboard, AI-chat,
 * verdiepende modules, gesproken profieluitleg (uitleg-script), TTS.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 *
 * Routes:
 *   POST /api/deelnemers/login                      — magic-link login
 *   GET  /api/dashboard/:token                      — dashboard-data
 *   PATCH /api/dashboard/:token                     — profiel bijwerken
 *   GET  /api/dashboard/:token/chat                 — chatberichten + limiet
 *   POST /api/dashboard/:token/chat                 — chatvraag stellen
 *   POST /api/dashboard/:token/koop-extra           — extra vragen bijkopen
 *   GET  /api/dashboard/:token/module/:id           — verdiepende module
 *   GET  /api/dashboard/:token/uitleg               — uitleg-script ophalen
 *   POST /api/dashboard/:token/uitleg               — uitleg-sessie registreren
 *   POST /api/dashboard/:token/uitleg/koop-extra    — extra uitleg bijkopen
 * /api/tts is NIET hier geregistreerd — leeft in server/routes-deelnemer.ts.
 */

import type { Express } from "express";
import { storage } from "../storage";
import { normaliseerTaal } from "@shared/i18n";
import {
  deelnemerLoginSchema,
  updateDeelnemerSchema,
  chatVraagSchema,
} from "@shared/schema";
import { bouwDashboardData } from "../dashboard";
import { bouwChatProfiel, chatSuggesties, CHAT_CONFIG, COACH_PLACEHOLDER } from "../chat";
import { parseProfiel, beantwoord as beantwoordProfielvraag, detecteerVraagTaal } from "../chat-engine";
import { bepaalRegio, kiesCoach, COACH_ROL, type RegioSleutel } from "../coach-register";
import { bouwGalerij, galerijLabels } from "../galerij";
import { bouwModule, MODULE_IDS } from "../modules";
import { bouwUitlegScript, VLAAMSE_STEM_PROMPT, type Toon } from "../uitleg";

// De Python-LLM-sidecar draait op poort 8000 binnen de sandbox.
const CHAT_SIDECAR_URL = process.env.TAPAS_CHAT_SIDECAR ?? "http://127.0.0.1:8000";
const DEMO_MODE = process.env.TAPAS_DEMO === "1";

// -------------------------------------------------------------------------
// Interne helpers
// -------------------------------------------------------------------------

async function chatProfielVoor(deelnemerEmail: string, taal: string, naam: string | null) {
  const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
  const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
  const recentste = voltooid[0] ?? null;
  return bouwChatProfiel(recentste?.generatorContract ?? null, normaliseerTaal(taal) as any, naam);
}

async function ruwChatContractVoor(deelnemerEmail: string): Promise<unknown | null> {
  const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
  const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
  return voltooid[0]?.generatorContract ?? null;
}

function limietStatus(deelnemer: { vragenGebruikt: number; vragenTegoed: number }) {
  const totaal = CHAT_CONFIG.gratisLimiet + (deelnemer.vragenTegoed ?? 0);
  const gebruikt = deelnemer.vragenGebruikt ?? 0;
  return {
    gebruikt,
    gratisLimiet: CHAT_CONFIG.gratisLimiet,
    tegoed: deelnemer.vragenTegoed ?? 0,
    totaal,
    resterend: Math.max(0, totaal - gebruikt),
    pakketGrootte: CHAT_CONFIG.pakketGrootte,
    geblokkeerd: gebruikt >= totaal,
  };
}

// Begeleidende boodschap bij de coach-doorverwijzing (warm, niet-diagnostisch).
const COACH_BERICHT: Record<string, string> = {
  nl: "Sommige vragen verdienen een echt gesprek. Hieronder vind je een coach bij jou in de buurt die samen met jou, rustig en in vertrouwen, kan kijken naar wat er speelt.",
  fr: "Certaines questions méritent une vraie conversation. Voici un coach près de chez vous qui peut regarder avec vous, en confiance, ce qui se passe.",
  en: "Some questions deserve a real conversation. Below is a coach near you who can look at what's going on together with you, calmly and in confidence.",
  es: "Algunas preguntas merecen una conversación real. Aquí tienes un coach cerca de ti que puede observar contigo, con calma y confianza, lo que ocurre.",
  ru: "Некоторые вопросы заслуживают настоящего разговора. Ниже — коуч рядом с вами, который спокойно и доверительно посмотрит вместе с вами на то, что происходит.",
};
const DEMO_LABEL: Record<string, string> = {
  nl: "Voorbeeldgegevens (demo)",
  fr: "Données d'exemple (démo)",
  en: "Sample data (demo)",
  es: "Datos de ejemplo (demo)",
  ru: "Демо-данные (пример)",
};

// Leid de regio van de deelnemer af uit de organisatie van zijn afname(s).
async function regioVoorDeelnemer(email: string): Promise<RegioSleutel> {
  try {
    const afnames = await storage.listAfnamesVoorDeelnemer(email);
    for (const af of afnames) {
      const orgId = (af as any).organisatieId as number | null | undefined;
      if (orgId == null) continue;
      const org = await storage.getOrganisatie(orgId);
      const gemeente = (org as any)?.gemeente as string | null | undefined;
      if (gemeente) return bepaalRegio(gemeente);
    }
  } catch {
    // stil terugvallen
  }
  return "Vlaanderen";
}

// Bouw de coachkaart voor de UI.
function coachKaart(taal: string, regio: RegioSleutel) {
  const tt = normaliseerTaal(taal) as keyof typeof COACH_ROL;
  const coach = kiesCoach(regio);
  if (!coach) {
    return {
      naam: COACH_PLACEHOLDER.naam,
      rol: COACH_PLACEHOLDER.rol[tt] ?? COACH_PLACEHOLDER.rol.nl,
      regio: COACH_PLACEHOLDER.regio,
      bericht: COACH_BERICHT[tt] ?? COACH_BERICHT.nl,
      plaats: null,
      expertise: [] as string[],
      email: null,
      demo: false,
      demoLabel: null,
    };
  }
  return {
    naam: coach.naam,
    rol: COACH_ROL[tt] ?? COACH_ROL.nl,
    regio: coach.plaats,
    bericht: COACH_BERICHT[tt] ?? COACH_BERICHT.nl,
    plaats: coach.plaats,
    expertise: coach.expertise,
    email: coach.email,
    demo: coach.demo === true,
    demoLabel: coach.demo === true ? (DEMO_LABEL[tt] ?? DEMO_LABEL.nl) : null,
  };
}

const UITLEG_CONFIG = { gratisLimiet: 10, pakketGrootte: 25 };

function uitlegLimietStatus(
  deelnemer: {
    uitlegGebruiktDeelnemer?: number;
    uitlegTegoedDeelnemer?: number;
    uitlegGebruiktCoach?: number;
    uitlegTegoedCoach?: number;
  },
  toon: Toon,
) {
  const gebruikt =
    (toon === "coach" ? deelnemer.uitlegGebruiktCoach : deelnemer.uitlegGebruiktDeelnemer) ?? 0;
  const tegoed =
    (toon === "coach" ? deelnemer.uitlegTegoedCoach : deelnemer.uitlegTegoedDeelnemer) ?? 0;
  const totaal = UITLEG_CONFIG.gratisLimiet + tegoed;
  return {
    toon,
    gebruikt,
    gratisLimiet: UITLEG_CONFIG.gratisLimiet,
    tegoed,
    totaal,
    resterend: Math.max(0, totaal - gebruikt),
    pakketGrootte: UITLEG_CONFIG.pakketGrootte,
    geblokkeerd: gebruikt >= totaal,
  };
}

async function ruwContractVoor(deelnemerEmail: string): Promise<unknown | null> {
  const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
  const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
  const recentste = voltooid[0] ?? null;
  return recentste?.generatorContract ?? null;
}

function leesToon(raw: unknown): Toon {
  return raw === "coach" ? "coach" : "deelnemer";
}

// -------------------------------------------------------------------------
// Route registratie
// -------------------------------------------------------------------------

export function registerDashboardRoutes(app: Express): void {
  // -------------------------------------------------------------------------
  // TaPas Persoonlijk — Fase 1: deelnemer-login (magic-link) & dashboard.
  // -------------------------------------------------------------------------

  app.post("/api/deelnemers/login", async (req, res) => {
    const parsed = deelnemerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldig e-mailadres" });
    }
    const deelnemer = await storage.vindOfMaakDeelnemer(parsed.data.email, parsed.data.taal);
    // Fase 3 stuurt hier een echte e-mail; nu geven we het token direct terug.
    res.json({
      ok: true,
      dashboardToken: deelnemer.dashboardToken,
      taal: deelnemer.taal,
      heeftAfnames: (await storage.listAfnamesVoorDeelnemer(deelnemer.email)).length > 0,
    });
  });

  // Het persoonlijk dashboard: deelnemer + afnames + afgeleide dashboard-data.
  app.get("/api/dashboard/:token", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const taal = normaliseerTaal(deelnemer.taal);
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);

    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    const dashboard = recentste ? bouwDashboardData(recentste.generatorContract, taal) : null;

    const afnameLijst = [] as Array<{
      id: number;
      naam: string;
      bedrijf: string | null;
      status: string;
      taal: string;
      voltooidOp: string | null;
      rapporten: Array<{ id: number; variant: string; titel: string }>;
    }>;
    for (const a of afnames) {
      const raps = await storage.listRapporten(a.id);
      afnameLijst.push({
        id: a.id,
        naam: a.name,
        bedrijf: a.company ?? null,
        status: a.status,
        taal: a.taal,
        voltooidOp: a.completedAt ?? null,
        rapporten: raps.map((r) => ({ id: r.id, variant: r.variant, titel: r.titel })),
      });
    }

    // Fase 2: vragenlijst-galerij.
    const galerij = {
      labels: galerijLabels(taal as any),
      items: bouwGalerij(recentste?.generatorContract ?? null, taal as any),
    };

    res.json({
      deelnemer: {
        id: deelnemer.id,
        email: deelnemer.email,
        naam: deelnemer.naam,
        fotoUrl: deelnemer.fotoUrl,
        taal: deelnemer.taal,
        mailCadans: deelnemer.mailCadans,
      },
      dashboard,
      afnames: afnameLijst,
      galerij,
    });
  });

  // Profiel bijwerken (naam, foto, taal, mailcadans).
  app.patch("/api/dashboard/:token", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const parsed = updateDeelnemerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    // Bescherm tegen overdreven grote foto-uploads (data-URL > ~3 MB).
    if (parsed.data.fotoUrl && parsed.data.fotoUrl.length > 4_000_000) {
      return res.status(413).json({ error: "Foto is te groot (max ~3 MB)" });
    }
    const updated = await storage.updateDeelnemer(deelnemer.id, parsed.data);
    res.json({
      ok: true,
      deelnemer: updated && {
        id: updated.id,
        email: updated.email,
        naam: updated.naam,
        fotoUrl: updated.fotoUrl,
        taal: updated.taal,
        mailCadans: updated.mailCadans,
      },
    });
  });

  // -------------------------------------------------------------------------
  // TaPas Persoonlijk — Fase 2: AI-profielassistent (chatbot).
  // -------------------------------------------------------------------------

  app.get("/api/dashboard/:token/chat", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const taal = normaliseerTaal(deelnemer.taal);
    const berichten = await storage.listChatBerichten(deelnemer.id);
    const regio = await regioVoorDeelnemer(deelnemer.email);
    res.json({
      berichten: berichten.map((b) => ({ id: b.id, rol: b.rol, inhoud: b.inhoud, veiligheid: b.veiligheid })),
      limiet: limietStatus(deelnemer),
      suggesties: chatSuggesties(taal as any),
      coach: coachKaart(taal, regio),
    });
  });

  // Verdiepende leesmodule (Galerij "Starten"-knop).
  app.get("/api/dashboard/:token/module/:id", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });

    const moduleId = req.params.id;
    if (!MODULE_IDS.includes(moduleId)) {
      return res.status(404).json({ error: "Module niet gevonden" });
    }

    const taal = normaliseerTaal(req.query.taal ?? deelnemer.taal);
    const ruwContract = await ruwChatContractVoor(deelnemer.email);
    const inhoud = bouwModule(moduleId, ruwContract, taal as any, deelnemer.naam ?? null);
    if (!inhoud) return res.status(404).json({ error: "Module niet gevonden" });

    res.json({ module: inhoud });
  });

  app.post("/api/dashboard/:token/chat", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });

    const parsed = chatVraagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Stel een vraag" });
    }

    const status = limietStatus(deelnemer);
    if (status.geblokkeerd) {
      return res.status(402).json({ error: "limiet_bereikt", limiet: status });
    }

    const standaardTaal = normaliseerTaal(deelnemer.taal);
    const taal = detecteerVraagTaal(parsed.data.vraag, standaardTaal as any);

    const ruwContract = await ruwChatContractVoor(deelnemer.email);
    const feiten = parseProfiel(ruwContract, deelnemer.naam);

    let reply = "";
    let veiligheid: string | null = null;

    let sidecarGelukt = false;
    if (!DEMO_MODE) {
      try {
        const profiel = await chatProfielVoor(deelnemer.email, deelnemer.taal, deelnemer.naam);
        const historie = await storage.listChatBerichten(deelnemer.id);
        const messages = [
          ...historie.map((b) => ({ role: b.rol, content: b.inhoud })),
          { role: "user", content: parsed.data.vraag },
        ];
        const r = await fetch(`${CHAT_SIDECAR_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taal, profiel_context: profiel.context, risico: profiel.risico, messages }),
        });
        const data: any = await r.json().catch(() => ({}));
        if (r.ok && !data.error && String(data.reply ?? "").trim()) {
          reply = String(data.reply).trim();
          veiligheid = data.veiligheid ?? null;
          sidecarGelukt = true;
        }
      } catch {
        // stil terugvallen op de engine
      }
    }

    if (!sidecarGelukt) {
      const uit = beantwoordProfielvraag(parsed.data.vraag, feiten, taal as any);
      reply = uit.reply;
      veiligheid = uit.veiligheid;
    }

    if (!reply) {
      return res.status(502).json({ error: "Leeg antwoord van de assistent." });
    }

    await storage.voegChatBerichtToe(deelnemer.id, "user", parsed.data.vraag, null);
    const opgeslagen = await storage.voegChatBerichtToe(deelnemer.id, "assistant", reply, veiligheid);
    const bijgewerkt = await storage.verhoogVragenGebruikt(deelnemer.id);

    const coachRegio = veiligheid === "coach" ? await regioVoorDeelnemer(deelnemer.email) : null;
    res.json({
      antwoord: { id: opgeslagen.id, rol: "assistant", inhoud: reply, veiligheid },
      limiet: limietStatus(bijgewerkt ?? deelnemer),
      coach: coachRegio ? coachKaart(taal, coachRegio) : null,
    });
  });

  // Extra vragen bijkopen (DEMO: simuleert een Mollie/Bancontact-betaling).
  app.post("/api/dashboard/:token/koop-extra", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const bijgewerkt = await storage.voegVragenTegoedToe(deelnemer.id, CHAT_CONFIG.pakketGrootte);
    if (!bijgewerkt) return res.status(404).json({ error: "Deelnemer niet gevonden" });
    res.json({ ok: true, demo: true, pakketGrootte: CHAT_CONFIG.pakketGrootte, limiet: limietStatus(bijgewerkt) });
  });

  // -------------------------------------------------------------------------
  // GESPROKEN PROFIELUITLEG (audio, 6 blokken)
  // -------------------------------------------------------------------------

  // GET: levert het uitleg-script (6 blokken) + limietstatus voor de gevraagde toon.
  app.get("/api/dashboard/:token/uitleg", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.query.toon);
    const taal = normaliseerTaal(deelnemer.taal);
    const contractRaw = await ruwContractVoor(deelnemer.email);
    const script = bouwUitlegScript(contractRaw, taal as any, toon, deelnemer.naam ?? undefined);
    res.json({
      script,
      limiet: uitlegLimietStatus(deelnemer, toon),
    });
  });

  // POST: registreert één uitleg-sessie (verhoogt de juiste teller) en levert
  // het script terug. 402 wanneer de limiet voor die toon bereikt is.
  app.post("/api/dashboard/:token/uitleg", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.body?.toon);

    const status = uitlegLimietStatus(deelnemer, toon);
    if (status.geblokkeerd) {
      return res.status(402).json({ error: "limiet_bereikt", limiet: status });
    }

    const taal = normaliseerTaal(deelnemer.taal);
    const contractRaw = await ruwContractVoor(deelnemer.email);
    const script = bouwUitlegScript(contractRaw, taal as any, toon, deelnemer.naam ?? undefined);
    if (!script) {
      return res.status(404).json({ error: "Nog geen voltooid profiel om uit te leggen." });
    }

    const bijgewerkt = await storage.verhoogUitlegGebruikt(deelnemer.id, toon);
    res.json({
      script,
      limiet: uitlegLimietStatus(bijgewerkt ?? deelnemer, toon),
    });
  });

  // Extra uitleg-sessies bijkopen per toon.
  app.post("/api/dashboard/:token/uitleg/koop-extra", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const toon = leesToon(req.body?.toon);
    const bijgewerkt = await storage.voegUitlegTegoedToe(deelnemer.id, toon, UITLEG_CONFIG.pakketGrootte);
    if (!bijgewerkt) return res.status(404).json({ error: "Deelnemer niet gevonden" });
    res.json({
      ok: true,
      demo: true,
      toon,
      pakketGrootte: UITLEG_CONFIG.pakketGrootte,
      limiet: uitlegLimietStatus(bijgewerkt, toon),
    });
  });

  // /api/tts wordt NIET hier geregistreerd.
  // De Sulafat-route (sidecar + spawn fallback) leeft uitsluitend in
  // server/routes-deelnemer.ts — die wordt na deze module geregistreerd.
  // Dubbele registratie hier zou de betere sidecar-implementatie blokkeren.
}
