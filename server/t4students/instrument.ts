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
// 34 items, de vijf responsschalen, de volledige scoringMap met haar constanten
// en de drie talen zijn ongewijzigd overgenomen. Geen enkel getal is aangeraakt.
//
// DE MOTIVATIELAAG (FASE 1B)
// De T4Students-toepassing die vandaag op het platform draait, buiten dit
// nieuwe instrument om, heeft al een motivatielaag: vijf items naar de
// zelfdeterminatietheorie van Deci en Ryan, drie intrinsiek en twee
// extrinsiek. Die laag stond niet in de browsertoepassing hierboven en is in
// fase 1b als zevende familie "Motivatie" toegevoegd, met de bestaande
// itemteksten. Het instrument telt daardoor geen 34 maar 39 items. De
// motivatielaag wordt met eigen items gemeten en staat los van de familie
// Drivers: een driver is een onbewust controlepatroon, motivatie gaat over
// waar iemands handelen vandaan komt. De twee mogen niet uit elkaar worden
// afgeleid.
//
// DE VERTAALVLAG
// Het bronbestand zette translationStatus op "nl-only" terwijl er wel degelijk
// Franse en Engelse teksten in stonden. Die tegenspraak is opgelost: D7, F7 en
// F8 hebben hun Franse en Engelse tekst gekregen en de vlag staat op
// "nl-fr-en". Zij zegt daarmee welke talen aanwezig zijn, niet dat ze nagelezen
// zijn. Het nalezen van de vertalingen ligt bij de opdrachtgever, en zolang dat
// niet gebeurd is stuurt geen enkele regel code op deze vlag.
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
  /** Alleen bij de open beginvraag (P0): voorbeeldtekst in kleinere letter. */
  placeholder?: T4SVertaalbaar;
  /** Alleen bij de open beginvraag (P0): staat op false, ze is niet verplicht. */
  required?: boolean;
  options?: T4SOptie[];
  /** Bron-ID's uit de stellingenlijst van 2015, voor herleidbaarheid. */
  sourceItems?: string[];
  /** Alleen P2: welk item bepaalt welke variant getoond wordt. */
  dependsOn?: string;
  /** Alleen P2: de drie varianten, per antwoord op P1. */
  variants?: Record<string, Omit<T4SItem, "id" | "family">>;
}

/**
 * Het itemType van de open beginvraag (onderdeel B1). Een item met dit type
 * hoort bij geen enkele familie die in de scoring meetelt, voedt geen
 * construct en telt niet mee in totaalItems of totaalSignaal. Dit is een
 * eigen, herkenbare markering in plaats van een los lijstje item-ID's, zodat
 * geen enkele plek in de code de beginvraag per ongeluk toch meetelt.
 */
