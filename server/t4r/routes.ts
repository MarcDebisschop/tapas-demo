import type { Express } from "express";
import { t4rStorage as storage } from "./storage";
import {
  insertT4rSessionSchema as insertSessionSchema,
  insertT4rStakeholderSchema as insertStakeholderSchema,
  upsertAnswerSchema,
  saveCandidateReportSchema,
} from "./schema";
import { berekenMatch } from "./match";
import type { ConstructMeting, KandidaatContext, MatchUitkomst } from "./match";
import { extractFromText } from "./extract";
import { bouwChatContext, coachKaartRecruiter, chatSuggestiesRecruiter } from "./chat-context";
import { beantwoordRecruiter, detecteerVraagTaal } from "./chat-engine-recruiter";
import { t4rChatVraagSchema } from "./schema";
import { normaliseerTaal } from "@shared/i18n";
import type { Taal } from "@shared/talen";
import { z } from "zod";
// pdf-parse is CommonJS; importeer de bibliotheekfunctie rechtstreeks om de
// debug-modus (die een testbestand zoekt) van de index te vermijden.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { storage as platformStorage, CreditError } from "../storage";
import { isDemoModus } from "../demomodus";
import { bepaalScope } from "../scope-guard";
import { adminIdVanSessie } from "../admin-guard";
import {
  neemProfielOverUitContract,
  bepaalHandmatigAangepast,
  VERWACHT_AANTAL_LIJNEN,
  T4P_INSTRUMENT,
  type OvergenomenMeting,
} from "./uit-afname";
import type { HerkomstPatch } from "./storage";

/**
 * T4Recruitment — ingeplugde routes.
 * ------------------------------------------------------------------
 * Eén-op-één overgenomen uit de canonieke stand-alone app
 * (t4r_src/server/routes.ts). De ENIGE wijzigingen t.o.v. de bron:
 *
 *   1. GEEN harde testperiode-lock. Het platform draait permanent via
 *      credits/licenties; de stand-alone app behoudt zijn eigen 18-juni-lock.
 *
 *   2. Routes hangen onder het prefix /api/t4r/... (botst niet met de
 *      platform-routes /api/sessies en /api/r/:token).
 *
 *   3. Credit-/collaboratiebrug: bij het SLUITEN van de stakeholderkring
 *      (PATCH .../sessions/:id { closedRing: true }) reserveert de gekoppelde
 *      platform-sessie het sessietarief (20 credits, instelbaar) via de
 *      Fase 2-laag (storage.vergrendelKring). Onvoldoende credits → 402.
 *      De T4R-beslislogica (modules, stellingen, need/nice/not-needed,
 *      minimumdrempels, alignment, match) blijft volledig ONGEWIJZIGD.
 */

// Eindrapport-chatbot (recruiter-only): zelfde economisch model als de
// Kompas-chatbot — 10 gratis vragen, daarna pakketten van 25 via een
// (gesimuleerde) betaling.
const T4R_CHAT_CONFIG = { gratisLimiet: 10, pakketGrootte: 25 };
const CHAT_SIDECAR_URL = process.env.TAPAS_CHAT_SIDECAR ?? "http://127.0.0.1:8000";
// S-4 (audit): de demomodus komt uit één bron (server/demomodus.ts) en is in
// productie altijd uit, ook wanneer TAPAS_DEMO=1 gezet zou zijn.
const DEMO_MODE = isDemoModus();
function demoRecruiterReply(taal: string): string {
  const t = (taal || "nl").toLowerCase();
  if (t.startsWith("fr"))
    return "Dans cette d\u00e9mo, l'assistant recruteur n'est pas reli\u00e9 \u00e0 un mod\u00e8le en direct. La logique reste : v\u00e9rifie que chaque exigence du profil est class\u00e9e need / nice / not-needed et que la d\u00e9cision repose sur l'alignement de tout le cercle, pas sur un consensus de court terme.";
  if (t.startsWith("en"))
    return "In this demo the recruiter assistant isn't connected to a live model. The reasoning still holds: make sure every role requirement is classified need / nice / not-needed and that the decision rests on the whole circle's alignment, not short-term consensus.";
  return "In deze demo is de recruiter-assistent niet gekoppeld aan een live model. De redenering blijft: zorg dat elke profieleis is geclassificeerd als need / nice / not-needed en dat de beslissing steunt op alignment van de hele kring, niet op kortetermijnconsensus.";
}

