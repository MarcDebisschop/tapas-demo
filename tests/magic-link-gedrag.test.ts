// ---------------------------------------------------------------------------
// tests/magic-link-gedrag.test.ts
//
// Gedragstest op de aanmeldlink, tegen een databank in het geheugen. Dit toetst
// niet de broncode maar het werkelijke gedrag: wat er gebeurt met een geldig,
// een verlopen, een tweemaal gebruikt en een verzonnen token.
//
// De databank van de app wordt hierbij niet aangeraakt: maakTabel(), bewaarToken()
// en gebruikToken() krijgen de databank als argument mee.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { maakTabel, bewaarToken, gebruikToken, LINK_GELDIG_MIN } from "../server/magic-link";

const EMAIL = "deelnemer@voorbeeld.be";

let db: any;

beforeEach(() => {
  db = new Database(":memory:");
  maakTabel(db);
});

describe("De aanmeldlink — geldig gebruik", () => {
  it("geeft het e-mailadres terug bij een vers token", () => {
    const { token } = bewaarToken(db, EMAIL);
    expect(gebruikToken(db, token)).toBe(EMAIL);
  });

  it("maakt een token van 64 hexadecimale tekens", () => {
    const { token } = bewaarToken(db, EMAIL);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("geeft twee keer op rij nooit hetzelfde token", () => {
    const a = bewaarToken(db, EMAIL).token;
    const b = bewaarToken(db, EMAIL).token;
    expect(a).not.toBe(b);
  });

  it("zet de vervaldatum op 15 minuten na de aanvraag", () => {
    const nu = new Date("2026-08-15T12:00:00.000Z");
    const { verlooptOp } = bewaarToken(db, EMAIL, nu);
    const verschilMin = (new Date(verlooptOp).getTime() - nu.getTime()) / 60000;
    expect(verschilMin).toBe(LINK_GELDIG_MIN);
    expect(verschilMin).toBe(15);
  });
});

describe("De aanmeldlink — eenmalig gebruik", () => {
  it("werkt de tweede keer niet meer", () => {
    const { token } = bewaarToken(db, EMAIL);
    expect(gebruikToken(db, token)).toBe(EMAIL);
    expect(gebruikToken(db, token)).toBeNull();
  });

  it("markeert het token als gebruikt in de tabel", () => {
    const { token } = bewaarToken(db, EMAIL);
    gebruikToken(db, token);
    const rij = db
      .prepare("SELECT gebruikt_op FROM deelnemer_magic_links WHERE token = ?")
      .get(token) as { gebruikt_op: string | null };
    expect(rij.gebruikt_op).toBeTruthy();
  });
});

describe("De aanmeldlink — verlopen", () => {
  it("werkt niet meer na 15 minuten en 1 seconde", () => {
    const nu = new Date("2026-08-15T12:00:00.000Z");
    const { token } = bewaarToken(db, EMAIL, nu);
    const later = new Date(nu.getTime() + (LINK_GELDIG_MIN * 60 + 1) * 1000);
    expect(gebruikToken(db, token, later)).toBeNull();
  });

  it("werkt nog net na 14 minuten en 59 seconden", () => {
    const nu = new Date("2026-08-15T12:00:00.000Z");
    const { token } = bewaarToken(db, EMAIL, nu);
    const bijna = new Date(nu.getTime() + (LINK_GELDIG_MIN * 60 - 1) * 1000);
    expect(gebruikToken(db, token, bijna)).toBe(EMAIL);
  });

  it("werkt niet meer op het exacte vervalmoment", () => {
    const nu = new Date("2026-08-15T12:00:00.000Z");
    const { token, verlooptOp } = bewaarToken(db, EMAIL, nu);
    expect(gebruikToken(db, token, new Date(verlooptOp))).toBeNull();
  });
});

describe("De aanmeldlink — ongeldige invoer", () => {
  it("weigert een verzonnen token van de juiste vorm", () => {
    bewaarToken(db, EMAIL);
    expect(gebruikToken(db, "a".repeat(64))).toBeNull();
  });

  it("weigert een leeg token", () => {
    expect(gebruikToken(db, "")).toBeNull();
  });

  it("weigert een te kort token", () => {
    expect(gebruikToken(db, "abc123")).toBeNull();
  });

  it("weigert een token met andere tekens dan hexadecimaal", () => {
    expect(gebruikToken(db, "Z".repeat(64))).toBeNull();
  });

  it("weigert een token met hoofdletters", () => {
    const { token } = bewaarToken(db, EMAIL);
    expect(gebruikToken(db, token.toUpperCase())).toBeNull();
  });

  it("weigert een poging tot SQL-injectie in het token", () => {
    bewaarToken(db, EMAIL);
    expect(gebruikToken(db, "' OR 1=1 --")).toBeNull();
    // De tabel blijft intact en het echte token blijft ongebruikt.
    const aantal = db
      .prepare("SELECT COUNT(*) AS n FROM deelnemer_magic_links WHERE gebruikt_op IS NULL")
      .get() as { n: number };
    expect(aantal.n).toBe(1);
  });
});

describe("De aanmeldlink — scheiding tussen deelnemers", () => {
  it("geeft het token van de ene deelnemer niet aan de andere", () => {
    const a = bewaarToken(db, "een@voorbeeld.be");
    bewaarToken(db, "twee@voorbeeld.be");
    expect(gebruikToken(db, a.token)).toBe("een@voorbeeld.be");
  });
});