export const OPEN_INTRO_ITEMTYPE = "open-intro";

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
  /** Welke talen aanwezig zijn, niet of ze nagelezen zijn. Zie bovenaan. */
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
    overloadRecognitionMin: number;
    underuseRecognitionMax: number;
    voorlopigDrempel: number;
    driverDoorslagFactor: number;
    beeldNietInEnergieDrempel: number;
    leastCharacteristicCount: number;
    tieMargin: number;
    /**
     * Drempel voor de motivatiebalans (fase 1b). Komt uit de bestaande
     * T4Students-toepassing (server/t4students/scoring.ts), niet uit deze
     * blauwdruk: dat instrument kende de motivatielaag niet. Dezelfde formule
     * en dezelfde drempel zijn hier overgezet zonder een getal te wijzigen.
     * De waarde is een conventie van de ontwikkelaar en niet op afnamegegevens
     * geijkt, net als GASPEDAAL_REM_GRENS bij de Driver-scan
     * (server/driverscan/duiding.ts).
     */
    motivatieBalansDrempel: number;
  };
  beeldItems: Record<string, string>;
  recognitionItems: Record<string, string>;
  /**
   * Welk motivatieconstruct bij welk item hoort (fase 1b). Bewust een eigen
   * veld en geen uitbreiding van recognitionItems: de motivatielaag wordt
   * apart gemeten en telt niet mee in de driver- of talentberekeningen.
   */
  motivationItems: Record<string, string>;
  energyItems: string[];
  sjtItems: string[];
  interestItems: Record<string, string>;

  /**
   * NIET UITGEVOERD ONTWERP (punt 2 uit fase 1). Geen enkele regel code leest
   * dit veld vandaag.
   *
   * De blauwdruk kent er wel een rol aan toe, in punt 4: "rankItems = V1-V6
   * worden onderling gerangschikt om de dominante versneller(s) te bepalen."
   * De motor rangschikt in plaats daarvan de opgetelde constructscores. Dat is
   * niet hetzelfde, omdat de zes versnellers een verschillend aantal bronnen
   * hebben: Impact en Constructief onderscheidend hebben alleen hun eigen item
   * en lopen tot 3, Groepsondersteunend vangt er nog drie situatieladingen bij
   * op en loopt tot 6. Wat dat in de praktijk scheeftrekt is gemeten en
   * voorgelegd in het verslag van fase 1c. Niet zelf gerepareerd: het verandert
   * de studiestrategie die de deelnemer te lezen krijgt.
   */
  rankItems: string[];

  convergenceAxes: Record<string, [string, string][]>;
  riasecDerivation: Record<string, { derivedFrom: [string, string][]; confirmItem: string }>;
  tenStudyFields: Record<string, string[]>;
  studyStrategy: Record<string, { strategie: string; belofte: string }>;
  /**
   * NIET UITGEVOERD ONTWERP (punt 3 uit fase 1). Dit object wordt door geen
   * enkele regel code gelezen. Let op het verschil met de constante
   * leastCharacteristicCount, die wel gelezen wordt: de motor berekent de
   * keerzijde dus wel, maar zonder de dimensielijst en zonder de framing.
   *
   * De blauwdruk kent er in punt 7 wel een rol aan toe: de minst kenmerkende
   * focus, versneller en driver worden getoond als nuance, "wat je minst
   * kenmerkt maakt je beeld scherper", nadrukkelijk geen tekort, en alleen in
   * Verdieping. Die framing is de deontologische kern van dit onderdeel en
   * staat nergens in code. Voorgelegd in het verslag van fase 1c.
   */
  leastCharacteristic: { dimensions: string[]; framing: string };

  profileAnchor: Record<string, any>;

  /**
   * NIET UITGEVOERD ONTWERP (punt 3 uit fase 1). Dit object wordt door geen
   * enkele regel code gelezen.
   *
   * De blauwdruk kent er in punt 7 wel een rol aan toe: een meting, twee
   * rapporten, via licenseRender.flag = license in {basis, verdieping}. De
   * tabel legt per sectie vast in welke van de twee hij hoort, en welke secties
   * in Verdieping dieper gaan. De blauwdruk noemt de scheiding uitdrukkelijk
   * "de deontologische scheidslijn": de interpretatieve en keuze-bepalende
   * secties 8 tot 11 horen uitsluitend in Verdieping.
   *
   * Zolang niets dit leest, maakt de motor dat onderscheid niet en levert hij
   * alles. Dat is niet gerepareerd omdat het over de rapportlaag gaat en niet
   * over de meting; het staat in het verslag van fase 1c zodat het niet
   * ongemerkt blijft liggen als er wel op gebouwd wordt.
   */
  licenseRender: Record<string, any>;
  alertOverride: {
    alwaysInBasis: boolean;
    alwaysToHuman: boolean;
    triggers: { id: string; rule: string; meaning: string }[];
  };
}

/** Het volledige instrument, precies zoals het in het databestand staat. */
export const T4STUDENTS_INSTRUMENT = definitie as unknown as T4SInstrument;

/**
 * De sectie waar alle items in zitten: de open beginvraag P0 (onderdeel B1),
 * plus de 39 items uit fase 1b (34 uit de motorronde plus de vijf van de
 * motivatiefamilie). P0 staat als eerste in de lijst, zoals de student ze ook
 * te zien krijgt, maar telt in geen enkele score mee.
 */
export function t4studentsItems(): T4SItem[] {
  const main = T4STUDENTS_INSTRUMENT.sections.find((s) => s.sectionId === "main");
  return main ? main.items : [];
}

/**
 * Het aantal items dat in de score, de rangorde en het signaalgetal meetelt.
 * De open beginvraag P0 is bewust uitgesloten: ze is geen vraag in de zin van
 * de vragenlijst die het instrument beschrijft, en de opdracht "Studiekompas
 * persoonlijk maken" (onderdeel B1) verplicht dat ze in geen enkele telling
 * meetelt. Daarom filtert deze constante op itemType, in plaats van simpelweg
 * de lengte van de itemlijst te nemen.
 */
export const T4STUDENTS_AANTAL_ITEMS = t4studentsItems().filter((i) => i.itemType !== OPEN_INTRO_ITEMTYPE).length;

/**
 * Het nummer van de scoringsmotor, los van het versienummer van het
 * instrument. De twee schuiven onafhankelijk van elkaar: de itemteksten kunnen
 * wijzigen zonder dat de rekenregels wijzigen, en omgekeerd.
 */
export const T4STUDENTS_SCORER_VERSIE = T4STUDENTS_INSTRUMENT.scoringMap.scorerVersion;
