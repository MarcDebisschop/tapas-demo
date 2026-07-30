// ---------------------------------------------------------------------------
// script/tsc-basislijn.mjs
//
// Typecontrole met een basislijn. Het project heeft een gemeten, bekend aantal
// typefouten (zie BASISLIJN hieronder). Een harde `tsc`-poort zou de
// bouwpijplijn vanaf de eerste dag rood zetten; dan wordt ze genegeerd en heeft
// niemand er iets aan. Dit script draait `tsc --noEmit`, telt de fouten en:
//
//   * faalt zodra het aantal HOGER is dan de basislijn (er is een fout bij),
//   * meldt het en slaagt wanneer het aantal LAGER is (met de vraag om de
//     basislijn te verlagen, zodat de winst vastgeklikt wordt),
//   * slaagt stil wanneer het aantal gelijk is.
//
// Zo kan het aantal typefouten alleen nog dalen.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";

// Gemeten op de hoofdtak met `npx tsc --noEmit`. Verlaag dit getal zodra de
// pijplijn meldt dat er minder fouten zijn.
const BASISLIJN = 73;

const uitvoer = spawnSync("npx", ["tsc", "--noEmit"], { encoding: "utf8" });
const tekst = `${uitvoer.stdout ?? ""}${uitvoer.stderr ?? ""}`;
const regels = tekst.split("\n").filter((r) => /error TS\d+:/.test(r));
const aantal = regels.length;

console.log(`Typefouten: ${aantal} (basislijn ${BASISLIJN})`);

if (aantal > BASISLIJN) {
  console.error("");
  console.error(`FOUT: ${aantal - BASISLIJN} typefout(en) meer dan de basislijn.`);
  console.error("De nieuwe of gewijzigde fouten staan hieronder:");
  console.error("");
  console.error(regels.join("\n"));
  process.exit(1);
}

if (aantal < BASISLIJN) {
  console.log(
    `Winst: ${BASISLIJN - aantal} typefout(en) minder dan de basislijn. ` +
      `Verlaag BASISLIJN in script/tsc-basislijn.mjs naar ${aantal} om die winst vast te klikken.`,
  );
}

process.exit(0);
