# Itemontwikkelplan T4Students Studiekompas

Auteur: Marc Debisschop, wiskundige en ontwikkelaar van assessmentinstrumenten.
Onderwerp: uitbreiding van de itembank van 40 naar 86 vragen, waarvan 78 gescoord.

**Status: plan. Geen enkel item uit dit document staat in de itembank.** De bank in
`server/data/t4students.json` bevat vandaag 40 items. De honderd kandidaat-items
hieronder zijn geschreven om de inhoudelijke beoordeling in te gaan, niet om
gescoord te worden. Items in de bank zetten voor ze beoordeeld en getoetst zijn,
zou de indruk van psychometrische degelijkheid wekken zonder de zaak zelf.

---

## 1. Het probleem, exact geteld

Geteld in de itembank op 23 augustus 2026:

| Feit | Aantal | Gevolg |
|---|---|---|
| Items in de bank | 40 | korte afname, lage drempel voor de jongere |
| Inhoudelijke clusters, zonder de beginvraag | 35 | gemiddeld 1,1 item per cluster |
| Clusters met precies 1 item | 32 | geen itemanalyse en geen interne consistentie mogelijk |
| Clusters met 2 items | 2 | te weinig voor een verdedigbare schatting |
| Clusters met 3 items | 1, de driver Be Strong | het absolute minimum, en enkel daar |

Een cluster met één item heeft geen interne consistentie. Niet een lage, maar
geen: er is geen tweede antwoord om het eerste tegen af te zetten. Dat is een
rekenkundige onmogelijkheid en niet een kwestie van voorzichtigheid. Meer
respondenten verhelpen dit niet. De eerste stap is dus itemontwikkeling en geen
dataverzameling.

---

## 2. Zeven clusters horen niet in de meetclaim

Van de 32 clusters met één item zijn er zeven die nooit als meting bedoeld waren.
Zij openen een gesprek en verschijnen als tekst in het rapport, zonder score.

| Cluster | Item | Functie |
|---|---|---|
| Betekenisspoor | B1 | open vraag, tekst in het rapport |
| Profielkern | P2 | samenvattende tekst, geen antwoord van de jongere |
| Profielselectie | P1 | waar sta je in je keuze, positiebepaling |
| Studeerstijl | S1 | voorkeurskeuze, geen niveau |
| Energie-ijkpunt | I1 | momentopname op een schuif |
| Energie-status | BE2 | trouw blijven aan wie je bent, gespreksopener |
| Helderheid en zingeving | BE1 | heb je een beeld van waar je heen wil |

Deze zeven worden formeel geherklasseerd van cluster naar **losse vraag zonder
score**. Daarmee vervalt voor hen elke betrouwbaarheidseis, zonder dat er één
claim wordt ingeleverd en zonder één nieuw item. Er blijven 28 gescoorde clusters
over, en 27 daarvan hebben items nodig.

Deze herklassering vraagt twee technische ingrepen: een expliciete markering
`gescoord: false` op deze items in de bank, en een wachtertest die verhindert dat
een niet gescoord item ooit in een cluster met een betrouwbaarheidsclaim
terechtkomt.

---

## 3. Streefdoel en de rekening

Streefdoel: minstens **3 items** per dragend cluster, minstens **2** per
interessecluster. De interessevelden krijgen twee omdat hun uitkomst uitsluitend
als rangorde binnen één jongere wordt gepresenteerd en nooit als score.

| Familie | Clusters | Items nu | Doel | Nieuw nodig | Kandidaten te schrijven |
|---|---|---|---|---|---|
| Talentfoci | 6 | 8 | 18 | 10 | 22 |
| Talentversnellers | 6 | 6 | 18 | 12 | 24 |
| Drivers | 5 | 7 | 15 | 8 | 16 |
| Motivatiebronnen | 5 | 5 | 15 | 10 | 20 |
| Interessevelden | 6 | 6 | 12 | 6 | 18 |
| Losse vragen zonder score | 7 | 7 | geen eis | 0 | 0 |
| Beginvraag, open | 1 | 1 | geen eis | 0 | 0 |
| **Totaal** | **35 plus beginvraag** | **40** | **86** | **46** | **100** |

De kandidatenkolom is telkens het aantal nieuwe items plus twee per cluster. Er
worden dus honderd items geschreven om er zesenveertig te houden. Het weggooien
is het werk, niet het schrijven.

Daarnaast worden twaalf **bestaande** items in de talentfamilies herschreven,
omdat zij de talentvorm niet of maar half dragen. Zie punt 4.3. Dat verandert de
omvang van de bank niet, maar wel de omvang van het werk en de versie van het
instrument.

Per cluster, zodat er geen twijfel over de rekening bestaat:

| Cluster | Nu | Nieuw | Kandidaten |
|---|---|---|---|
| Functioneel Innovatief | 1 | 2 | 4 |
| Artistiek Innovatief | 1 | 2 | 4 |
| Complexiteit en Conceptueel | 1 | 2 | 4 |
| Overdrachtelijk Interactief | 1 | 2 | 4 |
| Sociaal Interactief | 2 | 1 | 3 |
| Systematisch en Uitvoerend | 2 | 1 | 3 |
| Analyse | 1 | 2 | 4 |
| Individueel ondersteunend | 1 | 2 | 4 |
| Groepsondersteunend | 1 | 2 | 4 |
| Impact | 1 | 2 | 4 |
| Resultaat | 1 | 2 | 4 |
| Constructief onderscheidend | 1 | 2 | 4 |
| Be Perfect | 1 | 2 | 4 |
| Hurry Up | 1 | 2 | 4 |
| Please Others | 1 | 2 | 4 |
| Try Hard | 1 | 2 | 4 |
| Be Strong | 3 | 0 | 0 |
| Autonomie | 1 | 2 | 4 |
| Competentie | 1 | 2 | 4 |
| Verbondenheid | 1 | 2 | 4 |
| Erkenning | 1 | 2 | 4 |
| Verwachting | 1 | 2 | 4 |
| Realistisch | 1 | 1 | 3 |
| Investigative | 1 | 1 | 3 |
| Artistiek | 1 | 1 | 3 |
| Sociaal | 1 | 1 | 3 |
| Ondernemend | 1 | 1 | 3 |
| Conventioneel | 1 | 1 | 3 |

