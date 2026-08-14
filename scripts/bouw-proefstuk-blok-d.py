#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bouwt het proefstuk blok D van de T4P-kennischeck (versie 3).

Bron van waarheid. Idempotent: bij elke run wordt het bestand opnieuw
weggeschreven en worden alle eisen als assert nagerekend.

Wijzigingen ten opzichte van versie 2, na de onafhankelijke tegenlezing
(TEGENLEZING-BLOK-D-V2.md, 19 verplichte herstellingen):
  - 16 items in plaats van 15, conform de bankdoelstelling D16 (ITEMBRON §7).
  - D-11 was verkeerd gelabeld W5 en is feitelijk W1; er is een echt
    W5-item over een doelgroepgrens toegevoegd (D-16).
  - D-04 onderwees een onwaarheid over de energiemodus: foci EN versnellers
    worden per blok bevraagd, alleen drivers per item (ITEMBRON §1.1).
  - D-05 en D-06 schreven het instrument lagen toe die het niet heeft.
    Het instrument bevat uitsluitend `main` en `connection`; INNER WHY
    wordt niet gemeten en er is geen functionele/humane subschaal in de
    scoring (ITEMBRON §1 en §2.1).
  - Zes bronverwijzingen droegen de claim niet en zijn vervangen door
    ankers die woordelijk nagelezen zijn.
  - "ijkpunt" bestaat niet in het boek; overal "referentiepunt" (r.2397).
  - Beide 0-3-schalen hadden een gat en een botsende regel; opgelost met
    een expliciete voorrangsregel.
  - D-11 optie B was met ctrl-F vindbaar; de vindplaatswoorden staan nu
    in een afleider.

