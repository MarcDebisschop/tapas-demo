// =============================================================================
// lounge.tsx — EXACT overgenomen uit tapas-zip-8 bundle (index-CxFhBwUz.js)
// Geen interpretaties. Alle data-arrays, classNames, structuur en tekst zijn verbatim.
//
// Symbool mapping (minified → leesbaar):
//   a.jsx / a.jsxs  → JSX (React)
//   j.useState etc  → React hooks
//   ni()            → useLocation (wouter)
//   St              → AppHeader
//   Ti              → Sparkles (lucide)
//   Wn              → ArrowRight (lucide)
//   ml              → ArrowLeft (lucide)
//   Tb              → Pause (lucide)
//   sm (icon)       → Play (lucide)
//   boe             → Wind (lucide)
//   W4              → BookOpen (lucide)
//   fK              → Music2 (lucide)
//   coe             → ShoppingBag (lucide)
//   rK              → Coffee (lucide)
//   eoe             → Image (lucide)
//   hK              → PenTool (lucide)
//   m3              → Sun (lucide)
//   aoe             → NotebookPen (lucide)
//   Xr              → LOUNGE_VAR (CSS variabele naam)
//   or              → LOUNGE_KLEUR (hsl waarde)
//   Bre             → KAMERS (kamer array)
//   K8e             → (auth wrapper — vervangen door fragment)
//   W8e             → (login modal — niet gebruikt in demo)
//   G8e             → (lid status — niet gebruikt in demo)
//   eh()            → (auth context — niet gebruikt in demo)
// =============================================================================

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/Brand";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Pause,
  Play,
  Wind,
  BookOpen,
  Music2,
  ShoppingBag,
  Coffee,
  Image,
  PenTool,
  Sun,
  NotebookPen,
  Radio,
} from "lucide-react";

// =============================================================================
// CSS variabelen en kleur (verbatim uit bundle: const Xr="--lounge", or=...)
// =============================================================================
const LOUNGE_VAR = "--lounge";
const LOUNGE_KLEUR = `hsl(var(${LOUNGE_VAR}))`;

// =============================================================================
// Kamer array (verbatim uit bundle: const Bre=[...])
// icon-namen vervangen door geïmporteerde Lucide componenten
// =============================================================================
const KAMERS = [
  { id: "stilte",        naam: "De Stilte Kamer",    eyebrow: "Verstillen",  korte: "Mediteren, ademen, gewoon er zijn.",             icon: Wind         },
  { id: "studie",        naam: "De Studie Kamer",    eyebrow: "Verdiepen",   korte: "Bibliotheek, podcasts en de Meeting-Room.",       icon: BookOpen     },
  { id: "muziek",        naam: "De Muziek Kamer",    eyebrow: "Beluisteren", korte: "Het TAPAS-lied en gekozen componisten.",          icon: Music2       },
  { id: "webshop",       naam: "De Webshop",         eyebrow: "Meenemen",    korte: "Het boek Zichtbaar, kledij en het lied.",         icon: ShoppingBag  },
  { id: "talentencafe",  naam: "Het Talentencafé",   eyebrow: "Ontmoeten",   korte: "Gesprekken aan thematische tafels.",              icon: Coffee       },
  { id: "inspiratiewand",naam: "De Inspiratiewand",  eyebrow: "Herkennen",   korte: "Talentportretten van leden, opt-in.",             icon: Image        },
  { id: "werkplaats",    naam: "De Werkplaats",      eyebrow: "Co-creëren",  korte: "Schrijven en creatieve expressie samen.",         icon: PenTool      },
  { id: "reflectie",     naam: "De Reflectiekamer",  eyebrow: "Bezinnen",    korte: "Een strikt privé groeidagboek.",                  icon: NotebookPen  },
  { id: "terras",        naam: "Het Buitenterras",   eyebrow: "Samenkomen",  korte: "Live sessies en seizoensmomenten.",               icon: Sun          },
];

// Kamer-id → weergavenaam (verbatim uit bundle: const hHe={...})
const KAMER_NAMEN: Record<string, string> = {
  stilte:         "De Stilte Kamer",
  studie:         "De Studie Kamer",
  muziek:         "De Muziek Kamer",
  webshop:        "De Webshop",
  talentencafe:   "Het Talentencafé",
  inspiratiewand: "De Inspiratiewand",
  werkplaats:     "De Werkplaats",
  reflectie:      "De Reflectiekamer",
  terras:         "Het Buitenterras",
};

