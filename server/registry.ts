import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { STANDAARD_TAAL, type Taal } from "../shared/talen";
import {
  type Instrument,
  type Vertaalbaar,
  hydrateInstrument,
  clientInstrumentVan,
} from "./instrument";
import t4sportsJson from "./data/t4sports.json";

// ---------------------------------------------------------------------------
// Instrument-registry (Fase 1) — singleton → registry.
//
// Tot nu toe laadde het platform PRECIES ÉÉN instrument uit een vast
// instrument.json. Deze registry generaliseert dat naar een lijst van
// instrumenten die naast elkaar kunnen bestaan, elk met een flow-type:
//
//   • "individual"     → één deelnemer, lineaire vragenlijst, individueel
//                        profiel (het bestaande TaPas / T4P Business Kompas).
//   • "collaborative"  → gesloten stakeholdergroep bouwt samen een virtueel
//                        rolprofiel (T4Recruitment — komt in een latere fase).
//
// Deze stap is bewust GEDRAG-BEHOUDEND: het bestaande individuele instrument
// blijft exact werken. De registry voegt enkel de mogelijkheid toe om meer
// instrumenten in te schrijven en op te vragen, zodat elk volgend instrument
// (T4Recruitment, 2MINSCAN, ...) er moeiteloos bij kan.
// ---------------------------------------------------------------------------

export type FlowType = "individual" | "collaborative" | "journey";

// ---------------------------------------------------------------------------
// Journey-capability (HDD) — een gefaseerd traject dat BESTAANDE instrumenten
// orkestreert in plaats van zelf te meten. Human Due Diligence is het eerste
// (en voorlopig enige) journey-instrument: Fase 1 (Teamscan + 2MINSCAN) met
// een Go/No-Go-scharnier "onder de motorkap", gevolgd door Fase 2 (T4P
// Business per board member) en een geaggregeerd vlaggenschiprapport.
//
// Belangrijk: een journey BEZIT geen antwoorden. Het verwijst via tokens naar
// de deelnemer-/afnametabellen van de onderliggende instrumenten, zodat er
// geen datadubbeling ontstaat en de aggregatie altijd actueel is.
// ---------------------------------------------------------------------------
export interface JourneyFase {
  fase: number; // 1, 2, ...
  naam: Vertaalbaar;
  // Welke instrumenten in deze fase per board member worden uitgestuurd.
  instrumenten: string[]; // bv. ["tapas-teamscan", "twominscan"]
  // Worden de links automatisch aangemaakt + uitgestuurd bij fase-start?
  autoUitsturen: boolean;
}

export interface JourneyCapability {
  fases: JourneyFase[];
  // Verwijst naar een named gate-evaluator (Go/No-Go-logica tussen de fasen).
  gateEvaluator: string; // bv. "hdd-onder-de-motorkap"
}

// Uitbreidingspunt (nog NIET ingevuld). T4Recruitment moet later een
// gedragsprofiel kunnen bevragen — bijvoorbeeld "welk gedragsprofiel willen
// jullie in de toekomstige rol?" — en daaruit, eventueel zonder een
// meegeleverde 2MINSCAN, via een nog bij te stellen set vragen het juiste
// 2MINSCAN-profiel afleiden. We leggen de vorm hier nu NIET vast; we
// reserveren enkel een capability-slot zodat dit later kan worden
// geactiveerd zonder de registry-architectuur opnieuw open te breken.
export interface ProfileElicitationCapability {
  // Bron van het gedragsprofiel: rechtstreeks een meegeleverde 2MINSCAN,
  // of afgeleid uit een vragenset ("derived"), of beide toegestaan.
  source: "twominscan" | "derived" | "either";
  // Verwijzing naar de (toekomstige) vragenset; bewust optioneel en vrij van
  // structuur tot Marc beslist hoe hij dit het best bevraagt.
  questionSetId?: string;
  // Vrij toelichtingsveld voor ontwerpnotities zolang de vorm nog evolueert.
  notes?: Vertaalbaar;
}

