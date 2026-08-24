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
import { schrijfVerzendregel, type VerzendSoort } from "./verzendlog";
import { beoordeelSmtpAntwoord } from "./smtp-antwoord";

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

// De ingebouwde teksten, voor het geval de tabel mail_teksten geen rij heeft.
// Beheerders kunnen deze teksten per taal overschrijven in Mailbeheer; de sleutel
// "herinnering" staat daar al in de lijst met sjablonen.
const STANDAARDSJABLONEN: Record<string, { onderwerp: string; body: string }> = {
  uitnodiging: {
    onderwerp: "Uitnodiging voor je TaPas-vragenlijst",
    body:
      "Beste {{naam}},\n\nJe bent uitgenodigd om {{instrument}} in te vullen.\n" +
      "Start via deze persoonlijke link:\n{{link}}\n\nMet vriendelijke groet,\nTaPasCity",
  },
  herinnering: {
    onderwerp: "Herinnering: je TaPas-vragenlijst staat nog open",
    body:
      "Beste {{naam}},\n\nEerder kreeg je een uitnodiging om {{instrument}} in te vullen. " +
      "Die staat nog open.\nJe gaat verder via dezelfde persoonlijke link:\n{{link}}\n\n" +
      "Lukt het niet, laat het ons dan weten.\n\nMet vriendelijke groet,\nTaPasCity",
  },
};

