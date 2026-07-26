// =============================================================================
// server/organisatie-koppeling.ts - beheerders.organisatie_id vullen voor
// bestaande rijen (fase 2 van de organisatie-scoping).
//
// Tot nu toe was `beheerders.organisatie` een vrij tekstveld zonder koppeling
// naar `organisaties.id`. De scope heeft een harde koppeling nodig. Deze module
// legt die achterstand weg via de ENIGE toegelaten bron: een naam-match tussen
// dat vrije tekstveld en `organisaties.naam`.
//
// De regels, bewust streng:
//   - Match is case-insensitive en op de getrimde naam. Verder wordt er niets
//     genormaliseerd: geen fuzzy match, geen deelwoorden, geen afkortingen.
//     Dat zou gissen zijn en een beheerder aan de verkeerde organisatie hangen
//     is precies het lek dat we dichten.
//   - Is de naam dubbelzinnig (twee organisaties met dezelfde naam), dan
//     gebeurt er niets.
//   - Prior-beheerders (TaPasCity) krijgen BEWUST geen organisatie_id: zij
//     horen bij geen enkele klantorganisatie en omzeilen de scope centraal.
//   - Er is GEEN default-toewijzing. Wat niet matcht, blijft NULL en wordt
//     gelogd, zodat de beheerder het handmatig kan rechtzetten.
//
// De koppeling is idempotent: ze raakt enkel rijen aan waar organisatie_id nog
// NULL is, dus een tweede uitvoering doet niets meer.
// =============================================================================

import { sqlite } from "./storage";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

export interface KoppelBeheerder {
  id: number;
  naam: string;
  organisatie: string | null;
  isPrior: boolean;
}

export interface KoppelOrganisatie {
  id: number;
  naam: string;
}

export type KoppelReden = "gekoppeld" | "prior" | "geen-naam" | "geen-match" | "dubbelzinnig";

export interface KoppelBesluit {
  beheerderId: number;
  organisatieId: number | null;
  reden: KoppelReden;
}

export interface KoppelResultaat {
  bekeken: number;
  gekoppeld: number;
  overgeslagen: number;
  besluiten: KoppelBesluit[];
}

/** Sleutel voor de naam-match: getrimd en in kleine letters. */
export function naamSleutel(naam: string): string {
  return naam.trim().toLowerCase();
}

/**
 * Bouwt een index van organisatienaam naar id. Een naam die meer dan een keer
 * voorkomt, wordt op null gezet: dubbelzinnig is geen match.
 */
export function bouwNaamIndex(organisaties: KoppelOrganisatie[]): Map<string, number | null> {
  const index = new Map<string, number | null>();
  for (const org of organisaties) {
    const sleutel = naamSleutel(org.naam);
    if (!sleutel) continue;
    index.set(sleutel, index.has(sleutel) ? null : org.id);
  }
  return index;
}

/**
 * Beslist voor een enkele beheerder aan welke organisatie hij gekoppeld wordt.
 * Pure functie: geen databank, volledig te testen.
 */
export function beslisKoppeling(
  beheerder: KoppelBeheerder,
  naamIndex: Map<string, number | null>,
): KoppelBesluit {
  const vrijeTekst = (beheerder.organisatie ?? "").trim();

  // Prior hoort bij TaPasCity en dus bij geen enkele klantorganisatie.
  if (beheerder.isPrior && naamSleutel(vrijeTekst) === naamSleutel(PRIOR_ORGANISATIE)) {
    return { beheerderId: beheerder.id, organisatieId: null, reden: "prior" };
  }
  if (!vrijeTekst) {
    return { beheerderId: beheerder.id, organisatieId: null, reden: "geen-naam" };
  }

  const treffer = naamIndex.get(naamSleutel(vrijeTekst));
  if (treffer === undefined) {
    return { beheerderId: beheerder.id, organisatieId: null, reden: "geen-match" };
  }
  if (treffer === null) {
    return { beheerderId: beheerder.id, organisatieId: null, reden: "dubbelzinnig" };
  }
  return { beheerderId: beheerder.id, organisatieId: treffer, reden: "gekoppeld" };
}

// Minimale vorm van de sqlite-handle die deze module nodig heeft.
interface SqliteAchtig {
  prepare(sql: string): {
    all(...params: any[]): any[];
    run(...params: any[]): unknown;
  };
}

/**
 * Vult organisatie_id aan voor alle beheerders waar de kolom nog NULL is.
 * Rijen zonder eenduidige match blijven ongemoeid en komen in `besluiten`
 * terecht met de reden waarom.
 */
export function koppelBeheerdersAanOrganisaties(sq: SqliteAchtig): KoppelResultaat {
  const organisaties = (
    sq.prepare(`SELECT id, naam FROM organisaties`).all() as Array<{ id: number; naam: string }>
  ).map((r) => ({ id: r.id, naam: r.naam }));
  const naamIndex = bouwNaamIndex(organisaties);

  const rijen = sq
    .prepare(
      `SELECT id, naam, organisatie, is_prior FROM beheerders WHERE organisatie_id IS NULL`,
    )
    .all() as Array<{ id: number; naam: string; organisatie: string | null; is_prior: number }>;

  const zet = sq.prepare(
    `UPDATE beheerders SET organisatie_id = ? WHERE id = ? AND organisatie_id IS NULL`,
  );

  const besluiten: KoppelBesluit[] = [];
  let gekoppeld = 0;
  for (const rij of rijen) {
    const besluit = beslisKoppeling(
      { id: rij.id, naam: rij.naam, organisatie: rij.organisatie, isPrior: rij.is_prior === 1 },
      naamIndex,
    );
    besluiten.push(besluit);
    if (besluit.organisatieId !== null) {
      zet.run(besluit.organisatieId, rij.id);
      gekoppeld++;
    }
  }

  return { bekeken: rijen.length, gekoppeld, overgeslagen: rijen.length - gekoppeld, besluiten };
}

/**
 * Eenmalige uitvoering bij het opstarten van de server. Faalt nooit hard: een
 * mislukte koppeling mag het opstarten niet blokkeren. Wat niet gekoppeld raakt
 * wordt expliciet gelogd, want die beheerders krijgen straks scope "geen" en
 * zien dus geen data tot iemand hen handmatig koppelt.
 */
export function startOrganisatieKoppeling(): void {
  try {
    const res = koppelBeheerdersAanOrganisaties(sqlite as any);
    if (res.bekeken === 0) return;
    console.log(
      `[organisatie-koppeling] ${res.gekoppeld} van ${res.bekeken} beheerders gekoppeld aan een organisatie.`,
    );
    for (const besluit of res.besluiten) {
      if (besluit.reden === "gekoppeld" || besluit.reden === "prior") continue;
      console.warn(
        `[organisatie-koppeling] beheerder ${besluit.beheerderId} niet gekoppeld (${besluit.reden}); ` +
          `deze krijgt scope "geen" tot hij handmatig aan een organisatie hangt.`,
      );
    }
  } catch (e) {
    console.error("[organisatie-koppeling] overgeslagen:", e);
  }
}
