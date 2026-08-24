// ---------------------------------------------------------------------------
// shared/uitnodigingsontvanger.ts - naar wie een uitnodiging mag gaan
//
// WAAROM DIT BESTAAT. Een uitnodiging kon tot nu alleen als link worden
// aangemaakt en met de hand in een bericht worden gezet. Zodra het platform die
// uitnodiging zelf verstuurt, komt er een vraag bij die een mens tot nu zelf
// beantwoordde: naar welk adres mag dit bericht. Bij T4Kids en T4Teens is dat
// geen vormvraag. Het adres van een kind is een persoonsgegeven, en een bericht
// met een persoonlijke link naar een kind sturen zonder dat een ouder of voogd
// dat weet, is precies wat artikel 8 van de AVG wil voorkomen.
//
// DE REGEL DIE WIJ VOLGEN. Dezelfde die shared/leeftijd.ts al afdwingt bij het
// starten van een afname, zodat er geen twee lijnen naast elkaar bestaan:
//   - T4Kids: altijd naar een ouder, voogd of begeleider.
//   - T4Teens onder de zestien: idem.
//   - T4Teens vanaf zestien: de jongere mag zelf, want die mag volgens dezelfde
//     poort ook zelf toestemmen. In Belgie ligt de leeftijd voor eigen
//     toestemming op dertien; het platform legt de lat op zestien en die keuze
//     wordt hier niet losgelaten.
//   - Alle andere instrumenten: naar de deelnemer zelf.
//
// WAT DEZE MODULE NIET DOET. Ze verstuurt niets, ze raakt de databank niet en ze
// kent de omgeving niet. Ze beoordeelt een keuze en geeft in gewone woorden terug
// wat er ontbreekt, zodat het beheerscherm en de route dezelfde regel gebruiken.
// ---------------------------------------------------------------------------

import {
  isMinderjarigInstrument,
  isGeldigeLeeftijdsband,
  toegestaneBandenVoor,
  vereistOuderlijkeToestemming,
  type Leeftijdsband,
} from "./leeftijd";

// Wie het bericht ontvangt. Bewust vier rollen: een coach of leerkracht is in de
// praktijk vaak de begeleider die de afname organiseert, en die valt niet onder
// ouder of voogd.
export const ONTVANGERROLLEN = ["deelnemer", "ouder", "voogd", "begeleider"] as const;
export type Ontvangerrol = (typeof ONTVANGERROLLEN)[number];

/** Rollen die als verantwoordelijke voor een minderjarige gelden. */
export const VERANTWOORDELIJKE_ROLLEN: readonly Ontvangerrol[] = ["ouder", "voogd", "begeleider"];

export function isOntvangerrol(x: unknown): x is Ontvangerrol {
  return typeof x === "string" && (ONTVANGERROLLEN as readonly string[]).includes(x);
}

export function isVerantwoordelijke(rol: Ontvangerrol): boolean {
  return VERANTWOORDELIJKE_ROLLEN.includes(rol);
}

// Hetzelfde patroon als in shared/leeftijd.ts. Een strengere controle hoort bij
// de mailserver, niet hier: dit weert enkel wat zeker geen adres is.
const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OntvangerInvoer {
  instrumentId?: string | null;
  /** Alleen nodig bij de instrumenten voor minderjarigen. */
  leeftijdsband?: string | null;
  ontvangerRol?: string | null;
  email?: string | null;
  /** Waar of de beheerder de uitnodiging ook werkelijk wil laten versturen. */
  wilVersturen?: boolean;
}

export type OntvangerResultaat =
  | {
      ok: true;
      /** Null wanneer er geen adres in het spel is: dan is er niets te beoordelen. */
      rol: Ontvangerrol | null;
      email: string | null;
      /** Waar wanneer het adres van een ouder, voogd of begeleider is. */
      naarVerantwoordelijke: boolean;
      band: Leeftijdsband | null;
    }
  | { ok: false; fout: string };

/**
 * Beoordeelt of deze uitnodiging naar dit adres mag.
 *
 * Zonder adres en zonder verzendwens is dit altijd in orde: dan blijft de oude
 * weg over, namelijk een link aanmaken en die zelf doorgeven. Staat er wel een
 * adres, dan gelden de regels hierboven, ook wanneer er nog niet verstuurd wordt.
 * Het adres wordt in dat geval namelijk wel bewaard, en dat is bij een kind
 * evenveel een verwerking als het versturen zelf.
 */
export function valideerUitnodigingsontvanger(invoer: OntvangerInvoer): OntvangerResultaat {
  const instrumentId = invoer.instrumentId ?? null;
  const email = (invoer.email ?? "").trim();
  const wilVersturen = invoer.wilVersturen === true;

  if (!email) {
    if (wilVersturen) {
      return {
        ok: false,
        fout: "Vul een e-mailadres in, of maak alleen een link aan en geef die zelf door.",
      };
    }
    return { ok: true, rol: null, email: null, naarVerantwoordelijke: false, band: null };
  }
  if (!EMAIL_PATROON.test(email)) {
    return { ok: false, fout: "Dat lijkt geen geldig e-mailadres." };
  }

  const gekozenRol = invoer.ontvangerRol ?? null;
  if (gekozenRol !== null && !isOntvangerrol(gekozenRol)) {
    return { ok: false, fout: "Kies wie dit bericht ontvangt: de deelnemer, een ouder, een voogd of een begeleider." };
  }

  // Buiten de instrumenten voor minderjarigen blijft alles zoals het was: het
  // adres is dat van de deelnemer, tenzij uitdrukkelijk anders gekozen.
  if (!isMinderjarigInstrument(instrumentId)) {
    const rol: Ontvangerrol = gekozenRol ?? "deelnemer";
    return {
      ok: true,
      rol,
      email,
      naarVerantwoordelijke: isVerantwoordelijke(rol),
      band: null,
    };
  }

  const band = invoer.leeftijdsband ?? null;
  if (!band) {
    return {
      ok: false,
      fout: "Kies eerst de leeftijdsgroep. Daarvan hangt af naar wie deze uitnodiging mag gaan.",
    };
  }
  if (!isGeldigeLeeftijdsband(band)) {
    return { ok: false, fout: "Die leeftijdsgroep kennen we niet. Kies een van de voorgestelde groepen." };
  }
  const toegestaan = toegestaneBandenVoor(instrumentId) ?? [];
  if (!toegestaan.includes(band)) {
    return {
      ok: false,
      fout: `Deze leeftijdsgroep hoort niet bij dit instrument. Mogelijk: ${toegestaan.join(", ")}.`,
    };
  }

  const moetNaarVerantwoordelijke = vereistOuderlijkeToestemming(instrumentId, band);
  if (moetNaarVerantwoordelijke) {
    if (!gekozenRol || !isVerantwoordelijke(gekozenRol)) {
      return {
        ok: false,
        fout:
          "Bij deze leeftijd gaat de uitnodiging naar een ouder, voogd of begeleider. " +
          "Vul dat adres in en duid aan wie het is.",
      };
    }
    return { ok: true, rol: gekozenRol, email, naarVerantwoordelijke: true, band };
  }

  // Vanaf zestien mag de jongere zelf. Kiest de beheerder toch een ouder, voogd
  // of begeleider, dan is dat evengoed toegestaan.
  const rol: Ontvangerrol = gekozenRol ?? "deelnemer";
  return { ok: true, rol, email, naarVerantwoordelijke: isVerantwoordelijke(rol), band };
}
