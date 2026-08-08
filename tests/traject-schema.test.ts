import { describe, expect, it } from "vitest";
import {
  FASEN_VAN_TRAJECT,
  NAMEN_VAN_WERKSTROMEN,
  trajecten,
  trajectFasen,
  trajectGebeurtenissen,
  trajectLijnen,
  trajectPartijen,
  trajectVragen,
  trajectWerkstromen,
} from "../server/traject/schema";

describe("schema van het trajectregister", () => {
  it("beschrijft precies de zeven tabellen van de eerste laag", () => {
    expect([
      trajecten,
      trajectFasen,
      trajectPartijen,
      trajectLijnen,
      trajectWerkstromen,
      trajectVragen,
      trajectGebeurtenissen,
    ].map((tabel) => tabel[Symbol.for("drizzle:Name")])).toEqual([
      "traject",
      "traject_fasen",
      "traject_partijen",
      "traject_lijnen",
      "traject_werkstromen",
      "traject_vragen",
      "traject_gebeurtenissen",
    ]);
  });

  it("draagt organisatie, beheerder, kringen, scharnier en gescheiden gebeurtenisvelden", () => {
    expect(trajecten.organisatieId.name).toBe("organisatie_id");
    expect(trajecten.aangemaaktDoorBeheerderId.name).toBe("aangemaakt_door_beheerder_id");
    expect(trajecten.huidigeFase.name).toBe("huidige_fase");
    expect(trajecten.zekerheidstrap.name).toBe("zekerheidstrap");
    expect(trajectPartijen.kring.name).toBe("kring");
    expect(trajectPartijen.rol.name).toBe("rol");
    expect(trajectLijnen.partijEenId.name).toBe("partij_een_id");
    expect(trajectLijnen.partijTweeId.name).toBe("partij_twee_id");
    expect(trajectLijnen.stiltedrempelDagen.name).toBe("stiltedrempel_dagen");
    expect(trajectVragen.lijnId.name).toBe("lijn_id");
    expect(trajectVragen.vrijgaveVragerDoorBeheerderId.name).toBe(
      "vrijgave_vrager_door_beheerder_id",
    );
    expect(trajectVragen.vrijgaveOntvangerDoorBeheerderId.name).toBe(
      "vrijgave_ontvanger_door_beheerder_id",
    );
    expect(trajectGebeurtenissen.vaststelling.name).toBe("vaststelling");
    expect(trajectGebeurtenissen.indruk.name).toBe("indruk");
  });

  it("legt de negen fasen en zes werkstromen vast", () => {
    expect(FASEN_VAN_TRAJECT).toHaveLength(9);
    expect(FASEN_VAN_TRAJECT.map((fase) => fase.volgnummer)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(NAMEN_VAN_WERKSTROMEN).toEqual([
      "financieel",
      "juridisch",
      "fiscaal",
      "commercieel",
      "technisch",
      "menselijk",
    ]);
  });
});
