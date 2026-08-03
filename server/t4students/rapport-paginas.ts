// ---------------------------------------------------------------------------
// server/t4students/rapport-paginas.ts
//
// De zevenentwintig pagina's van het T4Students-rapport, opgebouwd uit de
// uitkomst van de scoringsmotor en de letterlijke antwoorden van de student.
// Elke pagina volgt blauwdruk-t4students-rapport.md hoofdstuk 5.2; de vaste
// teksten die daar letterlijk staan, staan hier letterlijk.
//
// WAT VAN DE OPDRACHTGEVER KOMT EN WAT VAN DE BOUWER
// De zeventien duidingsteksten bij de constructen zijn van de opdrachtgever en
// staan onaangeraakt in server/data/t4students-duidingsteksten.json. De vaste
// paginateksten hieronder zijn van de bouwer, geschreven op de toon die de
// blauwdruk per pagina voorschrijft. Ze zijn nog niet nagelezen. Welke dat zijn
// staat in het verslag.
//
// VERMOGEN, NIET VOORKEUR
// Bij de talent-foci en de talent-versnellers spreekt elke kop en elk label over
// wat iemand kan en hoe moeiteloos dat gaat, niet over wat iemand graag doet.
// Bij de drivers mag het wel over gedrag gaan, want een driver is een patroon.
// ---------------------------------------------------------------------------

import rapportteksten from "../data/t4students-rapportteksten.json";
import type { T4SInstrument } from "./instrument";
import type { T4SAntwoorden, T4SResultaat } from "./kompas-scoring";
import {
  FAM_BEELD,
  FAM_DRIVERS,
  FAM_FOCI,
  FAM_INTERESSE,
  FAM_VERSNELLERS,
  KLEUR,
  PAGINAPLAN,
  citaatVanItem,
  duidingVan,
  getal1,
  getalMetTeken,
  itemIndex,
  kleurVanFamilie,
  lijst,
  rangschik,
  beantwoordPerFamilie,
  voedingPerConstruct,
  sterksteUitGroep,
  groepeerOpAandeel,
  splitsSterkEnLager,
  type T4SBand,
  type T4SBlok,
  type T4SCitaatRegel,
  type T4SDimensie,
  type T4SLicentie,
  type T4SPagina,
  type T4SRapport,
  type T4SRij,
} from "./rapport-contract";

// ── Vaste teksten uit de blauwdruk, letterlijk ──────────────────────────────

const ONEPAGE_ONDERTITEL = "Drie lagen, elk met een eigen indeling in groepen en een eigen energie.";

const ONEPAGE_INTRO =
  "Deze pagina zet je drie lagen onder elkaar: waarin je je talent inzet, hoe je het doet, " +
  "en wat je daarbij aandrijft. Het cijfer links zegt hoeveel je jezelf erin herkent, het " +
  "balkje rechts wat het je kost of geeft. Twee verschillende dingen.";

const ONEPAGE_LEGENDE = [
  "Hoe je dit leest: het rijtje blokjes links loopt van 0 tot 3 en zegt hoe sterk je jezelf " +
    "herkent. Het balkje rechts begint in het midden: naar rechts geeft energie, naar links " +
    "kost energie.",
  "Een haakje links van twee namen betekent dat die twee zo dicht bij elkaar liggen dat ze " +
    "even sterk zijn.",
  "Bij de drivers staat een driehoekje voor het woord: omhoog is een gaspedaal, omlaag is " +
    "remmend, een streepje is neutraal.",
];

const BAND_NOOT_FOCI =
  "TaPas-BEELD hoort hier niet bij; dat lees je apart op het blad Jouw beeld van jezelf.";

// Herstelronde 2, punt B: vaste tekst, letterlijk overnemen, bij elke plaats
// waar de drie groepen (sterk aanwezig, middenveld, minder aanwezig)
// verschijnen in plaats van een genummerde rangorde.
const GROEP_UITLEG =
  "De drie groepen hieronder komen uit de antwoordschaal zelf, in drie gelijke " +
  "delen. Het is geen vergelijking met andere studenten, want die " +
  "vergelijkingsgroep bestaat niet. Het is het beeld dat jij vandaag van " +
  "jezelf geeft.";

const COVER_SLOTREGEL =
  "Samengesteld door TaPasCity · Dit rapport beschrijft en oriënteert, het beslist niet.";

// De korte duiding bij de interessegebieden en bij de studiegebieden. Deze
// teksten zijn van de bouwer en nog niet nagelezen. Ze staan in een databestand
// omdat hun sleutels constructnamen en gebiedsnamen zijn: die horen maar op een
// plaats te staan, en daar kan een test ze nakijken.
const EIGEN_TEKSTEN = rapportteksten as {
  interesse: { teksten: Record<string, string> };
  studiegebieden: { teksten: Record<string, string> };
  eenZinTalentfocus: { teksten: Record<string, string> };
  eenZinVersneller: { teksten: Record<string, string> };
  eenZinInteresse: { teksten: Record<string, string> };
  kiezenDrivers: { namen: string[] };
};
const INTERESSE_DUIDING = EIGEN_TEKSTEN.interesse.teksten;
const GEBIED_TOELICHTING = EIGEN_TEKSTEN.studiegebieden.teksten;
const KIEZEN_DRIVER_NAMEN = EIGEN_TEKSTEN.kiezenDrivers.namen;

// ── Hulp ────────────────────────────────────────────────────────────────────

function batterijZin(b: number | null): string {
  if (b == null) return "Je gaf niet aan hoe vol je batterij vandaag zit.";
  if (b >= 7) return "Je batterij zit vandaag goed vol. Er is veel energie om mee aan de slag te gaan.";
  if (b >= 5) return "Je batterij zit vandaag redelijk op peil.";
  if (b >= 3) return "Je batterij is vandaag wat lager dan gewoonlijk. Dat mag, het is een momentopname.";
  return (
    "Je batterij zit vandaag bijna leeg. Wees mild voor jezelf; dit zegt iets over vandaag, " +
    "niet over wie je bent."
  );
}

/** Enkelvoud of meervoud van staan, zodat een opsomming van twee namen klopt. */
function staan(aantal: number): string {
  return aantal === 1 ? "staat" : "staan";
}

function pagina(nr: number, blokken: T4SBlok[], ondertitel: string): T4SPagina {
  const plan = PAGINAPLAN.find((p) => p.nr === nr);
  return {
    nr,
    soort: nr === 1 ? "cover" : "inhoud",
    titel: plan ? plan.titel : "",
    ondertitel,
    blokken,
  };
}

function citatenVoor(
  inst: T4SInstrument,
  antwoorden: T4SAntwoorden,
  taal: string,
  itemIds: string[],
): T4SCitaatRegel[] {
  const uit: T4SCitaatRegel[] = [];
  for (const id of itemIds) {
    const c = citaatVanItem(inst, antwoorden, id, taal);
    if (c) uit.push(c);
  }
  return uit;
}

/**
 * Het item dat het zwaarst weegt voor een construct: het eigen herkenningsitem
 * als dat er is, anders het eerste keuze-item dat het construct laadt.
 * Blauwdruk 4.5 regel 3.
 */
function zwaarsteItemVan(inst: T4SInstrument, construct: string): string | null {
  const sm = inst.scoringMap;
  for (const [id, con] of Object.entries(sm.recognitionItems)) if (con === construct) return id;
  for (const [id, con] of Object.entries(sm.interestItems)) if (con === construct) return id;
  for (const [id, con] of Object.entries(sm.beeldItems)) if (con === construct) return id;
  const items = itemIndex(inst);
  for (const id of sm.sjtItems) {
    const it = items[id];
    if ((it?.options || []).some((o) => (o.loads || []).some((l) => l.construct === construct && l.weight > 0)))
      return id;
  }
  return null;
}

function bandVan(dim: T4SDimensie, nummer: number, titel: string, onderschrift: string, noot: string | null): T4SBand {
  return { nummer, titel, onderschrift, noot, kleur: dim.kleur, rijen: dim.rijen };
}

function bronPagina(
  nr: number,
  inst: T4SInstrument,
  antwoorden: T4SAntwoorden,
  taal: string,
  familie: string,
): T4SPagina {
  const items = itemIndex(inst);
  const sm = inst.scoringMap;
  const voeding = voedingPerConstruct(inst);
  const fam = inst.families.find((f) => f.id === familie);
  const constructen = fam ? fam.constructs : [];

  const relevanteIds: string[] = [];
  for (const con of constructen) {
    for (const id of voeding[con]?.herkenningsItems || []) {
      if (!relevanteIds.includes(id)) relevanteIds.push(id);
    }
  }
  // Alleen de items die in deze familie thuishoren of die haar constructen
  // rechtstreeks laden, op de volgorde waarin de student ze zag.
  const main = inst.sections.find((s) => s.sectionId === "main");
  const volgorde = (main ? main.items : []).map((i) => i.id);
  relevanteIds.sort((a, b) => volgorde.indexOf(a) - volgorde.indexOf(b));

  const links: T4SCitaatRegel[] = [];
  const rechts: T4SCitaatRegel[] = [];
  const nietIngevuld: string[] = [];
  for (const id of relevanteIds) {
    const c = citaatVanItem(inst, antwoorden, id, taal);
    if (!c) {
      const it = items[id];
      if (it) nietIngevuld.push(id);
      continue;
    }
    const a = antwoorden[id];
    const isKeuze = (items[id]?.options || []).length > 0;
    if (isKeuze) {
      // Een keuze is geen herkenning. Ze staat links, want de student koos haar.
      links.push(c);
    } else if (a?.recognition != null && a.recognition >= 2) {
      links.push(c);
    } else {
      rechts.push(c);
    }
  }

  const blokken: T4SBlok[] = [
    {
      soort: "intro",
      tekst:
        "Hieronder staat elke vraag uit dit onderdeel letterlijk, met het antwoord dat jij gaf. " +
        "Er staat geen duiding bij en er wordt niets uit afgeleid. Dit blad is er zodat je alles " +
        "wat elders in dit rapport staat, hier kunt narekenen.",
    },
    {
      soort: "kolommen",
      kopLinks: "Hierin herken je jezelf",
      kopRechts: "Hierin herken je jezelf minder",
      links,
      rechts,
    },
  ];
  if (nietIngevuld.length > 0) {
    blokken.push({
      soort: "alinea",
      tekst:
        "Te weinig antwoorden bij: " +
        nietIngevuld.map((id) => (items[id]?.text ? id : id)).join(", ") +
        ". Daarom staat er bij de bijbehorende onderdelen geen score.",
    });
  }
  void sm;
  return pagina(nr, blokken, "Jouw eigen antwoorden, zonder duiding.");
}

// ── De opbouw ───────────────────────────────────────────────────────────────

/**
 * De duidingstekst bij elk van de drie mogelijke balanslabels van de motor.
 * Zelfde toon als de zeventien constructteksten in
 * server/data/t4students-duidingsteksten.json: je-vorm, gewone taal, geen
 * vakjargon, geen streepjes. Het label zelf komt uitsluitend uit de motor; deze
 * teksten kiezen alleen welke van de drie al geschreven zinnen erbij horen.
 */
const MOTIVATIE_DUIDING: Record<string, string> = {
  intrinsiek:
    "Je motivatie komt vooral van binnenuit. Je werkt het liefst als je zelf mag kiezen hoe je iets " +
    "aanpakt, als je voelt dat je bijleert, en als je je verbonden voelt met de mensen om je heen. " +
    "Dat soort motivatie houdt het meestal langer uit, ook zonder dat er iemand toekijkt of beloont. " +
    "De valkuil is dat je minder in beweging komt in een omgeving die alles dichttimmert met regels " +
    "en weinig ruimte laat voor je eigen aanpak.",
  extrinsiek:
    "Je motivatie komt vooral van buitenaf. Goede punten, erkenning en de verwachtingen van je " +
    "omgeving zetten je in beweging en dat werkt voor jou echt. Dat is niet minderwaardig: veel mensen " +
    "presteren daar sterk op. De valkuil is dat je motivatie kan wegvallen zodra de erkenning of de " +
    "druk van buitenaf even wegvalt, ook als de taak zelf niet is veranderd.",
  evenwichtig:
    "Je motivatie komt ongeveer even sterk van binnenuit als van buitenaf. Eigen keuze, groei en " +
    "verbondenheid spelen mee, en erkenning en verwachtingen van anderen spelen ook mee, zonder dat " +
    "een van de twee duidelijk de overhand heeft. Dat geeft je meerdere aanknopingspunten om jezelf in " +
    "beweging te houden, ook als een van de twee kanten het even laat afweten.",
};