Het itemcorpus (itemcorpus-t4p.json) wordt NIET aangeraakt. Dat wordt met
md5 nagerekend aan het einde van deze run.
"""

import hashlib
import json
import pathlib
import statistics
import sys

HIER = pathlib.Path(__file__).resolve().parent
REPO = HIER.parent
BEK = REPO / "server" / "bekwaamheid"
DOEL = BEK / "proefstuk-blok-d.json"
CORPUS = BEK / "itemcorpus-t4p.json"
CORPUS_MD5_VERWACHT = "df7f865e220a8341a77c959374cce921"

# --------------------------------------------------------------------------
# De items
# --------------------------------------------------------------------------
# Per item:
#   code, soort, gedragsindicator, stam, opties, sleutel,
#   toelichtingGoed, toelichtingFout, bron (interne herkomst, niet aan de
#   kandidaat te tonen)
#
# Ontwerpregel voor de opties: alle vier ongeveer even lang, en in de
# meerderheid van de items is een AFLEIDER de langste optie. De sterkste
# afleider is telkens een antwoord dat de fout verplaatst in plaats van
# oplost, of dat een echte beperking noemt die hier niet aan de orde is.

ITEMS = [
    # ---------------------------------------------------------------- W1
    {
        "code": "D-01",
        "soort": "scenario",
        "gedragsindicator": "W1",
        "stam": "In een rapport staat: \u201cUit dit profiel blijkt dat Els beschikt over sterk leidinggevend vermogen en over goed ontwikkelde onderhandelingsvaardigheden.\u201d Wat gaat hier mis?",
        "opties": [
            "Er wordt een vaardigheidsniveau gerapporteerd dat dit profiel niet vaststelt. Gemeten worden talentfoci, versnellers, drivers en de energie erbij \u2014 niet wat iemand aangeleerd beheerst.",
            "De uitspraak is te absoluut geformuleerd; met een voorbehoud erbij, bijvoorbeeld \u201cwijst in de richting van\u201d, is dezelfde zin wel bruikbaar in een terugkoppeling aan Els.",
            "Leidinggeven en onderhandelen zijn samengestelde rollen; het rapport had ze eerst moeten uitsplitsen naar de onderliggende versnellers voordat het deze conclusie trok.",
            "Vaardigheden mogen pas in een rapport worden opgenomen wanneer de leidinggevende van Els de beschreven observaties uitdrukkelijk bevestigt, en die bevestiging ontbreekt hier."
        ],
        "sleutel": "A",
        "toelichtingGoed": "Een competentie is aangeleerd, observeerbaar en toetsbaar aan een norm: je kunt een procedure correct toepassen zonder er veel talent voor te hebben. Wat dit instrument in kaart brengt is een andere laag \u2014 het samenspel van vermogens dat zich vanzelf en zonder veel energieverlies aandient. Een uitspraak over een beheersingsniveau hoort dus niet uit dit profiel te komen, met of zonder voorbehoud.",
        "toelichtingFout": "B is de gevaarlijkste afleider en de fout die in de praktijk het vaakst wordt gemaakt: de claim blijft staan en er komt alleen een zachter werkwoord voor. C klinkt zorgvuldig en voert ondertussen de veronderstelling mee dat het profiel vaardigheidsniveaus zou kunnen leveren als je maar fijner uitsplitst.",
        "bron": "H4 competentiekenmerken r.1019-1023 en werkdefinitie r.1039-1042; r.1151-1155 procedure toepassen zonder talent; talentdefinitie H17 r.5522-5524"
    },
    {
        "code": "D-02",
        "soort": "scenario",
        "gedragsindicator": "W1",
        "stam": "Een geaccrediteerde leest bij een versneller een lage energiebalans en zegt: \u201cAnalyse is dus geen talent van jou.\u201d De coachee werkt al twaalf jaar met tevredenheid als analist. Wat is de juiste lezing?",
        "opties": [
            "De energiebalans weegt zwaarder dan de werkervaring: wie jarenlang tegen zijn energie in werkt, houdt dat vol maar bouwt onzichtbaar een tekort op.",
            "Er zijn twee dimensies in het spel. Een lage energiebalans zegt wat iets kost, niet wat iemand kan \u2014 en juist wat iemand goed kan, vraagt soms veel.",
            "De uitkomst is tegenstrijdig en daarmee onbruikbaar; het profiel moet opnieuw worden afgenomen voordat er iets over deze versneller gezegd kan worden.",
            "Twaalf jaar ervaring heeft van Analyse een competentie gemaakt en niet langer een talent; de energiebalans beschrijft dan correct het oorspronkelijke talent eronder."
        ],
        "sleutel": "B",
        "toelichtingGoed": "Het model kent hier twee gegevens die apart worden bepaald: hoe uitgesproken een construct zich aandient \u2014 een keuze binnen een blok \u2014 en wat het aan energie vraagt, apart bevraagd op een eigen schaal. Die twee lopen niet gelijk op. Iets waar iemand goed in is, kan een aanzienlijke energiekost hebben; dat is precies waarom energie afzonderlijk wordt bevraagd en niet uit het kunnen wordt afgeleid.",
        "toelichtingFout": "A is de gevaarlijkste afleider: ze klinkt als de zorgvuldige lezing, kiest \u00e9\u00e9n van de twee gegevens als het echte en maakt van een gespreksvraag een vaststelling over een opgebouwd tekort. C ontwijkt de vraag door een tegenstrijdigheid te verzinnen die er niet is; de twee gegevens spreken elkaar niet tegen.",
        "bron": "Voorwoord r.161-169 (ook wat we goed kunnen kan energie vreten); ITEMBRON \u00a72.1 \u2014 `net` als uitgesprokenheid (scoring.ts r138) tegenover `avgEnergy` als energiekost (r140-142)"
    },
    {
        "code": "D-03",
        "soort": "scenario",
        "gedragsindicator": "W1",
        "stam": "Een rapport zet de talentfoci onder elkaar met de kop \u201cGroeitraject in drie stappen\u201d: stap 1 Strategie, stap 2 Operationeel, stap 3 Inter-relationeel. Wat is er mis?",
        "opties": [
            "De volgorde is juist maar de kop is ongelukkig gekozen; \u201cGroeirichting\u201d in plaats van \u201cGroeitraject in drie stappen\u201d volstaat al om de passage correct te maken.",
            "De opsomming is onvolledig, en een ontwikkelpad kan pas kloppen wanneer alle gemeten foci er in de juiste orde in voorkomen.",
            "De volgorde wordt als traject gelezen. Wat er staat is een configuratie met een ingang, geen reeks fasen die iemand achtereenvolgens doorloopt.",
            "Een stappenplan hoort bij een competentiekader; het profiel mag zoiets alleen tonen wanneer de werkgever de rolvereisten vooraf heeft aangeleverd."
        ],
        "sleutel": "C",
        "toelichtingGoed": "De opeenvolging is geen stappenplan. Ze zegt waar iemand van nature binnenkomt en hoe de rest zich van daaruit opent \u2014 geen rangorde van belangrijkheid, en geen fasering in de tijd. Een kop die stappen belooft, maakt van een configuratie een traject en nodigt de coachee uit om aan stap 2 te gaan werken.",
        "toelichtingFout": "A is de gevaarlijkste afleider: alleen het opschrift verandert, de trajectlezing blijft. D voert een norm in die er niet is en verplaatst de vraag naar de werkgever.",
        "bron": "H16 r.5284-5293 geen rangorde, geen sequentieel ontwikkelpad, meest uitgesproken focus als opener"
    },
    {
        "code": "D-11",
        "soort": "scenario",
        "gedragsindicator": "W1",
        "stam": "Een opdrachtgever heeft bij veertig medewerkers een korte scan laten afnemen en wil daarop een individueel ontwikkelplan per medewerker bouwen. Wat is het juiste antwoord?",
        "opties": [
            "Dat kan, op voorwaarde dat de scan bij alle veertig medewerkers door dezelfde begeleider is afgenomen en de omstandigheden onderling vergelijkbaar waren.",
            "De scan is bewust beperkter gebouwd en pretendeert die grondigheid niet; ze opent wel een gesprek, maar draagt geen plan per persoon.",
            "Dat kan niet: de korte scan is bedoeld om per team te rapporteren, dus over \u00e9\u00e9n medewerker valt er in het geheel niets uit af te leiden.",
            "Dat kan wanneer de resultaten worden samengevoegd met de functioneringsgesprekken van het afgelopen jaar, zodat er ten minste twee bronnen onder elk plan liggen."
        ],
        "sleutel": "B",
        "toelichtingGoed": "De korte scans zijn met opzet eenvoudiger van opzet dan het volledige instrument en pretenderen niet dezelfde psychometrische diepgang. Daarmee zijn ze bruikbaar om iets in beweging te brengen en een gesprek te openen, maar niet als onderbouwing van een plan per persoon. De juiste beweging is dus niet weigeren, maar het juiste instrument aanbieden voor wat de opdrachtgever wil bereiken. Let op voor de beoordelaar: de bron beschrijft de scan als eenvoudiger van opzet en als eerste ondersteuning van een gesprek. Dat een individueel ontwikkelplan daarom het volledige instrument vraagt, is de professionele gevolgtrekking daaruit en geen bepaling in de bron; een kandidaat die dat onderscheid zelf maakt, antwoordt sterker en niet zwakker.",
        "toelichtingFout": "D is de gevaarlijkste afleider: twee zwakke bronnen samenvoegen voelt zorgvuldig en maakt de onderbouwing niet sterker, alleen ondoorzichtiger. C slaat door en gebruikt een juist gegeven \u2014 de scan heeft die diepgang niet \u2014 om te veel te verbieden: de scan levert w\u00e9l iets op individueel niveau, alleen niet de onderbouwing die een ontwikkelplan vraagt.",
        "bron": "r.7216-7223 korte scans, eenvoudiger van opzet, geen gelijke psychometrische diepgang"
    },
    # ---------------------------------------------------------------- W2
    {
        "code": "D-04",
        "soort": "scenario",
        "gedragsindicator": "W2",
        "stam": "In een rapport staat: \u201cHaar meest uitgesproken talentfocus is Constructief onderscheidend; daarin komt zij het snelst in flow.\u201d Wat gaat hier mis, en waarom is dat meer dan een naamfout?",
        "opties": [
            "Constructief onderscheidend is een versneller en geen focus. Daarmee wordt beschreven wat vanuit flow tot resultaat leidt, niet waarin iemand in flow komt.",
            "De twee families mogen niet naast elkaar in \u00e9\u00e9n zin staan omdat ze op een verschillende manier bevraagd worden \u2014 de ene per blok, de andere per item.",
            "Constructief onderscheidend hoort bij de drivers en niet bij de talentconstructen; de zin verwart daardoor een gedragspatroon dat onder druk aanslaat met een talent.",
            "Er is geen probleem zolang duidelijk is welke versie van het rapport gebruikt is, want in oudere versies stond deze naam wel bij de foci vermeld."
        ],
        "sleutel": "A",
        "toelichtingGoed": "De twee families doen verschillend werk. De ene beschrijft de manieren van kijken en werken waarin iemand van nature in flow komt; de andere de vermogens die maken dat er vanuit die flow ook resultaat komt dat verschil maakt. De zin belooft dus een flow-ingang op een plek waar het instrument die niet meet \u2014 en de coachee gaat op zoek naar flow in de verkeerde laag.",
        "toelichtingFout": "B is de sterkste afleider en is zelf onjuist: energie wordt per item bevraagd bij de drivers en per blok bij zowel de foci als de versnellers. Er is dus geen bevragingsverschil tussen deze twee families, en zelfs als er een was, zou het de naamfout niet verklaren. D biedt een uitweg via versiebeheer en laat de inhoudelijke verwarring intact.",
        "bron": "H16 r.5101-5104 onderscheid foci/versnellers; ITEMBRON \u00a71.1 energiemodus `block` voor foci en versnellers, `item` voor drivers"
    },
    {
        "code": "D-05",
        "soort": "scenario",
        "gedragsindicator": "W2",
        "stam": "Een geaccrediteerde vat samen: \u201cJouw sterkste driver is Please Others. Zorg voor anderen is dus een van je kernwaarden.\u201d Wat is er mis?",
        "opties": [
            "Please Others is hier niet de sterkste maar de meest zichtbare driver; kernwaarden komen juist voort uit de driver die in de bevraging het minst gekozen wordt.",
            "Kernwaarden zijn nooit uit een vragenlijst af te leiden en horen daarom in geen enkele terugkoppeling aan een coachee thuis, in welke formulering dan ook.",
            "De uitspraak verwart twee lagen. Een driver is een aangeleerd patroon dat onder druk aanslaat; wat iemand van waarde vindt, hoort bij de INNER WHY en wordt hier niet gemeten.",
            "De formulering klopt inhoudelijk, maar \u2018kernwaarde\u2019 is jargon; in gewone taal spreken over \u2018wat voor jou werkelijk belangrijk is\u2019 neemt het bezwaar helemaal weg."
        ],
        "sleutel": "C",
        "toelichtingGoed": "Drivers zijn aangeleerde overlevingsstrategie\u00ebn die zich onder spanning vanzelf aandienen \u2014 ze vertellen hoe iemand reageert wanneer het moeilijk wordt. Wat iemand ten diepste belangrijk vindt, hoort bij de INNER WHY, en die valt buiten dit profiel: het instrument bevat alleen de bevraging van drivers, foci en versnellers en vier vragen over verbondenheid. De INNER WHY komt dus alleen in het gesprek aan de orde. Van een automatisch patroon een waarde maken, geeft de coachee een identiteit in plaats van een inzicht.",
        "toelichtingFout": "D is de gevaarlijkste afleider: ze verklaart de inhoud correct en verplaatst het bezwaar naar het woordgebruik. B slaat door naar het andere uiterste \u2014 wat iemand belangrijk vindt is w\u00e9l bespreekbaar in het gesprek, alleen niet af te leiden uit de drivers.",
        "bron": "H5 r.1523-1545 INNER WHY tegenover drivers als automatische patronen; ITEMBRON \u00a71 \u2014 het instrument bevat uitsluitend de secties `main` en `connection`"
    },
    {
        "code": "D-06",
        "soort": "scenario",
        "gedragsindicator": "W2",
        "stam": "Een profiel toont een hoge waarde op Analyse. Het rapport concludeert: \u201cGeschikt voor complexe dossiers en diepgaand cijferwerk.\u201d In het gesprek blijkt dat de coachee dat vermogen vooral inzet om mensen en verhoudingen te doorgronden. Wat gaat hier mis?",
        "opties": [
            "De conclusie is te smal geformuleerd; ze had beide componenten van de schaal moeten vermelden en daarna alsnog naar het complexe dossierwerk kunnen verwijzen.",
            "De twee kanten van de schaal staan los van elkaar en hangen niet samen, dus een enkele waarde op Analyse zegt rekenkundig niets over welke kant het is.",
            "Er is geen fout: de twee componenten meten in de kern hetzelfde, dus een conclusie over complex dossierwerk blijft bij deze waarde goed verdedigbaar.",
            "Deze schaal dekt zowel het doorgronden van ingewikkelde materie als het doorgronden van mensen; dat onderscheid moet een verkeerde rolinschatting voorkomen."
        ],
        "sleutel": "D",
        "toelichtingGoed": "Elke versneller heeft twee kanten: het uitpluizen van complexe materie, en het lezen van mensen en groepsdynamiek. Dat onderscheid bestaat precies om te vermijden dat \u2018sterk analytisch\u2019 te grof wordt uitgelegd. Wie de humane kant als dossiervaardigheid leest, plaatst iemand in het verkeerde soort werk. De bron gaat verder dan een leesregel: de twee varianten correleren sterk maar niet volledig, waardoor het volgens de bron zinvol blijft om beide apart te meten (r.6733-6735). Dat de conclusie hier verkeerd is, komt dus niet doordat het onderscheid onmeetbaar zou zijn, maar doordat de rapportzin \u00e9\u00e9n van de twee kanten stilzwijgend als de andere leest.",
        "toelichtingFout": "C is de gevaarlijkste afleider: ze gebruikt een correct gegeven \u2014 de functionele en de humane variant van hetzelfde construct correleren sterk \u2014 als vrijbrief om het onderscheid te negeren. Sterk correleren is niet perfect correleren, en samenhang maakt de twee kanten niet uitwisselbaar. B draait dat gegeven precies om en beweert dat de twee kanten niet samenhangen; r.6734-6735 zegt het tegendeel, namelijk dat ze sterk maar niet volledig correleren en dat het daarom zinvol blijft beide apart te meten. A houdt de conclusie overeind en zet er alleen meer informatie naast.",
        "bron": "r.6019-6022 functionele en humane kant per talentversneller; H18 r.5978-5983 het R&D-voorbeeld; r.6683-6689 functionele en humane varianten correleren sterk maar niet perfect; r.6733-6735 zinvol om beide apart te meten"
    },
    # ---------------------------------------------------------------- W3
    {
        "code": "D-07",
        "soort": "scenario",
        "gedragsindicator": "W3",
        "stam": "In een rapport staat: \u201cDeze waarde ligt in de bovenste regionen vergeleken met professionals in dezelfde sector.\u201d Wat is er mis?",
        "opties": [
            "De vergelijking kan wel, maar uitsluitend tegen de volledige databank; per sector afzonderlijk zijn er te weinig profielen om er een uitspraak op te bouwen.",
            "Er bestaat geen normering. Het instrument plaatst iemand niet ten opzichte van anderen, ook niet tegen alle beschikbare profielen samen.",
            "De vergelijking mag alleen wanneer de deelnemer daar bij de afname uitdrukkelijk toestemming voor heeft gegeven, en die toestemming ontbreekt.",
            "De formulering is te stellig gekozen: \u201cbehoort tot de hogere waarden binnen de sector\u201d dekt dezelfde lading en is in een rapport wel verantwoord."
        ],
        "sleutel": "B",
        "toelichtingGoed": "Er is geen normgroep. De interpretatiedrempels in dit instrument zijn vastgesteld op inhoudelijk oordeel en de bandgrenzen zijn niet empirisch geijkt op een referentiegroep. Er is dus geen groep waartegen iemand geplaatst kan worden, en een positiebepaling ontbreekt niet bij toeval maar bestaat niet.",
        "toelichtingFout": "A is de gevaarlijkste afleider: ze klinkt als een verstandige beperking en voert ondertussen een normgroep in die niet bestaat. Wie A kiest, houdt de vergelijkende taal en verplaatst haar alleen. C verwart een psychometrische kwestie met een toestemmingskwestie. Wie zich op H21 r.6586-6591 beroept \u2014 \u2018er is gekeken naar de interne consistentie en de stabiliteit over tijd\u2019 \u2014 leest daar een beschrijving van het onderzoeksprogramma zonder \u00e9\u00e9n getal en zonder normgroep; die passage levert geen referentiegroep en maakt A dus niet juist.",
        "bron": "ITEMBRON \u00a73.2 geen normgroep, drempels op inhoudelijk oordeel; ITEMBRON \u00a72.5 bandgrenzen niet empirisch geijkt op een normgroep; H21 r.6857-6861 validatietraject onvolledig"
    },
    {
        "code": "D-08",
        "soort": "open",
        "gedragsindicator": "W3",
        "stam": "Een geaccrediteerde zegt tegen een coachee: \u201cJe versnellervolgorde is Resultaatgericht, dan Constructief onderscheidend, en dan Analyse. Jouw brein werkt dus top-down, en daarom kost stapsgewijs werk je zoveel moeite.\u201d Benoem wat hier misgaat en formuleer wat er wel gezegd kan worden.",
        "opties": [],
        "sleutel": "Vier elementen. (1) MODALITEIT: dat deze volgorde samenhangt met een route van beeld naar analyse is een hypothese, geen vaststelling over dit brein; \u201cjouw brein werkt dus\u201d geeft een werkmodel de status van feit. (2) VERIFICATIE: de hypothese moet aan de coachee worden voorgelegd in plaats van meegedeeld \u2014 herkent zij dat zij zich snel en met weinig energie een beeld vormt van hoe een oplossing eruit zou kunnen zien, en dat haar analytisch vermogen daarna op gang komt? Waar wel, waar niet, bij welk soort probleem? (3) CAUSALITEIT: de moeite met stapsgewijs werk wordt als gevolg gepresenteerd terwijl het een tweede, open vraag is; de hypothese gaat bovendien over de volgorde waarin het analytisch vermogen op volle kracht komt, niet over minder analytisch vermogen. (4) VERANTWOORDING: op de vraag waarop dit rust, hoort de geaccrediteerde het brede onderscheid tussen een beeldgestuurde en een analytische aanpak te kunnen situeren in de cognitieve psychologie, en tegelijk te zeggen dat de koppeling aan een specifieke versnellervolgorde in dit instrument werkmodel is.",
        "toelichtingGoed": "SCHAAL 0-3. 3 = element (1) plus minstens twee van (2), (3), (4), met een herformulering die de uitspraak als te toetsen hypothese aanbiedt. 2 = element (1) plus \u00e9\u00e9n ander element. 1 = de causale zin wordt gecorrigeerd maar de vaststelling over het brein blijft staan, of omgekeerd. 0 = geen van beide, of \u00e9\u00e9n van de twee foute uitersten hieronder. VOORRANGSREGELS. Element (1) is voorwaardelijk: zonder (1) is de score nooit hoger dan 1. Element (1) alleen, zonder (2), (3) of (4), levert 1. Voor 3 moet de herformulering een verificatievraag aan de coachee bevatten die letterlijk als vraag geformuleerd is. Een antwoord dat de route uit de talentfoci in plaats van uit de versnellers leest, komt nooit hoger dan 1, ongeacht de overige elementen. GOEDGEKEURDE VOORBEELDFORMULERING: \u201cHet profiel laat een volgorde zien waarin resultaat en onderscheid v\u00f3\u00f3r analyse komen. Onze veronderstelling daarbij is dat jij eerst een beeld van de mogelijke oplossing vormt en dat je analytisch vermogen daarna aanslaat. Klopt dat voor jou, en waar dan wel en waar niet?\u201d",
        "toelichtingFout": "AFGEKEURDE VOORBEELDFORMULERINGEN. Verzachten zonder corrigeren: \u201cKlopt in grote lijnen, al is het een voorkeur en geen vaste eigenschap\u201d \u2014 de vaststelling blijft, alleen de toon verandert; dit is het meest voorkomende foute antwoord. En het tegenovergestelde uiterste: \u201cHet profiel zegt niets over hoe je brein werkt\u201d of \u201cde volgorde heeft geen betekenis\u201d \u2014 de volgorde is w\u00e9l gemeten en de veronderstelling erover is w\u00e9l bespreekbaar, alleen niet als mededeling. Ook af te keuren: een antwoord dat de route uit de talentfoci leest in plaats van uit de versnellers.",
        "bron": "Regel vastgelegd door de auteur op 14-08-2026: de talentversnellers dragen de hersenroute, de talentfoci niet. Boekanker r.6015-6018 versnellervolgorde als startpunt bottom-up/top-down; onderzoekslijnen H17 r.5424-5440; bewijsniveaus H21 r.6545-6549. Let op: H17 r.5528-5540 illustreert dezelfde twee routes met talentfoci (Operationeel of Strategie als opener); de boekbronnen bevatten geen regel die \u00e9\u00e9n van beide lezingen uitsluit. De voorrang voor de versnellers berust op de door de auteur vastgelegde regel en niet op het boek; de beoordelaar moet dat aan de kandidaat zo kunnen uitleggen."
    },
    # ---------------------------------------------------------------- W4
    {
        "code": "D-09",
        "soort": "scenario",
        "gedragsindicator": "W4",
        "stam": "Een rapport verklaart een hoge waarde op Be Perfect zo: \u201cHij levert bijzonder nauwkeurig werk omdat hij de waardering van zijn team niet wil verspelen.\u201d Wat is er mis?",
        "opties": [
            "Be Perfect gaat niet over nauwkeurigheid maar over tempo; de verklaring beschrijft in werkelijkheid het patroon dat bij de driver Hurry Up hoort.",
            "Er is geen fout: nauwkeurigheid en waardering versterken elkaar, en de meeste drivers hebben nu eenmaal zowel een naar binnen als een naar buiten gerichte kant.",
            "De verklaring is aannemelijk maar niet controleerbaar; drivers mogen alleen benoemd worden en niet van een reden worden voorzien in een rapport.",
            "De verklaring legt de maatstaf buiten de persoon. Bij deze driver bepaalt iemand de lat waaraan hij zich meet in zichzelf, niet in het oordeel van een groep."
        ],
        "sleutel": "D",
        "toelichtingGoed": "De vijf drivers verdelen zich naar waar het referentiepunt ligt. Bij drie ervan bepaalt iemand zelf de maatstaf \u2014 het referentiepunt ligt in hemzelf; bij twee andere hangt de spanning af van het oordeel van iemand anders. Be Perfect hoort bij de eerste groep: de lat ligt binnen. Wie er een verklaring bij zet die van waardering door het team afhangt, schuift de driver naar de andere groep en stuurt het hele gesprek de verkeerde kant op.",
        "toelichtingFout": "B is de gevaarlijkste afleider: ze klinkt genuanceerd en maakt het onderscheid tussen de twee groepen ongedaan door alles een beetje van beide te noemen. Dan valt er niets meer te lezen aan het profiel. A verplaatst de fout naar een andere driver en houdt de verkeerde verklaring in stand.",
        "bron": "H7 r.2393-2398 intern gefocust, \u201cJe referentiepunt ligt in jezelf\u201d; H12 r.3598-3613 drie tegenover twee"
    },
    {
        "code": "D-10",
        "soort": "scenario",
        "gedragsindicator": "W4",
        "stam": "Een coachee heeft een hoge waarde op Try Hard. De geaccrediteerde zegt: \u201cJij wil het voor de hele groep goed doen en cijfert jezelf weg om de sfeer te bewaren.\u201d Wat is er mis?",
        "opties": [
            "De beschrijving hoort bij een andere driver. Try Hard gaat om de erkenning van \u00e9\u00e9n ander die veel betekent, niet om een hele groep.",
            "Try Hard is intern gefocust, dus elke verklaring waarin een ander voorkomt is onjuist; het gaat hier zuiver om de lat die de coachee voor zichzelf legt.",
            "De beschrijving klopt in grote lijnen, maar \u201ccijfert jezelf weg\u201d is een waardeoordeel dat in een terugkoppeling aan een coachee niet thuishoort.",
            "Er is geen fout in de inhoud, alleen in de vorm: dit soort verklaring hoort pas te komen nadat de coachee zelf een herkenbaar voorbeeld uit zijn eigen werk heeft gegeven."
        ],
        "sleutel": "A",
        "toelichtingGoed": "Beide drivers hebben hun referentiepunt buiten de persoon, maar niet op dezelfde plaats. De ene richt zich op de groep en op het bewaren van de verhouding met velen; de andere op de erkenning van \u00e9\u00e9n belangrijke ander \u2014 een ouder, een partner, een mentor. Wie die twee verwisselt, geeft een verklaring die de coachee niet herkent, en mist bovendien de vraag die telt: om wiens erkenning gaat het hier eigenlijk?",
        "toelichtingFout": "C is de gevaarlijkste afleider: ze corrigeert een re\u00eble stijlfout en laat de inhoudelijke verwisseling onaangeroerd. B klinkt als parate kennis en is onjuist: deze driver hoort niet bij de groep met het referentiepunt in de persoon zelf.",
        "bron": "r.2359-2361 en r.3589-3590 de erkenning van \u00e9\u00e9n belangrijke ander; H12 r.3598-3613"
    },
    # ---------------------------------------------------------------- W5
    {
        "code": "D-16",
        "soort": "scenario",
        "gedragsindicator": "W5",
        "stam": "De ouders van een zeventienjarige in het laatste jaar secundair willen een studiekeuze onderbouwen en vragen daarvoor de professionalversie. Welk instrument uit de reeks is op deze doelgroep en deze levensvraag gebouwd?",
        "opties": [
            "De jongerenvariant: die is gebouwd voor scholieren en studenten die een richting voor verder studeren of een eerste stap in werk moeten bepalen.",
            "De professionalversie: die gaat na of het werk en de werkgever van een volwassene nog passen bij zijn talenten, waarden en drivers.",
            "De sportvariant: die brengt de niet-fysieke vermogens in beeld waarmee iemand zich in een sportcontext ontwikkelt en op de moeilijke momenten blijft volhouden.",
            "De aanwervingsvariant: die maakt de eisen in een vacature en het selectiegesprek bespreekbaar in termen van talenten, waarden en drivers bij een aanwerving."
        ],
        "sleutel": "A",
        "toelichtingGoed": "De reeks bestaat uit instrumenten die elk op een eigen doelgroep en een eigen levensvraag zijn gebouwd: jongeren en jongvolwassenen bij studie- en eerste loopbaankeuzes, volwassenen bij de vraag of hun functie, organisatie of loopbaanpad nog bij hun talenten, waarden en drivers past, en daarnaast sport en aanwerving. Deze ouders stellen een studiekeuzevraag; de professionalversie is op een andere vraag gebouwd. Voor jongeren loopt bovendien een eigen onderzoekslijn waarin de kernconstructen naar de schoolcontext zijn vertaald \u2014 die vertaling is er niet voor niets.",
        "toelichtingFout": "B, C en D noemen elk een bestaand instrument uit dezelfde reeks, maar telkens \u00e9\u00e9n dat op een andere doelgroep en een andere levensvraag is gebouwd. B is de gevaarlijkste afleider, omdat de ouders er zelf om vragen en de vragenlijst technisch gewoon afneembaar is. Let op voor de beoordelaar: de bron formuleert geen verbod op het gebruik van de professionalversie bij een minderjarige, wel een doelgroepomschrijving waar deze vraag niet in past. De kandidaat hoort dus te antwoorden op grond van waarvoor het instrument gebouwd is, niet op grond van een regel die er niet staat.",
        "bron": "r.7205-7215 instrumentreeks per doelgroep en levensvraag (studie- en eerste loopbaankeuzes, professionals, sport, aanwerving); r.6700-6703 aparte onderzoekslijn voor jongeren met de kernconstructen vertaald naar de schoolcontext"
    },
    # ---------------------------------------------------------------- W6
    {
        "code": "D-12",
        "soort": "scenario",
        "gedragsindicator": "W6",
        "stam": "In een rapport staat onder de kop \u201cBevindingen\u201d: \u201cDeze driverconfiguratie wijst, samen met de uitgesproken focus Operationeel en de reactieve aard van deze functie, op een verhoogd burn-outrisico.\u201d Wat moet er gebeuren?",
        "opties": [
            "Het woord \u201crisico\u201d vervangen door \u201caandachtspunt\u201d, en de uitspraak kan verder blijven staan op de plaats in het rapport waar ze nu staat.",
            "Er hoort een zin bij dat dit instrument geen voorspellingen doet over individuen; met dat voorbehoud erbij is de passage aanvaardbaar onder deze kop.",
            "De uitspraak weghalen of omzetten in een te toetsen gespreksvraag: een combinatie op dit niveau is werkmodel en hoort niet onder bevindingen.",
            "Niets \u2014 dit is precies het soort samenhang dat het instrument zichtbaar maakt, en de kop \u201cBevindingen\u201d is daarvoor in een rapport de juiste plaats."
        ],
        "sleutel": "C",
        "toelichtingGoed": "Over drivers en burn-out worden consistente verbanden gemeld, maar met de uitdrukkelijke kanttekening dat de datasets nog in opbouw zijn: uitspraken over tendensen in een groep zijn iets anders dan een uitspraak over deze persoon. Fijnmazige combinaties van een driverconfiguratie met een specifieke focus in een specifieke context worden met zoveel woorden als werkmodel aangeduid. De kop is hier de eigenlijke overtreding \u2014 die geeft een veronderstelling de status van vaststelling.",
        "toelichtingFout": "A is de gevaarlijkste afleider en komt in echte rapporten het vaakst voor: de claim blijft, alleen het woord verandert. B is daar de variant van met een disclaimer erbij \u2014 een voorbehoud dat de voorspelling tegenspreekt en er niets aan afdoet.",
        "bron": "H21 r.6918-6950 datasets in opbouw en hypothese/werkmodel; r.6545-6549 drie bewijsniveaus"
    },
    {
        "code": "D-13",
        "soort": "scenario",
        "gedragsindicator": "W6",
        "stam": "Een HR-directeur schrijft in het verslag van een talentreview: \u201cOp basis van haar TaPas-profiel classificeren wij haar als high potential.\u201d Wat is hier precies het probleem?",
        "opties": [
            "Het woord \u2018potentieel\u2019 hoort in geen enkele uitspraak over een profiel voor te komen, omdat het altijd een voorspelling over de toekomst inhoudt.",
            "Het profiel wordt gebruikt om iemand in een categorie te plaatsen die haar verdere loopbaan gaat sturen. Meten mag hier, indelen niet.",
            "De classificatie mag wel, maar alleen wanneer ze naast het profiel steunt op prestatiegegevens over minstens twee opeenvolgende jaren.",
            "Het probleem is de vertrouwelijkheid: een uitspraak uit een individueel profiel hoort niet in een verslag dat binnen de organisatie wordt gedeeld."
        ],
        "sleutel": "B",
        "toelichtingGoed": "De maatstaf is dat een instrument mag meten maar nooit mag verkleinen. Talent wordt in het kader zelf beschreven als iets dat zich ontvouwt op het snijpunt van aanleg en context \u2014 het woord potentieel is dus niet verboden. Wat niet kan, is het profiel omzetten in een categorie die deuren opent of sluit. Dat is de beweging waartegen het hele instrument is opgezet: van een beeld van iemand naar een etiket dat zijn pad vernauwt.",
        "toelichtingFout": "A is de gevaarlijkste afleider en verklaart te veel verboden: wie zo leest, kan over ontplooiing niets meer zeggen en verliest de kern van het model. C is de klassieke schijnoplossing: extra bewijs erbij maakt de indeling niet aanvaardbaar, want het bezwaar gaat over indelen als zodanig. D benoemt een echte kwestie die hier niet de kern is.",
        "bron": "r.4325-4326 en r.4636-4637 meten mag nooit verkleinen; r.4134-4135 talent als potentieel op het snijpunt van aanleg en context; r.4253-4256"
    },
    # ---------------------------------------------------------------- W8
    {
        "code": "D-14",
        "soort": "scenario",
        "gedragsindicator": "W8",
        "stam": "Een coachee leest de driverpagina en zegt: \u201cDit lijkt mij een horoscoop. Waarop is dit eigenlijk gebaseerd?\u201d Wat is het juiste antwoord?",
        "opties": [
            "Uitleggen dat het instrument wetenschappelijk gevalideerd is en dat de resultaten in samenwerking met een universiteit zijn onderzocht, gerapporteerd en gepubliceerd.",
            "Zeggen dat het geen test is maar een gespreksinstrument, en dat de vraag naar wetenschappelijke onderbouwing daarom bij dit soort profielen niet van toepassing is.",
            "De vraag terugleggen: eerst vragen wat haar in het rapport precies aan een horoscoop doet denken, en pas op de onderbouwing ingaan wanneer zij daar zelf op terugkomt.",
            "Benoemen waar het driverbegrip uit voortkomt, welke exploratieve factoranalyse op de eigen profielen is uitgevoerd en dat die niet gepubliceerd is, en zeggen wat nog niet onderzocht is."
        ],
        "sleutel": "D",
        "toelichtingGoed": "Wie met mensen werkt, hoort te kunnen zeggen waarop een uitspraak rust en waar de grens ligt \u2014 juist omdat de ander de gevolgen draagt van het beeld dat van hem gevormd wordt. Een eerlijk antwoord noemt de herkomst van het begrip, verwijst naar de exploratieve factoranalyse die op de eigen profielen is uitgevoerd met een universitaire partner, en vermeldt dat die analyse niet extern gepubliceerd is. Dat is minder indrukwekkend dan optie A en het is wel waar.",
        "toelichtingFout": "A is de gevaarlijkste afleider: ze klinkt professioneel en bevat twee onwaarheden \u2014 gepubliceerd is de analyse niet, en \u2018gevalideerd\u2019 dekt hier meer dan er is. C is een verdedigbare gesprekstechniek die op deze vraag ontwijkend uitpakt: de coachee vraagt niet om een wedervraag maar om verantwoording. B geeft de vraag weg.",
        "bron": "H21 r.6979-6990 recht op eerlijkheid over sterkte en grens; r.4176-4182 drivers oorspronkelijk beschreven binnen de transactionele analyse en verder uitgewerkt door Taibi Kahler; ITEMBRON \u00a73.1 exploratieve factoranalyse UAntwerpen, niet extern gepubliceerd; ITEMBRON \u00a73.2 wat niet gemeten is; r.6884-6892 inhoudsvaliditeit en de koppeling tussen drivers en onderzoek naar stress, burn-out en zelfondermijning"
    },
    {
        "code": "D-15",
        "soort": "open",
        "gedragsindicator": "W8",
        "stam": "Een opdrachtgever vraagt voor de aankoop: \u201cWat is de betrouwbaarheid van dit instrument? Graag cijfers.\u201d Formuleer het antwoord dat een geaccrediteerde hier hoort te geven.",
        "opties": [],
        "sleutel": "Vier elementen. (1) HET GEVRAAGDE CIJFER BESTAAT NIET: er is geen betrouwbaarheidsco\u00ebffici\u00ebnt berekend of gerapporteerd, en er is geen test-hertestonderzoek gedaan. Dat moet expliciet gezegd worden en niet omzeild. (2) WAT ER W\u00c9L IS, correct benoemd: een exploratieve factoranalyse op 1.858 professionele profielen samen met de Universiteit Antwerpen, met hoge factorladingen op de driverschalen en lagere op de energieschalen onder de versnellers. (3) HET ONDERSCHEID: een factorlading is geen betrouwbaarheidsco\u00ebffici\u00ebnt; ze zegt of items zich groeperen zoals verwacht, niet hoe consistent of stabiel een schaal meet. Wie de ladingen als betrouwbaarheidscijfer aanbiedt, geeft een verkeerd antwoord. (4) DE OVERIGE WAARBORGEN, zonder ze op te blazen: externe inhoudsvalidatie door vier onafhankelijke experts onder supervisie van een hoogleraar methoden, en een nazicht van de statistische vormgeving door een sectorfonds \u2014 met de vermelding dat die bevindingen niet als afzonderlijk rapport gepubliceerd zijn.",
        "toelichtingGoed": "SCHAAL 0-3. 3 = de elementen (1) en (3) plus minstens \u00e9\u00e9n van (2) en (4). 2 = (1) plus \u00e9\u00e9n ander element, zonder het onderscheid uit (3) te verhaspelen. 1 = het ontbreken van het cijfer wordt gemeld maar de rest blijft vaag, of de waarborgen worden genoemd zonder te zeggen dat het gevraagde cijfer er niet is. 0 = de factorladingen worden als betrouwbaarheid aangeboden, of het instrument wordt \u2018gevalideerd\u2019 genoemd zonder meer. VOORRANGSREGELS. Element (1) is voorwaardelijk: zonder (1) is de score nooit hoger dan 1. Wie de factorladingen als betrouwbaarheidscijfer aanbiedt, krijgt 0, ook wanneer element (1) genoemd is. Het getal 1.858 is facultatief; het ontbreken ervan verlaagt de score niet. Wie H21 r.6586-6591 aanhaalt (\u2018gekeken naar de interne consistentie en de stabiliteit over tijd\u2019) krijgt daarvoor geen aftrek, maar moet er wel bij zeggen dat daaruit geen co\u00ebffici\u00ebnt is gerapporteerd; zonder die toevoeging telt element (1) niet als gegeven. GOEDGEKEURDE VOORBEELDFORMULERING: \u201cEen betrouwbaarheidsco\u00ebffici\u00ebnt is voor dit instrument niet berekend en een test-hertestonderzoek is er niet. Wat er is, is een exploratieve factoranalyse op onze eigen profielen met een universitaire partner, waarin de schalen zich groeperen zoals het model voorspelt. Dat is iets anders dan een betrouwbaarheidscijfer en ik wil dat niet als hetzelfde presenteren.\u201d",
        "toelichtingFout": "AFGEKEURDE VOORBEELDFORMULERINGEN. \u201cDe betrouwbaarheid ligt tussen 0,63 en 0,97\u201d \u2014 dat zijn factorladingen en geen betrouwbaarheidsco\u00ebffici\u00ebnten; dit is het meest voorkomende foute antwoord en het levert 0. \u201cHet instrument is wetenschappelijk gevalideerd in samenwerking met de universiteit\u201d \u2014 te ruim en niet gepubliceerd. En het andere uiterste: \u201cbetrouwbaarheid is bij dit soort instrumenten niet aan de orde\u201d \u2014 de vraag is legitiem en het antwoord is dat het cijfer er niet is, niet dat de vraag niet telt.",
        "bron": "ITEMBRON \u00a73.1 en \u00a73.2 op basis van shared/onderbouwing-t4professional.ts; H21 r.6857-6861 verdere rapportering van interne consistentie en test-hertestbetrouwbaarheid voor alle schalen als toekomstige onderzoeksstap"
    },
]


# --------------------------------------------------------------------------
# Nametingen
# --------------------------------------------------------------------------
def md5(pad: pathlib.Path) -> str:
    return hashlib.md5(pad.read_bytes()).hexdigest()


def meet() -> dict:
    gesloten = [i for i in ITEMS if i["soort"] != "open"]
    op3n = [i for i in ITEMS if i["soort"] == "open"]

    sleutel_langste = 0
    ratios = []
    detail = []
    for i in gesloten:
        lengtes = [len(o) for o in i["opties"]]
        idx = "ABCD".index(i["sleutel"])
        sl = lengtes[idx]
        afl = [l for n, l in enumerate(lengtes) if n != idx]
        is_langste = sl == max(lengtes)
        if is_langste:
            sleutel_langste += 1
        ratio = sl / statistics.mean(afl)
        ratios.append(ratio)
        detail.append((i["code"], sl, round(ratio, 3), is_langste,
                       "ABCD"[lengtes.index(max(lengtes))]))

    ind = {}
    for i in ITEMS:
        ind[i["gedragsindicator"]] = ind.get(i["gedragsindicator"], 0) + 1
    spreiding = {}
    for i in gesloten:
        spreiding[i["sleutel"]] = spreiding.get(i["sleutel"], 0) + 1

    return {
        "n": len(ITEMS),
        "gesloten": len(gesloten),
        "open": len(op3n),
        "sleutel_langste": sleutel_langste,
        "ratio_gemiddeld": round(statistics.mean(ratios), 3),
        "ratio_uiterste": round(max(ratios), 3),
        "indicatoren": dict(sorted(ind.items())),
        "sleutelspreiding": dict(sorted(spreiding.items())),
        "detail": detail,
    }


def main() -> int:
    md5_voor = md5(CORPUS)
    if md5_voor != CORPUS_MD5_VERWACHT:
        print(f"AFBREKEN: corpus-md5 wijkt af bij de start: {md5_voor}")
        return 1

    # ---- eisen ----------------------------------------------------------
    codes = [i["code"] for i in ITEMS]
    assert len(codes) == len(set(codes)), "dubbele itemcode"
    assert len(ITEMS) == 16, f"verwacht 16 items (ITEMBRON \u00a77 D16), kreeg {len(ITEMS)}"

    for i in ITEMS:
        assert i["soort"] in ("scenario", "meerkeuze", "juistfout", "open"), i["code"]
        if i["soort"] == "open":
            assert i["opties"] == [], f"{i['code']}: open item moet lege optielijst hebben"
            assert "SCHAAL 0-3" in i["toelichtingGoed"], f"{i['code']}: geen 0-3-schaal"
            assert "VOORRANGSREGELS" in i["toelichtingGoed"], f"{i['code']}: geen voorrangsregels"
            assert "VOORBEELDFORMULERING" in i["toelichtingGoed"], f"{i['code']}: geen voorbeeld"
        else:
            assert len(i["opties"]) == 4, f"{i['code']}: geen vier opties"
            assert i["sleutel"] in "ABCD", f"{i['code']}: sleutel niet A-D"
        for veld in ("stam", "sleutel", "toelichtingGoed", "toelichtingFout", "bron"):
            assert i[veld].strip(), f"{i['code']}: leeg veld {veld}"
        # geen verboden vormen uit het draaiboek
        laag = " ".join([i["stam"]] + i["opties"]).lower()
        assert "alle bovenstaande" not in laag, f"{i['code']}: verboden optievorm"
        assert "geen van bovenstaande" not in laag, f"{i['code']}: verboden optievorm"
        # "ijkpunt" bestaat niet in het boek - alleen "referentiepunt"
        alles = " ".join([i["stam"], i["sleutel"], i["toelichtingGoed"],
                          i["toelichtingFout"]] + i["opties"]).lower()
        assert "ijkpunt" not in alles, f"{i['code']}: 'ijkpunt' bestaat niet in de bron"

    m = meet()

    # zeven indicatoren: W7 blijft bij blok E
    assert set(m["indicatoren"]) == {"W1", "W2", "W3", "W4", "W5", "W6", "W8"}, m["indicatoren"]
    assert min(m["indicatoren"].values()) >= 1, "indicator zonder item"

    # sleutelspreiding: geen letter mag domineren
    assert max(m["sleutelspreiding"].values()) <= 5, m["sleutelspreiding"]
    assert len(m["sleutelspreiding"]) == 4, m["sleutelspreiding"]

    # de lengte-aanwijzing
    assert m["sleutel_langste"] <= 3, \
        f"sleutel is langste in {m['sleutel_langste']} items - grens is 3"
    assert 0.93 <= m["ratio_gemiddeld"] <= 1.07, \
        f"gemiddelde lengteratio {m['ratio_gemiddeld']} buiten 0,93-1,07"
    assert m["ratio_uiterste"] <= 1.25, \
        f"uiterste lengteratio {m['ratio_uiterste']} boven 1,25"

    # ---- wegschrijven ---------------------------------------------------
    BEK.mkdir(parents=True, exist_ok=True)
    DOEL.write_text(
        json.dumps(ITEMS, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    md5_na = md5(CORPUS)
    assert md5_na == md5_voor, "corpus is tijdens de run gewijzigd"

    print(f"Weggeschreven: {DOEL.relative_to(REPO)}")
    print(f"  items                 {m['n']} ({m['gesloten']} gesloten, {m['open']} open)")
    print(f"  indicatoren           {m['indicatoren']}")
    print(f"  sleutelspreiding      {m['sleutelspreiding']}")
    print(f"  sleutel is langste    {m['sleutel_langste']} van {m['gesloten']}")
    print(f"  lengteratio gemiddeld {m['ratio_gemiddeld']}  uiterste {m['ratio_uiterste']}")
    print(f"  corpus-md5            {md5_na} (onaangeroerd)")
    print()
    print("  code    sleutellengte  ratio  sleutel=langste  langste optie")
    for code, sl, ratio, langste, welke in m["detail"]:
        print(f"  {code:7s} {sl:13d}  {ratio:5.3f}  {str(langste):15s}  {welke}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
