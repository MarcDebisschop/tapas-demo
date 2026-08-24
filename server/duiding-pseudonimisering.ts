// =============================================================================
// server/duiding-pseudonimisering.ts - Defensieve poort vóór doorgifte aan Gemini
//
// Wettelijk kader: AVG art. 5.1.c (minimalisatie), art. 32 (beveiliging) en
// art. 44 e.v. (doorgifte buiten de EER). De AI-duiding stuurt profieldata naar
// Google (Gemini). De payload-bouwers sturen bewust enkel `contract.sections`
// mee en nooit `contract.participant`, maar dat was tot nu toe enkel een
// afspraak in de code: één uitbreiding van een payload-bouwer volstond om
// stilzwijgend namen of e-mailadressen mee te sturen.
//
// Deze module maakt die afspraak aantoonbaar. `keurPayloadGoed` is een
// defensieve laatste controle: staat er iets identificeerbaars in de payload,
// dan gaat de doorgifte NIET door en valt het rapport terug op de statische
// tekst. Falen is dus veilig - een afname blokkeert nooit, maar er verlaat ook
// nooit een naam of e-mailadres het systeem.
//
// Wat we controleren:
//   1. Sleutelnamen die op persoonsgegevens duiden (participant, name, email,
//      company, role, respondentCode, ...). respondentCode staat er expliciet
//      bij: die code bevat de initialen van de deelnemer en is dus geen
//      pseudonieme sleutel maar een indirect identificerend gegeven.
//   2. Alles wat op een e-mailadres lijkt.
//   3. De concrete waarden uit contract.participant: de naam (en losse
//      naamdelen), de respondentCode, en bedrijf/functie zodra die
//      onderscheidend genoeg zijn. Ook als de sleutel anders heet, herkennen we
//      de waarde dus nog.
//
// Een valse weigering is niet erg: het rapport valt dan terug op de statische
// tekst, precies zoals wanneer er geen API-sleutel is. Een gemiste weigering
// zou wel erg zijn. De poort is daarom bewust streng.
//
// Wat we NIET controleren: scores, ankers en regie-prompts. Dat zijn de
// gegevens die de duiding juist nodig heeft en ze zijn niet identificerend.
// =============================================================================

// Sleutelnamen die nooit in een AI-payload thuishoren. Bewust in het Nederlands
// én het Engels, want de contracten zijn Engelstalig en de prompts Nederlands.
export const VERBODEN_SLEUTELS = [
  "participant",
  "deelnemer",
  "respondentcode",
  "respondent_code",
  "name",
  "naam",
  "voornaam",
  "achternaam",
  "email",
  "e-mail",
  "emailadres",
  "deelnemeremail",
  "company",
  "bedrijf",
  "organisatie",
  "role",
  "functie",
  "ouder_naam",
  "oudernaam",
  "ouder_email",
  "ouderemail",
  "consentip",
  "consent_ip",
  "useragent",
  "user_agent",
] as const;

// Bewust ruim: elke tekst die op een adres lijkt is een reden om te weigeren.
const EMAIL_PATROON = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export interface KeuringsResultaat {
  ok: boolean;
  redenen: string[];
}

// Zoekt naar `"sleutel"` als JSON-sleutel of als los woord in de prompt.
function bevatSleutel(payload: string, sleutel: string): boolean {
  const laag = payload.toLowerCase();
  return laag.includes(`"${sleutel}"`) || laag.includes(`${sleutel}:`);
}

// Woorden korter dan dit tellen niet mee als naamdeel: op "Jan" of "Wil" zou
// elke gewone zin matchen en zou de duiding stil altijd terugvallen.
const MINIMALE_NAAMDEELLENGTE = 4;

// Bedrijf en functie worden pas op WAARDE vergeleken als ze onderscheidend zijn.
// Reden: een functie als "Coach" of een bedrijf als "Aha" komt ook in gewone
// duidingsproza voor ("Coach-atlas"), waardoor de poort ten onrechte zou
// weigeren. Op SLEUTELnaam ("company"/"role") blijven ze onvoorwaardelijk
// verboden, en dat is het pad waarlangs contractdata in een payload belandt.
const MINIMALE_ONDERSCHEIDENDE_LENGTE = 8;

function isOnderscheidend(waarde: string): boolean {
  return waarde.includes(" ") || waarde.length >= MINIMALE_ONDERSCHEIDENDE_LENGTE;
}

