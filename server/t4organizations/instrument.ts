/**
 * TaPas 4 Organizations — instrumentdefinitie.
 * ------------------------------------------------------------------
 * Server-antwoord voor GET /api/t4o/instrument. Bevat de 57 productie-items
 * (LETTERLIJK overgenomen uit _t4o-spec/T4O-ITEMBANK-definitief.md — de door
 * Marc aangeleverde autoritatieve vragenbron), de response-schalen, de
 * choiceSets en de schermvolgorde (sections).
 *
 * Ring-mapping (uit itembank + contract):
 *   R1 leiding/kernteam   -> 'binnen'
 *   R2 medewerkers        -> 'midden'
 *   R3 externe stakeholders -> 'buiten' (enkel i7, i8, i51)
 *
 * De 8 collectieve vermogens leven in het `dimensie`-veld (datamodel), NIET
 * zichtbaar in de prompts (mensentaal-regel uit de itembank).
 */

export type Ring = "binnen" | "midden" | "buiten";
export type Niveau = "ORG" | "TEAM";
export type ItemType =
  | "likert"
  | "congruence"
  | "energy"
  | "battery"
  | "forced-choice-single"
  | "forced-choice-multi"
  | "forced-choice-rank";

export interface T4OItem {
  id: string;
  rings: Ring[];
  itemType: ItemType;
  prompt: { nl: string };
  dimensie: string;
  niveau: Niveau;
  reverse?: boolean;
  gapGroup?: string;
  choiceSet?: string;
  select?: number;
  rank?: number;
}

export interface T4OSection {
  type: string;
  ringOnly?: Ring;
  items: string[];
  instructions: { nl: string };
}

export interface T4OChoiceOption {
  value: string;
  label: { nl: string };
}

// ---- Response-schalen -------------------------------------------------------
const responseScales = {
  agree5: {
    options: [
      { value: 1, label: { nl: "Helemaal oneens" } },
      { value: 2, label: { nl: "Oneens" } },
      { value: 3, label: { nl: "Neutraal" } },
      { value: 4, label: { nl: "Eens" } },
      { value: 5, label: { nl: "Helemaal eens" } },
    ],
  },
  energyBalance: {
    options: [
      { value: -1, label: { nl: "Kost energie" } },
      { value: 0, label: { nl: "Neutraal" } },
      { value: 1, label: { nl: "Geeft energie" } },
    ],
  },
  battery: { min: 0, max: 10 },
};

// Conditionele oorzaak-chips bij een ENE-item dat "kost energie" krijgt.
const energyCauseChips = [
  { value: "tijd", label: { nl: "Te veel tijd" } },
  { value: "onduidelijkheid", label: { nl: "Onduidelijkheid" } },
  { value: "inspraak", label: { nl: "Te weinig inspraak" } },
  { value: "bureaucratie", label: { nl: "Bureaucratie" } },
  { value: "traagheid", label: { nl: "Traagheid" } },
  { value: "anders", label: { nl: "Anders" } },
];

