// ---------------------------------------------------------------------------
// tests/mailpoort-afzender-lezen.test.ts  -  NIEUW BESTAND
//
// In de instellingen van de dienst stond een afzender met een los teken erin:
// "marc@tapascity.com>", het restant van een geknipte vermelding "Naam <adres>".
// De vorige lezing vroeg een openende punthaak, liet dat teken staan, en de
// leverancier weigerde elk bericht op een adres dat op het scherm juist leek.
// Een teken te veel mag geen verzending kosten.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { ontleedAfzender } from "../server/mailpoort/keuring";

describe("ontleedAfzender", () => {
  it("leest een puur adres", () => {
    expect(ontleedAfzender("marc@tapascity.com")).toEqual({ email: "marc@tapascity.com", naam: null });
  });

  it("leest de nette vorm met naam", () => {
    expect(ontleedAfzender("TaPasCity <marc@tapascity.com>")).toEqual({
      email: "marc@tapascity.com",
      naam: "TaPasCity",
    });
  });

  it("verdraagt een sluitende punthaak zonder openende", () => {
    expect(ontleedAfzender("marc@tapascity.com>").email).toBe("marc@tapascity.com");
  });

  it("verdraagt een openende punthaak zonder sluitende", () => {
    expect(ontleedAfzender("TAPASCITY <marc@tapascity.com").email).toBe("marc@tapascity.com");
  });

  it("verdraagt ruimtes voor en na", () => {
    expect(ontleedAfzender("  marc@tapascity.com  ").email).toBe("marc@tapascity.com");
  });

  it("haalt het adres uit een vermelding met een naam met streepjes", () => {
    const uit = ontleedAfzender("TAPASCITY - 2BQ CONSULTING <marc@tapascity.com>");
    expect(uit.email).toBe("marc@tapascity.com");
    expect(uit.naam).toBe("TAPASCITY - 2BQ CONSULTING");
  });

  it("laat een tekst zonder apenstaartje ongemoeid, zodat de keuring erover kan klagen", () => {
    expect(ontleedAfzender("geen adres").email).toBe("geen adres");
  });

  it("schrapt een punt of puntkomma achteraan", () => {
    expect(ontleedAfzender("marc@tapascity.com;").email).toBe("marc@tapascity.com");
  });
});
