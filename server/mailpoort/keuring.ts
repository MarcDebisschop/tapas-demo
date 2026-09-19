// =============================================================================
// server/mailpoort/keuring.ts
// -----------------------------------------------------------------------------
// Het oordeel, los van de navraag.
//
// WAAROM APART. De navraag bij de leverancier gaat over het net en is in een
// toets niet na te spelen zonder de leverancier zelf. Het oordeel erover is
// rekenwerk op een antwoord, en dat is wel na te spelen. Alles wat beslist of
// een batch mag vertrekken, staat daarom in zuivere functies in dit bestand, en
// de toetsen in tests/mailpoort.test.ts voeren die functies rechtstreeks. Zo
// staat de belofte "dit vertrekt of het zegt waarom niet" in een toets en niet
// in een geheugen.
//
// De grondregel van dit bestand: bij twijfel gaat de batch niet door. Een
// uitnodiging die niet aankomt, kost een credit, kost vertrouwen bij de
// ontvanger, en kost de verzender een dag wachten op een antwoord dat nooit
// komt. Niets aanmaken en het eerlijk zeggen, is altijd goedkoper.
// =============================================================================

import type { BrevoAccount, BrevoGeblokkeerd, BrevoSender, BrevoUitslag } from "./brevo";

export type Verzendweg = "brevo-api" | "smtp" | "geen";

export interface Wegkeuring {
  weg: Verzendweg;
  /** Mag er een batch vertrekken. */
  bruikbaar: boolean;
  /** Wat er in de weg staat, in gewone woorden, voor het scherm. */
  bezwaren: string[];
  /** Wat de verzender zelf moet doen om het op te lossen. */
  wathelpt: string[];
  /** De afzender die de batch wilde gebruiken. */
  gevraagdeAfzender: string;
  /** De afzender waarmee werkelijk verstuurd wordt. */
  werkelijkeAfzender: string;
  /** Is de gevraagde afzender bij de leverancier gevalideerd. */
  afzenderStand: "gevalideerd" | "niet gevalideerd" | "onbekend";
  /** Welke afzenders staan er wel klaar. */
  geldigeAfzenders: string[];
  /** Hoeveel berichten mag deze rekening nog versturen, voor zover bekend. */
  resterendTegoed: number | null;
  gecontroleerdOp: string;
}

export interface Ontvangerkeuring {
  email: string;
  /** Kan er een bericht aankomen bij dit adres. */
  bruikbaar: boolean;
  /** Waarom niet, met de reden van de leverancier erin. */
  bezwaar: string | null;
  /** Staat het adres op de blokkeerlijst van de leverancier. */
  geblokkeerd: boolean;
  /** Is de stand vastgesteld, of kon de leverancier niet antwoorden. */
  vastgesteld: boolean;
}

const ADRES = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Het tegoed dat voor gewone e-mail geldt, uit het planoverzicht van de leverancier. */
export function leesTegoed(account: BrevoAccount | undefined): number | null {
  if (!account || !Array.isArray(account.plan)) return null;
  for (const regel of account.plan) {
    const soort = (regel?.creditsType ?? "").toLowerCase();
    if (soort.includes("send") || soort.includes("email")) {
      const n = Number(regel?.credits);
      if (Number.isFinite(n)) return n;
    }
  }
  // Een rekening zonder tellend tegoed (een abonnement met een daggrens) geeft
  // hier niets bruikbaars terug. Dat is geen bezwaar, alleen onbekend.
  return null;
}

function adresUit(afzender: string): string {
  const m = afzender.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  return (m ? m[2] : afzender).trim().toLowerCase();
}

