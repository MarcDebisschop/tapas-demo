// =============================================================================
// server/twominscan/teamanalyse.ts - teamanalyse uit losse 2MINSCAN-afnames
// -----------------------------------------------------------------------------
// WAAROM DEZE MODULE BESTAAT
//   In het HDD-traject vult elk boardlid een 2MINSCAN in. Die individuele
//   afnames werden bewaard (server/twominscan/afname-opslag.ts) en elk apart
//   gerapporteerd, maar er kwam geen teamanalyse uit. Deze module maakt van de
//   bewaarde afnames een gemeten teambeeld, zodat het dossier naast het
//   eindrapport ook een energetische teamanalyse kan bijvoegen.
//
// WAAR DE INHOUD VANDAAN KOMT (niets uit het hoofd, niets bijverzonnen)
//   - client/src/temperamentenwiel/posities.ts  de 24 wielposities met hun vaste
//     kleurvolgorde, gemeten op de speelmat. Dit is de bron van de kleurvolgorde
//     en van de plaats op het wiel.
//   - client/src/temperamentenwiel/dynamiek.ts  sectorVanPositie(): dezelfde
//     sectorindeling als het goedgekeurde teamprofiel. De hoekafstanden worden
//     met exact dezelfde formule berekend als daar.
//   - client/src/temperamentenwiel/teamtekst.ts  de overlegorde (vooraf, openen,
//     wegen, beslissen, afronden) van het goedgekeurde teamprofiel.
//   - server/twominscan/rapport-selectie.ts  vindProfiel(): de enige waarheid
//     over EG-code naar kleurvolgorde.
//   Er wordt hier bewust geen tweede kopie van die tabellen gemaakt: één
//   waarheid, anders wijkt er vroeg of laat een af.
//
//   De invoer wordt bewust NIET zelf uit de databank gehaald: de aanroeper geeft
//   de deelnemers mee (bv. uit BewaardeAfname in afname-opslag.ts, dat naam,
//   rol, egCode, wielpositie, taal en datum bewaart). Zo blijft deze module
//   zuiver rekenwerk en dus testbaar.
//
// HARDE CLAIMGRENS
//   De 2MINSCAN levert BEWUST geen energiecijfer op een 0-10 schaal. Er komt
//   hier dus geen score, geen index, geen talent-, potentieel-, selectie- of
//   diagnoseclaim uit. Wat er wel uit komt: kleurverdeling, gedragsenergie,
//   samenspel en overleg. Wat niet gemeten kon worden, staat eerlijk in
//   `nietGemeten` in plaats van opgevuld te worden met een terugvalwaarde.
//
// DETERMINISTISCH
//   Dezelfde invoer geeft altijd dezelfde uitvoer: geen datum, geen toeval, geen
//   sortering op iets anders dan de vaste kleurorde en de invoerorde.
//
// TAAL
//   Code en commentaar in het Nederlands; de tekstvelden (`observaties`,
//   `overlegadvies`, `nietGemeten`) zijn Engels, want het HDD-dossier is altijd
//   Engelstalig.
// =============================================================================

// Relatief pad naar de client: de serverbundel kent de "@/"-alias niet, en de
// wielgegevens mogen niet gekopieerd worden naar de server.
import {
  KLEUREN,
  positieByWielpositie,
  type EnergieKleur,
  type Positie,
} from "../../client/src/temperamentenwiel/posities";
import { sectorVanPositie } from "../../client/src/temperamentenwiel/dynamiek";
import { vindProfiel } from "./rapport-selectie";

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface TeamanalyseDeelnemer { naam: string; rol?: string; egCode: string; wielpositie: string }
export interface TeamanalyseDeelnemerUit { naam: string; rol: string; egCode: string; kleurvolgorde: string[]; xStand: number | null; yStand: number | null }
export interface TeamanalyseResultaat {
  n: number;
  deelnemers: TeamanalyseDeelnemerUit[];
  kleurverdeling: Record<string, number>;     // kleur -> aantal keer dominant
  dominanteKleuren: string[];
  ontbrekendeKleuren: string[];
  xSpreiding: { min: number; max: number; spreiding: number } | null;
  observaties: string[];                       // Engels, elk een gemeten vaststelling
  overlegadvies: string[];                     // Engels
  nietGemeten: string[];                       // wat niet gemeten kon worden, Engels
}

