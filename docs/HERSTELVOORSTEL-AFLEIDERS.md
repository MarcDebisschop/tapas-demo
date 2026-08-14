# Herstelvoorstel afleiders — itembank T4P Business Kompas

Ter keuring. **Het corpus is niet gewijzigd.** Dit document zet per item het
bestaande item en het voorstel naast elkaar. Wat je goedkeurt, wordt daarna in
`itemcorpus-t4p.json` gezet, opnieuw gegenereerd en getest.

## De regel achter het voorstel

Het gebrek in de bank was dat afleiders **ware beweringen over een ander feit**
waren. Dan meet het item of de kandidaat de vraag bij het antwoord kan zoeken,
niet of hij het onderwerp kent.

De regel die het voorstel volgt: **elke afleider is een onware variant van het
feit waar de stam over gaat.** Alle opties spreken dus over hetzelfde onderwerp,
en precies één is juist. Elke afleider is bovendien een denkfout die iemand
werkelijk kan maken — een omgekeerde grens, een verwisselde familie, een
gemiddelde dat voor een norm wordt gehouden.

Bij elke afleider staat de bronparagraaf die hem onjuist maakt. Geen enkele
afleider rust op iets wat niet in `docs/ITEMBRON-T4P-KENNISCHECK.md` staat.

## Wat de meting van het voorstel zegt

| Controle | Uitkomst |
| --- | --- |
| Items met een gebrek | 21 → 4 (17 hersteld, nul nieuw ontstaan) |
| Foutmeldingen herschreven | 15 van de 17, omdat de oude tekst de oude afleiders beschreef |
| Formele eisen van `valideerItem` | alle 80 items in orde |
| Hoogste woordoverlap met de STM-oefenbank | 0,29 — de grens is 0,70 |
| Sleutelverdeling over de bank | A17 · B19 · C19 · D18, ongewijzigd |
| Aantal items, blokken, soorten, bronnen | ongewijzigd |

De vier resterende zijn geen restschuld maar valse treffers van mijn eigen
meting. Ze staan onderaan verantwoord.

---

## De zeventien voorstellen

### A01

*meerkeuze · bron: ITEMBRON §1.1*

**Vraag** (ongewijzigd)

> Welke energiemodus past bij de familie Drivers wanneer de afname-instructie wordt toegepast?

**Was**

**→** A. Drivers hebben energiemodus item; energie wordt alleen bij de gekozen meest en minst bevraagd.
&nbsp;&nbsp; B. Talent-foci hebben energiemodus block.
&nbsp;&nbsp; C. Talent-versnellers hebben energiemodus block.
&nbsp;&nbsp; D. connection0to10 heeft bereik 0 tot 10.

**Wordt**

**→ A. Drivers hebben energiemodus item; energie wordt alleen bij de gekozen meest en minst bevraagd.**
&nbsp;&nbsp; B. Drivers hebben energiemodus block; energie wordt per blok bevraagd en niet per uitspraak.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: drivers hebben modus item, niet block.</sub>
&nbsp;&nbsp; C. Drivers hebben energiemodus item; energie wordt bij elke uitspraak van het blok bevraagd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1: de energievraag is beperkt tot de gekozen meest en minst, niet alle uitspraken.</sub>
&nbsp;&nbsp; D. Drivers hebben energiemodus item; energie wordt alleen bij de gekozen minst herkenbare uitspraak bevraagd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1: het zijn beide gekozen uitspraken, meest én minst.</sub>

Toelichting bij juist: Bij drivers is de energiemodus item: energie wordt alleen gevraagd bij de gekozen meest en minst herkenbare uitspraken. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De denkfout is het verwarren van drivers met de twee talentfamilies. Daar wordt energie per blok, niet per item, bevraagd.
>
> **Wordt: De denkfouten zijn: drivers een blokmodus geven, of de energievraag uitbreiden naar alle uitspraken van het blok in plaats van alleen de twee gekozen uitspraken.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### A03

*meerkeuze · bron: ITEMBRON §1.1*

**Vraag — gewijzigd**

> Was: Welke beschrijving onderbouwt dat Talent-foci en Talent-versnellers dezelfde energiemodus hebben?
>
> **Wordt: Bij welke families wordt de energie per blok bevraagd in plaats van per afzonderlijke uitspraak?**

Waarom: De oude stam noemde de uitkomst al ('dat Talent-foci en Talent-versnellers dezelfde energiemodus hebben') en het juiste antwoord herhaalde die bewering woordelijk. Het item was te maken zonder kennis van het instrument.

**Was**

&nbsp;&nbsp; A. Drivers hebben vijf constructen en tien blokken.
**→** B. Talent-foci en Talent-versnellers hebben energiemodus block.
&nbsp;&nbsp; C. Drivers hebben energiemodus item.
&nbsp;&nbsp; D. De sectie connection heeft type numeric-scale en vier vragen.

