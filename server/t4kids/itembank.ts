// ---------------------------------------------------------------------------
// server/t4kids/itembank.ts — NIEUW BESTAND (strikt additief).
//
// Eén bron van waarheid voor de T4Kids-itembank (kindvriendelijke
// talent-ontdekkingsreis, 10-13 jaar). Gecureerd uit de authentieke brondata
// (t4k_stellingen.json, 143 stellingen · t4k_archetypen.json, 79 archetypen) en
// HERSCHREVEN naar warme, concrete, niet-oordelende kindtaal.
//
// Hybride meetmodel — 3 modules ("eilanden"):
//   Module 1  Ontdekkingsreis   → beeld-forced-choice interesseparen (6 talent-foci)
//   Module 2  Archetypen-galerij → 28 gecureerde archetypen (gebalanceerd over 6 foci)
//   Module 3  Zo-ben-ik-nu       → 4-punts woordschaal (sterktes + drivers)
//
// De interne mapping (focus / versneller / driver) is METADATA voor de scoring
// en wordt NOOIT aan het kind getoond. Dit bestand bevat geen I/O en geen
// afhankelijkheden — puur data — zodat zowel de vragenlijst-route, de
// question-manager als de scoring-adapter er veilig uit kunnen lezen.
// ---------------------------------------------------------------------------

// De 6 brede talent-foci (kindvriendelijke, niet-oordelende domeinen).
export type Focus =
  | "Abstraherend"
  | "Doelgericht-Creatief"
  | "Sociaal-gericht"
  | "Uitvoerend"
  | "Overdracht-gericht"
  | "Artistiek-Creatief";

export const T4KIDS_FOCI: Focus[] = [
  "Abstraherend",
  "Doelgericht-Creatief",
  "Sociaal-gericht",
  "Uitvoerend",
  "Overdracht-gericht",
  "Artistiek-Creatief",
];

// Publieke (kind-zichtbare) omschrijving per focus — in concrete activiteitentaal,
// nooit als etiket ("jij bent...").
export const FOCUS_ACTIVITEIT: Record<Focus, string> = {
  "Abstraherend": "dingen uitzoeken, uitpluizen en puzzels oplossen",
  "Doelgericht-Creatief": "nieuwe dingen bedenken, uitvinden en verbeteren",
  "Sociaal-gericht": "mensen helpen en zorgen dat iedereen zich goed voelt",
  "Uitvoerend": "dingen maken, herstellen en met je handen bezig zijn",
  "Overdracht-gericht": "iets uitleggen, vertellen of voordoen aan anderen",
  "Artistiek-Creatief": "tekenen, muziek maken, schrijven en iets moois maken",
};

// ─── Module 1 — Ontdekkingsreis (beeld-forced-choice interesseparen) ──────────
export interface InteresseKant {
  tekst: string; // warme, beeldbare kindtaal — GEEN beroepslabel
  focus: Focus; // interne mapping (niet tonen)
}
export interface InteressePaar {
  id: string; // T4K-I-NN
  links: InteresseKant;
  rechts: InteresseKant;
}

