// ---------------------------------------------------------------------------
// client/src/pages/t4kids/woordanalyse.ts — "de onzichtbare laag" (additief).
//
// Neemt de EIGEN WOORDEN van het kind (de `waarom`-teksten bij de gekozen
// figuren op Eiland 2) serieus als een zachte, respectvolle blik in zijn/haar
// leefwereld. Puur client-side tekstanalyse via eenvoudige, robuuste
// keyword-matching (case-insensitive, NL/Vlaams). Bevat GEEN dataflow/scoring
// en raakt het contract niet aan — enkel afgeleide inzichten voor het rapport.
//
// We zoeken:
//   • een VOORZICHTIGE rode draad: welke motief-buckets keren terug in de woorden
//   • het VERBINDENDE: eenzelfde motief bij meerdere figuren
//   • het VERWONDERLIJKE: waar de woorden ergens ánders heen wijzen dan het
//     figuur-label (focus) — bv. "de uitvinder" (creatief) maar "ik help anderen
//     graag" (helpen). Dat is de onzichtbare laag onder ons archetype-label.
// ---------------------------------------------------------------------------

export type MotiefSleutel =
  | "HELPEN"
  | "UITZOEKEN"
  | "MAKEN"
  | "AVONTUUR"
  | "ECHT"
  | "PRESTEREN";

export interface Motief {
  sleutel: MotiefSleutel;
  /** Warme kindtaal-omschrijving van het motief. */
  label: string;
  trefwoorden: string[];
}

// Motief-buckets + trefwoorden (NL/Vlaams). Bewust robuust en uitbreidbaar.
export const MOTIEVEN: Motief[] = [
  {
    sleutel: "HELPEN",
    label: "anderen helpen en er zijn voor iemand",
    trefwoorden: [
      "help",
      "helpen",
      "zorgen",
      "zorg voor",
      "anderen",
      "samen",
      "iemand",
      "blij maken",
      "vrienden",
      "vriend",
    ],
  },
  {
    sleutel: "UITZOEKEN",
    label: "dingen uitzoeken en snappen hoe ze werken",
    trefwoorden: [
      "uitzoeken",
      "ontdekken hoe",
      "snap",
      "snappen",
      "begrijp",
      "begrijpen",
      "hoe werkt",
      "raadsel",
      "oploss",
      "moeilijke dingen",
      "puzzel",
    ],
  },
  {
    sleutel: "MAKEN",
    label: "zelf iets maken, bouwen of verzinnen",
    trefwoorden: [
      "maken",
      "maak",
      "bouwen",
      "bouw",
      "uitvinden",
      "uitvind",
      "tekenen",
      "teken",
      "verzinnen",
      "verzin",
      "ontwerp",
      "creatief",
      "knutsel",
    ],
  },
  {
    sleutel: "AVONTUUR",
    label: "op avontuur gaan en nieuwe dingen ontdekken",
    trefwoorden: [
      "avontuur",
      "ontdekken",
      "nieuw",
      "reizen",
      "reis",
      "verkennen",
      "spannend",
    ],
  },
  {
    sleutel: "ECHT",
    label: "gewoon jezelf mogen zijn",
    trefwoorden: [
      "voelt als ik",
      "echt ik",
      "mezelf",
      "wie ik ben",
      "past bij mij",
      "bij mij",
    ],
  },
  {
    sleutel: "PRESTEREN",
    label: "iets goed en knap willen doen",
    trefwoorden: ["goed", "best", "winnen", "juist", "perfect", "netjes"],
  },
];

// Focus-label (ons archetype-label) → verwacht motief. Gebruikt om te bepalen
// of de eigen woorden van het kind ergens ánders heen wijzen dan het figuur.
const FOCUS_NAAR_MOTIEF: Record<string, MotiefSleutel> = {
  "Sociaal-gericht": "HELPEN",
  "Overdracht-gericht": "HELPEN",
  Abstraherend: "UITZOEKEN",
  Analyserend: "UITZOEKEN",
  "Doelgericht-Creatief": "MAKEN",
  "Artistiek-Creatief": "MAKEN",
  Creatief: "MAKEN",
  Uitvoerend: "PRESTEREN",
  Doelgericht: "PRESTEREN",
};

const motiefVoorSleutel = (s: MotiefSleutel): Motief =>
  MOTIEVEN.find((m) => m.sleutel === s)!;

