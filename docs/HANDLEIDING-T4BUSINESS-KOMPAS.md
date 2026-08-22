# Handleiding T4P Business Kompas

Instrument-id `t4p-business-kompas`, versie 1.0.0.
Status van dit document: formele handleiding bij de huidige codebase, bedoeld
voor coaches, opdrachtgevers en externe meelezers. Alles wat hier staat, is
nagekeken in de code; wat niet in de code zit, staat hier als openstaand punt.

---

## 1. Wat dit instrument is

Het T4P Business Kompas is een **beschrijvend, ipsatief gelezen ontwikkel- en
gespreksinstrument** voor werkende volwassenen. Het brengt in kaart hoe iemand
zichzelf op dit moment beschrijft op drie families van constructen, en hoeveel
energie die beschreven manier van werken vandaag kost of geeft.

Het instrument is geen test in de klassieke zin. Er is geen normgroep, geen
vergelijkingsgroep en geen empirisch geijkt afkappunt. De uitkomsten zijn
**gesprekssignalen**: ze zijn bedoeld om samen met de deelnemer te lezen, te
toetsen en aan te vullen met context, observatie en gesprek.

**Validiteit is gebruiks- en contextgebonden.** Er bestaat geen "algemene
validiteit" van dit instrument. Elke uitspraak over bruikbaarheid geldt voor een
bepaald gebruiksdoel, in een bepaalde context, bij een bepaalde populatie. Buiten
het hier beschreven gebruiksdoel is het instrument niet verantwoord.

---

## 2. Toegestaan en niet toegestaan gebruik

**Toegestaan**

- Ontwikkelgesprek, loopbaangesprek, coachtraject.
- Zelfreflectie van de deelnemer, met begeleiding.
- Teamgesprek over samenwerking, wanneer elke deelnemer haar eigen rapport zelf
  inbrengt en toestemming geeft.
- Het benoemen van energiebronnen en energievreters als aanzet tot werkafspraken.

**Niet toegestaan**

- Selectie, aanwerving, promotie, ontslag of enige andere
  geschiktheidsbeslissing.
- Vergelijking tussen personen, rangschikking van kandidaten, "beste fit".
- Uitspraken over intelligentie, potentieel, persoonlijkheidspathologie of
  gezondheid.
- Voorspelling van prestatie, verloop of succes.
- Gebruik van cijfers als exacte meetwaarde, percentiel of benchmark. Die
  bestaan hier niet.

De rapporttekst zegt dit ook zelf: de vaste claimgrenzen staan als één bron in
`server/t4p/kompas-contract.ts` (`LEZING_BINNEN_PERSOON`,
`LEZING_GESPREKSSIGNAAL`, `LEZING_PER_AANBIEDING`, `LEZING_DRIVERSIGNAAL`) en
worden in de hoofdstukken Drivers, Talent-foci en Talent-versnellers afgedrukt.

---

## 3. Opbouw van de afname

| Onderdeel | Aantal |
|---|---|
| Blokken (forced choice, most/least) | 34 |
| Items totaal | 136 |
| Constructen | 16 |
| Energievraag | per item bij Drivers, per blok bij de talentfamilies |
| Energieschaal | -2 tot +2 |
| Deel 2 (organisatieverbondenheid) | 4 vragen |

Per blok kiest de deelnemer welk item het meest en welk item het minst bij haar
past. Dat maakt de score **ipsatief**: de constructen worden binnen de persoon
tegen elkaar afgewogen. Een ipsatieve score zegt iets over de rangorde binnen
deze persoon en niets over het niveau in vergelijking met anderen. Dat is de
reden waarom normatieve vergelijking niet alleen ongewenst maar ook technisch
onmogelijk is.

Bron: `server/data/instrument.json`, scoring in `server/scoring.ts`.

---

## 4. Constructtabel

Aantal aanbiedingen = hoe vaak het construct in de 34 blokken voorkomt en dus
gekozen of afgewezen kan worden. `net = most - least`.

