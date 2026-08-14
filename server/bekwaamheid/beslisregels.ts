// =============================================================================
// server/bekwaamheid/beslisregels.ts — de cesuur toegepast, zuiver
//
// Bouwplan §10, blok 3: "`beslisregels.ts` als pure functie: normprofiel +
// asscores + activiteit in, voorstel + bindende regel uit. Geen database, geen
// Express."
//
// Deze module is het hart van de module Bekwaamheid en tegelijk het gevaarlijkste
// bestand erin: ze zet cijfers om in een uitspraak over iemands bekwaamheid.
// Daarom drie harde grenzen, elk met een eigen test.
//
// GRENS 1 — ze stelt alleen voor, ze beslist niet. De uitvoer heet `voorstel` en
// het is aan twee bekrachtigers om er een beslissing van te maken. Wijkt hun
// beslissing af, dan eist de databank een motivering van minstens veertig
// tekens.
//
// GRENS 2 — ze stelt nooit `beeindigd` voor. Beeindiging vereist twee mislukte
// herkansingen, weigering of een integriteitsbreuk. Dat zijn menselijke feiten
// die niet in asscores zitten. Het retourtype is daarom `VoorstelbareUitkomst`,
// waarin `beeindigd` niet voorkomt: de fout is niet te maken zonder de types te
// omzeilen.
//
// GRENS 3 — ze raakt de accreditatie niet aan. Draaiboek: de accreditatie is een
// verworven feit dat niet vervalt; alleen de licentie beweegt. Het woord
// accreditatie komt in dit bestand niet voor, en een test controleert dat.
//
// EN EEN VIERDE, die minder over deze module gaat en meer over hoe ze gelezen
// wordt: onderschrijding van de activiteitsdrempel is GEEN tekortkoming.
// Draaiboek §5.2: "Onder de drempel is geen tekortkoming: het is de trigger voor
// de route slapende licentie of reactivatie." De activiteitsroute komt daarom als
// een APART veld uit deze functie, naast de uitkomst — niet als een uitkomst.
// Iemand die goed presteert maar weinig afneemt, wordt slapend, niet gezakt.
// =============================================================================

import {
  type As,
  ASSEN,
  type VoorstelbareUitkomst,
} from "./schema";
import type { AsscoreUitkomst, Normprofiel } from "./normprofiel";
import type { ActiviteitUitkomst } from "./activiteit";

/**
 * De bovengrens van de aandachtszone.
 *
 * Draaiboek §5.3, rij "Bekrachtigd met aandachtspunt": "norm gehaald, maar één as
 * tussen 60 en 65% óf een administratieve leemte". De ondergrens van die zone is
 * de asdrempel uit het normprofiel; de bovengrens staat niet in het normprofiel
 * en is dus een constante. Ze staat hier en niet in het normprofiel omdat het
 * draaiboek haar als vast getal noemt, niet als iets dat een cesuurpanel per
 * instrument vaststelt.
 */
export const AANDACHTSZONE_BOVENGRENS = 0.65;

/**
 * De ondergrens van de band waarin een totaal nog voorwaardelijk is.
 *
 * Draaiboek §5.3, rij "Voorwaardelijk bekrachtigd": "één as onder 60%, of totaal
 * tussen 60 en 70%". Onder de 0,60 noemt het draaiboek voor het totaal geen
 * eigen uitkomst. Dat is geen leemte: een totaal onder 0,60 gaat in de praktijk
 * altijd samen met assen onder hun drempel, en die regel bindt dan al zwaarder.
 * Zie de bespreking bij `beoordeel`.
 */
export const VOORWAARDELIJK_ONDERGRENS = 0.6;

/** Welke van de vijf regels de uitkomst bepaalde. */
export type BindendeRegel =
  | "twee_of_meer_assen_onder_drempel"
  | "een_as_onder_drempel"
  | "totaal_onder_drempel"
  | "as_in_aandachtszone"
  | "administratieve_leemte"
  | "norm_gehaald";

/** De route die uit de activiteitstelling volgt. Nooit een uitkomst. */
export type Activiteitsroute = "voldoende_activiteit" | "slapend";

