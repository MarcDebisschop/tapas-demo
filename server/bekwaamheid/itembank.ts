/**
 * De itembank: de eenrichtingsstatusmachine en de constructieregels.
 *
 * Dit bestand rekent en beslist, en het raakt geen databank en geen Express aan.
 * Dezelfde eis als bij `normprofiel.ts` en `beslisregels.ts`, om dezelfde reden:
 * bij een bezwaar tegen een uitslag moet de weg van item naar score exact
 * reproduceerbaar zijn, en dat kan alleen als er geen verborgen invoer is.
 *
 * Twee dingen staan hier.
 *
 * 1. `magOvergang` — de eenrichtingsregel op `gebruik`. Bouwplan §6.6 noemt dit
 *    "één test van vier regels" die "de geldigheid van het hele systeem"
 *    beschermt. De regel zelf staat hier; `storage.ts` dwingt hem af bij het
 *    schrijven.
 * 2. `valideerItem` — de constructieregels uit draaiboek §4.3, voor zover ze
 *    hard toetsbaar zijn. Wat niet hard toetsbaar is, staat in het commentaar bij
 *    `valideerItem` met de reden waarom er geen toets op zit.
 */

import {
  AUTOMATISCH_SCOORBARE_SOORTEN,
  ITEMGEBRUIKEN,
  ITEMSOORTEN,
  KENNISCHECKBLOKKEN,
  type As,
  type Itemgebruik,
  type Itemsoort,
  type Kennischeckblok,
} from "./schema";

// ---------------------------------------------------------------------------
// De eenrichtingsstatusmachine
// ---------------------------------------------------------------------------

/**
 * Welke overgangen van `gebruik` zijn toegestaan.
 *
 * Uit bouwplan §6.6, letterlijk:
 *
 *     meten    → verbrand      (na een ronde waarin het item is uitgelekt)
 *     oefenen  → verbrand
 *     meten    → oefenen       (bewust degraderen: mag)
 *     oefenen  → meten         VERBODEN
 *     verbrand → wat dan ook   VERBODEN
 *
 * WAAROM `oefenen → meten` VERBODEN IS. Een item dat ooit als oefenitem is
 * getoond, is inhoudelijk bekend bij iedereen die de oefenset heeft gezien. Het
 * daarna als meetitem gebruiken levert een item op dat niet meet wat het lijkt te
 * meten: wie de oefenset uit het hoofd kent, scoort hoog zonder de constructen te
 * begrijpen. Het verraderlijke is dat dit niet opvalt. De p-waarde stijgt, de
 * check lijkt makkelijker geworden, en niemand ziet dat de meting stil is
 * uitgehold. Bouwplan §299 zegt het scherper: een itembank die zowel oefent als
 * meet, is binnen een maand uitgelekt.
 *
 * WAAROM `verbrand` EEN EINDPUNT IS. Verbrand betekent: dit item is publiek
 * geworden. Dat kan niet ongedaan worden gemaakt. Een weg terug uit `verbrand`
 * zou de enige toestand zijn waarin het systeem doet alsof kennis kan worden
 * teruggenomen.
 *
 * WAAROM `meten → oefenen` WÉL MAG. Degraderen kost niets: het item verliest zijn
 * meetfunctie en wordt lesmateriaal. Dat is de normale weg voor een item dat na
 * itemanalyse te makkelijk of te moeilijk blijkt. Wie het item daarna weer wil
 * meten, schrijft een nieuw item — en dat is precies de bedoeling.
 *
 * WAAROM DEZELFDE WAARDE GEEN OVERGANG IS. `meten → meten` staat niet in de
 * tabel. Het schrijven van een item zonder het gebruik te wijzigen is een
 * gewone wijziging en komt hier niet langs; zou het hier wél langs komen, dan
 * moet het slagen, want anders is een spelfout in de stam van een meetitem niet
 * te herstellen. `magOvergang` geeft daarom `true` bij gelijke waarden, met een
 * eigen test.
 */
const TOEGESTANE_OVERGANGEN: Record<Itemgebruik, readonly Itemgebruik[]> = {
  oefenen: ["verbrand"],
  meten: ["oefenen", "verbrand"],
  verbrand: [],
};

