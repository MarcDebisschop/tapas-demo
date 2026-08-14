/**
 * Het licentiebeeld van één persoon, samengevat voor een scherm.
 *
 * Bouwplan §9.7 vraagt op drie bestaande schermen dezelfde vraag: hoe staat
 * iemand ervoor op het punt van licenties? Het scherm `/admin/toegang` heeft er
 * een kolom voor nodig, `/admin/coaches` een blokje per coach en
 * `/coach/dashboard` één kaart. Drie schermen, één vraag — dus één antwoord,
 * hier, en niet drie keer opnieuw geteld in drie componenten.
 *
 * Zuivere functies, in dezelfde stijl als `rechten.ts` en `regiekamer.ts`: geen
 * databank, geen express. Deze module krijgt licentierijen mee en rekent. Wie ze
 * ophaalt, is de routelaag.
 *
 * ---------------------------------------------------------------------------
 * Drie dingen die deze module bewust niet doet
 * ---------------------------------------------------------------------------
 *
 * 1. **Ze beslist niet of iemand mag afnemen.** Dat antwoord staat in
 *    `rechten.magAfnemen` en nergens anders. Deze module leest dezelfde
 *    verzameling `STATUSSEN_MET_AFNAMERECHT` en telt hoeveel licenties erin
 *    vallen, maar geeft geen poortuitspraak. Wie een poort wil, roept de poort.
 *
 * 2. **Ze weegt geen statussen tegen elkaar af tot één cijfer.** Er is geen
 *    "licentiescore". Iemand met drie bekrachtigde licenties en één opgeschorte
 *    is niet "75% in orde"; die ene opschorting is een feit met een eigen
 *    verhaal. Het beeld telt en noemt, en laat het wegen aan de mens die kijkt.
 *
 * 3. **Ze kent geen alertdrempel.** `alertActief` wordt geteld en doorgegeven,
 *    niet geïnterpreteerd. Een alert is een uitnodiging om te kijken, geen
 *    sanctie. Dat staat zo in `rechten.ts` en het blijft hier zo.
 *
 * ---------------------------------------------------------------------------
 * Waarom "geen licenties" en "geen register" twee verschillende dingen zijn
 * ---------------------------------------------------------------------------
 *
 * Iemand die niet in het register van geaccrediteerden staat, heeft geen
 * licentiebeeld — niet een leeg beeld, maar geen. Dat is geen woordenspel: op
 * `/admin/toegang` staan beheerders die nooit met een instrument werken, en bij
 * hen zou "0 geldige licenties" lezen als een tekort. Daarom kent het beeld een
 * stand `buiten_het_register`, en die is uitdrukkelijk neutraal.
 *
 * Iemand die wél in het register staat maar nul licenties heeft, is iets anders:
 * daar is een keten begonnen en niet afgemaakt. Dat is stand `geen_licenties`.
 */

import {
  STATUSSEN_MET_AFNAMERECHT,
  type Licentiestatus,
} from "./schema";

/**
 * De samengevatte stand van één persoon.
 *
 * De volgorde is de volgorde van ernst, van neutraal naar zorgelijk. Het scherm
 * mag daarop kleuren, maar de reden staat er altijd in woorden bij — kleur alleen
 * is geen boodschap.
 */
export const LICENTIESTANDEN = [
  "buiten_het_register",
  "geen_licenties",
  "in_orde",
  "let_op",
  "geen_afnamerecht",
] as const;
export type Licentiestand = (typeof LICENTIESTANDEN)[number];

/** Wat deze module van een licentie moet weten. Uitdrukkelijk niet de hele rij. */
export interface LicentieVoorBeeld {
  instrumentId: string;
  status: Licentiestatus;
  geldigVan: string;
  geldigTot: string | null;
  alertActief: boolean;
  voorwaardeVoor: string | null;
}

