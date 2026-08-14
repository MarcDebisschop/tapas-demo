/**
 * De teksten van de poort, in de vijf platformtalen.
 *
 * Apart van `poort.ts` gehouden, en met opzet. De poort beslist; dit bestand
 * spreekt. Wie een tekst wil bijschaven hoeft dan nooit aan de beslissing te
 * raken, en wie de beslissing herziet hoeft geen vijf vertalingen te lezen.
 *
 * Sectie 7.2 van het bouwplan stelt één eis aan elke tekst: geen enkele
 * weigering eindigt doodlopend. Daarom heeft elke grond naast een tekst ook een
 * `watNu` — een handeling en een plaats waar die handeling kan. Waar er niets te
 * doen is voor de betrokkene zelf, staat er een contactweg. Nooit niets.
 *
 * De codebasis toetst dit soort teksten in `tests/foutmelding-zegt-wat-er-is.test.ts`:
 * een foutmelding moet zeggen wat er is, niet dat er iets is.
 */

import { TALEN, type Taal } from "@shared/talen";

/**
 * Waarom de poort tot haar uitspraak kwam.
 *
 * De eerste groep bijt: dit zijn de gronden waarop de poort in stand `handhaaf`
 * een nieuwe afname weigert. De tweede groep bijt nooit — ze staat er omdat
 * sectie 7.3 eist dat de poort niet stil faalt. Een uitkomst zonder grond is
 * geen uitkomst; ook "hier ga ik niet over" wordt vastgelegd.
 */
export const WEIGERENDE_GRONDEN = [
  "geen_licentie",
  "status_zonder_afnamerecht",
  "nog_niet_geldig",
  "verlopen",
  "platformdeel_geblokkeerd",
  "afnemer_niet_herleidbaar",
  "instrument_onbekend",
  "niet_in_register",
] as const;

export const NIET_WEIGERENDE_GRONDEN = [
  "bevoegd",
  "zelfstart_buiten_licentiekader",
  "bezwaar_loopt",
  "handeling_valt_buiten_de_poort",
] as const;

export type WeigerendeGrond = (typeof WEIGERENDE_GRONDEN)[number];
export type NietWeigerendeGrond = (typeof NIET_WEIGERENDE_GRONDEN)[number];
export type Poortgrond = WeigerendeGrond | NietWeigerendeGrond;

export const POORTGRONDEN: readonly Poortgrond[] = [
  ...WEIGERENDE_GRONDEN,
  ...NIET_WEIGERENDE_GRONDEN,
];

export function isWeigerendeGrond(grond: Poortgrond): grond is WeigerendeGrond {
  return (WEIGERENDE_GRONDEN as readonly string[]).includes(grond);
}

export interface WatNu {
  /** Machineleesbare handeling, voor knoppen en voor de meting. */
  actie: string;
  /** Waar die handeling kan. Leeg wanneer alleen contact overblijft. */
  url: string | null;
}

export interface Poorttekst {
  tekst: Record<Taal, string>;
  watNu: WatNu;
}

/**
 * De plaats waar `{contact}` in een tekst door het echte contactadres wordt
 * vervangen. Zie `contactadres()` onderaan.
 *
 * Het adres staat met opzet niet in dit bestand. `tests/bekwaamheid-geen-namenlijst.test.ts`
 * eist dat de hele module Bekwaamheid vrij blijft van adressen, en die eis is
 * juist: een adres in de broncode veroudert, staat in vijf vertalingen dubbel, en
 * is niet per omgeving te zetten. De teksten dragen daarom een gaatje en de
 * lezer vult het.
 */
const CONTACT = "{contact}";

/** Waar de geaccrediteerde zijn eigen licenties ziet. */
const EIGEN_OVERZICHT = "/coach/bekwaamheid";

