// ---------------------------------------------------------------------------
// tests/doorlooptijd-en-t4students-claims.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. De doorlooptijd van een afname wordt gemeten vanaf het startmoment van
//      de DEELNEMER en niet vanaf het aanmaakmoment van de afname, en een
//      onmogelijke duur levert null op in plaats van een misleidend getal.
//   B. Het startmoment wordt maar een keer gezet, zodat een tussentijdse
//      bewaaractie de doorlooptijd niet terugzet.
//   C. De kolommen gestart_op en duur_ms staan in het schema en worden voor
//      bestaande databanken idempotent bijgezet.
//   D. Het T4Students-contract draagt de kwaliteitsmelding over de manier van
//      invullen, ook voor oudere contracten die ze nog niet bevatten.
//   E. T4Students claimt nergens een normgroep en noemt overal dezelfde
//      doelgroep.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startVeld, berekenDuurMs } from "../server/routes/afnames";
import {
  bouwT4StudentsAfnameContract,
  leesT4StudentsContract,
} from "../server/t4students/afnamecontract";
import {
  ITEM_TIJDSDREMPEL_MS,
  berekenAfnamekwaliteit,
  berekenInvulpatroon,
  patroonMeldingJij,
  tempoMeldingJij,
} from "../server/afnamekwaliteit";
import { t4studentsItems } from "../server/t4students/instrument";

const lees = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("A. Doorlooptijd", () => {
  it("rekent het verschil tussen starten en afronden in milliseconden", () => {
    const start = "2026-03-01T10:00:00.000Z";
    const einde = "2026-03-01T10:18:30.000Z";
    expect(berekenDuurMs(start, einde)).toBe(18 * 60 * 1000 + 30 * 1000);
  });

  it("levert null wanneer er geen startmoment bekend is", () => {
    expect(berekenDuurMs(null, "2026-03-01T10:00:00.000Z")).toBeNull();
    expect(berekenDuurMs("", "2026-03-01T10:00:00.000Z")).toBeNull();
    expect(berekenDuurMs("   ", "2026-03-01T10:00:00.000Z")).toBeNull();
  });

  it("levert null bij een onmogelijke of negatieve duur", () => {
    expect(berekenDuurMs("2026-03-01T11:00:00.000Z", "2026-03-01T10:00:00.000Z")).toBeNull();
    expect(berekenDuurMs("geen datum", "2026-03-01T10:00:00.000Z")).toBeNull();
  });
});

describe("B. Startmoment wordt niet overschreven", () => {
  it("zet een startmoment wanneer er nog geen is", () => {
    const veld = startVeld(null);
    expect(typeof veld.gestartOp).toBe("string");
    expect(Number.isFinite(Date.parse(veld.gestartOp!))).toBe(true);
  });

  it("laat een bestaand startmoment ongemoeid", () => {
    expect(startVeld("2026-03-01T10:00:00.000Z")).toEqual({});
  });
});

describe("C. Kolommen in schema en migratie", () => {
  it("staat in het Drizzle-schema", () => {
    const schema = lees("shared/schema.ts");
    expect(schema).toContain('gestartOp: text("gestart_op")');
    expect(schema).toContain('duurMs: integer("duur_ms")');
  });

  it("wordt idempotent bijgezet voor bestaande databanken", () => {
    const storage = lees("server/storage.ts");
    expect(storage).toContain('if (!heeft("gestart_op")) add(`ALTER TABLE afnames ADD COLUMN gestart_op TEXT;`)');
    expect(storage).toContain('if (!heeft("duur_ms")) add(`ALTER TABLE afnames ADD COLUMN duur_ms INTEGER;`)');
  });
});

describe("D. Kwaliteitsmelding in het T4Students-contract", () => {
  // Twintig items, waarvan zes ver onder de drempel: dat is dertig procent en
  // dus boven het aandeel waarop de melding aanslaat.
  const tijden: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    tijden["T4S-" + i] = i < 6 ? Math.round(ITEM_TIJDSDREMPEL_MS / 4) : 9000;
  }

  it("zet een melding wanneer de vragenlijst opvallend snel is doorlopen", () => {
    const contract = bouwT4StudentsAfnameContract({
      respondentCode: "T4S-TIJD-001",
      name: "Test Student",
      taal: "nl",
      responses: {},
      itemTijden: tijden,
    });
    expect(contract.afnamekwaliteit).not.toBeNull();
    expect(contract.afnamekwaliteit!.vlag).toBe(true);
    expect(contract.afnamekwaliteit!.melding).toBeTruthy();
    expect(contract.afnamekwaliteit!.itemsMetTijd).toBe(20);
    expect(contract.afnamekwaliteit!.itemsOnderDrempel).toBe(6);
  });

  it("zet geen melding wanneer er geen tijdgegevens zijn", () => {
    const contract = bouwT4StudentsAfnameContract({
      respondentCode: "T4S-TIJD-002",
      name: "Test Student",
      taal: "nl",
      responses: {},
      itemTijden: null,
    });
    expect(contract.afnamekwaliteit).toBeNull();
  });

  it("berekent de melding opnieuw voor een ouder contract zonder melding", () => {
    const contract = bouwT4StudentsAfnameContract({
      respondentCode: "T4S-TIJD-003",
      name: "Test Student",
      taal: "nl",
      responses: {},
      itemTijden: tijden,
    });
    const oud = { ...contract } as any;
    delete oud.afnamekwaliteit;
    const gelezen = leesT4StudentsContract(oud);
    expect(gelezen.afnamekwaliteit?.vlag).toBe(true);
  });

  it("laat het rapport de melding tonen op het verantwoordingsblad", () => {
    const paginas = lees("server/t4students/rapport-paginas.ts");
    expect(paginas).toContain("Over de manier van invullen");
    expect(paginas).toContain("tempoMeldingJij");
    const keten = lees("server/t4students/rapport-keten.ts");
    expect(keten).toContain("afnamekwaliteit: contract.afnamekwaliteit ?? null");
  });
});