/**
 * Keurt de weg naar buiten voor één afzender.
 *
 * De drie uitkomsten die tellen:
 *
 *   geen weg      Er staat geen sleutel en geen mailserver. Alles wat verstuurd
 *                 lijkt te worden, wordt in werkelijkheid alleen gelogd. Dit was
 *                 de stille stand waarin een batch "gelukt" heette.
 *   weg, gesloten De sleutel bestaat maar de leverancier weigert hem, of de
 *                 rekening is leeg. Niets vertrekt, en de leverancier zegt waarom.
 *   weg, open     Er kan verstuurd worden. Staat de gevraagde afzender niet
 *                 gevalideerd en is er wel een andere die het is, dan wijst de
 *                 keuring die aan, want een geweigerde afzender is de tweede
 *                 reden waarom een batch stil blijft.
 */
export function beoordeelWeg(argumenten: {
  sleutelAanwezig: boolean;
  smtpAanwezig: boolean;
  gevraagdeAfzender: string;
  account?: BrevoUitslag<BrevoAccount>;
  afzenders?: BrevoUitslag<{ senders?: BrevoSender[] }>;
  nu?: Date;
}): Wegkeuring {
  const { sleutelAanwezig, smtpAanwezig, gevraagdeAfzender } = argumenten;
  const nu = (argumenten.nu ?? new Date()).toISOString();
  const bezwaren: string[] = [];
  const wathelpt: string[] = [];

  if (!sleutelAanwezig && !smtpAanwezig) {
    return {
      weg: "geen",
      bruikbaar: false,
      bezwaren: [
        "Er staat geen verzendweg ingesteld. Het platform legt berichten dan alleen vast en verstuurt ze niet.",
      ],
      wathelpt: [
        "Zet BREVO_API_KEY bij de omgevingsvariabelen van de dienst, of vul een mailserver in met SMTP_HOST.",
      ],
      gevraagdeAfzender,
      werkelijkeAfzender: gevraagdeAfzender,
      afzenderStand: "onbekend",
      geldigeAfzenders: [],
      resterendTegoed: null,
      gecontroleerdOp: nu,
    };
  }

  // De mailserverweg valt hier niet na te vragen: een mailserver kent geen
  // lijst met gevalideerde afzenders en geen tegoed. Die weg blijft dus bruikbaar
  // zolang er een host staat, en het oordeel over een bericht komt daar van het
  // antwoord van de server zelf, in server/bulk-import/smtp-antwoord.ts.
  if (!sleutelAanwezig) {
    return {
      weg: "smtp",
      bruikbaar: true,
      bezwaren: [],
      wathelpt: [],
      gevraagdeAfzender,
      werkelijkeAfzender: gevraagdeAfzender,
      afzenderStand: "onbekend",
      geldigeAfzenders: [],
      resterendTegoed: null,
      gecontroleerdOp: nu,
    };
  }

  const account = argumenten.account;
  if (account && !account.ok) {
    if (account.status === 401) {
      bezwaren.push("De mailleverancier weigert de sleutel. Er kan geen enkel bericht vertrekken.");
      wathelpt.push("Maak een nieuwe sleutel bij de leverancier en zet die bij de dienst.");
    } else if (account.status === 0) {
      bezwaren.push(account.melding ?? "De mailleverancier was niet bereikbaar.");
      wathelpt.push("Probeer het opnieuw. Lukt het dan nog niet, kijk dan de storingspagina van de leverancier na.");
    } else {
      bezwaren.push(account.melding ?? `De mailleverancier antwoordde met HTTP ${account.status}.`);
    }
  }

  const tegoed = leesTegoed(account?.inhoud);
  if (tegoed != null && tegoed <= 0) {
    bezwaren.push(
      "Het dagtegoed bij de mailleverancier is op. Berichten vertrekken pas wanneer de leverancier het tegoed morgen opnieuw zet.",
    );
    wathelpt.push("Wacht tot morgen of neem een groter pakket bij de leverancier.");
  }

  const lijst = argumenten.afzenders?.inhoud?.senders ?? [];
  const geldigeAfzenders = lijst
    .filter((s) => s?.email && s.active !== false)
    .map((s) => String(s.email).trim().toLowerCase());
  const gevraagd = adresUit(gevraagdeAfzender);

  let afzenderStand: Wegkeuring["afzenderStand"] = "onbekend";
  let werkelijkeAfzender = gevraagdeAfzender;

  if (argumenten.afzenders?.ok && lijst.length > 0) {
    if (geldigeAfzenders.includes(gevraagd)) {
      afzenderStand = "gevalideerd";
    } else {
      afzenderStand = "niet gevalideerd";
      const terugval = geldigeAfzenders[0];
      if (terugval) {
        werkelijkeAfzender = terugval;
        bezwaren.push(
          `De afzender ${gevraagd} is bij de leverancier niet gevalideerd. De berichten vertrekken daarom van ${terugval}.`,
        );
        wathelpt.push(
          `Valideer ${gevraagd} bij de leverancier wanneer de berichten van dat adres moeten komen.`,
        );
      } else {
        bezwaren.push(
          `De afzender ${gevraagd} is bij de leverancier niet gevalideerd en er staat geen enkele gevalideerde afzender klaar.`,
        );
        wathelpt.push(`Valideer ${gevraagd} bij de leverancier en bevestig de mail die daarop volgt.`);
      }
    }
  }

  // Een niet gevalideerde afzender zonder terugval sluit de weg: de leverancier
  // weigert zo'n bericht met een fout, en dat gebeurt dan rij na rij.
  const afzenderBlokkeert = afzenderStand === "niet gevalideerd" && geldigeAfzenders.length === 0;
  const rekeningBlokkeert = !!(account && !account.ok) || (tegoed != null && tegoed <= 0);

  return {
    weg: "brevo-api",
    bruikbaar: !afzenderBlokkeert && !rekeningBlokkeert,
    bezwaren,
    wathelpt,
    gevraagdeAfzender,
    werkelijkeAfzender,
    afzenderStand,
    geldigeAfzenders,
    resterendTegoed: tegoed,
    gecontroleerdOp: nu,
  };
}

