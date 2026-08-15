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
import { bouwToegangsmail } from "../toegangsmail";
import { bouwAanmeldmail } from "../aanmeldmail";

const STANDAARD_AFZENDER = "info@tapascity.com";

export interface MailInput {
  naar: string;
  taal: string;
  naam: string;
  link: string;
  instrument: string; // leesbare instrument-titel
  from?: string | null; // org-eigen afzender-override
}

export interface AanmeldlinkVerzending {
  naar: string;
  taal: string;
  naam: string;
  /** De volledige aanmeldlink naar /#/magic/<token>. */
  link: string;
  /** Hoeveel minuten de link geldig blijft. */
  geldigMinuten: number;
  from?: string | null;
}

export interface ToegangsmailVerzending {
  naar: string;
  taal: string;
  naam: string;
  /** De volledige, persoonlijke link naar het dashboard. */
  link: string;
  /** De toegangscode die bij dat dashboard hoort. */
  code: string;
  /** Leesbare naam van het ingevulde instrument. */
  instrument: string;
  from?: string | null;
}

export type MailStatus = "verstuurd" | "gesimuleerd" | "fout";

export interface MailResultaat {
  status: MailStatus;
  gesimuleerd: boolean;
  melding?: string;
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
    return { status: "gesimuleerd", gesimuleerd: true };
  }

  // C3 — Voorkeur: Brevo HTTP-API (werkt op Render free; SMTP is daar geblokkeerd).
  if (brevoApiGeconfigureerd()) {
    return verstuurViaBrevoApi({ from, naar: input.naar, naam: input.naam, subject, text });
  }

  try {
    await getTransporter().sendMail({ from, to: input.naar, subject, text });
    return { status: "verstuurd", gesimuleerd: false };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[bulk-import/mailer] Verzending mislukt naar ${input.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  }
}

// -----------------------------------------------------------------------------
// De toegangsmail: het bericht dat een deelnemer krijgt nadat hij aan het einde
// van zijn afname een e-mailadres opgaf. Het eindscherm belooft dat bericht
// uitdrukkelijk ("Stuur mij mijn persoonlijke toegang"), dus het moet er ook
// werkelijk komen. De tekst staat in server/toegangsmail.ts; de weg naar buiten
// is dezelfde als bij de uitnodiging: Brevo over HTTPS wanneer er een sleutel
// staat, anders SMTP, en anders wordt er niets verstuurd en zegt de status dat.
// -----------------------------------------------------------------------------
export async function verstuurToegangsmail(input: ToegangsmailVerzending): Promise<MailResultaat> {
  const { onderwerp, tekst } = bouwToegangsmail({
    naam: input.naam,
    link: input.link,
    code: input.code,
    instrument: input.instrument,
    taal: input.taal,
  });
  const from = afzenderVoor(input.from);

  if (isSimulatiemodus()) {
    console.log(
      `[mailer] SIMULATIE — toegangsmail NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${onderwerp}"`,
    );
    return { status: "gesimuleerd", gesimuleerd: true };
  }

  if (brevoApiGeconfigureerd()) {
    return verstuurViaBrevoApi({
      from,
      naar: input.naar,
      naam: input.naam,
      subject: onderwerp,
      text: tekst,
    });
  }

  try {
    await getTransporter().sendMail({ from, to: input.naar, subject: onderwerp, text: tekst });
    return { status: "verstuurd", gesimuleerd: false };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[mailer] Toegangsmail mislukt naar ${input.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  }
}

// -----------------------------------------------------------------------------
// De aanmeldmail: het bericht met de link waarmee een deelnemer zijn eigen
// ruimte opent. De pagina /mijn belooft dat bericht uitdrukkelijk, dus het moet
// er ook werkelijk komen. De tekst staat in server/aanmeldmail.ts; de weg naar
// buiten is dezelfde als bij de uitnodiging en de toegangsmail: Brevo over
// HTTPS wanneer er een sleutel staat, anders SMTP, en anders wordt er niets
// verstuurd en zegt de status dat.
//
// LET OP — de link mag nooit in een logregel belanden. Wie de logs kan lezen,
// zou dan de deur van een deelnemer kunnen openen. De simulatie- en foutregels
// hieronder vermelden daarom het adres en het onderwerp, maar nooit de link.
// -----------------------------------------------------------------------------
export async function verstuurAanmeldlink(input: AanmeldlinkVerzending): Promise<MailResultaat> {
  const { onderwerp, tekst } = bouwAanmeldmail({
    naam: input.naam,
    link: input.link,
    geldigMinuten: input.geldigMinuten,
    taal: input.taal,
  });
  const from = afzenderVoor(input.from);

  if (isSimulatiemodus()) {
    console.log(
      `[mailer] SIMULATIE — aanmeldlink NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${onderwerp}"`,
    );
    return { status: "gesimuleerd", gesimuleerd: true };
  }

  if (brevoApiGeconfigureerd()) {
    return verstuurViaBrevoApi({
      from,
      naar: input.naar,
      naam: input.naam,
      subject: onderwerp,
      text: tekst,
    });
  }

  try {
    await getTransporter().sendMail({ from, to: input.naar, subject: onderwerp, text: tekst });
    return { status: "verstuurd", gesimuleerd: false };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[mailer] Aanmeldlink mislukt naar ${input.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
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
      return {
        status: "verstuurd",
        gesimuleerd: false,
        melding: messageId ? `Brevo-API messageId=${messageId}` : "Verstuurd via Brevo-API.",
      };
    }
    const foutTekst = await resp.text().catch(() => "");
    const melding = `Brevo-API HTTP ${resp.status}: ${foutTekst.slice(0, 300)}`;
    console.error(`[bulk-import/mailer] Brevo-API verzending mislukt naar ${args.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende Brevo-API-fout";
    console.error(`[bulk-import/mailer] Brevo-API-fout naar ${args.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  }
}