describe("E. Geen normgroepclaim en een uniforme doelgroep", () => {
  const bronnen = [
    "server/routes-stm.ts",
    "server/gids/data.ts",
    "client/src/data/instrumentengids.ts",
    "server/bulk-import/templates.ts",
  ];

  it("noemt nergens nog aparte normgroepen voor T4Teens of T4Students", () => {
    for (const p of bronnen) {
      expect(lees(p)).not.toContain("aparte normgroepen");
    }
  });

  it("noemt overal dezelfde doelgroep voor T4Students", () => {
    for (const p of bronnen) {
      const bron = lees(p);
      expect(bron).not.toContain("17-23");
      expect(bron).not.toContain("17 tot 23");
    }
  });

  it("zegt in het rapport in welke ontwikkelfase het instrument staat", () => {
    const paginas = lees("server/t4students/rapport-paginas.ts");
    expect(paginas).toContain("reflectief ontwikkelinstrument");
    expect(paginas).toContain("betrouwbaarheidscijfers");
    expect(paginas).toContain("geen validiteitsonderzoek");
    expect(paginas).toContain("gekozen conventies");
  });
});

// ---------------------------------------------------------------------------
// F. Invulpatroon: dezelfde keuze in een lange reeks
// ---------------------------------------------------------------------------

describe("F. Invulpatroon", () => {
  it("vlagt een lange reeks gelijke antwoorden", () => {
    // Twintig antwoorden waarvan twaalf op rij dezelfde keuze.
    const reeks = [0, 1, 2, 3, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 1, 3];
    const patroon = berekenInvulpatroon(reeks);
    expect(patroon).not.toBeNull();
    expect(patroon!.langsteReeks).toBe(12);
    expect(patroon!.vlag).toBe(true);
    expect(patroon!.melding).toContain("12 stellingen op rij");
  });

  it("vlagt een schaal die nauwelijks gebruikt wordt", () => {
    // Twintig antwoorden, achttien keer dezelfde keuze maar nooit lang op rij.
    const reeks = [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2];
    const patroon = berekenInvulpatroon(reeks);
    expect(patroon!.aandeelZelfdeAntwoord).toBeCloseTo(0.9, 3);
    expect(patroon!.vlag).toBe(true);
  });

  it("vlagt niet bij een gewoon gespreid patroon", () => {
    const reeks = [0, 1, 2, 3, 2, 1, 0, 3, 2, 1, 3, 0, 1, 2, 3, 1, 2, 0, 3, 1];
    const patroon = berekenInvulpatroon(reeks);
    expect(patroon!.vlag).toBe(false);
    expect(patroon!.melding).toBeNull();
  });

  it("vlagt nooit bij te weinig antwoorden", () => {
    const patroon = berekenInvulpatroon([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    expect(patroon!.antwoorden).toBe(12);
    expect(patroon!.langsteReeks).toBe(12);
    expect(patroon!.vlag).toBe(false);
  });

  it("levert null zonder bruikbare antwoorden", () => {
    expect(berekenInvulpatroon([])).toBeNull();
    expect(berekenInvulpatroon([null, undefined, Number.NaN])).toBeNull();
  });

  it("reist mee in het T4Students-contract en op het verantwoordingsblad", () => {
    const antwoorden: Record<string, { recognition: number }> = {};
    for (const item of t4studentsItems()) antwoorden[item.id] = { recognition: 2 };
    const contract = bouwT4StudentsAfnameContract({
      respondentCode: "T4S-PATROON-001",
      name: "Test Student",
      taal: "nl",
      responses: antwoorden,
    });
    expect(contract.invulpatroon?.vlag).toBe(true);
    const paginas = lees("server/t4students/rapport-paginas.ts");
    expect(paginas).toContain("Over het antwoordpatroon");
    expect(lees("server/t4students/rapport-keten.ts")).toContain(
      "invulpatroon: contract.invulpatroon ?? null",
    );
  });
});

describe("G. De leessignalen spreken de jongere zelf aan", () => {
  it("zegt in de tempotekst niets over de deelnemer in de derde persoon", () => {
    // Genoeg gemeten items om te mogen vlaggen: vijf snelle en vijftien rustige.
    const tijden: Record<string, number> = {};
    for (let i = 0; i < 20; i++) tijden[`I${i}`] = i < 5 ? 500 : 9000;
    const kwaliteit = berekenAfnamekwaliteit(tijden);
    expect(kwaliteit!.vlag).toBe(true);
    const jij = tempoMeldingJij(kwaliteit);
    expect(jij).toContain("Je hebt deze vragenlijst");
    expect(jij).not.toContain("de deelnemer");
    expect(jij).not.toContain("\u2014");
  });

  it("zegt in de patroontekst niets over de deelnemer in de derde persoon", () => {
    const patroon = berekenInvulpatroon(Array.from({ length: 20 }, () => 2));
    expect(patroon!.vlag).toBe(true);
    const jij = patroonMeldingJij(patroon);
    expect(jij).toContain("In je antwoorden valt een patroon op");
    expect(jij).not.toContain("de deelnemer");
    expect(jij).not.toContain("\u2014");
  });

  it("levert null wanneer er niets te melden is", () => {
    expect(tempoMeldingJij(null)).toBeNull();
    expect(patroonMeldingJij(null)).toBeNull();
    const rustig = berekenInvulpatroon([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]);
    expect(rustig!.vlag).toBe(false);
    expect(patroonMeldingJij(rustig)).toBeNull();
  });
});
