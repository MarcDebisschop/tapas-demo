// ---------------------------------------------------------------------------
// shared/role-fit.ts
//
// Gedeelde contracten van de journey "Recruitment & Role Fit" met de
// methodieklaag "H-BOM Evidence Check". Server en scherm lezen dezelfde
// lijsten, labels, toestandsovergangen en taalregels uit dit bestand, zodat
// het scherm nooit een andere waarheid kan tonen dan de server afdwingt.
//
// WAT DIT BESTAND WEL EN NIET DOET
// Het legt vast welke waarden bestaan en welke overgangen mogen. Het rekent
// niets uit over een persoon. De regels die een fit-indicatie of een
// integratiestatus bepalen, staan in server/role-fit/*-engine.ts; daar hoort
// ook hun regelversie.
//
// De server is altijd de autoriteit. Dat de toestandsmachine hier ook voor het
// scherm staat, dient enkel om knoppen correct te tonen of te verbergen.
// ---------------------------------------------------------------------------
import { z } from "zod";

// ---- Versies ----------------------------------------------------------------
// Elke wijziging aan een regel, een sjabloon of een rapportvorm krijgt een
// nieuw versienummer. Een rapport draagt deze nummers mee, zodat later
// aantoonbaar is met welke regels het gemaakt werd.
export const RF_MODULE_VERSIE = "role-fit-1.0.0";
export const RF_FIT_REGELVERSIE = "rf-fit-1.0.0";
export const RF_HBOM_REGELVERSIE = "rf-hbom-1.0.0";
export const RF_INTEGRATIE_REGELVERSIE = "rf-integratie-1.0.0";
export const RF_CONTEXT_REGELVERSIE = "rf-context-1.0.0";
export const RF_RAPPORTCONTRACT_VERSIE = "rf-rapportcontract-1.0.0";
export const RF_PROMPT_VERSIE = "rf-prompt-context-1.0.0";

export const RF_PRODUCTNAAM = "Recruitment & Role Fit";
export const RF_METHODIEKNAAM = "H-BOM Evidence Check";

// ---- Toestandsmachine -------------------------------------------------------
export const CASE_STATUSSEN = [
  "DRAFT",
  "CONTEXT_REVIEW",
  "CONTEXT_FROZEN",
  "HBOM_READY",
  "OBSERVING",
  "OBSERVATIONS_LOCKED",
  "INTEGRATION_REVIEW",
  "DECISION_READY",
  "SIGNED",
  "ARCHIVED",
] as const;
export type CaseStatus = (typeof CASE_STATUSSEN)[number];

/**
 * Toegestane overgangen. Alles wat hier niet staat, weigert de server.
 * Terug naar een vorige stap kan enkel waar dat geen vastgelegd bewijs
 * ongedaan maakt: van CONTEXT_REVIEW terug naar DRAFT (de context is nog niet
 * bevroren) en van DECISION_READY terug naar INTEGRATION_REVIEW (er is nog
 * niets getekend). Archiveren kan vanuit elke toestand behalve ARCHIVED zelf.
 */
export const CASE_OVERGANGEN: Record<CaseStatus, readonly CaseStatus[]> = {
  DRAFT: ["CONTEXT_REVIEW", "ARCHIVED"],
  CONTEXT_REVIEW: ["DRAFT", "CONTEXT_FROZEN", "ARCHIVED"],
  CONTEXT_FROZEN: ["HBOM_READY", "ARCHIVED"],
  HBOM_READY: ["OBSERVING", "ARCHIVED"],
  OBSERVING: ["OBSERVATIONS_LOCKED", "ARCHIVED"],
  OBSERVATIONS_LOCKED: ["INTEGRATION_REVIEW", "ARCHIVED"],
  INTEGRATION_REVIEW: ["DECISION_READY", "ARCHIVED"],
  DECISION_READY: ["SIGNED", "INTEGRATION_REVIEW", "ARCHIVED"],
  SIGNED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function magOvergaan(van: CaseStatus, naar: CaseStatus): boolean {
  return (CASE_OVERGANGEN[van] ?? []).includes(naar);
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: "Concept",
  CONTEXT_REVIEW: "Context in review",
  CONTEXT_FROZEN: "Context bevroren",
  HBOM_READY: "Evidence Check klaar",
  OBSERVING: "Observatie loopt",
  OBSERVATIONS_LOCKED: "Observaties vergrendeld",
  INTEGRATION_REVIEW: "Integratie in review",
  DECISION_READY: "Klaar voor besluit",
  SIGNED: "Getekend",
  ARCHIVED: "Gearchiveerd",
};

// ---- Ordinale assen ---------------------------------------------------------
export const FIT_INDICATIES = [
  "strong_support",
  "likely_support",
  "mixed",
  "likely_friction",
  "not_assessable",
] as const;
export type FitIndicatie = (typeof FIT_INDICATIES)[number];
export const FIT_INDICATIE_LABEL: Record<FitIndicatie, string> = {
  strong_support: "Sterke ondersteuning",
  likely_support: "Waarschijnlijke ondersteuning",
  mixed: "Gemengd",
  likely_friction: "Waarschijnlijke frictie",
  not_assessable: "Niet beoordeelbaar",
};

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Laag",
  medium: "Midden",
  high: "Hoog",
};

export const KRITICITEITEN = ["gate", "critical", "important", "supporting"] as const;
export type Kriticiteit = (typeof KRITICITEITEN)[number];
export const KRITICITEIT_LABEL: Record<Kriticiteit, string> = {
  gate: "Knock-out",
  critical: "Kritiek",
  important: "Belangrijk",
  supporting: "Ondersteunend",
};

