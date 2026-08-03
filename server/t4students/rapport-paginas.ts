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
  type T4SBand,
  type T4SBlok,
  type T4SCitaatRegel,
  type T4SDimensie,
  type T4SLicentie,
  type T4SPagina,
  type T4SRapport,
} from "./rapport-contract";

// ── Vaste teksten uit de blauwdruk, letterlijk ──────────────────────────────

const ONEPAGE_ONDERTITEL = "Drie lagen, elk met een eigen rangorde en een eigen energie.";

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

const BAND_NOOT_FOCI = "TaPas-BEELD hoort hier niet bij; dat lees je apart op pagina 5.";

const COVER_SLOTREGEL =
  "Samengesteld door TaPasCity · Dit rapport beschrijft en oriënteert, het beslist niet.";

// De korte duiding bij de interessegebieden en bij de studiegebieden. Deze
// teksten zijn van de bouwer en nog niet nagelezen. Ze staan in een databestand
// omdat hun sleutels constructnamen en gebiedsnamen zijn: die horen maar op een
// plaats te staan, en daar kan een test ze nakijken.
const EIGEN_TEKSTEN = rapportteksten as {
  interesse: { teksten: Record<string, string> };
  studiegebieden: { teksten: Record<string, string> };
};
const INTERESSE_DUIDING = EIGEN_TEKSTEN.interesse.teksten;
const GEBIED_TOELICHTING = EIGEN_TEKSTEN.studiegebieden.teksten;

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

