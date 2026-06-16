# Memo aan de boekhouder — TaPas Platform (credits & facturatie)

**Van:** Marc Debisschop (TaPasCity / 2BQ CONSULT)
**Datum:** 13 juni 2026
**Betreft:** Boekhoudkundige werking van het TaPas Platform, btw-classificatie en openstaande vragen ter validatie

---

## 1. Waar gaat dit over

Het TaPas Platform verkoopt **credits**. Eén credit geeft recht op het genereren van één professioneel gedragsprofiel (T4P Business Kompas). Een klant koopt credits per pakket, betaalt online, en verbruikt die credits later wanneer hij effectief profielen aanmaakt. Het platform maakt automatisch facturen aan en is voorbereid op verplichte e-facturatie via Peppol.

De facturerende entiteit is op dit moment **2BQ CONSULT** (BTW BE0810.464.001, Zandstraat 85, 2110 Wijnegem, Peppol-ID 0208:0810464001).

---

## 2. De kernvraag die ik aan u wil voorleggen

**Hoe moeten we de btw op de verkoop van credits behandelen?**

Mijn werkhypothese — en zo is het platform vandaag gebouwd — is dat een credit een **voucher voor één enkel doel ("single-purpose voucher")** is:

- Een credit kan maar voor één welbepaalde dienst worden ingewisseld (het genereren van één T4P-profiel).
- Het btw-tarief en de plaats van de dienst staan op het moment van verkoop al vast.
- Daarom rekenen we de **btw aan bij de aankoop/oplading van de credits** (21%), niet pas bij het verbruik. ([Rechtenkrant — btw-behandeling vouchers](https://rechtenkrant.be/hoe-zit-het-met-de-btw-behandeling-van-vouchers/), [Grant Thornton — btw op vouchers](https://www.grantthornton.be/the-field/articles/btw-op-vouchers-toegelicht/))

Als de credits daarentegen voor méér dan één soort dienst inwisselbaar zouden zijn, spreken we van een voucher voor meervoudig gebruik ("multi-purpose voucher") en valt de btw pas bij de inwisseling. Vandaag is er maar één credittype en één bestemming, dus de single-purpose-behandeling lijkt correct — **maar ik wil dit graag formeel door u bevestigd zien vóór livegang.**

**Concreet gevraagd:**
1. Bevestig dat de single-purpose-voucherbehandeling (btw bij aankoop, 21%) hier de juiste is.
2. Bevestig het toe te passen btw-tarief (wij gaan uit van 21% voor deze advies-/profileringsdienst).
3. Geef aan of een eventuele latere terugbetaling/annulatie via creditnota volstaat, of dat u een specifieke btw-correctieboeking verwacht.

---

## 3. Wat het platform vandaag al voor u klaarzet

| Onderdeel | Status | Toelichting |
|---|---|---|
| **Facturen** | ✅ Aanwezig | Doorlopende, unieke nummering per jaar (vb. `2BQ-2026-0001`). Bedragen excl. btw, btw-bedrag, incl. btw. Onveranderlijk na aanmaak. |
| **Creditnota's** | ✅ Nieuw toegevoegd | Eigen doorlopende reeks (`2BQ-CN-2026-0001`), spiegelt de factuur met negatieve bedragen, verwijst naar de oorspronkelijke factuur, met reden. Eén creditnota per factuur (dubbele creditnota's worden geweigerd). |
| **Betalingen** | ✅ Aanwezig | Elke betaling heeft status (open / betaald / mislukt), bedrag excl./incl. btw, methode en koppeling aan factuur. Credits worden enkel opgeladen bij een effectief bevestigde betaling. |
| **Boekhoudexport** | ✅ Nieuw toegevoegd | Eén export (CSV met `;`-scheiding + BOM, opent meteen correct in Excel) met alle facturen én creditnota's: nummer, datum, klant, klant-btw, bedrag excl., btw-tarief, btw-bedrag, bedrag incl., munt, kanaal. |
| **Peppol / e-facturatie** | ✅ Voorbereid | Elke factuur en creditnota kan als gestructureerd Peppol-document worden opgehaald. |
| **Bewaring** | ⚠️ Aandachtspunt | Zie sectie 4. |

---

## 4. Wettelijke aandachtspunten waarop ik uw advies wil

1. **Verplichte e-facturatie (Peppol) — sinds 1 januari 2026.** Gestructureerde elektronische facturatie tussen Belgische btw-plichtigen is verplicht sinds 1 januari 2026. Het platform is hierop voorbereid. ([Peppol.nl](https://www.peppol.nl/nl/nieuws/verplichte-e-facturatie-peppol-belgie-vanaf-2026), [e-invoice.be](https://e-invoice.be/blog/peppol-verplicht)) → **Vraag:** is onze Peppol-aansluiting (verzendkanaal) bij u of bij een dienstverlener correct geregeld?

2. **Bewaarplicht: 10 jaar.** Facturen en boekhoudkundige stukken moeten **10 jaar** bewaard worden (art. 60 Btw-Wetboek; art. III.86 WER), te rekenen vanaf 1 januari na het afsluiten van het boekjaar. ([Sayli](https://sayli.be/blog/nl/tva/hoe-lang-facturen-bewaren-belgie), [Accountable](https://www.accountable.eu/nl-be/blog/facturen-bijhouden/)) → De platformdata bevat de factuurgegevens; we voorzien dat deze 10 jaar bewaard blijven, los van de veel kortere bewaartermijn voor de psychometrische antwoorden (zie GDPR).

3. **Verplichte factuurvermeldingen.** Het platform vult de wettelijk verplichte vermeldingen automatisch in (datum, uniek volgnummer, identiteit + btw-nummer van uitreiker en klant, omschrijving, bedrag excl., btw-tarief, btw-bedrag, totaal incl.). ([FACTURYS](https://facturys.eu/nl/verplichte-vermeldingen-factuur), [Informer](https://www.informer.eu/nl-be/factureren/factuur-opstellen)) → **Vraag:** ontbreekt er volgens u nog een verplichte vermelding voor onze specifieke dienst?

---

## 5. Samengevat — wat ik van u nodig heb

- [ ] Bevestiging btw-behandeling credits (single-purpose voucher, btw bij aankoop, 21%).
- [ ] Bevestiging of de creditnota-aanpak volstaat voor btw-correcties bij annulatie/terugbetaling.
- [ ] Bevestiging dat onze Peppol-aansluiting administratief in orde is.
- [ ] Eventuele bijkomende verplichte factuurvermelding die u nog mist.
- [ ] Het rekeningschema / grootboekrekeningen waarop u de verkopen, de btw en de creditnota's geboekt wil zien (dan stem ik de boekhoudexport daarop af).

Zodra u deze punten bevestigt, kan ik de export- en boekingslogica definitief vastzetten.

Met dank,
Marc Debisschop

---

*Bronnen geraadpleegd op 13 juni 2026. Dit memo is een werkdocument ter voorbereiding van uw advies en vervangt geen formeel fiscaal of boekhoudkundig advies.*
