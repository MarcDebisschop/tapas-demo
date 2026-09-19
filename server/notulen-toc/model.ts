// ---------------------------------------------------------------------------
// server/notulen-toc/model.ts  -  NIEUW BESTAND
//
// Het vaste verslagmodel van het Team of Captains als gegevensvorm: dertien
// rubrieken en negen vaste thema's. Zowel de herkenning van beknopte notulen
// als de opbouw van het afgewerkte verslag werkt op deze vorm, zodat er maar één
// plaats is waar de opbouw van een verslag vastligt.
//
// De huisregel over het gedachtestreepje staat hier ook, in schoonTekst: elke
// tekst die uit een geüpload bestand komt, gaat door die zeef voordat ze in het
// verslag terechtkomt. Zo kan een omgezet verslag nooit een em-streepje dragen,
// ook niet wanneer de beknopte notulen er vol mee staan.
// ---------------------------------------------------------------------------

/** De negen vaste thema's van rubriek 5. De letter is de sleutel. */
export const THEMAS = [
  {
    letter: "A",
    titel: "Platform en technologie",
    uitleg: "Stand van de bouw, releases, testresultaten, wat het platform vandaag wel en nog niet draagt.",
  },
  {
    letter: "B",
    titel: "Psychometrie en academische onderbouwing",
    uitleg: "Validiteit, betrouwbaarheid, rol van de academische adviseurs, wetenschappelijke agenda.",
  },
  {
    letter: "C",
    titel: "Commercie, klanten en groei",
    uitleg: "Instroom, lopende opdrachten per eigenaar, pijplijn, prijszetting, cross-selling.",
  },
  {
    letter: "D",
    titel: "Organisatie, rollen en governance",
    uitleg: "Vennootschapsstructuur, raad van bestuur, mandaten, back-office, aanwervingen.",
  },
  {
    letter: "E",
    titel: "Coachnetwerk en kwaliteitsbewaking",
    uitleg: "Selectie en licentiëring van coaches, inzet op talent, evaluatie, communicatie naar het netwerk.",
  },
  {
    letter: "F",
    titel: "TaPas Academy en opleiding",
    uitleg: "Opleidingsaanbod, certificering, koppeling met de operationele agenda.",
  },
  {
    letter: "G",
    titel: "Merk en positionering",
    uitleg: "Naam, merkbescherming, visuele identiteit, communicatie naar de markt.",
  },
  {
    letter: "H",
    titel: "Financiën, facturatie en rapportering",
    uitleg: "Omzet en resultaat, facturatiestromen, boekhouding, financiële rapportering aan de investeerder.",
  },
  {
    letter: "I",
    titel: "Samenwerking binnen het Team of Captains",
    uitleg: "Bereikbaarheid, overlegritme, werkafspraken, wat de samenwerking versterkt of vertraagt.",
  },
] as const;

export type ThemaLetter = (typeof THEMAS)[number]["letter"];

export const THEMA_LETTERS: ThemaLetter[] = THEMAS.map((t) => t.letter);

/** De twaalf regels van de kerngegevens, in de orde waarin ze op papier staan. */
export const KERNVELDEN = [
  "vergadering",
  "datumEnUur",
  "locatie",
  "voorzitter",
  "verslaggever",
  "aanwezig",
  "verontschuldigd",
  "gast",
  "verspreiding",
  "status",
  "vertrouwelijkheid",
  "volgende",
] as const;

export type Kernveld = (typeof KERNVELDEN)[number];

export type Kerngegevens = Partial<Record<Kernveld, string>>;

export interface Besluit {
  nr: string;
  tekst: string;
  thema: string;
  eigenaar: string;
}

export interface Actie {
  nr: string;
  tekst: string;
  eigenaar: string;
  deadline: string;
  prioriteit: string;
}

export interface OpvolgingRij {
  nr: string;
  actie: string;
  eigenaar: string;
  datum: string;
  stand: string;
}

export interface OpenPunt {
  punt: string;
  ontbreekt: string;
  terug: string;
}

export interface Risico {
  risico: string;
  gevolg: string;
  maatregel: string;
  eigenaar: string;
}

export interface VraagAanPartner {
  vraag: string;
  waarom: string;
  tegen: string;
}

export interface Goedkeurder {
  naam: string;
  rol: string;
  op: string;
}

export interface ThemaInhoud {
  stand: string[];
  bespreking: string[];
  besluiten: string[];
}

