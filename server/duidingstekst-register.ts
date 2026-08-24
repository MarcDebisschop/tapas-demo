// =============================================================================
// server/duidingstekst-register.ts - Beheer van de VASTE duidingsteksten
//
// Waarom dit bestand bestaat:
//   De duidingsteksten van een instrument zijn inhoudelijk instrumentonderdeel.
//   Ze horen verfijnd te kunnen worden door wie het instrument bouwt, met een
//   spoor van wie wat wanneer wijzigde, zonder een nieuwe uitrol en zonder dat
//   een taalmodel de formulering per rapport opnieuw verzint. Deterministisch,
//   reproduceerbaar en verdedigbaar tegenover een lezer of een reviewer.
//
// Werkingsprincipe (spiegel van duiding-manager.ts):
//   - De tekst in de code of in het JSON-tekstbestand blijft de BRON en de
//     terugval. Ze wordt nooit naar de databank gekopieerd.
//   - Een beheerde wijziging staat als één rij in `duiding_overschrijvingen`
//     onder scope "rapporttekst:<instrument>", met dimensie = de tekstsleutel.
//     Die tabel draagt al gewijzigd_door en gewijzigd_op, dus de audit-historiek
//     en de CSV-export van het duidingsbeheer gelden meteen ook hier.
//   - Herstellen = de rij verwijderen, waarna de brontekst terugkeert.
//
// Bewust GEEN afhankelijkheid van storage.ts of van een instrumentmotor: dit
// bestand importeert enkel zuivere tekstbronnen. De databank wordt langs
// zetTekstDatabank() ingebracht (zie routes.ts). Is er geen databank ingebracht,
// dan geeft elke lezing de brontekst terug: falen is dus veilig.
//
// Talen: de sleutels dragen een taal, maar een instrument verklaart zelf welke
// talen het aanbiedt. T4P en T4Students leveren vandaag een Nederlands rapport,
// dus bieden ze enkel nl aan. Er wordt geen meertaligheid voorgewend die er
// niet is.
// =============================================================================

import duidingsBestand from "./data/t4students-duidingsteksten.json";
import omschrijvingenBestand from "./data/t4students-omschrijvingen.json";
import { KERN_STANDAARD, KORT_STANDAARD, EH_STANDAARD } from "./t4p/kompas-teksten";

export const TEKST_SCOPE = "rapporttekst";

// ─── Databank-toegang (ingebracht, niet geïmporteerd) ─────────────────────────

type SqliteHaler = () => any | null;
let haalSqlite: SqliteHaler = () => null;

/** Brengt de sqlite-verbinding in. Zonder dit blijft alles op de brontekst. */
export function zetTekstDatabank(haler: SqliteHaler) {
  haalSqlite = haler;
  wisCache();
}

