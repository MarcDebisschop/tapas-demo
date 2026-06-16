// 2MINSCAN — Rapportcontent-generator.
// Bouwt de inhoudelijke blokken van het Energetisch Gedragsprofiel in energietaal,
// gedreven door dominante kleur + EG-code + schaduwwoorden.
// REGELS: geen talenttaal, geen potentieel/diagnose/selectie. "creativiteit" -> energietaal.

import type { KleurId } from "./data";
import type { ProfielRij } from "./profielen";
import { ontleedEGCode, ieStandUitCode, type IEStand } from "./egcode";
import { SCHADUW_PER_CODE } from "./schaduw";
import { maakT, type Vertaler, type Taal } from "./i18n";

export interface RapportData {
  naam: string;
  datum: string;
  egCode: string;
  egCodePositief: string;
  minSegment: string | null;
  profiel: ProfielRij;
  // afgeleide content
  kerntitel: string;
  kernzin: string;
  kleurvolgordeLabel: string;
  geeftEnergie: string;
  krijgtEnergie: string;
  verliestEnergie: string;
  herstelt: string;
  lezing2min: string[];
  teamEffecten: { titel: string; tekst: string }[];
  context: { thema: string; geeft: string; bewaakt: string }[];
  frictiePunten: string[];
  schaduwwoorden: string[];
  afstemming: { eigen: string[]; ander: string[]; vertaal: string };
  leiderschap: { titel: string; tekst: string }[];
  leiderschapSamenvatting: string;
  mbti: string;
  wielpositie: string;
  slotzin: string;
  energieStroomtTekst: string;
}

// Kleur-archetype teksten (energietaal). De dominante kleur stuurt de kerntoon.
const KLEUR_PROFIEL: Record<KleurId, {
  kern: string;
  geeft: string;
  krijgt: string;
  team: { titel: string; tekst: string }[];
}> = {
  rood: {
    kern: "een doelgerichte, daadkrachtige energiestroom die beweging en resultaat op gang brengt",
    geeft: "Je geeft energie door richting te kiezen, knopen door te hakken en mensen mee in beweging te krijgen naar een concreet resultaat.",
    krijgt: "Je laadt op wanneer er tempo, uitdaging en duidelijke doelen zijn en je merkbaar vooruitgang kunt boeken.",
    team: [
      { titel: "Daadkracht", tekst: "Je brengt beweging waar anderen blijven aarzelen en helpt een team vooruit." },
      { titel: "Richting", tekst: "Je maakt doelen scherp en houdt de focus op wat echt telt." },
      { titel: "Beslissingskracht", tekst: "Je durft keuzes te maken en zo de groep uit een impasse te halen." },
      { titel: "Resultaat", tekst: "Je houdt het eindpunt in zicht en vertaalt energie naar concrete stappen." },
    ],
  },
  geel: {
    kern: "een expressieve, verbindende energiestroom die mensen meeneemt in mogelijkheden",
    geeft: "Je geeft energie door enthousiasme, openheid en het samen verkennen van mogelijkheden in plaats van problemen.",
    krijgt: "Je laadt op door interactie, afwisseling, samen brainstormen en ruimte om ideeën hardop te verkennen.",
    team: [
      { titel: "Enthousiasme", tekst: "Je tilt de sfeer op en maakt anderen warm voor een gedeelde beweging." },
      { titel: "Verbinding", tekst: "Je brengt mensen samen en maakt het makkelijk om aan te haken." },
      { titel: "Mogelijkheden", tekst: "Je opent perspectief en zoekt openingen in plaats van vast te klikken op problemen." },
      { titel: "Beweging", tekst: "Je houdt de energie levend en zorgt dat ideeën blijven stromen." },
    ],
  },
  groen: {
    kern: "een zachte, mensgerichte energiestroom die vertrouwen en verbinding opbouwt",
    geeft: "Je geeft energie door te ondersteunen, te erkennen en spanning menselijker te maken voordat ze te groot wordt.",
    krijgt: "Je laadt op in een sfeer van respectvol contact, samenwerking en ruimte om samen te zoeken naar wat werkt.",
    team: [
      { titel: "Vertrouwen", tekst: "Mensen voelen zich sneller gezien en durven opener spreken." },
      { titel: "Ondersteuning", tekst: "Je helpt anderen opnieuw in beweging komen zonder te forceren." },
      { titel: "Bemiddeling", tekst: "Je verzacht spanning en zoekt herstel van contact." },
      { titel: "Verbondenheid", tekst: "Je bouwt aan een veilige sfeer waarin samenwerking kan groeien." },
    ],
  },
  blauw: {
    kern: "een nauwkeurige, doordachte energiestroom die helderheid en betrouwbaarheid brengt",
    geeft: "Je geeft energie door structuur aan te brengen, zaken te onderzoeken en helderheid te brengen in wat klopt.",
    krijgt: "Je laadt op wanneer er rust, voorbereiding en ruimte is om grondig en zorgvuldig te werken.",
    team: [
      { titel: "Helderheid", tekst: "Je brengt orde en overzicht waar het complex wordt." },
      { titel: "Betrouwbaarheid", tekst: "Je zorgt dat afspraken en details kloppen en houdbaar blijven." },
      { titel: "Onderbouwing", tekst: "Je toetst beslissingen aan feiten en maakt risico's bespreekbaar." },
      { titel: "Zorgvuldigheid", tekst: "Je bewaakt kwaliteit en voorkomt dat zaken te snel worden afgeraffeld." },
    ],
  },
};

