# Bouwrapport — scherm 9.6, de regiekamer

**Datum:** 14 augustus 2026
**Onderdeel:** Bouwplan Bekwaamheidsmodule Tapas CORE, §9.6
**Webadres:** `/admin/bekwaamheid` (achter de beheerderspoort)

---

## Wat er gebouwd is

Bouwplan §9.6 vraagt vijf dingen op één scherm: rondes per fase, de agenda met openstaande posten, ICC per bewijsstuk, de KPI's uit sectie 13 van het draaiboek, en de poortsimulatie. Alle vijf staan er. Er staat een zesde blok bij dat het bouwplan niet vraagt en dat hieronder verantwoord wordt: een lijst van indicatoren uit sectie 13 die het platform vandaag **niet** kan meten.

| Bestand | Aard | Regels |
|---|---|---|
| `server/bekwaamheid/regiekamer.ts` | nieuw | 572 |
| `server/bekwaamheid/routes-regiekamer.ts` | nieuw | 315 |
| `client/src/pages/admin-bekwaamheid.tsx` | nieuw | 828 |
| `tests/bekwaamheid-regiekamer.test.ts` | nieuw | 880 |
| `server/routes.ts` | gewijzigd | +6 (import + registratie) |
| `client/src/App.tsx` | gewijzigd | +4 (import + route) |

De rekenkern (`regiekamer.ts`) kent geen databank; de routelaag doet de opzoekingen en rekent zelf niets. Daarom is elk getal op het scherm herleidbaar tot één functie die met een matrix of een lijst te toetsen is, zonder databank.

### De twee webadressen

- `GET /api/bekwaamheid/regiekamer?peildatum=&instrument=` — het hele beeld in één antwoord.
- `POST /api/bekwaamheid/regiekamer/poortsimulatie` — wat de poort met een handeling zou doen.

De simulatie is een POST en geen GET, omdat ze een stand meedraagt die de werkelijke poortstand overschrijft. Zo'n samenstelling in een querystring belandt in serverlogs en in browsergeschiedenis, en een gedeelde link die "handhaaf" simuleert terwijl de poort op `log` staat, is een misverstand dat je niet wil uitleggen. De simulatie schrijft **geen auditregel**: `beoordeelSchrijfweg` krijgt een auditschrijver mee die niets doet. Het auditlog is het verhaal van wat er echt gebeurde; een gesimuleerde weigering daartussen maakt dat verhaal onbetrouwbaar.

Het instrumentfilter loopt overal via `bekwaamheid_rondes.instrument_id` en nooit via een tweede kolom op scores, bewijsstukken of bezwaren. Anders bestaan er vijf antwoorden op de vraag bij welk instrument een score hoort.

---

## De keuzes die uitleg vragen

### De ICC is ICC(2,1), absolute overeenstemming

- **Model 2** en niet 1 of 3: de beoordelaars zijn niet per dossier andere mensen (model 1) en ook niet de enige denkbare beoordelaars (model 3), maar een steekproef uit een groter panel.
- **Absolute overeenstemming** en niet consistentie: een beoordelaar die structureel één punt hoger geeft, maakt bij een cesuur wél verschil. De consistentievorm rekent dat verschil weg.
- **Enkele beoordelaar** (2,1) en niet het gemiddelde (2,k): een dossier wordt in de praktijk door één mens bekeken. De vraag is hoe betrouwbaar één beoordelaar is, niet hoe betrouwbaar het panelgemiddelde is.

De rekenkern is geijkt op de gepubliceerde zes-bij-vier matrix uit Shrout & Fleiss (1979), waarvoor in de literatuur ICC(2,1) = .29 staat naast ICC(1,1) = .17 en ICC(3,1) = .71. De test eist .2898 en eist expliciet dat het géén .71 en géén .17 is. Een test die zijn verwachting uit dezelfde formule haalt als de code, toetst niets.

Verder:

- Bij `sst = 0` (alle scores gelijk) komt er **geen** ICC en geen 1,00. Alles gelijk is niet hetzelfde als perfecte overeenstemming; het als 1,00 rapporteren zou vleien.
- Een **negatieve ICC blijft staan**. Bij meer verschil binnen dan tussen dossiers is de ICC negatief; dat is een bevinding, geen rekenfout.
- Wordt de noemer exact nul, dan komt er een reden en geen getal.

### "ICC per bewijsstuk" is per bewijsstuk*nummer*

Een ICC vergelijkt de spreiding tussen dossiers met die binnen een dossier. Binnen één enkel dossier bestaat geen "tussen", dus over één bewijsstuk is geen ICC te berekenen — hoeveel beoordelaars er ook naar kijken. De enige rekenkundig mogelijke lezing van §9.6 is dus: per soort bewijsstuk, over de dossiers heen. Dat is ook wat draaiboek §13.1 doet, waar de ICC per meetinstrument genormeerd wordt en niet per kandidaat.

### Termijnen

- "Laatste onderdeel" = `MAX(bewijsstukken.ingeleverd_op)` van de ronde, niet `beoordeeld_op`. Dat laatste zou de termijn laten meebewegen met de eigen traagheid van het panel.
- Debrief (10) en publicatie (3) in **werkdagen**, bezwaar (30) in **kalenderdagen**, precies zoals §13.2 het formuleert.
- **Feestdagen zitten er niet in** (`feestdagen: false` in de uitkomst, en op het scherm). Een feestdagenkalender is landgebonden en hoort ergens te staan waar hij één eigenaar heeft. Tot die er is, meet de teller iets krap.
- Een dossier zonder tweede datum staat onder "nog open" en niet onder "buiten de termijn".

### Waar niets gemeten is, staat "niet gemeten"

Acht indicatoren uit sectie 13 hebben vandaag geen bron: het betrouwbaarheidsinterval rond de ICC, beslissingsconsistentie op herbeoordeelde dossiers, interne consistentie van de kennischeck, deelname, of het kader vooraf gelezen is, assessments per beoordelaarsduo per dag, fairnessmonitoring, en de ervaring van de kandidaten. Ze staan met naam en reden op het scherm. Een nul tonen waar geen meting bestaat, leest als "gehaald", en dat is de gevaarlijkste soort leeg vakje.

---

## Wat er getest is

Nieuw testbestand met **49 tests**. De grensgevallen zijn gekozen omdat een plausibele maar verkeerde implementatie erop stukloopt:

| Geval | Wat er moet gebeuren |
|---|---|
| verstreken venster bij een afgesloten of gestaakte ronde | niet meetellen |
| peildatum precies op de vensterdatum | nog niet verstreken |
| alle beoordelaars geven overal hetzelfde | géén ICC, niet 1,00 |
| meer verschil binnen dan tussen dossiers | negatieve ICC blijft zichtbaar |
| gespiegelde 2×2-matrix | geen deling door nul |
| onvolledige matrix | weigeren, geen gat wegrekenen |
| beoordelaar die één dossier oversloeg | die valt weg, niet het dossier |
| item dat uit de scoring is gehaald | geen tekort meer |
| p-waarde precies op de grens | binnen, niet buiten |
| bezwaar op dag 31 | buiten (kalenderdagen, geen werkdagen) |
| onleesbare peildatum | 400, niet stil vandaag |

Daarbovenop: negen tests op een echte `:memory:`-databank met de migraties 0006 tot 0008, inclusief een test die vaststelt dat twee opeenvolgende leesbeurten **niets** in de databank veranderen, en vier tests door een echte http-server heen op de twee webadressen (401 zonder sessie, 400 bij onleesbare peildatum, onbekende handeling en onbekende stand).

**Volledige suite: 180 bestanden, 2.225 tests, alles groen** (63 s). Vertrekpunt was 179 bestanden en 2.176 tests; de aanwas is precies de 49 nieuwe tests. Geen bestaande test veranderd van uitkomst.

