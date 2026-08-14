# Itembank T4P Business Kompas — kennischeck WETEN

Tachtig meetitems, blok A tot E. Dit overzicht is **gegenereerd** uit
`server/bekwaamheid/itemcorpus-t4p.json` met `scripts/maak-itemoverzicht.py`.
Het is een leesdocument en geen bron: wie een item wil wijzigen, wijzigt de JSON
en genereert opnieuw. Een met de hand bijgewerkt overzicht loopt uiteen met de
bank, en dan weet niemand meer welke van de twee de vragen zijn.

Het juiste antwoord is gemarkeerd met **→**. Bij juistfout-items staat de sleutel
onder de stam.

---

## Waar dit voor bedoeld is

Dit document dient de doorloop die nog moet gebeuren. Wat er nu vaststaat:
elk item is herleidbaar naar een paragraaf van het brondossier, de bank haalt de
formele eisen, en een tegenlezing heeft drie inhoudelijke fouten laten
herstellen. Wat er **niet** vaststaat: dat dit de meest relevante tachtig vragen
zijn. Die weging vraagt iemand die weet wat er in de praktijk misgaat.

En er is een gebrek dat bij het lezen van dit overzicht boven kwam en dat de formele tests niet zien: **21 van de 73 keuze-items zijn makkelijker dan hun onderwerp**, doordat de afleiders niet werken. Zie de paragraaf hieronder. Bij elk getroffen item staat het erbij.

Voorstel bij het lezen: zet per item één van drie letters in de kantlijn.

| Letter | Betekenis |
| --- | --- |
| **E** | Essentieel. Wie dit niet weet, hoort geen licentie te krijgen. |
| **N** | Nuttig, maar niet beslissend. |
| **O** | Overbodig, of te ver van de praktijk. |

En daarnaast de vraag die dit overzicht niet kan stellen: **wat mist hier?**
Elke vraag die uit die vraag komt, is relevanter dan een vraag die uit de code
is afgeleid.

---

## Verdeling

| Blok | Onderwerp | In de bank | Volle check | Verkorte check |
| --- | --- | --- | --- | --- |
| A | Constructen | 20 | 10 | 5 |
| B | Scoring en rapportlogica | 12 | 6 | 3 |
| C | Grenzen | 16 | 8 | 4 |
| D | Interpretatiefouten herkennen | 16 | 8 | 4 |
| E | Ethiek, consent en GDPR | 16 | 8 | 4 |
| | **totaal** | **80** | **40** | **20** |

Naar soort: 42 scenario, 31 meerkeuze, 7 juistfout. Geen open items in deze eerste vulling.

De bank is ruimer dan de check omdat §4.3 twee equivalente versies vraagt voor
herkansingen. Blok A vraagt tien items per check, dus twee versies zonder
overlap vragen twintig blok-A-items.

---

## Het gebrek in de afleiders

Een meerkeuze-item meet alleen iets als de verkeerde antwoorden geloofwaardig
zijn voor wie het niet weet. Twee fouten daartegen zitten in deze bank, beide
gemeten en niet geschat:

1. **Verklappende stam.** De sleutel deelt merkbaar meer woorden met de vraag
   dan elke afleider. De kandidaat kan het juiste antwoord aanwijzen op
   woordvorm, zonder het onderwerp te kennen.
2. **Afleider is elders sleutel.** Dezelfde bewering staat bij een ander item
   als juist antwoord. Wie dat item gezien heeft, weet dat de bewering waar is
   en streept hem hier weg om de verkeerde reden.

| Blok | Keuze-items | Met gebrek |
| --- | --- | --- |
| A | 16 | 5 |
| B | 12 | 2 |
| C | 14 | 12 |
| D | 16 | 1 |
| E | 15 | 1 |
| **totaal** | **73** | **21** |

De verdeling is het zorgelijke deel. Het gebrek zit vrijwel volledig in blok C,
en blok C is juist het blok dat §4.3 met opzet zwaar heeft gewogen: daar zit de
schade van iets beweren wat je niet mag beweren. Vier beweringen over wat er in
het onderzoek ontbreekt — geen betrouwbaarheidscoëfficiënt, geen test-hertest,
geen normgroep, de IVOC-toets — staan elk vijf keer in de bank, nu eens als
juist antwoord en dan weer als afleider. Dat is precies het patroon dat een blok
in schijn moeilijk en in werkelijkheid raadbaar maakt.

De juistfout-items en de toelichtingen zijn hier niet bij betrokken; die staan.
Het gebrek zit in de opties.

---

## Blok A — Constructen

20 items in de bank, 10 in een volle check, 5 in een verkorte.

Soorten: 4 juistfout, 16 meerkeuze. Sleutelverdeling: A: 4, B: 4, C: 4, D: 4, juist: 2, onjuist: 2.

Van deze 16 keuze-items hebben 5 een gebrek in de afleiders.

### A01

*meerkeuze · bron: ITEMBRON §1.1*

> **Gebrek:** afleider C staat elders in de bank als juist antwoord.

Welke energiemodus past bij de familie Drivers wanneer de afname-instructie wordt toegepast?

→ **A. Drivers hebben energiemodus item; energie wordt alleen bij de gekozen meest en minst bevraagd.**
&nbsp;&nbsp;&nbsp;B. Talent-foci hebben energiemodus block.
&nbsp;&nbsp;&nbsp;C. Talent-versnellers hebben energiemodus block.
&nbsp;&nbsp;&nbsp;D. connection0to10 heeft bereik 0 tot 10.

**Bij juist:** Bij drivers is de energiemodus item: energie wordt alleen gevraagd bij de gekozen meest en minst herkenbare uitspraken.

**Bij fout:** De denkfout is het verwarren van drivers met de twee talentfamilies. Daar wordt energie per blok, niet per item, bevraagd.

---

### A02

*juistfout · bron: ITEMBRON §1.1*

Bij Talent-foci wordt energie per blok bevraagd en niet per afzonderlijk item.

→ **juist**

**Bij juist:** De tabel met families kent Talent-foci de energiemodus block toe. Dat onderscheidt deze familie van de drivers met modus item.

**Bij fout:** De denkfout is dat energie per item bij Talent-foci zou horen. Die werkwijze is uitsluitend vastgelegd voor de familie Drivers.

---

### A03

*meerkeuze · bron: ITEMBRON §1.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.

Welke beschrijving onderbouwt dat Talent-foci en Talent-versnellers dezelfde energiemodus hebben?

&nbsp;&nbsp;&nbsp;A. Drivers hebben vijf constructen en tien blokken.
→ **B. Talent-foci en Talent-versnellers hebben energiemodus block.**
&nbsp;&nbsp;&nbsp;C. Drivers hebben energiemodus item.
&nbsp;&nbsp;&nbsp;D. De sectie connection heeft type numeric-scale en vier vragen.

**Bij juist:** Talent-foci en Talent-versnellers hebben beide energiemodus block. Daardoor wordt de energie bij deze twee families per blok bevraagd.

**Bij fout:** De denkfout is Drivers bij een blokmodus plaatsen. Drivers hebben juist de afwijkende energiemodus item binnen het instrument.

---

### A04

*meerkeuze · bron: ITEMBRON §1; ITEMBRON §1.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.

Een gekozen uitspraak is een driver. Op welk moment hoort de energie daarbij te worden uitgevraagd?

&nbsp;&nbsp;&nbsp;A. Talent-foci hebben energiemodus block.
&nbsp;&nbsp;&nbsp;B. De sectie connection heeft vier vragen op een schaal van 0 tot 10.
→ **C. Bij de gekozen meest en minst herkenbare uitspraak.**
&nbsp;&nbsp;&nbsp;D. Main heeft 34 blokken.

**Bij juist:** De instructie koppelt energie bij drivers aan itemniveau, en beperkt die bevraging tot de gekozen meest en minst herkenbare uitspraken.

**Bij fout:** De denkfout is een blok- of sectiemeting toepassen op een driver. De bron maakt voor drivers expliciet een itemniveau-uitzondering.

---

### A05

*meerkeuze · bron: ITEMBRON §1; ITEMBRON §1.1*

Welke familie omvat zes constructen en telt daardoor veertien blokken in main?

&nbsp;&nbsp;&nbsp;A. Drivers.
&nbsp;&nbsp;&nbsp;B. Talent-foci.
&nbsp;&nbsp;&nbsp;C. Organisatieverbondenheid.
→ **D. Talent-versnellers.**

**Bij juist:** Talent-versnellers bestaan uit zes constructen en hebben veertien blokken. Drivers en Talent-foci hebben elk vijf constructen en tien blokken.

**Bij fout:** De denkfout is de families met vijf constructen of de afzonderlijke connection-sectie gelijkstellen aan de familie Talent-versnellers.

---

### A06

*meerkeuze · bron: ITEMBRON §1.1*

Waar hoort het construct Constructief onderscheidend in de opbouw van het T4P Business Kompas thuis?

→ **A. Bij de Talent-versnellers met energiemodus block.**
&nbsp;&nbsp;&nbsp;B. Be Perfect is een construct van Drivers met energiemodus item.
&nbsp;&nbsp;&nbsp;C. Innovatie is een construct van Talent-foci met energiemodus block.
&nbsp;&nbsp;&nbsp;D. De sectie connection heeft vier vragen.

**Bij juist:** Constructief onderscheidend staat in de lijst van Talent-versnellers. Voor die familie is de energiemodus block vastgelegd.

**Bij fout:** De denkfout is dit construct onder Drivers, Talent-foci of connection plaatsen. De bron classificeert het uitsluitend als Talent-versneller.

---

### A07

*juistfout · bron: ITEMBRON §1.1*

Hurry Up en Faciliteren zijn beide constructen binnen de familie Drivers.

→ **onjuist**

**Bij juist:** Dit is onjuist. Hurry Up is een driver, maar Faciliteren hoort bij de talent-versnellers. De vijf drivers zijn Be Perfect, Be Strong, Hurry Up, Please Others en Try Hard.

**Bij fout:** De denkfout is aannemen dat een werkwoordachtige naam een driver aanduidt. De familie is niet aan de vorm van de naam te zien; ze volgt uit de indeling van het instrument, en die bepaalt ook of energie per item of per blok wordt bevraagd.

---

### A08

*meerkeuze · bron: ITEMBRON §1.1*

> **Gebrek:** afleider D staat elders in de bank als juist antwoord.

Welke combinatie beschrijft het structurele verschil tussen Talent-foci en Talent-versnellers correct?