export const ONTWIKKELAFSTANDEN = ["short", "medium", "long", "unknown"] as const;
export type Ontwikkelafstand = (typeof ONTWIKKELAFSTANDEN)[number];
export const ONTWIKKELAFSTAND_LABEL: Record<Ontwikkelafstand, string> = {
  short: "Kort",
  medium: "Middel",
  long: "Lang",
  unknown: "Onbekend",
};

export const NIVEAUS_HML = ["high", "medium", "low"] as const;
export type NiveauHml = (typeof NIVEAUS_HML)[number];
export const NIVEAU_HML_LABEL: Record<NiveauHml, string> = {
  high: "Hoog",
  medium: "Midden",
  low: "Laag",
};

export const FIT_TYPES = [
  "demands_abilities",
  "needs_supplies",
  "supplementary",
  "complementary",
] as const;
export type FitType = (typeof FIT_TYPES)[number];
export const FIT_TYPE_LABEL: Record<FitType, string> = {
  demands_abilities: "Vraag van de rol en beschikbare energie/talent",
  needs_supplies: "Behoeften en wat de omgeving biedt",
  supplementary: "Aanvullende gelijkenis (gedeelde waarden)",
  complementary: "Aanvullend verschil (wat het team mist)",
};

export const VEREISTE_NIVEAUS = ["entry", "developable", "contextual", "knockout"] as const;
export type VereisteNiveau = (typeof VEREISTE_NIVEAUS)[number];
export const VEREISTE_NIVEAU_LABEL: Record<VereisteNiveau, string> = {
  entry: "Essentieel bij instap",
  developable: "Ontwikkelbaar",
  contextual: "Contextueel relevant",
  knockout: "Knock-out",
};

export const GATE_STATUSSEN = ["open", "met", "not_met", "to_verify"] as const;
export type GateStatus = (typeof GATE_STATUSSEN)[number];
export const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  open: "Nog niet behandeld",
  met: "Voldaan (met bewijs)",
  not_met: "Niet voldaan",
  to_verify: "Nog te verifiëren",
};

export const METHODES = [
  "structured_evidence_interview",
  "scenario_probe",
  "mini_work_sample",
] as const;
export type Methode = (typeof METHODES)[number];
export const METHODE_LABEL: Record<Methode, string> = {
  structured_evidence_interview: "Gestructureerd evidence-interview",
  scenario_probe: "Scenario probe",
  mini_work_sample: "Mini-work sample",
};

export const PAKKETTEN = ["light", "standard"] as const;
export type Pakket = (typeof PAKKETTEN)[number];
export const PAKKET_LABEL: Record<Pakket, string> = {
  light: "Light (3 hypothesen, 30 tot 45 minuten)",
  standard: "Standard (4 tot 6 hypothesen, 60 tot 90 minuten)",
};

export const INTEGRATIE_STATUSSEN = [
  "convergent_support",
  "mixed_context_dependent",
  "repeated_counter_indication",
  "insufficient_evidence",
] as const;
export type IntegratieStatus = (typeof INTEGRATIE_STATUSSEN)[number];
export const INTEGRATIE_STATUS_LABEL: Record<IntegratieStatus, string> = {
  convergent_support: "Convergente ondersteuning",
  mixed_context_dependent: "Gemengd, contextafhankelijk",
  repeated_counter_indication: "Herhaalde tegenindicatie",
  insufficient_evidence: "Onvoldoende bewijs",
};

export const AANBEVELINGEN = ["positive", "conditionally_positive", "postpone", "negative"] as const;
export type Aanbeveling = (typeof AANBEVELINGEN)[number];
export const AANBEVELING_LABEL: Record<Aanbeveling, string> = {
  positive: "Positief",
  conditionally_positive: "Voorwaardelijk positief",
  postpone: "Uitstellen",
  negative: "Negatief",
};

export const BESLISDOELEN = ["selectie", "interne_mobiliteit", "opvolging"] as const;
export type Beslisdoel = (typeof BESLISDOELEN)[number];
export const BESLISDOEL_LABEL: Record<Beslisdoel, string> = {
  selectie: "Selectie",
  interne_mobiliteit: "Interne mobiliteit",
  opvolging: "Opvolging",
};

export const RECHTSGRONDEN = ["toestemming", "precontractuele_maatregelen", "gerechtvaardigd_belang"] as const;
export type Rechtsgrond = (typeof RECHTSGRONDEN)[number];
export const RECHTSGROND_LABEL: Record<Rechtsgrond, string> = {
  toestemming: "Toestemming van de kandidaat (AVG art. 6.1.a)",
  precontractuele_maatregelen: "Precontractuele maatregelen op verzoek van de kandidaat (AVG art. 6.1.b)",
  gerechtvaardigd_belang: "Gerechtvaardigd belang na belangenafweging (AVG art. 6.1.f)",
};

export const OBSERVATOR_ROLLEN = ["recruiter", "hiring_manager"] as const;
export type ObservatorRol = (typeof OBSERVATOR_ROLLEN)[number];
export const OBSERVATOR_ROL_LABEL: Record<ObservatorRol, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
};

export const BEWIJSKWALITEITEN = ["direct", "indirect", "limited"] as const;
export type Bewijskwaliteit = (typeof BEWIJSKWALITEITEN)[number];
export const BEWIJSKWALITEIT_LABEL: Record<Bewijskwaliteit, string> = {
  direct: "Direct gezien of gehoord",
  indirect: "Indirect (verslag van eigen gedrag)",
  limited: "Beperkt (weinig gelegenheid)",
};

export const BARS_WAARDEN = [1, 3, 5] as const;
export type BarsWaarde = (typeof BARS_WAARDEN)[number];