// Min-segment -> energieverlies-teksten.
const MIN_FRICTIE: Record<string, { verliest: string; frictie: string[]; herstel: string }> = {
  a: {
    verliest: "Detailwerk, lange analyses en bewijsdruk trekken energie weg wanneer ze losstaan van betekenis.",
    frictie: ["Detailwerk zonder betekenis", "Procedures om procedures", "Alles feitelijk moeten aantonen", "Normatieve standpunten", "Humorloze of rigide sfeer"],
    herstel: "Vraag naar doel en nut, expliciteer verwachtingen en vertaal intuïtie naar concrete observaties.",
  },
  z: {
    verliest: "Voortdurend de relatie en harmonie moeten bewaken trekt energie weg wanneer er geen ruimte is voor eigen grenzen.",
    frictie: ["Onuitgesproken spanning", "Te veel willen dragen", "Geen eigen grens durven stellen", "Voortdurend bemiddelen", "Conflict dat blijft sudderen"],
    herstel: "Benoem sneller je eigen grens, durf nee te zeggen en deel de zorg met anderen.",
  },
  b: {
    verliest: "Snel moeten beslissen en doorduwen trekt energie weg wanneer er te weinig ruimte is voor reflectie of afstemming.",
    frictie: ["Beslissen onder tijdsdruk", "Geen ruimte voor reflectie", "Te snel moeten doorduwen", "Afstemming die ontbreekt", "Weerstand op richting"],
    herstel: "Plan reflectiemomenten in, betrek anderen vroeger en sta jezelf toe te vertragen.",
  },
  g: {
    verliest: "Voortdurend in de groep moeten zijn trekt energie weg wanneer er te weinig ruimte is voor focus of rust.",
    frictie: ["Constant in de groep", "Geen ruimte voor focus", "Te veel sociale prikkels", "Geen rustmomenten", "Steeds beschikbaar moeten zijn"],
    herstel: "Bouw rust- en focusmomenten in en bewaak ruimte om even buiten de groep op te laden.",
  },
};

function dominanteKleur(p: ProfielRij): KleurId {
  return p.kleurvolgorde[0];
}

