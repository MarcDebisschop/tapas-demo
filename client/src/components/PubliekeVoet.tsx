// ===========================================================================
// PubliekeVoet.tsx: de voettekst van de publieke positioneringslaag.
//
// Ze herhaalt de grenzen van het instrument, verwijst naar de bestaande
// pagina's en houdt de ondernemingsgegevens bij de hand. De onopvallende
// beheerdersdeur blijft waar ze staat, in de voettekst van de onthaalpagina.
//
// TWEETALIG
// De opschriften en de twee alinea's komen uit publiek/teksten-paginas.ts en
// volgen de taal van de publieke laag. De paden blijven in beide talen gelijk.
// ===========================================================================

import { Link } from "wouter";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";

export default function PubliekeVoet() {
  const { taal } = usePubliekeTaal();
  return (
    <footer data-testid="publieke-voet">
      <div className="wrap">
        <div className="f-top">
          <div className="f-lijst">
            <Link href="/oplossingen">{kies(T.voet.oplossingen, taal)}</Link>
            <Link href="/outputs">{kies(T.voet.outputs, taal)}</Link>
            <Link href="/partners">{kies(T.voet.partners, taal)}</Link>
            <Link href="/demo">{kies(T.voet.demo, taal)}</Link>
            <Link href="/instrumenten">{kies(T.voet.instrumenten, taal)}</Link>
            <Link href="/onderbouwing">{kies(T.voet.onderbouwing, taal)}</Link>
            <Link href="/aanmelden">{kies(T.voet.aanmelden, taal)}</Link>
          </div>
        </div>
        <p className="f-note">{kies(T.voet.grens, taal)}</p>
        <p className="f-cr">{kies(T.voet.gegevens, taal)}</p>
      </div>
    </footer>
  );
}
