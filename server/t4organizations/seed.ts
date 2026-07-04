// =============================================================================
// server/t4organizations/seed.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Seedt de volledig ingevulde demonstratie-afname "Bishop & Bishop" zodat er bij
// serverstart onmiddellijk een compleet T4O-rapport zichtbaar is. De 49
// respondent-antwoordsets zijn zo GEKALIBREERD dat de BESTAANDE scoring.ts /
// rapport.ts de doelcijfers uit _t4o-spec/BISHOP-SEED-SPEC.md reproduceren
// binnen ± 0,15 per rapportwaarde. De scoring wordt NIET aangepast.
//
// Idempotent: als er al een sessie met deze naam bestaat, gebeurt er niets.
// Additief: raakt de bestaande platform-/teamscan-/HDD-seeds niet aan.
// =============================================================================

import { t4oStorage } from "./storage";
import { itemsVoorRing, type Ring } from "./instrument";
import type { T4OGroep, T4OAntwoordenMap } from "./schema";
import { GROEP_NAAR_RING } from "./schema";

const ORG_NAAM = "Bishop & Bishop";
const ORG_LABEL = "Consultancy KMO, ~49 consultants (fictieve demonstratiescan)";

// Ringverdeling (LETTERLIJK uit de spec): 5 leiding + 41 medewerker + 3 stakeholder.
const AANTAL_PER_GROEP: Record<T4OGroep, number> = {
  leiding: 5,
  medewerker: 41,
  stakeholder: 3,
};

// -----------------------------------------------------------------------------
// Kalibratiedoelen — post-reverse GEMIDDELDEN per ring (schaal 1..5).
// De scoring draait reverse-items zelf om (6 − score); wij bewaren de RUWE
// waarde en zetten reverse-items hieronder terug (6 − post) bij het genereren.
// -----------------------------------------------------------------------------

// Vlakke likert-groepen per dimensie (vermogens + neutrale dimensies). Elke groep
// deelt één ringgemiddelde; items van een ring worden gezamenlijk verdeeld zodat
// ook de kleine binnenring (5) het groepsgemiddelde nauwkeurig haalt.
interface LikertGroep {
  binnen?: number; // post-gemiddelde voor de binnenring
  midden?: number; // post-gemiddelde voor de middenring
  items: { id: string; reverse?: boolean }[];
}

const LIKERT_GROEPEN: LikertGroep[] = [
  // Identiteitscoherentie — vrije items i1..i5 (i6/i7 zijn congruentie, apart).
  { binnen: 4.108, midden: 4.108, items: [{ id: "i1" }, { id: "i2" }, { id: "i3", reverse: true }, { id: "i4" }, { id: "i5" }] },
  // Sensing — spanningsveld leiding 4,10 / werkvloer 3,24.
  { binnen: 4.1, midden: 3.24, items: [{ id: "i27" }, { id: "i28" }, { id: "i29" }, { id: "i30", reverse: true }] },
  // Seizing — org 2,83 (geen spanningsveld).
  { binnen: 2.83, midden: 2.83, items: [{ id: "i31" }, { id: "i32" }, { id: "i33" }, { id: "i34", reverse: true }] },
  // Transforming — org 3,38 (geen spanningsveld).
  { binnen: 3.38, midden: 3.38, items: [{ id: "i35" }, { id: "i36" }, { id: "i37" }, { id: "i38", reverse: true }] },
  // Exploitatiekracht — org 4,23 (geen spanningsveld).
  { binnen: 4.23, midden: 4.23, items: [{ id: "i39" }, { id: "i40" }, { id: "i41" }] },
  // Exploratiekracht — spanningsveld leiding 3,87 / werkvloer 2,33.
  { binnen: 3.87, midden: 2.33, items: [{ id: "i42" }, { id: "i43" }, { id: "i44" }] },
  // Ambidextere integratie — spanningsveld leiding 4,00 / werkvloer 3,15 (enkel i45 telt mee).
  { binnen: 4.0, midden: 3.15, items: [{ id: "i45" }] },
  // Organisatorische leerlus — org 2,82 (geen spanningsveld).
  { binnen: 2.82, midden: 2.82, items: [{ id: "i47" }, { id: "i48" }, { id: "i49", reverse: true }] },
  // Vitaliteitsitems (dimensie energie-vitaliteit; tellen niet mee in de 8 vermogens).
  { binnen: 3.5, midden: 3.5, items: [{ id: "i15" }, { id: "i16" }, { id: "i17", reverse: true }, { id: "i18" }] },
  // Teamklimaat (enkel middenring; telt niet mee in de vermogens).
  { midden: 3.6, items: [{ id: "i19" }, { id: "i20" }, { id: "i21" }, { id: "i22" }, { id: "i23" }, { id: "i24" }, { id: "i25" }, { id: "i26" }] },
  // Waardecreatie-handtekening likert (telt niet mee in de vermogens).
  { binnen: 3.4, midden: 3.4, items: [{ id: "i55" }] },
];

