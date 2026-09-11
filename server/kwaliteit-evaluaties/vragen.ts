/**
 * Vaste vragenset voor de organisatie-evaluatie (§7.4 van de
 * bouwspecificatie), verbatim overgenomen inclusief de exacte Nederlandse
 * tekst. Deze vragen staan hier vast in code voor Fase 1 / stap
 * "organisatie-evaluatie" — een beheerbare vragenbibliotheek met
 * versiebeheer (evaluation_questions/evaluation_question_versions, §10) is
 * Fase 2 en niet in deze stap gebouwd.
 *
 * Vraagcodes volgen het patroon uit het voorbeeld in §15.5 van de
 * specificatie zelf (ORG_PROF_01 voor de professionaliteitsvraag over de
 * coach), doorgetrokken naar de andere domeinen: ORG_<DOMEIN>_<NR>.
 *
 * BELANGRIJK — wijzigingsregel. Wie de tekst van een vraag verfijnt zonder
 * de betekenis te raken (spelling, duidelijkheid) mag dat vrij doen. Wie de
 * betekenis, de schaal of het domein van een vraag wijzigt, moet een NIEUWE
 * code gebruiken en dit vastleggen in het CHANGELOG en een bouwrapport —
 * conform de meta-governanceregel uit de implementatiebrief. Bestaande
 * antwoorden bewaren altijd hun eigen snapshot van de vraagtekst
 * (evaluatie_antwoorden.vraag_tekst) en veranderen dus nooit met
 * terugwerkende kracht mee.
 */

export const ORG_EVAL_DOMEINEN = [
  "passend",
  "professioneel",
  "activerend",
  "toepasbaar",
  "duurzaam",
] as const;
export type OrgEvalDomein = (typeof ORG_EVAL_DOMEINEN)[number];

// §6.3 — Organisatie-index, gewicht per domein.
export const ORG_EVAL_DOMEIN_GEWICHT: Record<OrgEvalDomein, number> = {
  passend: 0.2,
  professioneel: 0.25,
  activerend: 0.2,
  toepasbaar: 0.25,
  duurzaam: 0.1,
};

export type OrgEvalVraagType = "schaal" | "tekst";

export interface OrgEvalVraag {
  code: string;
  tekst: string;
  type: OrgEvalVraagType;
  /** Domein voor scoring; ontbreekt bij open teksten die niet meetellen. */
  domein?: OrgEvalDomein | "algemeen";
  verplicht: boolean;
  maxLengte?: number;
}

export interface OrgEvalSectie {
  code: string;
  titel: string;
  vragen: OrgEvalVraag[];
}

