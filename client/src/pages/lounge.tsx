// =============================================================================
// lounge.tsx — EXACT overgenomen uit tapas-lounge-zip bundle (index-C3zZTrQ1.js)
// Geen interpretaties. Alle data-arrays, classNames, structuur en tekst zijn verbatim.
//
// Icon mapping (qe factory → lucide):
//   Kj=Leaf, Lj=BookOpen, qj=Music2, Wj=ShoppingBag, Pj=Coffee
//   tv=Lightbulb, Xj=Wrench, Vj=PenLine, yQ=Sunset, wo=Star
//   ug=ArrowLeft, Jh=ChevronRight, Oj=Heart, nv=MessageCircle
//   Zw=Clock, iQ=GraduationCap, oQ=Headphones, _u=Users, xs=Sparkles
//   En=Badge, ht=Card, pt=CardContent, Kg=Separator
// =============================================================================

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Leaf,
  BookOpen,
  Music2,
  ShoppingBag,
  Coffee,
  Lightbulb,
  Wrench,
  PenLine,
  Sunset,
  Star,
  ArrowLeft,
  ChevronRight,
  Radio,
  Heart,
  MessageCircle,
  Clock,
  GraduationCap,
  Headphones,
  Users,
  Sparkles,
} from "lucide-react";

// =============================================================================
// p1 — kamers data array (verbatim)
// =============================================================================
const kamers = [
  {
    id: "stilte",
    naam: "Stilte Kamer",
    ondertitel: "Rust · Verdieping · Aanwezig zijn",
    icon: Leaf,
    kleur: "text-emerald-600 dark:text-emerald-400",
    beschrijving:
      "Een stille ruimte voor bezinning. Geen notificaties, geen ruis — alleen jij en wat écht telt.",
  },
  {
    id: "studie",
    naam: "Studie Kamer",
    ondertitel: "Lezen · Leren · Groeien",
    icon: BookOpen,
    kleur: "text-blue-600 dark:text-blue-400",
    beschrijving:
      "Artikelen, inzichten en aanbevolen lectuur door de TaPas-community. Bouw je bibliotheek op.",
    badge: "Nieuw",
  },
  {
    id: "muziek",
    naam: "Muziek Kamer",
    ondertitel: "Klanken · Inspiratie · Concentratie",
    icon: Music2,
    kleur: "text-purple-600 dark:text-purple-400",
    beschrijving:
      "Negen componisten, vijf geselecteerde opnames elk. Luister terwijl je werkt, nadenkt of herstelt.",
  },
  {
    id: "webshop",
    naam: "Webshop",
    ondertitel: "Instruments · Rapporten · Licenties",
    icon: ShoppingBag,
    kleur: "text-amber-600 dark:text-amber-400",
    beschrijving:
      "Bestel TaPas-instruments, rapporten en coachinglicenties rechtstreeks via het platform.",
    badge: "Binnenkort",
  },
  {
    id: "cafe",
    naam: "Talentencafé",
    ondertitel: "Gesprekken · Ontmoetingen · Inspiratie",
    icon: Coffee,
    kleur: "text-orange-600 dark:text-orange-400",
    beschrijving:
      "De informele ontmoetingsplaats van de community. Deel inzichten, stel vragen, vertel je verhaal.",
  },
  {
    id: "inspiratie",
    naam: "Inspiratiewand",
    ondertitel: "Quotes · Beelden · Verhalen",
    icon: Lightbulb,
    kleur: "text-yellow-600 dark:text-yellow-400",
    beschrijving:
      "Curated inspiratie van coaches, deelnemers en denkers. Voed je verbeelding en deel wat jou raakt.",
  },
  {
    id: "werkplaats",
    naam: "Werkplaats",
    ondertitel: "Projecten · Samenwerking · Creatie",
    icon: Wrench,
    kleur: "text-slate-600 dark:text-slate-400",
    beschrijving:
      "Start een project, zoek collaborators of deel je werk in wording. De plek voor makers.",
  },
  {
    id: "reflectie",
    naam: "Reflectiekamer",
    ondertitel: "Dagboek · Groei · Inzicht",
    icon: PenLine,
    kleur: "text-rose-600 dark:text-rose-400",
    beschrijving:
      "Jouw persoonlijk dagboek — privé en versleuteld. Schrijf, reflecteer, groei. Niemand leest mee.",
  },
  {
    id: "terras",
    naam: "Buitenterras",
    ondertitel: "Events · Community · Agenda",
    icon: Sunset,
    kleur: "text-sky-600 dark:text-sky-400",
    beschrijving:
      "Aankomende events, webinars en live sessions van TaPasCity. RSVP en ontmoet anderen.",
    badge: "Nieuw",
  },
];

