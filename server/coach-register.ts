// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Coach-register (zorg-kompas: dichtstbijzijnde coach).
//
// DOEL
// Wanneer de profielassistent doorverwijst (existentiële/onderliggende vraag of
// een profiel-risicosignaal), tonen we niet langer een vage placeholder, maar
// een ECHTE coach: naam, regio/plaats, expertise(s) en mailadres. De assistent
// kiest de DICHTSTBIJZIJNDE coach op basis van de regio van de deelnemer.
//
// ⚠️ DEMODATA — DIT IS FICTIEF.
// De onderstaande coaches zijn VOORBEELDEN voor de demo. Vervang dit ene
// bestand (de `COACH_REGISTER`-array) door de echte coachgegevens zodra die
// beschikbaar zijn; de rest van het platform hoeft niet te wijzigen. Elke
// coach is gemarkeerd met `demo: true` zodat de UI/engine kan tonen dat het om
// voorbeelddata gaat en niets als "echt" wordt voorgesteld.
//
// LOCATIEMATCHING (eenvoudig & robuust)
// We werken met Vlaamse provincies als regiosleutel. De deelnemer-regio (afgeleid
// uit de organisatie, met terugval op "Vlaanderen") wordt gematcht op de provincie
// van de coach. Geen exacte match? Dan kiezen we een coach met landelijk bereik
// (regioSleutel "Vlaanderen") of, als laatste terugval, de eerste coach. Zo is er
// ALTIJD een warme, concrete doorverwijzing.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";

type ML = Record<Taal, string>;

export type RegioSleutel =
  | "Antwerpen"
  | "Oost-Vlaanderen"
  | "West-Vlaanderen"
  | "Vlaams-Brabant"
  | "Limburg"
  | "Brussel"
  | "Vlaanderen"; // landelijk bereik

export interface CoachRecord {
  naam: string;
  // Vrije, menselijke plaatsaanduiding (stad/gemeente) — wat de deelnemer ziet.
  plaats: string;
  // Provincie-sleutel waarop we matchen.
  regioSleutel: RegioSleutel;
  // Korte expertises in mensentaal (geen interne vaktermen).
  expertise: string[];
  email: string;
  // true = voorbeelddata voor de demo (nog niet de echte coach).
  demo: boolean;
}

// ⚠️ FICTIEVE DEMODATA — vervang door echte coaches.
export const COACH_REGISTER: CoachRecord[] = [
  {
    naam: "Lieve Vermeulen",
    plaats: "Gent",
    regioSleutel: "Oost-Vlaanderen",
    expertise: ["Loopbaanbegeleiding", "Energie & veerkracht", "Talentontwikkeling"],
    email: "lieve.vermeulen@tapas-demo.be",
    demo: true,
  },
  {
    naam: "Tom Claeys",
    plaats: "Brugge",
    regioSleutel: "West-Vlaanderen",
    expertise: ["Leiderschapscoaching", "Stress & herstel", "Teamdynamiek"],
    email: "tom.claeys@tapas-demo.be",
    demo: true,
  },
  {
    naam: "Sofie De Smet",
    plaats: "Antwerpen",
    regioSleutel: "Antwerpen",
    expertise: ["Talentprofilering", "Burn-out-preventie", "Persoonlijke ontwikkeling"],
    email: "sofie.desmet@tapas-demo.be",
    demo: true,
  },
  {
    naam: "Karim Aerts",
    plaats: "Leuven",
    regioSleutel: "Vlaams-Brabant",
    expertise: ["Loopbaanheroriëntatie", "Coaching bij twijfel", "Zingeving in werk"],
    email: "karim.aerts@tapas-demo.be",
    demo: true,
  },
  {
    naam: "Nadia Hermans",
    plaats: "Hasselt",
    regioSleutel: "Limburg",
    expertise: ["Energiemanagement", "Veerkracht", "Talentcoaching"],
    email: "nadia.hermans@tapas-demo.be",
    demo: true,
  },
  {
    naam: "Pieter Maes",
    plaats: "Brussel",
    regioSleutel: "Brussel",
    expertise: ["Loopbaancoaching", "Werkdruk & balans", "Tweetalige begeleiding"],
    email: "pieter.maes@tapas-demo.be",
    demo: true,
  },
  // Landelijk bereik — gebruikt als terugval wanneer de regio onbekend is.
  {
    naam: "Anke Willems",
    plaats: "online & heel Vlaanderen",
    regioSleutel: "Vlaanderen",
    expertise: ["Talent- & energiecoaching", "Online begeleiding", "Levensvragen in werk"],
    email: "anke.willems@tapas-demo.be",
    demo: true,
  },
];

// Map een vrije regio-/organisatietekst naar een provincie-sleutel.
// Robuust: herkent provincienamen én bekende steden. Onbekend => "Vlaanderen".
const STAD_NAAR_REGIO: { sleutel: RegioSleutel; termen: string[] }[] = [
  { sleutel: "Antwerpen", termen: ["antwerpen", "mechelen", "turnhout", "lier", "mortsel"] },
  {
    sleutel: "Oost-Vlaanderen",
    termen: ["oost-vlaanderen", "oost vlaanderen", "gent", "aalst", "sint-niklaas", "dendermonde", "wortegem", "oudenaarde", "deinze"],
  },
  {
    sleutel: "West-Vlaanderen",
    termen: ["west-vlaanderen", "west vlaanderen", "brugge", "kortrijk", "oostende", "roeselare", "ieper", "waregem"],
  },
  { sleutel: "Vlaams-Brabant", termen: ["vlaams-brabant", "vlaams brabant", "leuven", "halle", "vilvoorde", "tienen", "diest"] },
  { sleutel: "Limburg", termen: ["limburg", "hasselt", "genk", "sint-truiden", "tongeren"] },
  { sleutel: "Brussel", termen: ["brussel", "bruxelles", "brussels"] },
];

export function bepaalRegio(vrijeTekst: string | null | undefined): RegioSleutel {
  const t = String(vrijeTekst ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t) return "Vlaanderen";
  for (const m of STAD_NAAR_REGIO) {
    if (m.termen.some((term) => t.includes(term))) return m.sleutel;
  }
  return "Vlaanderen";
}

// Kies de dichtstbijzijnde coach voor een regio. Exacte provincie-match wint;
// anders een landelijke coach ("Vlaanderen"); anders de eerste in het register.
export function kiesCoach(regio: RegioSleutel): CoachRecord | null {
  if (COACH_REGISTER.length === 0) return null;
  const exact = COACH_REGISTER.find((c) => c.regioSleutel === regio);
  if (exact) return exact;
  const landelijk = COACH_REGISTER.find((c) => c.regioSleutel === "Vlaanderen");
  return landelijk ?? COACH_REGISTER[0]!;
}

// Menselijke rol-omschrijving per taal (de expertises zelf blijven NL labels;
// dat is bewust — het zijn de echte specialisaties van de coach).
export const COACH_ROL: ML = {
  nl: "Gecertificeerd TaPas talent- & energiecoach",
  fr: "Coach TaPas certifié en talents & énergie",
  en: "Certified TaPas talent & energy coach",
  es: "Coach TaPas certificado de talento y energía",
  ru: "Сертифицированный коуч TaPas по талантам и энергии",
};