export interface LicentieBeeld {
  stand: Licentiestand;
  /** Aantal licenties met een status uit `STATUSSEN_MET_AFNAMERECHT`, geldig op de peildatum. */
  metAfnamerecht: number;
  /** Aantal licenties zonder afnamerecht, om welke reden dan ook. */
  zonderAfnamerecht: number;
  /** Aantal licenties met een openstaande alert uit een tussentijdse toets. */
  metAlert: number;
  /** Aantal licenties met een voorwaarde die nog een datum voor zich heeft. */
  metVoorwaarde: number;
  /** De eerstvolgende einddatum onder de licenties met afnamerecht; leeg wanneer er geen is. */
  eerstverlopend: { instrumentId: string; geldigTot: string; dagen: number } | null;
  /** Eén regel Nederlands. Altijd gevuld, ook bij `buiten_het_register`. */
  samenvatting: string;
  /** Per instrument, oplopend op naam, zodat het scherm niet hoeft te sorteren. */
  perInstrument: Array<{
    instrumentId: string;
    status: Licentiestatus;
    afnamerecht: boolean;
    reden: string | null;
    geldigTot: string | null;
    alertActief: boolean;
  }>;
}

/** Hele dagen van `van` naar `tot`. Negatief wanneer `tot` al voorbij is. */
function dagenTussen(van: string, tot: string): number {
  const a = Date.parse(`${van.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${tot.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Heeft deze licentie op de peildatum afnamerecht, en zo niet, waarom niet?
 *
 * Dezelfde drie vragen als in `rechten.magAfnemen`, in dezelfde orde, met
 * dezelfde uitkomst. Er wordt hier niets bijbedacht: valt de status buiten
 * `STATUSSEN_MET_AFNAMERECHT`, dan is dat de reden, en anders beslist het venster.
 * Zou deze functie ooit iets anders zeggen dan de poort, dan is dat een fout in
 * deze functie.
 */
function beoordeel(
  licentie: LicentieVoorBeeld,
  peildatum: string,
): { afnamerecht: boolean; reden: string | null } {
  const dag = peildatum.slice(0, 10);
  if (!STATUSSEN_MET_AFNAMERECHT.includes(licentie.status)) {
    return { afnamerecht: false, reden: `status ${licentie.status.replace(/_/g, " ")}` };
  }
  if (licentie.geldigVan.slice(0, 10) > dag) {
    return { afnamerecht: false, reden: `nog niet geldig, begint ${licentie.geldigVan.slice(0, 10)}` };
  }
  if (licentie.geldigTot !== null && licentie.geldigTot.slice(0, 10) < dag) {
    return { afnamerecht: false, reden: `verlopen op ${licentie.geldigTot.slice(0, 10)}` };
  }
  return { afnamerecht: true, reden: null };
}

/**
 * Vat de licenties van één persoon samen.
 *
 * `staatInRegister` moet los worden meegegeven en is niet af te leiden uit de
 * lijst: iemand kan in het register staan met nul licenties, en dat is een ander
 * verhaal dan iemand die er niet in staat. Zie de bestandskop.
 */
export function maakLicentieBeeld(
  licenties: readonly LicentieVoorBeeld[],
  peildatum: string,
  staatInRegister: boolean,
): LicentieBeeld {
  const leeg: LicentieBeeld = {
    stand: "buiten_het_register",
    metAfnamerecht: 0,
    zonderAfnamerecht: 0,
    metAlert: 0,
    metVoorwaarde: 0,
    eerstverlopend: null,
    samenvatting: "Staat niet in het register van geaccrediteerden.",
    perInstrument: [],
  };

  if (!staatInRegister) return leeg;

  if (licenties.length === 0) {
    return {
      ...leeg,
      stand: "geen_licenties",
      samenvatting: "Staat in het register, maar heeft nog geen enkele licentie.",
    };
  }

  const dag = peildatum.slice(0, 10);
  const perInstrument = [...licenties]
    .sort((a, b) => a.instrumentId.localeCompare(b.instrumentId))
    .map((l) => {
      const { afnamerecht, reden } = beoordeel(l, peildatum);
      return {
        instrumentId: l.instrumentId,
        status: l.status,
        afnamerecht,
        reden,
        geldigTot: l.geldigTot === null ? null : l.geldigTot.slice(0, 10),
        alertActief: l.alertActief,
      };
    });

  const metAfnamerecht = perInstrument.filter((r) => r.afnamerecht).length;
  const zonderAfnamerecht = perInstrument.length - metAfnamerecht;
  const metAlert = licenties.filter((l) => l.alertActief).length;
  // Een voorwaarde met een datum die al voorbij is, is geen openstaande
  // voorwaarde meer maar een verstreken termijn. Die hoort op de agenda van de
  // regiekamer en niet in deze teller.
  const metVoorwaarde = licenties.filter(
    (l) => l.voorwaardeVoor !== null && l.voorwaardeVoor.slice(0, 10) >= dag,
  ).length;

  // Alleen licenties die vandaag mogen afnemen kunnen verlopen. Een licentie
  // zonder afnamerecht heeft geen einddatum die iets betekent.
  const kandidaten = perInstrument.filter(
    (r): r is typeof r & { geldigTot: string } => r.afnamerecht && r.geldigTot !== null,
  );
  const vroegste = kandidaten.reduce<(typeof kandidaten)[number] | null>(
    (beste, r) => (beste === null || r.geldigTot < beste.geldigTot ? r : beste),
    null,
  );
  const eerstverlopend =
    vroegste === null
      ? null
      : {
          instrumentId: vroegste.instrumentId,
          geldigTot: vroegste.geldigTot,
          dagen: dagenTussen(dag, vroegste.geldigTot),
        };

  const stand: Licentiestand =
    metAfnamerecht === 0
      ? "geen_afnamerecht"
      : zonderAfnamerecht > 0 || metAlert > 0 || metVoorwaarde > 0
        ? "let_op"
        : "in_orde";

  return {
    stand,
    metAfnamerecht,
    zonderAfnamerecht,
    metAlert,
    metVoorwaarde,
    eerstverlopend,
    samenvatting: samenvat({
      stand,
      metAfnamerecht,
      zonderAfnamerecht,
      metAlert,
      metVoorwaarde,
      totaal: perInstrument.length,
      eerstverlopend,
    }),
    perInstrument,
  };
}

/**
 * Eén regel Nederlands.
 *
 * De regel noemt getallen en geen kleuren, en zegt nooit "in orde" zonder te
 * zeggen waarover. Een samenvatting die alleen "in orde" leest, geeft de lezer
 * niets om over na te denken.
 */
function samenvat(d: {
  stand: Licentiestand;
  metAfnamerecht: number;
  zonderAfnamerecht: number;
  metAlert: number;
  metVoorwaarde: number;
  totaal: number;
  eerstverlopend: LicentieBeeld["eerstverlopend"];
}): string {
  const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`;

  if (d.stand === "geen_afnamerecht") {
    return `Geen enkele van ${meervoud(d.totaal, "licentie", "licenties")} geeft vandaag afnamerecht.`;
  }

  const delen = [`${meervoud(d.metAfnamerecht, "licentie", "licenties")} met afnamerecht`];
  if (d.zonderAfnamerecht > 0) delen.push(`${d.zonderAfnamerecht} zonder`);
  if (d.metAlert > 0) delen.push(`${meervoud(d.metAlert, "alert", "alerts")} open`);
  if (d.metVoorwaarde > 0) {
    delen.push(`${meervoud(d.metVoorwaarde, "voorwaarde", "voorwaarden")} nog te vervullen`);
  }
  const staart =
    d.eerstverlopend === null
      ? ""
      : d.eerstverlopend.dagen < 0
        ? ` Eerste einddatum lag op ${d.eerstverlopend.geldigTot}.`
        : ` Eerste einddatum ${d.eerstverlopend.geldigTot}, over ${meervoud(d.eerstverlopend.dagen, "dag", "dagen")}.`;
  return `${delen.join(", ")}.${staart}`;
}
