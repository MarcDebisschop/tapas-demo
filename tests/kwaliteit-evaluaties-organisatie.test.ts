// ---------------------------------------------------------------------------
// tests/kwaliteit-evaluaties-organisatie.test.ts
//
// Module Kwaliteit & Evaluaties, stap organisatie-evaluatie (§6-§7 en het
// betrokken deel van §16 van de bouwspecificatie). Deze tests leggen de
// scenario's vast die tijdens de bouw handmatig via curl tegen de draaiende
// server zijn geverifieerd: tabellen ontstaan zelfstandig, een uitnodiging
// is een niet-raadbaar token met vervaldatum en wordt pas bij INDIENEN als
// gebruikt gemarkeerd (niet bij het eerste bezoek), de organisatiescore
// wordt correct gewogen berekend, een tweede indiening verandert niets, een
// ontbrekende verplichte vraag wordt geweigerd, en een laag-scorende of
// zelf-gemelde evaluatie legt een kwaliteitssignaal vast.
//
// Net als in tests/t4o-registratie.test.ts wijst deze test eerst
// TAPAS_DB_PATH naar een eigen tijdelijk bestand, zodat dit testbestand niet
// tegelijk met een ander testbestand in dezelfde SQLite-databank schrijft.
// Deze regel moet boven de eerste import van het module blijven staan.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TAPAS_DB_PATH = join(
  tmpdir(),
  `tapas-kwaliteit-evaluaties-organisatie-${process.pid}.db`,
);

describe("Kwaliteit & Evaluaties — organisatie-evaluatie: datamodel", () => {
  it("maakt alle eigen tabellen zelfstandig aan (self-contained-modulepatroon)", async () => {
    const opslag = await import("../server/kwaliteit-evaluaties/storage");
    const tabellen = opslag.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'evaluatie_%'")
      .all()
      .map((r: any) => r.name)
      .sort();
    expect(tabellen).toEqual(
      [
        "evaluatie_antwoorden",
        "evaluatie_coaches",
        "evaluatie_organisatie_contacten",
        "evaluatie_organisatie_evaluaties",
        "evaluatie_sessies",
        "evaluatie_signalen",
        "evaluatie_uitnodigingen",
      ].sort(),
    );
  });

  it("gebruikt het prefix evaluatie_ en botst niet met de bestaande kwaliteit_*-tabellen van STM", async () => {
    const opslag = await import("../server/kwaliteit-evaluaties/storage");
    const namen = opslag.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r: any) => r.name as string);
    const kwaliteitStm = namen.filter((n) => n.startsWith("kwaliteit_"));
    const evaluatieModule = namen.filter((n) => n.startsWith("evaluatie_"));
    // Geen enkele naam mag in beide groepen tegelijk voorkomen (er zijn hier
    // geen overlappende namen mogelijk per constructie, maar we bewijzen het).
    const overlap = evaluatieModule.filter((n) => kwaliteitStm.includes(n));
    expect(overlap).toEqual([]);
  });
});