// Congruentie-/stakeholderitems met een EIGEN ringgemiddelde per item.
// (i6/i7/i8 → identiteit; i50/i51 → stakeholderafstemming/g_luisteren.)
interface ItemDoel {
  id: string;
  binnen?: number;
  midden?: number;
  buiten?: number;
}
const ITEM_DOELEN: ItemDoel[] = [
  { id: "i6", binnen: 4.4, midden: 4.0 }, // Woord en daad (binnen/midden)
  { id: "i7", binnen: 3.6, midden: 3.6, buiten: 3.7 }, // Zelfbeeld vs buitenbeeld
  { id: "i8", buiten: 3.7 }, // Woord en daad (buiten)
  { id: "i50", binnen: 4.4, midden: 3.8 }, // Responsiviteit naar buiten (binnen/midden)
  { id: "i51", buiten: 3.3 }, // Responsiviteit naar buiten (buiten)
];

// Energie-saldi (ENE-items i9..i14, schaal −1/0/+1), binnen+midden.
const ENERGIE_DOELEN: Record<string, number> = {
  i9: -0.3, // interne vergaderingen
  i10: -0.61, // besluitvorming
  i11: -0.46, // rapportage/administratie
  i12: 0.39, // samenwerken over teams
  i13: 0.0, // omgaan met verandering
  i14: 0.35, // omgaan met fouten
};

// Nulmeting-batterij (0..10), binnen+midden. Energie-KPI = 5,8/10.
const NULMETING_DOEL = 5.8;

// Vaste keuze-antwoorden (forced-choice); tellen niet mee in de numerieke scores
// maar maken de antwoordsets volledig. Waarden komen uit de choiceSets.
const KEUZE_ANTWOORDEN: Record<string, string | string[]> = {
  i46: "A", // "We zijn vooral sterk in betrouwbaar uitvoeren."
  i52: ["leveren_schaal", "vakmanschap", "betekenis"], // top 3 archetypen
  i53: ["processen", "samenwerking"], // floreercondities (enkel binnenring)
  i54: ["besluitvorming", "bureaucratie"], // blokkeercondities
};

// -----------------------------------------------------------------------------
// Verdelingshelpers — deterministisch, geen randomness (stabiel/idempotent).
// -----------------------------------------------------------------------------

// Verdeelt een totaal zo gelijkmatig mogelijk over n gehele waarden in [lo, hi].
function spreid(totaal: number, n: number, lo: number, hi: number): number[] {
  const begrensd = Math.max(n * lo, Math.min(n * hi, Math.round(totaal)));
  const basis = Math.floor(begrensd / n);
  let rest = begrensd - basis * n;
  const arr: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = basis + (rest > 0 ? 1 : 0);
    if (rest > 0) rest--;
    arr.push(Math.max(lo, Math.min(hi, v)));
  }
  return arr;
}

// Verdeelt likertwaarden (1..5) over n slots met streefgemiddelde `gem`.
function spreidLikert(n: number, gem: number): number[] {
  return spreid(gem * n, n, 1, 5);
}

