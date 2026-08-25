// Temperamentenwiel — geautomatiseerde teamdynamiek-analyse.
//
// Deterministisch: dezelfde deelnemerslijst geeft altijd dezelfde analyse.
// De taal is energietaal binnen het 2MINSCAN-kader. Geen talent-, potentieel-,
// competentie-, selectie- of diagnoseclaims, en "creativiteit" wordt niet als
// verklaring gebruikt.

import {
  KLEUREN,
  KLEURWOORD,
  SECTOREN,
  positieByWielpositie,
  type EnergieKleur,
  type Positie,
} from "./posities";
import type { WielDeelnemer } from "./wiel";

export type InzichtSoort = "sterk" | "gat" | "let-op" | "wrijving";

export interface Inzicht {
  soort: InzichtSoort;
  titel: string;
  tekst: string;
}

export interface TeamAnalyse {
  n: number;
  dominant: Record<EnergieKleur, number>;
  tweede: Record<EnergieKleur, number>;
  kost: Record<EnergieKleur, number>;
  sectoren: Record<number, number>;
  pct: Record<EnergieKleur, number>;
  sterkste: EnergieKleur;
  ontbrekend: EnergieKleur[];
  zwak: EnergieKleur[];
  gedektKleuren: number;
  bezetteSectoren: number;
  gemAfstand: number;
  maxAfstand: number;
  kostKleur: EnergieKleur | null;
  kostPct: number;
  inzichten: Inzicht[];
  afspraken: string[];
}

/** Sectornummer 1-8 waarin een positie valt. */
export function sectorVanPositie(p: Positie): number {
  const midden = (p.nr - 1) * 15 + 7.5;
  return (Math.round(midden / 45) % 8) + 1;
}

/**
 * Meng-posities liggen exact op een sectorgrens en horen bij twee sectoren.
 * Dat is bronwaarheid van de mat, geen afrondingsfout.
 */
export function sectorLabel(p: Positie): string {
  const nr = sectorVanPositie(p);
  if (!p.gemengd) return `${nr} · ${SECTOREN[nr - 1].stijl}`;
  const vorige = ((nr - 2 + 8) % 8) + 1;
  return `${vorige}-${nr} · overgang`;
}

