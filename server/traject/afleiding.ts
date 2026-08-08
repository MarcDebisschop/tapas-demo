/**
 * Zuivere afleidingen voor het register van de Regiekamer.
 *
 * Tijdstippen zijn Unix-milliseconden en worden als absolute momenten
 * vergeleken. Een dag is hier altijd 24 uur. Daardoor verandert de uitkomst
 * niet wanneer Brussel naar zomer- of wintertijd wisselt.
 */

const MILLIS_PER_DAG = 24 * 60 * 60 * 1000;
const DAGEN_LIJNDIKTE = 30;

export const VRAAGTOESTANDEN = [
  "gesteld",
  "erkend",
  "in_behandeling",
  "beantwoord",
  "gedeeld",
] as const;

/**
 * De enige plaats waar staat welke toestanden een vraag openstaand houden.
 * Zowel de lijntoestand als het aandachtveld van de route leest deze lijst.
 */
export const TOESTANDEN_OPENSTAAND = [
  "gesteld",
  "erkend",
  "in_behandeling",
] as const;

export type VraagToestand = (typeof VRAAGTOESTANDEN)[number];
export type Lijntoestand = "aandacht" | "lopend" | "stil" | "in_orde";

export interface AfleidingGebeurtenis {
  tijdstip: number;
}

export interface AfleidingVraag {
  toestand: VraagToestand;
  antwoordtermijnOp: number;
}

export interface LijnAfleiding {
  nu: number;
  trajectAangemaaktOp: number;
  stiltedrempelDagen: number;
  gebeurtenissen: AfleidingGebeurtenis[];
  vragen: AfleidingVraag[];
  heeftOpenstaandeVlag?: boolean;
}

export interface Vraagtermijn {
  resterendeDagen: number;
  isOverschreden: boolean;
}

function controleerTijdstip(waarde: number, naam: string): void {
  if (!Number.isFinite(waarde)) {
    throw new Error(`${naam} moet een eindig tijdstip in milliseconden zijn.`);
  }
}

function controleerDrempel(drempelDagen: number): void {
  if (!Number.isFinite(drempelDagen) || drempelDagen < 0) {
    throw new Error("De stiltedrempel moet nul of meer dagen zijn.");
  }
}

/**
 * Een vraag staat open zolang haar toestand in TOESTANDEN_OPENSTAAND staat.
 * Een beantwoorde of gedeelde vraag is afgehandeld en weegt niet meer mee.
 */
export function isOpenstaandeVraag(vraag: Pick<AfleidingVraag, "toestand">): boolean {
  return (TOESTANDEN_OPENSTAAND as readonly string[]).includes(vraag.toestand);
}

function laatsteGebeurtenisOp(gebeurtenissen: AfleidingGebeurtenis[]): number | null {
  if (gebeurtenissen.length === 0) return null;

  let laatste: number | null = null;
  for (const gebeurtenis of gebeurtenissen) {
    controleerTijdstip(gebeurtenis.tijdstip, "Het tijdstip van een gebeurtenis");
    if (laatste === null || gebeurtenis.tijdstip > laatste) {
      laatste = gebeurtenis.tijdstip;
    }
  }
  return laatste;
}

/**
 * Aantal gebeurtenissen in het gesloten tijdvak [nu - 30 dagen, nu].
 * Een gebeurtenis van exact dertig dagen geleden telt dus mee; een toekomstige
 * gebeurtenis niet.
 */
export function berekenLijndikte(
  gebeurtenissen: AfleidingGebeurtenis[],
  nu: number,
): number {
  controleerTijdstip(nu, "Nu");
  const ondergrens = nu - DAGEN_LIJNDIKTE * MILLIS_PER_DAG;

  return gebeurtenissen.filter((gebeurtenis) => {
    controleerTijdstip(gebeurtenis.tijdstip, "Het tijdstip van een gebeurtenis");
    return gebeurtenis.tijdstip >= ondergrens && gebeurtenis.tijdstip <= nu;
  }).length;
}

/**
 * Aantal volledig verstreken periodes van 24 uur sinds een gebeurtenis.
 * Negatieve tijdsduur wordt nul, zodat een klokafwijking geen negatieve meter
 * oplevert.
 */
export function berekenStiltemeter(laatsteGebeurtenisOp: number, nu: number): number {
  controleerTijdstip(laatsteGebeurtenisOp, "De laatste gebeurtenis");
  controleerTijdstip(nu, "Nu");
  return Math.max(0, Math.floor((nu - laatsteGebeurtenisOp) / MILLIS_PER_DAG));
}

/**
 * Geeft het aantal aangevangen periodes van 24 uur tot de antwoordtermijn.
 * Daardoor blijft er bijvoorbeeld een dag over bij 23 uur tot de deadline rond
 * de Brusselse zomertijdwissel. Op het exacte deadline-moment is de termijn nog
 * niet overschreden; de overschrijding start op de eerstvolgende milliseconde.
 */
export function berekenVraagtermijn(antwoordtermijnOp: number, nu: number): Vraagtermijn {
  controleerTijdstip(antwoordtermijnOp, "De antwoordtermijn");
  controleerTijdstip(nu, "Nu");

  const resterendeMillis = antwoordtermijnOp - nu;
  return {
    resterendeDagen:
      resterendeMillis > 0
        ? Math.ceil(resterendeMillis / MILLIS_PER_DAG)
        : 0,
    isOverschreden: resterendeMillis < 0,
  };
}

/**
 * De volgorde hieronder is contractueel: aandacht gaat steeds voor lopend,
 * lopend voor stil, en stil voor in orde. Een vraag is open tot en met
 * in_behandeling; na beantwoord is er geen antwoordtermijn meer die de lijn
 * bezet houdt.
 */
export function bepaalLijntoestand(invoer: LijnAfleiding): Lijntoestand {
  controleerTijdstip(invoer.nu, "Nu");
  controleerTijdstip(invoer.trajectAangemaaktOp, "Het aanmaakmoment van het traject");
  controleerDrempel(invoer.stiltedrempelDagen);

  const openstaandeVragen = invoer.vragen.filter((vraag) => {
    controleerTijdstip(vraag.antwoordtermijnOp, "De antwoordtermijn");
    return isOpenstaandeVraag(vraag);
  });

  if (
    invoer.heeftOpenstaandeVlag ||
    openstaandeVragen.some((vraag) =>
      berekenVraagtermijn(vraag.antwoordtermijnOp, invoer.nu).isOverschreden,
    )
  ) {
    return "aandacht";
  }

  if (openstaandeVragen.length > 0) {
    return "lopend";
  }

  const referentiemoment = laatsteGebeurtenisOp(invoer.gebeurtenissen)
    ?? invoer.trajectAangemaaktOp;
  const stilteDuur = invoer.nu - referentiemoment;
  const drempelMillis = invoer.stiltedrempelDagen * MILLIS_PER_DAG;

  if (stilteDuur > drempelMillis) {
    return "stil";
  }

  return "in_orde";
}
