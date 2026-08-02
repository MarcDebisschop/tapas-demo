import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 5 van de motorronde: een blijvende bewaking, naar het model van
// tests/labels-zijn-bereikbaar.test.ts voor T4Teens en T4Kids.
//
// WAAROM DEZE TEST BESTAAT
// Een rapport spreekt oordelen uit: "dit is een kernsterkte", "hier raak je
// overbelast", "je beeld en je zekerheid lopen gelijk". Bij elk van die
// oordelen horen twee vragen die niemand met het blote oog kan beantwoorden:
//
//   1. Kan dit oordeel werkelijk vallen? Een oordeel dat door de rekenregels
//      onbereikbaar is, staat wel in de teksten maar krijgt nooit iemand te
//      lezen. Zo bleek in T4Teens dat twee van de vijf antwoordpunten geen
//      eigen oordeel konden opleveren.
//   2. Valt dit oordeel niet altijd? Een oordeel dat iedereen krijgt, meet
//      niets. Het lijkt een uitspraak over deze deelnemer maar is er geen.
//
// Daarbovenop komt de vraag uit punt 4: levert een lege invulling nergens een
// oordeel op? Wie niets invulde, hoort niets over zichzelf te lezen.
//
// HOE ER GEMETEN WORDT
// Over een brede reeks doorgerekende invullingen: de lege invulling, elke vraag
// afzonderlijk op elk antwoordpunt dat het scherm aanbiedt, vierhonderd
// volledige invullingen met een herhaalbare trekking, en een handvol met de
// hand gebouwde uiterste hoeken. Die laatste staan erbij omdat een van de
// signalen alleen in zo'n hoek valt; dat is gemeten en staat beschreven in
// tests/t4students-naloop-schalen.test.ts onder naloop B. Zonder die hoeken zou
// deze test een onbereikbaar signaal melden dat in werkelijkheid bereikbaar is.
//
// WAT DEZE TEST NIET DOET
// Zij zegt niets over de vraag of een oordeel juist is of goed geformuleerd.
// Alleen of het kan vallen, of het niet altijd valt, en of het wegblijft
// wanneer er niets ingevuld is.
// ---------------------------------------------------------------------------

const items = I.sections.find((s) => s.sectionId === "main")!.items;
const sm = I.scoringMap;

const HERKENNING = [0, 1, 2, 3];
const ENERGIE = [-2, -1, 0, 1, 2];

