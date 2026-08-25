// Temperamentenwiel — publieke ingang van de module.
// Stap 1 van de integratie: de module bestaat en is testbaar, maar is nog niet
// aangesloten op een pagina of rapport.

export {
  KLEUR,
  KLEUREN,
  KLEURWOORD,
  LETTERKLEUR,
  LETTERSTIJL,
  POSITIES,
  RADII,
  SECTOREN,
  positieByWielpositie,
  type EnergieKleur,
  type Positie,
  type Sector,
} from "./posities";

export { initialenVan } from "./initialen";

export { bouwWiel, tekenDeelnemers, type WielDeelnemer, type WielOpties } from "./wiel";

export {
  analyseerTeam,
  sectorLabel,
  sectorVanPositie,
  type Inzicht,
  type InzichtSoort,
  type TeamAnalyse,
  type WielVertaler,
} from "./dynamiek";

export { Temperamentenwiel, default as TemperamentenwielComponent } from "./Temperamentenwiel";
export type { TemperamentenwielProps } from "./Temperamentenwiel";