// Bepaal de tegengestelde stijl voor de afstemmingspagina.
function tegengesteldeStijl(dom: KleurId, tr: Vertaler): { eigen: string[]; ander: string[]; vertaal: string } {
  const eigenNl: Record<KleurId, string[]> = {
    groen: ["Relationeel", "Ondersteunend", "Mensgericht", "Verbindend"],
    geel: ["Aanstekelijk", "Enthousiast", "Verbindend", "Mogelijkheidsgericht"],
    rood: ["Daadkrachtig", "Doelgericht", "Beslissend", "Tempovol"],
    blauw: ["Analytisch", "Gestructureerd", "Zorgvuldig", "Feitelijk"],
  };
  const anderNl: Record<KleurId, string[]> = {
    groen: ["Taakgericht", "Zakelijker", "Feitelijk", "Resultaatgericht"],
    geel: ["Taakgericht", "Zakelijker", "Feitelijk", "Resultaatgericht"],
    rood: ["Relationeel", "Mensgericht", "Aandacht voor sfeer", "Verbindend"],
    blauw: ["Relationeel", "Mensgericht", "Aandacht voor sfeer", "Verbindend"],
  };
  const vertaalNl: Record<KleurId, string> = {
    groen: "Bereid je kernboodschap voor, formuleer het gewenste resultaat vooraf, breng feitelijke argumenten mee en volg een duidelijke agenda. Doseer emotionele intensiteit en geef tijd om intern te verwerken.",
    geel: "Bereid je kernboodschap voor, formuleer het gewenste resultaat vooraf, breng feitelijke argumenten mee en volg een duidelijke agenda. Doseer emotionele intensiteit en geef tijd om intern te verwerken.",
    rood: "Vertraag bewust, vraag eerst hoe het met mensen gaat en maak ruimte voor de relatie voor je naar inhoud of resultaat schakelt. Benoem het waarom achter je keuzes en geef erkenning.",
    blauw: "Vertraag bewust, vraag eerst hoe het met mensen gaat en maak ruimte voor de relatie voor je naar inhoud of resultaat schakelt. Benoem het waarom achter je keuzes en geef erkenning.",
  };
  return {
    eigen: eigenNl[dom].map((w, i) => tr(`afstemming.${dom}.eigen.${i}`, w)),
    ander: anderNl[dom].map((w, i) => tr(`afstemming.${dom}.ander.${i}`, w)),
    vertaal: tr(`afstemming.${dom}.vertaal`, vertaalNl[dom]),
  };
}

export function bouwRapportData(input: {
  naam: string;
  datum: string;
  egCode: string;
  egCodePositief: string;
  minSegment: string | null;
  profiel: ProfielRij;
}, taal: Taal = "nl"): RapportData {
  const tr = maakT(taal);
  const { profiel } = input;
  const dom = dominanteKleur(profiel);
  const arch = KLEUR_PROFIEL[dom];
  const ontleed = ontleedEGCode(input.egCode, taal);
  const minKey = input.minSegment ? input.minSegment[1] : null;
  const stand = ieStandUitCode(input.egCode);
  const minF = minKey ? MIN_FRICTIE[minKey] : null;
  const schaduw = SCHADUW_PER_CODE[profiel.egCode] ?? SCHADUW_PER_CODE[input.egCodePositief] ?? [];
  const naamOfPersoon = input.naam?.trim() || "Deze persoon";

  const kerntitel = kerntitelVoor(dom, profiel, tr);
  const kernBeweging = tr(`kleur.${dom}.kern`, arch.kern);
  const brengtTpl = tr("ui.kern.brengt_tpl", "{naam} brengt {kern} in samenwerking.");
  const kernNaam = naamOfPersoon === "Deze persoon" ? tr("ui.algemeen.deze_persoon", "Deze persoon") : naamOfPersoon;
  const kernzin = brengtTpl.replace("{naam}", kernNaam).replace("{kern}", kernBeweging);

  const verliest = minF
    ? tr(`min_frictie.${minKey}.verliest`, minF.verliest)
    : tr("min_frictie.geen.verliest", "Energie lekt weg wanneer de omgeving te weinig ruimte laat voor wat jou natuurlijk energie geeft.");
  const herstelt = minF
    ? tr(`min_frictie.${minKey}.herstel`, minF.herstel)
    : tr("min_frictie.geen.herstel", "Vertragen, verwachtingen expliciteren en bewust afstemmen helpen je energie te herstellen.");

  const af = tegengesteldeStijl(dom, tr);
  const frictiePunten = minF
    ? minF.frictie.map((f, i) => tr(`min_frictie.${minKey}.frictie.${i}`, f))
    : [
        tr("min_frictie.geen.frictie.0", "Geen ruimte voor wat jou energie geeft"),
        tr("min_frictie.geen.frictie.1", "Te weinig afstemming"),
        tr("min_frictie.geen.frictie.2", "Onduidelijke verwachtingen"),
      ];

  return {
    naam: input.naam,
    datum: input.datum,
    egCode: input.egCode,
    egCodePositief: input.egCodePositief,
    minSegment: input.minSegment,
    profiel,
    kerntitel,
    kernzin,
    kleurvolgordeLabel: ontleed.samenvattingChips.join(" · "),
    geeftEnergie: tr(`kleur.${dom}.geeft`, arch.geeft),
    krijgtEnergie: tr(`kleur.${dom}.krijgt`, arch.krijgt),
    verliestEnergie: verliest,
    herstelt,
    lezing2min: lezing2minVoor(naamOfPersoon, dom, minF, tr, minKey),
    teamEffecten: arch.team.map((te, i) => ({
      titel: tr(`kleur.${dom}.team.${i}.titel`, te.titel),
      tekst: tr(`kleur.${dom}.team.${i}.tekst`, te.tekst),
    })),
    context: contextVoor(dom, tr),
    frictiePunten,
    schaduwwoorden: schaduw.slice(0, 9).map((w, i) => tr(`schaduw.${profiel.egCode}.${i}`, w)),
    afstemming: af,
    leiderschap: leiderschapVoor(dom, tr),
    leiderschapSamenvatting: leiderschapSamenvattingVoor(dom, tr),
    mbti: profiel.mbti,
    wielpositie: profiel.wielpositie,
    slotzin: slotzinVoor(dom, stand, tr),
    energieStroomtTekst: energieStroomtVoor(stand, tr),
  };
}

