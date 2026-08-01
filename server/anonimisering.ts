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

// De reden die in het controlespoor komt wanneer de wissing volgt uit een
// ingetrokken toestemming (AVG art. 7 lid 3).
export const INTREKKINGSREDEN = "toestemming ingetrokken door de betrokkene";

// ---------------------------------------------------------------------------
// Afgeleide documenten (AVG art. 17 lid 1 en lid 2)
//
// Het wissen raakte tot nu toe enkel de afname zelf. Het gegenereerde rapport
// bleef daarbij ongemoeid, en dat rapport is juist de plaats waar alles
// samenkomt: de naam van de deelnemer, de volledige scores en de duidende
// tekst, zowel in de JSON-inhoud als in de HTML en in het eventuele
// PDF-document. Een wissing die het rapport laat staan, wist in de praktijk
// niets. Daarom hoort het rapport bij dezelfde handeling.
//
// We verwijderen de rij niet: het bestaan van een rapport is een boekhoudkundig
// en organisatorisch feit (er is een credit voor verbruikt). Wat verdwijnt is
// de volledige inhoud. Wat overblijft is een lege huls met het tijdstip van de
// wissing, zodat het controlespoor aantoonbaar blijft.
// ---------------------------------------------------------------------------

export function rapportAnonimiseringsPatch(reden: string, nu: string) {
  return {
    titel: GEANONIMISEERDE_NAAM,
    inhoud: JSON.stringify({ geanonimiseerd: true, reden, op: nu }),
    html:
      "<p>De inhoud van dit rapport is gewist omdat de persoonsgegevens van de " +
      "bijhorende afname geanonimiseerd zijn.</p>",
    pdfBase64: null,
  };
}

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
