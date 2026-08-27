// ===========================================================================
// TrajectPagina.tsx: het vaste geraamte van een premium oplossingpagina.
//
// De twee trajecten van de eerste internationale fase, Human Due Diligence en
// Leadership & Team Energy, lezen even helder: voor wie, wanneer u het inzet,
// welke stappen het traject bevat, welke output u krijgt, welke beslissing het
// ondersteunt en welk prijssignaal erbij hoort. Dat geraamte staat hier, zodat
// de twee pagina's niet uit elkaar kunnen groeien.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import type { Cluster, OutputLaag, Stap } from "@/data/oplossingen";
import "@/pages/publiek.css";

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
  uitkomst: string[];
  /** Wat het traject uitdrukkelijk niet is. */
  grenzen: string[];
  /** De vermelding onder het prijssignaal, over wat de prijs bevat. */
  prijsuitleg: string;
  /** De film over het traject. Staat er geen, dan blijft het blok weg. */
  film?: TrajectFilm;
  testid: string;
};

export default function TrajectPagina({ inhoud }: { inhoud: TrajectInhoud }) {
  const { cluster } = inhoud;
  return (
    <div className="publiek" data-testid={inhoud.testid}>
      <PubliekeKop nu="Oplossingen" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{inhoud.bovenschrift}</p>
          <h1>{cluster.naam}</h1>
          <p className="lead">{inhoud.lead}</p>
          <p className="kruimel">
            <Link href="/oplossingen">Alle oplossingen</Link>
          </p>
          <div className="acties">
            <Link
              href="/"
              className="knop knop-1"
              onClick={() => onthoudBlok("contact")}
            >
              Plan een kennismaking
            </Link>
            <Link href="/demo" className="knop knop-2">
              Bekijk het traject in de demo
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
            <figure className="film">
              <video
                controls
                playsInline
                preload="none"
                poster={inhoud.film.poster}
                data-testid={inhoud.film.testid}
              >
                <source src={inhoud.film.bron} type="video/mp4" />
                <track
                  kind="subtitles"
                  srcLang="nl"
                  label="Nederlands"
                  src={inhoud.film.ondertitels}
                />
                Uw browser kan deze film niet spelen. Het verloop van het traject staat hieronder in
                tekst.
              </video>
              <figcaption>{inhoud.film.onderschrift}</figcaption>
            </figure>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Voor wie en wanneer</p>
            <h2>{cluster.beslissing}</h2>
          </div>
          <div className="rooster-2">
            <div className="kaart">
              <p className="tag">Voor wie</p>
              <h3>De lezer van dit traject</h3>
              <p>{cluster.doelgroep}</p>
            </div>
            <div className="kaart">
              <p className="tag">Wanneer</p>
              <h3>Het moment om het in te zetten</h3>
              <p>{cluster.moment}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Het traject</p>
            <h2>{inhoud.trajectkop ?? "Vijf stappen, met een vaste doorlooptijd"}</h2>
            <p>
              {inhoud.trajectuitleg ??
                "Het traject is één geheel. Elke stap levert materiaal voor de volgende, en de laatste stap is een oplevering aan wie beslist."}
            </p>
          </div>
          <div className="traject">
            {inhoud.stappen.map((s) => (
              <div className="tstap" key={s.nummer}>
                <p className="nr">Stap {s.nummer}</p>
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
            <p className="eyebrow">Wat u krijgt</p>
            <h2>De output, benoemd naar de lezer</h2>
            <p>
              Elk rapport heeft één lezer en één doel. Zo weet iedereen wat hij in handen heeft en wat
              hij er niet uit mag lezen.
            </p>
          </div>
          <div className="stapel">
            {inhoud.outputs.map((o) => (
              <div className="laag" key={o.nummer}>
                <p className="nr">{o.nummer}</p>
                <div>
                  <h3>{o.naam}</h3>
                  <p className="lezer">Voor {o.lezer}</p>
                </div>
                <div>
                  <p className="inhoud">{o.inhoud}</p>
                  <p className="vorm">{o.vorm}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="kruimel">
            <Link href="/outputs">Volledige opbouw van de outputs</Link>
          </p>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Zakelijke uitkomst</p>
            <h2>Waar u na het traject staat</h2>
          </div>
          <ul className="uitkomst">
            {inhoud.uitkomst.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          <div className="prijs">
            <p className="pk">Prijsindicatie</p>
            <p>{cluster.prijssignaal}</p>
            <p style={{ marginTop: "10px" }}>{inhoud.prijsuitleg}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Grenzen</p>
            <h2>Wat dit traject niet doet</h2>
            <p>
              Een duidelijke grens maakt de uitkomst bruikbaar. Wie beslist, blijft de organisatie.
            </p>
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
              Plan een kennismaking
            </Link>
            <Link href="/onderbouwing" className="knop knop-2">
              Lees de onderbouwing
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
