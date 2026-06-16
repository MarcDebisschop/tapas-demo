import itembankJson from "./itembank.json";
import interpretatieJson from "./interpretatie.json";

/**
 * TaPas Teamscan — scoringslogica.
 * ------------------------------------------------------------------
 * Berekent uit ruwe antwoorden:
 *   • Fundament-gemiddelde + niveau
 *   • 5 Lencioni-pijlergemiddelden + niveaus
 *   • Patroonherkenning -> interpretatieprofiel
 *   • Vertrouwensanatomie: gedeeld profiel + gap-matrix
 *   • Team-aggregatie (gemiddelde van individuele pijlergemiddelden)
 *
 * De config (itembank.json, interpretatie.json) wordt rechtstreeks
 * geïmporteerd zodat esbuild ze meebundelt in dist/index.cjs.
 */

export const itembank: any = itembankJson;
export const interpretatie: any = interpretatieJson;

export type Niveau = "hoog" | "gemiddeld" | "laag";

export interface PijlerResultaat {
  code: string;
  naam: string;
  niveau: number; // piramideniveau (1 = fundament .. 6 = resultaten)
  gemiddelde: number;
  niveauLabel: Niveau;
  kleur: string;
  kleurFamilie: string;
  korteUitleg: string;
}

export interface GapItem {
  id: string;
  naam: string;
  rang: number;
  gewicht: number;
  prestatie: number;
  categorie: "kritiekPijnpunt" | "bewaken" | "lageprioriteit" | "neutraal";
}

export interface IndividueelResultaat {
  fundament: PijlerResultaat;
  pijlers: PijlerResultaat[]; // 5 Lencioni-pijlers (niveau 2..6)
  patroon: {
    sleutel: string;
    titel: string;
    beschrijving: string;
    watGoed: string;
    waarBangVoor: string;
    hoeVerbeteren: string;
    laagstePijler: string | null;
    fundamentEerst: boolean;
  };
  vertrouwen: {
    ranking: Record<string, number>;
    prestatie: Record<string, number>;
    gap: GapItem[];
  };
}

// --- Hulpfuncties -----------------------------------------------------------

function bepaalNiveau(gem: number): Niveau {
  const d = itembank.drempels;
  if (gem >= d.hoog) return "hoog";
  if (gem >= d.gemiddeld) return "gemiddeld";
  return "laag";
}

function kleurVoor(familie: string, niveau: Niveau): string {
  return itembank.kleuren[familie]?.[niveau] ?? "#888888";
}

function gem(getallen: number[]): number {
  if (getallen.length === 0) return 0;
  const som = getallen.reduce((a, b) => a + b, 0);
  return Math.round((som / getallen.length) * 100) / 100;
}

// --- Fundament --------------------------------------------------------------

function scoorFundament(fundament: Record<string, number>): PijlerResultaat {
  const fp = itembank.fundamentPijler;
  const scores = fp.items.map((id: string) => fundament[id]).filter((v: number) => typeof v === "number");
  const g = gem(scores);
  const niveauLabel = bepaalNiveau(g);
  return {
    code: fp.code,
    naam: fp.naam,
    niveau: fp.niveau,
    gemiddelde: g,
    niveauLabel,
    kleur: kleurVoor(fp.kleurFamilie, niveauLabel),
    kleurFamilie: fp.kleurFamilie,
    korteUitleg: fp.korteUitleg,
  };
}

// --- Lencioni-pijlers -------------------------------------------------------

function scoorPijlers(lencioni: Record<string, number>): PijlerResultaat[] {
  return itembank.pijlers.map((p: any) => {
    const scores = p.items.map((id: number) => lencioni[String(id)]).filter((v: number) => typeof v === "number");
    const g = gem(scores);
    const niveauLabel = bepaalNiveau(g);
    return {
      code: p.code,
      naam: p.naam,
      niveau: p.niveau,
      gemiddelde: g,
      niveauLabel,
      kleur: kleurVoor(p.kleurFamilie, niveauLabel),
      kleurFamilie: p.kleurFamilie,
      korteUitleg: p.korteUitleg,
    };
  });
}

// --- Patroonherkenning ------------------------------------------------------

