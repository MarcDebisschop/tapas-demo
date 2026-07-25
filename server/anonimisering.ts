// ---------------------------------------------------------------------------
// server/anonimisering.ts - Eén definitie van "wat wissen we" (AVG art. 17)
//
// De anonimisering bestond op twee plaatsen (DatabaseStorage en de
// afnames-repository). Die twee liepen uiteen, waardoor een veld in de ene
// implementatie wel en in de andere niet gewist werd. Deze module levert het
// veldenoverzicht zodat beide exact hetzelfde doen en een nieuw persoonsveld
// maar op één plek toegevoegd hoeft te worden.
//
// Wat gewist wordt en waarom:
//   - naam/bedrijf/functie: directe identificatie.
//   - deelnemerEmail: directe sleutel naar de persoon en naar het
//     deelnemersdashboard. Werd voorheen NIET gewist.
//   - antwoorden en contract: bijzondere, gedragsmatige gegevens.
//   - consent-bewijs (IP, user-agent): identificerend netwerkspoor.
//   - leeftijdsband en alle oudergegevens: bij minderjarigen blijft een grove
//     leeftijd samen met contextgegevens indirect identificerend, dus wissen we
//     die volledig in plaats van een restje te bewaren.
// ---------------------------------------------------------------------------

// De velden die na anonimisering leeg (of neutraal) moeten zijn. De sleutels
// komen uit de afnames-tabel; de tests gebruiken deze lijst als bewijslast.
export const TE_ANONIMISEREN_VELDEN = [
  "company",
  "role",
  "deelnemerEmail",
  "mainResponses",
  "connectionAnswers",
  "generatorContract",
  "consentIp",
  "consentUserAgent",
  "leeftijdsband",
  "ouderlijkeToestemmingAt",
  "ouderNaam",
  "ouderEmail",
  "ouderlijkeToestemmingIp",
  "ouderlijkeToestemmingUserAgent",
] as const;

export const GEANONIMISEERDE_NAAM = "[geanonimiseerd]";

// De patch die op de afname wordt toegepast. `reden` komt in consentScope zodat
// het verwerkingsregister aantoont waarom er gewist is.
export function anonimiseringsPatch(reden: string, nu: string) {
  const patch: Record<string, unknown> = {
    name: GEANONIMISEERDE_NAAM,
    ouderlijkeToestemming: false,
    geanonimiseerdAt: nu,
    consentScope: `geanonimiseerd: ${reden}`,
  };
  for (const veld of TE_ANONIMISEREN_VELDEN) patch[veld] = null;
  return patch;
}