| Familie | Construct | Aanbiedingen | Scoretype | Interpretatieniveau | Mag wel geconcludeerd worden | Mag niet geconcludeerd worden |
|---|---|---|---|---|---|---|
| Drivers | Be Perfect | 8 | ipsatief, net + energie per item | binnen persoon | "deze werkstijl komt in de zelfbeschrijving vaak terug en kost vandaag energie" | "deze persoon is perfectionistisch van aard", stress- of gezondheidsdiagnose |
| Drivers | Be Strong | 8 | idem | binnen persoon | idem | idem |
| Drivers | Hurry Up | 8 | idem | binnen persoon | idem | idem |
| Drivers | Please Others | 8 | idem | binnen persoon | idem | idem |
| Drivers | Try Hard | 8 | idem | binnen persoon | idem | idem |
| Talent-foci | Innovatie | 8 | ipsatief, net + energie per blok | binnen persoon | "hier gaat de aandacht vandaag naartoe" | "hier is deze persoon getalenteerder dan anderen" |
| Talent-foci | Inter-relationeel | 8 | idem | binnen persoon | idem | idem |
| Talent-foci | Operationeel | 8 | idem | binnen persoon | idem | idem |
| Talent-foci | Strategie | 8 | idem | binnen persoon | idem | idem |
| Talent-foci | TaPas-Beeld | 8 | idem | binnen persoon | idem | idem |
| Talent-versnellers | Analyse | 9 | ipsatief, net per aanbieding + energie per blok | binnen persoon | "dit is een route waarlangs talent bij deze persoon tot resultaat komt" | vaardigheidsniveau, competentiescore, geschiktheid |
| Talent-versnellers | Coaching | 10 | idem | binnen persoon | idem | idem |
| Talent-versnellers | Constructief onderscheidend | 10 | idem | binnen persoon | idem | idem |
| Talent-versnellers | Faciliteren | 10 | idem | binnen persoon | idem | idem |
| Talent-versnellers | Impact | 9 | idem | binnen persoon | idem | idem |
| Talent-versnellers | Resultaatgericht | 8 | idem | binnen persoon | idem | idem |

**Ongelijke aanbieding bij de versnellers.** Drivers en Talent-foci worden elk
precies acht keer aangeboden; de versnellers niet (8 tot 10). Een construct dat
vaker wordt aangeboden, kan een hogere ruwe nettoscore halen zonder dat het
sterker in de zelfbeschrijving zit. De rangorde binnen een familie staat daarom
op **nettoscore per aanbieding** (`netPerAanbieding = net / aanbiedingen`), niet
op de ruwe nettoscore. De technische bijlage van het rapport toont die grootheid
op drie decimalen naast de ruwe score, zodat de ordening na te rekenen is.

Dit lost de ongelijkheid in de **ordening** op. Het lost de ongelijkheid in de
**itembank** niet op: een herbalancering van de itembank zelf blijft een
openstaand punt (zie §8).

---

## 5. Volledigheid en samenhang van de invulling

De index die eerder "Invulzorgvuldigheid" heette, heeft nu één canonieke naam:
**Volledigheid en samenhang van de invulling** (`shared/invulling-index.ts`, ook
in het Frans, Engels, Spaans en Russisch).

Deze index is **geen betrouwbaarheidsmaat** en **geen psychometrische
coëfficiënt**. Hij beschrijft alleen deze ene invulling: hoe volledig er is
geantwoord en hoe goed de energieantwoorden bij de keuzes aansluiten. De vaste
zin daarover staat als `INVULLING_GEEN_BETROUWBAARHEID` op één plaats en wordt in
het rapport afgedrukt.

Samenstelling (`server/scoring.ts`, `consistencyMetrics`):

| Component | Gewicht |
|---|---|
| Keuzeparen volledig (most en least gezet) | 40% |
| Energieantwoorden aanwezig | 30% |
| Aansluiting tussen driverkeuze en energieantwoord | 20% |
| Spreiding in de energieantwoorden | 10% |

De woordlabels: 80 of hoger is hoog, 60 tot 80 is middelmatig, onder 60 is laag.
De term "interne consistentie" wordt hier bewust nergens gebruikt, ook niet in
interne toelichting: die term hoort bij betrouwbaarheidsonderzoek en dat is niet
wat deze index doet.

---

## 6. Classificatie van alle drempels en labels

Elke grens in dit instrument valt in één van vier soorten:

- **Empirisch onderbouwd**: berekend of geijkt op echte afnamedata.
- **Ontwerpconventie**: door de ontwikkelaar gekozen grens, verdedigbaar maar
  niet empirisch geijkt.
- **Interpretatieve heuristiek**: leesregel die een cijfer in woorden omzet.
- **Technische kwaliteitsregel**: regel over de data, niet over de persoon.

