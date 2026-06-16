// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Verdiepingsmodules ("Starten"-flow van de galerij)
//
// Dit bestand maakt de belofte op de galerijkaarten WAAR. Waar galerij.ts de
// catalogus + matching + preview levert, levert dit bestand de ECHTE inhoud
// achter de "Starten"-knop: een rijke, meerstaps lees-/reflectie-ervaring die
// 100% uit het individuele profiel is opgebouwd.
//
// HARDE GARANTIES (identiek aan de chat-engine):
//  - Geen hallucinaties. Elk feit, cijfer, naam en CITAAT komt letterlijk uit
//    het generatorcontract (constructRows, mostItems, meta). De verbindende
//    verteltekst is door ons geschreven en wordt met de echte profielwaarden
//    ingevuld — er wordt nooit een eigenschap, score of situatie verzonnen.
//  - Maximale uniciteit. De module citeert de EIGEN, door de deelnemer gekozen
//    uitspraken (mostItems) en gebruikt de eigen sterkste foci/versnellers/
//    drivers met hun eigen energie- en netto-waarden. Twee mensen krijgen
//    aantoonbaar een andere module. Standaardantwoorden bestaan niet.
//  - "Driver(s)" blijft onvertaald (naar Taibi Kahler). TaPas-Beeld telt NOOIT
//    mee als talent-focus, maar mag wel als zelfbeeld-lens geduid worden.
//  - Meertalig (NL/FR/EN/ES/RU); de citaten worden in de taal van de lezer
//    getoond als die beschikbaar is, anders met NL als terugval.
//
// Werkwijze: parseModuleProfiel() leest een rijkere structuur dan de chat-engine
// (inclusief mostItems per construct). bouwModule() stelt per module een reeks
// "blokken" samen (kop + paragrafen + citaten + reflectievragen). De frontend
// rendert die blokken als een meerstaps leeservaring.
// ---------------------------------------------------------------------------
import type { Taal } from "@shared/talen";
import { isTapasBeeld, isTalentFocusConstruct } from "@shared/talent-constructs";

type ML = Record<Taal, string>;
const k = (m: ML, taal: Taal): string => m[taal] ?? m.nl;
const TALEN: Taal[] = ["nl", "fr", "en", "es", "ru"];

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

// --- Profiel-extractie (rijker dan ProfielFeiten: met eigen citaten) --------

export interface ModuleConstruct {
  construct: string; // canonieke naam, bv. "Be Perfect" of "Innovatie"
  family: string;
  net: number;
  avgEnergy: number;
  // Eigen, door de deelnemer gekozen uitspraken (meertalig), sterkste signaal.
  citaten: ML[];
}

export interface ModuleProfiel {
  heeftProfiel: boolean;
  naam: string | null;
  foci: ModuleConstruct[]; // gesorteerd, sterkste eerst (TaPas-Beeld eruit)
  versnellers: ModuleConstruct[];
  drivers: ModuleConstruct[]; // alle drivers, sterkste net eerst
  driversAanwezig: ModuleConstruct[]; // drivers met net > 0
  driversEnergiekost: ModuleConstruct[]; // avgEnergy < 0, zwaarste eerst
  tapasBeeld: ModuleConstruct | null;
  driverLabel: string; // laag | matig | gemiddeld | hoog
  energie: number; // 0-10
  baseline: number; // 0-10 (eigen voorinschatting)
  discrepantie: number; // baseline - gemeten (negatief = ondergeschat vooraf)
  herkenbaarheid: number | null; // 0-100
}

function leesCitaten(raw: any): ML[] {
  const items = Array.isArray(raw?.mostItems) ? raw.mostItems : [];
  const uit: ML[] = [];
  for (const it of items) {
    if (it && typeof it === "object") {
      const ml: ML = {
        nl: String(it.nl ?? it.en ?? "").trim(),
        fr: String(it.fr ?? it.nl ?? "").trim(),
        en: String(it.en ?? it.nl ?? "").trim(),
        es: String(it.es ?? it.nl ?? "").trim(),
        ru: String(it.ru ?? it.nl ?? "").trim(),
      };
      if (ml.nl || ml.en) uit.push(ml);
    } else if (typeof it === "string" && it.trim()) {
      const s = it.trim();
      uit.push({ nl: s, fr: s, en: s, es: s, ru: s });
    }
  }
  return uit;
}

export function parseModuleProfiel(contractRaw: unknown, naam?: string | null): ModuleProfiel {
  let contract: any = contractRaw;
  if (typeof contractRaw === "string") {
    try {
      contract = JSON.parse(contractRaw);
    } catch {
      contract = null;
    }
  }
  const main = contract?.sections?.main;
  const naamUit = naam && naam !== "(nog niet ingevuld)" ? naam : null;
  if (!main) {
    return {
      heeftProfiel: false,
      naam: naamUit,
      foci: [],
      versnellers: [],
      drivers: [],
      driversAanwezig: [],
      driversEnergiekost: [],
      tapasBeeld: null,
      driverLabel: "laag",
      energie: 5,
      baseline: 5,
      discrepantie: 0,
      herkenbaarheid: null,
    };
  }

  const rawRows: any[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  const rows: ModuleConstruct[] = rawRows.map((r) => ({
    construct: String(r.construct ?? ""),
    family: String(r.family ?? ""),
    net: num(r.net),
    avgEnergy: num(r.avgEnergy),
    citaten: leesCitaten(r),
  }));

  const byFam = (fam: string) =>
    rows.filter((r) => r.family === fam && !isTapasBeeld(r.construct)).sort((a, b) => b.net - a.net);

  const foci = byFam("Talent-foci");
  const versnellers = byFam("Talent-versnellers");
  const drivers = byFam("Drivers");
  const driversAanwezig = drivers.filter((d) => d.net > 0);
  const driversEnergiekost = [...drivers]
    .filter((d) => d.avgEnergy < 0)
    .sort((a, b) => a.avgEnergy - b.avgEnergy);
  const tapasBeeld = rows.find((r) => isTapasBeeld(r.construct)) ?? null;

  const meta = main.meta ?? {};
  const dr = meta.driverRisk ?? {};
  const cons = meta.consistency ?? {};

  return {
    heeftProfiel: true,
    naam: naamUit,
    foci,
    versnellers,
    drivers,
    driversAanwezig,
    driversEnergiekost,
    tapasBeeld,
    driverLabel: String(dr.label ?? "laag"),
    energie: num(meta.normalizedQuestionnaireEnergy, 5),
    baseline: num(meta.baselineProfessionalEnergy, 5),
    discrepantie: num(meta.energyDiscrepancy, 0),
    herkenbaarheid: typeof cons.score === "number" ? cons.score : null,
  };
}

// --- Driver-duiding (inhoudelijk, naam blijft onvertaald) -------------------
// Per canonieke driver: een KORTE betekenis + hoe hij ONDER DRUK doorslaat.
// Dit is vakinhoud (naar Taibi Kahler), geen verzonnen profielfeit. We tonen
// het alleen voor drivers die ECHT in het profiel aanwezig zijn.
interface DriverDuiding {
  kern: ML; // wat de driver in essentie doet
  onderDruk: ML; // hoe hij doorslaat en energie kost
}
const DRIVER_DUIDING: Record<string, DriverDuiding> = {
  "Be Perfect": {
    kern: {
      nl: "wil dat alles foutloos en tot in de puntjes klopt",
      fr: "veut que tout soit irréprochable et parfait jusqu'au moindre détail",
      en: "wants everything flawless and right down to the last detail",
      es: "quiere que todo sea impecable y correcto hasta el último detalle",
      ru: "хочет, чтобы всё было безупречно и выверено до мелочей",
    },
    onderDruk: {
      nl: "nooit tevreden zijn: je blijft schaven, stelt af, en wat af is voelt nooit af genoeg — dat vreet tijd en energie",
      fr: "insatisfaction permanente : tu continues à peaufiner et rien n'est jamais assez fini — ce qui dévore temps et énergie",
      en: "never being satisfied: you keep polishing, and what's done never feels done enough — which drains time and energy",
      es: "una insatisfacción permanente: sigues puliendo y lo terminado nunca parece bastante — lo que agota tiempo y energía",
      ru: "вечную неудовлетворённость: вы продолжаете доводить до идеала, и сделанное никогда не кажется достаточным — это съедает время и силы",
    },
  },
  "Be Strong": {
    kern: {
      nl: "wil sterk en onafhankelijk zijn, geen zwakte tonen",
      fr: "veut être fort et indépendant, sans montrer de faiblesse",
      en: "wants to be strong and independent, showing no weakness",
      es: "quiere ser fuerte e independiente, sin mostrar debilidad",
      ru: "хочет быть сильным и независимым, не показывать слабости",
    },
    onderDruk: {
      nl: "alles alleen willen dragen: je vraagt te laat hulp en houdt vol tot je leeg bent — vermoeidheid wordt pas zichtbaar als het al te ver is",
      fr: "vouloir tout porter seul : tu demandes de l'aide trop tard et tiens jusqu'à l'épuisement — la fatigue ne se voit que trop tard",
      en: "carrying everything alone: you ask for help too late and push on until empty — exhaustion only shows when it's already too far",
      es: "querer cargarlo todo solo: pides ayuda demasiado tarde y aguantas hasta vaciarte — el cansancio solo se ve cuando ya es tarde",
      ru: "стремление тянуть всё в одиночку: вы просите помощи слишком поздно и держитесь до изнеможения — усталость становится заметной слишком поздно",
    },
  },
  "Hurry Up": {
    kern: {
      nl: "wil snel vooruit, geen tijd verliezen",
      fr: "veut avancer vite, ne pas perdre de temps",
      en: "wants to move fast, lose no time",
      es: "quiere avanzar rápido, no perder tiempo",
      ru: "хочет двигаться быстро, не терять времени",
    },
    onderDruk: {
      nl: "opjagen: je begint te veel tegelijk, slaat stappen over en maakt net daardoor fouten die je later weer moet rechtzetten",
      fr: "précipitation : tu commences trop de choses à la fois, sautes des étapes et fais des erreurs à corriger plus tard",
      en: "rushing: you start too much at once, skip steps and make the very mistakes you'll have to fix later",
      es: "apresurarse: empiezas demasiadas cosas a la vez, te saltas pasos y cometes los errores que luego debes corregir",
      ru: "спешку: вы беретесь за слишком многое сразу, пропускаете шаги и совершаете ошибки, которые потом придётся исправлять",
    },
  },
  "Try Hard": {
    kern: {
      nl: "wil hard zijn best doen en zich bewijzen",
      fr: "veut faire de son mieux et faire ses preuves",
      en: "wants to try hard and prove itself",
      es: "quiere esforzarse y demostrar su valía",
      ru: "хочет очень стараться и доказывать свою состоятельность",
    },
    onderDruk: {
      nl: "inspanning verwarren met resultaat: je steekt er veel moeite in maar verliest soms uit het oog of het ook echt afgewerkt raakt of erkend wordt",
      fr: "confondre l'effort avec le résultat : tu y mets beaucoup d'énergie mais perds parfois de vue si c'est vraiment terminé ou reconnu",
      en: "mistaking effort for result: you put in a lot but sometimes lose sight of whether it actually gets finished or recognised",
      es: "confundir el esfuerzo con el resultado: pones mucho empeño pero a veces pierdes de vista si de verdad se termina o se reconoce",
      ru: "подмену результата усилием: вы вкладываете много сил, но порой теряете из виду, доведено ли дело до конца и признано ли оно",
    },
  },
  "Please Others": {
    kern: {
      nl: "wil het anderen naar de zin maken en aardig gevonden worden",
      fr: "veut faire plaisir aux autres et être apprécié",
      en: "wants to please others and be liked",
      es: "quiere agradar a los demás y caer bien",
      ru: "хочет угождать другим и нравиться",
    },
    onderDruk: {
      nl: "jezelf wegcijferen: je zegt te vaak ja, neemt te veel op je en stelt je eigen grens te laat",
      fr: "effacement de soi : tu dis trop souvent oui, prends trop sur toi et poses tes limites trop tard",
      en: "self-effacement: you say yes too often, take on too much and set your own boundary too late",
      es: "anularte: dices que sí demasiado a menudo, asumes demasiado y pones tu límite demasiado tarde",
      ru: "самоотречение: вы слишком часто соглашаетесь, берёте на себя слишком много и слишком поздно обозначаете границы",
    },
  },
};

// --- Module-output-structuur ------------------------------------------------

export interface ModuleBlok {
  // Soort blok bepaalt de visuele weergave in de frontend.
  type: "intro" | "sectie" | "citaat" | "spanning" | "reflectie" | "synthese";
  kop?: string;
  paragrafen?: string[];
  citaten?: string[]; // letterlijke eigen uitspraken
  vragen?: string[]; // reflectievragen
}

export interface ModuleInhoud {
  id: string;
  titel: string;
  ondertitel: string;
  duurMin: number;
  beschikbaar: boolean;
  blokken: ModuleBlok[];
  // Korte afsluitende uitnodiging om door te vragen aan de assistent.
  doorvraagHint: string;
  // Disclaimer (vaste reflectiehulp-noot, geen diagnose).
  disclaimer: string;
}

// Hulpteksten -----------------------------------------------------------------
const DISCLAIMER: ML = {
  nl: "Dit is een reflectiehulp op basis van je eigen profiel, geen diagnose of beoordeling.",
  fr: "Ceci est une aide à la réflexion basée sur ton propre profil, pas un diagnostic ni une évaluation.",
  en: "This is a reflection aid based on your own profile, not a diagnosis or assessment.",
  es: "Esto es una ayuda a la reflexión basada en tu propio perfil, no un diagnóstico ni una evaluación.",
  ru: "Это вспомогательный материал для рефлексии на основе вашего профиля, а не диагноз или оценка.",
};

const GEEN_PROFIEL: ML = {
  nl: "Deze verdieping wordt opgebouwd uit je eigen profiel. Zodra je profiel is ingevuld, vul ik deze module met jouw eigen talenten, situaties en uitspraken.",
  fr: "Cet approfondissement se construit à partir de ton propre profil. Dès qu'il est rempli, je remplis ce module avec tes talents, situations et formulations.",
  en: "This deep-dive is built from your own profile. Once your profile is completed, I fill this module with your own talents, situations and statements.",
  es: "Esta profundización se construye a partir de tu propio perfil. En cuanto se complete, llenaré este módulo con tus talentos, situaciones y afirmaciones.",
  ru: "Это углубление строится на основе вашего профиля. Как только профиль будет заполнен, я наполню этот модуль вашими талантами, ситуациями и формулировками.",
};

function energieWoord(e: number, taal: Taal): string {
  const laag: ML = { nl: "aan de lage kant", fr: "plutôt basse", en: "on the low side", es: "algo baja", ru: "скорее низкая" };
  const midden: ML = { nl: "in evenwicht", fr: "en équilibre", en: "in balance", es: "en equilibrio", ru: "в равновесии" };
  const hoog: ML = { nl: "duidelijk gevuld", fr: "clairement élevée", en: "clearly high", es: "claramente alta", ru: "явно высокая" };
  if (e < 4.5) return k(laag, taal);
  if (e < 6.5) return k(midden, taal);
  return k(hoog, taal);
}

function fmt(t: string, v: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, key) => String(v[key] ?? ""));
}

