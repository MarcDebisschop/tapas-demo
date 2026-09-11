/**
 * Scoring voor de organisatie-evaluatie — §6.1 t/m 6.5 van de
 * bouwspecificatie, beperkt tot de organisatie-index (deelnemers- en
 * coach-index volgen in een latere fase, samen met hun eigen flows).
 */
import { ORG_EVAL_DOMEIN_GEWICHT, type OrgEvalDomein, vindVraag } from "./vragen";

// §6.2 — standaarddrempels, hier als vaste standaardwaarden. Configureerbaar
// maken via een admin-instellingenscherm is Fase 2/3.
export const KWALITEITSNORM_TOTAAL = 8.0;
export const MINIMUMSCORE_DOMEIN = 7.0;
export const KRITISCHE_DOMEINSCORE = 6.0;
export const ORGANISATIE_TOTAAL_SIGNAALDREMPEL = 7.0;

export interface OrgEvalAntwoordInvoer {
  vraagCode: string;
  numeriekeWaarde?: number | null;
  tekstWaarde?: string | null;
}

export interface OrgEvalDomeinScores {
  passend: number | null;
  professioneel: number | null;
  activerend: number | null;
  toepasbaar: number | null;
  duurzaam: number | null;
  totaal: number | null;
  aanbeveling: number | null;
}

function gemiddelde(waarden: number[]): number | null {
  if (waarden.length === 0) return null;
  const som = waarden.reduce((a, b) => a + b, 0);
  return Math.round((som / waarden.length) * 100) / 100;
}

/**
 * Berekent de organisatie-index en de score per domein uit de ingediende
 * antwoorden. Antwoorden zonder numerieke waarde (open tekst) tellen niet
 * mee. Onbekende of niet-scorende vraagcodes worden genegeerd — dat laat
 * toe dat een toekomstige extra open vraag zonder gevolgen kan meelopen.
 */
export function berekenOrganisatieScores(
  antwoorden: OrgEvalAntwoordInvoer[],
): OrgEvalDomeinScores {
  const perDomein: Record<OrgEvalDomein, number[]> = {
    passend: [],
    professioneel: [],
    activerend: [],
    toepasbaar: [],
    duurzaam: [],
  };

  let aanbevelingswaarde: number | null = null;

  for (const a of antwoorden) {
    if (a.numeriekeWaarde == null) continue;
    const vraag = vindVraag(a.vraagCode);
    if (!vraag || vraag.type !== "schaal") continue;
    if (a.vraagCode === "ORG_ALG_02") {
      aanbevelingswaarde = a.numeriekeWaarde;
      continue;
    }
    if (vraag.domein && vraag.domein in perDomein) {
      perDomein[vraag.domein as OrgEvalDomein].push(a.numeriekeWaarde);
    }
  }

  const scores: OrgEvalDomeinScores = {
    passend: gemiddelde(perDomein.passend),
    professioneel: gemiddelde(perDomein.professioneel),
    activerend: gemiddelde(perDomein.activerend),
    toepasbaar: gemiddelde(perDomein.toepasbaar),
    duurzaam: gemiddelde(perDomein.duurzaam),
    totaal: null,
    aanbeveling: aanbevelingswaarde,
  };

  let gewichtSom = 0;
  let gewogenSom = 0;
  for (const domein of Object.keys(ORG_EVAL_DOMEIN_GEWICHT) as OrgEvalDomein[]) {
    const waarde = scores[domein];
    if (waarde == null) continue;
    const gewicht = ORG_EVAL_DOMEIN_GEWICHT[domein];
    gewogenSom += waarde * gewicht;
    gewichtSom += gewicht;
  }
  scores.totaal = gewichtSom > 0 ? Math.round((gewogenSom / gewichtSom) * 100) / 100 : null;

  return scores;
}

export interface AutomatischSignaal {
  reden: string;
  domeinen: OrgEvalDomein[];
}

/**
 * §6.5 — automatische signalen op basis van de organisatiescore alleen.
 * De regels over meerdere evaluaties heen (drie keer laag in 90 dagen,
 * coach-vs-extern-verschil > 2,0, terugkerende open-feedbackthema's)
 * vereisen historiek over sessies/coaches en horen bij het
 * kwaliteitscase-dashboard van een latere fase.
 */
export function bepaalAutomatischSignaal(scores: OrgEvalDomeinScores): AutomatischSignaal | null {
  const kritischeDomeinen: OrgEvalDomein[] = [];
  for (const domein of Object.keys(ORG_EVAL_DOMEIN_GEWICHT) as OrgEvalDomein[]) {
    const waarde = scores[domein];
    if (waarde != null && waarde <= KRITISCHE_DOMEINSCORE) kritischeDomeinen.push(domein);
  }

  if (scores.totaal != null && scores.totaal < ORGANISATIE_TOTAAL_SIGNAALDREMPEL) {
    return {
      reden: `Organisatiescore totaal (${scores.totaal}) ligt lager dan ${ORGANISATIE_TOTAAL_SIGNAALDREMPEL}.`,
      domeinen: kritischeDomeinen,
    };
  }
  if (kritischeDomeinen.length > 0) {
    return {
      reden: `Kerndomein(en) scoren ${KRITISCHE_DOMEINSCORE} of lager: ${kritischeDomeinen.join(", ")}.`,
      domeinen: kritischeDomeinen,
    };
  }
  return null;
}