export interface Overgangsuitspraak {
  toegestaan: boolean;
  /** Leeg wanneer de overgang mag. Anders de reden, in taal voor een beheerder. */
  reden: string;
}

/**
 * Toetst één overgang van `gebruik`.
 *
 * Geeft altijd een uitspraak terug en gooit nooit. De aanroeper beslist wat er
 * met een weigering gebeurt: `storage.ts` maakt er een `Error` van, een route
 * maakt er een 409 van, en een scherm zet de knop uit.
 */
export function magOvergang(van: Itemgebruik, naar: Itemgebruik): Overgangsuitspraak {
  if (!ITEMGEBRUIKEN.includes(van)) {
    return { toegestaan: false, reden: `Onbekend huidig gebruik: ${van}.` };
  }
  if (!ITEMGEBRUIKEN.includes(naar)) {
    return { toegestaan: false, reden: `Onbekend nieuw gebruik: ${naar}.` };
  }
  if (van === naar) {
    return { toegestaan: true, reden: "" };
  }
  if (TOEGESTANE_OVERGANGEN[van].includes(naar)) {
    return { toegestaan: true, reden: "" };
  }
  if (van === "verbrand") {
    return {
      toegestaan: false,
      reden:
        "Een verbrand item blijft verbrand. Het item is publiek geworden en dat " +
        "is niet terug te draaien; schrijf een nieuw item.",
    };
  }
  if (van === "oefenen" && naar === "meten") {
    return {
      toegestaan: false,
      reden:
        "Een oefenitem wordt nooit meetitem. Het item is inhoudelijk bekend bij " +
        "wie de oefenset heeft gezien; als meetitem zou het hoge scores opleveren " +
        "zonder dat er iets gemeten is.",
    };
  }
  return {
    toegestaan: false,
    reden: `De overgang ${van} naar ${naar} bestaat niet.`,
  };
}

/** Of een item met dit gebruik nog in een meetset mag. */
export function isMeetbaar(gebruik: Itemgebruik): boolean {
  return gebruik === "meten";
}

// ---------------------------------------------------------------------------
// De constructieregels
// ---------------------------------------------------------------------------

export interface Bevinding {
  veld: string;
  melding: string;
}

export interface ItemInvoer {
  instrumentId?: string | null;
  as?: string | null;
  blok?: string | null;
  soort?: string | null;
  stam?: string | null;
  opties?: readonly string[] | null;
  sleutel?: string | null;
  toelichtingGoed?: string | null;
  toelichtingFout?: string | null;
  gebruik?: string | null;
  bronVerwijzing?: string | null;
}

/** Een stam korter dan dit is geen item maar een aanzet. */
export const STAM_MINIMUM = 20;

/** Een toelichting korter dan dit legt niets uit. */
export const TOELICHTING_MINIMUM = 20;

/** Onder dit aantal opties is een meerkeuzevraag geen meerkeuzevraag. */
export const OPTIES_MINIMUM = 3;

/** Boven dit aantal opties meet het item leesuithoudingsvermogen. */
export const OPTIES_MAXIMUM = 6;

/**
 * De twee toegestane sleutels bij een juist-onjuistitem.
 *
 * In het Nederlands en in kleine letters, zoals alle andere opsommingen in dit
 * schema. `waar`/`onwaar` en `true`/`false` worden niet aanvaard: één woord voor
 * één ding, anders staan er over een jaar drie schrijfwijzen in de bank en telt
 * geen enkele zoekopdracht meer kloppend.
 */
export const JUISTFOUT_SLEUTELS = ["juist", "onjuist"] as const;

/**
 * Verboden optieteksten, uit draaiboek §4.3: "geen 'alle bovenstaande'".
 *
 * De lijst is opzettelijk kort en letterlijk. Een optie als "alle bovenstaande"
 * is geen inhoudelijke afleider maar een truc: ze toetst of de kandidaat de
 * andere opties allemaal apart heeft nagelopen, en dat is een toets op
 * nauwkeurigheid van lezen, niet op beoordelingsvermogen. Hetzelfde geldt voor
 * "geen van bovenstaande", die bovendien een item onnakijkbaar maakt zodra één
 * van de andere opties discutabel wordt.
 *
 * De vergelijking gebeurt op de genormaliseerde tekst: kleine letters, zonder
 * leestekens, met samengevouwen witruimte. Zo valt ook "Alle van de
 * bovenstaande." binnen de regel.
 */
