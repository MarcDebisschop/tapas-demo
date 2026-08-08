/**
 * Wie mag in een traject wat zien.
 *
 * Dit is de enige plaats in de codebasis waar die vraag beantwoord wordt. Er
 * komt nergens een tweede berekening: wie iets wil afschermen, gebruikt
 * `filterTrajectVoorOproeper` of een van de losse regels hieronder.
 *
 * Zuivere functies, in dezelfde stijl als `server/traject/afleiding.ts`. Geen
 * databank, geen express, geen opslaglaag. Deze module leest alleen wat ze
 * meekrijgt en rekent, en ze logt zelf niets: de laag erboven maakt van
 * `indrukVrijgegevenVoor` een auditregel.
 */

import type { TrajectRolnaam } from "./schema";

/** De zeven rollen van deel C3 van het protocol, ongewijzigd overgenomen. */
export type RolVanTraject = TrajectRolnaam;

/**
 * Wie het dossier opvraagt.
 *
 * `persoonId` is leeg wanneer de oproeper geen persoon in dit traject is, wat
 * vandaag geldt voor elke TaPasCity-beheerder die het dossier beheert zonder er
 * zelf in te staan. `partijId` volgt uit de persoon, `kring` volgt uit de
 * partij, en `werkstroomIds` bevat de werkstromen waarvan deze persoon nu leider
 * is.
 */
export interface OproeperVanTraject {
  scope: "prior" | "organisatie";
  persoonId: number | null;
  partijId: number | null;
  kring: number | null;
  rollen: RolVanTraject[];
  werkstroomIds: number[];
}

/**
 * De personen van het traject, uitsluitend om de partij van de auteur van een
 * gebeurtenis te kunnen bepalen. Meer velden heeft deze module niet nodig.
 */
export interface PersoonVoorRechten {
  id: number;
  partijId: number | null;
}

export interface LijnVoorRechten {
  id: number;
  partijEenId: number;
  partijTweeId: number;
}

export interface VraagVoorRechten {
  id: number;
  lijnId: number;
  vragerPartijId: number;
  ontvangerPartijId: number;
  werkstroomId: number | null;
  antwoordKring: number;
}

export interface GebeurtenisVoorRechten {
  id: number;
  lijnId: number;
  indruk: string;
  vastgelegdDoorPersoonId: number | null;
}

/**
 * Het verrijkte dossier zoals de laag erboven het samenstelt. De vier eerste
 * velden zijn het geraamte en gaan ongefilterd door; de drie laatste worden
 * gefilterd. De vorm van traject, fasen, partijen en werkstromen doet voor deze
 * module niet ter zake, vandaar de open typen.
 */
export interface VerrijktTrajectVoorRechten<
  TTraject,
  TFase,
  TPartij,
  TWerkstroom,
  TLijn extends LijnVoorRechten,
  TVraag extends VraagVoorRechten,
  TGebeurtenis extends GebeurtenisVoorRechten,
> {
  traject: TTraject;
  fasen: TFase[];
  partijen: TPartij[];
  werkstromen: TWerkstroom[];
  personen: PersoonVoorRechten[];
  lijnen: TLijn[];
  vragen: TVraag[];
  gebeurtenissen: TGebeurtenis[];
}

/** Een gebeurtenis waaruit het veld indruk werkelijk verdwenen is. */
export type GebeurtenisZonderIndruk<TGebeurtenis> = Omit<TGebeurtenis, "indruk">;

export interface GefilterdTrajectVoorOproeper<
  TTraject,
  TFase,
  TPartij,
  TWerkstroom,
  TLijn,
  TVraag,
  TGebeurtenis,
> {
  traject: TTraject;
  fasen: TFase[];
  partijen: TPartij[];
  werkstromen: TWerkstroom[];
  lijnen: TLijn[];
  vragen: TVraag[];
  gebeurtenissen: Array<TGebeurtenis | GebeurtenisZonderIndruk<TGebeurtenis>>;
  /** De ids van de gebeurtenissen waarvan de indruk werd vrijgegeven. */
  indrukVrijgegevenVoor: number[];
}

/**
 * Regel 7. Een TaPasCity-beheerder met scope prior houdt volledige toegang. Het
 * spoor komt er niet in de plaats van de toegang maar bovenop: elke vrijgegeven
 * indruk komt in `indrukVrijgegevenVoor` terecht.
 */
export function heeftVolledigeToegang(oproeper: OproeperVanTraject): boolean {
  return oproeper.scope === "prior";
}

