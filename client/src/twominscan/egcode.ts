// 2MINSCAN — EG-code decoder + energietaal-bouwstenen.
// De EG-code wordt nooit als label gelezen, maar als taal voor energie in professioneel gedrag.
// Letters: T=taakgericht R=relatiegericht N=intuïtief O=observerend
//          A=analyse Z=zorgend B=beslissingsgericht G=groepsgericht. Minteken = energiekost.
//
// BELANGRIJKE NUANCE (intro/extravert-blok):
//   De TWEE opeenvolgende I/E-letters vormen SAMEN één concept — de intro/extravert-stand.
//   Ze worden NOOIT per letter apart omschreven.
//     EE        -> "Uitgesproken extravert"
//     II        -> "Uitgesproken introvert"
//     IE of EI  -> "Ambivert" (schakelt afhankelijk van de context vlot tussen
//                  introversie en extraversie, zonder dat dat veel energie kost)

import { t as tr, type Taal } from "./i18n";

export interface EGLetter {
  letter: string;       // weergaveletter(s), bv. "T" of "EE"
  sleutel: string;      // genormaliseerde sleutel (T/R/N/O/A/Z/B/G of IE-blok)
  titel: string;        // mensvriendelijke titel
  uitleg: string;       // korte energietaal-uitleg
}

const LETTER_DEFS: Record<string, { titel: string; uitleg: string }> = {
  T: { titel: "Taakgericht", uitleg: "Energie gaat eerst naar wat concreet moet gebeuren: feiten, resultaat en het realiseren van de taak." },
  R: { titel: "Relatiegericht", uitleg: "Energie start wanneer de afstemming met anderen veilig, respectvol en oprecht voelt." },
  N: { titel: "Intuïtief", uitleg: "Je vangt signalen op die nog niet volledig feitelijk uitgesproken zijn en bent gericht op wat mogelijk is." },
  O: { titel: "Observerend", uitleg: "Je neemt bewust en zintuiglijk waar in het hier-en-nu en staat stil bij wat je concreet ziet." },
  A: { titel: "Analyse", uitleg: "Je geeft energie door te onderzoeken, te ordenen en helderheid te brengen in wat klopt." },
  Z: { titel: "Zorgend", uitleg: "Je geeft energie door te ondersteunen, te erkennen en spanning menselijker te maken." },
  B: { titel: "Beslissingsgericht", uitleg: "Je geeft energie door knopen door te hakken, richting te kiezen en in beweging te komen." },
  G: { titel: "Groepsgericht", uitleg: "Je geeft energie door mensen samen te brengen en gedeelde beweging te zoeken." },
};

// Het intro/extravert-blok (twee I/E-letters samen = één concept).
type IEStand = "EE" | "II" | "AMBI";
const IE_DEFS: Record<IEStand, { titel: string; uitleg: string; chip: string }> = {
  EE: {
    titel: "Uitgesproken extravert",
    uitleg: "Je energie beweegt sterk naar buiten via interactie, gesprek en gedeelde activiteit. Je laadt vooral op in contact met anderen.",
    chip: "uitgesproken extravert",
  },
  II: {
    titel: "Uitgesproken introvert",
    uitleg: "Je laadt vooral op door naar binnen te keren: reflecteren, intern verwerken en eerst ordenen voor je naar buiten treedt.",
    chip: "uitgesproken introvert",
  },
  AMBI: {
    titel: "Ambivert",
    uitleg: "Je herkent je zowel in introversie als in extraversie en schakelt afhankelijk van de situatie vlot tussen beide, zonder dat dat veel energie kost.",
    chip: "ambivert",
  },
};

// Energietaal voor het minsegment (energiekost).
const MIN_DEFS: Record<string, { titel: string; uitleg: string }> = {
  a: { titel: "Analyse als energiekost", uitleg: "Analyse, detailwerk en bewijsdruk kosten energie wanneer ze losstaan van betekenis, menselijk nut of duidelijke richting." },
  z: { titel: "Zorgen als energiekost", uitleg: "Voortdurend zorgen voor de relatie en harmonie kan energie kosten wanneer er geen ruimte is voor eigen grenzen of voortgang." },
  b: { titel: "Beslissen als energiekost", uitleg: "Snel moeten beslissen en doorduwen kost energie wanneer er te weinig ruimte is voor reflectie of afstemming." },
  g: { titel: "Groep als energiekost", uitleg: "Voortdurend in de groep moeten zijn kost energie wanneer er te weinig ruimte is voor focus of rust." },
};