// =============================================================================
// MODULE 1 — Talent-verdieping
// =============================================================================
function bouwTalentVerdieping(p: ModuleProfiel, taal: Taal): ModuleBlok[] {
  const blokken: ModuleBlok[] = [];
  const top = p.foci.filter((f) => f.net > 0).slice(0, 3);
  const topFocus = top[0] ?? p.foci[0] ?? null;
  const topVersn = p.versnellers.filter((v) => v.net > 0)[0] ?? p.versnellers[0] ?? null;

  // INTRO — benoemt de eigen sterkste foci + energie.
  const fociNamen = top.map((f) => f.construct).join(", ");
  const introNL = top.length
    ? `Je profiel laat een duidelijk patroon zien. Waar je aandacht en energie van nature het vlotst naartoe gaan, zijn je talent-foci ${fociNamen}. Bovenaan staat "${topFocus?.construct}" — dat is het gebied waar werk voor jou het meest moeiteloos voelt. We gaan er hieronder dieper op in, telkens met jouw eigen woorden uit de vragenlijst als anker.`
    : `Je profiel toont geen uitgesproken talent-focus bovenaan. Dat is op zich ook informatie: je kracht ligt mogelijk breder verdeeld. We kijken hieronder naar wat er wél naar boven kwam.`;
  const introTekst: ML = {
    nl: introNL,
    fr: top.length
      ? `Ton profil montre un schéma clair. Là où ton attention et ton énergie vont le plus naturellement, ce sont tes focus de talent ${fociNamen}. En tête : « ${topFocus?.construct} » — le domaine où le travail te semble le plus naturel. Nous l'approfondissons ci-dessous, à chaque fois ancré dans tes propres mots du questionnaire.`
      : `Ton profil ne montre pas de focus de talent dominant. C'est aussi une information : ta force est peut-être plus répartie. Regardons ce qui est ressorti.`,
    en: top.length
      ? `Your profile shows a clear pattern. Where your attention and energy most naturally flow are your talent foci ${fociNamen}. At the top: "${topFocus?.construct}" — the area where work feels most effortless to you. We go deeper below, each time anchored in your own words from the questionnaire.`
      : `Your profile shows no single dominant talent focus. That is information too: your strength may be more broadly spread. Let's look at what did surface.`,
    es: top.length
      ? `Tu perfil muestra un patrón claro. Donde tu atención y energía fluyen con más naturalidad son tus focos de talento ${fociNamen}. En lo más alto: «${topFocus?.construct}» — el área donde el trabajo te resulta más natural. Profundizamos a continuación, siempre anclados en tus propias palabras del cuestionario.`
      : `Tu perfil no muestra un foco de talento dominante. Eso también es información: tu fuerza puede estar más repartida. Veamos lo que sí surgió.`,
    ru: top.length
      ? `Ваш профиль показывает чёткую картину. Ваше внимание и энергия естественнее всего направлены на фокусы таланта ${fociNamen}. На вершине — «${topFocus?.construct}», область, где работа даётся вам легче всего. Ниже разберём подробнее, каждый раз опираясь на ваши собственные формулировки из опросника.`
      : `В вашем профиле нет единственного доминирующего фокуса таланта. Это тоже информация: ваша сила, возможно, распределена шире. Посмотрим, что всё же проявилось.`,
  };
  blokken.push({ type: "intro", paragrafen: [k(introTekst, taal)] });

  // SECTIE per top-focus, met eigen citaten.
  for (const f of top) {
    const energieDuiding: ML = {
      nl: f.avgEnergy > 0.2
        ? `Belangrijk: dit gebied geeft je energie (je tankt op terwijl je erin werkt). Dat maakt het een gebied waar je niet alleen góéd in bent, maar dat je ook lang volhoudt.`
        : f.avgEnergy < 0
        ? `Let op: hoewel dit gebied bij je sterktes hoort, kost het je netto energie. Een talent kan iets zijn wat je kúnt, zonder dat het je per se oplaadt — goed om te weten voor hoe je je dag indeelt.`
        : `Dit gebied is energetisch ongeveer neutraal: het put je niet uit, maar laadt je ook niet uitgesproken op.`,
      fr: f.avgEnergy > 0.2
        ? `Important : ce domaine te donne de l'énergie (tu te recharges en y travaillant). C'est donc un domaine où tu es non seulement bon, mais que tu tiens longtemps.`
        : f.avgEnergy < 0
        ? `Attention : bien que ce domaine fasse partie de tes forces, il te coûte de l'énergie nette. Un talent peut être quelque chose que tu sais faire sans pour autant te recharger.`
        : `Ce domaine est énergétiquement à peu près neutre : il ne t'épuise pas mais ne te recharge pas non plus nettement.`,
      en: f.avgEnergy > 0.2
        ? `Important: this area gives you energy (you recharge while working in it). That makes it an area where you're not only good, but which you can sustain for a long time.`
        : f.avgEnergy < 0
        ? `Note: although this area is among your strengths, it costs you net energy. A talent can be something you're able to do without it necessarily recharging you — useful to know for how you plan your day.`
        : `This area is roughly energy-neutral: it doesn't drain you, but it doesn't clearly recharge you either.`,
      es: f.avgEnergy > 0.2
        ? `Importante: esta área te da energía (te recargas mientras trabajas en ella). Es un área en la que no solo eres bueno, sino que puedes sostener mucho tiempo.`
        : f.avgEnergy < 0
        ? `Nota: aunque esta área está entre tus fortalezas, te cuesta energía neta. Un talento puede ser algo que sabes hacer sin que necesariamente te recargue.`
        : `Esta área es energéticamente casi neutra: no te agota, pero tampoco te recarga claramente.`,
      ru: f.avgEnergy > 0.2
        ? `Важно: эта область даёт вам энергию (вы подзаряжаетесь, работая в ней). Значит, вы здесь не только сильны, но и можете долго выдерживать нагрузку.`
        : f.avgEnergy < 0
        ? `Обратите внимание: хотя эта область среди ваших сильных сторон, она отнимает у вас энергию. Талант может быть тем, что вы умеете, но что не обязательно вас заряжает.`
        : `Эта область энергетически почти нейтральна: не истощает, но и явно не заряжает.`,
    };

    const kopTekst: ML = {
      nl: `Talent-focus: ${f.construct}`,
      fr: `Focus de talent : ${f.construct}`,
      en: `Talent focus: ${f.construct}`,
      es: `Foco de talento: ${f.construct}`,
      ru: `Фокус таланта: ${f.construct}`,
    };

    const sectie: ModuleBlok = { type: "sectie", kop: k(kopTekst, taal), paragrafen: [k(energieDuiding, taal)] };
    const cit = f.citaten.slice(0, 3).map((c) => k(c, taal)).filter(Boolean);
    if (cit.length) {
      const aanloop: ML = {
        nl: "Dit zijn jouw eigen woorden uit de vragenlijst die dit talent het sterkst kleurden:",
        fr: "Voici tes propres mots du questionnaire qui ont le plus coloré ce talent :",
        en: "These are your own words from the questionnaire that most strongly coloured this talent:",
        es: "Estas son tus propias palabras del cuestionario que más matizaron este talento:",
        ru: "Вот ваши собственные формулировки из опросника, ярче всего проявившие этот талант:",
      };
      sectie.paragrafen!.push(k(aanloop, taal));
      sectie.citaten = cit;
    }
    blokken.push(sectie);
  }

  // SPANNING focus <-> versneller (hoe breng je het talent tot resultaat).
  if (topFocus && topVersn) {
    const sp: ML = {
      nl: `Hoe breng je "${topFocus.construct}" tot resultaat? Je sterkste talent-versneller is "${topVersn.construct}" — dat is je meest natuurlijke werkwijze, het 'gereedschap' waarmee je je talent het vlotst inzet. De combinatie is geen toeval: "${topVersn.construct}" is precies de motor die "${topFocus.construct}" van aandacht naar afgewerkt resultaat brengt. Als je voelt dat iets stroef loopt, kijk dan of je je natuurlijke werkwijze wel genoeg ruimte geeft.`,
      fr: `Comment amener « ${topFocus.construct} » au résultat ? Ton accélérateur de talent le plus fort est « ${topVersn.construct} » — ta manière de travailler la plus naturelle, l'outil avec lequel tu déploies ton talent le plus aisément. La combinaison n'est pas un hasard : « ${topVersn.construct} » est précisément le moteur qui amène « ${topFocus.construct} » de l'attention au résultat fini.`,
      en: `How do you turn "${topFocus.construct}" into results? Your strongest talent accelerator is "${topVersn.construct}" — your most natural way of working, the 'tool' through which you deploy your talent most smoothly. The combination is no accident: "${topVersn.construct}" is exactly the engine that takes "${topFocus.construct}" from attention to finished result.`,
      es: `¿Cómo conviertes «${topFocus.construct}» en resultados? Tu acelerador de talento más fuerte es «${topVersn.construct}» — tu forma de trabajar más natural, la 'herramienta' con la que despliegas tu talento con más fluidez. La combinación no es casual: «${topVersn.construct}» es el motor que lleva «${topFocus.construct}» de la atención al resultado terminado.`,
      ru: `Как превратить «${topFocus.construct}» в результат? Ваш сильнейший ускоритель таланта — «${topVersn.construct}», самый естественный способ работы, «инструмент», которым вы легче всего применяете свой талант. Сочетание не случайно: «${topVersn.construct}» — именно тот двигатель, что доводит «${topFocus.construct}» от внимания до готового результата.`,
    };
    blokken.push({ type: "spanning", paragrafen: [k(sp, taal)] });
  }

  // REFLECTIE.
  const refl: ML = {
    nl: "Neem even de tijd. Denk aan een concrete situatie van de afgelopen weken:",
    fr: "Prends un moment. Pense à une situation concrète des dernières semaines :",
    en: "Take a moment. Think of a concrete situation from the past weeks:",
    es: "Tómate un momento. Piensa en una situación concreta de las últimas semanas:",
    ru: "Найдите минуту. Вспомните конкретную ситуацию последних недель:",
  };
  const vragen: ML[] = [
    {
      nl: topFocus ? `Waar merkte je "${topFocus.construct}" het sterkst — en voelde de tijd er vervliegen?` : "In welke taak voelde de tijd vervliegen?",
      fr: topFocus ? `Où as-tu le plus senti « ${topFocus.construct} » — au point d'oublier le temps ?` : "Dans quelle tâche le temps a-t-il filé ?",
      en: topFocus ? `Where did you feel "${topFocus.construct}" most strongly — and lost track of time?` : "In which task did time fly by?",
      es: topFocus ? `¿Dónde sentiste más «${topFocus.construct}» — hasta perder la noción del tiempo?` : "¿En qué tarea se te pasó el tiempo volando?",
      ru: topFocus ? `Где вы сильнее всего ощутили «${topFocus.construct}» — и потеряли счёт времени?` : "В какой задаче время летело незаметно?",
    },
    {
      nl: topVersn ? `Gaf je "${topVersn.construct}" genoeg ruimte, of werkte je tegen je natuurlijke werkwijze in?` : "Werkte je volgens je natuurlijke werkwijze, of ertegenin?",
      fr: topVersn ? `As-tu laissé assez de place à « ${topVersn.construct} », ou as-tu travaillé à contre-courant ?` : "As-tu travaillé selon ta manière naturelle, ou à contre-courant ?",
      en: topVersn ? `Did you give "${topVersn.construct}" enough room, or did you work against your natural way?` : "Did you work in your natural way, or against it?",
      es: topVersn ? `¿Le diste suficiente espacio a «${topVersn.construct}», o trabajaste a contracorriente?` : "¿Trabajaste según tu forma natural, o en contra de ella?",
      ru: topVersn ? `Достаточно ли вы дали места «${topVersn.construct}», или работали против своего естественного стиля?` : "Вы работали в своём естественном стиле или против него?",
    },
  ];
  blokken.push({ type: "reflectie", paragrafen: [k(refl, taal)], vragen: vragen.map((v) => k(v, taal)) });

  // SYNTHESE.
  const syn: ML = {
    nl: topFocus && topVersn
      ? `De rode draad: je sterkste hefboom is "${topFocus.construct}" ingezet via "${topVersn.construct}". Wanneer die twee samenvallen, voelt werk moeiteloos en houd je het lang vol. Hoe meer je je week rond die combinatie kunt organiseren, hoe stabieler je energie blijft.`
      : `De rode draad: je kracht ligt breder verdeeld dan in één uitgesproken talent. Kijk welke combinaties van foci en werkwijzen jou het meest opladen.`,
    fr: topFocus && topVersn
      ? `Le fil rouge : ton levier le plus fort est « ${topFocus.construct} » mobilisé via « ${topVersn.construct} ». Quand ces deux coïncident, le travail semble sans effort et tu tiens longtemps. Plus tu organises ta semaine autour de cette combinaison, plus ton énergie reste stable.`
      : `Le fil rouge : ta force est plus répartie qu'un seul talent dominant. Observe quelles combinaisons te rechargent le plus.`,
    en: topFocus && topVersn
      ? `The through-line: your strongest lever is "${topFocus.construct}" deployed via "${topVersn.construct}". When those two coincide, work feels effortless and you sustain it for long. The more you can organise your week around that combination, the more stable your energy stays.`
      : `The through-line: your strength is more broadly spread than a single dominant talent. See which combinations recharge you most.`,
    es: topFocus && topVersn
      ? `El hilo conductor: tu palanca más fuerte es «${topFocus.construct}» desplegada vía «${topVersn.construct}». Cuando coinciden, el trabajo se siente sin esfuerzo y lo sostienes mucho tiempo. Cuanto más organices tu semana en torno a esa combinación, más estable se mantiene tu energía.`
      : `El hilo conductor: tu fuerza está más repartida que en un solo talento dominante. Observa qué combinaciones te recargan más.`,
    ru: topFocus && topVersn
      ? `Ключевая линия: ваш сильнейший рычаг — «${topFocus.construct}», применяемый через «${topVersn.construct}». Когда они совпадают, работа даётся без усилий и долго выдерживается. Чем больше вы строите неделю вокруг этого сочетания, тем стабильнее ваша энергия.`
      : `Ключевая линия: ваша сила распределена шире, чем один доминирующий талант. Посмотрите, какие сочетания заряжают вас больше всего.`,
  };
  blokken.push({ type: "synthese", paragrafen: [k(syn, taal)] });

  return blokken;
}