function kerntitelVoor(dom: KleurId, p: ProfielRij, tr: Vertaler): string {
  const map: Record<KleurId, string> = {
    rood: "De daadkrachtige aanjager",
    geel: "De verbindende inspirator",
    groen: "De empathische verbinder",
    blauw: "De zorgvuldige verdieper",
  };
  const sub: Record<KleurId, string> = {
    rood: "met resultaatgerichte energie",
    geel: "met meeslepende energie",
    groen: "met mensgerichte energie",
    blauw: "met doordachte energie",
  };
  const titel = tr(`kerntitel.${dom}.titel`, map[dom]);
  const subt = tr(`kerntitel.${dom}.sub`, sub[dom]);
  return `${titel} ${subt}`.trim();
}

function lezing2minVoor(
  naam: string,
  dom: KleurId,
  minF: { verliest: string } | null,
  tr: Vertaler,
  minKey: string | null,
): string[] {
  const openerNl: Record<KleurId, string> = {
    rood: "{naam} geeft spontaan energie door richting te kiezen, tempo te maken en mensen mee te nemen naar een concreet resultaat.",
    geel: "{naam} geeft spontaan energie door enthousiasme te delen, mensen te verbinden en samen mogelijkheden te verkennen.",
    groen: "{naam} geeft spontaan energie door vertrouwen te wekken, mensen te ondersteunen en spanningen te verzachten voor ze te groot worden.",
    blauw: "{naam} geeft spontaan energie door helderheid te brengen, zaken zorgvuldig te onderzoeken en betrouwbaarheid op te bouwen.",
  };
  const blijftNl: Record<KleurId, string> = {
    rood: "blijft in energie wanneer er duidelijke doelen, tempo en ruimte zijn om beslissingen te nemen en vooruit te gaan.",
    geel: "blijft in energie wanneer er ruimte is voor contact, afwisseling, brainstormen en samen zoeken naar mogelijkheden.",
    groen: "blijft in energie wanneer er ruimte is voor respectvol contact, samenwerking en menselijke afstemming.",
    blauw: "blijft in energie wanneer er rust, voorbereiding en ruimte is om grondig en zorgvuldig te werken.",
  };
  const dezePersoon = tr("ui.algemeen.deze_persoon_klein", "deze persoon");
  const voornaam = naam === "Deze persoon" ? dezePersoon : naam.split(" ")[0];
  const opener = tr(`lezing.${dom}.opener`, openerNl[dom]).replace("{naam}", naam === "Deze persoon" ? cap(dezePersoon) : naam);
  const blijft = tr(`lezing.${dom}.blijft`, blijftNl[dom]);
  const lek = minF
    ? tr(`lezing.lek.${minKey}`, `Energie lekt voorspelbaar weg op één plek. ${minF.verliest}`)
    : tr("lezing.lek.geen", "De energie lekt weg wanneer de omgeving te weinig ruimte laat voor wat natuurlijk voedt.");
  const stress = tr("lezing.stress", "Onder stress kan de energie versnellen, verharden of zich terugtrekken. Voor de omgeving kan dat aanvoelen alsof de gewone betrokkenheid plots omslaat in spanning of afstand.");
  return [opener, `${cap(voornaam)} ${blijft}`, lek, stress];
}

