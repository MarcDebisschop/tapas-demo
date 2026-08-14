// =============================================================================
// server/bekwaamheid/normprofiel.ts — de bevroren cesuur, zuiver
//
// Blok 3, laag 1 van drie. Deze module doet twee dingen en raakt geen databank:
// ze valideert een normprofiel voordat het wordt vastgelegd, en ze rekent
// asscores uit bewijsstukken.
//
// Waarom zuiver. Bouwplan §10, blok 3: "`beslisregels.ts` als pure functie:
// normprofiel + asscores + activiteit in, voorstel + bindende regel uit. Geen
// database, geen Express. Zelfde vorm als `opvolging-per-instrument.ts`, dat om
// precies deze reden puur is gehouden." Diezelfde reden geldt voor de twee
// stappen die aan het voorstel voorafgaan. Een cesuur waarvan de rekenwijze niet
// exact reproduceerbaar is, is bij een bezwaar niet te verdedigen.
//
// Waarom de validatie hier staat en niet in de databank. De tabel heeft al drie
// CHECK-beperkingen (versie ≥ 1, drempeltotaal binnen (0,1], onderbouwing ≥ 200
// tekens). Wat SQLite níet kan uitdrukken is de eis die het zwaarst weegt: dat de
// vier wegingen samen exact 1 vormen. Een weging die tot 0,95 optelt levert een
// totaalscore die stilzwijgend 5% te laag is, en dat verschil zit precies in het
// gebied waar de cesuur van 0,70 ligt. Zo'n fout is met het oog niet te zien in
// een JSON-veld en moet daarom afgedwongen worden vóór het wegschrijven.
// =============================================================================

import { ASSEN, type As } from "./schema";

/** De weging per as. Alle vier verplicht: een ontbrekende as is geen weging. */
export type Weging = Record<As, number>;

/** De drempel per as. Alle vier verplicht, om dezelfde reden. */
export type DrempelPerAs = Record<As, number>;

/**
 * Een normprofiel zoals de zuivere laag het nodig heeft.
 *
 * Dit is niet de tabelrij: de JSON-velden zijn hier al geparseerd en de velden
 * die alleen over herkomst gaan (paneelomschrijving, vastgesteldDoor) staan er
 * niet in. Wat hier staat is uitsluitend wat een beslissing beïnvloedt.
 */
export type Normprofiel = {
  weging: Weging;
  drempelTotaal: number;
  drempelPerAs: DrempelPerAs;
  activiteitsdrempel: number;
  activiteitsvensterMaanden: number;
};

/**
 * De tolerantie op de som van de wegingen.
 *
 * Niet nul, want in IEEE-754 telt niet elke geldige weging exact tot 1 op.
 * Gemeten over twaalf plausibele wegingen zijn er twee die 0,9999999999999999
 * geven: 0,40 + 0,30 + 0,20 + 0,10 en 0,15 + 0,15 + 0,35 + 0,35. De weging uit
 * het bouwplan (0,20 + 0,30 + 0,30 + 0,20) komt wel exact op 1 uit, dus dat is
 * niet het voorbeeld dat de tolerantie rechtvaardigt. Een eis van exacte
 * gelijkheid zou die twee even geldige wegingen afkeuren.
 *
 * Niet ruimer dan 1e-9, want alles daarboven laat werkelijke invoerfouten door:
 * het kleinste betekenisvolle verschil in een weging is 0,01 en dat is zeven
 * ordes groter dan de tolerantie.
 */
export const WEGING_TOLERANTIE = 1e-9;

/** De ondergrens uit de tabelbeperking, hier herhaald zodat de fout leesbaar is. */
export const ONDERBOUWING_MINIMUM = 200;

export type Bevinding = {
  veld: string;
  melding: string;
};

/**
 * Valideert een normprofiel vóór vastlegging.
 *
 * Geeft alle bevindingen terug, niet alleen de eerste. Wie een normprofiel
 * invult, vult een tabel met veertien velden in; die één voor één laten afkeuren
 * is een vorm van onbehulpzaamheid die niets aan de gegevenskwaliteit toevoegt.
 */
