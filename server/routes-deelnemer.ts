// =============================================================================
// routes-deelnemer.ts — Domeinrouter: Deelnemer-login · Magic-link · Dashboard · TTS
// Ronde 13 P2: exact overgenomen uit routes.ts (regels 62-121 + 1111-1682).
// Geen logica gewijzigd — pure organisatorische opsplitsing.
// =============================================================================
import type { Express } from "express";
import { join } from "node:path";
import { storage } from "./storage";
import { ttsSidecarLive, TTS_SERVICE_URL } from "./sidecar-manager";
import { bouwDashboardData } from "./dashboard";
import { bouwChatProfiel, chatSuggesties, CHAT_CONFIG, COACH_PLACEHOLDER } from "./chat";
import { parseProfiel, beantwoord as beantwoordProfielvraag, detecteerVraagTaal } from "./chat-engine";
import { bepaalRegio, kiesCoach, COACH_ROL, type RegioSleutel } from "./coach-register";
import { bouwGalerij, galerijLabels } from "./galerij";
import { bouwModule, MODULE_IDS } from "./modules";
import { bouwUitlegScript, VLAAMSE_STEM_PROMPT, type Toon } from "./uitleg";
import { normaliseerTaal } from "@shared/i18n";
import {
  deelnemerLoginSchema,
  magicLinkAanvraagSchema,
  updateDeelnemerSchema,
  chatVraagSchema,
} from "@shared/schema";

const DEMO_MODE = process.env.TAPAS_DEMO === "1";
const CHAT_SIDECAR_URL = process.env.TAPAS_CHAT_SIDECAR ?? "http://127.0.0.1:8000";