function tabelKlaar() {
  try {
    const sqlite = haalSqlite();
    if (!sqlite) return null;
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS duiding_overschrijvingen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        dimensie TEXT NOT NULL,
        taal TEXT NOT NULL,
        tekst TEXT NOT NULL,
        gewijzigd_door TEXT NOT NULL,
        gewijzigd_op TEXT NOT NULL,
        UNIQUE(scope, dimensie, taal)
      )
    `);
    return sqlite;
  } catch (e) {
    console.error("[TEKST] Tabel aanmaken mislukt:", e);
    return null;
  }
}

// ─── Cache: een rapport vraagt dezelfde teksten tientallen keren op ───────────
//
// De cache wordt per instrument gevuld en bij elke schrijfactie gewist, zodat
// een beheerde wijziging onmiddellijk in het volgende rapport zit.

const cache = new Map<string, Map<string, string>>();

function wisCache() {
  cache.clear();
}

function overschrijvingen(instrument: string): Map<string, string> {
  const bestaand = cache.get(instrument);
  if (bestaand) return bestaand;
  const kaart = new Map<string, string>();
  const sqlite = tabelKlaar();
  if (sqlite) {
    try {
      const rijen = sqlite
        .prepare("SELECT dimensie, taal, tekst FROM duiding_overschrijvingen WHERE scope = ?")
        .all(scopeVan(instrument)) as { dimensie: string; taal: string; tekst: string }[];
      for (const r of rijen) kaart.set(`${r.dimensie}|${r.taal}`, r.tekst);
    } catch {
      // Falen is veilig: de brontekst blijft gelden.
    }
  }
  cache.set(instrument, kaart);
  return kaart;
}

export function scopeVan(instrument: string): string {
  return `${TEKST_SCOPE}:${instrument}`;
}

// ─── De catalogus van beheerbare velden ───────────────────────────────────────

export interface TekstVeld {
  /** Stabiele sleutel; wordt in de databank als dimensie bewaard. */
  sleutel: string;
  /** Wat de lezer in het beheerscherm ziet staan. */
  label: string;
  /** De brontekst uit de code of het JSON-bestand. */
  bron: string;
  /** Lange tekst (tekstvak) of korte tekst (één regel). */
  lang: boolean;
}

export interface TekstGroep {
  groep: string;
  toelichting: string;
  velden: TekstVeld[];
}

export interface TekstInstrument {
  id: string;
  label: string;
  talen: string[];
  /** Waar deze teksten in het rapport terechtkomen. */
  waar: string;
  groepen: TekstGroep[];
}

interface DuidingsBestandVorm {
  constructen: Record<string, { familie: string; tekst: string }>;
}
interface OmschrijvingenBestandVorm {
  constructen: Record<string, string>;
}
const T4S_DUIDING = duidingsBestand as DuidingsBestandVorm;
const T4S_OMSCHRIJVING = omschrijvingenBestand as OmschrijvingenBestandVorm;

// Sleutelvormen. Bewust kort en stabiel: ze staan in de databank en in het
// audit-log, dus ze mogen niet meebewegen met een label in de UI.
export const SLEUTEL = {
  t4pKern: (construct: string) => `kern:${construct}`,
  t4pKort: (construct: string) => `kort:${construct}`,
  t4pEh: (construct: string) => `eh-duiding:${construct}`,
  t4sDuiding: (construct: string) => `duiding:${construct}`,
  t4sOmschrijving: (construct: string) => `omschrijving:${construct}`,
};

function bouwCatalogus(): Record<string, TekstInstrument> {
  const t4p: TekstInstrument = {
    id: "t4p-business-kompas",
    label: "T4P Business Kompas",
    talen: ["nl"],
    waar: "De vaste woordkeuze in de kompasbladen: het kernwoord bij een construct, het korte woord in doorlopende tekst en de duidingszin bij de E/H-oriëntatie.",
    groepen: [
      {
        groep: "Kernwoord per construct",
        toelichting:
          "Komt in het rapport achter de constructnaam en in de leeszinnen. Houd het bij een woordgroep, niet bij een volzin.",
        velden: Object.entries(KERN_STANDAARD).map(([construct, tekst]) => ({
          sleutel: SLEUTEL.t4pKern(construct),
          label: construct,
          bron: tekst,
          lang: false,
        })),
      },
      {
        groep: "Kort woord per construct",
        toelichting: "Gebruikt in opsommingen binnen doorlopende tekst. Bij voorkeur één woord.",
        velden: Object.entries(KORT_STANDAARD).map(([construct, tekst]) => ({
          sleutel: SLEUTEL.t4pKort(construct),
          label: construct,
          bron: tekst,
          lang: false,
        })),
      },
      {
        groep: "Duiding bij de E/H-oriëntatie",
        toelichting:
          "Eén zin per construct, naast de code E, H of E+H. De code zelf is instrumentstructuur en staat vast.",
        velden: Object.entries(EH_STANDAARD).map(([construct, def]) => ({
          sleutel: SLEUTEL.t4pEh(construct),
          label: `${construct} (${def.code})`,
          bron: def.duiding,
          lang: true,
        })),
      },
    ],
  };

  const t4s: TekstInstrument = {
    id: "t4students",
    label: "T4Students Studiekompas",
    talen: ["nl"],
    waar: "De duidingstekst bij elk construct op de talentbladen, en de gewone omschrijving die overal naast een constructnaam staat.",
    groepen: [
      {
        groep: "Duidingstekst per construct",
        toelichting:
          "De tekst die de jongere leest bij een talentfocus, een versneller of een driver. Schrijf in de je-vorm en blijf bij gedrag dat de jongere herkent.",
        velden: Object.entries(T4S_DUIDING.constructen).map(([construct, def]) => ({
          sleutel: SLEUTEL.t4sDuiding(construct),
          label: `${construct} (${def.familie})`,
          bron: def.tekst,
          lang: true,
        })),
      },
      {
        groep: "Omschrijving naast de constructnaam",
        toelichting:
          "Staat overal waar een constructnaam verschijnt, als gewone-taal-toelichting. Kort houden: een woordgroep, geen zin.",
        velden: Object.entries(T4S_OMSCHRIJVING.constructen).map(([construct, tekst]) => ({
          sleutel: SLEUTEL.t4sOmschrijving(construct),
          label: construct,
          bron: tekst,
          lang: false,
        })),
      },
    ],
  };

  return { [t4p.id]: t4p, [t4s.id]: t4s };
}

const CATALOGUS = bouwCatalogus();

/** De instrumenten waarvan de vaste teksten beheerd kunnen worden. */
export function tekstInstrumenten(): { id: string; label: string; talen: string[]; waar: string; aantalVelden: number }[] {
  return Object.values(CATALOGUS).map((i) => ({
    id: i.id,
    label: i.label,
    talen: i.talen,
    waar: i.waar,
    aantalVelden: i.groepen.reduce((n, g) => n + g.velden.length, 0),
  }));
}

export function isTekstInstrument(x: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(CATALOGUS, String(x ?? ""));
}

function veldVan(instrument: string, sleutel: string): TekstVeld | null {
  const inst = CATALOGUS[instrument];
  if (!inst) return null;
  for (const g of inst.groepen) {
    const v = g.velden.find((v) => v.sleutel === sleutel);
    if (v) return v;
  }
  return null;
}

function normTaalVoor(instrument: string, taal: unknown): string {
  const inst = CATALOGUS[instrument];
  const t = String(taal ?? "");
  if (inst && inst.talen.includes(t)) return t;
  return inst ? inst.talen[0] : "nl";
}

// ─── Lezen: de motoren van de instrumenten gebruiken dit ──────────────────────

/**
 * De geldende tekst voor één sleutel: de beheerde overschrijving als die er is,
 * anders de brontekst. Geeft een lege tekst terug voor een onbekende sleutel,
 * precies zoals de motoren dat vandaag al doen, zodat er nooit iets verzonnen
 * wordt.
 */
export function tekstVan(instrument: string, sleutel: string, taal: string = "nl"): string {
  const veld = veldVan(instrument, sleutel);
  const t = normTaalVoor(instrument, taal);
  const override = overschrijvingen(instrument).get(`${sleutel}|${t}`);
  if (override != null && override.trim() !== "") return override;
  return veld?.bron ?? "";
}

/** Zoals tekstVan, maar met een expliciete terugval voor sleutels buiten de catalogus. */
export function tekstOfStandaard(
  instrument: string,
  sleutel: string,
  standaard: string,
  taal: string = "nl",
): string {
  const t = normTaalVoor(instrument, taal);
  const override = overschrijvingen(instrument).get(`${sleutel}|${t}`);
  if (override != null && override.trim() !== "") return override;
  const veld = veldVan(instrument, sleutel);
  return veld?.bron ?? standaard;
}

/** Alle velden van één instrument in één taal, klaar voor het beheerscherm. */
export function tekstOverzicht(instrument: string, taal: string) {
  const inst = CATALOGUS[instrument];
  if (!inst) return null;
  const t = normTaalVoor(instrument, taal);
  const kaart = overschrijvingen(instrument);
  return {
    instrument: inst.id,
    label: inst.label,
    taal: t,
    talen: inst.talen,
    waar: inst.waar,
    scope: scopeVan(inst.id),
    groepen: inst.groepen.map((g) => ({
      groep: g.groep,
      toelichting: g.toelichting,
      velden: g.velden.map((v) => {
        const override = kaart.get(`${v.sleutel}|${t}`);
        return {
          sleutel: v.sleutel,
          label: v.label,
          lang: v.lang,
          bron: v.bron,
          tekst: override != null && override.trim() !== "" ? override : v.bron,
          heeftOverride: override != null && override.trim() !== "",
        };
      }),
    })),
  };
}

// ─── Schrijven ────────────────────────────────────────────────────────────────

export function bewaarTekst(
  instrument: string,
  sleutel: string,
  taal: string,
  tekst: string,
  door: string,
): { ok: boolean; fout?: string } {
  if (!isTekstInstrument(instrument)) return { ok: false, fout: "Onbekend instrument." };
  if (!veldVan(instrument, sleutel)) return { ok: false, fout: "Onbekende tekstsleutel." };
  const t = normTaalVoor(instrument, taal);
  const schoon = String(tekst ?? "").trim();
  if (!schoon) return { ok: false, fout: "Tekst is verplicht." };
  const sqlite = tabelKlaar();
  if (!sqlite) return { ok: false, fout: "Geen databank beschikbaar." };
  try {
    sqlite
      .prepare(`
        INSERT INTO duiding_overschrijvingen (scope, dimensie, taal, tekst, gewijzigd_door, gewijzigd_op)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope, dimensie, taal) DO UPDATE SET
          tekst = excluded.tekst,
          gewijzigd_door = excluded.gewijzigd_door,
          gewijzigd_op = excluded.gewijzigd_op
      `)
      .run(scopeVan(instrument), sleutel, t, schoon, door, new Date().toISOString());
    wisCache();
    return { ok: true };
  } catch (e) {
    console.error("[TEKST] Opslaan mislukt:", e);
    return { ok: false, fout: "Opslaan mislukt." };
  }
}

export function wisTekst(instrument: string, sleutel: string, taal: string): { ok: boolean; fout?: string } {
  if (!isTekstInstrument(instrument)) return { ok: false, fout: "Onbekend instrument." };
  if (!veldVan(instrument, sleutel)) return { ok: false, fout: "Onbekende tekstsleutel." };
  const t = normTaalVoor(instrument, taal);
  const sqlite = tabelKlaar();
  if (!sqlite) return { ok: false, fout: "Geen databank beschikbaar." };
  try {
    sqlite
      .prepare("DELETE FROM duiding_overschrijvingen WHERE scope = ? AND dimensie = ? AND taal = ?")
      .run(scopeVan(instrument), sleutel, t);
    wisCache();
    return { ok: true };
  } catch {
    return { ok: false, fout: "Verwijderen mislukt." };
  }
}

/** Historiek van één tekstveld: alle bewaarde standen, nieuwste eerst. */
export function tekstLog(instrument: string, sleutel: string) {
  const sqlite = tabelKlaar();
  if (!sqlite) return [];
  try {
    return sqlite
      .prepare(
        `SELECT scope, dimensie, taal, tekst, gewijzigd_door, gewijzigd_op
           FROM duiding_overschrijvingen
          WHERE scope = ? AND dimensie = ?
          ORDER BY gewijzigd_op DESC`,
      )
      .all(scopeVan(instrument), sleutel);
  } catch {
    return [];
  }
}