// Zoekt de waarde als heel woord, niet als deelstring: anders zou een naam als
// "Ard" ook in "aardig" matchen.
function bevatAlsWoord(payload: string, waarde: string): boolean {
  const ontsnapt = waarde.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${ontsnapt}([^\\p{L}\\p{N}]|$)`, "iu").test(payload);
}

// De waarden die we naast de sleutelnamen ook op inhoud herkennen. De volledige
// naam en de respondentCode altijd (de code bevat de initialen van de
// deelnemer), losse naamdelen vanaf vier letters, bedrijf en functie enkel
// wanneer ze onderscheidend genoeg zijn.
export function identificerendeWaarden(contract: any): string[] {
  const p = contract?.participant ?? {};
  const tekst = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const naam = tekst(p.name);
  const waarden = new Set<string>();

  if (naam) {
    waarden.add(naam);
    for (const deel of naam.split(/\s+/)) {
      if (deel.length >= MINIMALE_NAAMDEELLENGTE) waarden.add(deel);
    }
  }
  const code = tekst(p.respondentCode);
  if (code.length >= MINIMALE_NAAMDEELLENGTE) waarden.add(code);
  for (const waarde of [tekst(p.company), tekst(p.role)]) {
    if (waarde && isOnderscheidend(waarde)) waarden.add(waarde);
  }
  return Array.from(waarden);
}

/**
 * Keurt een AI-payload vóór verzending. `ok: false` betekent: niet verzenden.
 * De redenen zijn bedoeld om gelogd te worden, niet om aan een deelnemer te
 * tonen; ze benoemen het soort probleem, niet de gevonden waarde zelf (het log
 * mag geen tweede kopie van de persoonsgegevens worden).
 */
export function keurPayloadGoed(payload: string, contract: any): KeuringsResultaat {
  const redenen: string[] = [];

  if (typeof payload !== "string" || payload.trim().length === 0) {
    return { ok: false, redenen: ["lege payload"] };
  }

  for (const sleutel of VERBODEN_SLEUTELS) {
    if (bevatSleutel(payload, sleutel)) redenen.push(`verboden sleutel: ${sleutel}`);
  }

  if (EMAIL_PATROON.test(payload)) redenen.push("payload bevat een e-mailpatroon");

  for (const waarde of identificerendeWaarden(contract)) {
    if (bevatAlsWoord(payload, waarde)) {
      redenen.push("payload bevat een identificerende waarde uit participant");
      break;
    }
  }

  return { ok: redenen.length === 0, redenen };
}

/**
 * Register van de feitelijke doorgifte, voor het verwerkingsregister (AVG art.
 * 30). Geeft per instrument terug of live-duiding aan staat en dus of er
 * persoonsprofieldata naar Google gaat. De aanroeper levert de instrumentenlijst
 * en de vlagfunctie aan zodat deze module vrij blijft van afhankelijkheden en
 * los te testen is.
 *
 * BELANGRIJK: live-duiding aanzetten is een verwerkingsbeslissing, geen
 * technische knop. Vereist vóór activatie:
 *   - een verwerkersovereenkomst (DPA) met Google voor de Gemini API;
 *   - een doorgiftetoets (AVG art. 44 e.v.): de Gemini API verwerkt buiten de
 *     EER, en het EU-US Data Privacy Framework staat sinds 2026 onder druk;
 *   - opname in het verwerkingsregister van TaPasCity (Wijnegem) mét doel,
 *     bewaartermijn en categorieen betrokkenen.
 * Daarom staat de vlag per instrument standaard UIT.
 */
export interface DoorgifteRegel {
  instrumentId: string;
  label: string;
  liveDuidingAan: boolean;
  /** Hangt het AI-duidingpad werkelijk in de rapportketen van dit instrument? */
  inRapportketen: boolean;
  /** Alleen waar wanneer de vlag aan staat EN het pad in de keten hangt. */
  doorgifteMogelijk: boolean;
  ontvanger: string;
  land: string;
  grondslagVereist: string;
}

/**
 * Bouwt het register. Een instrument waarvan de vlag aan staat maar waarvan het
 * AI-pad niet in de rapportketen hangt, geeft geen data door. Dat verschil hoort
 * in het register te staan: anders meldt het een doorgifte die niet gebeurt.
 */
export function bouwDoorgifteRegister(
  instrumenten: Array<{ id: string; label: string; inRapportketen?: boolean }>,
  vlagAan: (instrumentId: string) => boolean,
): DoorgifteRegel[] {
  return instrumenten.map((i) => {
    const aan = vlagAan(i.id);
    const inKeten = i.inRapportketen !== false;
    return {
      instrumentId: i.id,
      label: i.label,
      liveDuidingAan: aan,
      inRapportketen: inKeten,
      doorgifteMogelijk: aan && inKeten,
      ontvanger: "Google (Gemini API)",
      land: "buiten de EER",
      grondslagVereist: "DPA met Google + doorgiftetoets (AVG art. 44 e.v.)",
    };
  });
}