---

## 4. Vier bevindingen die eerst opgelost moeten worden

**4.1 Constructief onderscheidend meet vermoedelijk zijn eigen label niet.**
Het enige item in dat cluster is V6, "Ik denk goed vooruit over wat er nog moet
gebeuren." Dat is vooruitkijken en plannen. Het label wijst op iets anders: het
verschil kunnen maken, iets beter achterlaten dan het was. Dit is een
inhoudsvaliditeitsprobleem dat vandaag niet opvalt, precies omdat het cluster
maar één item heeft. De kandidaat-items hieronder zijn op het label geschreven,
niet op V6. Bij de beoordeling in stap 3 moet uitdrukkelijk beslist worden of V6
in dit cluster blijft, naar de talentfoci verhuist, of vervalt.

**4.2 De twee bestaande items in Systematisch en Uitvoerend liggen dicht bij
elkaar.** F4 is een situatievraag over stap voor stap werken, F7 een uitspraak
over stap voor stap afwerken. Als die twee bijna hetzelfde meten, dan is een
hoge samenhang tussen hen geen bewijs van betrouwbaarheid maar van herhaling.
Het nieuwe item is daarom bewust op een andere kant van het construct
geschreven, namelijk overzicht houden.

**4.3 De bestaande talentitems staan niet in talentvorm.**
Talent is in dit instrument gedefinieerd als iets snel, met weinig inspanning en
toch heel goed kunnen. Die drie elementen samen, gemak, tempo en kwaliteit, zijn
het construct. Een item dat enkel een gedraging beschrijft, meet dat construct
niet: het meet dat iemand het doet, niet dat het hem vanzelf afgaat.

De bestaande veertien items in de talentfamilies zijn op dat punt ongelijk.

| Item | Tekst, verkort | Draagt de talentvorm |
|---|---|---|
| V4 Impact | anderen zeggen dat ik mensen **makkelijk** in beweging krijg | ja, gemak aanwezig |
| F8 Sociaal Interactief | ik kan **vlot** contact maken en goed samenwerken | ja, gemak en kwaliteit |
| V1 Analyse | ik heb een **sterk** analytisch inzicht, ik wil eerst snappen | half, kwaliteit wel, gemak niet, tweede helft is motivatie |
| F2 Artistiek Innovatief | ik ben **goed in** het verbeelden van dingen | half, kwaliteit wel, gemak niet |
| V2 Individueel ondersteunend | ik **kan goed** met iemand praten over wat moeilijk ligt | half, kwaliteit wel, gemak niet |
| V3 Groepsondersteunend | ik krijg de verschillen **goed** op één lijn | half, kwaliteit wel, gemak niet |
| F6 Overdrachtelijk Interactief | ik **kan goed** uitleggen wat ik weet | half, kwaliteit wel, gemak niet |
| F1 Functioneel Innovatief | ik vind **vaak** een nieuwe oplossing | nee, frequentie is geen gemak |
| F3 Complexiteit | ook in een ingewikkelde situatie blijf ik het geheel overzien | nee, zuiver gedrag |
| V5 Resultaat | ik blijf gefocust op het resultaat | nee, zuiver gedrag |
| V6 Constructief onderscheidend | ik denk goed vooruit over wat er nog moet gebeuren | nee, en het label klopt niet, zie 4.1 |
| F7 Systematisch en Uitvoerend | ik kan stap voor stap afwerken, **ook als het lang duurt** | nee, en het spreekt de definitie tegen |
| F4, F5 | situatie-items | apart te beoordelen |

F7 verdient bijzondere aandacht. "Ook als het lang duurt" beschrijft volharding,
dus inspanning. Dat is het tegendeel van weinig inspanning. Dit item meet
vermoedelijk doorzettingsvermogen en niet talent, en dat is geen kleinigheid: het
zit in een cluster waarvan het de helft van de items vormt.

**Gevolg voor het traject.** Stap 2 wordt breder dan oorspronkelijk gepland. Naast
de beslissing over V6 moeten ook F1, F3, V5 en F7 herschreven of vervangen worden,
en moeten V1, V2, V3 en F6 aangevuld worden met de gemakscomponent. Een cluster
waarin een item in talentvorm naast een item in gedragsvorm staat, zal een lage
samenhang tonen om een reden die niets met het construct te maken heeft. Dat zou
later verkeerd gelezen worden als een zwak construct, terwijl het een
schrijffout is.

**Geen nieuwe situatie-items.** De bank kent vier situatie-items, D5, D6, F4 en
F5. Zulke items hebben een eigen antwoordset en een eigen scoringsregel per item.
Nieuwe situatie-items zouden dus naast het schrijfwerk ook nieuwe scoringslogica
vragen. Alle honderd kandidaten zijn daarom uitspraken op de bestaande schalen.
Dat houdt de beoordeling uniform en de scoringketen ongewijzigd.

### 4.4 Try Hard is een relationeel construct

