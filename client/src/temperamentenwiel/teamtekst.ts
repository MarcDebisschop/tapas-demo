// Temperamentenwiel — rapportteksten voor het energetisch teamprofiel.
//
// Deze teksten komen uit het goedgekeurde teamprofiel (prototype
// temperamentenwiel/js/rapporttekst.js) en zijn hier onveranderd overgezet,
// zodat het platformrapport dezelfde bladstructuur en dezelfde inhoud levert.
//
// Deterministisch: dezelfde kleurvolgorde geeft altijd dezelfde tekst.
// Taal = energietaal binnen het 2MINSCAN-kader. Geen talent-, potentieel-,
// competentie-, selectie- of diagnoseclaims. Het woord "creativiteit" wordt
// niet als verklaring gebruikt.
//
// MEERTALIG (NL/FR/EN): de Nederlandse tekst in dit bestand is de bron en de
// terugval. Zichtbare tekst gaat door dezelfde vertaler als de rest van het
// wiel: (sleutel, nl-terugval) -> tekst.

import { KLEUREN, type EnergieKleur, type Positie } from "./posities";
import type { WielVertaler } from "./dynamiek";

const GEEN_VERTALING: WielVertaler = (_sleutel, terugval) => terugval;

const FLOW: Record<EnergieKleur, string> = {
  rood:
    "Energie stroomt wanneer er richting is, wanneer er beslist wordt en wanneer inspanning tot een zichtbaar resultaat leidt.",
  geel:
    "Energie stroomt in contact met mensen, wanneer er samen mogelijkheden verkend worden en wanneer er perspectief opengaat.",
  groen:
    "Energie stroomt wanneer er rust en betrouwbaarheid is, wanneer afspraken standhouden en wanneer mensen zich gesteund weten.",
  blauw:
    "Energie stroomt wanneer er tijd is om uit te zoeken hoe iets in elkaar zit en wanneer iets grondig mag kloppen.",
};

const STEUN: Record<EnergieKleur, string> = {
  rood: "Doorpakken en knopen doorhakken ligt binnen bereik zolang de richting duidelijk is.",
  geel: "Mensen meenemen en het gesprek open houden lukt zonder veel inspanning.",
  groen: "Zorgen dat het werkbaar blijft voor de groep gaat vlot.",
  blauw: "Ordenen en nakijken lukt goed zolang het niet de hele dag duurt.",
};

const INSPANNING: Record<EnergieKleur, string> = {
  rood: "Snel en stevig positie kiezen vraagt bewuste inspanning.",
  geel: "Voortdurend zichtbaar en aanwezig zijn in de groep vraagt bewuste inspanning.",
  groen: "Lang stilstaan bij het tempo en het comfort van iedereen vraagt bewuste inspanning.",
  blauw: "Uitgebreid uitspitten en onderbouwen vraagt bewuste inspanning.",
};

const KOST: Record<EnergieKleur, string> = {
  rood: "Energie lekt weg bij druk, wedijver en beslissen zonder dat de betekenis duidelijk is.",
  geel:
    "Energie lekt weg bij veel ruis, losse ideeën zonder afronding en constant sociaal aanwezig moeten zijn.",
  groen:
    "Energie lekt weg bij traag besluiten, veel geduld moeten opbrengen en spanningen die blijven sudderen.",
  blauw:
    "Energie lekt weg bij detailwerk en bewijsdruk die losstaan van duidelijke richting of menselijk nut.",
};

export interface IndividueleLezing {
  flow: string;
  steun: string;
  inspanning: string;
  kost: string;
}

/** Vier regels per deelnemer: stroomt, steunt, vraagt, lekt. */
export function individueleLezing(p: Positie, vertaler?: WielVertaler): IndividueleLezing {
  const t = vertaler ?? GEEN_VERTALING;
  return {
    flow: t(`tekst.flow.${p.volgorde[0]}`, FLOW[p.volgorde[0]]),
    steun: t(`tekst.steun.${p.volgorde[1]}`, STEUN[p.volgorde[1]]),
    inspanning: t(`tekst.inspanning.${p.volgorde[2]}`, INSPANNING[p.volgorde[2]]),
    kost: t(`tekst.kost.${p.volgorde[3]}`, KOST[p.volgorde[3]]),
  };
}

interface TeamEnergieBlok {
  geeft: string;
  lekt: string;
  afspraak: string;
  signaal: string;
}

