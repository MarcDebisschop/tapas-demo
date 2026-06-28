// ---------------------------------------------------------------------------
// server/routes-stm.ts — Coach-login + Self-Training Module (STM) endpoints
//
// Twee auth-guards:
//   requirePractitioner → accepteert adminId (Prior) OF coachId (coach)
//   requirePrior        → enkel is_prior=true beheerders (niet gebruikt hier)
//
// STM-data: in-memory Map per beheerderId.
//   Geen DB-migratie nodig voor demo. Reset bij server-restart.
//
// Nieuwe routes:
//   POST   /api/coach/login
//   GET    /api/coach/me
//   POST   /api/coach/logout
//   POST   /api/stm/start
//   POST   /api/stm/afronden
//   GET    /api/stm/historiek
//   GET    /api/stm/laagscores
// ---------------------------------------------------------------------------

import type { Express, Request, Response } from "express";

// ---------------------------------------------------------------------------
// Type-definities
// ---------------------------------------------------------------------------

interface StmVraag {
  id: number;
  vraag_tekst: string;
  thema: string;
  laag: 1 | 2 | 3 | 4;
  vraag_type: "meerkeuze" | "juistfout";
  opties: string[];
  correct_antwoord: string;
  feedback_correct: string;
  feedback_fout: string;
}

interface StmSessieRecord {
  id: number;
  beheerder_id: number;
  gestart_at: string;
  afgerond_at: string | null;
  score_totaal: number | null;
  inschaling: string | null;
  duur_seconden: number | null;
  scores_per_laag: Record<string, number>;
  feedback: Array<{ vraag_id: number; correct: boolean; feedback: string }>;
}

// ---------------------------------------------------------------------------
// In-memory opslag
// ---------------------------------------------------------------------------

let sessieCounter = 1;
const stmSessies = new Map<number, StmSessieRecord>();      // sessieId → record
const stmSessiesByBeheerder = new Map<number, number[]>();  // beheerderId → [sessieIds]

// ---------------------------------------------------------------------------
// Demo-vraagbank (30 vragen, 4 lagen, 5 thema's)
// ---------------------------------------------------------------------------

