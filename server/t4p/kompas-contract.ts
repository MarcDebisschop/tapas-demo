// kompas-contract.ts — bouwt het inhoudscontract voor de Kompas-renderer
// (kompas-layout.ts) uit het bevroren generator-contract van een afname.
//
// Vormspecificatie: referentie/inhoud.json (het 33-pagina referentierapport).
// Per hoofdstuk exact dezelfde onderdeel-types in dezelfde volgorde met dezelfde
// sleutels; `compact` en `titelregels` per sectie worden overgenomen.
//
// Terminologie: "drivers" (Taibi Kahler) — nooit een ander woord daarvoor.
//
// Rangorde overal: netscore aflopend -> meest aflopend -> minst oplopend ->
// alfabetisch. De energiestatus (geeft/neutraal/kost) is NOOIT een sorteersleutel.
import { isTapasBeeld } from "../../shared/talent-constructs";
import { energieStatusVanGemiddelde } from "../../shared/energie-schaal";

export interface KompasDeelnemer {
  naam: string;
  code?: string;
  organisatie?: string;
  functie?: string;
  rapportdatum?: string;
}

interface Rij {
  construct: string;
  family: string;
  most: number;
  least: number;
  net: number;
  avgEnergy: number;
  shown: number;
  mostItems: string[];
  leastItems: string[];
}

// ---------------------------------------------------------------- getalhulpjes

function num(x: unknown, standaard = 0): number {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? ""));
  return Number.isFinite(n) ? n : standaard;
}

/** Belgische notatie met echt minteken (U+2212) in plaats van koppelteken. */
function komma(s: string): string {
  return s.replace(".", ",").replace("-", "−");
}

/** Vast aantal decimalen, altijd met teken: 0.38 -> "+0,38", -0.83 -> "−0,83". */
function getal(x: unknown, decimalen = 2): string {
  const n = num(x);
  return (n < 0 ? "" : "+") + komma(n.toFixed(decimalen));
}

/** Zonder overtollige nullen: 2 -> "2", 5.5 -> "5,5", -3.5 -> "−3,5". */
function kort(x: unknown, teken = false): string {
  const n = num(x);
  let s = String(Math.round(n * 100) / 100);
  if (s.includes("e")) s = n.toFixed(2);
  return (n < 0 ? "" : teken ? "+" : "") + komma(s);
}

/** Nettoscore als "+6" / "−1" / "0". */
function netTekst(n: number): string {
  return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0";
}

// De grens staat in shared/energie-schaal.ts. Zij stond hier, en werd van hier
// overgenomen; het rapport en de vergelijkende studie van T4Recruitment lezen nu
// dezelfde regel, zodat dezelfde energie nooit twee statussen kan krijgen.
function statusVanEnergie(gem: number): "geeft" | "kost" | "neutraal" {
  return energieStatusVanGemiddelde(gem);
}

/** Som van de gemiddelde energie over rijen, afgerond op twee decimalen. */
function som(rijen: Rij[]): number {
  return Math.round(rijen.reduce((t, r) => t + r.avgEnergy, 0) * 100) / 100;
}

function lijstZin(namen: string[]): string {
  if (namen.length === 0) return "";
  if (namen.length === 1) return namen[0];
  return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
}

function saldoZin(status: "geeft" | "kost" | "neutraal"): string {
  return status === "geeft"
    ? "dit construct geeft per saldo energie"
    : status === "kost"
    ? "dit construct kost per saldo energie"
    : "dit construct is per saldo energetisch neutraal";
}

