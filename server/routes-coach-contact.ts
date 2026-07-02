// ---------------------------------------------------------------------------
// TaPas Platform — Publiek coach-contactformulier (NIEUW, aparte route).
//
// DOEL
// Bezoekers van de publieke coachpagina (/coaches) kunnen rechtstreeks een
// bericht sturen naar een geaccrediteerde TaPas-coach. Het bericht wordt
// server-side opgeslagen (zelfde patroon als /api/academy/vragen) zodat het
// ook op de demo werkt en later, op de eigen server (Render) met
// mailconfiguratie, effectief per e-mail kan worden doorgestuurd.
//
// STRIKTE WERKREGELS
// - Regel 1: niets herbouwen — hergebruikt de bestaande coach_register tabel
//   (email-veld) die via de admin (/api/admin/coaches) al beheerbaar is.
// - Regel 2: nieuwe feature staat in DIT aparte bestand; routes.ts krijgt
//   enkel een registratieregel. De do-not-touch bestanden blijven ongemoeid.
//
// E-MAILBEPALING
// Het doeladres wordt server-side bepaald uit coach_register.email. Is dat
// leeg, dan valt het terug op info@tapascity.com. De admin kan het adres per
// coach wijzigen; na opslaan staat het automatisch juist, zowel op de publieke
// pagina als in dit contactformulier (beide lezen dezelfde bron).
// ---------------------------------------------------------------------------

import type { Express, Request, Response } from "express";
import { sqlite as sqliteInstance } from "./storage";

const FALLBACK_EMAIL = "info@tapascity.com";

// Lengtegrenzen (server-side sanity, tegen misbruik/spam).
const MAX_NAAM = 200;
const MAX_EMAIL = 254;
const MAX_BERICHT = 5000;

function getSqlite(): any {
  return sqliteInstance ?? null;
}

// Zeer eenvoudige e-mailvalidatie (server-side sanity check).
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Lichtgewicht in-memory rate limiter (geen extra dependency, blijft in dit
// aparte bestand — Regel 2). Beperkt het publieke contactformulier per IP.
// Bewust eenvoudig: volstaat voor de demo en voorkomt bulk-spam.
const RL_WINDOW_MS = 15 * 60 * 1000; // 15 minuten
const RL_MAX = 5; // max. 5 aanvragen per IP per venster
const rlHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const eerder = (rlHits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (eerder.length >= RL_MAX) {
    rlHits.set(ip, eerder);
    return true;
  }
  eerder.push(now);
  rlHits.set(ip, eerder);
  // Occasioneel oude IP's opruimen om geheugen te sparen.
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) {
      if (v.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(k);
    }
  }
  return false;
}

