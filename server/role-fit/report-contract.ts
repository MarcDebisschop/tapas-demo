// ---------------------------------------------------------------------------
// server/role-fit/report-contract.ts
//
// Bouwt de versiegebonden JSON-contracten van de rapporten. Een contract is
// een pure functie van de vastgelegde gegevens van een case: dezelfde invoer
// met dezelfde regel- en contractversies geeft altijd hetzelfde contract. Het
// tijdstip van aanmaak staat erbuiten (in de envelop van het artefact), zodat
// de inhoudshash reproduceerbaar blijft.
//
// De HTML-renderers in reports/ lezen enkel dit contract. Ze trekken zelf geen
// enkele conclusie.
//
// TAALBEWAKING. Na het bouwen doorloopt lintContract alle door de motor
// gemaakte tekst op verboden formuleringen. Letterlijke brontekst (claims,
// vereisten en passages) en tekst die een mens al bij invoer liet toetsen,
// worden overgeslagen. Een treffer blokkeert het rapport.
// ---------------------------------------------------------------------------
import {
  AANBEVELING_LABEL,
  BESLISDOEL_LABEL,
  BEWIJSSOORT_LABEL,
  CLAIM_CATEGORIE_LABEL,
  CONFIDENCE_LABEL,
  DIMENSIE_PER_ID,
  FIT_INDICATIE_LABEL,
  FIT_TYPE_LABEL,
  GATE_STATUS_LABEL,
  INTEGRATIE_STATUS_LABEL,
  KRITICITEIT_LABEL,
  METHODE_LABEL,
  NIVEAU_HML_LABEL,
  ONTWIKKELAFSTAND_LABEL,
  PAKKET_LABEL,
  RECHTSGROND_LABEL,
  RF_CONTEXT_REGELVERSIE,
  RF_FIT_REGELVERSIE,
  RF_HBOM_REGELVERSIE,
  RF_INTEGRATIE_REGELVERSIE,
  RF_METHODIEKNAAM,
  RF_MODULE_VERSIE,
  RF_PRODUCTNAAM,
  RF_PROMPT_VERSIE,
  RF_RAPPORTCONTRACT_VERSIE,
  VEREISTE_NIVEAU_LABEL,
  vindVerbodenTaal,
  type Bewijssoort,
  type FitIndicatie,
  type RapportType,
  type TaalMelding,
} from "@shared/role-fit";
import { canoniek, sha256 } from "./storage";

// ---- Bundel: alles wat een rapport mag lezen -----------------------------------
export interface Bundel {
  zaak: any;
  wizard: Record<string, any>;
  bronnen: any[];
  claims: any[];
  vereisten: any[];
  profielClaims: any[];
  fitItems: any[];
  hypothesen: any[];
  oefeningen: any[];
  opdrachten: any[];
  observaties: any[];
  integraties: any[];
  besluit: any | null;
}

function json<T>(s: unknown, terug: T): T {
  if (typeof s !== "string") return terug;
  try {
    return JSON.parse(s) as T;
  } catch {
    return terug;
  }
}

/** De invoerhash van een rapport: enkel vastgelegde inhoud, geen tijdstempels van wijziging. */
export function invoerHash(b: Bundel, type: RapportType): string {
  const zonderTijd = (r: any) => {
    if (!r) return r;
    const { updatedAt, createdAt, ...rest } = r;
    return rest;
  };
  const basis: Record<string, unknown> = {
    type,
    versies: versies(),
    zaak: zonderTijd(b.zaak),
    bronnen: b.bronnen.map((x) => ({ id: x.id, hash: x.contentHash })),
    claims: b.claims.map(zonderTijd),
    vereisten: b.vereisten.map(zonderTijd),
    profielClaims: b.profielClaims.map((x) => x.contentHash),
    fitItems: b.fitItems.map((x) => x.contentHash),
  };
  if (type !== "fit-dossier") {
    basis.hypothesen = b.hypothesen.map(zonderTijd);
    basis.oefeningen = b.oefeningen.map((x) => x.contentHash);
  }
  if (type === "decision-dossier" || type === "kandidaat-feedback") {
    basis.observaties = b.observaties.map((x) => x.contentHash);
    basis.integraties = b.integraties.map((x) => x.contentHash);
    basis.besluit = b.besluit ? b.besluit.contentHash : null;
  }
  return sha256(canoniek(basis));
}