// ---- Contextclaims ------------------------------------------------------------
// De acht wizardstappen. Een claim hoort altijd bij precies een categorie.
export const CLAIM_CATEGORIEEN = [
  "purpose",
  "role_mission",
  "outcomes",
  "requirements",
  "environment",
  "organization",
  "team",
  "gates",
] as const;
export type ClaimCategorie = (typeof CLAIM_CATEGORIEEN)[number];
export const CLAIM_CATEGORIE_LABEL: Record<ClaimCategorie, string> = {
  purpose: "Doel en besliscontext",
  role_mission: "Rolmissie",
  outcomes: "Verwachte resultaten",
  requirements: "Instap- en ontwikkelbare vereisten",
  environment: "Omgeving",
  organization: "Organisatiecontext",
  team: "Team en stakeholders",
  gates: "Niet-compenseerbare gates",
};

export const CLAIM_STATUSSEN = ["proposed", "approved", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSSEN)[number];
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  proposed: "Voorstel, nog niet actief",
  approved: "Bevestigd",
  rejected: "Afgewezen",
};

export const BRON_TYPES = ["wizard", "text", "url", "pdf", "docx", "txt"] as const;
export type BronType = (typeof BRON_TYPES)[number];
export const BRON_TYPE_LABEL: Record<BronType, string> = {
  wizard: "Wizard (handmatige invoer)",
  text: "Geplakte tekst",
  url: "Organisatie-URL",
  pdf: "PDF-document",
  docx: "Word-document",
  txt: "Tekstbestand",
};

// Het soort bewijs, voor de evidence legend op elke rapportpagina.
export const BEWIJSSOORTEN = [
  "profiel",
  "context",
  "observatie",
  "referentie",
  "technisch",
  "ontbrekend",
] as const;
export type Bewijssoort = (typeof BEWIJSSOORTEN)[number];
export const BEWIJSSOORT_LABEL: Record<Bewijssoort, string> = {
  profiel: "Profiel (T4P Business, zelfrapportage)",
  context: "Context (bevestigde rolclaim)",
  observatie: "Observatie (H-BOM Evidence Check)",
  referentie: "Referentie",
  technisch: "Technisch bewijs",
  ontbrekend: "Ontbrekend",
};

// ---- Dimensietaxonomie ------------------------------------------------------
// Elke vereiste hangt aan een dimensie. Een dimensie verwijst naar een of meer
// constructen van het T4P Business Kompas (canonieke namen uit
// server/data/instrument.json). Het gedrag in de ankers is bewust concreet en
// rolgericht; het beschrijft wat zichtbaar kan worden, nooit wie iemand is.
export interface Dimensie {
  id: string;
  label: string;
  constructen: string[];
  standaardFitType: FitType;
  observeerbaarheid: NiveauHml;
  standaardMethode: Methode;
  /** Wat zichtbaar wordt wanneer de hypothese ondersteund wordt. */
  gedrag: string;
  bevestigend: string[];
  tegen: string[];
  alternatief: string[];
  anker1: string;
  anker3: string;
  anker5: string;
}

