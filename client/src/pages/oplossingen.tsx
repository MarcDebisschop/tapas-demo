// ===========================================================================
// oplossingen.tsx: het overzicht van de journeyclusters.
//
// Deze pagina ordent het bestaande aanbod in vijf clusters, geordend naar de
// beslissing die ze ondersteunen. De twee clusters van de eerste
// internationale fase staan vooraan en hebben een eigen pagina.
//
// Recruitment & Role Fit is de vierde publieke journey en staat daarom in een
// eigen band, meteen onder de eerste lijn, met de vier beslismomenten erbij. Het
// hoort niet tussen de clusters zonder eigen pagina: daar was het niet te
// vinden. De wedge blijft wel zichtbaar de eerste lijn.
//
// Development & Mobility heeft geen eigen trajectpagina, maar wel een film. Dat
// cluster staat daarom ook in een eigen band, met de kaart en de film er meteen
// onder. Het stond eerst tussen de clusters met de film ver daaronder: dan moet
// een bezoeker naar de film zoeken.
//
// De instrumentenlijst zelf blijft bestaan op /instrumenten. Ze is de tweede
// laag: eerst de beslissing, dan het instrument.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De clusters, de
// beslismomenten en de brugregels komen per taal uit publiek/inhoud.ts; de
// eigen koppen en opschriften uit publiek/teksten-paginas.ts. De sleutels en
// de paden zijn machinewaarden en blijven in beide talen gelijk.
// ===========================================================================

import { useState } from "react";
import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import {
  aansluitingRecruitment,
  beslismomenten,
  clusters,
} from "@/publiek/inhoud";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import "./publiek.css";

// De twee taalversies van de film over Development & Mobility. Dezelfde opbouw
// als de films op de trajectpagina's.
const FILM_VERSIES = [
  {
    taal: "nl",
    label: "Nederlands",
    bron: "/film/dm-nl.mp4",
    poster: "/film/dm-nl-beeld.jpg",
    ondertitels: "/film/dm-nl.vtt",
  },
  {
    taal: "en",
    label: "English",
    bron: "/film/dm-en.mp4",
    poster: "/film/dm-en-beeld.jpg",
    ondertitels: "/film/dm-en.vtt",
  },
];