// =============================================================================
// XZ — cafe bijdragen data (verbatim)
// =============================================================================
const cafeBijdragen = [
  {
    auteur: "Hanne V.",
    avatar: "HV",
    tijd: "2u geleden",
    tekst:
      "Net mijn TaPas Kompas ontvangen — de combinatie van mijn drie foci klopt verrassend goed. De Werkplaats springt er voor mij echt uit.",
    likes: 7,
    reacties: 3,
    tags: ["Kompas", "Inzicht"],
  },
  {
    auteur: "Dirk M.",
    avatar: "DM",
    tijd: "gisteren",
    tekst:
      "Vraag aan de community: hoe combineren jullie een hoge Verbinders-focus met een analytische rol? Ik zoek concrete voorbeelden.",
    likes: 12,
    reacties: 8,
    tags: ["Vraag", "Verbinders"],
  },
  {
    auteur: "Sofie L.",
    avatar: "SL",
    tijd: "3 dagen geleden",
    tekst:
      "Onze teamcoaching met de Teamscan was een eye-opener. Dacht dat we allemaal dezelfde drijfveren hadden — totaal niet. Wat een gesprekken!",
    likes: 24,
    reacties: 11,
    tags: ["Teamscan", "Coaching"],
  },
];

// =============================================================================
// JZ — inspiratiewand items (verbatim)
// =============================================================================
const inspiratieItems = [
  {
    type: "quote",
    inhoud: "Talent zonder richting is als een kompas in een zak.",
    bron: "Marc Debisschop",
    context: "TaPas Manifest",
    kleur: "border-l-amber-400",
  },
  {
    type: "inzicht",
    inhoud:
      "Mensen presteren niet beter door te weten wat ze slecht doen. Ze groeien door te weten waar hun energie vandaan komt.",
    bron: "Uit de TaPas-methodologie",
    context: "Energiemanagement",
    kleur: "border-l-emerald-400",
  },
  {
    type: "quote",
    inhoud: "Je talenten zijn geen toeval. Ze zijn de architectuur van wie je bent.",
    bron: "TaPasCity",
    context: "Profielintroductie",
    kleur: "border-l-purple-400",
  },
  {
    type: "tip",
    inhoud:
      "Tip voor coaches: begin een gesprek niet met 'wat wil je bereiken?' maar met 'wanneer vloog je vorige week?'",
    bron: "Coaches Gids TaPas",
    context: "Praktijk",
    kleur: "border-l-blue-400",
  },
];

// =============================================================================
// YZ — werkplaats projecten (verbatim)
// =============================================================================
const werkplaatsProjecten = [
  {
    titel: "Talent-intro voor HR-managers",
    beschrijving:
      "Een toegankelijke onboardingmodule die HR-professionals wegwijs maakt in talentprofielen — zonder jargon.",
    leden: ["SL", "HV", "TK"],
    status: "Actief",
    statusKleur:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    tags: ["HR", "Onboarding"],
  },
  {
    titel: "Visuele talentkaarten",
    beschrijving:
      "Gedrukte en digitale kaarten per talentfocus — als gesprekstrigger in teamworkshops.",
    leden: ["DM", "AV"],
    status: "Zoekt co-creators",
    statusKleur:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    tags: ["Design", "Workshop"],
  },
];

// =============================================================================
// ZZ — terras events (verbatim)
// =============================================================================
const terrasEvents = [
  {
    datum: "3 jul 2026",
    dag: "do",
    titel: "TaPas Live: Hoe lees je een Kompas-rapport?",
    type: "Webinar",
    tijdstip: "12:00–13:00",
    plaatsen: 18,
    max: 25,
    beschrijving:
      "Samen een volledig Kompas-rapport doorlopen: wat zie je, wat gebruik je in een coachgesprek en wat laat je achterwege?",
  },
  {
    datum: "17 jul 2026",
    dag: "do",
    titel: "Open Atelier: Teamdynamieken met de Teamscan",
    type: "Workshop",
    tijdstip: "14:00–16:30",
    plaatsen: 6,
    max: 12,
    beschrijving:
      "Hands-on: jij brengt een casus, we werken live met de Teamscan-data. Kleine groep, intensief.",
  },
  {
    datum: "7 aug 2026",
    dag: "vr",
    titel: "TaPas Zomercafé",
    type: "Ontmoeting",
    tijdstip: "16:00–18:00",
    plaatsen: 30,
    max: 40,
    beschrijving:
      "Informele afsluiting voor de zomer. Reflecties, plannen en een goed gesprek — live of online.",
  },
];

// =============================================================================
// E4 — studie kamer bibliotheek (verbatim)
// =============================================================================
const bibliotheekItems = [
  {
    titel: "Wat zijn talentfoci precies?",
    type: "Artikel",
    duur: "6 min",
    auteur: "TaPasCity Redactie",
    tags: ["Fundamenten"],
    beschrijving:
      "Een heldere introductie op de talentfoci-systematiek: waarom ze werken en hoe je ze leest.",
  },
  {
    titel: "Energie als kompas voor loopbaan",
    type: "Longread",
    duur: "14 min",
    auteur: "Marc Debisschop",
    tags: ["Energie", "Loopbaan"],
    beschrijving:
      "Waarom energiemanagement minstens even belangrijk is als competentieontwikkeling — met praktijkvoorbeelden.",
  },
  {
    titel: "De kracht van de 2MinScan in een selectiegesprek",
    type: "Artikel",
    duur: "8 min",
    auteur: "Hanne V.",
    tags: ["2MinScan", "Recruitment"],
    beschrijving:
      "Hoe HR-professionals de 2MinScan inzetten om snel een energetisch profiel op te bouwen — ethisch en doelgericht.",
  },
  {
    titel: "Podcast: Talent herkennen bij jongeren",
    type: "Podcast",
    duur: "42 min",
    auteur: "T4Students Team",
    tags: ["T4Students", "Jongeren"],
    beschrijving:
      "Gesprek met een CLB-begeleider en een gymnasiumcoach over hoe je talentsignalen herkent in schoolcontext.",
  },
];