export const DIMENSIES: Dimensie[] = [
  {
    id: "analyse",
    label: "Analyse en onderbouwing",
    constructen: ["Analyse"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "high",
    standaardMethode: "mini_work_sample",
    gedrag: "gegevens ordenen, aannames benoemen en een onderbouwde conclusie formuleren",
    bevestigend: [
      "vraagt naar de herkomst en volledigheid van de gegevens",
      "maakt onderscheid tussen feiten en aannames",
      "formuleert een conclusie met expliciete onderbouwing",
    ],
    tegen: [
      "trekt een conclusie zonder de gegevens te bekijken",
      "laat tegenstrijdige gegevens onbesproken",
    ],
    alternatief: [
      "onbekendheid met het vakjargon van de sector",
      "te weinig tijd in de oefening voor een volledige analyse",
    ],
    anker1: "Benoemt een conclusie zonder naar de aangereikte gegevens te verwijzen.",
    anker3: "Verwijst naar een deel van de gegevens en benoemt minstens een aanname.",
    anker5: "Ordent de gegevens, benoemt aannames en ontbrekende informatie en onderbouwt de conclusie stap voor stap.",
  },
  {
    id: "resultaat",
    label: "Resultaatgerichtheid en opvolging",
    constructen: ["Resultaatgericht"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "high",
    standaardMethode: "structured_evidence_interview",
    gedrag: "doelen concreet maken, prioriteiten zetten en afspraken opvolgen",
    bevestigend: [
      "noemt meetbare doelen en tussentijdse controlemomenten",
      "kiest expliciet wat eerst komt en waarom",
      "beschrijft hoe een afspraak werd opgevolgd tot het einde",
    ],
    tegen: [
      "blijft bij algemene intenties zonder concrete stappen",
      "beschrijft geen opvolging van eerdere afspraken",
    ],
    alternatief: [
      "eerdere rollen boden weinig beslisruimte",
      "voorbeelden uit een andere sector zijn moeilijk vergelijkbaar",
    ],
    anker1: "Beschrijft doelen enkel in algemene termen, zonder stappen of opvolging.",
    anker3: "Noemt een concreet doel en een deel van de stappen, opvolging blijft beperkt.",
    anker5: "Maakt doel, prioriteit, tussenstappen en opvolging concreet en toetst of het resultaat bereikt is.",
  },
  {
    id: "coaching",
    label: "Coaching en ontwikkeling van anderen",
    constructen: ["Coaching"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "high",
    standaardMethode: "scenario_probe",
    gedrag: "vragen stellen die de ander zelf laten nadenken en concrete ontwikkelafspraken maken",
    bevestigend: [
      "stelt open vragen voordat een oplossing voorgesteld wordt",
      "vat samen wat de ander zegt",
      "maakt een concrete ontwikkelafspraak met de ander",
    ],
    tegen: [
      "geeft meteen de oplossing zonder de ander te bevragen",
      "maakt geen afspraak over een volgende stap",
    ],
    alternatief: [
      "het scenario vroeg om een snelle beslissing",
      "rollenspel voelt voor sommige mensen onnatuurlijk",
    ],
    anker1: "Geeft direct een oplossing zonder vragen te stellen of samen te vatten.",
    anker3: "Stelt enkele vragen en vat deels samen, maar maakt geen concrete afspraak.",
    anker5: "Stelt open vragen, vat samen, laat de ander een eigen stap formuleren en legt een afspraak vast.",
  },
  {
    id: "faciliteren",
    label: "Faciliteren van samenwerking",
    constructen: ["Faciliteren"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "medium",
    standaardMethode: "scenario_probe",
    gedrag: "een overleg structureren, iedereen aan het woord laten en tot gedeelde afspraken komen",
    bevestigend: [
      "zet bij de start doel en werkwijze van het overleg neer",
      "nodigt stillere deelnemers uitdrukkelijk uit",
      "sluit af met een gedeelde afspraak en eigenaar",
    ],
    tegen: [
      "laat het overleg zonder structuur verlopen",
      "sluit af zonder gedeelde afspraak",
    ],
    alternatief: [
      "een kunstmatige setting met onbekende gesprekspartners",
      "rolverwarring in het scenario",
    ],
    anker1: "Laat het overleg verlopen zonder doel, structuur of afspraak.",
    anker3: "Zet een doel neer en betrekt een deel van de deelnemers, afspraak blijft vaag.",
    anker5: "Structureert doel en werkwijze, betrekt alle deelnemers en sluit af met afspraak, eigenaar en termijn.",
  },
  {
    id: "impact",
    label: "Impact en overtuigen",
    constructen: ["Impact"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "high",
    standaardMethode: "scenario_probe",
    gedrag: "een standpunt helder brengen, argumenten afstemmen op de gesprekspartner en draagvlak toetsen",
    bevestigend: [
      "brengt een standpunt met een duidelijke kernboodschap",
      "past argumenten aan op de vraag of het bezwaar van de ander",
      "toetst of de ander meegaat",
    ],
    tegen: [
      "herhaalt hetzelfde argument zonder in te gaan op bezwaren",
      "trekt het standpunt terug bij de eerste tegenwerping",
    ],
    alternatief: [
      "het onderwerp ligt buiten de eigen expertise",
      "hiërarchische verhouding in het scenario",
    ],
    anker1: "Brengt geen duidelijke kernboodschap of gaat niet in op bezwaren.",
    anker3: "Brengt een kernboodschap en gaat in op een deel van de bezwaren.",
    anker5: "Brengt een heldere kernboodschap, beantwoordt bezwaren met passende argumenten en toetst het draagvlak.",
  },
  {
    id: "onderscheiden",
    label: "Constructief tegenspreken",
    constructen: ["Constructief onderscheidend"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "medium",
    standaardMethode: "scenario_probe",
    gedrag: "een afwijkend standpunt onderbouwd inbrengen en een alternatief voorstellen",
    bevestigend: [
      "benoemt expliciet waar het niet akkoord gaat en waarom",
      "brengt een uitgewerkt alternatief",
      "blijft respectvol in toon bij tegenspraak",
    ],
    tegen: [
      "gaat akkoord zonder de zwakke punten te benoemen",
      "brengt kritiek zonder alternatief",
    ],
    alternatief: [
      "onvoldoende informatie om het voorstel te beoordelen",
      "de setting voelt als een examen",
    ],
    anker1: "Benoemt geen enkel bezwaar of brengt kritiek zonder onderbouwing.",
    anker3: "Benoemt een bezwaar met onderbouwing, maar zonder uitgewerkt alternatief.",
    anker5: "Benoemt bezwaren met onderbouwing, stelt een uitgewerkt alternatief voor en blijft respectvol.",
  },
  {
    id: "innovatie",
    label: "Vernieuwing en verbetering",
    constructen: ["Innovatie"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "medium",
    standaardMethode: "mini_work_sample",
    gedrag: "nieuwe mogelijkheden verkennen en een verbetervoorstel toetsbaar maken",
    bevestigend: [
      "brengt meer dan een mogelijke aanpak aan",
      "koppelt een idee aan een concrete eerste test",
      "benoemt risico's van de vernieuwing",
    ],
    tegen: [
      "houdt vast aan de bestaande werkwijze zonder alternatieven te verkennen",
      "brengt ideeën zonder uitvoerbare eerste stap",
    ],
    alternatief: [
      "de opdracht liet weinig ruimte voor alternatieven",
      "beperkte kennis van de huidige werkwijze",
    ],
    anker1: "Brengt geen alternatief of enkel een idee zonder uitvoerbare stap.",
    anker3: "Brengt een alternatief met een beperkte uitwerking van de eerste stap.",
    anker5: "Verkent meerdere alternatieven, kiest onderbouwd en maakt een toetsbare eerste stap met benoemde risico's.",
  },
  {
    id: "strategie",
    label: "Richting en lange termijn",
    constructen: ["Strategie"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "medium",
    standaardMethode: "structured_evidence_interview",
    gedrag: "keuzes verbinden aan een langetermijndoel en gevolgen op meerdere niveaus benoemen",
    bevestigend: [
      "verbindt een keuze met een langetermijndoel",
      "benoemt gevolgen voor meerdere belanghebbenden",
      "maakt expliciet waarvoor niet gekozen wordt",
    ],
    tegen: [
      "beschrijft enkel de korte termijn",
      "benoemt geen afwegingen tussen opties",
    ],
    alternatief: [
      "eerdere rollen waren sterk operationeel afgebakend",
      "de vraag liet weinig ruimte voor toekomstscenario's",
    ],
    anker1: "Beschrijft keuzes zonder verband met een langere termijn of met gevolgen.",
    anker3: "Legt een verband met de langere termijn maar weegt weinig opties af.",
    anker5: "Verbindt keuzes met een langetermijndoel, weegt opties af en benoemt gevolgen voor belanghebbenden.",
  },
  {
    id: "operatie",
    label: "Operationele uitvoering en structuur",
    constructen: ["Operationeel"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "high",
    standaardMethode: "mini_work_sample",
    gedrag: "taken plannen, middelen verdelen en afwijkingen in de uitvoering opvangen",
    bevestigend: [
      "maakt een planning met volgorde, middelen en verantwoordelijken",
      "voorziet een reactie op een verstoring",
      "controleert of de planning haalbaar is",
    ],
    tegen: [
      "laat volgorde of verantwoordelijken open",
      "heeft geen reactie op een verstoring",
    ],
    alternatief: [
      "onbekendheid met de concrete processen van de organisatie",
      "de oefening gaf onvolledige informatie over middelen",
    ],
    anker1: "Maakt geen bruikbare planning of laat verantwoordelijken en volgorde open.",
    anker3: "Maakt een planning met volgorde, maar voorziet weinig voor verstoringen.",
    anker5: "Maakt een haalbare planning met volgorde, middelen en eigenaars en voorziet een reactie op verstoringen.",
  },
  {
    id: "interrelatie",
    label: "Relaties opbouwen en onderhouden",
    constructen: ["Inter-relationeel"],
    standaardFitType: "demands_abilities",
    observeerbaarheid: "medium",
    standaardMethode: "structured_evidence_interview",
    gedrag: "contact leggen, luisteren naar de behoefte van de ander en de relatie actief onderhouden",
    bevestigend: [
      "beschrijft concreet hoe een werkrelatie werd opgebouwd",
      "vraagt door naar de behoefte van de ander",
      "noemt hoe contact na een conflict hersteld werd",
    ],
    tegen: [
      "beschrijft relaties enkel in functie van de eigen taak",
      "geeft geen voorbeeld van onderhoud van een werkrelatie",
    ],
    alternatief: [
      "werkte eerder vooral zelfstandig",
      "voorbeelden uit het privéleven werden bewust niet gevraagd",
    ],
    anker1: "Geeft geen concreet voorbeeld van het opbouwen of onderhouden van een werkrelatie.",
    anker3: "Geeft een voorbeeld van contact leggen, maar weinig over onderhoud of herstel.",
    anker5: "Beschrijft concreet hoe een werkrelatie werd opgebouwd, onderhouden en na spanning hersteld.",
  },
  // Drivers. Deze dimensies gaan over wat de omgeving vraagt of biedt en hoe
  // energetisch houdbaar dat is. Ze zeggen niets over bekwaamheid.
  {
    id: "tempo",
    label: "Tempo en tijdsdruk",
    constructen: ["Hurry Up"],
    standaardFitType: "needs_supplies",
    observeerbaarheid: "medium",
    standaardMethode: "scenario_probe",
    gedrag: "onder tijdsdruk prioriteren en de kwaliteit van de afwerking bewaken",
    bevestigend: [
      "kiest onder tijdsdruk expliciet wat eerst komt",
      "benoemt wat bewust later komt",
      "bewaakt een minimumkwaliteit",
    ],
    tegen: [
      "probeert alles tegelijk te doen",
      "laat de kwaliteit ongemerkt zakken",
    ],
    alternatief: [
      "het kunstmatige tijdslimiet van de oefening",
      "onbekendheid met de omgeving",
    ],
    anker1: "Maakt onder tijdsdruk geen keuzes of laat kwaliteit ongemerkt zakken.",
    anker3: "Maakt onder tijdsdruk een keuze, maar benoemt niet wat later komt.",
    anker5: "Prioriteert expliciet onder tijdsdruk, benoemt wat later komt en bewaakt een afgesproken minimumkwaliteit.",
  },
  {
    id: "zelfstandigheid",
    label: "Zelfstandigheid en hulp vragen",
    constructen: ["Be Strong"],
    standaardFitType: "needs_supplies",
    observeerbaarheid: "medium",
    standaardMethode: "structured_evidence_interview",
    gedrag: "zelfstandig werken en tijdig hulp of steun inschakelen wanneer dat nodig is",
    bevestigend: [
      "beschrijft een moment waarop tijdig hulp gevraagd werd",
      "benoemt grenzen van de eigen beschikbaarheid",
      "werkt zelfstandig binnen afgesproken kaders",
    ],
    tegen: [
      "beschrijft enkel situaties waarin alles alleen gedragen werd",
      "geeft geen voorbeeld van steun inschakelen",
    ],
    alternatief: [
      "een omgeving waarin hulp vragen niet gewoon was",
      "de vraag werd als persoonlijk ervaren",
    ],
    anker1: "Geeft geen voorbeeld van tijdig steun inschakelen bij hoge belasting.",
    anker3: "Geeft een voorbeeld van steun vragen, maar pas laat in het proces.",
    anker5: "Beschrijft zelfstandig werk binnen kaders en een concreet moment van tijdig steun inschakelen.",
  },
  {
    id: "kwaliteitsnorm",
    label: "Kwaliteitsnorm en afwerking",
    constructen: ["Be Perfect"],
    standaardFitType: "needs_supplies",
    observeerbaarheid: "high",
    standaardMethode: "mini_work_sample",
    gedrag: "een kwaliteitsniveau afstemmen op het doel en tijdig afronden",
    bevestigend: [
      "vraagt welk kwaliteitsniveau nodig is",
      "rondt af binnen de gegeven tijd",
      "maakt expliciet waar bewust minder detail volstaat",
    ],
    tegen: [
      "blijft verfijnen voorbij de gevraagde tijd",
      "stemt het detailniveau niet af op het doel",
    ],
    alternatief: [
      "onduidelijke opdrachtomschrijving",
      "hoge inzet omwille van de selectiesituatie",
    ],
    anker1: "Rondt niet af binnen de tijd of stemt het detailniveau niet af op het doel.",
    anker3: "Rondt af binnen de tijd, afstemming van detail op doel blijft impliciet.",
    anker5: "Stemt het kwaliteitsniveau af op het doel, rondt tijdig af en benoemt bewuste keuzes in detail.",
  },
  {
    id: "inzet_uitdaging",
    label: "Inzet bij uitdaging en verandering",
    constructen: ["Try Hard"],
    standaardFitType: "needs_supplies",
    observeerbaarheid: "medium",
    standaardMethode: "structured_evidence_interview",
    gedrag: "een uitdagende opdracht aangaan en tot een afgerond resultaat brengen",
    bevestigend: [
      "beschrijft een uitdagende opdracht die ook afgerond werd",
      "benoemt hoe de eigen inzet gedoseerd werd",
      "evalueert achteraf wat werkte",
    ],
    tegen: [
      "beschrijft veel gestarte trajecten zonder afronding",
      "benoemt geen dosering van inzet",
    ],
    alternatief: [
      "eerdere projecten werden extern stopgezet",
      "de vraag liet weinig ruimte voor een volledig verhaal",
    ],
    anker1: "Geeft geen voorbeeld van een uitdagende opdracht die afgerond werd.",
    anker3: "Geeft een voorbeeld van afronding, zonder te benoemen hoe inzet gedoseerd werd.",
    anker5: "Beschrijft een uitdagende opdracht tot afronding, met dosering van inzet en een evaluatie achteraf.",
  },
  {
    id: "afstemming",
    label: "Afstemming en grenzen aangeven",
    constructen: ["Please Others"],
    standaardFitType: "needs_supplies",
    observeerbaarheid: "medium",
    standaardMethode: "scenario_probe",
    gedrag: "rekening houden met de verwachting van anderen en tegelijk een grens aangeven",
    bevestigend: [
      "vraagt naar de verwachting van de ander",
      "zegt duidelijk wat wel en niet haalbaar is",
      "stelt een alternatief voor bij een nee",
    ],
    tegen: [
      "zegt ja op elke vraag, ook wanneer die niet haalbaar is",
      "geeft geen grens aan",
    ],
    alternatief: [
      "hiërarchische verhouding in het scenario",
      "de wens om in de selectie een goede indruk te maken",
    ],
    anker1: "Stemt in met een onhaalbare vraag zonder grens of alternatief.",
    anker3: "Geeft een grens aan, maar zonder alternatief of uitleg.",
    anker5: "Vraagt naar de verwachting, geeft een duidelijke grens met uitleg en stelt een haalbaar alternatief voor.",
  },
];

export const DIMENSIE_PER_ID: Record<string, Dimensie> = Object.fromEntries(
  DIMENSIES.map((d) => [d.id, d]),
);

// Gates worden nooit door een profielsignaal beoordeeld. Ze hangen niet aan
// een dimensie uit de lijst hierboven maar aan deze vaste sleutel.
export const GATE_DIMENSIE = "gate";

// ---- Taalregels ---------------------------------------------------------------
// Verboden conclusies. Een tekst die hierop slaat, mag niet in een rapport of
// besluit terechtkomen. De regels zijn bewust breed: een valse melding kost een
// herformulering, een gemiste melding kost een onterechte uitspraak over een
// mens.
export interface TaalMelding {
  regel: string;
  fragment: string;
  uitleg: string;
}

const VERBODEN_PATRONEN: Array<{ regel: string; patroon: RegExp; uitleg: string }> = [
  {
    regel: "identiteit",
    patroon: /\b(de|deze) (kandidaat|persoon|sollicitant) is\b/i,
    uitleg: "Beschrijf gedrag in context: \"binnen deze situatie werd ... zichtbaar\".",
  },
  {
    regel: "identiteit",
    patroon: /\bthe candidate is\b/i,
    uitleg: "Describe behaviour in context instead of identity.",
  },
  {
    regel: "afwezigheid_talent",
    patroon: /\b(heeft|had|toont) geen talent\b|\bgeen talent voor\b|\btalent ontbreekt\b|\bontbreekt (het|elk) talent\b|\bhas no talent\b/i,
    uitleg: "Niet zichtbaar gedrag is geen bewijs van afwezig talent. Schrijf \"onvoldoende bewijs\".",
  },
  {
    regel: "intentie",
    patroon: /\b(bedoelt eigenlijk|wil eigenlijk|verborgen agenda|intenties? van de kandidaat|zijn intentie|haar intentie)\b/i,
    uitleg: "Intenties zijn niet observeerbaar. Beschrijf wat letterlijk gezien of gehoord werd.",
  },
  {
    regel: "diagnose",
    patroon: /\b(diagnose|adhd|autis\w*|depressi\w*|burn-?out|stoornis|klinisch|psychiatrisch|medisch)\b/i,
    uitleg: "Geen medische of klinische inferentie.",
  },
  {
    regel: "intelligentie",
    patroon: /\b(iq|intelligent\w*|onintelligent\w*|niet slim|is dom)\b/i,
    uitleg: "Intelligentie wordt in deze journey niet gemeten en mag niet afgeleid worden.",
  },
  {
    regel: "persoonlijkheidsessentie",
    patroon: /\b(ware aard|in essentie is|persoonlijkheid is|van nature (een|altijd)|zit in (zijn|haar) karakter)\b/i,
    uitleg: "Geen uitspraken over persoonlijkheidsessentie.",
  },
  {
    regel: "potentieelplafond",
    patroon: /\b(potentieel is maximaal|maximaal potentieel|plafond|zal nooit|nooit in staat|kan nooit)\b/i,
    uitleg: "Schrijf \"groei is plausibel indien ...\"; grenzen zijn bewijs- of contextgrenzen.",
  },
  {
    regel: "validatieclaim",
    patroon: /\b(gevalideerd\w*|wetenschappelijk bewezen|bewezen voorspell\w*|validated)\b/i,
    uitleg: "Geen validatieclaim zonder passende validatiestudie.",
  },
  {
    regel: "schijnprecisie",
    patroon: /\b\d{1,3}([.,]\d+)?\s?%\s*(fit|match|geschikt\w*|passend)\b|\bfitpercentage\b|\bfit-?score van\b/i,
    uitleg: "Geen fitpercentages of totaalscores.",
  },
  {
    regel: "benaming",
    patroon: /\bassessment[ -]?cent(er|re)\b/i,
    uitleg: "Noem de methodiek H-BOM Evidence Check.",
  },
];

/** Geeft elke verboden formulering terug die in de tekst staat. Leeg = in orde. */
export function vindVerbodenTaal(tekst: string | null | undefined): TaalMelding[] {
  if (!tekst) return [];
  const meldingen: TaalMelding[] = [];
  for (const p of VERBODEN_PATRONEN) {
    const m = tekst.match(p.patroon);
    if (m) meldingen.push({ regel: p.regel, fragment: m[0], uitleg: p.uitleg });
  }
  return meldingen;
}

// Interpretatieve woorden: geen verbod, wel een vraag om concreet gedrag. De
// schrijfcoach in het observatiescherm markeert ze; hij herschrijft niets en
// stelt geen score voor.
export const INTERPRETATIEVE_TERMEN = [
  "dominant",
  "empathisch",
  "strategisch",
  "charismatisch",
  "arrogant",
  "onzeker",
  "zelfverzekerd",
  "passief",
  "agressief",
  "lui",
  "gemotiveerd",
  "ongemotiveerd",
  "introvert",
  "extravert",
  "emotioneel",
  "rigide",
  "natuurlijk leider",
  "natuurlijke leider",
  "leiderschapskwaliteiten",
  "overtuigend",
  "slim",
  "sterk",
  "zwak",
] as const;

export function vindInterpretatieveTermen(tekst: string | null | undefined): TaalMelding[] {
  if (!tekst) return [];
  const meldingen: TaalMelding[] = [];
  for (const term of INTERPRETATIEVE_TERMEN) {
    const patroon = new RegExp(`(^|[^\\p{L}])(${term})(?=$|[^\\p{L}])`, "iu");
    const m = tekst.match(patroon);
    if (m) {
      meldingen.push({
        regel: "interpretatief",
        fragment: m[2],
        uitleg: `"${m[2]}" is een interpretatie. Beschrijf wat letterlijk gezien of gehoord werd en wat het effect was.`,
      });
    }
  }
  return meldingen;
}

/**
 * Alles wat de taalcoach in een observatie markeert: verboden formuleringen
 * en interpretatieve labels. De coach herschrijft niets en stelt geen score
 * voor; bij indienen moet de observator elke melding bewust bevestigen.
 */
export function taalcoachMeldingen(tekst: string | null | undefined): TaalMelding[] {
  return [...vindVerbodenTaal(tekst), ...vindInterpretatieveTermen(tekst)];
}

// ---- API-invoer (Zod) ---------------------------------------------------------
const korteTekst = z.string().trim().min(1).max(300);
const middelTekst = z.string().trim().max(2000);

export const maakCaseSchema = z
  .object({
    afnameId: z.number().int().positive(),
    organisatieId: z.number().int().positive().optional(),
    functieTitel: korteTekst,
    beslisdoel: z.enum(BESLISDOELEN),
    senioriteit: z.string().trim().max(100).optional().default(""),
    beslisdatum: z.string().trim().max(20).optional().default(""),
    taal: z.enum(["nl"]).default("nl"),
    recruiterNaam: korteTekst,
    recruiterEmail: z.string().trim().email().max(200),
    recruiterAdminId: z.number().int().positive().nullable().optional(),
    hmNaam: korteTekst,
    hmEmail: z.string().trim().email().max(200),
    hmAdminId: z.number().int().positive().nullable().optional(),
    signerAdminId: z.number().int().positive(),
    reviewerAdminId: z.number().int().positive().nullable().optional(),
    rechtsgrond: z.enum(RECHTSGRONDEN),
    kandidaatGeinformeerd: z.literal(true),
    bewaarTot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type MaakCaseInvoer = z.infer<typeof maakCaseSchema>;

export const wizardSchema = z
  .object({
    doel: middelTekst.optional(),
    missie: middelTekst.optional(),
    resultaten: z.array(z.string().trim().min(1).max(400)).max(8).optional(),
    verwachting90: middelTekst.optional(),
    verwachting180: middelTekst.optional(),
    verwachting365: middelTekst.optional(),
    omgeving: z
      .object({
        sector: z.string().trim().max(200).optional(),
        schaal: z.string().trim().max(200).optional(),
        regulering: z.string().trim().max(400).optional(),
        risico: z.string().trim().max(400).optional(),
        tempo: z.string().trim().max(400).optional(),
        autonomie: z.string().trim().max(400).optional(),
        veranderfase: z.string().trim().max(400).optional(),
      })
      .strict()
      .optional(),
    organisatie: z
      .object({
        waardenInActie: z.string().trim().max(800).optional(),
        besluitstijl: z.string().trim().max(400).optional(),
        conflictstijl: z.string().trim().max(400).optional(),
        leiderschapscontext: z.string().trim().max(800).optional(),
      })
      .strict()
      .optional(),
    team: z
      .object({
        rapportering: z.string().trim().max(400).optional(),
        teamgrootte: z.string().trim().max(100).optional(),
        maturiteit: z.string().trim().max(400).optional(),
        stakeholders: z.string().trim().max(800).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type WizardInvoer = z.infer<typeof wizardSchema>;

export const bronSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), titel: z.string().trim().max(200).optional(), tekst: z.string().min(1).max(60000) }).strict(),
  z.object({ type: z.literal("url"), url: z.string().url().max(2000) }).strict(),
  z
    .object({
      type: z.enum(["pdf", "docx", "txt"]),
      bestandsnaam: z.string().trim().min(1).max(200),
      // Base64. De globale JSON-grens van het platform is 1 MB; een bestand
      // van ten hoogste 700 kB past daar na base64-codering binnen.
      inhoudBase64: z.string().min(1).max(960000),
    })
    .strict(),
]);
export type BronInvoer = z.infer<typeof bronSchema>;

export const claimBeoordelingSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    claim: z.string().trim().min(3).max(600).optional(),
    categorie: z.enum(CLAIM_CATEGORIEEN).optional(),
    versie: z.number().int().positive(),
  })
  .strict();

export const handmatigeClaimSchema = z
  .object({
    categorie: z.enum(CLAIM_CATEGORIEEN),
    claim: z.string().trim().min(3).max(600),
  })
  .strict();

export const vereisteSchema = z
  .object({
    dimensie: z.string().trim().min(1).max(40),
    fitType: z.enum(FIT_TYPES).optional(),
    vereiste: z.string().trim().min(3).max(600),
    niveau: z.enum(VEREISTE_NIVEAUS),
    kriticiteit: z.enum(KRITICITEITEN),
    bronClaimIds: z.array(z.number().int().positive()).max(20).default([]),
  })
  .strict();
export type VereisteInvoer = z.infer<typeof vereisteSchema>;

export const freezeSchema = z
  .object({
    overrideReden: z.string().trim().min(20).max(1000).optional(),
  })
  .strict();

export const hbomKeuzeSchema = z
  .object({
    pakket: z.enum(PAKKETTEN),
    aantal: z.number().int().min(3).max(6).optional(),
  })
  .strict();

export const hbomGoedkeuringSchema = z
  .object({
    hypotheseIds: z.array(z.number().int().positive()).min(3).max(6),
  })
  .strict();

export const observatieRegelSchema = z
  .object({
    exerciseId: z.number().int().positive(),
    contextTrigger: z.string().trim().max(1500).default(""),
    gedrag: z.string().trim().max(2000).default(""),
    quoteActie: z.string().trim().max(1500).default(""),
    effect: z.string().trim().max(1500).default(""),
    barsScore: z.union([z.literal(1), z.literal(3), z.literal(5)]).nullable().default(null),
    onvoldoendeKans: z.boolean().default(false),
    bewijskwaliteit: z.enum(BEWIJSKWALITEITEN).nullable().default(null),
    alternatieveVerklaring: z.string().trim().max(1500).default(""),
    confidence: z.enum(CONFIDENCES).nullable().default(null),
  })
  .strict();
export type ObservatieRegel = z.infer<typeof observatieRegelSchema>;

export const observatieConceptSchema = z
  .object({ regels: z.array(observatieRegelSchema).max(6) })
  .strict();

export const observatieIndienSchema = z
  .object({
    regels: z.array(observatieRegelSchema).min(1).max(6),
    bevestigTaalcoach: z.boolean().default(false),
  })
  .strict();

export const observatieCorrectieSchema = z
  .object({
    regel: observatieRegelSchema,
    reden: z.string().trim().min(10).max(1000),
  })
  .strict();

export const integratieSchema = z
  .object({
    overrides: z
      .array(
        z
          .object({
            hypotheseId: z.number().int().positive(),
            status: z.enum(INTEGRATIE_STATUSSEN),
            reden: z.string().trim().min(20).max(1500),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    gates: z
      .array(
        z
          .object({
            vereisteId: z.number().int().positive(),
            status: z.enum(["met", "not_met", "to_verify"]),
            toelichting: z.string().trim().min(5).max(1000),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    ontbrekendBehandeld: z.string().trim().max(2000).default(""),
  })
  .strict();

export const besluitSchema = z
  .object({
    aanbeveling: z.enum(AANBEVELINGEN),
    rationale: z.string().trim().min(40).max(4000),
    voorwaarden: z.array(z.string().trim().min(3).max(600)).max(15).default([]),
    vervolgstappen: z
      .array(
        z
          .object({
            stap: z.string().trim().min(3).max(600),
            eigenaar: z.string().trim().min(2).max(200),
            termijn: z.string().trim().min(1).max(100),
          })
          .strict(),
      )
      .max(15)
      .default([]),
    plan100: z.string().trim().max(3000).default(""),
    plan180: z.string().trim().max(3000).default(""),
    kandidaatFeedback: z.string().trim().max(3000).default(""),
  })
  .strict();
export type BesluitInvoer = z.infer<typeof besluitSchema>;

export const RAPPORT_TYPES = ["fit-dossier", "hbom-guide", "decision-dossier", "kandidaat-feedback"] as const;
export type RapportType = (typeof RAPPORT_TYPES)[number];
export const RAPPORT_TYPE_LABEL: Record<RapportType, string> = {
  "fit-dossier": "Role & Organization Fit Dossier",
  "hbom-guide": "H-BOM Evidence Check, observatiegids",
  "decision-dossier": "Integrated Decision & Growth Dossier",
  "kandidaat-feedback": "Feedback voor de kandidaat",
};