export function versies() {
  return {
    module: RF_MODULE_VERSIE,
    rapportcontract: RF_RAPPORTCONTRACT_VERSIE,
    fitregels: RF_FIT_REGELVERSIE,
    hbomregels: RF_HBOM_REGELVERSIE,
    integratieregels: RF_INTEGRATIE_REGELVERSIE,
    contextregels: RF_CONTEXT_REGELVERSIE,
    prompt: RF_PROMPT_VERSIE,
  };
}

function kop(b: Bundel, type: RapportType) {
  const z = b.zaak;
  return {
    type,
    product: RF_PRODUCTNAAM,
    methodiek: RF_METHODIEKNAAM,
    contractversie: RF_RAPPORTCONTRACT_VERSIE,
    versies: versies(),
    zaak: {
      id: z.id,
      functieTitel: z.functieTitel,
      kandidaatLabel: z.kandidaatLabel,
      beslisdoel: BESLISDOEL_LABEL[z.beslisdoel as keyof typeof BESLISDOEL_LABEL] ?? z.beslisdoel,
      senioriteit: z.senioriteit,
      beslisdatum: z.beslisdatum,
      bevrorenOp: z.bevrorenOp ?? null,
      rechtsgrond: RECHTSGROND_LABEL[z.rechtsgrond as keyof typeof RECHTSGROND_LABEL] ?? z.rechtsgrond,
      bewaarTot: z.bewaarTot,
    },
  };
}

function bronnenLijst(b: Bundel) {
  return b.bronnen.map((x) => ({
    id: x.id,
    type: x.type,
    titel: x.titel || x.url || `Bron ${x.id}`,
    url: x.url ?? null,
    lengte: x.lengte,
    hash: String(x.contentHash).slice(0, 16),
  }));
}

const PROFIEL_BRON = {
  instrument: "T4P Business Kompas (zelfrapportage)",
};

function methodeEnGrenzen(type: RapportType) {
  const algemeen = [
    "Dit dossier ondersteunt een menselijk besluit. Het neemt zelf geen besluit en rangschikt geen personen.",
    "Profielsignalen komen uit een zelfrapportage en zeggen iets over voorkeur en energie in werk, niet over aangetoonde bekwaamheid.",
    "Er is geen totaalscore en geen samenvattend getal. Elke dimensie staat op zichzelf, met een eigen betrouwbaarheid.",
    "Ontbrekende gegevens worden niet ingevuld. Een onvolledig construct krijgt het label niet beoordeelbaar.",
    "Knock-out-vereisten worden nooit uit een profiel afgeleid, enkel uit technisch bewijs of een referentie.",
    "De regels en ankers in deze versie zijn inhoudelijk opgebouwd. Een predictieve validatiestudie voor deze toepassing ontbreekt nog; lees de indicaties daarom als hypothesen om te toetsen.",
  ];
  const perType: Record<RapportType, string[]> = {
    "fit-dossier": [
      "De betrouwbaarheid in dit dossier is ten hoogste midden: hoog is pas mogelijk na observatie.",
      "De verificatieagenda en de H-BOM Evidence Check zijn de volgende stap.",
    ],
    "hbom-guide": [
      "De observatoren zien de oefening en de ankers, nooit de hypothese, de verwachte richting of het profielsignaal.",
      "Beide observatoren leggen hun observatie onafhankelijk vast. Na indienen is een observatie vergrendeld.",
    ],
    "decision-dossier": [
      "Observaties worden niet uitgemiddeld. De integratie kijkt naar overeenstemming en bewijskwaliteit.",
      "Een gate is niet-compenseerbaar: sterk bewijs elders maakt een niet voldane gate niet goed.",
      "Het besluit is genomen en getekend door een mens, met een geschreven motivering.",
    ],
    "kandidaat-feedback": [
      "Deze samenvatting beschrijft gedrag in de context van deze rol en dit proces. Ze is geen oordeel over de persoon.",
    ],
  };
  return {
    regels: [...algemeen, ...perType[type]],
    bewijslegende: (Object.keys(BEWIJSSOORT_LABEL) as Bewijssoort[]).map((k) => ({ soort: k, label: BEWIJSSOORT_LABEL[k] })),
  };
}

