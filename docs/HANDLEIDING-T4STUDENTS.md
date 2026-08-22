# Handleiding T4Students Studiekompas

Instrument-id `tapas-t4students`, instrumentversie 1.0.0, rekenmotor
`t4students-1.0.0`, contractversie 2.0.0.
Status: **prototype in opbouw.** Deze handleiding beschrijft wat het instrument
vandaag is, en zegt uitdrukkelijk wat er nog niet is.

---

## 1. Wat dit instrument is

Het T4Students Studiekompas is een **reflectief ontwikkelinstrument** voor
jongeren in de laatste jaren secundair onderwijs en bij instroom in het hoger
onderwijs. Doelgroep in code, rapport en juridische teksten: **17 tot 25 jaar**
(deze doelgroeptekst is in deze ronde geharmoniseerd; er staat nergens nog een
andere leeftijdsband voor dit instrument).

Het instrument brengt in kaart hoe een jongere zichzelf op dit moment beschrijft:
waar haar aandacht naartoe gaat, langs welke routes ze tot resultaat komt, welke
drivers meespelen, waar interesse zit, en hoeveel energie dat vandaag kost of
geeft. De uitkomst is **gespreksstof voor een studiekeuzegesprek**, geen advies
en geen uitslag.

**Validiteit is gebruiks- en contextgebonden.** Voor dit instrument bestaat
vandaag geen validiteitsonderzoek van welke aard ook. De verantwoording in het
rapport (blad "Verantwoording en grenzen") zegt dat letterlijk: de inhoud is
opgebouwd op vakliteratuur en op de ervaring van de ontwikkelaar, er zijn geen
betrouwbaarheidscijfers, geen validiteitsonderzoek en geen normgroep.

---

## 2. Toegestaan en niet toegestaan gebruik

**Toegestaan**

- Zelfreflectie van de jongere, bij voorkeur samen nagelezen met een leerkracht,
  begeleider of ouder.
- Een studiekeuzegesprek openen en verbreden.
- Benoemen wat energie geeft en wat energie kost bij studeren.

**Niet toegestaan**

- Uitspraken over studiegeschiktheid of toelaatbaarheid.
- Voorspelling van studiesucces, slaagkans of studieduur.
- Diagnose van intelligentie, potentieel, talent, leerstoornis of gezondheid.
- Vergelijking tussen studenten, rangschikking binnen een klas of school.
- Enige beslissing over de jongere die zonder haar en zonder gesprek wordt
  genomen.

Deze grenzen staan ook in het rapport zelf, op het blad "Verantwoording en
grenzen", in de vier expliciete "wat dit rapport niet is"-punten.

---

## 3. Opbouw van de afname

| Onderdeel | Aantal |
|---|---|
| Items totaal (inclusief openingsvraag) | 40 |
| Constructen of clusters (exclusief de openingsvraag) | 35 |
| Clusters met precies 1 item | 32 |
| Clusters met 2 items | 2 (Sociaal Interactief, Systematisch/Uitvoerend) |
| Clusters met 3 items | 1 (Be Strong) |
| Herkenningsschaal | 0 tot 3 |
| Energieschaal | apart bevraagd, nergens bij de herkenning opgeteld |

Bron: `server/data/t4students.json`, scoring in `server/t4students/`.

**Dit is de kern van de psychometrische beperking.** Vier op de vijf clusters
rusten op één enkel item. Voor een cluster met één item bestaat er geen interne
consistentie, geen itemanalyse en geen betrouwbaarheidscoëfficiënt: er is niets
om tegen af te zetten. Zolang de itembank niet breder is, is elke uitspraak over
betrouwbaarheid of structuur per cluster onmogelijk. Het uitbreidingsplan staat
in `docs/ITEMONTWIKKELPLAN-T4STUDENTS.md`.

---

## 4. Wat het rapport per onderdeel wel en niet mag zeggen

| Familie | Clusters | Items per cluster | Interpretatieniveau | Mag wel | Mag niet |
|---|---|---|---|---|---|
| Talent-foci | 6 | 1 tot 2 | binnen persoon | "hier gaat je aandacht vandaag naartoe" | talentniveau, geschiktheid voor een richting |
| Talent-versnellers | 6 | 1 | binnen persoon | "zo kom je tot resultaat" | vaardigheidsniveau |
| Drivers | 5 | 1 tot 3 | binnen persoon | "dit patroon herken je, en het kost of geeft energie" | persoonlijkheidstrek, stressdiagnose |
| Motivatie (autonomie, competentie, verbondenheid, erkenning, verwachting) | 5 | 1 | binnen persoon | "hier komt je motivatie vandaag vandaan" | motivatiescore, vergelijking met leeftijdsgenoten |
| Interesse (RIASEC-achtige zes) | 6 | 1 | binnen persoon, rangorde | "dit trekt je aan" | beroepsadvies, Holland-code als uitslag |
| TaPas-BEELD (energie-status, helderheid) | 2 | 1 | binnen persoon | "zo sta je er vandaag bij" | welzijnsmeting |
| Betekenis, studiecontext, profielkern, profielselectie, energie-ijkpunt | 5 | 1 | binnen persoon | gespreksopener | alles wat op een score lijkt |

