/**
 * TAPAS 4 Recruitment — vraagbibliotheek v1 + moduledefinitie.
 * Eén bron van waarheid voor frontend en rapport. Afgeleid uit het functioneel ontwerp.
 */

export type VraagType =
  | "classificatie"
  | "drempel"
  | "context"
  | "prioriteit"
  | "discussie"
  | "toelichting"
  | "validatie";

export type ItemLabel =
  | "informatie"
  | "profielvormend"
  | "drempel"
  | "risico"
  | "monitoring";

export type Zone = "sessie" | "context" | "profielbouw" | "waakzaamheid" | "finalisatie";

/**
 * Schaaldefinitie per item.
 * - intensity: 5-punt zeer laag -> zeer hoog (default voor 'hoeveelheid'-vragen)
 * - bipolar: 5-punt tussen twee benoemde polen (links/rechts)
 * - choice: vaste categoriekeuze (geen schaal)
 * - open: enkel open tekst, geen schaal
 */
export type ScaleKind = "intensity" | "bipolar" | "choice" | "open";

export interface ScaleDef {
  kind: ScaleKind;
  // voor bipolar: labels van de twee polen
  poleLeft?: string;
  poleRight?: string;
  // voor choice: expliciete opties
  options?: { value: string; label: string }[];
}

export interface LibraryItem {
  id: string;
  type: VraagType;
  label: ItemLabel;
  text: string;
  help?: string;
  scale?: ScaleDef;
  /**
   * Verborgen herkomst-koppeling (NOOIT zichtbaar voor respondenten — item-blinding).
   * cluster = het TaPas-cluster waaruit de stelling is geherformuleerd.
   * sourceRefs = de exacte bron-ID's uit de volledige TaPas-vragenlijst die dit item afdekt.
   * Dit borgt dat elke app-vraag traceerbaar gekoppeld blijft aan een gevalideerde stelling.
   */
  cluster?: string;
  sourceRefs?: string[];
}

/** Benoemde werkcontext voor Module 4 (classificatie i.p.v. schaal). */
export interface WorkContext {
  id: string;
  name: string;
  desc: string;
}

export interface ModuleDef {
  nr: number;
  key: string;
  title: string;
  zone: Zone;
  intro: string;
  // schermtype bepaalt rendering
  kind: "context" | "decision" | "consolidatie" | "drempel" | "risico" | "finalisatie" | "selectie";
  items: LibraryItem[];
  // alleen voor kind 'selectie' (Module 4): de benoemde werkcontexten
  workContexts?: WorkContext[];
}

export const ZONE_LABEL: Record<Zone, string> = {
  sessie: "Sessie",
  context: "Context",
  profielbouw: "Profielbouw",
  waakzaamheid: "Waakzaamheid",
  finalisatie: "Finalisatie",
};