function herkenPatroon(fundament: PijlerResultaat, pijlers: PijlerResultaat[]) {
  const patronen = interpretatie.patronen;
  const lageP = pijlers.filter((p) => p.niveauLabel === "laag");
  const aantalLaag = lageP.length;
  const alleHoog = pijlers.every((p) => p.niveauLabel === "hoog");
  const alleLaag = pijlers.every((p) => p.niveauLabel === "laag");
  const alleGemiddeld = pijlers.every((p) => p.niveauLabel === "gemiddeld");

  // Laagste pijler: laagste piramideniveau onder de laag-scorende; bij gelijke
  // status wint de laagste laag (kleinste niveau-getal).
  const gesorteerdLaag = [...lageP].sort((a, b) => a.niveau - b.niveau || a.gemiddelde - b.gemiddelde);
  const laagstePijlerNaam = gesorteerdLaag.length ? gesorteerdLaag[0].naam : null;

  const fundamentEerst = fundament.niveauLabel === "laag";

  let sleutel = "goed_genoeg";
  if (aantalLaag === 0 && alleHoog) sleutel = "excellent";
  else if (alleLaag) sleutel = "disfunctioneel";
  else if (alleGemiddeld) sleutel = "goed_genoeg";
  else if (aantalLaag === 1) sleutel = "een_laag_laag";
  else if (aantalLaag === 2) sleutel = "twee_lagen_laag";
  else if (aantalLaag >= 3) sleutel = "meerdere_lagen_laag";

  const profiel = patronen[sleutel];
  const vervang = (s: string) => s.replace(/\{laagstePijler\}/g, laagstePijlerNaam ?? "de laagste laag");

  return {
    sleutel,
    titel: profiel.titel,
    beschrijving: vervang(profiel.beschrijving),
    watGoed: vervang(profiel.watGoed),
    waarBangVoor: vervang(profiel.waarBangVoor),
    hoeVerbeteren: vervang(profiel.hoeVerbeteren),
    laagstePijler: laagstePijlerNaam,
    fundamentEerst,
  };
}

// --- Vertrouwensanatomie gap-matrix ----------------------------------------

function bepaalGapCategorie(rang: number, prestatie: number): GapItem["categorie"] {
  const belangrijk = rang <= 2;
  const laagPrestatie = prestatie <= 2;
  const hoogPrestatie = prestatie >= 4;
  const minderBelangrijk = rang >= 4;
  if (belangrijk && laagPrestatie) return "kritiekPijnpunt";
  if (belangrijk && hoogPrestatie) return "bewaken";
  if (minderBelangrijk && laagPrestatie) return "lageprioriteit";
  return "neutraal";
}

function scoorVertrouwen(
  ranking: Record<string, number>,
  prestatie: Record<string, number>,
): IndividueelResultaat["vertrouwen"] {
  const elementen = itembank.blokken.C_vertrouwensanatomie.elementen;
  const gewicht = itembank.blokken.C_vertrouwensanatomie.ranking.gewicht;
  const gap: GapItem[] = elementen.map((el: any) => {
    const rang = ranking[el.id] ?? 5;
    const prest = prestatie[el.id] ?? 3;
    return {
      id: el.id,
      naam: el.naam,
      rang,
      gewicht: gewicht[String(rang)] ?? 1,
      prestatie: prest,
      categorie: bepaalGapCategorie(rang, prest),
    };
  });
  return { ranking, prestatie, gap };
}

// --- Publieke individuele scoring ------------------------------------------

export function scoorIndividueel(antwoorden: {
  fundament: Record<string, number>;
  lencioni: Record<string, number>;
  vertrouwenRanking: Record<string, number>;
  vertrouwenPrestatie: Record<string, number>;
}): IndividueelResultaat {
  const fundament = scoorFundament(antwoorden.fundament);
  const pijlers = scoorPijlers(antwoorden.lencioni);
  const patroon = herkenPatroon(fundament, pijlers);
  const vertrouwen = scoorVertrouwen(antwoorden.vertrouwenRanking, antwoorden.vertrouwenPrestatie);
  return { fundament, pijlers, patroon, vertrouwen };
}

// --- Team-aggregatie --------------------------------------------------------

