// ---------------------------------------------------------------------------
// server/instrument-inhoudsversie.ts
//
// De enige plaats waar bepaald wordt welk versienummer bij de inhoud van een
// vragenlijst hoort.
//
// WAAROM DIT BESTAAT
// Het versienummer van een instrument stond als vaste tekst in het databestand
// ("version": "1.0.0") en bewoog niet mee met de inhoud. Een beheerder kon via
// het vraagbeheer de tekst van een item wijzigen, en een ontwikkelaar kon een
// item toevoegen of verwijderen, zonder dat het nummer opschoof. Twee afnames
// met hetzelfde nummer konden dus een andere vragenlijst geweest zijn. Elke
// vergelijking over de tijd en elke normgroep die later opgebouwd wordt, was
// daardoor aanvechtbaar.
//
// AANPAK EN VERANTWOORDING
// Het versienummer krijgt een tweede deel dat rechtstreeks uit de inhoud
// gerekend wordt: een korte vingerafdruk. Voluit ziet een versie eruit als
// "1.0.0+i3f9a2c17".
//
//   - Het eerste deel blijft het handmatige nummer uit het databestand. Dat
//     blijft betekenis houden voor de mens: een grote herziening verhoogt daar
//     het hoofd- of tussennummer.
//   - Het tweede deel schuift automatisch op zodra er aan de inhoud van de
//     items geraakt wordt, en alleen dan.
//
// Waarom een vingerafdruk en geen teller die telkens een tellertje ophoogt?
// Een teller moet ergens bewaard worden. De inhoud van de vragenlijst komt uit
// twee bronnen: het databestand en de overschrijvingen die beheerders in de
// databank opslaan. Een teller die beide bronnen dekt, vraagt ofwel schrijven
// naar het databestand tijdens het draaien (dat kan niet, het bestand zit in de
// bundel), ofwel een nieuwe kolom in de databank. Een vingerafdruk vraagt geen
// van beide: hij wordt telkens opnieuw uit de inhoud zelf gerekend. Bijkomend
// voordeel: hij is achteraf narekenbaar. Wie een oude afname terugvindt, kan de
// vingerafdruk van vandaag ernaast leggen en zien of de vragenlijst intussen
// gewijzigd is. Een vergeten of teruggezette teller zou dat niet vertellen.
//
// WAT WEL EN NIET MEETELT
// Meetellen: alles wat de deelnemer te zien krijgt of wat de meting stuurt.
// Dus de secties met hun instructies, alle blokken en items in hun volgorde,
// de itemteksten in alle talen, de constructen en families waar items op
// afgebeeld worden, de verbindingsvragen, en de antwoordschalen met hun opties
// en labels. Ook de overschrijvingen die beheerders bovenop de itemteksten
// leggen, want die bepalen wat de deelnemer werkelijk leest.
//
// Niet meetellen: de naam en de omschrijving van het instrument, de
// standaardtaal, de intakevelden en de vertaalstatus. Dat zijn omhullende
// gegevens die de vragen zelf niet raken. In twijfelgevallen is de strenge
// keuze gemaakt: sectietitels en instructieteksten tellen wel mee, want zij
// sturen mee hoe iemand antwoordt.
//
// De volgorde waarin sleutels in het databestand staan, telt bewust niet mee.
// Sleutels omwisselen zonder de inhoud te raken is zuiver cosmetisch en mag de
// vingerafdruk niet doen verspringen. De volgorde van blokken, items en
// antwoordopties telt wel mee, want dat is de volgorde van afname.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

/**
 * Zet een willekeurige waarde om naar een tekst waarin de volgorde van
 * objectsleutels geen rol speelt. Lijsten houden hun volgorde, want die is bij
 * blokken, items en antwoordopties inhoudelijk.
 */