**Typecontrole:** `tsc --noEmit` geeft 139 regels meldingen, alle in bestanden die hier niet zijn aangeraakt (voornamelijk het `StringSleutel`-type in de academy- en inzichtenschermen). Geen enkele melding in `regiekamer.ts`, `routes-regiekamer.ts`, `admin-bekwaamheid.tsx`, `App.tsx` of het nieuwe testbestand.

**Clientbundel:** `vite build` slaagt met de nieuwe pagina erin (17,4 s).

---

## Protocolcontrole

| Controle | Uitkomst |
|---|---|
| Gewijzigde bestaande repo-bestanden | **11** — onveranderd, geen verruiming |
| Nieuwe bestanden | 4 (untracked, buiten de grens) |
| `server/bekwaamheid/` bestaande modules | md5's onaangeroerd; alleen `regiekamer.ts` en `routes-regiekamer.ts` zijn nieuw |
| Bestaande tests aangeraakt | geen |
| Migraties aangeraakt | geen |
| `dist/` | staat in `.gitignore`; de bouw voegt niets aan de grens toe |

### Eén afwijking die u moet weten

Het corpusbestand `/home/user/workspace/zichtbaar.txt` staat op md5 **`cb0aead4b0a4ec34f7473dee215cf34a`**. In twee eerdere tussenrapporten in deze sessie staat `df7f865e…` als controlesom van dat bestand. Die waarde is **niet te reproduceren**: er is maar één `zichtbaar.txt` (8.187 regels, 500.794 bytes) en de wijzigingsdatum is 13 augustus 19:23, dus vóór al het werk van vandaag. Wat wél vaststaat: het bestand is vandaag niet aangeraakt. Wat niet vaststaat: dat `df7f865e` ooit de juiste waarde was. Ik geef dat liever als afwijking dan dat ik een getal verdedig dat ik niet kan onderbouwen.

---

## Aanvulling — de vier goedgekeurde voorstellen, verwerkt

Drie van de vier open beslissingen zijn gebouwd. De vierde vraagt uw toestemming voordat er één regel geschreven wordt.

### Nieuwe en gewijzigde bestanden in deze ronde

| Bestand | Aard | Regels |
|---|---|---|
| `server/bekwaamheid/feestdagen.ts` | nieuw | 121 |
| `server/bekwaamheid/statistiek.ts` | nieuw | 134 |
| `server/bekwaamheid/regiekamer.ts` | uitgebreid | 854 (was 572) |
| `server/bekwaamheid/routes-regiekamer.ts` | uitgebreid | 322 (was 315) |
| `client/src/pages/admin-bekwaamheid.tsx` | uitgebreid | 942 (was 828) |
| `tests/bekwaamheid-regiekamer.test.ts` | uitgebreid | 1.086 (was 880) |
| `tests/bekwaamheid-feestdagen.test.ts` | nieuw | 181 |
| `tests/bekwaamheid-statistiek.test.ts` | nieuw | 137 |

Alle acht bestanden zijn untracked. **De grens van elf gewijzigde bestaande repo-bestanden is niet aangeraakt.**

### 1. Het betrouwbaarheidsinterval rond de ICC — gebouwd

Het interval volgt McGraw en Wong (1996) voor ICC(A,1), de absolute-overeenstemmingsvorm:

```
a  = k·ICC / (n(1−ICC))
b  = 1 + k·ICC(n−1) / (n(1−ICC))
v  = (a·MSC + b·MSE)² / ((a·MSC)²/(k−1) + (b·MSE)²/((n−1)(k−1)))
Fl = F_{1−α/2}(n−1, v);   Fu = F_{1−α/2}(v, n−1)
onder = n(MSR − Fl·MSE) / (Fl(k·MSC + (k·n−k−n)MSE) + n·MSR)
boven = n(Fu·MSR − MSE) / (k·MSC + (k·n−k−n)MSE + n·Fu·MSR)
```