&nbsp;&nbsp;&nbsp;A. Drivers hebben vijf constructen en tien blokken met energiemodus item.
→ **B. Talent-foci hebben vijf constructen en tien blokken; Talent-versnellers zes constructen en veertien blokken.**
&nbsp;&nbsp;&nbsp;C. Talent-foci hebben energiemodus block.
&nbsp;&nbsp;&nbsp;D. Talent-versnellers hebben energiemodus block.

**Bij juist:** De twee talentfamilies delen de blokgebonden energiemodus, maar verschillen in omvang: vijf constructen en tien blokken tegenover zes en veertien.

**Bij fout:** De denkfout is hun aantallen omdraaien of Talent-foci een itemmodus geven. De bron reserveert itemenergie uitsluitend voor Drivers.

---

### A09

*meerkeuze · bron: ITEMBRON §1*

Welke beschrijving houdt de sectie main en de sectie connection inhoudelijk uit elkaar?

&nbsp;&nbsp;&nbsp;A. Main heeft 34 blokken en 136 items.
&nbsp;&nbsp;&nbsp;B. Connection heeft vier vragen op een schaal van 0 tot 10.
→ **C. Main is forced-choice-with-energy; connection is numeric-scale met vier vragen.**
&nbsp;&nbsp;&nbsp;D. Talent-versnellers hebben veertien blokken.

**Bij juist:** Main heeft het type forced-choice-with-energy. Connection is een afzonderlijke numeric-scale-sectie met vier vragen over organisatieverbondenheid.

**Bij fout:** De denkfout is de twee sectietypen verwisselen of ze als identiek behandelen. De bron legt voor main en connection verschillende typen vast.

---

### A10

*meerkeuze · bron: ITEMBRON §1.2*

Welke technische koppeling hoort bij de vier vragen over organisatieverbondenheid?

&nbsp;&nbsp;&nbsp;A. Energie per item bij de gekozen meest en minst.
&nbsp;&nbsp;&nbsp;B. Energiewaarden van −2 tot +2.
&nbsp;&nbsp;&nbsp;C. Veertien blokken in main.
→ **D. linkKey: respondentCode.**

**Bij juist:** De vier connection-vragen zijn gekoppeld via linkKey: respondentCode. Dit staat bij de sectie organisatieverbondenheid vermeld.

**Bij fout:** De denkfout is een kenmerk van energiemeting of van main als koppeling voor connection-vragen gebruiken. De bron noemt hiervoor respondentCode.

---

### A11

*meerkeuze · bron: ITEMBRON §1.2*

Welke vraag hoort als q3 bij de sectie organisatieverbondenheid van het instrument?

→ **A. Zelfinvestering.**
&nbsp;&nbsp;&nbsp;B. Psychologische verbondenheid.
&nbsp;&nbsp;&nbsp;C. Billijkheid / verloning.
&nbsp;&nbsp;&nbsp;D. Organisatie-investering.

**Bij juist:** In de tabel van de connection-sectie is q3 gekoppeld aan Zelfinvestering. De overige labels horen bij q1, q2 en q4.

**Bij fout:** De denkfout is de vier labels niet aan hun eigen vraag-id koppelen. De bron geeft voor ieder van q1 tot en met q4 een afzonderlijke koppeling.

---

### A12

*juistfout · bron: ITEMBRON §1.3*

De schaal energy en de schaal baselineEnergy0to10 hebben hetzelfde bereik.

→ **onjuist**

**Bij juist:** Dit is onjuist. De schaal energy loopt van −2 tot +2, terwijl baselineEnergy0to10 van 0 tot 10 loopt. Juist daarom is er een herschaling nodig voordat de twee met elkaar vergeleken kunnen worden.

**Bij fout:** De denkfout is de twee energiematen als één schaal behandelen omdat ze beide over energie gaan. Wie ze verwisselt, telt een waarde van −2 en een waarde van 0 als hetzelfde, terwijl −2 na herschaling juist de ondergrens 0 oplevert.

---

### A13

*meerkeuze · bron: ITEMBRON §1.3*

Welke schaalbeschrijving past bij een antwoord dat het label Neutraal draagt?

&nbsp;&nbsp;&nbsp;A. connection0to10, met bereik 0 tot 10.
→ **B. energy, met waarde 0 op een ordinale schaal van −2 tot +2.**
&nbsp;&nbsp;&nbsp;C. baselineEnergy0to10, met bereik 0 tot 10.
&nbsp;&nbsp;&nbsp;D. energy, met bovengrens +2.

**Bij juist:** De labels van energy kennen de waarde 0 toe aan Neutraal. Deze schaal loopt ordinaal van −2 tot en met +2.

**Bij fout:** De denkfout is het neutrale energielabel op een 0-tot-10-schaal of op een andere waarde plaatsen. De bron specificeert hiervoor energy = 0.

---

### A14

*meerkeuze · bron: ITEMBRON §1.3*

Welke energielabels horen bij de twee negatieve waarden van de schaal energy?

&nbsp;&nbsp;&nbsp;A. 0: Neutraal.
&nbsp;&nbsp;&nbsp;B. +1: Geeft eerder energie.
→ **C. −2: Kost veel energie; −1: Kost eerder energie.**
&nbsp;&nbsp;&nbsp;D. +2: bovengrens.

**Bij juist:** De antwoordschalen koppelen −2 aan Kost veel energie en −1 aan Kost eerder energie. Neutraal hoort bij 0.

**Bij fout:** De denkfout is labels van 0 of van positieve energie aan negatieve schaalwaarden koppelen. De bron onderscheidt deze waarden uitdrukkelijk.

---

### A15

*meerkeuze · bron: ITEMBRON §1*

Welke omvang hoort bij de sectie main, los van de vier vragen in connection?

&nbsp;&nbsp;&nbsp;A. Drivers hebben tien blokken.
&nbsp;&nbsp;&nbsp;B. Talent-versnellers hebben veertien blokken.
&nbsp;&nbsp;&nbsp;C. Connection heeft vier vragen.
→ **D. 34 blokken en 136 items.**

**Bij juist:** De instrumenttabel vermeldt voor main 34 blokken en 136 items. Connection is daarvan apart opgevoerd als numeric-scale met vier vragen.

**Bij fout:** De denkfout is aantallen van één familie of de connection-sectie gebruiken als totale omvang van main. De bron noemt daarvoor 34 en 136.

---

### A16

*meerkeuze · bron: ITEMBRON §3.1*

Welke omschrijving van de exploratieve factoranalyse is volgens de onderzoeksinformatie correct?

→ **A. De analyse omvatte 1.858 T4Professional-profielen en 395 profielen van het sportinstrument.**
&nbsp;&nbsp;&nbsp;B. De externe inhoudsvalidatie gebeurde door vier onafhankelijke experts.
&nbsp;&nbsp;&nbsp;C. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;D. De bevindingen van de inhoudsvalidatie zijn niet als afzonderlijk rapport gepubliceerd.

**Bij juist:** De exploratieve factoranalyse wordt gekoppeld aan twee profielgroepen: 1.858 T4Professional-profielen en 395 profielen van het sportinstrument.

**Bij fout:** De denkfout is een ander onderzoekselement als omschrijving van de factoranalyse kiezen. De andere uitspraken betreffen inhoudsvalidatie of statistische vormgeving.

---

### A17

*meerkeuze · bron: ITEMBRON §3.1*

> **Gebrek:** afleider C staat elders in de bank als juist antwoord.

Welke factorladingen worden in de onderzoeksinformatie aan de driverschalen toegeschreven?

&nbsp;&nbsp;&nbsp;A. 0,63–0,84 voor energieschalen onder de talentversnellers.
→ **B. 0,90–0,97.**
&nbsp;&nbsp;&nbsp;C. 1.858 T4Professional-profielen en 395 profielen van het sportinstrument.
&nbsp;&nbsp;&nbsp;D. Vier onafhankelijke experts voor externe inhoudsvalidatie.

**Bij juist:** De bron vermeldt factorladingen van 0,90–0,97 voor de driverschalen. De range 0,63–0,84 betreft energieschalen onder de talentversnellers.

**Bij fout:** De denkfout is een andere gerapporteerde range of een deelnemersaantal als factorlading voor drivers gebruiken. De driverschalen hebben hun eigen range.

---

### A18

*meerkeuze · bron: ITEMBRON §1.1*

Welke reeks bevat uitsluitend constructen uit de familie Talent-foci van het T4P Business Kompas?

&nbsp;&nbsp;&nbsp;A. Analyse, Coaching, Faciliteren, Impact, Resultaatgericht.
&nbsp;&nbsp;&nbsp;B. Be Perfect, Be Strong, Hurry Up, Please Others, Try Hard.
→ **C. Innovatie, Inter-relationeel, Operationeel, Strategie, TaPas-Beeld.**
&nbsp;&nbsp;&nbsp;D. Innovatie, Strategie, Impact, Analyse, TaPas-Beeld.

**Bij juist:** De familie Talent-foci bestaat uit vijf constructen: Innovatie, Inter-relationeel, Operationeel, Strategie en TaPas-Beeld. Ze worden bevraagd met energie op blokniveau.

**Bij fout:** De denkfout is de drie families door elkaar halen. Analyse, Coaching, Faciliteren, Impact en Resultaatgericht zijn talent-versnellers; Be Perfect en de andere vier zijn drivers. Een reeks die foci en versnellers mengt, zoals Innovatie samen met Impact en Analyse, hoort bij geen van de families.

---

### A19

*juistfout · bron: ITEMBRON §3.1*

Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.

→ **juist**

**Bij juist:** De onderzoeksbeschrijving vermeldt expliciet dat het extractiemodel, de fit-indices en de volledige factormatrix niet zijn gepubliceerd.

**Bij fout:** De denkfout is uit de aanwezigheid van een exploratieve analyse afleiden dat alle technische uitwerkingen extern beschikbaar zijn. Dat staat niet in de bron.

---

### A20

*meerkeuze · bron: ITEMBRON §3.1*

Welke omschrijving past bij de externe inhoudsvalidatie die in de onderzoeksinformatie wordt genoemd?

&nbsp;&nbsp;&nbsp;A. Een exploratieve factoranalyse met de Universiteit Antwerpen en prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen.
&nbsp;&nbsp;&nbsp;B. Factorladingen van 0,90–0,97 voor driverschalen en 0,63–0,84 voor energieschalen onder talentversnellers.
&nbsp;&nbsp;&nbsp;C. Statistische vormgeving nagekeken door sectorfonds IVOC.
→ **D. Vier onafhankelijke experts, twee Vlaamse en twee Nederlandse, onder supervisie van prof. dr. Peter Theuns van de VUB.**

