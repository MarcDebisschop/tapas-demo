// ===========================================================================
// demo.tsx: de demo-omgeving als verkoopinstrument.
//
// Dit is geen proefomgeving om instrumenten uit te proberen. Het is een
// omgeving om een traject te tonen: drie journeys, elk met een vast verhaal
// (probleem, deelnemers, verloop, outputs, vervolgactie), en een casemodus met
// drie contexten die een gesprek met een organisatie of een investeerder
// herkenbaar maken.
//
// De demo verzint geen cijfers en opent geen echte afname. Wie het platform
// zelf wil zien werken, gaat langs de bestaande omgevingen.
//
// TWEETALIG
// De pagina is tweetalig, met Engels als standaard. De journeys en de cases
// komen per taal uit publiek/inhoud.ts, de eigen teksten uit
// publiek/teksten-paginas.ts. De sleutels zijn machinewaarden en blijven in
// beide talen gelijk, zodat een keuze een taalwissel overleeft. De film van het
// platform bestaat vandaag enkel in het Nederlands; het onderschrift zegt dat
// ook in de Engelse weergave.
// ===========================================================================

import { useState } from "react";
import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { demoCases, demoJourneys } from "@/publiek/inhoud";
import { kies, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import "./publiek.css";

export default function Demo() {
  const { taal } = usePubliekeTaal();
  const journeys = demoJourneys(taal);
  const cases = demoCases(taal);
  const [journeySleutel, setJourneySleutel] = useState(journeys[0].sleutel);
  const [caseSleutel, setCaseSleutel] = useState<string | null>(null);

  const journey = journeys.find((j) => j.sleutel === journeySleutel) ?? journeys[0];
  const gekozenCase = cases.find((c) => c.sleutel === caseSleutel) ?? null;

  /** Een case kiest zelf de journey die bij de context past. */
  function kiesCase(sleutel: string): void {
    if (caseSleutel === sleutel) {
      setCaseSleutel(null);
      return;
    }
    const c = cases.find((x) => x.sleutel === sleutel);
    setCaseSleutel(sleutel);
    if (c) {
      const bij = journeys.find((j) => c.journey.startsWith(j.naam));
      if (bij) setJourneySleutel(bij.sleutel);
    }
  }

  return (
    <div className="publiek" lang={taal} data-testid="demopagina">
      <PubliekeKop />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">{kies(T.demo.eyebrow, taal)}</p>
          <h1>{kies(T.demo.titel, taal)}</h1>
          <p className="lead">{kies(T.demo.lead, taal)}</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.demo.journeyEyebrow, taal)}</p>
            <h2>{kies(T.demo.journeyKop, taal)}</h2>
          </div>
          <div className="keuzerij" role="group" aria-label={kies(T.demo.journeyGroep, taal)}>
            {journeys.map((j) => (
              <button
                key={j.sleutel}
                type="button"
                className="keuze"
                aria-pressed={j.sleutel === journeySleutel}
                data-testid={`demo-journey-${j.sleutel}`}
                onClick={() => setJourneySleutel(j.sleutel)}
              >
                {j.naam}
              </button>
            ))}
          </div>

          <div className="sec-kop" style={{ marginBottom: "18px" }}>
            <p className="eyebrow">{kies(T.demo.caseEyebrow, taal)}</p>
            <h2>{kies(T.demo.caseKop, taal)}</h2>
            <p>{kies(T.demo.caseUitleg, taal)}</p>
          </div>
          <div className="keuzerij" role="group" aria-label={kies(T.demo.caseGroep, taal)}>
            {cases.map((c) => (
              <button
                key={c.sleutel}
                type="button"
                className="keuze"
                aria-pressed={c.sleutel === caseSleutel}
                data-testid={`demo-case-${c.sleutel}`}
                onClick={() => kiesCase(c.sleutel)}
              >
                {c.naam}
              </button>
            ))}
          </div>

          {gekozenCase && (
            <div className="prijs" data-testid="demo-casecontext" style={{ marginTop: 0 }}>
              <p className="pk">{kies(T.demo.caseContextKop, taal)}</p>
              <p>{gekozenCase.context}</p>
              <p style={{ marginTop: "10px" }}>
                <b>{kies(T.demo.vraagOpTafel, taal)}</b> {gekozenCase.vraag}
              </p>
              <p style={{ marginTop: "10px" }}>
                <b>{kies(T.demo.watHetOplevert, taal)}</b> {gekozenCase.uitkomst}
              </p>
            </div>
          )}

          <div className="verhaal" data-testid="demo-verhaal" style={{ marginTop: "34px" }}>
            <div className="vk">
              <p className="eyebrow">{kies(T.demo.journeyLabel, taal)}</p>
              <h3>{journey.naam}</h3>
              <p>{journey.probleem}</p>
            </div>
            <div className="vlijf">
              <div className="vblok">
                <h4>{kies(T.demo.deelnemers, taal)}</h4>
                <p style={{ fontSize: "15px", color: "var(--fg-2)" }}>{journey.deelnemers}</p>
                <h4 style={{ marginTop: "24px" }}>{kies(T.demo.verloop, taal)}</h4>
                <ol>
                  {journey.flow.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </div>
              <div className="vblok">
                <h4>{kies(T.demo.outputs, taal)}</h4>
                <ul>
                  {journey.outputs.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <h4 style={{ marginTop: "24px" }}>{kies(T.demo.bewaking, taal)}</h4>
                <p style={{ fontSize: "15px", color: "var(--fg-2)" }}>
                  {kies(T.demo.bewakingTekst, taal)}
                </p>
              </div>
            </div>
            <div className="slot">
              <b>{kies(T.demo.vervolgactie, taal)}</b> {journey.vervolgactie}
            </div>
          </div>

          {/* De film van het platform staat hier en niet op de onthaalpagina.
              Ze toont het gereedschap aan het werk, en dat is precies wat
              iemand in de demo-omgeving komt zien. Bewust geen automatisch
              spelen: er is gesproken tekst, dus geluid blijft een keuze. Het
              ondertitelspoor staat klaar maar niet aan. */}
          <div className="sec-kop" style={{ marginTop: "56px" }}>
            <p className="eyebrow">{kies(T.demo.filmEyebrow, taal)}</p>
            <h2>{kies(T.demo.filmKop, taal)}</h2>
            <p>{kies(T.demo.filmUitleg, taal)}</p>
          </div>
          <figure className="film">
            <video
              controls
              playsInline
              preload="none"
              poster="/film/tapas-core-nl-beeld.jpg"
              data-testid="demo-film"
            >
              <source src="/film/tapas-core-nl.mp4" type="video/mp4" />
              <track
                kind="subtitles"
                srcLang="nl"
                label="Nederlands"
                src="/film/tapas-core-nl.vtt"
              />
              {kies(T.demo.geenFilm, taal)}
            </video>
            <figcaption>{kies(T.demo.onderschrift, taal)}</figcaption>
          </figure>

          <div className="acties" style={{ marginTop: "34px" }}>
            <Link
              href="/"
              className="knop knop-1"
              onClick={() => onthoudBlok("contact")}
            >
              {kies(T.demo.begeleideDemo, taal)}
            </Link>
            <Link href="/oplossingen" className="knop knop-2">
              {kies(T.demo.naarTrajecten, taal)}
            </Link>
            <Link href="/outputs" className="knop knop-2">
              {kies(T.demo.naarOutputs, taal)}
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