/**
 * Keurt één ontvanger.
 *
 * Een geblokkeerd adres is het enige geval waarin het verzendlogboek liegt
 * zonder iets verkeerd te doen: de leverancier aanvaardt het bericht, geeft een
 * messageId, en bezorgt niets. Daarom is dit de enige controle die vóór het
 * aanmaken van een uitnodiging hoort en niet erna.
 */
export function beoordeelOntvanger(
  email: string,
  blokkering: BrevoUitslag<BrevoGeblokkeerd | null> | null,
): Ontvangerkeuring {
  const adres = email.trim().toLowerCase();
  if (!ADRES.test(adres)) {
    return {
      email: adres,
      bruikbaar: false,
      bezwaar: "Dit is geen geldig e-mailadres.",
      geblokkeerd: false,
      vastgesteld: true,
    };
  }
  if (!blokkering) {
    return { email: adres, bruikbaar: true, bezwaar: null, geblokkeerd: false, vastgesteld: false };
  }
  if (!blokkering.ok) {
    // De leverancier kon het niet zeggen. Dat is geen reden om de rij tegen te
    // houden: dan zou een storing bij de leverancier een hele batch stilzetten
    // terwijl de berichten misschien wel aankomen. Het blijft wel onvastgesteld,
    // en dat staat zo in het scherm.
    return { email: adres, bruikbaar: true, bezwaar: null, geblokkeerd: false, vastgesteld: false };
  }
  const rij = blokkering.inhoud;
  if (!rij) {
    return { email: adres, bruikbaar: true, bezwaar: null, geblokkeerd: false, vastgesteld: true };
  }
  const reden = rij.reason?.message || rij.reason?.code || "onbekende reden";
  const sinds = rij.blockedAt ? ` sinds ${String(rij.blockedAt).slice(0, 10)}` : "";
  return {
    email: adres,
    bruikbaar: false,
    bezwaar:
      `De mailleverancier blokkeert dit adres${sinds} (${reden}). ` +
      "Berichten aan dit adres worden wel aanvaard, maar niet bezorgd.",
    geblokkeerd: true,
    vastgesteld: true,
  };
}

