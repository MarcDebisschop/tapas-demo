// ---------------------------------------------------------------------------
// server/routes/vragenlijst-t4students.ts
//
// GET /api/vragenlijst/tapas-t4students?taal=nl
//
// De vragenlijst van het studiekompas, in de taal van de afname, klaar om
// ingevuld te worden. Elk item houdt zijn eigen id (P0, I1, BE1, D1, ...): dat
// is dezelfde sleutel waarop de scoringsmotor (server/t4students/kompas-scoring.ts)
// zijn antwoorden leest.
//
// WAAROM DIT BESTAAT
// Dit instrument had geen eigen vragenlijstroute. Het invulscherm viel daardoor
// terug op /api/instrument, dat de 34 blokken van het T4P Business Kompas
// aanlevert. De deelnemer vulde dus vragen van een ander instrument in, en de
// antwoorden werden per blok bewaard (B0, B1, ...) terwijl de scoring per
// item-id leest. Uitkomst: nul gescoorde items en een rapport met nulwaarden.
// Deze route levert de echte items, onder de echte sleutels.
//
// WAAROM GEEN ClientInstrument-VORM
// T4Teens en T4Kids kunnen elk item als een blok met één uitspraak aanbieden,
// omdat elk item daar precies één waardering vraagt. Het studiekompas kent tien
// itemsoorten: herkenning met energie op hetzelfde item, een interesseschaal
// met drie standen, situatie-items met opties die meerdere constructen laden,
// twee schuiven van 0 tot 10, een vervolgvraag die van een eerder antwoord
// afhangt, en een open beginvraag. Die vormen passen niet in de blokvorm zonder
// gegevens te verminken; zie de uitleg in server/registry.ts bij de descriptor.
// Daarom draagt deze route de itemvorm van het instrument zelf.
// ---------------------------------------------------------------------------

import type { Express } from "express";
import { getOverridesMap } from "../question-manager";
import { T4STUDENTS_INSTRUMENT } from "../t4students/instrument";
import type { T4SInstrument, T4SItem, T4SOptie, T4SVertaalbaar } from "../t4students/instrument";
import { itemsVanInstrument } from "../t4students/antwoorden";

/** De talen waarin dit instrument bestaat. Al de rest leest Nederlands. */
const TALEN = ["nl", "fr", "en"] as const;
type T4STaal = (typeof TALEN)[number];

export function kiesTaal(ruw: unknown): T4STaal {
  const t = typeof ruw === "string" ? ruw.trim().toLowerCase() : "";
  return (TALEN as readonly string[]).includes(t) ? (t as T4STaal) : "nl";
}

/** De tekst in de gevraagde taal, met het Nederlands als terugval. */
function tekst(veld: T4SVertaalbaar | undefined, taal: T4STaal): string {
  if (!veld) return "";
  const gekozen = veld[taal];
  if (typeof gekozen === "string" && gekozen.trim()) return gekozen;
  return veld.nl ?? "";
}

interface UitgaandeOptie {
  key: string;
  text: string;
}

interface UitgaandeVariant {
  itemType: string;
  scale?: string;
  text: string;
  options?: UitgaandeOptie[];
}

interface UitgaandItem {
  id: string;
  family: string;
  familyLabel: string;
  construct?: string;
  itemType?: string;
  scale?: string;
  energyScale?: string;
  text: string;
  placeholder?: string;
  required?: boolean;
  options?: UitgaandeOptie[];
  dependsOn?: string;
  variants?: Record<string, UitgaandeVariant>;
}

function opties(lijst: T4SOptie[] | undefined, taal: T4STaal): UitgaandeOptie[] | undefined {
  if (!lijst || lijst.length === 0) return undefined;
  return lijst.map((o) => ({ key: o.key, text: tekst(o.text, taal) }));
}

/**
 * Bouwt de vragenlijst. De overrides uit het vraagbeheer (tabel
 * vraag_overschrijvingen) winnen boven de itemtekst uit het instrument, precies
 * zoals bij de andere instrumenten.
 */
export function bouwT4StudentsVragenlijst(
  taal: T4STaal,
  instrument: T4SInstrument = T4STUDENTS_INSTRUMENT,
): {
  instrumentId: string;
  version: string;
  name: string;
  language: T4STaal;
  instructions: string;
  scales: Record<string, unknown>;
  items: UitgaandItem[];
  totaalItems: number;
} {
  let overrides = new Map<string, Record<string, string>>();
  try {
    overrides = getOverridesMap("tapas-t4students");
  } catch {
    // Het vraagbeheer mag een afname nooit tegenhouden: zonder overrides
    // gelden gewoon de teksten uit het instrument.
    overrides = new Map();
  }

  const items: UitgaandItem[] = itemsVanInstrument(instrument).map((item: T4SItem) => {
    const familie = instrument.families?.find((f) => f.id === item.family);
    const ov = overrides.get(item.id);
    const eigenTekst = ov && ov[taal] ? ov[taal] : tekst(item.text, taal);
    const uit: UitgaandItem = {
      id: item.id,
      family: item.family,
      familyLabel: familie?.label ?? item.family,
      construct: item.construct,
      itemType: item.itemType,
      scale: item.scale,
      energyScale: item.energyScale,
      text: eigenTekst,
      required: item.required,
    };
    if (item.placeholder) uit.placeholder = tekst(item.placeholder, taal);
    const opts = opties(item.options, taal);
    if (opts) uit.options = opts;
    if (item.dependsOn) uit.dependsOn = item.dependsOn;
    if (item.variants) {
      const varianten: Record<string, UitgaandeVariant> = {};
      for (const [sleutel, variant] of Object.entries(item.variants)) {
        varianten[sleutel] = {
          itemType: variant.itemType ?? "",
          scale: variant.scale,
          text: tekst(variant.text, taal),
          options: opties(variant.options, taal),
        };
      }
      uit.variants = varianten;
    }
    return uit;
  });

  const hoofdsectie = instrument.sections?.[0];
  return {
    instrumentId: instrument.instrumentId,
    version: instrument.version,
    name: instrument.name,
    language: taal,
    instructions: tekst(hoofdsectie?.instructions as T4SVertaalbaar | undefined, taal),
    scales: schalen(instrument, taal),
    items,
    totaalItems: items.length,
  };
}

/**
 * De responsschalen, met de labels al in de juiste taal. Het scherm hoeft dan
 * geen enkele schaal zelf te kennen; wijzigt een label in het instrument, dan
 * wijzigt het scherm mee.
 */
function schalen(instrument: T4SInstrument, taal: T4STaal): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  for (const [naam, schaal] of Object.entries(instrument.responseScales ?? {})) {
    const s = schaal as {
      type?: string;
      min?: number;
      max?: number;
      label?: T4SVertaalbaar;
      options?: { value: number; label: T4SVertaalbaar }[];
    };
    uit[naam] = {
      type: s.type,
      min: s.min,
      max: s.max,
      label: s.label ? tekst(s.label, taal) : undefined,
      options: s.options
        ? s.options.map((o) => ({ value: o.value, label: tekst(o.label, taal) }))
        : undefined,
    };
  }
  return uit;
}

export function registerVragenlijstT4StudentsRoutes(app: Express): void {
  app.get("/api/vragenlijst/tapas-t4students", (req, res) => {
    try {
      const taal = kiesTaal(req.query.taal);
      res.json(bouwT4StudentsVragenlijst(taal));
    } catch (e) {
      console.error("[t4students] vragenlijst bouwen mislukt:", e);
      res.status(500).json({ error: "Vragenlijst kon niet geladen worden." });
    }
  });
}
