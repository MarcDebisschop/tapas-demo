// ---------------------------------------------------------------------------
// server/t4students/kompas-scoring.ts
//
// De scoringsmotor van het T4Students-studiekompas, overgezet uit de
// zelfstandige browsertoepassing (scorer.js, scoringsmotornummer
// t4students-1.0.0). Eén zuivere functie: dezelfde antwoorden geven altijd
// dezelfde uitkomst, er wordt niets gelezen of geschreven buiten de argumenten.
//
// LET OP, DIT IS NIET DE ENIGE T4STUDENTS-MOTOR IN DE MAP
// Naast dit bestand staat server/t4students/scoring.ts. Dat is de oudere
// aanpak, die rekent op de itembank van 37 items in server/question-manager.ts
// en die vandaag door de afnameroute gebruikt wordt. Die blijft ongewijzigd
// staan. Deze motor hoort bij het studiekompas van 34 items uit
// server/data/t4students.json. Welke van de twee het platform uiteindelijk
// gebruikt, is een beslissing voor een latere fase.
//
// WAAROM DE CONSTANTEN ZIJN WAT ZE ZIJN (blauwdruk v1.0.0)
// Geen enkele constante staat hier in de code. Ze komen allemaal uit
// scoringMap.constants in het instrument, zodat er maar één plaats is waar ze
// wijzigen kunnen. Wat ze betekenen, in gewone taal:
//
//   sjtWeight (2)
//     AFGELEID, NIET TOEGEPAST (punt 1 uit fase 1). De motor leest deze
//     constante nergens, en dat is goed: het gewicht zit al in de data. De
//     blauwdruk zegt "een gekozen SJT-optie laadt het bijbehorende construct
//     met gewicht 2 (zie loads in D5/D6/F4/F5)", en zo staat het er ook: zes
//     van de acht situatie-opties dragen een lading met gewicht 2. De twee
//     uitzonderingen zijn F4 optie b (gewicht 0, zie punt 6) en F5 optie b, dat
//     zijn eigen construct niet laadt maar Be Strong en Analyse elk met 1.
//     De constante is dus overbodig, niet fout. Ze blijft staan omdat de
//     blauwdruk haar bij naam noemt en ze zo leesbaar houdt waar het getal 2
//     in de ladingen vandaan komt. Zou de motor haar alsnog gaan toepassen,
//     dan verdubbelt elke situatielading en verschuift elke score; dat is geen
//     kleine ingreep en is niet op eigen houtje gedaan.
//
//   overloadRecognitionMin (2) en underuseRecognitionMax (1)
//     De twee kantelpunten op de herkenningsschaal van 0 tot 3. Vanaf 2 heet
//     iets kenmerkend, tot en met 1 heet het niet kenmerkend. Kenmerkend plus
//     negatieve energie is overbelasting; niet kenmerkend plus positieve
//     energie is onderbenutting.
//
//   driverDoorslagFactor (2.0)
//     Een driver heet pas sturend als hij duidelijk boven de andere uitkomt:
//     minstens dubbel zo hoog als de tweede, en minstens 3 in absolute zin.
//     Zonder die dubbele eis zou bij een vlak profiel de toevallige nummer één
//     als sturend gepresenteerd worden.
//
//   beeldNietInEnergieDrempel (0)
//     Geeft het zelfbeeld geen energie, dan is dat de centrale alarmbel. De
//     drempel ligt op nul: neutraal telt al mee, niet pas negatief.
//
//   voorlopigDrempel (20)
//     Onder de twintig beantwoorde signaaldragende items is er te weinig om
//     een stabiel beeld op te bouwen. Het rapport wordt dan als voorlopig
//     gelabeld in plaats van stiller te worden over zijn eigen onzekerheid.
//
//   leastCharacteristicCount (2)
//     Hoeveel elementen aan de onderkant getoond worden als nuance. Twee: één
//     is toeval, drie leest als een lijstje tekorten.
//
//   tieMargin (0.3)
//     Scores die niet meer dan deze marge uit elkaar liggen, gelden als gelijk
//     en komen in dezelfde groep. Tot de motorronde stond de marge op 1.0, en
//     dan gold een heel punt verschil op de herkenningsschaal nog als gelijk:
//     wie zich in iets duidelijk meer herkende dan in iets anders, las dat de
//     twee even sterk waren. Op verzoek van de opdrachtgever staat de marge nu
//     op 0.3.
//     LET OP: sinds punt 2 wordt er op herkenning gerangschikt, en die scores
//     zijn allemaal hele getallen. Elke marge onder 1 komt daardoor op
//     hetzelfde neer: alleen wie precies gelijk scoort, komt in dezelfde groep.
//     0.3 laat wel ruimte als er ooit een halve punt bij komt.
//     De blauwdruk noemt tieMargin nergens; de waarde is een keuze van de
//     opdrachtgever en niet uit het ontwerp afgeleid.
//
// De overzetting is letterlijk. Geen enkele constante, drempel of formule is
// gewijzigd, ook niet waar iets bevreemdt. Wat opviel staat beschreven in
// verslag-t4students-fase1.md en is bewust niet gerepareerd.
// ---------------------------------------------------------------------------

import type { T4SInstrument, T4SItem, T4SOptie } from "./instrument";

/**
 * Eén antwoord. Welke velden gevuld zijn, hangt af van het itemtype:
 * herkenningsitems vullen recognition en soms energy, interesse-items vullen
 * interest, situatie- en keuze-items vullen choice, de schuiven vullen value.
 */
export interface T4SAntwoord {
  recognition?: number | null;
  energy?: number | null;
  interest?: number | null;
  choice?: string | null;
  value?: number | null;
}

export type T4SAntwoorden = Record<string, T4SAntwoord | null | undefined>;

export interface T4SDeelnemer {
  naam?: string;
  code?: string;
  [k: string]: unknown;
}

export type T4STaal = "nl" | "fr" | "en";

export interface T4SAlert {
  id: string;
  meaning: string;
  toHuman: boolean;
  boodschap: string;
}

