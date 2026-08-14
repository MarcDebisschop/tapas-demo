// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-licentiebeeld.ts — één leesweg voor drie schermen.
//
//   GET /api/bekwaamheid/licentiebeeld?peildatum=JJJJ-MM-DD
//
// Bouwplan §9.7 vraagt op `/admin/toegang` een tweede kolom "licentie", op
// `/admin/coaches` de licentiestatussen per coach en op `/coach/dashboard` één
// kaart. Dat is drie keer dezelfde vraag, dus één eindpunt en één rekenkern
// (`licentiebeeld.ts`). Drie schermen die elk zelf statussen gaan tellen, is
// drie keer een kans op een ander antwoord op dezelfde vraag.
//
// Dit bestand haalt op en rekent niet, net als `routes-regiekamer.ts`. Het is
// een leesweg: er wordt niets geschreven, ook geen auditregel. Wie kijkt hoe
// iemand ervoor staat, verandert daarmee niets aan die persoon.
//
// Waarom het beeld per beheerder-id komt en niet per geaccrediteerde-id. De
// schermen die erom vragen, kennen beheerders — `/admin/toegang` staat vol met
// beheerder-rijen. Het register is een tabel verderop met een eigen sleutel.
// Zou dit eindpunt geaccrediteerde-id's teruggeven, dan moet elk scherm de
// koppeling zelf leggen, en dan is er weer een plek waar het mis kan gaan.
//
// Wat hier uitdrukkelijk niet in staat: e-mailadressen, namen, of wat dan ook
// uit het register. Het antwoord is een afbeelding van beheerder-id naar
// getallen en statussen. Een scherm dat een naam wil, heeft die al.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import {
  maakLicentieBeeld,
  type LicentieBeeld,
  type LicentieVoorBeeld,
} from "./licentiebeeld";
import { platformdeelVanInstrument } from "./poort-platformdelen";

/**
 * Het beeld van één beheerder, plus de brug naar de platformdelen.
 *
 * `perPlatformdeel` bestaat om één reden: de kolom "licentie" op
 * `/admin/toegang` staat naast een schakelaar, en die schakelaar gaat over een
 * platformdeel, niet over een instrument. Zonder deze brug zou het scherm zelf
 * moeten weten welk instrument bij `kompas` hoort, en dan bestaat die afbeelding
 * op twee plaatsen — hier en in de browser. Ze hoort op één plaats te staan, en
 * dat is `poort-platformdelen.ts`, want dat is dezelfde afbeelding die de poort
 * gebruikt om te weigeren.
 *
 * Een platformdeel zonder enkel gekoppeld instrument komt niet in de afbeelding
 * voor. `bekwaamheid`, `credits` en `t4p-profielen` zijn zulke delen: het zijn
 * onderdelen van het platform waar geen instrument achter zit, en daar is een
 * licentievoorwaarde niet aan de orde.
 */
export interface BeheerderLicentiebeeld extends LicentieBeeld {
  /**
   * Platformdeel-id naar de licenties die eronder hangen. Een deel kan meerdere
   * instrumenten dragen, dus dit is een lijst en geen enkele waarde.
   */
  perPlatformdeel: Record<
    string,
    Array<{ instrumentId: string; status: string; afnamerecht: boolean; reden: string | null }>
  >;
}

export interface LicentiebeeldAntwoord {
  peildatum: string;
  /** Beheerder-id (als tekst, want JSON-sleutels zijn tekst) naar beeld. */
  perBeheerder: Record<string, BeheerderLicentiebeeld>;
}

/**
 * Groepeert de licenties van één persoon per platformdeel.
 *
 * Instrumenten zonder platformdeel vallen weg. Dat is geen verlies: ze staan al
 * volledig in `perInstrument`, en de poort weigert er ook niet op. Wat hier
 * wegvalt, is precies wat er op `/admin/toegang` niet te schakelen valt.
 */
function bundelPerPlatformdeel(
  beeld: LicentieBeeld,
): BeheerderLicentiebeeld["perPlatformdeel"] {
  const uit: BeheerderLicentiebeeld["perPlatformdeel"] = {};
  for (const regel of beeld.perInstrument) {
    const deel = platformdeelVanInstrument(regel.instrumentId);
    if (deel === null || deel === undefined) continue;
    (uit[deel] ??= []).push({
      instrumentId: regel.instrumentId,
      status: regel.status,
      afnamerecht: regel.afnamerecht,
      reden: regel.reden,
    });
  }
  return uit;
}

/** Vandaag als ISO-dag. */
function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Leest een peildatum uit de querystring.
 *
 * Een onleesbare datum wordt niet stil vervangen door vandaag: dan toont het
 * scherm een ander beeld dan waar het om vroeg. Dezelfde regel als in
 * `routes-regiekamer.ts`, met dezelfde 400.
 */
function leesPeildatum(ruw: unknown): string | null {
  if (ruw === undefined || ruw === null || ruw === "") return vandaag();
  if (typeof ruw !== "string") return null;
  const dag = ruw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return null;
  return Number.isNaN(Date.parse(dag + "T00:00:00Z")) ? null : dag;
}

/**
 * Bouwt het beeld voor elke beheerder die aan het register gekoppeld is.
 *
 * `lijst(false)` haalt ook de inactieve geaccrediteerden op. Dat is bewust:
 * iemand kan op `/admin/toegang` nog een actieve beheerder zijn terwijl de
 * registerkant al op inactief staat, en juist dat verschil wil je zien. Het
 * beeld zegt dan wat de licenties doen; of iemand nog in dienst is, staat op
 * het scherm zelf.
 *
 * Beheerders zonder registerrij komen niet in de afbeelding voor. Het scherm
 * leest een ontbrekende sleutel als `buiten_het_register`, en dat is precies
 * wat het is. Zou hier voor elke beheerder een leeg beeld worden neergezet, dan
 * groeit het antwoord mee met een lijst die niets met bekwaamheid te maken heeft.
 */
export function leesLicentiebeeld(
  peildatum: string,
  opslag: BekwaamheidOpslag = bekwaamheidOpslag,
): LicentiebeeldAntwoord {
  const perBeheerder: Record<string, BeheerderLicentiebeeld> = {};

  for (const persoon of opslag.register.lijst(false)) {
    if (persoon.beheerderId === null) continue;
    const licenties: LicentieVoorBeeld[] = opslag.licenties
      .vanPersoon(persoon.id)
      .map((l) => ({
        instrumentId: l.instrumentId,
        status: l.status,
        geldigVan: l.geldigVan,
        geldigTot: l.geldigTot,
        alertActief: l.alertActief,
        voorwaardeVoor: l.voorwaardeVoor,
      }));
    const beeld = maakLicentieBeeld(licenties, peildatum, true);
    perBeheerder[String(persoon.beheerderId)] = {
      ...beeld,
      perPlatformdeel: bundelPerPlatformdeel(beeld),
    };
  }

  return { peildatum, perBeheerder };
}

export function registerLicentiebeeldRoutes(app: Express): void {
  app.get(
    "/api/bekwaamheid/licentiebeeld",
    vereisAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const peildatum = leesPeildatum(req.query.peildatum);
      if (peildatum === null) {
        res.status(400).json({ error: "Peildatum onleesbaar; verwacht JJJJ-MM-DD." });
        return;
      }
      try {
        res.json(leesLicentiebeeld(peildatum));
      } catch (err) {
        console.error("[bekwaamheid/licentiebeeld] lezen mislukt:", err);
        res.status(500).json({ error: "Het licentiebeeld kon niet worden opgebouwd." });
      }
    },
  );
}
