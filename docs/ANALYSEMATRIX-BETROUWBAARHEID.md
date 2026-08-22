# Analysematrix betrouwbaarheid en structuur

Voor T4P Business Kompas en T4Students Studiekompas.
Doel van dit document: vastleggen **welke analyse op welke data mogelijk wordt**,
zodra er echte afnamedata zijn. Vandaag is er geen enkele analyse uitgevoerd. Dit
is dus geen resultatenrapport maar een onderzoeksprotocol, bedoeld om samen met
een externe methodoloog te bespreken vóór er data verzameld worden.

---

## 1. Uitgangspunt

Er staat vandaag **geen enkele betrouwbaarheidscoëfficiënt** in beide
instrumenten, en dat is een bewuste keuze. Wat er wel staat, is de index
"Volledigheid en samenhang van de invulling", en die is uitdrukkelijk geen
betrouwbaarheidsmaat.

De belangrijkste methodologische valkuil hier is Cronbachs alfa. Alfa is
ontworpen voor onafhankelijke, normatief gescoorde items op één dimensie. Aan
geen van die drie voorwaarden voldoet het T4P Business Kompas:

- de items zijn **niet onafhankelijk**: door de forced-choice-opzet ligt de som
  van de nettoscores per persoon vast, waardoor de constructen kunstmatig
  negatief samenhangen;
- de scores zijn **ipsatief**, niet normatief;
- de covariantiematrix van ipsatieve scores is singulier.

Alfa berekenen op ipsatieve forced-choice-scores levert een getal dat er
geloofwaardig uitziet en niets betekent. Dat is precies de schijnprecisie die
dit dossier wil vermijden.

---

## 2. Matrix T4P Business Kompas

| # | Analyse | Waarom passend | Nodige data | Inclusiecriteria | Scoretype | Wat het wel toont | Wat het niet toont |
|---|---|---|---|---|---|---|---|
| 1 | Test-hertest stabiliteit per construct (Pearson of ICC over twee momenten) | werkt op ipsatieve rangordes, vraagt geen onafhankelijke items | minimaal 60 personen, twee afnames, 2 tot 6 weken tussen | volledige afname, volledigheid en samenhang >= 60, doorlooptijd binnen de plausibele band | net en net per aanbieding | of de rangorde binnen personen stabiel is over tijd | of de constructen "waar" zijn, of iets over niveau |
| 2 | Thurstonian IRT-model op de blokstructuur | het standaardmodel voor forced-choice-blokken; herstelt normatieve latente trekken uit ipsatieve keuzes | minimaal 300 personen, bij voorkeur 500 | volledige afname, alle 34 blokken beantwoord | keuzepatronen per blok | itemparameters, dimensionaliteit, en pas dan een verdedigbare betrouwbaarheidsschatting per dimensie | niets zolang de steekproef onder de 300 blijft |
| 3 | Empirische betrouwbaarheid per latente dimensie uit het IRT-model | volgt logisch uit #2 | zelfde steekproef als #2 | zelfde als #2 | latente scores | precisie per dimensie | mag niet als alfa worden gerapporteerd |
| 4 | Dimensionaliteit van de zestien constructen | de driedeling drivers, foci, versnellers is vandaag een ontwerpkeuze, geen bevinding | minimaal 300 personen | zelfde als #2 | net per aanbieding | of de driedeling in de data terugkomt | causaliteit |
| 5 | Samenhang met de energiescores | de energievraag is een aparte laag; die relatie is nooit onderzocht | zelfde steekproef | volledige energieantwoorden | net en gemiddelde energie | of energie en herkenning onafhankelijke informatie geven | of energie iets over welzijn zegt |
| 6 | Gedrag van de index "volledigheid en samenhang" | vandaag zijn de gewichten 40/30/20/10 en de grenzen 80/60 conventies | minimaal 200 afnames | alle voltooide afnames, ook slordige | indexscore, doorlooptijd, tempo | of de index werkelijk slordige invullingen onderscheidt van zorgvuldige | betrouwbaarheid, in geen enkele betekenis |
| 7 | Doorlooptijd en tempo als kwaliteitsindicator | sinds deze ronde beschikbaar (`duur_ms`, itemtijden) | minimaal 200 afnames | voltooide afnames met bruikbare tijdmeting | duur_ms, aandeel items onder 2000 ms | of de gekozen drempels iets onderscheiden | motivatie of inzet van de persoon |
| 8 | Vertaling naar Big Five, RIASEC en Jaques | blad 20 legt die brug vandaag zonder enige empirische grond | minimaal 200 personen die naast T4P ook een gevalideerd Big-Five- en RIASEC-instrument afleggen | volledige afname van beide instrumenten | latente scores en externe testscores | convergente en divergente samenhang | mag pas na dit onderzoek als equivalentie worden benoemd, nooit ervoor |