De constructdefinitie luidt: iemand met Try Hard wil vooral het verschil maken en
iets uitzonderlijks doen voor een persoon naar wie hij opkijkt, die hem
inspireert, en van wie hij weet dat die in hem gelooft. De drie elementen zijn
dus de persoon, het vertrouwen van die persoon, en het uitzonderlijke. Zonder de
persoon blijft er inzet over, en inzet is geen construct: het is de bereidheid
om moeite te doen, en die zit ook in Be Perfect, in Hurry Up en in de
motivatiebron Verwachting.

Dit is geen woordkeuze maar een validiteitskwestie. Een cluster dat als "hard
blijven proberen" wordt geoperationaliseerd, deelt zijn variantie met elk ander
cluster dat inspanning bevraagt. Dan meet de bank vijf keer hetzelfde en toont ze
vijf keer een andere naam. Dat is precies de fout die Vantilborgh (2023)
beschrijft als een operationalisatie die de constructdefinitie niet dekt: de
samenhang binnen het cluster kan dan hoog zijn zonder dat er iets gemeten wordt
wat het label belooft.

**Wat er in de bank aan gedaan is.** De drie plaatsen waar Try Hard voor een
deelnemer zichtbaar wordt, dragen nu alle drie de relationele figuur: het
herkenningsitem D3, de gewone omschrijving naast de constructnaam, en de
duidingstekst in het rapport. In de duidingstekst staat ook de keerzijde die bij
dit patroon hoort: valt de figuur weg, dan valt de beweging weg. Een wachtertest
houdt de drie op één lijn en zakt zodra de nuance uit een van de drie verdwijnt.

De korte omschrijving naast de constructnaam staat in een kolom die niet mag
afbreken. Daar passen de persoon en het uitzonderlijke samen in; het vertrouwen
van die persoon staat in het item en in de duidingstekst, waar de ruimte er wel
is. Een tweede wachtertest leest de opmaakmeldingen van het hele rapport en zakt
zodra een vaste regel breder wordt dan haar plaats.

**Gevolg voor de itemanalyse.** De tekst van D3 is inhoudelijk gewijzigd. Voor de
analyse in stap 7 is D3 daarmee een nieuw item: antwoorden op de oude formulering
mogen niet met antwoorden op de nieuwe worden samengenomen. De teller van de
afnames voor dit item begint opnieuw.

**Buiten de meetclaim van dit plan.** Dezelfde constructnaam staat ook in
T4Professional, T4Recruitment en T4Sports, en daar is Try Hard nog wel als
inspanning en zich bewijzen geformuleerd. Dat is niet stilzwijgend meegetrokken:
een live instrument van 136 items herformuleren is een eigen ingreep met een
eigen beoordeling en een eigen versienummer. Het staat hier opgeschreven zodat
het niet vergeten wordt.

---

## 5. Schrijfregels

Elke kandidaat is aan deze regels getoetst voor hij in dit document kwam.

1. Eerste persoon, tegenwoordige tijd, één gedraging per item. Geen item dat twee
   dingen tegelijk vraagt.
2. Geen ontkenning en geen dubbele ontkenning. Wie snel leest, leest een "niet"
   over.
3. Geen vaktaal, geen schoolse formulering, geen woord uit het TaPas-model zelf.
   Een jongere van zeventien mag het item begrijpen zonder de theorie te kennen.
4. Leesniveau: korte hoofdzin, hoogstens één bijzin, hoogstens veertien woorden.
   Zie punt 5.1 voor de drie taalregels die daar concreet uit volgen.
5. Geen sociaal wenselijk gestelde vraag. Een item dat niemand met "Niet ik"
   durft te beantwoorden, meet niets.
6. **In de talentfamilies draagt elk item de talentvorm.** Talent is hier
   gedefinieerd als iets snel, met weinig inspanning en toch heel goed kunnen. Een
   item in die twee families moet dus minstens twee van de drie elementen bevatten:
   kwaliteit, gemak en tempo. Bruikbare vormen zijn "ik ben sterk in", "gaat me
   vlot af", "gaat me vanzelf af", "kost me weinig moeite", "ik heb er weinig tijd
   voor nodig", "ik zie meteen", "anderen zeggen dat het me makkelijk afgaat".
7. **Buiten de talentfamilies mag de talentvorm juist niet staan.** Drivers,
   motivatiebronnen en interessevelden zijn geen talent. Een driver is een
   herkenbaar werkpatroon, een motivatiebron is een bron van energie en een
   interesseveld is aantrekkingskracht. "Ik ben sterk in" zou daar een bekwaamheidsclaim
   invoeren die het instrument niet maakt en niet mag maken.
8. Wissel de aanzet af. Hoogstens één item per cluster begint met "Ik ben sterk
   in". Vier keer dezelfde openingswoorden in één cluster lokt een vast
   antwoordpatroon uit, en dan meet de samenhang de vorm en niet het construct.
9. De energievraag blijft altijd apart van de herkenningsvraag. De twee lagen
   worden nooit in één itemtekst gemengd en nooit opgeteld.
10. Elk item moet ook in het Frans en het Engels te zeggen zijn zonder beeldspraak
    die niet overdraagt.
11. Geen vergelijking met anderen in de itemtekst. "Kost me minder moeite dan
    anderen" is verboden, want het instrument vergelijkt jongeren nooit. "Anderen
    zeggen dat" mag wel: dat is een waarneming uit de omgeving en geen rangorde.

**Het risico van regel 6, uitgesproken.** Een item in de vorm "ik ben sterk in"
vraagt de jongere om zichzelf een bekwaamheid toe te kennen. Dat verhoogt de kans
op sociaal wenselijk antwoorden en op een verschuiving naar de bovenkant van de
schaal. Dat is de prijs van een zuivere operationalisatie van dit talentbegrip:
wie gemak en kwaliteit wil meten, moet ernaar vragen. Er zijn drie tegenwichten
in dit plan. De cognitieve interviews in stap 5 vragen uitdrukkelijk of de jongere
het item durfde te ontkennen. De plafonddrempel in punt 8.2 laat geen item toe
waarop meer dan tachtig procent dezelfde categorie kiest. En de vier categorieën
van de herkenningsschaal, van "Niet ik" tot "Helemaal ik", vragen herkenning en
geen zelfbeoordeling op een cijfer.