// =============================================================================
// MODULE 2 — Energie-monitor
// =============================================================================
function bouwEnergieMonitor(p: ModuleProfiel, taal: Taal): ModuleBlok[] {
  const blokken: ModuleBlok[] = [];
  const e = p.energie;
  const eWoord = energieWoord(e, taal);

  // INTRO — de gemeten energie + baseline-vergelijking.
  const introNL = `Op het moment van je profiel stond je energie op ${e.toFixed(1)}/10 — ${eWoord}. Vooraf schatte je jezelf in op ${p.baseline.toFixed(1)}/10.`;
  const introTekst: ML = {
    nl: introNL,
    fr: `Au moment de ton profil, ton énergie était à ${e.toFixed(1)}/10 — ${eWoord}. Au préalable, tu t'étais estimé à ${p.baseline.toFixed(1)}/10.`,
    en: `At the time of your profile, your energy stood at ${e.toFixed(1)}/10 — ${eWoord}. Beforehand you estimated yourself at ${p.baseline.toFixed(1)}/10.`,
    es: `En el momento de tu perfil, tu energía estaba en ${e.toFixed(1)}/10 — ${eWoord}. De antemano te estimaste en ${p.baseline.toFixed(1)}/10.`,
    ru: `На момент профиля ваша энергия была ${e.toFixed(1)}/10 — ${eWoord}. Заранее вы оценили себя на ${p.baseline.toFixed(1)}/10.`,
  };
  blokken.push({ type: "intro", paragrafen: [k(introTekst, taal)] });

  // SECTIE — duiding van de discrepantie (baseline - gemeten).
  const d = p.discrepantie;
  let discKop: ML;
  let discPar: ML;
  if (d <= -1) {
    // gemeten HOGER dan vooraf ingeschat
    discKop = { nl: "Je onderschatte jezelf vooraf", fr: "Tu t'es sous-estimé au départ", en: "You underestimated yourself beforehand", es: "Te subestimaste de antemano", ru: "Вы недооценили себя заранее" };
    discPar = {
      nl: `Je meting kwam ${Math.abs(d).toFixed(1)} punt(en) hóger uit dan je vooraf dacht. Dat is een veelvoorkomend en hoopgevend signaal: in de praktijk gaf je werk je méér dan je zelf inschatte. Soms zegt dit dat je je eigen veerkracht onderschat — of dat een lastige periode net daarvoor je verwachting had gedrukt.`,
      fr: `Ta mesure est ressortie ${Math.abs(d).toFixed(1)} point(s) plus HAUT que ce que tu pensais. Signal fréquent et encourageant : dans la pratique, ton travail t'a donné plus que tu ne l'estimais. Parfois cela révèle que tu sous-estimes ta propre résilience.`,
      en: `Your measurement came out ${Math.abs(d).toFixed(1)} point(s) HIGHER than you expected. A common and hopeful signal: in practice your work gave you more than you estimated. Sometimes this means you underestimate your own resilience.`,
      es: `Tu medición resultó ${Math.abs(d).toFixed(1)} punto(s) MÁS ALTA de lo que pensabas. Señal frecuente y esperanzadora: en la práctica tu trabajo te dio más de lo que estimabas. A veces indica que subestimas tu propia resiliencia.`,
      ru: `Ваше измерение оказалось на ${Math.abs(d).toFixed(1)} балл(а/ов) ВЫШЕ ожидаемого. Частый и обнадёживающий сигнал: на практике работа дала вам больше, чем вы предполагали. Иногда это значит, что вы недооцениваете собственную устойчивость.`,
    };
  } else if (d >= 1) {
    // gemeten LAGER dan vooraf ingeschat
    discKop = { nl: "Je verwachtte meer dan er op dat moment was", fr: "Tu attendais plus qu'il n'y avait alors", en: "You expected more than there was at the time", es: "Esperabas más de lo que había entonces", ru: "Вы ожидали большего, чем было на тот момент" };
    discPar = {
      nl: `Je meting kwam ${d.toFixed(1)} punt(en) láger uit dan je vooraf dacht. Je verwachtte meer ruimte dan er op dat moment was — dat wijst vaak op een periode waarin de omstandigheden zwaarder wogen dan je talent. Geen reden tot zorg op zich, wél een signaal om te kijken wat er net energie kostte.`,
      fr: `Ta mesure est ressortie ${d.toFixed(1)} point(s) plus BAS que prévu. Tu attendais plus de marge qu'il n'y en avait — souvent le signe d'une période où les circonstances pesaient plus que ton talent. Pas inquiétant en soi, mais un signal pour regarder ce qui coûtait de l'énergie.`,
      en: `Your measurement came out ${d.toFixed(1)} point(s) LOWER than expected. You expected more room than there was at the time — often a sign of a period where circumstances weighed more than your talent. Not alarming in itself, but a signal to look at what was costing energy.`,
      es: `Tu medición resultó ${d.toFixed(1)} punto(s) MÁS BAJA de lo previsto. Esperabas más margen del que había — a menudo señal de un período en que las circunstancias pesaban más que tu talento. No es alarmante en sí, pero sí una señal para mirar qué costaba energía.`,
      ru: `Ваше измерение оказалось на ${d.toFixed(1)} балл(а/ов) НИЖЕ ожидаемого. Вы рассчитывали на больший запас, чем был — часто это признак периода, когда обстоятельства весили больше таланта. Само по себе не тревожно, но сигнал посмотреть, что отнимало энергию.`,
    };
  } else {
    discKop = { nl: "Je inschatting klopte goed", fr: "Ton estimation était juste", en: "Your estimate was accurate", es: "Tu estimación fue acertada", ru: "Ваша оценка была точной" };
    discPar = {
      nl: `Je voorinschatting en je meting lagen dicht bij elkaar (verschil ${Math.abs(d).toFixed(1)} punt). Dat duidt op een goed zelfgevoel: je weet behoorlijk goed waar je energetisch staat.`,
      fr: `Ton estimation préalable et ta mesure étaient proches (écart ${Math.abs(d).toFixed(1)} point). Cela indique une bonne conscience de soi : tu sais assez bien où tu en es énergétiquement.`,
      en: `Your prior estimate and your measurement were close (difference ${Math.abs(d).toFixed(1)} point). That indicates good self-awareness: you know fairly well where you stand energetically.`,
      es: `Tu estimación previa y tu medición estuvieron cerca (diferencia ${Math.abs(d).toFixed(1)} punto). Indica buena autoconciencia: sabes bastante bien dónde estás energéticamente.`,
      ru: `Ваша предварительная оценка и измерение оказались близки (разница ${Math.abs(d).toFixed(1)} балла). Это говорит о хорошем самопонимании: вы довольно точно знаете своё энергетическое состояние.`,
    };
  }
  blokken.push({ type: "sectie", kop: k(discKop, taal), paragrafen: [k(discPar, taal)] });

  // SECTIE — wat kost energie (drivers met energiekost) + welk talent oplaadt.
  const kost = p.driversEnergiekost[0] ?? null;
  const oplaadFocus = p.foci.filter((f) => f.avgEnergy > 0).sort((a, b) => b.avgEnergy - a.avgEnergy)[0] ?? null;
  const oplaadVersn = p.versnellers.filter((v) => v.avgEnergy > 0).sort((a, b) => b.avgEnergy - a.avgEnergy)[0] ?? null;
  const oplaad = (oplaadVersn && (!oplaadFocus || oplaadVersn.avgEnergy >= oplaadFocus.avgEnergy)) ? oplaadVersn : oplaadFocus;
  const balansKop: ML = { nl: "Wat laadt op, wat kost", fr: "Ce qui recharge, ce qui coûte", en: "What recharges, what costs", es: "Qué recarga, qué cuesta", ru: "Что заряжает, что отнимает" };
  const balansNL =
    (oplaad ? `Je laadt het sterkst op via "${oplaad.construct}" — daar zit je energiebron. ` : "") +
    (kost ? `Wat je netto het meest energie kost, hangt samen met je driver "${kost.construct}": die slaat onder druk door en put je dan uit. Wie zijn week zo inricht dat het opladende werk de energievreters compenseert, houdt het langst vol.` : "In je profiel springen er geen uitgesproken energievreters uit — een gunstig teken voor je volhoudbaarheid.");
  const balansPar: ML = {
    nl: balansNL,
    fr: (oplaad ? `Tu te recharges le plus via « ${oplaad.construct} » — c'est ta source d'énergie. ` : "") + (kost ? `Ce qui te coûte le plus d'énergie nette est lié à ton driver « ${kost.construct} » : il déraille sous pression et t'épuise alors. Organiser sa semaine pour que le travail rechargeant compense les sources de fatigue, c'est tenir plus longtemps.` : "Aucun gros consommateur d'énergie ne ressort de ton profil — un signe favorable pour ta tenue."),
    en: (oplaad ? `You recharge most through "${oplaad.construct}" — that's your energy source. ` : "") + (kost ? `What costs you the most net energy is linked to your driver "${kost.construct}": it derails under pressure and drains you. Whoever arranges their week so recharging work offsets the energy drains lasts longest.` : "No major energy drains stand out in your profile — a favourable sign for your stamina."),
    es: (oplaad ? `Te recargas más a través de «${oplaad.construct}» — esa es tu fuente de energía. ` : "") + (kost ? `Lo que más energía neta te cuesta está ligado a tu driver «${kost.construct}»: se descontrola bajo presión y te agota. Quien organiza su semana para que el trabajo que recarga compense los desgastes, aguanta más.` : "En tu perfil no destacan grandes desgastes de energía — buena señal para tu resistencia."),
    ru: (oplaad ? `Сильнее всего вы заряжаетесь через «${oplaad.construct}» — это ваш источник энергии. ` : "") + (kost ? `Больше всего энергии отнимает то, что связано с вашим driver «${kost.construct}»: под давлением он выходит из-под контроля и истощает вас. Тот, кто строит неделю так, чтобы заряжающая работа компенсировала затраты, держится дольше.` : "В вашем профиле нет явных пожирателей энергии — благоприятный знак для выносливости."),
  };
  blokken.push({ type: "sectie", kop: k(balansKop, taal), paragrafen: [k(balansPar, taal)] });

  // REFLECTIE — de "5 minuten-check".
  const refl: ML = {
    nl: "Een snelle check op dit moment — beantwoord voor jezelf:",
    fr: "Un contrôle rapide maintenant — réponds pour toi :",
    en: "A quick check right now — answer for yourself:",
    es: "Una comprobación rápida ahora — responde para ti:",
    ru: "Быстрая проверка прямо сейчас — ответьте себе:",
  };
  const vragen: ML[] = [
    { nl: "Hoe vol voelt je accu vandaag (0-10)? En hoe verhoudt zich dat tot je profielscore hierboven?", fr: "À combien est ta batterie aujourd'hui (0-10) ? Et par rapport à ton score ci-dessus ?", en: "How full is your battery today (0-10)? And how does that compare to your profile score above?", es: "¿Qué tan llena está tu batería hoy (0-10)? ¿Y cómo se compara con tu puntuación de arriba?", ru: "Насколько заряжена ваша батарея сегодня (0-10)? Как это соотносится с вашим показателем выше?" },
    { nl: kost ? `Merk je de afgelopen week iets van "${kost.construct}" dat extra energie kostte?` : "Welk deel van je werk kostte deze week het meest?", fr: kost ? `As-tu remarqué cette semaine quelque chose de « ${kost.construct} » qui coûtait de l'énergie ?` : "Quelle partie de ton travail a coûté le plus cette semaine ?", en: kost ? `Did you notice anything of "${kost.construct}" costing extra energy this past week?` : "Which part of your work cost the most this week?", es: kost ? `¿Notaste esta semana algo de «${kost.construct}» que costara energía extra?` : "¿Qué parte de tu trabajo costó más esta semana?", ru: kost ? `Замечали ли вы на этой неделе что-то от «${kost.construct}», что отнимало дополнительную энергию?` : "Какая часть работы отняла больше всего сил на этой неделе?" },
    { nl: oplaad ? `Wanneer kreeg je deze week energie van iets dat bij "${oplaad.construct}" past?` : "Wanneer kreeg je deze week onverwacht energie van je werk?", fr: oplaad ? `Quand as-tu eu de l'énergie cette semaine grâce à quelque chose lié à « ${oplaad.construct} » ?` : "Quand as-tu eu de l'énergie inattendue cette semaine ?", en: oplaad ? `When did you get energy this week from something fitting "${oplaad.construct}"?` : "When did your work give you unexpected energy this week?", es: oplaad ? `¿Cuándo obtuviste energía esta semana de algo ligado a «${oplaad.construct}»?` : "¿Cuándo te dio energía inesperada tu trabajo esta semana?", ru: oplaad ? `Когда на этой неделе вы получили энергию от чего-то, связанного с «${oplaad.construct}»?` : "Когда работа неожиданно зарядила вас на этой неделе?" },
  ];
  blokken.push({ type: "reflectie", paragrafen: [k(refl, taal)], vragen: vragen.map((v) => k(v, taal)) });

  return blokken;
}