// Verdeelt energie-saldowaarden (−1/0/+1) over n slots met streefgemiddelde `gem`.
function spreidEnergie(n: number, gem: number): number[] {
  const totaal = Math.max(-n, Math.min(n, Math.round(gem * n)));
  const arr = new Array<number>(n).fill(0);
  const aantal = Math.abs(totaal);
  const waarde = totaal >= 0 ? 1 : -1;
  for (let i = 0; i < aantal && i < n; i++) arr[i] = waarde;
  return arr;
}

// -----------------------------------------------------------------------------
// Antwoordgeneratie per ring — bouwt voor elke respondent een volledige map.
// -----------------------------------------------------------------------------
function genereerAntwoorden(groep: T4OGroep, aantal: number): T4OAntwoordenMap[] {
  const ring: Ring = GROEP_NAAR_RING[groep];
  const ringItemIds = new Set(itemsVoorRing(ring).map((it) => it.id));
  // Eén lege map per respondent.
  const maps: T4OAntwoordenMap[] = Array.from({ length: aantal }, () => ({}));

  const ringGem = (g: LikertGroep): number | undefined =>
    ring === "binnen" ? g.binnen : ring === "midden" ? g.midden : undefined;

  // 1) Vlakke likert-groepen: verdeel gezamenlijk over (respondent × groepsitem).
  for (const groepDef of LIKERT_GROEPEN) {
    const gem = ringGem(groepDef);
    if (gem == null) continue;
    const itemsInRing = groepDef.items.filter((it) => ringItemIds.has(it.id));
    if (itemsInRing.length === 0) continue;
    const flat = spreidLikert(aantal * itemsInRing.length, gem);
    let k = 0;
    for (const it of itemsInRing) {
      for (let r = 0; r < aantal; r++) {
        const post = flat[k++];
        maps[r][it.id] = it.reverse ? 6 - post : post; // ruwe waarde bewaren
      }
    }
  }

  // 2) Congruentie-/stakeholderitems met eigen ringgemiddelde.
  for (const doel of ITEM_DOELEN) {
    if (!ringItemIds.has(doel.id)) continue;
    const gem = ring === "binnen" ? doel.binnen : ring === "midden" ? doel.midden : doel.buiten;
    if (gem == null) continue;
    const waarden = spreidLikert(aantal, gem);
    for (let r = 0; r < aantal; r++) maps[r][doel.id] = waarden[r];
  }

  // 3) Energie-items (binnen + midden).
  for (const [id, gem] of Object.entries(ENERGIE_DOELEN)) {
    if (!ringItemIds.has(id)) continue;
    const waarden = spreidEnergie(aantal, gem);
    for (let r = 0; r < aantal; r++) maps[r][id] = waarden[r];
  }

  // 4) Nulmeting-batterij (binnen + midden).
  if (ringItemIds.has("nulmeting")) {
    const waarden = spreid(NULMETING_DOEL * aantal, aantal, 0, 10);
    for (let r = 0; r < aantal; r++) maps[r]["nulmeting"] = waarden[r];
  }

  // 5) Forced-choice keuze-antwoorden (vast per ring-item).
  for (const [id, waarde] of Object.entries(KEUZE_ANTWOORDEN)) {
    if (!ringItemIds.has(id)) continue;
    for (let r = 0; r < aantal; r++) maps[r][id] = Array.isArray(waarde) ? [...waarde] : waarde;
  }

  return maps;
}

// -----------------------------------------------------------------------------
// Publieke seed — idempotent bij serverstart aangeroepen.
// -----------------------------------------------------------------------------
export function seedBishop(): void {
  const bestaat = t4oStorage.alleSessies().some((s) => s.orgNaam === ORG_NAAM);
  if (bestaat) return;

  const sessie = t4oStorage.maakSessie({ orgNaam: ORG_NAAM, orgLabel: ORG_LABEL });

  (Object.keys(AANTAL_PER_GROEP) as T4OGroep[]).forEach((groep) => {
    const aantal = AANTAL_PER_GROEP[groep];
    const antwoordSets = genereerAntwoorden(groep, aantal);
    for (let i = 0; i < aantal; i++) {
      const respondent = t4oStorage.maakRespondent(sessie.id, groep);
      t4oStorage.bewaarAntwoorden(respondent.id, antwoordSets[i]); // markeert afgerond
    }
  });
}
