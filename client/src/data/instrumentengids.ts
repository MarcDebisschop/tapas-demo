// =============================================================================
// client/src/data/instrumentengids.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// De Instrumentengids: één consulteerbaar overzicht van alle TaPas-instrumenten.
//
// Dit bestand levert ENKEL de gids-specifieke metadata die NIET al door de
// bestaande backend-catalogus (/api/instrumenten/catalogus) geleverd wordt:
//   - orientatie      (business | education | beide)  → tegel-/kaartkleur
//   - beantwoordt      (veld 2: "welke vragen beantwoordt het")
//   - gebruik          (veld 3: "hoe kan ik het verder gebruiken")
//   - start            (veld 5: hoe aanvragen/starten — label + route)
//   - rapportTeaser    (korte tekstuele preview van het rapport)
//   - rapportPreview   (verwijzing naar een visuele mini-preview, optioneel)
//   - leeftijdsfocus   (enkel voor T4Teens/T4Students — leeftijdsonderscheid)
//
// De velden naam, omschrijving, doelgroep, useCases, outcome, rapport en credits
// komen uit de bestaande catalogus-API (Regel 1: nooit herbouwen wat bestaat).
// De frontend voegt beide bronnen samen op basis van het canonieke `id`.
//
// Admin kan de teksten (beantwoordt/gebruik/rapportTeaser/omschrijving) per taal
// overschrijven via /api/gids (server/gids-manager.ts). Deze file is de DEFAULT.
// =============================================================================

export type Orientatie = "business" | "education" | "beide" | "sport";

export interface GidsStart {
  /** Knoplabel, bv. "Start de scan" of "Vraag een traject aan". */
  label: string;
  /** Hash-route binnen de app (Wouter), bv. "/2minscan" of "/hdd". */
  route: string;
  /** true = start meteen een afname; false = informatie/aanvraag-pagina. */
  direct: boolean;
}

export interface GidsInstrument {
  /** Canoniek id — koppelt aan /api/instrumenten/catalogus én aan de override-tabel. */
  id: string;
  /** Weergavenaam (fallback; catalogus.naam wint indien aanwezig). */
  naam: string;
  /** business | education | beide → bepaalt de kaart-/randkleur. */
  orientatie: Orientatie;
  /** Korte eyebrow boven de kaart. */
  eyebrow: string;
  /** Veld 1 — korte omschrijving (fallback; catalogus.beschrijving/override wint). */
  omschrijving: string;
  /** Veld 2 — welke vragen beantwoordt dit instrument. */
  beantwoordt: string;
  /** Veld 3 — hoe kan ik het verder gebruiken. */
  gebruik: string;
  /** Veld 4 — doelgroep (fallback; catalogus.doelgroep wint indien aanwezig). */
  doelgroep: string;
  /** Veld 5 — hoe starten/aanvragen. */
  start: GidsStart;
  /** Korte tekstuele rapport-teaser (rapport-preview, deel A). */
  rapportTeaser: string;
  /** Optionele visuele preview (rapport-preview, deel B): pad naar afbeelding/pdf. */
  rapportPreview?: string;
  /** Enkel voor onderwijs-varianten: expliciete leeftijdsfocus. */
  leeftijdsfocus?: string;
  /** Lucide-icoonnaam (string) — de pagina mapt dit naar een component. */
  icoon: string;
}

