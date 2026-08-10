// ---------------------------------------------------------------------------
// server/toegangsmail.ts
//
// De tekst van het bericht dat een deelnemer krijgt nadat hij aan het einde van
// een afname zijn e-mailadres heeft opgegeven.
//
// WAAROM DIT BESTAAT
// Het eindscherm vraagt "Waar mogen we je persoonlijke toegang naartoe sturen?"
// en de knop heet "Stuur mij mijn persoonlijke toegang" (shared/i18n.ts). Die
// belofte moet kloppen. Het koppelpad gaf tot nu toe enkel een link en een code
// op het scherm terug en verstuurde niets.
//
// WAAROM DE TEKST HIER STAAT EN NIET IN DE DATABANK
// De uitnodigingsmail haalt zijn tekst uit de tabel mail_teksten (templateKey
// "uitnodiging"). Voor de toegangsmail bestaat daar geen rij. Deze tekst staat
// daarom in de code: hij is dan in elke omgeving beschikbaar, in alle vijf de
// talen, zonder migratie en zonder het risico dat een ontbrekende rij een
// deelnemer een leeg bericht bezorgt.
//
// Deze module opent geen databank en verstuurt zelf niets. Het versturen zelf
// gebeurt in server/bulk-import/mailer.ts, over dezelfde weg als de
// uitnodigingsmail.
// ---------------------------------------------------------------------------

/** De talen waarin het eindscherm de toegang kan opsturen. */
export const TOEGANGSMAIL_TALEN = ["nl", "fr", "en", "es", "ru"] as const;

export type ToegangsmailTaal = (typeof TOEGANGSMAIL_TALEN)[number];

export interface ToegangsmailInput {
  /** Naam van de deelnemer. Mag leeg zijn. */
  naam: string;
  /** De volledige, persoonlijke link naar het dashboard. */
  link: string;
  /** De toegangscode die bij dat dashboard hoort. */
  code: string;
  /** Leesbare naam van het ingevulde instrument. Mag leeg zijn. */
  instrument: string;
  /** Taal van de afname. Onbekende waarden vallen terug op het Nederlands. */
  taal: string;
}

export interface Toegangsmail {
  onderwerp: string;
  tekst: string;
}

interface Sjabloon {
  onderwerp: string;
  /** Aanspreking wanneer er een naam bekend is. */
  hallo: (naam: string) => string;
  /** Aanspreking wanneer er geen naam bekend is. */
  halloZonderNaam: string;
  /** Openingszin met de naam van het instrument. */
  inleiding: (instrument: string) => string;
  /** Openingszin wanneer het instrument onbekend is. */
  inleidingZonderInstrument: string;
  linkLabel: string;
  codeLabel: string;
  bewaar: string;
  groet: string;
}

const SJABLONEN: Record<ToegangsmailTaal, Sjabloon> = {
  nl: {
    onderwerp: "Je persoonlijke toegang tot TaPas",
    hallo: (naam) => `Beste ${naam},`,
    halloZonderNaam: "Beste,",
    inleiding: (instrument) =>
      `Je hebt ${instrument} ingevuld. Hieronder staat je persoonlijke toegang tot je resultaten.`,
    inleidingZonderInstrument:
      "Je vragenlijst is afgerond. Hieronder staat je persoonlijke toegang tot je resultaten.",
    linkLabel: "Je persoonlijke link:",
    codeLabel: "Je toegangscode:",
    bewaar:
      "Bewaar dit bericht. De link en de code samen geven toegang tot je resultaten; deel ze met niemand anders.",
    groet: "Met vriendelijke groet,\nTaPasCity",
  },
  fr: {
    onderwerp: "Votre accès personnel à TaPas",
    hallo: (naam) => `Bonjour ${naam},`,
    halloZonderNaam: "Bonjour,",
    inleiding: (instrument) =>
      `Vous avez complété ${instrument}. Voici votre accès personnel à vos résultats.`,
    inleidingZonderInstrument:
      "Votre questionnaire est terminé. Voici votre accès personnel à vos résultats.",
    linkLabel: "Votre lien personnel :",
    codeLabel: "Votre code d'accès :",
    bewaar:
      "Conservez ce message. Le lien et le code donnent ensemble accès à vos résultats ; ne les partagez avec personne.",
    groet: "Cordialement,\nTaPasCity",
  },
  en: {
    onderwerp: "Your personal access to TaPas",
    hallo: (naam) => `Dear ${naam},`,
    halloZonderNaam: "Hello,",
    inleiding: (instrument) =>
      `You completed ${instrument}. Below is your personal access to your results.`,
    inleidingZonderInstrument:
      "Your questionnaire is complete. Below is your personal access to your results.",
    linkLabel: "Your personal link:",
    codeLabel: "Your access code:",
    bewaar:
      "Please keep this message. Together, the link and the code give access to your results; do not share them with anyone.",
    groet: "Kind regards,\nTaPasCity",
  },
  es: {
    onderwerp: "Tu acceso personal a TaPas",
    hallo: (naam) => `Hola ${naam}:`,
    halloZonderNaam: "Hola:",
    inleiding: (instrument) =>
      `Has completado ${instrument}. A continuación encontrarás tu acceso personal a tus resultados.`,
    inleidingZonderInstrument:
      "Tu cuestionario ha finalizado. A continuación encontrarás tu acceso personal a tus resultados.",
    linkLabel: "Tu enlace personal:",
    codeLabel: "Tu código de acceso:",
    bewaar:
      "Guarda este mensaje. El enlace y el código juntos dan acceso a tus resultados; no los compartas con nadie.",
    groet: "Un cordial saludo,\nTaPasCity",
  },
  ru: {
    onderwerp: "Ваш личный доступ к TaPas",
    hallo: (naam) => `Здравствуйте, ${naam}!`,
    halloZonderNaam: "Здравствуйте!",
    inleiding: (instrument) =>
      `Вы заполнили ${instrument}. Ниже указан ваш личный доступ к результатам.`,
    inleidingZonderInstrument:
      "Ваша анкета завершена. Ниже указан ваш личный доступ к результатам.",
    linkLabel: "Ваша личная ссылка:",
    codeLabel: "Ваш код доступа:",
    bewaar:
      "Сохраните это письмо. Ссылка и код вместе открывают доступ к вашим результатам; не передавайте их никому.",
    groet: "С уважением,\nTaPasCity",
  },
};

function kiesTaal(taal: string): ToegangsmailTaal {
  const kort = String(taal ?? "").trim().slice(0, 2).toLowerCase();
  return (TOEGANGSMAIL_TALEN as readonly string[]).includes(kort)
    ? (kort as ToegangsmailTaal)
    : "nl";
}

/**
 * Bouwt onderwerp en tekst van de toegangsmail. Zuivere functie: geen databank,
 * geen netwerk. Laat nooit een plaatshouder in de tekst achter.
 */
export function bouwToegangsmail(input: ToegangsmailInput): Toegangsmail {
  const s = SJABLONEN[kiesTaal(input.taal)];
  const naam = String(input.naam ?? "").trim();
  const instrument = String(input.instrument ?? "").trim();
  const link = String(input.link ?? "").trim();
  const code = String(input.code ?? "").trim();

  const regels = [
    naam ? s.hallo(naam) : s.halloZonderNaam,
    "",
    instrument ? s.inleiding(instrument) : s.inleidingZonderInstrument,
    "",
    s.linkLabel,
    link,
    "",
    s.codeLabel,
    code,
    "",
    s.bewaar,
    "",
    s.groet,
  ];

  return { onderwerp: s.onderwerp, tekst: regels.join("\n") };
}