const VRAAGBANK: StmVraag[] = [
  // Laag 1 — Parate kennis
  {
    id: 1, laag: 1, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Hoeveel TaPas-foci heeft een standaard T4P Business Kompas-profiel?",
    opties: ["3", "4", "5", "6"],
    correct_antwoord: "4",
    feedback_correct: "Juist. Een T4P-profiel heeft altijd 4 TaPas-foci.",
    feedback_fout: "Fout. Een T4P-profiel heeft altijd 4 TaPas-foci.",
  },
  {
    id: 2, laag: 1, thema: "TaPas-methodiek", vraag_type: "juistfout",
    vraag_tekst: "TaPas-foci zijn gebaseerd op observeerbaar gedrag, niet op persoonlijkheidskenmerken.",
    opties: ["Juist", "Fout"],
    correct_antwoord: "Juist",
    feedback_correct: "Correct. TaPas meet gedragspatronen, niet persoonlijkheid.",
    feedback_fout: "Fout. TaPas meet gedragspatronen, niet persoonlijkheid.",
  },
  {
    id: 3, laag: 1, thema: "Drivers", vraag_type: "meerkeuze",
    vraag_tekst: "Welke twee categorieën onderscheidt het TaPas-model voor drivers?",
    opties: ["Intrinsiek en extrinsiek", "Intern en extern", "Primair en secundair", "Hoog en laag"],
    correct_antwoord: "Intrinsiek en extrinsiek",
    feedback_correct: "Juist. TaPas onderscheidt intrinsieke (intern gefocust) en extrinsieke (extern gefocust) drivers.",
    feedback_fout: "Fout. TaPas onderscheidt intrinsieke en extrinsieke drivers, gebaseerd op de SDT-theorie van Deci & Ryan.",
  },
  {
    id: 4, laag: 1, thema: "Energiemanagement", vraag_type: "meerkeuze",
    vraag_tekst: "Wat meet de 2MINSCAN in het TaPas-systeem primair?",
    opties: ["Persoonlijkheidstype", "Energetisch gedragsprofiel", "IQ-score", "Leiderschapsstijl"],
    correct_antwoord: "Energetisch gedragsprofiel",
    feedback_correct: "Correct. De 2MINSCAN genereert een energetisch gedragsprofiel (EG-code).",
    feedback_fout: "Fout. De 2MINSCAN genereert een energetisch gedragsprofiel (EG-code), geen persoonlijkheidstest.",
  },
  {
    id: 5, laag: 1, thema: "Instrumenten", vraag_type: "juistfout",
    vraag_tekst: "T4Teens en T4Students zijn identieke instrumenten met dezelfde normgroep.",
    opties: ["Juist", "Fout"],
    correct_antwoord: "Fout",
    feedback_correct: "Correct. T4Teens richt zich op 13-17 jaar, T4Students op 18-23 jaar — aparte normgroepen.",
    feedback_fout: "Fout. T4Teens (13-17j) en T4Students (18-23j) hebben aparte normgroepen en een andere aanpak.",
  },
  {
    id: 6, laag: 1, thema: "TaPas Jester", vraag_type: "meerkeuze",
    vraag_tekst: "Wat is de primaire rol van een TaPas Jester?",
    opties: [
      "Deelnemers begeleiden bij het invullen van vragenlijsten",
      "Gecertificeerde gebruiker met aantoonbare praktijkervaring",
      "IT-beheerder van het platform",
      "Marketingverantwoordelijke",
    ],
    correct_antwoord: "Gecertificeerde gebruiker met aantoonbare praktijkervaring",
    feedback_correct: "Juist. Een TaPas Jester is een gecertificeerde practitioner met aantoonbare praktijkervaring.",
    feedback_fout: "Fout. Een TaPas Jester is een gecertificeerde practitioner met aantoonbare praktijkervaring.",
  },
  {
    id: 7, laag: 1, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Wat zijn de talentversnellers in het TaPas-model?",
    opties: [
      "De vier primaire gedragsfoci",
      "Secundaire gedragspatronen die foci versterken of afremmen",
      "Extrinsieke motivatiebronnen",
      "Energieniveaus per werkdomein",
    ],
    correct_antwoord: "Secundaire gedragspatronen die foci versterken of afremmen",
    feedback_correct: "Correct. Talentversnellers zijn secundaire gedragspatronen die de primaire foci versterken of afremmen.",
    feedback_fout: "Fout. Talentversnellers zijn secundaire gedragspatronen die de primaire foci versterken of afremmen.",
  },
  {
    id: 8, laag: 1, thema: "Instrumenten", vraag_type: "juistfout",
    vraag_tekst: "De TaPas Coachatlas is bedoeld voor de deelnemer zelf, niet voor de coach.",
    opties: ["Juist", "Fout"],
    correct_antwoord: "Fout",
    feedback_correct: "Correct. De Coachatlas is een werkdocument voor de coach, niet het primaire deelnemersrapport.",
    feedback_fout: "Fout. De Coachatlas is een werkdocument voor de coach.",
  },

  // Laag 2 — Begrip
  {
    id: 9, laag: 2, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Waarom mogen TaPas-rapporten geen diagnoseclaims bevatten?",
    opties: [
      "Om wettelijke aansprakelijkheid te vermijden",
      "Omdat TaPas gedragspatronen beschrijft, geen absolute diagnoses stelt",
      "Omdat deelnemers dit niet prettig vinden",
      "Om de lezer te beschermen tegen zelfdiagnose",
    ],
    correct_antwoord: "Omdat TaPas gedragspatronen beschrijft, geen absolute diagnoses stelt",
    feedback_correct: "Juist. TaPas beschrijft patronen in gedrag, geen diagnoses of definitieve labels.",
    feedback_fout: "Fout. De kern is dat TaPas descriptief is (gedragspatronen), niet diagnostisch.",
  },
  {
    id: 10, laag: 2, thema: "Energiemanagement", vraag_type: "meerkeuze",
    vraag_tekst: "Wat betekent een 'negatief energieniveau' bij een TaPas-focus?",
    opties: [
      "De focus is afwezig in het profiel",
      "De focus kost consistent energie in plaats van energie te geven",
      "De deelnemer presteert slecht op dit domein",
      "De focus is een zwakke plek in het karakter",
    ],
    correct_antwoord: "De focus kost consistent energie in plaats van energie te geven",
    feedback_correct: "Correct. Een negatief energieniveau bij een focus wijst op energieverlies, niet per se op slechtere prestaties.",
    feedback_fout: "Fout. Negatieve energie = de focus kost energie. Dit zegt niets over prestaties of karakter.",
  },
  {
    id: 11, laag: 2, thema: "Drivers", vraag_type: "meerkeuze",
    vraag_tekst: "Wat is het verschil tussen een intrinsieke en een extrinsieke driver in TaPas?",
    opties: [
      "Intrinsiek = intern gefocust (eigen groei/waarden), extrinsiek = extern gefocust (resultaat/erkenning)",
      "Intrinsiek = aangeboren, extrinsiek = aangeleerd",
      "Intrinsiek = sterk, extrinsiek = zwak",
      "Intrinsiek = positief, extrinsiek = negatief",
    ],
    correct_antwoord: "Intrinsiek = intern gefocust (eigen groei/waarden), extrinsiek = extern gefocust (resultaat/erkenning)",
    feedback_correct: "Juist. Gebaseerd op SDT (Deci & Ryan): intrinsiek = autonomie/groei/verbinding, extrinsiek = externe prikkels.",
    feedback_fout: "Fout. Intrinsiek = intern gefocust op autonomie/groei/waarden; extrinsiek = extern gefocust op resultaat/erkenning.",
  },
  {
    id: 12, laag: 2, thema: "Coaching", vraag_type: "meerkeuze",
    vraag_tekst: "Wat is het doel van een 'Deep Dive' in de TaPas Coachatlas?",
    opties: [
      "Een diepgaande persoonlijkheidsanalyse maken",
      "De coach helpen de achterliggende dynamieken van het profiel te begrijpen",
      "Een objectief selectieoordeel formuleren",
      "Zwakheden van de deelnemer inventariseren",
    ],
    correct_antwoord: "De coach helpen de achterliggende dynamieken van het profiel te begrijpen",
    feedback_correct: "Correct. De Deep Dive geeft de coach interpretatieve diepgang, niet een oordeel.",
    feedback_fout: "Fout. De Deep Dive is bedoeld om de coach de achterliggende dynamieken van het profiel te laten begrijpen.",
  },
  {
    id: 13, laag: 2, thema: "Instrumenten", vraag_type: "juistfout",
    vraag_tekst: "Een coach mag een TaPas-profiel gebruiken als basis voor een selectiebeslissing.",
    opties: ["Juist", "Fout"],
    correct_antwoord: "Fout",
    feedback_correct: "Correct. TaPas is uitdrukkelijk geen selectie-instrument. Het is bedoeld voor ontwikkeling en coaching.",
    feedback_fout: "Fout. TaPas is geen selectie-instrument en mag niet als basis voor selectiebeslissingen gebruikt worden.",
  },
  {
    id: 14, laag: 2, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Welke theorie vormt de basis voor de driver-motivatie-laag in TaPas?",
    opties: [
      "Maslow's hiërarchie van behoeften",
      "Self-Determination Theory (Deci & Ryan)",
      "Herzberg's tweefactorentheorie",
      "McGregor's X-Y theorie",
    ],
    correct_antwoord: "Self-Determination Theory (Deci & Ryan)",
    feedback_correct: "Juist. De TaPas driver-laag is gebaseerd op de Self-Determination Theory van Deci & Ryan.",
    feedback_fout: "Fout. De TaPas driver-laag is gebaseerd op de Self-Determination Theory van Deci & Ryan.",
  },
  {
    id: 15, laag: 2, thema: "Energiemanagement", vraag_type: "meerkeuze",
    vraag_tekst: "Hoe interpreteert TaPas een hoge focus-score gecombineerd met laag energieniveau?",
    opties: [
      "Sterke competentie die energie opslurpt — risico op uitputting",
      "Onbetrouwbare meting — de data is tegenstrijdig",
      "De deelnemer is gemotiveerd maar moe",
      "De focus wordt onderdrukt door de omgeving",
    ],
    correct_antwoord: "Sterke competentie die energie opslurpt — risico op uitputting",
    feedback_correct: "Correct. Hoge focus + lage energie = het gedrag is sterk aanwezig maar kost energie. Uitputtingsrisico.",
    feedback_fout: "Fout. Hoge focus + lage energie wijst op een gedragspatroon dat sterk aanwezig is maar energie kost — uitputtingsrisico.",
  },
  {
    id: 16, laag: 2, thema: "Coaching", vraag_type: "juistfout",
    vraag_tekst: "Een TaPas-rapport kan rechtstreeks aan de deelnemer gegeven worden zonder coachingsgesprek.",
    opties: ["Juist", "Fout"],
    correct_antwoord: "Fout",
    feedback_correct: "Correct. TaPas-rapporten zijn bedoeld als basis voor een begeleid gesprek, niet voor zelfinterpretatie.",
    feedback_fout: "Fout. TaPas-rapporten zijn bedoeld als basis voor begeleide gesprekken, niet voor zelfinterpretatie zonder coaching.",
  },

  // Laag 3 — Analyse
  {
    id: 17, laag: 3, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Een deelnemer heeft hoge scores op twee tegenstrijdige TaPas-foci. Wat is de meest correcte interpretatie?",
    opties: [
      "De meting is fout — dit kan niet",
      "De deelnemer is inconsistent van karakter",
      "Contextafhankelijke activatie — beide patronen zijn aanwezig in verschillende situaties",
      "De deelnemer vult de vragenlijst sociaal wenselijk in",
    ],
    correct_antwoord: "Contextafhankelijke activatie — beide patronen zijn aanwezig in verschillende situaties",
    feedback_correct: "Juist. TaPas erkent dat meerdere foci tegelijk aanwezig kunnen zijn — ze activeren contextafhankelijk.",
    feedback_fout: "Fout. Hoge scores op meerdere foci zijn mogelijk en wijzen op contextafhankelijke activatie, niet op inconsistentie.",
  },
  {
    id: 18, laag: 3, thema: "Drivers", vraag_type: "meerkeuze",
    vraag_tekst: "Een coach merkt dat een deelnemer uitsluitend extrinsieke drivers heeft. Wat is het coachingrisico?",
    opties: [
      "De deelnemer is niet gemotiveerd",
      "Kwetsbaarheid bij wegvallen van externe beloningen of erkenning",
      "De deelnemer zal nooit goed presteren",
      "Er is geen risico — extrinsiek is even sterk als intrinsiek",
    ],
    correct_antwoord: "Kwetsbaarheid bij wegvallen van externe beloningen of erkenning",
    feedback_correct: "Juist. Uitsluitend extrinsieke drivers creëren kwetsbaarheid als externe prikkels wegvallen (SDT-inzicht).",
    feedback_fout: "Fout. SDT-onderzoek toont aan dat uitsluitend extrinsieke motivatie kwetsbaar is als externe prikkels wegvallen.",
  },
  {
    id: 19, laag: 3, thema: "Energiemanagement", vraag_type: "meerkeuze",
    vraag_tekst: "Hoe verschilt de 2MINSCAN fundamenteel van een persoonlijkheidstest zoals MBTI?",
    opties: [
      "De 2MINSCAN is korter",
      "De 2MINSCAN meet energetische gedragspatronen, niet persoonlijkheidstypes",
      "De 2MINSCAN is wetenschappelijk niet onderbouwd",
      "De 2MINSCAN geeft meer gedetailleerde resultaten",
    ],
    correct_antwoord: "De 2MINSCAN meet energetische gedragspatronen, niet persoonlijkheidstypes",
    feedback_correct: "Correct. De 2MINSCAN is een observatie-instrument voor energetisch gedrag, geen persoonlijkheidsclassificatie.",
    feedback_fout: "Fout. Het fundamentele verschil: 2MINSCAN meet energetische gedragspatronen, MBTI classificeert persoonlijkheidstypes.",
  },
  {
    id: 20, laag: 3, thema: "Coaching", vraag_type: "meerkeuze",
    vraag_tekst: "Een deelnemer heeft hoge intrinsieke drivers maar lage focus-scores. Welke coachingsstrategie is het meest passend?",
    opties: [
      "Focussen op externe motivatoren",
      "Waarden en autonomie centraal stellen — de motivatie is sterk, de richting zoeken",
      "De deelnemer doorverwijzen naar een therapeut",
      "Het profiel als onbetrouwbaar beschouwen",
    ],
    correct_antwoord: "Waarden en autonomie centraal stellen — de motivatie is sterk, de richting zoeken",
    feedback_correct: "Juist. Hoge intrinsieke drivers + lage foci: de brandstof is aanwezig, de richting moet nog gevonden worden.",
    feedback_fout: "Fout. Hoge intrinsieke drivers = sterke innerlijke motivatie. De coaching richt zich op richting vinden, niet op motivatie opbouwen.",
  },
  {
    id: 21, laag: 3, thema: "TaPas Jester", vraag_type: "meerkeuze",
    vraag_tekst: "Wat onderscheidt een TaPas Jester van een gewone gecertificeerde gebruiker?",
    opties: [
      "Een hogere opleidingsgraad",
      "Aantoonbare praktijkervaring en bijdrage aan de TaPas-gemeenschap",
      "Toegang tot meer rapporten",
      "Een langere certificeringsopleiding",
    ],
    correct_antwoord: "Aantoonbare praktijkervaring en bijdrage aan de TaPas-gemeenschap",
    feedback_correct: "Correct. TaPas Jester = bewezen praktijkervaring + actieve bijdrage aan de TaPas-community.",
    feedback_fout: "Fout. TaPas Jester onderscheidt zich door aantoonbare praktijkervaring en bijdrage aan de TaPas-community.",
  },
  {
    id: 22, laag: 3, thema: "Instrumenten", vraag_type: "meerkeuze",
    vraag_tekst: "Wanneer is het aangewezen T4Students te gebruiken in plaats van T4P Business Kompas?",
    opties: [
      "Bij jongeren die nog studeren of in transitie zijn naar de arbeidsmarkt",
      "Bij kandidaten voor senior management functies",
      "Bij teams van meer dan 10 personen",
      "Bij deelnemers ouder dan 45 jaar",
    ],
    correct_antwoord: "Bij jongeren die nog studeren of in transitie zijn naar de arbeidsmarkt",
    feedback_correct: "Juist. T4Students is specifiek ontworpen voor de doelgroep 18-23 jaar in studie/transitie.",
    feedback_fout: "Fout. T4Students is ontworpen voor jongeren (18-23j) in studiecontext of overgang naar de arbeidsmarkt.",
  },

  // Laag 4 — Synthese
  {
    id: 23, laag: 4, thema: "Coaching", vraag_type: "meerkeuze",
    vraag_tekst: "Een team van 6 toont collectief hoge extrinsieke drivers en lage intrinsieke drivers. Welk teamcoachingsvraagstuk is het meest urgent?",
    opties: [
      "Teambuilding via gemeenschappelijke activiteiten",
      "Onderzoek naar de teamcultuur en beloningssystemen die intrinsieke motivatie ondermijnen",
      "Individuele coaching voor elk teamlid",
      "Herstructurering van de taakverdeling",
    ],
    correct_antwoord: "Onderzoek naar de teamcultuur en beloningssystemen die intrinsieke motivatie ondermijnen",
    feedback_correct: "Juist. Collectief lage intrinsieke motivatie wijst op een systemisch cultuur- of beloningsprobleem, niet op individuele tekorten.",
    feedback_fout: "Fout. Collectief lage intrinsieke motivatie is een systemisch signaal — de cultuur of beloningsstructuur ondermijnt waarschijnlijk autonomie en groei.",
  },
  {
    id: 24, laag: 4, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Hoe gebruik je een TaPas Kompas en een 2MINSCAN samen in een coachingstraject?",
    opties: [
      "Je gebruikt alleen het Kompas — de 2MINSCAN is overbodig",
      "Kompas voor talentontwikkeling, 2MINSCAN voor energiemanagement — complementair ingezet",
      "2MINSCAN vervangt het Kompas bij korte trajecten",
      "Ze meten hetzelfde en bevestigen elkaar",
    ],
    correct_antwoord: "Kompas voor talentontwikkeling, 2MINSCAN voor energiemanagement — complementair ingezet",
    feedback_correct: "Juist. Kompas = talentgerichte ontwikkeling, 2MINSCAN = energetische gedragslaag. Samen = volledig beeld.",
    feedback_fout: "Fout. Kompas en 2MINSCAN zijn complementair: het Kompas richt zich op talentontwikkeling, de 2MINSCAN op energiebeheer.",
  },
  {
    id: 25, laag: 4, thema: "Drivers", vraag_type: "meerkeuze",
    vraag_tekst: "Een senior manager heeft hoge prestatiefoci maar constateert burnout-symptomen. Hoe interpreteer je dit via de TaPas-lens?",
    opties: [
      "De TaPas-meting is fout — prestatiegerichte mensen krijgen geen burnout",
      "Hoge prestatiefoci + overwegend extrinsieke drivers + lage energie = klassiek uitputtingsprofiel",
      "De manager heeft te lage talentversnellers",
      "Het is een persoonlijk karaterprobleem buiten het TaPas-model",
    ],
    correct_antwoord: "Hoge prestatiefoci + overwegend extrinsieke drivers + lage energie = klassiek uitputtingsprofiel",
    feedback_correct: "Correct. Dit is een klassiek TaPas-uitputtingsprofiel: de brandstof is extrinsiek, de energie is op.",
    feedback_fout: "Fout. TaPas beschrijft dit patroon als een uitputtingsprofiel: hoge prestatiefoci gedreven door extrinsieke motivatie met lage energiereserves.",
  },
  {
    id: 26, laag: 4, thema: "Coaching", vraag_type: "meerkeuze",
    vraag_tekst: "Een organisatie wil TaPas inzetten als selectie-instrument. Hoe reageer je als TaPas Jester?",
    opties: [
      "Je helpt hen het instrument aan te passen voor selectie",
      "Je legt uit dat TaPas uitsluitend voor ontwikkeling bedoeld is en adviseert alternatieve selectie-instrumenten",
      "Je gebruikt het discreet toch als selectie-tool",
      "Je vraagt meer informatie voor je een standpunt inneemt",
    ],
    correct_antwoord: "Je legt uit dat TaPas uitsluitend voor ontwikkeling bedoeld is en adviseert alternatieve selectie-instrumenten",
    feedback_correct: "Juist. Als TaPas Jester ben je ethisch gebonden aan het ontwikkelingsdoel van het instrument.",
    feedback_fout: "Fout. Een TaPas Jester verdedigt de ethische grenzen van het instrument: TaPas is geen selectie-instrument.",
  },
  {
    id: 27, laag: 4, thema: "TaPas-methodiek", vraag_type: "meerkeuze",
    vraag_tekst: "Wat is de rol van het 'mantra' in een T4Students-rapport?",
    opties: [
      "Een motiverende slogan voor marketingdoeleinden",
      "Een kernzin die de essentie van het profiel samenvat en als coachingsinstrument dient",
      "Een technische samenvatting voor de coach",
      "Een verplicht onderdeel van de testprocedure",
    ],
    correct_antwoord: "Een kernzin die de essentie van het profiel samenvat en als coachingsinstrument dient",
    feedback_correct: "Correct. Het mantra is een krachtige kernzin die de deelnemer helpt zijn profiel te internaliseren.",
    feedback_fout: "Fout. Het mantra is een kernzin die de essentie van het profiel samenvat en als coachingsinstrument dient in het gesprek.",
  },
  {
    id: 28, laag: 4, thema: "Energiemanagement", vraag_type: "meerkeuze",
    vraag_tekst: "Een deelnemer scoort hoog op een focus die hem energie geeft, maar de organisatiecontext biedt geen ruimte voor die focus. Wat adviseert TaPas?",
    opties: [
      "De deelnemer moet zijn focus aanpassen aan de context",
      "Onderzoek of er andere rollen of projecten zijn die de focus wél kunnen activeren",
      "De deelnemer verliest snel zijn motivatie — dat is onvermijdelijk",
      "Het energieniveau zal vanzelf dalen door gewenning",
    ],
    correct_antwoord: "Onderzoek of er andere rollen of projecten zijn die de focus wél kunnen activeren",
    feedback_correct: "Juist. TaPas-coaching zoekt naar contextoptimalisatie: hoe kan de omgeving de talent-energie beter benutten?",
    feedback_fout: "Fout. TaPas-coaching gaat niet over aanpassing van de persoon, maar over optimalisatie van de context.",
  },
  {
    id: 29, laag: 4, thema: "TaPas Jester", vraag_type: "meerkeuze",
    vraag_tekst: "Hoe verschilt de TaPas-aanpak van traditionele competentiemanagement-systemen?",
    opties: [
      "TaPas is eenvoudiger en goedkoper",
      "TaPas vertrekt van energie en gedragspatronen, niet van een vaste competentieladder",
      "TaPas is wetenschappelijk minder onderbouwd",
      "TaPas richt zich enkel op technische vaardigheden",
    ],
    correct_antwoord: "TaPas vertrekt van energie en gedragspatronen, niet van een vaste competentieladder",
    feedback_correct: "Correct. TaPas is energiegericht en descriptief — geen normatieve competentieladder.",
    feedback_fout: "Fout. Het fundamentele verschil: TaPas werkt met energie en gedragspatronen, niet met een normatieve competentieladder.",
  },
  {
    id: 30, laag: 4, thema: "Coaching", vraag_type: "meerkeuze",
    vraag_tekst: "Een coach wil het TaPas Kompas en de Coachatlas beide inzetten. Wat is de correcte volgorde?",
    opties: [
      "Eerst Coachatlas, dan Kompas in het gesprek",
      "Kompas voor de deelnemer in het gesprek, Coachatlas als voorbereiding voor de coach",
      "Beide tegelijk aan de deelnemer geven",
      "Eerst Coachatlas, dan na 2 weken het Kompas",
    ],
    correct_antwoord: "Kompas voor de deelnemer in het gesprek, Coachatlas als voorbereiding voor de coach",
    feedback_correct: "Juist. Coachatlas = voorbereiding voor de coach. Kompas = het gespreksdocument voor de deelnemer.",
    feedback_fout: "Fout. De Coachatlas is een voorbereidingsdocument voor de coach; het Kompas is het gespreksdocument dat samen met de deelnemer doorgenomen wordt.",
  },
];

