// ===========================================================================
// outputs.tsx: de outputstapel van Tapas CORE.
//
// Wat het platform oplevert, is geen stapel PDF's maar een reeks rapporten met
// elk één lezer. Deze pagina legt die logica vast: individueel inzicht,
// begeleidersrapport, managementsamenvatting, bestuursrapport. Daarbij horen de
// markeringen die op elk rapport staan: versie, taal, datum en de vermelding wie
// het mag lezen.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De stapel en de markeringen
// komen per taal uit publiek/inhoud.ts, de eigen teksten uit
// publiek/teksten-paginas.ts.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { markeringen, outputstapel } from "@/publiek/inhoud";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import "./publiek.css";

export default function Outputs() {
  const { taal } = usePubliekeTaal();
  return (
    <div className="publiek" lang={taal} data-testid="outputspagina">
      <PubliekeKop nu="/outputs" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{kies(T.outputs.eyebrow, taal)}</p>
          <h1>{kies(T.outputs.titel, taal)}</h1>
          <p className="lead">{kies(T.outputs.lead, taal)}</p>
          <div className="acties">
            <Link href="/oplossingen" className="knop knop-3">
              {kies(T.outputs.naarTrajecten, taal)}
            </Link>
            <Link href="/demo" className="knop knop-2">
              {kies(T.outputs.naarDemo, taal)}
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.outputs.stapelEyebrow, taal)}</p>
            <h2>{kies(T.outputs.stapelKop, taal)}</h2>
            <p>{kies(T.outputs.stapelUitleg, taal)}</p>
          </div>
          <div className="stapel">
            {outputstapel(taal).map((o) => (
              <div className="laag" key={o.nummer}>
                <p className="nr">{o.nummer}</p>
                <div>
                  <h3>{o.naam}</h3>
                  <p className="lezer">
                    {kies(T.outputs.voor, taal)} {o.lezer}
                  </p>
                </div>
                <div>
                  <p className="inhoud">{o.inhoud}</p>
                  <p className="vorm">{o.vorm}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.outputs.beheerEyebrow, taal)}</p>
            <h2>{kies(T.outputs.beheerKop, taal)}</h2>
            <p>{kies(T.outputs.beheerUitleg, taal)}</p>
          </div>
          <div className="markeringen">
            {markeringen(taal).map((m) => (
              <div className="mk" key={m.label}>
                <p className="l">{m.label}</p>
                <p className="w">{m.waarde}</p>
                <p className="u">{m.uitleg}</p>
              </div>
            ))}
          </div>
          <div className="prijs">
            <p className="pk">{kies(T.outputs.beslisklaarKop, taal)}</p>
            <p>{kies(T.outputs.beslisklaar, taal)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.outputs.grenzenEyebrow, taal)}</p>
            <h2>{kies(T.outputs.grenzenKop, taal)}</h2>
            <p>{kies(T.outputs.grenzenUitleg, taal)}</p>
          </div>
          <div className="acties" style={{ marginTop: 0 }}>
            <Link href="/onderbouwing" className="knop knop-3">
              {kies(T.outputs.onderbouwingKnop, taal)}
            </Link>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.outputs.voorbeeldKnop, taal)}
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
