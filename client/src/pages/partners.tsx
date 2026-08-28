// ===========================================================================
// partners.tsx: de publieke pagina voor coaches, organisaties en partners.
//
// Dit is geen tweede toepassing en geen portaal. Het is één pagina die toont
// wat een licentie bevat en hoe een samenwerking begint. De bestaande
// aanvraagweg (/coach-aanvraag) en het bestaande coachoverzicht (/coaches)
// blijven ongewijzigd bestaan en worden hier gewoon aangewezen.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De licentievormen komen per
// taal uit publiek/inhoud.ts, de eigen teksten uit publiek/teksten-paginas.ts.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { licenties } from "@/publiek/inhoud";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import "./publiek.css";

export default function Partners() {
  const { taal } = usePubliekeTaal();
  return (
    <div className="publiek" lang={taal} data-testid="partnerspagina">
      <PubliekeKop nu="/partners" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{kies(T.partners.eyebrow, taal)}</p>
          <h1>{kies(T.partners.titel, taal)}</h1>
          <p className="lead">{kies(T.partners.lead, taal)}</p>
          <div className="acties">
            <Link href="/coach-aanvraag" className="knop knop-1">
              {kies(T.partners.licentieKnop, taal)}
            </Link>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.partners.kennismaking, taal)}
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.partners.vormenEyebrow, taal)}</p>
            <h2>{kies(T.partners.vormenKop, taal)}</h2>
            <p>{kies(T.partners.vormenUitleg, taal)}</p>
          </div>
          <div className="rooster-3">
            {licenties(taal).map((l) => (
              <div className="kaart" key={l.naam}>
                <p className="tag">{l.naam}</p>
                <h3>{l.voorWie}</h3>
                <p className="beslissing">{l.signaal}</p>
                <div className="meta">
                  <b>{kies(T.partners.metaInbegrepen, taal)}</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                    {l.bevat.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.partners.bekwaamEyebrow, taal)}</p>
            <h2>{kies(T.partners.bekwaamKop, taal)}</h2>
            <p>{kies(T.partners.bekwaamUitleg, taal)}</p>
          </div>
          <div className="rooster-3">
            <div className="kaart">
              <p className="tag">{kies(T.partners.stap1, taal)}</p>
              <h3>{kies(T.partners.stap1Kop, taal)}</h3>
              <p>{kies(T.partners.stap1Tekst, taal)}</p>
            </div>
            <div className="kaart">
              <p className="tag">{kies(T.partners.stap2, taal)}</p>
              <h3>{kies(T.partners.stap2Kop, taal)}</h3>
              <p>{kies(T.partners.stap2Tekst, taal)}</p>
            </div>
            <div className="kaart">
              <p className="tag">{kies(T.partners.stap3, taal)}</p>
              <h3>{kies(T.partners.stap3Kop, taal)}</h3>
              <p>{kies(T.partners.stap3Tekst, taal)}</p>
            </div>
          </div>
          <p className="kruimel">
            <Link href="/coaches">{kies(T.partners.coachesLink, taal)}</Link>
          </p>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
