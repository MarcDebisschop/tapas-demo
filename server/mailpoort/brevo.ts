// =============================================================================
// server/mailpoort/brevo.ts
// -----------------------------------------------------------------------------
// Navraag bij de mailleverancier, over HTTPS.
//
// WAAROM DIT BESTAAT. De verzendmodule kon tot nu alleen vaststellen of een
// bericht de deur uit ging. Zij kon niet vaststellen of die deur wel open
// stond. Dat verschil is geen detail: een batch uitnodigingen werd aangemaakt,
// er werden credits gereserveerd, en pas achteraf bleek dat er geen enkel
// bericht kon vertrekken. Wie dan vraagt waarom, vindt in het logboek een
// melding per bericht, maar niemand kijkt in een logboek voor een bericht dat
// hij nog niet mist.
//
// Deze module stelt de vier vragen die vooraf te stellen zijn, en die de
// leverancier zelf kan beantwoorden:
//
//   1. Is de sleutel geldig en hoeveel mag deze rekening vandaag nog versturen?
//   2. Welke afzenders zijn bij de leverancier gevalideerd?
//   3. Staat een ontvanger op de blokkeerlijst, en waarom?
//   4. Kan die blokkering weer weg?
//
// De derde vraag is de belangrijkste en de meest verraderlijke. Wie ooit een
// bericht liet terugkomen of zich afmeldde, komt bij Brevo op een blokkeerlijst
// voor transactionele berichten. Daarna blijft de API antwoorden dat het
// bericht aanvaard is, met een messageId, terwijl er niets bezorgd wordt. Het
// verzendlogboek zegt dan "verstuurd" en de ontvanger heeft niets. Zo'n geval
// is met geen enkele controle achteraf te vinden, en juist daarom hoort de
// vraag vooraf gesteld te worden.
//
// WAT HIER NOOIT IN MAG. De sleutel gaat nooit in een antwoord naar de browser
// en nooit in een logregel. Persoonlijke links horen hier evenmin: deze module
// verstuurt niets, zij vraagt alleen na.
// =============================================================================

const BASIS = "https://api.brevo.com/v3";
const TIJDSGRENS_MS = 12000;

export interface BrevoUitslag<T> {
  ok: boolean;
  /** De ontlede inhoud bij een geslaagde navraag. */
  inhoud?: T;
  /** De HTTP-status, of 0 wanneer het verzoek de leverancier niet bereikte. */
  status: number;
  /** Wat er misging, in woorden die in een scherm mogen staan. */
  melding?: string;
}

export interface BrevoAccount {
  email?: string;
  companyName?: string;
  plan?: Array<{
    type?: string;
    credits?: number;
    creditsType?: string;
  }>;
}

export interface BrevoSender {
  id?: number;
  name?: string;
  email?: string;
  active?: boolean;
}

export interface BrevoGeblokkeerd {
  email?: string;
  reason?: { code?: string; message?: string };
  blockedAt?: string;
  senderEmail?: string;
}

export function sleutel(): string | null {
  const s = process.env.BREVO_API_KEY;
  return s && s.trim() ? s.trim() : null;
}

/**
 * Eén navraag bij de leverancier.
 *
 * Geeft nooit een uitzondering terug aan de aanroeper. Een poort die zelf
 * omvalt wanneer de leverancier onbereikbaar is, houdt een verzending tegen die
 * misschien wel had gekund. Daarom wordt elke fout een uitslag met ok op false
 * en een melding erbij, en beslist de beoordeling in keuring.ts wat dat
 * betekent.
 */
async function vraag<T>(pad: string, opties?: { methode?: string }): Promise<BrevoUitslag<T>> {
  const key = sleutel();
  if (!key) {
    return { ok: false, status: 0, melding: "Er staat geen sleutel voor de mailleverancier ingesteld." };
  }
  const stopper = new AbortController();
  const klok = setTimeout(() => stopper.abort(), TIJDSGRENS_MS);
  try {
    const antwoord = await fetch(`${BASIS}${pad}`, {
      method: opties?.methode ?? "GET",
      headers: { accept: "application/json", "api-key": key },
      signal: stopper.signal,
    });
    if (antwoord.status === 204) {
      return { ok: true, status: 204 };
    }
    if (!antwoord.ok) {
      const tekst = await antwoord.text().catch(() => "");
      return {
        ok: false,
        status: antwoord.status,
        melding: `De mailleverancier antwoordde met HTTP ${antwoord.status}. ${tekst.slice(0, 200)}`.trim(),
      };
    }
    const inhoud = (await antwoord.json().catch(() => undefined)) as T | undefined;
    return { ok: true, status: antwoord.status, inhoud };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Onbekende fout";
    return {
      ok: false,
      status: 0,
      melding: `De mailleverancier was niet bereikbaar: ${melding}`,
    };
  } finally {
    clearTimeout(klok);
  }
}

/** Is de sleutel geldig, en wat staat er nog op de rekening. */
export function haalAccount(): Promise<BrevoUitslag<BrevoAccount>> {
  return vraag<BrevoAccount>("/account");
}

/** Welke afzenders heeft de leverancier gevalideerd. */
export function haalAfzenders(): Promise<BrevoUitslag<{ senders?: BrevoSender[] }>> {
  return vraag<{ senders?: BrevoSender[] }>("/senders");
}

/**
 * Staat dit adres op de blokkeerlijst voor transactionele berichten.
 *
 * De leverancier antwoordt met 404 wanneer het adres er niet op staat. Dat is
 * dus goed nieuws en geen fout, en zo wordt het hier ook teruggegeven.
 */
export async function haalBlokkering(email: string): Promise<BrevoUitslag<BrevoGeblokkeerd | null>> {
  const uitslag = await vraag<BrevoGeblokkeerd>(
    `/smtp/blockedContacts/${encodeURIComponent(email.trim().toLowerCase())}`,
  );
  if (uitslag.status === 404) {
    return { ok: true, status: 404, inhoud: null };
  }
  return uitslag as BrevoUitslag<BrevoGeblokkeerd | null>;
}

/** Haalt een blokkering weg, zodat berichten aan dit adres weer vertrekken. */
export function deblokkeer(email: string): Promise<BrevoUitslag<unknown>> {
  return vraag(`/smtp/blockedContacts/${encodeURIComponent(email.trim().toLowerCase())}`, {
    methode: "DELETE",
  });
}
