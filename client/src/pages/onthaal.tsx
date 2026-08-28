// ===========================================================================
// onthaal.tsx: de onthaalpagina van TaPas Core.
//
// Dit is de voordeur van de kale versie: de pagina die iemand ziet die het
// platform nog niet kent. Ze legt uit wat het is, waar het ophoudt, wat het
// kost en welke deur bij welke bezoeker hoort.
//
// TWEETALIG, MET ENGELS ALS STANDAARD
// De pagina is de voordeur van een internationaal aanbod. Wie hier voor het
// eerst binnenkomt, leest daarom Engels; Nederlands blijft volwaardig en staat
// één knop ver, via de TaalKeuze in de kopbalk (publiek/taal.tsx). De pagina
// draagt zelf geen zichtbare tekst meer: de koppels staan in
// publiek/teksten-onthaal.ts en de gedeelde lijsten komen per taal uit
// publiek/inhoud.ts. Zo staat elke tekst één keer, in beide talen.
//
// DE CATEGORIECLAIM
// Bovenaan de kop staat de categorieclaim uit het strategisch dossier. Ze is
// het grootste element van de pagina en blijft in BEIDE talen in het Engels:
// het is een merkregel, geen lopende tekst. De bestaande belofte staat eronder
// als leesregel en wisselt wél met de taal.
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

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import "./onthaal.css";
import { vraagOpnieuwAanmeldenNu } from "@/lib/opnieuw-aanmelden";
import { clusters, hoofdnavigatie, outputstapel } from "@/publiek/inhoud";
import { kies, TaalKeuze, usePubliekeTaal } from "@/publiek/taal";
import {
  CATEGORIECLAIM,
  CATEGORIECLAIM_ZAKELIJK,
  T,
} from "@/publiek/teksten-onthaal";
import { neemBlokOp } from "@/lib/naar-blok";

/**
 * De keuzelijst in het formulier. Het opschrift wisselt met de taal, de WAARDE
 * die naar de server gaat is altijd het Nederlandse lid: die blijft dus
 * ongewijzigd, in welke taal de bezoeker de pagina ook leest.
 */
const ROLLEN = [
  T.rollen.particulier,
  T.rollen.organisatie,
  T.rollen.school,
  T.rollen.sport,
  T.rollen.coach,
  T.rollen.deelnemer,
];

/**
 * Houdt woorden met een koppelteken op één regel.
 *
 * In een grote kop breekt een browser "passion-driven" bij het koppelteken af,
 * en dan staat "passion-" alleen op het einde van een regel. Dat leest slecht,
 * juist in de zin die het eerste is wat een bezoeker ziet. Deze functie geeft
 * elk woord met een koppelteken mee als een stukje dat niet mag breken, zodat
 * de regel ervoor afbreekt in plaats van middenin het woord. De tekst zelf
 * blijft ongewijzigd: er komt geen ander teken in de plaats.
 */
function houdSamengesteldeWoordenSamen(tekst: string): ReactNode[] {
  return tekst.split(" ").flatMap((woord, i) => {
    const ruimte = i === 0 ? [] : [" "];
    const stuk = woord.includes("-") ? (
      <span key={`w${i}`} className="bijeen">
        {woord}
      </span>
    ) : (
      woord
    );
    return [...ruimte, stuk];
  });
}

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

