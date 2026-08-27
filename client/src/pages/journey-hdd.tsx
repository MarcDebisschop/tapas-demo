// ===========================================================================
// journey-hdd.tsx: de publieke oplossingpagina Human Due Diligence.
//
// Dit is de eerste van de twee trajecten waarmee Tapas CORE internationaal
// naar buiten komt. De pagina staat open voor iedereen. De werkomgeving van
// Human Due Diligence zelf blijft waar ze was, achter de aanmelding van de
// begeleider op /hdd.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import { CLUSTERS, HDD_OUTPUTS, HDD_STAPPEN, HDD_UITKOMST } from "@/data/oplossingen";

const cluster = CLUSTERS.find((c) => c.sleutel === "hdd")!;

const inhoud: TrajectInhoud = {
  cluster,
  bovenschrift: "Traject voor investeerders en besturen",
  lead:
    "Bij een overname, een kapitaalronde of een herstructurering staan de cijfers meestal vast en blijft de vraag over de mensen open. Human Due Diligence brengt die vraag naar hetzelfde niveau als de rest van het dossier: wie draagt het plan, waar zitten de afhankelijkheden, en wat betekent dat voor de eerste honderd dagen na de beslissing. Het traject werkt in twee fasen, met een Go of No-Go ertussen: eerst een verkenning van de ploeg, en enkel bij een ernstig signaal een diepteanalyse van de sleutelfiguren.",
  stappen: HDD_STAPPEN,
  trajectkop: "Twee fasen, met een Go of No-Go ertussen",
  trajectuitleg:
    "Fase één kijkt naar de ploeg als geheel. Wat daar aan het licht komt, bepaalt of fase twee nodig is. Een dossier zonder signalen stopt na fase één.",
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
  testid: "journey-hdd",
};

export default function JourneyHdd() {
  return <TrajectPagina inhoud={inhoud} />;
}
