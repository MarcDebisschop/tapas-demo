// =============================================================================
// Foutduiding
//
// Zegt wat er werkelijk aan de hand is.
//
// Het scherm van de Regiekamer toonde bij elke fout dezelfde kaart:
// "Verbindingsprobleem. Controleer je internetverbinding." Dat klopte zelden.
// Wie niet aangemeld was, wie een dossier opende dat niet van hem is, of wie een
// dossier opvroeg dat niet meer bestaat, kreeg allemaal te horen dat hun
// internet stuk was. Dan gaat een mens de verkeerde kant op zoeken.
//
// Dit bestand leest de fout uit en kiest de kaart die erbij hoort. Het praat
// nergens over verbinding tenzij de server werkelijk onbereikbaar bleek.
//
// Waar de fouten vandaan komen:
//   - queryClient.ts maakt bij een afgewezen antwoord: new Error(`${status}: ${tekst}`)
//   - queryClient.ts maakt bij een mislukte oproep: "Netwerk niet bereikbaar."
//   - fetch zelf maakt bij een mislukte oproep een TypeError van de browser
//   - de server antwoordt met een romp { error: "een zin in gewone taal" }
//
// Dit bestand houdt geen React vast, zodat het los te beproeven is.
// =============================================================================

/** De soorten foutkaart die het scherm kent. */
export type FoutSoort =
  | "sessie-verlopen"
  | "onvoldoende-credits"
  | "netwerk"
  | "token-ongeldig"
  | "geen-toegang"
  | "niet-gevonden"
  | "serverfout"
  | "algemeen";

export interface Foutduiding {
  soort: FoutSoort;
  /** Alleen gevuld wanneer de standaardtitel van de kaart niet volstaat. */
  titel?: string;
  /** Alleen gevuld wanneer de server iets bruikbaars te zeggen had. */
  beschrijving?: string;
}

/** Zo lang mag een zin van de server hoogstens zijn in het scherm. */
const MAXIMALE_LENGTE = 300;

/** De zin waarmee queryClient een onbereikbare server aankondigt. */
const ONBEREIKBAAR = "Netwerk niet bereikbaar";

/**
 * Woorden waarmee de browser zelf een mislukte oproep aankondigt. Elke browser
 * kiest een eigen bewoording, vandaar de lijst.
 */
const BROWSER_ONBEREIKBAAR = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "err_internet_disconnected",
];

function boodschapVan(fout: unknown): string {
  if (fout instanceof Error) return fout.message;
  if (typeof fout === "string") return fout;
  return "";
}

/**
 * Leest de statuscode uit een fout van queryClient.
 *
 * Alleen een code helemaal vooraan telt, en alleen een getal dat werkelijk een
 * statuscode kan zijn. Zo wordt "in 2026: er ging iets mis" niet aangezien voor
 * een antwoord van de server.
 */
export function leesStatuscode(fout: unknown): number | null {
  const treffer = /^(\d{3}):/.exec(boodschapVan(fout));
  if (!treffer) return null;
  const code = Number(treffer[1]);
  return code >= 100 && code <= 599 ? code : null;
}

/**
 * Haalt de zin die de server meestuurde uit de romp van het antwoord.
 *
 * De server antwoordt met { error: "..." }. Alleen een echte zin komt in
 * aanmerking: geen veldenlijst, geen lege ruimte, geen bladzijde met opmaak.
 */
export function leesServerboodschap(fout: unknown): string | null {
  const boodschap = boodschapVan(fout);
  const treffer = /^\d{3}:\s*([\s\S]*)$/.exec(boodschap);
  if (!treffer) return null;

  let romp: unknown;
  try {
    romp = JSON.parse(treffer[1]);
  } catch {
    return null;
  }
  if (typeof romp !== "object" || romp === null) return null;

  const zin = (romp as { error?: unknown }).error;
  if (typeof zin !== "string") return null;

  const opgeschoond = zin.trim();
  if (opgeschoond === "") return null;

  return opgeschoond.length > MAXIMALE_LENGTE
    ? `${opgeschoond.slice(0, MAXIMALE_LENGTE - 1).trimEnd()}\u2026`
    : opgeschoond;
}

