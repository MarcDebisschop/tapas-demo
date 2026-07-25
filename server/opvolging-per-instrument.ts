// =============================================================================
// server/opvolging-per-instrument.ts - Opvolging van afnames PER INSTRUMENT
//
// Aanleiding: de opvolging "wel/niet ingevulde vragenlijsten" werd globaal
// geteld (server/storage.ts getInzichten, /api/inzichtcentrum/overzicht). Wie
// wil weten hoeveel T4Teens-vragenlijsten nog openstaan, kon dat niet zien.
//
// Deze module bevat de rekenkern als PURE functie: ze krijgt de ruwe rijen
// (instrumentId + status) en de instrumentenlijst binnen en geeft de
// aggregatie terug. Geen database, geen Express - zo is het gedrag exact
// testbaar en kan dezelfde kern zowel het admin- als het organisatiepad
// bedienen. Alle cijfers komen uit echte kolommen; er wordt niets geschat.
// =============================================================================

// Afnames zonder instrumentId (oudere rijen) krijgen een eigen groep. We raden
// nooit welk instrument het geweest zou zijn.
export const ONBEKEND_INSTRUMENT_ID = "onbekend";
export const ONBEKEND_LABEL = "Onbekend / niet-gekoppeld";

export const VOLTOOID_STATUS = "voltooid";

// Statussen die tellen als "bezig". 'deel1' en 'deel2' zijn de gedocumenteerde
// ketenstatussen. 'gestart' hoort daar ook bij: die waarde komt voor in de
// bestaande data en staat in server/storage.ts (seed) omschreven als "consent
// gegeven, niet voltooid". Ze als "niet gestart" tellen zou de opvolging
// feitelijk verkeerd voorstellen.
export const IN_UITVOERING_STATUSSEN = ["deel1", "deel2", "gestart"] as const;

// Alles vóór de start ('uitgenodigd', 'consent') telt als openstaand. Een
// onbekende status valt hier ook in: zo blijft de optelling
// voltooid + inUitvoering + nietGestart altijd gelijk aan totaal, en wordt een
// rij nooit stilzwijgend weggelaten.

export interface AfnameRij {
  instrumentId: string | null;
  status: string | null;
}

export interface InstrumentLabel {
  instrumentId: string;
  label: string;
}

export interface OpvolgingTelling {
  totaal: number;
  voltooid: number;
  inUitvoering: number;
  nietGestart: number;
  voltooiingsgraad: number;
}

export interface OpvolgingRij extends OpvolgingTelling {
  instrumentId: string;
  label: string;
}

export interface OpvolgingAntwoord {
  rijen: OpvolgingRij[];
  totalen: OpvolgingTelling;
}

// Voltooiingspercentage op 1 decimaal; 0 wanneer er niets te delen valt.
// Zelfde afrondingsregel als de bestaande pct()-helper in storage.ts.
export function voltooiingsgraad(voltooid: number, totaal: number): number {
  if (totaal <= 0) return 0;
  return Number(((voltooid / totaal) * 100).toFixed(1));
}

function isInUitvoering(status: string | null): boolean {
  return (IN_UITVOERING_STATUSSEN as readonly string[]).includes(String(status ?? ""));
}

function legeTelling(): OpvolgingTelling {
  return { totaal: 0, voltooid: 0, inUitvoering: 0, nietGestart: 0, voltooiingsgraad: 0 };
}

function tel(telling: OpvolgingTelling, status: string | null): void {
  telling.totaal++;
  if (status === VOLTOOID_STATUS) telling.voltooid++;
  else if (isInUitvoering(status)) telling.inUitvoering++;
  else telling.nietGestart++;
}

/**
 * Aggregeert de afnames per instrument.
 *
 * - Elk instrument uit `instrumenten` krijgt een rij, ook met 0 afnames, zodat
 *   het volledige palet zichtbaar blijft.
 * - Afnames met instrumentId null belanden in de groep "onbekend"; die groep
 *   verschijnt enkel wanneer er ook echt zulke afnames zijn.
 * - Een afname met een instrumentId dat niet (meer) in het register staat,
 *   krijgt een eigen rij met het ruwe id als label. Zo verdwijnt ze niet uit de
 *   telling.
 * - Sortering: aflopend op totaal, bij gelijk totaal alfabetisch op label.
 */
