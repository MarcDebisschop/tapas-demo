// Temperamentenwiel — geautomatiseerde teamdynamiek-analyse.
//
// Deterministisch: dezelfde deelnemerslijst geeft altijd dezelfde analyse.
// De taal is energietaal binnen het 2MINSCAN-kader. Geen talent-, potentieel-,
// competentie-, selectie- of diagnoseclaims, en "creativiteit" wordt niet als
// verklaring gebruikt.
//
// MEERTALIG (NL/FR/EN)
//   De berekening is taalonafhankelijk. Alleen de zichtbare tekst gaat door een
//   vertaler: `analyseerTeam(deelnemers, t)` met dezelfde signatuur als de
//   2MINSCAN-vertaler (client/src/twominscan/i18n.ts): (sleutel, nl-fallback).
//   Zonder vertaler blijft alles exact het Nederlands van voordien. De
//   Nederlandse tekst in dit bestand is dus meteen de bron en de terugval.

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

/** Vertaler: (sleutel, Nederlandse terugval) -> tekst. */
export type WielVertaler = (sleutel: string, terugval: string) => string;

const GEEN_VERTALING: WielVertaler = (_sleutel, terugval) => terugval;

/** Vult {plaatshouders} in een vertaalde of Nederlandse tekst. */
function vul(sjabloon: string, waarden: Record<string, string | number>): string {
  return sjabloon.replace(/\{(\w+)\}/g, (heel, naam) =>
    Object.prototype.hasOwnProperty.call(waarden, naam) ? String(waarden[naam]) : heel,
  );
}

/** Kleurnaam met hoofdletter, bijvoeglijke vorm en energiekern, per taal. */
function kleurWoorden(t: WielVertaler, kleur: EnergieKleur) {
  const nl = KLEURWOORD[kleur];
  return {
    titel: t(`wiel.kleur.${kleur}.titel`, nl.titel),
    laag: t(`wiel.kleur.${kleur}.laag`, nl.titel.toLowerCase()),
    bv: t(`wiel.kleur.${kleur}.bv`, `${nl.titel.toLowerCase()}e`),
    kern: t(`wiel.kleur.${kleur}.kern`, nl.kern),
  };
}

