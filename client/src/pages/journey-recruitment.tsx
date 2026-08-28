// ===========================================================================
// journey-recruitment.tsx: de publieke oplossingpagina Recruitment & Role Fit.
//
// De vierde journey van het producthuis. Ze gebruikt dezelfde Core Engine als
// de andere trajecten: talentfoci, versnellers, drivers en energie, nu gelegd
// naast een rolprofiel dat door de betrokkenen rond de functie zelf gebouwd
// wordt. T4Recruitment blijft de instrumentnaam onder deze journey; de
// werkomgeving van dat instrument blijft waar ze was, achter de aanmelding.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De gedeelde inhoud komt
// per taal uit publiek/inhoud.ts, de eigen teksten uit
// publiek/teksten-paginas.ts, en de film staat in beide talen klaar. Daarom
// wordt de inhoud bij elke weergave voor de gekozen taal gebouwd.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import {
  cluster as clusterOp,
  outputstapel,
  rrStappen,
  rrUitkomst,
} from "@/publiek/inhoud";
import { kies, usePubliekeTaal, type PubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";

function maakInhoud(taal: PubliekeTaal): TrajectInhoud {
  const cluster = clusterOp("recruitment", taal)!;
  return {
    cluster,
    bovenschrift: kies(T.rrf.bovenschrift, taal),
    lead: kies(T.rrf.lead, taal),
    stappen: rrStappen(taal),
    trajectkop: kies(T.rrf.trajectkop, taal),
    trajectuitleg: kies(T.rrf.trajectuitleg, taal),
    // De eerste drie lagen van de vaste outputstapel: de kandidaat leest zijn
    // eigen profiel, de recruiter krijgt de gespreksleidraad, HR en de
    // leidinggevende het beeld op rol- en teamniveau.
    outputs: outputstapel(taal).filter((o) => o.nummer <= 3),
    uitkomst: rrUitkomst(taal),
    grenzen: kies<readonly string[]>(T.rrf.grenzen, taal),
    prijsuitleg: kies(T.rrf.prijsuitleg, taal),
    // Twee taalversies van de film, zoals bij de andere trajecten. Welke versie
    // begint te spelen, volgt de taal van de pagina.
    film: {
      bovenschrift: kies(T.rrf.filmBovenschrift, taal),
      kop: kies(T.rrf.filmKop, taal),
      uitleg: kies(T.rrf.filmUitleg, taal),
      bron: "/film/rrf-nl.mp4",
      poster: "/film/rrf-nl-beeld.jpg",
      ondertitels: "/film/rrf-nl.vtt",
      versies: [
        {
          taal: "nl",
          label: "Nederlands",
          bron: "/film/rrf-nl.mp4",
          poster: "/film/rrf-nl-beeld.jpg",
          ondertitels: "/film/rrf-nl.vtt",
        },
        {
          taal: "en",
          label: "English",
          bron: "/film/rrf-en.mp4",
          poster: "/film/rrf-en-beeld.jpg",
          ondertitels: "/film/rrf-en.vtt",
        },
      ],
      onderschrift: kies(T.rrf.filmOnderschrift, taal),
      testid: "rrf-film",
    },
    testid: "journey-recruitment",
  };
}

export default function JourneyRecruitment() {
  const { taal } = usePubliekeTaal();
  return <TrajectPagina inhoud={maakInhoud(taal)} />;
}
