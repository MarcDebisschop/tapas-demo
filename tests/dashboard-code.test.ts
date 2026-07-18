import { describe, it, expect } from "vitest";
import { dashboardCodeVanToken, voornaamVanNaam } from "../server/dashboard-code";

// Optie A (eindscherm): het POST /api/afnames/:id/koppel-dashboard-endpoint geeft
// { dashboardToken, dashboardCode, voornaam } terug. De dashboardCode + voornaam
// worden 100% afgeleid met deze gedeelde helpers (zelfde afleiding als
// /api/deelnemers/login), dus we leggen dat deterministische gedrag hier vast.

describe("dashboardCodeVanToken", () => {
  it("is deterministisch: eerste vier cijfers uit het token", () => {
    expect(dashboardCodeVanToken("ab1c2d3e4f5")).toBe("1234");
  });

  it("valt per positie terug op 2-0-2-6 als er te weinig cijfers zijn", () => {
    expect(dashboardCodeVanToken("abcdef")).toBe("2026");
    expect(dashboardCodeVanToken("x7y")).toBe("7026");
  });

  it("geeft altijd exact vier cijfers terug", () => {
    const code = dashboardCodeVanToken("token-9z8y7x");
    expect(code).toMatch(/^\d{4}$/);
  });

  it("is stabiel voor hetzelfde token (idempotent)", () => {
    const token = "k3m9q1w7e5r";
    expect(dashboardCodeVanToken(token)).toBe(dashboardCodeVanToken(token));
  });
});

describe("voornaamVanNaam", () => {
  it("neemt het eerste woord van de volledige naam", () => {
    expect(voornaamVanNaam("Marc Debisschop")).toBe("Marc");
  });

  it("geeft null bij lege of ontbrekende naam", () => {
    expect(voornaamVanNaam(null)).toBeNull();
    expect(voornaamVanNaam("")).toBeNull();
  });
});
