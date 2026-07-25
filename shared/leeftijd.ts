// ---------------------------------------------------------------------------
// shared/leeftijd.ts - Leeftijdspoort en ouderlijke toestemming (AVG art. 8)
//
// Wettelijk kader:
//   - AVG art. 8: toestemming van een kind is enkel geldig vanaf de nationale
//     drempel. In Belgie is die drempel 13 jaar.
//   - EDPB-richtsnoeren kinderen: begrijpelijke taal, extra waarborgen.
//   - AI Act: minderjarigen zijn een kwetsbare groep, dus strengste lijn.
//
// Beleidskeuze van TaPasCity (verwerkingsverantwoordelijke, Wijnegem):
//   - T4Kids (doelgroep 10-13) is per definitie (deels) onder de drempel:
//     ouderlijke toestemming is ALTIJD verplicht.
//   - T4Teens (doelgroep 13-17): vanaf 13 mag de jongere zelf toestemmen, maar
//     onder de 16 eisen we bijkomend een ouderlijke bevestiging als extra
//     waarborg. Vanaf 16 mag de jongere zelfstandig toestemmen.
//   - Leeftijd wordt bewaard als grove band (dataminimalisatie), nooit als
//     geboortedatum.
//
// Deze module is bewust vrij van afhankelijkheden zodat zowel de client
// (leeftijdspoort in de UI) als de server (afdwinging) dezelfde regels gebruikt.
// ---------------------------------------------------------------------------

// Grove leeftijdsbanden. Bewust geen geboortejaar of geboortedatum: een band is
// voldoende om de juiste toestemmingsroute te kiezen (dataminimalisatie).
export const LEEFTIJDSBANDEN = ["10-12", "13-15", "16-17", "18+"] as const;
export type Leeftijdsband = (typeof LEEFTIJDSBANDEN)[number];

// Instrumenten die zich (mede) op minderjarigen richten. Enkel voor deze
// instrumenten geldt de leeftijdspoort; alle andere instrumenten (T4P,
// T4Sports, T4Students, ...) blijven volledig ongewijzigd werken.
export const MINDERJARIGE_INSTRUMENTEN = ["t4teens", "t4kids"] as const;

// Banden die onder de 16 vallen en dus een ouderlijke bevestiging vereisen.
const BANDEN_ONDER_16: readonly Leeftijdsband[] = ["10-12", "13-15"];

// Welke banden zijn zinvol per instrument. Buiten deze banden weigeren we de
// afname met een nette melding in plaats van door te gaan met ongeldige data.
const TOEGESTANE_BANDEN: Record<string, readonly Leeftijdsband[]> = {
  t4kids: ["10-12", "13-15"],
  t4teens: ["13-15", "16-17"],
};

export function isGeldigeLeeftijdsband(x: unknown): x is Leeftijdsband {
  return typeof x === "string" && (LEEFTIJDSBANDEN as readonly string[]).includes(x);
}

// Geldt de leeftijdspoort voor dit instrument?
export function isMinderjarigInstrument(instrumentId?: string | null): boolean {
  if (!instrumentId) return false;
  return (MINDERJARIGE_INSTRUMENTEN as readonly string[]).includes(instrumentId);
}

// De banden die dit instrument aanvaardt. Null wanneer de poort niet geldt.
export function toegestaneBandenVoor(instrumentId?: string | null): readonly Leeftijdsband[] | null {
  if (!instrumentId) return null;
  return TOEGESTANE_BANDEN[instrumentId] ?? null;
}

// Is voor deze combinatie een ouderlijke toestemming vereist?
// T4Kids: altijd. T4Teens: enkel onder de 16.
export function vereistOuderlijkeToestemming(
  instrumentId: string | null | undefined,
  band: Leeftijdsband | null | undefined,
): boolean {
  if (!isMinderjarigInstrument(instrumentId)) return false;
  if (!band) return false;
  if (instrumentId === "t4kids") return true;
  return BANDEN_ONDER_16.includes(band);
}

export interface LeeftijdspoortInvoer {
  instrumentId?: string | null;
  leeftijdsband?: string | null;
  ouderlijkeToestemming?: boolean | null;
  ouderNaam?: string | null;
  ouderEmail?: string | null;
}

export type LeeftijdspoortResultaat =
  | { ok: true; band: Leeftijdsband | null; ouderlijkeToestemmingVereist: boolean }
  | { ok: false; fout: string };

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Centrale validatie, gebruikt door zowel de client-UI als de server-route.
// Voor niet-minderjarige instrumenten is dit altijd ok zodat bestaande
// instrumenten niet breken.
export function valideerLeeftijdspoort(invoer: LeeftijdspoortInvoer): LeeftijdspoortResultaat {
  const instrumentId = invoer.instrumentId ?? null;
  if (!isMinderjarigInstrument(instrumentId)) {
    return { ok: true, band: null, ouderlijkeToestemmingVereist: false };
  }

  const toegestaan = toegestaneBandenVoor(instrumentId) ?? [];
  const band = invoer.leeftijdsband;

  if (!band) {
    return { ok: false, fout: "Kies eerst je leeftijdsgroep om verder te gaan." };
  }
  if (!isGeldigeLeeftijdsband(band)) {
    return { ok: false, fout: "Die leeftijdsgroep kennen we niet. Kies een van de voorgestelde groepen." };
  }
  if (!toegestaan.includes(band)) {
    const naam = instrumentId === "t4kids" ? "T4Kids" : "T4Teens";
    return {
      ok: false,
      fout: `Deze vragenlijst (${naam}) is niet gemaakt voor jouw leeftijd. Vraag je begeleider naar de juiste vragenlijst.`,
    };
  }

  const ouderVereist = vereistOuderlijkeToestemming(instrumentId, band);
  if (!ouderVereist) {
    return { ok: true, band, ouderlijkeToestemmingVereist: false };
  }

  if (invoer.ouderlijkeToestemming !== true) {
    return {
      ok: false,
      fout: "Voor jouw leeftijd moet een ouder of voogd toestemming geven. Vul samen het toestemmingsvenster in.",
    };
  }
  const naamOuder = (invoer.ouderNaam ?? "").trim();
  if (naamOuder.length < 2) {
    return { ok: false, fout: "Vul de naam van de ouder of voogd in." };
  }
  const emailOuder = (invoer.ouderEmail ?? "").trim();
  if (!EMAIL_PATROON.test(emailOuder)) {
    return { ok: false, fout: "Vul een geldig e-mailadres van de ouder of voogd in." };
  }

  return { ok: true, band, ouderlijkeToestemmingVereist: true };
}