export function registerCoachContactRoutes(app: Express): void {
  const sq = getSqlite();

  // Aparte tabel voor coach-contactaanvragen (idempotent, raakt niets aan).
  if (sq) {
    sq.exec(`
      CREATE TABLE IF NOT EXISTS coach_contactaanvragen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER,
        coach_naam TEXT NOT NULL DEFAULT '',
        doel_email TEXT NOT NULL DEFAULT '',
        afzender_naam TEXT NOT NULL DEFAULT '',
        afzender_email TEXT NOT NULL DEFAULT '',
        bericht TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'nieuw',
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("[tapas] Coach-contactformulier route + tabel geregistreerd.");
  }

  // GET /api/coaches/:id/contact-adres
  // Geeft het (server-bepaalde) doeladres terug voor een coach, met fallback.
  // Zo hoeft de frontend nooit zelf te beslissen en blijft de bron uniform.
  app.get("/api/coaches/:id/contact-adres", (req: Request, res: Response) => {
    const sqi = getSqlite();
    const id = Number(req.params.id);
    if (!sqi || !Number.isFinite(id)) {
      return res.json({ email: FALLBACK_EMAIL, fallback: true });
    }
    try {
      const row = sqi
        .prepare(
          `SELECT email FROM coach_register
           WHERE id = ? AND actief = 1 AND toestemmingRegister = 1 AND zichtbaarInRegister = 1`,
        )
        .get(id) as { email?: string } | undefined;
      const email = (row?.email ?? "").trim();
      if (email && isValidEmail(email)) {
        return res.json({ email, fallback: false });
      }
      return res.json({ email: FALLBACK_EMAIL, fallback: true });
    } catch (e) {
      console.error("[coaches/contact-adres]", e);
      return res.json({ email: FALLBACK_EMAIL, fallback: true });
    }
  });

  // POST /api/coaches/:id/contact — publiek, bericht aan coach indienen.
  // Slaat op in coach_contactaanvragen en bepaalt het doeladres server-side.
  app.post("/api/coaches/:id/contact", (req: Request, res: Response) => {
    const sqi = getSqlite();
    if (!sqi) return res.status(500).json({ error: "Opslag niet beschikbaar." });

    // Rate limiting per IP (spam-/misbruikbescherming).
    const ip = String(
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        "onbekend",
    );
    if (rateLimited(ip)) {
      return res
        .status(429)
        .json({ error: "Te veel aanvragen. Probeer het over enkele minuten opnieuw." });
    }

    const id = Number(req.params.id);
    const b = req.body ?? {};
    const afzenderNaam = String(b.naam ?? "").trim();
    const afzenderEmail = String(b.email ?? "").trim();
    const bericht = String(b.bericht ?? "").trim();

    // Validatie
    if (!afzenderNaam || !afzenderEmail || !bericht) {
      return res.status(400).json({ error: "Vul je naam, e-mailadres en bericht in." });
    }
    if (!isValidEmail(afzenderEmail)) {
      return res.status(400).json({ error: "Geef een geldig e-mailadres op." });
    }
    if (afzenderNaam.length > MAX_NAAM) {
      return res.status(400).json({ error: "Je naam is te lang." });
    }
    if (afzenderEmail.length > MAX_EMAIL) {
      return res.status(400).json({ error: "Je e-mailadres is te lang." });
    }
    if (bericht.length > MAX_BERICHT) {
      return res.status(400).json({ error: "Je bericht is te lang." });
    }

    try {
      // Coach + doeladres server-side ophalen (bron = coach_register).
      let coachNaam = "";
      let doelEmail = FALLBACK_EMAIL;
      if (Number.isFinite(id)) {
        const row = sqi
          .prepare(
            `SELECT naam, email FROM coach_register
             WHERE id = ? AND actief = 1 AND toestemmingRegister = 1 AND zichtbaarInRegister = 1`,
          )
          .get(id) as { naam?: string; email?: string } | undefined;
        if (row) {
          coachNaam = (row.naam ?? "").trim();
          const em = (row.email ?? "").trim();
          if (em && isValidEmail(em)) doelEmail = em;
        }
      }

      sqi
        .prepare(
          `INSERT INTO coach_contactaanvragen
             (coach_id, coach_naam, doel_email, afzender_naam, afzender_email, bericht)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number.isFinite(id) ? id : null,
          coachNaam,
          doelEmail,
          afzenderNaam,
          afzenderEmail,
          bericht,
        );

      return res.json({ ok: true, doelEmail });
    } catch (e) {
      console.error("[coaches/contact POST]", e);
      return res.status(500).json({ error: "Versturen mislukt. Probeer het later opnieuw." });
    }
  });

  // GET /api/admin/coach-contactaanvragen — admin-overzicht van ingediende berichten.
  app.get("/api/admin/coach-contactaanvragen", (req: Request, res: Response) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
    const sqi = getSqlite();
    if (!sqi) return res.json([]);
    try {
      return res.json(
        sqi
          .prepare("SELECT * FROM coach_contactaanvragen ORDER BY aangemaakt_op DESC")
          .all(),
      );
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });
}
