// ---------------------------------------------------------------------------
// server/contract-toestemming.ts
//
// WAAROM DIT BESTAAT
// In het bevroren afnamecontract stond het toestemmingsveld hard op `given:
// true`, in drie generatoren tegelijk (server/scoring.ts voor het T4P Business
// Kompas, server/t4teens/scoring.ts en server/t4kids/scoring.ts). Het tijdstip
// kwam wel uit de afname en bleef leeg zolang de startstap niet doorlopen was.
// Uit de functionele test van augustus 2026 (bevinding 2 bij het T4P Business
// Kompas) bleek daardoor het volgende: een contract kon bevestigen dat er
// toestemming was, zonder enig tijdstip om dat te onderbouwen. Als bewijsstuk
// naar ouders, scholen en klanten is dat zwakker dan het lijkt.
//
// DE REGEL
// Toestemming geldt in het contract als gegeven wanneer twee dingen kloppen: de
// afname draagt de toestemming (afnames.consent_given) EN er is een tijdstip.
// Ontbreekt het tijdstip, dan schrijft het contract eerlijk `given: false` in
// plaats van een bevestiging zonder bewijs.
//
// WAAROM GEEN UITZONDERING GOOIEN
// Deze laag loopt midden in het afronden van een afname. In deze codebasis is
// het een bindende eis dat rapportwerk de afronding nooit mag breken (zie de
// terugval in server/routes/rapporten.ts en server/rapport-pdf.ts). Een
// generator die weigert, zou een deelnemer die alles correct invulde alsnog
// blokkeren. Het contract vertelt daarom wat het weet, en de poort op de
// inleverroutes (server/toestemming-poort.ts) zorgt dat het geval in de praktijk
// niet meer ontstaat.
// ---------------------------------------------------------------------------

export interface ToestemmingInvoer {
  /** afnames.consent_given, zoals opgeslagen bij de startstap. */
  consentGiven?: boolean | null;
  consentScope?: string | null;
  consentTimestamp?: string | null;
  /** Draagwijdte die dit instrument gebruikt wanneer de afname er geen heeft. */
  standaardScope: string;
}

export interface ContractToestemming {
  given: boolean;
  scope: string;
  timestamp: string | null;
}

export function toestemmingVoorContract(invoer: ToestemmingInvoer): ContractToestemming {
  const tijdstip = invoer.consentTimestamp ?? null;
  // Oudere afnames en seedgegevens dragen geen expliciete vlag mee. Dan telt het
  // tijdstip als het bewijs: er is een moment vastgelegd waarop de deelnemer de
  // toestemmingsvraag zag.
  const vlag = invoer.consentGiven ?? true;
  return {
    given: vlag === true && !!tijdstip,
    scope: invoer.consentScope ?? invoer.standaardScope,
    timestamp: tijdstip,
  };
}