**Wordt**

&nbsp;&nbsp; A. Bij Drivers en Talent-foci.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: Drivers hebben modus item.</sub>
**→ B. Bij Talent-foci en Talent-versnellers.**
&nbsp;&nbsp; C. Bij Drivers en Talent-versnellers.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: Drivers hebben modus item.</sub>
&nbsp;&nbsp; D. Bij alle drie de families.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: Drivers vormen de uitzondering.</sub>

Toelichting bij juist: Talent-foci en Talent-versnellers hebben beide energiemodus block. Daardoor wordt de energie bij deze twee families per blok bevraagd. *(ongewijzigd)*

Toelichting bij fout: De denkfout is Drivers bij een blokmodus plaatsen. Drivers hebben juist de afwijkende energiemodus item binnen het instrument. *(ongewijzigd)*

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### A04

*meerkeuze · bron: ITEMBRON §1; ITEMBRON §1.1*

**Vraag** (ongewijzigd)

> Een gekozen uitspraak is een driver. Op welk moment hoort de energie daarbij te worden uitgevraagd?

**Was**

&nbsp;&nbsp; A. Talent-foci hebben energiemodus block.
&nbsp;&nbsp; B. De sectie connection heeft vier vragen op een schaal van 0 tot 10.
**→** C. Bij de gekozen meest en minst herkenbare uitspraak.
&nbsp;&nbsp; D. Main heeft 34 blokken.

**Wordt**

&nbsp;&nbsp; A. Na afronding van het blok waarin de uitspraak stond.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: dat is de blokmodus van de twee talentfamilies.</sub>
&nbsp;&nbsp; B. Bij elke uitspraak van het blok, ongeacht wat er gekozen is.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1: de bevraging is beperkt tot de gekozen uitspraken.</sub>
**→ C. Bij de gekozen meest en minst herkenbare uitspraak.**
&nbsp;&nbsp; D. Alleen bij de gekozen meest herkenbare uitspraak, niet bij de minst.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1: ook bij de minst herkenbare uitspraak.</sub>

Toelichting bij juist: De instructie koppelt energie bij drivers aan itemniveau, en beperkt die bevraging tot de gekozen meest en minst herkenbare uitspraken. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De denkfout is een blok- of sectiemeting toepassen op een driver. De bron maakt voor drivers expliciet een itemniveau-uitzondering.
>
> **Wordt: De denkfouten zijn: de blokmodus van de talentfamilies op een driver toepassen, de energievraag naar alle uitspraken uitbreiden, of hem tot de meest herkenbare beperken. Het zijn beide gekozen uitspraken.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### A08

*meerkeuze · bron: ITEMBRON §1.1*

**Vraag** (ongewijzigd)

> Welke combinatie beschrijft het structurele verschil tussen Talent-foci en Talent-versnellers correct?

**Was**

&nbsp;&nbsp; A. Drivers hebben vijf constructen en tien blokken met energiemodus item.
**→** B. Talent-foci hebben vijf constructen en tien blokken; Talent-versnellers zes constructen en veertien blokken.
&nbsp;&nbsp; C. Talent-foci hebben energiemodus block.
&nbsp;&nbsp; D. Talent-versnellers hebben energiemodus block.

**Wordt**

&nbsp;&nbsp; A. Talent-foci hebben zes constructen en veertien blokken; Talent-versnellers vijf constructen en tien blokken.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: de aantallen staan omgekeerd.</sub>
**→ B. Talent-foci hebben vijf constructen en tien blokken; Talent-versnellers zes constructen en veertien blokken.**
&nbsp;&nbsp; C. Beide families hebben vijf constructen; alleen het aantal blokken verschilt, tien tegenover veertien.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: Talent-versnellers hebben zes constructen, niet vijf.</sub>
&nbsp;&nbsp; D. Talent-foci hebben vijf constructen en veertien blokken; Talent-versnellers zes constructen en tien blokken.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §1.1: de blokaantallen staan gekruist.</sub>

Toelichting bij juist: De twee talentfamilies delen de blokgebonden energiemodus, maar verschillen in omvang: vijf constructen en tien blokken tegenover zes en veertien. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De denkfout is hun aantallen omdraaien of Talent-foci een itemmodus geven. De bron reserveert itemenergie uitsluitend voor Drivers.
>
> **Wordt: De denkfout is de aantallen omdraaien of kruisen. Talent-foci hebben vijf constructen en tien blokken, Talent-versnellers zes en veertien.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### A17

*meerkeuze · bron: ITEMBRON §3.1*

**Vraag** (ongewijzigd)

> Welke factorladingen worden in de onderzoeksinformatie aan de driverschalen toegeschreven?

**Was**

&nbsp;&nbsp; A. 0,63–0,84 voor energieschalen onder de talentversnellers.
**→** B. 0,90–0,97.
&nbsp;&nbsp; C. 1.858 T4Professional-profielen en 395 profielen van het sportinstrument.
&nbsp;&nbsp; D. Vier onafhankelijke experts voor externe inhoudsvalidatie.

