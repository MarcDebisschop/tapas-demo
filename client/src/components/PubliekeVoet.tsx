// ===========================================================================
// PubliekeVoet.tsx: de voettekst van de publieke positioneringslaag.
//
// Ze herhaalt de grenzen van het instrument, verwijst naar de bestaande
// pagina's en houdt de ondernemingsgegevens bij de hand. De onopvallende
// beheerdersdeur blijft waar ze staat, in de voettekst van de onthaalpagina.
// ===========================================================================

import { Link } from "wouter";

export default function PubliekeVoet() {
  return (
    <footer data-testid="publieke-voet">
      <div className="wrap">
        <div className="f-top">
          <div className="f-lijst">
            <Link href="/oplossingen">Oplossingen</Link>
            <Link href="/outputs">Outputs</Link>
            <Link href="/partners">Voor partners</Link>
            <Link href="/demo">Demo-omgeving</Link>
            <Link href="/instrumenten">Instrumentenoverzicht</Link>
            <Link href="/onderbouwing">Onderbouwing</Link>
            <Link href="/aanmelden">Aanmelden</Link>
          </div>
        </div>
        <p className="f-note">
          Tapas CORE levert onderbouwde inzichten die een beslissing helpen voorbereiden. Het
          platform stelt geen diagnose, neemt geen selectiebeslissing en bepaalt geen potentieel.
          Wie beslist, blijft de organisatie.
        </p>
        <p className="f-cr">
          Tapas CORE is een platform van TaPasCity, 2BQ Consult, Zandstraat 85, 2960 Sint Job in
          't Goor, België.
        </p>
      </div>
    </footer>
  );
}