function telIndicaties(items: any[]): Record<FitIndicatie, number> {
  const t: Record<FitIndicatie, number> = { strong_support: 0, likely_support: 0, mixed: 0, likely_friction: 0, not_assessable: 0 };
  for (const i of items) t[i.indicatie as FitIndicatie]++;
  return t;
}

function telTekst(t: Record<FitIndicatie, number>): string {
  const delen: string[] = [];
  const sup = t.strong_support + t.likely_support;
  if (sup) delen.push(`${sup} ondersteunend`);
  if (t.mixed) delen.push(`${t.mixed} gemengd`);
  if (t.likely_friction) delen.push(`${t.likely_friction} met frictie`);
  if (t.not_assessable) delen.push(`${t.not_assessable} niet beoordeelbaar`);
  return delen.length ? delen.join(", ") : "geen vereisten";
}

function fitRij(b: Bundel, f: any) {
  const v = b.vereisten.find((x) => x.id === f.requirementId);
  const d = json<any>(f.detailJson, {});
  return {
    vereisteId: f.requirementId,
    vereiste: v?.vereiste ?? "",
    dimensie: DIMENSIE_PER_ID[v?.dimensie]?.label ?? "Gate",
    niveau: VEREISTE_NIVEAU_LABEL[v?.niveau as keyof typeof VEREISTE_NIVEAU_LABEL] ?? "",
    fitType: f.fitType,
    fitTypeLabel: FIT_TYPE_LABEL[f.fitType as keyof typeof FIT_TYPE_LABEL] ?? f.fitType,
    kriticiteit: f.kriticiteit,
    kriticiteitLabel: KRITICITEIT_LABEL[f.kriticiteit as keyof typeof KRITICITEIT_LABEL],
    indicatie: f.indicatie,
    indicatieLabel: FIT_INDICATIE_LABEL[f.indicatie as FitIndicatie],
    confidence: f.confidence,
    confidenceLabel: CONFIDENCE_LABEL[f.confidence as keyof typeof CONFIDENCE_LABEL],
    afstand: f.ontwikkelafstand,
    afstandLabel: ONTWIKKELAFSTAND_LABEL[f.ontwikkelafstand as keyof typeof ONTWIKKELAFSTAND_LABEL],
    energie: f.energie ?? null,
    gate: !!d.gate,
    uitleg: d.uitleg ?? [],
    alternatieven: d.alternatieveVerklaringen ?? [],
    verificatievragen: d.verificatievragen ?? [],
    bewijs: (d.gate ? ["ontbrekend"] : ["profiel", ...(d.contextClaimIds?.length ? ["context"] : [])]) as Bewijssoort[],
  };
}

