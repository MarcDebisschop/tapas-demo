// 2MINSCAN — De 24 geijkte EG-profielen + mapping.
// Bron: typologie-mappingtabel "VERSION JANUARY 2022" (Insights + MBTI-equivalenten).
// Mapping-sleutel: Insights-kleurvolgorde HOOG-TWEEDE / DERDE-LAAGSTE, gecombineerd met
// de intro/extravert-stand (X = II / EE / ambivert).
//
// LEGENDE X (uit brontabel):
//   X = EE  -> Extravert
//   X = IE of EI -> Ambivert
//   X = II  -> Introvert

import type { KleurId, KleurScore } from "./data";
import { kleurVolgorde, KLEURCODE } from "./data";

export interface ProfielRij {
  egCode: string;            // bv. "RzEEN-a" of "TbXO-g" (X wordt ingevuld)
  egCodeRaw: string;         // exact zoals brontabel, met X
  insights: string;          // bv. "GREEN-YELLOW/RED-BLUE"
  kleurvolgorde: KleurId[];  // afgeleide kleurvolgorde hoog->laag
  wielpositie: string;       // bv. "29-49" of "129-149"
  mbti: string;              // bv. "INFP" of "géén"
  band: KleurId;             // dominante kleur (bandkleur in tabel: rood/geel/groen/blauw)
}

// Hulpfunctie: zet Insights-string "RED-BLUE/GREEN-YELLOW" om naar kleurvolgorde.
const INSIGHTS_NAAR_KLEUR: Record<string, KleurId> = {
  RED: "rood", BLUE: "blauw", GREEN: "groen", YELLOW: "geel",
};
function volgordeUit(insights: string): KleurId[] {
  return insights
    .replace("/", "-")
    .split("-")
    .map((s) => INSIGHTS_NAAR_KLEUR[s.trim().toUpperCase()])
    .filter(Boolean) as KleurId[];
}

// Brontabel — 24 rijen, exact uit de JPG (jan 2022).
const RAW: Array<Omit<ProfielRij, "kleurvolgorde">> = [
  { egCodeRaw: "TbXO-g",   egCode: "TbXO-g",   insights: "RED-BLUE/GREEN-YELLOW",  wielpositie: "21-41",   mbti: "ESTP", band: "rood" },
  { egCodeRaw: "T/RbXO-g", egCode: "T/RbXO-g", insights: "RED-GREEN/BLUE-YELLOW",  wielpositie: "121-141", mbti: "géén", band: "rood" },
  { egCodeRaw: "TbXO-z",   egCode: "TbXO-z",   insights: "RED-BLUE/YELLOW-GREEN",  wielpositie: "22-42",   mbti: "ESTJ", band: "rood" },
  { egCodeRaw: "TbXN-z",   egCode: "TbXN-z",   insights: "RED-YELLOW/BLUE-GREEN",  wielpositie: "23-43",   mbti: "ENTJ", band: "rood" },
  { egCodeRaw: "T/RbXN-a", egCode: "T/RbXN-a", insights: "RED-GREEN/YELLOW-BLUE",  wielpositie: "124-144", mbti: "géén", band: "rood" },
  { egCodeRaw: "TbXN-a",   egCode: "TbXN-a",   insights: "RED-YELLOW/GREEN-BLUE",  wielpositie: "24-44",   mbti: "ENTP", band: "rood" },
  { egCodeRaw: "RgXN-z",   egCode: "RgXN-z",   insights: "YELLOW-RED/BLUE-GREEN",  wielpositie: "25-45",   mbti: "ENFP", band: "geel" },
  { egCodeRaw: "R/TgXN-z", egCode: "R/TgXN-z", insights: "YELLOW-BLUE/RED-GREEN",  wielpositie: "125-145", mbti: "géén", band: "geel" },
  { egCodeRaw: "RgXN-a",   egCode: "RgXN-a",   insights: "YELLOW-RED/GREEN-BLUE",  wielpositie: "26-46",   mbti: "ENFJ", band: "geel" },
  { egCodeRaw: "RgXO-a",   egCode: "RgXO-a",   insights: "YELLOW-GREEN/RED-BLUE",  wielpositie: "27-47",   mbti: "ESFJ", band: "geel" },
  { egCodeRaw: "T/RbXN-g", egCode: "T/RbXN-g", insights: "YELLOW-BLUE/GREEN-RED",  wielpositie: "128-148", mbti: "géén", band: "geel" },
  { egCodeRaw: "RgXO-b",   egCode: "RgXO-b",   insights: "YELLOW-GREEN/BLUE-RED",  wielpositie: "28-48",   mbti: "ESFP", band: "geel" },
  { egCodeRaw: "RzXN-a",   egCode: "RzXN-a",   insights: "GREEN-YELLOW/RED-BLUE",  wielpositie: "29-49",   mbti: "INFP", band: "groen" },
  { egCodeRaw: "R/TzXN-a", egCode: "R/TzXN-a", insights: "GREEN-RED/YELLOW-BLUE",  wielpositie: "129-149", mbti: "géén", band: "groen" },
  { egCodeRaw: "RzXN-b",   egCode: "RzXN-b",   insights: "GREEN-YELLOW/BLUE-RED",  wielpositie: "30-50",   mbti: "INFJ", band: "groen" },
  { egCodeRaw: "RzXO-b",   egCode: "RzXO-b",   insights: "GREEN-BLUE/YELLOW-RED",  wielpositie: "31-51",   mbti: "ISFJ", band: "groen" },
  { egCodeRaw: "R/TzXO-g", egCode: "R/TzXO-g", insights: "GREEN-RED/BLUE-YELLOW",  wielpositie: "132-152", mbti: "géén", band: "groen" },
  { egCodeRaw: "RzXO-g",   egCode: "RzXO-g",   insights: "GREEN-BLUE/RED-YELLOW",  wielpositie: "32-52",   mbti: "ISFP", band: "groen" },
  { egCodeRaw: "TaXO-b",   egCode: "TaXO-b",   insights: "BLUE-GREEN/YELLOW-RED",  wielpositie: "33-53",   mbti: "ISTP", band: "blauw" },
  { egCodeRaw: "T/RaXO-b", egCode: "T/RaXO-b", insights: "BLUE-YELLOW/GREEN-RED",  wielpositie: "133-153", mbti: "géén", band: "blauw" },
  { egCodeRaw: "TaXO-g",   egCode: "TaXO-g",   insights: "BLUE-GREEN/RED-YELLOW",  wielpositie: "34-54",   mbti: "ISTJ", band: "blauw" },
  { egCodeRaw: "TaXN-b",   egCode: "TaXN-b",   insights: "BLUE-RED/GREEN-YELLOW",  wielpositie: "35-55",   mbti: "INTJ", band: "blauw" },
  { egCodeRaw: "T/RaXN-z", egCode: "T/RaXN-z", insights: "BLUE-YELLOW/RED-GREEN",  wielpositie: "136-156", mbti: "géén", band: "blauw" },
  { egCodeRaw: "TaXN-z",   egCode: "TaXN-z",   insights: "BLUE-RED/YELLOW-GREEN",  wielpositie: "36-56",   mbti: "INTP", band: "blauw" },
];

