// ---------------------------------------------------------------------------
// shared/toc-kompas.ts
//
// Gedeelde inhoud en contracten van het TOC Commitmentkompas in TaPas CORE.
// Server, invulscherm en rapporten lezen dezelfde vragen, domeinen, labels en
// regels uit dit bestand, zodat een Captain op het scherm exact dezelfde vraag
// ziet als in het gedrukte kompas.
//
// BRON. Alle vraagteksten, hulpteksten, domeinen en signaaldefinities komen
// letterlijk uit het document "TaPas TOC Commitmentkompas" (secties 5 tot en
// met 11). Enkel streepjes in titels zijn vervangen door een komma of het
// woord "tot", conform de huisstijl van het platform.
//
// CIRKEL. Het Team of Captains is een cirkel van vier gelijkwaardige Captains.
// De volgorde hieronder is enkel een weergavevolgorde en drukt geen rangorde
// uit. Nergens in deze module bestaat een rol boven een andere Captain.
//
// De server blijft de autoriteit: dit bestand legt vast welke waarden bestaan
// en welke invoer geldig is. De signalen worden berekend in
// server/toc-kompas/consolidatie.ts.
// ---------------------------------------------------------------------------
import { z } from "zod";

export const TOC_KOMPAS_MODULE_VERSIE = "toc-kompas-1.0.0";
export const TOC_KOMPAS_REGELVERSIE = "toc-kompas-signalen-1.0.0";

// ---- De constellatie van Captains ----------------------------------------------
export const CAPTAIN_ROLLEN = ["talent_innovation", "execution_horizon", "academy", "visibility"] as const;
export type CaptainRol = (typeof CAPTAIN_ROLLEN)[number];

export interface CaptainRolInfo {
  titel: string;
  standaardNaam: string;
  primaireWaarde: string;
  deliveryfocus: string;
  bedrijfsleidingfocus: string;
  grens: string;
}

export const CAPTAIN_ROL_INFO: Record<CaptainRol, CaptainRolInfo> = {
  talent_innovation: {
    titel: "Captain of Talent & Innovation",
    standaardNaam: "Marc",
    primaireWaarde: "Inhoudelijke en productmatige betekenis",
    deliveryfocus: "Talentdoctrine, productconcepten, innovatie, evidencekaders",
    bedrijfsleidingfocus: "Portfolio-inhoud, kwaliteitsgrenzen, innovatiekeuzes",
    grens: "Niet de enige kennisdrager of finale owner van alles",
  },
  execution_horizon: {
    titel: "Captain of Execution & Horizon",
    standaardNaam: "Andrea",
    primaireWaarde: "Samenhangende uitvoering en vooruitblik",
    deliveryfocus: "Roadmap, milestones, processen, afhankelijkheden",
    bedrijfsleidingfocus: "Prioritering, escalatie, horizonrisico’s, executieritme",
    grens: "Niet automatisch owner van alle uitvoering",
  },
  academy: {
    titel: "Captain of The Academy",
    standaardNaam: "Herman",
    primaireWaarde: "Schaalbare overdracht en kwaliteitsborging",
    deliveryfocus: "Curriculum, certificering, faculty, learning operations",
    bedrijfsleidingfocus: "Academystrategie, kwaliteitskaders, ecosysteem",
    grens: "Niet alleen event- of trainingsorganisatie",
  },
  visibility: {
    titel: "Captain of Visibility",
    standaardNaam: "Gina Peeters",
    primaireWaarde: "Gezicht en uithangbord; licht, helderheid en vertrouwen",
    deliveryfocus: "Narratief, proof library, visibility map, stakeholdercadans",
    bedrijfsleidingfocus: "Alignment, transparantie, reputatie, externe vertegenwoordiging",
    grens: "Niet alleen marketing; geen onbewezen claims; geen positie boven andere Captains",
  },
};

export const CIRKEL_TEKST =
  "Het Team of Captains werkt als een cirkel van gelijkwaardige Captains. Elke Captain draagt een eigen domein, is aanspreekbaar op eigen commitments en brengt een eigen invalshoek in de gezamenlijke besluiten. Geen Captain staat hiërarchisch boven een andere.";

export const INVULINSTRUCTIE =
  "Vul individueel in zonder vooraf de antwoorden van andere Captains te zien. Baseer capaciteit op de komende twee kwartalen. Schrijf wat werkelijk leverbaar is. Gebruik \"onbekend\" waar informatie ontbreekt. Formuleer maximaal vijf delivery- en vijf bedrijfsleidingcommitments per kwartaal.";

export const KERNREGEL =
  "Een percentage zonder uren is fictief. Een deliverable zonder eigenaar is vrijblijvend. Een eigenaar zonder beslissingsrecht is machteloos. Een commitment zonder stopkeuze veroorzaakt overbelasting.";

// ---- Sectie 5: de individuele vragenlijst ----------------------------------------
export interface Vraag {
  sleutel: string;
  label: string;
  hulp: string;
  soort?: "tekst" | "getal" | "keuze";
  opties?: readonly string[];
}

export const PERIODE_OPTIES = ["Kwartaal", "Halfjaar"] as const;
export const ZEKERHEID_OPTIES = ["Zeker", "Waarschijnlijk", "Onzeker"] as const;