function lijst(t: WielVertaler, delen: string[], soort: "of" | "en"): string {
  if (delen.length <= 1) return delen[0] ?? "";
  const scheiding = soort === "of" ? t("wiel.lijst.of", " of ") : t("wiel.lijst.en", " en ");
  return delen.slice(0, -1).join(", ") + scheiding + delen[delen.length - 1];
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
export function sectorLabel(p: Positie, vertaler?: WielVertaler): string {
  const t = vertaler ?? GEEN_VERTALING;
  const nr = sectorVanPositie(p);
  if (!p.gemengd) return `${nr} · ${t(`wiel.sector.${nr}.stijl`, SECTOREN[nr - 1].stijl)}`;
  const vorige = ((nr - 2 + 8) % 8) + 1;
  return `${vorige}-${nr} · ${t("wiel.sector.overgang", "overgang")}`;
}

export function analyseerTeam(
  deelnemers: WielDeelnemer[],
  vertaler?: WielVertaler,
): TeamAnalyse | null {
  const t = vertaler ?? GEEN_VERTALING;
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

  const sterk = kleurWoorden(t, sterkste);
  const inzichten: Inzicht[] = [];
  if (pct(sterkste) >= 60) {
    inzichten.push({
      soort: "let-op",
      titel: vul(t("dyn.bundeling.titel", "Sterke bundeling in {bv} energie"), { bv: sterk.bv }),
      tekst: vul(
        t(
          "dyn.bundeling.tekst",
          "{pct}% van de groep heeft {laag} als eerste kleur. Dat maakt het team snel eensgezind rond {kern}, maar vergroot de kans dat één en dezelfde blik het gesprek blijft bepalen. Bouw bewust momenten in waarop een andere invalshoek verplicht aan bod komt.",
        ),
        { pct: pct(sterkste), laag: sterk.laag, kern: sterk.kern },
      ),
    });
  } else if (gedektKleuren === 4 && gemAfstand > 70) {
    inzichten.push({
      soort: "sterk",
      titel: t("dyn.spreiding.titel", "Breed gespreide energie"),
      tekst: vul(
        t(
          "dyn.spreiding.tekst",
          "Alle vier de energiekleuren zijn aanwezig en de groep staat verspreid over het wiel (gemiddelde onderlinge afstand {gem}°). Het team kan een vraagstuk vanuit meerdere kanten bekijken. De keerzijde is dat afstemmen tijd vraagt: maak expliciet wie waarvoor energie levert.",
        ),
        { gem: Math.round(gemAfstand) },
      ),
    });
  } else {
    inzichten.push({
      soort: "sterk",
      titel: vul(t("dyn.zwaartepunt.titel", "Zwaartepunt in {bv} energie"), { bv: sterk.bv }),
      tekst: vul(
        t(
          "dyn.zwaartepunt.tekst",
          "{titel} is met {pct}% de meest aanwezige eerste kleur. De gezamenlijke beweging gaat vooral over {kern}.",
        ),
        { titel: sterk.titel, pct: pct(sterkste), kern: sterk.kern },
      ),
    });
  }

  if (ontbrekend.length) {
    const woorden = ontbrekend.map((k) => kleurWoorden(t, k));
    inzichten.push({
      soort: "gat",
      titel: vul(t("dyn.ontbrekend.titel", "Geen eerste kleur {kleuren}"), {
        kleuren: lijst(t, woorden.map((w) => w.laag), "of"),
      }),
      tekst: vul(
        t(
          "dyn.ontbrekend.tekst",
          "Niemand in deze groep vertrekt vanuit {kernen}. Dat is geen tekort, maar het betekent dat dit werk energie kost in plaats van energie geeft. Spreek af wie het bewust opneemt, of haal die blik van buiten binnen.",
        ),
        { kernen: lijst(t, woorden.map((w) => w.kern), "of") },
      ),
    });
  }
  if (zwak.length) {
    const woorden = zwak.map((k) => kleurWoorden(t, k));
    inzichten.push({
      soort: "gat",
      titel: vul(t("dyn.dun.titel", "Dun bezet: {kleuren}"), {
        kleuren: woorden.map((w) => w.laag).join(", "),
      }),
      tekst: vul(
        t(
          "dyn.dun.tekst",
          "Deze energie leunt op één of twee mensen. Let erop dat zij niet structureel de enige zijn die {kernen} op zich nemen.",
        ),
        { kernen: lijst(t, woorden.map((w) => w.kern), "en") },
      ),
    });
  }
  if (kostKleur && kostPct >= 50) {
    const kostWoord = kleurWoorden(t, kostKleur);
    inzichten.push({
      soort: "let-op",
      titel: vul(t("dyn.kost.titel", "Gedeelde energiekost: {laag}"), { laag: kostWoord.laag }),
      tekst: vul(
        t(
          "dyn.kost.tekst",
          "Bij {pct}% van de groep staat {laag} in de kern van het profiel, dus als kostkleur. Werk dat vraagt om {kern} loopt het snelst leeg. Plan dit soort werk in korte blokken, met duidelijke betekenis en een concreet einde.",
        ),
        { pct: kostPct, laag: kostWoord.laag, kern: kostWoord.kern },
      ),
    });
  }
  if (maxAfstand >= 135 && verste[0] && verste[1]) {
    inzichten.push({
      soort: "wrijving",
      titel: t("dyn.afstand.titel", "Grootste energieafstand in de groep"),
      tekst: vul(
        t(
          "dyn.afstand.tekst",
          "{naam1} ({acro1}) en {naam2} ({acro2}) staan {graden}° van elkaar op het wiel. Deze twee vullen elkaar sterk aan en kosten elkaar het snelst energie. Maak afspraken over tempo, detailniveau en hoe beslissingen worden vastgelegd.",
        ),
        {
          naam1: verste[0].d.naam,
          acro1: verste[0].p.acroniem,
          naam2: verste[1].d.naam,
          acro2: verste[1].p.acroniem,
          graden: Math.round(maxAfstand),
        },
      ),
    });
  }
  if (bezetteSectoren >= 6) {
    inzichten.push({
      soort: "let-op",
      titel: t("dyn.sectoren.titel", "Veel verschillende sectoren bezet"),
      tekst: vul(
        t(
          "dyn.sectoren.tekst",
          "De groep bezet {aantal} van de 8 sectoren. Dat geeft rijkdom, maar ook ruis: overleg duurt langer en niemand herkent zich automatisch in dezelfde aanpak. Werk met een expliciete overlegvorm in plaats van te vertrouwen op vanzelfsprekendheid.",
        ),
        { aantal: bezetteSectoren },
      ),
    });
  }

  const afspraken: string[] = [
    vul(
      t(
        "dyn.afspraak.start",
        "Benoem bij de start van een project welke energie het meest gevraagd wordt: {kern}, of juist iets anders.",
      ),
      { kern: sterk.kern },
    ),
  ];
  if (ontbrekend.length || zwak.length) {
    afspraken.push(
      t(
        "dyn.afspraak.rol",
        'Wijs de ondervertegenwoordigde energie expliciet toe aan een rol, niet aan een persoon "die dat toch wel doet".',
      ),
    );
  }
  if (kostKleur && kostPct >= 34) {
    afspraken.push(
      vul(
        t(
          "dyn.afspraak.kost",
          "Bewaak het werk rond {kern}: kort houden, betekenis expliciet maken, en niet aan het einde van de dag plannen.",
        ),
        { kern: kleurWoorden(t, kostKleur).kern },
      ),
    );
  }
  afspraken.push(
    t(
      "dyn.afspraak.afstand",
      "Bespreek de energieafstand tussen de uitersten van het team voordat er spanning ontstaat, niet erna.",
    ),
  );

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