export type Voorstel = {
  /** De voorgestelde uitkomst. `beeindigd` kan hier niet in staan. */
  uitkomst: VoorstelbareUitkomst;
  /** Welke regel bond. Bij meerdere: de zwaarste. */
  bindendeRegel: BindendeRegel;
  /**
   * De activiteitsroute, apart van de uitkomst.
   *
   * Onderschrijding is geen tekortkoming en mag de uitkomst dus niet drukken.
   */
  activiteitsroute: Activiteitsroute;
  /** De berekening, bedoeld om als JSON in `voorstel_berekening` te belanden. */
  berekening: {
    totaal: number;
    drempelTotaal: number;
    totaalHaalt: boolean;
    perAs: Record<As, { score: number; drempel: number; haalt: boolean }>;
    assenOnderDrempel: As[];
    assenInAandachtszone: As[];
    activiteit: {
      aantal: number;
      drempel: number;
      haalt: boolean;
      vensterVan: string;
      vensterTot: string;
    };
    praktijkzorgsignaal: boolean;
    administratieveLeemten: string[];
    toegepasteRegels: BindendeRegel[];
  };
  /**
   * Wat er nog aan het dossier ontbreekt voordat er iets voorgesteld kan worden.
   * Leeg bij een voorstel; gevuld wanneer `beoordeel` niets kon voorstellen.
   */
  onvolledig: string[];
};

/**
 * Het dossier is niet compleet genoeg voor een voorstel.
 *
 * Een aparte vorm en geen uitkomst met een lage score. Zou een onvolledig
 * dossier als een gewone uitkomst terugkomen, dan kon een ontbrekende meting
 * eruitzien als een tekortkoming.
 */
export type GeenVoorstel = {
  uitkomst: null;
  onvolledig: string[];
};

export type BeslisUitkomst = Voorstel | GeenVoorstel;

export type BeslisInvoer = {
  normprofiel: Normprofiel;
  asscores: AsscoreUitkomst;
  activiteit: ActiviteitUitkomst;
  /**
   * Benoemde administratieve leemten in het dossier.
   *
   * Draaiboek §5.3 noemt "een administratieve leemte" als tweede grond voor
   * bekrachtigd met aandachtspunt. Wat een leemte is, kan een rekenkern niet
   * vaststellen — het gaat om ontbrekende stukken, niet om cijfers. De aanroeper
   * geeft de leemten daarom benoemd mee. Een lege lijst betekent: dossier in
   * orde.
   */
  administratieveLeemten?: readonly string[];
};

/**
 * Zet de cesuur om in een voorstel.
 *
 * DE VOLGORDE VAN DE REGELS IS DE KERN VAN DEZE FUNCTIE. Draaiboek §5.3 geeft
 * vijf rijen, maar zegt niet wat er gebeurt wanneer twee rijen tegelijk van
 * toepassing zijn. Dat gebeurt in de praktijk voortdurend. De volgorde hier is
 * van zwaar naar licht, en elke stap heeft een grond:
 *
 *   1. **Twee of meer assen onder hun drempel → opgeschort.** Deze gaat voor op
 *      alles. Het geval "twee assen op 0,50 met een totaal van exact 0,70" komt
 *      uit de tabel met grensgevallen: het totaal haalt de norm, en toch mag
 *      hier geen bekrachtiging uit komen. Zou het totaal voorgaan, dan werd een
 *      dossier met twee zwakke onderdelen bekrachtigd omdat twee andere
 *      onderdelen het gemiddelde optrokken. Dat is precies wat een cesuur per as
 *      moet voorkomen.
 *
 *   2. **Eén as onder haar drempel → voorwaardelijk.** Draaiboek: de licentie
 *      BLIJFT actief, met een opfristraject en een herkansing van uitsluitend dat
 *      onderdeel. Deze regel gaat voor op de totaaldrempel, want ze wijst een
 *      concreet onderdeel aan en het draaiboek noemt haar als eerste grond.
 *
 *   3. **Totaal onder de drempel → voorwaardelijk.** Het geval "totaal 0,69 met
 *      alle assen op 0,69" uit de tabel: elke as haalt haar eigen drempel van
 *      0,60 ruim, en toch mag hier geen bekrachtiging uit komen.
 *
 *      Onder VOORWAARDELIJK_ONDERGRENS noemt het draaiboek voor het totaal geen
 *      eigen uitkomst. Deze functie geeft dan nog steeds `voorwaardelijk`, en dat
 *      is een bewuste keuze: het alternatief zou een zwaardere uitkomst zijn dan
 *      het draaiboek voor deze grond toestaat. In de praktijk gaat een totaal
 *      onder 0,60 vrijwel altijd samen met twee of meer assen onder hun drempel,
 *      en dan heeft regel 1 al gebonden. Blijft er een geval over waarin dat niet
 *      zo is, dan hoort een mens ernaar te kijken — en dat kan, want dit is een
 *      voorstel.
 *
 *   4. **Eén as in de aandachtszone → bekrachtigd met aandachtspunt.** Alleen
 *      bereikbaar wanneer de norm gehaald is; anders had een zwaardere regel al
 *      gebonden.
 *
 *   5. **Een administratieve leemte → bekrachtigd met aandachtspunt.** Dezelfde
 *      uitkomst, andere grond. De grond wordt apart gerapporteerd, want de actie
 *      die eruit volgt is een andere.
 *
 *   6. **Norm gehaald en dossier in orde → bekrachtigd.**
 *
 * De activiteitsroute loopt volledig BUITEN deze keten om. Ze staat in een eigen
 * veld en kan geen enkele uitkomst veranderen.
 */
