/**
 * TaPas Lounge — de gemeenschappelijke ontmoetings- en inspiratieruimte
 * van het TaPas-platform. Negen kamers, toegankelijk zonder herladen.
 * Leden kunnen hun dagboek bijhouden, bijdragen aan het café, RSVP'en
 * voor events en projecten starten in de werkplaats.
 *
 * Architectuurkeuzes:
 *  – Geen externe router-navigatie: kamers worden in-page gewisseld (useState)
 *  – Demo-modus: alle content is statisch geseed; geen API-calls vereist
 *  – GDPR: persoonlijk dagboek is bewust LEEG; geen seed-data
 *  – Kleurpalet volgt de bestaande CSS-variabelen (accent, gold, primary)
 */

import { useState, useRef } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Coffee,
  Music2,
  Lightbulb,
  Wrench,
  Leaf,
  ShoppingBag,
  GraduationCap,
  Sunset,
  ArrowLeft,
  ExternalLink,
  Play,
  Heart,
  MessageCircle,
  Calendar,
  Users,
  PenLine,
  Headphones,
  Globe,
  Star,
  Clock,
  ChevronRight,
  Flame,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type KamerId =
  | "onthaal"
  | "stilte"
  | "studie"
  | "muziek"
  | "webshop"
  | "cafe"
  | "inspiratie"
  | "werkplaats"
  | "reflectie"
  | "terras";

interface Kamer {
  id: KamerId;
  naam: string;
  ondertitel: string;
  icon: React.ElementType;
  kleur: string;
  beschrijving: string;
  badge?: string;
}

// ─── Kamer-configuratie ────────────────────────────────────────────────────────