export const POORTTEKSTEN: Record<Poortgrond, Poorttekst> = {
  geen_licentie: {
    watNu: { actie: "licentie_aanvragen", url: EIGEN_OVERZICHT },
    tekst: {
      nl: "Voor dit instrument staat er geen licentie op je naam. Dat kan twee dingen betekenen: je hebt de opleiding nog niet afgerond, of je licentie is nooit geregistreerd. Het tweede komt voor en is snel opgelost.",
      fr: "Aucune licence n'est enregistrée à votre nom pour cet instrument. Deux explications sont possibles : la formation n'est pas encore terminée, ou la licence n'a jamais été enregistrée. Le second cas se produit et se règle rapidement.",
      en: "No licence for this instrument is registered in your name. That can mean two things: you have not yet completed the training, or your licence was never recorded. The second happens and is quickly fixed.",
      es: "No hay ninguna licencia registrada a su nombre para este instrumento. Puede significar dos cosas: aún no ha terminado la formación, o su licencia nunca se registró. Lo segundo ocurre y se resuelve rápido.",
      ru: "На ваше имя нет лицензии на этот инструмент. Это может означать две вещи: обучение ещё не завершено или лицензия не была зарегистрирована. Второе бывает и решается быстро.",
    },
  },
  status_zonder_afnamerecht: {
    watNu: { actie: "status_bekijken", url: EIGEN_OVERZICHT },
    tekst: {
      nl: "Je licentie voor dit instrument staat op een stand die geen nieuwe afnames toelaat. Dat is geen oordeel over je werk en het raakt niets van wat je eerder deed: je bestaande dossiers en rapporten blijven volledig beschikbaar. Op je eigen overzicht staat welke stap de stand opheft.",
      fr: "Votre licence pour cet instrument se trouve dans un état qui n'autorise pas de nouvelles administrations. Ce n'est pas un jugement sur votre travail et cela ne touche rien de ce que vous avez fait auparavant : vos dossiers et rapports existants restent entièrement accessibles. Votre aperçu personnel indique l'étape qui lève cet état.",
      en: "Your licence for this instrument is in a state that does not allow new administrations. This is not a judgement on your work, and it touches nothing you did before: your existing files and reports remain fully available. Your own overview shows which step lifts it.",
      es: "Su licencia para este instrumento está en un estado que no permite nuevas administraciones. No es un juicio sobre su trabajo y no afecta nada de lo que hizo antes: sus expedientes e informes siguen totalmente disponibles. Su resumen personal indica el paso que lo levanta.",
      ru: "Ваша лицензия на этот инструмент находится в состоянии, которое не допускает новых сессий. Это не оценка вашей работы и не затрагивает сделанное ранее: ваши материалы и отчёты остаются полностью доступными. В личном обзоре указан шаг, который снимает это состояние.",
    },
  },
  nog_niet_geldig: {
    watNu: { actie: "ingangsdatum_bekijken", url: EIGEN_OVERZICHT },
    tekst: {
      nl: "Je licentie voor dit instrument is geregistreerd, maar de ingangsdatum ligt nog in de toekomst. Vanaf die dag werkt alles zonder verdere stap.",
      fr: "Votre licence pour cet instrument est enregistrée, mais sa date d'entrée en vigueur est encore à venir. À partir de ce jour, tout fonctionne sans autre démarche.",
      en: "Your licence for this instrument is registered, but its start date is still in the future. From that day everything works without any further step.",
      es: "Su licencia para este instrumento está registrada, pero su fecha de inicio aún está en el futuro. A partir de ese día todo funciona sin ningún paso adicional.",
      ru: "Ваша лицензия на этот инструмент зарегистрирована, но дата начала действия ещё не наступила. С этого дня всё работает без дополнительных действий.",
    },
  },
  verlopen: {
    watNu: { actie: "hercertificering_starten", url: EIGEN_OVERZICHT },
    tekst: {
      nl: "Je licentie voor dit instrument is verlopen. De licentiecyclus duurt twee jaar; na die termijn volgt een nieuwe bekrachtiging. Je eerdere dossiers blijven onaangetast en je kan de cyclus meteen opnieuw starten.",
      fr: "Votre licence pour cet instrument a expiré. Le cycle de licence dure deux ans ; à son terme suit une nouvelle validation. Vos dossiers antérieurs restent intacts et vous pouvez relancer le cycle immédiatement.",
      en: "Your licence for this instrument has expired. The licence cycle runs for two years; after that term a new confirmation follows. Your earlier files remain untouched and you can start the cycle again right away.",
      es: "Su licencia para este instrumento ha caducado. El ciclo de licencia dura dos años; tras ese plazo sigue una nueva ratificación. Sus expedientes anteriores permanecen intactos y puede reiniciar el ciclo de inmediato.",
      ru: "Срок вашей лицензии на этот инструмент истёк. Лицензионный цикл длится два года; после этого следует новое подтверждение. Ваши прежние материалы не затронуты, и цикл можно начать заново сразу.",
    },
  },
  platformdeel_geblokkeerd: {
    watNu: { actie: "toegang_aanvragen", url: null },
    tekst: {
      nl: `Dit onderdeel van het platform staat voor jouw account niet open. Dat is een toegangsinstelling en geen licentiekwestie: je licentie kan volledig in orde zijn. Een beheerder kan dit in één stap wijzigen — vraag het aan via ${CONTACT}.`,
      fr: `Cette partie de la plateforme n'est pas ouverte à votre compte. Il s'agit d'un réglage d'accès et non d'une question de licence : votre licence peut être parfaitement en ordre. Un administrateur peut le modifier en une étape — demandez-le à ${CONTACT}.`,
      en: `This part of the platform is not open to your account. That is an access setting, not a licence matter: your licence may be entirely in order. An administrator can change it in one step — request it at ${CONTACT}.`,
      es: `Esta parte de la plataforma no está abierta para su cuenta. Es un ajuste de acceso y no una cuestión de licencia: su licencia puede estar perfectamente en orden. Un administrador puede cambiarlo en un paso — solicítelo en ${CONTACT}.`,
      ru: `Этот раздел платформы недоступен для вашей учётной записи. Это настройка доступа, а не вопрос лицензии: ваша лицензия может быть полностью в порядке. Администратор может изменить это в один шаг — напишите на ${CONTACT}.`,
    },
  },
  afnemer_niet_herleidbaar: {
    watNu: { actie: "aanmelden_als_persoon", url: "/login" },
    tekst: {
      nl: "Deze aanvraag komt van een organisatieaccount, niet van een persoon. Een licentie staat altijd op naam van iemand, dus valt er hier niets te toetsen. Meld je aan met je persoonlijke account en de aanvraag gaat gewoon door.",
      fr: "Cette demande provient d'un compte d'organisation et non d'une personne. Une licence est toujours nominative, il n'y a donc rien à vérifier ici. Connectez-vous avec votre compte personnel et la demande aboutira normalement.",
      en: "This request comes from an organisation account, not from a person. A licence is always held by an individual, so there is nothing here to check. Sign in with your personal account and the request goes through normally.",
      es: "Esta solicitud proviene de una cuenta de organización, no de una persona. Una licencia siempre es nominal, por lo que aquí no hay nada que comprobar. Inicie sesión con su cuenta personal y la solicitud continuará con normalidad.",
      ru: "Этот запрос поступил от учётной записи организации, а не от человека. Лицензия всегда оформляется на имя конкретного лица, поэтому проверять здесь нечего. Войдите под личной учётной записью, и запрос пройдёт обычным образом.",
    },
  },
  instrument_onbekend: {
    watNu: { actie: "instrument_kiezen", url: null },
    tekst: {
      nl: `Bij deze aanvraag staat geen instrument. Zonder instrument valt niet vast te stellen welke licentie erbij hoort, en de poort vult dat niet zelf in. Kies het instrument uitdrukkelijk en probeer opnieuw. Blijft het misgaan, dan zit de fout niet bij jou — meld het via ${CONTACT}.`,
      fr: `Aucun instrument n'est indiqué dans cette demande. Sans instrument, impossible de déterminer la licence correspondante, et le contrôle ne le devine pas. Choisissez l'instrument explicitement et réessayez. Si le problème persiste, l'erreur ne vient pas de vous — signalez-le à ${CONTACT}.`,
      en: `This request carries no instrument. Without one there is no way to tell which licence applies, and the gate does not fill that in by itself. Choose the instrument explicitly and try again. If it keeps failing, the fault is not yours — report it at ${CONTACT}.`,
      es: `Esta solicitud no indica ningún instrumento. Sin instrumento no se puede determinar qué licencia corresponde, y el control no lo deduce por su cuenta. Elija el instrumento explícitamente e inténtelo de nuevo. Si sigue fallando, el error no es suyo — comuníquelo a ${CONTACT}.`,
      ru: `В этом запросе не указан инструмент. Без него невозможно определить нужную лицензию, и проверка не подставляет его сама. Укажите инструмент явно и повторите попытку. Если ошибка сохраняется, вина не ваша — сообщите на ${CONTACT}.`,
    },
  },
  niet_in_register: {
    watNu: { actie: "opname_in_register_aanvragen", url: null },
    tekst: {
      nl: `Je account is bekend, maar staat niet in het register van geaccrediteerden. Zolang die koppeling ontbreekt is er geen licentie om te toetsen. Dit is administratief en niet inhoudelijk — meld het via ${CONTACT} en het wordt rechtgezet.`,
      fr: `Votre compte est connu, mais il ne figure pas au registre des personnes accréditées. Tant que ce lien manque, il n'y a aucune licence à vérifier. C'est administratif et non substantiel — signalez-le à ${CONTACT} et ce sera corrigé.`,
      en: `Your account is known, but it does not appear in the register of accredited practitioners. As long as that link is missing there is no licence to check. This is administrative rather than substantive — report it at ${CONTACT} and it will be put right.`,
      es: `Su cuenta es conocida, pero no figura en el registro de personas acreditadas. Mientras falte ese vínculo no hay licencia que comprobar. Es administrativo y no de fondo — comuníquelo a ${CONTACT} y se corregirá.`,
      ru: `Ваша учётная запись известна, но отсутствует в реестре аккредитованных специалистов. Пока эта связь не установлена, проверять лицензию нечего. Это административный, а не содержательный вопрос — сообщите на ${CONTACT}, и это будет исправлено.`,
    },
  },

  // --- Gronden die nooit weigeren ------------------------------------------
  bevoegd: {
    watNu: { actie: "geen", url: null },
    tekst: {
      nl: "Je licentie voor dit instrument is in orde op deze datum en het platformdeel staat open.",
      fr: "Votre licence pour cet instrument est en ordre à cette date et la partie de plateforme est ouverte.",
      en: "Your licence for this instrument is in order on this date and the platform part is open.",
      es: "Su licencia para este instrumento está en orden en esta fecha y la parte de la plataforma está abierta.",
      ru: "Ваша лицензия на этот инструмент действительна на эту дату, и раздел платформы открыт.",
    },
  },
  zelfstart_buiten_licentiekader: {
    watNu: { actie: "geen", url: null },
    tekst: {
      nl: "Deze afname is door de deelnemer zelf gestart, zonder tussenkomst van een professional. Er is dus geen afnemer en het licentiekader is hier niet van toepassing. De poort laat dit door en legt het vast.",
      fr: "Cette administration a été lancée par le participant lui-même, sans l'intervention d'un professionnel. Il n'y a donc pas d'administrateur et le cadre de licence ne s'applique pas ici. Le contrôle laisse passer et l'enregistre.",
      en: "This administration was started by the participant themselves, without a professional involved. There is therefore no practitioner, and the licence framework does not apply here. The gate lets it through and records it.",
      es: "Esta administración la inició el propio participante, sin intervención de un profesional. Por tanto no hay administrador y el marco de licencia no se aplica aquí. El control lo permite y lo registra.",
      ru: "Эту сессию начал сам участник, без участия специалиста. Следовательно, администратора нет, и лицензионные требования здесь не применяются. Проверка пропускает это и фиксирует.",
    },
  },
  bezwaar_loopt: {
    watNu: { actie: "geen", url: EIGEN_OVERZICHT },
    tekst: {
      nl: "Er loopt een bezwaar over je licentie. Zolang dat bezwaar niet is afgerond blijft je situatie ongewijzigd en weigert de poort niets. Dat is een uitdrukkelijke belofte uit het draaiboek en geen tijdelijke welwillendheid.",
      fr: "Une réclamation concernant votre licence est en cours. Tant qu'elle n'est pas clôturée, votre situation reste inchangée et le contrôle ne refuse rien. C'est une promesse explicite du manuel de procédure et non une tolérance passagère.",
      en: "An appeal concerning your licence is pending. For as long as it is open your situation stays unchanged and the gate refuses nothing. That is an explicit promise from the procedure manual, not a temporary courtesy.",
      es: "Hay una reclamación pendiente sobre su licencia. Mientras no se cierre, su situación permanece igual y el control no rechaza nada. Es una promesa explícita del manual de procedimiento y no una tolerancia pasajera.",
      ru: "По вашей лицензии рассматривается возражение. Пока оно не закрыто, ваша ситуация не меняется, и проверка ничего не отклоняет. Это прямое обязательство из регламента, а не временная любезность.",
    },
  },
  handeling_valt_buiten_de_poort: {
    watNu: { actie: "geen", url: null },
    tekst: {
      nl: "Deze handeling valt buiten het bereik van de poort. De poort gaat uitsluitend over het aanmaken van nieuwe afnames en uitnodigingen. Een afname voortzetten, een rapport openen of historiek inzien wordt nooit geweigerd.",
      fr: "Cette action ne relève pas du contrôle. Le contrôle porte uniquement sur la création de nouvelles administrations et invitations. Poursuivre une administration, ouvrir un rapport ou consulter l'historique n'est jamais refusé.",
      en: "This action falls outside the gate's reach. The gate covers only the creation of new administrations and invitations. Continuing an administration, opening a report or viewing history is never refused.",
      es: "Esta acción queda fuera del alcance del control. El control abarca únicamente la creación de nuevas administraciones e invitaciones. Continuar una administración, abrir un informe o consultar el historial nunca se rechaza.",
      ru: "Это действие вне сферы проверки. Проверка касается только создания новых сессий и приглашений. Продолжение сессии, открытие отчёта или просмотр истории никогда не отклоняются.",
    },
  },
};

