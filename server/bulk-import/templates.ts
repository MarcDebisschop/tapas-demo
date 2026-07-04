// =============================================================================
// server/bulk-import/templates.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Kolomdefinities per instrument voor de Excel/CSV-bulkimport. Elk instrument
// deelt een set basisvelden (voornaam, achternaam, e-mail, taal, rol) en kan
// instrument-specifieke extra velden toevoegen.
//
// Deze module bevat GEEN I/O — enkel de datadefinitie die zowel de
// template-generator (excel.ts), de parser/validator (excel.ts) als de UI
// (via routes.ts) gebruiken. Zo blijft er één bron van waarheid voor de
// kolomkoppen.
// =============================================================================

export interface VeldDef {
  // De exacte kolomkop zoals die in de Excel/CSV moet staan (mens-leesbaar NL).
  kolom: string;
  // Interne sleutel (voor de verwerkingslogica).
  sleutel: string;
  verplicht: boolean;
  // Korte hint die als voorbeeld/uitleg in de "Instructies"-sheet komt.
  hint: string;
}

export interface InstrumentTemplate {
  instrumentId: string;
  titel: string;
  instructie: string;
  velden: VeldDef[];
}

// De ondersteunde talen voor de kolom "Taal".
export const GELDIGE_TALEN = ["nl", "fr", "en", "es"] as const;
export type BulkTaal = (typeof GELDIGE_TALEN)[number];
export const STANDAARD_TAAL: BulkTaal = "nl";

// Basisvelden die ELK instrument deelt.
const BASIS_VELDEN: VeldDef[] = [
  { kolom: "Voornaam", sleutel: "voornaam", verplicht: false, hint: "Voornaam van de deelnemer (optioneel)" },
  { kolom: "Achternaam", sleutel: "achternaam", verplicht: false, hint: "Achternaam van de deelnemer (optioneel)" },
  { kolom: "E-mail", sleutel: "email", verplicht: true, hint: "Geldig e-mailadres — VERPLICHT" },
  { kolom: "Taal", sleutel: "taal", verplicht: false, hint: "nl, fr, en of es (standaard nl)" },
  { kolom: "Rol", sleutel: "rol", verplicht: false, hint: "Functie/rol van de deelnemer (optioneel)" },
];

// Instrument-specifieke extra velden.
const OUDER_VELDEN_VERPLICHT: VeldDef[] = [
  { kolom: "Naam ouder/voogd", sleutel: "ouderNaam", verplicht: true, hint: "Naam van ouder of voogd — VERPLICHT (minderjarige)" },
  { kolom: "E-mail ouder/voogd", sleutel: "ouderEmail", verplicht: true, hint: "Geldig e-mailadres ouder/voogd — VERPLICHT (minderjarige)" },
];

const OUDER_VELDEN_OPTIONEEL: VeldDef[] = [
  { kolom: "Naam ouder/voogd", sleutel: "ouderNaam", verplicht: false, hint: "Naam van ouder of voogd (optioneel)" },
  { kolom: "E-mail ouder/voogd", sleutel: "ouderEmail", verplicht: false, hint: "Geldig e-mailadres ouder/voogd (optioneel)" },
];

// De 6 instrumenten binnen scope voor bulk-import.
export const TEMPLATES: Record<string, InstrumentTemplate> = {
  "2minscan": {
    instrumentId: "2minscan",
    titel: "2MinScan — Energieprofiel",
    instructie:
      "Snelle energiescan. Vul per rij één deelnemer in. E-mail is verplicht; " +
      "de deelnemer ontvangt een persoonlijke link.",
    velden: [...BASIS_VELDEN],
  },
  "t4p-business-kompas": {
    instrumentId: "t4p-business-kompas",
    titel: "T4P Business Kompas",
    instructie:
      "Individueel talentprofiel voor professionals. Vul per rij één deelnemer " +
      "in. E-mail is verplicht.",
    velden: [...BASIS_VELDEN],
  },
  t4teens: {
    instrumentId: "t4teens",
    titel: "T4Teens (16-21 jaar)",
    instructie:
      "Talentprofiel voor jongeren. Voor minderjarigen zijn naam én e-mail van " +
      "de ouder/voogd VERPLICHT (ouderlijke toestemming).",
    velden: [...BASIS_VELDEN, ...OUDER_VELDEN_VERPLICHT],
  },
  t4students: {
    instrumentId: "t4students",
    titel: "T4Students (hoger onderwijs)",
    instructie:
      "Talentprofiel voor studenten. Naam/e-mail ouder/voogd is optioneel " +
      "(enkel invullen bij minderjarige studenten).",
    velden: [...BASIS_VELDEN, ...OUDER_VELDEN_OPTIONEEL],
  },
  "impact-roos": {
    instrumentId: "impact-roos",
    titel: "Impact-roos",
    instructie:
      "Visueel impactrapport. Gebruik de kolom 'Groep/Bundel' om rozen te " +
      "groeperen (optioneel).",
    velden: [
      ...BASIS_VELDEN,
      { kolom: "Groep/Bundel", sleutel: "groep", verplicht: false, hint: "Naam van de groep/bundel om rozen te groeperen (optioneel)" },
    ],
  },
  hdd: {
    instrumentId: "hdd",
    titel: "Human Due Diligence (HDD)",
    instructie:
      "Board-traject. Gebruik 'Functieniveau' en 'Team/Afdeling' om teamleden " +
      "in één HDD-traject te plaatsen (beide optioneel).",
    velden: [
      ...BASIS_VELDEN,
      { kolom: "Functieniveau", sleutel: "functieniveau", verplicht: false, hint: "Bijv. bestuurder, directie, manager (optioneel)" },
      { kolom: "Team/Afdeling", sleutel: "team", verplicht: false, hint: "Team of afdeling binnen het traject (optioneel)" },
    ],
  },
};

export function getTemplate(instrumentId: string): InstrumentTemplate | undefined {
  return TEMPLATES[instrumentId];
}

export function alleTemplates(): InstrumentTemplate[] {
  return Object.values(TEMPLATES);
}

export function isGeldigeTaal(taal: string): taal is BulkTaal {
  return (GELDIGE_TALEN as readonly string[]).includes(taal);
}