/**
 * Is deze fout van voorbijgaande aard, en heeft een herkansing dus zin.
 *
 * Alleen een tijdelijke fout mag opnieuw. Een geweigerde sleutel en een
 * geweigerde afzender veranderen niet door het nog eens te proberen, en drie
 * keer hetzelfde vragen maakt een fout alleen maar later zichtbaar.
 */
export function isTijdelijkeFout(status: number, melding?: string | null): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  if (status === 408) return true;
  if (status === 0) return true; // het verzoek bereikte de leverancier niet
  const t = (melding ?? "").toLowerCase();
  return (
    t.includes("timeout") ||
    t.includes("timed out") ||
    t.includes("aborted") ||
    t.includes("econnreset") ||
    t.includes("etimedout") ||
    t.includes("socket") ||
    t.includes("network") ||
    t.includes("niet bereikbaar")
  );
}

export interface RijUitslag {
  status: "ok" | "fout" | "overgeslagen";
  mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-";
}

export interface Batchoordeel {
  /** Aantal rijen waarvan het bericht werkelijk vertrok. */
  aantalVerstuurd: number;
  /** Aantal rijen met een uitnodiging maar zonder vertrokken bericht. */
  aantalZonderMail: number;
  /** Is de batch volledig gelukt, mail en al. */
  geslaagd: boolean;
  /** Eén regel voor bovenaan het scherm, of null wanneer alles klopt. */
  alarm: string | null;
}

/**
 * Het oordeel over een hele batch.
 *
 * Hier zat de fout die deze hele module nodig maakte. Het scherm telde de rijen
 * met status ok, en die status betekende: de uitnodiging is aangemaakt. Of het
 * bericht vertrok, stond alleen in een kleine kolom verderop. Een batch waarin
 * geen enkel bericht vertrok, meldde dus "3 aangemaakt" in het groen. Vanaf nu
 * telt alleen een vertrokken bericht als geslaagd, en zegt het alarm hoeveel er
 * blijven staan.
 */
export function beoordeelBatch(rijen: RijUitslag[]): Batchoordeel {
  const aangemaakt = rijen.filter((r) => r.status === "ok");
  const aantalVerstuurd = aangemaakt.filter((r) => r.mailStatus === "verstuurd").length;
  // Een streepje betekent dat er voor die rij geen adres was en dus geen bericht
  // gevraagd werd. Dat is geen mislukking en hoort niet in het alarm; alleen een
  // gevraagd bericht dat niet vertrok, telt hier mee.
  const zonder = aangemaakt.filter((r) => r.mailStatus === "gesimuleerd" || r.mailStatus === "fout");
  const gesimuleerd = zonder.filter((r) => r.mailStatus === "gesimuleerd").length;
  const mislukt = zonder.filter((r) => r.mailStatus === "fout").length;

  let alarm: string | null = null;
  if (gesimuleerd > 0 && mislukt === 0) {
    alarm =
      `${gesimuleerd} uitnodiging(en) zijn aangemaakt, maar er vertrok geen enkel bericht: ` +
      "Er staat geen verzendweg ingesteld. De links werken wel en je kan ze met de hand doorgeven.";
  } else if (mislukt > 0) {
    alarm =
      `${mislukt} uitnodiging(en) zijn aangemaakt, maar het bericht vertrok niet. ` +
      "Bij elke rij staat waarom het misliep. Los die reden op en verstuur daarna opnieuw.";
  }

  return {
    aantalVerstuurd,
    aantalZonderMail: zonder.length,
    geslaagd: rijen.every((r) => r.status !== "fout") && zonder.length === 0,
    alarm,
  };
}
