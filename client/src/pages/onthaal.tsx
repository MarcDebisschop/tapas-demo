// ===========================================================================
// onthaal.tsx: de onthaalpagina van TaPas Core.
//
// Dit is de voordeur van de kale versie: de pagina die iemand ziet die het
// platform nog niet kent. Ze legt uit wat het is, waar het ophoudt, wat het
// kost en welke deur bij welke bezoeker hoort.
//
// WAT DIT BESTAND NIET DOET
// Het raakt de bestaande startpagina (pages/home.tsx) niet aan. Die blijft de
// voordeur van het volledige belevingsplatform, met de rondleiding, de tegels
// en de Lounge. App.tsx kiest tussen de twee op basis van CORE_MODE.
//
// OPMAAK
// Alle opmaak staat in onthaal.css en werkt uitsluitend binnen .onthaal, zodat
// geen enkel ander scherm iets merkt van deze pagina. De kleuren volgen het
// thema van de app: de donkere stand hangt aan html.dark, de klasse die
// ThemeProvider.tsx zet.
//
// NAVIGATIE
// De app gebruikt hash-routing. Verwijzingen binnen de pagina mogen daarom
// geen href="#contact" zijn: dat zou de router meesturen. Ze verlopen via
// naarSectie(), die het blok in beeld schuift.
// ===========================================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import "./onthaal.css";
import { vraagOpnieuwAanmeldenNu } from "@/lib/opnieuw-aanmelden";
import { CLUSTERS, HOOFDNAVIGATIE, OUTPUTSTAPEL } from "@/data/oplossingen";
import { neemBlokOp } from "@/lib/naar-blok";

/** De keuzelijst in het formulier. Waarde en tekst blijven gelijk. */
const ROLLEN = [
  "Een particulier, voor mezelf",
  "Een organisatie",
  "Een school of onderwijsinstelling",
  "Een sportclub of mental coach",
  "Een coach of practitioner",
  "Een deelnemer met een vraag",
];

/** Schuift een blok van de pagina in beeld zonder de route te wijzigen. */
function naarSectie(id: string): void {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Verzendstand = "rust" | "bezig" | "gelukt" | "fout";

function Kompasmerk({ maat }: { maat: number }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18.2" stroke="var(--accent)" strokeWidth="1.4" opacity=".45" />
      <circle cx="20" cy="20" r="12.4" stroke="var(--accent)" strokeWidth="1" opacity=".25" />
      <path d="M20 4.6 L23.3 18.1 L16.7 18.1 Z" fill="var(--accent)" />
      <path d="M20 35.4 L23.3 18.1 L16.7 18.1 Z" fill="var(--accent)" opacity=".38" />
      <path d="M35.4 20 L21.9 23.3 L4.6 20 L21.9 16.7 Z" fill="var(--primary)" opacity=".55" />
      <circle cx="20" cy="20" r="2.1" fill="var(--primary)" stroke="var(--card)" strokeWidth="1.2" />
    </svg>
  );
}

function Kompasroos() {
  return (
    <svg className="kompas" viewBox="0 0 300 300" fill="none" aria-label="Kompasroos" role="img">
      <circle cx="150" cy="150" r="140" stroke="var(--accent)" strokeWidth="1" opacity=".30" />
      <circle cx="150" cy="150" r="112" stroke="var(--accent)" strokeWidth="1" opacity=".22" />
      <circle cx="150" cy="150" r="74" stroke="var(--accent)" strokeWidth="1" opacity=".17" />
      <g stroke="var(--accent)" strokeWidth="1" opacity=".34">
        <line x1="150" y1="10" x2="150" y2="34" />
        <line x1="150" y1="266" x2="150" y2="290" />
        <line x1="10" y1="150" x2="34" y2="150" />
        <line x1="266" y1="150" x2="290" y2="150" />
        <line x1="51" y1="51" x2="68" y2="68" />
        <line x1="232" y1="232" x2="249" y2="249" />
        <line x1="249" y1="51" x2="232" y2="68" />
        <line x1="68" y1="232" x2="51" y2="249" />
      </g>
      <path d="M150 44 L164 150 L136 150 Z" fill="var(--accent)" opacity=".95" />
      <path d="M150 256 L164 150 L136 150 Z" fill="var(--accent)" opacity=".40" />
      <path d="M256 150 L150 164 L44 150 L150 136 Z" fill="var(--primary)" opacity=".40" />
      <circle cx="150" cy="150" r="7" fill="var(--primary)" stroke="var(--bg)" strokeWidth="2" />
    </svg>
  );
}