// =============================================================================
// Adem oefeningen (verbatim uit bundle: const X$=[...])
// =============================================================================
const ADEM_OEFENINGEN = [
  { naam: "Vierkant ademen",     omschrijving: "Vier tellen in, vier vasthouden, vier uit, vier rust. Voor helderheid.", in: 4, vast: 4, uit: 4, rust: 4 },
  { naam: "Verlengde uitademing",omschrijving: "Vier in, zes uit. Kalmeert het zenuwstelsel.",                           in: 4, vast: 0, uit: 6, rust: 0 },
  { naam: "Rustige golf",        omschrijving: "Vijf in, vijf uit. Een traag, gelijkmatig ritme.",                       in: 5, vast: 0, uit: 5, rust: 0 },
];

// =============================================================================
// Meditatie data (verbatim uit bundle: const Px={...})
// =============================================================================
const MEDITATIE = {
  titel: "Even landen",
  duur: "Ongeveer 5 minuten",
  intro: "Een korte aankomst-meditatie om de drukte even te laten zakken. Lees rustig mee, of sluit je ogen en laat de zinnen na elke stap nawerken. Er is niets te bereiken — je mag gewoon hier zijn.",
  stappen: [
    { kop: "Aankomen",           tekst: "Zoek een houding waarin je een tijdje stil kunt zitten. Voeten op de grond, handen los in de schoot. Voel het gewicht van je lichaam dat door de stoel wordt gedragen. Je hoeft even nergens heen." },
    { kop: "De adem volgen",     tekst: "Adem traag in door de neus, en laat de uitademing iets langer duren dan de inademing. Volg drie of vier ademhalingen, zonder ze te sturen. Merk hoe de adem vanzelf zijn eigen tempo vindt." },
    { kop: "Het lichaam verkennen", tekst: "Laat je aandacht zacht langs je lichaam reizen — van je schouders, naar je armen, je buik, je benen. Waar je spanning voelt, hoef je niets te veranderen. Je merkt het enkel op, met een vriendelijke blik." },
    { kop: "Een woord meenemen", tekst: "Kies in stilte één woord dat je vandaag goed kunt gebruiken — rust, ruimte, vertrouwen, of iets eigens. Laat het woord op de inademing meekomen, en op de uitademing zachtjes wegzakken." },
    { kop: "Terugkeren",         tekst: "Breng je aandacht weer naar de ruimte om je heen. Beweeg je vingers, je schouders. Open je ogen wanneer je er klaar voor bent, en neem iets van deze rust mee naar wat er straks komt." },
  ],
};

// =============================================================================
// Radio config (behouden uit vorige versie)
// =============================================================================
const RADIO_STREAMS = [
  "https://stream.radiomediterranea.com:8160/lounge.mp3",
  "https://de.auroramedia.am/jazz.mp3",
];

// =============================================================================
// Helper componenten (verbatim uit bundle)
// =============================================================================

// Ru — eyebrow label
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: LOUNGE_KLEUR }}>
      {children}
    </p>
  );
}

// gF — sectie header
function SectieHeader({ eyebrow, titel, intro }: { eyebrow: string; titel: string; intro: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.15]">
        {titel}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{intro}</p>
    </div>
  );
}

// aA — kaart container
function KaartContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-t-[3px] border-border p-5 sm:p-6 ${className}`}
      style={{
        borderTopColor: LOUNGE_KLEUR,
        background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.10) 0%, hsl(var(--card)) 60%)`,
      }}
    >
      {children}
    </div>
  );
}

// GP — badge
function LoungebBadge({ tekst }: { tekst: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
      style={{
        color: LOUNGE_KLEUR,
        borderColor: `hsl(var(${LOUNGE_VAR})/0.4)`,
        background: `hsl(var(${LOUNGE_VAR})/0.10)`,
      }}
    >
      <Sparkles className="h-3 w-3" />
      {tekst}
    </span>
  );
}

