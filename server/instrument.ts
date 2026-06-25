import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TALEN, STANDAARD_TAAL, type Taal } from "../shared/talen";
import { getVraagTekst } from "./question-manager";

// Laadt de bevroren instrumentdefinitie (A1) als server-side configuratie.
// De definitie is de enige bron voor blokken, items, families en deel-2 vragen.
//
// Fase E (meertaligheid): tekstvelden kunnen ofwel een platte string (NL-only,
// legacy) zijn, ofwel een meertalig object { nl, fr, en, es, ru }. De helper
// `kies()` lost dit transparant op naar één taal, met terugval op NL.

// Een vertaalbaar tekstveld: string (legacy) of object per taal.
export type Vertaalbaar = string | Partial<Record<Taal, string>>;

// Kiest de juiste taal uit een vertaalbaar veld, met terugval op NL en dan
// op de eerst beschikbare waarde.
export function kies(veld: Vertaalbaar | undefined, taal: Taal): string {
  if (veld == null) return "";
  if (typeof veld === "string") return veld;
  return veld[taal] ?? veld[STANDAARD_TAAL] ?? Object.values(veld)[0] ?? "";
}

export interface InstrumentItem {
  id: string;
  pos: string;
  family: string;
  construct: string;
  cluster: string;
  text: Vertaalbaar;
}
export interface InstrumentBlock {
  blockIndex: number;
  stateKey: string;
  family: string;
  module: string;
  energyMode: "item" | "block";
  items: InstrumentItem[];
}
export interface ConnectionQuestion {
  id: string;
  scale: string;
  label: Vertaalbaar;
  text: Vertaalbaar;
}
export interface Instrument {
  instrumentId: string;
  version: string;
  name: string;
  language: string;
  description: string;
  responseScales: any;
  families: { id: string; label: string; energyMode: string; constructs: string[] }[];
  sections: any[];
  identity: any;
  // Afgeleide helpers:
  blocks: InstrumentBlock[];
  connectionQuestions: ConnectionQuestion[];
}

// Hydrateert een ruwe instrument.json-definitie naar een Instrument met de
// afgeleide helpers (blocks/connectionQuestions). Herbruikbaar gemaakt zodat
// de instrument-registry (Fase 1) hier meerdere instrumenten mee kan laden.
export function hydrateInstrument(def: any): Instrument {
  const main = def.sections.find((s: any) => s.sectionId === "main");
  const connection = def.sections.find((s: any) => s.sectionId === "connection");
  return {
    ...def,
    blocks: (main?.blocks ?? []) as InstrumentBlock[],
    connectionQuestions: (connection?.questions ?? []) as ConnectionQuestion[],
  };
}

function loadInstrument(): Instrument {
  // In dev draait dit vanuit server/ (tsx). In productie wordt het bestand
  // mee gebundeld; we proberen meerdere paden.
  const candidates = [
    join(process.cwd(), "server", "data", "instrument.json"),
    join(process.cwd(), "data", "instrument.json"),
    join(process.cwd(), "dist", "data", "instrument.json"),
  ];
  let raw: string | null = null;
  for (const c of candidates) {
    try {
      raw = readFileSync(c, "utf8");
      break;
    } catch {
      /* probeer volgende */
    }
  }
  if (!raw) throw new Error("Instrumentdefinitie niet gevonden");
  return hydrateInstrument(JSON.parse(raw));
}

// Het standaard individuele instrument. Blijft als named export beschikbaar
// zodat bestaande modules (scoring, rapportgenerator) ongewijzigd werken —
// gedrag-behoudend. De registry verwijst naar exact dit instrument als
// default; we laden het hier één keer en delen dezelfde instantie.
export const instrument: Instrument = loadInstrument();

// De energie-schaal kan meertalige labels hebben; we leveren één taal af,
// voor een willekeurig instrument.
function responseScalesVan(inst: Instrument, taal: Taal) {
  const rs = inst.responseScales ?? {};
  const energy = rs.energy ?? {};
  const opties = Array.isArray(energy.options) ? energy.options : [];
  return {
    ...rs,
    energy: {
      ...energy,
      options: opties.map((o: any) => ({ value: o.value, label: kies(o.label, taal) })),
    },
  };
}

// Veilige, taalbewuste client-view voor een willekeurig (individueel)
// instrument. Herbruikbaar gemaakt zodat de registry elk individueel
// instrument op dezelfde manier aan de frontend kan leveren.
export function clientInstrumentVan(inst: Instrument, taal: Taal = STANDAARD_TAAL) {
  const t: Taal = (TALEN as readonly string[]).includes(taal) ? taal : STANDAARD_TAAL;
  return {
    instrumentId: inst.instrumentId,
    name: inst.name,
    language: t,
    description: inst.description,
    responseScales: responseScalesVan(inst, t),
    blocks: inst.blocks.map((b) => ({
      blockIndex: b.blockIndex,
      stateKey: b.stateKey,
      family: b.family,
      energyMode: b.energyMode,
      items: b.items.map((it) => ({
        pos: it.pos,
        // Integratie Question Manager: override wint boven originele tekst.
        // item-ID is het geregistreerde instrument-ID (bijv. "1.1").
        text: getVraagTekst(
          "tapas-t4p",
          it.id,
          t,
          kies(it.text, t)
        ),
      })),
    })),
    connectionQuestions: inst.connectionQuestions.map((q) => ({
      id: q.id,
      scale: q.scale,
      label: kies(q.label, t),
      // Integratie Question Manager: override voor verbindingsvragen.
      text: getVraagTekst(
        "tapas-t4p",
        `deel2-${q.id}`,
        t,
        kies(q.text, t)
      ),
    })),
    totalBlocks: inst.blocks.length,
  };
}

// Veilige variant voor de frontend (default-instrument). Gedrag-behoudend:
// identiek aan voorheen, nu uitgedrukt via clientInstrumentVan.
export function clientInstrument(taal: Taal = STANDAARD_TAAL) {
  return clientInstrumentVan(instrument, taal);
}
