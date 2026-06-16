// ---------------------------------------------------------------------------
// 2MINSCAN — vertaallaag (Laag 2: instrument-content).
//
// Volgt hetzelfde patroon als de T4Recruitment-library (library-i18n.ts):
// NL is de bron- en standaardtaal en blijft de bron van waarheid voor structuur
// en logica. Deze module levert vertaalde KOPIEËN van de zichtbare tekstvelden
// o.b.v. een gekozen afname-taal. FR/EN/ES/RU zijn conceptvertalingen
// ("te valideren"): taalkundig verzorgd, niet psychometrisch gevalideerd.
//
// VAKTERM- EN ENERGIETAALREGELS (geborgd in de vertaalbron, niet hier afgedwongen):
//   • De 2MINSCAN gebruikt UITSLUITEND energietaal. GEEN talenttaal, geen
//     potentieel/competentie/diagnose/selectie-claims, in GEEN ENKELE taal.
//   • Het woord "creativiteit" wordt NOOIT gebruikt — vervang door
//     brainstormen / mogelijkheden verkennen / teamspirit (per taal-equivalent).
//   • De intro/extravert-stand wordt als één concept benoemd:
//     EE = "uitgesproken extravert", II = "uitgesproken introvert",
//     IE/EI = "ambivert". NOOIT per losse letter splitsen, NOOIT "expressief".
//   • Eigendoms-/contactgegevens (TaPasCity, www.tapascity.com, info@tapascity.com)
//     blijven in alle talen identiek.
//
// SLEUTELCONVENTIE (zie vertalingen.json):
//   ui.<gebied>.<naam>     → vaste UI-strings (afname + rapport-koppen)
//   kleur.<kleur>.<veld>   → kleur-archetype content (content.ts)
//   letter.<L>.<titel|uitleg>  → EG-letter-uitleg (egcode.ts)
//   ie.<EE|II|AMBI>.<titel|uitleg|chip>  → intro/extravert-blok
//   min.<a|z|b|g>.<titel|uitleg>  → minsegment (energiekost)
//   chip.<L>               → samenvattingschips
//   woord.<id>             → keuzewoorden vragenlijst (data.ts)
// ---------------------------------------------------------------------------

import { type Taal, STANDAARD_TAAL } from "@shared/talen";
import vertalingenJson from "./vertalingen.json";

const DOELTALEN = ["fr", "en", "es", "ru"] as const;
type VertaalMap = Record<string, string>;
const VERTALINGEN: Record<string, VertaalMap> = vertalingenJson as any;

function isDoeltaal(taal: string): boolean {
  return (DOELTALEN as readonly string[]).includes(taal);
}

/** Vertaalde string of NL-fallback. NL en onbekende talen geven altijd de fallback. */
export function t(taal: Taal, key: string, fallback: string): string {
  if (taal === "nl" || !isDoeltaal(taal)) return fallback;
  const map = VERTALINGEN[taal];
  if (!map) return fallback;
  const val = map[key];
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

/** Curry-helper: maakt een vertaler vastgepind op één taal. */
export function maakT(taal: Taal = STANDAARD_TAAL) {
  return (key: string, fallback: string) => t(taal, key, fallback);
}

export type Vertaler = ReturnType<typeof maakT>;
export { STANDAARD_TAAL };
export type { Taal };