/**
 * Vanaf drie bruikbare profielen spreken we over teamverdeling en samenspel.
 * Onder die grens blijven de vaststellingen per persoon staan en zegt
 * `nietGemeten` dat er geen teambeeld gerapporteerd wordt.
 */
export const TEAMANALYSE_MIN_DEELNEMERS = 3;

// ---------------------------------------------------------------------------
// Engelse woordenlijst voor de rapporttekst.
//
// Dit is de vertaling van KLEURWOORD uit posities.ts, niet een nieuwe inhoud:
// dezelfde vier kleuren, dezelfde energiekern. Energietaal, geen talenttaal.
// ---------------------------------------------------------------------------
const KLEUR_EN: Record<EnergieKleur, { titel: string; kern: string }> = {
  rood: { titel: "Red", kern: "setting direction and pushing through" },
  geel: { titel: "Yellow", kern: "connecting and inspiring" },
  groen: { titel: "Green", kern: "caring and anchoring" },
  blauw: { titel: "Blue", kern: "ordering and examining" },
};

/** Engelse kleurnaam; ook bruikbaar door de renderer. */
export function kleurNaamEngels(kleur: string): string {
  return KLEUR_EN[kleur as EnergieKleur]?.titel ?? kleur;
}

/** Engelse energiekern van een kleur; ook bruikbaar door de renderer. */
export function kleurKernEngels(kleur: string): string {
  return KLEUR_EN[kleur as EnergieKleur]?.kern ?? "";
}

/** Vaste kleurorde voor elke uitvoer, zodat de volgorde nooit toevallig is. */
export const TEAMANALYSE_KLEURORDE: string[] = [...KLEUREN];

// ---------------------------------------------------------------------------
// Hulpwerk
// ---------------------------------------------------------------------------

/** Engelse opsomming: "a", "a and b", "a, b and c". */
function opsomming(delen: string[], voegwoord = "and"): string {
  if (delen.length === 0) return "";
  if (delen.length === 1) return delen[0];
  return `${delen.slice(0, -1).join(", ")} ${voegwoord} ${delen[delen.length - 1]}`;
}

function afgerond(getal: number, cijfers: number): number {
  const f = 10 ** cijfers;
  return Math.round(getal * f) / f;
}

/**
 * Middenhoek van een positie op het wiel, in graden vanaf 12 uur. Exact dezelfde
 * formule als analyseerTeam() in dynamiek.ts, zodat er geen tweede rekenwijze
 * ontstaat.
 */
function hoekVanPositie(p: Positie): number {
  return (p.nr - 1) * 15 + 7.5;
}

/**
 * Plaats op het wiel als twee coördinaten op een schaal van -1 tot +1, met het
 * midden van het wiel als nulpunt: xStand is de horizontale plaats, yStand de
 * verticale. Dit is meetkunde, afgeleid van de wielpositie uit posities.ts, en
 * GEEN score: er wordt niets gemeten op een 0-10 schaal en er zit geen "hoger is
 * beter" in. De spreiding van xStand zegt enkel hoe breed de groep links en
 * rechts op het wiel staat.
 */
function standen(p: Positie): { x: number; y: number } {
  const rad = (hoekVanPositie(p) * Math.PI) / 180;
  return { x: afgerond(Math.sin(rad), 3), y: afgerond(Math.cos(rad), 3) };
}

interface Rij {
  in: TeamanalyseDeelnemer;
  uit: TeamanalyseDeelnemerUit;
  positie: Positie | null;
}

// ---------------------------------------------------------------------------
// Hoofdfunctie
// ---------------------------------------------------------------------------

