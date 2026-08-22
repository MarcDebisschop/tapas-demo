# Itemontwikkelplan T4Students Studiekompas

Status: **plan. Niets in dit document is geïmplementeerd.** De itembank in
`server/data/t4students.json` bevat vandaag 40 items en geen enkel item uit dit
plan. Dat is een bewuste keuze: items in de bank zetten zonder inhoudelijke
toetsing zou de indruk van psychometrische degelijkheid wekken zonder de zaak
zelf.

---

## 1. Waarom de bank te smal is

| Feit | Gevolg |
|---|---|
| 35 clusters, 40 items | gemiddeld 1,1 item per cluster |
| 32 clusters met precies 1 item | voor die clusters is geen itemanalyse mogelijk |
| 2 clusters met 2 items | te weinig voor een betrouwbaarheidsschatting |
| 1 cluster met 3 items (Be Strong) | het absolute minimum, en enkel daar |

Een cluster met één item heeft geen interne consistentie. Niet "een lage", maar
geen: er is geen tweede meting om tegen af te zetten. Elke uitspraak over
betrouwbaarheid of structuur per cluster is dus vandaag onmogelijk, niet
voorzichtigheidshalve maar rekenkundig.

**Streefdoel:** minstens 3 items per cluster voor de dragende families
(Talent-foci, Talent-versnellers, Drivers, Motivatie), minstens 2 voor de
interessefamilie. Dat komt neer op ongeveer 60 nieuwe items. Dat is een
ontwikkeltraject van maanden, niet iets wat er in deze ronde bij kon.

---

## 2. Ontwikkelvolgorde

| Stap | Wat | Waarom in deze volgorde |
|---|---|---|
| 1 | Constructdefinities uitschrijven per cluster: wat valt eronder, wat niet | zonder scherpe definitie is geen item te schrijven en geen expertbeoordeling mogelijk |
| 2 | Per cluster 5 kandidaat-items schrijven in het Nederlands | overschrijven laat toe om de zwakste eruit te gooien |
| 3 | Inhoudsvaliditeit: 3 tot 5 onafhankelijke beoordelaars wijzen elk item aan een cluster toe | vangt items die twee clusters tegelijk raken |
| 4 | Taalcontrole op leeftijd 17 tot 25: leesniveau, geen jargon, geen schoolse formulering | de doelgroep leest dit alleen |
| 5 | Cognitieve interviews met 8 tot 12 jongeren: wat begrijp je hier | vangt items die anders begrepen worden dan bedoeld |
| 6 | Vertaling naar Frans en Engels, daarna terugvertaling | de bank is drietalig (`nl`, `fr`, `en`) en de vertaling mag de betekenis niet verschuiven |
| 7 | Pilootafname, itemanalyse, selectie van de 3 beste per cluster | pas hier komen cijfers in beeld |
| 8 | Opname in de bank, versienummer omhoog, wijzigingslog | de bank is een versienummer waardig |

Pas na stap 7 wordt de analysematrix in
`docs/ANALYSEMATRIX-BETROUWBAARHEID.md` uitvoerbaar.

---

## 3. Voorgestelde aandachtcontrole-items (NIET geïmplementeerd)

Het bouwplan vroeg twee tot drie aandachtcontroles. Wat er in deze ronde wel is
gebouwd, is **patroondetectie op de bestaande antwoorden**: identieke reeksen en
een overheersend antwoord worden gemeld op het verantwoordingsblad
(`server/afnamekwaliteit.ts`, `berekenInvulpatroon`). Dat vraagt geen nieuwe items
en dus geen ongetoetste inhoud in de bank.

Hieronder staan drie kandidaat-items, klaar voor stap 3 tot 6 van het traject
hierboven. **Ze staan niet in de itembank en worden nergens gescoord.**

### Kandidaat A: instructiecontrole

Type `recognition`, schaal `recognition` (0 tot 3). Verwacht antwoord: 0.
Plaats: na ongeveer een derde van de lijst.

| Taal | Tekst |
|---|---|
| nl | Om te kijken of je de vragen aandachtig leest, vragen we je hier om "Niet ik" te kiezen. |
| fr | Pour vérifier que tu lis les questions attentivement, choisis ici "Pas moi". |
| en | To check that you are reading carefully, please choose "Not me" here. |

Waarom deze vorm: de vraag is eerlijk over haar bedoeling. Een verborgen
strikvraag zou bij deze leeftijdsgroep de vertrouwensrelatie schaden, en het
rapport is een reflectiedocument, geen examen.

### Kandidaat B: inhoudelijke tegenstelling

Type `recognition`, schaal `recognition`. Te koppelen aan een bestaand item met
een tegengestelde inhoud; sterk afwijkende antwoordparen zijn het signaal.
Plaats: minstens tien items verwijderd van zijn tegenhanger.

| Taal | Tekst |
|---|---|
| nl | Ik werk het liefst alleen, zonder overleg met anderen. |
| fr | Je préfère travailler seul, sans concertation avec les autres. |
| en | I prefer working alone, without checking in with others. |

Waarom deze vorm: dit item meet geen apart cluster maar de samenhang met het
sociaal-interactieve item. Het mag daarom nooit in een clusterscore meelopen.

### Kandidaat C: onwaarschijnlijke bewering

Type `recognition`, schaal `recognition`. Verwacht antwoord: laag.
Plaats: in de laatste derde van de lijst.

| Taal | Tekst |
|---|---|
| nl | Ik heb nog nooit iets uitgesteld waar ik geen zin in had. |
| fr | Je n'ai jamais rien remis à plus tard, même sans envie. |
| en | I have never put off something I did not feel like doing. |

Waarom deze vorm: een hoge score wijst op instemmingsneiging. Let op de
interpretatiegrens: dit is een leessignaal bij deze ene invulling en zeker geen
uitspraak over eerlijkheid.

### Voorwaarden voor opname

1. Doorloop stap 3 tot 6 van het traject. Een aandachtcontrole die zelf verkeerd
   begrepen wordt, is erger dan geen aandachtcontrole.
2. Deze items mogen nooit in een cluster- of familiescore terechtkomen.
3. Een gevlagde afname mag niet worden weggegooid of afgekeurd. Ze levert een
   leessignaal in de tekst, net zoals tempo en antwoordpatroon vandaag.
4. Er komt geen getal met een label als "betrouwbaarheid van deze afname" bij. De
   drempels worden vastgelegd volgens
   `docs/ANALYSEMATRIX-BETROUWBAARHEID.md`, analyse 5 en 6, en tot dan zijn ze
   ontwerpconventies.
5. Het aantal items in het rapport en in de handleiding moet mee omhoog: 40 wordt
   43, en de doorlooptijdverwachting verandert.

---

## 4. Wat dit plan niet oplost

- Validiteit. Meer items maken de bank breder, niet geldig. Validiteit vraagt de
  studies uit de analysematrix.
- De interessefamilie. Zes interesses met elk één of twee items blijven ook na
  uitbreiding geen RIASEC-meting en mogen niet als Holland-code worden
  gepresenteerd.
- De claimgrenzen. Die blijven staan zoals ze zijn, ongeacht de itembreedte.
