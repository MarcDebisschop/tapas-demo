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

export function isSimulatiemodus(): boolean {
  return !smtpGeconfigureerd();
}

function afzenderVoor(from?: string | null): string {
  if (from && from.trim()) return from.trim();
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) return process.env.SMTP_FROM.trim();
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

  try {
    await getTransporter().sendMail({ from, to: input.naar, subject, text });
    return { status: "verstuurd", gesimuleerd: false };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[bulk-import/mailer] Verzending mislukt naar ${input.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  }
}