// ---- Dossier 1 -------------------------------------------------------------
export function bouwFitDossier(b: Bundel) {
  const rijen = b.fitItems.map((f) => fitRij(b, f));
  const nietGate = rijen.filter((r) => !r.gate);
  const kern = nietGate.filter((r) => r.kriticiteit === "critical" || r.kriticiteit === "important");
  const rol = kern.filter((r) => r.fitType === "demands_abilities");
  const org = nietGate.filter((r) => r.fitType !== "demands_abilities");
  const energieKost = kern.filter((r) => r.energie === "kost");
  const nb = nietGate.filter((r) => r.indicatie === "not_assessable").length;
  const bevestigd = b.claims.filter((c) => c.status === "approved");
  const bronnenBevestigd = new Set(bevestigd.map((c) => c.sourceId ?? 0)).size;
  const medium = nietGate.filter((r) => r.confidence === "medium").length;
  const w = b.wizard ?? {};

  const statuskaarten = [
    {
      titel: "Rolfit",
      waarde: telTekst(telIndicaties(rol)),
      toelichting: "Kritieke en belangrijke vereisten van de rol, naast het profielsignaal. Geen totaalscore.",
      bewijs: ["profiel", "context"] as Bewijssoort[],
    },
    {
      titel: "Organisatiefit",
      waarde: telTekst(telIndicaties(org)),
      toelichting: "Behoeften en wat de omgeving biedt, gelijkenis in waarden en aanvulling op het team.",
      bewijs: ["profiel", "context"] as Bewijssoort[],
    },
    {
      titel: "Energie en houdbaarheid",
      waarde: energieKost.length === 0 ? "Geen kernvereiste die energie kost" : `${energieKost.length} kernvereiste(n) die energie kosten`,
      toelichting: "Waar de rol veel vraagt van iets dat energie kost, is houdbaarheid een verificatiepunt.",
      bewijs: ["profiel"] as Bewijssoort[],
    },
    {
      titel: "Bewijsbetrouwbaarheid",
      waarde: medium > 0 ? `Midden voor ${medium} van ${nietGate.length} vereisten, verder laag` : "Laag: profiel en context, nog geen observatie",
      toelichting: `${bevestigd.length} bevestigde contextclaims uit ${bronnenBevestigd} bron(nen). ${nb} vereiste(n) niet beoordeelbaar.`,
      bewijs: ["context", ...(nb ? ["ontbrekend"] : [])] as Bewijssoort[],
    },
  ];

  const ontwikkelbaar = rijen.filter((r) => !r.gate && (b.vereisten.find((v) => v.id === r.vereisteId)?.niveau === "developable"));
  const frictie = nietGate.filter((r) => r.indicatie === "likely_friction");
  const gemengd = nietGate.filter((r) => r.indicatie === "mixed");

  const scenarios = [
    {
      naam: "Basis",
      beschrijving:
        "De rol zoals ze vandaag beschreven is. Waar het profiel ondersteunt, is een vlotte start plausibel indien de context bevestigd wordt in de verificatie.",
      aandachtspunten: nietGate.filter((r) => r.indicatie === "strong_support" || r.indicatie === "likely_support").slice(0, 4).map((r) => r.vereiste),
    },
    {
      naam: "Stretch",
      beschrijving:
        "De rol groeit in verantwoordelijkheid of tempo. Groei is plausibel indien ontwikkelbare vereisten met korte of middellange afstand begeleid worden.",
      aandachtspunten: ontwikkelbaar.filter((r) => r.afstand === "short" || r.afstand === "medium").slice(0, 4).map((r) => r.vereiste),
    },
    {
      naam: "Tegenwind",
      beschrijving:
        "De omgeving zit tegen: hoge druk, weinig steun of snelle verandering. Vereisten met frictie of energie die het kost, verdienen dan de meeste aandacht.",
      aandachtspunten: [...frictie, ...gemengd].slice(0, 4).map((r) => r.vereiste),
    },
  ];

  const runway = ontwikkelbaar.map((r) => ({ vereiste: r.vereiste, afstand: r.afstand, afstandLabel: r.afstandLabel, indicatieLabel: r.indicatieLabel }));

  const verificatieagenda = rijen
    .filter((r) => r.gate || r.indicatie !== "strong_support" || r.confidence === "low")
    .slice(0, 12)
    .map((r) => ({
      vereiste: r.vereiste,
      route: r.gate ? "Technisch bewijs of referentie" : "H-BOM Evidence Check",
      vraag: r.verificatievragen[0] ?? "",
      kriticiteitLabel: r.kriticiteitLabel,
    }));

  const patroon = b.profielClaims.map((p) => ({
    construct: p.construct,
    familie: p.familie,
    net: p.net,
    energie: p.energieStatus,
    volledig: !!p.volledig,
  }));

  return {
    ...kop(b, "fit-dossier"),
    statuskaarten,
    blauwdruk: {
      missie: w.missie ?? "",
      resultaten: Array.isArray(w.resultaten) ? w.resultaten : [],
      verwachtingen: { d90: w.verwachting90 ?? "", d180: w.verwachting180 ?? "", d365: w.verwachting365 ?? "" },
      vereisten: b.vereisten.map((v) => ({
        id: v.id,
        vereiste: v.vereiste,
        niveau: VEREISTE_NIVEAU_LABEL[v.niveau as keyof typeof VEREISTE_NIVEAU_LABEL],
        kriticiteit: KRITICITEIT_LABEL[v.kriticiteit as keyof typeof KRITICITEIT_LABEL],
        dimensie: DIMENSIE_PER_ID[v.dimensie]?.label ?? "Gate",
      })),
    },
    omgeving: {
      velden: Object.entries({ ...(w.omgeving ?? {}), ...(w.organisatie ?? {}), ...(w.team ?? {}) })
        .filter(([, v]) => typeof v === "string" && (v as string).trim())
        .map(([k, v]) => ({ sleutel: k, waarde: v as string })),
      claims: b.claims
        .filter((c) => c.status === "approved" && ["environment", "organization", "team"].includes(c.categorie))
        .map((c) => ({ categorie: CLAIM_CATEGORIE_LABEL[c.categorie as keyof typeof CLAIM_CATEGORIE_LABEL], claim: c.claim, bronId: c.sourceId })),
    },
    profielbron: { ...PROFIEL_BRON, contractversie: b.profielClaims[0]?.bronContractversie ?? "" },
    patroon,
    matrix: rijen,
    orgFit: {
      vraagVermogen: nietGate.filter((r) => r.fitType === "demands_abilities"),
      behoefteAanbod: nietGate.filter((r) => r.fitType === "needs_supplies"),
      gelijkenis: nietGate.filter((r) => r.fitType === "supplementary"),
      aanvulling: nietGate.filter((r) => r.fitType === "complementary"),
    },
    scenarios,
    runway,
    verificatieagenda,
    gates: rijen.filter((r) => r.gate).map((r) => {
      const v = b.vereisten.find((x) => x.id === r.vereisteId);
      return { vereiste: r.vereiste, status: v?.gateStatus ?? "open", statusLabel: GATE_STATUS_LABEL[(v?.gateStatus ?? "open") as keyof typeof GATE_STATUS_LABEL] };
    }),
    bronnen: bronnenLijst(b),
    methode: methodeEnGrenzen("fit-dossier"),
  };
}

