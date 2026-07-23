// ---------------------------------------------------------------------------
// T4P Business Profiel — volledige, code-gegenereerde 24-secties-generator.
//
// bouwT4pBusinessProfiel(contract): T4pRapportInhoud
//   Bouwt de 24 secties uit het bevroren generatorContract (v1.0.0). Alle
//   cijfers/tabellen komen uit scoring.ts (contract.sections.main / .connection);
//   er worden NOOIT cijfers verzonnen. Waar de referentie hand-geschreven,
//   deelnemer-specifieke proza toont (Inner Why, gepersonaliseerde mantra, ...)
//   valt de generator terug op nette, generieke-maar-correcte duiding op basis
//   van de contract-data, of laat de regel weg.
//
// renderT4pBusinessProfielHtml(inhoud): string
//   Zelfstandige, TaPasCity-gebrande HTML voor weergave/PDF-preview.
//
// Terminologie: "drivers" (Taibi Kahler) — nooit "drijfveren".
// ---------------------------------------------------------------------------

import { isTapasBeeld } from "../../shared/talent-constructs";

// --- Types -----------------------------------------------------------------

export interface T4pKpi {
  waarde: string;
  label: string;
}
export interface T4pTabel {
  kolommen: string[];
  rijen: (string | number)[][];
}
export interface T4pBlok {
  kop: string;
  tekst: string;
}
export interface T4pSectie {
  nummer: string;
  titel: string;
  ondertitel?: string;
  paragrafen?: string[];
  kpis?: T4pKpi[];
  tabel?: T4pTabel;
  tabellen?: { kop?: string; tabel: T4pTabel }[];
  blokken?: T4pBlok[];
  citaten?: string[];
  saldo?: { label: string; waarde: string; toelichting?: string };
  bronnen?: { titel: string; url: string }[];
  mantra?: string;
}
export interface T4pRapportInhoud {
  instrument: "t4p-business-kompas";
  variant: string;
  taal: string;
  titel: string;
  ondertitel: string;
  respondent: {
    naam: string;
    code: string;
    organisatie: string | null;
    functie: string | null;
  };
  rapportdatum: string;
  databronnen: string;
  gegenereerdOp: string;
  inhoudsopgave: { nummer: string; titel: string }[];
  secties: T4pSectie[];
  disclaimer: string;
}

// --- Hulpfuncties ----------------------------------------------------------

interface ConstructRowLike {
  construct: string;
  family: string;
  most: number;
  least: number;
  net: number;
  shown: number;
  avgEnergy: number;
  energySource?: string;
  mostItems?: string[];
  toelichtingen?: string[];
}

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

// Belgisch getalformaat: komma als decimaalteken, plusteken voor positief.
function fmt(x: number, decimals = 2, teken = false): string {
  const s = x.toFixed(decimals).replace(".", ",");
  if (teken && x > 0) return "+" + s;
  return s;
}

// Statuslabel uit gemiddelde energie: >0,25 geeft · <-0,25 kost · anders neutraal.
function statusVanEnergie(avg: number): "geeft" | "kost" | "neutraal" {
  if (avg > 0.25) return "geeft";
  if (avg < -0.25) return "kost";
  return "neutraal";
}

function som(rows: ConstructRowLike[]): number {
  return Math.round(rows.reduce((a, r) => a + num(r.avgEnergy), 0) * 100) / 100;
}

// Canonieke E/H-metadata per construct (construct-metadata uit de referentie,
// geen deelnemer-data). Ontbreekt een construct, dan wordt de strip-regel
// weggelaten (robuust).
const EH_MAP: Record<string, { code: string; duiding: string }> = {
  Innovatie: { code: "E+H", duiding: "Vernieuwt zowel inhoudelijk als verbindend." },
  "Inter-relationeel": { code: "H", duiding: "Volledig mensgericht: aanvoelen wat leeft." },
  Operationeel: { code: "E", duiding: "Vooral functioneel: processen bruikbaar maken." },
  Strategie: { code: "E", duiding: "Klassiek-functioneel positioneren." },
  Analyse: { code: "E+H", duiding: "Ordent complexiteit inhoudelijk én in samenwerking." },
  Coaching: { code: "H", duiding: "Mensgericht: individuen respectvol in beweging brengen." },
  Impact: { code: "E+H", duiding: "Charismatische beweging richting inhoud én mensen." },
  "Constructief onderscheidend": { code: "E", duiding: "Het verschilmakende beeld vormen — functioneel." },
  Faciliteren: { code: "H", duiding: "Teamafstemming en groepsdynamiek ondersteunen." },
  Resultaatgericht: { code: "E", duiding: "Een concreet resultaatbeeld vormen — functioneel." },
};

function lijst(namen: string[]): string {
  if (namen.length === 0) return "";
  if (namen.length === 1) return namen[0];
  return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
}

function statusZin(status: "geeft" | "kost" | "neutraal"): string {
  if (status === "geeft") return "geeft per saldo energie";
  if (status === "kost") return "kost per saldo energie";
  return "is per saldo energetisch neutraal";
}

// Generieke, correcte lezing per construct op basis van net en status.
function generiekeLezing(r: ConstructRowLike): string {
  const st = statusVanEnergie(num(r.avgEnergy));
  const richting =
    r.net > 0 ? "sterk herkend" : r.net === 0 ? "wisselend herkend" : "minder herkend";
  const energie =
    st === "geeft"
      ? "en geeft vandaag energie"
      : st === "kost"
      ? "maar kost vandaag energie"
      : "met een neutraal energiebeeld";
  return `${richting} ${energie}.`;
}

const INHOUDSOPGAVE: { nummer: string; titel: string }[] = [
  { nummer: "01", titel: "Profiel in één oogopslag" },
  { nummer: "02", titel: "Leeswijzer en datakwaliteit" },
  { nummer: "03", titel: "Professionele energiestaat" },
  { nummer: "04", titel: "TaPas-Beeld — identiteit, waarden en congruentie" },
  { nummer: "05", titel: "Drivers" },
  { nummer: "06", titel: "Bronstellingen — motivatie" },
  { nummer: "07", titel: "Talent-foci" },
  { nummer: "08", titel: "Bronstellingen — aandacht" },
  { nummer: "09", titel: "Talent-versnellers" },
  { nummer: "10", titel: "Bronstellingen — inzet" },
  { nummer: "11", titel: "Bronlezing — herkenbare talentcombinaties" },
  { nummer: "12", titel: "Drieledige talentdynamiek" },
  { nummer: "13", titel: "De talentmotor in één oogopslag" },
  { nummer: "14", titel: "Verbondenheid met de organisatie" },
  { nummer: "15", titel: "Werkcontext en rolfit" },
  { nummer: "16", titel: "Ontwikkelrisico's en waakpunten" },
  { nummer: "17", titel: "Energielekken en minder vanzelfsprekende talentlijnen" },
  { nummer: "18", titel: "Toekomstgerichte synthese" },
  { nummer: "19", titel: "Toekomstpistes en carrièrekansen" },
  { nummer: "20", titel: "Vertaling naar gevestigde kaders" },
  { nummer: "21", titel: "Wetenschappelijke onderbouwing" },
  { nummer: "22", titel: "Technische bijlage" },
  { nummer: "23", titel: "Grondslagen" },
  { nummer: "24", titel: "Mantra en dankwoord" },
];

const BRONNEN: { titel: string; url: string }[] = [
  { titel: "Self-Determination Theory — Deci & Ryan", url: "https://selfdeterminationtheory.org/theory/" },
  { titel: "Flow — Csikszentmihalyi", url: "https://www.apa.org/topics/flow" },
  { titel: "Job Demands-Resources model — Bakker & Demerouti", url: "https://doi.org/10.1108/02683940710733115" },
  { titel: "Big Five — McCrae & Costa", url: "https://doi.org/10.1037/0022-3514.52.1.81" },
  { titel: "RIASEC / Holland Codes — person-environment fit", url: "https://www.apa.org/ed/precollege/psn/2013/09/career-interests" },
  { titel: "Deliberate practice — Ericsson", url: "https://doi.org/10.1037/0033-295X.100.3.363" },
  { titel: "Leadership Code — Dave Ulrich", url: "https://rbl.net/insights/articles/the-leadership-code" },
  { titel: "Time Span of Discretion — Elliott Jaques", url: "https://doi.org/10.1111/j.1467-6486.1990.tb00255.x" },
];