// =============================================================================
// MODULE 3 — Drivers onder druk
// =============================================================================
function bouwDriversOnderDruk(p: ModuleProfiel, taal: Taal): ModuleBlok[] {
  const blokken: ModuleBlok[] = [];
  // Drivers die in dit profiel opvielen: aanwezig (net>0), sterkste eerst.
  // Als er geen positieve drivers zijn, val terug op de zwaarste energiekost.
  let relevant = p.driversAanwezig.slice(0, 3);
  if (!relevant.length) relevant = p.driversEnergiekost.slice(0, 2);

  // INTRO — wat een driver is + welke bij jou opvielen.
  const namen = relevant.map((d) => d.construct).join(", ");
  const introNL = relevant.length
    ? `Een "Driver" is een innerlijke aandrijver (naar Taibi Kahler): een onbewuste overtuiging die je vanaf jongs af aan motiveert. Op je goede dagen helpt een driver je presteren; onder druk slaat hij door en kost dan net energie. In jouw profiel vielen vooral op: ${namen}. We kijken per stuk naar wat hij doet, wanneer hij het sterkst opspeelt, en hoe je er ruimte van maakt.`
    : `Een "Driver" is een innerlijke aandrijver (naar Taibi Kahler): een onbewuste overtuiging die je motiveert maar onder druk kan doorslaan. In jouw profiel springen er geen drivers uitgesproken naar boven — een relatief ontspannen patroon. We lichten hieronder kort toe wat dit betekent.`;
  const introTekst: ML = {
    nl: introNL,
    fr: relevant.length
      ? `Un « Driver » est un moteur intérieur (d'après Taibi Kahler) : une conviction inconsciente qui te motive depuis l'enfance. Les bons jours, il t'aide à performer ; sous pression, il déraille et coûte de l'énergie. Dans ton profil ressortent surtout : ${namen}. Nous regardons chacun : ce qu'il fait, quand il est le plus fort, et comment t'en libérer.`
      : `Un « Driver » est un moteur intérieur (d'après Taibi Kahler) qui te motive mais peut déraper sous pression. Dans ton profil, aucun driver ne ressort nettement — un schéma relativement détendu.`,
    en: relevant.length
      ? `A "Driver" is an inner drive (after Taibi Kahler): an unconscious belief that has motivated you since childhood. On good days it helps you perform; under pressure it derails and then costs energy. In your profile these stood out most: ${namen}. We look at each one: what it does, when it peaks, and how to create space around it.`
      : `A "Driver" is an inner drive (after Taibi Kahler) that motivates you but can derail under pressure. In your profile no driver stands out markedly — a relatively relaxed pattern.`,
    es: relevant.length
      ? `Un «Driver» es un impulsor interior (según Taibi Kahler): una creencia inconsciente que te motiva desde la infancia. En los buenos días te ayuda a rendir; bajo presión se descontrola y cuesta energía. En tu perfil destacaron sobre todo: ${namen}. Vemos cada uno: qué hace, cuándo se intensifica y cómo darle espacio.`
      : `Un «Driver» es un impulsor interior (según Taibi Kahler) que te motiva pero puede descontrolarse bajo presión. En tu perfil ningún driver destaca claramente — un patrón relativamente relajado.`,
    ru: relevant.length
      ? `«Driver» — внутренний двигатель (по Taibi Kahler): неосознанное убеждение, мотивирующее вас с детства. В хорошие дни он помогает достигать результата; под давлением выходит из-под контроля и отнимает энергию. В вашем профиле ярче всего проявились: ${namen}. Разберём каждый: что он делает, когда усиливается и как дать ему пространство.`
      : `«Driver» — внутренний двигатель (по Taibi Kahler), который мотивирует, но под давлением может выйти из-под контроля. В вашем профиле ни один driver явно не выделяется — относительно спокойная картина.`,
  };
  blokken.push({ type: "intro", paragrafen: [k(introTekst, taal)] });

  // SECTIE per relevante driver.
  for (const d of relevant) {
    const duiding = DRIVER_DUIDING[d.construct];
    const kop: ML = {
      nl: `Driver: ${d.construct}`,
      fr: `Driver : ${d.construct}`,
      en: `Driver: ${d.construct}`,
      es: `Driver: ${d.construct}`,
      ru: `Driver: ${d.construct}`,
    };
    const sectie: ModuleBlok = { type: "sectie", kop: k(kop, taal), paragrafen: [] };
    if (duiding) {
      const kostNoot = d.avgEnergy < 0;
      const par: ML = {
        nl: `Deze driver ${k(duiding.kern, taal)}. Onder druk slaat hij door in ${k(duiding.onderDruk, taal)}.` + (kostNoot ? ` In jouw meting kost deze driver netto energie — een teken dat hij bij jou meer dan gemiddeld actief is.` : ``),
        fr: `Ce driver ${k(duiding.kern, taal)}. Sous pression, il dérape vers ${k(duiding.onderDruk, taal)}.` + (kostNoot ? ` Dans ta mesure, ce driver coûte de l'énergie nette — signe qu'il est plus actif que la moyenne chez toi.` : ``),
        en: `This driver ${k(duiding.kern, taal)}. Under pressure it tips into ${k(duiding.onderDruk, taal)}.` + (kostNoot ? ` In your measurement this driver costs net energy — a sign it's more active than average for you.` : ``),
        es: `Este driver ${k(duiding.kern, taal)}. Bajo presión se desliza hacia ${k(duiding.onderDruk, taal)}.` + (kostNoot ? ` En tu medición este driver cuesta energía neta — señal de que está más activo de lo normal en ti.` : ``),
        ru: `Этот driver ${k(duiding.kern, taal)}. Под давлением он превращается в ${k(duiding.onderDruk, taal)}.` + (kostNoot ? ` В вашем измерении этот driver отнимает энергию — признак того, что у вас он активнее среднего.` : ``),
      };
      sectie.paragrafen!.push(k(par, taal));
    }
    // Eigen citaten die deze driver kleurden.
    const cit = d.citaten.slice(0, 2).map((c) => k(c, taal)).filter(Boolean);
    if (cit.length) {
      const aanloop: ML = {
        nl: "Dit herken je misschien — het zijn je eigen woorden uit de vragenlijst:",
        fr: "Tu t'y reconnais peut-être — ce sont tes propres mots du questionnaire :",
        en: "You may recognise this — these are your own words from the questionnaire:",
        es: "Quizá te reconozcas — son tus propias palabras del cuestionario:",
        ru: "Возможно, вы узнаёте это — ваши собственные слова из опросника:",
      };
      sectie.paragrafen!.push(k(aanloop, taal));
      sectie.citaten = cit;
    }
    blokken.push(sectie);
  }

  // SPANNING — sterkste driver vs sterkste focus.
  const topDriver = relevant[0] ?? null;
  const topFocus = p.foci.filter((f) => f.net > 0)[0] ?? null;
  if (topDriver && topFocus) {
    const sp: ML = {
      nl: `Hier zit de spanning die de meeste mensen niet zelf zien: op je goede dagen versterkt "${topDriver.construct}" net je sterkste focus "${topFocus.construct}" — hij geeft je de drive om er vol voor te gaan. Maar onder druk slaat diezelfde "${topDriver.construct}" door en keert hij zich tégen je sterkste gebied: wat eerst moeiteloos voelde, gaat dan krampachtig aanvoelen. Ruimte maken van je driver betekent niet hem uitschakelen, maar hem kort houden net wanneer de druk stijgt.`,
      fr: `Voici la tension que la plupart ne voient pas : les bons jours, « ${topDriver.construct} » renforce justement ton focus le plus fort « ${topFocus.construct} » — il te donne l'élan d'y aller à fond. Mais sous pression, ce même « ${topDriver.construct} » déraille et se retourne contre ton meilleur domaine : ce qui semblait facile devient crispé. T'en libérer ne veut pas dire l'éteindre, mais le contenir quand la pression monte.`,
      en: `Here's the tension most people don't see in themselves: on good days "${topDriver.construct}" actually reinforces your strongest focus "${topFocus.construct}" — it gives you the drive to go all in. But under pressure that same "${topDriver.construct}" derails and turns against your best area: what felt effortless starts to feel forced. Creating space around your driver isn't about switching it off, but keeping it short exactly when pressure rises.`,
      es: `Aquí está la tensión que la mayoría no ve en sí misma: en los buenos días «${topDriver.construct}» refuerza precisamente tu foco más fuerte «${topFocus.construct}» — te da el impulso para ir a fondo. Pero bajo presión ese mismo «${topDriver.construct}» se descontrola y se vuelve contra tu mejor área: lo que parecía sin esfuerzo se vuelve forzado. Darle espacio no es apagarlo, sino contenerlo justo cuando sube la presión.`,
      ru: `Вот напряжение, которое большинство не замечает в себе: в хорошие дни «${topDriver.construct}» как раз усиливает ваш сильнейший фокус «${topFocus.construct}» — даёт драйв выкладываться полностью. Но под давлением тот же «${topDriver.construct}» выходит из-под контроля и оборачивается против вашей лучшей области: то, что давалось легко, становится натужным. Дать ему пространство — не выключить его, а сдерживать именно тогда, когда растёт давление.`,
    };
    blokken.push({ type: "spanning", paragrafen: [k(sp, taal)] });
  }

  // REFLECTIE.
  const refl: ML = {
    nl: "Denk aan een recente situatie waarin de druk opliep:",
    fr: "Pense à une situation récente où la pression montait :",
    en: "Think of a recent situation where pressure rose:",
    es: "Piensa en una situación reciente en que subió la presión:",
    ru: "Вспомните недавнюю ситуацию, когда нарастало давление:",
  };
  const vragen: ML[] = [
    { nl: topDriver ? `Wat deed je toen — herken je "${topDriver.construct}" die het overnam?` : "Wat deed je toen het lastig werd?", fr: topDriver ? `Qu'as-tu fait alors — reconnais-tu « ${topDriver.construct} » qui prenait le dessus ?` : "Qu'as-tu fait quand c'est devenu difficile ?", en: topDriver ? `What did you do then — do you recognise "${topDriver.construct}" taking over?` : "What did you do when it got hard?", es: topDriver ? `¿Qué hiciste entonces — reconoces a «${topDriver.construct}» tomando el control?` : "¿Qué hiciste cuando se puso difícil?", ru: topDriver ? `Что вы тогда сделали — узнаёте ли «${topDriver.construct}», который брал верх?` : "Что вы сделали, когда стало трудно?" },
    { nl: "Wat zou één kleine stap zijn om die driver kort te houden de volgende keer?", fr: "Quelle petite étape pour contenir ce driver la prochaine fois ?", en: "What would be one small step to keep that driver short next time?", es: "¿Cuál sería un pequeño paso para contener ese driver la próxima vez?", ru: "Какой маленький шаг поможет сдержать этот driver в следующий раз?" },
  ];
  blokken.push({ type: "reflectie", paragrafen: [k(refl, taal)], vragen: vragen.map((v) => k(v, taal)) });

  // SYNTHESE.
  const syn: ML = {
    nl: topDriver
      ? `De rode draad: "${topDriver.construct}" is je motor én je valkuil. Niet bestrijden, maar herkennen vóór hij je stuurt — dat is precies waar deze module naar verwijst. Het moment waarop je merkt dat hij doorslaat, is het moment om bewust een stap terug te zetten.`
      : `De rode draad: je drivers spelen een relatief milde rol — gunstig, maar blijf alert op momenten van hoge druk, want dan worden ze het snelst zichtbaar.`,
    fr: topDriver
      ? `Le fil rouge : « ${topDriver.construct} » est ton moteur et ton piège. Ne pas le combattre, mais le reconnaître avant qu'il te dirige — c'est exactement ce vers quoi pointe ce module.`
      : `Le fil rouge : tes drivers jouent un rôle relativement modéré — favorable, mais reste attentif aux moments de forte pression.`,
    en: topDriver
      ? `The through-line: "${topDriver.construct}" is both your engine and your pitfall. Don't fight it, but spot it before it steers you — exactly what this module points to. The moment you notice it derailing is the moment to consciously step back.`
      : `The through-line: your drivers play a relatively mild role — favourable, but stay alert during high-pressure moments, when they surface fastest.`,
    es: topDriver
      ? `El hilo conductor: «${topDriver.construct}» es tu motor y tu trampa. No combatirlo, sino reconocerlo antes de que te dirija — justo a lo que apunta este módulo.`
      : `El hilo conductor: tus drivers juegan un papel relativamente suave — favorable, pero mantente alerta en momentos de mucha presión.`,
    ru: topDriver
      ? `Ключевая линия: «${topDriver.construct}» — и ваш двигатель, и ваша ловушка. Не бороться с ним, а распознать прежде, чем он начнёт вами управлять — именно на это указывает этот модуль.`
      : `Ключевая линия: ваши drivers играют относительно мягкую роль — благоприятно, но будьте внимательны в моменты высокого давления.`,
  };
  blokken.push({ type: "synthese", paragrafen: [k(syn, taal)] });

  return blokken;
}