export default function Oplossingen() {
  const { taal } = usePubliekeTaal();
  // Welke taalversie van de film speelt. Zolang de bezoeker zelf niets kiest,
  // volgt de speler de taal van de pagina.
  const [gekozen, zetVersie] = useState<number | null>(null);
  const bijTaal = FILM_VERSIES.findIndex((v) => v.taal === taal);
  const versie = gekozen ?? (bijTaal >= 0 ? bijTaal : 0);
  const nu = FILM_VERSIES[versie];
  const alle = clusters(taal);
  const aansluiting = aansluitingRecruitment(taal);
  const wedge = alle.filter((c) => c.wedge);
  const vierde = alle.find((c) => c.sleutel === "recruitment");
  // Development & Mobility heeft geen eigen trajectpagina, maar wel een film.
  // Het cluster krijgt daarom een eigen band met de film meteen onder de kaart,
  // zoals de drie andere films onder hun eigen blok staan.
  const ontw = alle.find((c) => c.sleutel === "ontwikkeling");
  // De overige clusters zonder eigen trajectpagina of band.
  const rest = alle.filter(
    (c) =>
      !c.wedge && c.sleutel !== "recruitment" && c.sleutel !== "ontwikkeling",
  );

  return (
    <div className="publiek" lang={taal} data-testid="oplossingenpagina">
      <PubliekeKop nu="/oplossingen" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{kies(T.oplossingen.eyebrow, taal)}</p>
          <h1>{kies(T.oplossingen.titel, taal)}</h1>
          <p className="lead">{kies(T.oplossingen.lead, taal)}</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.oplossingen.eersteEyebrow, taal)}</p>
            <h2>{kies(T.oplossingen.eersteKop, taal)}</h2>
            <p>{kies(T.oplossingen.eersteUitleg, taal)}</p>
          </div>
          <div className="rooster-2">
            {wedge.map((c) => (
              <Link key={c.sleutel} href={c.pad as string} className="kaart">
                <p className="tag wedge">{kies(T.oplossingen.tagTraject, taal)}</p>
                <h3>{c.naam}</h3>
                <p>{c.ondertitel}</p>
                <p className="beslissing">{c.beslissing}</p>
                <div className="meta">
                  <b>{kies(T.oplossingen.metaVoorWie, taal)}</b>
                  {c.doelgroep}
                </div>
                <p className="verder">{kies(T.oplossingen.verder, taal)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {vierde && (
        <section className="grijs">
          <div className="wrap">
            <div className="sec-kop">
              <p className="eyebrow">{kies(T.oplossingen.vierdeEyebrow, taal)}</p>
              <h2>{kies(T.oplossingen.vierdeKop, taal)}</h2>
              <p>{kies(T.oplossingen.vierdeUitleg, taal)}</p>
            </div>
            <div className="rooster-2">
              <Link href={vierde.pad as string} className="kaart" data-testid="kaart-vierde-journey">
                <p className="tag wedge">{kies(T.oplossingen.tagTraject, taal)}</p>
                <h3>{vierde.naam}</h3>
                <p>{vierde.ondertitel}</p>
                <p className="beslissing">{vierde.beslissing}</p>
                <div className="meta">
                  <b>{kies(T.oplossingen.metaVoorWie, taal)}</b>
                  {vierde.doelgroep}
                </div>
                <p className="verder">{kies(T.oplossingen.verder, taal)}</p>
              </Link>
              <div className="kaart">
                <p className="tag">{kies(T.oplossingen.onderJourney, taal)}</p>
                <h3>T4Recruitment</h3>
                <p>{kies(T.oplossingen.onderJourneyTekst, taal)}</p>
                <div className="meta">
                  <b>{kies(T.oplossingen.metaPrijs, taal)}</b>
                  {vierde.prijssignaal}
                </div>
                <p className="verder">{kies(T.oplossingen.filmVerder, taal)}</p>
              </div>
            </div>

            {/* De vier journeys als beslismomenten op één motor, en niet als
                losse instrumenten. Elke regel benoemt ook hoe die journey zich
                tot de instroombeslissing verhoudt. */}
            <div className="markeringen" data-testid="beslismomenten">
              {beslismomenten(taal).map((b) => (
                <div className="mk" key={b.sleutel}>
                  <p className="l">{b.naam}</p>
                  <p className="w">{b.vraag}</p>
                  <p className="u">{b.relatie}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Development & Mobility heeft geen eigen trajectpagina. Het cluster
          krijgt daarom hier een eigen band: de kaart met de film er meteen
          onder, net zoals de andere drie films onder hun eigen blok staan. De
          tekst rond de speler komt letterlijk uit het filmscenario. */}
      {ontw && (
        <section data-testid="band-ontwikkeling">
          <div className="wrap">
            <div className="sec-kop">
              <p className="eyebrow">{kies(T.oplossingen.dmFilmEyebrow, taal)}</p>
              <h2>{kies(T.oplossingen.dmFilmKop, taal)}</h2>
              <p>{kies(T.oplossingen.dmFilmUitleg, taal)}</p>
              <p>{kies(T.oplossingen.dmFilmTaal, taal)}</p>
            </div>
            <div className="kaart" data-testid="kaart-ontwikkeling">
              <p className="tag">{kies(T.oplossingen.tagCluster, taal)}</p>
              <h3>{ontw.naam}</h3>
              <p>{ontw.ondertitel}</p>
              <p className="beslissing">{ontw.beslissing}</p>
              <div className="meta">
                <b>{kies(T.oplossingen.metaInstrumenten, taal)}</b>
                {ontw.instrumenten.join(", ")}
              </div>
              {aansluiting[ontw.sleutel] ? (
                <p className="aansluiting" data-testid="aansluiting-ontwikkeling">
                  {aansluiting[ontw.sleutel]}
                </p>
              ) : null}
            </div>
            {/* Twee taalversies, zoals bij de films op de trajectpagina's. De
                speler volgt de taal van de pagina zolang de bezoeker zelf niets
                kiest. */}
            <div
              className="film-talen"
              role="group"
              aria-label={kies(T.traject.filmTalen, taal)}
            >
              {FILM_VERSIES.map((v, i) => (
                <button
                  key={v.taal}
                  type="button"
                  className={i === versie ? "film-taal aan" : "film-taal"}
                  aria-pressed={i === versie}
                  data-testid={`film-taal-${v.taal}`}
                  onClick={() => zetVersie(i)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <figure className="film">
              {/* De sleutel laat de speler opnieuw laden bij een andere taal. */}
              <video
                key={nu.bron}
                controls
                playsInline
                preload="none"
                poster={nu.poster}
                data-testid="film-ontwikkeling"
              >
                <source src={nu.bron} type="video/mp4" />
                <track
                  kind="subtitles"
                  srcLang={nu.taal}
                  label={nu.label}
                  src={nu.ondertitels}
                />
                {kies(T.traject.geenFilm, taal)}
              </video>
              <figcaption>{kies(T.oplossingen.dmFilmOnder, taal)}</figcaption>
            </figure>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.oplossingen.restEyebrow, taal)}</p>
            <h2>{kies(T.oplossingen.restKop, taal)}</h2>
            <p>{kies(T.oplossingen.restUitleg, taal)}</p>
          </div>
          <div className="rooster-2">
            {rest.map((c) => {
              // Een cluster met een eigen trajectpagina wordt een kaart waarop
              // geklikt kan worden. De andere blijven staan zoals ze stonden.
              const kern = (
                <>
                  <p className="tag">{kies(T.oplossingen.tagCluster, taal)}</p>
                  <h3>{c.naam}</h3>
                  <p>{c.ondertitel}</p>
                  <p className="beslissing">{c.beslissing}</p>
                  <div className="meta">
                    <b>{kies(T.oplossingen.metaInstrumenten, taal)}</b>
                    {c.instrumenten.join(", ")}
                  </div>
                  {c.pad ? (
                    <p className="verder">{kies(T.oplossingen.verder, taal)}</p>
                  ) : null}
                  {/* Development & Mobility heeft geen eigen trajectpagina. De
                      brug naar de instroombeslissing hoort dus hier. */}
                  {aansluiting[c.sleutel] ? (
                    <p className="aansluiting" data-testid={`aansluiting-${c.sleutel}`}>
                      {aansluiting[c.sleutel]}
                    </p>
                  ) : null}
                </>
              );
              return c.pad ? (
                <Link key={c.sleutel} href={c.pad} className="kaart">
                  {kern}
                </Link>
              ) : (
                <div key={c.sleutel} className="kaart">
                  {kern}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.oplossingen.tweedeEyebrow, taal)}</p>
            <h2>{kies(T.oplossingen.tweedeKop, taal)}</h2>
            <p>{kies(T.oplossingen.tweedeUitleg, taal)}</p>
          </div>
          <div className="kop-blok" style={{ padding: 0 }}>
            <div className="acties" style={{ marginTop: 0 }}>
              <Link href="/instrumenten" className="knop knop-3">
                {kies(T.oplossingen.naarInstrumenten, taal)}
              </Link>
              <Link href="/outputs" className="knop knop-2">
                {kies(T.oplossingen.naarOutputs, taal)}
              </Link>
              <Link href="/demo" className="knop knop-2">
                {kies(T.oplossingen.naarDemo, taal)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
