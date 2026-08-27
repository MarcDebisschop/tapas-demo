// ===========================================================================
// journey-leiderschap.tsx: de publieke oplossingpagina Leadership & Team
// Energy.
//
// Het tweede traject van de eerste internationale fase. Het gaat over
// leiderschap, vertrouwen, energie en uitvoeringskracht in een bestaande ploeg,
// en levert meer dan een ploegrapport alleen: een begeleide sessie en een
// tweede meting horen erbij.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import { CLUSTERS, LTE_STAPPEN, LTE_UITKOMST, OUTPUTSTAPEL } from "@/data/oplossingen";

const cluster = CLUSTERS.find((c) => c.sleutel === "leiderschap")!;

const inhoud: TrajectInhoud = {
  cluster,
  bovenschrift: "Traject voor directies en teamleiders",
  lead:
    "Een ploeg die niet levert, heeft zelden een gebrek aan goede mensen. Meestal zit de rem in de samenstelling, in de verdeling van de last of in afspraken die nooit uitgesproken werden. Leadership & Team Energy maakt dat zichtbaar, brengt het in één begeleide sessie op tafel en meet na drie maanden of er werkelijk iets verschoven is.",
  stappen: LTE_STAPPEN,
  outputs: OUTPUTSTAPEL.filter((o) => o.nummer <= 3),
  uitkomst: LTE_UITKOMST,
  grenzen: [
    "Geen beoordeling van medewerkers en geen invoer voor een evaluatiegesprek.",
    "Geen diagnose van welzijn of van gezondheid, ook niet wanneer de energie laag staat.",
    "Geen rangschikking van teamleden onderling.",
    "Geen ploegbeeld zonder dat elke deelnemer zijn eigen profiel eerst zelf leest.",
  ],
  prijsuitleg:
    "De afname per deelnemer, het ploegbeeld, de begeleide sessie en de herhaalmeting worden samen begroot. Organisaties die meerdere ploegen per jaar doorlopen, werken doorgaans met een jaarlicentie.",
  testid: "journey-leiderschap",
};

export default function JourneyLeiderschap() {
  return <TrajectPagina inhoud={inhoud} />;
}