function contextVoor(dom: KleurId, tr: Vertaler): { thema: string; geeft: string; bewaakt: string }[] {
  const base: Record<KleurId, { thema: string; geeft: string; bewaakt: string }[]> = {
    rood: [
      { thema: "Cultuur", geeft: "Resultaatgerichtheid, autonomie en ruimte om te beslissen.", bewaakt: "Let op wanneer tempo de relatie of zorgvuldigheid wegdrukt." },
      { thema: "Werkritme", geeft: "Uitdaging, vaart en zichtbare vooruitgang.", bewaakt: "Let op bij trage trajecten zonder duidelijk doel." },
      { thema: "Leiderschap", geeft: "Ruimte voor initiatief en duidelijke verantwoordelijkheid.", bewaakt: "Let op bij micromanagement of vage richting." },
    ],
    geel: [
      { thema: "Cultuur", geeft: "Openheid, humor en ruimte voor ideeën.", bewaakt: "Let op wanneer alles te serieus of te rigide wordt." },
      { thema: "Werkritme", geeft: "Afwisseling, samen brainstormen en mogelijkheden verkennen.", bewaakt: "Let op bij lange detailtrajecten zonder afwisseling." },
      { thema: "Leiderschap", geeft: "Inspirerend, betrekkend en ruimtegevend leiderschap.", bewaakt: "Let op bij koude controle of gebrek aan erkenning." },
    ],
    groen: [
      { thema: "Cultuur", geeft: "Respect, menselijkheid en zo weinig mogelijk onnodig conflict.", bewaakt: "Let op wanneer normen belangrijker worden dan mensen." },
      { thema: "Werkritme", geeft: "Afwisseling, samen brainstormen en mogelijkheden verkennen.", bewaakt: "Let op bij lange detailtrajecten zonder duidelijke betekenis." },
      { thema: "Leiderschap", geeft: "Relationeel, coachend en waardengedreven leiderschap.", bewaakt: "Let op bij afstandelijke controle of koude procedurelogica." },
    ],
    blauw: [
      { thema: "Cultuur", geeft: "Zorgvuldigheid, rust en respect voor kwaliteit.", bewaakt: "Let op wanneer perfectie de voortgang blokkeert." },
      { thema: "Werkritme", geeft: "Voorbereiding, structuur en ruimte om grondig te werken.", bewaakt: "Let op bij chaos, tijdsdruk en steeds wisselende prioriteiten." },
      { thema: "Leiderschap", geeft: "Helder, betrouwbaar en op feiten gebaseerd leiderschap.", bewaakt: "Let op bij vage besluiten of impulsieve koerswissels." },
    ],
  };
  return base[dom].map((c, i) => ({
    thema: tr(`context.${dom}.${i}.thema`, c.thema),
    geeft: tr(`context.${dom}.${i}.geeft`, c.geeft),
    bewaakt: tr(`context.${dom}.${i}.bewaakt`, c.bewaakt),
  }));
}

function leiderschapVoor(dom: KleurId, tr: Vertaler): { titel: string; tekst: string }[] {
  const map: Record<KleurId, { titel: string; tekst: string }[]> = {
    rood: [
      { titel: "Richting geven", tekst: "Je geeft richting door doelen scherp te maken en knopen door te hakken." },
      { titel: "Tempo bewaken", tekst: "Je houdt de beweging erin en voorkomt dat zaken blijven hangen." },
      { titel: "Vertrouwen bouwen", tekst: "Je leiderschap groeit wanneer je beslissingen koppelt aan luisteren." },
      { titel: "Grenzen bewaken", tekst: "Je energie blijft duurzaam wanneer je niet alles alleen wilt forceren." },
    ],
    geel: [
      { titel: "Richting geven", tekst: "Je geeft richting door mensen te enthousiasmeren voor een gedeeld beeld." },
      { titel: "Verbinding maken", tekst: "Je leiderschap ontstaat via openheid, energie en betrokkenheid." },
      { titel: "Mogelijkheden openen", tekst: "Je helpt een team voorbij problemen naar opties kijken." },
      { titel: "Focus bewaken", tekst: "Je energie blijft duurzaam wanneer je enthousiasme verbindt met afronding." },
    ],
    groen: [
      { titel: "Richting geven", tekst: "Je geeft richting wanneer strategie verbonden blijft met mensen, waarden en betekenis." },
      { titel: "Vertrouwen bouwen", tekst: "Je leiderschap ontstaat via oprechte aandacht, erkenning en betrouwbaarheid." },
      { titel: "Samenwerking versterken", tekst: "Je maakt spanning bespreekbaar en helpt verschillen opnieuw verbindend maken." },
      { titel: "Grenzen bewaken", tekst: "Je energie blijft duurzaam wanneer je niet alles draagt om betrouwbaar te blijven lijken." },
    ],
    blauw: [
      { titel: "Richting geven", tekst: "Je geeft richting door helderheid, onderbouwing en betrouwbare kaders." },
      { titel: "Kwaliteit bewaken", tekst: "Je leiderschap groeit wanneer zorgvuldigheid samengaat met voortgang." },
      { titel: "Vertrouwen bouwen", tekst: "Je leiderschap ontstaat via consistentie en betrouwbaarheid." },
      { titel: "Ruimte bewaken", tekst: "Je energie blijft duurzaam wanneer je niet alle details zelf wilt controleren." },
    ],
  };
  return map[dom].map((l, i) => ({
    titel: tr(`leiderschap.${dom}.${i}.titel`, l.titel),
    tekst: tr(`leiderschap.${dom}.${i}.tekst`, l.tekst),
  }));
}

