// 2MINSCAN — portretten van één pagina die de organisatie zelf publiceerde.
//
// Deze test waakt over de grenzen die de reden zijn dat deze weg bestaat:
// geen zoektocht over het web, alleen de pagina die de coach opgeeft, geen
// zoekmachines of sociale netwerken, robots.txt gerespecteerd, en de bron blijft
// bekend. Ze test de zuivere functies; de netwerkroute zelf wordt niet geraakt.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { zoekAfbeeldingen } from "../server/twominscan/organisatiefotos";

const BRON = "https://www.voorbeeldorganisatie.be/over-ons/directie";

const HTML = `
<html><body>
  <div class="persoon">
    <img src="/beelden/ilse-verhoeven.jpg" alt="Ilse Verhoeven">
    <h3>Ilse Verhoeven</h3><p>algemeen directeur</p>
  </div>
  <div class="persoon">
    <img data-src="https://www.voorbeeldorganisatie.be/beelden/bram.jpg" alt="">
    <h3>Bram De Cock</h3><p>financieel verantwoordelijke</p>
  </div>
  <img src="data:image/gif;base64,R0lGOD" alt="pixel">
  <img src="logo.svg" alt="logo">
</body></html>
`;

describe("zoekAfbeeldingen", () => {
  const gevonden = zoekAfbeeldingen(HTML, BRON);

  it("maakt alle adressen absoluut en laat data-URL's liggen", () => {
    for (const beeld of gevonden) expect(beeld.url.startsWith("https://")).toBe(true);
    expect(gevonden.some((b) => b.url.startsWith("data:"))).toBe(false);
  });

  it("leest ook data-src en houdt de tekst rond de afbeelding bij", () => {
    const bram = gevonden.find((b) => b.url.includes("bram.jpg"));
    expect(bram).toBeTruthy();
    expect(bram!.tekst).toContain("Bram De Cock");
  });

  it("houdt de alt-tekst bij zodat een naam herkend kan worden", () => {
    const ilse = gevonden.find((b) => b.url.includes("ilse-verhoeven"));
    expect(ilse?.alt).toBe("Ilse Verhoeven");
    expect(ilse?.url).toBe("https://www.voorbeeldorganisatie.be/beelden/ilse-verhoeven.jpg");
  });

  it("geeft elk adres maar één keer terug", () => {
    expect(new Set(gevonden.map((b) => b.url)).size).toBe(gevonden.length);
  });
});

describe("grenzen van de fotoroute", () => {
  const bron = readFileSync(
    path.resolve(__dirname, "../server/twominscan/organisatiefotos.ts"),
    "utf8",
  );

  it("weigert zoekmachines, sociale netwerken en fotobanken", () => {
    for (const host of ["google.", "bing.", "facebook.", "linkedin.", "instagram.", "gettyimages.", "shutterstock."]) {
      expect(bron).toContain(`"${host}"`);
    }
  });

  it("respecteert robots.txt en eist https", () => {
    expect(bron).toContain("magVolgensRobots");
    expect(bron).toContain('doel.protocol !== "https:"');
  });

  it("bewaart niets op de server en geeft de bron terug", () => {
    expect(bron).toContain("res.json({ bron:");
    expect(bron).not.toMatch(/\b(writeFile|db\.|sqlite|INSERT INTO)\b/);
  });

  it("begrenst het aantal en de grootte van de beelden", () => {
    expect(bron).toContain("MAX_KANDIDATEN = 12");
    expect(bron).toContain("MAX_BEELD_BYTES");
  });
});

describe("portret in het rapport", () => {
  const rapport = readFileSync(
    path.resolve(__dirname, "../client/src/pages/twominscan-rapport.tsx"),
    "utf8",
  );
  const teamwiel = readFileSync(
    path.resolve(__dirname, "../client/src/pages/twominscan-teamwiel.tsx"),
    "utf8",
  );

  it("laat het portret weg zonder iets te melden als er geen foto is", () => {
    // Alleen renderen wanneer er een foto is; nergens een tekst over een
    // ontbrekende foto.
    expect(rapport).toContain("{foto ? <Portretbeeld");
    expect(rapport).not.toMatch(/geen foto|foto ontbreekt|Foto ontbreekt/);
    expect(teamwiel).toContain("{lid.foto ? (");
  });

  it("aanvaardt alleen een afbeelding als data-URL of https-adres", () => {
    expect(rapport).toContain("data:image");
    expect(rapport).toContain("base64,");
    expect(rapport).toContain("leesPortret");
  });
});