/** De volledige inhoud van een verslag, los van de opmaak. */
export interface VerslagInhoud {
  kerngegevens: Kerngegevens;
  doel: string[];
  kernboodschap: string[];
  vaststellingVorigVerslag: string[];
  opvolging: OpvolgingRij[];
  themas: Record<ThemaLetter, ThemaInhoud>;
  besluiten: Besluit[];
  acties: Actie[];
  openPunten: OpenPunt[];
  risicos: Risico[];
  vragen: VraagAanPartner[];
  werkafspraken: string[];
  goedkeurders: Goedkeurder[];
  bijlagen: string[];
  /** Regels die de omzetting niet met zekerheid kon plaatsen. Gaan nooit verloren. */
  nietGeplaatst: string[];
}

export function leegThema(): ThemaInhoud {
  return { stand: [], bespreking: [], besluiten: [] };
}

export function leegVerslag(): VerslagInhoud {
  const themas = {} as Record<ThemaLetter, ThemaInhoud>;
  for (const letter of THEMA_LETTERS) themas[letter] = leegThema();
  return {
    kerngegevens: {},
    doel: [],
    kernboodschap: [],
    vaststellingVorigVerslag: [],
    opvolging: [],
    themas,
    besluiten: [],
    acties: [],
    openPunten: [],
    risicos: [],
    vragen: [],
    werkafspraken: [],
    goedkeurders: [],
    bijlagen: [],
    nietGeplaatst: [],
  };
}

/** Wat de omzetting van een bestand begreep. Gaat mee naar het scherm. */
export interface Omzetrapport {
  bestandsnaam: string;
  alineas: number;
  tabellen: number;
  /** Aantal vervangen gedachtestreepjes (em en en). Huisregel: nul in het verslag. */
  streepjesVervangen: number;
  kerngegevensGevonden: Kernveld[];
  kerngegevensOntbreken: Kernveld[];
  themasMetInhoud: ThemaLetter[];
  aantallen: {
    besluiten: number;
    acties: number;
    openPunten: number;
    risicos: number;
    vragen: number;
    werkafspraken: number;
    kernboodschap: number;
    opvolging: number;
    bijlagen: number;
    nietGeplaatst: number;
  };
  /** Meldingen voor de beheerder: wat ontbreekt, wat is geraden, wat vraagt nazicht. */
  aandacht: string[];
}

/** Leesbare naam van een kernveld, voor het scherm en voor de kerngegevenstabel. */
export const KERNVELD_LABEL: Record<Kernveld, string> = {
  vergadering: "Vergadering",
  datumEnUur: "Datum en uur",
  locatie: "Locatie",
  voorzitter: "Voorzitter",
  verslaggever: "Verslaggever",
  aanwezig: "Aanwezig",
  verontschuldigd: "Verontschuldigd",
  gast: "Gast of genodigde",
  verspreiding: "Verspreiding",
  status: "Status van dit verslag",
  vertrouwelijkheid: "Vertrouwelijkheid",
  volgende: "Volgende vergadering",
};

// ---------------------------------------------------------------------------
// Tekstzeef.
// ---------------------------------------------------------------------------

/** Aantal em- en en-streepjes in een tekst. */
export function telStreepjes(ruw: string): number {
  const treffers = ruw.match(/[\u2014\u2013]/g);
  return treffers ? treffers.length : 0;
}

/**
 * Maakt tekst uit een geüpload bestand geschikt voor het verslag:
 *
 *   * zachte afbreekstreepjes en vaste ruimtes worden gewone tekens;
 *   * een em- of en-streepje tussen twee ruimtes wordt een komma, want dat is
 *     in het Nederlands de plaats waar het streepje een bijstelling inleidt;
 *   * een streepje vooraan een regel wordt geschrapt, want dat is een opsomming;
 *   * een streepje tussen twee cijfers wordt "tot" (van 14.30 tot 18.30 uur);
 *   * elk overblijvend streepje wordt een komma;
 *   * dubbele ruimtes verdwijnen.
 *
 * De huisregel is hard: nergens een gedachtestreepje, ook niet als en-streepje.
 */
export function schoonTekst(ruw: string): string {
  let t = ruw
    .replace(/\u00ad/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  t = t.replace(/^\s*[\u2014\u2013]\s*/, "");
  t = t.replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, "$1 tot $2");
  t = t.replace(/\s+[\u2014\u2013]\s+/g, ", ");
  t = t.replace(/[\u2014\u2013]/g, ", ");
  t = t.replace(/\s*,\s*,\s*/g, ", ");
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}
