# Handleiding bekwaamheidsmodule — voor Admin Beheerders

Versie 1, 14 augustus 2026 · geldig voor de stand van `main` op commit `a27ddcc`

---

## Lees dit eerst: wat er wel en niet kan

De module is gebouwd en staat op `main`. Ze is **niet in alle onderdelen bestuurbaar via een scherm.** Dat is geen storing, het is de stand van de bouw, en u moet het weten voordat u begint.

**Er is in de hele module precies één weg waarlangs u iets kunt vastleggen: het normprofiel.** Nagemeten: de module heeft vier lees-eindpunten en drie schrijf-eindpunten, en alle drie de schrijfwegen gaan over het normprofiel (neerleggen, bijwerken, bevriezen). De poortsimulatie is ook een POST, maar die verandert niets.

Wat u vandaag **wel** kunt doen:

| Handeling | Waar |
|---|---|
| Een norm opstellen, bijwerken en bevriezen | `/admin/bekwaamheid/normprofiel` |
| Zien waar iedere ronde staat en wat er openstaat | `/admin/bekwaamheid` |
| Vooraf uitproberen wat de poort zou doen | `/admin/bekwaamheid`, kaart Poortsimulatie |
| Per beheerder zien of er afnamerecht is | `/admin/toegang`, kolom Licentie |
| Praktijkactiviteit volgen en de afnamenorm bijstellen | `/admin/kwaliteit` |
| Oefenen met de kennisvragen | `/admin/oefenen` |

Wat u **niet** kunt doen via een scherm, omdat er geen eindpunt voor is:

- een licentie uitgeven, verlengen, opschorten of beëindigen
- een accreditatie vastleggen
- een ronde openen of een fase laten opschuiven
- een bewijsstuk inleveren of een score invoeren
- een beslissing vastleggen, een bezwaar behandelen, een coachingsplan neerleggen

De tabellen daarvoor bestaan alle veertien en de rekenkernen staan klaar en zijn getest. Wat ontbreekt is het scherm en het eindpunt ertussen. **De regiekamer leest die tabellen; ze vult ze niet.** Zolang er niets in staat, blijft ze leeg — dat is correct gedrag, geen fout.

Praktisch betekent dit: u kunt vandaag de norm vaststellen en het beeld volgen. De cyclus daadwerkelijk dóórlopen kan nog niet.

---

## 1 · Inloggen en de weg naar de module

Alle schermen in deze handleiding zitten achter de beheerderslogin. Meld u aan op `/admin`. Op elk scherm brengt de knop **Terug naar admin** u rechtsboven terug.

De vier adressen:

```
/admin/bekwaamheid              De regiekamer
/admin/bekwaamheid/normprofiel  De norm
/admin/toegang                  Toegang en licenties
/admin/kwaliteit                Praktijkactiviteit
/admin/oefenen                  Oefenen (voorheen /admin/stm)
```

Het oude adres `/admin/stm` leidt automatisch om naar `/admin/oefenen`. Bestaande bladwijzers blijven dus werken.

---

## 2 · De norm vaststellen

**Scherm** `/admin/bekwaamheid/normprofiel` · te bereiken via de knop **De norm** rechtsboven in de regiekamer.

Dit is het scherm waar u begint, want zonder bevroren norm is er niets om aan te meten.

### 2.1 Kies het instrument

Bovenaan staat de kaart **Instrument** met een keuzelijst. Achter elke naam staat direct of er al een geldende norm is: `— geldend: versie 3` of `— geen geldende norm`. Daaronder verschijnen kentekens: het aantal versies, welke versie geldt, en **Concept in bewerking** als er een onbevroren concept ligt.

### 2.2 Vul het formulier

Het formulier heet **Eerste versie** wanneer er nog niets is, **Concept — versie N** wanneer u een bestaand concept bijwerkt, of **Nieuwe versie — wordt versie N** wanneer u een bevroren norm opvolgt.

Bovenaan staat de belangrijkste regel van het scherm: *een concept raakt geen enkele beslissing; de norm geldt pas vanaf het moment van bevriezing.* U kunt dus rustig werken.

De velden, in twee kolommen:

**Weging per as** en **Drempel per as** — voor de vier assen **Weten**, **Zien**, **Zeggen** en **Zorgen**. De wegingen samen moeten kloppen; het scherm zegt het als dat niet zo is.

Daaronder:

| Veld | Wat erin hoort |
|---|---|
| Totaaldrempel | Als breuk, bijvoorbeeld `0,70` |
| Activiteitsdrempel | Aantal afnames binnen het venster. Onderschrijding is geen tekortkoming |
| Activiteitsvenster in maanden | Over welke periode dat aantal geldt |
| Methode | Hoe de cesuur tot stand kwam |
| Panelomschrijving | Wie het panel vormde, **zonder namen** |
| Vastgesteld door | Wie de norm vaststelde |
| Onderbouwing | **Minstens 200 tekens.** Het veld toont de teller live |

Die 200 tekens zijn geen vormvereiste. Ze worden ook op de server afgedwongen en zelfs in de databank als `CHECK`-beperking: een cesuur zonder onderbouwing is niet te verantwoorden tegenover iemand die erop afgewezen wordt. Schrijf hier waaróm de grens op die hoogte ligt.

### 2.3 Leg het concept neer

Klik **Concept neerleggen** (of **Concept bijwerken** als er al één ligt). Fouten verschijnen bij het veld waar ze thuishoren. Een concept mag zo lang blijven liggen als u wil en is onbeperkt bij te werken.

### 2.4 Bevriezen — de enige onomkeerbare handeling

Zodra het concept klopt, verschijnt de knop **Bevriezen** met een sneeuwvlokje. Er volgt een bevestiging die zegt wat er gebeurt:

> Versie N bevriezen? Vanaf dat moment wijzigt ze niet meer en is er geen weg terug. Een latere aanpassing is een nieuwe versie.

Dat is letterlijk zo. Na bevriezing is het profiel alleen-lezen. Wilt u later iets veranderen, dan klikt u **Nieuwe versie**: die begint bij de bestaande waarden, maar **de onderbouwing schrijft u opnieuw.** Bewust — een nieuwe cesuur verdient een nieuwe verantwoording, geen overgeërfde.

Onderaan staat **Versiehistoriek**. Elke versie blijft nalezen, ook de vervangen. Een bevroren cesuur is alleen te verantwoorden als na te lezen is wat er vóór stond.

### 2.5 Wanneer u bevriest

Bevries pas als de weging en de drempels vaststaan én de onderbouwing af is. Voor het eerste instrument is `t4p-business-kompas` de logische start: dat is het instrument waarmee de cyclus begint.

---

## 3 · De regiekamer

**Scherm** `/admin/bekwaamheid` · kop **De regiekamer**, met daaronder: rondes, agenda, overeenstemming tussen beoordelaars en de poort.

Dit scherm schrijft nooit iets. U kunt er niets stukmaken.

### 3.1 Zet eerst het peilmoment

De bovenste kaart heet **Peilmoment** en dat is geen decoratie: elke telling op dit scherm hangt aan één datum. De agenda, de verstreken vensters en de leeftijd van een post zijn zonder peildatum niet te lezen.

- **Peildatum** — standaard vandaag. Zet hem in de toekomst om te zien wat er dan openstaat
- **Instrument** — `Alle instrumenten` of één specifiek

### 3.2 De acht kaarten

**Rondes per fase.** Alle elf fasen staan er, ook de lege. Bewust: een fase die pas verschijnt zodra er iemand in zit, verbergt precies wat u wil zien.

**Agenda — openstaande posten.** Posten met een datum op of vóór de peildatum die nog niet zijn afgehandeld. Dit is uw werklijst.

**Overeenstemming tussen beoordelaars.** ICC per bewijsstuk met het 95%-interval, volgens sectie 13.1 van het draaiboek. Let op het interval, niet op de puntschatting: bij weinig dossiers is dat interval breed en dan is "boven de norm" geen conclusie. Het normbeeld kan daarom `onbeslist` zijn — dat betekent niet slecht, het betekent te weinig gegevens.

**Nog niet volledig beoordeeld.** Bewijsstukken waar niet elke betrokken beoordelaar een score invoerde. Openstaand werk, geen meetfout.

**Kwaliteit van het proces.** De drie termijnen uit sectie 13.2 die uit de eigen tabellen te meten zijn: debrief binnen 10 werkdagen, publicatie binnen 3 werkdagen, bezwaar binnen 30 kalenderdagen.

**Kwaliteit van de itembank.** p-waarden en item-restcorrelaties.

**Poortsimulatie.** Zie 3.3.

**Niet gemeten.** Acht indicatoren uit sectie 13 waarvoor het platform vandaag geen bron heeft, met per stuk de reden. Ze staan er omdat een leeg vakje leest als "gehaald". Neem deze lijst mee in elke verantwoording: dit is wat u níet weet.