export function analyseerTeam(deelnemers: WielDeelnemer[]): TeamAnalyse | null {
  const rijen = deelnemers
    .map((d) => ({ d, p: positieByWielpositie(d.wielpositie) }))
    .filter((r): r is { d: WielDeelnemer; p: Positie } => r.p !== null);
  const n = rijen.length;
  if (n === 0) return null;

  const nul = () => ({ rood: 0, geel: 0, groen: 0, blauw: 0 }) as Record<EnergieKleur, number>;
  const dominant = nul();
  const tweede = nul();
  const kost = nul();
  const sectoren: Record<number, number> = {};

  rijen.forEach(({ p }) => {
    dominant[p.volgorde[0]]++;
    tweede[p.volgorde[1]]++;
    kost[p.volgorde[3]]++;
    const s = sectorVanPositie(p);
    sectoren[s] = (sectoren[s] ?? 0) + 1;
  });

  const pct = (k: EnergieKleur) => Math.round((dominant[k] / n) * 100);
  const gesorteerd = [...KLEUREN].sort((a, b) => dominant[b] - dominant[a]);
  const sterkste = gesorteerd[0];
  const ontbrekend = KLEUREN.filter((k) => dominant[k] === 0);
  const zwak = KLEUREN.filter((k) => dominant[k] > 0 && pct(k) < 15);
  const gedektKleuren = KLEUREN.filter((k) => dominant[k] > 0).length;
  const bezetteSectoren = Object.keys(sectoren).length;

  // Spreiding op het wiel: gemiddelde en grootste onderlinge hoekafstand.
  const hoeken = rijen.map(({ p }) => (p.nr - 1) * 15 + 7.5);
  let som = 0;
  let paren = 0;
  let maxAfstand = 0;
  let verste: [typeof rijen[number] | null, typeof rijen[number] | null] = [null, null];
  for (let i = 0; i < hoeken.length; i++) {
    for (let j = i + 1; j < hoeken.length; j++) {
      let dh = Math.abs(hoeken[i] - hoeken[j]);
      if (dh > 180) dh = 360 - dh;
      som += dh;
      paren++;
      if (dh > maxAfstand) {
        maxAfstand = dh;
        verste = [rijen[i], rijen[j]];
      }
    }
  }
  const gemAfstand = paren ? som / paren : 0;

  // Collectieve energiekost: kleur die bij de meesten de kostkleur is.
  const kostSort = [...KLEUREN].sort((a, b) => kost[b] - kost[a]);
  const kostKleur = kost[kostSort[0]] > 0 ? kostSort[0] : null;
  const kostPct = kostKleur ? Math.round((kost[kostKleur] / n) * 100) : 0;

  const inzichten: Inzicht[] = [];
  if (pct(sterkste) >= 60) {
    inzichten.push({
      soort: "let-op",
      titel: `Sterke bundeling in ${KLEURWOORD[sterkste].titel.toLowerCase()}e energie`,
      tekst: `${pct(sterkste)}% van de groep heeft ${KLEURWOORD[sterkste].titel.toLowerCase()} als eerste kleur. Dat maakt het team snel eensgezind rond ${KLEURWOORD[sterkste].kern}, maar vergroot de kans dat één en dezelfde blik het gesprek blijft bepalen. Bouw bewust momenten in waarop een andere invalshoek verplicht aan bod komt.`,
    });
  } else if (gedektKleuren === 4 && gemAfstand > 70) {
    inzichten.push({
      soort: "sterk",
      titel: "Breed gespreide energie",
      tekst: `Alle vier de energiekleuren zijn aanwezig en de groep staat verspreid over het wiel (gemiddelde onderlinge afstand ${Math.round(gemAfstand)}°). Het team kan een vraagstuk vanuit meerdere kanten bekijken. De keerzijde is dat afstemmen tijd vraagt: maak expliciet wie waarvoor energie levert.`,
    });
  } else {
    inzichten.push({
      soort: "sterk",
      titel: `Zwaartepunt in ${KLEURWOORD[sterkste].titel.toLowerCase()}e energie`,
      tekst: `${KLEURWOORD[sterkste].titel} is met ${pct(sterkste)}% de meest aanwezige eerste kleur. De gezamenlijke beweging gaat vooral over ${KLEURWOORD[sterkste].kern}.`,
    });
  }

  if (ontbrekend.length) {
    inzichten.push({
      soort: "gat",
      titel: `Geen eerste kleur ${ontbrekend.map((k) => KLEURWOORD[k].titel.toLowerCase()).join(" of ")}`,
      tekst: `Niemand in deze groep vertrekt vanuit ${ontbrekend.map((k) => KLEURWOORD[k].kern).join(" of ")}. Dat is geen tekort, maar het betekent dat dit werk energie kost in plaats van energie geeft. Spreek af wie het bewust opneemt, of haal die blik van buiten binnen.`,
    });
  }
  if (zwak.length) {
    inzichten.push({
      soort: "gat",
      titel: `Dun bezet: ${zwak.map((k) => KLEURWOORD[k].titel.toLowerCase()).join(", ")}`,
      tekst: `Deze energie leunt op één of twee mensen. Let erop dat zij niet structureel de enige zijn die ${zwak.map((k) => KLEURWOORD[k].kern).join(" en ")} op zich nemen.`,
    });
  }
  if (kostKleur && kostPct >= 50) {
    inzichten.push({
      soort: "let-op",
      titel: `Gedeelde energiekost: ${KLEURWOORD[kostKleur].titel.toLowerCase()}`,
      tekst: `Bij ${kostPct}% van de groep staat ${KLEURWOORD[kostKleur].titel.toLowerCase()} in de kern van het profiel, dus als kostkleur. Werk dat vraagt om ${KLEURWOORD[kostKleur].kern} loopt het snelst leeg. Plan dit soort werk in korte blokken, met duidelijke betekenis en een concreet einde.`,
    });
  }
  if (maxAfstand >= 135 && verste[0] && verste[1]) {
    inzichten.push({
      soort: "wrijving",
      titel: "Grootste energieafstand in de groep",
      tekst: `${verste[0].d.naam} (${verste[0].p.acroniem}) en ${verste[1].d.naam} (${verste[1].p.acroniem}) staan ${Math.round(maxAfstand)}° van elkaar op het wiel. Deze twee vullen elkaar sterk aan en kosten elkaar het snelst energie. Maak afspraken over tempo, detailniveau en hoe beslissingen worden vastgelegd.`,
    });
  }
  if (bezetteSectoren >= 6) {
    inzichten.push({
      soort: "let-op",
      titel: "Veel verschillende sectoren bezet",
      tekst: `De groep bezet ${bezetteSectoren} van de 8 sectoren. Dat geeft rijkdom, maar ook ruis: overleg duurt langer en niemand herkent zich automatisch in dezelfde aanpak. Werk met een expliciete overlegvorm in plaats van te vertrouwen op vanzelfsprekendheid.`,
    });
  }

  const afspraken: string[] = [
    `Benoem bij de start van een project welke energie het meest gevraagd wordt: ${KLEURWOORD[sterkste].kern}, of juist iets anders.`,
  ];
  if (ontbrekend.length || zwak.length) {
    afspraken.push(
      'Wijs de ondervertegenwoordigde energie expliciet toe aan een rol, niet aan een persoon "die dat toch wel doet".',
    );
  }
  if (kostKleur && kostPct >= 34) {
    afspraken.push(
      `Bewaak het werk rond ${KLEURWOORD[kostKleur].kern}: kort houden, betekenis expliciet maken, en niet aan het einde van de dag plannen.`,
    );
  }
  afspraken.push("Bespreek de energieafstand tussen de uitersten van het team voordat er spanning ontstaat, niet erna.");

  return {
    n,
    dominant,
    tweede,
    kost,
    sectoren,
    pct: Object.fromEntries(KLEUREN.map((k) => [k, pct(k)])) as Record<EnergieKleur, number>,
    sterkste,
    ontbrekend,
    zwak,
    gedektKleuren,
    bezetteSectoren,
    gemAfstand: Math.round(gemAfstand),
    maxAfstand: Math.round(maxAfstand),
    kostKleur,
    kostPct,
    inzichten,
    afspraken,
  };
}
