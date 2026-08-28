// ===========================================================================
// aanmelden.tsx: de tweede deur, voor wie het platform al gebruikt.
//
// De publieke laag richt zich op de organisatie die nog moet beslissen. Wie
// het platform al gebruikt, hoort daar niet doorheen te moeten. Deze pagina
// bundelt de bestaande aanmeldingsdeuren zonder er één te wijzigen: elke
// verwijzing gaat naar het scherm dat er vandaag al staat.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De deuren komen per taal
// uit publiek/inhoud.ts, de eigen teksten uit publiek/teksten-paginas.ts. De
// paden achter de deuren blijven in beide talen dezelfde.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { deuren } from "@/publiek/inhoud";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import "./publiek.css";

export default function Aanmelden() {
  const { taal } = usePubliekeTaal();
  return (
    <div className="publiek" lang={taal} data-testid="aanmeldenpagina">
      <PubliekeKop nu="/aanmelden" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{kies(T.aanmelden.eyebrow, taal)}</p>
          <h1>{kies(T.aanmelden.titel, taal)}</h1>
          <p className="lead">{kies(T.aanmelden.lead, taal)}</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="rooster-4">
            {deuren(taal).map((d) => (
              <Link key={d.pad} href={d.pad} className="kaart" data-testid={`deur-${d.pad.slice(1)}`}>
                <p className="tag">{kies(T.aanmelden.tagDeur, taal)}</p>
                <h3>{d.label}</h3>
                <p>{d.voorWie}</p>
                <div className="meta">
                  <b>{kies(T.aanmelden.metaNodig, taal)}</b>
                  {d.nodig}
                </div>
                <p className="verder">{d.pad}</p>
              </Link>
            ))}
          </div>
          <div className="prijs">
            <p className="pk">{kies(T.aanmelden.geenWachtwoordKop, taal)}</p>
            <p>{kies(T.aanmelden.geenWachtwoord, taal)}</p>
          </div>
          <div className="acties" style={{ marginTop: "30px" }}>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.aanmelden.vraagKnop, taal)}
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