Daarvoor waren F-kwantielen nodig, die nergens in het platform bestonden. `statistiek.ts` bouwt ze op eigen kracht: `logGamma` via de Lanczos-benadering, de onvolledige betafunctie via het kettingbreukalgoritme van Lentz, en het kwantiel via bisectie op de verdelingsfunctie. Geen enkel nieuw pakket.

**Waarom dit mag: de onderbouwing.** De *Standards for Educational and Psychological Testing* (2014, p. 39) zeggen het rechtstreeks: de standaardmeetfout "can be used to generate confidence intervals around reported scores. It is therefore generally more informative than a reliability or generalizability coefficient." Een puntschatting van .78 op vier dossiers en een puntschatting van .78 op veertig dossiers dragen niet hetzelfde gewicht. Het interval maakt dat verschil zichtbaar; het cijfer alleen verbergt het.

**Geijkt, niet zelf nagerekend.** De code is naast bestaande, onafhankelijke implementaties gelegd:

- **F-kwantielen tegen scipy 1.18.0**, zes waarden, grootste afwijking 1·10⁻¹¹: `F(0,975; 5; 10) = 4,2360856682` · `F(0,975; 10; 5) = 6,6191543314` · `F(0,95; 3; 7) = 4,3468313999` · `F(0,975; 5; 3,5) = 11,3997695668` (gebroken vrijheidsgraden, want *v* is bijna nooit heel) · `F(0,995; 2; 2) = 199,0` · `F(0,975; 1; 1) = 647,7890114778`.
- **Het interval tegen pingouin 0.6.1** op de gepubliceerde Shrout & Fleiss-matrix. Eigen code: ICC 0,289764, ondergrens 0,018787, bovengrens 0,761084. Pingouin: CI95% [0,02; 0,76]. Gelijk tot op de afronding die pingouin zelf toont.

**Wat het scherm nu leest.** De norm van §13.1 is **ongewijzigd** gebleven — ≥ .75 op de ondergrens. Er is een kolom "Norm §13.1" bij gekomen met drie standen:

| Stand | Wanneer | Wat het betekent |
|---|---|---|
| gehaald | ondergrens ≥ .75 | de norm is gehaald |
| niet gehaald | bovengrens < .75 | de norm is niet gehaald |
| onbeslist | het interval loopt over .75 heen | het panel is te klein voor een uitspraak |

Die derde stand is het punt van de hele exercitie. Voorheen kwam een ICC van .78 op vier dossiers als "boven de norm" over. Nu leest hij als onbeslist, want het interval loopt van .02 tot .95. Dat is geen strengere norm; dat is dezelfde norm, eerlijk gelezen.

**Waar het interval leeg blijft**, staat de reden erbij: bij een negatieve ICC (de formule vraagt een positieve *a*), bij te weinig dossiers of beoordelaars, en bij een noemer van nul.

### 2. De blokreductie — nu het grootste volledige blok

De oude orde gooide eerst de beoordelaars weg die niet elk dossier bekeken en daarna de dossiers met een resterend gat. Dat kon een groter blok laten liggen. Nagerekend op vier dossiers × drie beoordelaars met één gat: de oude orde hield 4 × 2 = 8 cellen over met ICC 0,9143; het grootste volledige blok is 3 × 3 = 9 cellen met ICC 0,9268. Het scherm zoekt nu dat grootste blok.

Drie dingen horen daarbij, en die zijn er ook:

- **De drempel is opgetrokken naar drie dossiers en twee beoordelaars.** Onder die grens komt er geen getal. Twee dossiers leveren rekenkundig wel een ICC, maar één vrijheidsgraad tussen dossiers geeft een interval van bijna nul tot bijna één. Dat is geen meting.
- **Het gat verdwijnt niet uit het zicht.** Er is een nieuwe kaart "Nog niet volledig beoordeeld" met per bewijsstuk het aantal ontbrekende beoordelingen, de dekkingsgraad en of er een ICC berekend kon worden. Oplopend gesorteerd op dekking, dus het slechtst bekeken bewijsstuk staat bovenaan.
- **Die lijst staat náást de agenda, niet erin.** De agenda heeft een gesloten CHECK-lijst van soorten en voert alleen posten met een eigen termijn. Een onvolledig beoordeeld bewijsstuk heeft geen termijn; het hoort bij de meetlaag, niet bij de beslislaag.