/** Zo meldt de server dat er niemand aangemeld is. */
const AANMELDEN_VEREIST = "Een aangemelde beheerder is vereist.";

/**
 * Zo weigert de bewaking op organisatiegegevens (server/scope-guard.ts).
 *
 * Gemeten, niet aangenomen: deze ene zin komt terug in drie verschillende
 * gevallen. Er is niemand aangemeld, of de aangemelde beheerder is uitgezet, of
 * hij hangt aan geen enkele organisatie. De server maakt dat onderscheid niet,
 * dus mag het scherm niet doen alsof het weet welke van de drie het is. De
 * boodschap noemt daarom eerlijk beide kanten en geeft bij elke kant de stap.
 */
const GEEN_ORGANISATIETOEGANG = "Geen toegang tot organisatiegegevens.";

const GEEN_ORGANISATIETOEGANG_UITLEG =
  "Twee dingen kunnen hier spelen. Ofwel ben je niet meer aangemeld: meld je dan " +
  "opnieuw aan. Ofwel ben je wel aangemeld, maar hangt je account aan geen enkele " +
  "organisatie, of is het uitgezet: vraag dan je beheerder om je te koppelen.";

/**
 * Zegt of het zin heeft om dezelfde oproep nog eens te doen.
 *
 * Een knop die niets oplost is een vorm van misleiding: hij belooft een uitweg
 * die er niet is. Een dossier dat niet bestaat, bestaat na opnieuw laden nog
 * steeds niet, en een rechtenkwestie lost zich niet op door te herhalen. In die
 * gevallen laat het scherm de knop van de kaart zelf staan, die wel naar een
 * volgende stap wijst.
 */
export function opnieuwProberenHeeftZin(soort: FoutSoort): boolean {
  return soort === "netwerk" || soort === "serverfout" || soort === "algemeen";
}

export interface DuidingsOpties {
  /**
   * Waar wanneer er geen fout was, maar ook geen gegevens binnenkwamen. Dat is
   * geen verbindingsprobleem en mag ook niet zo genoemd worden.
   */
  gegevensOntbreken?: boolean;
}

/**
 * Kiest de foutkaart die bij deze fout hoort.
 *
 * De regel is streng: het woord verbinding valt alleen wanneer de server
 * werkelijk niet bereikt kon worden. In alle andere gevallen krijgt de lezer te
 * horen wat er wel aan de hand is.
 */
export function duidFout(fout: unknown, opties: DuidingsOpties = {}): Foutduiding {
  const code = leesStatuscode(fout);
  const vanDeServer = leesServerboodschap(fout);

  // De server heeft geantwoord. Dan is er niets mis met de verbinding.
  if (code !== null) {
    if (code === 401) {
      return { soort: "sessie-verlopen" };
    }
    if (code === 403) {
      if (vanDeServer === AANMELDEN_VEREIST) {
        return { soort: "sessie-verlopen" };
      }
      if (vanDeServer === GEEN_ORGANISATIETOEGANG) {
        return {
          soort: "geen-toegang",
          titel: "Je kunt hier niet bij",
          beschrijving: GEEN_ORGANISATIETOEGANG_UITLEG,
        };
      }
      return {
        soort: "geen-toegang",
        beschrijving: vanDeServer ?? undefined,
      };
    }
    if (code === 404) {
      return { soort: "niet-gevonden" };
    }
    if (code >= 500) {
      return { soort: "serverfout" };
    }
    // Overige afwijzingen: de server heeft zelf een zin in gewone taal.
    return {
      soort: "algemeen",
      beschrijving: vanDeServer ?? undefined,
    };
  }

  // Geen antwoord ontvangen: dan pas mag het over de verbinding gaan.
  const boodschap = boodschapVan(fout);
  const klein = boodschap.toLowerCase();
  const onbereikbaar =
    boodschap.includes(ONBEREIKBAAR) ||
    BROWSER_ONBEREIKBAAR.some((woord) => klein.includes(woord));
  if (onbereikbaar && !opties.gegevensOntbreken) {
    return { soort: "netwerk" };
  }

  return { soort: "algemeen" };
}