**Bij juist:** De externe inhoudsvalidatie is beschreven als werk van vier onafhankelijke experts, onder supervisie van prof. dr. Peter Theuns van de VUB.

**Bij fout:** De denkfout is factoranalyse, factorladingen of de IVOC-controle verwarren met externe inhoudsvalidatie. De bron benoemt deze als afzonderlijke onderzoekselementen.

---

## Blok B — Scoring en rapportlogica

12 items in de bank, 6 in een volle check, 3 in een verkorte.

Soorten: 12 meerkeuze. Sleutelverdeling: A: 2, B: 4, C: 4, D: 2.

Van deze 12 keuze-items hebben 2 een gebrek in de afleiders.

### B01

*meerkeuze · bron: ITEMBRON §2.1*

Een construct is 3 keer als meest en 1 keer als minst herkenbaar gekozen. Welke netscore volgt uit de constructberekening?

&nbsp;&nbsp;&nbsp;A. −2
→ **B. 2**
&nbsp;&nbsp;&nbsp;C. 3
&nbsp;&nbsp;&nbsp;D. 4

**Bij juist:** De netscore is most − least. Bij 3 keer most en 1 keer least is de uitkomst dus 3 − 1 = 2.

**Bij fout:** De denkfout is most en least optellen of één van beide tellingen overnemen. Net is uitsluitend het verschil most − least.

---

### B02

*meerkeuze · bron: ITEMBRON §2.1*

Voor een construct zijn geen energiewaarden verzameld. Welke duiding van avgEnergy is dan volgens de scoring correct?

→ **A. avgEnergy is 0; hetzelfde getal kan ook ontstaan bij een neutraal gemeten energie.**
&nbsp;&nbsp;&nbsp;B. avgEnergy ontbreekt en krijgt geen getalswaarde.
&nbsp;&nbsp;&nbsp;C. avgEnergy wordt automatisch 5 op de tienschaal.
&nbsp;&nbsp;&nbsp;D. avgEnergy wordt gelijkgesteld aan de netscore van het construct.

**Bij juist:** Bij geen energiewaarden is avgEnergy 0. Omdat 0 op de itemschaal ook Neutraal betekent, is het onderscheid in dit veld niet zichtbaar.

**Bij fout:** De denkfout is 0 altijd als een werkelijk neutrale meting lezen. De terugval bij ontbrekende energiewaarden levert exact dezelfde waarde 0 op.

---

### B03

*meerkeuze · bron: ITEMBRON §2.2*

Welke drivers worden als uitgangspunt gebruikt voordat de gemiddelde energie voor driverRisk wordt bepaald?

&nbsp;&nbsp;&nbsp;A. De twee drivers met de hoogste avgEnergy.
→ **B. De top 2 drivers na sortering op net, aflopend.**
&nbsp;&nbsp;&nbsp;C. De top 3 drivers na sortering op net, aflopend.
&nbsp;&nbsp;&nbsp;D. Alle drivers met een avgEnergy lager dan 0.

**Bij juist:** DriverRisk sorteert de drivers eerst op net in aflopende volgorde en neemt vervolgens de top 2. Pas van die twee wordt avg berekend.

**Bij fout:** De denkfout is selectie op energiewaarde of op drie drivers veronderstellen. De selectie gebeurt uitsluitend op net, aflopend, en omvat precies twee drivers.

---

### B04

*meerkeuze · bron: ITEMBRON §2.2*

> **Gebrek:** afleider A staat elders in de bank als juist antwoord.

De gemiddelde avgEnergy van de twee geselecteerde topdrivers is precies 0. Welk driverRisk-label hoort daarbij?

&nbsp;&nbsp;&nbsp;A. hoog
&nbsp;&nbsp;&nbsp;B. matig
→ **C. laag**
&nbsp;&nbsp;&nbsp;D. Er wordt geen label toegekend.

**Bij juist:** Bij avg === 0 of hoger kent driverRisk het label laag toe. Matig geldt alleen bij avg kleiner dan 0 én groter dan −1.

**Bij fout:** De denkfout is 0 onder de categorie matig laten vallen. De grens voor matig sluit 0 uit; daardoor valt precies 0 onder laag.

---

### B05

*meerkeuze · bron: ITEMBRON §2.3*

> **Gebrek:** afleider A staat elders in de bank als juist antwoord.

De berekende consistentiescore is precies 80. Welk consistentielabel kent de rapportlogica dan toe?

&nbsp;&nbsp;&nbsp;A. laag
&nbsp;&nbsp;&nbsp;B. middelmatig
&nbsp;&nbsp;&nbsp;C. Er is eerst een aanvullende afronding nodig.
→ **D. hoog**

**Bij juist:** Het label hoog geldt bij score >= 80. Een score die precies 80 is, voldoet dus direct aan de voorwaarde voor hoog.

**Bij fout:** De denkfout is de grens te lezen als strikt hoger dan 80. In de regel staat >= 80, waardoor 80 zelf al hoog is.

---

### B06

*meerkeuze · bron: ITEMBRON §2.3*

Twee afnames verschillen alleen in energySpread: de ene heeft 2 en de andere 7. Welke afname krijgt de hogere spreadPart?

→ **A. De afname met energySpread 2.**
&nbsp;&nbsp;&nbsp;B. De afname met energySpread 7.
&nbsp;&nbsp;&nbsp;C. Beide afnames krijgen altijd spreadPart 10.
&nbsp;&nbsp;&nbsp;D. De spreadPart wordt niet door energySpread beïnvloed.

**Bij juist:** SpreadPart is max(0, 10 − min(10, energySpread)). Een kleinere energySpread geeft daarom een hogere spreadPart dan een grotere spreiding.

**Bij fout:** De denkfout is een grotere spreiding als een hogere deelscore beschouwen. De formule trekt energySpread juist af, waardoor 7 lager uitkomt dan 2.

---

### B07

*meerkeuze · bron: ITEMBRON §2.4*

Een respondent heeft 13 ingevulde blokken. Wat is dan totalChoices in buildMainScores?

&nbsp;&nbsp;&nbsp;A. 13
&nbsp;&nbsp;&nbsp;B. 26
&nbsp;&nbsp;&nbsp;C. 34
→ **D. 39**

**Bij juist:** BuildMainScores berekent totalChoices als completedScreens * 3. Bij 13 ingevulde blokken is dat 13 * 3, dus 39.

**Bij fout:** De denkfout is completedScreens zelf, het totale aantal van 34, of een verdubbeling gebruiken. De vastgelegde berekening vermenigvuldigt completedScreens met 3.

---

### B08

*meerkeuze · bron: ITEMBRON §2.4*

De baseline is 8 en normalizedQuestionnaireEnergy is 6. Welke energyDiscrepancy volgt volgens buildMainScores?

&nbsp;&nbsp;&nbsp;A. −2
&nbsp;&nbsp;&nbsp;B. 0
→ **C. 2**
&nbsp;&nbsp;&nbsp;D. 14

**Bij juist:** EnergyDiscrepancy is baseline − normalized. Met baseline 8 en normalized 6 is de discrepantie dus 8 − 6 = 2.

**Bij fout:** De denkfout is de aftrekvolgorde omkeren of de twee waarden optellen. De formule schrijft baseline min normalized voor, niet andersom.

---

### B09

*meerkeuze · bron: ITEMBRON §2.5*

Welke waarde op de tienschaal geeft energieNaarTienschaal voor een gemiddelde energiewaarde van 0?

&nbsp;&nbsp;&nbsp;A. 0
&nbsp;&nbsp;&nbsp;B. 3
→ **C. 5**
&nbsp;&nbsp;&nbsp;D. 10

**Bij juist:** De herschaling van −2..+2 naar 0..10 legt expliciet vast dat 0 wordt omgezet naar 5, afgerond op twee decimalen.

**Bij fout:** De denkfout is 0 op de oorspronkelijke energieschaal verwarren met 0 op de tienschaal. De vastgelegde herschaling zet 0 juist op 5.

---

### B10

*meerkeuze · bron: ITEMBRON §2.5*

Een waarde op de tienschaal is precies 7,5. Welke energieband geldt volgens de vastgelegde bandgrenzen?

&nbsp;&nbsp;&nbsp;A. wisselend
→ **B. hoog**
&nbsp;&nbsp;&nbsp;C. stevig
&nbsp;&nbsp;&nbsp;D. kwetsbaar

**Bij juist:** De band hoog begint vanaf 7,5. Een waarde die precies 7,5 is, valt daarom in de band hoog.

**Bij fout:** De denkfout is de grens 7,5 uitsluiten of de lagere band kiezen. Het woord vanaf maakt duidelijk dat 7,5 zelf al hoog is.

---

### B11

*meerkeuze · bron: ITEMBRON §2.6*

Er zijn 4 items met tijdgegevens in een afname. Wat gebeurt er volgens de afnamekwaliteitslogica met een eventuele vlag?

&nbsp;&nbsp;&nbsp;A. De vlag wordt altijd gezet zodra het aandeel 0,15 is.
&nbsp;&nbsp;&nbsp;B. De vlag wordt alleen gezet bij een score lager dan 60.
→ **C. De vlag wordt nooit gezet, ook al wordt het aandeel berekend.**
&nbsp;&nbsp;&nbsp;D. De vlag wordt vervangen door het label middelmatig.

**Bij juist:** Onder 5 items met tijdgegevens wordt het aandeel wel berekend, maar nooit een vlag gezet. Vier tijdgegevens blijven dus onder het minimum.

**Bij fout:** De denkfout is de berekening van het aandeel verwarren met het zetten van een vlag. De minimumregel van 5 blokkeert een vlag bij vier items.

---

### B12

*meerkeuze · bron: ITEMBRON §2.6*

Welke waarde heeft ITEM_TIJDSDREMPEL_MS in de afnamekwaliteitslogica van het instrument?

&nbsp;&nbsp;&nbsp;A. 200
→ **B. 2.000**
&nbsp;&nbsp;&nbsp;C. 5.000
&nbsp;&nbsp;&nbsp;D. 15.000

**Bij juist:** ITEM_TIJDSDREMPEL_MS is vastgelegd op 2000. De tijdsdrempel is daarmee een afzonderlijke parameter van de afnamekwaliteit.

**Bij fout:** De denkfout is de tijdsdrempel verwarren met het minimum van 5 items of de 0,15-aandeeldrempel. De tijdsdrempel zelf is 2000 milliseconden.

