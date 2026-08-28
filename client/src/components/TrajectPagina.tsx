// ===========================================================================
// TrajectPagina.tsx: het vaste geraamte van een premium oplossingpagina.
//
// De drie trajecten met een eigen pagina, Human Due Diligence, Leadership &
// Team Energy en Recruitment & Role Fit, lezen even helder: voor wie, wanneer
// u het inzet, welke stappen het traject bevat, welke output u krijgt, welke
// beslissing het ondersteunt en welk prijssignaal erbij hoort. Dat geraamte
// staat hier, zodat de pagina's niet uit elkaar kunnen groeien.
//
// TWEETALIG
// Het geraamte kent zelf geen taal: zijn eigen opschriften komen uit
// publiek/teksten-paginas.ts en volgen de taal van de publieke laag. De
// pagina's leveren hun inhoud al in de juiste taal aan. Ook de film volgt de
// paginataal: de speler begint bij de versie van die taal, en de knoppen boven
// de speler blijven de andere versie binnen bereik houden.
// ===========================================================================

import { useState } from "react";
import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import type { Cluster, OutputLaag, Stap } from "@/data/oplossingen";
import "@/pages/publiek.css";

/** Een taalversie van de film, met eigen beeldbestand en ondertitelspoor. */
export type FilmVersie = {
  /** De taalcode, zoals "nl" of "en". */
  taal: string;
  /** Wat op de keuzeknop staat. */
  label: string;
  bron: string;
  poster: string;
  ondertitels: string;
};

/** De film die het traject in beeld brengt. Optioneel: niet elk traject heeft er een. */
export type TrajectFilm = {
  /** Het opschrift boven de kop. */
  bovenschrift: string;
  kop: string;
  /** De alinea onder de kop, met een uitweg voor wie liever leest. */
  uitleg: string;
  /** Het beeldbestand, het posterbeeld en het ondertitelspoor. */
  bron: string;
  poster: string;
  ondertitels: string;
  /** De regel onder de speler. */
  onderschrift: string;
  /**
   * De taalversies. Staat er meer dan één, dan komt er een keuze boven de
   * speler. Blijft dit leeg, dan spelen bron, poster en ondertitels hierboven.
   */
  versies?: FilmVersie[];
  testid: string;
};

export type TrajectInhoud = {
  cluster: Cluster;
  /** Het opschrift boven de titel. */
  bovenschrift: string;
  /** De openingsalinea, zakelijk en zonder overdrijving. */
  lead: string;
  stappen: Stap[];
  /** De kop boven de stappen. Elk traject heeft zijn eigen ritme. */
  trajectkop?: string;
  /** De alinea onder die kop. */
  trajectuitleg?: string;
  outputs: OutputLaag[];
  uitkomst: readonly string[];
  /** Wat het traject uitdrukkelijk niet is. */
  grenzen: readonly string[];
  /** De vermelding onder het prijssignaal, over wat de prijs bevat. */
  prijsuitleg: string;
  /** De film over het traject. Staat er geen, dan blijft het blok weg. */
  film?: TrajectFilm;
  /**
   * De brug naar een aangrenzend beslismoment: één zin plus een verwijzing.
   * Blijft dit leeg, dan komt er geen brugregel op de pagina.
   */
  aansluiting?: { tekst: string; pad: string; linktekst: string };
  testid: string;
};