export function aggregeerPerInstrument(
  rijen: AfnameRij[],
  instrumenten: InstrumentLabel[],
): OpvolgingAntwoord {
  const labels = new Map<string, string>();
  const tellingen = new Map<string, OpvolgingTelling>();

  for (const inst of instrumenten) {
    labels.set(inst.instrumentId, inst.label);
    tellingen.set(inst.instrumentId, legeTelling());
  }

  const totalen = legeTelling();

  for (const rij of rijen) {
    const ruw = typeof rij.instrumentId === "string" ? rij.instrumentId.trim() : "";
    const sleutel = ruw === "" ? ONBEKEND_INSTRUMENT_ID : ruw;
    if (!tellingen.has(sleutel)) {
      tellingen.set(sleutel, legeTelling());
      // Onbekende groep krijgt een vaste, sprekende naam; een niet-geregistreerd
      // instrument-id tonen we ongewijzigd in plaats van er een naam bij te
      // verzinnen.
      if (!labels.has(sleutel)) {
        labels.set(sleutel, sleutel === ONBEKEND_INSTRUMENT_ID ? ONBEKEND_LABEL : sleutel);
      }
    }
    tel(tellingen.get(sleutel)!, rij.status);
    tel(totalen, rij.status);
  }

  const resultaat: OpvolgingRij[] = [];
  for (const [instrumentId, telling] of Array.from(tellingen.entries())) {
    telling.voltooiingsgraad = voltooiingsgraad(telling.voltooid, telling.totaal);
    resultaat.push({
      instrumentId,
      label: labels.get(instrumentId) ?? instrumentId,
      ...telling,
    });
  }

  totalen.voltooiingsgraad = voltooiingsgraad(totalen.voltooid, totalen.totaal);

  resultaat.sort(
    (a, b) => b.totaal - a.totaal || a.label.localeCompare(b.label, "nl"),
  );

  return { rijen: resultaat, totalen };
}

/**
 * Leest een organisatie-id uit een query-param en accepteert enkel een
 * positief geheel getal. Alles anders (leeg, "abc", "0", "-1", "1 OR 1=1",
 * een array) geeft null terug.
 *
 * Dit is een beveiligingscontrole, geen comfortfunctie: het aanroepende pad
 * voor een organisatie MOET weigeren wanneer hier null uitkomt, zodat een
 * ongeldige of ontbrekende id nooit stilzwijgend "toon alles" betekent.
 */
export function parseOrganisatieId(ruw: unknown): number | null {
  if (typeof ruw !== "string" && typeof ruw !== "number") return null;
  const tekst = String(ruw).trim();
  if (!/^\d+$/.test(tekst)) return null;
  const id = Number(tekst);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

/**
 * Filtert een afnamelijst op instrument en/of organisatie. Beide filters zijn
 * optioneel; zonder filters komt de lijst ongewijzigd terug (gedrag-behoudend
 * voor de bestaande admin-afnamelijst).
 *
 * Afnames zonder instrumentId zijn opvraagbaar met instrument="onbekend",
 * dezelfde sleutel als in het opvolgingsoverzicht. Op `organisatieId` wordt
 * strikt vergeleken, zodat afnames zonder organisatie nooit meekomen wanneer er
 * op een organisatie gefilterd wordt.
 */
export function filterAfnames<T extends { instrumentId?: string | null; organisatieId?: number | null }>(
  lijst: T[],
  filters: { instrument?: string | null; organisatieId?: number | null },
): T[] {
  const instrument = (filters.instrument ?? "").trim();
  const organisatieId = filters.organisatieId ?? null;
  if (!instrument && organisatieId === null) return lijst;

  return lijst.filter((a) => {
    if (instrument) {
      const sleutel = a.instrumentId ?? ONBEKEND_INSTRUMENT_ID;
      if (sleutel !== instrument) return false;
    }
    if (organisatieId !== null && a.organisatieId !== organisatieId) return false;
    return true;
  });
}

// Minimale vorm van de sqlite-handle die deze module nodig heeft.
interface SqliteAchtig {
  prepare(sql: string): { all(...params: any[]): any[] };
}

/**
 * Leest (instrumentId, status) van alle afnames, optioneel hard gefilterd op
 * één organisatie.
 *
 * `organisatieId === null` betekent "alle organisaties" en is UITSLUITEND
 * bedoeld voor het admin-pad. Bij een id wordt `organisatie_id = ?` gebruikt:
 * door de SQL-NULL-semantiek vallen afnames zonder organisatie daar
 * automatisch buiten, wat precies de bedoeling is - die zijn particulier en
 * horen bij geen enkele organisatie.
 */
export function leesAfnameRijen(
  sq: SqliteAchtig,
  organisatieId: number | null,
): AfnameRij[] {
  const rijen =
    organisatieId === null
      ? sq.prepare(`SELECT instrument_id, status FROM afnames`).all()
      : sq
          .prepare(`SELECT instrument_id, status FROM afnames WHERE organisatie_id = ?`)
          .all(organisatieId);
  return (rijen as any[]).map((r) => ({
    instrumentId: r.instrument_id ?? null,
    status: r.status ?? null,
  }));
}
