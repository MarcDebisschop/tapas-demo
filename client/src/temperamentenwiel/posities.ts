// Temperamentenwiel — brongegevens van de speelmat.
//
// BRONWAARHEID (niets geïnterpreteerd of hertekend):
//   1. Speelmat Temperamenten version 1.0 (2022) — pixelmeting van de
//      kleurvolgorde per positie, de bandradii en de meng-markeringen.
//   2. client/src/twominscan/profielen.ts — wielposities, MBTI-equivalenten en
//      EG-codes ("VERSION JANUARY 2022").
//   3. Combinatie Temperamenten en Leiderschapstijlen (TaPasCity) — sectoren 1-8.
//
// De kleurvolgorde per positie is exact zoals op de mat. Vlakke kwadrantkleuren
// en gradiënten bestaan niet op dit wiel en mogen hier dus niet ontstaan.

export type EnergieKleur = "rood" | "geel" | "groen" | "blauw";

/** Gemeten gemiddelde matkleur per band. */
export const KLEUR: Record<EnergieKleur, string> = {
  rood: "#A42C36",
  geel: "#F8BA43",
  groen: "#519B5C",
  blauw: "#2A748F",
};

/**
 * Radii in wiel-eenheden (viewBox 1000, midden 500,500).
 * Verhoudingen 1:1 overgenomen van de mat (matradius 378 -> 360).
 */
export const RADII = {
  band1: [246, 360] as const, // 1e kleur   (mat 258-378)
  band2: [147, 246] as const, // 2e kleur   (mat 154-256)
  band3: [62, 147] as const, // 3e kleur   (mat  66-152)
  band4: [0, 62] as const, // kostkleur  (mat   0- 64)
  schaduw: 128, // donkere kernwaas van de gedrukte mat (mat r<134)
  labelband: [362, 402] as const,
  positieband: [404, 430] as const,
  tickband: [432, 442] as const,
  sectorband: [444, 480] as const,
  markerBinnen: 225, // Accommodating-zone
  markerBuiten: 292, // Classic-zone
};

export interface Positie {
  /** 1-24, positie 1 begint op 12 uur, elke positie is 15°. */
  nr: number;
  acroniem: string;
  /** [1e, 2e, 3e, kostkleur] exact zoals op de mat gemeten. */
  volgorde: EnergieKleur[];
  wielpositie: string;
  mbti: string | null;
  /** true = de mat toont twee in elkaar grijpende driehoeken (T/R-posities). */
  gemengd: boolean;
}

export const POSITIES: Positie[] = [
  { nr: 1, acroniem: "Tb O-g", volgorde: ["rood", "blauw", "groen", "geel"], wielpositie: "21-41", mbti: "ESTP", gemengd: false },
  { nr: 2, acroniem: "T/Rb O-g", volgorde: ["rood", "groen", "blauw", "geel"], wielpositie: "121-141", mbti: null, gemengd: true },
  { nr: 3, acroniem: "Tb O-z", volgorde: ["rood", "blauw", "geel", "groen"], wielpositie: "22-42", mbti: "ESTJ", gemengd: false },
  { nr: 4, acroniem: "Tb N-z", volgorde: ["rood", "geel", "blauw", "groen"], wielpositie: "23-43", mbti: "ENTJ", gemengd: false },
  { nr: 5, acroniem: "T/Rb N-a", volgorde: ["rood", "groen", "geel", "blauw"], wielpositie: "124-144", mbti: null, gemengd: true },
  { nr: 6, acroniem: "Tb N-a", volgorde: ["rood", "geel", "groen", "blauw"], wielpositie: "24-44", mbti: "ENTP", gemengd: false },
  { nr: 7, acroniem: "Rg N-z", volgorde: ["geel", "rood", "blauw", "groen"], wielpositie: "25-45", mbti: "ENFP", gemengd: false },
  { nr: 8, acroniem: "R/Tg N-z", volgorde: ["geel", "blauw", "rood", "groen"], wielpositie: "125-145", mbti: null, gemengd: true },
  { nr: 9, acroniem: "Rg N-a", volgorde: ["geel", "rood", "groen", "blauw"], wielpositie: "26-46", mbti: "ENFJ", gemengd: false },
  { nr: 10, acroniem: "Rg O-a", volgorde: ["geel", "groen", "rood", "blauw"], wielpositie: "27-47", mbti: "ESFJ", gemengd: false },
  { nr: 11, acroniem: "R/Tg O-b", volgorde: ["geel", "blauw", "groen", "rood"], wielpositie: "128-148", mbti: null, gemengd: true },
  { nr: 12, acroniem: "Rg O-b", volgorde: ["geel", "groen", "blauw", "rood"], wielpositie: "28-48", mbti: "ESFP", gemengd: false },
  { nr: 13, acroniem: "Rz N-a", volgorde: ["groen", "geel", "rood", "blauw"], wielpositie: "29-49", mbti: "INFP", gemengd: false },
  { nr: 14, acroniem: "R/Tz N-a", volgorde: ["groen", "rood", "geel", "blauw"], wielpositie: "129-149", mbti: null, gemengd: true },
  { nr: 15, acroniem: "Rz N-b", volgorde: ["groen", "geel", "blauw", "rood"], wielpositie: "30-50", mbti: "INFJ", gemengd: false },
  { nr: 16, acroniem: "Rz O-b", volgorde: ["groen", "blauw", "geel", "rood"], wielpositie: "31-51", mbti: "ISFJ", gemengd: false },
  { nr: 17, acroniem: "R/Tz O-g", volgorde: ["groen", "rood", "blauw", "geel"], wielpositie: "132-152", mbti: null, gemengd: true },
  { nr: 18, acroniem: "Rz O-g", volgorde: ["groen", "blauw", "rood", "geel"], wielpositie: "32-52", mbti: "ISFP", gemengd: false },
  { nr: 19, acroniem: "Ta O-b", volgorde: ["blauw", "groen", "geel", "rood"], wielpositie: "33-53", mbti: "ISTP", gemengd: false },
  { nr: 20, acroniem: "T/Ra O-b", volgorde: ["blauw", "geel", "groen", "rood"], wielpositie: "133-153", mbti: null, gemengd: true },
  { nr: 21, acroniem: "Ta O-g", volgorde: ["blauw", "groen", "rood", "geel"], wielpositie: "34-54", mbti: "ISTJ", gemengd: false },
  { nr: 22, acroniem: "Ta N-g", volgorde: ["blauw", "rood", "groen", "geel"], wielpositie: "35-55", mbti: "INTJ", gemengd: false },
  { nr: 23, acroniem: "T/Ra N-z", volgorde: ["blauw", "geel", "rood", "groen"], wielpositie: "136-156", mbti: null, gemengd: true },
  { nr: 24, acroniem: "Ta N-z", volgorde: ["blauw", "rood", "geel", "groen"], wielpositie: "36-56", mbti: "INTP", gemengd: false },
];

