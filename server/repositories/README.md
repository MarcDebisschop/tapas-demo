# server/repositories/

Domein-repositories: de gefaseerde ontvlechting van `server/storage.ts`.

## Stand van zaken (26-07-2026)

Deze map bevat tien bestanden en 2.143 regels. Daarvan wordt op dit moment
**alleen `billers.ts` en `organisaties.ts` echt gebruikt.**

Dat vraagt uitleg, want de vorige versie van dit bestand beweerde dat
`DatabaseStorage` naar al deze functies delegeert. Dat was niet zo.
`server/storage.ts` importeerde niets uit deze map; nagegaan met
`grep -n "from \"./repositories" server/storage.ts`, wat geen enkele treffer gaf.
De bestanden waren dus KOPIEEN van de code in de god-module, niet extracties.
`server/rapport-registry.ts:5` benoemt dat ook: "een duplicaat in
repositories/rapporten.ts".

Twee kopieen van dezelfde logica is erger dan een lange module. Wie de
repository aanpast in de veronderstelling dat hij live is, verandert niets; wie
de storage aanpast, laat de kopie stil verouderen. Daarom is de aanpak vanaf nu:
**per cluster echt aansluiten en de kopie in `storage.ts` verwijderen**, niet
meer kopieen aanmaken.

| Bestand | Domein | Aangesloten |
|---|---|---|
| `billers.ts` | BillerEntiteiten | ja |
| `organisaties.ts` | Organisaties | ja |
| `afnames.ts` | Afnames, uitnodigingen, GDPR | nee, kopie |
| `credits.ts` | CreditSaldi, transacties, betalingen, facturen, creditnota's, KPIs | nee, kopie |
| `rapporten.ts` | Rapporten | nee, kopie |
| `deelnemers.ts` | Deelnemers, chatberichten, uitleg | nee, kopie |
| `sessies.ts` | Licenties, sessies, kringleden, studies | nee, kopie |
| `toegang.ts` | Beheerders, toegangen, tarieven, coach-accreditatie | nee, kopie |

De niet-aangesloten bestanden zijn NIET betrouwbaar: `storage.ts` is sinds hun
aanmaak gewijzigd (onder andere door de organisatie-scoping, die `listAfnames`
een verplichte scope gaf). Behandel ze als een startpunt om uit te vertrekken,
nooit als de waarheid. De waarheid staat in `storage.ts`.

## Architectuur

Elke repository exporteert standalone functies die `db` en `sqlite` importeren uit
`server/storage.ts`. De klasse `DatabaseStorage` in `storage.ts` delegeert er
naartoe met een eenregelige methode.

De kringverwijzing (`storage.ts` -> repository -> `storage.ts`) is opzettelijk en
veilig: de repositories lezen `db` en `sqlite` pas BINNEN hun functies, dus nadat
`storage.ts` ze heeft aangemaakt. Zouden ze die op moduleniveau uitlezen, dan
kregen ze `undefined`.

Hangt een cluster van een ander cluster af, geef de afhankelijkheid dan als
ARGUMENT mee in plaats van te importeren. Zie `listOrganisaties(saldoSync)`:
zonder die injectie zou de organisaties-repository de credits-repository moeten
importeren en dat wordt een echte kringverwijzing.

**De publieke interface blijft ongewijzigd.** Alle bestaande imports
(`import { storage } from "./storage"`) blijven werken. De repositories zijn een
intern implementatiedetail.

## Werkregels

- Nooit `storage.ts` verwijderen: dat is de publieke façade.
- Nooit rechtstreeks importeren vanuit routes; altijd via `storage`.
- Een cluster verhuizen betekent: aansluiten EN de kopie in `storage.ts`
  verwijderen. Blijft de kopie staan, dan heb je het probleem verdubbeld in
  plaats van opgelost.
- Verhuis enkel clusters met testdekking, en draai na elke verhuizing de
  volledige suite. `tests/spoor3-repositories.test.ts` test het gedrag van de
  verhuisde functies op een databank in het geheugen en controleert dat de
  delegatie ook echt bestaat.
- Bij twijfel: een kleine, bewezen stap in plaats van een grote.