// --- Hoofdbouwer -----------------------------------------------------------

export function bouwT4pBusinessProfiel(contract: any): T4pRapportInhoud {
  const p = contract?.participant ?? {};
  // Taal van het contract, met terugval op NL. Wordt gebruikt om (mogelijk
  // meertalige) bronstellingen naar één taal op te lossen.
  const contractTaal: string = contract?.taal ?? "nl";
  // Los een (mogelijk meertalig) tekstveld op naar een leesbare string.
  // Achtergrond: het bevroren generatorContract kan `mostItems` bevatten als
  // { nl, fr, en, ... }-objecten i.p.v. platte strings. Zonder deze resolutie
  // rendert esc() zo'n object als "[object Object]" in de bronstellingen-secties
  // (06/08/10). Deze helper is achterwaarts compatibel: strings blijven strings.
  const citaatTekst = (veld: unknown): string => {
    if (veld == null) return "";
    if (typeof veld === "string") return veld;
    if (typeof veld === "object") {
      const o = veld as Record<string, unknown>;
      const kandidaat =
        (typeof o[contractTaal] === "string" && (o[contractTaal] as string)) ||
        (typeof o.nl === "string" && (o.nl as string)) ||
        Object.values(o).find((v) => typeof v === "string");
      return typeof kandidaat === "string" ? kandidaat : "";
    }
    return String(veld);
  };
  const main = contract?.sections?.main ?? {};
  const meta = main?.meta ?? {};
  const alleRows: ConstructRowLike[] = Array.isArray(main?.constructRows) ? main.constructRows : [];
  const familyRows: { family: string; avgEnergy: number }[] = Array.isArray(main?.familyRows)
    ? main.familyRows
    : [];
  const connection = contract?.sections?.connection ?? {};
  const connAnswers = connection?.answers ?? {};
  const connLabels: Record<string, string> = connection?.labels ?? {};
  const connScale = connection?.scale ?? "0-10";

  // Rijen per familie, gesorteerd op net (aflopend). TaPas-Beeld nooit in foci-lijst.
  const drivers = alleRows
    .filter((r) => r.family === "Drivers")
    .sort((a, b) => num(b.net) - num(a.net));
  const foci = alleRows
    .filter((r) => r.family === "Talent-foci" && !isTapasBeeld(r.construct))
    .sort((a, b) => num(b.net) - num(a.net));
  const versnellers = alleRows
    .filter((r) => r.family === "Talent-versnellers")
    .sort((a, b) => num(b.net) - num(a.net));
  const tapasBeeld = alleRows.find((r) => isTapasBeeld(r.construct));

  const saldoDrivers = som(drivers);
  const saldoFoci = som(foci);
  const saldoVersnellers = som(versnellers);

  const beleefd = num(meta?.baselineProfessionalEnergy);
  const gemeten = num(meta?.normalizedQuestionnaireEnergy);
  const discrepantie = num(meta?.energyDiscrepancy);
  const gemConstruct = num(meta?.averageEnergy);
  const consistency = meta?.consistency ?? {};
  const driverRisk = meta?.driverRisk ?? {};

  const secties: T4pSectie[] = [];

  // 01 — Profiel in één oogopslag ------------------------------------------
  const zelf = num(connAnswers?.q3);
  const org = num(connAnswers?.q4);
  const sterktes = [...foci, ...versnellers]
    .filter((r) => statusVanEnergie(num(r.avgEnergy)) === "geeft")
    .sort((a, b) => num(b.avgEnergy) - num(a.avgEnergy))
    .slice(0, 3)
    .map((r) => `${r.construct} geeft energie en opent het talent.`);
  const spanningen: string[] = [];
  if (isFinite(beleefd) && isFinite(gemeten) && Math.abs(discrepantie) >= 1) {
    spanningen.push(
      `Beleefde startenergie (${fmt(beleefd, 1)}/10) verschilt van de gemeten energie (${fmt(
        gemeten,
        1
      )}/10).`
    );
  }
  const kostDrivers = drivers.filter((r) => statusVanEnergie(num(r.avgEnergy)) === "kost");
  if (kostDrivers.length) {
    spanningen.push(`De driver ${kostDrivers[0].construct} werkt vandaag als rem op talentinzet.`);
  }
  if (isFinite(zelf) && isFinite(org) && zelf - org >= 3) {
    spanningen.push(`Scheef ervaren wederkerigheid met de organisatie (zelf ${zelf}, organisatie ${org}).`);
  }
  const implicaties: string[] = [];
  if (foci.some((r) => statusVanEnergie(num(r.avgEnergy)) !== "kost")) {
    implicaties.push("Ruimte voor betekenisvolle, energiegevende inzet met minder belastende taken.");
  }
  if (kostDrivers.length) {
    implicaties.push("Expliciete afspraken over wanneer iets 'goed genoeg' is.");
  }
  if (isFinite(zelf) && isFinite(org) && zelf - org >= 3) {
    implicaties.push("Wederkerigheid zichtbaar maken om verbondenheid te herstellen.");
  }
  secties.push({
    nummer: "01",
    titel: "Profiel in één oogopslag",
    ondertitel: "Het profiel in zes cijfers, met sterktes, spanningen en ontwerpkeuzes.",
    kpis: [
      { waarde: `${fmt(beleefd, 1)}/10`, label: "Beleefde startenergie" },
      { waarde: `${fmt(gemeten, 1)}/10`, label: "Gemeten energie" },
      { waarde: fmt(discrepantie, 1, true), label: "Energiediscrepantie" },
      { waarde: `${Math.round(num(consistency?.score))}/100`, label: `Consistentie (${consistency?.label ?? "—"})` },
      { waarde: String(driverRisk?.label ?? "—"), label: "Driver-risico" },
      { waarde: `${isFinite(zelf) ? zelf : "—"} / ${isFinite(org) ? org : "—"}`, label: "Zelf- vs. org-investering" },
    ],
    blokken: [
      { kop: "Drie dragende sterktes", tekst: sterktes.length ? sterktes.join(" ") : "Nog onvoldoende energiegevende talentlijnen om sterktes te benoemen." },
      { kop: "Drie actuele spanningen", tekst: spanningen.length ? spanningen.join(" ") : "Geen uitgesproken spanningen uit de data." },
      { kop: "Drie ontwerpimplicaties", tekst: implicaties.length ? implicaties.join(" ") : "Geen specifieke ontwerpimplicaties uit de data." },
    ],
  });

  // 02 — Leeswijzer en datakwaliteit ---------------------------------------
  const ingevuld = num(meta?.completedScreens);
  const totaal = num(meta?.totalScreens);
  const keuzes = num(meta?.totalChoices);
  secties.push({
    nummer: "02",
    titel: "Leeswijzer en datakwaliteit",
    ondertitel: "Hoe u dit rapport leest — energie als taal, rangorde als betekenis, data als basis.",
    paragrafen: [
      "Dit profiel leest talent, energie en context als één samenhangend geheel. De cijfers tonen geen " +
        "rangorde van 'beter' of 'slechter', maar waar talent vandaag het makkelijkst beschikbaar wordt en " +
        "waar energie wint of lekt.",
      "Energie als leestaal: de energiestatus toont per construct de beschikbaarheid van energie — geeft, " +
        "neutraal of kost. Energie toont nooit belangrijkheid en is nooit een sorteersleutel.",
      "Rangorde en betekenis: constructen staan altijd op nettoscore (meest herkend min minst herkend), " +
        "aflopend gerangschikt. De volgorde is geen scoreladder, maar toont welke ingang het talent het " +
        "makkelijkst opent.",
      `Datakwaliteit: de vragenlijst werd ingevuld voor ${ingevuld}/${totaal} schermen (${keuzes} keuzes). ` +
        `De interne consistentie is ${Math.round(num(consistency?.score))}/100 (${consistency?.label ?? "—"}). ` +
        `Het verschil tussen beleefde startenergie (${fmt(beleefd, 1)}/10) en gemeten energie (${fmt(
          gemeten,
          1
        )}/10) is een interpretatief signaal, geen diagnose.`,
    ],
  });

  // 03 — Professionele energiestaat ----------------------------------------
  secties.push({
    nummer: "03",
    titel: "Professionele energiestaat",
    ondertitel: "Hoe energie vandaag beschikbaar is — beleefd, gemeten en per saldo.",
    tabel: {
      kolommen: ["Meting", "Waarde", "Lezing"],
      rijen: [
        ["Beleefde startenergie", `${fmt(beleefd, 1)}/10`, "Zelf-ingeschatte energie bij de start."],
        ["Gemeten energie", `${fmt(gemeten, 1)}/10`, "Uit de antwoorden berekende energie."],
        ["Energiediscrepantie", fmt(discrepantie, 1, true), discrepantie < 0 ? "De talentinhoud draagt meer energie dan vooraf beleefd." : "De beleefde energie ligt in lijn met of boven de gemeten energie."],
        ["Gemiddelde constructenergie", fmt(gemConstruct, 2, true), gemConstruct >= 0 ? "Per saldo licht positief over alle constructen heen." : "Per saldo licht negatief over alle constructen heen."],
      ],
    },
    blokken: [
      {
        kop: "Kernboodschap",
        tekst:
          discrepantie < 0
            ? "De inhoudelijke talentlijnen dragen merkbaar meer energie dan vooraf ingeschat. Het werk zelf is niet het probleem; de beleving aan de start is voorzichtiger."
            : "De beleefde en gemeten energie liggen in lijn met elkaar.",
      },
      {
        kop: "Professionele betekenis",
        tekst:
          "Interpretatie. De discrepantie tussen beleefde en gemeten energie wijst op de mate waarin talentinhoud energie teruggeeft zodra ze wordt ingezet. Een lage startwaarde vraagt aandacht voor context en herstelmomenten, niet voor de talentkern zelf.",
      },
      {
        kop: "Bewaking of risico",
        tekst:
          "Hypothese. Een blijvend lage beleefde startenergie kan, samen met een hoge kwaliteitslat, op termijn uitputting in de hand werken. Dit is een denkpiste, geen diagnose.",
      },
      {
        kop: "Actie of ontwerpimplicatie",
        tekst:
          "Bewaak bewust de overgang naar werk dat energie geeft, plan herstelmomenten en maak de positieve energielijnen expliciet zichtbaar in de rolinvulling.",
      },
    ],
  });

  // 04 — TaPas-Beeld — identiteit, waarden en congruentie ------------------
  const saldoIdentiteit = tapasBeeld ? num(tapasBeeld.avgEnergy) : null;
  secties.push({
    nummer: "04",
    titel: "TaPas-Beeld — identiteit, waarden en congruentie",
    ondertitel: "De laag onder het talent: waaruit gewerkt wordt, hoe het talent gezien wordt, en of dat vandaag samenvalt.",
    saldo:
      saldoIdentiteit !== null
        ? {
            label: "Energiesaldo identiteit & zelfbeeld",
            waarde: fmt(saldoIdentiteit, 2, true),
            toelichting:
              statusVanEnergie(saldoIdentiteit) === "geeft"
                ? "dit identiteitsbewuste zelfbeeld geeft vandaag energie"
                : statusVanEnergie(saldoIdentiteit) === "kost"
                ? "dit identiteitsbewuste zelfbeeld kost vandaag energie"
                : "dit identiteitsbewuste zelfbeeld is energetisch neutraal",
          }
        : undefined,
    paragrafen: [
      "T4P leest talent nooit los van identiteit, waarden en betekenis. Deze laag maakt zichtbaar of het " +
        "werk niet alleen góéd kan worden gedaan, maar ook past bij wie iemand ten diepste is en wil zijn. " +
        "Die congruentie bepaalt mee of talent duurzaam energie geeft of stilaan leegloopt.",
    ],
    blokken: [
      {
        kop: "Congruentie",
        tekst:
          "Hypothese. Deze inschatting leest of professionele inzet vandaag samenvalt met identiteit, waarden en betekenis. De Inner Why (waaruit iemand werkt) en de InnerView (hoe iemand het eigen talent ziet) vragen een persoonlijk gesprek om volledig ingevuld te worden — dit rapport toont hier de energetische kalibratie, geen woordelijke persoonlijke tekst.",
      },
      {
        kop: "Wat vandaag al klopt",
        tekst:
          sterktes.length
            ? "De energiegevende talentlijnen (" + lijst([...foci, ...versnellers].filter((r) => statusVanEnergie(num(r.avgEnergy)) === "geeft").slice(0, 3).map((r) => r.construct)) + ") sluiten aan bij wat energie geeft."
            : "De energiegevende talentlijnen vormen het startpunt voor congruentie.",
      },
      {
        kop: "Wat aandacht vraagt",
        tekst:
          kostDrivers.length
            ? "Onder druk raken de energiegevende lijnen als eerste op de achtergrond, versterkt door " + kostDrivers[0].construct + "."
            : "Onder druk kunnen de meest energiegevende lijnen als eerste op de achtergrond raken.",
      },
      {
        kop: "Startpunt voor de talentmotor",
        tekst:
          "Een context die kwaliteit én betekenis waardeert en wederkerigheid expliciet maakt, ontgrendelt de talentmotor het snelst.",
      },
    ],
  });

  // Hulpfunctie voor een familie-tabel (05/07/09).
  const familieTabel = (rows: ConstructRowLike[], kop: string): T4pTabel => ({
    kolommen: [kop, "Net", "Energie", "Status", "Lezing"],
    rijen: rows.map((r) => [
      r.construct,
      fmt(num(r.net), 0, true),
      fmt(num(r.avgEnergy), 2, true),
      statusVanEnergie(num(r.avgEnergy)),
      generiekeLezing(r),
    ]),
  });

  // E/H-strip als tabel (07/09).
  const ehStrip = (rows: ConstructRowLike[]): T4pTabel => ({
    kolommen: ["Construct", "E/H", "Duiding"],
    rijen: rows
      .filter((r) => EH_MAP[r.construct])
      .map((r) => [r.construct, EH_MAP[r.construct].code, EH_MAP[r.construct].duiding]),
  });

  // 05 — Drivers ------------------------------------------------------------
  secties.push({
    nummer: "05",
    titel: "Drivers",
    ondertitel: "Wat onbewust mee stuurt — rangorde, energiekost en kantelpunten.",
    saldo: {
      label: "Energiesaldo Drivers",
      waarde: fmt(saldoDrivers, 2, true),
      toelichting: "dit construct " + statusZin(statusVanEnergie(saldoDrivers)),
    },
    tabel: familieTabel(drivers, "Driver"),
    blokken: [
      {
        kop: "Kernboodschap",
        tekst:
          "De term drivers verwijst naar onbewuste, aangeleerde mechanismen (naar Taibi Kahler) die gedrag onder druk kunnen aansturen. Ze zijn niet goed of slecht: ze kunnen als gaspedaal werken of als rem. " +
          (drivers.length
            ? "De sterkst aanwezige driver is " + drivers[0].construct + "."
            : ""),
      },
      {
        kop: "Professionele betekenis",
        tekst:
          kostDrivers.length
            ? "Interpretatie. Een energiekostende driver (" + kostDrivers[0].construct + ") kan vandaag als rem werken op de talent-foci en versnellers; het talent komt pas vrij wanneer deze driver context-matig ontgrendeld wordt."
            : "Interpretatie. De drivers komen het sterkst tot hun recht waar kwaliteit, verdieping en echte meerwaarde gewaardeerd worden.",
      },
      {
        kop: "Bewaking of risico",
        tekst:
          "Hypothese. Onbegrensd kunnen sterke kwaliteits- en ambitiedrivers leiden tot uitputting, delegatieproblemen en het gevoel dat het nooit goed genoeg is.",
      },
      {
        kop: "Actie of ontwerpimplicatie",
        tekst:
          "Stem kwaliteitsnormen, verantwoordelijkheidsgrenzen en verwachtingen bewust af. Maak afspraken over wanneer iets 'goed genoeg' is en organiseer expliciete afrondingsmomenten.",
      },
    ],
  });

  // 06 — Bronstellingen — motivatie ----------------------------------------
  const driverCitaten: string[] = [];
  drivers.forEach((r) => {
    (r.mostItems ?? []).forEach((t) => driverCitaten.push(citaatTekst(t)));
    (r.toelichtingen ?? []).forEach((t) =>
      driverCitaten.push(`${citaatTekst(t)} (toelichting bij ${r.construct})`)
    );
  });
  secties.push({
    nummer: "06",
    titel: "Bronstellingen — motivatie",
    ondertitel: "De letterlijke stellingen achter de drivers — onbewerkt uit de vragenlijst.",
    paragrafen: [
      "Hieronder staan de stellingen die bij de drivers het sterkst herkend werden, verbatim overgenomen. " +
        "Ze vormen de bewijslaag onder de duiding.",
    ],
    citaten: driverCitaten,
    blokken: [
      {
        kop: "Over de minst herkende lijnen",
        tekst:
          "Bij de drivers zijn geen afzonderlijke 'minst herkende' stellingen vastgelegd die hier woordelijk kunnen worden weergegeven. De minst herkende lijnen blijken uit de lage nettoscores in hoofdstuk 5 en worden daar geduid, zonder citaten te reconstrueren.",
      },
    ],
  });

  // 07 — Talent-foci --------------------------------------------------------
  secties.push({
    nummer: "07",
    titel: "Talent-foci",
    ondertitel: "Waar de natuurlijke aandacht naartoe gaat — een aandachtstopografie.",
    saldo: {
      label: "Energiesaldo Talent-foci",
      waarde: fmt(saldoFoci, 2, true),
      toelichting: "dit construct " + statusZin(statusVanEnergie(saldoFoci)),
    },
    tabel: familieTabel(foci, "Focus"),
    tabellen: [{ kop: "Expertise- en mensgerichtheid binnen de aandachtsgebieden", tabel: ehStrip(foci) }],
    blokken: [
      {
        kop: "Kernboodschap",
        tekst:
          "De natuurlijke aandacht gaat naar " +
          (foci.filter((r) => statusVanEnergie(num(r.avgEnergy)) !== "kost").length
            ? lijst(foci.filter((r) => statusVanEnergie(num(r.avgEnergy)) !== "kost").slice(0, 2).map((r) => r.construct))
            : "de best herkende aandachtslijnen") +
          ". De identiteits- en waardenlaag (TaPas-Beeld) leest u apart in hoofdstuk 4; ze telt hier niet mee.",
      },
      {
        kop: "Professionele betekenis",
        tekst:
          "Interpretatie. De hoogst geplaatste aandachtslijn is de duidelijkste ingang; energiegevende lijnen houden de aandacht beschikbaar. Deze aandacht komt pas vrij wanneer een remmende driver ontgrendeld wordt en de versnellers haar weer in beweging zetten.",
      },
      {
        kop: "Actie of ontwerpimplicatie",
        tekst:
          "Herontwerp de rol richting de energiegevende aandachtslijnen, met minder belasting op de lijnen die vandaag energie kosten.",
      },
    ],
  });

  // 08 — Bronstellingen — aandacht -----------------------------------------
  const fociCitaten: string[] = [];
  foci.forEach((r) => (r.mostItems ?? []).forEach((t) => fociCitaten.push(citaatTekst(t))));
  secties.push({
    nummer: "08",
    titel: "Bronstellingen — aandacht",
    ondertitel: "De letterlijke stellingen achter de talent-foci — onbewerkt uit de vragenlijst.",
    paragrafen: ["Hieronder staan de stellingen die bij de talent-foci het sterkst herkend werden, verbatim overgenomen."],
    citaten: fociCitaten,
  });

  // 09 — Talent-versnellers -------------------------------------------------
  secties.push({
    nummer: "09",
    titel: "Talent-versnellers",
    ondertitel: "Hoe resultaat het snelst ontstaat — de persoonlijke route naar resultaat.",
    saldo: {
      label: "Energiesaldo Talent-versnellers",
      waarde: fmt(saldoVersnellers, 2, true),
      toelichting: "dit construct " + statusZin(statusVanEnergie(saldoVersnellers)),
    },
    tabel: familieTabel(versnellers, "Versneller"),
    tabellen: [{ kop: "Expertise- en mensgerichtheid binnen de versnellers", tabel: ehStrip(versnellers) }],
    blokken: [
      {
        kop: "Kernboodschap",
        tekst:
          "De persoonlijke route naar resultaat start vanuit " +
          (versnellers.length ? lijst(versnellers.slice(0, 2).map((r) => r.construct)) : "de best herkende versnellers") +
          ": eerst doorgronden en afstemmen, dan tot een betekenisvol resultaat komen.",
      },
      {
        kop: "Professionele betekenis",
        tekst:
          "Interpretatie. De sterkst herkende versnellers vormen het startpunt van de natuurlijke oplossingsroute. Ze ontgrendelen de foci uit hoofdstuk 7, op voorwaarde dat een dominante driver niet op slot staat.",
      },
      {
        kop: "Actie of ontwerpimplicatie",
        tekst:
          "Geef ruimte om eerst te doorgronden en af te stemmen voordat resultaat wordt verwacht. Respecteer de natuurlijke werkroute.",
      },
    ],
  });

  // 10 — Bronstellingen — inzet --------------------------------------------
  const versnCitaten: string[] = [];
  versnellers.forEach((r) => (r.mostItems ?? []).forEach((t) => versnCitaten.push(citaatTekst(t))));
  secties.push({
    nummer: "10",
    titel: "Bronstellingen — inzet",
    ondertitel: "De letterlijke stellingen achter de talent-versnellers — onbewerkt uit de vragenlijst.",
    paragrafen: ["Hieronder staan de stellingen die bij de talent-versnellers het sterkst herkend werden, verbatim overgenomen."],
    citaten: versnCitaten,
  });

  // 11 — Bronlezing — herkenbare talentcombinaties -------------------------
  const topDrivers2 = drivers.slice(0, 2).map((r) => r.construct);
  const topFoci = foci.slice(0, 2).map((r) => r.construct);
  const topVersn = versnellers.slice(0, 3).map((r) => r.construct);
  secties.push({
    nummer: "11",
    titel: "Bronlezing — herkenbare talentcombinaties",
    ondertitel: "De drie lagen samen — motivatie, aandacht en inzet als één bronpatroon.",
    paragrafen: [
      "De drie lagen worden hier voor het eerst samen gelezen: motivatie, aandacht en inzet als één herkenbaar patroon.",
    ],
    blokken: [
      { kop: "Motivatie", tekst: (topDrivers2.length ? topDrivers2.join(" → ").toUpperCase() + ". " : "") + "Een innerlijke stuwing gevoed door de sterkst herkende drivers, met een ideale context die kwaliteit, verdieping en meerwaarde waardeert." },
      { kop: "Aandacht", tekst: (topFoci.length ? topFoci.join(" → ").toUpperCase() + ". " : "") + "De aandacht opent via de best herkende foci; overige lijnen volgen, niet als spontane voorkeur." },
      { kop: "Inzet", tekst: (topVersn.length ? topVersn.join(" → ").toUpperCase() + ". " : "") + "De route naar resultaat start vanuit de sterkst herkende versnellers." },
    ],
  });

  // 12 — Drieledige talentdynamiek -----------------------------------------
  secties.push({
    nummer: "12",
    titel: "Drieledige talentdynamiek",
    ondertitel: "De drie lagen als één samenhangende talentmotor — ook onder druk.",
    paragrafen: [
      "Drie lagen vormen samen één talentmotor: de drivers geven de stuwing, de talent-foci richten de aandacht, en de versnellers bepalen de snelste route naar resultaat.",
    ],
    blokken: [
      { kop: "Laag 1 · Drivers", tekst: topDrivers2.length ? lijst(topDrivers2) + " geven de innerlijke stuwing." : "De drivers geven de innerlijke stuwing." },
      { kop: "Laag 2 · Talent-foci", tekst: topFoci.length ? lijst(topFoci) + " richten de aandacht." : "De talent-foci richten de aandacht." },
      { kop: "Laag 3 · Versnellers", tekst: topVersn.length ? lijst(topVersn) + " vormen de snelste route naar resultaat." : "De versnellers vormen de route naar resultaat." },
      { kop: "Samenwerking onder druk", tekst: "Loopt de druk op, dan vernauwt de dominante motivatielaag de aandacht en de route: kwaliteit boven afronding, zelf-dragen boven delegeren." },
      { kop: "Professionele betekenis", tekst: "Interpretatie. De drie lagen versterken elkaar zodra de context kwaliteit én menselijke afstemming waardeert. Één laag die vastloopt, vertraagt de andere twee." },
      { kop: "Actie of ontwerpimplicatie", tekst: "Ontwerp de rol zo dat de drie lagen op elkaar kunnen inspelen en begrens de dominante driver met heldere 'goed genoeg'-afspraken." },
    ],
  });

  // 13 — De talentmotor in één oogopslag -----------------------------------
  const motorTabel = (rows: ConstructRowLike[], kop: string): T4pTabel => ({
    kolommen: [kop, "Status"],
    rijen: rows.map((r) => [r.construct, statusVanEnergie(num(r.avgEnergy))]),
  });
  secties.push({
    nummer: "13",
    titel: "De talentmotor in één oogopslag",
    ondertitel: "Foci, versnellers en drivers samen — in dezelfde rangorde als de detailhoofdstukken.",
    tabellen: [
      { kop: "1 · Talent-foci · waar opent de aandacht?", tabel: motorTabel(foci, "Focus") },
      { kop: "2 · Talent-versnellers · hoe ontstaat resultaat?", tabel: motorTabel(versnellers, "Versneller") },
      { kop: "3 · Drivers · wat geeft gas of remt?", tabel: motorTabel(drivers, "Driver") },
    ],
    blokken: [
      {
        kop: "Route naar zichtbaar resultaat",
        tekst:
          "Vernieuwende en mensgerichte aandacht wordt via de energiegevende versnellers omgezet in een gedragen resultaat. Wat de motor ontgrendelt: een context die kwaliteit én menselijke afstemming waardeert. Wat de motor vastzet: een onbegrensde kwaliteitsdriver onder tijdsdruk.",
      },
    ],
  });

  // 14 — Verbondenheid met de organisatie ----------------------------------
  const connKpis: T4pKpi[] = ["q1", "q2", "q3", "q4"]
    .filter((q) => connAnswers[q] !== undefined && connAnswers[q] !== null)
    .map((q) => ({ waarde: `${num(connAnswers[q])}/10`, label: connLabels[q] ?? q }));
  secties.push({
    nummer: "14",
    titel: "Verbondenheid met de organisatie",
    ondertitel: "Hoe de wederkerigheid tussen persoon en organisatie vandaag wordt beleefd.",
    kpis: connKpis.length ? connKpis : undefined,
    paragrafen: connKpis.length
      ? [
          "De verbondenheidsmodule (schaal " + connScale + ") toont de balans tussen wat iemand geeft en ervaart terug te krijgen.",
        ]
      : ["De verbondenheidsmodule is voor deze afname niet ingevuld."],
    blokken: connKpis.length
      ? [
          { kop: "Kernboodschap", tekst: (isFinite(zelf) && isFinite(org) && zelf - org >= 3) ? "Hoge eigen inzet en verbondenheid staan tegenover een lage ervaren billijkheid en organisatie-investering. De balans tussen geven en ontvangen wordt vandaag als scheef beleefd." : "De balans tussen geven en ontvangen wordt bekeken vanuit de vier verbondenheidsmetrieken." },
          { kop: "Professionele betekenis", tekst: "Interpretatie. Wie veel investeert en zich sterk verbindt maar weinig terugkrijgt, loopt risico op uitholling van motivatie. De verbondenheid is een sterkte; de scheve wederkerigheid is het aandachtspunt." },
          { kop: "Actie of ontwerpimplicatie", tekst: "Maak de wederkerigheid expliciet bespreekbaar: welke erkenning, ontwikkeling of verloning staat tegenover de inzet? Een helder wederzijds engagement herstelt de balans." },
        ]
      : undefined,
  });

  // 15 — Werkcontext en rolfit ---------------------------------------------
  secties.push({
    nummer: "15",
    titel: "Werkcontext en rolfit",
    ondertitel: "Waar het talent rendeert, onder welke voorwaarden, en waar het energie verliest.",
    blokken: [
      { kop: "Talent komt tot leven", tekst: "Rollen waar de energiegevende foci en versnellers samenkomen: conceptontwikkeling, begeleiding en advies met inhoud." },
      { kop: "Werkt onder voorwaarden", tekst: "Rollen die kunnen passen mits kwaliteitsnormen begrensd worden en er ruimte is om af te ronden zonder gejaagdheid." },
      { kop: "Rendement met energielek", tekst: "Sterk operationele, repetitieve rollen realiseren resultaat, maar tegen hogere interne kost en met minder natuurlijke flow." },
      { kop: "Niet primair passend", tekst: "Posities zonder ruimte voor de energiegevende talentlijnen vernauwen de talentmotor structureel." },
      { kop: "Randvoorwaarden", tekst: "Mensen eerst · ruimte om af te ronden · vernieuwing zichtbaar · begrensde kwaliteitsnorm · betekenis boven volume." },
    ],
  });

  // 16 — Ontwikkelrisico's en waakpunten -----------------------------------
  secties.push({
    nummer: "16",
    titel: "Ontwikkelrisico's en waakpunten",
    ondertitel: "Waar aandacht nodig is om talent en energie duurzaam beschikbaar te houden.",
    blokken: [
      { kop: "Kernboodschap", tekst: "De grootste ontwikkelrisico's liggen niet in een tekort aan talent, maar in de begrenzing van een dominante driver en in de wederkerigheid met de organisatie." },
      { kop: "Perfectionistische uitputting", tekst: "Hypothese. Sterke kwaliteits- en ambitiedrivers kunnen leiden tot moeite met afronden, delegeren en loslaten. Het gevoel dat het nooit goed genoeg is, kost stille energie." },
      { kop: "Energetische onderstroom", tekst: `Hypothese. De lage beleefde startenergie (${fmt(beleefd, 1)}/10) tegenover de gemeten energie (${fmt(gemeten, 1)}/10) wijst mogelijk op een onderstroom die bewaking vraagt, los van het talentbeeld.` },
      { kop: "Actie of ontwerpimplicatie", tekst: "Bouw expliciete begrenzing en herstelmomenten in. Maak afspraken over 'goed genoeg' en houd de energiebalans actief in het oog." },
    ],
  });

  // 17 — Energielekken en minder vanzelfsprekende talentlijnen -------------
  const kostRows = alleRows
    .filter((r) => !isTapasBeeld(r.construct) && statusVanEnergie(num(r.avgEnergy)) === "kost")
    .sort((a, b) => num(a.avgEnergy) - num(b.avgEnergy));
  const laagMaarGeeft = alleRows
    .filter((r) => !isTapasBeeld(r.construct) && num(r.net) < 0 && statusVanEnergie(num(r.avgEnergy)) === "geeft")
    .sort((a, b) => num(a.net) - num(b.net));
  secties.push({
    nummer: "17",
    titel: "Energielekken en minder vanzelfsprekende talentlijnen",
    ondertitel: "Wat vandaag energie kost, en welke lijnen laag scoren maar tóch energie geven.",
    tabellen: [
      {
        kop: "Wat vandaag energie kost",
        tabel: {
          kolommen: ["Construct", "Net", "Energie", "Status", "Lezing"],
          rijen: kostRows.length
            ? kostRows.map((r) => [r.construct, fmt(num(r.net), 0, true), fmt(num(r.avgEnergy), 2, true), "kost", generiekeLezing(r)])
            : [["—", "—", "—", "—", "Geen constructen die vandaag per saldo energie kosten."]],
        },
      },
      {
        kop: "Minder vanzelfsprekende talentlijnen (laag maar energiegevend)",
        tabel: {
          kolommen: ["Construct", "Net", "Energie", "Status", "Lezing"],
          rijen: laagMaarGeeft.length
            ? laagMaarGeeft.map((r) => [r.construct, fmt(num(r.net), 0, true), fmt(num(r.avgEnergy), 2, true), "geeft", "Bewust in te schakelen tweede laag, geen kernroute."])
            : [["—", "—", "—", "—", "Geen laag-scorende maar energiegevende lijnen."]],
        },
      },
    ],
    blokken: [
      { kop: "Actie of ontwerpimplicatie", tekst: "Schakel de tweede laag bewust in ná de natuurlijke route. Vraag ze niet als startpunt; gebruik ze als verdieping en brug naar resultaat." },
    ],
  });

  // 18 — Toekomstgerichte synthese -----------------------------------------
  secties.push({
    nummer: "18",
    titel: "Toekomstgerichte synthese",
    ondertitel: "De rode draad door de drie lagen — en de hefboom voor de komende fase.",
    blokken: [
      { kop: "Kernboodschap", tekst: "De drie lagen wijzen samen naar een profiel dat het sterkst rendeert waar inhoud, mens en betekenis samenkomen. De hefboom is een context die dat waardeert en ruimte geeft om af te ronden." },
      { kop: "Professionele betekenis", tekst: "Interpretatie. Het talent rendeert het sterkst in rollen die conceptueel, betekenisvol en relationeel zijn, met analytische diepgang en ruimte voor vernieuwing. Een dominante driver wordt dan brandstof in plaats van rem." },
      { kop: "Actie of ontwerpimplicatie", tekst: "Gebruik dit profiel als startpunt voor een gesprek over rolontwerp en wederkerigheid: waar kan vernieuwing zichtbaar renderen, en hoe blijft de energiebalans gezond?" },
    ],
  });

  // 19 — Toekomstpistes en carrièrekansen ----------------------------------
  secties.push({
    nummer: "19",
    titel: "Toekomstpistes en carrièrekansen",
    ondertitel: "Durven vooruitdenken — waar dit talent de komende jaren nóg meer kan renderen.",
    paragrafen: [
      "Vooruitdenkend reikt dit talent verder dan de huidige rol. De onderstaande pistes zijn denkrichtingen, geen geschiktheidsoordeel; toets elke piste aan energie, betekenis en context.",
    ],
    blokken: [
      { kop: "Piste 1 · Concept- en methodiekontwikkelaar", tekst: "Waar de energierijke versnellers en vernieuwende aandacht samenkomen, wordt het ontwerpen van nieuwe methodieken een natuurlijke richting. Vraagt mandaat en ruimte om te ontwikkelen zonder operationele overlast. Reflectievraag: welke methodiek zou je bouwen als kwaliteit geen rem maar hefboom mocht zijn?" },
      { kop: "Piste 2 · Denkleider, auteur of opleider", tekst: "Vernieuwende aandacht plus respectvolle beïnvloeding maken het delen van gedachtegoed tot een logische richting voorbij één organisatie. Vraagt een podium en de keuze om af te ronden en te publiceren. Reflectievraag: welk idee verdient het om gedeeld te worden, ook als het nog niet 'perfect' is?" },
      { kop: "Piste 3 · Bouwer op een eigen snijvlak", tekst: "Op het snijvlak van talentontwikkeling en een tweede expertise- of interessedomein ontstaat een moeilijk kopieerbare positie. Vraagt tijd en focus om twee werelden te verbinden. Reflectievraag: welk tweede domein zou jouw talent een onderscheidende plek geven?" },
    ],
  });

  // 20 — Vertaling naar gevestigde kaders ----------------------------------
  const heeft = (naam: string) =>
    alleRows.find((r) => r.construct === naam && statusVanEnergie(num(r.avgEnergy)) !== "kost" && num(r.net) >= 0);
  const bigFive: (string | number)[][] = [];
  if (alleRows.find((r) => r.construct === "Innovatie"))
    bigFive.push(["Openheid", heeft("Innovatie") ? "Hoog" : "Gemiddeld", "Vernieuwingslijn en conceptuele aandacht."]);
  if (drivers.find((r) => r.construct === "Be Perfect"))
    bigFive.push(["Consciëntieusheid", drivers.find((r) => r.construct === "Be Perfect" && num(r.net) > 0) ? "Hoog" : "Gemiddeld", "Kwaliteitsdriver en nauwkeurigheid."]);
  if (alleRows.find((r) => r.construct === "Impact" || r.construct === "Inter-relationeel"))
    bigFive.push(["Extraversie", "Gemiddeld", "Relationeel afstemmend."]);
  if (alleRows.find((r) => r.construct === "Coaching"))
    bigFive.push(["Altruïsme", heeft("Coaching") ? "Hoog" : "Gemiddeld", "Respectvolle coaching en mensgerichtheid."]);
  bigFive.push(["Emotionele stabiliteit", beleefd < 4 ? "Aandacht" : "Gemiddeld", "Beleefde startenergie als signaal."]);

  const riasec: (string | number)[][] = [];
  if (alleRows.find((r) => r.construct === "Analyse")) riasec.push(["Investigative (analyse)", heeft("Analyse") ? "Sterk" : "Aanwezig", "Onderzoek, advies, conceptwerk."]);
  if (alleRows.find((r) => r.construct === "Coaching")) riasec.push(["Social (mensgericht)", heeft("Coaching") ? "Sterk" : "Aanwezig", "Coaching, begeleiding, ontwikkeling."]);
  if (alleRows.find((r) => r.construct === "Innovatie")) riasec.push(["Artistic (vernieuwend)", heeft("Innovatie") ? "Sterk" : "Aanwezig", "Methodiek- en conceptontwikkeling."]);
  if (alleRows.find((r) => r.construct === "Impact")) riasec.push(["Enterprising (beïnvloeden)", heeft("Impact") ? "Sterk" : "Aanwezig", "Richting geven, beweging creëren."]);
  secties.push({
    nummer: "20",
    titel: "Vertaling naar gevestigde kaders",
    ondertitel: "Big Five en RIASEC als interpretatieve lenzen bij het profiel.",
    tabellen: [
      { kop: "Big Five — indicatieve lezing", tabel: { kolommen: ["Dimensie", "Indicatie", "Onderbouwing"], rijen: bigFive } },
      { kop: "RIASEC — interesseoriëntatie", tabel: { kolommen: ["Type", "Indicatie", "Rolvoorbeeld"], rijen: riasec.length ? riasec : [["—", "—", "Onvoldoende constructen voor een indicatieve lezing."]] } },
    ],
    blokken: [
      { kop: "Interpretatiegrens", tekst: "Deze kaders zijn vertalende lenzen, geen nieuwe testuitslagen. Ze nuanceren het TaPas-beeld en vervangen het niet. De indicaties zijn heuristisch afgeleid uit de constructenergie." },
    ],
  });

  // 21 — Wetenschappelijke onderbouwing ------------------------------------
  secties.push({
    nummer: "21",
    titel: "Wetenschappelijke onderbouwing",
    ondertitel: "De interpretatieve lenzen achter het profiel — en hun grenzen.",
    tabel: {
      kolommen: ["Theoretische lens", "Waarvoor gebruikt", "Interpretatiegrens"],
      rijen: [
        ["Self-Determination Theory", "Motivatie via autonomie, competentie, verbondenheid.", "Geen diagnose; duiding van motivatie."],
        ["Flow & Job Demands-Resources", "Energiegevende versus energiekostende inzet.", "Energie is status, geen score."],
        ["Big Five", "Vertalende persoonlijkheidslens.", "Indicatief, geen testuitslag."],
        ["RIASEC / P-E fit", "Interesse- en roloriëntatie.", "Toont interesse, niet talent zelf."],
        ["Transactionele driver-taal", "Stuurpatronen onder druk.", "Praktische taal, geen diagnose."],
        ["Deliberate practice", "Ontwikkelbaarheid van talent.", "Talent is ontwikkelbaar, niet één factor."],
      ],
    },
    blokken: [
      { kop: "Inspiratiebron", tekst: "De TaPas-methodiek integreert deze kaders in één praktische taal van talent, energie en context, zoals uitgewerkt in het werk Zichtbaar." },
      { kop: "Belangrijke nuance", tekst: "Geen enkel TaPas-onderdeel komt één-op-één uit één studie. De kaders vormen een zorgvuldige verankeringslaag voor interpretatie en gesprek." },
    ],
  });

  // 22 — Technische bijlage -------------------------------------------------
  const familieMap: Record<string, number> = {};
  familyRows.forEach((f) => (familieMap[f.family] = num(f.avgEnergy)));
  const familieLezing: Record<string, string> = {
    Drivers: "Per saldo licht energiekostend of -gevend; de dominante driver weegt door.",
    "Talent-foci": "De aandacht ligt in dit energiebeeld.",
    "Talent-versnellers": "De route naar resultaat in dit energiebeeld.",
  };
  const publiekeFamilieNaam: Record<string, string> = {
    Drivers: "Drivers",
    "Talent-foci": "Talent-foci",
    "Talent-versnellers": "Talent-versnellers",
  };
  const familieRijen: (string | number)[][] = familyRows.map((f) => [
    publiekeFamilieNaam[f.family] ?? f.family,
    fmt(num(f.avgEnergy), 2, true),
    familieLezing[f.family] ?? "",
  ]);
  const alleConstructRijen: (string | number)[][] = alleRows
    .slice()
    .sort((a, b) => {
      const orde: Record<string, number> = { Drivers: 0, "Talent-foci": 1, "Talent-versnellers": 2 };
      const fa = orde[a.family] ?? 3;
      const fb = orde[b.family] ?? 3;
      if (fa !== fb) return fa - fb;
      return num(b.net) - num(a.net);
    })
    .map((r) => [r.construct, r.family, fmt(num(r.net), 0, true), fmt(num(r.avgEnergy), 2, true)]);
  secties.push({
    nummer: "22",
    titel: "Technische bijlage",
    ondertitel: "De volledige cijferlaag — familiegegroepeerd en in rangorde.",
    tabellen: [
      { kop: "Energie per talentfamilie", tabel: { kolommen: ["Familie", "Gem. energie", "Lezing"], rijen: familieRijen.length ? familieRijen : [["—", "—", "Geen familiegegevens."]] } },
      { kop: "Alle constructen — net en gemiddelde energie", tabel: { kolommen: ["Construct", "Familie", "Net", "Gem. energie"], rijen: alleConstructRijen } },
    ],
    blokken: [
      { kop: "Data en signalen", tekst: "De rangorde is bepaald op nettoscore (meest minus minst), met energie uitsluitend als statuslaag — nooit als sorteersleutel. TaPas-Beeld staat hier onder Talent-foci als identiteitslaag, maar telt niet mee als aandachtsgebied in hoofdstuk 7." },
    ],
  });

  // 23 — Grondslagen --------------------------------------------------------
  secties.push({
    nummer: "23",
    titel: "Grondslagen",
    ondertitel: "De wetenschappelijke ankers achter de interpretatie — met bronverwijzing.",
    paragrafen: [
      "Een beknopte verankeringslaag. Deze bronnen tonen met welke hedendaagse kaders het profiel gelezen en afgetoetst kan worden — geen claim dat elk onderdeel uit één studie voortkomt.",
    ],
    bronnen: BRONNEN,
  });

  // 24 — Mantra en dankwoord -----------------------------------------------
  secties.push({
    nummer: "24",
    titel: "Mantra en dankwoord",
    ondertitel: "Een zin om mee te nemen — en een woord van dank.",
    paragrafen: [
      "De persoonlijke mantra vat de talentmotor in één zin samen en wordt in het begeleidende gesprek samen geformuleerd; ze is bruikbaar als persoonlijk ankerpunt wanneer de kwaliteitsdrang dreigt te remmen in plaats van te dragen.",
    ],
    blokken: [
      { kop: "Dankwoord", tekst: "Dank voor het vertrouwen in dit gedachtegoed en deze methodiek. TaPasCity · www.tapascity.com · info@tapascity.com — Inspiratie: Zichtbaar." },
    ],
  });

  const rapportdatum = contract?.generatedAt
    ? new Date(contract.generatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });

  return {
    instrument: "t4p-business-kompas",
    variant: contract?.variant ?? "kompas",
    taal: contract?.taal ?? "nl",
    titel: "T4P Business Profiel",
    ondertitel: "Persoonlijk kompas van talent, energie, context en ontwikkelrichting",
    respondent: {
      naam: p.name ?? "Onbekend",
      code: p.respondentCode ?? "—",
      organisatie: p.company ?? null,
      functie: p.role ?? null,
    },
    rapportdatum,
    databronnen: "T4P-vragenlijst · organisatiemodule",
    gegenereerdOp: new Date().toISOString(),
    inhoudsopgave: INHOUDSOPGAVE,
    secties,
    disclaimer:
      "Dit T4P Business Profiel beschrijft talent, drivers, energie en context op basis van zelfgerapporteerde " +
      "keuzes. Het is een momentopname en geen psychologische diagnose, geen meting van intelligentie of " +
      "potentieel, en geen selectie-instrument. Het is bedoeld als professioneel kompas voor reflectie en gesprek.",
  };
}

