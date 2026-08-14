/**
 * Wie wat mag, in de module Bekwaamheid.
 *
 * Dit is de enige plaats in de codebasis waar de vraag "mag deze persoon met dit
 * instrument een afname doen?" wordt beantwoord. Er komt nergens een tweede
 * berekening. Wie ergens een poort wil, roept `magAfnemen` aan.
 *
 * Zuivere functies, in dezelfde stijl als `server/traject/rechten.ts`: geen
 * databank, geen express, geen opslaglaag. Deze module leest alleen wat ze
 * meekrijgt en rekent. Ze logt zelf niets — de laag erboven maakt van een
 * geweigerde poging een auditregel.
 *
 * Twee dingen die deze module bewust niet weet.
 *
 * Ze kent het begrip alert niet. Een openstaande alert uit een tussentijdse
 * toets verandert het afnamerecht niet. Dat is geen vergetelheid maar de
 * afbakening: `alertActief` staat in de licentietabel, maar komt in dit bestand
 * niet voor, zodat een latere wijziging aan de tussentijdse toets de poort niet
 * per ongeluk kan dichtzetten.
 *
 * Ze kent het begrip meetbeoordelaar-als-rol niet. Beoordelen is een vlag op de
 * persoon plus een rechtenregel, geen achtste rol in het systeem. De reden staat
 * bij `magBeoordelen`.
 */

import {
  STATUSSEN_MET_AFNAMERECHT,
  type Licentiestatus,
} from "./schema";

/**
 * De stand van de poort.
 *
 * `log` betekent: de uitkomst wordt vastgelegd, maar er wordt niets geweigerd.
 * Dat is de stand waarin de poort in productie gaat en blijft tot de nulmeting
 * rond is én de opzegtermijn van twaalf maanden verstreken is. Een poort die
 * weigert voordat iemand een eerlijke kans heeft gehad om erdoor te komen, is
 * een contractbreuk in code.
 */
export const POORTSTANDEN = ["uit", "log", "handhaaf"] as const;
export type Poortstand = (typeof POORTSTANDEN)[number];

/** Leest de stand uit de omgeving; standaard `log`. */
export function poortstandUitOmgeving(
  omgeving: Record<string, string | undefined> = process.env,
): Poortstand {
  const waarde = omgeving.BEKWAAMHEID_POORT;
  return (POORTSTANDEN as readonly string[]).includes(waarde ?? "")
    ? (waarde as Poortstand)
    : "log";
}

/**
 * Wat de poort van een licentie moet weten.
 *
 * Uitdrukkelijk niet de hele rij: hoe minder deze module ziet, hoe kleiner de
 * kans dat er ooit een veld in de beslissing sluipt dat er niet in hoort.
 */
export interface LicentieVoorPoort {
  instrumentId: string;
  status: Licentiestatus;
  geldigVan: string;
  /** Leeg betekent onbepaald; dat komt alleen voor tijdens de overgangsperiode. */
  geldigTot: string | null;
}

export type Weigergrond =
  | "geen_licentie"
  | "status_zonder_afnamerecht"
  | "nog_niet_geldig"
  | "verlopen";

export interface Poortuitspraak {
  toegestaan: boolean;
  grond: Weigergrond | null;
  /** Wat er zou gebeuren bij `handhaaf`, ook wanneer de stand `log` is. */
  zouWeigeren: boolean;
  /** Leesbare reden, bedoeld voor het auditspoor en het scherm. */
  toelichting: string;
}

/**
 * De poort.
 *
 * De uitspraak wordt altijd volledig berekend, ook wanneer de stand `log` of
 * `uit` is. Dat is het hele punt van een schaduwstand: je wil precies weten wat
 * er zou gebeuren, zonder dat het gebeurt. `toegestaan` volgt de stand,
 * `zouWeigeren` volgt de regels.
 */
