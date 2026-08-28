// ===========================================================================
// journey-hdd.tsx: de publieke oplossingpagina Human Due Diligence.
//
// Dit is de eerste van de twee trajecten waarmee Tapas CORE internationaal
// naar buiten komt. De pagina staat open voor iedereen. De werkomgeving van
// Human Due Diligence zelf blijft waar ze was, achter de aanmelding van de
// begeleider op /hdd.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import {
  AANSLUITING_RECRUITMENT,
  CLUSTERS,
  HDD_OUTPUTS,
  HDD_STAPPEN,
  HDD_UITKOMST,
} from "@/data/oplossingen";

const cluster = CLUSTERS.find((c) => c.sleutel === "hdd")!;

const inhoud: TrajectInhoud = {
  cluster,
  bovenschrift: "Traject voor investeerders en besturen",
  lead:
    "Bij een overname, een kapitaalronde of een herstructurering staan de cijfers meestal vast en blijft de vraag over de mensen open. Human Due Diligence brengt die vraag naar hetzelfde niveau als de rest van het dossier: wie draagt het plan, waar zitten de afhankelijkheden, en wat betekent dat voor de eerste honderd dagen na de beslissing. Het traject werkt in twee fasen, met een hard beslismoment ertussen: eerst een verkenning van de ploeg, en enkel wanneer die geen dysfunctionele signalen laat zien een diepteanalyse van de sleutelfiguren.",
  stappen: HDD_STAPPEN,
  trajectkop: "Twee fasen, met een hard beslismoment ertussen",
  trajectuitleg:
    "Fase één kijkt naar de ploeg als geheel. Zijn er dysfunctionele signalen, dan stopt het traject daar. Blijven die uit, dan start fase twee, met als centrale vraag of deze ploeg de ambitie kan waarmaken.",
  outputs: HDD_OUTPUTS,
  uitkomst: HDD_UITKOMST,
  grenzen: [
    "Geen diagnose en geen uitspraak over de gezondheid van een persoon.",
    "Geen selectiebeslissing in de plaats van de opdrachtgever.",
    "Geen potentieelbepaling en geen voorspelling van toekomstige prestaties.",
    "Geen profiel zonder de toestemming en de terugkoppeling van de deelnemer zelf.",
    "Geen vaststelling over cognitieve capaciteit. Die laag is een indicatie op basis van zelfrapportage en wordt als indicatie benoemd.",
  ],
  prijsuitleg:
    "Het tarief bevat de intake, de afname van alle deelnemers, het Go of No-Go-moment, de synthese, de oplevering van de twee rapporten en de mondelinge toelichting. De omvang van de ploeg bepaalt in welke schijf een dossier valt. De rapporten van dit traject zijn in het Engels opgesteld.",
  // Human Due Diligence maakt zichtbaar of het huidige team de ambitie kan
  // waarmaken. Blijkt dat niet zo, dan volgt de vraag naar externe instroom.
  // Die brug hoort erbij, maar mag het traject niet overnemen.
  aansluiting: {
    tekst: AANSLUITING_RECRUITMENT.hdd,
    pad: "/oplossingen/recruitment-role-fit",
    linktekst: "Bekijk Recruitment & Role Fit",
  },
  // De film hoort op deze pagina en niet op de onthaalpagina: ze legt precies
  // dit traject uit, in de stem van het platform, met ondertitels als spoor.
  film: {
    bovenschrift: "Het traject in beeld",
    kop: "Ruim een minuut over Human Due Diligence",
    uitleg:
      "Van de aanleiding tot de twee rapporten, met het beslismoment tussen de twee fasen. Wie liever leest: alles wat de film zegt staat hieronder ook uitgeschreven.",
    bron: "/film/hdd-nl.mp4",
    poster: "/film/hdd-nl-beeld.jpg",
    ondertitels: "/film/hdd-nl.vtt",
    // Twee taalversies: het dossier van dit traject is internationaal, dus de
    // film staat er ook in het Engels, met een eigen ondertitelspoor.
    versies: [
      {
        taal: "nl",
        label: "Nederlands",
        bron: "/film/hdd-nl.mp4",
        poster: "/film/hdd-nl-beeld.jpg",
        ondertitels: "/film/hdd-nl.vtt",
      },
      {
        taal: "en",
        label: "English",
        bron: "/film/hdd-en.mp4",
        poster: "/film/hdd-en-beeld.jpg",
        ondertitels: "/film/hdd-en.vtt",
      },
    ],
    onderschrift:
      "Gesproken uitleg in het Nederlands of in het Engels. Ondertitels zijn in de speler aan te zetten.",
    testid: "hdd-film",
  },
  testid: "journey-hdd",
};

export default function JourneyHdd() {
  return <TrajectPagina inhoud={inhoud} />;
}
