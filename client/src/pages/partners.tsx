// ===========================================================================
// partners.tsx: de publieke pagina voor coaches, organisaties en partners.
//
// Dit is geen tweede toepassing en geen portaal. Het is één pagina die toont
// wat een licentie bevat en hoe een samenwerking begint. De bestaande
// aanvraagweg (/coach-aanvraag) en het bestaande coachoverzicht (/coaches)
// blijven ongewijzigd bestaan en worden hier gewoon aangewezen.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { LICENTIES } from "@/data/oplossingen";
import "./publiek.css";

export default function Partners() {
  return (
    <div className="publiek" data-testid="partnerspagina">
      <PubliekeKop nu="Voor partners" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">Voor partners</p>
          <h1>Werken met Tapas CORE onder eigen naam</h1>
          <p className="lead">
            Coaches, adviesbureaus en investeringspartners brengen de trajecten van Tapas CORE bij
            hun eigen klanten. Zij houden de relatie, wij leveren de instrumenten, de rapporten en
            de opleiding. Hieronder staat wat elke vorm van samenwerking bevat en wat ze kost.
          </p>
          <div className="acties">
            <Link href="/coach-aanvraag" className="knop knop-1">
              Vraag een licentie aan
            </Link>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              Plan een kennismaking
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Drie vormen</p>
            <h2>Wat een licentie bevat</h2>
            <p>
              De vormen verschillen in wie de klant houdt en wie het traject brengt. De
              instrumenten, de rapporten en de grenzen zijn in alle drie dezelfde.
            </p>
          </div>
          <div className="rooster-3">
            {LICENTIES.map((l) => (
              <div className="kaart" key={l.naam}>
                <p className="tag">{l.naam}</p>
                <h3>{l.voorWie}</h3>
                <p className="beslissing">{l.signaal}</p>
                <div className="meta">
                  <b>Inbegrepen</b>
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
            <p className="eyebrow">Bekwaamheid</p>
            <h2>Niemand werkt met deze instrumenten zonder opleiding</h2>
            <p>
              Elke begeleider doorloopt het bekwaamheidskader: kennis van de constructen, van de
              grenzen en van de gespreksvoering. Wie niet bekwaam verklaard is, krijgt de
              begeleiderslaag van een rapport niet te zien. Dat beschermt de deelnemer en het merk.
            </p>
          </div>
          <div className="rooster-3">
            <div className="kaart">
              <p className="tag">Stap 1</p>
              <h3>Kennismaking en dossier</h3>
              <p>
                Wij bekijken samen met welke klanten u werkt, welk cluster daarbij past en welk
                eerste dossier zinvol is om samen op te bouwen.
              </p>
            </div>
            <div className="kaart">
              <p className="tag">Stap 2</p>
              <h3>Opleiding en certificering</h3>
              <p>
                Opleiding per instrument, met een kennistoets en een oefendossier. Daarna volgt de
                bekwaamheidsverklaring die de begeleiderslaag opent.
              </p>
            </div>
            <div className="kaart">
              <p className="tag">Stap 3</p>
              <h3>Eerste dossiers samen</h3>
              <p>
                De eerste trajecten lopen met een vaste aanspreekpersoon mee, tot de oplevering
                zonder ondersteuning vlot verloopt.
              </p>
            </div>
          </div>
          <p className="kruimel">
            <Link href="/coaches">Bekijk het bestaande coachoverzicht</Link>
          </p>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