---

## Blok C — Grenzen

16 items in de bank, 8 in een volle check, 4 in een verkorte.

Soorten: 2 juistfout, 2 meerkeuze, 12 scenario. Sleutelverdeling: A: 4, B: 3, C: 3, D: 4, onjuist: 2.

Van deze 14 keuze-items hebben 12 een gebrek in de afleiders.

### C01

*scenario · bron: ITEMBRON §3.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider C staat elders in de bank als juist antwoord.

Een coach zegt dat de factoranalyse al als extern gepubliceerde bevestiging kan worden aangehaald. Welke reactie past bij de beschikbare onderbouwing?

&nbsp;&nbsp;&nbsp;A. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;B. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp;&nbsp;C. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
→ **D. De analyse is exploratief en niet extern gepubliceerd.**

**Bij juist:** Dit is juist: de bron noemt de analyse exploratief en niet extern gepubliceerd.

**Bij fout:** De overige uitspraken zijn wel brongegevens, maar zij beschrijven niet de publicatiestatus van de factoranalyse.

---

### C02

*scenario · bron: ITEMBRON §3.1 en §3.2*

> **Gebrek:** afleider D staat elders in de bank als juist antwoord.

Een adviseur wil de gerapporteerde factorladingen presenteren als een berekende betrouwbaarheidscoëfficiënt. Wat is de meest correcte begrenzing?

→ **A. Er is geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.**
&nbsp;&nbsp;&nbsp;B. De factorladingen voor de driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp;&nbsp;C. De factorladingen voor energieschalen onder de talentversnellers liggen tussen 0,63 en 0,84.
&nbsp;&nbsp;&nbsp;D. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.

**Bij juist:** De bron vermeldt factorladingen, maar geen berekende of gerapporteerde betrouwbaarheidscoëfficiënt.

**Bij fout:** De andere brongegevens gaan over factorladingen of de publicatiestatus, niet over een berekende betrouwbaarheidscoëfficiënt.

---

### C03

*juistfout · bron: ITEMBRON §3.2*

Voor T4Professional is een betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

→ **onjuist**

**Bij juist:** Dit is onjuist: de bron vermeldt expliciet dat geen betrouwbaarheidscoëfficiënt is berekend of gerapporteerd.

**Bij fout:** Een factorlading is niet de in de bron ontbrekende betrouwbaarheidscoëfficiënt zoals Cronbachs alfa of McDonalds omega.

---

### C04

*scenario · bron: ITEMBRON §3.2*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider A en C staat elders in de bank als juist antwoord.

Een professional zegt dat een tweede afname na verloop van tijd dezelfde uitkomst zal bevestigen. Welke uitspraak bewaakt de grens het best?

&nbsp;&nbsp;&nbsp;A. Er is geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
→ **B. De stabiliteit over tijd is niet gemeten, omdat er geen test-hertestonderzoek is.**
&nbsp;&nbsp;&nbsp;C. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.
&nbsp;&nbsp;&nbsp;D. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.

**Bij juist:** Dit volgt rechtstreeks uit de bron: er is geen test-hertestonderzoek en stabiliteit over tijd is niet gemeten.

**Bij fout:** De overige brongegevens noemen normgroep, publicatie en inhoudsvalidatie, maar meten geen stabiliteit over tijd.

---

### C05

*scenario · bron: ITEMBRON §3.2*

Bij een nabespreking wil een adviseur de uitkomst als percentiel presenteren. Welke begrenzing sluit het nauwst aan bij de beschikbare onderbouwing?

&nbsp;&nbsp;&nbsp;A. −2 wordt 0, 0 wordt 5 en +2 wordt 10; dit is rekenkunde, geen conventie.
&nbsp;&nbsp;&nbsp;B. ENERGIE_TERUGVAL = 5 is de waarde bij ontbrekende meting.
→ **C. Er is geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.**
&nbsp;&nbsp;&nbsp;D. De factorladingen voor driverschalen liggen tussen 0,90 en 0,97.

**Bij juist:** De bron meldt geen normgroep en noemt inhoudelijk oordeel, niet een empirische referentieverdeling, voor interpretatiedrempels.

**Bij fout:** De andere uitspraken zijn brongegevens, maar alleen de juiste optie beschrijft het ontbreken van een normgroep en referentieverdeling.

---

### C06

*scenario · bron: ITEMBRON §3.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.

Een trainer wil zeggen dat extractiemodel, fit-indices en volledige factormatrix in een onderzoeksartikel beschikbaar zijn. Welke correctie is nodig?

&nbsp;&nbsp;&nbsp;A. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;B. De factorladingen van de driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp;&nbsp;C. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
→ **D. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.**

**Bij juist:** De bron noemt precies deze drie onderdelen als niet gepubliceerd en kwalificeert de analyse als niet extern gepubliceerd.

**Bij fout:** IVOC, externe inhoudsvalidatie en de algemene status van de analyse beschrijven niet de publicatie van deze drie technische onderdelen.

---

### C07

*scenario · bron: ITEMBRON §3.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider C en D staat elders in de bank als juist antwoord.

Een adviseur beschrijft de beoordeling door externe experts als een afzonderlijk gepubliceerd rapport. Welke formulering is wel juist?

→ **A. Vier onafhankelijke experts voerden externe inhoudsvalidatie uit, maar de bevindingen zijn niet als afzonderlijk rapport gepubliceerd.**
&nbsp;&nbsp;&nbsp;B. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;C. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.
&nbsp;&nbsp;&nbsp;D. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.

**Bij juist:** De bron vermeldt externe inhoudsvalidatie door vier onafhankelijke experts en vermeldt dat de bevindingen niet afzonderlijk zijn gepubliceerd.

**Bij fout:** De andere brongegevens gaan over IVOC, betrouwbaarheid en normgroep, niet over de expertbeoordeling en haar publicatiestatus.

---

### C08

*meerkeuze · bron: ITEMBRON §3.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider A en D staat elders in de bank als juist antwoord.

Welke omschrijving van de bijdrage van sectorfonds IVOC aan de onderbouwing van T4Professional is volgens de bron correct?

&nbsp;&nbsp;&nbsp;A. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
→ **B. IVOC heeft de statistische vormgeving nagekeken.**
&nbsp;&nbsp;&nbsp;C. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp;&nbsp;D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Bij juist:** De bron schrijft aan IVOC alleen het nakijken van de statistische vormgeving toe.

**Bij fout:** De andere brongegevens beschrijven expliciete lacunes, terwijl de juiste optie de specifieke rol van IVOC weergeeft.

---

### C09

*scenario · bron: ITEMBRON §3.2*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider D staat elders in de bank als juist antwoord.

Een consultant wil uit een profiel afleiden dat functioneren, welbevinden en verloop voorspeld zijn. Welke begrenzing is volgens de bron correct?

&nbsp;&nbsp;&nbsp;A. De factorladingen voor driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp;&nbsp;B. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
→ **C. Samenhang met uitkomsten buiten het instrument, waaronder functioneren, welbevinden en verloop, is niet onderzocht.**
&nbsp;&nbsp;&nbsp;D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Bij juist:** De bron stelt expliciet dat de samenhang met uitkomsten buiten het instrument niet is onderzocht.

**Bij fout:** Factorladingen, inhoudsvalidatie en betrouwbaarheidscoëfficiënten beschrijven geen onderzocht verband met uitkomsten buiten het instrument.

---

### C10

*scenario · bron: ITEMBRON §3.3*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider B staat elders in de bank als juist antwoord.

Na een afname noemt een leidinggevende het resultaat een definitief oordeel over wat de deelnemer kan. Welke reactie volgt de claimgrens?

&nbsp;&nbsp;&nbsp;A. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp;&nbsp;B. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
&nbsp;&nbsp;&nbsp;C. De vragenlijst is zorgvuldig ingevuld, dus het resultaat mag als vaststaand gelden.
→ **D. Een resultaat is een momentopname op het ogenblik van afname, geen vaststaand oordeel over iemands mogelijkheden.**

**Bij juist:** De claimgrens formuleert woordelijk dat een resultaat een momentopname is en geen vaststaand oordeel over mogelijkheden.

**Bij fout:** De overige uitspraken zijn brongegevens, maar alleen de juiste optie begrenst het resultaat als momentopname van de afname.

---

### C11

*scenario · bron: ITEMBRON §3.3*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider B en D staat elders in de bank als juist antwoord.

Een leidinggevende wil een T4Professional-profiel als enige basis gebruiken voor een promotiebeslissing. Welke reactie past bij de claimgrens?

→ **A. Het profiel is een gespreksinstrument en mag niet als enige basis dienen voor beslissingen over promotie.**
&nbsp;&nbsp;&nbsp;B. De analyse is exploratief en niet extern gepubliceerd.
&nbsp;&nbsp;&nbsp;C. De factorladingen voor driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp;&nbsp;D. IVOC heeft de statistische vormgeving nagekeken.

**Bij juist:** De claimgrens noemt het profiel een gespreksinstrument en sluit uit dat het de enige basis is voor promotiebeslissingen.

**Bij fout:** De overige brongegevens zeggen niets over de expliciete grens dat een profiel niet de enige basis voor promotie mag zijn.

---

### C12

*scenario · bron: ITEMBRON §2.5*

Een coach verklaart dat een score van 7,4 inhoudelijk wezenlijk verschilt van een score van 7,6. Welke reactie is juist?

&nbsp;&nbsp;&nbsp;A. Hoog begint bij 7,5.
→ **B. Er bestaat geen onderzoek waaruit volgt dat een 7,4 wezenlijk anders is dan een 7,6.**
&nbsp;&nbsp;&nbsp;C. −2 wordt 0, 0 wordt 5 en +2 wordt 10; dit is rekenkunde, geen conventie.
&nbsp;&nbsp;&nbsp;D. Stevig begint bij 5 en wisselend begint bij 3.

**Bij juist:** Dit is woordelijk de grens uit de bron: er bestaat geen onderzoek dat een wezenlijk verschil tussen 7,4 en 7,6 onderbouwt.

**Bij fout:** De andere uitspraken beschrijven schaalwaarden of bandstarts, maar alleen de juiste optie betreft de ontbrekende empirische betekenis van 7,4 en 7,6.

---

### C13

*juistfout · bron: ITEMBRON §2.5*

Alle bandgrenzen van de energieschaal zijn empirisch geijkt op een normgroep en vormen daarom een meting.

→ **onjuist**

