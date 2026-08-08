// ---------------------------------------------------------------------------
// tests/db-encryptie.test.ts - het gedrag van de encryptie-at-rest-hook.
//
// De eerste vier tests bestonden al en blijven ongewijzigd: ze leggen de kern
// vast (no-op zonder sleutel, pragma met sleutel, geen pragma-injectie, geen
// crash zonder pragma-functie).
//
// Wat er is bijgekomen gaat over de VALKUIL van deze module. De standaard
// better-sqlite3-driver negeert `PRAGMA key` zonder te klagen. Een sleutel zetten
// zonder cipher-driver geeft dus een systeem dat versleuteld LIJKT terwijl het
// bestand in klaartekst op schijf staat. Daarom moet `encryptieStatus()` in dat
// geval hard "niet actief" zeggen, en moet de opstartmelding dat ook uitspreken.
// ---------------------------------------------------------------------------
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  pasEncryptieToe,
  isEncryptieGeconfigureerd,
  cipherVersie,
  encryptieStatus,
  logEncryptieStatus,
  GEKENDE_HANDLES,
} from "../server/db-encryptie";

describe("FIX 6 - encryptie at rest hook", () => {
  const origineel = process.env.TAPAS_DB_SLEUTEL;
  afterEach(() => {
    if (origineel === undefined) delete process.env.TAPAS_DB_SLEUTEL;
    else process.env.TAPAS_DB_SLEUTEL = origineel;
  });

  it("is een no-op zonder sleutel: roept pragma niet aan", () => {
    delete process.env.TAPAS_DB_SLEUTEL;
    let aangeroepen = false;
    pasEncryptieToe({ pragma: () => { aangeroepen = true; } });
    expect(aangeroepen).toBe(false);
    expect(isEncryptieGeconfigureerd()).toBe(false);
  });

  it("past PRAGMA key toe wanneer een sleutel gezet is", () => {
    process.env.TAPAS_DB_SLEUTEL = "geheim-123";
    let ontvangen = "";
    pasEncryptieToe({ pragma: (s: string) => { ontvangen = s; return null; } });
    expect(ontvangen).toBe("key='geheim-123'");
    expect(isEncryptieGeconfigureerd()).toBe(true);
  });

  it("ontdubbelt aanhalingstekens in de sleutel (geen pragma-injectie)", () => {
    process.env.TAPAS_DB_SLEUTEL = "a'b";
    let ontvangen = "";
    pasEncryptieToe({ pragma: (s: string) => { ontvangen = s; return null; } });
    expect(ontvangen).toBe("key='a''b'");
  });

  it("crasht niet wanneer de driver geen pragma ondersteunt", () => {
    process.env.TAPAS_DB_SLEUTEL = "x";
    expect(() => pasEncryptieToe({} as any)).not.toThrow();
  });
});

describe("FIX 6 - cipher-driver herkennen", () => {
  it("geeft null bij de standaard better-sqlite3-driver", () => {
    // Dit is de driver die het project vandaag gebruikt. Hij kent
    // PRAGMA cipher_version niet en antwoordt met een lege lijst.
    const db = new Database(":memory:");
    try {
      expect(cipherVersie(db)).toBeNull();
    } finally {
      db.close();
    }
  });

  it("geeft null bij een handle zonder pragma-functie", () => {
    expect(cipherVersie({})).toBeNull();
  });

  it("geeft null wanneer de pragma-aanroep faalt", () => {
    expect(cipherVersie({ pragma: () => { throw new Error("onbekend"); } })).toBeNull();
  });

  it("leest de versie uit de rijvorm van better-sqlite3-multiple-ciphers", () => {
    // De cipher-driver antwoordt met een rij, niet met een kale tekenreeks.
    expect(cipherVersie({ pragma: () => [{ cipher_version: "4.5.6 community" }] })).toBe(
      "4.5.6 community",
    );
  });

  it("leest de versie ook als kale tekenreeks", () => {
    expect(cipherVersie({ pragma: () => "4.5.6" })).toBe("4.5.6");
  });
});

