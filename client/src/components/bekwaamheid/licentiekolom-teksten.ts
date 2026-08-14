/**
 * De teksten van de kolom "licentie" op `/admin/toegang`, in vijf talen.
 *
 * Waarom dit bestand bestaat en de teksten niet in `shared/i18n.ts` staan. Het
 * scherm `/admin/toegang` is vijftalig en dat mag niet halveren omdat er een
 * kolom bij komt: één Nederlandse regel tussen vijf vertaalde regels is een
 * regressie die niemand opmerkt tot een Franstalige beheerder ernaar kijkt. De
 * teksten horen dus vertaald te zijn. Ze staan hier en niet in de gedeelde
 * woordenlijst omdat deze bouwronde een harde grens heeft op het aantal
 * bestaande bestanden dat mag wijzigen, en `shared/i18n.ts` valt daarbuiten.
 *
 * Dat is uitdrukkelijk een tijdelijke plaatsing. Bij de volgende ronde waarin
 * `shared/i18n.ts` open mag, horen deze sleutels daar naartoe te verhuizen, met
 * het prefix `lk_`. Zolang ze hier staan, gelden dezelfde regels: elke sleutel
 * in alle vijf de talen, geen sleutel zonder vertaling.
 *
 * De statusnamen worden bewust niet vertaald. `bekrachtigd_met_aandachtspunt` is
 * een term uit het draaiboek en staat zo in de databank, in het auditspoor en in
 * de beslisdocumenten. Wie hem in vijf varianten vertaalt, maakt het onmogelijk
 * om een scherm en een auditregel naast elkaar te leggen. Wat wél vertaald wordt,
 * is alles eromheen: de kop, de standen en de uitleg.
 */

import type { Taal } from "@shared/i18n";

type Woordenlijst = Record<string, string>;

const NL: Woordenlijst = {
  kop: "Licentie",
  uitleg:
    "Toegang heeft twee voorwaarden. De schakelaar opent het platformdeel; de licentie geeft het recht om er een afname mee te doen. Beide moeten kloppen.",
  buiten_het_register: "Niet in het register",
  geen_licenties: "Geen licentie",
  in_orde: "Licentie in orde",
  let_op: "Licentie: let op",
  geen_afnamerecht: "Geen afnamerecht",
  geen_licentie_voor_deel: "Geen licentie voor dit deel",
  geen_instrument: "Geen instrument achter dit deel",
  recht: "afnamerecht",
  geen_recht: "geen afnamerecht",
  peildatum: "Peildatum",
  laden: "Licentiebeeld wordt opgehaald…",
  mislukt: "Het licentiebeeld kon niet worden opgehaald. De schakelaars werken wel.",
  alert_open: "alert open",
  voorwaarde_open: "voorwaarde open",
  verloopt: "verloopt",
};

const FR: Woordenlijst = {
  kop: "Licence",
  uitleg:
    "L'accès a deux conditions. Le commutateur ouvre le module ; la licence donne le droit d'y réaliser une passation. Les deux doivent être en ordre.",
  buiten_het_register: "Pas au registre",
  geen_licenties: "Aucune licence",
  in_orde: "Licence en ordre",
  let_op: "Licence : attention",
  geen_afnamerecht: "Pas de droit de passation",
  geen_licentie_voor_deel: "Aucune licence pour ce module",
  geen_instrument: "Aucun instrument derrière ce module",
  recht: "droit de passation",
  geen_recht: "pas de droit de passation",
  peildatum: "Date de référence",
  laden: "Chargement de l'état des licences…",
  mislukt: "L'état des licences n'a pu être chargé. Les commutateurs fonctionnent.",
  alert_open: "alerte ouverte",
  voorwaarde_open: "condition ouverte",
  verloopt: "expire le",
};

const EN: Woordenlijst = {
  kop: "Licence",
  uitleg:
    "Access has two conditions. The switch opens the platform module; the licence grants the right to administer with it. Both must hold.",
  buiten_het_register: "Not in the register",
  geen_licenties: "No licence",
  in_orde: "Licence in order",
  let_op: "Licence: attention",
  geen_afnamerecht: "No right to administer",
  geen_licentie_voor_deel: "No licence for this module",
  geen_instrument: "No instrument behind this module",
  recht: "may administer",
  geen_recht: "may not administer",
  peildatum: "Reference date",
  laden: "Loading licence status…",
  mislukt: "The licence status could not be loaded. The switches still work.",
  alert_open: "alert open",
  voorwaarde_open: "condition open",
  verloopt: "expires",
};

const ES: Woordenlijst = {
  kop: "Licencia",
  uitleg:
    "El acceso tiene dos condiciones. El interruptor abre el módulo; la licencia otorga el derecho a realizar una aplicación. Ambas deben cumplirse.",
  buiten_het_register: "No está en el registro",
  geen_licenties: "Sin licencia",
  in_orde: "Licencia en orden",
  let_op: "Licencia: atención",
  geen_afnamerecht: "Sin derecho de aplicación",
  geen_licentie_voor_deel: "Sin licencia para este módulo",
  geen_instrument: "Sin instrumento detrás de este módulo",
  recht: "derecho de aplicación",
  geen_recht: "sin derecho de aplicación",
  peildatum: "Fecha de referencia",
  laden: "Cargando el estado de las licencias…",
  mislukt: "No se pudo cargar el estado de las licencias. Los interruptores funcionan.",
  alert_open: "alerta abierta",
  voorwaarde_open: "condición abierta",
  verloopt: "vence el",
};

const RU: Woordenlijst = {
  kop: "Лицензия",
  uitleg:
    "У доступа два условия. Переключатель открывает модуль платформы; лицензия даёт право проводить с ним обследование. Оба условия должны быть выполнены.",
  buiten_het_register: "Нет в реестре",
  geen_licenties: "Лицензии нет",
  in_orde: "Лицензия в порядке",
  let_op: "Лицензия: внимание",
  geen_afnamerecht: "Нет права проведения",
  geen_licentie_voor_deel: "Нет лицензии для этого модуля",
  geen_instrument: "За этим модулем нет инструмента",
  recht: "право проведения",
  geen_recht: "нет права проведения",
  peildatum: "Дата отсчёта",
  laden: "Загрузка состояния лицензий…",
  mislukt: "Не удалось загрузить состояние лицензий. Переключатели работают.",
  alert_open: "открытое предупреждение",
  voorwaarde_open: "открытое условие",
  verloopt: "истекает",
};

const WOORDEN: Record<Taal, Woordenlijst> = { nl: NL, fr: FR, en: EN, es: ES, ru: RU };

/**
 * Maakt een vertaler voor deze kolom.
 *
 * Valt terug op het Nederlands en niet op de sleutel zelf: een scherm dat
 * `geen_afnamerecht` laat lezen in plaats van een zin, is erger dan een scherm
 * dat één regel in het Nederlands laat lezen.
 */
export function maakKolomVertaler(taal: Taal): (sleutel: keyof typeof NL) => string {
  const lijst = WOORDEN[taal] ?? NL;
  return (sleutel) => lijst[sleutel] ?? NL[sleutel] ?? String(sleutel);
}

/** Voor de test die bewaakt dat er geen sleutel zonder vertaling bestaat. */
export const KOLOM_SLEUTELS = Object.keys(NL) as ReadonlyArray<keyof typeof NL>;
export const KOLOM_WOORDEN = WOORDEN;
