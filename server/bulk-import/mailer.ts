// =============================================================================
// server/bulk-import/mailer.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Dunne nodemailer-wrapper met SIMULATIEMODUS. Leest SMTP-config uit env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// Als SMTP_HOST ontbreekt → er wordt NIET echt verstuurd: we loggen en geven
// { gesimuleerd: true } terug. Zo werkt de bulk-import (links aanmaken) ook
// zonder SMTP-configuratie; enkel het effectief mailen is dan uitgeschakeld.
//
// Afzender-prioriteit: expliciete `from`-parameter (org-eigen afzender) →
// SMTP_FROM → info@tapascity.com.
//
// Mailinhoud hergebruikt de bestaande mailsjablonen (tabel mail_teksten,
// templateKey "uitnodiging") per taal met tokens {{naam}}, {{link}},
// {{instrument}}. Ontbreekt een sjabloon, dan valt de mailer terug op een
// eenvoudige standaardtekst.
// =============================================================================

import nodemailer from "nodemailer";
import { sqlite } from "../storage";

const STANDAARD_AFZENDER = "info@tapascity.com";

export interface MailInput {
  naar: string;
  taal: string;
  naam: string;
  link: string;
  instrument: string; // leesbare instrument-titel
  from?: string | null; // org-eigen afzender-override
  respondentCode?: string | null; // voor de verzendlog (koppeling aan afname)
  poging?: number; // 1 = eerste verzending, >1 = herverzending/herinnering
}

export type MailStatus = "verstuurd" | "gesimuleerd" | "fout";

export interface MailResultaat {
  status: MailStatus;
  gesimuleerd: boolean;
  melding?: string;
  messageId?: string; // provider-messageId bij succes (verifieerbaar bewijs)
  kanaal?: "smtp" | "brevo-api" | "simulatie";
}

