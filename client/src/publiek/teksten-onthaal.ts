// ===========================================================================
// publiek/teksten-onthaal.ts: de tweetalige teksten van de onthaalpagina.
//
// WAAROM DIT BESTAND BESTAAT
// De onthaalpagina is de voordeur van een internationaal aanbod. Wie hier voor
// het eerst binnenkomt, leest daarom Engels; Nederlands staat één knop ver, via
// publiek/taal.tsx. De pagina mag daarvoor niet zelf twee verhalen dragen: elke
// zichtbare tekst staat hier één keer, in beide talen, en de pagina kiest met
// kies(...) welk lid ze toont.
//
// WAT HIER NIET STAAT
// De inhoud die ook op andere publieke pagina's verschijnt: de navigatie, de
// clusters en de outputstapel. Die komt uit publiek/inhoud.ts, dat per taal de
// juiste lijst teruggeeft. Hier staat uitsluitend de tekst die eigen is aan de
// onthaalpagina.
//
// HET NEDERLANDS IS ONGEWIJZIGD
// De Nederlandse leden zijn woordelijk de teksten die vóór de tweetaligheid in
// onthaal.tsx stonden. Wie het Nederlands wil bijwerken, doet dat hier, en
// nergens anders.
//
// MACHINEWAARDEN
// Paden, id's, testid's en de waarden van de keuzelijst blijven buiten dit
// bestand of staan er als één enkele string. De rollen in het formulier zijn
// een tweetalig opschrift bovenop een ONGEWIJZIGDE Nederlandse waarde: de
// server ontvangt in beide talen exact dezelfde string.
// ===========================================================================

import type { Tweetalig } from "@/publiek/taal";

/** Een tak van de catalogus: een tweetalig paar of een groep paren. */
type Tak = Tweetalig | { readonly [sleutel: string]: Tak };

/**
 * De categorieclaim. Ze staat in BEIDE talen in het Engels: het is een
 * merkregel, geen lopende tekst, en ze luidt woordelijk zoals in het
 * strategisch dossier.
 */
export const CATEGORIECLAIM =
  "Tapas CORE is the talent operating system for passion-driven performance.";

/**
 * De zakelijker variant van de claim, voor grotere accounts. Woordelijk zoals
 * in het strategisch dossier, met "organisations" in dezelfde Britse spelling
 * als de rest van de Engelse laag en als de Engelse films.
 */
export const CATEGORIECLAIM_ZAKELIJK =
  "Tapas CORE helps organisations turn human potential, motivation and team energy into measurable talent decisions.";