export function bouwTeamanalyse(deelnemers: TeamanalyseDeelnemer[]): TeamanalyseResultaat {
  const invoer = Array.isArray(deelnemers) ? deelnemers : [];
  const nietGemeten: string[] = [];
  const observaties: string[] = [];
  const overlegadvies: string[] = [];

  // ---- 1. Per deelnemer: kleurvolgorde en plaats op het wiel ----------------
  const rijen: Rij[] = invoer.map((d) => {
    const naam = String(d?.naam ?? "").trim();
    const rol = String(d?.rol ?? "").trim();
    const egCode = String(d?.egCode ?? "").trim();
    const wielpositie = String(d?.wielpositie ?? "").trim();

    const positie = positieByWielpositie(wielpositie);
    const profiel = vindProfiel(egCode);

    // De speelmat is de bron van de kleurvolgorde. Staat de wielpositie niet in
    // de lijst van 24, dan mag de EG-code die volgorde leveren. Is geen van
    // beide bekend, dan blijft de volgorde leeg: er wordt niet gegokt.
    let volgorde: string[] = [];
    if (positie) volgorde = [...positie.volgorde];
    else if (profiel) volgorde = [...profiel.volgorde];

    const stand = positie ? standen(positie) : null;

    const label = naam || "an unnamed participant";
    if (!positie && !profiel) {
      nietGemeten.push(
        `${label}: neither the wheel position ${wielpositie ? `"${wielpositie}"` : "(empty)"} nor the ` +
        `EG code ${egCode ? `"${egCode}"` : "(empty)"} matches a calibrated profile, so no colour ` +
        `order and no wheel position were derived. Nothing was guessed.`,
      );
    } else if (!profiel) {
      nietGemeten.push(
        `${label}: EG code ${egCode ? `"${egCode}"` : "(empty)"} is not one of the 24 calibrated ` +
        `profiles. The colour order shown comes from wheel position ${positie!.wielpositie} only.`,
      );
    } else if (!positie) {
      nietGemeten.push(
        `${label}: wheel position ${wielpositie ? `"${wielpositie}"` : "(empty)"} is not one of the 24 ` +
        `mat positions. The colour order shown comes from EG code "${egCode}" only, and the position ` +
        `on the wheel was not derived.`,
      );
    } else if (positie.volgorde.join(">") !== profiel.volgorde.join(">")) {
      // Twee bronnen die elkaar tegenspreken wordt gemeld, niet stil opgelost.
      nietGemeten.push(
        `${label}: wheel position ${positie.wielpositie} and EG code "${egCode}" point to different ` +
        `colour orders. The mat position is reported, the disagreement is not resolved here.`,
      );
    }

    return {
      in: d,
      uit: {
        naam,
        rol,
        egCode,
        kleurvolgorde: volgorde,
        xStand: stand ? stand.x : null,
        yStand: stand ? stand.y : null,
      },
      positie,
    };
  });

  const n = rijen.length;
  const metVolgorde = rijen.filter((r) => r.uit.kleurvolgorde.length > 0);
  const metPositie = rijen.filter((r): r is Rij & { positie: Positie } => r.positie !== null);

  // ---- 2. Kleurverdeling ---------------------------------------------------
  const kleurverdeling: Record<string, number> = {};
  const tweedeVerdeling: Record<string, number> = {};
  const kostVerdeling: Record<string, number> = {};
  for (const kleur of TEAMANALYSE_KLEURORDE) {
    kleurverdeling[kleur] = 0;
    tweedeVerdeling[kleur] = 0;
    kostVerdeling[kleur] = 0;
  }
  for (const r of metVolgorde) {
    const v = r.uit.kleurvolgorde;
    if (v[0] !== undefined) kleurverdeling[v[0]] = (kleurverdeling[v[0]] ?? 0) + 1;
    if (v[1] !== undefined) tweedeVerdeling[v[1]] = (tweedeVerdeling[v[1]] ?? 0) + 1;
    if (v[3] !== undefined) kostVerdeling[v[3]] = (kostVerdeling[v[3]] ?? 0) + 1;
  }

  const gemeten = metVolgorde.length;
  const hoogste = Math.max(0, ...TEAMANALYSE_KLEURORDE.map((k) => kleurverdeling[k] ?? 0));
  // Zonder één gemeten profiel bestaat er geen dominante en ook geen
  // ontbrekende kleur: een lege lijst is dan de eerlijke uitkomst, geen nul.
  const dominanteKleuren = gemeten > 0 && hoogste > 0
    ? TEAMANALYSE_KLEURORDE.filter((k) => kleurverdeling[k] === hoogste)
    : [];
  const ontbrekendeKleuren = gemeten > 0
    ? TEAMANALYSE_KLEURORDE.filter((k) => (kleurverdeling[k] ?? 0) === 0)
    : [];

  // ---- 3. Spreiding op het wiel -------------------------------------------
  const xWaarden = metPositie.map((r) => r.uit.xStand as number);
  const xSpreiding = xWaarden.length >= 2
    ? {
      min: Math.min(...xWaarden),
      max: Math.max(...xWaarden),
      spreiding: afgerond(Math.max(...xWaarden) - Math.min(...xWaarden), 3),
    }
    : null;

  // Hoekafstanden op het wiel, met dezelfde formule als het teamprofiel.
  let somAfstand = 0;
  let paren = 0;
  let maxAfstand = 0;
  let verste: [Rij & { positie: Positie }, Rij & { positie: Positie }] | null = null;
  for (let i = 0; i < metPositie.length; i++) {
    for (let j = i + 1; j < metPositie.length; j++) {
      let dh = Math.abs(hoekVanPositie(metPositie[i].positie) - hoekVanPositie(metPositie[j].positie));
      if (dh > 180) dh = 360 - dh;
      somAfstand += dh;
      paren++;
      if (dh > maxAfstand) {
        maxAfstand = dh;
        verste = [metPositie[i], metPositie[j]];
      }
    }
  }
  const gemAfstand = paren ? Math.round(somAfstand / paren) : 0;
  const sectoren = new Set(metPositie.map((r) => sectorVanPositie(r.positie)));

  // ---- 4. Observaties: elk een gemeten vaststelling ------------------------
  observaties.push(
    `${n} ${n === 1 ? "participant was" : "participants were"} submitted; ${gemeten} of them ` +
    `${gemeten === 1 ? "carries" : "carry"} a colour order from a calibrated 2MINSCAN profile.`,
  );

  if (gemeten > 0) {
    observaties.push(
      "First colour across the measured profiles: " +
      TEAMANALYSE_KLEURORDE.map((k) => `${kleurNaamEngels(k)} ${kleurverdeling[k]}`).join(", ") +
      `, out of ${gemeten}.`,
    );
    if (dominanteKleuren.length === 1) {
      const k = dominanteKleuren[0];
      observaties.push(
        `${kleurNaamEngels(k)} is the most frequent first colour (${kleurverdeling[k]} of ${gemeten}). ` +
        `The shared movement of this group is mostly about ${kleurKernEngels(k)}.`,
      );
    } else if (dominanteKleuren.length > 1) {
      observaties.push(
        `${opsomming(dominanteKleuren.map(kleurNaamEngels))} occur equally often as first colour ` +
        `(${hoogste} of ${gemeten} each), so no single colour carries the group on its own.`,
      );
    }
    if (ontbrekendeKleuren.length > 0) {
      observaties.push(
        `No measured profile starts from ${opsomming(ontbrekendeKleuren.map(kleurNaamEngels), "or")}. ` +
        `Work that asks for ${opsomming(ontbrekendeKleuren.map(kleurKernEngels), "or")} costs this ` +
        `group energy instead of giving it. That is an observation about energy, not a shortcoming.`,
      );
    } else {
      observaties.push(
        "All four colour energies occur as a first colour, so every kind of energy is present in the group.",
      );
    }
    const tweedeTop = Math.max(...TEAMANALYSE_KLEURORDE.map((k) => tweedeVerdeling[k] ?? 0));
    if (tweedeTop > 0) {
      const tweedeKleuren = TEAMANALYSE_KLEURORDE.filter((k) => tweedeVerdeling[k] === tweedeTop);
      observaties.push(
        `As a second colour, ${opsomming(tweedeKleuren.map(kleurNaamEngels))} ` +
        `${tweedeKleuren.length === 1 ? "occurs" : "occur"} most often (${tweedeTop} of ${gemeten}). ` +
        "The second colour is the energy the group can add without much effort.",
      );
    }
    const kostTop = Math.max(...TEAMANALYSE_KLEURORDE.map((k) => kostVerdeling[k] ?? 0));
    if (kostTop > 0) {
      const kostKleuren = TEAMANALYSE_KLEURORDE.filter((k) => kostVerdeling[k] === kostTop);
      observaties.push(
        `${opsomming(kostKleuren.map(kleurNaamEngels))} ` +
        `${kostKleuren.length === 1 ? "sits" : "sit"} in the core of the profile, as the colour ` +
        // "1 of 3 measured profiles": het meervoud volgt het aantal gemeten
        // profielen, niet de teller ervoor.
        `that costs energy, for ${kostTop} of ${gemeten} measured ` +
        `${gemeten === 1 ? "profile" : "profiles"}.`,
      );
    }
  }

  if (metPositie.length > 0) {
    observaties.push(
      `The measured positions occupy ${sectoren.size} of the 8 wheel sectors.`,
    );
  }
  if (paren > 0 && verste) {
    observaties.push(
      `The average angular distance between two participants on the wheel is ${gemAfstand} degrees. ` +
      `The largest distance is ${Math.round(maxAfstand)} degrees, between ` +
      // Het positie-acroniem van de speelmat draagt een gat waar de x/y-stand
      // hoort en leest in lopende tekst als een half afgekapte code. Daarom het
      // wielpositienummer, dat de positie ondubbelzinnig aanwijst.
      `${verste[0].uit.naam || "an unnamed participant"} (wheel position ${verste[0].positie.wielpositie}) and ` +
      `${verste[1].uit.naam || "an unnamed participant"} (wheel position ${verste[1].positie.wielpositie}). ` +
      "A large distance means these two add most to each other and also cost each other energy fastest.",
    );
  }
  if (xSpreiding) {
    observaties.push(
      `Horizontal placement on the wheel runs from ${xSpreiding.min} to ${xSpreiding.max} ` +
      `(span ${xSpreiding.spreiding}) on a wheel axis from -1 to +1. This is a place on the wheel, ` +
      "not a score, and neither end is better than the other.",
    );
  }

  // ---- 5. Overlegadvies ---------------------------------------------------
  // Orde en inhoud van het goedgekeurde teamprofiel (teamtekst.ts, OVERLEG),
  // in het Engels en beperkt tot de kleuren die hier gemeten zijn.
  const overlegOrde: { kleur: EnergieKleur; regel: string }[] = [
    { kleur: "blauw", regel: "Before the meeting: circulate documents and figures, so nobody has to estimate on the spot." },
    { kleur: "geel", regel: "Opening: a short block in which possibilities may be explored out loud, before anything is chosen." },
    { kleur: "groen", regel: "Weighing: ask explicitly about the consequences for people and workability, and let silences fall." },
    { kleur: "rood", regel: "Deciding: a clear decision moment with a call, an owner and a date." },
  ];
  for (const stap of overlegOrde) {
    if ((kleurverdeling[stap.kleur] ?? 0) > 0) overlegadvies.push(stap.regel);
  }
  if (gemeten > 0) {
    overlegadvies.push("Closing: two minutes on who picks up what, and what that costs someone in energy.");
    if (dominanteKleuren.length > 0) {
      overlegadvies.push(
        "Name at the start of a project which energy is asked for most: " +
        `${opsomming(dominanteKleuren.map(kleurKernEngels), "or")}, or deliberately something else.`,
      );
    }
    if (ontbrekendeKleuren.length > 0) {
      overlegadvies.push(
        "Assign the energy that is absent as a first colour to a role, not to a person who is assumed " +
        "to pick it up anyway.",
      );
    }
    const kostTop = Math.max(...TEAMANALYSE_KLEURORDE.map((k) => kostVerdeling[k] ?? 0));
    if (kostTop > 0 && gemeten > 0 && kostTop / gemeten >= 1 / 3) {
      const kostKleuren = TEAMANALYSE_KLEURORDE.filter((k) => kostVerdeling[k] === kostTop);
      overlegadvies.push(
        `Guard the work that asks for ${opsomming(kostKleuren.map(kleurKernEngels), "or")}: keep it ` +
        "short, make its meaning explicit, and do not plan it at the end of the day.",
      );
    }
    if (paren > 0) {
      overlegadvies.push(
        "Discuss the energy distance between the extremes of this group before tension appears, not after.",
      );
    }
    overlegadvies.push(
      "Repeat this reading at three moments: at the start of a project, halfway through, and after a " +
      "tension, by putting the tension next to the wheel instead of next to the person.",
    );
  }

  // ---- 6. Wat niet gemeten is ---------------------------------------------
  // Dit staat er altijd: het is de claimgrens van het instrument zelf.
  nietGemeten.unshift(
    "The 2MINSCAN deliberately produces no energy figure on a 0-10 scale. This analysis therefore " +
    "reports no score, no ranking, no talent or potential claim, no suitability judgement and no " +
    "diagnosis. It reports colour distribution, behavioural energy, interplay and consultation.",
  );
  if (n === 0) {
    nietGemeten.push(
      "No participants were submitted, so nothing about this team was measured: no colour " +
      "distribution, no dominant or absent colour, no spread and no interplay.",
    );
  } else if (gemeten === 0) {
    nietGemeten.push(
      "None of the submitted participants carries a calibrated profile, so no colour distribution " +
      "and no team-level observation could be derived.",
    );
  } else if (gemeten < TEAMANALYSE_MIN_DEELNEMERS) {
    nietGemeten.push(
      `Only ${gemeten} of the ${TEAMANALYSE_MIN_DEELNEMERS} profiles needed for a team reading are ` +
      "present. The counts below are measured, but they are not reported as a picture of the team.",
    );
  }
  if (!xSpreiding) {
    nietGemeten.push(
      "The spread across the wheel needs at least two known wheel positions and could not be " +
      "calculated here.",
    );
  }
  if (metPositie.length < gemeten) {
    nietGemeten.push(
      `${gemeten - metPositie.length} of the measured profiles have no known wheel position, so they ` +
      "count in the colour distribution but not in the distances on the wheel.",
    );
  }
  nietGemeten.push(
    "The 2MINSCAN does not measure why someone shows this preferred behaviour, and it says nothing " +
    "about talent, potential, competence or fitness for a role. Those questions need a different " +
    "instrument.",
  );

  return {
    n,
    deelnemers: rijen.map((r) => r.uit),
    kleurverdeling,
    dominanteKleuren,
    ontbrekendeKleuren,
    xSpreiding,
    observaties,
    overlegadvies,
    nietGemeten,
  };
}

