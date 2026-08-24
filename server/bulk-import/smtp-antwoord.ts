// =============================================================================
// server/bulk-import/smtp-antwoord.ts
// -----------------------------------------------------------------------------
// Het antwoord van een mailserver beoordelen.
//
// WAAROM DIT BESTAAT. In het beheeroverzicht stond bij drie uitnodigingen
// "verstuurd", terwijl die berichten nooit zijn aangekomen, ook niet in de
// ongewenste post. De oorzaak zat niet bij de mailserver maar bij ons: de
// SMTP-weg gaf "verstuurd" terug zodra nodemailer geen uitzondering gooide.
// Nodemailer gooit echter niets wanneer de server het bericht aanvaardt voor het
// ene adres en weigert voor het andere. Wat de server werkelijk zei staat in
// `accepted`, `rejected` en `pending`, en dat werd nergens gelezen. Een stand
// die niet klopt is erger dan geen stand: wie "verstuurd" ziet, gaat niet meer
// zoeken.
//
// WAT DEZE MODULE DOET. Ze zet het antwoord van de mailserver om in een van
// drie standen, en niets anders. Ze verstuurt zelf niets, ze kent de
// omgevingsvariabelen niet en ze schrijft geen logboek. Daardoor is ze met
// gewone waarden te toetsen, zonder mailserver en zonder databank.
//
// DE REGEL. Het adres waarnaar wij stuurden moet in `accepted` staan en mag niet
// in `rejected` of `pending` staan. Alles daarbuiten is een fout met de melding
// van de leverancier erbij. "Pending" betekent bij SMTP dat de server het adres
// heeft uitgesteld; dat is geen bezorging en mag dus ook niet zo heten.
// =============================================================================

// Enkel het type, geen code: dit blijft dus een module zonder afhankelijkheden
// bij het draaien, ook al staat het type in de verzendmodule zelf.
import type { MailResultaat } from "./mailer";

/**
 * Het deel van het nodemailer-antwoord dat wij nodig hebben.
 *
 * Bewust een eigen, ruime vorm en niet het type van nodemailer: welke velden
 * meekomen hangt af van het transport, en de adressen komen soms als tekst en
 * soms als object met een `address`. Deze vorm vangt beide, zodat een afwijkend
 * antwoord hier tot een eerlijke fout leidt in plaats van tot een typefout.
 */
export interface SmtpAntwoord {
  accepted?: unknown;
  rejected?: unknown;
  pending?: unknown;
  messageId?: unknown;
  response?: unknown;
}

/** Haalt de adressen uit een veld van het antwoord, in kleine letters. */
function adressen(veld: unknown): string[] {
  if (!Array.isArray(veld)) return [];
  const uit: string[] = [];
  for (const item of veld) {
    if (typeof item === "string") {
      const t = item.trim().toLowerCase();
      if (t) uit.push(t);
      continue;
    }
    if (item && typeof item === "object") {
      const adres = (item as { address?: unknown }).address;
      if (typeof adres === "string" && adres.trim()) uit.push(adres.trim().toLowerCase());
    }
  }
  return uit;
}

/** Kort een melding af, zodat een uitzonderlijk lang antwoord niets vult. */
function kort(tekst: string, max = 300): string {
  const t = tekst.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 3)}...`;
}

/**
 * Beoordeelt het antwoord van de mailserver voor een verzending naar één adres.
 *
 * Geeft "verstuurd" alleen wanneer de server dat adres uitdrukkelijk aanvaardde
 * en het niet ook weigerde of uitstelde. In alle andere gevallen "fout", met een
 * melding die zegt wat de server zei, zodat het verzendlogboek achteraf bruikbaar is.
 */
export function beoordeelSmtpAntwoord(naar: string, antwoord: SmtpAntwoord | null | undefined): MailResultaat {
  const doel = naar.trim().toLowerCase();
  if (!antwoord || typeof antwoord !== "object") {
    return {
      status: "fout",
      gesimuleerd: false,
      melding: "De mailserver gaf geen antwoord waaruit bezorging blijkt.",
    };
  }

  const aanvaard = adressen(antwoord.accepted);
  const geweigerd = adressen(antwoord.rejected);
  const uitgesteld = adressen(antwoord.pending);
  const serverzegt = typeof antwoord.response === "string" ? kort(antwoord.response) : "";
  const staart = serverzegt ? ` Antwoord van de server: ${serverzegt}` : "";

  if (geweigerd.includes(doel)) {
    return {
      status: "fout",
      gesimuleerd: false,
      melding: `De mailserver weigerde ${naar}.${staart}`,
    };
  }
  if (uitgesteld.includes(doel)) {
    return {
      status: "fout",
      gesimuleerd: false,
      melding: `De mailserver stelde ${naar} uit en heeft niet bezorgd.${staart}`,
    };
  }
  if (!aanvaard.includes(doel)) {
    // Ook het geval waarin de server niets aanvaardde: dan is er niets vertrokken.
    return {
      status: "fout",
      gesimuleerd: false,
      melding: `De mailserver aanvaardde ${naar} niet.${staart}`,
    };
  }

  const id = typeof antwoord.messageId === "string" ? antwoord.messageId.trim() : "";
  return {
    status: "verstuurd",
    gesimuleerd: false,
    melding: id ? `SMTP messageId=${kort(id, 160)}` : "Aanvaard door de mailserver.",
  };
}
