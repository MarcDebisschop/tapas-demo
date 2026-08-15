// ---------------------------------------------------------------------------
// server/aanmeldmail.ts
//
// De tekst van het bericht met de aanmeldlink waarmee een deelnemer zijn eigen
// ruimte opent.
//
// WAAROM DIT BESTAAT
// De pagina /mijn belooft: "Kijk in je mailbox — is dit adres bij ons bekend,
// dan staat er een aanmeldlink klaar." Die belofte moet kloppen. Tot nu toe
// maakte de route wél een token aan, maar verstuurde ze niets; buiten de
// demostand kwam er dus niets in de mailbox aan.
//
// WAAROM DE TEKST HIER STAAT EN NIET IN DE DATABANK
// Zelfde afweging als bij server/toegangsmail.ts: de uitnodigingsmail haalt zijn
// tekst uit de tabel mail_teksten, maar voor dit bericht bestaat daar geen rij.
// In de code staan betekent: in elke omgeving beschikbaar, in alle vijf de
// talen, zonder migratie, en zonder het risico dat een ontbrekende rij iemand
// een leeg bericht bezorgt — juist bij een bericht dat toegang geeft is dat
// onaanvaardbaar.
//
// Deze module opent geen databank en verstuurt zelf niets. Het versturen gebeurt
// in server/bulk-import/mailer.ts, over dezelfde weg als de uitnodigingsmail en
// de toegangsmail: Brevo over HTTPS wanneer er een sleutel staat, anders SMTP.
// ---------------------------------------------------------------------------

/** De talen waarin de aanmeldlink verstuurd kan worden. */
export const AANMELDMAIL_TALEN = ["nl", "fr", "en", "es", "ru"] as const;

export type AanmeldmailTaal = (typeof AANMELDMAIL_TALEN)[number];

export interface AanmeldmailInput {
  /** Naam van de deelnemer. Mag leeg zijn. */
  naam: string;
  /** De volledige aanmeldlink. */
  link: string;
  /** Hoeveel minuten de link geldig blijft. */
  geldigMinuten: number;
  /** Taal van de deelnemer. Onbekende waarden vallen terug op het Nederlands. */
  taal: string;
}

export interface Aanmeldmail {
  onderwerp: string;
  tekst: string;
}

interface Sjabloon {
  onderwerp: string;
  hallo: (naam: string) => string;
  halloZonderNaam: string;
  inleiding: string;
  linkLabel: string;
  /** De geldigheidsduur, met het aantal minuten als argument. */
  geldig: (minuten: number) => string;
  eenmalig: string;
  nietGevraagd: string;
  groet: string;
}