**Wordt**

&nbsp;&nbsp; A. 0,63–0,84.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: dat is de reeks voor de energieschalen onder de talentversnellers.</sub>
**→ B. 0,90–0,97.**
&nbsp;&nbsp; C. 0,70–0,89.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: geen gerapporteerde reeks.</sub>
&nbsp;&nbsp; D. 0,55–0,78.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: geen gerapporteerde reeks.</sub>

Toelichting bij juist: De bron vermeldt factorladingen van 0,90–0,97 voor de driverschalen. De range 0,63–0,84 betreft energieschalen onder de talentversnellers. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De denkfout is een andere gerapporteerde range of een deelnemersaantal als factorlading voor drivers gebruiken. De driverschalen hebben hun eigen range.
>
> **Wordt: De denkfout is de reeks van de energieschalen onder de talentversnellers voor die van de driverschalen houden, of een reeks noemen die de bron niet rapporteert.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C01

*scenario · bron: ITEMBRON §3.1*

**Vraag — gewijzigd**

> Was: Een coach zegt dat de factoranalyse al als extern gepubliceerde bevestiging kan worden aangehaald. Welke reactie past bij de beschikbare onderbouwing?
>
> **Wordt: Een coach wil de factoranalyse aanhalen als bevestiging uit de wetenschappelijke literatuur. Wat is volgens de onderbouwing de stand van zaken?**

Waarom: De oude stam bevatte de woorden 'extern gepubliceerd' die in het juiste antwoord terugkwamen, terwijl de drie afleiders over andere onderwerpen gingen.

**Was**

&nbsp;&nbsp; A. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp; B. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp; C. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
**→** D. De analyse is exploratief en niet extern gepubliceerd.

**Wordt**

&nbsp;&nbsp; A. De analyse is confirmatorisch en in een vaktijdschrift verschenen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: exploratief, en niet extern gepubliceerd.</sub>
&nbsp;&nbsp; B. De analyse is exploratief en als bijlage bij een publicatie van de Universiteit Antwerpen verschenen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: niet extern gepubliceerd, ook niet als bijlage.</sub>
&nbsp;&nbsp; C. De analyse is confirmatorisch, maar de resultaten zijn niet vrijgegeven.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de analyse is exploratief, niet confirmatorisch.</sub>
**→ D. De analyse is exploratief en niet extern gepubliceerd.**

Toelichting bij juist: Dit is juist: de bron noemt de analyse exploratief en niet extern gepubliceerd. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De overige uitspraken zijn wel brongegevens, maar zij beschrijven niet de publicatiestatus van de factoranalyse.
>
> **Wordt: De denkfouten zijn: de analyse confirmatorisch noemen, of haar als gepubliceerd voorstellen. Ze is exploratief en niet extern gepubliceerd.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C02

*scenario · bron: ITEMBRON §3.1 en §3.2*

**Vraag** (ongewijzigd)

> Een adviseur wil de gerapporteerde factorladingen presenteren als een berekende betrouwbaarheidscoëfficiënt. Wat is de meest correcte begrenzing?

**Was**

**→** A. Er is geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.
&nbsp;&nbsp; B. De factorladingen voor de driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp; C. De factorladingen voor energieschalen onder de talentversnellers liggen tussen 0,63 en 0,84.
&nbsp;&nbsp; D. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.

**Wordt**

**→ A. Er is geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.**
&nbsp;&nbsp; B. Cronbachs alfa is berekend maar niet gerapporteerd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: geen enkele coëfficiënt is berekend.</sub>
&nbsp;&nbsp; C. De factorladingen mogen als ondergrens van Cronbachs alfa worden gelezen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1 en §3.2: een factorlading is geen betrouwbaarheidsmaat en de bron legt dat verband niet.</sub>
&nbsp;&nbsp; D. McDonalds omega is berekend voor de driverschalen, Cronbachs alfa niet.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: geen van beide is berekend.</sub>

Toelichting bij juist: De bron vermeldt factorladingen, maar geen berekende of gerapporteerde betrouwbaarheidscoëfficiënt. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De andere brongegevens gaan over factorladingen of de publicatiestatus, niet over een berekende betrouwbaarheidscoëfficiënt.
>
> **Wordt: De denkfouten zijn: aannemen dat een coëfficiënt wel berekend maar niet gerapporteerd is, of een factorlading als betrouwbaarheidsmaat lezen. Een lading en een coëfficiënt zijn verschillende grootheden.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C04

*scenario · bron: ITEMBRON §3.2*

**Vraag** (ongewijzigd)

> Een professional zegt dat een tweede afname na verloop van tijd dezelfde uitkomst zal bevestigen. Welke uitspraak bewaakt de grens het best?

**Was**

