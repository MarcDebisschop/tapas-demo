// ---------------------------------------------------------------------------
// De enige bron van waarheid voor wat het 2MINSCAN-rapport belooft.
//
// WAAROM DIT BESTAAT
// Op vier plaatsen stond met de hand geschreven dat het rapport vijftien
// pagina's telt in vijf talen: in het register, twee keer in de catalogus en in
// de instrumentengids van de client. Vier keer hetzelfde getal, vier keer
// anders geformuleerd, en nergens iets dat het aan de werkelijkheid vasthield.
//
// WAT ER GEMETEN IS
// Anders dan verwacht klopt het getal wel. Het rapport dat een deelnemer
// werkelijk krijgt is geen webpagina maar een vooraf ontwikkelde PDF: 24
// profielen maal 5 talen, 120 bestanden onder
// client/public/twominscan-rapporten/{taal}/. Alle 120 tellen exact vijftien
// pagina's. Het getal is dus niet verzonnen; er was alleen niets dat het
// bewaakte. Vervang iemand morgen een profiel door een versie van dertien
// pagina's, dan wordt de belofte stil onwaar.
//
// Daarom staat het getal nu hier, wordt het overal uit dit bestand gehaald, en
// meet tests/twominscan-rapportbelofte.test.ts de echte bestanden ertegen aan.
// Wie een profiel vervangt door een rapport van een andere lengte, krijgt een
// rode test in plaats van een belofte die niet meer klopt.
//
// Dit bestand bevat geen I/O en geen afhankelijkheden, zodat zowel de server
// als de client eruit kan lezen.
// ---------------------------------------------------------------------------

/** Het aantal pagina's van elk vooraf ontwikkeld 2MINSCAN-rapport. */
export const TWOMINSCAN_RAPPORT_PAGINAS = 15;

/** De 24 geijkte energetische profielen; elk heeft een eigen rapport. */
export const TWOMINSCAN_PROFIELEN = 24;

/** De talen waarin elk profiel bestaat, in de volgorde waarin ze getoond worden. */
export const TWOMINSCAN_RAPPORT_TALEN = ["NL", "FR", "EN", "ES", "RU"] as const;

/** Bijvoorbeeld "5 talen". */
export const TWOMINSCAN_TALENTEKST = `${TWOMINSCAN_RAPPORT_TALEN.length} talen`;

/** Bijvoorbeeld "5 talen (NL/FR/EN/ES/RU)". */
export const TWOMINSCAN_TALENTEKST_VOLUIT = `${TWOMINSCAN_TALENTEKST} (${TWOMINSCAN_RAPPORT_TALEN.join("/")})`;

/** Bijvoorbeeld "15 pagina's". */
export const TWOMINSCAN_PAGINATEKST = `${TWOMINSCAN_RAPPORT_PAGINAS} pagina's`;