export const T4KIDS_INTERESSE_PAREN: InteressePaar[] = [
  { id: "T4K-I-01", links: { tekst: "Uitzoeken hoe iets precies werkt", focus: "Abstraherend" }, rechts: { tekst: "Tekenen of schilderen wat je fantaseert", focus: "Artistiek-Creatief" } },
  { id: "T4K-I-02", links: { tekst: "Iemand helpen die het moeilijk heeft", focus: "Sociaal-gericht" }, rechts: { tekst: "Iets maken of in elkaar zetten met je handen", focus: "Uitvoerend" } },
  { id: "T4K-I-03", links: { tekst: "Iets nieuws uitvinden dat nog niet bestaat", focus: "Doelgericht-Creatief" }, rechts: { tekst: "Iets uitleggen aan iemand anders", focus: "Overdracht-gericht" } },
  { id: "T4K-I-04", links: { tekst: "Een dansje of een muziekje maken", focus: "Artistiek-Creatief" }, rechts: { tekst: "Een moeilijke puzzel of raadsel oplossen", focus: "Abstraherend" } },
  { id: "T4K-I-05", links: { tekst: "Iets herstellen dat stuk is", focus: "Uitvoerend" }, rechts: { tekst: "Zorgen dat iedereen in de groep zich goed voelt", focus: "Sociaal-gericht" } },
  { id: "T4K-I-06", links: { tekst: "Een spreekbeurt of verhaal voor de klas doen", focus: "Overdracht-gericht" }, rechts: { tekst: "Een game of app bedenken", focus: "Doelgericht-Creatief" } },
  { id: "T4K-I-07", links: { tekst: "Ontdekken waarom iets kapot ging", focus: "Abstraherend" }, rechts: { tekst: "Een lekker gerecht koken", focus: "Uitvoerend" } },
  { id: "T4K-I-08", links: { tekst: "Een ruzie helpen oplossen", focus: "Sociaal-gericht" }, rechts: { tekst: "Een verhaal of gedicht schrijven", focus: "Artistiek-Creatief" } },
  { id: "T4K-I-09", links: { tekst: "Een ingewikkeld bouwwerk met lego of k'nex maken", focus: "Doelgericht-Creatief" }, rechts: { tekst: "Getallen- en denkpuzzels maken", focus: "Abstraherend" } },
  { id: "T4K-I-10", links: { tekst: "Anderen aan het lachen maken", focus: "Overdracht-gericht" }, rechts: { tekst: "Luisteren naar iemand die verdrietig is", focus: "Sociaal-gericht" } },
  { id: "T4K-I-11", links: { tekst: "Iets moois ontwerpen of versieren", focus: "Artistiek-Creatief" }, rechts: { tekst: "Een klus tot in de puntjes afwerken", focus: "Uitvoerend" } },
  { id: "T4K-I-12", links: { tekst: "Een plan bedenken met alle stapjes op een rij", focus: "Abstraherend" }, rechts: { tekst: "Iemand iets aanleren", focus: "Overdracht-gericht" } },
  { id: "T4K-I-13", links: { tekst: "Bedenken hoe je iets beter kunt maken", focus: "Doelgericht-Creatief" }, rechts: { tekst: "Nieuwe vriendjes maken en samen spelen", focus: "Sociaal-gericht" } },
  { id: "T4K-I-14", links: { tekst: "Buiten sporten of iets actiefs doen", focus: "Uitvoerend" }, rechts: { tekst: "Toneelspelen of je verkleden", focus: "Artistiek-Creatief" } },
  { id: "T4K-I-15", links: { tekst: "Samen met vrienden iets moois voor de wereld bedenken", focus: "Sociaal-gericht" }, rechts: { tekst: "Iets uitpluizen tot je er (bijna) alles van weet", focus: "Abstraherend" } },
  { id: "T4K-I-16", links: { tekst: "Een spannend verhaal vertellen", focus: "Overdracht-gericht" }, rechts: { tekst: "Fantaseren over nieuwe ideeën", focus: "Doelgericht-Creatief" } },
];

// ─── Module 2 — Archetypen-galerij (28 gecureerd, gebalanceerd) ───────────────
export interface Archetype {
  id: string; // T4K-A-NN
  naam: string; // kindvriendelijke naam
  focus: Focus; // interne mapping (niet tonen)
}