export const ORG_EVAL_SECTIES: OrgEvalSectie[] = [
  {
    code: "A",
    titel: "Algemene waardering",
    vragen: [
      {
        code: "ORG_ALG_01",
        tekst: "Hoe beoordeelt u de opleiding in haar geheel?",
        type: "schaal",
        domein: "algemeen",
        verplicht: true,
      },
      {
        code: "ORG_ALG_02",
        tekst:
          "Hoe waarschijnlijk is het dat u TaPasCity voor een vergelijkbare opleiding zou aanbevelen aan een collega of andere organisatie?",
        type: "schaal",
        domein: "algemeen",
        verplicht: true,
      },
      {
        code: "ORG_ALG_03",
        tekst: "Wat heeft voor u of uw organisatie het meeste waarde gehad?",
        type: "tekst",
        verplicht: false,
        maxLengte: 750,
      },
    ],
  },
  {
    code: "B",
    titel: "Passend",
    vragen: [
      {
        code: "ORG_PAS_01",
        tekst: "De opleiding sloot aan bij onze vraag, doelgroep en werkcontext.",
        type: "schaal",
        domein: "passend",
        verplicht: true,
      },
      {
        code: "ORG_PAS_02",
        tekst: "De doelstellingen waren helder en herkenbaar in de uitvoering.",
        type: "schaal",
        domein: "passend",
        verplicht: true,
      },
      {
        code: "ORG_PAS_03",
        tekst: "Wat sloot bijzonder goed aan, of wat had beter gekund?",
        type: "tekst",
        verplicht: false,
      },
    ],
  },
  {
    code: "C",
    titel: "Professioneel",
    vragen: [
      {
        code: "ORG_PROF_01",
        tekst: "De coach/facilitator trad deskundig, betrouwbaar en professioneel op.",
        type: "schaal",
        domein: "professioneel",
        verplicht: true,
      },
      {
        code: "ORG_PROF_02",
        tekst: "De coach/facilitator creëerde een respectvolle en veilige leeromgeving.",
        type: "schaal",
        domein: "professioneel",
        verplicht: true,
      },
      {
        code: "ORG_PROF_03",
        tekst: "De communicatie, structuur en tijdsbewaking waren helder.",
        type: "schaal",
        domein: "professioneel",
        verplicht: true,
      },
      {
        code: "ORG_PROF_04",
        tekst: "Wat viel u op in de manier van begeleiden?",
        type: "tekst",
        verplicht: false,
      },
    ],
  },
  {
    code: "D",
    titel: "Activerend",
    vragen: [
      {
        code: "ORG_ACT_01",
        tekst: "Deelnemers werden actief betrokken en uitgedaagd om mee te denken.",
        type: "schaal",
        domein: "activerend",
        verplicht: true,
      },
      {
        code: "ORG_ACT_02",
        tekst: "Er was een goede balans tussen inzicht, oefening, dialoog en reflectie.",
        type: "schaal",
        domein: "activerend",
        verplicht: true,
      },
      {
        code: "ORG_ACT_03",
        tekst: "De opleiding hield voldoende rekening met verschillen tussen deelnemers.",
        type: "schaal",
        domein: "activerend",
        verplicht: true,
      },
      {
        code: "ORG_ACT_04",
        tekst: "Wat werkte bijzonder goed of minder goed voor de deelnemers?",
        type: "tekst",
        verplicht: false,
      },
    ],
  },
  {
    code: "E",
    titel: "Toepasbaar",
    vragen: [
      {
        code: "ORG_TOEP_01",
        tekst: "De inhoud is bruikbaar in de dagelijkse praktijk.",
        type: "schaal",
        domein: "toepasbaar",
        verplicht: true,
      },
      {
        code: "ORG_TOEP_02",
        tekst: "Deelnemers kregen concrete handvatten, taal of acties mee.",
        type: "schaal",
        domein: "toepasbaar",
        verplicht: true,
      },
      {
        code: "ORG_TOEP_03",
        tekst: "Er is voldoende duidelijkheid over wat er na de opleiding kan gebeuren.",
        type: "schaal",
        domein: "toepasbaar",
        verplicht: true,
      },
      {
        code: "ORG_TOEP_04",
        tekst: "Welke toepassing of opvolging verwacht u concreet?",
        type: "tekst",
        verplicht: false,
      },
    ],
  },
  {
    code: "F",
    titel: "Duurzaam",
    vragen: [
      {
        code: "ORG_DUUR_01",
        tekst: "De opleiding droeg bij aan het beoogde doel van onze organisatie.",
        type: "schaal",
        domein: "duurzaam",
        verplicht: true,
      },
      {
        code: "ORG_DUUR_02",
        tekst: "De investering in tijd, aandacht en middelen was verantwoord.",
        type: "schaal",
        domein: "duurzaam",
        verplicht: true,
      },
      {
        code: "ORG_DUUR_03",
        tekst:
          "TaPasCity heeft voldoende duidelijk gemaakt welke volgende stap mogelijk of wenselijk is.",
        type: "schaal",
        domein: "duurzaam",
        verplicht: true,
      },
      {
        code: "ORG_DUUR_04",
        tekst: "Welke volgende stap zou voor uw organisatie het meeste verschil maken?",
        type: "tekst",
        verplicht: true,
      },
    ],
  },
];

export const ORG_EVAL_VRAGEN: OrgEvalVraag[] = ORG_EVAL_SECTIES.flatMap((s) => s.vragen);

export function vindVraag(code: string): OrgEvalVraag | undefined {
  return ORG_EVAL_VRAGEN.find((v) => v.code === code);
}

// §7.5 — signaaltypes bij een gemeld aandachtspunt of ernstig signaal.
export const SIGNAAL_TYPES = [
  "inhoudelijke_mismatch",
  "onvoldoende_voorbereiding",
  "onprofessionele_communicatie",
  "onveilige_groepsdynamiek",
  "grensoverschrijdend_gedrag",
  "vertrouwelijkheid_privacy",
  "organisatie_logistiek",
  "andere",
] as const;
export type SignaalType = (typeof SIGNAAL_TYPES)[number];

export const SIGNAAL_NIVEAUS = ["geen", "aandachtspunt", "ernstig"] as const;
export type SignaalNiveau = (typeof SIGNAAL_NIVEAUS)[number];