| Grens of label | Waarde | Waar | Soort |
|---|---|---|---|
| Volledigheid en samenhang: hoog | >= 80 | `shared/invulling-index.ts` | Ontwerpconventie |
| Volledigheid en samenhang: middelmatig | >= 60 | `shared/invulling-index.ts` | Ontwerpconventie |
| Gewichten 40/30/20/10 in de index | vast | `server/scoring.ts` | Ontwerpconventie |
| Energiestatus "geeft" | gemiddelde > +0,25 | `server/t4p/kompas-contract.ts` | Interpretatieve heuristiek |
| Energiestatus "kost" | gemiddelde < -0,25 | `server/t4p/kompas-contract.ts` | Interpretatieve heuristiek |
| Familiegemiddelde foci "positief" | >= +0,50 | `server/t4p/kompas-contract.ts` | Interpretatieve heuristiek |
| Driverrisico "hoog" | gemiddelde energie top-2 drivers <= -1 | `server/scoring.ts` | Interpretatieve heuristiek |
| Driverrisico "matig" | tussen -1 en 0 | `server/scoring.ts` | Interpretatieve heuristiek |
| Rangorde binnen familie | op `net / aanbiedingen` | `server/t4p/kompas-contract.ts` | Technische kwaliteitsregel |
| Afronding in mensgerichte tekst | 1 decimaal | `server/t4p/kompas-contract.ts` | Ontwerpconventie |
| Afronding in het datacontract | 2 decimalen (`round2`), 3 voor per aanbieding | `server/scoring.ts` | Technische kwaliteitsregel |
| Item "erg snel beantwoord" | < 2000 ms | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Tempomelding aan | > 15% van de items onder die drempel | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Minimum gemeten items voor een tempomelding | 5 | `server/afnamekwaliteit.ts` | Technische kwaliteitsregel |

**Er staat in deze tabel geen enkele regel "Empirisch onderbouwd".** Dat is de
eerlijke stand van zaken: geen enkele grens in dit instrument is vandaag op
afnamedata geijkt. Wat daarvoor nodig is, staat in
`docs/ANALYSEMATRIX-BETROUWBAARHEID.md`.

---

## 7. Doorlooptijd van de afname

Sinds deze ronde bewaart het platform per afname een startmoment (`gestart_op`),
het moment van afronden (`completed_at`) en de doorlooptijd in milliseconden
(`duur_ms`). Het startmoment wordt gezet bij de eerste echte handeling en daarna
nooit meer overschreven; de doorlooptijd wordt alleen berekend wanneer beide
momenten bruikbaar zijn. Zie `server/routes/afnames.ts` (`startVeld`,
`berekenDuurMs`).

Doorlooptijd is een **technische kwaliteitsregel**. Ze zegt niets over de
persoon. Ze maakt wel iets mogelijk wat eerder niet kon: nagaan of een afname in
één zitting of over meerdere dagen is gemaakt, en dat meewegen bij het lezen.

---

## 8. Openstaande punten die echte afnamedata vragen

1. **Betrouwbaarheid.** Voor een forced-choice, ipsatief instrument is Cronbachs
   alfa methodologisch niet passend. Wat er wel kan, staat in de analysematrix.
2. **Structuur.** Of de 16 constructen empirisch in drie families uiteenvallen,
   is niet onderzocht. Er is geen factoranalyse en geen dimensionaliteitstoets.
3. **Herbalancering van de itembank.** De versnellers worden 8 tot 10 keer
   aangeboden. Genormaliseerde ordening is een correctie op de gevolgen, geen
   oplossing van de oorzaak.
4. **Ijking van de labels.** Alle woordlabels zijn conventies. Welke grens
   werkelijk onderscheidend is, kan alleen uit data komen.
5. **Deel 2 (organisatieverbondenheid).** Vier vragen; die schaalbreedte is te
   smal voor enige psychometrische claim per subschaal.
6. **Onverklaarde grootheid.** `totalChoices: completed * 3`
   (`server/scoring.ts`) is niet terug te voeren op de itemstructuur. Dit is een
   openstaand punt uit de audit en geen bewuste beslisregel.

---

## 9. Bronnen in de code

| Onderwerp | Bestand |
|---|---|
| Itembank | `server/data/instrument.json` |
| Scoring, net, energie, invulindex | `server/scoring.ts` |
| Canonieke naam van de invulindex | `shared/invulling-index.ts` |
| Actief rapportcontract en claimgrenzen | `server/t4p/kompas-contract.ts` |
| Actieve rapportweergave | `server/t4p/kompas.ts` |
| Registratie van de generator | `server/rapport-registry.ts` |
| Onderbouwingstekst | `shared/onderbouwing-t4professional.ts` |
| Doorlooptijd en startmoment | `server/routes/afnames.ts`, `shared/schema.ts` |
| Tempomelding | `server/afnamekwaliteit.ts` |