// ---- Dossier 2 -------------------------------------------------------------
export function bouwHbomGids(b: Bundel) {
  const geselecteerd = b.hypothesen.filter((h) => h.geselecteerd);
  return {
    ...kop(b, "hbom-guide"),
    pakket: b.zaak.pakket ?? null,
    pakketLabel: b.zaak.pakket ? PAKKET_LABEL[b.zaak.pakket as keyof typeof PAKKET_LABEL] : "",
    pool: b.hypothesen.map((h) => {
      const d = json<any>(h.detailJson, {});
      return {
        id: h.id,
        rang: h.rang,
        geselecteerd: !!h.geselecteerd,
        dimensie: DIMENSIE_PER_ID[d.dimensie]?.label ?? "",
        stelling: h.stelling,
        tegenhypothese: h.tegenhypothese,
        kriticiteitLabel: KRITICITEIT_LABEL[h.kriticiteit as keyof typeof KRITICITEIT_LABEL],
        onzekerheid: h.onzekerheid,
        observeerbaarheidLabel: NIVEAU_HML_LABEL[h.observeerbaarheid as keyof typeof NIVEAU_HML_LABEL],
        prioriteit: h.prioriteit,
        methodeLabel: METHODE_LABEL[h.methode as keyof typeof METHODE_LABEL],
        bevestigend: d.bevestigendeIndicatoren ?? [],
        tegen: d.tegenIndicatoren ?? [],
        alternatief: d.alternatieveVerklaringen ?? [],
        verbodenInferentie: h.verbodenInferentie,
      };
    }),
    oefeningen: b.oefeningen.map((o) => ({
      volgorde: o.volgorde,
      titel: o.titel,
      methodeLabel: METHODE_LABEL[o.methode as keyof typeof METHODE_LABEL],
      instructie: o.instructie,
      probes: json<string[]>(o.probesJson, []),
      ankers: json<Record<string, string>>(o.ankersJson, {}),
    })),
    aantalGeselecteerd: geselecteerd.length,
    gates: b.vereisten
      .filter((v) => v.kriticiteit === "gate")
      .map((v) => ({ vereiste: v.vereiste, route: "Technisch bewijs of referentie", statusLabel: GATE_STATUS_LABEL[(v.gateStatus ?? "open") as keyof typeof GATE_STATUS_LABEL] })),
    observatoren: b.opdrachten.map((o) => ({ rol: o.rol, naam: o.actorNaam, status: o.status })),
    semiBlind: [
      "Recruiter en hiring manager krijgen elk een eigen, persoonlijke link.",
      "Het observatiescherm toont de oefening, de ankers en de velden, nooit de hypothese of het profiel.",
      "Geen van beiden ziet de observatie van de ander voordat beide ingediend hebben.",
      "Na indienen is de observatie vergrendeld. Een correctie wordt een nieuwe versie met een reden.",
    ],
    methode: methodeEnGrenzen("hbom-guide"),
  };
}