### 3.3 De poortsimulatie gebruiken

Hiermee vraagt u vooraf wat de poort zou doen — zonder dat er iets gebeurt.

Vul in:

- **Handeling** — `afname_aanmaken`, `uitnodiging_aanmaken`, `afname_voortzetten`, `rapport_bekijken` of `historiek_bekijken`
- **Stand** — `handhaaf`, `log` of `uit`. Dit overschrijft alleen deze ene vraag
- **Beheerder-id van wie afneemt** — of **Of organisatie-id**

Klik **Simuleren**. De uitkomst opent met één regel: *De poort zou dit doorlaten* of *De poort zou dit weigeren.* Daaronder de tabel:

| Veld | Hoe u het leest |
|---|---|
| Grond | Waarom, in de taal van het draaiboek |
| Gaat door in deze stand | Wat er nú zou gebeuren |
| Zou weigeren bij handhaven | Wat er zou gebeuren als u `handhaaf` aanzet |
| Feiten opzoekbaar | `nee` betekent dat de poort niet kon toetsen |
| Platformdeel gedefinieerd | `nee — niet toetsbaar`: geen instrument achter dit deel |
| Tekst aan de afnemer | Wat de gebruiker te zien zou krijgen |
| Weg vooruit | Wat die persoon eraan kan doen |

Twee regels die het scherm zelf noemt en die u moet vertrouwen: een simulatie verandert niets en laat geen spoor, ook niet in het auditlog. En de werkelijke stand van de poort blijft staan.

**De rij die u het meest zult gebruiken is "Zou weigeren bij handhaven".** Loop uw actieve afnemers erlangs voordat u de poort op `handhaaf` zet. Elke `ja` is iemand die dan wordt tegengehouden.

---

## 4 · Toegang en licenties

**Scherm** `/admin/toegang`

Bovenaan staat sinds deze release een uitleg die de kern bevat:

> Toegang heeft twee voorwaarden. De schakelaar opent het platformdeel; de licentie geeft het recht om er een afname mee te doen. Beide moeten kloppen.

Dat was tot nu toe op geen enkel scherm te zien. Naast elke module-rij staat nu een kolom **Licentie**. Onder de uitleg staat de **peildatum** waarop dat beeld gelezen is.

### 4.1 De vijf standen

Elke stand krijgt woorden en niet alleen een kleur.

| Stand | Wat u ziet | Wat het betekent |
|---|---|---|
| `buiten_het_register` | Niet in het register | Deze persoon staat nog niet in het bekwaamheidsregister. **Neutraal** — geen tekortkoming |
| `geen_licenties` | Geen licentie | Wél in het register, maar zonder enige licentie. Hier is een keten begonnen en niet afgemaakt |
| `in_orde` | Licentie in orde | Afnamerecht, geen alert, geen openstaande voorwaarde |
| `let_op` | Licentie: let op | Er is afnamerecht, maar er is iets: een deel zonder recht, een actief alert of een openstaande voorwaarde |
| `geen_afnamerecht` | Geen afnamerecht | Geen enkele licentie geeft vandaag afnamerecht |

Het verschil tussen de eerste twee is het belangrijkste van deze tabel. **Niet in het register** is neutraal: van deze persoon is nog niets vastgelegd. **Geen licentie** is dat niet: hier is iemand ingeschreven en daarna blijven liggen. Behandel die twee dus verschillend.

Per module-rij kunt u ook `Geen licentie voor dit deel` of `Geen instrument achter dit deel` zien. Dat laatste is geen probleem: bij de accreditatie-rijen zit geen instrument, dus daar blijft de kolom leeg.

`Licentie: let op` heeft drie mogelijke oorzaken, die u apart terugziet: **alert open**, **voorwaarde open** en **verloopt**. Een voorwaarde met een datum die al voorbij is telt níet als openstaande voorwaarde — dat is een verstreken termijn en die hoort op de agenda van de regiekamer.

### 4.2 Als het licentiebeeld niet laadt

Dan staat er: *Het licentiebeeld kon niet worden opgehaald. De schakelaars werken wel.* Dat is precies zo bedoeld — een storing in de licentiekolom mag u niet beletten toegang te regelen.

### 4.3 Vijf talen