export const VRAGEN_A: readonly Vraag[] = [
  { sleutel: "naam", label: "Naam Captain", hulp: "Naam en formele TOC-benaming." },
  { sleutel: "domein", label: "Captain-domein", hulp: "Het probleemgebied waarvoor je verantwoordelijkheid ervaart." },
  { sleutel: "periode", label: "Periode", hulp: "Kwartaal of halfjaar.", soort: "keuze", opties: PERIODE_OPTIES },
  { sleutel: "beschikbareUren", label: "Beschikbare capaciteit", hulp: "Realistische gemiddelde uren per week, inclusief overleg.", soort: "getal" },
  { sleutel: "capaciteitszekerheid", label: "Capaciteitszekerheid", hulp: "Zeker / waarschijnlijk / onzeker en externe beperkingen.", soort: "keuze", opties: ZEKERHEID_OPTIES },
  { sleutel: "zekerheidToelichting", label: "Externe beperkingen", hulp: "Welke externe beperkingen gelden voor je capaciteit?" },
  { sleutel: "succescriterium", label: "Persoonlijk succescriterium", hulp: "Welke aantoonbare verandering moet bestaan?" },
];

export const CAPACITEIT_CATEGORIEEN = [
  { sleutel: "delivery", label: "Delivery", uitleg: "Concrete outputs en operationele resultaten." },
  { sleutel: "bedrijfsleiding", label: "Bedrijfsleiding", uitleg: "Richting, resources, people, risico en governance." },
  { sleutel: "buffer", label: "Buffer", uitleg: "Onvoorzien werk; geen verborgen capaciteit." },
] as const;

export const VRAGEN_B: readonly Vraag[] = [
  { sleutel: "huidigeVerdeling", label: "Huidige verdeling", hulp: "Hoe verdeel je vandaag feitelijk je TaPas-tijd?" },
  { sleutel: "gewensteVerdeling", label: "Gewenste verdeling", hulp: "Welke verdeling vraagt TaPas 2.0?" },
  { sleutel: "verschil", label: "Verschil", hulp: "Wat moet stoppen, gedelegeerd, geautomatiseerd of ingekocht?" },
  { sleutel: "piekbelasting", label: "Piekbelasting", hulp: "Welke momenten veroorzaken structurele pieken?" },
  { sleutel: "minimumcontinuiteit", label: "Minimumcontinuïteit", hulp: "Wat mag niet stilvallen bij twee weken afwezigheid?" },
  { sleutel: "voorwaarden", label: "Voorwaarden", hulp: "Welke vergoeding, middelen of ondersteuning zijn nodig?" },
];

export const VRAGEN_C: readonly Vraag[] = [
  { sleutel: "topprioriteit", label: "Topprioriteit", hulp: "Welke delivery mag niet mislukken en waarom?" },
  { sleutel: "stopkeuze", label: "Stopkeuze", hulp: "Welk huidig werk stopt om ruimte te maken?" },
  { sleutel: "kwaliteitsgrens", label: "Kwaliteitsgrens", hulp: "Wat is goed genoeg en wat is onaanvaardbaar?" },
  { sleutel: "afhankelijkheden", label: "Afhankelijkheden", hulp: "Van wie, budget, data of beslissing ben je afhankelijk?" },
  { sleutel: "escalatie", label: "Escalatie", hulp: "Wanneer en naar wie escaleer je?" },
  { sleutel: "delegatie", label: "Delegatie", hulp: "Wat mag binnen zes maanden niet langer door jou worden uitgevoerd?" },
];

export const VRAGEN_D: readonly Vraag[] = [
  { sleutel: "uniekeBijdrage", label: "Unieke bijdrage", hulp: "Welke invalshoek moet jij in TOC-besluiten brengen?" },
  { sleutel: "enterpriseBovenDomein", label: "Enterprise boven domein", hulp: "Wanneer zet je eigen domeinbelang opzij?" },
  { sleutel: "beslissingskwaliteit", label: "Beslissingskwaliteit", hulp: "Welke data of tegenstem heb je nodig?" },
  { sleutel: "peopleLeadership", label: "People leadership", hulp: "Wie moet jij leiden, coachen of aanspreken?" },
  { sleutel: "governance", label: "Governance", hulp: "Welke informatie lever je aan TOC en raad van bestuur?" },
  { sleutel: "risico", label: "Risico", hulp: "Welke drie ondernemingsrisico’s signaleer je vroeg?" },
  { sleutel: "opvolging", label: "Opvolging", hulp: "Wie neemt tijdelijk over?" },
];

export const VRAGEN_E: readonly Vraag[] = [
  { sleutel: "nietMijnRol", label: "Niet mijn rol", hulp: "Welke taken of beslissingen wil je niet bezitten?" },
  { sleutel: "ontbrekendeExpertise", label: "Ontbrekende expertise", hulp: "Waar is aanvullende expertise nodig?" },
  { sleutel: "nietBeschikbaar", label: "Niet beschikbaar", hulp: "Welke tijd of situaties zijn niet inzetbaar?" },
  { sleutel: "nietOnderhandelbaar", label: "Niet onderhandelbaar", hulp: "Welke waarden, kwaliteit of wettelijke grenzen gelden?" },
  { sleutel: "overcommitmentsignaal", label: "Overcommitmentsignaal", hulp: "Waaraan merkt het team dat je te veel draagt?" },
  { sleutel: "heronderhandeling", label: "Heronderhandeling", hulp: "Wanneer moet jouw commitment formeel worden herzien?" },
];