&nbsp;&nbsp; A. Er is geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
**→** B. De stabiliteit over tijd is niet gemeten, omdat er geen test-hertestonderzoek is.
&nbsp;&nbsp; C. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.
&nbsp;&nbsp; D. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.

**Wordt**

&nbsp;&nbsp; A. De stabiliteit over tijd is gemeten op de 1.858 profielen van de factoranalyse.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: stabiliteit over tijd is niet gemeten; de factoranalyse meet iets anders.</sub>
**→ B. De stabiliteit over tijd is niet gemeten, omdat er geen test-hertestonderzoek is.**
&nbsp;&nbsp; C. Een test-hertestonderzoek is uitgevoerd, maar de coëfficiënt is niet gerapporteerd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: er is geen test-hertestonderzoek.</sub>
&nbsp;&nbsp; D. De factorladingen van 0,90–0,97 tonen aan dat de uitkomst over tijd stabiel is.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1 en §3.2: een factorlading zegt niets over stabiliteit over tijd.</sub>

Toelichting bij juist: Dit volgt rechtstreeks uit de bron: er is geen test-hertestonderzoek en stabiliteit over tijd is niet gemeten. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De overige brongegevens noemen normgroep, publicatie en inhoudsvalidatie, maar meten geen stabiliteit over tijd.
>
> **Wordt: De denkfouten zijn: een factoranalyse voor een stabiliteitsmeting houden, of een factorlading als bewijs van stabiliteit over tijd lezen. Er is geen test-hertestonderzoek.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C06

*scenario · bron: ITEMBRON §3.1*

**Vraag — gewijzigd**

> Was: Een trainer wil zeggen dat extractiemodel, fit-indices en volledige factormatrix in een onderzoeksartikel beschikbaar zijn. Welke correctie is nodig?
>
> **Wordt: Een trainer verwijst een collega naar de technische verantwoording van de factoranalyse. Wat kan die collega volgens de onderbouwing inzien?**

Waarom: De oude stam somde de drie onderdelen op die ook in het juiste antwoord stonden, terwijl de afleiders over IVOC en de expertvalidatie gingen.

**Was**

&nbsp;&nbsp; A. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp; B. De factorladingen van de driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp; C. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
**→** D. Het extractiemodel, de fit-indices en de volledige factormatrix zijn niet gepubliceerd.

**Wordt**

&nbsp;&nbsp; A. Het extractiemodel en de fit-indices, maar niet de volledige factormatrix.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: alle drie zijn niet gepubliceerd.</sub>
&nbsp;&nbsp; B. De volledige factormatrix, omdat die bij de Universiteit Antwerpen opvraagbaar is.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de factormatrix is niet gepubliceerd; de bron noemt geen opvraagrecht.</sub>
&nbsp;&nbsp; C. Alle drie de onderdelen, via het rapport van sectorfonds IVOC.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: IVOC keek de statistische vormgeving na en publiceerde geen rapport met deze onderdelen.</sub>
**→ D. Geen van de drie: extractiemodel, fit-indices en volledige factormatrix zijn niet gepubliceerd.**

Toelichting bij juist: De bron noemt precies deze drie onderdelen als niet gepubliceerd en kwalificeert de analyse als niet extern gepubliceerd. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: IVOC, externe inhoudsvalidatie en de algemene status van de analyse beschrijven niet de publicatie van deze drie technische onderdelen.
>
> **Wordt: De denkfouten zijn: aannemen dat een deel van de technische verantwoording wel beschikbaar is, of haar bij de Universiteit Antwerpen of bij IVOC situeren. Alle drie de onderdelen zijn niet gepubliceerd.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C07

*scenario · bron: ITEMBRON §3.1*

**Vraag — gewijzigd**

> Was: Een adviseur beschrijft de beoordeling door externe experts als een afzonderlijk gepubliceerd rapport. Welke formulering is wel juist?
>
> **Wordt: Een adviseur wil verwijzen naar de beoordeling door externe experts. Welke formulering blijft binnen wat de onderbouwing vermeldt?**

Waarom: De oude stam noemde 'afzonderlijk gepubliceerd rapport', wat in het juiste antwoord terugkwam, terwijl de afleiders over IVOC, betrouwbaarheid en normgroep gingen.

**Was**

**→** A. Vier onafhankelijke experts voerden externe inhoudsvalidatie uit, maar de bevindingen zijn niet als afzonderlijk rapport gepubliceerd.
&nbsp;&nbsp; B. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp; C. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.
&nbsp;&nbsp; D. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.

**Wordt**

