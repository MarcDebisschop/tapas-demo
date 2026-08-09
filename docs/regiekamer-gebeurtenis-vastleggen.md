# Een gebeurtenis vastleggen op een lijn

Dit document beschrijft de toestand zoals ze is op de tak
`traject/gebeurtenis-vastleggen`, na commit `70bc5a6`. Het beschrijft wat er
werkt, wat er bewust niet gebeurt, en wat er nog open staat.

## Waar het over gaat

Een lijn is de verbinding tussen twee partijen in een traject. Op zo'n lijn
staan gebeurtenissen: wat er tussen die twee partijen gebeurd is. Elke
gebeurtenis heeft twee teksten die niets met elkaar te maken hebben:

- **de vaststelling**, die naar iedereen gaat die de lijn mag zien;
- **de indruk**, die de partij van de schrijver nooit verlaat.

Het scheiden van die twee is het hele punt. Het scherm doet dat scheiden niet
voor de mens: het biedt twee velden aan en laat de mens zelf beslissen wat waar
hoort.

## Wat het scherm doet

Vanuit het lijndetail opent de knop "Iets vastleggen" een invulvenster. Van
boven naar onder staat er:

1. **Om welke lijn het gaat.** De namen van beide partijen staan in de kop.
2. **Wie dit vastlegt.** Een keuze uit de mensen van dit traject die nog
   meedoen. Staat er precies één zo'n mens, dan staat die naam vast en valt er
   niets te kiezen.
3. **Wat voor soort.** Gesprek, Bericht, Overleg of Vaststelling.
4. **Wat er gebeurd is.** Verplicht. Met de toelichting: "Feitelijk,
   navertelbaar, zonder oordeel. Schrijf dit zo dat u het aan de andere kant
   zou durven voorlezen." En eronder, klein: "Dit gaat mee naar iedereen die
   deze lijn mag zien."
5. **Hoe het aanvoelde.** Optioneel. Met de toelichting: "Schrijf dit zo dat u
   het aan uw eigen kant zou durven voorlezen." En eronder, klein: "Dit
   verlaat uw eigen partij nooit. Ook de facilitator leest het niet."
6. De knoppen **Vastleggen** en **Laat maar**.

De twee tekstvelden staan nadrukkelijk uit elkaar. Het eerste zit in een kader
met een volle rand en een gekleurde streep aan de linkerkant. Het tweede zit in
een kader met een gestippelde rand en een andere achtergrond. Ze lijken niet op
twee gewone velden onder elkaar.

Het tweede veld leeg laten levert geen waarschuwing en geen opmerking op. Dat
is de gewone gang van zaken en niet iets waar het scherm iets van vindt.

Na het vastleggen sluit het venster en staat de nieuwe gebeurtenis meteen
bovenaan in de chronologie van die lijn. Er hoeft niets herladen te worden.

## Wat het scherm niet doet

Het splitst geen tekst automatisch. Het stelt geen tekst voor. Het oordeelt
nergens over wat in welk veld hoort. Wanneer de server iets weigert, komt de
zin van de server ongewijzigd op het scherm; het scherm verzint er niets bij.

## Wat de server weigert

Het schrijfadres is `POST /api/traject/trajecten/:trajectId/gebeurtenissen`.
Het bestond al en is aangescherpt. De controles staan in deze volgorde:

| Wat er misgaat | Wat de gebruiker leest | Code |
| --- | --- | --- |
| Geen auteur meegegeven | "Kies wie deze gebeurtenis vastlegt." | 400 |
| De vaststelling is leeg of bestaat enkel uit spaties | "Wat er gebeurd is, mag niet leeg blijven." | 400 |
| Een soort die niet bestaat | "Kies een geldige soort." | 400 |
| De lijn hoort bij een ander traject | "Deze lijn hoort niet bij dit dossier." | 404 |
| De schrijver mag deze lijn niet zien | "U kunt op deze lijn geen gebeurtenis vastleggen." | 403 |
| De auteur is geen persoon van dit traject | "Deze persoon hoort niet bij dit dossier." | 404 |
| De auteur doet niet meer mee | "<naam> is niet meer actief in dit dossier en kan niets vastleggen." | 400 |

Geen van die zinnen is een databankzin. De codes volgen het gedrag dat
`stuurFout` in dit huis al hanteerde: een melding met "niet gevonden" of "hoort
niet bij" wordt een 404, de rest een 400 of een 403.

### Waarom een auteur verplicht is

Rechtenregel 3 zegt: geen auteur betekent geen indruk voor niemand. Zonder
auteur kan de rechtenmodule niet vaststellen bij welke partij de indruk hoort,
en dan verbergt ze hem voor iedereen, ook voor wie hem net geschreven heeft.
Dat is stil gegevensverlies: de tekst staat in de databank maar niemand krijgt
hem ooit nog te zien. Daarom is de auteur een voorwaarde en geen wens.

### Waarom schrijfrecht via de leesregel loopt

Er is geen tweede regel geschreven. Het schrijfadres roept dezelfde functie aan
die het leesadres gebruikt: `magLijnZien` uit `server/traject/rechten.ts`.
Schrijfrecht is daardoor per constructie nooit ruimer dan leesrecht.