/** Icoonnaam zoals in kompas-iconen.ts: "Be Perfect" -> "be-perfect". */
function icoonNaam(construct: string): string {
  return construct
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --------------------------------------------------------------- rangordelogica

/**
 * De enige toegestane rangorde: netscore aflopend, dan meest aflopend, dan
 * minst oplopend, dan alfabetisch. Energie speelt hier bewust geen rol.
 */
function rangorde(a: Rij, b: Rij): number {
  if (b.net !== a.net) return b.net - a.net;
  if (b.most !== a.most) return b.most - a.most;
  if (a.least !== b.least) return a.least - b.least;
  return a.construct < b.construct ? -1 : a.construct > b.construct ? 1 : 0;
}

// ------------------------------------------------------------- vaste constanten

/** Kernwoord per construct — instrumentkennis, geen persoonsgegeven. */
const KERN: Record<string, string> = {
  "Be Perfect": "kwaliteit en correctheid",
  "Try Hard": "mobiliserende ambitie",
  "Please Others": "relationele aanpassing",
  "Be Strong": "emotionele afstand en zelfdragen",
  "Hurry Up": "snelheid en gejaagdheid",
  Innovatie: "vernieuwing en nieuwe wegen",
  "Inter-relationeel": "mensgevoeligheid en afstemming",
  Operationeel: "processen bruikbaar maken",
  Strategie: "klassiek strategisch positioneren",
  "TaPas-Beeld": "identiteit, waarden en betekenis",
  Analyse: "doorgronden en ontwarren",
  Coaching: "mensen begeleiden en ontsluiten",
  Impact: "mensen in beweging brengen",
  "Constructief onderscheidend": "het verschilmakende beeld vormen",
  Faciliteren: "groepsafstemming ondersteunen",
  Resultaatgericht: "een concreet resultaatbeeld vormen",
};

/** Eén woord per construct, voor opsommingen in doorlopende tekst. */
const KORT: Record<string, string> = {
  "Be Perfect": "kwaliteit",
  "Try Hard": "ambitie",
  "Please Others": "aanpassing",
  "Be Strong": "zelfdragen",
  "Hurry Up": "snelheid",
  Innovatie: "vernieuwing",
  "Inter-relationeel": "afstemming",
  Operationeel: "uitvoering",
  Strategie: "positionering",
  "TaPas-Beeld": "betekenis",
  Analyse: "analyse",
  Coaching: "coaching",
  Impact: "invloed",
  "Constructief onderscheidend": "onderscheid",
  Faciliteren: "facilitering",
  Resultaatgericht: "resultaat",
};

/** E/H-oriëntatie per construct, met de duiding uit de vormspecificatie. */
const EH: Record<string, { code: string; duiding: string }> = {
  Innovatie: {
    code: "E+H",
    duiding:
      "Vernieuwt zowel inhoudelijk als verbindend — ideeën waar anderen door geïnspireerd raken.",
  },
  "Inter-relationeel": {
    code: "H",
    duiding: "Volledig mensgericht: aanvoelen wanneer iemand zich niet goed voelt.",
  },
  Operationeel: {
    code: "E",
    duiding:
      "Vooral functioneel: complexe processen vertalen naar bruikbare hulpmiddelen.",
  },
  Strategie: { code: "E", duiding: "Het klassiek-functionele wordt niet spontaan gekozen." },
  Analyse: { code: "E+H", duiding: "Doorgrondt zowel inhoud als mensen." },
  Coaching: { code: "H", duiding: "Mensgericht: aanvoelen en begeleiden." },
  Impact: { code: "H", duiding: "Verbindend: mensen in beweging krijgen." },
  "Constructief onderscheidend": { code: "E", duiding: "Functioneel; niet als kernpad." },
  Faciliteren: { code: "E", duiding: "Eerder functioneel dan mensgericht." },
  Resultaatgericht: { code: "E", duiding: "Functioneel-resultaatmatig." },
};

/** Kolombreedtes in pt, letterlijk uit de vormspecificatie (som ≈ 491,3pt). */
const BREEDTE = {
  datakwaliteit: [168.5, 322.8],
  meting: [257.3, 234.0],
  drivers: [75.7, 35.1, 122.0, 70.1, 188.4],
  foci: [92.9, 35.1, 122.0, 70.1, 171.2],
  versnellers: [130.8, 35.1, 122.0, 56.9, 146.5],
  verbondenheid: [165.9, 51.4, 274.0],
  lek: [73.8, 35.1, 122.0, 53.2, 207.2],
  tweedeLaag: [106.5, 35.1, 122.0, 70.1, 157.6],
  bigfive: [97, 75.1, 319.2],
  riasec: [91.8, 72.3, 327.2],
  jaques: [87.7, 71.2, 332.4],
  lenzen: [186, 157.1, 148.2],
  families: [122.5, 104.2, 264.6],
  constructen: [217.2, 99.6, 53.2, 121.3],
  ankers: [102.3, 280.7, 108.3],
};

export const KOMPAS_LEESWIJZER =
  "Elk hoofdstuk werkt op twee niveaus. De nettoscore toont het potentieel; de " +
  "energie- en duidingslaag toont de beschikbaarheid vandaag: of die lijn energie " +
  "geeft, neutraal is of energie kost. Een hoge nettoscore betekent dus niet " +
  "automatisch dat een talent vandaag vrij beschikbaar is — dat dubbele lezen is " +
  "de kern van een verantwoorde T4P-interpretatie.";

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Kwalificatie bij een gemiddelde energiewaarde (-2 .. +2). */
function energieKwalificatie(gem: number): string {
  if (gem >= 0.75) return "sterk positief";
  if (gem >= 0.25) return "positief";
  if (gem > 0) return "licht positief";
  if (gem === 0) return "neutraal";
  if (gem > -0.25) return "licht negatief";
  if (gem > -0.75) return "negatief";
  return "sterk negatief";
}

/** Lezing in de constructtabellen van 05/07/09 — afgeleid, geen sjabloontekst. */
function tabelLezing(r: Rij, positie: number): string {
  const kern = KERN[r.construct] ?? r.construct.toLowerCase();
  const st = statusVanEnergie(r.avgEnergy);
  // Kort houden: de lezingkolom is 146,5–188,4pt breed, dus ±44 tekens per regel.
  const energiedeel =
    st === "kost"
      ? "werkt vandaag als <b>rem</b>."
      : st === "geeft"
      ? "werkt als <b>gaspedaal</b>."
      : "energetisch neutraal.";
  if (positie === 0) return `Dominante lijn rond ${kern}; ${energiedeel}`;
  if (r.net > 0) return `Herkende route; ${energiedeel}`;
  if (r.net === 0) return `Wisselend herkend; ${energiedeel}`;
  return `Geen kernroute; ${energiedeel}`;
}

/** Romeinse cijfers voor de Jaques-strata. */
const ROMEINS = ["", "I", "II", "III", "IV", "V", "VI"];

/** Jaques-strata: tijdspanne en aard van het werk per niveau. */
const STRATA: { tijdspanne: string; aard: string }[] = [
  { tijdspanne: "", aard: "" },
  {
    tijdspanne: "1 dag–3 maanden",
    aard: "Concrete taken uitvoeren binnen vastgelegde procedures en directe opvolging.",
  },
  {
    tijdspanne: "3 maanden–1 jaar",
    aard: "Toezicht op concreet werk; problemen ter plaatse diagnosticeren en oplossen.",
  },
  {
    tijdspanne: "1–2 jaar",
    aard: "Aansturen van één operationeel (sub)systeem; vooruitdenken 12–18 maanden.",
  },
  {
    tijdspanne: "2–5 jaar",
    aard:
      "Meerdere lijnen tegelijk integreren, nieuwe methoden en beleid ontwerpen; parallel " +
      "verwerken van systemen.",
  },
  {
    tijdspanne: "5–10 jaar",
    aard:
      "Eén volledig systeem leiden in zijn omgeving; effecten van binnen- en buitenwereld " +
      "inschatten.",
  },
  {
    tijdspanne: "10–20 jaar",
    aard:
      "Meerdere systemen positioneren in een bredere markt- en maatschappelijke omgeving.",
  },
];

/**
 * RIASEC-letters met de T4P-constructen die de interesse dragen. De canonieke
 * hexagoonorde R–I–A–S–E–C dient als tiebreak; letters zonder dragend construct
 * zijn niet gemeten en komen daarom altijd achteraan.
 */
const RIASEC: { letter: string; naam: string; constructen: string[] }[] = [
  { letter: "R", naam: "Realistisch", constructen: [] },
  { letter: "I", naam: "Investigatief", constructen: ["Analyse"] },
  { letter: "A", naam: "Artistiek", constructen: ["TaPas-Beeld", "Innovatie"] },
  { letter: "S", naam: "Sociaal", constructen: ["Coaching", "Inter-relationeel"] },
  { letter: "E", naam: "Ondernemend", constructen: ["Impact"] },
  { letter: "C", naam: "Conventioneel", constructen: ["Operationeel", "Strategie"] },
];

/** Indicatie per rangpositie binnen de zes RIASEC-letters. */
const RIASEC_INDICATIE = [
  "Sterk (primair)",
  "Sterk",
  "Midden–sterk",
  "Midden",
  "Laag–midden",
  "Laag",
];

/** Indicatie voor een Big-Five-dimensie op basis van het gemiddelde nettoscore-niveau. */
function bigFiveIndicatie(gemiddelde: number): string {
  if (gemiddelde >= 4.5) return "Zeer hoog";
  if (gemiddelde >= 3.0) return "Hoog";
  if (gemiddelde >= 2.0) return "Midden–hoog";
  if (gemiddelde >= 0.5) return "Midden";
  if (gemiddelde >= -1.5) return "Laag–midden";
  return "Laag";
}

export function bouwKompasContract(contract: any, deelnemer: KompasDeelnemer): any {
  const taal = String(contract?.taal ?? "nl");
  const hoofd = contract?.sections?.main ?? {};
  const meta = hoofd.meta ?? {};

  /** most/leastItems zijn ofwel platte strings ofwel meertalige objecten. */
  const tekstVan = (x: any): string =>
    typeof x === "string" ? x : String(x?.[taal] ?? x?.nl ?? "");

  const alle: Rij[] = (hoofd.constructRows ?? []).map((r: any) => ({
    construct: String(r.construct ?? ""),
    family: String(r.family ?? ""),
    most: num(r.most),
    least: num(r.least),
    net: num(r.net),
    avgEnergy: num(r.avgEnergy),
    shown: num(r.shown),
    mostItems: (r.mostItems ?? []).map(tekstVan).filter((s: string) => s !== ""),
    // Ontbreekt `leastItems` in een ouder contract, dan blijft de minst-kolom
    // leeg in plaats van de bouw te breken.
    leastItems: (r.leastItems ?? []).map(tekstVan).filter((s: string) => s !== ""),
  }));

  const drivers = alle.filter((r) => r.family === "Drivers").sort(rangorde);
  const alleFoci = alle.filter((r) => r.family === "Talent-foci").sort(rangorde);
  // TaPas-Beeld is de identiteitslaag van hoofdstuk 04 en nooit een foci-rij.
  const foci = alleFoci.filter((r) => !isTapasBeeld(r.construct));
  const tapasBeeld = alleFoci.find((r) => isTapasBeeld(r.construct));
  const versnellers = alle.filter((r) => r.family === "Talent-versnellers").sort(rangorde);

  // Familiegemiddelde = het gemiddelde van de constructgemiddelden binnen de
  // familie, dus elk construct weegt even zwaar. `familyRows` uit de
  // scoringengine weegt per item en trekt daardoor naar nul: constructen met
  // meer getoonde items domineren. Voor het Kompas is de eerste lezing juist,
  // omdat de lezer het cijfer moet kunnen natrekken in de constructtabellen
  // die eerder in het rapport staan. TaPas-Beeld telt mee in Talent-foci, zoals
  // in de referentie van 5 juni. Is er voor een familie geen enkele
  // constructrij, dan valt de waarde terug op familyRows.
  const familieRijen: { family: string; avgEnergy: number }[] = (hoofd.familyRows ?? []).map(
    (f: any) => {
      const familie = String(f.family ?? "");
      const eigen = alle.filter((r) => r.family === familie);
      const gemiddelde =
        eigen.length > 0
          ? eigen.reduce((s, r) => s + r.avgEnergy, 0) / eigen.length
          : num(f.avgEnergy);
      return { family: familie, avgEnergy: gemiddelde };
    }
  );

  const antwoorden = contract?.sections?.connection?.answers ?? {};
  const q1 = num(antwoorden.q1);
  const q2 = num(antwoorden.q2);
  const q3 = num(antwoorden.q3);
  const q4 = num(antwoorden.q4);
  const heeftModule = Object.keys(antwoorden).length > 0;

  const naam = deelnemer.naam || String(contract?.participant?.name ?? "");
  const voornaam = naam.split(/\s+/)[0] || naam;
  const organisatie = deelnemer.organisatie ?? String(contract?.participant?.company ?? "");
  const rol = String(contract?.participant?.role ?? "");
  const functie =
    deelnemer.functie ?? (rol && organisatie ? `${rol} van ${organisatie}` : rol);

  const beleefd = num(meta.baselineProfessionalEnergy);
  const gemeten = num(meta.normalizedQuestionnaireEnergy);
  const discrepantie = num(meta.energyDiscrepancy, beleefd - gemeten);
  const gemEnergie = num(meta.averageEnergy);
  const consistentie = num(meta.consistency?.score);
  const consLabel = String(meta.consistency?.label ?? "");
  // Kwaliteitsmelding over de afname (tijd per item). Null bij afnames zonder
  // tijdgegevens; die tonen dan geen melding.
  const afnamekwaliteit = meta.afnamekwaliteit ?? null;
  const tempoMelding: string | null = afnamekwaliteit?.melding ?? null;
  const risicoLabel = String(meta.driverRisk?.label ?? "");
  const schermen = num(meta.completedScreens);
  const schermenTotaal = num(meta.totalScreens, schermen);
  const keuzes = num(meta.totalChoices);

  const saldoDrivers = som(drivers);
  const saldoFoci = som(foci);
  const saldoVersnellers = som(versnellers);

  const kostDrivers = drivers.filter((r) => statusVanEnergie(r.avgEnergy) === "kost");
  const topDriver = drivers[0];
  const topFocus = foci[0];
  const topVersneller = versnellers[0];
  const tweedeVersneller = versnellers[1];

  const kern = (r: Rij | undefined): string =>
    r ? KERN[r.construct] ?? r.construct.toLowerCase() : "";
  const kortWoord = (r: Rij | undefined): string =>
    r ? KORT[r.construct] ?? r.construct.toLowerCase() : "";

  const secties: any[] = [];

  // 01 — Profiel in één oogopslag -------------------------------------------
  const motorLijnen = [topDriver, topVersneller, tweedeVersneller, topFocus]
    .filter((r): r is Rij => !!r)
    .map(kortWoord);

  /** De drie hoogst gerangschikte versnellers/foci: de dragende kern van het profiel. */
  const dragendeKern: Rij[] = [...versnellers, ...foci].slice(0, 3);
  /** Dragend talent voor de toekomstprojectie: sterkste versneller, focus en tweede versneller. */
  const dragendTalent: Rij[] = [topVersneller, topFocus, tweedeVersneller].filter(
    (r): r is Rij => !!r,
  );
  const drukpunten: string[] = [];
  if (kostDrivers[0]) drukpunten.push(`belasting door ${kortWoord(kostDrivers[0])}`);
  if (discrepantie < 0)
    drukpunten.push(
      `een beleefde energie (${kort(beleefd)}/10) onder het gemeten potentieel (${kort(gemeten)}/10)`
    );
  if (heeftModule && q3 - q4 >= 4)
    drukpunten.push("een scheef ervaren wederkerigheid met de organisatie");

  const sterktes: any[] = [];
  if (topVersneller)
    sterktes.push({
      vet: `${topVersneller.construct} als energiserende toegangspoort`,
      tekst: ` — sterkste, meest betrouwbare ingang (net ${netTekst(
        topVersneller.net
      )}, energie ${getal(topVersneller.avgEnergy)}).`,
    });
  if (topDriver)
    sterktes.push({
      vet: `${hoofdletter(kern(topDriver))} als motor`,
      tekst: ` — dominante driver (${topDriver.construct}, net ${netTekst(topDriver.net)}).`,
    });
  if (tweedeVersneller && topFocus)
    sterktes.push({
      vet: `${tweedeVersneller.construct} en ${topFocus.construct}`,
      tekst: ` — ${kern(tweedeVersneller)} samen met ${kern(topFocus)} (${
        tweedeVersneller.construct
      } ${netTekst(tweedeVersneller.net)}, ${topFocus.construct} ${netTekst(
        topFocus.net
      )}), gedragen door het identiteitsbewuste zelfbeeld (zie hoofdstuk 4, Inner Why).`,
    });

  const spanningen: any[] = [];
  if (discrepantie !== 0)
    spanningen.push({
      vet: discrepantie < 0 ? "Energie onder beleving" : "Beleving boven meting",
      tekst:
        discrepantie < 0
          ? ` — voelt vandaag minder energie (${kort(beleefd)}/10) dan gemeten potentieel (${kort(
              gemeten
            )}/10).`
          : ` — beleeft vandaag meer energie (${kort(beleefd)}/10) dan gemeten potentieel (${kort(
              gemeten
            )}/10).`,
    });
  if (kostDrivers[0])
    spanningen.push({
      vet: `${hoofdletter(kern(kostDrivers[0]))} onder druk`,
      tekst: ` — deze driver kost netto energie (${getal(kostDrivers[0].avgEnergy)}).`,
    });
  if (heeftModule)
    spanningen.push({
      vet: q3 - q4 >= 4 ? "Scheef ervaren wederkerigheid" : "Wederkerigheid",
      tekst: ` — zelfinvestering (${q3}/10) tegenover beleefde organisatie-investering (${q4}/10).`,
    });

  const zwakkeLijnen = [...foci, ...versnellers].filter((r) => r.net < 0).slice(-2);
  const implicaties: any[] = [
    {
      vet: "",
      tekst: `Herontwerp de rol richting ${lijstZin(
        [topVersneller, tweedeVersneller, topFocus]
          .filter((r): r is Rij => !!r)
          .map((r) => r.construct)
      )}, met minder belasting op ${
        zwakkeLijnen.length
          ? lijstZin(zwakkeLijnen.map((r) => r.construct))
          : "wat vandaag energie kost"
      }.`,
    },
    { vet: "", tekst: "Begrens beschikbaarheid en verantwoordelijkheid expliciet." },
  ];
  if (heeftModule)
    implicaties.push({
      vet: "",
      tekst: `Maak wederkerigheid expliciet — erkenning en investering in verhouding tot wat ${voornaam} geeft.`,
    });

  secties.push({
    nummer: "01",
    titel: "Profiel in één oogopslag",
    ondertitel:
      "Talent, energie, context en ontwikkelrichting — potentieel én actuele beschikbaarheid in één beeld.",
    onderdelen: [
      {
        type: "kpis",
        tegels: [
          { waarde: `${kort(beleefd)}/10`, label: "BELEEFDE STARTENERGIE" },
          { waarde: `${kort(gemeten)}/10`, label: "GEMETEN ENERGIE" },
          { waarde: kort(discrepantie, true), label: "ENERGIEDISCREPANTIE" },
          {
            waarde: `${kort(consistentie)}/100`,
            label: `INVULZORGVULDIGHEID (${consLabel.toUpperCase()})`,
          },
          { waarde: risicoLabel, label: "DRIVER-RISICO" },
          { waarde: `${kort(q3)} / ${kort(q4)}`, label: "ZELF- VS. ORG-INVESTERING" },
        ],
      },
      {
        type: "statement",
        tekst:
          `${voornaam} beschikt over een sterke motor van ${lijstZin(motorLijnen)}. ` +
          (drukpunten.length
            ? `De actuele werkbeleving staat onder druk door ${lijstZin(drukpunten)}.`
            : "De actuele werkbeleving toont geen structurele drukpunten."),
        pt: 13.5,
      },
      { type: "lijst", kop: "Drie dragende sterktes", variant: "", items: sterktes, pt: 9.4 },
      {
        type: "lijst",
        kop: "Drie actuele spanningen",
        variant: "risico",
        items: spanningen,
        pt: 9.4,
      },
      {
        type: "lijst",
        kop: "Drie ontwerpimplicaties",
        variant: "actie",
        items: implicaties,
        pt: 9.4,
      },
    ],
    compact: false,
  });

  // 02. Leeswijzer en datakwaliteit --------------------------------------------
  secties.push({
    nummer: "02",
    titel: "Leeswijzer en datakwaliteit",
    ondertitel: "De methodische basis onder deze profiellezing, transparant vooraan.",
    onderdelen: [
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["CIJFER", "BETEKENIS"],
        rijen: [
          [`${kort(schermen)} / ${kort(schermenTotaal)}`, "Voltooide schermen"],
          [kort(keuzes), "Aantal keuzes"],
          [
            `${kort(alle.filter((r) => r.shown > 0).length)} / ${kort(alle.length)}`,
            "Geduide constructen",
          ],
          [`${kort(consistentie)} / 100`, "Invulzorgvuldigheid"],
          [consLabel, "Invulzorgvuldigheid in woorden"],
          ...(tempoMelding
            ? [[`${Math.round(num(afnamekwaliteit?.aandeelOnderDrempel) * 100)} %`, "Items binnen twee seconden"]]
            : []),
        ],
        kolombreedtes: BREEDTE.datakwaliteit,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: `De invulzorgvuldigheid van deze vragenlijst is ${consLabel} (${kort(consistentie)}/100). Dat cijfer gaat over deze invulling: hoe volledig er geantwoord is en hoe goed de energieantwoorden bij elkaar aansluiten. Het zegt niets over de kwaliteit van het instrument en niets over de persoon. Ook bij een hoog cijfer blijven de scores een lezing, geen absolute uitspraak.`,
          },
          // Melding over het tempo van invullen. Gaat over de afname, niet over
          // de persoon, en verschijnt alleen als er tijdgegevens zijn.
          ...(tempoMelding
            ? [{ kop: "Tempo van invullen", variant: "", tekst: tempoMelding }]
            : []),
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst:
              "<i>Interpretatie.</i> Hoe vollediger en zorgvuldiger er is ingevuld, hoe minder " +
              "gaten er in deze lezing zitten. Dat is het enige wat het cijfer hierboven zegt. " +
              "De energiestatus per construct — " +
              "geeft (zet talent in beweging), neutraal of kost (remt vandaag de inzet) — toont of " +
              "een lijn als gaspedaal of als rem werkt op de andere lagen. Drivers, talent-foci en " +
              "versnellers vormen daarmee één samenhangend systeem, geen losse lijsten.",
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst:
              "Een hoge nettoscore betekent niet dat die lijn vandaag vrij beschikbaar is. Sterke " +
              "lijnen kunnen tegelijk energie kosten of als overbelasting of onderbenutting " +
              "verschijnen. Potentieel en belastbaarheid blijven bewust gescheiden.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Lees elk hoofdstuk op twee niveaus: de nettoscore (potentieel) én de energie- en " +
              "duidingslaag (beschikbaarheid vandaag). Zo werkt dit Business Profiel als " +
              "werkdocument voor coach, HR en management — voor professionele dialoog, rolontwerp " +
              "en inzetbeslissingen, niet alleen voor zelfinzicht.",
          },
        ],
        pt: 9.6,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Over de bronstellingen",
            variant: "",
            tekst:
              "Onder elk van de drie scoredelen — drivers, aandacht en inzet — staat telkens een " +
              "pagina met de letterlijke stellingen uit de vragenlijst. Die stellingen zijn " +
              "woordelijk en onbewerkt overgenomen; ze vormen het feitelijke bronmateriaal onder " +
              "de bijbehorende rangorde en worden daar niet opnieuw geïnterpreteerd. Wie wil " +
              "narekenen waarop een rangorde steunt, vindt daar de oorspronkelijke uitspraken terug.",
          },
        ],
        pt: 9.6,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Over de energiebatterij",
            variant: "",
            tekst:
              "Bovenaan elk scoredeel toont een batterij-icoon het totale energiesaldo van dat " +
              "construct in één oogopslag: groen wanneer het geheel per saldo energie geeft, oker " +
              "bij een neutraal saldo, rood wanneer het geheel vandaag energie kost. Dit is een " +
              "energie-aflezing van het construct als geheel — nooit een rangorde of " +
              "belangrijkheidsmaat.",
          },
        ],
        pt: 9.6,
      },
      { type: "batterijlegende" },
    ],
    compact: false,
  });

  // 03 — Professionele energiestaat ------------------------------------------
  const gemTien = Math.round(((gemEnergie + 2) / 4) * 10 * 100) / 100;
  const balk = (label: string, waarde: number, tekst: string) => ({
    label,
    gevuld: Math.round(waarde),
    totaal: 10,
    waarde: tekst,
    kleur: Math.round(waarde) >= 5 ? "geeft" : "kost",
  });
  const discrepantieLezing =
    discrepantie < 0
      ? "(potentieel > beleving)"
      : discrepantie > 0
      ? "(beleving > potentieel)"
      : "(in evenwicht)";

  secties.push({
    nummer: "03",
    titel: "Professionele energiestaat",
    ondertitel: "De spanning tussen beleefde werkenergie en gemeten potentieel.",
    onderdelen: [
      { type: "subkop", tekst: "Energiestaat in beeld" },
      {
        type: "staafmeters",
        rijen: [
          balk("Beleefde startenergie", beleefd, `${kort(beleefd)} / 10`),
          balk("Gemeten vragenlijstenergie", gemeten, `${kort(gemeten)} / 10`),
          balk("Gem. vragenlijstenergie", gemTien, getal(gemEnergie, 1)),
        ],
      },
      {
        type: "metingtabel",
        kolommen: ["METING", "WAARDE"],
        rijen: [
          ["Beleefde startenergie", `${kort(beleefd)} / 10`],
          ["Gemeten vragenlijstenergie", `${kort(gemeten)} / 10`],
          ["Energiediscrepantie", `${kort(discrepantie, true)} ${discrepantieLezing}`],
          [
            "Gemiddelde vragenlijstenergie",
            `${getal(gemEnergie, 1)} (${energieKwalificatie(gemEnergie)})`,
          ],
        ],
        kolombreedtes: BREEDTE.meting,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst:
              discrepantie < 0
                ? `${voornaam}s meetbare potentieel ligt duidelijk hoger dan wat vandaag in het werk beleefd wordt. Dat verschil is geen talenttekort, maar een context- en fitsignaal.`
                : `${voornaam}s beleefde werkenergie sluit aan bij of ligt boven het gemeten potentieel. Er is vandaag geen negatief energieverschil dat de inzet remt.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: `<i>Interpretatie.</i> ${
              discrepantie < 0
                ? "De energiediscrepantie wijst op een context waarin talent niet vrij genoeg tot ontplooiing komt."
                : "Het ontbreken van een negatieve energiediscrepantie wijst op een context die het talent vandaag ruimte geeft."
            } De ${energieKwalificatie(
              gemEnergie
            )} gemiddelde energie (${getal(gemEnergie, 1)}) toont ${
              gemEnergie > 0
                ? "dat er vitaliteitsbronnen aanwezig zijn"
                : "dat de vitaliteitsbronnen vandaag beperkt zijn"
            } — te lezen samen met de energiestatus per construct in de volgende hoofdstukken.`,
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst:
              discrepantie < 0
                ? "<i>Hypothese.</i> Houdt de discrepantie aan, dan dreigt structureel energieverlies en op termijn uitputting — juist omdat er niet snel uit zichzelf wordt teruggeschakeld."
                : "<i>Hypothese.</i> Een gunstig energiebeeld vandaag zegt niets over de belastbaarheid morgen; blijf de energiekostende lijnen per construct volgen.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst: `Een scherpere analyse van rolinzet, contextdruk en relationele wederkerigheid is de eerste stap. Wat helpt: contexten waarin ${lijstZin(
              [topVersneller, tweedeVersneller, topFocus]
                .filter((r): r is Rij => !!r)
                .map(kern)
            )} ruimte krijgen zonder structurele overbelasting.`,
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // 04 — TaPas-Beeld ---------------------------------------------------------
  const tbStatus = statusVanEnergie(tapasBeeld ? tapasBeeld.avgEnergy : 0);
  const tweedeDriver = drivers[1];

  secties.push({
    nummer: "04",
    titel: "TaPas-Beeld — identiteit, waarden en congruentie",
    ondertitel: `De laag onder het talent: waaruit ${voornaam} werkt, hoe hij zijn talent ziet, en of dat vandaag samenvalt.`,
    onderdelen: [
      {
        type: "saldobalk",
        label: "ENERGIESALDO IDENTITEIT & ZELFBEELD",
        waarde: getal(tapasBeeld ? tapasBeeld.avgEnergy : 0),
        toelichting:
          tbStatus === "geeft"
            ? "dit identiteitsbewuste zelfbeeld geeft vandaag energie"
            : tbStatus === "kost"
            ? "dit identiteitsbewuste zelfbeeld kost vandaag energie"
            : "dit identiteitsbewuste zelfbeeld is vandaag energetisch neutraal",
      },
      {
        type: "statement",
        tekst:
          "T4P leest talent nooit los van identiteit, waarden en betekenis. Deze laag maakt " +
          "zichtbaar of het werk niet alleen góéd kan worden gedaan, maar ook past bij wie iemand " +
          "ten diepste is en wil zijn. Die congruentie bepaalt mee of talent duurzaam energie " +
          "geeft of stilaan leegloopt.",
        pt: 11.2,
      },
      {
        type: "paar",
        kaarten: [
          {
            kop: "Inner Why — waaruit ik werk",
            tekst:
              `Het identiteitsbewuste zelfbeeld staat in dit profiel op net ${netTekst(
                tapasBeeld ? tapasBeeld.net : 0
              )} met een energiewaarde van ${getal(
                tapasBeeld ? tapasBeeld.avgEnergy : 0
              )} — ${saldoZin(tbStatus)}. ` +
              `Onderhuids sturen vooral ${kern(topDriver)}${
                tweedeDriver ? ` en ${kern(tweedeDriver)}` : ""
              } de inzet: daar ligt de stille bron onder wat ${voornaam} doet. ` +
              "De letterlijke stellingen die deze laag dragen, staan onderaan dit hoofdstuk.",
          },
          {
            kop: "InnerView — hoe ik mijn talent zie",
            tekst:
              `De natuurlijke aandacht gaat naar ${kern(
                topFocus
              )}; de snelste route naar resultaat loopt via ${kern(topVersneller)}. ` +
              `Samen tekenen ze het beeld dat ${voornaam} van het eigen talent heeft. ` +
              (tbStatus === "geeft"
                ? "Dat zelfinzicht werkt vandaag als krachtbron."
                : tbStatus === "kost"
                ? "Dat zelfinzicht is vandaag krachtbron én drukpunt tegelijk."
                : "Dat zelfinzicht is vandaag aanwezig zonder duidelijke energiewinst of -kost."),
          },
        ],
        pt: 9.1,
        kop_pt: 10.0,
      },
      {
        type: "congruentie",
        cellen: [
          {
            kop: "Wat vandaag al klopt",
            tekst: `De inhoudelijke kern — ${lijstZin(
              [topVersneller, tweedeVersneller, topFocus]
                .filter((r): r is Rij => !!r)
                .map(kern)
            )} — sluit aan bij wat in dit profiel het sterkst en meest energiegevend meet.`,
          },
          {
            kop: "Wat aandacht vraagt",
            tekst: `${
              topFocus ? hoofdletter(kern(topFocus)) : "De aandachtslijn"
            } vraagt ruimte om zichtbaar te renderen; onder druk raakt die lijn als eerste op de achtergrond.`,
          },
          {
            kop: "Waar de spanning zit",
            tekst: kostDrivers[0]
              ? `De energiekost van ${kostDrivers[0].construct} (${getal(
                  kostDrivers[0].avgEnergy
                )})${
                  heeftModule && q3 - q4 >= 4
                    ? " en de scheef ervaren wederkerigheid met de organisatie"
                    : ""
                } zetten de congruentie vandaag onder druk.`
              : "Geen van de drivers kost vandaag structureel energie; de spanning is beperkt.",
          },
          {
            kop: "Startpunt voor de talentmotor",
            tekst: `Een context die ${lijstZin(
              [topVersneller, topFocus].filter((r): r is Rij => !!r).map(kern)
            )} waardeert${
              heeftModule ? " en wederkerigheid expliciet maakt" : ""
            }, ontgrendelt de talentmotor het snelst.`,
          },
        ],
        pt: 8.3,
        kop: "Congruentie",
        intro:
          "Hypothese. Deze inschatting leest of professionele inzet vandaag samenvalt met " +
          "identiteit, waarden en betekenis.",
      },
      {
        type: "citatenkaarten",
        kop_meest: `In de vragenlijst herkende ${voornaam} zich het meest in`,
        kop_minst: `In de vragenlijst herkende ${voornaam} zich het minst in`,
        meest: tapasBeeld ? tapasBeeld.mostItems : [],
        minst: tapasBeeld ? tapasBeeld.leastItems : [],
        noot: null,
        pt: 9.0,
        variant: "compact",
        intro:
          "De identiteitslaag hierboven steunt op deze letterlijke stellingen uit de " +
          "vragenlijst, onbewerkt overgenomen zonder duiding.",
      },
    ],
    compact: true,
    titelregels: 2,
  });

  // 05 / 07 / 09 — constructtabellen ----------------------------------------
  const constructtabel = (
    kolomkop: string,
    saldoLabel: string,
    saldoWaarde: number,
    rijen: Rij[],
    breedtes: number[]
  ) => ({
    type: "constructtabel",
    kolomkop,
    saldo: {
      label: saldoLabel,
      waarde: getal(saldoWaarde),
      toelichting: saldoZin(statusVanEnergie(saldoWaarde)),
    },
    rijen: rijen.map((r, i) => ({
      naam: r.construct,
      icoon: icoonNaam(r.construct),
      net: netTekst(r.net),
      energiewaarde: getal(r.avgEnergy),
      energie: statusVanEnergie(r.avgEnergy),
      lezing: tabelLezing(r, i),
    })),
    kolombreedtes: breedtes,
  });

  const orientatiestrip = (rijen: Rij[]) => ({
    type: "orientatiestrip",
    rijen: rijen
      .filter((r) => EH[r.construct])
      .map((r) => [r.construct, EH[r.construct].code, EH[r.construct].duiding]),
  });

  secties.push({
    nummer: "05",
    titel: "Drivers",
    ondertitel: "Wat onbewust mee stuurt — rangorde, energiekost en kantelpunten.",
    onderdelen: [
      constructtabel("DRIVER", "ENERGIESALDO DRIVERS", saldoDrivers, drivers, BREEDTE.drivers),
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst:
              `${voornaam}s onbewuste stuurkracht draait om ${kern(topDriver)}. ` +
              `${topDriver ? topDriver.construct : "De sterkste driver"} domineert (net ${netTekst(
                topDriver ? topDriver.net : 0
              )}) en ${
                topDriver && statusVanEnergie(topDriver.avgEnergy) === "kost"
                  ? "levert inhoudelijke sterkte maar kost vandaag energie"
                  : topDriver && statusVanEnergie(topDriver.avgEnergy) === "geeft"
                  ? "geeft vandaag energie"
                  : "is vandaag energetisch neutraal"
              }${
                tweedeDriver
                  ? `; ${tweedeDriver.construct} volgt (net ${netTekst(
                      tweedeDriver.net
                    )}, energie ${getal(tweedeDriver.avgEnergy)})`
                  : ""
              }.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst:
              `<i>Interpretatie.</i> Deze drivers komen het sterkst tot hun recht waar ${kern(
                topDriver
              )} gewaardeerd wordt. <b>Interactie:</b> ` +
              (kostDrivers[0]
                ? `als energiekostende driver werkt ${kostDrivers[0].construct} vandaag als rem op de talent-foci en versnellers — het talent (volgende hoofdstukken) komt pas vrij wanneer deze driver context-matig ontgrendeld wordt.`
                : "geen van de drivers werkt vandaag als rem; de talent-foci en versnellers kunnen relatief vrij renderen."),
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst: `Onbegrensd kan de combinatie ${lijstZin(
              drivers.slice(0, 2).map((r) => r.construct)
            )} leiden tot overbelasting: ${kern(topDriver)} zonder afrondingsrust, moeizame delegatie en het gevoel dat het nooit goed genoeg is.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Stem normen, verantwoordelijkheidsgrenzen en verwachtingen bewust beter af. Maak " +
              "afspraken over wanneer iets ‘goed genoeg’ is, organiseer expliciete " +
              "afrondingsmomenten en bewaak de verleiding werk van anderen over te nemen.",
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // 06 / 08 / 10 — bronstellingen -------------------------------------------
  // De `minst`-kolom vraagt de letterlijk als "minst" gekozen stellingen. Die
  // komen uit `leastItems`; oudere contracten zonder die sleutel leveren een
  // lege kolom (zie de normalisatie hierboven).
  const bronstellingen = (rijen: Rij[]) => {
    const meest: string[] = [];
    rijen.forEach((r) => r.mostItems.forEach((t) => meest.push(t)));
    const minst: string[] = [];
    rijen.forEach((r) => r.leastItems.forEach((t) => minst.push(t)));
    return {
      type: "citatenkaarten",
      kop_meest: `Hierin herkende ${voornaam} zich het meest`,
      kop_minst: `Hierin herkende ${voornaam} zich het minst`,
      meest,
      minst,
      noot: null,
      pt: Math.max(meest.length, minst.length) <= 10 ? 11.0 : 9.2,
    };
  };

  secties.push({
    nummer: "06",
    titel: "Bronstellingen — drivers",
    ondertitel: "De woordelijke stellingen onder de drivers, onbewerkt en zonder duiding.",
    onderdelen: [bronstellingen(drivers)],
    compact: false,
  });

  // 07 — Talent-foci ---------------------------------------------------------
  secties.push({
    nummer: "07",
    titel: "Talent-foci",
    ondertitel: "Waar de natuurlijke aandacht naartoe gaat — een aandachtstopografie.",
    onderdelen: [
      constructtabel("FOCUS", "ENERGIESALDO TALENT-FOCI", saldoFoci, foci, BREEDTE.foci),
      orientatiestrip(foci),
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst:
              `${voornaam}s natuurlijke aandacht gaat naar ${lijstZin(
                foci.filter((r) => r.net > 0).map(kern) || []
              ) || kern(topFocus)} — niet naar ${
                lijstZin(
                  foci
                    .filter((r) => r.net < 0)
                    .map((r) => kern(r))
                ) || "de overige lijnen"
              }. De identiteits- en waardenlaag (TaPas-Beeld) leest u apart in hoofdstuk 4 (Inner Why); ze is geen aandachtsgebied en telt hier niet mee.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst:
              `<i>Interpretatie.</i> ${
                topFocus ? topFocus.construct : "De sterkste focus"
              } is de duidelijkste aandachtslijn (net ${netTekst(
                topFocus ? topFocus.net : 0
              )}, energie ${getal(topFocus ? topFocus.avgEnergy : 0)}). <b>Interactie:</b> ` +
              (kostDrivers[0]
                ? `deze aandacht komt pas vrij wanneer ${kostDrivers[0].construct} ontgrendeld wordt en de versnellers (volgend hoofdstuk) haar weer in beweging zetten.`
                : "geen driver remt deze aandacht vandaag; de versnellers (volgend hoofdstuk) kunnen haar direct in beweging zetten."),
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst: `<i>Hypothese.</i> Onderbenutting van ${kern(
              topFocus
            )} kan samen met de dominante driver leiden tot frustratie en energieverlies. De laagst geplaatste lijnen (${
              lijstZin(foci.slice(-2).map((r) => r.construct)) || "—"
            }) blijven onderbenut zonder bewuste ruimte.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst: `Herontwerp de rol richting ${kern(
              topFocus
            )}, met minder belasting op wat vandaag geen voorkeursroute is. Maak ruimte waarin die aandachtslijn zichtbaar mag renderen.`,
          },
        ],
        pt: 9.0,
      },
    ],
    compact: true,
  });

  secties.push({
    nummer: "08",
    titel: "Bronstellingen — aandacht",
    ondertitel: "De woordelijke stellingen onder de talent-foci, onbewerkt en zonder duiding.",
    onderdelen: [bronstellingen(alleFoci)],
    compact: false,
  });

  // 09 — Talent-versnellers --------------------------------------------------
  const versnellerFamilie = familieRijen.find((f) => f.family === "Talent-versnellers");
  secties.push({
    nummer: "09",
    titel: "Talent-versnellers",
    ondertitel: "Hoe talent het snelst tot resultaat komt — de actieve inzetlaag.",
    onderdelen: [
      constructtabel(
        "VERSNELLER",
        "ENERGIESALDO TALENT-VERSNELLERS",
        saldoVersnellers,
        versnellers,
        BREEDTE.versnellers
      ),
      orientatiestrip(versnellers),
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: `De talent-versnellers vormen ${
              versnellerFamilie && versnellerFamilie.avgEnergy > 0
                ? "de meest energiserende familie"
                : "de actieve inzetlaag"
            } van dit profiel${
              versnellerFamilie ? ` (gem. ${getal(versnellerFamilie.avgEnergy)})` : ""
            }. ${lijstZin(
              versnellers.slice(0, 2).map((r) => r.construct)
            )} zijn de dragende toegangspoorten.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst:
              `<i>Interpretatie.</i> Het profiel komt het snelst tot zijn recht wanneer ${lijstZin(
                versnellers.slice(0, 2).map(kern)
              )} samengaan met betekenis en gerichte invloed. <b>Interactie:</b> ` +
              (kostDrivers[0]
                ? `deze versnellers zijn de route om de door ${kostDrivers[0].construct} geremde talent-foci weer aan te zetten — mits die driver niet op slot blijft.`
                : "deze versnellers kunnen de talent-foci direct aanzetten; geen driver houdt ze vandaag op slot."),
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst: `<i>Hypothese.</i> Worden ${lijstZin(
              versnellers.slice(0, 3).map((r) => r.construct.toLowerCase())
            )} structureel als vanzelfsprekende dienst opgeëist, dan ontstaat overbelasting en kantelt de dragende lijn zodra er te weinig ruimte is om zelf te creëren.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst: `Ontwerp rollen zo dat ${lijstZin(
              versnellers.slice(0, 2).map(kern)
            )} centraal staan, binnen duidelijke grenzen van beschikbaarheid.`,
          },
        ],
        pt: 9.0,
      },
    ],
    compact: true,
  });

  secties.push({
    nummer: "10",
    titel: "Bronstellingen — inzet",
    ondertitel:
      "De woordelijke stellingen onder de talent-versnellers, onbewerkt en zonder duiding.",
    onderdelen: [bronstellingen(versnellers)],
    compact: false,
  });

  // 11 — Bronlezing ----------------------------------------------------------
  const volgordeTekst = (rijen: Rij[]) =>
    rijen.map((r) => r.construct.toUpperCase()).join(" – ");
  const vetteVolgorde = (rijen: Rij[]) =>
    `<b>${rijen.map((r) => r.construct).join(" – ")}</b>`;

  /** Constructen met een gelijke netscode binnen één familie. */
  const knopen = (rijen: Rij[]): string[] => {
    const uit: string[] = [];
    for (let i = 1; i < rijen.length; i++) {
      if (rijen[i].net === rijen[i - 1].net) {
        if (!uit.includes(rijen[i - 1].construct)) uit.push(rijen[i - 1].construct);
        uit.push(rijen[i].construct);
      }
    }
    return uit;
  };
  const gelijkeVersnellers = knopen(versnellers);

  secties.push({
    nummer: "11",
    titel: "Bronlezing — herkenbare talentcombinaties",
    ondertitel: "De drie volgordes woordelijk uit de bron, samengebracht zonder eigen duiding.",
    onderdelen: [
      {
        type: "statement",
        tekst:
          "Hieronder staan de drie volgordes — drivers, aandacht en inzet — zoals ze " +
          "rechtstreeks uit de meting komen. Dit hoofdstuk brengt ze samen in taal zonder de " +
          "inhoud zelf opnieuw te duiden.",
        pt: 12.0,
      },
      {
        type: "paragraaf",
        tekst:
          `In de bronlezing leest ${voornaam}s profiel zich als drie aansluitende volgordes. ` +
          `De drivers volgen de lijn ${vetteVolgorde(drivers)}. ` +
          `De aandacht volgt de lijn ${vetteVolgorde(foci)}. ` +
          `En de inzet volgt de lijn ${vetteVolgorde(versnellers)}. ` +
          "De onderstaande kaarten geven per volgorde de lezing weer.",
        pt: 10.0,
      },
      {
        type: "bronkaarten",
        kaarten: [
          {
            titel: "Drivers",
            volgorde: volgordeTekst(drivers),
            variant: "",
            rubrieken: [
              [
                "Kerninterpretatie",
                `Deze volgorde wijst op een context waarin ${kern(topDriver)}${
                  tweedeDriver ? ` en ${kern(tweedeDriver)}` : ""
                } het eerst gehoord moeten worden; ${kern(
                  drivers[drivers.length - 1]
                )} weegt het minst mee.`,
              ],
              [
                "Dieptebeschrijving",
                `${topDriver ? topDriver.construct : "De eerste driver"} vormt het fundament (net ${netTekst(
                  topDriver ? topDriver.net : 0
                )})${
                  tweedeDriver
                    ? `, ${tweedeDriver.construct} voegt ${kern(tweedeDriver)} toe`
                    : ""
                }. De onderste lijnen (${lijstZin(
                  drivers.slice(-2).map((r) => r.construct)
                )}) worden bewust minder gekozen en zeggen evenveel over de werkstijl als de bovenste.`,
              ],
              [
                "Ideale omgeving",
                `Een omgeving die ${kern(topDriver)} waardeert${
                  tweedeDriver ? ` en ruimte laat voor ${kern(tweedeDriver)}` : ""
                }, zonder ${kern(drivers[drivers.length - 1])} te eisen.`,
              ],
            ],
          },
          {
            titel: "Aandacht",
            volgorde: volgordeTekst(foci),
            variant: "",
            rubrieken: [
              [
                "Interpretatie",
                `De aandacht start bij ${kern(topFocus)} (net ${netTekst(
                  topFocus ? topFocus.net : 0
                )})${
                  foci[1] ? ` en loopt via ${kern(foci[1])}` : ""
                } naar ${kern(
                  foci[foci.length - 1]
                )}. Die volgorde bepaalt waar de aandacht spontaan naartoe gaat, niet wat mogelijk is.`,
              ],
            ],
          },
          {
            titel: "Inzet",
            volgorde: volgordeTekst(versnellers),
            variant: "",
            rubrieken: [
              [
                "Kernzin",
                `Vanuit ${kern(topVersneller)}${
                  tweedeVersneller ? ` en ${kern(tweedeVersneller)}` : ""
                } groeit de snelste route naar resultaat${
                  versnellers[2] ? `, met ${kern(versnellers[2])} als versterking` : ""
                } — naar een helder resultaatbeeld.`,
              ],
            ],
          },
        ],
        pt: 10.4,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Zo kom jij snelst tot resultaat",
            variant: "",
            tekst:
              `${hoofdletter(
                kern(topVersneller)
              )} is eerst zelfstandig beschikbaar en kan daarna getoetst of verdiept worden. ` +
              (tweedeVersneller
                ? `${hoofdletter(
                    kern(tweedeVersneller)
                  )} helpt beweging en realisatiekracht vrijmaken. `
                : "") +
              (versnellers[2]
                ? `${hoofdletter(kern(versnellers[2]))} geeft daar richting aan. `
                : "") +
              `De lijnen onderaan de volgorde blijven inzetbaar, maar vormen geen spontane start.`,
          },
        ],
        pt: 10.4,
      },
      {
        type: "paragraaf",
        tekst:
          "Twee transparantienoten bij de bronlezing: in de bronvolgorde van de aandacht wordt " +
          "het identiteitsbewuste zelfbeeld (TaPas-Beeld) niet meegeteld, omdat het de " +
          "identiteitslaag van hoofdstuk 4 is en geen aandachtsgebied. " +
          (gelijkeVersnellers.length
            ? `Bij de inzet staan ${lijstZin(
                gelijkeVersnellers
              )} in de meting even sterk; de getoonde volgorde volgt dan een alfabetische ordening, niet een onderscheidende voorkeur.`
            : "Bij de inzet zijn er geen gelijke metingen; de volgorde volgt volledig de nettoscore."),
      },
    ],
    compact: false,
    titelregels: 2,
  });

  // 12 — Drieledige talentdynamiek -------------------------------------------
  secties.push({
    nummer: "12",
    titel: "Drieledige talentdynamiek",
    ondertitel:
      "De drie lagen in één verhalende beweging — drivers, foci en versnellers als één talentmotor.",
    onderdelen: [
      {
        type: "statement",
        tekst:
          "Drivers, talent-foci en talent-versnellers staan niet los van elkaar: samen vormen ze " +
          `${voornaam}s persoonlijke talentmotor. Dit hoofdstuk leest de drie lagen één keer in ` +
          "één verhalende beweging — van onbewuste driver, via natuurlijke aandacht, naar de " +
          "route waarlangs talent het snelst tot resultaat komt.",
        pt: 11.2,
      },
      {
        type: "lagen",
        pt: 9.0,
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst:
              `${voornaam}s talentmotor draait om ${kern(topDriver)}, ${kern(
                topFocus
              )} en ${kern(topVersneller)}. Onderhuids sturen ` +
              `${drivers
                .slice(0, 2)
                .map((r) => `<b>${r.construct}</b>`)
                .join(" en ")} de inzet. De natuurlijke aandacht ligt bij ` +
              `${foci
                .slice(0, 2)
                .map((r) => `<b>${r.construct}</b>`)
                .join(" en ")}, gedragen door een zelfbeeld dat apart als Inner Why wordt ` +
              `gelezen (hoofdstuk 4). En de snelste route naar resultaat loopt via ` +
              `${versnellers
                .slice(0, 2)
                .map((r) => `<b>${r.construct}</b>`)
                .join(" en ")}${
                versnellers[2] ? `, met <b>${versnellers[2].construct}</b> als versterking` : ""
              }.`,
          },
        ],
      },
      {
        type: "tekstblok",
        kop: "Laag 1 — Drivers (onbewuste stuurkracht)",
        tekst: `${
          topDriver ? topDriver.construct : "De eerste driver"
        } zet de norm${
          tweedeDriver ? `, ${tweedeDriver.construct} levert ${kern(tweedeDriver)}` : ""
        }. Samen maken ze het profiel inhoudelijk sterk en doelgericht, maar ze bepalen ook of de bovenliggende lagen ruimte krijgen.`,
        pt: 9.1,
        kop_pt: 10.0,
      },
      {
        type: "tekstblok",
        kop: "Laag 2 — Talent-foci (natuurlijke aandacht)",
        tekst: `${lijstZin(
          foci.slice(0, 2).map((r) => r.construct)
        )} richten de aandacht op ${lijstZin(
          foci.slice(0, 2).map(kern)
        )} — het zwaartepunt van het profiel. Het zelfbeeld dat hieronder ligt, leest u apart als Inner Why (hoofdstuk 4).`,
        pt: 9.1,
        kop_pt: 10.0,
      },
      {
        type: "tekstblok",
        kop: "Laag 3 — Versnellers (route naar resultaat)",
        tekst: `${lijstZin(
          versnellers.slice(0, 2).map((r) => r.construct)
        )} vormen de dragende activeringsroute${
          versnellers[2] ? `, met ${versnellers[2].construct} als gerichte versterking` : ""
        }: hier komt het talent het snelst tot zichtbaar resultaat.`,
        pt: 9.1,
        kop_pt: 10.0,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: `<i>Interpretatie.</i> Deze configuratie rendeert het sterkst in rollen waar ${lijstZin(
              [topVersneller, tweedeVersneller, topFocus]
                .filter((r): r is Rij => !!r)
                .map(kern)
            )} samenkomen rond een waardengedreven kern. De eerste versneller geeft richting; de tweede voedt groei en verbinding; de sterkste aandachtslijn verrijkt.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: kostDrivers[0]
              ? `Interactie onder druk. Onder druk vernauwt de talentmotor: ${kostDrivers[0].construct} duwt naar ${kern(
                  kostDrivers[0]
                )} en moeizame afronding, terwijl de aandachtslijnen op slot raken. Er blijft dan minder ruimte voor creëren en loslaten — precies de lijnen die het profiel verrijken.`
              : "Interactie onder druk. Geen driver kost vandaag structureel energie; onder druk blijft de talentmotor relatief open, maar de aandachtslijnen vragen dan wel bewuste ruimte.",
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst: `<i>Hypothese.</i> Houdt de combinatie van ${lijstZin(
              drivers.slice(0, 2).map((r) => r.construct)
            )} aan zonder begrenzing, dan kantelt gedrevenheid in uitputting en oververantwoordelijkheid, en blijft de aandachtslaag structureel onderbenut.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              `• Ontwerp de rol rond de as <b>${versnellers
                .slice(0, 3)
                .map((r) => r.construct.toLowerCase())
                .join(" – ")}</b>, met ruimte voor ${kern(topFocus)}.\n` +
              "• Maak expliciete ‘goed genoeg’-, afrondings- en verantwoordelijkheidsafspraken.\n" +
              "• Bouw ruimte voor creëren in, niet louter voor verfijnen.",
          },
        ],
        pt: 9.0,
      },
    ],
    compact: true,
  });

  // 13 — De talentmotor in één oogopslag -------------------------------------
  const paneelItems = (rijen: Rij[]) =>
    rijen.map((r) => ({
      naam: r.construct,
      icoon: icoonNaam(r.construct),
      status: statusVanEnergie(r.avgEnergy),
      net: netTekst(r.net),
    }));

  secties.push({
    nummer: "13",
    titel: "De talentmotor in één oogopslag",
    ondertitel: "Drie dimensies samen gelezen — toegang, versnelling en bewaking in één beeld.",
    onderdelen: [
      {
        type: "paragraaf",
        tekst:
          "De kern van het profiel wordt zichtbaar wanneer talentfoci, talentversnellers en " +
          "drivers samen worden gelezen. Dit is geen rangorde en geen stappenplan, maar een kaart " +
          "van toegang, versnelling en bewaking.",
        pt: 9.4,
      },
      {
        type: "motorpanelen",
        panelen: [
          {
            nummer: "1",
            titel: "Talentfoci",
            vraag: "wat opent energie?",
            noot: "TaPas-Beeld hoort niet in deze flow; apart gelezen als Inner Why.",
            items: paneelItems(foci),
          },
          {
            nummer: "2",
            titel: "Talentversnellers",
            vraag: "hoe ontstaat resultaat?",
            noot: null,
            items: paneelItems(versnellers),
          },
          {
            nummer: "3",
            titel: "Drivers",
            vraag: "wat geeft gas of vernauwt?",
            noot: kostDrivers[0]
              ? `${kostDrivers[0].construct} draagt inhoudelijke kwaliteit maar kost vandaag energie en werkt als rem${
                  drivers.find((r) => statusVanEnergie(r.avgEnergy) === "geeft")
                    ? `; ${
                        drivers.find((r) => statusVanEnergie(r.avgEnergy) === "geeft")!.construct
                      } ligt energetisch gunstiger en kan als gaspedaal werken`
                    : ""
                }.`
              : null,
            items: paneelItems(drivers),
          },
        ],
      },
      {
        type: "routekaarten",
        kop: "Route naar zichtbaar resultaat",
        kaarten: [
          {
            kop: "Zo komt dit profiel het snelst tot resultaat",
            variant: "teal",
            tekst: `Via ${lijstZin(
              versnellers.slice(0, 2).map((r) => r.construct.toLowerCase())
            )}: een complexe situatie eerst doorgronden en daarna in afstemming tot een betekenisvol resultaat brengen.`,
          },
          {
            kop: "Wat ontgrendelt de motor",
            variant: "blauw",
            tekst: `Een context die ${lijstZin(
              [topDriver, topFocus].filter((r): r is Rij => !!r).map(kern)
            )} waardeert, met ruimte om af te ronden zonder gejaagdheid.`,
          },
          {
            kop: "Wat zet de motor vast",
            variant: "rust",
            tekst: kostDrivers[0]
              ? `Een te hoge lat rond ${kern(
                  kostDrivers[0]
                )} zonder afrondingsrust, of belasting zonder betekenis — dan blijft het talent geremd.`
              : "Belasting zonder betekenis of ruimte om af te ronden — dan blijft het talent geremd.",
          },
        ],
      },
    ],
    compact: false,
  });

  // 14 — Verbondenheid met de organisatie ------------------------------------
  const band = (score: number, zinnen: [string, string, string, string]): string =>
    score >= 8 ? zinnen[0] : score >= 5 ? zinnen[1] : score >= 2 ? zinnen[2] : zinnen[3];

  const modules = [
    {
      kortLabel: "Zelfinvestering",
      langLabel: "Zelfinvestering",
      score: q3,
      lezing: band(q3, [
        "Maximale persoonlijke inzet.",
        "Ruime persoonlijke inzet.",
        "Gemiddelde persoonlijke inzet.",
        "Beperkte persoonlijke inzet.",
      ]),
    },
    {
      kortLabel: "Psych. verbondenheid",
      langLabel: "Psychologische verbondenheid",
      score: q1,
      lezing: band(q1, [
        "Sterke betrokkenheid en loyaliteit.",
        "Redelijke betrokkenheid.",
        "Beperkte betrokkenheid.",
        "Nauwelijks betrokkenheid.",
      ]),
    },
    {
      kortLabel: "Ervaren billijkheid",
      langLabel: "Ervaren billijkheid beloning",
      score: q2,
      lezing: band(q2, [
        "Beloning wordt als billijk ervaren.",
        "Beloning wordt als redelijk billijk ervaren.",
        "Beloning wordt als eerder onbillijk ervaren.",
        "Beloning wordt als sterk onbillijk ervaren.",
      ]),
    },
    {
      kortLabel: "Organisatie-investering",
      langLabel: "Organisatie-investering",
      score: q4,
      lezing: band(q4, [
        `De organisatie investeert in ${voornaam}s beleving zichtbaar terug.`,
        `De organisatie investeert in ${voornaam}s beleving beperkt terug.`,
        `De organisatie investeert in ${voornaam}s beleving nauwelijks terug.`,
        `De organisatie investeert in ${voornaam}s beleving niet terug.`,
      ]),
    },
  ].sort((a, b) => b.score - a.score);

  if (heeftModule) {
    secties.push({
      nummer: "14",
      titel: "Verbondenheid met de organisatie",
      ondertitel: `Hoe ${voornaam} zich verbindt — en waar de wederkerigheid scheef loopt.`,
      onderdelen: [
        { type: "subkop", tekst: "Verbondenheid in beeld" },
        {
          type: "staafmeters",
          rijen: modules.map((m) => ({
            label: m.kortLabel,
            gevuld: Math.round(m.score),
            totaal: 10,
            waarde: `${kort(m.score)} / 10`,
            kleur: m.score >= 5 ? "geeft" : "kost",
          })),
        },
        {
          type: "vrijetabel",
          kop: null,
          kolommen: ["MODULE", "SCORE", "LEZING"],
          rijen: modules.map((m) => [m.langLabel, `${kort(m.score)} / 10`, m.lezing]),
          kolombreedtes: BREEDTE.verbondenheid,
        },
        {
          type: "lagen",
          blokken: [
            {
              kop: "Kernboodschap",
              variant: "",
              tekst:
                q3 - q4 >= 4
                  ? `${voornaam} investeert sterk en is verbonden, maar ervaart de wederkerigheid van de organisatie als beduidend zwakker.`
                  : `${voornaam}s inzet en de ervaren investering van de organisatie liggen redelijk in verhouding.`,
            },
            {
              kop: "Professionele betekenis",
              variant: "",
              tekst: `<i>Interpretatie.</i> Zelfinvestering (${kort(
                q3
              )}) en psychologische verbondenheid (${kort(
                q1
              )}) tegenover ervaren billijkheid (${kort(q2)}) en organisatie-investering (${kort(
                q4
              )}) ${
                q3 - q4 >= 4
                  ? "vormen een klassiek wederkerigheidstekort: het risico ligt niet bij betrokkenheid, maar bij uitputting van een eenzijdig gedragen relatie."
                  : "vormen samen een werkbaar wederkerigheidsbeeld; betrokkenheid en investering houden elkaar in evenwicht."
              }`,
            },
            {
              kop: "Bewaking of risico",
              variant: "risico",
              tekst:
                q3 - q4 >= 4
                  ? "<i>Hypothese.</i> Blijft de wederkerigheid scheef, dan dreigt op termijn demotivatie, cynisme of terugtrekking — ondanks de huidige loyaliteit."
                  : "<i>Hypothese.</i> Het evenwicht is geen vaste toestand; verschuivingen in erkenning of beloning kunnen het beeld snel kantelen.",
            },
            {
              kop: "Actie of ontwerpimplicatie",
              variant: "actie",
              tekst: `Maak wederkerigheid expliciet bespreekbaar: erkenning, beloning en investering moeten zichtbaar in verhouding komen tot wat ${voornaam} geeft.`,
            },
          ],
          pt: 9.6,
        },
      ],
      compact: false,
      titelregels: 2,
    });
  }

  // 15 — Werkcontext en rolfit -----------------------------------------------
  const laagsteFoci = foci.filter((r) => r.net < 0);
  secties.push({
    nummer: "15",
    titel: "Werkcontext en rolfit",
    ondertitel: "Predictieve vertaling naar rollen — voorspellend en coachbaar, nooit absoluut.",
    onderdelen: [
      {
        type: "rasterkaarten",
        kaarten: [
          {
            titel: "Duidelijk passend",
            variant: "groen",
            tekst: `Rollen waarin ${lijstZin(
              [topVersneller, tweedeVersneller, topFocus]
                .filter((r): r is Rij => !!r)
                .map(kern)
            )} centraal staan, met conceptuele ruimte en tijd om te doorgronden vóór te beslissen.`,
          },
          {
            titel: "Passend onder voorwaarden",
            variant: "oker",
            tekst:
              "Leidende of coördinerende rollen, mits voldoende autonomie, denkkader en duidelijke " +
              "verantwoordelijkheidsgrenzen. Begrenzing van beschikbaarheid is de voorwaarde.",
          },
          {
            titel: "Risicovol bij aanhoudende mismatch",
            variant: "rust",
            tekst: `Rollen die vooral leunen op ${
              lijstZin(laagsteFoci.map(kern)) || "wat geen voorkeursroute is"
            }, waarin ${kern(topFocus)} onderbenut blijft${
              kostDrivers[0] ? ` en ${kern(kostDrivers[0])} onbegrensd doorwerkt` : ""
            }.`,
          },
          {
            titel: "Bij voorkeur te vermijden",
            variant: "teal",
            tekst: `Rollen die frontaal botsen met de laagst geplaatste driver (${
              drivers.length ? drivers[drivers.length - 1].construct : "—"
            })${
              heeftModule && q3 - q4 >= 4
                ? ", of louter transactionele, betekenisarme contexten zonder wederkerigheid"
                : ""
            }.`,
          },
        ],
        pt: 9.4,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: `${voornaam} rendeert het sterkst waar ${lijstZin(
              [topVersneller, tweedeVersneller, topFocus]
                .filter((r): r is Rij => !!r)
                .map(kern)
            )} samenkomen, met ruimte om eerst te denken en daarna te verankeren.`,
          },
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: (() => {
              const mens = [...foci, ...versnellers].filter(
                (r) => EH[r.construct] && EH[r.construct].code.includes("H") && r.net > 0
              );
              const functioneel = [...foci, ...versnellers].filter(
                (r) => EH[r.construct] && EH[r.construct].code === "E" && r.net > 0
              );
              return (
                "<i>Interpretatie.</i> Leest u de aandachtsgebieden en versnellers op hun " +
                "expertise- versus mensgerichte kant (hoofdstukken 7 en 9), dan tekent zich één " +
                `lijn af: ${
                  mens.length >= functioneel.length
                    ? "<b>het talent opent vooral via de humane kant</b> — aanvoelen, begeleiden en mensen ontsluiten"
                    : "<b>het talent opent vooral via de functionele kant</b> — inhoud, structuur en resultaat"
                }. De positief metende lijnen zijn ${
                  lijstZin([...mens, ...functioneel].map((r) => r.construct)) || "beperkt in aantal"
                }. Het overige is inzetbaar, maar geen spontane ingang.`
              );
            })(),
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Gebruik de vier rolcategorieën als selectie- en herontwerpkader. Versterk passende " +
              "rollen, bewaak de voorwaardelijke en herdenk de risicovolle.",
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // 16 — Ontwikkelrisico's en waakpunten -------------------------------------
  const onderbenutteFocus = foci.find(
    (r) => r.net > 0 && statusVanEnergie(r.avgEnergy) !== "geeft"
  );
  const waakpunten: any[] = [];
  if (kostDrivers[0])
    waakpunten.push({
      titel: `${hoofdletter(kern(kostDrivers[0]))} zonder begrenzing`,
      tekst: `${kostDrivers[0].construct} (${netTekst(
        kostDrivers[0].net
      )}) kost energie (${getal(
        kostDrivers[0].avgEnergy
      )}): de neiging om te blijven doorzetten maakt afronden moeilijk en houdt het energieverschil in stand.`,
    });
  if (kostDrivers[1])
    waakpunten.push({
      titel: "Niet kunnen loslaten",
      tekst: `${kostDrivers[1].construct} (${netTekst(
        kostDrivers[1].net
      )}, energie ${getal(
        kostDrivers[1].avgEnergy
      )}) trekt energie weg zodra de context ${kern(kostDrivers[1])} vraagt; werk van anderen wordt dan overgenomen.`,
    });
  if (onderbenutteFocus)
    waakpunten.push({
      titel: `Onderbenutte ${onderbenutteFocus.construct.toLowerCase()}`,
      tekst: `${onderbenutteFocus.construct} meet positief (${netTekst(
        onderbenutteFocus.net
      )}) maar geeft vandaag geen energie (${getal(
        onderbenutteFocus.avgEnergy
      )}): te weinig ruimte ondermijnt die lijn en doet de congruentie tussen talent en rol afnemen.`,
    });
  if (heeftModule && q3 - q4 >= 4)
    waakpunten.push({
      titel: "Scheve wederkerigheid",
      tekst: `Zelfinvestering ${kort(q3)} tegenover organisatie-investering ${kort(
        q4
      )}: een eenzijdig gedragen relatie die op termijn de loyaliteit ondergraaft.`,
    });

  secties.push({
    nummer: "16",
    titel: "Ontwikkelrisico's en waakpunten",
    ondertitel: "Waar sterkte kan omslaan in belasting.",
    onderdelen: [
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: `${voornaam}s grootste risico's zijn de keerzijde van de sterktes: ${
              lijstZin(waakpunten.map((w) => w.titel.toLowerCase())) ||
              "vandaag zijn er geen scherpe waakpunten"
            }.`,
          },
        ],
        pt: 9.6,
      },
      {
        type: "waakpunten",
        kaarten: waakpunten.map((w, i) => ({
          num: String(i + 1).padStart(2, "0"),
          titel: w.titel,
          tekst: w.tekst,
        })),
        pt: 9.5,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst:
              "<i>Hypothese.</i> Deze waakpunten versterken elkaar: belasting en " +
              "oververantwoordelijkheid voeden het energieverschil, dat op zijn beurt de beleving " +
              "van scheve wederkerigheid verscherpt.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst: `Werk aan ‘goed genoeg’-afspraken, expliciete afrondingsmomenten, bewuste delegatie en zichtbare wederkerigheid. Begin bij het waakpunt met de grootste hefboom: ${
              waakpunten[0] ? waakpunten[0].titel.toLowerCase() : "begrenzing van belasting"
            }.`,
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // ── 17. Energielekken en minder vanzelfsprekende talentlijnen ───────────────
  // Tabel 1: drivers die energie kosten (rangorde). Tabel 2: talentlijnen met
  // net <= -3 die géén energie kosten — de "tweede laag".
  const tweedeLaag = [...foci, ...versnellers]
    .filter((r) => r.net <= -3 && statusVanEnergie(r.avgEnergy) !== "kost")
    .sort(rangorde);

  const lekLezing = (r: Rij, i: number): string => {
    if (i === 0 && r.net > 0) {
      return `Dominante driver; de aanhoudende ${kern(
        r,
      )} is sterk herkend maar trekt vandaag de meeste energie weg (${getal(r.avgEnergy)}).`;
    }
    if (r.net > 0) {
      return `Herkende route, maar kost vandaag energie (${getal(
        r.avgEnergy,
      )}) zodra de context hierop blijft trekken.`;
    }
    return `Geen voorkeursroute; contexten die ${kern(r)} vragen trekken energie weg (${getal(
      r.avgEnergy,
    )}).`;
  };

  const tweedeLaagLezing = (r: Rij): string =>
    statusVanEnergie(r.avgEnergy) === "geeft"
      ? `Geen hoofdroute, maar energiegevend (${getal(
          r.avgEnergy,
        )}) — bruikbaar als bewust ingeschakelde tweede laag.`
      : `Geen spontane startroute en energetisch neutraal (${getal(
          r.avgEnergy,
        )}); blokkeert niet, maar start niet vanzelf.`;

  const energierijkeTweedeLaag = tweedeLaag.filter(
    (r) => statusVanEnergie(r.avgEnergy) === "geeft",
  );

  secties.push({
    nummer: "17",
    titel: "Energielekken en minder vanzelfsprekende talentlijnen",
    ondertitel:
      "Welke lijnen energie kosten — en welke talenten er wel zijn maar niet vanzelf starten.",
    onderdelen: [
      {
        type: "statement",
        tekst: `Niet elke lijn in dit profiel kost evenveel energie, en niet elk talent start vanzelf. Dit hoofdstuk leest expliciet welke drivers bij ${voornaam} vandaag energie wegtrekken en welke talentlijnen er wél zijn maar geen spontane startroute vormen. Minder vanzelfsprekend betekent hier nadrukkelijk niet afwezig.`,
        pt: 12.0,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: kostDrivers.length
              ? `De belangrijkste energielekken bij ${voornaam} liggen bij ${lijstZin(
                  kostDrivers.map((r) => `<b>${r.construct}</b>`),
                )}.${
                  kostDrivers[0].net > 0
                    ? ` ${kostDrivers[0].construct} is een sterk herkende route en kost tóch energie;`
                    : ""
                } de overige lijnen zijn geen voorkeursroutes en trekken energie weg zodra de context ze afdwingt. Dat verklaart mee waarom de beleefde werkenergie (${beleefd} / 10) en het gemeten potentieel (${getal(
                  gemeten,
                )}) vandaag uiteenlopen.`
              : `Geen enkele driver kost bij ${voornaam} vandaag per saldo energie; de aandacht in dit hoofdstuk gaat volledig naar talentlijnen die er wél zijn maar niet vanzelf starten.`,
          },
        ],
      },
      { type: "subkop", tekst: "Wat vandaag energie kost" },
      {
        type: "constructtabel",
        kolomkop: "DRIVER",
        saldo: null,
        rijen: kostDrivers.map((r, i) => ({
          naam: r.construct,
          icoon: icoonNaam(r.construct),
          net: netTekst(r.net),
          energiewaarde: getal(r.avgEnergy),
          energie: statusVanEnergie(r.avgEnergy),
          lezing: lekLezing(r, i),
        })),
        kolombreedtes: BREEDTE.lek,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: `<i>Interpretatie.</i> Deze drivers delen één signatuur: ze koppelen aan <b>contexten</b> die ${voornaam} onder druk zetten, eerder dan aan eigen voorkeursroutes. Ze verklaren het grootste deel van de energiediscrepantie tussen beleving en meting (${getal(
              discrepantie,
            )}): niet het talent ontbreekt, maar de context vraagt vandaag een inzet die energie kost in plaats van geeft.`,
          },
        ],
        pt: 9.6,
      },
      { type: "subkop", tekst: "Minder vanzelfsprekende talentlijnen" },
      {
        type: "constructtabel",
        kolomkop: "TALENTLIJN",
        saldo: null,
        rijen: tweedeLaag.map((r) => ({
          naam: r.construct,
          icoon: icoonNaam(r.construct),
          net: netTekst(r.net),
          energiewaarde: getal(r.avgEnergy),
          energie: statusVanEnergie(r.avgEnergy),
          lezing: tweedeLaagLezing(r),
        })),
        kolombreedtes: BREEDTE.tweedeLaag,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst: tweedeLaag.length
              ? `<i>Interpretatie.</i> ${lijstZin(
                  tweedeLaag.map((r) => r.construct),
                )} staan laag in de rangorde en vormen geen spontane start — maar ${
                  energierijkeTweedeLaag.length
                    ? `${lijstZin(
                        energierijkeTweedeLaag.map(
                          (r) => `${r.construct} ${getal(r.avgEnergy)}`,
                        ),
                      )} ${energierijkeTweedeLaag.length === 1 ? "geeft" : "geven"} wél duidelijk energie`
                    : "geen van hen blokkeert"
                }. Dat maakt ze waardevol als <b>tweede laag</b>: lijnen die renderen wanneer ze bewust worden ingeschakeld ná ${voornaam}s dragende kern (${lijstZin(
                  dragendeKern.map((r: Rij) => r.construct),
                )}), niet als hoofdopdracht.`
              : `<i>Interpretatie.</i> Er zijn geen talentlijnen die duidelijk laag staan en tegelijk energie geven; ${voornaam} concentreert zijn energie in de lijnen die ook als voorkeursroute herkend worden.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst: [
              ...kostDrivers.map(
                (r) =>
                  `• Vermijd ${kern(r)} als kernopdracht; begrens waar de context dit vandaag afdwingt.`,
              ),
              "• Bouw expliciete afrondings- en herstelmomenten in om de energiediscrepantie te verkleinen.",
              ...energierijkeTweedeLaag
                .slice(0, 2)
                .map(
                  (r) =>
                    `• Zet ${r.construct} bewust in als energierijke tweede laag, na de dragende kern.`,
                ),
              ...tweedeLaag
                .filter((r) => statusVanEnergie(r.avgEnergy) === "neutraal")
                .slice(0, 1)
                .map(
                  (r) =>
                    `• Gebruik ${r.construct} als bewuste, niet als spontane verwachting — schakel ze in waar het echt nodig is.`,
                ),
            ].join("\n"),
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
    titelregels: 2,
  });

  // ── 18. Toekomstgerichte synthese ───────────────────────────────────────────
  const gespreksvragen = [
    kostDrivers[0]
      ? `• Wanneer is ${kern(kostDrivers[0])} voor jou genoeg?`
      : "• Wat maakt werk voor jou vandaag de moeite waard?",
    heeftModule && q3 <= 3
      ? "• Wat heb je nodig om wederkerig te blijven investeren?"
      : "• Wat heb je nodig om te blijven investeren op dit niveau?",
    energierijkeTweedeLaag[0]
      ? `• Waar wil je meer ruimte voor ${energierijkeTweedeLaag[0].construct.toLowerCase()} in plaats van ${
          topFocus ? topFocus.construct.toLowerCase() : "je huidige hoofdopdracht"
        }?`
      : `• Waar wil je ${topVersneller ? topVersneller.construct.toLowerCase() : "je sterkste lijn"} nog voluit inzetten?`,
  ].join("\n");

  const hrPunten = [
    heeftModule && q3 <= 3
      ? "• Wederkerigheid en erkenning zichtbaar maken."
      : "• Erkenning en zichtbaarheid van de geleverde inzet borgen.",
    `• Ruimte voor ${lijstZin(
      dragendeKern.slice(0, 2).map((r: Rij) => r.construct.toLowerCase()),
    )} borgen in de rol.`,
    kostDrivers.length
      ? "• Beschikbaarheid en verantwoordelijkheid begrenzen."
      : "• Belasting en verwachtingen expliciet houden.",
  ].join("\n");

  const interventies = [
    kostDrivers[0]
      ? "• Afrondingsritueel en ‘goed genoeg’-norm."
      : "• Periodieke check op rolfit en verwachtingen.",
    "• Periodieke energiecheck (beleefd vs. potentieel).",
    topDriver
      ? `• Signaal: kantelt ${topDriver.construct} van brandstof in controlemodus?`
      : "• Signaal: kantelt brandstof in controlemodus?",
  ].join("\n");

  secties.push({
    nummer: "18",
    titel: "Toekomstgerichte synthese",
    ondertitel: "Van inzicht naar handeling — gesprek, rolontwerp en gerichte interventie.",
    onderdelen: [
      { type: "tekstblok", kop: "Gespreksthema's", tekst: gespreksvragen, pt: 9.4, kop_pt: 10.5 },
      { type: "tekstblok", kop: "HR-aandachtspunten", tekst: hrPunten, pt: 9.4, kop_pt: 10.5 },
      {
        type: "tekstblok",
        kop: "Interventies en monitoring",
        tekst: interventies,
        pt: 9.4,
        kop_pt: 10.5,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst:
              "De toekomstgerichte inzet draait om drie bewegingen: ruimte geven aan talent, " +
              "begrenzen van belasting en herstellen van wederkerigheid.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Vertaal deze synthese naar een concreet ontwikkel- en rolgesprek met meetbare " +
              "afspraken en periodieke monitoring. Dit is de business- en gesprekslaag van het " +
              "profiel: de plek waar inzicht omgezet wordt in afspraken over rolfit, context en " +
              "gerichte interventie.",
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // ── Kaderwaarden (nodig in 19, 20 en 21) ────────────────────────────────────
  const rijVan = (naam: string): Rij | undefined => alle.find((r) => r.construct === naam);
  const netVan = (naam: string): number => (rijVan(naam) ? rijVan(naam)!.net : 0);
  const netLabel = (naam: string): string => `${naam} ${netTekst(netVan(naam))}`;

  const riasecScores = RIASEC.map((l, i) => ({
    ...l,
    hexagoon: i,
    aanwezig: l.constructen.some((c) => rijVan(c)),
    score: l.constructen.reduce((s, c) => s + netVan(c), 0),
  }));
  const riasecGesorteerd = [...riasecScores].sort((a, b) => {
    if (a.aanwezig !== b.aanwezig) return a.aanwezig ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.hexagoon - b.hexagoon;
  });
  const hollandLetters = riasecGesorteerd.slice(0, 3).map((l) => l.letter);
  const hollandCode = hollandLetters.join(" ");
  const hollandNamen = riasecGesorteerd.slice(0, 3).map((l) => l.naam);

  const conceptueel = netVan("Analyse") + netVan("TaPas-Beeld") + netVan("Innovatie");
  const leidendeRol = /founder|oprichter|ceo|owner|zaakvoerder|directeur|director|partner/i.test(
    `${rol} ${functie}`,
  );
  const stratum = conceptueel >= 14 ? 5 : conceptueel >= 8 ? 4 : conceptueel >= 3 ? 3 : 2;
  const stratumRichting = leidendeRol && conceptueel >= 8 ? Math.min(stratum + 1, 6) : 0;

  // ── 19. Toekomstpistes en carrièrekansen ────────────────────────────────────
  // De drie pistes zijn vaste sjabloontekst met plaatshouders: een projectie naar
  // de toekomst valt niet uit de meetdata af te leiden.
  const dragend = dragendTalent.map((r: Rij) => r.construct);
  const rem = kostDrivers[0];
  const eigenStem = energierijkeTweedeLaag[0];

  secties.push({
    nummer: "19",
    titel: "Toekomstpistes en carrièrekansen",
    ondertitel:
      "Durven vooruitdenken — waar dit talent de komende jaren nóg meer kan renderen.",
    onderdelen: [
      {
        type: "statement",
        tekst: `Dit hoofdstuk kijkt bewust verder dan de huidige rol. Het projecteert ${voornaam}s dragende talent — ${lijstZin(
          dragend.map((n) => kern(rijVan(n))),
        )} — naar rollen en richtingen waarin dat talent de komende jaren nóg meer kan renderen. Geen voorspelling, wél een uitgesproken uitnodiging om groot en buiten de gebaande paden te denken.`,
        pt: 12.0,
      },
      {
        type: "pistes",
        kaarten: [
          {
            num: "1",
            kop: "Architect van talent- en assessmentmethodiek — internationaal schaalbaar",
            rendeert: `${voornaam}s sterkste route — ${
              topVersneller
                ? `${topVersneller.construct} (${netTekst(topVersneller.net)}, ${getal(
                    topVersneller.avgEnergy,
                  )} energie)`
                : "zijn sterkste versneller"
            }${
              tweedeVersneller
                ? ` en ${tweedeVersneller.construct} (${netTekst(tweedeVersneller.net)})`
                : ""
            } — gecombineerd met een vernieuwings- en betekenisgedreven kern (${netLabel(
              "TaPas-Beeld",
            )}, ${netLabel(
              "Innovatie",
            )}), tilt hem natuurlijk naar het ontwerpen van methodiek in plaats van het enkel toepassen ervan. Hij rendeert waar conceptueel denken, instrumentontwikkeling en diepgaande logica samenkomen — een rol die talentmethodiek niet alleen gebruikt maar fundamenteel doordenkt en uitbouwt.`,
            ontwikkelen: rem
              ? `Begrens de rem van ${rem.construct} (${netTekst(
                  rem.net,
                )}, energiekostend): werk met expliciete ‘goed genoeg’-criteria en afrondingsmomenten, zodat ontwerpkracht niet in eindeloze verfijning blijft hangen. Geef de vernieuwingslijn (Innovatie) structureel ruimte naast het kwaliteitswerk.`
              : "Houd de ontwerpkracht begrensd in tijd en scope, zodat verfijning niet de plaats van afronding inneemt. Geef de vernieuwingslijn structureel ruimte naast het kwaliteitswerk.",
            vraag:
              "Welk talent- of mensvraagstuk zou jij wereldwijd anders willen helpen begrijpen als jouw methodiek de standaard mocht worden?",
          },
          {
            num: "2",
            kop: "Voorbij één praktijk: denkleider en bouwer van een lerend ecosysteem",
            rendeert: `Zijn ${kern(
              rijVan(dragend[0]),
            )} is niet aan één organisatie of één product gebonden. In rollen als auteur, spreker, opleider of bouwer van een internationaal netwerk rond talent en energie komt exact hetzelfde talent tot leven — doordenken, betekenis geven en anderen laten groeien, met ${
              tweedeVersneller
                ? `${tweedeVersneller.construct} (${netTekst(tweedeVersneller.net)})`
                : "coachende diepgang"
            } als relationele diepgang en ${
              eigenStem
                ? `${eigenStem.construct} (onderbenut, maar energierijk ${getal(
                    eigenStem.avgEnergy,
                  )})`
                : "zijn eigen, herkenbare stem"
            } als eigen, herkenbare stem.`,
            ontwikkelen: `Vraagt dat ${voornaam} ${
              eigenStem ? "zijn onderbenutte onderscheidende lijn" : "zijn eigen stem"
            } bewust naar voren schuift in plaats van ze weg te cijferen achter de inhoud. De valkuil is dat alles zelf-dragen (${lijstZin(
              kostDrivers.slice(0, 2).map((r) => r.construct),
            ) || "alles zelf willen dragen"}) opschaling tegenhoudt; delegeren en co-creëren zijn hier de hefboom.`,
            vraag:
              "Als je ideeën een podium kregen zonder dat jij elk detail zelf moest bewaken — waarover zou je dan als eerste je stem laten horen?",
          },
          {
            num: "3",
            kop: "Op het snijvlak van talent en kunst — een eigen creatieve signatuur",
            rendeert: `${voornaam}s profiel draagt een uitgesproken artistiek-betekenisgevende lijn (${netLabel(
              "TaPas-Beeld",
            )}, ${netLabel(
              "Innovatie",
            )}; Holland-code ${hollandLetters.join(
              "-",
            )}). Uitgebouwd opent dit een richting waarin talentontwikkeling en creatief werk elkaar voeden — van narratieve en theatrale werkvormen in assessment tot formats die organisaties anders naar mensen laten kijken. Een uniek, moeilijk kopieerbaar onderscheid.`,
            ontwikkelen:
              "Geef de creatieve lijn een formele plek naast het methodische werk in plaats van als hobby ernaast. Dit vraagt de moed om de twee werelden te durven verbinden waar de markt ze meestal gescheiden houdt — precies daar ligt de internationale onderscheidingskracht.",
            vraag:
              "Welke vorm zou je willen geven aan talentwerk als niemand je vertelde dat methodiek en kunst niet samengaan?",
          },
        ],
        pt: 9.4,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Kernboodschap",
            variant: "",
            tekst: `${voornaam}s talent reikt verder dan zijn huidige praktijk: het draagt minstens drie uitgesproken richtingen — architect van internationaal schaalbare methodiek, denkleider en ecosysteembouwer, en een eigen creatieve signatuur op het snijvlak van talent en kunst. In alle drie is de hefboom dezelfde: ${lijstZin(
              dragend.map((n) => n.toLowerCase()),
            )}.`,
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst: `<i>Hypothese.</i> Deze pistes vragen telkens dat ${voornaam} ${
              rem ? `de rem van ${rem.construct} (${netTekst(rem.net)})` : "zijn eigen rem"
            } begrenst en durft te delegeren en co-creëren in plaats van alles zelf te dragen. Zonder die twee bewegingen blijft groot talent klein en lokaal ingezet.`,
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Gebruik dit hoofdstuk als startpunt van een loopbaangesprek dat verder durft te " +
              "kijken dan de volgende opdracht. Kies één piste om het komende jaar concreet te " +
              "verkennen, met een eerste experiment dat laag in risico en hoog in leerwaarde is — " +
              "en dat bewust internationaal mikt.",
          },
        ],
        pt: 9.6,
      },
      {
        type: "reflectie",
        tekst:
          "Als niemand je tegenhield en je eigen talent de enige maat was — welke van deze " +
          "drie richtingen zou je over vijf jaar het meest willen belichamen?",
      },
    ],
    compact: false,
    titelregels: 2,
  });

  // ── 20. Vertaling naar gevestigde kaders ────────────────────────────────────
  const gemNet = (namen: string[]): number =>
    namen.length ? namen.reduce((s, n) => s + netVan(n), 0) / namen.length : 0;

  const bigFiveRijen: string[][] = [
    [
      "Consciëntieusheid",
      bigFiveIndicatie(gemNet(["Be Perfect", "Try Hard"])),
      `${netLabel("Be Perfect")} en ${netLabel(
        "Try Hard",
      )} zijn de dominante drivers; Resultaatgericht en Analyse dragen hoge energie. Self-oriented perfectionisme correleert sterk positief met consciëntieusheid (r≈.54–.61).`,
    ],
    [
      "Openheid",
      bigFiveIndicatie(gemNet(["Analyse", "TaPas-Beeld", "Innovatie"])),
      `${netLabel("Analyse")} en ${netLabel(
        "TaPas-Beeld",
      )} wijzen op denk-, betekenis- en vernieuwingsgerichtheid; ${netLabel(
        "Innovatie",
      )} ondersteunt nieuwsgierigheid en conceptueel werk.`,
    ],
    [
      "Altruïsme",
      bigFiveIndicatie(gemNet(["Coaching", "Inter-relationeel"])),
      `${netLabel("Coaching")} en ${netLabel(
        "Inter-relationeel",
      )} tonen oprechte mensgerichtheid; ${
        netVan("Please Others") < 0 ? "lage" : "hoge"
      } Please Others (${netTekst(
        netVan("Please Others"),
      )}) nuanceert dit tot autonome, niet-volgzame zorg.`,
    ],
    [
      "Extraversie",
      bigFiveIndicatie(gemNet(["Impact"])),
      `${netLabel(
        "Impact",
      )} en coachende gerichtheid wijzen op betrokken invloed, zonder dominant dwingende of sterk sociaal-zoekende stijl.`,
    ],
    [
      "Neuroticisme",
      kostDrivers.length ? "Verhoogd onder druk" : "Gemiddeld",
      `De energiediscrepantie (beleefd ${kort(
        Math.round(beleefd * 10) / 10,
      )}/10 vs. gemeten ${kort(
        Math.round(gemeten * 10) / 10,
      )}/10) en de belasting uit ${
        lijstZin(kostDrivers.map((r) => r.construct)) || "de drivers"
      } wijzen op spanninggevoeligheid; socially prescribed perfectionisme correleert positief met neuroticisme (r≈.24–.32).`,
    ],
  ];

  const riasecRijen: string[][] = riasecGesorteerd.map((l, i) => [
    `${l.letter} — ${l.naam}`,
    RIASEC_INDICATIE[i],
    l.aanwezig
      ? `${lijstZin(l.constructen.filter((c) => rijVan(c)).map((c) => netLabel(c)))}: ${kern(
          rijVan(l.constructen[0]),
        )} is hier de ingang.`
      : "Geen dragend anker voor deze oriëntatie in het profiel.",
  ]);

  const stratumRijen: string[][] = [stratum - 1, stratum, stratum + 1]
    .filter((s) => s >= 1 && s <= 6)
    .map((s) => [
      s === stratum ? `${ROMEINS[s]} — vermoedelijk` : ROMEINS[s],
      STRATA[s].tijdspanne,
      STRATA[s].aard,
    ]);

  secties.push({
    nummer: "20",
    titel: "Vertaling naar gevestigde kaders",
    ondertitel: `${voornaam}s T4P-profiel verbonden met Big Five, RIASEC en het werkniveau van Elliott Jaques — onderbouwd, als brug naar gangbare HR-taal.`,
    onderdelen: [
      { type: "subkop", tekst: "Big Five (Five-Factor Model)" },
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["DIMENSIE", "INDICATIE", `ONDERBOUWING VANUIT ${naam.toUpperCase()}S T4P-RESULTATEN`],
        rijen: bigFiveRijen,
        kolombreedtes: BREEDTE.bigfive,
      },
      { type: "subkop", tekst: "RIASEC (Holland-beroepsinteresses)" },
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["CODE", "INDICATIE", `ONDERBOUWING VANUIT ${naam.toUpperCase()}S T4P-RESULTATEN`],
        rijen: riasecRijen,
        kolombreedtes: BREEDTE.riasec,
      },
      {
        type: "tekstblok",
        kop: `Vermoedelijke Holland-code: ${hollandCode}`,
        tekst: `${hollandNamen.join(
          "–",
        )}: ${lijstZin(
          hollandLetters.map((lt) => {
            const l = riasecGesorteerd.find((x) => x.letter === lt)!;
            return l.aanwezig ? kern(rijVan(l.constructen[0])) : l.naam.toLowerCase();
          }),
        )}. Dit verklaart waarom rollen die volledig buiten deze drie oriëntaties liggen energie kosten.`,
        pt: 9.4,
        kop_pt: 10.5,
      },
      { type: "subkop", tekst: "Elliott Jaques — vermoedelijk werkniveau (stratum)" },
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["STRATUM", "TIJDSPANNE", "AARD VAN HET WERK"],
        rijen: stratumRijen,
        kolombreedtes: BREEDTE.jaques,
      },
      {
        type: "tekstblok",
        kop: `Vermoedelijke score: Stratum ${ROMEINS[stratum]}${
          stratumRichting ? ` (richting ${ROMEINS[stratumRichting]})` : ""
        }`,
        tekst: `${voornaam}s rol als ${rol || functie}, de sterke conceptuele en analytische capaciteit (${lijstZin(
          ["Analyse", "TaPas-Beeld", "Innovatie"].filter((c) => rijVan(c)).map((c) => netLabel(c)),
        )}) en het vermogen om talent, energie en organisatieontwerp gelijktijdig te overzien, wijzen op werk met een tijdspanne van ${
          STRATA[stratum].tijdspanne
        }: ${STRATA[stratum].aard.charAt(0).toLowerCase()}${STRATA[stratum].aard.slice(1, -1)}.${
          stratumRichting
            ? ` De combinatie met betekenisvolle vernieuwing tilt het richting Stratum ${ROMEINS[stratumRichting]} zodra structurele begrenzing en wederkerigheid op orde zijn.`
            : ""
        }`,
        pt: 9.4,
        kop_pt: 10.5,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Professionele betekenis",
            tekst: `<i>Interpretatie.</i> Deze vertaling plaatst ${voornaam}s T4P-profiel naast drie internationaal erkende kaders — persoonlijkheid (Big Five), beroepsinteresse (RIASEC) en werkcomplexiteit (Jaques) — zodat het profiel aansluit op gangbare taal in HR, selectie en organisatieontwerp.`,
          },
          {
            kop: "Bewaking of risico",
            tekst:
              "<i>Interpretatiegrens.</i> Het zijn onderbouwde equivalenties, geen aparte " +
              "testscores: T4P meet talent en energie, geen Big-Five-, RIASEC- of " +
              "Jaques-instrument. Gebruik de vertaling als brug, niet als vervanging van die " +
              "instrumenten.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            tekst: `Zet de kaders in voor rolontwerp en gesprek: zoek rollen met een ${hollandNamen
              .join("-")
              .toLowerCase()} zwaartepunt en een tijdspanne van ${
              STRATA[stratum].tijdspanne
            }, waar denken, betekenis en ontwikkeling samenkomen.`,
          },
        ],
      },
    ],
    compact: false,
  });

  // ── 21. Wetenschappelijke onderbouwing ──────────────────────────────────────
  // Vaste methodische laag: de lenzentabel beschrijft de methodiek, niet de persoon.
  secties.push({
    nummer: "21",
    titel: "Wetenschappelijke onderbouwing",
    ondertitel:
      "De theoretische lenzen onder de T4P-methodiek — elk een lens, samen een verankering, nooit een absolute uitspraak.",
    onderdelen: [
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["THEORETISCHE LENS", "WAARVOOR GEBRUIKT", "INTERPRETATIEGRENS"],
        rijen: [
          [
            "Talentpsychologie en sterktebenadering",
            "Talent-foci en versnellers als natuurlijke aandachts- en groeiroutes",
            "Sterkte ≠ vrije beschikbaarheid vandaag.",
          ],
          [
            "Energie- en vitaliteitsmodellen",
            "Beleefde vs. gemeten energie, energiekost per construct",
            "Leesanker, geen medische indicator.",
          ],
          [
            "Driver- / scriptlogica (TA)",
            "Onbewuste druk- en controlepatronen",
            "Patroon, geen diagnose of fout.",
          ],
          [
            "Big Five / persoonlijkheidstrekken",
            "Stabiele oriëntatie achter voorkeuren",
            "Aanvulling, geen vervanging van context.",
          ],
          [
            "RIASEC / person-job fit",
            "Predictieve rolcategorieën en beroepsoriëntatie",
            "Toont interesse; vul aan met talent en energie.",
          ],
          [
            "Leiderschap & ontwikkelgericht functioneren (o.a. Ulrich Leadership Code)",
            "Talent om te leiden en te ontwikkelen",
            "Contextafhankelijk; een lens, geen rangschikking.",
          ],
        ],
        kolombreedtes: BREEDTE.lenzen,
      },
      {
        type: "tekstblok",
        kop: "Inspiratiebron — Zichtbaar",
        tekst: `Wie dit profiel wil verdiepen rond eigenheid en erkenning, vindt verwante inspiratie in Zichtbaar — van onbegrepen talent naar gewaardeerde eigenheid. Het sluit aan bij de geest van T4P: niet óf iemand talent heeft, maar of dat talent in de juiste context gezien en duurzaam ingezet wordt — voor ${voornaam} een bijzonder herkenbare leeslijn.`,
        pt: 9.4,
        kop_pt: 10.5,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Professionele betekenis",
            variant: "",
            tekst:
              "<i>Interpretatie.</i> Elke lens kijkt naar een ander aspect — talent, energie, " +
              "motivatie, fit, stresspatroon en leiderschap — en samen vermijden ze dat één " +
              "score tot een absolute uitspraak wordt verheven.",
          },
          {
            kop: "Actie of ontwerpimplicatie",
            variant: "actie",
            tekst:
              "Gebruik de lenzen functioneel: kies bij elke conclusie bewust welke lens ze het " +
              "sterkst onderbouwt en benoem waar de uitspraak ophoudt.",
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
    titelregels: 2,
  });

  // ── 22. Technische bijlage ──────────────────────────────────────────────────
  const familieLezing = (familie: string, gem: number): string => {
    if (familie === "Drivers") {
      return gem < 0
        ? "Dominante lijnen kosten netto energie."
        : "Dominante lijnen dragen netto energie aan.";
    }
    if (familie === "Talent-foci") {
      // Eigen drempel, niet die van statusVanEnergie (0,25): de referentie van
      // 5 juni noemt een familiegemiddelde van +0,30 nog "licht positief". Een
      // familiegemiddelde is een gemiddelde van gemiddelden en ligt dus
      // structureel dichter bij nul dan een constructwaarde; vandaar 0,50.
      return gem >= 0.5
        ? "Positief, met onderbenuttingssignaal."
        : "Licht positief, met onderbenuttingssignaal.";
    }
    return "Meest energiserende familie.";
  };

  const familieOrde = ["Drivers", "Talent-foci", "Talent-versnellers"];
  const familieTabel = familieOrde
    .map((f) => familieRijen.find((x) => x.family === f))
    .filter(Boolean)
    .map((f: any) => [f.family, getal(f.avgEnergy), familieLezing(f.family, f.avgEnergy)]);

  const kortFamilie = (f: string): string => (f === "Talent-versnellers" ? "Versnellers" : f);
  const constructTabel = [...drivers, ...alleFoci, ...versnellers].map((r) => [
    r.construct,
    kortFamilie(r.family),
    netTekst(r.net),
    getal(r.avgEnergy),
  ]);

  secties.push({
    nummer: "22",
    titel: "Technische bijlage",
    ondertitel: "Compacte methodische laag: constructscores, energielogica en grenzen.",
    onderdelen: [
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["FAMILIE", "GEM. ENERGIE", "LEZING"],
        rijen: familieTabel,
        kolombreedtes: BREEDTE.families,
      },
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["CONSTRUCT", "FAMILIE", "NET", "GEM. ENERGIE"],
        rijen: constructTabel,
        kolombreedtes: BREEDTE.constructen,
      },
      {
        type: "lagen",
        blokken: [
          {
            kop: "Data en signalen",
            variant: "",
            tekst: `De invulzorgvuldigheid komt uit op ${kort(consistentie)}/100${
              consLabel ? ` (${consLabel.toLowerCase()})` : ""
            }. Volledigheid: ${kort(schermen)}/${kort(schermenTotaal)} schermen, ${kort(
              alle.filter((r) => r.shown > 0).length,
            )}/${kort(alle.length)} duidingen, ${kort(
              keuzes,
            )} keuzes. Net = most − least; gemiddelde energie van energiekostend (negatief) tot energiegevend (positief).`,
          },
          {
            kop: "Bewaking of risico",
            variant: "risico",
            tekst:
              "Interpretatiegrens. Dit rapport is een zorgvuldig opgebouwde profiellezing, maar " +
              "blijft een interpretatief instrument en geen definitieve uitspraak over persoon " +
              "of functioneren. Gesprek, contextkennis en observatie blijven noodzakelijk.",
          },
        ],
        pt: 9.6,
      },
    ],
    compact: false,
  });

  // ── 23. Grondslagen ─────────────────────────────────────────────────────────
  secties.push({
    nummer: "23",
    titel: "Grondslagen",
    ondertitel:
      "De wetenschappelijke verankering onder het TaPas-gedachtengoed — als brug naar gesprek, niet als hard label.",
    onderdelen: [
      {
        type: "paragraaf",
        tekst:
          "Een korte, sobere bronnenlijst. Geen pronkstuk en geen claim dat elk TaPas-onderdeel " +
          "één-op-één uit één studie voortkomt, maar een zorgvuldige verankeringslaag voor " +
          "interpretatie, nuance en gesprek.",
        pt: 10.0,
      },
      {
        type: "vrijetabel",
        kop: null,
        kolommen: ["ANKER", "WAAROM RELEVANT VOOR TAPAS", "BRON"],
        rijen: [
          [
            "Talent en expertise",
            "Talent als ontwikkelbaar potentieel via oefening, feedback en context.",
            "Ericsson & Harwell",
          ],
          [
            "Energie en burn-out",
            "Werkenergie als balans tussen taakeisen, hulpbronnen en herstel.",
            "Bakker & Demerouti",
          ],
          [
            "Motivatie en passie",
            "Duurzame energie via autonomie, competentie en verbondenheid.",
            "Deci, Olafsen & Ryan",
          ],
          [
            "Flow en engagement",
            "Flow als samenspel van uitdaging, betrokkenheid en vaardigheid.",
            "Shernoff e.a.",
          ],
          [
            "Big Five lens",
            "Big Five als vertaaltaal voor patronen, niet als vervanging van TaPas.",
            "Barrick, Mount & Judge",
          ],
          [
            "Rolfit en oriëntatie",
            "Waarom sommige rollen energie openen en andere energie lekken.",
            "Kristof-Brown e.a.",
          ],
          [
            "Leiderschap",
            "Vertaling naar leiderschapsbijdrage, rolzwaarte en tijdshorizon.",
            "Ulrich / RBL · Jaques",
          ],
          [
            "Drivers onder druk",
            "Praktische taal voor stress- en controlepatronen, nooit als diagnose.",
            "Kahler-traditie",
          ],
        ],
        kolombreedtes: BREEDTE.ankers,
      },
      {
        type: "paragraaf",
        tekst:
          "Lees deze ankers als verankering voor het gesprek, niet als hard label. De " +
          "werkelijke meerwaarde ontstaat waar profielgegevens, professionele context en " +
          "wetenschappelijke lenzen elkaar zorgvuldig nuanceren.",
        pt: 9.0,
      },
    ],
    compact: false,
  });

  // ── 24. Mantra en dankwoord ─────────────────────────────────────────────────
  const mantraKern = lijstZin(
    [
      topDriver ? kern(topDriver) : "",
      topFocus ? kern(topFocus) : "",
      topVersneller ? kern(topVersneller) : "",
    ].filter(Boolean),
  );

  secties.push({
    nummer: "24",
    titel: "Mantra en dankwoord",
    ondertitel: "Een leidende gedachte om mee te nemen, en een woord van oprechte waardering.",
    onderdelen: [
      {
        type: "statement",
        tekst:
          "“Kwaliteit is pas af wanneer ze gezien, gedeeld en wederkerig gedragen wordt — " +
          "niet wanneer ze perfect is.”",
        pt: 13.5,
      },
      {
        type: "paragraaf",
        tekst: `Een compacte levensregel die ${voornaam}s kern eert: ${mantraKern}, gedragen door wederkerigheid en duurzame inzet in plaats van eindeloze verfijning.`,
        pt: 10.0,
      },
      {
        type: "tekstblok",
        kop: "Dankwoord",
        tekst:
          `Bedankt, ${voornaam}, voor het vertrouwen waarmee je je talent, je energie en je ` +
          "eigenheid zichtbaar hebt gemaakt. Een profiel openen is altijd een vorm van " +
          "toevertrouwen, en wij beschouwen het als een voorrecht om daar zorgvuldig mee om te " +
          "gaan. We hopen dat dit kompas je helpt om je rijkdom opnieuw congruent in te zetten — " +
          "gezien, gewaardeerd en duurzaam gedragen.\n\nMet oprechte waardering,\n" +
          "TaPasCity · www.tapascity.com · info@tapascity.com\n" +
          "Inspiratie: Zichtbaar — van onbegrepen talent naar gewaardeerde eigenheid",
        pt: 9.4,
        kop_pt: 11.4,
      },
    ],
    compact: false,
  });

  return {
    respondent: { naam, organisatie, functie },
    ondertitel: "Persoonlijk kompas van talent, energie, context en ontwikkelrichting",
    rapportdatum: deelnemer.rapportdatum ?? "",
    databronnen: heeftModule
      ? "T4P-vragenlijst · organisatiemodule"
      : "T4P-vragenlijst",
    leeswijzer: KOMPAS_LEESWIJZER,
    secties,
    titel: "Business Profiel",
  };
}

