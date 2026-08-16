// ---------------------------------------------------------------------------
// server/routes-onthaal-contact.ts: het contactformulier van de onthaalpagina.
//
// WAT DEZE ROUTE DOET
// De onthaalpagina van TaPas Core belooft aan de bezoeker: "U krijgt binnen twee
// werkdagen antwoord van een Tapas-medewerker." Die belofte vraagt twee dingen.
// Ten eerste mag een vraag nooit verloren gaan, dus ze wordt altijd opgeslagen.
// Ten tweede moet ze werkelijk aankomen, dus ze wordt ook per e-mail verstuurd
// naar info@tapascity.com.
//
// WAAROM DE STATUS MEEGAAT
// De mailer werkt in simulatiemodus zolang er geen BREVO_API_KEY en geen
// SMTP_HOST staat. In die stand meldt hij "gesimuleerd" en vertrekt er niets.
// Dat mag niet stil gebeuren: de status van de verzending gaat daarom mee in de
// opslag en in het antwoord van de route. Zo is een stille fout zichtbaar in
// plaats van onopgemerkt.
//
// WERKREGELS
// Nieuw bestand. routes.ts krijgt enkel een registratieregel, precies zoals bij
// registerCoachContactRoutes. Geen bestaand bestand wordt anders dan dat
// aangeraakt.
// ---------------------------------------------------------------------------

import type { Express, Request, Response } from "express";
import { sqlite as sqliteInstance } from "./storage";
import { verstuurBericht, isSimulatiemodus } from "./bulk-import/mailer";

/** Vast doeladres. De vragen van de onthaalpagina komen bij TaPasCity zelf. */
export const ONTHAAL_DOEL_EMAIL = "info@tapascity.com";

// Lengtegrenzen, tegen misbruik en tegen per ongeluk geplakte teksten.
export const MAX_NAAM = 200;
export const MAX_ORGANISATIE = 200;
export const MAX_EMAIL = 254;
export const MAX_ROL = 120;
export const MAX_VRAAG = 5000;

function getSqlite(): any {
  return sqliteInstance ?? null;
}

/** Eenvoudige controle van het e-mailadres, dezelfde als bij het coachformulier. */
export function isGeldigEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Lichte begrenzing per IP, in het geheugen. Geen extra afhankelijkheid, en
// hetzelfde patroon als in routes-coach-contact.ts.
const RL_VENSTER_MS = 15 * 60 * 1000;
const RL_MAX = 5;
const rlTreffers = new Map<string, number[]>();

export function _resetBegrenzing(): void {
  rlTreffers.clear();
}

function begrensd(ip: string): boolean {
  const nu = Date.now();
  const eerder = (rlTreffers.get(ip) ?? []).filter((t) => nu - t < RL_VENSTER_MS);
  if (eerder.length >= RL_MAX) {
    rlTreffers.set(ip, eerder);
    return true;
  }
  eerder.push(nu);
  rlTreffers.set(ip, eerder);
  if (rlTreffers.size > 5000) {
    for (const [k, v] of Array.from(rlTreffers)) {
      if (v.every((t: number) => nu - t >= RL_VENSTER_MS)) rlTreffers.delete(k);
    }
  }
  return false;
}

export interface OnthaalVraag {
  naam: string;
  organisatie: string;
  email: string;
  rol: string;
  vraag: string;
}

/**
 * Maakt onderwerp en tekst van het bericht dat naar info@tapascity.com gaat.
 * Apart gehouden zodat de opmaak los te toetsen valt.
 */
export function bouwOnthaalBericht(v: OnthaalVraag): { onderwerp: string; tekst: string } {
  const wie = v.organisatie ? `${v.naam} (${v.organisatie})` : v.naam;
  const onderwerp = `Vraag via de onthaalpagina: ${wie}`;
  const regels = [
    "Er kwam een vraag binnen via het contactformulier op de onthaalpagina van Tapas CORE.",
    "",
    `Naam: ${v.naam}`,
    `Organisatie of school: ${v.organisatie || "niet opgegeven"}`,
    `E-mail: ${v.email}`,
    `Rol: ${v.rol || "niet opgegeven"}`,
    "",
    "Vraag:",
    v.vraag || "(geen tekst ingevuld)",
    "",
    "Antwoorden op dit bericht gaat rechtstreeks naar de bezoeker.",
  ];
  return { onderwerp, tekst: regels.join("\n") };
}