// --- Module: Out-of-the-box / je onbenutte ruimte ---------------------------
// Reconstrueert hoofdstuk 19 van het profiel ("Toekomstpistes en
// carriere-kansen") volledig uit het contract: het projecteert het dragende
// talent naar richtingen waarin het de komende jaren nog meer kan renderen.
// GEEN voorspelling en GEEN jobadvies, wel een uitnodiging om buiten de
// gebaande paden te onderzoeken. Alles is afgeleid uit cijfers in het contract
// (net-scores + avgEnergy + energiediscrepantie); geen verzonnen feiten.
function bouwOutOfTheBox(p: ModuleProfiel, taal: Taal): ModuleBlok[] {
  const blokken: ModuleBlok[] = [];
  const fociPos = p.foci.filter((f) => f.net > 0);
  const topFocus = fociPos[0]?.construct ?? p.foci[0]?.construct ?? "\u2014";
  const tweedeFocus = fociPos[1]?.construct ?? null;
  const versnPos = p.versnellers.filter((v) => v.net > 0);
  const topVersn = versnPos[0]?.construct ?? p.versnellers[0]?.construct ?? "\u2014";
  const tweedeVersn = versnPos[1]?.construct ?? null;
  // Onderbenutte maar energierijke versneller = de "eigen, herkenbare stem".
  // "Constructief onderscheidend" is hiervoor semantisch het meest passend
  // (letterlijk: een eigen onderscheidende lijn); geef die voorrang wanneer hij
  // onderbenut maar energierijk is, en val anders terug op de energierijkste
  // onderbenutte versneller.
  const onderbenutKandidaten = [...p.versnellers]
    .filter((v) => v.net <= 0 && v.avgEnergy >= 0.5)
    .sort((a, b) => b.avgEnergy - a.avgEnergy);
  const energierijkOnderbenut =
    onderbenutKandidaten.find((v) => v.construct === "Constructief onderscheidend")?.construct ??
    onderbenutKandidaten[0]?.construct ??
    null;
  const sterksteDriver = p.driversAanwezig[0]?.construct ?? p.drivers[0]?.construct ?? null;
  const tapasBeeldPos = p.tapasBeeld && p.tapasBeeld.net > 0;

  // INTRO \u2014 bewust verder kijken dan de huidige rol.
  const intro: ML = {
    nl: `Dit deel kijkt bewust verder dan je huidige rol. Het projecteert je dragende talent \u2014 vooral "${topVersn}"${tweedeVersn ? ` en "${tweedeVersn}"` : ``}, gevoed door je focus "${topFocus}"${tweedeFocus ? ` en "${tweedeFocus}"` : ``} \u2014 naar richtingen waarin het de komende jaren n\u00f3g meer kan renderen. Geen voorspelling en zeker geen kant-en-klaar jobadvies, w\u00e9l een uitgesproken uitnodiging om groot en buiten de gebaande paden te denken. Hieronder staan drie pistes \u2014 elk met waarom het bij jou rendeert, wat het van je vraagt, en een vraag om mee te nemen.`,
    fr: `Cette partie regarde volontairement au-del\u00e0 de ton r\u00f4le actuel. Elle projette ton talent porteur \u2014 surtout \u00ab\u00a0${topVersn}\u00a0\u00bb${tweedeVersn ? ` et \u00ab\u00a0${tweedeVersn}\u00a0\u00bb` : ``}, nourri par ton focus \u00ab\u00a0${topFocus}\u00a0\u00bb${tweedeFocus ? ` et \u00ab\u00a0${tweedeFocus}\u00a0\u00bb` : ``} \u2014 vers des directions o\u00f9 il peut rendre encore davantage. Pas une pr\u00e9diction ni un conseil de carri\u00e8re tout fait, mais une invitation \u00e0 voir grand et hors des sentiers battus. Trois pistes ci-dessous.`,
    en: `This part deliberately looks beyond your current role. It projects your carrying talent \u2014 above all "${topVersn}"${tweedeVersn ? ` and "${tweedeVersn}"` : ``}, fed by your focus "${topFocus}"${tweedeFocus ? ` and "${tweedeFocus}"` : ``} \u2014 toward directions where it can render even more in the years ahead. Not a prediction and certainly not ready-made job advice, but an outspoken invitation to think big and off the beaten track. Three directions follow.`,
    es: `Esta parte mira deliberadamente m\u00e1s all\u00e1 de tu rol actual. Proyecta tu talento portador \u2014 sobre todo \u00ab${topVersn}\u00bb${tweedeVersn ? ` y \u00ab${tweedeVersn}\u00bb` : ``}, alimentado por tu foco \u00ab${topFocus}\u00bb${tweedeFocus ? ` y \u00ab${tweedeFocus}\u00bb` : ``} \u2014 hacia direcciones donde puede rendir a\u00fan m\u00e1s en los pr\u00f3ximos a\u00f1os. No es una predicci\u00f3n ni un consejo de carrera, sino una invitaci\u00f3n a pensar en grande y fuera de lo trillado. Tres pistas a continuaci\u00f3n.`,
    ru: `\u042d\u0442\u0430 \u0447\u0430\u0441\u0442\u044c \u043e\u0441\u043e\u0437\u043d\u0430\u043d\u043d\u043e \u0441\u043c\u043e\u0442\u0440\u0438\u0442 \u0434\u0430\u043b\u044c\u0448\u0435 \u0432\u0430\u0448\u0435\u0439 \u043d\u044b\u043d\u0435\u0448\u043d\u0435\u0439 \u0440\u043e\u043b\u0438. \u041e\u043d\u0430 \u043f\u0440\u043e\u0435\u0446\u0438\u0440\u0443\u0435\u0442 \u0432\u0430\u0448 \u043e\u043f\u043e\u0440\u043d\u044b\u0439 \u0442\u0430\u043b\u0430\u043d\u0442 \u2014 \u043f\u0440\u0435\u0436\u0434\u0435 \u0432\u0441\u0435\u0433\u043e \u00ab${topVersn}\u00bb${tweedeVersn ? ` \u0438 \u00ab${tweedeVersn}\u00bb` : ``}, \u043f\u0438\u0442\u0430\u0435\u043c\u044b\u0439 \u0444\u043e\u043a\u0443\u0441\u043e\u043c \u00ab${topFocus}\u00bb${tweedeFocus ? ` \u0438 \u00ab${tweedeFocus}\u00bb` : ``} \u2014 \u0432 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f, \u0433\u0434\u0435 \u043e\u043d \u043c\u043e\u0436\u0435\u0442 \u0440\u0430\u0441\u043a\u0440\u044b\u0442\u044c\u0441\u044f \u0435\u0449\u0451 \u0441\u0438\u043b\u044c\u043d\u0435\u0435. \u041d\u0435 \u043f\u0440\u043e\u0433\u043d\u043e\u0437, \u0430 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u043c\u044b\u0441\u043b\u0438\u0442\u044c \u0448\u0438\u0440\u0435. \u041d\u0438\u0436\u0435 \u2014 \u0442\u0440\u0438 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f.`,
  };
  blokken.push({ type: "intro", paragrafen: [k(intro, taal)] });

  // Eigen woorden die "out of the box"-denken onderbouwen (uit het profiel).
  const innovatie = p.foci.find((f) => f.construct === "Innovatie");
  const innoCit = (innovatie?.citaten ?? []).slice(0, 2).map((c) => k(c, taal)).filter(Boolean);

  // PISTE 1 \u2014 Architect van methodiek, internationaal schaalbaar.
  const p1: ML = {
    nl: `Je sterkste route \u2014 "${topVersn}"${tweedeVersn ? ` en "${tweedeVersn}"` : ``} \u2014 gecombineerd met je vernieuwings- en betekenisgedreven kern (${tapasBeeldPos ? `je zelfbeeld en ` : ``}"${topFocus}") tilt je natuurlijk naar het \u00f3ntwerpen van methodiek in plaats van die enkel toe te passen. Je rendeert waar conceptueel denken, instrumentontwikkeling en diepgaande logica samenkomen \u2014 een rol die een vakgebied niet alleen gebruikt, maar fundamenteel doordenkt en uitbouwt, en die internationaal schaalbaar is. Wat dit van je vraagt: begrens de perfectionistische rem${sterksteDriver ? ` ("${sterksteDriver}", energiekostend)` : ``} met expliciete "goed genoeg"-criteria en afrondingsmomenten, en geef je vernieuwingslijn structureel ruimte n\u00e1\u00e1st het kwaliteitswerk.`,
    fr: `Ta route la plus forte \u2014 \u00ab\u00a0${topVersn}\u00a0\u00bb${tweedeVersn ? ` et \u00ab\u00a0${tweedeVersn}\u00a0\u00bb` : ``} \u2014 combin\u00e9e \u00e0 ta motivation de sens et de renouveau te porte naturellement vers la conception de m\u00e9thode plut\u00f4t que son simple usage. Tu rends l\u00e0 o\u00f9 pens\u00e9e conceptuelle, d\u00e9veloppement d'instruments et logique profonde se rejoignent \u2014 un r\u00f4le qui ne se contente pas d'utiliser un domaine mais le repense, internationalement scalable. Ce que cela demande : contenir le frein perfectionniste${sterksteDriver ? ` (\u00ab\u00a0${sterksteDriver}\u00a0\u00bb)` : ``} avec des crit\u00e8res \u00ab\u00a0assez bon\u00a0\u00bb et donner de l'espace structurel \u00e0 ta ligne d'innovation.`,
    en: `Your strongest route \u2014 "${topVersn}"${tweedeVersn ? ` and "${tweedeVersn}"` : ``} \u2014 combined with your renewal- and meaning-driven core naturally tilts you toward designing methodology rather than merely applying it. You render where conceptual thinking, instrument development and deep logic meet \u2014 a role that doesn't just use a field but fundamentally rethinks and builds it out, and is internationally scalable. What this asks: contain the perfectionist brake${sterksteDriver ? ` ("${sterksteDriver}", energy-costing)` : ``} with explicit "good enough" criteria and closing moments, and give your innovation line structural room alongside the quality work.`,
    es: `Tu ruta m\u00e1s fuerte \u2014 \u00ab${topVersn}\u00bb${tweedeVersn ? ` y \u00ab${tweedeVersn}\u00bb` : ``} \u2014 combinada con tu n\u00facleo de renovaci\u00f3n y sentido te inclina naturalmente a dise\u00f1ar metodolog\u00eda en lugar de solo aplicarla. Rindes donde se encuentran pensamiento conceptual, desarrollo de instrumentos y l\u00f3gica profunda \u2014 un rol que no solo usa un campo sino que lo repiensa y construye, escalable internacionalmente. Lo que pide: contener el freno perfeccionista${sterksteDriver ? ` (\u00ab${sterksteDriver}\u00bb)` : ``} con criterios de \u00absuficientemente bueno\u00bb y dar espacio estructural a tu l\u00ednea de innovaci\u00f3n.`,
    ru: `\u0412\u0430\u0448 \u0441\u0438\u043b\u044c\u043d\u0435\u0439\u0448\u0438\u0439 \u043f\u0443\u0442\u044c \u2014 \u00ab${topVersn}\u00bb${tweedeVersn ? ` \u0438 \u00ab${tweedeVersn}\u00bb` : ``} \u2014 \u0432 \u0441\u043e\u0447\u0435\u0442\u0430\u043d\u0438\u0438 \u0441 \u0432\u0430\u0448\u0438\u043c \u0441\u0442\u0440\u0435\u043c\u043b\u0435\u043d\u0438\u0435\u043c \u043a \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044e \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u0432\u0435\u0434\u0451\u0442 \u0432\u0430\u0441 \u043a \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044e \u043c\u0435\u0442\u043e\u0434\u043e\u043b\u043e\u0433\u0438\u0438, \u0430 \u043d\u0435 \u043f\u0440\u043e\u0441\u0442\u043e \u0435\u0451 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044e. \u0412\u044b \u0440\u0430\u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0435\u0441\u044c \u0442\u0430\u043c, \u0433\u0434\u0435 \u0441\u0445\u043e\u0434\u044f\u0442\u0441\u044f \u043a\u043e\u043d\u0446\u0435\u043f\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u0435 \u043c\u044b\u0448\u043b\u0435\u043d\u0438\u0435 \u0438 \u0433\u043b\u0443\u0431\u043e\u043a\u0430\u044f \u043b\u043e\u0433\u0438\u043a\u0430. \u0427\u0442\u043e \u044d\u0442\u043e \u0442\u0440\u0435\u0431\u0443\u0435\u0442: \u0441\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044c \u043f\u0435\u0440\u0444\u0435\u043a\u0446\u0438\u043e\u043d\u0438\u0441\u0442\u0441\u043a\u0438\u0439 \u0442\u043e\u0440\u043c\u043e\u0437${sterksteDriver ? ` (\u00ab${sterksteDriver}\u00bb)` : ``} \u0447\u0451\u0442\u043a\u0438\u043c\u0438 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u044f\u043c\u0438 \u00ab\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0440\u043e\u0448\u043e\u00bb.`,
  };
  const s1kop: ML = { nl: "1 \u00b7 Architect van methodiek \u2014 internationaal schaalbaar", fr: "1 \u00b7 Architecte de m\u00e9thode \u2014 scalable \u00e0 l'international", en: "1 \u00b7 Architect of methodology \u2014 internationally scalable", es: "1 \u00b7 Arquitecto de metodolog\u00eda \u2014 escalable internacionalmente", ru: "1 \u00b7 \u0410\u0440\u0445\u0438\u0442\u0435\u043a\u0442\u043e\u0440 \u043c\u0435\u0442\u043e\u0434\u043e\u043b\u043e\u0433\u0438\u0438 \u2014 \u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440\u043e\u0434\u043d\u044b\u0439 \u043c\u0430\u0441\u0448\u0442\u0430\u0431" };
  const s1: ModuleBlok = { type: "sectie", kop: k(s1kop, taal), paragrafen: [k(p1, taal)] };
  if (innoCit.length) {
    const aanloop: ML = { nl: "Dit zie je terug in je eigen woorden uit de vragenlijst:", fr: "Tu le retrouves dans tes propres mots du questionnaire\u00a0:", en: "You see this back in your own words from the questionnaire:", es: "Lo ves en tus propias palabras del cuestionario:", ru: "\u042d\u0442\u043e \u0432\u0438\u0434\u043d\u043e \u0432 \u0432\u0430\u0448\u0438\u0445 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0445 \u0441\u043b\u043e\u0432\u0430\u0445 \u0438\u0437 \u043e\u043f\u0440\u043e\u0441\u043d\u0438\u043a\u0430:" };
    s1.paragrafen!.push(k(aanloop, taal));
    s1.citaten = innoCit;
  }
  blokken.push(s1);

  // PISTE 2 \u2014 Denkleider en ecosysteembouwer.
  const p2: ML = {
    nl: `Je analytisch-conceptuele kern is niet aan \u00e9\u00e9n organisatie of \u00e9\u00e9n product gebonden. In rollen als auteur, spreker, opleider of bouwer van een internationaal netwerk komt exact hetzelfde talent tot leven: doordenken, betekenis geven en anderen laten groeien \u2014 met "${tweedeVersn ?? topVersn}" als relationele diepgang${energierijkOnderbenut ? ` en "${energierijkOnderbenut}" (nu onderbenut, maar energierijk) als je eigen, herkenbare stem` : ``}. Wat dit van je vraagt: schuif die onderbenutte onderscheidende lijn bewust naar voren in plaats van ze weg te cijferen achter de inhoud. De valkuil is alles z\u00e9lf willen dragen; delegeren en co-cre\u00ebren zijn hier de hefboom.`,
    fr: `Ton noyau analytique-conceptuel n'est li\u00e9 ni \u00e0 une organisation ni \u00e0 un produit. Dans des r\u00f4les d'auteur, conf\u00e9rencier, formateur ou b\u00e2tisseur de r\u00e9seau international, exactement le m\u00eame talent prend vie\u00a0: approfondir, donner du sens et faire grandir les autres \u2014 avec \u00ab\u00a0${tweedeVersn ?? topVersn}\u00a0\u00bb comme profondeur relationnelle${energierijkOnderbenut ? ` et \u00ab\u00a0${energierijkOnderbenut}\u00a0\u00bb (sous-utilis\u00e9 mais riche en \u00e9nergie) comme voix propre` : ``}. Ce que cela demande\u00a0: mettre cette ligne en avant au lieu de l'effacer derri\u00e8re le contenu. Le pi\u00e8ge\u00a0: tout porter soi-m\u00eame ; d\u00e9l\u00e9guer et co-cr\u00e9er sont le levier.`,
    en: `Your analytical-conceptual core is bound to no single organisation or product. In roles like author, speaker, trainer or builder of an international network, exactly the same talent comes alive: thinking things through, giving meaning and growing others \u2014 with "${tweedeVersn ?? topVersn}" as relational depth${energierijkOnderbenut ? ` and "${energierijkOnderbenut}" (now under-used, yet energy-rich) as your own recognisable voice` : ``}. What this asks: deliberately push that under-used distinctive line forward instead of effacing it behind the content. The pitfall is carrying everything yourself; delegating and co-creating are the lever.`,
    es: `Tu n\u00facleo anal\u00edtico-conceptual no est\u00e1 atado a una sola organizaci\u00f3n ni producto. En roles como autor, ponente, formador o constructor de una red internacional cobra vida exactamente el mismo talento: profundizar, dar sentido y hacer crecer a otros \u2014 con \u00ab${tweedeVersn ?? topVersn}\u00bb como profundidad relacional${energierijkOnderbenut ? ` y \u00ab${energierijkOnderbenut}\u00bb (ahora infrautilizado pero rico en energ\u00eda) como tu voz propia` : ``}. Lo que pide: poner esa l\u00ednea distintiva al frente en vez de difuminarla tras el contenido. La trampa es cargarlo todo uno mismo; delegar y co-crear son la palanca.`,
    ru: `\u0412\u0430\u0448\u0435 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u043e-\u043a\u043e\u043d\u0446\u0435\u043f\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u0435 \u044f\u0434\u0440\u043e \u043d\u0435 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u043e \u043d\u0438 \u043a \u043e\u0434\u043d\u043e\u0439 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438. \u0412 \u0440\u043e\u043b\u044f\u0445 \u0430\u0432\u0442\u043e\u0440\u0430, \u0441\u043f\u0438\u043a\u0435\u0440\u0430, \u043d\u0430\u0441\u0442\u0430\u0432\u043d\u0438\u043a\u0430 \u0438\u043b\u0438 \u0441\u0442\u0440\u043e\u0438\u0442\u0435\u043b\u044f \u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440\u043e\u0434\u043d\u043e\u0439 \u0441\u0435\u0442\u0438 \u043e\u0436\u0438\u0432\u0430\u0435\u0442 \u0442\u043e\u0442 \u0436\u0435 \u0442\u0430\u043b\u0430\u043d\u0442: \u043e\u0441\u043c\u044b\u0441\u043b\u044f\u0442\u044c \u0438 \u0440\u0430\u0437\u0432\u0438\u0432\u0430\u0442\u044c \u0434\u0440\u0443\u0433\u0438\u0445 \u2014 \u0441 \u00ab${tweedeVersn ?? topVersn}\u00bb \u043a\u0430\u043a \u0440\u0435\u043b\u044f\u0446\u0438\u043e\u043d\u043d\u043e\u0439 \u0433\u043b\u0443\u0431\u0438\u043d\u043e\u0439${energierijkOnderbenut ? ` \u0438 \u00ab${energierijkOnderbenut}\u00bb \u043a\u0430\u043a \u0432\u0430\u0448\u0438\u043c \u0443\u0437\u043d\u0430\u0432\u0430\u0435\u043c\u044b\u043c \u0433\u043e\u043b\u043e\u0441\u043e\u043c` : ``}. \u041b\u043e\u0432\u0443\u0448\u043a\u0430 \u2014 \u0442\u044f\u043d\u0443\u0442\u044c \u0432\u0441\u0451 \u0441\u0430\u043c\u043e\u043c\u0443; \u0434\u0435\u043b\u0435\u0433\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0438 \u0441\u043e\u0442\u0432\u043e\u0440\u0447\u0435\u0441\u0442\u0432\u043e \u2014 \u0440\u044b\u0447\u0430\u0433.`,
  };
  const s2kop: ML = { nl: "2 \u00b7 Denkleider en bouwer van een lerend ecosysteem", fr: "2 \u00b7 Leader d'id\u00e9es et b\u00e2tisseur d'un \u00e9cosyst\u00e8me apprenant", en: "2 \u00b7 Thought leader and builder of a learning ecosystem", es: "2 \u00b7 L\u00edder de pensamiento y constructor de un ecosistema de aprendizaje", ru: "2 \u00b7 \u041b\u0438\u0434\u0435\u0440 \u043c\u043d\u0435\u043d\u0438\u0439 \u0438 \u0441\u0442\u0440\u043e\u0438\u0442\u0435\u043b\u044c \u043e\u0431\u0443\u0447\u0430\u044e\u0449\u0435\u0439 \u044d\u043a\u043e\u0441\u0438\u0441\u0442\u0435\u043c\u044b" };
  blokken.push({ type: "sectie", kop: k(s2kop, taal), paragrafen: [k(p2, taal)] });

  // PISTE 3 \u2014 Snijvlak van talent en kunst (creatieve signatuur).
  const p3: ML = {
    nl: `Je profiel draagt een uitgesproken artistiek-betekenisgevende lijn (${tapasBeeldPos ? `je zelfbeeld, ` : ``}"${topFocus}"). Uitgebouwd opent dit een richting waarin talentontwikkeling en creatief-narratief werk elkaar v\u00f3eden \u2014 van theatrale of verhalende werkvormen tot formats die organisaties anders naar mensen laten kijken. Een uniek, moeilijk kopieerbaar onderscheid. Wat dit van je vraagt: geef die creatieve lijn een formele plek n\u00e1\u00e1st het methodische werk, niet als hobby ernaast. Het vraagt de moed om twee werelden te durven verbinden die de markt meestal gescheiden houdt \u2014 en juist d\u00e1\u00e1r ligt je onderscheidingskracht.`,
    fr: `Ton profil porte une ligne artistique et porteuse de sens marqu\u00e9e (\u00ab\u00a0${topFocus}\u00a0\u00bb). D\u00e9velopp\u00e9e, elle ouvre une direction o\u00f9 d\u00e9veloppement du talent et travail cr\u00e9atif-narratif se nourrissent \u2014 des formes th\u00e9\u00e2trales aux formats qui font regarder autrement les personnes. Une distinction unique, difficile \u00e0 copier. Ce que cela demande\u00a0: donner \u00e0 cette ligne une place formelle \u00e0 c\u00f4t\u00e9 du travail m\u00e9thodique, pas comme un hobby. Le courage de relier deux mondes que le march\u00e9 s\u00e9pare \u2014 c'est l\u00e0 ta force de diff\u00e9renciation.`,
    en: `Your profile carries a pronounced artistic, meaning-giving line ("${topFocus}"). Built out, it opens a direction where talent development and creative-narrative work feed each other \u2014 from theatrical or narrative formats to formats that make organisations look at people differently. A unique, hard-to-copy distinction. What this asks: give that creative line a formal place alongside the methodical work, not as a hobby on the side. It takes the courage to connect two worlds the market usually keeps apart \u2014 and that is exactly where your distinctiveness lies.`,
    es: `Tu perfil lleva una marcada l\u00ednea art\u00edstica y de sentido (\u00ab${topFocus}\u00bb). Desarrollada, abre una direcci\u00f3n donde desarrollo del talento y trabajo creativo-narrativo se alimentan \u2014 de formas teatrales a formatos que hacen mirar distinto a las personas. Una distinci\u00f3n \u00fanica, dif\u00edcil de copiar. Lo que pide: dar a esa l\u00ednea un lugar formal junto al trabajo metodol\u00f3gico, no como un hobby. El valor de conectar dos mundos que el mercado separa \u2014 ah\u00ed est\u00e1 tu fuerza diferenciadora.`,
    ru: `\u0412\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435\u0441\u0451\u0442 \u044f\u0440\u043a\u0443\u044e \u0445\u0443\u0434\u043e\u0436\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e-\u0441\u043c\u044b\u0441\u043b\u043e\u0432\u0443\u044e \u043b\u0438\u043d\u0438\u044e (\u00ab${topFocus}\u00bb). \u0420\u0430\u0437\u0432\u0438\u0442\u0430\u044f, \u043e\u043d\u0430 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435, \u0433\u0434\u0435 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435 \u0442\u0430\u043b\u0430\u043d\u0442\u0430 \u0438 \u0442\u0432\u043e\u0440\u0447\u0435\u0441\u043a\u0430\u044f \u0440\u0430\u0431\u043e\u0442\u0430 \u043f\u0438\u0442\u0430\u044e\u0442 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0430 \u2014 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u0435, \u0442\u0440\u0443\u0434\u043d\u043e\u043a\u043e\u043f\u0438\u0440\u0443\u0435\u043c\u043e\u0435 \u043e\u0442\u043b\u0438\u0447\u0438\u0435. \u0427\u0442\u043e \u044d\u0442\u043e \u0442\u0440\u0435\u0431\u0443\u0435\u0442: \u0434\u0430\u0442\u044c \u044d\u0442\u043e\u0439 \u043b\u0438\u043d\u0438\u0438 \u0444\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u0440\u044f\u0434\u043e\u043c \u0441 \u043c\u0435\u0442\u043e\u0434\u0438\u0447\u0435\u0441\u043a\u043e\u0439 \u0440\u0430\u0431\u043e\u0442\u043e\u0439, \u0430 \u043d\u0435 \u043a\u0430\u043a \u0445\u043e\u0431\u0431\u0438. \u0418\u043c\u0435\u043d\u043d\u043e \u0442\u0430\u043c \u2014 \u0432\u0430\u0448\u0430 \u043e\u0442\u043b\u0438\u0447\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0438\u043b\u0430.`,
  };
  const s3kop: ML = { nl: "3 \u00b7 Op het snijvlak van talent en kunst \u2014 een eigen creatieve signatuur", fr: "3 \u00b7 \u00c0 la crois\u00e9e du talent et de l'art \u2014 une signature cr\u00e9ative propre", en: "3 \u00b7 At the crossroads of talent and art \u2014 your own creative signature", es: "3 \u00b7 En el cruce del talento y el arte \u2014 una firma creativa propia", ru: "3 \u00b7 \u041d\u0430 \u0441\u0442\u044b\u043a\u0435 \u0442\u0430\u043b\u0430\u043d\u0442\u0430 \u0438 \u0438\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u0430 \u2014 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u0430\u044f \u0442\u0432\u043e\u0440\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043e\u0434\u043f\u0438\u0441\u044c" };
  blokken.push({ type: "sectie", kop: k(s3kop, taal), paragrafen: [k(p3, taal)] });

  // SPANNING / BEWAKING \u2014 wat alle drie de pistes vragen.
  const bewaking: ML = {
    nl: `In alle drie is de hefboom dezelfde: analyse, betekenis en vernieuwing, gevoed door coachende diepgang. En de bewaking is ook telkens dezelfde: deze pistes vragen dat je de perfectionistische rem begrenst${sterksteDriver ? ` ("${sterksteDriver}")` : ``} \u00e9n durft te delegeren en co-cre\u00ebren in plaats van alles zelf te dragen. Zonder die twee bewegingen blijft groot talent klein en lokaal ingezet. Dit is uitdrukkelijk een hypothese, geen voorspelling \u2014 een startpunt om te onderzoeken, niet een uitspraak over wat je m\u00f3\u00e9t doen.`,
    fr: `Dans les trois, le levier est le m\u00eame\u00a0: analyse, sens et renouveau, nourris par une profondeur coachante. Et la vigilance aussi\u00a0: contenir le frein perfectionniste${sterksteDriver ? ` (\u00ab\u00a0${sterksteDriver}\u00a0\u00bb)` : ``} et oser d\u00e9l\u00e9guer et co-cr\u00e9er. Sans ces deux mouvements, un grand talent reste petit et local. C'est une hypoth\u00e8se, pas une pr\u00e9diction \u2014 un point de d\u00e9part \u00e0 explorer.`,
    en: `In all three the lever is the same: analysis, meaning and renewal, fed by coaching depth. And the watch-point is the same too: contain the perfectionist brake${sterksteDriver ? ` ("${sterksteDriver}")` : ``} and dare to delegate and co-create instead of carrying everything yourself. Without those two moves, great talent stays small and local. This is explicitly a hypothesis, not a prediction \u2014 a starting point to explore, not a statement of what you must do.`,
    es: `En las tres la palanca es la misma: an\u00e1lisis, sentido y renovaci\u00f3n, nutridos por profundidad coach. Y la vigilancia tambi\u00e9n: contener el freno perfeccionista${sterksteDriver ? ` (\u00ab${sterksteDriver}\u00bb)` : ``} y atreverte a delegar y co-crear. Sin esos dos movimientos, el gran talento queda peque\u00f1o y local. Es una hip\u00f3tesis, no una predicci\u00f3n \u2014 un punto de partida para explorar.`,
    ru: `\u0412\u043e \u0432\u0441\u0435\u0445 \u0442\u0440\u0451\u0445 \u0440\u044b\u0447\u0430\u0433 \u043e\u0434\u0438\u043d: \u0430\u043d\u0430\u043b\u0438\u0437, \u0441\u043c\u044b\u0441\u043b \u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435, \u043f\u0438\u0442\u0430\u0435\u043c\u044b\u0435 \u043a\u043e\u0443\u0447\u0438\u043d\u0433\u043e\u0432\u043e\u0439 \u0433\u043b\u0443\u0431\u0438\u043d\u043e\u0439. \u0418 \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u0442\u0430 \u0436\u0435: \u0441\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044c \u043f\u0435\u0440\u0444\u0435\u043a\u0446\u0438\u043e\u043d\u0438\u0437\u043c${sterksteDriver ? ` (\u00ab${sterksteDriver}\u00bb)` : ``} \u0438 \u043e\u0441\u043c\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0434\u0435\u043b\u0435\u0433\u0438\u0440\u043e\u0432\u0430\u0442\u044c. \u042d\u0442\u043e \u0433\u0438\u043f\u043e\u0442\u0435\u0437\u0430, \u0430 \u043d\u0435 \u043f\u0440\u043e\u0433\u043d\u043e\u0437 \u2014 \u0442\u043e\u0447\u043a\u0430 \u043e\u0442\u0441\u0447\u0451\u0442\u0430 \u0434\u043b\u044f \u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u044f.`,
  };
  blokken.push({ type: "spanning", paragrafen: [k(bewaking, taal)] });

  // REFLECTIE \u2014 de reflectievragen uit het hoofdstuk.
  const refl: ML = { nl: "Neem even de tijd voor deze vragen \u2014 ze openen meer dan ze sluiten:", fr: "Prends le temps pour ces questions \u2014 elles ouvrent plus qu'elles ne ferment\u00a0:", en: "Take a moment with these questions \u2014 they open more than they close:", es: "T\u00f3mate un momento con estas preguntas \u2014 abren m\u00e1s de lo que cierran:", ru: "\u0423\u0434\u0435\u043b\u0438\u0442\u0435 \u0432\u0440\u0435\u043c\u044f \u044d\u0442\u0438\u043c \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c \u2014 \u043e\u043d\u0438 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u044e\u0442 \u0431\u043e\u043b\u044c\u0448\u0435, \u0447\u0435\u043c \u0437\u0430\u043a\u0440\u044b\u0432\u0430\u044e\u0442:" };
  const vragen: ML[] = [
    { nl: "Als je ideeen een podium kregen zonder dat jij elk detail zelf moest bewaken \u2014 waarover zou je dan als eerste je stem laten horen?", fr: "Si tes id\u00e9es avaient une tribune sans que tu doives veiller \u00e0 chaque d\u00e9tail \u2014 sur quoi ferais-tu d'abord entendre ta voix\u00a0?", en: "If your ideas got a stage without you guarding every detail \u2014 what would you first speak up about?", es: "Si tus ideas tuvieran un escenario sin que vigiles cada detalle \u2014 \u00bfsobre qu\u00e9 alzar\u00edas la voz primero?", ru: "\u0415\u0441\u043b\u0438 \u0431\u044b \u0432\u0430\u0448\u0438 \u0438\u0434\u0435\u0438 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u0441\u0446\u0435\u043d\u0443 \u0431\u0435\u0437 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u0434\u0435\u0442\u0430\u043b\u0438 \u2014 \u043e \u0447\u0451\u043c \u0431\u044b \u0432\u044b \u0437\u0430\u0433\u043e\u0432\u043e\u0440\u0438\u043b\u0438 \u043f\u0435\u0440\u0432\u044b\u043c?" },
    { nl: "Welke vorm zou je willen geven aan talentwerk als niemand je vertelde dat methodiek en kunst niet samengaan?", fr: "Quelle forme donnerais-tu au travail sur le talent si personne ne te disait que m\u00e9thode et art ne vont pas ensemble\u00a0?", en: "What shape would you give talent work if no one told you methodology and art don't go together?", es: "\u00bfQu\u00e9 forma dar\u00edas al trabajo del talento si nadie te dijera que metodolog\u00eda y arte no van juntos?", ru: "\u041a\u0430\u043a\u0443\u044e \u0444\u043e\u0440\u043c\u0443 \u0432\u044b \u0431\u044b \u043f\u0440\u0438\u0434\u0430\u043b\u0438 \u0440\u0430\u0431\u043e\u0442\u0435 \u0441 \u0442\u0430\u043b\u0430\u043d\u0442\u043e\u043c, \u0435\u0441\u043b\u0438 \u0431\u044b \u043d\u0438\u043a\u0442\u043e \u043d\u0435 \u0433\u043e\u0432\u043e\u0440\u0438\u043b, \u0447\u0442\u043e \u043c\u0435\u0442\u043e\u0434\u043e\u043b\u043e\u0433\u0438\u044f \u0438 \u0438\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u043e \u043d\u0435\u0441\u043e\u0432\u043c\u0435\u0441\u0442\u0438\u043c\u044b?" },
    { nl: "Als niemand je tegenhield en je eigen talent de enige maat was \u2014 welke van deze drie richtingen zou je over vijf jaar het meest willen belichamen?", fr: "Si rien ne te retenait et que ton talent \u00e9tait la seule mesure \u2014 laquelle de ces trois directions voudrais-tu le plus incarner dans cinq ans\u00a0?", en: "If nothing held you back and your own talent were the only measure \u2014 which of these three directions would you most want to embody in five years?", es: "Si nada te frenara y tu talento fuera la \u00fanica medida \u2014 \u00bfcu\u00e1l de estas tres direcciones querr\u00edas encarnar m\u00e1s dentro de cinco a\u00f1os?", ru: "\u0415\u0441\u043b\u0438 \u0431\u044b \u043d\u0438\u0447\u0442\u043e \u0432\u0430\u0441 \u043d\u0435 \u0441\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u043b\u043e \u0438 \u043c\u0435\u0440\u0438\u043b\u043e\u043c \u0431\u044b\u043b \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u0430\u0448 \u0442\u0430\u043b\u0430\u043d\u0442 \u2014 \u043a\u0430\u043a\u043e\u0435 \u0438\u0437 \u0442\u0440\u0451\u0445 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0439 \u0432\u044b \u0445\u043e\u0442\u0435\u043b\u0438 \u0431\u044b \u0432\u043e\u043f\u043b\u043e\u0442\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 \u043f\u044f\u0442\u044c \u043b\u0435\u0442?" },
  ];
  blokken.push({ type: "reflectie", paragrafen: [k(refl, taal)], vragen: vragen.map((v) => k(v, taal)) });

  // SYNTHESE \u2014 actie of ontwerpimplicatie.
  const syn: ML = {
    nl: `Gebruik dit als startpunt van een gesprek dat verder durft te kijken dan je volgende opdracht. Kies \u00e9\u00e9n piste om het komende jaar concreet te verkennen, met een eerste experiment dat l\u00e1\u00e1g in risico en h\u00f3\u00f3g in leerwaarde is \u2014 en dat bewust internationaal mikt. Je hoeft niet te kiezen wat je wordt; je mag onderzoeken wat er n\u00f3g in zit.`,
    fr: `Utilise ceci comme d\u00e9part d'une conversation qui ose regarder au-del\u00e0 de ta prochaine mission. Choisis une piste \u00e0 explorer concr\u00e8tement cette ann\u00e9e, avec une premi\u00e8re exp\u00e9rience \u00e0 faible risque et \u00e0 forte valeur d'apprentissage \u2014 et qui vise l'international. Tu n'as pas \u00e0 choisir ce que tu deviens ; tu peux explorer ce qu'il reste \u00e0 d\u00e9ployer.`,
    en: `Use this as the start of a conversation that dares to look beyond your next assignment. Pick one direction to explore concretely this year, with a first experiment that is low in risk and high in learning value \u2014 and that deliberately aims international. You don't have to choose what you become; you may explore what's still in you.`,
    es: `Usa esto como inicio de una conversaci\u00f3n que se atreva a mirar m\u00e1s all\u00e1 de tu pr\u00f3ximo encargo. Elige una pista para explorar este a\u00f1o, con un primer experimento de bajo riesgo y alto valor de aprendizaje \u2014 y que apunte internacionalmente. No tienes que elegir en qu\u00e9 te conviertes; puedes explorar lo que a\u00fan llevas dentro.`,
    ru: `\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u044d\u0442\u043e \u043a\u0430\u043a \u043d\u0430\u0447\u0430\u043b\u043e \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u0430, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u0441\u043c\u043e\u0442\u0440\u0438\u0442 \u0434\u0430\u043b\u044c\u0448\u0435 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0433\u043e \u0437\u0430\u0434\u0430\u043d\u0438\u044f. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0434\u043d\u043e \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u044f \u0432 \u044d\u0442\u043e\u043c \u0433\u043e\u0434\u0443 \u0441 \u043f\u0435\u0440\u0432\u044b\u043c \u044d\u043a\u0441\u043f\u0435\u0440\u0438\u043c\u0435\u043d\u0442\u043e\u043c \u2014 \u043d\u0438\u0437\u043a\u0438\u0439 \u0440\u0438\u0441\u043a, \u0432\u044b\u0441\u043e\u043a\u0430\u044f \u0446\u0435\u043d\u043d\u043e\u0441\u0442\u044c. \u0412\u0430\u043c \u043d\u0435 \u043d\u0443\u0436\u043d\u043e \u0432\u044b\u0431\u0438\u0440\u0430\u0442\u044c, \u043a\u0435\u043c \u0441\u0442\u0430\u043d\u0435\u0442\u0435; \u043c\u043e\u0436\u043d\u043e \u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u044c, \u0447\u0442\u043e \u0435\u0449\u0451 \u0432 \u0432\u0430\u0441 \u0435\u0441\u0442\u044c.`,
  };
  blokken.push({ type: "synthese", paragrafen: [k(syn, taal)] });

  return blokken;
}

