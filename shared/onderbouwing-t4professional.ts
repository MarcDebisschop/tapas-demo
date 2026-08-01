// ---------------------------------------------------------------------------
// Onderbouwing van T4Professional (instrumentId "t4p-business-kompas").
//
// Eén bron voor wat er over T4Professional aan onderzoek IS, wat er nog
// ONTBREEKT en waar de claimgrens ligt. De registry hangt deze structuur aan de
// instrumentdescriptor, de publieke onderbouwingssectie toont ze, en het
// T4P-rapport gebruikt de claimgrens als disclaimer.
//
// De formuleringen zijn woordelijk afgewogen om niet meer te beweren dan waar
// is. Wijzig ze niet zonder dezelfde afweging opnieuw te maken. De tekst staat
// bewust enkel in het Nederlands: vertalen zou de precisie laten verschuiven.
// ---------------------------------------------------------------------------

export interface OnderbouwingBlok {
  kop: string;
  punten: string[];
}

export interface InstrumentOnderbouwing {
  instrument: string;
  blokken: OnderbouwingBlok[];
  claimgrens: string;
}

export const ONDERBOUWING_T4PROFESSIONAL: InstrumentOnderbouwing = {
  instrument: "T4Professional (T4P Business Kompas)",
  blokken: [
    {
      kop: "Wat er aan onderzoek is",
      punten: [
        "Exploratieve factoranalyse op 1.858 T4Professional-profielen en 395 profielen van het sportinstrument, uitgevoerd in samenwerking met de Universiteit Antwerpen (prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen). De gerapporteerde factorladingen voor de driverschalen liggen tussen 0,90 en 0,97. Voor de energieschalen onder de talentversnellers liggen ze tussen 0,63 en 0,84. Het gebruikte extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd; de analyse is exploratief en nog niet extern gepubliceerd.",
        "Externe inhoudsvalidatie door vier onafhankelijke experts, twee uit Vlaanderen en twee uit Nederland, onder supervisie van prof. dr. Peter Theuns (Vrije Universiteit Brussel, Methoden in de Psychologie). De bevindingen van dit panel zijn niet als afzonderlijk rapport gepubliceerd.",
        "De statistische vormgeving is nagekeken door sectorfonds IVOC.",
      ],
    },
    {
      kop: "Wat er nog ontbreekt",
      punten: [
        "Voor T4Professional is nog geen betrouwbaarheidscoefficient (zoals Cronbachs alfa of McDonalds omega) berekend en gerapporteerd.",
        "De stabiliteit van scores over tijd is nog niet gemeten. Er is nog geen test-hertestonderzoek.",
        "Er is nog geen normgroep. De interpretatiedrempels in de rapportage zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.",
        "De samenhang met uitkomsten buiten het instrument zelf, zoals functioneren, welbevinden of verloop, is nog niet onderzocht en gerapporteerd.",
      ],
    },
  ],
  claimgrens:
    "Een T4Professional-profiel is een gespreksinstrument. Het geeft inzichten, aandachtspunten en " +
    "richtingaanwijzers. Het is geen beslissingsinstrument en mag niet als enige basis dienen voor " +
    "beslissingen over aanwerving, selectie, promotie of ontslag. Een resultaat is een momentopname op " +
    "het ogenblik van afname, geen vaststaand oordeel over iemands mogelijkheden.",
};
