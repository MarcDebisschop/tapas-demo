// ---------------------------------------------------------------------------
// tests/csrf-bescherming.test.ts
//
// Auditbevinding H-2 (hoog): er was geen enkele bescherming tegen cross-site
// request forgery terwijl de sessiecookie op SameSite=None staat. De maatregel is
// oorsprongverificatie op statuswijzigende verzoeken (server/csrf-bescherming.ts).
// Deze tests leggen het gedrag vast, inclusief de bewust doorgelaten gevallen.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mag, toegestaneHosts } from "../server/csrf-bescherming";

const EIGEN = "tapas.example.org";

describe("oorsprongverificatie op statuswijzigende verzoeken", () => {
  it("laat leesverzoeken altijd door, ook van een vreemde oorsprong", () => {
    expect(mag("GET", "https://kwaadaardig.example", undefined, EIGEN).toegestaan).toBe(true);
    expect(mag("HEAD", "https://kwaadaardig.example", undefined, EIGEN).toegestaan).toBe(true);
  });

  it("weigert een POST vanaf een vreemde oorsprong", () => {
    for (const methode of ["POST", "PUT", "PATCH", "DELETE"]) {
      const uitslag = mag(methode, "https://kwaadaardig.example", undefined, EIGEN);
      expect(uitslag.toegestaan, `${methode} zou geweigerd moeten worden`).toBe(false);
      expect(uitslag.reden).toBe("onbekende oorsprong");
    }
  });

  it("laat een POST vanaf de eigen oorsprong door", () => {
    expect(mag("POST", `https://${EIGEN}`, undefined, EIGEN).toegestaan).toBe(true);
  });

  it("valt terug op de verwijzende pagina wanneer de oorsprong ontbreekt", () => {
    expect(mag("POST", undefined, `https://${EIGEN}/beheer`, EIGEN).toegestaan).toBe(true);
    expect(mag("POST", undefined, "https://kwaadaardig.example/val", EIGEN).toegestaan).toBe(false);
  });

  it("laat subdomeinen van een toegestane host door", () => {
    expect(mag("POST", `https://proxy.${EIGEN}`, undefined, EIGEN).toegestaan).toBe(true);
  });

  it("laat lokale ontwikkelhosts door", () => {
    expect(mag("POST", "http://localhost:5173", undefined, "localhost:5000").toegestaan).toBe(true);
  });
});

describe("verzoeken zonder oorsprong", () => {
  it("gaan standaard door (server-naar-server, zoals de betaalwebhook)", () => {
    const uitslag = mag("POST", undefined, undefined, EIGEN);
    expect(uitslag.toegestaan).toBe(true);
    expect(uitslag.reden).toContain("geen oorsprong");
  });

  it("worden in strikte modus geweigerd", () => {
    expect(mag("POST", undefined, undefined, EIGEN, true).toegestaan).toBe(false);
  });
});

describe("de lijst van toegestane oorsprongen", () => {
  const bewaard = process.env.TAPAS_TOEGESTANE_ORIGINS;
  beforeEach(() => {
    process.env.TAPAS_TOEGESTANE_ORIGINS = "https://tapas-demo.onrender.com, eigen.example.net";
  });
  afterEach(() => {
    if (bewaard === undefined) delete process.env.TAPAS_TOEGESTANE_ORIGINS;
    else process.env.TAPAS_TOEGESTANE_ORIGINS = bewaard;
  });

  it("neemt oorsprongen uit de omgeving over, met of zonder schema", () => {
    const hosts = toegestaneHosts(EIGEN);
    expect(hosts.has("tapas-demo.onrender.com")).toBe(true);
    expect(hosts.has("eigen.example.net")).toBe(true);
    expect(hosts.has(EIGEN)).toBe(true);
  });

  it("laat een POST van een via de omgeving toegevoegde oorsprong door", () => {
    expect(mag("POST", "https://tapas-demo.onrender.com", undefined, EIGEN).toegestaan).toBe(true);
  });
});

describe("aansluiting in de server", () => {
  const index = readFileSync(resolve(__dirname, "..", "server/index.ts"), "utf8");

  it("staat als middleware aangesloten", () => {
    expect(index).toMatch(/app\.use\(csrfBescherming\)/);
  });

  it("staat voor de sessiemiddleware, zodat een geweigerd verzoek de sessie niet raakt", () => {
    expect(index.indexOf("app.use(csrfBescherming)")).toBeLessThan(index.indexOf("app.use(session("));
  });

  it("logt een weigering zonder persoonsgegevens", () => {
    const bron = readFileSync(resolve(__dirname, "..", "server/csrf-bescherming.ts"), "utf8");
    const logregel = bron.match(/console\.warn\(`\[csrf\][^`]*`\)/);
    expect(logregel, "logregel niet gevonden").not.toBeNull();
    expect(logregel![0]).not.toMatch(/email|body|cookie|headers\.origin/);
  });
});
