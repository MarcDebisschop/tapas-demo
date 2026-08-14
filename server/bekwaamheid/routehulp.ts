// ---------------------------------------------------------------------------
// server/bekwaamheid/routehulp.ts — het gedeelde plaatwerk van de routes.
//
// De zes routebestanden van deze module hadden alle zes dezelfde drie stukjes
// nodig: een id uit het pad lezen, een fout uit de opslaglaag omzetten naar een
// status, en een getal of tekst veilig uit een verzoek halen. Die drie stonden
// tot nu toe in `routes-normprofiel.ts` en waren daar goed op hun plaats zolang
// er één routebestand was.
//
// Waarom ze hier staan en niet zes keer gekopieerd zijn: het gaat om de vertaling
// van een foutmelding naar een HTTP-status, en die vertaling moet in de hele
// module dezelfde zijn. Zou het ene scherm een 409 krijgen waar het andere een
// 422 krijgt op dezelfde weigering, dan gaan de schermen verschillend reageren
// op wat in de kern hetzelfde is, en dan is de fout pas te zien wanneer een
// beheerder hem meemaakt.
//
// `routes-normprofiel.ts` blijft ongemoeid. Dat bestand heeft een eigen
// foutafhandeling met de bevindingenlijst van de normvalidatie erin, en die is
// daar specifiek. Het overschrijven ervan zou een werkend bestand aanraken om
// een stijlreden, en dat is precies wat het werkprotocol verbiedt.
// ---------------------------------------------------------------------------
import type { Request, Response } from "express";

/**
 * Leest een geheel getal uit een routeparameter.
 *
 * `parseInt("12abc")` geeft 12 en zou een verzoek naar een adres dat niemand
 * bedoeld heeft alsnog op rij 12 laten landen. Daarom een volledige toets op de
 * hele tekst en niet op het begin ervan.
 */
export function idUitPad(ruw: unknown): number | null {
  if (typeof ruw !== "string" || !/^[0-9]+$/.test(ruw)) return null;
  const id = Number(ruw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Leest een tekstveld uit een verzoek; lege tekst telt als afwezig. */
export function tekst(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  return schoon === "" ? null : schoon;
}

/** Leest een getal uit een verzoek, ook wanneer het formulier het als tekst stuurt. */
export function getal(waarde: unknown): number | null {
  if (typeof waarde === "number") return Number.isFinite(waarde) ? waarde : null;
  if (typeof waarde === "string" && waarde.trim() !== "") {
    const n = Number(waarde);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Zet een fout uit de opslaglaag om in een status die het scherm kan gebruiken.
 *
 * De opslaglaag gooit gewone `Error`s met een leesbare Nederlandse tekst. Die
 * tekst is de bron voor de indeling hieronder. Dat is bewust: de opslaglaag
 * kent geen HTTP en hoort dat ook niet te kennen, en een aparte foutklasse per
 * weigering zou de opslaglaag laten meebewegen met een keuze van de webkant.
 *
 * De indeling:
 *
 *   404 — de rij bestaat niet. Het verzoek klopt, het onderwerp niet.
 *   409 — de rij bestaat wel maar haar toestand laat de handeling niet toe.
 *         Bevroren cesuur, al gepubliceerd, al ingetrokken, verkeerde fase.
 *         Het scherm hoort dan opnieuw te laden en niet het formulier te tonen.
 *   422 — de invoer is inhoudelijk afgekeurd. Te korte motivering, score buiten
 *         bereik. Het scherm hoort de melding bij het veld te zetten.
 *   500 — al de rest. Niet stilhouden: dit is een module die over iemands
 *         bevoegdheid beslist, en een halve mislukking mag niet als succes ogen.
 */
export function foutNaarAntwoord(res: Response, fout: unknown): void {
  const bericht = fout instanceof Error ? fout.message : String(fout);

  if (bericht.includes("bestaat niet")) {
    res.status(404).json({ fout: bericht });
    return;
  }

  const toestandswoorden = [
    "bevroren",
    "al ingetrokken",
    "al gepubliceerd",
    "al een beslissing",
    "al een uitspraak",
    "al gescoord",
    "loopt al een ronde",
    "staat al een accreditatie",
    "bestaat al",
    "staat in fase",
    "kan alleen naar",
    "staat al in fase",
    "eindfase",
    "open staat",
    "voorbereiding",
    "tijdens de beoordeling",
    "nadat het debriefgesprek",
    "geen bevroren normprofiel",
    "nog geen beslissing",
    "nog geen enkele score",
    // Een plan afsluiten zonder akkoord van de betrokkene is een toestand en
    // geen invoerfout: de invoer is geldig, de stand van het plan niet.
    "zonder akkoord van de betrokkene",
  ];
  if (toestandswoorden.some((woord) => bericht.includes(woord))) {
    res.status(409).json({ fout: bericht });
    return;
  }

  const invoerwoorden = [
    "tekens",
    "tussen 1 en 5",
    "0 tot en met 3",
    "twee verschillende mensen",
    "beoordelaar die haar invoerde",
    "afgekeurd",
    "geheel getal",
    // Een waarde die niet in een vaste lijst staat, is verkeerde invoer. Alle
    // lijstcontroles in de module melden dat met het woord "Onbekend".
    "Onbekend",
  ];
  if (invoerwoorden.some((woord) => bericht.includes(woord))) {
    res.status(422).json({ fout: bericht });
    return;
  }

  res.status(500).json({ fout: bericht });
}

/** Leest het verzoeklichaam uit als een gewoon object, ook wanneer het ontbreekt. */
export function lichaam(req: Request): Record<string, unknown> {
  const ruw = req.body;
  return ruw && typeof ruw === "object" && !Array.isArray(ruw)
    ? (ruw as Record<string, unknown>)
    : {};
}

/**
 * Stuurt een 400 en geeft `true` terug wanneer het id onbruikbaar is.
 *
 * Bedoeld om bovenaan een handler te staan: `if (slechtId(res, id, "ronde")) return;`
 */
export function slechtId(res: Response, id: number | null, wat: string): boolean {
  if (id === null) {
    res.status(400).json({ fout: `Geen geldig ${wat}-id.` });
    return true;
  }
  return false;
}
