// ===========================================================================
// journey-recruitment.tsx: de publieke oplossingpagina Recruitment & Role Fit.
//
// De vierde journey van het producthuis. Ze gebruikt dezelfde Core Engine als
// de andere trajecten: talentfoci, versnellers, drivers en energie, nu gelegd
// naast een rolprofiel dat door de betrokkenen rond de functie zelf gebouwd
// wordt. T4Recruitment blijft de instrumentnaam onder deze journey; de
// werkomgeving van dat instrument blijft waar ze was, achter de aanmelding.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import { CLUSTERS, OUTPUTSTAPEL, RR_STAPPEN, RR_UITKOMST } from "@/data/oplossingen";

const cluster = CLUSTERS.find((c) => c.sleutel === "recruitment")!;

const inhoud: TrajectInhoud = {
  cluster,
  bovenschrift: "Traject voor HR, recruiters en leidinggevenden",
  lead:
    "Een cv vertelt vooral wat iemand deed. De vraag bij een aanwerving is een andere: waar komen kandidaat, rol en context werkelijk samen. Recruitment & Role Fit vertrekt daarom niet van de vacaturetekst alleen, maar van een rolprofiel dat de betrokkenen rond de functie samen opbouwen, en legt daarnaast wat een kandidaat van nature vlot afgaat, wat energie geeft of kost, en welke drivers betrokkenheid duurzaam of net kwetsbaar maken.",
  stappen: RR_STAPPEN,
  trajectkop: "Eerst de rol, dan de kandidaat",
  trajectuitleg:
    "Het rolprofiel komt eerst en wordt gedragen door de mensen rond de functie. Pas daarna wordt een kandidaatprofiel ernaast gelegd. Zo wordt de vergelijking gevoerd op wat de rol vraagt, en niet op de indruk van het laatste gesprek.",
  // De eerste drie lagen van de vaste outputstapel: de kandidaat leest zijn
  // eigen profiel, de recruiter krijgt de gespreksleidraad, HR en de
  // leidinggevende het beeld op rol- en teamniveau.
  outputs: OUTPUTSTAPEL.filter((o) => o.nummer <= 3),
  uitkomst: RR_UITKOMST,
  grenzen: [
    "Geen automatische selectie en geen rangschikking die de keuze in de plaats van de organisatie maakt.",
    "Geen vervanging van het selectiegesprek, van referentiecontrole of van vakinhoudelijke beoordeling.",
    "Geen diagnose, geen uitspraak over gezondheid en geen voorspelling van toekomstige prestaties.",
    "Geen profiel zonder de toestemming van de kandidaat en zonder terugkoppeling aan de kandidaat zelf.",
    "Geen uitspraak over ervaring, diploma's of technische bekwaamheid. Die blijven bij de opdrachtgever.",
  ],
  prijsuitleg:
    "Het tarief per kandidaat bevat de afname, de vergelijkende studie en het fit-rapport. Het rolprofiel via de kring wordt eenmaal per rol begroot. Organisaties die meerdere rollen per jaar openzetten, werken doorgaans met bundels of een jaarvolume.",
  film: {
    bovenschrift: "Het traject in beeld",
    kop: "Ruim een minuut over Recruitment & Role Fit",
    uitleg:
      "Van de vacature tot het besluit, met de vier bouwstenen van de match ertussen. Wie liever leest: alles wat de film zegt staat in de ondertitels.",
    bron: "/film/rrf-nl.mp4",
    poster: "/film/rrf-nl-beeld.jpg",
    ondertitels: "/film/rrf-nl.vtt",
    onderschrift:
      "Gesproken uitleg in het Nederlands. Ondertitels zijn in de speler aan te zetten.",
    testid: "rrf-film",
  },
  testid: "journey-recruitment",
};

export default function JourneyRecruitment() {
  return <TrajectPagina inhoud={inhoud} />;
}