function stabieleTekst(waarde: unknown): string {
  if (waarde === null || typeof waarde !== "object") return JSON.stringify(waarde) ?? "null";
  if (Array.isArray(waarde)) return `[${waarde.map(stabieleTekst).join(",")}]`;
  const sleutels = Object.keys(waarde as Record<string, unknown>).sort();
  const paren = sleutels.map(
    (s) => `${JSON.stringify(s)}:${stabieleTekst((waarde as Record<string, unknown>)[s])}`,
  );
  return `{${paren.join(",")}}`;
}

/** De velden van een instrumentdefinitie die de meting bepalen. */
function inhoudelijkeKern(definitie: any) {
  return {
    sections: definitie?.sections ?? null,
    responseScales: definitie?.responseScales ?? null,
    families: definitie?.families ?? null,
  };
}

/**
 * Overschrijvingen zoals het vraagbeheer ze bijhoudt, omgezet naar een vorm
 * die niet afhangt van de volgorde waarin de databank de rijen teruggeeft.
 */
function stabieleOverschrijvingen(
  overschrijvingen?: Map<string, Record<string, string>> | null,
): [string, [string, string][]][] {
  if (!overschrijvingen || overschrijvingen.size === 0) return [];
  return Array.from(overschrijvingen.entries())
    .map(
      ([itemId, perTaal]) =>
        [itemId, Object.entries(perTaal).sort((a, b) => a[0].localeCompare(b[0]))] as [
          string,
          [string, string][],
        ],
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** Lengte van de vingerafdruk in tekens. Kort genoeg om te lezen, lang genoeg
 *  om botsingen in de praktijk uit te sluiten. */
const VINGERAFDRUK_LENGTE = 8;

function sha256(tekst: string): string {
  return createHash("sha256").update(tekst, "utf8").digest("hex");
}

// De vragenlijst zelf verandert niet tijdens het draaien, de overschrijvingen
// wel. Daarom wordt de zware helft (het hele databestand doorlopen en hashen)
// per definitie-object eenmaal berekend en onthouden, en blijft er per oproep
// enkel een hash over twee korte teksten over.
const kernAfdrukPerDefinitie = new WeakMap<object, string>();

function kernAfdruk(definitie: any): string {
  if (definitie === null || typeof definitie !== "object") {
    return sha256(stabieleTekst(inhoudelijkeKern(definitie)));
  }
  const gekend = kernAfdrukPerDefinitie.get(definitie);
  if (gekend !== undefined) return gekend;
  const afdruk = sha256(stabieleTekst(inhoudelijkeKern(definitie)));
  kernAfdrukPerDefinitie.set(definitie, afdruk);
  return afdruk;
}

/**
 * De vingerafdruk van de inhoud van een vragenlijst: acht tekens, afgeleid uit
 * de items, de schalen en de actieve overschrijvingen.
 */
export function inhoudsVingerafdruk(
  definitie: any,
  overschrijvingen?: Map<string, Record<string, string>> | null,
): string {
  const grondstof = `${kernAfdruk(definitie)}|${stabieleTekst(stabieleOverschrijvingen(overschrijvingen))}`;
  return sha256(grondstof).slice(0, VINGERAFDRUK_LENGTE);
}

/**
 * Het volledige versienummer: het handmatige nummer uit het databestand,
 * gevolgd door de vingerafdruk van de inhoud.
 */
export function inhoudsVersie(
  definitie: any,
  overschrijvingen?: Map<string, Record<string, string>> | null,
): string {
  const basis = typeof definitie?.version === "string" && definitie.version.trim()
    ? definitie.version.trim()
    : "0.0.0";
  return `${basis}+i${inhoudsVingerafdruk(definitie, overschrijvingen)}`;
}

/** Het handmatige deel van een volledig versienummer, zonder vingerafdruk. */
export function basisVersieVan(volledigeVersie: string): string {
  const plus = volledigeVersie.indexOf("+i");
  return plus === -1 ? volledigeVersie : volledigeVersie.slice(0, plus);
}