Kop, standen en uitleg zijn beschikbaar in Nederlands, Frans, Engels, Spaans en Russisch. De **statusnamen niet**: `bekrachtigd_met_aandachtspunt` blijft in elke taal zo staan. Dat is een term uit het draaiboek die zo in de databank en in het auditspoor staat; wie hem vertaalt, maakt het onmogelijk om een scherm en een auditregel naast elkaar te leggen.

---

## 5 · Praktijkactiviteit

**Scherm** `/admin/kwaliteit` · kop **Praktijkactiviteit {jaar}**

Dit scherm meet **praktijkactiviteit en geen bekwaamheid.** Het staat er nu ook. De afbakening bovenaan zegt dat het voltooide afnames telt en die tegen de afnamenorm legt, en dat oefensessies apart staan.

De tabel heet **Afname-overzicht {jaar} — voltooide afnames tegen de norm** met de kolommen: Naam · Afnames · Norm · Verwacht · Progressie · Status · Laatste afname · Aandacht · **Oefenen** · Alerts · Acties.

Vóór deze release stond in de afnamekolom een teller die oefensessies meerekende. Iemand die veel oefende en niets afnam, lag daardoor op schema. Dat is rechtgezet: **Afnames** en **Oefenen** zijn nu twee kolommen, ook in het detailpaneel.

**De norm bijstellen.** Open iemand in het detailpaneel, pas het normveld aan en bewaar. Dat is een echte wijziging, geen simulatie.

Let op de kolom **Oefenen**. Veel oefensessies en weinig afnames is een signaal, maar geen tekortkoming: onderschrijding van de activiteitsdrempel is volgens het draaiboek geen tekortkoming. Neem het mee in een gesprek, niet in een beslissing.

---

## 6 · Oefenen

**Scherm** `/admin/oefenen` · voorheen `/admin/stm`

Titel **Oefenen**, met een afbakening bij de module en nog eens bij de uitkomst. Na afronding heet het resultaat **Oefensessie afgerond**.

Het inschalingslabel is blijven staan, want het is nuttige oefenfeedback. Maar de grens staat er nu bij: **geen bekwaamheidsbeslissing, geen invloed op de licentie.** Scores, lagen, adaptieve selectie en feedback zijn niet aangeraakt.

Eén ding om te weten voordat u dit als toets gebruikt: **de cesuur van de oefenmodule (0,85 / 0,70 / 0,55) is niet onderbouwd** en de adaptieve selectie stuurt naar de zwakke lagen — dat drukt het gemiddelde. Gebruik dit dus als oefening en niet als meting.

---

## 7 · Inrichten: de eerste keer

Deze stappen zijn voor wie de module in een omgeving in gebruik neemt. Ze vragen toegang tot de server; het zijn geen schermhandelingen.

### Stap 1 · De tabellen

De migraties `0006`, `0007` en `0008` draaien automatisch bij het opstarten. Ze zijn additief: alleen nieuwe tabellen en indexen, geen `ALTER` en geen `DROP` op bestaande tabellen. U hoeft niets te doen.

Na het opstarten staan alle veertien tabellen leeg. Het licentiebeeld toont dan overal `Niet in het register` en de regiekamer blijft leeg. Correct, maar niet informatief.

### Stap 2 · Het register vullen

```
node script/migreer-bekwaamheid.mjs            # droogloop
node script/migreer-bekwaamheid.mjs --schrijf  # echt
```

**Droogloop is de standaard.** Zonder `--schrijf` verandert er niets en ziet u alleen wat er zou gebeuren. Doe die droogloop altijd eerst en lees de uitvoer.

De vlag `--demo` neemt ook demo-namen mee en wordt geweigerd wanneer `NODE_ENV` op productie staat.

### Stap 3 · De overgangsperiode vastleggen

```
node script/migreer-licenties.mjs            # droogloop
node script/migreer-licenties.mjs --schrijf  # echt
```

Elke actieve geaccrediteerde krijgt één licentierij met status `overgangsperiode`: geen einddatum, geen agendadatum, geen alert. Die status geeft afnamerecht en blokkeert dus niets. **Op het moment van deze migratie verandert er voor niemand iets** — dat is de technische vorm van de belofte dat niemand vandaag iets verliest.

Het script is idempotent: twee keer draaien geeft hetzelfde resultaat.