export function registerOnthaalContactRoutes(app: Express): void {
  const sq = getSqlite();

  // Eigen tabel, idempotent aangemaakt. Ze raakt geen bestaande tabel aan.
  if (sq) {
    sq.exec(`
      CREATE TABLE IF NOT EXISTS onthaal_contactaanvragen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL DEFAULT '',
        organisatie TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        rol TEXT NOT NULL DEFAULT '',
        vraag TEXT NOT NULL DEFAULT '',
        doel_email TEXT NOT NULL DEFAULT '',
        mail_status TEXT NOT NULL DEFAULT 'onbekend',
        mail_melding TEXT NOT NULL DEFAULT '',
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("[tapas] Onthaalpagina: contactroute en tabel geregistreerd.");
  }

  // POST /api/onthaal-contact: publiek, een vraag van de onthaalpagina.
  app.post("/api/onthaal-contact", async (req: Request, res: Response) => {
    const sqi = getSqlite();

    const ip = String(
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        "onbekend",
    );
    if (begrensd(ip)) {
      return res
        .status(429)
        .json({ error: "Te veel aanvragen. Probeer het over enkele minuten opnieuw." });
    }

    const b = (req.body ?? {}) as Record<string, unknown>;
    const vraagGegevens: OnthaalVraag = {
      naam: String(b.naam ?? "").trim(),
      organisatie: String(b.organisatie ?? "").trim(),
      email: String(b.email ?? "").trim(),
      rol: String(b.rol ?? "").trim(),
      vraag: String(b.vraag ?? "").trim(),
    };

    if (!vraagGegevens.naam || !vraagGegevens.email) {
      return res
        .status(400)
        .json({ error: "Vul uw naam en uw e-mailadres in, dan kunnen wij antwoorden." });
    }
    if (!isGeldigEmail(vraagGegevens.email)) {
      return res.status(400).json({ error: "Geef een geldig e-mailadres op." });
    }
    if (vraagGegevens.naam.length > MAX_NAAM) {
      return res.status(400).json({ error: "Uw naam is te lang." });
    }
    if (vraagGegevens.organisatie.length > MAX_ORGANISATIE) {
      return res.status(400).json({ error: "De naam van uw organisatie is te lang." });
    }
    if (vraagGegevens.email.length > MAX_EMAIL) {
      return res.status(400).json({ error: "Uw e-mailadres is te lang." });
    }
    if (vraagGegevens.rol.length > MAX_ROL) {
      return res.status(400).json({ error: "De opgegeven rol is te lang." });
    }
    if (vraagGegevens.vraag.length > MAX_VRAAG) {
      return res.status(400).json({ error: "Uw vraag is te lang." });
    }

    // Eerst opslaan, dan versturen. Zo staat de vraag er ook wanneer de mail
    // onderweg strandt.
    let rijId: number | null = null;
    if (sqi) {
      try {
        const uitkomst = sqi
          .prepare(
            `INSERT INTO onthaal_contactaanvragen
               (naam, organisatie, email, rol, vraag, doel_email, mail_status)
             VALUES (?, ?, ?, ?, ?, ?, 'bezig')`,
          )
          .run(
            vraagGegevens.naam,
            vraagGegevens.organisatie,
            vraagGegevens.email,
            vraagGegevens.rol,
            vraagGegevens.vraag,
            ONTHAAL_DOEL_EMAIL,
          );
        rijId = Number(uitkomst?.lastInsertRowid ?? 0) || null;
      } catch (e) {
        console.error("[onthaal-contact] Opslaan mislukt:", e);
      }
    }

    const { onderwerp, tekst } = bouwOnthaalBericht(vraagGegevens);
    let status = "onbekend";
    let melding = "";
    try {
      const resultaat = await verstuurBericht({
        naar: ONTHAAL_DOEL_EMAIL,
        naam: "TaPasCity",
        onderwerp,
        tekst,
        antwoordNaar: vraagGegevens.email,
      });
      status = resultaat.status;
      melding = resultaat.melding ?? "";
    } catch (e) {
      status = "fout";
      melding = e instanceof Error ? e.message : "Onbekende fout bij het versturen.";
      console.error("[onthaal-contact] Versturen mislukt:", melding);
    }

    // Een vraag die niet werkelijk vertrok, mag niet stil blijven. De pagina
    // belooft een antwoord binnen twee werkdagen; die belofte hangt dan volledig
    // aan het overzicht in de beheerdersomgeving. Daarom een duidelijke
    // waarschuwing in het logboek, zonder het adres of de tekst van de bezoeker.
    if (status !== "verstuurd") {
      console.warn(
        `[onthaal-contact] LET OP: de vraag is niet verstuurd (status=${status}). ` +
          `Ze staat wel opgeslagen (rij=${rijId ?? "geen"}). ` +
          `Simulatiemodus=${isSimulatiemodus()}. Controleer BREVO_API_KEY of SMTP_HOST.`,
      );
    }

    if (sqi && rijId) {
      try {
        sqi
          .prepare(
            "UPDATE onthaal_contactaanvragen SET mail_status = ?, mail_melding = ? WHERE id = ?",
          )
          .run(status, melding.slice(0, 500), rijId);
      } catch (e) {
        console.error("[onthaal-contact] Status bijwerken mislukt:", e);
      }
    }

    // Kwam de vraag nergens aan, niet opgeslagen en niet verstuurd, dan mag de
    // pagina niet doen alsof alles goed ging.
    if (!rijId && status !== "verstuurd") {
      return res.status(500).json({
        error:
          "Het versturen lukte niet. Stuur uw vraag naar info@tapascity.com, dan komt ze zeker aan.",
        mailStatus: status,
      });
    }

    return res.json({
      ok: true,
      opgeslagen: rijId !== null,
      mailStatus: status,
      gesimuleerd: status === "gesimuleerd",
      simulatiemodus: isSimulatiemodus(),
    });
  });

  // GET /api/admin/onthaal-contactaanvragen: overzicht voor de beheerder, met
  // de verzendstatus erbij, zodat een simulatie of een fout opvalt.
  app.get("/api/admin/onthaal-contactaanvragen", (req: Request, res: Response) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
    const sqi = getSqlite();
    if (!sqi) return res.json([]);
    try {
      return res.json(
        sqi
          .prepare("SELECT * FROM onthaal_contactaanvragen ORDER BY aangemaakt_op DESC, id DESC")
          .all(),
      );
    } catch (e) {
      console.error("[onthaal-contact] Ophalen mislukt:", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });
}
