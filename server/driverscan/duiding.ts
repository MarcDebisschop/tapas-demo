// server/driverscan/duiding.ts
// ---------------------------------------------------------------------------
// Meertalige duidingtekst voor het Driver-scan PDF-rapport (NL/FR/EN/ES/RU).
// Additief bestand (Werkprotocol Regel 2). Bevat GEEN scoring — enkel tekst.
//
// De grootste nadruk (bevestigd door Marc): elke driver is AFHANKELIJK VAN DE
// CONTEXT een REM óf een GASPEDAAL richting talent-inzetbaarheid. Datzelfde
// onbewuste controlemechanisme dat je in de ene situatie vooruitstuwt, kan je
// in een andere situatie afremmen. Daarom staat per driver zowel de
// gaspedaal- als de rem-werking uitgewerkt, met het kantelpunt ertussen.
// ---------------------------------------------------------------------------

export type Taal = "nl" | "fr" | "en" | "es" | "ru";
export const DRIVERSCAN_TALEN: Taal[] = ["nl", "fr", "en", "es", "ru"];

// De 5 Kahler-drivers. De sleutel is de construct-naam zoals ze in
// instrument.json en in buildMainScores voorkomt (nooit vertalen — de scoring
// hangt hieraan). De weergavenaam mag wél gelokaliseerd worden.
export type DriverKey = "Be Strong" | "Be Perfect" | "Hurry Up" | "Try Hard" | "Please Others";
export const DRIVER_KEYS: DriverKey[] = ["Be Strong", "Be Perfect", "Hurry Up", "Try Hard", "Please Others"];

export interface DriverDuiding {
  naam: string;       // weergavenaam van de driver
  kern: string;       // korte kern-omschrijving
  gaspedaal: string;  // wanneer deze driver een gaspedaal is (versnelt talent)
  rem: string;        // wanneer diezelfde driver een rem wordt (remt talent af)
  kantel: string;     // het kantelpunt: welke context doet het omslaan
}

export interface UiTekst {
  documentTitel: string;
  kicker: string;
  disclaimerTitel: string;
  disclaimer: string;
  volgordeTitel: string;
  volgordeIntro: string;
  betekenisTitel: string;
  betekenisIntro: (topDriver: string) => string;
  remGasTitel: string;
  remGasIntro: string;
  numeriekTitel: string;
  kolomDriver: string;
  kolomNet: string;
  kolomEnergie: string;
  kolomSignaal: string;
  gaspedaalLabel: string;
  remLabel: string;
  toelichtingLabel: string;
  neutraalLabel: string;
  aandriverLabel: string;   // "sterkst aan het stuur"
  netUitleg: string;
  energieUitleg: string;
  voetnoot: string;
  naamLabel: string;
  datumLabel: string;
  gegenereerd: string;
}

// ─── UI-teksten per taal ────────────────────────────────────────────────────