function Kompasroos({ label }: { label: string }) {
  return (
    <svg className="kompas" viewBox="0 0 300 300" fill="none" aria-label={label} role="img">
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
  const { taal } = usePubliekeTaal();

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
  const [rol, setRol] = useState(ROLLEN[0].nl);
  const [vraag, setVraag] = useState("");
  const [stand, setStand] = useState<Verzendstand>("rust");
  const [melding, setMelding] = useState("");

  async function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stand === "bezig") return;
    if (!naam.trim() || !email.trim()) {
      setStand("fout");
      setMelding(kies(T.contact.foutLeeg, taal));
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
        setMelding(kies(T.contact.gelukt, taal));
        setNaam("");
        setOrganisatie("");
        setEmail("");
        setVraag("");
        setRol(ROLLEN[0].nl);
        return;
      }
      setStand("fout");
      setMelding(data.error ?? kies(T.contact.foutVersturen, taal));
    } catch {
      setStand("fout");
      setMelding(kies(T.contact.foutVersturen, taal));
    }
  }

  return (
    <div className="onthaal" lang={taal} data-testid="onthaalpagina">
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
              <span className="onder">{kies(T.kop.merkOnder, taal)}</span>
            </span>
          </a>
          <nav className="hoofdnav" aria-label={kies(T.kop.navLabel, taal)}>
            {/* Het label wisselt met de taal, dus de sleutel en elke vergelijking
                van de actieve stand lopen over item.pad, een machinewaarde. */}
            {hoofdnavigatie(taal).map((item) =>
              item.sectie ? (
                <button
                  key={item.pad}
                  type="button"
                  className="navknop"
                  onClick={() => naarSectie(item.sectie as string)}
                >
                  {item.label}
                </button>
              ) : (
                <Link key={item.pad} href={item.pad} className="navknop">
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <TaalKeuze />
          <button
            className="knop knop-l"
            type="button"
            onClick={toggle}
            aria-label={
              theme === "dark" ? kies(T.kop.naarLicht, taal) : kies(T.kop.naarDonker, taal)
            }
            data-testid="onthaal-thema"
          >
            {theme === "dark" ? kies(T.kop.licht, taal) : kies(T.kop.donker, taal)}
          </button>
          <button
            className="knop knop-1"
            type="button"
            onClick={() => naarSectie("contact")}
            data-testid="onthaal-kennismaking-kop"
          >
            {kies(T.kop.kennismaking, taal)}
          </button>
        </div>
      </header>

      {/* 1. KOP */}
      <div className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              {/* De categorieclaim: de positionering, bovenaan en het grootst.
                  Ze blijft in beide talen Engels; de belofte eronder wisselt. */}
              <div className="claimblok" data-testid="categorieclaim">
                <p className="eyebrow">{kies(T.hero.eyebrow, taal)}</p>
                <h1 className="claim">{houdSamengesteldeWoordenSamen(CATEGORIECLAIM)}</h1>
                <p className="claim-zakelijk" data-testid="categorieclaim-zakelijk">
                  {CATEGORIECLAIM_ZAKELIJK}
                </p>
              </div>
              <p className="belofte">
                {kies(T.hero.belofteKop, taal)}
                <br />
                <em>{kies(T.hero.belofteKern, taal)}</em>
                {kies(T.hero.belofteStaart, taal)}
              </p>
              <p className="toon">{kies(T.hero.toon, taal)}</p>
              <div className="hero-acties">
                <button className="knop knop-1" type="button" onClick={() => naarSectie("contact")}>
                  {kies(T.kop.kennismaking, taal)}
                </button>
                <Link className="knop knop-2" href="/oplossingen">
                  {kies(T.hero.naarOplossingen, taal)}
                </Link>
                <button className="knop knop-2" type="button" onClick={() => naarSectie("werking")}>
                  {kies(T.hero.naarWerking, taal)}
                </button>
              </div>
              <div className="wedge">
                <p className="wk">{kies(T.hero.wedgeKop, taal)}</p>
                <div className="wlijst">
                  {clusters(taal)
                    .filter((c) => c.wedge)
                    .map((c) => (
                      <Link key={c.sleutel} href={c.pad as string} className="wkaart">
                        <span className="wn">{c.naam}</span>
                        <span className="wo">{c.ondertitel}</span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>
            <div>
              <Kompasroos label={kies(T.beeld.kompasroos, taal)} />
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
            <p className="eyebrow">{kies(T.ingangen.eyebrow, taal)}</p>
            <h2>{kies(T.ingangen.titel, taal)}</h2>
            <p>{kies(T.ingangen.tekst, taal)}</p>
          </div>
          <div className="ingangen vier">
            {["hdd", "leiderschap", "recruitment", "ontwikkeling"].map((sleutel) => {
              const c = clusters(taal).find((x) => x.sleutel === sleutel);
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
                    {c.pad
                      ? kies(T.ingangen.verderTraject, taal)
                      : kies(T.ingangen.verderOplossingen, taal)}
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
            <p className="eyebrow">{kies(T.outputs.eyebrow, taal)}</p>
            <h2>{kies(T.outputs.titel, taal)}</h2>
            <p>{kies(T.outputs.tekst, taal)}</p>
          </div>
          <div className="stapelband">
            {outputstapel(taal).map((o) => (
              <div className="sb" key={o.nummer}>
                <p className="nr">{o.nummer}</p>
                <h3>{o.naam}</h3>
                <p className="lezer">
                  {kies(T.outputs.voor, taal)}
                  {o.lezer}
                </p>
                <p className="wat">{o.inhoud}</p>
              </div>
            ))}
          </div>
          <p className="bandnoot">
            {kies(T.outputs.noot, taal)}{" "}
            <Link href="/outputs">{kies(T.outputs.nootLink, taal)}</Link>.
          </p>
        </div>
      </section>

      {/* 4. HOE HET WERKT */}
      <section className="grijs" id="werking">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.werking.eyebrow, taal)}</p>
            <h2>{kies(T.werking.titel, taal)}</h2>
          </div>

          {/* De kernzin staat op beslisniveau. Ze zegt niet wat het platform
              verstuurt, maar wat een organisatie ermee beslist. De vier stappen
              eronder tonen daarna hoe die beslissing tot stand komt. */}
          <p className="zin zin-werking">
            <b>{kies(T.werking.zinKop, taal)}</b>{" "}
            <span>{kies(T.werking.zinTekst, taal)}</span>
          </p>

          {/* De film staat niet meer op deze pagina. Ze vertelt het verhaal van
              het gereedschap, één niveau onder de beslissing die hier ter sprake
              komt, en hoort daarom in de demo-omgeving waar iemand met de
              bedoeling komt om het platform te zien werken. */}
          <p className="filmwijzer" data-testid="onthaal-filmwijzer">
            {kies(T.werking.filmVoor, taal)}{" "}
            <Link href="/demo">{kies(T.werking.filmLink, taal)}</Link>
            {kies(T.werking.filmNa, taal)}
          </p>

          <div className="stappen">
            <div className="stap">
              <p className="nr">{kies(T.werking.stap1nr, taal)}</p>
              <h3>{kies(T.werking.stap1titel, taal)}</h3>
              <p>{kies(T.werking.stap1tekst, taal)}</p>
            </div>
            <div className="stap">
              <p className="nr">{kies(T.werking.stap2nr, taal)}</p>
              <h3>{kies(T.werking.stap2titel, taal)}</h3>
              <p>{kies(T.werking.stap2tekst, taal)}</p>
            </div>
            <div className="stap">
              <p className="nr">{kies(T.werking.stap3nr, taal)}</p>
              <h3>{kies(T.werking.stap3titel, taal)}</h3>
              <p>{kies(T.werking.stap3tekst, taal)}</p>
            </div>
            <div className="stap">
              <p className="nr">{kies(T.werking.stap4nr, taal)}</p>
              <h3>{kies(T.werking.stap4titel, taal)}</h3>
              <p>{kies(T.werking.stap4tekst, taal)}</p>
            </div>
          </div>

          <div className="diepte">
            <div>
              <p className="nr" style={{ color: "var(--primary)" }}>
                {kies(T.werking.zonderCoach, taal)}
              </p>
              <h3>{kies(T.werking.zonderCoachTitel, taal)}</h3>
              <p>{kies(T.werking.zonderCoachTekst, taal)}</p>
            </div>
            <div>
              <p className="nr" style={{ color: "var(--accent)" }}>
                {kies(T.werking.metCoach, taal)}
              </p>
              <h3>{kies(T.werking.metCoachTitel, taal)}</h3>
              <p>{kies(T.werking.metCoachTekst, taal)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BREEDTE ALS BEWIJS */}
      <section className="breedte">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.breedte.eyebrow, taal)}</p>
            <h2>{kies(T.breedte.titel, taal)}</h2>
            <p>{kies(T.breedte.tekst, taal)}</p>
          </div>
          <div className="feiten">
            <div className="feit">
              <div className="n">16</div>
              <div className="l">{kies(T.breedte.feit1, taal)}</div>
            </div>
            <div className="feit">
              <div className="n">10+</div>
              <div className="l">{kies(T.breedte.feit2, taal)}</div>
            </div>
            <div className="feit">
              <div className="n">5</div>
              <div className="l">{kies(T.breedte.feit3, taal)}</div>
            </div>
            <div className="feit">
              <div className="n">2×</div>
              <div className="l">{kies(T.breedte.feit4, taal)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5a. DE DRIE NAMEN */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.namen.eyebrow, taal)}</p>
            <h2>{kies(T.namen.titel, taal)}</h2>
            <p>{kies(T.namen.tekst, taal)}</p>
          </div>
          <div className="namen">
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--accent)" }} />
              <h3>
                TaPas <i>{kies(T.namen.rolGedachtegoed, taal)}</i>
              </h3>
              <p>
                {kies(T.namen.tapasVoor, taal)}
                <b>TA</b>
                {kies(T.namen.tapasMidden, taal)}
                <b>PAS</b>
                {kies(T.namen.tapasNa, taal)}
              </p>
            </div>
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--gold)" }} />
              <h3>
                TaPasCity <i>{kies(T.namen.rolOrganisatie, taal)}</i>
              </h3>
              <p>{kies(T.namen.stadTekst, taal)}</p>
            </div>
            <div className="naam-k">
              <div className="streep" style={{ background: "var(--werk)" }} />
              <h3>
                Tapas CORE <i>{kies(T.namen.rolPlatform, taal)}</i>
              </h3>
              <p>{kies(T.namen.coreTekst, taal)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5b. VOOR WIE */}
      <section className="grijs">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.voorwie.eyebrow, taal)}</p>
            <h2>{kies(T.voorwie.titel, taal)}</h2>
            <p>{kies(T.voorwie.tekst, taal)}</p>
          </div>
          <div className="paden">
            <div className="pad p2">
              <span className="tag" style={{ background: "var(--primary)" }}>
                {kies(T.voorwie.zelfTag, taal)}
              </span>
              <h3>{kies(T.voorwie.zelfTitel, taal)}</h3>
              <p className="wil">{kies(T.voorwie.zelfWil, taal)}</p>
              <div className="lijst">
                <b>{kies(T.voorwie.lijstKop, taal)}</b>
                {kies(T.voorwie.zelfLijst, taal)}
              </div>
              <Link className="knop knop-3" href="/instrumenten">
                {kies(T.voorwie.zelfKnop, taal)}
              </Link>
            </div>

            <div className="pad p2">
              <span className="tag" style={{ background: "var(--werk)" }}>
                {kies(T.voorwie.orgTag, taal)}
              </span>
              <h3>{kies(T.voorwie.orgTitel, taal)}</h3>
              <p className="wil">{kies(T.voorwie.orgWil, taal)}</p>
              <div className="lijst">
                <b>{kies(T.voorwie.lijstKop, taal)}</b>
                {kies(T.voorwie.orgLijst, taal)}
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                {kies(T.kop.kennismaking, taal)}
              </button>
            </div>

            <div className="pad p2">
              <span className="tag" style={{ background: "var(--studie-dk)" }}>
                {kies(T.voorwie.onderwijsTag, taal)}
              </span>
              <h3>{kies(T.voorwie.onderwijsTitel, taal)}</h3>
              <p className="wil">{kies(T.voorwie.onderwijsWil, taal)}</p>
              <div className="lijst">
                <b>{kies(T.voorwie.lijstKop, taal)}</b>
                {kies(T.voorwie.onderwijsLijst, taal)}
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                {kies(T.voorwie.onderwijsKnop, taal)}
              </button>
            </div>

            <div className="pad p3">
              <span className="tag" style={{ background: "var(--accent)" }}>
                {kies(T.voorwie.sportTag, taal)}
              </span>
              <h3>{kies(T.voorwie.sportTitel, taal)}</h3>
              <p className="wil">{kies(T.voorwie.sportWil, taal)}</p>
              <div className="lijst">
                <b>{kies(T.voorwie.lijstKop, taal)}</b>
                {kies(T.voorwie.sportLijst, taal)}
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                {kies(T.voorwie.sportKnop, taal)}
              </button>
            </div>

            <div className="pad p3">
              <span className="tag" style={{ background: "var(--lounge)" }}>
                {kies(T.voorwie.coachTag, taal)}
              </span>
              <h3>{kies(T.voorwie.coachTitel, taal)}</h3>
              <p className="wil">{kies(T.voorwie.coachWil, taal)}</p>
              <div className="lijst">
                <b>{kies(T.voorwie.lijstKop, taal)}</b>
                {kies(T.voorwie.coachLijst, taal)}
              </div>
              <button className="knop knop-3" type="button" onClick={() => naarSectie("contact")}>
                {kies(T.voorwie.coachKnop, taal)}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5c. WAT HET OPLEVERT */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.oplevert.eyebrow, taal)}</p>
            <h2>{kies(T.oplevert.titel, taal)}</h2>
            <p>{kies(T.oplevert.tekst, taal)}</p>
          </div>
          <div className="opbr">
            <div className="op">
              <p className="inst">T4P Business Kompas</p>
              <blockquote>{kies(T.oplevert.kompasVraag, taal)}</blockquote>
              <p className="uit">
                <b>{kies(T.oplevert.ukrijgt, taal)}</b> {kies(T.oplevert.kompasUit, taal)}
              </p>
            </div>
            <div className="op">
              <p className="inst">TaPas Teamscan</p>
              <blockquote>{kies(T.oplevert.teamVraag, taal)}</blockquote>
              <p className="uit">
                <b>{kies(T.oplevert.ukrijgt, taal)}</b> {kies(T.oplevert.teamUit, taal)}
              </p>
            </div>
            <div className="op">
              <p className="inst">T4Teens</p>
              <blockquote>{kies(T.oplevert.teensVraag, taal)}</blockquote>
              <p className="uit">
                <b>{kies(T.oplevert.ukrijgt, taal)}</b> {kies(T.oplevert.teensUit, taal)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ONDERBOUWING EN GRENZEN */}
      <section>
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.grenzen.eyebrow, taal)}</p>
            <h2>{kies(T.grenzen.titel, taal)}</h2>
            <p>{kies(T.grenzen.tekst, taal)}</p>
          </div>
          <div className="bewijs">
            <div className="bw">
              <div className="cijfer">{kies(T.grenzen.cijfer, taal)}</div>
              <h3>{kies(T.grenzen.cijferTitel, taal)}</h3>
              <p>{kies(T.grenzen.cijferTekst, taal)}</p>
              <div className="beperking">
                <b>{kies(T.grenzen.beperkingKop, taal)}</b>{" "}
                {kies(T.grenzen.beperkingTekst, taal)}
              </div>
            </div>
            <div className="bw">
              <div className="grens">!</div>
              <h3 style={{ marginTop: 18 }}>{kies(T.grenzen.nietTitel, taal)}</h3>
              <p>{kies(T.grenzen.nietTekst, taal)}</p>
              <ul className="geen">
                <li>{kies(T.grenzen.geenDiagnose, taal)}</li>
                <li>{kies(T.grenzen.geenSelectie, taal)}</li>
                <li>{kies(T.grenzen.geenPotentieel, taal)}</li>
              </ul>
              <p style={{ marginTop: 22, fontSize: "14.5px", color: "var(--muted)" }}>
                {kies(T.grenzen.grensNoot, taal)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. VOOR WIE HET PLATFORM AL GEBRUIKT */}
      <section id="aanmelden">
        <div className="wrap">
          <div className="sec-kop">
            <p className="eyebrow">{kies(T.deuren.eyebrow, taal)}</p>
            <h2>{kies(T.deuren.titel, taal)}</h2>
            <p>{kies(T.deuren.tekst, taal)}</p>
          </div>
          <div className="deuren">
            <Link className="deur" href="/mijn" data-testid="deur-deelnemer">
              <p className="dr">{kies(T.deuren.deelnemerDr, taal)}</p>
              <h3>{kies(T.deuren.deelnemerTitel, taal)}</h3>
              <p>{kies(T.deuren.deelnemerTekst, taal)}</p>
              <ol className="deurstap">
                <li>{kies(T.deuren.deelnemerStap1, taal)}</li>
                <li>{kies(T.deuren.deelnemerStap2, taal)}</li>
                <li>{kies(T.deuren.deelnemerStap3, taal)}</li>
              </ol>
              <p className="nodig">
                <b>{kies(T.deuren.nodigKop, taal)}</b> {kies(T.deuren.deelnemerNodig, taal)}
              </p>
              <span className="pad-uit">/mijn</span>
            </Link>
            <Link className="deur" href="/coach">
              <p className="dr">{kies(T.deuren.coachDr, taal)}</p>
              <h3>{kies(T.deuren.coachTitel, taal)}</h3>
              <p>{kies(T.deuren.coachTekst, taal)}</p>
              <ol className="deurstap">
                <li>{kies(T.deuren.coachStap1, taal)}</li>
                <li>{kies(T.deuren.coachStap2, taal)}</li>
                <li>{kies(T.deuren.coachStap3, taal)}</li>
              </ol>
              <p className="nodig">
                <b>{kies(T.deuren.nodigKop, taal)}</b> {kies(T.deuren.coachNodig, taal)}
              </p>
              <span className="pad-uit">/coach</span>
            </Link>
            <Link className="deur" href="/organisatie">
              <p className="dr">{kies(T.deuren.orgDr, taal)}</p>
              <h3>{kies(T.deuren.orgTitel, taal)}</h3>
              <p>{kies(T.deuren.orgTekst, taal)}</p>
              <ol className="deurstap">
                <li>{kies(T.deuren.orgStap1, taal)}</li>
                <li>{kies(T.deuren.orgStap2, taal)}</li>
                <li>{kies(T.deuren.orgStap3, taal)}</li>
              </ol>
              <p className="nodig">
                <b>{kies(T.deuren.nodigKop, taal)}</b> {kies(T.deuren.orgNodig, taal)}
              </p>
              <span className="pad-uit">/organisatie</span>
            </Link>
            <Link className="deur" href="/instrumenten">
              <p className="dr">{kies(T.deuren.kijkDr, taal)}</p>
              <h3>{kies(T.deuren.kijkTitel, taal)}</h3>
              <p>{kies(T.deuren.kijkTekst, taal)}</p>
              <ol className="deurstap">
                <li>{kies(T.deuren.kijkStap1, taal)}</li>
                <li>{kies(T.deuren.kijkStap2, taal)}</li>
                <li>{kies(T.deuren.kijkStap3, taal)}</li>
              </ol>
              <p className="nodig">
                <b>{kies(T.deuren.nodigKop, taal)}</b> {kies(T.deuren.kijkNodig, taal)}
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
              <p className="dr">{kies(T.deuren.nieuwDr, taal)}</p>
              <h3>{kies(T.deuren.nieuwTitel, taal)}</h3>
              <p>{kies(T.deuren.nieuwTekst, taal)}</p>
              <ol className="deurstap">
                <li>{kies(T.deuren.nieuwStap1, taal)}</li>
                <li>{kies(T.deuren.nieuwStap2, taal)}</li>
                <li>{kies(T.deuren.nieuwStap3, taal)}</li>
              </ol>
              <p className="nodig">
                <b>{kies(T.deuren.nodigKop, taal)}</b> {kies(T.deuren.nieuwNodig, taal)}
              </p>
              <span className="pad-uit">{kies(T.deuren.nieuwPad, taal)}</span>
            </a>
          </div>
          <div className="veilig">
            <p className="vk">{kies(T.veilig.vk, taal)}</p>
            <h3>{kies(T.veilig.titel, taal)}</h3>
            <p>{kies(T.veilig.tekst, taal)}</p>
            <div className="vstap">
              <div>
                <p className="nr">{kies(T.veilig.stap1nr, taal)}</p>
                <p className="t">{kies(T.veilig.stap1t, taal)}</p>
                <p className="b">{kies(T.veilig.stap1b, taal)}</p>
              </div>
              <div>
                <p className="nr">{kies(T.veilig.stap2nr, taal)}</p>
                <p className="t">{kies(T.veilig.stap2t, taal)}</p>
                <p className="b">{kies(T.veilig.stap2b, taal)}</p>
              </div>
              <div>
                <p className="nr">{kies(T.veilig.stap3nr, taal)}</p>
                <p className="t">{kies(T.veilig.stap3t, taal)}</p>
                <p className="b">{kies(T.veilig.stap3b, taal)}</p>
              </div>
              <div>
                <p className="nr">{kies(T.veilig.stap4nr, taal)}</p>
                <p className="t">{kies(T.veilig.stap4t, taal)}</p>
                <p className="b">{kies(T.veilig.stap4b, taal)}</p>
              </div>
            </div>
            <ul className="waarborg">
              <li>{kies(T.veilig.waarborg1, taal)}</li>
              <li>{kies(T.veilig.waarborg2, taal)}</li>
              <li>{kies(T.veilig.waarborg3, taal)}</li>
              <li>{kies(T.veilig.waarborg4, taal)}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. CONTACT */}
      <section className="contact" id="contact">
        <div className="wrap">
          <div className="c-grid">
            <div>
              <p className="eyebrow">{kies(T.contact.eyebrow, taal)}</p>
              <h2>{kies(T.contact.titel, taal)}</h2>
              <p className="lead">{kies(T.contact.lead, taal)}</p>
              <form onSubmit={verstuur} data-testid="onthaal-formulier">
                <div className="veldrij" style={{ marginTop: 30 }}>
                  <div>
                    <label htmlFor="onthaal-naam">{kies(T.contact.labelNaam, taal)}</label>
                    <input
                      id="onthaal-naam"
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      placeholder={kies(T.contact.plaatsNaam, taal)}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="onthaal-org">{kies(T.contact.labelOrg, taal)}</label>
                    <input
                      id="onthaal-org"
                      value={organisatie}
                      onChange={(e) => setOrganisatie(e.target.value)}
                      placeholder={kies(T.contact.plaatsOrg, taal)}
                      autoComplete="organization"
                    />
                  </div>
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-email">{kies(T.contact.labelEmail, taal)}</label>
                  <input
                    id="onthaal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={kies(T.contact.plaatsEmail, taal)}
                    autoComplete="email"
                  />
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-rol">{kies(T.contact.labelRol, taal)}</label>
                  <select
                    id="onthaal-rol"
                    value={rol}
                    onChange={(e) => {
                      // De keuzelijst toont het opschrift in de taal van de
                      // bezoeker, maar de waarde die verder gaat blijft het
                      // Nederlandse lid uit de reeks hierboven. We zoeken die
                      // op in plaats van de ruwe waarde door te geven, zodat
                      // de server precies dezelfde rollen blijft zien.
                      const gekozen = ROLLEN.find((r) => r.nl === e.target.value);
                      if (gekozen) setRol(gekozen.nl);
                    }}
                  >
                    {ROLLEN.map((r) => (
                      <option key={r.nl} value={r.nl}>
                        {kies(r, taal)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="veld">
                  <label htmlFor="onthaal-vraag">{kies(T.contact.labelVraag, taal)}</label>
                  <textarea
                    id="onthaal-vraag"
                    value={vraag}
                    onChange={(e) => setVraag(e.target.value)}
                    placeholder={kies(T.contact.plaatsVraag, taal)}
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
                    {stand === "bezig"
                      ? kies(T.contact.verstuurBezig, taal)
                      : kies(T.contact.verstuur, taal)}
                  </button>
                  <span className="na" role="status" aria-live="polite">
                    {melding || kies(T.contact.naDefault, taal)}
                  </span>
                </div>
              </form>
            </div>
            <div>
              <div className="c-blok">
                <h3>{kies(T.contact.blokDirect, taal)}</h3>
                <p>
                  <a href="mailto:info@tapascity.com">info@tapascity.com</a>
                  <br />
                  Zandstraat 85, 2110 Wijnegem
                  <br />
                  <a href="https://nl.linkedin.com/company/tapascity">
                    {kies(T.contact.linkedin, taal)}
                  </a>
                </p>
              </div>
              <div className="c-blok">
                <h3>{kies(T.contact.blokKost, taal)}</h3>
                <p>
                  <b>{kies(T.contact.kostZelfKop, taal)}</b> {kies(T.contact.kostZelf, taal)}
                </p>
                <p style={{ marginTop: 14 }}>
                  <b>{kies(T.contact.kostOrgKop, taal)}</b> {kies(T.contact.kostOrg, taal)}
                </p>
              </div>
              <div className="c-blok">
                <h3>{kies(T.contact.blokUitnodiging, taal)}</h3>
                <p>{kies(T.contact.uitnodigingTekst, taal)}</p>
                <p style={{ marginTop: 16 }}>
                  <Link className="knop knop-2" href="/mijn">
                    {kies(T.contact.aanmeldKnop, taal)}
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
                <b>TaPas</b>: {kies(T.namen.rolGedachtegoed, taal)}
              </span>
              <span>
                <b>TaPasCity</b>: {kies(T.namen.rolOrganisatie, taal)}
              </span>
              <span>
                <b>Tapas CORE</b>: {kies(T.namen.rolPlatform, taal)}
              </span>
            </div>
          </div>
          <p className="f-note">{kies(T.voet.note, taal)}</p>
          <p className="f-cr">
            © 2BQ Consult · TaPasCity · info@tapascity.com · Zandstraat 85, 2110 Wijnegem ·{" "}
            <Link
              href="/admin"
              data-testid="onthaal-beheer"
              onClick={() => vraagOpnieuwAanmeldenNu()}
              style={{ textDecoration: "underline dotted", textUnderlineOffset: "3px" }}
            >
              {kies(T.voet.beheer, taal)}
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