### 5.1 Drie taalregels voor de zinsbouw

De jongste deelnemer is zeventien. Een item dat hij twee keer moet lezen, meet
leesvaardigheid mee. Dat is een bekende bron van ruis in zelfrapportage: hoe meer
verwerking een item vraagt, hoe meer het antwoord afhangt van iets anders dan het
construct. Drie regels houden dat kort.

**Regel A: het item begint met de persoon, niet met de bezigheid.** Nederlands
laat toe om een werkwoordgroep vooraan te zetten, zoals in "Verdeelde meningen
weer bij elkaar brengen gaat me vlot af". De lezer moet dan zes woorden
vasthouden voor hij weet wat er met die woorden gebeurt. "Ik breng vlot mensen
met andere meningen weer samen" zegt hetzelfde en geeft het onderwerp meteen.
Hoogstens vier woorden voor de persoonsvorm.

**Regel B: geen naamwoordstijl.** "Ik ben sterk in het geven van vorm aan een
idee" bevat een werkwoord dat als zelfstandig naamwoord is verpakt. "Ik ben sterk
in een idee vorm geven" is drie woorden korter en één denkstap minder. Hetzelfde
geldt voor "het vinden van de oorzaak van", met twee keer "van" in één item.

**Regel C: alledaagse woorden, en beeldspraak alleen als ze ook in het Frans en
het Engels bestaat.** Woorden als doorzien, voortgang, gedrevener, wrijving,
sprekender en ordelijk horen tot de schrijftaal van een verslag, niet tot de
spreektaal van een achttienjarige. Uitdrukkingen als "in één oogopslag" en "de
hoofdlijn te pakken hebben" zijn voor een Vlaamse jongere wel duidelijk, maar
vallen weg bij vertaling en dat bedreigt de meetinvariantie uit stap 10.
Uitdrukkingen die zowel vertrouwd als vertaalbaar zijn, blijven staan: afhaken,
aan bod komen, het niet meer zien zitten.

**Waarom dit hier bij hoort.** De zware zinsbouw was geen toeval maar een
neveneffect van regel 8. Om niet vier keer "Ik ben sterk in" per cluster te
schrijven, verschoof de zin naar "... gaat me vlot af" en "... kost me weinig
moeite", en dat zet de bezigheid automatisch vooraan. Zestien van de zesenveertig
talentitems begonnen zo. De oplossing is niet terug naar één vorm, maar een
bredere reeks aanzetten die wel met de persoon beginnen: ik krijg vlot, ik vind
snel, ik zie meteen, ik maak makkelijk, ik werk vanzelf, ik heb weinig tijd nodig
om.

Na toepassing van deze drie regels staan de zesenveertig talentitems op gemiddeld
9,6 woorden, met twaalf woorden als langste item en geen enkel item daarboven.
Geen enkel item begint nog met een werkwoordgroep: alle zesenveertig openen met
de persoon of met de omstandigheid. Deze drie maten zijn geteld en na te tellen.

De eis dat elk talentitem minstens twee van de drie elementen draagt, is een
schrijfregel en geen meting: gemak, tempo en kwaliteit zijn niet met een
woordenlijst te tellen, want de kwaliteit zit meestal in het voorwerp van de zin
en niet in een bijwoord. De toewijzing hoort daarom bij de inhoudelijke
beoordeling in stap 3, waar zes beoordelaars per item aangeven welke elementen zij
erin lezen. Wat hier staat, is dus dat elk item met die eis in het hoofd is
geschreven, niet dat de eis al is aangetoond.

---

## 6. De honderd kandidaat-items

Codering: cluster, dan K1 tot K4. De schaalkolom in de bank blijft ongewijzigd
per familie: talentfoci, talentversnellers en drivers krijgen herkenning en
energie, motivatiebronnen enkel herkenning, interessevelden de interesseschaal.

### 6.1 Talentfoci

**Definitie van talent voor deze familie en de volgende.** Talent is iets snel,
met weinig inspanning en toch heel goed kunnen. Elk item hieronder draagt minstens
twee van die drie elementen. Een item dat enkel zegt dat iemand iets doet, hoort
hier niet.

**Functioneel Innovatief.** Praktisch vernieuwen: bestaande dingen slimmer of
beter laten werken. Niet: artistieke vormgeving, niet abstract concept denken.

- K1 Ik zie meteen hoe iets handiger kan.
- K2 Ik ben sterk in iets beter laten werken.
- K3 Ik bedenk makkelijk nieuwe manieren om iets op te lossen.
- K4 Ik vind snel een kortere weg naar hetzelfde resultaat.

**Artistiek Innovatief.** Verbeelden en vormgeven met woord, beeld, klank,
materiaal of beweging. Niet: technische vindingrijkheid.

- K1 Ik kan een creatief idee makkelijk naar een vorm herleiden.
- K2 Ik krijg vlot een mooi resultaat met kleur, klank of beweging.
- K3 Ik verzin snel een beeld of verhaal dat blijft hangen.
- K4 Ik maak makkelijk iets moois met een heel eigen stijl.

**Complexiteit en Conceptueel.** Samenhang zien in veel of ingewikkelde
informatie. Niet: nauwkeurig uitvoeren, niet analyseren van één oorzaak.

- K1 Ik ben sterk om patronen te herkennen in losse feiten.
- K2 Bij veel informatie zie ik snel wat het belangrijkste is.
- K3 Ik leg vlot verbanden tussen verschillende dingen.
- K4 Ik krijg een moeilijk onderwerp makkelijk helder voor mezelf.