export const VRAAGBLOKKEN = [
  { sleutel: "A", titel: "A. Identiteit en realiteit", vragen: VRAGEN_A },
  { sleutel: "B", titel: "B. Capaciteitsverdeling", vragen: VRAGEN_B },
  { sleutel: "C", titel: "C. Delivery commitments", vragen: VRAGEN_C },
  { sleutel: "D", titel: "D. Bedrijfsleiding commitments", vragen: VRAGEN_D },
  { sleutel: "E", titel: "E. Grenzen", vragen: VRAGEN_E },
] as const;

export const MAX_COMMITMENTS = 5;
export const RACI = ["A", "R", "C", "I"] as const;
export type Raci = (typeof RACI)[number];
export const RACI_OF_GEEN = ["A", "R", "C", "I", "geen"] as const;
export type RaciOfGeen = (typeof RACI_OF_GEEN)[number];
export const RACI_UITLEG =
  "A = Accountable en finaal aanspreekbaar; R = Responsible voor uitvoering; C = vooraf geconsulteerd; I = geïnformeerd. Per deliverable is er precies één A-owner.";

export const DELIVERY_KOLOMMEN = [
  { sleutel: "outcome", label: "Outcome / deliverable" },
  { sleutel: "ontvanger", label: "Ontvanger" },
  { sleutel: "bewijs", label: "Bewijs & acceptatie" },
  { sleutel: "deadline", label: "Deadline" },
] as const;
export const BEDRIJFSLEIDING_KOLOMMEN = [
  { sleutel: "uitkomst", label: "Leiderschapsuitkomst" },
  { sleutel: "beslissing", label: "Beslissing / kader" },
  { sleutel: "bewijs", label: "Bewijs" },
  { sleutel: "deadline", label: "Deadline" },
  { sleutel: "mandaat", label: "Mandaat" },
] as const;

// ---- Sectie 4 en 6: de negentien domeinen --------------------------------------------
export interface Domein {
  sleutel: string;
  naam: string;
  leiden: string;
  deliverables: string;
}

export const DOMEINEN: readonly Domein[] = [
  { sleutel: "purpose", naam: "Purpose & strategie", leiden: "Positionering, driejaarskeuzes, non-goals", deliverables: "Strategiekaart; jaarlijkse refresh" },
  { sleutel: "portfolio", naam: "Portfolio & prioritering", leiden: "Balans tussen de vier CORE entry points", deliverables: "Portfolio roadmap; stop/start/continue" },
  { sleutel: "product", naam: "Product & innovatie", leiden: "Discovery, UX, roadmap, releasekwaliteit, IP", deliverables: "Product charter; release gates" },
  { sleutel: "psychometrie", naam: "Psychometrie & kwaliteit", leiden: "Validiteit, betrouwbaarheid, normering, claims", deliverables: "Evidence framework; validation roadmap" },
  { sleutel: "technologie", naam: "Technologie", leiden: "Architectuur, integraties, uptime, technical debt", deliverables: "Tech roadmap; architecture decisions" },
  { sleutel: "data", naam: "Data, privacy & AI", leiden: "GDPR, DPIA, fairness, human oversight, AI Act", deliverables: "ROPA; DPIA; AI inventory; model cards" },
  { sleutel: "cyber", naam: "Cybersecurity", leiden: "Toegang, back-up, incidentrespons, leveranciers", deliverables: "Security baseline; recovery test" },
  { sleutel: "operations", naam: "Operations & delivery", leiden: "Capaciteit, QA, SLA, verbetercyclus", deliverables: "Delivery playbook; capacity board" },
  { sleutel: "customer", naam: "Customer success", leiden: "Adoptie, impact, renewals, feedback", deliverables: "Onboarding; health score; QBR" },
  { sleutel: "academy", naam: "Academy & ecosystem", leiden: "Certificering, curriculum, community, audit", deliverables: "Academy architecture; certification rubric" },
  { sleutel: "gtm", naam: "GTM & sales", leiden: "ICP, pricing, pipeline, partners, forecast", deliverables: "GTM-plan; CRM; win/loss review" },
  { sleutel: "visibility", naam: "Visibility & enterprise narrative", leiden: "Interne transparantie, externe positionering, bewijs, stakeholderalignment", deliverables: "Visibility map; message house; proof library; stakeholder cadence" },
  { sleutel: "brand", naam: "Brand & thought leadership", leiden: "Merk, content, PR, community en autoriteit", deliverables: "Editorial roadmap; brand governance" },
  { sleutel: "finance", naam: "Finance & funding", leiden: "Budget, cash, runway, unit economics, funding", deliverables: "Rolling forecast; cash dashboard" },
  { sleutel: "people", naam: "People & organisatie", leiden: "Org design, rollen, performance, opvolging", deliverables: "Org map; role charters; hiring plan" },
  { sleutel: "legal", naam: "Legal & governance", leiden: "Contracten, IP, verzekering, bevoegdheden", deliverables: "Delegatiematrix; compliance calendar" },
  { sleutel: "internationaal", naam: "Internationalisering", leiden: "Kanaal, partners, taal/marktfit, kwaliteit", deliverables: "Market-entry gates; localization playbook" },
  { sleutel: "risk", naam: "Risk & reputatie", leiden: "Enterprise risk, ethiek, crisis en claims", deliverables: "Risk appetite; issue protocol" },
  { sleutel: "performance", naam: "Performance & analytics", leiden: "North Star, KPI’s, datakwaliteit, ritme", deliverables: "Metric dictionary; dashboard" },
];
export const DOMEIN_SLEUTELS = DOMEINEN.map((d) => d.sleutel);