/**
 * Het contactadres van de licentieverstrekker.
 *
 * Uit de omgeving, want het hoort niet in de broncode en het verschilt per
 * omgeving. Is er niets gezet, dan komt er geen half adres in de tekst maar een
 * omschrijving: liever „de beheerder van je organisatie” dan een adres dat niet
 * bestaat. Zo blijft de belofte van sectie 7.2 overeind — nooit doodlopend —
 * ook wanneer de omgevingsvariabele vergeten is.
 */
export function contactadres(
  omgeving: Record<string, string | undefined> = process.env,
): string {
  const gezet = (omgeving.BEKWAAMHEID_CONTACT ?? "").trim();
  return gezet.length > 0 ? gezet : "de beheerder van je organisatie";
}

/** De letterlijke plaatshouder die `poorttekst` vervangt. */
export const CONTACT_PLAATSHOUDER = "{contact}";

/**
 * De tekst voor een grond in één taal, met terugval op Nederlands.
 *
 * Vult onderweg de plaatshouder in. Wie de ruwe tekst wil, leest `POORTTEKSTEN`
 * rechtstreeks — dat doet de test die de vijf talen nagaat.
 */
export function poorttekst(
  grond: Poortgrond,
  taal: Taal,
  omgeving: Record<string, string | undefined> = process.env,
): string {
  const blok = POORTTEKSTEN[grond];
  const ruw = blok.tekst[taal] ?? blok.tekst.nl;
  return ruw.split(CONTACT_PLAATSHOUDER).join(contactadres(omgeving));
}

/** Heeft deze grond een contactweg in de tekst zelf? Voor de test. */
export function heeftContactweg(grond: Poortgrond): boolean {
  return POORTTEKSTEN[grond].tekst.nl.includes(CONTACT_PLAATSHOUDER);
}

/** Alle talen zijn gevuld. Bewaakt door een test; hier voor de zekerheid. */
export function talenVolledig(grond: Poortgrond): boolean {
  const blok = POORTTEKSTEN[grond];
  return TALEN.every((t) => typeof blok.tekst[t] === "string" && blok.tekst[t].trim().length > 0);
}