// ---------------------------------------------------------------------------
// Bijkomende gemeten cijfers voor de renderer.
//
// Het contract van bouwTeamanalyse() ligt vast, maar het dossierblad wil ook de
// tweede kleur, de kostkleur, de bezette sectoren en de hoekafstanden tonen. Die
// worden hier uit hetzelfde resultaat herleid, zodat er geen tweede berekening
// naast de eerste ontstaat en de renderer niets hoeft te verzinnen.
// ---------------------------------------------------------------------------
export interface TeamanalyseCijfers {
  gemeten: number;                       // aantal deelnemers met kleurvolgorde
  metWielpositie: number;
  tweedeVerdeling: Record<string, number>;
  kostVerdeling: Record<string, number>;
  sectorenBezet: number | null;
  gemAfstand: number | null;
  maxAfstand: number | null;
  aanwezigeKleuren: string[];
}

export function teamanalyseCijfers(analyse: TeamanalyseResultaat): TeamanalyseCijfers {
  const tweedeVerdeling: Record<string, number> = {};
  const kostVerdeling: Record<string, number> = {};
  for (const kleur of TEAMANALYSE_KLEURORDE) {
    tweedeVerdeling[kleur] = 0;
    kostVerdeling[kleur] = 0;
  }
  let metWielpositie = 0;
  const hoeken: number[] = [];
  for (const d of analyse.deelnemers) {
    if (d.kleurvolgorde[1] !== undefined) tweedeVerdeling[d.kleurvolgorde[1]] = (tweedeVerdeling[d.kleurvolgorde[1]] ?? 0) + 1;
    if (d.kleurvolgorde[3] !== undefined) kostVerdeling[d.kleurvolgorde[3]] = (kostVerdeling[d.kleurvolgorde[3]] ?? 0) + 1;
    if (d.xStand !== null && d.yStand !== null) {
      metWielpositie++;
      // Terug naar de hoek vanaf 12 uur, uit dezelfde twee coördinaten.
      const graden = (Math.atan2(d.xStand, d.yStand) * 180) / Math.PI;
      hoeken.push((graden + 360) % 360);
    }
  }

  let som = 0;
  let paren = 0;
  let max = 0;
  for (let i = 0; i < hoeken.length; i++) {
    for (let j = i + 1; j < hoeken.length; j++) {
      let dh = Math.abs(hoeken[i] - hoeken[j]);
      if (dh > 180) dh = 360 - dh;
      som += dh;
      paren++;
      if (dh > max) max = dh;
    }
  }

  const sectoren = new Set(hoeken.map((h) => (Math.round(h / 45) % 8) + 1));

  return {
    gemeten: analyse.deelnemers.filter((d) => d.kleurvolgorde.length > 0).length,
    metWielpositie,
    tweedeVerdeling,
    kostVerdeling,
    sectorenBezet: hoeken.length > 0 ? sectoren.size : null,
    gemAfstand: paren > 0 ? Math.round(som / paren) : null,
    maxAfstand: paren > 0 ? Math.round(max) : null,
    aanwezigeKleuren: TEAMANALYSE_KLEURORDE.filter((k) => (analyse.kleurverdeling[k] ?? 0) > 0),
  };
}