export const DEKKINGSSCAN_INTRO =
  "Scoor elk domein vanuit je persoonlijke perspectief. De score is geen beoordeling van personen, maar een hypothese voor de gezamenlijke workshop.";

// ---- Sectie 7: Captain-specifieke reflectie ------------------------------------------
export const REFLECTIE: Record<CaptainRol, readonly string[]> = {
  talent_innovation: [
    "Welke product- en inhoudskeuzes mogen nooit uitsluitend in één hoofd blijven?",
    "Welke TaPas-doctrine, constructdefinities, scoringslogica en interpretatiegrenzen moeten versieerbaar worden vastgelegd?",
    "Welke CORE-onderdelen vragen persoonlijke kwaliteitsgoedkeuring en welke kunnen via gates door anderen worden vrijgegeven?",
    "Welke innovatie is kern voor twaalf maanden en wat wordt geparkeerd?",
    "Welke claims zijn voldoende onderbouwd, voorlopig of niet toegestaan?",
    "Welke opvolger, product lead of reviewgroep verlaagt founder-dependency?",
    "Hoeveel tijd is werkelijk beschikbaar voor discovery, specificatie, testen en TOC-besluiten?",
  ],
  execution_horizon: [
    "Welke enterprise roadmap verbindt strategie, product, Academy, commercie, financiering en boardverplichtingen?",
    "Welke milestones en afhankelijkheden moeten tweewekelijks zichtbaar zijn?",
    "Welke beslissingen mogen autonoom en welke vragen TOC- of boardbesluit?",
    "Hoe wordt investeerderscommunicatie één controleerbaar verhaal?",
    "Welke processen moeten van ad hoc naar herhaalbaar?",
    "Waar dreigt de Captain zelf bottleneck te worden?",
    "Welke horizonrisico’s vereisen nu actie?",
  ],
  academy: [
    "Welke rol speelt Academy in omzet, kwaliteit, adoptie en internationale schaal?",
    "Wat zijn meetbare eindkwalificaties en wie bewaakt hercertificering?",
    "Welke curricula worden digitaal schaalbaar?",
    "Hoe wordt interpretatie-afwijking bij facilitators voorkomen?",
    "Hoe stroomt feedback terug naar product en psychometrie?",
    "Welke delivery en bedrijfsleiding worden persoonlijk gedragen?",
    "Welke faculty-, operations- of communityrol is nodig?",
  ],
  visibility: [
    "Wat is vandaag binnen TaPas belangrijk maar onvoldoende zichtbaar, voor de TOC, medewerkers, partners, klanten of raad van bestuur?",
    "Welke verschillen bestaan tussen wat TaPas intern weet, extern beweert en daadwerkelijk kan bewijzen?",
    "Welk enterprise narrative verbindt purpose, talentdoctrine, TaPas CORE, Academy, cases, commerciële waarde en maatschappelijke relevantie?",
    "Welke drie doelgroepen verdienen in de komende twee kwartalen prioritaire zichtbaarheid, en welk concreet gedrag of besluit moet daardoor veranderen?",
    "Welke informatie moet maandelijks zichtbaar zijn om betere beslissingen mogelijk te maken: cash, pipeline, product, klantwaarde, bewijs, people, risico of delivery?",
    "Waar dreigt visibility te verworden tot \"meer communicatie\" zonder betere keuzes, conversie, vertrouwen of alignment?",
    "Welke claims mogen zichtbaar worden gemaakt, welke vereisen kwalificatie en welke mogen nog niet worden gebruikt?",
    "Hoe wordt informatie opgehaald bij Marc, Andrea, Herman en domeinowners zonder dat Gina een redactionele of besluitvormende bottleneck wordt?",
    "Welke onderwerpen moeten in stilte worden ontwikkeld en welke vragen vroegtijdige transparantie?",
    "Hoe worden moeilijke signalen, conflicten, vertragingen en rode risico’s zichtbaar zonder schuld- of reputatiecultuur?",
    "Welke beslissingen moet Gina autonoom mogen nemen en welke vereisen afstemming met domeinowner, TOC of raad van bestuur?",
    "Bij welke stakeholders, podia en momenten moet jij het gezicht van TaPas zijn, en wanneer treedt een andere Captain naar voren als inhoudelijke eigenaar?",
    "Hoe voorkom je dat zichtbaarheid naar buiten wordt gelezen als hiërarchie naar binnen, en hoe blijft de cirkel zichtbaar in alles wat je vertegenwoordigt?",
    "Wie neemt tijdelijk over bij afwezigheid en welke systemen voorkomen dat zichtbaarheid persoonsafhankelijk wordt?",
  ],
};

/** Business Development is nog niet belegd: elke Captain mag hier optioneel op antwoorden. */
export const REFLECTIE_BD_TITEL = "Business Development, fase 2 / nog te beleggen";
export const REFLECTIE_BD: readonly string[] = [
  "Wie bezit intussen ICP, pipeline, pricing, partnerships en forecast?",
  "Wanneer eindigt de tijdelijke verdeling?",
  "Welke marktvalidatie is nodig vóór aanwerving?",
  "Wie verkoopt, sluit contracten en bewaakt deliveryhaalbaarheid?",
  "Welke markten en partners passen bij de fase-1 focus?",
  "Welke claims vereisen voorafgaande product/psychometrie/legal-vrijgave?",
  "Hoe werken Captain of Visibility en de toekomstige commerciële owner samen zonder dat zichtbaarheid en omzetverantwoordelijkheid worden vermengd?",
];