**Aanbevolen volgorde:** 1, 6 en 7 kunnen met een kleine steekproef. 2, 3 en 4
vragen 300 tot 500 personen en zijn de kern van de professionalisering. 8 is een
apart onderzoek en niet nodig om het instrument verantwoord te gebruiken; zolang
het niet gebeurd is, blijft blad 20 gespreksmateriaal.

---

## 3. Matrix T4Students Studiekompas

**Eerst de itembank, dan de analyse.** Vier op de vijf clusters hebben vandaag
één item. Voor die clusters is elke betrouwbaarheidsanalyse per definitie
onmogelijk: er zijn geen twee metingen om samen te hangen. Onderstaande matrix
geldt daarom pas na uitbreiding tot minstens drie items per cluster
(`docs/ITEMONTWIKKELPLAN-T4STUDENTS.md`).

| # | Analyse | Voorwaarde | Nodige data | Inclusiecriteria | Scoretype | Wat het wel toont | Wat het niet toont |
|---|---|---|---|---|---|---|---|
| 1 | Itemanalyse per cluster (item-restcorrelatie) | minstens 3 items per cluster | minimaal 200 jongeren | leeftijd 17 tot 25, volledige afname, geen patroonvlag | herkenningsscores | of items binnen een cluster samenhangen | dat het cluster een echt kenmerk is |
| 2 | Interne consistentie per cluster (alfa of omega) | pas na #1 en met 3 items of meer | minimaal 200 jongeren | zelfde als #1 | herkenningsscores, normatief | precisie per cluster | validiteit, en niets over studiesucces |
| 3 | Test-hertest over 3 tot 6 weken | onafhankelijk van itembreedte | minimaal 80 jongeren, twee momenten | zelfde als #1 | clusterscores | stabiliteit | voorspelling |
| 4 | Structuurtoets op de drie families | pas na #1 | minimaal 300 jongeren | zelfde als #1 | clusterscores | of foci, versnellers en motivatie te scheiden zijn | causaliteit |
| 5 | Werking van de aandachtcontrole-items | pas nadat de items bestaan | minimaal 200 jongeren | volledige afname | itemantwoorden, tempo, patroon | of de items werkelijk onoplettendheid vangen | inzet of eerlijkheid |
| 6 | Ijking van de patroondrempels (10, 0,80, 15) | onafhankelijk | minimaal 200 afnames | alle voltooide afnames | antwoordreeksen | wat een werkelijk afwijkend patroon is bij deze doelgroep | dat het patroon iets over de persoon zegt |

**Uitdrukkelijk buiten de matrix:** predictieve validiteit tegenover studiesucces,
studiekeuze of slaagcijfers. Dat onderzoek zou een longitudinale opzet vragen,
een gevalideerd criterium en een ethische toetsing. Zolang het niet bestaat, mag
het rapport geen enkele voorspellende uitspraak doen, en dat doet het ook niet.

---

## 4. Inclusiecriteria: waarom deze

| Criterium | Reden | Soort |
|---|---|---|
| Volledige afname | onvolledige afnames vertekenen ipsatieve rangordes onvoorspelbaar | Technische kwaliteitsregel |
| Volledigheid en samenhang >= 60 | ondergrens van de middelste band; conventie, niet geijkt | Ontwerpconventie |
| Geen patroonvlag (T4Students) | eenvormige antwoorden bevatten geen bruikbare variantie | Technische kwaliteitsregel |
| Doorlooptijd binnen een plausibele band | de band zelf moet uit analyse 7 komen; vóór die analyse is er geen verdedigbare grens | Openstaand |
| Leeftijd 17 tot 25 (T4Students) | vastgelegde doelgroep | Ontwerpconventie |

Let op de derde rij van onder: er staat vandaag **geen** doorlooptijdgrens in de
code, en er hoort er ook geen in tot analyse 7 gedraaid is. Een grens verzinnen
en die daarna als inclusiecriterium gebruiken zou het onderzoek van tevoren
vertekenen.

---

## 5. Wat er in de tussentijd geldt

Tot bovenstaande analyses gedaan zijn, blijft de claimdiscipline zoals ze nu in
de rapporten staat: beschrijvend, binnen de persoon, gespreksgericht, zonder
normvergelijking, zonder percentielen en zonder betrouwbaarheidscijfers. Dat is
geen tijdelijke voorzichtigheid maar de enige houding die de data vandaag
toelaten.