export const PROFIELEN: ProfielRij[] = RAW.map((r) => ({
  ...r,
  kleurvolgorde: volgordeUit(r.insights),
}));

// Vervang "X" door de concrete intro/extravert-stand in de EG-code.
// xStand: "EE" (extravert), "II" (introvert), "X" (ambivert -> "IE")
export function vulXIn(egCodeRaw: string, xStand: "II" | "EE" | "X"): string {
  const repl = xStand === "EE" ? "EE" : xStand === "II" ? "II" : "IE";
  return egCodeRaw.replace("X", repl);
}

export interface MatchResultaat {
  profiel: ProfielRij;
  egCodeIngevuld: string;     // met X ingevuld
  egCodePositief: string;     // zonder minsegment
  minSegment: string | null;  // bv. "-a" / "-b" / "-z" / "-g"
  exacteMatch: boolean;       // exacte volgorde-match of dichtstbijzijnde
}

// Match: zoek de profielrij waarvan de top-2 kleurvolgorde (hoogste + tweede)
// overeenkomt met de gemeten kleurvolgorde. Bij meerdere kandidaten kiezen we
// op de volledige 4-kleurenvolgorde de beste overeenkomst.
export function matchProfiel(
  score: KleurScore,
  xStand: "II" | "EE" | "X"
): MatchResultaat {
  const gemeten = kleurVolgorde(score);
  const top2 = gemeten.slice(0, 2);

  // Scoor elke profielrij op overeenkomst van de volledige kleurvolgorde.
  const beoordeeld = PROFIELEN.map((p) => {
    let punten = 0;
    // hoogste kleur = zwaarst
    if (p.kleurvolgorde[0] === gemeten[0]) punten += 8;
    if (p.kleurvolgorde[1] === gemeten[1]) punten += 4;
    if (p.kleurvolgorde[2] === gemeten[2]) punten += 2;
    if (p.kleurvolgorde[3] === gemeten[3]) punten += 1;
    return { p, punten };
  }).sort((a, b) => b.punten - a.punten);

  const best = beoordeeld[0].p;
  const exact =
    best.kleurvolgorde[0] === top2[0] && best.kleurvolgorde[1] === top2[1];

  const egCodeIngevuld = vulXIn(best.egCodeRaw, xStand);
  const minMatch = egCodeIngevuld.match(/(-[a-z])$/);
  const minSegment = minMatch ? minMatch[1] : null;
  const egCodePositief = minSegment
    ? egCodeIngevuld.slice(0, egCodeIngevuld.length - minSegment.length)
    : egCodeIngevuld;

  return {
    profiel: best,
    egCodeIngevuld,
    egCodePositief,
    minSegment,
    exacteMatch: exact,
  };
}

// Hulplabels voor kleurvolgorde-weergave.
export function volgordeLabels(volgorde: KleurId[]): string {
  return volgorde.map((k) => KLEURCODE[k]).join(" · ");
}
