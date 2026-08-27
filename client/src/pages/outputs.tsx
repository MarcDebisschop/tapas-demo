// ===========================================================================
// outputs.tsx: de outputstapel van Tapas CORE.
//
// Wat het platform oplevert, is geen stapel PDF's maar een reeks rapporten met
// elk één lezer. Deze pagina legt die logica vast: individueel inzicht,
// begeleidersrapport, managementsamenvatting, bestuursrapport. Daarbij horen de
// markeringen die op elk rapport staan: versie, taal, datum en de vermelding wie
// het mag lezen.
// ===========================================================================

import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { MARKERINGEN, OUTPUTSTAPEL } from "@/data/oplossingen";
import "./publiek.css";

export default function Outputs() {
  return (
    <div className="publiek" data-testid="outputspagina">
      <PubliekeKop nu="Outputs" />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">Outputs</p>
          <h1>Rapporten die een beslissing dragen</h1>
          <p className="lead">
            Een profiel dat niemand kan gebruiken, is geen resultaat. Daarom heeft elk rapport van
            Tapas CORE een benoemde lezer: het zegt voor wie het bedoeld is, wat erin staat en wat
            er niet uit gelezen mag worden. Dezelfde vier lagen komen terug bij elk instrument en
            bij elk traject.
          </p>
          <div className="acties">
            <Link href="/oplossingen" className="knop knop-3">
              Bekijk de trajecten
            </Link>
            <Link href="/demo" className="knop knop-2">
              Zie ze in de demo-omgeving
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">De stapel</p>
            <h2>Vier lagen, van de deelnemer tot het bestuur</h2>
            <p>
              De lagen bouwen op elkaar. Wie hoger in de stapel leest, ziet minder detail en meer
              richting. Individuele scores blijven onder de eerste twee lagen.
            </p>
          </div>
          <div className="stapel">
            {OUTPUTSTAPEL.map((o) => (
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
        </div>
      </section>

      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Kwaliteit en beheer</p>
            <h2>Wat op elk rapport staat</h2>
            <p>
              Vier markeringen maken een rapport navolgbaar, ook maanden later en ook voor iemand
              die er niet bij was toen het gemaakt werd.
            </p>
          </div>
          <div className="markeringen">
            {MARKERINGEN.map((m) => (
              <div className="mk" key={m.label}>
                <p className="l">{m.label}</p>
                <p className="w">{m.waarde}</p>
                <p className="u">{m.uitleg}</p>
              </div>
            ))}
          </div>
          <div className="prijs">
            <p className="pk">Beslisklaar</p>
            <p>
              De rapporten worden opgeleverd in de taal van de deelnemer, met de datum van afname en de
              rapportversie erbij. Wie de beslissing neemt, leest het bestuursrapport. Wie het gesprek
              voert, leest het begeleidersrapport. De deelnemer leest altijd eerst zijn eigen profiel.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Grenzen</p>
            <h2>Waarvoor deze rapporten niet dienen</h2>
            <p>
              Ze onderbouwen een gesprek en een beslissing. Ze stellen geen diagnose, nemen geen
              selectiebeslissing en bepalen geen potentieel.
            </p>
          </div>
          <div className="acties" style={{ marginTop: 0 }}>
            <Link href="/onderbouwing" className="knop knop-3">
              Lees de onderbouwing
            </Link>
            <Link
              href="/"
              className="knop knop-2"
              onClick={() => onthoudBlok("contact")}
            >
              Vraag een voorbeeldrapport
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