export interface T4SConstructScore {
  family: string;
  recognition: number;
  /**
   * Leeg wanneer er geen enkel energie-antwoord voor dit construct is
   * (motorronde punt 4). Nul is op deze schaal een antwoord en geen lege plaats,
   * dus leeg mag daar niet op uitkomen.
   */
  avgEnergy: number | null;
}

export interface T4SResultaat {
  contractVersion: string;
  instrumentId: string;
  taal: T4STaal;
  deelnemer: T4SDeelnemer;
  ijkpunt: { waarde: number | null };
  energie: {
    ijkpunt0tot10: number | null;
    kaart: Record<string, string>;
    bronnen: string[];
    lekken: string[];
  };
  constructScores: Record<string, T4SConstructScore>;
  foci: {
    scores: Record<string, number>;
    sorted: string[];
    topGroep: string[];
    top2: string[];
    balanslabels: Record<string, string>;
    groepen: string[][];
  };
  versnellers: {
    scores: Record<string, number>;
    rangorde: string[];
    kopGroep: string[];
    groepen: string[][];
    balanslabels: Record<string, string>;
    dominante: string | null;
    gedeeldMet: string[];
  };
  convergentie: Record<string, string>;
  riasec: {
    scores: Record<string, number>;
    details: Record<
      string,
      {
        afgeleideScore: number;
        bevestigingScore: number;
        totaalScore: number;
        divergentie: boolean;
        confirmItem: string;
      }
    >;
  };
  studiegebieden: {
    scores: Record<string, number>;
    gesorteerd: { naam: string; score: number }[];
    top: { naam: string; score: number }[];
  };
  studiestrategie: {
    dominanteVersneller: string | null;
    primair: { strategie: string; belofte: string } | null;
    secondaryVersneller: string | null;
    secundair: { strategie: string; belofte: string } | null;
    gedeeldMet: string[];
  };
  interesse: {
    scores: Record<string, number>;
    sorted: string[];
    topGroep: string[];
  };
  drivers: {
    scores: Record<string, number>;
    sorted: string[];
    top2: string[];
    doorslag: string | null;
  };
  keerzijde: { minFoci: string[]; minVersnellers: string[]; minDrivers: string[] };
  profielAnker: {
    profiel: string | null;
    p2Detail: string | number | null;
    toon: string | null;
    focus: string | null;
  };
  alerts: { actief: T4SAlert[]; alwaysInBasis: boolean; alwaysToHuman: boolean };
  betrouwbaarheid: {
    beantwoord: number;
    totaalItems: number;
    totaalSignaal: number;
    voorlopigDrempel: number;
    voorlopig: boolean;
  };
  beeldScherpte: {
    zelfZekerheid: number | null;
    profielUitgesprokenheid: number | null;
    consistentieSignaal: string;
  };
  betekenis: { keuze: string | null };
  studeerstijl: { keuze: string | null };
}

/**
 * Afronden op twee cijfers na de komma, precies zoals de bronmotor het doet.
 * Bewust niet via toFixed: dat rondt anders af bij een half cijfer en zou de
 * uitkomsten laten afwijken van de bron.
 */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// De boodschappen bij de welzijnskritische signalen. Ze staan hier en niet in
// het instrument, precies zoals in de bronmotor.
//
// AFWIJKING VAN DE BRON, BEWUST EN ENIG
// In de bron staat in vier van deze zinnen een lang streepje. Dat mag hier niet
// staan. Waar dat zo was, staat nu een punt of een komma. De betekenis is
// ongewijzigd; de tekst is niet identiek aan die van de bron. Dit is het enige
// punt waarop de uitvoer van deze motor van de bron verschilt, en het wordt
// afgedekt door tests/t4students-kompas-alertteksten.test.ts.
const ALERT_BOODSCHAPPEN: Record<string, Record<T4STaal, string>> = {
  beeld_niet_in_energie: {
    nl: "Je zelfbeeld geeft je op dit moment weinig energie. Dit is een belangrijk signaal om samen met iemand te bekijken, niet alleen.",
    fr: "Ton image de toi-même te donne pour l’instant peu d’énergie. C’est un signal important à examiner avec quelqu’un, pas seul.",
    en: "Your self-image gives you little energy right now. This is an important signal to look at together with someone, not alone.",
  },
  profiel_B_vastloper: {
    nl: "Je geeft aan dat het vastloopt of dat je twijfelt. Dat verdient een gesprek met een studieadviseur of begeleider die je verder kan helpen.",
    fr: "Tu indiques que cela bloque ou que tu hésites. Cela mérite une conversation avec un conseiller d’orientation ou un accompagnateur qui peut t’aider à avancer.",
    en: "You indicate that things are stuck or that you are hesitating. That deserves a conversation with a study advisor or mentor who can help you move forward.",
  },
  lage_batterij: {
    nl: "Je batterij staat erg laag. Lees dit rapport rustig en weet dat een gesprek met iemand die je kent en vertrouwt nu het meest waardevol is.",
    fr: "Ta batterie est très basse. Lis ce rapport calmement et sache qu’une conversation avec quelqu’un que tu connais et en qui tu as confiance est ce qui compte le plus en ce moment.",
    en: "Your battery is very low. Read this report calmly and know that a conversation with someone you know and trust is the most valuable thing right now.",
  },
  voorlopig_profiel: {
    nl: "Er zijn te weinig antwoorden om een stabiel beeld te geven. Dit rapport is voorlopig. Vul de vragenlijst volledig in voor een betrouwbaarder beeld.",
    fr: "Il y a trop peu de réponses pour donner une image stable. Ce rapport est provisoire. Réponds entièrement au questionnaire pour une image plus fiable.",
    en: "There are too few answers to give a stable picture. This report is provisional. Complete the full questionnaire for a more reliable picture.",
  },
};

