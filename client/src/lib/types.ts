// Frontend types voor de TaPas afname-keten.

export interface EnergyOption {
  value: number;
  label: string;
}
export interface ClientItem {
  pos: string;
  text: string;
}
export interface ClientBlock {
  blockIndex: number;
  stateKey: string;
  family: string;
  energyMode: "item" | "block";
  items: ClientItem[];
}
export interface ConnectionQuestion {
  id: string;
  scale: string;
  label: string;
  text: string;
}
export interface ClientInstrument {
  instrumentId: string;
  name: string;
  language: string;
  description: string;
  responseScales: {
    energy: { type: string; min: number; max: number; options: EnergyOption[] };
    connection0to10: any;
    baselineEnergy0to10: any;
  };
  blocks: ClientBlock[];
  connectionQuestions: ConnectionQuestion[];
  totalBlocks: number;
}

export interface BlockAnswer {
  most: string | null;
  least: string | null;
  itemEnergy: { most: number | null; least: number | null };
  blockEnergy: number | null;
}
export type AnswerState = Record<string, BlockAnswer>;

export interface Afname {
  id: number;
  respondentCode: string;
  name: string;
  company: string | null;
  role: string | null;
  status: string;
  baselineEnergy: number;
  taal?: string;
  instrumentId?: string | null;
  createdAt: string;
  completedAt: string | null;
  inviteToken?: string | null;
  uitgenodigdAt?: string | null;
  herinnerdAt?: string | null;
  // Tussentijds bewaarde deel 1-antwoorden (JSON-string of geparset object).
  mainResponses?: string | AnswerState | null;
}

// --- Fase C1: organisaties & credits ---
export interface CreditSaldo {
  organisatieId: number;
  beschikbaar: number;
  gereserveerd: number;
  verbruikt: number;
  updatedAt: string;
}

export interface Organisatie {
  id: number;
  naam: string;
  type: "bedrijf" | "school" | "coach" | "particulier";
  btwNummer: string | null;
  kboNummer: string | null;
  peppolId: string | null;
  peppolBereikbaar: boolean;
  factuurType: "peppol" | "pdf";
  contactpersoon: string | null;
  email: string | null;
  adres: string | null;
  postcode: string | null;
  gemeente: string | null;
  land: string;
  createdAt: string;
}

export interface OrganisatieMetSaldo extends Organisatie {
  saldo: CreditSaldo;
}

export interface CreditTransactie {
  id: number;
  organisatieId: number;
  type: "aankoop" | "reservering" | "verbruik" | "vrijgave" | "correctie" | "overdracht";
  aantal: number;
  afnameId: number | null;
  billerEntiteitId: number | null;
  omschrijving: string | null;
  createdAt: string;
}

export interface Creditpakket {
  id: string;
  naam: string;
  credits: number;
  prijsExclBtw: number;
}

export interface BillerEntiteit {
  id: number;
  naam: string;
  vennootschapsnaam: string;
  adres: string | null;
  postcode: string | null;
  gemeente: string | null;
  land: string;
  btwNummer: string | null;
  kboNummer: string | null;
  peppolId: string | null;
  iban: string | null;
  logo: string | null;
  factuurPrefix: string;
  btwTarief: number;
  geldigVan: string;
  geldigTot: string | null;
  actief: boolean;
  createdAt: string;
}

// --- Fase C2-C3: betalingen, facturen & rapporten ---
export interface Betaling {
  id: number;
  organisatieId: number;
  provider: string;
  providerRef: string | null;
  methode: string | null;
  pakketId: string | null;
  credits: number;
  bedragExclBtw: number; // eurocent
  btwTarief: number;
  btwBedrag: number; // eurocent
  bedragInclBtw: number; // eurocent
  munt: string;
  status: "open" | "betaald" | "mislukt" | "verlopen";
  creditTransactieId: number | null;
  factuurId: number | null;
  checkoutUrl: string | null;
  createdAt: string;
  betaaldAt: string | null;
}

export interface Factuur {
  id: number;
  factuurnummer: string;
  billerEntiteitId: number;
  organisatieId: number;
  betalingId: number | null;
  bedragExclBtw: number; // eurocent
  btwBedrag: number; // eurocent
  bedragInclBtw: number; // eurocent
  munt: string;
  kanaal: "peppol" | "pdf";
  peppolStatus: string;
  factuurdatum: string;
  createdAt: string;
}

export interface RapportSamenvatting {
  id: number;
  afnameId: number;
  variant: "kompas" | "coachatlas";
  titel: string;
  contractVersie: string;
  createdAt: string;
}

export interface AdminAfnameDetail extends Afname {
  dashboardToken?: string | null;
  consentGiven: boolean;
  consentScope: string | null;
  consentTimestamp: string | null;
  mainResponses: AnswerState | null;
  connectionAnswers: { q1: number; q2: number; q3: number; q4: number } | null;
  generatorContract: any | null;
}