// ---- ChoiceSets (LETTERLIJK uit itembank) -----------------------------------
const choiceSets: Record<string, T4OChoiceOption[]> = {
  // item 46 — 4 opties A/B/C/D
  cs_ambidex: [
    { value: "A", label: { nl: "We zijn vooral sterk in betrouwbaar uitvoeren." } },
    { value: "B", label: { nl: "We zijn vooral sterk in vernieuwen." } },
    { value: "C", label: { nl: "We zijn even sterk in beide en combineren ze bewust." } },
    { value: "D", label: { nl: "We worstelen om beide tegelijk te doen." } },
  ],
  // item 52 — 8 waardecreatie-archetypen (rangschik top 3)
  cs_archetypen: [
    { value: "leveren_schaal", label: { nl: "Betrouwbaar leveren op schaal" } },
    { value: "radicaal_vernieuwen", label: { nl: "Radicaal vernieuwen" } },
    { value: "klantrelaties", label: { nl: "Diepe klantrelaties" } },
    { value: "vakmanschap", label: { nl: "Vakmanschap / kwaliteit" } },
    { value: "snelheid", label: { nl: "Snelheid / wendbaarheid" } },
    { value: "verbinden", label: { nl: "Verbinden van mensen/ideeën" } },
    { value: "betekenis", label: { nl: "Betekenis / maatschappelijke impact" } },
    { value: "efficientie", label: { nl: "Efficiëntie / kostenmeesterschap" } },
  ],
  // item 53 — floreercondities (kies 2)
  // AFGELEID — te valideren door Marc
  cs_floreer: [
    { value: "richting", label: { nl: "Duidelijke gedeelde richting" } },
    { value: "autonomie", label: { nl: "Voldoende autonomie en vertrouwen" } },
    { value: "nabijheid", label: { nl: "Nabijheid bij klant/doelgroep" } },
    { value: "experimenteren", label: { nl: "Ruimte om te experimenteren" } },
    { value: "processen", label: { nl: "Stabiele, betrouwbare processen" } },
    { value: "samenwerking", label: { nl: "Sterke onderlinge samenwerking" } },
  ],
  // item 54 — blokkeercondities (kies 2)
  // AFGELEID — te valideren door Marc
  cs_blokkeer: [
    { value: "besluitvorming", label: { nl: "Trage besluitvorming" } },
    { value: "bureaucratie", label: { nl: "Te veel bureaucratie/administratie" } },
    { value: "prioriteiten", label: { nl: "Onduidelijke prioriteiten" } },
    { value: "middelen", label: { nl: "Gebrek aan middelen" } },
    { value: "silos", label: { nl: "Silo's tussen teams" } },
    { value: "vernieuwing", label: { nl: "Weinig ruimte voor vernieuwing" } },
  ],
};

// ---- Dimensie-labels (8 vermogens + overige) --------------------------------
const D = {
  identiteit: "identiteitscoherentie",
  sensing: "sensing",
  seizing: "seizing",
  transforming: "transforming",
  exploitatie: "exploitatiekracht",
  exploratie: "exploratiekracht",
  ambidex: "ambidextere-integratie",
  leerlus: "organisatorische-leerlus",
  energie: "energie-vitaliteit",
  teamklimaat: "teamklimaat",
  stakeholder: "stakeholderafstemming",
  handtekening: "waardecreatie-handtekening",
};