export default function Onthaal() {
  const { theme, toggle } = useTheme();

  // Een bezoeker die op een oplossingpagina op "Plan een kennismaking" klikt,
  // komt hier binnen met de wens om bij een bepaald blok uit te komen. De wens
  // staat kort in sessionStorage en wordt hier gelezen en meteen gewist.
  useEffect(() => {
    const blok = neemBlokOp();
    if (!blok) return;
    const t = window.setTimeout(() => naarSectie(blok), 80);
    return () => window.clearTimeout(t);
  }, []);

  const [naam, setNaam] = useState("");
  const [organisatie, setOrganisatie] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState(ROLLEN[0]);
  const [vraag, setVraag] = useState("");
  const [stand, setStand] = useState<Verzendstand>("rust");
  const [melding, setMelding] = useState("");

  async function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stand === "bezig") return;
    if (!naam.trim() || !email.trim()) {
      setStand("fout");
      setMelding("Vul uw naam en uw e-mailadres in, dan kunnen wij antwoorden.");
      return;
    }
    setStand("bezig");
    setMelding("");
    try {
      const res = await fetch("/api/onthaal-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          organisatie: organisatie.trim(),
          email: email.trim(),
          rol,
          vraag: vraag.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStand("gelukt");
        setMelding("Uw vraag is aangekomen. U krijgt binnen twee werkdagen antwoord van een Tapas-medewerker.");
        setNaam("");
        setOrganisatie("");
        setEmail("");
        setVraag("");
        setRol(ROLLEN[0]);
        return;
      }
      setStand("fout");
      setMelding(
        data.error ??
          "Het versturen lukte niet. Stuur uw vraag naar info@tapascity.com, dan komt ze zeker aan.",
      );
    } catch {
      setStand("fout");
      setMelding(
        "Het versturen lukte niet. Stuur uw vraag naar info@tapascity.com, dan komt ze zeker aan.",
      );
    }
  }

  return (
    <div className="onthaal" data-testid="onthaalpagina">
      <header className="bar">
        <div className="wrap">
          <a
            className="merk"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <Kompasmerk maat={34} />
            <span>
              <span className="naam">Tapas CORE</span>
              <span className="onder">de beslislaag voor talentbeslissingen</span>
            </span>
          </a>
          <nav className="hoofdnav" aria-label="Hoofdnavigatie">
            {HOOFDNAVIGATIE.map((item) =>
              item.sectie ? (
                <button
                  key={item.label}
                  type="button"
                  className="navknop"
                  onClick={() => naarSectie(item.sectie as string)}
                >
                  {item.label}
                </button>
              ) : (
                <Link key={item.label} href={item.pad} className="navknop">
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <button
            className="knop knop-l"
            type="button"
            onClick={toggle}
            aria-label={
              theme === "dark" ? "Wissel naar de lichte weergave" : "Wissel naar de donkere weergave"
            }
            data-testid="onthaal-thema"
          >
            {theme === "dark" ? "Licht" : "Donker"}
          </button>
          <button
            className="knop knop-1"
            type="button"
            onClick={() => naarSectie("contact")}
            data-testid="onthaal-kennismaking-kop"
          >
            Plan een kennismaking
          </button>
        </div>
      </header>

      {/* 1. KOP */}
      <div className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">De beslislaag voor talentbeslissingen</p>
              <h1>
                Tapas CORE helpt organisaties
                <br />
                <em>betere talentbeslissingen</em> nemen.
              </h1>
              <p className="toon">
                Wie investeert, herstructureert of een ploeg samenstelt, beslist over mensen. Tapas
                CORE brengt talent, drivers en energie in beeld op het niveau waarop die beslissing
                valt, en levert rapporten die op een bestuurstafel kunnen liggen.
              </p>
              <div className="hero-acties">
                <button className="knop knop-1" type="button" onClick={() => naarSectie("contact")}>
                  Plan een kennismaking
                </button>
                <Link className="knop knop-2" href="/oplossingen">
                  Bekijk de oplossingen
                </Link>
                <button className="knop knop-2" type="button" onClick={() => naarSectie("werking")}>
                  Bekijk eerst hoe het werkt
                </button>
              </div>
              <div className="wedge">
                <p className="wk">Waar wij het scherpst staan</p>
                <div className="wlijst">
                  {CLUSTERS.filter((c) => c.wedge).map((c) => (
                    <Link key={c.sleutel} href={c.pad as string} className="wkaart">
                      <span className="wn">{c.naam}</span>
                      <span className="wo">{c.ondertitel}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Kompasroos />
            </div>
          </div>
        </div>
      </div>

      {/* 2. VIER ZAKELIJKE INGANGEN */}
      {/* Aanwerven hoort hier bij. Het is het beslismoment dat organisaties het
          vaakst nemen, en de vierde journey draait op dezelfde motor. */}
      <section id="ingangen">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Zakelijke ingangen</p>
            <h2>Welke beslissing ligt bij u op tafel?</h2>
            <p>
              Tapas CORE vertrekt van de beslissing en niet van een vragenlijst. Vier ingangen
              dekken het grootste deel van de vragen die organisaties ons stellen. Het zijn geen
              losse instrumenten maar vier beslismomenten op dezelfde motor.
            </p>
          </div>
          <div className="ingangen vier">
            {["hdd", "leiderschap", "recruitment", "ontwikkeling"].map((sleutel) => {
              const c = CLUSTERS.find((x) => x.sleutel === sleutel);
              if (!c) return null;
              return (
                <Link
                  key={c.sleutel}
                  href={c.pad ?? "/oplossingen"}
                  className="ing"
                  data-testid={`ingang-${c.sleutel}`}
                >
                  <p className="vraag">{c.beslissing}</p>
                  <h3>{c.naam}</h3>
                  <p className="wat">{c.ondertitel}</p>
                  <p className="wie">{c.doelgroep}</p>
                  <span className="verder">
                    {c.pad ? "Bekijk het traject" : "Bekijk de oplossingen"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. DE OUTPUTSTAPEL */}
      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Wat u krijgt</p>
            <h2>Vier rapporten, elk met één lezer</h2>
            <p>
              Een rapport zonder lezer helpt niemand vooruit. Daarom levert het platform vier lagen,
              van het profiel van de deelnemer tot één rapport voor wie de beslissing neemt.
            </p>
          </div>
          <div className="stapelband">
            {OUTPUTSTAPEL.map((o) => (
              <div className="sb" key={o.nummer}>
                <p className="nr">{o.nummer}</p>
                <h3>{o.naam}</h3>
                <p className="lezer">Voor {o.lezer}</p>
                <p className="wat">{o.inhoud}</p>
              </div>
            ))}
          </div>
          <p className="bandnoot">
            Elk rapport draagt zijn versie, taal, datum en de vermelding wie het mag lezen.{" "}
            <Link href="/outputs">Bekijk de volledige opbouw van de outputs</Link>.
          </p>
        </div>
      </section>

      {/* 4. HOE HET WERKT */}
      <section className="grijs" id="werking">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Hoe het werkt</p>
            <h2>Van uitnodiging tot verdieping, in vier stappen</h2>
          </div>

          {/* De kernzin staat op beslisniveau. Ze zegt niet wat het platform
              verstuurt, maar wat een organisatie ermee beslist. De vier stappen
              eronder tonen daarna hoe die beslissing tot stand komt. */}
          <p className="zin zin-werking">
            <b>Wat het is, in één zin.</b>{" "}
            <span>
              Tapas CORE brengt het menselijke deel van een beslissing in beeld: welk talent er
              zit, wat mensen in beweging brengt en waar de energie wegloopt. Dat komt op tafel als
              een rapport waarop een leidinggevende, een bestuur of een investeerder kan handelen.
            </span>
          </p>

          {/* De film staat niet meer op deze pagina. Ze vertelt het verhaal van
              het gereedschap, één niveau onder de beslissing die hier ter sprake
              komt, en hoort daarom in de demo-omgeving waar iemand met de
              bedoeling komt om het platform te zien werken. */}
          <p className="filmwijzer" data-testid="onthaal-filmwijzer">
            Wilt u het platform zien werken? In de{" "}
            <Link href="/demo">demo-omgeving</Link> staat een film van tachtig seconden, met
            gesproken uitleg en ondertitels.
          </p>

          <div className="stappen">
            <div className="stap">
              <p className="nr">STAP 01</p>
              <h3>Uitnodiging</h3>
              <p>U kiest een instrument en stuurt een uitnodiging naar de deelnemer.</p>
            </div>
            <div className="stap">
              <p className="nr">STAP 02</p>
              <h3>Afname</h3>
              <p>De deelnemer vult de vragenlijst in, in zijn eigen taal, op eigen tempo.</p>
            </div>
            <div className="stap">
              <p className="nr">STAP 03</p>
              <h3>Rapport</h3>
              <p>Het rapport komt automatisch klaar, als PDF en als online dashboard.</p>
            </div>
            <div className="stap">
              <p className="nr">STAP 04</p>
              <h3>Verdieping</h3>
              <p>
                Het rapport op uw dashboard geeft u de grote lijn: waar uw talent zit en wat u in
                beweging brengt. Wilt u werkelijk de diepte in, dan hebt u een geaccrediteerde coach
                met licentie nodig.
              </p>
            </div>
          </div>

          <div className="diepte">
            <div>
              <p className="nr" style={{ color: "var(--primary)" }}>
                Zonder coach
              </p>
              <h3>Wat u zelf kunt</h3>
              <p>
                U schaft een vragenlijst aan, vult ze in en krijgt op uw dashboard een eerste
                rapport op hoofdlijnen. Dat rapport is van u, u hebt niemand nodig om het te openen
                of te lezen.
              </p>
            </div>
            <div>
              <p className="nr" style={{ color: "var(--accent)" }}>
                Met coach
              </p>
              <h3>Waar de verdieping begint</h3>
              <p>
                Wilt u van hoofdlijn naar betekenis, wat uw profiel zegt over een keuze die voor u
                ligt en hoe uw drivers zich in uw eigen situatie gedragen, dan reikt u uit naar een
                coach die geaccrediteerd is en over een licentie beschikt. Die stap is bewust geen
                knop op deze pagina: hij vraagt een mens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BREEDTE ALS BEWIJS */}
      <section className="breedte">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Breedte als bewijs</p>
            <h2>Eén motor, zestien instrumenten, vijf talen</h2>
            <p>
              De trajecten hierboven rusten op een instrumentarium dat al jaren in organisaties,
              scholen en sportclubs loopt. Die breedte is geen catalogus om uit te kiezen, ze is het
              bewijs dat de motor het aankan.
            </p>
          </div>
          <div className="feiten">
            <div className="feit">
              <div className="n">16</div>
              <div className="l">instrumenten en modules in het register</div>
            </div>
            <div className="feit">
              <div className="n">10+</div>
              <div className="l">vanaf 10 jaar</div>
            </div>
            <div className="feit">
              <div className="n">5</div>
              <div className="l">talen voor de vragenlijst en het rapport</div>
            </div>
            <div className="feit">
              <div className="n">2×</div>
              <div className="l">rapport: PDF én online</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5a. DE DRIE NAMEN */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Drie namen</p>
            <h2>TaPas, TaPasCity en Tapas CORE</h2>
            <p>Ze horen bij elkaar, maar elk met een eigen focus. In één oogopslag:</p>
          </div>
          <div className="namen">
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--accent)" }} />
              <h3>
                TaPas <i>het gedachtegoed</i>
              </h3>
              <p>
                TAPAS is de samentrekking van <b>TA</b>lent en <b>PAS</b>sie. Talent is het unieke
                vermogen om dingen sneller, beter en met minder inspanning te doen dan anderen.
                Passie is de energiebron die je talent in beweging houdt.
              </p>
            </div>
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--gold)" }} />
              <h3>
                TaPasCity <i>de organisatie</i>
              </h3>
              <p>
                De organisatie achter het gedachtegoed, en een gemeenschap van zelfstandige coaches,
                de crewmembers, die met het instrumentarium werken. Gevestigd in Wijnegem.
              </p>
            </div>
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--werk)" }} />
              <h3>
                Tapas CORE <i>dit platform</i>
              </h3>
              <p>
                De zakelijke kern: instrumenten uitsturen, de afname opvolgen van uitnodiging tot
                PDF, facturatie via credits, en het dashboard van de deelnemer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5b. VOOR WIE */}
      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Voor wie</p>
            <h2>Waarvoor bent u hier?</h2>
            <p>
              Vijf soorten bezoekers, vijf verschillende vragen. Kies de uwe, dan weet u meteen wat
              u hier kunt halen.
            </p>
          </div>
          <div className="paden">
            <div className="pad p2">
              <span className="tag" style={{ background: "var(--primary)" }}>
                Uzelf
              </span>
              <h3>Weten waar uw eigen talent zit</h3>
              <p className="wil">
                “Welke talenten brengen me in een energie-flow? […] Welke context sluit het best aan
                bij mijn potentieel en bij wie ik ben?”
              </p>
              <div className="lijst">
                <b>Wat er voor u in zit</b>
                Een eigen profiel als PDF én online dashboard. Voor de professional het T4P Business
                Kompas, voor de student T4Students, voor de leerling T4Teens, en 2MinScan als korte
                eerste kennismaking. Deze vier schaft u zelf aan, zonder tussenkomst van een
                organisatie of een coach.
              </div>
              <Link className="knop knop-3" href="/instrumenten">
                Bekijk de instrumenten
              </Link>
            </div>

            <div className="pad p2">
              <span className="tag" style={{ background: "var(--werk)" }}>
                Organisatie
              </span>
              <h3>Zicht op talent en energie in uw organisatie</h3>
              <p className="wil">
                “Je wil zicht krijgen op de talenten en passie van je organisatie, los van de
                individuele talenten van de medewerkers.”
              </p>
              <div className="lijst">
                <b>Wat er voor u in zit</b>
                T4P Business Kompas · T4Organizations · TaPas Teamscan · Impact-roos · T4Recruitment
                · Human Due Diligence · 2MinScan
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                Plan een kennismaking
              </button>
            </div>

            <div className="pad p2">
              <span className="tag" style={{ background: "var(--studie-dk)" }}>
                Onderwijs
              </span>
              <h3>Vertrekken van wat een jongere wél kan</h3>
              <p className="wil">
                “We willen talenten en passie van kinderen, jongeren en jongvolwassenen in kaart
                brengen om te kunnen vertrekken van wat ze wel kunnen.”
              </p>
              <div className="lijst">
                <b>Wat er voor u in zit</b>
                T4Teens · T4Students · T4Kids
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                Vraag het schoolaanbod
              </button>
            </div>

            <div className="pad p3">
              <span className="tag" style={{ background: "var(--accent)" }}>
                Sport
              </span>
              <h3>Mentaal talent onder prestatiedruk</h3>
              <p className="wil">
                “Waar ligt mijn mentaal talent als atleet? Welke drivers werken onder prestatiedruk?
                Hoe versterk ik veerkracht, flow en atletische identiteit?”
              </p>
              <div className="lijst">
                <b>Wat er voor u in zit</b>
                T4Sports geeft een volledig Mental Talent Profiel (deel 1 en 2), met de modules
                Resilience, Flow-State en Atletische Identiteit. Voor topsporters, mental coaches en
                sportpsychologen.
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                Vraag het sportaanbod
              </button>
            </div>

            <div className="pad p3">
              <span className="tag" style={{ background: "var(--lounge)" }}>
                Coach &amp; practitioner
              </span>
              <h3>Zelf met het instrumentarium werken</h3>
              <p className="wil">
                “Wie zelf als Tapas practitioner, coach of facilitator aan de slag wil.”
              </p>
              <div className="lijst">
                <b>Wat er voor u in zit</b>
                Toegang tot het volledige instrumentarium na accreditatie, plus de Self-Training
                Module, het zelfstudieplatform dat bij het accreditatietraject hoort.
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                Vraag toegang aan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5c. WAT HET OPLEVERT */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Wat het oplevert</p>
            <h2>Een instrument is zo goed als de vragen die het beantwoordt</h2>
            <p>
              Daarom staan hier geen beloftes, maar de vragen waarop een deelnemer na de afname een
              antwoord heeft, en wat er precies uit komt.
            </p>
          </div>
          <div className="opbr">
            <div className="op">
              <p className="inst">T4P Business Kompas</p>
              <blockquote>
                “Welke talenten brengen me in een energie-flow? Welke drivers zijn ondersteunend of
                remmend? Welke context sluit het best aan bij mijn potentieel en bij wie ik ben?”
              </blockquote>
              <p className="uit">
                <b>U krijgt:</b> een rijk TaPas Kompas-rapport met talent-foci, versnellers,
                drivers, energieprofiel én TaPas Jester-classificatie, als PDF én online dashboard.
              </p>
            </div>
            <div className="op">
              <p className="inst">TaPas Teamscan</p>
              <blockquote>
                “Hoe werkt ons team echt samen? Waar zit vertrouwen, en waar wringt het? Welke
                disfuncties spelen, en hoe adresseren we ze concreet?”
              </blockquote>
              <p className="uit">
                <b>U krijgt:</b> een collectief teamrapport met sterktes, spanningsvelden en
                concrete actiepunten, plus een facilitatiegids voor de teamcoach.
              </p>
            </div>
            <div className="op">
              <p className="inst">T4Teens</p>
              <blockquote>
                “Waar liggen mijn talenten als jongere? Welke studierichting past bij wie ik ben?
                Wat geeft mij energie op school en daarbuiten?”
              </blockquote>
              <p className="uit">
                <b>U krijgt:</b> een T4Teens talentkaart in jongerentaal, met
                studierichtingssuggesties op basis van de talent-foci.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ONDERBOUWING EN GRENZEN */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Onderbouwing en grenzen</p>
            <h2>Wat wij wél kunnen aantonen, en waar het ophoudt</h2>
            <p>
              Beide horen op deze pagina. Een instrument dat zijn eigen grenzen niet benoemt, is
              niet te vertrouwen.
            </p>
          </div>
          <div className="bewijs">
            <div className="bw">
              <div className="cijfer">{"96,9\u2009%"}</div>
              <h3>van 64 wetenschappelijke verwijzingen correct</h3>
              <p>
                Een systematische scan van het onderliggende kader identificeerde 64
                wetenschappelijke auteurs en theorieën. Daarvan bleek {"96,9\u2009%"} feitelijk en
                inhoudelijk correct weergegeven. Geen enkele verwijzing was onjuist; één (GRIT) werd
                genuanceerd wegens recente meta-analyses.
              </p>
              <div className="beperking">
                <b>En dit hoort er eerlijk bij.</b> Die review werd AI-ondersteund uitgevoerd, niet
                als peer review. Het rapport noemt het kader zelf “theoretisch goed onderbouwd en
                psychometrisch veelbelovend, waarvoor verdere peer-reviewed validatie wenselijk is”.
                Er bestaat samenwerking met academische partners, maar niet alle resultaten zijn al
                gepubliceerd.
              </div>
            </div>
            <div className="bw">
              <div className="grens">!</div>
              <h3 style={{ marginTop: 18 }}>Wat TaPas niet is</h3>
              <p>
                TaPas is een reflectie- en ontwikkelinstrument. Wat het oplevert is een
                gespreksbasis, geen oordeel over iemands toekomst.
              </p>
              <ul className="geen">
                <li>Geen diagnose</li>
                <li>Geen selectiebeslissing</li>
                <li>Geen potentieelbepaling</li>
              </ul>
              <p style={{ marginTop: 22, fontSize: "14.5px", color: "var(--muted)" }}>
                Diezelfde grens staat onderaan elke pagina van het platform en in de voettekst van
                elk rapport. Ze is geen kleine letter, ze is de afspraak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. VOOR WIE HET PLATFORM AL GEBRUIKT */}
      <section id="aanmelden">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">Voor wie het platform al gebruikt</p>
            <h2>Vijf deuren, één platform</h2>
            <p>
              Wie al een plaats in het platform heeft, hoort geen formulier te moeten invullen: die
              gaat rechtstreeks naar de eigen deur. Wie nog geen plaats heeft, komt bij het
              contactformulier uit.
            </p>
          </div>
          <div className="deuren">
            <Link className="deur" href="/mijn" data-testid="deur-deelnemer">
              <p className="dr">Deelnemer</p>
              <h3>Ik kreeg een uitnodiging</h3>
              <p>
                Uw eigen ruimte: de vragenlijsten die voor u klaarstaan, uw afgewerkte afnames en uw
                rapporten, in PDF en online.
              </p>
              <ol className="deurstap">
                <li>U vult het e-mailadres in waarop u de uitnodiging kreeg.</li>
                <li>Wij sturen een aanmeldlink naar dat adres.</li>
                <li>U klikt de link aan en staat in uw eigen dashboard.</li>
              </ol>
              <p className="nodig">
                <b>Nodig:</b> uw e-mailadres. Geen wachtwoord.
              </p>
              <span className="pad-uit">/mijn</span>
            </Link>
            <Link className="deur" href="/coach">
              <p className="dr">Coach &amp; practitioner</p>
              <h3>Ik werk met het instrumentarium</h3>
              <p>
                Uw praktijk: deelnemers uitnodigen, afnames opvolgen, rapporten opmaken en
                gesprekken voorbereiden.
              </p>
              <ol className="deurstap">
                <li>U meldt zich aan met uw coach-account.</li>
                <li>U ziet uw deelnemers en hun afnames.</li>
                <li>Tijdens het accreditatietraject staat de Self-Training Module erbij.</li>
              </ol>
              <p className="nodig">
                <b>Nodig:</b> een coach-account. Nog geen account? Vraag toegang via het formulier
                onderaan deze pagina.
              </p>
              <span className="pad-uit">/coach</span>
            </Link>
            <Link className="deur" href="/organisatie">
              <p className="dr">Organisatie of school</p>
              <h3>Ik beheer een groep</h3>
              <p>
                Uw overzicht: wie is uitgenodigd, wie is klaar, welke rapporten liggen er, en
                hoeveel credits staan er nog.
              </p>
              <ol className="deurstap">
                <li>U meldt zich aan met het organisatie-account.</li>
                <li>U nodigt medewerkers of leerlingen uit.</li>
                <li>U volgt de voortgang en haalt de rapporten op.</li>
              </ol>
              <p className="nodig">
                <b>Nodig:</b> een organisatie-account, aangemaakt bij de opstart.
              </p>
              <span className="pad-uit">/organisatie</span>
            </Link>
            <Link className="deur" href="/instrumenten">
              <p className="dr">Eerst rondkijken</p>
              <h3>Ik wil het aanbod zien</h3>
              <p>
                De publieke gids: per instrument welke vraag het beantwoordt, voor wie het bedoeld
                is, hoe lang het duurt en wat er uit komt.
              </p>
              <ol className="deurstap">
                <li>U kiest een doelgroep of een vraag.</li>
                <li>U leest de fiche van het instrument.</li>
                <li>Wilt u meer weten, dan brengt de gids u bij het formulier.</li>
              </ol>
              <p className="nodig">
                <b>Nodig:</b> niets. Geen aanmelding, geen account.
              </p>
              <span className="pad-uit">/instrumenten</span>
            </Link>
            <a
              className="deur deur-vol"
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                naarSectie("contact");
              }}
            >
              <p className="dr">Nog geen plaats</p>
              <h3>Ik wil kennismaken</h3>
              <p>
                Geen account, geen uitnodiging? Dan is het formulier hieronder de juiste weg. U
                krijgt antwoord van een Tapas-medewerker, geen automatisch traject.
              </p>
              <ol className="deurstap">
                <li>U vertelt kort wie u bent en wat u zoekt.</li>
                <li>Wij lezen dat na en antwoorden persoonlijk.</li>
                <li>Past het, dan volgt een gesprek van een halfuur.</li>
              </ol>
              <p className="nodig">
                <b>Nodig:</b> uw naam en een e-mailadres.
              </p>
              <span className="pad-uit">het formulier hieronder</span>
            </a>
          </div>
          <div className="veilig">
            <p className="vk">De deelnemersdeur, stap voor stap</p>
            <h3>Een aanmeldlink in plaats van een wachtwoord</h3>
            <p>
              Deelnemers hebben geen wachtwoord. Dat is een bewuste keuze: een wachtwoord dat je één
              keer per jaar nodig hebt, wordt opgeschreven of vergeten. In de plaats komt een link
              die naar de eigen mailbox gaat. Wie die mailbox niet kan openen, komt niet binnen.
            </p>
            <div className="vstap">
              <div>
                <p className="nr">Stap 1</p>
                <p className="t">U vult uw e-mailadres in</p>
                <p className="b">
                  Hetzelfde adres waarop u de uitnodiging kreeg. Verder niets.
                </p>
              </div>
              <div>
                <p className="nr">Stap 2</p>
                <p className="t">Wij sturen een link</p>
                <p className="b">
                  Alleen naar dat adres. Kent het platform het adres niet, dan wordt er niets
                  verstuurd, en ziet u toch dezelfde boodschap.
                </p>
              </div>
              <div>
                <p className="nr">Stap 3</p>
                <p className="t">U klikt de link aan</p>
                <p className="b">Binnen een kwartier. De link werkt één keer en vervalt daarna.</p>
              </div>
              <div>
                <p className="nr">Stap 4</p>
                <p className="t">U staat in uw dashboard</p>
                <p className="b">
                  Uw afnames, uw rapporten, uw gesproken uitleg. Niemand anders ziet die.
                </p>
              </div>
            </div>
            <ul className="waarborg">
              <li>De link is 15 minuten geldig en werkt precies één keer.</li>
              <li>
                Het adres invullen maakt géén account aan: alleen wie al een plaats heeft, krijgt
                een link.
              </li>
              <li>
                De pagina geeft altijd dezelfde boodschap, ook bij een onbekend adres, zodat niemand
                kan aftasten wie er in het platform staat.
              </li>
              <li>
                De link zelf staat nooit in het antwoord van de pagina: hij gaat uitsluitend naar de
                mailbox.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. CONTACT */}
      <section className="contact" id="contact">
        <div className="wrap">
          <div className="c-grid">
            <div>
              <p className="eyebrow">Contact</p>
              <h2>Eén gesprek is genoeg om te weten of dit iets voor u is</h2>
              <p className="lead">
                Laat weten wie u bent en wat u zoekt. Geen verkooppraatje, geen automatisch traject.
              </p>
              <form onSubmit={verstuur} data-testid="onthaal-formulier">
                <div className="veldrij" style={{ marginTop: 30 }}>
                  <div>
                    <label htmlFor="onthaal-naam">Naam</label>
                    <input
                      id="onthaal-naam"
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      placeholder="Voor- en achternaam"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="onthaal-org">Organisatie of school</label>
                    <input
                      id="onthaal-org"
                      value={organisatie}
                      onChange={(e) => setOrganisatie(e.target.value)}
                      placeholder="Naam van uw organisatie"
                      autoComplete="organization"
                    />
                  </div>
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-email">E-mail</label>
                  <input
                    id="onthaal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="u@voorbeeld.be"
                    autoComplete="email"
                  />
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-rol">Ik ben</label>
                  <select
                    id="onthaal-rol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                  >
                    {ROLLEN.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-vraag">Uw vraag</label>
                  <textarea
                    id="onthaal-vraag"
                    value={vraag}
                    onChange={(e) => setVraag(e.target.value)}
                    placeholder="Wat wilt u bereiken, en voor hoeveel mensen?"
                  />
                </div>
                <div
                  style={{
                    marginTop: 26,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px 26px",
                    alignItems: "center",
                  }}
                >
                  <button
                    className="knop knop-1"
                    type="submit"
                    disabled={stand === "bezig"}
                    data-testid="onthaal-verstuur"
                  >
                    {stand === "bezig" ? "Bezig met versturen" : "Verstuur mijn vraag"}
                  </button>
                  <span className="na" role="status" aria-live="polite">
                    {melding ||
                      "U krijgt binnen twee werkdagen antwoord van een Tapas-medewerker."}
                  </span>
                </div>
              </form>
            </div>
            <div>
              <div className="c-blok">
                <h3>Rechtstreeks</h3>
                <p>
                  <a href="mailto:info@tapascity.com">info@tapascity.com</a>
                  <br />
                  Zandstraat 85, 2110 Wijnegem
                  <br />
                  <a href="https://nl.linkedin.com/company/tapascity">TaPasCity op LinkedIn</a>
                </p>
              </div>
              <div className="c-blok">
                <h3>Wat het kost</h3>
                <p>
                  <b>Voor uzelf.</b> De instrumenten die u zelf kunt aanschaffen, staan in het
                  instrumentenoverzicht. U kiest er een, u ziet het bedrag voor u betaalt, en u
                  start. Geen gesprek nodig.
                </p>
                <p style={{ marginTop: 14 }}>
                  <b>Voor een organisatie of een school.</b> Daar werkt het platform met credits per
                  afname. De prijs hangt af van het volume en van het instrument, en u krijgt een
                  concreet voorstel na het gesprek.
                </p>
              </div>
              <div className="c-blok">
                <h3>Al een uitnodiging gekregen?</h3>
                <p>
                  Dan hoeft u hier niets te vragen. Meld u aan met het e-mailadres waarop u de
                  uitnodiging kreeg, u krijgt dan een aanmeldlink die 15 minuten geldig blijft.
                </p>
                <p style={{ marginTop: 16 }}>
                  <Link className="knop knop-2" href="/mijn">
                    Aanmelden op het platform
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="f-top">
            <div style={{ marginRight: "auto" }}>
              <div className="merk" style={{ margin: 0 }}>
                <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <circle
                    cx="20"
                    cy="20"
                    r="18.2"
                    stroke="var(--accent)"
                    strokeWidth="1.4"
                    opacity=".4"
                  />
                  <path
                    d="M20 4.6 L23.3 18.1 L20 35.4 L16.7 18.1 Z"
                    fill="var(--accent)"
                    opacity=".8"
                  />
                  <path
                    d="M35.4 20 L21.9 23.3 L4.6 20 L21.9 16.7 Z"
                    fill="var(--primary)"
                    opacity=".45"
                  />
                </svg>
                <span>
                  <span className="naam" style={{ color: "var(--primary)" }}>
                    Tapas CORE
                  </span>
                </span>
              </div>
            </div>
            <div className="f-drie">
              <span>
                <b>TaPas</b>: het gedachtegoed
              </span>
              <span>
                <b>TaPasCity</b>: de organisatie
              </span>
              <span>
                <b>Tapas CORE</b>: dit platform
              </span>
            </div>
          </div>
          <p className="f-note">
            TaPas is een reflectie- en ontwikkelinstrument. Geen diagnose, selectie of
            potentieelbepaling.
          </p>
          <p className="f-cr">
            © 2BQ Consult · TaPasCity · info@tapascity.com · Zandstraat 85, 2110 Wijnegem ·{" "}
            <Link
              href="/admin"
              data-testid="onthaal-beheer"
              onClick={() => vraagOpnieuwAanmeldenNu()}
              style={{ textDecoration: "underline dotted", textUnderlineOffset: "3px" }}
            >
              Beheer
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