export const MODULES: ModuleDef[] = [
  {
    nr: 2,
    key: "context",
    title: "Contextkalibratie",
    zone: "context",
    kind: "context",
    intro:
      "Expliciteer de organisatie-, verander- en complexiteitscontext. Deze antwoorden voeden later de contextuele minimumdrempel.",
    items: [
      { id: "M2-01", type: "context", label: "informatie", text: "Hoe hoog is de huidige veranderdruk in deze context?" },
      { id: "M2-02", type: "context", label: "informatie", text: "Hoe hoog is de relationele complexiteit van de omgeving?" },
      { id: "M2-03", type: "context", label: "informatie", text: "Hoe stabiel of volatiel is de bredere organisatiecontext?", scale: { kind: "bipolar", poleLeft: "Zeer stabiel", poleRight: "Zeer volatiel" } },
      { id: "M2-04", type: "context", label: "informatie", text: "Hoe hoog is de prestatiedruk die op deze rol rust?" },
      { id: "M2-05", type: "context", label: "informatie", text: "Hoeveel ambiguïteit en onzekerheid hoort structureel bij deze context?" },
      { id: "M2-06", type: "context", label: "informatie", text: "Hoeveel herstelruimte of draagkracht biedt de context?" },
      { id: "M2-07", type: "toelichting", label: "informatie", text: "Welke contextuele bijzonderheden zijn essentieel om te begrijpen?" },
    ],
  },
  {
    nr: 3,
    key: "rol",
    title: "Rolarchitectuur",
    zone: "context",
    kind: "context",
    intro: "Leg de structurele aard van de rol vast: autonomie, beslissingsruimte, samenwerkingsvorm en verantwoordelijkheid.",
    items: [
      { id: "M3-01", type: "context", label: "informatie", text: "Hoeveel autonomie en regelruimte biedt de rol?" },
      { id: "M3-02", type: "context", label: "informatie", text: "Hoe groot is de beslissings- en verantwoordelijkheidsruimte?" },
      { id: "M3-03", type: "context", label: "informatie", text: "Hoe werkt de rol overwegend samen?", scale: { kind: "choice", options: [{ value: "solo", label: "Overwegend solo" }, { value: "team", label: "Binnen een team" }, { value: "transversaal", label: "Sterk transversaal" }] } },
      { id: "M3-04", type: "context", label: "informatie", text: "Waar ligt het zwaartepunt: uitvoerend of leidinggevend?", scale: { kind: "bipolar", poleLeft: "Sterk uitvoerend", poleRight: "Sterk leidinggevend" } },
      { id: "M3-05", type: "context", label: "informatie", text: "Waar ligt het zwaartepunt: operationeel of strategisch?", scale: { kind: "bipolar", poleLeft: "Sterk operationeel", poleRight: "Sterk strategisch" } },
      { id: "M3-06", type: "context", label: "informatie", text: "Hoe vast of evolutief is de roldefinitie zelf?", scale: { kind: "bipolar", poleLeft: "Zeer vast", poleRight: "Sterk evolutief" } },
      { id: "M3-07", type: "discussie", label: "informatie", text: "Waar verschillen stakeholders mogelijk van mening over de aard van de rol?" },
    ],
  },
  {
    nr: 4,
    key: "werkcontext",
    title: "Kritische werkcontexten",
    zone: "context",
    kind: "selectie",
    intro:
      "Beoordeel per benoemde werkcontext hoe bepalend die is voor succes in de rol. Markeer waar nodig de meest kritische context en de grootste risicozone. Zo is steeds duidelijk over welke context het gaat.",
    workContexts: [
      { id: "WC-01", name: "Werken onder hoge druk en deadlines", desc: "Situaties met tijdsdruk, pieken en hoge output-eisen." },
      { id: "WC-02", name: "Verandering en transitie", desc: "Reorganisatie, nieuwe werkwijzen, voortdurend bijsturen." },
      { id: "WC-03", name: "Intensieve samenwerking en afstemming", desc: "Veel overleg, afhankelijkheid van anderen, teamdynamiek." },
      { id: "WC-04", name: "Autonoom en zelfsturend werken", desc: "Zelfstandig prioriteren en beslissen met weinig kader." },
      { id: "WC-05", name: "Klant- en stakeholdercontact", desc: "Direct contact met klanten, partners of belanghebbenden." },
      { id: "WC-06", name: "Complexe besluitvorming en analyse", desc: "Onzekere, veelzijdige vraagstukken die oordeel vragen." },
      { id: "WC-07", name: "Routine, volume en consistentie", desc: "Herhaalbaar werk waarin nauwkeurigheid en bestendigheid tellen." },
      { id: "WC-08", name: "Conflict en gevoelige situaties", desc: "Spanning, tegengestelde belangen of emotioneel zware context." },
    ],
    items: [
      { id: "M4-99", type: "toelichting", label: "informatie", text: "Welke context-specifieke succes- of faalvoorbeelden zijn relevant?" },
    ],
  },
  {
    nr: 5,
    key: "drivers",
    title: "Gewenst profiel op driverniveau",
    zone: "profielbouw",
    kind: "decision",
    intro: "Bepaal per werkstijl-driver of die need to have, nice to have of not needed is voor de rol. Drivers zijn de onbewuste patronen die — in de juiste context — als gaspedaal werken en bij controleverlies als rem.",
    items: [
      { id: "M5-BS-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die zelfgekozen verantwoordelijkheid draagt en grotendeels autonoom alles managet.", help: "Standvastigheid en eigen regie.", cluster: "Be Strong", sourceRefs: ["1.1", "1.3"] },
      { id: "M5-BS-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die emotioneel stabiel en kalm blijft, ook onder spanning.", help: "Rationaliteit en kalmte onder druk.", cluster: "Be Strong", sourceRefs: ["1.6", "1.7", "1.8"] },
      { id: "M5-BP-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt uitgesproken nauwkeurigheid en afwerking tot in de puntjes.", help: "Grondigheid en precisie.", cluster: "Be Perfect", sourceRefs: ["2.1", "2.5"] },
      { id: "M5-BP-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt een hoge kwaliteitslat waarbij afwijkingen meteen worden opgemerkt.", help: "Kwaliteitsbewustzijn en oog voor detail.", cluster: "Be Perfect", sourceRefs: ["2.2", "2.8"] },
      { id: "M5-HU-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die veel taken gelijktijdig beheert en daarin een meerwaarde vindt.", help: "Multitasking als kracht.", cluster: "Hurry Up", sourceRefs: ["3.1", "3.3"] },
      { id: "M5-HU-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt hoog werktempo en productiviteit onder tijdsdruk.", help: "Snelheid en momentum.", cluster: "Hurry Up", sourceRefs: ["3.2", "3.7"] },
      { id: "M5-TH-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt sterke prestatiedrang en volgehouden inzet richting succes.", help: "Volharding gericht op succes.", cluster: "Try Hard", sourceRefs: ["4.4", "4.8"] },
      { id: "M5-TH-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die zich wil bewijzen en uitgedaagd voelt in een veeleisende omgeving.", help: "Bewijsdrang en uitdaging.", cluster: "Try Hard", sourceRefs: ["4.1", "4.7"] },
      { id: "M5-PO-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt sterke gerichtheid op de noden en wensen van anderen.", help: "Dienstbaarheid en afstemming.", cluster: "Please Others", sourceRefs: ["5.1", "5.5", "5.8"] },
      { id: "M5-PO-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt diplomatie en het zoeken naar aanvaarding en harmonie.", help: "Diplomatisch en harmoniegericht.", cluster: "Please Others", sourceRefs: ["5.2", "5.3"] },
      { id: "M5-DISC", type: "discussie", label: "profielvormend", text: "Welke driver levert de grootste discussie op tussen stakeholders?" },
    ],
  },
  {
    nr: 6,
    key: "foci",
    title: "Gewenst profiel op talent-foci",
    zone: "profielbouw",
    kind: "decision",
    intro: "Bepaal per talentfocus de classificatie. Een cruciale focus mag niet zomaar als not needed gelden.",
    items: [
      { id: "M6-A-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt sterk relationeel talent: aanvoelen wat speelt en moeilijkheden bespreekbaar maken.", cluster: "Interrelatie", sourceRefs: ["A.1", "A.2", "A.7"] },
      { id: "M6-A-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt talent in teamwerk en het vlot opbouwen van netwerken en contacten.", cluster: "Interrelatie", sourceRefs: ["A.4", "A.6"] },
      { id: "M6-B-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt operationeel talent: denken meteen omzetten in actie en resultaat.", cluster: "Operatie", sourceRefs: ["B.1", "B.4"] },
      { id: "M6-B-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt talent om problemen als uitdaging op te lossen en daadkrachtig te sturen in crisis.", cluster: "Operatie", sourceRefs: ["B.2", "B.7", "B.8"] },
      { id: "M6-C-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt strategisch talent: langetermijndoelen formuleren en het geheel overzien.", cluster: "Strategie", sourceRefs: ["C.1", "C.6"] },
      { id: "M6-C-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt talent om strategie te vertalen naar meetbare resultaten, structuren en systemen.", cluster: "Strategie", sourceRefs: ["C.2", "C.4"] },
      { id: "M6-D-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt innovatief talent: nieuwe oplossingen en ideeën die anderen inspireren.", cluster: "Innovatie", sourceRefs: ["D.1", "D.3"] },
      { id: "M6-D-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt talent om een organisatie een nieuwe richting te geven en talenten te verbinden.", cluster: "Innovatie", sourceRefs: ["D.2", "D.7"] },
      { id: "M6-DREMPEL", type: "drempel", label: "drempel", text: "Is er een talentfocus die in deze context cruciaal is en dus niet als not needed mag gelden?" },
    ],
  },
  {
    nr: 7,
    key: "versnellers",
    title: "Gewenst profiel op talent-versnellers",
    zone: "profielbouw",
    kind: "decision",
    intro: "Bepaal per versneller de classificatie en markeer sleutelversnellers.",
    items: [
      { id: "M7-a-1", type: "classificatie", label: "profielvormend", text: "Analytisch inzicht versnelt succes: complexe problemen ontwarren en oorzaken doorgronden.", cluster: "Analyse", sourceRefs: ["a.4", "a.5"] },
      { id: "M7-a-2", type: "classificatie", label: "profielvormend", text: "Het scherp ordenen van chaos en logisch redeneren versnelt succes in deze rol.", cluster: "Analyse", sourceRefs: ["a.8", "a.9", "a.10"] },
      { id: "M7-b-1", type: "classificatie", label: "profielvormend", text: "Coachend talent versnelt succes: mensen vanuit hun talenten aansporen en laten groeien.", cluster: "Coaching", sourceRefs: ["b.5", "b.1"] },
      { id: "M7-b-2", type: "classificatie", label: "profielvormend", text: "Sensitief begeleiden en de juiste vragen stellen tot eigen inzicht versnelt succes.", cluster: "Coaching", sourceRefs: ["b.6", "b.8"] },
      { id: "M7-c-1", type: "classificatie", label: "profielvormend", text: "Onderscheidend talent versnelt succes: visie en missie formuleren en negatief ombuigen naar positief.", cluster: "Onderscheiden", sourceRefs: ["c.1", "c.2"] },
      { id: "M7-c-2", type: "classificatie", label: "profielvormend", text: "Een substantiële, resultaatverbeterende persoonlijke bijdrage versnelt succes.", cluster: "Onderscheiden", sourceRefs: ["c.7", "c.10"] },
      { id: "M7-d-1", type: "classificatie", label: "profielvormend", text: "Facilitatietalent versnelt succes: mensen en teams door verandering begeleiden.", cluster: "Faciliteren", sourceRefs: ["d.1", "d.6"] },
      { id: "M7-d-2", type: "classificatie", label: "profielvormend", text: "Verschillen binnen een team afstemmen op een gemeenschappelijk doel versnelt succes.", cluster: "Faciliteren", sourceRefs: ["d.5", "d.9"] },
      { id: "M7-e-1", type: "classificatie", label: "profielvormend", text: "Impact versnelt succes: mensen in beweging krijgen en als leider aangevoeld worden.", cluster: "Impacteren", sourceRefs: ["e.1", "e.3"] },
      { id: "M7-e-2", type: "classificatie", label: "profielvormend", text: "Vertrouwen en charisma versnellen succes in het beïnvloeden van resultaten.", cluster: "Impacteren", sourceRefs: ["e.4", "e.6", "e.8"] },
      { id: "M7-f-1", type: "classificatie", label: "profielvormend", text: "Resultaatgerichtheid versnelt succes: afmaken wat begonnen is en tastbaar resultaat leveren.", cluster: "Resultaat", sourceRefs: ["f.6", "f.8"] },
      { id: "M7-f-2", type: "classificatie", label: "profielvormend", text: "Onder druk de beste resultaten halen met een doener- en winnersmentaliteit versnelt succes.", cluster: "Resultaat", sourceRefs: ["f.3", "f.9", "f.10"] },
      { id: "M7-PRIO", type: "prioriteit", label: "profielvormend", text: "Markeer de sleutelversneller(s) die minstens als need to have moeten gelden." },
      { id: "M7-DREMPEL", type: "drempel", label: "drempel", text: "Is een als sleutelversneller gemarkeerd item ook effectief als need to have bevestigd?" },
    ],
  },
  {
    nr: 8,
    key: "zelfbeeld",
    title: "Gewenst zelfbeeld en innerlijke oriëntatie",
    zone: "profielbouw",
    kind: "decision",
    intro:
      "Een aparte laag, los van talent. Dit gaat over dieperliggende eigenschappen — zelfkennis, waardengedrevenheid, zelfzekerheid en de zoektocht naar een passende omgeving — die méér bepalen dan talent alleen. Bepaal per kenmerk of het need to have, nice to have of not needed is voor de rol.",
    items: [
      { id: "MZ-E-1", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die in alle omstandigheden kritisch blijft op zichzelf.", help: "Zelfkritisch vermogen.", cluster: "Introspect", sourceRefs: ["E.1"] },
      { id: "MZ-E-2", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die sterk waardengedreven is en daar ook naar handelt.", help: "Waardengedrevenheid.", cluster: "Introspect", sourceRefs: ["E.3"] },
      { id: "MZ-E-3", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt een helder, zelfzeker beeld van de eigen professionele talenten dat ook zo overkomt.", help: "Professionele zelfzekerheid.", cluster: "Introspect", sourceRefs: ["E.4", "E.5"] },
      { id: "MZ-E-4", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die bewust een werkomgeving zoekt die aansluit bij wie die is.", help: "Zelfsturing in levensrichting.", cluster: "Introspect", sourceRefs: ["E.2", "E.8"] },
      { id: "MZ-E-5", type: "classificatie", label: "profielvormend", text: "Deze rol vraagt iemand die beslissingen durft te herzien én gevoelig is voor de mening van anderen.", help: "Reflectieve openheid.", cluster: "Introspect", sourceRefs: ["E.6", "E.7"] },
      { id: "MZ-DISC", type: "discussie", label: "profielvormend", text: "Op welk zelfbeeld-aspect verschillen stakeholders mogelijk van inzicht?" },
    ],
  },
  {
    nr: 9,
    key: "consolidatie",
    title: "Need / nice / not needed-consolidatie",
    zone: "profielbouw",
    kind: "consolidatie",
    intro: "Breng alle classificaties samen, expliciteer prioriteiten en bevestig de kritische succescriteria.",
    items: [],
  },
  {
    nr: 10,
    key: "drempels",
    title: "Minimumdrempels",
    zone: "finalisatie",
    kind: "drempel",
    intro: "De drie drempelniveaus als zichtbare, richtinggevende kwaliteitsbewakers — geen verborgen rekenregels.",
    items: [
      { id: "M9-01", type: "drempel", label: "drempel", text: "Contextuele drempel: vereist de veranderdruk een minimale tolerantie voor ambiguïteit?", help: "Contextueel niveau" },
      { id: "M9-02", type: "drempel", label: "drempel", text: "Contextuele drempel: vereist de relationele complexiteit een minimale relationele afstemming?", help: "Contextueel niveau" },
      { id: "M9-03", type: "drempel", label: "drempel", text: "Contextuele drempel: vormt lage autonomie een mismatch voor hoge nood aan regelruimte?", help: "Contextueel niveau" },
      { id: "M9-04", type: "drempel", label: "drempel", text: "Profieldrempel: zijn minstens twee van vier kritische drivercondities passend?", help: "Profielniveau" },
      { id: "M9-05", type: "drempel", label: "drempel", text: "Profieldrempel: is de sleutelversneller minstens als need to have bevestigd?", help: "Profielniveau" },
      { id: "M9-06", type: "drempel", label: "drempel", text: "Profieldrempel: is de cruciale talentfocus niet als not needed geclassificeerd?", help: "Profielniveau" },
    ],
  },
  {
    nr: 11,
    key: "risico",
    title: "Risico-, monitoring- en alertlaag",
    zone: "waakzaamheid",
    kind: "risico",
    intro: "Detecteer fragiliteit en waakzaamheidszones, ook wanneer het profiel inhoudelijk aantrekkelijk lijkt.",
    items: [
      { id: "M10-01", type: "drempel", label: "risico", text: "Risicodrempel: zijn er drie of meer samenvallende alerts die het duurzaamheidsrisico verhogen?" },
      { id: "M10-02", type: "drempel", label: "risico", text: "Risicodrempel: combineert de rol hoge prestatiedruk met lage herstelruimte?" },
      { id: "M10-03", type: "drempel", label: "risico", text: "Risicodrempel: is er structurele incongruentie tussen context en noodzakelijke drivers (rode vlag)?" },
      { id: "M10-04", type: "toelichting", label: "monitoring", text: "Welke signalen moeten na aanwerving actief gemonitord worden?", scale: { kind: "open" } },
      { id: "M10-05", type: "toelichting", label: "monitoring", text: "Welke draagkracht- of herstelfactoren verdienen blijvende opvolging?", scale: { kind: "open" } },
      { id: "M10-06", type: "toelichting", label: "risico", text: "Welke risico's blijven aandacht vragen ondanks een aantrekkelijk profiel?" },
    ],
  },
  {
    nr: 12,
    key: "finalisatie",
    title: "Finale alignment check en vrijgave",
    zone: "finalisatie",
    kind: "finalisatie",
    intro: "Eén finale beslissing per item, gezamenlijke bevestiging en vrijgave van het virtuele profiel.",
    items: [],
  },
];

// Schaalopties voor contextvragen (5-punt)
export const SCALE_OPTIONS = [
  { value: "1", label: "Zeer laag" },
  { value: "2", label: "Laag" },
  { value: "3", label: "Gemiddeld" },
  { value: "4", label: "Hoog" },
  { value: "5", label: "Zeer hoog" },
];

export const CLASSIFICATION_LABEL: Record<string, string> = {
  need: "Need to have",
  nice: "Nice to have",
  "not-needed": "Not needed",
};

export const STATUS_FLOW = [
  { key: "draft", label: "Draft" },
  { key: "stakeholders-bevestigd", label: "Stakeholders bevestigd" },
  { key: "geopend", label: "Sessie geopend" },
  { key: "individueel", label: "Individuele input lopend" },
  { key: "alignment", label: "Alignmentsessie vereist" },
  { key: "conflict-open", label: "Conflictpunten open" },
  { key: "finalisatie", label: "Finalisatie gereed" },
  { key: "vergrendeld", label: "Afgesloten en vergrendeld" },
];

// Alle profielvormende classificatie-items (voor consolidatie/rapport)
export function classificationItems(): LibraryItem[] {
  return MODULES.filter((m) => m.kind === "decision")
    .flatMap((m) => m.items)
    .filter((i) => i.type === "classificatie");
}