export function beoordeel(invoer: BeslisInvoer): BeslisUitkomst {
  const { normprofiel, asscores, activiteit } = invoer;
  const leemten = [...(invoer.administratieveLeemten ?? [])];

  // --- eerst: is er genoeg om iets over te zeggen? --------------------------
  const onvolledig: string[] = [];
  if (!asscores.volledig || asscores.totaal === null) {
    for (const as of ASSEN) {
      if (asscores.perAs[as].score === null) {
        onvolledig.push(`De as '${as}' heeft nog geen beoordeeld bewijsstuk.`);
      }
    }
    if (asscores.onbeoordeeld.length) {
      onvolledig.push(
        `Nog niet beoordeeld: bewijsstuk ${asscores.onbeoordeeld.join(", ")}.`,
      );
    }
    // Vangnet: het totaal is null zonder dat een as ontbreekt. Dat hoort niet te
    // kunnen, maar stil een voorstel doen op een ontbrekend totaal is de ene fout
    // die deze module absoluut niet mag maken.
    if (!onvolledig.length) {
      onvolledig.push("De totaalscore is niet berekend.");
    }
    return { uitkomst: null, onvolledig };
  }

  const totaal = asscores.totaal;

  // --- de assen tegen hun eigen drempel ------------------------------------
  const perAs = {} as Record<As, { score: number; drempel: number; haalt: boolean }>;
  const assenOnderDrempel: As[] = [];
  const assenInAandachtszone: As[] = [];
  for (const as of ASSEN) {
    const score = asscores.perAs[as].score as number;
    const drempel = normprofiel.drempelPerAs[as];
    const haalt = score >= drempel;
    perAs[as] = { score, drempel, haalt };
    if (!haalt) {
      assenOnderDrempel.push(as);
    } else if (score <= AANDACHTSZONE_BOVENGRENS) {
      // Tussen de drempel en 0,65, grenzen inbegrepen. Draaiboek: "één as tussen
      // 60 en 65%". Beide randen tellen mee, net als bij de drempels zelf.
      assenInAandachtszone.push(as);
    }
  }

  const totaalHaalt = totaal >= normprofiel.drempelTotaal;

  // --- de keten, van zwaar naar licht --------------------------------------
  const toegepasteRegels: BindendeRegel[] = [];
  if (assenOnderDrempel.length >= 2) toegepasteRegels.push("twee_of_meer_assen_onder_drempel");
  if (assenOnderDrempel.length === 1) toegepasteRegels.push("een_as_onder_drempel");
  if (!totaalHaalt) toegepasteRegels.push("totaal_onder_drempel");
  if (assenInAandachtszone.length) toegepasteRegels.push("as_in_aandachtszone");
  if (leemten.length) toegepasteRegels.push("administratieve_leemte");
  if (!toegepasteRegels.length) toegepasteRegels.push("norm_gehaald");

  const bindendeRegel = toegepasteRegels[0];
  let uitkomst: VoorstelbareUitkomst;
  switch (bindendeRegel) {
    case "twee_of_meer_assen_onder_drempel":
      uitkomst = "opgeschort";
      break;
    case "een_as_onder_drempel":
    case "totaal_onder_drempel":
      uitkomst = "voorwaardelijk";
      break;
    case "as_in_aandachtszone":
    case "administratieve_leemte":
      uitkomst = "bekrachtigd_met_aandachtspunt";
      break;
    default:
      uitkomst = "bekrachtigd";
  }

  return {
    uitkomst,
    bindendeRegel,
    activiteitsroute: activiteit.haalt ? "voldoende_activiteit" : "slapend",
    berekening: {
      totaal,
      drempelTotaal: normprofiel.drempelTotaal,
      totaalHaalt,
      perAs,
      assenOnderDrempel,
      assenInAandachtszone,
      activiteit: {
        aantal: activiteit.aantal,
        drempel: activiteit.drempel,
        haalt: activiteit.haalt,
        vensterVan: activiteit.vensterVan,
        vensterTot: activiteit.vensterTot,
      },
      praktijkzorgsignaal: activiteit.praktijkzorg.signaal,
      administratieveLeemten: leemten,
      toegepasteRegels,
    },
    onvolledig: [],
  };
}
