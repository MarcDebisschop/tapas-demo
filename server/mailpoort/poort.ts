// =============================================================================
// server/mailpoort/poort.ts
// -----------------------------------------------------------------------------
// De poort zelf: navraag plus oordeel, met een korte geheugensteun.
//
// Elke verzending die meer dan één bericht omvat, komt hier eerst langs. De
// poort geeft geen advies maar een oordeel: bruikbaar of niet, met de bezwaren
// en met wat de verzender zelf kan doen.
//
// WAAROM EEN GEHEUGENSTEUN VAN EEN MINUUT. Een batch van tweehonderd rijen mag
// niet tweehonderd keer bij de leverancier gaan vragen of de sleutel nog geldt.
// Eén keer per minuut per afzender volstaat: binnen die minuut verandert een
// rekening niet, en de blokkeerlijst wordt per ontvanger apart nagevraagd en
// staat bewust buiten de geheugensteun.
// =============================================================================

import { haalAccount, haalAfzenders, haalBlokkering, sleutel } from "./brevo";
import {
  beoordeelOntvanger,
  beoordeelWeg,
  type Ontvangerkeuring,
  type Wegkeuring,
} from "./keuring";

const GELDIG_MS = 60_000;
const onthouden = new Map<string, { tot: number; keuring: Wegkeuring }>();

function smtpAanwezig(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}

/**
 * Keurt de weg naar buiten voor deze afzender.
 *
 * Met vers op true wordt de geheugensteun overgeslagen. Dat is wat de knop in
 * het beheerscherm doet: wie na een wijziging opnieuw kijkt, wil het antwoord
 * van nu en niet dat van een halve minuut geleden.
 */
export async function keurVerzendweg(
  afzender: string,
  opties?: { vers?: boolean },
): Promise<Wegkeuring> {
  const sleutelAanwezig = !!sleutel();
  const smtp = smtpAanwezig();
  const kern = `${afzender}|${sleutelAanwezig ? "k" : "-"}|${smtp ? "s" : "-"}`;

  if (!opties?.vers) {
    const eerder = onthouden.get(kern);
    if (eerder && eerder.tot > Date.now()) return eerder.keuring;
  }

  // Zonder sleutel valt er bij de leverancier niets na te vragen; het oordeel
  // komt dan uit de aanwezigheid van een mailserver alleen.
  if (!sleutelAanwezig) {
    const keuring = beoordeelWeg({
      sleutelAanwezig,
      smtpAanwezig: smtp,
      gevraagdeAfzender: afzender,
    });
    onthouden.set(kern, { tot: Date.now() + GELDIG_MS, keuring });
    return keuring;
  }

  const [account, afzenders] = await Promise.all([haalAccount(), haalAfzenders()]);
  const keuring = beoordeelWeg({
    sleutelAanwezig,
    smtpAanwezig: smtp,
    gevraagdeAfzender: afzender,
    account,
    afzenders,
  });
  onthouden.set(kern, { tot: Date.now() + GELDIG_MS, keuring });
  return keuring;
}

/** Vergeet wat er onthouden is. Nodig na het wijzigen van een blokkering. */
export function vergeetKeuring(): void {
  onthouden.clear();
}

/**
 * Keurt een lijst ontvangers op de blokkeerlijst van de leverancier.
 *
 * Zonder sleutel is er niets na te vragen en blijft elke ontvanger onvastgesteld.
 * Dat is eerlijker dan groen tonen: wie geen leverancier heeft, weet niets over
 * bezorging.
 *
 * De navragen lopen in groepjes van vijf. Honderd adressen tegelijk vragen is de
 * snelste manier om bij de leverancier tegen een snelheidsgrens te lopen, en dan
 * staat de batch stil door de controle en niet door een echt bezwaar.
 */
export async function keurOntvangers(emails: string[]): Promise<Ontvangerkeuring[]> {
  const uniek = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (!sleutel()) {
    return uniek.map((e) => beoordeelOntvanger(e, null));
  }
  const uit: Ontvangerkeuring[] = [];
  const groep = 5;
  for (let i = 0; i < uniek.length; i += groep) {
    const deel = uniek.slice(i, i + groep);
    const antwoorden = await Promise.all(deel.map((e) => haalBlokkering(e)));
    deel.forEach((e, j) => uit.push(beoordeelOntvanger(e, antwoorden[j])));
  }
  return uit;
}