**→ A. Vier onafhankelijke experts voerden een externe inhoudsvalidatie uit; hun bevindingen zijn niet als afzonderlijk rapport gepubliceerd.**
&nbsp;&nbsp; B. Vier onafhankelijke experts voerden een externe inhoudsvalidatie uit en publiceerden hun bevindingen in een afzonderlijk rapport.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de bevindingen zijn niet als afzonderlijk rapport gepubliceerd.</sub>
&nbsp;&nbsp; C. Twee Vlaamse experts voerden de validatie uit; de twee Nederlandse keken alleen de taal na.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: alle vier voerden de inhoudsvalidatie uit; de bron kent geen taalrol toe.</sub>
&nbsp;&nbsp; D. De externe inhoudsvalidatie werd uitgevoerd door sectorfonds IVOC onder supervisie van prof. dr. Peter Theuns.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: IVOC keek de statistische vormgeving na en deed de inhoudsvalidatie niet.</sub>

Toelichting bij juist: De bron vermeldt externe inhoudsvalidatie door vier onafhankelijke experts en vermeldt dat de bevindingen niet afzonderlijk zijn gepubliceerd. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De andere brongegevens gaan over IVOC, betrouwbaarheid en normgroep, niet over de expertbeoordeling en haar publicatiestatus.
>
> **Wordt: De denkfouten zijn: de bevindingen als gepubliceerd rapport voorstellen, de vier experts een verschillende rol toekennen, of de inhoudsvalidatie aan IVOC toeschrijven.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C08

*meerkeuze · bron: ITEMBRON §3.1*

**Vraag** (ongewijzigd)

> Welke omschrijving van de bijdrage van sectorfonds IVOC aan de onderbouwing van T4Professional is volgens de bron correct?

**Was**

&nbsp;&nbsp; A. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
**→** B. IVOC heeft de statistische vormgeving nagekeken.
&nbsp;&nbsp; C. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp; D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Wordt**

&nbsp;&nbsp; A. IVOC heeft de exploratieve factoranalyse uitgevoerd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de factoranalyse liep met de Universiteit Antwerpen.</sub>
**→ B. IVOC heeft de statistische vormgeving nagekeken.**
&nbsp;&nbsp; C. IVOC heeft de inhoudsvalidatie door de vier onafhankelijke experts gecoördineerd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de expertvalidatie stond onder supervisie van prof. dr. Peter Theuns.</sub>
&nbsp;&nbsp; D. IVOC heeft de interpretatiedrempels geijkt op een normgroep.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: er is geen normgroep; drempels rusten op inhoudelijk oordeel.</sub>

Toelichting bij juist: De bron schrijft aan IVOC alleen het nakijken van de statistische vormgeving toe. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De andere brongegevens beschrijven expliciete lacunes, terwijl de juiste optie de specifieke rol van IVOC weergeeft.
>
> **Wordt: De denkfout is IVOC een rol geven die de bron elders belegt: de factoranalyse liep met de Universiteit Antwerpen, de inhoudsvalidatie onder prof. dr. Peter Theuns, en een ijking op een normgroep bestaat niet.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C09

*scenario · bron: ITEMBRON §3.2*

**Vraag** (ongewijzigd)

> Een consultant wil uit een profiel afleiden dat functioneren, welbevinden en verloop voorspeld zijn. Welke begrenzing is volgens de bron correct?

**Was**

&nbsp;&nbsp; A. De factorladingen voor driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp; B. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
**→** C. Samenhang met uitkomsten buiten het instrument, waaronder functioneren, welbevinden en verloop, is niet onderzocht.
&nbsp;&nbsp; D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Wordt**

&nbsp;&nbsp; A. De samenhang met functioneren is onderzocht, die met welbevinden en verloop niet.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: geen van de drie is onderzocht.</sub>
&nbsp;&nbsp; B. De samenhang met verloop is aangetoond op de 1.858 profielen van de factoranalyse.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2: verloop is niet onderzocht; de factoranalyse meet iets anders.</sub>
**→ C. Samenhang met uitkomsten buiten het instrument, waaronder functioneren, welbevinden en verloop, is niet onderzocht.**
&nbsp;&nbsp; D. De samenhang met deze drie uitkomsten is vastgesteld door de vier onafhankelijke experts.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de experts deden inhoudsvalidatie, geen onderzoek naar uitkomsten.</sub>

Toelichting bij juist: De bron stelt expliciet dat de samenhang met uitkomsten buiten het instrument niet is onderzocht. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: Factorladingen, inhoudsvalidatie en betrouwbaarheidscoëfficiënten beschrijven geen onderzocht verband met uitkomsten buiten het instrument.
>
> **Wordt: De denkfouten zijn: één van de drie uitkomsten als wel onderzocht voorstellen, of de factoranalyse of de expertvalidatie voor onderzoek naar uitkomsten buiten het instrument houden.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C10

*scenario · bron: ITEMBRON §3.3*

**Vraag** (ongewijzigd)

> Na een afname noemt een leidinggevende het resultaat een definitief oordeel over wat de deelnemer kan. Welke reactie volgt de claimgrens?

**Was**