function t4rLimietStatus(session: { chatGebruikt?: number | null; chatTegoed?: number | null }) {
  const tegoed = session.chatTegoed ?? 0;
  const gebruikt = session.chatGebruikt ?? 0;
  const totaal = T4R_CHAT_CONFIG.gratisLimiet + tegoed;
  return {
    gebruikt,
    gratisLimiet: T4R_CHAT_CONFIG.gratisLimiet,
    tegoed,
    totaal,
    resterend: Math.max(0, totaal - gebruikt),
    pakketGrootte: T4R_CHAT_CONFIG.pakketGrootte,
    geblokkeerd: gebruikt >= totaal,
  };
}

// Bouwt de match-uitkomst + chatcontext voor een sessie (recruiter-taal).
async function t4rChatContextVoor(sessionId: number, taal: Taal) {
  const rep = await storage.getCandidateReport(sessionId);
  const session = await storage.getSession(sessionId);
  if (!rep || !rep.verified) {
    return { ...bouwChatContext(null, session ?? null, null, taal), uitkomst: null, candidate: null, session: session ?? null };
  }
  const answers = await storage.listAnswers(sessionId);
  let metingen: Record<string, ConstructMeting> = {};
  let context: KandidaatContext = {};
  try {
    metingen = JSON.parse(rep.metingen);
    context = JSON.parse(rep.context);
  } catch {
    metingen = {};
    context = {};
  }
  let uitkomst: MatchUitkomst | null = null;
  try {
    uitkomst = berekenMatch({ answers, metingen, context });
  } catch {
    uitkomst = null;
  }
  const candidate = { label: rep.candidateLabel, decision: rep.decision, decisionReason: rep.decisionReason };
  return { ...bouwChatContext(uitkomst, session ?? null, candidate, taal), uitkomst, candidate, session: session ?? null };
}

/**
 * Poortwachter voor het volledige T4Recruitment-pad.
 *
 * T4Recruitment is recruiter-werk: een rolprofiel, een stakeholderkring en een
 * kandidaatdossier met persoonsgegevens. Er is nooit een kandidaat die hier
 * binnenkomt; de kandidaat vult een T4Business-vragenlijst in en ziet die op zijn
 * eigen pad. Toch stond dit hele pad open: zonder aanmelding gaven de sessielijst,
 * het kandidaatdossier en de vergelijkende studie alle drie een antwoord, en de
 * sessienummers lopen op. Eén poort vooraan is hier de juiste plaats: zo kan een
 * nieuwe route niet per ongeluk zonder controle geregistreerd worden.
 *
 * Wat dit NIET doet: scheiden per organisatie. De T4R-tabellen bewaren geen
 * eigenaar, dus twee aangemelde begeleiders van verschillende organisaties zien
 * elkaars rolprofielen nog. Dat is een apart punt dat een veld in de databank
 * vraagt; het staat hier vermeld zodat het niet als opgelost geldt. De
 * kandidaatgegevens uit een afname zijn wel per organisatie afgeschermd: de
 * keuzelijst hieronder gebruikt de bestaande scope-poort.
 */
async function vereisBegeleider(req: any, res: any, next: any): Promise<void> {
  const viaAdmin = adminIdVanSessie(req);
  const ruweCoach = (req.session as any)?.coachId;
  const coachId = ruweCoach == null ? null : Number(ruweCoach);
  const aangemeld = viaAdmin !== null || (coachId !== null && Number.isFinite(coachId) && coachId > 0);
  if (!aangemeld) {
    res.status(401).json({ error: "Niet ingelogd." });
    return;
  }
  next();
}