// --- HTML-renderer ---------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTabel(t: T4pTabel): string {
  const th = t.kolommen.map((k) => `<th>${esc(k)}</th>`).join("");
  const rows = t.rijen
    .map((row) => `<tr>${row.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`)
    .join("\n");
  return `<table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderT4pBusinessProfielHtml(inhoud: T4pRapportInhoud): string {
  const r = inhoud.respondent;
  const metaRegel = [r.organisatie, r.functie].filter(Boolean).join(" · ");

  const tocHtml = inhoud.inhoudsopgave
    .map((i) => `<li><span class="toc-num">${esc(i.nummer)}</span> ${esc(i.titel)}</li>`)
    .join("\n");

  const sectiesHtml = inhoud.secties
    .map((s) => {
      const parts: string[] = [];
      parts.push(
        `<h2><span class="sec-num">${esc(s.nummer)}</span> ${esc(s.titel)}</h2>`
      );
      if (s.ondertitel) parts.push(`<p class="sec-sub">${esc(s.ondertitel)}</p>`);
      if (s.saldo) {
        parts.push(
          `<div class="saldo"><span class="saldo-label">${esc(s.saldo.label)}</span>` +
            `<span class="saldo-waarde">${esc(s.saldo.waarde)}</span>` +
            (s.saldo.toelichting ? `<span class="saldo-toel">${esc(s.saldo.toelichting)}</span>` : "") +
            `</div>`
        );
      }
      if (s.kpis && s.kpis.length) {
        parts.push(
          `<div class="kpis">` +
            s.kpis
              .map((k) => `<div class="kpi"><div class="kpi-val">${esc(k.waarde)}</div><div class="kpi-lbl">${esc(k.label)}</div></div>`)
              .join("") +
            `</div>`
        );
      }
      if (s.paragrafen) s.paragrafen.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
      if (s.tabel) parts.push(renderTabel(s.tabel));
      if (s.tabellen) {
        s.tabellen.forEach((t) => {
          if (t.kop) parts.push(`<h3>${esc(t.kop)}</h3>`);
          parts.push(renderTabel(t.tabel));
        });
      }
      if (s.citaten && s.citaten.length) {
        parts.push(
          `<ul class="citaten">` +
            s.citaten.map((c) => `<li>&ldquo;${esc(c)}&rdquo;</li>`).join("") +
            `</ul>`
        );
      }
      if (s.citaten && s.citaten.length === 0) {
        parts.push(`<p class="leeg">Geen verbatim stellingen vastgelegd voor deze afname.</p>`);
      }
      if (s.blokken && s.blokken.length) {
        parts.push(
          `<div class="blokken">` +
            s.blokken
              .map((b) => `<div class="blok"><div class="blok-kop">${esc(b.kop)}</div><div class="blok-tekst">${esc(b.tekst)}</div></div>`)
              .join("") +
            `</div>`
        );
      }
      if (s.bronnen && s.bronnen.length) {
        parts.push(
          `<ul class="bronnen">` +
            s.bronnen
              .map((b) => `<li>${esc(b.titel)}<br /><a href="${esc(b.url)}">${esc(b.url)}</a></li>`)
              .join("") +
            `</ul>`
        );
      }
      return `<section>${parts.join("\n")}</section>`;
    })
    .join("\n");

  const datum = new Date(inhoud.gegenereerdOp).toLocaleString("nl-BE");

  return `<!DOCTYPE html>
