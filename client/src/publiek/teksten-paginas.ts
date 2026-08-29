// ===========================================================================
// publiek/teksten-paginas.ts: de tweetalige teksten van de publieke pagina's.
//
// WAAROM DIT BESTAND BESTAAT
// De publieke laag is de voordeur van een internationaal aanbod. Wie hier voor
// het eerst binnenkomt, leest Engels; Nederlands staat één knop ver. De
// gedeelde inhoud (clusters, stappen, outputs, deuren) komt uit
// publiek/inhoud.ts. Wat daarnaast op een pagina zelf staat, de koppen, de
// leadalinea's, de opschriften van de knoppen en de teksten van aria-label,
// alt, title en placeholder, staat hier, per pagina gegroepeerd, als koppel
// van beide talen. Zo blijft geen enkele zichtbare tekst in een pagina staan
// en kan de Nederlandse tekst niet stil uit elkaar groeien met de Engelse.
//
// HOE JE HET LEEST
// In een pagina: kies(T.oplossingen.titel, taal). Wie een derde taal
// toevoegt, vult hier één lid per koppel bij en hoeft geen pagina aan te raken.
//
// WAT DIT BESTAND NIET DOET
// Het bevat geen machinewaarden: geen paden, geen sleutels, geen testid's en
// geen formulierwaarden. Die blijven in beide talen identiek en staan in de
// pagina of in de inhoudsbron.
// ===========================================================================

import type { PubliekeTaal, Tweetalig } from "@/publiek/taal";

/** Een tweetalig koppel: één tekst, of een lijst van teksten per taal. */
export type Koppel = Tweetalig | Record<PubliekeTaal, readonly string[]>;