**Overdrachtelijk Interactief.** Iets zo overbrengen dat de ander het begrijpt.
Niet: overtuigen of in beweging zetten, dat is de versneller Impact.

- K1 Ik ben sterk in iets uitleggen zodat de ander het meteen begrijpt.
- K2 Ik kan mijn taal makkelijk aanpassen aan de persoon voor me.
- K3 Iets uitleggen gaat me vanzelf af, ook zonder voorbereiding.
- K4 Anderen zeggen dat ik moeilijke dingen eenvoudig kan uitleggen.

**Sociaal Interactief.** Contact maken en samenwerken met verschillende mensen.
Niet: iemand ondersteunen die het moeilijk heeft, dat is een versneller.

- K1 Ik ben sterk in contact maken met nieuwe mensen.
- K2 In een nieuwe groep krijg ik makkelijk een gesprek op gang.
- K3 Ik kan mensen zich snel op hun gemak laten voelen.

**Systematisch en Uitvoerend.** Ordelijk en volledig werken zonder er moeite voor
te moeten doen. Nieuw item bewust op overzicht gericht, om herhaling van F7 te
vermijden. Zie ook punt 4.3: F7 zelf spreekt de talentdefinitie tegen.

- K1 Ik ben sterk in overzicht houden over wat nog moet gebeuren.
- K2 Ik werk het best vanuit een planmatige aanpak.
- K3 Fouten in mijn eigen werk kan ik snel herstellen.

### 6.2 Talentversnellers

**Analyse.** Doorgronden en uitpluizen voor het handelen. Niet: het geheel
overzien, dat is een talentfocus.

- K1 Ik vind snel de oorzaak van een probleem.
- K2 Ik ben sterk in uitpluizen waarom iets misloopt.
- K3 Ik zie snel hoe iets in elkaar zit.
- K4 Ik begrijp makkelijk verschillende verklaringen voor hetzelfde.

**Individueel ondersteunend.** Eén persoon nabij zijn in wat moeilijk ligt.
Niet: een groep bij elkaar houden.

- K1 Ik ben sterk in een gesprek met iemand die het moeilijk heeft.
- K2 Ik voel meteen aan wanneer iemand het even niet meer ziet zitten.
- K3 Ik kan goed luisteren zonder meteen raad te geven.
- K4 Mensen zoeken me vaak op om te vertellen wat hen bezighoudt.

**Groepsondersteunend.** Verschillen in een groep bruikbaar houden rond een
gezamenlijk doel. Niet: de groep leiden of overtuigen.

- K1 Ik ben sterk in een groep bij elkaar houden rond een doel.
- K2 Ik merk snel wie in een groep afhaakt.
- K3 Ik breng vlot mensen met andere meningen weer samen.
- K4 Ik zorg makkelijk dat iedereen aan bod komt.

**Impact.** Anderen in beweging krijgen. Niet: uitleggen, niet resultaat halen.

- K1 Ik ben sterk in anderen meekrijgen met mijn voorstel.
- K2 Ik krijg mensen makkelijk mee om iets te doen.
- K3 Ik heb weinig woorden nodig om iemand te overtuigen.
- K4 Anderen zeggen dat ik hen makkelijk enthousiast maak.

**Resultaat.** Vlot bij het beoogde eindpunt komen. Niet: nauwkeurig afwerken, dat
is een talentfocus, en niet volharding, want inspanning is juist het tegendeel van
de talentdefinitie.

- K1 Ik ben sterk in iets tot een goed einde brengen.
- K2 Ik blijf gefocust op mijn doel, ook als er veel afleiding is.
- K3 Ik zie snel welke stap me het dichtst bij mijn doel brengt.
- K4 Ik werk makkelijk af wat ik begon.

**Constructief onderscheidend.** Het verschil kúnnen maken: iets beter achterlaten
dan het was. Zie punt 4.1: dit is de herschreven bedoeling van het cluster. Niet
te verwarren met Try Hard, dat het verschil wíllen maken voor één bepaalde persoon
is. Hier gaat het om bekwaamheid en daarom staat het in talentvorm, daar om een
werkpatroon en daarom staat het in gedragsvorm. Ook niet: vergelijken met anderen,
want het instrument zet jongeren nooit naast elkaar.

- K1 Ik ben sterk om een idee van anderen nog beter te maken.
- K2 Ik krijg makkelijk een beter resultaat dan wat er al lag.
- K3 Ik zie snel wat een aanpak nog beter zou maken.
- K4 Ik zie makkelijk een oplossing die nog niet op tafel lag.

### 6.3 Drivers

Deze vijf clusters bevragen herkenbare werkpatronen. Zij zijn uitdrukkelijk geen
persoonlijkheidstrek en geen stressdiagnose. De items blijven daarom bij
gedragingen die de jongere zelf herkent, zonder klinische kleuring.

**Hier staat de talentvorm bewust niet in.** Een driver is geen bekwaamheid. "Ik
ben sterk in de lat hoog leggen" zou van een werkpatroon een verdienste maken, en
dat is precies de verschuiving die dit instrument niet mag maken. De items
hieronder blijven dus in gedragsvorm, en dat is geen nalatigheid maar het
onderscheid tussen de twee families.

**Be Perfect.** Hoge eigen lat, afwerken tot het klopt.

- K1 Ik leg de lat voor mezelf hoog.
- K2 Een foutje in mijn werk blijft aan me knagen.
- K3 Ik werk iets liever wat langer door dan het half af te geven.
- K4 Ik kijk liever twee keer na dan één keer.

**Hurry Up.** Tempo, gelijktijdigheid, weinig wachten.

