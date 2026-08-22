// ---------------------------------------------------------------------------
// shared/doelgroep-leeftijd.ts
//
// De enige bron van waarheid voor de leeftijden waarvoor T4Teens en
// T4Students gemaakt zijn: de ondergrens, de bovengrens, het punt waarop de
// twee leeftijdsbanden van T4Teens splitsen, en alle teksten die daaruit
// volgen.
//
// WAAROM DIT BESTAAT
// Voor een en hetzelfde instrument stonden vijf verschillende leeftijdsgrenzen
// naast elkaar. De vragenlijst zelf kondigde "16 tot 21 jaar" aan, het rapport
// zette "16-21 jaar" onder de titel, de catalogus en de instrumentengids op de
// server zeiden "14-18 jaar", de gids in de client en het register zeiden
// "13-17 jaar", en de leeftijdspoort liet bij een afname enkel 13 tot en met 17
// toe. Een jongere van twintig kon de vragenlijst dus aangeboden krijgen op
// grond van de omschrijving en vervolgens bij de poort geweigerd worden. Alles
// staat nu hier, en alleen hier.
//
// DE GEKOZEN GRENS IS EEN KEUZE
// De grens is 13 tot en met 17 jaar. Gekozen omdat dat als enige van de vijf
// getallen gedekt werd door gedrag van de software en niet door tekst alleen:
// het is de grens die de leeftijdspoort bij een afname werkelijk afdwingt.
//
// Er is GEEN onderzoek waaruit volgt dat de vragenlijst boven 17 niet meer
// werkt of onder 13 wel. De ondergrens valt samen met de Belgische AVG-drempel
// voor toestemming van een kind, en de bovengrens sluit aan op het punt waar
// T4Students begint. Beide zijn beleidskeuzes van TaPasCity, geen meting. Wie
// de doelgroep wil verruimen, verzet de getallen hieronder; de leeftijdspoort
// en alle teksten schuiven dan mee. Of dat inhoudelijk verantwoord is, staat
// daar los van en hoort eerst beantwoord te worden.
// ---------------------------------------------------------------------------

export const T4TEENS_DOELGROEP = {
  /** Jongste leeftijd waarvoor T4Teens bedoeld is. */
  minLeeftijd: 13,
  /**
   * Vanaf deze leeftijd mag de jongere zelfstandig toestemmen (zie
   * shared/leeftijd.ts). Dit is meteen het punt waar de twee leeftijdsbanden
   * splitsen, zodat er niet twee getallen zijn die hetzelfde bedoelen.
   */
  zelfstandigVanaf: 16,
  /** Oudste leeftijd waarvoor T4Teens bedoeld is. Daarboven is T4Students het
   *  passende instrument. */
  maxLeeftijd: 17,
} as const;

// De twee leeftijdsbanden waarin een afname van T4Teens valt. Afgeleid, dus
// zonder eigen getallen: wie de grens hierboven verzet, verzet ook deze.
export const T4TEENS_BAND_JONGER = `${T4TEENS_DOELGROEP.minLeeftijd}-${T4TEENS_DOELGROEP.zelfstandigVanaf - 1}`;
export const T4TEENS_BAND_OUDER = `${T4TEENS_DOELGROEP.zelfstandigVanaf}-${T4TEENS_DOELGROEP.maxLeeftijd}`;

/** Het bereik zonder eenheid, bijvoorbeeld voor een titel tussen haakjes. */
export const T4TEENS_LEEFTIJDSBEREIK = `${T4TEENS_DOELGROEP.minLeeftijd}-${T4TEENS_DOELGROEP.maxLeeftijd}`;

/** Het bereik zoals het in doelgroepomschrijvingen staat. */
export const T4TEENS_LEEFTIJDSTEKST = `${T4TEENS_LEEFTIJDSBEREIK} jaar`;

/** Het bereik voluit, voor een lopende zin richting de jongere zelf. */
export const T4TEENS_LEEFTIJDSTEKST_VOLUIT = `${T4TEENS_DOELGROEP.minLeeftijd} tot en met ${T4TEENS_DOELGROEP.maxLeeftijd} jaar`;

// ---------------------------------------------------------------------------
// T4STUDENTS
//
// Dezelfde behandeling voor het studiekompas. Ook hier stonden meerdere
// getallen naast elkaar: het databestand van het instrument zei "17-25+", het
// register zei "17 tot 25 jaar en ouder", de gids op de server en in de client
// zeiden "17 tot 25 jaar", en een oudere regel in het register noemde nog
// "17-23 jaar". De vastgelegde doelgroep is 17 tot en met 23 jaar. Alles wat
// die leeftijd in een tekst zet, leest hem vanaf hier.
//
// DE GRENS IS EEN KEUZE, GEEN METING
// Er is geen leeftijdsonderzoek waaruit volgt dat de items boven 23 niet meer
// werken of dat ze voor een zeventienjarige en een drieentwintigjarige
// hetzelfde betekenen. Meetinvariantie over leeftijd is niet onderzocht. Dit
// is een ontwerpconventie van TaPasCity: de ondergrens sluit aan op het punt
// waar T4Teens ophoudt, de bovengrens op het einde van een gewone
// studieloopbaan in het hoger onderwijs.
//
// DE ONDERGRENS BLIJFT EEN OPEN PUNT
// Zeventien valt vandaag zowel binnen T4Teens als binnen T4Students, en de
// leeftijdspoort wordt voor T4Students helemaal niet toegepast. Dat is niet
// met deze grens opgelost en staat vast in
// tests/t4students-doelgroep-ondergrens.test.ts.
// ---------------------------------------------------------------------------

export const T4STUDENTS_DOELGROEP = {
  /** Jongste leeftijd waarvoor T4Students bedoeld is. */
  minLeeftijd: 17,
  /** Oudste leeftijd waarvoor T4Students bedoeld is. */
  maxLeeftijd: 23,
} as const;

/** Het bereik zonder eenheid, bijvoorbeeld voor een titel tussen haakjes. */
export const T4STUDENTS_LEEFTIJDSBEREIK = `${T4STUDENTS_DOELGROEP.minLeeftijd}-${T4STUDENTS_DOELGROEP.maxLeeftijd}`;

/** Het bereik zoals het in doelgroepomschrijvingen staat. */
export const T4STUDENTS_LEEFTIJDSTEKST = `${T4STUDENTS_LEEFTIJDSBEREIK} jaar`;

/** Het bereik voluit, voor een lopende zin. */
export const T4STUDENTS_LEEFTIJDSTEKST_VOLUIT = `${T4STUDENTS_DOELGROEP.minLeeftijd} tot ${T4STUDENTS_DOELGROEP.maxLeeftijd} jaar`;