**Bij juist:** Dit is onjuist: alle bandgrenzen zijn conventies van de ontwikkelaar en niet empirisch geijkt op een normgroep.

**Bij fout:** De bron onderscheidt de herschaling als rekenkunde van de bandgrenzen, die juist conventies en geen empirische ijking zijn.

---

### C14

*scenario · bron: ITEMBRON §2.5*

> **Gebrek:** afleider D staat elders in de bank als juist antwoord.

Een rapporteur noemt het label hoog bij 7,6 een empirisch vastgesteld kwaliteitsverschil. Welke formulering bewaakt de juiste grens?

&nbsp;&nbsp;&nbsp;A. −2 wordt 0, 0 wordt 5 en +2 wordt 10; dit is rekenkunde, geen conventie.
&nbsp;&nbsp;&nbsp;B. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
→ **C. Hoog begint bij 7,5, maar alle bandgrenzen zijn conventies van de ontwikkelaar.**
&nbsp;&nbsp;&nbsp;D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Bij juist:** De bron geeft 7,5 als start van hoog, maar noemt alle bandgrenzen conventies van de ontwikkelaar.

**Bij fout:** Alleen de juiste optie koppelt de startwaarde 7,5 aan de bronuitspraak dat bandgrenzen conventies van de ontwikkelaar zijn.

---

### C15

*meerkeuze · bron: ITEMBRON §3.1*

> **Gebrek:** afleider C staat elders in de bank als juist antwoord.

Welke omschrijving van de exploratieve factoranalyse bevat de aantallen en betrokken Universiteit Antwerpen-professoren zoals de bron die noemt?

&nbsp;&nbsp;&nbsp;A. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
&nbsp;&nbsp;&nbsp;B. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;C. De analyse is exploratief en niet extern gepubliceerd.
→ **D. 1.858 T4Professional-profielen en 395 profielen van het sportinstrument, met prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen.**

**Bij juist:** De bron noemt precies 1.858 T4Professional-profielen, 395 sportprofielen en de twee professoren van de Universiteit Antwerpen.

**Bij fout:** De overige uitspraken gaan over inhoudsvalidatie, IVOC of de algemene publicatiestatus, niet over aantallen en Antwerpen-professoren van de factoranalyse.

---

### C16

*scenario · bron: ITEMBRON §3.1*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.
> **Gebrek:** afleider B en D staat elders in de bank als juist antwoord.

Een professional vergelijkt de gerapporteerde factorladingen van drivers met die van energieschalen onder de talentversnellers. Welke weergave is correct?

→ **A. Driverschalen 0,90–0,97; energieschalen onder de talentversnellers 0,63–0,84.**
&nbsp;&nbsp;&nbsp;B. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.
&nbsp;&nbsp;&nbsp;C. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp;&nbsp;D. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.

**Bij juist:** De bron rapporteert 0,90–0,97 voor driverschalen en 0,63–0,84 voor energieschalen onder de talentversnellers.

**Bij fout:** Betrouwbaarheid, test-hertest en normgroep zijn andere onderbouwingspunten en vervangen de bronvermelding van de twee factorladingreeksen niet.

---

## Blok D — Interpretatiefouten herkennen

16 items in de bank, 8 in een volle check, 4 in een verkorte.

Soorten: 16 scenario. Sleutelverdeling: A: 4, B: 4, C: 4, D: 4.

Van deze 16 keuze-items hebben 1 een gebrek in de afleiders.

### D01

*scenario · bron: ITEMBRON §2.1*

Een coach vergelijkt de net-score van twee deelnemers en concludeert dat de deelnemer met de hoogste net-score dat construct duidelijk sterker bezit. Welke reactie herkent de interpretatiefout het best?

&nbsp;&nbsp;&nbsp;A. De conclusie klopt alleen wanneer beide deelnemers evenveel blokken invulden.
→ **B. De conclusie is te stellig, want net is ipsatief en vergelijkt constructen binnen één persoon onderling.**
&nbsp;&nbsp;&nbsp;C. De conclusie klopt, want net telt de keuzes als meest herkenbaar op.
&nbsp;&nbsp;&nbsp;D. De conclusie klopt alleen als beide deelnemers dezelfde energiewaarden doorgaven.

**Bij juist:** Net ontstaat uit keuzes binnen blokken en beschrijft hoe constructen zich bij één deelnemer onderling verhouden. Het is daarom geen directe maat om twee personen onderling te rangschikken.

**Bij fout:** De afleiders behandelen net als een persoonsvergelijkende score of voegen voorwaarden toe die de ipsatieve aard niet wegnemen. Daardoor blijft de kernfout bestaan.

---

### D02

*scenario · bron: ITEMBRON §2.1 en §3.2*

Een adviseur noemt een net-score van een deelnemer ‘boven het gemiddelde van vergelijkbare professionals’, terwijl hij alleen het individuele profiel ziet. Waarom is deze duiding fout?

&nbsp;&nbsp;&nbsp;A. Een net-score kan uitsluitend negatief worden geïnterpreteerd.
&nbsp;&nbsp;&nbsp;B. Een gemiddelde mag alleen worden genoemd wanneer energie op itemniveau is gemeten.
→ **C. Er is geen normgroep of referentieverdeling waarmee zo’n gemiddelde kan worden onderbouwd.**
&nbsp;&nbsp;&nbsp;D. Het profiel bevat te weinig constructen om een gemiddelde te berekenen.

**Bij juist:** Voor het instrument bestaat geen normgroep. Zonder empirische referentiegroep is een uitspraak over gemiddeld of bovengemiddeld bij vergelijkbare professionals niet verantwoord.

**Bij fout:** De afleiders noemen beperkingen die niet de ontbrekende referentieverdeling verklaren. Juist het ontbreken van een normgroep maakt deze vergelijking onbewezen.

---

### D03

*scenario · bron: ITEMBRON §2.1*

In een rapport staat avgEnergy = 0. De begeleider zegt meteen dat de deelnemer dit construct neutraal heeft ervaren. Wat is de beste correctie?

&nbsp;&nbsp;&nbsp;A. Dat is zeker juist, want nul is altijd een ingevulde neutrale energiewaarde.
&nbsp;&nbsp;&nbsp;B. Dat is alleen juist bij drivers, omdat daar energie per item wordt bevraagd.
&nbsp;&nbsp;&nbsp;C. Dat betekent dat de deelnemer even vaak positieve als negatieve energie rapporteerde.
→ **D. Dat kan niet worden vastgesteld: nul kan zowel neutraal gemeten energie als het ontbreken van energiewaarden betekenen.**

**Bij juist:** De scorelogica geeft avgEnergy de waarde 0 wanneer er geen energiewaarden zijn. Omdat 0 ook het label neutraal op de energieschaal is, laat dit getal die twee situaties niet onderscheiden.

**Bij fout:** De andere antwoorden doen alsof nul eenduidig een gemeten ervaring of een balans van metingen toont. De terugval bij ontbrekende energiewaarden maakt die zekerheid onjuist.

---

### D04

*scenario · bron: ITEMBRON §2.5*

Een dashboard toont voor een ontbrekende energiemeting de waarde 5. Een manager zegt dat de deelnemer dus precies neutrale energie rapporteerde. Welke interpretatie is correct?

→ **A. De conclusie is fout: 5 bij ontbrekende meting is een conventionele terugval en geen gemeten energie.**
&nbsp;&nbsp;&nbsp;B. De manager heeft gelijk, omdat 5 altijd een feitelijk gemeten energiewaarde is.
&nbsp;&nbsp;&nbsp;C. De manager heeft gelijk, maar alleen wanneer alle blokken zijn ingevuld.
&nbsp;&nbsp;&nbsp;D. De conclusie is alleen onjuist als de deelnemer een lage net-score heeft.

**Bij juist:** ENERGIE_TERUGVAL = 5 is volgens de bron een conventie voor een ontbrekende meting. De aanwezigheid van die waarde toont dus niet dat de deelnemer neutrale energie heeft gemeld.

**Bij fout:** De andere antwoorden maken van de terugvalwaarde alsnog een waarneming of verbinden die aan irrelevante voorwaarden. Daarmee wordt een ontbrekende meting ten onrechte als resultaat gelezen.

---

### D05

*scenario · bron: ITEMBRON §2.5*

Twee energiescores liggen dicht bij elkaar: 7,4 en 7,6. Een rapporteur stelt dat de tweede score aantoonbaar wezenlijk beter is omdat die boven de bandgrens voor hoog ligt. Wat is de juiste reactie?

&nbsp;&nbsp;&nbsp;A. De rapporteur heeft gelijk, want elke grensoverschrijding bewijst een betekenisvol verschil.
→ **B. De bandgrenzen zijn conventies en niet empirisch geijkt; het dossier onderbouwt geen wezenlijk verschil tussen 7,4 en 7,6.**
&nbsp;&nbsp;&nbsp;C. De tweede score is alleen wezenlijk beter wanneer de eerste score uit een driver komt.
&nbsp;&nbsp;&nbsp;D. Het verschil is alleen aantoonbaar wanneer beide scores op een tienschaal staan.

**Bij juist:** De bron vermeldt uitdrukkelijk dat de bandgrenzen ontwikkelaarsconventies zijn en niet op een normgroep zijn geijkt. Zij geeft juist 7,4 en 7,6 als voorbeeld zonder aangetoond wezenlijk verschil.

**Bij fout:** De afleiders verwarren een classificatiegrens met empirisch bewijs of voegen voorwaarden toe die daarvoor geen onderbouwing bieden. Een labelwissel maakt het verschil niet aantoonbaar.

---

### D06

*scenario · bron: ITEMBRON §2.2*

Een professional legt uit dat het label driverRisk het gemiddelde is van de avgEnergy van alle vijf drivers. Welke correctie is nodig?

&nbsp;&nbsp;&nbsp;A. Dat klopt, want alle drivers worden eerst op energie gerangschikt.
&nbsp;&nbsp;&nbsp;B. Dat klopt alleen wanneer de vijf drivers allemaal een net-score boven nul hebben.
→ **C. Dat is fout: driverRisk gebruikt uitsluitend de twee drivers met de hoogste net-score.**
&nbsp;&nbsp;&nbsp;D. Dat is fout, want driverRisk gebruikt uitsluitend de driver met de laagste net-score.

**Bij juist:** Voor driverRisk worden de drivers eerst aflopend op net gesorteerd. Alleen de top twee worden vervolgens gebruikt om het gemiddelde en daarmee het label te bepalen.