// =============================================================================
// eee — muziek componisten (verbatim, 9 componisten)
// =============================================================================
const componisten = [
  {
    naam: "Johann Sebastian Bach",
    periode: "Barok",
    beschrijving: "Architecturale precisie, mathematische schoonheid.",
    werken: [
      { titel: "Cello Suite No. 1 in G major", url: "https://www.youtube.com/watch?v=mGQLXRTl3Z0" },
      { titel: "Goldberg Variations (Glenn Gould, 1981)", url: "https://www.youtube.com/watch?v=Ah392lnFHxM" },
      { titel: "Air on the G String", url: "https://www.youtube.com/watch?v=GMkmQlfOJDk" },
      { titel: "Prelude in C major (WTC I)", url: "https://www.youtube.com/watch?v=frxT2qB1POQ" },
      { titel: "Brandenburg Concerto No. 3", url: "https://www.youtube.com/watch?v=pdbO-H3CYxI" },
    ],
  },
  {
    naam: "Ludovico Einaudi",
    periode: "Hedendaags",
    beschrijving: "Minimalistische pianomuziek voor focus en rust.",
    werken: [
      { titel: "Experience", url: "https://www.youtube.com/watch?v=hN_q-_nGv4U" },
      { titel: "Nuvole Bianche", url: "https://www.youtube.com/watch?v=odzM75v9jAg" },
      { titel: "Una Mattina", url: "https://www.youtube.com/watch?v=EHTE5PznMGg" },
      { titel: "Fly", url: "https://www.youtube.com/watch?v=ZBQQNzTBg1s" },
      { titel: "Divenire", url: "https://www.youtube.com/watch?v=Tol2bhKNqxY" },
    ],
  },
  {
    naam: "Arvo Pärt",
    periode: "Contemplatief",
    beschrijving: "Tintinnabuli-stijl — klinkt als stilte die spreekt.",
    werken: [
      { titel: "Spiegel im Spiegel", url: "https://www.youtube.com/watch?v=TJ6Mzvh3XCc" },
      { titel: "Für Alina", url: "https://www.youtube.com/watch?v=Pyh_ISIAZ3w" },
      { titel: "Fratres", url: "https://www.youtube.com/watch?v=WIYzz5ZwlCc" },
      { titel: "Tabula Rasa", url: "https://www.youtube.com/watch?v=1lMXMNBKiXQ" },
      { titel: "Cantus in Memoriam Benjamin Britten", url: "https://www.youtube.com/watch?v=_niVeK71I-A" },
    ],
  },
  {
    naam: "Erik Satie",
    periode: "Impressionisme",
    beschrijving: "Licht, ironisch en prachtig eenvoudig.",
    werken: [
      { titel: "Gymnopédie No. 1", url: "https://www.youtube.com/watch?v=S-Xm7s9eGxU" },
      { titel: "Gymnopédie No. 3", url: "https://www.youtube.com/watch?v=xBFmJiXvxJo" },
      { titel: "Gnossiennes No. 1", url: "https://www.youtube.com/watch?v=5bIVBbpFvk4" },
      { titel: "Je te veux", url: "https://www.youtube.com/watch?v=2OQyBHBuuI8" },
      { titel: "Trois Gymnopédies (complete)", url: "https://www.youtube.com/watch?v=f6CbbRz-UEA" },
    ],
  },
  {
    naam: "Frédéric Chopin",
    periode: "Romantiek",
    beschrijving: "Expressiviteit en techniek in perfecte balans.",
    werken: [
      { titel: "Nocturne Op. 9 No. 2", url: "https://www.youtube.com/watch?v=9E6b3swbnWg" },
      { titel: "Ballade No. 1 in G minor", url: "https://www.youtube.com/watch?v=VmFmAvOMASA" },
      { titel: "Étude Op. 10 No. 3 (Tristesse)", url: "https://www.youtube.com/watch?v=XeX4X_1_lo0" },
      { titel: "Prelude Op. 28 No. 15 (Raindrop)", url: "https://www.youtube.com/watch?v=XeX4X_1_lo0" },
      { titel: "Fantaisie Impromptu", url: "https://www.youtube.com/watch?v=tvm2ZsRv3C8" },
    ],
  },
  {
    naam: "Claude Debussy",
    periode: "Impressionisme",
    beschrijving: "Kleur als taal — muziek die schildert.",
    werken: [
      { titel: "Clair de Lune", url: "https://www.youtube.com/watch?v=CvFH_6DNRCY" },
      { titel: "La Mer", url: "https://www.youtube.com/watch?v=hBQGhHDdvl0" },
      { titel: "Prélude à l'après-midi d'un faune", url: "https://www.youtube.com/watch?v=WFkEwBHGZYk" },
      { titel: "Suite bergamasque", url: "https://www.youtube.com/watch?v=yhAFbKYxJFM" },
      { titel: "Children's Corner: Golliwog's Cakewalk", url: "https://www.youtube.com/watch?v=5xnVgB-LFIY" },
    ],
  },
  {
    naam: "Max Richter",
    periode: "Post-minimaal",
    beschrijving: "Filmische diepgang voor werk en herstel.",
    werken: [
      { titel: "On the Nature of Daylight", url: "https://www.youtube.com/watch?v=rVN1B-tUpgs" },
      { titel: "Sleep — Fragment", url: "https://www.youtube.com/watch?v=QJNSIxR6Fqo" },
      { titel: "Recomposed: Vivaldi Spring 1", url: "https://www.youtube.com/watch?v=iHCn3NxpkbE" },
      { titel: "Infra 3", url: "https://www.youtube.com/watch?v=4IYbnXdUSHk" },
      { titel: "November", url: "https://www.youtube.com/watch?v=_tqMfAULfE4" },
    ],
  },
  {
    naam: "Ólafur Arnalds",
    periode: "Neo-klassiek",
    beschrijving: "Elektronica en strijkers — ruimte en beweging.",
    werken: [
      { titel: "Near Light", url: "https://www.youtube.com/watch?v=D6dNe-_vY2E" },
      { titel: "Near Light (Island Songs)", url: "https://www.youtube.com/watch?v=D6dNe-_vY2E" },
      { titel: "We Contains Multitudes", url: "https://www.youtube.com/watch?v=bFININJ5QTc" },
      { titel: "Doria", url: "https://www.youtube.com/watch?v=Ym6FYCEeNtw" },
      { titel: "Tomorrow's Song", url: "https://www.youtube.com/watch?v=sHKhEzG4iZU" },
    ],
  },
  {
    naam: "Johann Johannsson",
    periode: "Filmmuziek",
    beschrijving: "Atmosferisch en architecturaal — focus zonder afleiding.",
    werken: [
      { titel: "The Sun's Gone Dim", url: "https://www.youtube.com/watch?v=7tHq7GgmPok" },
      { titel: "Arrival OST: Heptapod B", url: "https://www.youtube.com/watch?v=_iL-B9zb5XE" },
      { titel: "Sicario: The Beast", url: "https://www.youtube.com/watch?v=NLw83XTFUHE" },
      { titel: "Theory of Everything OST", url: "https://www.youtube.com/watch?v=GlDIuSN7B10" },
      { titel: "End of Summer", url: "https://www.youtube.com/watch?v=sFJRFkzGZ8I" },
    ],
  },
];