// ── Onderdeel F: het blad over kiezen ───────────────────────────────────────
//
// Twee gemeten onderdelen worden naast elkaar gelegd en nooit uit elkaar
// afgeleid: de motivatiebalans (uitsluitend uit de vijf eigen motivatievragen)
// en het patroon Please Others/Try Hard (uitsluitend afgelezen aan het
// bestaande driverlabel). "Sterk aanwezig" betekent hier uitsluitend: het
// label dat de motor al als hoogste categorie geeft, namelijk "gaspedaal".
// Er wordt geen nieuwe drempel toegevoegd. Zie meting-vooraf.md, onderdeel 3.
const KIEZEN_INTRO =
  "Op de bladen hiervoor las je twee dingen die allebei met kiezen te maken kunnen hebben: je " +
  "motivatiebalans en je driverpatroon. Het zijn twee afzonderlijke metingen. Het ene wordt " +
  "nergens uit het andere afgeleid, en de ene meting veroorzaakt de andere niet. Hieronder staan " +
  "ze alleen naast elkaar gelegd.";

const KIEZEN_TEKST_GEVAL1 =
  "Wat jou beweegt, komt volgens je antwoorden vooral van binnenuit. Tegelijk laat je " +
  "driverpatroon zien dat je sterk let op wat anderen van je verwachten. Dat zijn twee losse " +
  "metingen, en ze wijzen niet dezelfde kant op. Op het moment van kiezen kan dat wringen. De " +
  "vraag die dan helpt: wat zou ik kiezen als niemand meekeek.";

const KIEZEN_TEKST_GEVAL2 =
  "Allebei de onderdelen wijzen naar de mensen om je heen. Dat maakt je betrokken, en het kan " +
  "kiezen zwaarder maken, omdat je snel aanvoelt wat een ander goed zou vinden. De vraag die dan " +
  "helpt: wat zou ik kiezen als niemand meekeek.";

const KIEZEN_TEKST_GEVAL3 =
  "Je motivatie en je driverpatroon trekken niet duidelijk aan je keuze. Meestal betekent dat " +
  "dat je een keuze eerder op inhoud zult maken dan op wat je omgeving ervan vindt.";

/**
 * Welk van de drie vaste gevallen van onderdeel F van toepassing is, uitsluitend
 * op basis van het motivatie-balanslabel van de motor en het driverlabel
 * "gaspedaal" bij Please Others of Try Hard. Deze functie wordt zowel voor het
 * blad "Waarom kiezen makkelijk of moeilijk kan voelen" gebruikt als voor de
 * afsluitende zin van kader E1, die dezelfde drie gevallen volgt.
 */
function kiezenGeval(resultaat: T4SResultaat, drivers: T4SDimensie): 1 | 2 | 3 {
  const poOfTh = drivers.gerangschikt.some(
    (r) => KIEZEN_DRIVER_NAMEN.includes(r.construct) && r.leeswoord === "gaspedaal",
  );
  if (resultaat.motivatie.balansLabel === "intrinsiek" && poOfTh) return 1;
  if (resultaat.motivatie.balansLabel === "extrinsiek" && poOfTh) return 2;
  return 3;
}

function kiezenSlotzin(geval: 1 | 2 | 3): string {
  if (geval === 1) return KIEZEN_TEKST_GEVAL1;
  if (geval === 2) return KIEZEN_TEKST_GEVAL2;
  return KIEZEN_TEKST_GEVAL3;
}

/**
 * Zet een bestaand driverlabel ("gaspedaal", "remmend", "neutraal") om naar
 * een waarde die het label zelf behoudt maar er gewone taal aan toevoegt, zodat
 * de kaart op het blad over kiezen niet met een kaal intern label alleen komt.
 * Het bestaande label blijft het eerste woord: er wordt niets vervangen.
 */
function driverwaardeMetToelichting(leeswoord: "gaspedaal" | "remmend" | "neutraal"): string {
  if (leeswoord === "gaspedaal") return "gaspedaal, sterk aanwezig";
  if (leeswoord === "remmend") return "remmend, weinig aanwezig";
  return "neutraal, gemiddeld aanwezig";
}

function kiezenBlokken(resultaat: T4SResultaat, drivers: T4SDimensie): T4SBlok[] {
  const geval = kiezenGeval(resultaat, drivers);
  // Please Others en Try Hard kunnen elk een ander label hebben. Gaspedaal
  // krijgt voorrang zodra een van beide daarop staat (zo bleef het altijd al
  // in kiezenGeval); anders geldt het label van de rij die als eerste
  // gerangschikt staat, en bij verschil tussen de twee: neutraal boven
  // remmend, omdat neutraal het minst uitgesproken patroon aangeeft.
  const driverRijen = drivers.gerangschikt.filter((r) => KIEZEN_DRIVER_NAMEN.includes(r.construct));
  const geldigeLabels = ["gaspedaal", "remmend", "neutraal"] as const;
  const isGeldig = (w: string): w is "gaspedaal" | "remmend" | "neutraal" =>
    (geldigeLabels as readonly string[]).includes(w);
  const labels = driverRijen.map((r) => r.leeswoord).filter(isGeldig);
  let driverLabel: "gaspedaal" | "remmend" | "neutraal" | null = null;
  if (labels.includes("gaspedaal")) driverLabel = "gaspedaal";
  else if (labels.includes("neutraal")) driverLabel = "neutraal";
  else if (labels.includes("remmend")) driverLabel = "remmend";
  return [
    { soort: "intro", tekst: KIEZEN_INTRO },
    {
      soort: "paren",
      paren: [
        { label: "Motivatiebalans", waarde: resultaat.motivatie.balansLabel },
        {
          label: `Driverpatroon, ${KIEZEN_DRIVER_NAMEN[0]} en ${KIEZEN_DRIVER_NAMEN[1]}`,
          waarde: driverLabel ? driverwaardeMetToelichting(driverLabel) : "niet als gaspedaal gemeten",
        },
      ],
    },
    { soort: "alinea", tekst: kiezenSlotzin(geval) },
  ];
}

// ── Onderdeel D: het blad "In één zin" ────────────────────────────────────────
//
// De vaste bouwstenen per familie, letterlijk uit de opdracht. Ze worden
// gekozen via sterksteUitGroep: het hoogste aandeel binnen de groep sterk
// aanwezig, met terugval op het middenveld (herstelronde 2, punt C), nooit
// opnieuw berekend.
// De bouwstenen zelf staan niet hier, maar in server/data/t4students-rapportteksten.json,
// zodat elke constructnaam als sleutel maar op een plaats voorkomt (zie
// tests/t4students-geen-vertaaltabel.test.ts).
const D1_TALENTFOCUS: Record<string, string> = EIGEN_TEKSTEN.eenZinTalentfocus.teksten;
const D1_VERSNELLER: Record<string, string> = EIGEN_TEKSTEN.eenZinVersneller.teksten;
const D1_INTERESSE: Record<string, string> = EIGEN_TEKSTEN.eenZinInteresse.teksten;

const D_SLOTREGEL =
  "Deze zin is samengesteld uit de drie onderdelen die in jouw antwoorden het sterkst naar voren " +
  "komen. Hij vat je niet samen als persoon.";

const D_TE_WEINIG =
  "Er is nog te weinig ingevuld om deze zin te bouwen. De losse onderdelen hiervóór in dit rapport " +
  "blijven wel staan; alleen deze samenvattende zin niet.";

// Herstelronde, punt 5, herzien in herstelronde 2, punt D: nu Punt B de
// genummerde rangorde overal heeft vervangen door drie groepen, bestaat het
// woord "rangorde" niet meer in wat een student ziet. Vaste tekst, letterlijk
// overnemen uit opdracht-herstelronde-2.md.
const D2_UITLEG =
  "De twee lijstjes hieronder komen niet uit de groepen op de bladen hiervoor, maar uit de verhouding tussen " +
  "hoeveel je iets in jezelf herkent en hoeveel energie het je geeft. Daarom kan iets bij de sterk aanwezige " +
  "onderdelen staan en toch in het tweede lijstje verschijnen.";

// ── Onderdeel voor het nieuwe slothoofdstuk "Een zin om mee te nemen" ──────
//
// Ingreep 2 van de opdracht "Slotnoot en opmaak". Dit hoofdstuk voegt geen
// enkele nieuwe bewering toe: elk onderdeel leest een uitkomst af die al
// eerder in het rapport berekend en getoond is (het citaatvlak hergebruikt
// letterlijk de zin uit het hoofdstuk "In één zin"; de twee kaarten lezen
// dezelfde duidingstekst af die ook op de bladen met de constructen zelf
// staat). De dankkaart is de enige vaste, niet-berekende tekst op dit blad.
const H_TOELICHTING = "Dit blad vat samen wat je hiervoor las. Er staat niets nieuws in.";

const H_DANK_TEKST =
  "Dank dat je de tijd nam om jezelf te leren kennen via TaPasCity. We hopen dat dit beeld je verder " +
  "helpt in je keuze. Wil je verder lezen over zichtbaar worden in wie je bent? Lees dan Zichtbaar, van " +
  "onbegrepen talent naar gewaardeerde eigenheid.";

const H_DANK_CONTACT = "www.tapascity.com · info@tapascity.com";

// Herstelronde 2, punt C: telwoorden tot en met zes, want een familie telt
// hoogstens zes constructen. Alleen nodig om te melden hoeveel constructen
// even sterk uitkwamen; het getal zelf komt altijd uit de lengte van een
// array die de motor teruggeeft, nooit uit een schatting.
const TELWOORDEN = ["nul", "een", "twee", "drie", "vier", "vijf", "zes"];

/**
 * Kiest de bouwsteen (of, bij een gelijkspel, twee) uit de groep sterk
 * aanwezig van een dimensie (herstelronde 2, punt C: niet langer rang 1 van
 * de motor, maar het hoogste aandeel binnen de groep), met terugval op het
 * middenveld wanneer sterk aanwezig leeg is.
 *
 * Twee gelijk geëindigde bouwstenen worden verbonden met " en ", behalve
 * wanneer minstens een van de twee zelf al het woord "en" bevat (zoals
 * "vorm, beeld en taal"): dan geeft een derde "en" een onleesbare zin met
 * drie keer hetzelfde voegwoord. In dat geval komt er een komma in de
 * plaats, gevolgd door het optionele herhaalwoord dat in de buitenste zin
 * voor deze bouwsteen staat (bijvoorbeeld "over" bij het interesse-onderdeel:
 * "...gaat over vorm, beeld en taal, en over mensen...") (herstelronde, punt 4).
 */
function d1Bouwsteen(
  dim: T4SDimensie,
  tabel: Record<string, string>,
  herhaalwoord?: string,
): { zin: string; gelijkspel: boolean; aantalGelijk: number; uitMiddenveld: boolean } {
  const { constructen, aantalGelijk, uitMiddenveld } = sterksteUitGroep(dim);
  if (constructen.length === 0) return { zin: "", gelijkspel: false, aantalGelijk: 0, uitMiddenveld: false };
  if (constructen.length === 1) {
    return { zin: tabel[constructen[0].construct] || "", gelijkspel: false, aantalGelijk, uitMiddenveld };
  }
  const teksten = constructen.map((r) => tabel[r.construct]).filter((t): t is string => Boolean(t));
  const heeftEigenEn = teksten.some((t) => / en /.test(t));
  const koppelwoord = heeftEigenEn ? `, en ${herhaalwoord ? herhaalwoord + " " : ""}` : " en ";
  return { zin: teksten.join(koppelwoord), gelijkspel: true, aantalGelijk, uitMiddenveld };
}