export const UI: Record<Taal, UiTekst> = {
  nl: {
    documentTitel: "Driver-scan",
    kicker: "JOUW DRIVER-VOLGORDE — ONBEWUST CONTROLEMECHANISME",
    disclaimerTitel: "Wat dit rapport is (en niet is)",
    disclaimer:
      "Dit is de Driver-scan. Ze staat volledig LOS van de 2MINSCAN en pretendeert daar niets over. " +
      "Drivers zijn een onbewust controlemechanisme: aangeleerde innerlijke geboden die — buiten je bewuste wil om — " +
      "bepalen hoe je je talent inzet. Afhankelijk van de context werkt eenzelfde driver als een REM óf als een " +
      "GASPEDAAL richting je talent-inzetbaarheid. Dit rapport toont de volgorde van je drivers en, per driver, " +
      "wanneer ze je vooruitstuwt en wanneer ze je afremt.",
    volgordeTitel: "Je driver-volgorde",
    volgordeIntro:
      "De drivers staan gerangschikt van sterkst naar zwakst aan het stuur, op basis van je netto-keuzes " +
      "(hoe vaak je een driver het méést herkende min hoe vaak het mínst). De bovenste zit het sterkst aan het stuur.",
    betekenisTitel: "Betekenis van de volgorde",
    betekenisIntro: (top) =>
      `De volgorde vertelt welke driver het sterkst 'aan het stuur' zit. Bij jou is dat ${top}: die driver ` +
      "kleurt het snelst je reflexen onder druk. Hoe hoger een driver staat, hoe automatischer ze je gedrag " +
      "stuurt — ten goede én ten kwade. De onderste drivers spelen een kleinere, meer facultatieve rol.",
    remGasTitel: "Rem of gaspedaal — afhankelijk van de context",
    remGasIntro:
      "Dit is de kern van de Driver-scan. Geen enkele driver is 'goed' of 'slecht'. Dezelfde driver die je in de " +
      "ene context vooruitstuwt (gaspedaal), remt je in een andere context af (rem). Het verschil zit in de " +
      "situatie, niet in de driver. Hieronder lees je per driver beide kanten en het kantelpunt ertussen.",
    numeriekTitel: "Numeriek overzicht",
    kolomDriver: "Driver",
    kolomNet: "Netto",
    kolomEnergie: "Gem. energie",
    kolomSignaal: "Signaal",
    gaspedaalLabel: "gaspedaal",
    remLabel: "rem",
    toelichtingLabel: "toelichting",
    neutraalLabel: "neutraal",
    aandriverLabel: "sterkst aan het stuur",
    netUitleg: "Netto = hoe vaak méést gekozen − hoe vaak mínst gekozen.",
    energieUitleg: "Gem. energie = gemiddelde energiewaarde (−2 tot +2) bij deze driver.",
    voetnoot:
      "Driver-scan · onbewust controlemechanisme · rem of gaspedaal afhankelijk van context. " +
      "Losstaand van de 2MINSCAN.",
    naamLabel: "Naam",
    datumLabel: "Datum",
    gegenereerd: "Gegenereerd door de Driver-scan",
  },
  fr: {
    documentTitel: "Driver-scan",
    kicker: "VOTRE ORDRE DE DRIVERS — MÉCANISME DE CONTRÔLE INCONSCIENT",
    disclaimerTitel: "Ce qu'est ce rapport (et ce qu'il n'est pas)",
    disclaimer:
      "Ceci est le Driver-scan. Il est totalement INDÉPENDANT du 2MINSCAN et ne prétend rien à son sujet. " +
      "Les drivers sont un mécanisme de contrôle inconscient : des injonctions intérieures apprises qui — hors de " +
      "votre volonté consciente — déterminent la manière dont vous mobilisez votre talent. Selon le contexte, un " +
      "même driver agit comme un FREIN ou comme un ACCÉLÉRATEUR de votre employabilité de talent. Ce rapport montre " +
      "l'ordre de vos drivers et, pour chacun, quand il vous propulse et quand il vous freine.",
    volgordeTitel: "Votre ordre de drivers",
    volgordeIntro:
      "Les drivers sont classés du plus fort au plus faible au volant, sur base de vos choix nets (combien de fois " +
      "vous avez le plus reconnu un driver moins combien de fois le moins). Celui du haut tient le plus fermement le volant.",
    betekenisTitel: "Signification de l'ordre",
    betekenisIntro: (top) =>
      `L'ordre indique quel driver tient le plus fermement 'le volant'. Chez vous, c'est ${top} : ce driver colore ` +
      "le plus vite vos réflexes sous pression. Plus un driver est haut, plus il guide votre comportement de façon " +
      "automatique — pour le meilleur comme pour le pire. Les drivers du bas jouent un rôle plus réduit et facultatif.",
    remGasTitel: "Frein ou accélérateur — selon le contexte",
    remGasIntro:
      "C'est le cœur du Driver-scan. Aucun driver n'est 'bon' ou 'mauvais'. Le même driver qui vous propulse dans un " +
      "contexte (accélérateur) vous freine dans un autre (frein). La différence tient à la situation, pas au driver. " +
      "Ci-dessous, pour chaque driver, les deux faces et le point de bascule entre elles.",
    numeriekTitel: "Aperçu numérique",
    kolomDriver: "Driver",
    kolomNet: "Net",
    kolomEnergie: "Énergie moy.",
    kolomSignaal: "Signal",
    gaspedaalLabel: "accélérateur",
    remLabel: "frein",
    toelichtingLabel: "précision",
    neutraalLabel: "neutre",
    aandriverLabel: "le plus fort au volant",
    netUitleg: "Net = nombre de fois choisi le plus − nombre de fois choisi le moins.",
    energieUitleg: "Énergie moy. = valeur énergétique moyenne (−2 à +2) pour ce driver.",
    voetnoot:
      "Driver-scan · mécanisme de contrôle inconscient · frein ou accélérateur selon le contexte. " +
      "Indépendant du 2MINSCAN.",
    naamLabel: "Nom",
    datumLabel: "Date",
    gegenereerd: "Généré par le Driver-scan",
  },
  en: {
    documentTitel: "Driver-scan",
    kicker: "YOUR DRIVER ORDER — UNCONSCIOUS CONTROL MECHANISM",
    disclaimerTitel: "What this report is (and is not)",
    disclaimer:
      "This is the Driver-scan. It is entirely SEPARATE from the 2MINSCAN and makes no claims about it. " +
      "Drivers are an unconscious control mechanism: learned inner commands that — beyond your conscious will — shape " +
      "how you deploy your talent. Depending on the context, one and the same driver acts as a BRAKE or as an " +
      "ACCELERATOR of your talent employability. This report shows the order of your drivers and, for each one, " +
      "when it propels you forward and when it holds you back.",
    volgordeTitel: "Your driver order",
    volgordeIntro:
      "The drivers are ranked from strongest to weakest at the wheel, based on your net choices (how often you " +
      "recognised a driver most minus how often least). The top one holds the wheel most firmly.",
    betekenisTitel: "Meaning of the order",
    betekenisIntro: (top) =>
      `The order tells you which driver sits most firmly 'at the wheel'. For you that is ${top}: this driver colours ` +
      "your reflexes under pressure the fastest. The higher a driver, the more automatically it steers your behaviour " +
      "— for better and for worse. The lower drivers play a smaller, more optional role.",
    remGasTitel: "Brake or accelerator — depending on the context",
    remGasIntro:
      "This is the heart of the Driver-scan. No driver is 'good' or 'bad'. The same driver that propels you in one " +
      "context (accelerator) holds you back in another (brake). The difference lies in the situation, not in the " +
      "driver. Below, for each driver, both sides and the tipping point between them.",
    numeriekTitel: "Numeric overview",
    kolomDriver: "Driver",
    kolomNet: "Net",
    kolomEnergie: "Avg. energy",
    kolomSignaal: "Signal",
    gaspedaalLabel: "accelerator",
    remLabel: "brake",
    toelichtingLabel: "note",
    neutraalLabel: "neutral",
    aandriverLabel: "most firmly at the wheel",
    netUitleg: "Net = how often chosen most − how often chosen least.",
    energieUitleg: "Avg. energy = average energy value (−2 to +2) for this driver.",
    voetnoot:
      "Driver-scan · unconscious control mechanism · brake or accelerator depending on context. " +
      "Separate from the 2MINSCAN.",
    naamLabel: "Name",
    datumLabel: "Date",
    gegenereerd: "Generated by the Driver-scan",
  },
  es: {
    documentTitel: "Driver-scan",
    kicker: "TU ORDEN DE DRIVERS — MECANISMO DE CONTROL INCONSCIENTE",
    disclaimerTitel: "Qué es este informe (y qué no es)",
    disclaimer:
      "Esto es el Driver-scan. Es totalmente INDEPENDIENTE del 2MINSCAN y no pretende nada sobre él. " +
      "Los drivers son un mecanismo de control inconsciente: mandatos internos aprendidos que — más allá de tu " +
      "voluntad consciente — determinan cómo despliegas tu talento. Según el contexto, un mismo driver actúa como " +
      "FRENO o como ACELERADOR de tu empleabilidad de talento. Este informe muestra el orden de tus drivers y, para " +
      "cada uno, cuándo te impulsa y cuándo te frena.",
    volgordeTitel: "Tu orden de drivers",
    volgordeIntro:
      "Los drivers se ordenan del más fuerte al más débil al volante, según tus elecciones netas (cuántas veces " +
      "reconociste más un driver menos cuántas veces menos). El de arriba sujeta el volante con más firmeza.",
    betekenisTitel: "Significado del orden",
    betekenisIntro: (top) =>
      `El orden indica qué driver está más firmemente 'al volante'. En tu caso es ${top}: ese driver tiñe tus ` +
      "reflejos bajo presión con más rapidez. Cuanto más alto está un driver, más automáticamente dirige tu " +
      "comportamiento — para bien y para mal. Los drivers inferiores juegan un papel menor y más opcional.",
    remGasTitel: "Freno o acelerador — según el contexto",
    remGasIntro:
      "Este es el núcleo del Driver-scan. Ningún driver es 'bueno' o 'malo'. El mismo driver que te impulsa en un " +
      "contexto (acelerador) te frena en otro (freno). La diferencia está en la situación, no en el driver. A " +
      "continuación, para cada driver, ambas caras y el punto de inflexión entre ellas.",
    numeriekTitel: "Resumen numérico",
    kolomDriver: "Driver",
    kolomNet: "Neto",
    kolomEnergie: "Energía media",
    kolomSignaal: "Señal",
    gaspedaalLabel: "acelerador",
    remLabel: "freno",
    toelichtingLabel: "nota",
    neutraalLabel: "neutro",
    aandriverLabel: "más firmemente al volante",
    netUitleg: "Neto = cuántas veces elegido más − cuántas veces elegido menos.",
    energieUitleg: "Energía media = valor energético medio (−2 a +2) para este driver.",
    voetnoot:
      "Driver-scan · mecanismo de control inconsciente · freno o acelerador según el contexto. " +
      "Independiente del 2MINSCAN.",
    naamLabel: "Nombre",
    datumLabel: "Fecha",
    gegenereerd: "Generado por el Driver-scan",
  },
  ru: {
    documentTitel: "Driver-scan",
    kicker: "ВАШ ПОРЯДОК ДРАЙВЕРОВ — БЕССОЗНАТЕЛЬНЫЙ МЕХАНИЗМ КОНТРОЛЯ",
    disclaimerTitel: "Что это за отчёт (и чем он не является)",
    disclaimer:
      "Это Driver-scan. Он полностью НЕЗАВИСИМ от 2MINSCAN и ничего о нём не утверждает. " +
      "Драйверы — это бессознательный механизм контроля: усвоенные внутренние предписания, которые — помимо вашей " +
      "сознательной воли — определяют, как вы применяете свой талант. В зависимости от контекста один и тот же " +
      "драйвер действует как ТОРМОЗ или как ГАЗ для вашей талантливой применимости. Этот отчёт показывает порядок " +
      "ваших драйверов и, для каждого, когда он вас продвигает и когда сдерживает.",
    volgordeTitel: "Ваш порядок драйверов",
    volgordeIntro:
      "Драйверы упорядочены от самого сильного к самому слабому «за рулём», на основе ваших чистых выборов (сколько " +
      "раз драйвер выбран как наиболее близкий минус сколько раз как наименее). Верхний держит руль крепче всего.",
    betekenisTitel: "Значение порядка",
    betekenisIntro: (top) =>
      `Порядок показывает, какой драйвер крепче всего «за рулём». У вас это ${top}: этот драйвер быстрее всего ` +
      "окрашивает ваши реакции под давлением. Чем выше драйвер, тем автоматичнее он управляет вашим поведением — " +
      "как во благо, так и во вред. Нижние драйверы играют меньшую, более факультативную роль.",
    remGasTitel: "Тормоз или газ — в зависимости от контекста",
    remGasIntro:
      "Это суть Driver-scan. Ни один драйвер не является «хорошим» или «плохим». Тот же драйвер, который продвигает " +
      "вас в одном контексте (газ), сдерживает вас в другом (тормоз). Разница в ситуации, а не в драйвере. Ниже для " +
      "каждого драйвера — обе стороны и точка перелома между ними.",
    numeriekTitel: "Числовой обзор",
    kolomDriver: "Драйвер",
    kolomNet: "Нетто",
    kolomEnergie: "Ср. энергия",
    kolomSignaal: "Сигнал",
    gaspedaalLabel: "газ",
    remLabel: "тормоз",
    toelichtingLabel: "пояснение",
    neutraalLabel: "нейтрально",
    aandriverLabel: "крепче всего за рулём",
    netUitleg: "Нетто = сколько раз выбран как наиболее близкий − сколько раз как наименее.",
    energieUitleg: "Ср. энергия = среднее значение энергии (от −2 до +2) для этого драйвера.",
    voetnoot:
      "Driver-scan · бессознательный механизм контроля · тормоз или газ в зависимости от контекста. " +
      "Независим от 2MINSCAN.",
    naamLabel: "Имя",
    datumLabel: "Дата",
    gegenereerd: "Сгенерировано Driver-scan",
  },
};