// Haal onderwerp+body op uit mail_teksten voor deze sjabloonsleutel, val terug
// op nl en daarna op de ingebouwde standaardtekst hierboven.
function haalSjabloon(taal: string, sleutel = "uitnodiging"): { onderwerp: string; body: string } {
  const standaard = STANDAARDSJABLONEN[sleutel] ?? STANDAARDSJABLONEN.uitnodiging;
  try {
    const rij =
      (sqlite
        .prepare("SELECT onderwerp, body FROM mail_teksten WHERE templateKey = ? AND taal = ?")
        .get(sleutel, taal) as { onderwerp: string; body: string } | undefined) ??
      (sqlite
        .prepare("SELECT onderwerp, body FROM mail_teksten WHERE templateKey = ? AND taal = 'nl'")
        .get(sleutel) as { onderwerp: string; body: string } | undefined);
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

/**
 * Legt de uitkomst van een verzendpoging vast in het blijvende logboek en geeft
 * die uitkomst onveranderd terug.
 *
 * Waarom hier en niet in de routes. Elke route die mailt, komt langs een van de
 * vier functies hieronder. Op deze plaats wordt dus elke poging vastgelegd,
 * ook een poging uit een route die later bijkomt. Zou de vastlegging per route
 * gebeuren, dan was de eerste route die het vergeet meteen een gat in het
 * logboek, en gaten in een logboek merkt niemand.
 *
 * De link en de berichttekst gaan bewust niet mee: zie server/bulk-import/verzendlog.ts.
 */
function boek(
  soort: VerzendSoort,
  meta: { naar: string; from: string; onderwerp: string; taal?: string | null; instrument?: string | null },
  resultaat: MailResultaat,
): MailResultaat {
  schrijfVerzendregel({
    soort,
    ontvanger: meta.naar,
    afzender: meta.from,
    onderwerp: meta.onderwerp,
    status: resultaat.status,
    melding: resultaat.melding ?? null,
    taal: meta.taal ?? null,
    instrument: meta.instrument ?? null,
  });
  return resultaat;
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

// -----------------------------------------------------------------------------
// De SMTP-weg naar buiten, op één plaats.
//
// Tot nu had elke verzendfunctie haar eigen poging met haar eigen try, en gaf
// elk van die takken "verstuurd" terug zodra nodemailer geen uitzondering
// gooide. Dat is niet hetzelfde als bezorgd: de server kan het adres weigeren of
// uitstellen zonder dat er een uitzondering volgt. Sinds die takken hier
// samenkomen, wordt het antwoord van de server altijd gelezen, door
// beoordeelSmtpAntwoord in server/bulk-import/smtp-antwoord.ts. Een tak vergeten
// kan dus niet meer.
//
// De tekst van het bericht gaat nooit naar de console; het adres en het
// onderwerp volstaan om een verzending terug te vinden.
// -----------------------------------------------------------------------------
async function verstuurViaSmtp(args: {
  naar: string;
  from: string;
  subject: string;
  text: string;
  antwoordNaar?: string | null;
  /** Wat er misging, in gewone woorden, voor de consoleregel bij een fout. */
  noem: string;
}): Promise<MailResultaat> {
  try {
    const info = await getTransporter().sendMail({
      from: args.from,
      to: args.naar,
      subject: args.subject,
      text: args.text,
      ...(args.antwoordNaar && args.antwoordNaar.trim()
        ? { replyTo: args.antwoordNaar.trim() }
        : {}),
    });
    const oordeel = beoordeelSmtpAntwoord(args.naar, info as unknown as Record<string, unknown>);
    if (oordeel.status !== "verstuurd") {
      console.error(`[mailer] ${args.noem} niet bezorgd aan ${args.naar}: ${oordeel.melding ?? ""}`);
    }
    return oordeel;
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende SMTP-fout";
    console.error(`[mailer] ${args.noem} mislukt naar ${args.naar}: ${melding}`);
    return { status: "fout", gesimuleerd: false, melding };
  }
}

/**
 * Verstuurt een bericht dat zijn tekst uit een sjabloon haalt: de uitnodiging en
 * de herinnering. Beide hebben dezelfde tokens ({{naam}}, {{link}},
 * {{instrument}}) en dezelfde weg naar buiten; alleen de sjabloonsleutel en de
 * soort in het logboek verschillen. Daarom staat dit hier eenmaal en niet twee keer.
 */
async function verstuurSjabloonmail(
  soort: VerzendSoort,
  sleutel: string,
  input: MailInput,
): Promise<MailResultaat> {
  const { onderwerp, body } = haalSjabloon(input.taal, sleutel);
  const from = afzenderVoor(input.from);
  const subject = vulTokens(onderwerp, input);
  const text = vulTokens(body, input);
  const meta = { naar: input.naar, from, onderwerp: subject, taal: input.taal, instrument: input.instrument };

  // SIMULATIEMODUS: niet echt versturen.
  if (isSimulatiemodus()) {
    console.log(
      `[bulk-import/mailer] SIMULATIE — mail NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${subject}"`,
    );
    return boek(soort, meta, { status: "gesimuleerd", gesimuleerd: true });
  }

  // C3 — Voorkeur: Brevo HTTP-API (werkt op Render free; SMTP is daar geblokkeerd).
  if (brevoApiGeconfigureerd()) {
    return boek(
      soort,
      meta,
      await verstuurViaBrevoApi({ from, naar: input.naar, naam: input.naam, subject, text }),
    );
  }

  return boek(
    soort,
    meta,
    await verstuurViaSmtp({ naar: input.naar, from, subject, text, noem: soort }),
  );
}

/** De eerste uitnodiging met de persoonlijke link. */
export async function verstuurUitnodiging(input: MailInput): Promise<MailResultaat> {
  return verstuurSjabloonmail("uitnodiging", "uitnodiging", input);
}

/**
 * De herinnering aan een uitnodiging die nog openstaat.
 *
 * De belknop in het beheeroverzicht zette tot nu enkel een datum en verstuurde
 * niets, terwijl de tekst "herinnerd" suggereerde dat er een bericht vertrok. Deze
 * functie maakt die belofte waar, met dezelfde link als de uitnodiging: die link
 * blijft geldig, dus er hoort geen nieuwe bij.
 */
export async function verstuurHerinnering(input: MailInput): Promise<MailResultaat> {
  return verstuurSjabloonmail("herinnering", "herinnering", input);
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
  const meta = { naar: input.naar, from, onderwerp, taal: input.taal, instrument: input.instrument };

  if (isSimulatiemodus()) {
    console.log(
      `[mailer] SIMULATIE — toegangsmail NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${onderwerp}"`,
    );
    return boek("toegangsmail", meta, { status: "gesimuleerd", gesimuleerd: true });
  }

  if (brevoApiGeconfigureerd()) {
    return boek(
      "toegangsmail",
      meta,
      await verstuurViaBrevoApi({
        from,
        naar: input.naar,
        naam: input.naam,
        subject: onderwerp,
        text: tekst,
      }),
    );
  }

  return boek(
    "toegangsmail",
    meta,
    await verstuurViaSmtp({
      naar: input.naar,
      from,
      subject: onderwerp,
      text: tekst,
      noem: "Toegangsmail",
    }),
  );
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
  const meta = { naar: input.naar, from, onderwerp, taal: input.taal, instrument: null };

  if (isSimulatiemodus()) {
    console.log(
      `[mailer] SIMULATIE — aanmeldlink NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${onderwerp}"`,
    );
    return boek("aanmeldlink", meta, { status: "gesimuleerd", gesimuleerd: true });
  }

  if (brevoApiGeconfigureerd()) {
    return boek(
      "aanmeldlink",
      meta,
      await verstuurViaBrevoApi({
        from,
        naar: input.naar,
        naam: input.naam,
        subject: onderwerp,
        text: tekst,
      }),
    );
  }

  return boek(
    "aanmeldlink",
    meta,
    await verstuurViaSmtp({
      naar: input.naar,
      from,
      subject: onderwerp,
      text: tekst,
      noem: "Aanmeldlink",
    }),
  );
}

// C3 — Verstuur via de Brevo transactionele HTTP-API (POST https://api.brevo.com/v3/smtp/email).
// Gebruikt de ingebouwde fetch (Node 18+). Splitst de afzender in naam+e-mail.
async function verstuurViaBrevoApi(args: {
  from: string;
  naar: string;
  naam: string;
  subject: string;
  text: string;
  /** Optioneel antwoordadres. Wordt alleen meegestuurd als het gevuld is, dus
   *  bestaande aanroepen veranderen niet van gedrag. */
  antwoordNaar?: string | null;
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
    ...(args.antwoordNaar && args.antwoordNaar.trim()
      ? { replyTo: { email: args.antwoordNaar.trim() } }
      : {}),
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

// -----------------------------------------------------------------------------
// Een gewoon bericht versturen.
//
// De drie functies hierboven maken elk hun eigen tekst op: een uitnodiging, een
// toegangsmail, een aanmeldlink. Voor een vraag die iemand via een publiek
// formulier stelt, bestaat die opmaak niet: onderwerp en tekst komen dan van de
// route zelf. Deze functie voegt niets nieuws toe aan de weg naar buiten, ze
// gebruikt precies dezelfde: Brevo over HTTPS wanneer er een sleutel staat,
// anders SMTP, en zonder een van beide wordt er niets verstuurd en zegt de
// status dat eerlijk.
//
// antwoordNaar zet het antwoordadres op de mail, zodat een antwoord bij de
// bezoeker aankomt en niet bij de afzender van het platform.
// -----------------------------------------------------------------------------
export interface BerichtVerzending {
  naar: string;
  naam: string;
  onderwerp: string;
  tekst: string;
  from?: string | null;
  antwoordNaar?: string | null;
}

export async function verstuurBericht(input: BerichtVerzending): Promise<MailResultaat> {
  const from = afzenderVoor(input.from);
  const meta = { naar: input.naar, from, onderwerp: input.onderwerp, taal: null, instrument: null };

  if (isSimulatiemodus()) {
    console.log(
      `[mailer] SIMULATIE, bericht NIET verstuurd. naar=${input.naar} van=${from} onderwerp="${input.onderwerp}"`,
    );
    return boek("bericht", meta, { status: "gesimuleerd", gesimuleerd: true });
  }

  if (brevoApiGeconfigureerd()) {
    return boek(
      "bericht",
      meta,
      await verstuurViaBrevoApi({
        from,
        naar: input.naar,
        naam: input.naam,
        subject: input.onderwerp,
        text: input.tekst,
        antwoordNaar: input.antwoordNaar ?? null,
      }),
    );
  }

  return boek(
    "bericht",
    meta,
    await verstuurViaSmtp({
      naar: input.naar,
      from,
      subject: input.onderwerp,
      text: input.tekst,
      antwoordNaar: input.antwoordNaar ?? null,
      noem: "Bericht",
    }),
  );
}