function eenZinBlokken(
  resultaat: T4SResultaat,
  foci: T4SDimensie,
  versnellers: T4SDimensie,
  interesse: T4SDimensie,
): T4SBlok[] {
  if (resultaat.betrouwbaarheid.voorlopig) {
    return [{ soort: "alinea", tekst: D_TE_WEINIG }];
  }
  const focusB = d1Bouwsteen(foci, D1_TALENTFOCUS);
  const versnellerB = d1Bouwsteen(versnellers, D1_VERSNELLER);
  const interesseB = d1Bouwsteen(interesse, D1_INTERESSE, "over");
  if (!focusB.zin || !versnellerB.zin || !interesseB.zin) {
    return [{ soort: "alinea", tekst: D_TE_WEINIG }];
  }
  const zin =
    `Jij komt het sterkst tot je recht waar je ${focusB.zin}, waar je ${versnellerB.zin}, en waar het ` +
    `gaat over ${interesseB.zin}.`;
  const blokken: T4SBlok[] = [{ soort: "alinea", tekst: zin }];
  // Herstelronde 2, punt C: bij precies twee gelijk op het hoogste aandeel
  // blijft de bestaande gelijkspel-zin gelden. Staan er meer dan twee gelijk,
  // dan benoemt d1Bouwsteen er hierboven maar twee (anders wordt de zin
  // onleesbaar) en meldt deze zin apart hoeveel het er in werkelijkheid waren.
  const tweeGelijk: string[] = [];
  const meerGelijk: { onderdeel: string; aantal: number }[] = [];
  for (const [onderdeel, b] of [
    ["je talent-foci", focusB],
    ["je talent-versnellers", versnellerB],
    ["je interesse", interesseB],
  ] as [string, typeof focusB][]) {
    if (!b.gelijkspel) continue;
    if (b.aantalGelijk > 2) meerGelijk.push({ onderdeel, aantal: b.aantalGelijk });
    else tweeGelijk.push(onderdeel);
  }
  if (tweeGelijk.length > 0) {
    blokken.push({
      soort: "alinea",
      tekst: `Bij ${tweeGelijk.join(" en ")} kwamen twee onderdelen even sterk naar voren.`,
    });
  }
  for (const { onderdeel, aantal } of meerGelijk) {
    blokken.push({
      soort: "alinea",
      tekst: `Bij ${onderdeel} kwamen ${TELWOORDEN[aantal] ?? aantal} onderdelen even sterk naar voren; hierboven staan er twee van.`,
    });
  }
  // Herstelronde 2, punt C: als een van de drie onderdelen uit het middenveld
  // komt (de groep sterk aanwezig was daar leeg), is dat zelf een uitkomst.
  const uitMiddenveldOnderdelen: string[] = [];
  if (focusB.uitMiddenveld) uitMiddenveldOnderdelen.push("je talent-foci");
  if (versnellerB.uitMiddenveld) uitMiddenveldOnderdelen.push("je talent-versnellers");
  if (interesseB.uitMiddenveld) uitMiddenveldOnderdelen.push("je interesse");
  if (uitMiddenveldOnderdelen.length > 0) {
    blokken.push({
      soort: "alinea",
      tekst:
        `Bij ${uitMiddenveldOnderdelen.join(" en ")} kwam niets in dit beeld sterk uitkomen; ` +
        "deze zin gebruikt daarom het hoogste aandeel uit het middenveld. Ook dat is een uitkomst.",
    });
  }
  blokken.push({ soort: "alinea", tekst: D_SLOTREGEL });

  // Onderdeel D2: twee blokken die uitsluitend de bestaande balanslabels
  // aflezen, niets nieuw berekenen.
  const alleDimensies = [foci, versnellers];
  const kernsterktes = alleDimensies.flatMap((d) => d.gerangschikt.filter((r) => r.leeswoord === "kernsterkte"));
  const latentOnderbenut = alleDimensies.flatMap((d) =>
    d.gerangschikt.filter((r) => r.leeswoord === "latent" || r.leeswoord === "onderbenut"),
  );
  // Herstelronde, punt 5, tekst herzien in herstelronde 2, punt D: zonder
  // uitleg lijkt het een rekenfout dat een construct bij de sterk aanwezige
  // onderdelen staat en toch in het tweede lijstje verschijnt. De twee
  // lijstjes komen niet uit de groepen hierboven, maar uit de verhouding
  // tussen herkenning en energie (het balanslabel), een andere berekening
  // dan het aandeel dat de groepen hierboven bepaalt.
  if (kernsterktes.length > 0 || latentOnderbenut.length > 0) {
    blokken.push({ soort: "alinea", tekst: D2_UITLEG });
  }
  if (kernsterktes.length > 0) {
    blokken.push({
      soort: "opsomming",
      kop: "Wat nu al sterk is",
      punten: kernsterktes.map((r) => `${r.construct}: ${r.omschrijving}`.trim()),
    });
  }
  if (latentOnderbenut.length > 0) {
    blokken.push({
      soort: "opsomming",
      kop: "Wat sterker kan worden",
      punten: latentOnderbenut.map((r) => `${r.construct}: ${r.omschrijving}`.trim()),
    });
  }
  return blokken;
}

// ── Het nieuwe slothoofdstuk "Een zin om mee te nemen" ─────────────────────
//
// Vier vaste onderdelen, in deze volgorde: het citaatvlak met de zin uit
// "In één zin", de kaart "WAT AL STERK IS", de kaart "WAT NOG STERKER KAN"
// (allebei weggelaten als er niets voor is) en de vaste dankkaart. Alle
// inhoud, behalve de dankkaart, komt uit bestaande, al geteste berekeningen.
function eenZinOmMeeTeNemenBlokken(
  resultaat: T4SResultaat,
  foci: T4SDimensie,
  versnellers: T4SDimensie,
  interesse: T4SDimensie,
  drivers: T4SDimensie,
): T4SBlok[] {
  const blokken: T4SBlok[] = [{ soort: "alinea", tekst: H_TOELICHTING }];

  // Onderdeel a: het citaatvlak hergebruikt letterlijk de zin die ook op het
  // hoofdstuk "In één zin" staat (het eerste blok van eenZinBlokken, alleen
  // aanwezig als er genoeg is ingevuld om de zin te bouwen).
  const zinBlokken = eenZinBlokken(resultaat, foci, versnellers, interesse);
  const eersteZin = zinBlokken[0];
  if (eersteZin && eersteZin.soort === "alinea" && eersteZin.tekst !== D_TE_WEINIG) {
    blokken.push({
      soort: "citaat",
      opschrift: "JOUW ZIN",
      kop: "Wat je antwoorden samen zeggen",
      kleur: KLEUR.teal,
      regels: [{ vraag: eersteZin.tekst, herkenning: null, energie: null }],
    });
  }

  // Onderdeel b: de kaart "WAT AL STERK IS", op het construct met het
  // hoogste aandeel uit de groep sterk aanwezig van de talent-foci (dezelfde
  // berekening als op de bladen met de talent-foci zelf). Leeg, dus
  // weggelaten, als die groep niets opleverde.
  const sterkFoci = sterksteUitGroep(foci);
  if (sterkFoci.constructen.length > 0) {
    const construct = sterkFoci.constructen[0].construct;
    blokken.push({
      soort: "kaartvlak",
      opschrift: "WAT AL STERK IS",
      kop: construct,
      tekst: duidingVan(construct),
    });
  }

  // Onderdeel c: de kaart "WAT NOG STERKER KAN", op de driver met het
  // hoogste aandeel binnen de drivers die als gaspedaal gelezen worden
  // (dezelfde indeling als bij de drivers, de keerzijde). drivers.gerangschikt
  // staat al op aandeel gesorteerd, dus de eerste rij met dat leeswoord is de
  // sterkste. Leeg, dus weggelaten, als geen driver dat leeswoord draagt.
  const gaspedaal = drivers.gerangschikt.filter((r) => r.leeswoord === "gaspedaal");
  if (gaspedaal.length > 0) {
    const construct = gaspedaal[0].construct;
    blokken.push({
      soort: "kader",
      opschrift: "WAT NOG STERKER KAN",
      kop: construct,
      kleur: KLEUR.oker,
      tekst: duidingVan(construct),
    });
  }

  // Onderdeel d: de vaste dankkaart, de enige niet-berekende tekst op dit
  // blad. De contactregel staat op een eigen lijn in de accentkleur.
  blokken.push({
    soort: "kaartvlak",
    opschrift: "MET DANK",
    kop: "Bedankt dat je dit met ons deelde",
    tekst: H_DANK_TEKST,
    contactregel: H_DANK_CONTACT,
  });

  return blokken;
}

// ── Onderdeel B3: het blad "Wat je hier zocht" ───────────────────────────
//
// Sluit de cirkel met B2: het letterlijke antwoord op P0 komt hier terug,
// samen met de twee sterkste talent-foci, de sterkste versneller en het
// sterkste interessegebied, uitsluitend uit de groep sterk aanwezig, op het
// aandeel (herstelronde 2, punt C). Nooit de suggestie wekken dat de vraag
// van de student hiermee beantwoord is.
const WAT_JE_HIER_ZOCHT_SLOT =
  "Dit rapport beantwoordt je eigen vraag niet rechtstreeks. Het legt ernaast wat uit je antwoorden " +
  "naar voren komt. Wat je daarmee doet, beslis jij.";

// Herstelronde 2, punt C: de twee talent-foci hier komen niet meer uit rang 1
// en 2 van de motor, maar uit de groep sterk aanwezig: de eerste twee rijen
// op aandeel binnen die groep (of, als sterk aanwezig leeg is, binnen het
// middenveld). Net als bij het blad "In een zin" geldt bij een gelijkspel op
// de tweede plaats dat er een zin bijkomt die zegt hoeveel er even sterk
// uitkwamen; die keuze staat verderop in het blok.
function topTweeUitGroep(dim: T4SDimensie): { rijen: T4SRij[]; aantalGelijkOpTweede: number; uitMiddenveld: boolean } {
  const groepen = groepeerOpAandeel(dim.gerangschikt);
  const sterk = groepen.find((g) => g.titel === "sterk aanwezig");
  const bron = sterk ?? groepen.find((g) => g.titel === "middenveld");
  if (!bron || bron.rijen.length === 0) return { rijen: [], aantalGelijkOpTweede: 0, uitMiddenveld: false };
  const rijen = bron.rijen.slice(0, 2);
  // Bij een gelijkspel op de tweede plaats (meer rijen delen het aandeel van
  // de op-een-na-hoogste rij dan er getoond worden), meldt de aanroeper dat.
  const tweedeAandeel = rijen.length >= 2 ? rijen[1].herkenning : null;
  const aantalGelijkOpTweede = tweedeAandeel == null ? 0 : bron.rijen.filter((r) => r.herkenning === tweedeAandeel).length;
  return { rijen, aantalGelijkOpTweede, uitMiddenveld: bron.titel === "middenveld" };
}

function watJeHierZochtBlokken(
  p0Tekst: string,
  foci: T4SDimensie,
  versnellers: T4SDimensie,
  interesse: T4SDimensie,
): T4SBlok[] {
  const blokken: T4SBlok[] = [
    {
      soort: "intro",
      tekst:
        "Helemaal aan het begin schreef je wat je hoopte dat deze vragenlijst duidelijk zou maken. " +
        "Hieronder staat dat nog eens, samen met wat je antwoorden het duidelijkst laten zien.",
    },
  ];
  if (p0Tekst.length > 0) {
    blokken.push({
      soort: "kader",
      opschrift: "JOUW VRAAG, NOG EENS",
      kop: "Wat jij hoopte te vinden",
      kleur: KLEUR.teal,
      tekst: p0Tekst,
    });
  }
  const topFoci = topTweeUitGroep(foci);
  const topVersneller = sterksteUitGroep(versnellers);
  const topInteresse = sterksteUitGroep(interesse);
  const punten: string[] = [];
  for (const r of topFoci.rijen) punten.push(`${r.construct}: ${r.omschrijving}`.trim());
  for (const r of topVersneller.constructen) punten.push(`${r.construct}: ${r.omschrijving}`.trim());
  for (const r of topInteresse.constructen) punten.push(`${r.construct}: ${r.omschrijving}`.trim());
  if (punten.length > 0) {
    blokken.push({ soort: "opsomming", kop: "Wat je antwoorden het duidelijkst laten zien", punten });
  }
  // Herstelronde 2, punt C: dezelfde twee gevallen als bij "In een zin".
  const uitMiddenveldOnderdelen: string[] = [];
  if (topFoci.uitMiddenveld) uitMiddenveldOnderdelen.push("je talent-foci");
  if (topVersneller.uitMiddenveld) uitMiddenveldOnderdelen.push("je talent-versnellers");
  if (topInteresse.uitMiddenveld) uitMiddenveldOnderdelen.push("je interesse");
  if (uitMiddenveldOnderdelen.length > 0) {
    blokken.push({
      soort: "alinea",
      tekst:
        `Bij ${uitMiddenveldOnderdelen.join(" en ")} kwam niets in dit beeld sterk uitkomen; ` +
        "hierboven staat daarom het hoogste aandeel uit het middenveld. Ook dat is een uitkomst.",
    });
  }
  if (topFoci.aantalGelijkOpTweede > 1) {
    blokken.push({
      soort: "alinea",
      tekst: `Op de tweede plaats bij je talent-foci kwamen ${TELWOORDEN[topFoci.aantalGelijkOpTweede] ?? topFoci.aantalGelijkOpTweede} onderdelen even sterk naar voren; hierboven staat er een van.`,
    });
  }
  if (topVersneller.aantalGelijk > 2) {
    blokken.push({
      soort: "alinea",
      tekst: `Bij je talent-versnellers kwamen ${TELWOORDEN[topVersneller.aantalGelijk] ?? topVersneller.aantalGelijk} onderdelen even sterk naar voren; hierboven staan er twee van.`,
    });
  }
  if (topInteresse.aantalGelijk > 2) {
    blokken.push({
      soort: "alinea",
      tekst: `Bij je interesse kwamen ${TELWOORDEN[topInteresse.aantalGelijk] ?? topInteresse.aantalGelijk} onderdelen even sterk naar voren; hierboven staan er twee van.`,
    });
  }
  blokken.push({ soort: "alinea", tekst: WAT_JE_HIER_ZOCHT_SLOT });
  return blokken;
}

