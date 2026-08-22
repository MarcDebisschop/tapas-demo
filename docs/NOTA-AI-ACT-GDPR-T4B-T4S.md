# Classificatienota AI Act en GDPR

Voor T4P Business Kompas en T4Students Studiekompas.
Aard van dit document: interne classificatienota, opgesteld door de ontwikkelaar.
Dit is **geen juridisch advies**. De nota legt vast welke inschatting het
platform maakt, op welke gronden, en welke punten juridische bevestiging vragen.

---

## 1. Is er sprake van een AI-systeem?

Beide instrumenten rekenen **deterministisch**. Er is geen model dat uit data
leert, geen gewichten die getraind zijn, geen voorspelling en geen generatieve
component in de scoring. Dezelfde antwoorden leveren altijd exact hetzelfde
rapport: dat is in de code afdwingbaar en wordt door de testreeks vastgehouden.

De rapporttekst bestaat uit vaste teksten en vaste samenstellingsregels
(`server/data/t4students-rapportteksten.json`,
`shared/onderbouwing-t4professional.ts`, de contractgeneratoren). Er wordt bij
het genereren van een rapport geen taalmodel aangeroepen.

Onder de definitie van AI-systeem in de AI-verordening
(Verordening (EU) 2024/1689) is het bepalende kenmerk dat een systeem output
afleidt op een manier die verder gaat dan een louter door mensen gedefinieerde
regel. Deze instrumenten zijn regelgebaseerd en door mensen vastgelegd. **De
inschatting is daarom: geen AI-systeem in de zin van de verordening.**

**Punt voor juridische bevestiging.** Deze inschatting hangt af van de
interpretatie van "beyond basic data processing" in de definitie en van de
richtsnoeren die de Commissie daarover uitbrengt. De inschatting moet opnieuw
bekeken worden zodra er ergens in de keten een lerend of generatief onderdeel
komt. Concreet: zodra rapportteksten door een taalmodel gegenereerd of
gepersonaliseerd zouden worden, verschuift het antwoord.

---

## 2. Wat als het toch als AI-systeem zou gelden?

Dan is de vraag welke risicocategorie. Twee bijlage III-categorieën zijn
relevant en beide zijn hier bewust uitgesloten door het gebruiksdoel:

| Categorie bijlage III | Van toepassing? | Waarom |
|---|---|---|
| Werkgelegenheid, personeelsbeheer, toegang tot zelfstandige arbeid (aanwerving, selectie, evaluatie, promotie, beëindiging) | **Nee, mits het uitsluitingsbeleid wordt nageleefd** | T4P Business Kompas mag niet voor selectie, aanwerving, promotie, ontslag of geschiktheidsbeoordeling worden gebruikt. Dat staat in de handleiding en, sinds deze ronde, ook uitdrukkelijk op het vertaalblad in het rapport zelf. |
| Onderwijs en beroepsopleiding (toegang, toewijzing, evaluatie van leerresultaten) | **Nee, mits het uitsluitingsbeleid wordt nageleefd** | T4Students bepaalt geen toegang, kent geen studierichting toe en evalueert geen leerresultaten. Het rapport is een reflectiedocument voor de jongere zelf. |

**Dit is de scharnierende vaststelling van deze nota.** De classificatie hangt
niet af van de techniek maar van het gebruik. Wordt T4P Business Kompas toch bij
een aanwervingsbeslissing betrokken, of gebruikt een school T4Students om
richtingen toe te wijzen, dan verandert de categorie en gelden er zware
verplichtingen. Het uitsluitingsbeleid is dus geen tekstuele voorzorg maar de
grond van de classificatie zelf, en het moet contractueel bij organisaties worden
afgedwongen, niet alleen in het rapport worden vermeld.

---

## 3. GDPR: grondslag en aard van de gegevens

