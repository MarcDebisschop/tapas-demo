// ===========================================================================
// oplossingen.tsx: het overzicht van de journeyclusters.
//
// Deze pagina ordent het bestaande aanbod in vijf clusters, geordend naar de
// beslissing die ze ondersteunen. De twee clusters van de eerste
// internationale fase staan vooraan en hebben een eigen pagina.
//
// Recruitment & Role Fit is de vierde publieke journey en staat daarom in een
// eigen band, meteen onder de eerste lijn, met de vier beslismomenten erbij. Het
// hoort niet tussen de clusters zonder eigen pagina: daar was het niet te
// vinden. De wedge blijft wel zichtbaar de eerste lijn.
//
// De instrumentenlijst zelf blijft bestaan op /instrumenten. Ze is de tweede
// laag: eerst de beslissing, dan het instrument.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { AANSLUITING_RECRUITMENT, BESLISMOMENTEN, CLUSTERS } from "@/data/oplossingen";
import "./publiek.css";

export default function Oplossingen() {
  const wedge = CLUSTERS.filter((c) => c.wedge);
  const vierde = CLUSTERS.find((c) => c.sleutel === "recruitment");
  // De clusters zonder eigen trajectpagina. Recruitment staat hierboven.
  const rest = CLUSTERS.filter((c) => !c.wedge && c.sleutel !== "recruitment");

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

      {vierde && (
        <section className="grijs">
          <div className="wrap">
            <div className="sec-kop">
              <p className="eyebrow">Vierde journey</p>
              <h2>De instroombeslissing, op dezelfde motor</h2>
              <p>
                Aanwerven is het beslismoment dat organisaties het vaakst nemen. Het loopt hier op
                dezelfde onderbouwing als de trajecten hierboven, met een eigen doorlooptijd en een
                eigen prijs per kandidaat.
              </p>
            </div>
            <div className="rooster-2">
              <Link href={vierde.pad as string} className="kaart" data-testid="kaart-vierde-journey">
                <p className="tag wedge">Traject</p>
                <h3>{vierde.naam}</h3>
                <p>{vierde.ondertitel}</p>
                <p className="beslissing">{vierde.beslissing}</p>
                <div className="meta">
                  <b>Voor wie</b>
                  {vierde.doelgroep}
                </div>
                <p className="verder">Bekijk het traject</p>
              </Link>
              <div className="kaart">
                <p className="tag">Onder de journey</p>
                <h3>T4Recruitment</h3>
                <p>
                  De journey draait op T4Recruitment, samen met het T4P Business Kompas. Eerst wordt
                  de rol scherpgesteld met de mensen rond de functie, daarna wordt het
                  kandidaatprofiel daartegen gelegd.
                </p>
                <div className="meta">
                  <b>Prijsindicatie</b>
                  {vierde.prijssignaal}
                </div>
                <p className="verder">Ruim een minuut film op de trajectpagina</p>
              </div>
            </div>

            {/* De vier journeys als beslismomenten op één motor, en niet als
                losse instrumenten. Elke regel benoemt ook hoe die journey zich
                tot de instroombeslissing verhoudt. */}
            <div className="markeringen" data-testid="beslismomenten">
              {BESLISMOMENTEN.map((b) => (
                <div className="mk" key={b.sleutel}>
                  <p className="l">{b.naam}</p>
                  <p className="w">{b.vraag}</p>
                  <p className="u">{b.relatie}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Verdere clusters</p>
            <h2>Wat het platform verder ondersteunt</h2>
            <p>
              Dezelfde motor, andere beslissing. Deze clusters lopen vandaag al in scholen,
              organisaties en bij coaches, met de instrumenten die daarvoor gebouwd zijn.
            </p>
          </div>
          <div className="rooster-2">
            {rest.map((c) => {
              // Een cluster met een eigen trajectpagina wordt een kaart waarop
              // geklikt kan worden. De andere blijven staan zoals ze stonden.
              const kern = (
                <>
                  <p className="tag">Cluster</p>
                  <h3>{c.naam}</h3>
                  <p>{c.ondertitel}</p>
                  <p className="beslissing">{c.beslissing}</p>
                  <div className="meta">
                    <b>Instrumenten</b>
                    {c.instrumenten.join(", ")}
                  </div>
                  {c.pad ? <p className="verder">Bekijk het traject</p> : null}
                  {/* Development & Mobility heeft geen eigen trajectpagina. De
                      brug naar de instroombeslissing hoort dus hier. */}
                  {AANSLUITING_RECRUITMENT[c.sleutel] ? (
                    <p className="aansluiting" data-testid={`aansluiting-${c.sleutel}`}>
                      {AANSLUITING_RECRUITMENT[c.sleutel]}
                    </p>
                  ) : null}
                </>
              );
              return c.pad ? (
                <Link key={c.sleutel} href={c.pad} className="kaart">
                  {kern}
                </Link>
              ) : (
                <div key={c.sleutel} className="kaart">
                  {kern}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grijs">
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
