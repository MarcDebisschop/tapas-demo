// ===========================================================================
// journey-leiderschap.tsx: de publieke oplossingpagina Leadership & Team
// Energy.
//
// Het tweede traject van de eerste internationale fase. Het gaat over
// leiderschap, vertrouwen, energie en uitvoeringskracht in een bestaande ploeg,
// en levert meer dan een ploegrapport alleen: een begeleide sessie en een
// tweede meting horen erbij.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De gedeelde inhoud komt
// per taal uit publiek/inhoud.ts, de eigen teksten uit
// publiek/teksten-paginas.ts, en de film staat in beide talen klaar. Daarom
// wordt de inhoud bij elke weergave voor de gekozen taal gebouwd.
// ===========================================================================

import TrajectPagina, { type TrajectInhoud } from "@/components/TrajectPagina";
import {
  aansluitingRecruitment,
  cluster as clusterOp,
  lteStappen,
  lteUitkomst,
  outputstapel,
} from "@/publiek/inhoud";
import { kies, usePubliekeTaal, type PubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";

function maakInhoud(taal: PubliekeTaal): TrajectInhoud {
  const cluster = clusterOp("leiderschap", taal)!;
  return {
    cluster,
    bovenschrift: kies(T.lte.bovenschrift, taal),
    lead: kies(T.lte.lead, taal),
    stappen: lteStappen(taal),
    outputs: outputstapel(taal).filter((o) => o.nummer <= 3),
    uitkomst: lteUitkomst(taal),
    grenzen: kies<readonly string[]>(T.lte.grenzen, taal),
    prijsuitleg: kies(T.lte.prijsuitleg, taal),
    // Soms volstaat begeleiding of een andere rolverdeling niet en vraagt de ploeg
    // een bewuste instroombeslissing. Eerst begrijpen hoe deze ploeg werkt, daarna
    // bepalen welk type persoon haar versterkt.
    aansluiting: {
      tekst: aansluitingRecruitment(taal).leiderschap,
      pad: "/oplossingen/recruitment-role-fit",
      linktekst: kies(T.lte.linktekst, taal),
    },
    // Twee taalversies van de film, zoals bij Human Due Diligence. Welke versie
    // begint te spelen, volgt de taal van de pagina; de knoppen boven de speler
    // houden de andere taal binnen bereik.
    film: {
      bovenschrift: kies(T.lte.filmBovenschrift, taal),
      kop: kies(T.lte.filmKop, taal),
      uitleg: kies(T.lte.filmUitleg, taal),
      bron: "/film/lte-nl.mp4",
      poster: "/film/lte-nl-beeld.jpg",
      ondertitels: "/film/lte-nl.vtt",
      versies: [
        {
          taal: "nl",
          label: "Nederlands",
          bron: "/film/lte-nl.mp4",
          poster: "/film/lte-nl-beeld.jpg",
          ondertitels: "/film/lte-nl.vtt",
        },
        {
          taal: "en",
          label: "English",
          bron: "/film/lte-en.mp4",
          poster: "/film/lte-en-beeld.jpg",
          ondertitels: "/film/lte-en.vtt",
        },
      ],
      onderschrift: kies(T.lte.filmOnderschrift, taal),
      testid: "lte-film",
    },
    testid: "journey-leiderschap",
  };
}

export default function JourneyLeiderschap() {
  const { taal } = usePubliekeTaal();
  return <TrajectPagina inhoud={maakInhoud(taal)} />;
}
