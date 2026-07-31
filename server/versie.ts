// Auditbevinding O-3 (operationele laag): het statusadres gaf `versie: null`,
// omdat het nummer via `process.env.npm_package_version` werd opgehaald. Die
// variabele bestaat alleen wanneer node via npm gestart wordt; Render start met
// `node dist/index.cjs` en dus rechtstreeks, waardoor het nummer nooit aankwam.
//
// Deze module bepaalt de drie gegevens in drie stappen, van meest naar minst
// betrouwbaar. Zo blijft het statusadres kloppen ongeacht hoe er gebouwd of
// gestart wordt:
//
//   1. Ingebakken. Het bouwscript (script/build.mjs) zet versie, commit en
//      bouwdatum als vaste tekst in de bundel. Dit is de normale weg.
//   2. Afgelezen. Wordt er met een andere bouwopdracht gebouwd, dan leest de
//      toepassing het nummer alsnog uit package.json en de bouwdatum uit het
//      tijdstip waarop het bundelbestand geschreven is.
//   3. Terugval. Lukt ook dat niet, dan staat er "ontwikkelversie" en
//      "onbekend" in plaats van een leeg veld.
//
// Het veld `bron` in het statusadres vertelt welke van de drie stappen gebruikt
// is, zodat bij beheer meteen zichtbaar is of de bouw goed verlopen is.
//
// Eén bron van waarheid: het versienummer staat uitsluitend in package.json. Het
// bouwscript weigert te bouwen wanneer de bovenste kop van VERSION.md een ander
// nummer noemt, zodat documentatie en code niet uiteen kunnen lopen.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Herkomst van de versiegegevens; enkel bedoeld voor beheer en foutzoeken. */
export type VersieBron = "ingebakken" | "afgelezen" | "terugval";

const ingebakkenVersie = process.env.TAPAS_VERSIE;
const ingebakkenCommit = process.env.TAPAS_COMMIT;
const ingebakkenBouwdatum = process.env.TAPAS_BOUWDATUM;

/** Leest het nummer uit package.json naast de draaiende toepassing. */
function versieUitPakketbestand(): string | undefined {
  const kandidaten = [
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "..", "package.json"),
  ];
  for (const pad of kandidaten) {
    try {
      const inhoud = JSON.parse(readFileSync(pad, "utf-8")) as { version?: string };
      if (typeof inhoud.version === "string" && /^\d+\.\d+\.\d+/.test(inhoud.version)) {
        return inhoud.version;
      }
    } catch {
      // Bestand niet gevonden of onleesbaar: volgende kandidaat proberen.
    }
  }
  return undefined;
}

/** Neemt het tijdstip waarop het draaiende bundelbestand geschreven is. */
function bouwdatumUitBestand(): string | undefined {
  const bundel = process.argv[1];
  if (!bundel) return undefined;
  try {
    return statSync(bundel).mtime.toISOString();
  } catch {
    return undefined;
  }
}

const afgelezenVersie = ingebakkenVersie
  ? undefined
  : (process.env.npm_package_version ?? versieUitPakketbestand());
const afgelezenBouwdatum = ingebakkenBouwdatum ? undefined : bouwdatumUitBestand();

/** Semantisch versienummer uit package.json. */
export const VERSIE: string = ingebakkenVersie ?? afgelezenVersie ?? "ontwikkelversie";

/** Korte commit-aanduiding van de gebouwde code, of "onbekend" bij ontwikkelen. */
export const COMMIT: string =
  ingebakkenCommit ?? process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "onbekend";

/** Tijdstip van de bouw in ISO-vorm, of "onbekend" wanneer het niet te bepalen is. */
export const BOUWDATUM: string = ingebakkenBouwdatum ?? afgelezenBouwdatum ?? "onbekend";

/** Welke van de drie stappen de gegevens geleverd heeft. */
export const BRON: VersieBron = ingebakkenVersie
  ? "ingebakken"
  : afgelezenVersie
    ? "afgelezen"
    : "terugval";

/** Alle vier samen, voor het statusadres en voor de logregel bij het opstarten. */
export function versieGegevens(): {
  versie: string;
  commit: string;
  bouwdatum: string;
  bron: VersieBron;
} {
  return { versie: VERSIE, commit: COMMIT, bouwdatum: BOUWDATUM, bron: BRON };
}