/** Herhaalbare trekking: hetzelfde zaad geeft dezelfde reeks. */
function trekker(zaad: number) {
  let s = zaad;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

type Invulling = Record<string, any>;

/** Elk antwoord dat het scherm voor dit item toelaat, elk apart. */
function antwoordpuntenVan(it: (typeof items)[number]): Invulling[] {
  switch (it.itemType) {
    case "recognition":
      return HERKENNING.map((r) => ({ recognition: r }));
    case "recognition+energy":
      return HERKENNING.flatMap((r) => ENERGIE.map((e) => ({ recognition: r, energy: e })));
    case "sjt":
    case "profile-select":
    case "context-choice":
      return (it.options ?? []).map((o) => ({ choice: o.key }));
    case "interest":
      return HERKENNING.map((v) => ({ interest: v }));
    case "battery":
      return [0, 3, 5, 8, 10].map((v) => ({ value: v }));
    default:
      // P2 heeft twee vormen: een schuif bij profiel A, een keuze bij B en C.
      return [{ value: 0 }, { value: 5 }, { value: 10 }, ...(it.options ?? []).map((o) => ({ choice: o.key }))];
  }
}

function willekeurigAntwoord(it: (typeof items)[number], random: () => number): Invulling | null {
  const punten = antwoordpuntenVan(it);
  return punten.length ? punten[Math.floor(random() * punten.length)]! : null;
}

/**
 * De uiterste hoeken die met een trekking niet of nauwelijks bovenkomen. Zij
 * zijn niet verzonnen om een test groen te krijgen: elk is een gemeten hoek van
 * de antwoordruimte, met de test erbij waar hij vandaan komt.
 */
const HOEKEN: Invulling[] = [
  // Het uitgesproken beeld bij lage zelfzekerheid (naloop B).
  {
    F1: { recognition: 0 }, F2: { recognition: 0 }, F3: { recognition: 0 }, F6: { recognition: 0 },
    F7: { recognition: 3 }, F8: { recognition: 3 },
    D5: { choice: "b" }, D6: { choice: "a" }, F4: { choice: "a" }, F5: { choice: "a" },
    P1: { choice: "B" }, P2: { value: 0 }, I1: { value: 0 },
  },
  // Het open beeld bij hoge zelfzekerheid: alle foci even sterk, zekerheid hoog.
  {
    F1: { recognition: 2 }, F2: { recognition: 2 }, F3: { recognition: 2 }, F6: { recognition: 2 },
    F7: { recognition: 2 }, F8: { recognition: 2 },
    P1: { choice: "A" }, P2: { value: 10 }, I1: { value: 10 },
  },
];

function reeks(): Invulling[] {
  const uit: Invulling[] = [{}];
  for (const it of items) {
    for (const antwoord of antwoordpuntenVan(it)) uit.push({ [it.id]: antwoord });
  }
  const random = trekker(20260807);
  for (let n = 0; n < 400; n++) {
    const a: Invulling = {};
    for (const it of items) {
      const antwoord = willekeurigAntwoord(it, random);
      if (antwoord) a[it.id] = antwoord;
    }
    uit.push(a);
  }
  uit.push(...HOEKEN);
  return uit;
}

const invullingen = reeks();
const uitkomsten = invullingen.map((a) => scoreStudiekompas(I, a, null, "nl"));

/** Elk oordeel dat het rapport over een construct of een item uitspreekt. */
function oordeelCellen(r: (typeof uitkomsten)[number]): string[] {
  return [
    ...Object.values(r.versnellers.balanslabels),
    ...Object.values(r.foci.balanslabels),
    ...Object.values(r.energie.kaart),
    ...Object.values(r.drivers.energielabels),
  ];
}

const cellen = uitkomsten.flatMap(oordeelCellen);
const signalen = uitkomsten.map((r) => r.beeldScherpte.consistentieSignaal);
const alertIds = uitkomsten.map((r) => r.alerts.actief.map((a) => a.id));

const BALANSLABELS = ["kernsterkte", "overbelast", "onderbenut", "latent"];
const ENERGIESTATUSSEN = ["kernsterkte", "overbelasting", "onderbenutting", "neutraal"];
/**
 * Het energiesaldo van een driver in een eigen woord. "neutraal" staat al in de
 * lijst hierboven en betekent daar hetzelfde: gemeten, en het saldo is nul.
 */
const DRIVER_ENERGIELABELS = ["remmend", "neutraal", "gaspedaal"];
const SIGNALEN = [
  "beeld_en_zekerheid_lopen_gelijk",
  "hoge_zekerheid_open_beeld",
  "lage_zekerheid_uitgesproken_beeld",
];
const ALERTS = ["beeld_niet_in_energie", "profiel_B_vastloper", "lage_batterij", "voorlopig_profiel"];
const GEEN_OORDEEL = "te_weinig_antwoorden";

const aantalMet = (label: string) => cellen.filter((c) => c === label).length;

describe("punt 5: de reeks invullingen is breed genoeg om iets te bewijzen", () => {
  it("de reeks bevat de lege invulling, elk antwoordpunt apart en volledige invullingen", () => {
    expect(invullingen.length).toBeGreaterThan(500);
    expect(cellen.length).toBeGreaterThan(15000);
    expect(invullingen[0]).toEqual({});
  });

  it("de reeks is herhaalbaar, zodat een gezakte test na te kijken is", () => {
    expect(JSON.stringify(reeks())).toBe(JSON.stringify(invullingen));
  });
});

describe("punt 5: elk oordeel kan vallen en geen enkel oordeel valt altijd", () => {
  it.each(BALANSLABELS)("het balanslabel '%s' valt en valt niet altijd", (label) => {
    expect(aantalMet(label), `${label} valt nooit`).toBeGreaterThan(0);
    expect(aantalMet(label), `${label} valt altijd`).toBeLessThan(cellen.length);
  });

  it.each(ENERGIESTATUSSEN)("de energiestatus '%s' valt en valt niet altijd", (label) => {
    expect(aantalMet(label), `${label} valt nooit`).toBeGreaterThan(0);
    expect(aantalMet(label), `${label} valt altijd`).toBeLessThan(cellen.length);
  });

  it.each(DRIVER_ENERGIELABELS)("het energielabel '%s' van een driver valt en valt niet altijd", (label) => {
    expect(aantalMet(label), `${label} valt nooit`).toBeGreaterThan(0);
    expect(aantalMet(label), `${label} valt altijd`).toBeLessThan(cellen.length);
  });

  it("de melding dat er te weinig antwoorden zijn, valt en valt niet altijd", () => {
    expect(aantalMet(GEEN_OORDEEL)).toBeGreaterThan(0);
    expect(aantalMet(GEEN_OORDEEL)).toBeLessThan(cellen.length);
  });

  it.each(SIGNALEN)("het consistentiesignaal '%s' valt en valt niet altijd", (label) => {
    const n = signalen.filter((s) => s === label).length;
    expect(n, `${label} valt nooit`).toBeGreaterThan(0);
    expect(n, `${label} valt altijd`).toBeLessThan(signalen.length);
  });

  it.each(ALERTS)("de melding '%s' valt en valt niet altijd", (id) => {
    const n = alertIds.filter((ids) => ids.includes(id)).length;
    expect(n, `${id} valt nooit`).toBeGreaterThan(0);
    expect(n, `${id} valt altijd`).toBeLessThan(alertIds.length);
  });

  it("er komt geen enkel oordeel voor dat hierboven niet opgesomd staat", () => {
    // Anders kan er een oordeel bijkomen dat nooit bewaakt wordt.
    const bekend = new Set([
      ...BALANSLABELS,
      ...ENERGIESTATUSSEN,
      ...DRIVER_ENERGIELABELS,
      GEEN_OORDEEL,
      "niet_van_toepassing",
    ]);
    const onbekend = [...new Set(cellen)].filter((c) => !bekend.has(c));
    expect(onbekend, `onbewaakte oordelen: ${onbekend.join(", ")}`).toEqual([]);
    expect(
      [...new Set(signalen)].filter((s) => !SIGNALEN.includes(s) && s !== GEEN_OORDEEL),
    ).toEqual([]);
    expect([...new Set(alertIds.flat())].filter((a) => !ALERTS.includes(a))).toEqual([]);
  });
});

describe("punt 5: een lege invulling levert nergens een oordeel op", () => {
  const leeg = uitkomsten[0]!;

  it("elk construct en elk energie-item meldt dat er te weinig antwoorden zijn", () => {
    for (const cel of oordeelCellen(leeg)) expect(cel).toBe(GEEN_OORDEEL);
  });

  it("er staat geen getal waar niets gemeten is", () => {
    for (const [con, s] of Object.entries(leeg.constructScores)) {
      expect(s.avgEnergy, `${con} heeft een energiegetal zonder antwoorden`).toBeNull();
    }
    expect(leeg.beeldScherpte.zelfZekerheid).toBeNull();
    expect(leeg.drivers.doorslag).toBeNull();
  });

  it("het consistentiesignaal spreekt zich niet uit", () => {
    // "beeld_en_zekerheid_lopen_gelijk" is een uitspraak over de deelnemer, en
    // de zelfzekerheid waarop zij steunt is hier niet gemeten.
    expect(leeg.beeldScherpte.consistentieSignaal).toBe(GEEN_OORDEEL);
  });

  it("de enige melding is dat het profiel voorlopig is", () => {
    // Dat is geen oordeel over de deelnemer maar over het rapport zelf, en het
    // is precies de melding die hier hoort te staan.
    expect(leeg.alerts.actief.map((a) => a.id)).toEqual(["voorlopig_profiel"]);
  });
});

describe("punt 5: wat gemeten is en niet meer kan vallen", () => {
  it("'niet_van_toepassing' valt nergens meer, en dat is bekend", () => {
    // Dit label bestaat voor een construct zonder energie-anker. Tot de
    // motorronde waren dat Systematisch/Uitvoerend en Sociaal Interactief; sinds
    // punt 1 heeft elk construct waarvoor een balanslabel wordt uitgerekend een
    // eigen anker. Het label is dus onbereikbaar geworden. Het blijft staan als
    // vangnet voor een instrument waarin een anker ontbreekt, en het getal nul
    // hieronder houdt bij of dat nog altijd zo is. Wordt dit ooit meer dan nul,
    // dan is er een anker verdwenen en hoort daar een besluit over genomen te
    // worden.
    expect(aantalMet("niet_van_toepassing")).toBe(0);
    const zonderAnker = ["Talent-versnellers", "Talent-foci"]
      .flatMap((f) => I.families.find((x) => x.id === f)!.constructs)
      .filter((c) => !sm.energyItems.some((id) => items.find((i) => i.id === id)?.construct === c));
    expect(zonderAnker).toEqual([]);
  });
});