**Bij fout:** De andere antwoorden rekenen met alle drivers, met een onjuiste sorteervolgorde of met één laagste driver. Geen daarvan beschrijft de vastgelegde selectie van de top twee.

---

### D07

*scenario · bron: ITEMBRON §2.2*

De derde driver op net-score heeft sterk negatieve avgEnergy. Een begeleider verklaart een laag driverRisk-label uitsluitend vanuit die derde driver. Waarom is dat onjuist?

&nbsp;&nbsp;&nbsp;A. Omdat negatieve avgEnergy nooit invloed heeft op een driverRisk-label.
&nbsp;&nbsp;&nbsp;B. Omdat alleen drivers met positieve avgEnergy voor driverRisk meetellen.
&nbsp;&nbsp;&nbsp;C. Omdat de derde driver altijd dezelfde net-score heeft als de eerste twee.
→ **D. Omdat driverRisk alleen de top twee drivers op net-score gebruikt; de derde driver zit niet in die labelberekening.**

**Bij juist:** De labelberekening beperkt zich tot de twee drivers met de hoogste net-score. De energie van de derde driver kan daarom niet de directe verklaring zijn voor het berekende driverRisk-label.

**Bij fout:** De afleiders ontkennen ten onrechte de rol van negatieve energie, hanteren een verkeerde selectievoorwaarde of doen een ongefundeerde uitspraak over gelijke net-scores.

---

### D08

*scenario · bron: ITEMBRON §2.3*

Na een lage consistentiescore zegt een coach tegen de deelnemer: ‘U bent als persoon niet consistent.’ Welke reactie benoemt de interpretatiefout?

→ **A. Dat is fout: de consistentiescore gaat over de innerlijke samenhang van de gegeven antwoorden, niet over de persoon.**
&nbsp;&nbsp;&nbsp;B. Dat is juist, want de score is een diagnose van een persoonlijke eigenschap.
&nbsp;&nbsp;&nbsp;C. Dat is juist wanneer de deelnemer alle keuzeparen volledig invulde.
&nbsp;&nbsp;&nbsp;D. Dat is fout, want consistentie wordt uitsluitend uit de zelfgemelde beroepsenergie bepaald.

**Bij juist:** De bron omschrijft de consistentiemaat als een beoordeling van de innerlijke samenhang van de antwoorden. Zij mag daarom niet worden omgezet in een oordeel over iemands persoonlijke consistentie.

**Bij fout:** De andere reacties behandelen de score als persoonsdiagnose of beschrijven onjuist hoe die wordt berekend. Daarmee schuiven zij de betekenis van antwoordpatroon naar persoon op.

---

### D09

*scenario · bron: ITEMBRON §2.3*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.

Een assessor zegt dat een deelnemer met uitgesproken positieve en negatieve energie op alle drivers extra punten krijgt voor het onderdeel spreadPart. Welke correctie past hierbij?

&nbsp;&nbsp;&nbsp;A. Dat klopt, want spreadPart beloont grote verschillen tussen energiewaarden.
→ **B. Dat is fout: spreadPart is hoger bij kleinere energiespreiding, zodat uitgesproken energie op alle drivers punten op dit deel kan kosten.**
&nbsp;&nbsp;&nbsp;C. Dat klopt alleen wanneer de drie hoogste drivers positieve avgEnergy hebben.
&nbsp;&nbsp;&nbsp;D. Dat is fout, want spreadPart telt uitsluitend energiewaarden van talent-foci mee.

**Bij juist:** SpreadPart daalt wanneer energySpread groter wordt. Omdat energySpread de som van de absolute avgEnergy over alle drivers is, verliest een uitgesproken patroon juist punten op dit onderdeel.

**Bij fout:** De afleiders keren de richting van spreadPart om of beperken de berekening ten onrechte tot een andere selectie. Zij passen dus niet bij de beschreven scorelogica.

---

### D10

*scenario · bron: ITEMBRON §2.4*

Een deelnemer schat de eigen beroepsenergie hoger in dan de genormaliseerde energie uit de vragenlijst. De rapporteur noemt een positieve energyDiscrepancy een teken van onderschatting. Wat is correct?

&nbsp;&nbsp;&nbsp;A. De rapporteur heeft gelijk, want positieve discrepantie betekent altijd onderschatting.
&nbsp;&nbsp;&nbsp;B. Een positieve discrepantie kan niet voorkomen bij zelfgemelde beroepsenergie.
→ **C. De rapporteur heeft de richting omgedraaid: positief betekent dat de deelnemer zichzelf hoger inschat dan de vragenlijst uitwijst.**
&nbsp;&nbsp;&nbsp;D. De richting hangt uitsluitend af van het aantal ingevulde blokken.

**Bij juist:** EnergyDiscrepancy wordt berekend als baseline min genormaliseerde vragenlijstenergie. Bij een positieve uitkomst is de zelfingeschatte beroepsenergie dus hoger dan de uitkomst uit de vragenlijst.

**Bij fout:** De andere antwoorden draaien de aftrekrichting om, ontkennen de mogelijkheid van een positieve uitkomst of noemen een voorwaarde die niet bepalend is voor de richting.

---

### D11

*scenario · bron: ITEMBRON §2.6*

Een afname krijgt een waarschuwing over de invulwijze. De leidinggevende schrijft in het dossier dat dit bewijst dat de deelnemer onzorgvuldig en onbetrouwbaar is. Wat is de juiste reactie?

&nbsp;&nbsp;&nbsp;A. De waarschuwing is een diagnose van de betrouwbaarheid van de deelnemer.
&nbsp;&nbsp;&nbsp;B. De waarschuwing toont dat het gehele profiel inhoudelijk ongeldig is.
&nbsp;&nbsp;&nbsp;C. De waarschuwing betekent dat de deelnemer geen energievragen heeft beantwoord.
→ **D. De waarschuwing is uitdrukkelijk geen oordeel over de persoon; zij zegt alleen iets over de manier waarop deze vragenlijst is ingevuld.**

**Bij juist:** Afnamekwaliteit is volgens de bron geen score, eigenschap of diagnose van de persoon. De uitkomst betreft uitsluitend de manier waarop deze ene vragenlijst is ingevuld.

**Bij fout:** De afleiders maken van een signaal over de afname een persoonskenmerk, een oordeel over alle profielinhoud of een specifieke ontbrekende vraagsoort. Dat gaat verder dan de bron toestaat.

---

### D12

*scenario · bron: ITEMBRON §2.6*

Bij een afname zijn tijdgegevens beschikbaar voor vier items. Een systeembeheerder wil op basis van het berekende aandeel snelle antwoorden toch een afnamevlag tonen. Welke beoordeling is juist?

→ **A. Onder vijf items met tijdgegevens wordt nooit een vlag gezet, ook al wordt het aandeel wel berekend.**
&nbsp;&nbsp;&nbsp;B. Een vlag is verplicht zodra ook maar één tijdgegeven beschikbaar is.
&nbsp;&nbsp;&nbsp;C. Een vlag is juist wanneer meer dan de helft van de vier antwoorden snel is gegeven.
&nbsp;&nbsp;&nbsp;D. Een vlag is juist zolang de deelnemer niet alle blokken heeft voltooid.

**Bij juist:** De bron legt een minimum van vijf items met tijdgegevens vast. Onder dat minimum kan het aandeel wel worden berekend, maar de afnamekwaliteit zet nooit een vlag.

**Bij fout:** De andere antwoorden vervangen het expliciete minimum door een ander criterium. Zij negeren daarmee de regel dat minder dan vijf tijdmetingen nooit tot een vlag leidt.

---

### D13

*scenario · bron: ITEMBRON §3.3*

Een manager ziet één profiel en stelt dat dit definitief vastlegt welke mogelijkheden de deelnemer ook in de toekomst zal hebben. Welke beoordeling van die conclusie volgt de claimgrens?

&nbsp;&nbsp;&nbsp;A. De conclusie klopt, omdat een profiel iemands mogelijkheden duurzaam meet.
→ **B. De conclusie is fout: het resultaat is een momentopname op het ogenblik van afname en geen vaststaand oordeel over mogelijkheden.**
&nbsp;&nbsp;&nbsp;C. De conclusie klopt alleen wanneer de deelnemer alle energiewaarden heeft ingevuld.
&nbsp;&nbsp;&nbsp;D. De conclusie is fout, omdat resultaten uitsluitend op papier mogen worden besproken.

**Bij juist:** De claimgrens noemt een profiel een momentopname en verbiedt een vaststaand oordeel over iemands mogelijkheden. De manager maakt precies die niet-toegestane stap van moment naar permanente conclusie.

**Bij fout:** De afleiders behandelen het profiel als een duurzame meting, koppelen de fout aan irrelevante volledigheid of voegen een beperking toe die niet in de claimgrens staat.

---

### D14

*scenario · bron: ITEMBRON §3.2*

Een coach vergelijkt twee afnames van dezelfde deelnemer en zegt dat een verschil in score bewijst dat diens profiel stabiel genoeg is om veranderingen precies te meten. Wat ontbreekt aan deze redenering?

&nbsp;&nbsp;&nbsp;A. Niets; de bron rapporteert test-hertestonderzoek als bewijs voor stabiliteit.
&nbsp;&nbsp;&nbsp;B. De redenering is alleen fout wanneer een van beide afnames tijdgegevens mist.
→ **C. Stabiliteit over tijd is niet gemeten, omdat er geen test-hertestonderzoek is gerapporteerd.**
&nbsp;&nbsp;&nbsp;D. De redenering is juist als beide afnames dezelfde bandgrens krijgen.

**Bij juist:** In de onderbouwing staat dat test-hertestonderzoek ontbreekt en stabiliteit over tijd niet is gemeten. Een verschil tussen twee afnames kan daarom niet als bewezen precisie of stabiliteit worden uitgelegd.

**Bij fout:** De andere antwoorden voegen niet-gerapporteerd bewijs toe of stellen voorwaarden die het ontbrekende stabiliteitsonderzoek niet vervangen. Daarmee maken zij de conclusie onterecht zeker.

---

### D15

*scenario · bron: ITEMBRON §3.2*

Een opdrachtgever wil uit een profiel afleiden dat een deelnemer aantoonbaar beter zal functioneren in toekomstige projecten. Welke reactie bewaakt de interpretatiegrens?

&nbsp;&nbsp;&nbsp;A. Dat is verantwoord, want de samenhang met functioneren is in het instrument vastgesteld.
&nbsp;&nbsp;&nbsp;B. Dat is alleen verantwoord wanneer de driverRisk-score laag is.
&nbsp;&nbsp;&nbsp;C. Dat is onjuist, omdat het instrument geen enkele score berekent.
→ **D. Dat is niet onderbouwd, want samenhang met uitkomsten buiten het instrument, zoals functioneren, is niet onderzocht.**