/** Rolbedoeling en grenzen van Visibility: getoond als oriëntatie bij de reflectie. */
export const VISIBILITY_ROLBEDOELING =
  "Gina is het licht van TaPas 2.0 en het gezicht en uithangbord van de organisatie. Zij maakt zichtbaar wat intern of extern onzichtbaar, impliciet, versnipperd, onderbenut of onvoldoende begrepen blijft.";
export const VISIBILITY_GRENZEN: readonly string[] = [
  "Visibility is geen vervanging voor psychometrische validatie, product ownership, sales ownership, finance controls of wettelijke verantwoordelijkheid.",
  "Gina mag geen inhoudelijke claim goedkeuren zonder de bevoegde product-, psychometrie-, privacy-, legal- of security-eigenaar.",
  "Zichtbaarheid betekent niet dat alle informatie publiek wordt; vertrouwelijkheid, timing, need-to-know en governance blijven gelden.",
  "Het gezicht en uithangbord zijn geeft geen statutaire, hiërarchische of budgettaire bevoegdheden en geen positie boven andere Captains. Beslissingsrechten blijven bij de domeinowners en het TOC als geheel.",
];

// ---- Sectie 8: de commitmentkaart ------------------------------------------------------
export const COMMITMENT_TYPES = ["delivery", "bedrijfsleiding"] as const;
export type CommitmentType = (typeof COMMITMENT_TYPES)[number];
export const COMMITMENT_TYPE_LABEL: Record<CommitmentType, string> = { delivery: "Delivery", bedrijfsleiding: "Bedrijfsleiding" };

export const COMMITMENT_STATUSSEN = ["groen", "amber", "rood", "geblokkeerd"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSSEN)[number];
export const COMMITMENT_STATUS_LABEL: Record<CommitmentStatus, string> = {
  groen: "Groen",
  amber: "Amber",
  rood: "Rood",
  geblokkeerd: "Geblokkeerd",
};

/** De velden van de kaart, in de volgorde en met de hulptekst van sectie 8. */
export const KAART_VELDEN = [
  { sleutel: "objective", label: "Objective", hulp: "Welke betekenisvolle verandering wordt gerealiseerd?" },
  { sleutel: "deliverable", label: "Deliverable / Key Result", hulp: "Welk verifieerbaar resultaat bestaat?" },
  { sleutel: "baselineTarget", label: "Baseline → target", hulp: "Van huidige status naar doelstatus." },
  { sleutel: "responsible", label: "Responsible", hulp: "Wie voert uit?" },
  { sleutel: "consultedInformed", label: "Consulted / informed", hulp: "Wie vooraf en achteraf betrekken?" },
  { sleutel: "deadline", label: "Deadline / gates", hulp: "Datum en tussentijdse review." },
  { sleutel: "acceptatiebewijs", label: "Acceptatiebewijs", hulp: "Link, document, release, contract, meting of besluit." },
  { sleutel: "capaciteit", label: "Capaciteit", hulp: "Uren/week en totaal." },
  { sleutel: "beslissingsrecht", label: "Beslissingsrecht", hulp: "Wat mag owner zelfstandig beslissen?" },
  { sleutel: "budget", label: "Budget / resources", hulp: "Beschikbaar en nog te beslissen." },
  { sleutel: "dependencies", label: "Dependencies", hulp: "Mensen, data, leverancier of boardbesluit." },
  { sleutel: "toprisico", label: "Toprisico", hulp: "Risico plus mitigatie." },
  { sleutel: "stopkeuze", label: "Stopkeuze", hulp: "Welk ander werk wordt niet gedaan?" },
  { sleutel: "heronderhandeling", label: "Heronderhandeling", hulp: "Wanneer mogen scope, datum of owner wijzigen?" },
] as const;
export type KaartVeld = (typeof KAART_VELDEN)[number]["sleutel"];

/** Velden die volgens de acceptatiecriteria (sectie 13) niet leeg mogen zijn. */
export const KAART_VERPLICHT_VOOR_VASTSTELLING: readonly KaartVeld[] = [
  "deliverable",
  "acceptatiebewijs",
  "deadline",
  "capaciteit",
  "beslissingsrecht",
  "stopkeuze",
];

// ---- Sectie 9: scoring en signalen -------------------------------------------------------
export const DEKKINGSSCORES = [
  { score: 0, label: "0, Niet gedekt", betekenis: "Kritiek gat", criteria: "Geen owner, capaciteit of deliverable." },
  { score: 1, label: "1, Benoemd", betekenis: "Papieren dekking", criteria: "Naam genoemd, maar mandaat/capaciteit/bewijs ontbreekt." },
  { score: 2, label: "2, Gepland", betekenis: "Werkbare hypothese", criteria: "Owner en output bestaan; afhankelijkheden onzeker." },
  { score: 3, label: "3, Operationeel", betekenis: "Aantoonbare dekking", criteria: "Owner, mandaat, capaciteit, bewijs en cadans werken." },
  { score: 4, label: "4, Schaalbaar", betekenis: "Niet persoonsafhankelijk", criteria: "Plus back-up, documentatie, dashboard en verbetercyclus." },
] as const;

