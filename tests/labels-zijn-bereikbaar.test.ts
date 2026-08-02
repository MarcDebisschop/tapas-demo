// ---------------------------------------------------------------------------
// Elk oordeel dat een rapport kan uitspreken, moet ook echt kunnen vallen bij
// een invulling die een jongere of een kind werkelijk kan geven. En geen enkel
// oordeel mag altijd vallen, want dan zegt het niets.
//
// Deze test meet dat over een grote reeks invullingen door de echte
// scoringsfunctie heen, inclusief de lege en de gedeeltelijke invulling.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { laadInstrumentItems } from "../server/question-manager";
import { buildT4TeensContract } from "../server/t4teens/scoring";
import { bouwT4TeensRapport } from "../server/t4teens/rapport";
import { buildT4KidsContract } from "../server/t4kids/scoring";
import {
  T4KIDS_STELLINGEN,
  T4KIDS_INTERESSE_PAREN,
  T4KIDS_ARCHETYPEN,
  T4KIDS_WOORDSCHAAL,
} from "../server/t4kids/itembank";
import { bouwKruisanalyse } from "../client/src/pages/t4kids/kruisanalyse";

const deelnemer = { respondentCode: "TEST-BEREIK", name: "Test Persoon" };

// De vijf antwoordpunten die het invulscherm aanbiedt. Een jongere kan niets
// anders geven dan een van deze vijf, dus alleen hierover meten heeft zin.
const ANTWOORDPUNTEN = [-2, -1, 0, 1, 2];