// ---------------------------------------------------------------------------
// Auth-helpers
// ---------------------------------------------------------------------------

function getPractitionerId(req: Request): number | null {
  const s = (req.session as any);
  return s?.coachId ?? s?.adminId ?? null;
}

function requirePractitioner(req: Request, res: Response): boolean {
  const id = getPractitionerId(req);
  if (!id) {
    res.status(401).json({ error: "Niet ingelogd." });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Scoring-helpers
// ---------------------------------------------------------------------------

const INSCHALING_LABELS: Record<string, string> = {
  expert: "Expert",
  meer_dan_voldoende: "Meer dan voldoende",
  net_voldoende: "Net voldoende",
  onvoldoende: "Onvoldoende",
};

function bepaalInschaling(score: number): string {
  if (score >= 0.85) return "expert";
  if (score >= 0.70) return "meer_dan_voldoende";
  if (score >= 0.55) return "net_voldoende";
  return "onvoldoende";
}

function bepaalReminderDagen(inschaling: string): number {
  return inschaling === "expert" ? 21 : inschaling === "meer_dan_voldoende" ? 14 : 7;
}

// ---------------------------------------------------------------------------
// Vraag-selectie (adaptief, gewogen naar zwakke lagen)
// ---------------------------------------------------------------------------

function selecteerVragen(beheerderId: number, aantal: number): StmVraag[] {
  const sessieIds = stmSessiesByBeheerder.get(beheerderId) || [];
  const laagScores: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const sid of sessieIds) {
    const sessie = stmSessies.get(sid);
    if (!sessie?.scores_per_laag) continue;
    for (let l = 1; l <= 4; l++) {
      const v = sessie.scores_per_laag[`laag${l}`];
      if (v !== undefined) laagScores[l].push(v);
    }
  }

  // Gemiddelde per laag; lege lagen krijgen gewicht 1
  const gemiddelden: Record<number, number> = {};
  for (let l = 1; l <= 4; l++) {
    gemiddelden[l] = laagScores[l].length > 0
      ? laagScores[l].reduce((a, b) => a + b, 0) / laagScores[l].length
      : 0.5;
  }

  // Gewicht: lagere score = meer vragen
  const gewichten: Record<number, number> = {};
  const totaal = Object.values(gemiddelden).reduce((a, b) => a + (1 - b), 0) || 4;
  for (let l = 1; l <= 4; l++) {
    gewichten[l] = Math.max(1, Math.round(((1 - gemiddelden[l]) / totaal) * aantal));
  }

  // Verdeel aantal vragen over lagen
  const perLaag = [1, 2, 3, 4].map(l => ({
    laag: l,
    count: gewichten[l],
  }));

  // Normaliseer naar exacte `aantal`
  let sum = perLaag.reduce((a, b) => a + b.count, 0);
  let i = 0;
  while (sum < aantal) { perLaag[i % 4].count++; sum++; i++; }
  while (sum > aantal) { const j = perLaag.findIndex(x => x.count > 1); if (j === -1) break; perLaag[j].count--; sum--; }

  // Selecteer vragen per laag (willekeurig)
  const geselecteerd: StmVraag[] = [];
  for (const { laag, count } of perLaag) {
    const pool = VRAAGBANK.filter(v => v.laag === laag);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    geselecteerd.push(...shuffled.slice(0, Math.min(count, pool.length)));
  }

  return geselecteerd.sort(() => Math.random() - 0.5);
}

// ---------------------------------------------------------------------------
// Route-registratie
// ---------------------------------------------------------------------------

export function registerStmRoutes(app: Express, storage: any): void {

  // ── Coach login ─────────────────────────────────────────────────────────

  app.post("/api/coach/login", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "E-mail verplicht." });
    const beheerder = await storage.getBeheerderByEmail(email.trim().toLowerCase());
    if (!beheerder || !beheerder.actief) {
      return res.status(401).json({ error: "Geen actief account gevonden." });
    }
    (req.session as any).coachId = beheerder.id;
    req.session.save((err: unknown) => {
      if (err) return res.status(500).json({ error: "Sessie kon niet opgeslagen worden." });
      res.json({ ok: true, naam: beheerder.naam, email: beheerder.email, isPrior: beheerder.isPrior });
    });
  });

  app.get("/api/coach/me", async (req, res) => {
    const id = getPractitionerId(req);
    if (!id) return res.status(401).json({ error: "Niet ingelogd." });
    const beheerder = await storage.getBeheerder(Number(id));
    if (!beheerder || !beheerder.actief) return res.status(401).json({ error: "Sessie verlopen." });
    res.json({ ok: true, naam: beheerder.naam, email: beheerder.email, isPrior: beheerder.isPrior });
  });

  app.post("/api/coach/logout", (req, res) => {
    (req.session as any).coachId = undefined;
    req.session.save(() => res.json({ ok: true }));
  });

  // ── STM: start sessie ───────────────────────────────────────────────────

  app.post("/api/stm/start", (req, res) => {
    if (!requirePractitioner(req, res)) return;
    const beheerderId = getPractitionerId(req)!;
    const aantal = Math.min(Number(req.body?.aantal) || 12, 20);

    const vragen = selecteerVragen(beheerderId, aantal);
    const id = sessieCounter++;

    stmSessies.set(id, {
      id,
      beheerder_id: beheerderId,
      gestart_at: new Date().toISOString(),
      afgerond_at: null,
      score_totaal: null,
      inschaling: null,
      duur_seconden: null,
      scores_per_laag: {},
      feedback: [],
    });

    if (!stmSessiesByBeheerder.has(beheerderId)) stmSessiesByBeheerder.set(beheerderId, []);
    stmSessiesByBeheerder.get(beheerderId)!.push(id);

    // Stuur vragen zonder correct_antwoord naar de client
    const vragenVoorClient = vragen.map(v => ({
      id: v.id,
      vraag_tekst: v.vraag_tekst,
      thema: v.thema,
      laag: v.laag,
      vraag_type: v.vraag_type,
      opties: v.opties,
    }));

    res.json({ sessie_id: id, vragen: vragenVoorClient });
  });

  // ── STM: afronden ───────────────────────────────────────────────────────

  app.post("/api/stm/afronden", (req, res) => {
    if (!requirePractitioner(req, res)) return;
    const beheerderId = getPractitionerId(req)!;
    const { sessie_id, antwoorden, duur_seconden } = req.body || {};

    const sessie = stmSessies.get(Number(sessie_id));
    if (!sessie || sessie.beheerder_id !== beheerderId) {
      return res.status(404).json({ error: "Sessie niet gevonden." });
    }
    if (sessie.afgerond_at) {
      return res.status(400).json({ error: "Sessie al afgerond." });
    }

    // Score berekenen
    const correctPerLaag: Record<number, { correct: number; totaal: number }> = {
      1: { correct: 0, totaal: 0 },
      2: { correct: 0, totaal: 0 },
      3: { correct: 0, totaal: 0 },
      4: { correct: 0, totaal: 0 },
    };
    const feedback: StmSessieRecord["feedback"] = [];

    // Bepaal welke vragen in deze sessie zaten (via antwoorden)
    const vraagIds = Object.keys(antwoorden || {}).map(Number);
    for (const vraagId of vraagIds) {
      const vraag = VRAAGBANK.find(v => v.id === vraagId);
      if (!vraag) continue;
      const antwoord = antwoorden[vraagId];
      const correct = antwoord === vraag.correct_antwoord;
      correctPerLaag[vraag.laag].totaal++;
      if (correct) correctPerLaag[vraag.laag].correct++;
      feedback.push({
        vraag_id: vraagId,
        correct,
        feedback: correct ? vraag.feedback_correct : vraag.feedback_fout,
      });
    }

    const scoresPerLaag: Record<string, number> = {};
    let totaalCorrect = 0;
    let totaalVragen = 0;
    for (let l = 1; l <= 4; l++) {
      const { correct, totaal } = correctPerLaag[l];
      scoresPerLaag[`laag${l}`] = totaal > 0 ? correct / totaal : 0;
      totaalCorrect += correct;
      totaalVragen += totaal;
    }
    const scoreTotaal = totaalVragen > 0 ? totaalCorrect / totaalVragen : 0;
    const inschaling = bepaalInschaling(scoreTotaal);

    sessie.afgerond_at = new Date().toISOString();
    sessie.score_totaal = scoreTotaal;
    sessie.inschaling = inschaling;
    sessie.duur_seconden = Number(duur_seconden) || null;
    sessie.scores_per_laag = scoresPerLaag;
    sessie.feedback = feedback;

    res.json({
      ok: true,
      inschaling,
      inschaling_label: INSCHALING_LABELS[inschaling],
      scores: {
        totaal: scoreTotaal,
        laag1: scoresPerLaag.laag1,
        laag2: scoresPerLaag.laag2,
        laag3: scoresPerLaag.laag3,
        laag4: scoresPerLaag.laag4,
      },
      feedback,
      reminder_over_dagen: bepaalReminderDagen(inschaling),
    });
  });

  // ── STM: historiek ──────────────────────────────────────────────────────

  app.get("/api/stm/historiek", (req, res) => {
    if (!requirePractitioner(req, res)) return;
    const beheerderId = getPractitionerId(req)!;
    const ids = stmSessiesByBeheerder.get(beheerderId) || [];
    const sessies = ids
      .map(id => stmSessies.get(id))
      .filter(s => s?.afgerond_at)
      .sort((a, b) => (b!.afgerond_at! > a!.afgerond_at! ? 1 : -1));
    res.json({ sessies });
  });

  // ── STM: laagscores (geaggregeerd) ─────────────────────────────────────

  app.get("/api/stm/laagscores", (req, res) => {
    if (!requirePractitioner(req, res)) return;
    const beheerderId = getPractitionerId(req)!;
    const ids = stmSessiesByBeheerder.get(beheerderId) || [];
    const afgerond = ids.map(id => stmSessies.get(id)).filter(s => s?.afgerond_at);

    if (afgerond.length === 0) {
      return res.json({ scores: null });
    }

    const laagSommen: Record<string, number[]> = { laag1: [], laag2: [], laag3: [], laag4: [] };
    let latestDate: string | null = null;
    for (const s of afgerond) {
      for (const k of Object.keys(laagSommen)) {
        const v = s!.scores_per_laag[k];
        if (v !== undefined) laagSommen[k].push(v);
      }
      if (!latestDate || s!.afgerond_at! > latestDate) latestDate = s!.afgerond_at;
    }

    const gem = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    res.json({
      scores: {
        sessies_totaal: afgerond.length,
        laag1: gem(laagSommen.laag1),
        laag2: gem(laagSommen.laag2),
        laag3: gem(laagSommen.laag3),
        laag4: gem(laagSommen.laag4),
        laatste_sessie: latestDate,
      },
    });
  });

  // ── Coach-detectie via deelnemers-token ────────────────────────────────────
  // Controleert of de deelnemer (via email-match) een actieve beheerder is.
  // Retourneert { isCoach, beheerderId, naam }

  app.get("/api/dashboard/:token/is-coach", async (req: Request, res: Response) => {
    const { token } = req.params;
    try {
      const deelnemer = await storage.getDeelnemerByToken(token);
      if (!deelnemer?.email) return res.json({ isCoach: false, beheerderId: null });

      const beheerder = await storage.getBeheerderByEmail(deelnemer.email);
      if (!beheerder || !beheerder.actief) return res.json({ isCoach: false, beheerderId: null });

      return res.json({ isCoach: true, beheerderId: beheerder.id, naam: beheerder.naam });
    } catch (e) {
      return res.json({ isCoach: false, beheerderId: null });
    }
  });

  // ── Token-auth helper (voor dashboard-integratie) ──────────────────────────
  // Accepteert sessie-auth (adminId/coachId) OF token via query/body.

  async function resolveBeheerderId(req: Request, res: Response): Promise<number | null> {
    const sessieId = getPractitionerId(req);
    if (sessieId) return sessieId;

    const token = (req.query.token || req.body?.token) as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Niet ingelogd en geen token opgegeven." });
      return null;
    }
    const deelnemer = await storage.getDeelnemerByToken(token);
    if (!deelnemer?.email) {
      res.status(401).json({ error: "Ongeldig token." });
      return null;
    }
    const beheerder = await storage.getBeheerderByEmail(deelnemer.email);
    if (!beheerder || !beheerder.actief) {
      res.status(403).json({ error: "Geen actieve coach-account." });
      return null;
    }
    return beheerder.id;
  }

  // ── STM via token: start ───────────────────────────────────────────────────

  app.post("/api/stm/token/start", async (req: Request, res: Response) => {
    const beheerderId = await resolveBeheerderId(req, res);
    if (beheerderId === null) return;

    const aantal = Math.min(Number(req.body?.aantal) || 12, 20);
    const vragen = selecteerVragen(beheerderId, aantal);
    const id = sessieCounter++;

    stmSessies.set(id, {
      id, beheerder_id: beheerderId,
      gestart_at: new Date().toISOString(),
      afgerond_at: null, score_totaal: null, inschaling: null,
      duur_seconden: null, scores_per_laag: {}, feedback: [],
    });
    if (!stmSessiesByBeheerder.has(beheerderId)) stmSessiesByBeheerder.set(beheerderId, []);
    stmSessiesByBeheerder.get(beheerderId)!.push(id);

    const vragenVoorClient = vragen.map(v => ({
      id: v.id, vraag_tekst: v.vraag_tekst, thema: v.thema,
      laag: v.laag, vraag_type: v.vraag_type, opties: v.opties,
    }));
    res.json({ sessie_id: id, vragen: vragenVoorClient });
  });

  // ── STM via token: afronden ────────────────────────────────────────────────

  app.post("/api/stm/token/afronden", async (req: Request, res: Response) => {
    const beheerderId = await resolveBeheerderId(req, res);
    if (beheerderId === null) return;

    const { sessie_id, antwoorden, duur_seconden } = req.body || {};
    const sessie = stmSessies.get(Number(sessie_id));
    if (!sessie || sessie.beheerder_id !== beheerderId) {
      return res.status(404).json({ error: "Sessie niet gevonden." });
    }
    if (sessie.afgerond_at) return res.status(400).json({ error: "Sessie al afgerond." });

    const correctPerLaag: Record<number, { correct: number; totaal: number }> = {
      1: { correct: 0, totaal: 0 }, 2: { correct: 0, totaal: 0 },
      3: { correct: 0, totaal: 0 }, 4: { correct: 0, totaal: 0 },
    };
    const feedback: StmSessieRecord["feedback"] = [];
    const vraagIds = Object.keys(antwoorden || {}).map(Number);
    for (const vraagId of vraagIds) {
      const vraag = VRAAGBANK.find(v => v.id === vraagId);
      if (!vraag) continue;
      const antwoord = antwoorden[vraagId];
      const correct = antwoord === vraag.correct_antwoord;
      correctPerLaag[vraag.laag].totaal++;
      if (correct) correctPerLaag[vraag.laag].correct++;
      feedback.push({ vraag_id: vraagId, correct, feedback: correct ? vraag.feedback_correct : vraag.feedback_fout });
    }
    const scoresPerLaag: Record<string, number> = {};
    let totaalCorrect = 0; let totaalVragen = 0;
    for (let l = 1; l <= 4; l++) {
      const { correct, totaal } = correctPerLaag[l];
      scoresPerLaag[`laag${l}`] = totaal > 0 ? correct / totaal : 0;
      totaalCorrect += correct; totaalVragen += totaal;
    }
    const scoreTotaal = totaalVragen > 0 ? totaalCorrect / totaalVragen : 0;
    const inschaling = bepaalInschaling(scoreTotaal);
    sessie.afgerond_at = new Date().toISOString();
    sessie.score_totaal = scoreTotaal;
    sessie.inschaling = inschaling;
    sessie.duur_seconden = Number(duur_seconden) || null;
    sessie.scores_per_laag = scoresPerLaag;
    sessie.feedback = feedback;

    res.json({
      ok: true, inschaling,
      inschaling_label: INSCHALING_LABELS[inschaling],
      scores: { totaal: scoreTotaal, laag1: scoresPerLaag.laag1, laag2: scoresPerLaag.laag2, laag3: scoresPerLaag.laag3, laag4: scoresPerLaag.laag4 },
      feedback, reminder_over_dagen: bepaalReminderDagen(inschaling),
    });
  });

  // ── STM via token: historiek ───────────────────────────────────────────────

  app.get("/api/stm/token/historiek", async (req: Request, res: Response) => {
    const beheerderId = await resolveBeheerderId(req, res);
    if (beheerderId === null) return;
    const ids = stmSessiesByBeheerder.get(beheerderId) || [];
    const sessies = ids.map(id => stmSessies.get(id))
      .filter(s => s?.afgerond_at)
      .sort((a, b) => (b!.afgerond_at! > a!.afgerond_at! ? 1 : -1));
    res.json({ sessies });
  });

  // ── STM via token: laagscores ──────────────────────────────────────────────

  app.get("/api/stm/token/laagscores", async (req: Request, res: Response) => {
    const beheerderId = await resolveBeheerderId(req, res);
    if (beheerderId === null) return;
    const ids = stmSessiesByBeheerder.get(beheerderId) || [];
    const afgerond = ids.map(id => stmSessies.get(id)).filter(s => s?.afgerond_at);
    if (afgerond.length === 0) return res.json({ scores: null });
    const laagSommen: Record<string, number[]> = { laag1: [], laag2: [], laag3: [], laag4: [] };
    let latestDate: string | null = null;
    for (const s of afgerond) {
      for (const k of Object.keys(laagSommen)) {
        const v = s!.scores_per_laag[k];
        if (v !== undefined) laagSommen[k].push(v);
      }
      if (!latestDate || s!.afgerond_at! > latestDate) latestDate = s!.afgerond_at;
    }
    const gem = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    res.json({
      scores: {
        sessies_totaal: afgerond.length,
        laag1: gem(laagSommen.laag1), laag2: gem(laagSommen.laag2),
        laag3: gem(laagSommen.laag3), laag4: gem(laagSommen.laag4),
        laatste_sessie: latestDate,
      },
    });
  });

  // ── Kwaliteitsmonitor: in-memory status per beheerder ─────────────────────
  // Statusoverrides en alerts worden in-memory bijgehouden (geen DB-migratie).

  const kwaliteitOverrides = new Map<number, { status?: string; norm?: number }>();
  const alertSentFlags = new Map<number, { trap1?: boolean; trap2?: boolean; trap3?: boolean }>();
  const mailLog: Array<{ beheerderId: number; trap: number; verstuurdAt: string; email: string; naam: string }> = [];

  function berekenKwaliteitsStatus(beheerderId: number): {
    afnames_count: number; norm: number; verwacht: number;
    progressie_pct: number; status_berekend: string; voorspelling_einde_jaar: number;
  } {
    const now = new Date();
    const startJaar = new Date(now.getFullYear(), 0, 1);
    const eindJaar = new Date(now.getFullYear(), 11, 31);
    const dagenVerstreken = Math.floor((now.getTime() - startJaar.getTime()) / 86400000);
    const dagenTotaal = Math.floor((eindJaar.getTime() - startJaar.getTime()) / 86400000);

    const ids = stmSessiesByBeheerder.get(beheerderId) || [];
    const jaarSessies = ids
      .map(id => stmSessies.get(id))
      .filter(s => s?.afgerond_at && s.afgerond_at.startsWith(String(now.getFullYear())));

    const norm = kwaliteitOverrides.get(beheerderId)?.norm ?? 12;
    const afnames_count = jaarSessies.length;
    const verwacht = Math.round((dagenVerstreken / dagenTotaal) * norm);
    const progressie_pct = norm > 0 ? Math.round((afnames_count / norm) * 100) : 0;
    const gemVsVerwacht = verwacht > 0 ? afnames_count / verwacht : 1;

    let status_berekend: string;
    const override = kwaliteitOverrides.get(beheerderId)?.status;
    if (override && ["opgeschort", "uitzondering"].includes(override)) {
      status_berekend = override;
    } else if (progressie_pct >= 100) {
      status_berekend = "norm_gehaald";
    } else if (gemVsVerwacht >= 0.75) {
      status_berekend = "actief";
    } else if (gemVsVerwacht >= 0.50) {
      status_berekend = "achterstand_25";
    } else {
      status_berekend = "achterstand_50";
    }

    const dagelijksTempo = dagenVerstreken > 0 ? afnames_count / dagenVerstreken : 0;
    const voorspelling_einde_jaar = Math.round(dagelijksTempo * dagenTotaal);
    return { afnames_count, norm, verwacht, progressie_pct, status_berekend, voorspelling_einde_jaar };
  }

  // GET /api/kwaliteit/dashboard?jaar=
  app.get("/api/kwaliteit/dashboard", async (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Enkel toegankelijk voor admins." });
    try {
      const alleBeheerders = await storage.listBeheerders();
      const practitioners = alleBeheerders.map((b: any) => {
        const stats = berekenKwaliteitsStatus(b.id);
        const alerts = alertSentFlags.get(b.id) || {};
        return {
          beheerder_id: b.id, naam: b.naam, email: b.email,
          ...stats,
          alert_trap1_sent: alerts.trap1 ?? false,
          alert_trap2_sent: alerts.trap2 ?? false,
          alert_trap3_sent: alerts.trap3 ?? false,
        };
      });
      res.json({ practitioners });
    } catch (e) {
      res.status(500).json({ error: "Kon data niet laden." });
    }
  });

  // PUT /api/kwaliteit/:id/norm
  app.put("/api/kwaliteit/:id/norm", (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Geen toegang." });
    const id = Number(req.params.id);
    const norm = Number(req.body?.norm);
    if (!norm || norm < 1 || norm > 500) return res.status(400).json({ error: "Ongeldige norm." });
    const bestaand = kwaliteitOverrides.get(id) || {};
    kwaliteitOverrides.set(id, { ...bestaand, norm });
    res.json({ ok: true, norm });
  });

  // POST /api/kwaliteit/:id/alert (trap 1/2/3)
  app.post("/api/kwaliteit/:id/alert", async (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Geen toegang." });
    const id = Number(req.params.id);
    const trap = Number(req.body?.trap);
    if (![1, 2, 3].includes(trap)) return res.status(400).json({ error: "Ongeldige trap." });
    try {
      const beheerder = await storage.getBeheerder(id);
      if (!beheerder) return res.status(404).json({ error: "Practitioner niet gevonden." });
      mailLog.push({ beheerderId: id, trap, verstuurdAt: new Date().toISOString(), email: beheerder.email, naam: beheerder.naam });
      const flags = alertSentFlags.get(id) || {};
      if (trap === 1) flags.trap1 = true;
      if (trap === 2) flags.trap2 = true;
      if (trap === 3) flags.trap3 = true;
      alertSentFlags.set(id, flags);
      const trapLabels: Record<number, string> = {
        1: "Intern signaal (geen mail naar practitioner)",
        2: "E-mail verstuurd naar practitioner",
        3: "Escalatie — fondateur op de hoogte gebracht",
      };
      res.json({ ok: true, bericht: trapLabels[trap], email: beheerder.email });
    } catch (e) {
      res.status(500).json({ error: "Alert kon niet verstuurd worden." });
    }
  });

  // POST /api/kwaliteit/:id/actie (opschorten / uitzondering / herstel)
  app.post("/api/kwaliteit/:id/actie", (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Geen toegang." });
    const id = Number(req.params.id);
    const actie = req.body?.actie as string;
    if (!["opschorten", "uitzondering", "herstel"].includes(actie)) return res.status(400).json({ error: "Ongeldige actie." });
    const bestaand = kwaliteitOverrides.get(id) || {};
    if (actie === "herstel") {
      kwaliteitOverrides.set(id, { ...bestaand, status: undefined });
    } else {
      kwaliteitOverrides.set(id, { ...bestaand, status: actie === "opschorten" ? "opgeschort" : "uitzondering" });
    }
    res.json({ ok: true, actie });
  });

  // POST /api/kwaliteit/:id/herbereken
  app.post("/api/kwaliteit/:id/herbereken", (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Geen toegang." });
    const id = Number(req.params.id);
    const stats = berekenKwaliteitsStatus(id);
    res.json({ ok: true, ...stats });
  });

  // GET /api/kwaliteit/rapport/kwartaal
  app.get("/api/kwaliteit/rapport/kwartaal", async (req: Request, res: Response) => {
    const s = (req.session as any);
    if (!s?.adminId) return res.status(401).json({ error: "Geen toegang." });
    try {
      const alleBeheerders = await storage.listBeheerders();
      const practitioners = alleBeheerders.map((b: any) => {
        const stats = berekenKwaliteitsStatus(b.id);
        return { beheerder_id: b.id, naam: b.naam, email: b.email, ...stats };
      });
      const totaal_practitioners = practitioners.length;
      const op_schema = practitioners.filter((p: any) => p.status_berekend === "actief").length;
      const norm_gehaald = practitioners.filter((p: any) => p.status_berekend === "norm_gehaald").length;
      const achterstand_licht = practitioners.filter((p: any) => p.status_berekend === "achterstand_25").length;
      const achterstand_zwaar = practitioners.filter((p: any) => p.status_berekend === "achterstand_50").length;
      res.json({
        kwartaal: Math.ceil((new Date().getMonth() + 1) / 3),
        jaar: new Date().getFullYear(),
        samenvatting: { totaal_practitioners, op_schema, norm_gehaald, achterstand_licht, achterstand_zwaar },
        practitioners,
        mail_log: mailLog.slice(-20),
      });
    } catch (e) {
      res.status(500).json({ error: "Rapport kon niet gegenereerd worden." });
    }
  });
}