export function valideerNormprofiel(invoer: {
  weging: Partial<Record<string, unknown>>;
  drempelTotaal: unknown;
  drempelPerAs: Partial<Record<string, unknown>>;
  activiteitsdrempel: unknown;
  activiteitsvensterMaanden: unknown;
  onderbouwing?: unknown;
}): Bevinding[] {
  const bevindingen: Bevinding[] = [];

  // --- de weging ------------------------------------------------------------
  let som = 0;
  for (const as of ASSEN) {
    const waarde = invoer.weging?.[as];
    if (typeof waarde !== "number" || !Number.isFinite(waarde)) {
      bevindingen.push({
        veld: `weging.${as}`,
        melding: `De weging voor de as '${as}' ontbreekt of is geen getal.`,
      });
      continue;
    }
    if (waarde < 0) {
      bevindingen.push({
        veld: `weging.${as}`,
        melding: `De weging voor de as '${as}' is negatief.`,
      });
      continue;
    }
    som += waarde;
  }
  const wegingVolledig = !bevindingen.some((b) => b.veld.startsWith("weging."));
  if (wegingVolledig && Math.abs(som - 1) > WEGING_TOLERANTIE) {
    bevindingen.push({
      veld: "weging",
      melding:
        `De vier wegingen tellen op tot ${som}, niet tot 1. Een weging die niet ` +
        `tot 1 optelt schuift de totaalscore stilzwijgend op, precies in het ` +
        `gebied waar de cesuur ligt.`,
    });
  }

  // --- de drempels ----------------------------------------------------------
  if (
    typeof invoer.drempelTotaal !== "number" ||
    !Number.isFinite(invoer.drempelTotaal) ||
    invoer.drempelTotaal <= 0 ||
    invoer.drempelTotaal > 1
  ) {
    bevindingen.push({
      veld: "drempelTotaal",
      melding: "De totaaldrempel moet een getal groter dan 0 en ten hoogste 1 zijn.",
    });
  }
  for (const as of ASSEN) {
    const waarde = invoer.drempelPerAs?.[as];
    if (
      typeof waarde !== "number" ||
      !Number.isFinite(waarde) ||
      waarde < 0 ||
      waarde > 1
    ) {
      bevindingen.push({
        veld: `drempelPerAs.${as}`,
        melding: `De drempel voor de as '${as}' ontbreekt of ligt buiten 0 tot 1.`,
      });
    }
  }

  // --- activiteit -----------------------------------------------------------
  if (
    typeof invoer.activiteitsdrempel !== "number" ||
    !Number.isInteger(invoer.activiteitsdrempel) ||
    invoer.activiteitsdrempel < 0
  ) {
    bevindingen.push({
      veld: "activiteitsdrempel",
      melding: "De activiteitsdrempel moet een geheel getal van 0 of hoger zijn.",
    });
  }
  if (
    typeof invoer.activiteitsvensterMaanden !== "number" ||
    !Number.isInteger(invoer.activiteitsvensterMaanden) ||
    invoer.activiteitsvensterMaanden < 1
  ) {
    bevindingen.push({
      veld: "activiteitsvensterMaanden",
      melding: "Het activiteitsvenster moet een geheel aantal maanden van 1 of meer zijn.",
    });
  }

  // --- de onderbouwing ------------------------------------------------------
  // Alleen gecontroleerd als het veld is meegegeven: de asscoreberekening heeft
  // de onderbouwing niet nodig en moet een normprofiel zonder dat veld kunnen
  // valideren.
  if (invoer.onderbouwing !== undefined) {
    const tekst = typeof invoer.onderbouwing === "string" ? invoer.onderbouwing.trim() : "";
    if (tekst.length < ONDERBOUWING_MINIMUM) {
      bevindingen.push({
        veld: "onderbouwing",
        melding:
          `De onderbouwing is ${tekst.length} tekens en moet minstens ` +
          `${ONDERBOUWING_MINIMUM} tekens zijn. Een cesuur zonder onderbouwing is ` +
          `bij een bezwaar niet te verdedigen.`,
      });
    }
  }

  return bevindingen;
}

// =============================================================================
// De asscores
// =============================================================================