export const T = {
  kop: {
    merkOnder: {
      nl: "de beslislaag voor talentbeslissingen",
      en: "the decision layer for talent decisions",
    },
    navLabel: { nl: "Hoofdnavigatie", en: "Main navigation" },
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

  hero: {
    eyebrow: {
      nl: "De beslislaag voor talentbeslissingen",
      en: "The decision layer for talent decisions",
    },
    belofteKop: {
      nl: "Tapas CORE helpt organisaties",
      en: "Tapas CORE helps organisations make",
    },
    belofteKern: {
      nl: "betere talentbeslissingen",
      en: "better talent decisions",
    },
    belofteStaart: { nl: " nemen.", en: "." },
    toon: {
      nl: "Wie investeert, herstructureert of een ploeg samenstelt, beslist over mensen. Tapas CORE brengt talent, drivers en energie in beeld op het niveau waarop die beslissing valt, en levert rapporten die op een bestuurstafel kunnen liggen.",
      en: "Anyone who invests, restructures or composes a team is deciding about people. Tapas CORE makes talent, drivers and energy visible at the level where that decision is taken, and delivers reports that can lie on a board table.",
    },
    naarOplossingen: {
      nl: "Bekijk de oplossingen",
      en: "View the solutions",
    },
    naarWerking: {
      nl: "Bekijk eerst hoe het werkt",
      en: "See how it works first",
    },
    wedgeKop: {
      nl: "Waar wij het scherpst staan",
      en: "Where we are sharpest",
    },
  },

  ingangen: {
    eyebrow: { nl: "Zakelijke ingangen", en: "Business entry points" },
    titel: {
      nl: "Welke beslissing ligt bij u op tafel?",
      en: "Which decision is on your table?",
    },
    tekst: {
      nl: "Tapas CORE vertrekt van de beslissing en niet van een vragenlijst. Vier ingangen dekken het grootste deel van de vragen die organisaties ons stellen. Het zijn geen losse instrumenten maar vier beslismomenten op dezelfde motor.",
      en: "Tapas CORE starts from the decision and not from a questionnaire. Four entry points cover most of the questions organisations put to us. They are not separate instruments but four decision moments on the same engine.",
    },
    verderTraject: { nl: "Bekijk het traject", en: "View the programme" },
    verderOplossingen: {
      nl: "Bekijk de oplossingen",
      en: "View the solutions",
    },
  },

  outputs: {
    eyebrow: { nl: "Wat u krijgt", en: "What you receive" },
    titel: {
      nl: "Vier rapporten, elk met één lezer",
      en: "Four reports, each with one reader",
    },
    tekst: {
      nl: "Een rapport zonder lezer helpt niemand vooruit. Daarom levert het platform vier lagen, van het profiel van de deelnemer tot één rapport voor wie de beslissing neemt.",
      en: "A report without a reader helps nobody forward. The platform therefore delivers four layers, from the profile of the participant to one report for the person who takes the decision.",
    },
    voor: { nl: "Voor ", en: "For " },
    noot: {
      nl: "Elk rapport draagt zijn versie, taal, datum en de vermelding wie het mag lezen.",
      en: "Every report carries its version, language, date and the note on who may read it.",
    },
    nootLink: {
      nl: "Bekijk de volledige opbouw van de outputs",
      en: "View the full structure of the outputs",
    },
  },

  werking: {
    eyebrow: { nl: "Hoe het werkt", en: "How it works" },
    titel: {
      nl: "Van uitnodiging tot verdieping, in vier stappen",
      en: "From invitation to depth, in four steps",
    },
    zinKop: {
      nl: "Wat het is, in één zin.",
      en: "What it is, in one sentence.",
    },
    zinTekst: {
      nl: "Tapas CORE brengt het menselijke deel van een beslissing in beeld: welk talent er zit, wat mensen in beweging brengt en waar de energie wegloopt. Dat komt op tafel als een rapport waarop een leidinggevende, een bestuur of een investeerder kan handelen.",
      en: "Tapas CORE makes the human part of a decision visible: which talent is present, what sets people in motion and where the energy drains away. That arrives on the table as a report on which a manager, a board or an investor can act.",
    },
    filmVoor: {
      nl: "Wilt u het platform zien werken? In de",
      en: "Would you like to see the platform at work? In the",
    },
    filmLink: { nl: "demo-omgeving", en: "demo environment" },
    filmNa: {
      nl: " staat een film van tachtig seconden, met gesproken uitleg en ondertitels.",
      en: " there is a film of eighty seconds, with spoken commentary and subtitles.",
    },
    stap1nr: { nl: "STAP 01", en: "STEP 01" },
    stap1titel: { nl: "Uitnodiging", en: "Invitation" },
    stap1tekst: {
      nl: "U kiest een instrument en stuurt een uitnodiging naar de deelnemer.",
      en: "You choose an instrument and send an invitation to the participant.",
    },
    stap2nr: { nl: "STAP 02", en: "STEP 02" },
    stap2titel: { nl: "Afname", en: "Assessment" },
    stap2tekst: {
      nl: "De deelnemer vult de vragenlijst in, in zijn eigen taal, op eigen tempo.",
      en: "The participant completes the questionnaire, in their own language, at their own pace.",
    },
    stap3nr: { nl: "STAP 03", en: "STEP 03" },
    stap3titel: { nl: "Rapport", en: "Report" },
    stap3tekst: {
      nl: "Het rapport komt automatisch klaar, als PDF en als online dashboard.",
      en: "The report is produced automatically, as a PDF and as an online dashboard.",
    },
    stap4nr: { nl: "STAP 04", en: "STEP 04" },
    stap4titel: { nl: "Verdieping", en: "Depth" },
    stap4tekst: {
      nl: "Het rapport op uw dashboard geeft u de grote lijn: waar uw talent zit en wat u in beweging brengt. Wilt u werkelijk de diepte in, dan hebt u een geaccrediteerde coach met licentie nodig.",
      en: "The report on your dashboard gives you the broad picture: where your talent sits and what sets you in motion. To go genuinely deeper, you need an accredited coach with a licence.",
    },
    zonderCoach: { nl: "Zonder coach", en: "Without a coach" },
    zonderCoachTitel: {
      nl: "Wat u zelf kunt",
      en: "What you can do yourself",
    },
    zonderCoachTekst: {
      nl: "U schaft een vragenlijst aan, vult ze in en krijgt op uw dashboard een eerste rapport op hoofdlijnen. Dat rapport is van u, u hebt niemand nodig om het te openen of te lezen.",
      en: "You purchase a questionnaire, complete it and receive a first report on broad lines on your dashboard. That report is yours, and you need nobody to open it or to read it.",
    },
    metCoach: { nl: "Met coach", en: "With a coach" },
    metCoachTitel: {
      nl: "Waar de verdieping begint",
      en: "Where the depth begins",
    },
    metCoachTekst: {
      nl: "Wilt u van hoofdlijn naar betekenis, wat uw profiel zegt over een keuze die voor u ligt en hoe uw drivers zich in uw eigen situatie gedragen, dan reikt u uit naar een coach die geaccrediteerd is en over een licentie beschikt. Die stap is bewust geen knop op deze pagina: hij vraagt een mens.",
      en: "To move from broad lines to meaning, what your profile says about a choice ahead of you and how your drivers behave in your own situation, you reach out to a coach who is accredited and holds a licence. That step is deliberately not a button on this page: it asks for a person.",
    },
  },

  breedte: {
    eyebrow: { nl: "Breedte als bewijs", en: "Breadth as evidence" },
    titel: {
      nl: "Eén motor, zestien instrumenten, vijf talen",
      en: "One engine, sixteen instruments, five languages",
    },
    tekst: {
      nl: "De trajecten hierboven rusten op een instrumentarium dat al jaren in organisaties, scholen en sportclubs loopt. Die breedte is geen catalogus om uit te kiezen, ze is het bewijs dat de motor het aankan.",
      en: "The programmes above rest on a toolkit that has been running for years in organisations, schools and sports clubs. That breadth is not a catalogue to choose from, it is the evidence that the engine can carry the load.",
    },
    feit1: {
      nl: "instrumenten en modules in het register",
      en: "instruments and modules in the register",
    },
    feit2: { nl: "vanaf 10 jaar", en: "from age 10" },
    feit3: {
      nl: "talen voor de vragenlijst en het rapport",
      en: "languages for the questionnaire and the report",
    },
    feit4: { nl: "rapport: PDF én online", en: "report: PDF and online" },
  },

  namen: {
    eyebrow: { nl: "Drie namen", en: "Three names" },
    titel: {
      nl: "TaPas, TaPasCity en Tapas CORE",
      en: "TaPas, TaPasCity and Tapas CORE",
    },
    tekst: {
      nl: "Ze horen bij elkaar, maar elk met een eigen focus. In één oogopslag:",
      en: "They belong together, each with a focus of its own. At a glance:",
    },
    rolGedachtegoed: { nl: "het gedachtegoed", en: "the body of thought" },
    rolOrganisatie: { nl: "de organisatie", en: "the organisation" },
    rolPlatform: { nl: "dit platform", en: "this platform" },
    tapasVoor: {
      nl: "TAPAS is de samentrekking van ",
      en: "TAPAS is the contraction of ",
    },
    tapasMidden: { nl: "lent en ", en: "lent and " },
    tapasNa: {
      nl: "sie. Talent is het unieke vermogen om dingen sneller, beter en met minder inspanning te doen dan anderen. Passie is de energiebron die je talent in beweging houdt.",
      en: "sion. Talent is the unique ability to do things faster, better and with less effort than others. Passion is the energy source that keeps your talent in motion.",
    },
    stadTekst: {
      nl: "De organisatie achter het gedachtegoed, en een gemeenschap van zelfstandige coaches, de crewmembers, die met het instrumentarium werken. Gevestigd in Wijnegem.",
      en: "The organisation behind the body of thought, and a community of independent coaches, the crewmembers, who work with the toolkit. Based in Wijnegem.",
    },
    coreTekst: {
      nl: "De zakelijke kern: instrumenten uitsturen, de afname opvolgen van uitnodiging tot PDF, facturatie via credits, en het dashboard van de deelnemer.",
      en: "The business core: sending out instruments, following the assessment from invitation to PDF, invoicing through credits, and the dashboard of the participant.",
    },
  },

  voorwie: {
    eyebrow: { nl: "Voor wie", en: "For whom" },
    titel: { nl: "Waarvoor bent u hier?", en: "What brings you here?" },
    tekst: {
      nl: "Vijf soorten bezoekers, vijf verschillende vragen. Kies de uwe, dan weet u meteen wat u hier kunt halen.",
      en: "Five kinds of visitor, five different questions. Choose yours, and you know at once what there is to gain here.",
    },
    lijstKop: { nl: "Wat er voor u in zit", en: "What is in it for you" },
    zelfTag: { nl: "Uzelf", en: "Yourself" },
    zelfTitel: {
      nl: "Weten waar uw eigen talent zit",
      en: "Knowing where your own talent sits",
    },
    zelfWil: {
      nl: "“Welke talenten brengen me in een energie-flow? […] Welke context sluit het best aan bij mijn potentieel en bij wie ik ben?”",
      en: "“Which talents bring me into an energy flow? […] Which context fits my potential and who I am best?”",
    },
    zelfLijst: {
      nl: "Een eigen profiel als PDF én online dashboard. Voor de professional het T4P Business Kompas, voor de student T4Students, voor de leerling T4Teens, en 2MinScan als korte eerste kennismaking. Deze vier schaft u zelf aan, zonder tussenkomst van een organisatie of een coach.",
      en: "A profile of your own as a PDF and an online dashboard. For the professional the T4P Business Kompas, for the student T4Students, for the pupil T4Teens, and 2MinScan as a short first introduction. You purchase these four yourself, without an organisation or a coach in between.",
    },
    zelfKnop: { nl: "Bekijk de instrumenten", en: "View the instruments" },
    orgTag: { nl: "Organisatie", en: "Organisation" },
    orgTitel: {
      nl: "Zicht op talent en energie in uw organisatie",
      en: "A view of talent and energy in your organisation",
    },
    orgWil: {
      nl: "“Je wil zicht krijgen op de talenten en passie van je organisatie, los van de individuele talenten van de medewerkers.”",
      en: "“You want a view of the talents and passion of your organisation, apart from the individual talents of the employees.”",
    },
    orgLijst: {
      nl: "T4P Business Kompas · T4Organizations · TaPas Teamscan · Impact-roos · T4Recruitment · Human Due Diligence · 2MinScan",
      en: "T4P Business Kompas · T4Organizations · TaPas Teamscan · Impact-roos · T4Recruitment · Human Due Diligence · 2MinScan",
    },
    onderwijsTag: { nl: "Onderwijs", en: "Education" },
    onderwijsTitel: {
      nl: "Vertrekken van wat een jongere wél kan",
      en: "Starting from what a young person can do",
    },
    onderwijsWil: {
      nl: "“We willen talenten en passie van kinderen, jongeren en jongvolwassenen in kaart brengen om te kunnen vertrekken van wat ze wel kunnen.”",
      en: "“We want to map the talents and passion of children, young people and young adults so that we can start from what they can do.”",
    },
    onderwijsLijst: {
      nl: "T4Teens · T4Students · T4Kids",
      en: "T4Teens · T4Students · T4Kids",
    },
    onderwijsKnop: {
      nl: "Vraag het schoolaanbod",
      en: "Request the school offer",
    },
    sportTag: { nl: "Sport", en: "Sport" },
    sportTitel: {
      nl: "Mentaal talent onder prestatiedruk",
      en: "Mental talent under performance pressure",
    },
    sportWil: {
      nl: "“Waar ligt mijn mentaal talent als atleet? Welke drivers werken onder prestatiedruk? Hoe versterk ik veerkracht, flow en atletische identiteit?”",
      en: "“Where does my mental talent as an athlete lie? Which drivers work under performance pressure? How do I strengthen resilience, flow and athletic identity?”",
    },
    sportLijst: {
      nl: "T4Sports geeft een volledig Mental Talent Profiel (deel 1 en 2), met de modules Resilience, Flow-State en Atletische Identiteit. Voor topsporters, mental coaches en sportpsychologen.",
      en: "T4Sports gives a full Mental Talent Profile (parts 1 and 2), with the modules Resilience, Flow-State and Athletic Identity. For elite athletes, mental coaches and sport psychologists.",
    },
    sportKnop: { nl: "Vraag het sportaanbod", en: "Request the sports offer" },
    coachTag: { nl: "Coach & practitioner", en: "Coach & practitioner" },
    coachTitel: {
      nl: "Zelf met het instrumentarium werken",
      en: "Working with the toolkit yourself",
    },
    coachWil: {
      nl: "“Wie zelf als Tapas practitioner, coach of facilitator aan de slag wil.”",
      en: "“For those who want to work as a Tapas practitioner, coach or facilitator themselves.”",
    },
    coachLijst: {
      nl: "Toegang tot het volledige instrumentarium na accreditatie, plus de Self-Training Module, het zelfstudieplatform dat bij het accreditatietraject hoort.",
      en: "Access to the full toolkit after accreditation, plus the Self-Training Module, the self-study platform that belongs to the accreditation programme.",
    },
    coachKnop: { nl: "Vraag toegang aan", en: "Request access" },
  },

  oplevert: {
    eyebrow: { nl: "Wat het oplevert", en: "What it delivers" },
    titel: {
      nl: "Een instrument is zo goed als de vragen die het beantwoordt",
      en: "An instrument is as good as the questions it answers",
    },
    tekst: {
      nl: "Daarom staan hier geen beloftes, maar de vragen waarop een deelnemer na de afname een antwoord heeft, en wat er precies uit komt.",
      en: "So there are no promises here, but the questions a participant can answer after the assessment, and precisely what comes out.",
    },
    ukrijgt: { nl: "U krijgt:", en: "You receive:" },
    kompasVraag: {
      nl: "“Welke talenten brengen me in een energie-flow? Welke drivers zijn ondersteunend of remmend? Welke context sluit het best aan bij mijn potentieel en bij wie ik ben?”",
      en: "“Which talents bring me into an energy flow? Which drivers support me and which hold me back? Which context fits my potential and who I am best?”",
    },
    kompasUit: {
      nl: "een rijk TaPas Kompas-rapport met talent-foci, versnellers, drivers, energieprofiel én TaPas Jester-classificatie, als PDF én online dashboard.",
      en: "a rich TaPas Kompas report with talent foci, accelerators, drivers, energy profile and TaPas Jester classification, as a PDF and an online dashboard.",
    },
    teamVraag: {
      nl: "“Hoe werkt ons team echt samen? Waar zit vertrouwen, en waar wringt het? Welke disfuncties spelen, en hoe adresseren we ze concreet?”",
      en: "“How does our team really work together? Where is there trust, and where does it chafe? Which dysfunctions are at play, and how do we address them concretely?”",
    },
    teamUit: {
      nl: "een collectief teamrapport met sterktes, spanningsvelden en concrete actiepunten, plus een facilitatiegids voor de teamcoach.",
      en: "a collective team report with strengths, areas of tension and concrete action points, plus a facilitation guide for the team coach.",
    },
    teensVraag: {
      nl: "“Waar liggen mijn talenten als jongere? Welke studierichting past bij wie ik ben? Wat geeft mij energie op school en daarbuiten?”",
      en: "“Where do my talents lie as a young person? Which field of study fits who I am? What gives me energy at school and beyond?”",
    },
    teensUit: {
      nl: "een T4Teens talentkaart in jongerentaal, met studierichtingssuggesties op basis van de talent-foci.",
      en: "a T4Teens talent card in the language of young people, with suggestions for fields of study based on the talent foci.",
    },
  },

  grenzen: {
    eyebrow: { nl: "Onderbouwing en grenzen", en: "Evidence and limits" },
    titel: {
      nl: "Wat wij wél kunnen aantonen, en waar het ophoudt",
      en: "What we can demonstrate, and where it stops",
    },
    tekst: {
      nl: "Beide horen op deze pagina. Een instrument dat zijn eigen grenzen niet benoemt, is niet te vertrouwen.",
      en: "Both belong on this page. An instrument that does not name its own limits cannot be trusted.",
    },
    cijfer: { nl: "96,9\u2009%", en: "96.9\u2009%" },
    cijferTitel: {
      nl: "van 64 wetenschappelijke verwijzingen correct",
      en: "of 64 scientific references correct",
    },
    cijferTekst: {
      nl: "Een systematische scan van het onderliggende kader identificeerde 64 wetenschappelijke auteurs en theorieën. Daarvan bleek 96,9\u2009% feitelijk en inhoudelijk correct weergegeven. Geen enkele verwijzing was onjuist; één (GRIT) werd genuanceerd wegens recente meta-analyses.",
      en: "A systematic scan of the underlying framework identified 64 scientific authors and theories. Of those, 96.9\u2009% proved factually and substantively correct. Not a single reference was wrong; one (GRIT) was qualified because of recent meta-analyses.",
    },
    beperkingKop: {
      nl: "En dit hoort er eerlijk bij.",
      en: "And this belongs to the picture.",
    },
    beperkingTekst: {
      nl: "Die review werd AI-ondersteund uitgevoerd, niet als peer review. Het rapport noemt het kader zelf “theoretisch goed onderbouwd en psychometrisch veelbelovend, waarvoor verdere peer-reviewed validatie wenselijk is”. Er bestaat samenwerking met academische partners, maar niet alle resultaten zijn al gepubliceerd.",
      en: "That review was carried out with AI support, not as a peer review. The report itself calls the framework “theoretically well founded and psychometrically promising, with further peer-reviewed validation desirable”. There is collaboration with academic partners, but not all results have been published.",
    },
    nietTitel: { nl: "Wat TaPas niet is", en: "What TaPas is not" },
    nietTekst: {
      nl: "TaPas is een reflectie- en ontwikkelinstrument. Wat het oplevert is een gespreksbasis, geen oordeel over iemands toekomst.",
      en: "TaPas is a reflection and development instrument. What it delivers is a basis for conversation, not a judgement about the future of a person.",
    },
    geenDiagnose: { nl: "Geen diagnose", en: "No diagnosis" },
    geenSelectie: {
      nl: "Geen selectiebeslissing",
      en: "No selection decision",
    },
    geenPotentieel: {
      nl: "Geen potentieelbepaling",
      en: "No potential rating",
    },
    grensNoot: {
      nl: "Diezelfde grens staat onderaan elke pagina van het platform en in de voettekst van elk rapport. Ze is geen kleine letter, ze is de afspraak.",
      en: "That same limit stands at the foot of every page of the platform and in the footer of every report. It is not fine print, it is the agreement.",
    },
  },

  deuren: {
    eyebrow: {
      nl: "Voor wie het platform al gebruikt",
      en: "For those already using the platform",
    },
    titel: { nl: "Vijf deuren, één platform", en: "Five doors, one platform" },
    tekst: {
      nl: "Wie al een plaats in het platform heeft, hoort geen formulier te moeten invullen: die gaat rechtstreeks naar de eigen deur. Wie nog geen plaats heeft, komt bij het contactformulier uit.",
      en: "Anyone who already has a place in the platform should not have to fill in a form: they go straight to their own door. Anyone without a place yet arrives at the contact form.",
    },
    nodigKop: { nl: "Nodig:", en: "Required:" },
    deelnemerDr: { nl: "Deelnemer", en: "Participant" },
    deelnemerTitel: {
      nl: "Ik kreeg een uitnodiging",
      en: "I received an invitation",
    },
    deelnemerTekst: {
      nl: "Uw eigen ruimte: de vragenlijsten die voor u klaarstaan, uw afgewerkte afnames en uw rapporten, in PDF en online.",
      en: "Your own space: the questionnaires waiting for you, your completed assessments and your reports, in PDF and online.",
    },
    deelnemerStap1: {
      nl: "U vult het e-mailadres in waarop u de uitnodiging kreeg.",
      en: "You fill in the email address at which you received the invitation.",
    },
    deelnemerStap2: {
      nl: "Wij sturen een aanmeldlink naar dat adres.",
      en: "We send a sign-in link to that address.",
    },
    deelnemerStap3: {
      nl: "U klikt de link aan en staat in uw eigen dashboard.",
      en: "You click the link and you are in your own dashboard.",
    },
    deelnemerNodig: {
      nl: "uw e-mailadres. Geen wachtwoord.",
      en: "your email address. No password.",
    },
    coachDr: { nl: "Coach & practitioner", en: "Coach & practitioner" },
    coachTitel: {
      nl: "Ik werk met het instrumentarium",
      en: "I work with the toolkit",
    },
    coachTekst: {
      nl: "Uw praktijk: deelnemers uitnodigen, afnames opvolgen, rapporten opmaken en gesprekken voorbereiden.",
      en: "Your practice: inviting participants, following assessments, producing reports and preparing conversations.",
    },
    coachStap1: {
      nl: "U meldt zich aan met uw coach-account.",
      en: "You sign in with your coach account.",
    },
    coachStap2: {
      nl: "U ziet uw deelnemers en hun afnames.",
      en: "You see your participants and their assessments.",
    },
    coachStap3: {
      nl: "Tijdens het accreditatietraject staat de Self-Training Module erbij.",
      en: "During the accreditation programme the Self-Training Module is included.",
    },
    coachNodig: {
      nl: "een coach-account. Nog geen account? Vraag toegang via het formulier onderaan deze pagina.",
      en: "a coach account. No account yet? Request access through the form at the foot of this page.",
    },
    orgDr: { nl: "Organisatie of school", en: "Organisation or school" },
    orgTitel: { nl: "Ik beheer een groep", en: "I manage a group" },
    orgTekst: {
      nl: "Uw overzicht: wie is uitgenodigd, wie is klaar, welke rapporten liggen er, en hoeveel credits staan er nog.",
      en: "Your overview: who is invited, who is finished, which reports are ready, and how many credits remain.",
    },
    orgStap1: {
      nl: "U meldt zich aan met het organisatie-account.",
      en: "You sign in with the organisation account.",
    },
    orgStap2: {
      nl: "U nodigt medewerkers of leerlingen uit.",
      en: "You invite employees or pupils.",
    },
    orgStap3: {
      nl: "U volgt de voortgang en haalt de rapporten op.",
      en: "You follow the progress and collect the reports.",
    },
    orgNodig: {
      nl: "een organisatie-account, aangemaakt bij de opstart.",
      en: "an organisation account, created at the start.",
    },
    kijkDr: { nl: "Eerst rondkijken", en: "Looking around first" },
    kijkTitel: { nl: "Ik wil het aanbod zien", en: "I want to see the offer" },
    kijkTekst: {
      nl: "De publieke gids: per instrument welke vraag het beantwoordt, voor wie het bedoeld is, hoe lang het duurt en wat er uit komt.",
      en: "The public guide: for each instrument which question it answers, who it is meant for, how long it takes and what comes out.",
    },
    kijkStap1: {
      nl: "U kiest een doelgroep of een vraag.",
      en: "You choose an audience or a question.",
    },
    kijkStap2: {
      nl: "U leest de fiche van het instrument.",
      en: "You read the fact sheet of the instrument.",
    },
    kijkStap3: {
      nl: "Wilt u meer weten, dan brengt de gids u bij het formulier.",
      en: "If you want to know more, the guide brings you to the form.",
    },
    kijkNodig: {
      nl: "niets. Geen aanmelding, geen account.",
      en: "nothing. No sign-in, no account.",
    },
    nieuwDr: { nl: "Nog geen plaats", en: "No place yet" },
    nieuwTitel: {
      nl: "Ik wil kennismaken",
      en: "I would like an introduction",
    },
    nieuwTekst: {
      nl: "Geen account, geen uitnodiging? Dan is het formulier hieronder de juiste weg. U krijgt antwoord van een Tapas-medewerker, geen automatisch traject.",
      en: "No account, no invitation? Then the form below is the right way. You receive an answer from a Tapas staff member, not an automated sequence.",
    },
    nieuwStap1: {
      nl: "U vertelt kort wie u bent en wat u zoekt.",
      en: "You tell us briefly who you are and what you are looking for.",
    },
    nieuwStap2: {
      nl: "Wij lezen dat na en antwoorden persoonlijk.",
      en: "We read it and answer personally.",
    },
    nieuwStap3: {
      nl: "Past het, dan volgt een gesprek van een halfuur.",
      en: "If it fits, a conversation of half an hour follows.",
    },
    nieuwNodig: {
      nl: "uw naam en een e-mailadres.",
      en: "your name and an email address.",
    },
    nieuwPad: { nl: "het formulier hieronder", en: "the form below" },
  },

  veilig: {
    vk: {
      nl: "De deelnemersdeur, stap voor stap",
      en: "The participant door, step by step",
    },
    titel: {
      nl: "Een aanmeldlink in plaats van een wachtwoord",
      en: "A sign-in link instead of a password",
    },
    tekst: {
      nl: "Deelnemers hebben geen wachtwoord. Dat is een bewuste keuze: een wachtwoord dat je één keer per jaar nodig hebt, wordt opgeschreven of vergeten. In de plaats komt een link die naar de eigen mailbox gaat. Wie die mailbox niet kan openen, komt niet binnen.",
      en: "Participants have no password. That is a deliberate choice: a password you need once a year gets written down or forgotten. In its place comes a link that goes to the mailbox of the participant. Anyone who cannot open that mailbox does not get in.",
    },
    stap1nr: { nl: "Stap 1", en: "Step 1" },
    stap1t: {
      nl: "U vult uw e-mailadres in",
      en: "You fill in your email address",
    },
    stap1b: {
      nl: "Hetzelfde adres waarop u de uitnodiging kreeg. Verder niets.",
      en: "The same address at which you received the invitation. Nothing else.",
    },
    stap2nr: { nl: "Stap 2", en: "Step 2" },
    stap2t: { nl: "Wij sturen een link", en: "We send a link" },
    stap2b: {
      nl: "Alleen naar dat adres. Kent het platform het adres niet, dan wordt er niets verstuurd, en ziet u toch dezelfde boodschap.",
      en: "Only to that address. If the platform does not know the address, nothing is sent, and you still see the same message.",
    },
    stap3nr: { nl: "Stap 3", en: "Step 3" },
    stap3t: { nl: "U klikt de link aan", en: "You click the link" },
    stap3b: {
      nl: "Binnen een kwartier. De link werkt één keer en vervalt daarna.",
      en: "Within fifteen minutes. The link works once and expires after that.",
    },
    stap4nr: { nl: "Stap 4", en: "Step 4" },
    stap4t: {
      nl: "U staat in uw dashboard",
      en: "You are in your dashboard",
    },
    stap4b: {
      nl: "Uw afnames, uw rapporten, uw gesproken uitleg. Niemand anders ziet die.",
      en: "Your assessments, your reports, your spoken commentary. Nobody else sees them.",
    },
    waarborg1: {
      nl: "De link is 15 minuten geldig en werkt precies één keer.",
      en: "The link is valid for 15 minutes and works exactly once.",
    },
    waarborg2: {
      nl: "Het adres invullen maakt géén account aan: alleen wie al een plaats heeft, krijgt een link.",
      en: "Filling in the address does not create an account: only someone who already has a place receives a link.",
    },
    waarborg3: {
      nl: "De pagina geeft altijd dezelfde boodschap, ook bij een onbekend adres, zodat niemand kan aftasten wie er in het platform staat.",
      en: "The page always gives the same message, also for an unknown address, so that nobody can probe who is in the platform.",
    },
    waarborg4: {
      nl: "De link zelf staat nooit in het antwoord van de pagina: hij gaat uitsluitend naar de mailbox.",
      en: "The link itself never appears in the answer of the page: it goes to the mailbox only.",
    },
  },

  contact: {
    eyebrow: { nl: "Contact", en: "Contact" },
    titel: {
      nl: "Eén gesprek is genoeg om te weten of dit iets voor u is",
      en: "One conversation is enough to know whether this is for you",
    },
    lead: {
      nl: "Laat weten wie u bent en wat u zoekt. Geen verkooppraatje, geen automatisch traject.",
      en: "Let us know who you are and what you are looking for. No sales pitch, no automated sequence.",
    },
    labelNaam: { nl: "Naam", en: "Name" },
    plaatsNaam: { nl: "Voor- en achternaam", en: "First name and surname" },
    labelOrg: { nl: "Organisatie of school", en: "Organisation or school" },
    plaatsOrg: {
      nl: "Naam van uw organisatie",
      en: "Name of your organisation",
    },
    labelEmail: { nl: "E-mail", en: "Email" },
    plaatsEmail: { nl: "u@voorbeeld.be", en: "you@example.com" },
    labelRol: { nl: "Ik ben", en: "I am" },
    labelVraag: { nl: "Uw vraag", en: "Your question" },
    plaatsVraag: {
      nl: "Wat wilt u bereiken, en voor hoeveel mensen?",
      en: "What would you like to achieve, and for how many people?",
    },
    verstuurBezig: { nl: "Bezig met versturen", en: "Sending" },
    verstuur: { nl: "Verstuur mijn vraag", en: "Send my question" },
    naDefault: {
      nl: "U krijgt binnen twee werkdagen antwoord van een Tapas-medewerker.",
      en: "You receive an answer from a Tapas staff member within two working days.",
    },
    foutLeeg: {
      nl: "Vul uw naam en uw e-mailadres in, dan kunnen wij antwoorden.",
      en: "Fill in your name and your email address, so that we can answer.",
    },
    gelukt: {
      nl: "Uw vraag is aangekomen. U krijgt binnen twee werkdagen antwoord van een Tapas-medewerker.",
      en: "Your question has arrived. You receive an answer from a Tapas staff member within two working days.",
    },
    foutVersturen: {
      nl: "Het versturen lukte niet. Stuur uw vraag naar info@tapascity.com, dan komt ze zeker aan.",
      en: "Sending did not succeed. Send your question to info@tapascity.com and it will certainly arrive.",
    },
    blokDirect: { nl: "Rechtstreeks", en: "Direct" },
    linkedin: { nl: "TaPasCity op LinkedIn", en: "TaPasCity on LinkedIn" },
    blokKost: { nl: "Wat het kost", en: "What it costs" },
    kostZelfKop: { nl: "Voor uzelf.", en: "For yourself." },
    kostZelf: {
      nl: "De instrumenten die u zelf kunt aanschaffen, staan in het instrumentenoverzicht. U kiest er een, u ziet het bedrag voor u betaalt, en u start. Geen gesprek nodig.",
      en: "The instruments you can purchase yourself are listed in the instrument overview. You choose one, you see the amount before you pay, and you start. No conversation needed.",
    },
    kostOrgKop: {
      nl: "Voor een organisatie of een school.",
      en: "For an organisation or a school.",
    },
    kostOrg: {
      nl: "Daar werkt het platform met credits per afname. De prijs hangt af van het volume en van het instrument, en u krijgt een concreet voorstel na het gesprek.",
      en: "There the platform works with credits per assessment. The price depends on the volume and on the instrument, and you receive a concrete proposal after the conversation.",
    },
    blokUitnodiging: {
      nl: "Al een uitnodiging gekregen?",
      en: "Already received an invitation?",
    },
    uitnodigingTekst: {
      nl: "Dan hoeft u hier niets te vragen. Meld u aan met het e-mailadres waarop u de uitnodiging kreeg, u krijgt dan een aanmeldlink die 15 minuten geldig blijft.",
      en: "Then there is nothing to ask here. Sign in with the email address at which you received the invitation, and you receive a sign-in link that stays valid for 15 minutes.",
    },
    aanmeldKnop: {
      nl: "Aanmelden op het platform",
      en: "Sign in to the platform",
    },
  },

  // De rollen in de keuzelijst. Het Nederlandse lid is tegelijk de WAARDE die
  // naar de server gaat: die blijft in beide talen ongewijzigd.
  rollen: {
    particulier: {
      nl: "Een particulier, voor mezelf",
      en: "An individual, for myself",
    },
    organisatie: { nl: "Een organisatie", en: "An organisation" },
    school: {
      nl: "Een school of onderwijsinstelling",
      en: "A school or educational institution",
    },
    sport: {
      nl: "Een sportclub of mental coach",
      en: "A sports club or mental coach",
    },
    coach: {
      nl: "Een coach of practitioner",
      en: "A coach or practitioner",
    },
    deelnemer: {
      nl: "Een deelnemer met een vraag",
      en: "A participant with a question",
    },
  },

  voet: {
    note: {
      nl: "TaPas is een reflectie- en ontwikkelinstrument. Geen diagnose, selectie of potentieelbepaling.",
      en: "TaPas is a reflection and development instrument. No diagnosis, selection or potential rating.",
    },
    beheer: { nl: "Beheer", en: "Administration" },
  },

  beeld: {
    kompasroos: { nl: "Kompasroos", en: "Compass rose" },
  },
} as const satisfies { readonly [sleutel: string]: Tak };

export default T;