**Bij juist:** De bron vermeldt dat de samenhang met uitkomsten buiten het instrument, waaronder functioneren, niet is onderzocht. Het profiel kan daarom geen aantoonbare voorspelling van toekomstig functioneren dragen.

**Bij fout:** De afleiders doen alsof externe samenhang is vastgesteld, koppelen die aan een interne labelscore of ontkennen ten onrechte alle scoreberekeningen. Geen daarvan respecteert de onderzoeksgrens.

---

### D16

*scenario · bron: ITEMBRON §2.5*

Een rapporteur legt het label midden uit alsof daarvoor eigen numerieke bandgrenzen bestaan. Welke correctie is volgens de energieschaal het meest precies?

→ **A. Dat is fout: midden is een samenvoeging zonder eigen getallen.**
&nbsp;&nbsp;&nbsp;B. Dat klopt, want midden heeft een eigen grens tussen stevig en wisselend.
&nbsp;&nbsp;&nbsp;C. Dat klopt alleen wanneer alle energiewaarden uit de vragenlijst komen.
&nbsp;&nbsp;&nbsp;D. Midden heeft eigen grenzen, maar uitsluitend voor drivers.

**Bij juist:** De driedeling hoog, midden en laag is volgens de bron een samenvoeging zonder eigen getallen. Een apart label midden kan daarom niet als zelfstandig afgebakende band worden gelezen.

**Bij fout:** De afleiders kennen aan midden een eigen grens toe of laten die afhangen van de energiebron of familie. Zulke afzonderlijke bandgrenzen zijn niet vastgelegd in de energieschaal.

---

## Blok E — Ethiek, consent en GDPR

16 items in de bank, 8 in een volle check, 4 in een verkorte.

Soorten: 1 juistfout, 1 meerkeuze, 14 scenario. Sleutelverdeling: A: 3, B: 4, C: 4, D: 4, juist: 1.

Van deze 15 keuze-items hebben 1 een gebrek in de afleiders.

### E01

*scenario · bron: ITEMBRON §4*

Een vrijwillige deelnemer start een afname van het T4P Business Kompas. Welke rechtsgrond hoort volgens het dossier standaard bij deze afname?

&nbsp;&nbsp;&nbsp;A. Gerechtvaardigd belang, omdat de deelnemer een vragenlijst invult.
→ **B. Toestemming, omdat de deelnemer vrijwillig invult en die kan intrekken.**
&nbsp;&nbsp;&nbsp;C. Overeenkomst, omdat elke ingevulde vragenlijst een licentieovereenkomst is.
&nbsp;&nbsp;&nbsp;D. Wettelijke verplichting, omdat het instrument persoonsgegevens verwerkt.

**Bij juist:** Bij een afname van een deelnemer is toestemming de standaardrechtsgrond. De vrijwillige deelnemer kan die toestemming ook intrekken.

**Bij fout:** Overeenkomst is in dit dossier de standaardrechtsgrond voor een bekwaamheidsronde van een geaccrediteerde, niet voor een deelnemer-afname.

---

### E02

*scenario · bron: ITEMBRON §4*

> **Gebrek:** de sleutel deelt merkbaar meer woorden met de stam dan elke afleider.

Een geaccrediteerde legt binnen zijn licentie een bekwaamheidsproef af. Welke rechtsgrond geldt hiervoor volgens het dossier standaard?

&nbsp;&nbsp;&nbsp;A. Toestemming, omdat een proef altijd vrijwillig is.
&nbsp;&nbsp;&nbsp;B. Gerechtvaardigd belang, omdat de proef de kwaliteit bewaakt.
→ **C. Overeenkomst, omdat de bekwaamheidsproef binnen een licentieovereenkomst plaatsvindt.**
&nbsp;&nbsp;&nbsp;D. Een wettelijke verplichting, omdat accreditatie verplicht geregistreerd moet worden.

**Bij juist:** Voor bekwaamheidsrondes van geaccrediteerden staat overeenkomst als standaardrechtsgrond geregistreerd. De proef vindt plaats binnen de licentieovereenkomst.

**Bij fout:** Toestemming is de standaardrechtsgrond voor de vrijwillige deelnemer-afname. Het dossier maakt juist inhoudelijk onderscheid met de bekwaamheidsproef.

---

### E03

*scenario · bron: ITEMBRON §4*

Een deelnemer meldt tijdens een lopende afname dat hij zijn toestemming intrekt. Wat is de passende onmiddellijke consequentie voor de verwerking?

&nbsp;&nbsp;&nbsp;A. De verwerking loopt door tot de afname automatisch is afgerond.
&nbsp;&nbsp;&nbsp;B. Alleen toekomstige rapporten worden tegengehouden; de verwerking zelf verandert niet.
&nbsp;&nbsp;&nbsp;C. De toestemming wordt vervangen door de licentieovereenkomst van de coach.
→ **D. De verwerking stopt, omdat er zonder toestemming geen rechtsgrond meer is.**

**Bij juist:** Het dossier bepaalt uitdrukkelijk dat het intrekken van toestemming gevolg moet hebben. Zonder rechtsgrond stopt de verwerking.

**Bij fout:** Een ingetrokken toestemming mag niet zonder gevolg blijven. De deelnemer-afname steunt standaard op toestemming en de verwerking stopt dan.

---

### E04

*scenario · bron: ITEMBRON §4*

Een geaccrediteerde wil zijn bekwaamheidsronde stopzetten en vraagt om zijn toestemming in te trekken. Welke uitleg sluit aan bij het dossier?

→ **A. De ronde is standaard gebaseerd op overeenkomst; presenteer dit niet als een deelnemerstoestemming die kan worden ingetrokken.**
&nbsp;&nbsp;&nbsp;B. De ronde is standaard gebaseerd op toestemming, dus intrekken is het juiste kader.
&nbsp;&nbsp;&nbsp;C. Elke bekwaamheidsronde is gebaseerd op een wettelijke verplichting.
&nbsp;&nbsp;&nbsp;D. De rechtsgrond hangt uitsluitend af van de voorkeur van de geaccrediteerde.

**Bij juist:** Een bekwaamheidsproef van een geaccrediteerde valt volgens het dossier standaard onder overeenkomst, binnen een licentieovereenkomst.

**Bij fout:** Wie de rechtsgronden verwisselt, belooft de geaccrediteerde ten onrechte een intrekkingsrecht dat bij toestemming van een deelnemer hoort.

---

### E05

*scenario · bron: ITEMBRON §4*

Een beheerder controleert de registratie van een deelnemer-afname. Welke combinatie moet volgens het dossier in de afnametabel aanwezig zijn naast de rechtsgrond?

&nbsp;&nbsp;&nbsp;A. Alleen het tijdstip en de naam van de coach.
→ **B. Het verwerkingsdoel en de versie van de privacyverklaring.**
&nbsp;&nbsp;&nbsp;C. Alleen het rapportformat en de energiebalk.
&nbsp;&nbsp;&nbsp;D. De bewaartermijn en een lijst met externe verwerkers.

**Bij juist:** De twee relevante tabellen dragen naast de rechtsgrond ook verwerkingsdoel en privacyverklaring_versie. Die gegevens leggen doel en informatieversie vast.

**Bij fout:** Het dossier noemt voor beide tabellen het verwerkingsdoel en de privacyverklaring_versie. Het noemt hier geen bewaartermijn of namen van verwerkers.

---

### E06

*scenario · bron: AVG: doelbinding*

Een werkgever wil bestaande profielgegevens later gebruiken voor een intern onderzoeksproject dat niet het oorspronkelijke verwerkingsdoel is. Wat verlangt doelbinding eerst?

&nbsp;&nbsp;&nbsp;A. De gegevens zonder verdere beoordeling hergebruiken, omdat de werkgever ze al bezit.
&nbsp;&nbsp;&nbsp;B. De werkgever mag het doel achteraf aanpassen zonder de betrokkenen te informeren.
→ **C. Eerst beoordelen of het nieuwe gebruik verenigbaar is met het oorspronkelijke doel of een passende nieuwe grondslag vereist.**
&nbsp;&nbsp;&nbsp;D. De gegevens onmiddellijk openbaar maken, zodat het nieuwe doel transparant wordt.

**Bij juist:** Doelbinding begrenst verder gebruik van persoonsgegevens. Een ander doel vraagt eerst een beoordeling van verenigbaarheid of een passende nieuwe grondslag.

**Bij fout:** Dat een organisatie gegevens al bezit, maakt elk later gebruik niet automatisch toegestaan. Het oorspronkelijke verwerkingsdoel blijft richtinggevend.

---

### E07

*scenario · bron: ITEMBRON §4; AVG: transparantie*

Vóór een deelnemer persoonsgegevens invult, wil hij weten waarvoor zijn gegevens worden gebruikt. Welke informatie moet in elk geval duidelijk beschikbaar zijn?

&nbsp;&nbsp;&nbsp;A. Alleen de naam van het instrument en de invulduur.
&nbsp;&nbsp;&nbsp;B. Alleen de technische methode waarmee de score wordt berekend.
&nbsp;&nbsp;&nbsp;C. Een mondelinge belofte dat de gegevens nooit worden geraadpleegd.
→ **D. Het verwerkingsdoel en de toepasselijke privacyverklaring, in begrijpelijke vorm.**

**Bij juist:** Transparantie vereist dat de betrokkene begrijpelijk wordt geïnformeerd over de verwerking. Het dossier registreert bovendien doel en versie van de privacyverklaring.

**Bij fout:** Alleen een instrumentnaam of invulduur vertelt niet waarvoor persoonsgegevens worden verwerkt. Het verwerkingsdoel en de privacy-informatie moeten duidelijk zijn.

---

### E08

*scenario · bron: AVG: rechtmatigheid en doelbinding*

Een leidinggevende vraagt zonder nadere toelichting alle individuele rapporten van het team op. Wat is de meest privacybewuste eerste reactie?

→ **A. Eerst nagaan of er voor deze toegang een passend, duidelijk doel en een geldige grondslag bestaat.**
&nbsp;&nbsp;&nbsp;B. De rapporten meteen delen, want de leidinggevende heeft een hiërarchische rol.
&nbsp;&nbsp;&nbsp;C. De rapporten aan alle teamleden doorsturen, zodat de behandeling gelijk is.
&nbsp;&nbsp;&nbsp;D. De leidinggevende laten kiezen welke rapporten inhoudelijk het interessantst zijn.