- K1 Ik begin liever meteen dan lang te wachten.
- K2 Ik doe vaak meer dingen tegelijk.
- K3 Ik heb vaak het gevoel dat ik moet opschieten.
- K4 Ik werk het liefst snel door tot iets klaar is.

**Please Others.** Rekening houden met wat anderen nodig hebben of vinden.

- K1 Ik zeg moeilijk nee als iemand iets van me vraagt.
- K2 Ik probeer anderen steeds een tevreden gevoel te geven.
- K3 Bij spanning pas ik mijn mening aan, ook als die niet klopt voor mij.
- K4 Ik vind het belangrijk dat mensen me graag zien.

**Try Hard.** Iets uitzonderlijks willen doen voor iemand naar wie je opkijkt en
van wie je weet dat die in je gelooft. Niet: inzet of volharding in het algemeen.
Zonder die persoon in het item valt het cluster samen met gewone prestatiedrang,
en dan meet het niet het patroon maar de bereidheid om moeite te doen. Zie punt
4.4.

- K1 Ik doe graag een extra inspanning als iemand in mij gelooft.
- K2 Ik blijf doorgaan, ook bij veel moeite, voor iemand naar wie ik opkijk.
- K3 Ik wil vooral het verschil maken voor iemand die mij inspireert.
- K4 Ik neem er extra werk bij als die ene persoon erop rekent.

**Be Strong.** Geen nieuwe items. Dit cluster heeft er al drie, D5, D6 en D7.
Het gaat wel mee in de itemanalyse in stap 7, want twee van die drie zijn
situatie-items en het is nooit getoetst of ze bij het derde passen.

### 6.4 Motivatiebronnen

Deze vijf clusters volgen het onderscheid tussen intern en extern gerichte
motivatie. Autonomie, competentie en verbondenheid zijn intern gericht,
erkenning en verwachting extern. Enkel de herkenningsschaal, geen energievraag.

Ook hier geen talentvorm. Een motivatiebron zegt waar de energie vandaan komt,
niet wat iemand goed kan. "Ik ben sterk in zelf kiezen" zou autonomie tot een
vaardigheid maken en de motivatielaag onbruikbaar maken.

**Autonomie.** Zelf kunnen kiezen hoe en wanneer.

- K1 Ik werk het liefst op mijn eigen manier.
- K2 Ik maak graag zelf de keuze in wat ik aanpak.
- K3 Ik leer beter als niemand me voorschrijft hoe het moet.
- K4 Ik plan mijn werk graag zelf in.

**Competentie.** Merken dat je bijleert of beter wordt.

- K1 Ik werk harder als ik zie dat ik vooruitga.
- K2 Ik vind het fijn als iets net moeilijk genoeg is.
- K3 Ik wil ergens echt goed in worden.
- K4 Ik doe graag iets waar ik van bijleer.

**Verbondenheid.** Motivatie uit het samen zijn en samen doen.

- K1 Ik studeer liever samen met anderen.
- K2 Ik doe meer moeite voor een groep waar ik bij hoor.
- K3 Het helpt me als iemand meeleeft met wat ik doe.
- K4 Ik werk beter als ik weet dat anderen op me rekenen.

**Erkenning.** Extern gericht: punten, prijzen, gezien worden.

- K1 Een goed resultaat geeft me een duw in de rug.
- K2 Ik werk harder als mijn inzet gezien wordt.
- K3 Ik vind het belangrijk dat anderen zien wat ik presteer.
- K4 Een compliment doet me doorgaan.

**Verwachting.** Extern gericht: wat de omgeving van je verwacht.

- K1 Ik houd rekening met wat mijn ouders van me verwachten.
- K2 Ik houd rekening met wat mensen rondom mij belangrijk vinden.
- K3 Ik wil niemand teleurstellen met mijn studiekeuze.
- K4 De mening van school of familie speelt mee in mijn keuze.

### 6.5 Interessevelden

Register zoals de bestaande zes: een omschrijving van een bezigheid, geen
uitspraak over jezelf. Daarom ook hier geen talentvorm: interesse is
aantrekkingskracht en zegt niets over kunnen. Iemand kan zich sterk aangetrokken
voelen tot iets waar hij geen talent voor heeft, en dat onderscheid is voor een
studiekeuzegesprek juist het waardevolle. De uitkomst blijft een rangorde binnen
deze ene jongere en nooit een beroepsadvies of een Holland-code.

**Realistisch**
- K1 Met gereedschap of machines werken, of buiten aan de slag zijn.
- K2 Iets in elkaar zetten en laten werken.
- K3 Sleutelen, monteren of herstellen.

**Investigative**
- K1 Een probleem uitpluizen met cijfers, gegevens of proeven.
- K2 Lezen en uitzoeken tot je het begrijpt.
- K3 Onderzoeken waarom iets gebeurt zoals het gebeurt.

**Artistiek**
- K1 Muziek, theater, film of beeldend werk maken.
- K2 Een eigen ontwerp of verhaal uitwerken.
- K3 Vormgeven, tekenen, fotograferen of video-monteren.

**Sociaal**
- K1 Iemand begeleiden of iets bijleren.
- K2 Zorgen voor mensen die het nodig hebben.
- K3 Met een groep werken rond iets wat mensen bezighoudt.

**Ondernemend**
- K1 Een idee omzetten in een eigen project of zaak.
- K2 Anderen overtuigen of iets verkopen.
- K3 Een team of een activiteit leiden.

**Conventioneel**
- K1 Gegevens ordenen, bijhouden en kloppend maken.
- K2 Werken met regels, procedures of administratie.
- K3 Plannen en afspraken op orde houden.

---

## 7. Ontwikkelstappen