Gevolg dat u moet weten: bij kleine panels blijft de ICC nu vaker leeg dan vroeger. Dat is bedoeld. Het scherm zegt dan "te weinig dossiers" in plaats van een getal te geven waar niets achter zit.

### 3. Feestdagen — berekend, niet ingetypt

`feestdagen.ts` berekent de tien Belgische wettelijke feestdagen per jaar. Zeven staan vast op de kalender (1 januari, 1 mei, 21 juli, 15 augustus, 1 november, 11 november, 25 december); drie hangen aan Pasen (paasmaandag, Onze-Lieve-Heer-Hemelvaart op +39, pinkstermaandag op +50). Eerste paasdag komt uit het algoritme van Meeus en Butcher voor de gregoriaanse kalender, geijkt op twaalf jaren tegen `dateutil`: 2024-03-31 · 2025-04-20 · 2026-04-05 · 2027-03-28 · 2028-04-16 · 2029-04-01 · 2030-04-21 · 2031-04-13 · 2032-03-28 · 2033-04-17 · 2034-04-09 · 2035-03-25. Daarnaast toetsen twee eigenschapstests dat de datum altijd op zondag valt (2020-2060) en altijd tussen 22 maart en 25 april ligt (1900-2200).

De tien dagen staan in de wet van 4 januari 1974 en zijn sinds 1947 niet gewijzigd ([FOD Werkgelegenheid](https://werk.belgie.be/nl/themas/feestdagen-en-verloven/feestdagen), [Wikipedia](https://nl.wikipedia.org/wiki/Feestdagen_in_Belgi%C3%AB)). Berekenen in plaats van een tabel bijhouden betekent dat er geen kalender is die in 2029 stilzwijgend verouderd.

Twee dingen zijn bewust **niet** gedaan:

- **Vervangingsdagen niet.** Valt een feestdag in het weekend, dan legt elke onderneming zelf collectief een vervangingsdag vast. Dat is per werkgever anders en dus niet te berekenen. De post staat nu met naam en reden op de lijst "niet gemeten" — die lijst blijft daardoor op acht posten, want het betrouwbaarheidsinterval is er af en de vervangingsdagen zijn erbij.
- **De bezwaartermijn raakt de feestdagen niet.** Die loopt in kalenderdagen. De vlag `feestdagen` staat daar dus op onwaar, en een test legt dat vast: zou hij op waar staan, dan zou het scherm een correctie beweren die er niet is.

### 4. §9.7 — nog niet begonnen, wacht op uw toestemming

Zie de vraag onderaan dit rapport.

### Wat er in deze ronde getest is

| Bestand | Tests |
|---|---|
| `tests/bekwaamheid-regiekamer.test.ts` | 62 (was 49) |
| `tests/bekwaamheid-feestdagen.test.ts` | 16 |
| `tests/bekwaamheid-statistiek.test.ts` | 12 |

Drie bestaande tests moesten mee, en het is de moeite te zeggen waarom — geen ervan omdat de nieuwe code iets brak:

1. De test die eiste dat de vlag `feestdagen` op onwaar staat, is vervangen door twee tests: waar bij de twee werkdagentermijnen, onwaar bij de kalendertermijn. De oude verwachting was juist zolang er geen feestdagen berekend werden.
2. De ICC-test over twee rondes liep op twee dossiers en valt nu onder de nieuwe drempel van drie. Er is een derde ronde met een derde dossier bijgekomen. Dat legt tegelijk iets bloot dat het waard is vast te leggen: een bewijsstuknummer mag maar één keer per ronde bestaan, dus één ronde kan nooit genoeg dossiers voor hetzelfde nummer leveren. Precies daarom moet de ICC over rondes heen.
3. De test op `fKwantiel(0)` verwachtte nul en de functie weigert. Dat is het juiste gedrag: bij kans nul en kans één liggen de kwantielen op nul en op oneindig, en zo'n uiterste stil teruggeven levert in het interval een grenswaarde op die als getal leest maar geen betekenis heeft.

Een uitputtende zoektocht (`/tmp/zoek-noemer.py`) over alle score-combinaties bij 3 × 2 (waarden 1-6), 4 × 2 en 3 × 3 (waarden 1-4) vond **geen enkele** nul-noemer. De check blijft als vangnet en dat staat zo in de code en in de test — een vangnet waarvan niemand weet dat het er is, wordt bij de eerste opruiming weggehaald.

**Volledige suite: 182 bestanden, 2.266 tests, alles groen** (64 s). Vertrekpunt van deze ronde: 180 bestanden, 2.225 tests. `tsc --noEmit`: geen enkele melding in de aangeraakte bestanden. `vite build` slaagt (17,4 s). `git diff --name-only | wc -l` geeft **11**.

---

## Open punten

1. ~~**Geen betrouwbaarheidsinterval rond de ICC.**~~ **Gebouwd.** Zie de aanvulling hierboven. De norm van §13.1 is niet aangeraakt en is nu wel af te lezen.

2. ~~**De blokreductie kan het getal wegnemen.**~~ **Opgelost.** Het grootste volledige blok wordt gekozen, de dekkingsgraad staat erbij en het gat staat op een eigen kaart.

3. ~~**Feestdagen in de werkdagenteller.**~~ **Gebouwd**, berekend in plaats van bijgehouden. Vervangingsdagen blijven onmeetbaar en staan als zodanig gemeld.

4. **Het scherm is nog steeds niet visueel nagekeken in een lopende omgeving.** Alle veertien `bekwaamheid%`-tabellen staan op nul rijen. De lege toestand is per kaart uitgewerkt en de bundel bouwt, maar een oogcontrole met echte data is er niet geweest.

5. **§9.7 wacht op toestemming.** Zie hieronder.

---

## De vraag die openstaat: verruiming voor §9.7

§9.7 (Bouwplan r. 834-844) raakt vijf bestaande schermen. De grens staat op elf en is precies vol. Zonder verruiming kan er niets gebouwd worden.

Het voorstel is dit in twee leveringen te doen, zodat u na de eerste kunt kijken voordat de tweede begint:

| Levering | Bestanden | Nieuwe grens | Wat er verandert |
|---|---|---|---|
| **A** | `client/src/pages/admin-toegang.tsx`, `client/src/pages/stm.tsx` | **13** | Een kolom "licentie" bij de toegangslijst; `stm.tsx` wordt de oefenlaag |
| **B** | `admin-kwaliteit.tsx`, `admin-coaches.tsx`, `coach-dashboard.tsx` | **16** | Een teller bij kwaliteit, licentiestatussen bij de coaches, een kaart op het coachdashboard |

**Ik vraag nu alleen levering A: verruiming van elf naar dertien.** Levering B komt pas aan de orde als A staat en u hem gezien hebt.

Twee dingen om te wegen. `/admin/stm` staat op drie plaatsen in de code (`App.tsx` één keer, `admin-kwaliteit.tsx` vier keer, `server/admin-stm-voortgang.ts` vier keer als API-pad); die verwijzingen moeten mee als `stm.tsx` van betekenis verandert, en `admin-kwaliteit.tsx` zit in levering B. Levering A raakt de vier verwijzingen in `admin-kwaliteit.tsx` dus niet aan — dat scherm blijft naar `/admin/stm` verwijzen, alleen betekent die pagina dan iets anders. Als u dat liever in één keer recht wilt hebben, dan moet `admin-kwaliteit.tsx` naar levering A en gaat de grens in één stap naar veertien.

---

Daarnaast staan de vier eerder gemelde feitelijke verschillen tussen boek en platform nog open (drager van de hersenroute, versnellernamen, interne consistentie, aantal talentfoci), net als het afleiderherstelvoorstel voor blok A en C.