**Bij juist:** Een leidinggevende krijgt niet automatisch toegang tot alle persoonsgegevens. Voor verstrekking moet het doel duidelijk zijn en moet een geldige grondslag bestaan.

**Bij fout:** Een hiërarchische positie op zichzelf rechtvaardigt geen onbeperkte inzage. Persoonsgegevens mogen niet los van doel en grondslag worden gedeeld.

---

### E09

*scenario · bron: ITEMBRON §3.3*

Een organisatie wil een medewerker niet promoveren uitsluitend omdat een profielresultaat volgens haar ongunstig oogt. Welke handelwijze past bij de claimgrens?

&nbsp;&nbsp;&nbsp;A. Het profiel als enige grond gebruiken, zolang de score hoog genoeg is.
→ **B. Het profiel gebruiken als gespreksinput, maar niet als enige basis voor de promotiebeslissing.**
&nbsp;&nbsp;&nbsp;C. De uitkomst behandelen als een vast oordeel over de mogelijkheden van de medewerker.
&nbsp;&nbsp;&nbsp;D. De medewerker vragen vooraf te tekenen dat de score doorslaggevend mag zijn.

**Bij juist:** Het profiel is een gespreksinstrument met inzichten en richtingaanwijzers. Het mag niet als enige basis dienen voor een beslissing over promotie.

**Bij fout:** Volgens de claimgrens is een resultaat een momentopname en geen vaststaand oordeel. Een profiel mag daarom niet alleen de promotiebeslissing dragen.

---

### E10

*scenario · bron: ITEMBRON §2.6*

Bij een afname worden enkele zeer korte invultijden gesignaleerd. Een coach noemt de deelnemer daarop onzorgvuldig en ongeschikt. Wat is de correcte duiding?

&nbsp;&nbsp;&nbsp;A. De afnamekwaliteit bewijst een blijvende eigenschap van de deelnemer.
&nbsp;&nbsp;&nbsp;B. De afnamekwaliteit is een diagnose van de persoonlijkheid van de deelnemer.
→ **C. De afnamekwaliteit zegt alleen iets over de manier waarop deze ene vragenlijst is ingevuld.**
&nbsp;&nbsp;&nbsp;D. Een tijdssignaal betekent dat het volledige profiel inhoudelijk ongeldig is.

**Bij juist:** De uitkomst over afnamekwaliteit is uitdrukkelijk geen oordeel over de persoon. Ze gaat uitsluitend over de wijze van invullen van deze ene vragenlijst.

**Bij fout:** Een afnamekwaliteitssignaal is volgens het dossier geen score, eigenschap of diagnose. Het mag dus niet als persoonsbeoordeling worden voorgesteld.

---

### E11

*scenario · bron: ITEMBRON §3.3*

In een gesprek stelt een coach dat het profiel definitief vastlegt wat een deelnemer wel en niet kan. Welke correctie is nodig?

&nbsp;&nbsp;&nbsp;A. Dat klopt, want een profiel is een blijvende vaststelling van mogelijkheden.
&nbsp;&nbsp;&nbsp;B. Dat klopt alleen wanneer de deelnemer het rapport heeft ondertekend.
&nbsp;&nbsp;&nbsp;C. Een profielresultaat geldt alleen als vaststaand oordeel bij een tweede afname.
→ **D. Een profielresultaat is een momentopname en geen vaststaand oordeel over iemands mogelijkheden.**

**Bij juist:** De claimgrens omschrijft een resultaat als een momentopname op het moment van afname. Het is geen vaststaand oordeel over iemands mogelijkheden.

**Bij fout:** Het dossier laat niet toe om een profiel als definitieve vaststelling van mogelijkheden te presenteren. De juiste duiding blijft die van een momentopname.

---

### E12

*scenario · bron: AVG art. 22*

Een werkgever wil software automatisch laten bepalen welke medewerkers een ingrijpende arbeidsbeslissing krijgen, uitsluitend op basis van profielgegevens. Welk AVG-punt is hierbij centraal?

→ **A. De bijzondere bescherming rond uitsluitend geautomatiseerde besluiten met rechtsgevolgen of vergelijkbare significante gevolgen moet worden nageleefd.**
&nbsp;&nbsp;&nbsp;B. Een volledig geautomatiseerde, ingrijpende beslissing mag zonder extra beoordeling altijd worden uitgevoerd.
&nbsp;&nbsp;&nbsp;C. Het volstaat dat de werkgever de betrokkene achteraf informeert over het genomen besluit.
&nbsp;&nbsp;&nbsp;D. Geautomatiseerde besluiten vallen buiten de AVG wanneer er een profiel wordt gebruikt.

**Bij juist:** Artikel 22 AVG geeft betrokkenen bijzondere bescherming tegen uitsluitend geautomatiseerde individuele besluiten met rechtsgevolgen of vergelijkbaar significante gevolgen.

**Bij fout:** Een ingrijpend besluit verdwijnt niet buiten de AVG omdat software het uitvoert. Juist uitsluitend geautomatiseerde besluitvorming vraagt bijzondere aandacht.

---

### E13

*scenario · bron: AVG: recht op rectificatie*

Een deelnemer ziet dat zijn contactgegeven in de registratie onjuist is en vraagt om verbetering. Welk AVG-recht wordt hiermee uitgeoefend?

&nbsp;&nbsp;&nbsp;A. Het recht om iedere verwerking automatisch te laten voortzetten.
→ **B. Het recht op rectificatie van onjuiste persoonsgegevens.**
&nbsp;&nbsp;&nbsp;C. Het recht om de gegevens van andere deelnemers te vergelijken.
&nbsp;&nbsp;&nbsp;D. Het recht om de oorspronkelijke grondslag van een geaccrediteerde te kiezen.

**Bij juist:** De AVG kent betrokkenen het recht toe om onjuiste persoonsgegevens te laten rectificeren. Dit verzoek gaat precies over een fout contactgegeven.

**Bij fout:** Een verzoek om een onjuist contactgegeven te verbeteren gaat niet over toegang tot gegevens van anderen of over het kiezen van een rechtsgrond.

---

### E14

*scenario · bron: AVG: recht op wissing*

Een deelnemer vraagt om verwijdering van zijn persoonsgegevens nadat hij de verwerking niet langer nodig acht. Welk uitgangspunt is juist?

&nbsp;&nbsp;&nbsp;A. Een verwijderingsverzoek hoeft nooit inhoudelijk te worden beoordeeld.
&nbsp;&nbsp;&nbsp;B. Alleen een geaccrediteerde kan om wissing vragen, omdat die een overeenkomst heeft.
→ **C. De deelnemer kan zich beroepen op het recht op wissing; de organisatie moet het verzoek volgens de AVG beoordelen.**
&nbsp;&nbsp;&nbsp;D. Een verzoek om wissing verandert automatisch elke andere betrokkene in een deelnemer.

**Bij juist:** Het recht op wissing geeft betrokkenen onder de AVG de mogelijkheid verwijdering van persoonsgegevens te vragen. Het verzoek moet inhoudelijk worden beoordeeld.

**Bij fout:** Een betrokkene hoeft geen geaccrediteerde te zijn om een beroep op wissing te kunnen doen. Een organisatie kan zo'n verzoek niet zonder beoordeling negeren.

---

### E15

*meerkeuze · bron: AVG: dataminimalisatie*

Welke keuze illustreert het AVG-beginsel van dataminimalisatie het best bij het organiseren van een profielafname?

&nbsp;&nbsp;&nbsp;A. Alle beschikbare personeelsgegevens verzamelen voor mogelijk toekomstig gebruik.
&nbsp;&nbsp;&nbsp;B. Van iedere deelnemer dezelfde extra achtergrondinformatie vragen, ongeacht het doel.
&nbsp;&nbsp;&nbsp;C. Persoonsgegevens verzamelen totdat de organisatie geen nieuwe velden meer kan bedenken.
→ **D. Alleen persoonsgegevens verzamelen die nodig zijn voor het vooraf bepaalde verwerkingsdoel.**

**Bij juist:** Dataminimalisatie betekent dat persoonsgegevens toereikend, ter zake dienend en beperkt moeten zijn tot wat nodig is voor het verwerkingsdoel.

**Bij fout:** Mogelijk toekomstig nut is geen reden om onbeperkt gegevens te verzamelen. Het uitgangspunt is beperking tot wat voor het doel nodig is.

---

### E16

*juistfout · bron: ITEMBRON §4*

Zowel de tabel voor deelnemer-afnames als die voor bekwaamheidsrondes bevat volgens het dossier een verwerkingsdoel en een versie van de privacyverklaring.

→ **juist**

**Bij juist:** Het dossier vermeldt uitdrukkelijk dat beide tabellen verwerkingsdoel en privacyverklaring_versie dragen, naast hun onderscheiden standaardrechtsgrond.

**Bij fout:** Dit is geen eigenschap van slechts één tabel. Het dossier beschrijft deze twee velden expliciet als aanwezig in beide relevante tabellen.

---

## Herkomst van de antwoorden

De blokken A tot D verwijzen uitsluitend naar `docs/ITEMBRON-T4P-KENNISCHECK.md`,
het brondossier dat rechtstreeks uit de code is geoogst: de instrumentdefinitie
van het T4P Business Kompas, `server/scoring.ts`, `shared/energie-schaal.ts`,
`shared/onderbouwing-t4professional.ts` en de rechtsgronden op `afnames` en
`bekwaamheid_rondes`. Zes items in blok E verwijzen naar de AVG zelf, omdat de
wet daar de maatstaf is en niet de code. Beide regels staan vast in
`tests/bekwaamheid-itemcorpus.test.ts`.

## Wat er nog niet onder ligt

`p_waarde` en `discriminatie` zijn bij alle tachtig items leeg. Dat is met opzet:
er zijn nul afnames. De analyselaag `server/bekwaamheid/itemanalyse.ts` kan die
getallen berekenen maar zwijgt onder twintig afnames per item. Tot dat moment is
van geen enkel item bekend of het te moeilijk is, te makkelijk, of omgekeerd
werkt.

De drempel van 60% uit §4.3 is een **conventie en geen ijking**: een
Angoff-procedure staat permanent buiten bereik. Dat is dezelfde status als de
energiebanden 7,5 / 5 / 3, waar `shared/energie-schaal.ts` woordelijk
"CONVENTIE, GEEN IJKING" bij zet.