export default function TrajectPagina({ inhoud }: { inhoud: TrajectInhoud }) {
  const { cluster } = inhoud;
  const { taal } = usePubliekeTaal();
  // Welke taalversie van de film speelt. Zolang de bezoeker zelf niets kiest,
  // volgt de speler de taal van de pagina; daarna geldt zijn eigen keuze.
  const [gekozen, zetVersie] = useState<number | null>(null);
  const versies: FilmVersie[] = inhoud.film
    ? inhoud.film.versies && inhoud.film.versies.length > 0
      ? inhoud.film.versies
      : [
          {
            taal: "nl",
            label: "Nederlands",
            bron: inhoud.film.bron,
            poster: inhoud.film.poster,
            ondertitels: inhoud.film.ondertitels,
          },
        ]
    : [];
  const bijTaal = versies.findIndex((v) => v.taal === taal);
  const standaard = bijTaal >= 0 ? bijTaal : 0;
  const versie = gekozen ?? standaard;
  const nu = versies[Math.min(versie, Math.max(0, versies.length - 1))];
  return (
    <div className="publiek" lang={taal} data-testid={inhoud.testid}>
      <PubliekeKop nu="/oplossingen" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{inhoud.bovenschrift}</p>
          <h1>{cluster.naam}</h1>
          <p className="lead">{inhoud.lead}</p>
          <p className="kruimel">
            <Link href="/oplossingen">{kies(T.traject.alleOplossingen, taal)}</Link>
          </p>
          <div className="acties">
            <Link
              href="/"
              className="knop knop-1"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.traject.kennismaking, taal)}
            </Link>
            <Link href="/demo" className="knop knop-2">
              {kies(T.traject.demoKnop, taal)}
            </Link>
          </div>
        </div>
      </div>

      {/* De film staat vooraan, meteen na de opening: wie het traject nog niet
          kent, ziet in ruim een minuut hoe het loopt. Bewust geen automatisch
          spelen, want er is gesproken tekst. Het ondertitelspoor staat klaar
          maar niet aan. Wie liever leest, vindt alles hieronder in tekst. */}
      {inhoud.film && (
        <section className="grijs">
          <div className="wrap">
            <div className="sec-kop">
              <p className="eyebrow">{inhoud.film.bovenschrift}</p>
              <h2>{inhoud.film.kop}</h2>
              <p>{inhoud.film.uitleg}</p>
            </div>
            {versies.length > 1 && (
              <div
                className="film-talen"
                role="group"
                aria-label={kies(T.traject.filmTalen, taal)}
              >
                {versies.map((v, i) => (
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
            )}
            <figure className="film">
              {/* De sleutel laat de speler opnieuw laden bij een andere taal. */}
              <video
                key={nu.bron}
                controls
                playsInline
                preload="none"
                poster={nu.poster}
                data-testid={inhoud.film.testid}
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
              <figcaption>{inhoud.film.onderschrift}</figcaption>
            </figure>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.traject.voorWieEyebrow, taal)}</p>
            <h2>{cluster.beslissing}</h2>
          </div>
          <div className="rooster-2">
            <div className="kaart">
              <p className="tag">{kies(T.traject.tagVoorWie, taal)}</p>
              <h3>{kies(T.traject.lezerKop, taal)}</h3>
              <p>{cluster.doelgroep}</p>
            </div>
            <div className="kaart">
              <p className="tag">{kies(T.traject.tagWanneer, taal)}</p>
              <h3>{kies(T.traject.momentKop, taal)}</h3>
              <p>{cluster.moment}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.traject.trajectEyebrow, taal)}</p>
            <h2>{inhoud.trajectkop ?? kies(T.traject.trajectkop, taal)}</h2>
            <p>{inhoud.trajectuitleg ?? kies(T.traject.trajectuitleg, taal)}</p>
          </div>
          <div className="traject">
            {inhoud.stappen.map((s) => (
              <div className="tstap" key={s.nummer}>
                <p className="nr">
                  {kies(T.traject.stap, taal)} {s.nummer}
                </p>
                <h3>{s.naam}</h3>
                <p>{s.inhoud}</p>
                <p className="duur">{s.duur}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.traject.outputEyebrow, taal)}</p>
            <h2>{kies(T.traject.outputKop, taal)}</h2>
            <p>{kies(T.traject.outputUitleg, taal)}</p>
          </div>
          <div className="stapel">
            {inhoud.outputs.map((o) => (
              <div className="laag" key={o.nummer}>
                <p className="nr">{o.nummer}</p>
                <div>
                  <h3>{o.naam}</h3>
                  <p className="lezer">
                    {kies(T.traject.voor, taal)} {o.lezer}
                  </p>
                </div>
                <div>
                  <p className="inhoud">{o.inhoud}</p>
                  <p className="vorm">{o.vorm}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="kruimel">
            <Link href="/outputs">{kies(T.traject.outputsLink, taal)}</Link>
          </p>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.traject.uitkomstEyebrow, taal)}</p>
            <h2>{kies(T.traject.uitkomstKop, taal)}</h2>
          </div>
          <ul className="uitkomst">
            {inhoud.uitkomst.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          {/* De brug naar het aangrenzende beslismoment. Bewust één zin en
              bewust hier: het traject is dan al helemaal uitgelegd, dus de
              eigen kern van de pagina blijft overeind. */}
          {inhoud.aansluiting && (
            <p className="aansluiting" data-testid="aansluiting">
              {inhoud.aansluiting.tekst}{" "}
              <Link href={inhoud.aansluiting.pad}>{inhoud.aansluiting.linktekst}</Link>
            </p>
          )}
          <div className="prijs">
            <p className="pk">{kies(T.traject.prijsKop, taal)}</p>
            <p>{cluster.prijssignaal}</p>
            <p style={{ marginTop: "10px" }}>{inhoud.prijsuitleg}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.traject.grenzenEyebrow, taal)}</p>
            <h2>{kies(T.traject.grenzenKop, taal)}</h2>
            <p>{kies(T.traject.grenzenUitleg, taal)}</p>
          </div>
          <ul className="uitkomst">
            {inhoud.grenzen.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <div className="acties" style={{ marginTop: "34px" }}>
            <Link
              href="/"
              className="knop knop-1"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.traject.kennismaking, taal)}
            </Link>
            <Link href="/onderbouwing" className="knop knop-2">
              {kies(T.traject.onderbouwingKnop, taal)}
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