/**
 * Eén beoordeeld bewijsstuk, zoals de berekening het nodig heeft.
 *
 * `weging` staat hier niet in. Het bouwplan §6.7 zegt dat de bewijsstukrij een
 * eigen `weging` draagt, "overgenomen uit het normprofiel, niet herberekend".
 * Die kolom is er om vast te leggen wat er gold; de berekening leest de weging
 * uit het normprofiel dat aan de ronde hangt. Zou de berekening de kolom lezen,
 * dan zou een verkeerd overgenomen weging stilzwijgend de uitkomst bepalen en
 * zou het normprofiel niet meer de norm zijn.
 */
export type BewijsstukScore = {
  nummer: number;
  as: As;
  /** 0 tot 1, of null wanneer nog niet beoordeeld. */
  ruweScore: number | null;
  status: "open" | "ingeleverd" | "beoordeeld" | "nvt";
};

export type AsUitkomst = {
  as: As;
  /** Het gemiddelde van de beoordeelde bewijsstukken op deze as, of null. */
  score: number | null;
  /** Hoeveel bewijsstukken op deze as zijn meegerekend. */
  meegerekend: number;
  /** Hoeveel bewijsstukken op deze as nog niet beoordeeld zijn. */
  openstaand: number;
};

export type AsscoreUitkomst = {
  perAs: Record<As, AsUitkomst>;
  /** De gewogen totaalscore, of null zolang niet elke as een score heeft. */
  totaal: number | null;
  /** True zodra elke as minstens één beoordeeld bewijsstuk heeft. */
  volledig: boolean;
  /** Bewijsstukken die nog niet beoordeeld zijn, per nummer. */
  onbeoordeeld: number[];
};

/**
 * Rekent de vier asscores en de gewogen totaalscore uit de bewijsstukken.
 *
 * Drie regels, elk met een reden.
 *
 * 1. **Status `nvt` telt niet mee, en telt ook niet als openstaand.** Een
 *    bewijsstuk dat niet van toepassing is verklaard, is geen leemte in het
 *    dossier. Zou het als openstaand tellen, dan werd een dossier met een
 *    terecht overgeslagen bewijsstuk nooit volledig.
 *
 * 2. **Meerdere bewijsstukken op één as worden ongewogen gemiddeld.** Het
 *    normprofiel weegt ássen, niet bewijsstukken; er is in het draaiboek geen
 *    grondslag om binnen een as het ene bewijsstuk zwaarder te laten wegen dan
 *    het andere. Een verzonnen weging zou de cesuur onverdedigbaar maken.
 *
 * 3. **Het totaal is null zolang niet elke as een score heeft.** Een gewogen som
 *    over drie van de vier assen is geen onvolledig totaal maar een verkeerd
 *    totaal: het valt automatisch lager uit en zou een dossier laten zakken op
 *    een meting die nog niet gedaan is.
 */
export function berekenAsscores(
  bewijsstukken: readonly BewijsstukScore[],
  weging: Weging,
): AsscoreUitkomst {
  const perAs = {} as Record<As, AsUitkomst>;
  for (const as of ASSEN) {
    perAs[as] = { as, score: null, meegerekend: 0, openstaand: 0 };
  }

  const sommen = {} as Record<As, number>;
  for (const as of ASSEN) sommen[as] = 0;
  const onbeoordeeld: number[] = [];

  for (const stuk of bewijsstukken) {
    if (stuk.status === "nvt") continue;
    const vak = perAs[stuk.as];
    if (!vak) continue; // een onbekende as wordt genegeerd, niet geraden
    if (stuk.status === "beoordeeld" && typeof stuk.ruweScore === "number") {
      sommen[stuk.as] += stuk.ruweScore;
      vak.meegerekend += 1;
    } else {
      vak.openstaand += 1;
      onbeoordeeld.push(stuk.nummer);
    }
  }

  for (const as of ASSEN) {
    const vak = perAs[as];
    if (vak.meegerekend > 0) vak.score = sommen[as] / vak.meegerekend;
  }

  const volledig = ASSEN.every((as) => perAs[as].score !== null);
  let totaal: number | null = null;
  if (volledig) {
    totaal = 0;
    for (const as of ASSEN) totaal += (perAs[as].score as number) * weging[as];
  }

  return {
    perAs,
    totaal,
    volledig,
    onbeoordeeld: onbeoordeeld.sort((a, b) => a - b),
  };
}