/**
 * Regel 8. Een beheerder die geen persoon in het traject is, houdt de toegang
 * die hij vandaag heeft tot alles behalve de indruk. Grond: dat is een
 * verstrakking en geen versoepeling, en de opdrachtgever zelf is vandaag geen
 * persoon in het demonstratiedossier.
 */
export function isBeheerderZonderPersoon(oproeper: OproeperVanTraject): boolean {
  return oproeper.persoonId === null;
}

/**
 * Het gat van de betrokkene. Deel C3 zegt dat een betrokkene ziet wat over hem
 * gaat, maar er bestaat in de gegevenslaag geen veld dat zegt over welke persoon
 * een gebeurtenis of een vraagkaart gaat. Die regel is vandaag dus onuitvoerbaar
 * en de keuze is weigeren: wie alleen de rol betrokkene draagt, ziet het
 * geraamte van het dossier en geen enkele gebeurtenis en geen enkele
 * vraagkaart. Dat is strenger dan het protocol bedoelt. Wie naast betrokkene nog
 * een andere rol draagt, valt niet onder deze weigering: dan beslist die andere
 * rol.
 */
export function isUitsluitendBetrokkene(oproeper: OproeperVanTraject): boolean {
  return (
    oproeper.rollen.length > 0 && oproeper.rollen.every((rol) => rol === "betrokkene")
  );
}

function isFacilitator(oproeper: OproeperVanTraject): boolean {
  return oproeper.rollen.includes("facilitator");
}

function isLeiderVanWerkstroom(
  oproeper: OproeperVanTraject,
  werkstroomId: number | null,
): boolean {
  if (werkstroomId === null) return false;
  return oproeper.werkstroomIds.includes(werkstroomId);
}

/**
 * Regels 1, 2, 3 en 7 samen, voor het veld indruk van een gebeurtenis.
 *
 * Regel 1. Zichtbaar wanneer de oproeper een persoon in dit traject is, de
 * gebeurtenis een bekende auteur heeft, en die auteur bij dezelfde partij hoort
 * als de oproeper. In alle andere gevallen niet. Grond: deel C5 punt 8 van het
 * protocol, "bij het delen met een andere partij gaat standaard alleen de
 * vaststelling mee". De grens is dus de partij. Wie de gebeurtenis zelf vastlegde
 * ziet zijn eigen indruk altijd, want een mens hoort per definitie bij dezelfde
 * partij als zichzelf, ook wanneer die partij leeg is.
 *
 * Regel 2. De facilitator ziet geen indrukken van anderen, alleen zijn eigen.
 * Grond: uitdrukkelijke beslissing van de opdrachtgever op 8 augustus 2026, met
 * als reden dat C3 zegt dat de facilitator niet oordeelt over inhoud, en dat
 * geen van beide partijen moet vrezen dat interne twijfel via de tussenpersoon
 * bij de andere kant belandt. Deze regel volgt uit regel 1 zolang de facilitator
 * geen partij heeft, maar hij staat hier uitdrukkelijk, zodat hij niet stil
 * verdwijnt wanneer een facilitator wel aan een partij hangt.
 *
 * Regel 3. Een gebeurtenis zonder bekende auteur geeft haar indruk aan niemand.
 * Weigeren bij twijfel, zoals `server/scope-guard.ts` het al doet: wie geen
 * aantoonbaar recht heeft, krijgt niets. Dit raakt alle rijen van voor de kolom
 * met de auteur bestond. Een auteur die niet in de lijst van personen staat,
 * geldt evenzeer als onbekend.
 *
 * Regel 7. Prior gaat voor: die ziet elke indruk, ook zonder bekende auteur, en
 * juist die vrijgave hoort in het auditspoor.
 */
export function magIndrukVanGebeurtenisZien(
  oproeper: OproeperVanTraject,
  gebeurtenis: Pick<GebeurtenisVoorRechten, "vastgelegdDoorPersoonId">,
  personen: PersoonVoorRechten[],
): boolean {
  // Regel 7 eerst: prior houdt volledige toegang.
  if (heeftVolledigeToegang(oproeper)) return true;

  // Regel 8: een beheerder zonder persoon in het traject krijgt alles behalve de
  // indruk. Regel 1 sluit hem ook uit, maar dit staat er uitdrukkelijk.
  if (isBeheerderZonderPersoon(oproeper)) return false;

  // Regel 3: geen bekende auteur, geen indruk.
  const auteurId = gebeurtenis.vastgelegdDoorPersoonId;
  if (auteurId === null) return false;

  // De auteur is de oproeper zelf. Dat is het geval waarin de facilitator zijn
  // eigen indruk ziet, en het geldt ook wanneer beiden geen partij hebben.
  if (auteurId === oproeper.persoonId) return true;

  // Regel 2: de facilitator ziet geen indruk van iemand anders.
  if (isFacilitator(oproeper)) return false;

  const auteur = personen.find((persoon) => persoon.id === auteurId);
  // Regel 3 nog een keer: een auteur die niet in het dossier terug te vinden is,
  // is een onbekende auteur.
  if (auteur === undefined) return false;

  // Regel 1: de grens is de partij. Een lege partij is geen partij, dus twee
  // lege partijen zijn niet dezelfde partij.
  if (auteur.partijId === null || oproeper.partijId === null) return false;
  return auteur.partijId === oproeper.partijId;
}