// -----------------------------------------------------------------------------
// De negen instrumenten. Volgorde = weergavevolgorde in de gids.
// orientatie-verdeling (bevestigd door Marc, 3 juli 2026):
//   beide     = T4P Business Kompas, 2MinScan, TaPas Teamscan, Impact-roos
//   business  = T4Recruitment, Human Due Diligence
//   education = T4Teens, T4Students
//   sport     = T4Sports  (mentale coaching bij sporters — eigen categorie,
//               energiek-oranje accent; bevestigd door Marc, 3 juli 2026)
// -----------------------------------------------------------------------------
export const INSTRUMENTENGIDS: GidsInstrument[] = [
  {
    id: "t4p-business",
    naam: "T4P Business Kompas",
    orientatie: "beide",
    eyebrow: "Talentprofiel · individueel",
    omschrijving:
      "Het volledige TaPas Kompas: een diepgaand talentprofiel dat talent-foci, talent-versnellers, drivers en energieprofiel in kaart brengt voor één persoon.",
    beantwoordt:
      "Waar liggen mijn natuurlijke talenten? Welke drijfveren geven mij energie, en welke vreten energie? Hoe zet ik mijn talent het snelst om in resultaat?",
    gebruik:
      "Als anker voor loopbaancoaching, leiderschapsontwikkeling, onboarding of teamsamenstelling. Het profiel voedt gesprekken, ontwikkelplannen en de optionele Coachatlas.",
    doelgroep: "Professionals, leidinggevenden, coaches — ook studenten en leerlingen bij loopbaanoriëntatie.",
    start: { label: "Start een afname", route: "/start", direct: true },
    rapportTeaser:
      "Een rijk TaPas Kompas-rapport met talent-foci, versnellers, drivers, energieprofiel én TaPas Jester-classificatie — als PDF én online dashboard.",
    rapportPreview: "/jester-galerij/assets/img/spiegel.png",
    icoon: "Compass",
  },
  {
    id: "twominscan",
    naam: "2MinScan",
    orientatie: "beide",
    eyebrow: "Energetisch gedragsprofiel",
    omschrijving:
      "Het energetisch gedragsprofiel in een professionele context: brengt in kaart hoe je energie zich vertaalt naar gedrag op het werk, met een uitgewerkt rapport in 5 talen.",
    beantwoordt:
      "Hoe vertaalt mijn energie zich naar mijn gedrag in een werkcontext? Waar zit mijn energetische kracht, en hoe uit die zich zichtbaar?",
    gebruik:
      "Als vertrekpunt voor een coachgesprek of ontwikkeltraject, en als gedeeld, meertalig beeld binnen een team.",
    doelgroep: "Professionals die hun energetisch gedragsprofiel in een werkcontext willen kennen.",
    start: { label: "Start de 2MinScan", route: "/2minscan", direct: true },
    rapportTeaser:
      "Een uitgewerkt 15-pagina \"Energetisch Gedragsprofiel\"-rapport, beschikbaar in 5 talen (NL/FR/EN/ES/RU).",
    icoon: "Zap",
  },
  {
    id: "tapas-teamscan",
    naam: "TaPas Teamscan",
    orientatie: "beide",
    eyebrow: "Teamdynamiek · collectief",
    omschrijving:
      "Een collaboratief reflectie- en ontwikkelinstrument dat de dynamiek, sterktes en spanningsvelden van een team zichtbaar maakt (op basis van Lencioni).",
    beantwoordt:
      "Hoe werkt ons team echt samen? Waar zit vertrouwen, en waar wringt het? Welke disfuncties spelen, en hoe adresseren we ze concreet?",
    gebruik:
      "Om teamdynamieken bespreekbaar te maken, teamontwikkeling te sturen na fusie of reorganisatie, en teamgesprekken te faciliteren met een gedeeld beeld.",
    doelgroep: "Teams, afdelingsmanagers, teamcoaches — in bedrijf én onderwijs.",
    start: { label: "Open de Teamscan", route: "/teamscan", direct: false },
    rapportTeaser:
      "Een collectief teamrapport met sterktes, spanningsvelden en concrete actiepunten, plus een facilitatiegids voor de teamcoach.",
    icoon: "Users",
  },
  {
    id: "t4o",
    naam: "TaPas 4 Organizations",
    orientatie: "business",
    eyebrow: "Organisatie · collectief",
    omschrijving:
      "Een organisatie-talentprofiel dat het emergente talent van een hele organisatie in kaart brengt via een afname in drie ringen — leiding, medewerkers en externe stakeholders — samengevoegd tot één beeld.",
    beantwoordt:
      "Wie is deze organisatie in essentie? Waar ligt haar collectieve talent en energie? Waar wringt het tussen hoe de leiding, de medewerkers en de buitenwereld haar zien?",
    gebruik:
      "Om de identiteit en het vermogen van een organisatie bespreekbaar te maken, spanningsvelden tussen ringen zichtbaar te maken en gerichte organisatieontwikkeling te sturen.",
    doelgroep: "Organisaties, directieteams, organisatiecoaches en -adviseurs.",
    start: { label: "Open T4Organizations", route: "/t4o", direct: false },
    rapportTeaser:
      "Een organisatierapport met identiteitskern, energie- en vermogensprofiel, spanningsvelden tussen de ringen en concrete ontwikkelaanbevelingen.",
    icoon: "Building2",
  },
  {
    id: "impact-roos",
    naam: "Impact-roos",
    orientatie: "beide",
    eyebrow: "360°-feedback · visueel",
    omschrijving:
      "Een visueel 360°-feedbackinstrument dat zelfperceptie en omgevingsperceptie naast elkaar legt in een herkenbaar rozendiagram.",
    beantwoordt:
      "Hoe zie ik mezelf, en hoe ziet mijn omgeving mij? Waar zit het verschil tussen zelfbeeld en impact, en wat betekent dat voor mijn ontwikkeling?",
    gebruik:
      "Als visueel ankerpunt in ontwikkelgesprekken, voor groeps-benchmarking en om zelfperceptie tegenover omgevingsperceptie te plaatsen.",
    doelgroep: "360°-feedbacktrajecten, teamleiders, HR — ook in onderwijscontext.",
    start: { label: "Bekijk de Impact-roos", route: "/impact", direct: false },
    rapportTeaser:
      "Een visueel impactrapport: een SVG-roos die per dimensie zelfscores en omgevingsscores vergelijkt, met batch-tarifering voor groepen.",
    rapportPreview: "/impact-roos-rapport-voorbeeld.pdf",
    icoon: "Flower2",
  },
  {
    id: "t4recruitment",
    naam: "T4Recruitment",
    orientatie: "business",
    eyebrow: "Selectie · rolprofiel",
    omschrijving:
      "Een selectie-instrument dat via een stakeholder-kring een gedragen rolprofiel bouwt en kandidaten objectief afzet tegen dat profiel.",
    beantwoordt:
      "Welk talent vraagt deze rol echt? Welke kandidaat past het best op talentniveau? Hoe objectiveren we het selectiegesprek voorbij de buikgevoel-fit?",
    gebruik:
      "Om rolprofielen op te stellen via consensus, kandidaten te vergelijken op talentniveau en selectiegesprekken te onderbouwen met data.",
    doelgroep: "Recruiters, hiring managers, selectiepanels.",
    start: { label: "Open T4Recruitment", route: "/t4r", direct: false },
    rapportTeaser:
      "Een rolprofiel-PDF opgebouwd via de hiring-kring, plus een fit-rapport per kandidaat met visuele match-analyse.",
    icoon: "Target",
  },
  {
    id: "hdd",
    naam: "Human Due Diligence",
    orientatie: "business",
    eyebrow: "Vlaggenschip · governance",
    omschrijving:
      "Het gefaseerde vlaggenschip-traject dat de menselijke kant van een organisatie of board grondig doorlicht — de diepste analyse in het TaPas-arsenaal.",
    beantwoordt:
      "Hoe robuust is het leiderschaps- of boardteam? Waar zitten sleutelpersoon-risico's, spanningen en governance-gaten? Wat betekent dat voor de strategie?",
    gebruik:
      "Bij leiderschapswissels, pre-merger talent mapping, het evalueren van strategische teamcomposities en het objectiveren van board-dynamieken.",
    doelgroep: "Boards, directieteams, executive coaches.",
    start: { label: "Vraag een HDD-traject aan", route: "/hdd", direct: false },
    rapportTeaser:
      "Een bestuurlijk talentrapport met een drukklaar executive PDF, boardpresentatie en concrete governance-aanbevelingen.",
    rapportPreview: "/jester-galerij/assets/img/zegel.png",
    icoon: "Landmark",
  },
  {
    id: "t4sports",
    naam: "T4Sports",
    orientatie: "sport",
    eyebrow: "Sport · mentaal talent",
    omschrijving:
      "Het Mental Talent Profiel voor atleten: talent-toegang, talent-route, drivers en energiestaat vertaald naar sporttaal, met optionele verdiepende modules.",
    beantwoordt:
      "Waar ligt mijn mentaal talent als atleet? Welke drivers werken onder prestatiedruk? Hoe versterk ik veerkracht, flow en atletische identiteit?",
    gebruik:
      "In de begeleiding van elite-atleten, voor driver-analyse onder druk en via de modules Resilience (M1), Flow-State (M2) en Atletische Identiteit (M3).",
    doelgroep: "Topsporters, mental coaches, sportpsychologen.",
    start: { label: "Start T4Sports", route: "/t4sports", direct: true },
    rapportTeaser:
      "Een volledig T4Sports Mental Talent Profiel (Deel 1 + Deel 2) als PDF en online dashboard, met optionele module-uitbreidingen.",
    icoon: "Trophy",
  },
  {
    id: "t4kids",
    naam: "T4Kids",
    orientatie: "education",
    eyebrow: "Kinderen · talentontdekking",
    omschrijving:
      "Een speels, leeftijdsspecifiek talentprofiel voor kinderen, in eenvoudige en beeldende taal, dat helpt om talenten en interesses vroeg zichtbaar te maken.",
    beantwoordt:
      "Waar word ik blij van? Waar ben ik goed in? Wat geeft mij energie op school en in mijn vrije tijd?",
    gebruik:
      "Voor vroege talentherkenning, ouder-kindgesprekken over interesses en een positieve start van studiekeuzeoriëntatie.",
    doelgroep: "Kinderen 11–13 jaar, ouders, leerkrachten en zorgcoördinatoren.",
    start: { label: "Ontdek T4Kids", route: "/studie/leerlingen", direct: false },
    rapportTeaser:
      "Een kindvriendelijke T4Kids talentkaart met herkenbare beelden, die talenten en interesses in eenvoudige taal weergeeft.",
    leeftijdsfocus: "11–13 jaar",
    icoon: "Sparkles",
  },
  {
    id: "t4teens",
    naam: "T4Teens",
    orientatie: "education",
    eyebrow: "Jongeren · studiekeuze",
    omschrijving:
      "Een leeftijdsspecifiek talentprofiel voor tieners, in toegankelijke taal, dat helpt bij studiekeuze en talentherkenning in het secundair onderwijs.",
    beantwoordt:
      "Waar liggen mijn talenten als jongere? Welke studierichting past bij wie ik ben? Wat geeft mij energie op school en daarbuiten?",
    gebruik:
      "Voor studiekeuzebegeleiding, talentherkenning in het secundair, preventie van studiedropout en ouder-kindgesprekken over richting.",
    doelgroep: "Jongeren 13–17 jaar, CLB-begeleiders, schoolcoaches.",
    start: { label: "Ontdek T4Teens", route: "/studie/leerlingen", direct: false },
    rapportTeaser:
      "Een T4Teens talentkaart in jongerentaal, met studierichtingssuggesties op basis van de talent-foci.",
    leeftijdsfocus: "13–17 jaar",
    icoon: "Backpack",
  },
  {
    id: "t4students",
    naam: "T4Students",
    orientatie: "education",
    eyebrow: "Studenten · loopbaanstart",
    omschrijving:
      "Een talentprofiel afgestemd op de overgang van studie naar arbeidsmarkt, voor studenten in het hoger onderwijs en hun begeleiders.",
    beantwoordt:
      "Bevestigt mijn studiekeuze wie ik ben? Welke jobdomeinen sluiten aan bij mijn talent? Hoe formuleer ik mijn sterktes richting stage en eerste job?",
    gebruik:
      "Voor studierichtingsbevestiging of -bijsturing, voorbereiding op het stagezoekproces, eerste loopbaanoriëntatie en persoonlijke ontwikkeling.",
    doelgroep: "Studenten 17–23 jaar, studentenbegeleiders.",
    start: { label: "Ontdek T4Students", route: "/studie/leerlingen", direct: false },
    rapportTeaser:
      "Een T4Students talentpaspoort met jobdomein-mapping en een eerste LinkedIn-formulering voor de start op de arbeidsmarkt.",
    leeftijdsfocus: "17–23 jaar",
    icoon: "GraduationCap",
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Kleur-CSS-variabele per oriëntatie (hergebruikt bestaande --werk/--studie). */
export function orientatieKleurVar(o: Orientatie): { primair: string; secundair?: string } {
  switch (o) {
    case "business":
      return { primair: "--werk" };
    case "education":
      return { primair: "--studie" };
    case "sport":
      // Eigen sportieve categorie — energiek oranje (geen bestaande CSS-var,
      // wordt in de pagina/PDF als vaste hsl/hex-tint gezet).
      return { primair: "--sport" };
    case "beide":
      // Duo: links werk (business), rechts studie (education) — gesplitste rand.
      return { primair: "--werk", secundair: "--studie" };
  }
}

/** Menselijk leesbaar label per oriëntatie. */
export function orientatieLabel(o: Orientatie): string {
  switch (o) {
    case "business":
      return "Business";
    case "education":
      return "Education";
    case "sport":
      return "Sport";
    case "beide":
      return "Business & Education";
  }
}

/** Zoek een instrument op canoniek id. */
export function vindInstrument(id: string): GidsInstrument | undefined {
  return INSTRUMENTENGIDS.find((i) => i.id === id);
}