export function registerT4RRoutes(app: Express): void {
  // Elke route onder dit voorvoegsel vraagt een aangemelde begeleider.
  app.use("/api/t4r", vereisBegeleider);

  // ---- Sessies ----
  app.get("/api/t4r/sessions", async (_req, res) => {
    res.json(await storage.listSessions());
  });

  app.post("/api/t4r/sessions", async (req, res) => {
    // Optioneel: koppeling naar een bestaande platform-sessie (Fase 2). Wordt
    // door de collaboratieve schil meegegeven zodat credits/licentie correct
    // aan dit rolprofiel-traject hangen.
    const platformSessieId =
      req.body?.platformSessieId != null ? Number(req.body.platformSessieId) : undefined;
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const session = await storage.createSession(parsed.data, platformSessieId);
    res.json(session);
  });

  app.get("/api/t4r/sessions/:id", async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ error: "Niet gevonden" });
    res.json(session);
  });

  app.patch("/api/t4r/sessions/:id", async (req, res) => {
    const patchSchema = z.object({
      status: z.string().optional(),
      closedRing: z.boolean().optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const id = Number(req.params.id);

    // CREDIT-BRUG: het sluiten van de kring is het natuurlijke moment waarop het
    // sessietarief gereserveerd wordt. Doet de gekoppelde platform-sessie dat
    // (credits OF licentie) via de Fase 2-laag. Faalt dit door onvoldoende
    // credits, dan wordt de kring NIET gesloten en geeft de API 402.
    if (parsed.data.closedRing) {
      const session = await storage.getSession(id);
      if (session?.platformSessieId) {
        try {
          await platformStorage.vergrendelKring(session.platformSessieId);
        } catch (e) {
          if (e instanceof CreditError) {
            return res.status(402).json({ error: "Onvoldoende credits", message: e.message });
          }
          throw e;
        }
      }
    }

    const updated = await storage.updateSession(id, parsed.data as any);
    if (parsed.data.closedRing) await storage.addAudit(id, "Stakeholderkring gesloten en vergrendeld");
    if (parsed.data.status) await storage.addAudit(id, "Status gewijzigd", parsed.data.status);
    res.json(updated);
  });

  // ---- Stakeholders ----
  app.get("/api/t4r/sessions/:id/stakeholders", async (req, res) => {
    res.json(await storage.listStakeholders(Number(req.params.id)));
  });

  app.post("/api/t4r/sessions/:id/stakeholders", async (req, res) => {
    const body = { ...req.body, sessionId: Number(req.params.id) };
    const parsed = insertStakeholderSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const sh = await storage.addStakeholder(parsed.data);
    await storage.addAudit(sh.sessionId, "Stakeholder toegevoegd", `${sh.name} (${sh.stakeholderRole})`);
    res.json(sh);
  });

  app.delete("/api/t4r/stakeholders/:id", async (req, res) => {
    await storage.removeStakeholder(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Antwoorden ----
  app.get("/api/t4r/sessions/:id/answers", async (req, res) => {
    res.json(await storage.listAnswers(Number(req.params.id)));
  });

  app.post("/api/t4r/sessions/:id/answers", async (req, res) => {
    const body = { ...req.body, sessionId: Number(req.params.id) };
    const parsed = upsertAnswerSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const answer = await storage.upsertAnswer(parsed.data);
    if (parsed.data.conflict) await storage.addAudit(answer.sessionId, "Discussiepunt gemarkeerd", answer.itemId);
    if (parsed.data.finalDecision)
      await storage.addAudit(answer.sessionId, "Finale beslissing", `${answer.itemId}: ${parsed.data.finalDecision}`);
    res.json(answer);
  });

  // ---- Audit trail ----
  app.get("/api/t4r/sessions/:id/audit", async (req, res) => {
    res.json(await storage.listAudit(Number(req.params.id)));
  });

  // -------------------------------------------------------------------------
  // Kandidaatprofiel uit een T4Business-afname van dit platform.
  //
  // De keuzelijst is afgeschermd per organisatie via de bestaande scope-poort:
  // een begeleider ziet enkel afnames van zijn eigen organisatie. Afnames die
  // geanonimiseerd zijn, waarvan de toestemming is ingetrokken of waarvan de
  // bewaartermijn verstreken is, staan er niet in. Er is geen enkele reden om
  // die nog in een vergelijking te betrekken.
  // -------------------------------------------------------------------------
  app.get("/api/t4r/afname-kandidaten", async (req, res) => {
    const scope = await bepaalScope(req);
    if (scope.soort === "geen") {
      return res.status(403).json({ error: "Geen toegang tot organisatiegegevens." });
    }
    let afnames: any[] = [];
    try {
      afnames = await platformStorage.listAfnames(scope);
    } catch (e: any) {
      return res.status(500).json({ error: "Afnames konden niet gelezen worden." });
    }
    const vandaag = new Date().toISOString().slice(0, 10);
    const lijst: any[] = [];
    for (const a of afnames) {
      // Enkel het zakelijke instrument ("t4p-business-kompas"). De jongeren-
      // instrumenten meten andere constructen en horen niet in een aanwervings-
      // vergelijking. Een afname zonder instrumentnaam wordt bewust NIET
      // meegenomen: dan staat niet vast welk instrument is afgenomen.
      if (a.instrumentId !== T4P_INSTRUMENT) continue;
      if (a.geanonimiseerdAt) continue;
      if (a.consentIngetrokkenAt) continue;
      if (a.bewaartotDatum && String(a.bewaartotDatum).slice(0, 10) < vandaag) continue;
      if (!a.generatorContract) continue;
      let contract: any = null;
      try {
        contract = JSON.parse(a.generatorContract);
      } catch {
        continue;
      }
      const overname = neemProfielOverUitContract(contract);
      const aantal = Object.keys(overname.metingen).length;
      if (aantal === 0) continue;
      lijst.push({
        afnameId: a.id,
        naam: a.name,
        bedrijf: a.company ?? null,
        rol: a.role ?? null,
        respondentCode: a.respondentCode,
        status: a.status,
        afgenomenOp: overname.gegenereerdOp ?? a.createdAt ?? null,
        bewaartotDatum: a.bewaartotDatum ?? null,
        toestemmingOp: a.consentTimestamp ?? null,
        aantalLijnen: aantal,
        volledig: aantal === VERWACHT_AANTAL_LIJNEN,
      });
    }
    res.json(lijst);
  });

  app.post("/api/t4r/sessions/:id/candidate/uit-afname", async (req, res) => {
    const sessionId = Number(req.params.id);
    const schema = z.object({ afnameId: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const scope = await bepaalScope(req);
    if (scope.soort === "geen") {
      return res.status(403).json({ error: "Geen toegang tot organisatiegegevens." });
    }
    const sessie = await storage.getSession(sessionId);
    if (!sessie) return res.status(404).json({ error: "Rolprofiel niet gevonden." });

    const afname = await platformStorage.getAfname(parsed.data.afnameId);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden." });
    // Dezelfde afscherming als de keuzelijst, ook wanneer iemand een nummer
    // rechtstreeks meestuurt.
    if (scope.soort === "organisatie" && afname.organisatieId !== scope.organisatieId) {
      return res.status(403).json({ error: "Deze afname hoort niet bij uw organisatie." });
    }
    if (afname.geanonimiseerdAt)
      return res.status(409).json({ error: "Deze afname is geanonimiseerd en kan niet meer vergeleken worden." });
    if (afname.consentIngetrokkenAt)
      return res.status(409).json({ error: "De toestemming voor deze afname is ingetrokken." });
    const vandaag = new Date().toISOString().slice(0, 10);
    if (afname.bewaartotDatum && String(afname.bewaartotDatum).slice(0, 10) < vandaag)
      return res.status(409).json({ error: "De bewaartermijn van deze afname is verstreken." });
    if (afname.instrumentId !== T4P_INSTRUMENT)
      return res
        .status(409)
        .json({ error: "Deze afname is geen T4Business-afname en kan niet vergeleken worden." });
    if (!afname.generatorContract)
      return res.status(409).json({ error: "Deze afname heeft nog geen afgerond profiel." });

    let contract: any = null;
    try {
      contract = JSON.parse(afname.generatorContract);
    } catch {
      return res.status(500).json({ error: "Het profiel van deze afname is beschadigd." });
    }
    const overname = neemProfielOverUitContract(contract);
    if (Object.keys(overname.metingen).length === 0)
      return res.status(409).json({ error: "Uit deze afname zijn geen constructen over te nemen." });

    const label = overname.deelnemer.naam ?? afname.name;
    const herkomst: HerkomstPatch = {
      herkomst: "interne-afname",
      afnameId: afname.id,
      respondentCode: overname.deelnemer.respondentCode ?? afname.respondentCode,
      overgenomenAt: new Date().toISOString(),
      bronContractVersie: overname.contractVersie,
      bronInstrumentVersie: overname.instrumentVersie,
      // Vers overgenomen: er is nog niets met de hand veranderd.
      handmatigAangepast: [],
    };
    const metingen: Record<string, { net: number; energie: "geeft" | "neutraal" | "kost" }> = {};
    for (const [sleutel, m] of Object.entries(overname.metingen)) {
      metingen[sleutel] = { net: m.net, energie: m.energie };
    }

    const rep = await storage.saveCandidateReport(
      {
        sessionId,
        candidateLabel: label,
        sourceFile: null,
        metingen,
        context: overname.context,
        // Nog niet geverifieerd: de begeleider bevestigt de overname in het
        // scherm. Dat blijft een bewuste handeling, ook nu de cijfers niet meer
        // ingetypt hoeven te worden.
        verified: false,
      },
      herkomst,
    );
    await storage.addAudit(
      sessionId,
      "Kandidaatprofiel overgenomen uit afname",
      `${label} (afname ${afname.id}, code ${herkomst.respondentCode ?? "onbekend"}, ` +
        `${Object.keys(metingen).length} van ${VERWACHT_AANTAL_LIJNEN} lijnen)`,
    );

    res.json({
      rapport: rep,
      metingen: overname.metingen,
      context: overname.context,
      deelnemer: overname.deelnemer,
      ontbrekendeSleutels: overname.ontbrekendeSleutels,
      onbekendeConstructen: overname.onbekendeConstructen,
      herkomst: {
        soort: "interne-afname",
        afnameId: afname.id,
        respondentCode: herkomst.respondentCode,
        overgenomenAt: herkomst.overgenomenAt,
        contractVersie: overname.contractVersie,
        instrumentVersie: overname.instrumentVersie,
        afgenomenOp: overname.gegenereerdOp,
        toestemmingOp: afname.consentTimestamp ?? null,
        bewaartotDatum: afname.bewaartotDatum ?? null,
      },
    });
  });

  // ---- Kandidaatrapport: upload + automatische extractie ----
  app.post("/api/t4r/sessions/:id/candidate/extract", async (req, res) => {
    const schema = z.object({
      fileName: z.string().optional(),
      pdfBase64: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const buf = Buffer.from(parsed.data.pdfBase64, "base64");
      const data = await pdfParse(buf);
      const result = extractFromText(data.text);
      res.json({
        fileName: parsed.data.fileName ?? null,
        numpages: data.numpages,
        metingen: result.metingen,
        context: result.context,
      });
    } catch (e: any) {
      res.status(422).json({ error: "Kon de PDF niet lezen. Controleer of het een tekst-PDF is (geen scan).", detail: String(e?.message ?? e) });
    }
  });

  // ---- Kandidaatrapport: opslaan (na verificatie) ----
  app.get("/api/t4r/sessions/:id/candidate", async (req, res) => {
    const rep = await storage.getCandidateReport(Number(req.params.id));
    res.json(rep ?? null);
  });

  app.post("/api/t4r/sessions/:id/candidate", async (req, res) => {
    const body = { ...req.body, sessionId: Number(req.params.id) };
    const parsed = saveCandidateReportSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Is dit dossier uit een interne afname overgenomen? Dan bepaalt de SERVER
    // welke lijnen afwijken van die afname, door het contract opnieuw te lezen.
    // Zo blijft het spoor kloppen ook wanneer een beoordelaar waarden overtypt,
    // en kan de browser dat spoor niet zelf schrijven.
    const bestaand = await storage.getCandidateReport(Number(req.params.id));
    let herkomst: HerkomstPatch | undefined;
    if (parsed.data.sourceFile) {
      // Er is een bestand in het spel. Zelfs wanneer dit dossier eerder uit een
      // afname kwam, geldt vanaf nu de eerlijke waarde: de herkomst van deze
      // cijfers is niet vastgesteld. De verwijzing naar de oude afname wordt
      // gewist, want ze dekt deze waarden niet meer.
      herkomst = {
        herkomst: "pdf",
        afnameId: null,
        respondentCode: null,
        overgenomenAt: null,
        bronContractVersie: null,
        bronInstrumentVersie: null,
        handmatigAangepast: [],
      };
    } else if (bestaand?.herkomst === "interne-afname" && bestaand.afnameId != null) {
      const afname = await platformStorage.getAfname(bestaand.afnameId);
      let bron: Record<string, OvergenomenMeting> = {};
      if (afname?.generatorContract) {
        try {
          bron = neemProfielOverUitContract(JSON.parse(afname.generatorContract)).metingen;
        } catch {
          bron = {};
        }
      }
      herkomst = {
        herkomst: "interne-afname",
        afnameId: bestaand.afnameId,
        respondentCode: bestaand.respondentCode,
        overgenomenAt: bestaand.overgenomenAt,
        bronContractVersie: bestaand.bronContractVersie,
        bronInstrumentVersie: bestaand.bronInstrumentVersie,
        handmatigAangepast: bepaalHandmatigAangepast(bron, parsed.data.metingen),
      };
    }

    const rep = await storage.saveCandidateReport(parsed.data, herkomst);
    if (parsed.data.verified) {
      const spoor =
        rep.herkomst === "interne-afname"
          ? `${rep.candidateLabel} (uit afname ${rep.afnameId}, code ${rep.respondentCode ?? "onbekend"})`
          : `${rep.candidateLabel} (uit geupload bestand; herkomst niet vastgesteld)`;
      await storage.addAudit(rep.sessionId, "Kandidaatdata geverifieerd", spoor);
      const aangepast = herkomst?.handmatigAangepast ?? [];
      if (aangepast.length)
        await storage.addAudit(
          rep.sessionId,
          "Waarden met de hand aangepast na overname",
          aangepast.join(", "),
        );
    }
    if (parsed.data.decision)
      await storage.addAudit(rep.sessionId, "Matchbeslissing", `${rep.candidateLabel}: ${parsed.data.decision}`);
    res.json(rep);
  });

  // ---- Vergelijkende studie (match) berekenen ----
  // Draait uitsluitend op een GEVERIFIEERD kandidaatrapport.
  app.get("/api/t4r/sessions/:id/match", async (req, res) => {
    const sessionId = Number(req.params.id);
    const rep = await storage.getCandidateReport(sessionId);
    if (!rep) return res.status(404).json({ error: "Nog geen kandidaatrapport geüpload." });
    if (!rep.verified)
      return res.status(409).json({ error: "Het kandidaatrapport is nog niet geverifieerd. Bevestig eerst de gegevens." });
    const answers = await storage.listAnswers(sessionId);
    let metingen: Record<string, ConstructMeting> = {};
    let context: KandidaatContext = {};
    try {
      metingen = JSON.parse(rep.metingen);
      context = JSON.parse(rep.context);
    } catch {
      return res.status(500).json({ error: "Kandidaatdata is beschadigd." });
    }
    const uitkomst = berekenMatch({ answers, metingen, context });
    let handmatigAangepast: string[] = [];
    try {
      const v = JSON.parse(rep.handmatigAangepast ?? "[]");
      if (Array.isArray(v)) handmatigAangepast = v.filter((x: any) => typeof x === "string");
    } catch {
      handmatigAangepast = [];
    }
    res.json({
      uitkomst,
      candidate: {
        label: rep.candidateLabel,
        decision: rep.decision,
        decisionReason: rep.decisionReason,
        // Het spoor reist mee met de studie: wie het rapport leest, hoort te zien
        // waar de vergeleken cijfers vandaan komen en of er iets is bijgesteld.
        herkomst: rep.herkomst,
        afnameId: rep.afnameId,
        respondentCode: rep.respondentCode,
        overgenomenAt: rep.overgenomenAt,
        bronInstrumentVersie: rep.bronInstrumentVersie,
        sourceFile: rep.sourceFile,
        handmatigAangepast,
      },
    });
  });

  // -------------------------------------------------------------------------
  // Eindrapport-chatbot (RECRUITER-ONLY).
  //
  // Bevraagt het eindrapport (de vergelijkende studie). Uitsluitend voor de
  // recruiter/begeleidende coach — NOOIT voor de kandidaat (die heeft geen
  // toegang tot een T4R-sessie). De sidecar draait in de recruiter-variant:
  // een LEESHULP die GEEN geschiktheids-, selectie-, rangschikkings- of
  // aanwervingsuitspraken doet (recruitment-zorgkompas). "Driver" blijft
  // beschermd & onvertaald. Economisch model identiek aan de Kompas-chatbot.
  // -------------------------------------------------------------------------
  app.get("/api/t4r/sessions/:id/chat", async (req, res) => {
    const sessionId = Number(req.params.id);
    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Sessie niet gevonden" });
    const taal = normaliseerTaal((req.query.taal as string) || "nl") as Taal;
    const berichten = await storage.listChatBerichten(sessionId);
    res.json({
      berichten: berichten.map((b) => ({ id: b.id, rol: b.rol, inhoud: b.inhoud, veiligheid: b.veiligheid })),
      limiet: t4rLimietStatus(session),
      suggesties: chatSuggestiesRecruiter(taal),
      coach: coachKaartRecruiter(taal),
    });
  });

  app.post("/api/t4r/sessions/:id/chat", async (req, res) => {
    const sessionId = Number(req.params.id);
    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Sessie niet gevonden" });

    const parsed = t4rChatVraagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Stel een vraag" });
    }

    const status = t4rLimietStatus(session);
    if (status.geblokkeerd) {
      return res.status(402).json({ error: "limiet_bereikt", limiet: status });
    }

    const taal = normaliseerTaal((req.body?.taal as string) || "nl") as Taal;
    const ctx = await t4rChatContextVoor(sessionId, taal);

    // Diepe leeshulp-engine (demo/fallback): redeneert uitsluitend vanuit de
    // berekende studie, ook voor challenging investeerdersvragen. Vraagtaal
    // wordt per bericht gedetecteerd zodat een Franse/Engelse vraag in een NL
    // sessie toch in de juiste taal beantwoord wordt.
    const engineAntwoord = () => {
      const vraagTaal = detecteerVraagTaal(parsed.data.vraag, taal);
      return beantwoordRecruiter(parsed.data.vraag, ctx.uitkomst, vraagTaal, {
        functionTitle: ctx.session?.functionTitle ?? null,
        candidateLabel: ctx.candidate?.label ?? null,
      });
    };

    const historie = await storage.listChatBerichten(sessionId);
    const messages = [
      ...historie.map((b) => ({ role: b.rol, content: b.inhoud })),
      { role: "user", content: parsed.data.vraag },
    ];

    let reply = "";
    let veiligheid: string | null = null;
    try {
      const r = await fetch(`${CHAT_SIDECAR_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taal,
          profiel_context: ctx.context,
          risico: ctx.risico,
          messages,
          variant: "recruiter",
        }),
      });
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok || data.error) {
        if (DEMO_MODE) { const a = engineAntwoord(); reply = a.reply; veiligheid = a.veiligheid; }
        else return res.status(502).json({ error: data.error ?? "De assistent is even niet bereikbaar." });
      } else {
        reply = String(data.reply ?? "").trim();
        veiligheid = data.veiligheid ?? null;
      }
    } catch {
      if (DEMO_MODE) { const a = engineAntwoord(); reply = a.reply; veiligheid = a.veiligheid; }
      else return res.status(502).json({ error: "De assistent is even niet bereikbaar." });
    }

    if (!reply) {
      return res.status(502).json({ error: "Leeg antwoord van de assistent." });
    }

    await storage.voegChatBerichtToe(sessionId, "user", parsed.data.vraag, null);
    const opgeslagen = await storage.voegChatBerichtToe(sessionId, "assistant", reply, veiligheid);
    await storage.verhoogChatGebruikt(sessionId);
    const bijgewerkt = await storage.getSession(sessionId);

    res.json({
      antwoord: { id: opgeslagen.id, rol: "assistant", inhoud: reply, veiligheid },
      limiet: t4rLimietStatus(bijgewerkt ?? session),
      coach: veiligheid === "coach" ? coachKaartRecruiter(taal) : null,
    });
  });

  // Extra vragen bijkopen (DEMO: simuleert een Mollie/Bancontact-betaling).
  app.post("/api/t4r/sessions/:id/chat/koop-extra", async (req, res) => {
    const sessionId = Number(req.params.id);
    const bijgewerkt = await storage.voegChatTegoedToe(sessionId, T4R_CHAT_CONFIG.pakketGrootte);
    if (!bijgewerkt) return res.status(404).json({ error: "Sessie niet gevonden" });
    await storage.addAudit(sessionId, "Extra chatvragen bijgekocht (demo)", `${T4R_CHAT_CONFIG.pakketGrootte} vragen`);
    res.json({ ok: true, demo: true, pakketGrootte: T4R_CHAT_CONFIG.pakketGrootte, limiet: t4rLimietStatus(bijgewerkt) });
  });
}