| Stap | Wat | Wie | Doorlooptijd | Voorwaarde om verder te gaan |
|---|---|---|---|---|
| 1 | Constructdefinities per cluster vastleggen: wat valt eronder, wat niet, en welk aangrenzend cluster wordt uitgesloten | ontwikkelaar | 2 weken | 28 definities, elk met minstens één expliciete uitsluiting |
| 2 | Bestaande talentitems in talentvorm brengen: F1, F3, V5 en F7 herschrijven of vervangen, V1, V2, V3 en F6 aanvullen met de gemakscomponent, en beslissen over V6 en over de overlap in Systematisch en Uitvoerend | ontwikkelaar met één externe lezer | 3 weken | elk van de 12 talentitems draagt minstens twee van de drie elementen, met schriftelijke motivatie per beslissing |
| 3 | Inhoudelijke beoordeling van de honderd kandidaten | 6 onafhankelijke beoordelaars | 3 weken | drempels in punt 8.1 gehaald |
| 4 | Herschrijven of laten vallen wat zakt, kandidaten aanvullen waar een cluster onder drie geschikte items valt | ontwikkelaar | 2 weken | elk dragend cluster heeft minstens 4 geschikte kandidaten |
| 5 | Cognitieve interviews | 10 jongeren uit de doelgroep | 3 weken | geen item dat door meer dan 2 jongeren anders begrepen wordt dan bedoeld |
| 6 | Vertaling naar Frans en Engels met terugvertaling | 2 vertalers en 1 onafhankelijke terugvertaler per taal | 4 weken | betekenisverschuiving per item beoordeeld en opgelost |
| 7 | Pilootafname en itemanalyse, selectie van de definitieve 46 | 400 jongeren, Nederlands | 8 weken werving en afname | drempels in punt 8.2 gehaald |
| 8 | Opname in de bank, versienummer omhoog, wijzigingslog, registerversie herrekend | ontwikkelaar | 1 week | wachtertests groen, volledige testreeks groen |
| 9 | Structuurtoets in een onafhankelijke steekproef | 400 jongeren, los van stap 7 | 8 weken | zie punt 8.3 |
| 10 | Meetinvariantie tussen de drie talen | 400 per taalversie | apart traject | zie punt 8.3 |

Realistische doorlooptijd tot en met stap 8, voor het Nederlands: acht tot tien
maanden. Stap 9 en 10 komen daar bovenop en zijn een apart onderzoekstraject.

Pas na stap 7 wordt de analysematrix in `docs/ANALYSEMATRIX-BETROUWBAARHEID.md`
uitvoerbaar. Voor stap 7 is er niets te berekenen.

---

## 8. Beslissingsregels met drempels

Elke drempel is geclassificeerd volgens de conventie van het reviewdossier:
**Empirisch onderbouwd**, **Ontwerpconventie**, **Interpretatieve heuristiek** of
**Technische kwaliteitsregel**.

### 8.1 Inhoudelijke beoordeling, stap 3

Zes beoordelaars wijzen elk item onafhankelijk toe aan een cluster en beoordelen
de relevantie op vier punten.

| Regel | Drempel | Classificatie |
|---|---|---|
| Item behouden op inhoudsvaliditeit per item | inhoudsvaliditeitsindex minstens 0,78 | Empirisch onderbouwd, gangbare drempel bij zes tot tien beoordelaars |
| Cluster behouden als geheel | gemiddelde index over de items minstens 0,90 | Ontwerpconventie |
| Toewijzing aan het juiste cluster | minstens 5 van de 6 beoordelaars wijzen het item aan het bedoelde cluster toe | Ontwerpconventie |
| Item met dubbele lading | item dat door 2 of meer beoordelaars aan een ander cluster wordt toegewezen, gaat terug naar de schrijftafel | Technische kwaliteitsregel |

Zes beoordelaars en niet drie, precies omdat bij drie tot vijf beoordelaars een
volmaakte overeenstemming vereist zou zijn en één afwijkende lezing dan een goed
item onterecht laat vallen.

### 8.2 Itemanalyse en selectie, stap 7

| Regel | Drempel | Classificatie |
|---|---|---|
| Samenhang van het item met de rest van zijn cluster | correlatie minstens 0,30 | Empirisch onderbouwd, gangbare vuistregel |
| Bovengrens op die samenhang | boven 0,90 met een ander item van hetzelfde cluster is herhaling en geen betrouwbaarheid; het zwakste van de twee valt weg | Technische kwaliteitsregel |
| Plafond en bodem | geen antwoordcategorie die door meer dan 80 procent van de jongeren wordt gekozen | Technische kwaliteitsregel |
| Vorm van de verdeling | scheefheid hoogstens 2 in absolute waarde, gepiektheid hoogstens 7 | Empirisch onderbouwd |
| Ontbrekende antwoorden | item met meer dan 5 procent overgeslagen antwoorden wordt herzien | Ontwerpconventie |
| Cluster mag gerapporteerd worden met een betrouwbaarheidscijfer | omega met een betrouwbaarheidsinterval waarvan de ondergrens minstens 0,60 bedraagt | Ontwerpconventie |

De keuze voor omega en niet voor alfa is inhoudelijk: bij drie items met
ongelijke ladingen onderschat alfa systematisch. Bij drie items blijft elke
schatting bovendien onnauwkeurig, en daarom wordt niet het punt maar het
interval gerapporteerd. Een cluster dat de drempel niet haalt, verschijnt in het
rapport zonder betrouwbaarheidsclaim, niet met een lager cijfer.

### 8.3 Structuur en invariantie, stap 9 en 10