// Beschrijft één ingeschreven instrument in de registry.
export interface InstrumentDescriptor {
  instrumentId: string;
  flowType: FlowType;
  name: string;
  version: string;
  description: string;
  // Is dit het standaard-instrument dat het platform toont waar (nog) geen
  // expliciete instrumentkeuze is? (gedrag-behoudend: de bestaande afname-flow
  // gaat hier verder mee.)
  isDefault: boolean;
  // Het gehydrateerde instrument (blocks/connectionQuestions) — enkel aanwezig
  // voor individuele instrumenten die uit een instrument.json komen.
  instrument?: Instrument;
  // Credit-kost van één afname/sessie van dit instrument. Individuele
  // instrumenten kosten 1 credit per afname; T4Recruitment kost een instelbaar
  // sessietarief (standaard 20) per rolprofiel-sessie. Een organisatie kan dit
  // later per contract overschrijven zonder code te wijzigen.
  creditCost: number;
  // Optionele BATCH-/bundeltarifering. Sommige instrumenten worden niet per
  // stuk verrekend maar per vaste hoeveelheid (bundel). Voorbeeld: de
  // impact-roos gaat "per 10" — 10 rozen kosten 5 credits. Wanneer beide velden
  // gezet zijn, geldt: per `bundelGrootte` afnames worden `bundelCredits`
  // credits verrekend (i.p.v. creditCost per stuk). Ontbreken ze, dan geldt de
  // klassieke 1-op-X-tarifering via `creditCost` per afname.
  bundelGrootte?: number;
  bundelCredits?: number;
  // Toekomstig uitbreidingspunt; ongebruikt tot een instrument het invult.
  profileElicitation?: ProfileElicitationCapability;
  // Enkel voor flowType "journey": de gefaseerde orkestratie (HDD).
  journey?: JourneyCapability;
}

