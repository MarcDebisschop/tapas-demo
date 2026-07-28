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
    (r.mostItems ?? []).forEach((t) => driverCitaten.push(t));
    (r.toelichtingen ?? []).forEach((t) =>
      driverCitaten.push(`${t} (toelichting bij ${r.construct})`)
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
  foci.forEach((r) => (r.mostItems ?? []).forEach((t) => fociCitaten.push(t)));
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
  versnellers.forEach((r) => (r.mostItems ?? []).forEach((t) => versnCitaten.push(t)));
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

// --- Kleur-/status-helpers voor de PDF-gestandaardiseerde layout -----------

type Kleur = "teal" | "goud" | "terracotta" | "groen" | "grijs";

// Labelwoorden op callout-koppen -> kleur, zoals gedocumenteerd in de bouwspec.
function kleurVoorKop(kop: string): Kleur {
  const k = kop.toLowerCase();
  if (
    k.includes("klopt") ||
    k.includes("startpunt") ||
    k.includes("actie") ||
    k.includes("ontwerpimplicatie")
  )
    return "groen";
  if (
    k.includes("aandacht vraagt") ||
    k.includes("spanning") ||
    k.includes("risico") ||
    k.includes("bewaking")
  )
    return "terracotta";
  if (
    k.includes("congruentie") ||
    k.includes("betekenis") ||
    k.includes("kern") ||
    k.includes("interactie")
  )
    return "teal";
  return "teal";
}

// Status-tekst ("kost"/"geeft"/"neutraal") -> badge/accentkleur.
function kleurVoorStatus(status: string): Kleur {
  const s = status.toLowerCase().trim();
  if (s === "kost") return "terracotta";
  if (s === "geeft") return "groen";
  return "grijs";
}

// Teken van een numerieke tekstwaarde (bv. "+6", "-0,83", "−2,25") -> kleur.
function kleurVoorTeken(waarde: string): Kleur {
  const v = waarde.replace(/\u2212/g, "-").trim();
  if (v.startsWith("-")) return "terracotta";
  if (v.startsWith("+")) return "groen";
  return "teal";
}

// Simpele driver/focus/versneller-naam -> monochroom inline-SVG icoon.
// Iconen zijn bewust eenvoudig en herkenbaar (spec §9); geen emoji.
const ICOON_MAP: Record<string, string> = {
  "be perfect": `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l2.9 6.26L21.5 9l-5 4.64L17.8 21 12 17.3 6.2 21l1.3-7.36-5-4.64 6.6-.74L12 2z"/></svg>`,
  "try hard": `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2 3 14h6l-1 8 11-13h-6l1-7z"/></svg>`,
  "please others": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M8 15c1.2 1.2 2.6 1.8 4 1.8s2.8-.6 4-1.8"/></svg>`,
  "be strong": `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9h2v6H3zM19 9h2v6h-2zM6 7h2v10H6zM16 7h2v10h-2zM8 11h8v2H8z"/></svg>`,
  "hurry up": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
  innovatie: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.7c.6.45 1 1.15 1 1.95v.35h6v-.35c0-.8.4-1.5 1-1.95A7 7 0 0 0 12 2z"/></svg>`,
  "inter-relationeel": `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6H2zM14.5 20c.2-2.2 1.4-4 3.1-5 2.2.5 3.9 2.5 4.4 5h-7.5z"/></svg>`,
  operationeel: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.75 1.7 1L11 21h4l.3-2.6c.6-.25 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`,
  strategie: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2 2 7l10 5 8-4.1V17h2V7L12 2zM4 9.5V15c0 2.2 3.6 4 8 4s8-1.8 8-4v-5.5l-8 4-8-4z"/></svg>`,
  analyse: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>`,
  coaching: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21c0-3.9 3.6-7 8-7s8 3.1 8 7H4z"/></svg>`,
  impact: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2 3 14h6l-1 8 11-13h-6l1-7z"/></svg>`,
  "constructief onderscheidend": `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l2.9 6.26L21.5 9l-5 4.64L17.8 21 12 17.3 6.2 21l1.3-7.36-5-4.64 6.6-.74L12 2z"/></svg>`,
  faciliteren: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6H2zM14.5 20c.2-2.2 1.4-4 3.1-5 2.2.5 3.9 2.5 4.4 5h-7.5z"/></svg>`,
  resultaatgericht: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/></svg>`,
};

function iconVoorNaam(naam: string): string {
  return ICOON_MAP[naam.toLowerCase().trim()] ?? "";
}

// Batterij-icoon voor de energiesaldo-badge (component 2).
const BATTERIJ_ICOON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="17" height="10" rx="2"/><rect x="21" y="10" width="1.6" height="4" fill="currentColor" stroke="none"/><rect x="4.5" y="9.5" width="4" height="5" fill="currentColor" stroke="none"/></svg>`;

// Quote-glyph voor bronstellingen-kaarten (component 10).
const QUOTE_GLYPH = `&ldquo;`;

// --- Energie-meter (component 7) --------------------------------------------
// Balkjes-meter: 10 vierkante blokjes, waarvan een deel gevuld is.
// Vulformule (gedocumenteerd, geen verzonnen cijfers):
//   - We lezen de al-berekende energiewaarde (bv. avgEnergy/net-energie, schaal
//     circa -1..+1 voor construct-energie, of X/10 voor de beleefde/gemeten
//     energie-KPI's in sectie 03).
//   - Voor "X/10"-waarden (sectie 03 kop-meters): aantal blokjes = round(X),
//     op een schaal van 10 blokjes — dit IS de brondata (bv. "2/10" -> 2 van
//     de 10 blokjes gevuld). Geen afleiding nodig.
//   - Voor "gemiddelde constructenergie"/net-signed waarden op schaal -1..+1
//     (bv. "+0,2", "-1,20"): we schalen naar het midden van de balk:
//     midpunt = 5 (van 10), aantal gevulde blokjes vanaf het midden =
//     round(|waarde| * 5), geclamped op [0, 5], geplaatst rechts van het
//     midden bij een positieve waarde en links van het midden bij een
//     negatieve waarde. Dit is een zuiver visuele mapping van de bestaande
//     waarde, geen nieuw cijfer.
//   - Voor driver/focus/versneller-energie in de tabellen (schaal circa
//     -1..+1) wordt dezelfde midpunt-formule gebruikt zodat de balkjes
//     consistent ogen doorheen het rapport (zie pg-10: Be Perfect -0,83 vult
//     2 blokjes links van het midden; Try Hard +0,75 vult er ~2 rechts).
function meterBlokjes(waardeStr: string, totaal = 10): { gevuld: boolean; kleur: Kleur }[] {
  const schoon = waardeStr.replace(/\u2212/g, "-").replace(",", ".").replace(/\/.*/, "").trim();
  const val = parseFloat(schoon);
  const isFractie = /\/\s*10/.test(waardeStr); // "X/10"-vorm: absolute schaal
  const blokjes: { gevuld: boolean; kleur: Kleur }[] = Array.from({ length: totaal }, () => ({
    gevuld: false,
    kleur: "grijs" as Kleur,
  }));
  if (!isFinite(val)) return blokjes;
  const kleur: Kleur = val < 0 ? "terracotta" : val > 0 ? "groen" : "grijs";
  if (isFractie) {
    const n = Math.max(0, Math.min(totaal, Math.round(val)));
    for (let i = 0; i < n; i++) blokjes[i] = { gevuld: true, kleur };
    return blokjes;
  }
  // Schaal -1..+1 (construct-/driverenergie): midpunt-methode.
  // Vulformule geverifieerd tegen de PDF-grondwaarheid (pg-10): bij Be Perfect
  // -0,83 -> 2 blokjes, Try Hard +0,75 -> 2 blokjes, Please Others/Be Strong
  // -1,00 -> 2 blokjes, Hurry Up -0,17 -> 0 blokjes. Dit komt overeen met
  // n = round(|waarde| * 2), afgetopt op de helft van het totaal aantal
  // blokjes (5 bij totaal=10). Zuiver visuele afronding van de bestaande
  // energiewaarde; geen nieuw cijfer.
  const mid = totaal / 2; // 5
  const n = Math.max(0, Math.min(mid, Math.round(Math.abs(val) * 2)));
  if (val >= 0) {
    for (let i = 0; i < n; i++) blokjes[Math.floor(mid) + i] = { gevuld: true, kleur };
  } else {
    for (let i = 0; i < n; i++) blokjes[Math.ceil(mid) - 1 - i] = { gevuld: true, kleur };
  }
  return blokjes;
}

function renderMeter(waardeStr: string): string {
  const blokjes = meterBlokjes(waardeStr);
  const cellen = blokjes
    .map((b) => `<span class="meter-blok${b.gevuld ? ` meter-blok--${b.kleur}` : ""}"></span>`)
    .join("");
  return `<div class="meter">${cellen}</div>`;
}

// Sectie 03: drie losse meters boven de metingtabel (zie pg-06). We tonen
// UITSLUITEND de bestaande waarde uit de data (bv. "2/10", "5,5/10", "+0,2")
// als kop en als waarde-label; we verzinnen geen tussenliggend getal. De
// vulling van de balkjes volgt dezelfde meterBlokjes()-mapping als hierboven
// gedocumenteerd (X/10 = absolute schaal; overige schaal -1..+1 via midpunt).
function renderMeterRij(labelPrefix: string, waarde: string): string {
  return (
    `<div class="meter-los">` +
    `<div class="meter-kop">${esc(labelPrefix)}: ${esc(waarde)}</div>` +
    renderMeter(waarde) +
    `<span class="meter-waarde-los ${tekenKleurClass(waarde)}">${esc(waarde)}</span>` +
    `</div>`
  );
}

// Herkent sectie 03: de eerste 3 rijen van de metingtabel (Beleefde
// startenergie, Gemeten energie, Gemiddelde constructenergie) krijgen elk
// een losse meter boven de tabel; "Energiediscrepantie" krijgt er geen
// (die rij toont in de PDF geen eigen balkjesmeter, enkel in de tabel zelf).
function renderStandaloneMeters(t: T4pTabel): string {
  const skip = /discrepantie/i;
  return t.rijen
    .filter((row) => !skip.test(String(row[0])))
    .map((row) => renderMeterRij(String(row[0]), String(row[1])))
    .join("");
}

function tekenKleurClass(waarde: string): string {
  return `waarde--${kleurVoorTeken(waarde)}`;
}

// --- Sectiekop (component 1) -------------------------------------------------
function renderSectieKop(s: T4pSectie): string {
  const ondertitel = s.ondertitel ? `<p class="sec-sub">${esc(s.ondertitel)}</p>` : "";
  return (
    `<div class="sec-kop-rij"><span class="running-header">Marc &middot; Debisschop</span></div>` +
    `<h2><span class="sec-nr">${esc(s.nummer)}</span><span class="sec-titel">${esc(s.titel)}</span></h2>` +
    `<div class="sec-lijn"></div>` +
    ondertitel
  );
}

// --- Energiesaldo-badge (component 2) ---------------------------------------
function renderSaldo(saldo: NonNullable<T4pSectie["saldo"]>): string {
  const kleur = kleurVoorTeken(saldo.waarde);
  return (
    `<div class="saldo-badge saldo-badge--${kleur}">` +
    `<div class="saldo-badge-links">` +
    `<span class="saldo-badge-icoon">${BATTERIJ_ICOON}</span>` +
    `<div><div class="saldo-badge-label">${esc(saldo.label)}</div>` +
    (saldo.toelichting ? `<div class="saldo-badge-gloss">${esc(saldo.toelichting)}</div>` : "") +
    `</div></div>` +
    `<div class="saldo-badge-waarde">${esc(saldo.waarde)}</div>` +
    `</div>`
  );
}

// --- Highlight-quote (component 3) ------------------------------------------
function renderHighlightQuote(tekst: string): string {
  return `<p class="highlight-quote">${esc(tekst)}</p>`;
}

// --- KPI-kaarten (component 4) -----------------------------------------------
function renderKpis(kpis: T4pKpi[]): string {
  const kaarten = kpis
    .map((k) => {
      const isWoord = !/[0-9]/.test(k.waarde);
      const isNegatief = /^-|^\u2212/.test(k.waarde.trim());
      const kleurClass = isWoord ? "kpi-val--goud" : isNegatief ? "kpi-val--goud" : "kpi-val--teal";
      return (
        `<div class="kpi-kaart">` +
        `<div class="kpi-val ${kleurClass}">${esc(k.waarde)}</div>` +
        `<div class="kpi-lbl">${esc(k.label)}</div>` +
        `</div>`
      );
    })
    .join("");
  return `<div class="kpis">${kaarten}</div>`;
}

// --- Callout-blokken (component 5) + 2-koloms panelen (component 6) --------

// Herkent de speciale 2-koloms paneel-koppen uit secties 04 en 12.
function paneelKleurVoorKop(kop: string): Kleur | null {
  const k = kop.toLowerCase();
  if (k.includes("inner why")) return "groen";
  if (k.includes("innerview")) return "terracotta";
  if (k.includes("laag 1") || k.includes("laag 3")) return "teal";
  if (k.includes("laag 2") || k.includes("samenwerking")) return "terracotta";
  return null;
}

// Zet "Hypothese." / "Interpretatie." vooraan een blok-tekst in <em>.
function renderBlokTekst(tekst: string): string {
  const m = tekst.match(/^(Hypothese\.|Interpretatie\.)\s*([\s\S]*)$/);
  if (m) {
    return `<em>${esc(m[1])}</em> ${esc(m[2])}`;
  }
  return esc(tekst);
}

function renderCalloutVolleBreedte(b: T4pBlok): string {
  const kleur = kleurVoorKop(b.kop);
  return (
    `<div class="callout callout--${kleur}">` +
    `<div class="callout-label">${esc(b.kop)}</div>` +
    `<div class="callout-tekst">${renderBlokTekst(b.tekst)}</div>` +
    `</div>`
  );
}

function renderCalloutKaart(b: T4pBlok): string {
  const kleur = kleurVoorKop(b.kop);
  return (
    `<div class="kaart kaart--${kleur}">` +
    `<div class="kaart-label">${esc(b.kop)}</div>` +
    `<div class="kaart-tekst">${renderBlokTekst(b.tekst)}</div>` +
    `</div>`
  );
}

function renderPaneel(b: T4pBlok, kleur: Kleur): string {
  return (
    `<div class="paneel paneel--${kleur}">` +
    `<div class="paneel-kop paneel-kop--${kleur}">${esc(b.kop)}</div>` +
    `<div class="paneel-tekst">${renderBlokTekst(b.tekst)}</div>` +
    `</div>`
  );
}

// Groepeert een blokken-array in render-groepen: opeenvolgende 2-koloms-
// paneel-koppen worden per 2 samengevoegd tot een paneel-grid; de rest volgt
// de generieke callout/kaart-regels per sectie (zie renderBlokken hieronder).
function renderBlokken(sectieNummer: string, blokken: T4pBlok[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < blokken.length) {
    const b = blokken[i];
    const paneelKleur = paneelKleurVoorKop(b.kop);
    if (paneelKleur) {
      // Verzamel opeenvolgende paneel-blokken (max 4, in stel-per-2 grid).
      const groep: T4pBlok[] = [];
      while (i < blokken.length && paneelKleurVoorKop(blokken[i].kop)) {
        groep.push(blokken[i]);
        i++;
      }
      const paneelHtml = groep
        .map((gb) => renderPaneel(gb, paneelKleurVoorKop(gb.kop) as Kleur))
        .join("");
      out.push(`<div class="paneel-grid">${paneelHtml}</div>`);
      continue;
    }
    // Sectie 01: eerste 3 blokken (sterktes/spanningen/ontwerpimplicaties)
    // zijn altijd volle-breedte getinte callouts (zie pg-04).
    if (sectieNummer === "01") {
      out.push(renderCalloutVolleBreedte(b));
      i++;
      continue;
    }
    // Sectie 04: "Wat vandaag al klopt" t.e.m. "Startpunt..." zijn losse
    // witte kaartjes in 1 kolom (zie pg-09); Congruentie is volle-breedte.
    if (sectieNummer === "04" && i >= 2) {
      out.push(renderCalloutKaart(b));
      i++;
      continue;
    }
    out.push(renderCalloutVolleBreedte(b));
    i++;
  }
  // Groepeer opeenvolgende kaart-elementen (sectie 04) in een 1-koloms stack
  // zodat de marges tussen kaartjes klein en consistent blijven.
  return out.join("");
}

// --- Datatabellen (component 8) + driver-tabel (component 9) ---------------

const DRIVER_TABEL_KOLOMMEN = ["driver", "focus", "versneller"];

function isEnergieTabel(kolommen: string[]): boolean {
  const lower = kolommen.map((k) => k.toLowerCase());
  return lower.includes("net") && lower.includes("energie") && lower.includes("status");
}

function renderStatusBadge(status: string): string {
  const kleur = kleurVoorStatus(status);
  return `<span class="badge badge--${kleur}">${esc(status)}</span>`;
}

// Rijke driver/focus/versneller-tabel (component 9): icoon + naam, gekleurde
// net-waarde, energie-balkjesmeter, status-badge, lezing.
function renderEnergieTabel(t: T4pTabel): string {
  const th = t.kolommen.map((k) => `<th>${esc(k)}</th>`).join("");
  const idxNaam = 0;
  const idxNet = t.kolommen.findIndex((k) => k.toLowerCase() === "net");
  const idxEnergie = t.kolommen.findIndex((k) => k.toLowerCase() === "energie");
  const idxStatus = t.kolommen.findIndex((k) => k.toLowerCase() === "status");
  const idxLezing = t.kolommen.findIndex((k) => k.toLowerCase() === "lezing");
  const rows = t.rijen
    .map((row) => {
      const cellen = row.map((c, ci) => {
        const waarde = String(c);
        if (ci === idxNaam) {
          const icon = iconVoorNaam(waarde);
          return `<td class="cel-naam"><span class="rij-icoon">${icon}</span>${esc(waarde)}</td>`;
        }
        if (ci === idxNet) {
          return `<td class="cel-net ${tekenKleurClass(waarde)}">${esc(waarde)}</td>`;
        }
        if (ci === idxEnergie) {
          return `<td class="cel-energie">${renderMeter(waarde)}<span class="energie-waarde ${tekenKleurClass(
            waarde
          )}">${esc(waarde)}</span></td>`;
        }
        if (ci === idxStatus) {
          return `<td>${renderStatusBadge(waarde)}</td>`;
        }
        if (ci === idxLezing) {
          return `<td class="cel-lezing">${esc(waarde)}</td>`;
        }
        return `<td>${esc(waarde)}</td>`;
      });
      return `<tr>${cellen.join("")}</tr>`;
    })
    .join("\n");
  return `<table class="driver-tabel"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Compacte status-only tabel (sectie 13): naam + status-badge.
function isStatusTabel(kolommen: string[]): boolean {
  const lower = kolommen.map((k) => k.toLowerCase());
  return lower.length === 2 && lower.includes("status");
}

function renderStatusTabel(t: T4pTabel): string {
  const th = t.kolommen.map((k) => `<th>${esc(k)}</th>`).join("");
  const idxStatus = t.kolommen.findIndex((k) => k.toLowerCase() === "status");
  const rows = t.rijen
    .map((row) => {
      const cellen = row.map((c, ci) => {
        const waarde = String(c);
        if (ci === idxStatus) return `<td>${renderStatusBadge(waarde)}</td>`;
        const icon = iconVoorNaam(waarde);
        return `<td class="cel-naam">${icon ? `<span class="rij-icoon">${icon}</span>` : ""}${esc(waarde)}</td>`;
      });
      return `<tr>${cellen.join("")}</tr>`;
    })
    .join("\n");
  return `<table class="driver-tabel driver-tabel--compact"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Algemene teal-header datatabel (component 8): sectie 03 metingtabel,
// sectie 20/21/22/17 e.a. Ondersteunt optioneel bold-eerste-kolom en
// gekleurde net/energie/status-cellen indien die kolommen aanwezig zijn.
// E/H-badge (component 8, sectie 07/09 expertise-tabel): E+H=goud,
// H=groen, E=teal - kleine pill zoals in de PDF (pg-13).
function renderEhBadge(waarde: string): string {
  const w = waarde.trim().toUpperCase();
  const kleur: Kleur = w === "E+H" ? "goud" : w === "H" ? "groen" : "teal";
  return `<span class="badge badge--eh badge--eh-${kleur}">${esc(waarde)}</span>`;
}

function renderAlgemeneTabel(t: T4pTabel, opts: { boldEersteKolom?: boolean } = {}): string {
  const th = t.kolommen.map((k) => `<th>${esc(k)}</th>`).join("");
  const idxNet = t.kolommen.findIndex((k) => k.toLowerCase() === "net");
  const idxEnergie = t.kolommen.findIndex((k) => k.toLowerCase().includes("energie"));
  const idxStatus = t.kolommen.findIndex((k) => k.toLowerCase() === "status");
  const idxEh = t.kolommen.findIndex((k) => k.toUpperCase() === "E/H");
  const rows = t.rijen
    .map((row) => {
      const cellen = row.map((c, ci) => {
        const waarde = String(c);
        const classes: string[] = [];
        if (ci === 0 && opts.boldEersteKolom) classes.push("cel-bold");
        if (ci === idxNet) classes.push(tekenKleurClass(waarde));
        if (ci === idxEnergie && idxEnergie !== idxNet) classes.push(tekenKleurClass(waarde));
        if (ci === idxStatus) {
          return `<td class="${classes.join(" ")}">${renderStatusBadge(waarde)}</td>`;
        }
        if (ci === idxEh) {
          return `<td class="${classes.join(" ")}">${renderEhBadge(waarde)}</td>`;
        }
        return `<td class="${classes.join(" ")}">${esc(waarde)}</td>`;
      });
      return `<tr>${cellen.join("")}</tr>`;
    })
    .join("\n");
  return `<table class="data-tabel"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTabelSlim(t: T4pTabel, sectieNummer: string): string {
  if (isEnergieTabel(t.kolommen)) return renderEnergieTabel(t);
  if (isStatusTabel(t.kolommen)) return renderStatusTabel(t);
  const boldEersteKolom = sectieNummer === "22";
  return renderAlgemeneTabel(t, { boldEersteKolom });
}

// --- Bronstellingen (component 10) ------------------------------------------
function renderBronstellingen(s: T4pSectie): string {
  const minstBlok = (s.blokken ?? []).find((b) => /minst herkend/i.test(b.kop));
  const meestTitel = "In de vragenlijst herkende Marc zich het meest in";
  const minstTitel = "In de vragenlijst herkende Marc zich het minst in";
  const linkerLijst = (s.citaten ?? [])
    .map((c) => `<li class="quote-item"><span class="quote-glyph">${QUOTE_GLYPH}</span>${esc(c)}</li>`)
    .join("");
  const rechterInhoud = minstBlok
    ? `<p class="bronkaart-uitleg">${esc(minstBlok.tekst)}</p>`
    : `<p class="leeg">Geen verbatim stellingen vastgelegd voor deze afname.</p>`;
  return (
    `<div class="bronkaarten">` +
    `<div class="bronkaart bronkaart--meest"><div class="bronkaart-kop">${esc(
      meestTitel
    )}</div><ul class="quote-lijst">${linkerLijst}</ul></div>` +
    `<div class="bronkaart bronkaart--minst"><div class="bronkaart-kop">${esc(
      minstTitel
    )}</div>${rechterInhoud}</div>` +
    `</div>`
  );
}

// --- Mantra + dankwoord (component 11) --------------------------------------
function renderMantraSectie(s: T4pSectie): string {
  const paras = s.paragrafen ?? [];
  const mantraTekst = paras[0] ?? "";
  const overigeParas = paras.slice(1);
  const dankwoordBlok = (s.blokken ?? []).find((b) => /dankwoord/i.test(b.kop));
  const out: string[] = [];
  if (mantraTekst) out.push(`<p class="mantra">${esc(mantraTekst)}</p>`);
  overigeParas.forEach((p) => out.push(`<p>${esc(p)}</p>`));
  if (dankwoordBlok) {
    // Splits de dankwoordtekst in leesbare regels (zie pg-39): zin 1
    // (dank), zin 2 (contactregel), zin 3 (Inspiratie, italic). We knippen
    // op newline (indien aanwezig) of op het em-dash-scheidingsteken vóór
    // "Inspiratie", zonder lookbehind-regex (ES2018-only), en op de eerste
    // punt na de dankzin zodat de contactregel op een eigen regel komt.
    let tekst = dankwoordBlok.tekst;
    const regels: string[] = [];
    const inspiratieIdx = tekst.search(/\s[—-]\s*Inspiratie/i);
    let inspiratieRegel = "";
    if (inspiratieIdx >= 0) {
      inspiratieRegel = tekst.slice(inspiratieIdx).replace(/^\s*[—-]\s*/, "").trim();
      tekst = tekst.slice(0, inspiratieIdx).trim();
    }
    const eersteZinEinde = tekst.indexOf(". ");
    if (eersteZinEinde >= 0) {
      regels.push(tekst.slice(0, eersteZinEinde + 1).trim());
      regels.push(tekst.slice(eersteZinEinde + 1).trim());
    } else if (tekst) {
      regels.push(tekst);
    }
    if (inspiratieRegel) regels.push(inspiratieRegel);
    const regelsGefilterd = regels.map((r) => r.trim()).filter(Boolean);
    out.push(
      `<div class="callout callout--teal"><div class="callout-label">${esc(
        dankwoordBlok.kop
      )}</div><div class="callout-tekst">${regelsGefilterd
        .map((r) => (r.startsWith("Inspiratie") ? `<em>${esc(r)}</em>` : esc(r)))
        .join("<br />")}</div></div>`
    );
  }
  return out.join("\n");
}

// --- Hoofd-render-functie ----------------------------------------------------

export function renderT4pBusinessProfielHtml(inhoud: T4pRapportInhoud): string {
  const r = inhoud.respondent;
  const metaRegel = [r.organisatie, r.functie].filter(Boolean).join(" · ");

  const tocHtml = inhoud.inhoudsopgave
    .map((i) => `<li><span class="toc-num">${esc(i.nummer)}</span> ${esc(i.titel)}</li>`)
    .join("\n");

  const sectiesHtml = inhoud.secties
    .map((s) => {
      const parts: string[] = [];
      parts.push(renderSectieKop(s));

      if (s.saldo) parts.push(renderSaldo(s.saldo));

      if (s.kpis && s.kpis.length) parts.push(renderKpis(s.kpis));

      // Sectie 01: highlight-quote na de KPI's, vóór de callouts.
      // De quote komt niet als los datacveld voor in sectie 01: het intro-
      // zinnetje van de ondertitel wordt daarom niet herhaald; enkel bij
      // secties waar een expliciete introquote als eerste paragraaf voorkomt
      // (bronstellingen-secties gebruiken de gewone paragraafstijl).

      const isBronstellingen = !!s.citaten;

      // Sectie 24 (mantra/dankwoord) rendert zijn paragrafen zelf via
      // renderMantraSectie() hieronder (eerste paragraaf = mantra-zin in
      // quote-stijl, overige als lopende tekst) - niet hier dubbel tonen.
      if (s.nummer !== "24" && s.paragrafen && s.paragrafen.length) {
        s.paragrafen.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
      }

      if (s.tabel) {
        // Sectie 03 (pg-06): drie losse energie-meters boven de metingtabel.
        if (s.nummer === "03") parts.push(renderStandaloneMeters(s.tabel));
        parts.push(renderTabelSlim(s.tabel, s.nummer));
      }

      if (s.tabellen) {
        s.tabellen.forEach((t) => {
          if (t.kop) parts.push(`<h3>${esc(t.kop)}</h3>`);
          parts.push(renderTabelSlim(t.tabel, s.nummer));
        });
      }

      if (isBronstellingen) {
        parts.push(renderBronstellingen(s));
      } else if (s.citaten && s.citaten.length === 0) {
        parts.push(`<p class="leeg">Geen verbatim stellingen vastgelegd voor deze afname.</p>`);
      }

      if (s.nummer === "24") {
        parts.push(renderMantraSectie(s));
      } else if (s.blokken && s.blokken.length) {
        // Bronstellingen-secties (06/08/10): het "...minst herkende lijnen"-
        // blok is al verwerkt in de rechterkaart via renderBronstellingen();
        // niet nogmaals als losse callout tonen (voorkomt duplicatie).
        const overigeBlokken = isBronstellingen
          ? s.blokken.filter((b) => !/minst herkend/i.test(b.kop))
          : s.blokken;
        if (overigeBlokken.length) parts.push(renderBlokken(s.nummer, overigeBlokken));
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
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  :root {
    --navy: #1e293b; --ink: #1e293b; --muted: #64748b; --muted-light: #94a3b8;
    --line: #e2e8f0; --surface: #f8fafc; --white: #ffffff;
    --teal: #0d6d6a; --teal-dark: #0f5c58; --teal-tint: #eef4f3;
    --goud: #c08a1e; --goud-dark: #b8860b;
    --terracotta: #b3552d; --terracotta-dark: #a0451f; --terracotta-tint: #f7ede7;
    --groen: #4a7c3a; --groen-dark: #5c8a3c; --groen-tint: #eef4ea;
    --grijs-tint: #f1f4f5; --grijs-accent: #64748b;
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
    padding: 56px 48px 40px; color: var(--teal-dark); border-bottom: 2px solid var(--teal);
  }
  .brand-mark-name {
    font-size: 22px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;
    border-bottom: 2px solid var(--teal-dark); display: inline-block; padding-bottom: 10px; width: 100%;
  }
  .t4p-mark { font-size: 13px; font-weight: 700; letter-spacing: 0.5em; margin: 28px 0 6px; color: var(--goud); text-transform: uppercase; }
  h1 { font-size: 40px; font-weight: 800; margin: 0 0 14px; line-height: 1.1; color: var(--teal-dark); }
  .sub { color: var(--muted); font-size: 15px; font-style: italic; margin: 0 0 24px; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 24px; font-size: 13px; margin-top: 16px; border-top: 1px solid var(--line); padding-top: 16px; }
  .meta-grid dt { color: var(--muted-light); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .meta-grid dd { margin: 0 0 6px; font-weight: 700; color: var(--ink); }
  .vertrouwelijk { margin-top: 18px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--teal-dark); font-weight: 700; }
  .doc-body { padding: 40px 48px 40px; }
  .toc-titel { font-size: 32px; font-weight: 800; color: var(--teal-dark); margin: 0 0 12px; }
  .toc-lijn { height: 2px; background: var(--teal-dark); margin: 0 0 18px; }
  .toc { list-style: none; padding: 0; margin: 0 0 28px; font-size: 13.5px; }
  .toc li { padding: 9px 0; color: var(--ink); border-bottom: 1px solid var(--line); font-weight: 600; }
  .toc-num { color: var(--goud); font-weight: 800; margin-right: 14px; min-width: 22px; display: inline-block; }

  /* --- Sectiekop (component 1) --- */
  .sec-kop-rij { text-align: right; margin: 0 0 4px; }
  .running-header { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted-light); font-weight: 600; }
  h2 { display: flex; align-items: baseline; gap: 14px; margin: 30px 0 0; padding: 0; border: none; }
  section:first-of-type h2 { margin-top: 0; }
  .sec-nr { font-size: 42px; font-weight: 800; color: var(--goud); line-height: 1; }
  .sec-titel { font-size: 25px; font-weight: 800; color: var(--teal-dark); line-height: 1.15; }
  .sec-lijn { height: 2px; background: var(--teal); margin: 14px 0 10px; }
  .sec-sub { color: var(--muted); font-size: 13px; font-style: italic; margin: 0 0 18px; }
  h3 { font-size: 13px; font-weight: 700; color: var(--teal-dark); margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  p { font-size: 14px; line-height: 1.7; margin: 0 0 12px; color: var(--ink); }
  .leeg { color: var(--muted-light); font-style: italic; }

  /* --- KPI-kaarten (component 4) --- */
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 18px 0 22px; }
  .kpi-kaart { background: var(--white); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  .kpi-val { font-size: 26px; font-weight: 800; color: var(--teal-dark); line-height: 1.1; }
  .kpi-val--goud { color: var(--goud); }
  .kpi-val--teal { color: var(--teal-dark); }
  .kpi-lbl { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; font-weight: 700; }

  /* --- Highlight-quote (component 3) --- */
  .highlight-quote { font-style: italic; font-size: 15px; line-height: 1.6; color: var(--ink); border-left: 3px solid var(--goud); padding: 4px 0 4px 18px; margin: 8px 0 22px; }

  /* --- Energiesaldo-badge (component 2) --- */
  .saldo-badge { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 8px; padding: 16px 20px; margin: 4px 0 22px; border-left: 4px solid; }
  .saldo-badge-links { display: flex; align-items: flex-start; gap: 12px; }
  .saldo-badge-icoon { flex: 0 0 auto; margin-top: 2px; }
  .saldo-badge-label { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .saldo-badge-gloss { font-size: 12px; font-style: italic; color: var(--muted); margin-top: 2px; }
  .saldo-badge-waarde { font-size: 28px; font-weight: 800; white-space: nowrap; }
  .saldo-badge--teal { background: var(--teal-tint); border-left-color: var(--teal); }
  .saldo-badge--teal .saldo-badge-icoon, .saldo-badge--teal .saldo-badge-label, .saldo-badge--teal .saldo-badge-waarde { color: var(--teal-dark); }
  .saldo-badge--groen { background: var(--groen-tint); border-left-color: var(--groen); }
  .saldo-badge--groen .saldo-badge-icoon, .saldo-badge--groen .saldo-badge-label, .saldo-badge--groen .saldo-badge-waarde { color: var(--groen-dark); }
  .saldo-badge--terracotta { background: var(--terracotta-tint); border-left-color: var(--terracotta); }
  .saldo-badge--terracotta .saldo-badge-icoon, .saldo-badge--terracotta .saldo-badge-label, .saldo-badge--terracotta .saldo-badge-waarde { color: var(--terracotta-dark); }
  .saldo-badge--grijs { background: var(--grijs-tint); border-left-color: var(--grijs-accent); }
  .saldo-badge--grijs .saldo-badge-icoon, .saldo-badge--grijs .saldo-badge-label, .saldo-badge--grijs .saldo-badge-waarde { color: var(--grijs-accent); }

  /* --- Callout-blokken, volle breedte (component 5, variant 1) --- */
  .callout { border-radius: 8px; border-left: 4px solid; padding: 14px 18px; margin: 0 0 14px; }
  .callout-label { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
  .callout-tekst { font-size: 13.5px; line-height: 1.65; color: var(--ink); }
  .callout-tekst em { font-style: italic; }
  .callout--teal { background: var(--teal-tint); border-left-color: var(--teal); }
  .callout--teal .callout-label { color: var(--teal-dark); }
  .callout--groen { background: var(--groen-tint); border-left-color: var(--groen); }
  .callout--groen .callout-label { color: var(--groen-dark); }
  .callout--terracotta { background: var(--terracotta-tint); border-left-color: var(--terracotta); }
  .callout--terracotta .callout-label { color: var(--terracotta-dark); }

  /* --- Witte kaartjes, 1 kolom (component 5, variant 2 - sectie 04) --- */
  .kaart { background: var(--white); border: 1px solid var(--line); border-left: 4px solid; border-radius: 8px; padding: 14px 18px; margin: 0 0 14px; }
  .kaart-label { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
  .kaart-tekst { font-size: 13.5px; line-height: 1.6; color: var(--ink); }
  .kaart--teal { border-left-color: var(--teal); }
  .kaart--teal .kaart-label { color: var(--teal-dark); }
  .kaart--groen { border-left-color: var(--groen); }
  .kaart--groen .kaart-label { color: var(--groen-dark); }
  .kaart--terracotta { border-left-color: var(--terracotta); }
  .kaart--terracotta .kaart-label { color: var(--terracotta-dark); }

  /* --- Twee-koloms getinte panelen (component 6) --- */
  .paneel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 0 0 14px; }
  .paneel { border-radius: 8px; border-left: 4px solid; padding: 14px 18px; }
  .paneel-kop { font-size: 15px; font-weight: 800; margin-bottom: 8px; line-height: 1.25; }
  .paneel-tekst { font-size: 13px; line-height: 1.6; color: var(--ink); }
  .paneel--groen { background: var(--groen-tint); border-left-color: var(--groen); }
  .paneel-kop--groen { color: var(--groen-dark); }
  .paneel--terracotta { background: var(--terracotta-tint); border-left-color: var(--terracotta); }
  .paneel-kop--terracotta { color: var(--terracotta-dark); }
  .paneel--teal { background: var(--teal-tint); border-left-color: var(--teal); }
  .paneel-kop--teal { color: var(--teal-dark); }

  /* --- Energie-meter balkjes (component 7) --- */
  .meter { display: inline-flex; gap: 3px; align-items: center; }
  .meter-blok { width: 13px; height: 13px; border-radius: 2px; background: #e4e2da; display: inline-block; }
  .meter-blok--terracotta { background: var(--terracotta); }
  .meter-blok--groen { background: var(--teal-dark); }
  .meter-blok--grijs { background: #e4e2da; }
  .meter-kop { font-size: 14px; font-weight: 700; color: var(--ink); margin: 18px 0 8px; }
  .meter-los { margin-bottom: 18px; }
  .meter-waarde-los { display: block; margin-top: 6px; font-size: 13px; font-weight: 700; }
  .waarde--teal { color: var(--teal-dark); }
  .waarde--groen { color: var(--groen-dark); }
  .waarde--terracotta { color: var(--terracotta-dark); }

  /* --- Tabellen algemeen (component 8) --- */
  table { width: 100%; border-collapse: collapse; margin: 4px 0 18px; font-size: 12.5px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
  thead tr { background: var(--teal-dark); }
  th { color: rgba(255,255,255,0.95); font-weight: 700; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 11px 14px; text-align: left; }
  td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f9f8f4; }
  tbody tr:last-child td { border-bottom: none; }
  .cel-bold { font-weight: 700; }
  .data-tabel .badge { margin: 0; }

  /* --- Driver-tabel (component 9) --- */
  .driver-tabel td { vertical-align: middle; }
  .cel-naam { font-weight: 600; white-space: nowrap; }
  .rij-icoon { display: inline-flex; margin-right: 8px; color: var(--muted); vertical-align: middle; }
  .cel-net { font-weight: 700; }
  .cel-energie { min-width: 150px; }
  .energie-waarde { display: block; margin-top: 5px; font-size: 11.5px; font-weight: 700; }
  .cel-lezing { color: var(--ink); }
  .driver-tabel--compact .cel-naam { white-space: normal; }

  /* --- Status-badge (pill) --- */
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--white); white-space: nowrap; }
  .badge--terracotta { background: var(--terracotta); }
  .badge--groen { background: var(--groen-dark); }
  .badge--grijs { background: #6b7280; }
  .badge--eh { min-width: 34px; text-align: center; }
  .badge--eh-goud { background: var(--goud); }
  .badge--eh-groen { background: var(--groen-dark); }
  .badge--eh-teal { background: var(--teal-dark); }

  /* --- Bronstellingen (component 10) --- */
  .bronkaarten { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 10px 0 20px; }
  .bronkaart { background: var(--white); border: 1px solid var(--line); border-top: 3px solid; border-radius: 8px; padding: 18px 20px; }
  .bronkaart--meest { border-top-color: var(--groen); }
  .bronkaart--minst { border-top-color: var(--terracotta); }
  .bronkaart-kop { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink); margin-bottom: 14px; line-height: 1.4; }
  .quote-lijst { list-style: none; margin: 0; padding: 0; }
  .quote-item { font-style: italic; font-size: 13px; line-height: 1.55; color: var(--ink); padding: 10px 0; border-bottom: 1px solid var(--line); }
  .quote-item:last-child { border-bottom: none; }
  .quote-glyph { color: var(--goud); font-weight: 800; font-style: normal; font-size: 17px; margin-right: 6px; font-family: Georgia, serif; }
  .bronkaart-uitleg { font-style: italic; color: var(--muted); font-size: 13px; line-height: 1.6; margin: 0; }

  /* --- Mantra + dankwoord (component 11) --- */
  .mantra { font-style: italic; font-size: 19px; font-weight: 600; line-height: 1.5; color: var(--ink); border-left: 4px solid var(--goud); padding: 6px 0 6px 20px; margin: 6px 0 20px; }

  /* --- Bronnen (sectie 23) --- */
  .bronnen { list-style: none; padding: 0; margin: 12px 0; }
  .bronnen li { padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 600; }
  .bronnen a { color: var(--teal); font-weight: 400; font-size: 12px; word-break: break-all; }

  .disclaimer { margin-top: 32px; padding: 16px 18px; background: var(--grijs-tint); border-left: 3px solid var(--teal); border-radius: 0 8px 8px 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
  .doc-footer { padding: 16px 48px; background: var(--surface); border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 11px; color: var(--muted-light); }
  .doc-footer-brand { font-weight: 700; color: var(--teal-dark); letter-spacing: 0.04em; }
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
      <div class="toc-titel">Inhoud</div>
      <div class="toc-lijn"></div>
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