const VERBODEN_OPTIEFRAGMENTEN = [
  "alle bovenstaande",
  "alle van bovenstaande",
  "alle van de bovenstaande",
  "geen van bovenstaande",
  "geen van de bovenstaande",
  "alle antwoorden zijn juist",
  "geen van deze",
] as const;

function normaliseer(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/[.,;:!?'"()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function leeg(waarde: string | null | undefined): boolean {
  return waarde === null || waarde === undefined || waarde.trim().length === 0;
}

/**
 * Toetst één item tegen de constructieregels.
 *
 * Geeft een lijst bevindingen; leeg betekent goedgekeurd. Nooit een `Error`, om
 * dezelfde reden als bij `valideerNormprofiel`: een formulier met twaalf velden
 * moet per veld kunnen aanwijzen wat er mis is, en dat kan niet met één
 * samengeplakte tekst.
 *
 * WAT HIER MET OPZET NIET WORDT GETOETST, en waarom niet:
 *
 *   - "Geen strikvragen." Niet vast te stellen zonder de vraag te begrijpen. Een
 *     toets die dit zou proberen, keurt af op woorden en niet op strikken.
 *   - "Geen dubbele ontkenningen." Verleidelijk om te zoeken op twee
 *     ontkennende woorden, maar de uitkomst zou onbetrouwbaar zijn in beide
 *     richtingen: "het is niet onmogelijk dat" wordt betrapt, "nooit geen" niet,
 *     en een correcte zin als "de coach mag niet stellen dat er geen verband is"
 *     wordt onterecht afgekeurd. Een toets die zowel gaten als valse treffers
 *     heeft, geeft een gevoel van dekking dat er niet is. Dit blijft werk voor de
 *     tegenlezer uit draaiboek-stap 1.4.
 *   - "Elk item gekoppeld aan één gedragsindicator uit §3.2." Die indicatoren
 *     staan nergens in machineleesbare vorm; zolang dat zo is, zou een toets
 *     alleen kunnen eisen dat `bronVerwijzing` gevuld is, en dat is geen
 *     koppeling maar de suggestie ervan.
 *   - "Items die alleen op leesvaardigheid discrimineren." Dat blijkt uit de
 *     itemanalyse na de eerste twintig afnames, niet uit de tekst.
 *
 * Deze vier zijn geen vergeten regels. Ze staan in het draaiboek als taak voor
 * een mens, en dat blijven ze.
 */
export function valideerItem(invoer: ItemInvoer): Bevinding[] {
  const bevindingen: Bevinding[] = [];

  // --- instrument ---------------------------------------------------------
  if (leeg(invoer.instrumentId)) {
    bevindingen.push({
      veld: "instrumentId",
      melding: "Kies het instrument waar dit item bij hoort.",
    });
  }

  // --- as ----------------------------------------------------------------
  const as = invoer.as ?? "";
  if (leeg(as)) {
    bevindingen.push({ veld: "as", melding: "Kies een as." });
  } else if (!(["weten", "zien", "zeggen", "zorgen"] as readonly string[]).includes(as)) {
    bevindingen.push({ veld: "as", melding: `Onbekende as: ${as}.` });
  }

  // --- blok --------------------------------------------------------------
  const blok = invoer.blok ?? null;
  if (blok !== null && blok.trim().length > 0) {
    if (!(KENNISCHECKBLOKKEN as readonly string[]).includes(blok)) {
      bevindingen.push({
        veld: "blok",
        melding: `Onbekend blok: ${blok}. Toegestaan is A tot E, of geen blok.`,
      });
    } else if (as !== "weten") {
      bevindingen.push({
        veld: "blok",
        melding:
          "Een kennischeckblok hoort bij de as weten. De blokken A tot E zijn de " +
          "indeling van de kennischeck, en de kennischeck meet weten.",
      });
    }
  }

  // --- soort -------------------------------------------------------------
  const soort = (invoer.soort ?? "") as Itemsoort;
  const soortBekend = (ITEMSOORTEN as readonly string[]).includes(soort);
  if (leeg(soort)) {
    bevindingen.push({ veld: "soort", melding: "Kies een itemsoort." });
  } else if (!soortBekend) {
    bevindingen.push({ veld: "soort", melding: `Onbekende itemsoort: ${soort}.` });
  }

  // --- stam --------------------------------------------------------------
  const stam = invoer.stam ?? "";
  if (leeg(stam)) {
    bevindingen.push({ veld: "stam", melding: "De vraagtekst ontbreekt." });
  } else if (stam.trim().length < STAM_MINIMUM) {
    bevindingen.push({
      veld: "stam",
      melding: `De vraagtekst is ${stam.trim().length} tekens en moet er minstens ${STAM_MINIMUM} zijn.`,
    });
  }

  // --- opties en sleutel -------------------------------------------------
  const opties = invoer.opties ?? null;
  const sleutel = (invoer.sleutel ?? "").trim();
  const heeftKeuzes = soort === "scenario" || soort === "meerkeuze";

  if (heeftKeuzes) {
    const lijst = opties ?? [];
    if (lijst.length === 0) {
      bevindingen.push({
        veld: "opties",
        melding: "Een item van deze soort heeft antwoordmogelijkheden nodig.",
      });
    } else {
      if (lijst.length < OPTIES_MINIMUM) {
        bevindingen.push({
          veld: "opties",
          melding: `Er zijn ${lijst.length} mogelijkheden en er moeten er minstens ${OPTIES_MINIMUM} zijn.`,
        });
      }
      if (lijst.length > OPTIES_MAXIMUM) {
        bevindingen.push({
          veld: "opties",
          melding: `Er zijn ${lijst.length} mogelijkheden; boven ${OPTIES_MAXIMUM} meet het item vooral leesuithoudingsvermogen.`,
        });
      }
      if (lijst.some((o) => leeg(o))) {
        bevindingen.push({ veld: "opties", melding: "Een van de mogelijkheden is leeg." });
      }
      const genormaliseerd = lijst.map(normaliseer);
      const gezien = new Set<string>();
      for (const o of genormaliseerd) {
        if (o.length > 0 && gezien.has(o)) {
          bevindingen.push({
            veld: "opties",
            melding: "Twee mogelijkheden zijn gelijk.",
          });
          break;
        }
        gezien.add(o);
      }
      for (let i = 0; i < genormaliseerd.length; i += 1) {
        const o = genormaliseerd[i]!;
        const treffer = VERBODEN_OPTIEFRAGMENTEN.find((v) => o.includes(v));
        if (treffer !== undefined) {
          bevindingen.push({
            veld: "opties",
            melding:
              `Mogelijkheid ${LETTERS[i] ?? i + 1} bevat "${treffer}". Dat is geen ` +
              "inhoudelijke afleider maar een toets op nauwkeurig lezen.",
          });
        }
      }
    }

    // De sleutel is de letter van de juiste mogelijkheid: A, B, C, ... Eén
    // ondubbelzinnige vorm, en die sluit aan bij de voorbeelditems in het
    // draaiboek ("Sleutel: C"). De volledige antwoordtekst als sleutel opslaan
    // zou betekenen dat een spelfout herstellen in een optie de sleutel breekt.
    if (leeg(sleutel)) {
      bevindingen.push({
        veld: "sleutel",
        melding: "Geef met een letter aan welke mogelijkheid juist is.",
      });
    } else {
      const index = letterNaarIndex(sleutel);
      if (index === null) {
        bevindingen.push({
          veld: "sleutel",
          melding: `De sleutel is "${sleutel}"; verwacht wordt één letter, A tot ${LETTERS[OPTIES_MAXIMUM - 1]}.`,
        });
      } else if (lijst.length > 0 && index >= lijst.length) {
        bevindingen.push({
          veld: "sleutel",
          melding: `De sleutel wijst naar mogelijkheid ${sleutel.toUpperCase()}, maar er zijn er ${lijst.length}.`,
        });
      }
    }
  } else if (soort === "juistfout") {
    if (opties !== null && opties.length > 0) {
      bevindingen.push({
        veld: "opties",
        melding: "Een juist-onjuistitem heeft geen eigen mogelijkheden.",
      });
    }
    if (!(JUISTFOUT_SLEUTELS as readonly string[]).includes(sleutel.toLowerCase())) {
      bevindingen.push({
        veld: "sleutel",
        melding: `De sleutel moet ${JUISTFOUT_SLEUTELS.join(" of ")} zijn.`,
      });
    }
  } else if (soort === "open") {
    if (leeg(sleutel)) {
      bevindingen.push({
        veld: "sleutel",
        melding:
          "Een open item heeft een scoringssleutel nodig: waaraan een antwoord " +
          "moet voldoen om als juist te gelden.",
      });
    } else if (sleutel.length < TOELICHTING_MINIMUM) {
      bevindingen.push({
        veld: "sleutel",
        melding:
          `De scoringssleutel is ${sleutel.length} tekens. Bij een open item leest een ` +
          `mens hiermee na; onder ${TOELICHTING_MINIMUM} tekens staat er te weinig om op te beoordelen.`,
      });
    }
  }

  // --- de twee toelichtingen ---------------------------------------------
  for (const [veld, waarde] of [
    ["toelichtingGoed", invoer.toelichtingGoed],
    ["toelichtingFout", invoer.toelichtingFout],
  ] as const) {
    if (leeg(waarde)) {
      bevindingen.push({ veld, melding: "De toelichting ontbreekt." });
    } else if (waarde!.trim().length < TOELICHTING_MINIMUM) {
      bevindingen.push({
        veld,
        melding: `De toelichting is ${waarde!.trim().length} tekens en moet er minstens ${TOELICHTING_MINIMUM} zijn.`,
      });
    }
  }

  // --- gebruik -----------------------------------------------------------
  const gebruik = invoer.gebruik ?? null;
  if (gebruik !== null && !(ITEMGEBRUIKEN as readonly string[]).includes(gebruik)) {
    bevindingen.push({ veld: "gebruik", melding: `Onbekend gebruik: ${gebruik}.` });
  }

  return bevindingen;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * Zet een sleutelletter om in een index. Geeft `null` bij alles wat geen enkele
 * letter uit `LETTERS` is — dus ook bij "AB", bij "1" en bij een lege tekst.
 */
export function letterNaarIndex(sleutel: string): number | null {
  const s = sleutel.trim().toUpperCase();
  if (s.length !== 1) return null;
  const index = (LETTERS as readonly string[]).indexOf(s);
  return index === -1 ? null : index;
}

/** De letter die bij een index hoort, voor weergave. */
export function indexNaarLetter(index: number): string {
  return LETTERS[index] ?? String(index + 1);
}

/** Of deze itemsoort door een machine kan worden nagekeken. */
export function isAutomatischScoorbaar(soort: string): boolean {
  return (AUTOMATISCH_SCOORBARE_SOORTEN as readonly string[]).includes(soort);
}

/**
 * De blokdekking van een bank: hoeveel meetbare items er per blok zijn.
 *
 * Bedoeld voor het beheerscherm en voor de samensteller, die hiermee kan melden
 * welk blok tekortkomt in plaats van alleen dat er een tekort is. Draaiboek §4.3:
 * "Indicatoren zonder item = een gat in de dekking." Een gat dat je niet kan
 * benoemen, wordt niet gedicht.
 */
export function blokdekking(
  items: readonly { blok?: string | null; gebruik: string; actief?: boolean }[],
): Record<Kennischeckblok, number> {
  const dekking: Record<Kennischeckblok, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const item of items) {
    if (item.actief === false) continue;
    if (item.gebruik !== "meten") continue;
    const blok = item.blok ?? null;
    if (blok !== null && blok in dekking) {
      dekking[blok as Kennischeckblok] += 1;
    }
  }
  return dekking;
}

/** Het type dat de assen van een item beschrijft, voor aanroepers. */
export type ItemAs = As;