**Twee beperkingen die u moet kennen.** De licentie wordt aangemaakt voor één instrument, `t4p-business-kompas`, omdat een licentie zonder instrument in dit model niet bestaat. Wie voor meer instrumenten bekwaam is, krijgt die licenties pas wanneer er een bron is die dat vastlegt. En: de tabel `bekwaamheid_accreditaties` wordt door **geen enkel script** gevuld. De docstring van `migreer-bekwaamheid.mjs` beweert van wel en die bewering is onjuist — dat staat zo in de code van het tweede script opgetekend. Reken er dus niet op.

Twee stappen en niet één, met opzet: het register beschrijft een feit dat al waar was, een licentie is een uitspraak over wat iemand mag. Zo'n uitspraak hoort niet als bijwerking van een vulscript te ontstaan.

### Stap 4 · Kijken, nog niet handhaven

Open `/admin/toegang` en `/admin/bekwaamheid` en controleer of het beeld klopt met wat u verwacht. Dit is de eerste keer dat u de module met echte gegevens ziet.

### Stap 5 · De poort

De poortstand komt uit de omgevingsvariabele `BEKWAAMHEID_POORT` met drie waarden:

| Waarde | Gedrag |
|---|---|
| `uit` | De poort doet niets |
| `log` | **Standaard.** Meet en registreert, weigert niets |
| `handhaaf` | Weigert werkelijk |

Een onbekende of ontbrekende waarde levert `log`. Na deze release staat de poort dus op `log` en verandert het gedrag van het platform niet.

**Zet `handhaaf` niet aan voordat stap 2, 3 en 4 gedaan zijn.** Zonder licentierijen weigert een handhavende poort iedereen. En loop eerst met de poortsimulatie uw actieve afnemers langs.

De poort weigert op vier gronden: `geen_licentie`, `status_zonder_afnamerecht`, `nog_niet_geldig` en `verlopen`. Ze grijpt in op drie plaatsen: bij het aanmaken en voortzetten van afnames, en bij de bulk-import.

---

## 8 · De cyclus in het kort

Voor uw beeld, want deze getallen zitten in de rekenkernen en bepalen wat de agenda u straks voorlegt:

| Instelling | Waarde |
|---|---|
| Cyclus | 24 maanden |
| Tussentijdse toets | na 12 maanden |
| Activiteitsvenster | 24 maanden |
| Activiteitsdrempel | 6 afnames |
| Ondergrens oefengemiddelde | 55 |
| Evaluatie coachingsplan | na 6 maanden |

Zeven licentiestatussen: `bekrachtigd`, `bekrachtigd_met_aandachtspunt`, `voorwaardelijk`, `slapend`, `opgeschort`, `beeindigd`, `overgangsperiode`. **Vier daarvan geven afnamerecht:** `bekrachtigd`, `bekrachtigd_met_aandachtspunt`, `voorwaardelijk` en `overgangsperiode`.

---

## 9 · Vier dingen om op te letten

**Een leeg scherm is geen fout.** Zolang de tabellen leeg zijn, is een lege regiekamer het juiste antwoord. Ga niet zoeken naar een storing.

**De poortsimulatie is uw enige veilige proefweg.** Alle andere handelingen op deze schermen die iets bewaren — een concept, een bevriezing, een norm — zijn echt.

**Bevriezen is definitief.** Er is geen weg terug, alleen een nieuwe versie.

**Neem "Niet gemeten" mee in elke verantwoording.** Acht indicatoren uit sectie 13 hebben vandaag geen bron. Wie alleen naar de gevulde vakjes kijkt, leest de lege als "in orde".

---

## Bijlage · Openstaande punten die u kunnen raken

- **Er is nog geen scherm om licenties uit te geven of beslissingen vast te leggen.** Het normprofiel is de enige schrijfweg in de module
- **De schermen zijn nog niet met echte gegevens nagekeken.** Alle veertien tabellen stonden bij oplevering op nul rijen
- **`admin-coaches.tsx` en `coach-dashboard.tsx` zijn niet aangeraakt.** Ze horen bij §9.7 maar vielen buiten de bestandsgrens van deze ronde. De serverlaag ligt er klaar voor
- **`bekwaamheid_accreditaties` wordt door geen script gevuld,** ondanks wat de docstring van het eerste vulscript beweert
- **De vijftalige teksten van de licentiekolom staan tijdelijk in `client/src/components/bekwaamheid/licentiekolom-teksten.ts`** in plaats van in `shared/i18n.ts`. Functioneel maakt dat geen verschil
- **De cesuur van de oefenmodule is niet onderbouwd**
- **`package.json` staat nog op `2.7.0`** en er is geen tag geplaatst voor deze release