function demoChatReply(taal: string, profielContext?: string, vraag?: string): string {
  const t = (taal || "nl").toLowerCase();
  const ctx = (profielContext || "").trim();
  const heeftProfiel = ctx.length > 0 && !/algemene|g\u00e9n\u00e9rale|general/i.test(ctx.slice(0, 40));

  // Korte, leesbare samenvatting van het profiel uit de meegegeven context.
  const fociMatch = ctx.match(/(?:talentfoci|focus de talent|talent foci)[^:]*:\s*([^.]+)\./i);
  const versnMatch = ctx.match(/(?:Versterkend gedrag|comportement amplificateur|Amplifying behaviour)\s*:\s*([^.]+)\./i);
  const energieMatch = ctx.match(/([0-9]+[\.,][0-9])\s*\/\s*10/);
  const driverMatch = ctx.match(/(?:Drivers om in het oog te houden|Drivers \u00e0 surveiller|Drivers to keep an eye on)[^:]*:\s*([^.;]+)[.;]/i);
  const foci = fociMatch ? fociMatch[1].trim() : null;
  const versn = versnMatch ? versnMatch[1].trim() : null;
  const energie = energieMatch ? energieMatch[1] : null;
  const driver = driverMatch ? driverMatch[1].trim() : null;

  if (t.startsWith("fr")) {
    if (!heeftProfiel)
      return "Bonne question. Termine d'abord le questionnaire : ton profil personnel rendra mes r\u00e9ponses bien plus concr\u00e8tes. En attendant, observe quand ton \u00e9nergie monte au travail \u2014 c'est d\u00e9j\u00e0 une piste. Ceci est une aide \u00e0 la r\u00e9flexion, pas un diagnostic.";
    const p: string[] = [];
    if (foci) p.push(`Tes focus de talent les plus forts (${foci}) sont l\u00e0 o\u00f9 le travail est le plus fluide.`);
    if (versn) p.push(`Tu les amplifies via ${versn} : appuie-toi dessus cette semaine.`);
    if (energie) p.push(`Ton \u00e9nergie mesur\u00e9e \u00e9tait de ${energie}/10 \u2014 compare-la \u00e0 ton ressenti.`);
    if (driver) p.push(`Garde un \u0153il sur le driver ${driver}, qui peut te co\u00fbter de l'\u00e9nergie.`);
    p.push("Choisis une t\u00e2che concr\u00e8te qui s'appuie sur tes forces et observe ce qui change. Ceci est une aide \u00e0 la r\u00e9flexion, pas un diagnostic.");
    return p.join(" ");
  }
  if (t.startsWith("en")) {
    if (!heeftProfiel)
      return "Good question. Complete the questionnaire first \u2014 your personal profile will make my answers far more concrete. Meanwhile, notice when your energy rises at work; that's already a clue. This is a reflection aid, not a diagnosis.";
    const p: string[] = [];
    if (foci) p.push(`Your strongest talent foci (${foci}) are where work feels most effortless.`);
    if (versn) p.push(`You amplify them through ${versn} \u2014 lean on that this week.`);
    if (energie) p.push(`Your measured energy was ${energie}/10 \u2014 compare it with how you felt.`);
    if (driver) p.push(`Keep an eye on the ${driver} driver, which can cost you energy.`);
    p.push("Pick one concrete task that draws on your strengths and notice what shifts. This is a reflection aid, not a diagnosis.");
    return p.join(" ");
  }
  if (!heeftProfiel)
    return "Goede vraag. Rond eerst de vragenlijst af \u2014 met je persoonlijke profiel worden mijn antwoorden veel concreter. Let ondertussen op wanneer je energie stijgt op het werk; dat is al een aanwijzing. Dit is een reflectiehulp, geen diagnose.";
  const p: string[] = [];
  if (foci) p.push(`Je sterkste talentfoci (${foci}) zijn waar werk het meest moeiteloos verloopt.`);
  if (versn) p.push(`Je versterkt dat via ${versn} \u2014 daar mag je deze week op leunen.`);
  if (energie) p.push(`Je gemeten energie was ${energie}/10 \u2014 leg die naast hoe je het zelf beleefde.`);
  if (driver) p.push(`Houd de driver ${driver} in het oog; die kan je net energie kosten.`);
  p.push("Kies \u00e9\u00e9n concrete taak die op je sterktes leunt en merk op wat er verschuift. Dit is een reflectiehulp, geen diagnose.");
  return p.join(" ");
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


export function registerDeelnemerRoutes(app: Express): void {

  // ---------------------------------------------------------------------------
  // Ronde 31 — Token-login: toegang.html stuurt dashboardToken op, server
  // geeft voornaam + skin + dashboardCode terug (voor het cijferslot).
  // Aparte route zodat routes-deelnemer.ts ongewijzigd blijft voor /login.
  // ---------------------------------------------------------------------------
  app.post("/api/deelnemers/token-login", async (req, res) => {
    const rawToken = (req.body?.token ?? "").toString().trim();
    // Saniteer: enkel alphanumeriek + underscore + koppelteken
    const token = rawToken.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!token || token.length < 8) {
      return res.status(400).json({ ok: false, reden: "Ongeldig token" });
    }
    const deelnemer = await storage.getDeelnemerByToken(token);
    if (!deelnemer) {
      // Token niet gevonden — stuur toch een bruikbaar antwoord terug
      // zodat toegang.html graceful kan afhandelen.
      return res.json({ ok: false, dashboardToken: token });
    }
    // Skin bepalen: zelfde logica als /api/deelnemers/login
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);
    const meestRecent = afnames.sort(
      (a, b) => new Date(b.aangemaakt).getTime() - new Date(a.aangemaakt).getTime()
    )[0];
    const instrument = meestRecent?.instrument ?? "";
    const skin =
      instrument === "t4p-teens" ? "teens" :
      instrument === "t4p-students" ? "students" :
      "business";
    return res.json({
      ok: true,
      dashboardToken: deelnemer.dashboardToken,
      voornaam: deelnemer.voornaam ?? "",
      skin,
      dashboardCode: deelnemer.dashboardCode ?? "",
    });
  });

  app.post("/api/deelnemers/login", async (req, res) => {
    const parsed = deelnemerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldig e-mailadres" });
    }
    const deelnemer = await storage.vindOfMaakDeelnemer(parsed.data.email, parsed.data.taal);
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);

    // Skin bepalen op basis van het meest recente instrument van de deelnemer.
    // Volgorde: t4p-teens → 'teens', t4p-students → 'students', alles anders → 'business'.
    const recentsteInstrument = afnames[0]?.instrumentId ?? null;
    const skin =
      recentsteInstrument === "t4p-teens" ? "teens" :
      recentsteInstrument === "t4p-students" ? "students" :
      "business";

    // dashboardCode: deterministisch 4-cijferig slot afgeleid van het dashboard-token.
    // Elke deelnemer heeft zo een unieke combinatie. Formaat: 4 cijfers 0-9.
    const tokenHash = deelnemer.dashboardToken;
    const dashboardCode = [
      parseInt(tokenHash.replace(/[^0-9]/g, "").charAt(0) || "2"),
      parseInt(tokenHash.replace(/[^0-9]/g, "").charAt(1) || "0"),
      parseInt(tokenHash.replace(/[^0-9]/g, "").charAt(2) || "2"),
      parseInt(tokenHash.replace(/[^0-9]/g, "").charAt(3) || "6"),
    ].join("");

    // Voornaam: eerste woord van de naam ("Marc Debisschop" → "Marc").
    const voornaam = deelnemer.naam
      ? deelnemer.naam.trim().split(/\s+/)[0]
      : null;

    // Fase 3 stuurt hier een echte e-mail; nu geven we het token direct terug.
    res.json({
      ok: true,
      dashboardToken: deelnemer.dashboardToken,
      taal: deelnemer.taal,
      skin,
      voornaam,
      dashboardCode,
      heeftAfnames: afnames.length > 0,
    });
  });

  // -------------------------------------------------------------------------
  // Ronde 7 — Magic-link: aanmaken (POST) + inwisselen (GET)
  //
  // POST /api/deelnemers/magic-link
  //   Body: { email }  →  genereert 15-minuten-token voor terugkerende deelnemer.
  //   In Fase 1 (demo): token + link worden IN-APP getoond (geen e-mailsending).
  //   In Fase 3: zelfde endpoint, maar dan stuurt de server een e-mail.
  //   Geeft 200 terug ook als e-mail onbekend is (security: nooit bevestigen
  //   of een e-mailadres bestaat). De frontend toont altijd dezelfde boodschap.
  //
  // GET /api/deelnemers/magic/:token
  //   Wisselt token in → redirect naar /#/dashboard/:dashboardToken
  //   of 400 bij onbekend/verlopen token.
  // -------------------------------------------------------------------------
  app.post("/api/deelnemers/magic-link", async (req, res) => {
    const parsed = magicLinkAanvraagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldig e-mailadres" });
    }
    const result = await storage.maakMagicLink(parsed.data.email);
    // Security: altijd 200, ook als e-mail onbekend is.
    if (!result) {
      return res.json({ ok: true, gevonden: false });
    }
    // Bouw de in-app link (hash-routing).
    // Ronde 30i — zelfde fix als /api/go/: interne E2B host vermijden
    const _host = req.get("host") ?? "";
    const base = process.env.APP_URL ??
      (_host.includes("pplx.app") || _host.includes("e2b") || _host.includes("perplexity")
        ? "https://tapas-platform-2.pplx.app"
        : `${req.protocol}://${_host}`);
    const link = `${base}/#/magic/${result.token}`;
    return res.json({ ok: true, gevonden: true, link, verlooptOp: result.verlooptOp });
  });

  app.get("/api/deelnemers/magic/:token", async (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 10) {
      return res.status(400).json({ error: "Ongeldig token" });
    }
    const deelnemer = await storage.wisselMagicLink(token);
    if (!deelnemer) {
      return res.status(400).json({ error: "Link verlopen of al gebruikt. Vraag een nieuwe link aan." });
    }
    // Geef dashboardToken + skin terug zodat de frontend kan redirecten.
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);
    const recentsteInstrument = afnames[0]?.instrumentId ?? null;
    const skin =
      recentsteInstrument === "t4p-teens" ? "teens" :
      recentsteInstrument === "t4p-students" ? "students" :
      "business";
    return res.json({
      ok: true,
      dashboardToken: deelnemer.dashboardToken,
      skin,
      voornaam: deelnemer.naam ? deelnemer.naam.trim().split(/\s+/)[0] : null,
    });
  });

  // Het persoonlijk dashboard: deelnemer + afnames + afgeleide dashboard-data.
  app.get("/api/dashboard/:token", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const taal = normaliseerTaal(deelnemer.taal);
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemer.email);

    // De meest recente voltooide afname bepaalt de hero/quotes/energie.
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    const dashboard = recentste ? bouwDashboardData(recentste.generatorContract, taal) : null;

    // Afnamelijst met (eventuele) gegenereerde rapporten.
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

    // Fase 2: vragenlijst-galerij ('Vragenlijsten voor jou') met matching.
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

  // Profiel bijwerken (naam, foto, taal, mailcadans) vanuit het dashboard.
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
  //
  // - Gratis limiet + bijgekocht tegoed (CHAT_CONFIG, centraal instelbaar).
  // - Zorg-kompas: profielsignalen (laag A) reizen mee naar de sidecar; die
  //   doet live inhoudsdetectie (laag B/C) en kan warm naar een coach verwijzen.
  // - "Driver" blijft beschermd & onvertaald (afgehandeld in de sidecar/prompt).
  // -------------------------------------------------------------------------

  async function chatProfielVoor(deelnemerEmail: string, taal: string, naam: string | null) {
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    return bouwChatProfiel(recentste?.generatorContract ?? null, normaliseerTaal(taal) as any, naam);
  }

  // Levert het ruwe contract (voor de profielassistent-engine) van de recentste
  // voltooide afname; null als er nog geen voltooid profiel is.
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

  // Begeleidende boodschap bij de coach-doorverwijzing (warm, niet-diagnostisch),
  // per taal. Los van de coachgegevens zelf, die uit het coach-register komen.
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
  // Terugval op "Vlaanderen" (landelijke coach) als er geen gemeente bekend is.
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

  // Bouw de coachkaart voor de UI: echte (of demo-)coach uit het register,
  // gekozen op de regio van de deelnemer, met een warme begeleidende boodschap.
  function coachKaart(taal: string, regio: RegioSleutel) {
    const tt = normaliseerTaal(taal) as keyof typeof COACH_ROL;
    const coach = kiesCoach(regio);
    if (!coach) {
      // Uiterste terugval: generieke placeholder (zou normaal niet voorkomen).
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

  // -------------------------------------------------------------------------
  // Verdiepende leesmodule (Galerij "Starten"-knop).
  //
  // Bouwt 100% uit het eigen profiel een meerstaps lees-/reflectie-ervaring
  // (talent-verdieping, energie-monitor, drivers-onder-druk). Geen live LLM,
  // dus geen hallucinaties: elk feit, cijfer en citaat komt uit het contract.
  // Zelfde token->contract-pad als de chat.
  // -------------------------------------------------------------------------
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
    // Antwoord in de taal van de VRAAG (NL/FR/EN/ES/RU), met de deelnemer-taal
    // als terugval. Zo krijgt elke bezoeker antwoord in zijn eigen taal.
    const taal = detecteerVraagTaal(parsed.data.vraag, standaardTaal as any);

    // De profielassistent-engine draait altijd lokaal in de server: ze leest het
    // ECHTE contract, herkent de intentie van de vraag (begrip/energie/talent/
    // driver/taak/coach ...) en bouwt een antwoord uit een gecureerde kennisbank
    // + de echte profieldata. Geen externe LLM nodig -> werkt in de gepubliceerde
    // demo en kan per definitie niet hallucineren.
    const ruwContract = await ruwChatContractVoor(deelnemer.email);
    const feiten = parseProfiel(ruwContract, deelnemer.naam);

    let reply = "";
    let veiligheid: string | null = null;

    // Optioneel: als er tóch een live LLM-sidecar bereikbaar is (ontwikkel-/
    // toekomst-omgeving), gebruiken we die; anders valt alles terug op de engine.
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
  // - Twee tonen: "deelnemer" (warm) en "coach" (zakelijk, coachgericht).
  // - Elke toon heeft een eigen 10-gratis-dan-betalen limiet (testfase: de coach
  //   betaalt zelf na 10 sessies).
  // - Audio is browser-side (Web Speech API); de backend levert alleen het script
  //   (6 blokken) + de limietstatus. "Driver" blijft beschermd & onvertaald.
  // -------------------------------------------------------------------------

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

  // Haalt het ruwe generatorContract van de recentste voltooide afname op.
  async function ruwContractVoor(deelnemerEmail: string): Promise<unknown | null> {
    const afnames = await storage.listAfnamesVoorDeelnemer(deelnemerEmail);
    const voltooid = afnames.filter((a) => a.status === "voltooid" && a.generatorContract);
    const recentste = voltooid[0] ?? null;
    return recentste?.generatorContract ?? null;
  }

  function leesToon(raw: unknown): Toon {
    return raw === "coach" ? "coach" : "deelnemer";
  }

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

  // Extra uitleg-sessies bijkopen per toon (DEMO: simuleert een betaling).
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


  // =========================================================================
  // SULAFAT TTS — Vlaamse stem (Gemini 2.5 Pro TTS, voice=sulafat)
  // POST /api/tts  { tekst: string }
  // Geeft mp3-audio terug. Altijd Vlaamse tongval via VLAAMSE_STEM_PROMPT.
  // Geen token vereist (tekst komt van de client, niet uit de DB).
  // =========================================================================
  app.post("/api/tts", async (req, res) => {
    const tekst: string = (req.body?.tekst ?? "").trim();
    if (!tekst) return res.status(400).json({ error: "tekst vereist" });
    if (tekst.length > 4000) return res.status(400).json({ error: "tekst te lang (max 4000 tekens)" });

    const volledigeTekst = VLAAMSE_STEM_PROMPT + "\n\n" + tekst;

    // Ronde 8 — Primair pad: FastAPI TTS-service (poort 8001, persistent)
    if (ttsSidecarLive()) {
      try {
        const svcResp = await fetch(TTS_SERVICE_URL + "/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tekst: volledigeTekst }),
        });
        if (svcResp.ok) {
          const audioBuffer = Buffer.from(await svcResp.arrayBuffer());
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Content-Length", audioBuffer.length);
          res.setHeader("Cache-Control", "no-store");
          return res.end(audioBuffer);
        }
        console.warn("[tts] sidecar antwoordde", svcResp.status, "— val terug op spawn");
      } catch (err) {
        console.warn("[tts] sidecar fetch mislukt:", err, "— val terug op spawn");
      }
    }

    // Fallback: spawn tts.py (CLI-script in dist/)
    const ttsScript = join(process.cwd(), "dist", "tts.py");
    const py = spawn("python3", [ttsScript, volledigeTekst]);
    const chunks: Buffer[] = [];

    py.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    py.stderr.on("data", (d: Buffer) => console.error("[tts]", d.toString()));

    py.on("close", (code) => {
      if (code !== 0 || chunks.length === 0) {
        if (!res.headersSent) res.status(500).json({ error: "TTS mislukt" });
        return;
      }
      const audio = Buffer.concat(chunks);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audio.length);
      res.setHeader("Cache-Control", "no-store");
      res.end(audio);
    });
  });

  // -------------------------------------------------------------------------
  // P1 Skin-routing helper — Ronde 13
  //
  // -------------------------------------------------------------------------
  // Ronde 30h — Permanente dashboard-redirect (server-side HTML, 100% betrouwbaar)
  //
  // GET /api/go/:dashboardToken
  //   Stuurt een volledige HTML-pagina terug die:
  //   1. sessionStorage.setItem('tapas_skip_intro', '1') zet — VOOR React laadt
  //   2. window.location.replace('#/dashboard/:token') uitvoert
  //
  //   Dit is fundamenteel anders dan een 302-redirect:
  //   - Bij een 302 laadt de browser de React-app opnieuw op '#/dashboard/TOKEN'
  //     maar de React-app weet dat pas NA de eerste render (te laat voor useState)
  //   - Met deze HTML-pagina wordt sessionStorage gezet VOOR React initialiseert
  //   - App.tsx leest sessionStorage in de useState-initialisatie (synchroon)
  //   - Gevolg: introDone = true vanaf de allereerste render, intro wordt nooit getoond
  //
  //   GEEN DB-validatie — redirect altijd (dashboard toont zelf fout bij ongeldig token)
  //   GEEN afhankelijkheid van React-versie, bundle-cache of service worker
  // -------------------------------------------------------------------------
  app.get("/api/go/:dashboardToken", (req, res) => {
    const token = req.params.dashboardToken;
    // Ronde 30i — Hardcoded pplx.app URL om te voorkomen dat de interne E2B sandbox-URL
    // (bijv. 5000-xxxx.e2b.p.perplexity.ai) wordt gebruikt als base.
    // req.get('host') geeft de interne sandbox-host, niet de publieke URL.
    // In lokale dev (localhost) gebruiken we de host zoals die is.
    const host = req.get("host") ?? "";
    const base = process.env.APP_URL ??
      (host.includes("pplx.app") || host.includes("e2b") || host.includes("perplexity")
        ? "https://tapas-platform-2.pplx.app"
        : `${req.protocol}://${host}`);

    // Minimale validatie
    if (!token || token.length < 8) {
      return res.redirect(302, `${base}/#/`);
    }

    // Stuur een HTML-pagina die sessionStorage zet vóór React laadt,
    // dan navigeert naar het dashboard via hash-routing.
    const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TaPas — Naar dashboard...</title>
  <style>
    body { margin: 0; background: #060a16; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; font-family: sans-serif; }
    p { color: #d8c9a3; font-size: 1rem; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <p>Even geduld…</p>
  <script>
    // Zet de skip-intro vlag VOOR de React-app initialiseert.
    // App.tsx leest deze vlag synchroon in de useState-initialisatie.
    try { sessionStorage.setItem('tapas_skip_intro', '1'); } catch(e) {}
    // Navigeer naar het dashboard via hash-routing.
    window.location.replace('${base}/#/dashboard/${safeToken}');
  <\/script>
</body>
</html>`);
  });

  // GET /api/skin/:token
  //   Geeft de skin terug op basis van het uitnodigingstoken (instrumentId).
  //   De PoortRouter.tsx (client) gebruikt dit endpoint om de juiste skin
  //   pre-te-selecteren vóór het tonen van de Poort-pagina.
  //
  //   Token → skin mapping (identiek aan routes-financieel.ts + poort.tsx):
  //     t4p-teens    → "teens"
  //     t4p-students → "students"
  //     alles anders → "business"
  // -------------------------------------------------------------------------
  app.get("/api/skin/:token", async (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 4) {
      return res.json({ skin: "business" });
    }
    const afname = await storage.getAfnameByToken(token);
    if (!afname) {
      // Token niet gevonden — val terug op business-skin (geen fout naar client)
      return res.json({ skin: "business" });
    }
    const instrumentId = afname.instrumentId ?? null;
    const skin =
      instrumentId === "t4p-teens" ? "teens" :
      instrumentId === "t4p-students" ? "students" :
      "business";
    return res.json({ skin, instrumentId });
  });


}
