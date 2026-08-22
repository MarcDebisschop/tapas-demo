// ---------------------------------------------------------------------------
// TaPas Platform - canonieke naamgeving van de invulindex
//
// De index die in het datacontract onder `meta.consistency` staat, meet HOE de
// vragenlijst is ingevuld: hoe volledig er geantwoord is en hoe goed de
// energieantwoorden bij de keuzes aansluiten. Het is GEEN psychometrische
// betrouwbaarheidsmaat. Er wordt geen alfa, geen omega en geen
// consistentiecoëfficiënt berekend.
//
// Daarom bestaat er precies een zichtbare naam voor deze index, en die staat
// hier. De interne sleutel in het datacontract blijft `consistency`, zodat
// eerder opgeslagen contracten en rapporten blijven werken.
//
// Classificatie van de grenzen in deze module: technische kwaliteitsregel.
// De grenzen 80 en 60 zijn ontwerpconventies van de ontwikkelaar en rusten
// niet op normgroepen of empirisch bepaalde cut-offs.
// ---------------------------------------------------------------------------

import { TALEN, STANDAARD_TAAL, type Taal } from "./talen";

type ML = Record<Taal, string>;

function kiesTaal(v: ML, taal: unknown): string {
  const t = (TALEN as readonly string[]).includes(String(taal))
    ? (taal as Taal)
    : STANDAARD_TAAL;
  return v[t] ?? v[STANDAARD_TAAL];
}

/** Volledige, canonieke naam van de index. */
export const INVULLING_NAAM: ML = {
  nl: "Volledigheid en samenhang van de invulling",
  fr: "Exhaustivité et cohérence du remplissage",
  en: "Completeness and coherence of the responses given",
  es: "Integridad y coherencia del cuestionario rellenado",
  ru: "Полнота и согласованность заполнения",
};

/** Korte naam, voor tabelkolommen en kaarttitels met beperkte ruimte. */
export const INVULLING_NAAM_KORT: ML = {
  nl: "Volledigheid en samenhang",
  fr: "Exhaustivité et cohérence",
  en: "Completeness and coherence",
  es: "Integridad y coherencia",
  ru: "Полнота и согласованность",
};

/** Naam in woorden, voor de tweede tabelrij met het label. */
export const INVULLING_NAAM_WOORDEN: ML = {
  nl: "Volledigheid en samenhang in woorden",
  fr: "Exhaustivité et cohérence en mots",
  en: "Completeness and coherence in words",
  es: "Integridad y coherencia en palabras",
  ru: "Полнота и согласованность словами",
};

/**
 * Vaste verklaringszin. Moet meekomen op elke plek waar het cijfer voor het
 * eerst zichtbaar wordt, zodat de index nooit als betrouwbaarheid leest.
 */
export const INVULLING_GEEN_BETROUWBAARHEID: ML = {
  nl: "Dit cijfer is geen betrouwbaarheidsmaat van de vragenlijst en geen psychometrische coefficient. Het beschrijft alleen deze invulling.",
  fr: "Ce chiffre n'est pas une mesure de fiabilité du questionnaire ni un coefficient psychométrique. Il décrit uniquement ce remplissage.",
  en: "This figure is not a reliability measure of the questionnaire and not a psychometric coefficient. It only describes this set of responses.",
  es: "Esta cifra no es una medida de fiabilidad del cuestionario ni un coeficiente psicométrico. Solo describe este cuestionario rellenado.",
  ru: "Это число не является мерой надежности опросника и не является психометрическим коэффициентом. Оно описывает только это заполнение.",
};

/** Grenzen van de woordlabels. Ontwerpconventie, geen empirische cut-off. */
export const INVULLING_GRENS_HOOG = 80;
export const INVULLING_GRENS_MIDDEN = 60;

export function invullingNaam(taal: unknown): string {
  return kiesTaal(INVULLING_NAAM, taal);
}

export function invullingNaamKort(taal: unknown): string {
  return kiesTaal(INVULLING_NAAM_KORT, taal);
}

export function invullingNaamWoorden(taal: unknown): string {
  return kiesTaal(INVULLING_NAAM_WOORDEN, taal);
}

export function invullingGeenBetrouwbaarheid(taal: unknown): string {
  return kiesTaal(INVULLING_GEEN_BETROUWBAARHEID, taal);
}