/**
 * Regel 4. De vaststellingen op een lijn zijn zichtbaar voor wie bij een van de
 * twee partijen van die lijn hoort, voor de facilitator, en voor de leider van
 * een werkstroom waarvan een vraagkaart op die lijn hangt. Grond: C3, een
 * werkstroomleider draagt een spoor en kan dat niet zonder de lijnen waarop zijn
 * vragen leven.
 *
 * Het kringplafond van regel 6 komt hier niet aan te pas: gebeurtenissen en
 * lijnen hebben geen kringveld, alleen vragen hebben dat.
 */
export function magLijnZien(
  oproeper: OproeperVanTraject,
  lijn: LijnVoorRechten,
  vragen: VraagVoorRechten[],
): boolean {
  // Regel 7: prior ziet alles.
  if (heeftVolledigeToegang(oproeper)) return true;

  // Het gat van de betrokkene: wie alleen die rol draagt, ziet geen lijn, want
  // op een lijn hangen gebeurtenissen waarvan niemand kan vaststellen of ze over
  // hem gaan.
  if (isUitsluitendBetrokkene(oproeper)) return false;

  // Regel 8: een beheerder zonder persoon in het traject houdt zijn toegang.
  if (isBeheerderZonderPersoon(oproeper)) return true;

  // Regel 4, eerste grond: bij een van de twee partijen horen.
  if (
    oproeper.partijId !== null &&
    (oproeper.partijId === lijn.partijEenId || oproeper.partijId === lijn.partijTweeId)
  ) {
    return true;
  }

  // Regel 4, tweede grond: de facilitator bewaakt het register en ziet elke lijn.
  if (isFacilitator(oproeper)) return true;

  // Regel 4, derde grond: een werkstroomleider met een kaart op deze lijn.
  return vragen.some(
    (vraag) => vraag.lijnId === lijn.id && isLeiderVanWerkstroom(oproeper, vraag.werkstroomId),
  );
}

/**
 * Regel 6. De kring is een plafond, geen sleutel. Een vraagkaart heeft
 * `antwoordKring`: de ruimste kring die het antwoord mag bereiken. Een oproeper
 * ziet de kaart alleen wanneer zijn eigen kring kleiner of gelijk is aan die
 * antwoordkring. Kring 0 ziet dus alles, kring 3 alleen wat tot kring 3 of
 * verder mag reiken. Grond: C2 van het protocol.
 *
 * Een lege kring betekent geen plafond en niet kring 4. Grond: regel 8, want de
 * beheerder zonder persoon in het traject heeft geen kring en mag daardoor niets
 * verliezen.
 */
export function magVraagkaartVolgensKring(
  oproeper: OproeperVanTraject,
  vraag: Pick<VraagVoorRechten, "antwoordKring">,
): boolean {
  if (heeftVolledigeToegang(oproeper)) return true;
  if (oproeper.kring === null) return true;
  return oproeper.kring <= vraag.antwoordKring;
}

/**
 * Regel 5. De vraagkaarten zijn zichtbaar voor de vragende partij, de
 * ontvangende partij, de leider van de betrokken werkstroom en de facilitator.
 *
 * Regel 6 geldt bovenop regel 5: wie volgens regel 5 mag maar volgens de kring
 * niet, ziet niet.
 *
 * Het gat van de adviseur: er bestaat geen veld dat een adviseur aan een
 * bepaalde vraagkaart hangt, dus een adviseur valt terug op de kaarten van zijn
 * eigen partij via deze regel. Dat is ruimer dan het protocol bedoelt.
 */