export const T4KIDS_ARCHETYPEN: Archetype[] = [
  // Abstraherend (5)
  { id: "T4K-A-01", naam: "de detective", focus: "Abstraherend" },
  { id: "T4K-A-02", naam: "de geleerde", focus: "Abstraherend" },
  { id: "T4K-A-03", naam: "de oplosser", focus: "Abstraherend" },
  { id: "T4K-A-04", naam: "de wetenschapper", focus: "Abstraherend" },
  { id: "T4K-A-05", naam: "de ontdekkingsreiziger", focus: "Abstraherend" },
  // Doelgericht-Creatief (5)
  { id: "T4K-A-06", naam: "de uitvinder", focus: "Doelgericht-Creatief" },
  { id: "T4K-A-07", naam: "de avonturier", focus: "Doelgericht-Creatief" },
  { id: "T4K-A-08", naam: "de pionier", focus: "Doelgericht-Creatief" },
  { id: "T4K-A-09", naam: "de dromer-met-plannen", focus: "Doelgericht-Creatief" },
  { id: "T4K-A-10", naam: "de durver", focus: "Doelgericht-Creatief" },
  // Sociaal-gericht (5)
  { id: "T4K-A-11", naam: "de helper", focus: "Sociaal-gericht" },
  { id: "T4K-A-12", naam: "de beschermer", focus: "Sociaal-gericht" },
  { id: "T4K-A-13", naam: "de gids", focus: "Sociaal-gericht" },
  { id: "T4K-A-14", naam: "de verbinder", focus: "Sociaal-gericht" },
  { id: "T4K-A-15", naam: "de redder", focus: "Sociaal-gericht" },
  // Uitvoerend (5)
  { id: "T4K-A-16", naam: "de bouwer", focus: "Uitvoerend" },
  { id: "T4K-A-17", naam: "de kok", focus: "Uitvoerend" },
  { id: "T4K-A-18", naam: "de ridder", focus: "Uitvoerend" },
  { id: "T4K-A-19", naam: "de held(in)", focus: "Uitvoerend" },
  { id: "T4K-A-20", naam: "de knutselaar", focus: "Uitvoerend" },
  // Overdracht-gericht (4)
  { id: "T4K-A-21", naam: "de leraar", focus: "Overdracht-gericht" },
  { id: "T4K-A-22", naam: "de verteller", focus: "Overdracht-gericht" },
  { id: "T4K-A-23", naam: "de toneelspeler", focus: "Overdracht-gericht" },
  { id: "T4K-A-24", naam: "de grappenmaker", focus: "Overdracht-gericht" },
  // Artistiek-Creatief (4)
  { id: "T4K-A-25", naam: "de kunstenaar", focus: "Artistiek-Creatief" },
  { id: "T4K-A-26", naam: "de danser(es)", focus: "Artistiek-Creatief" },
  { id: "T4K-A-27", naam: "de muziekmaker", focus: "Artistiek-Creatief" },
  { id: "T4K-A-28", naam: "de schrijver", focus: "Artistiek-Creatief" },
];

export const T4KIDS_ARCHETYPE_MAX_KEUZE = 8;
export const T4KIDS_ARCHETYPE_TOP_N = 3;

// ─── Module 3 — Zo-ben-ik-nu (4-punts woordschaal) ────────────────────────────
// GEEN cijfers voor het kind — enkel woorden. Interne waarde 0..3.
export const T4KIDS_WOORDSCHAAL: { waarde: number; label: string }[] = [
  { waarde: 0, label: "bijna nooit" },
  { waarde: 1, label: "soms" },
  { waarde: 2, label: "vaak" },
  { waarde: 3, label: "bijna altijd" },
];

export type StellingSoort = "Sterkte" | "Driver";

export interface Stelling {
  id: string; // T4K-Z-NN
  tekst: string; // "ik"-vorm, kindtaal
  soort: StellingSoort;
  // interne mapping: versneller (bij Sterkte) of driver (bij Driver)
  mapping: string;
  // autonomie-as (enkel zinvol bij Driver): intrinsiek vs extrinsiek gemotiveerd
  autonomie?: "intrinsiek" | "extrinsiek";
}