&nbsp;&nbsp; A. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp; B. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.
&nbsp;&nbsp; C. De vragenlijst is zorgvuldig ingevuld, dus het resultaat mag als vaststaand gelden.
**→** D. Een resultaat is een momentopname op het ogenblik van afname, geen vaststaand oordeel over iemands mogelijkheden.

**Wordt**

&nbsp;&nbsp; A. Het resultaat geldt als vaststaand oordeel zolang de vragenlijst zorgvuldig is ingevuld.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.3: zorgvuldig invullen verandert de claimgrens niet.</sub>
&nbsp;&nbsp; B. Het resultaat geldt als vaststaand oordeel wanneer een tweede afname hetzelfde beeld geeft.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.2 en §3.3: stabiliteit over tijd is niet gemeten, en de claimgrens kent geen bevestigingsregel.</sub>
&nbsp;&nbsp; C. Het resultaat is een momentopname, maar mag binnen zes maanden na afname als vaststaand oordeel gelden.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.3: de claimgrens noemt geen termijn waarna een momentopname vaststaand wordt.</sub>
**→ D. Een resultaat is een momentopname op het ogenblik van afname, geen vaststaand oordeel over iemands mogelijkheden.**

Toelichting bij juist: De claimgrens formuleert woordelijk dat een resultaat een momentopname is en geen vaststaand oordeel over mogelijkheden. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De overige uitspraken zijn brongegevens, maar alleen de juiste optie begrenst het resultaat als momentopname van de afname.
>
> **Wordt: De denkfouten zijn: een momentopname vaststaand maken door zorgvuldig invullen, door een tweede afname, of binnen een termijn. De claimgrens kent geen van die drie uitzonderingen.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C11

*scenario · bron: ITEMBRON §3.3*

**Vraag** (ongewijzigd)

> Een leidinggevende wil een T4Professional-profiel als enige basis gebruiken voor een promotiebeslissing. Welke reactie past bij de claimgrens?

**Het juiste antwoord is ingekort.** Het oude juiste antwoord herhaalde de stam bijna woordelijk ('als enige basis', 'promotie'), waardoor het aanwijsbaar was op woordvorm. De ingekorte formulering staat woordelijk in §3.3: gespreksinstrument, geen beslissingsinstrument.

**Was**

**→** A. Het profiel is een gespreksinstrument en mag niet als enige basis dienen voor beslissingen over promotie.
&nbsp;&nbsp; B. De analyse is exploratief en niet extern gepubliceerd.
&nbsp;&nbsp; C. De factorladingen voor driverschalen liggen tussen 0,90 en 0,97.
&nbsp;&nbsp; D. IVOC heeft de statistische vormgeving nagekeken.

**Wordt**

**→ A. Nee: het gaat om een gespreksinstrument, niet om een beslissingsinstrument.**
&nbsp;&nbsp; B. Dat mag, omdat het profiel voor promotiebeslissingen is ontworpen en niet voor aanwerving.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.3: het is geen beslissingsinstrument, voor geen van beide.</sub>
&nbsp;&nbsp; C. Dat mag, mits de deelnemer schriftelijk toestemming geeft voor dit gebruik.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.3: de claimgrens is inhoudelijk en wordt niet opgeheven door toestemming.</sub>
&nbsp;&nbsp; D. Dat mag niet voor promotie, maar wel voor aanwerving en selectie.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.3: de claimgrens noemt aanwerving, selectie, promotie en ontslag samen.</sub>

Toelichting bij juist: De claimgrens noemt het profiel een gespreksinstrument en sluit uit dat het de enige basis is voor promotiebeslissingen. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De overige brongegevens zeggen niets over de expliciete grens dat een profiel niet de enige basis voor promotie mag zijn.
>
> **Wordt: De denkfouten zijn: het profiel voor promotie wél geschikt achten, denken dat toestemming de grens opheft, of de grens tot promotie beperken. De claimgrens noemt aanwerving, selectie, promotie en ontslag samen.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C14

*scenario · bron: ITEMBRON §2.5*

**Vraag** (ongewijzigd)

> Een rapporteur noemt het label hoog bij 7,6 een empirisch vastgesteld kwaliteitsverschil. Welke formulering bewaakt de juiste grens?

**Was**

&nbsp;&nbsp; A. −2 wordt 0, 0 wordt 5 en +2 wordt 10; dit is rekenkunde, geen conventie.
&nbsp;&nbsp; B. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
**→** C. Hoog begint bij 7,5, maar alle bandgrenzen zijn conventies van de ontwikkelaar.
&nbsp;&nbsp; D. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.

**Wordt**

