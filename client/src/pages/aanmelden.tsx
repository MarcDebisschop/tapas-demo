// ===========================================================================
// aanmelden.tsx: de tweede deur, voor wie het platform al gebruikt.
//
// De publieke laag richt zich op de organisatie die nog moet beslissen. Wie
// het platform al gebruikt, hoort daar niet doorheen te moeten. Deze pagina
// bundelt de bestaande aanmeldingsdeuren zonder er één te wijzigen: elke
// verwijzing gaat naar het scherm dat er vandaag al staat.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { DEUREN } from "@/data/oplossingen";
import "./publiek.css";

export default function Aanmelden() {
  return (
    <div className="publiek" data-testid="aanmeldenpagina">
      <PubliekeKop nu="Aanmelden" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">Aanmelden</p>
          <h1>Vier deuren, één platform</h1>
          <p className="lead">
            Kies de deur die bij uw rol hoort. Achter elke deur staat de omgeving die u al kent. Wie
            zijn wachtwoord niet bijhoudt, vraagt een aanmeldlink aan en komt er via zijn mailbox
            binnen.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="rooster-4">
            {DEUREN.map((d) => (
              <Link key={d.pad} href={d.pad} className="kaart" data-testid={`deur-${d.pad.slice(1)}`}>
                <p className="tag">Deur</p>
                <h3>{d.label}</h3>
                <p>{d.voorWie}</p>
                <div className="meta">
                  <b>Nodig</b>
                  {d.nodig}
                </div>
                <p className="verder">{d.pad}</p>
              </Link>
            ))}
          </div>
          <div className="prijs">
            <p className="pk">Geen wachtwoord bij de hand</p>
            <p>
              De aanmeldlink werkt eenmalig en vervalt na korte tijd. Werkt de link niet meer, vraag
              er dan een nieuwe aan op hetzelfde scherm.
            </p>
          </div>
          <div className="acties" style={{ marginTop: "30px" }}>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              Stel een vraag aan Tapas CORE
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
