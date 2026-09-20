// ---------------------------------------------------------------------------
// tests/link-basis.test.ts  -  NIEUW BESTAND
//
// AANLEIDING. Een deelnemer kreeg een uitnodiging in zijn mailbox, klikte de
// link aan, en las "404, pagina niet gevonden". Het token klopte en de
// uitnodiging stond klaar; de link zelf was stuk. De verzending nam de basis van
// de link over van de browser van de beheerder, en die stuurde ook het pad en de
// hash van zijn eigen pagina mee. Daardoor stonden er twee hekjes in de link:
//
//     https://voorbeeld.be/#/hdd#/deelnemer/abc123
//
// De router leest de route uit de hash, vond "/hdd#/deelnemer/abc123" niet, en
// wees de deelnemer de deur. Deze tests dekken de drie sloten: de basis wordt
// teruggebracht tot de voordeur, geen link verlaat het platform met twee hekjes,
// en de toepassing leest een adres met twee hekjes zelf recht, zodat ook de
// links die al verstuurd zijn weer werken.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { normaliseerBasis, basisUitVerzoek, publiekeBasis, eenHekje } from "../server/publieke-basis";
import { herstelHash } from "../client/src/lib/hash-herstel";
import { absoluteLink } from "../server/hdd/uitnodigingsmail";
import { bouwDeelnemerLink } from "../server/uitnodigingsmail";

function verzoek(headers: Record<string, string>): any {
  return { headers, protocol: "https" };
}

describe("normaliseerBasis", () => {
  it("houdt schema en servernaam over", () => {
    expect(normaliseerBasis("https://tapas.example")).toBe("https://tapas.example");
  });

  it("gooit het pad weg", () => {
    expect(normaliseerBasis("https://tapas.example/admin/bulk-import")).toBe("https://tapas.example");
  });

  it("gooit de hash weg, het geval uit de mailbox", () => {
    expect(normaliseerBasis("https://tapas.example/#/hdd")).toBe("https://tapas.example");
  });

  it("gooit de zoekreeks weg", () => {
    expect(normaliseerBasis("https://tapas.example/?uitnodiging=abc")).toBe("https://tapas.example");
  });

  it("houdt een poortnummer, want een testserver draait daarop", () => {
    expect(normaliseerBasis("http://localhost:5000/admin")).toBe("http://localhost:5000");
  });

  it("vult een ontbrekend schema aan", () => {
    expect(normaliseerBasis("tapas.example/admin")).toBe("https://tapas.example");
  });

  it("geeft een lege tekst bij rommel, en verzint niets", () => {
    expect(normaliseerBasis("")).toBe("");
    expect(normaliseerBasis(null)).toBe("");
    expect(normaliseerBasis(42)).toBe("");
    expect(normaliseerBasis("ftp://tapas.example")).toBe("");
  });
});

describe("basisUitVerzoek", () => {
  it("leest de koppen van de doorgeefserver", () => {
    expect(
      basisUitVerzoek(verzoek({ "x-forwarded-proto": "https", "x-forwarded-host": "tapas.example" })),
    ).toBe("https://tapas.example");
  });

  it("valt terug op de gewone servernaam", () => {
    expect(basisUitVerzoek(verzoek({ host: "tapas.example" }))).toBe("https://tapas.example");
  });

  it("neemt de eerste waarde uit een lijst met koppen", () => {
    expect(
      basisUitVerzoek(verzoek({ "x-forwarded-proto": "https,http", "x-forwarded-host": "tapas.example,intern" })),
    ).toBe("https://tapas.example");
  });

  it("geeft een lege tekst zonder servernaam", () => {
    expect(basisUitVerzoek(verzoek({}))).toBe("");
  });
});

describe("publiekeBasis", () => {
  it("laat de omgeving voorgaan op wat de browser meestuurt", () => {
    const oud = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://platform.tapascity.com";
    try {
      expect(publiekeBasis(verzoek({ host: "intern" }), "https://iets.anders/#/hdd")).toBe(
        "https://platform.tapascity.com",
      );
    } finally {
      if (oud === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = oud;
    }
  });

  it("gebruikt de opgave van de browser, teruggebracht tot de voordeur", () => {
    expect(publiekeBasis(verzoek({ host: "intern" }), "https://tapas.example/#/admin/bulk-import")).toBe(
      "https://tapas.example",
    );
  });

  it("valt terug op het verzoek wanneer de browser niets meestuurt", () => {
    expect(publiekeBasis(verzoek({ host: "tapas.example" }), undefined)).toBe("https://tapas.example");
  });
});

describe("eenHekje", () => {
  it("laat een gewone link ongemoeid", () => {
    expect(eenHekje("https://tapas.example#/deelnemer/abc")).toBe("https://tapas.example#/deelnemer/abc");
  });

  it("haalt het tweede hekje eruit en houdt de bestemming over", () => {
    expect(eenHekje("https://tapas.example/#/hdd#/deelnemer/abc")).toBe("https://tapas.example/#/deelnemer/abc");
  });

  it("houdt de zoekreeks van het eerste deel, want de 2MINSCAN leest die", () => {
    expect(eenHekje("https://tapas.example/?uitnodiging=abc#/hdd#/2minscan")).toBe(
      "https://tapas.example/?uitnodiging=abc#/2minscan",
    );
  });

  it("laat een link zonder hekje ongemoeid", () => {
    expect(eenHekje("https://tapas.example/toegang.html?t=abc")).toBe("https://tapas.example/toegang.html?t=abc");
  });
});

describe("de linkbouwers samen", () => {
  it("de HDD-link blijft heel, ook met een vervuilde basis", () => {
    expect(absoluteLink("https://tapas.example/#/hdd", "/deelnemer/abc")).toBe(
      "https://tapas.example#/deelnemer/abc",
    );
  });

  it("de 2MINSCAN houdt zijn token in de zoekreeks, ook met een vervuilde basis", () => {
    expect(absoluteLink("https://tapas.example/#/hdd", "/2minscan?uitnodiging=abc")).toBe(
      "https://tapas.example/?uitnodiging=abc#/2minscan",
    );
  });

  it("de gewone deelnemerslink blijft heel", () => {
    expect(bouwDeelnemerLink("https://tapas.example/admin/bulk-import", "abc")).toBe(
      "https://tapas.example#/deelnemer/abc",
    );
  });
});

describe("herstelHash in de toepassing", () => {
  it("leest het adres uit de mailbox recht", () => {
    expect(herstelHash("https://tapas.example/#/hdd#/deelnemer/abc")).toBe(
      "https://tapas.example/#/deelnemer/abc",
    );
  });

  it("houdt de zoekreeks van de 2MINSCAN", () => {
    expect(herstelHash("https://tapas.example/?uitnodiging=abc#/hdd#/2minscan")).toBe(
      "https://tapas.example/?uitnodiging=abc#/2minscan",
    );
  });

  it("raakt een gezond adres niet aan", () => {
    expect(herstelHash("https://tapas.example/#/deelnemer/abc")).toBe(null);
    expect(herstelHash("https://tapas.example/")).toBe(null);
  });
});