| Onderwerp | T4P Business Kompas | T4Students Studiekompas |
|---|---|---|
| Aard van de gegevens | zelfrapportage over werkstijl en energie | zelfrapportage over studeren, interesse en energie |
| Bijzondere categorieën (art. 9) | niet bedoeld; de energievraag komt in de buurt van welzijn en wordt daarom uitdrukkelijk niet als gezondheidsgegeven behandeld of geïnterpreteerd | zelfde, met extra terughoudendheid wegens de leeftijd |
| Grondslag | toestemming van de deelnemer, vastgelegd per afname (`consentGiven`, `consentScope`) | toestemming van de jongere, vastgelegd per afname |
| Doelbinding | ontwikkeling en gesprek; elk ander doel vraagt een nieuwe grondslag | reflectie en studiekeuzegesprek |
| Geautomatiseerde besluitvorming (art. 22) | niet van toepassing: het rapport is geen besluit en heeft geen rechtsgevolg | niet van toepassing, om dezelfde reden |
| Bewaring | zolang het dossier actief is; verwijdering op verzoek | zelfde |
| Encryptie at rest | vandaag **niet actief** wanneer `TAPAS_DB_SLEUTEL` niet gezet is; de hook draait dan als no-op, en de server logt dat bij het opstarten (zie `docs/GDPR-FIX6-encryptie-at-rest.md`) | zelfde |

**De rij over art. 22 verdient nuance.** Het rapport wordt volledig automatisch
opgesteld. Dat is geen geautomatiseerd besluit zolang er geen beslissing aan
vasthangt. Zodra een organisatie het rapport in een beslissingsproces legt,
ontstaat de vraag alsnog, en dan is de eerdere uitsluiting in §2 de enige
bescherming. Ook hier: het gebruik bepaalt de juridische positie.

---

## 4. Extra aandacht bij T4Students wegens de onderwijscontext

1. **Leeftijd.** De doelgroep is 17 tot 25 jaar. Voor deelnemers onder de 18 moet
   nagegaan worden of toestemming van de jongere volstaat dan wel of ouderlijke
   betrokkenheid vereist is. In België geldt geen vaste leeftijdsgrens voor
   toestemming buiten de context van diensten van de informatiemaatschappij; dit
   punt vraagt juridische bevestiging en is vandaag niet in de code afgedwongen.
2. **Machtsverhouding.** Als een school de afname organiseert, is toestemming
   snel niet meer vrij gegeven. Aanbeveling: de afname nooit verplicht maken en
   het rapport in eerste instantie aan de jongere zelf geven, niet aan de school.
3. **Geen doorstroom naar dossiers.** Het rapport hoort niet in een leerlingdossier
   dat de jongere niet beheert.
4. **Prototypestatus vermelden.** Het rapport zegt zelf dat het instrument in
   opbouw is en dat er geen betrouwbaarheidscijfers of normgroep zijn. Die
   vermelding moet ook in elk aanbod of contract naar scholen staan.

---

## 5. Wat vandaag geregeld is en wat niet

**Geregeld**

- Toestemming per afname, met vastgelegde scope.
- Deterministische scoring, geen taalmodel in de rapportketen.
- Claimgrenzen in de rapporttekst zelf, op één plaats gedefinieerd.
- Uitsluiting van selectie, geschiktheid en voorspelling, in handleiding en
  rapport.
- Doorlooptijd en tempo als technische kwaliteitsregels, uitdrukkelijk niet als
  persoonskenmerk.

**Niet geregeld, en dat hoort hier eerlijk te staan**

- Encryptie at rest is inactief zolang de sleutel niet gezet is.
- Er is geen contractuele afdwinging van het uitsluitingsbeleid richting
  organisaties; vandaag is het beleid tekst, geen verplichting.
- Er is geen leeftijdscontrole in de code die deelname onder 18 aan een extra
  toestemmingsstap koppelt.
- Er is geen bewaartermijn in dagen vastgelegd; er is een verwijderprocedure op
  verzoek.
- Deze nota is niet juridisch nagekeken.