export const SIGNAAL_SOORTEN = ["rood", "oranje", "geel", "blauw"] as const;
export type SignaalSoort = (typeof SIGNAAL_SOORTEN)[number];
export const SIGNAAL_INFO: Record<SignaalSoort, { label: string; definitie: string; actie: string; kleur: string }> = {
  rood: { label: "ROOD, gat", definitie: "Kritiek domein zonder A-owner of capaciteit.", actie: "Interim-owner, scope schrappen of expertise inkopen.", kleur: "#B42318" },
  oranje: { label: "ORANJE, conflict", definitie: "Meer dan één A-owner of botsende rechten.", actie: "Splits output of wijs één finale owner aan.", kleur: "#E8912F" },
  geel: { label: "GEEL, overcommitment", definitie: "Uren overschrijden capaciteit minus buffer.", actie: "Stop, delegeer, verschuif of herprioriteer.", kleur: "#D19900" },
  blauw: { label: "BLAUW, key-person", definitie: "Kritische kennis zonder back-up.", actie: "Documenteer, cross-train en plaatsvervanger.", kleur: "#006494" },
};
export const GEEN_GEMIDDELDE =
  "Gebruik geen gemiddelde totaalscore om rode gaten te verbergen. Een hoog gemiddelde compenseert geen ontbrekende cashbewaking, privacy, security, kwaliteit, commerciële eigenaar of enterprise visibility.";

// ---- Sectie 10: de alignment workshop ----------------------------------------------------
export const WORKSHOP_VOORBEREIDING: readonly string[] = [
  "Iedere Captain vult zelfstandig in en levert 48 uur vooraf aan.",
  "Een neutrale facilitator consolideert capaciteit, commitments, A/R/C/I, gaten en conflicten.",
  "Markeer geplande capaciteit boven 90%, dubbele A-owners en key-person risks.",
  "Leg strategie, budgetgrenzen, roadmap en reserved matters zichtbaar op tafel.",
];
export const WORKSHOP_AGENDA = [
  { tijd: "0 tot 15", onderdeel: "Doel en spelregels", output: "Gezamenlijk kader" },
  { tijd: "15 tot 35", onderdeel: "Stille lezing verschillen", output: "Feiten vóór debat" },
  { tijd: "35 tot 65", onderdeel: "Capaciteit en percentages", output: "Realistische verdeling" },
  { tijd: "65 tot 105", onderdeel: "Coverage heatmap", output: "A-owner, gaps, externe behoeften" },
  { tijd: "105 tot 135", onderdeel: "Top 8 commitments", output: "Outcome, owner, bewijs, deadline" },
  { tijd: "135 tot 155", onderdeel: "Beslisrechten", output: "Delegatie- en escalatievoorstel" },
  { tijd: "155 tot 170", onderdeel: "Stop/delegate/hire/buy", output: "Vrijgemaakte capaciteit" },
  { tijd: "170 tot 180", onderdeel: "Hard commitment", output: "Getekend register" },
] as const;
export const BESLUITREGELS: readonly string[] = [
  "Eén A-owner per deliverable.",
  "Geen nieuw commitment zonder capaciteit of stopkeuze.",
  "Rode risico’s krijgen owner, mitigatie en deadline of formele acceptatie.",
  "Reserved matters worden als voorstel aan de bevoegde raad van bestuur voorgelegd.",
  "Een decision log noteert datum, beslisser, rationale, aannames, gevolgen en reviewmoment.",
  "Visibility maakt besluitvorming traceerbaar, maar verandert niet wie bevoegd is te beslissen.",
];

// ---- Sectie 13: acceptatiecriteria -------------------------------------------------------
export const ACCEPTATIECRITERIA = [
  { sleutel: "capaciteit100", tekst: "Elke Captain heeft uren en percentages die optellen tot 100%.", automatisch: true },
  { sleutel: "aOwners", tekst: "Alle kritieke domeinen hebben nul of één A-owner; nul is zichtbaar rood.", automatisch: true },
  { sleutel: "commitmentsVolledig", tekst: "Commitments bevatten outcome, bewijs, datum, capaciteit, mandaat en stopkeuze.", automatisch: true },
  { sleutel: "belegd", tekst: "Finance, product/evidence, commercial, technology/security/privacy, people, customer value en enterprise visibility zijn belegd.", automatisch: true },
  { sleutel: "tocRvb", tekst: "TOC en raad van bestuur zijn niet vermengd.", automatisch: false },
  { sleutel: "ritme", tekst: "Voortgang, besluiten, risico en kwartaalherijking hebben een werkend ritme.", automatisch: false },
  { sleutel: "keyPerson", tekst: "Key-person risks hebben documentatie, back-up of tijdelijke uitzondering.", automatisch: false },
  { sleutel: "visibilityCharter", tekst: "Captain of Visibility heeft een expliciet charter, bewijsgrenzen, beslisrechten en escalatiepad.", automatisch: false },
  { sleutel: "cirkel", tekst: "Het TOC werkt als cirkel: geen Captain staat hiërarchisch boven een andere en beslisrechten zijn per domein en voor het TOC als geheel vastgelegd.", automatisch: false },
] as const;
export type AcceptatieSleutel = (typeof ACCEPTATIECRITERIA)[number]["sleutel"];
/** Domeinen die voor het criterium "belegd" een vastgestelde A-owner moeten hebben. */
export const BELEGD_DOMEINEN = ["finance", "psychometrie", "product", "gtm", "technologie", "cyber", "data", "people", "customer", "visibility"] as const;

// ---- Ronde en statussen ---------------------------------------------------------------------
export const RONDE_STATUSSEN = ["INTAKE", "CONSOLIDATIE", "VASTGESTELD", "AFGESLOTEN"] as const;
export type RondeStatus = (typeof RONDE_STATUSSEN)[number];
export const RONDE_STATUS_LABEL: Record<RondeStatus, string> = {
  INTAKE: "Nulmeting loopt",
  CONSOLIDATIE: "Consolidatie en workshop",
  VASTGESTELD: "Register vastgesteld",
  AFGESLOTEN: "Kwartaal afgesloten",
};