const KAMERS: Kamer[] = [
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

// ─── Demo-data ─────────────────────────────────────────────────────────────────

const CAFE_BIJDRAGEN = [
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

const INSPIRATIE_ITEMS = [
  {
    type: "quote" as const,
    inhoud: "Talent zonder richting is als een kompas in een zak.",
    bron: "Marc Debisschop",
    context: "TaPas Manifest",
    kleur: "border-l-amber-400",
  },
  {
    type: "inzicht" as const,
    inhoud:
      "Mensen presteren niet beter door te weten wat ze slecht doen. Ze groeien door te weten waar hun energie vandaan komt.",
    bron: "Uit de TaPas-methodologie",
    context: "Energiemanagement",
    kleur: "border-l-emerald-400",
  },
  {
    type: "quote" as const,
    inhoud: "Je talenten zijn geen toeval. Ze zijn de architectuur van wie je bent.",
    bron: "TaPasCity",
    context: "Profielintroductie",
    kleur: "border-l-purple-400",
  },
  {
    type: "tip" as const,
    inhoud:
      "Tip voor coaches: begin een gesprek niet met 'wat wil je bereiken?' maar met 'wanneer vloog je vorige week?'",
    bron: "Coaches Gids TaPas",
    context: "Praktijk",
    kleur: "border-l-blue-400",
  },
];

const WERKPLAATS_PROJECTEN = [
  {
    titel: "Talent-intro voor HR-managers",
    beschrijving:
      "Een toegankelijke onboardingmodule die HR-professionals wegwijs maakt in talentprofielen — zonder jargon.",
    leden: ["SL", "HV", "TK"],
    status: "Actief",
    statusKleur: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    tags: ["HR", "Onboarding"],
  },
  {
    titel: "Visuele talentkaarten",
    beschrijving:
      "Gedrukte en digitale kaarten per talentfocus — als gesprekstrigger in teamworkshops.",
    leden: ["DM", "AV"],
    status: "Zoekt co-creators",
    statusKleur: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    tags: ["Design", "Workshop"],
  },
];

const TERRAS_EVENTS = [
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

const STUDIE_BIBLIOTHEEK = [
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

// ─── Muziek-data ───────────────────────────────────────────────────────────────

const COMPONISTEN = [
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

// ─── Sub-componenten ───────────────────────────────────────────────────────────

function KamerKaart({ kamer, onOpen }: { kamer: Kamer; onOpen: () => void }) {
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

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div
      className={`${s} flex items-center justify-center rounded-full bg-accent/15 font-semibold text-accent shrink-0`}
    >
      {initials}
    </div>
  );
}

// ─── Kamer-inhoud ──────────────────────────────────────────────────────────────

function StilteKamer() {
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
          "Stilte is niet de afwezigheid van geluid, maar de aanwezigheid van jezelf."
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-3">
        {["Wees aanwezig", "Laat gedachten passeren", "Kom terug als het klopt"].map((tip, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <span className="text-base">{["🌿", "🌊", "✦"][i]}</span>
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudieKamer() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bibliotheek</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Artikelen, longreads en podcasts van de TaPas-community
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{STUDIE_BIBLIOTHEEK.length} items</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {STUDIE_BIBLIOTHEEK.map((item, i) => (
          <Card key={i} className="group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
            <CardContent className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {item.type === "Podcast" ? (
                    <Headphones className="h-4 w-4 text-purple-500 shrink-0" />
                  ) : item.type === "Longread" ? (
                    <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-blue-400 shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">{item.type}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {item.duur}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">{item.titel}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {item.beschrijving}
              </p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex gap-1 flex-wrap">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground/60">{item.auteur}</span>
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

function MuziekKamer() {
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
        {COMPONISTEN.map((c, i) => (
          <Card
            key={i}
            className={`cursor-pointer transition-all ${
              open === i
                ? "ring-2 ring-purple-400/60 border-purple-300 dark:border-purple-700"
                : "hover:border-purple-200 dark:hover:border-purple-800"
            }`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{c.naam}</h3>
                  <p className="text-xs text-muted-foreground">{c.periode}</p>
                </div>
                <Music2 className={`h-4 w-4 shrink-0 ${open === i ? "text-purple-500" : "text-muted-foreground/50"}`} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{c.beschrijving}</p>
              {open === i && (
                <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                  {c.werken.map((w, j) => (
                    <a
                      key={j}
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                    >
                      <Play className="h-3 w-3 text-purple-500 shrink-0" />
                      <span className="line-clamp-1">{w.titel}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
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

function TalentCafe() {
  const [nieuweBijdrage, setNieuweBijdrage] = useState("");
  const [bijdragen, setBijdragen] = useState(CAFE_BIJDRAGEN);

  function plaatsBijdrage() {
    if (!nieuweBijdrage.trim()) return;
    setBijdragen([
      {
        auteur: "Jij",
        avatar: "JJ",
        tijd: "zojuist",
        tekst: nieuweBijdrage.trim(),
        likes: 0,
        reacties: 0,
        tags: [],
      },
      ...bijdragen,
    ]);
    setNieuweBijdrage("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Talentencafé</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deel inzichten, stel vragen, vertel je verhaal
        </p>
      </div>

      {/* Schrijfvak */}
      <Card className="border-orange-100 dark:border-orange-900/40">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar initials="JJ" />
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={nieuweBijdrage}
                onChange={(e) => setNieuweBijdrage(e.target.value)}
                placeholder="Deel een inzicht, stel een vraag of vertel iets…"
                className="min-h-[72px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-orange-300 dark:focus:ring-orange-700"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={plaatsBijdrage}
                  disabled={!nieuweBijdrage.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white border-0"
                >
                  Plaatsen
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        {bijdragen.map((b, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar initials={b.avatar} />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{b.auteur}</span>
                    <span className="text-xs text-muted-foreground/60">{b.tijd}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{b.tekst}</p>
                  {b.tags.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {b.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-500 transition-colors">
                      <Heart className="h-3.5 w-3.5" />
                      {b.likes}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {b.reacties}
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

function InspiratieWand() {
  const [liked, setLiked] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Inspiratiewand</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quotes, inzichten en tips van de TaPas-community
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {INSPIRATIE_ITEMS.map((item, i) => (
          <Card
            key={i}
            className={`border-l-4 ${item.kleur}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Badge variant="outline" className="text-xs capitalize">
                  {item.type === "quote" ? "Citaat" : item.type === "inzicht" ? "Inzicht" : "Tip"}
                </Badge>
                <span className="text-xs text-muted-foreground/60">· {item.context}</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground italic">
                "{item.inhoud}"
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">— {item.bron}</span>
                <button
                  onClick={() => {
                    const newLiked = new Set(liked);
                    newLiked.has(i) ? newLiked.delete(i) : newLiked.add(i);
                    setLiked(newLiked);
                  }}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    liked.has(i) ? "text-rose-500" : "text-muted-foreground hover:text-rose-400"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${liked.has(i) ? "fill-current" : ""}`} />
                  {liked.has(i) ? "Bewaard" : "Bewaar"}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/10 p-4 text-center text-sm text-muted-foreground">
        Iets dat jou raakt?{" "}
        <button className="text-yellow-700 dark:text-yellow-400 underline underline-offset-2 hover:no-underline">
          Voeg toe aan de wand
        </button>
      </div>
    </div>
  );
}

function Werkplaats() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Werkplaats</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lopende projecten van de community — sluit je aan of start een nieuw project
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {WERKPLAATS_PROJECTEN.map((project, i) => (
          <Card key={i} className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-snug">{project.titel}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${project.statusKleur}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{project.beschrijving}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex -space-x-1.5">
                  {project.leden.map((lid) => (
                    <Avatar key={lid} initials={lid} size="sm" />
                  ))}
                </div>
                <div className="flex gap-1">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                      {tag}
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
      </div>
      <Card className="border-dashed border-slate-300 dark:border-slate-700">
        <CardContent className="flex items-center justify-center gap-3 p-5 text-center">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Heb je een idee voor een project?</p>
            <Button variant="outline" size="sm">
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              Nieuw project starten
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReflectieKamer() {
  const [dagboek, setDagboek] = useState("");
  const [opgeslagen, setOpslagen] = useState(false);

  function sla() {
    if (!dagboek.trim()) return;
    setOpslagen(true);
    setTimeout(() => setOpslagen(false), 2000);
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
            Jouw reflecties zijn privé. Ze worden niet gedeeld, niet geanalyseerd en niet bewaard buiten jouw
            apparaat. Dit is jouw ruimte.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <textarea
          value={dagboek}
          onChange={(e) => setDagboek(e.target.value)}
          placeholder="Wat zit er in je hoofd vandaag? Wat vloog er? Wat wil je vasthouden?"
          className="min-h-[200px] w-full resize-none rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-300 dark:focus:ring-rose-700"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/50">{dagboek.length} tekens</span>
          <Button
            size="sm"
            onClick={sla}
            disabled={!dagboek.trim()}
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reflectievragen</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Wanneer voelde ik vandaag energie?",
            "Wat herhaalde zich de laatste weken?",
            "Waar gaf ik meer energie dan ik ontving?",
            "Welk talent gebruikte ik vandaag volop?",
          ].map((vraag, i) => (
            <button
              key={i}
              onClick={() => setDagboek((prev) => (prev ? prev + "\n\n" : "") + vraag + "\n")}
              className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/5 hover:text-foreground transition-colors"
            >
              {vraag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Buitenterras() {
  const [rsvp, setRsvp] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Buitenterras · Events & Agenda</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aankomende live-sessies, webinars en ontmoetingen
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {TERRAS_EVENTS.map((ev, i) => {
          const vol = ev.plaatsen >= ev.max;
          const ingeschreven = rsvp.has(i);
          const bezetting = Math.round((ev.plaatsen / ev.max) * 100);
          return (
            <Card key={i} className={ingeschreven ? "border-sky-300 dark:border-sky-700" : ""}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  {/* Datum-blokje */}
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card w-14 py-2 text-center">
                    <span className="text-xs uppercase text-muted-foreground font-medium">{ev.dag}</span>
                    <span className="text-lg font-bold leading-tight text-foreground">
                      {ev.datum.split(" ")[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ev.datum.split(" ")[1]}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground leading-snug">{ev.titel}</h3>
                      <Badge variant="outline" className="shrink-0 text-xs">{ev.type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{ev.tijdstip}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {ev.plaatsen}/{ev.max} plaatsen
                      </span>
                      {bezetting > 75 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Flame className="h-3 w-3" /> Bijna vol
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{ev.beschrijving}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        size="sm"
                        variant={ingeschreven ? "default" : "outline"}
                        disabled={vol && !ingeschreven}
                        onClick={() => {
                          const s = new Set(rsvp);
                          ingeschreven ? s.delete(i) : s.add(i);
                          setRsvp(s);
                        }}
                        className={ingeschreven ? "bg-sky-500 hover:bg-sky-600 text-white border-0" : ""}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {ingeschreven ? "Ingeschreven ✓" : vol ? "Volzet" : "Inschrijven"}
                      </Button>
                      {ingeschreven && (
                        <span className="text-xs text-sky-600 dark:text-sky-400">
                          Je ontvangt een bevestigingsmail.
                        </span>
                      )}
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

function WebshopKamer() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
        <ShoppingBag className="h-9 w-9 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="max-w-md">
        <Badge variant="secondary" className="mb-3">Binnenkort</Badge>
        <h2 className="text-xl font-semibold text-foreground">TaPas Webshop</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Bestel instruments, rapporten en coachinglicenties. We bouwen dit moment volop — binnenkort beschikbaar.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-3 text-left">
        {["TaPas Business Kompas", "T4Recruitment Licentie", "2MinScan Bundel", "TeamScan Sessie"].map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3"
          >
            <span className="text-sm text-foreground">{item}</span>
            <Badge variant="outline" className="text-xs text-muted-foreground">Binnenkort</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Kamer-renderer ────────────────────────────────────────────────────────────

function KamerInhoud({ id }: { id: KamerId }) {
  switch (id) {
    case "stilte": return <StilteKamer />;
    case "studie": return <StudieKamer />;
    case "muziek": return <MuziekKamer />;
    case "webshop": return <WebshopKamer />;
    case "cafe": return <TalentCafe />;
    case "inspiratie": return <InspiratieWand />;
    case "werkplaats": return <Werkplaats />;
    case "reflectie": return <ReflectieKamer />;
    case "terras": return <Buitenterras />;
    default: return null;
  }
}

// ─── Hoofd-export ──────────────────────────────────────────────────────────────

export default function Lounge() {
  const [actief, setActief] = useState<KamerId | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  function openKamer(id: KamerId) {
    setActief(id);
    // Scroll naar boven van de inhoud
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function sluitKamer() {
    setActief(null);
  }

  const huidigeKamer = KAMERS.find((k) => k.id === actief);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {actief && (
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12" ref={contentRef}>
        {!actief ? (
          /* ── Lounge-onthaal ── */
          <>
            {/* Welkomst-banner */}
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
                    Welkom in de Lounge — de gemeenschappelijke ruimte van TaPasCity. Kies een kamer en
                    neem je tijd. Er is geen haast hier.
                  </p>
                </div>
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "hsl(var(--gold) / 0.1)" }}>
                  <Star className="h-5 w-5" style={{ color: "hsl(var(--gold))" }} />
                </div>
              </div>
            </section>

            {/* Leden-status-balk */}
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">12</strong> leden aanwezig
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex -space-x-1.5">
                {["HV", "DM", "SL", "TK", "AV"].map((initials) => (
                  <Avatar key={initials} initials={initials} size="sm" />
                ))}
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs text-muted-foreground">
                  +7
                </div>
              </div>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Nieuwe bijdrage in{" "}
                <button className="text-accent underline underline-offset-2 hover:no-underline" onClick={() => openKamer("cafe")}>
                  Talentencafé
                </button>{" "}
                · 2 min geleden
              </span>
            </div>

            {/* Kamergrid */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Negen kamers</h2>
                <span className="text-xs text-muted-foreground">{KAMERS.length} beschikbaar</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {KAMERS.map((kamer) => (
                  <KamerKaart
                    key={kamer.id}
                    kamer={kamer}
                    onOpen={() => openKamer(kamer.id)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          /* ── Kamer-weergave ── */
          <div>
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={sluitKamer} className="hover:text-foreground transition-colors">
                Lounge
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">{huidigeKamer?.naam}</span>
            </nav>

            {/* Kamer-header */}
            {huidigeKamer && (
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/8 ${huidigeKamer.kleur}`}
                >
                  <huidigeKamer.icon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">{huidigeKamer.naam}</h1>
                  <p className="text-xs text-muted-foreground">{huidigeKamer.ondertitel}</p>
                </div>
              </div>
            )}

            {/* Kamer-inhoud */}
            <KamerInhoud id={actief} />

            {/* Terug-knop onderaan */}
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
        )}
      </main>
    </div>
  );
}
