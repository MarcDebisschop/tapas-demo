// ---------------------------------------------------------------------------
// server/toestemming-poort.ts
//
// WAAROM DEZE POORT BESTAAT
// De invulroutes van een afname droegen al een bezitsbewijs (server/afname-
// bewijs.ts), maar geen enkele controle of de startstap met de toestemmings-
// vraag ooit doorlopen werd. Uit de functionele testen van augustus 2026 bleek
// dat je op een verse uitnodiging deel 1 rechtstreeks kon inleveren, de afname
// kon afronden en een volwaardig rapport kreeg, terwijl consentGiven op false
// stond, de leeftijdsband leeg bleef en er dus geen ouderlijke toestemming was
// vastgelegd. Vastgesteld bij het T4P Business Kompas (bevinding 1) en bij
// T4Kids (bevinding 2), maar de oorzaak was voor elk instrument dezelfde: de
// regel stond enkel in het invulscherm, niet op de route.
//
// WAT DE POORT DOET
//   1. De toestemming moet vastgelegd zijn (afnames.consent_given = true). Dat
//      veld wordt enkel op true gezet door een pad waar de deelnemer de
//      toestemmingsvraag echt gezien heeft: de startstap van de uitnodiging
//      (POST /api/uitnodigingen/:token/start) of de rechtstreekse aanmaak waar
//      het toestemmingsvenster op hetzelfde scherm staat.
//   2. Voor een instrument dat zich op minderjarigen richt (T4Kids, T4Teens)
//      moet de leeftijdspoort van AVG artikel 8 ook op de opgeslagen gegevens
//      sluiten: een geldige band voor dit instrument en, waar vereist, een
//      ouderlijke toestemming met naam en e-mailadres. Dezelfde functie als in
//      de startstap, nu toegepast op wat er werkelijk in de databank staat.
//
// KEUZES DIE BEWUST ZO ZIJN
//   - Deze poort staat NA het bezitsbewijs. Wie hier komt, heeft zijn eigen
//     afname al bewezen, dus een sprekende 403 verklapt niets. Zonder bewijs
//     krijgt de bezoeker nog altijd 404 van de eerste poort.
//   - Een beheerderssessie mag door, net als bij het bezitsbewijs: ondersteuning
//     en herstelwerk mogen niet stilvallen.
//   - De melding volgt de taal van de afname, in dezelfde vriendelijke toon als
//     de volledigheidspoort. Er komen geen persoonsgegevens in het logboek.
//   - De code in de foutmelding (TOESTEMMING_ONTBREEKT of LEEFTIJDSPOORT) laat
//     de client toe de deelnemer naar de juiste stap te sturen zonder de tekst
//     te moeten lezen.
// ---------------------------------------------------------------------------
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { adminIdVanSessie } from "./admin-guard";
import { isMinderjarigInstrument, valideerLeeftijdspoort } from "@shared/leeftijd";
import { normaliseerTaal, t as vertaal, STANDAARD_TAAL } from "@shared/i18n";
import type { Afname } from "@shared/schema";

export interface ToestemmingUitspraak {
  ok: boolean;
  code?: "TOESTEMMING_ONTBREEKT" | "LEEFTIJDSPOORT";
  melding?: string;
}

/**
 * Zuivere controle op een reeds opgeslagen afname. Los te testen en te
 * hergebruiken; de middleware hieronder doet enkel het HTTP-werk.
 */
export function controleerToestemmingVastgelegd(afname: Afname): ToestemmingUitspraak {
  const taal = normaliseerTaal(afname.taal ?? STANDAARD_TAAL);

  if (afname.consentGiven !== true) {
    return {
      ok: false,
      code: "TOESTEMMING_ONTBREEKT",
      melding: vertaal("toestemming_nog_niet_gegeven", taal),
    };
  }

  if (!isMinderjarigInstrument(afname.instrumentId)) {
    return { ok: true };
  }

  const poort = valideerLeeftijdspoort({
    instrumentId: afname.instrumentId,
    leeftijdsband: afname.leeftijdsband ?? null,
    ouderlijkeToestemming: afname.ouderlijkeToestemming ?? false,
    ouderNaam: afname.ouderNaam ?? null,
    ouderEmail: afname.ouderEmail ?? null,
  });
  if (poort.ok) return { ok: true };

  // De teksten van de leeftijdspoort zijn al kindvriendelijk opgeschreven en
  // vertellen precies welke stap ontbreekt; we geven ze ongewijzigd door.
  return { ok: false, code: "LEEFTIJDSPOORT", melding: poort.fout };
}

/**
 * Poortwachter voor de inleverroutes van een afname (/concept, /main,
 * /connection). Zet deze NA vereisAfnameBewijs.
 */
export async function vereisVastgelegdeToestemming(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Afname niet gevonden" });
    return;
  }
  if (adminIdVanSessie(req) !== null) {
    next();
    return;
  }
  const afname = await storage.getAfname(id);
  if (!afname) {
    res.status(404).json({ error: "Afname niet gevonden" });
    return;
  }
  const uitspraak = controleerToestemmingVastgelegd(afname);
  if (uitspraak.ok) {
    next();
    return;
  }
  console.warn(
    `[toestemming-poort] geweigerd (${uitspraak.code}): ${req.method} ${req.path} (afname ${id})`,
  );
  res.status(403).json({ error: uitspraak.melding, code: uitspraak.code });
}
