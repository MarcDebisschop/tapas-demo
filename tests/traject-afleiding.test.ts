import { describe, expect, it } from "vitest";
import {
  bepaalLijntoestand,
  berekenLijndikte,
  berekenStiltemeter,
  berekenVraagtermijn,
} from "../server/traject/afleiding";

const UUR = 60 * 60 * 1000;
const DAG = 24 * UUR;
const nu = Date.parse("2026-08-08T10:00:00.000Z");

describe("Regiekamer afleidingen", () => {
  it("geeft aandacht voor een vlag, ook als er vers contact is", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 20 * DAG,
        stiltedrempelDagen: 7,
        heeftOpenstaandeVlag: true,
        gebeurtenissen: [{ tijdstip: nu - UUR }],
        vragen: [],
      }),
    ).toBe("aandacht");
  });

  it("geeft aandacht voor een open vraag over termijn, ook als de lijn stil is", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 20 * DAG,
        stiltedrempelDagen: 7,
        gebeurtenissen: [{ tijdstip: nu - 8 * DAG }],
        vragen: [
          {
            toestand: "in_behandeling",
            antwoordtermijnOp: nu - 1,
          },
        ],
      }),
    ).toBe("aandacht");
  });

  it("geeft lopend voor een open vraag die nog binnen termijn is, ook als de lijn stil is", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 20 * DAG,
        stiltedrempelDagen: 7,
        gebeurtenissen: [{ tijdstip: nu - 8 * DAG }],
        vragen: [
          {
            toestand: "erkend",
            antwoordtermijnOp: nu + UUR,
          },
        ],
      }),
    ).toBe("lopend");
  });

  it("geeft stil zodra de drempel werkelijk overschreden is", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 20 * DAG,
        stiltedrempelDagen: 7,
        gebeurtenissen: [{ tijdstip: nu - 7 * DAG - 1 }],
        vragen: [],
      }),
    ).toBe("stil");
  });

  it("houdt een lijn op de exacte stiltedrempel in orde", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 20 * DAG,
        stiltedrempelDagen: 7,
        gebeurtenissen: [{ tijdstip: nu - 7 * DAG }],
        vragen: [],
      }),
    ).toBe("in_orde");
  });

  it("laat een lijn zonder gebeurtenis pas stil worden na de drempel vanaf de start", () => {
    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 7 * DAG,
        stiltedrempelDagen: 7,
        gebeurtenissen: [],
        vragen: [],
      }),
    ).toBe("in_orde");

    expect(
      bepaalLijntoestand({
        nu,
        trajectAangemaaktOp: nu - 7 * DAG - 1,
        stiltedrempelDagen: 7,
        gebeurtenissen: [],
        vragen: [],
      }),
    ).toBe("stil");
  });

  it("telt gebeurtenissen van exact dertig dagen geleden mee, maar geen oudere of toekomstige", () => {
    expect(
      berekenLijndikte(
        [
          { tijdstip: nu - 30 * DAG },
          { tijdstip: nu - 30 * DAG - 1 },
          { tijdstip: nu - 1 },
          { tijdstip: nu + 1 },
        ],
        nu,
      ),
    ).toBe(2);
  });

  it("meet de stiltemeter in volle periodes van vierentwintig uur", () => {
    expect(berekenStiltemeter(nu - 3 * DAG - 23 * UUR, nu)).toBe(3);
    expect(berekenStiltemeter(nu - 4 * DAG, nu)).toBe(4);
  });

  it("telt rond de Brusselse zomertijdwissel uitsluitend verstreken tijd", () => {
    const voorZomertijd = Date.parse("2026-03-28T12:00:00.000Z");
    const drieentwintigUurLater = Date.parse("2026-03-29T11:00:00.000Z");
    const vierentwintigUurLater = Date.parse("2026-03-29T12:00:00.000Z");
    const voorWintertijd = Date.parse("2026-10-24T10:00:00.000Z");
    const vijfentwintigUurLater = Date.parse("2026-10-25T11:00:00.000Z");

    expect(berekenStiltemeter(voorZomertijd, drieentwintigUurLater)).toBe(0);
    expect(berekenStiltemeter(voorZomertijd, vierentwintigUurLater)).toBe(1);
    expect(berekenStiltemeter(voorWintertijd, vijfentwintigUurLater)).toBe(1);
  });

  it("geeft resterende dagen en overschrijding van een vraagtermijn zonder tijdzonefout", () => {
    expect(berekenVraagtermijn(nu + 24 * UUR, nu)).toEqual({
      resterendeDagen: 1,
      isOverschreden: false,
    });
    expect(berekenVraagtermijn(nu, nu)).toEqual({
      resterendeDagen: 0,
      isOverschreden: false,
    });
    expect(berekenVraagtermijn(nu - 1, nu)).toEqual({
      resterendeDagen: 0,
      isOverschreden: true,
    });
  });

  it("behoudt een kalenderdag met drieentwintig uur rond de zomertijd als een resterende dag", () => {
    const antwoordtermijnOp = Date.parse("2026-03-29T11:00:00.000Z");
    const voorZomertijd = Date.parse("2026-03-28T12:00:00.000Z");

    expect(berekenVraagtermijn(antwoordtermijnOp, voorZomertijd)).toEqual({
      resterendeDagen: 1,
      isOverschreden: false,
    });
  });
});