function ieStandVan(twee: string): IEStand {
  const s = twee.toUpperCase();
  if (s === "EE") return "EE";
  if (s === "II") return "II";
  return "AMBI"; // IE of EI
}

// Leid de intro/extravert-stand af uit een volledige EG-code (bv. "RgEEO-a" -> "EE").
// Zoekt het eerste paar opeenvolgende I/E-letters. Valt terug op "AMBI".
export type { IEStand };
export function ieStandUitCode(egCode: string): IEStand {
  const clean = egCode.replace(/\//g, "").toUpperCase();
  for (let i = 0; i + 1 < clean.length; i++) {
    const a = clean[i];
    const b = clean[i + 1];
    if ((a === "I" || a === "E") && (b === "I" || b === "E")) {
      return ieStandVan(a + b);
    }
  }
  return "AMBI";
}

// Splits een EG-code in betekenisvolle delen.
export interface EGOntleed {
  positief: string;            // bv. "RgEEO"
  minSegment: string | null;   // bv. "-a"
  letters: EGLetter[];         // de positieve letters/blokken (intro-extravert = één blok)
  min: { titel: string; uitleg: string } | null;
  samenvattingChips: string[]; // bv. ["relatie","groepsgericht","uitgesproken extravert","observerend"]
}

export function ontleedEGCode(egCode: string, taal: Taal = "nl"): EGOntleed {
  // Slash (dubbele richting) is louter een notatie-scheiding; voor de decoder
  // lezen we de letters lineair.
  const clean = egCode.replace(/\//g, "");
  const minMatch = clean.match(/(-[a-z])$/);
  const minSegment = minMatch ? minMatch[1] : null;
  const positief = minSegment ? clean.slice(0, clean.length - minSegment.length) : clean;

  const letters: EGLetter[] = [];
  const chips: string[] = [];

  for (let i = 0; i < positief.length; i++) {
    const ch = positief[i];
    const up = ch.toUpperCase();

    // Intro/extravert-blok: twee opeenvolgende I/E-letters worden SAMEN gelezen.
    if ((up === "I" || up === "E") && i + 1 < positief.length) {
      const next = positief[i + 1].toUpperCase();
      if (next === "I" || next === "E") {
        const blok = up + next; // "EE" / "II" / "IE" / "EI"
        const stand = ieStandVan(blok);
        const def = IE_DEFS[stand];
        const titel = tr(taal, `ie.${stand}.titel`, def.titel);
        const uitleg = tr(taal, `ie.${stand}.uitleg`, def.uitleg);
        const chip = tr(taal, `ie.${stand}.chip`, def.chip);
        letters.push({ letter: blok, sleutel: "IE", titel, uitleg });
        chips.push(chip);
        i++; // sla de tweede letter over
        continue;
      }
    }

    const def = LETTER_DEFS[up];
    if (!def) continue;
    const titel = tr(taal, `letter.${up}.titel`, def.titel);
    const uitleg = tr(taal, `letter.${up}.uitleg`, def.uitleg);
    letters.push({ letter: ch, sleutel: up, titel, uitleg });
    chips.push(tr(taal, `chip.${up}`, chipLabel(up, def.titel)));
  }

  const minDef = minSegment ? MIN_DEFS[minSegment[1]] : null;
  const min = minSegment
    ? minDef
      ? {
          titel: tr(taal, `min.${minSegment[1]}.titel`, minDef.titel),
          uitleg: tr(taal, `min.${minSegment[1]}.uitleg`, minDef.uitleg),
        }
      : {
          titel: tr(taal, "min.fallback.titel", "Energiekost"),
          uitleg: tr(taal, "min.fallback.uitleg", "Dit deel van de code vraagt energie wanneer het losstaat van betekenis of richting."),
        }
    : null;

  return { positief, minSegment, letters, min, samenvattingChips: chips };
}

function chipLabel(key: string, titel: string): string {
  const map: Record<string, string> = {
    T: "taakgericht", R: "relatie",
    N: "intuïtief", O: "observerend", A: "analyse", Z: "zorgend",
    B: "beslissend", G: "groepsgericht",
  };
  return map[key] ?? titel.toLowerCase();
}
