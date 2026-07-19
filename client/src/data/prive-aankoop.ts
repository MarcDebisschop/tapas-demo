// =============================================================================
// client/src/data/prive-aankoop.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Bepaalt per instrument-id (canoniek id uit instrumentengids.ts) hoe de
// Instrumentengids de primaire actieknop toont:
//   - koopbaar: true  → "Koop & start"-knop → navigeert naar #/koop/:prijsId
//   - koopbaar: false → neutrale badge "Enkel via je organisatie / op aanvraag"
//   - niet in deze map → ongewijzigd bestaand gedrag (bv. tapas-teamscan)
//
// Dit vermijdt een herschrijving van instrumentengids.ts (Regel 1: niets
// herbouwen dat al bestaat).
// =============================================================================

export interface PriveAankoopConfig {
  koopbaar: boolean;
  prijsId: string;
}

// prijsId komt overeen met instrument_id in de server-prijzen-store
// (server/prive-aankoop/prijzen.ts) én de route #/koop/:prijsId.
export const PRIVE_AANKOOP: Record<string, PriveAankoopConfig> = {
  // Privé koopbaar (particulier, zonder organisatie).
  twominscan: { koopbaar: true, prijsId: "twominscan" },
  "t4p-business": { koopbaar: true, prijsId: "t4p-business" },
  t4kids: { koopbaar: true, prijsId: "t4kids" },
  t4teens: { koopbaar: true, prijsId: "t4teens" },
  t4students: { koopbaar: true, prijsId: "t4students" },
  // Enkel via organisatie / op aanvraag (geen start-knop, wel fiche-PDF).
  hdd: { koopbaar: false, prijsId: "" },
  "impact-roos": { koopbaar: false, prijsId: "" },
  t4recruitment: { koopbaar: false, prijsId: "" },
  t4sports: { koopbaar: false, prijsId: "" },
  "tapas-teamscan": { koopbaar: false, prijsId: "" },
};

export function priveAankoopVoor(id: string): PriveAankoopConfig | undefined {
  return PRIVE_AANKOOP[id];
}
