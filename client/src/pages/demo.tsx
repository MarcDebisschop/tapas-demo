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
// ===========================================================================

import { useState } from "react";
import { Link } from "wouter";
import PubliekeKop from "@/components/PubliekeKop";
import PubliekeVoet from "@/components/PubliekeVoet";
import { onthoudBlok } from "@/lib/naar-blok";
import { DEMO_CASES, DEMO_JOURNEYS } from "@/data/oplossingen";
import "./publiek.css";

export default function Demo() {
  const [journeySleutel, setJourneySleutel] = useState(DEMO_JOURNEYS[0].sleutel);
  const [caseSleutel, setCaseSleutel] = useState<string | null>(null);

  const journey =
    DEMO_JOURNEYS.find((j) => j.sleutel === journeySleutel) ?? DEMO_JOURNEYS[0];
  const gekozenCase = DEMO_CASES.find((c) => c.sleutel === caseSleutel) ?? null;

  /** Een case kiest zelf de journey die bij de context past. */
  function kiesCase(sleutel: string): void {
    if (caseSleutel === sleutel) {
      setCaseSleutel(null);
      return;
    }
    const c = DEMO_CASES.find((x) => x.sleutel === sleutel);
    setCaseSleutel(sleutel);
    if (c) {
      const bij = DEMO_JOURNEYS.find((j) => c.journey.startsWith(j.naam));
      if (bij) setJourneySleutel(bij.sleutel);
    }
  }

  return (
    <div className="publiek" data-testid="demopagina">
      <PubliekeKop />

      <div className="kop-blok">
        <div className="wrap">
          <p className="eyebrow">Demo-omgeving</p>
          <h1>Een traject tonen, niet een vragenlijst</h1>
          <p className="lead">
            Kies een journey en, als u wil, een casecontext. U ziet dan hoe het traject verloopt: wie
            deelneemt, welke stappen er zijn, welke rapporten eruit komen en welke beslissing erop
            volgt. De cijfers en de namen zijn fictief, de opbouw is die van een echt dossier.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Kies een journey</p>
            <h2>Drie trajecten</h2>
          </div>
          <div className="keuzerij" role="group" aria-label="Kies een journey">
            {DEMO_JOURNEYS.map((j) => (
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
            <p className="eyebrow">Casemodus</p>
            <h2>Drie contexten</h2>
            <p>
              Een case zet het traject in een herkenbare situatie en kiest zelf de journey die
              daarbij hoort. Klik de case opnieuw aan om de context weer weg te nemen.
            </p>
          </div>
          <div className="keuzerij" role="group" aria-label="Kies een casecontext">
            {DEMO_CASES.map((c) => (
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
              <p className="pk">Casecontext</p>
              <p>{gekozenCase.context}</p>
              <p style={{ marginTop: "10px" }}>
                <b>De vraag op tafel:</b> {gekozenCase.vraag}
              </p>
              <p style={{ marginTop: "10px" }}>
                <b>Wat het oplevert:</b> {gekozenCase.uitkomst}
              </p>
            </div>
          )}

          <div className="verhaal" data-testid="demo-verhaal" style={{ marginTop: "34px" }}>
            <div className="vk">
              <p className="eyebrow">Journey</p>
              <h3>{journey.naam}</h3>
              <p>{journey.probleem}</p>
            </div>
            <div className="vlijf">
              <div className="vblok">
                <h4>Deelnemers</h4>
                <p style={{ fontSize: "15px", color: "var(--fg-2)" }}>{journey.deelnemers}</p>
                <h4 style={{ marginTop: "24px" }}>Verloop</h4>
                <ol>
                  {journey.flow.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </div>
              <div className="vblok">
                <h4>Outputs</h4>
                <ul>
                  {journey.outputs.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <h4 style={{ marginTop: "24px" }}>Bewaking</h4>
                <p style={{ fontSize: "15px", color: "var(--fg-2)" }}>
                  Elk rapport draagt zijn versie, taal, datum en de vermelding wie het mag lezen.
                  Individuele scores blijven bij de deelnemer en zijn begeleider.
                </p>
              </div>
            </div>
            <div className="slot">
              <b>Vervolgactie:</b> {journey.vervolgactie}
            </div>
          </div>

          {/* De film van het platform staat hier en niet op de onthaalpagina.
              Ze toont het gereedschap aan het werk, en dat is precies wat
              iemand in de demo-omgeving komt zien. Bewust geen automatisch
              spelen: er is gesproken tekst, dus geluid blijft een keuze. Het
              ondertitelspoor staat klaar maar niet aan. */}
          <div className="sec-kop" style={{ marginTop: "56px" }}>
            <p className="eyebrow">Het platform aan het werk</p>
            <h2>Tachtig seconden door de omgeving</h2>
            <p>
              Van de uitnodiging tot het rapport, opgenomen in de echte omgeving. Wie liever leest:
              de trajecten en de outputs staan volledig uitgeschreven op hun eigen pagina.
            </p>
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
              Uw browser kan deze film niet spelen. Het verloop van elk traject staat hierboven in
              tekst.
            </video>
            <figcaption>
              Gesproken uitleg in het Nederlands. Ondertitels zijn in de speler aan te zetten.
            </figcaption>
          </figure>

          <div className="acties" style={{ marginTop: "34px" }}>
            <Link
              href="/"
              className="knop knop-1"
              onClick={() => onthoudBlok("contact")}
            >
              Vraag een begeleide demo
            </Link>
            <Link href="/oplossingen" className="knop knop-2">
              Bekijk de trajecten
            </Link>
            <Link href="/outputs" className="knop knop-2">
              Bekijk de outputs
            </Link>
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}