const SJABLONEN: Record<AanmeldmailTaal, Sjabloon> = {
  nl: {
    onderwerp: "Je aanmeldlink voor TaPas",
    hallo: (naam) => `Beste ${naam},`,
    halloZonderNaam: "Beste,",
    inleiding: "Je vroeg een aanmeldlink aan voor je persoonlijke ruimte op TaPas.",
    linkLabel: "Klik op deze link om je aan te melden:",
    geldig: (m) => `De link blijft ${m} minuten geldig.`,
    eenmalig:
      "Ze werkt één keer. Is ze verlopen of al gebruikt, vraag dan gewoon een nieuwe link aan.",
    nietGevraagd:
      "Heb je dit niet aangevraagd, dan hoef je niets te doen. Zonder de link hierboven kan niemand je gegevens bekijken.",
    groet: "Met vriendelijke groet,\nTaPasCity",
  },
  fr: {
    onderwerp: "Votre lien de connexion TaPas",
    hallo: (naam) => `Bonjour ${naam},`,
    halloZonderNaam: "Bonjour,",
    inleiding: "Vous avez demandé un lien de connexion à votre espace personnel TaPas.",
    linkLabel: "Cliquez sur ce lien pour vous connecter :",
    geldig: (m) => `Le lien reste valable ${m} minutes.`,
    eenmalig:
      "Il ne fonctionne qu'une seule fois. S'il a expiré ou a déjà été utilisé, demandez simplement un nouveau lien.",
    nietGevraagd:
      "Si vous n'êtes pas à l'origine de cette demande, vous n'avez rien à faire. Sans le lien ci-dessus, personne ne peut consulter vos données.",
    groet: "Cordialement,\nTaPasCity",
  },
  en: {
    onderwerp: "Your TaPas sign-in link",
    hallo: (naam) => `Dear ${naam},`,
    halloZonderNaam: "Hello,",
    inleiding: "You requested a sign-in link for your personal space on TaPas.",
    linkLabel: "Click this link to sign in:",
    geldig: (m) => `The link stays valid for ${m} minutes.`,
    eenmalig:
      "It works once. If it has expired or has already been used, simply request a new link.",
    nietGevraagd:
      "If you did not request this, there is nothing you need to do. Without the link above, nobody can view your data.",
    groet: "Kind regards,\nTaPasCity",
  },
  es: {
    onderwerp: "Tu enlace de acceso a TaPas",
    hallo: (naam) => `Hola ${naam}:`,
    halloZonderNaam: "Hola:",
    inleiding: "Has solicitado un enlace de acceso a tu espacio personal en TaPas.",
    linkLabel: "Haz clic en este enlace para acceder:",
    geldig: (m) => `El enlace es válido durante ${m} minutos.`,
    eenmalig:
      "Funciona una sola vez. Si ha caducado o ya se ha usado, solicita simplemente un enlace nuevo.",
    nietGevraagd:
      "Si no has hecho esta solicitud, no tienes que hacer nada. Sin el enlace anterior, nadie puede consultar tus datos.",
    groet: "Un cordial saludo,\nTaPasCity",
  },
  ru: {
    onderwerp: "Ваша ссылка для входа в TaPas",
    hallo: (naam) => `Здравствуйте, ${naam}!`,
    halloZonderNaam: "Здравствуйте!",
    inleiding: "Вы запросили ссылку для входа в свой личный раздел TaPas.",
    linkLabel: "Нажмите на эту ссылку, чтобы войти:",
    geldig: (m) => `Ссылка действительна ${m} минут.`,
    eenmalig:
      "Она работает один раз. Если срок истёк или ссылка уже использована, просто запросите новую.",
    nietGevraagd:
      "Если вы не отправляли этот запрос, ничего делать не нужно. Без ссылки выше никто не сможет увидеть ваши данные.",
    groet: "С уважением,\nTaPasCity",
  },
};

function kiesTaal(taal: string): AanmeldmailTaal {
  const kort = String(taal ?? "")
    .trim()
    .slice(0, 2)
    .toLowerCase();
  return (AANMELDMAIL_TALEN as readonly string[]).includes(kort)
    ? (kort as AanmeldmailTaal)
    : "nl";
}

/**
 * Bouwt onderwerp en tekst van de aanmeldmail. Zuivere functie: geen databank,
 * geen netwerk. Laat nooit een plaatshouder in de tekst achter.
 */
export function bouwAanmeldmail(input: AanmeldmailInput): Aanmeldmail {
  const s = SJABLONEN[kiesTaal(input.taal)];
  const naam = String(input.naam ?? "").trim();
  const link = String(input.link ?? "").trim();
  const minuten = Number.isFinite(input.geldigMinuten) && input.geldigMinuten > 0
    ? Math.round(input.geldigMinuten)
    : 15;

  const regels = [
    naam ? s.hallo(naam) : s.halloZonderNaam,
    "",
    s.inleiding,
    "",
    s.linkLabel,
    link,
    "",
    `${s.geldig(minuten)} ${s.eenmalig}`,
    "",
    s.nietGevraagd,
    "",
    s.groet,
  ];

  return { onderwerp: s.onderwerp, tekst: regels.join("\n") };
}