export const RAPPORT_TYPES = ["captain-charter", "workshopdossier", "commitment-register", "kwartaalscorecard"] as const;
export type RapportType = (typeof RAPPORT_TYPES)[number];
export const RAPPORT_TYPE_LABEL: Record<RapportType, string> = {
  "captain-charter": "Captain Charter",
  workshopdossier: "Workshopdossier alignment (180 minuten)",
  "commitment-register": "Commitment Register, Coverage Matrix en Decision Log",
  kwartaalscorecard: "Kwartaalscorecard",
};

// ---- Invoerschema's ---------------------------------------------------------------------------
const tekst = (max = 4000) => z.string().max(max).default("");
const getal = z.number().finite().min(0).max(168).nullable().default(null);
const pct = z.number().finite().min(0).max(100).nullable().default(null);

export const deliveryRijSchema = z.object({
  outcome: tekst(600),
  ontvanger: tekst(300),
  bewijs: tekst(600),
  deadline: tekst(100),
  uren: getal,
  raci: z.enum(["", ...RACI]).default(""),
});
export type DeliveryRij = z.infer<typeof deliveryRijSchema>;

export const bedrijfsleidingRijSchema = z.object({
  uitkomst: tekst(600),
  beslissing: tekst(600),
  bewijs: tekst(600),
  deadline: tekst(100),
  uren: getal,
  mandaat: tekst(300),
});
export type BedrijfsleidingRij = z.infer<typeof bedrijfsleidingRijSchema>;

export const dekkingRijSchema = z.object({
  mijnRol: z.enum(["", ...RACI_OF_GEEN]).default(""),
  gewensteRol: z.enum(["", ...RACI_OF_GEEN]).default(""),
  urenPerMaand: z.number().finite().min(0).max(744).nullable().default(null),
  zekerheid: z.number().int().min(1).max(5).nullable().default(null),
  ontbrekend: tekst(600),
});
export type DekkingRij = z.infer<typeof dekkingRijSchema>;

export const antwoordenSchema = z.object({
  velden: z.record(z.string().max(60), z.string().max(4000)).default({}),
  capaciteit: z
    .object({ delivery: pct, bedrijfsleiding: pct, buffer: pct })
    .default({ delivery: null, bedrijfsleiding: null, buffer: null }),
  delivery: z.array(deliveryRijSchema).max(MAX_COMMITMENTS).default([]),
  bedrijfsleiding: z.array(bedrijfsleidingRijSchema).max(MAX_COMMITMENTS).default([]),
  dekking: z.record(z.string().max(40), dekkingRijSchema).default({}),
  reflectie: z.record(z.string().max(40), z.string().max(4000)).default({}),
});
export type Antwoorden = z.infer<typeof antwoordenSchema>;

export function legeAntwoorden(): Antwoorden {
  return antwoordenSchema.parse({});
}

const PERIODE_RE = /^20\d{2}-Q[1-4]$/;

export const maakRondeSchema = z.object({
  titel: z.string().trim().min(3).max(160),
  periode: z.string().trim().regex(PERIODE_RE, "Gebruik de vorm JJJJ-Qn, bijvoorbeeld 2026-Q4."),
  deadline: z.string().trim().max(40).default(""),
  captains: z
    .array(
      z.object({
        rol: z.enum(CAPTAIN_ROLLEN),
        naam: z.string().trim().min(1).max(120),
        email: z.string().trim().max(200).default(""),
      }),
    )
    .length(4),
});
export type MaakRondeInvoer = z.infer<typeof maakRondeSchema>;

export const conceptSchema = z.object({ antwoorden: antwoordenSchema, versie: z.number().int().min(0) });
export const indienSchema = z.object({ antwoorden: antwoordenSchema, bevestig: z.literal(true) });

export const vergrendelSchema = z.object({ reden: z.string().trim().max(600).default("") });

export const commitmentSchema = z.object({
  type: z.enum(COMMITMENT_TYPES),
  ownerCaptainId: z.number().int().positive(),
  domein: z.enum(["", ...DOMEINEN.map((d) => d.sleutel)] as [string, ...string[]]).default(""),
  objective: tekst(1000),
  deliverable: tekst(1000),
  baselineTarget: tekst(600),
  responsible: tekst(300),
  consultedInformed: tekst(300),
  deadline: tekst(200),
  acceptatiebewijs: tekst(600),
  capaciteit: tekst(200),
  urenPerWeek: getal,
  beslissingsrecht: tekst(600),
  budget: tekst(600),
  dependencies: tekst(600),
  toprisico: tekst(600),
  stopkeuze: tekst(600),
  status: z.enum(COMMITMENT_STATUSSEN).default("groen"),
  heronderhandeling: tekst(600),
  bronIndieningId: z.number().int().positive().nullable().default(null),
});
export type CommitmentInvoer = z.infer<typeof commitmentSchema>;
export const commitmentWijzigSchema = commitmentSchema.extend({ versie: z.number().int().min(1) });
export const commitmentStatusSchema = z.object({ status: z.enum(COMMITMENT_STATUSSEN), toelichting: z.string().trim().max(600).default(""), versie: z.number().int().min(1) });