// -----------------------------------------------------------------------------
// Persistente verzendlog. Schrijft elke verzendpoging weg in tabel mail_log,
// zodat achteraf hard aantoonbaar is wat er met een mail gebeurde. Faalt het
// loggen zelf, dan mag dat de verzending niet breken (best-effort).
// -----------------------------------------------------------------------------
function logMail(args: {
  respondentCode?: string | null;
  email: string;
  instrument?: string | null;
  kanaal: "smtp" | "brevo-api" | "simulatie";
  status: MailStatus;
  messageId?: string | null;
  response?: string | null;
  poging?: number;
}): void {
  try {
    sqlite
      .prepare(
        `INSERT INTO mail_log
           (respondent_code, email, instrument, kanaal, status, provider_message_id, provider_response, poging, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        args.respondentCode ?? null,
        args.email,
        args.instrument ?? null,
        args.kanaal,
        args.status,
        args.messageId ?? null,
        args.response ?? null,
        args.poging ?? 1,
        new Date().toISOString(),
      );
  } catch (e) {
    console.error(
      `[bulk-import/mailer] Kon verzendlog niet wegschrijven voor ${args.email}: ` +
        (e instanceof Error ? e.message : String(e)),
    );
  }
}

function smtpGeconfigureerd(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}

// C3 — Brevo HTTP-API (additief). Render's gratis plan blokkeert uitgaande
// SMTP-poorten (25/465/587) sinds 26 sept 2025, waardoor nodemailer een
// 'Connection timeout' geeft. De Brevo transactionele API werkt over HTTPS
// (poort 443) en wordt NIET geblokkeerd. Staat BREVO_API_KEY ingevuld, dan
// versturen we via die API i.p.v. SMTP. Verandert niets aan de SMTP-weg.
function brevoApiGeconfigureerd(): boolean {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim());
}

export function isSimulatiemodus(): boolean {
  return !smtpGeconfigureerd() && !brevoApiGeconfigureerd();
}

function afzenderVoor(from?: string | null): string {
  if (from && from.trim()) return from.trim();
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) return process.env.SMTP_FROM.trim();
  // C1 — extra configureerbare fallback-afzender vóór de hardgecodeerde default,
  // zodat productie een eigen afzender kan zetten zonder SMTP_FROM te overschrijven.
  if (process.env.MAIL_FALLBACK_FROM && process.env.MAIL_FALLBACK_FROM.trim())
    return process.env.MAIL_FALLBACK_FROM.trim();
  return STANDAARD_AFZENDER;
}

// Haal onderwerp+body op uit mail_teksten (templateKey "uitnodiging"), val
// terug op nl en daarna op een ingebouwde standaardtekst.
function haalSjabloon(taal: string): { onderwerp: string; body: string } {
  const standaard = {
    onderwerp: "Uitnodiging voor je TaPas-vragenlijst",
    body:
      "Beste {{naam}},\n\nJe bent uitgenodigd om {{instrument}} in te vullen.\n" +
      "Start via deze persoonlijke link:\n{{link}}\n\nMet vriendelijke groet,\nTaPasCity",
  };
  try {
    const rij =
      (sqlite
        .prepare("SELECT onderwerp, body FROM mail_teksten WHERE templateKey = 'uitnodiging' AND taal = ?")
        .get(taal) as { onderwerp: string; body: string } | undefined) ??
      (sqlite
        .prepare("SELECT onderwerp, body FROM mail_teksten WHERE templateKey = 'uitnodiging' AND taal = 'nl'")
        .get() as { onderwerp: string; body: string } | undefined);
    if (rij && (rij.onderwerp || rij.body)) {
      return {
        onderwerp: rij.onderwerp || standaard.onderwerp,
        body: rij.body || standaard.body,
      };
    }
  } catch {
    // mail_teksten kan (nog) niet bestaan; standaardtekst volstaat.
  }
  return standaard;
}

function vulTokens(tekst: string, input: MailInput): string {
  return tekst
    .replace(/\{\{\s*naam\s*\}\}/g, input.naam || "deelnemer")
    .replace(/\{\{\s*link\s*\}\}/g, input.link)
    .replace(/\{\{\s*instrument\s*\}\}/g, input.instrument);
}

let transporterCache: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporterCache) return transporterCache;
  transporterCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    // C2 — expliciete timeouts (additief): zonder deze wacht nodemailer
    // onbeperkt als de SMTP-host niet (tijdig) antwoordt, waardoor de
    // verzend-request volledig blijft hangen. Met timeouts krijgen we binnen
    // korte tijd een eerlijke 'fout'-status i.p.v. een hangende verbinding.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporterCache;
}

export async function verstuurUitnodiging(input: MailInput): Promise<MailResultaat> {
  const { onderwerp, body } = haalSjabloon(input.taal);
  const from = afzenderVoor(input.from);
  const subject = vulTokens(onderwerp, input);
  const text = vulTokens(body, input);

  // SIMULATIEMODUS: niet echt versturen.
  if (isSimulatiemodus()) {
    console.log(
      `[bulk-import/mailer] SIMULATIE — mail NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${subject}"`,
    );
    logMail({
      respondentCode: input.respondentCode,
      email: input.naar,
      instrument: input.instrument,
      kanaal: "simulatie",
      status: "gesimuleerd",
      response: "SMTP niet geconfigureerd - mail gesimuleerd.",
      poging: input.poging,
    });
    return { status: "gesimuleerd", gesimuleerd: true, kanaal: "simulatie" };
  }

  // C3 — Voorkeur: Brevo HTTP-API (werkt op Render free; SMTP is daar geblokkeerd).
  if (brevoApiGeconfigureerd()) {
    return verstuurViaBrevoApi({
      from,
      naar: input.naar,
      naam: input.naam,
      subject,
      text,
      respondentCode: input.respondentCode,
      instrument: input.instrument,
      poging: input.poging,
    });
  }

  try {
    // KERN-FIX: lees het nodemailer-resultaat uit i.p.v. blind "verstuurd" te
    // retourneren. Alleen als het doeladres in `accepted` staat en NIET in
    // `rejected`, is de mail door de server aanvaard. Zo betekent "verstuurd"
    // ook echt dat de mailserver het bericht aannam (met messageId als bewijs).
    const info = await getTransporter().sendMail({ from, to: input.naar, subject, text });
    const accepted = (info.accepted ?? []).map((a: unknown) => String(a).toLowerCase());
    const rejected = (info.rejected ?? []).map((a: unknown) => String(a).toLowerCase());
    const doel = input.naar.toLowerCase();
    const messageId = info.messageId ?? "";
    const response = info.response ?? "";

    if (rejected.includes(doel) || !accepted.includes(doel)) {
      const melding = `SMTP weigerde het adres (accepted=[${accepted.join(", ")}], rejected=[${rejected.join(", ")}]). ${response}`.trim();
      console.error(`[bulk-import/mailer] Verzending geweigerd voor ${input.naar}: ${melding}`);
      logMail({
        respondentCode: input.respondentCode,
        email: input.naar,
        instrument: input.instrument,
        kanaal: "smtp",
        status: "fout",
        response: melding,
        poging: input.poging,
      });
      return { status: "fout", gesimuleerd: false, melding, kanaal: "smtp" };
    }

    logMail({
      respondentCode: input.respondentCode,
      email: input.naar,
      instrument: input.instrument,
      kanaal: "smtp",
      status: "verstuurd",
      messageId,
      response,
      poging: input.poging,
    });
    return {
      status: "verstuurd",
      gesimuleerd: false,
      messageId,
      kanaal: "smtp",
      melding: messageId ? `SMTP messageId=${messageId}` : "Verstuurd via SMTP.",
    };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[bulk-import/mailer] Verzending mislukt naar ${input.naar}: ${melding}`);
    logMail({
      respondentCode: input.respondentCode,
      email: input.naar,
      instrument: input.instrument,
      kanaal: "smtp",
      status: "fout",
      response: melding,
      poging: input.poging,
    });
    return { status: "fout", gesimuleerd: false, melding, kanaal: "smtp" };
  }
}

// C3 — Verstuur via de Brevo transactionele HTTP-API (POST https://api.brevo.com/v3/smtp/email).
// Gebruikt de ingebouwde fetch (Node 18+). Splitst de afzender in naam+e-mail.
async function verstuurViaBrevoApi(args: {
  from: string;
  naar: string;
  naam: string;
  subject: string;
  text: string;
  respondentCode?: string | null;
  instrument?: string | null;
  poging?: number;
}): Promise<MailResultaat> {
  const apiKey = process.env.BREVO_API_KEY!.trim();
  // Splits "Naam <email@x>" of val terug op puur e-mailadres.
  const m = args.from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  const senderEmail = (m ? m[2] : args.from).trim();
  const senderNaam = (m && m[1] ? m[1] : "TaPasCity").trim();
  const body = {
    sender: { email: senderEmail, name: senderNaam },
    to: [{ email: args.naar, name: args.naam || undefined }],
    subject: args.subject,
    textContent: args.text,
  };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (resp.ok) {
      let messageId = "";
      try {
        const j = (await resp.json()) as { messageId?: string };
        messageId = j.messageId ?? "";
      } catch {
        /* body kan leeg zijn */
      }
      logMail({
        respondentCode: args.respondentCode,
        email: args.naar,
        instrument: args.instrument,
        kanaal: "brevo-api",
        status: "verstuurd",
        messageId,
        response: "Brevo-API HTTP 2xx (aanvaard).",
        poging: args.poging,
      });
      return {
        status: "verstuurd",
        gesimuleerd: false,
        messageId,
        kanaal: "brevo-api",
        melding: messageId ? `Brevo-API messageId=${messageId}` : "Verstuurd via Brevo-API.",
      };
    }
    const foutTekst = await resp.text().catch(() => "");
    const melding = `Brevo-API HTTP ${resp.status}: ${foutTekst.slice(0, 300)}`;
    console.error(`[bulk-import/mailer] Brevo-API verzending mislukt naar ${args.naar}: ${melding}`);
    logMail({
      respondentCode: args.respondentCode,
      email: args.naar,
      instrument: args.instrument,
      kanaal: "brevo-api",
      status: "fout",
      response: melding,
      poging: args.poging,
    });
    return { status: "fout", gesimuleerd: false, melding, kanaal: "brevo-api" };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende Brevo-API-fout";
    console.error(`[bulk-import/mailer] Brevo-API-fout naar ${args.naar}: ${melding}`);
    logMail({
      respondentCode: args.respondentCode,
      email: args.naar,
      instrument: args.instrument,
      kanaal: "brevo-api",
      status: "fout",
      response: melding,
      poging: args.poging,
    });
    return { status: "fout", gesimuleerd: false, melding, kanaal: "brevo-api" };
  }
}

// -----------------------------------------------------------------------------
// Leeshulp voor het admin-overzicht: geeft de laatste verzendstatus per
// respondent_code terug uit de verzendlog. Zo kan de UI een eerlijke mailstatus
// tonen (verstuurd/geweigerd/gesimuleerd) los van de afname-status.
// -----------------------------------------------------------------------------
export interface MailLogRegel {
  respondent_code: string | null;
  email: string;
  instrument: string | null;
  kanaal: string;
  status: MailStatus;
  provider_message_id: string | null;
  provider_response: string | null;
  poging: number;
  created_at: string;
}

export function laatsteMailStatusPerRespondent(): Record<string, MailLogRegel> {
  const out: Record<string, MailLogRegel> = {};
  try {
    const rijen = sqlite
      .prepare(
        `SELECT respondent_code, email, instrument, kanaal, status,
                provider_message_id, provider_response, poging, created_at
           FROM mail_log
          WHERE respondent_code IS NOT NULL
          ORDER BY id ASC`,
      )
      .all() as MailLogRegel[];
    for (const r of rijen) {
      if (r.respondent_code) out[r.respondent_code] = r; // laatste wint (ASC)
    }
  } catch (e) {
    console.error(
      "[bulk-import/mailer] Kon verzendlog niet lezen: " +
        (e instanceof Error ? e.message : String(e)),
    );
  }
  return out;
}