/**
 * De toestand die in de plaats komt van een oordeel wanneer de nodige
 * antwoorden ontbreken (motorronde punt 4). Zij staat zowel in de energiekaart
 * per item als bij de balanslabels per construct, zodat er maar een woord is
 * voor "hier is niet genoeg gemeten om iets te zeggen". T4Teens en T4Kids
 * gebruiken hiervoor de tekst "te weinig antwoorden"; deze motor schrijft haar
 * als sleutel, net als "niet_van_toepassing" en de andere labels hier.
 */
export const GEEN_MEETPUNT = "te_weinig_antwoorden";

// De items die meetellen voor de vraag of er genoeg signaal is. Bewust een
// vaste lijst en niet "alle items": de profiel-, studiecontext- en
// betekenisitems sturen de toon van het rapport, maar dragen zelf geen
// talentsignaal.
const SIGNAALDRAGENDE_ITEMS = [
  "I1", "BE1", "BE2",
  "D1", "D2", "D3", "D4", "D5", "D6", "D7",
  "V1", "V2", "V3", "V4", "V5", "V6",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "R1", "R2", "R3", "R4", "R5", "R6",
];

/**
 * Scoort één afname van het studiekompas.
 *
 * @param instrumentDef Het instrument met zijn scoringMap.
 * @param answers       De antwoorden per item-id. Ontbrekende items mogen.
 * @param deelnemer     Naam en code; ontbrekende velden krijgen een standaard.
 * @param taal          nl, fr of en. Iets anders valt terug op nl.
 */