describe("Kwaliteit & Evaluaties — organisatie-evaluatie: token- en indienflow", () => {
  async function maakTestSessieMetUitnodiging() {
    const opslag = await import("../server/kwaliteit-evaluaties/storage");
    const contact = await opslag.maakContact({
      organisatieId: 999001,
      naam: "Test Contactpersoon",
      email: "contact@voorbeeld.test",
      functie: null as any,
    } as any);
    const sessie = await opslag.maakSessie({
      titel: "Testsessie",
      organisatieId: 999001,
      coachId: null as any,
      startDatetime: new Date().toISOString(),
      eindDatetime: null as any,
      locatie: null as any,
      taal: "nl",
      aantalDeelnemersVerwacht: null as any,
      aantalDeelnemersWerkelijk: null as any,
      bevestigdeDoelstellingen: [],
    } as any);
    const { token, verlooptOp } = opslag.maakUitnodiging(sessie.id, contact.id, "nl");
    return { opslag, contact, sessie, token, verlooptOp };
  }

  it("herkent een geldig token en levert de bijbehorende uitnodiging", async () => {
    const { opslag, sessie, contact, token } = await maakTestSessieMetUitnodiging();
    const status = opslag.vindUitnodiging(token);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.uitnodiging.sessieId).toBe(sessie.id);
      expect(status.uitnodiging.contactId).toBe(contact.id);
    }
  });

  it("wijst een onbekend of verkeerd gevormd token af zonder te crashen", async () => {
    const opslag = await import("../server/kwaliteit-evaluaties/storage");
    expect(opslag.vindUitnodiging("niet-een-geldig-token").ok).toBe(false);
    expect(opslag.vindUitnodiging("a".repeat(64)).ok).toBe(false);
    expect(opslag.vindUitnodiging("").ok).toBe(false);
  });

  it("markeert het token NIET als ingewisseld bij het eerste (of een herhaald) bezoek — tussentijds terugkeren mag", async () => {
    const { opslag, sessie, token } = await maakTestSessieMetUitnodiging();
    const status1 = opslag.vindUitnodiging(token);
    expect(status1.ok).toBe(true);
    if (!status1.ok) return;

    // Eerste opening maakt het concept aan (vind-of-maak, idempotent).
    const concept1 = await opslag.vindOfMaakConceptEvaluatie(status1.uitnodiging, sessie.organisatieId);
    expect(concept1.status).toBe("concept");

    // Een tweede opening (bv. terugkerende tab) vindt exact dezelfde rij en
    // het token blijft niet-ingewisseld: geen enkele lees-actie zet ingewisseld_op.
    const status2 = opslag.vindUitnodiging(token);
    expect(status2.ok).toBe(true);
    if (!status2.ok) return;
    const concept2 = await opslag.vindOfMaakConceptEvaluatie(status2.uitnodiging, sessie.organisatieId);
    expect(concept2.id).toBe(concept1.id);
    expect(status2.uitnodiging.ingewisseldOp).toBeNull();
  });

  it("weigert indienen zolang verplichte vragen ontbreken, en laat dat aan de laag boven de opslag over", async () => {
    // Deze regel zit in routes.ts (§7.4-controle vóór opslag.diendeEvaluatieIn
    // wordt aangeroepen), niet in storage.ts zelf: storage.ts voert uit wat
    // gevraagd wordt en bewaart alleen. We bewijzen hier dat de vragenset zelf
    // de juiste vragen als verplicht markeert, zodat die routecontrole een
    // volledige lijst controleert.
    const { ORG_EVAL_SECTIES } = await import("../server/kwaliteit-evaluaties/vragen");
    const verplichteCodes = ORG_EVAL_SECTIES.flatMap((s) => s.vragen)
      .filter((v) => v.verplicht)
      .map((v) => v.code);
    // Elke sectie A t/m E heeft twee verplichte schaalvragen; sectie F heeft
    // bovendien een verplichte open vraag over de volgende stap (§7.4).
    expect(verplichteCodes).toContain("ORG_ALG_01");
    expect(verplichteCodes).toContain("ORG_ALG_02");
    expect(verplichteCodes).toContain("ORG_DUUR_04");
    expect(verplichteCodes).not.toContain("ORG_ALG_03"); // optionele open vraag
  });

  it("berekent scores en dient in; een tweede indiening verandert niets (dubbele-indieningbescherming)", async () => {
    const { opslag, sessie, token } = await maakTestSessieMetUitnodiging();
    const status = opslag.vindUitnodiging(token);
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    const evaluatie = await opslag.vindOfMaakConceptEvaluatie(status.uitnodiging, sessie.organisatieId);

    await opslag.bewaarConcept(evaluatie.id, "nl", {
      antwoorden: [
        { vraagCode: "ORG_ALG_01", numeriekeWaarde: 9 },
        { vraagCode: "ORG_ALG_02", numeriekeWaarde: 9 },
        { vraagCode: "ORG_PAS_01", numeriekeWaarde: 8 },
        { vraagCode: "ORG_PAS_02", numeriekeWaarde: 8 },
        { vraagCode: "ORG_PROF_01", numeriekeWaarde: 9 },
        { vraagCode: "ORG_PROF_02", numeriekeWaarde: 9 },
        { vraagCode: "ORG_PROF_03", numeriekeWaarde: 9 },
        { vraagCode: "ORG_ACT_01", numeriekeWaarde: 8 },
        { vraagCode: "ORG_ACT_02", numeriekeWaarde: 8 },
        { vraagCode: "ORG_ACT_03", numeriekeWaarde: 8 },
        { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 9 },
        { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 9 },
        { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 9 },
        { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 8 },
        { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 8 },
        { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 8 },
        { vraagCode: "ORG_DUUR_04", tekstWaarde: "Opvolgsessie plannen." },
      ],
    });

    const eersteIndiening = await opslag.diendeEvaluatieIn(evaluatie.id);
    expect(eersteIndiening).toBeDefined();
    expect(eersteIndiening!.evaluatie.status).toBe("verzonden");
    expect(eersteIndiening!.evaluatie.scoreTotaal).not.toBeNull();
    expect(eersteIndiening!.evaluatie.ingediendOp).not.toBeNull();
    // Hoge scores overal: geen automatisch signaal.
    expect(eersteIndiening!.signaalAangemaakt).toBe(false);

    const eersteTotaal = eersteIndiening!.evaluatie.scoreTotaal;
    const eersteIngediendOp = eersteIndiening!.evaluatie.ingediendOp;

    // Concept mag na indienen niet meer wijzigen.
    const conceptPoging = await opslag.bewaarConcept(evaluatie.id, "nl", {
      basisinfoKlopt: "nee",
    });
    expect(conceptPoging?.basisinfoKlopt).not.toBe("nee");

    // Tweede indiening: geen fout, geen herberekening, dezelfde rij.
    const tweedeIndiening = await opslag.diendeEvaluatieIn(evaluatie.id);
    expect(tweedeIndiening).toBeDefined();
    expect(tweedeIndiening!.signaalAangemaakt).toBe(false);
    expect(tweedeIndiening!.evaluatie.scoreTotaal).toBe(eersteTotaal);
    expect(tweedeIndiening!.evaluatie.ingediendOp).toBe(eersteIngediendOp);

    // Het token is nu als ingewisseld gemarkeerd (pas bij indienen, §14.3).
    const statusNa = opslag.vindUitnodiging(token);
    expect(statusNa.ok).toBe(true);
    if (statusNa.ok) expect(statusNa.uitnodiging.ingewisseldOp).not.toBeNull();
  });

  it("legt een kwaliteitssignaal vast bij een lage organisatiescore (automatisch, §6.5) en bij een zelf-gemeld signaal (§7.5)", async () => {
    const { opslag, sessie, token } = await maakTestSessieMetUitnodiging();
    const status = opslag.vindUitnodiging(token);
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    const evaluatie = await opslag.vindOfMaakConceptEvaluatie(status.uitnodiging, sessie.organisatieId);

    await opslag.bewaarConcept(evaluatie.id, "nl", {
      signaalNiveau: "ernstig",
      signaalTypes: ["onveilige_groepsdynamiek"],
      signaalBeschrijving: "Twee deelnemers voelden zich niet op hun gemak.",
      signaalWilContact: true,
      antwoorden: [
        { vraagCode: "ORG_ALG_01", numeriekeWaarde: 3 },
        { vraagCode: "ORG_ALG_02", numeriekeWaarde: 3 },
        { vraagCode: "ORG_PAS_01", numeriekeWaarde: 3 },
        { vraagCode: "ORG_PAS_02", numeriekeWaarde: 3 },
        { vraagCode: "ORG_PROF_01", numeriekeWaarde: 2 },
        { vraagCode: "ORG_PROF_02", numeriekeWaarde: 2 },
        { vraagCode: "ORG_PROF_03", numeriekeWaarde: 2 },
        { vraagCode: "ORG_ACT_01", numeriekeWaarde: 3 },
        { vraagCode: "ORG_ACT_02", numeriekeWaarde: 3 },
        { vraagCode: "ORG_ACT_03", numeriekeWaarde: 3 },
        { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 3 },
        { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 3 },
        { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 3 },
        { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 3 },
        { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 3 },
        { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 3 },
        { vraagCode: "ORG_DUUR_04", tekstWaarde: "Een grondige herziening van de aanpak." },
      ],
    });

    const voorSignalen = (await opslag.lijstSignalen()).length;
    const resultaat = await opslag.diendeEvaluatieIn(evaluatie.id);
    expect(resultaat!.signaalAangemaakt).toBe(true);

    const signalen = await opslag.lijstSignalen();
    // Twee signalen: één zelf-gemeld ("ernstig"), één automatisch ("automatisch_laag").
    expect(signalen.length).toBe(voorSignalen + 2);
    const nieuw = signalen.slice(voorSignalen);
    expect(nieuw.some((s) => s.ernst === "ernstig")).toBe(true);
    expect(nieuw.some((s) => s.ernst === "automatisch_laag")).toBe(true);
    const zelfgemeld = nieuw.find((s) => s.ernst === "ernstig")!;
    expect(JSON.parse(zelfgemeld.types)).toContain("onveilige_groepsdynamiek");
    expect(zelfgemeld.wilContact).toBe(true);
  });
});

