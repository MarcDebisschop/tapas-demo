// ---------------------------------------------------------------------------
// tests/toc-kompas-consolidatie.test.ts
//
// De consolidatieregels van het TOC Commitmentkompas als pure functie, en de
// vaste inhoud: vier gelijkwaardige Captains, nergens een hiërarchische titel,
// nergens een streepje dat de huisregels verbieden.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { consolideer, ontbrekendeKaartvelden, toetsAutomatisch } from "../server/toc-kompas/consolidatie";
import * as K from "@shared/toc-kompas";
import { RENDERERS } from "../server/toc-kompas/rapporten";

function invoer(captainId: number, rol: K.CaptainRol, over: Partial<K.Antwoorden> = {}, velden: Record<string, string> = {}) {
  const a = K.legeAntwoorden();
  a.velden = { naam: `C${captainId}`, beschikbareUren: "20", opvolging: "Back-up aangeduid", ...velden };
  a.capaciteit = { delivery: 50, bedrijfsleiding: 35, buffer: 15 };
  Object.assign(a, over);
  return { captainId, rol, naam: `C${captainId}`, antwoorden: a };
}

describe("consolideer", () => {
  it("markeert een domein zonder A-owner rood en twee A-owners oranje", () => {
    const c = consolideer([
      invoer(1, "talent_innovation", { dekking: { product: { mijnRol: "A", gewensteRol: "A", urenPerMaand: 8, zekerheid: 4, ontbrekend: "" } } }),
      invoer(2, "execution_horizon", { dekking: { product: { mijnRol: "A", gewensteRol: "R", urenPerMaand: 4, zekerheid: 3, ontbrekend: "" } } }),
    ]);
    const product = c.domeinen.find((d) => d.domein === "product")!;
    expect(product.signalen).toContain("oranje");
    expect(product.aOwnersHuidig).toEqual([1, 2]);
    const legal = c.domeinen.find((d) => d.domein === "legal")!;
    expect(legal.signalen).toContain("rood");
  });

  it("markeert een A-owner zonder uren rood", () => {
    const c = consolideer([invoer(1, "visibility", { dekking: { visibility: { mijnRol: "A", gewensteRol: "A", urenPerMaand: null, zekerheid: 4, ontbrekend: "" } } })]);
    expect(c.domeinen.find((d) => d.domein === "visibility")!.signalen).toContain("rood");
  });

  it("markeert overcommitment geel", () => {
    const c = consolideer([
      invoer(1, "academy", {
        delivery: [{ outcome: "Groot", ontvanger: "", bewijs: "", deadline: "", uren: 30, raci: "A" }],
      }),
    ]);
    expect(c.signalen.some((s) => s.soort === "geel" && s.captainId === 1)).toBe(true);
    expect(c.capaciteit[0].inzetbaarUren).toBe(17);
  });

  it("geeft een aandachtspunt bij een som die niet 100 is en bij een buffer onder 10", () => {
    const c = consolideer([invoer(1, "academy", { capaciteit: { delivery: 60, bedrijfsleiding: 35, buffer: 5 } })]);
    expect(c.signalen.filter((s) => s.soort === "aandacht").length).toBeGreaterThanOrEqual(1);
  });

  it("markeert een key-person risk blauw", () => {
    const c = consolideer([invoer(1, "academy", { dekking: { academy: { mijnRol: "A", gewensteRol: "A", urenPerMaand: 8, zekerheid: 4, ontbrekend: "" } } }, { opvolging: "" })]);
    expect(c.signalen.some((s) => s.soort === "blauw")).toBe(true);
  });

  it("berekent geen gemiddelde dekkingsscore", () => {
    const c: any = consolideer([invoer(1, "academy")]);
    expect(JSON.stringify(c)).not.toMatch(/gemiddeld/i);
  });
});

describe("kaartvelden en automatische toetsen", () => {
  it("vindt ontbrekende velden", () => {
    const mist = ontbrekendeKaartvelden({ code: "X", objective: "", deliverable: "", acceptatiebewijs: "", deadline: "", capaciteit: "", urenPerWeek: null, beslissingsrecht: "", stopkeuze: "" });
    expect(mist).toEqual(["outcome", "bewijs", "datum", "capaciteit", "mandaat", "stopkeuze"]);
  });

  it("een leeg register voldoet niet", () => {
    const t = toetsAutomatisch(consolideer([invoer(1, "academy")]), [], [], K.BELEGD_DOMEINEN);
    expect(t.find((x) => x.sleutel === "commitmentsVolledig")!.voldaan).toBe(false);
    expect(t.find((x) => x.sleutel === "belegd")!.voldaan).toBe(false);
  });
});

describe("vaste inhoud", () => {
  it("heeft precies vier gelijkwaardige Captain-rollen", () => {
    expect(K.CAPTAIN_ROLLEN).toHaveLength(4);
    expect(K.CAPTAIN_ROL_INFO.visibility.titel).toBe("Captain of Visibility");
    expect(K.CAPTAIN_ROL_INFO.talent_innovation.titel).toBe("Captain of Talent & Innovation");
    expect(K.CAPTAIN_ROL_INFO.execution_horizon.titel).toBe("Captain of Execution & Horizon");
    expect(K.CAPTAIN_ROL_INFO.academy.titel).toBe("Captain of The Academy");
  });

  const BESTANDEN = [
    "shared/toc-kompas.ts",
    "server/toc-kompas/service.ts",
    "server/toc-kompas/consolidatie.ts",
    "server/toc-kompas/routes.ts",
    "server/toc-kompas/rapporten/index.ts",
    "server/toc-kompas/rapporten/stijl.ts",
    "client/src/pages/toc-kompas/Invullen.tsx",
    "client/src/pages/toc-kompas/RondeDetail.tsx",
    "client/src/pages/toc-kompas/RondeLijst.tsx",
    "client/src/pages/toc-kompas/api.ts",
  ];

  it.each(BESTANDEN)("%s bevat geen verboden streepjes en geen hiërarchische titel", (f) => {
    const s = readFileSync(f, "utf8");
    expect(/[\u2013\u2014\u2212]/.test(s)).toBe(false);
    expect(s).not.toMatch(/\bCEO\b/);
    // Het TOC heet nooit bestuur of board; "capacity board" in de domeinlijst is een werkbord.
    expect(s).not.toMatch(/\b(TOC|Team of Captains)\s+(board|bestuur)\b|\b(board|bestuur)\s+\(TOC\)/i);
  });

  it("geen vergelijkende of oordelende taal over Captains in de teksten", () => {
    const alles = JSON.stringify(K);
    expect(alles).not.toMatch(/\b(hoofdcaptain|voorzitter|chef|leider van de captains)\b/i);
    expect(alles).toContain("cirkel");
  });

  it("elke renderer is geregistreerd", () => {
    expect(Object.keys(RENDERERS).sort()).toEqual([...K.RAPPORT_TYPES].sort());
  });
});
