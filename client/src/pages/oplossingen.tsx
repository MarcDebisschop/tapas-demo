// ===========================================================================
// oplossingen.tsx: het overzicht van de journeyclusters.
//
// Deze pagina ordent het bestaande aanbod in vijf clusters, geordend naar de
// beslissing die ze ondersteunen. De twee clusters van de eerste
// internationale fase staan vooraan en hebben een eigen pagina. De andere drie
// blijven hier staan en verwijzen naar de bestaande schermen.
//
// De instrumentenlijst zelf blijft bestaan op /instrumenten. Ze is de tweede
// laag: eerst de beslissing, dan het instrument.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { CLUSTERS } from "@/data/oplossingen";
import "./publiek.css";

export default function Oplossingen() {
  const wedge = CLUSTERS.filter((c) => c.wedge);
  const rest = CLUSTERS.filter((c) => !c.wedge);

  return (
    <div className="publiek" data-testid="oplossingenpagina">
      <PubliekeKop nu="Oplossingen" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">Oplossingen</p>
          <h1>Vijf beslissingen, vijf trajecten</h1>
          <p className="lead">
            Tapas CORE begint niet bij een instrument maar bij een beslissing. Elk cluster hieronder
            bundelt de stappen, de begeleiding en de rapporten die bij één type beslissing horen. De
            instrumenten blijven wat ze zijn, de ordening maakt duidelijk waarvoor u ze inzet.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Eerste lijn</p>
            <h2>De twee trajecten waarmee wij internationaal starten</h2>
            <p>
              Beide raken een beslissing met gevolgen: een dossier dat op tafel ligt en een ploeg
              die moet leveren. Ze zijn opgebouwd als traject, met een vaste reeks stappen en een
              bestuursklare oplevering.
            </p>
          </div>
          <div className="rooster-2">
            {wedge.map((c) => (
              <Link key={c.sleutel} href={c.pad as string} className="kaart">
                <p className="tag wedge">Traject</p>
                <h3>{c.naam}</h3>
                <p>{c.ondertitel}</p>
                <p className="beslissing">{c.beslissing}</p>
                <div className="meta">
                  <b>Voor wie</b>
                  {c.doelgroep}
                </div>
                <p className="verder">Bekijk het traject</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Verdere clusters</p>
            <h2>Wat het platform verder ondersteunt</h2>
            <p>
              Dezelfde motor, andere beslissing. Deze clusters lopen vandaag al in scholen,
              organisaties en bij coaches, met de instrumenten die daarvoor gebouwd zijn.
            </p>
          </div>
          <div className="rooster-3">
            {rest.map((c) => (
              <div key={c.sleutel} className="kaart">
                <p className="tag">Cluster</p>
                <h3>{c.naam}</h3>
                <p>{c.ondertitel}</p>
                <p className="beslissing">{c.beslissing}</p>
                <div className="meta">
                  <b>Instrumenten</b>
                  {c.instrumenten.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Tweede laag</p>
            <h2>De instrumenten zelf</h2>
            <p>
              Zestien instrumenten, vijf talen, van een korte energiescan tot een volledig kompas.
              Wie liever vertrekt van het instrument, vindt de volledige lijst met bereik,
              doorlooptijd en rapportvorm.
            </p>
          </div>
          <div className="kop-blok" style={{ padding: 0 }}>
            <div className="acties" style={{ marginTop: 0 }}>
              <Link href="/instrumenten" className="knop knop-3">
                Naar het instrumentenoverzicht
              </Link>
              <Link href="/outputs" className="knop knop-2">
                Bekijk wat u krijgt
              </Link>
              <Link href="/demo" className="knop knop-2">
                Bekijk de demo-omgeving
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