export function scoreStudiekompas(
  instrumentDef: T4SInstrument,
  answers: T4SAntwoorden,
  deelnemer?: T4SDeelnemer | null,
  taal?: string,
): T4SResultaat {
  let gekozenTaal: T4STaal = (taal as T4STaal) || "nl";
  if (gekozenTaal !== "nl" && gekozenTaal !== "fr" && gekozenTaal !== "en") gekozenTaal = "nl";

  const sm = instrumentDef.scoringMap;
  const C = sm.constants;

  function alertBoodschap(id: string): string {
    const m = ALERT_BOODSCHAPPEN[id];
    return m ? m[gekozenTaal] || m.nl : "";
  }

  const main = instrumentDef.sections.find((s) => s.sectionId === "main");
  const items: T4SItem[] = main && main.items ? main.items : [];
  const itemById: Record<string, T4SItem> = {};
  for (const it of items) itemById[it.id] = it;

  // ── Construct-accumulator ────────────────────────────────────────────────
  // De volgorde waarin constructen hier ontstaan, is de volgorde waarin ze in
  // de uitvoer verschijnen. Daarom worden ze eerst allemaal op nul gezet in de
  // volgorde van de families, precies zoals in de bronmotor.
  interface Accu {
    family: string;
    recognition: number;
    energyVals: number[];
  }
  const constructs: Record<string, Accu> = {};
  function acc(family: string, construct: string): Accu {
    let a = constructs[construct];
    if (!a) {
      a = { family, recognition: 0, energyVals: [] };
      constructs[construct] = a;
    }
    return a;
  }
  for (const fam of instrumentDef.families) {
    for (const con of fam.constructs) acc(fam.id, con);
  }

  // ── Ruwe inputverwerking (blauwdruk §1) ──────────────────────────────────
  let beantwoord = 0;
  let ijkpunt: number | null = null;
  let betekenisKeuze: string | null = null;
  let p1: string | null = null;
  let p2: string | number | null = null;
  let s1: string | null = null;
  let be2EnergyVal: number | null = null;

  // Herkenningsitems: D1 tot D4, V1 tot V6, F1 tot F3 en F6.
  for (const [itemId, construct] of Object.entries(sm.recognitionItems)) {
    const a = answers[itemId];
    if (a == null || a.recognition == null) continue;
    beantwoord++;
    acc(itemById[itemId].family, construct).recognition += a.recognition;
  }

  // Energie-ankers (herstel van punt 8 uit fase 1).
  //
  // Een item met een energie-anker stelt twee vragen: kenmerkt dit mij, en
  // geeft het mij energie. Het blijft een item. Alle twaalf items met een
  // anker worden al geteld via hun herkenningsantwoord, hierboven of bij de
  // TaPas-BEELD-items hieronder, dus het anker mag de teller niet nog eens
  // ophogen: dat zou 43 van 31 opleveren.
  //
  // Maar wie alleen de energieschuif beweegt en de herkenning openlaat, heeft
  // wel iets beantwoord en werd voorheen als onbeantwoord geteld. Daarom telt
  // het anker alleen mee wanneer het item nog niet via zijn herkenning geteld
  // is. Zo telt de teller items, precies eenmaal, en nooit meer dan er zijn.
  for (const eItemId of sm.energyItems) {
    const ea = answers[eItemId];
    if (ea == null || ea.energy == null) continue;
    if (ea.recognition == null) beantwoord++;
    const eit = itemById[eItemId];
    acc(eit.family, eit.construct as string).energyVals.push(ea.energy);
    if (eItemId === "BE2") be2EnergyVal = ea.energy;
  }

  // De twee TaPas-BEELD-items.
  for (const [itemId, construct] of Object.entries(sm.beeldItems)) {
    const ba = answers[itemId];
    if (ba == null || ba.recognition == null) continue;
    beantwoord++;
    acc(itemById[itemId].family, construct).recognition += ba.recognition;
  }

  // Interesse-items R1 tot R6. De interessewaarde telt op bij de herkenning
  // van het bijbehorende RIASEC-construct.
  for (const [itemId, construct] of Object.entries(sm.interestItems)) {
    const ia = answers[itemId];
    if (ia == null || ia.interest == null) continue;
    beantwoord++;
    acc(itemById[itemId].family, construct).recognition += ia.interest;
  }

  // Situatie-items D5, D6, F4 en F5. Je kiest een handelwijze en de gekozen
  // optie laadt de constructen die erachter zitten. Zo vangt het instrument
  // sociaal wenselijk antwoorden op: je beoordeelt jezelf niet, je kiest.
  //
  // De regel "if (load.weight > 0)" hieronder is geen voorzorg maar raakt een
  // echte lading: F4 optie b laadt Systematisch/Uitvoerend met gewicht nul, de
  // enige lading met gewicht nul in het instrument (punt 6 uit fase 1). Die
  // wordt dus overgeslagen, en gewicht nul werkt hier hetzelfde als helemaal
  // geen lading. Of daar een getal vergeten is dan wel uitdrukkelijk niets
  // bedoeld is, valt uit de blauwdruk noch uit het itemselectiedocument op te
  // maken; het is daarom niet veranderd maar voorgelegd in het verslag van
  // fase 1c, met de gemeten gevolgen van 0, 1 en 2.
  for (const sItemId of sm.sjtItems) {
    const sa = answers[sItemId];
    if (sa == null || sa.choice == null) continue;
    beantwoord++;
    const sit = itemById[sItemId];
    const sopt: T4SOptie | undefined = (sit.options || []).find((o) => o.key === sa.choice);
    if (!sopt) continue;
    for (const load of sopt.loads || []) {
      if (load.weight > 0) acc(load.family, load.construct).recognition += load.weight;
    }
    if (sopt.energyValue != null) {
      acc(sit.family, sit.construct as string).energyVals.push(sopt.energyValue);
    }
  }

  // Het energie-ijkpunt I1.
  const i1 = answers["I1"];
  if (i1 != null && i1.value != null) {
    ijkpunt = i1.value;
    beantwoord++;
  }

  // Het betekenisspoor B1.
  const b1 = answers["B1"];
  if (b1 != null && b1.choice != null) {
    betekenisKeuze = b1.choice;
    beantwoord++;
  }

  // De profielselectie P1.
  const p1a = answers["P1"];
  if (p1a != null && p1a.choice != null) {
    p1 = p1a.choice;
    beantwoord++;
  }

  // De profielkern P2. Welke vorm dit item heeft, hangt af van P1: bij A is het
  // een schuif (value), bij B en C een keuze (choice).
  const p2a = answers["P2"];
  if (p2a != null) {
    const p2v = p2a.value != null ? p2a.value : p2a.choice;
    if (p2v != null) {
      p2 = p2v;
      beantwoord++;
    }
  }

  // De studeerstijl S1. Ook deze keuze laadt een versneller.
  const s1a = answers["S1"];
  if (s1a != null && s1a.choice != null) {
    s1 = s1a.choice;
    beantwoord++;
    const s1opt = (itemById["S1"].options || []).find((o) => o.key === s1);
    if (s1opt) {
      for (const load of s1opt.loads || []) {
        if (load.weight > 0) acc(load.family, load.construct).recognition += load.weight;
      }
    }
  }

  // ── Scores per construct (blauwdruk §2) ──────────────────────────────────
  /**
   * De gemiddelde energie van een construct, of leeg als er niets gemeten is
   * (motorronde punt 4).
   *
   * WAT HIER MIS GING
   * De energieschaal loopt van min twee tot plus twee, en nul is daar geen lege
   * plaats maar een antwoord: "dit doet me niets". Deze functie gaf nul terug
   * wanneer de lijst met antwoorden leeg was. Wie niets invulde en wie
   * uitdrukkelijk neutraal antwoordde, kwamen daardoor op hetzelfde getal uit,
   * en alles wat op dat getal steunde sprak een oordeel uit over iemand van wie
   * niets gemeten was.
   *
   * WAT ER NU GEBEURT
   * Geen antwoorden betekent geen getal. Wie het getal gebruikt, moet dus zelf
   * beslissen wat te doen als het ontbreekt, en kan het niet meer per ongeluk
   * als een middenwaarde lezen. Dit is dezelfde oplossing als in T4Teens en
   * T4Kids, waar een onvolledig construct "niet ingevuld" krijgt in plaats van
   * een score.
   */
  function avgEnergy(con: string): number | null {
    const v = constructs[con].energyVals;
    return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }

  // Rangschikken gebeurt op herkenning. Reden: een mengsel van herkenning en
  // energie liet energie de plaats bepalen, zodat wie zich sterk herkent maar er
  // weinig energie uit haalt onder iemand zakte die zich nauwelijks herkent maar
  // het wel leuk vindt. Energie weegt nog altijd even zwaar mee in het
  // balanslabel en in de energiekaart, maar dan apart en zichtbaar als energie.
  function herkenning(con: string): number {
    return constructs[con].recognition;
  }

  // ── Energie-status per item (blauwdruk §3) ───────────────────────────────
  function energyStatus(eId: string): string {
    const ea = answers[eId];
    // Motorronde punt 4. Hier stond "neutraal" bij een onbeantwoord item, en
    // ook bij een half beantwoord item, want de ontbrekende helft werd stil op
    // nul gezet. Neutraal is een antwoord van de deelnemer en geen lege plaats.
    if (!ea || ea.recognition == null || ea.energy == null) return GEEN_MEETPUNT;
    const rec = ea.recognition;
    const eng = ea.energy;
    if (rec >= C.overloadRecognitionMin && eng < 0) return "overbelasting";
    if (rec <= C.underuseRecognitionMax && eng > 0) return "onderbenutting";
    if (rec >= C.overloadRecognitionMin && eng > 0) return "kernsterkte";
    return "neutraal";
  }

  const energieKaart: Record<string, string> = {};
  for (const eId of sm.energyItems) energieKaart[eId] = energyStatus(eId);

  const energieBronnen: string[] = [];
  const energieLekken: string[] = [];
  for (const ck of Object.keys(constructs)) {
    const e = avgEnergy(ck);
    if (e === null) continue;
    if (e >= 1) energieBronnen.push(ck);
    else if (e <= -1) energieLekken.push(ck);
  }

  // ── Foci en versnellers (blauwdruk §4) ───────────────────────────────────
  //
  // tieMargin stond eerder nergens en werd door een terugval in deze regel op
  // 1.0 gezet (punt 4 uit fase 1). Hij staat nu bij de andere acht constanten
  // in het instrumentbestand, zodat er nog maar een plaats is waar het getal
  // vandaan komt. De waarde is in de motorronde op 0.3 gezet; zie de uitleg
  // bovenaan dit bestand en tests/t4students-gelijke-stand.test.ts.
  const tieMargin = C.tieMargin;

  // Scores die dicht bij elkaar liggen worden tot één groep gebundeld, zodat
  // een verschil binnen de meetruis niet als rangorde gepresenteerd wordt.
  function groepeerRangorde(sorted: string[], scoreOf: (c: string) => number): string[][] {
    const groepen: string[][] = [];
    let huidig: string[] = [];
    for (const kandidaat of sorted) {
      if (huidig.length === 0) {
        huidig.push(kandidaat);
        continue;
      }
      const vorige = huidig[huidig.length - 1];
      if (Math.abs(scoreOf(vorige) - scoreOf(kandidaat)) <= tieMargin) {
        huidig.push(kandidaat);
      } else {
        groepen.push(huidig);
        huidig = [kandidaat];
      }
    }
    if (huidig.length) groepen.push(huidig);
    return groepen;
  }

  /**
   * Het item met de energie-anker dat bij dit construct hoort, of null.
   *
   * Blauwdruk TABEL 1 noemt ze met naam: een energie-anker staat "bij BE +
   * alle V + F1/F2/F3/F6". Dat zijn er twaalf, en het instrument bevat er
   * precies twaalf. Blauwdruk 4 zegt erbij waarom F4 en F5 ontbreken: die twee
   * foci worden via een situatie-item gemeten, niet via herkenning plus energie.
   */
  const ankerItemVanConstruct: Record<string, string> = {};
  for (const eItemId of sm.energyItems) {
    const con = itemById[eItemId].construct;
    if (con) ankerItemVanConstruct[con] = eItemId;
  }

  /**
   * Het balanslabel per construct (herstel van punt 7 uit fase 1).
   *
   * WAT HIER MIS GING
   * overloadRecognitionMin (2) en underuseRecognitionMax (1) zijn waarden op de
   * schaal van EEN antwoord: 0 is "dit ben ik niet", 3 is "dit ben ik helemaal".
   * De blauwdruk past ze in TABEL 2 dan ook per item toe, op het item met de
   * energie-anker. De motor legde ze echter naast de OPTELSOM van alles wat aan
   * een construct bijdraagt. Die som ligt niet op die schaal: Groepsondersteunend
   * verzamelt vier bijdragen en loopt tot 6 op, terwijl Impact er een heeft en
   * niet boven 3 komt. Een deelnemer die bij V3 "kenmerkt me nauwelijks" (1)
   * invulde en daarbij "geeft me energie", kreeg door drie situatieladingen van
   * elk 1 een som van 4 en las "kernsterkte", terwijl zijn eigen antwoord op
   * onderbenutting wees.
   *
   * WAAROM NIET HET GEMIDDELDE
   * Delen door het aantal bijdragen brengt de som wel terug op 0 tot 3, maar
   * middelt dan een zelfbeoordeling (0 tot 3) met situatieladingen (1 of 2).
   * Dat zijn geen vergelijkbare grootheden: wie bij V3 een 3 invult en drie
   * ladingen van 1 oppikt, zakt naar gemiddeld 1.5 en heet dan niet kenmerkend,
   * terwijl hij "dit ben ik helemaal" antwoordde. Ook dat is dus fout.
   *
   * WAT ER NU GEBEURT
   * We nemen de herkenning van het anker-item zelf, precies de grootheid
   * waarvoor de drempels gemaakt zijn. Daarmee komt dit label overeen met
   * energie.kaart, dat dezelfde matrix al per item toepaste en wel klopte.
   * De som blijft ongemoeid: constructScores.recognition en alle
   * rangordes rekenen verder zoals voorheen.
   *
   * VOORGELEGD, NIET ZELF BESLIST
   * Systematisch/Uitvoerend en Sociaal Interactief hebben geen energie-anker.
   * De blauwdruk geeft voor die twee geen matrix. We verzinnen er geen en
   * geven "niet_van_toepassing" terug in plaats van "latent", omdat "latent"
   * een uitspraak over de deelnemer is en hier alleen een meting ontbreekt.
   * Zie het verslag bij fase 1c.
   */
  function balanceLabel(con: string): string {
    const ankerItem = ankerItemVanConstruct[con];
    if (!ankerItem) return "niet_van_toepassing";
    const a = answers[ankerItem];
    const en = avgEnergy(con);
    // Motorronde punt 4. Het label leest twee dingen van het anker-item: de
    // herkenning en de energie. Ontbrak er een van de twee, dan werd zij stil op
    // nul gezet en kwam er toch een oordeel uit; bij een lege invulling was dat
    // "latent", en dat zegt tegen de deelnemer dat hij een sterkte heeft die nog
    // niet tot leven komt. Een halve invulling levert nu geen half oordeel op.
    if (a == null || a.recognition == null || en === null) return GEEN_MEETPUNT;
    const rec = a.recognition;
    if (rec >= C.overloadRecognitionMin && en >= 1) return "kernsterkte";
    if (rec >= C.overloadRecognitionMin && en <= -1) return "overbelast";
    if (rec <= C.underuseRecognitionMax && en >= 1) return "onderbenut";
    return "latent";
  }

  const versFam = instrumentDef.families.find((f) => f.id === "Talent-versnellers");
  const versCons = versFam ? versFam.constructs : [];
  const versScores: Record<string, number> = {};
  const versBalans: Record<string, string> = {};
  for (const con of versCons) {
    versScores[con] = herkenning(con);
    versBalans[con] = balanceLabel(con);
  }
  // LET OP (punt 2 uit fase 1). Hier wordt gerangschikt op de opgetelde
  // herkenning van het construct. De blauwdruk beschrijft in punt 4 iets anders: "rankItems =
  // V1-V6 worden onderling gerangschikt om de dominante versneller(s) te
  // bepalen", dus een rangorde over de zes items zelf. Dat is niet hetzelfde,
  // want de zes versnellers hebben een verschillend aantal bronnen. Impact en
  // Constructief onderscheidend hebben alleen hun eigen item en lopen tot 3;
  // Groepsondersteunend vangt daarnaast ladingen op uit D5, F5 en S1 en loopt
  // tot 6. De uitkomst hiervan stuurt de studiestrategie die de deelnemer leest.
  // Wat dat scheeftrekt is gemeten en voorgelegd in het verslag van fase 1c;
  // het is niet zelf gewijzigd, omdat het de uitvoer van elke deelnemer raakt.
  const versRangorde = versCons.slice().sort((a, b) => versScores[b] - versScores[a]);
  const versGroepen = groepeerRangorde(versRangorde, (c) => versScores[c]);
  const versKopGroep = versGroepen[0] || [];

  const dominanteVersneller = versRangorde[0] || null;
  const studieStrategieInfo =
    dominanteVersneller && sm.studyStrategy[dominanteVersneller]
      ? sm.studyStrategy[dominanteVersneller]
      : null;
  const tweedeBuitenKop = versRangorde.length > 1 && !versKopGroep.includes(versRangorde[1]);
  const secondaryVersneller =
    tweedeBuitenKop && versScores[versRangorde[1]] > 0 ? versRangorde[1] : null;
  const secondaryStrategie =
    secondaryVersneller && sm.studyStrategy[secondaryVersneller]
      ? sm.studyStrategy[secondaryVersneller]
      : null;

  const fociFam = instrumentDef.families.find((f) => f.id === "Talent-foci");
  const fociCons = fociFam ? fociFam.constructs : [];
  const fociScores: Record<string, number> = {};
  const fociBalans: Record<string, string> = {};
  for (const con of fociCons) {
    fociScores[con] = herkenning(con);
    fociBalans[con] = balanceLabel(con);
  }
  const fociSorted = fociCons.slice().sort((a, b) => fociScores[b] - fociScores[a]);
  const fociGroepen = groepeerRangorde(fociSorted, (c) => fociScores[c]);
  const fociTopGroep = fociGroepen[0] || [];
  const fociTop2 = fociSorted.slice(0, 2);

  // ── Convergentie-assen (blauwdruk §5) ────────────────────────────────────
  // Een as die op meerdere families tegelijk boven het familiegemiddelde
  // uitkomt, is een robuuster signaal dan een enkele hoge score.
  const famAvg: Record<string, number> = {};
  for (const fam of instrumentDef.families) {
    const vals = fam.constructs.map((c) => herkenning(c));
    famAvg[fam.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const convergentie: Record<string, string> = {};
  for (const [as, bronnen] of Object.entries(sm.convergenceAxes)) {
    let boven = 0;
    for (const [famId, con] of bronnen) {
      if (herkenning(con) > famAvg[famId]) boven++;
    }
    convergentie[as] = boven >= 2 ? "bevestigd" : boven === 1 ? "indicatief" : "inactief";
  }

  // ── RIASEC en de tien studiegebieden (blauwdruk §6) ──────────────────────
  // Elke letter wordt afgeleid uit foci, versnellers en drivers, en bevestigd
  // door het bijbehorende interesse-item. Lopen die twee uiteen, dan is dat een
  // nuance in het rapport, geen feit.
  const riasecScores: Record<string, number> = {};
  const riasecDetails: T4SResultaat["riasec"]["details"] = {};
  for (const [letter, def] of Object.entries(sm.riasecDerivation)) {
    let afgeleideScore = 0;
    for (const bron of def.derivedFrom) afgeleideScore += herkenning(bron[1]);
    const confirmAns = answers[def.confirmItem];
    const confirmScore = confirmAns != null && confirmAns.interest != null ? confirmAns.interest : 0;
    const riasecScore = round2(afgeleideScore + confirmScore);
    const afgeleideHoog = afgeleideScore > 3;
    const bevestigingLaag = confirmScore === 0;
    const afgeleideLaag = afgeleideScore <= 1;
    const bevestigingHoog = confirmScore >= 2;
    riasecScores[letter] = riasecScore;
    riasecDetails[letter] = {
      afgeleideScore: round2(afgeleideScore),
      bevestigingScore: confirmScore,
      totaalScore: riasecScore,
      divergentie: (afgeleideHoog && bevestigingLaag) || (afgeleideLaag && bevestigingHoog),
      confirmItem: def.confirmItem,
    };
  }

  const studiegebiedScores: Record<string, number> = {};
  for (const [gebied, letters] of Object.entries(sm.tenStudyFields)) {
    studiegebiedScores[gebied] = round2(
      letters.reduce((s, l) => s + (riasecScores[l] || 0), 0),
    );
  }
  const studiegebiedSorted = Object.entries(studiegebiedScores)
    .sort((a, b) => b[1] - a[1])
    .map(([naam, score]) => ({ naam, score }));
  const topGebieden = studiegebiedSorted.slice(0, 3);

  // ── Interesse, rechtstreeks gemeten (blauwdruk §7) ───────────────────────
  const intFam = instrumentDef.families.find((f) => f.id === "Interesse");
  const intCons = intFam ? intFam.constructs : [];
  const intScores: Record<string, number> = {};
  for (const con of intCons) intScores[con] = constructs[con].recognition;
  const intSorted = intCons.slice().sort((a, b) => intScores[b] - intScores[a]);
  const intGroepen = groepeerRangorde(intSorted, (c) => intScores[c]);
  const intTopGroep = intGroepen[0] || [];

  // ── Drivers (blauwdruk §8) ───────────────────────────────────────────────
  //
  // ZES ITEMS, VIJF DRIVERS. Dat ziet er scheef uit maar klopt (punt 5 uit
  // fase 1). D1 tot en met D4 zijn herkenningsitems die elk een eigen driver
  // meten: Be Perfect, Please Others, Try Hard, Hurry Up. D5 en D6 zijn geen
  // vijfde en zesde driver maar situatie-items: je kiest een handelwijze en de
  // gekozen optie verdeelt ladingen over de driver die erachter zit. D5 optie b
  // laadt Please Others, D6 optie b laadt Hurry Up. Er is dus geen zesde driver
  // die ontbreekt.
  //
  // Blauwdruk regel 10 zegt het zo: "Constructen zonder energie-anker (D1-D4
  // drivers)", en TABEL 1 zet D5 en D6 in de rij "SJT-keuze", naast F4 en F5.
  // ITEMSELECTIE punt 3 telt het al voor: "Drivers (6 items, bron: clusters
  // 1-5)". Zes items, vijf clusters, zo bedoeld.
  //
  // Wat wel verwarrend blijft: D5 en D6 dragen in de data allebei het veld
  // construct "Be Strong". Dat veld wordt hier alleen gelezen om een
  // energyValue op te bergen, en geen van beide items heeft er een. Het doet
  // dus niets. Het is niet aangeraakt omdat de blauwdruk er niets over zegt en
  // wijzigen zou gokken zijn; het staat in het verslag van fase 1c.
  //
  // Let bij het lezen van driverScores op dat de vijf drivers een verschillend
  // bereik hebben, omdat ze een verschillend aantal bronnen hebben: Try Hard
  // 0 tot 3 (alleen D3), Be Perfect 0 tot 4, Hurry Up en Be Strong 0 tot 5,
  // Please Others 0 tot 6. Be Strong heeft zelfs helemaal geen eigen
  // herkenningsitem. De doorslagregel hieronder vergelijkt die ruwe sommen
  // rechtstreeks; het gevolg daarvan is gemeten en voorgelegd in het verslag.
  const driverFam = instrumentDef.families.find((f) => f.id === "Drivers");
  const driverCons = driverFam ? driverFam.constructs : [];
  const driverScores: Record<string, number> = {};
  for (const con of driverCons) driverScores[con] = constructs[con].recognition;
  const driverSorted = driverCons.slice().sort((a, b) => driverScores[b] - driverScores[a]);
  const tweedeDriver = driverSorted.length >= 2 ? driverScores[driverSorted[1]] : 0;
  let driverDoorslag: string | null = null;
  if (
    driverScores[driverSorted[0]] >= 3 &&
    driverScores[driverSorted[0]] >= C.driverDoorslagFactor * Math.max(tweedeDriver, 1)
  ) {
    driverDoorslag = driverSorted[0];
  }

  // ── Keerzijde (blauwdruk §9) ─────────────────────────────────────────────
  // De terugval "|| 2" die hier stond is weg om dezelfde reden als bij
  // tieMargin (punt 4): het getal hoort uit één plaats te komen, en die plaats
  // is het instrumentbestand. De waarde is niet veranderd.
  //
  // Het losse object scoringMap.leastCharacteristic wordt hier bewust niet
  // gelezen, want er is nog niets dat het kan tonen (punt 3). Daarin staat de
  // framing die de blauwdruk in punt 7 verplicht stelt: nuance, geen tekort.
  // Zie het verslag van fase 1c.
  const leastCount = C.leastCharacteristicCount;
  const minFoci = fociSorted.slice(-leastCount);
  const minVersnellers = versRangorde.slice(-leastCount);
  const minDrivers = driverSorted.slice(-leastCount);

  // ── Profielanker (blauwdruk §10) ─────────────────────────────────────────
  const ankerDef = sm.profileAnchor;
  const profielAnker = {
    profiel: p1,
    p2Detail: p2,
    toon: p1 ? (ankerDef[p1] ? ankerDef[p1].tone : null) : null,
    focus: p1 ? (ankerDef[p1] ? ankerDef[p1].focus : null) : null,
  };

  // ── Welzijnskritische signalen (blauwdruk §11) ───────────────────────────
  // Deze signalen hebben voorrang op alles: ze staan altijd in het
  // basisrapport en gaan altijd naar een mens.
  let totaalSignaal = 0;
  for (const id of SIGNAALDRAGENDE_ITEMS) {
    if (answers[id] != null) totaalSignaal++;
  }

  const activeAlerts: T4SAlert[] = [];
  const alertDefs = sm.alertOverride.triggers;
  function betekenisVan(id: string): string {
    const t = alertDefs.find((x) => x.id === id);
    return t ? t.meaning : "";
  }

  if (be2EnergyVal != null && be2EnergyVal <= C.beeldNietInEnergieDrempel) {
    activeAlerts.push({
      id: "beeld_niet_in_energie",
      meaning: betekenisVan("beeld_niet_in_energie"),
      toHuman: true,
      boodschap: alertBoodschap("beeld_niet_in_energie"),
    });
  }

  if (p1 === "B") {
    activeAlerts.push({
      id: "profiel_B_vastloper",
      meaning: betekenisVan("profiel_B_vastloper"),
      toHuman: true,
      boodschap: alertBoodschap("profiel_B_vastloper"),
    });
  }

  if (ijkpunt != null && ijkpunt <= 3) {
    activeAlerts.push({
      id: "lage_batterij",
      meaning: betekenisVan("lage_batterij"),
      toHuman: true,
      boodschap: alertBoodschap("lage_batterij"),
    });
  }

  if (totaalSignaal < C.voorlopigDrempel) {
    activeAlerts.push({
      id: "voorlopig_profiel",
      meaning: betekenisVan("voorlopig_profiel"),
      toHuman: false,
      boodschap: alertBoodschap("voorlopig_profiel"),
    });
  }

  // ── Betrouwbaarheid (blauwdruk §12) ──────────────────────────────────────
  const totaalItems = items.length;
  const voorlopig = totaalSignaal < C.voorlopigDrempel;

  // ── Beeldscherpte ────────────────────────────────────────────────────────
  // Twee dingen naast elkaar leggen: hoe zeker iemand zelf zegt te zijn, en hoe
  // uitgesproken het gemeten profiel is. Lopen die uiteen, dan is dat het
  // vermelden waard. De gewichten en drempels komen uit de bronmotor.
  //
  //   zelfZekerheid: P1 telt voor 40 procent (A = 0.8, B = 0.35, C = 0.6),
  //     de schuif van P2 voor 35 procent, het batterij-ijkpunt voor 25 procent.
  //     Ontbreekt er een, dan telt het gewicht van de overige zwaarder.
  //   profielUitgesprokenheid: de spreiding van de focus-scores, gedeeld door
  //     4.0 en begrensd op 1. Een vlak profiel geeft een lage waarde.
  const p1ZelfZekerheid = p1 === "A" ? 0.8 : p1 === "B" ? 0.35 : p1 === "C" ? 0.6 : null;
  const p2ZelfZekerheid = typeof p2 === "number" ? p2 / 10 : null;
  const i1ZelfZekerheid = ijkpunt != null ? ijkpunt / 10 : null;

  let zelfZekerheid: number | null = null;
  let gewichtTotaal = 0;
  let gewichtSom = 0;
  if (p1ZelfZekerheid != null) {
    gewichtSom += p1ZelfZekerheid * 0.4;
    gewichtTotaal += 0.4;
  }
  if (p2ZelfZekerheid != null) {
    gewichtSom += p2ZelfZekerheid * 0.35;
    gewichtTotaal += 0.35;
  }
  if (i1ZelfZekerheid != null) {
    gewichtSom += i1ZelfZekerheid * 0.25;
    gewichtTotaal += 0.25;
  }
  if (gewichtTotaal > 0) zelfZekerheid = round2(gewichtSom / gewichtTotaal);

  const fociVals = fociCons.map((f) => fociScores[f]);
  let profielUitgesprokenheid: number | null = null;
  if (fociVals.length >= 2) {
    const mean = fociVals.reduce((a, b) => a + b, 0) / fociVals.length;
    const variance = fociVals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / fociVals.length;
    profielUitgesprokenheid = round2(Math.min(Math.sqrt(variance) / 4.0, 1.0));
  }

  // Motorronde punt 5, met dezelfde regel als punt 4. Dit signaal legt twee
  // dingen naast elkaar: hoe zeker iemand zelf zegt te zijn, en hoe uitgesproken
  // zijn beeld is. Ontbreekt een van de twee, dan viel de motor terug op
  // "beeld_en_zekerheid_lopen_gelijk". Dat is een uitspraak over de deelnemer,
  // en bij een lege vragenlijst is er niets om haar op te baseren. Nu meldt het
  // signaal in dat geval dat er te weinig antwoorden zijn.
  let consistentieSignaal: string;
  if (zelfZekerheid == null || profielUitgesprokenheid == null) {
    consistentieSignaal = GEEN_MEETPUNT;
  } else if (zelfZekerheid >= 0.65 && profielUitgesprokenheid < 0.3) {
    consistentieSignaal = "hoge_zekerheid_open_beeld";
  } else if (zelfZekerheid <= 0.4 && profielUitgesprokenheid > 0.55) {
    consistentieSignaal = "lage_zekerheid_uitgesproken_beeld";
  } else {
    consistentieSignaal = "beeld_en_zekerheid_lopen_gelijk";
  }

  // ── Resultaat ────────────────────────────────────────────────────────────
  const constructScores: Record<string, T4SConstructScore> = {};
  for (const con of Object.keys(constructs)) {
    constructScores[con] = {
      family: constructs[con].family,
      recognition: constructs[con].recognition,
      avgEnergy: avgEnergy(con),
    };
  }

  return {
    contractVersion: sm.scorerVersion,
    instrumentId: instrumentDef.instrumentId,
    taal: gekozenTaal,
    deelnemer: Object.assign({ naam: "Anoniem", code: "TEST" }, deelnemer || {}),

    ijkpunt: { waarde: ijkpunt },

    energie: {
      ijkpunt0tot10: ijkpunt,
      kaart: energieKaart,
      bronnen: energieBronnen,
      lekken: energieLekken,
    },

    constructScores,

    foci: {
      scores: fociScores,
      sorted: fociSorted,
      topGroep: fociTopGroep,
      top2: fociTop2,
      balanslabels: fociBalans,
      groepen: fociGroepen,
    },

    versnellers: {
      scores: versScores,
      rangorde: versRangorde,
      kopGroep: versKopGroep,
      groepen: versGroepen,
      balanslabels: versBalans,
      dominante: dominanteVersneller,
      gedeeldMet: versKopGroep.slice(1),
    },

    convergentie,

    riasec: { scores: riasecScores, details: riasecDetails },

    studiegebieden: {
      scores: studiegebiedScores,
      gesorteerd: studiegebiedSorted,
      top: topGebieden,
    },

    studiestrategie: {
      dominanteVersneller,
      primair: studieStrategieInfo,
      secondaryVersneller,
      secundair: secondaryStrategie,
      gedeeldMet: versKopGroep.slice(1),
    },

    interesse: { scores: intScores, sorted: intSorted, topGroep: intTopGroep },

    drivers: {
      scores: driverScores,
      sorted: driverSorted,
      top2: driverSorted.slice(0, 2),
      doorslag: driverDoorslag,
    },

    keerzijde: { minFoci, minVersnellers, minDrivers },

    profielAnker,

    alerts: {
      actief: activeAlerts,
      alwaysInBasis: sm.alertOverride.alwaysInBasis,
      alwaysToHuman: sm.alertOverride.alwaysToHuman,
    },

    betrouwbaarheid: {
      beantwoord,
      totaalItems,
      totaalSignaal,
      voorlopigDrempel: C.voorlopigDrempel,
      voorlopig,
    },

    beeldScherpte: { zelfZekerheid, profielUitgesprokenheid, consistentieSignaal },

    betekenis: { keuze: betekenisKeuze },
    studeerstijl: { keuze: s1 },
  };
}
