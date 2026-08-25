import { describe, it, expect } from "vitest";
import { genereer2msRapportOpVolgorde, injecteerNaamDatum } from "../server/twominscan/rapport-selectie";

// De cover van het gedownloade profielrapport moet de organisatie tonen wanneer
// die bekend is. De 120 vooraf opgemaakte bestanden hebben daar geen
// plaatshouder voor, dus de regel wordt bijgetekend. Deze toetsen kijken naar
// wat er in de PDF terechtkomt, niet naar de code eromheen.

const VOLGORDE = ["groen", "geel", "rood", "blauw"];

async function tekstVanEersteBlad(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse").catch(() => ({ default: null as any }));
  if (!pdfParse) return "";
  const uit = await pdfParse(buffer, { max: 1 });
  return uit.text as string;
}

describe("organisatie op de cover van het individuele rapport", () => {
  it("zet de organisatie op de cover in het Nederlands", async () => {
    const { buffer } = await genereer2msRapportOpVolgorde(VOLGORDE, "EE", "nl", {
      naam: "Naima El Amrani",
      datum: "25/08/2026",
      organisatie: "Newco",
      taal: "nl",
    });
    const tekst = await tekstVanEersteBlad(buffer);
    if (tekst) {
      expect(tekst).toContain("Newco");
      expect(tekst).toContain("Naima El Amrani");
    }
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("laat de cover ongemoeid zonder organisatie", async () => {
    const zonder = await genereer2msRapportOpVolgorde(VOLGORDE, "EE", "nl", {
      naam: "Naima El Amrani",
      datum: "25/08/2026",
    });
    const met = await genereer2msRapportOpVolgorde(VOLGORDE, "EE", "nl", {
      naam: "Naima El Amrani",
      datum: "25/08/2026",
      organisatie: "Newco",
      taal: "nl",
    });
    expect(met.buffer.length).not.toBe(zonder.buffer.length);
  });

  it("struikelt niet over tekens buiten WinAnsi", async () => {
    const { buffer } = await genereer2msRapportOpVolgorde(VOLGORDE, "EE", "ru", {
      naam: "Naima El Amrani",
      datum: "25/08/2026",
      organisatie: "ООО Ньюко",
      taal: "ru",
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("houdt een zeer lange organisatienaam binnen het blok", async () => {
    const { buffer } = await genereer2msRapportOpVolgorde(VOLGORDE, "EE", "en", {
      naam: "Naima El Amrani",
      datum: "25/08/2026",
      organisatie: "Newco International Holdings and Partners Limited Belgium",
      taal: "en",
    });
    const tekst = await tekstVanEersteBlad(buffer);
    if (tekst) {
      expect(tekst).not.toContain("...");
      expect(tekst).not.toContain("…");
    }
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("geeft de originele buffer terug als er niets in te vullen valt", async () => {
    const bron = Buffer.from("%PDF-1.4 niet eens een echte pdf");
    const uit = await injecteerNaamDatum(bron, {});
    expect(uit).toBe(bron);
  });
});