export const T4KIDS_STELLINGEN: Stelling[] = [
  // Sterktes (talent-versnellers) — 8
  { id: "T4K-Z-01", tekst: "Ik blijf doorgaan, ook als iets moeilijk is", soort: "Sterkte", mapping: "Resultaatgericht" },
  { id: "T4K-Z-02", tekst: "Ik zoek graag uit hoe iets precies werkt", soort: "Sterkte", mapping: "Analytisch vermogen" },
  { id: "T4K-Z-03", tekst: "Ik help graag als iemand vastzit", soort: "Sterkte", mapping: "Groepsondersteunend" },
  { id: "T4K-Z-04", tekst: "Als ik iets doe, wil ik het echt goed kunnen", soort: "Sterkte", mapping: "Excelleren" },
  { id: "T4K-Z-05", tekst: "Andere kinderen luisteren vaak naar mijn idee", soort: "Sterkte", mapping: "Invloedrijk" },
  { id: "T4K-Z-06", tekst: "Ik merk snel wanneer iemand zich niet goed voelt", soort: "Sterkte", mapping: "Individu-ondersteunend" },
  { id: "T4K-Z-07", tekst: "Ik doe graag dingen die ik zelf belangrijk vind", soort: "Sterkte", mapping: "Kernenergie" },
  { id: "T4K-Z-08", tekst: "Ik werk graag stap voor stap naar een mooi eindresultaat toe", soort: "Sterkte", mapping: "Resultaatgericht" },
  // Drivers / autonomie (TA-drivers, verzacht) — 5
  { id: "T4K-Z-09", tekst: "Ik wil dat mijn werk helemaal juist en netjes is", soort: "Driver", mapping: "Be Perfect", autonomie: "intrinsiek" },
  { id: "T4K-Z-10", tekst: "Ik doe graag dingen zodat anderen blij zijn", soort: "Driver", mapping: "Please Others", autonomie: "extrinsiek" },
  { id: "T4K-Z-11", tekst: "Ik doe het liefst veel dingen tegelijk, en het mag snel gaan", soort: "Driver", mapping: "Hurry Up", autonomie: "intrinsiek" },
  { id: "T4K-Z-12", tekst: "Ik doe extra mijn best als iemand in mij gelooft", soort: "Driver", mapping: "Try Hard", autonomie: "extrinsiek" },
  { id: "T4K-Z-13", tekst: "Ook als iets moeilijk is, blijf ik rustig en pak ik het zelf aan", soort: "Driver", mapping: "Be Strong", autonomie: "intrinsiek" },
];

// ─── Afgeleide, platte itemlijst (voor question-manager / laadInstrumentItems) ─
// family = het domein (module), construct = de interne mapping-sleutel.
export interface T4KidsFlatItem {
  id: string;
  domein: "Interesse" | "Archetype" | "Sterkte" | "Driver";
  cluster: string;
  tekst: string;
}

export const T4KIDS_ITEMS_FLAT: T4KidsFlatItem[] = [
  ...T4KIDS_INTERESSE_PAREN.map((p) => ({
    id: p.id,
    domein: "Interesse" as const,
    cluster: `${p.links.focus} / ${p.rechts.focus}`,
    tekst: `${p.links.tekst}  —OF—  ${p.rechts.tekst}`,
  })),
  ...T4KIDS_ARCHETYPEN.map((a) => ({
    id: a.id,
    domein: "Archetype" as const,
    cluster: a.focus,
    tekst: a.naam,
  })),
  ...T4KIDS_STELLINGEN.map((s) => ({
    id: s.id,
    domein: s.soort,
    cluster: s.mapping,
    tekst: s.tekst,
  })),
];

// Snelle opzoektabellen voor de scoring.
export const INTERESSE_PAAR_BY_ID: Record<string, InteressePaar> = Object.fromEntries(
  T4KIDS_INTERESSE_PAREN.map((p) => [p.id, p]),
);
export const ARCHETYPE_BY_ID: Record<string, Archetype> = Object.fromEntries(
  T4KIDS_ARCHETYPEN.map((a) => [a.id, a]),
);
export const STELLING_BY_ID: Record<string, Stelling> = Object.fromEntries(
  T4KIDS_STELLINGEN.map((s) => [s.id, s]),
);