export interface Sector {
  nr: number;
  /** Middenhoek in graden, 0 = 12 uur. */
  hoek: number;
  energie: EnergieKleur;
  insights: string;
  stijl: string;
  focus: string;
}

/** Sectoren 1-8: elk 45°, gecentreerd op 0, 45, 90 ... 315 graden. */
export const SECTOREN: Sector[] = [
  { nr: 1, hoek: 0, energie: "rood", insights: "Observer – Reformer", stijl: "Resultaatgedreven leiderschap", focus: "Leveren van resultaten" },
  { nr: 2, hoek: 45, energie: "rood", insights: "Reformer – Director", stijl: "Resultaatgedreven leiderschap", focus: "Begeleiden van veranderingen" },
  { nr: 3, hoek: 90, energie: "geel", insights: "Director – Motivator", stijl: "Toekomstgericht leiderschap", focus: "Richting geven" },
  { nr: 4, hoek: 135, energie: "geel", insights: "Motivator – Inspirer", stijl: "Toekomstgericht leiderschap", focus: "Mensen meenemen" },
  { nr: 5, hoek: 180, energie: "groen", insights: "Inspirer – Helper", stijl: "Relationeel leiderschap", focus: "Samenwerking bouwen" },
  { nr: 6, hoek: 225, energie: "groen", insights: "Helper – Supporter", stijl: "Relationeel leiderschap", focus: "Mensen ondersteunen" },
  { nr: 7, hoek: 270, energie: "blauw", insights: "Supporter – Observer", stijl: "Coördinerend leiderschap", focus: "Kwaliteit bewaken" },
  { nr: 8, hoek: 315, energie: "blauw", insights: "Observer – Reformer", stijl: "Coördinerend leiderschap", focus: "Structuur brengen" },
];

/** Letter in de EG-code -> energiekleur (bron: 2MINSCAN). */
export const LETTERKLEUR: Record<string, EnergieKleur> = {
  b: "rood",
  g: "geel",
  z: "groen",
  a: "blauw",
};

/** Letterkleuren in de acroniemen, exact zoals op de mat: N magenta, O cyaan. */
export const LETTERSTIJL: Record<string, string> = {
  N: "#B32A7D",
  O: "#35AABA",
  basis: "#1c1a19",
};

/** Energietaal per kleur. Geen talent-, potentieel- of beoordelingstaal. */
export const KLEURWOORD: Record<EnergieKleur, { titel: string; kern: string }> = {
  rood: { titel: "Rood", kern: "richten en doorzetten" },
  geel: { titel: "Geel", kern: "verbinden en inspireren" },
  groen: { titel: "Groen", kern: "zorgen en verankeren" },
  blauw: { titel: "Blauw", kern: "ordenen en onderzoeken" },
};

export const KLEUREN: EnergieKleur[] = ["rood", "geel", "groen", "blauw"];

const POSITIE_INDEX: Record<string, Positie> = (() => {
  const idx: Record<string, Positie> = {};
  POSITIES.forEach((p) => {
    idx[p.wielpositie] = p;
    p.wielpositie.split("-").forEach((deel) => {
      if (!idx[deel]) idx[deel] = p;
    });
  });
  return idx;
})();

/**
 * Zoekt een positie op via de wielpositie. Zowel het volledige paar ("26-46")
 * als één helft ("26" of "46") wijst naar dezelfde positie, omdat de 2MINSCAN
 * de binnen/buiten-nuance niet meet.
 */
export function positieByWielpositie(wielpositie: string | number): Positie | null {
  return POSITIE_INDEX[String(wielpositie).trim()] ?? null;
}