function leiderschapSamenvattingVoor(dom: KleurId, tr: Vertaler): string {
  const map: Record<KleurId, string> = {
    rood: "Dit profiel wijst op leiderschap dat richting, beslissingskracht en resultaatgerichtheid versterkt.",
    geel: "Dit profiel wijst op leiderschap dat verbinding, enthousiasme en gedeelde beweging versterkt.",
    groen: "Dit profiel wijst op leiderschap dat samenwerking, conflictmanagement, ondersteuning en teambuilding versterkt.",
    blauw: "Dit profiel wijst op leiderschap dat helderheid, kwaliteit en betrouwbaarheid versterkt.",
  };
  return tr(`leiderschap_samenvatting.${dom}`, map[dom]);
}

// Slotzin (H12-titel): de dominante kleur stuurt de inhoud, de intro/extravert-stand
// stuurt of de beweging vooral naar buiten (extravert), naar binnen (introvert)
// of schakelend (ambivert) gericht is. Zo klopt de toon altijd bij het profiel.
function slotzinVoor(dom: KleurId, stand: IEStand, tr: Vertaler): string {
  const perKleur: Record<KleurId, Record<IEStand, string>> = {
    rood: {
      EE: "door samen met anderen richting te kiezen en mensen mee in beweging te krijgen",
      II: "door eerst voor jezelf richting te bepalen en daarna gericht naar buiten te treden",
      AMBI: "door richting te kiezen die ook voor anderen betekenis heeft",
    },
    geel: {
      EE: "door anderen aan te steken en samen hardop mogelijkheden te verkennen",
      II: "door eerst je eigen beeld te laten rijpen en het daarna met anderen te delen",
      AMBI: "door mensen mee te nemen in mogelijkheden, op je eigen ritme",
    },
    groen: {
      EE: "door actief verbinding te zoeken rond wat echt betekenis heeft",
      II: "door rustig en oprecht verbinding op te bouwen rond wat echt betekenis heeft",
      AMBI: "door verbinding te maken rond wat echt betekenis heeft",
    },
    blauw: {
      EE: "door helderheid te brengen en die helder met anderen te delen",
      II: "door zaken eerst grondig te doordenken en dan helderheid te brengen",
      AMBI: "door helderheid te brengen in wat concreet moet gebeuren",
    },
  };
  return tr(`slot.${dom}.${stand}`, perKleur[dom][stand]);
}

// H12-blok "Wanneer je energie stroomt": de formulering beweegt mee met de stand,
// zodat een introvert profiel niet de extraverte standaardzin krijgt.
function energieStroomtVoor(stand: IEStand, tr: Vertaler): string {
  const map: Record<IEStand, string> = {
    EE: "Je voelt meer ruimte, verbinding en zin om samen met anderen mogelijkheden te onderzoeken.",
    II: "Je voelt meer ruimte en rust om vanuit jezelf te werken en op je eigen tempo verbinding te maken.",
    AMBI: "Je voelt meer ruimte en verbinding, en kunt vlot schakelen tussen samen verkennen en zelf verdiepen.",
  };
  return tr(`energie_stroomt.${stand}`, map[stand]);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