| Regel | Drempel | Classificatie |
|---|---|---|
| Aanvaardbare passing van het structuurmodel | vergelijkende passingsindex minstens 0,95, benaderingsfout hoogstens 0,06, gestandaardiseerd residu hoogstens 0,08 | Empirisch onderbouwd, gangbare grenswaarden |
| Invariantie tussen talen of leeftijdsgroepen | verschil in de vergelijkende passingsindex hoogstens 0,010 en in de benaderingsfout hoogstens 0,015 | Empirisch onderbouwd |

### 8.4 Steekproefomvang

Na uitbreiding zijn er 78 gescoorde items. De gangbare vuistregel van vijf tot
tien respondenten per item geeft 390 tot 780. Voor de itemanalyse in stap 7 is
**400** het minimum en 500 wenselijk. Voor de structuurtoets in stap 9 is een
**onafhankelijke** steekproef van 400 nodig, want een exploratieve oplossing op
de eigen data is geen structuurtoets.

Dit is een naar boven bijgestelde eis. In het reviewdossier staat op deze plaats
nog 300 afnames. Dat getal was te laag voor een bank van deze omvang en moet
worden gecorrigeerd.

Voor stap 10 zijn 400 afnames per taalversie nodig, dus 1200 in totaal. Dat is
een aanzienlijk traject en het is verstandig het Nederlands volledig af te werken
voor de andere twee talen worden opgestart. Tot dan blijven de Franse en de
Engelse versie uitdrukkelijk niet gelijkwaardig aan de Nederlandse.

---

## 9. Cognitieve interviews, protocol voor stap 5

Tien jongeren uit de doelgroep, gespreid over de leeftijd van 17 tot 23 jaar en
over onderwijsvormen. Per jongere ongeveer 45 minuten en ongeveer 20 items, zodat
elk item door minstens twee jongeren wordt besproken.

Per item worden vier vragen gesteld, in deze volgorde:

1. Lees de vraag luidop en zeg in je eigen woorden wat er gevraagd wordt.
2. Welk antwoord zou je geven, en waarom net dat.
3. Was er een woord waar je over moest nadenken.
4. Zou iemand die je kent dit anders kunnen begrijpen.

Een item zakt wanneer twee of meer jongeren het anders begrijpen dan bedoeld,
wanneer het antwoord niet uit de vraag te herleiden is, of wanneer een jongere
zegt dat er eigenlijk twee dingen gevraagd worden.

Van elk interview wordt een letterlijk verslag per item bijgehouden. Dat verslag
is het bewijsstuk waarmee later verantwoord wordt waarom een item in de bank
staat.

---

## 10. Wat dit traject wel en niet oplevert

Na stap 8 mag het instrument per dragend cluster een betrouwbaarheidscijfer met
interval tonen, en mag het zeggen dat de items inhoudelijk zijn beoordeeld en met
jongeren zijn nagesproken.

Na stap 8 mag het instrument nog altijd niet zeggen:

- dat het geschikt is voor selectie of toelating;
- dat het studiegeschiktheid of studiesucces voorspelt, want predictieve
  validiteit staat bewust niet in dit plan en zou het instrument buiten zijn
  gebruiksdoel duwen;
- dat de score van deze jongere zich met leeftijdsgenoten laat vergelijken, want
  daarvoor is een normgroep nodig en die is er niet;
- dat de drie talen gelijkwaardig zijn, tot stap 10 is afgerond;
- dat een cluster een eigenschap of een talentniveau meet. Het blijft herkenning
  op dit moment, in een reflectief instrument.

---

## 11. De prijs die dit kost

De bank gaat van 40 naar 86 vragen. Naar schatting stijgt de afnameduur daarmee
van ongeveer negen naar ongeveer negentien minuten. Die schatting is een
ontwerpconventie en geen meting; ze kan geijkt worden met de itemtijden die het
platform al opslaat, zodra de uitgebreide bank in gebruik is.

Dat raakt de belofte van dit instrument, namelijk een lage drempel voor een
zeventienjarige. Betrouwbaar meten kost vragen, en die twee eisen bijten elkaar.
Dit is een productbeslissing en geen psychometrische. Ze moet uitdrukkelijk
genomen worden en niet stilzwijgend, want de uitkomst bepaalt of het instrument
een gespreksopener blijft met eerlijk beperkte claims, of een meetinstrument
wordt met een langere afname.

---

## 12. Literatuur

Vantilborgh, T. (2023). *Principes van de psychometrie*. Acco.
ISBN 9789464674309. Leidraad voor de opbouw van dit plan en voor de volgorde
constructdefinitie, itemarchitectuur, betrouwbaarheid, structuur, invariantie.

American Educational Research Association, American Psychological Association en
National Council on Measurement in Education (2014). *Standards for Educational
and Psychological Testing*.

International Test Commission (2017). *ITC Guidelines for Translating and
Adapting Tests*, tweede editie.

Polit, D. F. en Beck, C. T. (2006). The content validity index: are you sure you
know what's being reported? *Research in Nursing and Health*, 29, 489 tot 497.
Bron van de drempel 0,78 bij zes tot tien beoordelaars.

Willis, G. B. (2005). *Cognitive Interviewing: A Tool for Improving Questionnaire
Design*. Sage. Bron van het protocol in punt 9.

Hu, L. en Bentler, P. M. (1999). Cutoff criteria for fit indexes in covariance
structure analysis. *Structural Equation Modeling*, 6, 1 tot 55. Bron van de
grenswaarden in punt 8.3.

Chen, F. F. (2007). Sensitivity of goodness of fit indexes to lack of measurement
invariance. *Structural Equation Modeling*, 14, 464 tot 504. Bron van de
verschildrempels voor invariantie.

McNeish, D. (2018). Thanks coefficient alpha, we'll take it from here.
*Psychological Methods*, 23, 412 tot 433. Onderbouwing van de keuze voor omega
boven alfa.