&nbsp;&nbsp; A. Hoog begint bij 7,5 en die grens is geijkt op een normgroep.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §2.5 en §3.2: de grenzen zijn niet empirisch geijkt en er is geen normgroep.</sub>
&nbsp;&nbsp; B. Hoog begint bij 7,0; de grens 7,5 geldt alleen in het dashboard.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §2.5: hoog begint bij 7,5 in de enige bron van waarheid.</sub>
**→ C. Hoog begint bij 7,5, maar alle bandgrenzen zijn conventies van de ontwikkelaar.**
&nbsp;&nbsp; D. Hoog begint bij 7,5 en het verschil tussen 7,4 en 7,6 is empirisch aangetoond.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §2.5, woordelijk: er bestaat geen onderzoek waaruit volgt dat een 7,4 wezenlijk anders is dan een 7,6.</sub>

Toelichting bij juist: De bron geeft 7,5 als start van hoog, maar noemt alle bandgrenzen conventies van de ontwikkelaar. *(ongewijzigd)*

Toelichting bij fout: Alleen de juiste optie koppelt de startwaarde 7,5 aan de bronuitspraak dat bandgrenzen conventies van de ontwikkelaar zijn. *(ongewijzigd)*

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C15

*meerkeuze · bron: ITEMBRON §3.1*

**Vraag** (ongewijzigd)

> Welke omschrijving van de exploratieve factoranalyse bevat de aantallen en betrokken Universiteit Antwerpen-professoren zoals de bron die noemt?

**Was**

&nbsp;&nbsp; A. Externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van prof. dr. Peter Theuns.
&nbsp;&nbsp; B. De statistische vormgeving is nagekeken door sectorfonds IVOC.
&nbsp;&nbsp; C. De analyse is exploratief en niet extern gepubliceerd.
**→** D. 1.858 T4Professional-profielen en 395 profielen van het sportinstrument, met prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen.

**Wordt**

&nbsp;&nbsp; A. 1.858 T4Professional-profielen en 395 sportprofielen, met prof. dr. Peter Theuns en prof. dr. Guido Van Hal.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: prof. dr. Peter Theuns superviseerde de expertvalidatie, hij hoort niet bij de factoranalyse.</sub>
&nbsp;&nbsp; B. 395 T4Professional-profielen en 1.858 sportprofielen, met prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de aantallen staan omgekeerd.</sub>
&nbsp;&nbsp; C. 1.858 T4Professional-profielen, met prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen; sportprofielen zijn niet meegenomen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de 395 sportprofielen zijn wel meegenomen.</sub>
**→ D. 1.858 T4Professional-profielen en 395 profielen van het sportinstrument, met prof. dr. Guido Van Hal en prof. dr. Stefan Van Dongen.**

Toelichting bij juist: De bron noemt precies 1.858 T4Professional-profielen, 395 sportprofielen en de twee professoren van de Universiteit Antwerpen. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: De overige uitspraken gaan over inhoudsvalidatie, IVOC of de algemene publicatiestatus, niet over aantallen en Antwerpen-professoren van de factoranalyse.
>
> **Wordt: De denkfouten zijn: de twee aantallen omdraaien, de sportprofielen weglaten, of prof. dr. Peter Theuns bij de factoranalyse plaatsen. Hij superviseerde de externe inhoudsvalidatie.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

### C16

*scenario · bron: ITEMBRON §3.1*

**Vraag** (ongewijzigd)

> Een professional vergelijkt de gerapporteerde factorladingen van drivers met die van energieschalen onder de talentversnellers. Welke weergave is correct?

**Was**

**→** A. Driverschalen 0,90–0,97; energieschalen onder de talentversnellers 0,63–0,84.
&nbsp;&nbsp; B. Geen betrouwbaarheidscoëfficiënt, zoals Cronbachs alfa of McDonalds omega, berekend of gerapporteerd.
&nbsp;&nbsp; C. Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
&nbsp;&nbsp; D. Geen normgroep; interpretatiedrempels zijn vastgesteld op inhoudelijk oordeel, niet op een empirische verdeling in een referentiegroep.

**Wordt**

**→ A. Driverschalen 0,90–0,97; energieschalen onder de talentversnellers 0,63–0,84.**
&nbsp;&nbsp; B. Driverschalen 0,63–0,84; energieschalen onder de talentversnellers 0,90–0,97.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de reeksen staan omgekeerd.</sub>
&nbsp;&nbsp; C. Driverschalen 0,90–0,97; voor de energieschalen zijn geen ladingen gerapporteerd.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: voor de energieschalen is 0,63–0,84 gerapporteerd.</sub>
&nbsp;&nbsp; D. Beide reeksen liggen tussen 0,90 en 0,97; het verschil zit in het aantal constructen.
&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens §3.1: de twee reeksen verschillen wel degelijk.</sub>

Toelichting bij juist: De bron rapporteert 0,90–0,97 voor driverschalen en 0,63–0,84 voor energieschalen onder de talentversnellers. *(ongewijzigd)*

**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude
afleiders en zou na dit herstel onjuist zijn.