// ─── Per-driver duiding (rem én gaspedaal) per taal ──────────────────────────

export const DRIVER_DUIDING: Record<Taal, Record<DriverKey, DriverDuiding>> = {
  nl: {
    "Be Strong": {
      naam: "Be Strong (Wees sterk)",
      kern: "Zelfstandig dragen, kalm blijven, niet leunen op anderen.",
      gaspedaal:
        "In crisis en onder druk is dit je gaspedaal: je blijft rustig, neemt verantwoordelijkheid en houdt het " +
        "overzicht terwijl anderen wankelen. Je bent de stabiele kern waar een team op kan bouwen.",
      rem:
        "In samenwerking wordt diezelfde kracht een rem: je vraagt niet om hulp, toont geen kwetsbaarheid en trekt " +
        "alles naar je toe. Anderen voelen zich buitengesloten en jij raakt stil uitgeput.",
      kantel:
        "Het kantelt van gaspedaal naar rem zodra 'sterk zijn' 'alles alleen doen' wordt en steun vragen als falen voelt.",
    },
    "Be Perfect": {
      naam: "Be Perfect (Wees perfect)",
      kern: "Nauwkeurig, grondig, hoge lat — het moet kloppen.",
      gaspedaal:
        "Waar kwaliteit en precisie tellen, is dit je gaspedaal: je levert grondig, foutloos werk en ziet afwijkingen " +
        "die anderen missen. Op jou kan men bouwen als het écht juist moet zijn.",
      rem:
        "Waar snelheid en 'goed genoeg' tellen, wordt het een rem: je blijft schaven, stelt uit en raakt verlamd door " +
        "details. Perfectie wordt de vijand van klaar.",
      kantel:
        "Het kantelt zodra de hoge lat niet meer de kwaliteit dient, maar de angst om fouten te maken.",
    },
    "Hurry Up": {
      naam: "Hurry Up (Schiet op)",
      kern: "Tempo, momentum, veel tegelijk, vooruit.",
      gaspedaal:
        "Onder deadlinedruk en bij veel ballen tegelijk is dit letterlijk je gaspedaal: je komt snel op gang, houdt " +
        "vaart en krijgt in korte tijd veel gedaan. Momentum is je natuurlijke staat.",
      rem:
        "Waar rust, diepgang of geduld nodig is, wordt het een rem: je start te snel, maakt slordigheidsfouten en " +
        "jaagt jezelf en anderen op. Bezinning voelt als tijdverlies.",
      kantel:
        "Het kantelt zodra snelheid een doel op zich wordt in plaats van een middel dat bij de taak past.",
    },
    "Try Hard": {
      naam: "Try Hard (Doe je best)",
      kern: "Inzet tonen, jezelf bewijzen, doorzetten.",
      gaspedaal:
        "Bij uitdagingen en nieuwe terreinen is dit je gaspedaal: je zet voluit in, geeft niet op en overstijgt " +
        "jezelf waar anderen afhaken. Je energie tilt een team over een drempel.",
      rem:
        "Bij routine of bij afronden wordt het een rem: de inspanning zelf wordt belangrijker dan het resultaat, je " +
        "maakt het onnodig zwaar en levert moeilijk af. Hard proberen verdringt slim afwerken.",
      kantel:
        "Het kantelt zodra 'moeite doen' belangrijker wordt dan effectief resultaat boeken.",
    },
    "Please Others": {
      naam: "Please Others (Doe anderen een plezier)",
      kern: "Afstemmen op anderen, harmonie zoeken, aanpassen.",
      gaspedaal:
        "In samenwerking en dienstverlening is dit je gaspedaal: je voelt anderen haarfijn aan, smeedt harmonie en " +
        "krijgt mensen mee. Je bent de lijm die een groep verbindt.",
      rem:
        "Waar grenzen en eigen standpunt nodig zijn, wordt het een rem: je cijfert jezelf weg, vermijdt conflict en " +
        "zegt geen 'nee'. Aanpassen wordt jezelf verliezen.",
      kantel:
        "Het kantelt zodra harmonie bewaren belangrijker wordt dan eerlijk zijn over wat jij nodig hebt.",
    },
  },
  fr: {
    "Be Strong": {
      naam: "Be Strong (Sois fort)",
      kern: "Porter seul, rester calme, ne pas s'appuyer sur les autres.",
      gaspedaal:
        "En crise et sous pression, c'est votre accélérateur : vous restez calme, prenez vos responsabilités et gardez " +
        "la vue d'ensemble quand d'autres vacillent. Vous êtes le noyau stable sur lequel une équipe peut compter.",
      rem:
        "En collaboration, cette même force devient un frein : vous ne demandez pas d'aide, ne montrez pas de " +
        "vulnérabilité et tirez tout à vous. Les autres se sentent exclus et vous vous épuisez en silence.",
      kantel:
        "Cela bascule de l'accélérateur au frein dès que « être fort » devient « tout faire seul » et que demander de l'aide ressemble à un échec.",
    },
    "Be Perfect": {
      naam: "Be Perfect (Sois parfait)",
      kern: "Précis, minutieux, exigeant — cela doit être juste.",
      gaspedaal:
        "Là où la qualité et la précision comptent, c'est votre accélérateur : vous livrez un travail minutieux et " +
        "sans faute et repérez des écarts que d'autres manquent. On peut compter sur vous quand cela doit être exact.",
      rem:
        "Là où la vitesse et le « suffisamment bon » comptent, cela devient un frein : vous peaufinez sans fin, " +
        "reportez et vous paralysez dans les détails. La perfection devient l'ennemie du fini.",
      kantel:
        "Cela bascule dès que l'exigence ne sert plus la qualité mais la peur de commettre des erreurs.",
    },
    "Hurry Up": {
      naam: "Hurry Up (Dépêche-toi)",
      kern: "Rythme, élan, beaucoup à la fois, avancer.",
      gaspedaal:
        "Sous la pression des délais et avec beaucoup de fronts à la fois, c'est littéralement votre accélérateur : " +
        "vous démarrez vite, gardez l'allure et abattez beaucoup en peu de temps. L'élan est votre état naturel.",
      rem:
        "Là où il faut du calme, de la profondeur ou de la patience, cela devient un frein : vous démarrez trop vite, " +
        "faites des fautes d'inattention et vous pressez vous-même et les autres. La réflexion ressemble à du temps perdu.",
      kantel:
        "Cela bascule dès que la vitesse devient un but en soi au lieu d'un moyen adapté à la tâche.",
    },
    "Try Hard": {
      naam: "Try Hard (Fais de ton mieux)",
      kern: "Montrer son effort, faire ses preuves, persévérer.",
      gaspedaal:
        "Face aux défis et aux terrains nouveaux, c'est votre accélérateur : vous vous investissez à fond, " +
        "n'abandonnez pas et vous dépassez là où d'autres lâchent. Votre énergie fait franchir un seuil à l'équipe.",
      rem:
        "Dans la routine ou pour finaliser, cela devient un frein : l'effort lui-même prime sur le résultat, vous " +
        "rendez les choses inutilement lourdes et livrez difficilement. Se démener évince un achèvement intelligent.",
      kantel:
        "Cela bascule dès que « faire des efforts » devient plus important qu'obtenir un résultat efficace.",
    },
    "Please Others": {
      naam: "Please Others (Fais plaisir aux autres)",
      kern: "S'accorder aux autres, chercher l'harmonie, s'adapter.",
      gaspedaal:
        "En collaboration et en service, c'est votre accélérateur : vous sentez finement les autres, tissez " +
        "l'harmonie et embarquez les gens. Vous êtes le ciment qui relie un groupe.",
      rem:
        "Là où il faut des limites et un point de vue propre, cela devient un frein : vous vous effacez, évitez le " +
        "conflit et ne dites pas « non ». S'adapter devient se perdre soi-même.",
      kantel:
        "Cela bascule dès que préserver l'harmonie devient plus important qu'être honnête sur vos propres besoins.",
    },
  },
  en: {
    "Be Strong": {
      naam: "Be Strong",
      kern: "Carry things alone, stay calm, don't lean on others.",
      gaspedaal:
        "In crisis and under pressure this is your accelerator: you stay calm, take responsibility and keep the " +
        "overview while others waver. You are the stable core a team can build on.",
      rem:
        "In collaboration that same strength becomes a brake: you don't ask for help, show no vulnerability and pull " +
        "everything onto yourself. Others feel shut out and you quietly burn out.",
      kantel:
        "It tips from accelerator to brake the moment 'being strong' becomes 'doing everything alone' and asking for help feels like failure.",
    },
    "Be Perfect": {
      naam: "Be Perfect",
      kern: "Precise, thorough, high bar — it has to be right.",
      gaspedaal:
        "Where quality and precision matter this is your accelerator: you deliver thorough, flawless work and spot " +
        "deviations others miss. You can be relied on when it truly has to be right.",
      rem:
        "Where speed and 'good enough' matter it becomes a brake: you keep polishing, postpone and freeze up over " +
        "details. Perfection becomes the enemy of done.",
      kantel:
        "It tips the moment the high bar no longer serves quality but the fear of making mistakes.",
    },
    "Hurry Up": {
      naam: "Hurry Up",
      kern: "Pace, momentum, many things at once, forward.",
      gaspedaal:
        "Under deadline pressure and with many balls in the air this is literally your accelerator: you get going " +
        "fast, keep up the pace and achieve a lot in little time. Momentum is your natural state.",
      rem:
        "Where calm, depth or patience are needed it becomes a brake: you start too fast, make careless mistakes and " +
        "rush yourself and others. Reflection feels like wasted time.",
      kantel:
        "It tips the moment speed becomes a goal in itself instead of a means that fits the task.",
    },
    "Try Hard": {
      naam: "Try Hard",
      kern: "Show effort, prove yourself, persevere.",
      gaspedaal:
        "Facing challenges and new terrain this is your accelerator: you go all in, don't give up and surpass " +
        "yourself where others drop out. Your energy lifts a team over a threshold.",
      rem:
        "In routine or when finishing it becomes a brake: the effort itself matters more than the result, you make " +
        "things needlessly heavy and struggle to deliver. Trying hard crowds out finishing smart.",
      kantel:
        "It tips the moment 'making an effort' becomes more important than achieving an effective result.",
    },
    "Please Others": {
      naam: "Please Others",
      kern: "Attune to others, seek harmony, adapt.",
      gaspedaal:
        "In collaboration and service this is your accelerator: you sense others acutely, forge harmony and get " +
        "people on board. You are the glue that binds a group.",
      rem:
        "Where boundaries and your own stance are needed it becomes a brake: you efface yourself, avoid conflict and " +
        "won't say 'no'. Adapting becomes losing yourself.",
      kantel:
        "It tips the moment preserving harmony becomes more important than being honest about what you need.",
    },
  },
  es: {
    "Be Strong": {
      naam: "Be Strong (Sé fuerte)",
      kern: "Cargar en solitario, mantener la calma, no apoyarse en otros.",
      gaspedaal:
        "En crisis y bajo presión es tu acelerador: mantienes la calma, asumes responsabilidad y conservas la visión " +
        "de conjunto mientras otros vacilan. Eres el núcleo estable sobre el que un equipo puede construir.",
      rem:
        "En la colaboración esa misma fuerza se vuelve freno: no pides ayuda, no muestras vulnerabilidad y lo arrastras " +
        "todo hacia ti. Los demás se sienten excluidos y tú te agotas en silencio.",
      kantel:
        "Se invierte de acelerador a freno en cuanto « ser fuerte » se convierte en « hacerlo todo solo » y pedir ayuda se siente como fracaso.",
    },
    "Be Perfect": {
      naam: "Be Perfect (Sé perfecto)",
      kern: "Preciso, minucioso, listón alto — tiene que estar bien.",
      gaspedaal:
        "Donde importan la calidad y la precisión es tu acelerador: entregas un trabajo minucioso e impecable y " +
        "detectas desviaciones que otros pasan por alto. Se puede contar contigo cuando de verdad debe ser exacto.",
      rem:
        "Donde importan la velocidad y el « suficientemente bueno » se vuelve freno: sigues puliendo, aplazas y te " +
        "paralizas en los detalles. La perfección se vuelve enemiga de lo terminado.",
      kantel:
        "Se invierte en cuanto el listón alto ya no sirve a la calidad sino al miedo a cometer errores.",
    },
    "Hurry Up": {
      naam: "Hurry Up (Date prisa)",
      kern: "Ritmo, impulso, muchas cosas a la vez, avanzar.",
      gaspedaal:
        "Bajo presión de plazos y con muchos frentes a la vez es literalmente tu acelerador: arrancas rápido, " +
        "mantienes el ritmo y logras mucho en poco tiempo. El impulso es tu estado natural.",
      rem:
        "Donde hacen falta calma, profundidad o paciencia se vuelve freno: arrancas demasiado rápido, cometes errores " +
        "por descuido y presionas a ti mismo y a otros. Reflexionar se siente como perder el tiempo.",
      kantel:
        "Se invierte en cuanto la velocidad se convierte en un fin en sí mismo en lugar de un medio adecuado a la tarea.",
    },
    "Try Hard": {
      naam: "Try Hard (Esfuérzate)",
      kern: "Mostrar esfuerzo, demostrar tu valía, perseverar.",
      gaspedaal:
        "Ante retos y terrenos nuevos es tu acelerador: te implicas a fondo, no te rindes y te superas donde otros " +
        "abandonan. Tu energía hace que un equipo cruce un umbral.",
      rem:
        "En la rutina o al cerrar se vuelve freno: el esfuerzo en sí importa más que el resultado, lo haces todo " +
        "innecesariamente pesado y te cuesta entregar. Esforzarse mucho desplaza terminar con inteligencia.",
      kantel:
        "Se invierte en cuanto « esforzarse » se vuelve más importante que lograr un resultado eficaz.",
    },
    "Please Others": {
      naam: "Please Others (Complace a los demás)",
      kern: "Sintonizar con otros, buscar armonía, adaptarse.",
      gaspedaal:
        "En la colaboración y el servicio es tu acelerador: percibes a los demás con finura, tejes armonía y logras " +
        "que la gente se sume. Eres el pegamento que une a un grupo.",
      rem:
        "Donde hacen falta límites y postura propia se vuelve freno: te anulas, evitas el conflicto y no dices « no ». " +
        "Adaptarse se convierte en perderte a ti mismo.",
      kantel:
        "Se invierte en cuanto preservar la armonía se vuelve más importante que ser honesto sobre lo que necesitas.",
    },
  },
  ru: {
    "Be Strong": {
      naam: "Be Strong (Будь сильным)",
      kern: "Нести всё в одиночку, сохранять спокойствие, не опираться на других.",
      gaspedaal:
        "В кризисе и под давлением это ваш газ: вы сохраняете спокойствие, берёте ответственность и удерживаете " +
        "картину целиком, когда другие колеблются. Вы — устойчивое ядро, на которое команда может опереться.",
      rem:
        "В сотрудничестве та же сила становится тормозом: вы не просите помощи, не показываете уязвимости и тянете " +
        "всё на себя. Другие чувствуют себя отстранёнными, а вы тихо выгораете.",
      kantel:
        "Переключается с газа на тормоз, как только «быть сильным» превращается в «делать всё в одиночку», а просьба о помощи ощущается как провал.",
    },
    "Be Perfect": {
      naam: "Be Perfect (Будь совершенным)",
      kern: "Точность, тщательность, высокая планка — всё должно быть верно.",
      gaspedaal:
        "Там, где важны качество и точность, это ваш газ: вы выполняете тщательную, безупречную работу и замечаете " +
        "отклонения, которые другие упускают. На вас можно положиться, когда действительно должно быть точно.",
      rem:
        "Там, где важны скорость и «достаточно хорошо», это становится тормозом: вы бесконечно шлифуете, откладываете " +
        "и застреваете в деталях. Совершенство становится врагом готового.",
      kantel:
        "Переключается, как только высокая планка служит уже не качеству, а страху совершить ошибку.",
    },
    "Hurry Up": {
      naam: "Hurry Up (Поторопись)",
      kern: "Темп, импульс, много дел сразу, вперёд.",
      gaspedaal:
        "Под давлением сроков и при множестве задач одновременно это буквально ваш газ: вы быстро набираете ход, " +
        "держите темп и успеваете многое за короткое время. Импульс — ваше естественное состояние.",
      rem:
        "Там, где нужны спокойствие, глубина или терпение, это становится тормозом: вы стартуете слишком быстро, " +
        "допускаете небрежные ошибки и подгоняете себя и других. Размышление ощущается как потеря времени.",
      kantel:
        "Переключается, как только скорость становится самоцелью, а не средством, подходящим к задаче.",
    },
    "Try Hard": {
      naam: "Try Hard (Старайся изо всех сил)",
      kern: "Показывать усилие, доказывать себя, упорствовать.",
      gaspedaal:
        "Перед вызовами и на новой территории это ваш газ: вы выкладываетесь полностью, не сдаётесь и превосходите " +
        "себя там, где другие отступают. Ваша энергия переносит команду через порог.",
      rem:
        "В рутине или при завершении это становится тормозом: само усилие важнее результата, вы делаете всё " +
        "неоправданно тяжёлым и с трудом доводите до конца. Старание вытесняет умное завершение.",
      kantel:
        "Переключается, как только «прилагать усилия» становится важнее, чем достигать эффективного результата.",
    },
    "Please Others": {
      naam: "Please Others (Угождай другим)",
      kern: "Подстраиваться под других, искать гармонию, приспосабливаться.",
      gaspedaal:
        "В сотрудничестве и служении это ваш газ: вы тонко чувствуете других, создаёте гармонию и увлекаете людей за " +
        "собой. Вы — клей, скрепляющий группу.",
      rem:
        "Там, где нужны границы и собственная позиция, это становится тормозом: вы стираете себя, избегаете конфликта " +
        "и не говорите «нет». Приспособление превращается в потерю себя.",
      kantel:
        "Переключается, как только сохранение гармонии становится важнее честности о том, что нужно вам.",
    },
  },
};

export function veiligeTaal(t: string | null | undefined): Taal {
  return (DRIVERSCAN_TALEN as string[]).includes(t ?? "") ? (t as Taal) : "nl";
}