// --- Catalogus-metadata (titel/ondertitel/duur per module) ------------------
const META: Record<string, { titel: ML; ondertitel: ML; duurMin: number }> = {
  "talent-verdieping": {
    titel: { nl: "Talent-verdieping", fr: "Approfondissement des talents", en: "Talent deep-dive", es: "Profundización del talento", ru: "Углубление в таланты" },
    ondertitel: { nl: "Breng je sterkste talentfoci scherper in beeld", fr: "Affine tes focus de talent les plus forts", en: "Sharpen the picture of your strongest talent foci", es: "Afina tus focos de talento más fuertes", ru: "Уточните картину ваших сильнейших фокусов таланта" },
    duurMin: 12,
  },
  "energie-monitor": {
    titel: { nl: "Energie-monitor", fr: "Moniteur d'énergie", en: "Energy monitor", es: "Monitor de energía", ru: "Монитор энергии" },
    ondertitel: { nl: "Een snelle check van je energie op dit moment", fr: "Un contrôle rapide de ton énergie en ce moment", en: "A quick check of your energy right now", es: "Una comprobación rápida de tu energía ahora", ru: "Быстрая проверка вашей энергии сейчас" },
    duurMin: 5,
  },
  "drivers-onder-druk": {
    titel: { nl: "Drivers onder druk", fr: "Drivers sous pression", en: "Drivers under pressure", es: "Drivers bajo presión", ru: "Drivers под давлением" },
    ondertitel: { nl: "Herken je Drivers vóór ze je sturen (naar Taibi Kahler)", fr: "Reconnais tes Drivers avant qu'ils te dirigent (d'après Taibi Kahler)", en: "Spot your Drivers before they steer you (after Taibi Kahler)", es: "Reconoce tus Drivers antes de que te dirijan (según Taibi Kahler)", ru: "Распознайте свои Drivers, прежде чем они начнут вами управлять (по Taibi Kahler)" },
    duurMin: 10,
  },
  "out-of-the-box": {
    titel: { nl: "Out-of-the-box: je onbenutte ruimte", fr: "Out-of-the-box : ton espace inexploité", en: "Out-of-the-box: your untapped room", es: "Out-of-the-box: tu espacio sin explotar", ru: "Out-of-the-box: ваш нераскрытый потенциал" },
    ondertitel: { nl: "Waar je talent ruimer reikt dan je huidige context", fr: "Là où ton talent va plus loin que ton contexte actuel", en: "Where your talent reaches beyond your current context", es: "Donde tu talento llega más lejos que tu contexto actual", ru: "Где ваш талант выходит за рамки нынешнего контекста" },
    duurMin: 14,
  },
};