// =============================================================================
// Ademhaling animatie (verbatim uit bundle: function iHe)
// =============================================================================
function AdemhalingAnimatie({ oefening }: { oefening: typeof ADEM_OEFENINGEN[0] }) {
  const stappen = [
    { label: "Adem in",     sec: oefening.in   },
    { label: "Houd vast",   sec: oefening.vast  },
    { label: "Adem uit",    sec: oefening.uit   },
    { label: "Rust",        sec: oefening.rust  },
  ].filter((s) => s.sec > 0);

  const [actief, setActief] = useState(false);
  const [stapIdx, setStapIdx] = useState(0);
  const [secOver, setSecOver] = useState(stappen[0].sec);

  useEffect(() => {
    setStapIdx(0);
    setSecOver(stappen[0].sec);
    setActief(false);
  }, [oefening.naam]);

  useEffect(() => {
    if (!actief) return;
    const interval = window.setInterval(() => {
      setSecOver((p) => {
        if (p > 1) return p - 1;
        setStapIdx((v) => (v + 1) % stappen.length);
        return stappen[(stapIdx + 1) % stappen.length].sec;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [actief, stapIdx]);

  const huidigeStp = stappen[stapIdx];
  const isIn  = huidigeStp.label === "Adem in";
  const isUit = huidigeStp.label === "Adem uit";
  const schaal = actief ? (isIn ? 1 : isUit ? 0.7 : stapIdx === 1 ? 1 : 0.7) : 0.78;

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid h-56 w-56 place-items-center">
        <div
          aria-hidden="true"
          className="absolute h-48 w-48 rounded-full ease-in-out"
          style={{
            transform: `scale(${schaal})`,
            background: `hsl(var(${LOUNGE_VAR})/0.16)`,
            transition: "transform 1000ms ease-in-out",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute h-48 w-48 rounded-full border-2 ease-in-out"
          style={{
            transform: `scale(${schaal})`,
            borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`,
            transition: "transform 1000ms ease-in-out",
          }}
        />
        <div className="relative text-center">
          <p className="font-serif text-xl font-semibold text-foreground">
            {actief ? huidigeStp.label : "Klaar?"}
          </p>
          {actief && (
            <p className="mt-1 font-mono text-3xl tabular-nums" style={{ color: LOUNGE_KLEUR }}>
              {secOver}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActief((v) => !v)}
        data-testid="button-adem-start"
        className="mt-5 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition"
        style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
      >
        {actief ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {actief ? "Pauzeer" : "Begin met ademen"}
      </button>
    </div>
  );
}

// =============================================================================
// Meditatie audio speler (verbatim uit bundle: function aHe)
// =============================================================================
function MeditatieSPeler() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);
  const [tijd, setTijd] = useState(0);
  const [duur, setDuur] = useState(0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    speelt ? el.pause() : el.play();
  }

  function formatTijd(d: number) {
    if (!isFinite(d)) return "0:00";
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const voortgang = duur ? (tijd / duur) * 100 : 0;

  return (
    <div>
      <audio
        ref={audioRef}
        src="/lounge/audio/meditatie-stilte.mp3"
        loop
        preload="metadata"
        onPlay={() => setSpeelt(true)}
        onPause={() => setSpeelt(false)}
        onTimeUpdate={(e) => setTijd(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuur(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          data-testid="button-meditatie-muziek"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-background transition hover:scale-105"
          style={{ background: LOUNGE_KLEUR }}
          aria-label={speelt ? "Pauzeer de meditatieve klank" : "Speel de meditatieve klank"}
        >
          {speelt ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-serif text-sm font-semibold text-foreground">
              Klankschaal in C — zacht en eindeloos
            </p>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatTijd(tijd)} / {formatTijd(duur)}
            </p>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${voortgang}%`, background: LOUNGE_KLEUR }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Een warme drone die rustig blijft doorademen — zet hem zacht op de achtergrond.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Stilte Kamer (verbatim uit bundle: function sHe)
// =============================================================================
function StilteKamer() {
  const [oefening, setOefening] = useState(ADEM_OEFENINGEN[0]);
  const [meditatieTonen, setMeditatieTonen] = useState(false);

  return (
    <div>
      <SectieHeader
        eyebrow="Verstillen"
        titel="De Stilte Kamer"
        intro="Zachte tinten, gefilterd licht, een lage bank en een paar matjes op de vloer. De wereld dempt hier vanzelf. Niets moet — je mag mediteren, ademen, of gewoon even zijn."
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/stiltekamer.jpg"
          alt="De serene Stilte Kamer met linnen kussens en meditatiematjes."
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <KaartContainer>
          <Eyebrow>Adem mee</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">Een rustige ademhaling</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Kies een oefening en volg de cirkel. Laat de adem het tempo bepalen, niet andersom.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ADEM_OEFENINGEN.map((o) => {
              const actief = o.naam === oefening.naam;
              return (
                <button
                  key={o.naam}
                  type="button"
                  onClick={() => setOefening(o)}
                  data-testid={`adem-${o.naam}`}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={
                    actief
                      ? { color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.6)`, background: `hsl(var(${LOUNGE_VAR})/0.12)` }
                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                  }
                >
                  {o.naam}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">{oefening.omschrijving}</p>
          <div className="mt-5">
            <AdemhalingAnimatie oefening={oefening} />
          </div>
        </KaartContainer>
        <div className="space-y-4">
          <KaartContainer>
            <Eyebrow>Mediteren</Eyebrow>
            <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">Een begeleid moment</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{MEDITATIE.intro}</p>
            <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
              <MeditatieSPeler />
            </div>
            <button
              type="button"
              onClick={() => setMeditatieTonen((v) => !v)}
              data-testid="button-meditatie-open"
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
              style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
            >
              {meditatieTonen ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {meditatieTonen ? "Sluit de meditatie" : `Lees de meditatie — ${MEDITATIE.titel}`}
            </button>
            {meditatieTonen && (
              <div className="mt-4" data-testid="meditatie-stappen">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
                  {MEDITATIE.titel} · {MEDITATIE.duur}
                </p>
                <ol className="mt-3 space-y-3">
                  {MEDITATIE.stappen.map((stap, i) => (
                    <li key={stap.kop} className="rounded-xl border border-border bg-card/60 p-4">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs tabular-nums" style={{ color: LOUNGE_KLEUR }}>
                          {(i + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="font-serif text-base font-semibold text-foreground">{stap.kop}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stap.tekst}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </KaartContainer>
          <KaartContainer>
            <Eyebrow>Gewoon er zijn</Eyebrow>
            <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">Niets hoeft</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Soms is de mooiste oefening helemaal geen oefening. Blijf zitten zolang je wil. De Lounge wacht geduldig op je.
            </p>
          </KaartContainer>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Generieke "Kom terug" kamer (voor kamers die leden-login vereisen)
// Vervangt Y8e, J8e, eHe, tHe, Z8e (die eh() auth gebruiken)
// =============================================================================
function KamerKomTerug({ titel, eyebrow, intro, img, imgAlt }: {
  titel: string; eyebrow: string; intro: string; img?: string; imgAlt?: string;
}) {
  return (
    <div>
      <SectieHeader eyebrow={eyebrow} titel={titel} intro={intro} />
      {img && (
        <div className="mt-7 overflow-hidden rounded-2xl border border-border">
          <img src={img} alt={imgAlt || titel} className="h-60 w-full object-cover sm:h-72" loading="lazy" />
        </div>
      )}
      <div className="mt-8">
        <KaartContainer>
          <div className="flex flex-col items-center py-6 text-center">
            <LoungebBadge tekst="TaPasCity-leden" />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Deze kamer is open voor leden van TaPasCity. De deuren openen binnenkort voor wie een TIP-card draagt.
            </p>
          </div>
        </KaartContainer>
      </div>
    </div>
  );
}

// =============================================================================
// Muziek Kamer (verbatim uit bundle: function uHe)
// =============================================================================
const MUZIEK_COMPOSITIES = [
  {
    naam: "Erik Satie",
    context: "Stille, bijna mediterende pianominiaturen — rust als compositie.",
    composities: [
      { titel: "Gymnopédie No. 1",               beschrijving: "Een dromerige, sluimerende wals die de luisteraar meeneemt naar een tere, tijdloze stilte.",                                    url: "https://www.youtube.com/watch?v=q59H8q7Yo5Q" },
      { titel: "Gymnopédies (complete, No. 1–3)", beschrijving: "De drie Gymnopédies als eenheid: een zachte, melancholische triptiek die rust en mijmering oproept.",                         url: "https://www.youtube.com/watch?v=aIo66AGh2J8" },
      { titel: "Gnossienne No. 1",                beschrijving: "Een raadselachtig, schemerdragend stuk zonder maatstreep dat een mysterieuze, hypnotiserende sfeer oproept.",                  url: "https://www.youtube.com/watch?v=lqZehFAwoTM" },
      { titel: "Gnossienne No. 3",                beschrijving: "Speels en tegelijk weemoedig, met een onverwacht harmonisch kleurenpalet dat de geest tot stilstand brengt.",                  url: "https://www.youtube.com/watch?v=gQtE401LA_o" },
    ],
  },
];

const TAPAS_LIED_TEKST = [
  { kop: "Refrein", regels: ["I am on my way,","not yet where I want to be —","but no longer where I didn't fit.","I fall forward, I don't give up.","What I do as if it's nothing saves someone's day.","I am visible. I am on my way."] },
  { kop: "Vers 1",  regels: ["Stop a moment in the morning,","there's someone you don't know yet —","the person you could be today,","if you let them in.","Carry your doubts like a coat,","you're allowed to take it off when it grows heavy.","Beneath the lining breathes","a sentence that belongs only to you."] },
  { kop: "Brug",    regels: ["And when you stumble — fall forward.","Don't write off the evening, write only this:","I am on my way.","Your talent is already there.","It was waiting for you.","Make yourself visible —","for yourself first, then the world."] },
];

function MuziekKamer() {
  const [liedTonen, setLiedTonen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    speelt ? el.pause() : el.play();
  }

  return (
    <div>
      <SectieHeader
        eyebrow="Beluisteren"
        titel="De Muziek Kamer"
        intro="Klanken die de geest laten landen — van het TAPAS-lied tot zorgvuldig gekozen componisten. Zet het zacht op de achtergrond, of luister bewust."
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/muziek.jpg"
          alt="De Muziek Kamer met warme verlichting en een vleugelpiano."
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 space-y-6">
        <KaartContainer>
          <Eyebrow>Het TAPAS-lied</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">On My Way — Zichtbaar</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Een lied over talentherkenning, zichtbaar worden en vooruitvallen. Gecomponeerd als anthem voor TaPasCity.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <audio
              ref={audioRef}
              src="/lounge/audio/on-my-way.mp3"
              onPlay={() => setSpeelt(true)}
              onPause={() => setSpeelt(false)}
            />
            <button
              type="button"
              onClick={toggle}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-background transition hover:scale-105"
              style={{ background: LOUNGE_KLEUR }}
              aria-label={speelt ? "Pauzeer" : "Speel On My Way"}
            >
              {speelt ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div>
              <p className="font-serif text-sm font-semibold text-foreground">On My Way</p>
              <p className="text-[11px] text-muted-foreground">TaPasCity · Zichtbaar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLiedTonen((v) => !v)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium transition"
            style={{ color: LOUNGE_KLEUR }}
          >
            {liedTonen ? "Verberg de liedtekst" : "Lees de liedtekst"}
            <ArrowRight className="h-4 w-4" />
          </button>
          {liedTonen && (
            <div className="mt-4 space-y-4">
              {TAPAS_LIED_TEKST.map((sectie) => (
                <div key={sectie.kop} className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
                    {sectie.kop}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {sectie.regels.map((r, i) => (
                      <p key={i} className="text-sm italic leading-relaxed text-foreground">{r}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KaartContainer>
        {MUZIEK_COMPOSITIES.map((componist) => (
          <KaartContainer key={componist.naam}>
            <Eyebrow>{componist.naam}</Eyebrow>
            <p className="mt-1 text-sm text-muted-foreground">{componist.context}</p>
            <div className="mt-4 space-y-3">
              {componist.composities.map((c) => (
                <a
                  key={c.titel}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-xl border border-border p-4 transition hover:border-[--lounge] hover:bg-card/80"
                >
                  <div
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                    style={{ background: `hsl(var(${LOUNGE_VAR})/0.14)`, color: LOUNGE_KLEUR }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-serif text-sm font-semibold text-foreground">{c.titel}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.beschrijving}</p>
                  </div>
                </a>
              ))}
            </div>
          </KaartContainer>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Webshop (verbatim uit bundle: function dHe — geïntegreerd met interesse form)
// =============================================================================
const WEBSHOP_PRODUCTEN = [
  {
    id: "tapas-business-kompas",
    naam: "T4P Business Kompas",
    prijs: "€ 249 per afname",
    beschrijving: "Volledig talentprofiel met TaPas Kompas en optionele Coachatlas. Inclusief online afname en PDF-rapport.",
    features: ["Individueel talentprofiel", "TaPas Kompas rapport", "Online afname & scoring", "PDF-rapport"],
  },
  {
    id: "amelia-earhart",
    naam: "Amelia Earhart Editie",
    prijs: "€ 349 per afname",
    premium: true,
    beschrijving: "Het meest complete TaPas-profiel. Combineert T4P Business Kompas, T4Recruitment en 2MinScan in één traject.",
    features: ["TaPas Kompas + Coachatlas", "T4Recruitment module", "2MinScan energieprofiel", "Persoonlijke debriefing", "Amelia Earhart certificaat", "Premium PDF-rapport", "Toegang tot het Observatorium", "Priority support"],
  },
  {
    id: "t4recruitment",
    naam: "T4Recruitment",
    prijs: "€ 179 per afname",
    beschrijving: "Rolprofiel en fit-analyse voor werving & selectie. Vergelijk kandidaten op talentniveau.",
    features: ["Rolprofiel analyse", "Kandidaat fit-score", "Vergelijkingsrapport", "Recruiters dashboard"],
  },
  {
    id: "teamscan",
    naam: "TaPas Teamscan",
    prijs: "Op aanvraag",
    beschrijving: "Breng de talenten en dynamieken van je team in kaart. Inclusief teamrapport en facilitatiegids.",
    features: ["Team talentoverzicht", "Teamdynamiek analyse", "Facilitatiegids", "Groepsrapport"],
  },
];

function Webshop() {
  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [uitgevouwen, setUitgevouwen] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [bericht, setBericht] = useState("");
  const [verzondenOk, setVerzondenOk] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (!geselecteerd || !naam || !email) return;
    setBezig(true);
    setFout("");
    try {
      const res = await fetch("/api/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam, email, product: geselecteerd, bericht }),
      });
      if (res.ok) {
        setVerzondenOk(true);
      } else {
        setFout("Er ging iets mis. Probeer het later opnieuw.");
      }
    } catch {
      setFout("Er ging iets mis. Probeer het later opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div>
      <SectieHeader
        eyebrow="Meenemen"
        titel="De Webshop"
        intro="Instrumenten, rapporten en licenties voor coaches, HR-professionals en organisaties die met talent willen werken."
      />
      <div className="mt-7 overflow-hidden rounded-2xl border border-border">
        <img
          src="/lounge/img/webshop.jpg"
          alt="De TaPas Webshop."
          className="h-60 w-full object-cover sm:h-72"
          loading="lazy"
        />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {WEBSHOP_PRODUCTEN.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border border-t-[3px] p-5 transition ${geselecteerd === p.id ? "ring-2" : ""} ${p.premium ? "ring-1 ring-yellow-400/20" : ""}`}
            style={{
              borderTopColor: LOUNGE_KLEUR,
              background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.10) 0%, hsl(var(--card)) 60%)`,
            }}
          >
            {p.premium && (
              <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-yellow-400">
                Premium
              </span>
            )}
            <h3 className="font-serif text-lg font-semibold text-foreground">{p.naam}</h3>
            <p className="mt-0.5 font-mono text-sm" style={{ color: LOUNGE_KLEUR }}>{p.prijs}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.beschrijving}</p>
            <button
              type="button"
              onClick={() => setUitgevouwen(uitgevouwen === p.id ? null : p.id)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium transition"
              style={{ color: LOUNGE_KLEUR }}
            >
              {uitgevouwen === p.id ? "Verberg details" : "Bekijk details"}
              <ArrowRight className="h-3 w-3" />
            </button>
            {uitgevouwen === p.id && (
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span style={{ color: LOUNGE_KLEUR }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setGeselecteerd(p.id)}
              className="mt-4 w-full rounded-xl border py-2 text-sm font-semibold transition hover:-translate-y-0.5"
              style={
                geselecteerd === p.id
                  ? { color: "hsl(var(--background))", background: LOUNGE_KLEUR, borderColor: LOUNGE_KLEUR }
                  : { color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.08)` }
              }
            >
              {geselecteerd === p.id ? "Geselecteerd ✓" : "Interesse tonen"}
            </button>
          </div>
        ))}
      </div>
      {geselecteerd && !verzondenOk && (
        <KaartContainer className="mt-8">
          <Eyebrow>Interesse registreren</Eyebrow>
          <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">Laat je gegevens achter</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We nemen contact op met meer informatie over{" "}
            <strong>{WEBSHOP_PRODUCTEN.find((p) => p.id === geselecteerd)?.naam}</strong>.
          </p>
          <form onSubmit={verstuur} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Naam</label>
                <input
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  required
                  placeholder="Jouw naam"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                  style={{ focusBorderColor: LOUNGE_KLEUR } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="jij@voorbeeld.be"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Bericht (optioneel)</label>
              <textarea
                value={bericht}
                onChange={(e) => setBericht(e.target.value)}
                rows={3}
                placeholder="Vertel ons meer over je situatie of vraag..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 resize-none"
              />
            </div>
            {fout && <p className="text-xs text-red-500">{fout}</p>}
            <button
              type="submit"
              disabled={bezig}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-background transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: LOUNGE_KLEUR }}
            >
              {bezig ? "Versturen..." : "Verstuur interesse"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </KaartContainer>
      )}
      {verzondenOk && (
        <KaartContainer className="mt-8">
          <div className="flex flex-col items-center py-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: LOUNGE_KLEUR }}>
              Ontvangen
            </p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">Bedankt voor je interesse!</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              We nemen zo snel mogelijk contact met je op.
            </p>
          </div>
        </KaartContainer>
      )}
    </div>
  );
}

// =============================================================================
// Aanwezigen sectie (verbatim uit bundle: function AHe)
// Vereenvoudigd voor demo — geen live member data
// =============================================================================
function AanwezigenSectie() {
  return (
    <div className="mt-5">
      <button
        type="button"
        data-testid="button-entry-lounge"
        className="group relative block w-full overflow-hidden rounded-2xl border border-dashed p-6 text-left transition hover:-translate-y-0.5"
        style={{
          borderColor: `hsl(var(${LOUNGE_VAR})/0.55)`,
          background: `radial-gradient(120% 140% at 50% 0%, hsl(var(${LOUNGE_VAR})/0.14) 0%, hsl(var(--card)) 70%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <LoungebBadge tekst="TaPasCity Live" />
          <p className="text-sm text-muted-foreground">
            De Lounge is open. Leden zijn actief aanwezig.
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Word lid van TaPasCity om deel te nemen aan live sessies, de Talentencafé-gesprekken en de gemeenschap.
        </p>
      </button>
    </div>
  );
}

// =============================================================================
// Radio knop (behouden uit vorige versie)
// =============================================================================
function RadioKnop() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);
  const [streamIdx, setStreamIdx] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = RADIO_STREAMS[streamIdx];
    audio.play().catch(() => {});
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (speelt) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        const next = (streamIdx + 1) % RADIO_STREAMS.length;
        setStreamIdx(next);
        audio.src = RADIO_STREAMS[next];
        audio.play().catch(() => {});
      });
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setSpeelt(true)}
        onPause={() => setSpeelt(false)}
        onError={() => {
          const next = (streamIdx + 1) % RADIO_STREAMS.length;
          setStreamIdx(next);
          const audio = audioRef.current;
          if (audio) { audio.src = RADIO_STREAMS[next]; audio.play().catch(() => {}); }
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={speelt ? "Stop lounge radio" : "Speel lounge radio"}
        title={speelt ? "Radio stoppen" : "Lounge radio"}
        className="grid h-8 w-8 place-items-center rounded-full border transition hover:scale-105"
        style={
          speelt
            ? { background: LOUNGE_KLEUR, color: "hsl(var(--background))", borderColor: LOUNGE_KLEUR }
            : { borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, color: LOUNGE_KLEUR, background: `hsl(var(${LOUNGE_VAR})/0.10)` }
        }
      >
        <Radio className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

// =============================================================================
// Onthaal — hero + kamer grid (verbatim uit bundle: function rHe)
// =============================================================================
function Onthaal({ gaaNaar }: { gaaNaar: (id: string) => void }) {
  return (
    <div>
      {/* Hero sectie — verbatim uit rHe */}
      <section className="relative overflow-hidden rounded-3xl border border-border">
        <img
          src="/lounge/img/onthaal.jpg"
          alt="Het zuiderse onthaal van de TAPAS Lounge bij gouden licht."
          className="h-[44vh] min-h-[280px] w-full object-cover sm:h-[56vh]"
          loading="eager"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--background)/0.10) 0%, hsl(var(--background)/0.30) 45%, hsl(var(--background)/0.92) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <Eyebrow>Welkom in de Lounge</Eyebrow>
          <h1 className="mt-3 max-w-2xl font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
            Hier ontmoeten de mensen achter de werelden elkaar.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Geen titels, geen diploma's, geen rollen — alleen mensen die vanuit hun talent willen bijdragen aan een betere wereld. Adem even uit. Je bent aangekomen.
          </p>
        </div>
      </section>

      {/* Keuze sectie — verbatim uit rHe */}
      <section className="mt-10 text-center">
        <Eyebrow>De keuze</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-xl font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Wil je verstillen, of anderen ontmoeten?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Beide horen hier thuis. Kies een kamer — je kunt altijd rustig verder dwalen naar een andere.
        </p>
      </section>

      {/* Kamer grid — verbatim uit rHe */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KAMERS.map((kamer) => {
          const Icon = kamer.icon;
          return (
            <button
              key={kamer.id}
              type="button"
              onClick={() => gaaNaar(kamer.id)}
              data-testid={`kamer-${kamer.id}`}
              className="group relative block overflow-hidden rounded-2xl border border-t-[3px] border-border p-6 text-left transition hover:-translate-y-1"
              style={{
                borderTopColor: LOUNGE_KLEUR,
                background: `radial-gradient(120% 95% at 100% 0%, hsl(var(${LOUNGE_VAR})/0.12) 0%, hsl(var(--card)) 62%)`,
              }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: `hsl(var(${LOUNGE_VAR})/0.16)`, color: LOUNGE_KLEUR }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: LOUNGE_KLEUR }}>
                {kamer.eyebrow}
              </p>
              <h3 className="mt-1.5 font-serif text-xl font-semibold text-foreground">{kamer.naam}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{kamer.korte}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: LOUNGE_KLEUR }}>
                Ga naar binnen
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

// =============================================================================
// Hoofd Lounge component (verbatim uit bundle: function pHe)
// =============================================================================
function LoungePagina() {
  const [, navigeer] = useLocation();
  const [actieveKamer, setActieveKamer] = useState("onthaal");
  const topRef = useRef<HTMLDivElement>(null);

  // Scroll naar boven bij kamer wissel (verbatim uit bundle: useEffect in pHe)
  useEffect(() => {
    const scrollNaarBoven = () => {
      window.scrollTo(0, 0);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollNaarBoven();
    const raf = window.requestAnimationFrame(() => { scrollNaarBoven(); window.requestAnimationFrame(scrollNaarBoven); });
    const t1 = window.setTimeout(scrollNaarBoven, 60);
    const t2 = window.setTimeout(scrollNaarBoven, 180);
    return () => { window.cancelAnimationFrame(raf); window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [actieveKamer]);

  function gaaNaar(id: string) { setActieveKamer(id); }

  // Render actieve kamer inhoud
  function renderKamer() {
    switch (actieveKamer) {
      case "stilte":        return <StilteKamer />;
      case "muziek":        return <MuziekKamer />;
      case "webshop":       return <Webshop />;
      case "studie":        return <KamerKomTerug titel="De Studie Kamer"    eyebrow="Verdiepen"  intro="Bibliotheek, podcasts en de Meeting-Room. Binnenkort beschikbaar voor leden."   img="/lounge/img/studiekamer.jpg"    imgAlt="De Studie Kamer" />;
      case "talentencafe":  return <KamerKomTerug titel="Het Talentencafé"   eyebrow="Ontmoeten"  intro="Gesprekken aan thematische tafels. Binnenkort beschikbaar voor leden."           img="/lounge/img/talentencafe.jpg"   imgAlt="Het Talentencafé" />;
      case "inspiratiewand":return <KamerKomTerug titel="De Inspiratiewand"  eyebrow="Herkennen"  intro="Talentportretten van leden, opt-in. Binnenkort beschikbaar voor leden."          img="/lounge/img/inspiratiewand.jpg" imgAlt="De Inspiratiewand" />;
      case "werkplaats":    return <KamerKomTerug titel="De Werkplaats"      eyebrow="Co-creëren" intro="Schrijven en creatieve expressie samen. Binnenkort beschikbaar voor leden."      img="/lounge/img/werkplaats.jpg"     imgAlt="De Werkplaats" />;
      case "reflectie":     return <KamerKomTerug titel="De Reflectiekamer"  eyebrow="Bezinnen"   intro="Een strikt privé groeidagboek. Binnenkort beschikbaar voor leden."               img="/lounge/img/reflectie.jpg"      imgAlt="De Reflectiekamer" />;
      case "terras":        return <KamerKomTerug titel="Het Buitenterras"   eyebrow="Samenkomen" intro="Live sessies en seizoensmomenten. Binnenkort beschikbaar voor leden."            />;
      default:              return <><Onthaal gaaNaar={gaaNaar} /><AanwezigenSectie /></>;
    }
  }

  return (
    <div className="lounge-pagina min-h-[100dvh] bg-background">
      {/* AppHeader — verbatim: a.jsx(St,{}) */}
      <AppHeader right={<RadioKnop />} />

      <main className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Achtergrond glow — verbatim uit pHe */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80"
          style={{ background: `radial-gradient(70% 100% at 50% -10%, hsl(var(${LOUNGE_VAR})/0.12) 0%, transparent 70%)` }}
        />

        <div ref={topRef} />

        {/* Breadcrumb — verbatim uit pHe */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ background: `hsl(var(${LOUNGE_VAR})/0.14)`, color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.4)` }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            TAPAS Lounge
          </span>
          {actieveKamer !== "onthaal" && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium text-foreground">{KAMER_NAMEN[actieveKamer]}</span>
            </>
          )}
        </div>

        {/* Terugknop — verbatim uit pHe */}
        <div className="mt-4">
          {actieveKamer === "onthaal" ? (
            <button
              type="button"
              onClick={() => navigeer("/")}
              data-testid="link-terug-voordeur"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar de voordeur
            </button>
          ) : (
            <button
              type="button"
              onClick={() => gaaNaar("onthaal")}
              data-testid="link-terug-onthaal"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar het onthaal
            </button>
          )}
        </div>

        {/* Kamer inhoud */}
        <div className="mt-6">{renderKamer()}</div>

        {/* Navigatie naar andere kamers (onder in kamer) — verbatim uit pHe */}
        {actieveKamer !== "onthaal" && (
          <nav className="mt-14 border-t border-border pt-6" aria-label="Andere kamers">
            <button
              type="button"
              onClick={() => gaaNaar("onthaal")}
              data-testid="link-terug-onthaal-onder"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
              style={{ color: LOUNGE_KLEUR, borderColor: `hsl(var(${LOUNGE_VAR})/0.5)`, background: `hsl(var(${LOUNGE_VAR})/0.10)` }}
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar het onthaal
            </button>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Of dwaal verder
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {KAMERS.filter((k) => k.id !== actieveKamer).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => gaaNaar(k.id)}
                  data-testid={`spring-${k.id}`}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {k.naam}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Footer — verbatim uit pHe */}
        <footer className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            TAPAS Lounge · de ontmoetingsplek boven de twee werelden · met aandacht, zonder oordeel
          </p>
        </footer>
      </main>
    </div>
  );
}

// mHe wrapper — verbatim uit bundle
export default function Lounge() {
  return <LoungePagina />;
}