const TEAMENERGIE: Record<EnergieKleur, TeamEnergieBlok> = {
  rood: {
    geeft: "een heldere opdracht, mandaat om te beslissen en zichtbare voortgang",
    lekt: "dossiers die telkens opnieuw worden opengelegd zonder besluit",
    afspraak:
      "Sluit elk overleg af met wie wat doet en tegen wanneer, ook als het gesprek niet volledig af was.",
    signaal: "kort en scherp worden, over anderen heen praten, zelf beginnen doen",
  },
  geel: {
    geeft: "samen mogelijkheden verkennen, hardop mogen denken en horen dat het verschil maakt",
    lekt: "alleen een lijst afwerken zonder gesprek of terugkoppeling",
    afspraak:
      "Plan een open denkblok vooraan in het overleg, duidelijk gescheiden van het beslismoment.",
    signaal: "veel praten zonder te landen, afhaken bij administratie, beloftes die te ruim worden",
  },
  groen: {
    geeft: "voorspelbaarheid, tijd om mee te gaan in een wijziging en afspraken die standhouden",
    lekt: "bruuske wendingen en onuitgesproken spanning in de groep",
    afspraak: "Kondig wijzigingen aan met de reden erbij en met tijd om erop terug te komen.",
    signaal: "stiller worden, instemmen zonder overtuiging, zorgen pas achteraf uitspreken",
  },
  blauw: {
    geeft: "duidelijke kaders, feiten op tafel en de ruimte om iets grondig te doen",
    lekt: "improviseren onder tijdsdruk en beslissen op een gevoel zonder onderbouwing",
    afspraak:
      "Bezorg stukken vooraf in plaats van ter zitting, zodat er niet ter plekke moet worden ingeschat.",
    signaal: "terugtrekken in het dossier, vragen om uitstel, alleen nog schriftelijk reageren",
  },
};

/** Wat deze energie in het team nodig heeft om te blijven stromen. */
export function teamEnergie(kleur: EnergieKleur, vertaler?: WielVertaler): TeamEnergieBlok {
  const t = vertaler ?? GEEN_VERTALING;
  const nl = TEAMENERGIE[kleur];
  return {
    geeft: t(`tekst.team.${kleur}.geeft`, nl.geeft),
    lekt: t(`tekst.team.${kleur}.lekt`, nl.lekt),
    afspraak: t(`tekst.team.${kleur}.afspraak`, nl.afspraak),
    signaal: t(`tekst.team.${kleur}.signaal`, nl.signaal),
  };
}

export interface Overlegblok {
  titel: string;
  tekst: string;
}

const OVERLEG: Record<EnergieKleur | "afronden", Overlegblok> = {
  blauw: {
    titel: "Vooraf",
    tekst: "Stukken en cijfers rondsturen, zodat niemand ter zitting moet inschatten.",
  },
  geel: {
    titel: "Openen",
    tekst:
      "Kort blok waarin mogelijkheden hardop verkend mogen worden, zonder dat er al gekozen wordt.",
  },
  groen: {
    titel: "Wegen",
    tekst:
      "Expliciet naar de gevolgen voor mensen en werkbaarheid vragen, met stiltes die mogen vallen.",
  },
  rood: {
    titel: "Beslissen",
    tekst: "Duidelijk beslismoment met een knoop, een eigenaar en een datum.",
  },
  afronden: {
    titel: "Afronden",
    tekst: "Twee minuten: wie neemt wat op, en wat kost dat iemand aan energie.",
  },
};

/** Overlegontwerp op maat van de aanwezige eerste kleuren, in vaste orde. */
export function overlegOntwerp(aanwezig: EnergieKleur[], vertaler?: WielVertaler): Overlegblok[] {
  const t = vertaler ?? GEEN_VERTALING;
  const orde: (EnergieKleur | "afronden")[] = ["blauw", "geel", "groen", "rood"];
  const sleutels = orde.filter((k) => aanwezig.includes(k as EnergieKleur));
  sleutels.push("afronden");
  return sleutels.map((k) => ({
    titel: t(`tekst.overleg.${k}.titel`, OVERLEG[k].titel),
    tekst: t(`tekst.overleg.${k}.tekst`, OVERLEG[k].tekst),
  }));
}

/** Kleuren die bij minstens één deelnemer de eerste energie zijn. */
export function aanwezigeKleuren(dominant: Record<EnergieKleur, number>): EnergieKleur[] {
  return KLEUREN.filter((k) => dominant[k] > 0);
}