// ---- Dossier 3 -------------------------------------------------------------
function convergentieRijen(b: Bundel) {
  return b.integraties.map((i) => {
    const h = b.hypothesen.find((x) => x.id === i.hypothesisId);
    const d = json<any>(i.detailJson, {});
    return {
      hypotheseId: i.hypothesisId,
      stelling: h?.stelling ?? "",
      dimensie: DIMENSIE_PER_ID[json<any>(h?.detailJson, {}).dimensie]?.label ?? "",
      status: i.integratieStatus,
      statusLabel: INTEGRATIE_STATUS_LABEL[i.integratieStatus as keyof typeof INTEGRATIE_STATUS_LABEL],
      berekendLabel: INTEGRATIE_STATUS_LABEL[i.berekendeStatus as keyof typeof INTEGRATIE_STATUS_LABEL],
      overschreven: i.integratieStatus !== i.berekendeStatus,
      overrideReden: i.overrideReden ?? null,
      scores: d.scores ?? { recruiter: null, hiring_manager: null },
      profielRichting: d.profielRichting ?? "onbekend",
      confidenceLabel: CONFIDENCE_LABEL[(d.confidence ?? "low") as keyof typeof CONFIDENCE_LABEL],
      redenen: d.redenen ?? [],
      bewijs: ["profiel", "context", "observatie"] as Bewijssoort[],
    };
  });
}

export function bouwBesluitDossier(b: Bundel) {
  const conv = convergentieRijen(b);
  const bes = b.besluit;
  const bd = json<any>(bes?.detailJson, {});
  const gates = b.vereisten
    .filter((v) => v.kriticiteit === "gate")
    .map((v) => ({
      vereiste: v.vereiste,
      status: v.gateStatus ?? "open",
      statusLabel: GATE_STATUS_LABEL[(v.gateStatus ?? "open") as keyof typeof GATE_STATUS_LABEL],
      toelichting: v.gateToelichting ?? "",
    }));
  const fitRijen = b.fitItems.map((f) => fitRij(b, f));
  const runway = fitRijen
    .filter((r) => !r.gate && b.vereisten.find((v) => v.id === r.vereisteId)?.niveau === "developable")
    .map((r) => ({ vereiste: r.vereiste, afstand: r.afstand, afstandLabel: r.afstandLabel, indicatieLabel: r.indicatieLabel }));
  const opdrachten = b.opdrachten.map((o) => ({ rol: o.rol, naam: o.actorNaam, ingediendOp: o.ingediendOp }));
  const correcties = b.observaties.filter((o) => o.versie > 1).map((o) => ({ opdracht: o.assignmentId, oefening: o.exerciseId, versie: o.versie, reden: o.correctieReden }));

  return {
    ...kop(b, "decision-dossier"),
    besluit: bes
      ? {
          aanbeveling: bes.aanbeveling,
          aanbevelingLabel: AANBEVELING_LABEL[bes.aanbeveling as keyof typeof AANBEVELING_LABEL],
          rationale: bes.rationale,
          voorwaarden: bd.voorwaarden ?? [],
          vervolgstappen: bd.vervolgstappen ?? [],
          plan100: bd.plan100 ?? "",
          plan180: bd.plan180 ?? "",
          ondertekenaar: bd.ondertekenaarNaam ?? `Beheerder ${bes.signerAdminId}`,
          getekendOp: bes.signedAt,
          inputHash: bes.inputHash,
        }
      : null,
    convergentie: conv,
    sterktes: conv.filter((c) => c.status === "convergent_support"),
    risicos: conv.filter((c) => c.status === "repeated_counter_indication" || (c.status === "mixed_context_dependent" && c.profielRichting === "spanning")),
    gemengd: conv.filter((c) => c.status === "mixed_context_dependent"),
    onvoldoende: conv.filter((c) => c.status === "insufficient_evidence"),
    gates,
    runway,
    audit: {
      bevrorenOp: b.zaak.bevrorenOp ?? null,
      freezeOverride: b.zaak.freezeOverrideReden ?? null,
      observatoren: opdrachten,
      correcties,
      overrides: conv.filter((c) => c.overschreven).map((c) => ({ hypotheseId: c.hypotheseId, reden: c.overrideReden })),
    },
    bronnen: bronnenLijst(b),
    methode: methodeEnGrenzen("decision-dossier"),
    kandidaatFeedback: bouwKandidaatFeedbackInhoud(b, conv, bd),
  };
}