export const besluitSchema = z.object({
  datum: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik de vorm JJJJ-MM-DD."),
  onderwerp: z.string().trim().min(3).max(300),
  besluit: z.string().trim().min(3).max(2000),
  beslisser: z.string().trim().min(2).max(200),
  rationale: tekst(2000),
  aannames: tekst(1000),
  gevolgen: tekst(1000),
  reviewmoment: tekst(200),
  vervangtBesluitId: z.number().int().positive().nullable().default(null),
});
export type BesluitInvoer = z.infer<typeof besluitSchema>;

export const coverageRijSchema = z.object({
  domein: z.enum(DOMEINEN.map((d) => d.sleutel) as [string, ...string[]]),
  aOwner: z.string().trim().max(200).default(""),
  aOwnerCaptainId: z.number().int().positive().nullable().default(null),
  score: z.number().int().min(0).max(4).nullable().default(null),
  actie: z.string().trim().max(600).default(""),
});
export type CoverageRij = z.infer<typeof coverageRijSchema>;
export const coverageSchema = z.object({ rijen: z.array(coverageRijSchema).max(DOMEINEN.length), versie: z.number().int().min(0) });

export const acceptatieSchema = z.object({
  handmatig: z.record(z.string().max(40), z.boolean()).default({}),
  versie: z.number().int().min(0),
});

export const vaststelSchema = z.object({ bevestig: z.literal(true), toelichting: z.string().trim().max(600).default("") });
export const afsluitSchema = z.object({ bevestig: z.literal(true), toelichting: z.string().trim().max(1000).default("") });

// ---- Hulpfuncties die scherm en server delen -----------------------------------------------
export function getalOfNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function beschikbareUren(a: Antwoorden): number | null {
  return getalOfNull(a.velden?.beschikbareUren);
}

export function capaciteitSom(a: Antwoorden): number | null {
  const { delivery, bedrijfsleiding, buffer } = a.capaciteit;
  if (delivery === null || bedrijfsleiding === null || buffer === null) return null;
  return Math.round((delivery + bedrijfsleiding + buffer) * 100) / 100;
}

/** Uren per week voor een percentage van de beschikbare capaciteit, op een decimaal. */
export function urenVoor(percentage: number | null, uren: number | null): number | null {
  if (percentage === null || uren === null) return null;
  return Math.round(percentage * uren) / 100;
}

export function isLeeg(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "onbekend";
}

/** Een rij telt mee zodra er een outcome of uitkomst staat. */
export function deliveryRijenGevuld(a: Antwoorden): DeliveryRij[] {
  return a.delivery.filter((r) => r.outcome.trim() !== "");
}
export function bedrijfsleidingRijenGevuld(a: Antwoorden): BedrijfsleidingRij[] {
  return a.bedrijfsleiding.filter((r) => r.uitkomst.trim() !== "");
}

/**
 * De controles bij indienen. Gebaseerd op de spelregels van het kompas:
 * percentages zonder uren worden niet aanvaard en de som is 100%. Wat
 * ontbreekt, mag "onbekend" zijn; het blokkeert niet, maar wordt zichtbaar.
 */
export function indienFouten(a: Antwoorden): string[] {
  const f: string[] = [];
  const uren = beschikbareUren(a);
  if (uren === null || uren <= 0) f.push("Vul bij A de beschikbare capaciteit in uren per week in. Percentages zonder uren worden niet aanvaard.");
  const som = capaciteitSom(a);
  if (som === null) f.push("Vul bij B de drie percentages in: delivery, bedrijfsleiding en buffer.");
  else if (Math.abs(som - 100) > 0.01) f.push(`Delivery, bedrijfsleiding en buffer tellen samen op tot ${som}%. Dat moet 100% zijn.`);
  if (isLeeg(a.velden?.naam)) f.push("Vul bij A je naam en formele TOC-benaming in.");
  a.delivery.forEach((r, i) => {
    if (r.outcome.trim() !== "" && r.uren === null) f.push(`Delivery commitment ${i + 1} heeft geen uren per week.`);
  });
  a.bedrijfsleiding.forEach((r, i) => {
    if (r.uitkomst.trim() !== "" && r.uren === null) f.push(`Bedrijfsleiding commitment ${i + 1} heeft geen uren per week.`);
  });
  return f;
}

/** Hoeveel van de vragenlijst is ingevuld, als hulp voor de Captain (geen score). */
export function voortgang(a: Antwoorden, rol: CaptainRol): { ingevuld: number; totaal: number } {
  const vragen = [...VRAGEN_A, ...VRAGEN_B, ...VRAGEN_C, ...VRAGEN_D, ...VRAGEN_E];
  let ingevuld = vragen.filter((v) => !isLeeg(a.velden?.[v.sleutel])).length;
  let totaal = vragen.length;
  totaal += 3;
  ingevuld += (["delivery", "bedrijfsleiding", "buffer"] as const).filter((k) => a.capaciteit[k] !== null).length;
  totaal += DOMEINEN.length;
  ingevuld += DOMEINEN.filter((d) => (a.dekking?.[d.sleutel]?.mijnRol ?? "") !== "").length;
  const refl = REFLECTIE[rol];
  totaal += refl.length;
  ingevuld += refl.filter((_, i) => !isLeeg(a.reflectie?.[`r${i + 1}`])).length;
  return { ingevuld, totaal };
}

/** Commitment-ID volgens sectie 8: TOC-YYYY-QX-###. */
export function commitmentCode(periode: string, volgnummer: number): string {
  return `TOC-${periode}-${String(volgnummer).padStart(3, "0")}`;
}