export const T = {
  /** De kopbalk van de publieke laag. */
  kop: {
    merkonder: {
      nl: "de beslislaag voor talentbeslissingen",
      en: "the decision layer for talent decisions",
    },
    naarLicht: {
      nl: "Wissel naar de lichte weergave",
      en: "Switch to the light view",
    },
    naarDonker: {
      nl: "Wissel naar de donkere weergave",
      en: "Switch to the dark view",
    },
    licht: { nl: "Licht", en: "Light" },
    donker: { nl: "Donker", en: "Dark" },
    kennismaking: {
      nl: "Plan een kennismaking",
      en: "Arrange an introduction",
    },
  },

  /** De voettekst van de publieke laag. */
  voet: {
    oplossingen: { nl: "Oplossingen", en: "Solutions" },
    outputs: { nl: "Outputs", en: "Outputs" },
    partners: { nl: "Voor partners", en: "For partners" },
    demo: { nl: "Demo-omgeving", en: "Demo environment" },
    instrumenten: { nl: "Instrumentenoverzicht", en: "Instrument overview" },
    onderbouwing: { nl: "Onderbouwing", en: "Evidence base" },
    aanmelden: { nl: "Aanmelden", en: "Sign in" },
    grens: {
      nl: "Tapas CORE levert onderbouwde inzichten die een beslissing helpen voorbereiden. Het platform stelt geen diagnose, neemt geen selectiebeslissing en bepaalt geen potentieel. Wie beslist, blijft de organisatie.",
      en: "Tapas CORE delivers well-founded insights that help prepare a decision. The platform makes no diagnosis, takes no selection decision and determines no potential. Whoever decides remains the organisation.",
    },
    gegevens: {
      nl: "Tapas CORE is een platform van TaPasCity, 2BQ Consult, Zandstraat 85, 2960 Sint Job in 't Goor, België.",
      en: "Tapas CORE is a platform of TaPasCity, 2BQ Consult, Zandstraat 85, 2960 Sint Job in 't Goor, Belgium.",
    },
  },

  /** Het vaste geraamte van een oplossingpagina. */
  traject: {
    alleOplossingen: { nl: "Alle oplossingen", en: "All solutions" },
    kennismaking: {
      nl: "Plan een kennismaking",
      en: "Arrange an introduction",
    },
    demoKnop: {
      nl: "Bekijk het traject in de demo",
      en: "View the programme in the demo",
    },
    filmTalen: { nl: "Taal van de film", en: "Language of the film" },
    geenFilm: {
      nl: "Uw browser kan deze film niet spelen. Het verloop van het traject staat hieronder in tekst.",
      en: "Your browser cannot play this film. The course of the programme is set out in text below.",
    },
    voorWieEyebrow: { nl: "Voor wie en wanneer", en: "Who it is for and when" },
    tagVoorWie: { nl: "Voor wie", en: "Who it is for" },
    lezerKop: {
      nl: "De lezer van dit traject",
      en: "The reader of this programme",
    },
    tagWanneer: { nl: "Wanneer", en: "When" },
    momentKop: {
      nl: "Het moment om het in te zetten",
      en: "The moment to deploy it",
    },
    trajectEyebrow: { nl: "Het traject", en: "The programme" },
    trajectkop: {
      nl: "Vijf stappen, met een vaste doorlooptijd",
      en: "Five steps, with a fixed turnaround time",
    },
    trajectuitleg: {
      nl: "Het traject is één geheel. Elke stap levert materiaal voor de volgende, en de laatste stap is een oplevering aan wie beslist.",
      en: "The programme is one whole. Every step delivers material for the next, and the last step is a delivery to whoever decides.",
    },
    stap: { nl: "Stap", en: "Step" },
    outputEyebrow: { nl: "Wat u krijgt", en: "What you receive" },
    outputKop: {
      nl: "De output, benoemd naar de lezer",
      en: "The output, named after the reader",
    },
    outputUitleg: {
      nl: "Elk rapport heeft één lezer en één doel. Zo weet iedereen wat hij in handen heeft en wat hij er niet uit mag lezen.",
      en: "Every report has one reader and one purpose. That way everyone knows what they hold and what they may not read into it.",
    },
    voor: { nl: "Voor", en: "For" },
    outputsLink: {
      nl: "Volledige opbouw van de outputs",
      en: "Full build-up of the outputs",
    },
    uitkomstEyebrow: { nl: "Zakelijke uitkomst", en: "Business outcome" },
    uitkomstKop: {
      nl: "Waar u na het traject staat",
      en: "Where you stand after the programme",
    },
    prijsKop: { nl: "Prijsindicatie", en: "Price indication" },
    grenzenEyebrow: { nl: "Grenzen", en: "Boundaries" },
    grenzenKop: {
      nl: "Wat dit traject niet doet",
      en: "What this programme does not do",
    },
    grenzenUitleg: {
      nl: "Een duidelijke grens maakt de uitkomst bruikbaar. Wie beslist, blijft de organisatie.",
      en: "A clear boundary makes the outcome usable. Whoever decides remains the organisation.",
    },
    onderbouwingKnop: {
      nl: "Lees de onderbouwing",
      en: "Read the evidence base",
    },
  },

  /** De oplossingenpagina. */
  oplossingen: {
    eyebrow: { nl: "Oplossingen", en: "Solutions" },
    titel: {
      nl: "Vijf beslissingen, vijf trajecten",
      en: "Five decisions, five programmes",
    },
    lead: {
      nl: "Tapas CORE begint niet bij een instrument maar bij een beslissing. Elk cluster hieronder bundelt de stappen, de begeleiding en de rapporten die bij één type beslissing horen. De instrumenten blijven wat ze zijn, de ordening maakt duidelijk waarvoor u ze inzet.",
      en: "Tapas CORE does not start from an instrument but from a decision. Every cluster below bundles the steps, the guidance and the reports that belong with one type of decision. The instruments remain what they are, and the ordering makes clear what you deploy them for.",
    },
    eersteEyebrow: { nl: "Eerste lijn", en: "First line" },
    eersteKop: {
      nl: "De twee trajecten waarmee wij internationaal starten",
      en: "The two programmes with which we start internationally",
    },
    eersteUitleg: {
      nl: "Beide raken een beslissing met gevolgen: een dossier dat op tafel ligt en een ploeg die moet leveren. Ze zijn opgebouwd als traject, met een vaste reeks stappen en een bestuursklare oplevering.",
      en: "Both touch a decision with consequences: a file on the table and a team that has to deliver. They are built as a programme, with a fixed series of steps and a board-ready delivery.",
    },
    tagTraject: { nl: "Traject", en: "Programme" },
    metaVoorWie: { nl: "Voor wie", en: "Who it is for" },
    verder: { nl: "Bekijk het traject", en: "View the programme" },
    vierdeEyebrow: { nl: "Vierde journey", en: "Fourth journey" },
    vierdeKop: {
      nl: "De instroombeslissing, op dezelfde motor",
      en: "The hiring decision, on the same engine",
    },
    vierdeUitleg: {
      nl: "Aanwerven is het beslismoment dat organisaties het vaakst nemen. Het loopt hier op dezelfde onderbouwing als de trajecten hierboven, met een eigen doorlooptijd en een eigen prijs per kandidaat.",
      en: "Hiring is the decision organisations take most often. Here it runs on the same underpinning as the programmes above, with its own turnaround time and its own price per candidate.",
    },
    onderJourney: { nl: "Onder de journey", en: "Under the journey" },
    onderJourneyTekst: {
      nl: "De journey draait op T4Recruitment, samen met het T4P Business Kompas. Eerst wordt de rol scherpgesteld met de mensen rond de functie, daarna wordt het kandidaatprofiel daartegen gelegd.",
      en: "The journey runs on T4Recruitment, together with the T4P Business Kompas. First the role is sharpened with the people around the function, then the candidate profile is placed against it.",
    },
    metaPrijs: { nl: "Prijsindicatie", en: "Price indication" },
    filmVerder: {
      nl: "Ruim een minuut film op de trajectpagina",
      en: "A little over a minute of film on the programme page",
    },
    restEyebrow: { nl: "Verdere clusters", en: "Further clusters" },
    restKop: {
      nl: "Wat het platform verder ondersteunt",
      en: "What the platform further supports",
    },
    restUitleg: {
      nl: "Dezelfde motor, andere beslissing. Deze clusters lopen vandaag al in scholen, organisaties en bij coaches, met de instrumenten die daarvoor gebouwd zijn.",
      en: "The same engine, a different decision. These clusters already run today in schools, in organisations and with coaches, with the instruments built for them.",
    },
    tagCluster: { nl: "Cluster", en: "Cluster" },
    // De film over Development & Mobility. Dit cluster heeft geen eigen
    // trajectpagina, dus staat de film hier, in een eigen band onder het
    // overzicht. De regels komen letterlijk uit het filmscenario.
    dmFilmEyebrow: {
      nl: "Traject voor HR, loopbaanbegeleiders en interne coaches",
      en: "A journey for HR, career guidance and internal coaches",
    },
    dmFilmKop: {
      nl: "Development & Mobility",
      en: "Development & Mobility",
    },
    dmFilmUitleg: {
      nl: "Ontwikkeling en interne mobiliteit onderbouwen. Een ontwikkelkeuze, geen losse indruk.",
      en: "Underpinning development and internal mobility. A development choice, not a loose impression.",
    },
    dmFilmTaal: {
      nl: "De film is Nederlands gesproken, met Nederlandse ondertitels.",
      en: "The film is spoken in Dutch, with Dutch subtitles.",
    },
    dmFilmOnder: {
      nl: "Geen belofte op succes. Geen automatische doorstroming. De beslissing blijft bij mens en organisatie.",
      en: "No promise of success. No automatic progression. The decision stays with people and the organisation.",
    },
    metaInstrumenten: { nl: "Instrumenten", en: "Instruments" },
    tweedeEyebrow: { nl: "Tweede laag", en: "Second layer" },
    tweedeKop: { nl: "De instrumenten zelf", en: "The instruments themselves" },
    tweedeUitleg: {
      nl: "Zestien instrumenten, vijf talen, van een korte energiescan tot een volledig kompas. Wie liever vertrekt van het instrument, vindt de volledige lijst met bereik, doorlooptijd en rapportvorm.",
      en: "Sixteen instruments, five languages, from a short energy scan to a full compass. Whoever prefers to start from the instrument finds the full list with scope, turnaround time and report form.",
    },
    naarInstrumenten: {
      nl: "Naar het instrumentenoverzicht",
      en: "To the instrument overview",
    },
    naarOutputs: { nl: "Bekijk wat u krijgt", en: "See what you receive" },
    naarDemo: {
      nl: "Bekijk de demo-omgeving",
      en: "View the demo environment",
    },
  },

  /** De outputspagina. */
  outputs: {
    eyebrow: { nl: "Outputs", en: "Outputs" },
    titel: {
      nl: "Rapporten die een beslissing dragen",
      en: "Reports that carry a decision",
    },
    lead: {
      nl: "Een profiel dat niemand kan gebruiken, is geen resultaat. Daarom heeft elk rapport van Tapas CORE een benoemde lezer: het zegt voor wie het bedoeld is, wat erin staat en wat er niet uit gelezen mag worden. Dezelfde vier lagen komen terug bij elk instrument en bij elk traject.",
      en: "A profile nobody can use is not a result. That is why every report from Tapas CORE has a named reader: it states who it is intended for, what is in it and what may not be read into it. The same four layers return with every instrument and with every programme.",
    },
    naarTrajecten: { nl: "Bekijk de trajecten", en: "View the programmes" },
    naarDemo: {
      nl: "Zie ze in de demo-omgeving",
      en: "See them in the demo environment",
    },
    stapelEyebrow: { nl: "De stapel", en: "The stack" },
    stapelKop: {
      nl: "Vier lagen, van de deelnemer tot het bestuur",
      en: "Four layers, from the participant to the board",
    },
    stapelUitleg: {
      nl: "De lagen bouwen op elkaar. Wie hoger in de stapel leest, ziet minder detail en meer richting. Individuele scores blijven onder de eerste twee lagen.",
      en: "The layers build on each other. Whoever reads higher in the stack sees less detail and more direction. Individual scores stay within the first two layers.",
    },
    voor: { nl: "Voor", en: "For" },
    beheerEyebrow: { nl: "Kwaliteit en beheer", en: "Quality and control" },
    beheerKop: {
      nl: "Wat op elk rapport staat",
      en: "What every report carries",
    },
    beheerUitleg: {
      nl: "Vier markeringen maken een rapport navolgbaar, ook maanden later en ook voor iemand die er niet bij was toen het gemaakt werd.",
      en: "Four markings make a report traceable, also months later and also for someone who was not there when it was made.",
    },
    beslisklaarKop: { nl: "Beslisklaar", en: "Decision-ready" },
    beslisklaar: {
      nl: "De rapporten worden opgeleverd in de taal van de deelnemer, met de datum van afname en de rapportversie erbij. Wie de beslissing neemt, leest het bestuursrapport. Wie het gesprek voert, leest het begeleidersrapport. De deelnemer leest altijd eerst zijn eigen profiel.",
      en: "The reports are delivered in the language of the participant, with the date of assessment and the report version attached. Whoever takes the decision reads the board report. Whoever holds the conversation reads the practitioner report. The participant always reads their own profile first.",
    },
    grenzenEyebrow: { nl: "Grenzen", en: "Boundaries" },
    grenzenKop: {
      nl: "Waarvoor deze rapporten niet dienen",
      en: "What these reports do not serve",
    },
    grenzenUitleg: {
      nl: "Ze onderbouwen een gesprek en een beslissing. Ze stellen geen diagnose, nemen geen selectiebeslissing en bepalen geen potentieel.",
      en: "They underpin a conversation and a decision. They make no diagnosis, take no selection decision and determine no potential.",
    },
    onderbouwingKnop: {
      nl: "Lees de onderbouwing",
      en: "Read the evidence base",
    },
    voorbeeldKnop: {
      nl: "Vraag een voorbeeldrapport",
      en: "Request a sample report",
    },
  },

  /** De partnerspagina. */
  partners: {
    eyebrow: { nl: "Voor partners", en: "For partners" },
    titel: {
      nl: "Werken met Tapas CORE onder eigen naam",
      en: "Working with Tapas CORE under your own name",
    },
    lead: {
      nl: "Coaches, adviesbureaus en investeringspartners brengen de trajecten van Tapas CORE bij hun eigen klanten. Zij houden de relatie, wij leveren de instrumenten, de rapporten en de opleiding. Hieronder staat wat elke vorm van samenwerking bevat en wat ze kost.",
      en: "Coaches, advisory firms and investment partners bring the programmes of Tapas CORE to their own clients. They keep the relationship, we deliver the instruments, the reports and the training. Below is what each form of collaboration contains and what it costs.",
    },
    licentieKnop: { nl: "Vraag een licentie aan", en: "Request a licence" },
    kennismaking: {
      nl: "Plan een kennismaking",
      en: "Arrange an introduction",
    },
    vormenEyebrow: { nl: "Drie vormen", en: "Three forms" },
    vormenKop: {
      nl: "Wat een licentie bevat",
      en: "What a licence contains",
    },
    vormenUitleg: {
      nl: "De vormen verschillen in wie de klant houdt en wie het traject brengt. De instrumenten, de rapporten en de grenzen zijn in alle drie dezelfde.",
      en: "The forms differ in who keeps the client and who brings the programme. The instruments, the reports and the boundaries are the same in all three.",
    },
    metaInbegrepen: { nl: "Inbegrepen", en: "Included" },
    bekwaamEyebrow: { nl: "Bekwaamheid", en: "Competence" },
    bekwaamKop: {
      nl: "Niemand werkt met deze instrumenten zonder opleiding",
      en: "Nobody works with these instruments without training",
    },
    bekwaamUitleg: {
      nl: "Elke begeleider doorloopt het bekwaamheidskader: kennis van de constructen, van de grenzen en van de gespreksvoering. Wie niet bekwaam verklaard is, krijgt de begeleiderslaag van een rapport niet te zien. Dat beschermt de deelnemer en het merk.",
      en: "Every practitioner completes the competence framework: knowledge of the constructs, of the boundaries and of conversation practice. Whoever is not declared competent does not get to see the practitioner layer of a report. That protects the participant and the brand.",
    },
    stap1: { nl: "Stap 1", en: "Step 1" },
    stap1Kop: {
      nl: "Kennismaking en dossier",
      en: "Introduction and first file",
    },
    stap1Tekst: {
      nl: "Wij bekijken samen met welke klanten u werkt, welk cluster daarbij past en welk eerste dossier zinvol is om samen op te bouwen.",
      en: "We look together at which clients you work with, which cluster suits them and which first file is worth building together.",
    },
    stap2: { nl: "Stap 2", en: "Step 2" },
    stap2Kop: {
      nl: "Opleiding en certificering",
      en: "Training and certification",
    },
    stap2Tekst: {
      nl: "Opleiding per instrument, met een kennistoets en een oefendossier. Daarna volgt de bekwaamheidsverklaring die de begeleiderslaag opent.",
      en: "Training per instrument, with a knowledge test and a practice file. The declaration of competence that opens the practitioner layer follows after that.",
    },
    stap3: { nl: "Stap 3", en: "Step 3" },
    stap3Kop: {
      nl: "Eerste dossiers samen",
      en: "First files together",
    },
    stap3Tekst: {
      nl: "De eerste trajecten lopen met een vaste aanspreekpersoon mee, tot de oplevering zonder ondersteuning vlot verloopt.",
      en: "The first programmes run with a fixed point of contact alongside, until delivery runs smoothly without support.",
    },
    coachesLink: {
      nl: "Bekijk het bestaande coachoverzicht",
      en: "View the existing coach overview",
    },
  },

  /** De aanmeldpagina met de vier deuren. */
  aanmelden: {
    eyebrow: { nl: "Aanmelden", en: "Sign in" },
    titel: { nl: "Vier deuren, één platform", en: "Four doors, one platform" },
    lead: {
      nl: "Kies de deur die bij uw rol hoort. Achter elke deur staat de omgeving die u al kent. Wie zijn wachtwoord niet bijhoudt, vraagt een aanmeldlink aan en komt er via zijn mailbox binnen.",
      en: "Choose the door that belongs with your role. Behind every door stands the environment you already know. Whoever does not keep their password requests a sign-in link and enters through their mailbox.",
    },
    tagDeur: { nl: "Deur", en: "Door" },
    metaNodig: { nl: "Nodig", en: "Needed" },
    geenWachtwoordKop: {
      nl: "Geen wachtwoord bij de hand",
      en: "No password at hand",
    },
    geenWachtwoord: {
      nl: "De aanmeldlink werkt eenmalig en vervalt na korte tijd. Werkt de link niet meer, vraag er dan een nieuwe aan op hetzelfde scherm.",
      en: "The sign-in link works once and expires after a short time. If the link no longer works, request a new one on the same screen.",
    },
    vraagKnop: {
      nl: "Stel een vraag aan Tapas CORE",
      en: "Ask Tapas CORE a question",
    },
  },

  /** De demo-omgeving. */
  demo: {
    eyebrow: { nl: "Demo-omgeving", en: "Demo environment" },
    titel: {
      nl: "Een traject tonen, niet een vragenlijst",
      en: "Showing a programme, not a questionnaire",
    },
    lead: {
      nl: "Kies een journey en, als u wil, een casecontext. U ziet dan hoe het traject verloopt: wie deelneemt, welke stappen er zijn, welke rapporten eruit komen en welke beslissing erop volgt. De cijfers en de namen zijn fictief, de opbouw is die van een echt dossier.",
      en: "Choose a journey and, if you wish, a case context. You then see how the programme runs: who takes part, which steps there are, which reports come out of it and which decision follows. The figures and the names are fictional, and the build-up is that of a real file.",
    },
    journeyEyebrow: { nl: "Kies een journey", en: "Choose a journey" },
    journeyKop: { nl: "Drie trajecten", en: "Three programmes" },
    journeyGroep: { nl: "Kies een journey", en: "Choose a journey" },
    caseEyebrow: { nl: "Casemodus", en: "Case mode" },
    caseKop: { nl: "Drie contexten", en: "Three contexts" },
    caseUitleg: {
      nl: "Een case zet het traject in een herkenbare situatie en kiest zelf de journey die daarbij hoort. Klik de case opnieuw aan om de context weer weg te nemen.",
      en: "A case places the programme in a recognisable situation and chooses the journey that belongs with it. Click the case again to remove the context.",
    },
    caseGroep: { nl: "Kies een casecontext", en: "Choose a case context" },
    caseContextKop: { nl: "Casecontext", en: "Case context" },
    vraagOpTafel: {
      nl: "De vraag op tafel:",
      en: "The question on the table:",
    },
    watHetOplevert: { nl: "Wat het oplevert:", en: "What it delivers:" },
    journeyLabel: { nl: "Journey", en: "Journey" },
    deelnemers: { nl: "Deelnemers", en: "Participants" },
    verloop: { nl: "Verloop", en: "Course" },
    outputs: { nl: "Outputs", en: "Outputs" },
    bewaking: { nl: "Bewaking", en: "Safeguards" },
    bewakingTekst: {
      nl: "Elk rapport draagt zijn versie, taal, datum en de vermelding wie het mag lezen. Individuele scores blijven bij de deelnemer en zijn begeleider.",
      en: "Every report carries its version, language, date and the statement of who may read it. Individual scores stay with the participant and their practitioner.",
    },
    vervolgactie: { nl: "Vervolgactie:", en: "Follow-up action:" },
    filmEyebrow: {
      nl: "Het platform aan het werk",
      en: "The platform at work",
    },
    filmKop: {
      nl: "Tachtig seconden door de omgeving",
      en: "Eighty seconds through the environment",
    },
    filmUitleg: {
      nl: "Van de uitnodiging tot het rapport, opgenomen in de echte omgeving. Wie liever leest: de trajecten en de outputs staan volledig uitgeschreven op hun eigen pagina.",
      en: "From the invitation to the report, recorded in the real environment. Whoever prefers to read: the programmes and the outputs are set out in full on their own page.",
    },
    geenFilm: {
      nl: "Uw browser kan deze film niet spelen. Het verloop van elk traject staat hierboven in tekst.",
      en: "Your browser cannot play this film. The course of every programme is set out in text above.",
    },
    onderschrift: {
      nl: "Gesproken uitleg in het Nederlands. Ondertitels zijn in de speler aan te zetten.",
      en: "Spoken explanation in Dutch. Subtitles can be switched on in the player.",
    },
    begeleideDemo: {
      nl: "Vraag een begeleide demo",
      en: "Request a guided demo",
    },
    naarTrajecten: { nl: "Bekijk de trajecten", en: "View the programmes" },
    naarOutputs: { nl: "Bekijk de outputs", en: "View the outputs" },
  },

  /** De trajectpagina Human Due Diligence. */
  hdd: {
    bovenschrift: {
      nl: "Traject voor investeerders en besturen",
      en: "Programme for investors and boards",
    },
    lead: {
      nl: "Bij een overname, een kapitaalronde of een herstructurering staan de cijfers meestal vast en blijft de vraag over de mensen open. Human Due Diligence brengt die vraag naar hetzelfde niveau als de rest van het dossier: wie draagt het plan, waar zitten de afhankelijkheden, en wat betekent dat voor de eerste honderd dagen na de beslissing. Het traject werkt in twee fasen, met een hard beslismoment ertussen: eerst een verkenning van de ploeg, en enkel wanneer die geen dysfunctionele signalen laat zien een diepteanalyse van de sleutelfiguren.",
      en: "In an acquisition, a funding round or a restructuring the numbers are usually settled and the question about the people stays open. Human Due Diligence brings that question to the same level as the rest of the file: who carries the plan, where the dependencies sit, and what that means for the first hundred days after the decision. The programme works in two phases, with a hard decision point in between: first an exploration of the team, and only when that shows no dysfunctional signals an in-depth analysis of the key individuals.",
    },
    trajectkop: {
      nl: "Twee fasen, met een hard beslismoment ertussen",
      en: "Two phases, with a hard decision point in between",
    },
    trajectuitleg: {
      nl: "Fase één kijkt naar de ploeg als geheel. Zijn er dysfunctionele signalen, dan stopt het traject daar. Blijven die uit, dan start fase twee, met als centrale vraag of deze ploeg de ambitie kan waarmaken.",
      en: "Phase one looks at the team as a whole. If there are dysfunctional signals, the programme stops there. If those are absent, phase two starts, with as its central question whether this team can deliver on the ambition.",
    },
    grenzen: {
      nl: [
        "Geen diagnose en geen uitspraak over de gezondheid van een persoon.",
        "Geen selectiebeslissing in de plaats van de opdrachtgever.",
        "Geen potentieelbepaling en geen voorspelling van toekomstige prestaties.",
        "Geen profiel zonder de toestemming en de terugkoppeling van de deelnemer zelf.",
        "Geen vaststelling over cognitieve capaciteit. Die laag is een indicatie op basis van zelfrapportage en wordt als indicatie benoemd.",
      ],
      en: [
        "No diagnosis and no statement on the health of a person.",
        "No selection decision in place of the client.",
        "No determination of potential and no prediction of future performance.",
        "No profile without the consent and the feedback of the participant.",
        "No finding on cognitive capacity. That layer is an indication based on self-report and is named as an indication.",
      ],
    },
    prijsuitleg: {
      nl: "Het tarief bevat de intake, de afname van alle deelnemers, het Go of No-Go-moment, de synthese, de oplevering van de twee rapporten en de mondelinge toelichting. De omvang van de ploeg bepaalt in welke schijf een dossier valt. De rapporten van dit traject zijn in het Engels opgesteld.",
      en: "The rate covers the intake, the assessment of all participants, the Go or No-Go point, the synthesis, the delivery of the two reports and the explanation in person. The size of the team determines which tier a file falls into. The reports of this programme are written in English.",
    },
    linktekst: {
      nl: "Bekijk Recruitment & Role Fit",
      en: "View Recruitment & Role Fit",
    },
    filmBovenschrift: {
      nl: "Het traject in beeld",
      en: "The programme in pictures",
    },
    filmKop: {
      nl: "Ruim een minuut over Human Due Diligence",
      en: "A little over a minute on Human Due Diligence",
    },
    filmUitleg: {
      nl: "Van de aanleiding tot de twee rapporten, met het beslismoment tussen de twee fasen. Wie liever leest: alles wat de film zegt staat hieronder ook uitgeschreven.",
      en: "From the trigger to the two reports, with the decision point between the two phases. Whoever prefers to read: everything the film says is also set out below.",
    },
    filmOnderschrift: {
      nl: "Gesproken uitleg in het Nederlands of in het Engels. Ondertitels zijn in de speler aan te zetten.",
      en: "Spoken explanation in Dutch or in English. Subtitles can be switched on in the player.",
    },
  },

  /** De trajectpagina Leadership & Team Energy. */
  lte: {
    bovenschrift: {
      nl: "Traject voor directies en teamleiders",
      en: "Programme for executive teams and team leaders",
    },
    lead: {
      nl: "Een ploeg die niet levert, heeft zelden een gebrek aan goede mensen. Meestal zit de rem in de samenstelling, in de verdeling van de last of in afspraken die nooit uitgesproken werden. Leadership & Team Energy maakt dat zichtbaar, brengt het in één begeleide sessie op tafel en meet na drie maanden of er werkelijk iets verschoven is.",
      en: "A team that does not deliver rarely lacks good people. The brake usually sits in the composition, in the division of the load or in agreements that were never spoken out loud. Leadership & Team Energy makes that visible, brings it to the table in one facilitated session and measures after three months whether something has genuinely shifted.",
    },
    grenzen: {
      nl: [
        "Geen beoordeling van medewerkers en geen invoer voor een evaluatiegesprek.",
        "Geen diagnose van welzijn of van gezondheid, ook niet wanneer de energie laag staat.",
        "Geen rangschikking van teamleden onderling.",
        "Geen ploegbeeld zonder dat elke deelnemer zijn eigen profiel eerst zelf leest.",
      ],
      en: [
        "No appraisal of employees and no input for a performance review.",
        "No diagnosis of wellbeing or of health, not even when energy is low.",
        "No ranking of team members against each other.",
        "No team picture without every participant reading their own profile first.",
      ],
    },
    prijsuitleg: {
      nl: "De afname per deelnemer, het ploegbeeld, de begeleide sessie en de herhaalmeting worden samen begroot. Organisaties die meerdere ploegen per jaar doorlopen, werken doorgaans met een jaarlicentie.",
      en: "The assessment per participant, the team picture, the facilitated session and the repeat measurement are budgeted together. Organisations that run several teams per year usually work with an annual licence.",
    },
    linktekst: {
      nl: "Bekijk Recruitment & Role Fit",
      en: "View Recruitment & Role Fit",
    },
    filmBovenschrift: {
      nl: "Het traject in beeld",
      en: "The programme in pictures",
    },
    filmKop: {
      nl: "Ruim een minuut over Leadership & Team Energy",
      en: "A little over a minute on Leadership & Team Energy",
    },
    filmUitleg: {
      nl: "Van de aanleiding tot het ploegbeeld en de herhaalmeting, in de stem van het platform. Wie liever leest: alles wat de film zegt staat in de ondertitels.",
      en: "From the trigger to the team picture and the repeat measurement, in the voice of the platform. Whoever prefers to read: everything the film says is in the subtitles.",
    },
    filmOnderschrift: {
      nl: "Gesproken uitleg in het Nederlands of in het Engels. Ondertitels zijn in de speler aan te zetten.",
      en: "Spoken explanation in Dutch or in English. Subtitles can be switched on in the player.",
    },
  },

  /** De trajectpagina Recruitment & Role Fit. */
  rrf: {
    bovenschrift: {
      nl: "Traject voor HR, recruiters en leidinggevenden",
      en: "Programme for HR, recruiters and managers",
    },
    lead: {
      nl: "Een cv vertelt vooral wat iemand deed. De vraag bij een aanwerving is een andere: waar komen kandidaat, rol en context werkelijk samen. Recruitment & Role Fit vertrekt daarom niet van de vacaturetekst alleen, maar van een rolprofiel dat de betrokkenen rond de functie samen opbouwen, en legt daarnaast wat een kandidaat van nature vlot afgaat, wat energie geeft of kost, en welke drivers betrokkenheid duurzaam of net kwetsbaar maken.",
      en: "A CV mainly tells what someone did. The question in a hiring decision is a different one: where candidate, role and context genuinely come together. Recruitment & Role Fit therefore does not start from the vacancy text alone, but from a role profile that those involved around the function build together, and places alongside it what comes naturally to a candidate, what gives or costs energy, and which drivers make engagement durable or precisely vulnerable.",
    },
    trajectkop: {
      nl: "Eerst de rol, dan de kandidaat",
      en: "First the role, then the candidate",
    },
    trajectuitleg: {
      nl: "Het rolprofiel komt eerst en wordt gedragen door de mensen rond de functie. Pas daarna wordt een kandidaatprofiel ernaast gelegd. Zo wordt de vergelijking gevoerd op wat de rol vraagt, en niet op de indruk van het laatste gesprek.",
      en: "The role profile comes first and is supported by the people around the function. Only after that is a candidate profile placed alongside it. The comparison is then made on what the role asks for, and not on the impression of the last interview.",
    },
    grenzen: {
      nl: [
        "Geen automatische selectie en geen rangschikking die de keuze in de plaats van de organisatie maakt.",
        "Geen vervanging van het selectiegesprek, van referentiecontrole of van vakinhoudelijke beoordeling.",
        "Geen diagnose, geen uitspraak over gezondheid en geen voorspelling van toekomstige prestaties.",
        "Geen profiel zonder de toestemming van de kandidaat en zonder terugkoppeling aan de kandidaat zelf.",
        "Geen uitspraak over ervaring, diploma's of technische bekwaamheid. Die blijven bij de opdrachtgever.",
      ],
      en: [
        "No automatic selection and no ranking that makes the choice in place of the organisation.",
        "No replacement of the selection interview, of reference checking or of professional assessment.",
        "No diagnosis, no statement on health and no prediction of future performance.",
        "No profile without the consent of the candidate and without feedback to the candidate.",
        "No statement on experience, qualifications or technical ability. Those stay with the client.",
      ],
    },
    prijsuitleg: {
      nl: "Het tarief per kandidaat bevat de afname, de vergelijkende studie en het fit-rapport. Het rolprofiel via de kring wordt eenmaal per rol begroot. Organisaties die meerdere rollen per jaar openzetten, werken doorgaans met bundels of een jaarvolume.",
      en: "The rate per candidate covers the assessment, the comparative study and the fit report. The role profile through the circle is budgeted once per role. Organisations that open several roles per year usually work with bundles or an annual volume.",
    },
    filmBovenschrift: {
      nl: "Het traject in beeld",
      en: "The programme in pictures",
    },
    filmKop: {
      nl: "Ruim een minuut over Recruitment & Role Fit",
      en: "A little over a minute on Recruitment & Role Fit",
    },
    filmUitleg: {
      nl: "Van de vacature tot het besluit, met de vier bouwstenen van de match ertussen. Wie liever leest: alles wat de film zegt staat in de ondertitels.",
      en: "From the vacancy to the decision, with the four building blocks of the match in between. Whoever prefers to read: everything the film says is in the subtitles.",
    },
    filmOnderschrift: {
      nl: "Gesproken uitleg in het Nederlands of in het Engels. Ondertitels zijn in de speler aan te zetten.",
      en: "Spoken explanation in Dutch or in English. Subtitles can be switched on in the player.",
    },
  },
} as const satisfies Record<string, Record<string, Koppel>>;

export default T;