export interface TeamResultaat {
  aantalDeelnemers: number;
  fundament: PijlerResultaat & { spreiding: number };
  pijlers: (PijlerResultaat & { spreiding: number })[];
  patroon: IndividueelResultaat["patroon"];
  vertrouwen: {
    gedeeldeRanking: { id: string; naam: string; gemiddeldeRang: number; gewicht: number }[];
    gemiddeldePrestatie: Record<string, number>;
    gap: GapItem[];
    spreidingRanking: Record<string, number>;
  };
}

function spreiding(getallen: number[]): number {
  if (getallen.length < 2) return 0;
  const m = getallen.reduce((a, b) => a + b, 0) / getallen.length;
  const variantie = getallen.reduce((a, b) => a + (b - m) ** 2, 0) / getallen.length;
  return Math.round(Math.sqrt(variantie) * 100) / 100;
}

export function aggregeerTeam(individuen: IndividueelResultaat[]): TeamResultaat {
  const n = individuen.length;

  // Fundament: gemiddelde van individuele fundament-gemiddelden
  const fundGems = individuen.map((i) => i.fundament.gemiddelde);
  const fundG = gem(fundGems);
  const fundNiveau = bepaalNiveau(fundG);
  const fundConfig = itembank.fundamentPijler;
  const teamFundament = {
    code: fundConfig.code,
    naam: fundConfig.naam,
    niveau: fundConfig.niveau,
    gemiddelde: fundG,
    niveauLabel: fundNiveau,
    kleur: kleurVoor(fundConfig.kleurFamilie, fundNiveau),
    kleurFamilie: fundConfig.kleurFamilie,
    korteUitleg: fundConfig.korteUitleg,
    spreiding: spreiding(fundGems),
  };

  // Pijlers: gemiddelde van individuele pijlergemiddelden
  const teamPijlers = itembank.pijlers.map((p: any, idx: number) => {
    const gems = individuen.map((i) => i.pijlers[idx].gemiddelde);
    const g = gem(gems);
    const niveauLabel = bepaalNiveau(g);
    return {
      code: p.code,
      naam: p.naam,
      niveau: p.niveau,
      gemiddelde: g,
      niveauLabel,
      kleur: kleurVoor(p.kleurFamilie, niveauLabel),
      kleurFamilie: p.kleurFamilie,
      korteUitleg: p.korteUitleg,
      spreiding: spreiding(gems),
    };
  });

  const patroon = herkenPatroon(teamFundament, teamPijlers);

  // Vertrouwensanatomie team
  const elementen = itembank.blokken.C_vertrouwensanatomie.elementen;
  const gewicht = itembank.blokken.C_vertrouwensanatomie.ranking.gewicht;
  const gedeeldeRanking: { id: string; naam: string; gemiddeldeRang: number; gewicht: number }[] = elementen.map((el: any) => {
    const rangen = individuen.map((i) => i.vertrouwen.ranking[el.id] ?? 5);
    const gemRang = gem(rangen);
    return {
      id: el.id,
      naam: el.naam,
      gemiddeldeRang: gemRang,
      gewicht: gewicht[String(Math.round(gemRang))] ?? 1,
    };
  });
  const gemiddeldePrestatie: Record<string, number> = {};
  const spreidingRanking: Record<string, number> = {};
  elementen.forEach((el: any) => {
    gemiddeldePrestatie[el.id] = gem(individuen.map((i) => i.vertrouwen.prestatie[el.id] ?? 3));
    spreidingRanking[el.id] = spreiding(individuen.map((i) => i.vertrouwen.ranking[el.id] ?? 5));
  });
  const teamGap: GapItem[] = elementen.map((el: any) => {
    const gemRang = Math.round(gem(individuen.map((i) => i.vertrouwen.ranking[el.id] ?? 5)));
    const prest = gemiddeldePrestatie[el.id];
    return {
      id: el.id,
      naam: el.naam,
      rang: gemRang,
      gewicht: gewicht[String(gemRang)] ?? 1,
      prestatie: prest,
      categorie: bepaalGapCategorie(gemRang, prest),
    };
  });

  return {
    aantalDeelnemers: n,
    fundament: teamFundament,
    pijlers: teamPijlers,
    patroon,
    vertrouwen: {
      gedeeldeRanking: gedeeldeRanking.sort((a, b) => a.gemiddeldeRang - b.gemiddeldeRang),
      gemiddeldePrestatie,
      gap: teamGap,
      spreidingRanking,
    },
  };
}