---

## 5. Leessignalen over de manier van invullen

Het rapport toont twee signalen over de afname zelf. Beide staan op het blad
"Verantwoording en grenzen" en zijn geschreven in de tweede persoon, omdat de
jongere zelf de lezer is (`tempoMeldingJij`, `patroonMeldingJij` in
`server/afnamekwaliteit.ts`).

| Signaal | Wanneer | Wat het zegt |
|---|---|---|
| Tempo | meer dan 15% van de gemeten items onder 2000 ms, en minstens 5 gemeten items | "je hebt deze lijst deels in een hoog tempo ingevuld" |
| Antwoordpatroon | 10 of meer identieke antwoorden op rij, of 80% of meer hetzelfde antwoord, bij minstens 15 antwoorden | "in je antwoorden valt een patroon op" |

Beide signalen zeggen uitdrukkelijk dat ze niets over de persoon zeggen. Het zijn
technische kwaliteitsregels met een leesadvies eraan vast.

**Er zijn geen aandachtcontrole-items in de itembank.** Het bouwplan vroeg er
twee of drie. Die zijn bewust niet toegevoegd: items in de bank zetten zonder
inhoudelijke validatie zou precies de schijnzekerheid creëren die dit dossier wil
vermijden. In plaats daarvan is er patroondetectie op de bestaande antwoorden.
De drie voorgestelde items staan uitgewerkt en klaar in
`docs/ITEMONTWIKKELPLAN-T4STUDENTS.md`, met de uitdrukkelijke vermelding dat ze
niet geïmplementeerd zijn.

---

## 6. Classificatie van alle drempels en labels

| Grens of label | Waarde | Waar | Soort |
|---|---|---|---|
| Item "erg snel beantwoord" | < 2000 ms | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Tempomelding aan | > 15% van de gemeten items | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Minimum gemeten items voor de tempomelding | 5 | `server/afnamekwaliteit.ts` | Technische kwaliteitsregel |
| Reeks identieke antwoorden | >= 10 op rij | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Aandeel identieke antwoorden | >= 0,80 | `server/afnamekwaliteit.ts` | Ontwerpconventie |
| Minimum antwoorden voor de patroonmelding | 15 | `server/afnamekwaliteit.ts` | Technische kwaliteitsregel |
| Herkenningsschaal 0 tot 3 | vast | `server/data/t4students.json` | Ontwerpconventie |
| Terugrekening naar dezelfde schaal per onderdeel | vast | `server/t4students/` | Technische kwaliteitsregel |
| Rangorde van interesses | binnen persoon | `server/t4students/` | Technische kwaliteitsregel |
| Woordlabels bij de uitkomsten | vast | `server/data/t4students-rapportteksten.json` | Interpretatieve heuristiek |
| Doelgroep 17 tot 25 jaar | vast | code, rapport en gids | Ontwerpconventie |

Ook hier staat geen enkele regel "Empirisch onderbouwd", en om dezelfde reden:
er zijn geen afnamedata om iets op te ijken.

---

## 7. Openstaande punten die echte afnamedata vragen

1. **Itembreedte eerst.** Zonder minstens drie items per cluster is geen enkele
   betrouwbaarheidsclaim mogelijk. Dit is de eerste stap, vóór elk
   psychometrisch onderzoek.
2. **Structuur.** Of de zes talent-foci, zes versnellers en vijf
   motivatiebronnen empirisch te onderscheiden zijn, is onbekend.
3. **Aandachtcontrole.** De drie voorgestelde items moeten inhoudelijk worden
   getoetst en in drie talen worden vertaald voor ze in de bank mogen.
4. **Ijking van de patroon- en tempodrempels.** 10, 0,80, 2000 ms en 15% zijn
   conventies. Wat een werkelijk afwijkend invulpatroon is bij jongeren van 17
   tot 25 jaar, kan alleen uit data komen.
5. **Interesseschaal.** Zes interesses met elk één item vormen geen RIASEC-meting
   en mogen ook niet als Holland-code worden gepresenteerd.

---

## 8. Bronnen in de code

| Onderwerp | Bestand |
|---|---|
| Itembank | `server/data/t4students.json` |
| Antwoordvormen per itemtype | `server/t4students/antwoorden.ts` |
| Instrumentdefinitie | `server/t4students/instrument.ts` |
| Afnamecontract | `server/t4students/contract.ts` |
| Rapportketen | `server/t4students/rapport-keten.ts` |
| Rapportbladen | `server/t4students/rapport-paginas.ts` |
| Rapportteksten | `server/data/t4students-rapportteksten.json`, `-duidingsteksten.json`, `-omschrijvingen.json` |
| Tempo en antwoordpatroon | `server/afnamekwaliteit.ts` |