// =============================================================================
// qg — Avatar component (verbatim)
// =============================================================================
function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className={`${cls} flex items-center justify-center rounded-full bg-accent/15 font-semibold text-accent shrink-0`}>
      {initials}
    </div>
  );
}

// =============================================================================
// tee — KamerKaart component (verbatim)
// =============================================================================
function KamerKaart({
  kamer,
  onOpen,
}: {
  kamer: (typeof kamers)[0];
  onOpen: () => void;
}) {
  const Icon = kamer.icon;
  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent/40"
      onClick={onOpen}
      data-testid={`kamer-${kamer.id}`}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-accent/8 ${kamer.kleur}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5">
            {kamer.badge && (
              <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">
                {kamer.badge}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{kamer.naam}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{kamer.ondertitel}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {kamer.beschrijving}
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// nee — Stilte Kamer content (verbatim)
// =============================================================================
function SilteKamerContent() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
        <Leaf className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-foreground">Welkom in de Stilte Kamer</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Adem in. Adem uit. Er is niets te doen hier — alleen zijn.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground/70 italic">
          &ldquo;Stilte is niet de afwezigheid van geluid, maar de aanwezigheid van jezelf.&rdquo;
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-3">
        {["Wees aanwezig", "Laat gedachten passeren", "Kom terug als het klopt"].map((e, t) => (
          <div
            key={t}
            className="flex items-center gap-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <span className="text-base">{["🌿", "🌊", "✦"][t]}</span>
            {e}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ree — Studie Kamer content (verbatim)
// =============================================================================
function StudieKamerContent() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bibliotheek</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Artikelen, longreads en podcasts van de TaPas-community
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {bibliotheekItems.length} items
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {bibliotheekItems.map((e, t) => (
          <Card
            key={t}
            className="group hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
          >
            <CardContent className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {e.type === "Podcast" ? (
                    <Headphones className="h-4 w-4 text-purple-500 shrink-0" />
                  ) : e.type === "Longread" ? (
                    <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-blue-400 shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">{e.type}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {e.duur}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">{e.titel}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {e.beschrijving}
              </p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex gap-1 flex-wrap">
                  {e.tags.map((n) => (
                    <Badge key={n} variant="secondary" className="text-xs px-1.5 py-0">
                      {n}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground/60">{e.auteur}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-4 text-center text-sm text-muted-foreground">
        Heb je een artikel, podcast of video te delen?{" "}
        <button className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:no-underline">
          Draag bij aan de bibliotheek
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// iee — Muziek Kamer content (verbatim)
// =============================================================================
function MuziekKamerContent() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Muziek Kamer</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Negen componisten · 45 geselecteerde opnames · klikt door naar YouTube
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {componisten.map((n, r) => (
          <Card
            key={r}
            className={`cursor-pointer transition-all ${
              open === r
                ? "ring-2 ring-purple-400/60 border-purple-300 dark:border-purple-700"
                : "hover:border-purple-200 dark:hover:border-purple-800"
            }`}
            onClick={() => setOpen(open === r ? null : r)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{n.naam}</h3>
                  <p className="text-xs text-muted-foreground">{n.periode}</p>
                </div>
                <Music2
                  className={`h-4 w-4 shrink-0 ${
                    open === r ? "text-purple-500" : "text-muted-foreground/50"
                  }`}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {n.beschrijving}
              </p>
              {open === r && (
                <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                  {n.werken.map((s, a) => (
                    <a
                      key={a}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(l) => l.stopPropagation()}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                    >
                      <Music2 className="h-3 w-3 text-purple-400 shrink-0" />
                      {s.titel}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// cee — Webshop content (verbatim)
// =============================================================================
// =============================================================================
// WebshopContent — interesse-registratie + Amelia Earhart editie
// =============================================================================

const WEBSHOP_PRODUCTEN = [
  {
    id: "tapas-business-kompas",
    naam: "TaPas Business Kompas",
    subtitel: "Standaardeditie",
    beschrijving: "Volledig psychometrisch profiel op basis van drivers, talentfoci en versnellers.",
    prijs: "Op aanvraag",
    features: [
      "Geforceerde keuzevragenlijst (136 stellingen)",
      "Energieprofiel per construct",
      "Persoonlijk PDF-rapport",
      "5 talen (NL/FR/EN/ES/RU)",
    ],
    badge: "Bestseller",
    kleur: "border-amber-400/40 bg-amber-50/10 dark:bg-amber-950/20",
    badgeKleur: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  },
  {
    id: "amelia-earhart",
    naam: "Amelia Earhart Editie",
    subtitel: "TaPas Business Kompas — Premiumeditie",
    beschrijving: "Alle kracht van het Business Kompas, aangevuld met een diepgaande coachatlas, T4Recruitment-koppeling en een persoonlijke debriefing door een gecertificeerde TaPas-coach.",
    prijs: "€ 349 per afname",
    features: [
      "Volledig TaPas Business Kompas",
      "Persoonlijke TaPas Coachatlas (PDF)",
      "T4Recruitment-koppeling (rolprofiel)",
      "2MinScan energierapport inbegrepen",
      "1 uur debriefing met gecertificeerde coach",
      "Prioritaire verwerking (< 48u)",
      "Meertalig rapport (5 talen)",
      "1 jaar toegang tot profiel in TaPasCity Lounge",
    ],
    badge: "Premium",
    kleur: "border-yellow-400/60 bg-yellow-50/10 dark:bg-yellow-950/20 ring-1 ring-yellow-400/20",
    badgeKleur: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  },
  {
    id: "t4recruitment",
    naam: "T4Recruitment Licentie",
    subtitel: "Rekruteringseditie",
    beschrijving: "Gestructureerde stakeholder-sessie voor het opbouwen van een virtueel functieprofiel.",
    prijs: "Op aanvraag",
    features: [
      "5 rekruteringsmodules",
      "Contextdrempelcheck",
      "Profielvergelijkingsrapport",
      "Coachbegeleiding inbegrepen",
    ],
    badge: null,
    kleur: "border-border",
    badgeKleur: "",
  },
  {
    id: "teamscan",
    naam: "TeamScan Sessie",
    subtitel: "Teamontwikkelingseditie",
    beschrijving: "Anoniem teamreflectierapport op basis van Lencioni + waarden- en normenfit.",
    prijs: "Op aanvraag",
    features: [
      "Anonieme individuele invulling",
      "Geaggregeerd teamrapport",
      "Pijleranalyse (Lencioni + fundament)",
      "Groepsdebriefing inclusief",
    ],
    badge: null,
    kleur: "border-border",
    badgeKleur: "",
  },
];

function WebshopContent() {
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [interesse, setInteresse] = useState("");
  const [bericht, setBericht] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [uitvouwen, setUitvouwen] = useState<string | null>(null);

  async function verstuurInteresse(ev: React.FormEvent) {
    ev.preventDefault();
    if (!naam.trim() || !email.trim() || !interesse) {
      setFout("Vul naam, e-mail en interesse in.");
      return;
    }
    setBezig(true);
    setFout("");
    try {
      const r = await fetch("/api/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          email: email.trim(),
          product: interesse,
          bericht: bericht.trim(),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as any).error ?? "Verzenden mislukt.");
      }
      setVerstuurd(true);
    } catch (err: any) {
      setFout(err.message ?? "Netwerkfout — probeer later opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex-shrink-0">
          <ShoppingBag className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">TaPas Webshop</h2>
          <p className="text-sm text-muted-foreground">Instruments, licenties en coachingpakketten</p>
        </div>
      </div>

      {/* Producten */}
      <div className="flex flex-col gap-4">
        {WEBSHOP_PRODUCTEN.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-5 transition-colors ${p.kleur}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{p.naam}</span>
                  {p.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.badgeKleur}`}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{p.subtitel}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.beschrijving}</p>
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{p.prijs}</span>
            </div>

            {/* Feature-lijst (uitvouwbaar) */}
            <button
              type="button"
              onClick={() => setUitvouwen(uitvouwen === p.id ? null : p.id)}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${uitvouwen === p.id ? "rotate-90" : ""}`}
              />
              {uitvouwen === p.id ? "Minder details" : "Alles inbegrepen"}
            </button>

            {uitvouwen === p.id && (
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {/* Interesse-knop */}
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setInteresse(p.id)}
              >
                <Heart className="h-3.5 w-3.5" />
                Interesse registreren
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Interesse-registratie formulier */}
      <div className="rounded-xl border border-amber-200/40 dark:border-amber-800/30 bg-amber-50/20 dark:bg-amber-950/10 p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Interesse registreren</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Vul je gegevens in en we nemen contact op zodra het product beschikbaar is — of om een offerte op maat te bespreken.
        </p>

        {verstuurd ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Star className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Bedankt!</p>
            <p className="text-sm text-muted-foreground">
              We hebben je interesse geregistreerd en nemen binnenkort contact op.
            </p>
          </div>
        ) : (
          <form onSubmit={verstuurInteresse} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Naam *</label>
                <input
                  type="text"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Jouw naam"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jouw@email.be"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Interesse in *</label>
              <select
                value={interesse}
                onChange={(e) => setInteresse(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                required
              >
                <option value="">Kies een product…</option>
                {WEBSHOP_PRODUCTEN.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bericht (optioneel)</label>
              <textarea
                value={bericht}
                onChange={(e) => setBericht(e.target.value)}
                placeholder="Context, vragen, specifieke behoeften…"
                rows={3}
                className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
              />
            </div>
            {fout && (
              <p className="text-xs text-destructive">{fout}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={bezig}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
              >
                {bezig ? (
                  <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Heart className="h-3.5 w-3.5" />
                )}
                {bezig ? "Bezig…" : "Verstuur interesse"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// see — Talentencafé content (verbatim)
// =============================================================================
function TalentencafeContent() {
  const [tekst, setTekst] = useState("");
  const [bijdragen, setBijdragen] = useState(cafeBijdragen);

  function plaatsen() {
    if (!tekst.trim()) return;
    setBijdragen([
      { auteur: "Jij", avatar: "JJ", tijd: "zojuist", tekst: tekst.trim(), likes: 0, reacties: 0, tags: [] },
      ...bijdragen,
    ]);
    setTekst("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Talentencafé</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deel inzichten, stel vragen, vertel je verhaal
        </p>
      </div>
      <Card className="border-orange-100 dark:border-orange-900/40">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar initials="JJ" />
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={tekst}
                onChange={(a) => setTekst(a.target.value)}
                placeholder="Deel een inzicht, stel een vraag of vertel iets…"
                className="min-h-[72px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-orange-300 dark:focus:ring-orange-700"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={plaatsen}
                  disabled={!tekst.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white border-0"
                >
                  Plaatsen
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3">
        {bijdragen.map((a, l) => (
          <Card key={l}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar initials={a.avatar} />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{a.auteur}</span>
                    <span className="text-xs text-muted-foreground/60">{a.tijd}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{a.tekst}</p>
                  {a.tags.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {a.tags.map((A) => (
                        <Badge key={A} variant="secondary" className="text-xs px-1.5 py-0">
                          {A}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-500 transition-colors">
                      <Heart className="h-3.5 w-3.5" />
                      {a.likes}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {a.reacties}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// aee — Inspiratiewand content (verbatim)
// =============================================================================
function InspiratiePicker() {
  const [bewaard, setBewaard] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Inspiratiewand</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quotes, inzichten en tips van de TaPas-community
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {inspiratieItems.map((n, r) => (
          <Card key={r} className={`border-l-4 ${n.kleur}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Badge variant="outline" className="text-xs capitalize">
                  {n.type === "quote" ? "Citaat" : n.type === "inzicht" ? "Inzicht" : "Tip"}
                </Badge>
                <span className="text-xs text-muted-foreground/60">· {n.context}</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground italic">
                &ldquo;{n.inhoud}&rdquo;
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">— {n.bron}</span>
                <button
                  onClick={() => {
                    const s = new Set(bewaard);
                    s.has(r) ? s.delete(r) : s.add(r);
                    setBewaard(s);
                  }}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    bewaard.has(r) ? "text-rose-500" : "text-muted-foreground hover:text-rose-400"
                  }`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${bewaard.has(r) ? "fill-current" : ""}`}
                  />
                  {bewaard.has(r) ? "Bewaard" : "Bewaar"}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/10 p-4 text-center text-sm text-muted-foreground">
        Heb je een quote, inzicht of tip te delen?{" "}
        <button className="text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:no-underline">
          Draag bij aan de wand
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// oee — Werkplaats content (verbatim)
// =============================================================================
function WerkplaatsContent() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Werkplaats</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lopende projecten van de community — sluit je aan of start een nieuw project
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {werkplaatsProjecten.map((e, t) => (
          <Card
            key={t}
            className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-snug">{e.titel}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.statusKleur}`}>
                  {e.status}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{e.beschrijving}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex -space-x-1.5">
                  {e.leden.map((n) => (
                    <Avatar key={n} initials={n} size="sm" />
                  ))}
                </div>
                <div className="flex gap-1">
                  {e.tags.map((n) => (
                    <Badge key={n} variant="secondary" className="text-xs px-1.5 py-0">
                      {n}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-1">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Meer info
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card className="border-dashed border-slate-300 dark:border-slate-700">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Sparkles className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Start een project</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Heb je een idee? Zoek collaborators of doe het alleen.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Nieuw project starten
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// lee — Reflectiekamer content (verbatim)
// =============================================================================
function ReflectieContent() {
  const [tekst, setTekst] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);

  function opslaan() {
    if (!tekst.trim()) return;
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
          <PenLine className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300">Persoonlijk dagboek</p>
          <p className="mt-0.5 text-xs leading-relaxed text-rose-700/70 dark:text-rose-400/70">
            Jouw reflecties zijn privé. Ze worden niet gedeeld, niet geanalyseerd en niet bewaard
            buiten jouw apparaat. Dit is jouw ruimte.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {new Date().toLocaleDateString("nl-BE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <textarea
          value={tekst}
          onChange={(a) => setTekst(a.target.value)}
          placeholder="Wat zit er in je hoofd vandaag? Wat vloog er? Wat wil je vasthouden?"
          className="min-h-[200px] w-full resize-none rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-300 dark:focus:ring-rose-700"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/50">{tekst.length} tekens</span>
          <Button
            size="sm"
            onClick={opslaan}
            disabled={!tekst.trim()}
            className={`transition-colors ${
              opgeslagen
                ? "bg-emerald-500 hover:bg-emerald-500 text-white border-0"
                : "bg-rose-500 hover:bg-rose-600 text-white border-0"
            }`}
          >
            {opgeslagen ? "✓ Opgeslagen" : "Opslaan"}
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Reflectievragen
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Wanneer voelde ik vandaag energie?",
            "Wat herhaalde zich de laatste weken?",
            "Waar gaf ik meer energie dan ik ontving?",
            "Welk talent gebruikte ik vandaag volop?",
          ].map((a, l) => (
            <button
              key={l}
              onClick={() => setTekst((A) => (A ? A + "\n\n" : "") + a + "\n")}
              className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/5 hover:text-foreground transition-colors"
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Aee — Buitenterras content (verbatim)
// =============================================================================
function BuitenterrasContent() {
  const [ingeschreven, setIngeschreven] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Buitenterras · Events &amp; Agenda
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aankomende live-sessies, webinars en ontmoetingen
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {terrasEvents.map((n, r) => {
          const vol = n.plaatsen >= n.max;
          const actief = ingeschreven.has(r);
          const pct = Math.round((n.plaatsen / n.max) * 100);
          return (
            <Card key={r} className={actief ? "border-sky-300 dark:border-sky-700" : ""}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card w-14 py-2 text-center">
                    <span className="text-xs uppercase text-muted-foreground font-medium">
                      {n.dag}
                    </span>
                    <span className="text-lg font-bold leading-tight text-foreground">
                      {n.datum.split(" ")[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">{n.datum.split(" ")[1]}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground leading-snug">
                        {n.titel}
                      </h3>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {n.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{n.tijdstip}</span>
                      <span>·</span>
                      <span>
                        {n.plaatsen}/{n.max} plaatsen
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {n.beschrijving}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant={actief ? "default" : "outline"}
                        disabled={vol && !actief}
                        onClick={() => {
                          const s = new Set(ingeschreven);
                          s.has(r) ? s.delete(r) : s.add(r);
                          setIngeschreven(s);
                        }}
                        className={
                          actief
                            ? "bg-sky-500 hover:bg-sky-600 text-white border-0"
                            : vol
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }
                      >
                        {actief ? "✓ Ingeschreven" : vol ? "Vol" : "RSVP"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// uee — kamer content router (verbatim)
// =============================================================================
function KamerContent({ id }: { id: string }) {
  switch (id) {
    case "stilte":     return <SilteKamerContent />;
    case "studie":     return <StudieKamerContent />;
    case "muziek":     return <MuziekKamerContent />;
    case "webshop":    return <WebshopContent />;
    case "cafe":       return <TalentencafeContent />;
    case "inspiratie": return <InspiratiePicker />;
    case "werkplaats": return <WerkplaatsContent />;
    case "reflectie":  return <ReflectieContent />;
    case "terras":     return <BuitenterrasContent />;
    default:           return null;
  }
}

// =============================================================================
// Lounge radio — HTTPS stream, autoplay bij mount, stop-knop als klein radiootje
// Stream: Radio Mediterranea Lounge (lounge/chillout/smooth-jazz, 128kbps)
// Fallback: Jazz FM Yerevan
// =============================================================================
const STREAM_URLS = [
  "https://stream.radiomediterranea.com:8160/lounge.mp3",
  "https://de.auroramedia.am/jazz.mp3",
];

function useLoungeMuziek() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speelt, setSpeelt] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const streamIdx = useRef(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;

    function probeerStream(idx: number) {
      if (idx >= STREAM_URLS.length) return;
      audio.src = STREAM_URLS[idx];
      audio.load();
      const play = audio.play();
      if (play) {
        play
          .then(() => { setSpeelt(true); setGeladen(true); })
          .catch(() => {
            // stream mislukt → probeer volgende
            streamIdx.current = idx + 1;
            probeerStream(idx + 1);
          });
      }
    }

    probeerStream(0);

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (speelt) {
      audio.pause();
      setSpeelt(false);
    } else {
      const play = audio.play();
      if (play) play.then(() => setSpeelt(true)).catch(() => {});
      else setSpeelt(true);
    }
  }

  return { speelt, geladen, toggle };
}

// =============================================================================
// dee — Lounge hoofdpagina (verbatim)
// =============================================================================
export default function Lounge() {
  const [actieveKamer, setActieveKamer] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const { speelt, toggle } = useLoungeMuziek();

  function openKamer(id: string) {
    setActieveKamer(id);
    setTimeout(() => mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function sluitKamer() {
    setActieveKamer(null);
  }

  const kamer = kamers.find((k) => k.id === actieveKamer);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {/* Radio-knop */}
            <button
              type="button"
              onClick={toggle}
              title={speelt ? "Muziek pauzeren" : "Muziek afspelen"}
              aria-label={speelt ? "Lounge muziek pauzeren" : "Lounge muziek afspelen"}
              className={
                "relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all " +
                (speelt
                  ? "border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] shadow-[0_0_8px_hsl(var(--gold)/0.35)]"
                  : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)] hover:text-[hsl(var(--gold)/0.7)]")
              }
            >
              <Radio className="h-3.5 w-3.5" />
              {speelt && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            {actieveKamer && (
              <Button variant="ghost" size="sm" onClick={sluitKamer} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Alle kamers</span>
              </Button>
            )}
            <Link href="/">
              <Button variant="outline" size="sm">
                Platform
              </Button>
            </Link>
          </div>
        }
      />
      <main
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"
        ref={mainRef}
      >
        {actieveKamer ? (
          // ─── Actieve kamer ───────────────────────────────────────────────
          <div>
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={sluitKamer}
                className="hover:text-foreground transition-colors"
              >
                Lounge
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">{kamer?.naam}</span>
            </nav>
            {kamer && (
              <div className="mb-6 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/8 ${kamer.kleur}`}>
                  <kamer.icon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">{kamer.naam}</h1>
                  <p className="text-xs text-muted-foreground">{kamer.ondertitel}</p>
                </div>
              </div>
            )}
            <KamerContent id={actieveKamer} />
            <div className="mt-10 border-t border-border pt-6">
              <button
                onClick={sluitKamer}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Terug naar alle kamers
              </button>
            </div>
          </div>
        ) : (
          // ─── Lounge overzicht ────────────────────────────────────────────
          <>
            {/* welkom banner */}
            <section
              className="mb-8 rounded-xl border-l-2 py-5 pl-6 pr-4 sm:mb-10"
              style={{
                borderLeftColor: "hsl(var(--gold))",
                background:
                  "linear-gradient(90deg, hsl(var(--gold) / 0.08) 0%, hsl(var(--gold) / 0.025) 60%, transparent 100%)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                    style={{ color: "hsl(var(--gold))" }}
                  >
                    TaPas Lounge
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
                    Welkom in de Lounge — de gemeenschappelijke ruimte van TaPasCity. Kies een kamer
                    en neem je tijd. Er is geen haast hier.
                  </p>
                </div>
                <div
                  className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "hsl(var(--gold) / 0.1)" }}
                >
                  <Star className="h-5 w-5" style={{ color: "hsl(var(--gold))" }} />
                </div>
              </div>
            </section>

            {/* aanwezigen balk */}
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">12</strong> leden aanwezig
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex -space-x-1.5">
                {["HV", "DM", "SL", "TK", "AV"].map((l) => (
                  <Avatar key={l} initials={l} size="sm" />
                ))}
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs text-muted-foreground">
                  +7
                </div>
              </div>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Nieuwe bijdrage in{" "}
                <button
                  className="text-accent underline underline-offset-2 hover:no-underline"
                  onClick={() => openKamer("cafe")}
                >
                  Talentencafé
                </button>{" "}
                · 2 min geleden
              </span>
            </div>

            {/* kamers grid */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Negen kamers</h2>
                <span className="text-xs text-muted-foreground">{kamers.length} beschikbaar</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kamers.map((k) => (
                  <KamerKaart key={k.id} kamer={k} onOpen={() => openKamer(k.id)} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