// Probeert het standaard individuele instrument.json te vinden (zelfde
// kandidaatpaden als voorheen, zodat dev én productie blijven werken).
function vindStandaardInstrumentJson(): string | null {
  const candidates = [
    join(process.cwd(), "server", "data", "instrument.json"),
    join(process.cwd(), "data", "instrument.json"),
    join(process.cwd(), "dist", "data", "instrument.json"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// Bouwt de registry op. Vandaag schrijft dit het bestaande individuele
// instrument in. Latere fasen voegen hier T4Recruitment (collaborative) toe.
function bouwRegistry(): Map<string, InstrumentDescriptor> {
  const map = new Map<string, InstrumentDescriptor>();

  const pad = vindStandaardInstrumentJson();
  if (!pad) throw new Error("Instrumentdefinitie niet gevonden");
  const def = JSON.parse(readFileSync(pad, "utf8"));
  const inst = hydrateInstrument(def);

  map.set(inst.instrumentId, {
    instrumentId: inst.instrumentId,
    flowType: "individual",
    name: inst.name,
    version: inst.version,
    description: inst.description,
    isDefault: true,
    instrument: inst,
    creditCost: 1,
  });

  // -------------------------------------------------------------------------
  // T4Recruitment — Fase 2: collaboratief instrument.
  //
  // Geen instrument.json/blocks: T4Recruitment is collaboratief en houdt zijn
  // inhoud (modules, stellingen, alignment, rapporten, vergelijkende studie)
  // één-op-één als JSON-contracten bij in de sessie-tabellen. De registry kent
  // het instrument enkel als descriptor met flowType "collaborative".
  //
  // creditCost = SESSIE_CREDIT_KOST (instelbaar via env, standaard 20) per
  // rolprofiel-sessie. De vergelijkende studie kost 0 credits.
  // -------------------------------------------------------------------------
  const sessieKost = Number(process.env.T4R_SESSIE_CREDITS ?? 20);
  map.set("t4recruitment", {
    instrumentId: "t4recruitment",
    flowType: "collaborative",
    name: "T4Recruitment",
    version: "1.0.0",
    description:
      "Collaboratief beslissingsinstrument: een gesloten stakeholderkring bouwt " +
      "samen één virtueel TaPas-rolprofiel, met alignment als beslissingscriterium.",
    isDefault: false,
    creditCost: sessieKost,
  });

  // -------------------------------------------------------------------------
  // TaPas Teamscan — collaboratief reflectie-/ontwikkelinstrument op basis van
  // het Lencioni-model, uitgebreid met een fundamentlaag (waarden- & normenfit)
  // en een vertrouwensanatomie. Geen diagnose-/selectie-/potentieelclaims.
  // De inhoud (itembank, scoring, interpretatie) zit in server/teamscan/.
  // -------------------------------------------------------------------------
  const teamscanKost = Number(process.env.TEAMSCAN_SESSIE_CREDITS ?? 10);
  map.set("tapas-teamscan", {
    instrumentId: "tapas-teamscan",
    flowType: "collaborative",
    name: "TaPas Teamscan",
    version: "1.0.0",
    description:
      "Collaboratief reflectie- en ontwikkelinstrument voor teams: elk teamlid " +
      "vult individueel in, gevolgd door een geaggregeerde teamanalyse met " +
      "piramide-uitlezing, vertrouwensanatomie en concrete actiepunten.",
    isDefault: false,
    creditCost: teamscanKost,
  });

  // -------------------------------------------------------------------------
  // Human Due Diligence (HDD) — Fase: vlaggenschip-traject (journey).
  //
  // HDD is GEEN vierde meetinstrument maar een orkestrator: het stuurt in twee
  // fasen bestaande instrumenten aan voor één board (dezelfde mensen door beide
  // fasen heen) en bouwt er een geaggregeerd board-rapport bovenop.
  //
  //   • Fase 1 "Verkenning"     → TaPas Teamscan + 2MINSCAN (twee links per lid)
  //                               → teamfoto + energiebalans + Go/No-Go-advies.
  //   • Fase 2 "Diepteanalyse"  → T4P Business Kompas per lid → talentkaart,
  //                               driverpatroon, geaggregeerd cognitief profiel
  //                               (Elliott Jaques-indicatie uit T4P), SWOT,
  //                               roladviezen.
  //
  // creditCost = HDD_TRAJECT_CREDITS (instelbaar via env, standaard 50) per
  // board-traject. Inhoud (orkestratie, gate, aggregatie, rapport) leeft in
  // server/hdd/.
  // -------------------------------------------------------------------------
  const hddKost = Number(process.env.HDD_TRAJECT_CREDITS ?? 50);
  map.set("hdd", {
    instrumentId: "hdd",
    flowType: "journey",
    name: "Human Due Diligence",
    version: "1.0.0",
    description:
      "Gefaseerd vlaggenschip-traject voor boards: Fase 1 (Teamscan + 2MINSCAN) " +
      "met Go/No-Go-advies, Fase 2 (T4P Business per lid) en een geaggregeerde " +
      "board-analyse met talentkaart, cognitief profiel en roladviezen.",
    isDefault: false,
    creditCost: hddKost,
    journey: {
      gateEvaluator: "hdd-onder-de-motorkap",
      fases: [
        {
          fase: 1,
          naam: {
            nl: "Verkenning",
            en: "Exploration",
            fr: "Exploration",
            es: "Exploración",
            ru: "Разведка",
          },
          instrumenten: ["tapas-teamscan", "twominscan"],
          autoUitsturen: true,
        },
        {
          fase: 2,
          naam: {
            nl: "Diepteanalyse",
            en: "Deep dive",
            fr: "Analyse approfondie",
            es: "Análisis profundo",
            ru: "Глубокий анализ",
          },
          instrumenten: ["t4p-business-kompas"],
          autoUitsturen: true,
        },
      ],
    },
  });

  // -------------------------------------------------------------------------
  // Impact-roos — los rapport-instrument met BATCH-tarifering.
  //
  // De impact-roos leeft technisch in een aparte applicatie (impact-dashboard),
  // maar verschijnt hier wel in het centrale tarievenoverzicht omdat het mee
  // credits verbruikt. Het wordt NIET per stuk verrekend maar per bundel van 10
  // (instelbaar via env): 10 impact-rozen kosten standaard 5 credits.
  //
  // Modellering: creditCost houdt de "per-stuk-richtprijs" (afgeleid uit de
  // bundel, hier 0,5 credit/stuk) puur informatief; de feitelijke verrekening
  // verloopt via bundelGrootte + bundelCredits.
  // -------------------------------------------------------------------------
  const roosBundelGrootte = Number(process.env.IMPACTROOS_BUNDEL_GROOTTE ?? 10);
  const roosBundelCredits = Number(process.env.IMPACTROOS_BUNDEL_CREDITS ?? 5);
  map.set("impact-roos", {
    instrumentId: "impact-roos",
    flowType: "individual",
    name: "Impact-roos",
    version: "1.0.0",
    description:
      "Visueel impactrapport dat per bundel wordt verrekend in plaats van per " +
      "stuk: een vast aantal rozen kost samen een vast aantal credits.",
    isDefault: false,
    creditCost: roosBundelGrootte > 0 ? roosBundelCredits / roosBundelGrootte : roosBundelCredits,
    bundelGrootte: roosBundelGrootte,
    bundelCredits: roosBundelCredits,
  });

  // -------------------------------------------------------------------------
  // T4Sports — individueel mental talent profiel voor atleten.
  // -------------------------------------------------------------------------
  map.set("t4sports", {
    instrumentId: "t4sports",
    flowType: "individual",
    name: "T4Sports — Mental Talent Profiel",
    version: "1.0.0",
    description:
      "Psychometrisch mental talent profiel voor atleten: drivers, talent-foci en " +
      "talent-versnellers in sporttaal. Basis voor mental coaching op maat.",
    isDefault: false,
    creditCost: 1,
    instrument: hydrateInstrument(t4sportsJson),
  });

  // -------------------------------------------------------------------------
  // T4Teens — individueel instrument voor jongeren (16-21 jaar).
  //
  // T4Teens is een op maat gemaakte variant van het T4P-profiel, ontwikkeld
  // voor jongeren in het voortgezet onderwijs. De inhoud (vragenlijst, blokken,
  // rapport) is doelgroepspecifiek en verschilt structureel van het Business
  // Kompas. Geen instrument.json — de descriptor is metadata-only; de
  // rapport-branch gebruikt instrumentId "t4teens" als routing-sleutel.
  // -------------------------------------------------------------------------
  map.set("t4teens", {
    instrumentId: "t4teens",
    flowType: "individual",
    name: "T4Teens",
    version: "1.0.0",
    description:
      "Individueel TaPas-profiel voor jongeren (16-21 jaar): ontdek je talent, " +
      "energie en gedragspatroon in een doelgroepspecifieke vragenlijst en rapport.",
    isDefault: false,
    creditCost: 1,
  });

  // -------------------------------------------------------------------------
  // T4Students — individueel instrument voor studenten in het hoger onderwijs.
  //
  // T4Students is een op maat gemaakte variant van het T4P-profiel, ontwikkeld
  // voor studenten in het hoger onderwijs. De descriptor is metadata-only;
  // de rapport-branch gebruikt instrumentId "t4students" als routing-sleutel.
  // -------------------------------------------------------------------------
  map.set("t4students", {
    instrumentId: "t4students",
    flowType: "individual",
    name: "T4Students",
    version: "1.0.0",
    description:
      "Individueel TaPas-profiel voor studenten in het hoger onderwijs: ontdek je " +
      "talent, energie en gedragspatroon in een academisch kader.",
    isDefault: false,
    creditCost: 1,
  });

  return map;
}

const registry: Map<string, InstrumentDescriptor> = bouwRegistry();

// --- Publieke registry-helpers ---------------------------------------------

export function alleInstrumenten(): InstrumentDescriptor[] {
  return Array.from(registry.values());
}

export function getDescriptor(instrumentId: string): InstrumentDescriptor | undefined {
  return registry.get(instrumentId);
}

export function getDefaultDescriptor(): InstrumentDescriptor {
  const def = Array.from(registry.values()).find((d) => d.isDefault);
  if (!def) throw new Error("Geen standaard-instrument in registry");
  return def;
}

// Het standaard individuele instrument (gedrag-behoudend: dit is exact het
// instrument dat de bestaande code als singleton gebruikte).
export function getDefaultInstrument(): Instrument {
  const def = getDefaultDescriptor();
  if (!def.instrument) throw new Error("Standaard-instrument is niet individueel");
  return def.instrument;
}

// Veilige, taalbewuste client-view per instrumentId (valt terug op default).
export function clientInstrumentVoor(
  instrumentId: string | undefined,
  taal: Taal = STANDAARD_TAAL,
) {
  const desc = (instrumentId && registry.get(instrumentId)) || getDefaultDescriptor();
  if (!desc.instrument) {
    // Collaboratieve instrumenten leveren (later) een andere client-view.
    return null;
  }
  return clientInstrumentVan(desc.instrument, taal);
}

// Lichte samenvatting voor een instrumentkeuze-/overzichtsendpoint.
export function instrumentSamenvattingen() {
  return alleInstrumenten().map((d) => ({
    instrumentId: d.instrumentId,
    flowType: d.flowType,
    name: d.name,
    version: d.version,
    description: d.description,
    isDefault: d.isDefault,
    creditCost: d.creditCost,
    bundelGrootte: d.bundelGrootte,
    bundelCredits: d.bundelCredits,
  }));
}

// --- Tarievenoverzicht (prior-only) ----------------------------------------

export interface TariefRegel {
  instrumentId: string;
  name: string;
  flowType: FlowType;
  version: string;
  description: string;
  isDefault: boolean;
  // Tariferingsmodel: "per-stuk" (creditCost per afname) of "bundel"
  // (bundelCredits per bundelGrootte afnames).
  model: "per-stuk" | "bundel";
  // Per-stuk-tarief (credits per afname). Bij bundel puur informatief.
  creditCost: number;
  // Effectieve credit-kost per afname (bij bundel: bundelCredits/bundelGrootte).
  creditPerStuk: number;
  // Enkel bij model "bundel".
  bundelGrootte?: number;
  bundelCredits?: number;
  // Mensvriendelijke omschrijving van het tarief, bv.
  //   "1 credit per afname" of "10 stuks = 5 credits".
  tariefOmschrijving: string;
  // Herkomst van de actieve waarde:
  //   "default"   = code-default uit de registry (nog geen override opgeslagen).
  //   "aangepast" = registry-instrument met een opgeslagen override.
  //   "los"       = losse, zelf toegevoegde regel (geen registry-instrument).
  bron: "default" | "aangepast" | "los";
  // Hoort dit bij een registry-instrument? (bepaalt of het hard verwijderbaar is)
  isRegistry: boolean;
  gewijzigdDoor?: string | null;
  updatedAt?: string | null;
}

// Lichte vorm van een opgeslagen override/losse regel (komt uit de DB-laag).
export interface TariefOverride {
  instrumentId: string;
  naam: string;
  omschrijving: string;
  flowType: FlowType;
  model: "per-stuk" | "bundel";
  creditCost: number;
  bundelGrootte?: number | null;
  bundelCredits?: number | null;
  isCustom: boolean;
  gewijzigdDoor?: string | null;
  updatedAt?: string | null;
}

function maakTariefOmschrijving(
  model: "per-stuk" | "bundel",
  creditCost: number,
  bundelGrootte?: number | null,
  bundelCredits?: number | null,
): { tariefOmschrijving: string; creditPerStuk: number } {
  if (
    model === "bundel" &&
    typeof bundelGrootte === "number" &&
    bundelGrootte > 0 &&
    typeof bundelCredits === "number"
  ) {
    return {
      tariefOmschrijving: `${bundelGrootte} stuks = ${bundelCredits} ${bundelCredits === 1 ? "credit" : "credits"}`,
      creditPerStuk: bundelCredits / bundelGrootte,
    };
  }
  return {
    tariefOmschrijving: `${creditCost} ${creditCost === 1 ? "credit" : "credits"} per afname`,
    creditPerStuk: creditCost,
  };
}

// Basis-tariefregel afgeleid uit een registry-descriptor (code-default).
function descriptorNaarRegel(d: InstrumentDescriptor): TariefRegel {
  const heeftBundel =
    typeof d.bundelGrootte === "number" &&
    d.bundelGrootte > 0 &&
    typeof d.bundelCredits === "number";
  const model: "per-stuk" | "bundel" = heeftBundel ? "bundel" : "per-stuk";
  const { tariefOmschrijving, creditPerStuk } = maakTariefOmschrijving(
    model,
    d.creditCost,
    d.bundelGrootte,
    d.bundelCredits,
  );
  return {
    instrumentId: d.instrumentId,
    name: d.name,
    flowType: d.flowType,
    version: d.version,
    description: d.description,
    isDefault: d.isDefault,
    model,
    creditCost: d.creditCost,
    creditPerStuk,
    bundelGrootte: heeftBundel ? (d.bundelGrootte as number) : undefined,
    bundelCredits: heeftBundel ? (d.bundelCredits as number) : undefined,
    tariefOmschrijving,
    bron: "default",
    isRegistry: true,
  };
}

// Code-defaults uit de registry (geen DB-overrides).
export function tarievenOverzicht(): TariefRegel[] {
  return alleInstrumenten().map(descriptorNaarRegel);
}

// Voegt de code-defaults uit de registry samen met opgeslagen overrides en
// losse regels uit de DB. Een override op een registry-instrument vervangt de
// default-waarden; losse regels worden achteraan toegevoegd. Dit is de bron
// voor het bewerkbare tarievenoverzicht in de beheeromgeving.
export function tarievenSamengevoegd(overrides: TariefOverride[]): TariefRegel[] {
  const perId = new Map<string, TariefOverride>();
  for (const o of overrides) perId.set(o.instrumentId, o);

  const regels: TariefRegel[] = alleInstrumenten().map((d) => {
    const basis = descriptorNaarRegel(d);
    const o = perId.get(d.instrumentId);
    if (!o) return basis;
    perId.delete(d.instrumentId);
    const { tariefOmschrijving, creditPerStuk } = maakTariefOmschrijving(
      o.model,
      o.creditCost,
      o.bundelGrootte,
      o.bundelCredits,
    );
    return {
      ...basis,
      name: o.naam || basis.name,
      description: o.omschrijving || basis.description,
      flowType: o.flowType,
      model: o.model,
      creditCost: o.creditCost,
      creditPerStuk,
      bundelGrootte:
        o.model === "bundel" && typeof o.bundelGrootte === "number"
          ? o.bundelGrootte
          : undefined,
      bundelCredits:
        o.model === "bundel" && typeof o.bundelCredits === "number"
          ? o.bundelCredits
          : undefined,
      tariefOmschrijving,
      bron: "aangepast",
      gewijzigdDoor: o.gewijzigdDoor ?? null,
      updatedAt: o.updatedAt ?? null,
    };
  });

  for (const o of perId.values()) {
    const { tariefOmschrijving, creditPerStuk } = maakTariefOmschrijving(
      o.model,
      o.creditCost,
      o.bundelGrootte,
      o.bundelCredits,
    );
    regels.push({
      instrumentId: o.instrumentId,
      name: o.naam,
      flowType: o.flowType,
      version: "-",
      description: o.omschrijving,
      isDefault: false,
      model: o.model,
      creditCost: o.creditCost,
      creditPerStuk,
      bundelGrootte:
        o.model === "bundel" && typeof o.bundelGrootte === "number"
          ? o.bundelGrootte
          : undefined,
      bundelCredits:
        o.model === "bundel" && typeof o.bundelCredits === "number"
          ? o.bundelCredits
          : undefined,
      tariefOmschrijving,
      bron: "los",
      isRegistry: false,
      gewijzigdDoor: o.gewijzigdDoor ?? null,
      updatedAt: o.updatedAt ?? null,
    });
  }

  return regels;
}
