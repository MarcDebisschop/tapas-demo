// ===========================================================================
// journey-hdd.tsx: de publieke oplossingpagina Human Due Diligence.
//
// Dit is de eerste van de twee trajecten waarmee Tapas CORE internationaal
// naar buiten komt. De pagina staat open voor iedereen. De werkomgeving van
// Human Due Diligence zelf blijft waar ze was, achter de aanmelding van de
// begeleider op /hdd.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import { CLUSTERS, HDD_STAPPEN, HDD_UITKOMST, OUTPUTSTAPEL } from "@/data/oplossingen";

const cluster = CLUSTERS.find((c) => c.sleutel === "hdd")!;

const inhoud: TrajectInhoud = {
  cluster,
  bovenschrift: "Traject voor investeerders en besturen",
  lead:
    "Bij een overname, een kapitaalronde of een herstructurering staan de cijfers meestal vast en blijft de vraag over de mensen open. Human Due Diligence brengt die vraag naar hetzelfde niveau als de rest van het dossier: wie draagt het plan, waar zitten de afhankelijkheden, en wat betekent dat voor de eerste honderd dagen na de beslissing.",
  stappen: HDD_STAPPEN,
  outputs: OUTPUTSTAPEL,
  uitkomst: HDD_UITKOMST,
  grenzen: [
    "Geen diagnose en geen uitspraak over de gezondheid van een persoon.",
    "Geen selectiebeslissing in de plaats van de opdrachtgever.",
    "Geen potentieelbepaling en geen voorspelling van toekomstige prestaties.",
    "Geen profiel zonder de toestemming en de terugkoppeling van de deelnemer zelf.",
  ],
  prijsuitleg:
    "Het tarief bevat de intake, de afname van alle deelnemers, de synthese, de bestuursklare oplevering en de mondelinge toelichting. De omvang van de ploeg bepaalt in welke schijf een dossier valt.",
  testid: "journey-hdd",
};

export default function JourneyHdd() {
  return <TrajectPagina inhoud={inhoud} />;
}