// ---- De 57 productie-items --------------------------------------------------
const items: T4OItem[] = [
  // Nulmeting energie (battery0-10)
  {
    id: "nulmeting",
    rings: ["binnen", "midden"],
    itemType: "battery",
    prompt: { nl: "Hoeveel energie geeft het werken in deze organisatie jullie op dit moment?" },
    dimensie: D.energie,
    niveau: "ORG",
  },

  // LAAG 1 — Identiteit & betekenis
  { id: "i1", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Iedereen die hier werkt kan in één zin uitleggen waaróm onze organisatie bestaat (verder dan geld verdienen)." }, dimensie: D.identiteit, niveau: "ORG" },
  { id: "i2", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Bij belangrijke keuzes verwijzen we expliciet naar onze kernopdracht." }, dimensie: D.identiteit, niveau: "ORG" },
  { id: "i3", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Onze kernopdracht staat mooi op papier, maar speelt nauwelijks een rol in het dagelijks werk." }, dimensie: D.identiteit, niveau: "ORG", reverse: true },
  { id: "i4", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We hebben een herkenbaar eigen verhaal dat ons onderscheidt van vergelijkbare organisaties." }, dimensie: D.identiteit, niveau: "ORG" },
  { id: "i5", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Als ik aan een buitenstaander vertel waar wij voor staan, klopt dat met hoe we echt werken." }, dimensie: D.identiteit, niveau: "ORG" },
  { id: "i6", rings: ["binnen", "midden"], itemType: "congruence", prompt: { nl: "Wat we naar buiten beloven, maken we intern ook waar." }, dimensie: D.identiteit, niveau: "ORG", gapGroup: "g_woorddaad" },
  { id: "i7", rings: ["binnen", "midden", "buiten"], itemType: "congruence", prompt: { nl: "Onze klanten/partners zouden ons op dezelfde manier omschrijven als wij onszelf." }, dimensie: D.identiteit, niveau: "ORG", gapGroup: "g_zelfbeeld" },
  { id: "i8", rings: ["buiten"], itemType: "congruence", prompt: { nl: "Deze organisatie doet wat ze zegt." }, dimensie: D.identiteit, niveau: "ORG", gapGroup: "g_woorddaad" },

  // LAAG 2 — Energie & klimaat: ENE-blok (i9-i14)
  { id: "i9", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "Onze interne vergaderingen" }, dimensie: D.energie, niveau: "ORG" },
  { id: "i10", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "De manier waarop beslissingen tot stand komen" }, dimensie: D.energie, niveau: "ORG" },
  { id: "i11", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "Onze rapportage- en administratieve verplichtingen" }, dimensie: D.energie, niveau: "ORG" },
  { id: "i12", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "Samenwerken over afdelingen/teams heen" }, dimensie: D.energie, niveau: "ORG" },
  { id: "i13", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "De manier waarop we omgaan met verandering" }, dimensie: D.energie, niveau: "ORG" },
  { id: "i14", rings: ["binnen", "midden"], itemType: "energy", prompt: { nl: "De manier waarop we fouten en tegenslag aanpakken" }, dimensie: D.energie, niveau: "ORG" },

  // Vitaliteit & bewegingsruimte (i15-i18)
  { id: "i15", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Mensen hier hebben genoeg ruimte om dingen daadwerkelijk in beweging te zetten." }, dimensie: D.energie, niveau: "ORG" },
  { id: "i16", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Na een drukke of zware periode herstelt onze energie zich vlot." }, dimensie: D.energie, niveau: "ORG" },
  { id: "i17", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Veel energie gaat hier verloren aan zaken die geen echte waarde toevoegen." }, dimensie: D.energie, niveau: "ORG", reverse: true },
  { id: "i18", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Wat we doen voelt voor de meeste mensen betekenisvol." }, dimensie: D.energie, niveau: "ORG" },

  // Teamklimaat (TEAM-niveau, R2-only)
  { id: "i19", rings: ["midden"], itemType: "likert", prompt: { nl: "De doelen van mijn team zijn voor iedereen duidelijk." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i20", rings: ["midden"], itemType: "likert", prompt: { nl: "Ik sta achter de doelen van mijn team." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i21", rings: ["midden"], itemType: "likert", prompt: { nl: 'In mijn team hebben we een "we doen het samen"-houding.' }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i22", rings: ["midden"], itemType: "likert", prompt: { nl: "Mensen voelen zich begrepen en aanvaard door elkaar." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i23", rings: ["midden"], itemType: "likert", prompt: { nl: "Het is veilig om hier een afwijkende mening of nieuw idee te uiten." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i24", rings: ["midden"], itemType: "likert", prompt: { nl: "We bekijken kritisch onze zwakke punten om beter te worden." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i25", rings: ["midden"], itemType: "likert", prompt: { nl: "In mijn team is er tijd en ruimte om nieuwe ideeën te ontwikkelen." }, dimensie: D.teamklimaat, niveau: "TEAM" },
  { id: "i26", rings: ["midden"], itemType: "likert", prompt: { nl: "We werken actief samen om nieuwe ideeën ook echt toe te passen." }, dimensie: D.teamklimaat, niveau: "TEAM" },

  // LAAG 3 — Sensing (i27-i30)
  { id: "i27", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We merken veranderingen in de behoeften van onze klanten/doelgroep vroeg op." }, dimensie: D.sensing, niveau: "ORG" },
  { id: "i28", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We volgen nieuwe technologieën en ontwikkelingen die ons vak kunnen veranderen actief op." }, dimensie: D.sensing, niveau: "ORG" },
  { id: "i29", rings: ["binnen"], itemType: "likert", prompt: { nl: "We pikken signalen uit de bredere samenleving (regelgeving, maatschappij) tijdig op." }, dimensie: D.sensing, niveau: "ORG" },
  { id: "i30", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Vaak zien we belangrijke veranderingen pas als ze al gebeurd zijn." }, dimensie: D.sensing, niveau: "ORG", reverse: true },

  // Seizing (i31-i34)
  { id: "i31", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Wanneer we een kans zien, hakken we er ook tijdig een knoop over door." }, dimensie: D.seizing, niveau: "ORG" },
  { id: "i32", rings: ["binnen"], itemType: "likert", prompt: { nl: "We durven middelen (geld, mensen, tijd) duidelijk te verschuiven naar wat belangrijk is." }, dimensie: D.seizing, niveau: "ORG" },
  { id: "i33", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We maken scherpe keuzes over waar we wél en niet op inzetten." }, dimensie: D.seizing, niveau: "ORG" },
  { id: "i34", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Goede kansen blijven bij ons vaak liggen door trage besluitvorming." }, dimensie: D.seizing, niveau: "ORG", reverse: true },

  // Transforming (i35-i38)
  { id: "i35", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Als de situatie het vraagt, passen we onze manier van werken echt aan (niet alleen op papier)." }, dimensie: D.transforming, niveau: "ORG" },
  { id: "i36", rings: ["binnen"], itemType: "likert", prompt: { nl: "We durven rollen en structuren te herzien wanneer dat nodig is." }, dimensie: D.transforming, niveau: "ORG" },
  { id: "i37", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Bij grote veranderingen behouden we toch onze eigenheid en kernwaarden." }, dimensie: D.transforming, niveau: "ORG" },
  { id: "i38", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Veranderingen stranden hier vaak halverwege." }, dimensie: D.transforming, niveau: "ORG", reverse: true },

  // Exploitatiekracht (i39-i41)
  { id: "i39", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We leveren onze kernactiviteiten betrouwbaar en met constante kwaliteit." }, dimensie: D.exploitatie, niveau: "ORG" },
  { id: "i40", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Onze processen zijn efficiënt en goed op elkaar afgestemd." }, dimensie: D.exploitatie, niveau: "ORG" },
  { id: "i41", rings: ["binnen"], itemType: "likert", prompt: { nl: "Wat hier goed werkt, kunnen we vlot overdragen en opschalen." }, dimensie: D.exploitatie, niveau: "ORG" },

  // Exploratiekracht (i42-i44)
  { id: "i42", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We experimenteren regelmatig met nieuwe aanpakken, producten of diensten." }, dimensie: D.exploratie, niveau: "ORG" },
  { id: "i43", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We durven gecontroleerd af te wijken van de gebaande paden." }, dimensie: D.exploratie, niveau: "ORG" },
  { id: "i44", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Mislukte experimenten worden hier geanalyseerd in plaats van weggemoffeld." }, dimensie: D.exploratie, niveau: "ORG" },

  // Ambidextere integratie (i45-i46)
  { id: "i45", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Bij ons gaan betrouwbaar leveren én vernieuwen goed samen, zonder dat het één het ander verdringt." }, dimensie: D.ambidex, niveau: "ORG" },
  { id: "i46", rings: ["binnen", "midden"], itemType: "forced-choice-single", prompt: { nl: "Wat typeert ons het meest?" }, dimensie: D.ambidex, niveau: "ORG", choiceSet: "cs_ambidex", select: 1 },

  // Organisatorische leerlus (i47-i49)
  { id: "i47", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We trekken systematisch lessen uit wat goed en fout gaat, en passen ons gedrag aan." }, dimensie: D.leerlus, niveau: "ORG" },
  { id: "i48", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Feedback van klanten/medewerkers leidt hier echt tot verandering." }, dimensie: D.leerlus, niveau: "ORG" },
  { id: "i49", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Dezelfde fouten blijven zich hier herhalen." }, dimensie: D.leerlus, niveau: "ORG", reverse: true },

  // LAAG 4 — Waardecreatiehandtekening
  { id: "i50", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "We luisteren echt naar onze klanten/partners en passen ons gedrag daarop aan." }, dimensie: D.stakeholder, niveau: "ORG", gapGroup: "g_luisteren" },
  { id: "i51", rings: ["buiten"], itemType: "congruence", prompt: { nl: "Deze organisatie reageert goed op wat wij als partner/klant inbrengen." }, dimensie: D.stakeholder, niveau: "ORG", gapGroup: "g_luisteren" },
  { id: "i52", rings: ["binnen", "midden"], itemType: "forced-choice-rank", prompt: { nl: "Waarin zijn wij van nature uitzonderlijk — wat lukt ons relatief moeiteloos terwijl anderen het moeilijk vinden? (rangschik je top 3)" }, dimensie: D.handtekening, niveau: "ORG", choiceSet: "cs_archetypen", rank: 3 },
  { id: "i53", rings: ["binnen"], itemType: "forced-choice-multi", prompt: { nl: "Wanneer komt onze organisatie het best tot haar recht? (kies de 2 sterkste floreercondities)" }, dimensie: D.handtekening, niveau: "ORG", choiceSet: "cs_floreer", select: 2 },
  { id: "i54", rings: ["binnen", "midden"], itemType: "forced-choice-multi", prompt: { nl: "Wat blokkeert ons talent het vaakst? (kies de 2 belangrijkste blokkeercondities)" }, dimensie: D.handtekening, niveau: "ORG", choiceSet: "cs_blokkeer", select: 2 },
  { id: "i55", rings: ["binnen", "midden"], itemType: "likert", prompt: { nl: "Onze grootste sterkte als organisatie wordt ook echt benut." }, dimensie: D.handtekening, niveau: "ORG" },
];

// ---- Schermvolgorde (sections) ----------------------------------------------
const sections: T4OSection[] = [
  {
    type: "intro",
    items: [],
    instructions: {
      nl: "Welkom. Jullie gaan zo enkele vragen beantwoorden over hoe deze organisatie werkt en aanvoelt. Er zijn geen goede of foute antwoorden — het gaat om jullie eerlijke beeld. De invulling is anoniem; antwoorden worden per groep samengevoegd tot één organisatieprofiel. Neem gerust even de tijd.",
    },
  },
  {
    type: "nulmeting",
    items: ["nulmeting"],
    instructions: { nl: "We beginnen met één ijkpunt over jullie energie." },
  },
  {
    type: "laag1",
    items: ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"],
    instructions: { nl: "Laag 1 van 4 — Identiteit & betekenis. Waar staat deze organisatie voor, en klopt dat met wat ze doet?" },
  },
  {
    type: "laag2-energie",
    items: ["i9", "i10", "i11", "i12", "i13", "i14", "i15", "i16", "i17", "i18"],
    instructions: { nl: "Laag 2 van 4 — Energie & klimaat. Geef per routine aan of dit jullie energie geeft, neutraal is, of energie kost. Daarna volgen enkele stellingen over vitaliteit." },
  },
  {
    type: "laag2-teamklimaat",
    ringOnly: "midden",
    items: ["i19", "i20", "i21", "i22", "i23", "i24", "i25", "i26"],
    instructions: { nl: "Laag 2 van 4 — Jouw team. Enkele stellingen over hoe het er in jouw team aan toegaat." },
  },
  {
    type: "laag3-a",
    items: ["i27", "i28", "i29", "i30", "i31", "i32", "i33", "i34"],
    instructions: { nl: "Laag 3 van 4 — Hoe jullie kansen en signalen oppikken en erop handelen." },
  },
  {
    type: "laag3-b",
    items: ["i35", "i36", "i37", "i38", "i39", "i40", "i41"],
    instructions: { nl: "Laag 3 van 4 — Hoe jullie veranderen én betrouwbaar blijven leveren." },
  },
  {
    type: "laag3-c",
    items: ["i42", "i43", "i44", "i45", "i46", "i47", "i48", "i49"],
    instructions: { nl: "Laag 3 van 4 — Hoe jullie vernieuwen en leren van wat goed en fout gaat." },
  },
  {
    type: "laag4",
    items: ["i50", "i51", "i52", "i53", "i54", "i55"],
    instructions: { nl: "Laag 4 van 4 — Jullie handtekening. Waar deze organisatie van nature in uitblinkt, en wat haar talent soms blokkeert." },
  },
  {
    type: "outro",
    items: [],
    instructions: {
      nl: "Bedankt voor het invullen. Jullie antwoorden worden samengevoegd tot een organisatie-talentprofiel. Er is geen verdere actie nodig.",
    },
  },
];

// ---- Export -----------------------------------------------------------------
export const t4oInstrument = {
  responseScales,
  energyCauseChips,
  choiceSets,
  items,
  sections,
};

export type T4OInstrument = typeof t4oInstrument;

// Filtert de items die bij een ring horen. R3 ('buiten') krijgt enkel i7, i8, i51.
export function itemsVoorRing(ring: Ring): T4OItem[] {
  return items.filter((it) => it.rings.includes(ring));
}

// Verplichte item-ids voor een ring (battery/likert/energy/forced-choice).
// Gebruikt door de routes om volledigheid te valideren.
export function verplichteItemIdsVoorRing(ring: Ring): string[] {
  return itemsVoorRing(ring).map((it) => it.id);
}
