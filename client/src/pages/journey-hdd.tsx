// ===========================================================================
// journey-hdd.tsx: de publieke oplossingpagina Human Due Diligence.
//
// Dit is de eerste van de twee trajecten waarmee Tapas CORE internationaal
// naar buiten komt. De pagina staat open voor iedereen. De werkomgeving van
// Human Due Diligence zelf blijft waar ze was, achter de aanmelding van de
// begeleider op /hdd.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De gedeelde inhoud komt
// per taal uit publiek/inhoud.ts, de eigen teksten uit
// publiek/teksten-paginas.ts. Daarom wordt de inhoud niet één keer op
// moduleniveau gebouwd, maar bij elke weergave voor de gekozen taal.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import {
  aansluitingRecruitment,
  cluster as clusterOp,
  hddOutputs,
  hddStappen,
  hddUitkomst,
} from "@/publiek/inhoud";
import { kies, usePubliekeTaal, type PubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";

function maakInhoud(taal: PubliekeTaal): TrajectInhoud {
  const cluster = clusterOp("hdd", taal)!;
  return {
    cluster,
    bovenschrift: kies(T.hdd.bovenschrift, taal),
    lead: kies(T.hdd.lead, taal),
    stappen: hddStappen(taal),
    trajectkop: kies(T.hdd.trajectkop, taal),
    trajectuitleg: kies(T.hdd.trajectuitleg, taal),
    outputs: hddOutputs(taal),
    uitkomst: hddUitkomst(taal),
    grenzen: kies<readonly string[]>(T.hdd.grenzen, taal),
    prijsuitleg: kies(T.hdd.prijsuitleg, taal),
    // Human Due Diligence maakt zichtbaar of het huidige team de ambitie kan
    // waarmaken. Blijkt dat niet zo, dan volgt de vraag naar externe instroom.
    // Die brug hoort erbij, maar mag het traject niet overnemen.
    aansluiting: {
      tekst: aansluitingRecruitment(taal).hdd,
      pad: "/oplossingen/recruitment-role-fit",
      linktekst: kies(T.hdd.linktekst, taal),
    },
    // De film hoort op deze pagina en niet op de onthaalpagina: ze legt precies
    // dit traject uit, in de stem van het platform, met ondertitels als spoor.
    film: {
      bovenschrift: kies(T.hdd.filmBovenschrift, taal),
      kop: kies(T.hdd.filmKop, taal),
      uitleg: kies(T.hdd.filmUitleg, taal),
      bron: "/film/hdd-nl.mp4",
      poster: "/film/hdd-nl-beeld.jpg",
      ondertitels: "/film/hdd-nl.vtt",
      // Twee taalversies: het dossier van dit traject is internationaal, dus de
      // film staat er ook in het Engels, met een eigen ondertitelspoor. Welke
      // versie begint te spelen, volgt de taal van de pagina.
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
      onderschrift: kies(T.hdd.filmOnderschrift, taal),
      testid: "hdd-film",
    },
    testid: "journey-hdd",
  };
}

export default function JourneyHdd() {
  const { taal } = usePubliekeTaal();
  return <TrajectPagina inhoud={maakInhoud(taal)} />;
}