const DOORVRAAG: ML = {
  nl: "Wil je hier dieper op ingaan? Stel je vraag gerust aan de assistent hieronder — die kent je volledige profiel en denkt met je mee.",
  fr: "Tu veux approfondir ? Pose ta question à l'assistant ci-dessous — il connaît tout ton profil et réfléchit avec toi.",
  en: "Want to go deeper? Ask the assistant below — it knows your full profile and thinks along with you.",
  es: "¿Quieres profundizar? Pregunta al asistente abajo — conoce todo tu perfil y piensa contigo.",
  ru: "Хотите углубиться? Задайте вопрос ассистенту ниже — он знает весь ваш профиль и размышляет вместе с вами.",
};

// --- Publieke bouwfunctie ----------------------------------------------------
export function bouwModule(moduleId: string, contractRaw: unknown, taal: Taal, naam?: string | null): ModuleInhoud | null {
  const meta = META[moduleId];
  if (!meta) return null;

  const p = parseModuleProfiel(contractRaw, naam);
  let blokken: ModuleBlok[];

  if (!p.heeftProfiel) {
    blokken = [{ type: "intro", paragrafen: [k(GEEN_PROFIEL, taal)] }];
  } else if (moduleId === "talent-verdieping") {
    blokken = bouwTalentVerdieping(p, taal);
  } else if (moduleId === "energie-monitor") {
    blokken = bouwEnergieMonitor(p, taal);
  } else if (moduleId === "drivers-onder-druk") {
    blokken = bouwDriversOnderDruk(p, taal);
  } else if (moduleId === "out-of-the-box") {
    blokken = bouwOutOfTheBox(p, taal);
  } else {
    return null;
  }

  return {
    id: moduleId,
    titel: k(meta.titel, taal),
    ondertitel: k(meta.ondertitel, taal),
    duurMin: meta.duurMin,
    beschikbaar: true,
    blokken,
    doorvraagHint: k(DOORVRAAG, taal),
    disclaimer: k(DISCLAIMER, taal),
  };
}

// Lijst van module-id's die een echte inhoud hebben (voor de frontend).
export const MODULE_IDS = Object.keys(META);