describe("FIX 6 - status is auditbaar", () => {
  const origineel = process.env.TAPAS_DB_SLEUTEL;
  beforeEach(() => {
    delete process.env.TAPAS_DB_SLEUTEL;
  });
  afterEach(() => {
    if (origineel === undefined) delete process.env.TAPAS_DB_SLEUTEL;
    else process.env.TAPAS_DB_SLEUTEL = origineel;
  });

  it("meldt niet-actief zonder sleutel en noemt de omgevingsvariabele", () => {
    const status = encryptieStatus();
    expect(status.sleutelGezet).toBe(false);
    expect(status.actief).toBe(false);
    expect(status.cipherDriver).toBeNull();
    expect(status.reden).toContain("TAPAS_DB_SLEUTEL");
  });

  it("bevraagt de databank NIET zonder sleutel", () => {
    // Opzet: in de demo mag deze module geen enkele pragma uitvoeren. Zou de
    // statusfunctie de driver toch bevragen, dan raakt ze de echte databank bij
    // elke statuscontrole.
    let aantal = 0;
    pasEncryptieToe({ pragma: () => { aantal += 1; return null; } }, "test");
    encryptieStatus();
    expect(aantal).toBe(0);
  });

  it("meldt NIET actief bij een sleutel zonder cipher-driver", () => {
    // De gevaarlijkste toestand: de sleutel is gezet, de beheerder denkt dat het
    // in orde is, maar de standaarddriver negeert de pragma stil.
    process.env.TAPAS_DB_SLEUTEL = "een-sleutel";
    const db = new Database(":memory:");
    try {
      pasEncryptieToe(db, "server/storage.ts");
      const status = encryptieStatus();
      expect(status.sleutelGezet).toBe(true);
      expect(status.cipherDriver).toBeNull();
      expect(status.actief).toBe(false);
      expect(status.reden).toContain("klaartekst");
    } finally {
      db.close();
    }
  });

  it("schrijft een opstartregel die de toestand uitspreekt", () => {
    const regels: string[] = [];
    logEncryptieStatus((r) => regels.push(r));
    expect(regels).toHaveLength(1);
    expect(regels[0]).toContain("[tapas] encryptie-at-rest:");
    expect(regels[0]).toContain("NIET ACTIEF");
  });

  it("meldt actief zodra sleutel en cipher-driver samen aanwezig zijn", () => {
    // De cipher-driver zit niet in het project, dus wordt hij hier nagebootst.
    // Wat getest wordt is de BESLISSING, niet de driver: enkel sleutel plus
    // cipher-versie mag "actief" opleveren.
    process.env.TAPAS_DB_SLEUTEL = "een-sleutel";
    const aanroepen: string[] = [];
    const nep = {
      pragma: (s: string) => {
        aanroepen.push(s);
        return s === "cipher_version" ? [{ cipher_version: "4.5.6" }] : [];
      },
    };
    for (const naam of GEKENDE_HANDLES) pasEncryptieToe(nep, naam);

    const status = encryptieStatus();
    expect(status.actief).toBe(true);
    expect(status.cipherDriver).toBe("4.5.6");
    // Containment en geen gelijkheid: de tests hierboven hebben zelf ook al
    // handles geregistreerd in de moduletoestand. Wat hier telt is dat elk
    // gekend bestand erin staat.
    const ontbreekt = GEKENDE_HANDLES.filter((n) => !status.handles.includes(n));
    expect(ontbreekt, `niet geregistreerd: ${ontbreekt.join(", ")}`).toEqual([]);
    expect(status.reden).toContain("alle");

    const regels: string[] = [];
    logEncryptieStatus((r) => regels.push(r));
    expect(regels[0]).toContain("ACTIEF");
    expect(regels[0]).not.toContain("NIET ACTIEF");

    // De sleutel wordt pas gezet NA het meten van de cipher-versie: de driver
    // verwacht `key` als eerste echte handeling op de verbinding.
    expect(aanroepen[0]).toBe("cipher_version");
    expect(aanroepen[1]).toBe("key='een-sleutel'");
  });
});

describe("FIX 6 - elke databank-handle past de hook toe", () => {
  it("somt precies de bestanden op die zelf new Database(...) doen", async () => {
    // De documentatie noemde vijf handles; er zijn er negen. Deze test houdt de
    // lijst gelijk aan de werkelijkheid, want bij Optie B moet ELKE handle de
    // sleutel toepassen. Eén vergeten handle opent het bestand zonder sleutel.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const bestanden: string[] = [];
    const loop = (map: string) => {
      for (const item of readdirSync(map, { withFileTypes: true })) {
        const pad = join(map, item.name);
        if (item.isDirectory()) {
          if (item.name !== "node_modules") loop(pad);
        } else if (item.name.endsWith(".ts")) {
          bestanden.push(pad);
        }
      }
    };
    loop("server");

    const opent: string[] = [];
    for (const pad of bestanden) {
      const bron = readFileSync(pad, "utf8");
      if (/^\s*(?:const|let|var)\s+\w+\s*=\s*new Database\(/m.test(bron)) {
        opent.push(pad.split("\\").join("/"));
      }
    }
    expect(opent.sort()).toEqual([...GEKENDE_HANDLES].sort());
  });

  it("roept pasEncryptieToe aan in elk van die bestanden", async () => {
    const { readFileSync } = await import("node:fs");
    const zonder = GEKENDE_HANDLES.filter(
      (pad) => !/pasEncryptieToe\s*\(/.test(readFileSync(pad, "utf8")),
    );
    expect(zonder, `handles zonder encryptie-hook: ${zonder.join(", ")}`).toEqual([]);
  });
});