// Normaliseer een tekst: lowercase, interpunctie → spatie, dubbele spaties weg.
function normaliseer(tekst: string): string {
  return (tekst || "")
    .toLowerCase()
    .replace(/[^0-9a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tel per motief het aantal trefwoord-treffers in één (genormaliseerde) tekst.
function treffersPerMotief(genormaliseerd: string): Map<MotiefSleutel, number> {
  const map = new Map<MotiefSleutel, number>();
  if (!genormaliseerd) return map;
  for (const motief of MOTIEVEN) {
    let n = 0;
    for (const tw of motief.trefwoorden) {
      const naald = tw.toLowerCase();
      // Woord-grens waar mogelijk; substring voor stammen/samenstellingen.
      let idx = genormaliseerd.indexOf(naald);
      while (idx !== -1) {
        n += 1;
        idx = genormaliseerd.indexOf(naald, idx + naald.length);
      }
    }
    if (n > 0) map.set(motief.sleutel, n);
  }
  return map;
}

export interface WaaromFiguur {
  naam: string;
  focus: string;
  waarom: string;
}

export interface Divergentie {
  figuurNaam: string;
  figuurFocus: string;
  woordMotief: Motief;
  citaat: string;
  /** Kant-en-klare, warme, verwonderde zin voor het rapport. */
  zin: string;
}

export interface WoordAnalyse {
  heeftWoorden: boolean;
  /** 1-2 sterkste motief-buckets (voorzichtige rode draad), sterkste eerst. */
  rodeDraad: { motief: Motief; figuren: number }[];
  /** Een echt citaat van het kind dat de sterkste rode draad illustreert. */
  citaat: string | null;
  /** Eenzelfde motief bij ≥2 figuren = iets verbindends. */
  verbindend: { motief: Motief; figuren: string[] } | null;
  /** Woord ≠ figuur-label: de "onzichtbare laag". */
  divergenties: Divergentie[];
}

const LEEG: WoordAnalyse = {
  heeftWoorden: false,
  rodeDraad: [],
  citaat: null,
  verbindend: null,
  divergenties: [],
};

export function analyseerWoorden(figuren: WaaromFiguur[]): WoordAnalyse {
  const metWoorden = (figuren ?? []).filter(
    (f) => normaliseer(f.waarom).length > 0,
  );
  if (metWoorden.length === 0) return { ...LEEG };

  // Per figuur: welke motieven komen voor + het dominante motief van dat figuur.
  const figuurMotieven = metWoorden.map((f) => {
    const genorm = normaliseer(f.waarom);
    const treffers = treffersPerMotief(genorm);
    // Dominant motief van dít figuur (meeste treffers; tie-break = MOTIEVEN-volgorde).
    let dominant: MotiefSleutel | null = null;
    let hoogste = 0;
    for (const motief of MOTIEVEN) {
      const n = treffers.get(motief.sleutel) ?? 0;
      if (n > hoogste) {
        hoogste = n;
        dominant = motief.sleutel;
      }
    }
    return { figuur: f, treffers, dominant };
  });

  // Rode draad: tel in hoeveel figuren elk motief voorkomt.
  const figurenPerMotief = new Map<MotiefSleutel, string[]>();
  for (const fm of figuurMotieven) {
    for (const sleutel of Array.from(fm.treffers.keys())) {
      const lijst = figurenPerMotief.get(sleutel) ?? [];
      lijst.push(fm.figuur.naam);
      figurenPerMotief.set(sleutel, lijst);
    }
  }
  const rodeDraad = Array.from(figurenPerMotief.entries())
    .map(([sleutel, namen]) => ({ motief: motiefVoorSleutel(sleutel), figuren: namen.length }))
    .sort((a, b) => b.figuren - a.figuren)
    .slice(0, 2);

  // Citaat dat de sterkste rode draad illustreert.
  let citaat: string | null = null;
  if (rodeDraad.length > 0) {
    const top = rodeDraad[0]!.motief.sleutel;
    const bron = figuurMotieven.find((fm) => fm.treffers.has(top));
    citaat = bron ? bron.figuur.waarom.trim() : null;
  }
  if (!citaat) citaat = metWoorden[0]!.waarom.trim();

  // Verbindend: sterkste motief dat bij ≥2 figuren terugkeert.
  let verbindend: WoordAnalyse["verbindend"] = null;
  for (const rd of rodeDraad) {
    const namen = figurenPerMotief.get(rd.motief.sleutel) ?? [];
    const uniek = Array.from(new Set(namen));
    if (uniek.length >= 2) {
      verbindend = { motief: rd.motief, figuren: uniek };
      break;
    }
  }

  // Divergenties: dominante woord-motief ≠ het motief achter het figuur-label.
  const divergenties: Divergentie[] = [];
  for (const fm of figuurMotieven) {
    if (!fm.dominant) continue;
    const verwacht = FOCUS_NAAR_MOTIEF[fm.figuur.focus];
    if (!verwacht || verwacht === fm.dominant) continue;
    const woordMotief = motiefVoorSleutel(fm.dominant);
    const citaatFig = fm.figuur.waarom.trim();
    divergenties.push({
      figuurNaam: fm.figuur.naam,
      figuurFocus: fm.figuur.focus,
      woordMotief,
      citaat: citaatFig,
      zin: `Grappig en fijn: je koos ${fm.figuur.naam}, maar je schreef erbij “${citaatFig}”. Misschien wil je vooral ${woordMotief.label}? Dat is een mooie combinatie om samen te ontdekken.`,
    });
  }

  return {
    heeftWoorden: true,
    rodeDraad,
    citaat,
    verbindend,
    divergenties,
  };
}