<html lang="${esc(inhoud.taal)}">
<head>
<meta charset="utf-8" />
<title>${esc(inhoud.titel)} — ${esc(r.naam)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  :root {
    --navy: #1e293b; --teal: #0d9488; --ink: #0f172a; --muted: #64748b;
    --muted-light: #94a3b8; --line: #e2e8f0; --surface: #f8fafc; --white: #ffffff;
    --geeft: #0d9488; --kost: #b45309; --neutraal: #a16207;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'DM Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    color: var(--ink); margin: 0; padding: 32px; background: var(--surface);
    -webkit-font-smoothing: antialiased;
  }
  .doc {
    max-width: 820px; margin: 0 auto; background: var(--white);
    border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .doc-header {
    background: linear-gradient(135deg, var(--teal) 0%, var(--navy) 100%);
    padding: 40px 44px 32px; color: var(--white);
  }
  .brand-mark-name {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.85); margin-bottom: 20px;
  }
  .t4p-mark { font-size: 32px; font-weight: 700; letter-spacing: 0.3em; margin: 0 0 4px; }
  h1 { font-size: 26px; font-weight: 700; margin: 0 0 6px; line-height: 1.2; }
  .sub { color: rgba(255,255,255,0.8); font-size: 14px; margin: 0 0 20px; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; font-size: 13px; }
  .meta-grid dt { color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .meta-grid dd { margin: 0 0 6px; font-weight: 600; }
  .vertrouwelijk { margin-top: 18px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
  .doc-body { padding: 36px 44px 32px; }
  .toc { columns: 2; column-gap: 32px; list-style: none; padding: 0; margin: 0 0 28px; font-size: 13px; }
  .toc li { break-inside: avoid; padding: 4px 0; color: var(--ink); border-bottom: 1px solid var(--line); }
  .toc-num { color: var(--teal); font-weight: 700; margin-right: 8px; }
  h2 {
    font-size: 17px; font-weight: 700; color: var(--navy); margin: 34px 0 4px;
    padding-bottom: 8px; border-bottom: 2px solid var(--line);
  }
  .sec-num { color: var(--teal); font-weight: 700; margin-right: 8px; }
  .sec-sub { color: var(--muted); font-size: 13px; font-style: italic; margin: 0 0 12px; }
  h3 { font-size: 13px; font-weight: 600; color: var(--navy); margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  p { font-size: 14px; line-height: 1.7; margin: 0 0 10px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-val { font-size: 22px; font-weight: 700; color: var(--navy); }
  .kpi-lbl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; }
  .saldo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--surface); border-left: 3px solid var(--teal); border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 12px 0; }
  .saldo-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
  .saldo-waarde { font-size: 22px; font-weight: 700; color: var(--navy); }
  .saldo-toel { font-size: 12px; color: var(--muted); font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
  thead tr { background: linear-gradient(to right, var(--navy), #334155); }
  th { color: rgba(255,255,255,0.9); font-weight: 600; font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; padding: 10px 12px; text-align: left; }
  td { padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  .citaten { margin: 12px 0; padding-left: 0; list-style: none; }
  .citaten li { font-style: italic; color: var(--ink); background: var(--surface); border-left: 3px solid var(--teal); border-radius: 0 6px 6px 0; padding: 8px 14px; margin-bottom: 8px; font-size: 13px; }
  .leeg { color: var(--muted-light); font-style: italic; }
  .blokken { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 14px 0; }
  .blok { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .blok-kop { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--teal); margin-bottom: 6px; }
  .blok-tekst { font-size: 13px; line-height: 1.6; color: var(--ink); }
  .bronnen { list-style: none; padding: 0; margin: 12px 0; }
  .bronnen li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 600; }
  .bronnen a { color: var(--teal); font-weight: 400; font-size: 12px; word-break: break-all; }
  .disclaimer { margin-top: 32px; padding: 14px 16px; background: #f1f5f9; border-left: 3px solid var(--teal); border-radius: 0 8px 8px 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
  .doc-footer { padding: 16px 44px; background: var(--surface); border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 11px; color: var(--muted-light); }
  .doc-footer-brand { font-weight: 600; color: var(--teal); letter-spacing: 0.04em; }
  section { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="doc">
    <div class="doc-header">
      <div class="brand-mark-name">TaPasCity</div>
      <div class="t4p-mark">T 4 P</div>
      <h1>${esc(inhoud.titel)}</h1>
      <p class="sub">${esc(inhoud.ondertitel)}</p>
      <dl class="meta-grid">
        <div><dt>Deelnemer</dt><dd>${esc(r.naam)}</dd></div>
        <div><dt>Bedrijf</dt><dd>${esc(r.organisatie ?? "—")}</dd></div>
        <div><dt>Rol</dt><dd>${esc(r.functie ?? "—")}</dd></div>
        <div><dt>Rapportdatum</dt><dd>${esc(inhoud.rapportdatum)}</dd></div>
        <div><dt>Databronnen</dt><dd>${esc(inhoud.databronnen)}</dd></div>
        <div><dt>Code</dt><dd>${esc(r.code)}</dd></div>
      </dl>
      <div class="vertrouwelijk">Vertrouwelijk profielrapport</div>
    </div>
    <div class="doc-body">
      <ol class="toc">${tocHtml}</ol>
      ${sectiesHtml}
      <div class="disclaimer">${esc(inhoud.disclaimer)}</div>
    </div>
    <div class="doc-footer">
      <span>Gegenereerd op ${esc(datum)}${metaRegel ? " · " + esc(metaRegel) : ""}</span>
      <span class="doc-footer-brand">TaPasCity · T4P Business Profiel</span>
    </div>
  </div>
</body>
</html>`;
}
