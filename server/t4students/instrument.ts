// ---------------------------------------------------------------------------
// server/t4students/instrument.ts
//
// De ene plaats waar het T4Students-studiekompas als instrumentgegeven het
// platform binnenkomt. De gegevens zelf staan in server/data/t4students.json;
// dit bestand geeft er typering, uitleg en een paar afgeleide waarden bij.
//
// WAAROM EEN DATABESTAND EN GEEN CONSTANTE IN CODE
// Het platform kent twee manieren om een itembank te bewaren. T4Teens zet zijn
// 26 items als constante in server/question-manager.ts: een platte lijst met
// id, domein, cluster en een Nederlandse tekst. T4Sports zet zijn instrument in
// server/data/t4sports.json en laat het register het versienummer daaruit
// rekenen. Het studiekompas past alleen in de tweede vorm. Een item draagt hier
// namelijk meer dan een tekst: een responsschaal, soms een tweede schaal voor
// de energie-anker, keuze-opties met ladingen op meerdere constructen tegelijk,
// en teksten in drie talen. Dat past niet in de platte T4Teens-vorm zonder de
// gegevens te verminken. Bovendien is het databestand de vorm waar de laag voor
// herleidbaarheid van instrumentversies op rekent: inhoudsVersie() leest
// sections, responseScales en families, en die drie staan er precies zo in.
//
// WAT ER UIT DE BRON KOMT
// De bron is de zelfstandige browsertoepassing van T4Students (het bestand
// instrument-data.js, dat een object aan window.T4S_INSTRUMENT toewijst). Alle
// 31 items, de vijf responsschalen, de volledige scoringMap met haar constanten
// en de drie talen zijn ongewijzigd overgenomen. Geen enkel getal is aangeraakt.
//
// EEN OPENSTAAND PUNT UIT DE BRON
// Het bronbestand zet translationStatus op "nl-only" terwijl er wel degelijk
// Franse en Engelse teksten in staan. Die vlag is bewust overgenomen zoals ze
// is, en de vertalingen ook. Lees de vlag dus als: de Franse en Engelse teksten
// bestaan, maar zijn nog niet nagelezen en nog niet vrijgegeven. Wie ze wil
// gebruiken in een afname, laat ze eerst nakijken en zet de vlag daarna om.
// Er zijn geen vertalingen bijgemaakt of geraden.
// ---------------------------------------------------------------------------

import definitie from "../data/t4students.json";

/** Een tekst in de drie talen die het instrument voert. */
export interface T4SVertaalbaar {
  nl: string;
  fr?: string;
  en?: string;
}

/**
 * Wat een gekozen keuze-optie oplaadt. Een optie kan meerdere constructen
 * tegelijk laden, ook over families heen: dat is het punt van een situatie-item.
 */
export interface T4SLading {
  construct: string;
  family: string;
  weight: number;
}

export interface T4SOptie {
  key: string;
  text: T4SVertaalbaar;
  loads?: T4SLading[];
  /** Alleen bij situatie-items met een energie-anker in de optie zelf. */
  energyValue?: number;
}

export interface T4SItem {
  id: string;
  family: string;
  construct?: string;
  itemType?: string;
  scale?: string;
  /** De tweede schaal bij items die naast herkenning ook energie meten. */
  energyScale?: string;
  text?: T4SVertaalbaar;
  options?: T4SOptie[];
  /** Bron-ID's uit de stellingenlijst van 2015, voor herleidbaarheid. */
  sourceItems?: string[];
  /** Alleen P2: welk item bepaalt welke variant getoond wordt. */
  dependsOn?: string;
  /** Alleen P2: de drie varianten, per antwoord op P1. */
  variants?: Record<string, Omit<T4SItem, "id" | "family">>;
}

export interface T4SFamilie {
  id: string;
  label: string;
  energyMode: string;
  constructs: string[];
}

export interface T4SInstrument {
  instrumentId: string;
  version: string;
  name: string;
  language: string;
  description: string;
  responseScales: Record<string, any>;
  families: T4SFamilie[];
  sections: { sectionId: string; items: T4SItem[]; [k: string]: any }[];
  identity: { required: string[]; optional: string[] };
  scoringMap: T4SScoringMap;
  multilingual: boolean;
  /** Zie de opmerking bovenaan dit bestand: staat op "nl-only" terwijl de
   *  Franse en Engelse teksten wel aanwezig zijn, maar nog niet nagelezen. */
  translationStatus: string;
  license: string;
}

/**
 * De scoringMap is het contract tussen het instrument en de scoringsmotor.
 * Elke constante hierin is een keuze die in de blauwdruk verantwoord wordt;
 * de motor leest ze en verzint er zelf niets bij.
 */
export interface T4SScoringMap {
  scorerVersion: string;
  constants: {
    sjtWeight: number;
    energyToRecognitionFactor: number;
    overloadRecognitionMin: number;
    underuseRecognitionMax: number;
    voorlopigDrempel: number;
    driverDoorslagFactor: number;
    beeldNietInEnergieDrempel: number;
    leastCharacteristicCount: number;
    tieMargin?: number;
  };
  beeldItems: Record<string, string>;
  recognitionItems: Record<string, string>;
  energyItems: string[];
  sjtItems: string[];
  interestItems: Record<string, string>;
  rankItems: string[];
  convergenceAxes: Record<string, [string, string][]>;
  riasecDerivation: Record<string, { derivedFrom: [string, string][]; confirmItem: string }>;
  tenStudyFields: Record<string, string[]>;
  studyStrategy: Record<string, { strategie: string; belofte: string }>;
  leastCharacteristic: { dimensions: string[]; framing: string };
  profileAnchor: Record<string, any>;
  licenseRender: Record<string, any>;
  alertOverride: {
    alwaysInBasis: boolean;
    alwaysToHuman: boolean;
    triggers: { id: string; rule: string; meaning: string }[];
  };
}

/** Het volledige instrument, precies zoals het in het databestand staat. */
export const T4STUDENTS_INSTRUMENT = definitie as unknown as T4SInstrument;

/** De sectie waar alle 31 items in zitten. */
export function t4studentsItems(): T4SItem[] {
  const main = T4STUDENTS_INSTRUMENT.sections.find((s) => s.sectionId === "main");
  return main ? main.items : [];
}

/** Het aantal items dat een deelnemer werkelijk voorgeschoteld krijgt. */
export const T4STUDENTS_AANTAL_ITEMS = t4studentsItems().length;

/**
 * Het nummer van de scoringsmotor, los van het versienummer van het
 * instrument. De twee schuiven onafhankelijk van elkaar: de itemteksten kunnen
 * wijzigen zonder dat de rekenregels wijzigen, en omgekeerd.
 */
export const T4STUDENTS_SCORER_VERSIE = T4STUDENTS_INSTRUMENT.scoringMap.scorerVersion;