## Wat er in de databank veranderd is

Het scherm biedt vier soorten aan, maar de controlebeperking op de tabel liet
er maar drie toe: `gesprek`, `bericht` en `rechtstreeks_contact`. `overleg` en
`vaststelling` zouden geweigerd zijn door de databank zelf.

Migratie `0005_soorten_gebeurtenis.sql` herbouwt de tabel met een ruimere
beperking. Toegelaten zijn nu vijf waarden: de vier van het scherm plus
`rechtstreeks_contact`. Die vijfde blijft toegelaten omdat bestaande rijen hem
kunnen dragen; zonder hem zou het overzetten van de bestaande rijen stuklopen.
Het scherm biedt hem niet aan.

SQLite kan een controlebeperking niet wijzigen, dus de migratie bouwt een
nieuwe tabel, kopieert de rijen over met een expliciete kolomlijst, gooit de
oude weg en hernoemt. Dat is hetzelfde patroon als migratie 0004, die deze
tabel eerder al herbouwde.

Migratie 0004 vermeldde eerlijk een beperking: bij een tweede rechtstreekse
uitvoering zou de auteur leeglopen, omdat die kolom bij de eerste uitvoering
nog niet bestond. Die beperking geldt hier niet: de kolom staat nu in de
expliciete kolomlijst en wordt dus meegekopieerd.

## Een fout die onderweg gevonden is

In `server/traject/storage.ts` berekende `voegGebeurtenisToe` het tijdstip met
`tijdstipOfNu`, maar gooide de uitkomst weg en schreef daarna de ruwe,
meegegeven waarde weg. Zolang elke aanroep een tijdstip meegaf viel dat niet
op. Zodra het scherm er geen meegeeft, probeerde de opslag een lege waarde in
een verplichte kolom te zetten en weigerde de databank.

Alle tien andere plaatsen in datzelfde bestand gebruiken de uitkomst van
`tijdstipOfNu` wel. Deze ene week af. Ze is nu gelijkgetrokken: de server zet
het tijdstip zelf wanneer het scherm er geen meegeeft.

## Wat er gemeten is

Alle metingen zijn gedaan in de echte kloon, niet uit het hoofd.

| Meting | Voor | Na |
| --- | --- | --- |
| Testbestanden | 149 | 150 |
| Tests | 1460, alle groen | 1477, alle groen |
| Fouten van de typecontrole | 72 over 14 bestanden | 72 over 14 bestanden |
| Fouten in `server/traject` | 0 | 0 |
| Lange liggende streepjes in de gewijzigde bestanden | niet van toepassing | 0 |

Het aantal fouten van de typecontrole is ongewijzigd. Het verschil tussen de
twee lijsten is één regel waarin de volgorde van een opsomming in een melding
anders is; er is geen bestand bij gekomen en geen bestand af gegaan.

Er is niets uit de testmap verwijderd of afgezwakt. De volledige uitvoer van
`git diff main -- tests/`, buiten het nieuwe testbestand, bevat geen enkele
verwijderde regel.

Eén bestaande test is wel aangevuld. In `tests/traject-routes.test.ts` legde de
test "schrijft via gevalideerde routes" een gebeurtenis vast zonder auteur en
verwachtte dat dat lukte. Dat kan niet meer. De test maakt nu eerst een persoon
aan, geeft die als auteur mee, en controleert bovendien dat de auteur ook echt
in het antwoord staat. Er is dus een bewering bij gekomen, en geen af gegaan.

## De nieuwe tests

`tests/traject-gebeurtenis-vastleggen.test.ts` telt zeventien tests. Ze zijn
eerst geschreven en faalden toen, daarna is de code aangepast.

Wat geweigerd moet worden:

- een gebeurtenis zonder auteur;
- een auteur die niet aan dit traject hangt;
- een auteur die op inactief staat;
- een lijn die bij een ander traject hoort;
- iemand die de lijn niet mag zien;
- een lege vaststelling;
- een vaststelling van enkel spaties;
- een gebeurtenis met alleen een indruk;
- een soort die niet bestaat.

Wat moet lukken:

- de facilitator die schrijft, want die leest elke lijn;
- een gebeurtenis zonder indruk;
- de vier soorten die het scherm aanbiedt;
- een gebeurtenis zonder tijdstip, waarbij de server het tijdstip zet;
- een vaststelling met spaties aan de randen, die zonder die spaties bewaard
  wordt.

Over de indruk:

- zichtbaar voor iemand van de eigen partij van de auteur;
- onzichtbaar voor de andere partij van de lijn;
- onzichtbaar voor de facilitator.

Die drie tests schrijven via het echte schrijfadres en lezen daarna via het
echte leesadres, met een andere persoon. Ze bouwen geen eigen controle na. Wat
ze meten is precies wat de rechtenmodule doet.

## Het open punt: wie mag er schrijven

Dit is niet beslist en hoort niet door mij beslist te worden.