export function magAfnemen(invoer: {
  licentie: LicentieVoorPoort | null;
  instrumentId: string;
  peildatum: string;
  stand?: Poortstand;
}): Poortuitspraak {
  const stand = invoer.stand ?? poortstandUitOmgeving();
  const dag = invoer.peildatum.slice(0, 10);

  const uitspraak = (grond: Weigergrond | null, toelichting: string): Poortuitspraak => {
    const zouWeigeren = grond !== null;
    return {
      // Bij `handhaaf` bindt de regel; bij `log` en `uit` niet.
      toegestaan: stand === "handhaaf" ? !zouWeigeren : true,
      grond,
      zouWeigeren,
      toelichting,
    };
  };

  if (!invoer.licentie) {
    return uitspraak(
      "geen_licentie",
      `Geen licentie gevonden voor instrument ${invoer.instrumentId}.`,
    );
  }
  const { licentie } = invoer;
  if (licentie.instrumentId !== invoer.instrumentId) {
    return uitspraak(
      "geen_licentie",
      `De aangeboden licentie geldt voor ${licentie.instrumentId}, niet voor ${invoer.instrumentId}.`,
    );
  }
  if (!STATUSSEN_MET_AFNAMERECHT.includes(licentie.status)) {
    return uitspraak(
      "status_zonder_afnamerecht",
      `Status ${licentie.status} geeft geen afnamerecht.`,
    );
  }
  if (dag < licentie.geldigVan.slice(0, 10)) {
    return uitspraak("nog_niet_geldig", `De licentie geldt pas vanaf ${licentie.geldigVan}.`);
  }
  // Een lege einddatum verloopt niet. Dat is uitsluitend de overgangsperiode.
  if (licentie.geldigTot !== null && dag > licentie.geldigTot.slice(0, 10)) {
    return uitspraak("verlopen", `De licentie liep tot ${licentie.geldigTot}.`);
  }
  return uitspraak(null, `Licentie ${licentie.status}, geldig op ${dag}.`);
}

/**
 * Wie een bewijsstuk mag beoordelen.
 *
 * Beoordelen is een vlag op de persoon plus deze regel, en geen nieuwe rol in
 * het systeem. Reden: een achtste rol raakt de rollenmatrix, de menu's, de
 * rechtenafleiding en elke test die de rollen opsomt. De inhoudelijke eis is
 * eenvoudig genoeg om zonder rol te formuleren — wie beoordeelt, moet zelf
 * bekrachtigd zijn voor dit instrument en mag de beoordeelde niet zijn.
 *
 * De onafhankelijkheidseis van de bekrachtigers staat niet hier maar in de
 * opslaglaag: die heeft de beoordelaars van de ronde nodig en is dus niet zuiver
 * te formuleren met alleen deze gegevens. Wat hier wél staat, is de regel die
 * niemand mag omzeilen.
 */
export function magBeoordelen(invoer: {
  beoordelaarGeaccrediteerdeId: number;
  beoordeeldeGeaccrediteerdeId: number;
  isBeoordelaarVlag: boolean;
  licentieVanBeoordelaar: LicentieVoorPoort | null;
  instrumentId: string;
  peildatum: string;
}): { toegestaan: boolean; toelichting: string } {
  if (!invoer.isBeoordelaarVlag) {
    return { toegestaan: false, toelichting: "Persoon is niet aangeduid als beoordelaar." };
  }
  if (invoer.beoordelaarGeaccrediteerdeId === invoer.beoordeeldeGeaccrediteerdeId) {
    return { toegestaan: false, toelichting: "Niemand beoordeelt zijn eigen ronde." };
  }
  // Voor het beoordelen geldt de strenge lezing: de schaduwstand van de poort
  // mag hier niet doorwerken, want dit is geen productiehandeling van een
  // deelnemer maar een bevoegdheid binnen de beoordeling zelf.
  const eigen = magAfnemen({
    licentie: invoer.licentieVanBeoordelaar,
    instrumentId: invoer.instrumentId,
    peildatum: invoer.peildatum,
    stand: "handhaaf",
  });
  if (!eigen.toegestaan) {
    return {
      toegestaan: false,
      toelichting: `Beoordelaar heeft zelf geen geldige licentie: ${eigen.toelichting}`,
    };
  }
  return { toegestaan: true, toelichting: "Beoordelaar is bevoegd voor deze ronde." };
}
