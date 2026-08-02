// ---------------------------------------------------------------------------
// Eenmalige meting voor punt 3: hoe vaak valt elk herkenbaarheidslabel en elke
// batterijzin, over een en dezelfde reeks invullingen, bij de huidige grenzen
// en bij de twee voorgestelde varianten.
//
// Draaien met: npx tsx script/meting-t4teens-labels.ts
// ---------------------------------------------------------------------------

import { laadInstrumentItems } from "../server/question-manager";
import { buildT4TeensContract } from "../server/t4teens/scoring";

const items = laadInstrumentItems("tapas-t4teens");
const WAARDEN = [-2, -1, 0, 1, 2];

// De huidige grenzen, letterlijk zoals ze in server/t4teens/rapport.ts stonden
// voor deze herstelopdracht.
function huidig(avg: number): string {
  if (avg >= 1) return "heel herkenbaar";
  if (avg >= 0.25) return "herkenbaar";
  if (avg > -0.25) return "soms wel, soms niet";
  if (avg > -1) return "minder herkenbaar";
  return "niet echt herkenbaar";
}

// Variant A: vijf labels, elk gekoppeld aan het antwoordpunt waar het
// gemiddelde het dichtst bij ligt. Het antwoordrooster heeft vijf punten, dus
// het rooster kan vijf labels dragen.
function variantA(avg: number): string {
  if (avg >= 1.5) return "heel herkenbaar";
  if (avg >= 0.5) return "herkenbaar";
  if (avg > -0.5) return "soms wel, soms niet";
  if (avg > -1.5) return "minder herkenbaar";
  return "niet echt herkenbaar";
}

// Variant B: terug naar de drie labels die nu feitelijk vallen.
function variantB(avg: number): string {
  if (avg >= 1) return "heel herkenbaar";
  if (avg > -1) return "soms wel, soms niet";
  return "niet echt herkenbaar";
}

// De huidige batterijzinnen, letterlijk.
function batterijHuidig(b: number): string {
  if (b >= 1) return "batterij goed vol";
  if (b >= 0) return "batterij redelijk op peil";
  if (b > -1) return "batterij wat lager dan gewoonlijk";
  return "batterij bijna leeg";
}

// Batterijvariant 1: de vier bestaande zinnen behouden en alleen de grenzen op
// het antwoordrooster leggen. Er komt geen nieuwe tekst bij.
function batterijVariant1(b: number): string {
  if (b >= 2) return "batterij goed vol";
  if (b >= 0) return "batterij redelijk op peil";
  if (b >= -1) return "batterij wat lager dan gewoonlijk";
  return "batterij bijna leeg";
}

// Batterijvariant 2: een vijfde zin toevoegen zodat elk antwoordpunt zijn
// eigen zin krijgt.
function batterijVariant2(b: number): string {
  if (b >= 2) return "batterij goed vol";
  if (b >= 1) return "batterij redelijk op peil";
  if (b >= 0) return "batterij half";
  if (b >= -1) return "batterij wat lager dan gewoonlijk";
  return "batterij bijna leeg";
}

function tel(namen: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of namen) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
}

function toon(titel: string, tellingen: Map<string, number>, alle: string[], totaal: number) {
  console.log(`\n${titel}  (${totaal} gemeten gemiddelden)`);
  for (const label of alle) {
    const n = tellingen.get(label) ?? 0;
    const pct = totaal ? ((n / totaal) * 100).toFixed(1) : "0.0";
    console.log(`  ${n === 0 ? "ONBEREIKBAAR " : "             "}${label.padEnd(24)} ${String(n).padStart(7)}  ${pct}%`);
  }
}

// ── De reeks invullingen ───────────────────────────────────────────────────
// Uitputtend over alle waarden per item, in twee delen:
//   1. elk item apart op elke waarde, de rest onbeantwoord
//   2. elke combinatie van de twee Facilitatie-items
// plus een groot aantal willekeurige volledige invullingen.
const gemiddelden: number[] = [];
const batterijen: number[] = [];

function verzamel(responses: Record<string, number>) {
  const c = buildT4TeensContract({ respondentCode: "M", name: "M", responses });
  for (const r of c.sections.main.constructRows) {
    if (r.beantwoord >= r.shown && typeof r.avgEnergy === "number") gemiddelden.push(r.avgEnergy);
  }
  if (typeof c.sections.main.meta.batterij === "number") batterijen.push(c.sections.main.meta.batterij);
}

for (const item of items) {
  for (const w of WAARDEN) verzamel({ [item.itemId]: w });
}
for (const a of WAARDEN) {
  for (const b of WAARDEN) verzamel({ "T4T-V3-1": a, "T4T-V4-1": b });
}

let zaad = 20260802;
const random = () => {
  zaad = (zaad * 1103515245 + 12345) % 2147483648;
  return zaad / 2147483648;
};
for (let i = 0; i < 20000; i++) {
  const responses: Record<string, number> = {};
  for (const item of items) responses[item.itemId] = WAARDEN[Math.floor(random() * 5)]!;
  verzamel(responses);
}

const ALLE5 = ["heel herkenbaar", "herkenbaar", "soms wel, soms niet", "minder herkenbaar", "niet echt herkenbaar"];
const ALLE3 = ["heel herkenbaar", "soms wel, soms niet", "niet echt herkenbaar"];

toon("HUIDIG (grenzen 1 / 0.25 / -0.25 / -1)", tel(gemiddelden.map(huidig)), ALLE5, gemiddelden.length);
toon("VARIANT A (grenzen 1.5 / 0.5 / -0.5 / -1.5, vijf labels)", tel(gemiddelden.map(variantA)), ALLE5, gemiddelden.length);
toon("VARIANT B (drie labels)", tel(gemiddelden.map(variantB)), ALLE3, gemiddelden.length);

const ALLEB_HUIDIG = ["batterij goed vol", "batterij redelijk op peil", "batterij wat lager dan gewoonlijk", "batterij bijna leeg"];
const ALLEB_VARIANT = ["batterij goed vol", "batterij redelijk op peil", "batterij half", "batterij wat lager dan gewoonlijk", "batterij bijna leeg"];
toon("BATTERIJ HUIDIG", tel(batterijen.map(batterijHuidig)), ALLEB_HUIDIG, batterijen.length);
toon("BATTERIJ VARIANT 1 (vier bestaande zinnen, grenzen op het rooster)", tel(batterijen.map(batterijVariant1)), ALLEB_HUIDIG, batterijen.length);
toon("BATTERIJ VARIANT 2 (een vijfde zin erbij)", tel(batterijen.map(batterijVariant2)), ALLEB_VARIANT, batterijen.length);