Wat er nu staat is voorlopig en zo ruim als het leesrecht, geen haar ruimer.
Concreet betekent dat: wie de lijn mag zien, mag er ook op schrijven. Gemeten
in `server/traject/rechten.ts` geeft `magLijnZien` recht aan:

- de prior, die alles ziet;
- een beheerder zonder persoon in het traject;
- iemand die bij een van de twee partijen van de lijn hoort;
- de facilitator;
- de leider van een werkstroom, maar alleen wanneer er een vraagkaart van die
  werkstroom op deze lijn hangt.

En uitdrukkelijk niet aan iemand die uitsluitend betrokkene is.

De vraag die openstaat is of schrijfrecht smaller moet zijn dan dat. Er zijn
twee plaatsen waar dat verdedigbaar lijkt:

1. **De werkstroomleider.** Die ziet de lijn alleen omdat er toevallig een
   vraagkaart van zijn werkstroom op hangt. Mag hij daarom ook de geschiedenis
   van die lijn mee schrijven?
2. **De beheerder zonder persoon.** Die ziet de lijn uit hoofde van zijn
   beheer. Zijn gebeurtenis zou een auteur nodig hebben die wel een persoon is,
   en dan schrijft hij op naam van iemand anders.

Zolang daar geen beslissing over is, blijft het bij: nooit ruimer dan
leesrecht. Smaller maken kan later zonder het scherm te veranderen, want de
server beslist en het scherm toont enkel de weigering.

## Wat er nog niet kan

- **Inspreken.** De twee velden zijn twee aparte velden, dus later kunnen er
  twee aparte opnames bij. Er is nu niets van gebouwd.
- **Een tijdstip in het verleden kiezen.** Het scherm geeft geen tijdstip mee,
  dus de server neemt het moment van vastleggen. Wie een gesprek van vorige
  week wil vastleggen, krijgt de datum van vandaag. Het adres aanvaardt wel een
  meegegeven tijdstip, dus het scherm kan er later een keuze bij krijgen.
- **Een gebeurtenis wijzigen of intrekken.** Er is alleen toevoegen.
- **Een auteur voorstellen.** De keuze staat op "Nog te kiezen" tot de mens
  zelf kiest, behalve wanneer er maar één mogelijke auteur is. Het scherm weet
  niet wie er achter het toetsenbord zit en gokt daarom niet.
- **Vooraf tonen wie niet mag schrijven.** De keuzelijst toont alle mensen van
  het traject die nog meedoen. Wie de lijn niet mag zien, staat er dus ook
  tussen; de weigering komt pas na het indrukken van Vastleggen. Dat kan later
  strakker, maar dan moet het scherm de rechtenregel kennen, en dat is precies
  wat we tot nu toe vermeden hebben.

## Over het nakijken op het scherm

Er zijn afdrukken gemaakt op een breed venster van 1440 bij 1000 en op een smal
venster van 390 bij 900, telkens leeg en volledig ingevuld, en telkens ook na
het opslaan.

Wat in orde is: geen tekst valt buiten een kader, geen woord breekt midden in,
de twee kaders zijn op beide breedtes duidelijk van elkaar te onderscheiden, en
de knoppen staan op beide breedtes binnen bereik. Op smal moet er binnen het
venster gescrold worden om ze te zien; dat werkt.

Wat opvalt en niet van dit venster komt: op een smal scherm legt het zwevende
blokje "TaPas Core" rechtsonder zich over de onderrand van het venster, vlak
naast de knop "Laat maar". Dat blokje hoort bij het platform en stond er al.
Het blokkeert de knoppen niet, maar het staat er onrustig bij.

## Waar het staat

- Tak: `traject/gebeurtenis-vastleggen`, vanaf `c5f35b4` op main.
- Commit: `70bc5a6`.
- Er is niets naar main gebracht.

Gewijzigd of nieuw:

- `migrations/0005_soorten_gebeurtenis.sql` (nieuw)
- `migrations/meta/_journal.json`
- `server/traject/schema.ts`
- `server/traject/storage.ts`
- `server/traject/routes.ts`
- `client/src/pages/traject-scherm.tsx`
- `tests/traject-gebeurtenis-vastleggen.test.ts` (nieuw)
- `tests/traject-demo.test.ts`, `tests/traject-opslag.test.ts`,
  `tests/traject-personen-opslag.test.ts`, `tests/traject-routes.test.ts`

## Een opmerking over de omgeving

De databank die de server leest wordt bepaald door `TAPAS_DB_PATH`. Staat die
variabele niet, dan zoekt de server een bestand `data.db` in de projectmap, in
de werkmap en in de map van de gebouwde uitvoer, in die volgorde. Wie met een
andere naam werkt, denkt te meten in de ene databank en meet in de andere.

Het demonstratiedossier met de negen mensen wordt alleen aangemaakt wanneer
`TAPAS_DEMO=1` staat. Zonder die schakelaar start de server zonder traject, en
dan lijkt het dossier verdwenen terwijl het er nooit geweest is. Met de
schakelaar bouwt hij zichzelf opnieuw op uit `server/traject/demo.ts`.