// ── Onderdeel E: kaders voor wie meeleest ────────────────────────────────
//
// E1 staat als kader bij de drivers/motivatie, E2 is het slotblad. Beide
// eindigen op dezelfde drie gevallen als onderdeel F; kiezenGeval/kiezenSlotzin
// worden hier hergebruikt en niet opnieuw geschreven.
const E1_OPSCHRIFT = "VOOR WIE MEELEEST";
const E1_KOP = "Een patroon, geen oordeel";
const E1_TEKST =
  "Dit blad gaat over patronen, niet over goed of fout. Wie hier sterk uitkomt, heeft doorgaans geen " +
  "extra advies nodig, maar wel ruimte om zelf te wegen. De beste vraag die je kunt stellen: wat zou " +
  "jij kiezen als niemand meekeek.";

function e1Kader(resultaat: T4SResultaat, drivers: T4SDimensie): T4SBlok {
  const geval = kiezenGeval(resultaat, drivers);
  return {
    soort: "kader",
    opschrift: E1_OPSCHRIFT,
    kop: E1_KOP,
    kleur: KLEUR.oker,
    tekst: `${E1_TEKST} ${kiezenSlotzin(geval)}`,
  };
}

const E2_INTRO =
  "Dit rapport is bedoeld om samen te lezen: een student met een leerkracht, een begeleider of een " +
  "ouder. Hieronder staat hoe dat het beste lukt.";

function voorWieMeeleestSlotBlokken(): T4SBlok[] {
  return [
    { soort: "intro", tekst: E2_INTRO },
    {
      soort: "opsomming",
      kop: "Hoe je dit samen leest",
      punten: [
        "Laat de student eerst zelf zeggen wat klopt en wat niet.",
        "Lees pas daarna samen verder, blad per blad.",
      ],
    },
    {
      soort: "opsomming",
      kop: "Wat je er niet mee doet",
      punten: [
        "Geen studiekeuze afleiden uit dit rapport.",
        "Niet vergelijken met anderen: er is geen vergelijkingsgroep.",
      ],
    },
    {
      soort: "alinea",
      tekst: "Een goede eerste vraag: welk blad herkende je het meest, en welk blad verraste je.",
    },
  ];
}

// ── Onderdeel G: het blad "Waarop dit rapport gebouwd is" ─────────────────
//
// De meeste verwijzingen hieronder komen letterlijk uit
// bronnen-geverifieerd.md, veld "Volledige correcte verwijzing (APA)" en
// "Werkende URL", zoals besloten in bronnenbesluit.md. Niets is hier
// herschreven; alleen de sterretjes van de opmaak en de schuine strepen rond
// tijdschriftnamen zijn weggehaald, en er staan geen lange liggende
// streepjes in.
//
// DECI EN RYAN: INLINE VORM EN VOLLEDIGE VERWIJZINGEN, HERSTELD
// De inline vorm bij het motivatieblok is "Deci en Ryan (1985, 2000)", gelijk
// aan de oude rapportweg in server/t4students/rapport.ts. Daarom staan hier,
// naast de twee verwijzingen uit 2000 en de verwijzing uit 2020, ook de twee
// verwijzingen uit 1985 en 2017 die de oude weg al gebruikte. Beide jaartallen
// uit de inline vorm (1985 en 2000) hebben zo een volledige verwijzing hier;
// 2017 hoort bij hetzelfde boek als 1985 en staat er bewust naast, zoals in
// de oude weg. Herstelronde, punt 2.
//
// De verwijzing Ryan en Deci (2000, American Psychologist) staat hier met een
// komma na "R. M.", letterlijk zoals in de oude rapportweg, in plaats van
// zonder komma zoals in bronnen-geverifieerd.md. De feiten (titel, tijdschrift,
// deel, bladzijden, DOI) zijn ongewijzigd en blijven de geverifieerde feiten;
// alleen de komma is aangepast zodat beide rapportwegen precies dezelfde
// tekst tonen, wat de opdracht voor deze herstelronde uitdrukkelijk vraagt.
const G_INTRO =
  "Dit rapport is geen test met goede of foute antwoorden. Het geeft geordend weer wat jij over " +
  "jezelf hebt aangegeven. De onderdelen die het meet en de manier waarop het erover schrijft, " +
  "steunen op bestaand wetenschappelijk werk. Hieronder staat waarop.";

const G_SLOT =
  "Tot slot. Dit is een oriënterend zelfbeeld. Het is geen diagnose, geen selectie-instrument en het " +
  "voorspelt niet hoe een studie zal verlopen. Er is geen vergelijkingsgroep, dus alles wat hier staat " +
  "gaat over jou en niet over hoe jij het doet in vergelijking met anderen. Jij kiest, in je eigen " +
  "tempo. Gebruik dit als startpunt voor een gesprek.";

const G_CONSTRUCTEN_EN_INHOUD: string[] = [
  "Holland, J. L. (1997). Making vocational choices: A theory of vocational personalities and work " +
    "environments (3de druk). Psychological Assessment Resources. https://doi.org/10.1037/10791-000",
  "Nauta, M. M. (2010). The development, evolution, and status of Holland's theory of vocational " +
    "personalities: Reflections and future directions for counseling psychology. Journal of Counseling " +
    "Psychology, 57(1), 11 tot 22. https://doi.org/10.1037/a0018213",
  "Deci, E. L., en Ryan, R. M. (1985). Intrinsic Motivation and Self-Determination in Human Behavior. New York: Plenum Press.",
  "Deci, E. L. en Ryan, R. M. (2000). The \"what\" and \"why\" of goal pursuits: Human needs and " +
    "the self-determination of behavior. Psychological Inquiry, 11(4), 227 tot 268. " +
    "https://doi.org/10.1207/S15327965PLI1104_01",
  "Ryan, R. M., en Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic " +
    "motivation, social development, and well-being. American Psychologist, 55(1), 68 tot 78. " +
    "https://doi.org/10.1037/0003-066X.55.1.68",
  "Ryan, R. M., en Deci, E. L. (2017). Self-Determination Theory: Basic Psychological Needs in Motivation, Development, and Wellness. New York: Guilford Press.",
  "Ryan, R. M. en Deci, E. L. (2020). Intrinsic and extrinsic motivation from a self-determination " +
    "theory perspective: Definitions, theory, practices, and future directions. Contemporary " +
    "Educational Psychology, 61, artikel 101860. https://doi.org/10.1016/j.cedpsych.2020.101860",
  "Csikszentmihalyi, M. (1990). Flow: The psychology of optimal experience. Harper & Row. " +
    "https://www.harpercollins.com/products/flow-mihaly-csikszentmihalyi",
  "Bakker, A. B. en Demerouti, E. (2017). Job demands-resources theory: Taking stock and looking " +
    "forward. Journal of Occupational Health Psychology, 22(3), 273 tot 285. " +
    "https://doi.org/10.1037/ocp0000056",
  "Kahler, T. (1975). Drivers: The key to the process of scripts. Transactional Analysis Journal, " +
    "5(3), 280 tot 284. https://doi.org/10.1177/036215377500500318",
];

const G_SCOREBELEID: string[] = [
  "American Educational Research Association, American Psychological Association en National " +
    "Council on Measurement in Education. (2014). Standards for educational and psychological " +
    "testing. American Educational Research Association. " +
    "https://www.testingstandards.net/uploads/7/6/6/4/76643089/standards_2014edition.pdf",
  "International Test Commission. (2013). ITC guidelines on test use (versie 1.2). " +
    "www.intestcom.org. https://www.intestcom.org/files/guideline_test_use.pdf",
];

const G_RAPPORTONTWERP: string[] = [
  "Nielsen Norman Group. (z.d.). Designing for young adults (ages 18 tot 25) (3de editie). " +
    "https://www.nngroup.com/reports/designing-for-young-adults/",
  "World Wide Web Consortium. (2018). Web content accessibility guidelines (WCAG) 2.1. " +
    "https://www.w3.org/TR/WCAG21/",
];

const G_GRENZEN: string[] = [
  "Europees Parlement en Raad van de Europese Unie. (2016). Verordening (EU) 2016/679 van het " +
    "Europees Parlement en de Raad van 27 april 2016 betreffende de bescherming van natuurlijke " +
    "personen in verband met de verwerking van persoonsgegevens en betreffende het vrije verkeer van " +
    "die gegevens en tot intrekking van Richtlijn 95/46/EG (algemene verordening gegevensbescherming), " +
    "artikel 22. Publicatieblad van de Europese Unie, L 119, 1 tot 88. " +
    "https://eur-lex.europa.eu/legal-content/NL/TXT/HTML/?uri=CELEX:02016R0679-20160504",
  "Colonna, L. (2024). Teachers in the loop? An analysis of automatic assessment systems under " +
    "Article 22 GDPR. International Data Privacy Law, 14(1), 3 tot 18. " +
    "https://doi.org/10.1093/idpl/ipad024",
];

function waaropGebouwdBlokken(): T4SBlok[] {
  return [
    { soort: "intro", tekst: G_INTRO },
    { soort: "tussenkop", tekst: "Constructen en inhoud" },
    { soort: "opsomming", kop: null, punten: G_CONSTRUCTEN_EN_INHOUD },
    { soort: "tussenkop", tekst: "Scorebeleid en verantwoord gebruik" },
    { soort: "opsomming", kop: null, punten: G_SCOREBELEID },
    { soort: "tussenkop", tekst: "Rapportontwerp" },
    { soort: "opsomming", kop: null, punten: G_RAPPORTONTWERP },
    { soort: "tussenkop", tekst: "Grenzen aan geautomatiseerde besluitvorming" },
    { soort: "opsomming", kop: null, punten: G_GRENZEN },
    { soort: "alinea", tekst: G_SLOT },
  ];
}

/**
 * De blokken van de pagina "Wat je motiveert om te studeren". Leest
 * uitsluitend resultaat.motivatie (balansLabel, intrinsiek, extrinsiek) en
 * rekent nergens zelf een oordeel uit.
 */
function motivatieBlokken(resultaat: T4SResultaat): T4SBlok[] {
  const { intrinsiek, extrinsiek, balansLabel } = resultaat.motivatie;
  const duiding = MOTIVATIE_DUIDING[balansLabel] ?? MOTIVATIE_DUIDING.evenwichtig;
  return [
    {
      soort: "intro",
      tekst:
        "Naast je talent en je drivers meet dit studiekompas ook wat je motiveert om te studeren: wat je " +
        "van binnenuit in beweging brengt, en wat er van buitenaf bij komt. Dit onderdeel staat los van de " +
        "drivers hiervoor: het gaat niet over hoe je onder druk reageert, maar over waar je energie om te " +
        "studeren vandaan komt.",
    },
    {
      soort: "alinea",
      tekst:
        "Volgens de zelfdeterminatietheorie van Deci en Ryan (1985, 2000) komt motivatie uit twee soorten " +
        "bronnen. Intrinsiek wil zeggen dat de motivatie van binnenuit komt: uit autonomie (zelf kunnen " +
        "kiezen), competentie (voelen dat je bijleert) en verbondenheid (je verbonden voelen met anderen). " +
        "Extrinsiek wil zeggen dat de motivatie van buitenaf komt: uit erkenning (waardering, punten, " +
        "prijzen) en verwachtingen (wat je omgeving van je vraagt).",
    },
    {
      soort: "paren",
      paren: [
        { label: "Intrinsiek", waarde: getal1(intrinsiek) },
        { label: "Extrinsiek", waarde: getal1(extrinsiek) },
        { label: "Jouw balans", waarde: balansLabel },
      ],
    },
    { soort: "alinea", tekst: duiding },
    {
      soort: "alinea",
      tekst:
        "De grens tussen de twee kanten ligt in dit studiekompas op 0,5 op de schaal van 0 tot 3. Dat is " +
        "een gekozen conventie om een duidelijk label te kunnen tonen, geen grens die op afnamegegevens is " +
        "geijkt. De getallen hierboven zeggen meer dan het label alleen.",
    },
  ];
}