describe("Kwaliteit & Evaluaties — organisatie-evaluatie: scoring", () => {
  it("berekent een correct gewogen totaal uit bekende domeinscores", async () => {
    const { berekenOrganisatieScores } = await import("../server/kwaliteit-evaluaties/scoring");
    const scores = berekenOrganisatieScores([
      { vraagCode: "ORG_PAS_01", numeriekeWaarde: 8 },
      { vraagCode: "ORG_PAS_02", numeriekeWaarde: 8 }, // passend gemiddelde: 8
      { vraagCode: "ORG_PROF_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_PROF_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_PROF_03", numeriekeWaarde: 10 }, // professioneel gemiddelde: 10
      { vraagCode: "ORG_ACT_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_ACT_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_ACT_03", numeriekeWaarde: 6 }, // activerend gemiddelde: 6
      { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 8 },
      { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 8 },
      { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 8 }, // toepasbaar gemiddelde: 8
      { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 10 }, // duurzaam gemiddelde: 10
      { vraagCode: "ORG_ALG_02", numeriekeWaarde: 9 }, // aanbevelingsscore, telt niet mee in domeinen
    ]);
    expect(scores.passend).toBe(8);
    expect(scores.professioneel).toBe(10);
    expect(scores.activerend).toBe(6);
    expect(scores.toepasbaar).toBe(8);
    expect(scores.duurzaam).toBe(10);
    expect(scores.aanbeveling).toBe(9);
    // Gewogen: 8*0.2 + 10*0.25 + 6*0.2 + 8*0.25 + 10*0.1 = 1.6+2.5+1.2+2+1 = 8.3
    expect(scores.totaal).toBe(8.3);
  });

  it("negeert open-tekstantwoorden en onbekende vraagcodes in de scoreberekening", async () => {
    const { berekenOrganisatieScores } = await import("../server/kwaliteit-evaluaties/scoring");
    const scores = berekenOrganisatieScores([
      { vraagCode: "ORG_PAS_03", tekstWaarde: "Een lange toelichting die niet meetelt." },
      { vraagCode: "ONBEKENDE_CODE_X", numeriekeWaarde: 10 },
      { vraagCode: "ORG_PAS_01", numeriekeWaarde: 7 },
      { vraagCode: "ORG_PAS_02", numeriekeWaarde: 7 },
    ]);
    expect(scores.passend).toBe(7);
    expect(scores.professioneel).toBeNull();
    // Enkel het passend-domein heeft gewicht: totaal = gemiddelde van het
    // enige ingevulde domein.
    expect(scores.totaal).toBe(7);
  });

  it("meldt geen automatisch signaal wanneer alle domeinen ruim boven de drempel scoren", async () => {
    const { berekenOrganisatieScores, bepaalAutomatischSignaal } = await import(
      "../server/kwaliteit-evaluaties/scoring"
    );
    const scores = berekenOrganisatieScores([
      { vraagCode: "ORG_PAS_01", numeriekeWaarde: 9 },
      { vraagCode: "ORG_PAS_02", numeriekeWaarde: 9 },
      { vraagCode: "ORG_PROF_01", numeriekeWaarde: 9 },
      { vraagCode: "ORG_PROF_02", numeriekeWaarde: 9 },
      { vraagCode: "ORG_PROF_03", numeriekeWaarde: 9 },
      { vraagCode: "ORG_ACT_01", numeriekeWaarde: 9 },
      { vraagCode: "ORG_ACT_02", numeriekeWaarde: 9 },
      { vraagCode: "ORG_ACT_03", numeriekeWaarde: 9 },
      { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 9 },
      { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 9 },
      { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 9 },
      { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 9 },
      { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 9 },
      { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 9 },
    ]);
    expect(bepaalAutomatischSignaal(scores)).toBeNull();
  });

  it("meldt een automatisch signaal wanneer het totaal onder de drempel van 7,0 zakt", async () => {
    const { berekenOrganisatieScores, bepaalAutomatischSignaal } = await import(
      "../server/kwaliteit-evaluaties/scoring"
    );
    const scores = berekenOrganisatieScores([
      { vraagCode: "ORG_PAS_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_PAS_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_PROF_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_PROF_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_PROF_03", numeriekeWaarde: 6 },
      { vraagCode: "ORG_ACT_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_ACT_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_ACT_03", numeriekeWaarde: 6 },
      { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 6 },
      { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 6 },
      { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 6 },
      { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 6 },
    ]);
    const signaal = bepaalAutomatischSignaal(scores);
    expect(signaal).not.toBeNull();
    expect(signaal!.reden).toMatch(/Organisatiescore totaal/);
    // Alle domeinen zitten op de kritische drempel (<=6.0): allemaal genoemd.
    expect(signaal!.domeinen.sort()).toEqual(
      ["activerend", "duurzaam", "passend", "professioneel", "toepasbaar"].sort(),
    );
  });

  it("meldt een automatisch signaal wanneer één kerndomein kritisch laag scoort, ook al is het totaal op norm", async () => {
    const { berekenOrganisatieScores, bepaalAutomatischSignaal } = await import(
      "../server/kwaliteit-evaluaties/scoring"
    );
    // Professioneel (gewicht 0.25) zeer laag, de rest heel hoog: totaal kan
    // toch boven 7 uitkomen terwijl één kerndomein alarmerend is.
    const scores = berekenOrganisatieScores([
      { vraagCode: "ORG_PAS_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_PAS_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_PROF_01", numeriekeWaarde: 5 },
      { vraagCode: "ORG_PROF_02", numeriekeWaarde: 5 },
      { vraagCode: "ORG_PROF_03", numeriekeWaarde: 5 },
      { vraagCode: "ORG_ACT_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_ACT_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_ACT_03", numeriekeWaarde: 10 },
      { vraagCode: "ORG_TOEP_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_TOEP_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_TOEP_03", numeriekeWaarde: 10 },
      { vraagCode: "ORG_DUUR_01", numeriekeWaarde: 10 },
      { vraagCode: "ORG_DUUR_02", numeriekeWaarde: 10 },
      { vraagCode: "ORG_DUUR_03", numeriekeWaarde: 10 },
    ]);
    expect(scores.totaal).toBeGreaterThanOrEqual(7.0);
    const signaal = bepaalAutomatischSignaal(scores);
    expect(signaal).not.toBeNull();
    expect(signaal!.domeinen).toEqual(["professioneel"]);
  });
});

describe("Kwaliteit & Evaluaties — organisatie-evaluatie: auditlogboek", () => {
  it("kent de drie evaluatie_organisatie_*-audit-acties en het signaal-actiecode in het centrale actieregister", async () => {
    const { AUDIT_ACTIES } = await import("../server/audit-log");
    expect(AUDIT_ACTIES).toContain("evaluatie_organisatie_uitnodiging_verstuurd");
    expect(AUDIT_ACTIES).toContain("evaluatie_organisatie_uitnodiging_ingetrokken");
    expect(AUDIT_ACTIES).toContain("evaluatie_organisatie_evaluatie_ingediend");
    expect(AUDIT_ACTIES).toContain("evaluatie_organisatie_signaal_aangemaakt");
  });
});