> Was: Betrouwbaarheid, test-hertest en normgroep zijn andere onderbouwingspunten en vervangen de bronvermelding van de twee factorladingreeksen niet.
>
> **Wordt: De denkfouten zijn: de twee reeksen verwisselen, aannemen dat voor de energieschalen niets gerapporteerd is, of beide reeksen gelijkstellen.**

Keuring: **goedkeuren** · **aanpassen** · **afwijzen**

---

## De vier items die ik ongewijzigd wil laten

Mijn meting wees 21 items aan. Bij het uitschrijven bleek dat vier daarvan in
orde zijn: het waren valse treffers van de woordoverlapmaat. Dat is precies de
reden dat zo'n maat kandidaten aanwijst en geen oordeel geeft.

### B04 — ongewijzigd laten

> De gemiddelde avgEnergy van de twee geselecteerde topdrivers is precies 0. Welk driverRisk-label hoort daarbij?

&nbsp;&nbsp; A. hoog
&nbsp;&nbsp; B. matig
**→** C. laag
&nbsp;&nbsp; D. Er wordt geen label toegekend.

De opties zijn de drie labels van driverRisk (hoog, matig, laag) plus 'geen label'. Dat is de juiste vorm voor dit feit: alle vier gaan over dezelfde grens. Mijn meting sloeg aan omdat het woord 'hoog' ook bij B05 de sleutel is, maar labels zijn eenwoordig en moeten in beide items voorkomen. Ongewijzigd laten.

Keuring: **eens** · **toch aanpassen**

### B05 — ongewijzigd laten

> De berekende consistentiescore is precies 80. Welk consistentielabel kent de rapportlogica dan toe?

&nbsp;&nbsp; A. laag
&nbsp;&nbsp; B. middelmatig
&nbsp;&nbsp; C. Er is eerst een aanvullende afronding nodig.
**→** D. hoog

Zelfde grond als B04, nu voor de drie consistentielabels. De grens >= 80 wordt zuiver getoetst. Ongewijzigd laten.

Keuring: **eens** · **toch aanpassen**

### D09 — ongewijzigd laten

> Een assessor zegt dat een deelnemer met uitgesproken positieve en negatieve energie op alle drivers extra punten krijgt voor het onderdeel spreadPart. Welke correctie past hierbij?

&nbsp;&nbsp; A. Dat klopt, want spreadPart beloont grote verschillen tussen energiewaarden.
**→** B. Dat is fout: spreadPart is hoger bij kleinere energiespreiding, zodat uitgesproken energie op alle drivers punten op dit deel kan kosten.
&nbsp;&nbsp; C. Dat klopt alleen wanneer de drie hoogste drivers positieve avgEnergy hebben.
&nbsp;&nbsp; D. Dat is fout, want spreadPart telt uitsluitend energiewaarden van talent-foci mee.

De drie afleiders keren de richting van spreadPart om of beperken de berekening tot een andere selectie. Dat zijn precies denkfouten op de stam. Mijn meting sloeg aan omdat de sleutel de woorden 'spreadPart' en 'energie' uit de stam herhaalt, wat hier onvermijdelijk is. Ongewijzigd laten.

Keuring: **eens** · **toch aanpassen**

### E02 — ongewijzigd laten

> Een geaccrediteerde legt binnen zijn licentie een bekwaamheidsproef af. Welke rechtsgrond geldt hiervoor volgens het dossier standaard?

&nbsp;&nbsp; A. Toestemming, omdat een proef altijd vrijwillig is.
&nbsp;&nbsp; B. Gerechtvaardigd belang, omdat de proef de kwaliteit bewaakt.
**→** C. Overeenkomst, omdat de bekwaamheidsproef binnen een licentieovereenkomst plaatsvindt.
&nbsp;&nbsp; D. Een wettelijke verplichting, omdat accreditatie verplicht geregistreerd moet worden.

De vier opties zijn vier AVG-rechtsgronden, elk met een geloofwaardige motivering. Dit is een goed item. De meting sloeg aan op de woorden 'bekwaamheidsproef' en 'licentie'. Ongewijzigd laten.

Keuring: **eens** · **toch aanpassen**

---

## Wat hierna gebeurt

1. Je keurt per item. Bij *aanpassen* geef je de richting; ik herschrijf.
2. Het goedgekeurde deel gaat in `itemcorpus-t4p.json`, daarna
   `scripts/genereer-corpus-ts.py`, daarna de volle testsuite.
3. De twee gebreken worden testregel in `tests/bekwaamheid-itemcorpus.test.ts`,
   met de vier valse treffers als vastgelegde uitzondering en de reden erbij.
   Zonder die stap komt het gebrek terug zodra de bank groeit.

Wat dit **niet** oplost: of dit de meest relevante tachtig vragen zijn. Betere
afleiders maken een item zuiver, niet noodzakelijk belangrijk. Die vraag blijft
open tot er een blauwdruk uit een taakanalyse ligt en een panel de items op
essentialiteit heeft beoordeeld.