export function bouwT4StudentsRapport(
  inst: T4SInstrument,
  resultaat: T4SResultaat,
  antwoorden: T4SAntwoorden,
  licentie: T4SLicentie,
  opties: { naam: string; code: string; datum: string; instrumentVersie: string },
): T4SRapport {
  const taal = resultaat.taal;
  const items = itemIndex(inst);
  const meldingen: string[] = [];

  const foci = rangschik(inst, resultaat, antwoorden, FAM_FOCI);
  const versnellers = rangschik(inst, resultaat, antwoorden, FAM_VERSNELLERS);
  const drivers = rangschik(inst, resultaat, antwoorden, FAM_DRIVERS);
  const interesse = rangschik(inst, resultaat, antwoorden, FAM_INTERESSE);
  const beeld = rangschik(inst, resultaat, antwoorden, FAM_BEELD);

  // De volgorde van de rapportlaag naast die van de motor leggen. Verschilt ze,
  // dan moet dat gemeld worden en niet weggemoffeld. Sinds herstelronde 2,
  // punt B toont het rapport geen genummerde rangorde meer aan de student,
  // maar de motor rangschikt intern nog altijd op aandeel (kompas-scoring.ts)
  // en die volgorde moet nog steeds gelijklopen met de rapportlaag: anders
  // klopt de indeling in groepen (sterk aanwezig / middenveld / minder
  // aanwezig) niet met wat de motor als voorlopig oordeel meegeeft.
  const vergelijk = (eigen: T4SDimensie, motor: string[], naam: string) => {
    const mijn = eigen.gerangschikt.map((r) => r.construct);
    const hunne = motor.filter((c) => mijn.includes(c));
    if (mijn.join("|") !== hunne.join("|")) {
      meldingen.push(
        `De volgorde van ${naam} op papier wijkt af van die van de motor. Papier: ${mijn.join(", ")}. ` +
          `Motor: ${hunne.join(", ")}. Oorzaak is het schalen van de herkenning naar 0 tot 3.`,
      );
    }
  };
  vergelijk(foci, resultaat.foci.sorted, FAM_FOCI);
  vergelijk(versnellers, resultaat.versnellers.rangorde, FAM_VERSNELLERS);
  vergelijk(drivers, resultaat.drivers.sorted, FAM_DRIVERS);

  const paginas: T4SPagina[] = [];

  // ── 1. Cover ──────────────────────────────────────────────────────────────
  paginas.push(
    pagina(
      1,
      [
        { soort: "alinea", tekst: "Een persoonlijk beeld van wie je bent en wat bij je past." },
        {
          soort: "paren",
          paren: [
            { label: "DEELNEMER", waarde: opties.naam },
            { label: "REFERENTIE", waarde: opties.code },
            { label: "DATUM", waarde: opties.datum },
          ],
        },
        { soort: "alinea", tekst: COVER_SLOTREGEL },
      ],
      "T4STUDENTS · PERSOONLIJK STUDIEKOMPAS",
    ),
  );

  // ── 2. Hoe je dit rapport leest ───────────────────────────────────────────
  paginas.push(
    pagina(
      2,
      [
        {
          soort: "intro",
          tekst:
            "Dit rapport gaat over jou en het is gemaakt uit je eigen antwoorden. Voor je begint, " +
            "drie dingen die het hele rapport leesbaar maken.",
        },
        { soort: "tussenkop", tekst: "1. Herkenning en energie zijn twee verschillende dingen" },
        {
          soort: "alinea",
          tekst:
            "Herkenning is hoeveel je jezelf in iets terugvindt. Energie is of iets je oplaadt of " +
            "leegtrekt. Die twee hangen niet aan elkaar vast: je kunt jezelf sterk herkennen in iets " +
            "dat je veel energie kost, en je kunt weinig van jezelf terugvinden in iets waar je toch " +
            "vrolijk van wordt. Daarom staan ze in dit rapport altijd apart, en altijd in een andere " +
            "vorm.",
        },
        {
          soort: "kader",
          opschrift: "DE TWEE VORMEN",
          kop: "Herkenning en energie naast elkaar",
          kleur: KLEUR.teal,
          tekst:
            "Herkenning is een rijtje van drie blokjes dat van links naar rechts volloopt. Nul blokjes " +
            "is Niet ik, drie blokjes is Helemaal ik. Energie is een balkje dat in het midden begint: " +
            "naar rechts betekent dat het je energie geeft, naar links dat het je energie kost.",
        },
        { soort: "tussenkop", tekst: "2. Wat de groepen betekenen" },
        {
          soort: "alinea",
          tekst:
            "Bij elk onderdeel staan de constructen in een van drie groepen: sterk aanwezig, " +
            "middenveld of minder aanwezig. Sterk aanwezig is niet beter dan minder aanwezig. Het " +
            "betekent alleen: hier herken je jezelf het sterkst. Een plaats in het middenveld of " +
            "minder aanwezig is geen tekort en geen zwakte. Ze zegt waar op dit moment minder van jou " +
            "in zit.",
        },
        { soort: "tussenkop", tekst: "3. Waar de cijfers vandaan komen" },
        {
          soort: "alinea",
          tekst:
            "Alles in dit rapport komt uit je eigen antwoorden. Achteraan staan die antwoorden " +
            "letterlijk, per vraag, met wat jij hebt aangeklikt. Wat je daar niet terugvindt, staat " +
            "ook nergens anders in dit rapport.",
        },
        {
          soort: "alinea",
          tekst:
            "Is er binnen een onderdeel iets niet ingevuld, dan krijgt dat onderdeel geen score en " +
            "geen groep. Er wordt niets ingeschat en niets gemiddeld. Er staat dan Te weinig " +
            "antwoorden.",
        },
      ],
      "Drie dingen die je nodig hebt om de rest te begrijpen.",
    ),
  );

  // ── 3. Dit hoopte je te vinden (onderdeel B2) ─────────────────────────────
  // Het letterlijke antwoord op de open beginvraag P0, in een kader. P0 is
  // niet verplicht: is ze niet beantwoord of enkel met witruimte beantwoord,
  // dan komt het kader nergens op dit blad. Het blad zelf blijft bestaan; er
  // wordt nooit een leeg kader getoond.
  const p0Tekst = (antwoorden["P0"] as { text?: string } | undefined)?.text?.trim() || "";
  const hoopteBlokken: T4SBlok[] = [
    {
      soort: "intro",
      tekst:
        "Voor je de eerste vraag beantwoordde, vroegen we je wat je hoopte dat deze vragenlijst voor " +
        "jou duidelijk of duidelijker kon maken. Dat antwoord staat hieronder, letterlijk zoals jij " +
        "het schreef.",
    },
  ];
  if (p0Tekst.length > 0) {
    hoopteBlokken.push({
      soort: "kader",
      opschrift: "DIT HOOPTE JE TE VINDEN",
      kop: "Jouw eigen woorden",
      kleur: KLEUR.teal,
      tekst: p0Tekst,
    });
  }
  paginas.push(
    pagina(3, hoopteBlokken, "Jouw eigen vraag, voor je aan de vragenlijst begon."),
  );

  // ── 4. De one-page, in drie blokken, één per laag ───────────────────────────
  // Opmaakherstel (2026-08-03), punt 1: dit was oorspronkelijk één blok van
  // het soort "banden" met alle drie de lagen samen. Dat ene blok werd met de
  // groepsindeling 836 punten hoog, hoger dan een blad, waardoor het
  // bouwscript het op een eigen blad zette en het daarna regel per regel liet
  // doorlopen over de volgende bladen: acht bladen met maar één losse regel
  // en zonder kop, voettekst of bladnummer, en een leeg slotblad.
  //
  // De oplossing is dit ene blok te splitsen in drie afzonderlijke blokken,
  // één per laag (Talent-foci, Talent-versnellers, Drivers). Elk van de drie
  // is, gemeten met dezelfde groepeer-logica, ruim onder de beschikbare
  // hoogte van een blad, dus de opmaak breekt voortaan netjes tussen twee
  // lagen in plaats van middenin een lijst. Blijft een laag ooit zelf nog te
  // hoog (bijvoorbeeld door een toekomstige uitbreiding), dan geldt de
  // gewone regel van het bouwscript: dat blok krijgt zijn eigen melding en
  // wordt nooit binnen een groep of tussen een naam en zijn rij doorgesneden,
  // want een "banden"-blok wordt altijd in zijn geheel getekend.
  //
  // De vaste uitlegtekst over de drie groepen (GROEP_UITLEG) en de legende
  // staan één keer, bij het eerste blok (Talent-foci), niet bij elk van de
  // drie herhaald. Elke laag krijgt wel zijn eigen "nog niet alles
  // ingevuld"-zin als dat voor die laag geldt, in plaats van één gezamenlijke
  // zin voor alle drie samen: zo blijft de melding bij de laag waarover ze
  // gaat, ook al staat die laag straks op een ander blad dan de andere twee.
  function nietIngevuldZin(dim: T4SDimensie): string[] {
    const namen = dim.zonderOordeel.map((r) => r.construct);
    if (namen.length === 0) return [];
    return [
      `Van ${lijst(namen)} is nog niet alles ingevuld. Daarom staat er geen score bij en geen groep. ` +
        `Zodra je die vragen beantwoordt, ${staan(namen.length)} ${namen.length === 1 ? "dat onderdeel" : "die onderdelen"} ` +
        `er vanzelf bij.`,
    ];
  }
  paginas.push(
    pagina(
      4,
      [
        { soort: "intro", tekst: ONEPAGE_INTRO },
        {
          soort: "banden",
          banden: [bandVan(foci, 1, "TALENT-FOCI", "waarin je je talent inzet", BAND_NOOT_FOCI)],
          legende: ONEPAGE_LEGENDE,
          naschrift: [GROEP_UITLEG, ...nietIngevuldZin(foci)],
        },
        {
          soort: "banden",
          banden: [bandVan(versnellers, 2, "TALENT-VERSNELLERS", "hoe je het doet", null)],
          legende: [],
          naschrift: nietIngevuldZin(versnellers),
        },
        {
          soort: "banden",
          banden: [bandVan(drivers, 3, "DRIVERS", "wat je aandrijft", null)],
          legende: [],
          naschrift: nietIngevuldZin(drivers),
        },
      ],
      ONEPAGE_ONDERTITEL,
    ),
  );

  // ── 5. Hoe scherp is dit beeld ────────────────────────────────────────────
  const bt = resultaat.betrouwbaarheid;
  const p1 = citaatVanItem(inst, antwoorden, "P1", taal);
  paginas.push(
    pagina(
      5,
      [
        {
          soort: "intro",
          tekst:
            "Voor je verder leest: hoeveel heb je ingevuld, en hoe stevig is de uitkomst daardoor. " +
            "Dat staat hier vooraan en niet achteraan, zodat je de rest met de juiste maat leest.",
        },
        {
          soort: "paren",
          paren: [
            { label: "Vragen beantwoord", waarde: `${bt.beantwoord} van ${bt.totaalItems}` },
            { label: "Totaal signaal", waarde: `${bt.totaalSignaal} (drempel ${bt.voorlopigDrempel})` },
            { label: "Beeld", waarde: bt.voorlopig ? "voorlopig" : "voldoende ingevuld" },
            ...(p1 ? [{ label: "Waar je nu staat", waarde: p1.herkenning || "" }] : []),
          ],
        },
        {
          soort: "alinea",
          tekst: bt.voorlopig
            ? "Er is te weinig ingevuld om een stabiel beeld te geven. Wat hier staat klopt met wat je " +
              "hebt geantwoord, maar het is nog geen afgerond beeld. Vul de ontbrekende vragen aan en " +
              "het beeld wordt scherper."
            : "Je hebt genoeg ingevuld om een stabiel beeld te geven. Dat betekent niet dat dit rapport " +
              "het laatste woord heeft. Het betekent dat wat erin staat, stevig genoeg staat om over " +
              "te praten.",
        },
        {
          // De naam van de dimensie staat in de punt zelf en niet in een
          // kaderlabel, want die labels worden in kapitalen gezet en dan staat
          // TaPas-BEELD hier anders geschreven dan overal elders in het rapport.
          soort: "opsomming",
          kop: "Wat je per dimensie hebt ingevuld",
          punten: beantwoordPerFamilie(inst, antwoorden).map(
            (d) => `${d.familie}: ${d.beantwoord} van ${d.totaal} vragen`,
          ),
        },
        {
          soort: "alinea",
          tekst:
            "Een dimensie waar minder is ingevuld, draagt ook minder ver. Waar er te weinig " +
            "antwoorden zijn om iets te kunnen zeggen, staat dat er met zoveel woorden bij en " +
            "wordt er geen getal ingevuld dat er niet is.",
        },
        {
          soort: "alinea",
          tekst:
            "Wat dit blad niet zegt: hoe jij je verhoudt tot anderen. Er is voor dit instrument geen " +
            "vergelijkingsgroep. Alles wat hier staat, gaat over jou en over niemand anders.",
        },
      ],
      "Hoeveel is er ingevuld, en wat betekent dat.",
    ),
  );

  // ── 6. Jouw beeld van jezelf ──────────────────────────────────────────────
  const beeldCitaten = citatenVoor(inst, antwoorden, taal, ["BE1", "BE2"]);
  paginas.push(
    pagina(
      6,
      [
        {
          soort: "intro",
          tekst:
            "TaPas-BEELD gaat niet over wat je kunt, maar over hoe helder je eigen beeld op dit moment " +
            "is. Daarom staat het niet bij de drie lagen op het blad Jouw talentmotor in één oogopslag, " +
            "maar hier apart.",
        },
        {
          soort: "rangtabel",
          kleur: beeld.kleur,
          rijen: beeld.rijen,
          naschrift: [GROEP_UITLEG],
        },
        {
          soort: "alinea",
          tekst:
            "Een helder beeld maakt de rest van dit rapport makkelijker te plaatsen. Een minder helder " +
            "beeld is geen tekort. Op jouw leeftijd is het eerder de normale stand van zaken, en het " +
            "is precies de reden waarom je dit invult.",
        },
        ...(beeldCitaten.length > 0
          ? ([
              {
                soort: "citaat",
                opschrift: "DIT GAF JE ZELF AAN",
                kop: "Jouw eigen woorden",
                kleur: KLEUR.inktZacht,
                regels: beeldCitaten,
              },
            ] as T4SBlok[])
          : []),
      ],
      "Hoe helder je eigen beeld vandaag is.",
    ),
  );

  // ── 7. Jouw energie vandaag ───────────────────────────────────────────────
  // energie.bronnen en energie.lekken dragen constructnamen, geen item-id's.
  // Alleen de drie families die het rapport rangschikt komen hier op papier;
  // TaPas-BEELD wordt apart gelezen en zou zichzelf anders nog eens herhalen.
  const drieFamilies = new Set(
    inst.families.filter((f) => [FAM_FOCI, FAM_VERSNELLERS, FAM_DRIVERS].includes(f.id)).flatMap((f) => f.constructs),
  );
  const bronnen = resultaat.energie.bronnen.filter((c) => drieFamilies.has(c));
  const lekken = resultaat.energie.lekken.filter((c) => drieFamilies.has(c));
  paginas.push(
    pagina(
      7,
      [
        {
          soort: "intro",
          tekst:
            "Dit is de enige pagina die over vandaag gaat en niet over een patroon. Je energie " +
            "schommelt van dag tot dag. Wat hier staat, is een momentopname.",
        },
        { soort: "batterij", waarde: resultaat.energie.ijkpunt0tot10, zin: batterijZin(resultaat.energie.ijkpunt0tot10) },
        {
          soort: "opsomming",
          kop: "Wat je volgens je eigen antwoorden oplaadt",
          punten:
            bronnen.length > 0
              ? bronnen
              : ["Je gaf bij geen enkel onderdeel aan dat het je energie geeft."],
        },
        {
          soort: "opsomming",
          kop: "Wat je volgens je eigen antwoorden leegtrekt",
          punten:
            lekken.length > 0
              ? lekken
              : ["Je gaf bij geen enkel onderdeel aan dat het je energie kost."],
        },
        {
          soort: "alinea",
          tekst:
            "Er is maar één meetmoment, dus er valt niets te zeggen over hoe dit zich verhoudt tot vorige " +
            "week of vorig jaar. Wat je hier ziet, is hoe het er nu voor staat.",
        },
      ],
      "Hoe vol je batterij vandaag zit, en wat hem vult.",
    ),
  );

  // ── 7 tot 15: de drie dimensies, telkens dezelfde driedeling ──────────────
  const dimensieBladen: {
    dim: T4SDimensie;
    opener: number;
    top: number;
    laag: number;
    wat: string;
    openerTekst: string[];
    topOndertitel: string;
    laagOndertitel: string;
    citaatKop: string;
  }[] = [
    {
      dim: foci,
      opener: 8,
      top: 9,
      laag: 10,
      wat: FAM_FOCI,
      openerTekst: [
        "Een talent-focus zegt waarin je je talent inzet: het soort werk dat je met weinig moeite af " +
          "krijgt en waarin je resultaat haalt zonder jezelf te moeten forceren. Het gaat niet over " +
          "wat je leuk vindt maar over wat je kunt, en over hoe moeiteloos dat gaat.",
        "Hieronder staan alle zes op volgorde van herkenning, met de energie ernaast. Op de bladen " +
          "hierna lees je wat de sterkste betekenen.",
      ],
      topOndertitel: "Waar je vermogen het duidelijkst zichtbaar is.",
      laagOndertitel: "Wat je minst kenmerkt, als nuance.",
      citaatKop: "DIT GAF JE ZELF AAN",
    },
    {
      dim: versnellers,
      opener: 11,
      top: 12,
      laag: 13,
      wat: FAM_VERSNELLERS,
      openerTekst: [
        "Een talent-versneller zegt hoe je het doet. Niet aan welk soort werk je vermogen zichtbaar " +
          "wordt, maar op welke manier je te werk gaat en waar dat je weinig moeite kost.",
        "Alle zes staan hieronder op volgorde van herkenning. Bij dit onderdeel is bij elk construct " +
          "ook naar energie gevraagd, dus de rechterkolom is hier volledig.",
      ],
      topOndertitel: "De manier van werken die jou het minst moeite kost.",
      laagOndertitel: "Manieren van werken die minder vanzelf gaan.",
      citaatKop: "DIT GAF JE ZELF AAN",
    },
    {
      dim: drivers,
      opener: 14,
      top: 15,
      laag: 16,
      wat: FAM_DRIVERS,
      openerTekst: [
        "Een driver is een aangeleerd patroon dat je gedrag stuurt, vooral onder druk. Het begrip komt " +
          "van Taibi Kahler. Het woord driver blijft in het Nederlands staan, omdat er geen vertaling " +
          "is die hetzelfde zegt.",
        "Een driver is niet goed en niet slecht. Soms werkt hij als gaspedaal: hij geeft je richting en " +
          "vaart. Soms werkt hij als rem: hij houdt je tegen op het moment dat je juist door wilt.",
      ],
      topOndertitel: "Welke patronen jou sturen, en wanneer.",
      laagOndertitel: "Wat er gebeurt als een driver te hard duwt.",
      citaatKop: "DIT GAF JE ZELF AAN",
    },
  ];

  for (const b of dimensieBladen) {
    // Groepen doortrekken naar de uitgewerkte bladen: de twee hoofdstukken
    // hieronder werkten voorheen een vast aantal van drie onderdelen uit
    // (rijen.slice(0, 3) en rijen.slice(-3)), terwijl de rest van het
    // rapport (het overzicht op "Jouw talentmotor in één oogopslag" en de
    // rangtabel hierboven) al op groepen werkt. Daardoor kon een onderdeel
    // op het overzicht bij "sterk aanwezig" staan en toch in het hoofdstuk
    // "wat lager staat" terechtkomen: een tegenspraak voor de lezer. De
    // twee hoofdstukken volgen daarom nu dezelfde groepen als de rest van
    // het rapport: "wat sterk aanwezig is" krijgt alle leden van de groep
    // sterk aanwezig (niet vast drie), "wat lager staat" krijgt middenveld
    // en minder aanwezig samen, in die volgorde. Elk onderdeel met een
    // oordeel komt zo in precies één van de twee hoofdstukken terecht.
    // Zie splitsSterkEnLager() in rapport-contract.ts voor de eigen tests
    // van deze verdeling.
    const { sterk: groepSterk, lager: groepLager } = splitsSterkEnLager(b.dim);
    // Herstelronde 2, punt B: "plaats in de rangorde" bestaat niet meer. Een
    // niet-ingevuld construct krijgt geen score en dus ook geen groep.
    const naschriftDim = [
      GROEP_UITLEG,
      ...b.dim.zonderOordeel.map(
        (r) => `Van ${r.construct} is nog niet alles ingevuld. Daarom staat er geen score bij en geen groep.`,
      ),
    ];

    // Opener met de volledige tabel.
    paginas.push(
      pagina(
        b.opener,
        [
          ...b.openerTekst.map((tk) => ({ soort: "alinea", tekst: tk }) as T4SBlok),
          { soort: "rangtabel", kleur: b.dim.kleur, rijen: b.dim.rijen, naschrift: naschriftDim },
        ],
        b.wat === FAM_DRIVERS ? "Patronen die je aansturen, vooral onder druk." : "Alle zes op volgorde, met energie ernaast.",
      ),
    );

    // Wat sterk aanwezig is, met een citaatblok bij de sterkste.
    // (opmaakherstel, punt 4: deze pagina heette vroeger "jouw drie
    // sterkste"; groepen doortrekken: de gekozen constructen zijn nu alle
    // leden van de groep sterk aanwezig, niet meer vast drie.)
    const topBlokken: T4SBlok[] = [
      {
        soort: "intro",
        tekst:
          groepSterk.length === 0
            ? (b.wat === FAM_DRIVERS
                ? "Bij dit onderdeel komt geen enkel patroon sterk naar voren. Ook dat is een uitkomst: geen " +
                  "patroon dat je op dit moment sterk stuurt."
                : "Bij dit onderdeel komt niets in dit beeld sterk uitkomen. Ook dat is een uitkomst: je " +
                  "vermogen zit dan vooral ergens anders in dit rapport.")
            : b.wat === FAM_DRIVERS
              ? "Hieronder de patronen die jij het sterkst herkent, met wat elk patroon je geeft en waar " +
                "het je in de weg kan zitten."
              : "Hieronder de onderdelen waarin je jezelf het sterkst herkent, met wat je daarmee kunt en " +
                "wat dat voor studeren betekent.",
      },
    ];
    for (let i = 0; i < groepSterk.length; i++) {
      const r = groepSterk[i];
      topBlokken.push({
        soort: "constructblok",
        construct: r.construct,
        omschrijving: r.omschrijving,
        rang: r.rang,
        herkenning: r.herkenning,
        weergavePrecisie: r.weergavePrecisie,
        energie: r.energie,
        ingevuld: r.ingevuld,
        kleur: b.dim.kleur,
        duiding: duidingVan(r.construct),
      });
      // Het citaatblok bij de sterkste komt meteen na diens eigen
      // constructblok, niet pas na alle andere. Zo blijft het citaat
      // inhoudelijk bij het onderdeel waarover het gaat, en voorkomt het dat
      // een groter aantal onderdelen (groepen doortrekken: de groep sterk
      // aanwezig kan meer dan drie leden hebben) het citaat alleen achterlaat
      // op een vervolgblad met verder niets erop.
      if (i === 0) {
        const itemId = zwaarsteItemVan(inst, r.construct);
        const regels = itemId ? citatenVoor(inst, antwoorden, taal, [itemId]) : [];
        if (regels.length > 0) {
          topBlokken.push({
            soort: "citaat",
            opschrift: b.citaatKop,
            kop: "Jouw eigen woorden",
            kleur: b.dim.kleur,
            regels,
          });
        }
      }
    }
    // Onderdeel E1: het kader "voor wie meeleest" hoort bij de drivers, waar
    // het gaat over gedragspatronen en niet over vermogen. Dit kader staat
    // los van een specifiek construct en blijft daarom achteraan.
    if (b.wat === FAM_DRIVERS) {
      topBlokken.push(e1Kader(resultaat, drivers));
    }
    paginas.push(pagina(b.top, topBlokken, b.topOndertitel));

    // Wat lager staat: middenveld en minder aanwezig samen, in die volgorde.
    // Is de groep sterk aanwezig zo groot dat alle onderdelen erin zitten,
    // dan is groepLager leeg en blijft dit hoofdstuk hieronder ongebruikt: het
    // valt dan weg uit het rapport, zonder opmerking (zie de opdracht).
    if (groepLager.length > 0) {
      const laagBlokken: T4SBlok[] = [
        {
          soort: "intro",
          tekst:
            b.wat === FAM_DRIVERS
              ? "Een driver die je nauwelijks herkent, is geen gebrek. Het betekent dat dit patroon je " +
                "minder stuurt. Hieronder staat wat de sterkste driver doet als hij te hard duwt, en wat " +
                "de zwakst herkende patronen over je zeggen."
              : "Laag betekent hier niet zwak. Het betekent dat dit minder van jou is dan de rest. Je " +
                "vermogen zit ergens anders, en dat is precies wat de indeling in groepen laat zien.",
        },
      ];
      for (const r of groepLager) {
        laagBlokken.push({
          soort: "constructblok",
          construct: r.construct,
          omschrijving: r.omschrijving,
          rang: r.rang,
          herkenning: r.herkenning,
          weergavePrecisie: r.weergavePrecisie,
          energie: r.energie,
          ingevuld: r.ingevuld,
          kleur: b.dim.kleur,
          duiding: duidingVan(r.construct),
        });
      }
      paginas.push(pagina(b.laag, laagBlokken, b.laagOndertitel));
    }
  }

  // ── 17. Wat je motiveert om te studeren ───────────────────────────────────
  // Het oordeel komt uitsluitend uit de motor: balansLabel, intrinsiek en
  // extrinsiek worden hier alleen gelezen en getoond, nooit herberekend. Zie
  // tests/t4students-oordeel-komt-uit-de-motor.test.ts en
  // tests/t4students-motivatieblok-in-studiekompas.test.ts.
  // Motivatie is een eigen laag en heeft geen koppeling met de drivers, ook al
  // gaat het bij allebei over wat iemand aanstuurt.
  paginas.push(pagina(17, motivatieBlokken(resultaat), "Wat je in beweging brengt om te leren."));

  // ── 18. Waarom kiezen makkelijk of moeilijk kan voelen (onderdeel F) ───────
  // Meteen na het motivatieblok, zoals de opdracht vraagt. Twee gemeten
  // onderdelen naast elkaar, nooit uit elkaar afgeleid: zie kiezenBlokken().
  paginas.push(
    pagina(18, kiezenBlokken(resultaat, drivers), "Twee metingen naast elkaar, niet uit elkaar afgeleid."),
  );

  // ── 19. Hoe jij het beste leert ───────────────────────────────────────────
  const ss = resultaat.studiestrategie;
  const s1 = citaatVanItem(inst, antwoorden, "S1", taal);
  const leerPunten: string[] = [];
  if (ss.primair) {
    leerPunten.push(`Werk ${ss.primair.strategie}: ${ss.primair.belofte}.`);
  }
  if (ss.secundair) {
    leerPunten.push(`Loopt dat vast, val dan terug op ${ss.secundair.strategie}: ${ss.secundair.belofte}.`);
  }
  if (foci.gerangschikt.length > 0) {
    leerPunten.push(
      `Zoek bij een nieuwe opdracht eerst het stuk op waarin ${foci.gerangschikt[0].construct} aan bod ` +
        `komt en begin daar. Dat kost je het minst en het brengt de rest op gang.`,
    );
  }
  leerPunten.push(
    "Plan de onderdelen die je energie kosten kort en vroeg op de dag, en zet er iets achter dat je " +
      "energie geeft.",
  );
  paginas.push(
    pagina(
      19,
      [
        {
          soort: "intro",
          tekst:
            "Wat je kunt en hoe moeiteloos dat gaat, vertaalt zich naar hoe je het beste studeert. " +
            "Hieronder staat wat er uit jouw antwoorden volgt. Geen algemene studietips maar de " +
            "aanpak die bij jouw manier van werken past.",
        },
        { soort: "opsomming", kop: null, punten: leerPunten },
        ...(s1
          ? ([
              {
                soort: "citaat",
                opschrift: "DIT KOOS JE",
                kop: "Jouw eigen keuze",
                kleur: KLEUR.salie,
                regels: [s1],
              },
            ] as T4SBlok[])
          : []),
        {
          soort: "alinea",
          tekst:
            "Dit rapport weet niet welke richting je volgt of overweegt. Het advies is dus algemeen van " +
            "vorm en persoonlijk van inhoud. Wat er staat, past bij jou; waar je het op toepast, kies " +
            "je zelf.",
        },
      ],
      "De aanpak die bij jouw manier van werken past.",
    ),
  );

  // ── 20. Jouw leer- en werkomgeving ────────────────────────────────────────
  //
  // Dit blad noemt geen enkel construct bij een vaste naam en kiest er ook geen
  // op positie in de lijst. Het leest de kop en de staart van de rangordes en
  // beschrijft wat daaruit volgt. Zo blijft het blad kloppen als het instrument
  // ooit een construct bij krijgt of er een verliest.
  const omgevingPunten: string[] = [];
  const vTop = versnellers.gerangschikt[0];
  const vLaag = versnellers.gerangschikt[versnellers.gerangschikt.length - 1];
  if (vTop) {
    omgevingPunten.push(
      `Zoek een omgeving waarin ${vTop.construct} de gewone manier van werken is. Dat is de manier ` +
        `die jou het minst moeite kost, en een omgeving die er ruimte voor laat, haalt het meeste ` +
        `uit je.`,
    );
  }
  if (vLaag && vTop && vLaag.construct !== vTop.construct) {
    omgevingPunten.push(
      `Een omgeving die vooral op ${vLaag.construct} leunt, vraagt van jou meer inspanning voor ` +
        `hetzelfde resultaat. Dat kan prima, maar weet het vooraf en zorg dat het niet de hele dag ` +
        `zo is.`,
    );
  }
  const fTop = foci.gerangschikt[0];
  if (fTop) {
    omgevingPunten.push(
      `Kijk bij een opleiding niet alleen naar het vak maar naar de vorm: hoeveel van de week gaat ` +
        `er op aan werk waarin ${fTop.construct} aan bod komt? Hoe hoger dat aandeel, hoe beter het ` +
        `bij je past.`,
    );
  }
  const iTop = interesse.gerangschikt[0];
  if (iTop) {
    omgevingPunten.push(
      `Waar je aandacht naartoe gaat, wijst naar ${iTop.construct}. Neem dat mee als je een school ` +
        `bezoekt: kijk of je daar mensen ziet die daarmee bezig zijn.`,
    );
  }
  omgevingPunten.push(
    "Let bij een bezoek ook op de dingen die niet in een brochure staan: hoe groot de groepen zijn, " +
      "hoeveel er alleen gewerkt wordt, en hoe makkelijk je bij iemand terechtkunt met een vraag.",
  );
  paginas.push(
    pagina(
      20,
      [
        {
          soort: "intro",
          tekst:
            "Je kiest niet alleen een vak maar ook een omgeving: alleen of in groep, veel of weinig " +
            "structuur, veel of weinig contact. Dat wordt bij oriëntatie vaak vergeten en het bepaalt " +
            "mee of iets houdbaar is.",
        },
        { soort: "opsomming", kop: null, punten: omgevingPunten },
        {
          soort: "alinea",
          tekst:
            "Dit rapport weet niet in welke omgeving je nu zit. Er staat dus wat bij je past, niet hoe " +
            "dat zich verhoudt tot je huidige school of klas. Die vergelijking maak je zelf, of samen " +
            "met iemand die je situatie kent.",
        },
      ],
      "In welke omgeving je tot je recht komt.",
    ),
  );

  // ── 21. Waar je interesse naar uitgaat ────────────────────────────────────
  const interesseBlokken: T4SBlok[] = [
    {
      soort: "intro",
      tekst:
        "Interesse is de lichtste van de onderdelen in dit rapport. Ze zegt waar je aandacht naartoe " +
        "gaat, niet wat je kunt. Ze is ook de brug naar het volgende blad over richtingen.",
    },
    { soort: "rangtabel", kleur: interesse.kleur, rijen: interesse.rijen, naschrift: [GROEP_UITLEG] },
  ];
  for (const r of interesse.gerangschikt.slice(0, 3)) {
    const tekst = INTERESSE_DUIDING[r.construct];
    if (tekst) interesseBlokken.push({ soort: "alinea", tekst: `${r.construct}: ${tekst}` });
  }
  const r1 = interesse.gerangschikt[0] ? zwaarsteItemVan(inst, interesse.gerangschikt[0].construct) : null;
  if (r1) {
    const regels = citatenVoor(inst, antwoorden, taal, [r1]);
    if (regels.length > 0)
      interesseBlokken.push({
        soort: "citaat",
        opschrift: "HIER ZEI JE JA TEGEN",
        kop: "Jouw eigen antwoord",
        kleur: KLEUR.oker,
        regels,
      });
  }
  interesseBlokken.push({
    soort: "alinea",
    tekst:
      "Bij dit onderdeel is niet naar energie gevraagd. Daarom staat er in de rechterkolom niets. " +
      "Dat is geen ontbrekend antwoord van jou, die vraag is er gewoon niet.",
  });
  paginas.push(pagina(21, interesseBlokken, "Waar je aandacht vanzelf naartoe gaat."));

  // ── 22. Studierichtingen om te verkennen ──────────────────────────────────
  const gebieden = resultaat.studiegebieden.top.length > 0
    ? resultaat.studiegebieden.top
    : resultaat.studiegebieden.gesorteerd.slice(0, 3);
  const richtingPunten = gebieden.map((g) => {
    const toel = GEBIED_TOELICHTING[g.naam];
    return toel ? `${g.naam}: ${toel}.` : `${g.naam}.`;
  });
  paginas.push(
    pagina(
      22,
      [
        {
          soort: "intro",
          tekst:
            "Hieronder staan geen opleidingsnamen maar soorten richtingen. Ze volgen uit de twee " +
            "onderdelen waarin je vermogen het duidelijkst zichtbaar is, gekruist met waar je aandacht " +
            "naartoe gaat.",
        },
        { soort: "opsomming", kop: null, punten: richtingPunten },
        ...(foci.gerangschikt.length > 0 && interesse.gerangschikt.length > 0
          ? ([
              {
                soort: "kader",
                opschrift: "WAAROM DEZE",
                kop: "Waar vermogen en interesse elkaar raken",
                kleur: KLEUR.teal,
                tekst:
                  `Je sterkste talent-focus is ${foci.gerangschikt[0].construct} en je sterkste ` +
                  `interessegebied is ${interesse.gerangschikt[0].construct}. Waar die twee elkaar ` +
                  `raken, liggen de richtingen hierboven.`,
              },
            ] as T4SBlok[])
          : []),
        {
          soort: "alinea",
          tekst:
            "Dit rapport heeft geen koppeling met een opleidingendatabank. Daarom staan hier geen " +
            "concrete opleidingen. Dat is geen vaagheid van het rapport maar een grens van wat er " +
            "vandaag beschikbaar is. Neem deze soorten mee als zoekterm en niet als antwoord.",
        },
        {
          soort: "alinea",
          tekst: "Dit is een startpunt voor een gesprek, geen keuze.",
        },
      ],
      "Soorten richtingen die bij jou aansluiten.",
    ),
  );

  // ── 23. Waar jij iets wilt betekenen ──────────────────────────────────────
  const b1 = citaatVanItem(inst, antwoorden, "B1", taal);
  paginas.push(
    pagina(
      23,
      [
        {
          soort: "intro",
          tekst:
            "Dit is het enige onderdeel van de vragenlijst dat over richting gaat in plaats van over " +
            "eigenschappen. Niet wat je kunt, maar waar je het voor zou willen inzetten.",
        },
        ...(b1
          ? ([
              {
                soort: "citaat",
                opschrift: "WAAR JIJ IETS WILT BETEKENEN",
                kop: "Jouw eigen antwoord",
                kleur: KLEUR.accent,
                regels: [b1],
              },
            ] as T4SBlok[])
          : ([{ soort: "alinea", tekst: "Je hebt deze vraag nog niet beantwoord." }] as T4SBlok[])),
        {
          soort: "alinea",
          tekst:
            "Dit is een vraag, geen meting. Er is een antwoord op gegeven en daar valt geen rangorde " +
            "uit te maken. Wat het wel doet, is een richting geven aan alles wat op de vorige bladen " +
            "staat.",
        },
        {
          soort: "vragen",
          kop: "OM OVER DOOR TE DENKEN",
          vragen: [
            "Wanneer had je voor het laatst het gevoel dat wat je deed ergens toe deed?",
            "Wie merkte daar iets van, en waaraan?",
            "Wat zou je willen dat er over vijf jaar anders is doordat jij eraan werkte?",
          ],
        },
        {
          soort: "alinea",
          tekst: "Neem deze inzichten mee in een gesprek met iemand die je vertrouwt.",
        },
      ],
      "Waar je het voor zou willen inzetten.",
    ),
  );

  // ── 24. Jouw specifieke positie ───────────────────────────────────────────
  const spanningen: string[] = [];
  for (const [as, paren] of Object.entries(inst.scoringMap.convergenceAxes)) {
    const posities = paren
      .map(([fam, con]) => {
        const dim = fam === FAM_FOCI ? foci : fam === FAM_VERSNELLERS ? versnellers : fam === FAM_DRIVERS ? drivers : interesse;
        const rij = dim.gerangschikt.find((r) => r.construct === con);
        return rij ? { con, rang: rij.rang as number, totaal: dim.gerangschikt.length } : null;
      })
      .filter((p): p is { con: string; rang: number; totaal: number } => p != null);
    if (posities.length < 2) continue;
    const hoog = posities.filter((p) => p.rang <= 2);
    const laag = posities.filter((p) => p.rang >= p.totaal - 1);
    if (hoog.length > 0 && laag.length > 0) {
      spanningen.push(
        `${lijst(hoog.map((p) => p.con))} ${staan(hoog.length)} bij jou hoog terwijl ` +
          `${lijst(laag.map((p) => p.con))} laag ${staan(laag.length)}, en die horen normaal bij elkaar.`,
      );
    }
  }
  if (drivers.gerangschikt.length >= 2) {
    const [d1, d2] = drivers.gerangschikt;
    if (d1.rang === d2.rang || Math.abs((d1.herkenning as number) - (d2.herkenning as number)) < 0.35) {
      spanningen.push(
        `${d1.construct} en ${d2.construct} staan bij jou even sterk. Twee patronen die tegelijk even ` +
          `hard sturen, kunnen elkaar in de weg zitten op het moment dat het spannend wordt.`,
      );
    }
  }
  const spanningSlot =
    spanningen.length > 0
      ? "Dat is geen fout. Het betekent dat je die onderdelen op jouw eigen manier invult, en dat is " +
        "precies het soort ding om samen te bekijken."
      : "";
  if (spanningen.length === 0) {
    spanningen.push(
      "In jouw antwoorden zit geen uitgesproken spanning tussen de onderdelen. De drie lagen wijzen " +
        "dezelfde kant op. Dat maakt een keuze niet vanzelf makkelijker, maar wel eenduidiger.",
    );
  }
  paginas.push(
    pagina(
      24,
      [
        {
          soort: "intro",
          tekst:
            "Op dit blad staat wat er eigen is aan jouw profiel: plaatsen waar twee onderdelen elkaar " +
            "niet volgen zoals je zou verwachten. Dat is nieuwsgierig bedoeld en niet verontrustend.",
        },
        { soort: "opsomming", kop: null, punten: spanningen },
        ...(spanningSlot ? ([{ soort: "alinea", tekst: spanningSlot }] as T4SBlok[]) : []),
        {
          soort: "alinea",
          tekst:
            "Deze vergelijkingen zijn intern: ze zetten jouw eigen onderdelen naast elkaar. Er is geen " +
            "vergelijkingsgroep, dus er staat nergens dat iets ongewoon is ten opzichte van anderen. " +
            "Wat hier staat is ongewoon binnen jouw eigen antwoorden.",
        },
      ],
      "Waar jouw onderdelen elkaar niet vanzelf volgen.",
    ),
  );

  // ── 25. Aandachtspunten ───────────────────────────────────────────────────
  const aandacht: string[] = [];
  const kopDrivers = drivers.gerangschikt.slice(0, 2);
  if (kopDrivers.length > 0) {
    aandacht.push(
      `${lijst(kopDrivers.map((d) => d.construct))} ${staan(kopDrivers.length)} bovenaan je drivers. ` +
        `Vraag: waar merk jij dat dit je verder helpt, en waar merk je dat het je vasthoudt?`,
    );
  }
  const staartVersnellers = versnellers.gerangschikt.slice(-2);
  if (staartVersnellers.length > 0) {
    aandacht.push(
      `${lijst(staartVersnellers.map((v) => v.construct))} ${staan(staartVersnellers.length)} onderaan. ` +
        `Vraag: kom je in je studie situaties tegen waarin dit wel van je gevraagd wordt, en hoe los ` +
        `je dat nu op?`,
    );
  }
  if (foci.gerangschikt.length > 0) {
    const laagsteFocus = foci.gerangschikt[foci.gerangschikt.length - 1];
    aandacht.push(
      `${laagsteFocus.construct} is de focus waarin je jezelf het minst herkent. Vraag: is dat ` +
        `iets waar je omheen kunt werken, of is het iets dat je wilt opbouwen?`,
    );
  }
  paginas.push(
    pagina(
      25,
      [
        {
          soort: "kader",
          opschrift: "LEES DIT EERST",
          kop: "Geen fouten, wel aandachtspunten",
          kleur: KLEUR.accent,
          tekst:
            "Dit zijn geen fouten. Dit zijn plekken waar aandacht loont. Elk punt hieronder komt " +
            "rechtstreeks uit je eigen antwoorden en is bedoeld als vraag aan jezelf, niet als oordeel " +
            "over jou.",
        },
        { soort: "opsomming", kop: null, punten: aandacht },
        {
          soort: "alinea",
          tekst:
            "Neem hoogstens een van deze punten mee naar een gesprek. Ze allemaal tegelijk willen " +
            "aanpakken werkt niet, en het is ook niet nodig.",
        },
      ],
      "Plekken waar aandacht loont.",
    ),
  );

  // ── 26. Een eerste stap ───────────────────────────────────────────────────
  const eersteStap =
    foci.gerangschikt.length > 0
      ? `Zoek in de komende twee weken een situatie op waarin ${foci.gerangschikt[0].construct} echt ` +
        `van je gevraagd wordt. Een vak, een opdracht, een activiteit, een dag meelopen. Kijk daarna ` +
        `terug: ging het zoals dit rapport zegt?`
      : "Zoek in de komende twee weken een situatie op waarin je merkt waar je vermogen ligt, en kijk " +
        "daarna terug of het klopte met wat je hier las.";
  paginas.push(
    pagina(
      26,
      [
        {
          soort: "intro",
          tekst:
            "Een rapport dat eindigt in beschrijving wordt weggelegd. Daarom eindigt dit blad met iets " +
            "dat je kunt doen.",
        },
        {
          soort: "kader",
          opschrift: "JOUW EERSTE STAP",
          kop: "Iets concreets om te proberen",
          kleur: KLEUR.salie,
          tekst: eersteStap,
        },
        {
          soort: "vragen",
          kop: "DRIE VRAGEN OM MEE TE NEMEN NAAR EEN GESPREK",
          vragen: [
            foci.gerangschikt.length > 0
              ? `Herken jij jezelf in ${foci.gerangschikt[0].construct} zoals het hier beschreven staat?`
              : "Herken je jezelf in wat hier over je vermogen staat?",
            "Welk onderdeel verbaasde je, en waarom?",
            "Wat zou je willen uitproberen voor je iets vastlegt?",
          ],
        },
        {
          soort: "alinea",
          tekst:
            "Er is in dit platform geen vervolgtraject en geen tweede meting. Deze stap verwijst dus " +
            "naar iets in je eigen omgeving, en dat is ook waar hij thuishoort.",
        },
      ],
      "Wat je met dit rapport kunt doen.",
    ),
  );

  // ── 27. In één zin (onderdeel D) ────────────────────────────────────
  paginas.push(
    pagina(27, eenZinBlokken(resultaat, foci, versnellers, interesse), "Drie sterke onderdelen in één zin."),
  );

  // ── 28. Wat je hier zocht (onderdeel B3) ────────────────────────────
  paginas.push(
    pagina(
      28,
      watJeHierZochtBlokken(p0Tekst, foci, versnellers, interesse),
      "Terug naar je eigen vraag, met wat je antwoorden laten zien.",
    ),
  );

  // ── 29. Voor wie meeleest, slot (onderdeel E2) ─────────────────────
  paginas.push(pagina(29, voorWieMeeleestSlotBlokken(), "Hoe je dit rapport samen leest."));

  // ── 30. Een zin om mee te nemen (ingreep 2, nieuw slothoofdstuk) ──────
  // Ingreep 1 van de opdracht "Slotnoot en opmaak": de hoofdstukken met de
  // onderbouwing en de bronnen (nr 34 en 35 hieronder) staan nu achter de
  // bijlagen met de eigen antwoorden (nr 31 tot en met 33), in plaats van
  // ervoor. Dit nieuwe slothoofdstuk staat direct na "Voor wie meeleest,
  // slot" en voor die bijlagen: het laatste dat de student leest voordat de
  // eigen, letterlijke antwoorden nog eens voorbijkomen.
  paginas.push(
    pagina(
      30,
      eenZinOmMeeTeNemenBlokken(resultaat, foci, versnellers, interesse, drivers),
      "Jouw profiel, samengevat in één beweging.",
    ),
  );

  // ── 31, 32, 33: de bronpagina's ──────────────────────────────────
  paginas.push(bronPagina(31, inst, antwoorden, taal, FAM_FOCI));
  paginas.push(bronPagina(32, inst, antwoorden, taal, FAM_VERSNELLERS));
  paginas.push(bronPagina(33, inst, antwoorden, taal, FAM_DRIVERS));

  // ── 34. Verantwoording en grenzen ─────────────────────────────────────────
  paginas.push(
    pagina(
      34,
      [
        {
          soort: "intro",
          tekst:
            "Dit rapport beschrijft en oriënteert. Het beslist niet. Hieronder staat wat het wel is, " +
            "wat het niet is, en hoe de cijfers tot stand zijn gekomen.",
        },
        {
          soort: "opsomming",
          kop: "Wat dit rapport niet is",
          punten: [
            "Het is geen intelligentiemeting en zegt niets over hoe slim je bent.",
            "Het is geen diagnose en stelt niets vast over je gezondheid of je ontwikkeling.",
            "Het is geen selectie-instrument en mag niet gebruikt worden om iemand ergens buiten te houden.",
            "Het voorspelt niet of je zult slagen in een richting.",
          ],
        },
        {
          soort: "alinea",
          tekst:
            "Hoe de cijfers berekend zijn, in gewone taal: bij elke stelling gaf je aan hoeveel je " +
            "jezelf erin herkent, op een schaal van vier antwoorden. Die antwoorden zijn per onderdeel " +
            "opgeteld en daarna teruggerekend naar dezelfde schaal van 0 tot 3 die je op het scherm " +
            "zag, zodat de onderdelen eerlijk naast elkaar staan. De energievraag is apart gehouden en " +
            "nergens bij de herkenning opgeteld. Waar binnen een onderdeel iets ontbrak, is er geen " +
            "score berekend.",
        },
        {
          soort: "paren",
          paren: [
            { label: "Instrument", waarde: `${inst.name}` },
            { label: "Instrumentversie", waarde: opties.instrumentVersie },
            { label: "Rekenmotor", waarde: inst.scoringMap.scorerVersion },
            { label: "Datum van invullen", waarde: opties.datum },
            { label: "Uitvoering", waarde: licentie === "basis" ? "Basis" : "Verdieping" },
          ],
        },
        {
          soort: "alinea",
          tekst:
            "Heb je een vraag bij wat hier staat, leg dit rapport dan naast iemand die je kent: een " +
            "leerkracht, een begeleider, een ouder. Het is bedoeld om samen te lezen.",
        },
      ],
      "Wat dit rapport is, en wat het niet is.",
    ),
  );

  // ── 35. Waarop dit rapport gebouwd is (onderdeel G) ──────────────────
  paginas.push(pagina(35, waaropGebouwdBlokken(), "De bronnen achter de onderdelen en het ontwerp."));

  // ── De licentie toepassen ─────────────────────────────────────────────────
  const toegestaan = new Set(
    PAGINAPLAN.filter((p) => licentie === "verdieping" || p.basis).map((p) => p.nr),
  );
  const gekozen = paginas.filter((p) => toegestaan.has(p.nr));

  return {
    licentie,
    taal,
    naam: opties.naam,
    code: opties.code,
    datum: opties.datum,
    instrumentVersie: opties.instrumentVersie,
    scorerVersie: inst.scoringMap.scorerVersion,
    paginas: gekozen,
    meldingen,
  };
}

export { batterijZin, getal1, getalMetTeken, kleurVanFamilie };