export function magVraagkaartZien(
  oproeper: OproeperVanTraject,
  vraag: VraagVoorRechten,
): boolean {
  // Regel 7: prior ziet alles, zonder plafond.
  if (heeftVolledigeToegang(oproeper)) return true;

  // Het gat van de betrokkene: geen enkele kaart.
  if (isUitsluitendBetrokkene(oproeper)) return false;

  // Regel 6 als plafond, ook voor de facilitator en voor de werkstroomleider.
  if (!magVraagkaartVolgensKring(oproeper, vraag)) return false;

  // Regel 8: een beheerder zonder persoon in het traject houdt zijn toegang, en
  // zijn lege kring is geen plafond.
  if (isBeheerderZonderPersoon(oproeper)) return true;

  // Regel 5: de vragende of de ontvangende partij.
  if (
    oproeper.partijId !== null &&
    (oproeper.partijId === vraag.vragerPartijId ||
      oproeper.partijId === vraag.ontvangerPartijId)
  ) {
    return true;
  }

  // Regel 5: de leider van de betrokken werkstroom.
  if (isLeiderVanWerkstroom(oproeper, vraag.werkstroomId)) return true;

  // Regel 5: de facilitator.
  return isFacilitator(oproeper);
}

/**
 * Regel 1 tot en met 8 in een keer, voor een volledig dossier.
 *
 * De ene ingang die de laag erboven gebruikt, zodat er nooit ergens anders
 * gefilterd wordt. Het geraamte van het dossier gaat door zoals het is: het
 * traject, de fasen, de partijen en de werkstromen. De lijnen gaan door regel 4,
 * de vragen door regel 5 en 6, en van de gebeurtenissen blijft de vaststelling
 * altijd staan terwijl de indruk door regel 1, 2, 3 en 7 gaat.
 *
 * Het veld indruk verdwijnt volledig uit een gebeurtenis waar de oproeper geen
 * recht op heeft. Het wordt niet leeggemaakt en niet vervangen door een
 * merkteken, het is er niet. Grond: een leeg veld verraadt nog steeds dat er een
 * indruk bestaat, en dat is al informatie.
 *
 * Het ingevoerde dossier wordt nooit gewijzigd.
 */
export function filterTrajectVoorOproeper<
  TTraject,
  TFase,
  TPartij,
  TWerkstroom,
  TLijn extends LijnVoorRechten,
  TVraag extends VraagVoorRechten,
  TGebeurtenis extends GebeurtenisVoorRechten,
>(
  oproeper: OproeperVanTraject,
  verrijktTraject: VerrijktTrajectVoorRechten<
    TTraject,
    TFase,
    TPartij,
    TWerkstroom,
    TLijn,
    TVraag,
    TGebeurtenis
  >,
): GefilterdTrajectVoorOproeper<
  TTraject,
  TFase,
  TPartij,
  TWerkstroom,
  TLijn,
  TVraag,
  TGebeurtenis
> {
  const zichtbareLijnen = verrijktTraject.lijnen.filter((lijn) =>
    magLijnZien(oproeper, lijn, verrijktTraject.vragen),
  );
  const zichtbareLijnIds = new Set(zichtbareLijnen.map((lijn) => lijn.id));

  const zichtbareVragen = verrijktTraject.vragen.filter((vraag) =>
    magVraagkaartZien(oproeper, vraag),
  );

  const indrukVrijgegevenVoor: number[] = [];
  const zichtbareGebeurtenissen: Array<
    TGebeurtenis | GebeurtenisZonderIndruk<TGebeurtenis>
  > = [];

  for (const gebeurtenis of verrijktTraject.gebeurtenissen) {
    // Een gebeurtenis hangt aan een lijn, dus regel 4 beslist eerst of de
    // vaststelling er is.
    if (!zichtbareLijnIds.has(gebeurtenis.lijnId)) continue;

    if (magIndrukVanGebeurtenisZien(oproeper, gebeurtenis, verrijktTraject.personen)) {
      zichtbareGebeurtenissen.push(gebeurtenis);
      indrukVrijgegevenVoor.push(gebeurtenis.id);
      continue;
    }

    // Het veld gaat eruit, niet op leeg. De oproeper mag niet kunnen zien dat er
    // een indruk bestaat.
    const { indruk: _indruk, ...zonderIndruk } = gebeurtenis;
    zichtbareGebeurtenissen.push(zonderIndruk as GebeurtenisZonderIndruk<TGebeurtenis>);
  }

  return {
    traject: verrijktTraject.traject,
    fasen: verrijktTraject.fasen,
    partijen: verrijktTraject.partijen,
    werkstromen: verrijktTraject.werkstromen,
    lijnen: zichtbareLijnen,
    vragen: zichtbareVragen,
    gebeurtenissen: zichtbareGebeurtenissen,
    indrukVrijgegevenVoor,
  };
}