function bouwKandidaatFeedbackInhoud(b: Bundel, conv: ReturnType<typeof convergentieRijen>, bd: any) {
  return {
    functieTitel: b.zaak.functieTitel,
    tekst: bd.kandidaatFeedback ?? "",
    zichtbaar: conv.filter((c) => c.status === "convergent_support").map((c) => c.dimensie),
    verder: conv.filter((c) => c.status !== "convergent_support").map((c) => c.dimensie),
    uitleg:
      "Deze feedback beschrijft wat binnen de oefeningen van dit proces zichtbaar werd. Onderwerpen onder \"om verder te verkennen\" zijn geen tekorten: er was te weinig of wisselend bewijs binnen de beperkte tijd van een selectie.",
  };
}

export function bouwKandidaatFeedback(b: Bundel) {
  const conv = convergentieRijen(b);
  const bd = json<any>(b.besluit?.detailJson, {});
  return {
    ...kop(b, "kandidaat-feedback"),
    feedback: bouwKandidaatFeedbackInhoud(b, conv, bd),
    methode: methodeEnGrenzen("kandidaat-feedback"),
  };
}

// ---- Registry --------------------------------------------------------------
export const CONTRACT_BOUWERS: Record<RapportType, (b: Bundel) => Record<string, unknown>> = {
  "fit-dossier": bouwFitDossier,
  "hbom-guide": bouwHbomGids,
  "decision-dossier": bouwBesluitDossier,
  "kandidaat-feedback": bouwKandidaatFeedback,
};

// ---- Taalbewaking ----------------------------------------------------------
// Velden met letterlijke brontekst of met menselijke tekst die al bij invoer
// getoetst werd. Die worden hier niet opnieuw beoordeeld.
const OVERSLAAN = new Set([
  "claim",
  "vereiste",
  "titel",
  "url",
  "missie",
  "resultaten",
  "verwachtingen",
  "velden",
  "functieTitel",
  "kandidaatLabel",
  "rationale",
  "voorwaarden",
  "vervolgstappen",
  "plan100",
  "plan180",
  "tekst",
  "overrideReden",
  "reden",
  "toelichting_mens",
  "freezeOverride",
  "aandachtspunten",
  "correcties",
  "naam",
  "ondertekenaar",
]);

export function lintContract(contract: unknown): Array<TaalMelding & { pad: string }> {
  const uit: Array<TaalMelding & { pad: string }> = [];
  const loop = (v: unknown, pad: string) => {
    if (typeof v === "string") {
      for (const m of vindVerbodenTaal(v)) uit.push({ ...m, pad });
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => loop(x, `${pad}[${i}]`));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (OVERSLAAN.has(k)) continue;
        loop(x, pad ? `${pad}.${k}` : k);
      }
    }
  };
  loop(contract, "");
  return uit;
}
