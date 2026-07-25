// ---------------------------------------------------------------------------
// tests/duiding-pseudonimisering.test.ts - AVG art. 5.1.c, 32 en 44 e.v.
//
// Wat de test bewijst:
//   1. De poort weigert een payload met een participant-blok, met een naam,
//      met een e-mailadres of met de respondentCode (die de initialen van de
//      deelnemer bevat en dus indirect identificeert).
//   2. De poort laat een payload zonder persoonsgegevens wel door - de guard
//      breekt de bestaande AI-duiding dus niet.
//   3. Het doorgifteregister vermeldt per instrument of live-duiding aan staat,
//      met ontvanger en vereiste grondslag, zodat het verwerkingsregister klopt.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  keurPayloadGoed,
  bouwDoorgifteRegister,
  VERBODEN_SLEUTELS,
} from "../server/duiding-pseudonimisering";

const CONTRACT = {
  participant: {
    respondentCode: "MDB-2026-001",
    name: "Marc Debisschop",
    company: "TaPasCity",
    role: "Zaakvoerder",
  },
  sections: { main: { meta: { averageEnergy: 7.2 } } },
};

// Een payload zoals bouwAiPayload die opbouwt: enkel regie, ankers, scores en
// de te herschrijven prozateksten. Geen enkel identificerend veld.
const SCHONE_PAYLOAD = [
  "Je schrijft de duiding van een uniek talentprofiel.",
  "ANKERS (toon-/nadrukinstructies per dimensie):",
  "- Ondernemen: benoem de drang om te starten.",
  "BEVROREN SCORECONTRACT (de enige toegestane feiten/cijfers):",
  JSON.stringify({ main: { meta: { averageEnergy: 7.2 }, constructRows: [{ construct: "Ondernemen", family: "Drivers", net: 4 }] } }),
  "TE HERSCHRIJVEN DUIDING:",
  JSON.stringify([{ index: 0, kop: "Energiebeeld", paragrafen: ["Je energie ligt op 7.2."] }]),
].join("\n");

describe("duiding-pseudonimisering", () => {
  it("laat een payload zonder persoonsgegevens door", () => {
    const uitkomst = keurPayloadGoed(SCHONE_PAYLOAD, CONTRACT);
    expect(uitkomst.redenen).toEqual([]);
    expect(uitkomst.ok).toBe(true);
  });

  it("weigert een payload met het participant-blok", () => {
    const payload = SCHONE_PAYLOAD + "\n" + JSON.stringify({ participant: CONTRACT.participant });
    const uitkomst = keurPayloadGoed(payload, CONTRACT);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.redenen.join(" ")).toContain("participant");
  });

  it("weigert een payload met een e-mailadres", () => {
    const uitkomst = keurPayloadGoed(SCHONE_PAYLOAD + "\nContact: marc@tapascity.com", CONTRACT);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.redenen).toContain("payload bevat een e-mailpatroon");
  });

  it("weigert de naam of de respondentCode ook zonder verdachte sleutelnaam", () => {
    const metNaam = keurPayloadGoed(SCHONE_PAYLOAD + "\nDit profiel is van Marc Debisschop.", CONTRACT);
    expect(metNaam.ok).toBe(false);
    expect(metNaam.redenen).toContain("payload bevat een identificerende waarde uit participant");

    const metCode = keurPayloadGoed(SCHONE_PAYLOAD + "\nDossier MDB-2026-001", CONTRACT);
    expect(metCode.ok).toBe(false);
  });

  it("weigert een lege payload", () => {
    expect(keurPayloadGoed("", CONTRACT).ok).toBe(false);
    expect(keurPayloadGoed("   ", CONTRACT).ok).toBe(false);
  });

  it("dekt de kern-persoonsvelden af in de verboden sleutels", () => {
    for (const sleutel of ["participant", "name", "email", "company", "role", "respondentcode"]) {
      expect(VERBODEN_SLEUTELS as readonly string[]).toContain(sleutel);
    }
  });

  it("bouwt een doorgifteregister met ontvanger en vereiste grondslag", () => {
    const register = bouwDoorgifteRegister(
      [
        { id: "t4p-business-kompas", label: "T4P Business Kompas" },
        { id: "t4sports", label: "T4Sports" },
      ],
      (id) => id === "t4sports",
    );
    expect(register).toHaveLength(2);
    expect(register[0]!.liveDuidingAan).toBe(false);
    expect(register[1]!.liveDuidingAan).toBe(true);
    for (const regel of register) {
      expect(regel.ontvanger).toContain("Google");
      expect(regel.land).toBe("buiten de EER");
      expect(regel.grondslagVereist).toContain("DPA");
    }
  });
});