// Een herhaalbare reeks willekeurige invullingen: hetzelfde zaad geeft
// dezelfde reeks, zodat een gezakte test opnieuw te bekijken is.
function trekker(zaad: number) {
  let s = zaad;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// ── T4Teens ────────────────────────────────────────────────────────────────

const TEENS_ITEMS = laadInstrumentItems("tapas-t4teens").map((i) => i.itemId);

function teensInvullingen(): Record<string, number>[] {
  const reeks: Record<string, number>[] = [];
  // De lege invulling.
  reeks.push({});
  // Elke vraag apart op elk antwoordpunt: de gedeeltelijke invulling.
  for (const id of TEENS_ITEMS) {
    for (const w of ANTWOORDPUNTEN) reeks.push({ [id]: w });
  }
  // Facilitatie is het enige construct met twee vragen; alle combinaties.
  for (const a of ANTWOORDPUNTEN) {
    for (const b of ANTWOORDPUNTEN) reeks.push({ "T4T-V3-1": a, "T4T-V4-1": b });
  }
  // Volledige invullingen, willekeurig maar herhaalbaar.
  const random = trekker(20260802);
  for (let i = 0; i < 400; i++) {
    const r: Record<string, number> = {};
    for (const id of TEENS_ITEMS) r[id] = ANTWOORDPUNTEN[Math.floor(random() * 5)]!;
    reeks.push(r);
  }
  return reeks;
}

function teensRapportVan(responses: Record<string, number>) {
  return bouwT4TeensRapport(buildT4TeensContract({ ...deelnemer, responses }));
}

// Alle oordeelcellen (de derde kolom) uit alle tabellen van een rapport.
function oordeelCellen(inhoud: ReturnType<typeof teensRapportVan>): string[] {
  const uit: string[] = [];
  for (const s of inhoud.secties) {
    for (const rij of s.tabel?.rijen ?? []) uit.push(String(rij[2]));
  }
  return uit;
}

const TEENS_HERKENBAARHEID = [
  "heel herkenbaar",
  "herkenbaar",
  "soms wel, soms niet",
  "minder herkenbaar",
  "niet echt herkenbaar",
];
const TEENS_WERKING = ["eerder gaspedaal", "eerder rem", "in evenwicht"];
const TEENS_GEEN_OORDEEL = "te weinig antwoorden";

// Fragmenten die elk precies een van de batterijzinnen aanwijzen.
const TEENS_BATTERIJZINNEN = [
  "goed vol",
  "redelijk op peil",
  "wat lager dan gewoonlijk",
  "bijna leeg",
  "Je gaf niet aan hoe vol je batterij",
];

describe("T4Teens - elk oordeel is bereikbaar en geen enkel oordeel valt altijd", () => {
  const invullingen = teensInvullingen();
  const rapporten = invullingen.map(teensRapportVan);
  const cellen = rapporten.flatMap(oordeelCellen);
  const batterijTeksten = rapporten.map(
    (r) => r.secties.find((s) => s.kop.startsWith("Je batterij"))!.paragrafen[0]!,
  );

  it("de reeks invullingen is groot genoeg om iets te bewijzen", () => {
    expect(invullingen.length).toBeGreaterThan(500);
    expect(cellen.length).toBeGreaterThan(10000);
  });

  // Een cel telt alleen als voorbeeld van een label als ze er precies aan
  // gelijk is; "herkenbaar" komt anders ook voor in "heel herkenbaar".
  const aantalMet = (label: string) => cellen.filter((c) => c === label).length;

  it.each(TEENS_HERKENBAARHEID)("het label '%s' valt minstens een keer", (label) => {
    expect(aantalMet(label)).toBeGreaterThan(0);
  });

  it.each(TEENS_HERKENBAARHEID)("het label '%s' valt niet altijd", (label) => {
    expect(aantalMet(label)).toBeLessThan(cellen.length);
  });

  it.each(TEENS_WERKING)("de werking '%s' valt minstens een keer en niet altijd", (label) => {
    expect(aantalMet(label)).toBeGreaterThan(0);
    expect(aantalMet(label)).toBeLessThan(cellen.length);
  });

  it("de melding dat er te weinig antwoorden zijn, valt wel en valt niet altijd", () => {
    expect(aantalMet(TEENS_GEEN_OORDEEL)).toBeGreaterThan(0);
    expect(aantalMet(TEENS_GEEN_OORDEEL)).toBeLessThan(cellen.length);
  });

  it.each(TEENS_BATTERIJZINNEN)("de batterijzin over '%s' valt en valt niet altijd", (fragment) => {
    const n = batterijTeksten.filter((t) => t.includes(fragment)).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(batterijTeksten.length);
  });

  it("elk antwoordpunt op een vraag met een eigen construct geeft een ander oordeel", () => {
    // Wat de jongere merkt: wie "Past niet zo bij mij" antwoordde, kreeg
    // hetzelfde oordeel als wie "Past helemaal niet bij mij" antwoordde, en
    // wie "Past bij mij" antwoordde hetzelfde als "Past helemaal bij mij".
    // Twee van de vijf antwoorden konden dus geen eigen oordeel opleveren.
    const oordelen = ANTWOORDPUNTEN.map((w) => {
      const inhoud = teensRapportVan({ "T4T-V1-1": w });
      const sectie = inhoud.secties.find((s) => s.kop.startsWith("Talent-versnellers"))!;
      const rij = (sectie.tabel?.rijen ?? []).find((r) => r[0] === "Analyse")!;
      return String(rij[2]);
    });
    expect(new Set(oordelen).size).toBe(5);
  });
});

// ── T4Kids ─────────────────────────────────────────────────────────────────

const KIDS_WOORDPUNTEN = T4KIDS_WOORDSCHAAL.map((w) => w.waarde);
const KIDS_WOORDEN = T4KIDS_WOORDSCHAAL.map((w) => w.label);
const KIDS_DRIVERS = T4KIDS_STELLINGEN.filter((s) => s.soort === "Driver");

interface KidsInvulling {
  responses: Record<string, number | string>;
  keuzes: { archetypen: { id: string }[]; top3: string[] } | null;
}

function kidsInvullingen(): KidsInvulling[] {
  const reeks: KidsInvulling[] = [];
  // De lege invulling.
  reeks.push({ responses: {}, keuzes: null });
  // Elke stelling apart op elk woordpunt: de gedeeltelijke invulling.
  for (const s of T4KIDS_STELLINGEN) {
    for (const w of KIDS_WOORDPUNTEN) reeks.push({ responses: { [s.id]: w }, keuzes: null });
  }
  // Elk interessepaar apart, allebei de kanten.
  for (const p of T4KIDS_INTERESSE_PAREN) {
    for (const kant of ["links", "rechts"]) reeks.push({ responses: { [p.id]: kant }, keuzes: null });
  }
  // Alle stellingen samen op hetzelfde woordpunt: zo valt elk grenslabel.
  for (const w of KIDS_WOORDPUNTEN) {
    const responses: Record<string, number> = {};
    for (const s of T4KIDS_STELLINGEN) responses[s.id] = w;
    reeks.push({ responses, keuzes: null });
  }
  // Volledige invullingen, willekeurig maar herhaalbaar.
  const random = trekker(20260802);
  for (let i = 0; i < 400; i++) {
    const responses: Record<string, number | string> = {};
    for (const s of T4KIDS_STELLINGEN) {
      responses[s.id] = KIDS_WOORDPUNTEN[Math.floor(random() * KIDS_WOORDPUNTEN.length)]!;
    }
    for (const p of T4KIDS_INTERESSE_PAREN) responses[p.id] = random() < 0.5 ? "links" : "rechts";
    const archetypen = T4KIDS_ARCHETYPEN.filter(() => random() < 0.2).map((a) => ({ id: a.id }));
    reeks.push({ responses, keuzes: { archetypen, top3: archetypen.slice(0, 3).map((a) => a.id) } });
  }
  return reeks;
}

const KIDS_BALANSLABELS = [
  "eerder autonoom",
  "eerder extern",
  "in evenwicht",
  "te weinig antwoorden",
];

describe("T4Kids - elk oordeel is bereikbaar en geen enkel oordeel valt altijd", () => {
  const invullingen = kidsInvullingen();
  const contracten = invullingen.map((v) =>
    buildT4KidsContract({ ...deelnemer, responses: v.responses, keuzes: v.keuzes }),
  );

  it("de reeks invullingen is groot genoeg om iets te bewijzen", () => {
    expect(invullingen.length).toBeGreaterThan(400);
  });

  it.each(KIDS_BALANSLABELS)("het balanslabel '%s' valt en valt niet altijd", (label) => {
    const n = contracten.filter((c) => c.sections.main.meta.autonomie.balansLabel === label).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(contracten.length);
  });

  it.each(KIDS_WOORDEN)("het antwoordwoord '%s' komt terug in het rapport en niet altijd", (woord) => {
    const cellen = contracten.flatMap((c) =>
      c.sections.rapport.exacteAntwoorden.stellingen.map((s) => s.gekozenWoord),
    );
    const n = cellen.filter((c) => c === woord).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(cellen.length);
  });

  it("een construct zonder gemiddelde en een construct met gemiddelde komen allebei voor", () => {
    const rijen = contracten.flatMap((c) =>
      c.sections.main.constructRows.filter((r) => r.family !== "Interesse"),
    );
    expect(rijen.some((r) => r.avgEnergy === null)).toBe(true);
    expect(rijen.some((r) => typeof r.avgEnergy === "number")).toBe(true);
  });

  it.each(KIDS_DRIVERS.map((d) => d.mapping))(
    "de gesprekszin over driver '%s' valt en valt niet altijd",
    (driver) => {
      const zinnen = contracten.map((c) =>
        bouwKruisanalyse(c.sections.rapport.exacteAntwoorden as any, "Test").verwonderlijk.join(" "),
      );
      // De zin herkennen we aan de driver waar ze over gaat: we tellen hoe
      // vaak precies die driverzin valt door hem apart op te bouwen.
      const stelling = KIDS_DRIVERS.find((d) => d.mapping === driver)!;
      const eigenZin = bouwKruisanalyse(
        buildT4KidsContract({ ...deelnemer, responses: { [stelling.id]: 3 }, keuzes: null })
          .sections.rapport.exacteAntwoorden as any,
        "Test",
      ).verwonderlijk.join(" ");
      const n = zinnen.filter((z) => z === eigenZin).length;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(zinnen.length);
    },
  );

  it("de tegels en de staafgrafiek van pagina een tellen bij elke invulling hetzelfde", () => {
    for (const c of contracten) {
      const tally = new Map(
        c.sections.rapport.exacteAntwoorden.focusTally.map((f) => [f.focus, f.keuzes]),
      );
      for (const rij of c.sections.rapport.kind.reiskaart) {
        expect(rij.keuzes).toBe(tally.get(rij.focus));
      }
    }
  });
});