/**
 * De blokken van pagina 28, "Wat je motiveert om te studeren". Leest
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
  // dan moet dat gemeld worden en niet weggemoffeld.
  const vergelijk = (eigen: T4SDimensie, motor: string[], naam: string) => {
    const mijn = eigen.gerangschikt.map((r) => r.construct);
    const hunne = motor.filter((c) => mijn.includes(c));
    if (mijn.join("|") !== hunne.join("|")) {
      meldingen.push(
        `De rangorde van ${naam} op papier wijkt af van die van de motor. Papier: ${mijn.join(", ")}. ` +
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
          kop: "DE TWEE VORMEN",
          kleur: KLEUR.teal,
          tekst:
            "Herkenning is een rijtje van drie blokjes dat van links naar rechts volloopt. Nul blokjes " +
            "is Niet ik, drie blokjes is Helemaal ik. Energie is een balkje dat in het midden begint: " +
            "naar rechts betekent dat het je energie geeft, naar links dat het je energie kost.",
        },
        { soort: "tussenkop", tekst: "2. Wat de rangorde betekent" },
        {
          soort: "alinea",
          tekst:
            "Bij elk onderdeel staan de constructen op volgorde. Nummer 1 is niet beter dan nummer 6. " +
            "Het betekent alleen: hier herken je jezelf het sterkst. Een lage plaats is geen tekort en " +
            "geen zwakte. Ze zegt waar op dit moment minder van jou in zit.",
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
            "geen plaats in de rangorde. Er wordt niets ingeschat en niets gemiddeld. Er staat dan " +
            "Te weinig antwoorden.",
        },
      ],
      "Drie dingen die je nodig hebt om de rest te begrijpen.",
    ),
  );

  // ── 3. De one-page ────────────────────────────────────────────────────────
  // Een zin voor alle onderdelen samen, en niet een alinea per onderdeel. Anders
  // groeit dit blok mee met het aantal openstaande vragen en wordt de one-page
  // juist bij een dunne invulling van haar eigen blad geduwd.
  const zonderOordeel = [foci, versnellers, drivers].flatMap((dim) =>
    dim.zonderOordeel.map((r) => r.construct),
  );
  const naschrift: string[] =
    zonderOordeel.length === 0
      ? []
      : [
          `Van ${lijst(zonderOordeel)} is nog niet alles ingevuld. Daarom staat er geen score bij ` +
            `en geen plaats in de rangorde. Zodra je die vragen beantwoordt, ${staan(zonderOordeel.length)} ` +
            `${zonderOordeel.length === 1 ? "dat onderdeel" : "die onderdelen"} er vanzelf bij.`,
        ];
  paginas.push(
    pagina(
      3,
      [
        { soort: "intro", tekst: ONEPAGE_INTRO },
        {
          soort: "banden",
          banden: [
            bandVan(foci, 1, "TALENT-FOCI", "waarin je je talent inzet", BAND_NOOT_FOCI),
            bandVan(versnellers, 2, "TALENT-VERSNELLERS", "hoe je het doet", null),
            bandVan(drivers, 3, "DRIVERS", "wat je aandrijft", null),
          ],
          legende: ONEPAGE_LEGENDE,
          naschrift,
        },
      ],
      ONEPAGE_ONDERTITEL,
    ),
  );

  // ── 4. Hoe scherp is dit beeld ────────────────────────────────────────────
  const bt = resultaat.betrouwbaarheid;
  const p1 = citaatVanItem(inst, antwoorden, "P1", taal);
  paginas.push(
    pagina(
      4,
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

  // ── 5. Jouw beeld van jezelf ──────────────────────────────────────────────
  const beeldCitaten = citatenVoor(inst, antwoorden, taal, ["BE1", "BE2"]);
  paginas.push(
    pagina(
      5,
      [
        {
          soort: "intro",
          tekst:
            "TaPas-BEELD gaat niet over wat je kunt, maar over hoe helder je eigen beeld op dit moment " +
            "is. Daarom staat het niet bij de drie lagen op pagina 3, maar hier apart.",
        },
        {
          soort: "rangtabel",
          kleur: beeld.kleur,
          rijen: beeld.rijen,
          naschrift: [],
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
                kop: "DIT GAF JE ZELF AAN",
                kleur: KLEUR.inktZacht,
                regels: beeldCitaten,
              },
            ] as T4SBlok[])
          : []),
      ],
      "Hoe helder je eigen beeld vandaag is.",
    ),
  );

  // ── 6. Jouw energie vandaag ───────────────────────────────────────────────
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
      6,
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
            "Er is een meetmoment, dus er valt niets te zeggen over hoe dit zich verhoudt tot vorige " +
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
      opener: 7,
      top: 8,
      laag: 9,
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
      opener: 10,
      top: 11,
      laag: 12,
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
      opener: 13,
      top: 14,
      laag: 15,
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
    const rijen = b.dim.gerangschikt;
    const drieHoog = rijen.slice(0, 3);
    // In rangorde, net als op het blad met de drie sterkste. Anders leest de ene
    // bladzijde van boven naar onder en de andere van onder naar boven.
    const drieLaag = rijen.slice(-3);
    const naschriftDim = b.dim.zonderOordeel.map(
      (r) =>
        `Van ${r.construct} is nog niet alles ingevuld. Daarom staat er geen score bij en geen plaats ` +
        `in de rangorde.`,
    );

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

    // De drie sterkste, met een citaatblok bij de sterkste.
    const topBlokken: T4SBlok[] = [
      {
        soort: "intro",
        tekst:
          b.wat === FAM_DRIVERS
            ? "Hieronder de drie patronen die jij het sterkst herkent, met wat elk patroon je geeft en " +
              "waar het je in de weg kan zitten."
            : "Hieronder de drie waarin je jezelf het sterkst herkent, met wat je daarmee kunt en wat " +
              "dat voor studeren betekent.",
      },
    ];
    for (const r of drieHoog) {
      topBlokken.push({
        soort: "constructblok",
        construct: r.construct,
        rang: r.rang,
        herkenning: r.herkenning,
        energie: r.energie,
        ingevuld: r.ingevuld,
        kleur: b.dim.kleur,
        duiding: duidingVan(r.construct),
      });
    }
    if (drieHoog.length > 0) {
      const itemId = zwaarsteItemVan(inst, drieHoog[0].construct);
      const regels = itemId ? citatenVoor(inst, antwoorden, taal, [itemId]) : [];
      if (regels.length > 0) {
        topBlokken.push({ soort: "citaat", kop: b.citaatKop, kleur: b.dim.kleur, regels });
      }
    }
    paginas.push(pagina(b.top, topBlokken, b.topOndertitel));

    // Wat lager staat.
    const laagBlokken: T4SBlok[] = [
      {
        soort: "intro",
        tekst:
          b.wat === FAM_DRIVERS
            ? "Een driver die je nauwelijks herkent, is geen gebrek. Het betekent dat dit patroon je " +
              "minder stuurt. Hieronder staat wat de sterkste driver doet als hij te hard duwt, en wat " +
              "de zwakst herkende patronen over je zeggen."
            : "Laag betekent hier niet zwak. Het betekent dat dit minder van jou is dan de rest. Je " +
              "vermogen zit ergens anders, en dat is precies wat een rangorde laat zien.",
      },
    ];
    for (const r of drieLaag) {
      laagBlokken.push({
        soort: "constructblok",
        construct: r.construct,
        rang: r.rang,
        herkenning: r.herkenning,
        energie: r.energie,
        ingevuld: r.ingevuld,
        kleur: b.dim.kleur,
        duiding: duidingVan(r.construct),
      });
    }
    paginas.push(pagina(b.laag, laagBlokken, b.laagOndertitel));
  }

  // ── 16. Wat je motiveert om te studeren ───────────────────────────────────
  // Het oordeel komt uitsluitend uit de motor: balansLabel, intrinsiek en
  // extrinsiek worden hier alleen gelezen en getoond, nooit herberekend. Zie
  // tests/t4students-oordeel-komt-uit-de-motor.test.ts en
  // tests/t4students-motivatieblok-in-studiekompas.test.ts.
  // Motivatie is een eigen laag en heeft geen koppeling met de drivers, ook al
  // gaat het bij allebei over wat iemand aanstuurt.
  paginas.push(pagina(16, motivatieBlokken(resultaat), "Wat je in beweging brengt om te leren."));

  // ── 17. Hoe jij het beste leert ───────────────────────────────────────────
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
      17,
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
          ? ([{ soort: "citaat", kop: "DIT KOOS JE", kleur: KLEUR.salie, regels: [s1] }] as T4SBlok[])
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

  // ── 18. Jouw leer- en werkomgeving ────────────────────────────────────────
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
      18,
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

  // ── 19. Waar je interesse naar uitgaat ────────────────────────────────────
  const interesseBlokken: T4SBlok[] = [
    {
      soort: "intro",
      tekst:
        "Interesse is de lichtste van de onderdelen in dit rapport. Ze zegt waar je aandacht naartoe " +
        "gaat, niet wat je kunt. Ze is ook de brug naar het volgende blad over richtingen.",
    },
    { soort: "rangtabel", kleur: interesse.kleur, rijen: interesse.rijen, naschrift: [] },
  ];
  for (const r of interesse.gerangschikt.slice(0, 3)) {
    const tekst = INTERESSE_DUIDING[r.construct];
    if (tekst) interesseBlokken.push({ soort: "alinea", tekst: `${r.construct}. ${tekst}` });
  }
  const r1 = interesse.gerangschikt[0] ? zwaarsteItemVan(inst, interesse.gerangschikt[0].construct) : null;
  if (r1) {
    const regels = citatenVoor(inst, antwoorden, taal, [r1]);
    if (regels.length > 0)
      interesseBlokken.push({ soort: "citaat", kop: "HIER ZEI JE JA TEGEN", kleur: KLEUR.oker, regels });
  }
  interesseBlokken.push({
    soort: "alinea",
    tekst:
      "Bij dit onderdeel is niet naar energie gevraagd. Daarom staat er in de rechterkolom niets. " +
      "Dat is geen ontbrekend antwoord van jou, die vraag is er gewoon niet.",
  });
  paginas.push(pagina(19, interesseBlokken, "Waar je aandacht vanzelf naartoe gaat."));

  // ── 20. Studierichtingen om te verkennen ──────────────────────────────────
  const gebieden = resultaat.studiegebieden.top.length > 0
    ? resultaat.studiegebieden.top
    : resultaat.studiegebieden.gesorteerd.slice(0, 3);
  const richtingPunten = gebieden.map((g) => {
    const toel = GEBIED_TOELICHTING[g.naam];
    return toel ? `${g.naam}: ${toel}.` : `${g.naam}.`;
  });
  paginas.push(
    pagina(
      20,
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
                kop: "WAAROM DEZE",
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

  // ── 21. Waar jij iets wilt betekenen ──────────────────────────────────────
  const b1 = citaatVanItem(inst, antwoorden, "B1", taal);
  paginas.push(
    pagina(
      21,
      [
        {
          soort: "intro",
          tekst:
            "Dit is het enige onderdeel van de vragenlijst dat over richting gaat in plaats van over " +
            "eigenschappen. Niet wat je kunt, maar waar je het voor zou willen inzetten.",
        },
        ...(b1
          ? ([
              { soort: "citaat", kop: "WAAR JIJ IETS WILT BETEKENEN", kleur: KLEUR.accent, regels: [b1] },
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

  // ── 22. Jouw specifieke positie ───────────────────────────────────────────
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
      22,
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

  // ── 23. Aandachtspunten ───────────────────────────────────────────────────
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
      23,
      [
        {
          soort: "kader",
          kop: "LEES DIT EERST",
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

  // ── 24. Een eerste stap ───────────────────────────────────────────────────
  const eersteStap =
    foci.gerangschikt.length > 0
      ? `Zoek in de komende twee weken een situatie op waarin ${foci.gerangschikt[0].construct} echt ` +
        `van je gevraagd wordt. Een vak, een opdracht, een activiteit, een dag meelopen. Kijk daarna ` +
        `terug: ging het zoals dit rapport zegt?`
      : "Zoek in de komende twee weken een situatie op waarin je merkt waar je vermogen ligt, en kijk " +
        "daarna terug of het klopte met wat je hier las.";
  paginas.push(
    pagina(
      24,
      [
        {
          soort: "intro",
          tekst:
            "Een rapport dat eindigt in beschrijving wordt weggelegd. Daarom eindigt dit blad met iets " +
            "dat je kunt doen.",
        },
        { soort: "kader", kop: "JOUW EERSTE STAP", kleur: KLEUR.salie, tekst: eersteStap },
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

  // ── 25, 26, 27: de bronpagina's ───────────────────────────────────────────
  paginas.push(bronPagina(25, inst, antwoorden, taal, FAM_FOCI));
  paginas.push(bronPagina(26, inst, antwoorden, taal, FAM_VERSNELLERS));
  paginas.push(bronPagina(27, inst, antwoorden, taal, FAM_DRIVERS));

  // ── 28. Verantwoording en grenzen ─────────────────────────────────────────
  paginas.push(
    pagina(
      28,
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
        {
          soort: "tussenkop",
          tekst: "Bronvermelding",
        },
        {
          soort: "alinea",
          tekst:
            "Het motivatieprofiel op de pagina hiervoor steunt op de zelfdeterminatietheorie van Deci en " +
            "Ryan (1985, 2000). Hieronder de volledige verwijzingen.",
        },
        {
          soort: "opsomming",
          kop: null,
          punten: [
            "Deci, E. L., en Ryan, R. M. (1985). Intrinsic Motivation and Self-Determination in Human " +
              "Behavior. New York: Plenum Press.",
            "Ryan, R. M., en Deci, E. L. (2000). Self-determination theory and the facilitation of " +
              "intrinsic motivation, social development, and well-being. American Psychologist, 55(1), " +
              "68 tot 78.",
            "Ryan, R. M., en Deci, E. L. (2017). Self-Determination Theory: Basic Psychological Needs in " +
              "Motivation, Development, and Wellness. New York: Guilford Press.",
          ],
        },
      ],
      "Wat dit rapport is, en wat het niet is.",
    ),
  );

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
